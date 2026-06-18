# Тесты — внутренняя логика шлюза

Тесты нашего слоя, которые **не обращаются к Mastercard** (отклоняются раньше — на
гардах/гейтинге/валидации — либо это инфраструктура). Тесты интеграции с Mastercard
(исходящие вызовы + webhooks) — в [tests.md](./tests.md).

Связанные: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> Окружение и запуск — см. [tests.md](./tests.md#окружение).
> Сиды: `platform`, `acme` (PLATFORM/ACTIVE), `own-sandbox` (OWN/ACTIVE), `own-demo` (OWN/PENDING).

---

## 0. Юнит-набор (Jest, `src/**/*.spec.ts`)

**20 наборов / 159 тестов — все зелёные.** Запуск: `node node_modules\jest\bin\jest.js`
(про связку Windows + WSL-UNC см. [tests.md](./tests.md#запуск-набора)).

| Набор | Что фиксирует |
|---|---|
| `crypto.util` | `randomToken` (url-safe, уникальность, длина), `sha256hex`, timing-safe `safeEqual` |
| `tenant.types` | `isActive` / `effectiveStatus` (приоритет SUSPENDED, состояния частичного апрува) |
| `safe-id.pipe` | whitelist идентификатора (анти path-injection: пусто / `a/b` отклонены) |
| `idempotency-key.pipe` | валидный ключ проходит; `undefined` допустим; >128 симв. отклонён (kv_store.key) |
| `gateway-config` | типизированные геттеры + дефолты; в prod отказ на слабых секретах / не-vault store |
| `idempotency.service` | захват замка/кэш; 4xx освобождает замок; 5xx/unknown **держит** (анти двойное списание); reuse по фингерпринту тела → 422 |
| `oauth.service` | выпуск Bearer для валидного клиента; `invalid_client` и никогда не подписывает на кривых кредах |
| `webhook-auth.guard` | fail-closed (токен не настроен → отказ); отсутствующий/неверный токен → отказ; верный токен → пропуск |
| `webhook.handler` | статус-события (STATUS_CHG/QUOTE_STATUS_CHG) → персист в `tx_status` (record), дубль record=false→duplicate; атрибуция OWN-partnerId→tenantId, иначе общий пул (null); нормализация snake_case; извлечение status/stage из `quote.confirmStatus`; не-статусные → атомарный дедуп+персист в `tx_status` по `eventRef` (без отдельного KV-слоя); зашифрованный push → персист до ack (`eventType=ENCRYPTED`), затем accept; пустое/undefined тело → accept (не 500) |
| `tenant-serialization` (admin) | `@Exclude` скрывает `secretRef`; whitelist `TenantViewDto`; `IssuedClientDto` показывает `clientSecret` один раз |
| `gateway-exception.filter` | единый конверт; вкладывает тело MC под `upstream`; формы `/oauth/token` по RFC 6749; внутренности не утекают |
| **`crossborder.*`** (разбит по областям, issue #16) | `cross-border.gateway`: диспетч `call()` (2xx→данные, форвардимый объект 4xx→`UpstreamHttpException`, не-объект 4xx→скрыт 502, 401/403/5xx и сеть/сбой расшифровки→502) + гейтинг (не-ACTIVE тенант → Forbidden, MC не вызван). Сборка пути по областям: `accounts` (balances, Carded/FX Rate Pull GET `/rates`), `quotes` (create; confirm/cancel; retrieve с encodeURIComponent обоих сегментов), `payments` (путь create + ключ идемпотентности `txref:sha256`, `encodeURIComponent` на id, `getStatusEvents` — локальное чтение `tx_status` OWN→includePool=false/PLATFORM→true, MC не вызван), `validations` (своя база address + CRLF срезан в `Partner-Ref-Id`), `cash-pickup` (partner-id в заголовке) |
| **`mastercard-client.service`** (новый) | матрица ретраев — GET ретраит транзиентные 502/503/504 до 3×, POST никогда не ретраится (анти двойное списание); регресс decrypt-no-retry: детерминированный сбой расшифровки НЕ ретраится даже на GET |
| **`audit.service`** (новый) | re-entrancy флаша (без двойного insert); `capBuffer` сбрасывает **старейшие** при переполнении + логирует drop; второй флаш в `recent()` добивает in-flight записи; сбой insert переочередует батч |
| **`credentials.*`** (разбит #14, кэш через cache-manager #15) | `own-credentials.provider`: allowlist `partnerId` + анти-traversal `secretRef` (`..`) + валидация бандла + контракт 422; обвязка кэша — второй get → один fetch, `invalidate` рефетчит, отклонённый resolve не кэшируется. `platform-credentials.provider`: сборка + кэш-parse-once + warm в onModuleInit. `credentials.service`: dispatch фасада PLATFORM/OWN + invalidate + throw на неизвестный режим. (LRU/TTL-внутренности теперь у cache-manager, нами не юнит-тестируются.) |

Четыре **новых** набора добавлены в недавнем Tier-1 код-ревью, чтобы зафиксировать
багфиксы аудита (см. [Историю прогонов](#история-прогонов)).

---

## 1. Аутентификация и доступ

E2E-набор (`test/app.e2e-spec.ts`) также утверждает приведённые ниже отказы до MC;
они падают на гардах/гейтинге/валидации **до обращения к Mastercard**. Это
заголовки `it` (живое приложение на `:3999`).

| # | Тест (заголовок `it`) | Факт |
|---|---|---|
| GW-1 | `POST /crossborder/quotes` с `amount=number` → DTO `@IsString` | ✅ 400 |
| GW-2 | `POST /admin/tenants` OWN без `secretRef` → `@ValidateIf` | ✅ 400 |
| GW-3 | `POST /oauth/token` `grant_type=password` → `@IsIn` | ✅ 400 |
| GW-4 | `GET /crossborder/payments?ref=` (пусто) → `SafeIdPipe` | ✅ 400 |
| GW-5 | `GET /crossborder/payments?ref=a%2Fb` → анти path-injection | ✅ 400 |
| GW-6 | `GET /admin/tenants/own-sandbox` → без `secretRef`, со `status` | ✅ 200 |
| GW-7 | `POST /crossborder/payments` с кривым `Idempotency-Key` | ✅ 400 (до MC, в сообщении есть `Idempotency-Key`) |

> Механика auth/gating (admin-токен, выпуск OAuth-клиента, timing-safe
> `invalid_client`, гейтинг PENDING-тенантов, 404 на неизвестном тенанте) зафиксирована
> юнит-наборами `oauth.service` / `tenant.types` / `tenant-serialization` из §0.

---

## 2. Надёжность

| # | Тест | Ожидание | Факт |
|---|---|---|---|
| R-1 | `Idempotency-Key` 200 символов | 400 локально, ДО MC | ✅ 400 `up to 128 chars…` |
| R-2 | Платёж ×2 с одним `Idempotency-Key` | ошибки НЕ кэшируются → ретрай | ✅ оба 400, **разные** MC RequestId; в `kv_store` нет idem-замка |
| R-3 | `/oauth/token` ×12 (лимит 10/мин по client_id) | 10×4xx → 429 | ✅ req 1–10 → 401, 11–12 → **429** |
| R-4 | `GET /admin/audit` | записи из Postgres (батч-писатель) | ✅ 102 записи, свежая сверху (flush перед чтением) |
| R-5 | **Персистентность после рестарта пода** | состояние выживает | ✅ тенанты=4 (без дублей сидов), webhook → duplicate (kv пережил), audit не обнулился |

> R-2 валидирует, что ошибки не залипают (замок освобождается). Само кэширование
> 2xx использует ту же Postgres-`setIfAbsent`, что и webhook-дедуп; успешный кэш
> требует валидного платежа. Стейт-машина замка (4xx освобождает, 5xx/unknown держит),
> внутренности батч-писателя аудита (re-entrancy, дроп старейших при переполнении,
> переочередь при сбое) и матрица GET-retry / POST-no-retry / decrypt-no-retry теперь
> зафиксированы юнит-наборами `idempotency.service`, `audit.service` и
> `mastercard-client.service` (§0).

**R-5 (рестарт):** стоп сервера → старт → `GET /admin/tenants` = те же 4 (сиды через
`INSERT … ON CONFLICT DO NOTHING`); повтор webhook `evt-test-001` = `duplicate`
(kv_store пережил); `audit_log`/`tenants`/`kv_store` не обнулились. **Цель миграции
на Postgres для multi-pod k8s достигнута.**

---

## 3. Платформа / инфраструктура

| # | Тест | Факт |
|---|---|---|
| I-1 | `GET /health` (liveness, terminus) | ✅ 200 `{"status":"ok"}` |
| I-2 | `GET /ready` (readiness + пинг Postgres) | ✅ 200 `{"database":{"status":"up"}}` |
| I-3 | pino: структурный JSON-лог | ✅ все логи JSON |
| I-4 | pino: correlation-id | ✅ входящий `X-Request-Id` подхвачен как `req.id` и возвращён в ответе |
| I-5 | pino: redact + slim-логи | ✅ `X-Admin-Token`/`Authorization` не в логах; только `id/method/url + status` |
| I-6 | reqId-санитайз: вредоносный `X-Request-Id` (200 симв.) | ✅ заменён на UUID (анти log-injection) |
| I-7 | Валидация ENV на старте | ✅ boot без ложных срабатываний |
| I-8 | platform-creds preload (`onModuleInit`) | ✅ загружены на старте (boot без ошибок) |
| I-9 | TypeORM-миграция `InitialSchema` | ✅ сгенерирована + прогнана (создала 4 таблицы) |
| I-10 | cron-очистка `kv_store` (SQL) | ✅ протухшая строка удалена (`DELETE WHERE expiresAt<now()`) |

```bash
curl.exe -s $base/health   # {"status":"ok",...}
curl.exe -s $base/ready    # {"status":"ok","info":{"database":{"status":"up"}},...}
# correlation-id + slim-лог (пример строки):
# {"level":30,...,"req":{"id":"trace-test-123","method":"POST","url":"/oauth/token"},
#  "res":{"statusCode":429},"responseTime":1,"msg":"request completed"}
```

---

## История прогонов

- **Прогон 1–2:** функциональные + надёжность.
- **Прогон 3:** 10-цикловый аудит (баги/безопасность/опт) + 4 цикла регрессий — регрессий нет.
- **Прогон 4:** все категории на коде с 5 нативными модулями
  (terminus/env-validation/migrations/schedule/pino) + 5 аудит-правок.
- **Прогон 5 (текущий):** после 10-раундового аудита (безопасность/баги/оптимизация)
  + 2 раундов регрессий + 4-линзового код-ревью качества правки зафиксированы в
  автоматическом наборе. Добавлены четыре новых юнит-набора (`crossborder.*`,
  `mastercard-client.service`, `audit.service`, `credentials.*`). Текущий статус:
  **юнит 20 наборов / 159 тестов зелёные** (после доработки покрытия: confirm-suite 3/3,
  carded-rate GET, push-персист в `tx_status` — +3 раунда анализа баги/опт/безопасность),
  **E2E** против живого sandbox. Покрыты все 15 групп MC API.

## Не покрыто (внутреннее)

- **Метрики/трейсинг** (Prometheus/OTel) — логи готовы (pino), метрик нет.
