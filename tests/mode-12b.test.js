'use strict';
/**
 * Phase 12b seam tests — the additions on the live 12a mode seam:
 *  1. Width conversion rules (Timex hi-res 512×192): 256->512 doubles every
 *     pixel horizontally; 512->256 OR-merges pixel pairs; double-then-halve
 *     is the identity on pixels; two-step (height first, then width) path.
 *  2. timexMono palette model — ColorManager derives the 2-entry
 *     [paper, ink] palette from the hi-res scheme; attrToIndices ignores
 *     cell attributes; the scheme is document state.
 *  3. Lossy matrix additions — width shrink, colour->mono, GigaScreen exit
 *     with screen-B content.
 *  4. GigaScreen compositing — layers partition by gigaScreen tag; the
 *     blend view averages sub-screen colours per channel (RECOIL blend);
 *     single-screen views show one sub-screen only; tags survive the
 *     undo snapshot round-trip; leaving GigaScreen clears the tags.
 *  5. Leaving Timex hi-res stamps the scheme's ink/paper (BRIGHT) onto
 *     altered cells so the switched document keeps the hi-res look.
 * Every block restores standard_ula before the next one (12a convention).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

// Recording CanvasSystem stub — remembers the last colour written per pixel
const painted = new Map(); // "x,y" -> [r,g,b]
global.CanvasSystem = withBlit({
  setPixel(x, y, r, g, b) { painted.set(`${x},${y}`, [r, g, b]); },
  markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');

ColorManager.initialize();

const STD = SCREEN_MODES.STANDARD_ULA;
const HIRES = SCREEN_MODES.TIMEX_HIRES;
const GIGA = SCREEN_MODES.GIGASCREEN;
const MC1 = SCREEN_MODES.MULTICOLOR_8x1;

// ─── 1. Width conversion rules ──────────────────────────────────────────────

// A recognisable 8×8 source cell: diagonal + top row
function makeGrid(mode, fill) {
  const cols = mode.width / mode.attrCellW;
  const rows = mode.height / mode.attrCellH;
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        ink: 0, paper: 7, bright: false, flash: false,
        pixels: new Uint8Array(mode.attrCellH), altered: false
      });
    }
    grid.push(row);
  }
  if (fill) fill(grid);
  return grid;
}

{
  const src = makeGrid(STD, g => {
    g[0][0].pixels.set([0xFF, 0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02]);
    g[0][0].altered = true;
    g[0][0].ink = 2;
  });
  const wide = ScreenModeService.convertAttributeData(src, STD, HIRES);
  check('256->512 grid is 64 cells wide', wide[0].length === 64);
  check('256->512 doubles a full row byte into two 0xFF cells',
    wide[0][0].pixels[0] === 0xFF && wide[0][1].pixels[0] === 0xFF);
  // 0x80 (leftmost pixel) -> left cell 0xC0, right cell 0x00
  check('256->512 doubles a single leftmost pixel',
    wide[0][0].pixels[1] === 0xC0 && wide[0][1].pixels[1] === 0x00);
  // 0x10 -> bit 4 doubles to bits 9,8 of the 16-wide row -> left cell 0x03
  check('256->512 keeps doubled bits in the correct half',
    wide[0][0].pixels[4] === 0x03 && wide[0][1].pixels[4] === 0x00);
  check('256->512 copies attrs to both halves',
    wide[0][0].ink === 2 && wide[0][1].ink === 2 && wide[0][0].altered && wide[0][1].altered);

  const back = ScreenModeService.convertAttributeData(wide, HIRES, STD);
  check('512->256 restores the doubled pixels exactly',
    Array.from(back[0][0].pixels).join(',') ===
    Array.from(src[0][0].pixels).join(','));
  check('512->256 keeps the altered flag', back[0][0].altered === true);
}

{
  // OR-merge: left cell has odd pixels set, right cell even — merged pairs survive
  const wide = makeGrid(HIRES, g => {
    g[0][0].pixels[0] = 0xAA; // 10101010
    g[0][1].pixels[0] = 0x55; // 01010101
    g[0][0].altered = true;
  });
  const narrow = ScreenModeService.convertAttributeData(wide, HIRES, STD);
  // 0xAA halves (OR pairs) to 1111 -> high nibble F; 0x55 halves to 1111 -> low nibble F
  check('512->256 OR-merges pixel pairs', narrow[0][0].pixels[0] === 0xFF,
    `got ${narrow[0][0].pixels[0]}`);
}

{
  // Two-step: 8×1 cells at 256 -> hi-res (8×8 at 512). Height coarsens first.
  const src = makeGrid(MC1, g => {
    for (let y = 0; y < 8; y++) {
      g[y][0].pixels[0] = 0x80; // leftmost pixel set on lines 0–7
      g[y][0].altered = true;
    }
  });
  const wide = ScreenModeService.convertAttributeData(src, MC1, HIRES);
  check('8×1/256 -> hi-res converts height then width',
    wide.length === 24 && wide[0].length === 64 &&
    wide[0][0].pixels.length === 8 && wide[0][0].pixels[0] === 0xC0 &&
    wide[0][0].pixels[7] === 0xC0);
}

// ─── 2. timexMono palette model ─────────────────────────────────────────────

{
  __setActiveScreenMode('timex_hires');
  ColorManager.applyScreenMode();
  check('timexMono palette has 2 entries', ColorManager.getPalette().length === 2);
  // Default scheme: ink 0 (black) on paper 7 (white), both bright
  check('timexMono default is black ink on white paper',
    ColorManager.getPalette()[1] === ZX_PALETTE[8] &&
    ColorManager.getPalette()[0] === ZX_PALETTE[15]);
  const t = ColorManager.attrToIndices({ ink: 5, paper: 2, bright: false, flash: true });
  check('timexMono attrToIndices ignores cell attrs',
    t.ink === 1 && t.paper === 0 && t.flashing === false);
  ColorManager.setTimexHiresInk(4); // green ink, magenta paper
  check('scheme change re-derives the palette',
    ColorManager.getPalette()[1] === ZX_PALETTE[12] &&
    ColorManager.getPalette()[0] === ZX_PALETTE[11]);
  ColorManager.setTimexHiresInk(0);
  __setActiveScreenMode('standard_ula');
  ColorManager.applyScreenMode();
}

// ─── 3. Lossy matrix additions ──────────────────────────────────────────────

check('256->512 (colour -> mono) is lossy',
  ScreenModeService.isConversionLossy('standard_ula', 'timex_hires') === true);
check('512->256 (width shrink) is lossy',
  ScreenModeService.isConversionLossy('timex_hires', 'standard_ula') === true);
check('standard -> gigascreen is lossless',
  ScreenModeService.isConversionLossy('standard_ula', 'gigascreen') === false);
check('ULAplus -> ULAplus 8×1 (refine) is lossless',
  ScreenModeService.isConversionLossy('ula_plus', 'ula_plus_8x1') === false);
check('ULAplus 8×1 -> ULAplus (coarsen) is lossy',
  ScreenModeService.isConversionLossy('ula_plus_8x1', 'ula_plus') === true);

// ─── 4. GigaScreen compositing + tags ───────────────────────────────────────

{
  LayerManager.initialize();
  ScreenModeService.switchMode('gigascreen');
  check('switched to gigascreen', ACTIVE_SCREEN_MODE === GIGA);

  // Layer 1 (screen A): ink pixel at (0,0), red ink.
  // Layer 2 (screen B): ink pixel at (0,0) too, blue ink.
  const la = LayerManager.getCurrentLayer();
  la.setCell(0, 0, {
    ink: 2, paper: 7, bright: false, flash: false,
    pixels: (() => { const p = new Uint8Array(8); p[0] = 0x80; return p; })()
  });
  LayerManager.addLayer('B side');
  const lb = LayerManager.layers[LayerManager.layers.length - 1];
  lb.gigaScreen = 1;
  lb.setCell(0, 0, {
    ink: 1, paper: 7, bright: false, flash: false,
    pixels: (() => { const p = new Uint8Array(8); p[0] = 0x80; return p; })()
  });

  painted.clear();
  LayerManager.composeCellToCanvas(0, 0);
  let px = painted.get('0,0');
  // red (215,0,0) blended with blue (0,0,215) -> (107,0,107)
  check('blend view averages the sub-screens per channel',
    px[0] === 107 && px[1] === 0 && px[2] === 107, `got ${px}`);
  // paper pixel: white/white blends to white
  px = painted.get('1,0');
  check('blend of identical paper stays put', px[0] === 215 && px[1] === 215 && px[2] === 215);

  LayerManager.setGigaView('a');
  painted.clear();
  LayerManager.composeCellToCanvas(0, 0);
  px = painted.get('0,0');
  check('view A shows only screen A', px[0] === 215 && px[1] === 0 && px[2] === 0);

  LayerManager.setGigaView('b');
  painted.clear();
  LayerManager.composeCellToCanvas(0, 0);
  px = painted.get('0,0');
  check('view B shows only screen B', px[0] === 0 && px[1] === 0 && px[2] === 215);
  LayerManager.setGigaView('blend');

  // flattenVisible per sub-screen
  const flatA = LayerManager.flattenVisible({ gigaScreen: 0 });
  const flatB = LayerManager.flattenVisible({ gigaScreen: 1 });
  check('flattenVisible filters by sub-screen',
    flatA.getCell(0, 0).ink === 2 && flatB.getCell(0, 0).ink === 1);

  // Tag survives an undo snapshot round-trip
  UndoRedo.beginAction('probe');
  la.setCell(1, 1, { ink: 3 });
  UndoRedo.endAction();
  lb.gigaScreen = 0; // mutate after capture…
  UndoRedo.undo();   // …undo restores the captured tag
  const restoredB = LayerManager.layers.find(l => l.name === 'B side');
  check('gigaScreen tag survives undo restore', restoredB && restoredB.gigaScreen === 1);

  check('leaving gigascreen with B content is lossy',
    ScreenModeService.isConversionLossy('gigascreen', 'standard_ula') === true);
  ScreenModeService.switchMode('standard_ula');
  check('leaving gigascreen clears the tags',
    LayerManager.layers.every(l => (l.gigaScreen || 0) === 0));
  check('back to standard_ula', ACTIVE_SCREEN_MODE === STD);
}

// ─── 5. Leaving hi-res stamps the scheme ────────────────────────────────────

{
  LayerManager.initialize();
  ScreenModeService.switchMode('timex_hires');
  ColorManager.setTimexHiresInk(2); // red on cyan
  const layer = LayerManager.getCurrentLayer();
  layer.setCell(0, 0, {
    ink: 5, paper: 3, bright: false, flash: true, // garbage attrs — ignored in hi-res
    pixels: (() => { const p = new Uint8Array(8); p[0] = 0xFF; return p; })()
  });
  ScreenModeService.switchMode('standard_ula');
  const cell = LayerManager.getCurrentLayer().getCell(0, 0);
  check('exit stamp: altered cell gets the scheme attrs',
    cell.ink === 2 && cell.paper === 5 && cell.bright === true && cell.flash === false);
  // 8 hi-res pixels (one cell) merge into 4 pixels of the 256-wide cell
  check('exit stamp: pixels halved back to 256 wide',
    cell.pixels[0] === 0xF0 && cell.pixels.length === 8);
  const bgCell = LayerManager.getBackgroundLayer().getCell(5, 5);
  check('exit stamp: background carries the scheme too',
    bgCell.ink === 2 && bgCell.paper === 5 && bgCell.bright === true);
  ColorManager.setTimexHiresInk(0);
}

// Leave the world as we found it for the next suite
if (ACTIVE_SCREEN_MODE !== SCREEN_MODES.STANDARD_ULA) {
  ScreenModeService.applyModeRaw('standard_ula');
}

summary();
