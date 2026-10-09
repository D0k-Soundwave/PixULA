'use strict';
/**
 * Batch 4 part 4B - the whole-cell paint tools (Copy colours, Invert dots, Invert dots and
 * colours) and where each one is available.
 *
 * InputHandler owns the drag (pick on press, one cell at a time, one undo step); the work on a
 * cell is TransformService's, as public methods that open NO batch, so the drag's batch is
 * the only one:
 *   pickCellColours(cx, cy)          what the page shows there (both screens on GigaScreen)
 *   paintCellColours(cx, cy, picked) write those colours, dots untouched
 *   invertCellDots(cx, cy)           invert the dots of one whole cell, colours untouched
 *   invertCellDotsAndColours(cx, cy) invert the dots and swap ink and paper: looks the same
 *   cellToolBlocked(op)              why a tool cannot run now, or null
 * ColorManager.cellToolAvailable(op) says which screen modes each tool exists in.
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

const CW = () => ZX_SPECTRUM.CELL_WIDTH, CH = () => ZX_SPECTRUM.CELL_HEIGHT;
const COLS = () => ZX_SPECTRUM.GRID_COLS, ROWS = () => ZX_SPECTRUM.GRID_ROWS;
const W = () => ZX_SPECTRUM.WIDTH, H = () => ZX_SPECTRUM.HEIGHT;
const T = () => TransformService;
const layer = () => LayerManager.getCurrentLayer();

function setCell(cx, cy, attrs) {
  const px = ZX_COORDS.cellToPixel(cx, cy);
  PixelDrawRoutine.draw(px.x, px.y, attrs, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
}
const shown = (cx, cy) => LayerManager.attrsShowing(cx, cy);
function isInk(x, y) { const s = PixelDrawRoutine.getPixelState(x, y); return !!(s && s.isInk); }
function setDot(x, y, on) {
  PixelDrawRoutine.draw(x, y, { ink: 2, paper: 7, bright: false, flash: false },
    on ? DRAW_MODE.PIXEL_ONLY : DRAW_MODE.ERASE, { mirror: false });
}
/** The dots of one cell as a string of 0/1. */
function cellDots(cx, cy) {
  let s = '';
  for (let y = 0; y < CH(); y++) for (let x = 0; x < CW(); x++) s += isInk(cx * CW() + x, cy * CH() + y) ? '1' : '0';
  return s;
}
/** What each pixel of one cell looks like: the colour index of its ink or paper. */
function cellLook(cx, cy) {
  const a = shown(cx, cy);
  let s = '';
  for (let y = 0; y < CH(); y++) for (let x = 0; x < CW(); x++) s += (isInk(cx * CW() + x, cy * CH() + y) ? a.ink : a.paper) + ',';
  return s;
}
function countBatches(fn) {
  let opens = 0;
  const b = PixelDrawRoutine.beginBatch;
  PixelDrawRoutine.beginBatch = (...a) => { opens++; return b.apply(PixelDrawRoutine, a); };
  try { fn(); } finally { PixelDrawRoutine.beginBatch = b; }
  return opens;
}
/** Add a layer above the current one and make it the current layer. */
function addTopLayer() {
  LayerManager.addLayer('Top', false);
  LayerManager.currentLayerIndex = LayerManager.layers.length - 1;
  LayerManager.activeDrawLayerIndex = LayerManager.currentLayerIndex;
  return LayerManager.getCurrentLayer();
}
function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  selectionArea = null;
  StateManager.setClipMode('off');
}
/** Run fn the way InputHandler runs a drag: one batch around many cell calls. */
function inOneBatch(fn) {
  PixelDrawRoutine.beginBatch('test drag');
  try { return fn(); } finally { PixelDrawRoutine.endBatch(); }
}

// -- 1. Where each tool exists -------------------------------------------------------------

{
  const OPS = ['swap', 'apply', 'copy', 'invertDots', 'invertBoth'];
  const want = {
    standard_ula:   [1, 1, 1, 1, 1],
    multicolor_8x4: [1, 1, 1, 1, 1],
    multicolor_8x1: [1, 1, 1, 1, 1],
    gigascreen:     [1, 1, 1, 1, 1],
    // ULAplus and ULANext: ink and paper are not a swappable pair of colours (CLUT entries
    // 0-7 and 8-15; ULANext paper = 128 + paper + 8 * bright + 16 * flash), so swapping the two
    // numbers does not leave the picture looking the same.
    ula_plus:       [1, 1, 1, 1, 0],
    ula_plus_8x1:   [1, 1, 1, 1, 0],
    ulanext:        [1, 1, 1, 1, 0],
    // Timex hi-res has no cell colours but has dots in 8x8 cells.
    timex_hires:    [0, 0, 0, 1, 0],
    timex_hires_giga: [0, 0, 0, 1, 0],
    layer2_256:     [0, 0, 0, 0, 0],
    lores:          [0, 0, 0, 0, 0]
  };
  for (const [mode, flags] of Object.entries(want)) {
    enter(mode);
    const got = OPS.map((op) => (ColorManager.cellToolAvailable(op) ? 1 : 0));
    check(`${mode}: tools available ${flags.join('')}`, got.join('') === flags.join(''), got.join(''));
  }
}

