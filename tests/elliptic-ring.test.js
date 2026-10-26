'use strict';
/**
 * The Shape tool's Ring is elliptic and turns (decided 2026-10-19; plan .claude/parity/feature-elliptic-ring.md).
 *
 * PIN: a hash of the pixel set of 234 circular rings, written from the code BEFORE the ring became elliptic (when it
 * was drawn from its centre with the drag distance as its radius). A ring drawn now with equal width and height must
 * be pixel-identical to it: the drag (cx, cy) -> (cx + r, cy + r) gives radius r across and down. Order of the points
 * is not pinned, only the set (count and an FNV-1a hash of the sorted pixel keys, as tests/shape-rotation.test.js).
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
for (const m of ['js/core/constants.js', 'js/utils/helpers.js', 'js/utils/validators.js', 'js/core/event-bus.js',
  'js/core/state-manager.js', 'js/core/attribute-system.js']) loadModule(m);
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, getColorIndex: (b, br) => b + (br ? 8 : 0), setCanvasCursor() {} };
global.ColorManager = { getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; } };
global.SelectionService = { hasSelection() { return false; }, isFloating() { return false; } };
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/figure-model.js');
loadModule('js/tools/figure-editor.js');
loadModule('js/tools/shape-tool.js');

const G = ShapeGenerator;
const GC = ShapeGenerator.constructor;
const hash = (pts) => {
  const keys = [...new Set(pts.map(p => p.y * 1000 + p.x))].sort((a, b) => a - b);
  let h = 2166136261;
  for (const v of keys) { h ^= v; h = Math.imul(h, 16777619) >>> 0; }
  return keys.length + ':' + h.toString(16);
};
const keyset = (pts) => new Set(pts.map(p => p.x + ',' + p.y));
const extent = (pts) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
/** The ring the Shape tool draws for a drag from (cx, cy) to (ex, ey). */
const ring = (cx, cy, ex, ey, opts = {}) =>
  G.generateShape('ring', GC.centerAnchoredBounds(cx, cy, ex, ey), { innerRatio: 0.5, thickness: 1, ...opts });

