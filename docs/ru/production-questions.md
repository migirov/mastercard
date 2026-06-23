# Вопросы и блокеры перед production

Что нужно решить/доделать перед боевым запуском. Дополняет
[documentation.md](./documentation.md) (архитектура).

---

## 🔴 БЛОКЕР: per-tenant encryption не подключён

**Суть.** Field-level encryption (JWE) сейчас **платформенного уровня**:
интерцептор шифрует запрос ключом из `.env`
(`MC_ENCRYPTION_CERT_PATH` / `MC_ENCRYPTION_FINGERPRINT` / `MC_DECRYPTION_KEY_PATH`)
через единый `EncryptionService`. При этом `OwnCredentialsProvider` уже
резолвит **per-tenant** ключи шифрования (`encryptionCertPem`,
`encryptionFingerprint`, `decryptionKeyPem`) в `McCredentials` — но **их никто не
использует**.

**Почему это блокер для OWN.** У каждого OWN-партнёра свой MC-проект → свой
Client Encryption Key (свой fingerprint). Если шифровать его запрос платформенным
ключом, Mastercard отвергнет payload (`082000 Crypto Key`).

> **Важно (2026-06-16): сам механизм FLE больше НЕ блокер.** Платформенный
> field-level encryption **доказан вживую на sandbox** — запрос шифруется
> Client Encryption Key, ответ расшифровывается нашим Mastercard Encryption
> private key, validation-API возвращают реальные данные (live e2e 23/23). Раньше
> ошибочно считали «sandbox не поддерживает FLE» — на деле шифровали не тем ключом
> (Mastercard Encryption вместо Client Encryption → `082000`). То есть проверить и
> отладить per-tenant seam теперь можно **прямо на sandbox**, без ожидания MTF;
> открытым остаётся только сама прокладка per-tenant ключей (нужен 2-й комплект
> OWN-ключей, а JWE-либа требует пути к файлам, а не PEM-строки).

**Вопрос к клиенту/архитектуре.**
- У каждого OWN-партнёра действительно **свой** MC Encryption Key, или платформа
  использует один общий ключ шифрования для всех? От этого зависит объём фикса.

**Что делать (если per-tenant).** Протянуть ключи из `McCredentials` в шифрование:
`EncryptionService` должен принимать cert/fingerprint/privateKey per-request (а не
из глобального конфига), либо построить `JweEncryption` на лету по `creds`. Тогда
интерцептор `MastercardClient` передаёт `creds` и в шифрование, и в подпись.
Кэшировать построенный `JweEncryption` по fingerprint (дорого пересоздавать).

---

## ✅ Решено: TypeORM / встраивание

Сервис — **ОДИН зонтичный модуль (`MastercardModule`)**, встраиваемый в монолит
хоста `b24club-api`. **Хост** предоставляет TypeORM `DataSource` (наши сущности
через `forFeature` / `autoLoadEntities`) и прогоняет **свои миграции** (не
`synchronize`). Свой `DatabaseModule.forRoot` + `DATABASE_URL` остаются только для
standalone dev-harness (`main.ts`). Вопрос закрыт.

---

## Прод-предусловия (чек-лист)

- [ ] **Per-tenant encryption** (см. блокер выше) — если OWN-партнёры с разными ключами.
- [x] **Приватный Mastercard Encryption key** для расшифровки ответов
      (`MC_DECRYPTION_KEY_PATH`) — есть (наш `fintory-decrypt`, fingerprint `75ea7e15…`,
      активирован на портале MC). Для OWN-партнёров понадобятся их собственные.
- [x] **`MC_ENCRYPTION_ENABLED=true`** — FLE работает во всех средах, sandbox в том числе
      (проверено 2026-06-16); включается, как только настроены ключи (не только MTF/Prod).
- [ ] **`MC_SECRET_STORE=vault`** + реализованный `VaultSecretStore` (сейчас заглушка
      `NotImplemented`). Прод-гейт в `main.ts` уже требует `vault` и падает без него.
