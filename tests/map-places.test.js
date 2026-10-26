'use strict';
/**
 * Batch 11B step 1: the pure helpers behind the Find panel - the selection as a block of whole cells, the cells already covered by elements, and the places a
 * find will keep (covered ones left out, overlapping ones resolved with the source first) - plus reason codes from addElement and clearElements.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
global.EventBus = { emit() {}, on() {} };
global.window.EventBus = global.EventBus;
loadModule('js/utils/map-find.js');
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');
const S = MapService;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CW = ZX_SPECTRUM.CELL_WIDTH, CH = ZX_SPECTRUM.CELL_HEIGHT;

// -- blockAt -----------------------------------------------------------------------------------------------------------------------
check('a rectangle of whole cells becomes a cell block', eq(S.blockAt({ x: 2 * CW, y: 3 * CH, width: 2 * CW, height: CH }), { x: 2, y: 3, w: 2, h: 1 }));
check('a rectangle that is not whole cells is refused', S.blockAt({ x: 3, y: 0, width: CW, height: CH }) === null && S.blockAt({ x: 0, y: 0, width: CW + 1, height: CH }) === null);
check('an empty or missing rectangle is refused', S.blockAt(null) === null && S.blockAt({ x: 0, y: 0, width: 0, height: CH }) === null);
check('a rectangle past the picture is refused', S.blockAt({ x: ZX_SPECTRUM.WIDTH, y: 0, width: CW, height: CH }) === null);

// -- coveredCells and findPlaces --------------------------------------------------------------------------------------------------
const gw = ZX_SPECTRUM.GRID_COLS, gh = ZX_SPECTRUM.GRID_ROWS;
const blk = (w, h) => { const b = MapFind.make(w, h, CH, 1); b.attrs.fill(0x38); return b; };
S.elements = [];
check('nothing is covered with no elements', S.coveredCells().size === 0);
S.addElement(blk(2, 1), [{ x: 0, y: 0 }, { x: 5, y: 3 }], { match: 'exact', name: 'A', gridW: gw, gridH: gh });
const cov = S.coveredCells();
check('an element covers w x h cells at each place', cov.size === 4 && cov.has('0,0') && cov.has('1,0') && cov.has('5,3') && cov.has('6,3'));
S.elements.push({ ...S.elements[0], gridW: gw + 1 });
check('an element from another grid covers nothing here', S.coveredCells().size === 4);
S.elements.pop();

const all = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 10 }];
const r = S.placesFrom(all, 2, 1, { x: 3, y: 0 });
check('covered places are left out, the source stays first', r.covered === 3 && r.kept[0].x === 3 && r.kept[0].y === 0, JSON.stringify(r));
check('overlapping places are resolved with the source first: 3,0 then 5,0 (4,0 overlaps) then 10,10', eq(r.kept.map(p => p.x + ',' + p.y), ['3,0', '5,0', '10,10']) && r.overlapping === 1, JSON.stringify(r));
check('the counts add up', r.kept.length + r.overlapping + r.covered === all.length);
const r2 = S.placesFrom(all, 2, 1, { x: 0, y: 0 });
check('a source that is itself covered is still kept (you chose it)', r2.kept[0].x === 0 && r2.kept[0].y === 0);

// -- reason codes and clearElements -------------------------------------------------------------------------------------------------
const bad = S.addElement(blk(2, 1), [{ x: gw, y: 0 }], { match: 'exact', gridW: gw, gridH: gh });
check('an invalid element gets the code "invalid"', bad.ok === false && bad.reason === 'invalid');
const n = S.elements.length;
S.tiles = Array.from({ length: 4096 }, (_, t) => ({ kind: 'ula-cell', bitmap: Uint8Array.from({ length: 8 }, (_, y) => (t * 37 + y) & 255), attr: t & 255 }));
S.map = { width: 256, height: 256, cells: Int16Array.from({ length: 65536 }, (_, i) => i % 4096) };
const big = MapFind.make(32, 24, CH, 2);
let code = null;
for (let i = 0; i < 90 && !code; i++) { const x = S.addElement(big, [{ x: 0, y: 0 }], { match: 'exact', gridW: 32, gridH: 24 }); if (!x.ok) code = x.reason; }
check('an element that no longer fits the size limit gets the code "tooBig"', code === 'tooBig', String(code));
S.clearElements();
check('clearElements removes them all', S.getElements().length === 0 && n > 0);
summary();
