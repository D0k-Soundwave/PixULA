'use strict';
/**
 * Preferences > Inverse says which draw modes it changes nothing in. Attributes
 * Only (2026-10-19) gives both buttons the same job, as Ink and Paper Recolour
 * do, so the hint has to name it too - in every language, and in the English
 * fallback Preferences shows before the translations load.
 */
const fs = require('fs');
const path = require('path');
const { check, summary, REPO_ROOT } = require('./helpers/zx-stubs');

const I18N_DIR = path.join(REPO_ROOT, 'js', 'i18n');
const files = fs.readdirSync(I18N_DIR).filter((f) => f.endsWith('.js') && f !== 'i18n-manager.js').sort();

function loadTable(file) {
  const win = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(win);
  const key = Object.keys(win).find((k) => k.startsWith('i18n_'));
  return { code: key.slice(5), table: win[key] };
}

for (const f of files) {
  const { code, table } = loadTable(path.join(I18N_DIR, f));
  const label = table['dm.attributes'];
  const hint = table['pref.inverseHint'] || '';
  check(`${code}: the Inverse hint names Attributes Only ("${label}")`,
    !!label && hint.toLowerCase().includes(label.toLowerCase()), hint);
}

const prefs = fs.readFileSync(path.join(REPO_ROOT, 'js', 'ui', 'components', 'preferences-dialog.js'), 'utf8');
const en = loadTable(path.join(I18N_DIR, 'en.js')).table;
const fallback = prefs.match(/this\._t\('pref\.inverseHint', '((?:[^'\\]|\\.)*)'\)/);
check('Preferences: the English fallback is the en.js hint',
  !!fallback && fallback[1].replace(/\\'/g, "'") === en['pref.inverseHint'], fallback && fallback[1]);

summary();
