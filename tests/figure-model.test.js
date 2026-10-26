'use strict';
/**
 * Batch 7 part 7A: FigureModel - the pure geometry of the point-based figures (polyline, polygon, triangle, rays,
 * orthogonal line, parallel line). Every expected pixel set below is worked out by hand from the rule in the comment
 * beside it. The model reuses the Bresenham line, the disc thickening and the scanline polygon fill the shapes use.
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
const pts = (...xy) => xy.map(([x, y]) => ({ x, y }));
const make = (type, points, opts) => {
  const m = new FigureModel(type, opts || { filled: false, thickness: 1 });
  for (const p of points) m.addPoint(p);
  return m;
};
const same = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

// --- polyline -----------------------------------------------------------------------------------------------------------
{
  // (10,10) -> (14,10) is 5 pixels; (14,10) -> (14,13) is 4 pixels sharing (14,10): 5 + 3 = 8
  const m = make(T.POLYLINE, pts([10, 10], [14, 10], [14, 13]));
  const px = set(m.rasterise().pixels);
  check('polyline: an L of 8 pixels', px.size === 8, String(px.size));
  check('polyline: the corner is there', px.has('14,10') && px.has('10,10') && px.has('14,13'));
  check('a single point is a dot', make(T.POLYLINE, pts([3, 4])).rasterise().pixels.length === 1);
  check('no points, no pixels', make(T.POLYLINE, []).rasterise().pixels.length === 0);
}

// --- freehand runs join with straight segments, no gap ---------------------------------------------------------------------
{
  const m = new FigureModel(T.POLYLINE, { filled: false, thickness: 1 });
  m.addPoint({ x: 0, y: 0 });
  m.addFreehandRun(pts([5, 0], [5, 5], [0, 5]));
  const px = set(m.rasterise().pixels);
  // 0..5 along the top, down the right side, back along the bottom: 6 + 5 + 5 = 16
  check('a run joins straight segments with no gap', px.size === 16, String(px.size));
  m.removeLastPoint();
  check('Backspace removes a whole trailing run back to its press point', m.points.length === 1);
  const m2 = make(T.POLYLINE, pts([0, 0], [4, 0], [4, 4]));
  m2.removeLastPoint();
  check('Backspace removes one pressed point', m2.points.length === 2);
}

// --- polygon and triangle ----------------------------------------------------------------------------------------------------
{
  const tri = [[0, 0], [4, 0], [0, 4]];
  const outline = set(make(T.POLYGON, pts(...tri)).rasterise().pixels);
  // top row 5 + diagonal (3,1)(2,2)(1,3)(0,4) 4 + left column (0,1)(0,2)(0,3) 3 = 12
  check('polygon outline of a right triangle: 12 pixels', outline.size === 12, String(outline.size));
  const filled = set(make(T.POLYGON, pts(...tri), { filled: true, thickness: 1 }).rasterise().pixels);
  // rows 5 + 4 + 3 + 2 + 1 = 15
  check('polygon filled: 15 pixels', filled.size === 15, String(filled.size));
  check('...and it includes the interior (1,1)', filled.has('1,1'));
  const m = new FigureModel(T.TRIANGLE, { filled: false, thickness: 1 });
  m.addPoint({ x: 0, y: 0 }); m.addPoint({ x: 4, y: 0 }); m.addPoint({ x: 0, y: 4 });
  check('a triangle is complete at 3 points', m.isComplete());
  check('and refuses a fourth', m.addPoint({ x: 9, y: 9 }) === false && m.points.length === 3);
  check('triangle outline equals the polygon outline', same(set(m.rasterise().pixels), outline));
  // two points of a polygon: just a line
  check('a polygon with 2 points is a line', make(T.POLYGON, pts([0, 0], [4, 0])).rasterise().pixels.length === 5);
}

// --- a big freehand polygon: the fill must not overflow its buffers ----------------------------------------------------------
{
  // A right triangle with legs of 150, traced pixel by pixel: ~450 vertices and 300 non-horizontal edges (the old fixed
  // buffers held 128). Row y holds x = 0 .. 150 - y, so the area is 151 + 150 + ... + 1 = 151 * 152 / 2 = 11476 [C].
  const trace = [];
  for (let x = 0; x <= 150; x++) trace.push([x, 0]);
  for (let i = 1; i <= 150; i++) trace.push([150 - i, i]);
  for (let y = 149; y >= 1; y--) trace.push([0, y]);
  check('the trace has more than 128 vertices', trace.length > 128, String(trace.length));
  const m = new FigureModel(T.POLYGON, { filled: true, thickness: 1 });
  for (const [x, y] of trace) m.addPoint({ x, y });
  const px = set(m.rasterise().pixels);
  check('a 450-vertex freehand polygon fills the whole triangle (11476 pixels)', px.size === 11476, String(px.size));
  check('...and the corners are in it', px.has('0,0') && px.has('150,0') && px.has('0,150'));
}

// --- rays ------------------------------------------------------------------------------------------------------------------------
{
  // start (0,0); ends (4,0), (0,4), (4,4): three lines of 5 pixels, sharing (0,0): 1 + 4 + 4 + 4 = 13
  const px = set(make(T.RAYS, pts([0, 0], [4, 0], [0, 4], [4, 4])).rasterise().pixels);
  check('rays: every line starts at the first point', px.size === 13, String(px.size));
  check('rays: the ends are there', px.has('4,0') && px.has('0,4') && px.has('4,4'));
}

// --- orthogonal ------------------------------------------------------------------------------------------------------------------
{
  // A(0,10) B(20,10) C(8,4): the foot F is (8,10); line 1 is 21 pixels, line 2 (8,10)-(8,4) is 7 sharing (8,10): 27
  const m = make(T.ORTHOGONAL, pts([0, 10], [20, 10], [8, 4]));
  const px = set(m.rasterise().pixels);
  check('orthogonal: 27 pixels', px.size === 27, String(px.size));
  check('orthogonal: the foot of the perpendicular is on the first line', px.has('8,10') && px.has('8,4'));
  check('orthogonal: it is a right angle (the second line is vertical)', [4, 5, 6, 7, 8, 9, 10].every(y => px.has(`8,${y}`)));
  // C past the end: F = (25,10); the first line is NOT lengthened
  const far = set(make(T.ORTHOGONAL, pts([0, 10], [20, 10], [25, 4])).rasterise().pixels);
  check('orthogonal: C beyond B puts the foot beyond B, A to B stays as drawn', far.has('25,10') && far.has('25,4') && !far.has('22,10'));
  // diagonal: A(0,0) B(10,10) C(0,10): t = 100/200, F = (5,5)
  const diag = make(T.ORTHOGONAL, pts([0, 0], [10, 10], [0, 10]));
  check('orthogonal on a diagonal: the foot is (5,5)', set(diag.rasterise().pixels).has('5,5') && diag.segments()[1][0].x === 5 && diag.segments()[1][0].y === 5);
  check('with 2 points only the first line is drawn', make(T.ORTHOGONAL, pts([0, 10], [20, 10])).rasterise().pixels.length === 21);
  check('orthogonal is complete at 3 points', m.isComplete());
}

// --- parallel --------------------------------------------------------------------------------------------------------------------
{
  // A(0,0) B(10,0) C(5,5): the second line has C at its middle: (0,5)-(10,5)
  const m = make(T.PARALLEL, pts([0, 0], [10, 0], [5, 5]));
  const px = set(m.rasterise().pixels);
  check('parallel: two lines of 11 pixels', px.size === 22, String(px.size));
  check('parallel: the second line is centred on C', px.has('0,5') && px.has('10,5') && px.has('5,5'));
  // the second line equals the first line shifted by (P - A): an odd-length diagonal case fixes the rounding
  const odd = make(T.PARALLEL, pts([0, 0], [5, 3], [20, 20]));
  const seg = odd.segments();
  // d = (5,3): round(2.5) = 3, round(1.5) = 2, so P = C - (3,2) = (17,18)
  check('parallel: P = C - round(d/2) (Math.round: 2.5 -> 3, 1.5 -> 2)', seg[1][0].x === 17 && seg[1][0].y === 18 && seg[1][1].x === 22 && seg[1][1].y === 21);
  const a = set(ToolBase.getLinePoints(0, 0, 5, 3));
  const b = new Set(ToolBase.getLinePoints(17, 18, 22, 21).map(p => `${p.x - 17},${p.y - 18}`));
  check('parallel: the second line is the first one moved over, pixel for pixel', same(a, b));
}

// --- thickness -------------------------------------------------------------------------------------------------------------------
{
  const thick = make(T.POLYLINE, pts([10, 10], [30, 10]), { filled: false, thickness: 4 });
  const ref = ShapeGenerator.generateShape('line', { x1: 10, y1: 10, x2: 30, y2: 10 }, { thickness: 4 });
  check('a 2-point polyline at thickness 4 equals the line shape', same(set(thick.rasterise().pixels), set(ref)),
    `${thick.rasterise().pixels.length} vs ${ref.length}`);
}

// --- lifecycle ---------------------------------------------------------------------------------------------------------------------
{
  const m = new FigureModel(T.POLYLINE, { filled: false, thickness: 1 });
  check('a repeat of the last point is dropped', m.addPoint({ x: 1, y: 1 }) && m.addPoint({ x: 1, y: 1 }) === false && m.points.length === 1);
  m.addPoint({ x: 5, y: 1 });
  m.finish();
  check('a finished figure refuses points', m.finished === true && m.addPoint({ x: 9, y: 9 }) === false);
  m.removeLastPoint();
  check('and Backspace reopens it', m.finished === false);
  const w = m.withPoint({ x: 9, y: 9 });
  check('withPoint is a copy for the hover preview', w.points.length === m.points.length + 1 && m.points.length === 1);
  const c = m.clone();
  c.translate(3, 2);
  check('clone and translate move a copy', c.points[0].x === 4 && c.points[0].y === 3 && m.points[0].x === 1);
}

// --- line styles on figures ---------------------------------------------------------------------------------------------------------
{
  const LS = (style, o) => ({ filled: false, thickness: 1, lineStyle: style, ...(o || {}) });
  // (0,0) -> (20,0) -> (20,20): the pattern runs round the corner: x 0-17 on, then (20,4) on (path pixel 24)
  const m = make(T.POLYLINE, pts([0, 0], [20, 0], [20, 20]), LS('dashed'));
  const px = set(m.rasterise().pixels);
  check('dashed polyline: the pattern carries round the corner', px.has('17,0') && !px.has('18,0') && !px.has('20,3') && px.has('20,4') && px.has('20,20') && px.size === 18 + 17);
  check('...and the centre line (used for the colour core) stays solid', m.rasterise().centre.length === 41);

  // rays: every ray starts its pattern afresh from the first point
  const r = set(make(T.RAYS, pts([0, 0], [30, 0], [0, 30]), LS('dashed')).rasterise().pixels);
  check('dashed rays restart per ray', r.has('17,0') && !r.has('18,0') && r.has('0,17') && !r.has('0,18') && r.has('0,0'));

  // orthogonal and parallel are two runs of their own
  const par = set(make(T.PARALLEL, pts([0, 0], [30, 0], [15, 10]), LS('dashed')).rasterise().pixels);
  check('dashed parallel: both lines start at their own beginning', par.has('17,0') && !par.has('18,0') && par.has('17,10') && !par.has('18,10'));

  check('clear draws no outline', make(T.POLYLINE, pts([0, 0], [20, 0]), LS('clear')).rasterise().pixels.length === 0);
  const tri = make(T.POLYGON, pts([0, 0], [10, 0], [0, 10]), LS('clear', { filled: true })).rasterise().pixels;
  // 66 filled pixels, 30 on the outline (11 top + 10 left + 9 slanted): 36 inside
  check('clear on a filled triangle draws only the inside (36)', tri.length === 36, String(tri.length));
  const fd = make(T.POLYGON, pts([0, 0], [10, 0], [0, 10]), LS('dashed', { filled: true })).rasterise().pixels;
  // the 30 outline pixels run 18 on, 6 off, 6 on: the 6 off are cut from the 66-pixel fill
  check('a filled dashed triangle is the fill with the 6 gap pixels of its edge cut out (60)', fd.length === 60, String(fd.length));
  const t3 = set(make(T.POLYLINE, pts([0, 0], [20, 0]), LS('dashed', { thickness: 3 })).rasterise().pixels);
  const s3 = set(make(T.POLYLINE, pts([0, 0], [20, 0]), { filled: false, thickness: 3 }).rasterise().pixels);
  check('dashed at thickness 3 is solid', same(t3, s3));
}

// --- parallelogram (3 points: the fourth corner is D = A + C - B) --------------------------------------------------------------
{
  // A(0,0) B(6,0) C(9,3): D = (3,3). Outline: top 7 + bottom 7 + two slanted sides of 4 each, minus the 4 corners counted twice = 18
  const m = make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3]));
  const px = set(m.rasterise().pixels);
  check('parallelogram: 18 outline pixels', px.size === 18, String(px.size));
  check('...the fourth corner is A + C - B', px.has('3,3') && px.has('9,3') && px.has('0,0') && px.has('6,0'));
  const poly = make(T.POLYGON, pts([0, 0], [6, 0], [9, 3], [3, 3]));
  check('...the same pixels as the polygon through the four corners', same(px, set(poly.rasterise().pixels)));
  const f = { filled: true, thickness: 1 };
  check('...filled it is the polygon filled', same(set(make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3]), f).rasterise().pixels), set(make(T.POLYGON, pts([0, 0], [6, 0], [9, 3], [3, 3]), f).rasterise().pixels)));
  check('...filled: four rows of seven = 28 pixels', make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3]), f).rasterise().pixels.length === 28);
  const two = make(T.PARALLELOGRAM, pts([0, 0], [6, 0]));
  check('two points draw just the base (7 pixels)', two.rasterise().pixels.length === 7);
  check('it is complete at 3 points and takes no fourth', make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3])).isComplete() && !two.isComplete()
    && (() => { const m3 = make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3])); return m3.addPoint({ x: 1, y: 1 }) === false || m3.points.length === 3; })());
  const wide = make(T.PARALLELOGRAM, pts([20, 0], [30, 0], [15, 10]));          // D = (5,10)
  check('containsPoint sees inside the whole parallelogram, not just triangle ABC', wide.containsPoint(8, 9) === true);
  const pv = wide.pivot();
  check('the pivot is the centre of all four corners: (17.5, 5)', pv.x === 17.5 && pv.y === 5, JSON.stringify(pv));
  check('Triangle and Polygon pivots are unchanged (box of the stored points)', make(T.TRIANGLE, pts([0, 0], [10, 0], [0, 10])).pivot().x === 5);
  const mv = make(T.PARALLELOGRAM, pts([0, 0], [6, 0], [9, 3]));
  mv.movePoint(2, { x: 12, y: 4 });
  check('moving the third point moves the fourth with it: D = A + q - B', set(mv.rasterise().pixels).has('6,4') && mv.points.length === 3);
}

summary();