// -- 2. Why a tool cannot run ----------------------------------------------------------------------

enter('standard_ula');
check('nothing blocks the tools on a drawing layer', ['copy', 'invertDots', 'invertBoth'].every((op) => T().cellToolBlocked(op) === null));
layer().locked = true;
check('a locked layer blocks them', T().cellToolBlocked('copy') === 'locked' && T().cellToolBlocked('invertDots') === 'locked');
layer().locked = false;
enter('ula_plus');
check('Invert dots and colours is blocked in ULAplus, for the mode', T().cellToolBlocked('invertBoth') === 'mode');
check('...Invert dots is not', T().cellToolBlocked('invertDots') === null);
check('the Image > Dots command is blocked there too, with its own reason', T().dotCommandsBlocked().invert === 'palette');
enter('timex_hires');
check('Copy is blocked in Timex hi-res', T().cellToolBlocked('copy') === 'mode');
check('Invert dots is not', T().cellToolBlocked('invertDots') === null);

// -- 3. Copy colours ------------------------------------------------------------------------------------

enter('standard_ula');
{
  setCell(4, 4, { ink: 1, paper: 6, bright: true, flash: false });
  setCell(5, 4, { ink: 2, paper: 5, bright: false, flash: true });
  setCell(6, 4, { ink: 3, paper: 4, bright: false, flash: false });
  setDot(5 * CW() + 2, 4 * CH() + 2, true);
  const dotsBefore = cellDots(5, 4);
  const railBefore = JSON.stringify(ColorManager.getCurrentSelection());

  const picked = T().pickCellColours(4, 4);
  check('pick: the colours the page shows', picked.ink === 1 && picked.paper === 6 && picked.bright === true && picked.flash === false);

  const opens = countBatches(() => inOneBatch(() => {
    check('painting another cell reports a change', T().paintCellColours(5, 4, picked) === true);
    check('...and the next', T().paintCellColours(6, 4, picked) === true);
    check('painting a cell that already has them changes nothing', T().paintCellColours(5, 4, picked) === false);
  }));
  check('the cells now show the picked colours', [5, 6].every((cx) => {
    const a = shown(cx, 4); return a.ink === 1 && a.paper === 6 && a.bright === true && a.flash === false;
  }));
  check('their dots are untouched', cellDots(5, 4) === dotsBefore);
  check('the rail is untouched', JSON.stringify(ColorManager.getCurrentSelection()) === railBefore);
  check('the cell methods opened no batch of their own (the drag holds the only one)', opens === 1, `${opens}`);
}

// An empty upper-layer cell shows the layer below: that is what a pick takes, and a see-through
// cell that already matches stays see-through.
{
  enter('standard_ula');
  setCell(3, 3, { ink: 5, paper: 2, bright: false, flash: false });
  const top = addTopLayer();
  check('(setup) a second drawing layer is current', LayerManager.layers.indexOf(top) === 2);
  const picked = T().pickCellColours(3, 3);
  check('picking an empty upper-layer cell takes what the page shows (the layer below)', picked.ink === 5 && picked.paper === 2);
  check('painting a see-through cell with what it already shows adds nothing', T().paintCellColours(3, 3, picked) === false && !top.isCellAltered(3, 3));
}