// [cx, cy, r, inner %, o1 | o3 | f, line style] -> pixel-set hash, from the circular ring before the change.
const PINS = {
  "128|96|1|10|o1|solid": "1:8717ca9f",
  "128|96|1|10|o3|solid": "9:ea432c39",
  "128|96|1|10|f|solid": "1:8717ca9f",
  "128|96|1|35|o1|solid": "1:8717ca9f",
  "128|96|1|35|o3|solid": "9:ea432c39",
  "128|96|1|35|f|solid": "1:8717ca9f",
  "128|96|1|50|o1|solid": "1:8717ca9f",
  "128|96|1|50|o3|solid": "9:ea432c39",
  "128|96|1|50|f|solid": "1:8717ca9f",
  "128|96|1|75|o1|solid": "1:8717ca9f",
  "128|96|1|75|o3|solid": "9:ea432c39",
  "128|96|1|75|f|solid": "1:8717ca9f",
  "128|96|1|90|o1|solid": "1:8717ca9f",
  "128|96|1|90|o3|solid": "9:ea432c39",
  "128|96|1|90|f|solid": "1:8717ca9f",
  "128|96|2|10|o1|solid": "17:ec1b467f",
  "128|96|2|10|o3|solid": "45:e7cf57db",
  "128|96|2|10|f|solid": "12:d3ab80ad",
  "128|96|2|35|o1|solid": "20:c50895a9",
  "128|96|2|35|o3|solid": "45:e7cf57db",
  "128|96|2|35|f|solid": "12:d3ab80ad",
  "128|96|2|50|o1|solid": "20:c50895a9",
  "128|96|2|50|o3|solid": "45:e7cf57db",
  "128|96|2|50|f|solid": "10:cae9299",
  "128|96|2|75|o1|solid": "20:c50895a9",
  "128|96|2|75|o3|solid": "45:e7cf57db",
  "128|96|2|75|f|solid": "4:30bed7f9",
  "128|96|2|90|o1|solid": "16:281b2cd9",
  "128|96|2|90|o3|solid": "45:e7cf57db",
  "128|96|2|90|f|solid": "4:30bed7f9",
  "128|96|3|10|o1|solid": "21:75fd48f1",
  "128|96|3|10|o3|solid": "73:51ab3025",
  "128|96|3|10|f|solid": "28:f4f639f1",
  "128|96|3|35|o1|solid": "28:290a1d15",
  "128|96|3|35|o3|solid": "73:51ab3025",
  "128|96|3|35|f|solid": "24:25516505",
  "128|96|3|50|o1|solid": "30:9ddf5e83",
  "128|96|3|50|o3|solid": "73:51ab3025",
  "128|96|3|50|f|solid": "20:74bfd35",
  "128|96|3|75|o1|solid": "32:35b25297",
  "128|96|3|75|o3|solid": "72:2b031c79",
  "128|96|3|75|f|solid": "8:830b735",
  "128|96|3|90|o1|solid": "28:25b432b9",
  "128|96|3|90|o3|solid": "72:2b031c79",
  "128|96|3|90|f|solid": "8:830b735",
  "128|96|4|10|o1|solid": "33:1a5aaf97",
  "128|96|4|10|o3|solid": "105:6f09da9",
  "128|96|4|10|f|solid": "48:eadb53a1",
  "128|96|4|35|o1|solid": "40:20f43c89",
  "128|96|4|35|o3|solid": "109:462db415",
  "128|96|4|35|f|solid": "44:d3cbb9e5",
  "128|96|4|50|o1|solid": "48:7e84df49",
  "128|96|4|50|o3|solid": "109:462db415",
  "128|96|4|50|f|solid": "38:5ebd85ad",
  "128|96|4|75|o1|solid": "48:7ff90049",
  "128|96|4|75|o3|solid": "104:a2505e9",
  "128|96|4|75|f|solid": "22:d39100b5",
  "128|96|4|90|o1|solid": "40:7445c80d",
  "128|96|4|90|o3|solid": "100:bdf22169",
  "128|96|4|90|f|solid": "12:3d2cb6a5",
  "128|96|5|10|o1|solid": "35:4966f52a",
  "128|96|5|10|o3|solid": "127:efc02f65",
  "128|96|5|10|f|solid": "80:729f25dd",
  "128|96|5|35|o1|solid": "48:6ea35249",
  "128|96|5|35|o3|solid": "145:90ea7111",
  "128|96|5|35|f|solid": "72:70a4089",
  "128|96|5|50|o1|solid": "50:dfeaebc4",
  "128|96|5|50|o3|solid": "144:a9f0c275",
  "128|96|5|50|f|solid": "60:bf7fe5bd",
  "128|96|5|75|o1|solid": "56:3ccce91d",
  "128|96|5|75|o3|solid": "132:e650c8e9",
  "128|96|5|75|f|solid": "36:5aa66b6d",
  "128|96|5|90|o1|solid": "52:aea21449",
  "128|96|5|90|o3|solid": "124:c5723af1",
  "128|96|5|90|f|solid": "12:f0049829",
  "128|96|7|10|o1|solid": "44:bf755d1d",
  "128|96|7|10|o3|solid": "173:280457d7",
  "128|96|7|10|f|solid": "148:41518efd",
  "128|96|7|35|o1|solid": "56:c17eda4d",
  "128|96|7|35|o3|solid": "200:cd9c60b5",
  "128|96|7|35|f|solid": "128:e415d669",
  "128|96|7|50|o1|solid": "62:98c7d383",
  "128|96|7|50|o3|solid": "226:5bd63c46",
  "128|96|7|50|f|solid": "112:7fb97ef9",
  "128|96|7|75|o1|solid": "80:9c2a00ad",
  "128|96|7|75|o3|solid": "204:9abaa7b9",
  "128|96|7|75|f|solid": "60:c3272121",
  "128|96|7|90|o1|solid": "76:77af1a25",
  "128|96|7|90|o3|solid": "180:5c7b3029",
  "128|96|7|90|f|solid": "28:b1f275d5",
  "128|96|10|10|o1|solid": "64:e6e95f05",
  "128|96|10|10|o3|solid": "241:e310eeb1",
  "128|96|10|10|f|solid": "314:e8a43c81",
  "128|96|10|35|o1|solid": "78:c33b7dcb",
  "128|96|10|35|o3|solid": "290:967f92c6",
  "128|96|10|35|f|solid": "280:952d3739",
  "128|96|10|50|o1|solid": "88:eaeb96f9",
  "128|96|10|50|o3|solid": "328:cc704f9f",
  "128|96|10|50|f|solid": "238:caef475",
  "128|96|10|75|o1|solid": "100:88212058",
  "128|96|10|75|o3|solid": "336:49b57349",
  "128|96|10|75|f|solid": "140:544aaaa1",
  "128|96|10|90|o1|solid": "112:e8bb284b",
  "128|96|10|90|o3|solid": "268:ec622649",
  "128|96|10|90|f|solid": "66:257d08e1",
  "128|96|13|10|o1|solid": "84:dd563f04",
  "128|96|13|10|o3|solid": "309:ea606c56",
  "128|96|13|10|f|solid": "524:daa79889",
  "128|96|13|35|o1|solid": "108:c2f2a87c",
  "128|96|13|35|o3|solid": "392:9ed88658",
  "128|96|13|35|f|solid": "460:513a4555",
  "128|96|13|50|o1|solid": "112:8e4acaff",
  "128|96|13|50|o3|solid": "422:d0fe2a0e",
  "128|96|13|50|f|solid": "392:fdc2ff09",
  "128|96|13|75|o1|solid": "132:cbc4aac6",
  "128|96|13|75|o3|solid": "486:a885a315",
  "128|96|13|75|f|solid": "236:10585b41",
  "128|96|13|90|o1|solid": "144:5885581e",
  "128|96|13|90|o3|solid": "382:c73296e5",
  "128|96|13|90|f|solid": "100:fd788121",
  "128|96|17|10|o1|solid": "112:3631a7b1",
  "128|96|17|10|o3|solid": "413:823ce325",
  "128|96|17|10|f|solid": "892:21e351ad",
  "128|96|17|35|o1|solid": "136:7f3d5121",
  "128|96|17|35|o3|solid": "504:fa6595e5",
  "128|96|17|35|f|solid": "792:aa361e61",
  "128|96|17|50|o1|solid": "152:24fe2e32",
  "128|96|17|50|o3|solid": "558:94117cef",
  "128|96|17|50|f|solid": "676:e808d085",
  "128|96|17|75|o1|solid": "168:80237d95",
  "128|96|17|75|o3|solid": "648:f8421c91",
  "128|96|17|75|f|solid": "392:2f74ad01",
  "128|96|17|90|o1|solid": "180:605595d5",
  "128|96|17|90|o3|solid": "528:5f14c111",
  "128|96|17|90|f|solid": "152:2a3d98b9",
  "128|96|24|10|o1|solid": "152:8d129be9",
  "128|96|24|10|o3|solid": "568:394da4f9",
  "128|96|24|10|f|solid": "1772:1639b1c5",
  "128|96|24|35|o1|solid": "192:70dd79f1",
  "128|96|24|35|o3|solid": "704:3b238a65",
  "128|96|24|35|f|solid": "1572:d05324f5",
  "128|96|24|50|o1|solid": "208:938c1641",
  "128|96|24|50|o3|solid": "784:d288cbf9",
  "128|96|24|50|f|solid": "1354:50de2521",
  "128|96|24|75|o1|solid": "240:330f30a9",
  "128|96|24|75|o3|solid": "912:7dd3ba91",
  "128|96|24|75|f|solid": "786:e6220b25",
  "128|96|24|90|o1|solid": "256:42722ddd",
  "128|96|24|90|o3|solid": "868:8f0dc85d",
  "128|96|24|90|f|solid": "320:cc79b461",
  "128|96|31|10|o1|solid": "204:35d69ac5",
  "128|96|31|10|o3|solid": "748:bbcce9a9",
  "128|96|31|10|f|solid": "2972:4d6c2931",
  "128|96|31|35|o1|solid": "264:ba961a35",
  "128|96|31|35|o3|solid": "936:bc90bfb5",
  "128|96|31|35|f|solid": "2628:ed0ed5a1",
  "128|96|31|50|o1|solid": "284:dcf4ac5a",
  "128|96|31|50|o3|solid": "1026:26eafd42",
  "128|96|31|50|f|solid": "2252:da90753d",
  "128|96|31|75|o1|solid": "312:34d03591",
  "128|96|31|75|o3|solid": "1176:c1be8881",
  "128|96|31|75|f|solid": "1308:e04a4a75",
  "128|96|31|90|o1|solid": "336:710fc805",
  "128|96|31|90|o3|solid": "1200:2393d635",
  "128|96|31|90|f|solid": "552:cd6d6301",
  "128|96|40|10|o1|solid": "256:5e87fa35",
  "128|96|40|10|o3|solid": "960:bde23015",
  "128|96|40|10|f|solid": "4978:983e8479",
  "128|96|40|35|o1|solid": "320:f975a3b1",
  "128|96|40|35|o3|solid": "1184:51ddc4d9",
  "128|96|40|35|f|solid": "4414:694cead1",
  "128|96|40|50|o1|solid": "344:24d2e84d",
  "128|96|40|50|o3|solid": "1304:d07627a9",
  "128|96|40|50|f|solid": "3770:60bf7149",
  "128|96|40|75|o1|solid": "400:f0e48b85",
  "128|96|40|75|o3|solid": "1520:d6cdca79",
  "128|96|40|75|f|solid": "2206:a97a26d",
  "128|96|40|90|o1|solid": "424:8805b9b1",
  "128|96|40|90|o3|solid": "1640:b14d204d",
  "128|96|40|90|f|solid": "974:6899ef81",
  "128|96|60|10|o1|solid": "392:e829cb5",
  "128|96|60|10|o3|solid": "1448:718f7d1",
  "128|96|60|10|f|solid": "11178:70227181",
  "128|96|60|35|o1|solid": "496:1666cad5",
  "128|96|60|35|o3|solid": "1792:2fa81111",
  "128|96|60|35|f|solid": "9918:74386da5",
  "128|96|60|50|o1|solid": "544:6c446cd5",
  "128|96|60|50|o3|solid": "1984:3e95ab51",
  "128|96|60|50|f|solid": "8470:3d220b5",
  "128|96|60|75|o1|solid": "608:26b5207b",
  "128|96|60|75|o3|solid": "2288:3bccd5d5",
  "128|96|60|75|f|solid": "4930:e9d72435",
  "128|96|60|90|o1|solid": "648:4f7ab17d",
  "128|96|60|90|o3|solid": "2472:9b6e2561",
  "128|96|60|90|f|solid": "2146:3ab92c05",
  "128|96|6|50|o1|dashed": "54:5f29746",
  "128|96|6|50|f|dashed": "77:8097db76",
  "128|96|6|50|o1|dotted": "35:e2fc9267",
  "128|96|6|50|f|dotted": "68:4f5c1f8c",
  "128|96|6|50|o1|dash-dot": "36:67950210",
  "128|96|6|50|f|dash-dot": "67:3feedd3a",
  "128|96|6|50|o1|dash-dot-dot": "44:fa7beaad",
  "128|96|6|50|f|dash-dot-dot": "72:25781002",
  "128|96|6|50|o1|clear": "0:811c9dc5",
  "128|96|6|50|f|clear": "48:f46c9455",
  "128|96|15|50|o1|dashed": "98:d5aae865",
  "128|96|15|50|f|dashed": "520:177fa6c4",
  "128|96|15|50|o1|dotted": "65:b096840a",
  "128|96|15|50|f|dotted": "504:c55d8c86",
  "128|96|15|50|o1|dash-dot": "68:7d5c6f74",
  "128|96|15|50|f|dash-dot": "504:11f17dc3",
  "128|96|15|50|o1|dash-dot-dot": "83:bc63eb1",
  "128|96|15|50|f|dash-dot-dot": "514:6f320e9b",
  "128|96|15|50|o1|clear": "0:811c9dc5",
  "128|96|15|50|f|clear": "474:d3dc3d77",
  "128|96|30|50|o1|dashed": "196:70d19008",
  "128|96|30|50|f|dashed": "2082:92fb64a5",
  "128|96|30|50|o1|dotted": "129:e6527b72",
  "128|96|30|50|f|dotted": "2034:82cc757",
  "128|96|30|50|o1|dash-dot": "130:bc8cf368",
  "128|96|30|50|f|dash-dot": "2053:39e3f710",
  "128|96|30|50|o1|dash-dot-dot": "162:80737fff",
  "128|96|30|50|f|dash-dot-dot": "2056:30d7ba1d",
  "128|96|30|50|o1|clear": "0:811c9dc5",
  "128|96|30|50|f|clear": "1988:9735c785",
  "6|6|20|50|o1|solid": "168:7347e5fd",
  "6|6|20|50|o3|solid": "648:2f6c3485",
  "6|6|20|50|f|solid": "370:91e17642",
  "250|100|12|50|o1|solid": "116:fc19d4b9",
  "250|100|12|50|o3|solid": "404:82ececd5",
  "250|100|12|50|f|solid": "236:b5b0ca56",
  "128|190|30|50|o1|solid": "256:a4614f5d",
  "128|190|30|50|o3|solid": "976:ffcc3c5",
  "128|190|30|50|f|solid": "1102:2e6ef1b9"
};

