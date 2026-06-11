# Session Memory — Mastercard Cross-Border Gateway

Хендофф-документ для восстановления контекста (если диалог был сжат/compact).
Дополняет [plan.md](./plan.md) (статус по фазам), [architecture.md](./architecture.md)
(дизайн) и [documentation.md](./documentation.md) (сущности, хранение, шифрование).

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
| **Хранение → PostgreSQL (TypeORM)** | ✅ (typecheck; e2e ждёт живой Postgres) |
| Версии выровнены под клиентский `b24club-api` | ✅ |

Каждый слой прошёл **аудит** (баги/безопасность/оптимизация) — ~30 фиксов.
Главное достижение: `POST /crossborder/quotes` через полный стек возвращает
**реальную котировку** на sandbox (plain, т.к. sandbox не поддерживает FLE).

---

## Архитектура (модули `src/`)

```
database/                  — TypeORM: DatabaseModule (forRoot) + entities
                             (tenants, oauth_clients, audit_log, kv_store)
store/                     — KvStore → PostgresKvStore (idempotency + webhook dedup, TTL)
tenants/                   — TenantRegistry поверх Postgres-репозитория (async) + сиды
credentials/               — CredentialsService.resolve(tenant): PLATFORM|OWN, in-mem КЭШ
secrets/                   — SecretStore: LocalSecretStore | VaultSecretStore (заглушка)
auth/                      — OAuth2 (token endpoint, ClientRegistry→Postgres), гарды, @CurrentTenant
admin/                     — ввод партнёров, одобрения, выпуск ключей, GET /admin/audit
encryption/                — EncryptionService (JWE, тумблер MC_ENCRYPTION_ENABLED)
idempotency/               — IdempotencyService (по Idempotency-Key, через KvStore→Postgres)
audit/                     — AuditInterceptor (глобальный) + AuditService→Postgres
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
| rate-limit | нативный `@nestjs/throttler` v5, **in-memory per-pod** (авторитетный лимит — ингресс) |
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
- **Webhook:** `POST /webhooks/mastercard` (прод: mTLS на ингрессе; dev: `X-Webhook-Token`).
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

**Для прод-расшифровки ответов нужен приватный ключ Client Encryption Key** — у
нас только публичный `.pem`. Из исходного ZIP при создании ключа либо
перегенерацией на портале → в `MC_DECRYPTION_KEY_PATH`. В sandbox не нужен.

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
**`DB_SYNC`** (true в dev). `REDIS_URL` — удалён.

---

## Версии (выровнены под клиентский b24club-api)

Nest 10, `@nestjs/jwt` 10.1.1, `@nestjs/throttler` ^5, `@nestjs/swagger` 7.3.0,
`@nestjs/config` 3.1.1, `reflect-metadata` 0.1.x, `axios` 1.6.0, `typeorm`
0.3.20, `@nestjs/typeorm` ^10.0.2, `class-transformer` 0.5.1. Наши доп.пакеты
(нет у клиента): helmet, mastercard-client-encryption, mastercard-oauth1-signer,
node-forge. Конфликтов нет (typecheck + peer-check OK; один benign warning
class-validator/mapped-types — есть и у клиента).

---

## ОТКРЫТЫЕ ВОПРОСЫ / задачи (важно)

1. **TypeORM: наш сервис отдельный или часть монолита `b24club-api`?**
   - Отдельный → текущая схема верна (свой `DatabaseModule.forRoot` + `DATABASE_URL`).
   - Часть монолита → убрать наш `forRoot`, entity через `forFeature` в их DataSource,
     схема — их миграциями (не `synchronize`). **Ждём ответа.**
2. ~~Удаление `Idempotency-Key`~~ — **РЕШЕНО ОСТАВИТЬ** (клиент подтвердил
   2026-06-10). `IdempotencyService` остаётся на `POST /crossborder/payments`.
3. **Прод-ключи:** приватный Client Encryption key (расшифровка), `MC_ENCRYPTION_ENABLED=true`
   в MTF/Prod, прод-секреты вместо dev-дефолтов, partner-id/ключи OWN-партнёров в Vault.
4. **e2e на Postgres** не прогнан (нет Docker/Postgres в текущей dev-среде).
5. Опционально: RFI-подсистема, per-tenant encryption (сейчас платформенного уровня),
   observability, очистка протухших `kv_store` (cron через `@nestjs/schedule`).

---

## На чём остановились (последнее действие сессии)

Завершены: **миграция на PostgreSQL** (Redis/in-memory убраны), **выравнивание
версий** под клиента, **вынос шифрования в axios-интерцептор** (бизнес-логика
чистая). Всё компилируется (typecheck OK). E2e на Postgres не прогнан — нужен
`docker compose up`. Idempotency-Key — решено оставить. Ждём ответа по вопросу
TypeORM (отдельный сервис vs монолит).
