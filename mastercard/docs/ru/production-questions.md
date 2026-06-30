# Вопросы и блокеры перед production

Что решить/доделать перед боевым запуском. Архитектура и уже решённые дизайн-решения
(FLE, per-tenant encryption, декрипт зашифрованного push, AWS Secrets Manager store,
встраивание TypeORM) — в [documentation.md](./documentation.md) и
[architecture.md](./architecture.md).

---

## Открытые вопросы (нужно решение)

1. **Ретеншн БД.** Какое окно хранения требуется для `payment_idempotency` и `tx_status`,
   и каким механизмом чистить старые записи? App-level TTL нет, обе таблицы растут
   неограниченно; `payment_idempotency.result` хранит полный ответ MC (возможен PII).

---

## Блокеры перед прод (все деплойные)

- [ ] **Сильные секреты** вместо dev-дефолтов: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (прод-гейт проверяет на старте).
- [ ] **In-app mTLS для вебхуков MC (деплой-обвязка).** Решение об auth — в приложении
  (`WebhookAuthGuard` валидирует клиентский cert MC — реализовано); шаги деплоя:
  - поднять HTTPS-сервер приложения с `requestCert: true, rejectUnauthorized: false` и DigiCert
    **Outbound**-цепочкой (Assured ID Client CA G2 + Root G2) в `ca` (env `TLS_*_PATH`);
  - задать `webhookMtlsEnabled` + `webhookAllowedClientCNs` =
    `CrossborderServicesNotification-{env}.mastercard.com`;
  - ингресс — **L4 TLS passthrough** (TLS терминирует приложение, не ингресс);
  - сдать нашу серверную cert-chain через KMP-портал; webhook URL = FQDN/HTTPS (не IP).
- [ ] **OWN partner-id и ключи** (включая их decryption key) заведены в AWS Secrets Manager
  — один секрет на партнёра, значение = JSON `MerchantSecretBundle`.
- [ ] **`migration:run`** на прод-БД при деплое.

---

## Чек-лист прод-конфига

- [ ] **Живая кросс-тенант проверка FLE** на sandbox со 2-м реальным комплектом OWN-ключей
  перед включением FLE для OWN-партнёров в проде (сам per-tenant seam уже реализован — это
  только проверка на реальных ключах).
- [ ] **Подтвердить декрипт push на MTF**: реальный зашифрованный push несёт `kid`; для OWN
  при «холодном» кэше добавить проактивный резолв ключа тенанта по `kid` (сейчас OWN-push
  декриптится, только если ключ уже в кэше от API-активности, иначе durably персистится).
- [ ] `TRUST_PROXY` = число хопов ингресса (не `true`) — только для корректного `req.ip` за прокси.
- [ ] k8s liveness/readiness на `/health` и `/ready` (пробы готовы).
- [ ] Провижен тенантов хостом: `platform` и свои — через admin-API (онбординг с двойным
  одобрением) или `SEED_DEMO=false npm run seed`. Модуль на старте тенантов не сеет, иначе
  PLATFORM-режим не заработает.
- [ ] Ретеншн-политика для `payment_idempotency`/`tx_status` (вопрос 1).
- [ ] (Опц.) Метрики/трейсинг (Prometheus `/metrics` / OpenTelemetry) + алерты. Логи
  (pino + correlation-id) уже есть.
- [ ] (Опц.) Rate-limit на ингрессе как доп. защита — per-pod `@nestjs/throttler`
  самодостаточен (корректность от ингресса не зависит).

---

## Решено (детали в [architecture.md](./architecture.md) / [documentation.md](./documentation.md))

- **AWS Secrets Manager** — secret store `AwsSecretsManagerSecretStore`
  (`MC_SECRET_STORE=aws-secrets-manager`); `secretRef` = имя/ARN секрета, значение = JSON
  `MerchantSecretBundle`. (Прежнее имя «Vault» было placeholder'ом вендора-TBD.)
- **Per-tenant encryption** — per-tenant `JweEncryption` из PEM-ключей партнёра, кэш по
  fingerprint; PLATFORM-тенанты на общем ключе; неполные OWN-ключи → fail-loud.
- **Декрипт зашифрованного push** — `kid`-роутинг (PLATFORM / per-tenant); что не расшифровать
  — durably персистится в `tx_status` (ENCRYPTED) до ack (потерь нет).
- **FLE** работает во всех средах, sandbox в т.ч. (`MC_ENCRYPTION_ENABLED=true`,
  `MC_DECRYPTION_KEY_PATH` есть); запрос шифруется Client Encryption Key, ответ
  расшифровывается Mastercard Encryption private key.
- **Аутентификация вебхука — in-app mTLS (без зависимости от ингресса).** MC аутентифицирует
  push только клиентским сертификатом (ни токена, ни заголовка, ни api-key — MC docs §"Push
  Notification Setup", поэтому вариант «кастомный заголовок в портале» невозможен).
  `WebhookAuthGuard` валидирует cert в приложении: доверенная цепочка (`socket.authorized`) +
  allowlist по subject-CN. `X-Webhook-Token` — опциональный dev/вторичный фактор. Ингресс —
  тупой L4-passthrough; живое подтверждение на MTF.
- **Встраивание TypeORM** — один зонтичный `MastercardModule`; хост даёт `DataSource` и ведёт
  свои миграции. Инфраструктура миграций, RFI-подсистема и Swagger — готовы.

---

## Заметка: axios

`axios` запинен на `1.6.0` (совпадает с хостом `b24club-api`; `@nestjs/axios@4` peer-требует
`^1.3.1` — конфликта нет). `npm audit` флагует 1.x как HIGH (SSRF/ReDoS), но экспозиция низкая
(фиксированный `baseURL`, свои относительные пути, нет клиентских абсолютных URL). Бамп ведёт
хост (владеет единственным axios в монолите) — следуем синхронно. Сырой axios (не
`@nestjs/axios`) — намеренно, ради контроля интерцепторов.
