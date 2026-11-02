/**
 * SEO: sitemap.xml и robots.txt. (JSON-LD-разметка собирается в build.js рядом со страницами.)
 */
const fs = require('fs');
const path = require('path');
const { DIST, LANGS } = require('./paths');
const { esc } = require('./utils');

/**
 * @param {object} o
 * @param {string} o.site        https://домен
 * @param {Function} o.abs       (lang, slug) → абсолютный адрес страницы
 * @param {string} o.defaultLang
 * @param {Array} o.models       сырые данные моделей
 * @param {Function} o.imgAbs    абсолютный адрес картинки
 */
function writeSitemapAndRobots({ site, abs, defaultLang, models, imgAbs }) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [null, ...models.map((m) => m.slug), 'privacy'];
  const urls = [];
  for (const slug of pages) for (const lang of LANGS) {
    const alt = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(l, slug)}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(defaultLang, slug)}"/>`;
    const m = slug && slug !== 'privacy' && models.find((x) => x.slug === slug);
    const imgs = m ? [m.hero, m.card].map((u) => `<image:image><image:loc>${esc(imgAbs(u))}</image:loc></image:image>`).join('') : '';
    const priority = slug === 'privacy' ? '0.2' : slug ? '0.8' : (lang === defaultLang ? '1.0' : '0.9');
    urls.push(`<url><loc>${abs(lang, slug)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority}</priority>${alt}${imgs}</url>`);
  }
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /send.php\nDisallow: /leads/\n\nSitemap: ${site}/sitemap.xml\nHost: ${site}\n`);
  return urls.length;
}

module.exports = { writeSitemapAndRobots };
