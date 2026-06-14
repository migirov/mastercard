# Тесты — интеграция с Mastercard

Тесты всего, что **связано с Mastercard**: исходящие вызовы в Cross-Border API
(`sandbox.api.mastercard.com`) и входящие webhooks (MC → нам). Внутренние тесты
шлюза (auth, gating, надёжность, инфра) — в [tests-inner.md](./tests-inner.md).

Связанные: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> Поверхность Mastercard теперь проверяется **E2E-набором** (`test/app.e2e-spec.ts`,
> Jest, 23/23 зелёные) — он поднимает реальное приложение против живого sandbox по
> HTTP, плюс юнит-наборы, фиксирующие логику сборки запроса / разворота ответа (см.
> [tests-inner.md](./tests-inner.md)). Покрыты все 15 групп MC API.

---

## Запуск набора

```powershell
# Postgres (нужен для E2E) — внутри WSL
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"

# Юнит-наборы: 16 наборов / 112 тестов (rootDir src, *.spec.ts)
node node_modules\jest\bin\jest.js

# E2E против ЖИВОГО sandbox: 23/23
node node_modules\jest\bin\jest.js --config ./test/jest-e2e.json
```

> На этой связке Windows + WSL-UNC Jest вызывается через `node node_modules\jest\bin\jest.js`
> — `npx` не резолвится на смонтированном диске. E2E-харнесс поднимает реальный
> `AppModule` на порту `3999` (ручной bodyParser, `rawBody`, без глобального pipe —
> как в `main.ts`) и гоняет его через `axios`.

---

## Окружение

- **ОС:** Windows 10 + проект на WSL (Ubuntu), UNC-путь `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows-node (в WSL node нет). Docker/git — внутри WSL (`wsl -d Ubuntu ...`).
- **PostgreSQL:** Docker внутри WSL; Windows достаёт по `localhost:5432`.
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), шифрование выключено
  (`MC_ENCRYPTION_ENABLED=false` — sandbox не поддерживает FLE, работает plain).
- **Тенант для MC-вызовов:** `own-sandbox` (OWN/ACTIVE, ключи из LocalSecretStore,
  `partner-id` = `SANDBOX_1234567`).

E2E-набор сам поднимает приложение на порту `3999`; для ручной проверки через `curl`
можно также запустить dev-сервер на `3000`:

```bash
# Postgres + сервер
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && npx ts-node src/main.ts & popd"
```

---

## 1. Исходящие вызовы в Mastercard Cross-Border API (E2E, живой sandbox)

E2E-набор (`test/app.e2e-spec.ts`, **23/23 зелёные**) гоняет реальное приложение
против `sandbox.api.mastercard.com`. Каждая MC-проверка проходит весь путь: auth →
резолв тенанта → OWN-креды из SecretStore → **OAuth1-подпись** → HTTPS к MC →
разворот ответа. (В MTF/Prod добавляется JWE-шифрование тела — в sandbox plain.)
Заголовки тенанта: `x-internal-token` + `x-tenant-id: own-sandbox`.

### 1a. Доходит до MC с реальным бизнес-ответом

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-1 | `GET /crossborder/balances` | ✅ 200 (реальные балансы) |
| MC-2 | `POST /crossborder/quotes` (уникальный ref) | ✅ 200/201 — в теле `proposal`/`charged_amount` |
| MC-3 | `GET /crossborder/cash-pickup/countries?cash_pickup_type=PANY` (GET, без шифрования) | ✅ доходит до MC (не 404/500) |
| MC-4 | `GET /crossborder/endpoint-guide/specifications?...` (GET, без тела/шифрования) | ✅ доходит до MC (не 404/500) |
| MC-5 | `POST /crossborder/carded-rates` (Carded Rate Pull — sandbox не поддерживает) | ✅ проводка шлюза (не 500) |

### 1b. Валидация / lookup — контракт шлюза (запрос доходит до MC)

Эти POST-ы требуют шифрования в MTF/Prod, поэтому проверяется контракт шлюза:
маршрут смонтирован, OAuth1-подпись поставлена, запрос ушёл в MC и ответ проброшен —
утверждается как **не 404** (маршрут есть) и **не 500** (нет локального краша).

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-6 | `POST /crossborder/address-validations` (sandbox тест-кейс) | ✅ доходит до MC |
| MC-7 | `POST /crossborder/account-validations` (IBAN тест-кейс) | ✅ доходит до MC |
| MC-8 | `POST /crossborder/bank-lookups` (sandbox тест-кейс) | ✅ доходит до MC |
| MC-9 | `POST /crossborder/iban-generations` (sandbox тест-кейс) | ✅ доходит до MC |

### 1c. Группа RFI (Request For Information)

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-10 | `GET /crossborder/rfi/requests/:id` (sandbox-стаб `33…` → OPEN, GET) | ✅ доходит до MC (не 500) |
| MC-11 | `POST /crossborder/rfi/requests/:id` (update — нужно шифрование) | ✅ доходит до MC (не 404/500) |
| MC-12 | `POST /crossborder/rfi/documents` (upload — нужно шифрование) | ✅ доходит до MC (не 404/500) |
| MC-13 | `GET /crossborder/rfi/documents/:id` (download magic-id, код ошибки `082000`) | ✅ доходит до MC (не 500) |
| MC-14 | `POST /crossborder/rfi/documents` с файлом ~500KB | ✅ **НЕ 413** — route-scoped лимит 2MB, а не глобальный 256kb |

**Семантика разворота ответа MC** (общая для всех вызовов): 2xx → данные;
бизнес-4xx с объектом (`400/404/409/422/429`) → проброс тела MC; не-объектное тело
4xx → скрыто, `502`; `401/403`/`5xx`/сеть/сбой расшифровки → `502` без деталей
наружу. (Зафиксировано `crossborder.service.spec` — см. [tests-inner.md](./tests-inner.md).)

---

## 2. Входящие webhooks (Mastercard → нам)

Направление **MC → нам** (push-уведомления о статусах). Наружу к MC API не ходит.

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| WH-1 | `POST /webhooks/mastercard` без токена | ✅ 401 (fail-closed) |
| WH-2 | `POST /webhooks/mastercard` с `x-webhook-token` | ✅ 200 |

> Путь дедупа по `eventRef` (`kv_store`) зафиксирован юнит-тестами
> `webhook.handler.spec` / `webhook-auth.guard.spec` — см. [tests-inner.md](./tests-inner.md).
> Аутентификация вебхуков — in-service fail-closed токен (`X-Webhook-Token`),
> обязателен в prod и dev. mTLS на ингрессе — опциональный доп. слой, не аутентификация.

---

## Не покрыто (Mastercard)

- **Живое JWE-шифрование** — sandbox работает с выключенным FLE, поэтому круг
  encrypt/decrypt с MC не прогоняется end-to-end (только юнит-фиксация). В MTF/Prod
  нужен приватный Client Encryption key.
- **Полностью успешный платёж (2xx)** — требует полного KYC-флоу: quote →
  confirmation → payment с реквизитами отправителя/получателя.

---

## Как погасить окружение

```bash
# сервер — остановить процесс node/ts-node (Ctrl+C / Stop-Process по порту 3000)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"   # -v чтобы удалить данные
```
