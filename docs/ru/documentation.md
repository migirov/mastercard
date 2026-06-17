# Документация: сущности

Описание доменных сущностей сервиса Mastercard Cross-Border Gateway.

Связанные документы: [architecture.md](./architecture.md) (дизайн),
[plan.md](./plan.md) (статус), [memory.md](./memory.md) (контекст сессии).

## Разделы

- [Хранение данных](#хранение-данных-где-бд-где-in-memory) — где Postgres, где in-memory
- [Шифрование](#шифрование-encryption--decryption) — JWE-интерцептор, вынос в отдельный сервис
- [Сценарии работы](#сценарии-работы-модель-мерчантов) — модель мерчантов (OWN / PLATFORM)

## Список сущностей

| Сущность | Хранение | Назначение |
|---|---|---|
| [Tenant](#tenant) | Postgres `tenants` | Партнёр/мерчант на платформе |
| [OAuthClient](#oauthclient) | Postgres `oauth_clients` | OAuth2-клиент партнёра (доступ к API) |
| [AuditLog](#auditlog-auditentry) | Postgres `audit_log` | Запись журнала операций |
| [KvEntry](#kventry-kv_store) | Postgres `kv_store` | Идемпотентность + дедуп НЕ-статусных вебхуков (с TTL) |
| [TransactionStatus](#transactionstatus-tx_status) | Postgres `tx_status` | Персист статусных push-уведомлений (Status Change) |
| [McCredentials](#mccredentials) | не хранится (резолв + кэш) | Резолвенные ключи Mastercard для тенанта |
| [MerchantSecretBundle](#merchantsecretbundle--keymaterial) | SecretStore/Vault | Секреты партнёра (ключи, consumerKey) |
| [McWebhookEvent](#mcwebhookevent) | статусные → `tx_status`; прочие — не хранятся | Payload push-уведомления Mastercard |

---

# Хранение данных (где БД, где in-memory)

Сервис деплоится в Docker/Kubernetes на **много подов**. Поэтому правило:

> В in-memory держим **только** то, что не требует согласованности между подами
> **и** эфемерно (потеря при рестарте пода не критична). Всё доменное и
> требующее консистентности — в **PostgreSQL**.

| Данные | Где | Слой | Почему |
|---|---|---|---|
| `tenants` | **Postgres** (TypeORM) | домен | создан на поде A → нужен на поде B |
| `oauth_clients` | **Postgres** (TypeORM) | домен | ключ выпущен на A → аутентификация на B |
| `audit_log` | **Postgres** (TypeORM) | домен | агрегируется со всех подов |
| `idempotency` | **Postgres** (`KvStore`→PG, TTL) | домен | ретрай платежа на другом поде → иначе двойное списание |
| webhook-дедуп (НЕ-статусные) | **Postgres** (`KvStore`→PG, TTL) | домен | ретрай вебхука MC на другом поде → иначе дубль |
| `tx_status` (статусные push) | **Postgres** (TypeORM) | домен | статус приходит на поде A → мерчант читает на B; дедуп = UNIQUE(eventRef) |
| rate-limit | самодостаточный per-pod `@nestjs/throttler` | эфемерный | корректность не зависит от ингресса; лимит на ингрессе, если есть — опциональная доп. защита, не authoritative |
| кэш креды | **in-memory per-pod** | кэш | источник истины — Vault/env; поды кэшируют независимо из одного источника, TTL ограничивает staleness |
| секреты партнёров | SecretStore (Vault) | внешнее | управляется секрет-менеджером, не наш слой |

**Redis НЕ используется** — для согласованного состояния выбран Postgres, для
эфемерного rate-limit — самодостаточный per-pod `@nestjs/throttler` (корректность
не зависит от ингресса); лимит на ингрессе, если есть — опциональная доп. защита,
не authoritative.

**Стек хранения:** PostgreSQL + TypeORM (`@nestjs/typeorm`), `synchronize` в dev
(авто-схема), миграции — в проде. Подключение через `DATABASE_URL`.

---

# Шифрование (encryption / decryption)

Mastercard требует **field-level encryption (JWE)**: тело запроса к MC шифруется,
ответ — расшифровывается. Код: [`src/encryption/`](../../src/encryption/),
интеграция — в [`src/mastercard/mastercard-client.service.ts`](../../src/mastercard/mastercard-client.service.ts).

## Где живёт (отдельный сервис + интерцептор)

- **`EncryptionService`** — отдельный сервис (JWE через `mastercard-client-
  encryption`), тумблер `MC_ENCRYPTION_ENABLED` (off=plain, on=JWE; FLE работает во
  всех средах, sandbox в том числе — доказано 2026-06-16).
- Вызывается **прозрачно из axios-интерцептора** `MastercardClient`, а **не** из
  бизнес-логики. `CrossBorderService` отдаёт чистый объект и про крипту не знает.

> Важно: «интерцептор» здесь — **axios-интерцептор** на границе **мы ↔ Mastercard**
> (исходящий вызов), а НЕ NestJS-интерцептор контроллера (граница мерчант ↔ мы).
> Шифруется то, что мы отправляем в MC.

## Поток (порядок строгий)

```
request-интерцептор:  1) зашифровать тело (encrypted_payload + x-encrypted:true)
                      2) подписать OAuth1 ПО ЗАШИФРОВАННОМУ телу (Authorization)
                      3) отправить
response-интерцептор: расшифровать тело ответа (passthrough, если plain)
```

Подпись обязана считаться по уже зашифрованному телу — поэтому и шифрование, и
подпись в одном request-интерцепторе. Ошибка расшифровки → 502.

## Можно ли вынести в отдельный сервис/процесс

**Да** — `EncryptionService` уже изолирован, и его вызов в интерцепторе можно
заменить на клиент к отдельному микросервису encryption (gRPC/HTTP). Точка выноса
локальная.

**Почему пока НЕ вынесли (минусы отдельного процесса):**
- 🔑 **Ключи переедут** в тот сервис — расширяется поверхность атаки и усложняется
  распределение/ротация приватных ключей.
- 🐢 **Сетевой round-trip** на каждый encrypt/decrypt → растёт latency платежа.
- 🧩 Сложнее обработка ошибок/таймаутов и транзакционность.
- ⚙️ В одном Node-процессе интерцептор **не разгружает CPU** — шифрование считается
  там же. Отдельный процесс разгрузит CPU, но ценой минусов выше.

**Текущее решение:** интерцептор в том же сервисе — развязывает **код** (бизнес-
логика чистая, крипта изолирована в `EncryptionService`), без сетевых издержек и
без выноса ключей. Если позже понадобится горизонтально разгрузить крипту —
заменяем вызов `EncryptionService` в интерцепторе на клиент к отдельному сервису.

---

# Сценарии работы (модель мерчантов)

Платформа мульти-мерчант, и партнёры подключаются по одному из **двух концептов**
(клиент подтвердил: нужны оба — «גם וגם»). Концепт тенанта задаётся полем
`credentialMode` ([CredentialMode](#credentialmode--откуда-ключи-mastercard)).

Ключевой факт (проверено по доке Mastercard): **в Cross-Border API нет поля
`merchant`/sub-account**. Mastercard различает сущности **только по `partner-id`
в пути URL**. Отсюда и два сценария.

## Основной сценарий — `OWN` (свой partner-id у каждого партнёра)

**Суть:** партнёр уже зарегистрирован в Mastercard как самостоятельный partner —
у него **свой `partner-id` и свои ключи** (signing, encryption). Он подключается к
нашей платформе как к шлюзу и через нас обслуживает **своих** бизнес-клиентов.

**Как работает:**
- Mastercard видит **каждого партнёра отдельно** — нативно по его `partner-id`.
- Мы храним ключи партнёра **per-tenant** в SecretStore/Vault (по `secretRef`).
- Запрос подписывается и шифруется **ключами партнёра** и уходит под **его
  `partner-id`**.
- `credentialMode = OWN`, у тенанта заполнены `partnerId` и `secretRef`.

**Когда:** это **целевой** сценарий по постановке клиента. Подходит, когда
подключаемые компании — сами Mastercard-партнёры со своим онбордингом.

```
партнёр X ──(свои ключи, partner-id X)──► Mastercard видит партнёра X
партнёр Y ──(свои ключи, partner-id Y)──► Mastercard видит партнёра Y
```

## Вторичный сценарий — `PLATFORM` (общий partner-id платформы)

**Суть:** сама **платформа** — это partner в Mastercard (один `partner-id`, один
набор ключей). Мерчанты работают как **логические суб-аккаунты** под общим
`partner-id`.

**Как работает:**
- Mastercard видит **одну** сущность — платформу. **Разделение мерчантов
  существует только на нашей стороне** (наш `tenant_id` + наш учёт/аудит), потому
  что поля merchant в API нет.
- Все запросы подписываются **общими ключами платформы** и уходят под **общим
  `partner-id`**.
- `credentialMode = PLATFORM`, `partnerId`/`secretRef` у тенанта не нужны
  (берётся общий из конфигурации платформы).

**Когда:** когда подключаемые мерчанты не имеют (или не хотят) собственного
онбординга в Mastercard и работают «под крылом» платформы.

```
тенант A ┐
тенант B ├─(общие ключи платформы, общий partner-id)─► Mastercard видит платформу
тенант C ┘   (различие A/B/C — только в нашей системе)
```

## Сравнение

| | `OWN` (основной) | `PLATFORM` (вторичный) |
|---|---|---|
| partner-id | свой у каждого | общий платформы |
| Ключи Mastercard | свои у каждого (Vault) | общие платформы |
| Как MC различает партнёров | нативно по partner-id | никак — видит платформу |
| Где изоляция мерчантов | у MC + у нас | **только у нас** |
| Поля тенанта | `partnerId` + `secretRef` | — |
| Онбординг в MC | у каждого партнёра свой | один (платформы) |

## Важно: «бизнес-клиенты» партнёра — это не сущности MC

В обоих сценариях конечные клиенты (отправитель/получатель платежа) — это **данные
транзакции** (`sender_account_uri` / `recipient_account_uri`, напр. телефон), а не
отдельные сущности в Mastercard и не наши тенанты. Тенант = **партнёр**, а не его
конечный клиент.

---

# Tenant

**Tenant (тенант)** — партнёр/мерчант на нашей мульти-мерчант платформе.
Это центральная сущность: к ней привязаны доступ (OAuth-клиенты), credentials
Mastercard, статус одобрения, изоляция (rate-limit, идемпотентность, audit).

> `tenant_id` — наш внутренний стабильный идентификатор клиента; не путать с
> `partner_id` (идентификатор в Mastercard, поле тенанта). Подробнее — в конце.

Код: [`src/tenants/tenant.types.ts`](../../src/tenants/tenant.types.ts),
реестр: [`src/tenants/tenant.registry.ts`](../../src/tenants/tenant.registry.ts).

## Поля

| Поле | Тип | Обяз. | Описание |
|---|---|:---:|---|
| `id` | `string` | да | Внутренний идентификатор тенанта (первичный ключ). Стабилен. |
| `name` | `string` | да | Человекочитаемое название компании. |
| `credentialMode` | `CredentialMode` | да | Откуда берутся ключи Mastercard: `PLATFORM` или `OWN`. |
| `partnerId` | `string?` | нет | Только для `OWN`: собственный partner-id партнёра в Mastercard. Для `PLATFORM` берётся общий partner-id платформы. |
| `secretRef` | `string?` | нет | Только для `OWN`: путь к секретам партнёра в SecretStore/Vault. |
| `platformApproved` | `boolean` | да | Одобрение со стороны платформы (наш оператор). |
| `mcApproved` | `boolean` | да | Одобрение со стороны Mastercard. |
| `suspended` | `boolean` | да | Аварийная блокировка (перекрывает одобрения). |

Статус (`ACTIVE` и т.п.) **не хранится** — вычисляется из флагов (см. ниже),
чтобы его нельзя было выставить в обход одобрений.

## Перечисления

### CredentialMode — откуда ключи Mastercard

| Значение | Смысл |
|---|---|
| `PLATFORM` | Общие ключи и partner-id платформы; тенант — логический суб-аккаунт. Вторичный сценарий. |
| `OWN` | Собственные ключи и partner-id партнёра (секреты в Vault по `secretRef`). **Основной сценарий.** |

### TenantStatus — вычисляемый статус доступа

| Статус | Когда |
|---|---|
| `PENDING` | Нет ни одного одобрения. |
| `PLATFORM_APPROVED` | Одобрено платформой, но не Mastercard. |
| `MC_APPROVED` | Одобрено Mastercard, но не платформой. |
| `ACTIVE` | Одобрено обоими и не заблокирован → **транзакции разрешены**. |
| `SUSPENDED` | Заблокирован (`suspended = true`), независимо от одобрений. |

## Вычисляемая логика

```ts
isActive(t)        = !t.suspended && t.platformApproved && t.mcApproved
effectiveStatus(t) = t.suspended            ? SUSPENDED
                   : платформа && mastercard ? ACTIVE
                   : платформа               ? PLATFORM_APPROVED
                   : mastercard              ? MC_APPROVED
                   :                           PENDING
```

**Гейтинг:** транзакционные операции (quote/payment/…) разрешены только при
`isActive(tenant) === true` (проверяется в `CrossBorderService`).

## Жизненный цикл

```
       создан (admin)
          │  platformApproved=false, mcApproved=false, suspended=false
          ▼
       PENDING ──approve/platform──► PLATFORM_APPROVED ─┐
          │                                             │ approve/mastercard
          └──approve/mastercard──► MC_APPROVED ─────────┤
                                                        ▼
                                                     ACTIVE  ◄── оба одобрения
                                                        │
                                          suspend ◄─────┴─────► unsuspend
                                                        ▼
                                                    SUSPENDED
```

Одобрения независимы и приходят из разных мест: `platformApproved` ставит наш
оператор, `mcApproved` — по факту одобрения Mastercard (вручную через admin-API
или, в перспективе, вебхуком).

## Связи с другими сущностями

- **OAuthClient** — у тенанта 0..N OAuth2-клиентов (`client_id`/`secret`), через
  которые внешние системы партнёра ходят в API. Выпускаются admin-API.
- **McCredentials** — резолвятся из тенанта (`CredentialsService.resolve`): для
  `PLATFORM` из конфигурации платформы, для `OWN` — из SecretStore по `secretRef`.
- **partner-id** — поле тенанта (`OWN`) либо общий партнёрский id платформы
  (`PLATFORM`); используется только на границе с Mastercard (в пути URL).
- Изоляция по `tenant_id`: rate-limit, идемпотентность платежей, audit-trail.

## Пример (JSON, представление admin-API)

```json
{
  "id": "acme",
  "name": "ACME Corp",
  "credentialMode": "OWN",
  "partnerId": "BEL_MCSXB1HS5fd",
  "platformApproved": true,
  "mcApproved": true,
  "suspended": false,
  "status": "ACTIVE"
}
```

> В ответах admin-API поле `secretRef` **не отдаётся** (внутренний путь к секретам),
> а `status` добавляется вычисленным.

## Где живёт и как управляется

- **Хранилище:** PostgreSQL (`TenantRegistry` поверх TypeORM-репозитория, таблица
  `tenants`) — источник истины, общий для всех подов.
- **Создание/управление — admin-API** (под `X-Admin-Token`):
  - `POST /admin/tenants` — создать (старт в `PENDING`);
  - `POST /admin/tenants/:id/approve/platform` — одобрение платформы;
  - `POST /admin/tenants/:id/approve/mastercard` — одобрение Mastercard;
  - `POST /admin/tenants/:id/suspend` · `…/unsuspend` — блокировка/разблокировка;
  - `POST /admin/tenants/:id/clients` — выпустить OAuth-клиента тенанту;
  - `GET /admin/tenants` · `GET /admin/tenants/:id` — просмотр.

### Валидация при создании (`CreateTenantDto`)

| Поле | Правило |
|---|---|
| `name` | строка, до 120 символов, обязательно |
| `credentialMode` | `PLATFORM` или `OWN`, обязательно |
| `id` | строка, до 64 символов, опц. (иначе генерируется) |
| `partnerId` | строка, до 128, опц. |
| `secretRef` | строка, до 256, опц.; для `OWN` обязателен (проверка в сервисе) |

## tenant_id vs partner_id (важно)

- `tenant_id` — **наш** стабильный внутренний id (auth, учёт, изоляция).
- `partner_id` — **идентификатор в Mastercard** (внешний, в URL запроса).
- Связь: `OWN` — 1:1; `PLATFORM` — много тенантов → один общий partner-id.
- Разделять нужно, т.к. partner_id внешний и может отличаться по средам
  (sandbox `SANDBOX_1234567` ≠ prod), а тенант существует у нас уже на этапе
  `PENDING`, когда partner_id ещё может быть не подтверждён.

---

# OAuthClient

**OAuthClient** — пара `client_id`/`client_secret`, по которой внешние системы
партнёра получают access-token (`POST /oauth/token`, grant `client_credentials`) и
дальше ходят в Cross-Border API под Bearer-JWT. У одного тенанта — 0..N клиентов.

Код: [`src/auth/client-registry.ts`](../../src/auth/client-registry.ts),
сущность (co-located в модуле): [`src/auth/oauth-client.entity.ts`](../../src/auth/oauth-client.entity.ts).
Таблица `oauth_clients`.

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `clientId` | `varchar(64)` PK | Публичный идентификатор клиента (`mc_…`). |
| `tenantId` | `varchar(64)` (индекс) | Какому тенанту принадлежит. |
| `secretHash` | `varchar(128)` | **SHA-256 от секрета** — сырой секрет НЕ хранится. |
| `revoked` | `boolean` | Отозван ли (мягкое удаление; не валиден для аутентификации). |
| `createdAt` | `timestamptz` | Когда выпущен. |

## Поведение

- **Выпуск** (`POST /admin/tenants/:id/clients`): генерируется `clientId` и
  `clientSecret` (crypto-random), в БД пишется только хэш. **Сырой секрет
  возвращается ОДИН раз** в ответе admin-API — после этого его не восстановить.
- **Валидация** (`validate`): хэш-сравнение в **постоянном времени** (`safeEqual`),
  причём сравнение выполняется ВСЕГДА — даже если `clientId` не найден (фиктивный
  `DUMMY_HASH`), чтобы по времени ответа нельзя было перебирать существующие
  `client_id`. Отозванный клиент → невалиден.
- **Отзыв** (`DELETE /admin/clients/:clientId`): ставит `revoked=true`.

## Связи

- Принадлежит [Tenant](#tenant) (`tenantId`). При выпуске проверяется, что тенант
  существует.
- В access-token кладётся `tid = tenantId`; гард восстанавливает из него тенанта.

---

# AuditLog (AuditEntry)

**AuditLog** — запись журнала операций: кто (тенант), что (метод + путь), результат
(статус), сколько заняло. Пишется на **каждый HTTP-запрос** через `AuditInterceptor`,
который навешивается **per-controller** композитным декоратором `@UseGatewayContract()`
(не глобально через `APP_INTERCEPTOR` — модуль встраиваемый). **Без тел запроса/ответа и без секретов.**

Код: [`src/audit/audit.service.ts`](../../src/audit/audit.service.ts),
интерцептор: [`src/audit/audit.interceptor.ts`](../../src/audit/audit.interceptor.ts),
сущность (co-located в модуле): [`src/audit/audit-log.entity.ts`](../../src/audit/audit-log.entity.ts).
Таблица `audit_log`.

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `id` | `serial` PK | Автоинкремент (порядок записи). |
| `ts` | `timestamptz` (индекс) | Момент запроса. |
| `tenantId` | `varchar(64)?` (индекс) | Тенант (если запрос аутентифицирован). |
| `source` | `varchar(16)?` | Откуда вызов: `internal` / `external`. |
| `method` | `varchar(8)` | HTTP-метод. |
| `path` | `varchar(512)` | Путь **без query-строки** (обрезается до `?`). |
| `status` | `int` | HTTP-статус ответа. |
| `ms` | `int` | Длительность обработки, мс. |

## Поведение

- Запись — **fire-and-forget** + **батчевая** (буфер + flush раз в секунду / на 100
  строк / на shutdown; flush ре-энтерабелен — зовётся из 4 мест): не добавляет задержку
  к ответу; ошибка вставки только логируется, запрос не падает. У буфера есть жёсткий
  потолок (drop-oldest при переполнении), чтобы не расти в OOM при недоступной БД.
- Параллельно пишется структурный лог в stdout.
- Чтение: `GET /admin/audit` (последние 200, по убыванию `id`; сначала флашит буфер).
- **Гарантия приватности:** тела и заголовки не сохраняются — только метаданные.

> Замечание: реджекты на уровне guard (401/403/429) в audit **не попадают** —
> guards выполняются раньше интерцепторов. Журнал покрывает запросы, дошедшие до
> пайплайна обработки.

---

# KvEntry (`kv_store`)

**KvEntry** — универсальная запись key-value с **TTL**. Одна таблица обслуживает
два механизма, которым нужна согласованность между подами:
1. **идемпотентность платежей** (ключ `idem:<tenantId>:<Idempotency-Key>`);
2. **дедуп НЕ-статусных вебхуков** Mastercard (ключ `wh:<eventRef>`). Статусные
   push-события (STATUS_CHG/QUOTE_STATUS_CHG) дедупятся НЕ здесь, а в
   [`tx_status`](#transactionstatus-tx_status) (UNIQUE(eventRef), дедуп+персист атомарны).

Код: [`src/store/postgres-kv.store.ts`](../../src/store/postgres-kv.store.ts),
сущность (co-located в модуле): [`src/store/kv.entity.ts`](../../src/store/kv.entity.ts).
Таблица `kv_store`.

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `key` | `varchar(256)` PK | Ключ с префиксом механизма. |
| `value` | `text` | Значение (JSON — напр. `{done, result}` для идемпотентности). |
| `expiresAt` | `timestamptz` (индекс) | Момент истечения; протухшее считается отсутствующим. |

## Поведение

- **`setIfAbsent`** — атомарный захват через
  `INSERT … ON CONFLICT (key) DO UPDATE … WHERE expiresAt < now()`: вставит, либо
  перезапишет ТОЛЬКО протухшую запись. На этом строятся замок идемпотентности и
  «первый-выигрывает» для вебхуков (без гонок между подами).
- **`get`** — читает и, если запись протухла, удаляет её (fire-and-forget) и возвращает `null`.
- **TTL:** идемпотентность — короткий замок `in-progress` (120с, > таймаута MC),
  затем результат на сутки; webhook-дедуп — сутки.
- **Очистка:** протухшие строки удаляются cron-задачей (`KvCleanupService`, ежечасно,
  `@nestjs/schedule`, под `pg_try_advisory_xact_lock` — в multi-pod реально чистит
  только ОДИН под за цикл; `DELETE` **батчится через `LIMIT`/`ctid`**, поэтому один
  прогон удаляет не более `CLEANUP_BATCH` строк и не держит длинный лок), плюс лениво при чтении.

---

# TransactionStatus (`tx_status`)

**TransactionStatus** — персист статусных push-уведомлений MC (Status Change / Quote
Status Change) для доставки мерчанту через polling. Дедуп И запись **атомарны**: один
`INSERT … ON CONFLICT (eventRef) DO NOTHING` (нет окна «краш между пометкой дедупа и
записью», которое было бы при kv-дедупе отдельно от записи).

Код: [`src/webhooks/transaction-status.store.ts`](../../src/webhooks/transaction-status.store.ts),
сущность: [`src/webhooks/transaction-status.entity.ts`](../../src/webhooks/transaction-status.entity.ts).
Таблица `tx_status`.

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `id` | `serial` PK | Автоинкремент. |
| `eventRef` | `varchar(200)` UNIQUE, null | Ключ дедупа (NULL'ы не конфликтуют → безref-события вставляются всегда). |
| `tenantId` | `varchar(64)` null | OWN → резолв по `partnerId`; PLATFORM/неизвестный → `NULL` (общий пул). |
| `transactionReference` | `varchar(256)` null | Reference транзакции/котировки. |
| `eventType` | `text` null | `STATUS_CHG` / `QUOTE_STATUS_CHG`. |
| `transactionType` | `text` null | `QUOTE` / `PAYMENT`. |
| `status` | `text` null | Статус (из `quote.confirmStatus.status` или верхнего уровня). |
| `stage` | `text` null | Стадия (`pendingStage`: Expired/Ambiguous и т.п.). |
| `payload` | `jsonb` | Сырое (нормализованное) событие целиком. |
| `receivedAt` | `timestamptz` (индекс) DEFAULT now() | Момент приёма. |

Индексы: UNIQUE(`eventRef`); композитный (`transactionReference`, `tenantId`) — под
чтение по ref; (`receivedAt`).

## Поведение

- **Запись (`record`)** — атомарный `INSERT … ON CONFLICT DO NOTHING RETURNING id`:
  `true` = вставлено (свежее), `false` = дубль. **Без усечения** (issue #8): проекционные
  колонки (eventType/transactionType/status/stage) — тип `text`, ширины нет, поэтому слишком
  длинное значение из непокрытого DTO тела MC не вызовет «value too long» → 500 (что сломало бы
  контракт «всегда 200» + ушло бы в бесконечный ретрай MC). Индексируемые `varchar`-колонки
  (`eventRef`/`transactionReference`) ограничены выше по стеку `@MaxLength` в DTO вебхука,
  `tenantId` — внутренний резолвнутый id.
- **Чтение (`findForTenant`)** — по `transaction_reference`, tenant-scoped: OWN видит
  СТРОГО свои строки; PLATFORM — свои + общий пул (`tenantId IS NULL`). Потолок `LIMIT 200`,
  сортировка по `id ASC`. Эндпоинт: `GET /crossborder/status-events?ref=`.

---

# McCredentials

**McCredentials** — резолвенные ключи Mastercard для конкретного тенанта. **Не
хранится в БД** — вычисляется из тенанта в `CredentialsService.resolve` и кэшируется
in-memory (per-pod). Остальной код работает только с этим типом и **не знает**,
общие это ключи платформы или собственные ключи партнёра.

Код: [`src/credentials/credentials.types.ts`](../../src/credentials/credentials.types.ts),
резолвер: [`src/credentials/credentials.service.ts`](../../src/credentials/credentials.service.ts).

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `consumerKey` | `string` | Consumer key для OAuth1-подписи. |
| `signingKeyPem` | `string` | Приватный ключ подписи (PEM). |
| `partnerId` | `string` | partner-id в пути URL Mastercard (валидируется на безопасность). |
| `encryptionCertPem` | `string?` | Cert для JWE-шифрования запросов *(per-tenant; см. ниже)*. |
| `encryptionFingerprint` | `string?` | Fingerprint ключа шифрования. |
| `decryptionKeyPem` | `string?` | Приватный ключ для расшифровки ответов. |

## Резолв и кэш

- **`PLATFORM`** → из конфигурации платформы (`.env`): ключ подписи из `.p12`,
  `consumerKey`, общий `partnerId`. Кэш без TTL (ротация через рестарт).
- **`OWN`** → из [MerchantSecretBundle](#merchantsecretbundle--keymaterial) по
  `secretRef` тенанта; кэш **с TTL** (`MC_CREDS_CACHE_TTL_MS`, дефолт 10 мин) +
  **жёсткий LRU-потолок (500 записей)**, чтобы множество тенантов не раздуло кэш
  безгранично, + дедуп stampede (конкурентные запросы ждут один промис) +
  `invalidate()` для ротации. (Конвертации P12→PEM мемоизируются отдельно в LRU
  `pemCache`, потолок 256.)

> ⚠️ **Известное ограничение:** поля шифрования (`encryptionCertPem` и др.)
> резолвятся per-tenant, но интерцептор шифрует **платформенным** ключом
> (`EncryptionService` глобального уровня). Сам платформенный FLE **работает**
> (доказан на sandbox 2026-06-16); открыт только per-tenant seam для OWN-партнёров
> со своими ключами — см. [production-questions.md](./production-questions.md).

---

# MerchantSecretBundle / KeyMaterial

**MerchantSecretBundle** — полный набор секретов партнёра, который отдаёт
`SecretStore` по `secretRef` (режим `OWN`). **Хранится в секрет-менеджере**
(Vault/KMS), а не в нашей БД. Из бандла `CredentialsService` собирает
[McCredentials](#mccredentials).

Код: [`src/secrets/secret-store.types.ts`](../../src/secrets/secret-store.types.ts).
Реализации: `LocalSecretStore` (dev), `VaultSecretStore` (прод — заглушка до
выбора вендора).

## MerchantSecretBundle

| Поле | Тип | Описание |
|---|---|---|
| `consumerKey` | `string` | Consumer key партнёра. |
| `partnerId` | `string` | partner-id партнёра в Mastercard. |
| `signing` | `KeyMaterial` | Ключ подписи (.p12). |
| `encryptionCertPem` | `string?` | Cert шифрования запросов. |
| `encryptionFingerprint` | `string?` | Fingerprint ключа шифрования. |
| `decryption` | `KeyMaterial?` | Ключ расшифровки ответов. |

## KeyMaterial — материал .p12-ключа

| Поле | Тип | Описание |
|---|---|---|
| `p12Base64` | `string?` | .p12 в base64 (так приходит из Vault). |
| `p12Path` | `string?` | Путь к .p12 (dev). |
| `password` | `string` | Пароль от .p12. |

Должен быть задан **ровно один** источник: `p12Base64` (Vault) или `p12Path` (dev);
оба нормализуются в PEM (`loadPrivateKeyFromP12*`).

## Валидация границы

`CredentialsService.validateBundle` требует минимум для подписи: `consumerKey` и
`signing`. Поля шифрования опциональны (нужны только при `MC_ENCRYPTION_ENABLED`).

---

# McWebhookEvent

**McWebhookEvent** — payload push-уведомления Mastercard (`POST /webhooks/mastercard`).
Статусные события **персистятся** в [`tx_status`](#transactionstatus-tx_status); прочие
(Carded Rate Push, RFI и т.п.) не хранятся, только дедупятся в
[`kv_store`](#kventry-kv_store) маркером по `eventRef`.

Код: [`src/webhooks/webhook.handler.ts`](../../src/webhooks/webhook.handler.ts).

## Поля (известные; payload расширяемый)

MC шлёт поля в ДВУХ нотациях — camelCase и snake_case; хендлер нормализует обе.

| Поле (camel / snake) | Тип | Описание |
|---|---|---|
| `eventRef` / `event_ref` | `string?` | Идентификатор события (ключ дедупа). |
| `notificationId` / `notification_id` | `string?` | Альтернативный id (фолбэк для дедупа). |
| `eventType` / `event_type` | `string?` | Тип (`STATUS_CHG`/`QUOTE_STATUS_CHG`/`CARDFX_PUB`/…) — диспетчеризация. |
| `transactionReference` / `transaction_reference` | `string?` | Reference транзакции. |
| `partnerId` / `partner_id` | `string?` | partner-id отправителя (атрибуция тенанту). |
| `encrypted_payload.data` | `string?` | Признак зашифрованного push (декрипт — MTF/Prod). |
| `[key]` | `unknown` | Прочие поля payload-а (сохраняются целиком в `tx_status.payload`). |

## Поведение

- **Аутентификация:** in-service fail-closed токен (`X-Webhook-Token`), обязателен в
  prod и dev. Авторитетная аутентичность push-уведомлений у MC — **mTLS**, а не подпись
  payload (JWS/HMAC у MC нет; бывший «C1» закрыт чтением доки). Проверки подписи в коде нет —
  единственный активный фактор — токен. Детали и цитата MC — `api.md` → Webhooks.
- **Статусные события** (`STATUS_CHG`/`QUOTE_STATUS_CHG`) → персист в `tx_status` одним
  `INSERT … ON CONFLICT (eventRef) DO NOTHING` (дедуп+запись атомарны). Атрибуция тенанту:
  OWN → по `partnerId`, PLATFORM/неизвестный → общий пул (`tenantId=NULL`).
- **Прочие события** → дедуп `setIfAbsent('wh:<eventRef>')` (TTL сутки) + лог.
- **Зашифрованный push** (`encrypted_payload.data`): ack 200 без обработки (зашифрованный
  push бывает только в MTF/Prod — в sandbox «Not Applicable»; ключ расшифровки уже есть,
  осталось протянуть `decryptResponse` в хендлер + per-tenant seam).
- **Ответ всегда 200** (иначе MC ретраит). Повтор → `{status:'duplicate'}`, иначе
  `{status:'accepted'}`.
