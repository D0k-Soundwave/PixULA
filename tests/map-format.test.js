'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/map-find.js');
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

// -- elements travel in a .zxtm file, and a file from before elements still loads (Batch 11A) ----------------------------------------------
{
  const b = MapFind.make(2, 1, 8, 1);
  for (let i = 0; i < b.bitmap.length; i++) b.bitmap[i] = (i * 17) & 255;
  b.attrs[0] = 0x3A; b.attrs[1] = 0x46;
  MapService.loadDocument(makeDoc());
  MapService.addElement(b, [{ x: 4, y: 2 }, { x: 10, y: 7 }], { match: 'visual', name: 'Pair', gridW: 32, gridH: 24 });
  const bytes = MapFormat.export();
  MapService.loadDocument({ ...makeDoc(), elements: [] });
  check('(the working document has no elements now)', MapService.getElements().length === 0);
  const r = MapFormat.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const e = MapService.getElements()[0];
  check('a .zxtm file carries the elements back', r.success && MapService.getElements().length === 1 && e.name === 'Pair' && e.match === 'visual' && e.w === 2 && e.positions.length === 2);
  const v1 = new TextEncoder().encode(JSON.stringify({ v: 1, k: 'ula-cell', name: 'old', tiles: [{ b: 'AQIDBAUGBwg=', a: 56 }], map: { w: 1, h: 1, cells: 'AQA=' } }));
  const r1 = MapFormat.parse(v1.buffer.slice(v1.byteOffset, v1.byteOffset + v1.byteLength));
  check('a version 1 .zxtm file (written before elements) imports and does NOT wipe the elements', r1.success && MapService.getElements().length === 1);
  check('map files never replace the picture (no discard question, the picture keeps its name)', MapFormat.importsDocument === false);
}

summary();
