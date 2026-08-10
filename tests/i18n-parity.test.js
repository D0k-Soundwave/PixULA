'use strict';
/**
 * i18n parity — en.js is the single source of truth for the key set.
 *
 * Fails when any locale:
 *  - is missing keys that en.js has, or carries keys en.js doesn't (listed
 *    per locale);
 *  - has an empty/whitespace-only value;
 *  - disagrees with en.js about the {param} placeholders inside a value
 *    (a translation that drops or renames {name}/{error} breaks t()
 *    interpolation at runtime).
 *
 * (There was no i18n test in the old tree — this is the enforcement the
 * REFACTOR_PLAN §4 Phase 6 row calls for. Identical-to-English values are
 * NOT failures: plenty are legitimately identical — 'OK', theme/format
 * names, 'XOR', autonyms.)
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'js', 'i18n');
const SOT = 'en';

function loadTable(file) {
  const win = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(win);
  const key = Object.keys(win).find((k) => k.startsWith('i18n_'));
  if (!key) throw new Error(`${path.basename(file)} did not set window.i18n_<code>`);
  return { code: key.slice(5), table: win[key] };
}

const files = fs.readdirSync(I18N_DIR)
  .filter((f) => f.endsWith('.js') && f !== 'i18n-manager.js')
  .sort();

const locales = files.map((f) => loadTable(path.join(I18N_DIR, f)));
const en = locales.find((l) => l.code === SOT);
if (!en) { console.log(`FAIL: ${SOT}.js not found`); process.exit(1); }

const enKeys = Object.keys(en.table);
const placeholders = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');

let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL: ${msg}`); };

if (locales.length !== 13) {
  fail(`expected 13 locale files, found ${locales.length}: ${locales.map((l) => l.code).join(', ')}`);
}

for (const { code, table } of locales) {
  const missing = enKeys.filter((k) => !(k in table));
  const extra = Object.keys(table).filter((k) => !(k in en.table));
  if (missing.length) fail(`${code}: missing ${missing.length} key(s): ${missing.join(', ')}`);
  if (extra.length)   fail(`${code}: extra ${extra.length} key(s): ${extra.join(', ')}`);

  for (const [k, v] of Object.entries(table)) {
    if (typeof v !== 'string' || v.trim() === '') fail(`${code}: empty value for '${k}'`);
  }
  if (code !== SOT) {
    for (const k of enKeys) {
      if (k in table && placeholders(table[k]) !== placeholders(en.table[k])) {
        fail(`${code}: '${k}' placeholders [${placeholders(table[k])}] != en [${placeholders(en.table[k])}]`);
      }
    }
  }
}

console.log(failures === 0
  ? `i18n-parity: ${locales.length} locales × ${enKeys.length} keys consistent\n\nALL CHECKS PASSED`
  : `\n${failures} PARITY FAILURE(S)`);
process.exit(failures ? 1 : 0);
