# API — Mastercard Cross-Border Gateway

Справочник по всем HTTP-эндпоинтам сервиса. Связанные документы:
[documentation.md](./documentation.md) (сущности), [tests.md](./tests.md)
(примеры вызовов), [architecture.md](./architecture.md) (дизайн).

- **Базовый URL (dev):** `http://localhost:3000`
- **Формат:** JSON (OAuth-токен — также `application/x-www-form-urlencoded`).
- **Интерактивная схема:** `GET /api-docs` (Swagger; в проде выключен без `SWAGGER_ENABLED`).

---

## Покрытие Mastercard API Reference

Полный список Mastercard Cross-Border **API Reference** (в порядке сайдбара) в проекции
на наш шлюз. Статус: ✅ реализовано · ⚠️ частично · ❌ ещё нет. Sandbox: ✅ доступен ·
⚠️ ограниченно (фикс. тест-кейсы / нужно шифрование / частично) · ❌ недоступен.

| # | Mastercard API | Upstream MC эндпоинт(ы) | Наш эндпоинт шлюза | Sandbox | Статус |
|---|---|---|---|---|---|
| 1 | **Quotes API** | `POST /send/v1/partners/{pid}/crossborder/quotes` | `POST /crossborder/quotes` | ✅ | ✅ |
| 2 | **Quote Confirmation APIs** (сьют ×3) | Confirm `POST …/crossborder/quotes/confirmations`; Cancel `POST …/crossborder/quotes/cancellations`; Retrieve `GET …/crossborder/quotes/{ref}/proposals/{proposalId}` | `POST /crossborder/quotes/confirmations`, `POST /crossborder/quotes/cancellations`, `GET /crossborder/quotes/:transactionReference/proposals/:proposalId` | ✅ | ✅ |
| 3 | **Carded Rate Pull + Push** | Pull `GET /send/v1/partners/{pid}/crossborder/rates` (операция `getFxRates`, без тела); Push = вебхук на стороне клиента | `GET /crossborder/rates` | ❌ (нет sandbox у MC) | ✅ |
| 4 | **Payment API** | `POST /send/v1/partners/{pid}/crossborder/payment` | `POST /crossborder/payments` | ✅ | ✅ |
| 5 | **Address Validation API** | `POST /send/address-validation-service/addresses/validations` | `POST /crossborder/address-validations` | ✅ (FLE → `200 VALID/VERIFIED`) | ✅ |
| 6 | **Account Validation APIs** (сьют ×3) | `POST …/crossborder/accounts/validations`; `POST …/crossborder/banks/details` (Bank Lookup); `POST …/crossborder/accounts/generate-ibans` (IBAN Gen) | `POST /crossborder/account-validations`, `/bank-lookups`, `/iban-generations` | ✅ (FLE → реальные данные; ASV N/A в sandbox) | ✅ |
| 7 | **Cash Pickup Locations API** | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | ✅ | ✅ |
| 8 | **Endpoint Guide API** | `GET /crossborder/endpoint-guide/specifications` | `GET /crossborder/endpoint-guide/specifications` | ⚠️ (доходит до MC; sandbox → HTML 500 для generic partner-id) | ✅ |
| 9 | **Status Change Push** | MC → наш вебхук (push) | `POST /webhooks/mastercard` (персист в `tx_status`); чтение мерчантом `GET /crossborder/status-events?ref=` | ✅ | ✅ (приём + персист) |
| 10 | **Retrieve Payment API** | `GET /send/v1/partners/{pid}/crossborder/{id}` · `…?ref=` | `GET /crossborder/payments/:id` · `?ref=` | ✅ | ✅ |
| 11 | **RFI APIs** (сьют ×4) | Retrieve `GET …/rfi/requests/{id}`; Update `POST` тот же; Upload `POST …/rfi/documents`; Download `GET …/rfi/documents/{id}` | `GET /crossborder/rfi/requests/:id`, `POST` тот же, `POST /crossborder/rfi/documents`, `GET /crossborder/rfi/documents/:id` | ⚠️ (sandbox: невалидный UUID→`062000`, валидный UUID→`401` неонбординг pid; push N/A) | ✅ |
| 12 | **Cancel Payment API** | `POST /send/v1/partners/{pid}/crossborder/{id}/cancel` | `POST /crossborder/payments/:id/cancel` | ✅ | ✅ |
| 13 | **Balance API** | `GET /send/partners/{pid}/crossborder/accounts?include_balance=true` | `GET /crossborder/balances` | ✅ | ✅ |
| 14 | **Payload Encryption** | JWE (RSA-OAEP-256 + A256GCM) | `EncryptionService` (axios-интерцептор) | ✅ (FLE РАБОТАЕТ на sandbox, 2026-06-16) | ✅ |
| 15 | **Push Notifications Details** | inbound-вебхук + дедуп + персист статусов | `POST /webhooks/mastercard` (+ `tx_status`, чтение `GET /crossborder/status-events?ref=`) | ✅ | ✅ (приём/дедуп/персист; декрипт зашифрованного push — MTF/Prod, см. ниже; аутентичность = **mTLS** при деплое) |

