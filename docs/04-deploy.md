# 04 · Размещение на хостинге

## Что загружать

Содержимое папки **`dist/`** после `npm run build` — в корень сайта (`public_html`, `www`, `htdocs`…).

**Включая скрытые файлы** `.htaccess` и `.user.ini` — многие FTP-клиенты их не показывают: включите «показывать скрытые файлы».

```
dist/
├── index.html, uz/, models/, privacy/   страницы
├── assets/                              css, js, img, fonts
├── price/                               PDF прайс-листов
├── send.php, config.php, lead.php, secret.php, .user.ini   приём заявок (режим php)
├── .htaccess                            безопасность, HTTPS, кэш, CSP (Apache)
├── sitemap.xml, robots.txt
```

## Требования к серверу

- PHP **8.2.35+ / 8.3.36+ / 8.4.27+ / 8.5.12+** (исправлен PHP2Shell — см. [05-security.md](05-security.md)), расширения `curl`, `mbstring`.
- HTTPS (Let's Encrypt — бесплатно в большинстве панелей).
- Исходящие соединения на `oktell.aster.uz:8443` (и `api.telegram.org:443`, если включён Telegram).
- Запись в папку уровнем выше публичной (для `aster-li-private/`) — желательно.

## Apache

Всё уже настроено в `dist/.htaccess`: HTTPS и без www, запрет служебных файлов и любого PHP кроме `send.php`,
ограничения для `send.php`, заголовки безопасности и CSP, сжатие, кэш статики.
Нужны модули `mod_rewrite`, `mod_headers` (обычно включены) и `AllowOverride All`.

## nginx

`.htaccess` на nginx **не работает**. Передайте хостингу `deploy/nginx.conf` (создаётся при сборке, с актуальной CSP)
и укажите в нём путь к сокету PHP-FPM.

## После загрузки — проверка

| Проверка | Ожидается |
|---|---|
| `https://домен/` и `/uz/` | открываются, есть стили и фото |
| `http://домен/`, `https://www.домен/` | редирект на `https://домен/` |
| `https://домен/config.php` | 403/404 |
| `https://домен/send.php` (просто открыть) | 403 |
| Отправить тестовую заявку | «Спасибо!», заявка в Oktell, строка в `crm.log` со статусом `ok` |
| DevTools → Network → заголовки страницы | есть `Content-Security-Policy`, `Strict-Transport-Security` |
| DevTools → Console | нет ошибок «Refused to load…» |

## Поисковики

1. Добавить сайт в **Яндекс.Вебмастер** и **Google Search Console**.
2. Коды подтверждения → `config.json → analytics.yandexVerification / googleVerification` → `npm run build` → загрузить.
3. Отправить `https://домен/sitemap.xml`.

## Обновление сайта

`npm run build` → загрузить `dist/` целиком поверх. Файлы заявок не затрагиваются (они вне `dist`/публичной папки).
CSS и JS подключаются с меткой версии `?v=…`, поэтому посетители сразу получат новую версию.
