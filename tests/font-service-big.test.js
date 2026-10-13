'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const fakeStore = {};
let refuse = false;
const events = [];
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', FONTS: 'fonts' },
    async set(key, value, store) { if (refuse) throw new Error('quota'); fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; },
    async delete(key, store) { delete fakeStore[`${store}/${key}`]; }
  },
  EventBus: { emit: (name, data) => events.push([name, data]), on() {} }
});
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/font-codec.js');
loadModule('js/services/font-service.js');
const S = FontService;

(async () => {
  check('the default font is 8 x 8 and not big', S.height === 8 && S.width === 8 && S.isBig() === false);
  check('the default font has no shading', S.hasShading() === false && S.getShade(65).left === 0 && S.getShade(65).right === 0);

  // new big font
  events.length = 0;
  check('newBigFont 2 x 3 (16 x 24) ASCII', S.newBigFont({ cols: 2, rows: 3, coverage: 'ASCII' }) === true);
  check('geometry is 16 x 24, 96 glyphs of 48 bytes', S.width === 16 && S.height === 24 && S.glyphs.length === 96 && S.glyphs.every(g => g.length === 48));
  check('a new big font is blank and unshaded', S.glyphs.every(g => g.every(b => b === 0)) && !S.hasShading());
  check('a new big font announces FONT_LOADED once', events.filter(e => e[0] === EVENTS.FONT_LOADED).length === 1);
  check('isBig is true', S.isBig() === true);
  check('getGlyphSize is 16 x 24', S.getGlyphSize().w === 16 && S.getGlyphSize().h === 24);
  check('newBigFont rejects 5 columns or 0 rows', S.newBigFont({ cols: 5, rows: 1, coverage: 'ASCII' }) === false && S.newBigFont({ cols: 1, rows: 0, coverage: 'ASCII' }) === false);
  check('newBigFont rejects an unknown coverage', S.newBigFont({ cols: 1, rows: 1, coverage: 'x' }) === false);
  check('the failed calls left the font alone', S.width === 16 && S.height === 24);

  // editing a big glyph
  check('setGlyph needs 48 bytes now', S.setGlyph(65, new Uint8Array(8)) === false && S.setGlyph(65, new Uint8Array(48)) === true);
  const g = new Uint8Array(48); g[0] = 0x80;
  S.setGlyph(65, g);
  S.flipGlyph(65, 'h');
  check('flip h moves x=0 to x=15', S.getGlyph(65)[0] === 0 && S.getGlyph(65)[1] === 0x01);
  S.flipGlyph(65, 'v');
  check('flip v moves row 0 to row 23', S.getGlyph(65)[23 * 2 + 1] === 0x01);
  S.shiftGlyph(65, 'right');
  check('shift right wraps x=15 to x=0', S.getGlyph(65)[23 * 2] === 0x80);
  S.invertGlyph(65);
  check('invert sets every other bit of a 16-wide glyph', S.getGlyph(65)[0] === 0xFF && S.getGlyph(65)[23 * 2] === 0x7F);

  // clipboard across sizes
  S.copyGlyph(65);
  S.newBigFont({ cols: 1, rows: 1, coverage: 'ASCII' });
  check('a pasted glyph of another size is cropped / padded to fit', S.pasteGlyph(66) === true && S.getGlyph(66).length === 8 && S.getGlyph(66)[0] === 0xFF);

  // shading
  S.newBigFont({ cols: 3, rows: 2, coverage: 'ASCII' });
  check('setShade left 1 right 1', S.setShade(65, 1, 1) === true && S.getShade(65).left === 1 && S.getShade(65).right === 1);
  check('hasShading is now true', S.hasShading() === true);
  check('shading may cover the whole character (it is left out)', S.setShade(66, 2, 1) === true);
  check('shading wider than the character is refused', S.setShade(67, 2, 2) === false && S.getShade(67).left === 0);
  check('negative or fractional shading is refused', S.setShade(67, -1, 0) === false && S.setShade(67, 0.5, 0) === false);
  check('Space keeps at least one column', S.setShade(32, 2, 1) === false && S.setShade(32, 1, 1) === true && S.setShade(32, 3, 0) === false);
  check('setShade outside the coverage is refused', S.setShade(200, 0, 0) === false);
  S.setShade(66, 0, 0);
  check('shading round-trips through toDocument', (() => { const d = S.toDocument(); return d.height === 16 && d.shade && d.shade[65 - 32][0] === 1 && d.shade[65 - 32][1] === 1; })());
  check('toDocument carries no shade list when nothing is shaded', (() => { S.setShade(65, 0, 0); S.setShade(32, 0, 0); return S.toDocument().shade === null; })());

  // coverage change keeps shading of kept codes
  S.setShade(65, 0, 1);
  S.setCoverage('FULL');
  check('coverage change keeps the shading of kept codes', S.getShade(65).right === 1 && S.glyphs.length === 256 && S.getShade(0).left === 0);
  check('new codes are blank and unshaded and the right size', S.glyphs[0].length === 3 * 16 && S.getGlyph(0).every(b => b === 0));

  // replaceGlyphs: one announcement
  events.length = 0;
  const fresh = S.glyphs.map(() => new Uint8Array(3 * 16).fill(0x55));
  check('replaceGlyphs swaps all glyphs', S.replaceGlyphs(fresh) === true && S.getGlyph(100)[0] === 0x55);
  check('replaceGlyphs announces once', events.filter(e => e[0] === EVENTS.FONT_CHANGED).length === 1);
  check('replaceGlyphs rejects the wrong count or size', S.replaceGlyphs(fresh.slice(1)) === false && S.replaceGlyphs(fresh.map(() => new Uint8Array(8))) === false);
  check('replaceGlyphs with a shade list sets it', S.replaceGlyphs(fresh, fresh.map(() => [0, 1])) === true && S.getShade(100).right === 1);

  // width changes are for classic fonts only
  check('setWidth is refused on a big font', S.setWidth(6) === false);
  S.resetToROM();
  check('resetToROM returns to a classic 8 x 8 font with no shading', S.width === 8 && S.height === 8 && !S.hasShading() && !S.isBig());
  check('setWidth works again on a classic font', S.setWidth(6) === true);
  check('canvas capture is refused for a big font', (() => { S.newBigFont({ cols: 2, rows: 1, coverage: 'ASCII' }); return S.captureGlyphFromCanvasCell(0, 0, 65) === false; })());

  // load / library / persistence of a big shaded font
  S.newBigFont({ cols: 2, rows: 2, coverage: 'ASCII' });
  S.setName('Roundtrip');
  const marker = new Uint8Array(32); marker[5] = 0xAA; S.setGlyph(70, marker); S.setShade(71, 0, 1);
  check('saveToLibrary stores a big font', (await S.saveToLibrary('Big one')) === true);
  S.resetToROM();
  check('loadFromLibrary brings back size, glyphs and shading', S.loadFromLibrary('Big one') === true && S.width === 16 && S.height === 16 && S.getGlyph(70)[5] === 0xAA && S.getShade(71).right === 1);
  check('getLibraryFont carries height and shade', (() => { const d = S.getLibraryFont('Big one'); return d.height === 16 && d.shade && d.shade[71 - 32][1] === 1; })());
  S.getGlyph(70)[5] = 0;
  check('editing the working font does not change the library copy', S.getLibraryFont('Big one').glyphs[70 - 32][5] === 0xAA);
  S.getGlyph(70)[5] = 0xAA;
  await S.persist();
  S.resetToROM();
  await S.restorePersisted();
  check('restorePersisted brings back a big font', S.width === 16 && S.height === 16 && S.getGlyph(70)[5] === 0xAA && S.getShade(71).right === 1);

  // a refused library save must say so, and leave nothing behind
  refuse = true;
  const before = S.listLibrary().length;
  check('saveToLibrary reports a refused write', (await S.saveToLibrary('Will fail')) === false);
  check('and the failed font is not left in the library', S.listLibrary().length === before && !S.listLibrary().includes('Will fail'));
  refuse = false;

  // loadDocument validation
  check('loadDocument rejects a bad size', S.loadDocument({ name: 'x', width: 12, height: 8, firstCode: 0, glyphs: [new Uint8Array(12)] }) === false);
  check('loadDocument accepts height-less classic documents', S.loadDocument({ name: 'x', width: 8, firstCode: 32, glyphs: [new Uint8Array(8)] }) === true && S.height === 8);
  check('loadDocument drops an impossible shade list', S.loadDocument({ name: 'x', width: 16, height: 8, firstCode: 32, glyphs: [new Uint8Array(16)], shade: [[2, 2]] }) === true && !S.hasShading());
  summary();
})();
