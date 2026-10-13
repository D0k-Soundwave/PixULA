'use strict';
/**
 * Times the find-repeated-elements engine (Batch 11A): MapService.captureScreen (flatten the layers), then findElement for a 1 x 1 and a 4 x 4 block in
 * each match mode, on a full screen of the mode, median of 7, two runs back to back. Also the size of the smallest element's record.
 * Usage: node tools/map-find-bench.js
 */
const path = require('path');
const { installStubs, loadModule } = require(path.join(__dirname, '..', 'tests', 'helpers', 'zx-stubs'));
installStubs();
for (const f of ['js/utils/validators.js', 'js/core/event-bus.js', 'js/core/state-manager.js', 'js/core/attribute-system.js']) loadModule(f);
global.document = undefined;
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {}, markAllDirty() {},
  getColorIndex(b, br) { return b === 0 ? 0 : b + (br ? 8 : 0); }, packRGB() { return 0; }, blitCellBits() {}, blitCellIndices() {} };
global.setInterval = () => 0;
for (const f of ['js/core/color-manager.js', 'js/core/layer-manager.js', 'js/utils/map-find.js', 'js/utils/map-codec.js', 'js/services/map-service.js']) loadModule(f);
ColorManager.initialize();

const PATS = [[0, 0, 0, 0, 0, 0, 0, 0], [255, 255, 255, 255, 255, 255, 255, 255], [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C], [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55]];
const median = (f, n = 7) => { const t = []; for (let i = 0; i < n; i++) { const a = process.hrtime.bigint(); f(); t.push(Number(process.hrtime.bigint() - a) / 1e6); } t.sort((a, b) => a - b); return t[n >> 1]; };

for (const mode of ['standard_ula', 'gigascreen', 'timex_hires_giga']) {
  __setActiveScreenMode(mode);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  const lay = LayerManager.getCurrentLayer() || LayerManager.layers[0];
  LayerManager.addLayer();
  const l1 = LayerManager.layers[1];
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
    const c = l1.getCell(cx, cy);
    c.pixels.set(PATS[(cx + cy * 3) % PATS.length]);
    Object.assign(c, { ink: (cx % 7) + 1, paper: cy % 8, bright: false, flash: false, altered: true });
    if (c.pixelsB) c.pixelsB.set(PATS[(cx * 2 + cy) % PATS.length]);
  }
  const out = [];
  for (let run = 0; run < 2; run++) {
    const row = {};
    row.capture = median(() => MapService.captureScreen()).toFixed(1);
    const scr = MapService.captureScreen();
    const table = MapService.colourTable();
    for (const modeName of MapService.findModes()) {
      for (const [w, h] of [[1, 1], [4, 4]]) {
        const block = MapService.sliceBlock(scr, 5, 3, w, h);
        row[`${modeName} ${w}x${h}`] = median(() => MapService.findElement(block, modeName, scr, table)).toFixed(1);
      }
    }
    out.push(row);
  }
  console.log(mode, `${ZX_SPECTRUM.GRID_COLS}x${ZX_SPECTRUM.GRID_ROWS} cells`, JSON.stringify(out));
}

// the smallest element's record, as it is stored
const one = MapFind.make(1, 1, 8, 1);
const rec = JSON.stringify(MapCodec._encodeElement({ name: '', w: 1, h: 1, screens: 1, gridW: 32, gridH: 24, match: 'exact', bitmap: one.bitmap, attrs: one.attrs, positions: [{ x: 0, y: 0 }] }));
console.log('smallest element record:', rec.length, 'bytes; budget left beside the largest map:', MapCodec.MAX_JSON_BYTES - 291879, 'bytes; so', Math.floor((MapCodec.MAX_JSON_BYTES - 291879) / (rec.length + 1)), 'of them');
