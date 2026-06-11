# API — Mastercard Cross-Border Gateway

Справочник по всем HTTP-эндпоинтам сервиса. Связанные документы:
[documentation.md](./documentation.md) (сущности), [tests.md](./tests.md)
(примеры вызовов), [architecture.md](./architecture.md) (дизайн).

- **Базовый URL (dev):** `http://localhost:3000`
- **Формат:** JSON (OAuth-токен — также `application/x-www-form-urlencoded`).
- **Интерактивная схема:** `GET /api-docs` (Swagger; в проде выключен без `SWAGGER_ENABLED`).

---

## Аутентификация

Четыре независимых способа — у каждой группы эндпоинтов свой:

| Заголовок / способ | Кто | Где применяется |
|---|---|---|
| `Authorization: Bearer <JWT>` | **внешний мерчант** (партнёр) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | **внутренний** сервис/UI платформы | `/crossborder/*` |
| `X-Admin-Token` | **оператор платформы** | `/admin/*` |
| mTLS на ингрессе (dev: `X-Webhook-Token`) | **Mastercard** | `/webhooks/*` |
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
| `GET` | `/crossborder/rates` | Доступные FX-курсы | `GET …/crossborder/rates` |
| `POST` | `/crossborder/quotes` | Запросить котировку (цена/курс перевода) | `POST …/crossborder/quotes` |
| `POST` | `/crossborder/quotes/confirmations` | Подтвердить котировку | `POST …/crossborder/quotes/confirmations` |
| `POST` | `/crossborder/payments` | Инициировать платёж | `POST …/crossborder/payment` |
| `GET` | `/crossborder/payments/:id` | Статус платежа по id | `GET …/crossborder/{id}` |
| `GET` | `/crossborder/payments?ref=…` | Статус платежа по transaction reference | `GET …/crossborder?ref=…` |
| `POST` | `/crossborder/payments/:id/cancel` | Отмена платежа | `POST …/crossborder/{id}/cancel` |

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

- **Аутентификация:** в проде — **mTLS на ингрессе**; dev — `X-Webhook-Token`.
- **Всегда отвечает `200`** (иначе MC ретраит).
- **Дедуп** по `eventRef` (MC ретраит до 3 раз): повтор → `{"status":"duplicate"}`,
  иначе `{"status":"accepted"}`.

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

Внутренний throttler — per-pod (best-effort); авторитетный лимит — на ингрессе.
Превышение → `429`.
