'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/map-codec.js');
loadModule('js/io/zxm-format.js');

const F = ZXMFormat;

function makeDoc(width, height, placements, tileCount) {
  const tiles = [];
  for (let t = 0; t < tileCount; t++) {
    tiles.push({
      kind: 'ula-cell',
      bitmap: Uint8Array.from({ length: 8 }, (_, y) => (t * 41 + y * 13 + 1) & 0xFF),
      attr: (t * 31 + 5) & 0xFF
    });
  }
  const cells = new Int16Array(width * height);
  cells.fill(-1);
  for (const [x, y, i] of placements) cells[y * width + x] = i;
  return { name: 'test', tileKind: 'ula-cell', tiles, map: { width, height, cells } };
}

function docsEqual(a, b) {
  if (a.tiles.length !== b.tiles.length) return `tile count ${a.tiles.length}≠${b.tiles.length}`;
  for (let i = 0; i < a.tiles.length; i++) {
    if (a.tiles[i].attr !== b.tiles[i].attr) return `tile ${i} attr`;
    for (let j = 0; j < 8; j++) {
      if (a.tiles[i].bitmap[j] !== b.tiles[i].bitmap[j]) return `tile ${i} byte ${j}`;
    }
  }
  if (a.map.width !== b.map.width || a.map.height !== b.map.height) {
    return `dims ${b.map.width}x${b.map.height}`;
  }
  for (let i = 0; i < a.map.cells.length; i++) {
    if (a.map.cells[i] !== b.map.cells[i]) return `cell ${i}`;
  }
  return true;
}

// ── header / field byte checks ──────────────────────────────────────────────
{
  const doc = makeDoc(32, 24, [[0, 0, 0], [3, 2, 1], [31, 23, 1]], 2);
  const text = F.buildText(doc);
  const lines = text.split('\r\n');

  check('file starts with the [Base ZXP picture] section', lines[0] === '[Base ZXP picture]');
  check('base picture carries the ZXP identifier', lines[1] === 'ZX-Paintbrush image');
  check('identifier is followed by a blank line', lines[2] === '');
  check('base bitmap is 192 rows of 256 pixel chars',
    lines[3].length === 256 && /^[01]+$/.test(lines[3]) &&
    lines[3 + 191].length === 256 && lines[3 + 192] === '');
  check('base attributes are 24 rows of 32 hex bytes', (() => {
    const first = lines[3 + 193];
    const parts = first.split(' ');
    return parts.length === 32 && parts.every(p => /^[0-9A-F]{2}$/.test(p));
  })());
  check('tile at (0,0) renders its attr into the base picture',
    lines[3 + 193].split(' ')[0] === doc.tiles[0].attr.toString(16).toUpperCase().padStart(2, '0'));
  check('empty cells render the default attr 38',
    lines[3 + 193].split(' ')[1] === '38');
  check('one [Map ZXP picture] section per tile',
    text.split('[Map ZXP picture]').length - 1 === 2);
  check('one [Map positions] section per tile',
    text.split('[Map positions]').length - 1 === 2);
  check('positions are cell-aligned pixel coordinates in [x,y] form',
    text.includes('[24,16]') /* tile 1 at map (3,2) */ &&
    text.includes('[248,184]') /* tile 1 at map (31,23) */ &&
    text.includes('[0,0]'));
  check('file ends with [End of file]', text.trimEnd().endsWith('[End of file]'));

  // element block shape: 8 bitmap rows of 8 chars + 1 attr byte
  const elStart = lines.indexOf('[Map ZXP picture]');
  check('element is an 8×8 ZXP block',
    lines[elStart + 1] === 'ZX-Paintbrush image' && lines[elStart + 2] === '' &&
    lines[elStart + 3].length === 8 && lines[elStart + 11] === '' &&
    /^[0-9A-F]{2}$/.test(lines[elStart + 12]));
}

// ── round-trips ─────────────────────────────────────────────────────────────
{
  // One-screen map, all tiles used
  const doc = makeDoc(32, 24, [[0, 0, 0], [5, 5, 1], [6, 5, 2], [31, 23, 0]], 3);
  const back = F.parseText(F.buildText(doc));
  check('one-screen round-trip parses', back.success === true, back.error);
  const result = back.success && docsEqual(doc, back.doc);
  check('one-screen round-trip is identical', result === true, String(result));
}
{
  // Multi-screen map (the point of the editor) with an UNUSED tile —
  // dimensions are inferred from the position extent
  const doc = makeDoc(40, 30, [[0, 0, 0], [39, 29, 1], [12, 26, 0]], 3);
  const back = F.parseText(F.buildText(doc));
  check('multi-screen round-trip parses', back.success === true, back.error);
  const result = back.success && docsEqual(doc, back.doc);
  check('multi-screen round-trip keeps off-screen placements and unused tiles',
    result === true, String(result));
}

