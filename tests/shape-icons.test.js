'use strict';
/**
 * Shape icons — the pictures on the buttons in the Shape options.
 *
 * They are not artwork: each is the shape's OWN raster, posed to fill a box
 * (ShapeGenerator.iconRaster) and turned into SVG path data (Helpers
 * .pixelsToPath). That makes them checkable, which matters because a badly
 * posed shape fails SILENTLY — a pentagon struck from the corner of its box
 * lands almost entirely outside it and leaves a button showing three stray
 * pixels, which is exactly what the first cut of ICON_POSE did.
 *
 * So: every entry in the shape list must draw enough of itself, inside the
 * box, spread over most of it, and no two may come out identical.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; }
};
global.SelectionService = { hasSelection() { return false; }, isFloating() { return false; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');      // the numerals on the polygon icons
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/shape-tool.js');

const SIZE = 25;   // the renderer's box (option-controls SHAPE_ICON_SIZE)

// ── Every shape in the list poses inside its box ──────────────────────────
const entries = SHAPE_TYPE_OPTS.flatMap(g => g.options);
const rastered = entries.filter(o => !o.icon);      // the curve wears a sprite

check('every list entry is a shape or carries a sprite icon',
  entries.every(o => o.icon || ShapeGenerator.hasShape(o.value)));

const signatures = new Map();
for (const opt of rastered) {
  const pts = ShapeGenerator.iconRaster(opt.value, SIZE);

  check(`${opt.value}: draws something recognisable (>= 15 px)`, pts.length >= 15);
  check(`${opt.value}: stays inside the box`,
    pts.every(p => p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE));

  // Spread: a shape that fills less than half the box in either axis is posed
  // wrong (too small, or mostly clipped away).
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs) + 1;
  const spanY = Math.max(...ys) - Math.min(...ys) + 1;
  check(`${opt.value}: fills the box (${spanX}x${spanY} of ${SIZE})`,
    spanX >= SIZE / 2 && spanY >= SIZE / 2);

  signatures.set(opt.value, pts.map(p => `${p.x},${p.y}`).sort().join(';'));
}

// Two buttons showing the same picture is a UI bug even when both rasters are
// right — it means one of them is posed to hide what makes it different.
const seen = new Map();
let collisions = 0;
for (const [type, sig] of signatures) {
  if (seen.has(sig)) { collisions++; Logger.error('dup', `${type} == ${seen.get(sig)}`); }
  seen.set(sig, type);
}
check('no two shapes render the same icon', collisions === 0);

// The pair a square box would otherwise flatten into one picture.
check('rectangle is not drawn as a square',
  signatures.get('rectangle') !== signatures.get('square'));
check('ellipse is not drawn as a circle',
  signatures.get('ellipse') !== signatures.get('circle'));

// ── Icons that say what they are ──────────────────────────────────────────
// Uniqueness is not identifiability: a heptagon and a dodecagon rastered to
// DIFFERENT pixels and still looked like the same circle. These check the two
// fixes for that — a printed side count, and a redrawn glyph.

const c = (SIZE - 1) / 2;
/** Ink in the middle of the box, where a numeral would be. */
const middleInk = (pts) =>
  pts.filter(p => Math.abs(p.x - c) <= 5 && Math.abs(p.y - c) <= 4).length;

const badged = ['pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'dodecagon'];
for (const type of badged) {
  const icon = ShapeGenerator.iconRaster(type, SIZE);
  const bare = ShapeGenerator.generateShape(type,
    { x1: c, y1: c, x2: c, y2: 0 });   // the same pose, no icon treatment

  check(`${type}: prints its side count`, middleInk(icon) >= 8);
  check(`${type}: the outline itself has a clear middle`, middleInk(bare) === 0);
}

// Two digits must not run together into one blob, and 10 must differ from 12
// by more than a rounding accident.
check('10 and 12 are told apart by their numerals',
  signatures.get('decagon') !== signatures.get('dodecagon'));

// The redrawn glyphs: same shape, stated differently.
for (const type of ['flower', 'gear']) {
  const icon = ShapeGenerator.iconRaster(type, SIZE);
  const plain = ShapeGenerator.generateShape(type,
    { x1: 0, y1: 0, x2: SIZE - 1, y2: SIZE - 1 });
  const plainSig = plain.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).sort().join(';');
  check(`${type}: the icon is drawn for this size, not rastered at it`,
    signatures.get(type) !== plainSig);
  // A flower has a middle and a gear has a bore: both must show one.
  check(`${type}: has its centre`, middleInk(icon) > 0);
}

