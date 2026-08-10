'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Fake Storage capturing the persisted payload (async like the real one)
const fakeStore = {};
installStubs({
  Storage: {
    STORES: { PREFERENCES: 'preferences', CLIPBOARD: 'clipboard' },
    async set(key, value, store) { fakeStore[`${store}/${key}`] = JSON.parse(JSON.stringify(value)); },
    async get(key, store) { return fakeStore[`${store}/${key}`] ?? null; }
  },
  StateManager: { set() {}, setSection() {} }
});
loadModule('js/utils/clipboard-codec.js');

function makeClipboard(width, height) {
  const pixels = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push(((x * 3 + y * 7) % 5) < 2);
    pixels.push(row);
  }
  const cells = [];
  const cellsX = Math.ceil(width / 8), cellsY = Math.ceil(height / 8);
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      cells.push({
        relX: cx, relY: cy,
        data: {
          ink: (cx + cy) & 7, paper: (cx * 2 + 5) & 7,
          bright: (cx & 1) === 0, flash: cy === 0,
          pixels: Uint8Array.from({ length: 8 }, (_, j) => (cx * 31 + cy * 17 + j * 11) & 0xFF)
        }
      });
    }
  }
  return { width, height, pixels, cells };
}

function clipboardsEqual(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 'dims';
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (!!a.pixels[y][x] !== !!b.pixels[y][x]) return `pixel ${x},${y}`;
    }
  }
  if (a.cells.length !== b.cells.length) return 'cell count';
  for (let i = 0; i < a.cells.length; i++) {
    const ca = a.cells[i], cb = b.cells[i];
    if (ca.relX !== cb.relX || ca.relY !== cb.relY) return `cell ${i} pos`;
    const da = ca.data, db = cb.data;
    if (da.ink !== db.ink || da.paper !== db.paper ||
        !!da.bright !== !!db.bright || !!da.flash !== !!db.flash) return `cell ${i} attrs`;
    for (let j = 0; j < 8; j++) if (da.pixels[j] !== db.pixels[j]) return `cell ${i} byte ${j}`;
  }
  return true;
}

// ── pure round-trips ────────────────────────────────────────────────────────
for (const [w, h] of [[1, 1], [7, 3], [8, 8], [13, 21], [256, 192]]) {
  const clip = makeClipboard(w, h);
  const enc = ClipboardCodec.encode(clip);
  const dec = enc && ClipboardCodec.decode(JSON.parse(JSON.stringify(enc)));
  const result = dec ? clipboardsEqual(clip, dec) : 'null';
  check(`round-trip ${w}x${h}${w === 256 ? ' (full screen)' : ''}`,
    result === true, String(result));
}

// JSON-serializability + size-cap sanity on the full-screen case
{
  const enc = ClipboardCodec.encode(makeClipboard(256, 192));
  const json = JSON.stringify(enc);
  check('full-screen payload is JSON-safe and within the size cap',
    json.length > 0 && json.length <= ClipboardCodec.MAX_JSON_BYTES,
    `${json.length} bytes`);
  check('payload is versioned', enc.v === ClipboardCodec.VERSION);
}

// ── rejection paths ─────────────────────────────────────────────────────────
check('encode rejects null', ClipboardCodec.encode(null) === null);
check('encode rejects oversized clipboard',
  ClipboardCodec.encode(makeClipboard(257, 10)) === null);
{
  const good = ClipboardCodec.encode(makeClipboard(16, 16));
  check('decode rejects unknown version',
    ClipboardCodec.decode({ ...good, v: 99 }) === null);
  check('decode rejects corrupt base64',
    ClipboardCodec.decode({ ...good, bits: '!!!not-base64!!' }) === null);
  check('decode rejects bit-length mismatch',
    ClipboardCodec.decode({ ...good, w: 24 }) === null);
  check('decode rejects malformed cells',
    ClipboardCodec.decode({ ...good, cells: [{ x: 0, y: 0, px: [1, 2] }] }) === null);
  check('decode rejects out-of-range cell coords',
    ClipboardCodec.decode({ ...good, cells: [{ x: 40, y: 0, ink: 0, paper: 7, bright: 0, flash: 0, px: [0,0,0,0,0,0,0,0] }] }) === null);
  check('decode rejects non-object', ClipboardCodec.decode(undefined) === null);
}

// ── persist/restore through the real SelectionService ──────────────────────
loadModule('js/services/selection-service.js');
(async () => {
  const clip = makeClipboard(24, 16);
  SelectionService.clipboard = clip;
  SelectionService._persistClipboard();
  await new Promise(r => setImmediate(r)); // let the fire-and-forget settle

  check('persist writes to the CLIPBOARD store',
    !!fakeStore['clipboard/clipboard'] && fakeStore['clipboard/clipboard'].v === 1);

  SelectionService.clipboard = null;
  const restored = await SelectionService.restorePersistedClipboard();
  check('restore returns true and repopulates the clipboard',
    restored === true && SelectionService.hasClipboard());
  check('restored clipboard equals the persisted one',
    clipboardsEqual(clip, SelectionService.clipboard) === true,
    String(clipboardsEqual(clip, SelectionService.clipboard)));

  // Empty store -> clean false
  delete fakeStore['clipboard/clipboard'];
  SelectionService.clipboard = null;
  check('restore with empty store returns false, clipboard stays empty',
    (await SelectionService.restorePersistedClipboard()) === false &&
    !SelectionService.hasClipboard());

  summary();
})();
