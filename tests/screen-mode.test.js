'use strict';
/**
 * Screen-mode seam tests (Phase 12a):
 *  1. SCREEN_MODES registry invariants — every descriptor internally
 *     consistent, all magic file sizes derivable from geometry.
 *  2. The live seam — __setActiveScreenMode redirects ZX_SPECTRUM and
 *     ZX_COORDS immediately.
 *  3. ULAPLUS register math — G3R3B2 codec matches RECOIL's reference
 *     integer scaling; default registers reproduce the standard palette
 *     mapping (CLUT = flash*2 + bright, ink half + paper half).
 *  4. Pure conversion rules — refine = lossless split, coarsen = pixel-
 *     preserving with most-frequent-attribute vote (ZX-Paintbrush rule).
 *  5. Full runtime switch through the real core stack: content survives,
 *     one Undo restores the previous mode AND content, redo re-applies.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

// CanvasSystem stub (same seam as core-draw.test.js) — no ColorManager on
// purpose: the compositor's headless fixed-palette fallback must hold.
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');

// ─── 1. Registry invariants ─────────────────────────────────────────────────

const modeKeys = Object.keys(SCREEN_MODES);
check('registry has the 8 classic (12a/12b) + 6 Next (13) modes', modeKeys.length === 14,
  `got ${modeKeys.join(',')}`);

for (const key of modeKeys) {
  const m = SCREEN_MODES[key];
  const cols = m.width / m.attrCellW;
  const rows = m.height / m.attrCellH;
  check(`${key}: integral cell grid`, Number.isInteger(cols) && Number.isInteger(rows));
  check(`${key}: attrSize = cols*rows`, m.attrSize === cols * rows,
    `attrSize ${m.attrSize} != ${cols * rows}`);
  check(`${key}: bitmapSize = w*h*depth/8`,
    m.bitmapSize === m.width * m.height * m.pixelDepth / 8);
  // Native container composition per mode family: single screens are
  // bitmap+attrs+palette; TIMEX_HIRES has no attr block, just the port
  // byte; GIGASCREEN's .img holds two full sub-screens back to back;
  // indexed (Phase 13) containers are bitmap + optional 512-byte palette
  // (no attribute block — the 8×8 grid is storage-only); ULANEXT is a
  // plain 6912 SCR (its palette travels separately via .npl/.pal).
  const expectedFile = m.paletteModel === 'timexMono'
    ? m.bitmapSize + 1
    : m.pixelDepth > 1
      ? m.bitmapSize + (m.paletteBytes || 0)
      : (m.screens || 1) * (m.bitmapSize + m.attrSize)
        + (m.id === 'ulanext' ? 0 : (m.paletteBytes || 0));
  check(`${key}: fileSize matches its container layout`, m.fileSize === expectedFile,
    `fileSize ${m.fileSize} != ${expectedFile}`);
  check(`${key}: id resolvable`, getScreenModeById(m.id) === m);
  check(`${key}: has i18n key`, typeof m.i18n === 'string' && m.i18n.startsWith('mode.'));
}
check('MULTICOLOR_8x1 native size is 12288', SCREEN_MODES.MULTICOLOR_8x1.fileSize === 12288);
check('MULTICOLOR_8x2 native size is 9216', SCREEN_MODES.MULTICOLOR_8x2.fileSize === 9216);
check('MULTICOLOR_8x4 native size is 7680', SCREEN_MODES.MULTICOLOR_8x4.fileSize === 7680);
check('ULA_PLUS native size is 6976', SCREEN_MODES.ULA_PLUS.fileSize === 6976);
check('ULA_PLUS_8x1 native size is 12352', SCREEN_MODES.ULA_PLUS_8x1.fileSize === 12352);
check('TIMEX_HIRES native size is 12289', SCREEN_MODES.TIMEX_HIRES.fileSize === 12289);
check('GIGASCREEN native size is 13824', SCREEN_MODES.GIGASCREEN.fileSize === 13824);

// ─── 2. The live seam ───────────────────────────────────────────────────────

check('boot default is STANDARD_ULA', ACTIVE_SCREEN_MODE === SCREEN_MODES.STANDARD_ULA);
check('ZX_SPECTRUM view: 8x8 boot geometry',
  ZX_SPECTRUM.GRID_ROWS === 24 && ZX_SPECTRUM.CELL_HEIGHT === 8);

__setActiveScreenMode('multicolor_8x1');
check('setter redirects ACTIVE_SCREEN_MODE', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');
check('ZX_SPECTRUM view is live', ZX_SPECTRUM.GRID_ROWS === 192
  && ZX_SPECTRUM.CELL_HEIGHT === 1 && ZX_SPECTRUM.CELL_WIDTH === 8
  && ZX_SPECTRUM.ATTR_SIZE === 6144 && ZX_SPECTRUM.SCR_FILE_SIZE === 12288);
check('ZX_COORDS is live', ZX_COORDS.pixelToCell(12, 13).y === 13
  && ZX_COORDS.cellToPixel(1, 13).y === 13
  && ZX_COORDS.cellIndex(1, 2) === 2 * 32 + 1);

__setActiveScreenMode('standard_ula');
check('setter switches back', ZX_SPECTRUM.GRID_ROWS === 24
  && ZX_COORDS.pixelToCell(12, 13).y === 1);

let threw = false;
try { __setActiveScreenMode('nope'); } catch (e) { threw = true; }
check('setter rejects unknown ids', threw && ACTIVE_SCREEN_MODE.id === 'standard_ula');

// ─── 3. ULAPLUS register math ───────────────────────────────────────────────

// RECOIL reference: R=(c&28)*73>>3, G=(c>>5)*73>>1, B=(c&3)*85
check('registerToRGB(0xFF) = white', ULAPLUS.registerToRGB(0xFF).join(',') === '255,255,255');
check('registerToRGB(0x00) = black', ULAPLUS.registerToRGB(0x00).join(',') === '0,0,0');
check('registerToRGB(0x03) = full blue', ULAPLUS.registerToRGB(0x03).join(',') === '0,0,255');
check('registerToRGB(0x1C) = full red', ULAPLUS.registerToRGB(0x1C).join(',') === '255,0,0');
check('registerToRGB(0xE0) = full green', ULAPLUS.registerToRGB(0xE0).join(',') === '0,255,0');
// mid-level: G=4 -> (4*73)>>1 = 146
check('registerToRGB 3-bit mid level matches RECOIL', ULAPLUS.registerToRGB(0x80)[1] === 146);

check('rgbToRegister round-trips full values',
  ULAPLUS.rgbToRegister(255, 255, 255) === 0xFF
  && ULAPLUS.rgbToRegister(0, 0, 0) === 0x00
  && ULAPLUS.rgbToRegister(255, 0, 0) === 0x1C);
check('registerToHex formats', ULAPLUS.registerToHex(0x03) === '#0000ff');

const defRegs = ULAPLUS.defaultRegisters();
check('defaultRegisters: 64 entries', defRegs.length === 64);
check('default: CLUT layout = flash*2+bright (CLUT1 = bright white 0xFF)',
  defRegs[16 + 7] === 0xFF && defRegs[16 + 8 + 7] === 0xFF);
check('default: ink half mirrors paper half', defRegs[3] === defRegs[8 + 3]
  && defRegs[48 + 5] === defRegs[48 + 8 + 5]);
check('default: CLUT2 (flash, non-bright) equals CLUT0', defRegs[32 + 6] === defRegs[6]);
check('default: non-bright distinct from bright', defRegs[1] !== defRegs[16 + 1]);
check('default: black is black in every CLUT',
  defRegs[0] === 0 && defRegs[16] === 0 && defRegs[32] === 0 && defRegs[48] === 0);

// ─── 4. Pure conversion rules ───────────────────────────────────────────────

const STD = SCREEN_MODES.STANDARD_ULA;
const MC1 = SCREEN_MODES.MULTICOLOR_8x1;
const MC4 = SCREEN_MODES.MULTICOLOR_8x4;

function makeGrid(mode, fill) {
  const rows = mode.height / mode.attrCellH;
  const cols = mode.width / mode.attrCellW;
  const g = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) row.push(fill(x, y, mode));
    g.push(row);
  }
  return g;
}
const cell = (over = {}) => Object.assign({
  ink: 0, paper: 7, bright: false, flash: false,
  pixels: new Uint8Array(8), altered: false
}, over);

// Refine 8×8 -> 8×1: attributes replicate, pixel rows distribute
const src88 = makeGrid(STD, (x, y) => cell({
  ink: (x + y) % 8, paper: (x * 3 + y) % 8, bright: (x & 1) === 0,
  pixels: Uint8Array.from({ length: 8 }, (_, r) => (x + y * 3 + r * 17) & 0xFF),
  altered: true
}));
const fine = ScreenModeService.convertAttributeData(src88, STD, MC1);
check('refine: row count 192', fine.length === 192);
check('refine: pixels are 1 row each', fine[0][0].pixels.length === 1);
check('refine: attrs replicated down the cell',
  fine[10][5].ink === src88[1][5].ink && fine[15][5].paper === src88[1][5].paper);
check('refine: pixel rows distributed',
  fine[10][5].pixels[0] === src88[1][5].pixels[2]
  && fine[15][5].pixels[0] === src88[1][5].pixels[7]);

// Round-trip refine->coarsen with uniform attrs is the identity
const back = ScreenModeService.convertAttributeData(fine, MC1, STD);
let identical = true;
for (let y = 0; y < 24 && identical; y++) {
  for (let x = 0; x < 32 && identical; x++) {
    const a = src88[y][x], b = back[y][x];
    if (a.ink !== b.ink || a.paper !== b.paper || a.bright !== b.bright
      || a.flash !== b.flash || a.altered !== b.altered
      || Buffer.from(a.pixels).compare(Buffer.from(b.pixels)) !== 0) identical = false;
  }
}
check('coarsen(refine(x)) === x for uniform cells', identical);

// Coarsen with mixed attrs: most frequent wins, ties -> first occurrence
const mixed = makeGrid(MC1, (x, y) => {
  if (x === 0 && y < 8) {
    // rows 0-7 of cell (0,0): ink 3 five times, ink 5 three times
    return cell({ ink: y < 5 ? 3 : 5, pixels: new Uint8Array(1), altered: true });
  }
  if (x === 1 && y < 8) {
    // tie 4:4 — first occurrence (ink 2, from row 0) must win
    return cell({ ink: y < 4 ? 2 : 6, pixels: new Uint8Array(1), altered: true });
  }
  if (x === 2 && y < 8) {
    // only rows 6-7 altered (ink 4); unaltered majority must not vote
    return cell({ ink: y >= 6 ? 4 : 1, pixels: new Uint8Array(1), altered: y >= 6 });
  }
  return cell({ pixels: new Uint8Array(1) });
});
const merged = ScreenModeService.convertAttributeData(mixed, MC1, STD);
check('coarsen: most frequent attr wins', merged[0][0].ink === 3);
check('coarsen: tie goes to first occurrence', merged[0][1].ink === 2);
check('coarsen: unaltered cells do not vote', merged[0][2].ink === 4);
check('coarsen: any altered -> altered', merged[0][2].altered === true);
check('coarsen: fully unaltered group stays unaltered', merged[0][3].altered === false);

// Same-height conversion is a deep copy
const copy = ScreenModeService.convertAttributeData(src88, STD, SCREEN_MODES.ULA_PLUS);
copy[0][0].ink = 6;
copy[0][0].pixels[0] = 0xAA;
check('same-geometry convert deep-copies', src88[0][0].ink !== 6
  && src88[0][0].pixels[0] !== 0xAA);

// Lossiness rules
check('refine is not lossy', !ScreenModeService.isConversionLossy('standard_ula', 'multicolor_8x1'));
check('coarsen is lossy', ScreenModeService.isConversionLossy('multicolor_8x1', 'standard_ula'));
check('8x1->8x4 (coarser) is lossy', ScreenModeService.isConversionLossy('multicolor_8x1', 'multicolor_8x4'));
check('standard->ULAplus is not lossy', !ScreenModeService.isConversionLossy('standard_ula', 'ula_plus'));

// ─── 5. Full runtime switch through the real stack ──────────────────────────

let modeEvents = [];
EventBus.on(EVENTS.SCREEN_MODE_CHANGED, (d) => modeEvents.push(d));

LayerManager.initialize();
const layer = LayerManager.getCurrentLayer();

// Draw two 8×1-line colours inside one 8×8 block — legal only in 8×1
PixelDrawRoutine.draw(10, 10, { ink: 2, paper: 6, bright: false, flash: false }, DRAW_MODE.NORMAL);
check('standard: cell carries the drawn attr', layer.getCell(1, 1).ink === 2);

check('switchMode to 8×1 returns true', ScreenModeService.switchMode('multicolor_8x1'));
check('SCREEN_MODE_CHANGED emitted with prev/next',
  modeEvents.length === 1 && modeEvents[0].mode === 'multicolor_8x1'
  && modeEvents[0].previous === 'standard_ula');
check('switch: geometry live', ZX_SPECTRUM.GRID_ROWS === 192);
check('switch: layer grid converted', LayerManager.getCurrentLayer().attributeData.length === 192
  && LayerManager.getCurrentLayer().getCell(1, 10).pixels.length === 1);
check('switch: pixel content preserved', LayerManager.getCurrentLayer().getPixelState(10, 10) === true);
check('switch: attrs preserved on the drawn line', LayerManager.getCurrentLayer().getCell(1, 10).ink === 2);

// Two different inks on two pixel lines of the same former 8×8 cell
PixelDrawRoutine.draw(10, 11, { ink: 5, paper: 0, bright: false, flash: false }, DRAW_MODE.NORMAL);
check('8×1: neighbouring line holds a different ink',
  LayerManager.getCurrentLayer().getCell(1, 11).ink === 5
  && LayerManager.getCurrentLayer().getCell(1, 10).ink === 2);

// Undo across the mode switch: ONE undo per action
UndoRedo.undo(); // undo the 8×1 draw
UndoRedo.undo(); // undo the mode switch itself
check('undo restores the previous mode', ACTIVE_SCREEN_MODE.id === 'standard_ula');
check('undo restores previous-geometry content',
  LayerManager.getCurrentLayer().getCell(1, 1).pixels.length === 8
  && LayerManager.getCurrentLayer().getCell(1, 1).ink === 2
  && LayerManager.getCurrentLayer().getPixelState(10, 10) === true);

UndoRedo.redo();
check('redo re-applies the mode switch', ACTIVE_SCREEN_MODE.id === 'multicolor_8x1'
  && LayerManager.getCurrentLayer().getCell(1, 10).pixels.length === 1);

// switching to the same mode is a no-op
modeEvents = [];
check('same-mode switch is a no-op', ScreenModeService.switchMode('multicolor_8x1') === false
  && modeEvents.length === 0);

// Reset for any later suites in the same process
__setActiveScreenMode('standard_ula');

summary();
