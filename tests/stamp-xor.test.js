'use strict';
/**
 * Stamp XOR drag = once-per-STROKE toggle.
 *
 * Dragging a stamp (text, a bitmap-font glyph run, a pasted image) rubber-stamps
 * SelectionService.stampAt() on every pointer move within ONE PixelDrawRoutine
 * batch (input-handler's continuous stamp path). In XOR mode each covered pixel
 * toggles — so where successive stamp positions overlap, an un-guarded toggle
 * fires twice and cancels, and the drag erases its own trail (it "commits an XOR
 * change on every pixel drawn when dragged, not just once for the movement").
 *
 * The guard lives in SelectionService: pixels toggled in the current batch are
 * remembered and skipped, and the memory clears on PIXEL_BATCH_START. So this
 * suite loads the REAL EventBus (the stub is a no-op — the clear would never
 * fire) and drives the real SelectionService the way input-handler does.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');          // REAL bus — PIXEL_BATCH_START must reach the listener
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, composeToCanvas() {},
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 1, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.UndoRedo = { beginAction() {}, endAction() {}, cancelAction() {}, snapshot() {} };
global.TransformService = {};
global.ClipboardCodec = {};
global.Storage = { save() {}, load() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/selection-service.js');

LayerManager.initialize();
const bg = LayerManager.getCurrentLayer();
bg.locked = false;

// An 8x8 solid stamp — the shape of a filled glyph cell.
const W = 8, H = 8;
const pixels = [];
for (let r = 0; r < H; r++) pixels.push(new Array(W).fill(1));

SelectionService.startFloatingPasteFromMask(pixels, W, H, 40, 40, 'Text', {}, 'none');
const stamp = SelectionService.floatingPaste.floatingLayer;
LayerManager.setLayerXorMode(stamp.index, true);   // the transform-panel "XOR Mode" checkbox

const isInk = (x, y) => {
  const st = PixelDrawRoutine.getPixelState(x, y, { layer: bg });
  return !!(st && st.isInk);
};
const bandInk = () => {
  let n = 0;
  for (let y = 35; y < 60; y++) for (let x = 35; x < 90; x++) if (isInk(x, y)) n++;
  return n;
};

// One continuous drag: the stamp steps right 2px at a time, so each position
// overlaps the previous by 6px — the overlap that cancelled before the fix.
function dragRight() {
  PixelDrawRoutine.beginBatch();                 // input-handler opens one batch per drag
  for (let left = 40; left <= 60; left += 2) {
    SelectionService.moveStampPreview(left + W / 2, 40 + H / 2);  // centre -> top-left
    SelectionService.stampAt(stamp);
  }
  PixelDrawRoutine.endBatch();
}

dragRight();

// The trail is a solid 8-tall band spanning the whole swept width (x40..67).
let solid = true;
for (let x = 40; x <= 67; x++) if (!isInk(x, 43)) solid = false;
check('stamp/xor: drag lays a continuous trail, not self-cancelling fragments', solid);
check('stamp/xor: full swept band is filled (8 x 28)', bandInk() === 8 * 28);

// XOR is reversible: dragging the identical path again clears the trail.
dragRight();
check('stamp/xor: re-dragging the same path XORs the trail back to blank', bandInk() === 0);

summary();
