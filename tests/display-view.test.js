'use strict';
/**
 * The three display-only view switches (View menu): Colours off, Stop
 * flashing, Colour grid.
 *
 * They change what the screen SHOWS and nothing else: not a cell, not undo, not
 * an export. The rule lives in one place in the compositor
 * (LayerManager._cellInk and _cellPaper), so every path that used to swap ink and
 * paper for FLASH on its own (composeCellToCanvas, previewCellColours, the
 * single-screen GigaScreen blit, the GigaScreen blend) follows the switches
 * together. Per mode:
 *   cell-attribute modes ......... black on white / chessboard / no flash swap
 *   GigaScreen, MultiGiga ........ grey levels, from the two screens
 *   Timex hi-res ................. black on white; Colour grid has no cells
 *   indexed (Layer 2, LoRes) ..... Colours off and Colour grid do nothing
 *   Stop flashing ................ only where the palette model flashes
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
for (const m of ['js/core/constants.js', 'js/utils/helpers.js', 'js/utils/validators.js',
  'js/core/event-bus.js', 'js/core/state-manager.js', 'js/core/attribute-system.js']) {
  loadModule(m);
}

// A CanvasSystem stub with a real pixel buffer, so the tests read what the
// compositor painted and an export can be compared byte for byte.
let W = 0, H = 0, buf = null;
function resetBuffer() {
  W = ZX_SPECTRUM.WIDTH; H = ZX_SPECTRUM.HEIGHT;
  buf = new Uint8ClampedArray(W * H * 4);
}
global.CanvasSystem = withBlit({
  setPixel(x, y, r, g, b) {
    const o = (y * W + x) * 4;
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
  },
  getImageData() { return { width: W, height: H, data: buf }; },
  markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b === 0 ? 0 : b + (br ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, composeToCanvas() {},
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {},
  getViewportSize() { return { width: 512, height: 384 }; },
  getScale() { return 1; }, getScaleFor(z) { return z / 100; },
  setZoom() {}, zoomTo() {}, zoomToRect() {}, fitZoom() { return 100; }, zoomToFit() {}
});
global.Helpers.createCanvas = (w, h) => ({
  getContext: () => ({
    createImageData: (cw, ch) => ({ width: cw, height: ch, data: new Uint8ClampedArray(cw * ch * 4) })
  })
});

// The flash clock is counted, not run.
let started = 0, cleared = 0;
global.setInterval = () => { started++; return 7; };
global.clearInterval = () => { cleared++; };
global.Storage = { get: async () => undefined, set: async () => {}, STORES: {} };
global.GridOverlay = new Proxy({}, { get: () => () => {} });
global.UndoRedo = {
  beginAction() {}, endAction() {}, cancelAction() {}, snapshot() {},
  initialize() {}, revertAction() {}, revertLast() {}, peekLast() { return null; }
};
global.ClipboardCodec = { encode() { return null; }, decode() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
ColorManager.initialize();

const V = DISPLAY_VIEW_COLOURS;
const px = (x, y) => { const o = (y * W + x) * 4; return [buf[o], buf[o + 1], buf[o + 2]]; };
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const rgbOf = (arr) => [arr[0], arr[1], arr[2]];
const layer = () => LayerManager.getCurrentLayer();
const view = (o) => LayerManager.setDisplayView(Object.assign(
  { coloursOff: false, colourGrid: false, stopFlashing: false }, o));

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  LayerManager._flashInverted = false;
  resetBuffer();
  view({});
}

/** A cell with the dot pattern 10100101 on its first row. */
function seed(cx, cy, attrs) {
  const c = layer().getCell(cx, cy);
  c.pixels[0] = 0xA5;
  Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false }, attrs);
  c.altered = true;
  return c;
}
function seedFour(attrs) {
  seed(0, 0, attrs); seed(1, 0, attrs); seed(0, 1, attrs); seed(1, 1, attrs);
}

// -- 1. The state: three switches, one event, Colours off and Colour grid exclude

{
  let events = [];
  EventBus.on(EVENTS.DISPLAY_VIEW_CHANGED, (p) => events.push(p));
  check('the view starts with all three switches off',
    JSON.stringify(StateManager.getDisplayView()) ===
    JSON.stringify({ coloursOff: false, stopFlashing: false, colourGrid: false }));
  StateManager.setColoursOff(true);
  check('Colours off turns on, with one event', StateManager.getDisplayView().coloursOff && events.length === 1);
  StateManager.setColourGrid(true);
  const v = StateManager.getDisplayView();
  check('Colour grid on turns Colours off off', v.colourGrid && !v.coloursOff);
  check('...in one event that carries both values',
    events.length === 2 && events[1].colourGrid === true && events[1].coloursOff === false);
  StateManager.setColoursOff(true);
  check('Colours off on turns Colour grid off',
    StateManager.getDisplayView().coloursOff && !StateManager.getDisplayView().colourGrid);
  StateManager.setStopFlashing(true);
  check('Stop flashing is independent of the other two',
    StateManager.getDisplayView().stopFlashing && StateManager.getDisplayView().coloursOff);
  StateManager.setColoursOff(false); StateManager.setStopFlashing(false);
  check('all switches can be turned off again',
    !StateManager.getDisplayView().coloursOff && !StateManager.getDisplayView().stopFlashing);
}

