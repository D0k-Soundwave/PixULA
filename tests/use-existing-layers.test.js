'use strict';
/**
 * "Use existing" Ink and Paper, across the layer stack.
 *
 * THE DEFINITION (the artist's, 2026-09-16): a transparent Ink or Paper takes
 * the cell's PRE-EXISTING value, and that value is what the page SHOWS at that
 * cell - the topmost VISIBLE layer that has its own value there, even one
 * ABOVE the layer being drawn on, else the background. Hidden layers do not
 * count. It is copied at the moment of the write.
 *
 * Every drawing layer is an upper layer (the background is locked and new
 * documents start on Layer 1), and an upper layer's empty cell stores
 * placeholder black-on-white. The gate used to read THAT as "existing", so
 * measured on 2026-09-16 over a lower layer showing ink 2 on paper 6:
 *
 *   Ink on "use existing"          -> ink 0 (black)
 *   Pixels Only                    -> the cell became ink 0 / paper 7
 *   ERASE on an empty cell         -> the cell turned opaque ink 0 / paper 7
 *   Ink Recolour                   -> paper became 7 (white)
 *   both boxes + Bright            -> ink 0 / paper 7, bright
 *
 * so Delete, Outline, every flip and the Pixels Only right button each painted
 * opaque black-on-white squares over the layers below.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.ColorManager = { getCurrentSelection() { return SEL; } };
global.SelectionService = {
  isFloating() { return false; }, hasSelection() { return false; },
  getSelection() { return null; },
  getSelectionState() { return null; }, restoreSelectionState() {}, clear() {}
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/transform-service.js');

LayerManager.initialize();
UndoRedo.initialize();

let SEL = null;
const sel = (o = {}) => ({
  ink: 2, paper: 6, bright: false, flash: false,
  inkTransparent: false, paperTransparent: false, ...o
});

/** A fresh three-layer document: background + L1 + L2, drawing on L2. */
function reset() {
  LayerManager.initialize();
  LayerManager.addLayer('L2', false);
  LayerManager.setCurrentLayer(2);
  return { L1: LayerManager.layers[1], L2: LayerManager.layers[2] };
}

/** Paint one cell of `layer` solid, in a known colour pair. */
function paintCell(layer, cellX, cellY, colours) {
  PixelDrawRoutine.draw(cellX * ZX_SPECTRUM.CELL_WIDTH, cellY * ZX_SPECTRUM.CELL_HEIGHT,
    sel(colours), DRAW_MODE.NORMAL, { layer, mirror: false });
}

/** What the page shows at a cell: the composite the canvas would render. */
function composite(cellX, cellY) {
  const altered = [];
  for (let i = 1; i < LayerManager.layers.length; i++) {
    const layer = LayerManager.layers[i];
    if (!layer.visible) continue;
    const cell = layer.getCell(cellX, cellY);
    if (cell && cell.altered) altered.push({ layer, cell, index: i });
  }
  return LayerManager._composeCellData(altered,
    LayerManager.layers[0].getCell(cellX, cellY), ZX_SPECTRUM.CELL_HEIGHT).attrs;
}

const attrsJSON = (a) => JSON.stringify({
  ink: a.ink, paper: a.paper, bright: a.bright, flash: a.flash
});
const want = (o) => JSON.stringify({
  ink: 0, paper: 7, bright: false, flash: false, ...o
});

// ── The five measured cases ────────────────────────────────────────────────

{
  const { L1 } = reset();
  paintCell(L1, 5, 5, { ink: 2, paper: 6 });
  PixelDrawRoutine.draw(42, 42, sel({ ink: 5, inkTransparent: true, paper: 6 }), DRAW_MODE.NORMAL);
  check('Ink on "use existing" takes the ink showing below, not black',
    attrsJSON(composite(5, 5)) === want({ ink: 2, paper: 6 }));
}

{
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });
  PixelDrawRoutine.draw(41, 41, sel(), DRAW_MODE.PIXEL_ONLY);
  check('Pixels Only keeps the colours showing below',
    attrsJSON(composite(5, 5)) === want({ ink: 3, paper: 4 }));
  check('...and it did place the pixel', L2.getPixelState(41, 41) === true);
}

{
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 1, paper: 1 });
  const wrote = PixelDrawRoutine.draw(41, 41, sel(), DRAW_MODE.ERASE);
  check('ERASE on an EMPTY upper-layer cell writes nothing', wrote === false);
  check('...the cell stays see-through', L2.getCell(5, 5).altered === false);
  check('...so the layer below keeps its colours',
    attrsJSON(composite(5, 5)) === want({ ink: 1, paper: 1 }));
}

