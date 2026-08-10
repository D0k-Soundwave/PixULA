'use strict';
/**
 * Phase 7 quick win 2: TransformService.shift() wrap vs no-wrap.
 *
 * Loads the REAL core (constants, event-bus, state-manager, attribute-system,
 * layer-manager, pixel-draw-routine) and the REAL TransformService, then
 * asserts edge behaviour: wrap rolls pixels around the canvas edge, no-wrap
 * scrolls them out and leaves background (paper preserved) behind.
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

// DOM-owning / out-of-layer singletons stubbed (same set as tools-draw.test.js)
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); }
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; }
};
global.SelectionService = {
  hasSelection() { return false; },
  getSelection() { return null; },
  isFloating() { return false; }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/transform-service.js');

LayerManager.initialize();

const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
const INK2 = { ink: 2, paper: 7, bright: false, flash: false };
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const draw = (x, y, sel = INK2) => {
  PixelDrawRoutine.beginBatch();
  PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL);
  PixelDrawRoutine.endBatch();
};
const rowInkCount = (y) => {
  let n = 0;
  for (let x = 0; x < W; x++) if (isInk(x, y)) n++;
  return n;
};

// ── Wrap (default): pixel rolls around the edge ────────────────────────────
draw(0, 5);
TransformService.shiftLeft(1); // default wrap = true
check('wrap left: pixel at x=0 rolls to the right edge', isInk(W - 1, 5));
check('wrap left: origin vacated', !isInk(0, 5));
check('wrap left: exactly one ink pixel in the row', rowInkCount(5) === 1);

// ── No-wrap: pixel scrolls out and is NOT re-fed ───────────────────────────
TransformService.shiftRight(1, false); // (W-1,5) falls off the right edge
check('no-wrap right: pixel at right edge scrolls out', rowInkCount(5) === 0);

draw(0, 5);
TransformService.shiftLeft(1, false); // (0,5) falls off the left edge
check('no-wrap left: pixel at left edge scrolls out', rowInkCount(5) === 0);
check('no-wrap left: nothing wrapped to the right edge', !isInk(W - 1, 5));

// ── No-wrap: interior pixels still move by the full amount ────────────────
draw(10, 5);
TransformService.shiftLeft(3, false);
check('no-wrap left by 3: interior pixel lands at x=7', isInk(7, 5));
check('no-wrap left by 3: source vacated', !isInk(10, 5));
check('no-wrap left by 3: exactly one ink pixel in the row', rowInkCount(5) === 1);
TransformService.shiftLeft(8, false); // clean the row again
check('row cleaned', rowInkCount(5) === 0);

// ── No-wrap vertical ───────────────────────────────────────────────────────
draw(5, 0);
TransformService.shiftUp(1, false); // (5,0) falls off the top
let colInk = 0;
for (let y = 0; y < H; y++) if (isInk(5, y)) colInk++;
check('no-wrap up: pixel at top edge scrolls out', colInk === 0);

draw(5, H - 1);
TransformService.shiftUp(2, false);
check('no-wrap up by 2: bottom pixel lands two rows higher', isInk(5, H - 3));
check('no-wrap up by 2: bottom row vacated', !isInk(5, H - 1));

// ── No-wrap preserves the vacated cell's paper attribute ──────────────────
const SEL_P6 = { ink: 2, paper: 6, bright: false, flash: false };
draw(40, 40, SEL_P6); // normal draw sets cell (5,5) ink+paper; paper = 6
const layer = LayerManager.getCurrentLayer();
const before = layer.getCell(5, 5);
check('setup: cell (5,5) has paper 6', before && before.paper === 6);
TransformService.shiftRight(8, false); // ink moves into cell (6,5)
const after = layer.getCell(5, 5);
check('no-wrap: vacated cell keeps its paper', after && after.paper === 6);
check('no-wrap: vacated cell has no ink pixel', !isInk(40, 40));
check('no-wrap: ink arrived one cell right', isInk(48, 40));

summary();
