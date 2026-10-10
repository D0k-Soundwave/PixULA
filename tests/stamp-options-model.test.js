'use strict';
/**
 * Batch 5 part 5A: the per-stamp settings model. A stamp carries optional `attrGrid` (the shape of its
 * colour cells) and `opts` (colours / show-through / clear dots). This pins the plumbing only: defaults when
 * absent, a clean read of anything a file holds, survival through save, undo capture, restore and duplicate,
 * and that a stamp with no settings still saves with neither field.
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
__setActiveScreenMode('standard_ula');
ColorManager.applyScreenMode();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);

const mask = Array.from({ length: 8 }, () => new Array(16).fill(true));

// --- defaults -------------------------------------------------------------------------------------------
let o = SelectionService.stampOptions({ attrs: null });
check('no attrs: colours default to pixels', o.colours === 'pixels');
check('clear dots default to transparent', o.clearDots === 'transparent');
check('show-through defaults to all off', !o.showThrough.ink && !o.showThrough.paper && !o.showThrough.bright && !o.showThrough.flash);
check('attrs present, colours default to coloured (worked out when read)', SelectionService.stampOptions({ attrs: [1, 2] }).colours === 'coloured');
check('a stored colours setting wins', SelectionService.stampOptions({ attrs: [1, 2], opts: { colours: 'pixels' } }).colours === 'pixels');
const g = SelectionService.stampAttrGrid({ attrs: [1, 2], w: 16, h: 8 });
check('default grid is 8x8 cells from the size', g.cols === 2 && g.rows === 1 && g.cw === 8 && g.ch === 8 && g.ox === 0 && g.oy === 0);
check('no grid without attrs', SelectionService.stampAttrGrid({ w: 16, h: 8 }) === null);

// --- the three states of "can it place its colours" ----------------------------------------------------------
const data = { attrs: [1, 2], w: 16, h: 8 };
check('standard ULA: colours can be placed', SelectionService.stampColoursBlocked(data) === null && SelectionService.stampColoured(data));
check('no attrs: noColours', SelectionService.stampColoursBlocked({ w: 8, h: 8 }) === 'noColours');
check('pixels setting: not coloured', !SelectionService.stampColoured({ ...data, opts: { colours: 'pixels' } }));
check('other cell size: geometry', SelectionService.stampColoursBlocked({ ...data, attrGrid: { cols: 4, rows: 2, cw: 4, ch: 4, ox: 0, oy: 0 }, attrs: new Array(8).fill(0) }) === 'geometry');
__setActiveScreenMode('timex_hires');
ColorManager.applyScreenMode();
check('a mode without cell colours: mode', SelectionService.stampColoursBlocked(data) === 'mode');
__setActiveScreenMode('standard_ula');
ColorManager.applyScreenMode();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);

// --- a plain stamp saves exactly as before ----------------------------------------------------------------------
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'plain');
let layers = LayerManager.getAllLayers();
let saved = layers.find(l => l.isStamp);
check('a stamp with no settings has no attrGrid in the file', saved && !('attrGrid' in saved.stamp));
check('a stamp with no settings has no opts in the file', saved && !('opts' in saved.stamp));
SelectionService.cancelFloatingPaste();

// --- settings survive save, read, undo capture, duplicate ---------------------------------------------------------
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'set');
const fp = SelectionService.floatingPaste;
fp.attrs = [0x38, 0x41];
fp.attrGrid = { cols: 2, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 };
fp.opts = { colours: 'coloured', clearDots: 'overlap', showThrough: { ink: true, paper: false, bright: true, flash: false } };
const stampLayer = fp.floatingLayer;

layers = LayerManager.getAllLayers();
saved = layers.find(l => l.isStamp);
check('saved stamp keeps attrGrid', saved.stamp.attrGrid && saved.stamp.attrGrid.cols === 2);
check('saved stamp keeps opts', saved.stamp.opts.clearDots === 'overlap' && saved.stamp.opts.showThrough.ink === true);
check('the saved copy is not the live object', saved.stamp.opts !== fp.opts && saved.stamp.opts.showThrough !== fp.opts.showThrough);
const viaJson = JSON.parse(JSON.stringify(saved));
const cleaned = LayerManager._readStamp(viaJson.stamp);
check('reading it back keeps the settings', cleaned.opts.clearDots === 'overlap' && cleaned.opts.showThrough.bright === true && cleaned.attrGrid.rows === 1);

const state = SelectionService.captureFloatingState();
check('floating capture carries opts and grid', state.opts.clearDots === 'overlap' && state.attrGrid.cols === 2);
state.opts.clearDots = 'transparent';
check('the capture is a copy', fp.opts.clearDots === 'overlap');
state.opts.clearDots = 'overlap';
SelectionService.restoreFloatingState(state);
check('restore brings them back', SelectionService.floatingPaste.opts.clearDots === 'overlap' &&
  SelectionService.floatingPaste.attrGrid.cols === 2 && SelectionService.floatingPaste.opts !== state.opts);

const cap = LayerManager._captureLayerState(stampLayer);
stampLayer.stamp = { mask, w: 16, h: 8, x: 0, y: 0, attrs: [0x38, 0x41], attrGrid: { cols: 2, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 }, opts: { clearDots: 'overlap' } };
const cap2 = LayerManager._captureLayerState(stampLayer);
check('layer capture carries opts', cap2.stamp.opts.clearDots === 'overlap' && cap2.stamp.attrGrid.cw === 8);
LayerManager._applyLayerProperties(stampLayer, cap2);
check('layer restore carries opts', stampLayer.stamp.opts.clearDots === 'overlap');
void cap;

// Duplicate of a floating stamp: uses the live data, and carries no preview cells.
const dup = LayerManager.duplicateLayer(stampLayer.index);
check('a duplicate of a floating stamp has a stamp', dup && dup.stamp && dup.stamp.mask.length === 8);
check('a duplicate keeps the settings', dup.stamp.opts && dup.stamp.opts.clearDots === 'overlap' && dup.stamp.attrGrid.cols === 2);
check('a duplicate does not share them', dup.stamp.opts !== fp.opts);
let drawn = 0;
for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) { const c = dup.getCell(cx, cy); if (c && c.altered) drawn++; }
check('a duplicate carries no preview cells', drawn === 0);


// --- the one "is a stamp in the way" answer ---------------------------------------------------------------------
SelectionService.floatingPaste = null;
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);
check('nothing engaged on a drawing layer', SelectionService.engagedStamp() === null);
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'eng');
let eng = SelectionService.engagedStamp();
check('a floating stamp is engaged', eng && eng.floating === true && eng.ownColours === false);
LayerManager.setCurrentLayer(1);
check('still engaged when the layer panel makes a drawing layer current (the corner case)', SelectionService.engagedStamp() !== null);
SelectionService.floatingPaste.attrs = [0x38, 0x41];
check('with colours of its own, ownColours is true', SelectionService.engagedStamp().ownColours === true);
SelectionService.floatingPaste.opts = { colours: 'pixels' };
check('set to Pixels, ownColours is false', SelectionService.engagedStamp().ownColours === false);
SelectionService.endFloatingPaste();
LayerManager.setCurrentLayer(LayerManager.layers.findIndex(l => l.isStamp));
eng = SelectionService.engagedStamp();
check('a parked stamp layer that is current is engaged, not floating', eng && eng.floating === false);
LayerManager.setCurrentLayer(1);

// --- reading junk ---------------------------------------------------------------------------------------------------
const base = { x: 0, y: 0, w: 16, h: 8, mask, attrs: [1, 2] };
const r = (extra) => LayerManager._readStamp({ ...base, ...extra });
check('junk colours value is dropped', r({ opts: { colours: 'banana' } }).opts === undefined || r({ opts: { colours: 'banana' } }).opts === null);
check('junk clearDots value is dropped', !(r({ opts: { clearDots: 7 } }).opts || {}).clearDots);
check('show-through flags only count when true', r({ opts: { showThrough: { ink: 'yes', paper: true } } }).opts.showThrough.ink === false);
check('a grid that disagrees with attrs is dropped', !r({ attrGrid: { cols: 3, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 } }).attrGrid);
check('an offset outside the cell is dropped', !r({ attrGrid: { cols: 2, rows: 1, cw: 8, ch: 8, ox: 8, oy: 0 } }).attrGrid);
check('non-integer grid values are dropped', !r({ attrGrid: { cols: 2.5, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 } }).attrGrid);
check('a good grid is kept', r({ attrGrid: { cols: 2, rows: 1, cw: 8, ch: 8, ox: 3, oy: 2 } }).attrGrid.ox === 3);
check('opts as a string does not throw', (() => { try { return !r({ opts: 'x' }).opts; } catch (e) { return false; } })());

summary();
