'use strict';
/**
 * currentLayerIndex must never be left stranded on a stamp layer.
 *
 * _adjustCurrentLayerIndex() runs after every layer removal to keep
 * currentLayerIndex/activeDrawLayerIndex pointing at valid layers. It already
 * guaranteed activeDrawLayerIndex skips stamps, but only clamped
 * currentLayerIndex to array BOUNDS -- it never checked whether the slot it
 * landed on was itself a DIFFERENT stamp layer that splice() shifted down
 * after the removed one. Two dangling (pasted-but-never-committed) stamps,
 * cancelling the topmost, reproduced it: currentLayerIndex landed on the
 * OTHER stamp instead of the real drawing layer.
 *
 * The consequence is silent and far from the cause: every op that reads
 * "the current layer" -- copyToClipboard foremost -- would then read from
 * that stray, empty stamp, so Copy would silently capture nothing while a
 * fresh Cut (which always creates and explicitly selects its own new stamp)
 * kept working. That asymmetry is what surfaced this.
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
  setCanvasCursor() {}, onReady(cb) { cb(); }, composeToCanvas() {},
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.UndoRedo = { beginAction() {}, endAction() {}, cancelAction() {}, snapshot() {} };
global.TransformService = {};
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/selection-service.js');

LayerManager.initialize();
const drawLayer = LayerManager.getCurrentLayer(); // index 1

// Paint a 4x4 ink block to copy later.
PixelDrawRoutine.beginBatch();
for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) {
  PixelDrawRoutine.draw(x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL, { layer: drawLayer });
}
PixelDrawRoutine.endBatch();

function selectAndCopy(x, y, w, h) {
  SelectionService.clear();
  SelectionService.setSelection({ x, y, width: w, height: h });
  SelectionService.copyToClipboard();
}

// Round 1: paste a stamp, then leave it dangling by switching away from it
// the way the layer panel's own disengage path does (restore the real
// drawing layer as current without deleting the stamp).
selectAndCopy(8, 8, 9, 9);
SelectionService.startFloatingPaste(30, 30);
SelectionService.endFloatingPaste();
LayerManager.setCurrentLayer(LayerManager.activeDrawLayerIndex);

// Round 2: paste a SECOND stamp (now current), then cancel it outright --
// cancelFloatingPaste calls LayerManager.removeLayer, which is exactly the
// path _adjustCurrentLayerIndex runs on.
selectAndCopy(8, 8, 9, 9);
SelectionService.startFloatingPaste(50, 50);

const stampCountBeforeCancel = LayerManager.layers.filter(l => l.isStamp).length;
check('two dangling stamps exist before cancelling the second', stampCountBeforeCancel === 2);

SelectionService.cancelFloatingPaste();

check('current layer is not a stamp after cancelling one of two dangling stamps',
  !LayerManager.getCurrentLayer().isStamp);
check('current layer is the real drawing layer',
  LayerManager.getCurrentLayer() === drawLayer);

// The real-world symptom: Copy must actually capture the ink, not silently
// read from a stray stamp layer.
selectAndCopy(8, 8, 9, 9);
const copiedSomething = SelectionService.clipboard.pixels.some(row => row.some(v => v));
check('Copy after the stray-stamp scenario still captures the ink', copiedSomething);

summary();
