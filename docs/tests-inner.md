# Тесты — внутренняя логика шлюза

Тесты нашего слоя, которые **не обращаются к Mastercard** (отклоняются раньше — на
гардах/гейтинге/валидации — либо это инфраструктура). Тесты интеграции с Mastercard
(исходящие вызовы + webhooks) — в [tests.md](./tests.md).

Связанные: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> Окружение и запуск — см. [tests.md](./tests.md#окружение). `$base = http://localhost:3000`.
> Сиды: `platform`, `acme` (PLATFORM/ACTIVE), `own-sandbox` (OWN/ACTIVE), `own-demo` (OWN/PENDING).

---

## 1. Аутентификация и доступ

Проверяют наш слой; **отклоняются до обращения к Mastercard** (на гардах/гейтинге).

| # | Тест | Ожидание | Факт |
|---|---|---|---|
| GW-1 | `GET /admin/tenants` (admin-токен) | список из Postgres | ✅ 200, 4 тенанта, статусы вычислены, без `secretRef` |
| GW-2 | `GET /crossborder/balances` без auth | 401 | ✅ 401 `missing bearer token` |
| GW-3 | `GET /admin/tenants` неверный admin-токен | 401 | ✅ 401 `invalid admin token` |
| GW-4 | `POST /admin/tenants/own-sandbox/clients` | выпуск client_id/secret | ✅ 201, secret 32 симв., `note` (показан 1 раз) |
| GW-5 | `POST /oauth/token` (client_credentials) | JWT | ✅ Bearer, expires_in=900 |
| GW-6 | `POST /oauth/token` неверный secret | 401 | ✅ 401 `invalid_client` (timing-safe) |
| GW-7 | gating: own-demo (PENDING) | 403 | ✅ 403 `…is not active (status PENDING)` |
| GW-8 | неизвестный тенант | 404 | ✅ 404 `Tenant 'nope' not found` |

```bash
# выпуск OAuth-клиента → токен (внешний путь auth)
curl.exe -s -X POST -H "X-Admin-Token: ..." $base/admin/tenants/own-sandbox/clients   # 201 + secret (1 раз)
curl.exe -s -X POST $base/oauth/token -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<cid>&client_secret=<sec>"               # JWT 900s
# gating / not found (до MC не доходит)
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-demo" $base/crossborder/balances   # 403
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: nope"     $base/crossborder/balances   # 404
```

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
> 2xx использует ту же Postgres-`setIfAbsent`, что и webhook-дедуп (см.
> [tests.md](./tests.md) WH-2); успешный кэш требует валидного платежа.

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
- **Прогон 4 (финальный):** все категории на коде с 5 нативными модулями
  (terminus/env-validation/migrations/schedule/pino) + 5 аудит-правок — **25/25 зелёные**.

## Не покрыто (внутреннее)

- **Метрики/трейсинг** (Prometheus/OTel) — логи готовы (pino), метрик нет.
