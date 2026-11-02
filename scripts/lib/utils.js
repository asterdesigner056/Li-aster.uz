/**
 * Мелкие общие функции.
 */
const fs = require('fs');
const path = require('path');

/** прочитать JSON-файл */
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** экранировать текст для HTML-атрибутов */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** убрать HTML-теги (для meta-описаний и Schema.org) */
const strip = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');

/** 1150000000 → "1 150 000 000" */
const fmtNumber = (n) => Number(n).toLocaleString('ru-RU').replace(/[, ]/g, ' ');

/** рекурсивно скопировать папку */
function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    f.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

/** origin (схема + домен) списка ссылок, без повторов */
const origins = (list) => [...new Set(list.filter(Boolean).map((u) => {
  try { return new URL(u).origin; } catch (e) { return ''; }
}).filter(Boolean))];

module.exports = { readJson, esc, strip, fmtNumber, copyDir, origins };
