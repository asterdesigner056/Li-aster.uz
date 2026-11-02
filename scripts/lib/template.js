/**
 * Мини-шаблонизатор (без зависимостей). Синтаксис в .html-шаблонах:
 *
 *   {{key.path}}                    — подставить значение (объект {ru, uz} → строка текущего языка)
 *   {{> partial}}                   — вставить src/templates/partials/partial.html
 *   {{#each list}} … {{/each}}      — повторить блок для каждого элемента (поля элемента доступны напрямую)
 *
 * Значения подставляются как есть (это HTML), экранирование — на стороне сборщика (utils.esc).
 * Если ключа нет — в консоль пишется предупреждение «⚠ нет значения для {{…}}».
 */
const fs = require('fs');
const path = require('path');
const { TEMPLATES } = require('./paths');

/** прочитать все общие блоки из src/templates/partials */
function loadPartials() {
  const dir = path.join(TEMPLATES, 'partials');
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.html'))
    .map((f) => [path.basename(f, '.html'), fs.readFileSync(path.join(dir, f), 'utf8')]));
}

/** прочитать шаблон страницы из src/templates/pages */
const loadPage = (name) => fs.readFileSync(path.join(TEMPLATES, 'pages', `${name}.html`), 'utf8');

function lookup(ctx, key, lang, file) {
  let v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  if (v && typeof v === 'object' && !Array.isArray(v) && lang in v) v = v[lang];
  if (v === undefined) { console.warn(`  ⚠ нет значения для {{${key}}} [${lang}] ${file || ''}`); return ''; }
  return v;
}

/**
 * @param {string} tpl      текст шаблона
 * @param {object} ctx      данные
 * @param {string} lang     'ru' | 'uz'
 * @param {object} partials результат loadPartials()
 * @param {string} [file]   имя шаблона (для сообщений об ошибках)
 */
function render(tpl, ctx, lang, partials, file) {
  for (let i = 0; i < 5 && /{{>\s*\w+\s*}}/.test(tpl); i++) {
    tpl = tpl.replace(/{{>\s*(\w+)\s*}}/g, (_, n) => partials[n] ?? `<!-- partial ${n} not found -->`);
  }
  tpl = tpl.replace(/{{#each ([\w.]+)}}([\s\S]*?){{\/each}}/g, (_, list, inner) =>
    (lookup(ctx, list, lang, file) || []).map((item) => render(inner, { ...ctx, ...item }, lang, partials, file)).join(''));
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => lookup(ctx, key, lang, file));
}

module.exports = { loadPartials, loadPage, render };
