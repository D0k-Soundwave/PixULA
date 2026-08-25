'use strict';
/**
 * Per-mode screen formats (Phase 12a):
 *  - .mlt (8×1, 12288) export/import round-trip through the real stack,
 *    including the interleaved-bitmap + linear-attribute layout and the
 *    import-side mode switch.
 *  - .mc (linear bitmap) imports to the same document as its .mlt twin.
 *  - .ifl (8×2, 9216) round-trip.
 *  - Export conversion rules: lossless refine from coarser modes; the
 *    coarsen and ULAplus gates throw.
 *  - SCR: ULAplus 6976 variant round-trips screen + palette registers and
 *    switches modes on import; classic sizes still work; rejects hold.
 *  - The Image2ULAplus pipeline: buildUlaplusPalette + the per-CLUT cell
 *    pair chooser produce a palette that reproduces a synthetic image.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

// Minimal DOM shim for ColorManager's CSS-token writes (guarded anyway)
global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/multicolor-format.js');

const MLT = FormatRegistryHandler('mlt');
const MC = FormatRegistryHandler('mc');
const IFL = FormatRegistryHandler('ifl');

function FormatRegistryHandler(ext) {
  // The adapters register against the stubbed registry; rebuild them here
  return {
    parse: (buf) => MulticolorFormat.parse(ext, buf),
    export: () => MulticolorFormat.export(ext)
  };
}

// ─── Seed a deterministic 8×1 document ──────────────────────────────────────

__setActiveScreenMode('multicolor_8x1');
LayerManager.initialize();
const layer = LayerManager.getCurrentLayer();
for (let cy = 0; cy < 192; cy++) {
  for (let cx = 0; cx < 32; cx++) {
    layer.setCell(cx, cy, {
      ink: (cx + cy) % 8,
      paper: (cx * 3 + cy * 5) % 8,
      bright: ((cx + cy) & 1) === 0,
      flash: (cy % 11) === 3,
      pixels: Uint8Array.from([(cx * 8 + cy * 3) & 0xFF]),
      altered: true
    });
  }
}

// ─── .mlt export layout + round-trip ────────────────────────────────────────

const mltBytes = MLT.export();
check('mlt export is 12288 bytes', mltBytes.length === 12288, `got ${mltBytes.length}`);

// Interleaved bitmap: pixel line y=1 lives at offset 256 (y&7)<<8
check('mlt bitmap is interleaved',
  mltBytes[256] === ((0 * 8 + 1 * 3) & 0xFF)
  && mltBytes[0] === 0 /* line 0, cx 0: (0*8+0*3)=0 */);
// Linear attrs: line y row at 6144 + y*32
const attr0 = mltBytes[6144];
check('mlt attrs are linear FBpppiii',
  attr0 === ((0 % 8) | (((0 * 3 + 0 * 5) % 8) << 3) | 0x40) /* bright, no flash */,
  `got 0x${attr0.toString(16)}`);
const attr3 = mltBytes[6144 + 3 * 32];
check('mlt flash bit set on line 3', (attr3 & 0x80) !== 0);

