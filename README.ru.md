# Mastercard Cross-Border Gateway

[🇬🇧 English](README.md) · 🇷🇺 Русский

Мульти-мерчант сервис-шлюз к **Mastercard Cross-Border Services** (NestJS, Node 22,
PostgreSQL). Партнёры платформы ходят в Mastercard через нас — каждый со своими
ключами и `partner-id`, и только после двойного одобрения (Mastercard + платформа).

- Подпись каждого запроса — OAuth1 ключом конкретного тенанта (stateless).
- Field-level encryption (JWE) и подпись вынесены в axios-интерцептор.
- Persistence — PostgreSQL (рассчитано на многоподовый деплой в Kubernetes).
- Два пути доступа: внешний OAuth2 (мерчанты) и внутренний service-token.
- k8s-готовность: health/readiness-пробы, структурные JSON-логи + correlation-id,
  TypeORM-миграции, валидация ENV на старте.

---

## Документация (`docs/`)

Доступна на двух языках: **[Русский — `docs/ru/`](docs/ru/)** · **[English — `docs/en/`](docs/en/)**.
Ссылки ниже ведут на русскую версию.

| Файл | О чём |
|---|---|
| [architecture.md](docs/ru/architecture.md) | **Архитектура (as-built)** — схема, модули, потоки, хранение, безопасность, статус фаз. Начать отсюда. |
| [documentation.md](docs/ru/documentation.md) | **Сущности и концепции** — Tenant, OAuthClient, AuditLog, PaymentIdempotency, TransactionStatus, McCredentials и др.; где БД / где in-memory; шифрование (интерцептор); сценарии OWN/PLATFORM; `tenant_id` vs `partner_id`. |
| [api.md](docs/ru/api.md) | **Справочник по нашему API** — все эндпоинты (OAuth, Cross-Border, Admin, Webhooks), аутентификация, примеры запросов/ответов, rate-limits. |
| [api-mastercard.md](docs/ru/api-mastercard.md) | **Официальная дока Mastercard** Cross-Border (полный референс, ~540 КБ). Источник истины по форматам payload. |
| [plan.md](docs/ru/plan.md) | **План и статус** по фазам 1–6 + миграции/доработки, с историей аудитов. |
| [tests.md](docs/ru/tests.md) | **Тесты интеграции с Mastercard** — исходящие вызовы в Cross-Border API + входящие webhooks. |
| [tests-inner.md](docs/ru/tests-inner.md) | **Тесты внутренней логики** — auth/доступ, надёжность, инфраструктура (без обращения к MC). |
| [production-questions.md](docs/ru/production-questions.md) | **Блокеры и вопросы перед production** (в т.ч. per-tenant encryption, выбор секрет-менеджера, TypeORM-интеграция). |
| [client-questions.md](docs/ru/client-questions.md) | Открытые вопросы к клиенту по интеграции. |
| [memory.md](docs/ru/memory.md) | Хендофф-контекст разработки (для восстановления состояния сессии). |

---

## ⚠️ Папка `certs/` (обязательна, не в репозитории)

