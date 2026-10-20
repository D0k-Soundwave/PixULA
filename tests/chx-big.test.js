'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({ FontService: {}, SCRFormat: {} });
loadModule('js/io/dev-format.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');
loadModule('js/io/font-format.js');
const F = FontFormat;
const G = GlyphBits;

const HEADER = 5 + 512;

// Build a CHX file: chars = [{code, cols, rows, coloured, blocks: Uint8Array(cols*rows*8)}]
function buildChx(chars) {
  let size = HEADER;
  for (const c of chars) size += 3 + c.cols * c.rows * (c.coloured ? 9 : 8);
  const out = new Uint8Array(size);
  out.set([0x43, 0x48, 0x58, 0, 0], 0);
  let off = HEADER;
  for (const c of chars) {
    out[5 + c.code * 2] = off & 0xFF; out[6 + c.code * 2] = off >> 8;
    out[off] = c.coloured ? 0 : 1; out[off + 1] = c.cols; out[off + 2] = c.rows;
    let o = off + 3;
    for (let b = 0; b < c.cols * c.rows; b++) {
      for (let y = 0; y < 8; y++) out[o++] = c.blocks[b * 8 + y];
      if (c.coloured) out[o++] = 0x38;
    }
    off = o;
  }
  return out;
}
const blocksOf = (n, seed) => Uint8Array.from({ length: n * 8 }, (_, i) => (i * 11 + seed) & 0xFF);
const space = { code: 32, cols: 1, rows: 1, blocks: new Uint8Array(8) };

// ── import: whole characters ─────────────────────────────────────────────────
{
  const a = blocksOf(4, 3);
  const r = F.parseFont(buildChx([space, { code: 65, cols: 2, rows: 2, blocks: a }, { code: 66, cols: 2, rows: 2, blocks: blocksOf(4, 9), coloured: true }]), 'chx');
  check('a 2 x 2 file imports', r.success, r.error);
  const f = r.font;
  check('the font is 16 x 16', f.width === 16 && f.height === 16);
  check('glyphs are 32 bytes each', f.glyphs.every(g => g.length === 32));
  check('character 65 keeps all four blocks', f.glyphs[65 - 32].every((b, i) => b === G.fromBlocks(a, 2, 2)[i]));
  check('block order is left to right, then down', f.glyphs[65 - 32][0] === a[0] && f.glyphs[65 - 32][1] === a[8] && f.glyphs[65 - 32][16] === a[16]);
  check('a coloured character imports its bitmap (its attribute bytes are kept as its colours, see chx-colour.test.js)', (() => {
    const want = G.fromBlocks(blocksOf(4, 9), 2, 2);
    return f.glyphs[66 - 32].every((b, i) => b === want[i]);
  })());
  check('Space is wider than its file record: a 1-column space is shaded to the right', f.shade[0][0] === 0 && f.shade[0][1] === 1);
  check('codes the file does not define come back fully shaded', f.shade[67 - 32][0] + f.shade[67 - 32][1] === 2 && f.shade[40 - 32][1] + f.shade[40 - 32][0] === 2);
  check('defined characters are not shaded', f.shade[65 - 32][0] === 0 && f.shade[65 - 32][1] === 0);
}

// ── import: mixed sizes ──────────────────────────────────────────────────────
{
  const narrow = blocksOf(2, 5);                     // 1 col x 2 rows
  const wide = blocksOf(6, 7);                       // 3 cols x 2 rows
  const short = blocksOf(3, 1);                      // 3 cols x 1 row
  const r = F.parseFont(buildChx([space, { code: 105, cols: 1, rows: 2, blocks: narrow }, { code: 87, cols: 3, rows: 2, blocks: wide }, { code: 45, cols: 3, rows: 1, blocks: short }]), 'chx');
  check('mixed sizes import', r.success, r.error);
  const f = r.font;
  check('the font size is the largest columns x rows in the file: 24 x 16', f.width === 24 && f.height === 16);
  const i = f.glyphs[105 - 32];
  check('a narrow character sits at the left with the rest shaded on the right', f.shade[105 - 32][0] === 0 && f.shade[105 - 32][1] === 2);
  check('its pixels are where the file put them (block row 0 and block row 1)', i[0] === narrow[0] && i[8 * 3] === narrow[8]);
  check('a short character is padded blank at the bottom', f.glyphs[45 - 32].subarray(8 * 3).every(b => b === 0));
  check('a short character keeps its top row exactly', f.glyphs[45 - 32][0] === short[0] && f.glyphs[45 - 32][1] === short[8] && f.glyphs[45 - 32][2] === short[16]);
}

