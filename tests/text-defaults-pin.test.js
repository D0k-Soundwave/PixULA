'use strict';
/**
 * Batch 10A pin: what the Text tool makes with every OLD option (layout, alignment, direction, mirror, shadow, outline) and
 * where the stamp lands for a click must not change when the new options (shadow direction, anchor, background) arrive at
 * their defaults. One digest over 576 combinations of mask bits and placement; the per-case lines are printed on a mismatch.
 * Recorded from the code BEFORE the 10A changes, so this test passes on the old code by design.
 */
const crypto = require('crypto');
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/mask-ops.js');
global.document = {
  createElement(tag) {
    if (tag !== 'canvas') return null;
    return { width: 0, height: 0, getContext() { return {
      font: '', fillStyle: '#000', textBaseline: 'top', measureText() { return { width: 0 }; }, fillText() {}, clearRect() {},
      getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(0, w) * Math.max(0, h) * 4) }; } }; } };
  }
};
loadModule('js/tools/tool-base.js');
loadModule('js/utils/bitmap-text.js');
loadModule('js/tools/text-tool.js');

let last = null;
global.SelectionService = {
  isFloating() { return last !== null; },
  get floatingPaste() { return last; },
  startFloatingPasteFromMask(pixels, width, height, x, y, label, fontInfo) { last = { pixels, width, height, x, y, fontInfo }; },
  moveStampPreview() {}, refreshTextStamp() {}
};
global.ToolManager = { getCurrentTool: () => null, getTool: () => null };

const tool = new TextTool();
tool.activate();
tool.setText('Hi\nZX');

const lines = [];
const digest = crypto.createHash('sha1');
for (const size of [8, 16]) for (const layout of ['horizontal', 'vertical-down']) for (const align of ['left', 'center', 'right']) {
  for (const dir of [0, 45, 90, 135, 180, 270]) for (const mirror of [false, true]) for (const shadow of [false, true]) for (const outline of [false, true]) {
    tool.setTextSize(size); tool.setTextLayout(layout); tool.setTextAlign(align); tool.setTextDirection(dir);
    tool.setTextMirrorH(mirror); tool.setTextShadow(shadow); tool.setTextOutline(outline);
    last = null;
    tool._createPreviewStamp(100, 80);
    const bits = last ? last.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/') : 'none';
    const line = `${size}|${layout}|${align}|${dir}|${mirror}|${shadow}|${outline}|${last ? last.x + ',' + last.y + ',' + last.width + 'x' + last.height : ''}|${bits}`;
    lines.push(line);
    digest.update(line + '\n');
  }
}
const got = digest.digest('hex');
// RE-RECORDED on purpose in Batch 10C3 (owner asked for the size-jump bug to be fixed). It was 'f6d5874efdfd3abb83c09306d3bea5e2c8df94d0'.
// Why it changed: at Size 16 the first stamp of TWO-LINE or VERTICAL text was made at half size (the scale was Size / block height, so
// every extra line halved it) and only jumped to full size when any option changed. The scale is now Size / the font's cell height.
// Checked: the Size 8 cases alone give the same digest (07e1584a9d5f1f993ff2fff0c4a4636cf24fead7) before and after; only Size 16 moved.
const EXPECTED = '01e53e50d76416759f83c4c26a6921d85f3725fb';
check('576 combinations of the old options still make the same masks at the same places', got === EXPECTED, got);
check('there were 576 of them', lines.length === 576);

summary();