{
  const { L1 } = reset();
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });
  PixelDrawRoutine.draw(41, 41, sel({ ink: 6 }), DRAW_MODE.INK);
  check('Ink Recolour leaves the paper showing below alone',
    attrsJSON(composite(5, 5)) === want({ ink: 6, paper: 4 }));
}

{
  const { L1 } = reset();
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });
  PixelDrawRoutine.draw(41, 41,
    sel({ inkTransparent: true, paperTransparent: true, bright: true }), DRAW_MODE.NORMAL);
  check('both boxes + Bright: Bright lands, both colours are kept',
    attrsJSON(composite(5, 5)) === want({ ink: 3, paper: 4, bright: true }));
}

// ── Which layer "existing" comes from ──────────────────────────────────────

{
  // Three layers: the MIDDLE one shows, so that is what a write on top takes.
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 1, paper: 2 });
  paintCell(L2, 5, 5, { ink: 3, paper: 4 });
  LayerManager.addLayer('L3', false);
  LayerManager.setCurrentLayer(3);
  PixelDrawRoutine.draw(41, 41,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('a three-layer stack takes the topmost layer that has a value',
    attrsJSON(LayerManagerClass.cellAttrs(LayerManager.layers[3].getCell(5, 5)))
      === want({ ink: 3, paper: 4 }));
}

{
  // A VISIBLE HIGHER layer wins, even over the drawing layer's own value.
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 2, paper: 5 });
  paintCell(L2, 5, 5, { ink: 1, paper: 1 });
  LayerManager.addLayer('L3', false);
  const L3 = LayerManager.layers[3];
  paintCell(L3, 5, 5, { ink: 7, paper: 0 });
  LayerManager.setCurrentLayer(2);
  PixelDrawRoutine.draw(43, 43,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('a visible HIGHER layer is what the cell shows, so that is what is taken',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5))) === want({ ink: 7, paper: 0 }));

  // The same layer hidden does not count. A FRESH cell, because the write
  // above already gave (5,5) a value of its own.
  paintCell(L1, 6, 6, { ink: 2, paper: 5 });
  paintCell(L3, 6, 6, { ink: 7, paper: 0 });
  L3.visible = false;
  LayerManager.setCurrentLayer(2);
  PixelDrawRoutine.draw(6 * 8 + 1, 6 * 8 + 1,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('a HIDDEN higher layer does not count',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(6, 6))) === want({ ink: 2, paper: 5 }));
}

{
  // A stamp layer is a preview, not content: never a source.
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 2, paper: 5 });
  const stamp = LayerManager.createStampLayer('Stamp 1');
  stamp.setCell(5, 5, { ink: 7, paper: 0, bright: false, flash: false });
  LayerManager.setCurrentLayer(2);
  PixelDrawRoutine.draw(41, 41,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('a stamp layer is never the source of an existing colour',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5))) === want({ ink: 2, paper: 5 }));
  LayerManager.removeLayer(stamp.index, false);
}

// ── The cell geometry and palette models it has to work in ─────────────────

const enterMode = (id) => {
  __setActiveScreenMode(id);
  AttributeSystem.clearAll();
  LayerManager.initialize();
  LayerManager.addLayer('L2', false);
  LayerManager.setCurrentLayer(2);
  return { L1: LayerManager.layers[1], L2: LayerManager.layers[2] };
};

{
  // multicolor 8x4: half-height cells, so the cell a write lands in differs
  const { L1, L2 } = enterMode('multicolor_8x4');
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });
  const px = 5 * ZX_SPECTRUM.CELL_WIDTH + 1;
  const py = 5 * ZX_SPECTRUM.CELL_HEIGHT + 1;
  PixelDrawRoutine.draw(px, py,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('multicolor 8x4: the right cell is read at half-height geometry',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5))) === want({ ink: 3, paper: 4 }));
}

{
  // ULAplus: the same rule, with BRIGHT/FLASH selecting the CLUT
  const { L1, L2 } = enterMode('ula_plus');
  paintCell(L1, 5, 5, { ink: 3, paper: 4, bright: true });
  PixelDrawRoutine.draw(41, 41,
    sel({ inkTransparent: true, paperTransparent: true, bright: false }), DRAW_MODE.NORMAL);
  check('ULAplus: colours kept, the CLUT bits still written',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5)))
      === want({ ink: 3, paper: 4, bright: false }));
}

