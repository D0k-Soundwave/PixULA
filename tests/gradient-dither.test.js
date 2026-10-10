'use strict';
/**
 * Batch 8 part 8B step 1: the gradient's Dithered grain also offers the Dither methods. The legacy 2 / 4 / 8 values must
 * keep drawing exactly the gradient's own Bayer matrices (old presets), the new ids go through Dither.apply, and the
 * schema offers 31 entries with the three Bayers first.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/dither.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 2, paper: 6, bright: true, flash: false }; }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }
};

// Minimal stand-in so the tool's own EVENTS.TOOL_OPTIONS listener (mirrors
// bezier-tool's CANVAS_ZOOM listener) can gate on "is this the active tool" -
// tests point it at whichever GradientTool instance they're driving.
let _currentTool = null;
global.ToolManager = { getCurrentTool: () => _currentTool };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/gradient-tool.js');

LayerManager.initialize();

const layer = LayerManager.getCurrentLayer();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const ev = (over = {}) => ({
  button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  shiftKey: false, altKey: false, ...over
});

// A fresh tool instance per scenario. There's no layer-clear API, so every
// scenario below draws into its own disjoint rectangle rather than reusing
// coordinates - ink is additive/never erased, so overlap would corrupt counts.
function freshTool() {
  return new GradientTool();
}

function countInkInRect(x1, y1, x2, y2) {
  let n = 0;
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (isInk(x, y)) n++;
  return n;
}


const LEGACY = {
  2: [[0,32],[48,16]],
  4: [[0,32,8,40],[48,16,56,24],[12,44,4,36],[60,28,52,20]],
  8: [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
      [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]]
};
function draw(tool, x1, y1, x2, y2) {
  tool.onPointerDown(x1, y1, ev());
  tool.onPointerUp(x2, y2, ev());
  const cy = Math.round((y1 + y2) / 2);
  tool.onPointerDown(x1, cy, ev());
  tool.onPointerUp(x2, cy, ev());
}
const inkAt = (x, y) => isInk(x, y) ? 1 : 0;

// -- the schema ---------------------------------------------------------------------------------------------------
{
  const entry = GradientTool.optionsSchema.find(e => e.key === 'ditherScale');
  const flat = PresetService_optionValues(entry.options);
  check('grain select offers 31 entries', flat.length === 31, String(flat.length));
  check('the three Bayers come first, as numbers 2, 4, 8', flat[0] === 2 && flat[1] === 4 && flat[2] === 8);
  check('the other 28 are the non-Bayer Dither ids', flat.slice(3).every(v => typeof v === 'string' && Dither.get(v) && Dither.get(v).family !== 'bayer'));
}
function PresetService_optionValues(options) {
  const out = [];
  for (const o of options) { if (Array.isArray(o.options)) out.push(...PresetService_optionValues(o.options)); else out.push(o.value); }
  return out;
}

// -- setter -------------------------------------------------------------------------------------------------------
{
  const t = freshTool();
  check('default grain is 8', t.getDitherScale() === 8);
  t.setDitherScale('4');
  check('"4" (a string, from a preset or select) sets 4', t.getDitherScale() === 4);
  t.setDitherScale('atkinson');
  check('a Dither id is stored', t.getDitherScale() === 'atkinson');
  t.setDitherScale('bayer-4');
  check('the ZX Bayer ids are not offered here and are ignored', t.getDitherScale() === 'atkinson');
  t.setDitherScale('nonsense');
  check('junk is ignored', t.getDitherScale() === 'atkinson');
  t.setDitherScale(2);
  check('back to a Bayer grain clears the method', t.getDitherScale() === 2 && t._ditherMethod === null);
  t.setDitherScale('4.5');
  check('"4.5" is not 4', t.getDitherScale() === 2);
}

// -- legacy grains still draw the gradient's own Bayer matrices ----------------------------------------------------
{
  let col = 0;
  for (const n of [2, 4, 8]) {
    const x0 = col * 70, y0 = 100;
    col++;
    const tool = freshTool();
    tool.setDitherScale(n);
    draw(tool, x0, y0, x0 + 63, y0 + 15);
    tool.startPoint = { x: x0 + 32, y: y0 + 8 }; tool.endPoint = { x: x0 + 63, y: y0 + 8 };
    let bad = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) {
      const px = x0 + x, py = y0 + y;
      const pos = tool._getGradientPosition(px, py);
      const value = Math.min(63, Math.floor(pos * 64));
      const want = value > Math.max(0, Math.min(63, LEGACY[n][py % n][px % n])) ? 1 : 0;
      if (inkAt(px, py) !== want) bad++;
    }
    check(`legacy grain ${n}: every pixel follows the gradient's own matrix`, bad === 0, `${bad} differ`);
  }
}

// -- a method draws exactly Dither.apply of the gradient grey ------------------------------------------------------
{
  for (const [i, id] of ['atkinson', 'cluster-4', 'threshold-50'].entries()) {
    const x0 = 3 + i * 70, y0 = 130;
    const tool = freshTool();
    tool.setDitherScale(id);
    draw(tool, x0, y0, x0 + 63, y0 + 15);
    tool.startPoint = { x: x0 + 32, y: y0 + 8 }; tool.endPoint = { x: x0 + 63, y: y0 + 8 };
    const gray = new Float64Array(64 * 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) gray[y * 64 + x] = 255 * (1 - tool._getGradientPosition(x0 + x, y0 + y));
    const want = Dither.apply(gray, 64, 16, id, { originX: x0, originY: y0 });
    let bad = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) if (inkAt(x0 + x, y0 + y) !== want[y * 64 + x]) bad++;
    check(`method ${id}: drawn pixels equal Dither.apply of the gradient grey`, bad === 0, `${bad} differ`);
    const left = countInkInRect(x0, y0, x0 + 15, y0 + 15), right = countInkInRect(x0 + 48, y0, x0 + 63, y0 + 15);
    check(`method ${id}: ink grows along the gradient`, right > left, `${left} -> ${right}`);
  }
}

// -- the preview follows the same pixels ---------------------------------------------------------------------------
{
  const tool = freshTool();
  tool.setDitherScale('stucki');
  check('the mask is null for a legacy grain', (() => { const t = freshTool(); t.setDitherScale(4); return t._methodMask({ x: 0, y: 0, width: 4, height: 4 }, false) === null; })());
  tool.startPoint = { x: 0, y: 0 }; tool.endPoint = { x: 31, y: 0 };
  const m = tool._methodMask({ x: 0, y: 200, width: 32, height: 8 }, false);
  check('the mask has one entry per pixel', m && m.length === 32 * 8);
  tool.setDithered(false);
  check('Dithered off: no method mask (hard threshold)', tool._methodMask({ x: 0, y: 0, width: 4, height: 4 }, false) === null);
}

summary();
