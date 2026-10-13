'use strict';
/**
 * Batch 10A2 groundwork: a freshly placed text stamp with Shadow and/or Outline used to GROW on its first re-render
 * (a Transform-panel scale of 1, 1): the stamp remembered the size AFTER the effects as its source size, so the re-render
 * stretched the bare letters to that size and applied the effects a second time. Creating and re-rendering at scale 1 must
 * give the same stamp.
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
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');
loadModule('js/tools/tool-base.js');
loadModule('js/utils/bitmap-text.js');
loadModule('js/tools/text-tool.js');

ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);
const tool = new TextTool();
global.ToolManager = { getCurrentTool: () => tool, getTool: (id) => (id === TOOLS.TEXT ? tool : null) };
tool.setText('Hi');
tool.setFontFamily('ZX ROM');
tool.setTextSize(8);

const sig = (fp) => `${fp.width}x${fp.height}:` + fp.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/');
for (const [shadow, outline] of [[false, false], [true, false], [false, true], [true, true]]) {
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  tool.setTextShadow(shadow);
  tool.setTextOutline(outline);
  tool._createPreviewStamp(40, 40);
  const fp = SelectionService.floatingPaste;
  const created = sig(fp);
  SelectionService.setStampScale(1, 1);
  const again = sig(SelectionService.floatingPaste);
  check(`shadow ${shadow} outline ${outline}: re-rendering at scale 1 gives the stamp that was created`, created === again, `${created.split(':')[0]} then ${again.split(':')[0]}`);
}

summary();
