#!/usr/bin/env node
/**
 * Сборка сайта Li Auto · Aster Li (без зависимостей, Node.js 18+).
 *
 *   npm run build            — собрать сайт в dist/
 *   npm run dev              — собрать, открыть локальный сервер и пересобирать при изменениях
 *
 * Что собирается (для каждого языка из paths.LANGS):
 *   /index.html                      главная          ← src/templates/pages/home.html
 *   /models/<slug>/index.html        страница модели  ← src/templates/pages/model.html + src/content/models/<id>.json
 *   /privacy/index.html              политика         ← src/templates/pages/privacy.html
 *   (/uz/… — то же на узбекском)
 * плюс sitemap.xml, robots.txt, .htaccess (с CSP), lead.php, deploy/nginx.conf.
 *
 * Подробно: docs/02-architecture.md
 */
const fs = require('fs');
const path = require('path');

const { ROOT, CONTENT, ASSETS, PRICE, SERVER, DIST, LANGS } = require('./lib/paths');
const { readJson, esc, strip, fmtNumber, copyDir } = require('./lib/utils');
const { loadPartials, loadPage, render } = require('./lib/template');
const images = require('./lib/images');
const { uzUnits } = require('./lib/units');
const { socialHtml, socialUrls } = require('./lib/social');
const { analyticsSnippets } = require('./lib/analytics');
const { createCsp } = require('./lib/csp');
const { copyPhp, writeServerConfigs, writeLeadConfig } = require('./lib/server-files');
const { writeSitemapAndRobots } = require('./lib/seo');

/** колонок в сетке моделей: до 5 в ряд, ряды выравниваются (6 → 3+3, 7 → 4+3, 8 → 4+4) */
const gridCols = (n) => (n <= 5 ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / 5)));

/** путь к PDF прайс-листа для языка: "price/x.pdf" или { ru, uz }; null — файла нет (кнопка скрывается) */
function priceFile(raw, lang) {
  const p = raw.priceList && (typeof raw.priceList === 'string' ? raw.priceList : raw.priceList[lang] || raw.priceList.ru);
  return p && fs.existsSync(path.join(PRICE, path.basename(p))) ? p : null;
}

