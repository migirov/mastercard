# Issues от тимлида — статус и решения

Лог по каждому замечанию тимлида: **требование**, **что сделано**, **что сознательно НЕ
сделано** и **почему** (со ссылками на доку). Ведём, чтобы обоснование каждого решения было
прослеживаемым (особенно где отходим от буквального прочтения). EN-версия —
[docs/en/issues.md](../en/issues.md).

---

## Issue 1 — Align TypeORM config

**Требование (дословно).**
> Remove `synchronize` and switch to migrations-only schema management. We should follow the
> NestJS/TypeORM recommendations and manage schema changes through migrations only.
> `entities: [...MASTERCARD_ENTITIES],` — remove.
> Reference: https://docs.nestjs.com/recipes/sql-typeorm

**Основание решения.** Страница из ссылки (`recipes/sql-typeorm`) — это рецепт «собрать
`DataSource` с нуля через кастомные провайдеры», и в **его же предупреждении** сказано, что в
нём «много overhead, который можно убрать готовым пакетом `@nestjs/typeorm`», и он отсылает к
[`techniques/sql`](https://docs.nestjs.com/techniques/database). Проект уже на `@nestjs/typeorm`,
поэтому следуем `techniques/sql` — где секция **«Auto-load entities»** предписывает именно
`autoLoadEntities: true`, а предупреждения — только миграции. Это и есть суть issue.

### Сделано ✅
- **`src/database/database.module.ts`** (рантайм dev-харнесса; в монолит хоста не идёт):
  - `entities: [...MASTERCARD_ENTITIES]` → **`autoLoadEntities: true`** — сущности берутся из
    `TypeOrmModule.forFeature(...)` каждого суб-модуля (techniques/sql: *«явный список в
    корневом модуле течёт границами домена… ставьте `autoLoadEntities: true`»*).
  - **`synchronize` убран полностью** (TypeORM по умолчанию `false`) → схема ведётся только
    миграциями, во всех средах.
  - `migrationsRun: !isProd || DB_MIGRATIONS_RUN==='true'` — dev-харнесс строит схему из
    миграций на старте (замена прежнего удобства `synchronize` для local/e2e); в проде остаётся
    под флагом (миграции гонит хост / отдельный Job, а не каждый под).
- **`src/database/data-source.ts`** (TypeORM CLI для `migration:generate/run/revert`):
  - `entities: [...MASTERCARD_ENTITIES]` → **статический glob** `*.entity{.ts,.js}` (форма из
    доки *«static glob path»*). Явный массив убран и здесь; `synchronize: false` уже было.
- Чистка комментариев про `synchronize` (напр. `src/tenants/entities/tenant.entity.ts`).

### НЕ сделано — и почему ❌
- **НЕ переписывал на кастомные `DATA_SOURCE`-провайдеры из рецепта** (`database.providers.ts`
  с `new DataSource().initialize()`, провайдеры `*_REPOSITORY` на каждую сущность и
  `@Inject('X_REPOSITORY')` в сервисах). Причины:
  1. Рецепт сам советует пакет `@nestjs/typeorm` (он у нас).
  2. Это **сломало бы embeddable-дизайн** — монолит-хост сам даёт `DataSource` (через `forRoot`
     + `autoLoadEntities`/список сущностей); собственный `DATA_SOURCE`-провайдер конфликтовал бы
     с соединением хоста.
  3. Пришлось бы переписывать инъекцию репозиториев в ~5 модулях без функциональной пользы.
  Если тимлид хочет именно этот рефактор — это отдельная, большая задача, нужно флагнуть.

### Почему `data-source.ts` оставляет источник сущностей (не `autoLoadEntities`)
`autoLoadEntities` — фича `@nestjs/typeorm` **`TypeOrmModule`**, на сырой `DataSource` она **не
действует**. `migration:generate` в CLI диффает метаданные сущностей против БД, поэтому источник
сущностей нужен. Дали его doc-формой — **статический glob** (ручного массива всё равно нет).
`MASTERCARD_ENTITIES` остаётся экспортом пакета для хоста (seam встраивания — хост вписывает его
в свой DataSource). _(Issue #10 позже удалил старт-проверку `HostIntegrityService`, которая тоже
потребляла этот список.)_

### Проверка ✅
- `tsc --noEmit` — чисто.
- **Свежая БД** (volume пересоздан): схема построена **полностью миграциями** на старте
  (`migrationsRun`), без `synchronize`. `\dt` → 5 entity-таблиц + `migrations`.
- **unit 184/184**, **hermetic e2e 16/16**, **live e2e 23/23** (реальный sandbox; validations
  отдают реальные FLE-данные; admin/webhook/persist работают через `autoLoadEntities`).
- **`migration:generate`** (glob в `data-source.ts`) резолвит сущности — подтверждено.

### Находка, всплывшая из-за перехода → УСТРАНЕНА ✅ (миграции == entity)
Убрав `synchronize`, обнажили **существовавший дрейф**: старые миграции не полностью совпадали с
entity-метаданными `@Index()` (имена индексов; порядок колонок составного индекса `tx_status`;
отсутствующий индекс `tenants.createdAt`, который раньше создавал `synchronize`).

**Решение (проект ещё нигде не задеплоен → перегенерировать безопасно):** сбросили dev-БД в
пустую, удалили две старые миграции (`InitialSchema` + `AddTxStatus`) и **перегенерировали
единый чистый `InitialSchema`** из текущих сущностей (`migration:generate` против пустой БД). Он
создаёт все 5 таблиц с entity-индексами — включая пропавший `tenants("createdAt")` и правильный
порядок `tx_status("transactionReference","tenantId")`. Проверка: повторный `migration:generate`
→ **«No changes in database schema were found»** → миграции и entity синхронны. `AddTxStatus`
свёрнут в `InitialSchema`.

**Статус:** config-правка **сделана и полностью проверена**; дрейф индексов **устранён** (единый
чистый `InitialSchema`, `migration:generate` чистый); e2e перепрогнан на новой схеме.

---

## Issue 2 — Move EncryptionService logic to interceptor

**Требование (дословно).**
> Move EncryptionService logic to interceptor

**Текущее состояние (из кода).** `EncryptionService` используется **только** из axios-интерцепторов
`MastercardClient` (`src/mastercard/services/mastercard-client.service.ts`) — больше нигде (подтверждено
grep'ом: только интерцептор + его spec + регистрация провайдера). Поток: бизнес-логика
(`CrossBorderService`) отдаёт чистый объект и про крипту не знает → `MastercardClient.request()` →
**axios REQUEST-интерцептор** зовёт `encryption.encryptRequest()`, затем OAuth1-подпись по
зашифрованному телу → **axios RESPONSE-интерцептор** зовёт `encryption.decryptResponse()`. Сам
`EncryptionService` держит JWE-реализацию, строит `JweEncryption` в `onModuleInit` и обеспечивает
per-tenant fail-loud guard.

**Ключевой вывод.** Логика шифрования **уже вызывается из axios-интерцептора, а не из
бизнес-логики** (прежний рефактор вынес её из `CrossBorderService`). То есть если цель issue —
«шифрование в интерцепторе, а не в сервисах/бизнес-логике» — **на `main` это уже выполнено**.

**Две трактовки — и наша позиция:**
- **(A) «в интерцепторе, а не в бизнес-логике»** → уже сделано. Максимум косметика: выделить шаг
  шифрования из `MastercardClient.installInterceptors()` в отдельный именованный axios-интерцептор,
  чтобы HTTP + OAuth + шифрование не были смешаны в одной функции.
- **(B) буквально растворить `EncryptionService`, вложив его код в интерцептор** → возможно, но
  **не рекомендуется**: `MastercardClient` вобрал бы HTTP + OAuth + JWE (нарушение SRP); теряется
  lifecycle-хук `onModuleInit` (там файловое I/O для построения `JweEncryption` — по конвенции Nest
  не в конструкторе) и изолированные юнит-тесты (`encryption.service.spec`). Текущее разделение
  (сервис держит логику, интерцептор оркеструет) — идиоматичнее для NestJS.

**Про терминологию.** «Интерцептор» здесь — **axios-интерцептор** на исходящем вызове шлюз→MC.
**NestJS-интерцептор** (`NestInterceptor`) сюда НЕ подходит — он оборачивает входящий запрос
мерчант→шлюз, а не исходящий вызов к MC.

**Статус:** ТРЕБУЕТ УТОЧНЕНИЯ перед правками — спросили в GitHub-issue (тимлид имеет в виду (A)
подтвердить/косметика или (B) убрать сервис?). Рекомендация: **(A)** оставить сервис; опц. выделить
отдельный encryption axios-интерцептор для чистоты. **Пока сделано:** в коде ничего не менялось
(только анализ).

---

## Issue 3 — Use transaction_reference for idempotency

**Требование (дословно).**
> Use transaction_reference for idempotency

**Сделано ✅ (буквально как сказано — ключ идемпотентности = `transaction_reference`).**
- `CrossBorderService.createPayment` теперь выводит ключ идемпотентности из
  `body.paymentrequest.transaction_reference`, хешируя как `txref:sha256(ref)` (KV-безопасно при
  любой длине/charset ref у клиента). Fingerprint тела сохранён (тот же ref с ДРУГИМ телом → `422`).
  Нет `transaction_reference` → идемпотентности нет (MC всё равно отвергнет платёж — поле обязательно).
- **Полностью убран старый путь через заголовок `Idempotency-Key`** (механизм, который заменяем):
  `@IdempotencyKey`-параметр + `@ApiHeader` на маршруте платежа, и осиротевшие файлы
  `idempotency-key.decorator.ts` / `idempotency-key.pipe.ts` (+ spec). Сам `IdempotencyService` не
  менялся — он по-прежнему принимает строку-ключ; изменился только *источник* ключа.
- Тесты: `crossborder.service.spec` проверяет, что ключ = `txref:sha256(transaction_reference)` и
  `undefined` при отсутствии ref; старый e2e «кривой Idempotency-Key → 400» (он гонял удалённый
  пайп) заменён на проверку «платёж доходит до MC». `api.md` (RU+EN) обновлён (секция платежа +
  таблица pipes + поток).

**Почему это лучше.** `transaction_reference` обязателен и является собственным dedup-ключом MC,
поэтому идемпотентность платежа теперь **автоматическая и всегда включена** для каждого платежа —
раньше она срабатывала, только если клиент присылал опциональный заголовок `Idempotency-Key`.

**Зафиксированное решение.** Спросили, оставить ли заголовок как опциональный override; тимлид
выбрал **(а) убрать совсем** — чисто `transaction_reference`.

**Проверка:** tsc чисто; unit + hermetic + live e2e зелёные.

**Статус:** сделано и проверено.

---

## Issue 4 — Remove KvStore-based idempotency

**Требование (дословно).**
> Remove KvStore-based idempotency.
> We should avoid a separate KV layer and use Postgres as the source of truth for
> webhook processing.
>
> Remove Idempotency-Key from payment API.
> Payment flow still accepts Idempotency-Key and uses IdempotencyService.
> We should use transaction_reference as the source of truth for payment idempotency instead.

**Контекст.** Перекликается с Issue 3, но идёт ДАЛЬШЕ: Issue 3 сменил лишь *источник
ключа* (transaction_reference), а механизм остался `IdempotencyService` поверх общего
KV-слоя `kv_store`. Здесь убираем сам KV-слой и делаем Postgres источником истины — и для
платежей, и для вебхуков. (Замечание «*Payment flow still accepts Idempotency-Key*» уже
неактуально — заголовок убран в Issue 3; оставался лишь `IdempotencyService`.)

### Решение (зафиксировано с пользователем)
Развилка по платежам: «transaction_reference as the source of truth» читалось двояко —
(A) делегировать дедуп самому MC (убрать наш слой целиком) или (B) держать
идемпотентность в Postgres по transaction_reference, сохранив гарантии. **Выбран (B)** —
таблица `payment_idempotency`, источник истины в нашей БД, защита от двойного списания
остаётся локальной (не «доверие к дедупу MC»). «Remove KvStore-based idempotency» = убрать
KV-бэкенд, а не саму идемпотентность.

### Сделано ✅
- **Платежи → Postgres (`payment_idempotency`).** Новые `PaymentIdempotencyEntity`
  (`UNIQUE(tenantId, idemKey)`, где `idemKey = txref:sha256(transaction_reference)`) и
  `PaymentIdempotencyStore`, заменившие `IdempotencyService`. Поведение сохранено 1:1:
  - атомарный захват слота `INSERT ... ON CONFLICT DO UPDATE` (UPDATE — только для
    перезахвата протухшего in-progress замка по `lockedAt`, чтобы краш процесса не залипил
    ключ навсегда);
  - кэш ответа MC (`done=true` + `result` jsonb) → ретрай отдаёт результат БЕЗ повторного
    вызова MC;
  - `409` если запрос уже в обработке; `422` если тот же ref с ДРУГИМ телом (fingerprint);
  - fail-safe: при 5xx/сетевой ошибке слот НЕ освобождаем (исход у MC неизвестен), при
    клиентском 4xx — освобождаем (ретрай безопасен).
  - **Улучшение против KV:** готовые записи постоянны (один transaction_reference = один
    платёж навсегда), а не TTL 24ч.
- **Вебхуки → Postgres (`tx_status`).** `WebhookHandler.handleOther` (не-статусные события:
  Carded Rate Push, RFI) больше не дедупит через `kv.setIfAbsent('wh:<ref>')`, а идёт через
  тот же атомарный `INSERT ON CONFLICT` по `UNIQUE(eventRef)` в `tx_status` — единый
  Postgres-источник истины для ВСЕХ вебхуков. Статус-выдача мерчанту (`findForTenant`)
  отфильтрована по статусным типам, чтобы не-статусные строки наружу не попадали.
- **KV-слой удалён целиком:** `src/store/*` (`kv.entity`, `kv.types`, `store.module`,
  `postgres-kv.store`, `kv-cleanup.service`), `src/idempotency/*`. Убраны `KvEntity` из
  `MASTERCARD_ENTITIES`, `StoreModule` из зонтичного модуля. `KvCleanupService` был
  единственным `@Cron` → убрана host-проверка `ScheduleModule` и `ScheduleModule.forRoot()`
  из dev-харнесса.
- **Миграция:** проект не задеплоен → перегенерирован единый чистый `InitialSchema`
  (`kv_store` убран, `payment_idempotency` добавлен); повторный `migration:generate` →
  «No changes».

### Проверка ✅
- `tsc --noEmit` чисто; **unit 171**, **hermetic e2e 17** (добавлен тест идемпотентности
  платежа: тот же ref → кэш и MC вызван 1 раз, другое тело → 422), **live e2e 23** (sandbox).
- Свежая БД: схема построена миграциями; `migration:generate` → «No changes».

### Пост-ревью харденинг (5 проходов: баги/опт/безопасность) ✅
- **Корректность (Med):** перезахват протухшего in-progress замка теперь только при СОВПАДАЮЩЕМ
  теле (`fingerprint = EXCLUDED.fingerprint`) — иначе `422`, согласованно со свежим замком (раньше
  «тот же ref + другое тело» в окне протухшего замка обходило `422`).
- **Оптимизация (Low):** убран неиспользуемый индекс `payment_idempotency(lockedAt)` (он
  проверяется как фильтр уже найденной по UNIQUE строки, не индекс-скан; фоновой очистки нет) →
  перегенерил `InitialSchema`.
- **Ретеншн/PII (Low, открытый инфра-item):** `payment_idempotency.result` и `tx_status` без
  app-TTL (cron убран) → задокументировано в `production-questions.md` (нужна DB-политика
  ретеншна/prune, особенно для PII).
- Перепроверено без находок: SQL-инъекций нет (bind-параметры), изоляция тенантов по
  `(tenantId, idemKey)`, нестроковый `transaction_reference` → `400` (не `500`), barrel
  `index.ts` чист, Issue #1 TypeORM-конфиг ок. Тесты после правок: unit 171 / hermetic 17 / live 23.

**Статус:** сделано и полностью проверено.

---

## Issue 5 — Clean up TenantRegistry bootstrap and demo tenants

**Требование (дословно).**
> Clean up TenantRegistry bootstrap and demo tenants
> Implement seed script

**Проблема.** `TenantRegistry.onModuleInit` засевал на КАЖДОМ старте: `platform` (везде,
вкл. prod) + демо-тенантов `acme`/`own-sandbox`/`own-demo` (по env-условию `!isProduction`).
Минусы: bootstrap встраиваемого модуля молча пишет тестовые данные в БД хоста; демо-данные и
env-ветка зашиты в data-layer-сервис.

### Решение
`onModuleInit` выполняется и ВНУТРИ встраиваемого `MastercardModule` (хост `b24club-api`) — значит
любой авто-засев писал бы в БД хоста на каждом старте, ровно то, что issue просит убрать. Поэтому:
- **`TenantRegistry` не сеет вообще** — чистый data-layer, встраивание абсолютно чистое (модуль не
  трогает БД хоста на старте).
- **Базовый `platform` сеет только dev-харнесс** (`DevSeedService` в `AppModule`, не во встраиваемом
  модуле) — zero-config для локального запуска / `ping` / e2e.
- **Демо-тенанты** (acme/own-sandbox/own-demo) — `npm run seed`.
- **Хост в проде** провижит тенантов явно (admin-API или `SEED_DEMO=false npm run seed`).

Так bootstrap полностью чист, нет security-smell (pre-approved тенант создаётся осознанно, а не молча
на каждом boot), и локалка/e2e остаются zero-config.

### Сделано ✅
- **`TenantRegistry` — чистый data-layer:** убран `onModuleInit` (и `implements OnModuleInit`),
  засев демо-тенантов, env-ветка `isProduction`, приватный `seedIfAbsent`, неиспользуемые
  зависимости `GatewayConfig`/`Logger`. Никакого засева/сайд-эффектов на старте.
- **Новый `src/tenants/services/tenant.seed.ts`** — единый источник сид-данных: `PLATFORM_TENANT`,
  `DEMO_TENANTS` (acme/own-sandbox/own-demo) + идемпотентный `seedTenants(repo, list)`
  (`INSERT … ON CONFLICT DO NOTHING RETURNING id`, без гонок при multi-pod; existing НЕ
  перезаписываются → admin-правки approval/suspend сохраняются; возвращает реально вставленные).
- **`src/dev-seed.service.ts` (`DevSeedService`)** — провайдер ТОЛЬКО dev-харнесса (в `AppModule`,
  НЕ во встраиваемом `MastercardModule`): на `onApplicationBootstrap` сеет базовый `platform`
  (zero-config для `ts-node src/harness/main.ts`/`ping`/e2e). Хост его не получает → в БД хоста модуль на
  старте не пишет.
- **Seed-скрипт `scripts/seed.ts`** (`npm run seed`) — поднимает `AppModule`-контекст (как
  `ping`; `DevSeedService` при этом сеет `platform`), сеет демо-тенантов; `SEED_DEMO=false` →
  только базовый `platform`. Идемпотентно; конфиг БД — из того же `.env`.
- **e2e:** демо больше не появляются «сами» → оба сьюта (`app.contract`/`app.e2e`) сеют
  `DEMO_TENANTS` в `beforeAll` (`platform` приходит от `DevSeedService` на bootstrap).

### Следствие для хоста (зафиксировать при встраивании)
Встраиваемый `MastercardModule` больше НЕ создаёт `platform` сам → хост обязан провижить тенантов
(`platform` и свои) через admin-API или `SEED_DEMO=false npm run seed`. Зафиксировано в
`production-questions.md` (host integration checklist).

### Проверка ✅
- `tsc` чисто; на СВЕЖЕЙ БД: **unit 171 / hermetic 17 / live 23**.
- После live-e2e на свежей БД в таблице ровно 4 тенанта: `platform` (от `DevSeedService`) +
  `acme`/`own-sandbox`/`own-demo` (от e2e `beforeAll`); `own-demo` — pending `f`/`f`.
- `npm run seed` на пустой БД: схема (миграции) + `platform` (DevSeedService) + демо; повторно →
  «уже присутствуют» (идемпотентность).

**Статус:** сделано и полностью проверено.

---

## Issue 6 — Persist encrypted Mastercard webhook events before ack

**Требование (дословно).**
> Persist encrypted Mastercard webhook events before ack

**Проблема.** Зашифрованный push (`{encrypted_payload:{data}}`) приходит, когда декрипт ещё НЕ
подключён (открытый блокер MTF/Prod: нужен Client-ключ расшифровки + per-tenant seam). Раньше
хендлер логировал и сразу `ack 200` БЕЗ сохранения → после 200 MC не ретраит, и событие ТЕРЯЛОСЬ
безвозвратно (оставалась только строка в логе).

### Сделано ✅
- **`WebhookHandler.handleEncrypted`:** сырой конверт ПЕРСИСТИТСЯ в `tx_status`
  (`eventType='ENCRYPTED'`, `payload` = весь конверт, включая `encrypted_payload.data`) **ДО** ack.
  Декрипта/обработки нет (поля под шифром); строки разбираются позже из БД, когда подключим декрипт.
- **persist-before-ack:** если запись падает (БД недоступна) — исключение НЕ глотаем → `500` → MC
  ретраит (событие не теряется). `200` отдаём только после успешного персиста.
- **Дедуп:** ключ = верхнеуровневый ref, если MC шлёт его ВНЕ шифра, иначе `enc:sha256(шифротекста)`
  (ретрай идентичного конверта → дедуп через `UNIQUE(eventRef)`; если MC ре-шифрует на каждый ретрай
  — хеш изменится, возможен дубль, дочистится после подключения декрипта).
- `tenantId=null` (partnerId под шифром); из статус-выдачи мерчанту (`findForTenant`) такие строки
  отфильтрованы (не статусный тип). Отдельной таблицы не заводили — переиспользуем `tx_status`
  (единый Postgres-источник вебхуков, по линии issue #4).

### Пост-ревью (2 прохода: баги/безопасность/оптимизация) ✅
- **Баг (Med):** ключ дедупа собирался через `??`, который НЕ отсекает пустую строку — пришедший
  пустым `eventRef=''` стал бы ключом, и все такие события схлопнулись бы в одну строку
  (`UNIQUE(eventRef)`) → потеря. Добавил `firstRef()` (первый непустой после trim); применил в
  `handleEncrypted` И в `normalize()` (тот же латентный баг в status/other-путях).
- **Тест на инвариант:** добавлен тест, что сбой персиста НЕ глотается (→ исключение → 500 → MC
  ретраит, а не ложный ack); тест на пустой ref → хеш; лог дубликата уточнён.
- **Безопасность:** перепроверено — token-gated + rate-limit, шифротекст непрозрачен и отфильтрован
  из выдачи мерчанту; неограниченный рост покрыт retention-итемом (`production-questions.md`).
- Итог проверок: **unit 176 / hermetic 18 / live 23**.

### Проверка ✅
- `tsc` чисто; **unit 174→176** (персист/дедуп по хешу/внешний ref/пустой ref/сбой персиста),
  **hermetic e2e 18** (зашифрованный push → `200 accepted`, ретрай того же → `duplicate`),
  **live e2e 23**.

**Статус:** сделано и проверено. Сам декрипт остаётся открытым блокером (нужен Client-ключ
расшифровки + per-tenant seam) — этот issue про durability (не терять событие), не про декрипт.

---

## Issue 7 — Remove noop Mastercard webhook signature verifier

**Требование (дословно).**
> Remove noop Mastercard webhook signature verifier

**Проблема.** На пути вебхука был каркас `WebhookSignatureVerifier` (с дефолтной реализацией
`NoopSignatureVerifier`) как «второй фактор аутентификации». Но чтение доки MC закрыло бывший
вопрос «C1»: тело push MC **не подписывает** — аутентичность push у Mastercard обеспечивается
**mTLS** (публичный mTLS-cert от MC + trust + наш cert-chain через KMP-портал). То есть `verify()`
мог только всегда `return true` — мёртвый код, который добавлял DI-провайдер, инжектируемую
зависимость, вводящий в заблуждение тест «valid signature» и неиспользуемую обвязку `rawBody`,
намекая на проверку, которой не существует.

### Сделано ✅
- **Удалён** `src/webhooks/webhook-signature.verifier.ts` (абстрактный класс + noop-реализация).
- **`WebhookAuthGuard`:** убраны инжект `WebhookSignatureVerifier` и ветка `signature.verify(...)`
  (+ 401 `invalid webhook signature`). Теперь guard — один честный фактор: fail-closed
  `X-Webhook-Token`. Док класса переписан: у MC нет подписи payload (аутентичность = mTLS);
  `RawBodyRequest<Request>` → `Request`.
- **`WebhooksModule`:** убран провайдер `{ provide: WebhookSignatureVerifier, useClass: ... }`.
- **`main.ts`:** убран `rawBody: true` из `NestFactory.create(...)` — его единственной целью была
  побайтовая проверка подписи, которой больше нет.
- **Spec:** убраны мок verifier-а и тест «rejects when the signature verifier returns false»;
  «accepts the correct token (and a valid signature)» → «accepts the correct token».

### Проверка ✅
- `tsc` чисто; **unit 175 / hermetic 18 / live 23** (guard-spec потерял тест noop-подписи).
- В `src/` не осталось ссылок на `WebhookSignatureVerifier`/`rawBody` (grep чисто).

**Статус:** сделано и проверено. Если MC когда-нибудь введёт реальную подпись payload — она
добавляется тогда точечной правкой guard-а; держать noop-seam ради проверки, которой у MC нет,
смысла нет.

---

## Issue 8 — Simplify transaction status persistence

**Требование (дословно).**
> Simplify transaction status persistence. TransactionStatusStore currently duplicates varchar
> limits in WIDTHS and truncates webhook fields before insert.

**Проблема.** В `TransactionStatusStore` лежала карта `WIDTHS`, дублировавшая значения
`@Column({ length })` уже объявленные на `TransactionStatusEntity` — два источника правды, которые
могут (и уже) расходиться: у `eventType` колонка была `varchar(32)`, а DTO-кап — 64. Затем каждое
поле усекалось под эти ширины перед вставкой. Усечение существовало только потому, что проекционные
колонки были произвольным маленьким `varchar(n)`: `status`/`stage`/`transactionType` берутся из
произвольных мест тела MC и НЕ валидируются DTO по длине → без усечения слишком длинное значение
дало бы «value too long» → 500 → срыв контракта «всегда 200» → бесконечный ретрай MC.

### Сделано ✅
- **Entity:** проекционные колонки `eventType`/`transactionType`/`status`/`stage` теперь `text`
  (нет ширины). Нечего переполнять → нечего усекать. Полное событие всё равно целиком в `payload`
  (jsonb), и эти колонки не индексируются.
- **Store:** удалены и константа `WIDTHS`, и хелпер `trunc()`. `record()` вставляет значения как
  есть. Риска 500 нет: `text`-проекции не переполняются, а индексируемые `varchar`-колонки
  ограничены выше по стеку — `eventRef`/`transactionReference` через `@MaxLength` в DTO вебхука,
  `tenantId` — внутренний резолвнутый id. Единый источник правды = entity.
- **Миграция:** проекционные колонки `tx_status` `varchar(…)` → `text` в `InitialSchema`
  (пересобрано на свежем volume; `migration:generate` затем = **«No changes»**: entity == миграция
  == БД).
- **Тест:** e2e-кейс, проверявший усечение («overlong status усекается под varchar(32)»),
  переписан на лучший инвариант — слишком длинный status сохраняется **целиком**, а вебхук всё
  равно отвечает 200 (никогда не 500).
- **Доки (RU+EN):** в `documentation.md` обновлены типы колонок tx_status + описание `record`.

### Проверка ✅
- `tsc` чисто; миграция `No changes`; **unit 175 / hermetic 18 / live 23** (e2e-тест усечения
  переписан, а не удалён — счётчики не изменились).
- `WIDTHS` / `trunc` в `src/` больше нет (grep чисто).

**Статус:** сделано и проверено. `varchar(n)` с произвольным `n` был единственной причиной WIDTHS и
усечения; `text` снимает оба, сохраняя гарантию «всегда 200».

---

## Issue 9 — Organize module files by responsibility

**Требование (дословно).**
> Organize module files by responsibility. Current module files are placed directly in the module
> root folder. This makes the module harder to navigate as it grows. Move controllers to
> controllers/, services/handlers to services/, guards to guards/, entities to entities/, DTOs to
> dto/; update imports after moving files; keep module root clean with only the module definition
> and public exports if needed.

**Подход.** Применил конвенцию ко ВСЕМ feature-модулям **и** к `common/` (общий кит). Файлы, не
попадающие в 5 названных папок, разложены по ответственности: handler/store/registry/seed и
низкоуровневые сервисы → `services/`; interceptor → `interceptors/`; decorator → `decorators/`.
Маленькие `*.types.ts` и константы (`mc-paths.ts`) остаются в корне модуля (публичная поверхность /
крошечные); каждый `*.spec.ts` лежит рядом с тестируемым файлом. `config/`, `database/`, `types/` и
файлы зонтичного модуля/харнесса в корне `src/` (`mastercard.module.ts`, `app.module.ts`, `main.ts`,
`index.ts`, `dev-seed.service.ts`, `mastercard.entities.ts`) оставлены
как есть.

### Сделано ✅
- **Feature-модули** сгруппированы по ответственности:
  - `admin/` → `controllers/`, `services/` (dto/ уже был)
  - `audit/` → `entities/`, `services/`, `interceptors/`
  - `auth/` → `controllers/`, `services/` (oauth.service + client-registry), `entities/`,
    `decorators/` (guards/, dto/ уже были)
  - `credentials/`, `secrets/`, `mastercard/`, `encryption/` → `services/`
  - `crossborder/` → `controllers/`, `services/` (service + payment-idempotency.store), `entities/`
  - `tenants/` → `entities/`, `services/` (registry + seed)
  - `webhooks/` → `controllers/`, `services/` (handler + transaction-status.store), `entities/`,
    `guards/`
  - `health/` → `controllers/`
- **`common/`** (общий кит) → `guards/`, `pipes/`, `decorators/`, `filters/`, `utils/` (dto/ был).
- **Корни модулей чистые:** в каждом — только его `*.module.ts` (+ маленький `*.types.ts`/
  `mc-paths.ts` где есть). Все импорты обновлены (проверено `tsc`).

### Проверка ✅
- `tsc` чисто; **unit 175 / hermetic 18 / live 23** — всё зелёное после переноса (поведение не менялось).
- Все `*.module.ts` и публичная поверхность встраивания (`index.ts`, `MASTERCARD_ENTITIES`) не тронуты.

**Статус:** сделано и проверено. Чисто структурный перенос — логика не тронута; публичный API пакета
(`index.ts`) и seam встраивания в хост не изменились.

### Follow-up (2026-06-18) — dev-харнесс вынесен в `src/harness/`
Юзер заметил «голые» файлы в корне `src/` и попросил доделать по папкам. Корень `src/` **намеренно**
держал 7 файлов (публичная поверхность + dev-харнесс); кросс-таск аудит подтвердил — фича-модули все
чисты, ничего не «недоделано». Единственное осмысленное улучшение — отделить dev-харнесс от
эмбеддабл-поверхности: `main.ts` + `app.module.ts` + `dev-seed.service.ts` → **`src/harness/`** (`git mv`,
внутренние импорты `./`→`../`). В корне остались только **публичный контракт**: `index.ts`,
`mastercard.module.ts`, `mastercard.module-definition.ts`, `mastercard.entities.ts` (их перемещать нельзя —
сломает импорт пакета хостом). Правки: `nest-cli.json` `entryFile: harness/main`; 5 внешних импортов
`../src/app.module`→`../src/harness/app.module` (2 e2e + `ping`/`seed`/`boot-check`); run-команды в
README/tests/memory. Проверка: `nest build` ✓ (`dist/harness/main.js`), `tsc` чисто, **hermetic e2e 18/18**
(реально бутстрапит `AppModule` из нового пути), unit 202.

---

## Issue 10 — Remove HostIntegrityService and make module integration explicit

**Требование (дословно).**
> Remove HostIntegrityService and make module integration explicit

**Проблема.** `HostIntegrityService` был рантайм-«нянькой»: на `onApplicationBootstrap` он
интроспектировал хост и выдавал мягкие **`WARN`**, если (1) в DataSource нет наших сущностей или
(2) пуст `webhookToken`. Библиотека, которая в рантайме воспитывает хост легко-пропускаемыми
предупреждениями, — неправильная форма: контракт интеграции должен быть **явным** (объявлен в API и
доке, проверяется там, где потребляется), а не «обнаруживаться» самопроверкой.

### Сделано ✅
- **Удалён** `src/host-integrity.service.ts` (+ spec) и убран из провайдеров `MastercardModule`
  (других потребителей нет).
- **Интеграция теперь — явный контракт**, заявленный там, где проверяется/потребляется (ничего из
  того, что давал сервис, не потеряно — каждый пункт падает громко сам):
  - **Обязательный конфиг** → типизированные `MastercardModuleOptions` + **fail-fast** в
    `GatewayConfig` (бросает на старте при отсутствии обязательной опции / слабом прод-секрете) — уже
    было.
  - **Сущности** → экспорт `MASTERCARD_ENTITIES`, который хост обязан вписать в свой DataSource;
    забытая сущность → `EntityMetadataNotFoundError` при первом использовании (громко, не молчаливый
    WARN).
  - **webhookToken** → fail-closed guard уже отвечает `401` при пустом токене (явно в момент запроса).
  - **Инфраструктура от хоста, которую нельзя выразить кодом** (shutdown-хуки, route-парсер для
    RFI) → чек-лист **«Host integration checklist»** в README.
- **Док `MastercardModule`** переписан: вместо ссылки на самопроверку — явный контракт. **Чек-лист
  README** переформулирован («явный контракт, не рантайм-надзор») и почищен: убран устаревший пункт
  `ScheduleModule`/`kv_store` `@Cron` (KV-слой удалён в #4), исправлен путь перемещённого
  `rfi-upload.bodyparser`.

### Проверка ✅
- `tsc` чисто; **unit 171 / hermetic 18 / live 23** (unit −4 / один сьют: `host-integrity.service.spec`
  на 4 теста удалён вместе с сервисом).
- В `src/` не осталось ссылок на `HostIntegrityService` (grep чисто).

**Статус:** сделано и проверено. Модуль больше не интроспектирует хост; что хост обязан
предоставить — явно в типизированных опциях (fail-fast), экспорте `MASTERCARD_ENTITIES` и чек-листе
README.

---

## Issue 11 — Move RFI upload body limit into Nest middleware

**Требование (дословно).**
> Move RFI upload body limit into Nest middleware

**Проблема.** Загрузка RFI-документа (`POST /crossborder/rfi/documents`) несёт base64-файл до
~1.37MB — выше строгого лимита 256kb. Лимит был прописан сырым Express в `main.ts`
(`app.use(RFI_UPLOAD_PATH, rfiUploadBodyParser())`) + экспортируемый хелпер + пункт чек-листа «вызови
сам» — а не через механизм NestJS middleware.

**Порядок body-парсеров (суть, проверено эмпирически).** Express берёт первый парсер, ставящий
`req._body`; значит увеличенный RFI-лимит должен сработать ДО строгого глобального. Два факта:
(1) `app.useBodyParser(...)` в `main.ts` регистрируется ДО `app.init()`, т.е. раньше любого
`configure()`-middleware — middleware его не опередит; (2) межмодульный порядок `configure()` —
**root-first** (middleware суб-модуля идёт ПОСЛЕ корневого). Поэтому оба лимита должны быть в
`configure` **корневого** модуля, RFI — первым. (Live-тест 500KB «upload ~500KB → не 413» перешёл
с 413 на 502/pass после правильного порядка.)

### Сделано ✅
- **`AppModule.configure(consumer)`** (Nest middleware) теперь владеет body-парсингом:
  1. `json({limit:'2mb'})` → `POST /crossborder/rfi/documents` (ПЕРВЫМ → выигрывает по
     first-parser-sets-`req._body`);
  2. `json({limit:'256kb'})` + `urlencoded` → `'*'` (строгий глобальный лимит для всех прочих).
- **Убраны** сырой `app.use(RFI_UPLOAD_PATH, rfiUploadBodyParser())` и вызовы `app.useBodyParser(...)`
  из `main.ts` и обоих e2e-харнессов (парсинг теперь из `AppModule.configure`).
- **Удалён** `src/common/utils/rfi-upload.bodyparser.ts`; убраны публичные экспорты
  `RFI_UPLOAD_PATH` / `rfiUploadBodyParser` из `index.ts`.
- **README / доки (RU+EN):** пункт хост-интеграции теперь «обеспечьте лимит тела для RFI-маршрута
  (≥~1.4MB)», а не «вызовите наш экспортируемый парсер»; список экспортов + описание `common/` в
  architecture обновлены.

### Проверка ✅
- `tsc` чисто; **live e2e**: загрузка ~500KB RFI → **502 (доходит до MC), не 413** — route-scoped
  лимит 2MB работает, прочие маршруты держат 256kb. Полный прогон ниже.

**Статус:** сделано и проверено. RFI-лимит — Nest middleware в корневом модуле; кастомный
Express-хелпер и его публичные экспорты убраны. При встраивании body-парсингом владеет хост
(задокументировано), т.к. middleware суб-модуля не опередит глобальный парсер хоста.

## Issue 12 — Replace custom passthrough validation pipe with shared validation strategy

**Требование (дословно).**
> Replace custom passthrough validation pipe with shared validation strategy

**Проблема.** Валидация была размазана по двум кастомным фактори в `common/pipes/`:
`mcPassthroughPipe()` (мягкий: `whitelist:false, forbidNonWhitelisted:false, transform:false,
skipMissingProperties:true` — для тел, идущих в Mastercard) и `strictDtoPipe()` (строгий:
`whitelist+forbidNonWhitelisted+transform` — для наших границ admin/oauth). Каждый — отдельный
фабричный хелпер, вызывался на каждом роуте (`mcPassthroughPipe()` создавал НОВЫЙ инстанс на каждый
из ~11 проходов). «Кастомный passthrough-pipe» как отдельная сущность — то, на что указал тимлид.

**Решение (по согласованию — единая стратегия + пресеты).** Свёл оба в ОДНУ общую стратегию
валидации с двумя именованными пресетами. Глобальный pipe / `APP_PIPE` сознательно НЕ используем:
модуль встраиваемый, а `APP_PIPE` из feature-модуля применяется ко всему приложению и протёк бы в
роуты хост-монолита (или там был бы другой / отсутствовал). Поэтому связывание остаётся per-route
через `@UsePipes`, но конфигурация — одна.

### Сделано ✅
- **Новый `src/common/pipes/gateway-validation.pipe.ts`:** `enum ValidationStrategy { Strict,
  Passthrough }` + `gatewayValidationPipe(strategy)`. Внутри — два ШАРЕННЫХ stateless-инстанса
  `ValidationPipe` (по одному на пресет), переиспользуются на всех роутах — ровно как единый
  глобальный pipe, но без навязывания хосту. Опции пресетов байт-в-байт совпадают со старыми
  фактори → поведение идентично.
- **Удалены** `common/pipes/mc-passthrough.pipe.ts` и `common/pipes/validation.pipe.ts`.
- **Контроллеры** (`crossborder` ×10, `webhooks`, `oauth`, `admin`) переведены на
  `@UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough|Strict))`.
- **Комментарии/доки:** `main.ts`, `admin.service`, `create-tenant.dto`, 6 crossborder-DTO,
  webhook-контроллер, тест-нейм + доки RU/EN (architecture, api, memory, plan) + README. Попутно
  вычистил из architecture протухшие ссылки (`idempotency-key.*` удалён в #3, `validation.pipe.ts` —
  теперь).
- **`index.ts` не тронут** — pipe'ы и так были приватными (не breaking для хоста).

### Проверка ✅
- `tsc` чисто, ESLint чисто; **unit 171 / hermetic 18 / live 23** — без дрейфа счётчиков (поведение
  сохранено 1:1). Hermetic-тест «quotes amount=number → 400» подтверждает работу пресета Passthrough,
  admin/oauth-тесты — пресета Strict.
- Анализ на баги + code review (по 1 проходу): дефектов нет. Шаринг инстансов безопасен (pipe
  stateless, DTO-metatype приходит per-call из `ArgumentMetadata`); нет циклов/проблем порядка
  инициализации; публичный API не изменён.

**Статус:** сделано и проверено. «Кастомный passthrough-pipe» заменён одной общей стратегией
валидации с пресетами `Strict`/`Passthrough`; связывание per-route сохранено ради встраиваемости.

## Issue 13 — Replace env validation with Zod

**Требование (дословно).**
> Replace env validation with Zod

**Проблема.** Валидация переменных окружения (`src/config/env.validation.ts`) была на
`class-validator` + `class-transformer`: класс `EnvVars` с декораторами + `plainToInstance` +
`validateSync`. Тимлид хочет на Zod — декларативная схема вместо класса-с-декораторами (и без
зависимости env-валидации от рефлексии/`reflect-metadata`).

### Сделано ✅
- **Добавлен `zod@^3.23.8`** в `dependencies` (`class-validator`/`class-transformer` НЕ трогал —
  на них держатся DTO и `gatewayValidationPipe`; меняется только механизм env-валидации).
  **(Позже выровнен на `zod@^4.4.3`** — хост `b24club-api` использует zod v4; мой базовый API
  (`z.object`/`.min`/`.enum`/`.optional`/`.regex`/`safeParse`/`error.issues`) стабилен между v3↔v4,
  `env.validation.spec` 21/21 и e2e зелёные под v4. zod v4 `"type":"module"`, но ships CJS-`require`
  (хост сам на CJS-билде с zod v4 — доказательство совместимости).)
- **`env.validation.ts` переписан на Zod:** схема `z.object({...})` 1:1 повторяет прежние правила —
  обязательные строки (`z.string().min(1)`), `MC_JWT_SECRET` → `min(16)`, опциональные
  enum'ы (`z.enum(['true','false'])`, `z.enum(['local','vault'])`), `DB_POOL_MAX` → строка
  положительного целого (`/^[1-9][0-9]*$/` — чуть строже прежнего `isNumberString`, который пускал
  знаки/дробные вроде `-3.5`, бессмысленные для размера пула; нашёл ревью-проход, fail-fast лучше).
  `validateEnv(config)` сохраняет контракт `ConfigModule.validate`:
  на ошибке бросает `Invalid .env configuration: <path>: <msg>; …`, при успехе **возвращает исходный
  `config`** (не parsed) — чтобы НЕ объявленные в схеме переменные (`NODE_ENV`, `PORT`, PoC-ключи)
  остались доступны в `ConfigService` (Zod незнакомые ключи игнорирует, а не отвергает). Значения —
  по-прежнему строки (без coercion): приложение само конвертит (`=== 'true'`, `Number(...)`).
- **Новый `env.validation.spec.ts`** (env-валидация раньше НЕ покрывалась тестами): валидный конфиг
  проходит и возвращается as-is; сохранность `NODE_ENV`/`PORT`; каждый из 9 обязательных при пропуске
  → throw с именем ключа; пустая обязательная строка; короткий `MC_JWT_SECRET`; валидные опционалы;
  невалидные значения enum/числа → throw.
- **Доки RU+EN** (architecture, plan, memory): «class-validator» → «Zod» в описании env-валидации
  (прочие упоминания class-validator — про DTO и benign peer-warning — оставлены).

### Проверка ✅
- `tsc` чисто, ESLint чисто; **unit 192** (+21 — новый env-спек) **/ hermetic 18 / live 23**. Оба
  e2e-сьюта поднимают `AppModule` → `ConfigModule.forRoot({ validate: validateEnv })`, т.е. реально
  бутстрапятся через Zod-валидацию — миграция подтверждена end-to-end.

**Статус:** сделано и проверено. Env-валидация — на Zod-схеме; контракт `validateEnv` и поведение
(fail-fast, passthrough незнакомых ключей, строки без coercion) сохранены 1:1.

## Issue 14 — Split CredentialsService responsibilities

**Требование (дословно).**
> Split CredentialsService responsibilities

**Проблема.** `CredentialsService` тянул сразу ~7 обязанностей: dispatch PLATFORM/OWN, загрузку+вечный
кэш платформенных ключей, fetch OWN из SecretStore, OWN-кэш (TTL+LRU+stampede), sanitize
(`safePartnerId`/`safeSecretRef`), валидацию бандла, нормализацию ключа в PEM. Нарушение SRP.

**Решение (по согласованию — фасад + 2 провайдера + кэш).** Чисто структурный рефактор, поведение 1:1.
Внешний контракт неизменен: наружу экспортируется только `CredentialsService` (его инжектит лишь
`CrossBorderService` через `resolve()`; `invalidate()` пока не вызывается).

### Сделано ✅
- **`CredentialsService`** → тонкий **фасад**: `resolve(tenant)` диспатчит PLATFORM/OWN, `invalidate()`
  делегирует OWN-провайдеру. Остаётся единственным экспортом модуля.
- **`PlatformCredentialsProvider`** — платформенные ключи из конфига, вечный кэш, `onModuleInit`-warm
  (fail-fast на кривом .p12 на старте, а не на первом запросе).
- **`OwnCredentialsProvider`** — fetch OWN: `safeSecretRef`→SecretStore→`validateBundle`→`safePartnerId`
  →`toPem`→`McCredentials`; через кэш; `invalidate()`.
- **`OwnCredentialsCache`** (`services/own-credentials.cache.ts`) — изолированный TTL+LRU(≤500)+stampede
  кэш с API `getOrCreate(id, factory)`/`invalidate`/`size`; rejected-резолв выселяется (не залипает на TTL).
- **`utils/credential-sanitize.ts`** — pure-гварды `safePartnerId`/`safeSecretRef` (используют оба
  провайдера; 422 при невалидном, деталь в лог, наружу — generic).
- **Спек разбит** на 4 файла (`credentials.service` фасад / `own-credentials.provider` валидация /
  `own-credentials.cache` механика кэша / `platform-credentials.provider`) — каждая забота тестируется
  изолированно (кэш — без DI). Комменты-ссылки (`create-tenant.dto`, `vault-secret-store`,
  `encryption.service`) и доки RU/EN (documentation/architecture/tests-inner/production-questions) обновлены.

### Проверка ✅
- `tsc` чисто, ESLint чисто (после --fix); **unit 205 / hermetic 18 / live 23**. Оба e2e поднимают
  `AppModule` → новые провайдеры резолвятся через Nest DI, приложение бутстрапится → разбиение
  подтверждено end-to-end. `CredentialsService.resolve` (публичный API) не изменился — `CrossBorderService`
  и его спек не тронуты.

**Статус:** сделано и проверено. `CredentialsService` — тонкий фасад; каждая обязанность в своём классе
(2 провайдера + кэш) или pure-утиле; поведение и публичный контракт сохранены 1:1.

## Issue 15 — Replace custom in-memory LRU cache with cache-manager

**Требование (дословно).**
> Replace custom in-memory LRU cache with cache-manager

**Контекст / ограничение (выяснено до правок).** Кастомный `OwnCredentialsCache` (из #14) делал
TTL + LRU(500) + **stampede-дедуп** + evict-on-reject. Ключевой факт: **cache-manager v6/v7 —
ESM-only** (`"type":"module"`, как и keyv v5) → не подключается в нашем **CommonJS**-билде (NestJS 10,
ts-jest, `module:commonjs`). Совместима только **cache-manager v5** (CJS), а её `wrap` **НЕ** коалесит
конкурентные промахи (stampede-coalescing появился в v6). `pemCache` в `p12.util` вне scope — он
обязан быть синхронным (cache-manager async, `loadPrivateKeyFromP12` зовётся из sync-путей).

**Решение (выбор юзера — «cache-manager v5, дроп stampede»).** Заменил `OwnCredentialsCache` на
cache-manager v5; смоук-тестом подтвердил поведение стора (CJS require, `wrap` кэширует на hit, `del`
рефетчит, LRU `max` вытесняет, TTL в мс истекает, reject не кэшируется).

### Сделано ✅
- **Добавлен `cache-manager@^5.7.6`** (CJS). `OwnCredentialsProvider` теперь держит
  `caching('memory', { max: 500, ttl: credsCacheTtlMs })` (ленивая async-инициализация, мемоизирована)
  и резолвит через `cache.wrap(tenant.id, () => this.fetch(tenant))`; `invalidate()` → `cache.del(id)`
  (fire-and-forget, не бросает наружу). TTL + LRU(500) + evict-on-reject сохранены.
- **Удалены** `own-credentials.cache.ts` и `own-credentials.cache.spec.ts` (механику кэша держит
  библиотека). `fetch`/`validateBundle`/`toPem`/sanitize — без изменений. Публичный контракт
  (`CredentialsService.resolve`/`invalidate`) не тронут; CredentialsModule без изменений (cache-manager
  используется напрямую, БЕЗ `@nestjs/cache-manager` CacheModule — не навязываем хосту глобальный модуль).
- **Дропнут stampede-дедуп** (в v5 его нет): параллельные холодные resolve одного тенанта могут уйти
  в SecretStore N раз (корректно, чуть менее эффективно на cold-burst). Тесты кэша переписаны на уровень
  провайдера: hit → один fetch, `invalidate` → рефетч, отклонённый resolve не кэшируется.
- Доки RU/EN (architecture/documentation/tests-inner) обновлены.

### Проверка ✅
- Смоук-тест cache-manager v5 (CJS): hit-дедуп=1, del→2, LRU max=2 вытесняет, TTL 80мс истекает, reject
  не кэшируется. `tsc` чисто, ESLint чисто; **unit 202 / hermetic 18 / live 23** (оба e2e реально
  бутстрапят `OwnCredentialsProvider` с cache-manager через Nest DI).
- **4 аудита на баги по 1 агенту** (faithfulness / concurrency-async / security-DI-deps / zod-v4): 3 чисто,
  **1 MED исправлен** — при отклонённой инициализации `caching()` rejected-промис мемоизировался в
  `this.cache` и «отравлял» все будущие `get()` навсегда; фикс — self-reset слота в `cacheStore()` (на
  `init.catch` чистим `this.cache`, если он ещё тот же; rejection не маскируется). Re-проверка после фикса
  зелёная.
- **Совместимость с хостом `b24club-api`** (проверена по его package.json): cache-manager pin выровнен
  `^5.7.6`→**`^5.4.0`** (хост на `^5.4.0` + `@nestjs/cache-manager ^2.2.2` → тоже v5; не задираем floor).
  Попутно **zod выровнен `^3.23.8`→`^4.4.3`** (хост на zod v4): мой env-API стабилен v3↔v4, `env.validation.spec`
  21/21 и e2e зелёные под v4 (zod v4 `"type":"module"`, но ships CJS-`require` — хост сам на CJS+zod4).

**Статус:** сделано и проверено. Кастомный LRU заменён на cache-manager v5 (forced — v6/v7 ESM-несовместимы
с CJS-билдом); stampede-coalescing сознательно убран (в v5 отсутствует), что задокументировано. Версии
cache-manager/zod выровнены под хост.

## Issue 16 — Split CrossBorder module by API area

**Требование (дословно).**
> Split CrossBorder module by API area

**Проблема.** `CrossBorderModule` = один жирный контроллер (421 стр, ~25 эндпоинтов) + один сервис
(511 стр) на 6 API-областей. Сервис = тонкие per-area методы над общим движком (run/call/resolveActive/
partner/qs/headers). Внешний DI-потребитель — только контроллер (export `CrossBorderService` был
вестигиальным — никто кросс-модульно не инжектил).

**Решение (выбор юзера из 3 — «контроллеры + сервисы + движок», полный SRP).** Поведение 1:1; пути,
заголовки, гейтинг, idempotency, status-events — без изменений.

### Сделано ✅
- **`gateway/cross-border.gateway.ts`** — `CrossBorderGateway`: общий движок (вынесены из сервиса
  `run`/`call`/`resolveActive`/`partner`/`qs`/`mcRefHeaders`/`catalogHeaders` — стали public; deps
  TenantRegistry+CredentialsService+MastercardClient).
- **6 областей**, каждая = `<area>/<area>.controller.ts` + `<area>.service.ts` (+спек):
  `accounts` (balances/rates), `quotes` (create/confirm/cancel/retrieve), `payments` (create+idempotency/
  get/byRef/cancel/status-events; инжектит gateway+PaymentIdempotencyStore+TransactionStatusStore),
  `validations` (address/account/bank/iban/endpoint-guide — все на mcRefHeaders), `cash-pickup`
  (countries/cities/providers/branches), `rfi` (retrieve/update/upload/download). Сервисы — тонкие,
  делегируют движку.
- **`decorators/cross-border-area.decorator.ts`** — композит `@CrossBorderArea()` (guards
  TenantAuth+TenantThrottler, ApiTags/ApiBearerAuth/ApiSecurity/ApiHeader/ApiErrorResponses/502,
  UseGatewayContract) — один источник cross-cutting-обвязки для всех 6 контроллеров (как `@UseGatewayContract`).
  Каждый контроллер: `@Controller('crossborder') @CrossBorderArea()` (общий префикс, пути не коллизят).
- `payment-idempotency.store.{ts,spec}` перенесён `services/`→`payments/`. Удалены старые
  `crossborder.{controller,service}.ts`+спек; пустые `controllers/`/`services/` ушли. `CrossBorderModule`
  регистрит gateway+6 сервисов+6 контроллеров+PaymentIdempotencyStore+TenantThrottlerGuard; **export
  снят** (вестигиальный). Спек 287-стр разбит на gateway-спек (call-диспетч+гейтинг) + 5 area-спеков.
  Доки RU/EN (architecture-диаграмма/таблица/flow, documentation, tests-inner, tests) обновлены.

### Проверка ✅
- `tsc` чисто, ESLint чисто (после --fix); **unit 203 / hermetic 18 / live 23** (оба e2e реально
  бутстрапят 6 контроллеров под одним `@Controller('crossborder')` без коллизий маршрутов + gateway через
  Nest DI → разбиение подтверждено end-to-end).
- **4 анализа на баги по 1 агенту** (faithfulness / routing-DI / security / spec-coverage): 3 чисто,
  **1 HIGH в спеке исправлен** — `retrieveConfirmedQuote`-тест брал ref без спецсимволов (`40C123`),
  поэтому проверка «оба сегмента кодируются» проходила ВАКУУМНО для ref (так было и в исходном тесте);
  ref→`'40C 123'` с пробелом → теперь реально доказывает `encodeURIComponent` ОБОИХ сегментов (prod
  кодирует оба — `mc-paths`). Re-проверка зелёная.

**Статус:** сделано и проверено. Жирный CrossBorder разрезан на 6 областей (контроллер+сервис) над общим
`CrossBorderGateway`; поведение и маршруты 1:1, публичный контракт (никто не инжектил сервис) не нарушен.

### Follow-up (2026-06-18) — by-type внутри каждой области
Юзер захотел, чтобы каждая область была самодостаточной с внутренними `controllers/`/`services/`/`dto/`
(как by-type-конвенция #9 в остальных модулях), а area-DTO лежали ВНУТРИ области, а не в общей `dto/`.
Сделано: 31 файл `git mv` в `<area>/{controllers,services,dto,entities}/`; 10 area-DTO разъехались из общей
`crossborder/dto/` по своим областям; `payment-idempotency` store→`payments/services/`, entity→`payments/entities/`.
Общими (крос-область) остались `gateway/` (движок), `decorators/` (`@CrossBorderArea`) и `dto/mc-amount.dto`
(тянут и quotes, и payments — внутрь одной области нельзя без кросс-связи). Импорты пересчитаны (tsc как
ground truth); правки вне перемещённых — только `crossborder.module.ts` (пути 6 контроллеров/6 сервисов/
store/entity) и `mastercard.entities.ts` (путь `PaymentIdempotencyEntity`). Пустой `crossborder/entities/`
удалён. Проверка: `tsc` чисто, ESLint чисто, **hermetic e2e 18/18** (6 контроллеров бутстрапятся через DI
по новым путям), unit 202. Замечание: часть `controllers/` теперь однофайловые — осознанный выбор юзера ради
единообразия с #9.
