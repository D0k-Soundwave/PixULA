'use strict';
/**
 * Times LayerManager.cropToCells at layer2_640 with 32 drawing layers (the biggest grid: 80 x 32 cells each), median of 7, two runs.
 * Usage: node tools/crop-bench.js
 */
const path = require('path');
const { installStubs, loadModule } = require(path.join(__dirname, '..', 'tests', 'helpers', 'zx-stubs'));
installStubs();
for (const f of ['js/utils/validators.js', 'js/core/event-bus.js', 'js/core/state-manager.js', 'js/core/attribute-system.js']) loadModule(f);
global.document = undefined;
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {}, markAllDirty() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, packRGB() { return 0; }, blitCellBits() {}, blitCellIndices() {} };
global.setInterval = () => 0;
for (const f of ['js/core/color-manager.js', 'js/core/layer-manager.js', 'js/core/pixel-draw-routine.js']) loadModule(f);
ColorManager.initialize();
__setActiveScreenMode('layer2_640');
const times = [];
for (let run = 0; run < 2; run++) {
  const t = [];
  for (let i = 0; i < 7; i++) {
    LayerManager.initialize();
    for (let l = 0; l < 32; l++) LayerManager.addLayer();
    const a = process.hrtime.bigint();
    LayerManager.cropToCells(10, 5, 40, 20);
    t.push(Number(process.hrtime.bigint() - a) / 1e6);
  }
  t.sort((a, b) => a - b);
  times.push(t[3].toFixed(1));
}
console.log('cropToCells layer2_640, 32 layers, median of 7, two runs (ms):', times.join(' / '));
