# Mastercard Cross-Border Gateway — архитектура (as-built)

Отражает **фактически реализованное** состояние сервиса. Связанные документы:
[documentation.md](./documentation.md) (сущности, хранение, шифрование, сценарии),
[plan.md](./plan.md) (статус по фазам),
[production-questions.md](./production-questions.md) (блокеры перед прод),
[memory.md](./memory.md) (контекст сессии).

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
   │ audit/kv_store   │
   └──────────────────┘
```

## 4. Хранение состояния (многоподовый деплой)

Правило: in-memory держим **только** эфемерное и не требующее согласованности
между подами; всё доменное — в **PostgreSQL**. Подробная раскладка — в
[documentation.md](./documentation.md#хранение-данных-где-бд-где-in-memory).

| Данные | Где |
|---|---|
| `tenants`, `oauth_clients`, `audit_log` | **PostgreSQL** (TypeORM) |
| идемпотентность платежей, дедуп вебхуков | **PostgreSQL** (`kv_store`, TTL, атомарный `setIfAbsent`) |
| rate-limit | нативный `@nestjs/throttler`, **in-memory per-pod** (авторитет — ингресс) |
| кэш credentials | **in-memory per-pod** (кэш из Vault, TTL) |
| секреты партнёров | **Vault/KMS** (через `SecretStore`) |

**Redis не используется** — согласованное состояние в Postgres, эфемерный
rate-limit — нативный throttler per-pod + лимит на ингрессе.

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

Тумблер `MC_ENCRYPTION_ENABLED` (sandbox=plain, MTF/Prod=JWE). `EncryptionService`
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

| Модуль | Ответственность |
|---|---|
| `DatabaseModule` | подключение к PostgreSQL (TypeORM `forRoot`) |
| `StoreModule` | `KvStore` → `PostgresKvStore` (идемпотентность, дедуп вебхуков) |
| `TenantModule` | `TenantRegistry` поверх Postgres, статусы, сиды |
| `CredentialsModule` | `CredentialsService` (PLATFORM/OWN), кэш |
| `SecretsModule` | `SecretStore`: Local (dev) / Vault (прод) |
| `AuthModule` | OAuth2, `TenantAuthGuard`, `AdminAuthGuard`, `OAuthThrottlerGuard` |
| `AdminModule` | ввод партнёров, одобрения, выпуск/отзыв OAuth-клиентов, `GET /admin/audit` |
| `MastercardModule` | `MastercardClient` (axios + интерцепторы encrypt/sign/decrypt) |
| `EncryptionModule` | `EncryptionService` (JWE, тумблер по среде) |
| `IdempotencyModule` | `IdempotencyService` (через `KvStore`) |
| `AuditModule` | `AuditInterceptor` (глобальный) + `AuditService` → Postgres |
| `WebhooksModule` | приём push-уведомлений MC (mTLS на ингрессе), дедуп |
| `CrossBorderModule` | бизнес-эндпоинты: quote / payment / retrieve / cancel / confirm |
| `common/` | p12/crypto utils, `TenantThrottlerGuard` |

Rate-limit — нативный `@nestjs/throttler` (`ThrottlerModule.forRoot` в `AppModule`),
in-memory per-pod.

## 11. Безопасность (payment-grade)

- **Изоляция тенантов:** creds резолвятся строго из аутентифицированного контекста;
  партнёр A не может использовать ключи партнёра B.
- **Idempotency-Key** на платежах (защита от двойных списаний; бэкстоп — MC
  `transaction_reference`); ключ валидируется (длина/charset).
- **Audit trail** на все операции — без тел и секретов.
- **OAuth2:** HS256-пиннинг, хэш-сравнение секретов в постоянном времени, `no-store`.
- **Прод-гейты** в `main.ts`: запрет старта со слабыми/дефолтными секретами и без
  `MC_SECRET_STORE=vault`; helmet; лимит тела 256kb; `trust proxy` по env.
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
- ⬜ **Перед прод:** per-tenant encryption, приватный Client-ключ, Vault-реализация,
  observability, RFI — см. [production-questions.md](./production-questions.md).
