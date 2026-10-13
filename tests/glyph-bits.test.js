'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
loadModule('js/utils/glyph-bits.js');
const G = GlyphBits;

check('bytes per row: 4 -> 1, 8 -> 1, 9 -> 2, 16 -> 2, 32 -> 4',
  G.bytesPerRow(4) === 1 && G.bytesPerRow(8) === 1 && G.bytesPerRow(9) === 2 && G.bytesPerRow(16) === 2 && G.bytesPerRow(32) === 4);
check('glyph size: 8x8 -> 8 bytes, 16x24 -> 48 bytes, 32x32 -> 128 bytes',
  G.byteLength(8, 8) === 8 && G.byteLength(16, 24) === 48 && G.byteLength(32, 32) === 128);

// pixel access, classic and wide
let g = G.create(6, 8);
G.setPixel(g, 6, 0, 0, true); G.setPixel(g, 6, 5, 7, true);
check('classic 6-wide: (0,0) is bit 0x80 of byte 0', g[0] === 0x80);
check('classic 6-wide: (5,7) is bit 0x04 of byte 7', g[7] === 0x04);
check('getPixel reads them back', G.getPixel(g, 6, 0, 0) && G.getPixel(g, 6, 5, 7) && !G.getPixel(g, 6, 1, 1));
check('a pixel outside the glyph is refused and reads clear',
  G.setPixel(g, 6, 6, 0, true) === false && G.getPixel(g, 6, 6, 0) === false && G.getPixel(g, 6, -1, 0) === false);
const w = G.create(16, 8);
G.setPixel(w, 16, 9, 2, true);
check('16-wide: x=9 is bit 0x40 of the second byte of row 2 (index 5)', w[5] === 0x40 && w[4] === 0);

// normalise masks the spare bits of a narrow glyph only
const dirty = Uint8Array.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
G.normalise(dirty, 4, 8);
check('normalise: 4-wide keeps the high nibble', dirty.every(b => b === 0xF0));
const wideDirty = Uint8Array.from({ length: 16 }, () => 0xFF);
G.normalise(wideDirty, 16, 8);
check('normalise: 16-wide keeps all bits', wideDirty.every(b => b === 0xFF));

// flips, shifts, invert at 4-wide (classic) and 16-wide
const f = Uint8Array.from([0x80, 0, 0, 0, 0, 0, 0, 0x10]);
G.flipH(f, 4, 8);
check('flipH 4-wide moves column 0 to column 3', f[0] === 0x10 && f[7] === 0x80);
const f16 = G.create(16, 8);
G.setPixel(f16, 16, 0, 0, true); G.setPixel(f16, 16, 3, 1, true);
G.flipH(f16, 16, 8);
check('flipH 16-wide moves x=0 to x=15 and x=3 to x=12', G.getPixel(f16, 16, 15, 0) && G.getPixel(f16, 16, 12, 1) && !G.getPixel(f16, 16, 0, 0));
const v = G.create(8, 16); G.setPixel(v, 8, 2, 0, true);
G.flipV(v, 8, 16);
check('flipV 8x16 moves row 0 to row 15', G.getPixel(v, 8, 2, 15) && !G.getPixel(v, 8, 2, 0));
const s = G.create(16, 8); G.setPixel(s, 16, 15, 3, true);
G.shift(s, 16, 8, 'right');
check('shift right wraps x=15 to x=0 (16-wide)', G.getPixel(s, 16, 0, 3) && !G.getPixel(s, 16, 15, 3));
G.shift(s, 16, 8, 'left');
check('shift left wraps x=0 back to x=15', G.getPixel(s, 16, 15, 3));
const s2 = G.create(6, 8); G.setPixel(s2, 6, 5, 0, true);
G.shift(s2, 6, 8, 'right');
check('shift right wraps within a 6-wide glyph', G.getPixel(s2, 6, 0, 0) && s2[0] === 0x80);
const u = G.create(8, 8); G.setPixel(u, 8, 0, 0, true);
G.shift(u, 8, 8, 'up');
check('shift up wraps row 0 to row 7', G.getPixel(u, 8, 0, 7));
G.shift(u, 8, 8, 'down');
check('shift down wraps it back', G.getPixel(u, 8, 0, 0));
const inv = G.create(6, 8); G.invert(inv, 6, 8);
check('invert 6-wide sets only 6 bits per row', inv.every(b => b === 0xFC));
const inv16 = G.create(16, 8); G.invert(inv16, 16, 8);
check('invert 16-wide sets all bits', inv16.every(b => b === 0xFF));

// blocks: CHX stores 8x8 blocks, rows of blocks left to right then down
const big = G.create(16, 16);
G.setPixel(big, 16, 0, 0, true);      // block (0,0) row 0 -> 0x80
G.setPixel(big, 16, 8, 0, true);      // block (1,0) row 0 -> 0x80
G.setPixel(big, 16, 0, 8, true);      // block (0,1) row 0
G.setPixel(big, 16, 15, 15, true);    // block (1,1) row 7 -> 0x01
const blocks = G.toBlocks(big, 16, 16);
check('toBlocks: 4 blocks of 8 bytes', blocks.length === 32);
check('toBlocks order: row-major blocks (0,0) (1,0) (0,1) (1,1)', blocks[0] === 0x80 && blocks[8] === 0x80 && blocks[16] === 0x80 && blocks[31] === 0x01);
check('fromBlocks inverts toBlocks', (() => { const back = G.fromBlocks(blocks, 2, 2); return back.length === big.length && back.every((b, i) => b === big[i]); })());
check('1x1 blocks equal the glyph bytes', (() => { const c = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]); return G.toBlocks(c, 8, 8).every((b, i) => b === c[i]); })());

