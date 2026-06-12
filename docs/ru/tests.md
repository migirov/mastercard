# Тесты — интеграция с Mastercard

Тесты всего, что **связано с Mastercard**: исходящие вызовы в Cross-Border API
(`sandbox.api.mastercard.com`) и входящие webhooks (MC → нам). Внутренние тесты
шлюза (auth, gating, надёжность, инфра) — в [tests-inner.md](./tests-inner.md).

Связанные: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> `$base = http://localhost:3000`. Проверка — `curl.exe` (печатает статус через
> `-w "HTTP %{http_code}"`).

---

## Окружение

- **ОС:** Windows 10 + проект на WSL (Ubuntu), UNC-путь `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows-node (в WSL node нет). Docker/git — внутри WSL (`wsl -d Ubuntu ...`).
- **PostgreSQL:** Docker внутри WSL; Windows достаёт по `localhost:5432`.
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), шифрование выключено
  (`MC_ENCRYPTION_ENABLED=false` — sandbox не поддерживает FLE, работает plain).
- **Тенант для MC-вызовов:** `own-sandbox` (OWN/ACTIVE, ключи из LocalSecretStore,
  `partner-id` = `SANDBOX_1234567`).

```bash
# Postgres + сервер
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && npx ts-node src/main.ts & popd"
```

---

## 1. Исходящие вызовы в Mastercard Cross-Border API

**Только эти тесты реально уходят в `sandbox.api.mastercard.com`.** Путь каждого:
auth → резолв тенанта → OWN-креды из SecretStore → **OAuth1-подпись** → HTTPS к MC
→ разворот ответа. (В MTF/Prod добавляется JWE-шифрование тела — в sandbox plain.)

| # | Тест | Ожидание | Факт |
|---|---|---|---|
| MC-1 | `GET /crossborder/balances` (internal, own-sandbox) | 200 + реальные балансы | ✅ 200 (USD/JPY/BHD) |
| MC-2 | `GET /crossborder/balances` с Bearer JWT (внешний путь) | 200 + реальные балансы | ✅ 200 |
| MC-3 | `GET /crossborder/rates` | 200 | ✅ 200 `{"rates":{}}` |
| MC-4 | `POST /crossborder/quotes` (уникальный ref) | 201 + предложение MC | ✅ 201, реальный proposal |
| MC-5 | `POST /crossborder/quotes` (занятый ref) | проброс бизнес-ошибки MC | ✅ 400 `Duplicate Transaction Reference` |
| MC-6 | `POST /crossborder/payments` (неполное тело) | проброс ошибки MC | ✅ 400 `MISSING_REQUIRED_INPUT` (MC обработал, RequestId есть) |

### MC-1 / MC-2 — Балансы (реальный MC)

```bash
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" $base/crossborder/balances
```
**HTTP 200** — реальный ответ Mastercard sandbox (3 счёта):
```json
[ {"accountId":"acct_1001","settlementCurrency":"USD",
   "balanceDetails":{"availableBalance":{"amount":"8000.50","currency":"USD"}, ...}},
  {"accountId":"acct_1002","settlementCurrency":"JPY", ...},
  {"accountId":"acct_1003","settlementCurrency":"BHD", ...} ]
```
**MC-2** — то же через внешний путь (`Authorization: Bearer <JWT>`) → тоже 200.
Доказывает весь стек: auth → OWN-креды → **OAuth1-подпись** → реальный вызов MC.

### MC-3 — FX-курсы

```bash
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" $base/crossborder/rates
# HTTP 200  {"rates":{}}
```

### MC-4 — Котировка, успех (201)

```bash
# body: {"quoterequest":{"transaction_reference":"<уникальный>",
#   "sender_account_uri":"tel:+25406005","recipient_account_uri":"tel:+254069832",
#   "payment_amount":{"amount":"105.15","currency":"USD"},
#   "payment_origination_country":"USA","payment_type":"P2P",
#   "quote_type":{"forward":{"receiver_currency":"GBP"}}}}
curl.exe -s -X POST -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" \
  -H "Content-Type: application/json" --data-binary "@quote.json" $base/crossborder/quotes
```
**HTTP 201** — реальное предложение MC:
```json
{"quote":{"transaction_reference":"08POC342598033X","payment_type":"P2P",
 "proposals":{"proposal":[{"id":"pen-4000000044472562338287758",
   "charged_amount":{"amount":"110.41","currency":"USD"},
   "principal_amount":{"amount":"105.15","currency":"USD"},"quote_fx_rate":"777"}]}}}
```

### MC-5 — Котировка, занятый ref (проброс ошибки MC)

**HTTP 400** — ошибка MC проброшена клиенту как есть (подпись принята, MC обработал):
```json
{"Errors":{"Error":{"Source":"transaction_reference","ReasonCode":"DECLINE",
 "Description":"Duplicate Transaction Reference Number","Details":{"Detail":{"Value":"130202"}}}}}
```

### MC-6 — Платёж доходит до MC

Платёж с неполным телом → MC возвращает список обязательных KYC-полей (присвоен
RequestId → запрос реально дошёл и обработан):
```json
{"Errors":{"Error":[{"Source":"sender.first_name","ReasonCode":"MISSING_REQUIRED_INPUT", ...}, ...]}}
```

**Семантика разворота ответа MC** (общая для всех вызовов): 2xx → данные;
бизнес-4xx (`400/404/409/422/429`) → проброс тела MC; `401/403`/`5xx`/сеть → `502`
без деталей наружу.

---

## 2. Входящие webhooks (Mastercard → нам)

Направление **MC → нам** (push-уведомления о статусах). Наружу к MC API не ходит.

| # | Тест | Факт |
|---|---|---|
| WH-1 | `POST /webhooks/mastercard` 1-й раз | ✅ 200 `{"status":"accepted"}` |
| WH-2 | повтор с тем же `eventRef` | ✅ 200 `{"status":"duplicate"}` (дедуп через `kv_store`) |
| WH-3 | неверный `X-Webhook-Token` | ✅ 401 `invalid webhook token` |

```bash
WH=(-H "X-Webhook-Token: dev-webhook-token-change-me" -H "Content-Type: application/json")
B='{"eventRef":"evt-test-001","eventType":"STATUS_CHG"}'
curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # accepted
curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # duplicate
```
> Аутентификация вебхуков — in-service fail-closed токен (`X-Webhook-Token`),
> обязателен в prod и dev. mTLS на ингрессе — опциональный доп. слой, не аутентификация.

---

## Не покрыто (Mastercard)

- **Шифрование (JWE)** — только MTF/Prod (sandbox FLE не поддерживает + блокер
  per-tenant encryption); нужен приватный Client Encryption key.
- **Успешный платёж (2xx)** — требует полного KYC-флоу: quote → confirmation →
  payment с реквизитами отправителя/получателя.

---

## Как погасить окружение

```bash
# сервер — остановить процесс node/ts-node (Ctrl+C / Stop-Process по порту 3000)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"   # -v чтобы удалить данные
```
