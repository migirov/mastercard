# Mastercard API — что вживую, что демо, и почему

> 🇬🇧 English version: [../en/test.md](../en/test.md)

Главное различие: **наш gateway (`mastercard`) реализует все эти API, и они работают** — живая
валидация/балансы в демо идут *через* gateway (с field-level шифрованием и OAuth1). Демо
ограничивает **песочница Mastercard**, а не наш код.

Есть две причины, почему что-то отображается как `demo`, а не `live`:

## 1. Песочница Mastercard по разным API отдаёт разное

По одним API sandbox даёт реальные данные; по другим — заглушки, отклоняет запрос или вообще
недоступен (нужен доступ MTF/Prod). Это политика песочницы Mastercard, а не наш баг:

| API (gateway это умеет) | Что делает **sandbox** | Статус |
|---|---|---|
| **Валидация счёта** (IBAN) | реальный `SUCCESS` | 🟢 live |
| **Валидация адреса** | реальный `VALID` / `VERIFIED` | 🟢 live |
| **Балансы** | реальные балансы счетов | 🟢 live |
| **Bank lookup** | реальные данные банка | 🟢 live (Features → Bank Lookup) |
| **IBAN generation** | реальный сгенерированный IBAN | 🟢 live (Features → IBAN Generator) |
| **Cash pickup** | реальные каталоги точек | 🟢 live (Features → Cash Pickup) |
| **Quote (FX)** | HTTP 200, но **курс-заглушка (`777`)** | 🟡 структура реальная, данные фейк → нужен MTF/Prod |
| **Payment (отправка)** | запрос доходит до MC, но **отклоняется** (нет KYC/онбординга) | 🟡 нужен MTF/Prod |
| **Status push** | **«Not Applicable» на sandbox** (по докам MC) | 🔴 только MTF/Prod |
| **Carded Rate** | **«Sandbox unavailable» (по докам MC)** | 🔴 только MTF/Prod |
| **Endpoint Guide** | HTML **502** для общего partner-id | 🟡 нужен онбордённый partner-id |
| **RFI** | требует онбординга (ошибки `062000` / `401` / `050007`) | 🟡 нужен MTF/Prod |

То есть «остальные API не работают» — это **не так**: они работают в gateway, но **песочница
Mastercard** отдаёт фейк или отклоняет платежи/статусы/котировки, пока партнёра не онбордят.
**Получить доступ MTF/Prod — это ровно то, что вы просите в письме в Mastercard.** Как откроют —
переключатель `demo → live`, без правок кода.

## 2. Страницы Features — остальные API gateway, теперь выведены в UI

Экраны инвойс-фронта мапятся на **quote / validation / balances / pay / status**. Все
*остальные* cross-border API, которые реализует gateway, теперь выведены в группе **Features**
в сайдбаре — каждый как отдельный инструмент с бейджем **Live · Mastercard** / **Demo** на
каждый ответ (по полю `source` из BFF):

| Страница Features | API gateway | Sandbox сегодня |
|---|---|---|
| **Bank Lookup** | `POST /crossborder/bank-lookups` | 🟢 live — реальные банки / BIC / отделение |
| **IBAN Generator** | `POST /crossborder/iban-generations` | 🟢 live — реальный сгенерированный IBAN + банк |
| **Cash Pickup** | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | 🟢 live — реальные каталоги |
| **FX Rates** | `GET /crossborder/rates` | 🟡 demo — sandbox не отдаёт carded-rate |
| **Endpoint Guide** | `GET /crossborder/endpoint-guide/specifications` | 🟡 demo — sandbox 502 (нужен онбординг partner-id) |
| **Quote Lifecycle** | `POST /quotes/confirmations·cancellations`, `GET …/proposals/:id` | 🟡 demo — нужен поток подтверждённой котировки |
| **Payment Tracker** | `GET /payments?ref`, `POST /payments/:id/cancel`, `status-events` | 🟡 demo — выше sandbox |
| **RFI Center** | `GET/POST /crossborder/rfi/requests`, `POST /rfi/documents` | 🟡 demo — RFI не включён для проекта |

**3 живые страницы отдают РЕАЛЬНЫЕ данные песочницы Mastercard** через gateway (FLE + OAuth1);
**5 demo-страниц** синтезируют правдоподобные ответы и переключаются на live через env — как
pay/status — когда Mastercard их откроет. Каждая возможность переключается независимо
(переключатели ниже). Живой вызов автоматически откатывается в demo, если sandbox отклонил
запрос, — демо не ломается на показе.

