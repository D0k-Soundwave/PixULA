'use strict';
/**
 * Brush types as tool-rail buttons.
 *
 * Every non-solid brush type is a rail button that rides on the single
 * BrushTool, the same way the shape variants ride on ShapeTool
 * (ToolManager._brushVariants). This suite proves the wiring: each variant id
 * resolves to the BrushTool and pins BrushEngine to its type; the base Brush
 * button snaps back to a solid type; and the TOOL_GROUPS registry is complete
 * and collision-free so the rail, the keyboard map and the options panel all
 * agree.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/brush-shapes.js');
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
global.SelectionService = { isFloating() { return false; }, endFloatingPaste() {}, clear() {}, hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
BrushEngine.initialize();
ToolManager.register(new global.BrushTool());

// Every variant id and the type it must select.
const VARIANTS = {
  spray: 'spray',
  fade: 'fade',
  pattern: 'pattern',
  hatch: 'hatch'
};

const brushTool = ToolManager.getTool(TOOLS.BRUSH);

// ── Each variant rides on the one BrushTool and pins the engine ────────────

for (const [railId, type] of Object.entries(VARIANTS)) {
  check(`getTool('${railId}') resolves to the BrushTool instance`,
    ToolManager.getTool(railId) === brushTool);

  const ok = ToolManager.selectTool(railId);
  check(`selectTool('${railId}') succeeds and pins BrushEngine to '${type}'`,
    ok && BrushEngine.currentBrush === type);
  check(`selectTool('${railId}') stores the variant id as the current tool`,
    StateManager.getCurrentTool() === railId);
}

// ── The base Brush button snaps back to a solid type ───────────────────────

ToolManager.selectTool('spray');
ToolManager.selectTool(TOOLS.BRUSH);
check('selecting Brush after a variant returns to a solid type',
  BrushEngine.currentBrush === 'round' || BrushEngine.currentBrush === 'square');

// It restores the LAST solid, not always round.
ToolManager.selectTool(TOOLS.BRUSH);
brushTool.setBrushType('square');
ToolManager.selectTool('spray');
check('leaving square for a variant sets the engine to spray',
  BrushEngine.currentBrush === 'spray');
ToolManager.selectTool(TOOLS.BRUSH);
check('returning to Brush restores the last solid (square, not round)',
  BrushEngine.currentBrush === 'square');

// A variant selection must NOT be undone by ensureSolidBrush.
ToolManager.selectTool('fade');
check('a variant type survives selection (ensureSolidBrush only fires for Brush)',
  BrushEngine.currentBrush === 'fade');

// ── A brush arrives at a size where it IS that brush ───────────────────────
//
// Measured floors (docs/MINIMUM_SIZES.md, tools/measure-min-brushes.js): below
// them the spray lays one particle, the hatch misses its own lattice at some
// positions on the grid, and a pattern dab shows a fragment of a tile. Picking
// the tool raises the size to the floor; it never lowers it, and nothing is
// removed from the slider.

const FLOORS = { spray: 4, hatch: 4, pattern: 8 };

for (const [railId, floor] of Object.entries(FLOORS)) {
  const brush = ToolManager.tools.get(TOOLS.BRUSH);

  brush.setSize(1);                       // the size the last brush was left on
  ToolManager.selectTool(railId);
  check(`picking '${railId}' at size 1 arrives at size ${floor}`,
    brush.getSize() === floor, `got ${brush.getSize()}`);

  brush.setSize(24);                      // an artist working big keeps their size
  ToolManager.selectTool(TOOLS.BRUSH);
  ToolManager.selectTool(railId);
  check(`picking '${railId}' at size 24 leaves it at 24`,
    brush.getSize() === 24, `got ${brush.getSize()}`);
}

{
  // The fade has no floor: at one pixel a fade is still a fade, the dither
  // threshold simply decides that pixel.
  const brush = ToolManager.tools.get(TOOLS.BRUSH);
  brush.setSize(1);
  ToolManager.selectTool('fade');
  check('the fade brush keeps size 1 - a one-pixel fade is still a fade',
    brush.getSize() === 1, `got ${brush.getSize()}`);

  // And neither do round and square: size 1 is the pencil, which is the point.
  brush.setSize(1);
  ToolManager.selectTool(TOOLS.BRUSH);
  check('the base Brush keeps size 1 - that is the pencil',
    brush.getSize() === 1, `got ${brush.getSize()}`);
}

// ── The fade measures from the start point by default ─────────────────────
//
// The schema default and the brush's own default have to agree, or the panel
// shows one thing and the stroke does another.
{
  const row = global.BrushTool.optionsSchema.find(r => r.key === 'fadeMeasure');
  check('the fade measure defaults to distance from the start point',
    row.value === 'origin', `schema says ${row.value}`);
  check('the fade brush itself agrees with the schema',
    BrushEngine.brushes.get('fade').measureFrom === row.value);
  check('the menu lists the default first',
    row.options[0].value === 'origin');
}

// ── The rail registry is complete and collision-free ───────────────────────

const railEntries = [];
for (const group of TOOL_GROUPS) for (const t of group.tools) railEntries.push(t);

for (const railId of Object.keys(VARIANTS)) {
  const meta = railEntries.find(t => t.id === railId);
  check(`TOOL_GROUPS lists '${railId}' with an icon and an i18n label`,
    !!meta && typeof meta.icon === 'string' && meta.icon.length > 0 &&
    typeof meta.i18n === 'string' && meta.i18n.length > 0);
}

// Ids are unique across the whole rail (a variant id colliding with a real
// tool id would make routing ambiguous).
const ids = railEntries.map(t => t.id);
check('every rail id is unique', new Set(ids).size === ids.length);

// No variant id is also a registered tool class (they must go through routing).
for (const railId of Object.keys(VARIANTS)) {
  if (railId === 'spray') continue;   // spray keeps TOOLS.SPRAY, still variant-routed
  check(`'${railId}' is not a registered tool (routed, not classed)`,
    !ToolManager.hasTool(railId));
}

// Shortcuts that are assigned don't collide with existing tool keys.
const shortcuts = railEntries.filter(t => t.shortcut).map(t => t.shortcut.toUpperCase());
check('no duplicate keyboard shortcuts across the rail',
  new Set(shortcuts).size === shortcuts.length);

summary();
