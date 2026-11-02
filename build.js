#!/usr/bin/env node
// Совместимость со старой командой «node build.js». Сама сборка — scripts/build.js (npm run build / npm run dev).
const { build } = require('./scripts/build.js');
try { build(); } catch (e) { console.error('Ошибка сборки:', e.message); process.exit(1); }
