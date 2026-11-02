/**
 * Пути проекта. Всё, что касается расположения папок, — только здесь.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

module.exports = {
  ROOT,
  SRC,
  DIST: path.join(ROOT, 'dist'),          // готовый сайт (генерируется, руками не правится)
  DEPLOY: path.join(ROOT, 'deploy'),      // файлы для хостинга вне сайта (nginx.conf)

  CONTENT: path.join(SRC, 'content'),     // данные: config.json, models/, i18n/
  TEMPLATES: path.join(SRC, 'templates'), // pages/ (страницы) и partials/ (общие блоки)
  ASSETS: path.join(SRC, 'assets'),       // css, js, img, fonts — копируются в dist/assets
  PHP: path.join(SRC, 'php'),             // обработчик заявок (копируется в корень dist)
  SERVER: path.join(SRC, 'server'),       // шаблоны .htaccess и nginx.conf
  PRICE: path.join(SRC, 'price'),         // PDF прайс-листы → dist/price

  LANGS: ['ru', 'uz'],
};
