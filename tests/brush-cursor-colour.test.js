'use strict';
/**
 * The size-1 brush cursor: a 3x3 plus whose centre is the pixel the brush
 * will paint, in the colour the click will actually leave there.
 *
 * PixelDrawRoutine.previewInkIndex answers "what palette index will this
 * pixel show after a left-button write?" by the same rules draw() applies:
 * the global draw mode, the transparent boxes, and bright and flash always
 * written. It reads the CURRENT layer's own cell, because that is what the
 * write lands in.
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
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

const X = 12, Y = 12;           // cell (1,1), local (4,4)
const BIT = 1 << (7 - 4);
const cell = () => LayerManager.getCurrentLayer().getCell(1, 1);
const preview = () => PixelDrawRoutine.previewInkIndex(X, Y);

/** Seed the cell under (X, Y): ink 3, paper 6, not bright; pixel set or not. */
function seed(pixelSet) {
  const c = cell();
  c.pixels.fill(0);
  if (pixelSet) c.pixels[4] = BIT;
  c.ink = 3; c.paper = 6; c.bright = false; c.flash = false;
  c.altered = true;
}

function select({ ink = 2, paper = 5, bright = true, inkT = false, paperT = false } = {}) {
  ColorManager.setInk(ink);
  ColorManager.setPaper(paper);
  ColorManager.setBright(bright);
  ColorManager.setFlash(false);
  ColorManager.setInkTransparent(inkT);
  ColorManager.setPaperTransparent(paperT);
}

// --- classic: Normal --------------------------------------------------------

enter('standard_ula');
StateManager.setDrawMode('normal');

seed(false); select();
check('Normal: the selected ink with Bright applied (2 bright = 10)', preview() === 10);

select({ bright: false });
check('Normal: the selected ink without Bright (2)', preview() === 2);

select({ ink: 0, bright: true });
check('Normal: black stays black with Bright on (0)', preview() === 0);

seed(false); select({ inkT: true, bright: true });
check('Ink on "use existing": the cell ink, with the selected Bright (3 bright = 11)',
  preview() === 11);

// --- classic: the other draw modes -----------------------------------------

StateManager.setDrawMode('pixel_only');
seed(false); select({ bright: true });
check('Pixels Only: the cell\'s own ink and bright (3)', preview() === 3);

StateManager.setDrawMode('xor');
seed(false); select();
check('XOR over an empty pixel: it becomes ink (10)', preview() === 10);
seed(true); select();
check('XOR over an ink pixel: it becomes paper (5 bright = 13)', preview() === 13);

StateManager.setDrawMode('paper');
seed(false); select();
check('Paper Recolour over an empty pixel: the new paper (13)', preview() === 13);
seed(true); select();
check('Paper Recolour over an ink pixel: the cell ink, new Bright (11)', preview() === 11);

StateManager.setDrawMode('ink');
seed(false); select();
check('Ink Recolour over an empty pixel: the cell paper, new Bright (6 bright = 14)',
  preview() === 14);
seed(true); select();
check('Ink Recolour over an ink pixel: the new ink (10)', preview() === 10);

StateManager.setDrawMode('normal');

// --- the promise itself: preview == what a real click leaves ----------------
//
// Every draw mode x pixel state x transparent-box combination: ask for the
// preview, perform the actual left-button write through draw(), and read back
// the index the pixel really shows. The spot checks above say what the answers
// ARE; this says the preview can never drift from the _apply* functions.
{
  const shown = () => {
    const c = cell();
    const idx = ColorManager.attrToIndices(c);
    return (c.pixels[4] & BIT) ? idx.ink : idx.paper;
  };
  let mismatches = 0;
  for (const dm of ['normal', 'pixel_only', 'ink', 'paper', 'xor', 'xor_pixel']) {
    StateManager.setDrawMode(dm);
    for (const pixelSet of [false, true]) {
      for (const inkT of [false, true]) {
        for (const paperT of [false, true]) {
          for (const bright of [false, true]) {
            seed(pixelSet); select({ inkT, paperT, bright });
            const promised = preview();
            PixelDrawRoutine.draw(X, Y, ColorManager.getCurrentSelection(),
              PixelDrawRoutine.resolveUserMode(true), { mirror: false });
            if (promised !== shown() || PixelDrawRoutine.shownIndex(X, Y) !== shown()) {
              mismatches++;
              console.log(`  mismatch: ${dm} set=${pixelSet} inkT=${inkT} paperT=${paperT} ` +
                `bright=${bright} promised=${promised} got=${shown()} ` +
                `shownIndex=${PixelDrawRoutine.shownIndex(X, Y)}`);
            }
          }
        }
      }
    }
  }
  StateManager.setDrawMode('normal');
  check('the preview matches a real left-button write in all 96 combinations, ' +
    'and shownIndex reads the result back', mismatches === 0);
}

// --- shownIndex: what the layer shows now (the mid-stroke dot) --------------
{
  const layer = LayerManager.getCurrentLayer();
  const blank = layer.getCell(3, 3);
  blank.altered = false;
  check('shownIndex: an unaltered upper-layer cell is see-through (null)',
    PixelDrawRoutine.shownIndex(3 * 8, 3 * 8) === null);
  StateManager.setDrawMode('xor');
  seed(false); select();
  PixelDrawRoutine.beginBatch();
  PixelDrawRoutine.draw(X, Y, ColorManager.getCurrentSelection(), DRAW_MODE.XOR, { mirror: false });
  check('mid XOR stroke: shownIndex reports the ink just painted (10) ...',
    PixelDrawRoutine.shownIndex(X, Y) === 10);
  check('... where previewInkIndex answers for a fresh click (paper, 13)', preview() === 13);
  PixelDrawRoutine.endBatch();
  StateManager.setDrawMode('normal');
}

// --- off the picture --------------------------------------------------------

check('off the picture: null', PixelDrawRoutine.previewInkIndex(-1, 5) === null &&
  PixelDrawRoutine.previewInkIndex(ZX_SPECTRUM.WIDTH, 5) === null);

// --- ULAplus: the CLUT comes from bright and flash --------------------------

enter('ula_plus');
seed(false); select({ ink: 2, bright: true });
check('ULAplus: bright selects CLUT 1, so ink 2 is entry 18', preview() === 18);

// --- indexed Next -----------------------------------------------------------

enter('layer2_256');
ColorManager.setNextInk(200);
ColorManager.setNextPaper(9);
check('indexed Normal: the indexed ink (200)', PixelDrawRoutine.previewInkIndex(X, Y) === 200);
StateManager.setDrawMode('paper');
check('indexed Paper Recolour: the indexed paper (9)', PixelDrawRoutine.previewInkIndex(X, Y) === 9);
StateManager.setDrawMode('normal');

summary('brush-cursor-colour');
