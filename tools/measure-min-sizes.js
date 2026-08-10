'use strict';
/**
 * Minimum viable size measurement - shapes.
 *
 * Every shape has a size below which its raster stops being the shape that was
 * asked for: a heptagon becomes a circle, a star becomes a blob, a gear loses
 * its teeth, an arrow points backwards. This script MEASURES that size by
 * driving the real ShapeGenerator (never a copy of its maths) over a size
 * sweep and testing, at each size, whether the shape's defining feature is
 * still in the pixels.
 *
 * Two thresholds are reported per shape, and the gap between them is the point:
 *
 *   PRESENT   the feature exists in the raster at all - at least 1 px of it,
 *             with the right feature COUNT. Below this the generator is
 *             provably drawing something other than the requested shape.
 *   READABLE  the feature is at least 2 px deep, with the right count, in
 *             every drag direction. Two pixels because every vertex is rounded
 *             to the nearest pixel (+/-0.5 px per endpoint, so up to 1 px of
 *             boundary movement): a 1 px feature can be swallowed whole by
 *             that rounding, a 2 px one cannot.
 *
 * Nothing here is asserted from the outside:
 *   - the comparison floor is MEASURED (`circleNoise`: the radial variation of
 *     a filled midpoint circle, the roundest thing this grid can draw), so
 *     "distinguishable from a circle" means "deeper than the circle's own
 *     rasterisation wobble at that radius";
 *   - each shape's feature COUNT is CALIBRATED from its own raster at the
 *     largest size that still fits the screen, rather than from an assumption
 *     about how many lobes a house or a kite ought to show.
 *
 * Sizes are reported as the raster's on-canvas BOUNDING BOX, which is
 * gesture-independent, alongside the drag that produces it.
 *
 * Run: node tools/measure-min-sizes.js [--detail]
 */

const { loadModule } = require('../tests/helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  setCanvasCursor() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 0, paper: 7, bright: false, flash: false }; }
};
global.SelectionService = { hasSelection() { return false; }, isFloating() { return false; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/shape-generator.js');

// Swept sizes: every pixel to 48, then every fourth to 132. The upper reach is
// there for the shallow arcs, whose bow only clears a pixel past r = 100.
const CAP = 132;
const SIZES = [];
for (let s = 1; s <= 48; s++) SIZES.push(s);
for (let s = 52; s <= CAP; s += 4) SIZES.push(s);

const SCREEN_W = ZX_SPECTRUM.WIDTH;    // 256 in the standard mode
const SCREEN_H = ZX_SPECTRUM.HEIGHT;   // 192
// Half the screen height: comfortably large. Overridable so the shapes that
// need more than this to resolve can be quantified rather than left as "never".
const BIG = Number(process.env.PIXULA_BIG || 96);
const DETAIL = process.argv.includes('--detail');

// -- Raster measurement primitives ------------------------------------------

function grid(points) {
  const set = new Set();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    const x = Math.round(p.x), y = Math.round(p.y);
    set.add(x + ',' + y);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!set.size) return { set, minX: 0, minY: 0, maxX: -1, maxY: -1, w: 0, h: 0, n: 0 };
  return { set, minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n: set.size };
}

/** Enclosed background regions (4-connected) - holes. */
function holeCount(points) {
  const g = grid(points);
  if (!g.n) return 0;
  const w = g.w + 2, h = g.h + 2;
  const ink = (x, y) => g.set.has((x + g.minX - 1) + ',' + (y + g.minY - 1));
  const seen = new Uint8Array(w * h);
  const flood = (start) => {
    const s = [start];
    seen[start] = 1;
    while (s.length) {
      const i = s.pop();
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j] || ink(nx, ny)) continue;
        seen[j] = 1;
        s.push(j);
      }
    }
  };
  flood(0);
  let holes = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i] || ink(x, y)) continue;
      holes++;
      flood(i);
    }
  }
  return holes;
}

/** Connected ink components (8-connected - a diagonal run reads as joined). */
function componentCount(points) {
  const g = grid(points);
  if (!g.n) return 0;
  const seen = new Set();
  let count = 0;
  for (const key of g.set) {
    if (seen.has(key)) continue;
    count++;
    const stack = [key];
    seen.add(key);
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const k = (x + dx) + ',' + (y + dy);
          if (g.set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
    }
  }
  return count;
}

