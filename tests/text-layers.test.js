'use strict';
/**
 * Batch 10A2: opposite-dot shadow and contour as two layers - the SET dots and the CLEAR dots a text stamp writes.
 * MaskOps.processLayers / CoverageOps.processLayers. With nothing opposite they are exactly process(); the clear layer never
 * overlaps the set layer; MaskOps and CoverageOps agree on 1-bit input; the box is the same size as with Same dots.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/utils/helpers.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');

const bits = (m) => (m ? m.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/') : null);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dot = [[true]];
const bar = [[true, true]];
const glyph = [[true, false, true], [false, true, false], [true, true, true], [true, false, false]];

// -- nothing opposite = process() ---------------------------------------------------------------------------------------
{
  let ok = true;
  for (const o of [{}, { shadow: true }, { outline: true }, { shadow: true, outline: true, mirrorH: true, direction: 90 },
                   { shadow: true, shadowDir: 'up-left', shadowDots: 'same', outlineDots: 'same' }]) {
    const a = MaskOps.processLayers(glyph, o);
    if (bits(a.pixels) !== bits(MaskOps.process(glyph, o)) || a.clearMask !== null) ok = false;
  }
  check('with no opposite effect processLayers is process() and has no clear layer', ok);
  check('"opposite" on an effect that is switched off changes nothing', MaskOps.processLayers(glyph, { shadowDots: 'opposite', outlineDots: 'opposite' }).clearMask === null);
}

// -- opposite shadow ----------------------------------------------------------------------------------------------------
{
  const r = MaskOps.processLayers(dot, { shadow: true, shadowDots: 'opposite', shadowOffset: 1, shadowDir: 'down-right' });
  check('opposite shadow of a dot: the dot stays SET, the shade is the CLEAR dot behind it', bits(r.pixels) === '10/00' && bits(r.clearMask) === '00/01', bits(r.pixels) + ' | ' + bits(r.clearMask));
  const l = MaskOps.processLayers(dot, { shadow: true, shadowDots: 'opposite', shadowOffset: 1, shadowDir: 'up-left' });
  check('...up-left: dot bottom-right, shade top-left', bits(l.pixels) === '00/01' && bits(l.clearMask) === '10/00');
  const same = MaskOps.process(dot, { shadow: true, shadowOffset: 1 });
  check('the box is the same size as with Same dots', r.pixels.length === same.length && r.pixels[0].length === same[0].length);
  const b = MaskOps.processLayers(bar, { shadow: true, shadowDots: 'opposite', shadowOffset: 1 });
  check('a shade that would fall on the letters stays behind them (the set dots win)', bits(b.pixels) === '110/000' && bits(b.clearMask) === '000/011', bits(b.pixels) + ' | ' + bits(b.clearMask));
}

// -- opposite contour ---------------------------------------------------------------------------------------------------
{
  const r = MaskOps.processLayers(dot, { outline: true, outlineDots: 'opposite' });
  check('opposite contour of a dot: the dot stays SET with a ring of CLEAR dots', bits(r.pixels) === '000/010/000' && bits(r.clearMask) === '111/101/111', bits(r.pixels) + ' | ' + bits(r.clearMask));
  const keep = MaskOps.process(dot, { outline: true });
  check('Same contour is still the hollow ring (letters removed): unchanged', bits(keep) === '111/101/111');
}

// -- mixed: each effect has its own switch ------------------------------------------------------------------------------
{
  const a = MaskOps.processLayers(dot, { outline: true, outlineDots: 'opposite', shadow: true, shadowDots: 'same', shadowOffset: 1 });
  check('opposite contour + same shadow: letters and their shadow set, the ring clear around the letters only',
    bits(a.pixels) === '0000/0100/0010/0000' && bits(a.clearMask) === '1110/1010/1100/0000', bits(a.pixels) + ' | ' + bits(a.clearMask));
  const b = MaskOps.processLayers(dot, { outline: true, outlineDots: 'same', shadow: true, shadowDots: 'opposite', shadowOffset: 1 });
  check('same contour + opposite shadow: the ring is set, the shade of the ring is clear and behind it',
    bits(b.pixels) === '1110/1010/1110/0000' && bits(b.clearMask) === '0000/0101/0001/0111', bits(b.pixels) + ' | ' + bits(b.clearMask));
  for (const [name, r] of [['A', a], ['B', b]]) {
    let overlap = false;
    for (let y = 0; y < r.pixels.length; y++) for (let x = 0; x < r.pixels[0].length; x++) if (r.pixels[y][x] && r.clearMask[y][x]) overlap = true;
    check(`${name}: set and clear never overlap`, !overlap);
  }
}

// -- turned: both layers turn together, still no overlap -----------------------------------------------------------------
for (const dir of [90, 180, 270, 45, 135]) {
  const r = MaskOps.processLayers(glyph, { shadow: true, shadowDots: 'opposite', outline: true, outlineDots: 'opposite', direction: dir });
  let overlap = false;
  for (let y = 0; y < r.pixels.length; y++) for (let x = 0; x < r.pixels[0].length; x++) if (r.pixels[y][x] && r.clearMask[y][x]) overlap = true;
  check(`direction ${dir}: both layers have the same size and never overlap`, !overlap && r.clearMask.length === r.pixels.length && r.clearMask[0].length === r.pixels[0].length);
}
{
  const r = MaskOps.processLayers(dot, { shadow: true, shadowDots: 'opposite', shadowOffset: 1, direction: 90 });
  check('Direction 90 turns the shade with the letters', bits(r.pixels) === '01/00' && bits(r.clearMask) === '00/10', bits(r.pixels) + ' | ' + bits(r.clearMask));
}

// -- MaskOps and CoverageOps agree on 1-bit input (CoverageOps stops before the turn) --------------------------------------
{
  let agree = true, why = '';
  for (const dir of ['down-right', 'down-left', 'up-right', 'up-left']) {
    for (const sd of ['same', 'opposite']) for (const od of ['same', 'opposite']) {
      for (const extra of [{}, { mirrorH: true }, { mirrorV: true }]) {
        const o = { shadow: true, outline: true, shadowDir: dir, shadowDots: sd, outlineDots: od, ...extra };
        const m = MaskOps.processLayers(glyph, o);
        const c = CoverageOps.processLayers(CoverageOps.fromMask(glyph), o);
        const set = bits(CoverageOps.toMask(c.set));
        const clear = c.clear ? bits(CoverageOps.toMask(c.clear)) : null;
        // the coverage layer returns clear minus set at 1 bit already; compare to the mask layer's
        if (set !== bits(m.pixels) || (clear || null) !== (m.clearMask ? bits(m.clearMask) : null)) { agree = false; why = JSON.stringify(o); }
      }
    }
  }
  check('CoverageOps.processLayers agrees with MaskOps.processLayers on 1-bit input (set and clear)', agree, why);
  const none = CoverageOps.processLayers(CoverageOps.fromMask(glyph), { shadow: true });
  check('CoverageOps.processLayers with nothing opposite = process(), no clear layer', none.clear === null && bits(CoverageOps.toMask(none.set)) === bits(CoverageOps.toMask(CoverageOps.process(CoverageOps.fromMask(glyph), { shadow: true }))));
}

summary();
