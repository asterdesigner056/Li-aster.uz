# 03 · Заявки и CRM Oktell

## Откуда приходят заявки

| Форма | Где | Поля | `type` |
|---|---|---|---|
| Нижняя форма | на всех страницах (`#lead`) | имя, телефон, модель (на странице модели — выбрана), согласие | `price` |
| Окно «Забронировать» | кнопки в карточках, на странице модели, в шапке, мобильная панель | имя, телефон, согласие (модель — скрыто) | `booking` |

Клиентская проверка (`main.js`): имя — только буквы (кириллица, латиница, узбекские ʻ ‘ ’), телефон — маска `+998 (XX) XXX-XX-XX`, только цифры.

## Поток данных

```
браузер (main.js)
  └─ POST send.php   application/x-www-form-urlencoded
       поля: name, phone, model, type, lang, utm, page, ref, el (мс заполнения), website (ловушка)
         │
         ▼
send.php ── проверки ──► CRM Oktell (JSON)   ← основной канал
                    ├─► Telegram / e-mail     (необязательно, src/php/config.php)
                    └─► leads.csv + crm.log   (копия на сервере, вне публичной папки)
```

## Запрос в Oktell

`POST https://oktell.aster.uz:8443/aster/website-lead`, `Content-Type: application/json`

```json
{
  "fio": "Shaxzod",
  "phone": " 998 (97) 521 32 32",
  "comment": "",
  "marka": "li auto",
  "model": "L9 Livis",
  "website": "li-aster.uz",
  "city": "samarqand",
  "language": "UZ",
  "utm_source": "instagram",
  "utm_medium": "cpc",
  "utm_campaign": "LI_LeadGen_IG_Samarkand",
  "utm_content": "120251106352710528",
  "utm_term": "120251106352670528"
}
```

| Поле | Источник |
|---|---|
| `fio` | имя из формы |
| `phone` | ` 998 (XX) XXX XX XX` — с пробелом в начале, точно как в образце Oktell |
| `comment` | пусто, как в образце Oktell (тип заявки виден в CSV и Telegram) |
| `marka`, `website`, `city` | `src/content/config.json → lead` |
| `model` | название модели без «Li » (`L8 Livis`), пусто — если не выбрана |
| `language` | `RU` / `UZ` — язык страницы |
| `utm_*` | из ссылки, по которой пришёл посетитель; хранятся 30 дней (localStorage) |

Успех — HTTP 2xx от Oktell. Ответ CRM пишется в `crm.log`.

### Проверить CRM вручную

Тестовая заявка напрямую в Oktell (тот же формат, что отправляет `send.php`):

```bash
curl -X POST "https://oktell.aster.uz:8443/aster/website-lead" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"fio":"Тест сайта","phone":" 998 (97) 521 32 32","comment":"","marka":"li auto","model":"L9 Livis","website":"li-aster.uz","city":"samarqand","language":"RU","utm_source":"test","utm_medium":"","utm_campaign":"","utm_content":"","utm_term":""}'
```

Ответ 2xx — заявка принята. Код формирования запроса — `src/php/send.php`, блок «4. CRM Oktell».

## Режимы (`config.json → lead.mode`)

| Режим | Как работает | Когда |
|---|---|---|
| `"php"` (по умолчанию) | браузер → `send.php` → Oktell. Адрес CRM скрыт, работают лимиты, белые списки, проверка источника, CSV-копия | обычный хостинг с PHP |
| `"direct"` | браузер → Oktell напрямую, `send.php` не копируется в `dist/` | хостинг без PHP. Нужен CORS на стороне Oktell; адрес CRM виден всем; нет серверной защиты от спама |

## Проверки в `send.php`

1. Только `POST`, только `application/x-www-form-urlencoded`, тело ≤ 4 КБ, без файлов.
2. `Origin`/`Referer` — только собственный домен (`lead.php → allowedHosts` + текущий хост).
3. Ловушка `website` пустая; `el` ≥ 1500 мс (форму заполняли не мгновенно) — иначе тихий «успех» без отправки.
4. Имя — только буквы; телефон — `998` + 9 цифр; модель — из белого списка (`lead.php → models`); `type` ∈ `booking|price`; `lang` ∈ `ru|uz`.
5. Лимиты: 1 заявка с IP за `rate_limit_sec` (30 с); всего ≤ `global_limit_10min` (40) за 10 минут.
6. UTM очищаются от спецсимволов; CSV защищён от формул Excel.

Ответ: `{"ok":true}` или `{"ok":false,"error":"name|phone|origin|rate|type|size|method|delivery|server"}`.

## Где лежат заявки на сервере

`src/php/config.php → storage_dir`. По умолчанию — `../aster-li-private/` (уровнем выше публичной папки).
Если туда нельзя писать — папка `leads_<случайный хеш>` рядом с `send.php`, закрытая `.htaccess`.

| Файл | Что |
|---|---|
| `leads.csv` | все заявки (Excel, разделитель `;`) |
| `crm.log` | запросы в Oktell и ответы |
| `.rl_*`, `.global` | служебные файлы лимитов |

## Настройки (`src/php/config.php`)

Токены лучше держать вне публичной папки: скопируйте файл как `../aster-li-config.php` — `send.php` подхватит его автоматически.

| Ключ | По умолчанию | Что |
|---|---|---|
| `telegram_token`, `telegram_chat_id` | пусто | уведомления менеджерам в Telegram |
| `email_to`, `email_from` | пусто | копия заявки на почту |
| `save_csv` | `true` | вести `leads.csv` |
| `storage_dir` | авто | папка для заявок и журналов |
| `rate_limit_sec` | 30 | интервал между заявками с одного IP |
| `global_limit_10min` | 40 | общий лимит за 10 минут |
| `behind_cloudflare` | `false` | `true` — брать IP из `CF-Connecting-IP` (только если сайт реально за Cloudflare) |
| `allow_http_endpoint` | `false` | разрешить CRM по HTTP (только для тестов) |

## Локальная проверка

- `npm run dev` — форма «отправляется» в имитацию: в консоли видно, что ушло бы (в CRM не отправляется).
- `npm run serve:php` — настоящий `send.php` (нужен PHP). Для теста без CRM поменяйте `endpoint` на свой тестовый адрес
  и поставьте `allow_http_endpoint => true`.

## Открытые вопросы к Oktell

- Формат телефона: отправляем точно как в образце — ` 998 (97) 521 32 32` (пробел в начале).
- Ожидаемые значения `city` (`samarqand`) и `marka` (`li auto`).
- Доступность порта 8443 с IP хостинга; для режима `direct` — CORS для домена сайта.
