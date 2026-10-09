'use strict';
/**
 * Batch 2 part 2C - Change Attributes, the find and replace behind
 * Image > Attributes > Change... (TransformService.previewChangeAttributes /
 * changeAttributes).
 *
 * find = { ink, paper, bright, flash }, each a value or null for any.
 * replace = the same shape, each a value or null for keep. A cell matches when
 * its shown colours agree with every non-null find field; a matching cell gets
 * the non-null replace fields and keeps the rest. Dots never change. The work
 * area is rounded out to whole cells. One undo step.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/services/transform-service.js');

// The selection is a stub so each test chooses its own work area.
let selectionArea = null;
global.SelectionService = {
  hasSelection() { return selectionArea !== null; },
  getSelection() { return selectionArea; },
  isFloating() { return false; },
  clear() { selectionArea = null; }
};

ColorManager.initialize();
LayerManager.initialize();
UndoRedo.initialize();

const CW = ZX_SPECTRUM.CELL_WIDTH, CH = ZX_SPECTRUM.CELL_HEIGHT;
const COLS = ZX_SPECTRUM.GRID_COLS, ROWS = ZX_SPECTRUM.GRID_ROWS;

/** Write a cell's attributes directly, the way a stroke would. */
function setCell(cx, cy, attrs) {
  const px = ZX_COORDS.cellToPixel(cx, cy);
  PixelDrawRoutine.draw(px.x, px.y, attrs, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
}

/** What a cell shows on screen A: ink, paper, bright, flash. */
function shown(cx, cy) {
  return LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), cx, cy);
}

/** Every cell's shown colours as one string, to prove nothing else changed. */
function cellSignature() {
  let s = '';
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const a = shown(cx, cy);
      s += `${a.ink},${a.paper},${a.bright ? 1 : 0},${a.flash ? 1 : 0};`;
    }
  }
  return s;
}

/** Pixel state of every dot in the picture, as one string, to prove dots did not move. */
function dotSignature() {
  let s = '';
  for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
    for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
      const st = PixelDrawRoutine.getPixelState(x, y);
      s += st && st.isInk ? '1' : '0';
    }
  }
  return s;
}

/** Count PixelDrawRoutine batch opens and closes around a call. */
function countBatches(fn) {
  let opens = 0, closes = 0;
  const b = PixelDrawRoutine.beginBatch, e = PixelDrawRoutine.endBatch;
  PixelDrawRoutine.beginBatch = (...a) => { opens++; return b.apply(PixelDrawRoutine, a); };
  PixelDrawRoutine.endBatch = (...a) => { closes++; return e.apply(PixelDrawRoutine, a); };
  try { fn(); } finally {
    PixelDrawRoutine.beginBatch = b;
    PixelDrawRoutine.endBatch = e;
  }
  return { opens, closes };
}

const ANY = { ink: null, paper: null, bright: null, flash: null };
const KEEP = { ink: null, paper: null, bright: null, flash: null };

/** A distinct attribute set on every cell, plus one ink dot in cell (2,3). */
function fresh(mode = 'standard_ula') {
  __setActiveScreenMode(mode);
  LayerManager.initialize();
  selectionArea = null;
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      setCell(cx, cy, {
        ink: (cx + cy) % 8, paper: 7 - ((cx + cy) % 8),
        bright: cx % 2 === 0, flash: false
      });
    }
  }
  PixelDrawRoutine.draw(2 * CW + 1, 3 * CH + 1, { ink: 2, paper: 6, bright: true, flash: false },
    DRAW_MODE.PIXEL_ONLY, { mirror: false });
}

// -- any and keep combinations ---------------------------------------------
fresh();
let before = dotSignature();
let n = TransformService.changeAttributes({ ...ANY, ink: 2 }, { ...KEEP, paper: 0 });
let expected = 0;
for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) if ((cx + cy) % 8 === 2) expected++;
check('find ink 2, replace paper 0: count is the number of ink-2 cells', n === expected, `n ${n} expected ${expected}`);
check('find ink 2, replace paper 0: an ink-2 cell gets paper 0', shown(2, 0).paper === 0 && shown(2, 0).ink === 2,
  `ink ${shown(2, 0).ink} paper ${shown(2, 0).paper}`);
check('find ink 2, replace paper 0: bright is kept', shown(2, 0).bright === true);
check('find ink 2, replace paper 0: a cell with another ink is unchanged',
  shown(1, 0).ink === 1 && shown(1, 0).paper === 6);
check('find ink 2, replace paper 0: dots unchanged', dotSignature() === before);

fresh();
const brightCount = (() => { let c = 0; for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) if (cx % 2 === 0) c++; return c; })();
n = TransformService.changeAttributes(ANY, { ...KEEP, bright: true });
check('find any, replace bright on: only cells that were not bright change',
  n === COLS * ROWS - brightCount, `n ${n}`);
