'use strict';
/**
 * Batch 2 part 2B2, correction 1 - a whole-cell shift with content 'both'
 * moves whole cells, even when the selection does not start or end on a cell
 * edge. Before the fix the dots moved inside the exact selection while the
 * colours moved inside the cell rectangle, so a dot could leave its cell's
 * colours behind. Now the dots move inside the cells the selection touches.
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

function setCell(cx, cy, attrs) {
  const px = ZX_COORDS.cellToPixel(cx, cy);
  PixelDrawRoutine.draw(px.x, px.y, attrs, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
}
function isInk(x, y) {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
}
function setDot(x, y) {
  PixelDrawRoutine.draw(x, y, { ink: 2, paper: 7, bright: false, flash: false }, DRAW_MODE.PIXEL_ONLY, { mirror: false });
}

// Cell (0,0) is ink 2 on paper 5; its dots sit at x=2 (outside the selection)
// and x=6 (inside it). The selection is pixels 3..15 on row 0, covering cells
// 0 and 1 but not aligned to cell edges. A shift stays inside the selection's
// cells, so the step is one cell to the right, from cell 0 into cell 1.
setCell(0, 0, { ink: 2, paper: 5, bright: false, flash: false });
setDot(2, 0);
setDot(6, 0);
selectionArea = { x: 3, y: 0, width: 13, height: 1 };

// One whole-cell step to the right, no wrap, dots and colours together.
TransformService.shift('right', { x: ZX_SPECTRUM.CELL_WIDTH, y: 0 }, false, 'both');

const CW = ZX_SPECTRUM.CELL_WIDTH;
check('the dot outside the selection moved with its cell',
  isInk(2 + CW, 0) && !isInk(2, 0));
check('the dot inside the selection moved with its cell',
  isInk(6 + CW, 0) && !isInk(6, 0));
const moved = LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 1, 0);
check('cell (1,0) took cell (0,0) colours, paper included',
  moved.ink === 2 && moved.paper === 5, `ink ${moved.ink} paper ${moved.paper}`);

summary('shift cell rounding');
