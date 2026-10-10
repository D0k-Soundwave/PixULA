'use strict';
/**
 * Batch 5 part 5A2: a copy keeps the colours of the cells it covered. They ride with the pasted stamp, which
 * starts as "Pixels only" (it pastes exactly as it always did); switching it to "Own colours" brings them back.
 * Covers: what is captured (and where it is not), the lasso rule, the grid offset, the codec, the paste, and what
 * a scale / flip does to colours a stamp merely carries.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
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
loadModule('js/utils/clipboard-codec.js');
loadModule('js/utils/coverage-ops.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  return LayerManager.layers[1];
}

/** Two cells at (cx, cy) and (cx+1, cy): ink 1 paper 6 bright, and ink 4 paper 0 flash, with dots. */
function seed(layer, cx, cy) {
  const a = layer.getCell(cx, cy), b = layer.getCell(cx + 1, cy);
  Object.assign(a, { ink: 1, paper: 6, bright: true, flash: false, altered: true });
  Object.assign(b, { ink: 4, paper: 0, bright: false, flash: true, altered: true });
  a.pixels.fill(0xF0);
  b.pixels.fill(0x0F);
}
const ATTR_A = 1 | (6 << 3) | 0x40;
const ATTR_B = 4 | (0 << 3) | 0x80;

// --- capture ---------------------------------------------------------------------------------------------------
let layer = enter('standard_ula');
seed(layer, 2, 3);
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8 });
SelectionService.copyToClipboard();
let c = SelectionService.clipboard;
check('a cell-aligned copy captures one colour byte per cell', JSON.stringify(c.attrs) === JSON.stringify([ATTR_A, ATTR_B]));
check('and a grid of 2 x 1 with no offset', JSON.stringify(c.attrGrid) === JSON.stringify({ cols: 2, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 }));

SelectionService.setSelection({ x: 19, y: 26, width: 12, height: 4 });
SelectionService.copyToClipboard();
c = SelectionService.clipboard;
check('an off-grid copy still sees the two cells it touches', JSON.stringify(c.attrs) === JSON.stringify([ATTR_A, ATTR_B]));
check('and records how far the first cell starts before the stamp', c.attrGrid.ox === 3 && c.attrGrid.oy === 2);

// a lasso that never touches the right cell
const lasso = Array.from({ length: 8 }, () => Array.from({ length: 16 }, (_, i) => i < 8));
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8, mask: lasso });
SelectionService.copyToClipboard();
check('a cell the lasso did not touch has no colours (null)', JSON.stringify(SelectionService.clipboard.attrs) === JSON.stringify([ATTR_A, null]));

// --- not captured where one pair per cell does not describe it ------------------------------------------------------
for (const mode of ['gigascreen', 'layer2_256', 'timex_hires']) {
  const l = enter(mode);
  SelectionService.setSelection({ x: 0, y: 0, width: 16, height: 8 });
  SelectionService.copyToClipboard();
  check(`${mode}: no colours captured`, !SelectionService.clipboard.attrs && !SelectionService.clipboard.attrGrid);
  void l;
}

// --- codec round trip, and a damaged block ----------------------------------------------------------------------------
layer = enter('standard_ula');
seed(layer, 2, 3);
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8, mask: lasso });
SelectionService.copyToClipboard();
const payload = JSON.parse(JSON.stringify(ClipboardCodec.encode(SelectionService.clipboard)));
let back = ClipboardCodec.decode(payload);
check('the colours survive the codec (a hole stays a hole)', JSON.stringify(back.attrs) === JSON.stringify([ATTR_A, null]) && back.attrGrid.cols === 2);
back = ClipboardCodec.decode({ ...payload, ag: { ...payload.ag, cols: 3 } });
check('a grid that does not fit its colours is dropped, the pixels still decode', back && !back.attrs && !back.attrGrid && back.pixels.length === 8);
back = ClipboardCodec.decode({ ...payload, att: [999, -1] });
check('a colour byte out of range drops the block', back && !back.attrs);
const plain = JSON.parse(JSON.stringify(ClipboardCodec.encode({ ...SelectionService.clipboard, attrs: undefined, attrGrid: undefined })));
check('a payload without colours has neither field', !('att' in plain) && !('ag' in plain));

