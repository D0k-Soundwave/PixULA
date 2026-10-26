'use strict';
/**
 * Typing in colour with a coloured CHX font (owner decision 2026-10-19), the pure half: where each 8x8 block of a coloured
 * letter lands in the drawn text (BitmapText.blockRects), turning those blocks into one attribute per picture cell or a
 * refusal (BitmapText.attrCells), the letters the layouts report, and the stamp write plan for a stamp whose uncoloured
 * cells are drawn with the attribute bar (stamp option uncoloured: 'rail').
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');
global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  packRGB(rgb) { return (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; },
  blitCellBits() {}, blitCellIndices() {}
};
global.setInterval = () => 0;
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/bitmap-text.js');
const B = BitmapText;

// -- blockRects ---------------------------------------------------------------
{
  // a 2 x 1 block letter drawn at its own size at (16, 8)
  const r = B.blockRects({ x: 16, y: 8, w: 16, h: 8, srcX0: 0, srcW: 16, srcH: 8 }, Uint8Array.from([5, 6]), 2);
  check('a 2-block letter at its own size gives two 8 x 8 rects', r && r.length === 2 &&
    r[0].x === 16 && r[0].y === 8 && r[0].w === 8 && r[0].h === 8 && r[0].attr === 5 &&
    r[1].x === 24 && r[1].w === 8 && r[1].attr === 6);
  const s = B.blockRects({ x: 0, y: 0, w: 48, h: 48, srcX0: 0, srcW: 16, srcH: 16 }, Uint8Array.from([1, 2, 3, 4]), 2);
  check('three times the size: each block is 24 x 24, in block order', s.length === 4 &&
    s.map(q => [q.x, q.y, q.w, q.h, q.attr].join()).join(' ') === '0,0,24,24,1 24,0,24,24,2 0,24,24,24,3 24,24,24,24,4');
  const p = B.blockRects({ x: 8, y: 0, w: 8, h: 8, srcX0: 8, srcW: 8, srcH: 8 }, Uint8Array.from([7, 9, 11]), 3);
  check('a proportional letter (its middle column saved) shows that column\'s attribute', p.length === 1 && p[0].attr === 9 && p[0].x === 8);
  check('a shown part that does not start on a block edge cannot be coloured', B.blockRects({ x: 0, y: 0, w: 4, h: 8, srcX0: 4, srcW: 4, srcH: 8 }, Uint8Array.from([1]), 1) === null);
  const odd = B.blockRects({ x: 0, y: 0, w: 12, h: 8, srcX0: 0, srcW: 8, srcH: 8 }, Uint8Array.from([1]), 1);
  check('a stretch by 1.5 gives a 12 pixel wide block (attrCells will refuse it)', odd.length === 1 && odd[0].w === 12);
}

// -- attrCells ----------------------------------------------------------------
{
  const rects = [{ x: 0, y: 0, w: 8, h: 8, attr: 0x47 }, { x: 16, y: 8, w: 16, h: 8, attr: 0x0A }];
  const c = B.attrCells(rects, 40, 16);
  check('cells: 5 x 2 for a 40 x 16 block', c.cols === 5 && c.rows === 2 && c.attrs.length === 10);
  check('each rect gives its cells its attribute; the rest is null (the attribute bar)', c.attrs[0] === 0x47 && c.attrs[1] === null &&
    c.attrs[7] === 0x0A && c.attrs[8] === 0x0A && c.attrs[5] === null && c.attrs[9] === null);
  check('a rect off the 8-pixel grid is refused', B.attrCells([{ x: 4, y: 0, w: 8, h: 8, attr: 1 }], 16, 8).blocked === 'geometry');
  check('a 12 pixel block is refused', B.attrCells([{ x: 0, y: 0, w: 12, h: 8, attr: 1 }], 16, 8).blocked === 'geometry');
  check('two blocks of different attributes in one cell are refused', B.attrCells([{ x: 0, y: 0, w: 8, h: 8, attr: 1 }, { x: 0, y: 0, w: 8, h: 8, attr: 2 }], 8, 8).blocked === 'geometry');
  check('a block hanging past the edge of the text keeps the cells inside', B.attrCells([{ x: 8, y: 0, w: 16, h: 8, attr: 3 }], 12, 8).attrs.join() === ',3');
}

// -- the letters the layouts report -------------------------------------------
{
  const g8 = new Uint8Array(16).fill(0xFF);               // 16 x 8 glyph, two blocks
  const o = { glyphOf: (c) => (c === ' ' ? null : g8), spanOf: () => ({ x0: 0, w: 16 }), fw: 16, w0: 16, h0: 8 };
  const n = B.nativeLine('ab', o);
  check('nativeLine reports each letter: character, where it starts, its width and the glyph column it shows from', n.letters.length === 2 &&
    n.letters[1].ch === 'b' && n.letters[1].x === 16 && n.letters[1].w === 16 && n.letters[1].x0 === 0);
  const lay = B.layout('ab\nc', { ...o, W: 32, H: 16, sx: 0, sy: 0, align: 'left' });
  const L = B.layoutLetters(lay);
  check('layout reports every letter in picture-block coordinates', L.length === 3);
  check('...stretched: a 16 wide letter at W 32 is 32 wide, H 16', L[1].x === 32 && L[1].w === 32 && L[1].h === 16 && L[1].srcW === 16 && L[1].srcH === 8);
  check('...the second line starts one line pitch down', L[2].ch === 'c' && L[2].y === 16 && L[2].x === 0);
  const sp = B.layout('ab', { ...o, W: 16, H: 8, sx: 3, sy: 0, align: 'left' });
  check('character spacing moves the second letter by the spacing', B.layoutLetters(sp)[1].x === 19);
}

// -- fontSource: only a font of whole 8-pixel columns is offered as coloured ----
{
  const glyphs = Array.from({ length: 96 }, () => new Uint8Array(8).fill(0xFC));
  const colours = Array.from({ length: 96 }, (_, i) => (i === 33 ? Uint8Array.of(0x42) : null));
  check('an 8-wide font with attributes is coloured', B.fontSource({ width: 8, height: 8, firstCode: 32, glyphs, colours }).coloured === true);
  const six = B.fontSource({ width: 6, height: 8, firstCode: 32, glyphs, colours });
  check('a 6-wide font (saved before narrowing dropped them) is not offered as coloured', six.coloured === false && six.coloursOf('A') === null);
}

// -- stamp option uncoloured: 'rail' survives a project round trip ------------
check('stamp option uncoloured: rail is kept', LayerManager._readStampOpts({ colours: 'coloured', uncoloured: 'rail' }).uncoloured === 'rail');
check('an unknown uncoloured value is dropped', LayerManager._readStampOpts({ uncoloured: 'x' }) === null);

// -- the write plan -----------------------------------------------------------
ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);
ColorManager.setInk(4); ColorManager.setPaper(1);          // the attribute bar: green Ink on blue Paper
{
  // 16 x 8 text block: the left cell coloured (attr: red Ink 2, yellow Paper 6, Bright), the right one from the bar
  const mask = Array.from({ length: 8 }, (_, y) => Array.from({ length: 16 }, (_, x) => x % 2 === 0 && y === 0));
  const attr = 2 | (6 << 3) | 0x40;
  const data = { mask, x: 8, y: 16, w: 16, h: 8, attrs: [attr, null], attrGrid: { cols: 2, rows: 1, cw: 8, ch: 8, ox: 0, oy: 0 },
    opts: { colours: 'coloured', uncoloured: 'rail' } };
  const plan = SelectionService.maskWritePlan(data);
  const left = plan.filter(w => w.x < 16), right = plan.filter(w => w.x >= 16);
  check('the coloured cell writes its own attributes, ink pixels and the rest of the cell', left.length === 64 &&
    left.every(w => w.sel.ink === 2 && w.sel.paper === 6 && w.sel.bright === true));
  check('the uncoloured cell writes only its ink pixels, with the attribute bar, as a Pixels stamp would', right.length === 4 &&
    right.every(w => w.sel.ink === 4 && w.sel.paper === 1 && w.mode === PixelDrawRoutine.resolveUserMode(true)));
  const hole = SelectionService.maskWritePlan({ ...data, opts: { colours: 'coloured' } });
  check('without uncoloured: rail a null cell is still a hole and writes nothing (every other stamp)', hole.every(w => w.x < 16) && hole.length === 64);
  SelectionService.bakeMask(data, 'Text');
  const t = LayerManager.layers[1];
  const cL = t.getCell(1, 2), cR = t.getCell(2, 2);
  check('baked: the coloured cell has the letter\'s attributes', cL.ink === 2 && cL.paper === 6 && cL.bright === true);
  check('baked: the other cell has the attribute bar\'s', cR.ink === 4 && cR.paper === 1);
  check('baked: the ink pixels are set in both cells', cL.pixels[0] === 0xAA && cR.pixels[0] === 0xAA);
}
summary();
