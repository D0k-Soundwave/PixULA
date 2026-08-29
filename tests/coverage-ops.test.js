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

loadModule('js/utils/coverage-ops.js');

const T = true, F = false;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- constants carry their measured justification (spec section 6) ----------
check('SUPERSAMPLE is 8 - ss=4 measures below the shipped chain on 1-bit',
  CoverageOps.SUPERSAMPLE === 8);
check('INK_COVERAGE is 0.50, NOT font-rasterizer.js 0.40 (different sizes)',
  CoverageOps.INK_COVERAGE === 0.50);

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

summary();