## 3. Features API — примеры запросов (эндпоинты, которые мы добавили)

Страницы Features ходят в демо-BFF под `/features/*`. Можно дёргать напрямую по порту BFF
(`:4011`, mastercard-bff) или через прокси фронта (`http://localhost:8080/demo-api/features/*`). **Каждый ответ
несёт поле `source`** (`live` / `demo`). Сводка разводки — `GET http://localhost:4011/health`
(блок `features`).

```bash
curl -s http://localhost:4011/health        # → "features":{"bankLookup":"live", ... ,"rfi":"demo"}
```

### 🟢 Bank Lookup — `POST /features/bank-lookup` (live)
```bash
curl -s -X POST http://localhost:4011/features/bank-lookup \
  -H 'Content-Type: application/json' \
  -d '{"name":"*of Africa United Kingdom*SUC20004","country":"GBR"}'
# → {"banks":[{"name":"...","bic":"428773","branch":"East Bay Branch","country":"GBR",...}],
#    "total":4,"source":"live"}
```
Тело: `name` (MC принимает `*`-маски), `country` (ISO-3), `bic?` (опционально).

### 🟢 IBAN Generator — `POST /features/iban` (live)
```bash
curl -s -X POST http://localhost:4011/features/iban \
  -H 'Content-Type: application/json' \
  -d '{"country":"FRA","ban":"20041010050500013M02606","branchCode":"2004101005","accountNo":"0500013026"}'
# → {"iban":"FR1420041010050500013M02606","ban":"20041010050500013M02606",
#    "bank":{"bic":"PSSTFRPPLIL","name":"La Banque Postale","branchCode":"2004101005","address":"Lille, FRA"},
#    "source":"live"}
```
Тело: `country` (ISO-3, обязательно), `ban?`, `branchCode?`, `accountNo?`.

### 🟢 Cash Pickup — `GET /features/cash-pickup/{kind}` (live)
```bash
curl -s "http://localhost:4011/features/cash-pickup/countries?cash_pickup_type=PANY"
# → {"items":[{"countryAlpha3":"NGA","currency":"NGN","cashPickupType":"PANY"}, ...],"source":"live"}

curl -s "http://localhost:4011/features/cash-pickup/cities?country=GTM&currency=GTQ&limit=5"
# → {"items":[{"country":"GTM","currency":"GTQ","city":"...","stateName":"..."}],"total":361,"source":"live"}

curl -s "http://localhost:4011/features/cash-pickup/providers?country=ARE&currency=AED&cash_pickup_type=IN_NETWORK&limit=5"
# → {"items":[{"providerId":"...","providerName":"ORIENT EXCHANGE","country":"ARE","currency":"AED"}],"source":"live"}

# branches требует provider_id (возьми его из ответа providers выше):
curl -s "http://localhost:4011/features/cash-pickup/branches?provider_id=<providerId>&limit=5"
```
Query (всё опционально): countries → `cash_pickup_type`; cities → `country,currency,offset,limit`;
providers → `+cash_pickup_type`; branches → `provider_id,state,city,offset,limit`.

### 🟡 FX Rates — `GET /features/rates` (demo)
```bash
curl -s "http://localhost:4011/features/rates"
# → {"rates":[{"pair":"USD/ILS","rate":3.7,"change":0.01}, ...],"asOf":"...","source":"demo"}
curl -s "http://localhost:4011/features/rates?base=USD&quote=ILS"   # одна пара
```
Demo, потому что sandbox Mastercard не отдаёт carded-rate (`{"rates":{}}`).

### 🟡 Endpoint Guide — `GET /features/endpoint-guide` (demo)
```bash
curl -s "http://localhost:4011/features/endpoint-guide?payment_type=B2B&destination_country=PHL&destination_currency=PHP&destination_payment_instrument=BANK"
# → {"corridor":{...},"fields":[{"name":"recipient_account_uri","required":true,"description":"..."}, ...],
#    "limits":{"min":"1.00","max":"50000.00","currency":"PHP"},"source":"demo"}
```
Demo, потому что sandbox отдаёт HTML 502 для общего partner-id.

