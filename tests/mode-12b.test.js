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
 *  4. GigaScreen — every cell holds both screens (2026-09-23). Entering
 *     leaves the picture unchanged; the Average display averages the two
 *     planes per channel (RECOIL blend) and A/B/Flicker show one plane; the
 *     draw gate paints each of the four slots onto the right bits of both
 *     planes; screen B survives undo; leaving is lossy only when screen B
 *     differs; a document from the old per-layer tag model converts.
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

// ─── 4. GigaScreen: one surface, two planes per cell ────────────────────────

const onePixel = () => { const p = new Uint8Array(8); p[0] = 0x80; return p; };
const pxAt = (x, y) => { painted.clear(); LayerManager.composeCellToCanvas(x >> 3, y >> 3); return painted.get(`${x},${y}`); };
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

{
  // Entering leaves the picture exactly as it was (the old tag model entered
  // everything on screen A and rendered black ink as (107,107,107)).
  LayerManager.initialize();
  const layer = LayerManager.getCurrentLayer();
  layer.setCell(0, 0, { ink: 0, paper: 7, bright: false, flash: false, pixels: onePixel() });
  const before = pxAt(0, 0);
  ScreenModeService.switchMode('gigascreen');
  check('switched to gigascreen', ACTIVE_SCREEN_MODE === GIGA);
  const after = pxAt(0, 0);
  check('entering gigascreen leaves an ink pixel unchanged', same(before, after),
    `before ${before} after ${after}`);
  const cell = LayerManager.getCurrentLayer().getCell(0, 0);
  check('entering gives every cell a screen B equal to screen A',
    cell.pixelsB && cell.pixelsB[0] === 0x80 && cell.inkB === 0 && cell.paperB === 7);
  check('standard -> gigascreen reports lossless',
    ScreenModeService.isConversionLossy('standard_ula', 'gigascreen') === false);
  check('leaving an untouched screen B is lossless',
    ScreenModeService.isConversionLossy('gigascreen', 'standard_ula') === false);
  ScreenModeService.switchMode('standard_ula');
}

{
  // Average / A / B / Flicker read the two planes of ONE cell.
  LayerManager.initialize();
  ScreenModeService.switchMode('gigascreen');
  const la = LayerManager.getCurrentLayer();
  la.setCell(0, 0, {
    ink: 2, paper: 7, bright: false, flash: false, pixels: onePixel(),
    inkB: 1, paperB: 7, brightB: false, flashB: false, pixelsB: onePixel()
  });

  check('default display is average', LayerManager.getGigaView() === 'average');
  let px = pxAt(0, 0);
  // red (215,0,0) averaged with blue (0,0,215) -> (107,0,107)
  check('average display blends the two screens per channel',
    px[0] === 107 && px[1] === 0 && px[2] === 107, `got ${px}`);
  px = pxAt(1, 0);
  check('average of identical paper stays put', px[0] === 215 && px[1] === 215 && px[2] === 215);

  LayerManager.setGigaView('a');
  px = pxAt(0, 0);
  check('display A shows only screen A', px[0] === 215 && px[1] === 0 && px[2] === 0, `got ${px}`);
  LayerManager.setGigaView('b');
  px = pxAt(0, 0);
  check('display B shows only screen B', px[0] === 0 && px[1] === 0 && px[2] === 215, `got ${px}`);

  // Flicker: no requestAnimationFrame in Node, so drive the phase directly.
  LayerManager.setGigaView('flicker');
  LayerManager._gigaFlickerPhase = 0;
  const f0 = pxAt(0, 0);
  LayerManager._gigaFlickerPhase = 1;
  const f1 = pxAt(0, 0);
  check('flicker shows screen A then screen B', f0[0] === 215 && f0[2] === 0 && f1[0] === 0 && f1[2] === 215,
    `got ${f0} / ${f1}`);
  LayerManager.setGigaView('bogus');
  check('an unknown display is refused', LayerManager.getGigaView() === 'flicker');
  LayerManager.setGigaView('average');

  // flattenVisible carries both planes
  const flat = LayerManager.flattenVisible();
  check('flattenVisible keeps screen A', flat.getCell(0, 0).ink === 2);
  check('flattenVisible keeps screen B', flat.getCell(0, 0).inkB === 1 && flat.getCell(0, 0).pixelsB[0] === 0x80);

  // Screen B survives an undo snapshot round-trip
  UndoRedo.beginAction('probe');
  la.setCell(0, 0, { inkB: 4 });
  UndoRedo.endAction();
  check('screen B edit landed', la.getCell(0, 0).inkB === 4);
  UndoRedo.undo();
  const restored = LayerManager.getCurrentLayer().getCell(0, 0);
  check('undo restores screen B', restored.inkB === 1 && restored.pixelsB[0] === 0x80, `inkB ${restored.inkB}`);

  check('leaving with a different screen B is lossy',
    ScreenModeService.isConversionLossy('gigascreen', 'standard_ula') === true);
  ScreenModeService.switchMode('standard_ula');
  const leftCell = LayerManager.getCurrentLayer().getCell(0, 0);
  check('leaving keeps screen A and drops screen B', leftCell.ink === 2 && leftCell.pixelsB === undefined);
  check('back to standard_ula', ACTIVE_SCREEN_MODE === STD);
}

