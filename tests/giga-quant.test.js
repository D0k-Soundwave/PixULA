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

// --- 5. Choosing a cell ------------------------------------------------------

const cellOf = (w, h, colourAt) => {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out.set(colourAt(x, y), (y * w + x) * 3);
  }
  return out;
};
const cellError = (cell, w, h, r) => {
  let err = 0;
  for (let i = 0; i < w * h; i++) {
    const rgb = r.slotRGB[r.slots[i]];
    err += Q._dist2(cell[i * 3], cell[i * 3 + 1], cell[i * 3 + 2], rgb);
  }
  return err;
};
const allSteady = (pick, r) =>
  Array.from(r.slots).every(s => Q.slotsFor(pick, 1).some(u => u.slot === s));

{
  // A cell that is exactly one steady mix: blue with red, both normal
  const mix = Q.blend(ZX_PALETTE_RGB[1], ZX_PALETTE_RGB[2]);
  const cell = cellOf(8, 8, () => mix);
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  check('a cell of one steady mix is reproduced exactly', cellError(cell, 8, 8, r) === 0,
    `error ${cellError(cell, 8, 8, r)}`);
}

{
  // Black and white halves: two steady slots (black/black, white/white)
  const cell = cellOf(8, 8, (x) => (x < 4 ? [0, 0, 0] : [215, 215, 215]));
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  check('black and white halves are reproduced exactly', cellError(cell, 8, 8, r) === 0);
  check('... using only steady slots', allSteady(pick, r));
  check('... and the rows say which screen is ink',
    r.pixelsA[0] === r.pixelsB[0] && (r.pixelsA[0] === 0x0F || r.pixelsA[0] === 0xF0),
    `A ${r.pixelsA[0]} B ${r.pixelsB[0]}`);
}

{
  // Review Focus 1: mid grey has no steady mix of its own
  const cell = cellOf(8, 8, () => [128, 128, 128]);
  const pick = Q.chooseCell(cell, 1);
  const flat = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  const smooth = Q.renderCell(cell, pick, 'floyd-steinberg', 8, 8, 1);
  check('grey uses only steady slots', allSteady(pick, flat) && allSteady(pick, smooth));
}

{
  // Property: random cells never land on a flickering slot
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let ok = true;
  for (let t = 0; t < 200 && ok; t++) {
    const cell = cellOf(8, 8, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
    const pick = Q.chooseCell(cell, 1);
    for (const d of ['none', 'floyd-steinberg']) {
      if (!allSteady(pick, Q.renderCell(cell, pick, d, 8, 8, 1))) ok = false;
    }
  }
  check('200 random cells use only steady slots', ok);
}

{
  // Review Focus 2: MultiGigaScreen 8x1 - eight pixels in a cell
  const cell = cellOf(8, 1, (x) => (x % 2 ? [0, 0, 215] : [215, 0, 0]));
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 1, 1);
  check('an 8x1 cell is chosen and drawn', r.pixelsA.length === 1 && r.slots.length === 8);
  check('an 8x1 cell of two neighbour colours is exact', cellError(cell, 8, 1, r) === 0,
    `error ${cellError(cell, 8, 1, r)}`);
}

{
  // The Sharp method hands chooseCell more samples than renderCell draws
  const many = cellOf(24, 24, (x) => (x < 12 ? [0, 0, 0] : [215, 215, 215]));
  const pick = Q.chooseCell(many, 1);
  check('chooseCell accepts any number of samples', Q.slotsFor(pick, 1).length > 0);
}

summary();