// Round-trip through a DIFFERENT active mode: parse switches to 8×1
__setActiveScreenMode('standard_ula');
LayerManager.initialize();
const mltResult = MLT.parse(mltBytes.buffer);
check('mlt parses', mltResult.success === true, mltResult.error);
check('mlt import switched the mode', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');
check('mlt round-trip is byte-identical',
  Buffer.from(MLT.export()).equals(Buffer.from(mltBytes)));

// Undo of the import restores the pre-import mode
UndoRedo.undo();
check('undo of mlt import restores previous mode', ACTIVE_SCREEN_MODE.id === 'standard_ula');
UndoRedo.redo();
check('redo returns to 8×1', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');

// ─── .mc (linear bitmap) equals its .mlt twin ───────────────────────────────

// Build the .mc variant from the .mlt bytes: permute bitmap to linear order
const lineOffset = (y) => ((y & 0xC0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2);
const mcBytes = new Uint8Array(mltBytes);
for (let y = 0; y < 192; y++) {
  for (let x = 0; x < 32; x++) {
    mcBytes[y * 32 + x] = mltBytes[lineOffset(y) + x];
  }
}
LayerManager.initialize();
const mcResult = MC.parse(mcBytes.buffer);
check('mc parses', mcResult.success === true, mcResult.error);
check('mc import equals the mlt document',
  Buffer.from(MLT.export()).equals(Buffer.from(mltBytes)));

// ─── Rejects ────────────────────────────────────────────────────────────────

check('mlt rejects wrong size', MLT.parse(new Uint8Array(6912).buffer).success === false);
check('ifl rejects wrong size', IFL.parse(new Uint8Array(12288).buffer).success === false);

// ─── Export conversion rules ────────────────────────────────────────────────

// From 8×1, exporting .ifl would coarsen — must throw
let threw = false;
try { IFL.export(); } catch (e) { threw = true; }
check('ifl export from 8×1 gates (would coarsen)', threw);

// MulticolorFormat.canExport(ext) mirrors export(ext)'s throw/no-throw
{
  __setActiveScreenMode('multicolor_8x1');
  check('mlt canExport true in multicolor_8x1', MulticolorFormat.canExport('mlt') === true);
  check('ifl canExport false in multicolor_8x1 (would coarsen)',
    MulticolorFormat.canExport('ifl') === false);
  __setActiveScreenMode('ula_plus');
  check('mlt canExport false in ula_plus (not fixed16)', MulticolorFormat.canExport('mlt') === false);
  __setActiveScreenMode('standard_ula');
  check('mlt canExport true in standard_ula', MulticolorFormat.canExport('mlt') === true);
  check('ifl canExport true in standard_ula', MulticolorFormat.canExport('ifl') === true);
}

// From standard (8×8), .mlt export refines losslessly: every pixel line of a
// cell carries the same attribute byte
__setActiveScreenMode('standard_ula');
LayerManager.initialize();
const stdLayer = LayerManager.getCurrentLayer();
stdLayer.setCell(4, 2, {
  ink: 5, paper: 2, bright: true, flash: false,
  pixels: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]), altered: true
});
const refined = MLT.export();
check('mlt export from standard is 12288', refined.length === 12288);
const cellAttr = 5 | (2 << 3) | 0x40;
let replicated = true;
for (let line = 16; line < 24; line++) { // cell row 2 -> pixel lines 16-23
  if (refined[6144 + line * 32 + 4] !== cellAttr) replicated = false;
}
check('refine replicates the cell attr down all 8 lines', replicated);
check('refine keeps the bitmap bytes',
  refined[lineOffset(17) + 4] === 2 && refined[lineOffset(23) + 4] === 8);

// .ifl from standard round-trips through 8×2
const iflBytes = IFL.export();
check('ifl export is 9216 bytes', iflBytes.length === 9216, `got ${iflBytes.length}`);
LayerManager.initialize();
const iflResult = IFL.parse(iflBytes.buffer);
check('ifl parses and switches to 8×2', iflResult.success === true
  && ACTIVE_SCREEN_MODE.id === 'multicolor_8x2');
check('ifl round-trip is byte-identical',
  Buffer.from(IFL.export()).equals(Buffer.from(iflBytes)));

// ─── SCR: ULAplus variant ───────────────────────────────────────────────────

__setActiveScreenMode('ula_plus');
LayerManager.initialize();
const upLayer = LayerManager.getCurrentLayer();
upLayer.setCell(1, 1, {
  ink: 3, paper: 6, bright: true, flash: true, // CLUT 3 in ULAplus terms
  pixels: Uint8Array.from([0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55]),
  altered: true
});
const customRegs = ULAPLUS.defaultRegisters();
customRegs[0] = 0x12;
customRegs[63] = 0xEE;
ColorManager.setUlaplusRegisters(customRegs);

const upBytes = SCRFormat.export();
check('ULAplus SCR export is 6976 bytes', upBytes.length === 6976, `got ${upBytes.length}`);
check('palette registers appended at 6912',
  upBytes[6912] === 0x12 && upBytes[6912 + 63] === 0xEE);
check('attr byte keeps CLUT bits', upBytes[6144 + 32 + 1] === (3 | (6 << 3) | 0x40 | 0x80));

// Import under standard mode: switches to ULAplus and restores the registers
__setActiveScreenMode('standard_ula');
LayerManager.initialize();
ColorManager.setUlaplusRegisters(null);
const upResult = SCRFormat.parse(upBytes.buffer);
check('6976 SCR parses', upResult.success === true, upResult.error);
check('import switched to ULAplus', ACTIVE_SCREEN_MODE.id === 'ula_plus');
check('registers restored', ColorManager.getUlaplusRegisters()[0] === 0x12
  && ColorManager.getUlaplusRegisters()[63] === 0xEE);
check('ULAplus SCR round-trip is byte-identical',
  Buffer.from(SCRFormat.export()).equals(Buffer.from(upBytes)));

// SCR export gates in multicolor modes
__setActiveScreenMode('multicolor_8x1');
threw = false;
try { SCRFormat.export(); } catch (e) { threw = true; }
check('scr export gates in multicolor modes', threw);

// SCRFormat.canExport() mirrors export()'s throw/no-throw across modes —
// used by FormatRegistry.isExportCompatible() to filter the Save dialogs
// before the artist picks a format, not just report failure after.
{
  const compatible = ['standard_ula', 'ula_plus', 'multicolor_8x1', 'ula_plus_8x1', 'timex_hires'];
  const incompatible = ['multicolor_8x4', 'multicolor_8x2', 'gigascreen', 'layer2_256'];
  for (const id of compatible) {
    __setActiveScreenMode(id);
    check(`SCR canExport true in ${id}`, SCRFormat.canExport() === true);
  }
  for (const id of incompatible) {
    __setActiveScreenMode(id);
    check(`SCR canExport false in ${id}`, SCRFormat.canExport() === false);
  }
}

// Classic sizes still import (and switch back to standard)
__setActiveScreenMode('standard_ula');
LayerManager.initialize();
check('6912 still parses', SCRFormat.parse(new Uint8Array(6912).buffer).success === true);
check('6144 still parses', SCRFormat.parse(new Uint8Array(6144).buffer).success === true);
check('6913 still rejected', SCRFormat.parse(new Uint8Array(6913).buffer).success === false);

// ─── Image2ULAplus pipeline (pure) ──────────────────────────────────────────

loadModule('js/utils/palette-ops.js');
loadModule('js/io/png-format.js');

// Synthetic 256×192 image: left half solid dark blue, right half solid orange
const img = { width: 256, height: 192, data: new Uint8ClampedArray(256 * 192 * 4) };
for (let y = 0; y < 192; y++) {
  for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    const orange = x >= 128;
    img.data[i] = orange ? 255 : 0;
    img.data[i + 1] = orange ? 146 : 0;
    img.data[i + 2] = orange ? 0 : 170;
    img.data[i + 3] = 255;
  }
}

