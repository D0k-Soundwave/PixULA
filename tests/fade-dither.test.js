'use strict';
/**
 * THE FADE'S DITHER, AND THE DEAD FADE IT REPLACED.
 *
 * The fade brush delegates its stamp to another brush, then thinned that
 * delegate by scaling `flow`. Only the scattering brushes ever SPEND flow, so
 * a fade wrapped around hatch, pattern or crosshatch drew at full strength for
 * its whole length and then stopped dead — no fade at all, from a tool whose
 * entire job is fading. The fade menu offered those delegates anyway.
 *
 * The thinning now happens at PixelDrawRoutine.withDitherGate(), the third
 * tool-stroke hook, so it applies to whatever the delegate writes without any
 * brush having to know about density. Pinned here:
 *
 *   1. Every non-scatter delegate actually fades (the bug, as a regression).
 *   2. The gate drops exactly the pixels the threshold rejects, and restores
 *      itself afterwards — no leaking into later strokes.
 *   3. Each dither is deterministic in canvas coordinates, so a stroke redrawn
 *      lands on the same pixels. That is why 'noise' is a coordinate hash and
 *      not Math.random().
 *   4. Coverage rises with density for every dither, and ordered8 really does
 *      offer more gradations than ordered4.
 *   5. Halftone clusters its ink where the others disperse it.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

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
  _sel: { ink: 0, paper: 7, bright: false, flash: false },
  getCurrentSelection() { return { ...this._sel }; }
};
const PATTERN = {
  width: 8, height: 8,
  bitmap: Array.from({ length: 64 }, (_, i) => (i % 3 === 0 ? 1 : 0))
};
global.PatternService = {
  getCurrentPattern() { return { id: 'test' }; },
  getCurrentPatternData() { return PATTERN; },
  shouldDrawPixel(x, y) { return (x + y) % 2 === 0; }
};
global.SelectionService = {
  isFloating() { return false; }, hasSelection() { return false; },
  getSelection() { return null; }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/brush-engine.js');

LayerManager.initialize();
BrushEngine.initialize();

const fade = BrushEngine.brushes.get('fade');
const SEL = { ink: 0, paper: 7, bright: false, flash: false };

/**
 * Record the pixels that SURVIVE to the layer.
 *
 * Counting draw() calls would count the ones the gate drops — the very thing
 * under test — so the coordinate is captured on the way in and only committed
 * if the write reaches _applyNormalDraw. The stack keeps that honest through
 * the symmetry expansion's recursion.
 */
function recordWrites(fn) {
  const written = new Set();
  const realDraw = PixelDrawRoutine.draw;
  const realApply = PixelDrawRoutine._applyNormalDraw;
  const stack = [];

  PixelDrawRoutine.draw = function(x, y, sel, mode, opts) {
    stack.push(x + ',' + y);
    try { return realDraw.call(this, x, y, sel, mode, opts); } finally { stack.pop(); }
  };
  PixelDrawRoutine._applyNormalDraw = function(...args) {
    if (stack.length) written.add(stack[stack.length - 1]);
    return realApply.apply(this, args);
  };

  try { fn(); } finally {
    PixelDrawRoutine.draw = realDraw;
    PixelDrawRoutine._applyNormalDraw = realApply;
  }
  return written;
}

/**
 * Stamp the fade once at a given travelled distance, and count the ink.
 *
 * Every stamp lands on the same pixel with the travel set by hand, which is
 * how a whole stroke's worth of fade is exercised without walking one. That
 * means the measure has to be PATH LENGTH explicitly: under the shipped
 * default (distance from the click point) a stamp that never moves is always
 * at distance zero, so nothing here would ever fade. What this file is about
 * is the dither gate across delegates, not which measure is the default -
 * fade-zones.test.js owns that.
 */
function stampAt(distance, { delegate = 'round', size = 12, dither = 'ordered4' } = {}) {
  fade.resetStroke();
  fade.measureFrom = 'travel';
  fade.setFadeBrushType(delegate);
  fade.setDitherType(dither);
  fade._strokeDistance = distance;
  fade._lastX = 128; fade._lastY = 96;
  // The pattern brush reveals options.patternData, so it must be handed one.
  const options = { isInk: true, colorSelection: SEL, patternData: PATTERN };
  return recordWrites(() => fade.apply(128, 96, size, 1, SEL, options)).size;
}

