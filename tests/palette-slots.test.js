'use strict';
/**
 * Batch 6 part 6A: palette slots (four per palette kind), the palette inverter and the rules around them.
 * Slot 1..4 = index 0..3. The live register file is the active slot; the other slots are stored aside.
 * Switching a slot changes the colours shown and never the attribute bytes; each switch / invert is one undo step.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/utils/palette-ops.js');
global.SelectionService = {
  hasSelection() { return false; }, getSelection() { return null; }, isFloating() { return false; },
  engagedStamp() { return null; }, clear() {}, setSelection() {}, restoreFloatingState() {}, captureFloatingState() { return null; }, selection: null
};
loadModule('js/services/transform-service.js');
loadModule('js/io/scr-format.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  ColorManager.setUlaplusRegisters(null);
  ColorManager.setNextRegisters(null);
  ColorManager.resetPaletteSlots();
}
const T = () => TransformService;
const regs = () => Array.from(ColorManager.getUlaplusRegisters());
const attrBytes = () => JSON.stringify(LayerManager.getAllLayers({ packed: true }).map(l => l.attributeData));
const rgbOf = (i) => Array.from(ColorManager.getRGB(i));
const sameArr = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let undoDepth = () => (UndoRedo.undoStack ? UndoRedo.undoStack.length : (UndoRedo._undoStack ? UndoRedo._undoStack.length : -1));

// --- slots in ULAplus: switching changes colours, not attributes ----------------------------------------------------
enter('ula_plus');
const DEF = regs();
check('a new document is on slot 1', ColorManager.getPaletteSlot() === 0 && ColorManager.paletteSlotKind() === 'ulaplus64');
const attrsBefore = attrBytes();
const depth0 = undoDepth();

check('slot 2 starts as a copy of slot 1', (T().selectPaletteSlot(1), sameArr(regs(), DEF)));
ColorManager.setUlaplusRegister(0, 0xFF);     // edit slot 2
const slot2 = regs();
check('an edit goes to the active slot', slot2[0] === 0xFF);
const shown2 = rgbOf(0);
T().selectPaletteSlot(0);
check('slot 1 still has its own colours (the edit did not leak)', sameArr(regs(), DEF));
check('the shown RGB changed with the slot', !sameArr(rgbOf(0), shown2));
check('and the attribute bytes did not', attrBytes() === attrsBefore);
T().selectPaletteSlot(1);
check('slot 2 kept its edit', sameArr(regs(), slot2));
T().selectPaletteSlot(0);

// --- undo: one step per switch ----------------------------------------------------------------------------------------
T().selectPaletteSlot(2);
check('switched to slot 3', ColorManager.getPaletteSlot() === 2);
UndoRedo.undo();
check('one undo returns to slot 1', ColorManager.getPaletteSlot() === 0 && sameArr(regs(), DEF));
UndoRedo.redo();
check('redo returns to slot 3', ColorManager.getPaletteSlot() === 2);
UndoRedo.undo();
const d = undoDepth();
check('picking the slot already in use adds no undo step', (T().selectPaletteSlot(0), undoDepth() === d));
check('a bad slot is refused', T().selectPaletteSlot(7) === false && T().selectPaletteSlot(-1) === false);
void depth0;

// older undo entries survive later edits (stored files are never changed in place)
T().selectPaletteSlot(1);
ColorManager.setUlaplusRegister(5, 0x11);
T().selectPaletteSlot(0);
UndoRedo.undo();           // back to slot 2 with its edit
check('undo of a switch restores the slot with its later edit', ColorManager.getPaletteSlot() === 1 && regs()[5] === 0x11);
UndoRedo.undo();
UndoRedo.undo();
T().selectPaletteSlot(0);

// --- blocked where there is nothing to switch ------------------------------------------------------------------------
enter('standard_ula');
check('standard ULA has no slots', T().paletteCommandsBlocked().slots === 'fixedPalette' && ColorManager.paletteSlotKind() === null);
const d2 = undoDepth();
check('and a switch there does nothing', T().selectPaletteSlot(1) === false && undoDepth() === d2);
enter('gigascreen');
check('GigaScreen has none either', T().paletteCommandsBlocked().slots === 'fixedPalette');

// --- the inverter -------------------------------------------------------------------------------------------------------
enter('ula_plus');
ColorManager.setUlaplusRegisters(Array.from({ length: 64 }, (_, i) => i));
check('the inverter is open in ULAplus', T().paletteCommandsBlocked().invert === null);
const d3 = undoDepth();
check('Invert palette reports a change', T().invertPalette() === true);
const inv = regs();
let ok = true;
for (let c = 0; c < 4; c++) for (let i = 0; i < 8; i++) {
  if (inv[16 * c + i] !== 16 * c + 8 + i || inv[16 * c + 8 + i] !== 16 * c + i) ok = false;
}
check('it swaps entries 0-7 with 8-15 of each CLUT', ok);
check('it is one undo step', undoDepth() === d3 + 1);
T().invertPalette();
check('inverting twice restores the palette', sameArr(regs(), Array.from({ length: 64 }, (_, i) => i)));
UndoRedo.undo();
check('and undo takes one inversion back', sameArr(regs(), inv));
UndoRedo.undo();

for (const m of ['ulanext', 'layer2_256', 'standard_ula']) {
  enter(m);
  const b = T().paletteCommandsBlocked().invert;
  check(`the inverter is blocked in ${m}`, b !== null && T().invertPalette() === false);
}

// --- Next palette slots ------------------------------------------------------------------------------------------------
enter('ulanext');
check('Next modes have slots', ColorManager.paletteSlotKind() === 'rgb333' && T().paletteCommandsBlocked().slots === null);
const nextDef = Array.from(ColorManager.getNextRegisters());
T().selectPaletteSlot(3);
ColorManager.setNextRegister(7, 0x1FF);
T().selectPaletteSlot(0);
check('Next slot 1 is untouched by an edit in slot 4', sameArr(Array.from(ColorManager.getNextRegisters()), nextDef));
T().selectPaletteSlot(3);
check('Next slot 4 kept it', ColorManager.getNextRegisters()[7] === 0x1FF);

// --- ULAplus and ULAplus 8x1 share their slots; ULAplus and Next keep their own ------------------------------------------
enter('ula_plus');
T().selectPaletteSlot(2);
ColorManager.setUlaplusRegister(1, 0x22);
__setActiveScreenMode('ula_plus_8x1');
ColorManager.applyScreenMode();
check('ULAplus 8x1 shows the same slot', ColorManager.getPaletteSlot() === 2 && regs()[1] === 0x22);
__setActiveScreenMode('ulanext');
ColorManager.applyScreenMode();
check('Next has its own active slot', ColorManager.getPaletteSlot() === 0);
__setActiveScreenMode('ula_plus');
ColorManager.applyScreenMode();
check('and ULAplus remembers its own', ColorManager.getPaletteSlot() === 2);

// --- saving and loading ------------------------------------------------------------------------------------------------------
enter('ula_plus');
check('untouched slots write nothing into the file', ColorManager.exportPaletteSlots() === null);
T().selectPaletteSlot(1);
ColorManager.setUlaplusRegister(2, 0x33);
T().selectPaletteSlot(0);
const out = ColorManager.exportPaletteSlots();
check('used slots are written', out && out.ulaplus.active === 0 && out.ulaplus.slots.length === 4);
const viaJson = JSON.parse(JSON.stringify(out));
const liveBefore = regs();
enter('ula_plus');
ColorManager.setUlaplusRegisters(liveBefore);
ColorManager.importPaletteSlots(viaJson);
check('they come back from a file', ColorManager.getPaletteSlot() === 0);
T().selectPaletteSlot(1);
check('slot 2 has its saved edit', regs()[2] === 0x33);
T().selectPaletteSlot(0);
enter('ula_plus');
ColorManager.setUlaplusRegisters(liveBefore);
ColorManager.importPaletteSlots(undefined);
T().selectPaletteSlot(2);
check('a file without slots gives slot 1 and copies of its palette', sameArr(regs(), liveBefore));
ColorManager.importPaletteSlots({ ulaplus: { active: 9, slots: [] }, next: 3 });
check('a damaged slot block falls back to slot 1 plus copies', ColorManager.getPaletteSlot() === 0);
T().selectPaletteSlot(3);
check('...and slot 4 is a copy', sameArr(regs(), liveBefore));

// --- exports read the live file (the active slot) ---------------------------------------------------------------------------
enter('ula_plus');
T().selectPaletteSlot(1);
ColorManager.setUlaplusRegister(9, 0x44);
const bytes = SCRFormat.export();
check('a .scr is written from the active slot, and keeps its length',
  bytes.length === 6976 && bytes[6912 + 9] === 0x44, `len ${bytes.length}`);

summary();
