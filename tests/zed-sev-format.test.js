'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Synthetic screen with distinct bitmap + attribute bytes everywhere
const testScreen = new Uint8Array(6912);
for (let i = 0; i < 6144; i++) testScreen[i] = (i * 13 + 7) & 0xFF;
for (let i = 0; i < 768; i++) testScreen[6144 + i] = (i * 3 + 1) & 0xFF;

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
loadModule('js/core/attribute-system.js');
loadModule('js/io/sev-format.js');
loadModule('js/io/zed-format.js');

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── SEV: header field byte checks against the SevenuP 1.21 spec ────────────
const sev = SEVFormat.export();
{
  check('SEV: signature Sev\\0', sev[0] === 0x53 && sev[1] === 0x65 && sev[2] === 0x76 && sev[3] === 0);
  check('SEV: version 0.8', sev[4] === 0 && sev[5] === 8);
  check('SEV: P1=1 plain, P2=0 single frame (LE)',
    sev[6] === 1 && sev[7] === 0 && sev[8] === 0 && sev[9] === 0);
  check('SEV: SX=256 SY=192 little-endian',
    (sev[10] | (sev[11] << 8)) === 256 && (sev[12] | (sev[13] << 8)) === 192);
  check('SEV: file length 14 + 768*9', sev.length === 14 + 768 * 9);

  // Cell 0 row-major layout: 8 bitmap bytes then the attribute byte
  const c0 = [];
  for (let j = 0; j < 8; j++) c0.push(testScreen[j * 256]); // rows of cell (0,0)
  check('SEV: cell 0 bitmap rows in linear order',
    c0.every((v, j) => sev[14 + j] === v));
  check('SEV: cell 0 attribute follows its bitmap', sev[22] === testScreen[6144]);
  // Cell (1,0) starts right after
  check('SEV: cells advance row-major', sev[23] === testScreen[1]);
}

// export -> import -> pixel+attr identical
{
  const decoded = SEVFormat.decodeToScreen(sev);
  check('SEV: decode succeeds', decoded.success === true);
  check('SEV: full-screen round-trip byte-identical', same(decoded.scr, testScreen));

  parsedPayload = null;
  check('SEV: parse() feeds SCRFormat the round-tripped screen',
    SEVFormat.parse(sev.buffer).success === true && same(parsedPayload, testScreen));
}

// Partial-size, masked and multi-frame variants
{
  // Hand-build a 16x8 v0.8 file (2 cells)
  const small = new Uint8Array(14 + 2 * 9);
  small.set([0x53, 0x65, 0x76, 0, 0, 8, 1, 0, 0, 0, 16, 0, 8, 0]);
  for (let i = 0; i < 18; i++) small[14 + i] = i + 1;
  const dec = SEVFormat.decodeToScreen(small);
  check('SEV: small graphic decodes', dec.success === true);
  check('SEV: small graphic lands at top-left with stored attrs',
    dec.scr[0] === 1 && dec.scr[256] === 2 && dec.scr[6144] === 9 &&
    dec.scr[1] === 10 && dec.scr[6145] === 18);
  check('SEV: rest of screen keeps default attr 0x38',
    dec.scr[6144 + 2] === 0x38 && dec.scr[6144 + 767] === 0x38 && dec.scr[2] === 0);

  // Masked (P1=2): mask bytes after the frame are ignored
  const masked = new Uint8Array(14 + 2 * 9 + 2 * 8);
  masked.set(small.subarray(0, 14 + 18));
  masked[6] = 2;
  masked.fill(0xEE, 14 + 18);
  const decM = SEVFormat.decodeToScreen(masked);
  check('SEV: masked file decodes ignoring the mask',
    decM.success === true && decM.scr[0] === 1 && decM.scr[6144] === 9);

  // Two frames (P2=1): only the first is used
  const twoF = new Uint8Array(14 + 2 * 9 * 2);
  twoF.set(small.subarray(0, 14 + 18));
  twoF[8] = 1;
  twoF.fill(0x77, 14 + 18);
  const decF = SEVFormat.decodeToScreen(twoF);
  check('SEV: multi-frame file uses frame 1 only',
    decF.success === true && decF.scr[0] === 1 && decF.scr[6144] === 9);

  // v0.0 accepted
  const v0 = small.slice();
  v0[5] = 0;
  check('SEV: v0.0 accepted', SEVFormat.decodeToScreen(v0).success === true);

  // Rejections
  check('SEV: bad signature rejected',
    SEVFormat.decodeToScreen(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])).success === false);
  const badVer = small.slice(); badVer[5] = 5;
  check('SEV: unknown version rejected', SEVFormat.decodeToScreen(badVer).success === false);
  const badSize = small.slice(); badSize[10] = 0x01; badSize[11] = 0x02; // SX=513
  check('SEV: oversize SX rejected', SEVFormat.decodeToScreen(badSize).success === false);
  check('SEV: truncated file rejected',
    SEVFormat.decodeToScreen(small.slice(0, 20)).success === false);
}

