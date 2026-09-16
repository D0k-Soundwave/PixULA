'use strict';
/**
 * The colour of a tool's mark: PixelDrawRoutine.markColours.
 *
 * Every pixel of the mark is drawn in the colour it will be LEFT in by a click
 * at that spot (a painting tool), in the colour showing there now (the
 * eyedropper, and mid-stroke), or in no colour at all (the selection). A pixel
 * the click would not change answers null, and the overlay draws it in the
 * neutral outline colour - a mark in the colour already on the page would be
 * invisible exactly where the artist needs to see its edge.
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
__setActiveScreenMode('standard_ula');
AttributeSystem.clearAll();
ColorManager.applyScreenMode();
LayerManager.initialize();

const css = (i) => { const c = ColorManager.getRGB(i); return `rgb(${c[0]},${c[1]},${c[2]})`; };
const cell = () => LayerManager.getCurrentLayer().getCell(1, 1);   // pixels 8..15

/** Cell (1,1): ink 3, paper 6, not bright; the pixels at local x listed are ink. */
function seed(inkXs = []) {
  const c = cell();
  c.pixels.fill(0);
  for (const x of inkXs) c.pixels[4] |= 1 << (7 - x);
  c.ink = 3; c.paper = 6; c.bright = false; c.flash = false;
  c.altered = true;
}

ColorManager.setInk(2); ColorManager.setPaper(5);
ColorManager.setBright(true); ColorManager.setFlash(false);
ColorManager.setInkTransparent(false); ColorManager.setPaperTransparent(false);

const paintTool = {
  markColour: 'paint',
  markWrite: () => PixelDrawRoutine.resolveUserMode(true)
};
const px = (...xs) => xs.map((x) => ({ x: 8 + x, y: 12 }));

// --- a painting tool: the colour after the click ----------------------------

StateManager.setDrawMode('normal');
seed();
let at = PixelDrawRoutine.markColours(paintTool, px(4));
check('Normal: the new ink with Bright (2 bright = 10)', at(12, 12) === css(10));

// Same ink already there, same attributes: the click changes nothing
{
  const c = cell();
  seed([4]); c.ink = 2; c.paper = 5; c.bright = true;
  at = PixelDrawRoutine.markColours(paintTool, px(4));
  check('Normal over identical ink: null (nothing would change)', at(12, 12) === null);
}

// Recolouring the cell changes the paper pixels beside the footprint too, but
// only footprint pixels are asked about - and they take the new paper.
StateManager.setDrawMode('paper');
seed();
at = PixelDrawRoutine.markColours(paintTool, px(1, 2));
check('Paper Recolour: an empty pixel shows the new paper (5 bright = 13)', at(9, 12) === css(13));

// XOR decides per pixel
StateManager.setDrawMode('xor');
seed([1]);
at = PixelDrawRoutine.markColours(paintTool, px(1, 2));
check('XOR over ink: that pixel becomes paper (13)', at(9, 12) === css(13));
check('XOR over paper: that pixel becomes ink (10)', at(10, 12) === css(10));
StateManager.setDrawMode('normal');

// A footprint pixel the tool itself does not write
{
  const gapped = { markColour: 'paint', markWrite: (x) => (x === 9 ? null : DRAW_MODE.NORMAL) };
  seed();
  at = PixelDrawRoutine.markColours(gapped, px(1, 2));
  // Not written, but the write beside it stamps the cell's attributes, so its
  // paper changes all the same - the mark shows what the page will show.
  check('A footprint pixel the tool skips still shows the cell recolour (13)', at(9, 12) === css(13));
  check('...while its neighbour still shows the ink', at(10, 12) === css(10));
}

// --- the eraser: the colour it uncovers -------------------------------------

{
  const eraser = { markColour: 'paint', markWrite: () => DRAW_MODE.ERASE_ALL };
  seed([4]);
  at = PixelDrawRoutine.markColours(eraser, px(4, 5));
  check('Eraser over ink: the cell paper it leaves (6)', at(12, 12) === css(6));
  check('Eraser over paper it keeps: null', at(13, 12) === null);
}

// --- sampling, live, and none -----------------------------------------------

{
  seed([4]);
  at = PixelDrawRoutine.markColours({ markColour: 'sample' }, px(4, 5));
  check('Sample: the ink showing now (3)', at(12, 12) === css(3));
  check('Sample: the paper showing now (6)', at(13, 12) === css(6));

  at = PixelDrawRoutine.markColours(paintTool, px(4, 5), { live: true });
  check('Live (mid-stroke): the colour showing now, never a simulation', at(13, 12) === css(6));

  at = PixelDrawRoutine.markColours({ markColour: 'none' }, px(4));
  check('None: no colour anywhere', at(12, 12) === null);

  at = PixelDrawRoutine.markColours(paintTool, [{ x: -1, y: 0 }]);
  check('Off the picture: null', at(-1, 0) === null);
}

summary('mark-colours');
