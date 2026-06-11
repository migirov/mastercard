# Тесты — Mastercard Cross-Border Gateway

Отчёт о ручном end-to-end тестировании на живом окружении (sandbox Mastercard +
локальный PostgreSQL). Дата прогона: 2026-06-11.

Связанные документы: [plan.md](./plan.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

---

## Окружение

- **ОС:** Windows 10 + проект на WSL (Ubuntu), UNC-путь `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows-node; запуск через `pushd` (UNC не поддерживается напрямую).
- **PostgreSQL:** Docker внутри WSL Ubuntu (Docker на Windows нет).
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), шифрование
  выключено (`MC_ENCRYPTION_ENABLED=false` — sandbox не поддерживает FLE).
- **Тенанты (сиды):** `platform`, `acme` (PLATFORM/ACTIVE), `own-sandbox`
  (OWN/ACTIVE, ключи из LocalSecretStore), `own-demo` (OWN/PENDING).
- **Dev-токены** (из `.env`): `MC_ADMIN_TOKEN=dev-admin-token-change-me`,
  `MC_INTERNAL_TOKEN=dev-internal-token-change-me`.

### Поднять окружение

```bash
# 1) Postgres (внутри WSL Ubuntu)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"
#   → контейнер mc-gateway-postgres, healthcheck=healthy, порт 5432:5432
#   → Windows достаёт его по localhost:5432 (WSL2 port-forwarding)

# 2) Сервер (Windows-node через pushd)
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && npx ts-node src/main.ts & popd"
#   → лог: TypeOrmModule initialized, схема создана (synchronize), сиды,
#     все маршруты замаплены, "Сервер на http://localhost:3000"
```

**Старт сервера (ключевые строки лога):**
```
[EncryptionService] Field-level encryption выключена — plain (sandbox)
[InstanceLoader] TypeOrmCoreModule dependencies initialized +1427ms
[RouterExplorer] Mapped {/crossborder/quotes, POST} route   (и остальные)
[NestApplication] Nest application successfully started
[Bootstrap] Сервер на http://localhost:3000
```

Метод проверки эндпоинтов — `curl.exe` (не бросает на не-2xx, печатает статус
через `-w "HTTP %{http_code}"`).

---

## Результаты (сводка)

| # | Тест | Ожидание | Факт |
|---|---|---|---|
| 1 | `GET /admin/tenants` (admin) | список тенантов из БД | ✅ 200, 4 тенанта, статусы вычислены |
| 2 | `GET /crossborder/balances` без auth | 401 | ✅ 401 `missing bearer token` |
| 3 | `GET /admin/tenants` неверный admin-токен | 401 | ✅ 401 `invalid admin token` |
| 4 | `GET /crossborder/balances` (internal, own-sandbox) | 200 + реальные балансы MC | ✅ 200 |
| 5 | `GET /crossborder/rates` (internal, own-sandbox) | 200 | ✅ 200 `{"rates":{}}` |
| 6 | gating own-demo (PENDING) | 403 | ✅ 403 `...is not active (status PENDING)` |
| 7 | неизвестный тенант | 404 | ✅ 404 `Tenant 'nope' not found` |
| 8 | `POST /admin/tenants/own-sandbox/clients` | выпуск client_id/secret | ✅ 201, secret 32 симв., note |
| 9 | `POST /oauth/token` (client_credentials) | JWT | ✅ Bearer, expires_in=900 |
| 10 | `GET /crossborder/balances` с Bearer JWT | 200 + реальные балансы | ✅ 200 |
| 11 | `POST /oauth/token` неверный secret | 401 | ✅ 401 `invalid_client` |
| 12 | `POST /crossborder/quotes` (занятый ref) | проброс ошибки MC | ✅ 400 `Duplicate Transaction Reference` |
| 13 | `GET /admin/audit` | записи из Postgres | ✅ все запросы записаны |
| 14 | `POST /crossborder/quotes` (уникальный ref) | 201 + предложение MC | ✅ 201, реальный proposal |

**Покрытие:** Postgres-персистентность (tenants/oauth/audit), оба пути auth
(internal + OAuth2), gating одобрений, OAuth1-подпись → реальный MC, проброс
бизнес-ошибок MC, audit-trail, английские сообщения ошибок.

---

## Детально: команды и вывод

> `$base = http://localhost:3000`

### 1. GET /admin/tenants — список тенантов (Postgres + сиды)

```bash
curl.exe -s -H "X-Admin-Token: dev-admin-token-change-me" $base/admin/tenants
```
**HTTP 200** — 4 тенанта (сокращённо):
```json
[
  {"id":"platform","credentialMode":"PLATFORM","status":"ACTIVE"},
  {"id":"acme","credentialMode":"PLATFORM","status":"ACTIVE"},
  {"id":"own-sandbox","credentialMode":"OWN","status":"ACTIVE"},
  {"id":"own-demo","credentialMode":"OWN","partnerId":"OWN_PARTNER_TBD","status":"PENDING"}
]
```
Проверяет: чтение из Postgres, сиды, вычисляемый `status`, `secretRef` не отдаётся.

### 2–3. Auth-негативы

```bash
curl.exe -s $base/crossborder/balances
# HTTP 401  {"message":"missing bearer token","error":"Unauthorized","statusCode":401}

curl.exe -s -H "X-Admin-Token: wrong" $base/admin/tenants
# HTTP 401  {"message":"invalid admin token","error":"Unauthorized","statusCode":401}
```

### 4. GET /crossborder/balances (internal-auth, own-sandbox) → реальный MC

```bash
curl.exe -s \
  -H "X-Internal-Token: dev-internal-token-change-me" \
  -H "X-Tenant-Id: own-sandbox" \
  $base/crossborder/balances
```
**HTTP 200** — реальный ответ Mastercard sandbox (3 счёта, сокращённо):
```json
[
  {"accountId":"acct_1001","settlementCurrency":"USD","accountState":"ACTIVE",
   "balanceDetails":{"availableBalance":{"amount":"8000.50","currency":"USD"}, ...}},
  {"accountId":"acct_1002","settlementCurrency":"JPY", ...},
  {"accountId":"acct_1003","settlementCurrency":"BHD", ...}
]
```
Проверяет ВЕСЬ путь: internal-auth → резолв тенанта → OWN-креды из SecretStore →
**OAuth1-подпись** → реальный вызов MC → ответ.

### 5. GET /crossborder/rates

```bash
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" $base/crossborder/rates
# HTTP 200  {"rates":{}}
```

### 6–7. Gating и неизвестный тенант

```bash
# own-demo = PENDING (нет двойного одобрения)
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-demo" $base/crossborder/balances
# HTTP 403  {"message":"Tenant 'own-demo' is not active (status PENDING)","error":"Forbidden","statusCode":403}

curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: nope" $base/crossborder/balances
# HTTP 404  {"message":"Tenant 'nope' not found","error":"Not Found","statusCode":404}
```

### 8–11. Внешний поток OAuth2 (выпуск клиента → токен → Bearer)

```bash
# 8) выпуск OAuth-клиента партнёру
curl.exe -s -X POST -H "X-Admin-Token: dev-admin-token-change-me" \
  $base/admin/tenants/own-sandbox/clients
# HTTP 201  {"clientId":"mc_RPVCa4sGrL2O","clientSecret":"<32 симв.>",
#            "note":"client_secret показан один раз — сохраните его сейчас"}

# 9) обмен на access-token
curl.exe -s -X POST $base/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<cid>&client_secret=<sec>"
# {"access_token":"<JWT>","token_type":"Bearer","expires_in":900}

# 10) вызов с Bearer (внешний путь → реальный MC)
curl.exe -s -H "Authorization: Bearer <JWT>" $base/crossborder/balances
# HTTP 200  [ ...реальные балансы MC... ]

# 11) неверный secret
curl.exe -s -X POST $base/oauth/token -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<cid>&client_secret=WRONG"
# HTTP 401  {"message":"invalid_client","error":"Unauthorized","statusCode":401}
```
Проверяет: выпуск/хранение OAuth-клиента в Postgres, выдачу и проверку JWT,
внешний путь до MC, timing-safe валидацию секрета.

### 12. POST /crossborder/quotes — занятый ref (проброс ошибки MC)

```bash
# body: {"quoterequest":{"transaction_reference":"08POC000000000ACFQ", ...}}
curl.exe -s -X POST -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" \
  -H "Content-Type: application/json" --data-binary "@q.json" $base/crossborder/quotes
```
**HTTP 400** — ошибка Mastercard корректно проброшена клиенту:
```json
{"Errors":{"Error":{"Source":"transaction_reference","ReasonCode":"DECLINE",
 "Description":"Duplicate Transaction Reference Number",
 "Details":{"Detail":{"Name":"ErrorDetailCode","Value":"130202"}}}}}
```
(ref был использован прошлым PoC-прогоном — доказывает, что подпись принята и
forwardable-ошибки MC пробрасываются как есть.)

### 13. GET /admin/audit — журнал из Postgres

```bash
curl.exe -s -H "X-Admin-Token: dev-admin-token-change-me" $base/admin/audit
```
Все запросы записаны (сокращённо):
```json
[
 {"tenantId":"own-sandbox","source":"external","method":"GET","path":"/crossborder/balances","status":200,"ms":536},
 {"tenantId":null,"method":"POST","path":"/oauth/token","status":200,"ms":5},
 {"tenantId":null,"method":"POST","path":"/admin/tenants/own-sandbox/clients","status":201,"ms":207},
 {"tenantId":"own-demo","source":"internal","method":"GET","path":"/crossborder/balances","status":403,"ms":48},
 {"tenantId":"own-sandbox","source":"internal","method":"GET","path":"/crossborder/balances","status":200,"ms":1264}
]
```
Проверяет: запись audit в Postgres (без тел/секретов), чтение `GET /admin/audit`.

### 14. POST /crossborder/quotes — уникальный ref (успех)

```bash
# transaction_reference = "08POC342598033X" (уникальный)
curl.exe -s -X POST -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" \
  -H "Content-Type: application/json" --data-binary "@q2.json" $base/crossborder/quotes
```
**HTTP 201** — реальное предложение Mastercard sandbox:
```json
{"quote":{"transaction_reference":"08POC342598033X","payment_type":"P2P",
 "proposals":{"proposal":[{"id":"pen-4000000044472562338287758",
   "charged_amount":{"amount":"110.41","currency":"USD"},
   "principal_amount":{"amount":"105.15","currency":"USD"},
   "expiration_date":"2026-06-11T00:42:08-05:00","quote_fx_rate":"777"}]}}}
```
Полный транзакционный путь (включая интерцептор шифрования в plain-режиме) →
**успешная котировка от MC**.

---

---

## Прогон 2 — надёжность (идемпотентность, rate-limit, webhook, рестарт)

| # | Тест | Ожидание | Факт |
|---|---|---|---|
| A1 | Webhook 1-й раз | accepted | ✅ 200 `{"status":"accepted"}` |
| A2 | Webhook повтор (тот же `eventRef`) | duplicate | ✅ 200 `{"status":"duplicate"}` |
| A3 | Webhook неверный токен | 401 | ✅ 401 `invalid webhook token` |
| B | `/oauth/token` ×12 (лимит 10/мин) | 10×4xx, потом 429 | ✅ req 1–10 → 401, req 11–12 → **429** |
| C1 | Платёж ×2 с одним `Idempotency-Key` | ошибка не кэшируется, ретрай в MC | ✅ оба 400, **разные** MC RequestId |
| C2 | `kv_store` после ошибки платежа | нет idem-замка | ✅ 0 idem-строк (замок освобождён) |
| C3 | `Idempotency-Key` 200 символов | 400 локально, до MC | ✅ 400 `up to 128 chars…` |
| D1 | После рестарта: список тенантов | те же 4, без дублей | ✅ 4 тенанта |
| D2 | После рестарта: webhook `evt-test-001` | duplicate (kv пережил) | ✅ `{"status":"duplicate"}` |
| D3 | После рестарта: счётчики Postgres | audit рос, не обнулился | ✅ tenants=4, oauth=1, audit=29, kv=1 |

### A. Webhook-дедуп

```bash
WH=(-H "X-Webhook-Token: dev-webhook-token-change-me" -H "Content-Type: application/json")
B='{"eventRef":"evt-test-001","eventType":"STATUS_CHG","transactionReference":"txn-1"}'

curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # {"status":"accepted"}  HTTP 200
curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # {"status":"duplicate"} HTTP 200
curl.exe -s -H "X-Webhook-Token: wrong" -d "$B" $base/webhooks/mastercard
# HTTP 401 {"message":"invalid webhook token",...}
```

### B. Rate-limit `/oauth/token` (10/мин по client_id)

12 запросов с одним `client_id=ratetest` (невалидный secret):
```
req  1..10 -> HTTP 401   (invalid_client — но считаются лимитером)
req 11..12 -> HTTP 429   (Too Many Requests)
```
Подтверждает: лимит ровно 10/мин и ключ — `client_id` (`OAuthThrottlerGuard`).

### C. Идемпотентность платежа

```bash
# одинаковый Idempotency-Key, одинаковое тело, два раза
curl.exe -s -X POST -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" \
  -H "Idempotency-Key: idem-dup-key" --data-binary "@pay.json" $base/crossborder/payments
```
- **1-й вызов** → HTTP 400, MC `RequestId: 430640156`, список `MISSING_REQUIRED_INPUT`
  (sender/recipient KYC) — MC обработал запрос.
- **2-й вызов (тот же ключ)** → HTTP 400, **другой** `RequestId: 430640160` →
  **MC вызван повторно** (НЕ из кэша). Это дизайн: **ошибки не кэшируются**, ретрай
  идёт в MC.
- `SELECT key FROM kv_store WHERE key LIKE 'idem:%'` → **0 строк** (замок освобождён
  после ошибки — нет залипания).
- `Idempotency-Key` из 200 символов → **400** `Idempotency-Key: up to 128 chars
  from [A-Za-z0-9._-:]` (локальная валидация ДО вызова MC).

> Успешное **кэширование** (2-й вызов отдаёт 2xx из кэша без обращения к MC)
> требует валидного платежа (полный KYC + подтверждённая котировка) — отдельный
> sandbox-флоу, в этом прогоне не воспроизводился. Сама KV-машинерия (`setIfAbsent`
> в Postgres) доказана дедупом вебхука (ниже) и инспекцией `kv_store`.

### Инспекция Postgres (KV-машинерия персистится)

```sql
SELECT key, left(value,30), "expiresAt" FROM kv_store;
-- wh:evt-test-001 | 1 | 2026-06-12 05:46:32+00   (дедуп вебхука, TTL 24ч)
SELECT count(*) FROM tenants;        -- 4
SELECT count(*) FROM oauth_clients;  -- 1
SELECT count(*) FROM audit_log;      -- 24
```

### D. Персистентность после рестарта пода

Останов сервера (`TaskStop`) → порт 3000 свободен → повторный `npx ts-node src/main.ts`.
После рестарта:
```bash
curl.exe -s -H "X-Admin-Token: ..." $base/admin/tenants
#  → те же 4 тенанта (platform/acme/own-sandbox/own-demo), БЕЗ дублей
#    (сиды через INSERT … ON CONFLICT DO NOTHING)

curl.exe -s -H "X-Webhook-Token: ..." -d '{"eventRef":"evt-test-001",...}' $base/webhooks/mastercard
#  → {"status":"duplicate"}   (kv_store пережил рестарт!)
```
```sql
SELECT count(*) FROM tenants, oauth_clients, audit_log, kv_store;
-- tenants=4, oauth_clients=1, audit_rows=29 (рос с 24), kv_rows=1
```
**Вывод:** доменное состояние (tenants, oauth, audit) и KV (идемпотентность/дедуп)
**переживают рестарт** — цель миграции на Postgres для multi-pod k8s достигнута.

---

---

## Прогон 3 — аудит (10 правок) + регрессии (4 цикла)

После Прогонов 1–2 проведён глубокий аудит (10 циклов анализ→правка на баги/
безопасность/оптимизацию) и регрессионная верификация (4 цикла) на **перезапущенном
сервере со всеми правками**.

**Правки аудита:** (1) `synchronize` запрещён в production; (2) `bootstrap().catch`
→ exit(1); (3) `partnerId` анти-traversal (`..`/`\`); (4) **батчинг** audit-вставок;
(5) защита `JSON.parse` идемпотентности → не 500; (6) успешный платёж не теряется
при сбое кэша; (7) ретрай идемпотентных GET (502/503/504); (8) лимит пула БД
(`DB_POOL_MAX`) для multi-pod; (9) webhook at-least-once; (10) fire-and-forget
очистка KV. Все — typecheck OK.

**Регрессии (рестарт + повтор тестов):**

| Цикл | Что проверено | Факт |
|---|---|---|
| Рег-1 | чистый старт со всеми правками + auth/tenant/gating | ✅ boot OK, 4 тенанта, 401, 403 |
| Рег-2 | реальные вызовы MC (интерцептор + ретрай + partnerId) | ✅ balances/rates 200, quote 201 |
| Рег-3 | идемпотентность / webhook / rate-limit | ✅ 400-валидация, dedup, 10→429 |
| Рег-4 | батчинг audit (переписанный путь) + персистентность | ✅ /admin/audit 49 записей, Postgres пишет |

Подтверждено: `MC_PARTNER_ID="SANDBOX_1234567"` не отвергается анти-traversal;
батч-писатель аудита сбрасывает буфер перед чтением `/admin/audit`; **регрессий
не найдено**.

---

## Не покрыто

- **Шифрование (JWE)** — только в MTF/Prod (sandbox FLE не поддерживает, плюс
  блокер per-tenant encryption); нужен приватный Client Encryption key.
- **Успешный платёж + кэш идемпотентности (2xx)** — требует полного KYC-флоу
  (quote → confirmation → payment с реквизитами отправителя/получателя).

## Как погасить окружение

```bash
# сервер — остановить процесс ts-node (Ctrl+C / TaskStop фонового запуска)
# Postgres:
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"
# с удалением данных:  docker compose down -v
```