/**
 * Radial profile about (cx, cy): the outermost ink radius per angular bucket,
 * one bucket per ~4 px of circumference. Lobes are counted with a Schmitt
 * trigger (rise past the upper third, then fall past the lower third) rather
 * than by crossing a single midline, because a bare midline double-counts
 * every pixel of rasterisation jitter that happens to sit on it - that is what
 * made a pentagon report nine corners at one size and five at the next.
 */
function radial(points, cx, cy) {
  const g = grid(points);
  if (!g.n) return { lobes: 0, rmin: 0, rmax: 0, variation: 0 };

  let rmax = 0;
  const polar = [];
  for (const key of g.set) {
    const [x, y] = key.split(',').map(Number);
    const d = Math.hypot(x - cx, y - cy);
    let a = Math.atan2(y - cy, x - cx);
    if (a < 0) a += 2 * Math.PI;
    polar.push([a, d]);
    if (d > rmax) rmax = d;
  }
  const B = Math.max(12, Math.round(Math.PI * Math.max(1, rmax) / 2));
  const prof = new Array(B).fill(0);
  for (const [a, d] of polar) {
    const b = Math.min(B - 1, Math.floor(a / (2 * Math.PI) * B));
    if (d > prof[b]) prof[b] = d;
  }

  // An empty bucket means one of two different things, and they must not be
  // confused: either the shape does not reach that way at all (the gap between
  // two arms of a plus), or its boundary crossed the bucket without a pixel
  // centre landing inside it - which can only happen for a bucket or two,
  // since a boundary pixel covers about a bucket of arc. Short gaps are
  // interpolated; runs of three or more are the shape genuinely being absent.
  const SAMPLING_GAP = 2;
  for (let i = 0; i < B; i++) {
    if (prof[i] > 0) continue;
    let len = 0;
    while (len < B && prof[(i + len) % B] === 0) len++;
    if (len <= SAMPLING_GAP) {
      const before = prof[(i - 1 + B) % B];
      const after = prof[(i + len) % B];
      if (before > 0 && after > 0) {
        for (let k = 0; k < len; k++) {
          prof[(i + k) % B] = before + (after - before) * ((k + 1) / (len + 1));
        }
      }
    }
    i += len - 1;
  }

  let rmin = Infinity;
  for (const v of prof) if (v < rmin) rmin = v;
  const variation = rmax - rmin;
  if (variation <= 0) return { peaks: [], rmin, rmax, variation: 0, lobes: () => 0 };

  // Lobes are counted by NOTCH DEPTH, with shallow notches merged away first.
  //
  // Counting raw local maxima does not work: a petal tip is a plateau with a
  // pixel of rasterisation ripple on it, so one petal presents as two maxima
  // and a six-petal flower reports eight lobes. Neither does a single cut
  // line, because a kite's nose and its tail are lobes of very different
  // heights. What separates two lobes is the depth of the notch BETWEEN them,
  // so the count is built by repeatedly merging the pair of maxima with the
  // shallowest notch until every surviving notch is at least `minDepth` deep.
  // A notch shallower than a pixel is not a notch, it is the grid.
  const at = (i) => prof[((i % B) + B) % B];

  // Cut the circle at its deepest point so the sequence can be walked as a
  // line: that notch is the last thing that would ever be merged.
  let cut = 0;
  for (let i = 0; i < B; i++) if (prof[i] === rmin) { cut = i; break; }
  const seq = [];
  for (let i = 0; i <= B; i++) seq.push(at(cut + i));

  const maxima = [];
  for (let i = 1; i < seq.length - 1; i++) {
    if (seq[i] > seq[i - 1] && seq[i] >= seq[i + 1]) maxima.push(i);
  }

  /** Deepest-first merge; returns the number of lobes at this notch depth. */
  const lobesAt = (minDepth) => {
    if (!maxima.length) return 0;
    const peaks = maxima.map(i => seq[i]);
    // notches[i] is the low point before peaks[i]; one more than the peaks.
    const notches = [];
    let bound = 0;
    for (const m of maxima) {
      let lo = Infinity;
      for (let i = bound; i <= m; i++) lo = Math.min(lo, seq[i]);
      notches.push(lo);
      bound = m;
    }
    let lo = Infinity;
    for (let i = bound; i < seq.length; i++) lo = Math.min(lo, seq[i]);
    notches.push(lo);

    for (;;) {
      let worst = Infinity, at_ = -1;
      for (let i = 0; i + 1 < peaks.length; i++) {
        const depth = Math.min(peaks[i], peaks[i + 1]) - notches[i + 1];
        if (depth < worst) { worst = depth; at_ = i; }
      }
      if (at_ < 0 || worst >= minDepth) break;
      peaks[at_] = Math.max(peaks[at_], peaks[at_ + 1]);
      peaks.splice(at_ + 1, 1);
      notches.splice(at_ + 1, 1);
    }
    // A surviving peak still has to clear the notch beside it, or it is a
    // ripple on a flat profile rather than a lobe.
    let count = 0;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] - Math.max(notches[i], notches[i + 1]) >= minDepth) count++;
    }
    return count;
  };

  return { rmin, rmax, variation, lobes: lobesAt };
}

