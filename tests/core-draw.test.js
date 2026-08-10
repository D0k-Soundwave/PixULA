'use strict';
/**
 * Core drawing-path test — loads the REAL core modules (constants, event-bus,
 * state-manager, attribute-system, layer-manager, pixel-draw-routine) in Node
 * and verifies the ZX attribute constraints that PixelDrawRoutine must
 * enforce. Only CanvasSystem (iframe/DOM) and Logger are stubbed.
 *
 * This is the Phase 1 exit criterion of docs/REFACTOR_PLAN.md §4: a scripted
 * draw shows correct attribute-clash behaviour.
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

// CanvasSystem stub — records composited RGB per pixel, keyed y*width+x
const written = new Map();
global.CanvasSystem = {
  setPixel(x, y, r, g, b) { written.set(y * ZX_SPECTRUM.WIDTH + x, (r << 16) | (g << 8) | b); },
  markCellDirty() {},
  requestRender() {},
  _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); }
};
const rgbOf = (paletteIndex) => {
  const [r, g, b] = ZX_PALETTE_RGB[paletteIndex];
  return (r << 16) | (g << 8) | b;
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');

LayerManager.initialize();
const layer = LayerManager.getCurrentLayer();
check('initialize creates background + drawing layer, current = layer 1',
  !!layer && LayerManager.layers.length === 2 && !layer.isBackground);

const px = (cell, lx, ly) => !!(cell.pixels[ly] & (0x80 >> lx));

// --- 1. Normal draw sets the pixel bit and BOTH cell attributes (full CLUT).
PixelDrawRoutine.draw(10, 10, { ink: 2, paper: 6, bright: false, flash: false }, DRAW_MODE.NORMAL);
let cell = layer.getCell(1, 1);
check('pixel bit set at (10,10)', px(cell, 2, 2));
check('cell ink = 2', cell.ink === 2);
check('cell paper = 6', cell.paper === 6);
check('cell marked altered', cell.altered === true);

// --- 2. Attribute clash: a second colour in the same 8×8 cell recolours the
// whole cell — the first pixel keeps its bit but now renders in the new ink.
PixelDrawRoutine.draw(11, 10, { ink: 5, paper: 0, bright: false, flash: false }, DRAW_MODE.NORMAL);
cell = layer.getCell(1, 1);
check('clash: cell ink replaced cell-wide (2 -> 5)', cell.ink === 5);
check('clash: cell paper replaced cell-wide (6 -> 0)', cell.paper === 0);
check('clash: first pixel bit still set', px(cell, 2, 2));
check('clash: second pixel bit set', px(cell, 3, 2));

// --- 2b. PAPER draw replaces ONLY the cell's paper colour: pixels, ink and
// bright/flash are all left exactly as they were.
PixelDrawRoutine.draw(200, 150, { ink: 3, paper: 1, bright: true, flash: false }, DRAW_MODE.NORMAL);
let pcell = layer.getCell(25, 18); // pixel (200,150) -> local (0,6)
check('setup: normal draw set ink=3, paper=1, bright, pixel', pcell.ink === 3 && pcell.paper === 1 && pcell.bright === true && px(pcell, 0, 6));
PixelDrawRoutine.draw(200, 150, { ink: 6, paper: 4, bright: false, flash: true }, DRAW_MODE.PAPER);
pcell = layer.getCell(25, 18);
check('paper draw sets paper (-> 4)', pcell.paper === 4);
check('paper draw leaves ink untouched (still 3)', pcell.ink === 3);
check('paper draw does NOT clear the ink pixel', px(pcell, 0, 6));
check('paper draw applies bright from selection (-> false)', pcell.bright === false);
check('paper draw applies flash from selection (-> true)', pcell.flash === true);

// --- 2c. INK draw replaces ONLY the cell's ink colour (+ bright/flash); paper
// and pixels are left as they were.
PixelDrawRoutine.draw(200, 150, { ink: 1, paper: 2, bright: true, flash: false }, DRAW_MODE.INK);
pcell = layer.getCell(25, 18);
check('ink draw sets ink (-> 1)', pcell.ink === 1);
check('ink draw leaves paper untouched (still 4)', pcell.paper === 4);
check('ink draw does NOT clear the ink pixel', px(pcell, 0, 6));
check('ink draw applies bright from selection (-> true)', pcell.bright === true);
check('ink draw applies flash from selection (-> false)', pcell.flash === false);

// --- 3. BRIGHT is cell-wide (applies to ink AND paper together)
PixelDrawRoutine.draw(50, 50, { ink: 1, paper: 7, bright: true, flash: false }, DRAW_MODE.NORMAL);
cell = layer.getCell(6, 6);
check('bright flag stored cell-wide', cell.bright === true);

// --- 4. Compositor: composed output uses the (clashed) cell attributes,
// bright offsets the colour index by 8.
LayerManager.composeCellToCanvas(1, 1);
LayerManager.composeCellToCanvas(6, 6);
check('compose: ink pixel (10,10) renders palette colour 5', written.get(10 * ZX_SPECTRUM.WIDTH + 10) === rgbOf(5));
check('compose: ink pixel (11,10) renders palette colour 5', written.get(10 * ZX_SPECTRUM.WIDTH + 11) === rgbOf(5));
check('compose: paper pixel (8,8) renders palette colour 0', written.get(8 * ZX_SPECTRUM.WIDTH + 8) === rgbOf(0));
check('compose: bright ink (50,50) renders palette colour 1+8', written.get(50 * ZX_SPECTRUM.WIDTH + 50) === rgbOf(9));
check('compose: bright paper (48,48) renders palette colour 7+8', written.get(48 * ZX_SPECTRUM.WIDTH + 48) === rgbOf(15));

// --- 5. Batch operations work with UndoRedo absent (guarded calls)
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(100, 100, { ink: 4, paper: 7, bright: false, flash: false }, DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(101, 100, { ink: 4, paper: 7, bright: false, flash: false }, DRAW_MODE.NORMAL);
PixelDrawRoutine.endBatch();
check('batch draw without UndoRedo present', px(layer.getCell(12, 12), 4, 4));

// --- 6. Out-of-bounds coordinates are silently ignored
PixelDrawRoutine.draw(-1, 5, { ink: 0, paper: 7, bright: false, flash: false }, DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(ZX_SPECTRUM.WIDTH, 5, { ink: 0, paper: 7, bright: false, flash: false }, DRAW_MODE.NORMAL);
check('out-of-bounds draw does not throw', true);

// --- 7. ERASE mode clears the pixel bit
PixelDrawRoutine.draw(100, 100, { ink: 4, paper: 7, bright: false, flash: false }, DRAW_MODE.ERASE);
check('erase clears the pixel bit', !px(layer.getCell(12, 12), 4, 4));

summary();
