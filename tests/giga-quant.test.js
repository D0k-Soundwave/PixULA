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
check('black is the same colour in both brightnesses',
  Q.isSteady(0, true, 1, false, 1) && Q.isSteady(1, false, 0, true, 1));
check('... so bright black over dim blue gives a usable slot',
  Q.slotsFor({ a: { ink: 0, paper: 0, bright: true }, b: { ink: 1, paper: 1, bright: false } }, 1).length > 0);
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
  // The same property at the step that ships (MAX_STEP), not only at 1
  let seed = 19;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const steadyAt = (pick, r) =>
    Array.from(r.slots).every(sl => Q.slotsFor(pick).some(u => u.slot === sl));
  let ok = true;
  for (let t = 0; t < 200 && ok; t++) {
    const cell = cellOf(8, 8, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
    const pick = Q.chooseCell(cell);
    for (const d of ['none', 'floyd-steinberg']) {
      if (!steadyAt(pick, Q.renderCell(cell, pick, d, 8, 8))) ok = false;
    }
  }
  check(`200 random cells use only steady slots at MAX_STEP (${Q.MAX_STEP})`, ok);
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

{
  // Final review: an empty sample list must not throw mid-import
  let threw = null;
  try { Q.chooseCell(new Float32Array(0), 1); } catch (e) { threw = e.message; }
  check('chooseCell with no samples returns a pick instead of throwing', threw === null, threw);
}

{
  // Final review: Sharp hands chooseCell every source pixel of the cell,
  // 15,600 for a 12 MP photo, and the preview re-runs it per slider step.
  // Beyond MAX_DECIDE_SAMPLES it must cost no more than at the cap.
  const countCalls = (samples) => {
    const real = Q._dist2;
    let n = 0;
    Q._dist2 = function(...a) { n++; return real.apply(this, a); };
    try { Q.chooseCell(samples, 1); } finally { Q._dist2 = real; }
    return n;
  };
  const scene = (count) => {
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) out.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], i * 3);
    return out;
  };
  const atCap = countCalls(scene(Q.MAX_DECIDE_SAMPLES));
  const huge = countCalls(scene(15600));
  check('a 12 MP cell costs no more than one at the sample cap', huge <= atCap * 1.1,
    `${huge} distance calls vs ${atCap} at the cap`);
}

// --- 6. The hi-res pair ----------------------------------------------------

{
  const p = Q.hiresPick(2, 5);
  check('a hi-res pick is each scheme\'s ink on its complement, bright',
    p.a.ink === 2 && p.a.paper === 5 && p.a.bright === true
      && p.b.ink === 5 && p.b.paper === 2 && p.b.bright === true);

  // A 16x8 image, left half one steady mix of two bright schemes' inks,
  // right half another: some scheme pair reproduces it exactly
  const target = Q.blend(ZX_PALETTE_RGB[10], ZX_PALETTE_RGB[11]); // bright red + bright magenta
  const W2 = 16, H2 = 8;
  const data = new Uint8ClampedArray(W2 * H2 * 4);
  for (let i = 0; i < W2 * H2; i++) data.set([...target, 255], i * 4);
  const s = Q.chooseHiresSchemes({ width: W2, height: H2, data }, 1);
  const pick = Q.hiresPick(s.inkA, s.inkB);
  check('the chosen schemes can show the image\'s colour steadily',
    Q.slotsFor(pick, 1).some(u => u.rgb.join() === target.join()),
    `schemes ${s.inkA}/${s.inkB}`);
}

{
  // Final-review minor: the scheme search runs on every preview slider step
  // over a 512x192 picture, so it scores every second pixel each way. A
  // picture whose even pixels are one colour and every other pixel another
  // shows which were read: the chosen schemes fit the even pixels' colour.
  const onGrid = Q.blend(ZX_PALETTE_RGB[10], ZX_PALETTE_RGB[11]); // bright red + bright magenta
  // Bright white needs white on both screens, which no scheme pair showing
  // red + magenta can have - so the two colours cannot both be fitted
  const offGrid = Q.blend(ZX_PALETTE_RGB[15], ZX_PALETTE_RGB[15]);
  const W4 = 64, H4 = 32;
  const data = new Uint8ClampedArray(W4 * H4 * 4);
  for (let y = 0; y < H4; y++) {
    for (let x = 0; x < W4; x++) {
      data.set([...((x % 2 === 0 && y % 2 === 0) ? onGrid : offGrid), 255], (y * W4 + x) * 4);
    }
  }
  const s = Q.chooseHiresSchemes({ width: W4, height: H4, data }, 1);
  check('the scheme search scores every second pixel each way',
    Q.slotsFor(Q.hiresPick(s.inkA, s.inkB), 1).some(u => u.rgb.join() === onGrid.join()),
    `schemes ${s.inkA}/${s.inkB}`);
}

summary();
