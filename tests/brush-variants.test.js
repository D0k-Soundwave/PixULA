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

// ── Each brush family remembers its OWN size ───────────────────────────────
//
// Measured floors (docs/MINIMUM_SIZES.md, tools/measure-min-brushes.js): below
// them the spray lays one particle, the hatch misses its own lattice at some
// positions on the grid, and a pattern dab shows a fragment of a tile — so a
// family with no size of its own yet starts AT its floor on first arrival.
// Past that, each family keeps whatever the artist sets it to, completely
// independently of every other family: picking Spray must never hand you
// whatever the plain Brush was last left on, and vice versa — reported
// 2026-08-25 as "setting the spray brush default size to 4 also affected the
// normal brush default size", traced to every brush type sharing ONE
// BrushEngine.currentSize field. round/square are the one deliberate
// exception: they are brush SHAPE, not brush TYPE, and keep sharing a size.

const DEFAULTS = { spray: 4, hatch: 4, pattern: 8, fade: 3 };

for (const [railId, def] of Object.entries(DEFAULTS)) {
  const brush = ToolManager.tools.get(TOOLS.BRUSH);
  ToolManager.selectTool(railId);
  check(`'${railId}' starts at its own default size ${def} on first arrival`,
    brush.getSize() === def, `got ${brush.getSize()}`);
}

// Independence: changing one family's size must not move any other family's,
// and must not be lost when the artist steps away and comes back.
{
  const brush = ToolManager.tools.get(TOOLS.BRUSH);

  ToolManager.selectTool(TOOLS.BRUSH);
  brush.setSize(1);                       // the pencil - the base Brush's own size

  ToolManager.selectTool('spray');
  brush.setSize(20);                      // spray's own size, set independently

  ToolManager.selectTool(TOOLS.BRUSH);
  check("switching back to Brush after sizing Spray keeps Brush's own size (the reported bug)",
    brush.getSize() === 1, `got ${brush.getSize()}`);

  ToolManager.selectTool('spray');
  check('spray kept the size it was set to across the round trip',
    brush.getSize() === 20, `got ${brush.getSize()}`);

  ToolManager.selectTool('hatch');
  check("hatch is unaffected by spray's size change - still its own untouched default",
    brush.getSize() === 4, `got ${brush.getSize()}`);

  ToolManager.selectTool('pattern');
  check('pattern is unaffected too - still its own untouched default',
    brush.getSize() === 8, `got ${brush.getSize()}`);
}

// round and square are brush SHAPE, not brush TYPE - they deliberately keep
// sharing one size (the grouping this suite otherwise pins as independent).
{
  const brush = ToolManager.tools.get(TOOLS.BRUSH);
  ToolManager.selectTool(TOOLS.BRUSH);
  brush.setBrushType('round');
  brush.setSize(12);
  brush.setBrushType('square');
  check('round and square keep sharing ONE size - only the shape differs',
    brush.getSize() === 12, `got ${brush.getSize()}`);
  brush.setBrushType('round');
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