// ── foreign-file tolerance ──────────────────────────────────────────────────
{
  // Hand-written file: LF endings, unbracketed positions, 16×8 element
  // (sliced into two tiles), '*' transparency in the element
  const blank = Array(192).fill('0'.repeat(256)).join('\n');
  const attrs = Array(24).fill(Array(32).fill('38').join(' ')).join('\n');
  const text = [
    '[Base ZXP picture]', 'ZX-Paintbrush image', '', blank, '', attrs, '',
    '[Map ZXP picture]', 'ZX-Paintbrush image', '',
    '10000000*0000001', '0100000000000010', '0010000000000100', '0001000000001000',
    '0000100000010000', '0000010000100000', '0000001001000000', '0000000110000000',
    '', '47 56', '',
    '[Map positions]', '16,8', '',
    '[End of file]', ''
  ].join('\n');
  const back = F.parseText(text);
  check('foreign file (LF, bare positions, 16×8 element) parses',
    back.success === true, back.error);
  if (back.success) {
    check('multi-cell element is sliced into per-cell tiles',
      back.doc.tiles.length === 2 &&
      back.doc.tiles[0].attr === 0x47 && back.doc.tiles[1].attr === 0x56);
    check('transparent * pixels read as paper',
      (back.doc.tiles[0].bitmap[0] & 0x80) !== 0 && back.doc.map.cells[1 * 32 + 2] === 0 &&
      back.doc.map.cells[1 * 32 + 3] === 1);
    check('inferred map is at least one screen',
      back.doc.map.width === 32 && back.doc.map.height === 24);
  }
}

// ── error paths (mirroring the ZX-Paintbrush loader messages) ───────────────
const blankScreen = () =>
  ['[Base ZXP picture]', 'ZX-Paintbrush image', '',
   Array(192).fill('0'.repeat(256)).join('\r\n'), '',
   Array(24).fill(Array(32).fill('38').join(' ')).join('\r\n'), ''].join('\r\n');

check('rejects a file without a base picture',
  F.parseText('[Map positions]\r\n[End of file]\r\n').success === false);
check('rejects a second base picture',
  F.parseText(blankScreen() + '\r\n' + blankScreen() + '\r\n[End of file]\r\n').success === false);
check('rejects unknown sections',
  F.parseText(blankScreen() + '\r\n[Mystery section]\r\n[End of file]\r\n').success === false);
check('rejects a missing [End of file] marker',
  F.parseText(blankScreen()).success === false);
check('accepts base + EOF with no elements',
  F.parseText(blankScreen() + '\r\n[End of file]\r\n').success === true);
check('rejects an element without a position list', (() => {
  const el = ['[Map ZXP picture]', 'ZX-Paintbrush image', '',
    ...Array(8).fill('11110000'), '', '38', ''].join('\r\n');
  return F.parseText(blankScreen() + '\r\n' + el + '\r\n[End of file]\r\n').success === false;
})());
check('rejects bad position lines', (() => {
  const el = ['[Map ZXP picture]', 'ZX-Paintbrush image', '',
    ...Array(8).fill('11110000'), '', '38', '',
    '[Map positions]', 'over there', ''].join('\r\n');
  return F.parseText(blankScreen() + '\r\n' + el + '\r\n[End of file]\r\n').success === false;
})());
check('rejects transparent pixels in the base picture', (() => {
  const bad = blankScreen().replace('0'.repeat(256), '*' + '0'.repeat(255));
  return F.parseText(bad + '\r\n[End of file]\r\n').success === false;
})());
check('rejects the extended (8×1) screen format', (() => {
  const bad = blankScreen().replace('ZX-Paintbrush image', 'ZX-Paintbrush extended image');
  return F.parseText(bad + '\r\n[End of file]\r\n').success === false;
})());
check('rejects elements that are not cell-multiples', (() => {
  const el = ['[Map ZXP picture]', 'ZX-Paintbrush image', '',
    ...Array(4).fill('1111'), '', '38', '',
    '[Map positions]', '[0,0]', ''].join('\r\n');
  return F.parseText(blankScreen() + '\r\n' + el + '\r\n[End of file]\r\n').success === false;
})());

// ── canExportZxp() mirrors exportZxp()'s throw/no-throw across modes ───────
{
  const compatible = ['standard_ula', 'multicolor_8x4', 'multicolor_8x2',
    'multicolor_8x1', 'ula_plus', 'ula_plus_8x1'];
  const incompatible = ['timex_hires', 'gigascreen', 'layer2_256'];
  for (const id of compatible) {
    __setActiveScreenMode(id);
    check(`zxp canExport true in ${id}`, F.canExportZxp() === true);
  }
  for (const id of incompatible) {
    __setActiveScreenMode(id);
    check(`zxp canExport false in ${id}`, F.canExportZxp() === false);
  }
  __setActiveScreenMode('standard_ula');
}

summary();
