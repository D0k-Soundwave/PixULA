'use strict';
/**
 * Phase 7 quick win 3: rounded rectangle + parallelogram rasters.
 *
 * Pure-math assertions on ShapeGenerator.generateShape() output for the two
 * shapes that close the ZX-Paintbrush shape-list gap, plus the ShapeTool
 * umbrella wiring (TOOLS ids, ToolManager._shapeVariants, options select).
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
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/shape-tool.js');

const bounds = { x1: 10, y1: 10, x2: 60, y2: 40 };
const key = (p) => `${p.x},${p.y}`;
const inBounds = (pts, x1, y1, x2, y2) =>
  pts.every(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);

// ── Rounded rectangle ──────────────────────────────────────────────────────
const rr = ShapeGenerator.generateShape('rounded-rectangle', bounds);
const rrSet = new Set(rr.map(key));
check('rounded-rect: generates points', rr.length > 0);
check('rounded-rect: stays inside its bounds', inBounds(rr, 10, 10, 60, 40));
check('rounded-rect: sharp corners are cut', !rrSet.has('10,10') && !rrSet.has('60,10') && !rrSet.has('10,40') && !rrSet.has('60,40'));
check('rounded-rect: top edge midpoint present', rrSet.has('35,10'));
check('rounded-rect: bottom edge midpoint present', rrSet.has('35,40'));
check('rounded-rect: left edge midpoint present', rrSet.has('10,25'));
check('rounded-rect: right edge midpoint present', rrSet.has('60,25'));

const rrFilled = ShapeGenerator.generateShape('rounded-rectangle', bounds, { filled: true });
const rrFilledSet = new Set(rrFilled.map(key));
check('rounded-rect filled: has interior points', rrFilledSet.has('35,25'));
check('rounded-rect filled: more points than outline', rrFilled.length > rr.length);
check('rounded-rect filled: stays inside its bounds', inBounds(rrFilled, 10, 10, 60, 40));

// Degenerate drag falls back to a plain rectangle without throwing
const rrTiny = ShapeGenerator.generateShape('rounded-rectangle', { x1: 5, y1: 5, x2: 6, y2: 6 });
check('rounded-rect: degenerate bounds fall back cleanly', rrTiny.length > 0);

// ── Parallelogram ──────────────────────────────────────────────────────────
// Skew = 25% of width (12.5 -> 13 for a 50-wide drag). The exact (unskewed)
// corners sit on the diagonal the artist actually dragged - (10,10) to
// (60,40) is a "\" drag, so top-left and bottom-right land exactly on the
// press/release points and the OTHER diagonal (top-right, bottom-left) is
// what carries the skew.
const pg = ShapeGenerator.generateShape('parallelogram', bounds);
const pgSet = new Set(pg.map(key));
const skew = Math.round((60 - 10) * 0.25);
check('parallelogram: generates points', pg.length > 0);
check('parallelogram: stays inside its bounds', inBounds(pg, 10, 10, 60, 40));
check('parallelogram: top-left corner is exact (the press point)', pgSet.has('10,10'));
check('parallelogram: bottom-right corner is exact (the release point)', pgSet.has('60,40'));
check('parallelogram: top-right corner is skewed', pgSet.has(`${60 - skew},10`) && !pgSet.has('60,10'));
check('parallelogram: bottom-left corner is skewed', pgSet.has(`${10 + skew},40`) && !pgSet.has('10,40'));

// Dragging the OTHER diagonal ("/": top-right to bottom-left) mirrors it -
// now top-right and bottom-left are exact, top-left and bottom-right skewed.
const pgMirrored = ShapeGenerator.generateShape('parallelogram',
  { x1: 60, y1: 10, x2: 10, y2: 40 });
const pgMirroredSet = new Set(pgMirrored.map(key));
check('parallelogram (mirrored diagonal): top-right corner is exact (the press point)',
  pgMirroredSet.has('60,10'));
check('parallelogram (mirrored diagonal): bottom-left corner is exact (the release point)',
  pgMirroredSet.has('10,40'));
check('parallelogram (mirrored diagonal): top-left corner is skewed',
  pgMirroredSet.has(`${10 + skew},10`) && !pgMirroredSet.has('10,10'));
check('parallelogram (mirrored diagonal): bottom-right corner is skewed',
  pgMirroredSet.has(`${60 - skew},40`) && !pgMirroredSet.has('60,40'));

const pgFilled = ShapeGenerator.generateShape('parallelogram', bounds, { filled: true });
const pgFilledSet = new Set(pgFilled.map(key));
check('parallelogram filled: has interior points', pgFilledSet.has('35,25'));
check('parallelogram filled: more points than outline', pgFilled.length > pg.length);

// ── Umbrella wiring ────────────────────────────────────────────────────────
check('TOOLS carries the two new variant ids',
  TOOLS.ROUNDED_RECTANGLE === 'rounded-rectangle' && TOOLS.PARALLELOGRAM === 'parallelogram');

LayerManager.initialize();
ToolManager.register(new ShapeTool());
ToolManager.initialize(TOOLS.RECTANGLE);

check('selectTool(rounded-rectangle) routes onto ShapeTool',
  ToolManager.selectTool(TOOLS.ROUNDED_RECTANGLE) &&
  ToolManager.getCurrentTool().shapeType === 'rounded-rectangle');
check('selectTool(parallelogram) routes onto ShapeTool',
  ToolManager.selectTool(TOOLS.PARALLELOGRAM) &&
  ToolManager.getCurrentTool().shapeType === 'parallelogram');

const optEntries = SHAPE_TYPE_OPTS.flatMap(g => g.options);
const optValues = optEntries.map(o => o.value);
check('options select lists rounded-rectangle', optValues.includes('rounded-rectangle'));
check('options select lists parallelogram', optValues.includes('parallelogram'));
// An entry carrying `tool` is a tool switch, not a shapeType — the bezier curve
// is picked from this list but drawn by its own tool (OptionControls._commit).
check('every options-select shape has a generator, unless it IS another tool',
  optEntries.every(o => o.tool ? typeof o.tool === 'string' : ShapeGenerator.hasShape(o.value)));
check('the curve is offered in the shape list as a tool switch',
  optEntries.some(o => o.value === TOOLS.BEZIER && o.tool === TOOLS.BEZIER));

summary();
