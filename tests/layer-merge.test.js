'use strict';
/**
 * Regression coverage for the LayerManager cell-merge consolidation
 * (mergeDown / mergeSelected sharing the new `_mergeCellInto` primitive,
 * and flattenVisible sharing `_composeCellData`/`_composeIndexedCellData`
 * with the live canvas compose path):
 *  1. mergeDown in classic mode — byte-exact OR-stack of pixels, attrs
 *     copied from the upper (topmost) layer.
 *  2. mergeDown in an indexed mode — transparency preservation: a pixel
 *     left untouched (-1) in BOTH the source and the target must stay -1,
 *     never seeded to the background's default paper index (which is what
 *     routing this through the background-relative compose primitives
 *     would do wrong).
 *  3. mergeSelected merging 3+ layers, bottom-to-top attribute precedence.
 *  4. Part D: mergeDown must recompose the canvas on success (previously
 *     it did not, leaving the canvas showing pre-merge pixels).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');

ColorManager.initialize();

const STD = SCREEN_MODES.STANDARD_ULA;
const L2 = SCREEN_MODES.LAYER2_256;

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

// ─── 1. mergeDown, classic mode ─────────────────────────────────────────────

{
  enter(STD.id);
  const layer2 = LayerManager.addLayer('Layer 2');

  const l1cell = LayerManager.getLayer(1).getCell(0, 0);
  l1cell.pixels.set([0xF0, 0, 0, 0, 0, 0, 0, 0]);
  l1cell.ink = 2; l1cell.paper = 5; l1cell.bright = false; l1cell.flash = false;
  l1cell.altered = true;

  const l2cell = layer2.getCell(0, 0);
  l2cell.pixels.set([0x0F, 0, 0, 0, 0, 0, 0, 0]);
  l2cell.ink = 4; l2cell.paper = 1; l2cell.bright = true; l2cell.flash = true;
  l2cell.altered = true;

  const countBefore = LayerManager.getLayerCount();
  const ok = LayerManager.mergeDown(layer2.index);
  check('mergeDown (classic) returns true', ok === true);
  check('mergeDown (classic) removes the upper layer', LayerManager.getLayerCount() === countBefore - 1);

  const merged = LayerManager.getLayer(1).getCell(0, 0);
  check('mergeDown (classic) OR-stacks pixels byte-exactly',
    merged.pixels[0] === 0xFF && merged.pixels.slice(1).every(b => b === 0));
  check('mergeDown (classic) takes attrs from the upper (topmost) layer',
    merged.ink === 4 && merged.paper === 1 && merged.bright === true && merged.flash === true);
  check('mergeDown (classic) marks the merged cell altered', merged.altered === true);
}

// ─── 2. mergeDown, indexed mode — transparency preservation ────────────────

{
  enter(L2.id);
  check('LAYER2_256 is an indexed mode for this test', ZX_SPECTRUM.PIXEL_DEPTH > 1);

  const layer2 = LayerManager.addLayer('Layer 2');
  const n = ZX_SPECTRUM.CELL_WIDTH * ZX_SPECTRUM.CELL_HEIGHT;

  const l1cell = LayerManager.getLayer(1).getCell(0, 0);
  l1cell.indices.fill(-1);
  l1cell.indices[0] = 3;   // set by layer 1, untouched by layer 2 -> must survive
  l1cell.altered = true;

  const l2cell = layer2.getCell(0, 0);
  l2cell.indices.fill(-1);
  l2cell.indices[1] = 7;   // set by layer 2 -> must win
  // index 0 left at -1 in layer 2 (transparent) — must NOT overwrite layer 1's 3
  l2cell.altered = true;

  const ok = LayerManager.mergeDown(layer2.index);
  check('mergeDown (indexed) returns true', ok === true);

  const merged = LayerManager.getLayer(1).getCell(0, 0);
  check('mergeDown (indexed) keeps target pixel untouched by a transparent source pixel',
    merged.indices[0] === 3);
  check('mergeDown (indexed) lets the source layer\'s set pixel win',
    merged.indices[1] === 7);
  check('mergeDown (indexed) leaves pixels untouched by EITHER layer as -1 (not DEFAULT_PAPER)',
    Array.from(merged.indices.slice(2, n)).every(v => v === -1));
}

// ─── 3. mergeSelected, 3+ layers ────────────────────────────────────────────

{
  enter(STD.id);
  const layer2 = LayerManager.addLayer('Layer 2');
  const layer3 = LayerManager.addLayer('Layer 3');

  const c1 = LayerManager.getLayer(1).getCell(0, 0);
  c1.pixels.set([0x80, 0, 0, 0, 0, 0, 0, 0]);
  c1.ink = 1; c1.paper = 0; c1.altered = true;

  const c2 = layer2.getCell(0, 0);
  c2.pixels.set([0x40, 0, 0, 0, 0, 0, 0, 0]);
  c2.ink = 2; c2.paper = 0; c2.altered = true;

  const c3 = layer3.getCell(0, 0);
  c3.pixels.set([0x20, 0, 0, 0, 0, 0, 0, 0]);
  c3.ink = 3; c3.paper = 0; c3.altered = true;

  LayerManager.selectedLayers.clear();
  LayerManager.selectedLayers.add(1);
  LayerManager.selectedLayers.add(layer2.index);
  LayerManager.selectedLayers.add(layer3.index);

  const ok = LayerManager.mergeSelected();
  check('mergeSelected returns true', ok === true);
  check('mergeSelected leaves exactly background + 1 drawing layer', LayerManager.getLayerCount() === 2);

  const merged = LayerManager.getLayer(1).getCell(0, 0);
  check('mergeSelected OR-stacks all three layers\' pixels',
    merged.pixels[0] === 0xE0 && merged.pixels.slice(1).every(b => b === 0));
  check('mergeSelected takes attrs from the topmost (last-processed) layer',
    merged.ink === 3 && merged.paper === 0);
}

// ─── 4. Part D: mergeDown recomposes the canvas ────────────────────────────

{
  enter(STD.id);
  const layer2 = LayerManager.addLayer('Layer 2');

  const l1cell = LayerManager.getLayer(1).getCell(0, 0);
  l1cell.pixels[0] = 0xFF;
  l1cell.altered = true;
  const l2cell = layer2.getCell(0, 0);
  l2cell.pixels[0] = 0x01;
  l2cell.altered = true;

  let composeCalls = 0;
  const original = LayerManager.requestComposition;
  LayerManager.requestComposition = function(...args) {
    composeCalls++;
    return original.apply(this, args);
  };

  LayerManager.mergeDown(layer2.index);
  LayerManager.requestComposition = original;

  check('mergeDown calls requestComposition on success (Part D)', composeCalls > 0);
}

summary();
