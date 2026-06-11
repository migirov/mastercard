# План работ — Mastercard Cross-Border Gateway

Мульти-мерчант сервис-шлюз к Mastercard Cross-Border Services.
Архитектура — в [architecture.md](./architecture.md), сущности — в
[documentation.md](./documentation.md), блокеры — в
[production-questions.md](./production-questions.md). Этот файл — план и статус.

Легенда: ✅ готово · 🔄 в работе · ⬜ не начато · 🟡 ждёт внешнего

---

## Принятые решения

- **Модель мерчантов (подтверждено клиентом):** ОСНОВНОЙ сценарий — **отдельный
  `partner-id` на каждого** партнёра (режим `OWN`). Каждый партнёр уже
  зарегистрирован в Mastercard, имеет свои ключи и обслуживает своих бизнес-
  клиентов через нашу платформу. Разделение — нативно по `partner-id` в пути URL;
  **поля `merchant`/sub-account в Cross-Border API НЕТ**. `PLATFORM` (общий
  partner-id) — вторичный концепт, оставляем.
- **Credentials — два режима:** `OWN` (основной) и `PLATFORM`.
- **Потребление — оба:** внешний REST API (OAuth2) и внутренний (service-token).
- **Секреты — Secret Manager (Vault/KMS).** Реализация вендор-агностична.
- **Доступ — gating:** транзакции только одобренным (Mastercard + платформа).
- **Шифрование — ОБЯЗАТЕЛЬНО** в MTF/Prod (весь payload quote/payment — JWE).
- **Хранилище — PostgreSQL** (резистентно, согласовано между подами). **Redis и
  in-memory как хранилища — убраны.** Деплой — Docker/Kubernetes, **много подов**.
- **Idempotency-Key — ОСТАВЛЯЕМ** (клиент подтвердил; бэкстоп — MC `transaction_reference`).
- **Версии зависимостей — выровнены под клиентский `b24club-api`** (Nest 10, jwt
  10.1.1, throttler ^5, swagger 7.3.0, typeorm 0.3.20, reflect-metadata 0.1.x).
- **Стек:** NestJS (Node 22), TypeORM + PostgreSQL, `mastercard-oauth1-signer`,
  `mastercard-client-encryption`, `node-forge`.

---

## Фаза 1 — Tenant + per-tenant подпись (ядро) ✅

- ✅ `Tenant`-модель и реестр (`src/tenants/`), статусы жизненного цикла.
  *(Изначально in-memory; позже мигрирован на PostgreSQL — см. ниже.)*
- ✅ `CredentialsService.resolve(tenant)` — режим `PLATFORM`.
- ✅ Stateless `MastercardClient.request(creds, …)` — подпись ключом тенанта на
  каждый запрос (один инстанс на любое число мерчантов).
- ✅ Cross-border слой (`balances` / `rates` / `quotes`) + gating по `ACTIVE`.

**Аудит Фазы 1 (8 фиксов):** нормализация baseUrl (рассинхрон подписи при
хвостовом `/`); разворачивание ответа MC с маппингом ошибок (не отдаём 401/403/
5xx/HTML наружу); сетевые ошибки → 502; keep-alive; `encodeURIComponent` для
partnerId; санитизация `secretRef`; passthrough строкового тела.

## Фаза 2 — Vault/KMS + режим OWN ✅

- ✅ Абстракция `SecretStore` (`src/secrets/`): `getMerchantSecrets(secretRef)`.
- ✅ `LocalSecretStore` (dev: `secrets.local.json` + sandbox-сид из `.env`).
- ✅ `VaultSecretStore` — заглушка под вендора, выбор по `MC_SECRET_STORE`.
- ✅ Режим `OWN`: бандл → `McCredentials`, per-tenant кэш с TTL + `invalidate()`.
- ✅ Ключи: `p12Path` (dev) и `p12Base64` (как из Vault).