const regs = PNGFormat.buildUlaplusPalette(img);
check('palette has 64 registers', regs.length === 64);
const allRGBs = Array.from(regs, (r) => ULAPLUS.registerToRGB(r));
const hasNear = (target) => allRGBs.some((c) =>
  Math.abs(c[0] - target[0]) < 40 && Math.abs(c[1] - target[1]) < 40 && Math.abs(c[2] - target[2]) < 40);
check('palette contains the image blue', hasNear([0, 0, 170]));
check('palette contains the image orange', hasNear([255, 146, 0]));

// Per-cell pick: a solid orange cell must resolve to a near-orange colour
const cellRGB = new Float32Array(64 * 3);
for (let i = 0; i < 64; i++) {
  cellRGB[i * 3] = 255; cellRGB[i * 3 + 1] = 146; cellRGB[i * 3 + 2] = 0;
}
const pick = PNGFormat._chooseCellPairUlaplus(cellRGB, allRGBs);
check('pick has CLUT and slots in range', pick.clut >= 0 && pick.clut < 4
  && pick.inkSlot >= 0 && pick.inkSlot < 8 && pick.paperSlot >= 0 && pick.paperSlot < 8);
const mask = PNGFormat._renderCellMask(cellRGB, pick, 'none');
const solid = Array.from(mask).every((b) => b === 0xFF) || Array.from(mask).every((b) => b === 0x00);
check('solid cell renders solid', solid);
const shown = solid && mask[0] === 0xFF ? pick.inkRGB : pick.paperRGB;
check('solid orange cell shows near-orange',
  Math.abs(shown[0] - 255) < 40 && Math.abs(shown[1] - 146) < 40 && Math.abs(shown[2] - 0) < 40,
  `shown=[${shown.join(',')}]`);

// Reset for any later suites in the same process
__setActiveScreenMode('standard_ula');

summary();