### 🟡 Quote Lifecycle — `/features/quote-lifecycle/*` (demo)
```bash
curl -s -X POST http://localhost:4011/features/quote-lifecycle/confirm \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"transactionReference":"...","proposalId":"...","state":"CONFIRMED","expiresAt":"...","source":"demo"}

curl -s -X POST http://localhost:4011/features/quote-lifecycle/cancel \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"...","state":"CANCELLED","source":"demo"}

curl -s "http://localhost:4011/features/quote-lifecycle/retrieve?transactionReference=08POC342598033X&proposalId=pen-4000000044472562338287758"
# → {"...","state":"CONFIRMED","fxRate":3.7,"chargedAmount":"110.41","currency":"USD","source":"demo"}
```

### 🟡 Payment Tracker — `/features/payment-tracker` (demo)
```bash
curl -s "http://localhost:4011/features/payment-tracker?ref=XBSDEMO12345"
# → {"ref":"XBSDEMO12345","status":"processing","stage":"screening",
#    "history":[{"status":"pending","stage":"received","timestamp":"..."}, ...],"source":"demo"}
# (повтори через минуту — стадия продвигается по wall-clock времени)

curl -s -X POST http://localhost:4011/features/payment-tracker/cancel \
  -H 'Content-Type: application/json' -d '{"id":"PMT-123"}'
# → {"id":"PMT-123","state":"CANCELLED","source":"demo"}
```

### 🟡 RFI Center — `/features/rfi/*` (demo)
```bash
curl -s "http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000"
# → {"requestId":"...","status":"PENDING","questions":[{"code":"SENDER_ID","label":"...","required":true}, ...],"source":"demo"}

curl -s -X POST http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000 \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"John","lastName":"Doe","message":"Documents attached"}'
# → {"requestId":"...","state":"SUBMITTED","source":"demo"}

curl -s -X POST http://localhost:4011/features/rfi/documents \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"proof.pdf","file":"dGVzdA=="}'   # file = base64, без префикса data:
# → {"documentId":"...","fileName":"proof.pdf","state":"UPLOADED","source":"demo"}
```

## Доказательство, что это реальный вызов Mastercard

Когда жмёшь **Validate** в UI (или дёргаешь живой Features-вызов), лог шлюза показывает реальный
поход в песочницу:

```
POST /crossborder/account-validations  → 200  (1500ms)   tenant=platform
POST /crossborder/bank-lookups         → 200  (1400ms)   tenant=platform
```

Задержка ~1.3–1.5с + FLE-шифрование (запрос шифруется Client-ключом, ответ расшифровывается
нашим Mastercard-ключом) подтверждают, что запрос дошёл до Mastercard, а не до локальной
заглушки. Проверить самому:

```bash
cd mastercard-demo-stack
docker compose logs app | grep -E 'account-validations|bank-lookups|cash-pickup'
curl http://localhost:4011/xbs/balances     # реальные счета sandbox, "source":"live"
```

## Переключение на live при открытии MTF/Prod

Как только Mastercard откроют MTF/Prod, меняешь `mastercard-demo-stack/.env` и пересоздаёшь BFF
— без правок кода (рабочие тела запросов уже зашиты):

```ini
XBS_QUOTE_MODE=live
XBS_PAYMENT_MODE=live
XBS_STATUS_MODE=live
# Страницы Features (bank-lookup / IBAN / cash-pickup уже live по умолчанию):
XBS_RATES_MODE=live
XBS_ENDPOINT_GUIDE_MODE=live
XBS_QUOTE_LIFECYCLE_MODE=live
XBS_PAYMENT_TRACKER_MODE=live
XBS_RFI_MODE=live
```
```bash
docker compose up -d mastercard-bff
```

## Итог

- ❌ Проблема не в gateway — он реализует всё и проверен.
- 🟢 Реально на sandbox сегодня: **валидация счёта, валидация адреса, балансы, bank lookup,
  генерация IBAN, cash pickup**.
- 🟡 Платежи / котировки / статусы / rates / endpoint-guide / RFI — sandbox отдаёт заглушки или
  отклоняет → **ждём MTF/Prod от Mastercard** (письмо). Код готов, включается через `.env`.
- Все остальные cross-border API gateway теперь выведены в группе **Features** в сайдбаре
  (8 страниц): Bank Lookup / IBAN Generator / Cash Pickup — **live** (реальные данные sandbox);
  FX Rates / Endpoint Guide / Quote Lifecycle / Payment Tracker / RFI Center — **demo** до
  MTF/Prod, переключаются через env.
