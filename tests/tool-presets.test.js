'use strict';
/**
 * Tool presets — one tool's own options, filed under that tool.
 *
 * The rule the whole feature rests on is that a tool can only load its OWN
 * presets, so most of what is checked here is separation: that the brush's list
 * and the eraser's list never see each other, that a rail variant is its own
 * tool for filing purposes (spray and fade ride on one BrushTool, and filing
 * them together would put a fade setup in the spray's list), and that the
 * library that comes back from storage is the library that went in.
 *
 * The other half is the storage round trip, driven against a fake Storage that
 * records what was written — the persistence is the feature, since a preset
 * that does not survive a reload is a preset nobody will trust twice.
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

// A Storage that remembers, so a "reload" is a second service reading the
// records the first one wrote.
const disk = new Map();
global.Storage = {
  STORES: { PRESETS: 'presets', PRESET_ASSETS: 'preset-assets', TOOL_PRESETS: 'tool-presets' },
  async get(key, store) { return disk.get(`${store}/${key}`) || null; },
  async set(key, value, store) { disk.set(`${store}/${key}`, JSON.parse(JSON.stringify(value))); },
  async delete(key, store) { disk.delete(`${store}/${key}`); }
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
loadModule('js/tools/zoom-tool.js');
loadModule('js/tools/eyedropper-tool.js');
loadModule('js/tools/move-tool.js');
loadModule('js/utils/preset-codec.js');
loadModule('js/services/preset-service.js');

global.BrushEngine.initialize();
const brush = new global.BrushTool();
const eraser = new global.EraserTool();
const zoom = new global.ZoomTool();
global.ToolManager.register(brush);
global.ToolManager.register(eraser);
global.ToolManager.register(zoom);
global.ToolManager.register(new global.EyedropperTool());
global.ToolManager.register(new global.MoveTool());

const PS = global.PresetService;

// ── The codec ───────────────────────────────────────────────────────────────

check('a tool preset needs a tool id',
  PresetCodec.encodeToolPreset({ name: 'x', options: { size: 4 } }) === null);
check('a tool preset needs at least one option',
  PresetCodec.encodeToolPreset({ tool: 'brush', name: 'x', options: {} }) === null);
check('a tool preset needs a name — there is no useful default for one',
  PresetCodec.encodeToolPreset({ tool: 'brush', name: '  ', options: { size: 4 } }) === null);

const encoded = PresetCodec.encodeToolPreset({
  tool: 'brush', name: '  1px pencil  ', options: { size: 1, brushType: 'round' }
});
check('a valid tool preset encodes, with its name trimmed',
  encoded && encoded.name === '1px pencil' && encoded.options.size === 1);
check('encoding stamps both timestamps',
  encoded && Number.isFinite(encoded.created) && Number.isFinite(encoded.modified));

const longName = 'x'.repeat(PresetCodec.MAX_NAME + 50);
check('an over-long name is cut to MAX_NAME, not refused',
  PresetCodec.encodeToolPreset({ tool: 'brush', name: longName, options: { size: 1 } })
    .name.length === PresetCodec.MAX_NAME);

check('a library round-trips through its record form', (() => {
  const payload = PresetCodec.encodeToolLibrary('brush', [
    { name: 'a', options: { size: 1 } }, { name: 'b', options: { size: 8 } }
  ]);
  const back = PresetCodec.decodeToolLibrary(payload, 'brush');
  return back.length === 2 && back[0].name === 'a' && back[1].options.size === 8;
})());

check('a record from another version decodes to nothing rather than to junk',
  PresetCodec.decodeToolLibrary({ v: PresetCodec.VERSION + 1, tool: 'brush',
    presets: [{ tool: 'brush', name: 'a', options: { size: 1 } }] }, 'brush').length === 0);

check('a record is read as the KEY says, whatever it claims to be', (() => {
  const back = PresetCodec.decodeToolLibrary(
    { v: PresetCodec.VERSION, tool: 'eraser',
      presets: [{ tool: 'eraser', name: 'a', options: { size: 1 } }] }, 'brush');
  return back.length === 1 && back[0].tool === 'brush';
})());

check('an unusable entry is dropped without taking the list with it',
  PresetCodec.decodeToolLibrary({ v: PresetCodec.VERSION, tool: 'brush', presets: [
    { name: 'good', options: { size: 1 } }, { name: '', options: { size: 2 } }, null
  ] }, 'brush').length === 1);

// ── Which tools can have presets at all ─────────────────────────────────────

check('a tool with options supports presets', PS.toolSupportsPresets('brush') === true);
check('a tool with an empty schema does not (eyedropper)',
  PS.toolSupportsPresets('eyedropper') === false);
check('nor does one whose schema is only a hint row (move)',
  PS.toolSupportsPresets('move') === false);
check('but a tool with a single real option does — zoom has zoomLevel',
  PS.toolSupportsPresets('zoom') === true);
check('an unknown tool does not', PS.toolSupportsPresets('nope') === false);

// ── Save, list, apply ───────────────────────────────────────────────────────

(async () => {

brush.setSize(1);
brush.setBrushType('round');
const pencil = await PS.saveToolPreset('brush', '1px pencil');
check('saving returns the stored preset', pencil !== null && pencil.name === '1px pencil');
check('it lists under its own tool', PS.listToolPresets('brush').length === 1);
check('and under no other', PS.listToolPresets('eraser').length === 0);

brush.setSize(16);
brush.setBrushType('spray');
await PS.saveToolPreset('brush', 'fat spray');
check('a second preset appends', PS.listToolPresets('brush').length === 2);

brush.setSize(4);
brush.setBrushType('square');
check('applying puts the options back',
  await PS.applyToolPreset('brush', '1px pencil') &&
  brush.getSize() === 1 && brush.getBrushType() === 'round');

check('applying an unknown name does nothing and says so',
  await PS.applyToolPreset('brush', 'no such preset') === false);

check('names are matched case- and space-insensitively',
  PS.getToolPreset('brush', '  1PX   PENCIL ') !== null);

// ── Separation: a tool sees only its own ────────────────────────────────────

eraser.setSize(32);
await PS.saveToolPreset('eraser', '1px pencil');
check('two tools may each hold the same NAME',
  PS.listToolPresets('brush').length === 2 && PS.listToolPresets('eraser').length === 1);

brush.setSize(9);
await PS.applyToolPreset('brush', '1px pencil');
check('and loading that name on the brush loads the BRUSH one', brush.getSize() === 1);

check('the eraser is untouched by the brush entry of the same name',
  PS.getToolPreset('eraser', '1px pencil').options.size === 32);

// A rail variant is its own tool for filing, even though one class serves both
brush.setBrushType('fade');
brush.setSize(12);
await PS.saveToolPreset('fade', 'soft fade');
check('a rail variant files under its own id, not its class',
  PS.listToolPresets('fade').length === 1 && PS.listToolPresets('brush').length === 2);

// A workspace preset's 'tool' slice (PresetServiceClass.SLICES in
// preset-service.js) walks every registered tool id and applies each one's
// captured options onto this ONE shared BrushTool instance BEFORE selecting
// which type ends up active. So applying spray's size must land in spray's
// own family even while some other type is the one currently active — never
// in whatever family happens to be live at that moment (the reported bug,
// one layer down: BrushEngine.familyForToolId is what makes this possible).
// `size` only, no `brushType`, isolates the size targeting from the type switch.
brush.setBrushType('pattern');
brush.setSize(8);
global.PresetServiceClass.applyToolOptions('spray', { size: 20 });
check("applying spray's size while pattern is active writes SPRAY's own family",
  BrushEngine.getSizeForFamily('spray') === 20);
check("...and does not touch pattern's own remembered size",
  BrushEngine.getSizeForFamily('pattern') === 8);
check('pattern is still the active type, still showing its own untouched size',
  BrushEngine.currentBrush === 'pattern' && brush.getSize() === 8);
brush.setBrushType('spray');
check('switching to spray afterward shows the size that was targeted at it',
  brush.getSize() === 20);
brush.setBrushType('pattern'); // leave state tidy for what follows

// ── Overwrite, rename, delete ───────────────────────────────────────────────

brush.setBrushType('round');
brush.setSize(3);
const before = PS.getToolPreset('brush', '1px pencil').created;
await PS.saveToolPreset('brush', '1px pencil');
check('re-saving a name replaces it in place rather than adding a twin',
  PS.listToolPresets('brush').length === 2);
check('the replacement keeps its original created date',
  PS.getToolPreset('brush', '1px pencil').created === before);
check('and holds the NEW options', PS.getToolPreset('brush', '1px pencil').options.size === 3);
check('it also keeps its position in the list',
  PS.listToolPresets('brush')[0].name === '1px pencil');

check('renaming to a name the tool already holds is refused',
  await PS.renameToolPreset('brush', '1px pencil', 'fat spray') === false);
check('renaming to a free name works',
  await PS.renameToolPreset('brush', '1px pencil', 'thin pencil') === true);
check('the old name is gone', PS.getToolPreset('brush', '1px pencil') === null);
check('the new one is there, with the same options',
  PS.getToolPreset('brush', 'thin pencil').options.size === 3);

check('deleting removes just that one',
  await PS.removeToolPreset('brush', 'thin pencil') === true &&
  PS.listToolPresets('brush').length === 1);
check('deleting what is not there reports so',
  await PS.removeToolPreset('brush', 'thin pencil') === false);

// ── The suggested name is always free ───────────────────────────────────────

check('the suggested name avoids the ones already taken', (() => {
  const suggestion = PS.suggestToolPresetName('brush', 'Brush');
  return PS.getToolPreset('brush', suggestion) === null;
})());

await PS.saveToolPreset('brush', 'Brush 1');
check('and keeps avoiding them as they fill up',
  PS.suggestToolPresetName('brush', 'Brush') === 'Brush 2');

// ── Persistence: a reload reads back what was written ───────────────────────

const reloaded = new global.PresetServiceClass();
await reloaded.restoreToolPresets();

check('every tool that had presets has them again',
  reloaded.listToolPresets('brush').length === PS.listToolPresets('brush').length &&
  reloaded.listToolPresets('eraser').length === 1 &&
  reloaded.listToolPresets('fade').length === 1);
check('a restored preset carries its options',
  reloaded.getToolPreset('eraser', '1px pencil').options.size === 32);
check('a tool that never had any comes back empty, not undefined',
  Array.isArray(reloaded.listToolPresets('zoom')) &&
  reloaded.listToolPresets('zoom').length === 0);

// Emptying a tool's list must remove its record, not leave an empty one that
// the next boot reads back as a phantom.
await PS.removeToolPreset('eraser', '1px pencil');
const afterDelete = new global.PresetServiceClass();
await afterDelete.restoreToolPresets();
check('a tool emptied of presets stores nothing at all',
  afterDelete.listToolPresets('eraser').length === 0 &&
  !disk.has('tool-presets/tool:eraser'));

// ── Stored values are re-validated against the live schema ──────────────────

// Reach past the API to plant what an older build could legitimately have
// written: the brush size slider ran further when this was saved.
PS.listToolPresets('fade')[0].options.size = 9999;
await PS.applyToolPreset('fade', 'soft fade');
check('a stored value out of the slider\'s current range is clamped on apply',
  brush.getSize() === global.BrushTool.optionsSchema.find(e => e.key === 'size').max);

PS.listToolPresets('fade')[0].options.brushType = 'airbrush';
brush.setBrushType('round');
await PS.applyToolPreset('fade', 'soft fade');
check('a stored select value the build no longer offers is skipped, not forced',
  brush.getBrushType() === 'round');

// ── The reference scope: a panel that is not a tool ─────────────────────────
//
// It files, lists, renames and deletes exactly like a tool, but its settings
// are a picture and a placement rather than schema rows — and the picture lives
// in the shared asset store, which is where this can go wrong in ways a tool
// preset cannot.

check('reference is a scope, and it is not a tool',
  PS.getPresetScope('reference') !== null && PS.getPresetScope('brush') === null);

check('with no image loaded there is nothing to capture',
  PS.toolSupportsPresets('reference') === false);
check('but the scope still EXISTS, so its panel keeps its controls',
  PS.hasPresetScope('reference') === true);
check('a tool with no options has no scope either way',
  PS.hasPresetScope('eyedropper') === false);

check('saving with no image saves nothing',
  await PS.saveToolPreset('reference', 'Nothing') === null &&
  PS.listToolPresets('reference').length === 0);

// Load a picture and a placement
const PIC_A = 'data:image/png;base64,AAAA';
const PIC_B = 'data:image/png;base64,BBBB';
let refState = {
  visible: true, opacity: 0.5, offsetX: 12, offsetY: -4, scale: 2,
  rotation: 90, flipX: true, flipY: false, fileName: 'tracing.png', imageUrl: PIC_A
};
global.ReferenceLayerService.getState = () => refState;
global.ReferenceLayerService.getImageInfo = () => ({ width: 64, height: 48 });
global.ReferenceLayerService.restoreState = (s) => { refState = { ...refState, ...s }; };
global.ReferenceLayerService.loadImage = (url) => { refState.imageUrl = url; };

check('with an image there is something to capture',
  PS.toolSupportsPresets('reference') === true);

const saved = await PS.saveToolPreset('reference', 'Head study');
check('a reference preset saves', saved !== null && saved.name === 'Head study');
check('it carries the placement, not the picture, in its own record',
  saved.options.offsetX === 12 && saved.options.scale === 2 &&
  saved.options.rotation === 90 && saved.options.assetData === undefined);
check('and points at the picture by content key',
  typeof saved.asset === 'string' && saved.asset === PresetCodec.hashAsset(PIC_A));
check('the picture itself is in the asset store',
  disk.has('preset-assets/' + saved.asset));

// Wreck the placement AND the picture, then load it back
refState = { ...refState, offsetX: 0, offsetY: 0, scale: 1, rotation: 0, imageUrl: PIC_B };
await PS.applyToolPreset('reference', 'Head study');
check('loading restores the placement', refState.offsetX === 12 && refState.scale === 2);
check('and the picture it was placed against', refState.imageUrl === PIC_A);

// Two presets tracing one photo
refState = { ...refState, offsetX: 99, imageUrl: PIC_A };
await PS.saveToolPreset('reference', 'Same photo, other spot');
const assetKeys = [...disk.keys()].filter(k => k.startsWith('preset-assets/') &&
  !k.endsWith('asset-index'));
check('two presets tracing one photo store it once', assetKeys.length === 1);
check('and both are listed under reference', PS.listToolPresets('reference').length === 2);

check('the reference list is offered to no tool',
  PS.listToolPresets('brush').every(p => p.name !== 'Head study'));

// The sweep is the dangerous part: it used to see only the slot library
await PS.saveToolPreset('brush', 'Unrelated');
check('saving an unrelated preset does not sweep away the reference picture',
  disk.has('preset-assets/' + saved.asset));

await PS.removeToolPreset('reference', 'Head study');
check('deleting one of two presets sharing a picture keeps the picture',
  disk.has('preset-assets/' + saved.asset));

await PS.removeToolPreset('reference', 'Same photo, other spot');
check('deleting the last one that referenced it drops the picture',
  !disk.has('preset-assets/' + saved.asset));

// And it all survives a reload
refState = { ...refState, imageUrl: PIC_A, offsetX: 7 };
await PS.saveToolPreset('reference', 'Kept');
const afterReload = new global.PresetServiceClass();
await afterReload.restoreToolPresets();
check('reference presets are restored at boot like any other scope',
  afterReload.listToolPresets('reference').length === 1 &&
  afterReload.getToolPreset('reference', 'Kept').options.offsetX === 7);
check('and still point at their picture',
  afterReload.getToolPreset('reference', 'Kept').asset === PresetCodec.hashAsset(PIC_A));

summary();

})();
