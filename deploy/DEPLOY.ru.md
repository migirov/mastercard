# Руководство по развёртыванию — XBS Embedded

[🇬🇧 English](DEPLOY.md) · 🇷🇺 Русский

Всё необходимое для запуска стека из опубликованных образов. Доступ к репозиторию не нужен.

---

## 1. Образы

Четыре образа приложения, собранные из одного коммита и выпущенные под одним тегом.

| Образ | Роль | Порт | Данные |
|---|---|---|---|
| `ghcr.io/migirov/mastercard/gateway:<tag>` | Гейтвей Mastercard Cross-Border. Единственный сервис, который обращается к Mastercard. | `3000` | Postgres `mc_gateway` |
| `ghcr.io/migirov/mastercard/mastercard-bff:<tag>` | Cross-border API (`/xbs`, `/features`). Без состояния. | `4000` | нет |
| `ghcr.io/migirov/mastercard/app-bff:<tag>` | Бэкенд приложения — хранилище сущностей, авторизация, интеграции. | `4000` | Postgres `mc_demo` |
| `ghcr.io/migirov/mastercard/frontend:<tag>` | Веб-интерфейс (nginx) + reverse proxy для `/demo-api`. | `80` | нет |

Postgres — **не** наш образ: берите `postgres:16-alpine` или управляемый инстанс.

Платформа: `linux/amd64`. В каждом образе есть метка `org.opencontainers.image.revision` с
исходным коммитом и `HEALTHCHECK`.

### Pull

```bash
docker login ghcr.io -u <username>       # пароль = токен GitHub со скоупом read:packages
docker pull ghcr.io/migirov/mastercard/gateway:<tag>
docker pull ghcr.io/migirov/mastercard/mastercard-bff:<tag>
docker pull ghcr.io/migirov/mastercard/app-bff:<tag>
docker pull ghcr.io/migirov/mastercard/frontend:<tag>
```

Пакеты приватные, доступ передаётся отдельно.

---

## 2. Топология

```
 браузер ─► frontend (nginx, :80) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4000) ─► gateway (:3000) ─► Mastercard
                                                 │
                                                 └─ всё остальное ────────► app-bff (:4000)

        postgres ◄── mc_demo (app-bff)   +   mc_gateway (gateway)
```

Снаружи должен быть доступен только `frontend`. TLS терминируется перед ним (ALB, nginx,
Cloudflare) — контейнер слушает обычный HTTP.

Гейтвею нужен **исходящий HTTPS до Mastercard**. Входящий путь нужен только если включены
push-уведомления (вебхуки) — см. §6.

---

## 3. Модель конфигурации

**Ни в одном образе нет секретов.** Всё передаётся при старте контейнера:

- **Переменные окружения** — полный список в [`.env.example`](.env.example), сгруппирован и
  прокомментирован (`SECRET` / `REQUIRED` / значения по умолчанию). Этот файл — справочник;
  здесь описано то, что из него самого не видно.
- **Файлы** — криптоматериал Mastercard, монтируется только на чтение. Передаётся отдельным
  каналом; его нельзя класть в git, в образ или в реестр.

Три сервиса используют **один** `DEMO_API_TOKEN` (frontend, app-bff, mastercard-bff), и два —
**один** внутренний токен (`GATEWAY_INTERNAL_TOKEN` у BFF = `MC_INTERNAL_TOKEN` у гейтвея).
Если в паре значения разойдутся, вызовы вернут 401 либо молча уйдут на demo-данные.

`DEMO_GATE_PASSWORD` — значение другого рода: его получает **один** сервис (app-bff), и оно не
покидает бэкенд. Это пароль, вводимый в гейт UI; проверяется на сервере через
`POST /demo-api/gate/verify`. Не задавайте его для `frontend` и `mastercard-bff` — весь смысл в
том, что браузер его не получает. Для сравнения: `DEMO_API_TOKEN` по замыслу отдаётся в браузер в
`/config.js`, поэтому он барьер против неаутентифицированного доступа к API, а не секрет.

Ротация любого из них — перезапуск, а не пересборка: образ фронта читает свою конфигурацию при
старте контейнера и подставляет её в отдаваемую страницу, а app-bff читает пароль гейта из
окружения при загрузке.

### Разворачиваете не через Compose? Шесть имён меняются

`DEMO_GATE_PASSWORD` в эти шесть **не входит**: его имя одинаково везде, поэтому для Kubernetes
или ECS переводить нечего — нужно лишь, чтобы значение дошло до app-bff.

