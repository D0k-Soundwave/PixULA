'use strict';
/**
 * PixelDrawRoutine.strokeTargets (Batch 7 part 7A): the read-only twin of draw()'s bounds, symmetry and drawing-guide
 * clip, used so a live preview shows what the commit will leave. Checked against what draw() really writes.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');
global.document = undefined;
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;
let region = null;
global.SelectionService = { getSelection() { return region; }, hasSelection() { return !!region; }, isFloating() { return false; }, engagedStamp() { return null; } };
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);

const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
const key = (p) => p.y * W + p.x;
const written = () => {
  const out = new Set();
  const layer = LayerManager.getCurrentLayer();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = layer.getCell(Math.floor(x / 8), Math.floor(y / 8));
    if (c && c.altered && ((c.pixels[y % 8] >> (7 - (x % 8))) & 1)) out.add(y * W + x);
  }
  return out;
};
const sel = { ink: 2, paper: 7, bright: false, flash: false };
const sameSet = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

const line = [];
for (let x = 20; x <= 100; x++) line.push({ x, y: 40 + (x >> 3) });
line.push({ x: -5, y: 3 }, { x: 300, y: 300 });                   // off-canvas points are ignored

function run(label, symmetry, clipMode, clip) {
  StateManager.setSymmetryMode(symmetry);
  StateManager.setClipMode(clipMode);
  region = clip;
  LayerManager.initialize();
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  const predicted = new Set(PixelDrawRoutine.strokeTargets(line).pixels.map(key));
  PixelDrawRoutine.beginBatch();
  for (const p of line) PixelDrawRoutine.draw(p.x, p.y, sel, DRAW_MODE.NORMAL);
  PixelDrawRoutine.endBatch();
  check(label, sameSet(predicted, written()), `${predicted.size} vs ${written().size}`);
}

run('no symmetry, no guide', 'off', 'off', null);
run('mirror h', 'h', 'off', null);
run('mirror v', 'v', 'off', null);
run('mirror quad', 'quad', 'off', null);
run('guide inside', 'off', 'inside', { x: 30, y: 30, width: 40, height: 20, mask: null });
run('guide outside', 'off', 'outside', { x: 30, y: 30, width: 40, height: 20, mask: null });
run('mirror quad with a guide inside (each copy is judged on its own position)', 'quad', 'inside', { x: 0, y: 0, width: 128, height: 96, mask: null });
run('a lasso-shaped guide', 'h', 'inside', { x: 20, y: 30, width: 4, height: 4, mask: [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 1, 1], [0, 0, 0, 0]] });

StateManager.setSymmetryMode('off');
StateManager.setClipMode('off');
region = null;

// colour core follows its source through the mirror
{
  StateManager.setSymmetryMode('h');
  LayerManager.initialize();
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  const r = PixelDrawRoutine.strokeTargets([{ x: 10, y: 10 }, { x: 12, y: 10 }], (x) => x === 10);
  check('a mirrored copy is core when its source is', r.isCore(10, 10) === true && r.isCore(W - 1 - 10, 10) === true);
  check('and not when its source is not', r.isCore(12, 10) === false && r.isCore(W - 1 - 12, 10) === false);
  check('no predicate in, none out', PixelDrawRoutine.strokeTargets([{ x: 1, y: 1 }]).isCore === null);
  StateManager.setSymmetryMode('off');
}

// a locked layer takes nothing
{
  LayerManager.getCurrentLayer().locked = true;
  check('a locked layer: nothing', PixelDrawRoutine.strokeTargets(line).pixels.length === 0);
  LayerManager.getCurrentLayer().locked = false;
}

summary();
