'use strict';
/**
 * Batch 2 part 2B (service side) - dot commands and the Shift content choice.
 *
 *   TransformService.flipDotsHorizontal / flipDotsVertical  - dots mirror, cell colours stay
 *   TransformService.invertDotsAndColours                   - dots and cell colours invert,
 *                                                             the picture looks the same
 *   TransformService.shift(direction, amount, wrap, content)
 *     content 'both'    - dots move; a whole-cell step carries each cell's colours too
 *     content 'dots'    - dots move, colours stay in their cells
 *     content 'colours' - colours move one cell at a time, dots stay
 *     directions: up, down, left, right, upLeft, upRight, downLeft, downRight
 *
 * Every call is one undo step (one PixelDrawRoutine batch).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/services/transform-service.js');

let selectionArea = null;
global.SelectionService = {
  hasSelection() { return selectionArea !== null; },
  getSelection() { return selectionArea; },
  isFloating() { return false; }
};

ColorManager.initialize();
LayerManager.initialize();

const CW = ZX_SPECTRUM.CELL_WIDTH, CH = ZX_SPECTRUM.CELL_HEIGHT;
const COLS = ZX_SPECTRUM.GRID_COLS, ROWS = ZX_SPECTRUM.GRID_ROWS;
const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

function setCell(cx, cy, attrs) {
  const px = ZX_COORDS.cellToPixel(cx, cy);
  PixelDrawRoutine.draw(px.x, px.y, attrs, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
}
function shown(cx, cy) {
  return LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), cx, cy);
}
function isInk(x, y) {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
}
function setDot(x, y, on) {
  PixelDrawRoutine.draw(x, y, { ink: 2, paper: 7, bright: false, flash: false },
    on ? DRAW_MODE.PIXEL_ONLY : DRAW_MODE.ERASE, { mirror: false });
}
/** Every cell's shown colours, as one string. */
function cellSignature() {
  let s = '';
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const a = shown(cx, cy);
    s += `${a.ink}${a.paper}${a.bright ? 1 : 0}${a.flash ? 1 : 0},`;
  }
  return s;
}
/** Every dot in the picture, as one string. */
function dotSignature() {
  let s = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) s += isInk(x, y) ? '1' : '0';
  return s;
}
/** What each pixel looks like on screen: its cell's ink or paper. */
function displayed() {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = shown(Math.floor(x / CW), Math.floor(y / CH));
    out.push(isInk(x, y) ? c.ink : c.paper);
  }
  return out.join(',');
}
function countBatches(fn) {
  let opens = 0;
  const b = PixelDrawRoutine.beginBatch;
  PixelDrawRoutine.beginBatch = (...a) => { opens++; return b.apply(PixelDrawRoutine, a); };
  try { fn(); } finally { PixelDrawRoutine.beginBatch = b; }
  return opens;
}

function fresh() {
  __setActiveScreenMode('standard_ula');
  LayerManager.initialize();
  selectionArea = null;
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      setCell(cx, cy, { ink: (cx + cy) % 8, paper: 7 - ((cx + cy) % 8), bright: false, flash: false });
    }
  }
  // Clear every dot, then one dot in cell (2,3).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isInk(x, y)) setDot(x, y, false);
  }
  setDot(2 * CW + 1, 3 * CH + 1, true);
}

// ── Flip dots: dots mirror, colours stay in their cells ──────────────────
fresh();
setDot(10, 5, true);
let colsBefore = cellSignature();
TransformService.flipDotsHorizontal();
check('flip dots H: dot at x=10 moves to x=W-1-10', isInk(W - 1 - 10, 5) && !isInk(10, 5));
check('flip dots H: cell colours do not move', cellSignature() === colsBefore);

fresh();
setDot(40, 7, true);
colsBefore = cellSignature();
TransformService.flipDotsVertical();
check('flip dots V: dot at y=7 moves to y=H-1-7', isInk(40, H - 1 - 7) && !isInk(40, 7));
check('flip dots V: cell colours do not move', cellSignature() === colsBefore);

fresh();
const flipBatches = countBatches(() => TransformService.flipDotsHorizontal());
check('flip dots H: one batch (one undo step)', flipBatches === 1, `batches ${flipBatches}`);

// ── Invert dots and colours: the picture looks the same; twice restores ──
fresh();
setDot(12, 9, true);
setDot(13, 9, true);
const seenBefore = displayed();
const dotsBefore = dotSignature();
const cellsBefore = cellSignature();
const inverted = TransformService.invertDotsAndColours();
check('invert dots+colours: picture looks identical', displayed() === seenBefore);
check('invert dots+colours: the dots did change', dotSignature() !== dotsBefore);
check('invert dots+colours: cells were changed', inverted > 0, `cells ${inverted}`);
TransformService.invertDotsAndColours();
check('invert dots+colours twice: dots restored', dotSignature() === dotsBefore);
check('invert dots+colours twice: cell colours restored', cellSignature() === cellsBefore);

// Selection rounds out to whole cells: a dot outside the selection but inside
// a touched cell is inverted too, and the picture still looks the same.
fresh();
setDot(2 * CW + 6, 3 * CH + 2, true);
selectionArea = { x: 2 * CW + 2, y: 3 * CH + 2, width: 2, height: 2 };
const seenSel = displayed();
TransformService.invertDotsAndColours();
check('invert dots+colours on a selection: picture looks identical', displayed() === seenSel);

