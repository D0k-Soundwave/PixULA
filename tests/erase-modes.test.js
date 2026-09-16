'use strict';
/**
 * The three erase behaviours, which were one behaviour until 2026-08-08.
 *
 * Left button, right button and the eraser TOOL are different things:
 *
 *   left button   set the pixel to ink, stamp ink/paper/bright/flash
 *   right button  CLEAR the pixel, stamp the same attributes. Removing ink is
 *                 not the same as declining to colour the cell - on the
 *                 Spectrum the right button paints paper, and the cell still
 *                 takes the colours you have selected
 *   eraser tool   clear the pixel and leave the colours alone. A cell's colours
 *                 are wiped only by a LATER stroke that finds the cell already
 *                 empty of ink (2026-09-15; before that the eraser reset paper
 *                 and flash on contact and ink and bright with the last pixel)
 *
 * All three used to route to DRAW_MODE.ERASE, which clears the pixel and
 * touches nothing else - so a right-button stroke over a differently-coloured
 * area left that area's colours untouched, which is the bug.
 *
 * DRAW_MODE.ERASE still exists and still behaves that way, because it is the
 * PRIMITIVE the selection and transform services move pixels with. Pinning
 * that is half of what this suite is for: if it ever starts stamping
 * attributes, dragging a selection will repaint whatever it passes over.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.ColorManager = {
  _sel: { ink: 2, paper: 5, bright: true, flash: false,
          inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.SelectionService = {
  isFloating() { return false; }, hasSelection() { return false; },
  getSelection() { return null; },
  getSelectionState() { return null; }, restoreSelectionState() {}, clear() {}
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/eraser-tool.js');

LayerManager.initialize();
UndoRedo.initialize();
BrushEngine.initialize();

const color = () => ColorManager.getCurrentSelection();
const cellAt = (x, y) => LayerManager.getCurrentLayer()
  .getCell(Math.floor(x / ZX_SPECTRUM.CELL_WIDTH), Math.floor(y / ZX_SPECTRUM.CELL_HEIGHT));
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};

/** Put a cell into a known, DIFFERENT state so a stamp is visible. */
function seed(x, y) {
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
  const cell = cellAt(x, y);
  cell.ink = 1; cell.paper = 6; cell.bright = false; cell.flash = true;
  cell.altered = true;
  return cell;
}

const attrs = (cell) => ({
  ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash
});

// --- left button: the reference behaviour ------------------------------

let cell = seed(10, 10);
PixelDrawRoutine.draw(10, 10, color(), PixelDrawRoutine.resolveUserMode(true));
check('left button sets the pixel', isInk(10, 10));
check('left button stamps all four attributes',
  JSON.stringify(attrs(cell)) ===
  JSON.stringify({ ink: 2, paper: 5, bright: true, flash: false }));

// --- right button: clears ink, stamps the same attributes --------------

check('the right button gets its own mode, not the ERASE primitive',
  PixelDrawRoutine.resolveUserMode(false) === DRAW_MODE.NORMAL_ERASE);

cell = seed(20, 20);
// Ink standing in the cell, so there is something to remove
PixelDrawRoutine.draw(20, 20, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(21, 20, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = false; cell.flash = true;

PixelDrawRoutine.draw(20, 20, color(), PixelDrawRoutine.resolveUserMode(false));
check('right button clears the ink it passes over', !isInk(20, 20));
check('right button leaves other ink in the cell alone', isInk(21, 20));
check('right button stamps all four attributes, exactly as the left does',
  JSON.stringify(attrs(cell)) ===
  JSON.stringify({ ink: 2, paper: 5, bright: true, flash: false }));
check('right button keeps the cell altered', cell.altered === true);

// --- the ERASE primitive: unchanged, and must stay that way ------------

cell = seed(30, 30);
PixelDrawRoutine.draw(30, 30, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = false; cell.flash = true;

PixelDrawRoutine.draw(30, 30, color(), DRAW_MODE.ERASE);
check('the ERASE primitive still clears the pixel', !isInk(30, 30));
check('the ERASE primitive still writes NO attributes (selection/transform rely on it)',
  JSON.stringify(attrs(cell)) ===
  JSON.stringify({ ink: 1, paper: 6, bright: false, flash: true }));

// --- Pixels Only: both buttons leave attributes alone ------------------

StateManager.setDrawMode('pixel_only');
check('Pixels Only keeps the primitive on its right button',
  PixelDrawRoutine.resolveUserMode(false) === DRAW_MODE.ERASE);

cell = seed(40, 40);
PixelDrawRoutine.draw(40, 40, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = false; cell.flash = true;
PixelDrawRoutine.draw(40, 40, color(), PixelDrawRoutine.resolveUserMode(false));
check('Pixels Only right button changes no attributes',
  JSON.stringify(attrs(cell)) ===
  JSON.stringify({ ink: 1, paper: 6, bright: false, flash: true }));
StateManager.setDrawMode('normal');

// --- the eraser TOOL: dots first, colours only on a later pass ---------
//
// A stroke (one batch) that reaches a cell with ink in it clears dots and
// leaves all four colours - even when it takes the last dot. A LATER stroke
// that finds the cell already empty wipes the colours. Each cell is judged by
// what it held when the stroke first reached it, never mid-stroke, because one
// drag crosses the same cell many times.

const SEEDED = JSON.stringify({ ink: 1, paper: 6, bright: true, flash: true });
const stroke = (fn) => { PixelDrawRoutine.beginBatch(); fn(); PixelDrawRoutine.endBatch(); };

cell = seed(50, 50);
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = true; cell.flash = true;

stroke(() => {
  PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL);
  check('eraser clears the pixel it touches', !isInk(50, 50));
  check('eraser leaves other ink in the cell standing', isInk(51, 50));
  check('eraser keeps all four colours while ink remains', JSON.stringify(attrs(cell)) === SEEDED);

  PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.ERASE_ALL);
  check('eraser keeps all four colours when it takes the LAST dot', JSON.stringify(attrs(cell)) === SEEDED);
  check('an upper-layer cell emptied this stroke stays painted', cell.altered === true);

  // The same drag crossing the now-empty cell again is still the first pass
  PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL);
  check('re-crossing the emptied cell in the SAME stroke keeps its colours',
    JSON.stringify(attrs(cell)) === SEEDED);
});

stroke(() => PixelDrawRoutine.draw(52, 52, color(), DRAW_MODE.ERASE_ALL));
check('a second stroke over the empty cell wipes all four colours',
  JSON.stringify(attrs(cell)) === JSON.stringify(DEFAULT_CELL_ATTRS));
check('...and an upper-layer cell goes transparent again', cell.altered === false);

// A second pass that still finds ink only clears dots; its last dot waits too
cell = seed(50, 50);
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = true; cell.flash = true;
stroke(() => PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL));
stroke(() => PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.ERASE_ALL));
check('a second pass that takes the last dot still keeps the colours',
  !isInk(51, 50) && JSON.stringify(attrs(cell)) === SEEDED);
