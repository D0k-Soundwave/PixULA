'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const testScreen = new Uint8Array(6912);
for (let i = 0; i < 6912; i++) testScreen[i] = (i * 7 + 13) & 0xFF;

let parsedPayload = null;
installStubs({
  SCRFormat: {
    export: () => testScreen.slice(),
    parse: (buffer) => {
      parsedPayload = new Uint8Array(buffer);
      return { success: parsedPayload.length === 6912 };
    }
  }
});
loadModule('js/io/tap-format.js');

// --- export and walk the blocks ---
const tap = TAPFormat.export({ border: 1, name: 'testscreen' });
const blocks = [];
let pos = 0;
while (pos + 2 <= tap.length) {
  const len = tap[pos] | (tap[pos + 1] << 8);
  blocks.push(tap.slice(pos + 2, pos + 2 + len));
  pos += 2 + len;
}
check('file consumed exactly by block walk', pos === tap.length);
check('4 blocks', blocks.length === 4, `got ${blocks.length}`);

blocks.forEach((b, i) => {
  let x = 0;
  for (let j = 0; j < b.length - 1; j++) x ^= b[j];
  check(`block ${i} checksum`, x === b[b.length - 1]);
});

const h1 = blocks[0];
check('hdr1 flag 0x00 / Program / 17 bytes', h1[0] === 0x00 && h1[1] === 0 && h1.length === 19);
check('hdr1 name', String.fromCharCode(...h1.slice(2, 12)) === 'testscreen');
const basicLen = h1[12] | (h1[13] << 8);
check('hdr1 autostart 10, vars offset = length',
  (h1[14] | (h1[15] << 8)) === 10 && (h1[16] | (h1[17] << 8)) === basicLen);

const basic = blocks[1].slice(1, blocks[1].length - 1);
check('data1 flag 0xFF, length matches header', blocks[1][0] === 0xFF && basic.length === basicLen);
check('line number 10 big-endian', basic[0] === 0x00 && basic[1] === 10);
check('line length field', (basic[2] | (basic[3] << 8)) === basic.length - 4);

const NUM = (n) => [...String(n)].map(c => c.charCodeAt(0)).concat([0x0E, 0, 0, n & 0xFF, (n >> 8) & 0xFF, 0]);
const expected = [
  0xE7, ...NUM(1), 0x3A, 0xDA, ...NUM(1), 0x3A, 0xD9, ...NUM(7), 0x3A,
  0xFB, 0x3A, 0xEF, 0x22, 0x22, 0xAA, 0x3A, 0xF2, ...NUM(0), 0x0D
];
const stmt = Array.from(basic.slice(4));
check('tokenized loader bytes exact',
  stmt.length === expected.length && stmt.every((v, i) => v === expected[i]));

const h2 = blocks[2];
check('hdr2 Bytes/6912/16384/32768',
  h2[1] === 3 && (h2[12] | (h2[13] << 8)) === 6912 &&
  (h2[14] | (h2[15] << 8)) === 16384 && (h2[16] | (h2[17] << 8)) === 32768);

const screenOut = blocks[3].slice(1, blocks[3].length - 1);
check('screen payload matches source',
  screenOut.length === 6912 && screenOut.every((v, i) => v === testScreen[i]));

// --- import ---
check('parse round-trip', TAPFormat.parse(tap.buffer).success === true &&
  parsedPayload.every((v, i) => v === testScreen[i]));

function tapBlock(flag, data) {
  const len = data.length + 2;
  const out = [len & 0xFF, len >> 8, flag, ...data];
  let x = flag; for (const b of data) x ^= b;
  out.push(x);
  return out;
}
const messy = new Uint8Array([
  ...tapBlock(0x00, new Array(17).fill(1)),
  ...tapBlock(0xFF, [1, 2, 3, 4, 5]),
  ...tapBlock(0xFF, Array.from(testScreen))
]);
parsedPayload = null;
check('parse skips non-screen blocks', TAPFormat.parse(messy.buffer).success === true &&
  parsedPayload.every((v, i) => v === testScreen[i]));
check('parse reports missing screen',
  TAPFormat.parse(new Uint8Array(tapBlock(0xFF, [1, 2, 3])).buffer).success === false);
check('border clamps without throwing', TAPFormat.export({ border: 99 }).length > 0);

summary();
