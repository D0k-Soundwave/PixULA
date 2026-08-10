'use strict';
/**
 * FILLED SHAPES ARE THE SAME SHAPE AS THEIR OUTLINES.
 *
 * Four defects found by tools/measure-min-sizes.js on 2026-08-05, each of them
 * a filled or rounded shape quietly drawing something other than what it says:
 *
 *   - a filled gear had no bore, and was built from teeth x 2 alternating
 *     vertices (a pointed star) while its outline used teeth x 4 (a cog), so
 *     ticking Filled changed the shape;
 *   - a filled bowtie was a solid rectangle, because the generic row-span fill
 *     runs from the leftmost to the rightmost ink on each row and a bowtie has
 *     both vertical end edges present on every row;
 *   - a filled crescent moon came apart into two or three disconnected pieces
 *     at some radii, because per-row spans computed with ceil/floor drop a row
 *     entirely where the crescent is thinner than a pixel, and strand a speck
 *     beyond the cutout slot near each horn;
 *   - a rounded rectangle's corner was a one-pixel chamfer on every box below
 *     20 px, because the radius was 30% of HALF the smaller side and floored at
 *     2, and a 2 px circular corner bites exactly one pixel.
 *
 * These are geometry facts, so they are asserted against the real generator
 * rather than against a re-implementation of it.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

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

// -- helpers ----------------------------------------------------------------

const keyOf = (p) => p.x + ',' + p.y;
const setOf = (pts) => new Set(pts.map(keyOf));

function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** 8-connected ink groups: a crescent must be exactly one. */
function componentCount(pts) {
  const set = setOf(pts);
  const seen = new Set();
  let n = 0;
  for (const key of set) {
    if (seen.has(key)) continue;
    n++;
    const stack = [key];
    seen.add(key);
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const k = (x + dx) + ',' + (y + dy);
          if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
    }
  }
  return n;
}

/** Enclosed paper regions (4-connected) - a gear's bore is one of these. */
function holeCount(pts) {
  const b = bbox(pts);
  const set = setOf(pts);
  const w = b.w + 2, h = b.h + 2;
  const ink = (x, y) => set.has((x + b.minX - 1) + ',' + (y + b.minY - 1));
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

/** Ink pixels per column. */
function columnInk(pts) {
  const counts = new Map();
  for (const p of pts) counts.set(p.x, (counts.get(p.x) || 0) + 1);
  const b = bbox(pts);
  const out = [];
  for (let x = b.minX; x <= b.maxX; x++) out.push(counts.get(x) || 0);
  return out;
}

const centred = (k) => ({ x1: 128 - k, y1: 96 - k, x2: 128 + k, y2: 96 + k });
const box = (side) => ({ x1: 100, y1: 100, x2: 100 + side - 1, y2: 100 + side - 1 });

// -- 1. Gear: one geometry, and a bore in the fill --------------------------

{
  const bounds = centred(20);
  const opts = { teeth: 8 };
  const outlineVerts = ShapeGenerator._gearGeometry(
    ShapeGenerator._standardizeBounds('gear', bounds), 8).vertices;
  check('gear: the cog has 4 vertices per tooth (outer, outer, inner, inner)',
    outlineVerts.length === 32);

  // The fill must be built from the SAME vertices as the outline.
  const viaSwitch = ShapeGenerator._getShapeVertices('gear',
    ShapeGenerator._standardizeBounds('gear', bounds), opts);
  check('gear: fill and outline are cut from one vertex list',
    viaSwitch.length === outlineVerts.length &&
    viaSwitch.every((v, i) => v.x === outlineVerts[i].x && v.y === outlineVerts[i].y),
    `fill ${viaSwitch.length} vs outline ${outlineVerts.length}`);

  const filled = ShapeGenerator.generateShape('gear', bounds, { ...opts, filled: true });
  check('gear: a filled gear has a bore', holeCount(filled) >= 1);

  const outline = ShapeGenerator.generateShape('gear', bounds, opts);
  const ob = bbox(outline), fb = bbox(filled);
  check('gear: filled and outline cover the same extent',
    Math.abs(ob.w - fb.w) <= 1 && Math.abs(ob.h - fb.h) <= 1,
    `outline ${ob.w}x${ob.h}, filled ${fb.w}x${fb.h}`);

  // Every tooth count the slider offers, at a size where teeth are resolvable.
  let boresOk = true;
  for (let teeth = 3; teeth <= 16; teeth++) {
    const f = ShapeGenerator.generateShape('gear', centred(24), { teeth, filled: true });
    if (holeCount(f) < 1) { boresOk = false; break; }
  }
  check('gear: every tooth count from 3 to 16 fills with a bore', boresOk);
}

// -- 2. Bowtie: the waist pinches -------------------------------------------

{
  for (const side of [9, 13, 25, 41]) {
    const filled = ShapeGenerator.generateShape('bowtie', box(side), { filled: true });
    const cols = columnInk(filled);
    const widest = Math.max(...cols);
    const waist = Math.min(...cols.slice(1, -1));
    check(`bowtie ${side}x${side}: filled waist is narrower than its ends ` +
      `(waist ${waist}, ends ${widest})`, waist < widest && waist >= 1);
  }
  // The one it used to be: a solid rectangle.
  const filled = ShapeGenerator.generateShape('bowtie', box(13), { filled: true });
  const b = bbox(filled);
  check('bowtie: a filled bowtie is not a solid rectangle',
    filled.length < b.w * b.h * 0.9, `${filled.length} px in a ${b.w}x${b.h} box`);
}

// -- 3. Moon: a crescent is one piece ---------------------------------------

{
  let broken = [];
  for (let d = 2; d <= 64; d++) {
    const filled = ShapeGenerator.generateShape('moon',
      { x1: 128, y1: 96, x2: 128 + d, y2: 96 }, { phase: 0.3, filled: true });
    if (componentCount(filled) !== 1) broken.push(d);
  }
  check('moon: the crescent is connected at every radius from 2 to 64',
    broken.length === 0, `broken at drag ${broken.join(', ')}`);

  // Across the phase slider (5% to 95%), and off the horizontal.
  broken = [];
  for (const phase of [0.05, 0.3, 0.5, 0.95]) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 2]]) {
      for (const d of [4, 9, 17, 41]) {
        const filled = ShapeGenerator.generateShape('moon',
          { x1: 128, y1: 96, x2: 128 + dx * d, y2: 96 + dy * d }, { phase, filled: true });
        if (componentCount(filled) !== 1) broken.push(`p${phase} d${d} (${dx},${dy})`);
      }
    }
  }
  check('moon: connected at every phase and drag direction',
    broken.length === 0, broken.join('; '));

  // It must still be a crescent, not a disc: some of the disc is missing.
  const r = 20;
  const moon = ShapeGenerator.generateShape('moon',
    { x1: 128, y1: 96, x2: 128 + r, y2: 96 }, { phase: 0.3, filled: true });
  const disc = ShapeGenerator.generateShape('circle',
    { x1: 128 - r, y1: 96 - r, x2: 128 + r, y2: 96 + r }, { filled: true });
  check('moon: the crescent is bitten out of its own disc',
    moon.length < disc.length * 0.75, `${moon.length} vs disc ${disc.length}`);
}

