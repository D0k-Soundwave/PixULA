'use strict';
/**
 * Phase 8: text mask post-processing (MaskOps — pure math).
 *
 * rotate (4-direction placement), shadow (offset-OR), outline
 * (dilate-minus-glyph), and the canonical process() chain the text tool and
 * SelectionService both use.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/utils/mask-ops.js');

const T = true, F = false;
const dims = (m) => `${m.length ? m[0].length : 0}x${m.length}`;
const count = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A 3x2 asymmetric glyph:  X X .
//                          . . X
const glyph = [[T, T, F], [F, F, T]];

// ── rotate ─────────────────────────────────────────────────────────────────
check('rotate 0: identity', eq(MaskOps.rotate(glyph, 0), glyph));

const r90 = MaskOps.rotate(glyph, 90);
// CW 90 of 3x2 -> 2x3; column 0 of the source (top->bottom) becomes row 0 (right->left)
check('rotate 90: dims swap (3x2 -> 2x3)', dims(r90) === '2x3');
check('rotate 90: pixel mapping', eq(r90, [[F, T], [F, T], [T, F]]));

const r180 = MaskOps.rotate(glyph, 180);
check('rotate 180: dims preserved', dims(r180) === dims(glyph));
check('rotate 180: pixel mapping', eq(r180, [[T, F, F], [F, T, T]]));
check('rotate 180 twice = identity', eq(MaskOps.rotate(r180, 180), glyph));

const r270 = MaskOps.rotate(glyph, 270);
check('rotate 270 = three quarter turns', eq(r270, MaskOps.rotate(MaskOps.rotate(r90, 90), 90)));
check('rotate 360 = identity', eq(MaskOps.rotate(glyph, 360), glyph));

// ── shadow (offset-OR) ─────────────────────────────────────────────────────
const sh = MaskOps.shadow(glyph, 1, 1);
check('shadow: grows by the offset (3x2 -> 4x3)', dims(sh) === '4x3');
check('shadow: glyph pixels kept at origin', sh[0][0] && sh[0][1] && sh[1][2]);
check('shadow: offset copy present', sh[1][1] && sh[1][2] && sh[2][3]);
check('shadow: OR semantics — no pixel lost',
  count(sh) >= count(glyph) && count(sh) <= count(glyph) * 2);
check('shadow: empty corner stays empty', !sh[2][0]);

// ── outline (dilate-minus-glyph) ───────────────────────────────────────────
const single = [[T]];
const ol = MaskOps.outline(single);
check('outline: 1x1 glyph -> 3x3 ring', dims(ol) === '3x3' && count(ol) === 8);
check('outline: glyph interior is hollow', !ol[1][1]);
check('outline: all 8 neighbours set',
  ol[0][0] && ol[0][1] && ol[0][2] && ol[1][0] && ol[1][2] && ol[2][0] && ol[2][1] && ol[2][2]);

const olGlyph = MaskOps.outline(glyph);
check('outline: original glyph pixels always hollow',
  glyph.every((row, y) => row.every((v, x) => !v || !olGlyph[y + 1][x + 1])));

// ── process chain (outline -> shadow -> rotate) ──────────────────────────────
const manual = MaskOps.rotate(MaskOps.shadow(MaskOps.outline(glyph), 1, 1), 90);
const processed = MaskOps.process(glyph, { direction: 90, shadow: true, outline: true, shadowOffset: 1 });
check('process: equals manual outline->shadow->rotate chain', eq(processed, manual));

check('process: no options = identity', eq(MaskOps.process(glyph, {}), glyph));
check('process: default shadow offset scales with mask height', (() => {
  const tall = Array.from({ length: 32 }, () => [T]);      // 1x32
  const s = MaskOps.shadow(tall, 4, 4);                     // expected offset = 32/8
  const viaProcess = MaskOps.process(tall, { shadow: true });
  return eq(viaProcess, s);
})());

// Empty-mask safety
check('rotate/shadow/outline: empty mask passthrough',
  eq(MaskOps.rotate([], 90), []) && eq(MaskOps.shadow([], 1, 1), []) && eq(MaskOps.outline([]), []));

// -- flipH / flipV (exact mirrors) -------------------------------------------
check('flipH: reverses every row', eq(MaskOps.flipH(glyph), [[F, T, T], [T, F, F]]));
check('flipV: reverses the row order', eq(MaskOps.flipV(glyph), [[F, F, T], [T, T, F]]));
check('flipH: dims unchanged', dims(MaskOps.flipH(glyph)) === dims(glyph));
check('flipV: dims unchanged', dims(MaskOps.flipV(glyph)) === dims(glyph));
check('flipH twice = identity', eq(MaskOps.flipH(MaskOps.flipH(glyph)), glyph));
check('flipV twice = identity', eq(MaskOps.flipV(MaskOps.flipV(glyph)), glyph));
check('flipH/flipV: lossless (ink count preserved)',
  count(MaskOps.flipH(glyph)) === count(glyph) && count(MaskOps.flipV(glyph)) === count(glyph));
check('flipH+flipV = rotate 180', eq(MaskOps.flipV(MaskOps.flipH(glyph)), MaskOps.rotate(glyph, 180)));
check('flipH/flipV: empty mask passthrough',
  eq(MaskOps.flipH([]), []) && eq(MaskOps.flipV([]), []));

// -- rotateFree (arbitrary angles) -------------------------------------------
// rotate() used to snap to the nearest quarter turn (Math.round(deg/90)), so 45
// silently became 90. The dispatch must send non-multiples to rotateFree.
const r45 = MaskOps.rotate(glyph, 45);
check('rotate 45: is NOT snapped to 90', !eq(r45, MaskOps.rotate(glyph, 90)));
check('rotate 45: is NOT the identity', !eq(r45, glyph));
// 3x2 at 45 deg: ceil(3*cos45 + 2*sin45) = ceil(3.54) = 4 on both axes
check('rotate 45: bounding box grows to fit the diagonal (3x2 -> 4x4)', dims(r45) === '4x4');
check('rotate 45: keeps ink', count(r45) > 0);

// Quarter turns must still take the EXACT transpose path - lossless, no resample.
check('rotate 90/180/270 stay lossless (ink count preserved)',
  count(MaskOps.rotate(glyph, 90))  === count(glyph) &&
  count(MaskOps.rotate(glyph, 180)) === count(glyph) &&
  count(MaskOps.rotate(glyph, 270)) === count(glyph));

// A horizontal bar turned CLOCKWISE tips its right-hand end downward, so the
// result descends left-to-right (screen coords, y down).
const bar = [[T, T, T, T, T]];
const bar45 = MaskOps.rotate(bar, 45);
check('rotate 45: a horizontal bar becomes a descending diagonal', (() => {
  const set = [];
  bar45.forEach((row, y) => row.forEach((v, x) => { if (v) set.push({ x, y }); }));
  if (set.length < 3) return false;
  const leftmost  = set.reduce((a, b) => (b.x < a.x ? b : a));
  const rightmost = set.reduce((a, b) => (b.x > a.x ? b : a));
  return leftmost.y < rightmost.y;
})());

check('rotateFree: 315 is the mirror image of 45 about the vertical axis',
  eq(MaskOps.rotate(bar, 315), MaskOps.flipH(MaskOps.rotate(bar, 45))));
check('rotateFree: negative angles normalize (-45 == 315)',
  eq(MaskOps.rotate(bar, -45), MaskOps.rotate(bar, 315)));
check('rotateFree: empty mask passthrough', eq(MaskOps.rotate([], 45), []));

// -- process chain with mirrors (mirror -> outline -> shadow -> rotate) -------
const chained = MaskOps.rotate(
  MaskOps.shadow(MaskOps.outline(MaskOps.flipV(MaskOps.flipH(glyph))), 1, 1), 90);
check('process: mirrors run FIRST, in glyph space, before outline/shadow/rotate',
  eq(MaskOps.process(glyph, {
    mirrorH: true, mirrorV: true, direction: 90,
    shadow: true, outline: true, shadowOffset: 1
  }), chained));
check('process: mirrorH alone', eq(MaskOps.process(glyph, { mirrorH: true }), MaskOps.flipH(glyph)));
check('process: mirrorV alone', eq(MaskOps.process(glyph, { mirrorV: true }), MaskOps.flipV(glyph)));
check('process: a 45 deg direction reaches the free rotation',
  eq(MaskOps.process(glyph, { direction: 45 }), MaskOps.rotate(glyph, 45)));


summary();
