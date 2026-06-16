# Session Memory — Mastercard Cross-Border Gateway

Хендофф-документ для восстановления контекста (если диалог был сжат/compact).
Дополняет [README.md](../../README.md) (точка входа), [plan.md](./plan.md) (статус
по фазам), [architecture.md](./architecture.md) (дизайн), [documentation.md](./documentation.md)
(сущности), [api.md](./api.md) (эндпоинты), [tests.md](./tests.md) (отчёт о
тестах), [production-questions.md](./production-questions.md) (блокеры перед прод).

---

## Что это за проект

Отдельный **мульти-мерчант сервис-шлюз** к **Mastercard Cross-Border Services**
(NestJS, Node 22, PostgreSQL). Платформа подключает партнёров, каждый ходит в
Mastercard через нас. Доступ — только одобренным (Mastercard + платформа).
Деплой — **Docker/Kubernetes, много подов**.

**Требование заказчика (подтверждено):** основной сценарий — **отдельный
`partner-id` на каждого партнёра** (режим `OWN`): партнёр уже зарегистрирован в
MC, со своими ключами, обслуживает своих бизнес-клиентов через платформу.
`PLATFORM` (общий partner-id) — вторичный. **Поля `merchant`/sub-account в
Cross-Border API НЕТ** (проверено по доке) — разделение нативно по `partner-id`.

---

## Статус (всё готово, typecheck OK)

| Слой | Статус |
|---|---|
| Tenant + per-tenant OAuth1-подпись | ✅ |
| SecretStore (Local/Vault) + режим OWN | ✅ |
| Auth: OAuth2 client-creds, 2 гарда, admin-API, approval | ✅ |
| JWE-шифрование (тумблер по среде, в axios-интерцепторе) | ✅ |
| Операции: quote/payment/retrieve/cancel/confirmation + DTO-валидация | ✅ |
| Надёжность: идемпотентность, audit, rate-limit | ✅ |
| Swagger `/api-docs` | ✅ |
| **Хранение → PostgreSQL (TypeORM)** | ✅ **e2e прогнан на живом Postgres** |
| Версии выровнены под клиентский `b24club-api` | ✅ |
| **Запушено в git** (github.com/migirov/mastercard, public) | ✅ |

Каждый слой прошёл **аудит** — суммарно ~40 фиксов (фазовые + 4-цикловый +
10-цикловый, см. ниже). Главное достижение: полный стек проверен **вживую на
sandbox** — balances/rates/quote (201 с реальным proposal), оба пути auth, gating,
идемпотентность, webhook-дедуп, персистентность после рестарта (см. [tests.md](./tests.md)).

---

## Архитектура (модули `src/`)

```
database/                  — ТОЛЬКО инфра: DatabaseModule (dev forRoot), data-source, migrations
                             (entity вынесены в свои модули — co-location, см. ниже)
store/                     — KvStore → PostgresKvStore (idempotency + webhook dedup, TTL)
tenants/                   — TenantRegistry поверх Postgres-репозитория (async) + сиды
credentials/               — CredentialsService.resolve(tenant): PLATFORM|OWN, in-mem КЭШ
secrets/                   — SecretStore: LocalSecretStore | VaultSecretStore (заглушка)
auth/                      — OAuth2 (token endpoint, ClientRegistry→Postgres), гарды, @CurrentTenant
admin/                     — ввод партнёров, одобрения, выпуск ключей, GET /admin/audit
encryption/                — EncryptionService (JWE, тумблер MC_ENCRYPTION_ENABLED)
idempotency/               — IdempotencyService (по Idempotency-Key, через KvStore→Postgres)
audit/                     — AuditInterceptor (per-controller) + AuditService→Postgres
webhooks/                  — POST /webhooks/mastercard (dedup по eventRef через KvStore)
mastercard/                — MastercardClient: axios-интерцепторы (encrypt+sign / decrypt)
crossborder/               — бизнес-операции + контроллер (ЧИСТЫЕ, без крипты)
common/                    — p12.util, crypto.util, tenant-throttler.guard
```

**Шифрование** вынесено в **axios-интерцептор** `MastercardClient` (request:
encrypt→sign по зашифрованному телу; response: decrypt). `CrossBorderService`
про крипту не знает. Детали и «можно ли вынести в отдельный сервис + минусы» — в
`documentation.md`.

