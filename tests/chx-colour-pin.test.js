'use strict';
/**
 * PIN for coloured CHX characters (owner decision 2026-10-19). Taken from the code BEFORE the feature was built
 * (2026-10-20): an uncoloured font must keep saving, byte for byte, what it saved before - as a .chx, a .ch8, and in the
 * font store / library (FontCodec). A document that carries a colours list in which no character is coloured is the
 * same as one with no list at all.
 */
const crypto = require('crypto');
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({ FontService: {}, SCRFormat: {} });
loadModule('js/io/dev-format.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');
loadModule('js/io/font-format.js');
const F = FontFormat;
const G = GlyphBits;
const sha = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex').slice(0, 16);
const json = (o) => Buffer.from(JSON.stringify(o));

function bigDoc(cols, rows, first, count, shade) {
  const w = cols * 8, h = rows * 8;
  const glyphs = [];
  for (let i = 0; i < count; i++) glyphs.push(Uint8Array.from({ length: G.byteLength(w, h) }, (_, k) => (i * 29 + k * 5 + 1) & 0xFF));
  return { name: 't', width: w, height: h, firstCode: first, glyphs, shade: shade || null };
}
function shadeOf(count) {
  const s = Array.from({ length: count }, () => [0, 0]);
  s[65 - 32] = [1, 0]; s[66 - 32] = [0, 1]; s[68 - 32] = [0, 3];
  return s;
}
const noColours = (doc) => ({ ...doc, colours: doc.glyphs.map(() => null) });

// Captured 2026-10-20 from commit ffe8747 (before coloured characters)
const PIN = {
  classicChx: '59ad14c415d2f945',
  bigChx: '7bfc797b46fff432',
  shadedChx: '6cbc67385ea3b51f',
  fullChx: '6b9d2019b35f86d1',
  ch8: 'b315356e44a5ae74',
  codecClassic: 'f07283a07df03b34',
  codecBig: 'bb63a7ea91e4c1d9'
};

const cases = [
  ['classicChx', () => bigDoc(1, 1, 32, 96), (d) => F.exportFont(d, 'chx')],
  ['bigChx', () => bigDoc(3, 2, 32, 96), (d) => F.exportFont(d, 'chx')],
  ['shadedChx', () => bigDoc(3, 2, 32, 96, shadeOf(96)), (d) => F.exportFont(d, 'chx')],
  ['fullChx', () => bigDoc(2, 4, 0, 256), (d) => F.exportFont(d, 'chx')],
  ['ch8', () => bigDoc(1, 1, 32, 96), (d) => F.exportFont(d, 'ch8')],
  ['codecClassic', () => bigDoc(1, 1, 32, 96), (d) => json(FontCodec.encode(d))],
  ['codecBig', () => bigDoc(3, 2, 32, 96, shadeOf(96)), (d) => json(FontCodec.encode(d))]
];
for (const [name, make, save] of cases) {
  check(`${name}: an uncoloured font saves the same bytes as before`, sha(save(make())) === PIN[name], sha(save(make())));
  check(`${name}: ...also when it carries a colours list with nothing coloured`, sha(save(noColours(make()))) === PIN[name]);
}

// An uncoloured .chx read back and saved again is still the same file
{
  const out = F.exportFont(bigDoc(3, 2, 32, 96, shadeOf(96)), 'chx');
  const back = F.parseFont(out, 'chx');
  const again = F.exportFont(back.font, 'chx');
  check('an uncoloured .chx: export, import, export gives the pinned bytes', sha(again) === PIN.shadedChx);
  check('every record of an uncoloured font is written transparent', (() => {
    for (let c = 0; c < 256; c++) { const o = out[5 + c * 2] | (out[6 + c * 2] << 8); if (o && out[o] !== 1) return false; }
    return true;
  })());
}
summary();
