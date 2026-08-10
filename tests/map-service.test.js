'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const events = [];
installStubs({
  EventBus: { emit(name, data) { events.push(name); }, on() {} }
});
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');

const S = MapService;

// ── attr byte packing ───────────────────────────────────────────────────────
check('attrByte packs FLASH|BRIGHT|PAPER|INK',
  S.attrByte({ ink: 2, paper: 6, bright: true, flash: false }) === 0x72);
check('attrByte/attrFields are inverses', (() => {
  for (let a = 0; a < 256; a++) {
    if (S.attrByte(S.attrFields(a)) !== a) return false;
  }
  return true;
})());

// ── tile creation ───────────────────────────────────────────────────────────
{
  const t = S.createTile([1, 2, 3], 0x47);
  check('createTile pads the bitmap to cell height',
    t.bitmap.length === 8 && t.bitmap[0] === 1 && t.bitmap[2] === 3 && t.bitmap[7] === 0);
  check('createTile tags the kind', t.kind === 'ula-cell');
}
{
  const bitmap = new Uint8Array(64);
  bitmap[0] = 1;            // (0,0)
  bitmap[8 + 7] = 1;        // (7,1)
  const t = S.tileFromPattern({ width: 8, height: 8, bitmap },
    { ink: 1, paper: 7, bright: false, flash: false });
  check('tileFromPattern packs MSB-left rows',
    t && t.bitmap[0] === 0x80 && t.bitmap[1] === 0x01 && t.attr === 0x39);
  check('tileFromPattern rejects non-tile-sized patterns',
    S.tileFromPattern({ width: 16, height: 16, bitmap: new Uint8Array(256) },
      { ink: 0, paper: 7, bright: false, flash: false }) === null);
}

// ── tileset ops ─────────────────────────────────────────────────────────────
S.newMap(10, 6, true);
const tA = S.createTile([0xFF, 0, 0, 0, 0, 0, 0, 0], 0x38);
const tB = S.createTile([0, 0xFF, 0, 0, 0, 0, 0, 0], 0x47);
const tC = S.createTile([0, 0, 0xFF, 0, 0, 0, 0, 0], 0x56);
const iA = S.addTile(tA), iB = S.addTile(tB), iC = S.addTile(tC);
check('addTile returns sequential indices', iA === 0 && iB === 1 && iC === 2);
check('addTile dedups byte-identical tiles',
  S.addTile(S.createTile([0xFF, 0, 0, 0, 0, 0, 0, 0], 0x38)) === 0 && S.tileCount() === 3);
check('addTile without dedup appends', (() => {
  const i = S.addTile(S.createTile([0xFF, 0, 0, 0, 0, 0, 0, 0], 0x38), false);
  const ok = i === 3 && S.tileCount() === 4;
  S.removeTile(3);
  return ok;
})());

// ── map ops ─────────────────────────────────────────────────────────────────
check('setMapCell places a tile', S.setMapCell(2, 3, iB) && S.getMapCell(2, 3) === iB);
check('setMapCell erases with -1', S.setMapCell(2, 3, -1) && S.getMapCell(2, 3) === -1);
check('setMapCell rejects out-of-bounds placement quietly',
  S.setMapCell(10, 0, iA) === false && S.setMapCell(0, 6, iA) === false &&
  S.setMapCell(-1, 0, iA) === false);
check('setMapCell rejects dangling tile index', S.setMapCell(0, 0, 99) === false);
check('getMapCell out of bounds returns -1', S.getMapCell(-1, -1) === -1);

// flood fill: paint a frame of A, fill inside with C
S.clearMap();
for (let x = 0; x < 10; x++) { S.setMapCell(x, 0, iA); S.setMapCell(x, 5, iA); }
for (let y = 0; y < 6; y++) { S.setMapCell(0, y, iA); S.setMapCell(9, y, iA); }
S.floodFill(4, 2, iC);
check('floodFill fills the enclosed empty region',
  S.getMapCell(4, 2) === iC && S.getMapCell(8, 4) === iC && S.getMapCell(1, 1) === iC);
check('floodFill does not leak across the frame',
  S.getMapCell(0, 0) === iA && S.getMapCell(9, 5) === iA);
check('floodFill into same index is a no-op', S.floodFill(4, 2, iC) === false);

// resize preserving the top-left overlap
S.resizeMap(4, 3);
check('resizeMap clips to the new size',
  S.getMap().width === 4 && S.getMap().height === 3 && S.getMapCell(0, 0) === iA);
S.resizeMap(12, 8);
check('resizeMap grows with empty cells',
  S.getMapCell(0, 0) === iA && S.getMapCell(11, 7) === -1 && S.getMapCell(1, 1) === iC);

// removeTile remaps the map
S.clearMap();
S.setMapCell(0, 0, iA); S.setMapCell(1, 0, iB); S.setMapCell(2, 0, iC);
S.removeTile(iB);
check('removeTile empties its cells and shifts higher indices',
  S.getMapCell(0, 0) === 0 && S.getMapCell(1, 0) === -1 && S.getMapCell(2, 0) === 1 &&
  S.tileCount() === 2);

// newMap clamps to limits
S.newMap(0, 100000);
check('newMap clamps dimensions to [1, MAX_DIM]',
  S.getMap().width === 1 && S.getMap().height === S.MAX_DIM);

// facts announced on the bus
check('mutations announce MAP_CHANGED / MAP_TILESET_CHANGED facts',
  events.includes('map:changed') && events.includes('map:tilesetChanged'));

clearTimeout(S._persistTimer); // let Node exit
summary();
