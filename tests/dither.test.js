'use strict';
/**
 * Batch 8 part 8A: Dither - the 31 ZX Paintbrush dithering / halftoning methods (js/utils/dither.js).
 * Tables are transcribed from the ZX Paintbrush 2.6.4 help "dithering_style"; this file holds an independent copy of the
 * printed grids so a slip in either shows up.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const fs = require('fs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/utils/helpers.js');
loadModule('js/utils/dither.js');

const D = window.Dither;
const ids = D.METHODS.map(m => m.id);

// -- the list ------------------------------------------------------------------------------------------------
check('31 methods', D.METHODS.length === 31);
check('ids are unique', new Set(ids).size === 31);
const fam = (f) => D.METHODS.filter(m => m.family === f).length;
check('families: 3 thresholds, 14 diffusion, 3 bayer, 7 cluster, 4 supercell',
  [fam('threshold'), fam('diffusion'), fam('bayer'), fam('cluster'), fam('supercell')].join() === '3,14,3,7,4');
check('level counts as the help prints them',
  D.METHODS.filter(m => m.levels !== null && m.family !== 'threshold').map(m => m.levels).join() ===
  '4,16,64,16,64,15,5,8,10,10,20,24,40,30');
{
  const en = fs.readFileSync('js/i18n/en.js', 'utf8');
  check('every method has an English name key', D.METHODS.every(m => en.includes("'" + m.i18n + "'")),
    D.METHODS.filter(m => !en.includes("'" + m.i18n + "'")).map(m => m.i18n).join());
}

// -- error diffusion kernels: an independent copy of each printed grid (X = the pixel, null = blank) -----------------
const X = 'X', _ = null;
const R = (n, d) => n / d;
const GRIDS = {
  'floyd-steinberg': [[_, X, R(7,16)], [R(3,16), R(5,16), R(1,16)]],
  'jarvis-judice-ninke': [[_, _, X, R(7,48), R(5,48)], [R(1,16), R(5,48), R(7,48), R(5,48), R(1,16)], [R(1,48), R(1,16), R(5,48), R(1,16), R(1,48)]],
  'zhigang-fan': [[_, _, X, R(7,16)], [R(1,16), R(3,16), R(5,16), _]],
  'shiau-fan-1': [[_, _, X, R(1,2)], [R(1,8), R(1,8), R(1,4), _]],
  'shiau-fan-2': [[_, _, _, X, R(1,2)], [R(1,16), R(1,16), R(1,8), R(1,4), _]],
  'stucki': [[_, _, X, R(4,21), R(2,21)], [R(1,21), R(2,21), R(4,21), R(2,21), R(1,21)], [R(1,42), R(1,21), R(2,21), R(1,21), R(1,42)]],
  'burkes': [[_, _, X, R(1,4), R(1,8)], [R(1,16), R(1,8), R(1,4), R(1,8), R(1,16)]],
  'sierra-3': [[_, _, X, R(5,32), R(3,32)], [R(1,16), R(1,8), R(5,32), R(1,8), R(1,16)], [_, R(1,16), R(3,32), R(1,16), _]],
  'sierra-2': [[_, _, X, R(1,4), R(3,16)], [R(1,16), R(1,8), R(3,16), R(1,8), R(1,16)]],
  'sierra-lite': [[_, X, R(1,2)], [R(1,4), R(1,4), _]],
  'atkinson': [[_, X, R(1,8), R(1,8)], [R(1,8), R(1,8), R(1,8), _], [_, R(1,8), _, _]],
  'false-floyd-steinberg': [[X, R(3,8)], [R(3,8), R(1,4)]]
};
const near = (a, b) => Math.abs(a - b) < 1e-12;
function gridTaps(grid) {
  const row0 = grid[0], cx = row0.indexOf(X), taps = [];
  grid.forEach((row, dy) => row.forEach((v, i) => { if (typeof v === 'number') taps.push([i - cx, dy, v]); }));
  return taps;
}
for (const [id, grid] of Object.entries(GRIDS)) {
  const want = gridTaps(grid), got = D.kernel(id);
  check(`kernel ${id} equals the printed grid`,
    want.length === got.length && want.every(w => got.some(g => g[0] === w[0] && g[1] === w[1] && near(g[2], w[2]))));
  const sum = got.reduce((s, t) => s + t[2], 0);
  check(`kernel ${id} sums to ${id === 'atkinson' ? '3/4' : '1'}`, near(sum, id === 'atkinson' ? 0.75 : 1), String(sum));
  check(`kernel ${id} only looks forward`, got.every(t => t[1] > 0 || (t[1] === 0 && t[0] > 0)));
}
{
  const se = D.kernel('stevenson-arce');
  check('Stevenson-Arce: 12 taps, sums to 1, every tap has dx+dy even',
    se.length === 12 && near(se.reduce((s, t) => s + t[2], 0), 1) && se.every(t => (t[0] + t[1]) % 2 === 0));
  check('Stevenson-Arce weights /200', se.some(t => near(t[2], 32 / 200)) && se.filter(t => near(t[2], 5 / 200)).length === 2);
  const k = D.kernel('park-kang-kim');
  check('Park-Kang-Kim kernels as printed (A sums to 0.969, B to 1.0000)',
    near(k.a.reduce((s, t) => s + t[2], 0), 0.969) && near(k.b.reduce((s, t) => s + t[2], 0), 1.0));
  check('Shiau-Fan next-row taps never reach right', ['shiau-fan-1', 'shiau-fan-2'].every(id => D.kernel(id).filter(t => t[1] === 1).every(t => t[0] <= 0)));
}

// -- rectangular matrices ------------------------------------------------------------------------------------
const perm = (m, n) => { const f = m.flat().slice().sort((a, b) => a - b); return f.length === n && f.every((v, i) => v === i); };
const PRINTED = {
  'bayer-2': [[0,3],[2,1]],
  'bayer-4': [[0,12,3,15],[8,4,11,7],[2,14,1,13],[10,6,9,5]],
  'cluster-4': [[12,5,6,13],[4,0,1,7],[11,3,2,8],[15,10,9,14]],
  'cluster-5x3': [[9,3,0,6,12],[10,4,1,7,13],[11,5,2,8,14]]
};
for (const [id, grid] of Object.entries(PRINTED)) {
  check(`${id} equals the printed grid`, JSON.stringify(D.matrix(id).levels) === JSON.stringify(grid));
}
check('bayer-8 row 0 and column 0 as printed', D.matrix('bayer-8').levels[0].join() === '0,48,12,60,3,51,15,63' &&
  D.matrix('bayer-8').levels.map(r => r[0]).join() === '0,32,8,40,2,34,10,42');
check('cluster-8 row 0 and row 7 as printed', D.matrix('cluster-8').levels[0].join() === '24,10,12,26,35,47,49,37' &&
  D.matrix('cluster-8').levels[7].join() === '32,40,54,38,31,21,19,29');
for (const id of ['bayer-2', 'bayer-4', 'bayer-8', 'cluster-4', 'cluster-8', 'cluster-5x3']) {
  const m = D.matrix(id);
  check(`${id}: a permutation of 0..N-1`, perm(m.levels, m.n));
}
{
  // ZX Paintbrush's Bayer is the TRANSPOSE of the textbook matrix the fade brush and gradient use (which stay as they are).
  const textbook4 = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const z = D.matrix('bayer-4').levels;
  check('Bayer 4x4 is the transpose of the textbook matrix', z.every((r, y) => r.every((v, x) => v === textbook4[x][y])));
}

// -- lattice methods -----------------------------------------------------------------------------------------
const LATTICE_ROW0 = {
  'cross-3x3': '0,1,2,4,3',
  'cross-4x3': '0,5,3,4,2,7,1,6',
  'diagonal-cross-5x4': '5,2,6,9,8,4,7,3,0,1',
  'diagonal-cross-4x4': '3,8,5,4,7,6,2,9,0,1',
  'supercell-cross-3x3': '10,17,15,3,7,9,18,12,0,4',
  'supercell-cross-4x3': '20,2,17,11,13,7,23,5',
  'supercell-diagonal-cross-5x4': '1,5,21,10,26,38,34,16',
  'supercell-diagonal-cross-4x4': '4,10,25,15,12,21,18,7'
};
const TILE = { 'cross-3x3': [5,5], 'cross-4x3': [8,8], 'diagonal-cross-5x4': [10,10], 'diagonal-cross-4x4': [10,5],
  'supercell-cross-3x3': [10,10], 'supercell-cross-4x3': [24,24], 'supercell-diagonal-cross-5x4': [40,40], 'supercell-diagonal-cross-4x4': [30,5] };
for (const [id, row0] of Object.entries(LATTICE_ROW0)) {
  const m = D.matrix(id), want = TILE[id];
  check(`${id}: tile ${want[0]}x${want[1]}`, m.w === want[0] && m.h === want[1], `${m.w}x${m.h}`);
  const head = m.levels[0].slice(0, row0.split(',').length).join();
  check(`${id}: first row as the help prints it`, head === row0, head);
  const counts = new Map();
  m.levels.flat().forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  const per = m.w * m.h / m.n;
  const exceptional = id === 'supercell-diagonal-cross-5x4';
  check(`${id}: every level used ${per} times`,
    exceptional ? (counts.get(16) === 2 * per && !counts.has(19) && counts.size === m.n - 1)
                : ([...counts.values()].every(c => c === per) && counts.size === m.n),
    JSON.stringify([...counts.entries()].slice(0, 6)));
}

// -- thresholds: exact ---------------------------------------------------------------------------------------
{
  const g = Uint8Array.from({ length: 256 }, (_, i) => i);
  const cut = (id) => { const o = D.apply(g, 256, 1, id); let n = 0; while (n < 256 && o[n] === 1) n++; return n; };
  check('threshold 25 %: ink for grey <= 63', cut('threshold-25') === 64);
  check('threshold 50 %: ink for grey <= 127', cut('threshold-50') === 128);
  check('threshold 75 %: ink for grey <= 191', cut('threshold-75') === 192);
}

// -- uniform fields and ramps --------------------------------------------------------------------------------
{
  let ok = true, why = '';
  for (const m of D.METHODS.filter(m => m.levels !== null && m.family !== 'threshold')) {
    const t = D.matrix(m.id);
    for (const grey of [0, 1, 40, 96, 128, 200, 254, 255]) {
      const field = new Uint8Array(t.w * t.h).fill(grey);
      const ink = D.apply(field, t.w, t.h, m.id).reduce((s, v) => s + v, 0);
      let want = 0;
      t.levels.flat().forEach(lv => { if (2 * m.levels * grey < (2 * lv + 1) * 255) want++; });
      if (ink !== want) { ok = false; why = `${m.id} grey ${grey}: ${ink} vs ${want}`; }
    }
  }
  check('ordered methods: ink count over one tile follows the level rule for every grey', ok, why);
}
{
  const W = 256, H = 120;
  const ramp = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp[y * W + x] = x;
  let worst = '';
  const bandOk = (id, serp, tol) => {
    const o = D.apply(ramp, W, H, id, { serpentine: serp });
    for (let b = 0; b < 8; b++) {
      let ink = 0, grey = 0;
      for (let y = 0; y < H; y++) for (let x = b * 32; x < b * 32 + 32; x++) { ink += o[y * W + x]; grey += ramp[y * W + x]; }
      const gotDensity = ink / (32 * H), wantDensity = 1 - grey / (32 * H) / 255;
      if (Math.abs(gotDensity - wantDensity) > tol) { worst = `${id} band ${b}: ${gotDensity.toFixed(3)} vs ${wantDensity.toFixed(3)}`; return false; }
    }
    return true;
  };
  for (const m of D.METHODS) {
    if (m.family === 'threshold') continue;
    if (m.family === 'diffusion') {
      const tol = m.id === 'atkinson' ? 0.12 : 0.03;
      check(`${m.id}: ramp density per band (raster)`, bandOk(m.id, false, tol), worst);
      check(`${m.id}: ramp density per band (serpentine)`, bandOk(m.id, true, tol), worst);
    } else {
      check(`${m.id}: ramp density per band`, bandOk(m.id, false, 1 / (2 * m.levels) + 0.03), worst);
    }
  }
}

// -- Floyd-Steinberg by hand ---------------------------------------------------------------------------------
{
  const img = [64,64,64,64, 128,128,128,128, 192,192,192,192, 32,96,160,224];
  const out = D.apply(Uint8Array.from(img), 4, 4, 'floyd-steinberg');
  const rows = [0, 1, 2, 3].map(y => Array.from(out.slice(y * 4, y * 4 + 4)).join(''));
  check('Floyd-Steinberg: hand-computed 4x4', rows.join('/') === '1111/0001/0100/1100', rows.join('/'));
}

// -- determinism, options, errors ----------------------------------------------------------------------------
{
  const g = new Uint8Array(64 * 48);
  let s = 12345;
  for (let i = 0; i < g.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; g[i] = (s >> 8) & 255; }
  let same = true;
  for (const id of ids) {
    const a = D.apply(g, 64, 48, id), b = D.apply(g, 64, 48, id);
    if (a.join() !== b.join()) same = false;
  }
  check('every method is deterministic', same);
  const fs1 = D.apply(g, 64, 48, 'floyd-steinberg'), fs2 = D.apply(g, 64, 48, 'floyd-steinberg', { serpentine: true });
  check('serpentine is off by default and changes error diffusion', fs1.join() !== fs2.join() &&
    D.apply(g, 64, 48, 'floyd-steinberg', { serpentine: false }).join() === fs1.join());
  const o1 = D.apply(g, 64, 48, 'bayer-4'), o2 = D.apply(g, 64, 48, 'bayer-4', { originX: 1 });
  check('origin shifts an ordered method', o1.join() !== o2.join());
  check('origin by one whole tile changes nothing', D.apply(g, 64, 48, 'bayer-4', { originX: 4, originY: 8 }).join() === o1.join());
  check('all black is all ink, all white is none, for every method',
    ids.every(id => D.apply(new Uint8Array(40 * 30), 40, 30, id).every(v => v === 1) &&
                    D.apply(new Uint8Array(40 * 30).fill(255), 40, 30, id).every(v => v === 0)));
  check('one pixel wide and high images work', ids.every(id => D.apply(Uint8Array.from([100]), 1, 1, id).length === 1 &&
    D.apply(new Uint8Array(9).fill(100), 9, 1, id).length === 9 && D.apply(new Uint8Array(9).fill(100), 1, 9, id).length === 9));
  let threw = 0;
  try { D.apply(g, 64, 48, 'nope'); } catch (e) { threw++; }
  try { D.apply(g, 10, 10, 'bayer-4'); } catch (e) { threw++; }
  check('bad method and bad length throw', threw === 2);
  check('luma is Rec.601', near(D.luma(255, 255, 255), 255) && near(D.luma(255, 0, 0), 76.245));
}

summary();
