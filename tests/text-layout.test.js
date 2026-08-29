'use strict';
/**
 * Text layout directions (bitmap-font path).
 *
 * `_buildTextMask` laid glyphs left-to-right and nothing else, so the only
 * way to get vertical text was to rotate the finished block - which lays the
 * letters on their sides. `layout` places the glyphs instead, so a stacked
 * column keeps every letter the right way up.
 *
 * The italic checks are the ones that matter most. `_styleBitmapMask` shears
 * by `floor((h - 1 - y) / 3)` measured over the WHOLE mask height, which is 8
 * for a line of text but 8*n for a stacked column - so styling a column as one
 * mask smears it into a diagonal streak instead of slanting each letter. The
 * vertical path has to style each glyph before stacking.
 *
 * System fonts are covered by tests/browser/text-layout.spec.js - they need a
 * real canvas to rasterize.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; }, getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = { getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; } };
global.PatternService = { getCurrentPattern() { return null; }, getCurrentPatternData() { return null; }, shouldDrawPixel() { return true; } };
global.SelectionService = { isFloating() { return false; }, endFloatingPaste() {}, clear() {}, hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }, refreshTextStamp() {} };
global.GridOverlay = { drawCompositorPreview() {}, clearFunctionPreview() {}, drawPreviewPixels() {} };
global.FontService = null;

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/text-tool.js');

const tt = new global.TextTool();
const ZX = 'ZX ROM';
const LAYOUTS = ['horizontal', 'reversed', 'vertical-down', 'vertical-up'];
const dims = (m) => `${m.width}x${m.height}`;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mask = (text, layout, bold = false, italic = false) =>
  tt._buildTextMask(text, ZX, bold, italic, layout);
const rowBand = (m, y0, h) => m.pixels.slice(y0, y0 + h).map(r => r.slice());
const colBand = (m, x0, w) => m.pixels.map(r => r.slice(x0, x0 + w));
const ink = (m) => m.pixels.reduce((n, row) => n + row.filter(Boolean).length, 0);

// -- the default is unchanged -------------------------------------------------
// Every existing caller passes four arguments; they must keep getting exactly
// what they got before the layout parameter existed.
const h3 = mask('ABC', 'horizontal');
check('layout: omitted argument defaults to horizontal',
  eq(tt._buildTextMask('ABC', ZX, false, false), h3));
check('layout: an unknown value falls back to horizontal',
  eq(mask('ABC', 'sideways-ish'), h3));
check(`horizontal: 3 glyphs of 8x8 -> 24x8 (${dims(h3)})`, dims(h3) === '24x8');

// -- reversed (glyph ORDER flipped; letters stay upright) ---------------------
const rev = mask('ABC', 'reversed');
check(`reversed: same box as horizontal (${dims(rev)})`, dims(rev) === dims(h3));
check('reversed: equals the horizontal raster of the reversed string',
  eq(rev, mask('CBA', 'horizontal')));
check('reversed: is NOT a mirror - the letterforms are untouched',
  eq(colBand(rev, 0, 8), colBand(h3, 16, 8)));
check('reversed: differs from mirroring the horizontal raster',
  !eq(rev.pixels, MaskOps.flipH(h3.pixels)));
check('reversed twice = identity', eq(mask('CBA', 'reversed'), h3));

// -- vertical-down ------------------------------------------------------------
const vd = mask('ABC', 'vertical-down');
check(`vertical-down: 3 glyphs of 8x8 -> 8x24 (${dims(vd)})`, dims(vd) === '8x24');
check('vertical-down: first character sits at the TOP, upright',
  eq(rowBand(vd, 0, 8), colBand(h3, 0, 8)));
check('vertical-down: second character below it, upright',
  eq(rowBand(vd, 8, 8), colBand(h3, 8, 8)));
check('vertical-down: last character at the bottom, upright',
  eq(rowBand(vd, 16, 8), colBand(h3, 16, 8)));
check('vertical-down: letters are NOT rotated (differs from a 90 deg turn)',
  !eq(vd.pixels, MaskOps.rotate(h3.pixels, 90)));

// -- vertical-up --------------------------------------------------------------
const vu = mask('ABC', 'vertical-up');
check(`vertical-up: same box as vertical-down (${dims(vu)})`, dims(vu) === '8x24');
check('vertical-up: first character sits at the BOTTOM, upright',
  eq(rowBand(vu, 16, 8), colBand(h3, 0, 8)));
check('vertical-up: equals vertical-down of the reversed string',
  eq(vu, mask('CBA', 'vertical-down')));

// -- ink is conserved: placement moves glyphs, it never resamples them --------
check('every layout is lossless (same ink as horizontal)',
  ink(rev) === ink(h3) && ink(vd) === ink(h3) && ink(vu) === ink(h3));

// -- styling is per-glyph in the vertical layouts -----------------------------
// A whole-mask shear over a 24px column would reach floor(23/3) = 7px and turn
// the column into a diagonal streak; per-glyph it reaches floor(7/3) = 2px.
const vdItal  = mask('ABC', 'vertical-down', false, true);
const oneItal = mask('A',   'horizontal',    false, true);
check(`vertical italic: the column is as wide as ONE italic glyph (${vdItal.width}px)`,
  vdItal.width === oneItal.width);
check('vertical italic: the stack is still 3 glyphs tall', vdItal.height === 24);
check('vertical italic: the top glyph is a sheared A, not a slice of a smear',
  eq(rowBand(vdItal, 0, 8), oneItal.pixels));
check('vertical bold: thickens without changing the stack height', (() => {
  const b = mask('ABC', 'vertical-down', true, false);
  return b.height === 24 && ink(b) > ink(vd);
})());

// -- glyphs the font does not have take no space, in every layout -------------
// The ZX ROM charset covers codes 32..127, so a newline has no glyph. It is
// skipped rather than spaced, exactly as in the horizontal path today.
check('characters with no glyph are skipped in every layout',
  LAYOUTS.every(l => eq(mask('AB\nC', l), mask('ABC', l))));
check('empty text returns null in every layout',
  LAYOUTS.every(l => mask('', l) === null));
check('text with no drawable glyph returns null in every layout',
  LAYOUTS.every(l => mask('\n\n', l) === null));

summary();
