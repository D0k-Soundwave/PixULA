'use strict';
/**
 * Commit rendering for attributed stamps: stampAt/commitStamp bake each
 * cell's own attrs into the target layer through PixelDrawRoutine (gate-
 * respecting), not the plain "stamp ink, inherited paper" ink-only path.
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
  // The compositor's fast path, added to main after this branch was cut:
  // LayerManager blits a whole cell at once rather than making 64 validated
  // setPixel calls, and packs its two colours outside the pixel loop. These
  // suites are the first to reach it from a stub, so they are the first that
  // have to carry it.
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
LayerManager.initialize();
LayerManager.addLayer(); // a real drawing layer under the stamp

const mask = Array.from({ length: 8 }, () => Array(16).fill(true));
const attrs = [0x38, (1 << 6) | (2 << 3) | 1];

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test commit');
SelectionService.floatingPaste.attrs = attrs;
const stampLayer = SelectionService.floatingPaste.floatingLayer;

LayerManager.setCurrentLayer(1); // select the drawing layer as the active target
const committed = SelectionService.commitStamp(stampLayer);
check('commitStamp reports success', committed === true);

const targetLayer = LayerManager.layers[1];
const leftCell = targetLayer.getCell(0, 0);
const rightCell = targetLayer.getCell(1, 0);
check('committed left cell ink', leftCell.ink === 0);
check('committed left cell paper', leftCell.paper === 7);
check('committed right cell ink', rightCell.ink === 1);
check('committed right cell paper', rightCell.paper === 2);
check('committed right cell bright', rightCell.bright === true);
check('stamp layer removed after commit',
  LayerManager.layers.indexOf(stampLayer) === -1);

// stampAt (repeat-placement, brush mode) — same attrs baked, layer stays
LayerManager.initialize();
LayerManager.addLayer();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test stampAt');
SelectionService.floatingPaste.attrs = attrs;
SelectionService.floatingPaste.floatingLayer.isStamp = true; // stampAt requires isStamp
LayerManager.setCurrentLayer(1);
SelectionService.stampAt(SelectionService.floatingPaste.floatingLayer);
const target2 = LayerManager.layers[1];
check('stampAt bakes left cell ink', target2.getCell(0, 0).ink === 0);
check('stampAt bakes right cell paper', target2.getCell(1, 0).paper === 2);
check('stampAt does not remove the stamp layer (repeatable placement)',
  LayerManager.layers.indexOf(SelectionService.floatingPaste.floatingLayer) !== -1);

// A coloured stamp cell with no set dots still places its OWN ink (the
// show-through switches are off), so dots already in the picture there take
// the stamp's ink - not the background's. With Inverse on the same holds:
// the set dots clear and the empty cell still takes all four colours.
for (const inverse of [false, true]) {
  LayerManager.initialize();
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  // Background dots in cell (1,0): ink 4 paper 1, top half of each row.
  for (let ly = 0; ly < 8; ly++) {
    for (let lx = 0; lx < 4; lx++) {
      PixelDrawRoutine.draw(8 + lx, ly, { ink: 4, paper: 1, bright: false, flash: false },
        DRAW_MODE.NORMAL, { mirror: false });
    }
  }
  // Left cell has dots, right cell has none.
  const halfMask = Array.from({ length: 8 }, () => Array.from({ length: 16 }, (_, i) => i < 8));
  SelectionService.startFloatingPasteFromMask(halfMask, 16, 8, 0, 0, 'Test empty cell');
  SelectionService.floatingPaste.attrs = [(1 << 6) | (6 << 3) | 1, (1 << 7) | (5 << 3) | 2];
  StateManager.setInverse(inverse);
  LayerManager.setCurrentLayer(1);
  SelectionService.commitStamp(SelectionService.floatingPaste.floatingLayer);
  StateManager.setInverse(false);
  const c = LayerManager.layers[1].getCell(1, 0);
  const tag = inverse ? 'inverse: ' : '';
  check(`${tag}empty stamp cell places its own ink`, c.ink === 2, `ink ${c.ink}`);
  check(`${tag}empty stamp cell places its own paper`, c.paper === 5, `paper ${c.paper}`);
  check(`${tag}empty stamp cell places its own flash and bright`, c.flash === true && c.bright === false);
  check(`${tag}empty stamp cell leaves the dots under it`, c.pixels[0] === 0xF0, `row0 ${c.pixels[0]}`);
}

summary();
