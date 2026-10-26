'use strict';
/**
 * The custom (user-defined) grid, batch 3 part 3B: a grid at any X step and Y
 * step. GridLines is the pure arithmetic - which lines are drawn - so it is
 * tested here without a canvas; the drawing and the menu are in
 * tests/browser/custom-grid.spec.js.
 *
 * Worked examples (lines are at multiples of the step, strictly inside the picture):
 *   256 wide, step 16 -> 16, 32, ... 240            = 15 lines (256 / 16 = 16 cells, 15 inner edges)
 *   256 wide, step 100 -> 100, 200                  = 2 lines
 *   256 wide, step 256 -> none (the edge is not an inner line)
 *   192 high, step 1  -> 1 .. 191                   = 191 lines
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/grid-lines.js');

const G = GridLines;
check('GridLines exists', typeof G === 'object');

{
  const p = G.positions(256, 16);
  check('256 / 16: 15 inner lines', p.length === 15 && p[0] === 16 && p[14] === 240);
  check('256 / 100: lines at 100 and 200', JSON.stringify(G.positions(256, 100)) === '[100,200]');
  check('256 / 256: no inner line', G.positions(256, 256).length === 0);
  check('192 / 1: 191 lines', G.positions(192, 1).length === 191);
  check('512 / 24: 21 lines (24 * 21 = 504)', G.positions(512, 24).length === 21 && G.positions(512, 24)[20] === 504);
}

check('step is clamped to 1', G.clampStep(0, 256) === 1 && G.clampStep(-5, 256) === 1);
check('step is clamped to the size', G.clampStep(999, 256) === 256);
check('a step in range is kept', G.clampStep(24, 256) === 24);
check('junk becomes the default 4', G.clampStep('abc', 256) === 4 && G.clampStep(NaN, 256) === 4);
check('a fractional step is rounded', G.clampStep(7.6, 256) === 8);

// X and Y are independent.
{
  const lines = G.lines(256, 192, 32, 48);
  check('X step 32 on 256: 7 lines; Y step 48 on 192: 3 lines', lines.xs.length === 7 && lines.ys.length === 3);
  check('Y positions are 48, 96, 144', JSON.stringify(lines.ys) === '[48,96,144]');
}

// A grid whose lines would be closer than MIN_GAP_CSS_PX is not drawn in that
// direction. 4 CSS px is the pixel grid's own rule (it shows from 400%, a
// 1-pixel step at 4 px per pixel) [C].
{
  check('step 1 at 100% (1 css px) draws nothing', G.lines(256, 192, 1, 1, 1).xs.length === 0);
  check('step 1 at 400% (4 css px) draws', G.lines(256, 192, 1, 1, 4).xs.length === 255);
  check('step 8 at 100% (8 css px) draws', G.lines(256, 192, 8, 8, 1).xs.length === 31);
  check('the two directions are judged separately',
    G.lines(256, 192, 1, 8, 1).xs.length === 0 && G.lines(256, 192, 1, 8, 1).ys.length === 23);
}

// Colour preference values.
check('#rrggbb is accepted', Validators.isHexColour('#12aBef'));
check('#rgb is not (the picker only writes six digits)', !Validators.isHexColour('#abc'));
check('a name is not', !Validators.isHexColour('red'));
check('null is not', !Validators.isHexColour(null));
check('normalise lowercases', Validators.normaliseHexColour('#12ABEF') === '#12abef');
check('normalise expands #rgb', Validators.normaliseHexColour('#F0a') === '#ff00aa');
check('normalise rejects junk', Validators.normaliseHexColour('xyz') === null);

summary();
