'use strict';
/**
 * CoverageOps - the coverage domain and its two boundary functions.
 *
 * A coverage buffer holds, per output pixel, the FRACTION of that pixel the
 * source covers. It exists because thresholding to 1 bit early and then
 * resampling the binary result destroys information no later step can
 * recover: measured, the finest possible resample of an already-thresholded
 * raster scores 0.311 where the crudest scores 0.309 (see
 * docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md).
 *
 * Float32Array rather than number[][] because a 640x256 stamp rotated is
 * ~393k output pixels, and this buffer is built and discarded on a slider.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

// MaskOps too: every effect below must agree exactly with its boolean twin on
// a 1-bit input, which is what makes it safe to move the stamp chain into the
// domain without changing what anything looks like.
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');

const T = true, F = false;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- constants carry their measured justification (spec section 6) ----------
check('SUPERSAMPLE is 8 - ss=4 measures below the shipped chain on 1-bit',
  CoverageOps.SUPERSAMPLE === 8);
check('INK_COVERAGE is 0.50 - the unbiased cut, for exact-area 1-bit sources',
  CoverageOps.INK_COVERAGE === 0.50);
// A glyph is a different problem: its legibility rides on strokes thinner than
// a pixel, which an unbiased half-coverage test drops. Calibrated across six
// faces at 12/16/24px - total error 25 at 0.25, 20 at 0.30, 24 at 0.35, 41 at
// 0.40, 89 at 0.50.
check('GLYPH_COVERAGE is 0.30, biased toward ink, and BELOW INK_COVERAGE',
  CoverageOps.GLYPH_COVERAGE === 0.30 &&
  CoverageOps.GLYPH_COVERAGE < CoverageOps.INK_COVERAGE);

// -- create ----------------------------------------------------------------
const blank = CoverageOps.create(3, 2);
check('create: dimensions', blank.w === 3 && blank.h === 2);
check('create: Float32Array of w*h', blank.data instanceof Float32Array && blank.data.length === 6);
check('create: starts empty', CoverageOps.area(blank) === 0);
check('size: mirrors MaskOps.size', eq(CoverageOps.size(blank), { w: 3, h: 2 }));

// -- fromMask / toMask round trip -------------------------------------------
const mask = [[T, T, F], [F, F, T]];
const cov = CoverageOps.fromMask(mask);
check('fromMask: dimensions follow the mask', cov.w === 3 && cov.h === 2);
check('fromMask: set pixels are fully covered, clear ones not at all',
  CoverageOps.get(cov, 0, 0) === 1 && CoverageOps.get(cov, 2, 0) === 0);
check('fromMask -> toMask is the identity at any threshold in (0, 1]',
  eq(CoverageOps.toMask(cov, 0.01), mask) &&
  eq(CoverageOps.toMask(cov, 0.50), mask) &&
  eq(CoverageOps.toMask(cov, 1.00), mask));

// -- toMask thresholds, and defaults to INK_COVERAGE ------------------------
const partial = CoverageOps.create(2, 1);
partial.data[0] = 0.49;
partial.data[1] = 0.50;
check('toMask: >= threshold inks, < threshold does not',
  eq(CoverageOps.toMask(partial, 0.5), [[F, T]]));
check('toMask: default threshold is INK_COVERAGE',
  eq(CoverageOps.toMask(partial), CoverageOps.toMask(partial, CoverageOps.INK_COVERAGE)));

// -- area is the CONTINUOUS ink, which a threshold can destroy --------------
// A 25% field thresholds to nothing while still carrying real ink. That is
// the whole reason area() exists rather than counting the thresholded mask.
const sparse = CoverageOps.create(4, 4);
sparse.data.fill(0.25);
check('area: sums coverage, not inked pixels', Math.abs(CoverageOps.area(sparse) - 4) < 1e-6);
check('area: a sparse field thresholds to nothing but is NOT empty',
  CoverageOps.toMask(sparse, 0.5).every(r => r.every(v => v === false)) &&
  CoverageOps.area(sparse) > 0);

// -- bounds safety ----------------------------------------------------------
check('get: outside the buffer reads 0',
  CoverageOps.get(cov, -1, 0) === 0 && CoverageOps.get(cov, 0, -1) === 0 &&
  CoverageOps.get(cov, 3, 0) === 0 && CoverageOps.get(cov, 0, 2) === 0);
check('fromMask/toMask: empty input is safe',
  eq(CoverageOps.toMask(CoverageOps.fromMask([])), []));

// -- boxFor / transform ------------------------------------------------------
check('boxFor: identity leaves the box alone',
  eq(CoverageOps.boxFor(8, 4, {}), { w: 8, h: 4 }));
check('boxFor: scale multiplies', eq(CoverageOps.boxFor(8, 4, { scaleX: 2, scaleY: 3 }), { w: 16, h: 12 }));
check('boxFor: a quarter turn swaps the axes',
  eq(CoverageOps.boxFor(8, 4, { degrees: 90 }), { w: 4, h: 8 }));

// A solid block is the clearest subject: every interior pixel is fully covered
// whatever the transform does, so a wrong inverse map shows as lost area.
const solid = CoverageOps.fromMask(Array.from({ length: 6 }, () => new Array(10).fill(T)));

const ident = CoverageOps.transform(solid, {}, CoverageOps.boxFor(10, 6, {}));
check('transform: identity is a faithful copy',
  eq(CoverageOps.toMask(ident), CoverageOps.toMask(solid)));

const scaled = CoverageOps.transform(solid, { scaleX: 2, scaleY: 2 },
  CoverageOps.boxFor(10, 6, { scaleX: 2, scaleY: 2 }));
check('transform: doubling doubles the box', scaled.w === 20 && scaled.h === 12);
check('transform: doubling a solid block quadruples its area',
  Math.abs(CoverageOps.area(scaled) / CoverageOps.area(solid) - 4) < 0.1);

const turned = CoverageOps.transform(solid, { degrees: 90 }, CoverageOps.boxFor(10, 6, { degrees: 90 }));
check('transform: a quarter turn swaps the box', turned.w === 6 && turned.h === 10);
check('transform: a quarter turn conserves area',
  Math.abs(CoverageOps.area(turned) - CoverageOps.area(solid)) < 0.5);

// THE point of the domain: a shrink that a threshold would erase still carries
// its ink. A grid of single pixels at quarter scale covers 1/16 of each output
// pixel - nothing survives a 0.50 cut, and the DENSITY is still right.
//
// Area is measured in output-pixel units, so it scales with the output box
// rather than being conserved outright: 16 dots at 1/16 of a pixel each is an
// area of 1, not 16. The invariant is area * scaleX * scaleY.
const dotGrid = CoverageOps.fromMask(Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => (x % 4 === 0 && y % 4 === 0))));
const shrunk = CoverageOps.transform(dotGrid, { scaleX: 0.25, scaleY: 0.25 },
  CoverageOps.boxFor(16, 16, { scaleX: 0.25, scaleY: 0.25 }));
check('transform: a shrink preserves DENSITY even where the threshold empties it',
  CoverageOps.toMask(shrunk).every(r => r.every(v => !v)) &&
  Math.abs(CoverageOps.area(shrunk) - CoverageOps.area(dotGrid) * 0.25 * 0.25) < 0.2);

check('transform: an empty buffer is safe',
  CoverageOps.transform(CoverageOps.create(0, 0), {}, { w: 0, h: 0 }).data.length === 0);


// -- warp --------------------------------------------------------------------
// The nine effects mirror SelectionService._applyWarpEffect's inverse maps
// exactly - this is a coverage TWIN of that function, not a second
// implementation of the geometry, so any disagreement in the bench is about
// sampling and never about a different curve.
const warpBlock = CoverageOps.fromMask(
  Array.from({ length: 12 }, () => new Array(24).fill(T)));

const EFFECTS = ['arch-up', 'arch-down', 'wave', 'flag', 'slant-right',
  'slant-left', 'inflate', 'perspective-top', 'perspective-bottom'];

check('warp: an unknown effect is a copy',
  eq(CoverageOps.toMask(CoverageOps.warp(warpBlock, 'nope')), CoverageOps.toMask(warpBlock)));

check('warp: every effect returns a non-empty buffer and keeps ink',
  EFFECTS.every((e) => {
    const w = CoverageOps.warp(warpBlock, e);
    return w.w > 0 && w.h > 0 && CoverageOps.area(w) > 0;
  }));

// The six that grow the canvas must actually grow it, or content clips.
check('warp: arch and wave grow the height, slants grow the width', (() => {
  const base = CoverageOps.size(warpBlock);
  const taller = ['arch-up', 'arch-down', 'wave', 'flag']
    .every((e) => CoverageOps.warp(warpBlock, e).h > base.h);
  const wider = ['slant-right', 'slant-left']
    .every((e) => CoverageOps.warp(warpBlock, e).w > base.w);
  return taller && wider;
})());

check('warp: intensity 0 leaves an arch flat', (() => {
  const flat = CoverageOps.warp(warpBlock, 'arch-up', 0);
  return flat.h === warpBlock.h && flat.w === warpBlock.w;
})());

// The point of doing it in coverage: a stretch thins the ink rather than
// deleting it. Under 'inflate' the centre magnifies and the edges compress,
// and the total area must stay close to what went in.
check('warp: inflate keeps most of the area rather than dropping it', (() => {
  const w = CoverageOps.warp(warpBlock, 'inflate');
  const ratio = CoverageOps.area(w) / CoverageOps.area(warpBlock);
  return ratio > 0.85 && ratio < 1.15;
})());

check('warp: an empty buffer is safe',
  CoverageOps.warp(CoverageOps.create(0, 0), 'wave').data.length === 0);


// -- effects in the domain ---------------------------------------------------
const fxMask = [[T, T, F], [F, F, T]];
const fxCov = CoverageOps.fromMask(fxMask);

check('flipH: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.flipH(fxCov)), MaskOps.flipH(fxMask)));
check('flipV: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.flipV(fxCov)), MaskOps.flipV(fxMask)));
check('shadow: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.shadow(fxCov, 1, 1)), MaskOps.shadow(fxMask, 1, 1)));
check('outline: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.outline(fxCov)), MaskOps.outline(fxMask)));

// Partial coverage is where they must differ: a boolean OR cannot express
// "half covered", and keeping the fraction is the whole point.
const halfCov = CoverageOps.create(2, 1);
halfCov.data[0] = 0.4;
check('shadow: takes the MAX of glyph and shadow, not a boolean OR', (() => {
  const sh2 = CoverageOps.shadow(halfCov, 1, 0);
  return Math.abs(CoverageOps.get(sh2, 0, 0) - 0.4) < 1e-6 &&
         Math.abs(CoverageOps.get(sh2, 1, 0) - 0.4) < 1e-6;
})());

check('process: mirrors run FIRST, then outline, then shadow', (() => {
  const manual = CoverageOps.shadow(
    CoverageOps.outline(CoverageOps.flipV(CoverageOps.flipH(fxCov))), 1, 1);
  const viaProcess = CoverageOps.process(fxCov,
    { mirrorH: true, mirrorV: true, outline: true, shadow: true, shadowOffset: 1 });
  return eq(CoverageOps.toMask(viaProcess), CoverageOps.toMask(manual));
})());
check('process: no options is a faithful copy',
  eq(CoverageOps.toMask(CoverageOps.process(fxCov, {})), fxMask));
// Rotation belongs to transform(). Doing it here as well is the double-turn
// the vector half already had to guard against with `rotationApplied`.
check('process: IGNORES direction - rotation belongs to transform()',
  eq(CoverageOps.toMask(CoverageOps.process(fxCov, { direction: 90 })), fxMask));


// -- local tone correction ---------------------------------------------------
check('TONE_WINDOW is 8 - a 16px window leaves visible blocky seams',
  CoverageOps.TONE_WINDOW === 8);
check('TONE_TOLERANCE is 0.10', CoverageOps.TONE_TOLERANCE === 0.10);

// A LETTERFORM: interior fully covered, background empty. The threshold loses
// no tone, so the rule must not fire - measured on the bench's glyph suite it
// matches plain coverage to three decimals, and that no-op is what makes it
// safe to apply everywhere.
const shape = CoverageOps.create(16, 16);
for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) shape.data[y * 16 + x] = 1;
check('toneCorrect: a solid shape is untouched - the threshold lost no tone',
  eq(CoverageOps.toMaskToned(shape), CoverageOps.toMask(shape)));

// A DITHER FIELD: 0.25 everywhere. A plain threshold empties it; the rule must
// put the tone back.
const field = CoverageOps.create(16, 16);
field.data.fill(0.25);
check('toneCorrect: a plain threshold deletes a 25% field',
  CoverageOps.toMask(field).every(r => r.every(v => !v)));
const toned = CoverageOps.toMaskToned(field);
const tonedInk = toned.reduce((n, r) => n + r.filter(Boolean).length, 0);
check(`toneCorrect: restores it at roughly the right density (${tonedInk}/256)`,
  tonedInk > 0.15 * 256 && tonedInk < 0.35 * 256);

// Pixels come back in order of COVERAGE, so the restored texture follows the
// artwork's own geometry. Ranking in Bayer order replaced a checkerboard with
// its own weave; here the higher-covered half must be the one that inks.
const graded = CoverageOps.create(8, 8);
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) graded.data[y * 8 + x] = (x < 4) ? 0.35 : 0.15;
}
check('toneCorrect: puts ink back where the coverage is highest', (() => {
  const m = CoverageOps.toMaskToned(graded);
  const left = m.reduce((n, r) => n + r.slice(0, 4).filter(Boolean).length, 0);
  const right = m.reduce((n, r) => n + r.slice(4).filter(Boolean).length, 0);
  return left > right;
})());

check('toneCorrect: an empty buffer is safe',
  eq(CoverageOps.toMaskToned(CoverageOps.create(0, 0)), []));


summary();