**Реализовано — все 15:** 1, **2**, **3**, 4, **5**, **6**, **7**, **8**, **9**, 10, **11**, 12, 13, 14, **15** (Status Change/Quote Status Change персистятся в `tx_status` с атомарным дедупом и атрибуцией тенанту; декрипт зашифрованного push и mTLS-аутентичность настраиваются при деплое в MTF/Prod — см. раздел «Webhooks»).

> **Address Validation (5)** и **Account Validation (6)** ТРЕБУЮТ JWE-шифрования payload — и оно
> **РАБОТАЕТ на sandbox** (подтверждено вживую 2026-06-16): запрос шифруется **Client Encryption**
> ключом (MC хранит приватный и расшифровывает), ответ MC шифрует **Mastercard Encryption** ключом,
> а наш приватный его расшифровывает. e2e возвращает РЕАЛЬНЫЕ данные: Address → `200 VALID/VERIFIED`;
> Account → `200 SUCCESS` с банком (Natixis); Bank Lookup/IBAN Gen → `200`. Документированные sandbox
> тест-кейсы (фикс. адреса/IBAN/BIC/BAN) — в `api-mastercard.md`; настройка ключей FLE — в авто-памяти
> `mastercard-fle-working` и `production-questions.md`. (ASV-тип Account Validation в sandbox — N/A.)
> Раньше тут стояло «FLE в sandbox выключена» — это было ОШИБКОЙ выбора ключа (шифровали Mastercard
> Encryption вместо Client Encryption → `082000 Crypto Key`). У части групп **нет sandbox** (Carded Rate).
>
> **Endpoint Guide (8)** реализован GET'ом (тела/шифрования нет). e2e подтвердил проводку
> (OAuth1-подпись, заголовки `X-Mc-Correlation-Id`/`Partner-Ref-Id`, маршрут), НО sandbox для
> generic partner-id отдаёт **HTML-страницу 500** (Tomcat «Internal Server Error», не
> структурный JSON) — по доке MC коридорные спецификации доступны только после онбординга
> партнёра (sandbox = generic endpoint setup). Шлюз корректно скрывает HTML-5xx и отдаёт 502
> (тело наружу не утекает). Проверится вживую в MTF/Prod на онбордженном partner-id.
>
> **RFI (11)** — все 4 операции реализованы (Retrieve/Update/Upload/Download), partner-id в
> пути, обёртки тел `updateRequest`/`uploadDocumentRequest`. e2e подтвердил проводку всех 4
> маршрутов. **`request_id`/`document_id` валидируются как RFC-4122 UUID на ГРАНИЦЕ**
> (`UuidParamPipe`, `src/common/uuid-param.pipe.ts`) — разобрано эмпирически 2026-06-16: (1)
> **невалидный UUID** (демо-id `33000000-…-000…0`, `10000000-…-082000` с ниблами версии/варианта
> = 0; либо плейсхолдер `33XXXXXX-…` с X) теперь даёт **чистый локальный `400`** без исходящего
> вызова (раньше долетал до MC и получал `062000 INVALID_INPUT_FORMAT "Value contains invalid
> character"`, Source `request_id`); (2) с **валидной v4-формой**
> (`33000000-0000-4000-8000-000000000000`) запрос проходит pipe и формат MC, но MC отдаёт
> **`401 AUTHORIZATION_FAILED`** (код `050007`, "Unauthorized Access") → шлюз маскирует в `502`.
> Это **авторизация уровня API**: проект/consumer-key НЕ имеет доступа к RFI API (те же креды
> работают на balances/quotes/validations — дело не в OAuth/partner-id, RFI это opt-in сьют,
> подключается проекту на портале MC). Upload-документа — тоже `050007`→`502`. Update/Upload
> шифруются как validation.
> **Upload-документа** несёт base64-файл до ~1MB → для `POST
> /crossborder/rfi/documents` задан **route-scoped лимит тела 2MB** (глобальный 256kb для всех
> прочих маршрутов сохранён); e2e: ~500KB-файл проходит парсер (НЕ 413). Push-вебхук RFI
> приходит на общий `/webhooks/mastercard`.
>
> **Carded Rate (3)** — Pull реализован как `GET /crossborder/rates` к MC
> `GET …/v1/partners/{pid}/crossborder/rates` (операция MC `getFxRates`, «No Request body» →
> метод **GET**; прежний ошибочный `POST /crossborder/carded-rates` удалён). **MC не
> предоставляет sandbox для Carded Rate** (явно в доке) → успех недостижим; e2e проверяет лишь,
> что шлюз не падает внутренне и форвардит ответ MC. Push-вариант — вебхук на стороне клиента
> (общий `/webhooks/mastercard`). Проверится вживую в MTF/Prod на сконфигурированном коридоре.