В `.env.example` имена **уровня стека**. Compose переименовывает шесть из них по дороге в
контейнеры: два сервиса ждут одно и то же значение под разными именами, а двум нужна своя база.
**Если вы пишете манифесты Kubernetes, task definition для ECS или запускаете `docker run`, это
переименование делаете вы сами** — и четыре из шести ошибок проявятся не падением, а тихо.

| Имя в `.env.example` | Кому | Под именем | Что будет при ошибке |
|---|---|---|---|
| `GATEWAY_INTERNAL_TOKEN` | гейтвею | **`MC_INTERNAL_TOKEN`** | контейнер стартует, но все live-возможности молча отдают demo-данные |
| `GATEWAY_INTERNAL_TOKEN` | mastercard-bff | `GATEWAY_INTERNAL_TOKEN` | то же самое — значения ОБЯЗАНЫ совпадать |
| `GATEWAY_DATABASE_URL` | гейтвею | **`DATABASE_URL`** | не стартует |
| `APP_DB_HOST` / `APP_DB_PORT` / `APP_DB_NAME` | app-bff | **`DEMO_DB_HOST`** / **`DEMO_DB_PORT`** / **`DEMO_DB_NAME`** | не стартует |
| `DB_USER` / `DB_PASSWORD` | app-bff | **`DEMO_DB_USER`** / **`DEMO_DB_PASSWORD`** | не стартует |
| `GATEWAY_NODE_ENV` | гейтвею | **`NODE_ENV`** | прод-проверки не выполняются — см. §6 |
| `BFF_NODE_ENV` | app-bff, mastercard-bff | **`NODE_ENV`** | то же |

Остальные переменные сохраняют имена. Точный список для каждого сервиса — блок `environment:`
соответствующего сервиса в [`docker-compose.yml`](docker-compose.yml): читайте его как полный
набор переменных этого сервиса, чем бы вы ни разворачивали.

Ещё двух значений в `.env.example` нет вовсе — compose выводит их из имён сервисов:
`GATEWAY_URL` (mastercard-bff → гейтвей, например `http://gateway:3000`) и `APP_BFF_URL` /
`MASTERCARD_BFF_URL` у фронта. Укажите в них то, как эти сервисы называются у вас.

### Монтируемые файлы (только гейтвей)

Каталог с ключами монтируется в `/app/certs` только на чтение. Переменные `MC_*_PATH` заданы
относительно `/app`, поэтому `./certs/foo.p12` резолвится внутри этого монтирования.

| Назначение | Переменная | Типичный файл |
|---|---|---|
| Подпись запросов OAuth1 | `MC_SIGNING_KEY_PATH` + `MC_SIGNING_KEY_PASSWORD` | `*-signing.p12` |
| Шифрование запросов (JWE) | `MC_ENCRYPTION_CERT_PATH` | сертификат Client Encryption от Mastercard, `.pem` |
| Расшифровка ответов (JWE) | `MC_DECRYPTION_KEY_PATH` | наш приватный ключ Mastercard Encryption, `.pem` |
| TLS и проверка клиентского сертификата MC | `TLS_KEY_PATH`, `TLS_CERT_PATH`, `TLS_CLIENT_CA_PATH` | только для прода, §6 |

---

## 4. База данных

Один сервер Postgres, две базы:

- **`mc_gateway`** — гейтвей. Передаётся через `GATEWAY_DATABASE_URL`. Миграции схемы
  выполняются автоматически при старте.
- **`mc_demo`** — app-bff. Задаётся не URL'ом, а host/port/user/password/name. **app-bff
  выполняет `CREATE DATABASE` при первом старте**, поэтому роли нужен `CREATEDB` — либо создайте
  `mc_demo` заранее и выдайте роли права на неё.

Если гейтвей запускается в нескольких экземплярах, `DB_POOL_MAX` умножается: держите
`число контейнеров × DB_POOL_MAX` ниже `max_connections` сервера.

---

## 5. Запуск

```bash
cp .env.example .env      # заполнить
mkdir -p certs            # положить сюда переданные файлы Mastercard
docker compose up -d
docker compose ps         # все сервисы healthy
```

Чтобы поднять Postgres внутри стека вместо управляемого инстанса:

```bash
docker compose --profile with-postgres up -d
```

### Проверка

```bash
curl -fsS localhost:8080/healthz                      # фронт
docker compose exec app-bff        curl -fsS localhost:4000/health
docker compose exec mastercard-bff curl -fsS localhost:4000/health   # показывает live/demo-раскладку
docker compose exec gateway        curl -fsS localhost:3000/health
```

