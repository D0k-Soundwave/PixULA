'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Fake Storage capturing the persisted payloads (async like the real one)
const fakeStore = {};
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', FONTS: 'fonts' },
    async set(key, value, store) { fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; },
    async delete(key, store) { delete fakeStore[`${store}/${key}`]; }
  }
});
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/font-codec.js');
loadModule('js/services/font-service.js');

const S = FontService;

// ── ROM font integrity + default state ──────────────────────────────────────
check('ROM table is 96 glyphs × 8 bytes', ZX_ROM_FONT.length === 768);
check('ROM space (32) is blank', ZX_ROM_FONT.slice(0, 8).every(b => b === 0));
check('ROM A (65) matches the text tool table', (() => {
  const a = ZX_ROM_FONT.slice((65 - 32) * 8, (65 - 32) * 8 + 8);
  return [0x3C, 0x42, 0x42, 0x7E, 0x42, 0x42, 0x42, 0x00].every((b, i) => a[i] === b);
})());
check('default working font is the 96-char ASCII coverage at width 8',
  S.width === 8 && S.firstCode === 32 && S.glyphs.length === 96);
check('default glyphs come from the ROM table',
  S.getGlyph(65).every((b, i) => b === ZX_ROM_FONT[(65 - 32) * 8 + i]));

// ── glyph bounds ────────────────────────────────────────────────────────────
check('getGlyph outside coverage is null', S.getGlyph(0) === null && S.getGlyph(128) === null);
check('setGlyph outside coverage is a no-op', S.setGlyph(200, new Uint8Array(8)) === false);
check('setGlyph rejects wrong byte length', S.setGlyph(65, new Uint8Array(7)) === false);
check('captureGlyphFromCanvasCell without LayerManager is a no-op',
  S.captureGlyphFromCanvasCell(0, 0, 65) === false);

// ── glyph ops ───────────────────────────────────────────────────────────────
S.setGlyph(65, [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01]);
check('setGlyph stores a copy', S.getGlyph(65)[0] === 0x80);

S.flipGlyph(65, 'h');
check('flipGlyph h mirrors within the width', S.getGlyph(65)[0] === 0x01 && S.getGlyph(65)[7] === 0x80);
S.flipGlyph(65, 'v');
check('flipGlyph v reverses rows', S.getGlyph(65)[0] === 0x80 && S.getGlyph(65)[7] === 0x01);

S.setGlyph(66, [0x80, 0, 0, 0, 0, 0, 0, 0x01]);
S.shiftGlyph(66, 'left');
check('shiftGlyph left wraps the leftmost column', S.getGlyph(66)[0] === 0x01 && S.getGlyph(66)[7] === 0x02);
S.shiftGlyph(66, 'right');
check('shiftGlyph right restores', S.getGlyph(66)[0] === 0x80 && S.getGlyph(66)[7] === 0x01);
S.shiftGlyph(66, 'down');
check('shiftGlyph down wraps rows', S.getGlyph(66)[0] === 0x01 && S.getGlyph(66)[1] === 0x80);
S.shiftGlyph(66, 'up');
check('shiftGlyph up restores', S.getGlyph(66)[0] === 0x80);

S.setGlyph(67, new Uint8Array(8));
S.invertGlyph(67);
check('invertGlyph fills within the width', S.getGlyph(67).every(b => b === 0xFF));

check('copy/paste glyph', (() => {
  S.copyGlyph(66);
  S.pasteGlyph(90);
  return S.getGlyph(90)[0] === 0x80 && S.getGlyph(90)[7] === 0x01;
})());
S.clearGlyph(90);
check('clearGlyph blanks', S.getGlyph(90).every(b => b === 0));