---

## Хранение данных (многоподовый деплой!)

Правило: in-memory — только то, что не требует согласованности между подами **и**
эфемерно. Подробная таблица — в `documentation.md`. Кратко:

| Данные | Где |
|---|---|
| tenants, oauth_clients, audit_log | **Postgres** (TypeORM) |
| idempotency, webhook-дедуп | **Postgres** (KvStore→PG, TTL, атомарный `INSERT … ON CONFLICT … WHERE expired`) |
| rate-limit | самодостаточный per-pod `@nestjs/throttler` v5 (корректность не зависит от ингресса; лимит на ингрессе, если есть — опциональная доп. защита, не authoritative) |
| кэш креды | **in-memory per-pod** (кэш из Vault, не источник истины) |
| секреты партнёров | SecretStore (Vault) |

**Redis НЕ используется** (убран по требованию). У клиента Redis в стеке есть —
если когда-нибудь нужен точный глобальный rate-limit, можно переиспользовать.

---

## Эндпоинты

- **OAuth2:** `POST /oauth/token` (client_credentials → JWT 15мин; form-urlencoded и JSON).
- **Cross-Border** (auth: Bearer JWT внешний / `X-Internal-Token`+`X-Tenant-Id` внутренний):
  `GET balances`, `GET rates`, `POST quotes`, `POST quotes/confirmations`,
  `POST payments` (+ `Idempotency-Key`), `GET payments/:id`, `GET payments?ref=`,
  `POST payments/:id/cancel`.
- **Admin** (`X-Admin-Token`): `GET/POST /admin/tenants`, `…/approve/platform`,
  `…/approve/mastercard`, `…/suspend|unsuspend`, `…/clients` (выпуск), `GET /admin/audit`.
- **Webhook:** `POST /webhooks/mastercard` (in-service fail-closed `X-Webhook-Token`, обязателен в prod и dev; авторитетная аутентичность push-уведомлений у MC = **mTLS**, не подпись payload — см. `api.md` → Webhooks).
- **Swagger:** `GET /api-docs` (выключен в production, если нет `SWAGGER_ENABLED`).

---

## ⚠️ КРИТИЧНО: разбор ключей шифрования (было много путаницы)

В `certs/` — два концепта ключей Mastercard:

| Файл | Что это | Роль |
|---|---|---|
| `Fintory-sandbox-signing.p12` | наш signing private key | OAuth1-подпись (пароль `MC_SIGNING_KEY_PASSWORD`, открывается) |
| `...fintory1-mastercard-encryption-key.p12` | **Mastercard Encryption Key** (`CN=MasterCardKey`) | **шифровать ЗАПРОСЫ**; открывается ПУСТЫМ паролем + `-nomacver` |
| `...clientenc...-client-encryption-key.pem` | **Client Encryption Key** (наш, публичный cert) | для расшифровки ОТВЕТОВ; приватного ключа НЕТ |
| `mastercard-encryption-cert.pem` | извлечён из `fintory1`-p12 | то, чем шифруем (`MC_ENCRYPTION_CERT_PATH`) |

**Правильный `kid` запросов = public-key fingerprint Mastercard-ключа:**
`cec428ec9f5cdf80532cf3db313875439b755e0e9751ed0af512b59741478cf1` (совпал с
`fintory1` на портале; это fingerprint **публичного ключа**, не сертификата
`53b8…`). В `.env` (`MC_ENCRYPTION_FINGERPRINT`).

**Sandbox НЕ поддерживает FLE:** plain quote → 200 с реальным proposal, encrypted
→ `Crypto Key/082000`. Шифрование тестируется только в **MTF/Production** (через
команду CIS). Поэтому `MC_ENCRYPTION_ENABLED="false"` для sandbox.

> ⚠️ **ИСПРАВЛЕНО 2026-06-16 — оба абзаца выше УСТАРЕЛИ.** Sandbox **поддерживает** FLE;
> `082000` был из-за зеркальной модели ключей (шифровали Mastercard Encryption вместо
> Client Encryption). Правильно: запрос — Client Encryption Key (публичный cert), ответ —
> наш Mastercard Encryption private key. Приватный ключ для расшифровки мы сгенерили сами
> (`fintory-decrypt`, `75ea7e15…`, активирован на портале). `MC_ENCRYPTION_ENABLED="true"`
> теперь и на sandbox. Подробности — веха FLE в начале этого файла и `mastercard-fle-working`.

