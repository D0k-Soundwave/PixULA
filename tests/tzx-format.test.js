'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const testScreen = new Uint8Array(6912);
for (let i = 0; i < 6912; i++) testScreen[i] = (i * 11 + 3) & 0xFF;

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
loadModule('js/io/tap-format.js');   // real TAP handler — TZX builds on it
loadModule('js/io/tzx-format.js');

// --- export ---
const tzx = TZXFormat.export({ border: 0, name: 'screen' });
const SIG = 'ZXTape!';
check('signature', String.fromCharCode(...tzx.slice(0, 7)) === SIG && tzx[7] === 0x1A);
check('version 1.20', tzx[8] === 1 && tzx[9] === 20);

// walk ID 0x10 blocks: [0x10][pause lo hi][len lo hi][body]
const bodies = [];
let pos = 10;
while (pos < tzx.length) {
  check(`block at ${pos} is ID 0x10`, tzx[pos] === 0x10);
  const len = tzx[pos + 3] | (tzx[pos + 4] << 8);
  bodies.push(tzx.slice(pos + 5, pos + 5 + len));
  pos += 5 + len;
}
check('file consumed exactly', pos === tzx.length);
check('4 data blocks', bodies.length === 4);

// each body is a TAP block body: flag..checksum, checksum = XOR(flag,data)
bodies.forEach((b, i) => {
  let x = 0;
  for (let j = 0; j < b.length - 1; j++) x ^= b[j];
  check(`body ${i} checksum`, x === b[b.length - 1]);
});
check('body 3 is the screen', bodies[3][0] === 0xFF &&
  bodies[3].slice(1, -1).every((v, i) => v === testScreen[i]));

// bodies must equal TAPFormat's block bodies exactly
const tap = TAPFormat.export({ border: 0, name: 'screen' });
let tpos = 0; const tapBodies = [];
while (tpos + 2 <= tap.length) {
  const len = tap[tpos] | (tap[tpos + 1] << 8);
  tapBodies.push(tap.slice(tpos + 2, tpos + 2 + len));
  tpos += 2 + len;
}
check('TZX bodies identical to TAP bodies', bodies.every((b, i) =>
  b.length === tapBodies[i].length && b.every((v, j) => v === tapBodies[i][j])));

// --- import: round-trip ---
parsedPayload = null;
check('parse round-trip', TZXFormat.parse(tzx.buffer).success === true &&
  parsedPayload.every((v, i) => v === testScreen[i]));

// --- import: skips text (0x30), pause (0x20) and turbo (0x11) blocks ---
function id10(body) {
  return [0x10, 0xE8, 0x03, body.length & 0xFF, body.length >> 8, ...body];
}
const screenBody = [0xFF, ...testScreen];
let x = 0; for (const b of screenBody) x ^= b;
screenBody.push(x);
const turboJunk = new Array(100).fill(9);
const mixed = new Uint8Array([
  ...[...SIG].map(c => c.charCodeAt(0)), 0x1A, 1, 20,
  0x30, 5, 104, 101, 108, 108, 111,                       // text description "hello"
  0x20, 0xE8, 0x03,                                        // pause
  0x11, ...new Array(15).fill(0), turboJunk.length & 0xFF, // turbo block, junk data
    (turboJunk.length >> 8) & 0xFF, 0, ...turboJunk,
  ...id10(screenBody)
]);
parsedPayload = null;
check('parse skips non-screen TZX blocks', TZXFormat.parse(mixed.buffer).success === true &&
  parsedPayload.every((v, i) => v === testScreen[i]));

// --- import: skips a Custom Info Block (0x35: 16-byte ID + DWORD len + data) ---
const customData = [1, 2, 3, 4, 5, 6, 7, 8];
const withCustom = new Uint8Array([
  ...[...SIG].map(c => c.charCodeAt(0)), 0x1A, 1, 20,
  0x35, ...new Array(16).fill(0x41), customData.length & 0xFF, 0, 0, 0, ...customData,
  ...id10(screenBody)
]);
parsedPayload = null;
check('parse skips custom info block (0x35)', TZXFormat.parse(withCustom.buffer).success === true &&
  parsedPayload.every((v, i) => v === testScreen[i]));

// --- import failures ---
check('reject bad signature', TZXFormat.parse(new Uint8Array(20).buffer).success === false);
const noScreen = new Uint8Array([...[...SIG].map(c => c.charCodeAt(0)), 0x1A, 1, 20, ...id10([0xFF, 1, 2, 3, 0xFF])]);
check('report missing screen', TZXFormat.parse(noScreen.buffer).success === false);

summary();
