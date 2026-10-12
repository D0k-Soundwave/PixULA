'use strict';
/**
 * Batch 10A: the Text tool's Background option. "Clear background" is the stamp's existing Clear dots = 'overlap' (Batch 5),
 * set from the Text tool and kept in step with the Transform panel; default 'Leave background' changes nothing. Inverse
 * already gives reset-dot text (glyph dots cleared); with Clear background the box's other dots are set.
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
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/text-tool.js');

ColorManager.initialize();
const tool = new TextTool();
global.ToolManager = { getCurrentTool: () => tool, getTool: (id) => (id === TOOLS.TEXT ? tool : null) };
tool.setText('A');
tool.setFontFamily('ZX ROM');
tool.setTextSize(8);

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  return LayerManager.layers[1];
}
const dotsOf = (cell) => (cell.indices ? Array.from(cell.indices).map(v => (v >= 0 ? 1 : 0)) : Array.from(cell.pixels));
const rowsOf = (cell) => Array.from(cell.pixels).map(b => b.toString(2).padStart(8, '0'));

// -- the option and its default -------------------------------------------------------------------------------------------
check('the default is Leave background', tool.getTextBackground() === 'transparent');
tool.setTextBackground('nonsense');
check('an unknown value is ignored', tool.getTextBackground() === 'transparent');
{
  enter('standard_ula');
  tool._createPreviewStamp(4, 4);
  const fp = SelectionService.floatingPaste;
  check('a default text stamp carries no stamp options at all (so saved bytes do not change)', fp.opts == null || fp.opts === undefined);
}

// -- Clear background on a seeded target ------------------------------------------------------------------------------------
function placeText(mode, background, inverse) {
  const target = enter(mode);
  const c = target.getCell(0, 0);
  Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false });
  c.pixels.fill(0xFF);                 // a solid cell under the text
  if (c.indices) c.indices.fill(3);
  c.altered = true;
  StateManager.setInverse(!!inverse);
  tool.setTextBackground(background);
  tool.setTextAnchor('top-left');
  tool._createPreviewStamp(0, 0);
  const fp = SelectionService.floatingPaste;
  const stamp = fp.floatingLayer;
  stamp.isStamp = true;
  LayerManager.setCurrentLayer(1);
  SelectionService.commitStamp(stamp);
  return { cell: LayerManager.layers[1].getCell(0, 0), box: fp ? { w: fp.width, h: fp.height } : null };
}
{
  const leave = placeText('standard_ula', 'transparent', false);
  check('Leave background: the solid cell stays solid where the letter is clear', rowsOf(leave.cell).every(r => r === '11111111'));
  const clear = placeText('standard_ula', 'overlap', false);
  const rows = rowsOf(clear.cell);
  check('Clear background: the box is cleared and the letter drawn (not a solid cell any more)', rows.some(r => r !== '11111111') && rows.some(r => r.includes('1')), rows.join(' '));
  check('...the letter is in the box (the A has dots)', rows.some(r => r.includes('1')));
  const glyph = rows.join('');
  check('...and where the letter is clear, the dot is now OFF', (glyph.match(/0/g) || []).length > 8);
}

// -- Inverse gives reset-dot text -----------------------------------------------------------------------------------------------
{
  const inv = placeText('standard_ula', 'transparent', true);
  const rows = rowsOf(inv.cell);
  check('Inverse: the letter RESETS dots in a solid cell (reset-dot text)', rows.some(r => r.includes('0')) && rows.some(r => r.includes('1')), rows.join(' '));
  const only = (rows.join('').match(/0/g) || []).length;
  check('...and only the letter shape is reset (a small share of the cell)', only > 0 && only < 32);
  const both = placeText('standard_ula', 'overlap', true);
  const bothRows = rowsOf(both.cell).join('');
  check('Inverse + Clear background: the other dots of the box are SET, the letter reset', (bothRows.match(/1/g) || []).length > 30 && (bothRows.match(/0/g) || []).length > 0);
  StateManager.setInverse(false);
}

// -- every mode ------------------------------------------------------------------------------------------------------------------
for (const mode of ['multicolor_8x1', 'ula_plus', 'timex_hires', 'gigascreen', 'layer2_256', 'lores']) {
  const r = placeText(mode, 'overlap', false);
  const bits = dotsOf(r.cell);
  check(`${mode}: Clear background changes the cell and leaves some dots`, bits.length > 0 && bits.some(v => v) , mode);
  const l = placeText(mode, 'transparent', false);
  check(`${mode}: Leave background and Clear background differ`, JSON.stringify(dotsOf(l.cell)) !== JSON.stringify(bits));
}

// -- the effect is real or the hint says it is not -------------------------------------------------------------------------
{
  enter('standard_ula');
  check('Normal: Clear background has an effect', SelectionService.clearDotsHasEffect() === true);
  StateManager.setDrawMode('xor');
  check('XOR: it changes nothing', SelectionService.clearDotsHasEffect() === false);
  StateManager.setDrawMode('ink');
  check('Ink only: it changes nothing', SelectionService.clearDotsHasEffect() === false);
  StateManager.setDrawMode('paper');
  check('Paper only: it changes nothing', SelectionService.clearDotsHasEffect() === false);
  StateManager.setDrawMode('normal');
}

// -- live: the option patches the waiting stamp, no undo entry; the Transform panel's choice comes back ------------------------
{
  enter('standard_ula');
  tool.setTextBackground('transparent');
  tool._createPreviewStamp(40, 40);
  const undoBefore = UndoRedo.getUndoCount();
  tool.setTextBackground('overlap');
  const fp = SelectionService.floatingPaste;
  check('changing Background patches the waiting stamp', SelectionService.stampOptions(fp).clearDots === 'overlap');
  check('...with no undo entry', UndoRedo.getUndoCount() === undoBefore);
  tool.setTextBackground('transparent');
  check('...and back', SelectionService.stampOptions(fp).clearDots === 'transparent' && (fp.opts == null || fp.opts.clearDots === undefined));
  SelectionService.setStampOptions({ clearDots: 'overlap' }, fp.floatingLayer);
  check('the Transform panel changing Clear dots updates the Text tool option', tool.getTextBackground() === 'overlap');
}

summary();
