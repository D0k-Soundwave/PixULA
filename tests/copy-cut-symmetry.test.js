'use strict';
/**
 * Copy and Cut must be the SAME operation except for one step: Cut also
 * erases the source. Historically they were three independently
 * hand-written sequences (canvas context menu, Ctrl+C/Ctrl+X, Edit menu) --
 * Cut's always called copyToClipboard -> deleteSelection ->
 * startFloatingPaste -> clear, but Copy's only ever called copyToClipboard,
 * so Copy never produced anything usable to paste from or draw with. All
 * six entry points now funnel through SelectionService.copyOrCut(erase),
 * so this suite pins that single implementation directly.
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

function freshLayer() {
  LayerManager.initialize();
  const layer = LayerManager.getCurrentLayer();
  PixelDrawRoutine.beginBatch();
  for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) {
    PixelDrawRoutine.draw(x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL, { layer });
  }
  PixelDrawRoutine.endBatch();
  return layer;
}

// ── copyOrCut(false) == Copy: must produce a working, drawable stamp ───────
{
  const layer = freshLayer();
  SelectionService.clear();
  SelectionService.setSelection({ x: 8, y: 8, width: 9, height: 9 });

  const ok = SelectionService.copyOrCut(false);
  check('Copy (copyOrCut(false)) reports success', ok === true);
  check('Copy creates a floating stamp', SelectionService.isFloating());
  check('Copy clears the selection afterward', !SelectionService.hasSelection());
  check('Copy leaves the source pixels in place',
    layer.getPixelState(10, 10) === true);
  check('Copy\'s stamp lands back at the selection origin', (() => {
    const fp = SelectionService.floatingPaste;
    return fp.x === 8 && fp.y === 8;
  })());

  // The stamp must actually be usable to draw with, not just exist.
  SelectionService.moveFloatingPaste(40, 40);
  SelectionService.commitAllStamps();
  const drewSomething = layer.getPixelState(42, 42) === true; // relative (2,2) of the 4x4 block
  check('Copy\'s stamp can actually be committed/drawn with', drewSomething);
}

// ── copyOrCut(true) == Cut: identical, but erases the source ───────────────
{
  const layer = freshLayer();
  SelectionService.clear();
  SelectionService.setSelection({ x: 8, y: 8, width: 9, height: 9 });

  const ok = SelectionService.copyOrCut(true);
  check('Cut (copyOrCut(true)) reports success', ok === true);
  check('Cut creates a floating stamp', SelectionService.isFloating());
  check('Cut clears the selection afterward', !SelectionService.hasSelection());
  check('Cut erases the source pixels', layer.getPixelState(10, 10) === false);
  check('Cut\'s stamp lands back at the selection origin', (() => {
    const fp = SelectionService.floatingPaste;
    return fp.x === 8 && fp.y === 8;
  })());

  SelectionService.moveFloatingPaste(40, 40);
  SelectionService.commitAllStamps();
  const drewSomething = layer.getPixelState(42, 42) === true;
  check('Cut\'s stamp can actually be committed/drawn with', drewSomething);
}

// ── No selection: both are safe no-ops ──────────────────────────────────────
{
  freshLayer();
  SelectionService.clear();
  check('Copy with no selection returns false', SelectionService.copyOrCut(false) === false);
  check('Cut with no selection returns false', SelectionService.copyOrCut(true) === false);
}

summary();