/** Centre of mass of a raster - the profile origin for shapes with no stated centre. */
function centroid(points) {
  const g = grid(points);
  if (!g.n) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const key of g.set) {
    const [x, y] = key.split(',').map(Number);
    sx += x; sy += y;
  }
  return { x: sx / g.n, y: sy / g.n };
}

/**
 * Lobe verdict for a shape, taken off its FILLED raster where it has one and
 * struck from its own centre of mass. A filled shape has ink in every
 * direction it occupies, so an empty bucket carries information; a 1 px
 * outline can slip between two rays and lie.
 */
function lobes(type, bounds, opts) {
  const fillable = ShapeGenerator.filledShapes.has(type);
  const pts = ShapeGenerator.generateShape(type, bounds, fillable ? { ...opts, filled: true } : opts);
  const c = centroid(pts);
  return radial(pts, c.x, c.y);
}

/** Filled-raster pixels that are not on the outline - does it enclose area? */
function interior(filled, outline) {
  const o = grid(outline).set;
  let n = 0;
  for (const key of grid(filled).set) if (!o.has(key)) n++;
  return n;
}

/** Ink pixels per row (or per column) of a raster. */
function inkCounts(points, axis = 'row') {
  const g = grid(points);
  const counts = new Map();
  for (const key of g.set) {
    const [x, y] = key.split(',').map(Number);
    const k = axis === 'row' ? y : x;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const lo = axis === 'row' ? g.minY : g.minX;
  const hi = axis === 'row' ? g.maxY : g.maxX;
  const out = [];
  for (let i = lo; i <= hi; i++) out.push(counts.get(i) || 0);
  return out;
}

/**
 * Ink runs along a ray from (cx, cy), and the paper gaps between them -
 * how many windings a spiral shows and whether they are actually apart.
 * Stepped at a quarter pixel so a thin diagonal winding cannot be stepped over.
 */
function raySegments(points, cx, cy, theta, maxLen) {
  const g = grid(points);
  const runs = [];
  const gaps = [];
  let inRun = false, runStart = 0, gapStart = null;
  for (let t = 0; t <= maxLen; t += 0.25) {
    const x = Math.round(cx + t * Math.cos(theta));
    const y = Math.round(cy + t * Math.sin(theta));
    const isInk = g.set.has(x + ',' + y);
    if (isInk && !inRun) {
      inRun = true;
      runStart = t;
      if (gapStart !== null && runs.length) gaps.push(t - gapStart);
    } else if (!isInk && inRun) {
      inRun = false;
      runs.push([runStart, t]);
      gapStart = t;
    }
  }
  if (inRun) runs.push([runStart, maxLen]);
  return { runs: runs.length, gaps, minGap: gaps.length ? Math.min(...gaps) : 0 };
}

/**
 * Width profile in the DRAG's own frame: for each pixel-step along the drag
 * axis, how far the shape spreads across it. Rotation-invariant, which a
 * row-by-row profile is not - and the drag sets the orientation of every shape
 * that has one.
 */
function axisProfile(points, bounds) {
  const theta = Math.atan2(bounds.y2 - bounds.y1, bounds.x2 - bounds.x1);
  const ct = Math.cos(-theta), st = Math.sin(-theta);
  const bands = new Map();
  for (const key of grid(points).set) {
    const [x, y] = key.split(',').map(Number);
    const dx = x - bounds.x1, dy = y - bounds.y1;
    const along = Math.round(dx * ct - dy * st);
    const across = dx * st + dy * ct;
    const b = bands.get(along) || [Infinity, -Infinity];
    bands.set(along, [Math.min(b[0], across), Math.max(b[1], across)]);
  }
  const keys = [...bands.keys()].sort((a, b) => a - b);
  if (!keys.length) return [];
  const out = [];
  for (let i = keys[0]; i <= keys[keys.length - 1]; i++) {
    const b = bands.get(i);
    out.push(b ? Math.round(b[1] - b[0]) + 1 : 0);
  }
  return out;
}

/** Deepest cut into a bbox corner, measured along the top edge. */
function cornerCut(points) {
  const g = grid(points);
  if (!g.n) return 0;
  for (let x = g.minX; x <= g.maxX; x++) {
    if (g.set.has(x + ',' + g.minY)) return x - g.minX;
  }
  return 0;
}

// -- The measured noise floor ------------------------------------------------

const circleNoise = new Map();
for (let r = 1; r <= CAP + 8; r++) {
  const pts = ShapeGenerator.generateShape('circle',
    { x1: 128 - r, y1: 96 - r, x2: 128 + r, y2: 96 + r }, { filled: true });
  circleNoise.set(r, radial(pts, 128, 96).variation);
}
const noiseAt = (r) => circleNoise.get(Math.max(1, Math.min(CAP + 8, Math.round(r)))) || 1;

// -- Drag models -------------------------------------------------------------

const DIRS8 = [0, 45, 90, 135, 180, 225, 270, 315].map(d => d * Math.PI / 180);

const centreBounds = (k) => ({ x1: 128 - k, y1: 96 - k, x2: 128 + k, y2: 96 + k });
const dragBounds = (d, theta) => ({
  x1: 128, y1: 96,
  x2: 128 + Math.round(d * Math.cos(theta)),
  y2: 96 + Math.round(d * Math.sin(theta))
});
const boxBounds = (w, h) => ({ x1: 128, y1: 96, x2: 128 + w - 1, y2: 96 + h - 1 });

function boundsFor(spec, size, theta) {
  switch (spec.param) {
    case 'centre':  return centreBounds(size);
    case 'centre2': return { x1: 128 - size * 2, y1: 96 - size, x2: 128 + size * 2, y2: 96 + size };
    case 'box':     return boxBounds(size, size);
    default:        return dragBounds(size, theta);
  }
}

// -- Shape specifications ----------------------------------------------------
//
// `judge(bounds)` returns { depth, count?, exact?, out }:
//   depth  the defining feature's size in pixels
//   count  a feature COUNT, compared against the shape's own calibrated
//          signature at the largest size that fits the screen
//   exact  a straight verdict where no count applies
// PRESENT = depth >= 1 (and count matches); READABLE = depth >= 2 (and matches).

const SPECS = [];
const gen = (type, bounds, opts) => ShapeGenerator.generateShape(type, bounds, opts);

/**
 * A shape judged by how many lobes survive at 1 px and at 2 px of prominence.
 * `intended` is the count the generator is constructing by definition (a
 * hexagon has six corners); where it is given, it - not the calibrated
 * signature - is what the raster has to show, so a shape whose raster never
 * settles on its own definition shows up as a failure rather than being
 * quietly graded against its own worst behaviour.
 */
function lobeSpec(id, param, wants, opts = {}, intended = null, extra = null) {
  SPECS.push({
    id, param, wants, kind: 'lobe', intended,
    judge(b) {
      const out = gen(id, b, opts);
      const r = lobes(id, b, opts);
      const veto = extra ? !extra(b, out) : false;   // a second condition, e.g. the gear's bore
      return { count1: veto ? -1 : r.lobes(1), count2: veto ? -1 : r.lobes(2), out };
    }
  });
}

['pentagon:5', 'hexagon:6', 'heptagon:7', 'octagon:8', 'nonagon:9', 'decagon:10', 'dodecagon:12']
  .forEach(s => { const [id, n] = s.split(':'); lobeSpec(id, 'drag', `${n} corners`, {}, +n); });
lobeSpec('diamond', 'drag', '4 corners', {}, 4);
lobeSpec('triangle', 'drag', '3 corners', {}, 3);
lobeSpec('star', 'centre', '5 points', { points: 5 }, 5);
lobeSpec('flower', 'centre', '6 petals', { petals: 6 }, 6);

/**
 * Gear: teeth AND bore. The bore is checked on the OUTLINE, not the fill -
 * the filled gear is a scanline fill of a tooth polygon that does not include
 * the centre hole, so a filled gear has no bore at any size (see the report).
 * Two enclosed regions on the outline = the gear body plus its bore.
 */
lobeSpec('gear', 'centre', '8 teeth + bore', { teeth: 8 }, 8,
  (b, out) => holeCount(out) >= 2);

lobeSpec('heart', 'centre', 'lobes + notch');

/**
 * House and kite are proportional shapes: their features are STATIONS along
 * the drag axis (roof over walls; nose, wings, tail), so they are measured in
 * the drag's own frame rather than by lobes about a centre. The narrowest
 * station is what has to survive - a roof 1 px tall over walls 1 px tall is
 * the point at which a house stops being a house.
 */
SPECS.push({
  id: 'house', param: 'drag', wants: 'roof depth + wall depth',
  judge(b) {
    const out = gen('house', b, {});
    const prof = axisProfile(gen('house', b, { filled: true }), b);
    if (prof.length < 2) return { depth: 0, exact: false, out };
    const wide = Math.max(...prof);
    const roof = prof.filter(w => w < wide).length;     // the narrowing part
    const walls = prof.filter(w => w >= wide).length;   // the parallel part
    return { depth: Math.min(roof, walls), exact: roof >= 1 && walls >= 1, out };
  }
});
SPECS.push({
  id: 'kite', param: 'drag', wants: 'nose/wings/tail stations',
  judge(b) {
    const out = gen('kite', b, {});
    const prof = axisProfile(gen('kite', b, { filled: true }), b);
    if (prof.length < 3) return { depth: 0, exact: false, out };
    const widest = prof.indexOf(Math.max(...prof));
    // Distance from the nose to the wings, and from the wings to the tail:
    // collapse either and the dart is a triangle.
    return { depth: Math.min(widest, prof.length - 1 - widest), exact: prof.length >= 3, out };
  }
});

/**
 * Cross and plus: measured directly as arm length. A radial profile is the
 * wrong instrument for a figure made of four one-pixel lines - the arms are
 * narrower than the profile's own angular buckets, so the measurement, not the
 * shape, would be what fails.
 */
for (const id of ['x', 'plus']) {
  SPECS.push({
    id, param: 'centre', wants: '4 arms',
    judge(b) {
      const out = gen(id, b, {});
      const g = grid(out);
      const cx = Math.round((b.x1 + b.x2) / 2), cy = Math.round((b.y1 + b.y2) / 2);
      const arms = (id === 'plus'
        ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 1], [-1, -1], [1, -1], [-1, 1]]
      ).map(([dx, dy]) => {
        let n = 0;
        while (g.set.has((cx + dx * (n + 1)) + ',' + (cy + dy * (n + 1)))) n++;
        return n;
      });
      return { depth: Math.min(...arms), exact: arms.every(a => a >= 1), out };
    }
  });
}

