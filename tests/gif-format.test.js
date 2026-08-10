'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Synthetic screen: patterned bitmap, attrs cycling ink/paper/bright,
// FLASH set on the first attribute row.
const SCR_SIZE = 6912, BITMAP = 6144, ATTRS = 768;
const testScreen = new Uint8Array(SCR_SIZE);
for (let i = 0; i < BITMAP; i++) testScreen[i] = (i * 11 + 3) & 0xFF;
for (let i = 0; i < ATTRS; i++) {
  const ink = i & 7, paper = (i + 3) & 7, bright = (i >> 4) & 1, flash = i < 32 ? 1 : 0;
  testScreen[BITMAP + i] = (flash << 7) | (bright << 6) | (paper << 3) | ink;
}

installStubs({
  SCRFormat: { export: () => testScreen.slice() }
});
loadModule('js/io/gif-format.js');

// ── Reference GIF-LZW decoder ───────────────────────────────────────────────
function lzwDecode(bytes, minCodeSize) {
  const CLEAR = 1 << minCodeSize, EOI = CLEAR + 1;
  let codeSize, table, next, prev, cur = 0, curBits = 0, idx = 0;
  const reset = () => {
    table = [];
    for (let i = 0; i < CLEAR; i++) table[i] = [i];
    next = EOI + 1;
    codeSize = minCodeSize + 1;
    prev = null;
  };
  reset();
  const out = [];
  for (;;) {
    while (curBits < codeSize) {
      if (idx >= bytes.length) throw new Error('LZW stream truncated');
      cur |= bytes[idx++] << curBits;
      curBits += 8;
    }
    const code = cur & ((1 << codeSize) - 1);
    cur >>= codeSize;
    curBits -= codeSize;

    if (code === CLEAR) { reset(); continue; }
    if (code === EOI) return out;

    let entry;
    if (code < next && table[code]) entry = table[code];
    else if (code === next && prev) entry = prev.concat(prev[0]); // KwKwK
    else throw new Error(`bad LZW code ${code} (next=${next})`);

    for (const v of entry) out.push(v);
    if (prev && next < 4096) {
      table[next++] = prev.concat(entry[0]);
      if (next === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
}

// Walk a GIF byte stream into its structural parts
function parseGif(gif) {
  const u16 = (p) => gif[p] | (gif[p + 1] << 8);
  const out = { width: u16(6), height: u16(8), packed: gif[10], bg: gif[11], aspect: gif[12] };
  out.signature = String.fromCharCode(...gif.slice(0, 6));
  const gctLen = 3 * (1 << ((out.packed & 7) + 1));
  out.gct = gif.slice(13, 13 + gctLen);
  let pos = 13 + gctLen;
  out.extensions = [];
  out.frames = [];
  while (pos < gif.length) {
    const b = gif[pos];
    if (b === 0x3B) { out.trailer = pos; break; }
    if (b === 0x21) { // extension
      const label = gif[pos + 1];
      let p = pos + 2;
      const data = [];
      while (gif[p] !== 0) { data.push(...gif.slice(p + 1, p + 1 + gif[p])); p += 1 + gif[p]; }
      out.extensions.push({ label, data: Uint8Array.from(data) });
      pos = p + 1;
    } else if (b === 0x2C) { // image descriptor
      const frame = {
        left: u16(pos + 1), top: u16(pos + 3),
        width: u16(pos + 5), height: u16(pos + 7),
        packed: gif[pos + 9], minCodeSize: gif[pos + 10]
      };
      let p = pos + 11;
      const data = [];
      while (gif[p] !== 0) { data.push(...gif.slice(p + 1, p + 1 + gif[p])); p += 1 + gif[p]; }
      frame.indices = lzwDecode(Uint8Array.from(data), frame.minCodeSize);
      out.frames.push(frame);
      pos = p + 1;
    } else {
      throw new Error(`unexpected GIF byte 0x${b.toString(16)} at ${pos}`);
    }
  }
  return out;
}

// ── screenToIndices ─────────────────────────────────────────────────────────
const idx0 = GIFFormat.screenToIndices(testScreen, 0);
const idx1 = GIFFormat.screenToIndices(testScreen, 1);
check('index buffer covers the screen', idx0.length === 256 * 192);

{
  // Hand-check pixel (0,0): bitmap byte 0 bit 7, attr 0
  const attr = testScreen[BITMAP];
  const ink = (attr & 7) + ((attr >> 6) & 1) * 8;
  const paper = ((attr >> 3) & 7) + ((attr >> 6) & 1) * 8;
  const set = (testScreen[0] & 0x80) !== 0;
  check('pixel (0,0) resolves ink/paper correctly', idx0[0] === (set ? ink : paper));
  // Same pixel in flash phase 1: attr row 0 has FLASH set -> swapped
  check('flash phase swaps ink/paper in flashing cells', idx1[0] === (set ? paper : ink));
}
{
  // Cell row 1 (y=8) has no FLASH -> phases identical there
  const rowStart = 8 * 256;
  let same = true;
  for (let i = 0; i < 256; i++) if (idx0[rowStart + i] !== idx1[rowStart + i]) { same = false; break; }
  check('non-flash cells identical across phases', same);
  check('flash cells differ across phases', idx0.some((v, i) => i < 256 && v !== idx1[i]));
}
{
  // Interleave check: y=1 reads bitmap offset 256 (not 32)
  const attr = testScreen[BITMAP]; // still attr row 0
  const ink = (attr & 7) + ((attr >> 6) & 1) * 8;
  const paper = ((attr >> 3) & 7) + ((attr >> 6) & 1) * 8;
  const set = (testScreen[256] & 0x80) !== 0;
  check('ULA interleave: pixel (0,1) reads bitmap byte 256', idx0[256] === (set ? ink : paper));
}
check('screenHasFlash true on test screen', GIFFormat.screenHasFlash(testScreen) === true);
{
  const noFlash = testScreen.slice();
  for (let i = 0; i < ATTRS; i++) noFlash[BITMAP + i] &= 0x7F;
  check('screenHasFlash false when no FLASH bits', GIFFormat.screenHasFlash(noFlash) === false);
}

// ── static export: full structural walk ─────────────────────────────────────
{
  const gif = GIFFormat.export();
  const g = parseGif(gif);
  check('signature GIF89a', g.signature === 'GIF89a');
  check('logical screen 256x192', g.width === 256 && g.height === 192);
  check('LSD packed: GCT, 8-bit res, 16 entries', g.packed === 0xF3);
  check('background index 0, aspect 0', g.bg === 0 && g.aspect === 0);
  check('GCT is the 16-colour ZX palette',
    g.gct.length === 48 && ZX_PALETTE_RGB.every((rgb, i) =>
      g.gct[i * 3] === rgb[0] && g.gct[i * 3 + 1] === rgb[1] && g.gct[i * 3 + 2] === rgb[2]));
  check('static GIF has no extension blocks', g.extensions.length === 0);
  check('one frame at (0,0) full size, no LCT, not interlaced',
    g.frames.length === 1 && g.frames[0].left === 0 && g.frames[0].top === 0 &&
    g.frames[0].width === 256 && g.frames[0].height === 192 && g.frames[0].packed === 0);
  check('LZW min code size 4', g.frames[0].minCodeSize === 4);
  check('frame decodes to phase-0 indices',
    g.frames[0].indices.length === idx0.length &&
    g.frames[0].indices.every((v, i) => v === idx0[i]));
  check('trailer is last byte', g.trailer === gif.length - 1 && gif[gif.length - 1] === 0x3B);
}

// ── animated export: two FLASH phases ───────────────────────────────────────
{
  const gif = GIFFormat.export({ animated: true });
  const g = parseGif(gif);
  const app = g.extensions.filter(e => e.label === 0xFF);
  const gce = g.extensions.filter(e => e.label === 0xF9);
  check('animated: NETSCAPE2.0 loop extension present',
    app.length === 1 && String.fromCharCode(...app[0].data.slice(0, 11)) === 'NETSCAPE2.0' &&
    app[0].data[11] === 1 && app[0].data[12] === 0 && app[0].data[13] === 0);
  check('animated: two graphic control blocks with 32cs delay',
    gce.length === 2 && gce.every(e => (e.data[1] | (e.data[2] << 8)) === 32));
  check('animated: two frames', g.frames.length === 2);
  check('animated: frame 1 = phase 0', g.frames[0].indices.every((v, i) => v === idx0[i]));
  check('animated: frame 2 = phase 1', g.frames[1].indices.every((v, i) => v === idx1[i]));
}
{
  const noFlash = testScreen.slice();
  for (let i = 0; i < ATTRS; i++) noFlash[BITMAP + i] &= 0x7F;
  const saved = SCRFormat.export;
  SCRFormat.export = () => noFlash.slice();
  const g = parseGif(GIFFormat.export({ animated: true }));
  SCRFormat.export = saved;
  check('animated request without FLASH cells falls back to static',
    g.frames.length === 1 && g.extensions.length === 0);
}

// ── LZW stress: table overflow, code-width boundaries, runs ────────────────
{
  const cases = {
    'single pixel': [7],
    'flat run': new Array(5000).fill(3),
    'alternating pair': Array.from({ length: 4000 }, (_, i) => i & 1 ? 12 : 5)
  };
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF) >> 16 & 15;
  cases['random noise (forces table clears)'] = Array.from({ length: 256 * 192 }, rnd);

  for (const [name, input] of Object.entries(cases)) {
    const packed = GIFFormat._lzwEncode(Uint8Array.from(input), 4);
    let ok = false, detail = '';
    try {
      const decoded = lzwDecode(packed, 4);
      ok = decoded.length === input.length && decoded.every((v, i) => v === input[i]);
      if (!ok) detail = `len ${decoded.length} vs ${input.length}`;
    } catch (e) { detail = e.message; }
    check(`LZW round-trip: ${name}`, ok, detail);
  }
  check('LZW of empty input is CLEAR+EOI only', (() => {
    const packed = GIFFormat._lzwEncode(new Uint8Array(0), 4);
    return lzwDecode(packed, 4).length === 0;
  })());
}

summary();