> Префиксы путей MC неоднородны (по офиц. доке): `/send/v1/…` — quotes/payment/carded-rate/
> retrieve/cancel; `/send/…` (без `v1`) — confirmations/cancellations/retrieve-confirmed-quote/
> account-validation/RFI; `/crossborder/…` (без `/send`, без partner-сегмента) —
> cash-pickup/endpoint-guide; Address Validation — отдельная база
> `/send/address-validation-service/…`.

---

## Аутентификация

Четыре независимых способа — у каждой группы эндпоинтов свой:

| Заголовок / способ | Кто | Где применяется |
|---|---|---|
| `Authorization: Bearer <JWT>` | **внешний мерчант** (партнёр) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | **внутренний** сервис/UI платформы | `/crossborder/*` |
| `X-Admin-Token` | **оператор платформы** | `/admin/*` |
| in-service `X-Webhook-Token` (fail-closed; авторитетная аутентичность у MC = **mTLS**, токен — наш доп. фактор) | **Mastercard** | `/webhooks/*` |
| — (публичный) | любой с client_id/secret | `/oauth/token` |

**Важно:** `tenantId` НИКОГДА не берётся из тела/query — только из аутентификации
(JWT внешнего мерчанта или `X-Tenant-Id` внутреннего вызова).

### Получение токена мерчанта

```
POST /oauth/token            (публичный — сам является точкой аутентификации)
```
Тело (`form-urlencoded` или JSON), grant `client_credentials`:

| Поле | Описание |
|---|---|
| `grant_type` | всегда `client_credentials` |
| `client_id` | выданный admin-API (`mc_…`) |
| `client_secret` | выданный admin-API (показывается один раз) |

`client_id`/`secret` можно передать и в `Authorization: Basic`. Ответ:
```json
{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 900 }
```
JWT живёт 15 мин, HS256, `tid` = tenantId. Rate-limit: **10/мин по `client_id`**.
Ошибки: `400 unsupported_grant_type`, `401 invalid_client`.

---

## Cross-Border API (бизнес-операции мерчанта)

Группа `/crossborder/*`. Auth — Bearer JWT (внешний) **или** `X-Internal-Token` +
`X-Tenant-Id` (внутренний). Доступны **только активному тенанту** (двойное
одобрение, иначе `403`). Rate-limit: **120/мин на тенанта**. Каждый запрос
подписывается OAuth1 ключами тенанта и (в MTF/Prod) шифруется JWE — прозрачно.

| Метод | Путь | Что делает | Upstream Mastercard |
|---|---|---|---|
| `GET` | `/crossborder/balances` | Счета и балансы партнёра | `GET …/crossborder/accounts?include_balance=true` |
| `GET` | `/crossborder/rates` | Carded / FX Rate Pull (курсы коридоров) | `GET …/crossborder/rates` |
| `POST` | `/crossborder/quotes` | Запросить котировку (цена/курс перевода) | `POST …/crossborder/quotes` |
| `POST` | `/crossborder/quotes/confirmations` | Подтвердить котировку | `POST …/crossborder/quotes/confirmations` |
| `POST` | `/crossborder/quotes/cancellations` | Отменить подтверждённую котировку (возврат резерва) | `POST …/crossborder/quotes/cancellations` |
| `GET` | `/crossborder/quotes/:transactionReference/proposals/:proposalId` | Просмотр подтверждённой котировки | `GET …/crossborder/quotes/{ref}/proposals/{proposalId}` |
| `POST` | `/crossborder/payments` | Инициировать платёж | `POST …/crossborder/payment` |
| `GET` | `/crossborder/payments/:id` | Статус платежа по id | `GET …/crossborder/{id}` |
| `GET` | `/crossborder/payments?ref=…` | Статус платежа по transaction reference | `GET …/crossborder?ref=…` |
| `POST` | `/crossborder/payments/:id/cancel` | Отмена платежа | `POST …/crossborder/{id}/cancel` |
| `GET` | `/crossborder/status-events?ref=…` | Сохранённые push-статусы по transaction_reference (локальное чтение из `tx_status`, не вызов MC) | — |

