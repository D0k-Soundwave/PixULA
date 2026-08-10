'use strict';
/**
 * Preset capture — the schema is the contract.
 *
 * The point of capturing tool options through each tool's own optionsSchema is
 * that a new option becomes preset-able the day it lands, with no edit to
 * PresetService. That only holds while every capturable key has the `get<Key>()`
 * the panel already reads, so THE INVENTORY CHECK BELOW IS THE ENFORCEMENT: add
 * an option without a getter and the build fails here, rather than the option
 * silently going missing from every preset the user saves afterwards.
 *
 * A key that genuinely should not travel opts out with `preset: false` (the
 * text tool's typed string), which is a deliberate declaration in the schema
 * rather than an omission anyone has to notice.
 *
 * Also drives the real capture/apply round trip and the validator that stops a
 * preset from an older build pushing an out-of-range value into a tool.
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
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}, setZoom() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; },
  getInk() { return 1; }, getPaper() { return 6; },
  getBright() { return true; }, getFlash() { return false; }, getBorder() { return 2; },
  setInk() {}, setPaper() {}, setBright() {}, setFlash() {}, setBorder() {},
  setInkTransparent() {}, setPaperTransparent() {}
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }, getPatternByPath() { return null; },
  setCurrentPattern() {}
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; },
  hasClipboard() { return false; }, refreshTextStamp() {}
};
global.GridOverlay = { drawCompositorPreview() {}, clearFunctionPreview() {}, drawPreviewPixels() {} };
global.FontService = null;
global.ReferenceLayerService = { getState() { return null; }, getImageInfo() { return null; } };
global.Storage = {
  STORES: { PRESETS: 'presets', PRESET_ASSETS: 'preset-assets' },
  async get() { return null; }, async set() {}, async delete() {}
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');
loadModule('js/tools/eraser-tool.js');
loadModule('js/tools/shape-tool.js');
loadModule('js/tools/bezier-tool.js');
loadModule('js/tools/fill-tool.js');
loadModule('js/tools/gradient-tool.js');
loadModule('js/tools/text-tool.js');
loadModule('js/tools/selection-tool.js');
loadModule('js/tools/zoom-tool.js');
loadModule('js/utils/preset-codec.js');
loadModule('js/services/preset-service.js');

const TOOL_CLASSES = [
  ['brush', global.BrushTool], ['eraser', global.EraserTool],
  ['shape', global.ShapeTool], ['bezier', global.BezierTool],
  ['fill', global.FillTool], ['gradient', global.GradientTool],
  ['text', global.TextTool], ['selection', global.SelectionTool],
  ['zoom', global.ZoomTool]
];

// ── The inventory: every capturable key can actually be captured ────────────

let keyCount = 0;
let optedOut = 0;
const missing = [];

for (const [label, ToolClass] of TOOL_CLASSES) {
  if (!ToolClass) { check(`${label}: tool class loaded`, false); continue; }
  const schema = ToolClass.optionsSchema || [];
  const tool = new ToolClass();

  for (const entry of schema) {
    if (!entry || !entry.key) continue;
    if (entry.type === 'hint' || entry.type === 'slot') continue;
    if (entry.preset === false) { optedOut++; continue; }

    keyCount++;
    const getter = 'get' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1);
    const setterName = entry.setter ||
      ('set' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1));

    if (typeof tool[getter] !== 'function') missing.push(`${label}.${entry.key} (no ${getter}())`);
    else if (typeof tool[setterName] !== 'function') {
      missing.push(`${label}.${entry.key} (no ${setterName}())`);
    }
  }
}

check(`every capturable option has a getter and a setter (${keyCount} keys, ${optedOut} opted out)`,
  missing.length === 0, missing.join('; '));
check('the schema still declares options to capture', keyCount > 30, `only ${keyCount}`);
check('opting out is used sparingly (content, not settings)', optedOut <= 3,
  `${optedOut} keys marked preset: false`);

// ── Capture / apply round trip on a real tool ──────────────────────────────

const PS = global.PresetServiceClass;
// The brush TYPES are registered by BrushEngine.initialize(), which the app
// calls at boot; without it setBrushType is a no-op and the round trip would
// only ever see 'round'.
global.BrushEngine.initialize();
const brush = new global.BrushTool();
global.ToolManager.register(brush);

brush.setSize(12);
brush.setFlowRate(45);
brush.setBrushType('spray');

const captured = PS.captureToolOptions('brush');
check('capture reads the brush schema', captured !== null);
check('capture picks up size', captured && captured.size === 12, JSON.stringify(captured));
check('capture picks up flow rate (the getter added for presets)',
  captured && captured.flowRate === 45);
check('capture picks up the brush type', captured && captured.brushType === 'spray');

brush.setSize(1);
brush.setFlowRate(100);
brush.setBrushType('round');
PS.applyToolOptions('brush', captured);

const recaptured = PS.captureToolOptions('brush');
check('apply puts every captured value back',
  JSON.stringify(recaptured) === JSON.stringify(captured),
  `${JSON.stringify(recaptured)} != ${JSON.stringify(captured)}`);

// Every type the brush can actually BE has to survive a round trip. The
// brushType row offers two values and declares the rest in `presetOptions`, so
// a type that exists in BrushEngine but is missing from that declaration is
// validated to undefined and skipped in silence — which is what happened to
// 'fade': the rail button sets it, and a preset saved while another tool was
// active brought back whatever type happened to be live. Driving this from the
// engine's own registry means a brush type added tomorrow fails the build
// rather than quietly dropping out of presets.
const brushTypeEntry = global.BrushTool.optionsSchema.find(e => e.key === 'brushType');
const engineTypes = [...global.BrushEngine.brushes.keys()];
const undeclared = engineTypes.filter(t => PS.validateOption(brushTypeEntry, t) === undefined);
check(`every registered brush type is preset-able (${engineTypes.length} types)`,
  undeclared.length === 0, `not in presetOptions: ${undeclared.join(', ')}`);

for (const type of engineTypes) {
  brush.setBrushType(type);
  const snap = PS.captureToolOptions('brush');
  brush.setBrushType('round');
  PS.applyToolOptions('brush', snap);
  check(`a preset saved on the ${type} brush comes back as ${type}`,
    brush.getBrushType() === type, `came back as ${brush.getBrushType()}`);
}
brush.setBrushType('round');

// The text tool's typed string is content, and must not ride along
const textSchema = global.TextTool.optionsSchema.find(e => e.key === 'textContent');
check('the text tool opts its typed string out of presets',
  textSchema && textSchema.preset === false);

// ── The validator: a preset outlives the build that wrote it ───────────────

const sizeEntry = { type: 'range', key: 'size', min: 1, max: 32 };
check('a range value above the current maximum is clamped, not applied raw',
  PS.validateOption(sizeEntry, 999) === 32);
check('a range value below the current minimum is clamped',
  PS.validateOption(sizeEntry, -5) === 1);
check('a range value that is not a number is refused',
  PS.validateOption(sizeEntry, 'big') === undefined);

const selectEntry = {
  type: 'select', key: 'brushType',
  options: [{ value: 'round' }, { value: 'square' }]
};
check('a select value that still exists is applied',
  PS.validateOption(selectEntry, 'square') === 'square');
check('a select value that no longer exists is refused',
  PS.validateOption(selectEntry, 'airbrush') === undefined);

const groupedEntry = {
  type: 'select', key: 'x',
  options: [{ i18n: 'g', options: [{ value: 'a' }, { value: 'b' }] }, { value: 'c' }]
};
check('optgroup values are recognised',
  PS.validateOption(groupedEntry, 'b') === 'b' &&
  PS.validateOption(groupedEntry, 'c') === 'c' &&
  PS.validateOption(groupedEntry, 'z') === undefined);

const dynamicEntry = { type: 'select', key: 'fontFamily', dynamic: '_enumerateFonts', options: [] };
check('a dynamic list trusts the stored value (the machine decides what exists)',
  PS.validateOption(dynamicEntry, 'Some Local Font') === 'Some Local Font');

check('a checkbox only accepts booleans',
  PS.validateOption({ type: 'check', key: 'f' }, true) === true &&
  PS.validateOption({ type: 'check', key: 'f' }, 'yes') === undefined);

// ── The slice registry ─────────────────────────────────────────────────────

const ids = global.PresetService.getSliceIds();
check('every registry slice is known to the codec',
  ids.every(id => PresetCodec.SLICE_IDS.includes(id)),
  ids.filter(id => !PresetCodec.SLICE_IDS.includes(id)).join(', '));
check('every codec slice id is in the registry',
  PresetCodec.SLICE_IDS.every(id => ids.includes(id)),
  PresetCodec.SLICE_IDS.filter(id => !ids.includes(id)).join(', '));
check('the reference slice carries the image, not just the transform',
  global.PresetService.getSlice('reference') !== null);
// The palette stopped being a slice on 2026-08-07: a custom palette is a
// document you build once and reuse, so it belongs in a file, not inside a
// workspace capture that could only restore it as a side effect of recalling
// six other things.
check('the palette is not a slice', global.PresetService.getSlice('palette') === null);
check('and the codec does not list it',
  !PresetCodec.SLICE_IDS.includes('palette'));
check('no slice touches the document, so nothing a preset applies is undoable',
  global.PresetService.SLICES.every(s => !s.document));

// A preset saved before the removal still loads — it just arrives without the
// palette, which is the codec's documented behaviour for a slice it does not
// know rather than a special case anyone had to write.
check('a stored preset carrying a palette slice decodes without it, intact', (() => {
  const payload = PresetCodec.encode({
    slot: 0, name: 'Old', slices: { color: { ink: 1 } }, meta: {}
  });
  payload.slices.palette = { ulaplus: [1, 2, 3] };
  const back = PresetCodec.decode(payload);
  return back !== null && back.slices.palette === undefined && back.slices.color.ink === 1;
})());
check('every slice has a label key for the dialogs',
  global.PresetService.SLICES.every(s => typeof s.i18n === 'string' && s.i18n));

summary();
