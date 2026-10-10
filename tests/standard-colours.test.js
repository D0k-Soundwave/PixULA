'use strict';
/**
 * Batch 6 part 6B: the standard Spectrum colours can be edited (15 distinct colours; bright black stays black), loaded from
 * a ZX Paintbrush .pal, saved, and reset. They change what is SHOWN and what image exports contain (PNG, GIF, BMP, JPG
 * read the composed picture); they never change the bytes of .scr / .tap, and ULAplus / Next palettes are untouched.
 * ZX_PALETTE itself stays frozen: it is the default and the reset target.
 */
const fs = require('fs');
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/io/format-registry.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/next-palette-format.js');
loadModule('js/io/gif-format.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}
const rgb = (i) => Array.from(ColorManager.getRGB(i));
const sameArr = (a, b) => JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b));
const STANDARD = Array.from(ZX_PALETTE);

enter('standard_ula');
ColorManager.setStandardColours(null);

// --- defaults ------------------------------------------------------------------------------------------------------------------
check('by default the standard colours are ZX_PALETTE', sameArr(ColorManager.getStandardColours(), STANDARD));
check('and nothing is marked edited', ColorManager.isStandardEdited() === false);

// --- editing -------------------------------------------------------------------------------------------------------------------
const edited = STANDARD.slice();
edited[10] = '#FF8000';              // bright red -> orange
edited[2] = '#C00000';
check('setStandardColours accepts 16 colours', ColorManager.setStandardColours(edited) === true);
check('the shown RGB follows (bright red)', sameArr(rgb(10), [255, 128, 0]));
check('and (normal red)', sameArr(rgb(2), [192, 0, 0]));
check('the palette hex follows', ColorManager.palette[10] === '#FF8000');
check('it is marked edited', ColorManager.isStandardEdited() === true);
check('ZX_PALETTE is untouched (frozen default)', ZX_PALETTE[10] === '#FF0000' && Object.isFrozen(ZX_PALETTE));

// a cell using ink 2 bright resolves to the edited colour
{
  const r = LayerManager._resolveCellColors({ ink: 2, paper: 0, bright: true, flash: false });
  check('a cell with bright red ink is drawn orange', sameArr(r.ink, [255, 128, 0]));
}

// --- bright black is black ------------------------------------------------------------------------------------------------------
{
  const e2 = STANDARD.slice();
  e2[8] = '#123456';
  ColorManager.setStandardColours(e2);
  check('index 8 (bright black) is forced to follow black', ColorManager.getStandardColours()[8] === ColorManager.getStandardColours()[0]);
  const e3 = STANDARD.slice();
  e3[0] = '#101010';
  ColorManager.setStandardColours(e3);
  check('and when black is edited, bright black follows', sameArr(rgb(8), [16, 16, 16]) && sameArr(rgb(0), [16, 16, 16]));
}

// --- bad input -----------------------------------------------------------------------------------------------------------------------
{
  const before = ColorManager.getStandardColours();
  check('wrong length is refused', ColorManager.setStandardColours(STANDARD.slice(0, 15)) === false);
  check('a non-colour is refused', ColorManager.setStandardColours(STANDARD.map((c, i) => (i === 3 ? 'red' : c))) === false);
  check('a non-array is refused', ColorManager.setStandardColours('x') === false);
  check('refusals change nothing', sameArr(ColorManager.getStandardColours(), before));
  check('short hex is expanded', ColorManager.setStandardColours(STANDARD.map((c, i) => (i === 5 ? '#0ff' : c))) === true &&
    ColorManager.getStandardColours()[5] === '#00FFFF');
}

// --- reset -------------------------------------------------------------------------------------------------------------------------
ColorManager.setStandardColours(edited);
ColorManager.setStandardColours(null);
check('reset restores ZX_PALETTE', sameArr(ColorManager.getStandardColours(), STANDARD) && sameArr(rgb(10), [255, 0, 0]));
check('and is no longer edited', ColorManager.isStandardEdited() === false);

// --- exports: images follow, screens do not ---------------------------------------------------------------------------------------
{
  const px = ZX_COORDS.cellToPixel(1, 1);
  PixelDrawRoutine.draw(px.x, px.y, { ink: 2, paper: 0, bright: true, flash: false }, DRAW_MODE.NORMAL, { mirror: false });
  const scrBefore = Array.from(SCRFormat.export());
  const gifBefore = Array.from(GIFFormat.export({}));
  ColorManager.setStandardColours(edited);
  const scrAfter = Array.from(SCRFormat.export());
  const gifAfter = Array.from(GIFFormat.export({}));
  check('a .scr is byte-identical whatever the standard colours are', sameArr(scrBefore, scrAfter));
  check('a GIF is not: its colour table follows', !sameArr(gifBefore, gifAfter));
  // global colour table: after the 13-byte header + logical screen descriptor; entry 10 = bright red
  const t = 13 + 3 * 10;
  check('GIF colour table entry 10 is the edited colour', gifAfter[t] === 255 && gifAfter[t + 1] === 128 && gifAfter[t + 2] === 0,
    gifAfter.slice(t, t + 3).join(','));
  ColorManager.setStandardColours(null);
}