// resize keeps the top-left, pads with blank
const r = G.create(8, 8); G.setPixel(r, 8, 7, 7, true);
const r2 = G.resize(r, 8, 8, 16, 16);
check('resize to 16x16 keeps (7,7) and pads blank', r2.length === 32 && G.getPixel(r2, 16, 7, 7) && !G.getPixel(r2, 16, 8, 8));
const r3 = G.resize(r2, 16, 16, 8, 8);
check('resize back to 8x8 crops to the top-left', r3.length === 8 && G.getPixel(r3, 8, 7, 7));

// column ink: the left and right edges of the ink, in pixels
const ink = G.create(16, 8); G.setPixel(ink, 16, 3, 2, true); G.setPixel(ink, 16, 10, 5, true);
const e = G.inkEdges(ink, 16, 8);
check('inkEdges: leftmost 3, rightmost 10', e.left === 3 && e.right === 10);
check('inkEdges of a blank glyph is null', G.inkEdges(G.create(16, 8), 16, 8) === null);

// autoShade: whole empty 8-pixel columns on each side of the used span
check('autoShade: ink in the first 5 pixels of a 32-wide cell shades 3 columns on the right', G.autoShade({ left: 0, right: 4 }, 6, 32, 'left').join() === '0,3');
check('autoShade: ink exactly 8 wide leaves 3 columns', G.autoShade({ left: 0, right: 7 }, 8, 32, 'left').join() === '0,3');
check('autoShade: ink 9 wide needs 2 columns', G.autoShade({ left: 0, right: 8 }, 9, 32, 'left').join() === '0,2');
check('autoShade: a centred narrow letter shades both sides', G.autoShade({ left: 12, right: 19 }, 8, 32, 'centre').join() === '1,1');
check('autoShade: a right-aligned letter shades the left', G.autoShade({ left: 27, right: 31 }, 6, 32, 'right').join() === '3,0');
check('autoShade: a blank Space uses its advance width (left): 6 px -> one column kept', G.autoShade(null, 6, 32, 'left').join() === '0,3');
check('autoShade: a blank Space right-aligned keeps the right column', G.autoShade(null, 6, 32, 'right').join() === '3,0');
check('autoShade: a blank with no advance still keeps one column', G.autoShade(null, 0, 24, 'centre').join() === '1,1');
check('autoShade: a full-width letter shades nothing', G.autoShade({ left: 0, right: 31 }, 32, 32, 'left').join() === '0,0');
check('autoShade never shades all columns', [[null, 0], [{ left: 31, right: 31 }, 1]].every(([e, adv]) => { const [l, r] = G.autoShade(e, adv, 32, 'left'); return l + r <= 3; }));

// shadeAfterClick: every column of 1 to 4 column characters from four starting states
{
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
  let ok = true, why = '';
  const want = (shade, cols, k, exp) => { const got = G.shadeAfterClick(shade, cols, k); if (!eq(got, exp)) { ok = false; why += ` [${shade}] cols${cols} k${k} -> ${got} wanted ${exp};`; } };
  // cols 3, nothing shaded
  want([0, 0], 3, 0, [1, 0]); want([0, 0], 3, 1, [0, 2]); want([0, 0], 3, 2, [0, 1]);
  // cols 4, nothing shaded: nearer edge, tie to the right
  want([0, 0], 4, 0, [1, 0]); want([0, 0], 4, 1, [2, 0]); want([0, 0], 4, 2, [0, 2]); want([0, 0], 4, 3, [0, 1]);
  // cols 1, 2
  want([0, 0], 1, 0, [0, 1]); want([0, 0], 2, 0, [1, 0]); want([0, 0], 2, 1, [0, 1]);
  // clicking a shaded column un-shades it and everything outward of it
  want([2, 0], 4, 0, [0, 0]); want([2, 0], 4, 1, [1, 0]); want([0, 2], 4, 2, [0, 1]); want([0, 2], 4, 3, [0, 0]);
  want([1, 1], 3, 0, [0, 1]); want([1, 1], 3, 2, [1, 0]);
  // a click in the middle with the other side already shaded never overlaps
  want([1, 1], 4, 1, [2, 1]); want([1, 1], 4, 2, [1, 2]);
  want([1, 2], 4, 1, [2, 2]);
  check('shadeAfterClick table' + why, ok);
  check('shadeAfterClick ignores a column outside the character', eq(G.shadeAfterClick([1, 0], 3, 5), [1, 0]) && eq(G.shadeAfterClick([1, 0], 3, -1), [1, 0]));
  check('shadeAfterClick never shades more than the character', [1, 2, 3, 4].every(c => [[0, 0], [1, 0], [0, 1]].every(s0 => Array.from({ length: c }, (_, k) => G.shadeAfterClick(s0.map(v => Math.min(v, c)), c, k)).every(r => r[0] + r[1] <= c))));
  check('shadeStep grows and shrinks one side', eq(G.shadeStep([0, 0], 3, 'left', 1), [1, 0]) && eq(G.shadeStep([1, 1], 3, 'right', -1), [1, 0]));
  check('shadeStep refuses to go below 0 or past the width', G.shadeStep([0, 0], 3, 'left', -1) === null && G.shadeStep([2, 1], 3, 'right', 1) === null && G.shadeStep([3, 0], 3, 'left', 1) === null);
}
summary();