Криптоматериал Mastercard **не коммитится** (в `.gitignore`: `certs/`, `*.p12`,
`*.pem`, `*.key`). Для запуска папку `certs/` нужно создать и положить туда ключи
из вашего проекта на [Mastercard Developers](https://developer.mastercard.com).

| Файл | Назначение | Переменная `.env` |
|---|---|---|
| `Fintory-sandbox-signing.p12` | приватный ключ **подписи OAuth1** | `MC_SIGNING_KEY_PATH` (+ `MC_SIGNING_KEY_PASSWORD`) |
| `mastercard-encryption-cert.pem` | публичный cert **Mastercard Encryption Key** — им шифруются ЗАПРОСЫ (JWE) в MTF/Prod | `MC_ENCRYPTION_CERT_PATH` (+ `MC_ENCRYPTION_FINGERPRINT`) |
| приватный **Client Encryption key** (PEM) | расшифровка ОТВЕТОВ в MTF/Prod | `MC_DECRYPTION_KEY_PATH` *(в sandbox не нужен)* |

> **Sandbox не поддерживает field-level encryption** — там работает plain
> (`MC_ENCRYPTION_ENABLED=false`), и достаточно signing-ключа + consumer key.
> Шифрование включается только в MTF/Production. Подробно про ключи — в
> [architecture.md](docs/ru/architecture.md) и [documentation.md](docs/ru/documentation.md).

### `.env` (тоже не в репозитории)

Конфигурация и секреты — в `.env` (в `.gitignore`). Ключевые переменные:

```
MC_BASE_URL, MC_CONSUMER_KEY, MC_PARTNER_ID
MC_SIGNING_KEY_PATH, MC_SIGNING_KEY_PASSWORD
MC_ENCRYPTION_CERT_PATH, MC_ENCRYPTION_FINGERPRINT, MC_ENCRYPTION_ENABLED
MC_DECRYPTION_KEY_PATH                  # для MTF/Prod
DATABASE_URL, DB_POOL_MAX               # PostgreSQL
MC_JWT_SECRET, MC_INTERNAL_TOKEN, MC_ADMIN_TOKEN, MC_WEBHOOK_TOKEN
MC_SECRET_STORE                         # local (dev) | vault (prod)
TRUST_PROXY                             # число хопов ингресса за прокси
```

В production действуют гейты (`main.ts`): запрет старта со слабыми/дефолтными
секретами и требование `MC_SECRET_STORE=vault`. Схема — только миграции (без `synchronize`).

---

## Быстрый старт (dev)

Требуется Node 22 и Docker (для PostgreSQL).

```bash
# 1) зависимости
npm install

# 2) PostgreSQL
docker compose up -d            # Postgres 16, см. docker-compose.yml

# 3) положить ключи в certs/ и заполнить .env (см. выше)

# 4) запустить сервис (dev)
npx ts-node src/harness/main.ts # http://localhost:3000, схема из миграций + сид platform
```

Smoke-тест: `npm run ping` (балансы через тестового тенанта). Swagger: `/api-docs`.

> **Windows + проект на WSL:** node запускается из Windows, а прямой `npm run`
> падает на UNC-пути. Обход:
> `cmd /c "pushd \\wsl.localhost\Ubuntu\...\mastercard && npm run ping & popd"`.

---

## Миграции БД (production)

Схема ведётся **миграциями** (TypeORM CLI) во всех средах — `synchronize` не
используется. В **dev** харнесс строит её из миграций на старте (`migrationsRun`);
в **production** миграции применяются на деплое. DataSource для CLI:
[src/database/data-source.ts](src/database/data-source.ts).

```bash
# сгенерировать миграцию по изменениям сущностей
DATABASE_URL=... npm run migration:generate -- src/database/migrations/Имя
# применить (на деплое / отдельным k8s Job — не на каждом поде)
DATABASE_URL=... npm run migration:run
# откатить последнюю
DATABASE_URL=... npm run migration:revert
```

Начальная миграция (`InitialSchema`) уже в `src/database/migrations/`. Авто-прогон
на старте — `DB_MIGRATIONS_RUN=true` (в multi-pod лучше через init-container/Job).

---

## Структура

```
src/
  mastercard.module.ts   зонтичный модуль (forRoot/forRootAsync) — ЕДИНСТВЕННЫЙ,
                         что импортирует хост; внутри — все под-модули (приватные)
  config/         GatewayConfig (типизированные опции модуля) + валидация ENV (харнесс)
  tenants/        реестр партнёров (Postgres), статусы/одобрения
  credentials/    резолвер ключей (PLATFORM | OWN), кэш
  secrets/        SecretStore: Local (dev) | Vault (prod)
  auth/           OAuth2, гарды, admin-аутентификация, DTO
  admin/          ввод партнёров, одобрения, выпуск OAuth-клиентов, DTO
  mastercard/     низкоуровневый клиент-модуль (axios encrypt/sign/decrypt + EncryptionService)
  crossborder/    бизнес-эндпоинты по областям (accounts/quotes/payments/validations/
                  cash-pickup/rfi) над общим gateway; идемпотентность платежей (Postgres)
  audit/          журнал операций (Postgres, батч-запись)
  webhooks/       push-уведомления + fail-closed auth (токен) + DTO
  database/       TypeORM (dev-харнесс; в монолите соединение даёт хост)
  health/         health/readiness-пробы (@nestjs/terminus) — контроллер в
                  dev-харнессе (AppModule), не в эмбеддабл-модуле
  common/         p12/crypto utils, throttler-гарды, validation-пайпы
  harness/        dev-харнесс — app.module.ts + main.ts + dev-seed.service.ts
                  (автономный запуск, e2e, Swagger); не часть эмбеддабл-поверхности
docs/             документация (см. таблицу выше)
certs/            криптоматериал Mastercard (НЕ в репозитории)
```

### Встраивание в хост-приложение (монолит b24club-api)

```ts
imports: [
  MastercardModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (c) => ({ baseUrl: c.get('MC_BASE_URL'), /* ...опции... */ }),
  }),
]
```

Хост даёт TypeORM-соединение (с нашими entity) и ведёт их миграции, владеет
своими глобальными pipes/logger/throttler. Модуль берёт конфиг из объекта опций,
не из `process.env`.

**Чек-лист интеграции в хост** — контракт явный, не контролируется в рантайме:
обязательный *конфиг* проверяет `GatewayConfig` (fail-fast — бросает на старте при
отсутствии обязательной опции или слабом прод-секрете), а перечисленную ниже
*инфраструктуру* модуль сознательно НЕ поднимает сам. Модуль не интроспектирует хост,
чтобы предупредить об этом; если пункт пропущен — соответствующая фича падает, как указано.

1. **TypeORM DataSource с нашими entity** — `TypeOrmModule.forRoot({ entities:
   [...MASTERCARD_ENTITIES] })` (или `autoLoadEntities: true`). Пропущено → репозитории
   бросают `EntityMetadataNotFoundError` на первом запросе (громко, не молча).
2. **`app.enableShutdownHooks()`** — нужно, чтобы буфер аудита сбрасывался на
   `SIGTERM` (`beforeApplicationShutdown`).
3. **Лимит тела для загрузки RFI** — `POST /crossborder/rfi/documents` несёт base64-файл
   до ~1.37MB, выше типичного строгого JSON-лимита. В dev-харнессе это Nest middleware
   (`AppModule.configure`: 2MB JSON-парсер для этого маршрута, зарегистрирован до строгого
   глобального). При встраивании **body-парсингом владеет хост** — он должен разрешить
   ≥~1.4MB для этого маршрута (route-scoped JSON-парсер для
   `POST /crossborder/rfi/documents` или достаточно высокий глобальный лимит). Пропущено →
   загрузки RFI у предела MC ~1MB → `413`.
4. **Задан `webhookToken`** — обязателен для входящих вебхуков Mastercard; пусто ⇒
   fail-closed (каждый запрос `/webhooks/mastercard` → `401`).
5. **Не передавайте `isGlobal: false`** в `forRoot/forRootAsync`. Зонтичный модуль
   глобальный по умолчанию, чтобы его экспортируемый `GatewayConfig` инъектился в каждый
   под-модуль без повторного импорта зонтичного; `false` сломал бы DI между под-модулями.

> **Соглашение (код модуля):** глобального `ValidationPipe` нет — каждый контроллер
> объявляет нужный пресет единой стратегии валидации
> (`gatewayValidationPipe(ValidationStrategy.Strict)` для наших границ, `…Passthrough`
> для тел, идущих в Mastercard). Любой новый контроллер ОБЯЗАН объявить пайп явно; без
> него его вход не валидируется (per-route-привязка fail-open, в отличие от глобального).

---

## Статус

Транзакционное ядро готово и проверено на живом sandbox (см.
[tests.md](docs/ru/tests.md)). Перед production — см.
[production-questions.md](docs/ru/production-questions.md) (главный блокер:
per-tenant encryption для OWN-партнёров; приватный Client Encryption key;
реализация `VaultSecretStore`).