- [ ] **Сильные секреты** вместо dev-дефолтов: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
      `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (обязателен — webhook-guard fail-closed).
      Прод-гейт проверяет это на старте.
- [ ] **`TRUST_PROXY`** = число хопов ингресса (не `true`) — только для корректного `req.ip` за прокси (используется IP-fallback в rate-limit); к аутентификации не относится.
- [ ] **mTLS для вебхуков Mastercard (авторитетная аутентичность push-уведомлений).** По доке MC аутентичность вебхука обеспечивается **mTLS**, а НЕ подписью payload (JWS/HMAC — такой подписи у MC нет; бывший «вопрос C1» закрыт чтением доки). Сделать при деплое: (1) запросить у представителя MC публичный mTLS-cert push-уведомлений; (2) добавить его в trust store принимающего приложения/ингресса; (3) передать наш серверный cert-chain через KMP-портал; (4) уточнить у MC доставку `X-Webhook-Token` (MC его не знает — инжект на TLS-слое или кастомный заголовок в Push-конфиге). До этого активный фактор — in-service fail-closed `X-Webhook-Token`. Цитата MC и детали — `api.md` → Webhooks. Проверки подписи payload в коде нет — тело push MC не подписывает.
- [ ] **Декрипт зашифрованного push-уведомления (MTF/Prod).** Сейчас `WebhookHandler` детектирует
      зашифрованное тело (`{ encrypted_payload: { data } }`) и подтверждает `200` БЕЗ обработки
      (в sandbox push «Not Applicable», т.е. протестировать сам кейс на sandbox нельзя). Ключ
      расшифровки (`MC_DECRYPTION_KEY_PATH`) уже есть и доказан на validation-ответах — осталось
      протянуть `decryptResponse` в обработчик push + per-tenant seam (тот же per-tenant пункт,
      что в `EncryptionService`). До этого зашифрованные статус-события не персистятся в `tx_status`.
- [ ] **Опциональный rate-limit на ингрессе** как доп. защита — authoritative-лимит это самодостаточный per-pod `@nestjs/throttler` (корректность не зависит от ингресса); лимит на ингрессе, если есть — не authoritative.
- [ ] **Personal partner-id и ключи** OWN-партнёров заведены в секрет-менеджере.
- [x] **Миграции БД** — инфраструктура готова (`data-source.ts`, npm-скрипты
      `migration:generate/run/revert`, единственная миграция `InitialSchema` (создаёт
      `tx_status` для персиста push-статусов И `payment_idempotency`), `synchronize` off
      в prod). Осталось: прогон `migration:run` на прод-БД при деплое.

---

## Заметка о зависимостях: axios

`axios` запинен на **1.6.0** — это **точно совпадает** с хостом `b24club-api` (у них
в `package.json` тоже пин `axios 1.6.0`), а `@nestjs/axios@4` (его использует хост)
peer-требует `axios ^1.3.1` → конфликта нет. Однако `npm audit` флагует axios
1.0.0–1.15.2 как HIGH (SSRF / prototype-pollution / ReDoS); последняя — 1.17.0. Наша
практическая экспозиция низкая (фиксированный `baseURL`, относительные пути строим
сами, нет клиентских абсолютных URL, нет доверия к прокси). **Рекомендация:** бамп
axios должен вести **хост** (он владеет единственным дедуплицированным axios в
монолите); мы следуем синхронно. Используем сырой axios (не `@nestjs/axios`)
намеренно — ради контроля над интерцепторами.

---

## Доработки по необходимости бизнеса (не блокеры)

- ~~RFI-подсистема~~ — **реализована** (retrieve / update / upload / download).
- Observability: **логи готовы** (структурный JSON pino + correlation-id);
  остаются **метрики/трейсинг** (Prometheus `/metrics` или OpenTelemetry) + алерты.
- **Health-пробы готовы** (`/health`, `/ready`) — настроить liveness/readiness в k8s-манифесте.
- **Ретеншн БД (открытый item, инфра).** Отдельного KV-слоя с TTL нет — идемпотентность
  платежей (`payment_idempotency`) и дедуп/персист вебхуков (`tx_status`) ведутся в Postgres
  **без app-level TTL** (cron-очистки нет). Следствия: (1) обе
  таблицы растут неограниченно — особенно `tx_status` от частых не-статусных push (Carded Rate);
  (2) `payment_idempotency.result` хранит полный ответ MC (возможен PII) постоянно — раньше KV
  экспирил за 24ч. **Нужно решение на стороне хоста/инфры:** политика ретеншна (партиционирование
  по `receivedAt`/периодический prune старых записей), особенно для data-minimization (PII/PCI).
  Идемпотентность платежа практически нужна лишь в окне ретраев (минуты–сутки), поэтому prune
  старых `done`-записей безопасен. Вопрос клиенту: требуемое окно хранения и механизм.
- **Провижен тенантов при встраивании.** Встраиваемый `MastercardModule` НЕ
  создаёт тенантов на старте (`TenantRegistry` — чистый data-layer; `platform` сеет только
  dev-харнесс). Хост ОБЯЗАН провижить тенантов сам: базовый `platform` и своих — через admin-API
  (онбординг с двойным одобрением) или `SEED_DEMO=false npm run seed` при провижене. Иначе
  PLATFORM-режим не заработает (нет ни одного PLATFORM-тенанта).
- ~~Расширить Swagger-аннотации~~ — **сделано**.