// ── ZED: header field byte checks against the ZX-Modules spec ──────────────
const zed = ZEDFormat.export();
{
  const SIG = 'Editor file for ZX-Edit (C) 1997 by Claus & Andy - V.';
  check('ZED: signature is the exact 53-byte string', SIG.length === 53 &&
    String.fromCharCode(...zed.slice(0, 53)) === SIG);
  check('ZED: version "1.00" then 0x1A',
    String.fromCharCode(...zed.slice(53, 57)) === '1.00' && zed[57] === 0x1A);
  check('ZED: line count 24 (LE)', (zed[58] | (zed[59] << 8)) === 24);
  check('ZED: first line size 320 = 32 coloured blocks',
    (zed[60] | (zed[61] << 8)) === 320);
  check('ZED: first block is #29 with cell-0 pixels + attr',
    zed[62] === 0x1D && zed[63] === testScreen[0] && zed[64] === testScreen[256] &&
    zed[71] === testScreen[6144]);
  check('ZED: total length 58 + 2 + 24*(2+320)', zed.length === 58 + 2 + 24 * 322);
}

// export -> import -> pixel+attr identical
{
  const decoded = ZEDFormat.decodeToScreen(zed);
  check('ZED: decode succeeds', decoded.success === true);
  check('ZED: full-screen round-trip byte-identical', same(decoded.scr, testScreen));

  parsedPayload = null;
  check('ZED: parse() feeds SCRFormat the round-tripped screen',
    ZEDFormat.parse(zed.buffer).success === true && same(parsedPayload, testScreen));
}

// Mixed text + control codes + blocks (a real document shape)
{
  const SIG = 'Editor file for ZX-Edit (C) 1997 by Claus & Andy - V.';
  const px = [1, 2, 3, 4, 5, 6, 7, 8];
  const line = [
    0x10, 2,                    // INK 2
    0x41, 0x42,                 // "AB" — advances two cells
    0x1B, 0x05, 0x01,           // font style (3 bytes)
    0x1D, ...px, 0x47,          // coloured block at column 2
    0x1C, ...px.map(v => v ^ 0xFF) // transparent block at column 3
  ];
  const doc = Uint8Array.from([
    ...[...SIG].map(c => c.charCodeAt(0)),
    ...[...'1.00'].map(c => c.charCodeAt(0)),
    0x1A,
    2, 0,                       // two lines
    line.length & 0xFF, line.length >> 8, ...line,
    0, 0                        // second line empty
  ]);
  const dec = ZEDFormat.decodeToScreen(doc);
  check('ZED: mixed document decodes', dec.success === true);
  check('ZED: text/control codes advance the cursor — block lands at cell 2',
    dec.scr[2] === 1 && dec.scr[2 + 256] === 2 && dec.scr[6144 + 2] === 0x47);
  check('ZED: transparent block keeps default attr',
    dec.scr[3] === (1 ^ 0xFF) && dec.scr[6144 + 3] === 0x38);
  check('ZED: untouched cells stay blank with default attr',
    dec.scr[0] === 0 && dec.scr[6144] === 0x38);
}

// Rejections
check('ZED: bad signature rejected',
  ZEDFormat.decodeToScreen(new Uint8Array(80)).success === false);
{
  const SIG = 'Editor file for ZX-Edit (C) 1997 by Claus & Andy - V.';
  const noBlocks = Uint8Array.from([
    ...[...SIG].map(c => c.charCodeAt(0)),
    ...[...'1.00'].map(c => c.charCodeAt(0)),
    0x1A, 1, 0, 2, 0, 0x41, 0x42
  ]);
  check('ZED: text-only document rejected as an image',
    ZEDFormat.decodeToScreen(noBlocks).success === false);
}

// canExport() mirrors the standard-layout gate export() throws on
__setActiveScreenMode('multicolor_8x2');
check('ZED canExport false in multicolor_8x2', ZEDFormat.canExport() === false);
check('SEV canExport false in multicolor_8x2', SEVFormat.canExport() === false);
__setActiveScreenMode('standard_ula');
check('ZED canExport true in standard_ula', ZEDFormat.canExport() === true);
check('SEV canExport true in standard_ula', SEVFormat.canExport() === true);

summary();
