/**
 * Файлы для сервера: .htaccess (Apache), nginx.conf (deploy/), PHP-обработчик заявок, lead.php.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SERVER, PHP, DIST, DEPLOY } = require('./paths');
const { copyDir } = require('./utils');

/** скопировать PHP-обработчик (режим lead.mode = "php") */
function copyPhp() {
  // секрет для имени резервной папки заявок — создаётся один раз и больше не меняется
  const secretFile = path.join(PHP, 'secret.php');
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, `<?php return '${crypto.randomBytes(24).toString('hex')}';\n`);
  copyDir(PHP, DIST);
}

/** .htaccess в dist/ и nginx.conf в deploy/ — с актуальной CSP */
function writeServerConfigs(csp) {
  fs.writeFileSync(path.join(DIST, '.htaccess'), fs.readFileSync(path.join(SERVER, '.htaccess'), 'utf8').replace('{{CSP}}', csp));
  fs.mkdirSync(DEPLOY, { recursive: true });
  fs.writeFileSync(path.join(DEPLOY, 'nginx.conf'), fs.readFileSync(path.join(SERVER, 'nginx.conf.template'), 'utf8').replace('{{CSP}}', csp));
}

/**
 * lead.php — настройки CRM для send.php. PHP-файл, а не JSON: даже без .htaccess (nginx)
 * его содержимое не отдаётся посетителю как текст.
 */
function writeLeadConfig(lead, modelNames, siteUrl) {
  const host = new URL(siteUrl).host;
  const phpStr = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const toPhp = (v) => Array.isArray(v) ? `[${v.map(toPhp).join(', ')}]`
    : (v && typeof v === 'object') ? `[\n${Object.entries(v).map(([k, x]) => `  ${phpStr(k)} => ${toPhp(x)},`).join('\n')}\n]` : phpStr(v ?? '');
  fs.writeFileSync(path.join(DIST, 'lead.php'), `<?php\n// создано scripts/build.js из src/content/config.json → lead. Не редактируйте вручную.\nreturn ${toPhp({
    endpoint: lead.endpoint, marka: lead.marka, website: lead.website, city: lead.city,
    models: modelNames,                                         // белый список моделей для send.php
    allowedHosts: [host, `www.${host}`, ...(lead.allowedHosts || [])],
  })};\n`);
}

module.exports = { copyPhp, writeServerConfigs, writeLeadConfig };