// -- 4. Rounded rectangle: the corner is proportional ------------------------

{
  /** How deep the corner bites, measured along the top edge. */
  const cornerBite = (pts) => {
    const b = bbox(pts);
    const set = setOf(pts);
    for (let x = b.minX; x <= b.maxX; x++) if (set.has(x + ',' + b.minY)) return x - b.minX;
    return 0;
  };

  const bites = [9, 13, 17, 21, 33, 49].map(side =>
    [side, cornerBite(ShapeGenerator.generateShape('rounded-rectangle', box(side), {}))]);

  check('rounded-rect: the corner grows with the box',
    bites.every(([, bite], i) => i === 0 || bite >= bites[i - 1][1]),
    bites.map(([s, b]) => `${s}:${b}`).join(' '));

  const at17 = bites.find(([s]) => s === 17)[1];
  check(`rounded-rect: a 17 px box has a corner deeper than one pixel (got ${at17})`,
    at17 >= 2);

  // Never a stadium, never wider than the box's own half.
  let sane = true;
  for (let side = 3; side <= 64; side++) {
    const pts = ShapeGenerator.generateShape('rounded-rectangle', box(side), {});
    const b = bbox(pts);
    if (b.w !== side || b.h !== side) { sane = false; break; }
    if (cornerBite(pts) > Math.floor(side / 2)) { sane = false; break; }
  }
  check('rounded-rect: fills its box exactly and never rounds past its own half', sane);

  // Straight edges must survive between the corners at every size.
  let edged = true;
  for (let side = 6; side <= 64; side++) {
    const pts = ShapeGenerator.generateShape('rounded-rectangle', box(side), {});
    const set = setOf(pts);
    const b = bbox(pts);
    const mid = Math.round((b.minX + b.maxX) / 2);
    if (!set.has(mid + ',' + b.minY) || !set.has(b.minX + ',' + Math.round((b.minY + b.maxY) / 2))) {
      edged = false;
      break;
    }
  }
  check('rounded-rect: keeps a straight edge between its corners', edged);
}

// -- 5. Fills follow the ACTIVE screen mode, not a hardcoded 256x192 ---------

{
  // The clip in the fill paths used literal 255/191. Nothing here switches
  // modes (that is ScreenModeService's job and it needs the whole app), but the
  // generator must at least be reading the live geometry rather than a literal,
  // so a fill reaches the bottom row of the mode it is actually in.
  const h = ZX_SPECTRUM.HEIGHT, w = ZX_SPECTRUM.WIDTH;
  const filled = ShapeGenerator.generateShape('circle',
    { x1: w - 21, y1: h - 21, x2: w - 1, y2: h - 1 }, { filled: true });
  const b = bbox(filled);
  check('fills reach the last row and column of the screen mode',
    b.maxY === h - 1 && b.maxX === w - 1, `${b.maxX},${b.maxY} vs ${w - 1},${h - 1}`);
}

summary();