// -- Equal width and height: the circular ring, pixel for pixel --------------
const misses = [];
const missesTurned = [];
for (const [k, want] of Object.entries(PINS)) {
  const [cx, cy, r, inner, v, st] = k.split('|');
  const opts = { filled: v === 'f', thickness: v === 'o3' ? 3 : 1, lineStyle: st, innerRatio: Number(inner) / 100 };
  const x = Number(cx), y = Number(cy), rr = Number(r);
  if (hash(ring(x, y, x + rr, y + rr, opts)) !== want) misses.push(k);
  if (hash(ring(x, y, x - rr, y + rr, { ...opts, rotation: 37 })) !== want) missesTurned.push(k);
}
check(`equal width and height draws today's circular ring (${Object.keys(PINS).length} pins)`, misses.length === 0,
  misses.length + ' missed: ' + misses.slice(0, 8).join(' '));
check('a circular ring is the same at any Rotation (37 degrees here)', missesTurned.length === 0,
  missesTurned.length + ' missed: ' + missesTurned.slice(0, 8).join(' '));
check('the ring button picture is unchanged', hash(G.iconRaster('ring', 25)) === '116:811b480d', hash(G.iconRaster('ring', 25)));

// -- Width and height ----------------------------------------------------------
check('the ring is drawn from its centre like the ellipse', GC.isCenterAnchored('ring') === true);
{
  const e = extent(ring(100, 90, 140, 110));
  check('a 40 x 20 drag gives a ring 81 wide and 41 high round the press point',
    e.w === 81 && e.h === 41 && e.x0 === 60 && e.y0 === 70, JSON.stringify(e));
  const left = extent(ring(100, 90, 60, 70));
  check('dragging up and left gives the same ring', JSON.stringify(left) === JSON.stringify(e), JSON.stringify(left));
  const px = keyset(ring(100, 90, 140, 110));
  check('outline: the outer ellipse reaches the drag width and height',
    px.has('140,90') && px.has('60,90') && px.has('100,110') && px.has('100,70'));
  check('outline: the inner ellipse is half of each radius',
    px.has('120,90') && px.has('80,90') && px.has('100,100') && px.has('100,80'));
  check('outline: nothing between the two ellipses on the axes', !px.has('130,90') && !px.has('100,105') && !px.has('100,90'));
  const f = keyset(ring(100, 90, 140, 110, { filled: true }));
  check('filled: the band between the ellipses is filled',
    f.has('130,90') && f.has('70,90') && f.has('100,105') && f.has('100,75'));
  check('filled: the hole is left', !f.has('100,90') && !f.has('110,90') && !f.has('100,95'));
  check('filled: it keeps its outline', [...px].every(k => f.has(k)));
  const thin = keyset(ring(100, 90, 140, 110, { innerRatio: 0.9 }));
  const wide = keyset(ring(100, 90, 140, 110, { innerRatio: 0.1 }));
  check('Inner radius applies to both radii',
    thin.has('136,90') && thin.has('100,108') && wide.has('104,90') && wide.has('100,92'));
  const thick = ring(100, 90, 140, 110, { thickness: 3 });
  check('Thickness thickens the elliptic outline',
    keyset(thick).size > px.size && keyset(thick).has('141,90'));
}

