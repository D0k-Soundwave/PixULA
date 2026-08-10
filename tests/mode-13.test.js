'use strict';
/**
 * Phase 13 indexed-pixel core tests — the Next half of the mode seam:
 *  1. Registry invariants for the six Next descriptors (spot values beyond
 *     the generic screen-mode.test.js formulas).
 *  2. NEXTRGB333 register codec — RECOIL DecodeNxi byte-pair layout,
 *     channel scale, 8-bit write rule, default palette classics.
 *  3. Indexed cell model — Int16Array indices, background seeding,
 *     clone/restore round-trip.
 *  4. PixelDrawRoutine indexed draw modes (NORMAL/ERASE/PAPER/XOR/
 *     ATTRIBUTES_ONLY no-op; explicit colorSelection.index override).
 *  5. Compositor third branch — index-over-index stacking with
 *     transparency; background shows through; topmost wins.
 *  6. Depth conversions — classic->indexed (colour fidelity, transparency),
 *     indexed->classic (2-colour re-quantization), indexed<->indexed
 *     (LoRes 2× scale, 8bpp->4bpp palette clamp), lossy matrix additions.
 *  7. ULANext attrToIndices mapping + rgb333 palette derivation.
 *  8. Undo snapshot carries nextRegisters; indexed grids survive the
 *     snapshot round-trip.
 *  9. Classic gates — assertStandardScreenLayout/assertClassicPixelModel
 *     reject indexed modes; MapService.isCanvasCompatible is false.
 * Every block restores standard_ula before the next one (12a convention),
 * and AttributeSystem.clearAll() runs after direct __setActiveScreenMode
 * calls (the _rebuildEnvironment contract).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

// Recording CanvasSystem stub — remembers the last colour written per pixel
const painted = new Map(); // "x,y" -> [r,g,b]
global.CanvasSystem = {
  setPixel(x, y, r, g, b) { painted.set(`${x},${y}`, [r, g, b]); },
  markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');

ColorManager.initialize();

const STD = SCREEN_MODES.STANDARD_ULA;
const L2 = SCREEN_MODES.LAYER2_256;
const L2_320 = SCREEN_MODES.LAYER2_320;
const L2_640 = SCREEN_MODES.LAYER2_640;
const LORES = SCREEN_MODES.LORES;
const RADA = SCREEN_MODES.LORES_RADASTAN;
const UNX = SCREEN_MODES.ULANEXT;

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

// ─── 1. Registry invariants (Next spot values) ─────────────────────────────

check('LAYER2_256 native size is 49664 (512 palette + 49152)', L2.fileSize === 49664);
check('LAYER2_320/640 share the 82432 container', L2_320.fileSize === 82432 && L2_640.fileSize === 82432);
check('LORES native size is 12800', LORES.fileSize === 12800);
check('RADASTAN native size is 6656', RADA.fileSize === 6656);
check('ULANEXT is a plain 6912 SCR', UNX.fileSize === 6912 && UNX.pixelDepth === 1);
check('4bpp modes expose a 16-entry palette window',
  L2_640.paletteSize === 16 && RADA.paletteSize === 16);

// ─── 2. NEXTRGB333 codec ────────────────────────────────────────────────────

{
  // RECOIL DecodeNxi: byte0 RRRGGGBB, byte1 bit0 = blue LSB, scale n*73>>1
  const reg = NEXTRGB333.bytesToRegister(0b11101001, 1); // r=7 g=2 b=(01<<1|1)=3
  check('bytesToRegister decodes RRRGGGBB + blue LSB',
    reg === ((7 << 6) | (2 << 3) | 3));
  const rgb = NEXTRGB333.registerToRGB(reg);
  check('registerToRGB uses the RECOIL n*73>>1 scale',
    rgb[0] === (7 * 73 >> 1) && rgb[1] === (2 * 73 >> 1) && rgb[2] === (3 * 73 >> 1));
  const [b0, b1] = NEXTRGB333.registerToBytes(reg);
  check('registerToBytes round-trips', NEXTRGB333.bytesToRegister(b0, b1) === reg);
  // 8-bit write rule: blue LSB = OR of the two blue bits
  check('byteToRegister blue expansion 0/1/2/3 -> 0/3/5/7',
    (NEXTRGB333.byteToRegister(0) & 7) === 0 &&
    (NEXTRGB333.byteToRegister(1) & 7) === 3 &&
    (NEXTRGB333.byteToRegister(2) & 7) === 5 &&
    (NEXTRGB333.byteToRegister(3) & 7) === 7);
  const def = NEXTRGB333.defaultRegisters();
  check('defaultRegisters: 256 entries', def.length === 256);
  // Classic white (7) at level 6 (219 ≈ ZX 215), bright white (15) at 7
  check('defaults hold the classics in the ink half',
    def[7] === ((6 << 6) | (6 << 3) | 6) && def[15] === ((7 << 6) | (7 << 3) | 7));
  check('defaults hold the classics in the ULANext paper half',
    def[128 + 7] === def[7] && def[128 + 15] === def[15]);
  check('non-classic entries are the identity ramp',
    def[200] === NEXTRGB333.byteToRegister(200));
}

// ─── 3. Indexed cell model ──────────────────────────────────────────────────

enter('layer2_256');
{
  const layer = LayerManager.getCurrentLayer();
  const bg = LayerManager.getBackgroundLayer();
  const cell = layer.getCell(0, 0);
  check('indexed cells carry Int16Array indices (64/tile)',
    cell.indices instanceof Int16Array && cell.indices.length === 64);
  check('upper-layer cells start transparent (−1)', cell.indices[0] === -1);
  check('background cells seed with the default paper index',
    bg.getCell(0, 0).indices[0] === NEXTRGB333.DEFAULT_PAPER);
  check('PALETTE_SIZE live view reads 256', ZX_SPECTRUM.PALETTE_SIZE === 256);
  check('rgb333 palette derived with 256 entries', ColorManager.getPalette().length === 256);

  // clone/restore round-trip
  layer.setPixelIndex(3, 2, 42);
  const snap = layer.cloneAttributeData();
  layer.setPixelIndex(3, 2, 7);
  layer.restoreAttributeData(snap);
  check('indices survive the clone/restore round-trip',
    layer.getPixelIndex(3, 2) === 42);
}

// ─── 4. Indexed draw modes ──────────────────────────────────────────────────

{
  const layer = LayerManager.getCurrentLayer();
  ColorManager.setNextInk(200);
  ColorManager.setNextPaper(9);
  const sel = ColorManager.getCurrentSelection();

  PixelDrawRoutine.draw(10, 10, sel, DRAW_MODE.NORMAL);
  check('NORMAL writes the indexed ink', layer.getPixelIndex(10, 10) === 200);
  check('getPixelState exposes the index',
    PixelDrawRoutine.getPixelState(10, 10).index === 200);

  PixelDrawRoutine.draw(10, 10, { ...sel, index: 123 }, DRAW_MODE.NORMAL);
  check('explicit colorSelection.index wins', layer.getPixelIndex(10, 10) === 123);

  PixelDrawRoutine.draw(10, 10, sel, DRAW_MODE.ERASE);
  check('ERASE on an upper layer restores transparency', layer.getPixelIndex(10, 10) === -1);

  const bg = LayerManager.getBackgroundLayer();
  bg.locked = false; // background boots locked; unlock for the model check
  PixelDrawRoutine.draw(11, 10, sel, DRAW_MODE.ERASE, { layer: bg });
  check('ERASE on the background writes the indexed paper', bg.getPixelIndex(11, 10) === 9);
  bg.locked = true;

  PixelDrawRoutine.draw(12, 10, sel, DRAW_MODE.PAPER);
  check('PAPER paints the indexed paper', layer.getPixelIndex(12, 10) === 9);

  PixelDrawRoutine.draw(13, 10, sel, DRAW_MODE.NORMAL);
  PixelDrawRoutine.draw(13, 10, sel, DRAW_MODE.XOR);
  check('XOR toggles the drawing index off', layer.getPixelIndex(13, 10) === -1);

  const before = layer.getPixelIndex(14, 10);
  PixelDrawRoutine.draw(14, 10, sel, DRAW_MODE.ATTRIBUTES_ONLY);
  check('ATTRIBUTES_ONLY is a no-op on indexed cells',
    layer.getPixelIndex(14, 10) === before);
}

// ─── 5. Compositor third branch ─────────────────────────────────────────────

{
  painted.clear();
  const layerA = LayerManager.getCurrentLayer();
  const layerB = LayerManager.addLayer('Upper', false);
  layerA.setPixelIndex(0, 0, 15);   // bright white under
  layerB.setPixelIndex(0, 0, 10);   // bright red over
  layerB.setPixelIndex(1, 0, 12);   // set only above
  LayerManager.composeCellToCanvas(0, 0);

  const rgbOf = (i) => Array.from(ColorManager.getRGB(i));
  check('topmost set index wins', String(painted.get('0,0')) === String(rgbOf(10)));
  check('transparent pixels show the layer below or background',
    String(painted.get('1,0')) === String(rgbOf(12)) &&
    String(painted.get('2,0')) === String(rgbOf(NEXTRGB333.DEFAULT_PAPER)));
}

// ─── 6. Depth conversions ───────────────────────────────────────────────────

enter('standard_ula');
{
  // classic -> indexed: an altered cell with red ink on white paper
  const layer = LayerManager.getCurrentLayer();
  const sel = { ink: 2, paper: 7, bright: false, flash: false };
  PixelDrawRoutine.draw(0, 0, sel, DRAW_MODE.NORMAL);
  const converted = ScreenModeService._convertDepthGrid(layer, STD, L2);
  const cell = converted[0][0];
  check('classic->indexed: ink pixel maps to the classic entry (2)',
    cell.indices[0] === 2);
  check('classic->indexed: paper pixel of an altered cell maps to 7',
    cell.indices[1] === 7);
  check('classic->indexed: unaltered upper-layer cells stay transparent',
    converted[0][1].indices[0] === -1 && converted[0][1].altered === false);

  // classic -> indexed on the background paints every pixel
  const bgConv = ScreenModeService._convertDepthGrid(LayerManager.getBackgroundLayer(), STD, L2);
  check('classic->indexed: background is fully painted', bgConv[5][5].indices[17] === 7);
}

enter('layer2_256');
{
  // indexed -> classic: two colours in one 8×8 tile re-quantize to ink/paper
  const layer = LayerManager.getCurrentLayer();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      layer.setPixelIndex(x, y, y < 4 ? 15 : 10); // bright white / bright red
    }
  }
  const grid = ScreenModeService._convertDepthGrid(layer, L2, STD);
  const c = grid[0][0];
  check('indexed->classic: cell is altered with a 2-colour split',
    c.altered === true && (c.pixels[0] === 0xFF || c.pixels[7] === 0xFF));
  check('indexed->classic: BRIGHT survives the nearest-classic pick', c.bright === true);
  check('indexed->classic: untouched tiles stay unaltered', grid[1][1].altered === false);

  // indexed <-> indexed: LoRes is an exact 2× downscale
  layer.setPixelIndex(0, 0, 99);
  const lores = ScreenModeService._convertDepthGrid(layer, L2, LORES);
  check('256->LoRes: set pixels survive the 2×2 merge', lores[0][0].indices[0] >= 0);

  // 8bpp -> 4bpp clamps to the 16-entry window
  const rada = ScreenModeService._convertDepthGrid(layer, L2, RADA);
  check('8bpp->4bpp: indices re-map into the 16-entry window',
    rada.every(row => row.every(cl => cl.indices.every(i => i < 16))));
}

check('lossy: classic->indexed (FLASH/attrs drop)',
  ScreenModeService.isConversionLossy('standard_ula', 'layer2_256') === true);
check('lossy: indexed->classic (re-quantization)',
  ScreenModeService.isConversionLossy('layer2_256', 'standard_ula') === true);
check('lossy: 8bpp->4bpp', ScreenModeService.isConversionLossy('layer2_256', 'layer2_640') === true);
check('lossless: standard->ULANext (defaults reproduce the classics)',
  ScreenModeService.isConversionLossy('standard_ula', 'ulanext') === false);
check('lossless: ULANext->standard with unedited palette',
  ScreenModeService.isConversionLossy('ulanext', 'standard_ula') === false);

// ─── 7. ULANext mapping ─────────────────────────────────────────────────────

enter('ulanext');
{
  check('ULANext palette is the 256-entry register file',
    ColorManager.getPalette().length === 256);
  const t = ColorManager.attrToIndices({ ink: 2, paper: 7, bright: true, flash: true });
  check('ULANext ink resolves in the ink half', t.ink === 8 + 2);
  check('ULANext paper resolves in the paper half at 128+', t.paper === 128 + 8 + 7);
  check('nothing flashes in ULANext', t.flashing === false);
  // Default registers reproduce the classic look in both halves
  const inkRGB = ColorManager.getRGB(t.ink);
  const paperRGB = ColorManager.getRGB(t.paper);
  check('ULANext defaults: bright red ink renders red-ish',
    inkRGB[0] > 200 && inkRGB[1] === 0);
  check('ULANext defaults: bright white paper renders white-ish',
    paperRGB[0] > 200 && paperRGB[1] > 200 && paperRGB[2] > 200);
}

// ─── 8. Undo snapshot carries the Next state ────────────────────────────────

enter('layer2_256');
{
  ColorManager.setNextRegister(5, 0x123);
  UndoRedo.clear();
  UndoRedo.beginAction('draw');
  PixelDrawRoutine.draw(20, 20, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
  UndoRedo.endAction();
  ColorManager.setNextRegister(5, 0x055);
  UndoRedo.beginAction('regs');
  ColorManager.setNextRegister(5, 0x1FF);
  UndoRedo.endAction();
  UndoRedo.undo();
  check('undo restores the Next register file',
    ColorManager.getNextRegisters()[5] === 0x055);
  UndoRedo.undo();
  check('undo restores indexed pixels',
    LayerManager.getCurrentLayer().getPixelIndex(20, 20) === -1);
  ColorManager.setNextRegisters(null);
}

// ─── 9. Classic gates ───────────────────────────────────────────────────────

{
  let threw = false;
  try { Helpers.assertStandardScreenLayout(); } catch (e) { threw = true; }
  check('assertStandardScreenLayout rejects indexed modes', threw);
  threw = false;
  try { Helpers.assertClassicPixelModel(); } catch (e) { threw = true; }
  check('assertClassicPixelModel rejects indexed modes', threw);
  check('isValidCellData validates the indexed shape',
    Validators.isValidCellData(LayerManager.getCurrentLayer().getCell(0, 0)) === true);
  check('isValidPaletteIndex honours the palette window',
    Validators.isValidPaletteIndex(255) === true && Validators.isValidPaletteIndex(256) === false);
}

// Reset to boot default for any suite that runs after us
enter('standard_ula');
check('reset to standard_ula for following suites', ACTIVE_SCREEN_MODE.id === 'standard_ula');

summary('mode-13');
