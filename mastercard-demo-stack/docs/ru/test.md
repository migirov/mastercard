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
| **Валидация адреса** | `VALID`/`VERIFIED` только на **один документированный адрес**; любая страна кроме `USA` отклоняется | 🟡 живой вызов, фикстурные данные — см. §1.1 |
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

### 1.1 Валидация адреса — это фикстура песочницы, а не сервис

Вынесено отдельно, потому что вызов действительно доходит до Mastercard и действительно
возвращает 200 — и потому выглядит рабочим сервисом, пока не попробуешь второй адрес.
Замерено на песочнице:

| Запрос | Ответ песочницы |
|---|---|
| `country: USA` + `4 CLARK STREET, EVERETT, MA, 02149` | `VALID` / `VERIFIED` + полный разбор адреса |
| `country: USA` + любой другой реальный адрес США | `INVALID` / `AMBIGUOUS` |
| `country: ISR`, `DEU`, `GBR`, … | **HTTP 400** — `Source: country`, `ReasonCode: INVALID_INPUT_VALUE` |

То есть песочница принимает **только `USA`**, а внутри США подтверждает **один
документированный адрес**. Этот адрес засеян на **INV-1006** (вместе с документированным
тестовым IBAN `FR07…`) — именно этот счёт и нужно брать, когда показываете живую проверку
адреса через Mastercard.

Два следствия, которые UI теперь показывает, а не прячет:

- **Страна задаётся явно.** Рядом с адресом в форме платежа есть селектор **Address country**,
  предзаполненный по префиксу IBAN (`IL62…` → Израиль) и доступный для правки. Раньше страна не
  передавалась вовсе, а API молча подставлял `USA` — и адрес в Тель-Авиве проверялся по
  американским правилам, возвращая «невалидно» без единого объяснения на экране.
- **Не-американский адрес читается как «Not checked», а не «невалидно».** Ошибка 400 выше
  означает, что проверка не выполнялась. Раньше заглушка отвечала `valid: true` на любую
  непустую строку; теперь она честно сообщает, что ничего не проверено. У адреса, в отличие от
  IBAN, нет контрольной суммы — офлайн-проверки для него просто не существует.

Настоящая пострановая валидация адреса требует MTF/Prod — ровно как quote / pay / status.

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

### Аутентификация — нужна для всех примеров ниже

Оба BFF требуют на каждом маршруте **два** фактора: общий bearer-токен из
`mastercard-demo-stack/.env` и proof гейта в заголовке `X-XBS-Gate`. **Исключение одно —
`/health`**, он остаётся публичным (на нём висит healthcheck docker-compose).

Если не хватает любого из них — придёт 401, и по телу видно, какого именно:

- нет/неверный токен → `{"message":"missing or invalid API token"}`
- нет/истёк proof → `{"code":"gate_required","message":"missing, invalid or expired gate proof"}`

Proof выдаёт `POST /gate/verify` на app-bff, проверяя `DEMO_GATE_PASSWORD` — тот же пароль, что
спрашивает гейт в UI. Действует 12 часов (`DEMO_GATE_TTL_HOURS`).

Выполните один раз в той оболочке, где тестируете, — все `curl` ниже используют `"${AUTH[@]}"`,
который несёт оба заголовка:

```bash
cd mastercard-demo-stack
export DEMO_API_TOKEN=$(grep '^DEMO_API_TOKEN=' .env | cut -d= -f2-)
export DEMO_GATE_PASSWORD=$(grep '^DEMO_GATE_PASSWORD=' .env | cut -d= -f2-)

# Обмениваем пароль на proof (app-bff, порт 4010). Этому вызову нужен только токен.
GATE_PROOF=$(curl -fsS -X POST http://localhost:4010/gate/verify \
  -H "Authorization: Bearer $DEMO_API_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$DEMO_GATE_PASSWORD\"}" | sed -E 's/.*"proof":"([^"]*)".*/\1/')

# Именно МАССИВ bash, а не строка: два заголовка в один -H не поместить.
AUTH=(-H "Authorization: Bearer $DEMO_API_TOKEN" -H "X-XBS-Gate: $GATE_PROOF")
echo "${GATE_PROOF:?gate verify не удался — верен ли DEMO_GATE_PASSWORD и поднят ли app-bff?}" >/dev/null
```

```bash
curl -s http://localhost:4011/health        # → "features":{"bankLookup":"live", ... ,"rfi":"demo"}
```

### 🟢 Bank Lookup — `POST /features/bank-lookup` (live)
```bash
curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/bank-lookup \
  -H 'Content-Type: application/json' \
  -d '{"name":"*of Africa United Kingdom*SUC20004","country":"GBR"}'
# → {"banks":[{"name":"...","bic":"428773","branch":"East Bay Branch","country":"GBR",...}],
#    "total":4,"source":"live"}
```
Тело: `name` (MC принимает `*`-маски), `country` (ISO-3), `bic?` (опционально).

### 🟢 IBAN Generator — `POST /features/iban` (live)
```bash
curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/iban \
  -H 'Content-Type: application/json' \
  -d '{"country":"FRA","ban":"20041010050500013M02606","branchCode":"2004101005","accountNo":"0500013026"}'
# → {"iban":"FR1420041010050500013M02606","ban":"20041010050500013M02606",
#    "bank":{"bic":"PSSTFRPPLIL","name":"La Banque Postale","branchCode":"2004101005","address":"Lille, FRA"},
#    "source":"live"}
```
Тело: `country` (ISO-3, обязательно), `ban?`, `branchCode?`, `accountNo?`.

