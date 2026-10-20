'use strict';
/**
 * Coloured CHX characters (owner decision 2026-10-19): the file's attribute bytes are kept on opening and written back on
 * saving; the font store (FontCodec) carries them. The layout is the published one (RECOIL DecodeChx, the ZX-Blockeditor
 * "Colour character map"): transparent byte 0, then 9 bytes per 8x8 block - 8 bitmap bytes and one ZX attribute byte.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({ FontService: {}, SCRFormat: {} });
loadModule('js/io/dev-format.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');
loadModule('js/io/font-format.js');
const F = FontFormat;
const G = GlyphBits;
const HEADER = 5 + 512;

// chars = [{code, cols, rows, attrs?: number[] (one per block; present = coloured), blocks: Uint8Array(cols*rows*8)}]
function buildChx(chars) {
  let size = HEADER;
  for (const c of chars) size += 3 + c.cols * c.rows * (c.attrs ? 9 : 8);
  const out = new Uint8Array(size);
  out.set([0x43, 0x48, 0x58, 0, 0], 0);
  let off = HEADER;
  for (const c of chars) {
    out[5 + c.code * 2] = off & 0xFF; out[6 + c.code * 2] = off >> 8;
    out[off] = c.attrs ? 0 : 1; out[off + 1] = c.cols; out[off + 2] = c.rows;
    let o = off + 3;
    for (let b = 0; b < c.cols * c.rows; b++) {
      for (let y = 0; y < 8; y++) out[o++] = c.blocks[b * 8 + y];
      if (c.attrs) out[o++] = c.attrs[b];
    }
    off = o;
  }
  return out;
}
const blocksOf = (n, seed) => Uint8Array.from({ length: n * 8 }, (_, i) => (i * 11 + seed) & 0xFF);
const rec = (out, code) => out[5 + code * 2] | (out[6 + code * 2] << 8);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── import keeps the attribute bytes ─────────────────────────────────────────
{
  const space = { code: 32, cols: 2, rows: 2, blocks: new Uint8Array(32) };
  const a = { code: 65, cols: 2, rows: 2, blocks: blocksOf(4, 3), attrs: [0x0A, 0x47, 0x80 | 0x38, 0x16] };
  const b = { code: 66, cols: 2, rows: 2, blocks: blocksOf(4, 9) };
  const r = F.parseFont(buildChx([space, a, b]), 'chx');
  check('a file with a coloured character opens', r.success, r.error);
  const f = r.font;
  check('the font carries a colours list, one entry per glyph', Array.isArray(f.colours) && f.colours.length === f.glyphs.length);
  check('a coloured character keeps one attribute byte per block, in block order', f.colours[65 - 32] && same(f.colours[65 - 32], [0x0A, 0x47, 0xB8, 0x16]));
  check('an uncoloured character has no attributes (null)', f.colours[66 - 32] === null && f.colours[0] === null);
  check('the coloured character\'s pixels are unchanged', same(f.glyphs[65 - 32], G.fromBlocks(a.blocks, 2, 2)));
  check('a code the file does not define has no attributes', f.colours[67 - 32] === null);
}

// ── a file with no coloured character opens as before (no colours list) ──────
{
  const r = F.parseFont(buildChx([{ code: 32, cols: 1, rows: 1, blocks: new Uint8Array(8) }, { code: 65, cols: 1, rows: 1, blocks: blocksOf(1, 2) }]), 'chx');
  check('an uncoloured file has colours null', r.success && r.font.colours === null);
}

// ── a smaller coloured character: its missing blocks get attribute 56 ────────
{
  const space = { code: 32, cols: 3, rows: 2, blocks: new Uint8Array(48) };
  const small = { code: 105, cols: 1, rows: 1, blocks: blocksOf(1, 5), attrs: [0x51] };
  const f = F.parseFont(buildChx([space, small]), 'chx').font;
  const c = f.colours[105 - 32];
  check('the font is 3 x 2 blocks, so the colour list of each character is 6 long', c && c.length === 6);
  check('the character\'s own block keeps its attribute (top-left)', c[0] === 0x51);
  check('the blocks the file did not have are 56: black Ink on white Paper, no Bright, no Flash', [1, 2, 3, 4, 5].every(i => c[i] === 56));
  check('it is still shaded on the right as before', f.shade[105 - 32][0] === 0 && f.shade[105 - 32][1] === 2);
}

// ── export writes coloured characters coloured ───────────────────────────────
function doc(cols, rows, count, colours, shade) {
  const w = cols * 8, h = rows * 8;
  const glyphs = [];
  for (let i = 0; i < count; i++) glyphs.push(Uint8Array.from({ length: G.byteLength(w, h) }, (_, k) => (i * 29 + k * 5 + 1) & 0xFF));
  return { name: 't', width: w, height: h, firstCode: 32, glyphs, shade: shade || null, colours };
}
{
  const colours = Array.from({ length: 96 }, () => null);
  colours[65 - 32] = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const d = doc(3, 2, 96, colours);
  const out = F.exportFont(d, 'chx');
  const o = rec(out, 65);
  check('a coloured character is written with transparent = 0', out[o] === 0 && out[o + 1] === 3 && out[o + 2] === 2);
  check('each block is 8 bitmap bytes then its attribute byte', (() => {
    const blocks = G.toBlocks(d.glyphs[65 - 32], 24, 16);
    for (let b = 0; b < 6; b++) {
      for (let y = 0; y < 8; y++) if (out[o + 3 + b * 9 + y] !== blocks[b * 8 + y]) return false;
      if (out[o + 3 + b * 9 + 8] !== b + 1) return false;
    }
    return true;
  })());
  check('the file is longer by exactly one byte per block of the coloured character', out.length === HEADER + 96 * (3 + 48) + 6);
  check('an uncoloured character next to it is still transparent', out[rec(out, 66)] === 1);
  const back = F.parseFont(out, 'chx').font;
  check('it reads back with the same attributes', same(back.colours[65 - 32], [1, 2, 3, 4, 5, 6]) && back.colours[66 - 32] === null);
  check('export, import, export gives identical bytes', same(F.exportFont(back, 'chx'), out));
}

// ── shading: only the stored columns' attributes are written ─────────────────
{
  const colours = Array.from({ length: 96 }, () => null);
  colours[65 - 32] = Uint8Array.from([10, 11, 12, 20, 21, 22]);   // row 0: 10 11 12, row 1: 20 21 22
  const shade = Array.from({ length: 96 }, () => [0, 0]);
  shade[65 - 32] = [1, 0];
  const out = F.exportFont(doc(3, 2, 96, colours, shade), 'chx');
  const o = rec(out, 65);
  check('a left-shaded coloured character stores 2 columns', out[o + 1] === 2 && out[o] === 0);
  check('...with the attributes of the columns it keeps, left to right then down', [11, 12, 21, 22].every((a, b) => out[o + 3 + b * 9 + 8] === a));
  const back = F.parseFont(out, 'chx').font;
  check('...and they come back at the left, the shaded column on the right getting 56',
    same(back.colours[65 - 32], [11, 12, 56, 21, 22, 56]));
}

// ── the CHX summary and the formats that cannot hold attributes ─────────────
{
  const colours = Array.from({ length: 96 }, () => null);
  colours[1] = Uint8Array.from([7]); colours[2] = Uint8Array.from([0x38]);
  const d = doc(1, 1, 96, colours);
  check('colouredCount counts the characters with their own attributes', F.colouredCount(d) === 2);
  check('colouredCount of a font without colours is 0', F.colouredCount({ ...d, colours: null }) === 0);
  check('a .ch8 of a coloured 8 x 8 font still saves its pixels (2048 bytes)', F.exportFont(d, 'ch8').length === 2048);
  const chx = F.exportFont(d, 'chx');
  check('a coloured 1 x 1 character is written as 3 + 9 bytes', out1(chx, 33) === 0 && chx[rec(chx, 33) + 3 + 8] === 7);
}
function out1(out, code) { return out[rec(out, code)]; }

// ── FontCodec carries the attributes ─────────────────────────────────────────
{
  const colours = Array.from({ length: 96 }, () => null);
  colours[65 - 32] = Uint8Array.from([0x47, 0x0A, 0x80, 0xFF]);
  const d = doc(2, 2, 96, colours);
  const p = FontCodec.encode(d);
  check('a coloured font encodes', !!p);
  check('a font with colours is stored as version 2', p.v === FontCodec.VERSION_BIG);
  const back = FontCodec.decode(p);
  check('decode gives the colours back', back && back.colours && same(back.colours[65 - 32], [0x47, 0x0A, 0x80, 0xFF]));
  check('uncoloured glyphs decode as null', back.colours[0] === null && back.colours[95] === null);
  check('a classic 8 x 8 font with colours is version 2 too (v1 cannot hold them)', (() => {
    const c = Array.from({ length: 96 }, () => null); c[3] = Uint8Array.from([0x42]);
    const q = FontCodec.encode(doc(1, 1, 96, c));
    const b = FontCodec.decode(q);
    return q.v === 2 && q.h === 8 && b.colours[3][0] === 0x42 && b.width === 8 && b.height === 8;
  })());
  check('an uncoloured font decodes with colours null', FontCodec.decode(FontCodec.encode(doc(2, 2, 96, null))).colours === null);
  check('colours of the wrong length are refused', FontCodec.encode({ ...d, colours: colours.slice(1) }) === null);
  check('a colour list with a wrong block count is refused', (() => {
    const c = colours.slice(); c[4] = Uint8Array.from([1, 2]); return FontCodec.encode({ ...d, colours: c }) === null;
  })());
  check('a damaged colour field is refused on decode', FontCodec.decode({ ...p, c: 'AAAA' }) === null);
  // the heaviest font still fits the cap
  const heavy = { name: 'h', width: 32, height: 32, firstCode: 0, glyphs: Array.from({ length: 256 }, () => new Uint8Array(128).fill(0xA5)),
    shade: Array.from({ length: 256 }, () => [1, 1]), colours: Array.from({ length: 256 }, () => new Uint8Array(16).fill(0x47)) };
  const hp = FontCodec.encode(heavy);
  check('the heaviest coloured font (256 x 32x32, all shaded and coloured) fits FontCodec.MAX_JSON_BYTES', !!hp && JSON.stringify(hp).length <= FontCodec.MAX_JSON_BYTES, hp ? String(JSON.stringify(hp).length) : 'null');
}
summary();
