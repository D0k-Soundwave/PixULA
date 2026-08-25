'use strict';
/**
 * Phase 13 Next formats:
 *  - .nxi: 49664 = 512-byte RGB333 palette + 49152 8bpp bitmap (RECOIL
 *    DecodeNxi layout); import switches the mode + loads the palette;
 *    byte-identical round-trip; raw 49152 accepted; size rejects.
 *  - .sl2: raw bitmap dump; LoRes (12288/12800) and Radastan 4bpp
 *    (6144/6656) size mapping; the 81920 ambiguity honours the active
 *    LAYER2_640 mode; 4bpp nibble packing (left pixel high).
 *  - .pal/.npl: 512-byte pair form round-trip; 256-byte 8-bit form
 *    expands blue via the OR rule; size rejects.
 *  - .spr: 8bpp/4bpp stride mapping, packing round-trip, depth
 *    preference on ambiguous lengths, size reject; SpriteService sheet
 *    model (transparency defaults, depth mask, ops).
 *  - Next tilemap export: 4bpp tile defs from ula-cell tiles (ink/paper
 *    classic slots), u16 dims + $FF empty cells, .bin layout.
 *  - Classic gates: SCRFormat/mlt/GIF reject the indexed modes.
 * Resets to standard_ula at the end (12a suite convention).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

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
loadModule('js/services/sprite-service.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/multicolor-format.js');
loadModule('js/io/gif-format.js');
loadModule('js/io/nxi-format.js');
loadModule('js/io/next-palette-format.js');
loadModule('js/io/spr-format.js');
loadModule('js/io/dev-format.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

// ─── .nxi Layer 2 256×192 round-trip ────────────────────────────────────────

enter('layer2_256');
{
  const layer = LayerManager.getCurrentLayer();
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 256; x += 7) {
      layer.setPixelIndex(x, y, (x + y * 3) & 0xFF);
    }
  }
  ColorManager.setNextRegister(200, 0x155);

  const nxi = NXIFormat.export('nxi');
  check('.nxi export is 49664 bytes', nxi.length === 49664, `got ${nxi.length}`);
  // Palette block first: entry 200 round-trips through the byte pair
  const reg200 = NEXTRGB333.bytesToRegister(nxi[400], nxi[401]);
  check('.nxi palette block carries the edited register', reg200 === 0x155);

  const sl2 = NXIFormat.export('sl2');
  check('.sl2 is the raw 49152 bitmap', sl2.length === 49152);
  check('.sl2 equals the .nxi bitmap block',
    Buffer.from(sl2).equals(Buffer.from(nxi.subarray(512))));

  enter('standard_ula');
  const res = NXIFormat.parse('nxi', nxi.buffer.slice(0));
  check('.nxi parses', res.success === true, res.error);
  check('.nxi import switched to layer2_256', ACTIVE_SCREEN_MODE.id === 'layer2_256');
  check('.nxi import loaded the palette',
    ColorManager.getNextRegisters()[200] === 0x155);
  check('.nxi round-trip is byte-identical',
    Buffer.from(NXIFormat.export('nxi')).equals(Buffer.from(nxi)));

  UndoRedo.undo();
  check('undo restores the pre-import mode', ACTIVE_SCREEN_MODE.id === 'standard_ula');

  // Raw (palette-less) bitmap accepted
  const res2 = NXIFormat.parse('nxi', sl2.buffer.slice(0));
  check('raw 49152 .nxi accepted', res2.success === true, res2.error);
  check('raw import switched to layer2_256', ACTIVE_SCREEN_MODE.id === 'layer2_256');

  check('.nxi rejects a bad size',
    NXIFormat.parse('nxi', new ArrayBuffer(1000)).success === false);
  ColorManager.setNextRegisters(null);
}

// ─── Size -> mode mapping + 4bpp packing ─────────────────────────────────────

{
  const m = (len, active) => {
    const r = NXIFormat.modeForLength(len, active);
    return r ? `${r.mode.id}:${r.hasPalette}` : 'null';
  };
  check('12800 maps to LoRes with palette', m(12800, 'standard_ula') === 'lores:true');
  check('12288 maps to raw LoRes', m(12288, 'standard_ula') === 'lores:false');
  check('6656 maps to Radastan with palette', m(6656, 'standard_ula') === 'lores_radastan:true');
  check('81920 maps to LAYER2_320 by default', m(81920, 'standard_ula') === 'layer2_320:false');
  check('81920 honours an active LAYER2_640 document', m(81920, 'layer2_640') === 'layer2_640:false');

  // 4bpp packing: left pixel in the high nibble
  const RADA = SCREEN_MODES.LORES_RADASTAN;
  const idx = new Int16Array(RADA.width * RADA.height);
  idx[0] = 0xA; idx[1] = 0x5;
  const packed = NXIFormat.packBitmap(idx, RADA);
  check('4bpp packs the left pixel into the high nibble', packed[0] === 0xA5);
  const back = NXIFormat.unpackBitmap(packed, RADA);
  check('4bpp packing round-trips', back[0] === 0xA && back[1] === 0x5);
}

// ─── Radastan 4bpp round-trip ───────────────────────────────────────────────

enter('lores_radastan');
{
  const layer = LayerManager.getCurrentLayer();
  for (let y = 0; y < 96; y++) layer.setPixelIndex(y % 128, y, (y * 5) & 0x0F);
  const nxi = NXIFormat.export('nxi');
  check('Radastan .nxi is 6656 bytes', nxi.length === 6656);
  enter('standard_ula');
  const res = NXIFormat.parse('nxi', nxi.buffer.slice(0));
  check('Radastan .nxi parses into its mode',
    res.success === true && ACTIVE_SCREEN_MODE.id === 'lores_radastan');
  check('Radastan round-trip is byte-identical',
    Buffer.from(NXIFormat.export('nxi')).equals(Buffer.from(nxi)));
}

// ─── .pal / .npl ────────────────────────────────────────────────────────────

enter('standard_ula');
{
  const regs = NEXTRGB333.defaultRegisters();
  regs[3] = 0x1C7;
  const bytes = NextPaletteFormat.encode(regs);
  check('.pal encodes 512 bytes', bytes.length === 512);
  const back = NextPaletteFormat.decode(bytes);
  check('.pal 512-byte form round-trips', back[3] === 0x1C7 && back[255] === regs[255]);

  // 256-byte 8-bit form: blue LSB = OR of the two blue bits
  const eightBit = new Uint8Array(256);
  eightBit[0] = 0x01; // blue bits 01 -> blue3 = 011
  const regs8 = NextPaletteFormat.decode(eightBit);
  check('.pal 256-byte form expands blue via the OR rule', (regs8[0] & 7) === 3);

  check('.pal rejects a bad size', NextPaletteFormat.decode(new Uint8Array(100)) === null);

  const res = NextPaletteFormat.parse('pal', bytes.buffer.slice(0));
  check('.pal import replaces the document registers',
    res.success === true && ColorManager.getNextRegisters()[3] === 0x1C7);
  UndoRedo.undo();
  ColorManager.setNextRegisters(null);
}

// 64-byte ULAplus kind: the file SIZE designates the palette, and each kind
// only touches its own register file.
{
  const up = ULAPLUS.defaultRegisters();
  up[5] = 0xE3;
  const bytes = NextPaletteFormat.encodeUlaplus(up);
  check('.pal ULAplus kind encodes 64 bytes', bytes.length === 64);
  const back = NextPaletteFormat.decodeUlaplus(bytes);
  check('.pal 64-byte form round-trips', back[5] === 0xE3 && back[63] === up[63]);
  check('.pal decodeUlaplus rejects other sizes',
    NextPaletteFormat.decodeUlaplus(new Uint8Array(512)) === null);

  const res = NextPaletteFormat.parse('pal', bytes.buffer.slice(0));
  check('.pal 64-byte import replaces the ULAplus registers',
    res.success === true && ColorManager.getUlaplusRegisters()[5] === 0xE3);
  check('.pal 64-byte import leaves the Next registers alone',
    !ColorManager.isNextPaletteEdited());
  UndoRedo.undo();
  ColorManager.setUlaplusRegisters(null);
}

// Export kind follows the ACTIVE mode's palette model
{
  enter('ula_plus');
  check('.pal export in ULAplus mode emits the 64-byte kind',
    NextPaletteFormat.export().length === 64);
  enter('layer2_256');
  check('.pal export in a Next mode emits the 512-byte kind',
    NextPaletteFormat.export().length === 512);
  const npl = NextPaletteFormat.export('npl');
  check('.npl export appends the $E3 transparency byte (513 bytes)',
    npl.length === 513 && npl[512] === 0xE3);
  check('.npl 513-byte form imports (transparency byte ignored)',
    NextPaletteFormat.decode(npl) !== null &&
    NextPaletteFormat.decode(npl)[0] === NextPaletteFormat.decode(npl.subarray(0, 512))[0]);
  enter('standard_ula');
  let threw = false;
  try { NextPaletteFormat.export(); } catch (e) { threw = true; }
  check('.pal export refuses in fixed-palette modes', threw);

  // canExport() mirrors export()'s throw/no-throw across palette models
  check('.pal canExport false in standard_ula (fixed16)', NextPaletteFormat.canExport() === false);
  enter('ula_plus');
  check('.pal canExport true in ula_plus (ulaplus64)', NextPaletteFormat.canExport() === true);
  enter('layer2_256');
  check('.pal canExport true in layer2_256 (rgb333)', NextPaletteFormat.canExport() === true);
  enter('timex_hires');
  check('.pal canExport false in timex_hires (timexMono)', NextPaletteFormat.canExport() === false);
}

// .slr (Next BASIC LoRes save) routes through the same size table
{
  enter('lores');
  const layer = LayerManager.getCurrentLayer();
  layer.setPixelIndex(5, 5, 77);
  const raw = NXIFormat.export('slr');
  check('.slr export is the raw LoRes dump', raw.length === SCREEN_MODES.LORES.bitmapSize);
  enter('standard_ula');
  const res = NXIFormat.parse('slr', raw.buffer.slice(0));
  check('.slr import resolves to LoRes and restores the pixel',
    res.success === true && ACTIVE_SCREEN_MODE.id === 'lores' &&
    LayerManager.getCurrentLayer().getPixelIndex(5, 5) === 77);
  UndoRedo.undo();
}

// +3DOS-headed .sl2 imports (SpecNext wiki: 128-byte header + pixel data)
{
  enter('layer2_256');
  const layer = LayerManager.getCurrentLayer();
  layer.setPixelIndex(3, 0, 99);
  const raw = NXIFormat.export('sl2');
  const headed = new Uint8Array(128 + raw.length);
  for (let i = 0; i < 8; i++) headed[i] = 'PLUS3DOS'.charCodeAt(i);
  headed[8] = 0x1A;
  headed.set(raw, 128);
  enter('standard_ula');
  const res = NXIFormat.parse('sl2', headed.buffer.slice(0));
  check('.sl2 with a +3DOS header imports (header stripped)',
    res.success === true && ACTIVE_SCREEN_MODE.id === 'layer2_256' &&
    LayerManager.getCurrentLayer().getPixelIndex(3, 0) === 99);
  UndoRedo.undo();
}

// ─── .spr + SpriteService ───────────────────────────────────────────────────

{
  check('sheet boots with one transparent 8bpp sprite',
    SpriteService.getCount() === 1 && SpriteService.getDepth() === 8 &&
    SpriteService.getSprite(0)[0] === 0xE3);

  SpriteService.setPixel(0, 0, 0, 42);
  SpriteService.setPixel(0, 15, 0, 7);
  const one = SpriteFormat.export();
  check('8bpp .spr is 256 bytes per sprite', one.length === 256);
  check('8bpp bytes are row-major indices', one[0] === 42 && one[15] === 7);

  check('depthForLength: 384 bytes is 4bpp only (3 sprites)',
    SpriteFormat.depthForLength(384, 8) === 4);
  check('depthForLength: 512 bytes honours the sheet depth',
    SpriteFormat.depthForLength(512, 4) === 4 && SpriteFormat.depthForLength(512, 8) === 8);
  check('depthForLength rejects odd sizes', SpriteFormat.depthForLength(100, 8) === null);

  // 4bpp pack/unpack round-trip
  const spr = new Uint8Array(256);
  spr[0] = 0xA; spr[1] = 0x5;
  const packed = SpriteFormat.encode([spr], 4);
  check('4bpp .spr is 128 bytes per sprite', packed.length === 128);
  check('4bpp .spr packs the left pixel high', packed[0] === 0xA5);
  const decoded = SpriteFormat.decode(packed, 4);
  check('4bpp .spr decode round-trips', decoded[0][0] === 0xA && decoded[0][1] === 0x5);

  // Sheet ops
  SpriteService.loadSheet([spr], 4);
  check('loadSheet sets the 4bpp transparency default',
    SpriteService.transparencyIndex() === 0x03 && SpriteService.maxIndex() === 15);
  SpriteService.setDepth(8);
  SpriteService.setPixel(0, 2, 0, 200);
  SpriteService.setDepth(4);
  check('8->4bpp depth switch masks indices to the low nibble',
    SpriteService.getSprite(0)[2] === (200 & 0x0F));
  SpriteService.flipH(0);
  check('flipH mirrors the pattern', SpriteService.getSprite(0)[15] === 0xA);
  SpriteService.loadSheet([new Uint8Array(256).fill(0xE3)], 8);
  check('.spr reject: bad length',
    SpriteFormat.parse(new ArrayBuffer(100)).success === false);
}

// ─── Next tilemap export ────────────────────────────────────────────────────

{
  const doc = {
    tiles: [
      // bright red ink on non-bright... bright applies cell-wide: attr =
      // BRIGHT(0x40) | paper 7<<3 | ink 2 — ink slot 10, paper slot 15
      { kind: 'ula-cell', bitmap: Uint8Array.from([0x80, 0, 0, 0, 0, 0, 0, 0]), attr: 0x40 | (7 << 3) | 2 }
    ],
    map: { width: 2, height: 1, cells: Int16Array.from([0, -1]) }
  };
  const bin = DevFormat.generateNextTilemap('bin', 'test', doc);
  check('next tilemap .bin header carries dims + tile count',
    bin[0] === 2 && bin[2] === 1 && bin[4] === 1);
  // First tile row: pixel 0 is ink (slot 10 = 0xA), pixels 1-7 paper (0xF)
  check('tile def packs ink/paper classic slots at 4bpp',
    bin[6] === 0xAF && bin[7] === 0xFF && bin[9] === 0xFF);
  check('map cells follow the defs; $FF = empty',
    bin[6 + 32] === 0 && bin[6 + 33] === 0xFF);

  const asm = new TextDecoder().decode(DevFormat.generateNextTilemap('asm', 'test', doc));
  check('next tilemap .asm has both labels',
    asm.includes('test_next_tiles:') && asm.includes('test_next_map:')
    && asm.includes('DEFW 2, 1'));
}

// ─── Classic gates in indexed modes ─────────────────────────────────────────

enter('layer2_256');
{
  let threw = false;
  try { SCRFormat.export(); } catch (e) { threw = true; }
  check('SCR export gates in indexed modes', threw);
  threw = false;
  try { MulticolorFormat.export('mlt'); } catch (e) { threw = true; }
  check('.mlt export gates in indexed modes (fixed16 rule)', threw);

  // NXIFormat.canExport() mirrors export()'s throw/no-throw. A bare mode
  // switch (not enter(), which reinitializes layers) — the GIF block right
  // after this one depends on the layer2_256 document still being here.
  check('NXI canExport true in an indexed mode', NXIFormat.canExport() === true);
  __setActiveScreenMode('standard_ula');
  check('NXI canExport false in a classic mode', NXIFormat.canExport() === false);
  __setActiveScreenMode('layer2_256');
}

// ─── GIF export follows the source mode's palette (no fixed16 gate) ─────────

{
  const layer = LayerManager.getCurrentLayer();
  layer.setPixelIndex(0, 0, 42);
  ColorManager.setNextRegister(42, 0x1FF); // white in RGB333
  const gif = GIFFormat.export();
  check('GIF export works in indexed modes', gif.length > 0 &&
    String.fromCharCode(...gif.slice(0, 6)) === 'GIF89a');
  // 256-entry window -> colorBits 8: LSD packed = 0x80|0x70|0x07 = 0xF7,
  // GCT = 768 bytes, LZW min code size 9 at the image descriptor
  check('indexed GIF writes a 256-entry colour table', gif[10] === 0xF7);
  const gct = gif.slice(13, 13 + 768);
  const rgb42 = NEXTRGB333.registerToRGB(0x1FF);
  check('GCT carries the live Next palette',
    gct[42 * 3] === rgb42[0] && gct[42 * 3 + 1] === rgb42[1] && gct[42 * 3 + 2] === rgb42[2]);
  ColorManager.setNextRegisters(null);
}

enter('ula_plus');
{
  ColorManager.setUlaplusRegister(0, 0xE0); // CLUT 0 ink slot 0 = bright red-ish
  const gif = GIFFormat.export();
  // 64 colours -> colorBits 6: packed = 0x80|0x70|0x05 = 0xF5, GCT 192 bytes
  check('ULAplus GIF writes a 64-entry colour table', gif[10] === 0xF5);
  const rgb0 = ULAPLUS.registerToRGB(0xE0);
  check('GCT carries the live ULAplus registers',
    gif[13] === rgb0[0] && gif[14] === rgb0[1] && gif[15] === rgb0[2]);
  ColorManager.setUlaplusRegisters(null);
}

enter('timex_hires');
{
  const gif = GIFFormat.export();
  // 2 colours -> colorBits 1: packed = 0x80|0x70|0x00 = 0xF0, GCT 6 bytes,
  // and the logical screen is the mode's 512×192
  check('Timex hi-res GIF writes a 2-entry colour table at 512×192',
    gif[10] === 0xF0 && (gif[6] | (gif[7] << 8)) === 512);
}

// Reset to boot default for any suite that runs after us
enter('standard_ula');
check('reset to standard_ula for following suites', ACTIVE_SCREEN_MODE.id === 'standard_ula');

summary('mode-formats-13');