// ── 1. The dead fade: every delegate now thins ─────────────────────────────

const DELEGATES = ['round', 'square', 'crosshatch', 'pattern', 'hatch'];
for (const delegate of DELEGATES) {
  const near = stampAt(0, { delegate });
  const mid = stampAt(32, { delegate });
  const far = stampAt(60, { delegate });
  check(`fade over '${delegate}' thins with distance`,
    near > 0 && mid <= near && far < mid,
    `${near} -> ${mid} -> ${far} pixels`);
  check(`fade over '${delegate}' is nearly gone at the end`,
    far < near / 2, `${near} -> ${far}`);
}

// Spray keeps its own path: flow buys particles, so it must NOT be gated too.
check('spray consumes flow and the solids do not',
  BrushEngine.brushes.get('spray').consumesFlow === true &&
  BrushEngine.brushes.get('round').consumesFlow === false &&
  BrushEngine.brushes.get('hatch').consumesFlow === false);

const sprayNear = stampAt(0, { delegate: 'spray', size: 16 });
const sprayFar = stampAt(56, { delegate: 'spray', size: 16 });
check('fade over spray still thins (via flow, ungated)',
  sprayNear > 0 && sprayFar < sprayNear, `${sprayNear} -> ${sprayFar}`);

// ── 1b. Ordered dither resonates with an evenly-spaced lattice ─────────────
//
// A DOCUMENTED CHARACTERISTIC, not a bug, and the reason the noise dither
// earns its place. A hatch at even spacing only ever samples the even cells
// of the Bayer matrix — and in ANY Bayer matrix those four cells hold the
// four LOWEST thresholds by construction (0,1,2,3 of 16). So every hatch
// pixel survives until the density drops under 4/16, and the fade arrives in
// one late step instead of dissolving. Odd spacings walk all the phases and
// fade smoothly; halftone and noise have no such sublattice.
//
// If someone ever "fixes" a dither and this stops being true, that is worth
// knowing about deliberately rather than discovering in a drawing.
const hatchBrush = BrushEngine.brushes.get('hatch');
const originalSpacing = hatchBrush.spacing;

hatchBrush.spacing = 4;
const evenOrdered = [0, 32, 60].map(d => stampAt(d, { delegate: 'hatch' }));
const evenNoise = [0, 32, 60].map(d => stampAt(d, { delegate: 'hatch', dither: 'noise' }));
hatchBrush.spacing = 5;
const oddOrdered = [0, 32, 60].map(d => stampAt(d, { delegate: 'hatch' }));
hatchBrush.spacing = originalSpacing;

check('ordered dither holds a full even-spaced hatch until late',
  evenOrdered[1] === evenOrdered[0], evenOrdered.join(' -> '));
check('an odd-spaced hatch fades smoothly under the same dither',
  oddOrdered[1] < oddOrdered[0], oddOrdered.join(' -> '));
check('the noise dither fades the even-spaced hatch smoothly',
  evenNoise[1] < evenNoise[0], evenNoise.join(' -> '));

// ── 2. The gate itself ─────────────────────────────────────────────────────

const gated = recordWrites(() => {
  PixelDrawRoutine.withDitherGate((x, y) => (x + y) % 2 === 0, () => {
    for (let x = 10; x < 26; x++) PixelDrawRoutine.draw(x, 40, SEL, DRAW_MODE.NORMAL);
  });
});
let gateExact = gated.size === 8;
for (const key of gated) {
  const [x, y] = key.split(',').map(Number);
  if ((x + y) % 2 !== 0) gateExact = false;
}
check('the gate drops exactly the rejected pixels', gateExact, `${gated.size} kept`);

const after = recordWrites(() => {
  for (let x = 10; x < 26; x++) PixelDrawRoutine.draw(x, 42, SEL, DRAW_MODE.NORMAL);
});
check('the gate does not leak past its call', after.size === 16, `${after.size} kept`);

