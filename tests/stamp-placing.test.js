'use strict';
/**
 * Batch 5 part 5A: what a stamp WRITES under each of its settings. Hand-derived; the defaults (a plain
 * stamp, transparent clear dots) are pinned separately by tests/stamp-golden.test.js.
 *
 * Setup for every case: the target cell starts ink 1, paper 6, bright, with dots 0xA5 on its first row and
 * nothing else; the colour rail is ink 2, paper 5. The stamp is 8x8 with dots where (row + col) % 3 == 0,
 * so its rows are 92 24 49 92 24 49 92 24 (hex). Signature: "ink/paper/bright/flash:dots".
 *
 *   mask   = 9224499224499224        inverse of mask = 6ddbb66ddbb66ddb
 *   target = a500000000000000        A5 | mask row 0 = b7;  A5 & ~92 = 25;  A5 ^ 92 = 37
 *
 * The stamp's own cell colours are ink 1, paper 2, bright (attribute byte 0x51).
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

const O = { w: 8, h: 8, x: 0, y: 0, cells: [[0, 0]], how: 'commit' };
const OWN = 0x50 | (2 << 3) | 1;            // bright, paper 2, ink 1
const PLAIN_DOTS = 'b724499224499224';
const MASK = '9224499224499224';
const NOT_MASK = '6ddbb66ddbb66ddb';

function run(label, want, o, setup) {
  const target = enter(o.mode || 'standard_ula');
  seedTarget(target, o.cells);
  const mask = o.mask || diagonal(o.w, o.h);
  SelectionService.startFloatingPasteFromMask(mask, o.w, o.h, o.x, o.y, 'case');
  const fp = SelectionService.floatingPaste;
  if (o.attrs) fp.attrs = o.attrs;
  if (o.opts) fp.opts = o.opts;
  if (o.attrGrid) fp.attrGrid = o.attrGrid;
  const stamp = fp.floatingLayer;
  stamp.isStamp = true;
  if (o.xorBox) stamp.xorMode = true;
  if (setup) setup();
  LayerManager.setCurrentLayer(1);
  if (o.how === 'stampAt') {
    PixelDrawRoutine.beginBatch();
    SelectionService.stampAt(stamp);
    PixelDrawRoutine.endBatch();
  } else {
    SelectionService.commitStamp(stamp);
  }
  const got = o.cells.map(([cx, cy]) => sig(LayerManager.layers[1].getCell(cx, cy))).join(' | ');
  StateManager.setInverse(false);
  StateManager.setDrawMode('normal');
  check(label, got === want, `${got}  (wanted ${want})`);
}
const inverse = () => StateManager.setInverse(true);
const drawMode = (m) => () => StateManager.setDrawMode(m);

// --- Pixels stamp ---------------------------------------------------------------------------------------------
run('pixels, transparent: the target dots stay',
  '2/5/0/0:' + PLAIN_DOTS, { ...O });
run('pixels, overlap: the clear dots clear the target dots',
  '2/5/0/0:' + MASK, { ...O, opts: { clearDots: 'overlap' } });
run('pixels, overlap, stampAt agrees with commit',
  '2/5/0/0:' + MASK, { ...O, how: 'stampAt', opts: { clearDots: 'overlap' } });
run('pixels, overlap, Inverse: set dots clear, clear dots set',
  '2/5/0/0:' + NOT_MASK, { ...O, opts: { clearDots: 'overlap' } }, inverse);
run('pixels, overlap, Pixels Only: clear dots clear, attributes untouched',
  '1/6/1/0:' + MASK, { ...O, opts: { clearDots: 'overlap' } }, drawMode('pixel_only'));
run('pixels, overlap, XOR mode: no opposite, so the clear dots write nothing',
  '2/5/0/0:3724499224499224', { ...O, opts: { clearDots: 'overlap' } }, drawMode('xor'));
run('pixels, overlap, the stamp XOR box: clear dots write nothing',
  '2/5/0/0:3724499224499224', { ...O, xorBox: true, opts: { clearDots: 'overlap' } });
run('pixels, overlap, Ink recolour: nothing to clear, nothing set (the rail bright and flash are written)',
  '2/6/0/0:a500000000000000', { ...O, opts: { clearDots: 'overlap' } }, drawMode('ink'));

// --- Coloured stamp ---------------------------------------------------------------------------------------------
run('coloured, transparent: set dots set, cell takes its own colours',
  '1/2/1/0:' + PLAIN_DOTS, { ...O, attrs: [OWN] });
run('coloured ignores the rail draw mode (Pixels Only still colours)',
  '1/2/1/0:' + PLAIN_DOTS, { ...O, attrs: [OWN] }, drawMode('pixel_only'));
run('coloured ignores the stamp XOR box',
  '1/2/1/0:' + PLAIN_DOTS, { ...O, attrs: [OWN], xorBox: true });
run('coloured, overlap: clear dots clear the target dots',
  '1/2/1/0:' + MASK, { ...O, attrs: [OWN], opts: { clearDots: 'overlap' } });
run('coloured, transparent, Inverse: set dots clear, the rest untouched',
  '1/2/1/0:2500000000000000', { ...O, attrs: [OWN] }, inverse);
run('coloured, overlap, Inverse: the picture is inverted',
  '1/2/1/0:' + NOT_MASK, { ...O, attrs: [OWN], opts: { clearDots: 'overlap' } }, inverse);
run('coloured, stampAt agrees with commit',
  '1/2/1/0:' + PLAIN_DOTS, { ...O, attrs: [OWN], how: 'stampAt' });
run('coloured, a hole writes nothing',
  '1/6/1/0:a500000000000000', { ...O, attrs: [null] });
run('coloured, setting "pixels": the rail colours are used instead',
  '2/5/0/0:' + PLAIN_DOTS, { ...O, attrs: [OWN], opts: { colours: 'pixels' } });
run('coloured, show-through paper: the page paper (6) stays',
  '1/6/1/0:' + PLAIN_DOTS, { ...O, attrs: [OWN], opts: { showThrough: { ink: false, paper: true, bright: false, flash: false } } });
run('coloured, show-through bright and ink: the page bright (on) and ink (1) win over a plain stamp',
  '1/7/1/0:' + PLAIN_DOTS, { ...O, attrs: [0x38], opts: { showThrough: { ink: true, paper: false, bright: true, flash: false } } });
run('coloured with a cell size that is not the mode\'s: the pixels path',
  '2/5/0/0:' + PLAIN_DOTS, { ...O, attrs: [OWN], attrGrid: { cols: 1, rows: 1, cw: 4, ch: 4, ox: 0, oy: 0 } });

// --- Indexed (Layer 2): the same settings over palette indices ----------------------------------------------------
{
  const cases = [
    ['transparent', {}, null],
    ['overlap', { clearDots: 'overlap' }, null],
    ['overlap, Inverse', { clearDots: 'overlap' }, 'inverse'],
    ['overlap, XOR', { clearDots: 'overlap' }, 'xor']
  ];
  const tgt = () => {
    const t = enter('layer2_256');
    const cell = t.getCell(0, 0);
    cell.indices.fill(9);
    cell.altered = true;
    return t;
  };
  const setup = (kind) => {
    if (kind === 'inverse') StateManager.setInverse(true);
    if (kind === 'xor') StateManager.setDrawMode('xor');
  };
  const isDot = (i) => ((i >> 3) + (i & 7)) % 3 === 0;
  for (const [name, opts, kind] of cases) {
    const t = tgt();
    const ink = ColorManager.getIndexedInk();
    const paper = ColorManager.getIndexedPaper();
    setup(kind);
    SelectionService.startFloatingPasteFromMask(diagonal(8, 8), 8, 8, 0, 0, 'idx');
    const fp = SelectionService.floatingPaste;
    fp.opts = opts;
    const stamp = fp.floatingLayer;
    stamp.isStamp = true;
    LayerManager.setCurrentLayer(1);
    SelectionService.moveFloatingPaste(0, 0);
    const below = Array.from(LayerManager.layers[1].getCell(0, 0).indices);
    const bgBefore = Array.from(LayerManager.layers[0].getCell(0, 0).indices);
    const preview = Array.from(stamp.getCell(0, 0).indices).map((v, i) => (v >= 0 ? v : (below[i] >= 0 ? below[i] : bgBefore[i])));
    SelectionService.commitStamp(stamp);
    const got = Array.from(LayerManager.layers[1].getCell(0, 0).indices);
    const bg = Array.from(LayerManager.layers[0].getCell(0, 0).indices);
    const shown = got.map((v, i) => (v >= 0 ? v : bg[i]));
    StateManager.setInverse(false);
    StateManager.setDrawMode('normal');
    let want;
    if (kind === 'inverse') {
      // Inverse: the stamp's dots go to paper, and with overlap the rest takes the ink
      want = got.map((_, i) => (isDot(i) ? paper : (opts.clearDots ? ink : 9)));
    } else if (kind === 'xor') {
      want = null; // XOR toggles the dots; only the untouched clear pixels are asserted below
    } else {
      want = got.map((_, i) => (isDot(i) ? ink : (opts.clearDots ? -1 : 9)));
    }
    if (kind !== 'xor') check(`indexed, ${name}: the pixels written`, JSON.stringify(got) === JSON.stringify(want),
      `${got.join(',')}  (wanted ${want.join(',')})`);
    if (kind === 'xor') {
      check('indexed, overlap, XOR: clear pixels untouched (still 9)', got.every((v, i) => isDot(i) || v === 9), got.join(','));
    }
    check(`indexed, ${name}: the preview is the picture the commit leaves`,
      JSON.stringify(preview) === JSON.stringify(shown), `${preview.join(',')}  vs  ${shown.join(',')}`);
  }
}

summary();
