'use strict';
/**
 * Batch 2 part 2A - attribute commands on a selection or the whole picture:
 * Invert attributes, Erase attributes, Flip attributes horizontally and
 * vertically (TransformService.invertAttributes / eraseAttributes /
 * flipAttributesHorizontal / flipAttributesVertical).
 *
 * Dots never change. Each command is one undo step. Cells are rounded outwards
 * to whole cells. Modes without cell attributes do nothing.
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
  engagedStamp() {
    const l = global.LayerManager && LayerManager.getCurrentLayer();
    return l && l.isStamp ? { layer: l, floating: false, ownColours: false } : null;
  }
};

ColorManager.initialize();
LayerManager.initialize();

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

function fresh() {
  __setActiveScreenMode('standard_ula');
  LayerManager.initialize();
  selectionArea = null;
  // A distinct attribute on every other cell, plus one ink dot in cell (2,3).
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      setCell(cx, cy, { ink: (cx + cy) % 8, paper: 7 - ((cx + cy) % 8), bright: false, flash: false });
    }
  }
  setCell(2, 3, { ink: 2, paper: 6, bright: true, flash: false });
  PixelDrawRoutine.draw(2 * CW + 1, 3 * CH + 1, { ink: 2, paper: 6, bright: true, flash: false },
    DRAW_MODE.NORMAL, { mirror: false });
}

// -- Invert attributes -----------------------------------------------------
fresh();
let before = dotSignature();
TransformService.invertAttributes();
let c = shown(2, 3);
check('invert whole picture: cell (2,3) ink becomes its old paper', c.ink === 6, `ink ${c.ink}`);
check('invert whole picture: cell (2,3) paper becomes its old ink', c.paper === 2, `paper ${c.paper}`);
check('invert: bright is kept', c.bright === true);
check('invert: flash is kept', c.flash === false);
check('invert: every cell is changed', shown(0, 0).ink === 7 && shown(0, 0).paper === 0);
check('invert: dots unchanged', dotSignature() === before);

fresh();
selectionArea = { x: 2 * CW + 2, y: 3 * CH + 2, width: 2, height: 2 };
const outside = shown(0, 0);
TransformService.invertAttributes();
check('invert selection: the cell inside changes', shown(2, 3).ink === 6);
check('invert selection: a cell outside is unchanged',
  shown(0, 0).ink === outside.ink && shown(0, 0).paper === outside.paper);

fresh();
selectionArea = { x: 2 * CW + 7, y: 3 * CH + 7, width: 2, height: 2 }; // straddles 4 cells
TransformService.invertAttributes();
// Pixels x 23-24 and y 31-32 touch cells (2,3), (3,3), (2,4) and (3,4).
// Cell (3,4) was ink 7 / paper 0 (its index is (3+4)%8), so it must now be ink 0 / paper 7.
check('invert: a selection crossing cell edges rounds out to whole cells',
  shown(3, 4).ink === 0 && shown(3, 4).paper === 7, `ink ${shown(3, 4).ink}`);
check('invert: the cell just past the rounded area is unchanged',
  shown(4, 4).ink === 0 && shown(4, 4).paper === 7, `ink ${shown(4, 4).ink}`);

const b1 = countBatches(() => TransformService.invertAttributes());
check('invert is one undo step (one begin, one end)', b1.opens === 1 && b1.closes === 1,
  `opens ${b1.opens} closes ${b1.closes}`);

// -- Erase attributes ------------------------------------------------------
fresh();
before = dotSignature();
const rail = ColorManager.getCurrentSelection();
TransformService.eraseAttributes();
c = shown(2, 3);
check('erase whole picture: cell ink is the rail ink', c.ink === rail.ink, `ink ${c.ink} rail ${rail.ink}`);
check('erase whole picture: cell paper is the rail paper', c.paper === rail.paper, `paper ${c.paper}`);
check('erase whole picture: dots unchanged', dotSignature() === before);

fresh();
selectionArea = { x: 0, y: 0, width: CW, height: CH };
TransformService.eraseAttributes();
check('erase selection: the cell inside is erased', shown(0, 0).ink === rail.ink);
check('erase selection: a cell outside keeps its colours', shown(1, 0).ink === ((1 + 0) % 8));

// -- Flip attributes -------------------------------------------------------
fresh();
setCell(0, 0, { ink: 1, paper: 0, bright: false, flash: false });
setCell(COLS - 1, 0, { ink: 5, paper: 2, bright: true, flash: true });
before = dotSignature();
TransformService.flipAttributesHorizontal();
check('flip attributes H: left cell takes the right cell colours', shown(0, 0).ink === 5 && shown(0, 0).bright === true);
check('flip attributes H: right cell takes the left cell colours', shown(COLS - 1, 0).ink === 1);
check('flip attributes H: dots unchanged', dotSignature() === before);

fresh();
setCell(0, 0, { ink: 1, paper: 0, bright: false, flash: false });
setCell(0, ROWS - 1, { ink: 6, paper: 3, bright: false, flash: true });
before = dotSignature();
TransformService.flipAttributesVertical();
check('flip attributes V: top cell takes the bottom cell colours', shown(0, 0).ink === 6 && shown(0, 0).flash === true);
check('flip attributes V: bottom cell takes the top cell colours', shown(0, ROWS - 1).ink === 1);
check('flip attributes V: dots unchanged', dotSignature() === before);

fresh();
selectionArea = { x: 0, y: 0, width: 2 * CW, height: CH };
setCell(0, 0, { ink: 1, paper: 0, bright: false, flash: false });
setCell(1, 0, { ink: 4, paper: 0, bright: false, flash: false });
TransformService.flipAttributesHorizontal();
check('flip attributes H on a selection: the two selected cells swap', shown(0, 0).ink === 4 && shown(1, 0).ink === 1);
check('flip attributes H on a selection: cells outside keep their colours', shown(COLS - 1, 0).ink === (COLS - 1) % 8);

fresh(); // whole picture: the vertical flip really changes cells
const b2 = countBatches(() => TransformService.flipAttributesVertical());
check('flip attributes is one undo step', b2.opens === 1 && b2.closes === 1);
TransformService.eraseAttributes(); // every cell now the same colours
const noop = countBatches(() => TransformService.flipAttributesVertical());
check('flip of a symmetric picture adds no undo step when it changes nothing',
  noop.opens === 0 && noop.closes === 0, `opens ${noop.opens}`);

// -- Modes without cell attributes do nothing ------------------------------
fresh();
__setActiveScreenMode('timex_hires');
before = dotSignature();
const timexCell = shown(0, 0);
TransformService.invertAttributes();
TransformService.eraseAttributes();
TransformService.flipAttributesHorizontal();
TransformService.flipAttributesVertical();
check('timex hi-res: attribute commands leave the cell colours alone',
  shown(0, 0).ink === timexCell.ink && shown(0, 0).paper === timexCell.paper);
check('timex hi-res: dots unchanged', dotSignature() === before);

// -- ULAplus: ink and paper swap, the CLUT bits (bright/flash) stay --------
fresh();
__setActiveScreenMode('ula_plus');
setCell(2, 3, { ink: 3, paper: 1, bright: true, flash: true });
TransformService.invertAttributes();
c = shown(2, 3);
check('ULAplus invert: ink and paper swap', c.ink === 1 && c.paper === 3, `ink ${c.ink} paper ${c.paper}`);
check('ULAplus invert: bright and flash bits untouched', c.bright === true && c.flash === true);

// -- Multicolor 8x1: cells are one pixel row high --------------------------
__setActiveScreenMode("multicolor_8x1");
LayerManager.initialize();
selectionArea = null;
setCell(2, 40, { ink: 1, paper: 4, bright: false, flash: false });
const untouched = shown(2, 41);
const r8 = ZX_COORDS.cellToPixel(2, 40);
selectionArea = { x: r8.x, y: r8.y, width: ZX_SPECTRUM.CELL_WIDTH, height: ZX_SPECTRUM.CELL_HEIGHT };
TransformService.invertAttributes();
check("multicolor 8x1: the cell in row 40 is inverted", shown(2, 40).ink === 4 && shown(2, 40).paper === 1);
check("multicolor 8x1: the next cell row is untouched",
  shown(2, 41).ink === untouched.ink && shown(2, 41).paper === untouched.paper);

// -- Stamp and locked layers block the commands ----------------------------
fresh();
const stampLayer = LayerManager.getCurrentLayer();
const realStamp = stampLayer.isStamp;
stampLayer.isStamp = true;
check('stamp layer: attributeCommandsBlocked says stamp', TransformService.attributeCommandsBlocked() === 'stamp');
check('stamp layer: invert does nothing', TransformService.invertAttributes() === 0);
stampLayer.isStamp = realStamp;
stampLayer.locked = true;
check('locked layer: attributeCommandsBlocked says locked', TransformService.attributeCommandsBlocked() === 'locked');
check('locked layer: flip does nothing', TransformService.flipAttributesHorizontal() === 0);
stampLayer.locked = false;
check('unlocked layer: commands are available again', TransformService.attributeCommandsBlocked() === null);

// -- Erase with Bright on "use existing" keeps each cell's bright ----------
fresh();
setCell(2, 3, { ink: 2, paper: 6, bright: true, flash: false });
setCell(4, 3, { ink: 2, paper: 6, bright: false, flash: false });
ColorManager.setBrightTransparent(true);
selectionArea = { x: 2 * CW, y: 3 * CH, width: 3 * CW, height: CH };
const railNow = ColorManager.getCurrentSelection();
TransformService.eraseAttributes();
check('erase with Bright "use existing": a bright cell keeps its bright', shown(2, 3).bright === true);
check('erase with Bright "use existing": a plain cell keeps its plain bright', shown(4, 3).bright === false);
check('erase with Bright "use existing": ink still takes the rail ink', shown(4, 3).ink === railNow.ink);
ColorManager.setBrightTransparent(false);

// -- GigaScreen: each screen inverts its own pair --------------------------
__setActiveScreenMode('gigascreen');
LayerManager.initialize();
selectionArea = null;
setCell(5, 5, { ink: 1, paper: 6, bright: false, flash: false,
  inkB: 2, paperB: 5, brightB: false, flashB: false });
TransformService.invertAttributes();
check('gigascreen: screen A ink and paper swap', shown(5, 5).ink === 6 && shown(5, 5).paper === 1,
  `ink ${shown(5, 5).ink} paper ${shown(5, 5).paper}`);
check('gigascreen: screen B ink and paper swap',
  LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 5, 5, 1).ink === 5 &&
  LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 5, 5, 1).paper === 2);

// -- Undo fixture: a mode switch back leaves the picture for later tests ---
fresh();
__setActiveScreenMode('standard_ula');

summary();
