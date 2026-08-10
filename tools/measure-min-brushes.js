'use strict';
/**
 * Minimum viable size measurement - brushes and the size-bearing tools.
 *
 * The companion to tools/measure-min-sizes.js (shapes). Same discipline: drive
 * the real BrushShapes / BrushEngine / ShapeGenerator and measure, never
 * reason from the outside about what the code probably does.
 *
 * The question differs per tool, so each section states the one it answers.
 * Where a tool can silently draw NOTHING at some sizes (the hatch brushes can,
 * and did), that threshold is the important one: a tool that leaves no mark
 * reads as a broken app, not as a small setting.
 *
 * Run: node tools/measure-min-brushes.js
 */

const { loadModule } = require('../tests/helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  getCurrentSelection() {
    return { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false };
  }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }
};
const PATTERN8 = {
  width: 8, height: 8,
  bitmap: Array.from({ length: 64 }, (_, i) => ((i % 8) < 4 ? 1 : 0))   // half-covered tile
};
global.PatternService = {
  getCurrentPattern() { return { id: 'test' }; },
  getCurrentPatternData() { return PATTERN8; },
  shouldDrawPixel(x, y) { return (x + y) % 2 === 0; }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/shape-generator.js');

LayerManager.initialize();
BrushEngine.initialize();

const out = [];
const say = (s = '') => out.push(s);
const rule = (s) => { say(); say(s); say('-'.repeat(s.length)); };

/**
 * A seeded generator for the two sampled figures below.
 *
 * BrushShapes.scatterPoints and .poissonDisk both take an injectable source of
 * randomness precisely so a measurement can be repeated. Left on Math.random
 * the Poisson minimums wobbled by a size either way between runs, which is no
 * use to a document that quotes them. mulberry32: one line, well distributed
 * enough for counting, and identical on every machine.
 */
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Record every on-canvas pixel a stamp writes. */
function recordWrites(fn) {
  const written = new Set();
  const real = PixelDrawRoutine.draw.bind(PixelDrawRoutine);
  PixelDrawRoutine.draw = (x, y, sel, mode, opts) => {
    if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) written.add(x + ',' + y);
    return real(x, y, sel, mode, opts);
  };
  try { fn(); } finally { PixelDrawRoutine.draw = real; }
  return written;
}

// -- 1. Solid brushes: when does "round" start being round? ------------------
//
// At sizes 1 and 2 the disc and the square are the same pixels, so the shape
// choice is inert; the first size at which they differ is the first size where
// a round brush is a round brush.

rule('1. ROUND vs SQUARE brush (BrushShapes.disc / .square)');
say('size  disc px  square px  round?  mask');
let roundFrom = null;
for (let size = 1; size <= 8; size++) {
  const disc = BrushShapes.disc(size);
  const square = BrushShapes.square(size);
  const discN = disc.flat().filter(Boolean).length;
  const sqN = square.flat().filter(Boolean).length;
  const differs = discN !== sqN;
  if (differs && roundFrom === null) roundFrom = size;
  say(`${String(size).padStart(3)}   ${String(discN).padStart(6)}   ${String(sqN).padStart(8)}` +
      `   ${differs ? 'yes' : 'NO '}    ${disc.map(r => r.map(v => v ? '#' : '.').join('')).join(' ')}`);
}
say(`=> a round brush is only round from size ${roundFrom}; at 1 and 2 it IS the square brush.`);

// -- 2. Hatch brush: the size below which a stamp can miss the lattice -------
//
// The lattice is anchored to canvas coordinates, so whether a stamp marks
// anything depends on WHERE it lands. The threshold that matters is the
// worst case over every phase: below it, the same brush marks at some
// positions and silently does nothing at others.

rule('2. HATCH brush: smallest size that always marks, per spacing');
say('spacing  round nib: always-marks / 2-lines   square nib: always-marks / 2-lines');
const hatchRows = [];
for (const spacing of [2, 3, 4, 6, 8, 12, 16]) {
  const row = { spacing };
  for (const nib of ['round', 'square']) {
    let always = null, twoLines = null;
    for (let size = 1; size <= 40; size++) {
      const mask = nib === 'square' ? BrushShapes.square(size) : BrushShapes.disc(size);
      const offset = Math.floor(size / 2);
      let worstMarks = Infinity, worstLines = Infinity;
      for (let py = 0; py < spacing; py++) {
        for (let px = 0; px < spacing; px++) {
          let marks = 0;
          const lines = new Set();
          for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
              if (!mask[dy][dx]) continue;
              const x = 128 + px + dx - offset;
              const y = 96 + py + dy - offset;
              const dir = BrushShapes.hatchDirection('45');
              if (!BrushShapes.onHatchLine(x, y, dir, spacing, 1)) continue;
              marks++;
              lines.add(Math.floor((-dir.b * x + dir.a * y) / spacing));
            }
          }
          worstMarks = Math.min(worstMarks, marks);
          worstLines = Math.min(worstLines, lines.size);
        }
      }
      if (always === null && worstMarks >= 1) always = size;
      if (twoLines === null && worstLines >= 2) twoLines = size;
      if (always !== null && twoLines !== null) break;
    }
    row[nib] = { always, twoLines };
  }
  hatchRows.push(row);
  say(`${String(row.spacing).padStart(5)}    ` +
      `${String(row.round.always).padStart(12)} / ${String(row.round.twoLines).padStart(7)}   ` +
      `${String(row.square.always).padStart(20)} / ${String(row.square.twoLines).padStart(7)}`);
}
say('=> below always-marks, a hatch stroke drops out at some positions on the grid.');
say('   Two lines in one stamp is what makes a single dab read as hatching rather');
say('   than as a stray line; a dragged stroke accumulates, so it needs only the first.');

