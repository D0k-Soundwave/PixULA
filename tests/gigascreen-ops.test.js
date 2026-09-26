'use strict';
/**
 * GigaScreen through everything that is not a brush stroke (2026-09-25).
 *
 * The draw gate learned the two screens on 2026-09-23 and the strokes were
 * tested with it. A review two days later found the operations around them
 * still thinking in one screen, each measured before its fix:
 *
 *  1. Photo import wrote screen A only - screen B kept the old drawing, or
 *     blank paper that showed the photo at half strength.
 *  2. Invert (Selection, and Image > Invert) turned paper into the Paint
 *     slot: with Paper/Paper chosen it wiped the region, and a pixel inked on
 *     one screen did not come back after inverting twice.
 *  3. Pixels Only painting Paper/Paper on an empty upper-layer cell made the
 *     cell opaque - what the ERASE early-return exists to prevent.
 *  4. A document from the old tag model with every layer on screen A did not
 *     convert, so screen B came back equal to A instead of the background.
 *  5. The same conversion threw away hidden layers.
 *  6. The hi-res pair's lossy check compared cell colours the pair never
 *     shows, and not the per-screen schemes it does.
 *  7. .img export in the other pairs overflowed its 13824-byte buffer with a
 *     raw RangeError; .mlt/.ifl export named no container ("save as {ext}").
 *  8. GIF export of a GigaScreen document flattened every layer twice.
 *  9. A Next palette saved unedited before 2026-09-23 counted as edited.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/services/selection-service.js');
loadModule('js/services/transform-service.js');
loadModule('js/utils/palette-ops.js');
loadModule('js/utils/giga-quant.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/multicolor-format.js');
loadModule('js/io/gigascreen-format.js');
loadModule('js/io/gif-format.js');
loadModule('js/io/png-format.js');
global.PatternService = global.PatternService || {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.GridOverlay = global.GridOverlay || {
  drawCompositorPreview() {}, clearFunctionPreview() {}, drawPreviewPixels() {}
};
loadModule('js/tools/tool-base.js');
loadModule('js/tools/fill-tool.js');
loadModule('js/tools/gradient-tool.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/font-codec.js');
loadModule('js/services/font-service.js');

ColorManager.initialize();

const rows = (v) => Uint8Array.from([v, v, v, v, v, v, v, v]);
const slotsAt = (layer, xs, y) => xs.map(x => layer.getPixelSlot(x, y));
const throwsWith = (fn) => { try { fn(); return null; } catch (e) { return e; } };

/** A fresh GigaScreen document on Layer 1 with Paint = Paper/Paper. */
function gigaDoc(mode = 'gigascreen') {
  LayerManager.initialize();
  ScreenModeService.applyModeRaw(mode);
  LayerManager.initialize();
  ColorManager.setGigaSlot(GIGA_SLOTS.PAPER_PAPER);
  SelectionService.clear();
  return LayerManager.getCurrentLayer();
}

/** Four pixels in a row showing slots 0, 1, 2, 3 at x = 0..3, row 0. */
function seedFourSlots(layer) {
  layer.setCell(0, 0, {
    ink: 2, paper: 7, bright: false, flash: false, pixels: Uint8Array.from([0x30, 0, 0, 0, 0, 0, 0, 0]),
    inkB: 1, paperB: 5, brightB: false, flashB: false, pixelsB: Uint8Array.from([0x50, 0, 0, 0, 0, 0, 0, 0])
  });
}

// --- 1. Photo import: four steady colours per cell --------------------------

