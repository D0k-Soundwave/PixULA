'use strict';
/**
 * PaletteOps — the palette generators, which had no suite until the palette
 * editor grew buttons that call them directly.
 *
 * Two jobs are checked here. `rampRGB` is the shading tool and is pure
 * arithmetic, so it is checked exactly: the ends are the ends, the spacing is
 * even, and a ramp of two is just its endpoints. The image builders are
 * heuristics — median cut and k-means have no single right answer — so they are
 * checked for the properties that would make them WRONG rather than merely
 * different: right length, every entry a legal register for its mode, an image
 * of one colour producing that colour, and the reserved parts of the Next
 * register file left where the documented defaults put them.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/palette-ops.js');

/** An ImageData-shaped block of one flat colour. */
function flat(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

/** Vertical bands of the given colours, left to right. */
function bands(w, h, colours) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = colours[Math.min(colours.length - 1, Math.floor(x / (w / colours.length)))];
      const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

// ── rampRGB ─────────────────────────────────────────────────────────────────

const black = [0, 0, 0], white = [255, 255, 255];

const eight = PaletteOps.rampRGB(black, white, 8);
check('a ramp produces exactly the number of colours asked for', eight.length === 8);
check('it starts at the first colour', JSON.stringify(eight[0]) === JSON.stringify(black));
check('and ends at the second', JSON.stringify(eight[7]) === JSON.stringify(white));

check('the steps are even', (() => {
  // Even to within the rounding: consecutive gaps differ by at most 1
  const gaps = [];
  for (let i = 1; i < eight.length; i++) gaps.push(eight[i][0] - eight[i - 1][0]);
  return Math.max(...gaps) - Math.min(...gaps) <= 1;
})(), JSON.stringify(eight.map(c => c[0])));

check('it is monotonic — a ramp that doubles back is not a ramp',
  eight.every((c, i) => i === 0 || c[0] >= eight[i - 1][0]));

check('each channel ramps independently', (() => {
  const r = PaletteOps.rampRGB([255, 0, 128], [0, 255, 128], 5);
  return r[0][0] === 255 && r[4][0] === 0 &&
         r[0][1] === 0 && r[4][1] === 255 &&
         r.every(c => c[2] === 128);   // a channel that does not move, does not
})());

check('a ramp of two is just its endpoints', (() => {
  const r = PaletteOps.rampRGB(black, white, 2);
  return r.length === 2 && r[0][0] === 0 && r[1][0] === 255;
})());
check('a ramp of one is the start colour, not a crash',
  JSON.stringify(PaletteOps.rampRGB(black, white, 1)) === JSON.stringify([black]));
check('a nonsense length is treated as one rather than producing nothing',
  PaletteOps.rampRGB(black, white, 0).length === 1 &&
  PaletteOps.rampRGB(black, white, -5).length === 1);

check('the ramp runs downhill as readily as up', (() => {
  const r = PaletteOps.rampRGB(white, black, 4);
  return r[0][0] === 255 && r[3][0] === 0 && r[1][0] > r[2][0];
})());

// ── buildUlaplusRegisters ───────────────────────────────────────────────────

const ulaFlat = PaletteOps.buildUlaplusRegisters(flat(64, 64, 255, 0, 0));
check('a ULAplus palette is 64 registers', ulaFlat.length === 64);
check('every ULAplus register is a byte',
  ulaFlat.every(v => Number.isInteger(v) && v >= 0 && v <= 255));
check('a flat red image puts red in the palette', (() => {
  for (const reg of ulaFlat) {
    const [r, g, b] = ULAPLUS.registerToRGB(reg);
    if (r > 200 && g < 60 && b < 60) return true;
  }
  return false;
})());

// ── buildNextRegisters ──────────────────────────────────────────────────────

const nextFlat = PaletteOps.buildNextRegisters(flat(64, 64, 0, 255, 0), 16);
check('a Next register file is always 256 entries, whatever the window',
  nextFlat.length === 256);
check('every Next register fits in 9 bits',
  Array.from(nextFlat).every(v => Number.isInteger(v) && v >= 0 && v <= 511));

check('a flat green image puts green in the window', (() => {
  for (let i = 0; i < 16; i++) {
    const [r, g, b] = NEXTRGB333.registerToRGB(nextFlat[i]);
    if (g > 200 && r < 60 && b < 60) return true;
  }
  return false;
})());

check('entries outside the window keep the documented defaults', (() => {
  const defaults = NEXTRGB333.defaultRegisters();
  for (let i = 16; i < 256; i++) if (nextFlat[i] !== defaults[i]) return false;
  return true;
})());

check('a multi-colour image spreads across the window rather than collapsing', (() => {
  const regs = PaletteOps.buildNextRegisters(
    bands(64, 16, [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]]), 16);
  const distinct = new Set();
  for (let i = 0; i < 16; i++) distinct.add(regs[i]);
  return distinct.size >= 4;
})());

check('an empty image is survived rather than crashed on',
  PaletteOps.buildNextRegisters(flat(0, 0, 0, 0, 0), 16).length === 256);

// ── medianCut, the shared engine ────────────────────────────────────────────

check('median cut returns at most the count asked for',
  PaletteOps.medianCut([[0, 0, 0], [255, 255, 255], [128, 128, 128]], 2).length <= 2);
check('and at least one colour even from a single pixel',
  PaletteOps.medianCut([[10, 20, 30]], 4).length >= 1);

summary();
