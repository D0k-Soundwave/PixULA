'use strict';
/**
 * Batch 7 part 7B: rotation, rounding and line styles must leave today's shapes byte for byte as they were.
 *
 * GUARD: a checksum of every shape's pixel set (17 shapes x 3 drags x outline/filled x thickness 1/3), written from
 * the code BEFORE part 7B and expected to pass before and after it. (Order of the points is not pinned, only the set:
 * count and an FNV-1a hash of the sorted pixel keys.) The rotation, rounding and line-style tests below are added to
 * this file as those features are built.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
for (const m of ['js/core/constants.js', 'js/utils/helpers.js', 'js/utils/validators.js', 'js/core/event-bus.js',
  'js/core/state-manager.js', 'js/core/attribute-system.js']) loadModule(m);
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, getColorIndex: (b, br) => b + (br ? 8 : 0), setCanvasCursor() {} };
global.ColorManager = { getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; } };
global.SelectionService = { hasSelection() { return false; }, isFloating() { return false; } };
loadModule('js/tools/tool-base.js');
loadModule('js/tools/shape-generator.js');

const SHAPES = ['rectangle', 'square', 'rounded-rectangle', 'ellipse', 'circle', 'arc', 'sector', 'triangle', 'diamond',
  'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'dodecagon', 'parallelogram'];
const DRAGS = [[20, 30, 60, 50], [60, 50, 20, 30], [40, 40, 70, 20]];
const hash = (pts) => {
  const keys = [...new Set(pts.map(p => p.y * 1000 + p.x))].sort((a, b) => a - b);
  let h = 2166136261;
  for (const v of keys) { h ^= v; h = Math.imul(h, 16777619) >>> 0; }
  return keys.length + ':' + h.toString(16);
};
const PINS = {
 "rectangle|0|o|1": "120:c263a345",
 "rectangle|0|o|3": "360:19a0be8d",
 "rectangle|0|f|1": "861:fb5a59d3",
 "rectangle|0|f|3": "861:fb5a59d3",
 "rectangle|1|o|1": "120:c263a345",
 "rectangle|1|o|3": "360:19a0be8d",
 "rectangle|1|f|1": "861:fb5a59d3",
 "rectangle|1|f|3": "861:fb5a59d3",
 "rectangle|2|o|1": "100:891fade9",
 "rectangle|2|o|3": "300:58531df9",
 "rectangle|2|f|1": "651:e0836ea4",
 "rectangle|2|f|3": "651:e0836ea4",
 "square|0|o|1": "160:9575b805",
 "square|0|o|3": "480:c7a6d64d",
 "square|0|f|1": "1681:57d5f633",
 "square|0|f|3": "1681:57d5f633",
 "square|1|o|1": "160:9575b805",
 "square|1|o|3": "480:c7a6d64d",
 "square|1|f|1": "1681:57d5f633",
 "square|1|f|3": "1681:57d5f633",
 "square|2|o|1": "120:e7b073a9",
 "square|2|o|3": "360:a363b861",
 "square|2|f|1": "961:74697f6e",
 "square|2|f|3": "961:74697f6e",
 "rounded-rectangle|0|o|1": "108:14bd235",
 "rounded-rectangle|0|o|3": "348:4117ed85",
 "rounded-rectangle|0|f|1": "837:23576d03",
 "rounded-rectangle|0|f|3": "837:23576d03",
 "rounded-rectangle|1|o|1": "108:14bd235",
 "rounded-rectangle|1|o|3": "348:4117ed85",
 "rounded-rectangle|1|f|1": "837:23576d03",
 "rounded-rectangle|1|f|3": "837:23576d03",
 "rounded-rectangle|2|o|1": "88:b4751e59",
 "rounded-rectangle|2|o|3": "288:5e541371",
 "rounded-rectangle|2|f|1": "627:cad800dc",
 "rounded-rectangle|2|f|3": "627:cad800dc",
 "ellipse|0|o|1": "88:4e1f138d",
 "ellipse|0|o|3": "328:5b67f2bd",
 "ellipse|0|f|1": "677:e7a355eb",
 "ellipse|0|f|3": "677:e7a355eb",
 "ellipse|1|o|1": "88:4e1f138d",
 "ellipse|1|o|3": "328:5b67f2bd",
 "ellipse|1|f|1": "677:e7a355eb",
 "ellipse|1|f|3": "677:e7a355eb",
 "ellipse|2|o|1": "72:3d0819e1",
 "ellipse|2|o|3": "272:25fca1dd",
 "ellipse|2|f|1": "507:a43bd59c",
 "ellipse|2|f|3": "507:a43bd59c",
 "circle|0|o|1": "112:2ec7d245",
 "circle|0|o|3": "432:debdc355",
 "circle|0|f|1": "1313:d2135d2b",
 "circle|0|f|3": "1313:d2135d2b",
 "circle|1|o|1": "112:2ec7d245",
 "circle|1|o|3": "432:debdc355",
 "circle|1|f|1": "1313:d2135d2b",
 "circle|1|f|3": "1313:d2135d2b",
 "circle|2|o|1": "84:37f2a1e5",
 "circle|2|o|3": "324:1d5c94cd",
 "circle|2|f|1": "749:ef6b9db2",
 "circle|2|f|3": "749:ef6b9db2",
 "arc|0|o|1": "136:fa735620",
 "arc|0|o|3": "504:506ba327",
 "arc|0|f|1": "136:fa735620",
 "arc|0|f|3": "504:506ba327",
 "arc|1|o|1": "136:10f11284",
 "arc|1|o|3": "504:974f64ab",
 "arc|1|f|1": "136:10f11284",
 "arc|1|f|3": "504:974f64ab",
 "arc|2|o|1": "107:e7eca47",
 "arc|2|o|3": "403:44fc727",
 "arc|2|f|1": "107:e7eca47",
 "arc|2|f|3": "403:44fc727",
 "sector|0|o|1": "154:156b160d",
 "sector|0|o|3": "558:f930dda0",
 "sector|0|f|1": "1669:d57b0daa",
 "sector|0|f|3": "1669:d57b0daa",
 "sector|1|o|1": "154:37fd715d",
 "sector|1|o|3": "558:3902c91c",
 "sector|1|f|1": "1669:d4329dc",
 "sector|1|f|3": "1669:d4329dc",
 "sector|2|o|1": "121:23b459dd",
 "sector|2|o|3": "433:e6eed5ec",
 "sector|2|f|1": "1082:29e7e404",
 "sector|2|f|3": "1082:29e7e404",
 "triangle|0|o|1": "141:a5562c33",
 "triangle|0|o|3": "527:5d883a60",
 "triangle|0|f|1": "1231:7a1d2719",
 "triangle|0|f|3": "1231:7a1d2719",
 "triangle|1|o|1": "141:c5f9ff6b",
 "triangle|1|o|3": "527:6aebe702",
 "triangle|1|f|1": "1231:753ee6c5",
 "triangle|1|f|3": "1231:753ee6c5",
 "triangle|2|o|1": "113:a397adcc",
 "triangle|2|o|3": "423:513b458c",
 "triangle|2|f|1": "809:7a4bfd09",
 "triangle|2|f|3": "809:7a4bfd09",
 "diamond|0|o|1": "240:bfc4d7c5",
 "diamond|0|o|3": "876:eb17fe01",
 "diamond|0|f|1": "3278:8ff89341",
 "diamond|0|f|3": "3278:8ff89341",
 "diamond|1|o|1": "240:a2508a35",
 "diamond|1|o|3": "876:363c1d21",
 "diamond|1|f|1": "4121:e7d6a6f3",
 "diamond|1|f|3": "4121:e7d6a6f3",
 "diamond|2|o|1": "200:a48b9c29",
 "diamond|2|o|3": "680:79c0cad9",
 "diamond|2|f|1": "2701:bb3fef9d",
 "diamond|2|f|3": "2701:bb3fef9d",
 "pentagon|0|o|1": "235:94b5a84f",
 "pentagon|0|o|3": "906:3f88a89f",
 "pentagon|0|f|1": "3687:13188f4b",
 "pentagon|0|f|3": "3687:13188f4b",
 "pentagon|1|o|1": "235:c92db9f",
 "pentagon|1|o|3": "906:a0cbfc27",
 "pentagon|1|f|1": "4871:2cd41d03",
 "pentagon|1|f|3": "4871:2cd41d03",
 "pentagon|2|o|1": "192:393eefbd",
 "pentagon|2|o|3": "731:8fa8ea09",
 "pentagon|2|f|1": "3197:251e0dab",
 "pentagon|2|f|3": "3197:251e0dab",
 "hexagon|0|o|1": "244:70e3a5b5",
 "hexagon|0|o|3": "924:131488d9",
 "hexagon|0|f|1": "3920:b64be6dd",
 "hexagon|0|f|3": "3920:b64be6dd",
 "hexagon|1|o|1": "244:a61e9505",
 "hexagon|1|o|3": "924:e0399ad9",
 "hexagon|1|f|1": "5363:15e09173",
 "hexagon|1|f|3": "5363:15e09173",
 "hexagon|2|o|1": "196:59fe9c9d",
 "hexagon|2|o|3": "740:e123a59",
 "hexagon|2|f|1": "3473:40bce14f",
 "hexagon|2|f|3": "3473:40bce14f",
 "heptagon|0|o|1": "245:2acb644d",
 "heptagon|0|o|3": "937:9d7d99be",
 "heptagon|0|f|1": "4036:29089868",
 "heptagon|0|f|3": "4036:29089868",
 "heptagon|1|o|1": "245:97193b55",
 "heptagon|1|o|3": "937:c567f0c0",
 "heptagon|1|f|1": "5602:44745cbc",
 "heptagon|1|f|3": "5602:44745cbc",
 "heptagon|2|o|1": "197:1cbd227e",
 "heptagon|2|o|3": "757:166884d1",
 "heptagon|2|f|1": "3662:4270e4c1",
 "heptagon|2|f|3": "3662:4270e4c1",
 "octagon|0|o|1": "240:7063d0b5",
 "octagon|0|o|3": "912:1720a95",
 "octagon|0|f|1": "4072:f8ed9a93",
 "octagon|0|f|3": "4072:f8ed9a93",
 "octagon|1|o|1": "240:c765bc65",
 "octagon|1|o|3": "912:bc1873e5",
 "octagon|1|f|1": "5721:cc51cc5b",
 "octagon|1|f|3": "5721:cc51cc5b",
 "octagon|2|o|1": "200:67e0a4b1",
 "octagon|2|o|3": "760:3e585ed",
 "octagon|2|f|1": "3741:264aeba3",
 "octagon|2|f|3": "3741:264aeba3",
 "nonagon|0|o|1": "248:407b544",
 "nonagon|0|o|3": "948:63fda8e6",
 "nonagon|0|f|1": "4155:53bfdef4",
 "nonagon|0|f|3": "4155:53bfdef4",
 "nonagon|1|o|1": "248:7c19879c",
 "nonagon|1|o|3": "948:59843e7e",
 "nonagon|1|f|1": "5905:df76496a",
 "nonagon|1|f|3": "5905:df76496a",
 "nonagon|2|o|1": "199:fa445cb0",
 "nonagon|2|o|3": "767:140aac15",
 "nonagon|2|f|1": "3860:65165792",
 "nonagon|2|f|3": "3860:65165792",
 "decagon|0|o|1": "248:f4ef73a5",
 "decagon|0|o|3": "952:bb593095",
 "decagon|0|f|1": "4204:c0dcc5c5",
 "decagon|0|f|3": "4204:c0dcc5c5",
 "decagon|1|o|1": "248:66df9985",
 "decagon|1|o|3": "952:b7ff8405",
 "decagon|1|f|1": "6013:e5605f79",
 "decagon|1|f|3": "6013:e5605f79",
 "decagon|2|o|1": "200:79798759",
 "decagon|2|o|3": "768:df566871",
 "decagon|2|f|1": "3929:ef311aab",
 "decagon|2|f|3": "3929:ef311aab",
 "dodecagon|0|o|1": "248:d42f2611",
 "dodecagon|0|o|3": "968:120c0961",
 "dodecagon|0|f|1": "4276:3711c3da",
 "dodecagon|0|f|3": "4276:3711c3da",
 "dodecagon|1|o|1": "248:e58e6dd1",
 "dodecagon|1|o|3": "968:861da821",
 "dodecagon|1|f|1": "6153:55ce3f69",
 "dodecagon|1|f|3": "6153:55ce3f69",
 "dodecagon|2|o|1": "200:762fa691",
 "dodecagon|2|o|3": "776:a1913df9",
 "dodecagon|2|f|1": "3981:19ab0e15",
 "dodecagon|2|f|3": "3981:19ab0e15",
 "parallelogram|0|o|1": "100:e78dd5ff",
 "parallelogram|0|o|3": "337:d8d2067",
 "parallelogram|0|f|1": "651:e7d7ddc8",
 "parallelogram|0|f|3": "651:e7d7ddc8",
 "parallelogram|1|o|1": "100:e78dd5ff",
 "parallelogram|1|o|3": "337:d8d2067",
 "parallelogram|1|f|1": "651:e7d7ddc8",
 "parallelogram|1|f|3": "651:e7d7ddc8",
 "parallelogram|2|o|1": "84:e690a1b1",
 "parallelogram|2|o|3": "282:366496bb",
 "parallelogram|2|f|1": "483:c6a4f5d0",
 "parallelogram|2|f|3": "483:c6a4f5d0"
};

let wrong = 0, total = 0;
for (const s of SHAPES) for (const [i, d] of DRAGS.entries()) for (const filled of [false, true]) for (const t of [1, 3]) {
  const pts = ShapeGenerator.generateShape(s, { x1: d[0], y1: d[1], x2: d[2], y2: d[3] }, { filled, thickness: t });
  const key = `${s}|${i}|${filled ? 'f' : 'o'}|${t}`;
  total++;
  if (hash(pts) !== PINS[key]) { wrong++; if (wrong <= 5) console.log(`  differs: ${key}  ${hash(pts)} (pinned ${PINS[key]})`); }
}
check(`all ${total} default shapes are byte for byte what they were before 7B`, wrong === 0, `${wrong} differ`);

// ===== LINE STYLES =====================================================================================================
// The dash lengths are read from the ZX Paintbrush help picture of its line-style toolbar: a 16 x 16 rectangle, 60
// outline pixels, started at the top-right corner and running left (counter-clockwise on screen):
//   dashed 18 on 6 off; dotted 3 on 3 off [M, ZXPaintbrush.chm linestyletoolbar.jpg, 2026-10-10].
{
  const set = (pts) => new Set(pts.map(p => `${p.x},${p.y}`));
  const R = { x1: 0, y1: 0, x2: 15, y2: 15 };
  const dashed = set(ShapeGenerator.generateShape('rectangle', R, { lineStyle: 'dashed' }));
  const want = new Set();
  for (let x = 0; x <= 15; x++) want.add(`${x},0`);                      // 18 on: the whole top row (16) ...
  want.add('0,1'); want.add('0,2');                                      // ... and 2 down the left side
  for (let y = 9; y <= 15; y++) want.add(`0,${y}`);                      // 18 on: left side y 9-15 (7) ...
  for (let x = 1; x <= 11; x++) want.add(`${x},15`);                     // ... and bottom x 1-11 (11)
  for (let y = 1; y <= 12; y++) want.add(`15,${y}`);                     // 12 on: right side y 12 down to 1 (the leftover)
  check('a dashed 16 x 16 rectangle is the help icon: 18 on, 6 off, 18 on, 6 off, 12 on (48 pixels)',
    dashed.size === 48 && [...want].every(k => dashed.has(k)) && want.size === 48, `${dashed.size}`);

  const dotted = set(ShapeGenerator.generateShape('rectangle', R, { lineStyle: 'dotted' }));
  const topDots = [15, 14, 13, 9, 8, 7, 3, 2, 1].every(x => dotted.has(`${x},0`)) &&
    [12, 11, 10, 6, 5, 4, 0].every(x => !dotted.has(`${x},0`));
  check('dotted: 3 on, 3 off along the top row from the right', topDots);
  check('dotted is half the outline (60 pixels, runs 3 on 3 off: 30)', dotted.size === 30, String(dotted.size));

  const solid2 = set(ShapeGenerator.generateShape('rectangle', R, { thickness: 2 }));
  const dashed2 = set(ShapeGenerator.generateShape('rectangle', R, { thickness: 2, lineStyle: 'dashed' }));
  check('dashed at thickness 2 is drawn solid (the rule is in the rasteriser, not only the panel)',
    dashed2.size === solid2.size && [...solid2].every(k => dashed2.has(k)));

  check('clear on an unfilled shape draws nothing', ShapeGenerator.generateShape('rectangle', R, { lineStyle: 'clear' }).length === 0);
  check('clear on an unfilled shape draws nothing at any thickness',
    ShapeGenerator.generateShape('rectangle', R, { lineStyle: 'clear', thickness: 4 }).length === 0);
  const box = { x1: 0, y1: 0, x2: 9, y2: 9 };
  const clearFilled = set(ShapeGenerator.generateShape('rectangle', box, { lineStyle: 'clear', filled: true }));
  check('clear on a filled 10 x 10 box draws only the 8 x 8 inside', clearFilled.size === 64 &&
    clearFilled.has('1,1') && clearFilled.has('8,8') && !clearFilled.has('0,0') && !clearFilled.has('9,5'), String(clearFilled.size));

  // a filled shape loses the pixels the pattern leaves off, nothing else
  const fullFill = set(ShapeGenerator.generateShape('rectangle', R, { filled: true }));
  const dashedFill = set(ShapeGenerator.generateShape('rectangle', R, { filled: true, lineStyle: 'dashed' }));
  check('filled + dashed = the fill minus the 12 pixels the pattern leaves off (60 - 48)',
    dashedFill.size === fullFill.size - 12 && [...dashedFill].every(k => fullFill.has(k)), `${dashedFill.size} vs ${fullFill.size}`);

  // for every shape: the walk visits exactly the pixels of the outline, and on + off = solid
  let bad = 0;
  for (const shape of SHAPES) {
    for (const d of DRAGS) {
      const b = { x1: d[0], y1: d[1], x2: d[2], y2: d[3] };
      const solid = set(ShapeGenerator.generateShape(shape, b, {}));
      const ordered = ShapeGenerator.orderOutline(ShapeGenerator.generateShape(shape, b, {}));
      const orderedSet = set(ordered);
      const split = ShapeGenerator.applyLineStyle([ordered], 'dash-dot');
      const on = set(split.on), off = set(split.off);
      const sameSet = orderedSet.size === solid.size && [...solid].every(k => orderedSet.has(k));
      const disjoint = [...on].every(k => !off.has(k));
      if (!sameSet || !disjoint || on.size + off.size !== solid.size) { bad++; console.log(`  ${shape}: ordered ${orderedSet.size}, solid ${solid.size}, on ${on.size}, off ${off.size}`); }
      const styled = set(ShapeGenerator.generateShape(shape, b, { lineStyle: 'dashed' }));
      if (![...styled].every(k => solid.has(k))) { bad++; console.log(`  ${shape}: dashed is not a subset of solid`); }
    }
  }
  check('every shape: the ordered walk is the same pixels, on and off split them, dashed is a subset of solid', bad === 0, `${bad} shapes`);

  // the pattern continues round corners
  const run = ShapeGenerator.orderOutline(ShapeGenerator.generateShape('line', { x1: 0, y1: 0, x2: 47, y2: 0 }, {}));
  const split = ShapeGenerator.applyLineStyle([run], 'dashed');
  const onX = new Set(split.on.map(p => p.x));
  check('a straight 48-pixel line, dashed: x 0-17 and 24-41 are on', [...Array(18).keys()].every(x => onX.has(x)) &&
    [24, 41].every(x => onX.has(x)) && !onX.has(18) && !onX.has(23) && !onX.has(42) && onX.size === 36);
  const lshape = [];
  for (let x = 0; x <= 20; x++) lshape.push({ x, y: 0 });
  for (let y = 1; y <= 20; y++) lshape.push({ x: 20, y });
  const ls = ShapeGenerator.applyLineStyle([lshape], 'dashed');
  const lon = new Set(ls.on.map(p => `${p.x},${p.y}`));
  check('the phase carries round a corner: x 0-17 on, then (20,y) from y = 4 (pixel 24 of the path)',
    lon.has('17,0') && !lon.has('18,0') && !lon.has('20,3') && lon.has('20,4') && lon.has('20,20'));
  const two = ShapeGenerator.applyLineStyle([lshape.slice(0, 21), lshape.slice(21)], 'dashed');
  check('each separate run starts its pattern afresh (21 + 20 pixels: 18 on in each)', two.on.length === 36 && two.on.some(p => p.x === 20 && p.y === 1));
}

summary();