{
  const layer = gigaDoc();
  // Something different on screen B already, where the photo will land
  layer.setCell(0, 0, { ink: 0, paper: 7, bright: false, flash: false, pixels: rows(0),
    inkB: 4, paperB: 1, brightB: true, flashB: false, pixelsB: rows(0xFF) });
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
  const data = new Uint8ClampedArray(W * H * 4);
  // A ramp between two neighbour colours: only mixes can show its middle
  for (let i = 0; i < W * H; i++) {
    const t = (i % W) / (W - 1);
    data.set([Math.round(215 * (1 - t)), 0, Math.round(215 * t), 255], i * 4);
  }
  const image = { width: W, height: H, data };
  PNGFormat._applyToLayer(image, 'none', null);

  let flicker = null, differ = false;
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS && !flicker; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS && !flicker; cx++) {
      const c = layer.getCell(cx, cy);
      if (c.inkB !== c.ink || c.paperB !== c.paper
          || c.pixelsB.some((r, i) => r !== c.pixels[i])) differ = true;
      for (let y = 0; y < c.pixels.length; y++) {
        for (let x = 0; x < 8; x++) {
          const bitA = (c.pixels[y] >> (7 - x)) & 1, bitB = (c.pixelsB[y] >> (7 - x)) & 1;
          const baseA = bitA ? c.ink : c.paper, baseB = bitB ? c.inkB : c.paperB;
          if (!GigaQuant.isSteady(baseA, c.bright, baseB, c.brightB)) flicker = `${cx},${cy}`;
        }
      }
    }
  }
  check('a photo imported into GigaScreen shows only steady mixes', flicker === null,
    `flickering pixel in cell ${flicker}`);
  check('the two screens are not simply copies of each other', differ);
  const c = layer.getCell(0, 0);
  const oldSurvives = c.inkB === 4 && c.paperB === 1 && c.brightB === true
    && c.pixelsB.every(r => r === 0xFF);
  check('the old screen-B drawing is gone', !oldSurvives);

  // GigaQuant's blend is the compositor's blend, for every pair of colours
  let blendMismatch = null;
  for (let i = 0; i < 16 && !blendMismatch; i++) {
    for (let j = 0; j < 16 && !blendMismatch; j++) {
      const a = GigaQuant.blend(ZX_PALETTE_RGB[i], ZX_PALETTE_RGB[j]);
      const b = LayerManager._blendRGB(ZX_PALETTE_RGB[i], ZX_PALETTE_RGB[j]);
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) blendMismatch = `${i}/${j}`;
    }
  }
  check('GigaQuant.blend equals the compositor blend', blendMismatch === null, blendMismatch);

  // The preview is exactly what the import wrote, seen through the Average blend
  const flat = PNGFormat.quantizePreviewSet(image, { scaling: 'fit' }).find(s => s.id === 'flat').preview;
  let mismatch = null;
  for (let py = 0; py < H && !mismatch; py++) {
    for (let px = 0; px < W && !mismatch; px++) {
      const cell = layer.getCell(px >> 3, py >> 3);
      const y = py & 7, bit = 7 - (px & 7);
      const baseA = (cell.pixels[y] >> bit) & 1 ? cell.ink : cell.paper;
      const baseB = (cell.pixelsB[y] >> bit) & 1 ? cell.inkB : cell.paperB;
      const want = GigaQuant.blend(GigaQuant.colourRGB(baseA, cell.bright),
        GigaQuant.colourRGB(baseB, cell.brightB));
      const o = (py * W + px) * 4;
      if (flat.data[o] !== want[0] || flat.data[o + 1] !== want[1] || flat.data[o + 2] !== want[2]) {
        mismatch = `${px},${py}`;
      }
    }
  }
  check('the Flat preview is exactly the imported picture', mismatch === null, `differs at ${mismatch}`);
}

// --- 2. Invert inverts each screen -----------------------------------------

{
  const layer = gigaDoc();
  seedFourSlots(layer);
  SelectionService.setSelection({ x: 0, y: 0, width: 4, height: 1 });
  SelectionService.invertSelection();
  check('Invert Selection gives each pixel its complement (0,1,2,3 -> 3,2,1,0)',
    slotsAt(layer, [0, 1, 2, 3], 0).join() === '3,2,1,0', slotsAt(layer, [0, 1, 2, 3], 0).join());
  SelectionService.invertSelection();
  check('inverting twice gives the picture back',
    slotsAt(layer, [0, 1, 2, 3], 0).join() === '0,1,2,3', slotsAt(layer, [0, 1, 2, 3], 0).join());
  check('Invert Selection with Paint on Paper/Paper does not wipe the region',
    layer.getCell(0, 0).pixels[0] !== 0 || layer.getCell(0, 0).pixelsB[0] !== 0);
}