// -- 2. Cell-attribute modes ----------------------------------------------

for (const mode of ['standard_ula', 'multicolor_8x4', 'ula_plus', 'ulanext']) {
  enter(mode);
  seedFour();
  LayerManager.composeToCanvas();
  const inkRGB = rgbOf(px(0, 0)), paperRGB = rgbOf(px(1, 0));
  check(`${mode}: normal display shows ink and paper differently`, !same(inkRGB, paperRGB));

  view({ coloursOff: true });
  check(`${mode}: Colours off shows a set dot black`, same(px(0, 0), V.BLACK));
  check(`${mode}: Colours off shows a clear dot white`, same(px(1, 0), V.WHITE));
  check(`${mode}: Colours off is the same in every cell`, same(px(8, 0), V.BLACK) && same(px(9, 0), V.WHITE));

  view({ colourGrid: true });
  check(`${mode}: Colour grid shows a set dot black`, same(px(0, 0), V.BLACK));
  check(`${mode}: Colour grid cell (0,0) paper is white`, same(px(1, 0), V.WHITE));
  check(`${mode}: Colour grid cell (1,0) paper is the alternate`, same(px(9, 0), V.CELL_ALT));
  check(`${mode}: Colour grid cell (0,1) paper is the alternate`, same(px(1, ZX_SPECTRUM.CELL_HEIGHT), V.CELL_ALT));
  check(`${mode}: Colour grid cell (1,1) paper is white again`, same(px(9, ZX_SPECTRUM.CELL_HEIGHT), V.WHITE));

  view({});
  check(`${mode}: switching off restores the real colours`,
    same(px(0, 0), inkRGB) && same(px(1, 0), paperRGB));
}

// -- 3. FLASH: Stop flashing, and the flash clock -------------------------

{
  enter('standard_ula');
  seedFour({ flash: true });
  LayerManager._flashInverted = true;
  LayerManager.composeToCanvas();
  const swapped = rgbOf(px(0, 0));
  LayerManager._flashInverted = false;
  LayerManager.composeToCanvas();
  const normal = rgbOf(px(0, 0));
  check('a flashing cell swaps ink and paper in the inverted phase', !same(swapped, normal));

  started = 0; cleared = 0;
  LayerManager._flashInverted = true;
  view({ stopFlashing: true });
  check('Stop flashing stops the clock exactly once', cleared === 1 && LayerManager._flashClockId === null);
  check('...and puts the phase back to normal', LayerManager._flashInverted === false);
  check('...so the flashing cell shows its normal colours', same(px(0, 0), normal));
  LayerManager._flashInverted = true;
  LayerManager.composeToCanvas();
  check('...even if a stray phase flag were set (the rule ignores it)', same(px(0, 0), normal));
  LayerManager._flashInverted = false;
  view({ stopFlashing: true });
  check('turning it on twice does not stop the clock twice', cleared === 1);
  view({});
  check('turning it off starts the clock again, once', started === 1 && LayerManager._flashClockId === 7);
  view({});
  check('...and a repeat does not start a second clock', started === 1);

  cleared = 0; started = 0;
  view({ coloursOff: true });
  check('Colours off stops the clock too (the colours are hidden)', cleared === 1 && LayerManager._flashClockId === null);
  view({ colourGrid: true });
  check('...Colour grid keeps it stopped', cleared === 1 && started === 0);
  view({});
  check('...and leaving both resumes it', started === 1);

  // Where the palette does not flash, Stop flashing changes nothing.
  for (const mode of ['ula_plus', 'ulanext', 'timex_hires', 'layer2_256', 'lores']) {
    enter(mode);
    cleared = 0; started = 0;
    view({ stopFlashing: true });
    check(`${mode}: Stop flashing does not touch the clock (nothing flashes)`, cleared === 0);
    view({});
  }
}

// -- 4. GigaScreen and MultiGiga: grey levels ------------------------------

