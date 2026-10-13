'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');

function bigDoc(width, height, first, count, shade) {
  const bytes = GlyphBits.byteLength(width, height);
  const glyphs = [];
  for (let i = 0; i < count; i++) glyphs.push(Uint8Array.from({ length: bytes }, (_, k) => (i * 31 + k * 7 + 3) & 0xFF));
  return { name: 'big', width, height, firstCode: first, glyphs, shade: shade || null };
}
const same = (a, b) => a.width === b.width && a.height === b.height && a.firstCode === b.firstCode &&
  a.glyphs.length === b.glyphs.length && a.glyphs.every((g, i) => g.length === b.glyphs[i].length && g.every((v, k) => v === b.glyphs[i][k]));

// classic stays version 1 and byte-identical (the pin test checks the exact bytes)
const classic = { name: 'c', width: 8, height: 8, firstCode: 32, glyphs: bigDoc(8, 8, 32, 96).glyphs, shade: null };
const cEnc = FontCodec.encode(classic);
check('a classic font (8 high, no shading) is still version 1', cEnc && cEnc.v === 1 && cEnc.h === undefined);
const cDec = FontCodec.decode(cEnc);
check('a version 1 payload decodes with height 8 and no shading', cDec && cDec.height === 8 && cDec.shade === null);
const noHeight = { name: 'c', width: 8, firstCode: 32, glyphs: classic.glyphs };
check('a document with no height field is treated as height 8', FontCodec.encode(noHeight) && FontCodec.encode(noHeight).v === 1);

// big fonts round-trip in version 2
for (const [w, h] of [[8, 16], [16, 8], [16, 16], [24, 32], [32, 32]]) {
  const doc = bigDoc(w, h, 0, 256);
  const enc = FontCodec.encode(doc);
  const dec = enc && FontCodec.decode(JSON.parse(JSON.stringify(enc)));
  check(`${w}x${h} x 256 round-trips as version 2`, enc && enc.v === 2 && dec && same(doc, dec));
  check(`${w}x${h} x 256 fits the size cap`, enc && JSON.stringify(enc).length <= FontCodec.MAX_JSON_BYTES, enc ? String(JSON.stringify(enc).length) : 'null');
}

// shading
const sh = bigDoc(24, 16, 32, 96);
const shade = sh.glyphs.map((_, i) => [i % 2, (i % 3 === 0) ? 1 : 0]);
sh.shade = shade;
const shEnc = FontCodec.encode(sh);
const shDec = FontCodec.decode(JSON.parse(JSON.stringify(shEnc)));
check('shading round-trips', shDec && shDec.shade && shDec.shade.every((p, i) => p[0] === shade[i][0] && p[1] === shade[i][1]));
const classicShaded = { ...classic, shade: classic.glyphs.map((_, i) => [0, i === 5 ? 1 : 0]) };
const csEnc = FontCodec.encode(classicShaded);
check('a classic-size font with shading is stored as version 2', csEnc && csEnc.v === 2);
check('all-zero shading is dropped (stays version 1)', FontCodec.encode({ ...classic, shade: classic.glyphs.map(() => [0, 0]) }).v === 1);
check('shading wider than the character is refused', FontCodec.encode({ ...sh, shade: sh.glyphs.map(() => [3, 1]) }) === null);
check('negative shading is refused', FontCodec.encode({ ...sh, shade: sh.glyphs.map(() => [-1, 0]) }) === null);
check('shade list of the wrong length is refused', FontCodec.encode({ ...sh, shade: [[0, 0]] }) === null);

// rejects
check('width 12 is refused', FontCodec.encode(bigDoc(12, 8, 0, 4)) === null);
check('height 12 is refused', FontCodec.encode(bigDoc(8, 12, 0, 4)) === null);
check('width 40 is refused', FontCodec.encode(bigDoc(40, 8, 0, 4)) === null);
check('height 40 is refused', FontCodec.encode(bigDoc(8, 40, 0, 4)) === null);
check('a narrow (4 or 6 wide) font cannot be tall', FontCodec.encode(bigDoc(6, 16, 0, 4)) === null);
check('glyph of the wrong length is refused', FontCodec.encode({ ...bigDoc(16, 16, 0, 4), glyphs: [new Uint8Array(8), new Uint8Array(8), new Uint8Array(8), new Uint8Array(8)] }) === null);
const good2 = FontCodec.encode(bigDoc(16, 16, 0, 4));
check('decode rejects a version 2 payload with a wrong byte count', FontCodec.decode({ ...good2, count: 3 }) === null);
check('decode rejects a version 2 payload with bad height', FontCodec.decode({ ...good2, h: 12 }) === null);
check('decode rejects shading data of the wrong length', FontCodec.decode({ ...good2, s: 'AAA=' }) === null);
check('decode rejects shading that is wider than the character', (() => {
  const d = FontCodec.encode({ ...bigDoc(16, 16, 0, 4), shade: [[1, 0], [0, 1], [0, 0], [0, 0]] });
  const bad = { ...d, s: Helpers.encodeBase64(Uint8Array.from([2, 1, 0, 0, 0, 0, 0, 0])) };
  return FontCodec.decode(bad) === null;
})());
summary();
