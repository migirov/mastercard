# Mastercard Cross-Border Gateway

Мульти-мерчант сервис-шлюз к **Mastercard Cross-Border Services** (NestJS, Node 22,
PostgreSQL). Партнёры платформы ходят в Mastercard через нас — каждый со своими
ключами и `partner-id`, и только после двойного одобрения (Mastercard + платформа).

- Подпись каждого запроса — OAuth1 ключом конкретного тенанта (stateless).
- Field-level encryption (JWE) и подпись вынесены в axios-интерцептор.
- Persistence — PostgreSQL (рассчитано на многоподовый деплой в Kubernetes).
- Два пути доступа: внешний OAuth2 (мерчанты) и внутренний service-token.
- k8s-готовность: health/readiness-пробы, структурные JSON-логи + correlation-id,
  TypeORM-миграции, валидация ENV на старте.

---

## Документация (`docs/`)

| Файл | О чём |
|---|---|
| [architecture.md](docs/architecture.md) | **Архитектура (as-built)** — схема, модули, потоки, хранение, безопасность, статус фаз. Начать отсюда. |
| [documentation.md](docs/documentation.md) | **Сущности и концепции** — Tenant, OAuthClient, AuditLog, KvEntry, McCredentials и др.; где БД / где in-memory; шифрование (интерцептор); сценарии OWN/PLATFORM; `tenant_id` vs `partner_id`. |
| [api.md](docs/api.md) | **Справочник по нашему API** — все эндпоинты (OAuth, Cross-Border, Admin, Webhooks), аутентификация, примеры запросов/ответов, rate-limits. |
| [api-mastercard.md](docs/api-mastercard.md) | **Официальная дока Mastercard** Cross-Border (полный референс, ~540 КБ). Источник истины по форматам payload. |
| [plan.md](docs/plan.md) | **План и статус** по фазам 1–6 + миграции/доработки, с историей аудитов. |
| [tests.md](docs/tests.md) | **Отчёт о тестировании** — что прогонялось на живом sandbox + Postgres, команды и фактические ответы. |
| [production-questions.md](docs/production-questions.md) | **Блокеры и вопросы перед production** (в т.ч. per-tenant encryption, выбор секрет-менеджера, TypeORM-интеграция). |
| [client-questions.md](docs/client-questions.md) | Открытые вопросы к клиенту по интеграции. |
| [memory.md](docs/memory.md) | Хендофф-контекст разработки (для восстановления состояния сессии). |

---

## ⚠️ Папка `certs/` (обязательна, не в репозитории)