// -- 3. Crosshatch brush (fixed spacing 4) ----------------------------------

rule('3. CROSSHATCH brush (lattice spacing fixed at 4)');
{
  // From size 2: at size 1 every brush is the pencil by the size-1 invariant,
  // which would make "always marks" trivially true and say nothing.
  let always = null, bothFamilies = null;
  for (let size = 2; size <= 24 && (always === null || bothFamilies === null); size++) {
    let worstMarks = Infinity, worstFamilies = Infinity;
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        BrushEngine.setBrush('crosshatch');
        BrushEngine.setSize(size);
        const written = recordWrites(() => BrushEngine.applyBrush(128 + px, 96 + py, 1.0, true));
        worstMarks = Math.min(worstMarks, written.size);
        const fam = new Set();
        for (const key of written) {
          const [x, y] = key.split(',').map(Number);
          if (((x - y) % 4 + 4) % 4 === 0) fam.add('a');
          if (((x + y) % 4 + 4) % 4 === 0) fam.add('b');
        }
        worstFamilies = Math.min(worstFamilies, fam.size);
      }
    }
    if (always === null && worstMarks >= 1) always = size;
    if (bothFamilies === null && worstFamilies >= 2) bothFamilies = size;
  }
  say(`always marks from size ${always}; both diagonal families present from size ${bothFamilies}`);
  say('=> at size 1 the brush is the pencil by design; between 2 and the figure above');
  say('   it marks at some positions and not others.');
}

// -- 4. Spray: particles per stamp, and when a scatter becomes a scatter -----

rule('4. SPRAY brush, uniform distribution');
say('size  particles/stamp (flow 100%)  distinct cells hit (mean of 200)  envelope cells');
const SCATTER_DENSITY = 0.25;              // brush-engine.js
let sprayFrom = null;
for (const size of [1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32]) {
  const count = Math.max(1, Math.round(size * size * SCATTER_DENSITY));
  const radius = BrushShapes.radiusFor(size);
  const rng = seeded(0x5EED);
  let total = 0;
  for (let trial = 0; trial < 200; trial++) {
    const pts = BrushShapes.scatterPoints(radius, 0, count, rng);
    total += new Set(pts.map(p => p.dx + ',' + p.dy)).size;
  }
  const mean = total / 200;
  const env = BrushShapes.scatterEnvelope(radius).length;
  if (sprayFrom === null && mean >= 2) sprayFrom = size;
  say(`${String(size).padStart(3)}   ${String(count).padStart(22)}   ${mean.toFixed(2).padStart(28)}` +
      `   ${String(env).padStart(9)}`);
}
say(`=> a stamp deposits more than one pixel from size ${sprayFrom}; below that the spray`);
say('   is a pencil with a wobble (size 1 is the pencil by the size-1 invariant).');

rule('5. SPRAY brush, Poisson distribution: points per stamp');
say('minDistance   size that first yields >= 2 points (worst of 200 seeded samples)');
for (const minD of [1, 2, 3, 4, 6, 8]) {
  const rng = seeded(0x5EED);
  let from = null;
  for (let size = 1; size <= 40 && from === null; size++) {
    let worst = Infinity;
    for (let trial = 0; trial < 200; trial++) {
      worst = Math.min(worst, BrushShapes.poissonDisk(size, minD, 30, rng).length);
    }
    if (worst >= 2) from = size;
  }
  say(`${String(minD).padStart(9)}     ${String(from).padStart(3)}`);
}
say('=> below these a Poisson stamp is a single dot wherever the sampler happens to seed it.');

// -- 6. Fade brush: the fade length a stroke needs to show its zones ---------
//
// Stamps land every max(1, floor(size/2)) px along a stroke (BrushEngine
// .applyContinuousBrush), so a zone shorter than one stamp interval can be
// stepped straight over. The smallest default zone is the stipple tail at
// 25% of the fade, which is what sets the floor.