`…` = `/send[/v1]/partners/{partner-id}/crossborder` — `partner-id` подставляется
из credentials тенанта (не из запроса).

### Типичный поток перевода

```
1. POST /crossborder/quotes              → предложение (proposal) с ценой/курсом
2. POST /crossborder/quotes/confirmations → подтвердить выбранное предложение
3. POST /crossborder/payments            → инициировать платёж (+ Idempotency-Key)
4. GET  /crossborder/payments/:id        → опрашивать статус (или ждать вебхук)
```

### POST /crossborder/quotes

Тело — JSON-объект (passthrough в Mastercard; gateway его не урезает). Пример:
```json
{
  "quoterequest": {
    "transaction_reference": "08POC342598033X",
    "sender_account_uri": "tel:+25406005",
    "recipient_account_uri": "tel:+254069832",
    "payment_amount": { "amount": "105.15", "currency": "USD" },
    "payment_origination_country": "USA",
    "payment_type": "P2P",
    "quote_type": { "forward": { "receiver_currency": "GBP" } }
  }
}
```
Ответ **201** — реальное предложение MC:
```json
{ "quote": { "transaction_reference": "08POC342598033X", "payment_type": "P2P",
  "proposals": { "proposal": [ {
    "id": "pen-4000000044472562338287758",
    "charged_amount":   { "amount": "110.41", "currency": "USD" },
    "principal_amount": { "amount": "105.15", "currency": "USD" },
    "expiration_date": "2026-06-11T00:42:08-05:00",
    "quote_fx_rate": "777" } ] } } }
```

### POST /crossborder/payments

Тело — JSON-объект. Доп. заголовок **`Idempotency-Key`** (опц., рекоменд.):
тот же ключ → тот же результат, без повторного вызова MC (защита от двойных
списаний при ретрае). Ключ: до 128 символов из `[A-Za-z0-9._-:]`.
Бэкстоп на стороне MC — `transaction_reference`.

### Семантика ответов (как gateway разворачивает MC)

| Что вернул Mastercard | Что отдаёт мерчанту |
|---|---|
| 2xx | данные (расшифрованные, если были зашифрованы) |
| бизнес-4xx (`400/404/409/422/429`) | **проброс** статуса и тела MC как есть |
| `401/403` (наши креды) / `5xx` / не-JSON | `502` без деталей наружу (детали — в лог) |
| сетевая ошибка / сбой расшифровки | `502` |

Пример проброшенной ошибки MC (HTTP 400):
```json
{ "Errors": { "Error": { "Source": "transaction_reference",
  "ReasonCode": "DECLINE", "Description": "Duplicate Transaction Reference Number" } } }
```
Локальные ошибки валидации (gateway, до MC): `400` с английским сообщением,
напр. `{"message":"Quote body must be a JSON object","statusCode":400}`.

---

## Admin API (оператор платформы)

Группа `/admin/*`. Auth — `X-Admin-Token`. Управление партнёрами и их доступом.

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/admin/tenants` | Список партнёров (без `secretRef`, со `status`) |
| `GET` | `/admin/tenants/:id` | Один партнёр |
| `POST` | `/admin/tenants` | Создать партнёра (старт в `PENDING`) |
| `POST` | `/admin/tenants/:id/approve/platform` | Одобрение со стороны платформы |
| `POST` | `/admin/tenants/:id/approve/mastercard` | Одобрение со стороны Mastercard |
| `POST` | `/admin/tenants/:id/suspend` | Заблокировать (перекрывает одобрения) |
| `POST` | `/admin/tenants/:id/unsuspend` | Снять блокировку |
| `POST` | `/admin/tenants/:id/clients` | Выпустить OAuth-клиента партнёру |
| `DELETE` | `/admin/clients/:clientId` | Отозвать OAuth-клиента |
| `GET` | `/admin/audit` | Журнал операций (последние 200) |

Партнёр становится `ACTIVE` (транзакции разрешены) только при **обоих**
одобрениях и без блокировки.

### POST /admin/tenants — тело (`CreateTenantDto`)

| Поле | Правило |
|---|---|
| `name` | строка, ≤120, обязательно |
| `credentialMode` | `PLATFORM` \| `OWN`, обязательно |
| `id` | строка, ≤64, опц. (иначе генерируется `t_…`) |
| `partnerId` | строка, ≤128, опц. |
| `secretRef` | строка, ≤256; для `OWN` обязателен |

### POST /admin/tenants/:id/clients — ответ

```json
{ "clientId": "mc_RPVCa4sGrL2O", "clientSecret": "<32 символа>",
  "note": "client_secret показан один раз — сохраните его сейчас" }
