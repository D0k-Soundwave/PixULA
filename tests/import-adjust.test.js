'use strict';
/**
 * Phase 8: Import Conversion dialog pixel math (PNGFormat, pure paths).
 *
 * applyBrightnessContrast: identity, additive brightness, midpoint-anchored
 * contrast, clamping, alpha preservation, input immutability.
 * quantizeForPreview: a screen-sized input skips canvas scaling entirely, so
 * the full quantize->RGBA path runs headless; output must be ZX palette
 * colours honouring the per-cell 2-colour constraint.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({
  CanvasSystem: { getImageData: () => null },
  LayerManager: { getCurrentLayer: () => null, composeToCanvas: () => {} },
  AttributeSystem: { setCell: () => {} },
  UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
loadModule('js/utils/palette-ops.js');
loadModule('js/io/png-format.js');

const img = (w, h, fill) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3] ?? 255;
  }
  return { width: w, height: h, data };
};

// ── applyBrightnessContrast ────────────────────────────────────────────────
const mid = img(2, 2, [100, 150, 200, 128]);

let out = PNGFormat.applyBrightnessContrast(mid, 0, 0);
check('adjust: 0/0 is identity',
  out.data[0] === 100 && out.data[1] === 150 && out.data[2] === 200);
check('adjust: alpha preserved', out.data[3] === 128);
check('adjust: input not mutated', mid.data[0] === 100);

out = PNGFormat.applyBrightnessContrast(mid, 50, 0);
check('adjust: +50 brightness lifts channels by ~63 (clamped at 255)',
  Math.abs(out.data[0] - 163.5) <= 0.5 && out.data[2] === 255);

out = PNGFormat.applyBrightnessContrast(mid, -50, 0);
check('adjust: -50 brightness lowers channels', out.data[0] < 100 && out.data[2] < 200);

out = PNGFormat.applyBrightnessContrast(img(1, 1, [250, 250, 250]), 100, 0);
check('adjust: +100 brightness clamps at 255', out.data[0] === 255);

// Contrast is anchored at 128: values above rise, below fall, 128 fixed
const tri = { width: 3, height: 1, data: new Uint8ClampedArray([
  50, 50, 50, 255,  128, 128, 128, 255,  200, 200, 200, 255]) };
out = PNGFormat.applyBrightnessContrast(tri, 0, 50);
check('adjust: +contrast pushes darks darker', out.data[0] < 50);
check('adjust: +contrast keeps the 128 midpoint', out.data[4] === 128);
check('adjust: +contrast pushes lights lighter', out.data[8] > 200);

out = PNGFormat.applyBrightnessContrast(tri, 0, -100);
check('adjust: -100 contrast collapses toward the midpoint',
  Math.abs(out.data[0] - 128) < 3 && Math.abs(out.data[8] - 128) < 3);

check('adjust: brightness clamps out-of-range args', (() => {
  const a = PNGFormat.applyBrightnessContrast(mid, 250, 0);
  const b = PNGFormat.applyBrightnessContrast(mid, 100, 0);
  return a.data[0] === b.data[0];
})());

// ── quantizeForPreview (pure path: input already at screen size) ──────────
const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

// Left half pure red (215), right half pure white (215) — bank-0 exact hits
const half = img(W, H, [215, 215, 215]);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W / 2; x++) {
    const o = (y * W + x) * 4;
    half.data[o] = 215; half.data[o + 1] = 0; half.data[o + 2] = 0;
  }
}
const q = PNGFormat.quantizeForPreview(half, { dithering: 'none' });
check('preview: output is full-screen RGBA',
  q.width === W && q.height === H && q.data.length === W * H * 4);

const px = (x, y) => { const o = (y * W + x) * 4; return [q.data[o], q.data[o + 1], q.data[o + 2], q.data[o + 3]]; };
check('preview: left half quantizes to ZX red',
  JSON.stringify(px(10, 10)) === JSON.stringify([215, 0, 0, 255]));
check('preview: right half quantizes to ZX white',
  JSON.stringify(px(W - 10, 10)) === JSON.stringify([215, 215, 215, 255]));

// Every 8×8 cell may contain at most 2 distinct colours (ZX attribute rule)
let maxColours = 0;
for (let cy = 0; cy < H / 8; cy++) {
  for (let cx = 0; cx < W / 8; cx++) {
    const seen = new Set();
    for (let dy = 0; dy < 8; dy++) {
      for (let dx = 0; dx < 8; dx++) {
        seen.add(px(cx * 8 + dx, cy * 8 + dy).join(','));
      }
    }
    maxColours = Math.max(maxColours, seen.size);
  }
}
check('preview: every cell honours the 2-colour constraint', maxColours <= 2);

// Every output pixel is an exact ZX palette colour
const palette = new Set(ZX_PALETTE_RGB.map(rgb => `${rgb[0]},${rgb[1]},${rgb[2]}`));
let offPalette = 0;
for (let i = 0; i < q.data.length; i += 4) {
  if (!palette.has(`${q.data[i]},${q.data[i + 1]},${q.data[i + 2]}`)) offPalette++;
}
check('preview: all pixels are ZX palette colours', offPalette === 0);

// Brightness feeds through to the quantizer (dark grey -> black vs lifted -> white)
const grey = img(W, H, [80, 80, 80]);
const dark = PNGFormat.quantizeForPreview(grey, { dithering: 'none' });
const lifted = PNGFormat.quantizeForPreview(
  PNGFormat.applyBrightnessContrast(grey, 80, 0), { dithering: 'none' });
check('preview: brightness shifts the quantized result',
  dark.data[0] === 0 && lifted.data[0] > 0);

summary();
