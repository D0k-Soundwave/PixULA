'use strict';
/**
 * THE FADE ZONES.
 *
 * The fade brush used to be one linear ramp: density = 1 - travel/length, with
 * fadeLength as a pure zoom knob. The Bayer 4x4 turned that into 16 dither
 * levels of EXACTLY equal length, so the solid head, the dither bands and the
 * stipple tail could never be reproportioned — the one shape an artist most
 * wants from a fade.
 *
 * Four zones now divide the travel by weight. The rules pinned here:
 *
 *   1. The DEFAULT weights reproduce the old linear ramp to the last decimal.
 *      The zones are an addition, not a change; a fade nobody has touched must
 *      draw what it always drew.
 *   2. The ramp is monotone non-increasing whatever the weights, so no zone
 *      setting can make a stroke get darker further out.
 *   3. A zone's weight buys it travel: raise it and its density band occupies
 *      more of the stroke, at the others' expense.
 *   4. Degenerate input (all zeroes) falls back rather than dividing by zero.
 *
 * Drives the REAL FadeBrush, not a re-implementation of its arithmetic.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/core/event-bus.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, createOverlayCanvas() { return null; }
};
global.ColorManager = {
  getCurrentSelection() {
    return { ink: 0, paper: 7, bright: false, flash: false };
  }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.StateManager = { getDrawMode() { return 'normal'; } };
global.PixelDrawRoutine = { draw() { return true; }, resolveUserMode() { return 'normal'; } };

loadModule('js/tools/brush-engine.js');
BrushEngine.initialize();

const fade = BrushEngine.brushes.get('fade');

// ── 1. The defaults ARE the old linear ramp ────────────────────────────────

let maxDrift = 0;
for (let i = 0; i <= 1000; i++) {
  const t = i / 1000;
  const drift = Math.abs(fade.densityAt(t) - (1 - t));
  if (drift > maxDrift) maxDrift = drift;
}
check('default zone weights reproduce the linear ramp', maxDrift < 1e-12,
  `max drift ${maxDrift}`);

check('default weights are the density spans',
  JSON.stringify(fade.zoneWeights) === JSON.stringify([0, 40, 35, 25]),
  JSON.stringify(fade.zoneWeights));

// The 16 Bayer levels therefore still fall every fadeLength/16 by default.
const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
  .flat().map(v => v / 16).sort((a, b) => a - b);
const levelAt = (t) => bayer.filter(b => fade.densityAt(t) > b).length;
let uniform = true;
for (let lvl = 1; lvl <= 16; lvl++) {
  // Level `lvl` should hold across the (16-lvl)/16 .. (17-lvl)/16 band.
  const mid = ((16 - lvl) + 0.5) / 16;
  if (levelAt(mid) !== lvl) uniform = false;
}
check('default fade still steps through 16 evenly spaced dither levels', uniform);

// ── 2. Monotone under every weighting ──────────────────────────────────────

const WEIGHTINGS = [
  [0, 40, 35, 25],   // default
  [50, 30, 15, 5],   // long solid head, clipped tail
  [5, 70, 20, 5],    // the shape asked for: short head, long middle, short tail
  [0, 0, 0, 100],    // stipple only
  [100, 0, 0, 0],    // solid only
  [1, 1, 1, 1],      // equal
  [0, 0, 50, 50]
];

let monotone = true, ranged = true;
for (const w of WEIGHTINGS) {
  fade.zoneWeights = [...w];
  let prev = Infinity;
  for (let i = 0; i <= 400; i++) {
    const d = fade.densityAt(i / 400);
    if (d > prev + 1e-12) monotone = false;
    if (d < -1e-12 || d > 1 + 1e-12) ranged = false;
    prev = d;
  }
}
check('density never rises along the stroke, under any weighting', monotone);
check('density stays within 0..1 under any weighting', ranged);

// ── 3. Weight buys travel ──────────────────────────────────────────────────

/** Fraction of the stroke spent at full ink (density 1). */
function solidShare(weights) {
  fade.zoneWeights = [...weights];
  let n = 0;
  for (let i = 0; i < 1000; i++) if (fade.densityAt(i / 1000) >= 1) n++;
  return n / 1000;
}
const noHead = solidShare([0, 40, 35, 25]);
const someHead = solidShare([25, 40, 35, 25]);
const bigHead = solidShare([100, 40, 35, 25]);
check('a zero solid zone means no full-ink head', noHead < 0.005, String(noHead));
check('raising the solid weight lengthens the full-ink head',
  someHead > 0.15 && bigHead > someHead, `${someHead} -> ${bigHead}`);

/** Fraction of the stroke spent in the stipple band (0 < density <= 0.25). */
function stippleShare(weights) {
  fade.zoneWeights = [...weights];
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    const d = fade.densityAt(i / 1000);
    if (d > 0 && d <= 0.25) n++;
  }
  return n / 1000;
}
const shortTail = stippleShare([5, 70, 20, 5]);
const longTail = stippleShare([5, 20, 20, 55]);
check('shortening the stipple weight shortens the stipple tail',
  shortTail < 0.1 && longTail > 0.4, `${shortTail} vs ${longTail}`);