{
  const layer = gigaDoc();
  seedFourSlots(layer);
  SelectionService.setSelection({ x: 0, y: 0, width: 4, height: 1 });
  TransformService.invert();
  check('Image > Invert gives each pixel its complement',
    slotsAt(layer, [0, 1, 2, 3], 0).join() === '3,2,1,0', slotsAt(layer, [0, 1, 2, 3], 0).join());
  check('Image > Invert keeps the paper each screen shows',
    layer.getCell(0, 0).paper === 7 && layer.getCell(0, 0).paperB === 5,
    `paper ${layer.getCell(0, 0).paper} paperB ${layer.getCell(0, 0).paperB}`);
  TransformService.invert();
  check('Image > Invert twice gives the picture back',
    slotsAt(layer, [0, 1, 2, 3], 0).join() === '0,1,2,3', slotsAt(layer, [0, 1, 2, 3], 0).join());
}

{
  // Outline: a marked pixel keeps its blend, the ring takes the Paint slot
  const layer = gigaDoc();
  PixelDrawRoutine.draw(20, 20, { ...ColorManager.getCurrentSelection(), gigaSlot: GIGA_SLOTS.PAPER_INK },
    DRAW_MODE.NORMAL, { mirror: false });
  ColorManager.setGigaSlot(GIGA_SLOTS.INK_PAPER);
  SelectionService.setSelection({ x: 16, y: 16, width: 9, height: 9 });
  TransformService.outline(1, 1);
  check('outline keeps the marked pixel\'s blend', layer.getPixelSlot(20, 20) === GIGA_SLOTS.PAPER_INK,
    `slot ${layer.getPixelSlot(20, 20)}`);
  check('outline leaves the gap as paper', layer.getPixelSlot(21, 20) === GIGA_SLOTS.PAPER_PAPER);
  check('outline paints the ring in the Paint slot', layer.getPixelSlot(22, 20) === GIGA_SLOTS.INK_PAPER,
    `slot ${layer.getPixelSlot(22, 20)}`);
}

{
  // Attribute fill matches a cell on BOTH screens' colours, and recolours
  // each screen from its own. Three cells share screen A's red on white;
  // the third has a different screen B, so it is a different colour pair.
  const layer = gigaDoc();
  for (const [cx, inkB] of [[0, 4], [1, 4], [2, 5]]) {
    layer.setCell(cx, 0, { ink: 2, paper: 7, bright: false, flash: false, pixels: rows(0x0F),
      inkB, paperB: 0, brightB: false, flashB: false, pixelsB: rows(0xF0) });
  }
  ColorManager.setInk(6);
  ColorManager.setPaper(1);
  ColorManager.setInkB(3);
  ColorManager.setPaperB(2);
  const fill = new FillTool();
  fill.setAttributesOnly(true);
  fill._floodFill(0, 0, false);
  const c = [0, 1, 2].map(x => layer.getCell(x, 0));
  check('attribute fill recolours the cells that match on both screens',
    c[0].ink === 6 && c[0].inkB === 3 && c[1].ink === 6 && c[1].paperB === 2,
    JSON.stringify(c.slice(0, 2).map(x => [x.ink, x.paper, x.inkB, x.paperB])));
  check('attribute fill stops at a cell whose screen B differs',
    c[2].ink === 2 && c[2].inkB === 5, `ink ${c[2].ink} inkB ${c[2].inkB}`);
  check('attribute fill touches no pixel', c[0].pixels[0] === 0x0F && c[0].pixelsB[0] === 0xF0);
  ColorManager.setInk(0);
  ColorManager.setPaper(7);
  ColorManager.setInkB(0);
  ColorManager.setPaperB(7);
}

// --- 2b. The sweep after the review (2026-09-26) --------------------------