rule('6. FADE brush: fade length needed for every zone to receive a stamp');
say('brush size  stamp spacing  fade length: best case / guaranteed  slider allows');
{
  const fade = BrushEngine.brushes.get('fade');
  const weights = [0, 40, 35, 25];                  // the shipped defaults
  const total = weights.reduce((a, b) => a + b, 0);
  const zoneOf = (t) => {
    let start = 0;
    for (let i = 0; i < 4; i++) {
      const span = weights[i] / total;
      if (span > 0 && t < start + span) return i;
      start += span;
    }
    return 3;
  };
  for (const size of [1, 2, 4, 8, 16, 24, 32]) {
    const spacing = Math.max(1, Math.floor(size / 2));
    let best = null, guaranteed = null;
    for (let L = 8; L <= 256 && (best === null || guaranteed === null); L++) {
      fade.setFadeLength(L);
      // Phase matters: a stroke's stamps land wherever its first one did, so
      // the useful figure is the WORST phase, not the one that happens to
      // sample every band. Zone 0 has zero weight by default, so three zones
      // are the whole ramp.
      let worst = Infinity, bestHit = 0;
      for (let phase = 0; phase < spacing; phase++) {
        const zonesHit = new Set();
        for (let travel = phase; travel <= L; travel += spacing) {
          const t = travel / L;
          if (fade.densityAt(t) > 0) zonesHit.add(zoneOf(t));
        }
        worst = Math.min(worst, zonesHit.size);
        bestHit = Math.max(bestHit, zonesHit.size);
      }
      if (best === null && bestHit >= 3) best = L;
      if (guaranteed === null && worst >= 3) guaranteed = L;
    }
    say(`${String(size).padStart(10)}  ${String(spacing).padStart(13)}  ` +
        `${String(best).padStart(19)} / ${String(guaranteed).padStart(10)}` +
        `  ${guaranteed !== null && guaranteed <= 256 ? 'yes (8..256)' : 'NO'}`);
  }
  fade.setFadeLength(64);
}
say('=> at large brush sizes a short fade is stepped over: the stroke jumps from solid');
say('   to nothing without showing the dither bands that are the point of the brush.');

// -- 7. Pattern brush: seeing the whole tile in one dab ----------------------

rule('7. PATTERN brush: brush size vs pattern tile');
say('A dab smaller than the tile shows a fragment of the design; the tile only reads');
say('whole at brush size >= the tile size. The library ships 8, 16 and 32 px tiles.');
say('  tile  8 px  -> whole tile in one dab at brush size  8 (slider max 32: yes)');
say('  tile 16 px  -> whole tile in one dab at brush size 16 (slider max 32: yes)');
say('  tile 32 px  -> whole tile in one dab at brush size 32 (slider max 32: exactly)');
say('The tiling is canvas-absolute, so a dragged stroke still lays a continuous');
say('pattern at any size - this is about a single dab, and about the preview matching.');

// -- 8. Shape stroke thickness vs a hollow shape -----------------------------
//
// Thickness dilates the outline by a disc, inwards as well as outwards, so a
// hollow shape has a size below which the stroke closes over its own interior.

rule('8. SHAPE THICKNESS: smallest box that stays hollow');
say('thickness  smallest square outline that still encloses paper');
for (let t = 1; t <= 8; t++) {
  let from = null;
  for (let side = 3; side <= 64 && from === null; side++) {
    const b = { x1: 100, y1: 100, x2: 100 + side - 1, y2: 100 + side - 1 };
    const outline = ShapeGenerator.generateShape('rectangle', b, { thickness: t });
    const set = new Set(outline.map(p => p.x + ',' + p.y));
    // Any paper left in the middle?
    let hollow = false;
    for (let y = 100; y < 100 + side && !hollow; y++) {
      for (let x = 100; x < 100 + side; x++) {
        if (!set.has(x + ',' + y)) { hollow = true; break; }
      }
    }
    if (hollow) from = side;
  }
  say(`${String(t).padStart(9)}  ${String(from).padStart(3)} x ${from} px`);
}

// -- 9. Bezier: the handle offset that makes a curve look curved -------------
//
// A quadratic bezier's furthest point sits half way to its handle, so the bow
// is offset/2 - and a bow smaller than the stroke is inside the ink.

