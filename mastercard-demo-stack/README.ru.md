# XBS Embedded — демо-стек

Самодостаточное демо: веб-интерфейс управляет **реальным шлюзом Mastercard Cross-Border**
(`mastercard`), а всё, что песочница пока не умеет, отдаёт одноразовый демо-бэкенд.

> 🇬🇧 English version: [README.md](README.md)

---

## 1. Из чего состоит стек (5 контейнеров)

BFF разделён на два сервиса по ответственности — **постоянный бэкенд приложения** и
**Mastercard cross-border слой** (та часть, что заменяется/урезается, когда дадут MTF/Prod).
nginx отдаёт один origin (`/demo-api`) и разводит путь между ними:

```
 браузер ─► frontend (nginx, :8080) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4011) ─► шлюз mastercard (app, :3000) ─► Mastercard ПЕСОЧНИЦА
                                                   │
                                                   └─ всё остальное ────────► app-bff (:4010) ─► mc_demo (хранилище сущностей / auth / integrations)

        postgres (общий) ◄── mc_demo (app-bff)   +   mc_gateway (шлюз)
```

| Сервис | Папка | Роль |
|---|---|---|
| `frontend` | `../masrtercard-front` | Веб-интерфейс (React/Vite, nginx). Ходит только в `/demo-api`; nginx разводит путь по двум BFF. |
| `app-bff` | `../app-bff` | **Постоянный бэкенд приложения.** Бессхемное хранилище сущностей + `auth.me` + integrations поверх Postgres. Без Mastercard — остаётся поддерживать фронт. |
| `mastercard-bff` | `../mastercard-bff` | **Cross-border слой (stateless).** API `/xbs` + `/features`: проксирует шлюз (live) или синтезирует (demo), по каждой способности. Mastercard-обращённая часть. |
| `app` | `../mastercard` | **Наш реальный продукт.** Шлюз Mastercard Cross-Border. Ходит в настоящую песочницу Mastercard. |
| `postgres` | — | Один сервер Postgres, две базы: `mc_demo` (app-bff) + `mc_gateway` (шлюз). |

---

## 2. Запуск и доступ

```bash
cd mastercard-demo-stack
docker compose up -d --build      # первый запуск собирает образы
docker compose ps                 # все 5 должны быть running/healthy
```

- **Веб-интерфейс:** http://localhost:8080 — пароль **`0544326303`**
- app-bff (прямой API, для разработчика): http://localhost:4010/health
- mastercard-bff (прямой API, разводка live/demo): http://localhost:4011/health

Остановить: `docker compose down` (данные сохраняются) или `docker compose down -v`
(стереть данные — при следующем подъёме всё засеется заново).

---

## 3. Как тестировать (по шагам)

1. Открой **http://localhost:8080**, введи пароль **`0544326303`**.
2. **Дашборд «Accounts Payable»** — список засеянных инвойсов (INV-1001…1006).
3. **Увидеть РЕАЛЬНЫЙ вызов Mastercard** 👇
   - Отметь галкой **INV-1006 (Cedar Cloud Services, $5 600)** → нажми **«Pay now»** (справа сверху).
   - На шаге **Review** у INV-1006 уже подставлены *документированные* sandbox-IBAN
     (`FR07…`) и адрес Mastercard.
   - Нажми **«Validate»** рядом с IBAN и рядом с адресом → появится бейдж **Validated**.
     **Это настоящий вызов песочницы Mastercard** через наш шлюз (валидация счёта/адреса
     возвращает реальный `SUCCESS`/`VERIFIED`).
4. **FX-котировка** — поменяй «Payment Currency» (например на ILS/EUR). Панель **FX Quote**
   покажет курс с бейджем **«Indicative · Demo»** (демо-курс — почему, см. §5).
5. **Отправка + статус** — «Send for Approval» → Batch overview → Funding → Completion.
   Вернёшься на дашборд — статус инвойса поедет pending → processing → completed (демо).
6. **Остальные страницы** (меню слева): Cards, Invoices & Employees, Tests, Integration Docs
   — всё на app-bff.