{
  // The draw gate: each slot writes the right bit on each screen, and both
  // colour sets are stamped. Screen A red on white, screen B blue on yellow.
  LayerManager.initialize();
  ScreenModeService.switchMode('gigascreen');
  const sel = {
    ink: 2, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false,
    inkB: 1, paperB: 6, brightB: false, flashB: false
  };
  const expected = LayerManager.gigaSlotColours({ ink: 2, paper: 7, bright: false }, { ink: 1, paper: 6, bright: false });
  for (let slot = 0; slot < GIGA_SLOTS.COUNT; slot++) {
    const x = slot * 8; // one cell per slot
    PixelDrawRoutine.draw(x, 0, { ...sel, gigaSlot: slot }, DRAW_MODE.NORMAL);
    const cell = LayerManager.getCurrentLayer().getCell(slot, 0);
    const bitA = (cell.pixels[0] >> 7) & 1;
    const bitB = (cell.pixelsB[0] >> 7) & 1;
    check(`slot ${slot} writes bitA=${GIGA_SLOTS.bitA(slot)} bitB=${GIGA_SLOTS.bitB(slot)}`,
      bitA === GIGA_SLOTS.bitA(slot) && bitB === GIGA_SLOTS.bitB(slot), `got ${bitA}${bitB}`);
    check(`slot ${slot} stamps both colour sets`,
      cell.ink === 2 && cell.paper === 7 && cell.inkB === 1 && cell.paperB === 6);
    const px = pxAt(x, 0);
    check(`slot ${slot} shows its blend on the canvas`, same(px, expected[slot]),
      `got ${px} want ${expected[slot]}`);
  }

  // No slot and no screen B colours (every caller that knows nothing of
  // GigaScreen): solid ink on both screens.
  PixelDrawRoutine.draw(40, 0, { ink: 0, paper: 7, bright: false, flash: false }, DRAW_MODE.NORMAL);
  const solid = LayerManager.getCurrentLayer().getCell(5, 0);
  check('a plain selection paints ink on both screens',
    (solid.pixels[0] & 0x80) && (solid.pixelsB[0] & 0x80) && solid.inkB === 0);
  const solidPx = pxAt(40, 0);
  check('a plain selection paints a solid colour', solidPx[0] === 0 && solidPx[1] === 0 && solidPx[2] === 0,
    `got ${solidPx}`);

  // XOR inverts the slot on both screens: slot 1 -> slot 2
  PixelDrawRoutine.draw(8, 0, { ...sel }, DRAW_MODE.XOR_PIXEL);
  check('XOR inverts both screens (slot 1 -> 2)',
    LayerManager.getCurrentLayer().getPixelSlot(8, 0) === 2);

  // Right button (NORMAL_ERASE) clears both screens
  PixelDrawRoutine.draw(24, 0, { ...sel }, DRAW_MODE.NORMAL_ERASE);
  check('right button clears both screens', LayerManager.getCurrentLayer().getPixelSlot(24, 0) === 0);

  // Eraser: first pass clears the dot and keeps the colours; a pass over a
  // cell empty on both screens wipes both colour sets.
  PixelDrawRoutine.draw(40, 0, sel, DRAW_MODE.ERASE_ALL);
  const erased = LayerManager.getCurrentLayer().getCell(5, 0);
  check('eraser first pass clears both screens and keeps colours',
    erased.pixels[0] === 0 && erased.pixelsB[0] === 0 && erased.altered === true);
  PixelDrawRoutine.draw(40, 0, sel, DRAW_MODE.ERASE_ALL);
  check('eraser second pass leaves the upper-layer cell see-through',
    LayerManager.getCurrentLayer().getCell(5, 0).altered === false);

  // "Use existing" takes each screen's own existing colour
  const layer = LayerManager.getCurrentLayer();
  layer.setCell(10, 0, { ink: 3, paper: 7, bright: false, flash: false, pixels: new Uint8Array(8),
    inkB: 5, paperB: 0, brightB: false, flashB: false, pixelsB: new Uint8Array(8) });
  PixelDrawRoutine.draw(80, 0, { ...sel, inkTransparent: true, gigaSlot: 3 }, DRAW_MODE.NORMAL);
  const kept = layer.getCell(10, 0);
  check('use-existing ink keeps each screen\'s own ink', kept.ink === 3 && kept.inkB === 5,
    `ink ${kept.ink} inkB ${kept.inkB}`);

  // getPixelState reports the slot
  const st = PixelDrawRoutine.getPixelState(16, 0);
  check('getPixelState reports the slot and screen B colours', st.slot === 2 && st.cellB && st.cellB.ink === 1);
  ScreenModeService.switchMode('standard_ula');
}

