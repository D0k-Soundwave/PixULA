'use strict';
/**
 * Single-screen Timex hi-res import (review of Batch 8 part 8B): the mode ignores cell attributes and draws every bit with
 * the screen-wide scheme (ink n on paper n ^ 7, both bright). The importer chose a ZX pair per cell instead and set the
 * bit for "its" ink, so a cell whose majority colour sat on the scheme's ink side came out inverted, and the preview
 * (painted with the per-cell pair) did not show it. Both now decide the dots against the scheme pair.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const written = [];
installStubs({
  CanvasSystem: { getImageData: () => null },
  LayerManager: { getCurrentLayer: () => ({ setCell: (x, y, c) => written.push({ x, y, c }), getCell: () => null }), composeToCanvas: () => {} },
  AttributeSystem: { setCell: () => {} },
  UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
loadModule('js/utils/helpers.js');
loadModule('js/utils/palette-ops.js');
loadModule('js/utils/dither.js');
loadModule('js/utils/giga-quant.js');
loadModule('js/io/png-format.js');
global.ColorManager = { getTimexHiresInk: () => 0, getStandardColoursRGB: null };
__setActiveScreenMode('timex_hires');

const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
// every cell: its left 5 columns black, right 3 columns white (black is the majority)
const img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4, v = (x % 8) < 5 ? 0 : 255;
  img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
}
PNGFormat._applyToLayer(img, 'none', null);
const cell = written[0].c;
check('the importer wrote cells', written.length === (W / 8) * (H / 8), String(written.length));
check('the scheme ink (black) pixels carry the 1 bit: columns 0-4 of every row', cell.pixels.every(r => r === 0b11111000), cell.pixels.join());
check('the cell attributes are the scheme pair (ink 0 on paper 7, bright)', cell.ink === 0 && cell.paper === 7 && cell.bright === true);

const out = PNGFormat.previewRenderer(img, 'fit')('flat');
const px = (x, y) => { const o = (y * W + x) * 4; return [out.data[o], out.data[o + 1], out.data[o + 2]].join(); };
check('the preview shows black where the imported bit says ink', px(0, 0) === '0,0,0' && px(7, 0) === '255,255,255', px(0, 0) + ' / ' + px(7, 0));

summary();
