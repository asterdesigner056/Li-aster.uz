/**
 * Картинки: поиск файлов, автоматическая галерея, проверка веса.
 *
 * Автоматизация для контент-менеджера:
 *  • Расширение не важно. Если в JSON указано hero.webp, а в папке лежит hero.jpg (или .png/.jpeg/.avif) —
 *    сборка возьмёт его сама. Фото можно заменять, не трогая JSON.
 *  • Галерея модели собирается из файлов gallery-1, gallery-2, … в папке модели
 *    (src/assets/img/models/<id>/). Добавили gallery-7.jpg — он появился на сайте; удалили — пропал.
 *    Порядок — по номеру в имени.
 *  • Фото тяжелее HEAVY_KB перечисляются после сборки — их стоит сжать.
 *  • В JSON можно указать и полную ссылку https://… — она будет использована как есть
 *    (и автоматически разрешена в Content Security Policy).
 */
const fs = require('fs');
const path = require('path');
const { SRC } = require('./paths');

const EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.avif'];
const HEAVY_KB = 800;

const state = { siteUrl: '', used: new Set(), external: new Set(), notFound: new Set() };
const encodeUrl = (u) => encodeURI(decodeURI(u));

/** начать новую сборку */
function reset(siteUrl) { state.siteUrl = siteUrl; state.used.clear(); state.external.clear(); state.notFound.clear(); }

/** найти реальный файл для пути из JSON: точное имя или то же имя с другим расширением */
function findLocal(rel) {
  if (fs.existsSync(path.join(SRC, rel))) return rel;
  const dir = path.posix.dirname(rel), base = path.posix.basename(rel, path.posix.extname(rel));
  for (const ext of EXTS) {
    const cand = path.posix.join(dir, base + ext);
    if (fs.existsSync(path.join(SRC, cand))) return cand;
  }
  return null;
}

/** путь к картинке для HTML. base — относительный префикс до корня сайта ('', '../', '../../') */
function img(u, base) {
  if (!u) return '';
  if (/^https?:/.test(u)) { state.external.add(u); return encodeUrl(u); }
  const local = findLocal(u);
  if (local) { state.used.add(local); return base + encodeURI(local); }
  state.notFound.add(u);
  return base + encodeURI(u);                // файла нет — на странице блок с картинкой просто скроется
}

/** абсолютный адрес картинки (Open Graph, Schema.org, sitemap) */
function imgAbs(u) {
  if (!u) return '';
  if (/^https?:/.test(u)) return encodeUrl(u);
  return `${state.siteUrl}/${encodeURI(findLocal(u) || u)}`;
}

/** галерея модели: файлы gallery-N.* из папки модели (по номеру) */
function gallery(model) {
  const dir = path.posix.dirname(model.card || model.hero || '');
  const abs = path.join(SRC, dir);
  if (dir && fs.existsSync(abs)) {
    const files = fs.readdirSync(abs)
      .filter((f) => /^gallery[-_ ]?\d+\.(webp|jpe?g|png|avif)$/i.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    if (files.length) return files.map((f) => path.posix.join(dir, f));
  }
  return model.gallery || [];
}

/** внешние картинки, использованные на страницах (для CSP) */
const remoteOrigins = () => [...state.external];

/** итоги сборки: каких файлов нет и что слишком тяжёлое */
function report() {
  if (state.notFound.size) {
    console.log('  ⚠ не найдены фото (блоки с ними будут скрыты):');
    [...state.notFound].forEach((f) => console.log(`     src/${f}`));
  }
  const heavy = [...state.used].map((f) => [f, fs.statSync(path.join(SRC, f)).size / 1024]).filter(([, kb]) => kb > HEAVY_KB);
  if (heavy.length) {
    console.log(`  ℹ тяжёлые фото (> ${HEAVY_KB} КБ) — сожмите для быстрой загрузки (docs/01-content.md):`);
    heavy.sort((a, b) => b[1] - a[1]).forEach(([f, kb]) => console.log(`     ${Math.round(kb)} КБ  src/${f}`));
  }
}

module.exports = { reset, img, imgAbs, gallery, remoteOrigins, report, findLocal };