{
  // A document saved under the old per-layer tag model converts to one
  // two-screen layer showing the same two screens.
  LayerManager.initialize();
  ScreenModeService.switchMode('gigascreen');
  const cellWith = (ink) => {
    const grid = [];
    for (let y = 0; y < 24; y++) {
      const row = [];
      for (let x = 0; x < 32; x++) {
        row.push({ ink: 0, paper: 7, bright: false, flash: false, pixels: new Uint8Array(8), altered: false });
      }
      grid.push(row);
    }
    grid[0][0] = { ink, paper: 7, bright: false, flash: false, pixels: onePixel(), altered: true };
    return grid;
  };
  const bg = LayerManager.getAllLayers()[0];
  LayerManager.restoreFromData([
    bg,
    { name: 'A side', visible: true, opacity: 100, locked: false, gigaScreen: 0, attributeData: cellWith(2) },
    { name: 'B side', visible: true, opacity: 100, locked: false, gigaScreen: 1, attributeData: cellWith(1) }
  ]);
  check('tagged document converts to background + one layer', LayerManager.layers.length === 2);
  const c = LayerManager.layers[1].getCell(0, 0);
  check('converted screen A holds the A-tagged layer', c.ink === 2 && c.pixels[0] === 0x80);
  check('converted screen B holds the B-tagged layer', c.inkB === 1 && c.pixelsB[0] === 0x80);
  ScreenModeService.switchMode('standard_ula');
}

// ─── 4b. The other flicker pairs (2026-09-23) ───────────────────────────────

