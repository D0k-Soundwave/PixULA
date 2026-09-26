'use strict';
/**
 * GigaQuant - the four-colour converter for the two-screen modes
 * (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md).
 *
 * Section 1: the steady-mix rule and the steady palette.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/giga-quant.js');

const Q = GigaQuant;

// --- 1. The steady rule ---------------------------------------------------

check('a colour mixed with itself is steady', Q.isSteady(3, false, 3, false, 1));
check('a colour mixed with its bright self is steady', Q.isSteady(5, false, 5, true, 1));
check('neighbours in the colour order are steady', Q.isSteady(1, false, 2, false, 1));
check('neighbours of different brightness are not', !Q.isSteady(1, false, 2, true, 1));
check('two steps apart is not steady at step 1', !Q.isSteady(1, false, 3, false, 1));
check('two steps apart is steady at step 2', Q.isSteady(1, false, 3, false, 2));
check('black and white never are at step 1', !Q.isSteady(0, false, 7, false, 1));
check('the default step is MAX_STEP', Q.isSteady(4, true, 5, true) === Q.isSteady(4, true, 5, true, Q.MAX_STEP));

// --- 2. Colours and the blend ---------------------------------------------

check('colourRGB reads the fixed palette', Q.colourRGB(2, false) === ZX_PALETTE_RGB[2]
  && Q.colourRGB(2, true) === ZX_PALETTE_RGB[10]);
const bl = Q.blend([215, 0, 0], [0, 0, 215]);
check('blend is the per-channel average, floored', bl[0] === 107 && bl[1] === 0 && bl[2] === 107,
  `got ${bl}`);

// --- 3. The steady palette -------------------------------------------------

const pal = Q.steadyPalette(1);
check('every palette entry is steady',
  pal.every(e => Q.isSteady(e.a.base, e.a.bright, e.b.base, e.b.bright, 1)));
check('the palette holds every plain colour',
  [0, 1, 2, 3, 4, 5, 6, 7].every(c => pal.some(e => e.a.base === c && e.b.base === c)));
check('the palette is cached per step', Q.steadyPalette(1) === pal && Q.steadyPalette(2) !== pal);
check('a looser step allows more mixes', Q.steadyPalette(2).length > pal.length);

// --- 4. A pair's usable slots ----------------------------------------------

const bw = { a: { ink: 0, paper: 7, bright: false }, b: { ink: 0, paper: 7, bright: false } };
const usable = Q.slotsFor(bw, 1).map(s => s.slot).join();
check('black-on-white on both screens keeps only the two steady slots', usable === '0,3', usable);
const nb = { a: { ink: 1, paper: 2, bright: false }, b: { ink: 2, paper: 1, bright: false } };
check('neighbour colours give all four slots', Q.slotsFor(nb, 1).length === 4);
check('a slot shows the blend of its two frames',
  Q.slotsFor(nb, 1).find(s => s.slot === 3).rgb.join() === Q.blend(ZX_PALETTE_RGB[1], ZX_PALETTE_RGB[2]).join());

summary();
