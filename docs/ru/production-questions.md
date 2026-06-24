# Вопросы и блокеры перед production

Что решить/доделать перед боевым запуском. Архитектура — [documentation.md](./documentation.md).

---

## Открытые вопросы (нужно решение)

1. **Ретеншн БД.** Какое окно хранения требуется для `payment_idempotency` и `tx_status`,
   и каким механизмом чистить старые записи? App-level TTL нет, обе таблицы растут
   неограниченно; `payment_idempotency.result` хранит полный ответ MC (возможен PII).
2. **Доставка `X-Webhook-Token`.** MC сам токен не знает — инжектить на TLS-слое ингресса
   или задавать кастомным заголовком в Push-конфиге портала?

---

## Блокеры перед прод

- [ ] **`VaultSecretStore`** реализован + `MC_SECRET_STORE=vault` (сейчас заглушка
  `NotImplemented`; прод-гейт уже требует `vault` и падает без него).
- [ ] **Сильные секреты** вместо dev-дефолтов: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (прод-гейт проверяет на старте).
- [ ] **mTLS для вебхуков MC.** Аутентичность push у MC — через mTLS, не подпись payload.
  При деплое: запросить публичный mTLS-cert MC → в trust store; передать наш cert-chain
  через KMP-портал; уточнить доставку `X-Webhook-Token` (вопрос 2). До этого активный
  фактор — fail-closed `X-Webhook-Token`.
- [ ] **OWN partner-id и ключи** (включая их decryption key) заведены в секрет-менеджере.
- [ ] **`migration:run`** на прод-БД при деплое.

---

## Чек-лист прод-конфига

- [ ] **Живая кросс-тенант проверка FLE** на sandbox со 2-м реальным комплектом OWN-ключей
  перед включением FLE для OWN-партнёров в проде (сам seam уже реализован — см. «Решено»).
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
- [x] `MC_ENCRYPTION_ENABLED=true` — FLE работает во всех средах, sandbox в т.ч.
- [x] Приватный Mastercard Encryption key для расшифровки ответов (`MC_DECRYPTION_KEY_PATH`) — есть.

---

## Решено

- **Per-tenant encryption — реализован.** У каждого OWN-партнёра свой ключ; `EncryptionService`
  строит per-tenant `JweEncryption` из PEM-ключей партнёра (`encryptionCertPem`/
  `decryptionKeyPem`, режим `useCertificateContent`), кэшируя по fingerprint; PLATFORM-тенанты
  используют общий ключ из конфига. Интерцептор `MastercardClient` не менялся (уже передавал
  `creds`). Неполные OWN-ключи при включённом FLE → fail-loud. Остаётся живая кросс-тенант
  проверка на реальных ключах (см. чек-лист).
- **Декрипт зашифрованного push — реализован (kid-роутинг).** `WebhookHandler` декриптит
  конверт по `kid` из открытого JOSE-заголовка JWE (дока MC: MC ставит `kid`=fingerprint
  ключа для расшифровки): PLATFORM — платформенным ключом; OWN — per-tenant ключом по `kid`,
  если он уже построен (кэш от API-активности тенанта). Расшифрованное обрабатывается как
  обычное событие; что не расшифровать (нет ключа под `kid` / FLE off / ошибка) — durably
  персистится в `tx_status` (ENCRYPTED) до ack для reprocess (потерь нет). Остаётся
  MTF-подтверждение и проактивный OWN-резолв по `kid` для холодного кэша (см. чек-лист).
- **TypeORM / встраивание.** Сервис — один зонтичный `MastercardModule`; хост даёт
  `DataSource` (наши сущности через `forFeature`/`autoLoadEntities`) и ведёт свои миграции;
  `DatabaseModule.forRoot` — только для dev-харнесса.
- **Механизм FLE** доказан на sandbox: запрос шифруется Client Encryption Key, ответ
  расшифровывается Mastercard Encryption private key (раньше путали ключи → `082000`).
- Инфраструктура миграций, RFI-подсистема, Swagger-аннотации — готовы.

---

## Заметка: axios

`axios` запинен на `1.6.0` (совпадает с хостом `b24club-api`; `@nestjs/axios@4` peer-требует
`^1.3.1` — конфликта нет). `npm audit` флагует 1.x как HIGH (SSRF/ReDoS), но экспозиция низкая
(фиксированный `baseURL`, свои относительные пути, нет клиентских абсолютных URL). Бамп ведёт
хост (владеет единственным axios в монолите) — следуем синхронно. Сырой axios (не
`@nestjs/axios`) — намеренно, ради контроля интерцепторов.
