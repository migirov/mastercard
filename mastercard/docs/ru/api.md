# API — Mastercard Cross-Border Gateway

Справочник по всем HTTP-эндпоинтам шлюза, по одному разделу на эндпоинт. Связанные
документы: [documentation.md](./documentation.md) (сущности/архитектура данных),
[architecture.md](./architecture.md) (дизайн),
[api-mastercard.md](./api-mastercard.md) (исходная дока Mastercard).

- **Базовый URL (dev):** `http://localhost:3000`
- **Формат:** JSON (у `POST /oauth/token` — также `application/x-www-form-urlencoded`).
- **Интерактивная схема:** `GET /api-docs` (Swagger; в проде выключен без `SWAGGER_ENABLED`).
  Это **авто-схема из декораторов**; первоисточник для людей — данный файл.

## Как читать раздел эндпоинта

У каждого эндпоинта единый шаблон: **Назначение** · **Метод/путь** · **Upstream MC**
(куда шлюз ходит в Mastercard) · **Auth** · **Шифрование (FLE)** · **Параметры/тело**
· **Ответ** (с реальным примером из sandbox, где есть) · **Особенности/sandbox**.

Общие для всех правила — в разделе [«Сквозные правила»](#сквозные-правила); не
повторяются в каждом эндпоинте.

---

## Карта покрытия Mastercard API Reference

15 групп Mastercard Cross-Border **API Reference** → наши маршруты. ✅ реализовано ·
⚠️ внешний лимит sandbox. Детали — в разделах ниже.

| # | Mastercard API | Наш маршрут | Sandbox |
|---|---|---|---|
| 1 | Quotes | `POST /crossborder/quotes` | ✅ реальный proposal |
| 2 | Quote Confirmation (×3) | `POST /quotes/confirmations`, `/quotes/cancellations`, `GET /quotes/:ref/proposals/:id` | ✅ |
| 3 | Carded Rate Pull + Push | `GET /crossborder/rates` (+ push-вебхук) | ⚠️ нет sandbox-данных у MC |
| 4 | Payment | `POST /crossborder/payments` | ✅ (полный успех требует KYC-флоу) |
| 5 | Address Validation | `POST /crossborder/address-validations` | ✅ FLE → `VALID/VERIFIED` |
| 6 | Account Validation (×3) | `POST /account-validations`, `/bank-lookups`, `/iban-generations` | ✅ FLE → реальные данные |
| 7 | Cash Pickup Locations | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | ✅ |
| 8 | Endpoint Guide | `GET /crossborder/endpoint-guide/specifications` | ⚠️ HTML-500 (корридор после онбординга) |
| 9 | Status Change Push | `POST /webhooks/mastercard/webhook` → `GET /crossborder/status-events` | ✅ |
| 10 | Retrieve Payment | `GET /crossborder/payments/:id` · `?ref=` | ✅ |
| 11 | RFI (×4) | `GET/POST /rfi/requests/:id`, `POST /rfi/documents`, `GET /rfi/documents/:id` | ⚠️ `050007` (RFI не включён проекту) |
| 12 | Cancel Payment | `POST /crossborder/payments/:id/cancel` | ✅ |
| 13 | Balance | `GET /crossborder/balances` | ✅ реальные балансы |
| 14 | Payload Encryption | `EncryptionService` (axios-интерцептор) | ✅ FLE работает на sandbox |
| 15 | Push Notifications | `POST /webhooks/mastercard/webhook` (+ `tx_status`) | ✅ |

> **Покрытие тестами:** у каждой операции выше есть **request-shape юнит-тест**
> (метод/путь/заголовки/тело против спеки MC, сверка с централизованным `mc-paths`). Для операций,
> которых нет в sandbox (Carded Rate, Account Validation, Endpoint Guide, RFI — строки ⚠️), этот
> юнит-тест — единственная авто-проверка; остальные ещё гоняются live-e2e на sandbox.

> «Reference Application» в сайдбаре MC — это пример-приложение, не API; реализовывать нечего.

---

## Сквозные правила

### Аутентификация — 4 независимых способа

| Заголовок / способ | Кто | Где |
|---|---|---|
| `Authorization: Bearer <JWT>` | внешний мерчант (партнёр) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | внутренний сервис/UI платформы | `/crossborder/*` |
| `X-Admin-Token` | оператор платформы | `/admin/*` |
| in-app **mTLS** клиентский cert (авторитетно; MC не шлёт токен) — `X-Webhook-Token` опциональный dev/вторичный фактор | Mastercard | `/webhooks/*` |
| — (публичный) | любой с `client_id`/`secret` | `/oauth/token` |

**`tenantId` НИКОГДА не берётся из тела/query** — только из аутентификации (JWT внешнего
мерчанта или `X-Tenant-Id` внутреннего вызова). Все `/crossborder/*` доступны **только
активному тенанту** (двойное одобрение, иначе `403`).

### Семантика ответов (как шлюз разворачивает ответ Mastercard)

| Что вернул Mastercard | Что отдаёт мерчанту |
|---|---|
| `2xx` | данные (расшифрованные, если были зашифрованы) |
| бизнес-`4xx` (`400/404/409/422/429`) c JSON-объектом | **проброс** статуса и тела MC как есть (под ключом `upstream`) |
| `401/403` (наши креды) / `5xx` / не-объектное тело | `502` без деталей наружу (детали — в лог) |
| сетевая ошибка / сбой расшифровки | `502` |

Пример проброшенной бизнес-ошибки MC (`400`):
```json
{ "error": "Upstream Error", "message": "Mastercard returned an error",
  "upstream": { "Errors": { "Error": [ {
    "Source": "transaction_reference", "ReasonCode": "DECLINE",
    "Description": "Duplicate Transaction Reference Number" } ] } } }
```
Локальные ошибки валидации (шлюз, до MC) — `400` с английским сообщением, напр.
`{"statusCode":400,"message":"Invalid UUID identifier"}`.

### Шифрование (FLE — field-level encryption)

JWE (RSA-OAEP-256 + A256GCM), реализован как **axios-интерцептор внутри `MastercardClient`**
(не NestJS-интерцептор), на каждый исходящий вызов MC. Управляется глобальным тумблером
`MC_ENCRYPTION_ENABLED`:
- **запрос:** при включённом тумблере **всё непустое тело** оборачивается в
  `{ encrypted_payload: { data: <JWE> } }` и затем подписывается OAuth1 **по зашифрованному
  телу**. Шифруем **Client Encryption Key** (публичный cert MC; приватный у MC).
- **ответ:** расшифровываем нашим **Mastercard Encryption private key**, если MC прислал
  `encrypted_payload.data`.
- **FLE работает на sandbox** (подтверждено вживую 2026-06-16). Раньше считали «sandbox не
  поддерживает FLE» — это была ошибка выбора ключа (`082000 Crypto Key`). Детали ключей — в
  `production-questions.md`.
- На практике: **POST с телом** (quotes/validations/bank-lookup/iban/payment/confirm/RFI
  update/upload) — тело шифруется; **GET-каталоги** (balances/rates/cash-pickup/endpoint-guide/
  RFI retrieve/download) тела не шлют — шифровать нечего. Per-tenant ключи (OWN со своими)
  подключены — `EncryptionService` строит per-tenant `JweEncryption` по fingerprint; живая
  кросс-тенант проверка на реальных ключах остаётся на MTF.

### Валидация на границе (pipes)

| Pipe | Что проверяет | Где |
|---|---|---|
| `SafeIdPipe` | непустая строка без `/`,`\`,пробелов,`..` (анти path-traversal) | id/ref в пути MC |
| `UuidParamPipe` | строгий RFC-4122 UUID (v1–5 + variant) | RFI `request_id`/`document_id` |
| `StringQueryPipe` | опц.; отвергает не-строку (дубль-ключи query) | query-параметры каталогов |
| `gatewayValidationPipe(Passthrough)` | мягкая: валидирует объявленные поля, НЕ режет неизвестные, НЕ коэрсит типы (суммы MC — строки) | тела к MC |
| `gatewayValidationPipe(Strict)` | строгая: `whitelist`+`forbidNonWhitelisted`+`transform` | admin/oauth тела |

Глобального `ValidationPipe` НЕТ — каждый контроллер объявляет нужный пресет одной общей
стратегии валидации (чтобы строгая
валидация наших границ не резала passthrough-поля MC). Тела к MC — `helmet`, лимит JSON
**256 kb** (исключение — RFI upload, см. ниже).

---

# Cross-Border API (бизнес-операции мерчанта)

Группа `/crossborder/*`. Auth — `TenantAuthGuard` (Bearer JWT **или** `X-Internal-Token` +
`X-Tenant-Id`). Только активному тенанту. Rate-limit **120/мин на тенанта**. Каждый запрос
подписывается OAuth1 ключами тенанта; тело (если есть) шифруется JWE — прозрачно.
`partner-id` подставляется из credentials тенанта (не из запроса).

### Типичный поток перевода
```
1. POST /crossborder/quotes               → предложение (proposal) с ценой/курсом
2. POST /crossborder/quotes/confirmations → подтвердить выбранное предложение
3. POST /crossborder/payments             → инициировать платёж (идемпотентность по transaction_reference)
4. GET  /crossborder/payments/:id         → опрашивать статус (или ждать вебхук)
```

## Котировки и платежи

### POST /crossborder/quotes
**Назначение.** Запросить котировку (цена/курс перевода). · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/quotes` · **Auth:** tenant · **FLE:** да · **Код:** `200` (`@HttpCode(200)` — вычисление, не создание ресурса).

Тело — `QuoteRequestDto` (passthrough; неизвестные поля MC сохраняются). Критичные поля
валидируются как строки (суммы MC — строки, не числа):
```json
{ "quoterequest": {
  "transaction_reference": "08POC342598033X",
  "sender_account_uri": "tel:+25406005",
  "recipient_account_uri": "tel:+254069832",
  "payment_amount": { "amount": "105.15", "currency": "USD" },
  "payment_origination_country": "USA",
  "payment_type": "P2P",
  "quote_type": { "forward": { "receiver_currency": "GBP" } } } }
```
Ответ `200` — реальное предложение MC:
```json
{ "quote": { "transaction_reference": "08POC342598033X", "payment_type": "P2P",
  "proposals": { "proposal": [ {
    "id": "pen-4000000044472562338287758",
    "charged_amount":   { "amount": "110.41", "currency": "USD" },
    "principal_amount": { "amount": "105.15", "currency": "USD" },
    "expiration_date": "2026-06-11T00:42:08-05:00",
    "quote_fx_rate": "777" } ] } } }
```

### POST /crossborder/quotes/confirmations
**Назначение.** Подтвердить выбранное предложение котировки. · **Upstream:** `POST /send/partners/{pid}/crossborder/quotes/confirmations` · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `ConfirmationRequestDto` (passthrough): `transactionReference?`, `proposalId?` (обе строки).

### POST /crossborder/quotes/cancellations
**Назначение.** Отменить подтверждённую котировку (возврат резерва). · **Upstream:** `POST /send/partners/{pid}/crossborder/quotes/cancellations` · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `ConfirmationRequestDto` (как у confirmations).

### GET /crossborder/quotes/:transactionReference/proposals/:proposalId
**Назначение.** Просмотр подтверждённой котировки. · **Upstream:** `GET /send/partners/{pid}/crossborder/quotes/{ref}/proposals/{proposalId}` · **Auth:** tenant · **FLE:** нет тела.

Параметры пути `transactionReference`, `proposalId` — оба `SafeIdPipe`.

### POST /crossborder/payments
**Назначение.** Инициировать платёж. · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/payment` · **Auth:** tenant · **FLE:** да · **Код:** `201` (создание ресурса).

Тело — `PaymentRequestDto` (passthrough, обёртка `paymentrequest`, суммы — строки).
**Идемпотентность — по `transaction_reference`** (обязательное поле тела), источник истины —
**Postgres** (`payment_idempotency`, `UNIQUE(tenantId, idemKey)`; отдельного KV-слоя нет):
ретрай с тем же `transaction_reference` → тот же результат без повторного вызова MC (защита
от двойного списания); запрос «в обработке» → `409`; тот же ref с ДРУГИМ телом (fingerprint) →
`422`. Ключ хешируется (`idemKey = txref:sha256(ref)`). Заголовка `Idempotency-Key` нет.
Готовые записи постоянны (один `transaction_reference` = один платёж навсегда).

### GET /crossborder/payments/:id
**Назначение.** Статус платежа по id. · **Upstream:** `GET /send/v1/partners/{pid}/crossborder/{id}` · **Auth:** tenant · **FLE:** нет тела. Параметр `id` — `SafeIdPipe`.

### GET /crossborder/payments?ref=…
**Назначение.** Статус платежа по `transaction_reference`. · **Upstream:** `GET /send/v1/partners/{pid}/crossborder?ref={ref}` · **Auth:** tenant. Query `ref` (обязателен) — `SafeIdPipe`. Это lookup, не список.

### POST /crossborder/payments/:id/cancel
**Назначение.** Отмена платежа. · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/{id}/cancel` · **Auth:** tenant · **FLE:** тело не шлётся · **Код:** `200`. Параметр `id` — `SafeIdPipe`.

### GET /crossborder/status-events?ref=…
**Назначение.** Сохранённые push-статусы по `transaction_reference`. · **Upstream:** **нет вызова MC** — локальное чтение из таблицы `tx_status`. · **Auth:** tenant. Query `ref` (обязателен) — `SafeIdPipe`.

Tenant-scoped: OWN видит строго свои события; PLATFORM — свои + общий пул по ref. Ответ —
массив `StatusEventViewDto`: `transactionReference`, `eventType`, `transactionType`, `status`,
`stage`, `receivedAt`, `payload` (внутренние `id`/`tenantId` не отдаются).

## Курсы

### GET /crossborder/rates
**Назначение.** Carded / FX Rate Pull (курсы коридоров, операция MC `getFxRates`). · **Upstream:** `GET /send/v1/partners/{pid}/crossborder/rates` (без тела) · **Auth:** tenant · **FLE:** нет тела.

⚠️ **MC не предоставляет sandbox-данные для Carded Rate** → реального ответа в sandbox не
получить; e2e проверяет лишь, что шлюз не падает и форвардит. На sandbox приходит `{"rates":{}}`.
Push-вариант — вебхук (`CARDFX_PUB`) на общий `/webhooks/mastercard/webhook`. Проверится вживую в
MTF/Prod на сконфигурированном коридоре.

## Валидация / Lookup (FLE)

Все 4 — `POST` с шифруемым телом, возвращают **реальные данные** на sandbox (FLE работает).
Документированные sandbox тест-кейсы (фикс. адреса/IBAN/BIC/BAN) — в `api-mastercard.md`.

### POST /crossborder/address-validations
**Назначение.** Валидация и нормализация адреса. · **Upstream:** `POST /send/address-validation-service/addresses/validations` (отдельная база, без partner-id в пути) · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `AddressValidationRequestDto` (`country`, `address` — обязательны):
```json
{ "country": "USA", "address": "4 CLARK STREET, EVERETT, MA, 02149" }
```
Ответ `200` (реальный sandbox):
```json
{ "status": "VALID", "verification": "VERIFIED",
  "addressMatch": { "address": "4 Clark St,Everett MA 02149-2015",
    "line1": "4 Clark St", "country": "USA", "countrySubdivision": "MA",
    "city": "Everett", "streetName": "Clark St", "buildingNumber": "4",
    "postalCode": "02149-2015" } }
```

### POST /crossborder/account-validations
**Назначение.** Валидация счёта получателя (IBAN/BAN) + данные банка. · **Upstream:** `POST /send/partners/{pid}/crossborder/accounts/validations` · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `AccountValidationRequestDto`: `accountUri` (обязателен, `{type,value}`), `requestType?`
(`CES`|`ASV`; ASV-тип в sandbox — N/A):
```json
{ "accountUri": { "type": "IBAN", "value": "FR070331234567890123456" } }
```
Ответ `200` (реальный sandbox):
```json
{ "status": "SUCCESS", "message": "Valid IBAN Structure",
  "accountMatch": { "accounts": { "account": [
      { "type": "IBAN", "value": "FR070331234567890123456" },
      { "type": "BAN",  "value": "30007999990424173200040" } ] },
    "bank": { "bic": { "type": "SWIFT BIC", "value": "NATXFRPP" },
      "name": "Natixis", "branchCode": "3000799999",
      "address": { "city": "Paris", "postalCode": "75013", "country": "FRA" } } } }
```

### POST /crossborder/bank-lookups
**Назначение.** Поиск банка по имени/стране/BIC. · **Upstream:** `POST /send/partners/{pid}/crossborder/banks/details` · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `BankLookupRequestDto` (обёртка `bank`, обязательна):
```json
{ "bank": { "name": "*of Africa United Kingdom*SUC20004", "country": "GBR",
            "bic": { "type": null, "value": null } } }
```
Ответ `200` (реальный sandbox): `{ "bankInfo": { "total": "4", "banks": { "bankData": [ … ] } } }`
с массивом банков (BIC, имя, филиал, адрес, sanctionDetails).

### POST /crossborder/iban-generations
**Назначение.** Сгенерировать IBAN из BAN/реквизитов. · **Upstream:** `POST /send/partners/{pid}/crossborder/accounts/generate-ibans` · **Auth:** tenant · **FLE:** да · **Код:** `200`.

Тело — `IbanGenerationRequestDto` (поля опциональны: `accountUri?`, `country?`, `branchCode?`, `accountNo?`):
```json
{ "accountUri": { "type": "ban", "value": "20041010050500013M02606" },
  "country": "FRA", "branchCode": "2004101005", "accountNo": "0500013026" }
```
Ответ `200` (реальный sandbox):
```json
{ "ibanDetails": { "accounts": { "account": [
      { "type": "IBAN", "value": "FR1420041010050500013M02606" },
      { "type": "BAN",  "value": "20041010050500013M02606" } ] },
    "bank": { "bic": { "value": "PSSTFRPPLIL" }, "name": "La Banque Postale",
      "branchCode": "2004101005", "address": { "city": "Lille", "country": "FRA" } } } }
```

## Cash Pickup Locations

Каталоги точек выдачи наличных. · **Upstream:** `GET /crossborder/cash-pickup/{type}{?query}` (без
`/send`, **partner-id в ЗАГОЛОВКЕ** `partner-id`) · **Auth:** tenant · **FLE:** нет тела. Все query-параметры — `StringQueryPipe` (опциональны).

| Маршрут | Query |
|---|---|
| `GET /crossborder/cash-pickup/countries` | `cash_pickup_type?` |
| `GET /crossborder/cash-pickup/cities` | `country?`, `currency?`, `offset?`, `limit?` |
| `GET /crossborder/cash-pickup/providers` | `country?`, `currency?`, `cash_pickup_type?`, `offset?`, `limit?` |
| `GET /crossborder/cash-pickup/branches` | `provider_id?`, `state?`, `city?`, `offset?`, `limit?` |

Ответ `countries` (реальный sandbox): `[{"items":[{"countryAlpha3":"NGA","currency":"NGN","cashPickupType":"PANY"}, … ]}]`.

## Endpoint Guide

### GET /crossborder/endpoint-guide/specifications
**Назначение.** Правила/требования коридора (поля, лимиты). · **Upstream:** `GET /crossborder/endpoint-guide/specifications{?query}` (partner-id в заголовке) · **Auth:** tenant · **FLE:** нет тела. Query (`StringQueryPipe`): `payment_type?`, `destination_country?`, `destination_currency?`, `destination_payment_instrument?`.

⚠️ **Sandbox** для generic partner-id отдаёт **HTML-страницу 500** (Tomcat) — корридор-спецификации
доступны только после онбординга партнёра. Шлюз корректно прячет HTML-5xx и отдаёт `502`.
Проверится вживую в MTF/Prod на онбордженном partner-id.

## RFI (Request For Information)

Все 4 операции реализованы. **`request_id`/`document_id` обязаны быть валидными RFC-4122 UUID**
(`UuidParamPipe`) — невалидный (напр. демо `33000000-0000-0000-0000-000000000000` с нулевыми
ниблами версии/варианта) отсекается **локальным `400`** до вызова MC.

> ⚠️ **Sandbox-лимит (разобрано 2026-06-16).** С валидным UUID запрос доходит до MC, но тот
> отвечает **`401 AUTHORIZATION_FAILED`** (код `050007`, «Unauthorized Access») → шлюз
> маскирует в `502`. Это **авторизация уровня API**: проект/consumer-key не имеет доступа к
> RFI API (те же креды работают на balances/quotes/validations). RFI — opt-in API, его надо
> **включить проекту на портале Mastercard Developers** (или через представителя). Код шлюза
> готов и заработает сразу после включения.

### GET /crossborder/rfi/requests/:requestId
**Назначение.** Получить состояние RFI-запроса. · **Upstream:** `GET /send/partners/{pid}/crossborder/rfi/requests/{requestId}` · **Auth:** tenant · **FLE:** нет тела. Параметр `requestId` — `UuidParamPipe` (+ `@ApiParam format:uuid`).

### POST /crossborder/rfi/requests/:requestId
**Назначение.** Отправить ответ Customer на RFI. · **Upstream:** тот же путь, POST · **Auth:** tenant · **FLE:** да · **Код:** `200`. Параметр `requestId` — `UuidParamPipe`. Тело — `RfiUpdateRequestDto` (обёртка `updateRequest`, passthrough).

### POST /crossborder/rfi/documents
**Назначение.** Загрузить документ к RFI (base64 в JSON, не multipart). · **Upstream:** `POST /send/partners/{pid}/crossborder/rfi/documents` · **Auth:** tenant · **FLE:** да. Тело — `RfiDocumentUploadRequestDto` (обёртка `uploadDocumentRequest` = `{fileName, file}`).

**Особенность:** на этот маршрут (только POST) задан **route-scoped лимит тела 2 MB**
(глобальный 256 kb для всех прочих сохранён) — base64-файл до ~1 MB проходит парсер (НЕ 413).

### GET /crossborder/rfi/documents/:documentId
**Назначение.** Скачать документ RFI. · **Upstream:** `GET /send/partners/{pid}/crossborder/rfi/documents/{documentId}` · **Auth:** tenant · **FLE:** нет тела. Параметр `documentId` — `UuidParamPipe`.

---

# Webhooks (входящие от Mastercard)

### POST /webhooks/mastercard/webhook
**Назначение.** Приём push-уведомлений MC (статусы транзакций/котировок, Carded Rate Push, RFI и т.п.). · **Upstream:** нет (приёмник) · **Auth:** `WebhookAuthGuard` · **Код:** **всегда `200`** (иначе MC ретраит). Rate-limit 1200/мин (per-pod). Тело — `McWebhookEventDto` (passthrough, поля с `@MaxLength`-капами).

- **Аутентификация:** решается **в приложении**, не на ингрессе. **MC аутентифицирует push
  только клиентским сертификатом (mTLS), а НЕ подписью тела** и не шлёт токен/заголовок (MC docs
  §"Push Notification Setup"). При `webhookMtlsEnabled` `WebhookAuthGuard` валидирует cert MC в
  приложении (доверенная цепочка `socket.authorized` + allowlist subject-CN
  `CrossborderServicesNotification-{env}.mastercard.com`); TLS терминирует приложение
  (`requestCert`), ингресс — L4 passthrough. Fail-closed `X-Webhook-Token` — опциональный
  dev/вторичный фактор (когда in-app TLS выключен).
  > **Дословно (`api-mastercard.md`):** *“Contact your mastercard representative for mTLS push
  > notification mastercard public certificate. This certificate needs to be trusted by the
  > receiving application. Also, please share the server certificate chain for validation (via
  > KMP portal)…”*
  > **При деплое:** получить публичный mTLS-cert push у представителя MC → в trust store
  > приёмника; передать наш cert-chain через **KMP-портал**. ⚠️ MC **не знает** наш
  > `X-Webhook-Token` — его инжектит TLS-слой после mTLS либо кастомный заголовок в Push-конфиге
  > портала (подтвердить у MC).
- **Дедуп** по `eventRef` в **Postgres** (отдельного KV-слоя нет; MC ретраит до 3 раз):
  повтор → `{"status":"duplicate"}`, иначе `{"status":"accepted"}`.
- **Персист в `tx_status`** одним `INSERT … ON CONFLICT (eventRef) DO NOTHING` (дедуп И запись
  **атомарны**) — для ВСЕХ событий: `STATUS_CHG`/`QUOTE_STATUS_CHG` несут status/stage и читаются
  мерчантом; прочие (`CARDFX_PUB`, RFI…) лежат для дедупа+аудита (из статус-выдачи отфильтрованы).
- **Нотации:** MC шлёт поля в camelCase и snake_case — хендлер нормализует обе.
- **Атрибуция тенанту:** OWN — по `partnerId` (→ его `tenantId`); PLATFORM/неизвестный → общий пул (`tenantId=NULL`).
- **Доставка мерчанту:** polling через `GET /crossborder/status-events?ref=…`.
- **Зашифрованный push** (`{encrypted_payload:{data}}`): **декриптится по `kid`** из открытого
  JOSE-заголовка JWE (PLATFORM / per-tenant ключ); расшифрованное событие обрабатывается как
  обычное. Что не расшифровать (нет ключа под `kid`, FLE off) — сырой конверт **персистится в
  `tx_status` (`eventType='ENCRYPTED'`) ДО `200`** — иначе после ack событие терялось бы (MC не
  ретраит). Дедуп по `enc:sha256(шифротекста)` (или внешнему ref, если есть), обработка позже из
  БД. Живое подтверждение — на MTF; в sandbox push «Not Applicable».

---

# Admin API (оператор платформы)

Группа `/admin/*`. Auth — `X-Admin-Token` (`AdminAuthGuard`). Тела — **строгая** валидация
(`gatewayValidationPipe(Strict)`). `secretRef` никогда не отдаётся наружу (`ClassSerializerInterceptor`).
Rate-limit 120/мин по IP. Вызовов в Mastercard нет.

| Метод | Путь | Что делает | Код |
|---|---|---|---|
| `GET` | `/admin/audit` | Журнал операций (последние 200) | 200 |
| `GET` | `/admin/tenants` | Список партнёров (`TenantViewDto[]`, без `secretRef`) | 200 |
| `GET` | `/admin/tenants/:id` | Один партнёр (`SafeIdPipe`) | 200 |
| `POST` | `/admin/tenants` | Создать партнёра (старт в `PENDING`) | 201 |
| `POST` | `/admin/tenants/:id/approve/platform` | Одобрение платформой | 200 |
| `POST` | `/admin/tenants/:id/approve/mastercard` | Одобрение Mastercard | 200 |
| `POST` | `/admin/tenants/:id/suspend` | Заблокировать (перекрывает одобрения) | 200 |
| `POST` | `/admin/tenants/:id/unsuspend` | Снять блокировку | 200 |
| `POST` | `/admin/tenants/:id/clients` | Выпустить OAuth-клиента | 201 |
| `DELETE` | `/admin/clients/:clientId` | Отозвать клиента (404 если нет) | 200 |

Партнёр становится `ACTIVE` (транзакции разрешены) только при **обоих** одобрениях и без блокировки.

### POST /admin/tenants — тело (`CreateTenantDto`, строгая валидация)
| Поле | Правило |
|---|---|
| `name` | строка ≤120, обязательно |
| `credentialMode` | `PLATFORM` \| `OWN`, обязательно |
| `id` | строка ≤64, `[A-Za-z0-9._-]`, опц. (иначе генерируется `t_…`) |
| `partnerId` | строка ≤64, `[A-Za-z0-9._-]`, опц. |
| `secretRef` | строка ≤256, без `..`; **обязателен для `OWN`** (`@ValidateIf`) |

### POST /admin/tenants/:id/clients — ответ
```json
{ "clientId": "mc_RPVCa4sGrL2O", "clientSecret": "<32 символа>",
  "note": "client_secret показан один раз — сохраните его сейчас" }
```
**`clientSecret` показывается ОДИН раз** (в БД — только хэш).

---

# OAuth — выдача токена мерчанта

### POST /oauth/token
**Назначение.** Выдать JWT мерчанту (сам является точкой аутентификации). · **Upstream:** нет (локальный JWT) · **Auth:** публичный, защищён `OAuthThrottlerGuard` (**10/мин по `client_id`**, фолбэк на IP) · **Код:** `200` (RFC 6749), заголовки `Cache-Control: no-store`.

Тело (`form-urlencoded` или JSON), `TokenRequestDto` (строгая валидация), grant `client_credentials`:

| Поле | Описание |
|---|---|
| `grant_type` | всегда `client_credentials` (`@IsIn`) |
| `client_id` | выданный admin-API (`mc_…`) |
| `client_secret` | выданный admin-API (показывается один раз) |

`client_id`/`secret` можно передать и в `Authorization: Basic` (RFC 6749 §2.3.1). Ответ:
```json
{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 900 }
```
JWT живёт 15 мин (HS256, `tid` = tenantId). Ошибки: `400 unsupported_grant_type` / `400` (DTO),
`401 invalid_client`.

---

# Служебное

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/health` | **Liveness** (k8s): процесс жив → `200 {"status":"ok"}`. Без auth, без БД. |
| `GET` | `/ready` | **Readiness** (k8s): пинг Postgres → `200`/`503`. Без auth. |
| `GET` | `/api-docs` | Swagger UI (выключен в production без `SWAGGER_ENABLED`). |

---

# Сводка rate-limit

| Группа | Лимит | Ключ |
|---|---|---|
| `/crossborder/*` | 120 / мин | `tenantId` (fail-closed) |
| `/oauth/token` | 10 / мин | `client_id` (не обходится ротацией IP) |
| `/admin/*` | 120 / мин | IP |
| `/webhooks/*` | 1200 / мин | per-pod |

Rate-limiting — самодостаточный per-pod `@nestjs/throttler` (корректность не зависит от
ингресса); лимит на ингрессе, если есть — опциональная доп. защита. Превышение → `429`.