// -- Rotation ------------------------------------------------------------------
check('the Shape tool offers Rotation for the ring',
  ShapeTool.optionsSchema.find(r => r.key === 'rotation').showIf.in.includes('ring'));
{
  const flat = ring(100, 90, 140, 110);
  const q = ring(100, 90, 140, 110, { rotation: 90 });
  const e = extent(q);
  check('a quarter turn stands the ring up: 41 wide, 81 high, same centre',
    e.w === 41 && e.h === 81 && e.x0 === 80 && e.y0 === 50, JSON.stringify(e));
  check('a quarter turn is the ring dragged 20 across and 40 down', hash(q) === hash(ring(100, 90, 120, 130)));
  check('filled, a quarter turn is the filled ring dragged 20 across and 40 down',
    hash(ring(100, 90, 140, 110, { rotation: 90, filled: true })) === hash(ring(100, 90, 120, 130, { filled: true })));
  check('-90 is the same as 90', hash(ring(100, 90, 140, 110, { rotation: -90 })) === hash(q));
  check('a half turn gives the same ring back (it is symmetric)',
    hash(ring(100, 90, 140, 110, { rotation: 180 })) === hash(flat));
  const t = ring(100, 90, 140, 110, { rotation: 30 });
  check('30 degrees changes the ring', hash(t) !== hash(flat));
  const te = extent(t);
  check('30 degrees turns it round the press point',
    Math.abs(te.x0 + te.x1 - 200) <= 1 && Math.abs(te.y0 + te.y1 - 180) <= 1 && te.h > 41 && te.w < 81, JSON.stringify(te));
  const tf = keyset(ring(100, 90, 140, 110, { rotation: 30, filled: true }));
  check('a turned filled ring leaves its hole and keeps its outline',
    !tf.has('100,90') && [...keyset(t)].every(k => tf.has(k)));
  // A pixel 30 degrees round from the right-hand end of the outer ellipse: (100 + 40 cos 30, 90 + 40 sin 30).
  check('30 degrees is clockwise on screen', keyset(t).has('135,110') || keyset(t).has('135,109') || keyset(t).has('134,110'));
  const back = keyset(ring(100, 90, 140, 110, { rotation: -30 }));
  const mirrored = new Set(t.map(p => p.x + ',' + (180 - p.y)));
  let differ = 0;
  for (const k of back) if (!mirrored.has(k)) differ++;
  check('turning by -30 is (nearly) the mirror image of +30', differ <= back.size / 10, differ + ' of ' + back.size);
  const pv = G.rotationPivot('ring', GC.centerAnchoredBounds(100, 90, 140, 110), {});
  check('the ring turns round its centre', !!pv && pv.x === 100 && pv.y === 90, JSON.stringify(pv));
}