// ── Shift content: 'dots' ────────────────────────────────────────────────
fresh();
setDot(10, 5, true);
colsBefore = cellSignature();
TransformService.shift('left', 1, true, 'dots');
check("shift 'dots' left 1: dot moves one pixel", isInk(9, 5) && !isInk(10, 5));
check("shift 'dots': cell colours stay", cellSignature() === colsBefore);

// ── Shift content: 'colours' (amount is pixels, moves whole cells) ──────
fresh();
const dotX = 2 * CW + 1;
const oldCell = shown(2, 3);
const cellLeft = shown(1, 3);
TransformService.shift('left', CW, true, 'colours');
check("shift 'colours' left one cell: the cell takes its right neighbour's colours",
  shown(1, 3).ink === oldCell.ink && shown(1, 3).paper === oldCell.paper, `ink ${shown(1, 3).ink}`);
check("shift 'colours': the dot stays where it was", isInk(dotX, 3 * CH + 1));
check("shift 'colours': this cell's colours came from the right, not untouched",
  cellLeft.paper !== oldCell.paper || cellLeft.ink !== oldCell.ink);

// ── Shift 'both' on a whole-cell step: dots and paper move together ─────
fresh();
const pBefore = shown(2, 3);
TransformService.shift('left', CW, true, 'both');
check("shift 'both' by one cell: the dot moves one cell left", isInk(dotX - CW, 3 * CH + 1) && !isInk(dotX, 3 * CH + 1));
check("shift 'both' by one cell: the paper moves with the dots",
  shown(1, 3).paper === pBefore.paper, `paper ${shown(1, 3).paper}`);

// 'both' on a one-pixel step: today's behaviour, paper stays in its cell.
fresh();
TransformService.shift('left', 1, true, 'both');
check("shift 'both' by one pixel: the dot moves one pixel", isInk(dotX - 1, 3 * CH + 1));
check("shift 'both' by one pixel: paper stays in the cell", shown(2, 3).paper === pBefore.paper);

// ── Colours with no wrap: a cell with no source keeps its own colours ───
fresh();
const edge = shown(COLS - 1, 0);
TransformService.shift('left', CW, false, 'colours');
check('colours no-wrap: the last column keeps its colours', shown(COLS - 1, 0).ink === edge.ink && shown(COLS - 1, 0).paper === edge.paper);
check('colours no-wrap: column 0 takes column 1', shown(0, 0).ink === ((1 + 0) % 8));

// ── Diagonals: one horizontal pass then one vertical pass ───────────────
fresh();
setDot(50, 50, true);
TransformService.shift('upLeft', 1, true, 'dots');
check('diagonal upLeft: the dot moves one pixel left and one up', isInk(49, 49) && !isInk(50, 50));

fresh();
setDot(50, 50, true);
TransformService.shift('downRight', 1, true, 'dots');
check('diagonal downRight: the dot moves one pixel right and one down', isInk(51, 51));

fresh();
setDot(50, 50, true);
TransformService.shift('left', 1, true, 'dots');
TransformService.shift('up', 1, true, 'dots');
const twoStep = dotSignature();
fresh();
setDot(50, 50, true);
TransformService.shift('upLeft', 1, true, 'dots');
check('diagonal upLeft equals a left step then an up step', dotSignature() === twoStep);

// ── Undo: each call is one batch ──────────────────────────────────────────
fresh();
const shiftBatches = countBatches(() => TransformService.shift('upRight', 1, true, 'both'));
check('a diagonal shift is one batch', shiftBatches === 1, `batches ${shiftBatches}`);

// ── Return value: a blocked layer reports that nothing moved ─────────────
fresh();
const layer = LayerManager.getCurrentLayer();
layer.locked = true;
check('shift on a locked layer returns false', TransformService.shift('left', 1, true, 'dots') === false);
layer.locked = false;
check('shift on an unlocked layer returns true', TransformService.shift('left', 1, true, 'dots') === true);

// ── GigaScreen: the blend slot of each dot mirrors with the dot ──────────
__setActiveScreenMode('gigascreen');
LayerManager.initialize();
selectionArea = null;
PixelDrawRoutine.draw(3, 0, { ink: 2, paper: 7, bright: false, flash: false, gigaSlot: 1 },
  DRAW_MODE.NORMAL, { mirror: false });
const gigaW = ZX_SPECTRUM.WIDTH;
TransformService.flipDotsHorizontal();
check('giga flip dots H: the slot-1 dot moves to the mirrored x',
  LayerManager.getCurrentLayer().getPixelSlot(gigaW - 1 - 3, 0) === 1);
check('giga flip dots H: the original position is now paper on both screens',
  LayerManager.getCurrentLayer().getPixelSlot(3, 0) === 0);

// ── Modes without cell colours: content is forced to 'both' (no crash) ───
__setActiveScreenMode('timex_hires');
LayerManager.initialize();
selectionArea = null;
setDot(10, 5, true);
TransformService.shift('left', 1, true, 'colours');
check('timex: shift with content colours still moves dots (forced to both)', isInk(9, 5));
TransformService.flipDotsHorizontal();
check("timex: flip dots still mirrors the picture", isInk(ZX_SPECTRUM.WIDTH - 1 - 9, 5));

summary();
