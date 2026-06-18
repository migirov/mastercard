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

# Юнит-наборы: 20 наборов / 147 тестов (rootDir src, *.spec.ts)
node node_modules\jest\bin\jest.js

# E2E против ЖИВОГО sandbox: 23/23
node node_modules\jest\bin\jest.js --config ./test/jest-e2e.json
```

> На этой связке Windows + WSL-UNC Jest вызывается через `node node_modules\jest\bin\jest.js`
> — `npx` не резолвится на смонтированном диске. E2E-харнесс поднимает реальный
> `AppModule` на порту `3999` (ручной bodyParser, без глобального pipe —
> как в `main.ts`) и гоняет его через `axios`.

---

## Окружение

- **ОС:** Windows 10 + проект на WSL (Ubuntu), UNC-путь `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows-node (в WSL node нет). Docker/git — внутри WSL (`wsl -d Ubuntu ...`).
- **PostgreSQL:** Docker внутри WSL; Windows достаёт по `localhost:5432`.
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), field-level encryption
  ВКЛЮЧЕНО (`MC_ENCRYPTION_ENABLED=true`) — FLE на sandbox работает (доказано 2026-06-16:
  запрос шифруем Client Encryption Key, ответ расшифровываем нашим Mastercard Encryption
  private key; validation-API отдают реальные расшифрованные данные).
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
резолв тенанта → OWN-креды из SecretStore → **JWE-шифрование тела** → **OAuth1-подпись
по зашифрованному телу** → HTTPS к MC → **расшифровка ответа** → разворот. (FLE работает
и на sandbox — доказано 2026-06-16.) Заголовки тенанта: `x-internal-token` + `x-tenant-id: own-sandbox`.

### 1a. Доходит до MC с реальным бизнес-ответом

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-1 | `GET /crossborder/balances` | ✅ 200 (реальные балансы) |
| MC-2 | `POST /crossborder/quotes` (уникальный ref) | ✅ 200/201 — в теле `proposal`/`charged_amount` |
| MC-3 | `GET /crossborder/cash-pickup/countries?cash_pickup_type=PANY` (GET, без шифрования) | ✅ доходит до MC (не 404/500) |
| MC-4 | `GET /crossborder/endpoint-guide/specifications?...` (GET, без тела/шифрования) | ✅ доходит до MC (не 404/500) |
| MC-5 | `GET /crossborder/rates` (Carded/FX Rate Pull, GET — sandbox не поддерживает) | ✅ проводка шлюза (не 500) |

### 1b. Валидация / lookup — реальные данные через FLE

Эти POST-ы проходят **полный FLE round-trip вживую** (запрос шифруется Client Encryption
ключом, ответ расшифровывается нашим Mastercard Encryption private key) и возвращают
**реальные расшифрованные данные** — ассертится конкретный бизнес-результат, а не только
«не 404/500».

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-6 | `POST /crossborder/address-validations` (FLE) | ✅ 200 — `status: VALID`, `verification: VERIFIED` |
| MC-7 | `POST /crossborder/account-validations` (FLE) | ✅ 200 — `status: SUCCESS` + `accountMatch` |
| MC-8 | `POST /crossborder/bank-lookups` (FLE) | ✅ 200 — `bankInfo.banks` |
| MC-9 | `POST /crossborder/iban-generations` (FLE) | ✅ 200 — `ibanDetails.accounts` |

### 1c. Группа RFI (Request For Information)

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| MC-10 | `GET /crossborder/rfi/requests/:id` — невалидный UUID vs валидный | ✅ невалидный → **400 локально** (нет `062000`, до MC не дошло); валидный → доходит до MC (не 404/500) |
| MC-11 | `POST /crossborder/rfi/requests/:id` (update, валидный UUID) | ✅ доходит до MC (не 404/500) |
| MC-12 | `POST /crossborder/rfi/documents` (upload) | ✅ доходит до MC (не 404/500) |
| MC-13 | `GET /crossborder/rfi/documents/:id` (download, валидный UUID) | ✅ доходит до MC (не 500) |
| MC-14 | `POST /crossborder/rfi/documents` с файлом ~500KB | ✅ **НЕ 413** — route-scoped лимит 2MB, а не глобальный 256kb |

> **Корень RFI-ошибок (разобрано 2026-06-16, эмпирически).** `request_id`/`document_id` ДОЛЖНЫ
> быть **валидными UUID по RFC-4122**. Раньше невалидные демо-id (`33000000-0000-0000-0000-
> 000000000000`, `10000000-…-082000`; ниблы версии/варианта = 0) долетали до MC и получали
> `400 062000 INVALID_INPUT_FORMAT "Value contains invalid character"` (Source: `request_id`).
> **Теперь** `UuidParamPipe` (`src/common/pipes/uuid-param.pipe.ts`) валидирует формат на ГРАНИЦЕ и
> отдаёт чистый локальный `400` без исходящего вызова (юнит: `uuid-param.pipe.spec`, 13/13).
> С **валидной v4-формой** (`33000000-0000-4000-8000-000000000000`) запрос проходит pipe и
> формат MC, но MC возвращает **`401 AUTHORIZATION_FAILED`** (код `050007`, "Unauthorized
> Access", Source пустой) → шлюз маскирует в `502`. Это **авторизация уровня API**: проект/
> consumer-key **не имеет доступа к RFI API** (те же креды успешно работают на balances/
> quotes/validations, значит дело не в OAuth и не в partner-id/request-id — RFI это opt-in
> сьют, его надо подключить проекту на портале MC / у представителя MC). Upload документов —
> тот же `050007`→`502`. Внешний лимит, не баг шлюза.

**Семантика разворота ответа MC** (общая для всех вызовов): 2xx → данные;
бизнес-4xx с объектом (`400/404/409/422/429`) → проброс тела MC; не-объектное тело
4xx → скрыто, `502`; `401/403`/`5xx`/сеть/сбой расшифровки → `502` без деталей
наружу. (Зафиксировано `cross-border.gateway.spec` — см. [tests-inner.md](./tests-inner.md).)

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
> обязателен в prod и dev. Авторитетная аутентичность push-уведомлений у MC — **mTLS**
> (а не подпись payload; бывший «C1» — детали в `api.md` → Webhooks).

---

## Не покрыто (Mastercard)

- ~~**Живое JWE-шифрование**~~ — **теперь ПОКРЫТО (2026-06-16):** круг encrypt/decrypt
  прогоняется end-to-end против MC sandbox (validation-API отдают реальные расшифрованные
  данные, live e2e 23/23). Непокрытым остаётся **per-tenant** путь ключей (OWN-партнёры со
  своими ключами — см. production-questions.md).
- **Полностью успешный платёж (2xx)** — требует полного KYC-флоу: quote →
  confirmation → payment с реквизитами отправителя/получателя.

---

## Как погасить окружение

```bash
# сервер — остановить процесс node/ts-node (Ctrl+C / Stop-Process по порту 3000)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"   # -v чтобы удалить данные
```
