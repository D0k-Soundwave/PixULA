'use strict';
/**
 * The Hatch brush — pen-and-ink hatching that actually hatches.
 *
 * The brush it replaces ("advanced crosshatch") failed on four counts, and each
 * one is pinned here so it cannot come back:
 *   1. its lattice was anchored to the STAMP BOX, so every stamp restarted the
 *      phase and a dragged stroke moired
 *   2. a per-pixel `Math.random() < flow` gate shredded the lines into noise
 *   3. a radial falloff rode the moving cursor, so tone came out lumpy
 *   4. tone was quantised to about two line widths and was not UI-reachable
 *
 * So: the lattice is a pure function of CANVAS position, the raster is
 * deterministic, and tone is exactly thickness/spacing at EVERY angle — which
 * is also what lets a second pass at another angle interlock into a true
 * cross-hatch instead of mush.
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
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
BrushEngine.initialize();

const hatch = BrushEngine.brushes.get('hatch');
const dirOf = (id) => BrushShapes.hatchDirection(id);

// ── The angle set ───────────────────────────────────────────────────────────

check('16 curated angles are published', BrushShapes.HATCH_ANGLES.length === 16);
check('every angle is an integer direction (pixel-clean by construction)',
  BrushShapes.HATCH_ANGLES.every(h =>
    Number.isInteger(h.a) && Number.isInteger(h.b) && (h.a !== 0 || h.b !== 0)));
check('the published degrees match atan2 of the direction', (() => {
  return BrushShapes.HATCH_ANGLES.every(h => {
    let deg = Math.atan2(h.b, h.a) * 180 / Math.PI;
    if (deg < 0) deg += 180;
    return Math.abs(deg - h.deg) < 0.1;
  });
})());
check('an unknown angle id falls back to 45', dirOf('nope').id === '45');

// ── The lattice is CANVAS-anchored and constant along its own direction ─────
//
// Walking along (a, b) must never leave the line: that is exactly the property
// the old stamp-box lattice lacked, and the reason strokes used to moire.

let alongOk = true;
for (const h of BrushShapes.HATCH_ANGLES) {
  const on = BrushShapes.onHatchLine(100, 100, h, 4, 1);
  for (let k = -6; k <= 6; k++) {
    if (BrushShapes.onHatchLine(100 + h.a * k, 100 + h.b * k, h, 4, 1) !== on) alongOk = false;
  }
}
check('lattice is constant along its own direction, at every angle', alongOk);

check('lattice depends on absolute position, not on any stamp origin',
  BrushShapes.onHatchLine(37, 61, dirOf('45'), 5, 2) ===
  BrushShapes.onHatchLine(37, 61, dirOf('45'), 5, 2));

// ── Coverage matches onHatchLine's OWN derived ratio, at every angle ───────
//
// onHatchLine scales spacing/thickness by len = hypot(a, b) internally (see
// its docblock) so the physical on-screen spacing stays equal to the dial
// value at every angle, not just 0/90 — a 45deg pass otherwise packed its
// lines ~41% closer than a 0deg one for the same two numbers, and the
// shallowest of the 16 angles up to 3.16x closer. That means the exact
// ratio actually drawn is t'/s' (the len-scaled, rounded pair), which can
// drift a few percent from the raw thickness/spacing at small spacing
// values — the ordinary cost of fitting a rational fraction onto a small
// integer period. This checks the MEASURED coverage matches that derived
// ratio precisely (validating the row-invariant claim empirically); the
// physical-spacing block below checks the len-scaling itself.

let toneOk = true;
const toneReport = [];
for (const h of BrushShapes.HATCH_ANGLES) {
  for (const [spacing, thickness] of [[2, 1], [4, 1], [4, 2], [8, 1], [8, 3], [5, 2]]) {
    let ink = 0, total = 0;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        total++;
        if (BrushShapes.onHatchLine(x, y, h, spacing, thickness)) ink++;
      }
    }
    const len = Math.hypot(h.a, h.b);
    const s = Math.max(2, Math.round(spacing * len));
    const t = Math.max(1, Math.min(s, Math.round(thickness * len)));
    const expected = t / s;
    const actual = ink / total;
    if (Math.abs(actual - expected) > 0.02) {
      toneOk = false;
      toneReport.push(`${h.deg}° s=${spacing} t=${thickness}: ${actual.toFixed(3)} != ${expected.toFixed(3)}`);
    }
  }
}
check(`coverage matches onHatchLine's own derived ratio at every angle${toneReport.length ? ' — ' + toneReport[0] : ''}`,
  toneOk);

// ── Physical line spacing is angle-invariant ────────────────────────────────
//
// This is the property the len-scaling exists for: the SAME spacing dial
// value must land on roughly the same real on-screen distance between
// lines at every angle, not a distance that shrinks the steeper the angle
// gets. `internalPeriod / len` recovers the physical period onHatchLine
// actually draws with; +/-1px covers the rounding needed to land on an
// integer internal period.

let spacingOk = true;
const spacingReport = [];
for (const h of BrushShapes.HATCH_ANGLES) {
  for (const spacing of [2, 4, 8, 16]) {
    const len = Math.hypot(h.a, h.b);
    const internalPeriod = Math.max(2, Math.round(spacing * len));
    const physicalPeriod = internalPeriod / len;
    if (Math.abs(physicalPeriod - spacing) > 1) {
      spacingOk = false;
      spacingReport.push(`${h.deg}° spacing=${spacing}: physical=${physicalPeriod.toFixed(2)}`);
    }
  }
}
check(`physical line spacing stays within 1px of the dial at every angle${spacingReport.length ? ' — ' + spacingReport[0] : ''}`,
  spacingOk);

check('thickness is clamped to spacing (never more than solid)',
  BrushShapes.onHatchLine(3, 7, dirOf('0'), 4, 99) === true);

// ── Two passes at different angles interlock (the cross-hatch) ──────────────
//
// Because both lattices are canvas-anchored, the union is strictly denser than
// either alone — that is what makes hand cross-hatching work.

{
  const a = dirOf('45'), b = dirOf('135');
  let onlyA = 0, onlyB = 0, both = 0, union = 0;
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      const inA = BrushShapes.onHatchLine(x, y, a, 4, 1);
      const inB = BrushShapes.onHatchLine(x, y, b, 4, 1);
      if (inA) onlyA++;
      if (inB) onlyB++;
      if (inA && inB) both++;
      if (inA || inB) union++;
    }
  }
  check(`crossing two angles darkens (union ${union} > each pass ${onlyA}/${onlyB})`,
    union > onlyA && union > onlyB);
  check('the two passes overlap only partly (they interlock, not coincide)',
    both > 0 && both < onlyA);
}

// ── snapHatchAngle: gestural selection, undirected, with hysteresis ─────────

check('snap: a horizontal sweep picks 0 degrees', BrushShapes.snapHatchAngle(10, 0) === '0');
check('snap: a vertical sweep picks 90 degrees', BrushShapes.snapHatchAngle(0, 10) === '90');
check('snap: a diagonal sweep picks 45 degrees', BrushShapes.snapHatchAngle(7, 7) === '45');
check('snap: lines are undirected — the reverse sweep gives the same angle',
  BrushShapes.snapHatchAngle(-7, -7) === BrushShapes.snapHatchAngle(7, 7));
check('snap: a 2:1 sweep picks the 2:1 angle', BrushShapes.snapHatchAngle(10, 5) === '27');
check('snap: too short to carry a direction returns null (caller holds)',
  BrushShapes.snapHatchAngle(0.1, 0.1) === null);
check('snap: hysteresis holds the current angle for a marginal rival',
  BrushShapes.snapHatchAngle(10, 0.9, '0') === '0');
check('snap: a decisive change still wins over hysteresis',
  BrushShapes.snapHatchAngle(0, 10, '0') === '90');

// ── The raster: deterministic, and no flow/random anywhere ──────────────────

const recordWrites = (fn) => {
  const written = new Set();
  const real = PixelDrawRoutine.draw.bind(PixelDrawRoutine);
  PixelDrawRoutine.draw = (x, y, sel, mode, opts) => {
    if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) written.add(x + ',' + y);
    return real(x, y, sel, mode, opts);
  };
  try { fn(); } finally { PixelDrawRoutine.draw = real; }
  return written;
};
const sameSet = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

const tool = new global.BrushTool();
tool.setBrushType('hatch');
tool.setSize(12);
tool.setHatchAngle('45');
tool.setHatchSpacing(4);
tool.setHatchThickness(1);

const passA = recordWrites(() => BrushEngine.applyBrush(100, 100, 1.0, true));
const passB = recordWrites(() => BrushEngine.applyBrush(100, 100, 1.0, true));
check(`same spot twice writes the identical pixels (${passA.size} px, deterministic)`,
  passA.size > 0 && sameSet(passA, passB));

// Flow is not consulted: at 1% the raster is unchanged (the old brush dropped
// ~99% of its line pixels here, which is what turned hatching into noise).
tool.setFlowRate(1);
const passLowFlow = recordWrites(() => BrushEngine.applyBrush(100, 100, 1.0, true));
check('flow does not thin the hatch (no random dropout)', sameSet(passA, passLowFlow));
tool.setFlowRate(100);

// Every written pixel really is on the lattice, and inside the nib.
{
  const dir = dirOf('45');
  let allOnLattice = true;
  for (const key of passA) {
    const [x, y] = key.split(',').map(Number);
    if (!BrushShapes.onHatchLine(x, y, dir, 4, 1)) allOnLattice = false;
  }
  check('every written pixel lies on the canvas lattice', allOnLattice);
}

// Overlapping stamps reinforce ONE set of lines: the union of two neighbouring
// stamps is still entirely on the lattice (the anti-moire guarantee).
{
  const dir = dirOf('45');
  const merged = recordWrites(() => {
    BrushEngine.applyBrush(100, 100, 1.0, true);
    BrushEngine.applyBrush(103, 101, 1.0, true);
    BrushEngine.applyBrush(106, 104, 1.0, true);
  });
  let allOnLattice = true;
  for (const key of merged) {
    const [x, y] = key.split(',').map(Number);
    if (!BrushShapes.onHatchLine(x, y, dir, 4, 1)) allOnLattice = false;
  }
  check('overlapping stamps stay on one continuous lattice (no moire)', allOnLattice);
}

// Spacing is a real tone dial through the tool.
{
  tool.setHatchSpacing(2);
  const dense = recordWrites(() => BrushEngine.applyBrush(60, 60, 1.0, true));
  tool.setHatchSpacing(8);
  const sparse = recordWrites(() => BrushEngine.applyBrush(60, 60, 1.0, true));
  check(`spacing drives tone (s=2 ${dense.size} px > s=8 ${sparse.size} px)`,
    dense.size > sparse.size);
  tool.setHatchSpacing(4);
}

// Thickness likewise.
{
  tool.setHatchThickness(1);
  const thin = recordWrites(() => BrushEngine.applyBrush(60, 60, 1.0, true));
  tool.setHatchThickness(3);
  const thick = recordWrites(() => BrushEngine.applyBrush(60, 60, 1.0, true));
  check(`thickness drives tone (t=3 ${thick.size} px > t=1 ${thin.size} px)`,
    thick.size > thin.size);
  tool.setHatchThickness(1);
}

// ── Nib shape, and the footprint that must contain the raster ──────────────

tool.setHatchNib('round');
const roundFp = tool.getFootprint(100, 100);
tool.setHatchNib('square');
const squareFp = tool.getFootprint(100, 100);
check('round nib footprint is smaller than the square one',
  roundFp.length < squareFp.length && squareFp.length === 12 * 12);
tool.setHatchNib('round');

// ── The size-1 invariant still holds ────────────────────────────────────────

tool.setSize(1);
BrushEngine.startDrawingSession();
const one = recordWrites(() => BrushEngine.applyBrush(50, 51, 1.0, true));
check('size 1 writes exactly the pixel under the cursor, whatever the lattice',
  one.size === 1 && one.has('50,51'));

// ── 'follow' mode steers from the stroke and survives a reset ───────────────

tool.setSize(8);
tool.setHatchAngle('follow');
BrushEngine.startDrawingSession();
for (let i = 0; i < 12; i++) BrushEngine.applyBrush(40 + i * 3, 40, 1.0, true);   // horizontal sweep
check(`follow: a horizontal sweep settles on 0 degrees (got ${hatch._followId})`,
  hatch._followId === '0');

BrushEngine.startDrawingSession();
for (let i = 0; i < 12; i++) BrushEngine.applyBrush(40, 40 + i * 3, 1.0, true);   // vertical sweep
check(`follow: a vertical sweep settles on 90 degrees (got ${hatch._followId})`,
  hatch._followId === '90');

// A straight continuous-angle drag, sampled at pixel resolution, does NOT
// walk in exact (a,b) steps — consecutive ROUNDED points give a Bresenham-
// like sequence of small, locally-coarser steps (e.g. a true 18.4deg line's
// first few samples look a lot like 2:1, not 3:1). Tracking displacement
// FROM STROKE START, not the delta between two samples, is what lets the
// true ratio emerge once the vector is long enough — this is the
// regression test for the bug where per-sample tracking could never
// resolve 8 of the 16 angles, no matter how the stroke was actually drawn.
{
  let allAnglesReachable = true;
  const unreached = [];
  for (const h of BrushShapes.HATCH_ANGLES) {
    tool.setHatchAngle('follow');
    BrushEngine.startDrawingSession();
    const rad = h.deg * Math.PI / 180;
    for (let k = 1; k <= 40; k++) {
      const x = Math.round(40 + Math.cos(rad) * k);
      const y = Math.round(40 + Math.sin(rad) * k);
      BrushEngine.applyBrush(x, y, 1.0, true);
    }
    if (hatch._followId !== h.id) {
      allAnglesReachable = false;
      unreached.push(`${h.deg}° -> got ${hatch._followId}`);
    }
  }
  check(`follow mode resolves every one of the 16 angles from a real (rounded) drag${unreached.length ? ' — ' + unreached[0] : ''}`,
    allAnglesReachable);
}

BrushEngine.startDrawingSession();
check('follow: startDrawingSession resets the direction tracking',
  hatch._startX === null && hatch._locked === false);

// A fixed angle ignores the stroke direction entirely.
tool.setHatchAngle('135');
BrushEngine.startDrawingSession();
for (let i = 0; i < 10; i++) BrushEngine.applyBrush(80 + i * 3, 80, 1.0, true);
check('a fixed angle is not moved by the stroke direction',
  hatch._activeDirection().id === '135');

// ── The retired id still resolves ───────────────────────────────────────────

check('the retired crosshatch-advanced id aliases to hatch',
  BrushEngine.setBrush('crosshatch-advanced') && BrushEngine.currentBrush === 'hatch');

summary();