Криптоматериал Mastercard **не коммитится** (в `.gitignore`: `certs/`, `*.p12`,
`*.pem`, `*.key`). Для запуска папку `certs/` нужно создать и положить туда ключи
из вашего проекта на [Mastercard Developers](https://developer.mastercard.com).

| Файл | Назначение | Переменная `.env` |
|---|---|---|
| `Fintory-sandbox-signing.p12` | приватный ключ **подписи OAuth1** | `MC_SIGNING_KEY_PATH` (+ `MC_SIGNING_KEY_PASSWORD`) |
| `mastercard-encryption-cert.pem` | публичный cert **Mastercard Encryption Key** — им шифруются ЗАПРОСЫ (JWE) в MTF/Prod | `MC_ENCRYPTION_CERT_PATH` (+ `MC_ENCRYPTION_FINGERPRINT`) |
| приватный **Client Encryption key** (PEM) | расшифровка ОТВЕТОВ в MTF/Prod | `MC_DECRYPTION_KEY_PATH` *(в sandbox не нужен)* |

> **Sandbox не поддерживает field-level encryption** — там работает plain
> (`MC_ENCRYPTION_ENABLED=false`), и достаточно signing-ключа + consumer key.
> Шифрование включается только в MTF/Production. Подробно про ключи — в
> [architecture.md](docs/architecture.md) и [documentation.md](docs/documentation.md).

### `.env` (тоже не в репозитории)

Конфигурация и секреты — в `.env` (в `.gitignore`). Ключевые переменные:

```
MC_BASE_URL, MC_CONSUMER_KEY, MC_PARTNER_ID
MC_SIGNING_KEY_PATH, MC_SIGNING_KEY_PASSWORD
MC_ENCRYPTION_CERT_PATH, MC_ENCRYPTION_FINGERPRINT, MC_ENCRYPTION_ENABLED
MC_DECRYPTION_KEY_PATH                  # для MTF/Prod
DATABASE_URL, DB_SYNC, DB_POOL_MAX      # PostgreSQL
MC_JWT_SECRET, MC_INTERNAL_TOKEN, MC_ADMIN_TOKEN, MC_WEBHOOK_TOKEN
MC_SECRET_STORE                         # local (dev) | vault (prod)
TRUST_PROXY                             # число хопов ингресса за прокси
```

В production действуют гейты (`main.ts`): запрет старта со слабыми/дефолтными
секретами, требование `MC_SECRET_STORE=vault`, запрет авто-`synchronize`.

---

## Быстрый старт (dev)

Требуется Node 22 и Docker (для PostgreSQL).

```bash
# 1) зависимости
npm install

# 2) PostgreSQL
docker compose up -d            # Postgres 16, см. docker-compose.yml

# 3) положить ключи в certs/ и заполнить .env (см. выше)

# 4) запустить сервис (dev)
npx ts-node src/main.ts         # http://localhost:3000, авто-схема + сиды тенантов
```

Smoke-тест: `npm run ping` (балансы через тестового тенанта). Swagger: `/api-docs`.

> **Windows + проект на WSL:** node запускается из Windows, а прямой `npm run`
> падает на UNC-пути. Обход:
> `cmd /c "pushd \\wsl.localhost\Ubuntu\...\mastercard && npm run ping & popd"`.

---

## Миграции БД (production)

В **dev** схема создаётся авто-`synchronize`. В **production** `synchronize`
выключен всегда — схема ведётся **миграциями** (TypeORM CLI). DataSource для CLI:
[src/database/data-source.ts](src/database/data-source.ts).

```bash
# сгенерировать миграцию по изменениям сущностей
DATABASE_URL=... npm run migration:generate -- src/database/migrations/Имя
# применить (на деплое / отдельным k8s Job — не на каждом поде)
DATABASE_URL=... npm run migration:run
# откатить последнюю
DATABASE_URL=... npm run migration:revert
```

Начальная миграция (`InitialSchema`) уже в `src/database/migrations/`. Авто-прогон
на старте — `DB_MIGRATIONS_RUN=true` (в multi-pod лучше через init-container/Job).

---

## Структура

```
src/
  tenants/        реестр партнёров (Postgres), статусы/одобрения
  credentials/    резолвер ключей (PLATFORM | OWN), кэш
  secrets/        SecretStore: Local (dev) | Vault (prod)
  auth/           OAuth2, гарды, admin-аутентификация
  admin/          ввод партнёров, одобрения, выпуск OAuth-клиентов
  mastercard/     низкоуровневый клиент (axios + интерцепторы encrypt/sign/decrypt)
  encryption/     EncryptionService (JWE, тумблер по среде)
  crossborder/    бизнес-эндпоинты: quote/payment/retrieve/cancel/confirm
  idempotency/    идемпотентность платежей (через KV)
  audit/          журнал операций (Postgres, батч-запись)
  webhooks/       приём push-уведомлений Mastercard
  store/          KvStore → PostgresKvStore + cron-очистка протухшего kv_store
  database/       TypeORM: подключение, сущности, миграции (data-source + migrations/)
  health/         health/readiness-пробы (@nestjs/terminus) для k8s
  config/         валидация ENV на старте (class-validator)
  common/         p12/crypto utils, throttler-гарды
docs/             документация (см. таблицу выше)
certs/            криптоматериал Mastercard (НЕ в репозитории)
```

---

## Статус

Транзакционное ядро готово и проверено на живом sandbox (см.
[tests.md](docs/tests.md)). Перед production — см.
[production-questions.md](docs/production-questions.md) (главный блокер:
per-tenant encryption для OWN-партнёров; приватный Client Encryption key;
реализация `VaultSecretStore`).
