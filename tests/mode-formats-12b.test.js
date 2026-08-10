'use strict';
/**
 * Phase 12b screen formats:
 *  - Timex hi-colour SCREEN$ (12288): interleaved-attribute layout, mode
 *    switch on import, byte-identical round-trip; the same document's .mlt
 *    has an identical bitmap but linear attributes.
 *  - 12352 variant: + the 64 ULAplus registers (mode ula_plus_8x1).
 *  - Timex hi-res (12289 / .hrg): display-file column mapping, port byte
 *    scheme, round-trip, .hrg = two frames (import reads the first).
 *  - GigaScreen .img/.mg: two sub-screens <-> two tagged layers, mode switch
 *    + undo, .mg (MGH type 8) equals its .img twin, type-2 reject.
 *  - GigaScreen GIF: two frames at the flicker delay.
 *  - Bifrost .ctile: 64-byte tile layout, sheet round-trip, rejects.
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
loadModule('js/io/scr-format.js');
loadModule('js/io/multicolor-format.js');
loadModule('js/io/timex-format.js');
loadModule('js/io/gigascreen-format.js');
loadModule('js/io/ctile-format.js');
loadModule('js/io/gif-format.js');

ColorManager.initialize();

function lineOffset(y) {
  return ((y & 0xC0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2);
}

// ─── Timex hi-colour SCREEN$ (12288) ────────────────────────────────────────

__setActiveScreenMode('multicolor_8x1');
AttributeSystem.clearAll();
LayerManager.initialize();
{
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
}

const timexScr = SCRFormat.export();
check('8×1 .scr export is 12288 bytes', timexScr.length === 12288, `got ${timexScr.length}`);

const mltBytes = MulticolorFormat.export('mlt');
check('bitmap halves of .scr and .mlt are identical',
  Buffer.from(timexScr.subarray(0, 6144)).equals(Buffer.from(mltBytes.subarray(0, 6144))));
// .scr attrs are interleaved: line y's attr row sits at 6144 + lineOffset(y);
// .mlt keeps them linear at 6144 + y*32
{
  let allMatch = true;
  for (let y = 0; y < 192 && allMatch; y++) {
    for (let x = 0; x < 32; x++) {
      if (timexScr[6144 + lineOffset(y) + x] !== mltBytes[6144 + y * 32 + x]) {
        allMatch = false;
        break;
      }
    }
  }
  check('.scr attr block is the interleaved permutation of .mlt attrs', allMatch);
}

__setActiveScreenMode('standard_ula');
AttributeSystem.clearAll();
LayerManager.initialize();
{
  const res = SCRFormat.parse(timexScr.buffer.slice(0));
  check('12288 .scr parses', res.success === true, res.error);
  check('12288 .scr switched to multicolor_8x1', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');
  check('12288 .scr round-trip is byte-identical',
    Buffer.from(SCRFormat.export()).equals(Buffer.from(timexScr)));
  UndoRedo.undo();
  check('undo of 12288 import restores previous mode', ACTIVE_SCREEN_MODE.id === 'standard_ula');
}

// ─── 12352 variant (ULAplus 8×1) ────────────────────────────────────────────

{
  __setActiveScreenMode('ula_plus_8x1');
  AttributeSystem.clearAll();
  LayerManager.initialize();
  const regs = ULAPLUS.defaultRegisters();
  regs[0] = 0x55; regs[63] = 0xAA;
  ColorManager.setUlaplusRegisters(regs);
  ColorManager.applyScreenMode();
  const layer = LayerManager.getCurrentLayer();
  layer.setCell(0, 0, {
    ink: 5, paper: 2, bright: true, flash: false,
    pixels: Uint8Array.from([0xA5]), altered: true
  });

  const bytes = SCRFormat.export();
  check('ULAplus 8×1 .scr export is 12352 bytes', bytes.length === 12352, `got ${bytes.length}`);
  check('12352 carries the registers', bytes[12288] === 0x55 && bytes[12351] === 0xAA);

  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  ColorManager.setUlaplusRegisters(null);
  LayerManager.initialize();
  const res = SCRFormat.parse(bytes.buffer.slice(0));
  check('12352 .scr parses', res.success === true, res.error);
  check('12352 switched to ula_plus_8x1', ACTIVE_SCREEN_MODE.id === 'ula_plus_8x1');
  check('12352 restored the registers',
    ColorManager.getUlaplusRegisters()[0] === 0x55
    && ColorManager.getUlaplusRegisters()[63] === 0xAA);
  check('12352 round-trip is byte-identical',
    Buffer.from(SCRFormat.export()).equals(Buffer.from(bytes)));
  ColorManager.setUlaplusRegisters(null);
}

// ─── Timex hi-res (12289 / .hrg) ────────────────────────────────────────────

{
  __setActiveScreenMode('timex_hires');
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  ColorManager.setTimexHiresInk(3); // magenta on green
  const layer = LayerManager.getCurrentLayer();
  // Distinct bytes in an even and an odd byte-column of pixel line 0
  layer.setCell(0, 0, { pixels: Uint8Array.from([0xDE, 0, 0, 0, 0, 0, 0, 0]), altered: true });
  layer.setCell(1, 0, { pixels: Uint8Array.from([0xAD, 0, 0, 0, 0, 0, 0, 0]), altered: true });

  const scr = SCRFormat.export();
  check('hi-res .scr export is 12289 bytes', scr.length === 12289, `got ${scr.length}`);
  check('port byte carries mode bits + ink', scr[12288] === (0x06 | (3 << 3)),
    `got 0x${scr[12288].toString(16)}`);
  // Byte column 0 (even) -> display file 1 offset 0; column 1 (odd) ->
  // display file 2 (offset 6144), inner column 0
  check('even byte column lands in display file 1', scr[0] === 0xDE);
  check('odd byte column lands in display file 2', scr[6144] === 0xAD);

  const hrg = TimexFormat.exportHrg();
  check('.hrg is two identical hi-res frames', hrg.length === 24578
    && Buffer.from(hrg.subarray(0, 12289)).equals(Buffer.from(scr))
    && Buffer.from(hrg.subarray(12289)).equals(Buffer.from(scr)));

  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  ColorManager.setTimexHiresInk(0);
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  const res = SCRFormat.parse(scr.buffer.slice(0));
  check('12289 .scr parses', res.success === true, res.error);
  check('12289 switched to timex_hires', ACTIVE_SCREEN_MODE.id === 'timex_hires');
  check('12289 restored the colour scheme', ColorManager.getTimexHiresInk() === 3);
  check('12289 round-trip is byte-identical',
    Buffer.from(SCRFormat.export()).equals(Buffer.from(scr)));

  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  LayerManager.initialize();
  const hres = TimexFormat.parseHrg(hrg.buffer.slice(0));
  check('.hrg parses (first frame)', hres.success === true, hres.error);
  check('.hrg import matches the 12289 document',
    Buffer.from(SCRFormat.export()).equals(Buffer.from(scr)));

  check('.hrg rejects wrong sizes',
    TimexFormat.parseHrg(new ArrayBuffer(24577)).success === false);
  ColorManager.setTimexHiresInk(0);
}

// ─── Export gates ───────────────────────────────────────────────────────────

{
  __setActiveScreenMode('multicolor_8x2');
  AttributeSystem.clearAll();
  let threw = false;
  try { SCRFormat.export(); } catch (e) { threw = true; }
  check('8×2 .scr export still gates', threw);

  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  threw = false;
  try { TimexFormat.exportHires(); } catch (e) { threw = true; }
  check('hi-res export gates outside timex_hires', threw);

  threw = false;
  try { GigascreenFormat.export(); } catch (e) { threw = true; }
  check('.img export gates outside gigascreen', threw);

  threw = false;
  try { CtileFormat.export(); } catch (e) { threw = true; }
  check('.ctile export gates outside 8×1', threw);
}

// ─── GigaScreen .img / .mg / GIF ────────────────────────────────────────────

{
  __setActiveScreenMode('gigascreen');
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  const la = LayerManager.getCurrentLayer();
  la.setCell(0, 0, {
    ink: 2, paper: 7, bright: false, flash: false,
    pixels: Uint8Array.from([0x80, 0, 0, 0, 0, 0, 0, 0]), altered: true
  });
  const lb = LayerManager.addLayer('B side', false);
  lb.gigaScreen = 1;
  lb.setCell(0, 0, {
    ink: 1, paper: 7, bright: false, flash: false,
    pixels: Uint8Array.from([0x01, 0, 0, 0, 0, 0, 0, 0]), altered: true
  });

  const img = GigascreenFormat.export();
  check('.img export is 13824 bytes', img.length === 13824, `got ${img.length}`);
  check('.img halves differ (A vs B)', img[0] === 0x80 && img[6912] === 0x01);
  check('.img attr halves carry each screen', img[6144] === 0x3A && img[6912 + 6144] === 0x39,
    `got 0x${img[6144].toString(16)}, 0x${img[6912 + 6144].toString(16)}`);

  // GIF in gigascreen mode: two frames at the flicker delay
  const gif = GIFFormat.export();
  check('giga GIF has the GIF89a signature',
    String.fromCharCode(...gif.subarray(0, 6)) === 'GIF89a');
  let gceCount = 0;
  const delays = [];
  for (let i = 0; i < gif.length - 1; i++) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xF9) {
      gceCount++;
      delays.push(gif[i + 4] | (gif[i + 5] << 8));
    }
  }
  check('giga GIF is a two-frame loop', gceCount === 2, `got ${gceCount}`);
  check('giga GIF frames use the flicker delay', delays.every(d => d === 2),
    `got ${delays.join(',')}`);

  // Round-trip through import
  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  LayerManager.initialize();
  const res = GigascreenFormat.parse('img', img.buffer.slice(0));
  check('.img parses', res.success === true, res.error);
  check('.img switched to gigascreen', ACTIVE_SCREEN_MODE.id === 'gigascreen');
  check('.img import created a tagged Screen B layer',
    LayerManager.layers.some(l => l.gigaScreen === 1));
  check('.img round-trip is byte-identical',
    Buffer.from(GigascreenFormat.export()).equals(Buffer.from(img)));
  UndoRedo.undo();
  check('undo of .img import restores previous mode', ACTIVE_SCREEN_MODE.id === 'standard_ula');
  UndoRedo.redo();

  // Synthetic .mg (MGH type 8) from the same two screens
  const mg = new Uint8Array(256 + 2 * 6912);
  mg[0] = 0x4D; mg[1] = 0x47; mg[2] = 0x48; mg[3] = 1; mg[4] = 8;
  mg.set(img.subarray(0, 6144), 256);          // bitmap A
  mg.set(img.subarray(6912, 6912 + 6144), 256 + 6144); // bitmap B
  mg.set(img.subarray(6144, 6912), 256 + 12288);       // attrs A
  mg.set(img.subarray(6912 + 6144, 13824), 256 + 12288 + 768); // attrs B
  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  LayerManager.initialize();
  const mgres = GigascreenFormat.parse('mg', mg.buffer.slice(0));
  check('.mg (type 8) parses', mgres.success === true, mgres.error);
  check('.mg import equals its .img twin',
    Buffer.from(GigascreenFormat.export()).equals(Buffer.from(img)));

  const mgBad = Uint8Array.from(mg.subarray(0, 256 + 2 * 6912));
  mgBad[4] = 2;
  check('.mg with fine attrs is rejected',
    GigascreenFormat.parse('mg', mgBad.buffer.slice(0)).success === false);
  check('.mg with a wrong signature is rejected',
    GigascreenFormat.parse('mg', new ArrayBuffer(300)).success === false);
  check('.img rejects wrong sizes',
    GigascreenFormat.parse('img', new ArrayBuffer(13823)).success === false);
}

// ─── Bifrost .ctile ─────────────────────────────────────────────────────────

{
  // A recognisable 2-tile file: tile 0 = diagonal red-on-white, tile 1 =
  // inverse video with per-row colours
  const file = new Uint8Array(2 * 64);
  for (let r = 0; r < 16; r++) {
    file[r * 2] = 1 << (r % 8);          // tile 0 left column
    file[r * 2 + 1] = 0x80 >> (r % 8);   // tile 0 right column
    file[32 + r * 2] = 0x3A;             // red on white
    file[32 + r * 2 + 1] = 0x17;         // white on black + odd bits
    file[64 + r * 2] = 0xFF;
    file[64 + r * 2 + 1] = 0x00;
    file[96 + r * 2] = (r % 8) | ((7 - (r % 8)) << 3) | (r & 1 ? 0x40 : 0);
    file[96 + r * 2 + 1] = 0x38;
  }

  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  LayerManager.initialize();
  const res = CtileFormat.parse(file.buffer.slice(0));
  check('.ctile parses', res.success === true, res.error);
  check('.ctile switched to multicolor_8x1', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');

  const layer = LayerManager.getCurrentLayer();
  check('.ctile tile 0 pixels landed', layer.getCell(0, 0).pixels[0] === 1
    && layer.getCell(1, 0).pixels[0] === 0x80);
  check('.ctile tile 0 attrs landed', layer.getCell(0, 0).ink === 2
    && layer.getCell(0, 0).paper === 7);
  check('.ctile tile 1 landed to the right', layer.getCell(2, 0).pixels[0] === 0xFF);

  // Export the imported region back via a selection stub — must round-trip
  global.SelectionService = {
    getSelection: () => ({ x: 0, y: 0, width: 32, height: 16, mask: null })
  };
  const out = CtileFormat.export();
  check('.ctile selection export round-trips', Buffer.from(out).equals(Buffer.from(file)));

  let threw = false;
  global.SelectionService = {
    getSelection: () => ({ x: 4, y: 0, width: 32, height: 16, mask: null })
  };
  try { CtileFormat.export(); } catch (e) { threw = true; }
  check('.ctile misaligned selection gates', threw);
  delete global.SelectionService;

  // Full-canvas export = 16×12 tiles
  const full = CtileFormat.export();
  check('.ctile full-canvas export is 192 tiles', full.length === 192 * 64);

  check('.ctile rejects non-multiple-of-64 sizes',
    CtileFormat.parse(new ArrayBuffer(63)).success === false);
  check('.ctile rejects empty files',
    CtileFormat.parse(new ArrayBuffer(0)).success === false);
  check('.ctile rejects oversize sheets',
    CtileFormat.parse(new ArrayBuffer(193 * 64)).success === false);
}

// Reset for any later suites in the same process
__setActiveScreenMode('standard_ula');

summary();
