'use strict';
/**
 * Batch 10C3: big and proportional library fonts in BitmapText. Step 1: the pure helpers (span, bit reader, fontSource); the rest of the
 * file grows with the later steps.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/bitmap-text.js');
global.FontService = {};
loadModule('js/io/font-format.js');
const B = BitmapText;
const G = GlyphBits;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- span: where the saved part of a glyph lies in its cell ------------------------------------------------------------------
check('an unshaded 8-wide glyph spans the whole cell', eq(B.span(8, null), { x0: 0, w: 8 }) && eq(B.span(8, [0, 0]), { x0: 0, w: 8 }));
check('an unshaded 4 or 6 wide glyph spans its own width, not 8', eq(B.span(4, [0, 0]), { x0: 0, w: 4 }) && eq(B.span(6, null), { x0: 0, w: 6 }));
check('left and right shading cut 8 pixels a column', eq(B.span(24, [1, 0]), { x0: 8, w: 16 }) && eq(B.span(24, [0, 1]), { x0: 0, w: 16 }) && eq(B.span(24, [1, 1]), { x0: 8, w: 8 }));
check('a glyph shaded all the way across has no span', B.span(24, [3, 0]) === null && B.span(24, [1, 2]) === null && B.span(8, [0, 1]) === null);
check('a narrow glyph with a column shaded is left out too (4 wide, 8 shaded)', B.span(4, [1, 0]) === null);

// -- the bit reader ------------------------------------------------------------------------------------------------------------
{
  const g = G.create(16, 8);
  G.setPixel(g, 16, 0, 0, true); G.setPixel(g, 16, 9, 3, true); G.setPixel(g, 16, 15, 7, true);
  check('bit reads multi-byte rows', B.bit(g, 16, 0, 0) === 1 && B.bit(g, 16, 9, 3) === 1 && B.bit(g, 16, 15, 7) === 1 && B.bit(g, 16, 1, 0) === 0 && B.bit(g, 16, 8, 3) === 0);
  const classic = Uint8Array.of(0x80, 0x41, 0, 0, 0, 0, 0, 0x01);
  let same = true;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (B.bit(classic, 8, x, y) !== ((classic[y] >> (7 - x)) & 1)) same = false;
  check('for an 8-wide glyph it is the old (byte >> (7 - x)) & 1', same);
}

// -- fontSource -----------------------------------------------------------------------------------------------------------------
function bigFont(width, height, shadeFor) {
  const glyphs = [], shade = [];
  for (let i = 0; i < 96; i++) {
    glyphs.push(Uint8Array.from({ length: G.byteLength(width, height) }, (_, k) => (i * 29 + k * 5 + 1) & 0xFF));
    shade.push(shadeFor ? shadeFor(i) : [0, 0]);
  }
  return { name: 'T', width, height, firstCode: 32, glyphs, shade: shadeFor ? shade : null };
}
{
  const f = bigFont(24, 16, (i) => (i === 33 ? [1, 0] : i === 34 ? [0, 3] : i === 35 ? [1, 1] : [0, 0]));   // 'A' (65) left, 'B' (66) out, 'C' (67) middle
  const s = B.fontSource(f);
  check('fontSource gives the cell size and the stride', s.w0 === 24 && s.h0 === 16 && s.fw === 24);
  check('a plain character has a full-cell span', eq(s.spanOf('D'), { x0: 0, w: 24 }) && s.glyphOf('D') === f.glyphs[68 - 32]);
  check('a left-shaded one starts 8 pixels in and is 16 wide', eq(s.spanOf('A'), { x0: 8, w: 16 }));
  check('a middle-shaded one is the middle 8', eq(s.spanOf('C'), { x0: 8, w: 8 }));
  check('a fully shaded one has no glyph (it is refused like a missing character)', s.glyphOf('B') === null);
  check('a code outside the coverage has no glyph', s.glyphOf('é') === null && s.glyphOf('\u0001') === null);
  check('the font is proportional', s.proportional === true);
  check('an unshaded big font is not proportional', B.fontSource(bigFont(16, 16)).proportional === false);
  const classic = B.fontSource({ name: 'c', width: 6, firstCode: 32, glyphs: Array.from({ length: 96 }, () => new Uint8Array(8)), shade: null });
  check('a classic 6 x 8 font: w0 6, h0 8, full spans, not proportional', classic.w0 === 6 && classic.h0 === 8 && eq(classic.spanOf('x'), { x0: 0, w: 6 }) && !classic.proportional);
}

// -- the span IS what a .chx file holds ----------------------------------------------------------------------------------------
for (const [width, height] of [[8, 8], [16, 16], [24, 16], [32, 32]]) {
  const f = bigFont(width, height, (i) => { const cols = width >> 3; const l = i % (cols + 1); const r = (i >> 2) % (cols + 1 - l); return [l, r]; });
  const plan = FontFormat._chxPlan({ ...f, shade: f.shade });
  let ok = true, why = '';
  for (let i = 0; i < 96; i++) {
    const e = plan.entries[i];
    const sp = B.span(width, f.shade[i]);
    if (e.stored <= 0) { if (sp !== null) { ok = false; why += ` ${i}: file leaves it out but span exists;`; } }
    else if (!sp || sp.w !== e.stored * 8 || sp.x0 !== e.left * 8) { ok = false; why += ` ${i}: span ${JSON.stringify(sp)} vs stored ${e.stored} left ${e.left};`; }
  }
  check(`${width}x${height}: for every glyph the span is exactly the columns a CHX export writes${why}`, ok);
}
summary();