check('find any, replace bright on: every cell is now bright', shown(1, 0).bright === true && shown(0, 0).bright === true);
check('find any, replace bright on: ink and paper kept', shown(1, 0).ink === 1 && shown(1, 0).paper === 6);

fresh();
n = TransformService.changeAttributes({ ...ANY, bright: true }, { ...KEEP, bright: false });
check('find bright, replace bright off: count is the bright cells', n === brightCount, `n ${n}`);
check('find bright, replace bright off: a bright cell is now dim', shown(0, 0).bright === false);
check('find bright, replace bright off: ink kept', shown(0, 0).ink === 0 && shown(0, 0).paper === 7);
check('find bright, replace bright off: a dim cell is untouched', shown(1, 0).bright === false && shown(1, 0).ink === 1);

fresh();
const all = cellSignature();
n = TransformService.changeAttributes(ANY, { ...KEEP });
check('replace with everything kept: count 0', n === 0, `n ${n}`);
check('replace with everything kept: nothing changes', cellSignature() === all);

// -- preview writes nothing and agrees with the apply count ----------------
fresh();
const snap = cellSignature();
const preview = TransformService.previewChangeAttributes({ ...ANY, ink: 4 }, { ...KEEP, flash: true });
check('preview writes nothing', cellSignature() === snap);
const applied = TransformService.changeAttributes({ ...ANY, ink: 4 }, { ...KEEP, flash: true });
check('preview count equals the count the apply returns', preview === applied, `preview ${preview} applied ${applied}`);
check('flash replaced on the matching cells', shown(4, 0).flash === true && shown(4, 0).ink === 4);

// -- selection rounds out to whole cells -----------------------------------
fresh();
selectionArea = { x: 2 * CW + 1, y: 3 * CH + 1, width: CW, height: 2 }; // touches cells (2,3) and (3,3)
const outside = shown(4, 3);
const inOne = shown(2, 3);
n = TransformService.changeAttributes(ANY, { ...KEEP, paper: 0 });
check('selection: the two cells the selection touches change', n === 2 && shown(2, 3).paper === 0 && shown(3, 3).paper === 0,
  `n ${n}`);
check('selection: the cell beside it is unchanged', shown(4, 3).paper === outside.paper);
check('selection: the first cell keeps its ink', shown(2, 3).ink === inOne.ink);

// -- one undo step ---------------------------------------------------------
fresh();
const b1 = countBatches(() => TransformService.changeAttributes({ ...ANY, ink: 3 }, { ...KEEP, paper: 1 }));
check('change attributes is one undo step', b1.opens === 1 && b1.closes === 1, `opens ${b1.opens} closes ${b1.closes}`);
const b2 = countBatches(() => TransformService.changeAttributes(ANY, { ...KEEP }));
check('a change that alters nothing opens no batch', b2.opens === 0 && b2.closes === 0, `opens ${b2.opens}`);

// -- ULAplus: bright and flash are the CLUT bits, matched the same way -----
fresh('ula_plus');
setCell(5, 5, { ink: 3, paper: 2, bright: true, flash: true });
n = TransformService.changeAttributes({ ...ANY, flash: true, bright: true }, { ...KEEP, bright: false });
check('ULAplus: the one CLUT 3 cell matches and gets CLUT 2 (bright off, flash on)',
  n === 1 && shown(5, 5).bright === false && shown(5, 5).flash === true && shown(5, 5).ink === 3,
  `n ${n} bright ${shown(5, 5).bright} flash ${shown(5, 5).flash}`);

