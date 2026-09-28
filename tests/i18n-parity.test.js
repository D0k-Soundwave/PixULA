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
 *    interpolation at runtime);
 *  - leaves out a plural form its language needs. A `plural.*` value is
 *    tagged forms, 'one: {n} byte | other: {n} bytes' (see I18n.plural);
 *    each locale must give `other` plus every category Intl.PluralRules puts
 *    a whole number from 0 to 200 in (Polish: one, few, many), and every
 *    form must carry the same placeholders as English's.
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
  const text = fs.readFileSync(file, 'utf8');
  const win = {};
  new Function('window', text)(win);
  const key = Object.keys(win).find((k) => k.startsWith('i18n_'));
  if (!key) throw new Error(`${path.basename(file)} did not set window.i18n_<code>`);
  return { code: key.slice(5), table: win[key], text };
}

/**
 * Duplicate literal keys in a JS object-literal source file are invisible
 * to loadTable() above: `eval`-based loading collapses `'k': 'a', 'k': 'b'`
 * to the object `{k: 'b'}`, so a second, accidental definition of an
 * existing key silently wins and every check downstream only ever sees the
 * winner. This scans the raw TEXT instead, matching each top-level
 * `'key.name':` line the same way every locale file writes one (single
 * quotes, one key per line, per the established convention), and reports
 * any key that appears more than once.
 */
function duplicateKeys(text) {
  const counts = new Map();
  const re = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = re.exec(text))) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

const files = fs.readdirSync(I18N_DIR)
  .filter((f) => f.endsWith('.js') && f !== 'i18n-manager.js')
  .sort();

const locales = files.map((f) => loadTable(path.join(I18N_DIR, f)));
const en = locales.find((l) => l.code === SOT);
if (!en) { console.log(`FAIL: ${SOT}.js not found`); process.exit(1); }

const enKeys = Object.keys(en.table);
const placeholders = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');

const isPlural = (k) => k.startsWith('plural.');
/** Same parse as Helpers.parsePluralForms (helpers.js needs a browser window). */
const pluralForms = (raw) => {
  const forms = {};
  for (const part of String(raw).split('|')) {
    const m = part.match(/^\s*(zero|one|two|few|many|other)\s*:\s*(.*?)\s*$/);
    if (m) forms[m[1]] = m[2];
  }
  return forms;
};

let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL: ${msg}`); };

if (locales.length !== 13) {
  fail(`expected 13 locale files, found ${locales.length}: ${locales.map((l) => l.code).join(', ')}`);
}

for (const { code, table, text } of locales) {
  const missing = enKeys.filter((k) => !(k in table));
  const extra = Object.keys(table).filter((k) => !(k in en.table));
  if (missing.length) fail(`${code}: missing ${missing.length} key(s): ${missing.join(', ')}`);
  if (extra.length)   fail(`${code}: extra ${extra.length} key(s): ${extra.join(', ')}`);
  const dupes = duplicateKeys(text);
  if (dupes.length) fail(`${code}: duplicate key(s) defined more than once: ${dupes.join(', ')}`);

  for (const [k, v] of Object.entries(table)) {
    if (typeof v !== 'string' || v.trim() === '') fail(`${code}: empty value for '${k}'`);
  }
  for (const k of Object.keys(table).filter(isPlural)) {
    const forms = pluralForms(table[k]);
    const need = new Set(['other']);
    for (let n = 0; n <= 200; n++) need.add(new Intl.PluralRules(code).select(n));
    const lacking = [...need].filter((c) => !(c in forms));
    if (lacking.length) fail(`${code}: '${k}' has no ${lacking.join('/')} form`);
    const want = en.table[k] ? placeholders(pluralForms(en.table[k]).other || '') : null;
    for (const [c, text] of Object.entries(forms)) {
      if (want !== null && placeholders(text) !== want) {
        fail(`${code}: '${k}' ${c} form placeholders [${placeholders(text)}] != en [${want}]`);
      }
    }
  }
  if (code !== SOT) {
    for (const k of enKeys) {
      if (isPlural(k)) continue;
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
