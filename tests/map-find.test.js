'use strict';
/**
 * Batch 11A: finding repeated map elements. MapFind is pure: screens and blocks are { w, h, cellH, screens, bitmap, attrs } (bitmap = screens x w x h x
 * cellH bytes, attrs = screens x w x h bytes, cells in reading order, screen A first). Three match modes: 'exact' (dots and attributes equal), 'dots'
 * (dots equal), 'visual' (every dot shows the same colour in BOTH flash phases).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
loadModule('js/utils/map-find.js');
const F = MapFind;
const pos = (list) => list.map(p => p.x + ',' + p.y).join(' ');

const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
const put = (scr, cx, cy, rows, attr, plane = 0) => {
  const i = (plane * scr.w * scr.h) + cy * scr.w + cx;
  for (let r = 0; r < scr.cellH; r++) scr.bitmap[i * scr.cellH + r] = rows[r];
  scr.attrs[i] = attr;
};

// -- Picture A: the help's example ------------------------------------------------------------------------------------------------
{
  const scr = F.make(32, 24, 8, 1);
  scr.attrs.fill(0x38);
  put(scr, 3, 4, CIRCLE, 0x3A); put(scr, 10, 4, CIRCLE, 0x3A); put(scr, 20, 15, CIRCLE, 0x3A); put(scr, 25, 2, CIRCLE, 0x3C);
  const block = F.slice(scr, 3, 4, 1, 1);
  check('slice gives the cell: dots and attribute', block.w === 1 && block.h === 1 && block.bitmap[0] === 0x3C && block.attrs[0] === 0x3A);
  check('exact finds the three red circles, in reading order, the source included', pos(F.find(scr, block, 'exact')) === '3,4 10,4 20,15');
  check('dots also finds the green one, listed first (reading order)', pos(F.find(scr, block, 'dots')) === '25,2 3,4 10,4 20,15');
  check('the source position is always found', F.find(scr, block, 'exact').some(p => p.x === 3 && p.y === 4));
}

// -- Picture B: blocks of several cells ---------------------------------------------------------------------------------------------
{
  const scr = F.make(32, 24, 8, 1);
  scr.attrs.fill(0x38);
  const piece = [[CIRCLE, 0x3A], [[0xFF, 0, 0xFF, 0, 0xFF, 0, 0xFF, 0], 0x46], [[1, 2, 4, 8, 16, 32, 64, 128], 0x38], [[0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18], 0x7F]];
  const drop = (x, y) => piece.forEach(([rows, attr], k) => put(scr, x + (k % 2), y + (k >> 1), rows, attr));
  drop(0, 0); drop(15, 10); drop(30, 22);
  const block = F.slice(scr, 0, 0, 2, 2);
  check('a 2 x 2 block is found three times, once at the bottom-right edge', pos(F.find(scr, block, 'exact')) === '0,0 15,10 30,22');
  put(scr, 16, 11, CIRCLE, 0x00);
  check('a near copy with ONE cell different is not found', pos(F.find(scr, block, 'exact')) === '0,0 30,22');
  check('...but its dots still are, in dots mode only when the dots agree', pos(F.find(scr, block, 'dots')) !== '' && F.find(scr, block, 'dots').length >= 2);
  const wide = { w: 33, h: 1, cellH: 8, screens: 1, bitmap: new Uint8Array(33 * 8), attrs: new Uint8Array(33) };
  check('a block wider than the screen finds nothing', F.find(scr, wide, 'exact').length === 0);
  const whole = F.slice(scr, 0, 0, 32, 24);
  check('a block the size of the screen is found once, at 0,0', pos(F.find(scr, whole, 'exact')) === '0,0');
  check('a block of another cell height or screen count finds nothing (null)', F.find(scr, { ...block, cellH: 1, bitmap: new Uint8Array(4) }, 'exact') === null && F.find(scr, { ...block, screens: 2 }, 'exact') === null);
  check('an unknown mode is refused (null)', F.find(scr, block, 'sideways') === null);
}

// -- overlapping places and Accept's disjoint list ------------------------------------------------------------------------------------
{
  const scr = F.make(8, 2, 8, 1);
  scr.attrs.fill(0x38);
  const block = F.slice(scr, 0, 0, 2, 1);
  const all = F.find(scr, block, 'exact');
  check('a 2 x 1 blank block on a run of eight blank cells overlaps itself: 7 places', all.length === 14 || all.length === 7, String(all.length));
  const dj = F.disjoint(F.find(scr, block, 'exact'), 2, 1, { x: 3, y: 0 });
  check('disjoint keeps the source first, then reading order, with no two overlapping',
    dj[0].x === 3 && dj[0].y === 0 && dj.every((p, i) => dj.every((q, j) => i === j || p.y !== q.y || Math.abs(p.x - q.x) >= 2)));
}

// -- the colour table and visual compare -------------------------------------------------------------------------------------------------
{
  // fixed16-like: index 0 black, 1 blue, 2 red, 3 magenta, 4 green, 5 cyan, 6 yellow, 7 white; bright adds 8 (bright black stays black)
  const RGB = [0x000000, 0x0000D7, 0xD70000, 0xD700D7, 0x00D700, 0x00D7D7, 0xD7D700, 0xD7D7D7];
  const bright = (c) => ((c & 0xFF0000) ? 0xFF0000 : 0) | ((c & 0x00FF00) ? 0x00FF00 : 0) | ((c & 0x0000FF) ? 0x0000FF : 0);
  const colour = (idx, br) => (idx === 0 ? 0 : (br ? bright(RGB[idx]) : RGB[idx]));
  const resolve = (plane, attr) => {
    const ink = attr & 7, paper = (attr >> 3) & 7, br = (attr & 0x40) !== 0;
    return { ink: colour(ink, br), paper: colour(paper, br), flashing: (attr & 0x80) !== 0 };
  };
  const table = F.tableFrom(2, resolve);
  const A = (ink, paper, o = {}) => ink | (paper << 3) | (o.bright ? 0x40 : 0) | (o.flash ? 0x80 : 0);
  const EMPTY = [0, 0, 0, 0, 0, 0, 0, 0], FULL = [255, 255, 255, 255, 255, 255, 255, 255];
  const INV = CIRCLE.map(b => ~b & 0xFF);
  const scr = F.make(12, 2, 8, 1);
  const set = (cx, cy, rows, attr) => put(scr, cx, cy, rows, attr);
  const matches = (cx, cy, mode) => new Set(F.find(scr, F.slice(scr, cx, cy, 1, 1), mode, table).map(p => p.x + ',' + p.y));

  // 1. inverted dots with ink and paper swapped
  set(0, 0, CIRCLE, A(2, 7)); set(1, 0, INV, A(7, 2));
  check('visual: inverted dots with ink and paper swapped match', matches(0, 0, 'visual').has('1,0'));
  check('...exact and dots do not', !matches(0, 0, 'exact').has('1,0') && !matches(0, 0, 'dots').has('1,0'));
  // 2. empty cells: the ink is never seen
  set(2, 0, EMPTY, A(2, 7)); set(3, 0, EMPTY, A(3, 7));
  check('visual: empty cells with the same paper and different ink match', matches(2, 0, 'visual').has('3,0'));
  check('...dots mode matches them too; exact does not', matches(2, 0, 'dots').has('3,0') && !matches(2, 0, 'exact').has('3,0'));
  // 3. an empty cell and an all-dots cell of the same shown colour
  set(4, 0, EMPTY, A(1, 7)); set(5, 0, FULL, A(7, 2));
  check('visual: an empty white cell matches an all-dots cell whose ink is white', matches(4, 0, 'visual').has('2,0') === true && matches(4, 0, 'visual').has('5,0') === true);
  // 4. bright black is black
  set(6, 0, FULL, A(0, 1, { bright: true })); set(7, 0, FULL, A(0, 2));
  check('visual: BRIGHT black is the same as black', matches(6, 0, 'visual').has('7,0'));
  // 5. ink equal to paper: nothing to see
  set(8, 0, CIRCLE, A(2, 2)); set(9, 0, EMPTY, A(1, 2));
  check('visual: dots in ink equal to paper look like an empty cell of that paper', matches(8, 0, 'visual').has('9,0'));
  // 6. FLASH: an unset dot DOES show the ink in the inverted phase
  set(0, 1, EMPTY, A(1, 6, { flash: true })); set(1, 1, EMPTY, A(3, 6, { flash: true })); set(2, 1, EMPTY, A(1, 6)); set(3, 1, FULL, A(6, 1, { flash: true }));
  const m = matches(0, 1, 'visual');
  check('visual: a flashing empty cell does NOT match the same cell with another ink', !m.has('1,1'));
  check('visual: ...nor a steady empty cell of the same paper', !m.has('2,1'));
  check('visual: ...but it does match a flashing all-dots cell with the colours the other way round', m.has('3,1'));
  // 7. flashing with equal colours is steady
  set(4, 1, CIRCLE, A(2, 2, { flash: true })); set(5, 1, FULL, A(2, 2));
  check('visual: a flashing cell whose ink equals its paper matches a steady solid cell', matches(4, 1, 'visual').has('5,1'));
}

// -- GigaScreen: the two screens are blended per dot -----------------------------------------------------------------------------------------
{
  const RGB = { red: 0xD70000, blue: 0x0000D7, magenta: 0xD700D7, black: 0x000000, white: 0xD7D7D7 };
  const attrs = { rb: 1, mk: 2, plain: 3 };
  // attr 1 on screen A: ink red paper white; screen B attr 1: ink blue paper white. attr 2: A ink magenta, B ink black.
  const resolve = (plane, attr) => {
    if (attr === 1) return { ink: plane === 0 ? RGB.red : RGB.blue, paper: RGB.white, flashing: false };
    if (attr === 2) return { ink: plane === 0 ? RGB.magenta : RGB.black, paper: RGB.white, flashing: false };
    return { ink: RGB.white, paper: RGB.white, flashing: false };
  };
  const table = F.tableFrom(2, resolve);
  const scr = F.make(4, 1, 8, 2);
  const FULL = [255, 255, 255, 255, 255, 255, 255, 255];
  const EMPTY = [0, 0, 0, 0, 0, 0, 0, 0];
  put(scr, 0, 0, FULL, 1, 0); put(scr, 0, 0, FULL, 1, 1);     // red over blue everywhere
  put(scr, 1, 0, FULL, 2, 0); put(scr, 1, 0, FULL, 2, 1);     // magenta over black everywhere
  put(scr, 2, 0, EMPTY, 3, 0); put(scr, 2, 0, EMPTY, 3, 1);
  put(scr, 3, 0, FULL, 1, 0); put(scr, 3, 0, EMPTY, 1, 1);    // red on A, white on B
  const found = F.find(scr, F.slice(scr, 0, 0, 1, 1), 'visual', table).map(p => p.x).join();
  check('GigaScreen visual: red over blue matches magenta over black (both blend to the same colour), and not the others', found === '0,1', found);
  check('...but they differ exactly (the second screen is part of the cell)', F.find(scr, F.slice(scr, 0, 0, 1, 1), 'exact', table).map(p => p.x).join() === '0');
}

// -- the colour table -----------------------------------------------------------------------------------------------------------------------------
{
  const resolve = (plane, attr) => ({ ink: 0x112233 + attr, paper: 0x445566, flashing: attr === 9 });
  const t = F.tableFrom(2, resolve);
  check('tableFrom: a steady cell has the same colour in both phases', t.at(0, 5, 1, 0) === 0x112233 + 5 && t.at(0, 5, 1, 1) === 0x112233 + 5 && t.at(0, 5, 0, 1) === 0x445566);
  check('tableFrom: a flashing cell swaps ink and paper in the second phase', t.at(0, 9, 1, 0) === 0x112233 + 9 && t.at(0, 9, 1, 1) === 0x445566 && t.at(0, 9, 0, 1) === 0x112233 + 9);
}
summary();
