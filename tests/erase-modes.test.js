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
 *   eraser tool   clear the pixel, reset paper and flash on contact, and take
 *                 ink and bright with the last pixel in the cell
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
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
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

// --- the eraser TOOL: removes everything -------------------------------

cell = seed(50, 50);
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.NORMAL);
// bright TRUE here so the staging can be told apart: it must survive the first
// touch alongside the ink it colours, and go with that ink at the end.
cell.ink = 1; cell.paper = 6; cell.bright = true; cell.flash = true;

// Stage one. Paper and flash are what the erased area itself shows and are not
// needed to render ink, so they go on contact. Ink and bright stay, because
// ink the artist did NOT erase is still standing in this cell.
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL);
check('eraser clears the pixel it touches', !isInk(50, 50));
check('eraser resets PAPER on contact',   cell.paper === DEFAULT_CELL_ATTRS.paper);
check('eraser resets FLASH on contact',   cell.flash === DEFAULT_CELL_ATTRS.flash);
check('eraser keeps INK while other ink remains in the cell',    cell.ink === 1);
check('eraser keeps BRIGHT while other ink remains in the cell', cell.bright === true);
check('eraser leaves that other ink standing', isInk(51, 50));

// Stage two: the last pixel goes, so nothing needs the ink colour any more
PixelDrawRoutine.draw(51, 50, color(), DRAW_MODE.ERASE_ALL);
check('eraser resets INK and BRIGHT with the last pixel in the cell',
  JSON.stringify(attrs(cell)) === JSON.stringify(DEFAULT_CELL_ATTRS));
check('an emptied upper-layer cell goes transparent again', cell.altered === false);

// --- the eraser tool itself, through its real code path ----------------

// The module exports the CLASS; the app registers an instance elsewhere.
const eraser = new EraserTool();
{
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
  const c = cellAt(60, 60);
  for (let x = 56; x < 64; x++) PixelDrawRoutine.draw(x, 60, color(), DRAW_MODE.NORMAL);
  c.ink = 1; c.paper = 6; c.bright = false; c.flash = true;

  eraser.setSize(32);
  eraser.onPointerDown(60, 60, {});
  eraser.onPointerUp(60, 60, {});

  check('the real eraser tool clears the ink', !isInk(60, 60));
  check('the real eraser tool takes the attributes with it',
    JSON.stringify(attrs(c)) === JSON.stringify(DEFAULT_CELL_ATTRS));
}

// --- the background keeps its paint ------------------------------------

const bg = LayerManager.layers[0];
LayerManager.setCurrentLayer(0);
PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
const bgCell = bg.getCell(9, 9);
PixelDrawRoutine.draw(72, 72, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(72, 72, color(), DRAW_MODE.ERASE_ALL);
check('an emptied BACKGROUND cell stays altered - there is nothing behind it',
  bgCell.altered === true);

summary('erase-modes');