for (const mode of ['gigascreen', 'multigiga_8x2']) {
  enter(mode);
  const c = seed(0, 0, {});
  c.pixelsB = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
  c.pixelsB[0] = 0xCC;
  Object.assign(c, { inkB: 2, paperB: 5, brightB: false, flashB: false });
  c.pixels[0] = 0xF0;
  LayerManager.composeToCanvas();

  view({ coloursOff: true });
  // columns: 0,1 both screens; 2,3 screen A only; 4,5 screen B only; 6,7 neither
  check(`${mode}: Colours off, a dot on both screens is black`, same(px(0, 0), V.BLACK) && same(px(1, 0), V.BLACK));
  check(`${mode}: Colours off, a dot on screen A only is the light grey`, same(px(2, 0), V.SCREEN_A_ONLY));
  check(`${mode}: Colours off, a dot on screen B only is the mid grey`, same(px(4, 0), V.SCREEN_B_ONLY));
  check(`${mode}: Colours off, no dot is white`, same(px(6, 0), V.WHITE));

  view({ colourGrid: true });
  check(`${mode}: Colour grid keeps the greys`,
    same(px(0, 0), V.BLACK) && same(px(2, 0), V.SCREEN_A_ONLY) && same(px(4, 0), V.SCREEN_B_ONLY));
  check(`${mode}: Colour grid, no dot is white in cell (0,0)`, same(px(6, 0), V.WHITE));

  // The single-screen displays take the classic blit with the same rule.
  for (const gv of ['a', 'b']) {
    LayerManager.setGigaView(gv);
    view({ coloursOff: true });
    const setDot = gv === 'a' ? px(2, 0) : px(4, 0);
    const clearDot = gv === 'a' ? px(4, 0) : px(2, 0);
    check(`${mode}: screen ${gv.toUpperCase()} alone, Colours off: set dot black`, same(setDot, V.BLACK));
    check(`${mode}: screen ${gv.toUpperCase()} alone, Colours off: clear dot white`, same(clearDot, V.WHITE));
    view({ colourGrid: true });
    LayerManager.setGigaView('average');
  }
  view({});
}

// -- 5. Timex hi-res and the indexed modes ------------------------------------

{
  enter('timex_hires');
  seed(0, 0, {});
  LayerManager.composeToCanvas();
  const baseline = Buffer.from(buf);
  view({ coloursOff: true });
  check('timex_hires: Colours off shows black on white', same(px(0, 0), V.BLACK) && same(px(1, 0), V.WHITE));
  view({ colourGrid: true });
  check('timex_hires: Colour grid has no cells, so the screen is unchanged',
    Buffer.compare(Buffer.from(buf), baseline) === 0);
  view({});

  for (const mode of ['layer2_256', 'lores']) {
    enter(mode);
    LayerManager.composeToCanvas();
    const base = Buffer.from(buf);
    view({ coloursOff: true });
    check(`${mode}: Colours off changes nothing (every pixel is its own colour)`, Buffer.compare(Buffer.from(buf), base) === 0);
    view({ colourGrid: true });
    check(`${mode}: Colour grid changes nothing`, Buffer.compare(Buffer.from(buf), base) === 0);
    view({});
  }
}

// -- 6. Display only: cells, the preview, and exports -----------------------

{
  enter('standard_ula');
  seedFour({ flash: true });
  const before = JSON.stringify(layer().cells || layer().getCell(0, 0));
  LayerManager._flashInverted = false;
  LayerManager.composeToCanvas();
  const baseline = Buffer.from(LayerManager.stillImageData().data);

  view({ coloursOff: true });
  check('the screen changed with Colours off', Buffer.compare(Buffer.from(buf), baseline) !== 0);
  const exp1 = Buffer.from(LayerManager.stillImageData().data);
  check('an export with Colours off is byte-identical to one without', Buffer.compare(exp1, baseline) === 0);
  check('...and the screen still shows Colours off afterwards', same(px(0, 0), V.BLACK));

  view({ colourGrid: true });
  const exp2 = Buffer.from(LayerManager.stillImageData().data);
  check('an export with Colour grid is byte-identical', Buffer.compare(exp2, baseline) === 0);
  check('...and the screen still shows the grid', same(px(9, 0), V.CELL_ALT));

  view({ stopFlashing: true });
  LayerManager._flashInverted = true;
  const exp3 = Buffer.from(LayerManager.stillImageData().data);
  check('an export is the normal phase whatever phase the clock is in',
    Buffer.compare(exp3, baseline) === 0);
  LayerManager._flashInverted = false;

  check('no cell changed', JSON.stringify(layer().cells || layer().getCell(0, 0)) === before);

  // The hover/brush preview must match the display it previews.
  view({ coloursOff: true });
  LayerManager.composeToCanvas();
  const cell = layer().getCell(0, 0);
  const pv = LayerManager.previewCellColours(0, 0, layer(), cell);
  let match = true;
  for (let r = 0; r < 8 && match; r++) {
    for (let col = 0; col < 8; col++) {
      if (!same(pv[r * 8 + col], px(col, r))) { match = false; break; }
    }
  }
  check('previewCellColours agrees with the display (Colours off)', match);
  view({ colourGrid: true });
  LayerManager.composeToCanvas();
  const pv2 = LayerManager.previewCellColours(1, 0, layer(), layer().getCell(1, 0));
  check('previewCellColours agrees with the display (Colour grid, odd cell)',
    same(pv2[1], px(9, 0)) && same(pv2[0], px(8, 0)));
  view({});

  // GigaScreen: exports keep the Average and the real colours too.
  enter('gigascreen');
  const gc = seed(0, 0, {});
  gc.pixelsB = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
  gc.pixelsB[0] = 0xCC;
  Object.assign(gc, { inkB: 2, paperB: 5, brightB: false, flashB: false });
  LayerManager.composeToCanvas();
  const gBase = Buffer.from(LayerManager.stillImageData().data);
  view({ coloursOff: true });
  LayerManager.setGigaView('flicker');
  const gExp = Buffer.from(LayerManager.stillImageData().data);
  check('GigaScreen: export with Colours off and Flicker equals the plain Average export',
    Buffer.compare(gExp, gBase) === 0);
  LayerManager.setGigaView('average');
  view({});
}

