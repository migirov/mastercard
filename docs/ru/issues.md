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
- Чистка комментариев про `synchronize` (напр. `src/tenants/tenant.entity.ts`).

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
`MASTERCARD_ENTITIES` остаётся экспортом пакета для хоста (seam встраивания) и для проверки на
старте в `HostIntegrityService`.

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
`MastercardClient` (`src/mastercard/mastercard-client.service.ts`) — больше нигде (подтверждено
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
- **Новый `src/tenants/tenant.seed.ts`** — единый источник сид-данных: `PLATFORM_TENANT`,
  `DEMO_TENANTS` (acme/own-sandbox/own-demo) + идемпотентный `seedTenants(repo, list)`
  (`INSERT … ON CONFLICT DO NOTHING RETURNING id`, без гонок при multi-pod; existing НЕ
  перезаписываются → admin-правки approval/suspend сохраняются; возвращает реально вставленные).
- **`src/dev-seed.service.ts` (`DevSeedService`)** — провайдер ТОЛЬКО dev-харнесса (в `AppModule`,
  НЕ во встраиваемом `MastercardModule`): на `onApplicationBootstrap` сеет базовый `platform`
  (zero-config для `ts-node src/main.ts`/`ping`/e2e). Хост его не получает → в БД хоста модуль на
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
