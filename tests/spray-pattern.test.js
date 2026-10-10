'use strict';
/**
 * Batch 7 part 7C2: the spray PATTERN distribution - the Spray brush laying small whole figures (circles, squares or
 * short lines) instead of single dots. Pure geometry in BrushShapes.patternFigure / patternStamps, Node-tested here.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/utils/helpers.js');
loadModule('js/utils/brush-shapes.js');

const key = (c) => c.dx + ',' + c.dy;
const set = (cells) => new Set(cells.map(key));

// A seeded generator so the checks are repeatable.
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// -- patternFigure ------------------------------------------------------------------------------------------------
check('square, filled, 5: 25 cells', BrushShapes.patternFigure('square', 5, true, 0).length === 25);
check('square, outline, 5: 16 cells (the border)', BrushShapes.patternFigure('square', 5, false, 0).length === 16);
check('square, outline, 2: all 4 cells', BrushShapes.patternFigure('square', 2, false, 0).length === 4);
check('circle, filled, 5 is the 5-wide disc', BrushShapes.patternFigure('circle', 5, true, 0).length === BrushShapes.discOffsets(5).length);
{
  const ring = BrushShapes.patternFigure('circle', 7, false, 0), disc = BrushShapes.patternFigure('circle', 7, true, 0);
  check('circle outline is inside the filled disc and smaller', ring.length < disc.length && ring.every(c => set(disc).has(key(c))));
  check('circle outline of 7 leaves the centre empty', !set(ring).has('0,0'));
}
{
  const o = [0, 1, 2, 3].map(i => BrushShapes.patternFigure('line', 5, true, i));
  check('a line is n cells in every orientation', o.every(f => f.length === 5));
  check('orientation 0 is horizontal', o[0].every(c => c.dy === 0));
  check('orientation 1 is vertical', o[1].every(c => c.dx === 0));
  check('orientations 2 and 3 are the two diagonals', o[2].every(c => c.dx === c.dy) && o[3].every(c => c.dx === -c.dy));
}
check('a figure is centred: its box straddles 0 the way a brush of that size does',
  (() => { const xs = BrushShapes.patternFigure('square', 5, true, 0).map(c => c.dx); return Math.min(...xs) === -2 && Math.max(...xs) === 2; })());

// -- patternStamps ------------------------------------------------------------------------------------------------
for (const shape of ['circle', 'square', 'line']) {
  for (const filled of [true, false]) {
    const r = BrushShapes.radiusFor(24);
    const figs = BrushShapes.patternStamps(r, 5, shape, filled, 40, seeded(7));
    check(`${shape}${filled ? ' filled' : ''}: some figures are laid`, figs.length > 0);
    check(`${shape}${filled ? ' filled' : ''}: every cell of every figure lies inside the spray disc`,
      figs.every(f => f.every(c => c.dx * c.dx + c.dy * c.dy <= r * r)));
    const whole = BrushShapes.patternFigure(shape, 5, filled, 0).length;
    check(`${shape}${filled ? ' filled' : ''}: every figure is whole`, figs.every(f => f.length === whole));
  }
}
check('a disc too small for one figure lays nothing (never a clipped figure)',
  BrushShapes.patternStamps(BrushShapes.radiusFor(3), 9, 'square', true, 10, seeded(1)).length === 0);
check('the count is a ceiling', BrushShapes.patternStamps(BrushShapes.radiusFor(32), 3, 'circle', true, 6, seeded(3)).length <= 6);
check('same seed, same figures',
  JSON.stringify(BrushShapes.patternStamps(8, 4, 'line', true, 9, seeded(5))) === JSON.stringify(BrushShapes.patternStamps(8, 4, 'line', true, 9, seeded(5))));

summary();
