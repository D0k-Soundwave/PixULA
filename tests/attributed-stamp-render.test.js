'use strict';
/**
 * Preview rendering for attributed stamps: _drawFloatingLayerAttributed
 * writes each destination cell's pixels AND its own ink/paper/bright/flash
 * from the stamp's attrs — no inheriting paper from the target layer.
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
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
LayerManager.initialize();

// Give the background layer some paper the stamp must NOT inherit
const bg = LayerManager.layers[0];
bg.setCell(0, 0, { ink: 4, paper: 5, bright: false, flash: false,
  pixels: new Uint8Array(8), altered: true });
bg.setCell(1, 0, { ink: 4, paper: 5, bright: false, flash: false,
  pixels: new Uint8Array(8), altered: true });

// A 16x8 (2 cells) fully-solid attributed stamp: left cell ink 0/paper 7,
// right cell ink 1/paper 2/bright
const mask = Array.from({ length: 8 }, () => Array(16).fill(true));
const attrs = [0x38, (1 << 6) | (2 << 3) | 1]; // 0x38 = paper7 ink0; bright+paper2+ink1

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test preview');
SelectionService.floatingPaste.attrs = attrs;
SelectionService._drawFloatingLayer();
LayerManager.flushPendingCompose();

const stampLayer = SelectionService.floatingPaste.floatingLayer;
const leftCell = stampLayer.getCell(0, 0);
const rightCell = stampLayer.getCell(1, 0);

check('left cell ink from attrs', leftCell.ink === 0);
check('left cell paper from attrs (not inherited 5)', leftCell.paper === 7);
check('left cell bright from attrs', leftCell.bright === false);
check('right cell ink from attrs', rightCell.ink === 1);
check('right cell paper from attrs (not inherited 5)', rightCell.paper === 2);
check('right cell bright from attrs', rightCell.bright === true);
check('left cell pixels fully set', leftCell.pixels.every(b => b === 0xFF));
check('right cell pixels fully set', rightCell.pixels.every(b => b === 0xFF));

summary();
