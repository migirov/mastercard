# Mastercard Cross-Border Gateway — архитектура (as-built)

Отражает **фактически реализованное** состояние сервиса. Связанные документы:
[documentation.md](./documentation.md) (сущности, хранение, шифрование, сценарии),
[plan.md](./plan.md) (статус по фазам),
[production-questions.md](./production-questions.md) (блокеры перед прод),
[memory.md](./memory.md) (контекст сессии).

> **Топология (актуальная).** Вся интеграция — ОДИН встраиваемый зонтичный
> `MastercardModule` (`src/mastercard.module.ts`, через `ConfigurableModuleBuilder`,
> `forRoot/forRootAsync`), который хост-приложение (монолит `b24club-api` или
> dev-харнесс `AppModule` через `main.ts`) импортирует одной строкой — каждый
> под-модуль является приватной деталью реализации. Хост импортирует публичные
> символы (`MastercardModule`, `MASTERCARD_ENTITIES`, `RFI_UPLOAD_PATH`,
> `rfiUploadBodyParser`, `GatewayConfig`, `MastercardModuleOptions`, а также host-facing
> контракты `ErrorResponseDto`, `CredentialMode`/`TenantStatus`) **только** из
> публичного barrel `src/index.ts`, а не по глубоким путям. Конфиг приходит опциями и
> раздаётся через глобальный `GatewayConfig` (`src/config/gateway-config.ts`) —
> сервисы НЕ читают `process.env`/`ConfigService`. Глобального
> `ValidationPipe`/`APP_FILTER`/`APP_INTERCEPTOR` нет: cross-cutting связывание —
> **per-controller** (контроллер несёт свой pipe — `strictDtoPipe` для admin/oauth,
> `mcPassthroughPipe` без `transform` для тел, идущих в MC — плюс композитный декоратор
> `@UseGatewayContract()`, см. §10), чтобы встраиваемый модуль не подменял обработку
> ошибок хоста. Аутентификация вебхука — fail-closed в сервисе (+ каркас проверки
> подписи), а не «доверие к ингрессу». `EncryptionService` свёрнут в провайдер;
> идемпотентность платежей / дедуп вебхуков — на Postgres (отдельный KV-слой убран, issue #4);
> health-пробы — в dev-харнессе (не в зонтичном модуле). Единый список сущностей — в
> `src/mastercard.entities.ts` (`MASTERCARD_ENTITIES`, реэкспортируется зонтичным
> модулем для `DataSource` хоста); сами entity co-located в своих модулях. Старт-сервис
> `HostIntegrityService` предупреждает, если хост не подключил `DataSource` или
> `webhookToken`. «standalone» в §1 описывает режим запуска dev-харнесса.

## 1. Цель

Отдельный (standalone) сервис-шлюз к Mastercard Cross-Border Services для
**мульти-мерчант** платформы. Компании подключаются к интеграции, но **только
после двойного одобрения** — со стороны Mastercard и со стороны платформы.
Деплой — **Docker/Kubernetes, много подов** (горизонтальное масштабирование).

## 2. Требования (из постановки)

- **R1.** Интеграция вынесена в отдельный сервис (не часть основной платформы).
- **R2.** Мульти-тенант: один сервис обслуживает много партнёров.
- **R3.** Gating доступа: транзакции — только одобренным (Mastercard + платформа).
- **R4.** Два режима credentials:
  - **OWN** *(основной)* — у партнёра собственный partner-id + свои signing/encryption ключи.
  - **PLATFORM** *(вторичный)* — общий partner-id и ключи платформы; тенант = логический суб-аккаунт.
- **R5.** Два способа потребления:
  - **External REST API** — системы партнёров шлют запросы напрямую (OAuth2 client credentials → JWT).
  - **Internal** — наши сервисы/UI вызывают изнутри (service-token + явный `tenantId`).
- **R6.** Секреты (ключи, пароли, consumer keys) — в **Secret Manager (Vault/KMS)**.

## 3. Высокоуровневая схема

```
                External merchants            Internal services / UI
              (OAuth2 Bearer JWT)         (X-Internal-Token + X-Tenant-Id)
                        │                              │
                        ▼                              ▼
                ┌───────────────────────────────────────────────┐
                │            TenantAuthGuard (единый)            │
                │   Bearer JWT → tenantId   |   internal token   │
                │                  ставит req.tenantContext      │
                │            затем TenantThrottlerGuard          │
                └───────────────────────┬───────────────────────┘
                                        ▼
                ┌───────────────────────────────────────────────┐
                │       CrossBorderService (quote/payment/...)    │
                │              отдаёт «чистый» объект             │
                └───────────────────────┬───────────────────────┘
                                        ▼
   ┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
   │ TenantRegistry   │   │ CredentialsService   │   │ MastercardClient (axios) │
   │ статус/approval  │   │ PLATFORM | OWN       │   │ интерцепторы:            │
   │ → PostgreSQL     │   │ ← Vault (cache,TTL)  │   │  req: encrypt → sign     │
   └────────┬─────────┘   └──────────┬───────────┘   │  res: decrypt            │
            ▼                        ▼               └────────────┬─────────────┘
   ┌──────────────────┐       ┌────────────┐                     ▼
   │   PostgreSQL     │       │ Vault/KMS  │            api.mastercard.com
   │ tenants/oauth/   │       └────────────┘
   │ audit/tx_status/ │
   │ payment_idempo   │
   └──────────────────┘
```

## 4. Хранение состояния (многоподовый деплой)

Правило: in-memory держим **только** эфемерное и не требующее согласованности
между подами; всё доменное — в **PostgreSQL**. Подробная раскладка — в
[documentation.md](./documentation.md#хранение-данных-где-бд-где-in-memory).

| Данные | Где |
|---|---|
| `tenants`, `oauth_clients`, `audit_log` | **PostgreSQL** (TypeORM) |
| идемпотентность платежей | **PostgreSQL** (`payment_idempotency`, `UNIQUE(tenantId, idemKey)`, атомарный `INSERT ON CONFLICT`) |
| дедуп вебхуков | **PostgreSQL** (`tx_status`, `UNIQUE(eventRef)`, атомарный `INSERT ON CONFLICT`) |
| rate-limit | самодостаточный per-pod `@nestjs/throttler` (корректность не зависит от ингресса; лимит на ингрессе, если есть — опциональная доп. защита, не authoritative) |
| кэш credentials | **in-memory per-pod** (кэш из Vault, TTL) |
| секреты партнёров | **Vault/KMS** (через `SecretStore`) |

**Redis не используется** — согласованное состояние в Postgres, эфемерный
rate-limit — самодостаточный per-pod `@nestjs/throttler` (корректность не зависит
от ингресса). Глобальный кросс-под лимит потребовал бы общего хранилища, которое
проект намеренно не использует; лимит на ингрессе, если есть — опциональная доп.
защита, не authoritative.

## 5. Модель арендатора (Tenant)

`Tenant` хранится в PostgreSQL (`tenants`). Полное описание — в
[documentation.md](./documentation.md#tenant). Ключевое:

| Поле | Назначение |
|---|---|
| `id` | внутренний tenant id (стабильный, PK) |
| `name` | название компании |
| `credentialMode` | `PLATFORM` \| `OWN` |
| `partnerId` | для `OWN` — собственный; для `PLATFORM` — берётся общий |
| `secretRef` | путь в Vault до набора секретов (для `OWN`) |
| `platformApproved`, `mcApproved`, `suspended` | три независимых флага одобрения/блокировки |

**Статус не хранится — вычисляется** из флагов (`PENDING` → `PLATFORM_APPROVED` /
`MC_APPROVED` → `ACTIVE` → `SUSPENDED`), чтобы его нельзя было выставить в обход
одобрений. **Gating (R3):** транзакционные эндпоинты доступны только при
`isActive(tenant)` (оба одобрения и не заблокирован).

`tenant_id` (наш внутренний) ≠ `partner_id` (внешний, в URL Mastercard) — см.
[documentation.md](./documentation.md#tenant_id-vs-partner_id-важно).

## 6. Credentials: два режима (R4) + резолвер

Единый тип, скрывающий режим от остального кода ([McCredentials](./documentation.md#mccredentials)):

```ts
interface McCredentials {
  consumerKey: string;
  signingKeyPem: string;        // приватный ключ подписи (PEM)
  partnerId: string;
  encryptionCertPem?: string;   // per-tenant ключ JWE-шифрования запросов
  encryptionFingerprint?: string;
  decryptionKeyPem?: string;    // для расшифровки ответов
}
```

- **PLATFORM** → общий набор платформы из `.env`/конфигурации; кэш без TTL.
- **OWN** → `tenant.secretRef` из Vault (`SecretStore`) → ключи партнёра; кэш с TTL
  (`MC_CREDS_CACHE_TTL_MS`) + дедуп stampede + `invalidate()` для ротации.
- **Секреты не логируются и не уходят в ответы.** Подпись **stateless** —
  `McCredentials` передаются на каждый вызов.

> ⚠️ Поля шифрования резолвятся per-tenant, но `EncryptionService` сейчас
> платформенного уровня — per-tenant encryption не подключён (блокер OWN+Prod, см.
> [production-questions.md](./production-questions.md)).

## 7. Шифрование и подпись — axios-интерцепторы

Field-level encryption (JWE) и OAuth1-подпись вынесены в **axios-интерцепторы**
`MastercardClient` — бизнес-логика отдаёт «чистый» объект и про крипту не знает.
Граница — **мы ↔ Mastercard** (исходящий вызов). Детали:
[documentation.md](./documentation.md#шифрование-encryption--decryption).

```
request-интерцептор:  1) зашифровать тело (JWE, x-encrypted:true; passthrough если выкл)
                      2) подписать OAuth1 ПО ЗАШИФРОВАННОМУ телу (Authorization)
res-интерцептор:      расшифровать тело ответа (passthrough если plain) → 502 при сбое
```

Тумблер `MC_ENCRYPTION_ENABLED` (off=plain passthrough, on=JWE). FLE работает во всех
средах, включая sandbox (доказано 2026-06-16): запрос шифруем Client Encryption Key,
ответ расшифровываем нашим Mastercard Encryption private key. `EncryptionService`
изолирован — при желании выносится в отдельный микросервис (минусы — в
documentation.md).

## 8. Поток запроса (на примере quote)

1. Inbound → `TenantAuthGuard`: внешний (Bearer JWT → `tid`) **или** внутренний
   (`X-Internal-Token` + `X-Tenant-Id`). Ставит `req.tenantContext`.
2. `TenantThrottlerGuard`: rate-limit по `tenantId` (fail-closed, без IP-фолбэка).
3. `CrossBorderService`: проверяет `isActive(tenant)` (иначе `403`).
4. `CredentialsService.resolve(tenant)` → `McCredentials` (Vault, через кэш).
5. Строится путь с `partnerId` + чистое тело → `MastercardClient.request(creds, …)`.
6. Интерцептор: encrypt → sign → отправка; ответ — decrypt.
7. Разворачивание: 2xx → данные; бизнес-4xx → проброс мерчанту; 401/403/5xx/сеть → `502`.
8. Глобальный `AuditInterceptor` пишет запись (кто, метод, путь, статус, мс) — без тел.

## 9. Авторизация (R5)

- **External:** партнёр получает OAuth2 client credentials (`POST /oauth/token` →
  JWT 15 мин). `client_id`/`secret` хранятся хэшем; rate-limit `/oauth/token` —
  по **`client_id`** (`OAuthThrottlerGuard`, не обходится ротацией IP за прокси).
- **Internal:** доверенные сервисы — `X-Internal-Token` + явный `X-Tenant-Id`.
- Оба пути сходятся в единый `req.tenantContext` (`@CurrentTenant`), чтобы код не
  знал, откуда пришёл запрос. `tenantId` **никогда** не берётся из тела/квери —
  только из аутентификации.

## 10. Модули NestJS

Хост импортирует **только** `MastercardModule` (зонтичный). Всё ниже — приватные
под-модули, собранные внутри него. Зонтичный модуль напрямую регистрирует per-pod
`ThrottlerModule`, предоставляет `GatewayConfig` (из опций `forRootAsync`) и
`HostIntegrityService`, реэкспортирует `MASTERCARD_ENTITIES`. Health-пробы (`/health`,
`/ready`) живут в dev-харнессе (`AppModule`), а НЕ в зонтичном модуле — корневые пробы
конфликтовали бы с пробами хост-монолита (при встраивании liveness/readiness — за хостом).

| Модуль / единица | Ответственность |
|---|---|
| `MastercardModule` (зонтичный) | единственный модуль, импортируемый хостом (`forRoot/forRootAsync`); собирает все под-модули, даёт глобальный `GatewayConfig`, регистрирует `ThrottlerModule` + `HostIntegrityService` |
| `TenantModule` | `TenantRegistry` поверх Postgres, статусы, сиды; `TenantEntity` co-located |
| `CredentialsModule` | `CredentialsService` (PLATFORM/OWN), in-memory кэш (LRU 500 + TTL) |
| `SecretsModule` | `SecretStore`: Local (dev) / Vault (прод) |
| `AuthModule` | OAuth2, `TenantAuthGuard`, `AdminAuthGuard`, `OAuthThrottlerGuard`; `OAuthClientEntity` co-located |
| `AdminModule` | ввод партнёров, одобрения, выпуск/отзыв OAuth-клиентов, `GET /admin/audit` |
| `MastercardClientModule` | низкоуровневый `MastercardClient` (axios + интерцепторы encrypt/sign/decrypt); `EncryptionService` — провайдер здесь, не отдельный модуль |
| `AuditModule` | `AuditInterceptor` (навешивается per-controller через `@UseGatewayContract()`) + батчевый `AuditService` → Postgres; `AuditLogEntity` co-located |
| `WebhooksModule` | приём push-уведомлений MC (in-service fail-closed `X-Webhook-Token`; mTLS на ингрессе — опциональный доп. слой); ВСЕ события персистятся/дедупятся в `tx_status` одним атомарным `INSERT ON CONFLICT` по `eventRef` (KV-слоя нет); статусные (STATUS_CHG/QUOTE_STATUS_CHG) несут status/stage и читаются мерчантом, атрибуция тенанту (OWN→partnerId / PLATFORM→общий пул), нормализация camel/snake |
| `TransactionStatusModule` | `TransactionStatusStore` + `TransactionStatusEntity` (`tx_status`); общий для `WebhooksModule` (запись) и `CrossBorderModule` (tenant-scoped чтение для polling) |
| `CrossBorderModule` | бизнес-эндпоинты (все 15 групп MC API) + polling статусов (`GET /crossborder/status-events`); использует `mc-paths.ts` (централизованный билдер URL MC); приватный `PaymentIdempotencyStore` (Postgres `payment_idempotency`) |
| `database/` (только dev-харнесс) | `DatabaseModule` (TypeORM `forRoot`) — только в standalone через `main.ts`; при встраивании `DataSource` владеет хост |
| `HealthController` (dev-харнесс) | `@nestjs/terminus` — `/health` (liveness), `/ready` (readiness + пинг БД); регистрируется в `AppModule` (харнесс), НЕ в зонтичном модуле — корневые пробы конфликтовали бы с хостом; при встраивании пробы даёт хост |
| `PaymentIdempotencyStore` | приватный провайдер `CrossBorderModule`; идемпотентность платежей на Postgres (`payment_idempotency`); заменил прежний KV-based `IdempotencyService` (issue #4) |
| `common/` | общие cross-cutting утилиты (см. ниже) |

**`common/` (общие утилиты и паттерны):**
- `gateway-contract.decorator.ts` — `@UseGatewayContract()` = композиция
  `@UseFilters(GatewayExceptionFilter)` + `@UseInterceptors(AuditInterceptor)`,
  навешивается **per-controller** (не `APP_*`), чтобы новый контроллер не мог забыть
  error-контракт/аудит. (`AdminController` оставлен со своим явным набором с `ClassSerializerInterceptor`.)
- `mc-passthrough.pipe.ts` — `mcPassthroughPipe()` для тел, пробрасываемых в MC как есть
  (без `transform`/`whitelist`); лежит в `common/`, т.к. используется и crossborder, и webhooks.
- `secret-strength.ts` — `isWeakSecret()`, общий для `main.ts` и прод-гейта `GatewayConfig`.
- `api-error-responses.decorator.ts` — `ApiErrorResponses()` документирует единый формат ошибки в Swagger.
- `string-query.pipe.ts` — `StringQueryPipe` отвергает не-строковые query-параметры (объекты/массивы).
- `rfi-upload.bodyparser.ts` — `RFI_UPLOAD_PATH` + `rfiUploadBodyParser()`: route-scoped
  2MB JSON-парсер для загрузки RFI-документа (только POST); хост обязан зарегистрировать его при встраивании.
- `idempotency-key.*`, `safe-id.pipe.ts`, `validation.pipe.ts` (`strictDtoPipe`),
  `oauth-throttler.guard.ts`, `tenant-throttler.guard.ts`, p12/crypto utils,
  `gateway-exception.filter.ts`, `upstream.exception.ts`.

Также в корне пакета: `src/index.ts` (публичный barrel API), `src/mastercard.entities.ts`
(единый список сущностей), `src/host-integrity.service.ts` (старт-самопроверка),
`src/crossborder/mc-paths.ts` (централизованный билдер путей MC — префиксы MC намеренно
неоднородны: `/send/partners` vs `/send/v1/partners` vs голый `/crossborder` vs база
address-validation; теперь в одном аудируемом месте).

Платформенные возможности Nest (взяты готовыми, без самописа):
- **Rate-limit** — `@nestjs/throttler` (`ThrottlerModule.forRoot` внутри зонтичного модуля;
  один именованный сет `default` 120/мин, per-pod), с per-route override на `/oauth/token`.
- **Health-пробы** — `@nestjs/terminus` (`HealthController` в dev-харнессе `AppModule`; при встраивании пробы даёт хост) для k8s.
- **Валидация ENV** — на границе dev-харнесса (`env.validation.ts`, class-validator,
  fail-fast на старте); при встраивании хост передаёт типизированные `MastercardModuleOptions`,
  а прод-гейт проверяет `GatewayConfig`.
- **Логи** — `nestjs-pino`: структурный JSON + correlation-id (`x-request-id`), redact секретов.
- **Миграции** — TypeORM CLI (`data-source.ts`, `migration:*`); `synchronize` off в prod.

## 11. Безопасность (payment-grade)

- **Изоляция тенантов:** creds резолвятся строго из аутентифицированного контекста;
  партнёр A не может использовать ключи партнёра B.
- **Идемпотентность платежей** по `transaction_reference` (защита от двойных списаний),
  источник истины — Postgres `payment_idempotency` (отдельного KV-слоя/заголовка нет; бэкстоп —
  дедуп MC по тому же `transaction_reference`).
- **Audit trail** на все операции — без тел и секретов.
- **OAuth2:** HS256-пиннинг, хэш-сравнение секретов в постоянном времени, `no-store`.
- **Прод-гейты:** запрет старта со слабыми/дефолтными секретами (`isWeakSecret()`, общий
  для `main.ts` и `GatewayConfig`) и без `MC_SECRET_STORE=vault`. helmet / лимит тела /
  логгер / `trust proxy` — забота dev-харнесса (`main.ts`); при встраивании этим владеет хост.
- **Fail-closed** rate-limit guard (нет tenant-контекста → ошибка, не общий бакет).
- Vault: короткоживущий кэш, ротация ключей без рестарта (`invalidate`).
- Разделение sandbox/MTF/production — через конфиг окружения, не в коде.

## 12. Статус реализации (фазы)

- ✅ **Фаза 1 — Tenant + per-tenant stateless-подпись.**
- ✅ **Фаза 2 — SecretStore (Local/Vault) + режим OWN.**
- ✅ **Фаза 3 — Auth (OAuth2 + internal) + approval/gating + admin-API.**
- ✅ **Фаза 4 — JWE-шифрование** (в axios-интерцепторе; тумблер по среде).
- ✅ **Фаза 5 — Audit, идемпотентность, rate-limit.**
- ✅ **Фаза 6 — Полный набор операций** (payment/retrieve/cancel/confirm) + Swagger.
- ✅ **Миграция на PostgreSQL** (Redis/in-memory как хранилища убраны).
- ✅ **Платформенные доработки:** health-пробы (terminus), валидация ENV,
  TypeORM-миграции, структурные логи (pino) + correlation-id.
- ✅ **Встраиваемый зонтичный модуль:** единый `MastercardModule` + публичный barrel
  (`src/index.ts`), per-controller cross-cutting связывание, `GatewayConfig`, `HostIntegrityService`.
- ✅ **Полное покрытие MC API:** все 15 групп MC API Reference под `/crossborder/*`
  (balances, **rates** (Carded/FX Rate Pull, GET), quotes(+confirmations/cancellations/
  retrieve-confirmed-quote), payments/retrieve/cancel, address-/
  account-validations, bank-lookups, iban-generations, cash-pickup, endpoint-guide,
  RFI requests/documents; идемпотентность платежей по `transaction_reference`) +
  **Push Notifications**: вебхук персистит статусы в `tx_status`,
  мерчант читает через `GET /crossborder/status-events`.
- ✅ **Качество:** 10-раундовый аудит безопасности/багов/оптимизаций + 2 раунда регрессий +
  4-линзовый код-ревью (Tier 1 применён); доработка покрытия (confirm-suite 3/3, carded-rate
  GET, push-персист) прошла ещё 3 раунда анализа (баги/оптимизация/безопасность). Тесты: unit
  20 сьютов / 159, e2e на живом sandbox.
- ⬜ **Перед прод:** per-tenant encryption (JWE-интерцептор всё ещё на платформенном
  ключе — см. §6), подпись вебхука (C1) и **декрипт зашифрованного push** (нужен Client-ключ),
  приватный Client-ключ дешифрования, Vault-реализация, метрики/трейсинг (Prometheus/OTel) —
  см. [production-questions.md](./production-questions.md).
