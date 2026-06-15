import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { GatewayConfig } from '../config/gateway-config';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import * as https from 'https';
// import = require: типизировано (см. types/mastercard.d.ts), но рантайм идентичен
// require — getAuthorizationHeader вызывается как метод модуля (нужен this-binding).
import oauth = require('mastercard-oauth1-signer');
import { McCredentials } from '../credentials/credentials.types';
import { EncryptionService } from '../encryption/encryption.service';

export interface McRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Путь относительно base URL, например /send/v1/partners/.../quotes */
  path: string;
  body?: unknown;
  /** Доп. заголовки. */
  headers?: Record<string, string>;
}

export interface McResponse<T = unknown> {
  status: number;
  data: T;
}

/** Транзиентные статусы MC, на которых имеет смысл повторить идемпотентный GET. */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/**
 * Ошибка расшифровки ответа MC (в response-интерцепторе). Выделена в отдельный
 * тип, чтобы retry-цикл НЕ принимал её за транзиентный сетевой сбой: расшифровка
 * детерминирована (битый ключ/payload) — повтор бессмыслен (лишние подписанные
 * round-trip'ы к MC), сразу превращаем в 502.
 */
class ResponseDecryptError extends Error {}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-request данные для интерцепторов (creds текущего тенанта). */
interface McAxiosConfig extends AxiosRequestConfig {
  mcCreds?: McCredentials;
}

/**
 * Низкоуровневый клиент Mastercard. Шифрование (JWE) и OAuth1-подпись вынесены в
 * axios-интерцепторы — бизнес-логика отдаёт «чистый» объект и про крипту не знает.
 *
 * Порядок в request-интерцепторе строгий: сначала шифруем тело, ПОТОМ подписываем
 * (подпись считается по уже зашифрованному телу). Response-интерцептор —
 * расшифровывает ответ. Шифрование делает отдельный `EncryptionService`
 * (тумблер по среде); при выключенном — passthrough.
 */
@Injectable()
export class MastercardClient implements OnApplicationShutdown {
  private readonly logger = new Logger(MastercardClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly httpsAgent: https.Agent;

  constructor(
    config: GatewayConfig,
    private readonly encryption: EncryptionService,
  ) {
    const raw = config.baseUrl ?? '';
    if (!raw) {
      throw new Error('MastercardModule option "baseUrl" is not set');
    }
    this.baseUrl = raw.replace(/\/+$/, '');
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      scheduling: 'lifo',
    });
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      httpsAgent: this.httpsAgent,
    });
    this.installInterceptors();
  }

  /** Освобождаем пул keep-alive сокетов на остановке — иначе при graceful
   *  shutdown / повторной инициализации модуля (тесты, HMR) сокеты висят и
   *  держат event loop дольше нужного. */
  onApplicationShutdown(): void {
    this.httpsAgent.destroy();
  }

  async request<T = unknown>(
    creds: McCredentials,
    req: McRequest,
  ): Promise<McResponse<T>> {
    // Ретрай ТОЛЬКО для идемпотентных GET (balances/rates/status). POST никогда
    // не ретраим — риск двойного списания (идемпотентность платежей — отдельно).
    const maxAttempts = req.method === 'GET' ? 3 : 1;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Конфиг строим ЗАНОВО на каждую попытку: request-интерцептор мутирует
      // config.data (шифрует+сериализует) и ставит свежую OAuth1-подпись.
      const config: McAxiosConfig = {
        url: req.path,
        method: req.method,
        data: req.body,
        headers: { ...(req.headers ?? {}) },
        validateStatus: () => true, // статус интерпретируем сами
        mcCreds: creds,
      };
      try {
        const res = await this.http.request<T>(config);
        if (
          attempt < maxAttempts &&
          TRANSIENT_STATUSES.has(res.status) // транзиентный 5xx — повторим
        ) {
          await delay(attempt * 200);
          continue;
        }
        return { status: res.status, data: res.data };
      } catch (e) {
        // Расшифровка ответа детерминирована — НЕ ретраим (иначе 2 лишних
        // подписанных round-trip'а к MC и отложенный 502). Только сетевой сбой
        // транзиентен.
        if (e instanceof ResponseDecryptError) throw e;
        lastErr = e; // сетевой сбой
        if (attempt < maxAttempts) {
          await delay(attempt * 200);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  /** Шифрование + подпись (request) и расшифровка (response). */
  private installInterceptors(): void {
    // REQUEST: 1) шифруем тело  2) подписываем по зашифрованному телу
    this.http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const creds = (config as McAxiosConfig).mcCreds;
      if (!creds) {
        throw new Error('MastercardClient: missing creds in request config');
      }

      // 1) шифрование (passthrough, если выключено). creds — для per-tenant ключа
      // (EncryptionService пока одноключевой; контракт уже креды-зависимый).
      let body = config.data;
      if (body != null) {
        const { body: out, encrypted } = this.encryption.encryptRequest(
          creds,
          body,
        );
        body = out;
        if (encrypted) config.headers.set('x-encrypted', 'true');
      }
      const payload =
        body == null
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body);
      config.data = payload;

      // 2) подпись по итоговому (зашифрованному) телу
      const fullUrl = new URL(
        (config.baseURL ?? '') + (config.url ?? ''),
      ).toString();
      const authHeader = oauth.getAuthorizationHeader(
        fullUrl,
        (config.method ?? 'get').toUpperCase(),
        payload,
        creds.consumerKey,
        creds.signingKeyPem,
      );
      config.headers.set('Authorization', authHeader);
      // Accept/Content-Type ставим, только если вызывающий их не задал — не
      // перетираем явный per-request override (по умолчанию JSON).
      if (!config.headers.has('Accept')) {
        config.headers.set('Accept', 'application/json');
      }
      if (payload !== undefined && !config.headers.has('Content-Type')) {
        config.headers.set('Content-Type', 'application/json');
      }
      return config;
    });

    // RESPONSE: расшифровываем тело (passthrough, если plain/выключено). creds
    // достаём из config ответа (для будущего per-tenant ключа расшифровки).
    this.http.interceptors.response.use((response) => {
      const creds = (response.config as McAxiosConfig).mcCreds;
      try {
        response.data = this.encryption.decryptResponse(
          creds as McCredentials,
          response.data,
        );
      } catch (e) {
        this.logger.error(
          `Расшифровка ответа MC не удалась: ${(e as Error).message}`,
        );
        // Помечаем как ResponseDecryptError — retry-цикл не примет за сетевой
        // сбой; выше (в call()) превратится в 502.
        throw new ResponseDecryptError((e as Error).message);
      }
      return response;
    });
  }
}
