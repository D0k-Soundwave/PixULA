'use strict';
/**
 * Undo and Redo must bring a selection back in the SHAPE it was drawn, not
 * as its bounding box. The history snapshot used to copy x/y/width/height
 * and drop `mask`, so a freehand (lasso) or ellipse selection came back from
 * every Undo or Redo as a plain rectangle - and the next Delete or Fill then
 * reached pixels the artist had deliberately left outside it.
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
LayerManager.initialize();
LayerManager.addLayer();

// An irregular shape: a triangle in a 13x7 box. Width 13 is deliberately not
// a multiple of 8, so a packer that assumes whole bytes per row is caught.
const W = 13, H = 7;
const shape = Array.from({ length: H }, (_, y) =>
  Array.from({ length: W }, (_, x) => x <= y * 2));

function sameMask(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y].length !== b[y].length) return false;
    for (let x = 0; x < a[y].length; x++) if (!!a[y][x] !== !!b[y][x]) return false;
  }
  return true;
}

let strokeX = 40;
function stroke() {
  UndoRedo.beginAction('stroke');
  PixelDrawRoutine.draw(strokeX++, 40, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL,
                        { layer: LayerManager.getCurrentLayer() });
  UndoRedo.endAction();
}

// ── Undo returns the freehand shape, not its bounding box ─────────────────
// Undo restores the state from just BEFORE the undone action, and the shape
// was selected then.
SelectionService.setSelection({ x: 10, y: 20, width: W, height: H, mask: shape });
stroke();
SelectionService.clear();
UndoRedo.undo();
{
  const sel = SelectionService.getSelection();
  check('undo restores the selection', !!sel);
  check('undo keeps the position and size',
        sel && sel.x === 10 && sel.y === 20 && sel.width === W && sel.height === H);
  check('undo restores the freehand mask, not a rectangle', sel && sameMask(sel.mask, shape));
}

// ── Redo does the same in the other direction ─────────────────────────────
// Redo restores the state captured when Undo was pressed, so the shape must
// be selected at that moment; clear before redoing so a pass cannot come from
// the selection just lingering.
SelectionService.setSelection({ x: 10, y: 20, width: W, height: H, mask: shape });
stroke();
UndoRedo.undo();
SelectionService.clear();
UndoRedo.redo();
{
  const sel = SelectionService.getSelection();
  check('redo restores the freehand mask, not a rectangle', sel && sameMask(sel.mask, shape));
}

// ── A rectangle stays a rectangle ─────────────────────────────────────────
SelectionService.setSelection({ x: 5, y: 5, width: 20, height: 10 });
stroke();
SelectionService.clear();
UndoRedo.undo();
{
  const sel = SelectionService.getSelection();
  check('a plain rectangle comes back with no mask', sel && sel.mask === null);
}

// ── The history copy is independent of the live mask ─────────────────────
// Undo is captured, the live mask is then edited in place, and Redo must
// still bring back the shape as it was when captured.
{
  const live = shape.map(row => row.slice());
  SelectionService.setSelection({ x: 10, y: 20, width: W, height: H, mask: live });
  stroke();
  UndoRedo.undo();
  live[0][0] = !live[0][0];
  SelectionService.clear();
  UndoRedo.redo();
  const again = SelectionService.getSelection();
  check('the history copy is not shared with the live mask',
        again && sameMask(again.mask, shape));
}

// ── The shape counts toward the history's byte budget ─────────────────────
{
  const bytes = (withMask) => UndoRedo.constructor.entryBytes({
    before: { selection: withMask
      ? { x: 0, y: 0, width: W, height: H, mask: { rows: H, cols: W, bits: new Uint8Array(12) } }
      : { x: 0, y: 0, width: W, height: H } }
  });
  check('a stored mask is counted in entryBytes', bytes(true) === bytes(false) + 12);
}

summary();