// -- Line styles, flat drags ---------------------------------------------------
{
  const solid = keyset(ring(100, 90, 140, 110));
  const dashed = ring(100, 90, 140, 110, { lineStyle: 'dashed' });
  check('dashed: fewer pixels, all on the outline',
    dashed.length > 0 && keyset(dashed).size < solid.size && dashed.every(p => solid.has(p.x + ',' + p.y)));
  const dt = ring(100, 90, 140, 110, { lineStyle: 'dotted', rotation: 45 });
  const st = keyset(ring(100, 90, 140, 110, { rotation: 45 }));
  check('dotted at 45 degrees: on the turned outline',
    dt.length > 0 && keyset(dt).size < st.size && dt.every(p => st.has(p.x + ',' + p.y)));
  check('clear unfilled draws nothing', ring(100, 90, 140, 110, { lineStyle: 'clear' }).length === 0);
  const cf = ring(100, 90, 140, 110, { lineStyle: 'clear', filled: true });
  check('clear filled draws the band without its outline', cf.length > 0 && cf.every(p => !solid.has(p.x + ',' + p.y)));
  let flat = null;
  try { flat = ring(100, 90, 130, 90, { filled: true, rotation: 20 }); } catch (e) { flat = e; }
  check('a flat drag (no height) draws a line and does not throw',
    Array.isArray(flat) && keyset(flat).size >= 31, String(flat && flat.length));
  check('a drag of one pixel is one pixel', keyset(ring(100, 90, 101, 91)).size === 1);
}

