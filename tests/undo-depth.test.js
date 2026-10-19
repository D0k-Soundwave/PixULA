'use strict';
/**
 * The undo depth setting (owner decision 2026-10-19): 1 to 2000 steps, 500 to
 * start with, kept across reloads under 'pref.undoLimit'. Lowering it drops the
 * oldest steps at once, and the 256 MB memory cap still applies on top of it.
 * The Preferences field itself is pinned in tests/browser/undo-depth.spec.js.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  packRGB(rgb) { return (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; },
  blitCellBits() {}, blitCellIndices() {}
};
global.setInterval = () => 0;

// In-memory Storage: what setMaxStates writes is what the next boot reads.
const stored = new Map();
let failWrites = false;
global.Storage = {
  get(key) { return Promise.resolve(stored.has(key) ? stored.get(key) : null); },
  set(key, value) {
    if (failWrites) return Promise.reject(new Error('quota'));
    stored.set(key, value);
    return Promise.resolve();
  },
  delete(key) { stored.delete(key); return Promise.resolve(); }
};

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');

ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();

const K = UndoRedo.constructor;
let strokeX = 0;
function stroke() {
  UndoRedo.beginAction('stroke');
  PixelDrawRoutine.draw(strokeX % 256, Math.floor(strokeX / 256) % 192, ColorManager.getCurrentSelection(),
                        DRAW_MODE.NORMAL, { layer: LayerManager.getCurrentLayer() });
  strokeX++;
  UndoRedo.endAction();
  return UndoRedo.peekLast();
}

(async () => {
  // ── The range ───────────────────────────────────────────────────────────
  check('range: lowest is 1', ZX_SPECTRUM.MIN_UNDO_LIMIT === 1, ZX_SPECTRUM.MIN_UNDO_LIMIT);
  check('range: highest is 2000', ZX_SPECTRUM.MAX_UNDO_LIMIT === 2000, ZX_SPECTRUM.MAX_UNDO_LIMIT);
  check('range: default stays 500', ZX_SPECTRUM.DEFAULT_UNDO_LIMIT === 500, ZX_SPECTRUM.DEFAULT_UNDO_LIMIT);
  check('a fresh history starts at the default', UndoRedo.maxStates === 500, UndoRedo.maxStates);
  check('getMaxStates reports the depth', typeof UndoRedo.getMaxStates === 'function' && UndoRedo.getMaxStates() === 500);

  for (const n of [1, 2, 499, 500, 501, 1000, 1999, 2000]) {
    check(`isValidUndoLimit(${n}) accepted`, Validators.isValidUndoLimit(n) === true);
  }
  for (const n of [0, -1, 2001, 5000, 1.5, '600', NaN, null, undefined]) {
    check(`isValidUndoLimit(${String(n)}) refused`, Validators.isValidUndoLimit(n) === false);
  }

  // ── Setting it ──────────────────────────────────────────────────────────
  const ok = await UndoRedo.setMaxStates(1500);
  check('setMaxStates(1500) is accepted', UndoRedo.maxStates === 1500, UndoRedo.maxStates);
  check('setMaxStates resolves true once stored', ok === true, ok);
  check('1500 is stored under pref.undoLimit', stored.get('pref.undoLimit') === 1500, stored.get('pref.undoLimit'));

  const refused = await UndoRedo.setMaxStates(2001);
  check('setMaxStates(2001) is refused', UndoRedo.maxStates === 1500, UndoRedo.maxStates);
  check('a refused depth resolves false', refused === false, refused);
  check('a refused depth is not stored', stored.get('pref.undoLimit') === 1500);

  await UndoRedo.setMaxStates(2000);
  check('2000, the top of the range, is accepted', UndoRedo.maxStates === 2000);

  failWrites = true;
  const unstored = await UndoRedo.setMaxStates(700);
  failWrites = false;
  check('a failed write still applies the depth for this session', UndoRedo.maxStates === 700);
  check('a failed write resolves false, so the dialog can say so', unstored === false, unstored);

  // ── Lowering drops the oldest steps at once ─────────────────────────────
  UndoRedo.clear();
  await UndoRedo.setMaxStates(2000);
  const entries = [];
  for (let i = 0; i < 20; i++) entries.push(stroke());
  check('20 steps are kept at depth 2000', UndoRedo.getUndoCount() === 20, UndoRedo.getUndoCount());
  await UndoRedo.setMaxStates(5);
  check('lowering to 5 keeps 5 at once', UndoRedo.getUndoCount() === 5, UndoRedo.getUndoCount());
  check('the five kept are the newest five',
    entries.slice(15).every((e, i) => UndoRedo.undoStack[i] === e));
  stroke();
  check('the next step still keeps the depth', UndoRedo.getUndoCount() === 5);

  // A depth of 1 keeps exactly one step back.
  await UndoRedo.setMaxStates(1);
  check('depth 1 keeps one step', UndoRedo.getUndoCount() === 1);

  // Redo after lowering: every undone step can still be redone, but Undo may
  // not then go back further than the depth now set.
  UndoRedo.clear();
  await UndoRedo.setMaxStates(2000);
  for (let i = 0; i < 10; i++) stroke();
  for (let i = 0; i < 10; i++) UndoRedo.undo();
  await UndoRedo.setMaxStates(3);
  check('lowering leaves the redo steps alone', UndoRedo.getRedoCount() === 10, UndoRedo.getRedoCount());
  for (let i = 0; i < 10; i++) UndoRedo.redo();
  check('all ten undone steps are redone', UndoRedo.getRedoCount() === 0, UndoRedo.getRedoCount());
  check('after redoing, Undo keeps no more than the depth set',
    UndoRedo.getUndoCount() === 3, UndoRedo.getUndoCount());
  check('the undo count shown agrees', StateManager.get('history.undoCount') === 3,
    StateManager.get('history.undoCount'));

  // ── The memory cap still applies on top of the depth ────────────────────
  UndoRedo.clear();
  await UndoRedo.setMaxStates(2000);
  const one = K.entryBytes(stroke());
  const realBudget = K.MAX_HISTORY_BYTES;
  K.MAX_HISTORY_BYTES = one * 15;
  for (let i = 0; i < 40; i++) stroke();
  const kept = UndoRedo.getUndoCount();
  K.MAX_HISTORY_BYTES = realBudget;
  check('the memory cap keeps fewer steps than a depth of 2000', kept <= 15 && kept < 41, kept);
  check('the memory cap never prunes below the floor',
    kept >= K.MIN_HISTORY_ENTRIES, kept);
  check('the cap is still 256 MB', K.MAX_HISTORY_BYTES === 256 * 1024 * 1024);

  // ── The stored depth comes back at boot ─────────────────────────────────
  UndoRedo.clear();
  UndoRedo.maxStates = ZX_SPECTRUM.DEFAULT_UNDO_LIMIT;
  stored.set('pref.undoLimit', 1500);
  await UndoRedo.initialize();
  check('a stored 1500 comes back at boot', UndoRedo.maxStates === 1500, UndoRedo.maxStates);

  for (let i = 0; i < 8; i++) stroke();
  stored.set('pref.undoLimit', 3);
  await UndoRedo.initialize();
  check('a stored lower depth prunes what is already there', UndoRedo.getUndoCount() === 3, UndoRedo.getUndoCount());

  UndoRedo.maxStates = 500;
  stored.set('pref.undoLimit', 9999);
  await UndoRedo.initialize();
  check('a stored value outside the range is ignored', UndoRedo.maxStates === 500, UndoRedo.maxStates);

  // ── The text ────────────────────────────────────────────────────────────
  loadModule('js/i18n/en.js');
  const en = window.i18n_en || {};
  const label = en['pref.undoLimit'];
  const hint = en['pref.undoLimitHint'];
  check('en has the field label', typeof label === 'string' && label.length > 0, label);
  check('en hint names the range and the cap by placeholder',
    typeof hint === 'string' && ['{min}', '{max}', '{mb}'].every(p => hint.includes(p)), hint);
  check('en hint says the cap can keep fewer steps than set',
    typeof hint === 'string' && /fewer steps than/.test(hint), hint);

  summary();
})();
