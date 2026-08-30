'use strict';
/**
 * Single source-of-truth audit: for every SCREEN_MODES entry, exactly which
 * of the Save Image As formats (js/ui/menu-system.js EXPORT_FORMATS, the
 * app's one save-format surface as of 2026-08-28) the artist can reach,
 * cross-checked against each format handler's own canExport() (what
 * FormatRegistry.isExportCompatible() — and so the menu's enabled state —
 * actually calls). Every other test file pins one format's canExport()
 * against one or two modes; this one pins the WHOLE 14-mode x 23-format
 * grid at once, so a new mode or format that forgets a gate (or copies one
 * that is wrong for it) fails here even if no other suite happens to touch
 * that combination.
 *
 * Two real gaps this test caught (fixed alongside it, 2026-08-28):
 *   - MulticolorFormat.canExport('mlt'/'ifl') did not exclude GigaScreen
 *     (two sub-screens; paletteModel fixed16 and attrCellH 8 satisfied its
 *     check same as any single-screen mode) — SCRFormat and ZXMFormat
 *     already excluded it, multicolor-format.js did not.
 *   - Helpers.hasStandardScreenLayout() (the shared gate behind TAP/TZX/
 *     ZED/SEV's canExport()) checked cell height, width and pixel depth
 *     but not `screens` — GigaScreen matches all three (it IS 256x192,
 *     8x8, 1-bit), so those four formats' canExport() returned true while
 *     GigaScreen was active even though their export() already threw via
 *     SCRFormat.export()'s separate two-screens gate — a save dialog would
 *     have listed a format that errors the moment it is picked.
 *
 * Also asserts GIF is not offered anywhere: EXPORT_FORMATS (the array the
 * File > Save Image As submenu is built from) has no 'gif' entry, though
 * the encoder in js/io/gif-format.js and its own tests are untouched
 * (withdrawn from the UI only, 2026-08-25).
 */
const fs = require('fs');
const path = require('path');
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();

loadModule('js/io/scr-format.js');
loadModule('js/io/multicolor-format.js');
loadModule('js/io/zxm-format.js');
loadModule('js/io/timex-format.js');
loadModule('js/io/gigascreen-format.js');
loadModule('js/io/nxi-format.js');
loadModule('js/io/next-palette-format.js');
loadModule('js/io/ctile-format.js');
loadModule('js/io/tap-format.js');
loadModule('js/io/tzx-format.js');
loadModule('js/io/zed-format.js');
loadModule('js/io/sev-format.js');
loadModule('js/io/dev-format.js');
loadModule('js/io/png-format.js');
loadModule('js/io/bmp-format.js');
loadModule('js/io/jpg-format.js');

// ─── The catalogue: every Save Image As leaf and how to ask its handler
//     "would you export in the active mode?" ───────────────────────────────

const CATALOGUE = {
  scr:   () => SCRFormat.canExport(),
  zxp:   () => ZXMFormat.canExportZxp(),
  mlt:   () => MulticolorFormat.canExport('mlt'),
  ifl:   () => MulticolorFormat.canExport('ifl'),
  hrg:   () => TimexFormat.canExport(),
  img:   () => GigascreenFormat.canExport(),
  nxi:   () => NXIFormat.canExport(),
  sl2:   () => NXIFormat.canExport(),
  slr:   () => NXIFormat.canExport(),
  ctile: () => CtileFormat.canExport(),
  tap:   () => TAPFormat.canExport(),
  tzx:   () => TZXFormat.canExport(),
  png:   () => true,
  bmp:   () => true,
  jpg:   () => true,
  zed:   () => ZEDFormat.canExport(),
  sev:   () => SEVFormat.canExport(),
  pal:   () => NextPaletteFormat.canExport(),
  npl:   () => NextPaletteFormat.canExport(),
  // Each dev format asks its OWN gate: .atr is nothing but the attribute
  // block, so it is not offered where the mode has none (Timex hi-res),
  // while the bitmap the other three carry is just as real there.
  asm:   () => DevFormat.canExport('asm'),
  c:     () => DevFormat.canExport('c'),
  bin:   () => DevFormat.canExport('bin'),
  atr:   () => DevFormat.canExport('atr')
};

// ─── The expected matrix, derived directly from each handler's own gate
//     condition (not from the earlier prose doc, which had drifted: .zxp
//     also reaches 8x4/8x2 via its extended per-line form, and .nxi/.sl2/
//     .slr are interchangeable dumps offered in every indexed mode, not
//     just their "native" size). ────────────────────────────────────────

