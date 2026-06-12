import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomToken, safeEqual, sha256hex } from '../common/crypto.util';
import { OAuthClientEntity } from './oauth-client.entity';

/** Фиктивный хэш для выравнивания времени, когда client_id не найден. */
const DUMMY_HASH = sha256hex('');

/**
 * Реестр OAuth2-клиентов поверх PostgreSQL. Секрет хранится только хэшем;
 * сырой показывается один раз при выпуске.
 */
@Injectable()
export class ClientRegistry {
  private readonly logger = new Logger(ClientRegistry.name);

  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly repo: Repository<OAuthClientEntity>,
  ) {}

  /** Выпустить клиента для партнёра. Возвращает сырой секрет ОДИН раз. */
  async issue(
    tenantId: string,
  ): Promise<{ clientId: string; clientSecret: string }> {
    const clientId = `mc_${randomToken(9)}`;
    const clientSecret = randomToken(24);
    // Хэшируем SHA-256, а НЕ bcrypt/argon2 (которые рекомендует дока для ПАРОЛЕЙ):
    // client_secret — это 24 байта (~192 бит) CSPRNG-энтропии, не человеческий
    // пароль. Перебор/радужные таблицы, против которых нужен медленный salted-KDF,
    // на 192-битном случайном токене вычислительно невозможны, а argon2 добавил бы
    // десятки мс латентности на КАЖДУЮ валидацию токена без выигрыша. Защита от
    // утечки хэша = энтропия токена; от тайминга — safeEqual + dummy-hash в validate().
    await this.repo.save(
      this.repo.create({
        clientId,
        tenantId,
        secretHash: sha256hex(clientSecret),
        revoked: false,
      }),
    );
    this.logger.log(`Выпущен client '${clientId}' для tenant '${tenantId}'`);
    return { clientId, clientSecret };
  }

  /** Проверка пары client_id/secret. Возвращает tenantId или null. */
  async validate(
    clientId: string,
    clientSecret: string,
  ): Promise<string | null> {
    const c = await this.repo.findOne({ where: { clientId } });
    // Хэш-сравнение выполняем ВСЕГДА (против timing-энумерации client_id).
    const providedHash = sha256hex(clientSecret);
    const targetHash = c && !c.revoked ? c.secretHash : DUMMY_HASH;
    const match = safeEqual(targetHash, providedHash);
    if (!c || c.revoked || !match) return null;
    return c.tenantId;
  }

  async revoke(clientId: string): Promise<boolean> {
    const res = await this.repo.update({ clientId }, { revoked: true });
    const ok = (res.affected ?? 0) > 0;
    if (ok) this.logger.log(`Отозван client '${clientId}'`);
    return ok;
  }
}
