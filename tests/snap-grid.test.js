'use strict';
/**
 * Batch 9 part 9A: SnapGrid - the snap step and the selection blocks. Pure maths over the active screen mode.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/helpers.js');
loadModule('js/utils/snap-grid.js');
const S = window.SnapGrid;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CELLS = {
  standard_ula: [8, 8], multicolor_8x4: [8, 4], multicolor_8x2: [8, 2], multicolor_8x1: [8, 1],
  ula_plus: [8, 8], ula_plus_8x1: [8, 1], gigascreen: [8, 8], timex_hires: [8, 8], layer2_256: [8, 8],
  layer2_320: [8, 8], layer2_640: [8, 8], lores: [8, 8]
};
for (const [mode, [cw, ch]] of Object.entries(CELLS)) {
  __setActiveScreenMode(mode);
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
  check(`${mode}: cell step is the mode's cell ${cw}x${ch}`, eq(S.sizeOf('cell'), { w: cw, h: ch }), JSON.stringify(S.sizeOf('cell')));
  check(`${mode}: 16x16 step`, eq(S.sizeOf('block16'), { w: 16, h: 16 }));
  const fits = mode === 'layer2_320' || mode === 'layer2_640';
  check(`${mode}: Screen is offered ${fits ? 'here' : 'nowhere else'}`, S.screenFits() === fits);
  check(`${mode}: Screen step ${fits ? 'is 256x192' : 'falls back to the cell'}`,
    eq(S.sizeOf('screen'), fits ? { w: 256, h: 192 } : { w: cw, h: ch }));
  check(`${mode}: cleanKind keeps what exists and drops what does not`,
    S.cleanKind('screen') === (fits ? 'screen' : 'cell') && S.cleanKind('block16') === 'block16' && S.cleanKind('nope') === 'cell');
  check(`${mode}: custom step is clamped to the canvas`,
    eq(S.sizeOf('custom', { x: 9999, y: 0 }), { w: W, h: 1 }) && eq(S.sizeOf('custom', { x: 5, y: 7 }), { w: 5, h: 7 }));
  check(`${mode}: junk custom becomes the default`, eq(S.sizeOf('custom', { x: 'x', y: NaN }), { w: 24, h: 24 }));
  check(`${mode}: every canvas divides by 16 (so 16x16 blocks are always whole)`, W % 16 === 0 && H % 16 === 0);
}

// -- snap / floor --------------------------------------------------------------------------------------------------
check('snap rounds to the nearest multiple, halves up', S.snap(0, 8) === 0 && S.snap(3, 8) === 0 && S.snap(4, 8) === 8 && S.snap(12, 16) === 16 && S.snap(7, 16) === 0);
check('floor goes down to the multiple', S.floor(15, 16) === 0 && S.floor(16, 16) === 16 && S.floor(31, 8) === 24);

// -- blockRect -----------------------------------------------------------------------------------------------------
__setActiveScreenMode('standard_ula');
{
  const sz = { w: 16, h: 16 };
  check('a click selects the one block under it', eq(S.blockRect({ x: 20, y: 5 }, { x: 20, y: 5 }, sz), { x: 16, y: 0, w: 16, h: 16 }));
  check('a drag selects whole blocks, forward', eq(S.blockRect({ x: 2, y: 2 }, { x: 40, y: 20 }, sz), { x: 0, y: 0, w: 48, h: 32 }));
  check('a drag selects whole blocks, backward', eq(S.blockRect({ x: 40, y: 20 }, { x: 2, y: 2 }, sz), { x: 0, y: 0, w: 48, h: 32 }));
  check('the block under the press is always in', eq(S.blockRect({ x: 47, y: 31 }, { x: 33, y: 17 }, sz), { x: 32, y: 16, w: 16, h: 16 }));
  check('blocks past the right and bottom edge are dropped',
    eq(S.blockRect({ x: 240, y: 180 }, { x: 255, y: 191 }, sz), { x: 240, y: 176, w: 16, h: 16 }));
  check('a drag past the edge stops at the last whole block', eq(S.blockRect({ x: 0, y: 0 }, { x: 255, y: 191 }, sz), { x: 0, y: 0, w: 256, h: 192 }));
  const big = S.blockRect({ x: 10, y: 10 }, { x: 10, y: 10 }, { w: 300, h: 300 });
  check('a block bigger than the canvas is pulled inside', big.x === 0 && big.y === 0);
  // an origin: the grid starts where the press does
  check('with an origin the grid starts there', eq(S.blockRect({ x: 20, y: 5 }, { x: 20, y: 5 }, sz, { x: 20, y: 5 }), { x: 20, y: 5, w: 16, h: 16 }));
  check('the origin block plus a drag toward the origin', eq(S.blockRect({ x: 20, y: 5 }, { x: 3, y: 5 }, sz, { x: 20, y: 5 }), { x: 4, y: 5, w: 32, h: 16 }));
  const cell = { w: 8, h: 8 };
  let ok = true;
  for (let i = 0; i < 300; i++) {
    const a = { x: (i * 37) % 256, y: (i * 53) % 192 }, b = { x: (i * 91) % 256, y: (i * 17) % 192 };
    const r = S.blockRect(a, b, cell);
    const x0 = Math.floor(Math.min(a.x, b.x) / 8) * 8, x1 = Math.floor(Math.max(a.x, b.x) / 8) * 8 + 8;
    const y0 = Math.floor(Math.min(a.y, b.y) / 8) * 8, y1 = Math.floor(Math.max(a.y, b.y) / 8) * 8 + 8;
    if (r.x !== x0 || r.w !== x1 - x0 || r.y !== y0 || r.h !== y1 - y0) ok = false;
  }
  check('cell blocks equal the whole cells touched, for 300 random drags', ok);
}
__setActiveScreenMode('layer2_640');
{
  const sc = S.sizeOf('screen');
  check('Screen on 640x256: a click picks a 256x192 block starting at the origin given',
    eq(S.blockRect({ x: 300, y: 10 }, { x: 300, y: 10 }, sc, { x: 300, y: 10 }), { x: 300, y: 10, w: 256, h: 192 }));
  check('...and one that would cross the edge is pulled back', eq(S.blockRect({ x: 500, y: 10 }, { x: 500, y: 10 }, sc, { x: 500, y: 10 }), { x: 384, y: 10, w: 256, h: 192 }));
}

// -- arrow step ----------------------------------------------------------------------------------------------------
__setActiveScreenMode('multicolor_8x4');
{
  const step = S.sizeOf('block16');
  check('no snap, free thing: the nudge distance', eq(S.nudgeStep({ x: 16, y: 16 }, { snap: false, wholeCells: false, pref: 3 }), { x: 3, y: 3 }));
  check('no snap, coloured thing: one whole cell (8x4)', eq(S.nudgeStep({ x: 16, y: 16 }, { snap: false, wholeCells: true, pref: 3 }), { x: 8, y: 4 }));
  check('snap, free thing: the snap step', eq(S.nudgeStep({ x: step.w, y: step.h }, { snap: true, wholeCells: false, pref: 3 }), { x: 16, y: 16 }));
  check('snap, coloured thing: the step in whole cells', eq(S.nudgeStep({ x: 16, y: 16 }, { snap: true, wholeCells: true, pref: 3 }), { x: 16, y: 16 }));
  check('snap, coloured thing, odd custom step: rounded to cells, at least one', eq(S.nudgeStep({ x: 3, y: 5 }, { snap: true, wholeCells: true, pref: 1 }), { x: 8, y: 4 }));
}

summary();
