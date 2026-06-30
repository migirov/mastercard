# XBS Embedded — монорепо Mastercard Cross-Border

[🇬🇧 English](README.md) · 🇷🇺 Русский

Монорепо демо Mastercard Cross-Border: **реальный мультитенантный шлюз** к Mastercard
Cross-Border Services плюс бэкенд и веб-интерфейс, которые им управляют. UI проходит полный
сценарий оплаты инвойсов и задействует каждое cross-border API — вызывая **настоящую песочницу
Mastercard** там, где она доступна, и синтезируя реалистичный **демо**-ответ там, где песочница
пока не умеет (каждое — переключатель в env, без правок кода).

---

## Компоненты

| Папка | Что это | Порт | Состояние |
|---|---|---|---|
| [`mastercard/`](mastercard/) | **Продукт.** Мультитенантный NestJS-шлюз к Mastercard Cross-Border Services (OAuth1-подпись на тенанта, field-level шифрование JWE, двойное одобрение). Спроектирован для встраивания в монолит клиента. | `3000` | Postgres `mc_gateway` |
| [`mastercard-bff/`](mastercard-bff/) | **Cross-border слой (stateless).** API `/xbs` + `/features` — проксирует шлюз (`live`) или синтезирует (`demo`) по каждой способности, с мягким откатом. Mastercard-обращённый BFF. | `4011` | нет |
| [`app-bff/`](app-bff/) | **Постоянный бэкенд приложения.** Бессхемное хранилище сущностей + `auth.me` + integrations. Держит все данные UI (инвойсы, карты, сотрудники…). Без Mastercard. | `4010` | Postgres `mc_demo` |
| [`masrtercard-front/`](masrtercard-front/) | **Веб-интерфейс** (React / Vite, раздаётся nginx). Ходит только в `/demo-api`; nginx разводит путь между двумя BFF. | `8080` | нет |
| [`mastercard-demo-stack/`](mastercard-demo-stack/) | **Docker Compose**, связывающий пять контейнеров (включая общий Postgres), плюс пошаговый гайд по тестированию. | — | — |

```
 браузер ─► frontend (nginx, :8080) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4011) ─► шлюз mastercard (:3000) ─► Mastercard ПЕСОЧНИЦА
                                                   │
                                                   └─ всё остальное ────────► app-bff (:4010) ─► mc_demo (хранилище сущностей / auth / integrations)

        postgres (общий) ◄── mc_demo (app-bff)   +   mc_gateway (шлюз)
```

---

## Быстрый старт

Весь стек запускается из папки compose:

```bash
cd mastercard-demo-stack
cp .env.example .env          # вписать GATEWAY_INTERNAL_TOKEN (должен совпадать с mastercard/.env)
docker compose up -d --build  # первый запуск собирает все 5 образов
docker compose ps             # все 5 должны быть running/healthy
```

- **Веб-интерфейс:** http://localhost:8080 — пароль **`0544326303`**
- health app-bff: http://localhost:4010/health · health mastercard-bff (разводка live/demo): http://localhost:4011/health

Полный гайд по запуску/тестированию, источники данных каждой страницы и матрица live-vs-demo —
в **[mastercard-demo-stack/README.ru.md](mastercard-demo-stack/README.ru.md)** и гайдах
[`docs/ru`](mastercard-demo-stack/docs/ru/) · [`docs/en`](mastercard-demo-stack/docs/en/).

---

## Live vs Demo

`mastercard-bff` проксирует каждую cross-border способность в шлюз **независимо**. Сегодня
песочница поддерживает **валидацию** счёта/адреса, **балансы**, **поиск банка**, **генерацию
IBAN** и каталоги **cash-pickup** (🟢 live); FX **quote**, **pay**, **status** и остальные
инструменты — 🟡 demo до включения MTF/Prod. Каждый cross-border-ответ несёт поле
`source: "live" | "demo"`, в UI это бейдж. Переключается любая способность через переменные
`XBS_*_MODE` в `mastercard-demo-stack/.env` — без правок кода. См. README демо-стека §5–6.

---

## Раскладка репозитория

```
mastercard-app/
├─ mastercard/            шлюз (продукт)                    → :3000, бд mc_gateway
├─ mastercard-bff/        cross-border BFF (/xbs,/features)  → :4011, stateless
├─ app-bff/              app-data BFF (сущности/auth)       → :4010, бд mc_demo
├─ masrtercard-front/     веб-интерфейс (React/Vite + nginx) → :8080
├─ mastercard-demo-stack/ docker compose + тест-доки
└─ .gitignore             корневая защита от секретов
```

У каждого компонента свой README с деталями автономного запуска / тестов / конфигурации.

---

## Секреты

Секреты **никогда** не коммитятся. Корневой [`.gitignore`](.gitignore) игнорирует во всех
компонентах каждый `**/.env`, `**/certs/`, `**/*.p12`, `**/*.pem`, `**/*.key` (оставляя шаблоны
`**/.env.example`). Реальные значения живут только локально:

- `mastercard/.env` + `mastercard/certs/*` — песочничные креды и крипто-материал (монтируются в
  контейнер шлюза read-only в рантайме, в образ не зашиваются).
- `mastercard-demo-stack/.env` — общий внутренний токен + переключатели live/demo.

Скопируй `.env.example` рядом с каждым, впиши значения — и готово.
