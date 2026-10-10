'use strict';
/**
 * Batch 5 part 5C: Image > Attributes (Invert, Erase, Flip Horizontal/Vertical, Change...) on the cell colours of a
 * stamp that places its own colours, floating or parked. One undo step each; a hole is never read or written; the
 * selection is ignored; GigaScreen stamps hold one colour set; stamps without their own colours stay blocked.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  packRGB(rgb) { return (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; },
  blitCellBits() {}, blitCellIndices() {}
};
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/services/transform-service.js');

ColorManager.initialize();

const pack = (ink, paper, bright, flash) => SelectionService.packStampAttr({ ink, paper, bright, flash });
const unpack = (b) => (b == null ? null : SelectionService.unpackStampAttr(b));

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  SelectionService.floatingPaste = null;
  SelectionService.selection = null;
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
}

const A = pack(1, 2, true, false), B = pack(3, 4, false, true), C = pack(5, 6, false, false), D = pack(7, 0, true, true);
const E = pack(1, 3, false, false), G = pack(2, 5, true, false), H = pack(6, 7, false, true);
const ORIGINAL = [A, B, C, D, E, null, G, H];

/** A 4 x 2 cell stamp, cut 3 pixels into its first cell, one hole. */
function floatStamp(attrs) {
  const mask = Array.from({ length: 16 }, () => new Array(29).fill(true));
  SelectionService.startFloatingPasteFromMask(mask, 29, 16, 11, 8, 'attr');
  const fp = SelectionService.floatingPaste;
  fp.attrs = attrs ? attrs.slice() : null;
  if (attrs) fp.attrGrid = { cols: 4, rows: 2, cw: 8, ch: 8, ox: 3, oy: 0 };
  return fp;
}
const T = () => TransformService;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

enter('standard_ula');
let fp = floatStamp(ORIGINAL);

// --- Invert ----------------------------------------------------------------------------------------------------
check('a stamp with its own colours opens the Attributes commands', T().attributeCommandsBlocked() === null);
check('Invert changes every cell that has colours (7 of 8)', T().invertAttributes() === 7);
check('and swaps ink and paper, keeping bright and flash; holes stay holes',
  same(fp.attrs, [pack(2, 1, true, false), pack(4, 3, false, true), pack(6, 5, false, false), pack(0, 7, true, true),
    pack(3, 1, false, false), null, pack(5, 2, true, false), pack(7, 6, false, true)]));
check('the picture underneath is untouched', !LayerManager.layers[1].getCell(1, 1).altered);
UndoRedo.undo();
fp = SelectionService.floatingPaste;
check('ONE undo gives the colours back', same(fp.attrs, ORIGINAL));
UndoRedo.redo();
fp = SelectionService.floatingPaste;
check('redo does it again', fp.attrs[0] === pack(2, 1, true, false));
T().invertAttributes();
check('Invert twice is the identity', same(fp.attrs, ORIGINAL));

// --- Flip ------------------------------------------------------------------------------------------------------
check('Flip Horizontal reports the cells that changed', T().flipAttributesHorizontal() > 0);
check('Flip Horizontal mirrors the colour grid; a cell opposite a hole keeps its own',
  same(fp.attrs, [D, C, B, A, H, null, G, E]));
check('the dots, position and grid did not move', fp.x === 11 && fp.y === 8 && fp.attrGrid.ox === 3 && fp.pixels[0].length === 29);
T().flipAttributesHorizontal();
check('flipping back restores them', same(fp.attrs, ORIGINAL));
T().flipAttributesVertical();
check('Flip Vertical mirrors the rows', same(fp.attrs, [E, B, G, H, A, null, C, D]));
T().flipAttributesVertical();
check('and back again', same(fp.attrs, ORIGINAL));

// --- Erase honours the use-existing boxes ------------------------------------------------------------------------
ColorManager.setInk(6); ColorManager.setPaper(1); ColorManager.setBright(false); ColorManager.setFlash(false);
ColorManager.setInkTransparent(true);
T().eraseAttributes();
check('Erase writes the rail paper, bright and flash, and keeps each cell ink when Ink is "use existing"',
  fp.attrs.every((a, i) => a === null || (unpack(a).paper === 1 && unpack(a).ink === unpack(ORIGINAL[i]).ink &&
    !unpack(a).bright && !unpack(a).flash)));
