'use strict';
/**
 * PresetCodec — round-trip, validation and limits.
 *
 * Presets are user data that outlives builds, so the codec's job is to be
 * boring: what goes in comes back out, a payload from a newer build loses only
 * the parts this build does not understand, and nothing malformed reaches the
 * store. The file form additionally has to carry the reference image, because a
 * preset that names a picture the receiving machine has never seen is a preset
 * whose position data means nothing.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/preset-codec.js');

// A 1x1 transparent GIF — small, real, and a genuine data:image/ URL
const TINY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function makePreset(overrides) {
  return Object.assign({
    slot: 3,
    name: 'Fine spray, blue on black',
    created: 1700000000000,
    modified: 1700000001000,
    meta: { screenMode: 'standard_ula', paletteModel: 'classic' },
    slices: {
      tool: { active: 'spray', tools: { brush: { size: 8, flowRate: 40, brushType: 'spray' } } },
      color: { ink: 1, paper: 0, bright: true, flash: false, border: 0 },
      view: { zoom: 400, scrollX: 12, scrollY: 34, gridCell: true }
    },
    asset: null
  }, overrides || {});
}

// ── Slots ───────────────────────────────────────────────────────────────────

// The count IS the keyboard: nine slots, nine digit keys, no unkeyed tier.
// It was 24 with only the first nine reachable by chord until 2026-08-07.
check('there are nine slots', PresetCodec.SLOT_COUNT === 9,
  `SLOT_COUNT = ${PresetCodec.SLOT_COUNT}`);
check('EVERY slot is keyed - the two constants must not drift apart',
  PresetCodec.KEY_SLOTS === PresetCodec.SLOT_COUNT);
check('empty library has one entry per slot',
  PresetCodec.emptyLibrary().length === PresetCodec.SLOT_COUNT &&
  PresetCodec.emptyLibrary().every(e => e === null));
check('slot 0 and the last slot are valid',
  PresetCodec.isValidSlot(0) && PresetCodec.isValidSlot(PresetCodec.SLOT_COUNT - 1));
check('out-of-range and non-integer slots are rejected',
  !PresetCodec.isValidSlot(-1) && !PresetCodec.isValidSlot(PresetCodec.SLOT_COUNT) &&
  !PresetCodec.isValidSlot(1.5) && !PresetCodec.isValidSlot('2'));

// ── The nine keyed slots ────────────────────────────────────────────────────

check('nine slots answer to the digits that name them',
  PresetCodec.KEY_SLOTS === 9);
check('slot 1 is Alt+1', PresetCodec.slotShortcut(0) === 'Alt+1');
check('slot 9 is Alt+9', PresetCodec.slotShortcut(8) === 'Alt+9');
check('the LAST slot has a shortcut - there is no unkeyed remainder',
  PresetCodec.slotShortcut(PresetCodec.SLOT_COUNT - 1) !== null);
check('the first slot past the end has none',
  PresetCodec.slotShortcut(PresetCodec.SLOT_COUNT) === null);
check('an invalid slot has no shortcut',
  PresetCodec.slotShortcut(-1) === null && PresetCodec.slotShortcut(99) === null);
check('every shortcut names the slot it recalls', (() => {
  for (let slot = 0; slot < PresetCodec.KEY_SLOTS; slot++) {
    if (PresetCodec.slotShortcut(slot) !== `Alt+${slot + 1}`) return false;
  }
  return true;
})());

check('digit 1 recalls slot 1', PresetCodec.slotForDigit('1') === 0);
check('digit 9 recalls slot 9', PresetCodec.slotForDigit('9') === 8);
check('digit 0 recalls nothing — it keeps meaning zoom to actual size',
  PresetCodec.slotForDigit('0') === null);
check('every keyed slot is reachable by exactly one digit', (() => {
  const seen = new Set();
  for (const d of '0123456789') {
    const slot = PresetCodec.slotForDigit(d);
    if (slot !== null) seen.add(slot);
  }
  return seen.size === PresetCodec.KEY_SLOTS &&
    [...seen].every(s => s >= 0 && s < PresetCodec.KEY_SLOTS);
})());
check('a non-digit recalls nothing',
  PresetCodec.slotForDigit('x') === null && PresetCodec.slotForDigit('') === null);

// ── Round trip ──────────────────────────────────────────────────────────────

const original = makePreset();
const payload = PresetCodec.encode(original);
check('a well-formed preset encodes', payload !== null);

const decoded = PresetCodec.decode(payload);
check('decode returns a preset', decoded !== null);
check('round trip preserves the name', decoded && decoded.name === original.name);
check('round trip preserves the slot', decoded && decoded.slot === original.slot);
check('round trip preserves the timestamps',
  decoded && decoded.created === original.created && decoded.modified === original.modified);
check('round trip preserves every slice',
  decoded && JSON.stringify(decoded.slices) === JSON.stringify(original.slices),
  decoded ? JSON.stringify(decoded.slices) : 'null');
check('round trip preserves the meta',
  decoded && decoded.meta.screenMode === 'standard_ula' &&
  decoded.meta.paletteModel === 'classic');

// ── Names ───────────────────────────────────────────────────────────────────

const unnamed = PresetCodec.decode(PresetCodec.encode(makePreset({ name: '   ' })));
check('a blank name falls back to one that still identifies the slot',
  unnamed && unnamed.name === 'Preset 4', unnamed ? unnamed.name : 'null');

const longName = 'x'.repeat(200);
const clipped = PresetCodec.decode(PresetCodec.encode(makePreset({ name: longName })));
check('an over-long name is clipped, not rejected',
  clipped && clipped.name.length === PresetCodec.MAX_NAME);

// ── Descriptions (the hover note) ───────────────────────────────────────────

const described = PresetCodec.decode(PresetCodec.encode(makePreset({
  description: 'The one for the sprite sheet, traced at 3x with the grid off'
})));
check('a description round-trips',
  described &&
  described.description === 'The one for the sprite sheet, traced at 3x with the grid off');
check('no description is an empty string, not a missing key',
  decoded && decoded.description === '');
check('an over-long description is clipped, not rejected',
  PresetCodec.decode(PresetCodec.encode(makePreset({ description: 'd'.repeat(500) })))
    .description.length === PresetCodec.MAX_DESCRIPTION);
check('a non-string description is dropped rather than stored',
  PresetCodec.decode(PresetCodec.encode(makePreset({ description: 42 }))).description === '');

// ── Rejections ──────────────────────────────────────────────────────────────

check('a preset with no slices is rejected (it would recall nothing)',
  PresetCodec.encode(makePreset({ slices: {} })) === null);
check('a preset in an impossible slot is rejected',
  PresetCodec.encode(makePreset({ slot: 99 })) === null);
check('a payload from another codec version is rejected',
  PresetCodec.decode(Object.assign({}, payload, { v: 99 })) === null);
check('a non-object payload is rejected',
  PresetCodec.decode(null) === null && PresetCodec.decode('nope') === null);
check('a value that is not JSON-safe is rejected',
  PresetCodec.encode(makePreset({
    slices: { tool: { active: 'brush', fn: function () {} } }
  })) !== null &&
  // the function key is dropped, the rest survives
  PresetCodec.encode(makePreset({
    slices: { tool: { active: 'brush', fn: function () {} } }
  })).slices.tool.fn === undefined);
check('a non-finite number is refused rather than stored as null',
  PresetCodec.encode(makePreset({ slices: { view: { zoom: Infinity } } })) === null ||
  PresetCodec.encode(makePreset({ slices: { view: { zoom: Infinity } } })).slices.view.zoom
    === undefined);

// A slice this build has never heard of must not take the whole preset down
const fromTheFuture = Object.assign({}, payload, {
  slices: Object.assign({ soundtrack: { bpm: 120 } }, payload.slices)
});
const survived = PresetCodec.decode(fromTheFuture);
check('an unknown slice is dropped, the known ones survive',
  survived !== null && survived.slices.tool !== undefined &&
  survived.slices.soundtrack === undefined);

// ── Typed arrays ────────────────────────────────────────────────────────────
//
// The sanitiser turns a typed array into a plain one so the payload is JSON.
// This used to be checked through the palette slice, which carried the register
// files; the palette became a FILE on 2026-08-07 and stopped being a slice, but
// the sanitiser behaviour is the codec's own and still has to hold.

const withTyped = PresetCodec.decode(PresetCodec.encode(makePreset({
  slices: { pattern: { bitmap: new Uint8Array([1, 2, 3, 255]) } }
})));
check('typed arrays travel as plain arrays',
  withTyped && Array.isArray(withTyped.slices.pattern.bitmap) &&
  withTyped.slices.pattern.bitmap.join(',') === '1,2,3,255');

// ── Asset hashing ───────────────────────────────────────────────────────────

const key = PresetCodec.hashAsset(TINY_IMAGE);
check('an image hashes to a key', typeof key === 'string' && key.length > 0);
check('the same image hashes to the same key',
  PresetCodec.hashAsset(TINY_IMAGE) === key);
check('a different image hashes differently',
  PresetCodec.hashAsset(TINY_IMAGE.replace('R0lG', 'R1lG')) !== key);
check('a non-string hashes to null', PresetCodec.hashAsset(null) === null);

check('a data:image URL is a valid asset',
  PresetCodec.encodeAsset({ dataUrl: TINY_IMAGE, fileName: 'ref.gif', width: 1, height: 1 })
    !== null);
check('a non-image URL is refused as an asset',
  PresetCodec.encodeAsset({ dataUrl: 'https://example.invalid/x.png' }) === null);
check('an over-sized image is refused',
  PresetCodec.encodeAsset({
    dataUrl: 'data:image/png;base64,' + 'A'.repeat(PresetCodec.MAX_ASSET_CHARS)
  }) === null);

// ── The file form ───────────────────────────────────────────────────────────

const asset = PresetCodec.encodeAsset({
  dataUrl: TINY_IMAGE, fileName: 'ref.gif', width: 1, height: 1
});
const withImage = makePreset({
  slices: {
    reference: { visible: true, opacity: 50, offsetX: 8, offsetY: -4, scale: 120, rotation: 0 }
  },
  asset: key
});

const text = PresetCodec.encodeFile(withImage, asset);
check('a preset with an image encodes to a file', typeof text === 'string');

const readBack = PresetCodec.decodeFile(text);
check('the file decodes', readBack !== null);
check('the file carries the image', readBack && readBack.asset &&
  readBack.asset.dataUrl === TINY_IMAGE);
check('the file preserves the reference position',
  readBack && readBack.preset.slices.reference.offsetX === 8 &&
  readBack.preset.slices.reference.offsetY === -4 &&
  readBack.preset.slices.reference.scale === 120);
check('the file keeps the preset pointing at its image',
  readBack && readBack.preset.asset === key);

// An image that could not travel must not leave a dangling reference
const orphan = PresetCodec.decodeFile(PresetCodec.encodeFile(withImage, null));
check('a preset whose image did not travel keeps its transform and drops the key',
  orphan !== null && orphan.preset.asset === null &&
  orphan.preset.slices.reference.offsetX === 8);

check('a file without the magic string is refused',
  PresetCodec.decodeFile(JSON.stringify({ v: 1, preset: payload })) === null);
check('a file that is not JSON is refused',
  PresetCodec.decodeFile('<html>not a preset</html>') === null);
check('a non-string file input is refused', PresetCodec.decodeFile(null) === null);

summary();
