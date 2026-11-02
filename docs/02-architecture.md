# 02 · Архитектура и сборка

## Принцип

Сайт — **статический**: все страницы заранее собираются в `dist/` из данных (`src/content/*.json`)
и шаблонов (`src/templates/`). Фреймворков и npm-зависимостей нет — только Node.js ≥ 18.
Динамика на сервере одна — приём заявок (`send.php`).

```
src/content/*.json ─┐
src/templates/*     ├─► scripts/build.js ─► dist/  (HTML × 14, assets, .htaccess, sitemap, send.php …)
src/assets/*        ┘                     └► deploy/nginx.conf
```

## Страницы

Для каждого языка из `scripts/lib/paths.js → LANGS` (`ru` — по умолчанию в корне, `uz` — в `/uz/`):

| Адрес | Шаблон | Данные |
|---|---|---|
| `/index.html` | `templates/pages/home.html` | `config.json`, `i18n/<lang>.json`, все модели |
| `/models/<slug>/index.html` | `templates/pages/model.html` | `models/<id>.json` |
| `/privacy/index.html` | `templates/pages/privacy.html` | `i18n/<lang>.json → privacy` |

Внутренние ссылки ведут **на `…/index.html`** — сайт работает и при открытии с диска (file://), и на любом хостинге.
Канонические адреса (canonical, hreflang, sitemap) — без `index.html`.

## Модули сборки (`scripts/`)

| Файл | Ответственность |
|---|---|
| `build.js` | точка входа: читает данные, собирает страницы, вызывает модули |
| `dev.js` | `npm run dev`: сборка + HTTP-сервер (порт 3000, `PORT=…`) + автообновление браузера (SSE `/__reload`) + имитация `send.php` |
| `lib/paths.js` | все пути проекта и список языков |
| `lib/template.js` | мини-шаблонизатор: `{{key}}`, `{{> partial}}`, `{{#each list}}…{{/each}}`; объект `{ru, uz}` → строка текущего языка |
| `lib/images.js` | поиск фото (любое расширение), авто-галерея `gallery-N`, предупреждения о тяжёлых и отсутствующих файлах |
| `lib/csp.js` | Content Security Policy: собирает SHA-256 встроенных скриптов со всех страниц, формирует политику |
| `lib/server-files.js` | `.htaccess` и `deploy/nginx.conf` (с CSP), копирование PHP, генерация `lead.php`, `secret.php` |
| `lib/seo.js` | `sitemap.xml` (hreflang + картинки), `robots.txt` |
| `lib/social.js` | SVG-иконки соцсетей, ссылки для Schema.org `sameAs` |
| `lib/analytics.js` | сниппеты GA4 / Метрики / Pixel по ID из конфига |
| `lib/units.js` | перевод единиц измерения для узбекской версии |
| `lib/utils.js` | `readJson`, `esc`, `strip`, `copyDir`, `fmtNumber`, `origins` |

## Шаблоны

- `templates/pages/*.html` — страницы; `templates/partials/*.html` — общие блоки (`{{> header}}`).
- Значения подставляются **как HTML без экранирования** — это осознанно (тексты в i18n содержат `<br>`).
  Пользовательский ввод в шаблоны не попадает; экранирование атрибутов — `esc()` в `build.js`.
- Повторяющиеся сложные фрагменты (блоки преимуществ, таблица характеристик, галерея, JSON-LD) формируются в `build.js`
  и передаются в шаблон готовым HTML (`{{m.sectionsHtml}}` и т.п.).
- Отсутствующий ключ → предупреждение `⚠ нет значения для {{…}}` в консоли.

## Клиентский JS (`src/assets/js/main.js`)

Один файл, без зависимостей. Данные страницы передаются через
`<script type="application/json" id="site-data">` (JSON, не исполняемый код — совместимо со строгой CSP).

Модули внутри: шапка и меню · появление блоков · окно бронирования · формы (маска телефона, фильтр имени, UTM, отправка)
· галерея (кнопки, перетаскивание, свайп, клавиатура) · ленивая загрузка Яндекс-карты · скрытие битых картинок · аналитика (`data-ev`).

## CSS (`src/assets/css/style.css`)

Без препроцессоров. БЭМ-подобные классы (`.mcard__name`, `.hero__title`). Дизайн-токены — переменные в `:root`.
Размеры секций завязаны на `vh`, чтобы каждый блок помещался в один экран (1920×1080 и выше).
Брейкпоинты: 1240, 1100, 960, 640 px.

## SEO (автоматически)

- уникальные `title`/`description` для каждой страницы и языка (модели — `seo` в JSON);
- `canonical`, `hreflang` (ru, uz, x-default), Open Graph, Twitter Card;
- JSON-LD: `WebSite`, `WebPage`, `AutoDealer`, `ItemList`, `Car` + `Offer`, `BreadcrumbList`, `FAQPage`;
- `sitemap.xml` с альтернативами языков и картинками, `robots.txt`.

## Автоматизация фото

См. `scripts/lib/images.js` и [01-content.md](01-content.md#фото):
расширение файла не важно, галерея = файлы `gallery-N`, предупреждения о весе > 800 КБ и о ненайденных файлах.

## Как расширять

| Задача | Где |
|---|---|
| Новый язык | `paths.js → LANGS`, `i18n/<lang>.json`, значения `{ru, uz, <lang>}` в JSON моделей, `units.js` при необходимости |
| Новый тип страницы | шаблон в `templates/pages/`, вызов `write(...)` в `build.js`, адрес в `rel()`, страница в `seo.js` |
| Новая соцсеть | иконка в `lib/social.js`, ссылка в `config.json → social` |
| Новый счётчик | `lib/analytics.js` + разрешённые домены в `lib/csp.js` |
