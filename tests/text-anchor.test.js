'use strict';
/**
 * Batch 10A: where the click puts the text block. A nine-way Anchor (top-left ... bottom-right), Centre by default - today's
 * behaviour. The finished box (after outline, shadow, Direction and warp) is what is anchored.
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
loadModule('js/tools/text-tool.js');

ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer();
LayerManager.setCurrentLayer(1);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- the offsets ---------------------------------------------------------------------------------------------------
const ANCHORS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
check('anchorOffset: left and top are 0 for any size', [1, 7, 8, 33].every(n => MaskOps.anchorOffset('top-left', n, n).x === 0 && MaskOps.anchorOffset('top-left', n, n).y === 0));
check('anchorOffset: centre is floor(n/2), exactly the old rule', [1, 7, 8, 33].every(n => eq(MaskOps.anchorOffset('center', n, n + 2), { x: Math.floor(n / 2), y: Math.floor((n + 2) / 2) })));
check('anchorOffset: right and bottom are the last column and row', eq(MaskOps.anchorOffset('bottom-right', 10, 6), { x: 9, y: 5 }));
check('anchorOffset: the middle of an edge', eq(MaskOps.anchorOffset('top', 10, 6), { x: 5, y: 0 }) && eq(MaskOps.anchorOffset('left', 10, 6), { x: 0, y: 3 }));
check('anchorOffset: unknown or missing is the centre', eq(MaskOps.anchorOffset('nope', 10, 6), { x: 5, y: 3 }) && eq(MaskOps.anchorOffset(undefined, 10, 6), { x: 5, y: 3 }));
check('the tool lists all nine', eq(TextTool.ANCHORS.map(a => a.id), ANCHORS));

// -- a text stamp lands where the anchor says --------------------------------------------------------------------------
const tool = new TextTool();
tool.setText('Hi');
tool.setFontFamily('ZX ROM');
tool.setTextSize(16);
const placed = (anchor, click) => {
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  tool.setTextAnchor(anchor);
  tool._createPreviewStamp(click.x, click.y);
  const fp = SelectionService.floatingPaste;
  return fp ? { x: fp.x, y: fp.y, w: fp.width, h: fp.height } : null;
};
{
  const c = placed('center', { x: 100, y: 80 });
  check('centre: as before (x - floor(w/2))', c && c.x === 100 - Math.floor(c.w / 2) && c.y === 80 - Math.floor(c.h / 2));
  const tl = placed('top-left', { x: 100, y: 80 });
  check('top-left: the click is the top-left pixel of the box', tl.x === 100 && tl.y === 80);
  const br = placed('bottom-right', { x: 100, y: 80 });
  check('bottom-right: the click is the bottom-right pixel', br.x + br.w - 1 === 100 && br.y + br.h - 1 === 80);
  const t = placed('top', { x: 100, y: 80 });
  check('top: horizontally centred, top edge on the click', t.x === 100 - Math.floor(t.w / 2) && t.y === 80);
  const l = placed('left', { x: 100, y: 80 });
  check('left: left edge on the click, vertically centred', l.x === 100 && l.y === 80 - Math.floor(l.h / 2));
  tool.setTextDirection(90);
  const turned = placed('top-left', { x: 100, y: 80 });
  check('a turned block is anchored by its finished (turned) box', turned.x === 100 && turned.y === 80 && turned.w < turned.h);
  tool.setTextDirection(0);
}

// -- following the pointer ---------------------------------------------------------------------------------------------
{
  placed('bottom-right', { x: 50, y: 50 });
  SelectionService.moveStampPreview(120, 90);
  const fp = SelectionService.floatingPaste;
  check('moveStampPreview keeps the anchor on the pointer', fp.x + fp.width - 1 === 120 && fp.y + fp.height - 1 === 90);
  placed('top-left', { x: 50, y: 50 });
  SelectionService.moveStampPreview(120, 90);
  check('...top-left too', SelectionService.floatingPaste.x === 120 && SelectionService.floatingPaste.y === 90);
}

// -- growing the text keeps the anchor point ----------------------------------------------------------------------------
{
  placed('top-left', { x: 60, y: 40 });
  tool.setText('Hi there');
  const fp = SelectionService.floatingPaste;
  check('typing more keeps a top-left text on its anchor', fp.x === 60 && fp.y === 40, `${fp.x},${fp.y}`);
  placed('bottom-right', { x: 160, y: 140 });
  tool.setText('Hi');
  const g = SelectionService.floatingPaste;
  check('...and a bottom-right text on its anchor', g.x + g.width - 1 === 160 && g.y + g.height - 1 === 140);
  placed('center', { x: 100, y: 100 });
  const c0 = SelectionService.floatingPaste;
  const cxBefore = c0.x + Math.floor(c0.width / 2);
  tool.setText('Hi there');
  const c1 = SelectionService.floatingPaste;
  check('...a centre text keeps its centre (as before)', c1.x + Math.floor(c1.width / 2) === cxBefore);
}

// -- other stamps stay centred --------------------------------------------------------------------------------------------
{
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  SelectionService.startFloatingPasteFromMask(Array.from({ length: 6 }, () => Array(10).fill(true)), 10, 6, 0, 0, 'Paste', null, 'none');
  SelectionService.moveStampPreview(100, 80);
  const fp = SelectionService.floatingPaste;
  check('a pasted piece (no fontInfo) is still centred on the pointer', fp.x === 95 && fp.y === 77);
}

summary();
