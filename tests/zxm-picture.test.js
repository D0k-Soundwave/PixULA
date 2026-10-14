'use strict';
/**
 * Batch 11B3: .zxm as ZX Paintbrush uses it - the PICTURE (base) plus its map ELEMENTS and their places. buildPictureText writes a screen and the elements
 * that belong to a standard 32 x 24 picture; parseText reads the picture and the elements back.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs();
loadModule('js/utils/map-find.js');
loadModule('js/utils/map-codec.js');
loadModule('js/io/zxm-format.js');
const F = ZXMFormat;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const scr = MapFind.make(32, 24, 8, 1);
scr.attrs.fill(0x38);
const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
for (const [cx, cy] of [[3, 4], [10, 4], [20, 15]]) { for (let r = 0; r < 8; r++) scr.bitmap[(cy * 32 + cx) * 8 + r] = CIRCLE[r]; scr.attrs[cy * 32 + cx] = 0x3A; }
const block = MapFind.slice(scr, 3, 4, 1, 1);
const el1 = { name: 'Circle', w: 1, h: 1, screens: 1, gridW: 32, gridH: 24, match: 'exact', bitmap: block.bitmap, attrs: block.attrs, positions: [{ x: 3, y: 4 }, { x: 10, y: 4 }, { x: 20, y: 15 }] };
const b2 = MapFind.slice(scr, 3, 4, 2, 1);
const el2 = { name: 'Pair', w: 2, h: 1, screens: 1, gridW: 32, gridH: 24, match: 'dots', bitmap: b2.bitmap, attrs: b2.attrs, positions: [{ x: 3, y: 4 }] };
const gig = { ...el1, name: 'Giga', screens: 2, bitmap: new Uint8Array(16), attrs: new Uint8Array(2) };
const wide = { ...el1, name: 'Wide', gridW: 64 };

const out = F.buildPictureText(scr, [el1, el2, gig, wide]);
check('elements of a standard picture are written; others are counted as left out', out.written === 2 && out.leftOut === 2);
const text = out.text;
check('the file starts with the base picture section and ends with the end marker', text.startsWith('[Base ZXP picture]') && text.trim().endsWith('[End of file]'));
check('one element picture and one position list per element', (text.match(/\[Map ZXP picture\]/g) || []).length === 2 && (text.match(/\[Map positions\]/g) || []).length === 2);
check('positions are in pixels: cell (10,4) is [80,32]', text.includes('[80,32]') && text.includes('[24,32]') && text.includes('[160,120]'));
check('lines end CRLF like the rest of the format', text.includes('\r\n') && !/[^\r]\n/.test(text));

const back = F.parseText(text);
check('it reads back', back.success, back.error);
check('the picture comes back byte for byte', back.picture && back.picture.width === 256 && back.picture.height === 192 && (() => {
  for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) {
    const want = (scr.bitmap[((y >> 3) * 32 + (x >> 3)) * 8 + (y & 7)] >> (7 - (x & 7))) & 1;
    if (back.picture.bits[y * 256 + x] !== want) return false;
  }
  return back.picture.attrs[4 * 32 + 3] === 0x3A && back.picture.attrs[0] === 0x38;
})());
check('the elements come back: size, cells, places', back.elements.length === 2 && back.elements[0].img.width === 8 && back.elements[1].img.width === 16
  && eq(back.elements[0].positions, [{ x: 24, y: 32 }, { x: 80, y: 32 }, { x: 160, y: 120 }]));
check('(the tile map is still produced for the Map Editor)', !!back.doc && back.doc.tiles.length > 0);

// turning parsed elements into stored elements
const els = F.elementsFromParsed(back.elements);
check('stored elements: match exact, grid 32 x 24, one screen, cell places', els.elements.length === 2 && els.elements[0].match === 'exact' && els.elements[0].gridW === 32 && els.elements[0].screens === 1
  && eq(els.elements[0].positions, [{ x: 3, y: 4 }, { x: 10, y: 4 }, { x: 20, y: 15 }]) && els.rounded === 0 && els.dropped === 0);
check('the dots and attributes are the ones written', eq(Array.from(els.elements[0].bitmap), Array.from(block.bitmap)) && els.elements[0].attrs[0] === 0x3A);
const odd = F.elementsFromParsed([{ img: back.elements[0].img, positions: [{ x: 25, y: 33 }, { x: 24, y: 32 }, { x: 4000, y: 0 }, { x: -8, y: 0 }] }]);
check('places not on a cell are rounded (and counted); places off the picture are dropped (and counted)', odd.rounded === 1 && odd.dropped === 2 && eq(odd.elements[0].positions, [{ x: 3, y: 4 }]));
const none = F.elementsFromParsed([{ img: back.elements[0].img, positions: [{ x: 4000, y: 0 }] }]);
check('an element with no place left is not kept', none.elements.length === 0 && none.dropped === 1);

// every element round-trips with MapCodec too (so they can be stored)
check('the stored elements encode', !!MapCodec.encode({ name: '', tileKind: 'ula-cell', tiles: [], map: { width: 1, height: 1, cells: Int16Array.of(-1) }, elements: els.elements }));
check('a picture with no elements writes just the base', !F.buildPictureText(scr, []).text.includes('[Map ZXP picture]'));
check('the tile-map writer is still the one the Map Editor uses', typeof F.exportTileMap === 'function' && typeof F.parseTileMap === 'function');

// odd inputs (group D review): a negative place is dropped (not a refusal of the whole file); an element with no places is counted
{
  const mk = (positions) => ({ img: back.elements[0].img, positions });
  const neg = F.elementsFromParsed([mk([{ x: -8, y: 0 }, { x: 24, y: 32 }])]);
  check('a negative place is dropped and counted, the others stay', neg.elements.length === 1 && neg.dropped === 1 && neg.elements[0].positions.length === 1);
  const empty = F.elementsFromParsed([mk([])]);
  check('an element with an empty place list is not kept and is counted', empty.elements.length === 0 && empty.dropped === 1);
  const wide = F.elementsFromParsed([{ img: { width: 264, height: 8, bits: new Uint8Array(264 * 8), attrs: new Uint8Array(33) }, positions: [{ x: 0, y: 0 }] }]);
  check('an element wider than the picture is dropped', wide.elements.length === 0 && wide.dropped === 1);
  const txt = text.replace('[80,32]', '[-8,32]');
  check('a file with a negative place still reads', F.parseText(txt).success === true);
}

summary();
