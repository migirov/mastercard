# Вопросы и блокеры перед production

Что нужно решить/доделать перед боевым запуском. Дополняет [memory.md](./memory.md)
(статус) и [documentation.md](./documentation.md) (архитектура).

---

## 🔴 БЛОКЕР: per-tenant encryption не подключён

**Суть.** Field-level encryption (JWE) сейчас **платформенного уровня**:
интерцептор шифрует запрос ключом из `.env`
(`MC_ENCRYPTION_CERT_PATH` / `MC_ENCRYPTION_FINGERPRINT` / `MC_DECRYPTION_KEY_PATH`)
через единый `EncryptionService`. При этом `CredentialsService.fetchOwn` уже
резолвит **per-tenant** ключи шифрования (`encryptionCertPem`,
`encryptionFingerprint`, `decryptionKeyPem`) в `McCredentials` — но **их никто не
использует**.

**Почему это блокер для OWN + MTF/Prod.** У каждого OWN-партнёра свой MC-проект →
свой Mastercard Encryption Key (свой fingerprint). Если шифровать его запрос
платформенным ключом, Mastercard отвергнет payload (`Crypto Key`). В sandbox
шифрование выключено (`MC_ENCRYPTION_ENABLED=false`), поэтому сейчас не стреляет.

**Вопрос к клиенту/архитектуре.**
- У каждого OWN-партнёра действительно **свой** MC Encryption Key, или платформа
  использует один общий ключ шифрования для всех? От этого зависит объём фикса.

**Что делать (если per-tenant).** Протянуть ключи из `McCredentials` в шифрование:
`EncryptionService` должен принимать cert/fingerprint/privateKey per-request (а не
из глобального конфига), либо построить `JweEncryption` на лету по `creds`. Тогда
интерцептор `MastercardClient` передаёт `creds` и в шифрование, и в подпись.
Кэшировать построенный `JweEncryption` по fingerprint (дорого пересоздавать).

---

## 🟠 Открытый архитектурный вопрос: TypeORM

Наш сервис — **отдельный** или **часть монолита `b24club-api`**?
- Отдельный → текущая схема верна: свой `DatabaseModule.forRoot` + `DATABASE_URL`,
  `synchronize` в dev.
- Часть монолита → убрать наш `forRoot`, регистрировать entity через `forFeature`
  в их `DataSource`, схему вести их миграциями (не `synchronize`).

**Ждём ответа** — влияет на конфигурацию БД и деплой.

---

## Прод-предусловия (чек-лист)

- [ ] **Per-tenant encryption** (см. блокер выше) — если OWN-партнёры с разными ключами.
- [ ] **Приватный Client Encryption key** для расшифровки ответов в MTF/Prod
      (`MC_DECRYPTION_KEY_PATH`) — сейчас есть только публичный cert.
- [ ] **`MC_ENCRYPTION_ENABLED=true`** в MTF/Prod (в sandbox остаётся `false`).
- [ ] **`MC_SECRET_STORE=vault`** + реализованный `VaultSecretStore` (сейчас заглушка
      `NotImplemented`). Прод-гейт в `main.ts` уже требует `vault` и падает без него.
- [ ] **Сильные секреты** вместо dev-дефолтов: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
      `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (или пустой webhook-токен при mTLS).
      Прод-гейт проверяет это на старте.
- [ ] **`TRUST_PROXY`** = число хопов ингресса (не `true`) — корректный `req.ip`.
- [ ] **mTLS на ингрессе** для вебхуков Mastercard (авторитетная аутентификация).
- [ ] **Авторитетный rate-limit на ингрессе** — внутренний throttler per-pod
      (best-effort).
- [ ] **Personal partner-id и ключи** OWN-партнёров заведены в секрет-менеджере.
- [ ] **Миграции БД** вместо `synchronize` (`DB_SYNC=false`) + прогон e2e на Postgres.

---

## Доработки по необходимости бизнеса (не блокеры)

- RFI-подсистема (requests for information / documents).
- Observability: метрики, трейсинг, алерты.
- Очистка протухших `kv_store` (cron через `@nestjs/schedule`) — иначе таблица
  растёт (записи живут по TTL, но физически не удаляются до обращения).
- Расширить Swagger-аннотации для мерчантов.

---

## История багов-аудита (исправлено)

4-цикловый аудит на баги (2026-06-10), все правки прошли typecheck:
1. Гонка засева тенантов при старте многих подов → `INSERT … ON CONFLICT DO NOTHING`.
2. Дефолтный `MC_WEBHOOK_TOKEN` проходил прод-гейт → добавлен в `assertProdSecrets`.
3. Длинный `Idempotency-Key` переполнял `kv_store.key` (varchar 256) → валидация (≤128).
4. В проде молча использовался dev-`LocalSecretStore` → прод-гейт требует `vault`.