// GigaScreen: both screens' colours travel.
{
  enter('gigascreen');
  const px = ZX_COORDS.cellToPixel(2, 2);
  PixelDrawRoutine.draw(px.x, px.y, { ink: 1, paper: 6, bright: false, flash: false, inkB: 2, paperB: 5, brightB: true, flashB: false },
    DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
  const picked = T().pickCellColours(2, 2);
  check('GigaScreen pick carries screen B', picked.inkB === 2 && picked.paperB === 5 && picked.brightB === true);
  T().paintCellColours(7, 7, picked);
  const b = LayerManager.attrsShowing(7, 7, 1);
  check('...and paints both screens', shown(7, 7).ink === 1 && b.ink === 2 && b.paper === 5 && b.bright === true);
}

// -- 4. Invert dots -------------------------------------------------------------------------------------

enter('standard_ula');
{
  setCell(2, 3, { ink: 2, paper: 6, bright: false, flash: false });
  setDot(2 * CW() + 1, 3 * CH() + 1, true);
  const before = cellDots(2, 3);
  const colours = JSON.stringify(shown(2, 3));
  const opens = countBatches(() => inOneBatch(() => { T().invertCellDots(2, 3); }));
  const inverted = cellDots(2, 3);
  check('every dot of the cell is inverted', inverted.split('').every((c, i) => c !== before[i]));
  check('the cell\'s colours are untouched', JSON.stringify(shown(2, 3)) === colours);
  check('no batch of its own', opens === 1);
  inOneBatch(() => { T().invertCellDots(2, 3); });
  check('twice restores the dots', cellDots(2, 3) === before);
  check('its neighbour is untouched', cellDots(3, 3) === '0'.repeat(CW() * CH()));
}

// The most basic use: a blank cell on a fresh drawing layer. Every cell is see-through there,
// and Invert dots must still fill it (Transform > Invert does).
{
  enter('standard_ula');
  check('(setup) the cell is blank and not owned by the layer', cellDots(6, 6) === '0'.repeat(CW() * CH()) && !layer().isCellAltered(6, 6));
  inOneBatch(() => { T().invertCellDots(6, 6); });
  check('Invert dots on a blank cell sets all its dots', cellDots(6, 6) === '1'.repeat(CW() * CH()));
}

// GigaScreen: slot s becomes 3 - s.
{
  enter('gigascreen');
  const x = 3 * CW(), y = 3 * CH();
  PixelDrawRoutine.draw(x, y, { ...ColorManager.getCurrentSelection(), gigaSlot: GIGA_SLOTS.PAPER_INK }, DRAW_MODE.PIXEL_ONLY, { mirror: false });
  const slot = () => { const s = PixelDrawRoutine.getPixelState(x, y); return s.slot; };
  check('(setup) slot 1 at the pixel', slot() === GIGA_SLOTS.PAPER_INK, `${slot()}`);
  inOneBatch(() => { T().invertCellDots(3, 3); });
  check('GigaScreen: slot 1 becomes 3 - 1 = 2', slot() === GIGA_SLOTS.INK_INK - GIGA_SLOTS.PAPER_INK, `${slot()}`);
  inOneBatch(() => { T().invertCellDots(3, 3); });
  check('...and twice restores it', slot() === GIGA_SLOTS.PAPER_INK);
}

// Timex hi-res: no cell colours, 8x8 blocks of dots.
{
  enter('timex_hires');
  setDot(9, 9, true);
  const before = cellDots(1, 1);
  inOneBatch(() => { T().invertCellDots(1, 1); });
  check('Timex hi-res: the 8x8 block inverts', cellDots(1, 1).split('').every((c, i) => c !== before[i]));
}

// Indexed modes refuse.
{
  enter('layer2_256');
  check('indexed: Invert dots does nothing', inOneBatch(() => T().invertCellDots(1, 1)) === false);
}

// -- 5. Invert dots and colours -----------------------------------------------------------------------

enter('standard_ula');
{
  setCell(2, 2, { ink: 1, paper: 6, bright: true, flash: false });
  setDot(2 * CW() + 1, 2 * CH() + 1, true);
  setDot(2 * CW() + 4, 2 * CH() + 5, true);
  const lookBefore = cellLook(2, 2);
  const dotsBefore = cellDots(2, 2);
  const opens = countBatches(() => inOneBatch(() => { T().invertCellDotsAndColours(2, 2); }));
  check('the cell looks exactly as it did', cellLook(2, 2) === lookBefore);
  check('...while its dots really are inverted', cellDots(2, 2).split('').every((c, i) => c !== dotsBefore[i]));
  check('...and ink and paper swapped', shown(2, 2).ink === 6 && shown(2, 2).paper === 1 && shown(2, 2).bright === true);
  check('no batch of its own', opens === 1);
  inOneBatch(() => { T().invertCellDotsAndColours(2, 2); });
  check('twice restores dots and colours', cellDots(2, 2) === dotsBefore && shown(2, 2).ink === 1);
}

// A see-through upper-layer cell is left alone (inverting would fill it).
{
  enter('standard_ula');
  setCell(2, 2, { ink: 1, paper: 6, bright: false, flash: false });
  addTopLayer();
  check('(setup) the upper cell is empty', !layer().isCellAltered(2, 2));
  const done = inOneBatch(() => T().invertCellDotsAndColours(2, 2));
  check('Invert dots and colours skips a see-through cell', done === false && !layer().isCellAltered(2, 2));
}

// Dots combine across layers and colours come from the topmost: only safe on a cell no other
// visible layer touches.
{
  enter('standard_ula');
  setCell(2, 2, { ink: 1, paper: 6, bright: false, flash: false });
  setDot(2 * CW() + 1, 2 * CH() + 1, true);
  const top = addTopLayer();
  // give the top layer its own dot in the same cell
  PixelDrawRoutine.draw(2 * CW() + 6, 2 * CH() + 6, { ink: 3, paper: 4, bright: false, flash: false }, DRAW_MODE.NORMAL, { mirror: false });
  check('(setup) both layers own the cell', top.isCellAltered(2, 2) && LayerManager.layers[1].isCellAltered(2, 2));
  const before = cellLook(2, 2);
  const done = inOneBatch(() => T().invertCellDotsAndColours(2, 2));
  check('with another visible layer on the same cell it does nothing', done === false && cellLook(2, 2) === before);
}

// ULAplus: refused (the swap would change the look).
{
  enter('ula_plus');
  setCell(2, 2, { ink: 1, paper: 6, bright: false, flash: false });
  const before = JSON.stringify(shown(2, 2));
  check('ULAplus: Invert dots and colours is refused', inOneBatch(() => T().invertCellDotsAndColours(2, 2)) === false && JSON.stringify(shown(2, 2)) === before);
}

// -- 6. The Image > Dots command still opens exactly one batch --------------------------------------------

enter('standard_ula');
{
  setCell(2, 2, { ink: 1, paper: 6, bright: false, flash: false });
  setDot(2 * CW() + 1, 2 * CH() + 1, true);
  selectionArea = { x: 2 * CW(), y: 2 * CH(), width: CW(), height: CH() };
  const opens = countBatches(() => { T().invertDotsAndColours(); });
  check('invertDotsAndColours is one undo step', opens === 1, `${opens}`);
  selectionArea = null;
}

// -- 7. The drawing guide ------------------------------------------------------------------------------------

enter('standard_ula');
{
  selectionArea = { x: 0, y: 0, width: CW(), height: CH() };   // cell (0,0)
  StateManager.setClipMode('inside');
  const picked = { ink: 1, paper: 6, bright: false, flash: false };
  check('inside the guide the tool works', inOneBatch(() => T().paintCellColours(0, 0, picked)) === true);
  check('outside the guide a cell is left alone (copy)', inOneBatch(() => T().paintCellColours(5, 5, picked)) === false);
  check('...(invert dots)', inOneBatch(() => T().invertCellDots(5, 5)) === false && cellDots(5, 5) === '0'.repeat(CW() * CH()));
  check('...(invert dots and colours)', inOneBatch(() => T().invertCellDotsAndColours(5, 5)) === false);
  StateManager.setClipMode('off');
  selectionArea = null;
}

// -- 8. The picture-wide transforms never write into a stamp layer ------------------------------------------------------

enter('standard_ula');
{
  const stampLayer = layer();
  stampLayer.isStamp = true;
  const altered = () => {
    let n = 0;
    for (let cy = 0; cy < ROWS(); cy++) for (let cx = 0; cx < COLS(); cx++) if (stampLayer.isCellAltered(cx, cy)) n++;
    return n;
  };
  const calls = ['flipHorizontal', 'flipVertical', 'rotate90CW', 'rotate90CCW', 'rotate180', 'invert'];
  for (const name of calls) {
    const opens = countBatches(() => { T()[name](); });
    check(`on a stamp layer ${name}() does nothing`, altered() === 0 && opens === 0, `${altered()} cells, ${opens} batches`);
  }
  check('...nor shift()', T().shift('right', 1, true, 'both') === false && altered() === 0);
  check('...nor outline()', (T().outline(1, 1), altered() === 0));
  stampLayer.isStamp = false;
}

// -- 9. Swap and Recolour are cell tools too: same guards -----------------------------------------------------------------

enter('standard_ula');
{
  setCell(2, 2, { ink: 1, paper: 6, bright: false, flash: false });
  const opens = countBatches(() => inOneBatch(() => { T().swapCellColours(2, 2); }));
  check('Swap swaps ink and paper of one cell', shown(2, 2).ink === 6 && shown(2, 2).paper === 1);
  check('...opening no batch of its own', opens === 1);
  inOneBatch(() => { T().swapCellColours(2, 2); });
  check('...and twice puts them back', shown(2, 2).ink === 1 && shown(2, 2).paper === 6);
  ColorManager.setInk(3); ColorManager.setPaper(4);
  inOneBatch(() => { T().recolourCell(2, 2); });
  check('Recolour gives the cell the rail colours', shown(2, 2).ink === 3 && shown(2, 2).paper === 4);
  const stampLayer = layer();
  stampLayer.isStamp = true;
  check('on a stamp layer Swap does nothing', inOneBatch(() => T().swapCellColours(2, 2)) === false && stampLayer.getCell(2, 2).ink === 3);
  check('...and neither does Recolour', inOneBatch(() => T().recolourCell(2, 2)) === false);
  check('...and cellToolBlocked says why', T().cellToolBlocked('swap') === 'stamp');
  stampLayer.isStamp = false;
  layer().locked = true;
  check('on a locked layer neither acts', T().swapCellColours(2, 2) === false && T().recolourCell(2, 2) === false);
  layer().locked = false;
}

summary();