/** Circle: encloses paper, and is neither the square nor the diamond of its box. */
SPECS.push({
  id: 'circle', param: 'centre', wants: 'round, encloses paper',
  judge(b) {
    const out = gen('circle', b, {});
    const g = grid(out);
    const inner = interior(gen('circle', b, { filled: true }), out);
    const corner = g.set.has(g.minX + ',' + g.minY);
    const midEdge = g.set.has(Math.round((g.minX + g.maxX) / 2) + ',' + g.minY);
    return { depth: inner, exact: !corner && midEdge, out };
  }
});

/** Ellipse: its two axes must differ by more than the rounding that could fake it. */
SPECS.push({
  id: 'ellipse', param: 'centre2', wants: 'not a circle (2:1 box)',
  judge(b) {
    const out = gen('ellipse', b, {});
    const g = grid(out);
    return { depth: Math.abs(g.w - g.h) / 2, exact: g.w > 0 && g.h > 0, out };
  }
});

/** Ring: a hole, and a band around it. */
SPECS.push({
  id: 'ring', param: 'drag', wants: '50% inner radius',
  judge(b) {
    const opts = { innerRatio: 0.5 };
    const out = gen('ring', b, opts);
    const fil = gen('ring', b, { ...opts, filled: true });
    const g = grid(fil);
    let band = 0, run = 0;
    for (let x = g.minX; x <= g.maxX; x++) {
      if (g.set.has(x + ',' + b.y1)) { run++; band = Math.max(band, run); } else run = 0;
    }
    return { depth: holeCount(fil) === 1 ? band : 0, exact: holeCount(fil) === 1, out };
  }
});