{
  // GigaScreen: each screen is its own picture, so "use existing" on screen A
  // takes screen A's colour and on screen B takes screen B's - never the other.
  const { L1, L2 } = enterMode('gigascreen');
  paintCell(L1, 5, 5, { ink: 2, paper: 5, inkB: 7, paperB: 0 });
  LayerManager.setCurrentLayer(2);
  PixelDrawRoutine.draw(41, 41,
    sel({ inkTransparent: true, paperTransparent: true }), DRAW_MODE.NORMAL);
  check('GigaScreen: screen A reads its OWN screen, not the other one',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5))) === want({ ink: 2, paper: 5 }));
  check('GigaScreen: screen B reads its OWN screen, not the other one',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5), 1)) === want({ ink: 7, paper: 0 }));
}

__setActiveScreenMode('standard_ula');
AttributeSystem.clearAll();

// ── The functions that were painting opaque squares ────────────────────────

{
  // Transform Outline over an empty upper layer: its "paper" positions used to
  // mark every cell altered with the placeholder black-on-white.
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });
  SEL = sel();
  SelectionService.hasSelection = () => false;
  TransformService.outline(1, 1);
  let opaque = 0;
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
      const cell = L2.getCell(cx, cy);
      if (cell.altered && cell.pixels.every((r) => r === 0)) opaque++;
    }
  }
  check('Outline on an empty upper layer leaves no opaque empty cells behind',
    opaque === 0);
  check('...and the layer below keeps its colours',
    attrsJSON(composite(5, 5)) === want({ ink: 3, paper: 4 }));
}

{
  // The Swap attribute op reads what the cell SHOWS.
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 2, paper: 5 });
  const seen = LayerManager.attrsAsSeen(L2, 5, 5);
  PixelDrawRoutine.draw(40, 40,
    { ink: seen.paper, paper: seen.ink, bright: seen.bright, flash: seen.flash },
    DRAW_MODE.ATTRIBUTES_ONLY, { layer: L2, mirror: false });
  check('Swap on an empty upper cell swaps the colours the artist can see',
    attrsJSON(LayerManagerClass.cellAttrs(L2.getCell(5, 5))) === want({ ink: 5, paper: 2 }));
}

// ── attrsAsSeen / attrsShowing themselves ──────────────────────────────────

{
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 2, paper: 5 });
  paintCell(L2, 6, 5, { ink: 7, paper: 0 });
  check('attrsAsSeen: an empty cell reports what the page shows',
    attrsJSON(LayerManager.attrsAsSeen(L2, 5, 5)) === want({ ink: 2, paper: 5 }));
  check('attrsAsSeen: a cell with its own value reports that',
    attrsJSON(LayerManager.attrsAsSeen(L2, 6, 5)) === want({ ink: 7, paper: 0 }));
  check('attrsShowing: nothing drawn anywhere reports the background',
    attrsJSON(LayerManager.attrsShowing(20, 20)) ===
    attrsJSON(LayerManagerClass.cellAttrs(LayerManager.layers[0].getCell(20, 20))));
}

// ── "Use existing" is a COLOUR, and only a colour ──────────────────────────
//
// The artist's second decision (2026-09-16): the box never changes which
// pixels a tool touches, in any tool. A pattern's gaps go on clearing ink
// with Paper on "use existing" - only the paper COLOUR is kept. The older
// reference app made that box also spare the gaps, which is how one control
// came to mean two different things depending on the tool (the same fault
// that left the gradient drawing nothing at all).

loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');

{
  const { L1, L2 } = reset();
  paintCell(L1, 5, 5, { ink: 3, paper: 4 });

  // A 2x2 pattern: ink on one diagonal, gaps on the other.
  global.PatternService.getCurrentPatternData = () => ({
    width: 2, height: 2, bitmap: new Uint8Array([1, 0, 0, 1])
  });

  // Fill the target cell with the artist's own ink first, so the gaps have
  // something to clear.
  for (let ly = 0; ly < 8; ly++) {
    for (let lx = 0; lx < 8; lx++) {
      PixelDrawRoutine.draw(40 + lx, 40 + ly, sel({ ink: 7, paper: 0 }),
        DRAW_MODE.NORMAL, { layer: L2, mirror: false });
    }
  }

  SEL = sel({ paper: 1, paperTransparent: true });
  BrushEngine.initialize();
  BrushEngine.setBrush('pattern');
  BrushEngine.setSize(8);
  BrushEngine.applyBrush(43, 43, 1.0, true);

  // (40,40): bitmap[0] = 1 -> ink. (41,40): bitmap[1] = 0 -> a gap.
  check('a pattern gap still clears ink with Paper on "use existing"',
    L2.getPixelState(40, 40) === true && L2.getPixelState(41, 40) === false);
  check('...and the paper colour it would have written is the one already there',
    L2.getCell(5, 5).paper === 0);
}

summary('use-existing-layers');