// --- modes with another palette are untouched -------------------------------------------------------------------------------------------
ColorManager.setStandardColours(edited);
enter('ula_plus');
ColorManager.setUlaplusRegisters(null);
{
  const r0 = ULAPLUS.registerToRGB(ULAPLUS.defaultRegisters()[10]);
  check('ULAplus ignores the standard colours', sameArr(rgb(10), r0));
}
enter('ulanext');
ColorManager.setNextRegisters(null);
check('and so does ULANext', sameArr(rgb(10), NEXTRGB333.registerToRGB(NEXTRGB333.defaultRegisters()[10])));

// Timex hi-res: its colours are the bright half, so it follows
enter('timex_hires');
ColorManager.applyScreenMode();
{
  const ink = ColorManager.timexHiresInk & 7;
  check('Timex hi-res ink follows the standard colours', sameArr(rgb(1), ColorManager.getStandardColoursRGB()[ink + 8]));
}
enter('standard_ula');

// --- ZX Paintbrush .pal: the layout [M, Brights.pal 256 bytes, 2026-10-10] ----------------------------------------------------------------------
{
  // built here: 64 entries x R,G,B,0 in ULAplus CLUT order; CLUT c shows the normal half for c = 0, 2 and the bright half for 1, 3
  const norm = ['#000000', '#00006E', '#AA0000', '#B60082', '#00A200', '#00A2A2', '#9E9E00', '#969696'];
  const brig = ['#323232', '#3232DE', '#FF3232', '#FF32FF', '#32FF32', '#32FFFF', '#FFFF32', '#FFFFFF'];
  const hex16 = [...norm, ...brig];
  const bytes = NextPaletteFormat.encodeStandardColours(hex16);
  check('encodeStandardColours writes 256 bytes', bytes.length === 256);
  check('entry 1 is 00,00,6E,00', sameArr(bytes.slice(4, 8), [0x00, 0x00, 0x6E, 0x00]));
  check('entry 16 (bright black slot) is the bright colour 0', sameArr(bytes.slice(64, 68), [0x32, 0x32, 0x32, 0x00]));
  const back = NextPaletteFormat.decodeStandardColours(bytes);
  check('it decodes back: normal colours from entries 0-7', back && back.hex16.slice(0, 8).every((c, i) => c === norm[i]));
  check('bright colours from entries 16-23, bright black dropped to black',
    back && back.hex16.slice(9, 16).every((c, i) => c === brig[i + 1]) && back.hex16[8] === norm[0] && back.brightBlackDropped === true);
  check('wrong sizes are refused', NextPaletteFormat.decodeStandardColours(bytes.slice(0, 255)) === null &&
    NextPaletteFormat.decodeStandardColours(new Uint8Array(257)) === null);
  const dirty = Uint8Array.from(bytes);
  dirty[3] = 9;
  check('a non-zero pad byte is refused', NextPaletteFormat.decodeStandardColours(dirty) === null);
  const std = NextPaletteFormat.decodeStandardColours(NextPaletteFormat.encodeStandardColours(STANDARD));
  check('the standard colours round-trip with nothing dropped', std && std.hex16.every((c, i) => c === STANDARD[i]) && std.brightBlackDropped === false);

  const path = 'C:\\Program Files (x86)\\ZX-Paintbrush\\Brights.pal';
  if (fs.existsSync(path)) {
    const real = NextPaletteFormat.decodeStandardColours(new Uint8Array(fs.readFileSync(path)));
    check('the real Brights.pal decodes to the hand-listed colours [M, 2026-10-10]',
      real && real.hex16.slice(0, 8).every((c, i) => c === norm[i]) && real.hex16.slice(9, 16).every((c, i) => c === brig[i + 1]) &&
      real.brightBlackDropped === true);
    check('and re-encoding the decoded colours gives its colour bytes back',
      sameArr(Array.from(NextPaletteFormat.encodeStandardColours(real.hex16)).filter((_, i) => i % 4 !== 3).slice(0, 24),
        Array.from(fs.readFileSync(path)).filter((_, i) => i % 4 !== 3).slice(0, 24)));
  } else {
    console.log('  SKIP: Brights.pal is not on this machine; the built-in layout checks above still ran');
  }
}

summary();