**Аудит Фазы 2 (5 фиксов):** дедуп cache-stampede (кэш Promise); evict-on-reject;
проверка partnerId; `safePartnerId` против path-injection; валидация бандла.

**Аудит общий (5 фиксов):** демо-сид/тестовые тенанты off в `production`; helmet +
лимит тела 256kb + graceful shutdown; ограниченный пул keep-alive сокетов.

## Фаза 3 — Auth + approval-воркфлоу ✅

- ✅ Внешняя авторизация — **OAuth2 client credentials**: `POST /oauth/token`
  (client_id/secret → JWT, TTL 15 мин), реестр клиентов (хэш секрета, timing-safe).
- ✅ `TenantAuthGuard` — Bearer JWT (внешний) **или** `X-Internal-Token` +
  `X-Tenant-Id` (внутренний). Единый `TenantContext` (`@CurrentTenant`).
- ✅ Approval-модель: 2 флага (`platformApproved`/`mcApproved`) + `suspended`;
  **ACTIVE вычисляется**. Gating в cross-border на `isActive`.
- ✅ Admin-API (`X-Admin-Token`): создать партнёра, одобрения, suspend/unsuspend,
  выпуск/отзыв OAuth-клиентов.
- ✅ Аудит (5 фиксов): HS256 пиннинг sign+verify, проверка issuer, отказ старта в
  production со слабыми секретами, хэш-сравнение токенов, timing-safe client_id.
- ✅ **Rate-limit** (`@nestjs/throttler`): crossborder 120/мин по tenantId,
  `/oauth/token` 10/мин по client_id, admin 120/мин. *(Доработано позже — см. ниже.)*
- ✅ Каркас **вебхука** MC (`POST /webhooks/mastercard`): дедуп по `eventRef`,
  всегда 200. **Аутентификация = mTLS на ингрессе** (не HMAC); app-уровень —
  dev `X-Webhook-Token`.

## Фаза 4 — JWE field-level encryption ✅ (sandbox plain; готово к MTF/Prod)

- ✅ **PoC**: JWE через `mastercard-client-encryption` корректно по доке
  (`{encrypted_payload:{data}}`, `alg:RSA-OAEP-256/enc:A256GCM/cty/kid`); подпись
  по зашифрованному телу принята sandbox'ом.
- ✅ Фикс: `loadPrivateKeyFromP12` → нестрогий режим forge (как офиц. либа MC).
- ✅ Разобрана модель ключей: **Client Encryption Key** (наш, расшифровка ОТВЕТОВ)
  и **Mastercard Encryption Key** `fintory1` (шифрование ЗАПРОСОВ). Cert извлечён
  → `certs/mastercard-encryption-cert.pem`; `kid` = public-key fingerprint
  `cec428ec…478cf1`.
- ✅ **Ключевой вывод:** sandbox **НЕ поддерживает FLE** — plain quote → **200 с
  реальным proposal**, encrypted → `Crypto Key/082000`. Шифрование — только MTF/Prod.
- ✅ `EncryptionService` (`src/encryption/`) с **тумблером** `MC_ENCRYPTION_ENABLED`.
  *(Изначально вызывался из `CrossBorderService`; позже вынесен в axios-интерцептор
  — см. ниже.)*
- ✅ Проверено end-to-end: `POST /crossborder/quotes` (sandbox/plain) → **HTTP 201**.
- 🟡 Для MTF/Prod: включить тумблер + приватный Client-ключ в `MC_DECRYPTION_KEY_PATH`
  (его пока нет — вопрос к порталу).
- ✅ Аудит Фазы 4 (3 фикса): расшифровка в try/catch (→502); порядок заголовков;
  расшифровка forwardable-ошибок. Ограничение: `EncryptionService` платформенного
  уровня (per-tenant — открытый блокер, см. ниже).

## Фаза 5 — Надёжность ✅ (ядро)