// -- The Shape tool and Keep editable ------------------------------------------
{
  const tool = new ShapeTool();
  tool.setShapeType('ring');
  tool.setRingInner(50);
  tool.setRotation(25);
  const viaTool = tool._getShapePixels(100, 90, 140, 110);
  check('the Shape tool draws the ring from the centre-anchored box',
    hash(viaTool) === hash(ring(100, 90, 140, 110, { rotation: 25 })));
  const fig = tool._buildFigure(100, 90, 140, 110);
  check('kept editable, the ring draws what the one drag would', hash(fig.rasterise().pixels) === hash(viaTool));
  check('kept editable, the ring can be turned', fig.turnable === true);
  const shown = fig.rotatedPoints();
  const turned = GC._rotateXY(140, 110, 100, 90, 25);
  check('its drag handle is shown turned round the centre',
    shown[0].x === 100 && shown[0].y === 90 && shown[1].x === GC._snap(turned.x) && shown[1].y === GC._snap(turned.y),
    JSON.stringify(shown));
  fig.movePoint(1, shown[1]);
  check('moving the handle to where it is shown changes nothing', hash(fig.rasterise().pixels) === hash(viaTool));
  fig.movePoint(0, { x: 110, y: 95 });
  check('moving the centre handle moves the whole ring',
    hash(fig.rasterise().pixels) === hash(ring(110, 95, 150, 115, { rotation: 25 })));
}

summary();
