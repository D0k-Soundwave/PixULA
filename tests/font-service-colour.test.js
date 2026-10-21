'use strict';
/**
 * Coloured characters in the working font (owner decision 2026-10-19): FontService keeps per-glyph block attributes or
 * none, every font-level operation carries them, and the Font Editor's undo snapshots hold them.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const fakeStore = {};
const events = [];
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', FONTS: 'fonts' },
    async set(key, value, store) { fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; },
    async delete(key, store) { delete fakeStore[`${store}/${key}`]; }
  },
  EventBus: { emit: (name, data) => events.push([name, data]), on() {} }
});
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');
loadModule('js/utils/font-history.js');
loadModule('js/services/font-service.js');
const S = FontService;
const same = (a, b) => !!a && !!b && a.length === b.length && Array.from(a).every((v, i) => v === b[i]);
const INK2_PAPER7 = 2 | (7 << 3);           // red Ink on white Paper
const BRIGHT_FLASH = 6 | (1 << 3) | 0x40 | 0x80;

(async () => {
  // -- the default font has no colours ----------------------------------------
  check('the ROM font has no colours', S.hasColours() === false && S.getColours(65) === null);
  check('an 8 x 8 font takes attributes', S.coloursAllowed() === true);
  check('the document of an uncoloured font has colours null', S.toDocument().colours === null);

  // -- first block on an uncoloured character colours every block ------------
  check('newBigFont 2 x 2', S.newBigFont({ cols: 2, rows: 2, coverage: 'ASCII' }));
  check('blocks of a 16 x 16 font: 2 x 2', S.blockGrid().cols === 2 && S.blockGrid().rows === 2);
  events.length = 0;
  check('setBlockAttr on an uncoloured character works', S.setBlockAttr(65, 1, 0, INK2_PAPER7) === true);
  check('...and colours EVERY block with it (the file colours a character as a whole)', same(S.getColours(65), [INK2_PAPER7, INK2_PAPER7, INK2_PAPER7, INK2_PAPER7]));
  check('...announcing FONT_CHANGED once', events.filter(e => e[0] === EVENTS.FONT_CHANGED).length === 1);
  check('a second setBlockAttr changes only that block', S.setBlockAttr(65, 0, 1, BRIGHT_FLASH) && same(S.getColours(65), [INK2_PAPER7, INK2_PAPER7, BRIGHT_FLASH, INK2_PAPER7]));
  events.length = 0;
  check('setting a block to the attribute it already has changes nothing', S.setBlockAttr(65, 0, 1, BRIGHT_FLASH) === false && events.length === 0);
  check('hasColours is true now', S.hasColours() === true);
  check('a block outside the character is refused', S.setBlockAttr(65, 2, 0, 1) === false && S.setBlockAttr(65, 0, -1, 1) === false);
  check('an attribute outside 0..255 is refused', S.setBlockAttr(65, 0, 0, 256) === false && S.setBlockAttr(65, 0, 0, 1.5) === false);
  check('a code outside the coverage is refused', S.setBlockAttr(5, 0, 0, 1) === false);
  check('other characters stay uncoloured', S.getColours(66) === null);
  check('setAllBlocks gives every block one attribute', S.setAllBlocks(66, 0x47) && same(S.getColours(66), [0x47, 0x47, 0x47, 0x47]));

  // -- the document and the codec ---------------------------------------------
  const doc = S.toDocument();
  check('the document carries one colours entry per glyph', Array.isArray(doc.colours) && doc.colours.length === 96 && doc.colours[0] === null);
  const p = FontCodec.encode(doc);
  const back = FontCodec.decode(p);
  check('the working font persists with its colours', back && same(back.colours[65 - 32], S.getColours(65)));

  // -- remove -----------------------------------------------------------------
  check('clearColours makes a character uncoloured', S.clearColours(66) === true && S.getColours(66) === null);
  check('clearColours of an uncoloured character changes nothing', S.clearColours(66) === false);

  // -- operations carry the colours -------------------------------------------
  {
    const g = new Uint8Array(32); g[0] = 0x80;
    S.setGlyph(65, g);
    check('setGlyph keeps the attributes', S.getColours(65) !== null);
    S.clearGlyph(65);
    check('Clear glyph empties the pixels and keeps the attributes', S.getColours(65) !== null && S.getGlyph(65).every(b => b === 0));
    S.setColoursFor(65, [1, 2, 3, 4]);
    S.flipGlyph(65, 'h');
    check('Flip H mirrors the block attributes with the pixels', same(S.getColours(65), [2, 1, 4, 3]));
    S.flipGlyph(65, 'v');
    check('Flip V mirrors them top to bottom', same(S.getColours(65), [4, 3, 2, 1]));
    S.shiftGlyph(65, 'left'); S.invertGlyph(65);
    check('Shift and Invert leave the attributes alone', same(S.getColours(65), [4, 3, 2, 1]));
    S.copyGlyph(65);
    S.pasteGlyph(70);
    check('copy and paste take the attributes along', same(S.getColours(70), [4, 3, 2, 1]));
    S.copyGlyph(71);
    S.pasteGlyph(70);
    check('pasting an uncoloured character makes the target uncoloured', S.getColours(70) === null);
    S.replaceGlyphs(S.glyphs.map(x => Uint8Array.from(x)));
    check('replaceGlyphs (Fill from font, the map) keeps the attributes', same(S.getColours(65), [4, 3, 2, 1]));
    S.setCoverage('FULL');
    check('a coverage change keeps each code\'s attributes', same(S.getColours(65), [4, 3, 2, 1]) && S.getColours(10) === null && S.colours.length === 256);
    S.setCoverage('ASCII');
  }

  // -- a paste between sizes --------------------------------------------------
  {
    S.setColoursFor(65, [9, 8, 7, 6]);
    S.copyGlyph(65);
    S.newBigFont({ cols: 3, rows: 1, coverage: 'ASCII' });
    check('a new big font has no colours', S.hasColours() === false);
    S.pasteGlyph(65);
    check('a paste into a bigger font keeps the top-left blocks and fills the new ones with 56', same(S.getColours(65), [9, 8, 56]));
  }

  // -- snapshot / restore (the Font Editor's undo) ----------------------------
  {
    S.setBlockAttr(66, 2, 0, 0x11);
    const snap = S.snapshot();
    check('a snapshot holds a copy of the colours', Array.isArray(snap.colours) && same(snap.colours[66 - 32], [0x11, 0x11, 0x11]));
    const before = snap.bytes;
    S.clearColours(66);
    check('changing the font does not change the snapshot', same(snap.colours[66 - 32], [0x11, 0x11, 0x11]));
    check('a snapshot counts its colour bytes', S.snapshot().bytes < before);
    const h = new FontHistory();
    h.push(snap);
    const target = h.undo(S.snapshot());
    S.restore(target);
    check('restore brings the colours back', same(S.getColours(66), [0x11, 0x11, 0x11]));
    S.restore(h.redo(S.snapshot()));
    check('redo takes them away again', S.getColours(66) === null);
  }

  // -- loading ----------------------------------------------------------------
  {
    const c = Array.from({ length: 96 }, () => null); c[1] = Uint8Array.from([0x42]);
    const g = Array.from({ length: 96 }, () => new Uint8Array(8));
    S.loadDocument({ name: 'x', width: 8, height: 8, firstCode: 32, glyphs: g, shade: null, colours: c });
    check('loadDocument takes the colours', same(S.getColours(33), [0x42]));
    S.loadDocument({ name: 'x', width: 8, height: 8, firstCode: 32, glyphs: g, shade: null, colours: c.slice(2) });
    check('a colours list of the wrong length is ignored (the font loads uncoloured)', S.hasColours() === false);
    S.loadDocument({ name: 'x', width: 8, height: 8, firstCode: 32, glyphs: g, shade: null, colours: c });
    S.setName('Col');
    check('saved to the library', await S.saveToLibrary('Col'));
    S.resetToROM();
    check('Load ROM Font drops the colours', S.hasColours() === false);
    check('the library font has them', same(S.getLibraryFont('Col').colours[1], [0x42]));
    S.loadFromLibrary('Col');
    S.setBlockAttr(33, 0, 0, 0x07);
    check('editing a font loaded from the library does not change the library copy', S.getLibraryFont('Col').colours[1][0] === 0x42);
  }

  // -- fonts that are not a whole number of 8-pixel columns -------------------
  {
    S.resetToROM();
    S.setWidth(6);
    check('a 6-wide font does not take attributes', S.coloursAllowed() === false && S.setBlockAttr(65, 0, 0, 1) === false && S.setAllBlocks(65, 1) === false);
  }
  {
    // narrowing a coloured 8-wide font: what it can no longer edit or type is dropped, not kept out of reach
    S.resetToROM();
    S.setBlockAttr(65, 0, 0, INK2_PAPER7);
    S.setWidth(6);
    check('narrowing to 6 drops the attributes (the font cannot take them)', S.hasColours() === false && S.getColours(65) === null);
    check('...and the document saves none', S.toDocument().colours === null);
    S.resetToROM();
    S.loadDocument({ name: 'n', width: 4, height: 8, firstCode: 32, glyphs: Array.from({ length: 96 }, () => new Uint8Array(8)),
      colours: Array.from({ length: 96 }, (_, i) => (i === 33 ? Uint8Array.of(0x42) : null)) });
    check('a 4-wide document with attributes loads without them', S.hasColours() === false);
  }

  // -- the attribute bar onto a block: a part set to use existing keeps the block's own ------------------------
  {
    const sel = { ink: 4, paper: 3, bright: false, flash: true, inkTransparent: false, paperTransparent: true, brightTransparent: true, flashTransparent: false };
    check('use existing Paper and Bright keep the block\'s own', GlyphBits.attrOnto(sel, 2 | (6 << 3) | 0x40) === (4 | (6 << 3) | 0x40 | 0x80));
    check('no part on use existing: the bar\'s byte', GlyphBits.attrOnto({ ...sel, paperTransparent: false, brightTransparent: false }, 0xFF) === (4 | (3 << 3) | 0x80));
    check('every part on use existing: the block unchanged', GlyphBits.attrOnto({ ...sel, inkTransparent: true, flashTransparent: true }, 0x5A) === 0x5A);
    check('no block byte given: an uncoloured block counts as 56', GlyphBits.attrOnto(sel) === (4 | (7 << 3) | 0x80));
  }

  // -- persist / restore at boot ----------------------------------------------
  {
    S.newBigFont({ cols: 1, rows: 2, coverage: 'ASCII' });
    S.setBlockAttr(65, 0, 1, 0x5A);
    await S.persist();
    S.resetToROM();
    await S.restorePersisted();
    check('the working font comes back after a reload with its colours', same(S.getColours(65), [0x5A, 0x5A]));
  }
  summary();
})();
