'use strict';
/**
 * Non-throwing twins of Helpers.assertStandardScreenLayout() /
 * assertClassicPixelModel() — used to ask "would this gate pass" (e.g. for
 * a format's canExport()) without paying for a try/catch. The throwing
 * asserts call these, so there is one predicate per gate.
 */
const { installStubs, check, summary } = require('./helpers/zx-stubs');

installStubs();

// ulanext matches STANDARD_ULA's cell/width/depth shape exactly - only its
// paletteModel differs, which this gate doesn't check (constants.js: "the
// STANDARD_ULA -> ULANEXT conversion is visually lossless").
const STANDARD_LAYOUT_MODES = ['standard_ula', 'ula_plus', 'gigascreen', 'ulanext'];
const NON_STANDARD_LAYOUT_MODES = ['multicolor_8x4', 'multicolor_8x2', 'multicolor_8x1',
  'ula_plus_8x1', 'timex_hires', 'layer2_256', 'layer2_320', 'layer2_640',
  'lores', 'lores_radastan'];

for (const id of STANDARD_LAYOUT_MODES) {
  __setActiveScreenMode(id);
  check(`hasStandardScreenLayout true in ${id}`, Helpers.hasStandardScreenLayout() === true);
  let threw = false;
  try { Helpers.assertStandardScreenLayout(); } catch (e) { threw = true; }
  check(`assertStandardScreenLayout does not throw in ${id}`, threw === false);
}

for (const id of NON_STANDARD_LAYOUT_MODES) {
  __setActiveScreenMode(id);
  check(`hasStandardScreenLayout false in ${id}`, Helpers.hasStandardScreenLayout() === false);
  let threw = false;
  try { Helpers.assertStandardScreenLayout(); } catch (e) { threw = true; }
  check(`assertStandardScreenLayout throws in ${id}`, threw === true);
}

const CLASSIC_PIXEL_MODES = ['standard_ula', 'multicolor_8x4', 'multicolor_8x2', 'multicolor_8x1',
  'ula_plus', 'ula_plus_8x1', 'timex_hires', 'gigascreen', 'ulanext'];
const INDEXED_PIXEL_MODES = ['layer2_256', 'layer2_320', 'layer2_640', 'lores', 'lores_radastan'];

for (const id of CLASSIC_PIXEL_MODES) {
  __setActiveScreenMode(id);
  check(`hasClassicPixelModel true in ${id}`, Helpers.hasClassicPixelModel() === true);
  let threw = false;
  try { Helpers.assertClassicPixelModel(); } catch (e) { threw = true; }
  check(`assertClassicPixelModel does not throw in ${id}`, threw === false);
}

for (const id of INDEXED_PIXEL_MODES) {
  __setActiveScreenMode(id);
  check(`hasClassicPixelModel false in ${id}`, Helpers.hasClassicPixelModel() === false);
  let threw = false;
  try { Helpers.assertClassicPixelModel(); } catch (e) { threw = true; }
  check(`assertClassicPixelModel throws in ${id}`, threw === true);
}

__setActiveScreenMode('standard_ula');
summary();
