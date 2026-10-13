'use strict';
/**
 * Batch 10B step 3: the Text tool's Type on canvas session, driven without a browser through the same events the hidden text
 * field sends. Committing typed text must leave what placing the same text as a stamp and committing it leaves (one undo
 * step); Escape leaves nothing; a click elsewhere, a tool switch and a save draw it; New / Open drop it.
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
loadModule('js/utils/snap-grid.js');
loadModule('js/utils/bitmap-text.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/text-typing.js');
loadModule('js/tools/text-tool.js');

// The overlay: record what is previewed instead of drawing
const shown = { plan: null, caret: null };
global.GridOverlay = {
  drawWritesPreview(plan) { shown.plan = plan; }, drawCaret(px) { shown.caret = px; },
  clearCompositePreview() { shown.plan = null; }, clearCursorOverlay() { shown.caret = null; },
  clearFunctionPreview() {}, clearPreview() {}
};
const notices = [];
EventBus.on(EVENTS.STATUS_NOTICE, (d) => notices.push(d.text));
const opens = [];
EventBus.on(EVENTS.TEXT_ENTRY_OPEN, (d) => opens.push(d));
let closed = 0;
EventBus.on(EVENTS.TEXT_ENTRY_CLOSE, () => closed++);

ColorManager.initialize();
const tool = new TextTool();
global.ToolManager = { getCurrentTool: () => tool, getTool: (id) => (id === TOOLS.TEXT ? tool : null) };
tool.setFontFamily('ZX ROM');

function enter(modeId, seed) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  StateManager.setGridSnap(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  const t = LayerManager.layers[1];
  const CH = ZX_SPECTRUM.CELL_HEIGHT;
  for (let cy = 0; cy < Math.ceil(40 / CH); cy++) for (let cx = 0; cx < 6; cx++) {
    const c = t.getCell(cx, cy);
    Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false, altered: true });
    if (c.pixels) c.pixels.fill(seed ? 0xA5 : 0);
    if (c.indices) c.indices.fill(seed ? 3 : -1);
  }
  return t;
}
const snap = (t) => {
  const out = [];
  const CH = ZX_SPECTRUM.CELL_HEIGHT;
  for (let cy = 0; cy < Math.ceil(40 / CH); cy++) for (let cx = 0; cx < 6; cx++) {
    const c = t.getCell(cx, cy);
    out.push([c.ink, c.paper, c.bright, c.flash, c.indices ? Array.from(c.indices).join(',') : Array.from(c.pixels).join(',')].join('/'));
  }
  return out.join('|');
};
const type = (text, caret) => EventBus.emit(EVENTS.TEXT_ENTRY_CHANGED, { text, caret: caret == null ? text.length : caret });
function reset(opts = {}) {
  tool.setTypeOnCanvas(false);
  tool.setTextShadow(!!opts.shadow); tool.setTextShadowDots(opts.shadowDots || 'same'); tool.setTextShadowDir('down-right');
  tool.setTextOutline(false); tool.setTextBackground(opts.background || 'transparent');
  tool.setTextDirection(0); tool.setTextMirrorH(false); tool.setTextAnchor('top-left'); tool.setTextAlign('left');
  tool._fontBold = false; tool._fontItalic = false;
}

// -- commit == the stamp path -----------------------------------------------------------------------------------------------------
const MODES = ['standard_ula', 'multicolor_8x1', 'ula_plus', 'gigascreen', 'timex_hires', 'layer2_256', 'lores'];
const VARIANTS = [
  ['plain', {}, () => {}],
  ['Inverse', {}, () => StateManager.setInverse(true)],
  ['XOR', {}, () => StateManager.setDrawMode('xor')],
  ['Clear background', { background: 'overlap' }, () => {}],
  ['opposite shadow', { shadow: true, shadowDots: 'opposite' }, () => {}]
];
for (const mode of MODES) {
  for (const [label, opts, setup] of VARIANTS) {
    // 16x16 characters, no spacing = the Size 16 stamp (anchored at the click's top-left)
    reset(opts);
    tool.setText('Hi'); tool.setTextSize(16); tool.setTextAnchor('top-left');
    let t = enter(mode, true); setup();
    tool._createPreviewStamp(10, 6);
    SelectionService.commitActiveStamp();
    const viaStamp = snap(LayerManager.layers[1]);

    reset(opts);
    tool.setTypeOnCanvas(true); tool.setCharWidth(16); tool.setCharHeight(16); tool.setCharSpacing(0); tool.setLineSpacing(0);
    t = enter(mode, true); setup();
    const undoBefore = UndoRedo.getUndoCount();
    tool.onPointerDown(10, 6, { button: 0 });
    type('Hi');
    check(`${mode} / ${label}: a session is open and the preview shows writes`, tool.hasPending && shown.plan && shown.plan.length > 0);
    tool.commitPending();
    check(`${mode} / ${label}: Enter leaves what the committed stamp leaves`, snap(LayerManager.layers[1]) === viaStamp);
    check(`${mode} / ${label}: ...in one undo step, session closed`, UndoRedo.getUndoCount() === undoBefore + 1 && !tool.hasPending);
    StateManager.setInverse(false); StateManager.setDrawMode('normal');
  }
}

// -- stretched size, spacing, two lines ---------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true); tool.setCharWidth(5); tool.setCharHeight(11); tool.setCharSpacing(2); tool.setLineSpacing(1);
  enter('standard_ula', false);
  tool.onPointerDown(20, 4, { button: 0 });
  type('ab\ncd');
  const b = tool._typing.build();
  check('stretched layout: 2 chars of 5 + 2 gap = 12 wide, two lines of 11 + 1 gap = 23 tall', b.lay.width === 12 && b.lay.height === 23, `${b.lay.width}x${b.lay.height}`);
  check('the mask is placed so the first letter sits on the click', b.data.x === 20 && b.data.y === 4);
  tool.commitPending();
}

// -- Escape -----------------------------------------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true); tool.setCharWidth(8); tool.setCharHeight(8);
  const t = enter('standard_ula', true);
  const before = snap(t), undo = UndoRedo.getUndoCount();
  tool.onPointerDown(10, 10, { button: 0 });
  type('Cancel me');
  closed = 0;
  tool.cancelPending();
  check('Escape: nothing drawn, no undo entry, session closed, field told to let go', snap(t) === before && UndoRedo.getUndoCount() === undo && !tool.hasPending && closed === 1);
  check('...and the preview is taken down', shown.plan === null && shown.caret === null);
  tool.onPointerDown(10, 10, { button: 0 });
  type('x');
  tool.onPointerDown(30, 30, { button: 2 });
  check('a right-click also cancels', !tool.hasPending);
}

// -- click elsewhere, switch tool, save ----------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true);
  let t = enter('standard_ula', false);
  const undo = UndoRedo.getUndoCount();
  tool.onPointerDown(8, 8, { button: 0 });
  type('AB');
  tool.onPointerDown(100, 100, { button: 0 });
  check('a click elsewhere draws the text and opens a new session there', UndoRedo.getUndoCount() === undo + 1 && tool.hasPending && tool._typing.x === 100 && tool._typing.text === '');
  check('...with the first text really drawn', Array.from(t.getCell(1, 1).pixels).some(Boolean));
  tool.cancelPending();

  tool.onPointerDown(8, 8, { button: 0 });
  type('C');
  const u2 = UndoRedo.getUndoCount();
  tool.deactivate();
  check('switching tool draws what is typed', UndoRedo.getUndoCount() === u2 + 1 && !tool.hasPending);

  tool.onPointerDown(8, 8, { button: 0 });
  type('D');
  const u3 = UndoRedo.getUndoCount();
  tool.commitPending();
  check('save (commitPending) draws it', UndoRedo.getUndoCount() === u3 + 1);

  tool.onPointerDown(8, 8, { button: 0 });
  type('E');
  EventBus.emit(EVENTS.FILE_NEW);
  check('New drops it', !tool.hasPending);
  tool.onPointerDown(8, 8, { button: 0 });
  type('F');
  EventBus.emit(EVENTS.SCREEN_MODE_CHANGED, {});
  check('a screen-mode change keeps it waiting', tool.hasPending && tool._typing.text === 'F');
  tool.cancelPending();
}

// -- a press on the text moves the caret ------------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true); tool.setCharWidth(8); tool.setCharHeight(8);
  enter('standard_ula', false);
  tool.onPointerDown(16, 16, { button: 0 });
  type('abcd');
  opens.length = 0;
  tool.onPointerDown(16 + 8 * 2 + 1, 18, { button: 0 });
  check('a press inside the text puts the caret between the letters nearest to it (no new session)', tool._typing.caret === 2 && tool._typing.x === 16 && opens.length === 1 && opens[0].caret === 2, String(tool._typing.caret));
  tool.cancelPending();
}

// -- nowhere to draw ----------------------------------------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true);
  const t = enter('standard_ula', true);
  tool.onPointerDown(8, 8, { button: 0 });
  type('Z');
  t.locked = true;
  notices.length = 0;
  const before = snap(t), undo = UndoRedo.getUndoCount();
  tool.commitPending();
  check('a locked layer: nothing written, no undo entry, the session stays open, and it says why',
    snap(t) === before && UndoRedo.getUndoCount() === undo && tool.hasPending && notices.some(n => /layer/i.test(n)));
  t.locked = false;
  tool.cancelPending();
}

// -- characters the font does not have -------------------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true);
  enter('standard_ula', false);
  tool.onPointerDown(8, 8, { button: 0 });
  notices.length = 0;
  type('aéb');
  check('a character the font lacks is refused with a notice, and the rest kept', tool._typing.text === 'ab' && notices.some(n => /é/.test(n)), tool._typing.text);
  tool.cancelPending();
}

// -- Snap: the press drops to the snap cell ----------------------------------------------------------------------------------------------------
{
  reset();
  tool.setTypeOnCanvas(true);
  enter('standard_ula', false);
  StateManager.setGridSnap(true);
  StateManager.setGridSnapStep({ kind: 'cell' });
  check('with Type on canvas the pointer is not pre-rounded (the tool floors the press)', tool.snapsPointer === false);
  tool.onPointerDown(21, 19, { button: 0 });
  check('Snap on: the first letter sits on the cell the press fell in', tool._typing.x === 16 && tool._typing.y === 16);
  tool.cancelPending();
  StateManager.setGridSnap(false);
}

// -- options, fonts, the old flow -----------------------------------------------------------------------------------------------------------------
{
  reset();
  tool.setFontFamily('Arial');
  notices.length = 0;
  tool.setTypeOnCanvas(true);
  check('a system font cannot Type on canvas: refused with a notice', tool.getTypeOnCanvas() === false && notices.some(n => /bitmap/i.test(n)));
  tool.setFontFamily('ZX ROM');
  check('width, height and spacing are clamped', (tool.setCharWidth(999), tool.getCharWidth() === 64) && (tool.setCharHeight(0), tool.getCharHeight() === 1) &&
    (tool.setCharSpacing(-99), tool.getCharSpacing() === -8) && (tool.setLineSpacing(99), tool.getLineSpacing() === 32));
  tool.setCharWidth(8); tool.setCharHeight(8); tool.setCharSpacing(0); tool.setLineSpacing(0);
  tool.setTypeOnCanvas(false);
  check('Type on canvas off: the click makes the stamp again (the old flow)', (() => {
    enter('standard_ula', false);
    tool.setText('Hi');
    tool.onPointerDown(30, 30, { button: 0 });
    const ok = SelectionService.isFloating() && !tool.hasPending;
    while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
    return ok;
  })());
  enter('standard_ula', false);
  tool.setText('Hi');
  tool.setTextSize(16);
  tool._createPreviewStamp(40, 40);
  check('(a text stamp of the tool is waiting)', tool._ownStampFloating());
  tool.setTypeOnCanvas(true);
  check("turning Type on canvas on takes the tool's own waiting stamp away", !SelectionService.isFloating());
  tool.setTypeOnCanvas(false);
}

summary();
