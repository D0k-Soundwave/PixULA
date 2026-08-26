'use strict';
/**
 * Phase 3 exit-criterion test (docs/REFACTOR_PLAN.md §4): every ported tool
 * draws correctly through the real drawing stack.
 *
 * Loads the REAL core (constants, event-bus, state-manager, attribute-system,
 * layer-manager, pixel-draw-routine) and the REAL tool layer (tool-base,
 * tool-manager, brush-engine, shape-generator, 13 tools), then drives each
 * tool through ToolManager's pointer entry points and asserts pixel/attr
 * effects. Only DOM-owning singletons (CanvasSystem) and not-yet-ported /
 * out-of-layer services (ColorManager token writes, PatternService,
 * SelectionService, UndoRedo) are stubbed.
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

// ── Stubs for DOM-owning / unported singletons ─────────────────────────────
global.CanvasSystem = {
  cursor: null, scroll: { x: 0, y: 0 },
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor(c) { this.cursor = c; },
  getScrollPosition() { return { ...this.scroll }; },
  setScrollPosition(x, y) { this.scroll = { x, y }; },
  getViewportSize() { return { width: 512, height: 384 }; },
  onReady(cb) { cb(); },
  getIframeDocument() { return null; },
  getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  // Zoom surface (mirrors the real semantics minus the scroll bookkeeping)
  getScaleFor(zoom) { return zoom / 100; },
  getScale() { return (StateManager.getZoom() || 100) / 100; },
  setZoom(zoom) { if (Validators.isValidZoom(zoom)) StateManager.setZoom(zoom); },
  zoomTo(zoom) { StateManager.setZoom(ZOOM_CONFIG.snap(zoom)); },
  zoomToRect(x, y, w, h) {
    const { width, height } = this.getViewportSize();
    const availW = width - 40, availH = height - 40;
    let target = ZOOM_CONFIG.MIN;
    for (let i = ZOOM_CONFIG.LEVELS.length - 1; i >= 0; i--) {
      const s = this.getScaleFor(ZOOM_CONFIG.LEVELS[i]);
      if (w * s <= availW && h * s <= availH) { target = ZOOM_CONFIG.LEVELS[i]; break; }
    }
    this.zoomTo(target);
  },
  fitZoom() {
    const { width, height } = this.getViewportSize();
    const availW = width - 40, availH = height - 40;
    for (let i = ZOOM_CONFIG.LEVELS.length - 1; i >= 0; i--) {
      const s = this.getScaleFor(ZOOM_CONFIG.LEVELS[i]);
      if (ZX_SPECTRUM.WIDTH * s <= availW && ZX_SPECTRUM.HEIGHT * s <= availH) {
        return ZOOM_CONFIG.LEVELS[i];
      }
    }
    return ZOOM_CONFIG.MIN;
  }
};

const colorCalls = [];
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; },
  setInk(i) { colorCalls.push(['ink', i]); this._sel.ink = i; },
  setPaper(p) { colorCalls.push(['paper', p]); this._sel.paper = p; },
  setBright(b) { colorCalls.push(['bright', b]); this._sel.bright = b; },
  getBright() { return this._sel.bright; },
  setSelection(s) { colorCalls.push(['selection', s]); Object.assign(this._sel, s); }
};

global.PatternService = {
  getCurrentPattern() { return { id: 'checker' }; },
  getCurrentPatternData() { return null; },
  shouldDrawPixel(x, y) { return (x + y) % 2 === 0; }
};

const selCalls = { setSelection: [], startMask: [], selectByColor: [] };
global.SelectionService = {
  isFloating() { return false; },
  endFloatingPaste() {},
  clear() {},
  hasSelection() { return false; },
  getSelection() { return null; },
  hasClipboard() { return false; },
  setSelection(rect) { selCalls.setSelection.push(rect); },
  selectByColor(x, y, c) { selCalls.selectByColor.push([x, y, c]); },
  startFloatingPasteFromMask(pixels, width, height, x, y, label) {
    selCalls.startMask.push({ pixels, width, height, x, y, label });
  }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');

// ── Real tool layer ────────────────────────────────────────────────────────
loadModule('js/data/zx-rom-font.js'); // TextTool builds its charset from this
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/shape-generator.js');

const TOOL_FILES = [
  ['brush-tool.js', 'BrushTool'], ['eraser-tool.js', 'EraserTool'],
  ['fill-tool.js', 'FillTool'], ['shape-tool.js', 'ShapeTool'],
  ['bezier-tool.js', 'BezierTool'],
  ['eyedropper-tool.js', 'EyedropperTool'], ['selection-tool.js', 'SelectionTool'],
  ['gradient-tool.js', 'GradientTool'], ['text-tool.js', 'TextTool'],
  ['move-tool.js', 'MoveTool'],
  ['zoom-tool.js', 'ZoomTool'],
  ['pattern-creator-tool.js', 'PatternCreatorTool']
];
for (const [file] of TOOL_FILES) loadModule('js/tools/' + file);

// ── Schema contract: every tool declares a static optionsSchema array ──────
for (const [file, cls] of TOOL_FILES) {
  check(`${file}: global ${cls} exposed with static optionsSchema[]`,
    typeof global[cls] === 'function' && Array.isArray(global[cls].optionsSchema));
}
check('schema entries carry key or slot/hint type', TOOL_FILES.every(([, cls]) =>
  global[cls].optionsSchema.every(e =>
    typeof e.key === 'string' || e.type === 'slot' || e.type === 'hint')));

// ── Registration (mirrors app.js Phase 4) ─────────────────────────────────
LayerManager.initialize();
for (const [, cls] of TOOL_FILES) ToolManager.register(new global[cls]());
ToolManager.initialize(TOOLS.BRUSH);
// 12 registered classes (the airbrush SprayTool was retired; spray is now the
// brush 'spray' variant riding on BrushTool via ToolManager._brushVariants).
check('12 tools registered', ToolManager.getToolIds().length === 12);
check('default tool is brush', ToolManager.getCurrentTool().id === TOOLS.BRUSH);

const layer = LayerManager.getCurrentLayer();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const ev = (over = {}) => ({
  button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  shiftKey: false, altKey: false, ...over
});
// Drive the active tool exactly like the input bridge does: direct handler
// calls (ToolManager.handlePointerUp clears isDrawing pre-delegation, which
// would break multi-phase tools such as gradient).
const down = (x, y, e = ev()) => ToolManager.getCurrentTool().onPointerDown(x, y, e);
const move = (x, y, e = ev()) => ToolManager.getCurrentTool().onPointerMove(x, y, e);
const up   = (x, y, e = ev()) => ToolManager.getCurrentTool().onPointerUp(x, y, e);

// ── Brush: down/move/up draws a stroke ─────────────────────────────────────
down(20, 20, ev());
move(24, 20, ev());
up(24, 20, ev());
check('brush: stroke start pixel set', isInk(20, 20));
check('brush: interpolated pixel set', isInk(22, 20));
check('brush: stroke end pixel set', isInk(24, 20));

// Right-button erases
down(22, 20, ev({ button: 2, buttons: 2 }));
up(22, 20, ev({ button: 2, buttons: 0 }));
check('brush: right-click erases', !isInk(22, 20));

// ── Eraser ────────────────────────────────────────────────────────────────
ToolManager.selectTool(TOOLS.ERASER);
down(20, 20, ev());
up(20, 20, ev());
check('eraser: clears the pixel', !isInk(20, 20));

// ── Shape tool + variants ─────────────────────────────────────────────────
ToolManager.selectTool(TOOLS.RECTANGLE);
const shapeTool = ToolManager.getCurrentTool();
shapeTool.setShapeType('rectangle');
down(40, 40, ev());
up(60, 56, ev());
check('rectangle: corner pixels set', isInk(40, 40) && isInk(60, 56) && isInk(60, 40) && isInk(40, 56));
check('rectangle: edge pixel set', isInk(50, 40));
check('rectangle: interior stays empty (outline mode)', !isInk(50, 48));

check('variant: selectTool("line") routes to ShapeTool', ToolManager.selectTool(TOOLS.LINE)
  && ToolManager.getCurrentTool() === shapeTool && shapeTool.getShapeType() === 'line');
down(70, 70, ev());
up(90, 90, ev());
check('line: endpoints + midpoint set', isInk(70, 70) && isInk(80, 80) && isInk(90, 90));

check('variant: selectTool("circle") sets shapeType', ToolManager.selectTool(TOOLS.CIRCLE)
  && shapeTool.getShapeType() === 'circle');
down(128, 120, ev());   // centre-anchored
up(138, 120, ev());     // radius 10
check('circle: edge pixels on the radius', isInk(138, 120) && isInk(118, 120) && isInk(128, 110) && isInk(128, 130));
check('circle: centre stays empty', !isInk(128, 120));

// ── Bezier (place anchors, drag the handle, commit with Enter) ────────────
ToolManager.selectTool(TOOLS.BEZIER);
const bezier = ToolManager.getCurrentTool();
down(20, 150, ev());
up(80, 150, ev());        // baseline placed -> edit phase, control at (50,150)
down(50, 150, ev());      // grab the control handle
move(50, 120, ev());      // bend the curve upward
up(50, 120, ev());
EventBus.emit(EVENTS.INPUT_KEY_DOWN, { key: 'Enter' });   // commit
check('bezier: anchors drawn after commit', isInk(20, 150) && isInk(80, 150));
check('bezier: curve bends toward the dragged handle',
  (() => { for (let y = 130; y < 150; y++) if (isInk(50, y)) return true; return false; })());
check('bezier: tool state reset after commit', bezier._phase === 'idle');

// ── Fill (contiguous, fills the enclosed rectangle interior) ──────────────
ToolManager.selectTool(TOOLS.FILL);
down(50, 48, ev());     // inside the 40,40-60,56 rectangle
check('fill: interior flooded', isInk(50, 48) && isInk(41, 41) && isInk(59, 55));
check('fill: does not leak past the border', !isInk(62, 48));

// ── Eyedropper ────────────────────────────────────────────────────────────
// Ink and paper are one attribute byte on a classic cell, not two
// independent picks - so ANY click (no button/Alt distinction) must pick
// BOTH together. Draw a cell with a distinct ink/paper pair, point the
// current selection somewhere else entirely, then plain-click that cell
// and check both land, not only ink.
ToolManager.selectTool(TOOLS.BRUSH);
ColorManager.setInk(3);
ColorManager.setPaper(2);
down(100, 100, ev());
up(100, 100, ev());
ColorManager.setInk(6);
ColorManager.setPaper(1);
colorCalls.length = 0;
ToolManager.selectTool(TOOLS.EYEDROPPER);
down(100, 100, ev());
up(100, 100, ev());
const plainPick = colorCalls.find(c => c[0] === 'selection');
check('eyedropper: a plain click picks a selection (ink+paper together), not a single setInk', !!plainPick);
check('eyedropper: plain click picks the cell\'s INK, not the current selection\'s',
  !!plainPick && plainPick[1].ink === 3);
check('eyedropper: plain click picks the cell\'s PAPER too, not just ink',
  !!plainPick && plainPick[1].paper === 2);

// Right-click and Alt+click must behave identically to a plain click here -
// there is no "just ink" or "just paper" half-pick in an attribute-based mode.
colorCalls.length = 0;
down(100, 100, ev({ button: 2, buttons: 2 }));
up(100, 100, ev({ button: 2, buttons: 0 }));
const rightPick = colorCalls.find(c => c[0] === 'selection');
check('eyedropper: right-click ALSO picks ink+paper together, not paper alone',
  !!rightPick && rightPick[1].ink === 3 && rightPick[1].paper === 2);

// ── Spray (now a brush variant: rail id 'spray' rides on BrushTool) ───────
ToolManager.selectTool(TOOLS.SPRAY);
const spray = ToolManager.getCurrentTool();
check('spray: rail id selects the brush tool with the spray type',
  spray === ToolManager.getTool(TOOLS.BRUSH) && BrushEngine.currentBrush === 'spray');
spray.setSize(12);
BrushEngine.setFlowRate(100);
down(200, 40, ev());
up(200, 40, ev());
let sprayHits = 0;
for (let y = 33; y <= 47; y++) for (let x = 193; x <= 207; x++) if (isInk(x, y)) sprayHits++;
check('spray: particles landed inside radius', sprayHits > 0);

// ── Gradient (two-phase: shape drag, then direction drag) ─────────────────
ToolManager.selectTool(TOOLS.GRADIENT);
down(160, 130, ev());
up(200, 160, ev());     // phase 1: lock 41×31 rect
down(165, 145, ev());
up(195, 145, ev());     // phase 2: commit L->R linear
let gradInk = 0, gradLeft = 0, gradRight = 0;
for (let y = 130; y <= 160; y++) {
  for (let x = 160; x <= 200; x++) {
    if (isInk(x, y)) { gradInk++; if (x < 175) gradLeft++; if (x > 185) gradRight++; }
  }
}
check('gradient: committed ink pixels inside rect', gradInk > 0);
check('gradient: density rises along the axis', gradRight > gradLeft);

// Additive, not a replacement: existing ink under the gradient's "paper"
// side must survive. Dithered off gives a deterministic hard 50% split so
// the paper/ink halves are known ahead of the draw.
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(212, 25, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
PixelDrawRoutine.endBatch();
check('gradient setup: pre-existing pixel is ink before the gradient runs', isInk(212, 25));

const gradient = ToolManager.getCurrentTool();
gradient.setDithered(false);
down(210, 10, ev());
up(250, 40, ev());       // phase 1: lock 41x31 rect (centre ~230,25)
down(212, 25, ev());
up(248, 25, ev());       // phase 2: commit L->R linear; 212 lands in the paper half, 248 in the ink half
check('gradient: pre-existing ink under the gradient\'s paper half survives (additive, not replaced)',
  isInk(212, 25));
check('gradient: the ink half still gets drawn', isInk(246, 25));

// ── Text tool (ZX ROM mask -> floating stamp) ──────────────────────────────
ToolManager.selectTool(TOOLS.TEXT);
const text = ToolManager.getCurrentTool();
text.setText('A');
text.setTextSize(8);
down(100, 100, ev());
const stamp = selCalls.startMask[selCalls.startMask.length - 1];
check('text: floating stamp created from 8×8 ZX ROM mask',
  !!stamp && stamp.width === 8 && stamp.height === 8 && stamp.label === 'Text');
check('text: mask contains glyph pixels', !!stamp && stamp.pixels.some(row => row.some(Boolean)));

// ── Selection tool (rect -> SelectionService.setSelection) ─────────────────
ToolManager.selectTool(TOOLS.SELECTION);
down(10, 10, ev());
move(30, 25, ev());
up(30, 25, ev());
const sel = selCalls.setSelection[selCalls.setSelection.length - 1];
check('selection: normalized rect committed',
  !!sel && sel.x === 10 && sel.y === 10 && sel.width === 21 && sel.height === 16);

// ── Move tool (pans via CanvasSystem scroll) ──────────────────────────────
ToolManager.selectTool(TOOLS.MOVE);
CanvasSystem.scroll = { x: 100, y: 100 };
down(0, 0, ev({ clientX: 500, clientY: 400 }));
move(0, 0, ev({ clientX: 480, clientY: 390 }));
up(0, 0, ev({ clientX: 480, clientY: 390 }));
check('move: dragging pans the viewport scroll',
  CanvasSystem.scroll.x === 120 && CanvasSystem.scroll.y === 110);
check('move: grab cursor restored on release', CanvasSystem.cursor === 'grab');

// ── Zoom tool (commands CanvasSystem; CANVAS_ZOOM event carries the fact) ──
// Clicks commit on pointer UP (a drag becomes the marquee) and step the
// multiplicative LADDER, anchored at the clicked pixel.
ToolManager.selectTool(TOOLS.ZOOM);
StateManager.setZoom(100);
let zoomEvent = null;
EventBus.on(EVENTS.CANVAS_ZOOM, (d) => { zoomEvent = d; });
down(128, 96, ev());
up(128, 96, ev());
check('zoom: left-click steps the ladder up (100 -> 200)', StateManager.getZoom() === 200);
check('zoom: EVENTS.CANVAS_ZOOM emitted with new zoom', !!zoomEvent && zoomEvent.zoom === 200);
down(128, 96, ev({ button: 2, buttons: 2 }));
up(128, 96, ev({ button: 2 }));
check('zoom: right-click steps the ladder down (200 -> 100)', StateManager.getZoom() === 100);
const zoomTool = ToolManager.getCurrentTool();
zoomTool.fitToWindow();
check('zoom: fitToWindow picks the largest level that fits with headroom',
  StateManager.getZoom() === 100); // avail 472×344 -> 200% (512×384) no longer fits

// ── Pattern creator (no panel yet — activation must not throw) ────────────
ToolManager.selectTool(TOOLS.PATTERN_CREATOR);
check('pattern creator: activates without PatternCreatorPanel', true);

summary();