const optedOut = recordWrites(() => {
  PixelDrawRoutine.withDitherGate(() => false, () => {
    PixelDrawRoutine.draw(60, 60, SEL, DRAW_MODE.NORMAL, { dither: false });
    PixelDrawRoutine.draw(61, 60, SEL, DRAW_MODE.NORMAL);
  });
});
check('options.dither === false opts a single write out',
  optedOut.size === 1 && optedOut.has('60,60'));

// ── 3. Determinism ─────────────────────────────────────────────────────────

let deterministic = true;
for (const dither of FADE_DITHER_IDS) {
  fade.setDitherType(dither);
  for (let i = 0; i < 200; i++) {
    const x = i * 7 % 256, y = i * 13 % 192;
    if (fade.thresholdAt(x, y) !== fade.thresholdAt(x, y)) deterministic = false;
  }
  const first = stampAt(24, { dither });
  const second = stampAt(24, { dither });
  if (first !== second) deterministic = false;
}
check('every dither is a pure function of the coordinates', deterministic);

let ranged = true;
for (const dither of FADE_DITHER_IDS) {
  fade.setDitherType(dither);
  for (let y = -8; y < 40; y++) {
    for (let x = -8; x < 40; x++) {
      const t = fade.thresholdAt(x, y);
      if (!(t >= 0 && t < 1)) ranged = false;
    }
  }
}
check('thresholds stay in 0..1 including left of the origin', ranged);

// ── 4. Coverage and gradation ──────────────────────────────────────────────

/** Fraction of a 32x32 block lit at a given density. */
function coverage(dither, density) {
  fade.setDitherType(dither);
  let n = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) if (density > fade.thresholdAt(x, y)) n++;
  }
  return n / 1024;
}

let monotone = true, tracks = true;
for (const dither of FADE_DITHER_IDS) {
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const c = coverage(dither, i / 20);
    if (c < prev - 1e-9) monotone = false;
    prev = c;
  }
  // Coverage should roughly equal the requested density.
  if (Math.abs(coverage(dither, 0.5) - 0.5) > 0.08) tracks = false;
  if (coverage(dither, 0) !== 0) tracks = false;
  if (coverage(dither, 1) !== 1) tracks = false;
}
check('coverage rises with density for every dither', monotone);
check('coverage tracks the requested density for every dither', tracks);

/** How many DISTINCT coverage levels a dither can express. */
function levels(dither) {
  const seen = new Set();
  for (let i = 0; i <= 400; i++) seen.add(coverage(dither, i / 400));
  return seen.size;
}
const l4 = levels('ordered4');
const l8 = levels('ordered8');
check('ordered 8x8 offers more gradations than 4x4', l8 > l4 * 2, `${l4} vs ${l8}`);
check('ordered 4x4 still gives its 16 levels', l4 === 17, String(l4));

// ── 5. Halftone clusters, the others disperse ──────────────────────────────

/** Share of lit pixels that touch another lit pixel (4-neighbour). */
function clustering(dither, density) {
  fade.setDitherType(dither);
  const on = (x, y) => density > fade.thresholdAt(x, y);
  let lit = 0, touching = 0;
  for (let y = 1; y < 33; y++) {
    for (let x = 1; x < 33; x++) {
      if (!on(x, y)) continue;
      lit++;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) touching++;
    }
  }
  return lit ? touching / lit : 0;
}
const halftoneCluster = clustering('halftone', 0.25);
const orderedCluster = clustering('ordered4', 0.25);
check('halftone clusters its ink into dots',
  halftoneCluster > 0.9 && halftoneCluster > orderedCluster * 2,
  `halftone ${halftoneCluster.toFixed(2)} vs ordered ${orderedCluster.toFixed(2)}`);

// ── The default is unchanged ───────────────────────────────────────────────

const freshFade = new FadeBrush();
check('the default dither is still the historical Bayer 4x4',
  freshFade.ditherType === 'ordered4');
const BAYER4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16]
];
let same = true;
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    if (Math.abs(freshFade.thresholdAt(x, y) - BAYER4[y][x]) > 1e-12) same = false;
  }
}
check('ordered4 is byte-for-byte the matrix the fade always used', same);

fade.setDitherType('nonsense');
check('an unknown dither id is ignored', fade.ditherType !== 'nonsense');

summary();
