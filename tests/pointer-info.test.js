'use strict';
/**
 * PointerInfo (batch 3 part 3B): what the pointer readout says about a pixel -
 * the BASIC PLOT coordinate, the attribute byte and its parts, and the
 * Spectrum memory address of the pixel's byte and of its attribute byte, in
 * the modes that have a fixed memory layout.
 *
 * Every expected value is worked by hand here, from the published layout, so
 * the test does not simply restate the code:
 *
 *   pixel byte = 0x4000 + ((y & 0xC0) << 5) + ((y & 7) << 8) + ((y & 0x38) << 2) + (x >> 3)
 *   attribute  = 0x5800 + (y >> 3) * 32 + (x >> 3)
 *   Timex hi-colour attribute = the pixel byte + 0x2000 (second display file)
 *   Timex hi-res: even byte columns in 0x4000, odd ones in 0x6000, column c >> 1
 *   GigaScreen B: the same offsets with 128K bank 7 paged at 0xC000
 *
 * (255,191): y = 191 = 10111111b, so y & 0xC0 = 0x80 -> 0x80 << 5 = 0x1000; y & 7 = 7 -> 0x700;
 *   y & 0x38 = 0x38 -> 0x38 << 2 = 0xE0; x >> 3 = 31 = 0x1F.
 *   0x4000 + 0x1000 + 0x700 + 0xE0 + 0x1F = 0x57FF.  Attribute: 0x5800 + 23*32 + 31 = 0x5AFF.
 * (0,191): same but x >> 3 = 0 -> 0x57E0; attribute 0x5800 + 23*32 = 0x5AE0.
 * (128,96): y & 0xC0 = 0x40 -> 0x800; y & 7 = 0; y & 0x38 = 0x20 -> 0x80; x >> 3 = 16 = 0x10.
 *   0x4000 + 0x800 + 0x80 + 0x10 = 0x4890.  Attribute: 0x5800 + 12*32 + 16 = 0x5990.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/pointer-info.js');

const M = SCREEN_MODES;
const byId = (id) => Object.values(M).find((m) => m.id === id);
const hex = (n) => '$' + n.toString(16).toUpperCase();
const first = (id, x, y) => PointerInfo.addresses(byId(id), x, y)[0];

check('PointerInfo exists', typeof PointerInfo === 'object' && typeof PointerInfo.addresses === 'function');

// -- 1. Standard ULA ---------------------------------------------------------

for (const [x, y, bmp, attr] of [
  [0, 0, 0x4000, 0x5800],
  [255, 0, 0x401F, 0x581F],
  [0, 191, 0x57E0, 0x5AE0],
  [255, 191, 0x57FF, 0x5AFF],
  [128, 96, 0x4890, 0x5990]
]) {
  const a = first('standard_ula', x, y);
  check(`standard (${x},${y}) byte ${hex(bmp)}`, a && a.bitmap === bmp, a && hex(a.bitmap));
  check(`standard (${x},${y}) attribute ${hex(attr)}`, a && a.attr === attr, a && hex(a.attr));
}
check('ULAplus uses the same addresses as the standard screen',
  first('ula_plus', 255, 191).bitmap === 0x57FF && first('ula_plus', 255, 191).attr === 0x5AFF);
check('ULANext uses the same addresses too',
  first('ulanext', 128, 96).bitmap === 0x4890 && first('ulanext', 128, 96).attr === 0x5990);

// -- 2. Timex hi-colour (8x1 attributes in the second display file) ----------

for (const id of ['multicolor_8x1', 'ula_plus_8x1']) {
  check(`${id}: (0,0) byte $4000, attribute $6000`,
    first(id, 0, 0).bitmap === 0x4000 && first(id, 0, 0).attr === 0x6000);
  check(`${id}: (255,191) byte $57FF, attribute $77FF (the byte + $2000)`,
    first(id, 255, 191).bitmap === 0x57FF && first(id, 255, 191).attr === 0x77FF);
  check(`${id}: (128,96) byte $4890, attribute $6890`,
    first(id, 128, 96).bitmap === 0x4890 && first(id, 128, 96).attr === 0x6890);
}

// -- 3. Timex hi-res (512 wide, two bitmaps, no attributes) ------------------
// x = 8 is byte column 1 (odd): the second display file, inner column 1 >> 1 = 0.
// x = 16 is column 2 (even): first file, inner column 2 >> 1 = 1.
// x = 511 is column 63 (odd): second file, inner 31.  (256,96): column 32, even -> 0x4890.
// (264,96): column 33, odd -> 0x6000 + 0x800 + 0x80 + 16 = 0x6890.
{
  const t = (x, y) => first('timex_hires', x, y);
  check('hi-res (0,0) = $4000', t(0, 0).bitmap === 0x4000);
  check('hi-res (8,0) = $6000', t(8, 0).bitmap === 0x6000);
  check('hi-res (16,0) = $4001', t(16, 0).bitmap === 0x4001);
  check('hi-res (511,0) = $601F', t(511, 0).bitmap === 0x601F);
  check('hi-res (511,191) = $77FF', t(511, 191).bitmap === 0x77FF);
  check('hi-res (256,96) = $4890', t(256, 96).bitmap === 0x4890);
  check('hi-res (264,96) = $6890', t(264, 96).bitmap === 0x6890);
  check('hi-res has no attribute address', t(0, 0).attr === null);
}

// -- 4. GigaScreen: two screens ----------------------------------------------
// B is the same offsets with bank 7 at $C000; the attribute area is $1800 further on:
// (255,191): $C000 + $17FF = $D7FF byte; $C000 + $1800 + $2FF = $DAFF attribute.
{
  const g = PointerInfo.addresses(byId('gigascreen'), 255, 191);
  check('GigaScreen gives two entries, A then B', g.length === 2 && g[0].screen === 'A' && g[1].screen === 'B');
  check('GigaScreen A is the standard screen', g[0].bitmap === 0x57FF && g[0].attr === 0x5AFF);
  check('GigaScreen B byte $D7FF', g[1].bitmap === 0xD7FF, hex(g[1].bitmap));
  check('GigaScreen B attribute $DAFF', g[1].attr === 0xDAFF, hex(g[1].attr));
}

// -- 5. Modes with no fixed layout, and every mode sorted on purpose ---------

const WITH_ADDRESS = new Set(['standard_ula', 'ula_plus', 'ulanext', 'multicolor_8x1', 'ula_plus_8x1',
  'timex_hires', 'gigascreen']);
for (const m of Object.values(M)) {
  const got = PointerInfo.addresses(m, 1, 1).length > 0;
  check(`${m.id}: ${WITH_ADDRESS.has(m.id) ? 'has' : 'has no'} address`, got === WITH_ADDRESS.has(m.id));
}

// -- 6. PLOT -----------------------------------------------------------------

{
  const std = byId('standard_ula');
  check('PLOT y 0 -> 175 (top of the picture)', PointerInfo.plotY(std, 0) === 175);
  check('PLOT y 175 -> 0', PointerInfo.plotY(std, 175) === 0);
  check('PLOT y 88 -> 87', PointerInfo.plotY(std, 88) === 87);
  check('PLOT y 176 has no value (the bottom two text lines)', PointerInfo.plotY(std, 176) === null);
  check('PLOT y 191 has no value', PointerInfo.plotY(std, 191) === null);
  check('PLOT y -1 has no value', PointerInfo.plotY(std, -1) === null);
  check('PLOT works in other 256x192 one-bit modes', PointerInfo.plotY(byId('gigascreen'), 0) === 175);
  check('PLOT has no meaning in Timex hi-res (512 wide)', PointerInfo.plotY(byId('timex_hires'), 0) === null);
  check('PLOT has no meaning in Layer 2', PointerInfo.plotY(byId('layer2_256'), 0) === null);
}

// -- 7. The attribute byte and its parts -------------------------------------
// FLASH 128 + BRIGHT 64 + PAPER*8 + INK.  flash, bright, paper 5, ink 3: 128+64+40+3 = 235 = $EB.
{
  const std = byId('standard_ula');
  const a = { ink: 3, paper: 5, bright: true, flash: true };
  check('attribute byte 235', PointerInfo.attributeByte(std, a) === 235);
  check('attribute byte for black on white is 56', PointerInfo.attributeByte(std, { ink: 0, paper: 7, bright: false, flash: false }) === 56);
  const p = PointerInfo.attributeParts(std, a);
  check('standard parts: ink, paper, bright, flash',
    p.kind === 'fixed16' && p.ink === 3 && p.paper === 5 && p.bright === true && p.flash === true);
  // ULAplus: bits 7-6 are the CLUT = flash * 2 + bright; flash only: CLUT 2.
  const up = PointerInfo.attributeParts(byId('ula_plus'), { ink: 1, paper: 6, bright: false, flash: true });
  check('ULAplus parts: CLUT 2, ink 1, paper 6', up.kind === 'clut' && up.clut === 2 && up.ink === 1 && up.paper === 6);
  check('ULAplus byte is the same bits: CLUT 2 = 128 + 48 + 1 = 177',
    PointerInfo.attributeByte(byId('ula_plus'), { ink: 1, paper: 6, bright: false, flash: true }) === 177);
  // ULANext: ink entry = byte & 7, paper entry = 128 + (byte >> 3).  byte 235: ink 3, paper 128 + 29 = 157.
  const un = PointerInfo.attributeParts(byId('ulanext'), a);
  check('ULANext parts: ink entry 3, paper entry 157', un.kind === 'ulanext' && un.ink === 3 && un.paper === 157);
  // No cell colours: nothing to show.
  check('Timex hi-res has no attribute byte', PointerInfo.attributeByte(byId('timex_hires'), a) === null);
  check('Layer 2 has no attribute byte', PointerInfo.attributeByte(byId('layer2_256'), a) === null);
  check('Timex hi-res has no parts', PointerInfo.attributeParts(byId('timex_hires'), a) === null);
}

// -- 8. Formatting without a "$" replacement hazard --------------------------
check('hex formatting', PointerInfo.hex(0x4890) === '$4890' && PointerInfo.hex(0x38, 2) === '$38');

// -- 9. A "$" in an address is text, never a replacement pattern -------------
// Readout text is built by I18n.t(key, params); the params hold "$4000"-style
// values. String.replace reads "$&" and "$1" in a replacement STRING, so the
// manager must pass a function.
{
  global.document = global.document || { documentElement: { lang: '' } };
  global.localStorage = global.localStorage || { getItem() { return null; }, setItem() {} };
  loadModule('js/utils/helpers.js');
  loadModule('js/i18n/i18n-manager.js');
  I18n.translations = { en: { 'k.a': 'Byte {b}, attribute {a}', 'k.p': 'other: {n} at {b}' } };
  I18n.currentLocale = 'en';
  I18n.fallbackLocale = 'en';
  check('t keeps a "$" value as text', I18n.t('k.a', { b: '$4000', a: '$&1' }) === 'Byte $4000, attribute $&1',
    I18n.t('k.a', { b: '$4000', a: '$&1' }));
  check('plural keeps a "$" value as text', I18n.plural('k.p', 1, { b: "$'" }) === "1 at $'");
}

summary();
