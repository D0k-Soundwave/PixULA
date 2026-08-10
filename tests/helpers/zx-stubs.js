'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
let failures = 0;

function installStubs(overrides = {}) {
  global.window = global;
  // Geometry, palette, events, coords and helpers come from the REAL modules —
  // the single sources of truth the app itself uses (docs/REFACTOR_PLAN.md §2) —
  // so tests can never drift from the shipped constants.
  loadModule('js/core/constants.js');
  loadModule('js/utils/helpers.js');
  global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
  global.EventBus = { emit() {}, on() {} };
  global.FormatRegistry = {
    registerImport() {}, registerExport() {}, download() {},
    getExtension(f) { const p = String(f).split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; }
  };
  Object.assign(global, overrides);
}

function loadModule(repoRelPath) {
  const src = fs.readFileSync(path.join(REPO_ROOT, repoRelPath), 'utf8');
  // Indirect eval so the module's IIFE runs in global scope like a <script> tag
  (0, eval)(src);
}

function check(label, cond, detail) {
  if (cond) { console.log(`  ok: ${label}`); }
  else { failures++; console.log(`FAIL: ${label}${detail ? ' — ' + detail : ''}`); }
}

function summary() {
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures ? 1 : 0);
}

module.exports = { installStubs, loadModule, check, summary, REPO_ROOT };