{
  // A fill's region is one BLEND, and filling a blend with another is a real
  // change. It matched "any ink", so it ran across blends, and the "already
  // ink" shortcut made filling slot 2 with slot 1 do nothing at all.
  const layer = gigaDoc();
  seedFourSlots(layer); // x = 0..3 show slots 0, 1, 2, 3
  const fill = new FillTool();
  ColorManager.setGigaSlot(GIGA_SLOTS.PAPER_INK);
  fill._floodFill(2, 0, false);
  check('fill turns the clicked blend into the Paint blend',
    layer.getPixelSlot(2, 0) === GIGA_SLOTS.PAPER_INK, `slot ${layer.getPixelSlot(2, 0)}`);
  check('fill stops at a different blend beside it',
    layer.getPixelSlot(3, 0) === GIGA_SLOTS.INK_INK, `slot ${layer.getPixelSlot(3, 0)}`);

  const before = UndoRedo.undoStack.length;
  ColorManager.setGigaSlot(GIGA_SLOTS.INK_INK);
  fill._floodFill(3, 0, false);
  check('filling a blend with itself does nothing', UndoRedo.undoStack.length === before);

  // The gradient's fill region is the same region
  const grad = new GradientTool();
  const region = grad._getFloodFillRegion(1, 0);
  const has = (x, y) => region.has((y << 16) | x);
  check('the gradient\'s fill region is one blend too',
    has(1, 0) && has(2, 0) && !has(3, 0) && !has(0, 0),
    `region of ${region.size}: ${[0, 1, 2, 3].map(x => has(x, 0) ? 1 : 0).join('')}`);
  ColorManager.setGigaSlot(GIGA_SLOTS.PAPER_PAPER);
}

{
  // A stamp's own XOR checkbox inverts each screen, in the commit and in the
  // preview. It used to erase any pixel inked on either screen.
  const layer = gigaDoc();
  seedFourSlots(layer);
  SelectionService.startFloatingPasteFromMask([[1, 1, 1, 1]], 4, 1, 0, 0, 'Place', null, 'none');
  const stamp = SelectionService.floatingPaste.floatingLayer;
  LayerManager.setLayerXorMode(stamp.index, true);
  SelectionService.moveStampPreview(2, 0); // re-draws the preview at (0, 0)
  check('the XOR stamp preview shows each screen inverted',
    slotsAt(stamp, [0, 1, 2, 3], 0).join() === '3,2,1,0', slotsAt(stamp, [0, 1, 2, 3], 0).join());
  PixelDrawRoutine.beginBatch();
  SelectionService.stampAt(stamp);
  PixelDrawRoutine.endBatch();
  check('stamping with XOR inverts each screen (0,1,2,3 -> 3,2,1,0)',
    slotsAt(layer, [0, 1, 2, 3], 0).join() === '3,2,1,0', slotsAt(layer, [0, 1, 2, 3], 0).join());
  SelectionService.cancelFloatingPaste();
}

{
  // A font glyph captured from the canvas is every pixel either screen inks
  const layer = gigaDoc();
  layer.setCell(0, 0, { ink: 2, paper: 7, bright: false, flash: false, pixels: rows(0xF0),
    inkB: 1, paperB: 7, brightB: false, flashB: false, pixelsB: rows(0x0F) });
  const code = 65;
  FontService.captureGlyphFromCanvasCell(0, 0, code);
  const glyph = FontService.getGlyph(code);
  check('a captured glyph holds the ink of both screens',
    glyph && glyph[0] === 0xFF, glyph && `row 0 = ${glyph[0].toString(16)}`);
}

// --- 3. Clearing both screens of an empty cell changes nothing -----------

{
  const layer = gigaDoc();
  const sel = { ...ColorManager.getCurrentSelection(), gigaSlot: GIGA_SLOTS.PAPER_PAPER };
  for (const mode of [DRAW_MODE.PIXEL_ONLY, DRAW_MODE.TRANSPARENT]) {
    const wrote = PixelDrawRoutine.draw(40, 40, sel, mode, { mirror: false });
    check(`${mode} painting Paper/Paper on an empty cell writes nothing`, wrote === false);
    check(`${mode} painting Paper/Paper leaves the empty cell see-through`,
      layer.getCell(5, 5).altered === false);
  }
  PixelDrawRoutine.draw(40, 40, { ...sel, gigaSlot: GIGA_SLOTS.PAPER_INK }, DRAW_MODE.PIXEL_ONLY, { mirror: false });
  check('Pixels Only with ink on one screen still makes the cell real',
    layer.getCell(5, 5).altered === true && layer.getPixelSlot(40, 40) === GIGA_SLOTS.PAPER_INK);
}

// --- 4-5. Old tag-model documents -----------------------------------------