function build() {
  const t0 = Date.now();

  /* ---------- данные ---------- */
  const cfg = readJson(path.join(CONTENT, 'config.json'));
  const tr = Object.fromEntries(LANGS.map((l) => [l, readJson(path.join(CONTENT, 'i18n', `${l}.json`))]));
  const modelsRaw = cfg.modelOrder.map((id) => readJson(path.join(CONTENT, 'models', `${id}.json`)));
  const partials = loadPartials();
  const tpl = { home: loadPage('home'), model: loadPage('model'), privacy: loadPage('privacy') };

  const site = cfg.siteUrl.replace(/\/$/, '');
  const version = Date.now().toString(36);                       // сброс кэша CSS/JS: ?v=…
  const today = new Date().toISOString().slice(0, 10);
  const leadMode = (cfg.lead && cfg.lead.mode) === 'direct' ? 'direct' : 'php';
  const fontsLocal = fs.existsSync(path.join(ASSETS, 'fonts', 'fonts.css'));
  const analytics = cfg.analytics || {};
  const { head: analyticsHead, body: analyticsBody } = analyticsSnippets(analytics);

  images.reset(site);
  const csp = createCsp({ analytics, fontsLocal, directEndpoint: leadMode === 'direct' && cfg.lead.endpoint, remoteImages: images.remoteOrigins });

  /* ---------- адреса страниц ---------- */
  // путь страницы от корня сайта: '' — главная RU, 'uz/', 'models/li-l9-ultra/', 'uz/privacy/'…
  const rel = (lang, slug) => (lang === cfg.defaultLang ? '' : `${lang}/`) + (slug ? (slug === 'privacy' ? 'privacy/' : `models/${slug}/`) : '');
  const abs = (lang, slug) => `${site}/${rel(lang, slug)}`;     // канонический адрес (без index.html)
  const depth = (r) => r.split('/').filter(Boolean).length;
  // внутренние ссылки ведут на index.html — работает и с диска (file://), и на любом хостинге
  const href = (base, r) => base + r + 'index.html';

  /* ---------- статика ---------- */
  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(ASSETS, path.join(DIST, 'assets'));
  copyDir(PRICE, path.join(DIST, 'price'));
  fs.rmSync(path.join(DIST, 'price', 'README.txt'), { force: true }); // справка для разработчиков, на сайт не нужна
  copyDir(SERVER, DIST);
  fs.rmSync(path.join(DIST, 'nginx.conf.template'), { force: true });
  if (leadMode === 'php') copyPhp();

  for (const lang of LANGS) {
    const t = tr[lang];
    const L = (o) => (o && typeof o === 'object' && !Array.isArray(o) && lang in o ? o[lang] : o);   // {ru, uz} → строка
    const U = (s) => (lang === 'uz' ? uzUnits(s) : s);

    const specVal = (m, key) => { for (const g of m.specs) for (const [k, v] of g.rows) if (k === key) return L(v); return ''; };
    const num = (s) => (String(s).match(/[\d\s]+(?=\s*(л\.с|км))/) || [''])[0].trim();

    /** модели в виде, удобном шаблону карточки (partials/mcard.html) */
    const makeModels = (base) => modelsRaw.map((m) => ({
      ...m,
      cls: L(m.class),
      tag: L(m.tagline),
      short: m.name.replace(/^Li\s*/, '').replace(/\s*(Livis|Ultra)/i, ''),
      url: href(base, rel(lang, m.slug)),
      absUrl: abs(lang, m.slug),
      cardImg: images.img(m.card, base),
      seats: specVal(m, 'seats'),
      hp: num(String(specVal(m, 'power')).split('/').pop()),
      rangeKm: num(specVal(m, 'range')),
      badgeHtml: m.badge ? `<span class="badge">${L(m.badge)}</span>` : '',
      priceHtml: m.price ? `<small>${t.models.from}</small> ${fmtNumber(m.price)} <small>${t.models.currency}</small>` : t.models.priceOnRequest,
    }));

    const dealers = cfg.dealers.map((d) => ({
      ...d, dname: L(d.name), dcity: L(d.city), daddr: L(d.address), dhours: L(d.hours),
      phoneRaw: d.phone.replace(/[^\d+]/g, ''),
      mapSrc: d.yandexOrgId
        ? `https://yandex.uz/map-widget/v1/org/${d.yandexOrgId}/?lang=${lang === 'uz' ? 'uz_UZ' : 'ru_RU'}`
        : `https://yandex.uz/map-widget/v1/?ll=${d.lon}%2C${d.lat}&z=15&pt=${d.lon}%2C${d.lat}%2Cpm2dgl&lang=${lang === 'uz' ? 'uz_UZ' : 'ru_RU'}`,
    }));

    /** Schema.org: автосалон (вставляется на все страницы) */
    const dealerLd = dealers.map((d) => ({
      '@type': 'AutoDealer', '@id': `${site}/#dealer-${d.id}`, name: d.dname, brand: { '@type': 'Brand', name: cfg.brand },
      url: abs(lang), telephone: d.phone, ...(cfg.email ? { email: cfg.email } : {}), image: images.imgAbs(cfg.ogImage),
      address: { '@type': 'PostalAddress', streetAddress: d.daddr, addressLocality: d.dcity, addressRegion: lang === 'uz' ? 'Samarqand viloyati' : 'Самаркандская область', addressCountry: 'UZ' },
      geo: { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lon },
      hasMap: d.googleMaps, openingHours: d.openingHours, priceRange: '$$$$',
      areaServed: lang === 'uz' ? 'Samarqand' : 'Самарканд',
      sameAs: [...socialUrls(cfg.social), d.yandexMaps].filter(Boolean),
    }));

    /** общий контекст любой страницы (шапка, подвал, формы, SEO) */
    const common = (slug, extra) => {
      const r = rel(lang, slug);
      const base = '../'.repeat(depth(r));
      const models = makeModels(base);
      const current = slug ? models.find((m) => m.slug === slug) : null;
      return {
        t, cfg, lang, base, version, models, dealers,
        year: new Date().getFullYear(),
        dealerName: L(cfg.dealer),
        mainAddress: `${dealers[0].daddr}`,
        pageUrl: abs(lang, slug),
        homeLink: href(base, rel(lang)),
        homeHref: slug ? href(base, rel(lang)) : '',
        navExtra: slug ? `<a href="#specs">${t.nav.specs}</a><a href="#gallery">${t.nav.gallery}</a>` : `<a href="#comfort">${t.nav.comfort}</a>`,
        hreflang: [
          ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(l, slug)}">`),
          `<link rel="alternate" hreflang="x-default" href="${abs(cfg.defaultLang, slug)}">`,
        ].join('\n'),
        verification: [
          analytics.googleVerification && `<meta name="google-site-verification" content="${esc(analytics.googleVerification)}">`,
          analytics.yandexVerification && `<meta name="yandex-verification" content="${esc(analytics.yandexVerification)}">`,
        ].filter(Boolean).join('\n'),
        langSwitch: LANGS.map((l) => `<a href="${href(base, rel(l, slug))}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${tr[l].langShort}</a>`).join(''),
        modelOptions: `<option value="">${t.form.anyModel}</option>` + models.map((m) => `<option${current && m.id === current.id ? ' selected' : ''}>${m.name}</option>`).join(''),
        dealerOptions: dealers.map((d) => `<option value="${d.id}">${d.dname} — ${d.dcity}</option>`).join(''),
        footerModels: models.map((m) => `<a href="${m.url}">${m.name}</a>`).join(''),
        emailLink: cfg.email ? `<a href="mailto:${cfg.email}">${cfg.email}</a>` : '',
        socialLinks: socialHtml(cfg.social),
        privacyLink: href(base, rel(lang, 'privacy')),
        contactsHref: slug === 'privacy' ? href(base, rel(lang)) + '#contacts' : '#contacts',
        fontsHtml: fontsLocal
          ? `<link rel="stylesheet" href="${base}assets/fonts/fonts.css?v=${version}">`
          : '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">',
        leadTitle: t.form.title,
        leadSub: t.form.sub,
        analyticsHead,
        analyticsBody,
        // данные для assets/js/main.js — JSON внутри <script type="application/json" id="site-data">
        siteJson: JSON.stringify({
          lang, endpoint: base + 'send.php', ym: analytics.yandexMetrika || '', lead: leadMode === 'direct'
            ? { mode: 'direct', endpoint: cfg.lead.endpoint, marka: cfg.lead.marka, website: cfg.lead.website, city: cfg.lead.city }
            : { mode: 'php' },
          dealers: dealers.map((d) => ({ id: d.id, name: d.dname, lat: d.lat, lon: d.lon })),
          i18n: { ...t.form, bookTitle: t.book.title, bookTitleModel: t.book.titleModel },
        }).replace(/</g, '\\u003c'),
        ...extra(base, models, current),
      };
    };

    const write = (slug, html) => {
      const out = path.join(DIST, rel(lang, slug), 'index.html');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, csp.collect(html));
      console.log(`  ✓ ${path.relative(ROOT, out)}`);
    };

    /* ===== главная ===== */
    write(null, render(tpl.home, common(null, (base, models) => ({
      bodyClass: 'page-home',
      metaTitle: esc(t.meta.title), metaDesc: esc(t.meta.description), metaKeywords: esc(t.meta.keywords), gridCols: gridCols(models.length), ogTitle: esc(t.meta.ogTitle), ogDesc: esc(t.meta.ogDescription || t.meta.description),
      ogImageUrl: images.imgAbs(cfg.ogImage),
      heroImg: images.img(cfg.images.hero, base), interiorImg: images.img(cfg.images.interior, base), offerImg: images.img(cfg.images.offer, base),
      faqHtml: t.faq.items.map((f, i) => `<details class="reveal"${i === 0 ? ' open' : ''}><summary>${f.q}</summary><p>${f.a}</p></details>`).join(''),
      jsonld: JSON.stringify({
        '@context': 'https://schema.org', '@graph': [
          { '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`, name: `${cfg.dealerShort} · ${cfg.brand}`, inLanguage: LANGS },
          { '@type': 'WebPage', '@id': `${abs(lang)}#page`, url: abs(lang), name: strip(t.meta.title), description: t.meta.description, inLanguage: lang, isPartOf: { '@id': `${site}/#website` }, about: { '@id': `${site}/#dealer-${dealers[0].id}` } },
          ...dealerLd,
          { '@type': 'ItemList', name: t.models.title, itemListElement: models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: m.absUrl, name: m.name })) },
          { '@type': 'FAQPage', mainEntity: t.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ],
      }).replace(/</g, '\\u003c'),
    })), lang, partials, 'home'));

    /* ===== страницы моделей ===== */
    for (const raw of modelsRaw) {
      write(raw.slug, render(tpl.model, common(raw.slug, (base, models, m) => {
        const keyHtml = raw.key.map((k) => `<div><dt>${U(k.v)}</dt><dd>${L(k.l)}</dd></div>`).join('');
        const sectionsHtml = raw.sections.map((s, i) => `
  <article class="frow${i % 2 ? ' frow--rev' : ''}">
    <div class="frow__media reveal"><img src="${images.img(s.img, base)}" alt="${esc(m.name)} — ${esc(strip(L(s.title)))}" loading="lazy" decoding="async" data-hide-broken></div>
    <div class="frow__txt">
      <p class="eyebrow reveal">${L(s.eyebrow)}</p>
      <h2 class="h3 reveal">${L(s.title)}</h2>
      <p class="reveal">${L(s.text)}</p>
    </div>
  </article>`).join('');
        const specsHtml = raw.specs.map((g) => `
      <div class="sgroup reveal"><h3>${t.model.groups[g.group] || g.group}</h3><dl>${g.rows.map(([k, v]) =>
          `<div><dt>${t.model.spec[k] || k}</dt><dd itemprop="${k === 'seats' ? 'vehicleSeatingCapacity' : ''}">${U(L(v))}</dd></div>`).join('')}</dl></div>`).join('').replace(/ itemprop=""/g, '');
        const galleryHtml = images.gallery(raw).map((g, i) => `<figure class="gal__item"><img src="${images.img(g, base)}" alt="${esc(m.name)} — ${i + 1}" loading="lazy" decoding="async" data-hide-broken="figure"></figure>`).join('');
        const title = L(raw.seo.title), desc = L(raw.seo.description);
        return {
          bodyClass: 'page-model',
          m: {
            ...m, keyHtml, sectionsHtml, specsHtml, galleryHtml,
            priceBtn: priceFile(raw, lang)
              ? `<a href="${base}${encodeURI(priceFile(raw, lang))}" class="btn btn--light reveal" download target="_blank" rel="noopener" data-ev="price_download_${m.id}"><svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>${t.model.priceList}</a>`
              : '',
            introText: L(raw.intro),
            badgeInline: raw.badge ? `<span class="badge badge--inline">${L(raw.badge)}</span>` : '',
          },
          others: models.filter((x) => x.id !== m.id), othersCols: gridCols(models.length - 1),
          metaTitle: esc(title), metaDesc: esc(desc), ogDesc: esc(desc), ogTitle: esc(title),
          metaKeywords: esc(`${m.name}, ${m.name} ${lang === 'uz' ? 'Samarqand, narxi, xususiyatlari' : 'Самарканд, цена, характеристики, купить'}, Li Auto, ${cfg.dealerShort}`),
          ogImageUrl: images.imgAbs(raw.hero),
          heroImg: images.img(raw.hero, base),
          leadTitle: t.model.ctaTitle.replace('{name}', m.name),
          leadSub: t.model.ctaSub,
          jsonld: JSON.stringify({
            '@context': 'https://schema.org', '@graph': [
              { '@type': 'WebPage', '@id': `${m.absUrl}#page`, url: m.absUrl, name: title, description: desc, inLanguage: lang, isPartOf: { '@id': `${site}/#website` } },
              { '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: t.nav.home, item: abs(lang) },
                { '@type': 'ListItem', position: 2, name: t.nav.models, item: `${abs(lang)}#models` },
                { '@type': 'ListItem', position: 3, name: m.name, item: m.absUrl },
              ] },
              {
                '@type': 'Car', name: m.name, description: strip(L(raw.intro)), url: m.absUrl,
                brand: { '@type': 'Brand', name: cfg.brand }, manufacturer: { '@type': 'Organization', name: 'Li Auto Inc.' },
                image: [images.imgAbs(raw.hero), images.imgAbs(raw.card), ...raw.sections.map((s) => images.imgAbs(s.img))],
                vehicleSeatingCapacity: Number(m.seats) || undefined,
                driveWheelConfiguration: 'https://schema.org/AllWheelDriveConfiguration',
                fuelType: 'Electricity, Gasoline (range extender)', bodyType: 'SUV',
                offers: {
                  '@type': 'Offer', url: m.absUrl, priceCurrency: 'UZS', availability: 'https://schema.org/InStock',
                  ...(raw.price ? { price: raw.price } : {}), seller: { '@id': `${site}/#dealer-${dealers[0].id}` },
                },
              },
              ...dealerLd,
            ],
          }).replace(/</g, '\\u003c'),
        };
      }), lang, partials, raw.id));
      const pl = raw.priceList && (typeof raw.priceList === 'string' ? raw.priceList : raw.priceList[lang]);
      if (pl && !priceFile(raw, lang)) console.warn(`  ⚠ прайс-лист ещё не добавлен (кнопка скрыта): src/${pl}`);
    }

    /* ===== политика конфиденциальности ===== */
    write('privacy', render(tpl.privacy, common('privacy', (base) => ({
      bodyClass: 'page-privacy',
      metaTitle: esc(`${t.privacy.title} | ${cfg.dealerShort}`), metaDesc: esc(t.privacy.description), ogDesc: esc(t.privacy.description), ogTitle: esc(t.privacy.title),
      metaKeywords: '', ogImageUrl: images.imgAbs(cfg.ogImage), heroImg: images.img(cfg.images.hero, base),
      homeHref: href(base, rel(lang)),
      navExtra: '',
      privacyHtml: t.privacy.sections.map((sec) => `<section><h2>${sec.h}</h2>${sec.p.map((x) => `<p>${x
        .replace(/\{dealer\}/g, L(cfg.dealer)).replace(/\{phone\}/g, cfg.phone)
        .replace(/\{address\}/g, L(cfg.dealers[0].address)).replace(/\{site\}/g, site.replace(/^https?:\/\//, ''))
        .replace(/\{legal\}/g, L(cfg.legalName) || L(cfg.dealer))}</p>`).join('')}</section>`).join(''),
      updated: today.split('-').reverse().join('.'),
      jsonld: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: t.privacy.title, url: abs(lang, 'privacy'), inLanguage: lang }),
    })), lang, partials, 'privacy'));
  }

  /* ---------- файлы сервера, SEO, итоги ---------- */
  writeServerConfigs(csp.policy());
  if (leadMode === 'php') writeLeadConfig(cfg.lead, modelsRaw.map((m) => m.name), site);
  const pages = writeSitemapAndRobots({ site, abs, defaultLang: cfg.defaultLang, models: modelsRaw, imgAbs: images.imgAbs });
  console.log(`  ✓ dist/sitemap.xml (${pages} стр.), dist/robots.txt, dist/.htaccess, deploy/nginx.conf`);
  images.report();
  console.log(`Готово за ${Date.now() - t0} мс → dist/`);
}

module.exports = { build };

if (require.main === module) {
  try { build(); } catch (e) { console.error('Ошибка сборки:', e.message); process.exit(1); }
}