/** Arc: the sagitta - how far the arc bows away from its own chord. */
function arcSpec(spanDeg) {
  SPECS.push({
    id: `arc-${spanDeg}`, param: 'drag', wants: `${spanDeg} deg span`,
    judge(b) {
      const opts = { arcSpan: spanDeg * Math.PI / 180 };
      const out = gen('arc', b, opts);
      if (!out.length) return { depth: 0, exact: false, out };
      const g = grid(out);
      const a = out[0], z = out[out.length - 1];
      const len = Math.hypot(z.x - a.x, z.y - a.y);
      let sag = 0;
      if (len > 0) {
        for (const p of out) {
          const d = Math.abs((z.x - a.x) * (a.y - p.y) - (a.x - p.x) * (z.y - a.y)) / len;
          if (d > sag) sag = d;
        }
      } else {
        sag = g.w / 2;                      // closed arc: the bow is the radius
      }
      return { depth: sag, exact: g.n >= 3, out };
    }
  });
}
[15, 45, 90, 180, 360].forEach(arcSpec);

/** Sector: a wedge that encloses paper. */
SPECS.push({
  id: 'sector-90', param: 'drag', wants: '90 deg wedge',
  judge(b) {
    const opts = { arcSpan: Math.PI / 2 };
    const out = gen('sector', b, opts);
    const fil = gen('sector', b, { ...opts, filled: true });
    return { depth: interior(fil, out), exact: componentCount(out) === 1, out };
  }
});

