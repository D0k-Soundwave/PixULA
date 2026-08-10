'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'inherit' }); }
  catch { failed++; }
}
console.log(failed ? `\n${failed} TEST FILE(S) FAILED` : '\nALL TEST FILES PASSED');
process.exit(failed ? 1 : 0);
