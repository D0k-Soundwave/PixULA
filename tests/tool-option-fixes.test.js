'use strict';
/**
 * Guards for options that were dead (no-ops) and have been made to work or
 * hidden. Each check would fail if the option reverts to doing nothing.
 * Drives the real tools/generator through the same call the panel uses.
 *   1. Shape LINE thickness reaches the raster (was ignored - only { filled }
 *      was passed, and _generateLine dropped options entirely).
 *   2. Shape "Filled" is hidden for open/1-D shapes (arc, spiral, x) and Line;
 *      the dead rectangle "border" row is gone.
 *   3. Gradient "Dithered" toggles output (was never read; always dithered).
 *   4. Text Bold/Italic change the bitmap-font mask (were canvas-only).
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
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; }, getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = { getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; } };
global.PatternService = { getCurrentPattern() { return null; }, getCurrentPatternData() { return null; }, shouldDrawPixel() { return true; } };
global.SelectionService = { isFloating() { return false; }, endFloatingPaste() {}, clear() {}, hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }, refreshTextStamp() {} };
global.GridOverlay = { drawCompositorPreview() {}, clearFunctionPreview() {}, drawPreviewPixels() {} };
global.FontService = null;

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');
loadModule('js/tools/shape-tool.js');
loadModule('js/tools/fill-tool.js');
loadModule('js/tools/gradient-tool.js');
loadModule('js/tools/text-tool.js');

// ── Shape LINE thickness ────────────────────────────────────────────────────
const shape = new global.ShapeTool();
shape.shapeType = 'line';
shape.setThickness(1);
const thin = shape._getShapePixels(20, 20, 80, 20).length;
shape.setThickness(6);
const thick = shape._getShapePixels(20, 20, 80, 20).length;
check(`shape/line: thickness reaches the raster (6px ${thick} > 1px ${thin})`, thick > thin);

// ── Shape outline thickness generalised to every unfilled shape ─────────────
shape.shapeType = 'rectangle';
shape.filled = false;
shape.setThickness(1);
const rThin = shape._getShapePixels(20, 20, 90, 70).length;
shape.setThickness(5);
const rThick = shape._getShapePixels(20, 20, 90, 70).length;
check(`shape/rectangle: outline thickness thickens the border (${rThick} > ${rThin})`, rThick > rThin);
shape.filled = true;
shape.setThickness(1);
const fA = shape._getShapePixels(20, 20, 90, 70).length;
shape.setThickness(5);
const fB = shape._getShapePixels(20, 20, 90, 70).length;
check('shape/rectangle: thickness is ignored when filled (fill unaffected)', fA === fB);
shape.filled = false; shape.setThickness(1);
const thickRow = global.ShapeTool.optionsSchema.find(e => e.key === 'thickness');
check('shape: thickness uses a compound (any) showIf', Array.isArray(thickRow.showIf.any));

// ── Shape schema: filled hidden for open shapes; border removed ─────────────
const filledRow = global.ShapeTool.optionsSchema.find(e => e.key === 'filled');
check('shape: "Filled" hidden for line/arc/spiral/x',
  ['line', 'arc', 'spiral', 'x'].every(s => filledRow.showIf.notIn.includes(s)));
check('shape: dead "border" row removed',
  !global.ShapeTool.optionsSchema.some(e => e.key === 'border'));
check('shape: dead border getter/setter removed', typeof shape.setBorder !== 'function');

// ── Gradient "Dithered" actually toggles ────────────────────────────────────
const grad = new global.GradientTool();
check('gradient: _dithered defaults ON (matches schema)', grad.getDithered() === true);
grad._dithered = false;                      // hard 50% threshold -> uniform at pos .5
let uniform = true;
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (!grad._shouldBeInk(x, y, 0.5)) uniform = false;
check('gradient: Dithered OFF is a hard threshold (uniform at pos 0.5)', uniform);
grad._dithered = true;                        // Bayer matrix -> varies across pixels
const first = grad._shouldBeInk(0, 0, 0.5);
let varies = false;
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (grad._shouldBeInk(x, y, 0.5) !== first) varies = true;
check('gradient: Dithered ON varies across pixels (Bayer)', varies);

// ── Text Bold/Italic change the bitmap mask ─────────────────────────────────
const tt = new global.TextTool();
const ink = m => m.pixels.reduce((n, row) => n + row.filter(Boolean).length, 0);
const plain = tt._buildTextMask('ABC', 'ZX ROM', false, false);
const bold  = tt._buildTextMask('ABC', 'ZX ROM', true,  false);
const ital  = tt._buildTextMask('ABC', 'ZX ROM', false, true);
check(`text: Bold thickens the bitmap mask (${ink(bold)} > ${ink(plain)})`, ink(bold) > ink(plain));
check(`text: Italic shears/widens the bitmap mask (${ital.width} > ${plain.width})`, ital.width > plain.width);

// ── Brush: Flow / Build-up gated to the brushes that use them ───────────────
// Solid/deterministic brushes (round, square, basic crosshatch, pattern) ignore
// flow and build-up, so the rows carry a compound showIf naming the scatter set.
const flowRow  = global.BrushTool.optionsSchema.find(e => e.key === 'flowRate');
const buildRow = global.BrushTool.optionsSchema.find(e => e.key === 'continuous');
const gatedOn = (c, types) => c && Array.isArray(c.any) &&
  c.any.some(x => Array.isArray(x.in) && types.every(t => x.in.includes(t)) &&
                  x.in.length === types.length) &&
  c.any.some(x => Array.isArray(x.all));   // the Fade-with-scatter-delegate branch
// Only spray scatters now: hatch is deterministic (tone = thickness/spacing)
// and its repeat stamps are idempotent, so Flow and Build-up mean nothing to it.
const SCATTER = ['spray'];
check('brush: Flow is shown only for scattering brushes (+ fade delegate)', gatedOn(flowRow.showIf, SCATTER));
check('brush: Build up is shown only for scattering brushes (+ fade delegate)', gatedOn(buildRow.showIf, SCATTER));

// Distribution (uniform / poisson) is the spray's sub-mode selector, so it
// follows spray (and a fade delegating to spray).
const distRow = global.BrushTool.optionsSchema.find(e => e.key === 'distribution');
check('brush: Distribution is shown for spray only (+ fade delegate)', gatedOn(distRow.showIf, ['spray']));

// Weighting is the UNIFORM distribution's dial (the retired Stipple brush was
// this slider at its 'even' end); Min spacing is the POISSON distribution's.
// Each is gated on spray AND its own distribution value.
const subModeGated = (showIf, dist) =>
  showIf && Array.isArray(showIf.all) &&
  showIf.all.some(c => gatedOn(c, ['spray'])) &&
  showIf.all.some(c => c.key === 'distribution' && c.equals === dist);

const weightRow = global.BrushTool.optionsSchema.find(e => e.key === 'weighting');
check('brush: Weighting is shown for spray + uniform distribution only',
  subModeGated(weightRow.showIf, 'uniform'));

const minDistRow = global.BrushTool.optionsSchema.find(e => e.key === 'minDistance');
check('brush: Min spacing is shown for spray + poisson distribution only',
  subModeGated(minDistRow.showIf, 'poisson'));

// The brush TYPES are now tool-rail buttons; the only type dropdown left is
// the base Brush button's Round/Square selector.
const brushTypeRow = global.BrushTool.optionsSchema.find(e => e.key === 'brushType');
check('brush: type selector offers only round/square (the rest are rail buttons)',
  brushTypeRow.options.length === 2 &&
  brushTypeRow.options.every(o => o.value === 'round' || o.value === 'square'));
check('brush: the Round/Square selector hides once a variant type is active',
  brushTypeRow.showIf && Array.isArray(brushTypeRow.showIf.in) &&
  brushTypeRow.showIf.in.includes('round') && brushTypeRow.showIf.in.includes('square') &&
  brushTypeRow.showIf.in.length === 2);
// The retired stipple ids still resolve, onto the brush that absorbed them.
BrushEngine.initialize();
check('brush: the retired stipple id aliases to spray',
  BrushEngine.setBrush('stipple') && BrushEngine.currentBrush === 'spray');
check('brush: the retired stipple-poisson id aliases to spray',
  BrushEngine.setBrush('stipple-poisson') && BrushEngine.currentBrush === 'spray');

// ── Fill: draw mode is now the GLOBAL top-bar selector, not a fill option ────
// Diagonal only matters for a contiguous PIXEL flood — so it needs both
// `contiguous` on and `attributesOnly` off (attribute fill floods whole cells
// four-way and has no use for either option).
const fillSchema = global.FillTool.optionsSchema;
check('fill: no per-tool drawMode option (moved to global top bar)',
  !fillSchema.some(e => e.key === 'drawMode'));
check('fill: attribute flood fill is an option, not a global draw mode',
  fillSchema.some(e => e.key === 'attributesOnly'));
const diagShowIf = fillSchema.find(e => e.key === 'diagonal').showIf;
const conds = (diagShowIf && diagShowIf.all) || [];
check('fill: Allow diagonal needs contiguous, and a pixel flood',
  conds.some(c => c.key === 'contiguous' && c.equals === true) &&
  conds.some(c => c.key === 'attributesOnly' && c.equals === false));

// ── Gradient: fillShape / ditherScale gated to the states that use them ─────
const gradSchema = global.GradientTool.optionsSchema;
const fillShapeShowIf = gradSchema.find(e => e.key === 'fillShape').showIf;
const ditherShowIf    = gradSchema.find(e => e.key === 'ditherScale').showIf;
check('gradient: Shape hidden while Shape-fill (constraint) is on',
  fillShapeShowIf.key === 'shapeConstraint' && fillShapeShowIf.equals === false);
check('gradient: Dither grain hidden when Dithered is off',
  ditherShowIf.key === 'dithered' && ditherShowIf.equals === true);

summary();
