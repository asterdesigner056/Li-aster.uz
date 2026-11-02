#!/usr/bin/env node
/**
 * Режим разработки:  npm run dev
 *
 *  1. собирает сайт в dist/
 *  2. открывает его на http://localhost:3000
 *  3. при каждом сохранении файла в src/ пересобирает сайт и сам обновляет страницу в браузере
 *
 * Формы: PHP здесь не запускается, поэтому заявка не уходит в CRM — сервер отвечает «ок»
 * и печатает в консоль, что было бы отправлено. Проверить настоящую отправку: php -S localhost:8000 -t dist
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { build } = require('./build');
const { DIST, SRC } = require('./lib/paths');

const PORT = Number(process.env.PORT) || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
const clients = new Set();
const RELOAD = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

function rebuild() {
  try { build(); for (const c of clients) c.write('data: reload\n\n'); }
  catch (e) { console.error('\x1b[31mОшибка сборки:\x1b[0m', e.message); }
}

rebuild();

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  if (url === '/__reload') {                                     // канал автообновления
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }

  if (url.endsWith('/send.php') && req.method === 'POST') {      // имитация отправки заявки
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      const f = Object.fromEntries(new URLSearchParams(body));
      console.log(`\x1b[33m[dev] заявка (в CRM не отправлена):\x1b[0m ${f.name} · ${f.phone} · ${f.model || '—'} · ${f.type} · ${f.lang}`);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"dev":true}');
    });
    return;
  }

  let file = path.join(DIST, url);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end(); }   // защита от ../
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 — нет файла ' + url); }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (ext === '.html') return res.end(fs.readFileSync(file, 'utf8').replace('</body>', `${RELOAD}</body>`));
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n\x1b[32m▶ Сайт: http://localhost:${PORT}\x1b[0m   (узбекская версия: /uz/)`);
  console.log('  Сохраняйте файлы в src/ — страница обновится сама. Ctrl+C — выход.\n');
});

let timer;
fs.watch(SRC, { recursive: true }, (_, name) => {
  if (name && /secret\.php$/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(() => { console.log(`\n↻ изменён ${name || 'файл'} — пересобираю…`); rebuild(); }, 200);
});