- ✅ **KV-store** (`src/store/`) — `PostgresKvStore` (согласован между подами).
  *(Изначально in-memory/Redis; переведён на Postgres — см. ниже.)*
- ✅ **Идемпотентность платежей** (`IdempotencyService`): `Idempotency-Key` на
  `POST /crossborder/payments` → тот же результат без повторного вызова MC; замок
  против гонок (атомарный `setIfAbsent`), ошибки не кэшируются, изоляция по тенанту.
- ✅ **Audit trail** (`AuditInterceptor` глобальный + `AuditService` → Postgres):
  кто/source/method/path/status/ms на каждый запрос (без тел/секретов); `GET /admin/audit`.
- ✅ **Дедуп вебхуков** через `KvStore` (Postgres).
- ✅ Аудит Фазы 5 (5 фиксов): короткий TTL замка идемпотентности (120с) + длинный
  TTL результата (24ч); Swagger off в production (`SWAGGER_ENABLED`); graceful
  shutdown. *(Redis-специфичные фиксы устарели после миграции на Postgres.)*
- ⬜ Observability (метрики/трейсинг) — опционально.

## Swagger ✅

- ✅ `@nestjs/swagger` на `/api-docs` (схемы auth: merchant / internal / admin).
  Выключен в production без `SWAGGER_ENABLED`.

## Фаза 6 — Полнота 🔄 (транзакционное ядро готово)

- ✅ Операции **payment / retrieve(by-id, by-ref) / cancel / quote-confirmation**.
  Эндпоинты под `/crossborder/`. Проверено: доходят до MC.
- ✅ Аудит Ф6 (фикс): `assertSafeId` — paymentId не меняет структуру URL.
- ✅ DTO-валидация: глобальный `ValidationPipe` + `CreateTenantDto`; MC-passthrough
  (`@Body() unknown`) Pipe не трогает (quote→201).
- ⬜ RFI-подсистема (requests/documents) — по необходимости.
- ⬜ API-документация для мерчантов (расширить Swagger-аннотации).

---

## Доработки после фаз 1–6

### Миграция на PostgreSQL ✅

- ✅ Redis и in-memory как **хранилища убраны**; персистентность — PostgreSQL +
  TypeORM (`src/database/`): сущности `tenants`, `oauth_clients`, `audit_log`,
  `kv_store`. `TenantRegistry`/`ClientRegistry`/`AuditService` → репозитории;
  `KvStore` → `PostgresKvStore` (атомарный `setIfAbsent`).
- ✅ Засев тенантов — атомарный `INSERT … ON CONFLICT DO NOTHING` (без гонок при
  одновременном старте многих подов).
- ✅ Rate-limit — нативный `@nestjs/throttler` **in-memory per-pod** (авторитет —
  ингресс); кэш credentials — in-memory per-pod (кэш из Vault).
- ✅ `DATABASE_URL` + `DB_SYNC`; `docker-compose.yml` (Postgres 16).
- 📝 Typecheck OK; **e2e на живом Postgres — не прогнан** (нужен `docker compose up`).

### Выравнивание версий под клиента ✅

- ✅ Все зависимости выровнены под `b24club-api` (легаси-версии); конфликтов нет
  (typecheck + peer-check; один benign warning class-validator/mapped-types).

### Шифрование → axios-интерцептор ✅

- ✅ Шифрование (encrypt+sign) и расшифровка вынесены в **axios-интерцепторы**
  `MastercardClient`; `CrossBorderService` стал «чистым» (про крипту не знает).
  `EncryptionService` вызывается из интерцептора. Задокументировано (+ заметка
  про возможный вынос в отдельный сервис и его минусы).

### Hardening rate-limit за прокси ✅

- ✅ `/oauth/token` — лимит по **client_id** (`OAuthThrottlerGuard`): не обходится
  ротацией IP за LB.
- ✅ `TenantThrottlerGuard` — строго по `tenantId`, **fail-closed** (нет контекста
  → ошибка, не общий `ip/'unknown'`-бакет).
