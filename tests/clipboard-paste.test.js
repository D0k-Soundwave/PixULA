'use strict';
/**
 * Phase 7 quick win 1: system clipboard paste — decode->quantize path.
 *
 * Drives PNGFormat.imageToInkMask() (the per-cell 2-colour quantizer behind
 * blobToInkMask) with synthetic RGBA buffers. The blob-decode and canvas
 * downscale stages need a browser; they are covered by the manual TESTLOG
 * rows. Everything below is pure math.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/palette-ops.js');
loadModule('js/io/png-format.js');

const CS = ZX_SPECTRUM.CELL_SIZE;

/** Build an ImageData-like object from a per-pixel [r,g,b,a] function. */
function makeImage(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return { width: w, height: h, data };
}

const countInk = (mask) => mask.reduce((n, row) => n + row.filter(Boolean).length, 0);

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

// ── Flat cells ─────────────────────────────────────────────────────────────
const flatWhite = PNGFormat.imageToInkMask(makeImage(CS, CS, () => WHITE));
check('flat white cell -> empty mask', countInk(flatWhite.mask) === 0);
check('mask dimensions match input', flatWhite.width === CS && flatWhite.height === CS);

const flatBlack = PNGFormat.imageToInkMask(makeImage(CS, CS, () => BLACK));
check('flat black cell -> solid ink', countInk(flatBlack.mask) === CS * CS);

// ── Black-on-white detail: ink marks the black pixels exactly ──────────────
const logo = PNGFormat.imageToInkMask(makeImage(CS, CS, (x, y) =>
  (x >= 2 && x < 6 && y >= 2 && y < 6) ? BLACK : WHITE));
check('black square on white: 16 ink pixels', countInk(logo.mask) === 16);
check('black square on white: correct placement',
  logo.mask[2][2] && logo.mask[5][5] && !logo.mask[0][0] && !logo.mask[7][7]);

// ── White-on-black: the glyph (less frequent colour) becomes the ink ──────
const glyph = PNGFormat.imageToInkMask(makeImage(CS, CS, (x, y) =>
  (x === 4 && y >= 1 && y < 7) ? WHITE : BLACK));
check('white stroke on black: the stroke is the ink', countInk(glyph.mask) === 6 &&
  glyph.mask[1][4] && glyph.mask[6][4] && !glyph.mask[1][1]);

// ── Colour: red details on white quantize to ink ───────────────────────────
const red = PNGFormat.imageToInkMask(makeImage(CS, CS, (x) =>
  x < 3 ? [215, 0, 0, 255] : WHITE));
check('red-on-white: red pixels are the ink', countInk(red.mask) === 3 * CS &&
  red.mask[0][0] && red.mask[7][2] && !red.mask[0][3]);

// ── Per-cell independence across a multi-cell image ────────────────────────
const twoCells = PNGFormat.imageToInkMask(makeImage(CS * 2, CS, (x) =>
  x < CS ? BLACK : WHITE));
check('two cells: dark cell solid, light cell empty',
  twoCells.mask[0][0] && twoCells.mask[7][7] && !twoCells.mask[0][CS] && !twoCells.mask[7][CS * 2 - 1]);

// ── Transparency composites against white (paper) ──────────────────────────
const transparent = PNGFormat.imageToInkMask(makeImage(CS, CS, (x, y) =>
  (x < 4 && y < 4) ? BLACK : [0, 0, 0, 0]));
check('transparent pixels become paper, opaque black becomes ink',
  countInk(transparent.mask) === 16 && transparent.mask[0][0] && !transparent.mask[7][7]);

// ── Non-cell-aligned sizes: edge clamping, mask stays input-sized ──────────
const odd = PNGFormat.imageToInkMask(makeImage(10, 5, (x, y) =>
  (x + y) === 0 ? BLACK : WHITE));
check('odd size: mask dimensions preserved',
  odd.width === 10 && odd.height === 5 &&
  odd.mask.length === 5 && odd.mask.every(r => r.length === 10));
check('odd size: single dark pixel survives quantization', odd.mask[0][0]);

const oddInkCount = countInk(odd.mask);
check('odd size: no phantom ink outside the dark pixel', oddInkCount === 1);

summary();