7. **Features** (меню слева, нижняя группа) — отдельные инструменты для *остальных* cross-border
   API Mastercard. У кого зелёная точка — отдают **реальные данные песочницы**: открой
   **Bank Lookup** → *Search* → реальные банки/BIC; **IBAN Generator** → реальный IBAN;
   **Cash Pickup** → реальные каталоги стран/городов/провайдеров. Остальные (FX Rates, Endpoint
   Guide, Quote Lifecycle, Payment Tracker, RFI Center) — demo до MTF/Prod (см. §6).

> Подсказка: каждый cross-border-ответ несёт поле `source` — `"live"` (реальный Mastercard)
> или `"demo"`. В UI это бейдж; разводку live/demo также видно на
> http://localhost:4011/health (mastercard-bff) и на эндпоинтах `/xbs/*` + `/features/*`.

---

## 4. Откуда берутся данные на каждой странице

**Правило:** все *экраны и записи* — это **демо-часть**; в наш сервис `mastercard` (и в
настоящую песочницу Mastercard) уходят только **cross-border платёжные операции** — и из них
сегодня вживую работают лишь те, что поддерживает песочница.

| Страница (route) | Что видно | Откуда |
|---|---|---|
| `/` **Дашборд** (Accounts Payable) | список инвойсов, балансы, KYB-баннер | `app-bff` (засеянные демо-данные) |
| `/` → Pay → **Review → кнопки «Validate» IBAN/адрес** | валидация получателя | 🟢 **mastercard-bff → шлюз `mastercard` → песочница MC (LIVE)** |
| `/` → Pay → **Review → FX Quote** | индикативный курс | `mastercard-bff` (demo — см. §5) |
| `/` → Pay → **Funding** | проверка баланса | `app-bff` (демо-балансы) |
| `/` → Pay → **отправка + статус** | платёж + отслеживание | `mastercard-bff` (demo — см. §5) |
| `/cards` **Card Management** | виртуальные карты, сотрудники, транзакции | `app-bff` (не cross-border-продукт) |
| `/invoices-employees` | инвойсы + сотрудники | `app-bff` |
| `/dashboard3` | дашборд-вариант с онбордингом | `app-bff` |
| **Features** (`/features/*`) | bank lookup / IBAN / cash pickup / … | `mastercard-bff` (live или demo по странице — см. §6) |
| `/test` **Test Suite** | внутренняя тест-страница | `app-bff` |
| `/integration-docs` | статическая страница-спека | статика (без бэкенда) |

Все сущности UI — `Invoice`, `CompanyProfile`, `VirtualCard`, `CardTransaction`, `Employee`,
`TopUp`, `PaymentApproval`, `AppUser` — живут в базе `mc_demo` сервиса `app-bff` (засеваются
на старте). Их редактирование/создание в UI пишется в `app-bff`, **а не** в Mastercard.

---

## 5. Live vs Demo — cross-border операции

`mastercard-bff` проксирует cross-border операции в шлюз **по каждой способности отдельно**.
Разбивка соответствует тому, что реально поддерживает *песочница* Mastercard:

| Операция (`/xbs/*`) | Режим | Почему |
|---|---|---|
| `validate-account` (IBAN) | 🟢 **live** | Песочница возвращает реальный `SUCCESS` на документированный тестовый IBAN |
| `validate-address` | 🟢 **live** | Песочница возвращает реальный `VALID`/`VERIFIED` на документированный адрес |
| `balances` | 🟢 **live** | Песочница возвращает реальные балансы счетов |
| `quote` (FX) | 🟡 **demo** | Песочница отдаёт *заглушку* курса (`777`), для показа непригодно → реалистичный демо-курс |
| `pay` (отправка) | 🟡 **demo** | Отправка платежа требует доступа MTF/Prod (нет в песочнице) |
| `status` (отслеживание) | 🟡 **demo** | Push статусов требует доступа MTF/Prod (нет в песочнице) |