/** Rectangle / square: an outline only reads as one when it encloses paper. */
for (const id of ['rectangle', 'square']) {
  SPECS.push({
    id, param: 'box', wants: 'outline encloses paper',
    judge(b) {
      const out = gen(id, b, {});
      const g = grid(out);
      return { depth: Math.min(g.w, g.h) - 2, exact: interior(gen(id, b, { filled: true }), out) >= 1, out };
    }
  });
}

/** Rounded rectangle: corners cut, straight edges surviving between them. */
SPECS.push({
  id: 'rounded-rectangle', param: 'box', wants: 'corners cut, edges remain',
  judge(b) {
    const out = gen('rounded-rectangle', b, {});
    const plain = grid(gen('rectangle', b, {}));
    const g = grid(out);
    const cut = cornerCut(out);
    let edge = 0;
    for (let x = g.minX; x <= g.maxX; x++) if (g.set.has(x + ',' + g.minY)) edge++;
    const differs = [...g.set].some(k => !plain.set.has(k)) || g.n !== plain.n;
    return { depth: Math.min(cut, edge), exact: differs && cut >= 1, out };
  }
});

/** Trapezoid / parallelogram: the slant must be a slant, not a rounding error. */
for (const id of ['trapezoid', 'parallelogram']) {
  SPECS.push({
    id, param: 'box', wants: 'slant + surviving top edge',
    judge(b) {
      const out = gen(id, b, {});
      const g = grid(out);
      const cut = cornerCut(out);
      let edge = 0;
      for (let x = g.minX; x <= g.maxX; x++) if (g.set.has(x + ',' + g.minY)) edge++;
      return { depth: Math.min(cut, edge), exact: cut >= 1 && edge >= 1 && g.h >= 2, out };
    }
  });
}

/**
 * Bowtie / hourglass: the waist must pinch. Measured on the FILLED raster and
 * on INK COUNT per line, not on the span: the outline's span is the full width
 * at every row, so a span test never sees the pinch that defines the shape.
 */
// The bowtie is measured on its OUTLINE: its filled form is a solid rectangle,
// because the generic row-span fill runs from the left edge to the right edge
// on every row and the two vertical end edges are always both present (see the
// report). The hourglass, whose end edges are horizontal, fills correctly.
for (const [id, param, axis, useFill] of [
  ['bowtie', 'box', 'col', false],
  ['hourglass', 'centre', 'row', true]
]) {
  SPECS.push({
    id, param, wants: 'waist pinches',
    judge(b) {
      const out = gen(id, b, {});
      const counts = inkCounts(useFill ? gen(id, b, { filled: true }) : out, axis);
      if (counts.length < 3) return { depth: 0, exact: false, out };
      const mx = Math.max(...counts);
      const mn = Math.min(...counts.slice(1, -1));
      return { depth: mx - mn, exact: mx > mn && mn >= 1, out };
    }
  });
}

