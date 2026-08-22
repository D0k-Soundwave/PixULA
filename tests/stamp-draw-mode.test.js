'use strict';
/**
 * The top-bar draw-mode selector (Normal / Ink Recolour / Paper Recolour /
 * Pixels Only / XOR) must govern committing a stamp or text placement
 * exactly as it governs a brush stroke — SelectionService.stampAt/eraseAt/
 * commitStamp used to hardcode DRAW_MODE.NORMAL/ERASE regardless of
 * StateManager.getDrawMode(), so every mode except Normal had no effect on
 * a placed stamp or text. Fixed by routing both the drag-paint path
 * (stampAt/eraseAt) and the final bake (commitStamp) through
 * PixelDrawRoutine.resolveUserMode(), same as BrushEngine.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, composeToCanvas() {},
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 3, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.UndoRedo = { beginAction() {}, endAction() {}, cancelAction() {}, snapshot() {} };
global.TransformService = {};
global.ClipboardCodec = {};
global.Storage = { save() {}, load() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/selection-service.js');

LayerManager.initialize();
const target = LayerManager.getCurrentLayer(); // index 1, the initial drawing layer

// Paint a half-ink/half-paper 8x8 cell at (40,40)-(47,47) directly, with a
// distinct attribute pair, so a later commit can prove whether it recoloured
// only vs. also overwrote the shape.
const CELL_X = 5, CELL_Y = 5; // pixel (40,40)
function paintHalfCell(ink, paper) {
  const sel = { ink, paper, bright: false, flash: false, inkTransparent: false, paperTransparent: false };
  PixelDrawRoutine.beginBatch();
  for (let y = 40; y < 44; y++) for (let x = 40; x < 48; x++) {
    PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL, { layer: target });
  }
  for (let y = 44; y < 48; y++) for (let x = 40; x < 48; x++) {
    PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.ERASE, { layer: target }); // clears bit, keeps attrs
  }
  PixelDrawRoutine.endBatch();
}

function cellBits() {
  const cell = target.getCell(CELL_X, CELL_Y);
  return Array.from(cell.pixels);
}
function cellAttrs() {
  const cell = target.getCell(CELL_X, CELL_Y);
  return { ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash };
}

function makeSolidStamp() {
  const W = 8, H = 8;
  const pixels = [];
  for (let r = 0; r < H; r++) pixels.push(new Array(W).fill(true));
  SelectionService.startFloatingPasteFromMask(pixels, W, H, 40, 40, 'Text', {}, 'none');
  return SelectionService.floatingPaste.floatingLayer;
}

// ── Ink Recolour: recolours the cell, places NO pixel shape ────────────────
paintHalfCell(2, 6);
const beforeInkBits = cellBits();
StateManager.setDrawMode('ink');
global.ColorManager._sel = { ink: 5, paper: 1, bright: true, flash: true, inkTransparent: false, paperTransparent: false };
let stamp = makeSolidStamp();
SelectionService.commitStamp(stamp);
check('ink mode: pixel bits unchanged (no shape placed)',
  JSON.stringify(cellBits()) === JSON.stringify(beforeInkBits));
check('ink mode: ink recoloured to selection', cellAttrs().ink === 5);
check('ink mode: paper left as it was (6)', cellAttrs().paper === 6);
check('ink mode: bright/flash taken from selection', cellAttrs().bright === true && cellAttrs().flash === true);

// ── Paper Recolour: mirror of Ink Recolour ─────────────────────────────────
target.clearCell(CELL_X, CELL_Y);
paintHalfCell(2, 6);
const beforePaperBits = cellBits();
StateManager.setDrawMode('paper');
global.ColorManager._sel = { ink: 1, paper: 4, bright: false, flash: true, inkTransparent: false, paperTransparent: false };
stamp = makeSolidStamp();
SelectionService.commitStamp(stamp);
check('paper mode: pixel bits unchanged (no shape placed)',
  JSON.stringify(cellBits()) === JSON.stringify(beforePaperBits));
check('paper mode: paper recoloured to selection', cellAttrs().paper === 4);
check('paper mode: ink left as it was (2)', cellAttrs().ink === 2);

// ── Pixels Only: places the shape, never touches attributes ────────────────
target.clearCell(CELL_X, CELL_Y);
paintHalfCell(2, 6);
StateManager.setDrawMode('pixel_only');
global.ColorManager._sel = { ink: 5, paper: 1, bright: true, flash: true, inkTransparent: false, paperTransparent: false };
stamp = makeSolidStamp();
SelectionService.commitStamp(stamp);
check('pixel_only mode: the stamp shape IS placed (bits now fully set)',
  cellBits().every(row => row === 0xFF));
check('pixel_only mode: attributes untouched (still 2/6, not the selection 5/1)',
  cellAttrs().ink === 2 && cellAttrs().paper === 6);

// ── XOR: toggles bits, applies selection colour ─────────────────────────────
target.clearCell(CELL_X, CELL_Y);
paintHalfCell(2, 6); // top 4 rows ink=1, bottom 4 rows ink=0
StateManager.setDrawMode('xor');
global.ColorManager._sel = { ink: 6, paper: 0, bright: false, flash: false, inkTransparent: false, paperTransparent: false };
stamp = makeSolidStamp(); // solid mask XORed against the half-filled cell
SelectionService.commitStamp(stamp);
const xorBits = cellBits();
check('xor mode: top half (was ink) toggled OFF', xorBits.slice(0, 4).every(b => b === 0x00));
check('xor mode: bottom half (was paper) toggled ON', xorBits.slice(4, 8).every(b => b === 0xFF));
check('xor mode: attributes overwritten by selection', cellAttrs().ink === 6 && cellAttrs().paper === 0);

// ── Normal (default) is unaffected — the pre-existing, still-tested path ───
target.clearCell(CELL_X, CELL_Y);
StateManager.setDrawMode('normal');
global.ColorManager._sel = { ink: 3, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false };
stamp = makeSolidStamp();
SelectionService.commitStamp(stamp);
check('normal mode: shape placed', cellBits().every(row => row === 0xFF));
check('normal mode: ink from selection', cellAttrs().ink === 3);

summary();