> 📄 Полная разбивка по **каждому** API Mastercard — что поддерживает песочница и почему
> часть в демо, плюс примеры запросов к Features-эндпоинтам — в
> **[docs/ru/test.md](docs/ru/test.md)** (🇬🇧 [docs/en/test.md](docs/en/test.md)).

**Это env-переключатели — без правок кода.** Когда Mastercard откроют MTF/Prod, меняешь
значение в `mastercard-demo-stack/.env` и пересоздаёшь контейнер:

```ini
XBS_QUOTE_MODE=demo        # demo | live — курс sandbox это заглушка (777); → live на MTF/Prod
XBS_VALIDATION_MODE=live
XBS_BALANCES_MODE=live
XBS_PAYMENT_MODE=demo      # → live, когда откроют MTF/Prod
XBS_STATUS_MODE=demo       # → live, когда откроют MTF/Prod
```
```bash
docker compose up -d mastercard-bff   # применить новые режимы (cross-border живёт здесь)
```

Если `live`-вызов не удался (например, неподдерживаемый песочницей ввод), BFF **мягко
откатывается** на демо-ответ и помечает `source: "demo"` — UI никогда не ломается.

---

## 6. Features — остальные API Mastercard (группа «Features» в сайдбаре)

Инвойс-флоу использует только quote/validation/balances/pay/status. Все *остальные*
cross-border API шлюза выведены отдельными страницами **Features** (`/features/*` →
mastercard-bff → шлюз). На каждый ответ — бейдж **Live · Mastercard** / **Demo**; три живые
отдают **реальные данные песочницы Mastercard** уже сегодня (помечены зелёной точкой в меню).

| Страница Features (route) | API шлюза | Режим сейчас |
|---|---|---|
| **Bank Lookup** (`/features/bank-lookup`) | `POST /crossborder/bank-lookups` | 🟢 **live** |
| **IBAN Generator** (`/features/iban`) | `POST /crossborder/iban-generations` | 🟢 **live** |
| **Cash Pickup** (`/features/cash-pickup`) | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | 🟢 **live** |
| **FX Rates** (`/features/rates`) | `GET /crossborder/rates` | 🟡 demo (песочница не отдаёт carded-rate) |
| **Endpoint Guide** (`/features/endpoint-guide`) | `GET /crossborder/endpoint-guide/specifications` | 🟡 demo (песочница 502) |
| **Quote Lifecycle** (`/features/quote-lifecycle`) | confirm / cancel / retrieve | 🟡 demo |
| **Payment Tracker** (`/features/payment-tracker`) | lookup / cancel / status-events | 🟡 demo |
| **RFI Center** (`/features/rfi`) | RFI requests + documents | 🟡 demo (RFI не включён для проекта) |

Каждая переключается независимо в `.env` (по умолчанию): `XBS_BANK_LOOKUP_MODE`, `XBS_IBAN_MODE`,
`XBS_CASH_PICKUP_MODE` = `live`; `XBS_RATES_MODE`, `XBS_ENDPOINT_GUIDE_MODE`,
`XBS_QUOTE_LIFECYCLE_MODE`, `XBS_PAYMENT_TRACKER_MODE`, `XBS_RFI_MODE` = `demo` → переключить на
`live`, когда Mastercard откроет. Проверить разводку — http://localhost:4011/health (блок
`features`).

---

## 7. Полезные команды

```bash
docker compose ps                          # статус
docker compose logs -f mastercard-bff      # логи cross-border BFF (видно live/fallback)
docker compose logs -f app-bff             # логи app BFF (хранилище / сев)
docker compose logs -f app                 # логи шлюза (видно реальные вызовы MC)
curl http://localhost:4011/health          # разводка live|demo (mastercard-bff)
curl http://localhost:4010/entities/Invoice   # засеянные сущности (app-bff)
docker compose up -d --build               # пересборка после правок кода
docker compose down -v                     # полный сброс (пересев при следующем подъёме)
```

Песочничные креды/сертификаты шлюза берутся в рантайме из `../mastercard/.env` и
`../mastercard/certs` (монтируются read-only — в образы не зашиваются).
