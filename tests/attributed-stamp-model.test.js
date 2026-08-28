'use strict';
/**
 * Core data-model test for attributed stamps (2026-08-28 design): the
 * `attrs` field on floatingPaste/layer.stamp, cell-grid snapping on move,
 * and the transform no-ops. No rendering here (see the attributed-stamp-
 * render.test.js suites for _drawFloatingLayerAttributed/stampAt/commitStamp).
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

// A 16x8 (2 cells wide, 1 cell tall) attributed stamp
const mask = [
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true)
];
const attrs = [0x38, 0x11]; // left cell: paper 7/ink 0; right cell: paper 2/ink 1

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 5, 5, 'Test attributed stamp');
check('floating paste created', SelectionService.isFloating() === true);
SelectionService.floatingPaste.attrs = attrs;

check('attrs stored', SelectionService.floatingPaste.attrs.length === 2);
check('indices absent on an attrs stamp', SelectionService.floatingPaste.indices == null);

// Cell-grid snap: moving to a non-multiple-of-8 position snaps down
SelectionService.moveFloatingPaste(11, 13);
check('moveFloatingPaste snaps x to a multiple of 8', SelectionService.floatingPaste.x % 8 === 0,
  `got x=${SelectionService.floatingPaste.x}`);
check('moveFloatingPaste snaps y to a multiple of 8', SelectionService.floatingPaste.y % 8 === 0,
  `got y=${SelectionService.floatingPaste.y}`);
check('snap rounds down (11 -> 8)', SelectionService.floatingPaste.x === 8);
check('snap rounds down (13 -> 8)', SelectionService.floatingPaste.y === 8);

// A plain (non-attrs) stamp is NOT snapped
LayerManager.initialize();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 5, 5, 'Test plain stamp');
SelectionService.moveFloatingPaste(11, 13);
check('a plain stamp is not cell-snapped', SelectionService.floatingPaste.x === 11
  && SelectionService.floatingPaste.y === 13);

// Transform no-ops on an attrs stamp
LayerManager.initialize();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test transform guard');
SelectionService.floatingPaste.attrs = attrs;
SelectionService.setStampScale(2, 2);
check('setStampScale is a no-op on an attrs stamp', SelectionService.floatingPaste._scaleX === 1);
SelectionService.setStampRotation(90);
check('setStampRotation is a no-op on an attrs stamp', SelectionService.floatingPaste._rotation === 0);
const widthBefore = SelectionService.floatingPaste.width;
SelectionService.transformStamp('rotate90CW');
check('transformStamp shape-change is a no-op on an attrs stamp',
  SelectionService.floatingPaste.width === widthBefore);
// Shift (reposition) still works on an attrs stamp
SelectionService.transformStamp('shiftRight', 8);
check('transformStamp shift still repositions an attrs stamp', SelectionService.floatingPaste.x === 8);

// endFloatingPaste persists attrs onto layer.stamp; _getStampData returns it
const layer = SelectionService.floatingPaste.floatingLayer;
SelectionService.endFloatingPaste();
check('attrs persisted on layer.stamp', Array.isArray(layer.stamp.attrs) && layer.stamp.attrs.length === 2);

summary();