// --- paste: starts as Pixels only, exactly as before; Own colours brings them back -------------------------------------
layer = enter('standard_ula');
seed(layer, 2, 3);
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8 });
SelectionService.copyToClipboard();
// wipe the source so the paste is visible
for (const [cx] of [[2], [3]]) { const cell = layer.getCell(cx, 3); cell.pixels.fill(0); Object.assign(cell, { ink: 0, paper: 7, bright: false, flash: false }); }
SelectionService.startFloatingPaste(21, 10);
let fp = SelectionService.floatingPaste;
check('a paste carries the colours', Array.isArray(fp.attrs) && fp.attrs.length === 2 && fp.attrGrid.cols === 2);
check('but starts as Pixels only', SelectionService.stampOptions(fp).colours === 'pixels' && !SelectionService.stampColoured(fp));
check('so it is free to sit between cells', (SelectionService.moveFloatingPaste(21, 10), fp.x === 21 && fp.y === 10));
SelectionService.setStampOptions({ colours: 'coloured' });
check('Own colours snaps it to the cell grid', fp.x === 16 && fp.y === 8);
check('and it now places its own colours', SelectionService.stampColoured(fp));
const stampLayer = fp.floatingLayer;
LayerManager.setCurrentLayer(1);
SelectionService.commitStamp(stampLayer);
const l1 = LayerManager.layers[1];
const got = (cx, cy) => { const k = l1.getCell(cx, cy); return `${k.ink}/${k.paper}/${k.bright ? 1 : 0}/${k.flash ? 1 : 0}`; };
check('the committed cells carry the copied colours', got(2, 1) === '1/6/1/0' && got(3, 1) === '4/0/0/1', `${got(2, 1)} ${got(3, 1)}`);

// as Pixels, the same paste takes the rail colours
layer = enter('standard_ula');
seed(layer, 2, 3);
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8 });
SelectionService.copyToClipboard();
SelectionService.startFloatingPaste(16, 8);
LayerManager.setCurrentLayer(1);
SelectionService.commitStamp(SelectionService.floatingPaste.floatingLayer);
check('a Pixels paste takes the rail colours, as before', got2(2, 1) === '2/5/0/0', got2(2, 1));
function got2(cx, cy) { const k = LayerManager.layers[1].getCell(cx, cy); return `${k.ink}/${k.paper}/${k.bright ? 1 : 0}/${k.flash ? 1 : 0}`; }

// --- shape changes ----------------------------------------------------------------------------------------------------
layer = enter('standard_ula');
seed(layer, 2, 3);
SelectionService.setSelection({ x: 16, y: 24, width: 16, height: 8 });
SelectionService.copyToClipboard();
SelectionService.startFloatingPaste(16, 8);
fp = SelectionService.floatingPaste;
SelectionService.setStampScale(2, 2);
check('scaling a Pixels stamp drops the colours it carried', fp.attrs === null && fp.attrGrid === null);

SelectionService.startFloatingPaste(16, 8);
fp = SelectionService.floatingPaste;
SelectionService.setStampOptions({ colours: 'coloured' });
SelectionService.setStampScale(2, 2);
check('a stamp placing its own colours refuses to scale', fp.attrs !== null && fp._scaleX === 1);
SelectionService.transformStamp('flipH');
check('and refuses a flip', fp.attrs !== null && SelectionService.stampColoured(fp));

SelectionService.startFloatingPaste(16, 8);
fp = SelectionService.floatingPaste;
SelectionService.transformStamp('flipH');
check('flipping a Pixels stamp drops the colours it carried', fp.attrs === null);

summary();
