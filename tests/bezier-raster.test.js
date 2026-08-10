'use strict';
/**
 * Phase 8: bezier curve rasterization (pure math in ShapeGenerator).
 *
 * Checks quadratic + cubic flattening: endpoint inclusion, 8-connected
 * continuity, symmetry of a symmetric curve, collinear-control collapse to
 * the straight Bresenham line, degenerate (coincident) control points, and
 * thickness dilation.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/shape-generator.js');

const has = (pts, x, y) => pts.some(p => p.x === x && p.y === y);
const key = (p) => `${p.x},${p.y}`;

/** Every pixel has an 8-connected neighbour in the set (single-pixel curves pass). */
function connected(pts) {
  if (pts.length < 2) return true;
  const set = new Set(pts.map(key));
  return pts.every(p => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (set.has(`${p.x + dx},${p.y + dy}`)) return true;
      }
    }
    return false;
  });
}

// ── Quadratic ──────────────────────────────────────────────────────────────
const q = ShapeGenerator.generateQuadraticBezier(
  { x: 20, y: 100 }, { x: 70, y: 20 }, { x: 120, y: 100 });
check('quadratic: start anchor included', has(q, 20, 100));
check('quadratic: end anchor included', has(q, 120, 100));
check('quadratic: 8-connected', connected(q));
check('quadratic: apex reaches the midpoint height (t=0.5 -> y=60)',
  q.some(p => p.y === 60 && Math.abs(p.x - 70) <= 1));
check('quadratic: curve pulls toward the control (above the chord)',
  q.every(p => p.y <= 100) && q.some(p => p.y < 90));
check('quadratic: no duplicate pixels', new Set(q.map(key)).size === q.length);

// Horizontal symmetry of a symmetric configuration
const qSet = new Set(q.map(key));
check('quadratic: symmetric about the control x',
  q.every(p => qSet.has(`${140 - p.x},${p.y}`)));

// ── Collinear control -> straight line ──────────────────────────────────────
const straight = ShapeGenerator.generateQuadraticBezier(
  { x: 10, y: 10 }, { x: 30, y: 30 }, { x: 50, y: 50 });
const bres = ToolBase.getLinePoints(10, 10, 50, 50);
const straightSet = new Set(straight.map(key));
check('collinear control: exactly the Bresenham diagonal',
  straight.length === bres.length && bres.every(p => straightSet.has(key(p))));

// ── Degenerate control points ──────────────────────────────────────────────
const point = ShapeGenerator.generateQuadraticBezier(
  { x: 42, y: 42 }, { x: 42, y: 42 }, { x: 42, y: 42 });
check('degenerate: all points coincident -> single pixel',
  point.length === 1 && has(point, 42, 42));

const collapsed = ShapeGenerator.generateCubicBezier(
  { x: 10, y: 20 }, { x: 10, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 20 });
check('degenerate cubic: coincident anchor/control pairs -> still spans the chord',
  has(collapsed, 10, 20) && has(collapsed, 60, 20) && connected(collapsed));

// ── Cubic ──────────────────────────────────────────────────────────────────
const c = ShapeGenerator.generateCubicBezier(
  { x: 20, y: 100 }, { x: 50, y: 20 }, { x: 90, y: 180 }, { x: 120, y: 100 });
check('cubic: both anchors included', has(c, 20, 100) && has(c, 120, 100));
check('cubic: 8-connected', connected(c));
check('cubic: S-curve crosses above AND below the chord',
  c.some(p => p.y < 90) && c.some(p => p.y > 110));
check('cubic: no duplicate pixels', new Set(c.map(key)).size === c.length);

// ── Thickness ──────────────────────────────────────────────────────────────
const thin  = ShapeGenerator.generateQuadraticBezier(
  { x: 20, y: 100 }, { x: 70, y: 40 }, { x: 120, y: 100 }, { thickness: 1 });
const thick = ShapeGenerator.generateQuadraticBezier(
  { x: 20, y: 100 }, { x: 70, y: 40 }, { x: 120, y: 100 }, { thickness: 4 });
check('thickness: 4px curve has more pixels than 1px', thick.length > thin.length * 2);
const thickSet = new Set(thick.map(key));
check('thickness: thick curve covers the thin spine',
  thin.every(p => thickSet.has(key(p))));
check('thickness: no duplicate pixels after dilation',
  new Set(thick.map(key)).size === thick.length);

summary();
