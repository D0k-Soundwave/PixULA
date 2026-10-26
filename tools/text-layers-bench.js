'use strict';
/**
 * Times a text stamp re-render (SelectionService.setStampScale) with Same dots vs Opposite dots on a shadow + outline text.
 * Median of 15, two runs. Usage: node tools/text-layers-bench.js
 */
const path = require('path');
const { installStubs, loadModule } = require(path.join(__dirname, '..', 'tests', 'helpers', 'zx-stubs'));
installStubs();
for (const f of ['js/utils/validators.js', 'js/core/event-bus.js', 'js/core/state-manager.js', 'js/core/attribute-system.js']) loadModule(f);
global.document = undefined;
global.CanvasSystem = { setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {}, markAllDirty() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, packRGB() { return 0; }, blitCellBits() {}, blitCellIndices() {} };
global.setInterval = () => 0;
for (const f of ['js/data/zx-rom-font.js', 'js/utils/mask-ops.js', 'js/utils/coverage-ops.js', 'js/core/color-manager.js',
  'js/core/layer-manager.js', 'js/core/pixel-draw-routine.js', 'js/services/undo-redo.js', 'js/services/selection-service.js',
  'js/tools/tool-base.js', 'js/tools/text-tool.js']) loadModule(f);
ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);
const tool = new TextTool();
global.ToolManager = { getCurrentTool: () => tool, getTool: (id) => (id === TOOLS.TEXT ? tool : null) };
tool.setText('Hello world');
tool.setTextSize(16);
tool.setTextShadow(true);
tool.setTextOutline(true);
for (const dots of ['same', 'opposite']) {
    tool.setTextShadowDots(dots);
    tool.setTextOutlineDots(dots);
    const runs = [];
    for (let r = 0; r < 2; r++) {
        const t = [];
        for (let i = 0; i < 15; i++) {
            while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
            tool._createPreviewStamp(40, 40);
            const a = process.hrtime.bigint();
            SelectionService.setStampScale(1.5, 1.5);
            t.push(Number(process.hrtime.bigint() - a) / 1e6);
        }
        t.sort((a, b) => a - b);
        runs.push(t[7].toFixed(1));
    }
    console.log(dots.padEnd(9) + runs.join(' / ') + ' ms');
}
