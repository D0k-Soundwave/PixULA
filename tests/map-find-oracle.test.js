'use strict';
/**
 * Batch 11A oracle: 'visual' compare must agree with what the compositor actually paints. A screen is filled deterministically from a small set of
 * dot patterns and attribute bytes (FLASH, BRIGHT, black with bright, ink equal to paper, and a second screen in the pair modes), painted by
 * composeToCanvas in BOTH flash phases, and two cells are judged equal when their dots show the same RGB in both phases. MapFind's 'visual'
 * partition of the cells must be exactly that partition. The setup is copied from tests/display-view.test.js.
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
loadModule('js/utils/map-find.js');
loadModule('js/utils/map-codec.js');
loadModule('js/services/map-service.js');

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


const PATS = [[0, 0, 0, 0, 0, 0, 0, 0], [255, 255, 255, 255, 255, 255, 255, 255], [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C],
  [0xC3, 0xBD, 0x7E, 0x7E, 0x7E, 0x7E, 0xBD, 0xC3], [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55]];
const ATTRS = [0x38, 0x07, 0x3A, 0x39, 0x46, 0x40, 0x00, 0x3F, 0x8A, 0xCA, 0x91, 0x92, 0x12, 0x1B, 0x6A, 0xF8, 0x56, 0xD2];

const fillCell = (c, rows, attr, planeB) => {
  const f = { ink: attr & 7, paper: (attr >> 3) & 7, bright: !!(attr & 0x40), flash: !!(attr & 0x80) };
  if (planeB) {
    c.pixelsB.set(rows);
    Object.assign(c, { inkB: f.ink, paperB: f.paper, brightB: f.bright, flashB: f.flash });
  } else {
    c.pixels.set(rows);
    Object.assign(c, f);
  }
  c.altered = true;
};

function paint() {
  const out = [];
  for (const ph of [false, true]) {
    LayerManager._flashInverted = ph;
    LayerManager.composeToCanvas();
    out.push(Uint8ClampedArray.from(buf));
  }
  LayerManager._flashInverted = false;
  return out;
}

const MODES = ['standard_ula', 'ula_plus', 'ulanext', 'gigascreen', 'timex_hires', 'timex_hires_giga'];
for (const mode of MODES) {
  enter(mode);
  const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS, cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
  check(`${mode}: the find runs here`, MapService.findModes().includes('visual'));
  const lay = layer();
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const c = lay.getCell(cx, cy);
      fillCell(c, PATS[(cx * 7 + cy * 3) % PATS.length], ATTRS[(cx * 5 + cy * 11) % ATTRS.length], false);
      if (c.pixelsB) fillCell(c, PATS[(cx * 3 + cy * 5 + 1) % PATS.length], ATTRS[(cx * 13 + cy * 7 + 2) % ATTRS.length], true);
    }
  }
  const shots = paint();
  // the judge: a cell's look = its dots' RGB in both phases
  const look = (cx, cy) => {
    let k = '';
    for (const shot of shots) {
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const o = ((cy * ch + y) * W + cx * cw + x) * 4;
        k += shot[o] + ',' + shot[o + 1] + ',' + shot[o + 2] + ';';
      }
      k += '|';
    }
    return k;
  };
  const screen = MapService.captureScreen();
  const table = MapService.colourTable();
  check(`${mode}: the captured screen has the grid of the mode`, screen && screen.w === cols && screen.h === rows && screen.cellH === ch);

  // the partition of the cells by look must be the partition by MapFind's visual id
  const ids = MapFind.ids(screen, 'visual', table, new Map());
  const byLook = new Map();
  const byId = new Map();
  let bad = 0, firstBad = '';
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const k = look(cx, cy), id = ids[cy * cols + cx];
    if (!byLook.has(k)) byLook.set(k, new Set());
    byLook.get(k).add(id);
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(k);
  }
  for (const [, set] of byLook) if (set.size !== 1) { bad++; firstBad = firstBad || 'a look split into several ids'; }
  for (const [, set] of byId) if (set.size !== 1) { bad++; firstBad = firstBad || 'an id joins different looks'; }
  check(`${mode}: the visual partition of ${cols * rows} cells equals the compositor's (${byLook.size} different looks)${firstBad ? ' - ' + firstBad : ''}`, bad === 0);
  check(`${mode}: the test picture has several different looks (it can fail)`, byLook.size > (mode === 'timex_hires' ? 3 : 6));

  // 1 x 1 and 2 x 2 blocks through the service
  let wrong = 0;
  for (const [cx, cy] of [[0, 0], [3, 2], [5, 7], [cols - 1, rows - 1], [cols >> 1, rows >> 1]]) {
    const block = MapService.sliceBlock(screen, cx, cy, 1, 1);
    const got = new Set(MapService.findElement(block, 'visual', screen, table).positions.map(p => p.x + ',' + p.y));
    const want = new Set();
    const mine = look(cx, cy);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (look(x, y) === mine) want.add(x + ',' + y);
    if (got.size !== want.size || [...got].some(k => !want.has(k))) wrong++;
  }
  check(`${mode}: 1 x 1 finds are exactly the cells that look the same`, wrong === 0);
  wrong = 0;
  for (const [cx, cy] of [[0, 0], [4, 4], [cols - 2, rows - 2], [2, 9]]) {
    const block = MapService.sliceBlock(screen, cx, cy, 2, 2);
    const got = new Set(MapService.findElement(block, 'visual', screen, table).positions.map(p => p.x + ',' + p.y));
    const want = new Set();
    const mine = [look(cx, cy), look(cx + 1, cy), look(cx, cy + 1), look(cx + 1, cy + 1)];
    for (let y = 0; y + 1 < rows; y++) for (let x = 0; x + 1 < cols; x++) {
      if (look(x, y) === mine[0] && look(x + 1, y) === mine[1] && look(x, y + 1) === mine[2] && look(x + 1, y + 1) === mine[3]) want.add(x + ',' + y);
    }
    if (got.size !== want.size || [...got].some(k => !want.has(k)) || !got.has(cx + ',' + cy)) wrong++;
  }
  check(`${mode}: 2 x 2 finds are exactly the blocks that look the same, the source included`, wrong === 0);

  // the display toggles must not change the answer
  const before = Array.from(ids);
  const idsNow = () => Array.from(MapFind.ids(MapService.captureScreen(), 'visual', MapService.colourTable(), new Map()));
  view({ coloursOff: true });
  const off = idsNow();
  view({ colourGrid: true });
  const grid = idsNow();
  view({ stopFlashing: true });
  const stop = idsNow();
  view({});
  const sameParts = (a, b) => {
    const m = new Map(), n = new Map();
    return a.every((v, i) => {
      if (m.has(v) && m.get(v) !== b[i]) return false;
      if (n.has(b[i]) && n.get(b[i]) !== v) return false;
      m.set(v, b[i]); n.set(b[i], v);
      return true;
    });
  };
  check(`${mode}: Colours off, Colour grid and Stop flashing do not change what matches what`, sameParts(before, off) && sameParts(before, grid) && sameParts(before, stop));
}

// -- Timex hi-res: no cell attributes, so 'exact' is not offered ---------------------------------------------------------------------------------------
enter('timex_hires');
check('timex_hires: the find offers dots and visual, not exact', JSON.stringify(MapService.findModes()) === JSON.stringify(['dots', 'visual']));
check('...and refuses exact', MapService.findElement(MapFind.make(1, 1, 8, 1), 'exact') === null);
enter('standard_ula');
check('standard_ula offers all three', JSON.stringify(MapService.findModes()) === JSON.stringify(['exact', 'dots', 'visual']));
for (const mode of ['multicolor_8x1', 'multicolor_8x4', 'layer2_256', 'lores', 'ula_plus_8x1']) {
  enter(mode);
  check(`${mode}: the find is refused (cells are not 8 x 8 with one bit per dot)`, MapService.findModes().length === 0 && MapService.captureScreen() === null);
}
summary();
