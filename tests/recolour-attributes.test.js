'use strict';
/**
 * BRIGHT and FLASH are written as two values of their own, whatever the ink
 * and paper boxes say - by Recolour (DRAW_MODE.ATTRIBUTES_ONLY) and by every
 * drawing mode that writes attributes.
 *
 * Until 2026-09-15 _stampAttributes only moved bright and flash alongside a
 * colour that was being written - so with Ink and Paper both on "use
 * existing", Recolour changed nothing at all, and every brush stroke made
 * after it (the boxes stay on) silently ignored the Bright and Flash toggles.
 * Pixels Only is the one mode that leaves them alone, because it writes no
 * attributes at all.
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
global.ColorManager = { getCurrentSelection() { return {}; } };
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

LayerManager.initialize();
UndoRedo.initialize();

const X = 80, Y = 80;
const cellAt = () => LayerManager.getCurrentLayer()
  .getCell(Math.floor(X / ZX_SPECTRUM.CELL_WIDTH), Math.floor(Y / ZX_SPECTRUM.CELL_HEIGHT));

/** A cell with ink standing in it and every attribute set to something known. */
function seed({ bright, flash }) {
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
  const cell = cellAt();
  cell.pixels[0] = 0xA5;
  cell.pixels[3] = 0x3C;
  cell.ink = 1; cell.paper = 6; cell.bright = bright; cell.flash = flash;
  cell.altered = true;
  return cell;
}

const attrs = (cell) => JSON.stringify({
  ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash
});
const pixels = (cell) => Array.from(cell.pixels).join(',');

const sel = (o) => ({ ink: 2, paper: 5, bright: false, flash: false,
  inkTransparent: false, paperTransparent: false, ...o });

/** Recolour one cell the way InputHandler._applyAttrPaintAtPoint does. */
function recolour(selection) {
  PixelDrawRoutine.draw(X, Y, selection, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
}

// --- both colours on "use existing": bright and flash still land ----------

const bothKept = { inkTransparent: true, paperTransparent: true };

let cell = seed({ bright: false, flash: true });
let before = pixels(cell);
recolour(sel({ ...bothKept, bright: true, flash: false }));
check('Bright on, Flash off: the cell becomes bright and stops flashing',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: true, flash: false }));
check('...and its pixels are untouched', pixels(cell) === before);

cell = seed({ bright: true, flash: false });
recolour(sel({ ...bothKept, bright: false, flash: true }));
check('Bright off, Flash on: the cell loses bright and flashes',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: false, flash: true }));

cell = seed({ bright: false, flash: false });
recolour(sel({ ...bothKept, bright: true, flash: true }));
check('Bright on, Flash on: both land, colours unchanged',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: true, flash: true }));

// Bright and flash are separate values: changing one leaves the other as set
cell = seed({ bright: false, flash: false });
recolour(sel({ ...bothKept, bright: true, flash: false }));
check('Bright alone: a non-flashing cell only gains bright',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: true, flash: false }));

cell = seed({ bright: true, flash: false });
recolour(sel({ ...bothKept, bright: true, flash: true }));
check('Flash alone: a bright cell only gains flash',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: true, flash: true }));

// --- one colour chosen, the other kept ------------------------------------

cell = seed({ bright: true, flash: true });
before = pixels(cell);
recolour(sel({ ink: 2, paperTransparent: true, bright: false, flash: false }));
check('new ink, paper kept, Bright and Flash off',
  attrs(cell) === JSON.stringify({ ink: 2, paper: 6, bright: false, flash: false }));
check('...pixels untouched', pixels(cell) === before);

cell = seed({ bright: false, flash: false });
recolour(sel({ paper: 5, inkTransparent: true, bright: true, flash: false }));
check('new paper, ink kept, Bright on',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 5, bright: true, flash: false }));

cell = seed({ bright: false, flash: true });
recolour(sel({ ink: 3, paper: 4, bright: true, flash: false }));
check('both colours chosen: all four attributes land',
  attrs(cell) === JSON.stringify({ ink: 3, paper: 4, bright: true, flash: false }));

// --- the drawing modes follow the same rule -------------------------------
//
// This block used to pin the OPPOSITE: with both colours kept, a Normal stroke
// left bright and flash alone. That is what the artist hit next - both boxes
// stay on after a Recolour, and every brush stroke then silently ignored the
// Bright and Flash toggles (2026-09-15). Bright and flash are their own
// functions in every mode that writes attributes.

const strokeWrites = (mode, label, expectInked) => {
  cell = seed({ bright: false, flash: true });
  const inkedBefore = !!(cell.pixels[0] & 0x80);
  PixelDrawRoutine.draw(X, Y, sel({ ...bothKept, bright: true, flash: false }), mode);
  check(`${label} with both colours kept writes Bright and Flash, colours unchanged`,
    attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: true, flash: false }));
  check(`${label} still does its own thing to the pixel`,
    !!(cell.pixels[0] & 0x80) === expectInked(inkedBefore));
};
// seed() sets pixels[0] = 0xA5, so the pixel at local (0,0) starts as ink
strokeWrites(DRAW_MODE.NORMAL, 'Normal (left button)', () => true);
strokeWrites(DRAW_MODE.NORMAL_ERASE, 'Normal (right button)', () => false);
strokeWrites(DRAW_MODE.XOR_PIXEL, 'XOR', (before) => !before);

cell = seed({ bright: false, flash: true });
PixelDrawRoutine.draw(X, Y, sel({ ...bothKept, bright: true, flash: false }), DRAW_MODE.PIXEL_ONLY);
check('Pixels Only still writes no attributes at all',
  attrs(cell) === JSON.stringify({ ink: 1, paper: 6, bright: false, flash: true }));

summary('recolour-attributes');
