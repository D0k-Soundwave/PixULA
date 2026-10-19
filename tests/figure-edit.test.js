'use strict';
/**
 * Batch 7 part 7C: editing a pending figure - the geometry. Moving a figure, moving one of its points and turning it must
 * give exactly the pixels of drawing it fresh there; a turn of 360 degrees (or 4 x 90, or 37 + 323) gives back the
 * original; a figure partly off the canvas edge is drawn correctly; ShapeFigure (a Shape drawing kept editable) draws
 * what the one-drag commit would.
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
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, getColorIndex: (b, br) => b + (br ? 8 : 0), setCanvasCursor() {} };
global.ColorManager = { getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; } };
global.SelectionService = { hasSelection() { return false; }, isFloating() { return false; } };
loadModule('js/tools/tool-base.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/figure-model.js');

const T = FIGURE_TYPES;
const key = (p) => `${p.x},${p.y}`;
const set = (pts) => new Set(pts.map(key));
const same = (a, b) => a.size === b.size && [...a].every(k => b.has(k));
const pts = (...xy) => xy.map(([x, y]) => ({ x, y }));
const SHAPES = {
  [T.POLYLINE]: pts([10, 10], [40, 20], [30, 50], [60, 45]),
  [T.POLYGON]: pts([10, 10], [50, 15], [35, 45], [12, 40]),
  [T.TRIANGLE]: pts([10, 10], [50, 15], [25, 45]),
  [T.PARALLELOGRAM]: pts([10, 10], [50, 15], [60, 45]),
  [T.RAYS]: pts([30, 30], [60, 20], [10, 55], [55, 60]),
  [T.ORTHOGONAL]: pts([10, 40], [60, 25], [30, 10]),
  [T.PARALLEL]: pts([10, 40], [60, 25], [30, 10])
};
const build = (type, points, opts) => {
  const m = new FigureModel(type, opts || { filled: false, thickness: 1 });
  for (const p of points) m.addPoint(p);
  return m;
};
const shifted = (points, dx, dy) => points.map(p => ({ x: p.x + dx, y: p.y + dy }));

// --- moving the whole figure = drawing it fresh there ---------------------------------------------------------------------------
for (const type of Object.values(T)) {
  for (const [label, opts] of [['plain', { filled: false, thickness: 1 }], ['filled', { filled: true, thickness: 1 }],
    ['dashed', { filled: false, thickness: 1, lineStyle: 'dashed' }], ['thick', { filled: false, thickness: 3 }]]) {
    const m = build(type, SHAPES[type], opts);
    m.translate(7, -3);
    const fresh = build(type, shifted(SHAPES[type], 7, -3), opts);
    check(`${type} ${label}: moving by (7,-3) = drawing it fresh there`, same(set(m.rasterise().pixels), set(fresh.rasterise().pixels)));
  }
}

// --- moving one point = drawing fresh with that point ---------------------------------------------------------------------------
for (const type of Object.values(T)) {
  const m = build(type, SHAPES[type]);
  m.movePoint(1, { x: 44, y: 33 });
  const moved = SHAPES[type].map((p, i) => (i === 1 ? { x: 44, y: 33 } : p));
  check(`${type}: moving point 1 = drawing fresh with that point`, same(set(m.rasterise().pixels), set(build(type, moved).rasterise().pixels)));
}

// --- rotation -------------------------------------------------------------------------------------------------------------------------
{
  const line = build(T.POLYLINE, pts([10, 10], [30, 10]));
  line.setRotation(90);
  const px = set(line.rasterise().pixels);
  check('a line (10,10)-(30,10) turned 90 degrees is the vertical x = 20, y 0 to 20', px.size === 21 &&
    [0, 10, 20].every(y => px.has(`20,${y}`)), String(px.size));
  line.setRotation(-90);
  check('...and -90 is the same line', same(set(line.rasterise().pixels), px));

  for (const type of Object.values(T)) {
    const m = build(type, SHAPES[type]);
    const before = set(m.rasterise().pixels);
    m.setRotation(360);
    const a = same(set(m.rasterise().pixels), before);
    m.setRotation(0);
    for (let i = 0; i < 4; i++) m.setRotation(m.getRotation() + 90);
    const b = same(set(m.rasterise().pixels), before);
    m.setRotation(0);
    m.setRotation(37); m.setRotation(m.getRotation() + 323);
    const c = same(set(m.rasterise().pixels), before);
    check(`${type}: a turn of 360, of 4 x 90, and of 37 + 323 give back the original`, a && b && c);
  }
  // a figure turned and then moved is the turned figure drawn there
  const m = build(T.POLYGON, SHAPES[T.POLYGON]);
  m.setRotation(30);
  const at = m.clone();
  at.translate(5, 5);
  const ref = build(T.POLYGON, shifted(SHAPES[T.POLYGON], 5, 5));
  ref.setRotation(30);
  check('a turned figure, moved, is the turned figure drawn there', same(set(at.rasterise().pixels), set(ref.rasterise().pixels)));
  // dragging a point of a turned figure keeps what you see and then moves the point
  const t2 = build(T.POLYLINE, pts([10, 10], [30, 10], [30, 30]));
  t2.setRotation(90);
  const shown = t2.handlePoint(2);
  t2.movePoint(1, { x: 25, y: 12 });
  check('moving a point of a turned figure bakes the turn first: the other points stay where they were drawn',
    t2.getRotation() === 0 && t2.points[2].x === shown.x && t2.points[2].y === shown.y);
}

// --- a figure partly off the canvas (negative coordinates) ----------------------------------------------------------------------------
{
  const m = build(T.POLYLINE, pts([-3, 5], [20, 5]), { filled: false, thickness: 1, lineStyle: 'dashed' });
  const px = m.rasterise().pixels;
  const xs = new Set(px.map(p => p.x));
  check('a dashed line from x = -3: 18 on from -3 to 14, none after (the last 6 are gap)', px.length === 18 &&
    xs.has(-3) && xs.has(14) && !xs.has(15) && px.every(p => p.y === 5), `${px.length}: ${[...xs].sort((a, b) => a - b).join(',')}`);
}

// --- containsPoint ----------------------------------------------------------------------------------------------------------------------------
{
  const tri = build(T.TRIANGLE, pts([0, 0], [20, 0], [0, 20]));
  check('an unfilled triangle still contains its inside', tri.containsPoint(5, 5) === true && tri.containsPoint(18, 18) === false);
  check('an open figure contains nothing', build(T.POLYLINE, pts([0, 0], [20, 0])).containsPoint(10, 0) === false);
}

// --- ShapeFigure -------------------------------------------------------------------------------------------------------------------------------
{
  const gen = (o) => ({ filled: false, thickness: 1, lineStyle: 'solid', rotation: 0, rounding: 0.5, ...o });
  const G = ShapeGenerator;
  const boundsOf = (shape, a, b) => (G.constructor.isCenterAnchored(shape)
    ? G.constructor.centerAnchoredBounds(a.x, a.y, b.x, b.y) : { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  const SHAPE_LIST = ['rectangle', 'square', 'rounded-rectangle', 'ellipse', 'circle', 'arc', 'sector', 'triangle', 'diamond', 'hexagon', 'parallelogram', 'star', 'heart'];
  let bad = 0;
  for (const shape of SHAPE_LIST) {
    const a = { x: 30, y: 40 }, b = { x: 70, y: 60 };
    const f = new ShapeFigure(shape, a, b, gen());
    const direct = set(G.generateShape(shape, boundsOf(shape, a, b), gen()));
    if (!same(set(f.rasterise().pixels), direct)) { bad++; console.log('  one-drag differs: ' + shape); }
    const moved = f.clone(); moved.translate(9, -4);
    const fresh = new ShapeFigure(shape, { x: a.x + 9, y: a.y - 4 }, { x: b.x + 9, y: b.y - 4 }, gen());
    if (!same(set(moved.rasterise().pixels), set(fresh.rasterise().pixels))) { bad++; console.log('  move differs: ' + shape); }
    if (f.turnable) {
      const g = f.clone(); g.setRotation(30); g.setRotation(g.getRotation() + 330);
      if (!same(set(g.rasterise().pixels), direct)) { bad++; console.log('  30 + 330 differs: ' + shape); }
      const t = f.clone(); t.setRotation(30);
      const t2 = t.clone(); t2.translate(6, 2);
      const fresh30 = new ShapeFigure(shape, { x: a.x + 6, y: a.y + 2 }, { x: b.x + 6, y: b.y + 2 }, gen({ rotation: 30 }));
      if (!same(set(t2.rasterise().pixels), set(fresh30.rasterise().pixels))) { bad++; console.log('  turned + moved differs: ' + shape); }
    }
  }
  check('ShapeFigure over 13 shapes: the one-drag raster, moving, 30 + 330 and turn-then-move all hold', bad === 0, `${bad} problems`);

  // moving a corner handle at rotation 0 = drawing fresh with that corner
  const r = new ShapeFigure('rectangle', { x: 30, y: 40 }, { x: 70, y: 60 }, gen());
  r.movePoint(1, { x: 90, y: 80 });
  check('rectangle: moving the second corner = the rectangle drawn to there', same(set(r.rasterise().pixels),
    set(G.generateShape('rectangle', { x1: 30, y1: 40, x2: 90, y2: 80 }, gen()))));
  // a turned rectangle: the opposite corner stays where it is drawn
  const rt = new ShapeFigure('rectangle', { x: 30, y: 40 }, { x: 70, y: 60 }, gen({ rotation: 90 }));
  const fixedBefore = rt.rotatedPoints()[0];
  rt.movePoint(1, { x: 80, y: 90 });
  const fixedAfter = rt.rotatedPoints()[0];
  check('a turned rectangle: dragging one corner leaves the opposite corner where it is drawn',
    Math.abs(fixedBefore.x - fixedAfter.x) <= 1 && Math.abs(fixedBefore.y - fixedAfter.y) <= 1,
    JSON.stringify([fixedBefore, fixedAfter]));
  check('a circle has no turn knob', new ShapeFigure('circle', { x: 30, y: 40 }, { x: 50, y: 40 }, gen()).turnable === false);
  check('a rectangle has one', new ShapeFigure('rectangle', { x: 30, y: 40 }, { x: 50, y: 60 }, gen()).turnable === true);
  const inside = new ShapeFigure('rectangle', { x: 30, y: 40 }, { x: 70, y: 60 }, gen());
  check('an unfilled shape still contains its inside', inside.containsPoint(50, 50) && !inside.containsPoint(10, 10));
  const j = ShapeFigure.fromJSON(JSON.parse(JSON.stringify(inside.toJSON())));
  check('toJSON / fromJSON keep the shape', same(set(j.rasterise().pixels), set(inside.rasterise().pixels)));
}

// --- a square drawn from a drag that is not square: its handles sit on its corners, and dragging one leaves the opposite one put
{
  const gen = (o) => ({ filled: false, thickness: 1, lineStyle: 'solid', rotation: 0, rounding: 0.5, ...o });
  const G = ShapeGenerator;
  const px = (f) => set(f.rasterise().pixels);
  const near = (p, q) => Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1;
  const drags = [[{ x: 60, y: 50 }, { x: 120, y: 90 }], [{ x: 120, y: 90 }, { x: 60, y: 50 }],
    [{ x: 120, y: 50 }, { x: 60, y: 90 }], [{ x: 60, y: 90 }, { x: 120, y: 50 }]];
  const problems = [];
  for (const [a, b] of drags) {
    const tag = `${a.x},${a.y}-${b.x},${b.y}`;
    const plain = new ShapeFigure('square', a, b, gen());
    for (const o of [{}, { filled: true }, { thickness: 3 }, { lineStyle: 'dashed' }, { rotation: 30 }, { rotation: -55, filled: true }]) {
      if (!same(px(new ShapeFigure('square', a, b, gen(o))), set(G.generateShape('square', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gen(o))))) {
        problems.push(tag + ': not the one-drag square ' + JSON.stringify(o));
      }
    }
    // the handles are two opposite corners of the square that is drawn
    const [h0, h1] = plain.rotatedPoints();
    if (Math.abs(h1.x - h0.x) !== 60 || Math.abs(h1.y - h0.y) !== 60) problems.push(tag + ': handles not on the corners ' + JSON.stringify([h0, h1]));
    for (const deg of [0, 30, -55, 90]) {
      // moving a handle to where it is drawn changes nothing, however often
      const f = new ShapeFigure('square', a, b, gen({ rotation: deg }));
      const before = px(f);
      for (let n = 0; n < 20; n++) for (const i of [0, 1]) f.movePoint(i, f.handlePoint(i));
      if (!same(px(f), before)) problems.push(`${tag} at ${deg}: 20 no-op drags changed the square`);
      // dragging one corner leaves the opposite corner where it is drawn
      for (const i of [0, 1]) {
        const g = new ShapeFigure('square', a, b, gen({ rotation: deg }));
        const fixed = g.handlePoint(1 - i);
        const h = g.handlePoint(i);
        g.movePoint(i, { x: h.x + 5, y: h.y + 5 });
        if (!near(g.handlePoint(1 - i), fixed)) problems.push(`${tag} at ${deg}: moving handle ${i} moved the other from ${JSON.stringify(fixed)} to ${JSON.stringify(g.handlePoint(1 - i))}`);
        const [p0, p1] = g.points;
        if (Math.abs(p1.x - p0.x) !== Math.abs(p1.y - p0.y)) problems.push(`${tag} at ${deg}: the stored box is not square`);
      }
    }
  }
  check('square from a non-square drag: one-drag raster, handles on the corners, no-op drags change nothing, the opposite corner stays',
    problems.length === 0, problems.slice(0, 4).join('; '));
}

summary();