```
**`clientSecret` показывается ОДИН раз** (в БД — только хэш).

---

## Webhooks (входящие от Mastercard)

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/webhooks/mastercard` | Приём push-уведомлений (статусы транзакций и т.п.) |

- **Аутентификация:** in-service fail-closed токен (`X-Webhook-Token`), обязателен в prod и dev.
  **Авторитетная аутентичность push-уведомлений у Mastercard — это mTLS, а НЕ подпись тела
  (JWS/HMAC)** — это выяснено по официальной доке MC (`api-mastercard.md`, разделы *FX Rate
  Push* и *Status Change Push*). То есть отдельной подписи payload, которую можно было бы
  проверять в коде, у MC нет: `WebhookSignatureVerifier` остаётся каркасом (Noop) на случай,
  если MC когда-нибудь её добавит. mTLS настраивается на слое TLS-терминации (ингресс/приложение),
  а наш `X-Webhook-Token` — дополнительный shared-secret фактор поверх него.

  > **Требование Mastercard (дословно, `api-mastercard.md`):**
  > *“Contact your mastercard representative for mTLS push notification mastercard public
  > certificate. This certificate needs to be trusted by the receiving application. Also, please
  > share the server certificate chain for validation (via KMP portal), if those are accepted on
  > mastercard infrastructure.”*

  **Что нужно сделать при деплое (когда получим cert):** запросить у представителя Mastercard
  публичный mTLS-сертификат push-уведомлений → добавить его в trust store принимающего
  приложения/ингресса; передать наш серверный cert-chain через **KMP-портал**. До этого приём
  держится на fail-closed `X-Webhook-Token`. ⚠️ Учесть: MC **не знает** наш `X-Webhook-Token` и
  не пришлёт его — токен должен инжектиться TLS-терминирующим слоем после проверки mTLS либо
  настраиваться кастомным заголовком в Push-конфиге портала MC (подтвердить у MC).
- **Всегда отвечает `200`** (иначе MC ретраит).
- **Дедуп** по `eventRef` (MC ретраит до 3 раз): повтор → `{"status":"duplicate"}`,
  иначе `{"status":"accepted"}`.
- **Персист статусов:** `STATUS_CHG` / `QUOTE_STATUS_CHG` сохраняются в таблицу `tx_status`
  одним `INSERT … ON CONFLICT (eventRef) DO NOTHING` — дедуп И запись **атомарны** (нет окна
  «краш между пометкой дедупа и записью»). Прочие типы (Carded Rate Push `CARDFX_PUB`, RFI и
  т.п.) — дедуп через KV + лог (бизнес-обработка по мере надобности).
- **Нотации:** MC шлёт поля и в camelCase (`eventRef`/`eventType`/…), и в snake_case
  (`event_ref`/`event_type`/…) — хендлер нормализует обе (иначе snake-события терялись бы).
- **Атрибуция тенанту:** OWN-тенант — по `partnerId` (→ его `tenantId`); PLATFORM/неизвестный
  `partnerId` (общий) → общий пул (`tenantId = NULL`).
- **Доставка мерчанту:** polling через `GET /crossborder/status-events?ref=<transaction_reference>`
  (tenant-scoped: OWN видит строго свои события, PLATFORM — свои + общий пул по ref).
- **Зашифрованный push** (`{ encrypted_payload: { data } }`): детектируется и подтверждается
  `200` **без обработки** — декрипт требует Client-ключ + per-tenant seam (MTF/Prod; в sandbox
  push «Not Applicable»).

---

## Служебное

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/health` | **Liveness** (k8s): процесс жив → `200 {"status":"ok"}`. Без auth. |
| `GET` | `/ready` | **Readiness** (k8s): готов обслуживать (пинг Postgres) → `200`/`503`. Без auth. |
| `GET` | `/api-docs` | Swagger UI (выключен в production без `SWAGGER_ENABLED`) |

---

## Сводка rate-limit

| Группа | Лимит | Ключ |
|---|---|---|
| `/crossborder/*` | 120 / мин | `tenantId` (fail-closed) |
| `/oauth/token` | 10 / мин | `client_id` (не обходится ротацией IP) |
| `/admin/*` | 120 / мин | IP |

Rate-limiting — самодостаточный per-pod `@nestjs/throttler` (корректность не зависит от ингресса); лимит на ингрессе, если есть — опциональная доп. защита, не authoritative. Превышение → `429`.
