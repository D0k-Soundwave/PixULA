'use strict';
/**
 * Batch 5 part 5A: the pin. What stamps write TODAY, in the modes the part touches, so the work that adds
 * per-stamp settings (colours / show-through / clear dots) can be shown to leave every default byte for byte
 * as it was. It passes on the code as it stood before part 5A, on purpose.
 *
 * Each scenario floats a stamp, places it with commitStamp (and with stampAt, the repeat-placement path the
 * brush mode uses) onto a drawing layer whose cells already hold known colours and dots, and compares the
 * affected cells with a hand-checked string:  "ink/paper/bright/flash:dots"  per cell, left to right.
 * The target cell starts as ink 1, paper 6, bright, no flash, with the dot pattern 0xA5 on its first row.
 *
 *   plain stamp:    every set dot is written with the RAIL colours (ink 2, paper 5, no bright, no flash); a clear
 *                   dot writes nothing, so the target's own dots stay.
 *   attributed:     each cell takes its OWN colours; set dots set the dot, clear dots recolour the paper of the cell
 *                   and leave the dot alone (DRAW_MODE.PAPER touches no pixel).
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
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
  packRGB(rgb) { return (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; },
  blitCellBits() {}, blitCellIndices() {}
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();

/** A mask w x h: row r has dots at every column c where (r + c) % 3 === 0. */
const diagonal = (w, h) => Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => (r + c) % 3 === 0));
const hex = (n) => n.toString(16).padStart(2, '0');

/** "ink/paper/bright/flash:dots" for a cell; dots are the cell's row bytes as hex. */
function sig(cell) {
  const flag = (b) => (b ? 1 : 0);
  const dots = cell.indices
    ? Array.from(cell.indices).join(',')
    : Array.from(cell.pixels).map(hex).join('');
  return `${cell.ink}/${cell.paper}/${flag(cell.bright)}/${flag(cell.flash)}:${dots}`;
}

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  return LayerManager.layers[1];
}

/** Give the target cells known colours and a dot pattern. */
function seedTarget(target, cells) {
  for (const [cx, cy] of cells) {
    const c = target.getCell(cx, cy);
    Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false });
    if (c.pixels) c.pixels[0] = 0xA5;
    c.altered = true;
  }
}

/**
 * @param {string} modeId
 * @param {Object} o { w, h, x, y, mask?, attrs?, cells:[[cx,cy]...], how:'commit'|'stampAt', xorBox? }
 * @returns {string} the signatures of the cells, joined with " | "
 */
function place(modeId, o) {
  const target = enter(modeId);
  seedTarget(target, o.cells);
  const mask = o.mask || diagonal(o.w, o.h);
  SelectionService.startFloatingPasteFromMask(mask, o.w, o.h, o.x, o.y, 'pin');
  const fp = SelectionService.floatingPaste;
  if (o.attrs) fp.attrs = o.attrs;
  if (o.indices) fp.indices = o.indices;
  const stamp = fp.floatingLayer;
  stamp.isStamp = true;
  if (o.xorBox) stamp.xorMode = true;
  LayerManager.setCurrentLayer(1);
  if (o.how === 'stampAt') {
    PixelDrawRoutine.beginBatch();
    SelectionService.stampAt(stamp);
    PixelDrawRoutine.endBatch();
  } else {
    SelectionService.commitStamp(stamp);
  }
  return o.cells.map(([cx, cy]) => sig(LayerManager.layers[1].getCell(cx, cy))).join(' | ');
}

const PIN = process.env.PIN_PRINT === '1';
function pin(label, got, want) {
  if (PIN) { console.log(`PIN ${JSON.stringify(label)}: ${JSON.stringify(got)}`); return; }
  check(label, got === want, `${got}  (wanted ${want})`);
}

const TWO = [[0, 0], [1, 0]];
const FOUR = [[0, 0], [1, 0], [0, 1], [1, 1]];
const ATTR_A = 0x38;                         // ink 0, paper 7
const ATTR_B = (1 << 6) | (2 << 3) | 1;      // bright, paper 2, ink 1
const lowClear = () => { const m = diagonal(16, 8); for (let r = 0; r < 8; r++) for (let c = 8; c < 16; c++) m[r][c] = false; return m; };

const SCENARIOS = [
  ['plain standard commit',      'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
  ['plain standard stampAt',     'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'stampAt' }],
  ['plain standard offset',      'standard_ula', { w: 8, h: 8, x: 4, y: 2, cells: FOUR, how: 'commit' }],
  ['plain standard xor box',     'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit', xorBox: true }],
  ['attributed standard commit', 'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit', attrs: [ATTR_A, ATTR_B] }],
  ['attributed standard stampAt', 'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'stampAt', attrs: [ATTR_A, ATTR_B] }],
  ['attributed, right cell clear', 'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit', attrs: [ATTR_A, ATTR_B], mask: lowClear() }],
  ['attributed, a hole in attrs', 'standard_ula', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit', attrs: [null, ATTR_B] }],
  ['plain ULAplus commit',       'ula_plus', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
  ['attributed ULAplus commit',  'ula_plus', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit', attrs: [ATTR_A, ATTR_B | 0x80] }],
  ['plain ULANext commit',       'ulanext', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
  ['plain GigaScreen commit',    'gigascreen', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
  ['plain multicolor 8x4 commit', 'multicolor_8x4', { w: 16, h: 8, x: 0, y: 0, cells: FOUR, how: 'commit' }],
  ['plain Timex hi-res commit',  'timex_hires', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
  ['plain Layer 2 commit',       'layer2_256', { w: 16, h: 8, x: 0, y: 0, cells: TWO, how: 'commit' }],
];

const WANT = {
  "plain standard commit": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "plain standard stampAt": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "plain standard offset": "2/5/0/0:a500090204090204 | 2/5/0/0:a500204090204090 | 2/5/0/0:ad02000000000000 | 2/5/0/0:a540000000000000",
  "plain standard xor box": "2/5/0/0:3724499224499224 | 2/5/0/0:ec92244992244992",
  "attributed standard commit": "0/7/0/0:b724499224499224 | 1/2/1/0:ed92244992244992",
  "attributed standard stampAt": "0/7/0/0:b724499224499224 | 1/2/1/0:ed92244992244992",
  "attributed, right cell clear": "0/7/0/0:b724499224499224 | 1/2/1/0:a500000000000000",
  "attributed, a hole in attrs": "1/6/1/0:a500000000000000 | 1/2/1/0:ed92244992244992",
  "plain ULAplus commit": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "attributed ULAplus commit": "0/7/0/0:b724499224499224 | 1/2/1/1:ed92244992244992",
  "plain ULANext commit": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "plain GigaScreen commit": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "plain multicolor 8x4 commit": "2/5/0/0:b7244992 | 2/5/0/0:ed922449 | 2/5/0/0:a5499224 | 2/5/0/0:b7244992",
  "plain Timex hi-res commit": "2/5/0/0:b724499224499224 | 2/5/0/0:ed92244992244992",
  "plain Layer 2 commit": "1/6/1/0:0,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1 | 1/6/1/0:-1,0,-1,-1,0,-1,-1,0,0,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,-1,-1,0,-1,-1,0,-1",
};

for (const [label, mode, o] of SCENARIOS) {
  pin(label, place(mode, o), WANT[label]);
}

summary();