// -- 7. Review additions -----------------------------------------------------

{
  // Flicker would strobe black and white with the colours hidden; it shows the
  // grey levels (the Average) instead, and its frame loop is not wanted.
  enter('gigascreen');
  const c = seed(0, 0, {});
  c.pixelsB = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
  c.pixelsB[0] = 0xCC;
  Object.assign(c, { inkB: 2, paperB: 5, brightB: false, flashB: false });
  c.pixels[0] = 0xF0;
  LayerManager._gigaView = 'flicker';
  LayerManager._gigaFlickerPhase = 0;
  view({ coloursOff: true });
  check('Flicker with Colours off shows the grey levels (screen A only)', same(px(2, 0), V.SCREEN_A_ONLY));
  check('...and screen B only', same(px(4, 0), V.SCREEN_B_ONLY));
  LayerManager._gigaFlickerPhase = 1;
  view({ coloursOff: true });
  check('...the same on the other flicker phase', same(px(2, 0), V.SCREEN_A_ONLY) && same(px(4, 0), V.SCREEN_B_ONLY));
  LayerManager._gigaView = 'average';
  view({});

  // Colour grid on an odd cell: no dot is the alternate paper.
  seed(1, 0, {});
  const odd = layer().getCell(1, 0);
  odd.pixelsB = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
  Object.assign(odd, { inkB: 2, paperB: 5, brightB: false, flashB: false });
  odd.pixels[0] = 0xF0;
  view({ colourGrid: true });
  check('GigaScreen Colour grid: an odd cell with no dot shows the alternate paper', same(px(8 + 7, 0), V.CELL_ALT));
  check('...an even cell with no dot shows white', same(px(7, 0), V.WHITE));
  view({});
}

{
  // The two-screen Timex hi-res: greys with Colours off, nothing for Colour grid.
  enter('timex_hires_giga');
  const c = seed(0, 0, {});
  c.pixelsB = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
  c.pixels[0] = 0xF0; c.pixelsB[0] = 0xCC;
  LayerManager.composeToCanvas();
  const base = Buffer.from(buf);
  view({ colourGrid: true });
  check('timex_hires_giga: Colour grid has no cells, so nothing changes', Buffer.compare(Buffer.from(buf), base) === 0);
  view({ coloursOff: true });
  check('timex_hires_giga: Colours off shows both-screens black', same(px(0, 0), V.BLACK));
  check('timex_hires_giga: ...and no dot white', same(px(6, 0), V.WHITE));
  view({});
}

{
  // An export made while the flash clock's change is only queued is still current.
  enter('standard_ula');
  seedFour({ flash: true });
  LayerManager._flashInverted = true;
  LayerManager.composeToCanvas();
  const inverted = Buffer.from(buf);
  LayerManager._flashInverted = false;
  LayerManager.deferCellCompose(0, 0);   // queued, not yet drawn
  const exp = Buffer.from(LayerManager.stillImageData().data);
  check('an export flushes queued cells first', Buffer.compare(exp, inverted) !== 0 && same(
    [exp[0], exp[1], exp[2]], rgbOf(ColorManager.getRGB(1))));
  // A throw mid-render still puts the screen back as the user has it.
  view({ coloursOff: true });
  const real = CanvasSystem.getImageData;
  let boom = true;
  CanvasSystem.getImageData = function () { if (boom) { boom = false; throw new Error('x'); } return real.call(this); };
  let threw = false;
  try { LayerManager.stillImageData(); } catch (e) { threw = true; }
  CanvasSystem.getImageData = real;
  check('a failing export throws', threw);
  check('...and Colours off is still on afterwards', LayerManager._disp.mono === true && same(px(0, 0), V.BLACK));
  view({});
}

summary();
