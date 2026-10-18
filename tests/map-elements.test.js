'use strict';
/**
 * Batch 11A step 3: map elements (the result of a find) in the map document, and MapCodec version 2. Elements are self-contained: their own dots
 * and attribute bytes plus the places they were found at, so they do not depend on the tileset.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const fakeStore = {};
let failSet = false;
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', MAPS: 'maps' },
    async set(key, value, store) { if (failSet) throw new Error('quota'); fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; },
    async delete(key, store) { delete fakeStore[`${store}/${key}`]; }
  }
});
const events = [];
global.EventBus = { emit: (n, d) => events.push([n, d]), on() {} };
global.window.EventBus = global.EventBus;
loadModule('js/utils/map-find.js');
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');
const S = MapService;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function block(w, h, screens, seed) {
  const b = MapFind.make(w, h, 8, screens);
  for (let i = 0; i < b.bitmap.length; i++) b.bitmap[i] = (i * 37 + seed * 11) & 255;
  for (let i = 0; i < b.attrs.length; i++) b.attrs[i] = (i * 29 + seed) & 255;
  return b;
}
const meta = (o = {}) => ({ match: 'exact', name: 'Elem', gridW: 32, gridH: 24, ...o });

(async () => {
  // -- addElement --------------------------------------------------------------------------------------------------------------------
  const b1 = block(1, 1, 1, 1);
  events.length = 0;
  const r1 = S.addElement(b1, [{ x: 10, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 4 }], meta({ name: 'Circle' }));
  check('addElement returns its index', r1.ok === true && r1.index === 0);
  check('places are sorted into reading order and de-duplicated', eq(S.getElements()[0].positions, [{ x: 3, y: 4 }, { x: 10, y: 4 }]));
  check('it announces MAP_ELEMENTS_CHANGED', events.some(e => e[0] === EVENTS.MAP_ELEMENTS_CHANGED));
  const out = S.addElement(b1, [{ x: 32, y: 0 }], meta());
  check('a place outside the picture grid is refused, nothing is stored', out.ok === false && S.getElements().length === 1);
  check('a block that does not fit its grid is refused', S.addElement(block(33, 1, 1, 2), [{ x: 0, y: 0 }], meta()).ok === false);
  check('a mode that is not a match mode is refused', S.addElement(b1, [{ x: 0, y: 0 }], meta({ match: 'maybe' })).ok === false);
  check('no places is refused (the source is always one)', S.addElement(b1, [], meta()).ok === false);
  check('getElements returns copies: editing them does not change the document', (() => { const e = S.getElements(); e[0].name = 'x'; e[0].positions.length = 0; return S.getElements()[0].name === 'Circle' && S.getElements()[0].positions.length === 2; })());

  const b2 = block(3, 2, 2, 5);
  const r2 = S.addElement(b2, [{ x: 29, y: 22 }, { x: 0, y: 0 }], meta({ match: 'visual', name: 'Pair', gridW: 32, gridH: 24 }));
  check('a two-screen 3 x 2 element goes in, places at the bottom-right edge allowed', r2.ok && r2.index === 1);

  // -- codec version 2 ---------------------------------------------------------------------------------------------------------------
  const doc = S.toDocument();
  check('the document carries the elements', Array.isArray(doc.elements) && doc.elements.length === 2);
  const enc = MapCodec.encode(doc);
  check('the payload is version 2 and has an elements list', enc && enc.v === 2 && Array.isArray(enc.elements) && enc.elements.length === 2);
  const dec = MapCodec.decode(JSON.parse(JSON.stringify(enc)));
  const e0 = dec.elements[0], e1 = dec.elements[1];
  check('decode gives the elements back, byte for byte', dec && e0.name === 'Circle' && e0.w === 1 && e0.h === 1 && e0.screens === 1 && e0.match === 'exact'
    && eq(Array.from(e0.bitmap), Array.from(b1.bitmap)) && eq(Array.from(e0.attrs), Array.from(b1.attrs)) && eq(e0.positions, [{ x: 3, y: 4 }, { x: 10, y: 4 }]));
  check('...two screens, all three modes, the grid', e1.screens === 2 && e1.match === 'visual' && e1.w === 3 && e1.h === 2 && e1.gridW === 32 && e1.gridH === 24
    && eq(Array.from(e1.bitmap), Array.from(b2.bitmap)) && eq(Array.from(e1.attrs), Array.from(b2.attrs)) && eq(e1.positions, [{ x: 0, y: 0 }, { x: 29, y: 22 }]));
  const v1 = { v: 1, k: 'ula-cell', name: 'pin', tiles: [{ b: 'AQIDBAUGBwg=', a: 56 }], map: { w: 1, h: 1, cells: 'AQA=' } };
  check('a version 1 payload still loads, with no elements', (() => { const d = MapCodec.decode(v1); return d && Array.isArray(d.elements) && d.elements.length === 0; })());
  check('a document with no elements field encodes (as an empty list)', MapCodec.encode({ ...doc, elements: undefined }).elements.length === 0);
  check('version 3 is refused', MapCodec.decode({ ...JSON.parse(JSON.stringify(enc)), v: 3 }) === null);
  check('version 2 without an elements list is refused', (() => { const p = JSON.parse(JSON.stringify(enc)); delete p.elements; return MapCodec.decode(p) === null; })());
  const bad = (f) => { const p = JSON.parse(JSON.stringify(enc)); f(p.elements[1]); return MapCodec.decode(p) === null; };
  check('decode refuses: a block wider than its grid', bad(e => { e.w = 40; }));
  check('...three screens', bad(e => { e.s = 3; }));
  check('...a mode that does not exist', bad(e => { e.m = 'fuzzy'; }));
  check('...a dots string of the wrong length', bad(e => { e.b = e.b.slice(4); }));
  check('...an attribute string of the wrong length', bad(e => { e.a = e.a.slice(4); }));
  check('...a places list of odd length', bad(e => { e.p = Helpers.encodeBase64(Uint8Array.of(1, 2, 3)); }));
  check('...a place that runs past the grid', bad(e => { e.p = Helpers.encodeBase64(Uint8Array.of(31, 0)); }));
  check('...no places at all', bad(e => { e.p = ''; }));
  check('...more places than fit', (() => { const p = JSON.parse(JSON.stringify(enc)); p.elements[0].gw = 2; p.elements[0].gh = 1; p.elements[0].p = Helpers.encodeBase64(Uint8Array.of(0, 0, 1, 0, 1, 0)); return MapCodec.decode(p) === null; })());
  check('encode refuses an element that is not valid', MapCodec.encode({ ...doc, elements: [{ ...doc.elements[0], match: 'fuzzy' }] }) === null);
  check('encode refuses too many elements', (() => { const one = doc.elements[0]; return MapCodec.encode({ ...doc, elements: Array.from({ length: MapCodec.MAX_ELEMENTS + 1 }, () => one) }) === null; })());

  // -- the size limit is a trial encode ----------------------------------------------------------------------------------------------
  S.newMap(256, 256, true);
  while (S.getElements().length) S.removeElement(0);
  const tiles = [];
  for (let t = 0; t < 4096; t++) tiles.push({ kind: 'ula-cell', bitmap: Uint8Array.from({ length: 8 }, (_, y) => (t * 37 + y * 11) & 255), attr: t & 255 });
  S.tiles = tiles;
  S.map.cells.forEach((_, i) => { S.map.cells[i] = i % 4096; });
  const big = block(32, 24, 2, 9);
  let added = 0;
  for (let i = 0; i < 80; i++) {
    const r = S.addElement(big, [{ x: 0, y: 0 }], meta({ match: 'exact', name: 'Big' + i, gridW: 32, gridH: 24 }));
    if (!r.ok) { check('a full-size element that no longer fits is refused with a reason', typeof r.reason === 'string' && r.reason.length > 0); break; }
    added++;
  }
  check('some full-screen two-screen elements fit beside the largest map and then the limit is reached', added > 5 && added < 80, String(added));
  const sizeNow = JSON.stringify(MapCodec.encode(S.toDocument())).length;
  check('the stored document is still inside the cap after the refusal', sizeNow <= MapCodec.MAX_JSON_BYTES, String(sizeNow));
  const countBefore = S.getElements().length;
  S.addElement(big, [{ x: 0, y: 0 }], meta({ name: 'Nope' }));
  check('a refusal leaves the element list unchanged', S.getElements().length === countBefore);
  console.log('largest map + ' + added + ' full-screen Timex-pair elements encodes to ' + sizeNow + ' bytes');

  // -- persistence -------------------------------------------------------------------------------------------------------------------
  S.newMap(32, 24, true);
  while (S.getElements().length) S.removeElement(0);
  S.addElement(b1, [{ x: 1, y: 1 }], meta({ name: 'Kept' }));
  await S.persist();
  const stored = JSON.stringify(fakeStore['maps/current']);
  check('the map store keeps TILES only: elements belong to the picture (owner decision 2026-10-14)', fakeStore['maps/current'] && fakeStore['maps/current'].elements.length === 0);
  // make the map unencodable and persist again: the old record must stay
  S.addTile(S.createTile(new Uint8Array(8), 0x38));
  const goodTiles = S.tiles;
  S.tiles = goodTiles.map((t, k) => (k === 0 ? { ...t, attr: 999 } : t));
  await S.persist();
  check('a map that cannot be encoded does NOT delete the stored map', JSON.stringify(fakeStore['maps/current']) === stored);
  S.tiles = goodTiles;
  // a record an older build stored: tiles AND elements
  S.newMap(32, 24, true);
  S.addTile(S.createTile(new Uint8Array(8), 0x38)); S.addTile(S.createTile(new Uint8Array(8).fill(255), 0x07));
  const tileCount = S.tiles.length;
  S.addElement(b1, [{ x: 1, y: 1 }], meta({ name: 'Old' }));
  fakeStore['maps/current'] = MapCodec.encode(S.toDocument());
  check('(the old-style record holds an element)', fakeStore['maps/current'].elements.length === 1);
  S.newMap(32, 24, true);
  S.elements = [];
  await S.restorePersisted();
  check('restorePersisted brings back the tiles of an old record', S.tiles.length === tileCount, String(S.tiles.length));
  check('...and NOT its elements', S.getElements().length === 0);
  // element changes do not rewrite the tile map store (it holds no elements)
  let persists = 0;
  const realSchedule = S._schedulePersist;
  S._schedulePersist = () => { persists++; };
  S.addElement(b1, [{ x: 1, y: 1 }], meta({ name: 'Kept' }));
  S.removeElement(0);
  S.setElements([]);
  S._schedulePersist = realSchedule;
  check('adding, deleting and replacing elements does not rewrite the map store', persists === 0, String(persists));
  S.addElement(b1, [{ x: 1, y: 1 }], meta({ name: 'Kept' }));
  check('...and loadDocument takes elements from a document', (() => { const d = S.toDocument(); S.elements = []; S.loadDocument(d); return S.getElements().length === 1; })());
  check('loadDocument of a document with no elements field keeps the current elements (a tile-only import must not wipe them)', (() => { const d = S.toDocument(); delete d.elements; S.loadDocument(d); return S.getElements().length === 1; })());
  check('...and a document with an empty list clears them', (() => { const d = S.toDocument(); d.elements = []; S.loadDocument(d); return S.getElements().length === 0; })());

  // -- setElements: what a project file or the autosave hands back --------------------------------------------------------------------
  S.newMap(32, 24, true);
  // element numbers are stable: they do not shift when an earlier element is deleted
  S.clearElements();
  S.addElement(b1, [{ x: 1, y: 1 }], meta({ name: 'One' })); S.addElement(b1, [{ x: 2, y: 2 }], meta({ name: 'Two' })); S.addElement(b1, [{ x: 3, y: 3 }], meta({ name: 'Three' }));
  check('elements are numbered 1, 2, 3', S.getElements().map(e => e.number).join() === '1,2,3');
  S.removeElement(1);
  check('after deleting 2 the others keep their numbers (1, 3)', S.getElements().map(e => e.number).join() === '1,3');
  S.addElement(b1, [{ x: 4, y: 4 }], meta({ name: 'Four' }));
  check('a new element takes the next number, never a used one: 4', S.getElements().map(e => e.number).join() === '1,3,4' && S.nextElementNumber() === 5);
  const rt = MapCodec.decode(JSON.parse(JSON.stringify(MapCodec.encode(S.toDocument()))));
  check('numbers survive the codec', rt.elements.map(e => e.number).join() === '1,3,4');
  S.removeElement(2);
  S.addElement(b1, [{ x: 5, y: 5 }], meta({ name: 'Five' }));
  check('deleting the HIGHEST number does not hand it out again: 1, 3, 5', S.getElements().map(e => e.number).join() === '1,3,5');
  S.setElements(S.getElements().map(e => ({ ...e, number: 0 })));
  check('elements without numbers (an older file) are numbered in order', S.getElements().map(e => e.number).join() === '1,2,3');
  S.setElements(S.getElements().map((e, k) => ({ ...e, number: ['5', 3, 3][k] })));
  check('a number that is not a whole number, or one used twice, is replaced by a free one', (() => {
    const ns = S.getElements().map(e => e.number);
    return ns.every(n => Number.isSafeInteger(n) && n > 0) && new Set(ns).size === 3 && ns[1] === 3;
  })(), S.getElements().map(e => e.number).join());
  S.setElements(S.getElements().map((e, k) => ({ ...e, number: k === 0 ? 1e300 : k + 1 })));
  check('a huge number is replaced too (it cannot be counted on from there)', S.getElements().every(e => Number.isSafeInteger(e.number)) && S.nextElementNumber() < 100);
  S.newMap(32, 24, true);
  const keep = S.addElement(b1, [{ x: 2, y: 2 }], meta({ name: 'P' }));
  const asProject = JSON.parse(JSON.stringify(S.getElements(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)));
  S.clearElements();
  S.setElements(asProject);
  check('setElements takes elements back from JSON (plain arrays for the bytes)', S.getElements().length === 1 && S.getElements()[0].name === 'P' && S.getElements()[0].bitmap instanceof Uint8Array);
  S.setElements([asProject[0], { nonsense: true }, { ...asProject[0], match: 'fuzzy' }]);
  check('setElements keeps only the valid ones', S.getElements().length === 1);
  S.setElements(undefined);
  check('no list means no elements (a project from before elements)', S.getElements().length === 0);
  void keep;

  // -- removeElement and the new-map reset ----------------------------------------------------------------------------------------------
  S.addElement(b1, [{ x: 0, y: 0 }], meta({ name: 'A' }));
  S.addElement(b2, [{ x: 0, y: 0 }], meta({ name: 'B' }));
  check('removeElement takes one out', S.removeElement(0) === true && S.getElements().length === 1 && S.getElements()[0].name === 'B');
  check('removeElement of a missing index is refused', S.removeElement(5) === false);
  S.newMap(32, 24, false);
  check('a new map that keeps the tileset keeps the elements', S.getElements().length === 1);
  S.newMap(32, 24, true);
  check('clearing everything clears the elements too', S.getElements().length === 0);
  summary();
})();
