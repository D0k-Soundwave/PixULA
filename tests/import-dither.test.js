'use strict';
/**
 * Batch 8 part 8B step 2: the importer's Dither select. Any Dither method (other than the importer's own Floyd-Steinberg,
 * which stays exactly as it was) turns a cell's shades into dots through Dither.paletteIndices: each pixel sits between
 * its two nearest colours, one Dither.apply per cell, ordered methods anchored at the cell's screen position.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({
  CanvasSystem: { getImageData: () => null },
  LayerManager: { getCurrentLayer: () => null, composeToCanvas: () => {} },
  AttributeSystem: { setCell: () => {} },
  UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
loadModule('js/utils/helpers.js');
loadModule('js/utils/palette-ops.js');
loadModule('js/utils/dither.js');
loadModule('js/utils/giga-quant.js');
loadModule('js/io/png-format.js');

const WHITE = [215, 215, 215], BLACK = [0, 0, 0];
const pair = { ink: 7, paper: 0, bright: false };           // ink white on black paper
const rampCell = (w, h, x0, total) => {                     // grey rises left to right over `total` columns
  const c = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (x0 + x) / (total - 1) * 215;
    const i = (y * w + x) * 3;
    c[i] = c[i + 1] = c[i + 2] = v;
  }
  return c;
};
const bits = (rows, w) => { const out = []; for (const r of rows) for (let x = 0; x < w; x++) out.push((r >> (w - 1 - x)) & 1); return out; };

// -- the legacy paths are untouched ---------------------------------------------------------------------------------
{
  const cell = rampCell(8, 8, 0, 16);
  const fs = PNGFormat._renderCellMask(cell, pair, 'floyd-steinberg');
  check('floyd-steinberg is still the importer\'s own (not a Dither call)', !PNGFormat._isDitherMethod('floyd-steinberg'));
  check('none is not a Dither method', !PNGFormat._isDitherMethod('none'));
  check('unknown ids are not Dither methods', !PNGFormat._isDitherMethod('whatever'));
  check('atkinson is', PNGFormat._isDitherMethod('atkinson'));
  const again = PNGFormat._renderCellMask(cell, pair, 'floyd-steinberg');
  check('legacy rendering unchanged between calls', fs.join() === again.join());
}

// -- ordered methods: exact density ----------------------------------------------------------------------------------
{
  const mid = new Float32Array(8 * 8 * 3).fill(107.5);        // half way between black and white (215)
  for (const id of ['bayer-8', 'cluster-8']) {
    const rows = PNGFormat._renderCellMask(mid, pair, id, 8, 8, 0, 0);
    const ink = bits(rows, 8).reduce((s, v) => s + v, 0);
    check(`${id}: a half grey cell is about half ink`, Math.abs(ink - 32) <= 1, String(ink));
  }
  const dark = new Float32Array(8 * 8 * 3).fill(0), light = new Float32Array(8 * 8 * 3).fill(215);
  const onlyPaper = PNGFormat._renderCellMask(dark, pair, 'bayer-8');
  const onlyInk = PNGFormat._renderCellMask(light, pair, 'bayer-8');
  check('black cell -> all paper, white cell -> all ink (ink is white)', onlyPaper.every(r => r === 0) && onlyInk.every(r => r === 0xFF));
  const t = PNGFormat._renderCellMask(new Float32Array(8 * 8 * 3).fill(100), pair, 'threshold-50');
  const t2 = PNGFormat._renderCellMask(new Float32Array(8 * 8 * 3).fill(110), pair, 'threshold-50');
  check('threshold 50: below the middle of the pair is paper, above is ink', t.every(r => r === 0) && t2.every(r => r === 0xFF));
  const same = PNGFormat._renderCellMask(new Float32Array(8 * 8 * 3).fill(50), { ink: 3, paper: 3, bright: false }, 'bayer-4');
  check('ink === paper: all ink, as the legacy tie rule', same.every(r => r === 0xFF));
}

// -- the screen continues across cells (origin) -----------------------------------------------------------------------
{
  const W = 16, H = 8;
  const full = new Float32Array(W * H * 3);
  const left = rampCell(8, 8, 0, 16), right = rampCell(8, 8, 8, 16);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const v = x / 15 * 215, i = (y * 16 + x) * 3;
    full[i] = full[i + 1] = full[i + 2] = v;
  }
  for (const id of ['cluster-5x3', 'cross-3x3', 'supercell-cross-3x3', 'bayer-4']) {
    const a = bits(PNGFormat._renderCellMask(left, pair, id, 8, 8, 0, 0), 8);
    const b = bits(PNGFormat._renderCellMask(right, pair, id, 8, 8, 8, 0), 8);
    const rows = Dither.paletteIndices(full, [WHITE, BLACK], id, W, H, 0, 0);
    let bad = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
      const want = rows[y * 16 + x] === 0 ? 1 : 0;
      const got = x < 8 ? a[y * 8 + x] : b[y * 8 + x - 8];
      if (want !== got) bad++;
    }
    check(`${id}: two cells with their origins equal one render across both`, bad === 0, `${bad} differ`);
  }
  const noOrigin = bits(PNGFormat._renderCellMask(right, pair, 'cluster-5x3', 8, 8), 8);
  const withOrigin = bits(PNGFormat._renderCellMask(right, pair, 'cluster-5x3', 8, 8, 8, 0), 8);
  check('without the origin a 5-wide pattern would restart at the cell (so the origin matters)', noOrigin.join() !== withOrigin.join());
}

// -- diffusion stays inside the cell -----------------------------------------------------------------------------------
{
  const cell = rampCell(8, 8, 0, 16);
  for (const id of ['atkinson', 'stucki', 'park-kang-kim', 'sierra-lite']) {
    const rows = PNGFormat._renderCellMask(cell, pair, id, 8, 8, 0, 0);
    const n = bits(rows, 8).reduce((s, v) => s + v, 0);
    check(`${id}: a left-dark right-light ramp has ink on the light side`, n > 8 && n < 56, String(n));
  }
}

// -- GigaScreen slots -------------------------------------------------------------------------------------------------------
{
  const pick = GigaQuant.hiresPick(0, 1);
  const cell = rampCell(8, 8, 0, 16);
  const none = GigaQuant.renderCell(cell, pick, 'none', 8, 8);
  const bayer = GigaQuant.renderCell(cell, pick, 'bayer-8', 8, 8, undefined, 0, 0);
  check('a Dither method on the slots gives rows and slots of the right size', bayer.pixelsA.length === 8 && bayer.slots.length === 64);
  check('...every slot used is a steady one', Array.from(bayer.slots).every(s => bayer.slotRGB[s]));
  check('...and it differs from no dithering', bayer.slots.join() !== none.slots.join());
  const again = GigaQuant.renderCell(cell, pick, 'bayer-8', 8, 8, undefined, 0, 0);
  check('...deterministically', again.slots.join() === bayer.slots.join());
  const fs = GigaQuant.renderCell(cell, pick, 'floyd-steinberg', 8, 8);
  check('floyd-steinberg on the slots is still its own path', fs.slots.join() !== bayer.slots.join());
}

// -- the preview renderer: Smooth takes the chosen method, Sharp and Flat do not ------------------------------------------
{
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
  const img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, v = Math.round(x / (W - 1) * 255);
    img.data[o] = v; img.data[o + 1] = 255 - v; img.data[o + 2] = (v * 3) & 255; img.data[o + 3] = 255;
  }
  const render = PNGFormat.previewRenderer(img, 'fit');
  const eq = (a, b) => a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);
  const smoothDefault = render('smooth');
  const smoothFS = render('smooth', 'floyd-steinberg');
  const smoothBayer = render('smooth', 'bayer-8');
  check('Smooth with no method is Floyd-Steinberg, byte for byte', eq(smoothDefault, smoothFS));
  check('Smooth with Bayer 8 differs from Floyd-Steinberg', !eq(smoothFS, smoothBayer));
  check('Flat ignores the method (no dithering)', eq(render('flat'), render('flat', 'bayer-8')));
  check('Sharp ignores the method', eq(render('sharp'), render('sharp', 'atkinson')));
  check('the preview with a method is deterministic', eq(smoothBayer, render('smooth', 'bayer-8')));
}

summary();