// ── import: Space ────────────────────────────────────────────────────────────
{
  const r = F.parseFont(buildChx([{ code: 65, cols: 1, rows: 1, blocks: blocksOf(1, 2) }]), 'chx');
  check('a file with no Space still imports; Space is made a blank, unshaded character', r.success && r.font.shade[0][0] === 0 && r.font.shade[0][1] === 0 && r.font.glyphs[0].every(b => b === 0));
}

// ── export: sizes ────────────────────────────────────────────────────────────
function bigDoc(cols, rows, first, count, shade) {
  const w = cols * 8, h = rows * 8;
  const glyphs = [];
  for (let i = 0; i < count; i++) glyphs.push(Uint8Array.from({ length: G.byteLength(w, h) }, (_, k) => (i * 29 + k * 5 + 1) & 0xFF));
  return { name: 't', width: w, height: h, firstCode: first, glyphs, shade: shade || null };
}
{
  const doc = bigDoc(3, 2, 32, 96);
  const out = F.exportFont(doc, 'chx');
  check('3 x 2 unshaded: file = 517 + 96 x (3 + 6 x 8)', out.length === HEADER + 96 * (3 + 48), String(out.length));
  check('every record says 3 columns 2 rows transparent', (() => { const o = out[5 + 65 * 2] | (out[6 + 65 * 2] << 8); return out[o] === 1 && out[o + 1] === 3 && out[o + 2] === 2; })());
  const back = F.parseFont(out, 'chx');
  check('it reads back as the same font', back.success && back.font.width === 24 && back.font.height === 16 && back.font.glyphs.every((g, i) => g.every((b, k) => b === doc.glyphs[i][k])));
}

// ── export: shading ──────────────────────────────────────────────────────────
{
  const shade = Array.from({ length: 96 }, () => [0, 0]);
  shade[65 - 32] = [1, 0];       // left column out
  shade[66 - 32] = [0, 1];       // right column out
  shade[67 - 32] = [1, 1];       // both
  shade[68 - 32] = [0, 3];       // all out: not written
  const doc = bigDoc(3, 2, 32, 96, shade);
  const out = F.exportFont(doc, 'chx');
  const rec = (code) => out[5 + code * 2] | (out[6 + code * 2] << 8);
  check('a left-shaded column stores a character 2 columns wide', out[rec(65) + 1] === 2 && out[rec(65) + 2] === 2);
  check('a right-shaded column stores 2 columns', out[rec(66) + 1] === 2);
  check('left and right shading store 1 column', out[rec(67) + 1] === 1);
  check('a character shaded all the way across is not written (offset 0)', rec(68) === 0);
  check('the file is smaller by exactly the dropped bytes: 8 x rows(2) per column (3 columns of one block-row = 16 bytes each)', (() => {
    const unshaded = F.exportFont(bigDoc(3, 2, 32, 96), 'chx').length;
    const saved = 16 * 1 + 16 * 1 + 16 * 2 + (3 + 48);
    return unshaded - out.length === saved;
  })());
  // left shading drops the LEFT pixels: the stored character is the right two columns
  const back = F.parseFont(out, 'chx').font;
  const orig = doc.glyphs[65 - 32];
  check('left shading stores the pixels to the right of the shaded column', (() => {
    const got = back.glyphs[65 - 32];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (G.getPixel(got, 24, x, y) !== G.getPixel(orig, 24, x + 8, y)) return false;
    return true;
  })());
  check('...and it comes back shaded on the right', back.shade[65 - 32][0] === 0 && back.shade[65 - 32][1] === 1);
  check('right shading stores the pixels to the left', (() => {
    const got = back.glyphs[66 - 32]; const o = doc.glyphs[66 - 32];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (G.getPixel(got, 24, x, y) !== G.getPixel(o, 24, x, y)) return false;
    return true;
  })());
  check('both-side shading stores the middle column', (() => {
    const got = back.glyphs[67 - 32]; const o = doc.glyphs[67 - 32];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (G.getPixel(got, 24, x, y) !== G.getPixel(o, 24, x + 8, y)) return false;
    return back.shade[67 - 32][1] === 2;
  })());
  check('the dropped character comes back fully shaded', back.shade[68 - 32][0] + back.shade[68 - 32][1] === 3);
  // export -> import -> export is stable
  const again = F.exportFont(back, 'chx');
  check('export, import, export gives identical bytes', again.length === out.length && again.every((b, i) => b === out[i]));
}

