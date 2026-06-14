import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { GatewayConfig } from './config/gateway-config';
import { MASTERCARD_ENTITIES } from './mastercard.entities';

/**
 * Самопроверка контракта встраивания при старте. Зонтичный модуль рассчитывает,
 * что ХОСТ предоставит инфраструктуру, которую сам модуль НЕ поднимает:
 *   1. TypeORM DataSource со всеми `MASTERCARD_ENTITIES`;
 *   2. `ScheduleModule.forRoot()` — иначе `@Cron`-очистка `kv_store`
 *      (KvCleanupService) молча не запускается (TTL-удаление остаётся ленивым);
 *   3. `webhookToken` задан — иначе приём вебхуков fail-closed отключён (401).
 *   4. `app.enableShutdownHooks()` — иначе аудит не флашится на SIGTERM (нельзя
 *      интроспектировать → только README);
 *   5. route-scoped body-parser для `POST /crossborder/rfi/documents` (2MB) —
 *      `main.ts` его НЕ ставит при встраивании; без него RFI-upload упрётся в
 *      глобальный лимит хоста (413). Интроспекции Express-парсеров нет → README.
 *
 * Провалы (1)/(2)/(3) детектируемы → явный WARN на старте с указанием как
 * починить. Пункты (4)/(5) — только документация (README «Host integration
 * checklist»).
 */
@Injectable()
export class HostIntegrityService implements OnApplicationBootstrap {
  private readonly logger = new Logger('MastercardModule');

  constructor(
    private readonly config: GatewayConfig,
    @Optional() private readonly dataSource?: DataSource,
    @Optional() private readonly scheduler?: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.checkEntities();
    this.checkScheduler();
    this.checkWebhookToken();
  }

  /** (1) Все наши entity должны быть в DataSource хоста. */
  private checkEntities(): void {
    if (!this.dataSource) {
      this.logger.warn(
        'TypeORM DataSource не найден — хост должен подключить БД, включающую ' +
          '...MASTERCARD_ENTITIES (иначе репозитории падают на первом запросе).',
      );
      return;
    }
    const missing = MASTERCARD_ENTITIES.filter(
      (e) => !this.dataSource!.hasMetadata(e),
    ).map((e) => e.name);
    if (missing.length) {
      this.logger.warn(
        `entity не зарегистрированы в DataSource хоста: ${missing.join(', ')} — ` +
          'добавьте ...MASTERCARD_ENTITIES в TypeOrmModule.forRoot({ entities }) ' +
          'или autoLoadEntities: true.',
      );
    }
  }

  /** (2) Без ScheduleModule.forRoot() декоратор @Cron молча не выполняется. */
  private checkScheduler(): void {
    if (!this.scheduler) {
      this.logger.warn(
        'ScheduleModule не подключён — периодическая @Cron-очистка kv_store не ' +
          'запустится (останется только ленивое TTL-удаление при чтении). Добавьте ' +
          'ScheduleModule.forRoot() в хост, если нужна фоновая очистка.',
      );
    }
  }

  /** (3) Пустой webhookToken = приём вебхуков fail-closed отключён (молча 401). */
  private checkWebhookToken(): void {
    if (!this.config.webhookToken) {
      this.logger.warn(
        'webhookToken не задан — приём вебхуков Mastercard ОТКЛЮЧЁН (fail-closed: ' +
          'все запросы на /webhooks/mastercard → 401). Задайте webhookToken, если ' +
          'используете push-уведомления MC.',
      );
    }
  }
}
