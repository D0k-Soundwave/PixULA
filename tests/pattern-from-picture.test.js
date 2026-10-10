'use strict';
/**
 * Batch 8 part 8B2: a fill made from a picture. PNGFormat.patternFromImage turns any picture into an 8 / 16 / 32 tile
 * (1 = ink, the dark side - the pattern library's convention); PatternService.freeName keeps a new tile from replacing
 * one that has the same name.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({
  CanvasSystem: { getImageData: () => null },
  LayerManager: { getCurrentLayer: () => null, composeToCanvas: () => {} },
  AttributeSystem: { setCell: () => {} },
  UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
loadModule('js/utils/helpers.js');
loadModule('js/utils/palette-ops.js');
loadModule('js/utils/dither.js');
loadModule('js/utils/giga-quant.js');
loadModule('js/io/png-format.js');

const img = (w, h, f) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = f(x, y);
    const o = (y * w + x) * 4;
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a === undefined ? 255 : a;
  }
  return { width: w, height: h, data };
};
const grey = (v) => [v, v, v];
const inkShare = (t) => t.reduce((s, v) => s + v, 0) / t.length;

// -- sizes, values ---------------------------------------------------------------------------------------------
for (const size of [8, 16, 32]) {
  const t = PNGFormat.patternFromImage(img(100, 100, () => grey(128)), { size });
  check(`size ${size}: size*size values, each 0 or 1`, t.length === size * size && t.every(v => v === 0 || v === 1));
}
let threw = false;
try { PNGFormat.patternFromImage(img(4, 4, () => grey(0)), { size: 12 }); } catch (e) { threw = true; }
check('a size other than 8 / 16 / 32 throws', threw);

// -- ink is the dark side ------------------------------------------------------------------------------------------
check('a black picture is all ink', PNGFormat.patternFromImage(img(64, 64, () => grey(0)), { size: 16 }).every(v => v === 1));
check('a white picture is all paper', PNGFormat.patternFromImage(img(64, 64, () => grey(255)), { size: 16 }).every(v => v === 0));
{
  const mid = PNGFormat.patternFromImage(img(64, 64, () => grey(128)), { size: 32, dithering: 'bayer-8' });
  check('mid grey with Bayer 8 is about half ink', Math.abs(inkShare(mid) - 0.5) < 0.03, String(inkShare(mid)));
  const ramp = img(256, 256, (x) => grey(x));
  const t = PNGFormat.patternFromImage(ramp, { size: 32, dithering: 'floyd-steinberg', scaling: 'stretch' });
  let left = 0, right = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) { left += t[y * 32 + x]; right += t[y * 32 + 24 + x]; }
  check('a ramp dark to light: more ink on the dark side', left > right * 2, `${left} vs ${right}`);
}

// -- scaling ---------------------------------------------------------------------------------------------------------
{
  const wide = img(200, 100, (x) => (x < 100 ? grey(0) : grey(255)));   // left half black
  const stretch = PNGFormat.patternFromImage(wide, { size: 16, scaling: 'stretch', dithering: 'threshold-50' });
  check('stretch: the left half of the tile is ink, the right half paper',
    stretch.every((v, i) => v === ((i % 16) < 8 ? 1 : 0)));
  const crop = PNGFormat.patternFromImage(wide, { size: 16, scaling: 'crop', dithering: 'threshold-50' });
  check('crop: the middle square keeps the left/right split in the middle', crop.every((v, i) => v === ((i % 16) < 8 ? 1 : 0)));
  const fit = PNGFormat.patternFromImage(img(200, 100, () => grey(0)), { size: 16, scaling: 'fit', dithering: 'threshold-50' });
  const topRows = fit.slice(0, 16 * 4).every(v => v === 0), midRows = fit.slice(16 * 6, 16 * 10).every(v => v === 1);
  check('fit: paper above and below a wide picture, the picture in the middle', topRows && midRows);
}

// -- alpha is laid over paper ---------------------------------------------------------------------------------------
check('a fully transparent picture is paper, however dark its colour',
  PNGFormat.patternFromImage(img(32, 32, () => [0, 0, 0, 0]), { size: 8 }).every(v => v === 0));
check('half transparent black is a mid grey: about half ink with a Bayer dither',
  Math.abs(inkShare(PNGFormat.patternFromImage(img(32, 32, () => [0, 0, 0, 128]), { size: 32, dithering: 'bayer-8' })) - 0.5) < 0.05);

// -- brightness / contrast -------------------------------------------------------------------------------------------
{
  const base = img(64, 64, () => grey(128));
  const dark = inkShare(PNGFormat.patternFromImage(base, { size: 32, dithering: 'bayer-8', brightness: -50 }));
  const light = inkShare(PNGFormat.patternFromImage(base, { size: 32, dithering: 'bayer-8', brightness: 50 }));
  check('darker brightness gives more ink, lighter gives less', dark > 0.7 && light < 0.3, `${dark} / ${light}`);
}

// -- every method, deterministic -------------------------------------------------------------------------------------
{
  const photo = img(90, 70, (x, y) => [x * 2 % 256, y * 3 % 256, (x + y) * 2 % 256]);
  let ok = true;
  for (const m of Dither.METHODS) {
    const a = PNGFormat.patternFromImage(photo, { size: 32, dithering: m.id }), b = PNGFormat.patternFromImage(photo, { size: 32, dithering: m.id });
    if (a.join() !== b.join()) ok = false;
  }
  check('all 31 methods make a tile, the same every time', ok);
  check('"none" is a hard threshold', PNGFormat.patternFromImage(photo, { size: 16, dithering: 'none' }).join() ===
    PNGFormat.patternFromImage(photo, { size: 16, dithering: 'threshold-50' }).join());
}

// -- the library: free names, save and reload ---------------------------------------------------------------------
loadModule('js/core/event-bus.js');
const store = [];
let nextId = 1;
global.Storage = {
  STORES: { PATTERNS: 'patterns' },
  getAll: async () => store.map(r => ({ ...r })),
  set: async (key, value) => { store.push({ id: nextId++, key, value }); },
  delete: async (id) => { const i = store.findIndex(r => r.id === id); if (i >= 0) store.splice(i, 1); }
};
loadModule('js/services/pattern-service.js');

(async () => {
  check('a free name is the file stem', await PatternService.freeName('wood.png') === 'wood');
  check('no stem falls back to "picture"', await PatternService.freeName('') === 'picture');
  const tile = PNGFormat.patternFromImage(img(40, 40, (x, y) => grey((x * 6) % 256)), { size: 16, dithering: 'atkinson' });
  check('the tile is saved', await PatternService.savePatternData('wood', 16, tile) === true);
  check('a taken name gets " 2"', await PatternService.freeName('wood.jpg') === 'wood 2');
  await PatternService.savePatternData('wood 2', 16, tile);
  check('...and " 3" after that', await PatternService.freeName('wood.png') === 'wood 3');
  const long = 'x'.repeat(80);
  const name = await PatternService.freeName(long);
  check('a long name is cut to the limit', name.length === PatternService.MAX_PATTERN_NAME);
  await PatternService.savePatternData(name, 16, tile);
  const again = await PatternService.freeName(long);
  check('...and a taken long name stays inside the limit with its number', again.length <= PatternService.MAX_PATTERN_NAME && again !== name && again.endsWith(' 2'));
  const back = (await PatternService.getUserPatterns()).find(p => p.name === 'wood');
  check('a saved tile reloads bit for bit', back && back.width === 16 && Array.from(back.bitmap).join() === Array.from(tile).join());
  summary();
})();