function taggedDoc(layers) {
  gigaDoc();
  const bgData = LayerManager.getAllLayers()[0];
  const cellWith = (ink) => {
    const grid = [];
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) {
      const row = [];
      for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
        row.push({ ink: 0, paper: 7, bright: false, flash: false, pixels: new Uint8Array(8), altered: false });
      }
      grid.push(row);
    }
    grid[0][0] = { ink, paper: 7, bright: false, flash: false, pixels: rows(0x80), altered: true };
    return grid;
  };
  LayerManager.restoreFromData([{ ...bgData, gigaScreen: 0 }, ...layers.map(l => ({
    name: l.name, visible: l.visible !== false, opacity: 100, locked: false,
    gigaScreen: l.tag, attributeData: cellWith(l.ink)
  }))]);
}

{
  taggedDoc([{ name: 'Only A', tag: 0, ink: 2 }]);
  const c = LayerManager.layers[1].getCell(0, 0);
  check('an old document with every layer on screen A still converts',
    LayerManager.layers[1].name === 'GigaScreen');
  check('its screen A holds the layer', c.ink === 2 && c.pixels[0] === 0x80);
  check('its screen B shows the background alone, as the old model did',
    c.pixelsB[0] === 0 && c.inkB === 0, `inkB ${c.inkB} pixelsB ${c.pixelsB[0]}`);
}

{
  taggedDoc([
    { name: 'Shown', tag: 0, ink: 2 },
    { name: 'Hidden A', tag: 0, ink: 3, visible: false },
    { name: 'Hidden B', tag: 1, ink: 4, visible: false }
  ]);
  const names = LayerManager.layers.map(l => l.name).join('|');
  check('hidden layers survive the conversion, in order, above the merged one',
    names === 'Background|GigaScreen|Hidden A|Hidden B', names);
  const hiddenB = LayerManager.layers[3];
  const keptCell = hiddenB ? hiddenB.getCell(0, 0) : null;
  check('a kept layer stays hidden', !!hiddenB && hiddenB.visible === false);
  check('a kept layer holds its content on both screens',
    !!keptCell && keptCell.ink === 4 && keptCell.inkB === 4 && keptCell.pixelsB[0] === 0x80);
  check('a hidden layer is not merged into the picture',
    LayerManager.layers[1].getCell(0, 0).ink === 2 && LayerManager.layers[1].getCell(0, 0).inkB === 0);
}

{
  // A document saved by this model carries no tag and is left alone
  const layer = gigaDoc();
  layer.setCell(0, 0, { ink: 2, paper: 7, bright: false, flash: false, pixels: rows(0x80),
    inkB: 5, paperB: 7, brightB: false, flashB: false, pixelsB: rows(0x01) });
  LayerManager.restoreFromData(LayerManager.getAllLayers());
  const c = LayerManager.layers[1].getCell(0, 0);
  check('a current document is not mistaken for an old one',
    LayerManager.layers[1].name !== 'GigaScreen' && c.inkB === 5 && c.pixelsB[0] === 0x01);
}

// --- 6. The hi-res pair loses what it shows, not what it stores ------------

{
  const layer = gigaDoc('timex_hires_giga');
  ColorManager.setTimexHiresInk(2);
  ColorManager.setTimexHiresInkB(2);
  // Same pixels on both screens, cell colours that hi-res never renders
  layer.setCell(0, 0, { ink: 1, paper: 6, bright: false, flash: false, pixels: rows(0x80),
    inkB: 5, paperB: 0, brightB: true, flashB: false, pixelsB: rows(0x80) });
  check('hi-res pair -> hi-res with identical screens is not lossy',
    ScreenModeService.isConversionLossy('timex_hires_giga', 'timex_hires') === false);
  ColorManager.setTimexHiresInkB(5);
  check('hi-res pair -> hi-res with its own scheme on screen B is lossy',
    ScreenModeService.isConversionLossy('timex_hires_giga', 'timex_hires') === true);
  ColorManager.setTimexHiresInkB(2);
  layer.getCell(0, 0).pixelsB[0] = 0x40;
  check('hi-res pair -> hi-res with different screen-B pixels is lossy',
    ScreenModeService.isConversionLossy('timex_hires_giga', 'timex_hires') === true);
  ColorManager.setTimexHiresInk(0);
  ColorManager.setTimexHiresInkB(0);
}

// --- 7. Export gates name the right container -----------------------------

