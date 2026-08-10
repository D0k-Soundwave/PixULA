'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');
loadModule('js/io/map-format.js');

function makeDoc() {
  const tiles = [];
  for (let t = 0; t < 6; t++) {
    tiles.push({
      kind: 'ula-cell',
      bitmap: Uint8Array.from({ length: 8 }, (_, y) => (t * 53 + y * 19 + 3) & 0xFF),
      attr: (t * 43 + 11) & 0xFF
    });
  }
  const width = 64, height = 48; // four screens
  const cells = new Int16Array(width * height);
  for (let i = 0; i < cells.length; i++) cells[i] = (i % 9 === 0) ? i % 6 : -1;
  return { name: 'native round-trip', tileKind: 'ula-cell', tiles, map: { width, height, cells } };
}

function docsEqual(a, b) {
  if (a.name !== b.name) return 'name';
  if (a.tiles.length !== b.tiles.length) return 'tile count';
  for (let i = 0; i < a.tiles.length; i++) {
    if (a.tiles[i].attr !== b.tiles[i].attr) return `tile ${i} attr`;
    for (let j = 0; j < 8; j++) {
      if (a.tiles[i].bitmap[j] !== b.tiles[i].bitmap[j]) return `tile ${i} byte ${j}`;
    }
  }
  if (a.map.width !== b.map.width || a.map.height !== b.map.height) return 'dims';
  for (let i = 0; i < a.map.cells.length; i++) {
    if (a.map.cells[i] !== b.map.cells[i]) return `cell ${i}`;
  }
  return true;
}

// ── export -> import round-trip through the real handler ────────────────────
{
  const doc = makeDoc();
  MapService.loadDocument(doc);

  const bytes = MapFormat.export();
  check('export produces bytes', bytes instanceof Uint8Array && bytes.length > 0);

  // The file is the documented JSON payload
  const payload = JSON.parse(Buffer.from(bytes).toString('utf8'));
  check('file is the versioned MapCodec payload',
    payload.v === MapCodec.VERSION && payload.k === 'ula-cell' &&
    payload.map.w === 64 && payload.map.h === 48 && payload.tiles.length === 6);

  // Wipe the working document, then import the bytes back
  MapService.loadDocument({
    name: '', tileKind: 'ula-cell', tiles: [],
    map: { width: 1, height: 1, cells: Int16Array.from([-1]) }
  });
  const result = MapFormat.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  check('import succeeds', result.success === true, result.error);
  const eq = docsEqual(doc, MapService.toDocument());
  check('imported document is identical', eq === true, String(eq));
}

// ── error paths ─────────────────────────────────────────────────────────────
check('import rejects non-JSON', (() => {
  const r = MapFormat.parse(new TextEncoder().encode('not json').buffer);
  return r.success === false && /JSON/.test(r.error);
})());
check('import rejects unknown versions', (() => {
  const r = MapFormat.parse(new TextEncoder().encode('{"v":99}').buffer);
  return r.success === false;
})());

clearTimeout(MapService._persistTimer); // let Node exit
summary();
