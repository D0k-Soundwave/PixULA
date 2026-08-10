'use strict';
/**
 * SCR byte-identity — the Phase 2 exit criterion of docs/REFACTOR_PLAN.md §4:
 * for the same document, the rebuilt app's SCR export must be BYTE-IDENTICAL
 * to the old app's (H:\smsh, the behavioural reference).
 *
 * Each app's real modules (constants -> helpers -> validators -> event-bus ->
 * state-manager -> attribute-system -> layer-manager -> scr-format) are loaded
 * into an isolated vm sandbox, an identical multi-layer document is seeded
 * into both, and the two 6912-byte exports are diffed.
 *
 * If the old repo is not present at OLD_ROOT the test is skipped (CI-safe),
 * but locally it must run — it is the porting protocol's safety net.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { check, summary } = require('./helpers/zx-stubs');

const NEW_ROOT = path.resolve(__dirname, '..');
const OLD_ROOT = 'H:\\smsh';

const MODULES = [
  'js/core/constants.js',
  'js/utils/helpers.js',
  'js/utils/validators.js',
  'js/core/event-bus.js',
  'js/core/state-manager.js',
  'js/core/attribute-system.js',
  'js/core/layer-manager.js',
  'js/io/scr-format.js'
];

/** Load one app's modules into an isolated sandbox and return it. */
function makeApp(root) {
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout, clearTimeout,
    // Inert timers: the FLASH clock must not run (irrelevant to export,
    // and a live interval would keep the test process alive)
    setInterval: () => 0, clearInterval() {},
    Logger: { info() {}, debug() {}, warn() {}, error() {} },
    // DOM-adjacent seams stubbed exactly like tests/core-draw.test.js
    CanvasSystem: {
      setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
      getColorIndex(base, bright) { return base + (bright ? 8 : 0); }
    },
    Storage: {
      get: async () => undefined, set: async () => {}, getAll: async () => [],
      STORES: { PREFERENCES: 'preferences' }
    },
    UndoRedoService: { beginAction() {}, endAction() {} },
    FormatRegistry: {
      registerImport() {}, registerExport() {}, download() {},
      getExtension(f) { const p = String(f).split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; }
    }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  for (const rel of MODULES) {
    const file = path.join(root, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }
  return sandbox;
}

/**
 * Seed a deterministic document: background + one drawing layer, every cell
 * given a distinct ink/paper/bright/flash and pixel pattern. Exercises the
 * whole attribute space and the interleaved bitmap layout.
 */
function seedDocument(app) {
  app.LayerManager.initialize();
  const layer = app.LayerManager.getCurrentLayer();
  for (let cy = 0; cy < 24; cy++) {
    for (let cx = 0; cx < 32; cx++) {
      const pixels = new Uint8Array(8);
      for (let row = 0; row < 8; row++) {
        pixels[row] = (cx * 8 + cy * 3 + row * 17) & 0xFF;
      }
      layer.setCell(cx, cy, {
        ink: (cx + cy) % 8,
        paper: (cx * 3 + cy * 5) % 8,
        bright: ((cx + cy) & 1) === 0,
        flash: (cx % 7) === 3,
        pixels,
        altered: true
      });
    }
  }
  return app.SCRFormat.export();
}

if (!fs.existsSync(path.join(OLD_ROOT, 'js', 'io', 'scr-format.js'))) {
  console.log(`  skip: old app not found at ${OLD_ROOT} — byte-identity not verified`);
  console.log('\nALL CHECKS PASSED');
  process.exit(0);
}

const oldScr = seedDocument(makeApp(OLD_ROOT));
const newScr = seedDocument(makeApp(NEW_ROOT));

check('old export is one full screen', oldScr.length === 6912, `got ${oldScr.length}`);
check('new export is one full screen', newScr.length === 6912, `got ${newScr.length}`);

let firstDiff = -1;
for (let i = 0; i < Math.min(oldScr.length, newScr.length); i++) {
  if (oldScr[i] !== newScr[i]) { firstDiff = i; break; }
}
check('SCR export byte-identical to old app',
  firstDiff === -1 && oldScr.length === newScr.length,
  firstDiff >= 0 ? `first diff at byte ${firstDiff}: old=0x${oldScr[firstDiff].toString(16)} new=0x${newScr[firstDiff].toString(16)}` : '');

// Sanity: the seed actually produced non-trivial content (not all zeros / all same)
const distinct = new Set(newScr).size;
check('seeded document is non-trivial', distinct > 16, `only ${distinct} distinct byte values`);

summary();