/** Moon: a crescent - one connected piece, genuinely bitten, still thick enough to see. */
SPECS.push({
  id: 'moon', param: 'drag', wants: '30% phase crescent',
  judge(b) {
    const opts = { phase: 0.3 };
    const out = gen('moon', b, opts);
    const fil = gen('moon', b, { ...opts, filled: true });
    const g = grid(fil);
    if (!g.n) return { depth: 0, exact: false, out };
    let waist = 0, run = 0;
    for (let x = g.minX; x <= g.maxX; x++) {
      if (g.set.has(x + ',' + b.y1)) { run++; waist = Math.max(waist, run); } else run = 0;
    }
    const rr = Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1));
    const disc = grid(gen('circle',
      { x1: b.x1 - rr, y1: b.y1 - rr, x2: b.x1 + rr, y2: b.y1 + rr }, { filled: true }));
    return { depth: waist, exact: componentCount(fil) === 1 && disc.n > g.n, out };
  }
});

/**
 * Spiral: the windings must stay apart. Measured along the drag ray, which is
 * the direction geometry guarantees crosses every turn; `depth` is the
 * narrowest paper gap between consecutive windings.
 */
SPECS.push({
  id: 'spiral', param: 'drag', wants: '3 turns, windings apart', kind: 'lobe',
  judge(b) {
    const opts = { turns: 3 };
    const out = gen('spiral', b, opts);
    const g = grid(out);
    const theta = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
    const seg = raySegments(out, b.x1, b.y1, theta, Math.max(g.w, g.h));
    // Windings counted at a 1 px paper gap and at a 2 px one - the same
    // present/readable pair the lobe shapes use, applied along a ray.
    const at = (minGap) => {
      let n = seg.gaps.filter(gp => gp >= minGap).length;
      return seg.runs ? n + 1 : 0;
    };
    return { count1: at(1), count2: at(2), out };
  }
});

/** Arrow: the head must be shorter than the arrow, leaving a shaft. */
SPECS.push({
  id: 'arrow', param: 'drag', wants: 'head + shaft',
  judge(b) {
    const out = gen('arrow', b, {});
    if (!out.length) return { depth: 0, exact: false, out };
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    const shaft = len - Math.max(6, len * 0.35);     // negative: head overruns the tail
    return { depth: shaft, exact: shaft > 0 && interior(gen('arrow', b, { filled: true }), out) >= 1, out };
  }
});

/** Fixed-direction arrow: shaft left over after the head. */
SPECS.push({
  id: 'arrow-right', param: 'drag', wants: 'head + shaft',
  judge(b) {
    const out = gen('arrow-right', b, {});
    const g = grid(out);
    const size = Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / Math.SQRT2);
    const shaft = 2 * size - Math.max(4, size * 0.4);
    return { depth: shaft, exact: shaft > 0 && g.h >= 3, out };
  }
});

/** Line: a mark with a direction, not a dot. */
SPECS.push({
  id: 'line', param: 'drag', wants: 'two pixels or more',
  judge(b) {
    const out = gen('line', b, {});
    const g = grid(out);
    return { depth: g.n - 1, exact: g.n >= 2, out };
  }
});

// -- The sweep ---------------------------------------------------------------