---

## Запуск (Windows + проект на WSL UNC-пути)

`node`/`npm` — Windows. Прямой `npm run` из Git Bash падает на UNC-пути. Обход —
через `pushd` из **PowerShell**:

```powershell
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && <команда> & popd"
```

**Нужен Postgres.** В WSL:
```bash
cd ~/valeri/mastercard
docker compose up -d        # Postgres 16 (docker-compose.yml)
npx ts-node src/main.ts     # авто-схема (synchronize) + сиды тестовых тенантов
```
Сиды (только non-prod): `platform`, `acme` (ACTIVE), `own-sandbox` (OWN/ACTIVE,
ключи из LocalSecretStore), `own-demo` (PENDING — демо gating).

Dev-скрипты: `npm run ping`, `npm run encrypt-poc` (+`plain`), `src/scripts/p12-diag.ts`.
(`idem-test.ts` удалён — идемпотентность теперь в Postgres.)

---

## Env (`.env`, gitignored; `certs/` gitignored)

`MC_SIGNING_KEY_PATH/PASSWORD`, `MC_CONSUMER_KEY`, `MC_PARTNER_ID`
(sandbox=`SANDBOX_1234567`), `MC_BASE_URL`, `MC_ENCRYPTION_CERT_PATH`
(=извлечённый MC cert), `MC_ENCRYPTION_FINGERPRINT` (=cec4…),
`MC_ENCRYPTION_ENABLED` (false), `MC_DECRYPTION_KEY_PATH` (пусто, для прода),
`MC_SECRET_STORE` (local),
`MC_JWT_SECRET`/`MC_INTERNAL_TOKEN`/`MC_ADMIN_TOKEN`/`MC_WEBHOOK_TOKEN` (dev; в
проде prod-гейт в main.ts требует сильные), `TRUST_PROXY` (пусто),
**`DATABASE_URL`** (postgres://mc:mc@localhost:5432/mc_gateway),
**`DB_SYNC`** (true в dev; в production `synchronize` ВСЕГДА off),
**`DB_POOL_MAX`** (пул пер-под, дефолт 10). `REDIS_URL` — удалён. Шаблон без
значений — `.env.example` (в репо).

---

## Версии (выровнены под клиентский b24club-api)

Nest 10, `@nestjs/jwt` 10.1.1, `@nestjs/throttler` ^5, `@nestjs/swagger` 7.3.0,
`@nestjs/config` 3.1.1, `reflect-metadata` 0.1.x, `axios` 1.6.0, `typeorm`
0.3.20, `@nestjs/typeorm` ^10.0.2, `class-transformer` 0.5.1. Наши доп.пакеты
(нет у клиента): helmet, mastercard-client-encryption, mastercard-oauth1-signer,
node-forge. Конфликтов нет (typecheck + peer-check OK; один benign warning
class-validator/mapped-types — есть и у клиента).

---

## Доработки после ядра (hardening, аудит, тесты)

- **Шифрование → axios-интерцептор** `MastercardClient` (request: encrypt→sign;
  response: decrypt). `CrossBorderService` чистый.
- **Rate-limit за прокси:** `/oauth/token` — лимит по **client_id**
  (`OAuthThrottlerGuard`, не обходится ротацией IP); `TenantThrottlerGuard` —
  строго по `tenantId`, **fail-closed** (нет контекста → ошибка, не общий бакет);
  `TRUST_PROXY` — число хопов ингресса (не `'true'`).
- **Сообщения ошибок** (исключения + `throw new Error`) переведены на **английский**
  (клиент-facing + crash-логи). Комментарии и `Logger.*` — русские.
- **10-цикловый аудит** (баги/безопасность/опт, все typecheck + регрессии вживую):
  (1) `synchronize` **off в production** (NODE_ENV gate; иначе авто-alter = потеря
  данных); (2) `bootstrap().catch`→exit(1); (3) `safePartnerId` анти-traversal
  (`..`/`\`); (4) **батчинг** audit-вставок (буфер + flush/сек + на shutdown +
  перед `recent()`); (5) защита `JSON.parse` идемпотентности (битый кэш→409 не 500);
  (6) успешный платёж не теряется при сбое кэша результата; (7) ретрай **только GET**
  на 502/503/504+сеть (POST никогда; конфиг строится заново каждую попытку);
  (8) `DB_POOL_MAX` (дефолт 10) — пул пер-под (иначе подов×10 > Postgres
  max_connections); (9) webhook **at-least-once** (релиз дедуп-ключа при сбое);
  (10) fire-and-forget очистка протухших KV.
- **e2e на живом Postgres прогнан** (Docker внутри WSL): admin/tenants, оба пути
  auth, gating 403/404, реальные balances/rates/quote, идемпотентность,
  rate-limit→429, webhook-дедуп, **персистентность после рестарта пода**. Отчёт —
  `tests.md`. Не покрыто: JWE (sandbox без FLE), успешный платёж+кэш (нужен KYC-флоу).
- **Платформенные модули Nest** (взяли готовое, все проверены вживую): health-пробы
  `@nestjs/terminus` (`/health`, `/ready`); валидация ENV `ConfigModule.validate`
  (class-validator, fail-fast); TypeORM-миграции (`src/database/data-source.ts`,
  `migration:*`, `InitialSchema` сгенерирована+прогнана, synchronize off в prod);
  `@nestjs/schedule` `KvCleanupService` (cron чистит kv_store); `nestjs-pino`
  структурные JSON-логи + correlation-id `x-request-id` + redact секретов. Новые
  env: `LOG_LEVEL`, `DB_MIGRATIONS_RUN`. Запуск сервера для чистого захвата
  pino-stdout: `node -r ts-node/register src/main.ts` (cmd-детач stdout pino не ловит).

---

## ОТКРЫТЫЕ ВОПРОСЫ / задачи (важно)

1. **TypeORM: отдельный сервис или часть монолита?** → **ОТВЕТ: один модуль в их монолите** (см. «Следующие шаги» п.2).
   - Отдельный → текущая схема верна (свой `DatabaseModule.forRoot` + `DATABASE_URL`).
   - Часть монолита → убрать наш `forRoot`, entity через `forFeature` в их DataSource,
     схема — их миграциями (не `synchronize`). ← это и делаем.
2. ~~Удаление `Idempotency-Key`~~ — **РЕШЕНО ОСТАВИТЬ** (клиент подтвердил
   2026-06-10). `IdempotencyService` остаётся на `POST /crossborder/payments`.
3. 🔴 **БЛОКЕР per-tenant encryption:** интерцептор шифрует **платформенным**
   ключом, а у OWN-партнёров разные MC encryption-ключи → в MTF/Prod запрос
   зашифруется чужим ключом, MC отвергнет. `CredentialsService` уже резолвит
   per-tenant `encryptionCertPem/...`, но их никто не использует. Фикс — протянуть
   ключи в `EncryptionService`. См. `production-questions.md`.
4. **Прод-ключи:** приватный Client Encryption key (расшифровка), `MC_ENCRYPTION_ENABLED=true`
   в MTF/Prod, прод-секреты вместо dev-дефолтов, partner-id/ключи OWN-партнёров в Vault.
5. Опционально: RFI-подсистема, observability, очистка протухших `kv_store`
   (cron; `@nestjs/schedule` добавит зависимость).

---

## ЗАМЕЧАНИЯ ТИМЛИДА — СДЕЛАНО (2026-06-11, коммиты e319802 + fe9cd86)

1. ✅ **Один модуль Mastercard.** Зонтичный `src/mastercard.module.ts`
   (`MastercardModule`, через `ConfigurableModuleBuilder` → `forRoot/forRootAsync`)
   — единственный модуль, который импортирует хост. Под-модули стали приватными.
   Конфиг приходит опциями (`MastercardModuleOptions`) и раздаётся через глобальный
   `GatewayConfig` (`src/config/gateway-config.ts`) — сервисы больше НЕ читают
   `process.env`/`ConfigService`. Внутренний клиент переименован в
   `MastercardClientModule`. БД — host DataSource (`forFeature`); `AppModule`+`main.ts`
   остались dev-харнессом. Per-pod throttler перенесён ВНУТРЬ модуля.
2. ✅ **DTO на всех эндпоинтах.** Строгие на наших границах (`TokenRequestDto`,
   `CreateTenantDto` c `@ValidateIf` для OWN→secretRef, `McWebhookEventDto`); мягкие
   на MC-passthrough (`QuoteRequestDto`/`PaymentRequestDto`/`ConfirmationRequestDto`,
   валидируют только формат критичных полей). Глобальный `ValidationPipe` УБРАН
   (модуль не навязывает его хосту + он давал двойную валидацию и резал поля MC).
   Каждый контроллер несёт свой pipe: `strictDtoPipe` (admin/oauth) vs
   `mcPassthroughPipe` (crossborder/webhook, `transform:false` — суммы-строки целы).
   Ручная валидация (`admin.service`, `typeof body`) удалена.
3. ✅ **Безопасность вебхука — в сервисе, не на инфре.** `WebhookAuthGuard`
   fail-closed: токен обязателен ВЕЗДЕ, нет `return true` «в расчёте на mTLS». +
   каркас `WebhookSignatureVerifier` (Noop до спецификации MC, вопрос C1). `main.ts`
   prod-гейт требует `MC_WEBHOOK_TOKEN`. Throttler-комментарий «авторитет — ингресс»
   убран (per-pod лимит самодостаточен).
4. ✅ **Схлопнуты тонкие модули.** EncryptionModule→провайдер MastercardClientModule;
   IdempotencyModule→провайдер CrossBorderModule; HealthModule→контроллер (позже вынесен
   в dev-харнесс `AppModule` — см. «Последние вехи»).
   Настоящие feature-модули (Tenant/Auth/Admin/CrossBorder/Webhooks/Credentials/
   Secrets/Store/Audit) оставлены.
5. ✅ **Сущности co-located** (коммит `09c4ece`). Убрана общая папка
   `database/entities/`; каждая entity лежит в своём модуле: `TenantEntity`→`tenants/`,
   `OAuthClientEntity`→`auth/`, `AuditLogEntity`→`audit/`, `KvEntity`→`store/`. В
   `database/` осталась только инфра (DatabaseModule, data-source, migrations). Схема
   и имена таблиц не изменились; typecheck + e2e 10/10.
6. ✅ **Фикс shutdown-гонки аудита** (коммит `bb9a6ea`): флаш буфера перенесён в
   `beforeApplicationShutdown` (фаза раньше, чем TypeORM закрывает коннект) — больше
   нет «Connection terminated» на остановке.

**Проверено:** typecheck OK; `src/scripts/boot-check.ts` (DI-граф) OK;
`src/scripts/e2e-check.ts` — **8/8 на живом sandbox** (quote 201 с proposal и
суммами-строками; amount=number→400 от DTO; OWN без secretRef→400; bad grant_type→400;
webhook без токена→401, с токеном→200).

### Осталось (НЕ входило в 5 пунктов тимлида)
- **Оставшиеся API MC** (сверено с `api-mastercard.md`): Cancel Confirmed Quote
  (`POST crossborder/quotes/cancellations`), Retrieve Confirmed Quote
  (`GET crossborder/quotes/{ref}/proposals/{id}`), Account Validation
  (`POST crossborder/accounts/validations`), Bank Lookup (`crossborder/banks/details`),
  Account generation (`crossborder/accounts/generate`). Отдельные опт-ин сьюты → сперва
  вопрос E1 клиенту.
- **Подпись вебхука** — реализовать `WebhookSignatureVerifier` по спецификации MC (C1).
- **Встраивание в `b24club-api`:** хост должен включить наши entity в свой DataSource
  и вести их миграции; предоставить `ScheduleModule.forRoot()` для cron-очистки kv.
- Открыт блокер **per-tenant encryption** перед прод-OWN.

---

## На чём остановились (последнее действие сессии)

Реализованы **все 5 замечаний тимлида** (см. выше) — 2 коммита (`e319802`,
`fe9cd86`), запушены в `github.com/migirov/mastercard`. Проверено вживую
(boot-check + e2e 8/8 на sandbox). Документация (`memory.md`, `architecture.md`,
`api.md`, README) обновлена под новую структуру (зонтичный `MastercardModule` +
`GatewayConfig` + per-controller pipes). Секрет-гейт чист перед каждым коммитом.

> Важно про среду: «Bash»-инструмент — Git Bash/MINGW на Windows (видит проект по
> UNC, НЕ видит `/home`); Docker и git запускать через `wsl -d Ubuntu ...`. Node —
> Windows, через `pushd`. Postgres-контейнер `mc-gateway-postgres`.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (2026-06-14)

После 5 замечаний тимлида проделано много: глубокие аудиты (баги/опт/безопасность,
регрессии), фундамент тестов (jest), единый error-filter, зачистка `any`. Затем —
доведение по конвенциям NestJS, сверенное с **официальной докой** (скачана локально
в `valeri/docs.nestjs.com`): ClassSerializerInterceptor+`@Exclude` на `secretRef`;
убраны `process.env`-течи из встраиваемого модуля; `Idempotency-Key`→pipe; lifecycle —
таймер аудита в `onModuleInit`; единый список entity (`mastercard.entities.ts`);
перенос `src/scripts`→`scripts/` и e2e→`test/app.e2e-spec.ts` (jest-e2e); **REC-1** —
`AuditInterceptor` переведён с глобального `APP_INTERCEPTOR` на per-controller
(последний глобальный `APP_*` устранён); **REC-2** — `HostIntegrityService`
(старт-самопроверка контракта встраивания) + host-checklist в README; named throttler.
Полный doc-grounded аудит (4 агента) — HIGH/MED-отклонений нет.

**Ингресс:** в КОДЕ зависимости от ингресса 0 (вебхук fail-closed токен в сервисе,
throttler самодостаточный per-pod). Доки переформулированы: auth/rate-limit = В СЕРВИСЕ,
mTLS/ingress — опциональный доп. слой, не authoritative; `TRUST_PROXY` — только для `req.ip`.

### Последние вехи (после doc-grounded аудита)
- 🔓 **FLE (шифрование) ЗАРАБОТАЛО на sandbox (2026-06-16) — снят многолетний «блокер шифрования».**
  Корень: модель ключей MC понимали ЗЕРКАЛЬНО. Правильно: **Client Encryption Key** (`f031d600`) —
  публичный, им **МЫ шифруем ЗАПРОСЫ** (приватный у MC); **Mastercard Encryption Key** — публичный, им
  **MC шифрует ОТВЕТЫ**, а НАШ приватный их расшифровывает. Раньше шифровали запрос ключом `cec428ec`
  (Mastercard Enc) → `082000 Crypto Key`. Сделали: сгенерили RSA-пару (`certs/client-encryption-private.pem`),
  на портале создали из CSR Mastercard Encryption Key `fintory-decrypt` (`75ea7e15`) и **активировали**;
  `.env`: `MC_ENCRYPTION_ENABLED=true`, CERT_PATH=clientenc.pem, FINGERPRINT=`f031d600`,
  DECRYPTION_KEY_PATH=client-encryption-private.pem. Результат: **Address/Account/Bank/IBAN Validation +
  Quote → РЕАЛЬНЫЕ расшифрованные данные**, live e2e **23/23**, hermetic **16/16**. (Детали — авто-память
  `mastercard-fle-working`.) ⚠️ `.env`/`certs` gitignored, НЕ коммичены; приватный ключ хранить.
  **РАЗОБРАНО 2026-06-16:** RFI `062000` = `request_id` не валидный UUID по RFC-4122 (ниблы
  версии/варианта = 0); с валидной v4-формой MC проходит формат, но sandbox даёт `401` —
  `partner-id` `SANDBOX_1234567` не онбординжен для RFI (внешний лимит). Endpoint Guide `502` —
  sandbox HTML-500 без corridor-данных (внешний лимит). src-комменты `EncryptionService`/`.env.example`
  и статусы доков (RU+EN) исправлены, typecheck чист. **Реальный остаток: per-tenant encryption seam.**
- **10-цикловый аудит баги/безопасность/оптимизация + 2 цикла регрессий** завершены —
  **открытых HIGH/MED нет.**
- **4-перспективный code-quality review** (архитектура / поддерживаемость / API-контракт /
  тестирование) → применены рефакторинги **Tier 1**: централизованная карта путей MC
  (`mc-paths.ts`); композитный cross-cutting декоратор (`UseGatewayContract`); public-api
  barrel (`src/index.ts`); закрыты пробелы Swagger (`@ApiSecurity('internal')` +
  заголовок `X-Tenant-Id`, `Idempotency-Key` через `@ApiHeader`, `ApiErrorResponses` на
  всех контроллерах, `WebhookAckDto`); +4 новых регрессионных спека. Вердикт: код
  senior-уровня, переписывать не нужно.
- **Tier 2 рефакторинги** (из того же ревью, поведение-сохраняющие, коммит `54a8b0a`,
  запушено): **#8 EncryptionService seam** — `encryptRequest(creds, body)` /
  `decryptResponse(creds, body)` (creds протянут из axios-интерцептора; реализация ОСТАЁТСЯ
  одноключевой, но контракт теперь per-tenant → готовит блокер per-tenant encryption
  структурно: при доступе к MTF меняется только нутро EncryptionService, не интерцептор);
  **#9 hermetic CI e2e** — сплит на 2 сьюта: `test/app.contract.e2e-spec.ts` (CI-дефолт,
  `jest-e2e.json`) с `overrideProvider` MastercardClient+CredentialsService → стабы (без
  live MC/certs, только Postgres+dev-env), детерминированно проверяет ветки маппинга,
  которых live не достаёт (MC 401/5xx→502 тело скрыто, 4xx-объект→конверт+`upstream`,
  4xx-HTML→502, success→форма) + input-валидацию — **10/10**; live-сьют `test/app.e2e-spec.ts`
  стал opt-in (`jest-e2e-live.json`, `npm run test:e2e:live`); **#7 CrossBorderService
  консолидация** — единый приватный `run(tenantId, ctx, build)` (gating→build McRequest из
  резолвленных creds→диспатч), схлопнул 4 диспетчера (call/callRef/callCatalog/callGuide) +
  хелперы заголовков (mcRefHeaders, catalogHeaders); ~20 методов стали 3-4 строки (build-
  замыкание, JSDoc сохранён, header-стратегия видна на месте вызова); `createPayment`
  оставлен (idempotency-обёртка). **Tier 3 (метрики prom-client, трассировка
  requestId↔X-Mc-Correlation-Id↔audit, группировка опций) — НЕ делалось** (нужна
  координация с клиентом).
- **Код-ревью senior-уровня — ещё два прохода** (поведение-сохраняющие, запушено):
  **(1) 8 правок** (`bfedb57`): `HealthController` вынесен из зонтичного модуля в
  dev-харнесс `AppModule` (корневые `/health`,`/ready` иначе коллизия с пробами хоста);
  `EncryptionService` fail-loud guard (отказ шифровать OWN-тенанта платформенным ключом) +
  сборка JWE в `onModuleInit`; `AuditService` экспоненциальный backoff флаша при отказе БД;
  `safeTokenEqual` (один примитив для 3 гардов); `parseClientCredentials` (общий OAuth-парсер,
  приоритет Basic — закрыт обход бакета rate-limit); `CreateTenantDto.partnerId` charset;
  типизированные `UnprocessableEntity (422)` вместо сырого `Error` в `CredentialsService`;
  `agent.destroy()` на shutdown. **(2) тесты + полировка** (`1178bcb`): +4 спека
  (EncryptionService, parseClientCredentials, оба auth-гарда), guard вместо каста
  `as McCredentials`, non-retryable крипто-ошибки, barrel-экспорт host-facing типов
  (`ErrorResponseDto`, `CredentialMode`/`TenantStatus`), `readonly` на value-объектах,
  дедуп `TokenResponse`↔`TokenResponseDto`, общие query-типы cash-pickup/endpoint-guide.
  Вердикт 3-го ревью (включая тулинг/конфиг): код senior/staff-уровня, регрессий нет;
  открытое по тулингу (CI/engines/coverage-gate) — решено НЕ делать.
- **Тесты:** unit jest — **20 сьютов / 147 тестов**; e2e: **hermetic 10/10** (CI-дефолт,
  стаб MC) + **live 23/23** на живом sandbox (`npm run test:e2e:live`).
  ⚠️ verify-команды ИЗМЕНИЛИСЬ: `jest --config ./test/jest-e2e.json` теперь = ГЕРМЕТИЧНЫЙ
  сьют (нужен только Postgres+.env, без live MC); живой sandbox — `npm run test:e2e:live`.

### Покрытие Mastercard API (клиент прислал скрин API Reference — нужны ВСЕ 15)
Карта — в `docs/{ru,en}/api.md` раздел «Покрытие Mastercard API Reference» (порядок
как на скрине, столбец **Sandbox** + статус). **Реализованы ВСЕ 15:**
1 Quotes, **2 Quote Confirmation сьют ×3** (confirm + cancel `/quotes/cancellations` +
retrieve `/quotes/{ref}/proposals/{id}`), **3 Carded/FX Rate Pull** (= `GET /crossborder/rates`,
операция MC `getFxRates` без тела; прежний ошибочный POST `/carded-rates` УДАЛЁН; нет sandbox
у MC), 4 Payment, **5 Address Validation**, **6 Account Validation сьют ×3** (account-validations +
bank-lookups + iban-generations), **7 Cash Pickup ×4 GET**, **8 Endpoint Guide** (GET; sandbox
даёт HTML-500 для generic pid), **9 Status Change Push** (вебхук → персист в `tx_status`;
чтение `GET /crossborder/status-events?ref=`), 10 Retrieve Payment, **11 RFI
сьют ×4** (retrieve/update/upload/download; sandbox canned-отказ для не-онбордженного pid;
upload — route-scoped лимит тела 2MB), 12 Cancel, 13 Balance, 14 Payload Encryption; **15 Push
Notifications** — приём/дедуп/**персист статусов в `tx_status`** готовы (STATUS_CHG/QUOTE_STATUS_CHG:
атомарный дедуп по UNIQUE(eventRef), атрибуция OWN→partnerId / PLATFORM→общий пул, нормализация
camel/snake); аутентичность вебхука = **mTLS** при деплое.
**Покрытие завершено.** Осталось только ВНЕШНЕ-заблокированное (per-tenant encryption/MTF,
**декрипт зашифрованного push** (нужен Client-ключ, MTF/Prod), mTLS-cert вебхука от MC,
прод-ключи Client Decryption).

**ВАЖНО про реализацию новых API:**
- Точные MC-пути НЕОДНОРОДНЫ — брать из `api-mastercard.md` (не угадывать): `/send/v1/`
  (quotes/payment/carded/retrieve/cancel), `/send/` без v1 (confirmations/account-validation/
  RFI), `/crossborder/` без /send и без partner-сегмента (cash-pickup/endpoint-guide),
  `/send/address-validation-service/` (address). partner-id: в ПУТИ (`this.partner()`=
  encodeURIComponent) у account-validation/RFI; в ЗАГОЛОВКЕ (сырой, через `headerSafe()`)
  у cash-pickup.
- **Validation-POST'ы (#5/#6) требуют ШИФРОВАНИЯ payload** → ~~на sandbox успех недостижим
  (FLE off)~~. **ИСПРАВЛЕНО 2026-06-16:** FLE на sandbox РАБОТАЕТ — после шифрования
  правильным Client Encryption ключом validation-API возвращают реальные данные (Address →
  200 VALID/VERIFIED и т.д., e2e ассертят бизнес-результат). `062000`/`150001 "Encrypted
  Payload"` были из-за неверного ключа. **GET-каталоги (#7) шифрования НЕ требуют → работают
  вживую** (e2e: cash-pickup countries → 200 с реальным списком стран).
- Паттерн: GET-каталог — `qs()`+`callCatalog()`; POST validation/lookup — `callRef()`+
  `mcRefHeaders()`. Все новые роуты в `CrossBorderController` (наследуют auth/throttle/
  audit/filter), gated `resolveActive` (ACTIVE-тенант). e2e после каждого: `node
  node_modules\jest\bin\jest.js --config ./test/jest-e2e.json` (нужен Postgres).

### Открытые блокеры (внешние)
per-tenant encryption (прод-OWN+JWE; JWE-либа требует файлы, ключи=Vault PEM, нельзя e2e
без MTF); **mTLS-аутентичность вебхука** (бывший «C1» — по доке MC это mTLS, а НЕ подпись
payload; нужен публичный mTLS-cert от MC + trust + cert-chain через KMP-портал; детали в
`api.md`/`plan.md`/`production-questions.md`); прод-ключи Client Encryption (портал).

> `.agentic-security/` (вывод плагина-сканера) — в `.gitignore`, НЕ коммитить. Коммиты:
> секрет-гейт → `git commit -F` → push origin main (push отдельным шагом, если авто-режим
> блокирует add+commit+push одной командой).
