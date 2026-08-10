'use strict';
/**
 * The drawing guide (clip): a region that confines every tool's marks.
 *
 * Hooked ONCE in PixelDrawRoutine.draw(), so containment is a property of the
 * gate rather than of each tool. Loads the REAL core stack plus the real brush
 * tool and verifies:
 *  - writes inside the region land, writes outside are dropped
 *  - an irregular mask (bbox + mask[ry][rx]) is honoured pixel-for-pixel
 *  - a null mask means the whole rectangle counts
 *  - a whole brush stroke through the real tool is confined
 *  - the guide is inert when the toggle is off or nothing is selected
 *  - suspendStrokeHooks()/suspendMirror() and options.clip === false exempt
 *    service writes (transforms, paste commits — they must write exactly the
 *    pixels they compute)
 *  - symmetry and the guide compose: each mirrored counterpart is judged on
 *    its own position
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
// The guide reads the live selection, so the stub IS the region under test.
global.SelectionService = {
  _sel: null,
  isFloating() { return false; },
  hasSelection() { return this._sel !== null; },
  getSelection() { return this._sel; },
  getSelectionState() { return null; }, restoreSelectionState() {}, clear() { this._sel = null; }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
UndoRedo.initialize();
BrushEngine.initialize();

const color = ColorManager.getCurrentSelection();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
// Suspended so the wipe itself is never confined by the guide under test.
const clearAll = () => {
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
};
const setGuide = (sel, on = true) => {
  SelectionService._sel = sel;
  StateManager.setClipMode(on === true ? 'inside' : (on || 'off'));
};

// ── State plumbing ──────────────────────────────────────────────────────────

StateManager.setClipMode('inside');
check('state: guide mode set/get', StateManager.getClipMode() === 'inside');
StateManager.setClipMode('outside');
check('state: guide mode takes the protect polarity', StateManager.getClipMode() === 'outside');
StateManager.setClipMode('bogus');
check('state: an invalid mode is coerced to off', StateManager.getClipMode() === 'off');

// ── Inert when off / nothing selected ───────────────────────────────────────

setGuide({ x: 10, y: 10, width: 4, height: 4, mask: null }, 'off');
check('guide off: isClipped is false everywhere', !PixelDrawRoutine.isClipped(200, 150));

setGuide(null, true);
check('guide on but no selection: isClipped is false', !PixelDrawRoutine.isClipped(200, 150));

clearAll();
PixelDrawRoutine.draw(200, 150, color, DRAW_MODE.NORMAL);
check('guide on with no selection does not block drawing', isInk(200, 150));

// ── A plain rectangle (mask === null) confines writes ────────────────────────

clearAll();
setGuide({ x: 40, y: 40, width: 8, height: 8, mask: null }, true);

check('rect guide: inside is not clipped', !PixelDrawRoutine.isClipped(43, 43));
check('rect guide: outside is clipped', PixelDrawRoutine.isClipped(60, 60));
check('rect guide: just past the right edge is clipped', PixelDrawRoutine.isClipped(48, 43));
check('rect guide: last column inside is not clipped', !PixelDrawRoutine.isClipped(47, 47));

PixelDrawRoutine.draw(43, 43, color, DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(60, 60, color, DRAW_MODE.NORMAL);
check('rect guide: write inside lands', isInk(43, 43));
check('rect guide: write outside is dropped', !isInk(60, 60));

// ── An irregular mask is honoured pixel-for-pixel ───────────────────────────
//
// A 4x4 region whose mask is a diagonal: only (0,0), (1,1), (2,2), (3,3) count.

clearAll();
const diag = Array.from({ length: 4 }, (_, ry) =>
  Array.from({ length: 4 }, (_, rx) => rx === ry));
setGuide({ x: 100, y: 100, width: 4, height: 4, mask: diag }, true);

let maskOk = true;
for (let ry = 0; ry < 4; ry++) {
  for (let rx = 0; rx < 4; rx++) {
    const blocked = PixelDrawRoutine.isClipped(100 + rx, 100 + ry);
    if (blocked === (rx === ry)) maskOk = false;   // on-diagonal must be allowed
  }
}
check('mask guide: every cell agrees with mask[ry][rx]', maskOk);

PixelDrawRoutine.draw(101, 101, color, DRAW_MODE.NORMAL);   // on the diagonal
PixelDrawRoutine.draw(101, 102, color, DRAW_MODE.NORMAL);   // off it
check('mask guide: on-mask write lands', isInk(101, 101));
check('mask guide: off-mask write is dropped', !isInk(101, 102));

// ── A real brush stroke is confined ─────────────────────────────────────────

clearAll();
setGuide({ x: 60, y: 60, width: 10, height: 10, mask: null }, true);

const brush = new global.BrushTool();
brush.setBrushType('round');
brush.setSize(8);
BrushEngine.startDrawingSession();
BrushEngine.applyBrush(65, 65, 1.0, true);      // centred in the region, size spills out

let strayed = false;
let landedInside = false;
for (let y = 50; y < 82; y++) {
  for (let x = 50; x < 82; x++) {
    if (!isInk(x, y)) continue;
    const inside = x >= 60 && x < 70 && y >= 60 && y < 70;
    if (inside) landedInside = true; else strayed = true;
  }
}
check('brush stroke: ink landed inside the region', landedInside);
check('brush stroke: no ink escaped the region', !strayed);

// ── Service writes are exempt ───────────────────────────────────────────────

clearAll();
setGuide({ x: 60, y: 60, width: 4, height: 4, mask: null }, true);

PixelDrawRoutine.suspendStrokeHooks(() => {
  PixelDrawRoutine.draw(120, 120, color, DRAW_MODE.NORMAL);
});
check('suspendStrokeHooks: writes outside the region land', isInk(120, 120));

clearAll();
PixelDrawRoutine.suspendMirror(() => {
  PixelDrawRoutine.draw(121, 121, color, DRAW_MODE.NORMAL);
});
check('suspendMirror (historical name) exempts the guide too', isInk(121, 121));

clearAll();
PixelDrawRoutine.draw(122, 122, color, DRAW_MODE.NORMAL, { clip: false });
check('options.clip === false exempts a single write', isInk(122, 122));

clearAll();
PixelDrawRoutine.draw(123, 123, color, DRAW_MODE.NORMAL);
check('the exemption is not sticky (depth restored)', !isInk(123, 123));

// ── Symmetry composes with the guide ────────────────────────────────────────
//
// Each write is judged on its own position, so a mirrored counterpart that
// lands inside the region is drawn even when its source was outside.

clearAll();
const W = ACTIVE_SCREEN_MODE.width;
const srcX = 20, mirX = W - 1 - srcX;
setGuide({ x: mirX - 2, y: 98, width: 5, height: 5, mask: null }, true);
StateManager.setSymmetryMode('h');

PixelDrawRoutine.draw(srcX, 100, color, DRAW_MODE.NORMAL);
check('symmetry + guide: source outside the region is dropped', !isInk(srcX, 100));
check('symmetry + guide: its mirror inside the region is drawn', isInk(mirX, 100));

StateManager.setSymmetryMode('off');

// ── 'outside' is the frisket: the region is PROTECTED, not confined ─────────
//
// The polarity that lets you shade AROUND an object rather than within it.

clearAll();
setGuide({ x: 40, y: 40, width: 8, height: 8, mask: null }, 'outside');

check('protect: inside the region is now clipped', PixelDrawRoutine.isClipped(43, 43));
check('protect: outside the region is now free', !PixelDrawRoutine.isClipped(90, 90));

PixelDrawRoutine.draw(43, 43, color, DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(90, 90, color, DRAW_MODE.NORMAL);
check('protect: the region keeps its content', !isInk(43, 43));
check('protect: everywhere else paints', isInk(90, 90));

// The two polarities are exact complements over the whole canvas.
{
  const region = { x: 100, y: 60, width: 6, height: 6, mask: null };
  let complementary = true;
  SelectionService._sel = region;
  for (const [x, y] of [[102, 62], [99, 62], [105, 65], [106, 66], [0, 0], [200, 150]]) {
    StateManager.setClipMode('inside');
    const a = PixelDrawRoutine.isClipped(x, y);
    StateManager.setClipMode('outside');
    const b = PixelDrawRoutine.isClipped(x, y);
    if (a === b) complementary = false;
  }
  check('inside and outside are exact complements', complementary);
}

// An irregular mask inverts pixel-for-pixel too, not just its bounding box.
clearAll();
setGuide({ x: 100, y: 100, width: 4, height: 4, mask: diag }, 'outside');
check('protect: an on-mask pixel is blocked', PixelDrawRoutine.isClipped(101, 101));
check('protect: an off-mask pixel inside the bbox is free',
  !PixelDrawRoutine.isClipped(101, 102));

StateManager.setClipMode('off');
SelectionService._sel = null;

summary();