### 🟢 Cash Pickup — `GET /features/cash-pickup/{kind}` (live)
```bash
curl -s "${AUTH[@]}" "http://localhost:4011/features/cash-pickup/countries?cash_pickup_type=PANY"
# → {"items":[{"countryAlpha3":"NGA","currency":"NGN","cashPickupType":"PANY"}, ...],"source":"live"}

curl -s "${AUTH[@]}" "http://localhost:4011/features/cash-pickup/cities?country=GTM&currency=GTQ&limit=5"
# → {"items":[{"country":"GTM","currency":"GTQ","city":"...","stateName":"..."}],"total":361,"source":"live"}

curl -s "${AUTH[@]}" "http://localhost:4011/features/cash-pickup/providers?country=ARE&currency=AED&cash_pickup_type=IN_NETWORK&limit=5"
# → {"items":[{"providerId":"...","providerName":"ORIENT EXCHANGE","country":"ARE","currency":"AED"}],"source":"live"}

# branches требует provider_id (возьми его из ответа providers выше):
curl -s "${AUTH[@]}" "http://localhost:4011/features/cash-pickup/branches?provider_id=<providerId>&limit=5"
```
Query (всё опционально): countries → `cash_pickup_type`; cities → `country,currency,offset,limit`;
providers → `+cash_pickup_type`; branches → `provider_id,state,city,offset,limit`.

### 🟡 FX Rates — `GET /features/rates` (demo)
```bash
curl -s "${AUTH[@]}" "http://localhost:4011/features/rates"
# → {"rates":[{"pair":"USD/ILS","rate":3.7,"change":0.01}, ...],"asOf":"...","source":"demo"}
curl -s "${AUTH[@]}" "http://localhost:4011/features/rates?base=USD&quote=ILS"   # одна пара
```
Demo, потому что sandbox Mastercard не отдаёт carded-rate (`{"rates":{}}`).

### 🟡 Endpoint Guide — `GET /features/endpoint-guide` (demo)
```bash
curl -s "${AUTH[@]}" "http://localhost:4011/features/endpoint-guide?payment_type=B2B&destination_country=PHL&destination_currency=PHP&destination_payment_instrument=BANK"
# → {"corridor":{...},"fields":[{"name":"recipient_account_uri","required":true,"description":"..."}, ...],
#    "limits":{"min":"1.00","max":"50000.00","currency":"PHP"},"source":"demo"}
```
Demo, потому что sandbox отдаёт HTML 502 для общего partner-id.

### 🟡 Quote Lifecycle — `/features/quote-lifecycle/*` (demo)
```bash
curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/quote-lifecycle/confirm \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"transactionReference":"...","proposalId":"...","state":"CONFIRMED","expiresAt":"...","source":"demo"}

curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/quote-lifecycle/cancel \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"...","state":"CANCELLED","source":"demo"}

curl -s "${AUTH[@]}" "http://localhost:4011/features/quote-lifecycle/retrieve?transactionReference=08POC342598033X&proposalId=pen-4000000044472562338287758"
# → {"...","state":"CONFIRMED","fxRate":3.7,"chargedAmount":"110.41","currency":"USD","source":"demo"}
```

### 🟡 Payment Tracker — `/features/payment-tracker` (demo)
```bash
curl -s "${AUTH[@]}" "http://localhost:4011/features/payment-tracker?ref=XBSDEMO12345"
# → {"ref":"XBSDEMO12345","status":"processing","stage":"screening",
#    "history":[{"status":"pending","stage":"received","timestamp":"..."}, ...],"source":"demo"}
# (повтори через минуту — стадия продвигается по wall-clock времени)

curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/payment-tracker/cancel \
  -H 'Content-Type: application/json' -d '{"id":"PMT-123"}'
# → {"id":"PMT-123","state":"CANCELLED","source":"demo"}
```

### 🟡 RFI Center — `/features/rfi/*` (demo)
```bash
curl -s "${AUTH[@]}" "http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000"
# → {"requestId":"...","status":"PENDING","questions":[{"code":"SENDER_ID","label":"...","required":true}, ...],"source":"demo"}

curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000 \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"John","lastName":"Doe","message":"Documents attached"}'
# → {"requestId":"...","state":"SUBMITTED","source":"demo"}

curl -s -X POST "${AUTH[@]}" http://localhost:4011/features/rfi/documents \
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
# Предполагается, что блок настройки из §3 уже выполнен (он экспортирует токен и собирает AUTH).
docker compose logs app | grep -E 'account-validations|bank-lookups|cash-pickup'
curl "${AUTH[@]}" http://localhost:4011/xbs/balances   # реальные счета sandbox, "source":"live"
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
- 🟢 Реально на sandbox сегодня: **валидация счёта, балансы, bank lookup, генерация IBAN,
  cash pickup**.
- 🟡 **Валидация адреса** доходит до Mastercard и отвечает 200, но песочница принимает только
  `USA` и подтверждает один документированный адрес (§1.1) — живой вызов по фикстуре.
- 🟡 Платежи / котировки / статусы / rates / endpoint-guide / RFI — sandbox отдаёт заглушки или
  отклоняет → **ждём MTF/Prod от Mastercard** (письмо). Код готов, включается через `.env`.
- Все остальные cross-border API gateway теперь выведены в группе **Features** в сайдбаре
  (8 страниц): Bank Lookup / IBAN Generator / Cash Pickup — **live** (реальные данные sandbox);
  FX Rates / Endpoint Guide / Quote Lifecycle / Payment Tracker / RFI Center — **demo** до
  MTF/Prod, переключаются через env.
