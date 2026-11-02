/**
 * Content Security Policy — какие скрипты, стили, картинки и фреймы разрешено загружать.
 *
 * Политика отдаётся заголовком сервера (.htaccess / nginx), а не meta-тегом в странице:
 * на хостинге защита работает, а просмотр файлов с диска (file://) не ломается.
 * Встроенные скрипты (только счётчики аналитики) разрешаются по SHA-256 хешу — хеши
 * собираются со всех страниц при сборке.
 */
const crypto = require('crypto');
const { origins } = require('./utils');

function createCsp({ analytics = {}, fontsLocal, directEndpoint, remoteImages = () => [] }) {
  const hashes = new Set();

  /** собрать хеши встроенных исполняемых скриптов страницы (JSON-данные и JSON-LD не исполняются — пропускаем) */
  function collect(html) {
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)) {
      hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    }
    return html;
  }

  /** итоговая строка политики */
  function policy() {
    const a = analytics;
    const g = a.ga4 || a.gtm; // GTM загружает GA4 и другие теги Google
    return [
      "default-src 'self'",
      ["script-src 'self'", ...hashes, g && 'https://www.googletagmanager.com https://*.googletagmanager.com', a.yandexMetrika && 'https://mc.yandex.ru https://mc.yandex.com', a.metaPixel && 'https://connect.facebook.net'].filter(Boolean).join(' '),
      `style-src 'self' 'unsafe-inline'${fontsLocal ? '' : ' https://fonts.googleapis.com'}`,
      `font-src 'self'${fontsLocal ? '' : ' https://fonts.gstatic.com'}`,
      ["img-src 'self' data:", ...origins(remoteImages()), a.yandexMetrika && 'https://mc.yandex.ru https://mc.yandex.com', g && 'https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.uz', a.metaPixel && 'https://www.facebook.com'].filter(Boolean).join(' '),
      ["connect-src 'self'", directEndpoint && origins([directEndpoint])[0], a.yandexMetrika && 'https://mc.yandex.ru https://mc.yandex.com', g && 'https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.uz', a.metaPixel && 'https://www.facebook.com'].filter(Boolean).join(' '),
      ['frame-src https://yandex.uz https://yandex.ru https://yandex.com', g && 'https://www.googletagmanager.com'].filter(Boolean).join(' '),
      "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'upgrade-insecure-requests',
    ].join('; ');
  }

  return { collect, policy };
}

module.exports = { createCsp };
