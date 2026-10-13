'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Pins the bytes classic (8-row, up to 8-wide) fonts export as, and what the stored
// codec payload is, so the big-font work (Batch 10C) cannot change them. The expected
// values were recorded from the code BEFORE that work.
installStubs({ FontService: {}, SCRFormat: {} });
loadModule('js/io/font-format.js');
loadModule('js/utils/font-codec.js');

function makeDoc(width, firstCode, count) {
  const glyphs = [];
  const mask = (0xFF << (8 - width)) & 0xFF;
  for (let i = 0; i < count; i++) {
    glyphs.push(Uint8Array.from({ length: 8 }, (_, y) => ((i * 41 + y * 13 + 7) & 0xFF) & mask));
  }
  return { name: 'pin', width, firstCode, glyphs };
}
function fnv(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
const cases = [
  ['ch4', 4, 0, 256], ['ch6', 6, 0, 256], ['ch8', 8, 0, 256],
  ['chr', 8, 0, 256], ['chr', 8, 32, 96], ['chx', 8, 0, 256], ['chx', 8, 32, 96]
];
const got = {};
for (const [ext, w, first, count] of cases) {
  const bytes = FontFormat.exportFont(makeDoc(w, first, count), ext);
  got[`${ext}:${w}:${first}:${count}`] = bytes.length + ':' + fnv(bytes);
}
const enc = FontCodec.encode(makeDoc(6, 32, 96));
got.codec = JSON.stringify(enc).length + ':' + fnv(Buffer.from(JSON.stringify(enc)));
if (process.env.PIN_PRINT) console.log(JSON.stringify(got, null, 1));
const want = require('./helpers/font-output-pin.json');
for (const k of Object.keys(want)) check(`classic output pinned: ${k}`, got[k] === want[k], `${got[k]} vs ${want[k]}`);
check('every pinned case is covered', Object.keys(want).length === Object.keys(got).length);
summary();