rule('9. BEZIER curve: handle offset needed for visible curvature');
say('thickness  chord 32 px: offset for a 1 px bow / for a bow clear of the stroke');
for (const t of [1, 2, 4, 8]) {
  let bow1 = null, clear = null;
  for (let offset = 1; offset <= 64 && (bow1 === null || clear === null); offset++) {
    const p0 = { x: 100, y: 100 }, p1 = { x: 132, y: 100 };
    const c = { x: 116, y: 100 - offset };
    const curve = ShapeGenerator.generateQuadraticBezier(p0, c, p1, { thickness: t });
    const line = ShapeGenerator.generateShape('line', { x1: 100, y1: 100, x2: 132, y2: 100 }, { thickness: t });
    const lineSet = new Set(line.map(p => p.x + ',' + p.y));
    let apart = 0;
    for (const p of curve) if (!lineSet.has(p.x + ',' + p.y)) apart++;
    // Deepest departure from the chord, in pixels.
    let deepest = 0;
    for (const p of curve) deepest = Math.max(deepest, 100 - p.y);
    if (bow1 === null && apart > 0 && deepest >= 1) bow1 = offset;
    if (clear === null && deepest >= t + 1) clear = offset;
  }
  say(`${String(t).padStart(9)}  ${String(bow1).padStart(11)} / ${String(clear).padStart(9)}`);
}
say('=> a curve whose bow is smaller than its own stroke width is a thick straight line.');

// -- 10. Gradient: steps, dither grain and the drag they need ---------------

rule('10. GRADIENT: drag length and region size');
say('The gradient quantises into N bands across the drag; a band narrower than a');
say('pixel cannot exist, and a band narrower than the dither tile cannot show its');
say('texture. Dither grain is the Bayer tile: coarse 2, medium 4, fine 8 px.');
say('');
say('steps  min drag for 1 px bands  min drag for a full dither tile per band');
say('                                 coarse(2)   medium(4)   fine(8)');
for (const steps of [1, 2, 4, 8, 16]) {
  say(`${String(steps).padStart(5)}  ${String(steps).padStart(22)}` +
      `  ${String(steps * 2).padStart(10)}  ${String(steps * 4).padStart(10)}  ${String(steps * 8).padStart(9)}`);
}
say('');
say('A filled region smaller than the dither tile cannot carry a mid tone at all:');
say('with fine (8 px) grain, a region under 8x8 px lands on whichever few thresholds');
say('it happens to cover, so it comes out solid or empty rather than shaded.');

// -- 11. Text: the bitmap fonts have exactly one native size ----------------

rule('11. TEXT: bitmap font glyph sizes');
{
  loadModule('js/data/zx-rom-font.js');
  const bytes = ZX_ROM_FONT.length;
  const glyphs = bytes / 8;
  say(`ZX ROM charset: ${bytes} bytes = ${glyphs} glyphs of 8 rows -> the glyph cell is 8 x 8 px.`);
  // Widest and narrowest ink extents in the charset, to show what an 8 px cell
  // actually spends on the letterform.
  let minInk = 8, maxInk = 0;
  for (let g = 0; g < glyphs; g++) {
    let lo = 8, hi = -1;
    for (let row = 0; row < 8; row++) {
      const bits = ZX_ROM_FONT[g * 8 + row];
      for (let col = 0; col < 8; col++) {
        if ((bits >> (7 - col)) & 1) { lo = Math.min(lo, col); hi = Math.max(hi, col); }
      }
    }
    if (hi >= 0) { minInk = Math.min(minInk, hi - lo + 1); maxInk = Math.max(maxInk, hi - lo + 1); }
  }
  say(`Letterforms occupy ${minInk} to ${maxInk} of the 8 columns; the rest is side bearing.`);
  say('The text tool offers 8, 16, 24, 32, 48, 64 px for bitmap families. 8 px IS the');
  say('glyph: it is the minimum, and every larger size is an integer multiple of it');
  say('(16 = 2x, 24 = 3x ...), so only those stay pixel-crisp.');
  say('Font-editor fonts may be 4 or 6 px wide on the same 8 px cell height, so their');
  say('minimum is 8 px tall likewise - the width narrows, the cell does not.');
}

// -- 12. The attribute cell: the floor under every tool in this app ---------

rule('12. ATTRIBUTE CELL: the smallest independently coloured mark');
{
  const w = ZX_SPECTRUM.CELL_WIDTH, h = ZX_SPECTRUM.CELL_HEIGHT;
  say(`Active screen mode: ${ACTIVE_SCREEN_MODE.id}, attribute cell ${w} x ${h} px.`);
  say('Two colours per cell. Every figure above is about SHAPE - whether the raster');
  say('still says what it is. Colour has its own minimum and it is coarser: a mark');
  say(`smaller than ${w} x ${h} px cannot hold a colour of its own, because it shares`);
  say('its cell with whatever else is in that cell. In the multicolour modes the cell');
  say('height falls to 4, 2 or 1 px, which lowers this floor without touching any of');
  say('the shape figures - those are pure geometry and mode-independent.');
}

console.log(out.join('\n'));
process.exit(0);
