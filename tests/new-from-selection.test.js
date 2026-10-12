'use strict';
/**
 * Batch 9 part 9B step 1: Fit Selection to Cells and New picture from selection. The selection becomes the whole picture, at the
 * top left, in the SAME screen mode; every layer is kept and cropped; the rest is empty (the background gets File > New's
 * white paper); one Ctrl+Z gives the old picture back.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/utils/snap-grid.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {}, markAllDirty() {},
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

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MODES = ['standard_ula', 'multicolor_8x4', 'multicolor_8x2', 'multicolor_8x1', 'ula_plus', 'gigascreen', 'timex_hires',
  'layer2_256', 'layer2_320', 'layer2_640', 'lores'];
const cellSig = (c) => JSON.stringify([c.ink, c.paper, c.bright, c.flash, c.altered, Array.from(c.pixels),
  c.indices ? Array.from(c.indices) : null, c.pixelsB ? Array.from(c.pixelsB) : null]);

function seed() {
  // random but repeatable content on every drawing layer
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) >> 8) & 255;
  for (const layer of LayerManager.layers) {
    if (layer.isBackground) continue;
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
      const c = layer.getCell(x, y);
      for (let r = 0; r < c.pixels.length; r++) c.pixels[r] = rnd();
      if (c.indices) for (let i = 0; i < c.indices.length; i++) c.indices[i] = rnd() & 63;
      c.ink = rnd() & 7; c.paper = rnd() & 7; c.bright = !!(rnd() & 1); c.altered = true;
    }
  }
}

for (const mode of MODES) {
  __setActiveScreenMode(mode);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  LayerManager.addLayer();
  LayerManager.addLayer();
  seed();
  const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

  // -- Fit Selection to Cells ------------------------------------------------------------------------------------
  SelectionService.setSelection({ x: cw + 3, y: ch + 1, width: 2 * cw + 2, height: 2 * ch, mask: [[true]] });
  const changed = SelectionService.snapToCells();
  const sel = SelectionService.getSelection();
  check(`${mode}: the fitted selection is whole cells, a rectangle (no mask), and covers the old one`,
    changed === true && sel.x % cw === 0 && sel.y % ch === 0 && sel.width % cw === 0 && sel.height % ch === 0 && !sel.mask &&
    sel.x <= cw + 3 && sel.x + sel.width >= cw + 3 + 2 * cw + 2 && sel.y <= ch + 1 && sel.y + sel.height >= ch + 1 + 2 * ch,
    JSON.stringify(sel));
  check(`${mode}: fitting a selection that is already whole cells changes nothing`, SelectionService.snapToCells() === false);

  // -- New picture from selection ---------------------------------------------------------------------------------
  const cx = sel.x / cw, cy = sel.y / ch, cols = sel.width / cw, rows = sel.height / ch;
  const before = LayerManager.layers.map(l => l.attributeData.map(r => r.map(cellSig)));
  const countBefore = LayerManager.layers.length;
  const ok = LayerManager.cropToCells(cx, cy, cols, rows);
  check(`${mode}: cropToCells reports success`, ok === true);
  check(`${mode}: the mode did not change and every layer is kept`, ZX_SPECTRUM.WIDTH === W && LayerManager.layers.length === countBefore);
  let bad = 0, badOutside = 0;
  LayerManager.layers.forEach((layer, li) => {
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
      const now = cellSig(layer.getCell(x, y));
      if (x < cols && y < rows) { if (now !== before[li][cy + y][cx + x]) bad++; }
      else if (layer.isBackground) {
        const c = layer.getCell(x, y);
        if (c.paper !== 7 || c.bright || !c.altered) badOutside++;
      } else {
        const c = layer.getCell(x, y);
        if (c.altered) badOutside++;
      }
    }
  });
  check(`${mode}: inside the rectangle every cell of every layer is the old cell at the offset`, bad === 0, `${bad} differ`);
  check(`${mode}: outside it the background is white paper and the other layers are empty`, badOutside === 0, `${badOutside} wrong`);
}

// -- undo -----------------------------------------------------------------------------------------------------------
{
  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  LayerManager.addLayer();
  seed();
  const sig = () => LayerManager.layers.map(l => l.attributeData.map(r => r.map(cellSig)));
  const before = sig();
  SelectionService.setSelection({ x: 16, y: 16, width: 32, height: 24 });
  UndoRedo.beginAction('New picture from selection');
  LayerManager.cropToCells(2, 2, 4, 3);
  SelectionService.clear();
  UndoRedo.endAction();
  check('the crop changed the picture', !eq(sig(), before));
  UndoRedo.undo();
  check('one Ctrl+Z gives every layer back exactly', eq(sig(), before));
  check('...and the selection', SelectionService.getSelection() && SelectionService.getSelection().x === 16);
  UndoRedo.redo();
  check('redo crops again', !eq(sig(), before));
}

// -- a stamp layer moves with the crop -----------------------------------------------------------------------------------
{
  __setActiveScreenMode('standard_ula');
  LayerManager.initialize();
  const layer = LayerManager.addLayer();
  layer.isStamp = true;
  layer.stamp = { mask: [[true]], x: 40, y: 48, w: 1, h: 1, colorSelection: null };
  LayerManager.cropToCells(2, 3, 10, 10);
  check('a stamp layer keeps its place relative to the picture', layer.stamp.x === 40 - 16 && layer.stamp.y === 48 - 24);
}

summary();
