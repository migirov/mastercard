import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionStatusEntity } from './transaction-status.entity';

/** Поля для записи статус-события (всё, кроме автогенерируемых id/receivedAt). */
export interface TransactionStatusInput {
  eventRef?: string | null;
  tenantId?: string | null;
  transactionReference?: string | null;
  eventType?: string | null;
  transactionType?: string | null;
  status?: string | null;
  stage?: string | null;
  payload: Record<string, unknown>;
}

/**
 * Ширины varchar-колонок tx_status (синхронны с TransactionStatusEntity). Значения
 * усекаются под них ПЕРЕД вставкой: status/stage/transactionType приходят из полей
 * MC, которые НЕ покрыты DTO-валидацией длины (тело вебхука не подписано, поля
 * контролирует держатель токена). Без усечения слишком длинное значение → ошибка
 * «value too long» → 500, что (а) ломает контракт «всегда 200» и (б) уводит MC в
 * бесконечный ретрай постоянной ошибки. Полное тело сохраняется в `payload` (jsonb,
 * ограничено глобальным лимитом body 256kb), так что усечение типизированных
 * колонок ничего критичного не теряет.
 */
const WIDTHS = {
  eventRef: 200,
  tenantId: 64,
  transactionReference: 256,
  eventType: 32,
  transactionType: 16,
  status: 32,
  stage: 32,
} as const;

/** Безопасное окно выдачи статус-истории по одному ref (защита от раздувания ответа). */
const READ_LIMIT = 200;

/**
 * Статусные типы событий. `tx_status` теперь хранит ВСЕ вебхуки (дедуп по eventRef),
 * но в polling статусов мерчанту отдаём ТОЛЬКО статусные — прочие (Carded Rate / RFI)
 * лежат для дедупа+аудита и наружу через этот путь не идут.
 */
const STATUS_EVENT_TYPES = ['STATUS_CHG', 'QUOTE_STATUS_CHG'];

function trunc(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Хранилище push-уведомлений MC поверх PostgreSQL — единый источник истины для
 * обработки вебхуков (дедуп по eventRef для ВСЕХ событий; статусные дополнительно
 * несут status/stage и читаются мерчантом). Отдельного KV-слоя дедупа нет.
 */
@Injectable()
export class TransactionStatusStore {
  constructor(
    @InjectRepository(TransactionStatusEntity)
    private readonly repo: Repository<TransactionStatusEntity>,
  ) {}

  /**
   * Атомарная запись с дедупом по `eventRef`: `INSERT ... ON CONFLICT DO NOTHING
   * RETURNING id`. true = строка вставлена (свежее событие); false = конфликт
   * (дубликат — MC ретраит до 3 раз). Если `eventRef` отсутствует, строка всегда
   * вставляется (NULL'ы не конфликтуют) — дедуп для безref-событий невозможен.
   */
  async record(input: TransactionStatusInput): Promise<boolean> {
    const res = await this.repo
      .createQueryBuilder()
      .insert()
      .into(TransactionStatusEntity)
      .values({
        eventRef: trunc(input.eventRef, WIDTHS.eventRef),
        tenantId: trunc(input.tenantId, WIDTHS.tenantId),
        transactionReference: trunc(
          input.transactionReference,
          WIDTHS.transactionReference,
        ),
        eventType: trunc(input.eventType, WIDTHS.eventType),
        transactionType: trunc(input.transactionType, WIDTHS.transactionType),
        status: trunc(input.status, WIDTHS.status),
        stage: trunc(input.stage, WIDTHS.stage),
        // TypeORM QueryDeepPartialEntity рекурсивно разворачивает значения и не
        // принимает «сырой» Record для jsonb-колонки — кладём как есть через never.
        payload: input.payload as never,
      })
      .orIgnore() // ON CONFLICT DO NOTHING (по UNIQUE eventRef)
      .returning('id')
      .execute();
    return Array.isArray(res.raw) && res.raw.length > 0;
  }

  /**
   * Статус-события по `transaction_reference` для тенанта. OWN-тенант (includePool
   * = false) видит СТРОГО свои события (его push-и атрибутируются по partnerId,
   * в общий пул не попадают). PLATFORM-тенант (includePool = true) видит свои +
   * общий пул (`tenantId IS NULL`): у платформы общий partner-id, поэтому события
   * однозначно тенанту не привязываются и читаются по ref (который знает только
   * владелец транзакции). Сортировка по id ASC (хронология), с потолком строк.
   */
  async findForTenant(
    tenantId: string,
    transactionReference: string,
    includePool: boolean,
  ): Promise<TransactionStatusEntity[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.transactionReference = :ref', { ref: transactionReference })
      // Только статусные события: не-статусные (Carded Rate / RFI) тоже лежат в
      // `tx_status` для дедупа, но в статус-выдачу мерчанту попадать не должны.
      .andWhere('s.eventType IN (:...statusTypes)', {
        statusTypes: STATUS_EVENT_TYPES,
      });
    if (includePool) {
      qb.andWhere('(s.tenantId = :t OR s.tenantId IS NULL)', { t: tenantId });
    } else {
      qb.andWhere('s.tenantId = :t', { t: tenantId });
    }
    return qb.orderBy('s.id', 'ASC').limit(READ_LIMIT).getMany();
  }
}
