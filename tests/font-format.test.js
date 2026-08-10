'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// FontFormat's plumbing needs FontService/EventBus only in parse(); the
// byte math under test (parseFont/exportFont) is pure. DevFormat needs
// SCRFormat only for screen exports, not for generateFont.
installStubs({ FontService: {}, SCRFormat: {} });
loadModule('js/io/font-format.js');
loadModule('js/io/dev-format.js');

function makeDoc(width, firstCode, count) {
  const glyphs = [];
  const mask = (0xFF << (8 - width)) & 0xFF;
  for (let i = 0; i < count; i++) {
    glyphs.push(Uint8Array.from({ length: 8 }, (_, y) => ((i * 41 + y * 13 + 7) & 0xFF) & mask));
  }
  return { name: 'test', width, firstCode, glyphs };
}

function fontsEqual(a, b) {
  if (a.width !== b.width || a.firstCode !== b.firstCode) return 'meta';
  if (a.glyphs.length !== b.glyphs.length) return 'glyph count';
  for (let i = 0; i < a.glyphs.length; i++) {
    for (let y = 0; y < 8; y++) {
      if (a.glyphs[i][y] !== b.glyphs[i][y]) return `glyph ${i} byte ${y}`;
    }
  }
  return true;
}

// ── export -> import round-trips for every extension ────────────────────────
// The synthetic font's width matches each format so the identity holds
// (CH4/CH6 mask to their width; CHR/CHX/CH8 don't carry width at all).
for (const [ext, width, first, count] of [
  ['ch4', 4, 0, 256],
  ['ch6', 6, 0, 256],
  ['ch8', 8, 0, 256],
  ['chr', 8, 0, 256],
  ['chr', 8, 32, 96],
  ['chx', 8, 0, 256],
  ['chx', 8, 32, 96]
]) {
  const doc = makeDoc(width, first, count);
  const bytes = FontFormat.exportFont(doc, ext);
  const result = FontFormat.parseFont(bytes, ext);
  const eq = result.success ? fontsEqual(doc, result.font) : result.error;
  check(`${ext} round-trip (${count} glyphs @ ${first})`, eq === true, String(eq));
}

// ── size / header byte checks ───────────────────────────────────────────────
check('ch4/ch6/ch8 exports are 2048 bytes', ['ch4', 'ch6', 'ch8'].every(ext =>
  FontFormat.exportFont(makeDoc(8, 32, 96), ext).length === 2048));
check('chr export of a 96-char font is 768 bytes',
  FontFormat.exportFont(makeDoc(8, 32, 96), 'chr').length === 768);
check('chr export of a 256-char font is 2048 bytes',
  FontFormat.exportFont(makeDoc(8, 0, 256), 'chr').length === 2048);
check('ch4 export masks rows to the high nibble', (() => {
  const doc = makeDoc(8, 0, 256); // 8-wide data forced through the 4-wide format
  return Array.from(FontFormat.exportFont(doc, 'ch4')).every(b => (b & 0x0F) === 0);
})());
check('96-char font exported as ch8 lands at codes 32..127', (() => {
  const doc = makeDoc(8, 32, 96);
  const bytes = FontFormat.exportFont(doc, 'ch8');
  const below = bytes.subarray(0, 32 * 8).every(b => b === 0);
  const above = bytes.subarray(128 * 8).every(b => b === 0);
  return below && above && bytes[32 * 8] === doc.glyphs[0][0];
})());
{
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  check('chx export starts with the CHX signature + version 0',
    bytes[0] === 0x43 && bytes[1] === 0x48 && bytes[2] === 0x58 &&
    bytes[3] === 0 && bytes[4] === 0);
  check('chx export size = header + offset table + 11 bytes per glyph',
    bytes.length === 5 + 512 + 96 * 11);
  check('chx export leaves codes outside the coverage undefined',
    bytes[5 + 31 * 2] === 0 && bytes[6 + 31 * 2] === 0 &&
    (bytes[5 + 32 * 2] | (bytes[6 + 32 * 2] << 8)) === 5 + 512);
  check('chx records are transparent 1×1 char maps',
    bytes[5 + 512] === 1 && bytes[5 + 512 + 1] === 1 && bytes[5 + 512 + 2] === 1);
}