// ── width change (re-shape) ─────────────────────────────────────────────────
S.setGlyph(65, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
S.setWidth(4);
check('narrowing to 4 crops the right columns', S.getGlyph(65).every(b => b === 0xF0));
check('invert at width 4 stays inside the mask', (() => {
  S.invertGlyph(65);
  return S.getGlyph(65).every(b => b === 0x00);
})());
S.setGlyph(65, [0x90, 0, 0, 0, 0, 0, 0, 0]);
S.flipGlyph(65, 'h');
check('flip h at width 4 mirrors 4 columns', S.getGlyph(65)[0] === 0x90);
S.shiftGlyph(65, 'left');
check('shift left at width 4 wraps within 4 columns', S.getGlyph(65)[0] === 0x30);
S.setWidth(8);
check('widening back exposes blank columns', S.getGlyph(65)[0] === 0x30);
check('setWidth rejects illegal widths', S.setWidth(5) === false);

// ── coverage change ─────────────────────────────────────────────────────────
S.setGlyph(65, [1, 2, 3, 4, 5, 6, 7, 8]);
S.setCoverage('FULL');
check('FULL coverage keeps overlapping codes', S.getGlyph(65)[0] === 1 && S.glyphs.length === 256);
check('FULL coverage adds blank low codes', S.getGlyph(0).every(b => b === 0));
S.setGlyph(10, [0xAA, 0, 0, 0, 0, 0, 0, 0]);
S.setCoverage('ASCII');
check('ASCII coverage drops out-of-window codes and keeps the rest',
  S.glyphs.length === 96 && S.getGlyph(10) === null && S.getGlyph(65)[0] === 1);

// ── ROM reset ───────────────────────────────────────────────────────────────
S.setWidth(4);
S.resetToROM();
check('resetToROM restores width 8 and the ROM glyphs',
  S.width === 8 && S.getGlyph(65)[0] === 0x3C);

// ── persist/restore + library ───────────────────────────────────────────────
(async () => {
  S.setName('workbench');
  S.setGlyph(66, [9, 9, 9, 9, 9, 9, 9, 9]);
  await S.persist();
  check('persist writes to the FONTS store',
    !!fakeStore['fonts/current'] && fakeStore['fonts/current'].v === FontCodec.VERSION);

  check('saveToLibrary stores under the given name', await S.saveToLibrary('My Font'));
  check('saveToLibrary rejects empty names', (await S.saveToLibrary('   ')) === false);
  check('listLibrary lists it', S.listLibrary().join(',') === 'My Font');
  check('getLibraryFont decodes it', S.getLibraryFont('My Font').glyphs[66 - 32][0] === 9);

  S.resetToROM();
  S.name = '';
  check('loadFromLibrary restores the saved font',
    S.loadFromLibrary('My Font') && S.name === 'My Font' && S.getGlyph(66)[0] === 9);
  check('loadFromLibrary copies glyphs (editing must not touch the library)', (() => {
    S.setGlyph(66, [7, 7, 7, 7, 7, 7, 7, 7]);
    return S.getLibraryFont('My Font').glyphs[66 - 32][0] === 9;
  })());

  // Restore path: blow the in-memory state away, then reload from the store
  S.resetToROM();
  S.name = '';
  S._library = {};
  S._decodedCache.clear();
  await S.restorePersisted();
  check('restore repopulates the working font', S.getGlyph(66)[0] === 9 && S.name === 'workbench');
  check('restore warms the library cache', S.listLibrary().join(',') === 'My Font');

  check('deleteFromLibrary removes it',
    (await S.deleteFromLibrary('My Font')) && S.listLibrary().length === 0);
  check('deleteFromLibrary on a missing name is a no-op',
    (await S.deleteFromLibrary('Nope')) === false);

  // Unreadable payload -> discarded, store cleaned
  fakeStore['fonts/current'] = { v: 99 };
  await S.restorePersisted();
  check('restore discards unreadable payloads and clears the store',
    fakeStore['fonts/current'] === undefined);

  clearTimeout(S._persistTimer); // let Node exit
  summary();
})();
