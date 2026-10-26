'use strict';
/**
 * Batch 10A: the Text tool's shadow can fall down-right (today's default), down-left, up-right or up-left. MaskOps and
 * CoverageOps (the stamp re-render path) must agree, and the direction is relative to the letters, so it turns with Direction.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/utils/helpers.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bits = (m) => m.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/');

check('shadowVector: down-right is +,+ (and the default for anything unknown)',
  eq(MaskOps.shadowVector('down-right', 2), { dx: 2, dy: 2 }) && eq(MaskOps.shadowVector(undefined, 2), { dx: 2, dy: 2 }) && eq(MaskOps.shadowVector('nonsense', 3), { dx: 3, dy: 3 }));
check('shadowVector: down-left, up-right, up-left',
  eq(MaskOps.shadowVector('down-left', 2), { dx: -2, dy: 2 }) && eq(MaskOps.shadowVector('up-right', 2), { dx: 2, dy: -2 }) &&
  eq(MaskOps.shadowVector('up-left', 2), { dx: -2, dy: -2 }));

// A single dot, offset 1: the glyph and its shadow sit on the two diagonal corners of a 2x2 box
const dot = [[true]];
const at = (dir) => bits(MaskOps.process(dot, { shadow: true, shadowDir: dir, shadowOffset: 1 }));
check('down-right: glyph top-left, shadow bottom-right', at('down-right') === '10/01');
check('down-left: glyph top-right, shadow bottom-left', at('down-left') === '01/10');
check('up-right: glyph bottom-left, shadow top-right', at('up-right') === '01/10');
check('up-left: glyph bottom-right, shadow top-left', at('up-left') === '10/01');
check('no shadowDir = down-right, byte for byte', bits(MaskOps.process(dot, { shadow: true, shadowOffset: 1 })) === at('down-right'));

// The glyph is in the right place inside the box for each direction (use a 2x1 glyph so glyph and shadow differ)
const bar = [[true, true]];
const glyphAt = (dir) => {
  const out = MaskOps.process(bar, { shadow: true, shadowDir: dir, shadowOffset: 1 });
  return bits(out);
};
check('down-right keeps the glyph on the top row', glyphAt('down-right') === '110/011');
check('down-left puts the glyph on the top row, to the right', glyphAt('down-left') === '011/110');
check('up-right puts the glyph on the bottom row', glyphAt('up-right') === '011/110');
check('up-left puts the glyph on the bottom row, to the right', glyphAt('up-left') === '110/011');

// MaskOps and CoverageOps agree on 1-bit input for all four directions, with outline, mirror and a turn
let allAgree = true, why = '';
const glyph = [[true, false, true], [false, true, false], [true, true, true], [true, false, false]];
// (CoverageOps.process stops before the turn: the stamp path rotates separately, so no direction here)
for (const dir of ['down-right', 'down-left', 'up-right', 'up-left']) {
  for (const opts of [{}, { outline: true }, { mirrorH: true }, { mirrorV: true, outline: true }]) {
    const o = { shadow: true, shadowDir: dir, ...opts };
    const m = bits(MaskOps.process(glyph, o));
    const c = CoverageOps.process(CoverageOps.fromMask(glyph), o);
    const cm = bits(CoverageOps.toMask ? CoverageOps.toMask(c) : []);
    if (m !== cm) { allAgree = false; why = dir + ' ' + JSON.stringify(opts); }
  }
}
check('CoverageOps.process agrees with MaskOps.process in all four directions (the stamp re-render path)', allAgree, why);

// The direction is relative to the letters: a quarter turn turns the shadow with the text
const turned = bits(MaskOps.process(dot, { shadow: true, shadowDir: 'down-right', shadowOffset: 1, direction: 90 }));
check('Direction 90 turns a down-right shadow to a down-left one on screen', turned === '01/10');

summary();