// ── import edge cases ───────────────────────────────────────────────────────
check('chr import of 768 bytes sets the 96-char coverage at space', (() => {
  const r = FontFormat.parseFont(new Uint8Array(768), 'chr');
  return r.success && r.font.firstCode === 32 && r.font.glyphs.length === 96;
})());
check('ch4 import masks stray low-nibble bits', (() => {
  const bytes = new Uint8Array(2048).fill(0xFF);
  const r = FontFormat.parseFont(bytes, 'ch4');
  return r.success && r.font.glyphs.every(g => g.every(b => b === 0xF0));
})());
check('chx import takes the top-left cell of a multi-cell coloured char', (() => {
  // One 2×2 coloured char at code 65: blocks of 9 bytes (8 bitmap + attr)
  const record = [0, 2, 2];
  for (let cell = 0; cell < 4; cell++) {
    for (let y = 0; y < 8; y++) record.push(cell * 16 + y);
    record.push(0x38); // attr
  }
  const bytes = new Uint8Array(5 + 512 + record.length);
  bytes.set([0x43, 0x48, 0x58, 0, 0], 0);
  bytes[5 + 65 * 2] = (5 + 512) & 0xFF;
  bytes[6 + 65 * 2] = (5 + 512) >> 8;
  bytes.set(record, 5 + 512);
  const r = FontFormat.parseFont(bytes, 'chx');
  return r.success && r.font.getGlyph === undefined &&
    r.font.glyphs[65 - 32][0] === 0 && r.font.glyphs[65 - 32][7] === 7 &&
    r.font.firstCode === 32; // 65 is inside 32..127 -> ASCII coverage
})());
check('chx import with a code below 32 selects full coverage', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 0, 256), 'chx');
  const r = FontFormat.parseFont(bytes, 'chx');
  return r.success && r.font.firstCode === 0 && r.font.glyphs.length === 256;
})());

// ── rejection paths ─────────────────────────────────────────────────────────
check('ch8 rejects a wrong file size', !FontFormat.parseFont(new Uint8Array(2047), 'ch8').success);
check('ch8 rejects the 768-byte size (CHR-only variant)',
  !FontFormat.parseFont(new Uint8Array(768), 'ch8').success);
check('chr rejects a wrong file size', !FontFormat.parseFont(new Uint8Array(1024), 'chr').success);
check('chx rejects a truncated file', !FontFormat.parseFont(new Uint8Array(300), 'chx').success);
check('chx rejects a bad signature', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  bytes[0] = 0x58;
  return !FontFormat.parseFont(bytes, 'chx').success;
})());
check('chx rejects a wrong version number', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  bytes[3] = 1;
  const r = FontFormat.parseFont(bytes, 'chx');
  return !r.success && /version/i.test(r.error);
})());
check('chx rejects an out-of-range character offset', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  bytes[5 + 40 * 2] = 0xFF; bytes[6 + 40 * 2] = 0xFF;
  return !FontFormat.parseFont(bytes, 'chx').success;
})());
check('chx rejects an illegal character size', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  bytes[5 + 512 + 1] = 5; // columns = 5 (> 32×32 px)
  return !FontFormat.parseFont(bytes, 'chx').success;
})());
check('chx rejects a truncated character record', (() => {
  const bytes = FontFormat.exportFont(makeDoc(8, 32, 96), 'chx');
  return !FontFormat.parseFont(bytes.subarray(0, bytes.length - 4), 'chx').success;
})());
check('chx rejects a file with no characters', (() => {
  const bytes = new Uint8Array(5 + 512 + 11);
  bytes.set([0x43, 0x48, 0x58, 0, 0], 0);
  return !FontFormat.parseFont(bytes, 'chx').success;
})());

// ── DevFormat font export ───────────────────────────────────────────────────
{
  const doc = makeDoc(6, 32, 96);
  const bin = DevFormat.generateFont('bin', 'myfont', doc);
  check('DevFormat bin is the raw glyph bytes', bin.length === 768 && bin[0] === doc.glyphs[0][0]);
  const asm = new TextDecoder().decode(DevFormat.generateFont('asm', 'my font', doc));
  check('DevFormat asm has the label and DEFB rows',
    asm.includes('my_font_font:') && asm.includes('DEFB') && asm.includes('first character code 32'));
  const c = new TextDecoder().decode(DevFormat.generateFont('c', 'myfont', doc));
  check('DevFormat c has the defines and array',
    c.includes('MYFONT_FONT_FIRST 32') && c.includes('MYFONT_FONT_WIDTH 6') &&
    c.includes('const unsigned char myfont_font[768]'));
}

summary();