API обоих BFF требуют `Authorization: Bearer $DEMO_API_TOKEN` на каждом маршруте; `/health` —
единственный публичный. Дальше откройте UI и пройдите платёж до шага Review: бейдж
«Validated · Mastercard» на проверке IBAN/адреса означает реальный round-trip до Mastercard.

Порядок старта задан в compose-файле. Запуск BFF раньше, чем догрузился гейтвей, безопасен:
live-возможности временно деградируют до demo-ответов и восстанавливаются сами.

### Что смотреть в логах при первом старте

Гейтвей на каждом старте печатает фактическую конфигурацию:

```
boot posture: NODE_ENV=… productionGates=ENFORCED|SKIPPED secretStore=… webhookMtls=… swagger=…
```

Healthy-контейнер сам по себе не доказывает, что прод-проверки отработали, — доказывает эта строка.

---

## 6. Чеклист перевода в продакшен

Первое развёртывание намеренно идёт с пустым `GATEWAY_NODE_ENV` — это та же конфигурация,
которая сегодня проверена на песочнице Mastercard. Значение `production` включает проверки,
при которых сервис **не стартует**, если не выполнено всё перечисленное:

1. `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN` (`GATEWAY_INTERNAL_TOKEN`), `MC_ADMIN_TOKEN` и, если
   задан, `MC_WEBHOOK_TOKEN` — стойкие значения, без дефолтов и коротких строк.
2. `MC_SECRET_STORE=aws-secrets-manager`, учётные данные мерчантов лежат там, а роль
   задачи/инстанса имеет право их читать. Локальное хранилище — только для разработки.
3. `MC_ENCRYPTION_ENABLED=true` вместе с сертификатом шифрования, отпечатком и ключом расшифровки.
4. `MC_WEBHOOK_MTLS_ENABLED=true` плюс `MC_WEBHOOK_ALLOWED_CLIENT_CNS` и
   `MC_WEBHOOK_ALLOWED_ISSUER_CNS`. Mastercard не присылает токен в push-уведомлениях —
   подлинность подтверждает именно клиентский сертификат.
5. Заданы `TLS_KEY_PATH` и `TLS_CERT_PATH`, чтобы TLS терминировало **само приложение** и видело
   клиентский сертификат Mastercard.

### Путь вебхука надо заложить до того, как построен ingress

Взаимный TLS на входящих push — **собственное требование Mastercard**, а не наше ужесточение: в
спецификации Push API прямо сказано, что соединение между Mastercard и сервером партнёра,
публикующим webhook-URL, устанавливается через mutual TLS. Там же зафиксированы DN сертификата по
средам (`CrossborderServicesNotification-{mtf|prod}.mastercard.com`) и выпускающий CA.

Архитектурное следствие, которое дорого переделывать задним числом: **трафик вебхука должен
доходить до контейнера как сырой TCP.** TLS терминирует приложение, чтобы гвард мог проверить
клиентский сертификат, — ALB или nginx-ingress с терминацией TLS срежут его, и проверять станет
нечего. Заведите хост/путь вебхука через L4 passthrough (NLB / `ssl-passthrough`) даже если push
включается позже; всё остальное (веб-интерфейс) терминируется обычным образом.

Также выставьте `TRUST_PROXY` в число прокси-хопов перед гейтвеем (ALB — это `1`). Пустое
значение за прокси приводит к тому, что rate limiting по IP считает адрес прокси, а не клиента.

---

## 7. Live и demo

`mastercard-bff` для каждой возможности отдельно решает, идти в Mastercard (`live`) или
синтезировать правдоподобный ответ (`demo`) — через переменные `XBS_*_MODE`. Значения по
умолчанию соответствуют тому, что сегодня поддерживает песочница Mastercard: валидация, балансы,
поиск банка, генерация IBAN и справочники cash-pickup работают вживую; FX-котировка, отправка
платежа, статус и остальные инструменты остаются в demo до включения MTF/прода. Переключение —
изменение переменной и перезапуск.

Каждый cross-border-ответ содержит поле `source: "live" | "demo"`, и UI показывает его бейджем —
то есть действующий режим виден без чтения конфигурации.

---

## 8. Обновление

```bash
# поменять IMAGE_TAG в .env
docker compose pull
docker compose up -d
```

Фиксируйте неизменяемый тег: `latest` смещается между развёртываниями и делает откат
неоднозначным. Откат — та же операция с предыдущим тегом; миграции схемы гейтвея работают только
вперёд, поэтому откат через релиз, менявший схему, согласуйте с нами.
