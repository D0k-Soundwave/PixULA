'use strict';
/**
 * Batch 10B step 2: SelectionService.bakeMask / maskWritePlan - drawing a mask that is not a layer (Type on canvas). It must
 * leave exactly what placing the same mask as a stamp and committing it leaves, in one undo step, and the plan a preview
 * shows must be the writes the bake makes.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');
global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  packRGB(rgb) { return (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; },
  blitCellBits() {}, blitCellIndices() {}
};
global.setInterval = () => 0;
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
const mask = Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r + c) % 3 === 0));
const clearMask = Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r * 2 + c) % 5 === 0 && !mask[r][c]));

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  const t = LayerManager.layers[1];
  const CH = ZX_SPECTRUM.CELL_HEIGHT;
  for (let cy = 0; cy < Math.ceil(12 / CH); cy++) for (let cx = 0; cx < 3; cx++) {
    const c = t.getCell(cx, cy);
    Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false, altered: true });
    if (c.pixels) c.pixels.fill(0xA5);
    if (c.indices) c.indices.fill(3);
  }
  return t;
}
const snap = (t) => {
  const out = [];
  for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 4; cx++) {
    const c = t.getCell(cx, cy);
    out.push([c.ink, c.paper, c.bright, c.flash, c.indices ? Array.from(c.indices).join(',') : Array.from(c.pixels).join(',')].join('/'));
  }
  return out.join('|');
};
const data = (extra = {}) => ({ mask: mask.map(r => [...r]), x: 5, y: 3, w: 12, h: 9, colorSelection: null, ...extra });

const MODES = ['standard_ula', 'multicolor_8x1', 'multicolor_8x4', 'ula_plus', 'gigascreen', 'timex_hires', 'layer2_256', 'lores'];
const CASES = [
  ['Normal', {}, () => {}],
  ['Inverse', {}, () => StateManager.setInverse(true)],
  ['XOR', {}, () => StateManager.setDrawMode('xor')],
  ['Pixels only', {}, () => StateManager.setDrawMode('pixels')],
  ['Clear background', { opts: { clearDots: 'overlap' } }, () => {}],
  ['opposite shade', { clearMask }, () => {}],
  ['opposite shade + Inverse', { clearMask }, () => StateManager.setInverse(true)]
];
for (const mode of MODES) {
  for (const [label, extra, setup] of CASES) {
    // the stamp path
    let t = enter(mode); setup();
    SelectionService.startFloatingPasteFromMask(mask.map(r => [...r]), 12, 9, 5, 3, 'T', null, 'none', extra.opts || null, null, extra.clearMask || null);
    LayerManager.setCurrentLayer(1);
    SelectionService.commitActiveStamp();
    const viaStamp = snap(LayerManager.layers[1]);
    // the bake
    t = enter(mode); setup();
    const undoBefore = UndoRedo.getUndoCount();
    const ok = SelectionService.bakeMask(data(extra), 'Text');
    const viaBake = snap(LayerManager.layers[1]);
    check(`${mode} / ${label}: bakeMask leaves what a committed stamp leaves`, ok && viaBake === viaStamp);
    check(`${mode} / ${label}: ...in one undo step`, UndoRedo.getUndoCount() === undoBefore + 1);
    StateManager.setInverse(false); StateManager.setDrawMode('normal');
  }
}

// -- the plan is the writes -------------------------------------------------------------------------------------------------------
for (const mode of ['standard_ula', 'multicolor_8x1', 'ula_plus', 'layer2_256']) {
  enter(mode);
  const plan = SelectionService.maskWritePlan(data({ clearMask, opts: { clearDots: 'overlap' } }));
  const seen = [];
  const realDraw = PixelDrawRoutine.draw.bind(PixelDrawRoutine);
  PixelDrawRoutine.draw = (x, y, sel, m, o) => { seen.push({ x, y, mode: m }); return realDraw(x, y, sel, m, o); };
  SelectionService.bakeMask(data({ clearMask, opts: { clearDots: 'overlap' } }));
  PixelDrawRoutine.draw = realDraw;
  const key = (w) => w.x + ',' + w.y + ':' + w.mode;
  check(`${mode}: the preview's plan is the list of writes the bake makes`, plan.length > 0 && plan.map(key).join(' ') === seen.map(key).join(' '), `${plan.length} vs ${seen.length}`);
}

// -- nothing to write to --------------------------------------------------------------------------------------------------------------
{
  const t = enter('standard_ula');
  t.locked = true;
  const before = snap(t), undo = UndoRedo.getUndoCount();
  check('a locked layer: nothing is written and no undo entry', SelectionService.bakeMask(data()) === false && snap(t) === before && UndoRedo.getUndoCount() === undo);
  check('...and the plan is empty', SelectionService.maskWritePlan(data()).length === 0);
  t.locked = false;
  LayerManager.setCurrentLayer(0);
  check('the background is not a target', SelectionService.activeWriteTarget() === null || SelectionService.activeWriteTarget().index >= 1);
}

summary();