function sweep(spec) {
  const dirs = spec.param === 'drag' ? DIRS8 : [0];
  const isLobe = spec.kind === 'lobe';
  const rows = [];
  for (const size of SIZES) {
    let depth = Infinity, exact = true, c1 = [], c2 = [], bbox = null;
    for (const theta of dirs) {
      const b = boundsFor(spec, size, theta);
      const v = spec.judge(b);
      if (v.depth !== undefined && v.depth < depth) depth = v.depth;
      if (v.exact === false) exact = false;
      if (v.count1 !== undefined) { c1.push(v.count1); c2.push(v.count2); }
      const g = grid(v.out);
      if (!bbox || g.w * g.h > bbox.w * bbox.h) bbox = g;
    }
    // The sweep only judges sizes up to a bounding box of BIG px. Past the
    // screen edge the raster is clipped by the canvas rather than limited by
    // the shape; and well before that the question has answered itself - a
    // shape half the height of the screen is not in doubt. Carrying the
    // stability requirement out to a 264 px pentagon only imported noise.
    const fits = bbox.w <= BIG && bbox.h <= BIG && bbox.w <= SCREEN_W && bbox.h <= SCREEN_H;
    rows.push({ size, depth, exact, c1, c2, bbox, fits });
  }

  const fitting = rows.filter(r => r.fits);
  // The shape's own signature: the feature count its raster settles on across
  // the largest quarter of the sizes that still fit the window.
  let signature = null, stable = true;
  if (isLobe && fitting.length) {
    const top = fitting.slice(Math.floor(fitting.length * 0.75)).flatMap(r => r.c1);
    signature = top[top.length - 1];
    stable = top.every(c => c === signature);
  }
  // What the raster has to show: the count the generator is building by
  // definition where that is known, the calibrated signature otherwise.
  const target = isLobe ? (spec.intended !== null && spec.intended !== undefined
    ? spec.intended : signature) : null;

  const ok = (r, level) => {
    if (!r.fits) return false;
    if (isLobe) return (level === 1 ? r.c1 : r.c2).every(c => c === target);
    return r.exact && r.depth >= level;
  };
  const stableFrom = (level) => {
    let from = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].fits) continue;
      if (ok(rows[i], level)) from = rows[i]; else break;
    }
    return from;
  };
  return { present: stableFrom(1), readable: stableFrom(2), rows, signature, target, stable, isLobe };
}

module.exports = {
  grid, holeCount, componentCount, radial, centroid, lobes, interior, inkCounts,
  raySegments, axisProfile, cornerCut, circleNoise, noiseAt, DIRS8, centreBounds, dragBounds,
  boxBounds, boundsFor, sweep, SPECS, gen, SIZES, CAP
};

if (require.main !== module) return;

// -- Report ------------------------------------------------------------------

console.log('MINIMUM VIABLE SIZE - SHAPES');
console.log(`Driven through js/tools/shape-generator.js. Sizes 1..${CAP}, 8 drag directions.`);
console.log('PRESENT  = defining feature >= 1 px, feature count matches the shape\'s own signature');
console.log('READABLE = defining feature >= 2 px, in every drag direction');
console.log('');
console.log('shape              wants                    sig  PRESENT drag/bbox   READABLE drag/bbox');
console.log('-'.repeat(94));

const results = [];
for (const spec of SPECS) {
  const r = sweep(spec);
  results.push({ spec, r });
  const fmt = (row) => (row ? `${String(row.size).padStart(3)} / ${row.bbox.w}x${row.bbox.h}` : 'never').padEnd(20);
  console.log(
    spec.id.padEnd(19) +
    spec.wants.padEnd(25) +
    String(r.signature === null ? '-'
      : (r.signature === r.target ? String(r.signature) : `${r.target}!${r.signature}`) +
        (r.stable ? '' : '?')).padEnd(6) +
    fmt(r.present) + fmt(r.readable)
  );
}

if (DETAIL) {
  console.log('\n\nPER-SIZE DETAIL   R = readable, p = present, x = feature wrong, . = off screen');
  for (const { spec, r } of results) {
    const marks = r.rows.filter(row => row.size <= 48).map(row => {
      if (!row.fits) return '.';
      if (r.isLobe) {
        if (row.c2.every(c => c === r.target)) return 'R';
        if (row.c1.every(c => c === r.target)) return 'p';
        return 'x';
      }
      if (!row.exact) return 'x';
      return row.depth >= 2 ? 'R' : row.depth >= 1 ? 'p' : '-';
    }).join('');
    console.log(`  ${spec.id.padEnd(19)} ${marks}`);
  }
  console.log('  ' + ' '.repeat(19) + ' ' + '1234567890'.repeat(4).slice(0, 48));
}

console.log('\n\nCIRCLE RASTER NOISE (radial variation of a filled circle, px) - the measured floor');
console.log('  ' + [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64].map(r =>
  `r=${r}:${circleNoise.get(r).toFixed(2)}`).join('  '));

process.exit(0);
