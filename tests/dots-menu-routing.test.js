'use strict';
/**
 * Batch 2 part 2B2 - Image > Dots: which commands are blocked and why, and
 * where a dot flip goes. A floating stamp is flipped by transformStamp, never
 * written through the picture's cells; an engaged stamp layer with nothing
 * floating blocks the flips; a stamp with its own cell colours cannot be
 * flipped here; Invert Dots and Colours is blocked on a floating stamp.
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

// The stub is replaced per case: floating or not, and what the stamp carries.
let stamp = { floating: false, attrs: null, calls: [] };
global.SelectionService = {
  hasSelection() { return false; }, getSelection() { return null; },
  isFloating() { return stamp.floating; },
  get floatingPaste() { return stamp.floating ? { attrs: stamp.attrs } : null; },
  engagedStamp() {
    if (stamp.floating) return { layer: null, floating: true, ownColours: !!stamp.attrs };
    const l = global.LayerManager && LayerManager.getCurrentLayer();
    return l && l.isStamp ? { layer: l, floating: false, ownColours: false } : null;
  },
  transformStamp(type) { stamp.calls.push(type); }
};

ColorManager.initialize();
LayerManager.initialize();

const layer = () => LayerManager.getCurrentLayer();

// Picture, nothing floating: everything available.
{
  const b = TransformService.dotCommandsBlocked();
  check('picture: flips and invert available', b.flip === null && b.invert === null,
    JSON.stringify(b));
}

// Floating plain stamp: flips go to the stamp, invert is blocked.
stamp = { floating: true, attrs: null, calls: [] };
{
  const b = TransformService.dotCommandsBlocked();
  check('floating stamp: flips available', b.flip === null, b.flip);
  check('floating stamp: invert blocked as stamp', b.invert === 'stamp', b.invert);
  TransformService.dotsFlip('h');
  TransformService.dotsFlip('v');
  check('floating stamp: flips go to transformStamp',
    stamp.calls.join(',') === 'flipH,flipV', stamp.calls.join(','));
  const before = TransformService.invertDotsAndColours();
  check('floating stamp: invert changes nothing', before === 0);
}

// Floating stamp with its own cell colours: flips blocked too.
stamp = { floating: true, attrs: [{ ink: 1, paper: 6 }], calls: [] };
{
  const b = TransformService.dotCommandsBlocked();
  check('stamp with its own colours: flip blocked', b.flip === 'stampAttrs', b.flip);
  TransformService.dotsFlip('h');
  check('stamp with its own colours: flip does nothing', stamp.calls.length === 0);
}

// Nothing floating, the stamp layer engaged: flips blocked as stamp.
stamp = { floating: false, attrs: null, calls: [] };
{
  const original = layer();
  Object.defineProperty(original, 'isStamp', { value: true, configurable: true });
  const b = TransformService.dotCommandsBlocked();
  check('engaged stamp layer: flip blocked as stamp', b.flip === 'stamp', b.flip);
  delete original.isStamp;
}

// Layer 2 has no cell colours: invert says so, flips still work.
ScreenModeService.applyModeRaw('layer2_256');
ColorManager.initialize();
LayerManager.initialize();
{
  const b = TransformService.dotCommandsBlocked();
  check('layer 2: invert blocked as no cell colours', b.invert === 'noCellAttributes', b.invert);
  check('layer 2: flips available', b.flip === null, b.flip);
}
ScreenModeService.applyModeRaw('standard_ula');
ColorManager.initialize();
LayerManager.initialize();

summary('dots menu routing');
