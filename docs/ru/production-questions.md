# Вопросы и блокеры перед production

Что решить/доделать перед боевым запуском. Архитектура — [documentation.md](./documentation.md).

---

## Открытые вопросы (нужно решение)

1. **Per-tenant encryption.** У каждого OWN-партнёра свой MC Client Encryption Key (свой
   fingerprint), или платформа использует один общий ключ шифрования для всех? От этого
   зависит объём работы по per-tenant seam (см. блокер ниже).
2. **Ретеншн БД.** Какое окно хранения требуется для `payment_idempotency` и `tx_status`,
   и каким механизмом чистить старые записи? App-level TTL нет, обе таблицы растут
   неограниченно; `payment_idempotency.result` хранит полный ответ MC (возможен PII).
3. **Доставка `X-Webhook-Token`.** MC сам токен не знает — инжектить на TLS-слое ингресса
   или задавать кастомным заголовком в Push-конфиге портала?

---

## Блокеры перед прод

- [ ] **Per-tenant encryption seam** (если у OWN-партнёров разные ключи). Сейчас FLE
  платформенного уровня — интерцептор шифрует ключом из `.env`. `OwnCredentialsProvider`
  уже резолвит per-tenant ключи в `McCredentials`, но их никто не использует → запрос
  OWN-партнёра, зашифрованный платформенным ключом, MC отвергнет (`082000`). Доделать:
  протянуть cert/fingerprint/privateKey из `McCredentials` в `EncryptionService`
  per-request (строить и кэшировать `JweEncryption` по fingerprint). Сам механизм FLE —
  не блокер (доказан на sandbox, см. «Решено»); seam отлаживается там же.
- [ ] **`VaultSecretStore`** реализован + `MC_SECRET_STORE=vault` (сейчас заглушка
  `NotImplemented`; прод-гейт уже требует `vault` и падает без него).
- [ ] **Сильные секреты** вместо dev-дефолтов: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (прод-гейт проверяет на старте).
- [ ] **mTLS для вебхуков MC.** Аутентичность push у MC — через mTLS, не подпись payload.
  При деплое: запросить публичный mTLS-cert MC → в trust store; передать наш cert-chain
  через KMP-портал; уточнить доставку `X-Webhook-Token` (вопрос 3). До этого активный
  фактор — fail-closed `X-Webhook-Token`.
- [ ] **Декрипт зашифрованного push** (MTF/Prod). `WebhookHandler` детектирует
  `{ encrypted_payload }` и персистит конверт в `tx_status` (`eventType=ENCRYPTED`) до ack,
  но не расшифровывает. Доделать: протянуть `decryptResponse` в обработчик + per-tenant
  seam (тот же пункт). На sandbox push «Not Applicable» — кейс там не воспроизвести.
- [ ] **OWN partner-id и ключи** (включая их decryption key) заведены в секрет-менеджере.
- [ ] **`migration:run`** на прод-БД при деплое.

---

## Чек-лист прод-конфига

- [ ] `TRUST_PROXY` = число хопов ингресса (не `true`) — только для корректного `req.ip` за прокси.
- [ ] k8s liveness/readiness на `/health` и `/ready` (пробы готовы).
- [ ] Провижен тенантов хостом: `platform` и свои — через admin-API (онбординг с двойным
  одобрением) или `SEED_DEMO=false npm run seed`. Модуль на старте тенантов не сеет, иначе
  PLATFORM-режим не заработает.
- [ ] Ретеншн-политика для `payment_idempotency`/`tx_status` (вопрос 2).
- [ ] (Опц.) Метрики/трейсинг (Prometheus `/metrics` / OpenTelemetry) + алерты. Логи
  (pino + correlation-id) уже есть.
- [ ] (Опц.) Rate-limit на ингрессе как доп. защита — per-pod `@nestjs/throttler`
  самодостаточен (корректность от ингресса не зависит).
- [x] `MC_ENCRYPTION_ENABLED=true` — FLE работает во всех средах, sandbox в т.ч.
- [x] Приватный Mastercard Encryption key для расшифровки ответов (`MC_DECRYPTION_KEY_PATH`) — есть.

---

## Решено

- **TypeORM / встраивание.** Сервис — один зонтичный `MastercardModule`; хост даёт
  `DataSource` (наши сущности через `forFeature`/`autoLoadEntities`) и ведёт свои миграции;
  `DatabaseModule.forRoot` — только для dev-харнесса.
- **Механизм FLE** доказан на sandbox: запрос шифруется Client Encryption Key, ответ
  расшифровывается нашим Mastercard Encryption private key (раньше путали ключи → `082000`).
- Инфраструктура миграций, RFI-подсистема, Swagger-аннотации — готовы.

---

## Заметка: axios

`axios` запинен на `1.6.0` (совпадает с хостом `b24club-api`; `@nestjs/axios@4` peer-требует
`^1.3.1` — конфликта нет). `npm audit` флагует 1.x как HIGH (SSRF/ReDoS), но экспозиция низкая
(фиксированный `baseURL`, свои относительные пути, нет клиентских абсолютных URL). Бамп ведёт
хост (владеет единственным axios в монолите) — следуем синхронно. Сырой axios (не
`@nestjs/axios`) — намеренно, ради контроля интерцепторов.
