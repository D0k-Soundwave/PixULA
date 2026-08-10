'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/font-codec.js');

function makeDoc(width, firstCode, count, name = 'test') {
  const glyphs = [];
  const mask = (0xFF << (8 - width)) & 0xFF;
  for (let i = 0; i < count; i++) {
    glyphs.push(Uint8Array.from({ length: 8 }, (_, y) => ((i * 37 + y * 11) & 0xFF) & mask));
  }
  return { name, width, firstCode, glyphs };
}

function docsEqual(a, b) {
  if (a.name !== b.name || a.width !== b.width || a.firstCode !== b.firstCode) return 'meta';
  if (a.glyphs.length !== b.glyphs.length) return 'glyph count';
  for (let i = 0; i < a.glyphs.length; i++) {
    for (let y = 0; y < 8; y++) {
      if (a.glyphs[i][y] !== b.glyphs[i][y]) return `glyph ${i} byte ${y}`;
    }
  }
  return true;
}

// ── pure round-trips ────────────────────────────────────────────────────────
for (const [w, first, count] of [[8, 32, 96], [8, 0, 256], [6, 32, 96], [4, 0, 256], [8, 0, 1]]) {
  const doc = makeDoc(w, first, count);
  const enc = FontCodec.encode(doc);
  const dec = enc && FontCodec.decode(JSON.parse(JSON.stringify(enc)));
  const result = dec ? docsEqual(doc, dec) : 'null';
  check(`round-trip ${w}px wide, ${count} glyphs @ ${first}`, result === true, String(result));
}

// JSON-serializability + size cap on the maximum font
{
  const enc = FontCodec.encode(makeDoc(8, 0, 256));
  const json = JSON.stringify(enc);
  check('max-size payload is JSON-safe and within the size cap',
    json.length > 0 && json.length <= FontCodec.MAX_JSON_BYTES, `${json.length} bytes`);
  check('payload is versioned', enc.v === FontCodec.VERSION);
}

// Encode normalizes rows: bits beyond the width are masked off
{
  const doc = makeDoc(4, 32, 96);
  doc.glyphs[0] = Uint8Array.from([0xFF, 0xFF, 0, 0, 0, 0, 0, 0]);
  const dec = FontCodec.decode(FontCodec.encode(doc));
  check('encode masks row bits beyond the font width',
    dec.glyphs[0][0] === 0xF0 && dec.glyphs[0][1] === 0xF0);
}

// ── rejection paths ─────────────────────────────────────────────────────────
check('encode rejects null', FontCodec.encode(null) === null);
check('encode rejects illegal width', FontCodec.encode(makeDoc(5, 32, 96)) === null);
check('encode rejects empty glyph list', FontCodec.encode(makeDoc(8, 32, 0)) === null);
check('encode rejects coverage past code 255', FontCodec.encode(makeDoc(8, 32, 256)) === null);
check('encode rejects wrong glyph length', FontCodec.encode({
  ...makeDoc(8, 32, 2),
  glyphs: [new Uint8Array(8), new Uint8Array(7)]
}) === null);

{
  const good = FontCodec.encode(makeDoc(8, 32, 96));
  check('decode rejects unknown version', FontCodec.decode({ ...good, v: 99 }) === null);
  check('decode rejects illegal width', FontCodec.decode({ ...good, w: 7 }) === null);
  check('decode rejects corrupt base64', FontCodec.decode({ ...good, g: '!!bad!!' }) === null);
  check('decode rejects glyph-count/byte-length mismatch',
    FontCodec.decode({ ...good, count: 95 }) === null);
  check('decode rejects coverage past code 255',
    FontCodec.decode({ ...good, first: 200 }) === null);
  check('decode rejects non-object', FontCodec.decode(undefined) === null);
}

summary();
