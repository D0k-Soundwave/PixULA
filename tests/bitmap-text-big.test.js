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

// -- step 2: variable advances through nativeLine / stretchLine / layout / caretRect / slotFromX ------------------------------------
{
  // A 16 x 16 proportional font: 'a' (65) full, 'i' (105) with its left column shaded (8 wide, saved part = the right 8), 'W' (87) full
  const glyphs = Array.from({ length: 96 }, () => new Uint8Array(32));
  const px = (code, x, y) => G.setPixel(glyphs[code - 32], 16, x, y, true);
  for (let y = 0; y < 16; y++) { px(65, 0, y); px(65, 15, y); px(87, 7, y); px(87, 8, y); }
  for (let y = 0; y < 16; y++) { px(105, 8, y); px(105, 11, y); px(105, 3, y); }     // x 3 is under the shading and must not show
  const shade = glyphs.map(() => [0, 0]);
  shade[105 - 32] = [1, 0];
  const font = { name: 'P', width: 16, height: 16, firstCode: 32, glyphs, shade };
  const src = B.fontSource(font);
  const O = (over = {}) => ({ glyphOf: src.glyphOf, spanOf: src.spanOf, fw: src.fw, w0: 16, h0: 16, W: 16, H: 16, sx: 0, sy: 0, align: 'left', bold: false, italic: false, ...over });
  const col = (m, x) => m.pixels.map(r => (r[x] ? 1 : 0)).reduce((a, b) => a + b, 0);

  const nat = B.nativeLine('Ai', O());
  check('nativeLine: widths add up (16 + 8)', nat.width === 24 && nat.count === 2 && eq(nat.spans, [{ x: 0, w: 16 }, { x: 16, w: 8 }]));
  check('nativeLine: a full glyph keeps both edge columns', col(nat, 0) === 16 && col(nat, 15) === 16);
  check('nativeLine: the saved part of i starts at its column 8 (x 16 in the line)', col(nat, 16) === 16 && col(nat, 19) === 16);
  const natI = B.nativeLine('i', O());
  check('nativeLine: i alone is 8 wide and its column 3 (source x 11) is set, source x 3 is not shown', natI.width === 8 && col(natI, 0) === 16 && col(natI, 3) === 16 && col(natI, 1) === 0 && col(natI, 7) === 0);
  check('a missing character takes no space', B.nativeLine('aéi', O()).width === 24);

  // stretch: W = 32 doubles a full-width letter and an 8-wide one exactly like scaling the whole line by 2
  const st = B.stretchLine(nat, 16, 16, 32, 32, 0);
  check('stretchLine at W = 2 x w0: i takes 16 columns, a takes 32', st.width === 48 && eq(st.xs, [0, 32, 48]));
  let same2x = true;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 48; x++) if (!!st.pixels[y][x] !== !!nat.pixels[y >> 1][x >> 1]) same2x = false;
  check('...and the pixels are the native line scaled by 2', same2x);
  const st24 = B.stretchLine(nat, 16, 16, 24, 16, 0);
  check('W = 24: a is 24 wide, i is round(8 x 24 / 16) = 12 wide', st24.xs[1] === 24 && st24.xs[2] === 36 && st24.width === 36);
  const stSp = B.stretchLine(nat, 16, 16, 16, 16, 3);
  check('spacing adds to every advance', eq(stSp.xs, [0, 19, 30]) && stSp.width === 19 + 8);
  const stNeg = B.stretchLine(nat, 16, 16, 16, 16, -4);
  check('negative spacing overlaps without losing the last letter', eq(stNeg.xs, [0, 12, 16]) && stNeg.width === 12 + 8);

  // layout: per-line slot starts, the caret and slotFromX
  const lay = B.layout('Ai\nW', O());
  check('layout carries slot starts per line (n + 1 entries)', eq(lay.lines[0].xs, [0, 16, 24]) && eq(lay.lines[1].xs, [0, 16]));
  check('layout keeps adv for classic callers', lay.adv === 16);
  check('caret after a is at 16, after ai at 24', B.caretRect(lay, 0, 1, O()).x === 16 && B.caretRect(lay, 0, 2, O()).x === 24);
  check('caret bar width: max(1, round(W / max(8, w0)))', B.caretRect(lay, 0, 0, O({ W: 32 })).w === 2 && B.caretRect(lay, 0, 0, O({ W: 16 })).w === 1 && B.caretRect(lay, 0, 0, O({ W: 8 })).w === 1);
  const l0 = lay.lines[0];
  check('slotFromX picks the nearest boundary, ties go right', B.slotFromX(l0, 0) === 0 && B.slotFromX(l0, 7) === 0 && B.slotFromX(l0, 8) === 1 && B.slotFromX(l0, 19) === 1 && B.slotFromX(l0, 20) === 2 && B.slotFromX(l0, 99) === 2 && B.slotFromX(l0, -5) === 0);

  // slotFromX equals the old fixed-advance formula for classic fonts
  const rom = { glyphOf: (c) => (c >= ' ' && c <= '~' ? new Uint8Array(8) : null), w0: 8, h0: 8 };
  let allSame = true;
  for (const [W, sx] of [[8, 0], [16, 0], [12, 3], [5, -1], [30, 0]]) {
    const o = { ...rom, W, H: 8, sx, sy: 0, align: 'left' };
    const cl = B.layout('Hello', o);
    const line = cl.lines[0];
    const adv = Math.max(1, W + sx);
    for (let x = -4; x < 6 * adv + 6; x++) {
      const old = Helpers.clamp(Math.round(x / adv), 0, line.before[line.before.length - 1]);
      if (B.slotFromX(line, x) !== old) allSame = false;
    }
  }
  check('slotFromX equals Math.round(x / adv) clamped for classic fonts at many W and spacings', allSame);
}
summary();