// The shape the zones exist for: short head, long middle, short tail.
fade.zoneWeights = [10, 60, 20, 10];
check('a front-loaded fade holds ink past the halfway point',
  fade.densityAt(0.5) > 0.5 && fade.densityAt(0.95) < 0.25,
  `${fade.densityAt(0.5)} / ${fade.densityAt(0.95)}`);

// ── 4. Degenerate input ────────────────────────────────────────────────────

fade.zoneWeights = [0, 0, 0, 0];
check('all-zero weights fall back to the linear ramp rather than NaN',
  Math.abs(fade.densityAt(0.5) - 0.5) < 1e-12 && Number.isFinite(fade.densityAt(0.5)),
  String(fade.densityAt(0.5)));

fade.zoneWeights = [0, 40, 35, 25];
check('stroke start is always full ink', fade.densityAt(0) === 1);
check('stroke end is always empty', fade.densityAt(1) === 0);
check('past the end stays empty', fade.densityAt(2.5) === 0);

// setZoneWeight clamps and ignores out-of-range indices.
fade.setZoneWeight(0, 999);
check('zone weight clamps to 100', fade.zoneWeights[0] === 100);
fade.setZoneWeight(0, -5);
check('zone weight clamps to 0', fade.zoneWeights[0] === 0);
fade.setZoneWeight(9, 50);
check('out-of-range zone index is a no-op', fade.zoneWeights.length === 4);

// ── What the fade measures ─────────────────────────────────────────────────
//
// 'travel' accumulates path length, so it only ever grows: wander back over
// your own stroke and the ink keeps thinning, because the brush has still
// travelled further. That is one tapered stroke, and it is all the fade could
// ever do.
//
// 'origin' measures the straight line to the click point instead, so the fade
// is a radial falloff centred there: draw away and it thins, draw back and it
// RECOVERS, and every point at the same radius gets the same density however
// long the path there was. Pinned because "it comes back" is the entire
// feature — an implementation that quietly kept accumulating would still fade,
// just never return.

fade.zoneWeights = [0, 40, 35, 25];
fade.fadeLength = 64;

/** Walk a path through the brush and report the density at each point. */
function walk(points, measureFrom) {
  fade.resetStroke();
  fade.measureFrom = measureFrom;
  return points.map(([x, y]) => {
    if (fade._originX === null) { fade._originX = x; fade._originY = y; }
    if (fade._lastX !== null) {
      const dx = x - fade._lastX, dy = y - fade._lastY;
      fade._strokeDistance += Math.sqrt(dx * dx + dy * dy);
    }
    fade._lastX = x; fade._lastY = y;
    return fade.densityAt(fade.travelled(x, y) / fade.fadeLength);
  });
}

// Out 32px and straight back to the click point.
const OUT_AND_BACK = [[100, 100], [116, 100], [132, 100], [116, 100], [100, 100]];

const travelRun = walk(OUT_AND_BACK, 'travel');
const originRun = walk(OUT_AND_BACK, 'origin');

check("'travel' keeps thinning on the way back",
  travelRun.every((d, i) => i === 0 || d <= travelRun[i - 1]) &&
  travelRun[4] < travelRun[2],
  travelRun.map(d => d.toFixed(2)).join(' '));

check("'origin' thins on the way out", originRun[2] < originRun[0],
  originRun.map(d => d.toFixed(2)).join(' '));
check("'origin' recovers on the way back", originRun[4] > originRun[2],
  originRun.map(d => d.toFixed(2)).join(' '));
check("'origin' returns to full ink at the click point",
  originRun[0] === 1 && originRun[4] === 1);
check("'origin' is symmetric about the anchor",
  Math.abs(originRun[1] - originRun[3]) < 1e-12);

// Same radius by a long way round == same density. Path length cannot say that.
const direct = walk([[100, 100], [124, 100]], 'origin');
const scenic = walk([[100, 100], [100, 60], [140, 60], [124, 100]], 'origin');
check("'origin' ignores how you got there, only where you are",
  Math.abs(direct[direct.length - 1] - scenic[scenic.length - 1]) < 1e-12,
  `${direct[direct.length - 1]} vs ${scenic[scenic.length - 1]}`);

// Circling the anchor holds one density — the radial falloff, visibly.
const ring = [];
for (let a = 0; a < 8; a++) {
  ring.push([100 + Math.round(20 * Math.cos(a * Math.PI / 4)),
             100 + Math.round(20 * Math.sin(a * Math.PI / 4))]);
}
const ringRun = walk([[100, 100], ...ring], 'origin').slice(1);
const spread = Math.max(...ringRun) - Math.min(...ringRun);
check("'origin' holds its density around a circle on the anchor", spread < 0.05,
  `spread ${spread.toFixed(3)}`);

check('resetStroke forgets the anchor', (() => {
  fade.measureFrom = 'origin';
  walk([[10, 10], [60, 10]], 'origin');
  fade.resetStroke();
  return fade._originX === null && fade._originY === null;
})());

check('an unknown measure id is ignored', (() => {
  fade.setMeasureFrom('origin');
  fade.setMeasureFrom('sideways');
  return fade.measureFrom === 'origin';
})());

// Distance from the click point, not path length: the reversible one, so a
// fade can be drawn back into instead of being spent by a wandering hand.
check('the default measure is distance from the start point',
  new FadeBrush().measureFrom === 'origin');

fade.measureFrom = 'travel';

summary();
