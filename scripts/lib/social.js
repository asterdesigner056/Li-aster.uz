/**
 * Иконки соцсетей (SVG внутри страницы — без внешних запросов).
 * Ссылки берутся из config.json → social. Пустая ссылка — иконка не выводится.
 * Новая сеть: добавьте сюда иконку и ссылку с тем же ключом в config.json.
 */
const { esc } = require('./utils');

const ICONS = {
  instagram: ['Instagram', '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'],
  telegram: ['Telegram', '<path d="M21.5 4.5L2.8 11.7c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.8 3.5c.7.5 1.7.1 1.9-.7l3.1-14.8c.2-1-.8-1.8-1.7-1.4z"/><path d="M9.5 15l9-8"/>'],
  youtube: ['YouTube', '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>'],
};

/** HTML-ссылки с иконками */
const socialHtml = (social = {}) => Object.entries(social)
  .filter(([k, v]) => ICONS[k] && /^https:\/\//.test(v || ''))
  .map(([k, v]) => `<a class="soc__a" href="${esc(v)}" target="_blank" rel="noopener noreferrer" aria-label="${ICONS[k][0]}" title="${ICONS[k][0]}" data-ev="social_${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k][1]}</svg></a>`).join('');

/** ссылки для Schema.org sameAs */
const socialUrls = (social = {}) => Object.entries(social).filter(([k, v]) => !k.startsWith('_') && v).map(([, v]) => v);

module.exports = { socialHtml, socialUrls };