check('a hole is still a hole', fp.attrs[5] === null);
ColorManager.setInkTransparent(false);
UndoRedo.undo();
fp = SelectionService.floatingPaste;

// --- Change... ---------------------------------------------------------------------------------------------------
const find = { ink: 1 }, replace = { ink: 5 };
const preview = T().previewChangeAttributes(find, replace);
check('Change... counts the cells that match (two have ink 1)', preview === 2, String(preview));
check('and changes exactly that many', T().changeAttributes(find, replace) === preview);
check('both now have ink 5, nothing else moved', unpack(fp.attrs[0]).ink === 5 && unpack(fp.attrs[4]).ink === 5 && fp.attrs[1] === B);
UndoRedo.undo();
fp = SelectionService.floatingPaste;
check('one undo reverses the Change', same(fp.attrs, ORIGINAL));
check('a find that matches nothing changes nothing', T().changeAttributes({ ink: 7, paper: 7, bright: false, flash: false }, { ink: 0 }) === 0);

// --- the selection is ignored --------------------------------------------------------------------------------------
SelectionService.setSelection({ x: 0, y: 0, width: 8, height: 8 });
check('a selection on the picture does not narrow a stamp command', T().invertAttributes() === 7);
SelectionService.selection = null;
T().invertAttributes();
check('...and the stamp is back to its start', same(fp.attrs, ORIGINAL));

// --- blocked cases ---------------------------------------------------------------------------------------------------
SelectionService.setStampOptions({ colours: 'pixels' });
check('a stamp set to Pixels only keeps them blocked', T().attributeCommandsBlocked() === 'stamp' && T().invertAttributes() === 0);
SelectionService.setStampOptions({ colours: 'coloured' });
check('Image > Dots Invert stays blocked on a stamp', T().dotCommandsBlocked().invert === 'stamp');
check('Image > Dots Flip stays blocked for a stamp with its own colours', T().dotCommandsBlocked().flip === 'stampAttrs');
check('the cell tools stay blocked on a stamp', T().cellToolBlocked('copy') === 'stamp');
SelectionService.cancelFloatingPaste();
enter('standard_ula');
floatStamp(null);
check('a stamp with no colours stays blocked', T().attributeCommandsBlocked() === 'stamp');
SelectionService.cancelFloatingPaste();

// --- a parked stamp ----------------------------------------------------------------------------------------------------
enter('standard_ula');
floatStamp(ORIGINAL);
SelectionService.endFloatingPaste();
const parked = LayerManager.layers.find(l => l.isStamp);
LayerManager.setCurrentLayer(parked.index);
check('a parked stamp with its own colours is open to the commands', T().attributeCommandsBlocked() === null);
check('Invert works on it', T().invertAttributes() === 7 && parked.stamp.attrs[0] === pack(2, 1, true, false));
UndoRedo.undo();
const parkedAfter = LayerManager.layers.find(l => l.isStamp);
check('and one undo gives them back', same(parkedAfter.stamp.attrs, ORIGINAL));

// --- GigaScreen: one colour set, screen A keys only ---------------------------------------------------------------------
enter('gigascreen');
floatStamp(ORIGINAL);
fp = SelectionService.floatingPaste;
ColorManager.setInk(4); ColorManager.setPaper(2);
T().eraseAttributes();
check('GigaScreen Erase writes the rail colours into the stamp', fp.attrs.every(a => a === null || (unpack(a).ink === 4 && unpack(a).paper === 2)));
check('Change... counts on one colour set only', T().previewChangeAttributes({ ink: 4 }, { ink: 1 }) === 7);
SelectionService.cancelFloatingPaste();

// --- ULAplus: bright and flash are the CLUT, kept by Invert ---------------------------------------------------------------
enter('ula_plus');
floatStamp(ORIGINAL);
fp = SelectionService.floatingPaste;
T().invertAttributes();
check('ULAplus Invert keeps the CLUT bits (bright, flash)', fp.attrs.every((a, i) => a === null || (a & 0xC0) === (ORIGINAL[i] & 0xC0)));
SelectionService.cancelFloatingPaste();

summary();