// ── export: Space ────────────────────────────────────────────────────────────
{
  const shade = Array.from({ length: 96 }, () => [0, 0]);
  shade[0] = [0, 3];
  let msg = '';
  try { F.exportFont(bigDoc(3, 2, 32, 96, shade), 'chx'); } catch (e) { msg = e.message; }
  check('a fully shaded Space is refused with a message', /space/i.test(msg), msg);
  shade[0] = [1, 1];
  check('a Space with one column left exports', F.exportFont(bigDoc(3, 2, 32, 96, shade), 'chx').length > HEADER);
  let noSpace = '';
  try { F.exportFont(bigDoc(3, 2, 33, 90), 'chx'); } catch (e) { noSpace = e.message; }
  check('a font whose coverage does not include Space is refused', /space/i.test(noSpace), noSpace);
}

// ── a sparse file does not grow ──────────────────────────────────────────────
{
  const file = buildChx([space, { code: 65, cols: 1, rows: 1, blocks: blocksOf(1, 4) }, { code: 66, cols: 1, rows: 1, blocks: blocksOf(1, 8) }]);
  const f = F.parseFont(file, 'chx').font;
  const out = F.exportFont(f, 'chx');
  check('a file defining 3 characters exports as 3 characters', out.length === HEADER + 3 * 11, String(out.length));
}

// ── other formats refuse big fonts ───────────────────────────────────────────
for (const ext of ['ch4', 'ch6', 'ch8', 'chr']) {
  let msg = '';
  try { F.exportFont(bigDoc(2, 2, 32, 96), ext); } catch (e) { msg = e.message; }
  check(`.${ext} export of a big font is refused`, msg.length > 0);
}
check('.ch8 export of an 8 x 8 font with shading still works (shading is a CHX idea)', F.exportFont({ ...bigDoc(1, 1, 32, 96), shade: Array.from({ length: 96 }, () => [0, 0]) }, 'ch8').length === 2048);
// ── summary ──────────────────────────────────────────────────────────────────
{
  const none = F.chxSummary(bigDoc(3, 2, 32, 96));
  check('summary of an unshaded font: nothing narrowed, left out or hidden', none.narrowed === 0 && none.leftOut === 0 && none.hiddenInk === 0);
  const shade = Array.from({ length: 96 }, () => [0, 0]);
  shade[65 - 32] = [1, 0]; shade[66 - 32] = [0, 1]; shade[67 - 32] = [1, 1]; shade[68 - 32] = [0, 3]; shade[69 - 32] = [3, 0];
  const doc = bigDoc(3, 2, 32, 96, shade);
  const sum = F.chxSummary(doc);
  const out = F.exportFont(doc, 'chx');
  let written = 0, narrow = 0;
  for (let c = 0; c < 256; c++) { const o = out[5 + c * 2] | (out[6 + c * 2] << 8); if (o) { written++; if (out[o + 1] < 3) narrow++; } }
  check('summary counts agree with the bytes: narrowed', sum.narrowed === narrow && sum.narrowed === 3);
  check('summary counts agree with the bytes: left out', sum.leftOut === 96 - written && sum.leftOut === 2);
  check('summary counts the characters whose hidden columns hold dots', sum.hiddenInk === 5, String(sum.hiddenInk));
  const blank = bigDoc(3, 2, 32, 96, shade);
  blank.glyphs[65 - 32].fill(0);
  check('a shaded column with no dots is not "hidden ink"', F.chxSummary(blank).hiddenInk === 4);
}

for (const ext of ['asm', 'c', 'bin']) {
  let msg = '';
  try { DevFormat.generateFont(ext, 'x', bigDoc(2, 2, 32, 96)); } catch (e) { msg = e.message; }
  check(`.${ext} listing of a big font is refused`, msg.length > 0);
}
summary();