{
  gigaDoc('multigiga_8x4');
  const err = throwsWith(() => GigascreenFormat.export());
  check('.img export in MultiGigaScreen 8x4 is refused, not overflowed',
    err && !(err instanceof RangeError), err && `${err.name}: ${err.message}`);
  check('... and names the pair\'s own container', err && err.message.includes('.mg4'),
    err && err.message);
  const mlt = throwsWith(() => MulticolorFormat.export('mlt'));
  check('.mlt export from a pair names the container, not "{ext}"',
    mlt && mlt.message.includes('.mg4') && !mlt.message.includes('{ext}'), mlt && mlt.message);

  gigaDoc('standard_ula');
  const single = throwsWith(() => GigascreenFormat.export());
  check('.img export in a one-screen mode is refused', single && !(single instanceof RangeError),
    single && single.message);

  gigaDoc('gigascreen');
  check('.img export in GigaScreen still writes 13824 bytes',
    GigascreenFormat.export().length === SCREEN_MODES.GIGASCREEN.fileSize);
}

// --- 8. One flatten per GigaScreen GIF --------------------------------------

{
  gigaDoc('gigascreen');
  const real = LayerManager.flattenVisible;
  let calls = 0;
  LayerManager.flattenVisible = function() { calls++; return real.apply(this, arguments); };
  try {
    GIFFormat.export();
  } finally {
    LayerManager.flattenVisible = real;
  }
  check('GigaScreen GIF export flattens the document once', calls === 1, `flattened ${calls} times`);
}

// --- 9. The Next palette defaults saved before 2026-09-23 ----------------

{
  ScreenModeService.applyModeRaw('standard_ula');
  const legacy = NEXTRGB333.legacyDefaultRegisters();
  check('the old defaults are recognised', NEXTRGB333.defaultsVersion(legacy) === 'legacy');
  check('today\'s defaults are recognised',
    NEXTRGB333.defaultsVersion(NEXTRGB333.defaultRegisters()) === 'current');
  check('the two differ only in the FLASH paper banks',
    legacy.every((v, i) => (i >= NEXTRGB333.FLASH_PAPER_FIRST && i <= NEXTRGB333.FLASH_PAPER_LAST)
      || v === NEXTRGB333.defaultRegisters()[i]));

  ColorManager.setNextRegisters(legacy);
  check('an old unedited palette does not count as edited', ColorManager.isNextPaletteEdited() === false);
  check('leaving ULANext with it is not lossy',
    ScreenModeService.isConversionLossy('ulanext', 'standard_ula') === false);
  check('a picture using the ramp entries keeps them',
    ColorManager.upgradeLegacyNextDefaults(true) === false
      && NEXTRGB333.defaultsVersion(ColorManager.getNextRegisters()) === 'legacy');
  check('otherwise it moves to today\'s defaults',
    ColorManager.upgradeLegacyNextDefaults(false) === true
      && NEXTRGB333.defaultsVersion(ColorManager.getNextRegisters()) === 'current');

  const edited = NEXTRGB333.legacyDefaultRegisters();
  edited[3] = 0x1FF;
  ColorManager.setNextRegisters(edited);
  check('an edited old palette still counts as edited', ColorManager.isNextPaletteEdited() === true);
  check('an edited palette is never replaced', ColorManager.upgradeLegacyNextDefaults(false) === false
    && ColorManager.getNextRegisters()[3] === 0x1FF);
  ColorManager.setNextRegisters(null);

  // The scan that decides "uses the ramp"
  LayerManager.initialize();
  ScreenModeService.applyModeRaw('layer2_256');
  LayerManager.initialize();
  check('an empty Layer 2 picture does not use the ramp',
    LayerManager.usesPaletteIndices(NEXTRGB333.FLASH_PAPER_FIRST, NEXTRGB333.FLASH_PAPER_LAST) === false);
  LayerManager.getCurrentLayer().setPixelIndex(10, 10, 150);
  check('a Layer 2 pixel at index 150 uses it',
    LayerManager.usesPaletteIndices(NEXTRGB333.FLASH_PAPER_FIRST, NEXTRGB333.FLASH_PAPER_LAST) === true);
}

// Leave the world as we found it for the next suite
ScreenModeService.applyModeRaw('standard_ula');

summary();