// ── Helpers.pixelsToPath ──────────────────────────────────────────────────
check('empty set gives empty path', Helpers.pixelsToPath([]) === '');
check('single pixel is one 1x1 subpath',
  Helpers.pixelsToPath([{ x: 3, y: 4 }]) === 'M3 4h1v1h-1z');
check('a horizontal run becomes ONE subpath',
  Helpers.pixelsToPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]) === 'M0 0h3v1h-3z');
check('a gap breaks the run',
  Helpers.pixelsToPath([{ x: 0, y: 0 }, { x: 2, y: 0 }]) === 'M0 0h1v1h-1zM2 0h1v1h-1z');
check('rows are separate subpaths',
  Helpers.pixelsToPath([{ x: 0, y: 1 }, { x: 0, y: 0 }]) === 'M0 0h1v1h-1zM0 1h1v1h-1z');
check('unsorted input is handled',
  Helpers.pixelsToPath([{ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }]) === 'M0 0h3v1h-3z');

// Every icon must produce path data the renderer can hand to SVG.
let emptyPaths = 0;
for (const [, sig] of signatures) {
  const pts = sig.split(';').map(s => { const [x, y] = s.split(','); return { x: +x, y: +y }; });
  if (Helpers.pixelsToPath(pts).length < 8) emptyPaths++;
}
check('no icon comes out as an empty path', emptyPaths === 0);

// ── The per-shape parameters reach the raster ─────────────────────────────
const bounds = { x1: 0, y1: 0, x2: 60, y2: 60 };
const shape = new ShapeTool();

const withShape = (type, mutate) => {
  shape.setShapeType(type);
  mutate();
  return ShapeGenerator.generateShape(type, bounds, shape._shapeOptions());
};

check('star points reach the generator',
  withShape('star', () => shape.setStarPoints(12)).length >
  withShape('star', () => shape.setStarPoints(3)).length);
check('gear teeth reach the generator',
  withShape('gear', () => shape.setGearTeeth(16)).length >
  withShape('gear', () => shape.setGearTeeth(3)).length);
check('spiral turns reach the generator',
  withShape('spiral', () => shape.setSpiralTurns(8)).length >
  withShape('spiral', () => shape.setSpiralTurns(1)).length);
check('flower petals reach the generator',
  withShape('flower', () => shape.setFlowerPetals(12)).length !==
  withShape('flower', () => shape.setFlowerPetals(3)).length);
check('ring inner radius reaches the generator',
  withShape('ring', () => shape.setRingInner(10)).length !==
  withShape('ring', () => shape.setRingInner(90)).length);
check('moon phase reaches the generator',
  withShape('moon', () => shape.setMoonPhase(10)).length !==
  withShape('moon', () => shape.setMoonPhase(90)).length);
check('arc sweep reaches the generator',
  withShape('arc', () => shape.setArcSpan(360)).length >
  withShape('arc', () => shape.setArcSpan(45)).length);

// Setters clamp — they are reachable from more than their slider.
shape.setStarPoints(99);   check('star points clamp high', shape.getStarPoints() === 12);
shape.setStarPoints(0);    check('star points clamp low', shape.getStarPoints() === 5);   // 0 -> default
shape.setArcSpan(1000);    check('arc sweep clamps high', shape.getArcSpan() === 360);
shape.setRingInner(1);     check('ring inner clamps low', shape.getRingInner() === 10);

// Arc and sector each arrive at their own natural sweep.
shape.setShapeType('circle');
shape.setShapeType('arc');
check('arc arrives as a half circle', shape.getArcSpan() === 180);
shape.setShapeType('sector');
check('sector arrives as a quarter wedge', shape.getArcSpan() === 90);
shape.setArcSpan(300);
shape.setShapeType('sector');
check('re-picking the SAME shape keeps a dialled sweep', shape.getArcSpan() === 300);

summary();
