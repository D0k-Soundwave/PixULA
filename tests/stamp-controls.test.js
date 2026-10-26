'use strict';
/**
 * Batch 5 part 5B: the rules behind the stamp controls (SelectionService.stampControls), in every screen mode, as plain
 * data - the panel only draws what they say. Also the overlap rule both write plans and the "changes nothing" hint share,
 * and that switching a parked stamp to Own colours snaps it to the cell grid.
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

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  SelectionService.floatingPaste = null;
}
const mask = Array.from({ length: 8 }, () => new Array(8).fill(true));
function stampWith(extra) {
  SelectionService.floatingPaste = null;
  SelectionService.startFloatingPasteFromMask(mask, 8, 8, 0, 0, 'ctl');
  const fp = SelectionService.floatingPaste;
  Object.assign(fp, extra || {});
  return fp.floatingLayer;
}
const keys = (c) => c.showThrough.parts.map(p => p.key).join(',');

enter('standard_ula');
check('no stamp, no controls', SelectionService.stampControls(LayerManager.layers[1]) === null);

let L = stampWith();
let c = SelectionService.stampControls(L);
check('a plain stamp: Clear dots only', !c.colours.visible && !c.convert.visible && !c.showThrough.visible && c.clearDots.visible);
check('Clear dots default is Leave background', c.clearDots.value === 'transparent');

L = stampWith({ attrs: [0x38] });
c = SelectionService.stampControls(L);
check('a stamp with colours (Map): Colours, Show through, Convert and Clear dots', c.colours.visible && c.colours.enabled && c.showThrough.visible && c.convert.visible && c.ownColours);
check('standard ULA show-through parts: ink, paper, bright, flash', keys(c) === 'ink,paper,bright,flash');

L = stampWith({ attrs: [0x38], opts: { colours: 'pixels' } });
c = SelectionService.stampControls(L);
check('set to Pixels only: Colours stays (to switch back), Show through goes', c.colours.visible && c.colours.value === 'pixels' && !c.showThrough.visible && !c.ownColours);

L = stampWith({ attrs: [1, 2, 3, 4], attrGrid: { cols: 2, rows: 2, cw: 4, ch: 4, ox: 0, oy: 0 } });
c = SelectionService.stampControls(L);
check('cells of another size: Colours shown but disabled, with the geometry flag', c.colours.visible && !c.colours.enabled && c.colours.geometry && !c.showThrough.visible);

// ULAplus: one CLUT box, on only when bright AND flash both show through
enter('ula_plus');
L = stampWith({ attrs: [0x38], opts: { showThrough: { bright: true, flash: false } } });
c = SelectionService.stampControls(L);
check('ULAplus parts: ink, paper, clut', keys(c) === 'ink,paper,clut');
check('CLUT box is off with only bright showing through', c.showThrough.parts[2].on === false);
L = stampWith({ attrs: [0x38], opts: { showThrough: { bright: true, flash: true } } });
check('CLUT box is on when both do', SelectionService.stampControls(L).showThrough.parts[2].on === true);

// Modes with no cell colours: Clear dots only
for (const m of ['timex_hires', 'layer2_256']) {
  enter(m);
  L = stampWith({ attrs: [0x38] });
  c = SelectionService.stampControls(L);
  check(`${m}: Clear dots only`, !c.colours.visible && !c.convert.visible && !c.showThrough.visible && c.clearDots.visible);
}
enter('gigascreen');
L = stampWith({ attrs: [0x38] });
c = SelectionService.stampControls(L);
check('GigaScreen: full set (each box covers both screens)', c.colours.visible && keys(c) === 'ink,paper,bright,flash');

// "this changes nothing" hint for Clear background
enter('standard_ula');
L = stampWith({ opts: { clearDots: 'overlap' } });
check('Clear background with Normal: has an effect', SelectionService.stampControls(L).clearDots.noEffect === false);
StateManager.setDrawMode('xor');
check('with XOR in force: changes nothing', SelectionService.stampControls(L).clearDots.noEffect === true);
StateManager.setDrawMode('normal');
L.xorMode = true;
check('with the stamp XOR box on: changes nothing', SelectionService.stampControls(L).clearDots.noEffect === true);
L.xorMode = false;
StateManager.setInverse(true);
check('with Inverse: has an effect', SelectionService.stampControls(L).clearDots.noEffect === false);
StateManager.setInverse(false);
L = stampWith({ attrs: [0x38], opts: { clearDots: 'overlap' } });
StateManager.setDrawMode('xor');
check('a stamp with its own colours ignores the draw mode, so never "changes nothing"', SelectionService.stampControls(L).clearDots.noEffect === false);
StateManager.setDrawMode('normal');

// _overlapClearMode is the one rule
check('Normal -> Erase', SelectionService._overlapClearMode(DRAW_MODE.NORMAL, false) === DRAW_MODE.ERASE);
check('Pixels Only -> Erase', SelectionService._overlapClearMode(DRAW_MODE.PIXEL_ONLY, false) === DRAW_MODE.ERASE);
check('right button -> set the dot', SelectionService._overlapClearMode(DRAW_MODE.NORMAL_ERASE, false) === DRAW_MODE.PIXEL_ONLY);
check('XOR and recolour modes have none', [DRAW_MODE.XOR, DRAW_MODE.XOR_PIXEL, DRAW_MODE.INK, DRAW_MODE.PAPER].every(m => SelectionService._overlapClearMode(m, false) === null));
check('the stamp XOR box has none', SelectionService._overlapClearMode(DRAW_MODE.NORMAL, true) === null);

// A parked stamp switched to Own colours is put on the cell grid
enter('standard_ula');
L = stampWith({ attrs: [0x38], opts: { colours: 'pixels' } });
SelectionService.floatingPaste.x = 13; SelectionService.floatingPaste.y = 11;
SelectionService.endFloatingPaste();
LayerManager.setCurrentLayer(L.index);
check('parked stamp sits off the grid', L.stamp.x === 13 && L.stamp.y === 11);
SelectionService.setStampOptions({ colours: 'coloured' }, L);
check('Own colours snaps a parked stamp to whole cells', L.stamp.x === 8 && L.stamp.y === 8);

summary();
