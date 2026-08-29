'use strict';
/**
 * TransformService must act on the ARTWORK, and a 90-degree turn must not
 * throw content away.
 *
 * Two defects, one file, because they surface as the same complaint: "the
 * transform buttons did nothing useful to my picture".
 *
 * 1. THE STAMP LAYER STAYS CURRENT. `endFloatingPaste()` disengages a stamp
 *    but leaves it as the current layer, and the job of stepping back onto the
 *    drawing layer was duplicated across its four callers -- the layer panel's
 *    Disengage button and its stamp-delete path did it, `selection-tool`'s
 *    `activate()` and the Enter-key path did not. So pressing M for the
 *    selection tool after using a stamp -- exactly what you do to check that
 *    nothing is selected -- left every later transform (and every brush
 *    stroke) writing into an empty stamp layer. One question, four answers,
 *    two of them wrong.
 *
 * 2. A NON-SQUARE ROTATION CLIPPED ITS MARGINS. rotate90 centred the turned
 *    buffer in the ORIGINAL box: on a 256x192 canvas the 192x256 result was
 *    inset by +32 columns and -32 rows, so source columns 0-31 and 224-255
 *    were written out of bounds and silently destroyed while 64 columns of
 *    blank paper were added. Rotating twice did not return the picture.
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
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/selection-service.js');
loadModule('js/services/transform-service.js');

LayerManager.initialize();
const drawLayer = LayerManager.getCurrentLayer(); // index 1

const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
const SEL = () => ColorManager.getCurrentSelection();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const erase = (pts) => {
  PixelDrawRoutine.suspendStrokeHooks(() => {
    PixelDrawRoutine.beginBatch();
    for (const [x, y] of pts) {
      PixelDrawRoutine.draw(x, y, SEL(), DRAW_MODE.ERASE, { layer: drawLayer, mirror: false, clip: false });
    }
    PixelDrawRoutine.endBatch();
  });
};
const paint = (pts) => {
  PixelDrawRoutine.beginBatch();
  for (const [x, y] of pts) {
    PixelDrawRoutine.draw(x, y, SEL(), DRAW_MODE.NORMAL, { layer: drawLayer });
  }
  PixelDrawRoutine.endBatch();
};
const inkCount = () => {
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isInk(x, y)) n++;
  return n;
};

// ─────────────────────────────────────────────────────────────────────────
// 1. Disengaging a stamp must hand the drawing layer back
// ─────────────────────────────────────────────────────────────────────────
paint([[10, 10]]);

SelectionService.clear();
SelectionService.setSelection({ x: 8, y: 8, width: 9, height: 9 });
SelectionService.copyToClipboard();
SelectionService.startFloatingPaste(30, 30);

check('the stamp is current while it is engaged',
  LayerManager.getCurrentLayer().isStamp === true);

// The `selection-tool.activate()` path, verbatim: disengage and nothing else.
SelectionService.endFloatingPaste();

check('disengaging the stamp you are standing on restores the drawing layer',
  LayerManager.getCurrentLayer() === drawLayer);

// The symptom the artist reports: transform with nothing selected does nothing.
SelectionService.clear();
check('no selection, so the transform works on the whole canvas',
  !SelectionService.hasSelection());

TransformService.flipHorizontal();
check('flip with no selection moves the artwork on the drawing layer',
  !isInk(10, 10) && isInk(W - 1 - 10, 10));

// ─────────────────────────────────────────────────────────────────────────
// 2. A 90-degree turn must not destroy marks
//
// Back to a bare canvas so the counts below are this section's marks only.
// ─────────────────────────────────────────────────────────────────────────
erase([[W - 1 - 10, 10]]);
check('canvas is clear before the rotation checks', inkCount() === 0);

const ROW = 96;

// Tier 1/2: marks whose span still fits once turned (161 rows into 192), so
// the placement is lossless and turning back must return the picture exactly.
const FITS = [40, 96, 128, 200];
paint(FITS.map((x) => [x, ROW]));
TransformService.rotate90CW();
check(`a turn that fits keeps every mark (${inkCount()} of ${FITS.length})`,
  inkCount() === FITS.length);
TransformService.rotate90CCW();
check('CW then CCW returns every mark to exactly where it started',
  inkCount() === FITS.length && FITS.every((x) => isInk(x, ROW)));

// Tier 3: add the two columns the old code destroyed outright. The span is now
// 221 rows into a 192-tall canvas, so it genuinely cannot fit and the shrink
// runs - but every mark must still be somewhere.
paint([[4, ROW], [224, ROW]]);
const before = inkCount();
check('six marks placed, spanning wider than the canvas is tall', before === 6);

TransformService.rotate90CW();
check(`a turn that cannot fit still keeps every mark (${inkCount()} of ${before})`,
  inkCount() === before);

// ─────────────────────────────────────────────────────────────────────────
// 3. The same root cause reached the BRUSH, and the guard must not break
//    switching from one stamp to another
// ─────────────────────────────────────────────────────────────────────────
// PixelDrawRoutine.draw() falls back to `LayerManager.getCurrentLayer()` when
// no layer is named, so a stroke after a stamp session landed on the emptied
// stamp too - the artist drew and nothing appeared. Same cause, same fix; a
// stroke with no explicit layer must reach the drawing layer.
paint([[60, 60]]);
SelectionService.clear();
SelectionService.setSelection({ x: 56, y: 56, width: 8, height: 8 });
SelectionService.copyToClipboard();
SelectionService.startFloatingPaste(140, 140);
const stampA = LayerManager.getCurrentLayer();
SelectionService.endFloatingPaste();

PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(70, 70, SEL(), DRAW_MODE.NORMAL); // no `layer` option
PixelDrawRoutine.endBatch();
check('a stroke with no named layer lands on the drawing layer, not the stamp',
  drawLayer.getPixelState(70, 70) === true && stampA.getPixelState(70, 70) !== true);

// The restore is guarded on "am I standing on the stamp being disengaged",
// because the layer panel selects the NEXT stamp before calling
// startComponentReposition - which disengages the previous one through
// endFloatingPaste. An unguarded restore would step back onto the drawing
// layer here and switching stamps would silently do nothing.
SelectionService.startFloatingPaste(170, 60);
const stampB = LayerManager.getCurrentLayer();
SelectionService.endFloatingPaste();
check('two stamp layers exist to switch between',
  stampB !== stampA && stampA.isStamp && stampB.isStamp);

// Click stamp A in the layer panel, then click stamp B - the panel's order:
// select the layer, then engage it.
LayerManager.setCurrentLayer(stampA.index);
SelectionService.startComponentReposition(stampA);
check('engaging a stamp from the layer panel makes it current',
  LayerManager.getCurrentLayer() === stampA);

LayerManager.setCurrentLayer(stampB.index);
SelectionService.startComponentReposition(stampB);
check('switching to another stamp stays on the new stamp, not the drawing layer',
  LayerManager.getCurrentLayer() === stampB &&
  SelectionService.floatingPaste && SelectionService.floatingPaste.floatingLayer === stampB);

summary();
