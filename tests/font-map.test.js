'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-map.js');
const M = FontMap;
const G = GlyphBits;

const mkGlyphs = (gw, gh, count) => Array.from({ length: count }, (_, i) =>
  Uint8Array.from({ length: G.byteLength(gw, gh) }, (_, k) => G.normalise(Uint8Array.of((i * 37 + k * 11 + 5) & 0xFF), 8, 1)[0]));
const normGlyphs = (gs, gw, gh) => gs.map(g => G.normalise(Uint8Array.from(g), gw, gh));
const same = (a, b) => a.length === b.length && a.every((g, i) => g.length === b[i].length && g.every((v, k) => v === b[i][k]));

// layout
{
  const l = M.layout(8, 8, 96);
  check('96 glyphs of 8 x 8: 16 x 6 cells, 128 x 48 pixels', l.cols === 16 && l.rows === 6 && l.width === 128 && l.height === 48);
  const big = M.layout(32, 32, 256);
  check('256 glyphs of 32 x 32: 512 x 512', big.width === 512 && big.height === 512);
  check('glyphRect of index 17 at 8 x 8 is (8, 8)', JSON.stringify(M.glyphRect(17, 8, 8)) === JSON.stringify({ x: 8, y: 8, w: 8, h: 8 }));
}

// cellAt
{
  check('cellAt (0,0) is glyph 0', M.cellAt(0, 0, 16, 16, 96).index === 0);
  check('cellAt on the boundary: x = 15 is glyph 0, x = 16 is glyph 1', M.cellAt(15, 3, 16, 16, 96).index === 0 && M.cellAt(16, 3, 16, 16, 96).index === 1);
  const c = M.cellAt(16 * 3 + 9, 16 * 2 + 5, 16, 16, 96);
  check('cellAt gives the position inside the glyph and its 8-pixel column', c.index === 2 * 16 + 3 && c.lx === 9 && c.ly === 5 && c.col8 === 1);
  check('cellAt outside the map or past the last glyph is null', M.cellAt(-1, 0, 8, 8, 96) === null && M.cellAt(128, 0, 8, 8, 96) === null && M.cellAt(0, 48, 8, 8, 96) === null);
  check('cellAt in the unused cells of the last row is null', M.cellAt(8 * 12, 8 * 5, 8, 8, 90) === null && M.cellAt(8 * 9, 8 * 5, 8, 8, 90) !== null);
}

// compose / decompose round trips
for (const [gw, gh, count] of [[4, 8, 96], [6, 8, 96], [8, 8, 96], [8, 8, 256], [16, 24, 256], [32, 32, 256], [24, 8, 96]]) {
  const glyphs = normGlyphs(mkGlyphs(gw, gh, count), gw, gh);
  const map = M.compose(glyphs, gw, gh);
  const l = M.layout(gw, gh, count);
  const back = M.decompose(map, glyphs.map(g => new Uint8Array(g.length)), gw, gh, Array.from({ length: count }, (_, i) => i));
  check(`compose then decompose is identity at ${gw}x${gh} x ${count}`, map.length === l.width * l.height && same(back, glyphs));
}

// decompose only touches the listed glyphs
{
  const glyphs = normGlyphs(mkGlyphs(8, 8, 96), 8, 8);
  const map = M.compose(glyphs, 8, 8);
  M.setPixel(map, 8 * 3 + 2, 4, true, 8, 8, 96);                   // glyph 3
  const out = M.decompose(map, glyphs, 8, 8, [3]);
  check('decompose rebuilds only the listed glyph', out.every((g, i) => i === 3 || g.every((v, k) => v === glyphs[i][k])) && G.getPixel(out[3], 8, 2, 4));
  check('decompose does not change the input list', glyphs[3] !== out[3]);
  const none = M.decompose(map, glyphs, 8, 8, []);
  check('an empty index list returns an equal copy', same(none, glyphs) && none[0] !== glyphs[0]);
}

// line across a boundary touches exactly two glyphs
{
  const map = new Uint8Array(128 * 48);
  const touched = new Set();
  M.line(map, 4, 3, 12, 3, true, 8, 8, 96, touched);
  check('a horizontal line across a boundary touches exactly two glyphs', touched.size === 2 && touched.has(0) && touched.has(1));
  check('and sets every pixel on the way', [4, 5, 6, 7, 8, 9, 10, 11, 12].every(x => map[3 * 128 + x] === 1) && map[3 * 128 + 13] === 0);
  const t2 = new Set();
  M.line(map, 0, 0, 20, 20, true, 8, 8, 96, t2);
  check('a diagonal line touches every glyph it crosses', t2.has(0) && t2.has(17) && t2.has(34));
  const t3 = new Set();
  M.line(map, 125, 3, 140, 3, true, 8, 8, 96, t3);
  check('a line running off the map stops at its edge without error', t3.size === 1 && t3.has(15));
}

// bounded fill
{
  const gw = 8, gh = 8, count = 96;
  const map = new Uint8Array(128 * 48);
  const t = M.fillInside(map, 10, 3, true, gw, gh, count);          // glyph 1, empty paper
  check('fill on empty paper fills the clicked glyph and returns its index', t.length === 1 && t[0] === 1);
  let inside = 0, outside = 0;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 128; x++) if (map[y * 128 + x]) { if (x >= 8 && x < 16 && y < 8) inside++; else outside++; }
  check('and nothing outside it', inside === 64 && outside === 0);
  check('filling what is already that value changes nothing', M.fillInside(map, 10, 3, true, gw, gh, count).length === 0);
  // a ring: fill inside it only
  const ring = new Uint8Array(128 * 48);
  for (let i = 0; i < 8; i++) { ring[i] = 1; ring[7 * 128 + i] = 1; ring[i * 128] = 1; ring[i * 128 + 7] = 1; }
  M.fillInside(ring, 3, 3, true, gw, gh, count);
  check('fill inside a ring fills only the inside', ring[3 * 128 + 3] === 1 && ring[3 * 128 + 8] === 0 && ring[8 * 128 + 3] === 0);
  check('fill outside the map does nothing', M.fillInside(map, -1, 0, true, gw, gh, count).length === 0);
  const erase = new Uint8Array(128 * 48).fill(1);
  M.fillInside(erase, 20, 3, false, gw, gh, count);
  check('erase-fill clears the clicked glyph only', erase[3 * 128 + 20] === 0 && erase[3 * 128 + 8] === 1 && erase[3 * 128 + 24] === 1);
}

// time (recorded in docs/FIGURES.md)
{
  const glyphs = normGlyphs(mkGlyphs(32, 32, 256), 32, 32);
  const run = () => {
    const a = process.hrtime.bigint();
    const map = M.compose(glyphs, 32, 32);
    const b = process.hrtime.bigint();
    M.decompose(map, glyphs, 32, 32, Array.from({ length: 256 }, (_, i) => i));
    const c = process.hrtime.bigint();
    return [Number(b - a) / 1e6, Number(c - b) / 1e6];
  };
  const r1 = run(), r2 = run();
  if (process.env.FONTMAP_TIME) console.log('compose/decompose ms', r1, r2);
  check('compose + decompose of the heaviest font is under a frame (16.7 ms) each [C: 1000/60]', Math.max(r1[0], r2[0], r1[1], r2[1]) < 16.7, JSON.stringify([r1, r2]));
}
summary();
