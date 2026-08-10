'use strict';
/**
 * BrushShapes — the app's only definition of brush geometry (js/utils/brush-shapes.js).
 *
 * Two things went wrong before this module existed, and both are pinned here:
 *
 *   1. The round brush culled at `floor(size/2) - 0.5`, which makes sizes 2k
 *      and 2k+1 produce byte-identical masks — half of a 32-step slider did
 *      nothing, and sizes 1, 2 and 3 were all a single pixel. Meanwhile the
 *      eraser culled at `floor(size/2)`, so "size 8" meant 37 pixels in one
 *      place and 49 in another.
 *   2. The Stipple and Spray brushes were the same brush: same disc, same
 *      per-stamp re-randomisation, dot counts within 8%. Their only real
 *      difference was the radial distribution, which is now `weighting`.
 *
 * Pure math, no DOM — loads the module standalone.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/utils/helpers.js');
loadModule('js/utils/brush-shapes.js');

const SIZES = Array.from({ length: 32 }, (_, i) => i + 1);
const sig = mask => mask.map(r => r.join('')).join('/');
const count = mask => mask.reduce((n, row) => n + row.filter(v => v > 0).length, 0);

// ── disc(): every slider step must mean something ──────────────────────────

let increasing = true, prev = 0;
const seen = new Map();
let duplicate = null;

for (const size of SIZES) {
  const mask = BrushShapes.disc(size);
  const n = count(mask);

  if (n <= prev) increasing = false;
  prev = n;

  const key = sig(mask);
  if (seen.has(key)) duplicate = `${size} == ${seen.get(key)}`;
  seen.set(key, size);
}

check('disc: pixel count strictly increases across sizes 1..32', increasing);
check(`disc: no two sizes share a mask${duplicate ? ' (' + duplicate + ')' : ''}`, duplicate === null);

check('disc: size 1 is exactly one pixel (the pencil)',
  count(BrushShapes.disc(1)) === 1 && BrushShapes.disc(1)[0][0] === 1);

check('disc: masks are size x size', SIZES.every(s => {
  const m = BrushShapes.disc(s);
  return m.length === s && m.every(row => row.length === s);
}));

check('disc: every mask is symmetric under both flips', SIZES.every(s => {
  const m = BrushShapes.disc(s);
  const flipX = m.map(row => [...row].reverse());
  const flipY = [...m].reverse();
  return sig(flipX) === sig(m) && sig(flipY) === sig(m);
}));

check('disc: the mask fits inside its box (no clipped row or column)', SIZES.every(s => {
  const m = BrushShapes.disc(s);
  return m.every(row => row.length === s);
}));

// A disc is not a square: past the sizes where they must coincide, the corners
// are gone. (Sizes 1-3 are degenerate — a pixel, a 2x2 and a plus.)
check('disc: corners are cut for size >= 4',
  SIZES.filter(s => s >= 4).every(s => {
    const m = BrushShapes.disc(s);
    return m[0][0] === 0 && m[s - 1][s - 1] === 0;
  }));

check('discOffsets: same cells as disc(), centred on floor(size/2)', SIZES.every(s => {
  const offsets = BrushShapes.discOffsets(s);
  const c = Math.floor(s / 2);
  const rebuilt = BrushShapes.disc(s).map(row => row.map(() => 0));
  for (const o of offsets) rebuilt[o.dy + c][o.dx + c] = 1;
  return sig(rebuilt) === sig(BrushShapes.disc(s));
}));

check('square: solid size x size', SIZES.every(s => count(BrushShapes.square(s)) === s * s));

check('boxOffsets: the whole box, centred', SIZES.every(s =>
  BrushShapes.boxOffsets(s).length === s * s));

// ── radiusFor(): the quarter-pixel inset that makes size 1 a pencil ────────

check('radiusFor: size 1 stays inside the rounding threshold (< 0.5)',
  BrushShapes.radiusFor(1) < 0.5);
check('radiusFor: grows by exactly half a pixel per step',
  SIZES.slice(1).every(s =>
    Math.abs((BrushShapes.radiusFor(s) - BrushShapes.radiusFor(s - 1)) - 0.5) < 1e-9));

// ── weightExponent(): the retired Stipple / Spray difference, as a dial ────

check('weightExponent: 0 is the even (equal-area) exponent 0.5',
  Math.abs(BrushShapes.weightExponent(0) - 0.5) < 1e-9);
check('weightExponent: +100 is the historical centre-heavy spray (1.0)',
  Math.abs(BrushShapes.weightExponent(100) - 1.0) < 1e-9);
check('weightExponent: -100 biases to the rim (0.25)',
  Math.abs(BrushShapes.weightExponent(-100) - 0.25) < 1e-9);
check('weightExponent: out-of-range values clamp',
  BrushShapes.weightExponent(1e6) === BrushShapes.weightExponent(100) &&
  BrushShapes.weightExponent(-1e6) === BrushShapes.weightExponent(-100));

// ── scatterPoints(): the sampler ───────────────────────────────────────────

check('scatterPoints: places exactly the requested particle count',
  BrushShapes.scatterPoints(8, 0, 37).length === 37);
check('scatterPoints: a count of 0 places nothing',
  BrushShapes.scatterPoints(8, 0, 0).length === 0);
check('scatterPoints: integer offsets only',
  BrushShapes.scatterPoints(9.5, 0, 200).every(p =>
    Number.isInteger(p.dx) && Number.isInteger(p.dy)));

// The rng is injectable so the extremes are checkable exactly rather than
// statistically: u = 0 puts a particle at the centre, u -> 1 at the rim.
const fixed = (...values) => { let i = 0; return () => values[i++ % values.length]; };
check('scatterPoints: u = 0 lands on the centre for any weighting',
  [-100, 0, 100].every(w =>
    BrushShapes.scatterPoints(16, w, 1, fixed(0, 0))[0].dx === 0));

// Radius 0.25 (a size-1 brush) can never round off the centre pixel — this is
// the geometric half of the size-1 invariant.
check('scatterPoints: at a size-1 radius every particle is the centre pixel',
  BrushShapes.scatterPoints(BrushShapes.radiusFor(1), 0, 500)
    .every(p => p.dx === 0 && p.dy === 0));

// ── The weighting actually moves the ink ───────────────────────────────────

const meanRadius = (weighting) => {
  const pts = BrushShapes.scatterPoints(16, weighting, 20000);
  return pts.reduce((s, p) => s + Math.hypot(p.dx, p.dy), 0) / pts.length;
};
const rim = meanRadius(-100), even = meanRadius(0), centre = meanRadius(100);

check(`weighting: -100 spreads wider than even (${rim.toFixed(2)} > ${even.toFixed(2)})`, rim > even);
check(`weighting: +100 piles toward the centre (${centre.toFixed(2)} < ${even.toFixed(2)})`, centre < even);
// Even weighting = equal ink per unit area, so the mean radius of a uniform
// disc: 2R/3 = 10.67 for R = 16. This is the property the old Stipple brush had
// and the old Spray brush did not.
check(`weighting: even matches the uniform-disc mean radius 2R/3 (${even.toFixed(2)} ~ 10.67)`,
  Math.abs(even - (2 * 16 / 3)) < 0.4);

// ── scatterEnvelope(): the outline the sampler may never escape ────────────

for (const radius of [0.25, 0.75, 4, 8.75, 16]) {
  const envelope = new Set(BrushShapes.scatterEnvelope(radius).map(o => o.dx + ',' + o.dy));
  let escaped = null;

  for (const w of [-100, 0, 100]) {
    for (const p of BrushShapes.scatterPoints(radius, w, 4000)) {
      const key = p.dx + ',' + p.dy;
      if (!envelope.has(key)) escaped = `${key} (weighting ${w})`;
    }
  }
  check(`scatterEnvelope: radius ${radius} contains every particle${escaped ? ' — escaped ' + escaped : ''}`,
    escaped === null);
}

check('scatterEnvelope: a sub-half-pixel radius is just the centre cell',
  BrushShapes.scatterEnvelope(0.25).length === 1);

// Rounding gains at most half a pixel per axis, so the envelope is wider than
// the naive disc — the reason it is computed rather than reused.
check('scatterEnvelope: wider than the naive dx^2+dy^2 <= r^2 disc',
  BrushShapes.scatterEnvelope(4).some(o => o.dx * o.dx + o.dy * o.dy > 16));

summary();