{
  // Two screens to two screens keeps screen B. The survey that preceded
  // this found the conversion plane-blind: GigaScreen -> MultiGiga 8x1 wiped
  // screen B and reported the switch as lossless.
  LayerManager.initialize();
  ScreenModeService.switchMode('gigascreen');
  const la = LayerManager.getCurrentLayer();
  const rows = (v) => Uint8Array.from([v, v, v, v, v, v, v, v]);
  la.setCell(0, 0, { ink: 2, paper: 7, bright: false, flash: false, pixels: rows(0xF0),
    inkB: 1, paperB: 6, brightB: true, flashB: false, pixelsB: rows(0x0F) });

  check('gigascreen -> multigiga 8x1 (refine) is lossless',
    ScreenModeService.isConversionLossy('gigascreen', 'multigiga_8x1') === false);
  ScreenModeService.switchMode('multigiga_8x1');
  const refined = LayerManager.getCurrentLayer().getCell(0, 5); // line 5 of the old cell
  check('refining keeps screen A', refined.ink === 2 && refined.pixels[0] === 0xF0);
  check('refining keeps screen B', refined.inkB === 1 && refined.paperB === 6
    && refined.brightB === true && refined.pixelsB[0] === 0x0F, JSON.stringify(refined));

  // Give one 8x1 line of screen B its own colour, then coarsen
  LayerManager.getCurrentLayer().getCell(0, 3).inkB = 4;
  check('multigiga 8x1 -> 8x4 (coarsen) is lossy',
    ScreenModeService.isConversionLossy('multigiga_8x1', 'multigiga_8x4') === true);
  ScreenModeService.switchMode('multigiga_8x4');
  const coarse = LayerManager.getCurrentLayer().getCell(0, 0);
  check('coarsening votes screen B by the same rule as screen A',
    coarse.inkB === 1 && coarse.ink === 2 && coarse.pixelsB[3] === 0x0F);

  UndoRedo.undo();
  check('one undo restores the 8x1 pair, screen B included',
    ACTIVE_SCREEN_MODE.id === 'multigiga_8x1'
      && LayerManager.getCurrentLayer().getCell(0, 3).inkB === 4);

  // Painting a slot works at the finer cell height too
  PixelDrawRoutine.draw(8, 1, { ink: 2, paper: 7, bright: false, flash: false,
    inkB: 1, paperB: 6, brightB: false, flashB: false, gigaSlot: 2 }, DRAW_MODE.NORMAL);
  check('a slot paints onto an 8x1 pair cell', LayerManager.getCurrentLayer().getPixelSlot(8, 1) === 2);
  ScreenModeService.switchMode('standard_ula');
}

{
  // The hi-res pair: each screen resolves through its own scheme.
  LayerManager.initialize();
  ScreenModeService.switchMode('timex_hires');
  ColorManager.setTimexHiresInk(2); // red on cyan
  const layer = LayerManager.getCurrentLayer();
  layer.setCell(0, 0, { pixels: Uint8Array.from([0x80, 0, 0, 0, 0, 0, 0, 0]) });
  const before = pxAt(0, 0);
  ScreenModeService.switchMode('timex_hires_giga');
  check('entering the hi-res pair copies the scheme to screen B',
    ColorManager.getTimexHiresInkB() === 2);
  check('entering the hi-res pair leaves the picture unchanged', same(pxAt(0, 0), before),
    `before ${before} after ${pxAt(0, 0)}`);
  check('the hi-res pair palette has four entries', ColorManager.getPalette().length === 4
    && ZX_SPECTRUM.PALETTE_SIZE === 4);

  ColorManager.setTimexHiresInkB(4); // screen B: green on magenta
  const inkA = ZX_PALETTE_RGB[2 + 8], inkB = ZX_PALETTE_RGB[4 + 8];
  const avg = [0, 1, 2].map(k => (inkA[k] + inkB[k]) >> 1);
  check('Average blends the two schemes', same(pxAt(0, 0), avg), `got ${pxAt(0, 0)} want ${avg}`);
  LayerManager.setGigaView('b');
  check('display B uses screen B\'s scheme', same(pxAt(0, 0), inkB));
  LayerManager.setGigaView('a');
  check('display A uses screen A\'s scheme', same(pxAt(0, 0), inkA));
  LayerManager.setGigaView('average');

  const slots = ColorManager.getGigaSlotRGB();
  check('the Paint colours are the four mixes of the two schemes',
    same(slots[3], avg) && new Set(slots.map(String)).size === 4);

  UndoRedo.beginAction('scheme');
  ColorManager.setTimexHiresInkB(6);
  UndoRedo.endAction();
  UndoRedo.undo();
  check('undo restores screen B\'s scheme', ColorManager.getTimexHiresInkB() === 4);

  // Leaving for another two-screen mode stamps each screen with its scheme
  ScreenModeService.switchMode('gigascreen');
  const g = LayerManager.getCurrentLayer().getCell(0, 0);
  check('hi-res pair -> gigascreen keeps each screen\'s scheme',
    g.ink === 2 && g.bright === true && g.inkB === 4 && g.brightB === true, JSON.stringify(g));
  ColorManager.setTimexHiresInk(0);
  ColorManager.setTimexHiresInkB(0);
  ScreenModeService.switchMode('standard_ula');
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
