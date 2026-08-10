'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Fake Storage capturing the persisted payload (async like the real one)
const fakeStore = {};
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', MAPS: 'maps' },
    async set(key, value, store) { fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; },
    async delete(key, store) { delete fakeStore[`${store}/${key}`]; }
  }
});
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');

function makeDoc(tileCount, width, height) {
  const tiles = [];
  for (let t = 0; t < tileCount; t++) {
    tiles.push({
      kind: 'ula-cell',
      bitmap: Uint8Array.from({ length: 8 }, (_, y) => (t * 37 + y * 11) & 0xFF),
      attr: (t * 29 + 7) & 0xFF
    });
  }
  const cells = new Int16Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = (i % (tileCount + 3)) < tileCount ? i % tileCount : -1;
  }
  return { name: `doc-${tileCount}`, tileKind: 'ula-cell', tiles, map: { width, height, cells } };
}

function docsEqual(a, b) {
  if (a.name !== b.name || a.tileKind !== b.tileKind) return 'meta';
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

// ── pure round-trips ────────────────────────────────────────────────────────
for (const [t, w, h] of [[1, 1, 1], [4, 32, 24], [17, 100, 3], [64, 256, 256]]) {
  const doc = makeDoc(t, w, h);
  const enc = MapCodec.encode(doc);
  const dec = enc && MapCodec.decode(JSON.parse(JSON.stringify(enc)));
  const result = dec ? docsEqual(doc, dec) : 'null';
  check(`round-trip ${t} tiles, ${w}x${h} map`, result === true, String(result));
}

// JSON-serializability + size cap on the maximum map
{
  const enc = MapCodec.encode(makeDoc(64, 256, 256));
  const json = JSON.stringify(enc);
  check('max-size payload is JSON-safe and within the size cap',
    json.length > 0 && json.length <= MapCodec.MAX_JSON_BYTES, `${json.length} bytes`);
  check('payload is versioned and kind-tagged',
    enc.v === MapCodec.VERSION && enc.k === MapCodec.TILE_KINDS.ULA_CELL);
}

// ── rejection paths ─────────────────────────────────────────────────────────
check('encode rejects null', MapCodec.encode(null) === null);
check('encode rejects unknown tile kind',
  MapCodec.encode({ ...makeDoc(2, 4, 4), tileKind: 'next-bank' }) === null);
check('encode rejects oversized map',
  MapCodec.encode(makeDoc(2, 257, 4)) === null);
check('encode rejects wrong bitmap length', MapCodec.encode({
  ...makeDoc(1, 2, 2),
  tiles: [{ kind: 'ula-cell', bitmap: new Uint8Array(7), attr: 0 }]
}) === null);
{
  const doc = makeDoc(3, 8, 8);
  doc.map.cells[0] = 3; // out of tileset range
  check('encode rejects out-of-range tile index', MapCodec.encode(doc) === null);
}
{
  const good = MapCodec.encode(makeDoc(3, 8, 6));
  check('decode rejects unknown version', MapCodec.decode({ ...good, v: 99 }) === null);
  check('decode rejects unknown kind', MapCodec.decode({ ...good, k: 'next-bank' }) === null);
  check('decode rejects corrupt cells base64',
    MapCodec.decode({ ...good, map: { ...good.map, cells: '!!bad!!' } }) === null);
  check('decode rejects cell-length mismatch',
    MapCodec.decode({ ...good, map: { ...good.map, w: 5 } }) === null);
  check('decode rejects corrupt tile',
    MapCodec.decode({ ...good, tiles: [{ b: 'AA==', a: 0 }] }) === null);
  {
    // cells referencing a tile index beyond the tileset must be rejected
    const doc = makeDoc(3, 4, 4);
    const enc = MapCodec.encode(doc);
    const trimmed = { ...enc, tiles: enc.tiles.slice(0, 1) };
    check('decode rejects dangling tile indices', MapCodec.decode(trimmed) === null);
  }
  check('decode rejects non-object', MapCodec.decode(undefined) === null);
}

// ── persist/restore through the real MapService ────────────────────────────
(async () => {
  const doc = makeDoc(5, 40, 30);
  MapService.loadDocument(doc);
  await MapService.persist();

  check('persist writes to the MAPS store',
    !!fakeStore['maps/current'] && fakeStore['maps/current'].v === MapCodec.VERSION);

  MapService.tiles = [];
  MapService.map = { width: 1, height: 1, cells: Int16Array.from([-1]) };
  MapService.name = '';
  await MapService.restorePersisted();
  check('restore repopulates the working document',
    docsEqual(doc, MapService.toDocument()) === true,
    String(docsEqual(doc, MapService.toDocument())));

  // Unreadable payload -> discarded, store cleaned
  fakeStore['maps/current'] = { v: 99 };
  await MapService.restorePersisted();
  check('restore discards unreadable payloads and clears the store',
    fakeStore['maps/current'] === undefined);

  clearTimeout(MapService._persistTimer); // let Node exit
  summary();
})();