stroke(() => PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.ERASE_ALL));
check('the pass after that wipes them',
  JSON.stringify(attrs(cell)) === JSON.stringify(DEFAULT_CELL_ATTRS));

// One stroke, two cells: each judged on its own
{
  const inked = seed(60, 60);
  PixelDrawRoutine.draw(60, 60, color(), DRAW_MODE.NORMAL);
  inked.ink = 1; inked.paper = 6; inked.bright = true; inked.flash = true;
  const empty = cellAt(68, 60);
  empty.ink = 3; empty.paper = 4; empty.bright = true; empty.flash = true;
  empty.altered = true;

  stroke(() => {
    PixelDrawRoutine.draw(60, 60, color(), DRAW_MODE.ERASE_ALL);
    PixelDrawRoutine.draw(68, 60, color(), DRAW_MODE.ERASE_ALL);
  });
  check('one stroke keeps the colours of the cell it took ink from',
    JSON.stringify(attrs(inked)) === SEEDED);
  check('...and wipes the colours of the cell that was already empty',
    JSON.stringify(attrs(empty)) === JSON.stringify(DEFAULT_CELL_ATTRS));
}

// Outside a stroke, every call is its own pass
cell = seed(50, 50);
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.NORMAL);
cell.ink = 1; cell.paper = 6; cell.bright = true; cell.flash = true;
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL);
check('a lone call that takes the last dot keeps the colours', JSON.stringify(attrs(cell)) === SEEDED);
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL);
check('a second lone call over the empty cell wipes them',
  JSON.stringify(attrs(cell)) === JSON.stringify(DEFAULT_CELL_ATTRS));

// --- the eraser tool itself, through its real code path ----------------

// The module exports the CLASS; the app registers an instance elsewhere.
const eraser = new EraserTool();
{
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
  const c = cellAt(60, 60);
  for (let x = 56; x < 64; x++) PixelDrawRoutine.draw(x, 60, color(), DRAW_MODE.NORMAL);
  c.ink = 1; c.paper = 6; c.bright = false; c.flash = true;
  const kept = JSON.stringify(attrs(c));

  eraser.setSize(32);
  eraser.onPointerDown(60, 60, {});
  eraser.onPointerUp(60, 60, {});
  check('the real eraser tool clears the ink', !isInk(60, 60));
  check('the real eraser tool keeps the colours on its first pass', JSON.stringify(attrs(c)) === kept);

  eraser.onPointerDown(60, 60, {});
  eraser.onPointerUp(60, 60, {});
  check('the real eraser tool wipes them on a second pass',
    JSON.stringify(attrs(c)) === JSON.stringify(DEFAULT_CELL_ATTRS));
}

// --- the background keeps its paint ------------------------------------

// The background is locked and can never be the current layer, so it is
// written through options.layer (as indexed-erase-modes.test.js does). This
// block used to call setCurrentLayer(0), which refuses, so it drew on layer 1
// and checked a background cell that is altered by definition - it passed
// without ever reaching the background.
const bg = LayerManager.layers[0];
bg.locked = false;
const onBg = { layer: bg };
const bgCell = bg.getCell(9, 9);
PixelDrawRoutine.draw(72, 72, color(), DRAW_MODE.NORMAL, onBg);
bgCell.ink = 1; bgCell.paper = 6; bgCell.bright = true; bgCell.flash = true;
stroke(() => PixelDrawRoutine.draw(72, 72, color(), DRAW_MODE.ERASE_ALL, onBg));
check('a BACKGROUND pass clears the dot', !(bgCell.pixels[0] & 0x80));
check('an emptied BACKGROUND cell keeps its colours after one pass',
  JSON.stringify(attrs(bgCell)) === SEEDED);
stroke(() => PixelDrawRoutine.draw(72, 72, color(), DRAW_MODE.ERASE_ALL, onBg));
check('a second pass resets a BACKGROUND cell to the defaults',
  JSON.stringify(attrs(bgCell)) === JSON.stringify(DEFAULT_CELL_ATTRS));
check('...and it stays altered - there is nothing behind it', bgCell.altered === true);

summary('erase-modes');
