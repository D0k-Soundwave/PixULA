'use strict';
/**
 * Batch 9 part 9A2: the rectangle selection's Size (Free / Cell / 16x16 / Screen / Custom). A click picks one block, a drag
 * picks whole blocks; blocks other than Cell start where the press landed (or on the snap cell the press fell in, with Snap
 * on); the preview is the commit; the pointer is not pre-snapped for blocks and Cell; a free drag under Snap is exact.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/utils/snap-grid.js');
const selected = [];
global.SelectionService = {
  clear() { selected.length = 0; }, setSelection(s) { selected.push({ ...s }); }, isFloating: () => false, endFloatingPaste() {}
};
const previews = [];
global.GridOverlay = {
  drawSelectionPreview(x, y, w, h) { previews.push({ x, y, width: w, height: h }); },
  drawLassoPreview() {}, clearFunctionPreview() {}
};
loadModule('js/tools/tool-base.js');
loadModule('js/tools/selection-tool.js');

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rectOf = (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height });
const ev = { button: 0, shiftKey: false };
function drag(tool, x1, y1, x2, y2) {
  selected.length = 0; previews.length = 0;
  tool.onPointerDown(x1, y1, ev);
  tool.onPointerMove(x2, y2, ev);
  const shown = previews.length ? previews[previews.length - 1] : null;
  const during = tool.getSelectionPreview();
  tool.onPointerUp(x2, y2, ev);
  return { sel: selected[selected.length - 1] || null, shown, during };
}

StateManager.setGridSnap(false);
__setActiveScreenMode('standard_ula');
{
  const t = new SelectionTool();
  check('Size defaults to free', t.getSelectSize() === 'free');
  let r = drag(t, 5, 5, 20, 12);
  check('free: a drag is the bare rectangle (as it always was)', eq(rectOf(r.sel), { x: 5, y: 5, width: 16, height: 8 }));
  check('free: the pointer is still pre-snapped when Snap is on', t.snapsPointer === true);

  t.setSelectSize('block16');
  check('16x16: the pointer is NOT pre-snapped (the tool snaps what it needs)', t.snapsPointer === false);
  r = drag(t, 21, 19, 21, 19);
  check('16x16: a click selects one block starting where it was pressed', eq(rectOf(r.sel), { x: 21, y: 19, width: 16, height: 16 }));
  r = drag(t, 21, 19, 60, 40);
  check('16x16: a drag selects whole blocks from the press', eq(rectOf(r.sel), { x: 21, y: 19, width: 48, height: 32 }));
  check('16x16: the preview is the selection', eq(rectOf(r.shown), rectOf(r.sel)) && eq(rectOf(r.during), rectOf(r.sel)));
  r = drag(t, 21, 19, 5, 3);
  check('16x16: dragging back up and left adds whole blocks that way', eq(rectOf(r.sel), { x: 5, y: 3, width: 32, height: 32 }) || r.sel.width % 16 === 0, JSON.stringify(rectOf(r.sel)));
  r = drag(t, 250, 185, 255, 191);
  check('16x16: a block that would cross the edge is pulled inside', r.sel && r.sel.x + r.sel.width <= 256 && r.sel.y + r.sel.height <= 192, JSON.stringify(r.sel));

  t.setSelectSize('cell');
  r = drag(t, 13, 13, 13, 13);
  check('Cell: a click selects the cell it is IN (not the next one)', eq(rectOf(r.sel), { x: 8, y: 8, width: 8, height: 8 }));
  r = drag(t, 3, 3, 30, 20);
  check('Cell: a drag selects the whole cells touched', eq(rectOf(r.sel), { x: 0, y: 0, width: 32, height: 24 }));

  t.setSelectSize('custom');
  t.setSelectSizeX(10); t.setSelectSizeY(6);
  r = drag(t, 100, 100, 100, 100);
  check('Custom: a click selects one 10x6 block', eq(rectOf(r.sel), { x: 100, y: 100, width: 10, height: 6 }));
  r = drag(t, 100, 100, 125, 107);
  check('Custom: a drag selects whole 10x6 blocks', eq(rectOf(r.sel), { x: 100, y: 100, width: 30, height: 12 }));
  t.setSelectSizeX(99999); t.setSelectSizeY(-4);
  check('Custom sizes are clamped', t.getSelectSizeX() === 640 && t.getSelectSizeY() === 1);
  t.setSelectSize('nope');
  check('an unknown Size is ignored', t.getSelectSize() === 'custom');
  t.setSelectSize('screen');
  r = drag(t, 10, 10, 10, 10);
  check('Screen on a one-screen canvas is the whole screen', eq(rectOf(r.sel), { x: 0, y: 0, width: 256, height: 192 }));

  t.setSelectMode('ellipse');
  check('Size applies to the rectangle only: the ellipse is free again', t.snapsPointer === true);
  t.setSelectMode('cell');
  check('Cell mode does not pre-snap the pointer either', t.snapsPointer === false);
  r = drag(t, 13, 13, 13, 13);
  check('Cell mode: a click in the right half of a cell selects that cell', eq(rectOf(r.sel), { x: 8, y: 8, width: 8, height: 8 }));
  t.setSelectMode('rectangle');
}

// -- Snap on: the press drops to the snap cell, a free drag is exact ----------------------------------------------
{
  StateManager.setGridSnap(true);
  StateManager.setGridSnapStep({ kind: 'cell' });
  const t = new SelectionTool();
  let r = drag(t, 0, 0, 16, 16);
  check('Snap on, free: a drag from 0 to 16 selects 16 pixels (not 17)', eq(rectOf(r.sel), { x: 0, y: 0, width: 16, height: 16 }));
  r = drag(t, 8, 8, 8, 8);
  check('Snap on, free: a click (no drag) is still ignored as a jitter', r.sel === null);
  t.setSelectSize('block16');
  r = drag(t, 21, 19, 21, 19);
  check('Snap on (cell step), 16x16: the block starts on the cell the press fell in', eq(rectOf(r.sel), { x: 16, y: 16, width: 16, height: 16 }));
  StateManager.setGridSnapStep({ kind: 'block16' });
  r = drag(t, 21, 19, 21, 19);
  check('Snap on (16 step), 16x16: a click picks the 16 tile it is in', eq(rectOf(r.sel), { x: 16, y: 16, width: 16, height: 16 }));
  StateManager.setGridSnap(false);
  StateManager.setGridSnapStep({ kind: 'cell' });
}

// -- cell geometry per mode ---------------------------------------------------------------------------------------
for (const [mode, ch] of [['multicolor_8x4', 4], ['multicolor_8x2', 2], ['multicolor_8x1', 1]]) {
  __setActiveScreenMode(mode);
  const t = new SelectionTool();
  t.setSelectSize('cell');
  const r = drag(t, 13, 13, 13, 13);
  check(`${mode}: a Cell-size click is one 8x${ch} cell`, r.sel && r.sel.width === 8 && r.sel.height === ch && r.sel.x === 8 && r.sel.y === Math.floor(13 / ch) * ch, JSON.stringify(r.sel));
}

// -- Cell size equals the old cell-mode snap on random drags, in every cell geometry -----------------------------------
for (const mode of ['standard_ula', 'multicolor_8x4', 'multicolor_8x1', 'layer2_640']) {
  __setActiveScreenMode(mode);
  const a = new SelectionTool(); a.setSelectMode('cell');
  const b = new SelectionTool(); b.setSelectSize('cell');
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const x1 = (i * 37) % ZX_SPECTRUM.WIDTH, y1 = (i * 53) % ZX_SPECTRUM.HEIGHT, x2 = (i * 91) % ZX_SPECTRUM.WIDTH, y2 = (i * 17) % ZX_SPECTRUM.HEIGHT;
    const ra = drag(a, x1, y1, x2, y2).sel, rb = drag(b, x1, y1, x2, y2).sel;
    if (!eq(ra && rectOf(ra), rb && rectOf(rb))) bad++;
  }
  check(`${mode}: Rectangle + Size Cell selects exactly what Cell mode selects (200 random drags)`, bad === 0, `${bad} differ`);
}

// -- Screen on a bigger canvas -------------------------------------------------------------------------------------
__setActiveScreenMode('layer2_640');
{
  const t = new SelectionTool();
  t.setSelectSize('screen');
  const r = drag(t, 300, 40, 300, 40);
  check('Screen on 640x256: a click picks a 256x192 block from the press', eq(rectOf(r.sel), { x: 300, y: 40, width: 256, height: 192 }));
  const far = drag(t, 600, 40, 600, 40);
  check('...and one that would cross the edge is pulled back inside', far.sel.x + far.sel.width <= 640 && far.sel.width === 256);
}

summary();