const T = true, F = false;
const MATRIX = {
  standard_ula:    { scr: T, zxp: T, mlt: T, ifl: T, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: T, tzx: T, png: T, bmp: T, jpg: T, zed: T, sev: T, pal: F, npl: F, asm: T, c: T, bin: T, atr: T },
  multicolor_8x4:  { scr: F, zxp: T, mlt: T, ifl: T, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: F, npl: F, asm: F, c: F, bin: F, atr: F },
  multicolor_8x2:  { scr: F, zxp: T, mlt: T, ifl: T, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: F, npl: F, asm: F, c: F, bin: F, atr: F },
  multicolor_8x1:  { scr: T, zxp: T, mlt: T, ifl: F, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: T, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: F, npl: F, asm: T, c: T, bin: T, atr: T },
  ula_plus:        { scr: T, zxp: T, mlt: F, ifl: F, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: T, tzx: T, png: T, bmp: T, jpg: T, zed: T, sev: T, pal: T, npl: T, asm: T, c: T, bin: T, atr: T },
  ula_plus_8x1:    { scr: T, zxp: T, mlt: F, ifl: F, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: T, c: T, bin: T, atr: T },
  timex_hires:     { scr: T, zxp: F, mlt: F, ifl: F, hrg: T, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: F, npl: F, asm: T, c: T, bin: T, atr: F },
  gigascreen:      { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: T, nxi: F, sl2: F, slr: F, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: F, npl: F, asm: F, c: F, bin: F, atr: F },
  ulanext:         { scr: T, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: F, sl2: F, slr: F, ctile: F, tap: T, tzx: T, png: T, bmp: T, jpg: T, zed: T, sev: T, pal: T, npl: T, asm: T, c: T, bin: T, atr: T },
  layer2_256:      { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: T, sl2: T, slr: T, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: F, c: F, bin: F, atr: F },
  layer2_320:      { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: T, sl2: T, slr: T, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: F, c: F, bin: F, atr: F },
  layer2_640:      { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: T, sl2: T, slr: T, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: F, c: F, bin: F, atr: F },
  lores:           { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: T, sl2: T, slr: T, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: F, c: F, bin: F, atr: F },
  lores_radastan:  { scr: F, zxp: F, mlt: F, ifl: F, hrg: F, img: F, nxi: T, sl2: T, slr: T, ctile: F, tap: F, tzx: F, png: T, bmp: T, jpg: T, zed: F, sev: F, pal: T, npl: T, asm: F, c: F, bin: F, atr: F }
};

check('matrix covers every SCREEN_MODES entry',
  Object.keys(MATRIX).sort().join(',') ===
  Object.values(SCREEN_MODES).map((m) => m.id).sort().join(','));

for (const modeId of Object.keys(MATRIX)) {
  __setActiveScreenMode(modeId);
  const expected = MATRIX[modeId];
  for (const ext of Object.keys(CATALOGUE)) {
    const got = CATALOGUE[ext]();
    check(`${modeId}: ${ext} canExport() === ${expected[ext]}`, got === expected[ext],
      `got ${got}`);
  }
  // No format outside the catalogue is silently exportable in this mode —
  // the catalogue above IS the full Save Image As leaf set, so this just
  // confirms nothing was left out of CATALOGUE/MATRIX by mistake.
  check(`${modeId}: matrix and catalogue agree on the format set`,
    Object.keys(expected).sort().join(',') === Object.keys(CATALOGUE).sort().join(','));
}

__setActiveScreenMode('standard_ula');

// ─── GIF is not offered anywhere in the Save UI ─────────────────────────────

const menuSrc = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'ui', 'menu-system.js'), 'utf8');
const catalogueMatch = menuSrc.match(/const EXPORT_FORMATS = Object\.freeze\(\[([\s\S]*?)\]\);/);
check('EXPORT_FORMATS array found in menu-system.js', !!catalogueMatch);
const exportFormatsBody = catalogueMatch ? catalogueMatch[1] : '';
const listedExts = Array.from(exportFormatsBody.matchAll(/\['(\w+)'/g), (m) => m[1]);

check('EXPORT_FORMATS lists no gif entry', !listedExts.includes('gif'));
check('EXPORT_FORMATS matches the catalogue this test audits (23 formats)',
  listedExts.slice().sort().join(',') === Object.keys(CATALOGUE).sort().join(','),
  `got [${listedExts.sort().join(',')}]`);

summary();