- ✅ `TRUST_PROXY` — ориентир в `.env` (число хопов ингресса, не `'true'`).

### Аудит на баги — 4 цикла ✅

Все правки прошли typecheck:
1. Гонка засева тенантов при старте многих подов → `ON CONFLICT DO NOTHING`.
2. Дефолтный `MC_WEBHOOK_TOKEN` проходил прод-гейт → добавлен в `assertProdSecrets`.
3. Длинный `Idempotency-Key` переполнял `kv_store.key` (varchar 256) → валидация.
4. В проде молча использовался dev-`LocalSecretStore` → прод-гейт требует `vault`.

### Локализация ошибок ✅

- ✅ Все сообщения исключений и `throw new Error` переведены на **английский**
  (клиент-facing + crash-логи). Комментарии и операционные `Logger.*` — русские.

### Платформенные модули Nest (взяли готовое вместо самописа) ✅

Все проверены вживую (boot + функционально):
- ✅ **`@nestjs/terminus`** — `/health` (liveness), `/ready` (readiness + пинг БД)
  для k8s. Пробы исключены из audit и pino-autoLogging.
- ✅ **Валидация ENV** — `ConfigModule.forRoot({ validate })` (class-validator),
  fail-fast на старте вместо разбросанных ленивых проверок.
- ✅ **TypeORM-миграции** — `data-source.ts`, скрипты `migration:generate/run/revert`,
  начальная `InitialSchema` (сгенерирована и прогнана). `synchronize` off в prod.
- ✅ **`@nestjs/schedule`** — `KvCleanupService` (`@Cron` ежечасно) чистит
  протухший `kv_store`.
- ✅ **`nestjs-pino`** — структурный JSON-лог + correlation-id (`x-request-id`),
  redact секретных заголовков; pino — логгер всего приложения.

---

## Открытые вопросы / блокеры

1. 🔴 **Per-tenant encryption** не подключён — интерцептор шифрует платформенным
   ключом; per-tenant `encryptionCertPem/...` резолвятся, но не используются.
   Блокер для OWN+MTF/Prod (у партнёров разные MC-ключи). См.
   [production-questions.md](./production-questions.md).
2. 🟠 **TypeORM:** наш сервис — отдельный (свой `forRoot` + `DATABASE_URL`) или
   часть монолита `b24club-api` (`forFeature` + их миграции вместо `synchronize`)?
3. 🟡 **Приватный Client Encryption key** для расшифровки ответов в MTF/Prod
   (`MC_DECRYPTION_KEY_PATH`) — сейчас только публичный cert.
4. 🟡 **Секрет-менеджер** — Vault / AWS / GCP? Реализуется только `VaultSecretStore`.
5. ⬜ **e2e на Postgres** (нужен `docker compose up` в WSL).
6. ⬜ Очистка протухших `kv_store` (cron `@nestjs/schedule`), observability, RFI.

---

## Как запускать (Windows + проект на WSL UNC-пути)

`npm`/`node` — из Windows; прямой `npm run` из Git Bash падает на UNC-пути.
Обход через `pushd` (монтирует UNC на временный диск):

```powershell
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && <команда> & popd"
```

**Нужен PostgreSQL.** В WSL:

```bash
cd ~/valeri/mastercard
docker compose up -d        # Postgres 16 (docker-compose.yml)
npx ts-node src/main.ts     # авто-схема (synchronize) + сиды тенантов; порт 3000
```

- `npm run ping [-- <tenantId>]` — smoke-test через тенанта (platform/own-sandbox/own-demo).
- Тенант берётся из **аутентификации** (Bearer JWT / `X-Internal-Token`+`X-Tenant-Id`),
  не из заголовка `x-tenant-id`.
- Эндпоинты: `POST /oauth/token`, `GET/POST /crossborder/*`, `…/admin/*`,
  `POST /webhooks/mastercard`, Swagger `GET /api-docs`.
