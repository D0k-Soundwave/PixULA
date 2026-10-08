'use strict';
// Counts the verdicts in docs/ZX_PAINTBRUSH_COMPARISON.md and prints the
// totals for its Totals paragraph. Usage: node .claude/parity/count-verdicts.js
const fs = require('fs');
const path = require('path');

const doc = path.join(__dirname, '..', '..', 'docs', 'ZX_PAINTBRUSH_COMPARISON.md');
const VERDICTS = ['Same', 'PixULA further', 'Partial', 'Missing', 'N/A'];
const n = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
let part = 0;
const perPart = { 1: { ...n }, 2: { ...n } };

for (const line of fs.readFileSync(doc, 'utf8').split('\n')) {
  if (/^## Part 1\b/.test(line)) part = 1;
  else if (/^## Part 2\b/.test(line)) part = 2;
  else if (/^## /.test(line)) part = 0;
  const m = line.match(/\|\s*([^|]+?)\s*\|\s*$/);
  if (!part || !m || !VERDICTS.includes(m[1])) continue;
  n[m[1]]++;
  perPart[part][m[1]]++;
}

const total = VERDICTS.reduce((s, v) => s + n[v], 0);
const line = (c) => `${VERDICTS.reduce((s, v) => s + c[v], 0)} functions: ${c.Same} same, ` +
  `${c['PixULA further']} where PixULA goes further, ${c.Partial} partial, ${c.Missing} missing, ` +
  `${c['N/A']} not applicable.`;
console.log(`All:    ${line(n)}`);
console.log(`Part 1: ${line(perPart[1])}`);
console.log(`Part 2: ${line(perPart[2])}`);
console.log(`Below parity: ${n.Partial + n.Missing} (${n.Missing} missing, ${n.Partial} partial) of ${total}.`);