// -- Modes and layers that block the command -------------------------------
fresh('timex_hires');
let snap2 = cellSignature();
check('timex hi-res: preview is 0', TransformService.previewChangeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
check('timex hi-res: change is 0', TransformService.changeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
check('timex hi-res: cells unchanged', cellSignature() === snap2);

fresh();
const layer = LayerManager.getCurrentLayer();
layer.locked = true;
check('locked layer: preview is 0', TransformService.previewChangeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
check('locked layer: change is 0', TransformService.changeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
layer.locked = false;

// -- One real undo step restores the picture --------------------------------
fresh();
const undoSnap = cellSignature();
UndoRedo.clear();
UndoRedo.beginAction('change attributes');
TransformService.changeAttributes({ ...ANY, ink: 5 }, { ...KEEP, paper: 0 });
UndoRedo.endAction();
check('undo: change attributes is one undo entry', UndoRedo.getUndoCount() === 1, `count ${UndoRedo.getUndoCount()}`);
check('undo: the change is in place before undo', cellSignature() !== undoSnap);
UndoRedo.undo();
check('undo: one undo restores every cell', cellSignature() === undoSnap);

// -- Input clean-up: out-of-range colours write nothing; 1 means true -----
fresh();
const badSnap = cellSignature();
check('ink 8 is refused: count 0', TransformService.changeAttributes({ ...ANY, ink: 8 }, { ...KEEP, paper: 0 }) === 0);
check('ink 8 is refused: nothing written', cellSignature() === badSnap);
const brightN = TransformService.previewChangeAttributes({ ...ANY, bright: true }, { ...KEEP, paper: 0 });
check('bright 1 acts as bright true',
  TransformService.previewChangeAttributes({ ...ANY, bright: 1 }, { ...KEEP, paper: 0 }) === brightN);

// -- Stamp block (same as 2A) -----------------------------------------------
fresh();
const stampLayer2 = LayerManager.getCurrentLayer();
const realStamp2 = stampLayer2.isStamp;
stampLayer2.isStamp = true;
check('stamp: preview is 0', TransformService.previewChangeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
check('stamp: change is 0', TransformService.changeAttributes(ANY, { ...KEEP, paper: 0 }) === 0);
stampLayer2.isStamp = realStamp2;

// -- multicolor 8x1: the plan reaches every cell row ----------------------
fresh('multicolor_8x1');
let expect8 = 0;
for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
  for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) if (shown(cx, cy).ink === 0) expect8++;
}
n = TransformService.changeAttributes({ ...ANY, ink: 0 }, { ...KEEP, paper: 3 });
check('8x1: count covers every cell row', n === expect8, `n ${n} expected ${expect8}`);
check('8x1: row 1 cell with ink 0 is changed', shown(7, 1).ink === 0 && shown(7, 1).paper === 3,
  `paper ${shown(7, 1).paper}`);

// -- ULAplus CLUT bits: bright is bit 0, flash is bit 1 -------------------
fresh('ula_plus');
setCell(5, 5, { ink: 3, paper: 2, bright: true, flash: false });  // CLUT 1
setCell(7, 5, { ink: 3, paper: 2, bright: false, flash: true });  // CLUT 2
let clut1 = 0;
for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) { const a = shown(cx, cy); if (a.bright && !a.flash) clut1++; }
}
n = TransformService.changeAttributes({ ...ANY, bright: true, flash: false }, { ...KEEP, bright: false, flash: true });
check('ULAplus: CLUT 1 cells are the ones found', n === clut1, `n ${n} expected ${clut1}`);
check('ULAplus: the CLUT 2 cell is not found', shown(7, 5).flash === true && shown(7, 5).bright === false);
check('ULAplus: the CLUT 1 cell becomes CLUT 2',
  shown(5, 5).flash === true && shown(5, 5).bright === false && shown(5, 5).ink === 3);

// -- GigaScreen: each screen's fields match and replace on their own ------
__setActiveScreenMode('gigascreen');
LayerManager.initialize();
selectionArea = null;
for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) {
    setCell(cx, cy, { ink: cx % 8, paper: 0, bright: false, flash: false,
      inkB: cy % 8, paperB: 1, brightB: false, flashB: false });
  }
}
const screenB = (cx, cy) => LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), cx, cy, 1);
n = TransformService.changeAttributes({ ...ANY, ink: 2 }, { ...KEEP, paper: 5 });
check('giga: find screen A ink 2 changes its paper', n === 4 * ROWS && shown(2, 0).paper === 5, `n ${n}`);
check('giga: screen B of the same cell is kept', screenB(2, 0).paper === 1 && screenB(2, 0).ink === 0,
  `B paper ${screenB(2, 0).paper}`);
n = TransformService.changeAttributes({ ...ANY, inkB: 4 }, { ...KEEP, paperB: 6 });
check('giga: find screen B ink 4 (rows 4, 12, 20) changes its paper', n === 3 * COLS && screenB(3, 4).paper === 6, `n ${n}`);
check('giga: screen A paper of that cell is kept', shown(3, 4).paper === 0);
// Flash pair: a cell flashing on screen A only is not found by the pair.
setCell(0, 0, { ink: 0, paper: 0, bright: false, flash: true, inkB: 0, paperB: 1, brightB: false, flashB: true });
setCell(1, 0, { ink: 1, paper: 0, bright: false, flash: true, inkB: 1, paperB: 1, brightB: false, flashB: false });
n = TransformService.changeAttributes({ ...ANY, flash: true, flashB: true }, { ...KEEP, flash: false, flashB: false });
check('giga: the flash pair finds the cell flashing on both screens',
  n === 1 && shown(0, 0).flash === false && screenB(0, 0).flash === false);
check('giga: a cell flashing on screen A only is not found by the pair', shown(1, 0).flash === true);

summary();
