'use strict';
/**
 * Batch 10A2: a stamp can carry CLEAR dots of its own (a text stamp's opposite-dot shade / contour), written as the opposite
 * of the draw mode in force. Checked in the write plans (classic, indexed), through the Text tool, the stamp transforms, the
 * re-render at scale, the floating-state undo copy, and the saved form (key only when present, byte-identical otherwise).
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
loadModule('js/services/transform-service.js');

ColorManager.initialize();
const tool = new TextTool();
global.ToolManager = { getCurrentTool: () => tool, getTool: (id) => (id === TOOLS.TEXT ? tool : null) };
tool.setText('A');
tool.setFontFamily('ZX ROM');
tool.setTextSize(8);
tool.setTextAnchor('top-left');

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function enter(modeId, seed) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  ColorManager.setInk(2); ColorManager.setPaper(5);
  ColorManager.setBright(false); ColorManager.setFlash(false);
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  const target = LayerManager.layers[1];
  const CHh = ZX_SPECTRUM.CELL_HEIGHT;
  for (let cy = 0; cy < Math.ceil(16 / CHh); cy++) for (let cx = 0; cx < 2; cx++) {
    const c = target.getCell(cx, cy);
    Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false, altered: true });
    if (c.pixels) c.pixels.fill(seed ? 0xFF : 0x00);
    if (c.indices) c.indices.fill(3);
  }
  return target;
}
const dotAt = (target, x, y) => {
  const CHh = ZX_SPECTRUM.CELL_HEIGHT;
  const c = target.getCell(x >> 3, Math.floor(y / CHh));
  if (c.indices) return c.indices[(y % CHh) * 8 + (x & 7)];
  return (c.pixels[y % CHh] >> (7 - (x & 7))) & 1;
};
function place(tgt) {
  tool._createPreviewStamp(0, 0);
  const fp = SelectionService.floatingPaste;
  const layers = { set: fp.pixels, clear: fp.clearMask };
  const stamp = fp.floatingLayer;
  stamp.isStamp = true;
  LayerManager.setCurrentLayer(1);
  SelectionService.commitStamp(stamp);
  return layers;
}

tool.setTextShadow(true);
tool.setTextShadowDir('down-right');
tool.setTextShadowDots('opposite');

// -- the Text tool makes a clear mask --------------------------------------------------------------------------------------
{
  enter('standard_ula', true);
  tool._createPreviewStamp(0, 0);
  const fp = SelectionService.floatingPaste;
  check('an opposite shadow gives the stamp a clear mask of the same size', fp.clearMask && fp.clearMask.length === fp.pixels.length && fp.clearMask[0].length === fp.pixels[0].length);
  let overlap = false;
  for (let y = 0; y < fp.pixels.length; y++) for (let x = 0; x < fp.pixels[0].length; x++) if (fp.pixels[y][x] && fp.clearMask[y][x]) overlap = true;
  check('...which never overlaps the set dots', !overlap);
  tool.setTextShadowDots('same');
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  tool._createPreviewStamp(0, 0);
  check('Same dots: no clear mask at all (so default stamps are unchanged)', !('clearMask' in SelectionService.floatingPaste));
  tool.setTextShadowDots('opposite');
}

// -- committing, Normal: the shade is CLEARED, the letters SET, the rest of a solid cell stays ---------------------------
{
  const t = enter('standard_ula', true);
  const L = place(t);
  let bad = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inBox = y < L.set.length && x < L.set[0].length;
    const want = inBox && L.clear && L.clear[y][x] ? 0 : 1;      // solid cell: letters set (1), shade cleared (0), rest stays 1
    if (dotAt(t, x, y) !== want) bad++;
  }
  check('Normal on a solid cell: shade cleared, letters set, everything else untouched', bad === 0, `${bad} wrong`);
  check('...and the shade really has dots to clear', L.clear && L.clear.some(r => r.some(Boolean)));
}
// -- Inverse: letters RESET, shade SET ---------------------------------------------------------------------------------------
{
  const t = enter('standard_ula', false);
  StateManager.setInverse(true);
  const L = place(t);
  let bad = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inBox = y < L.set.length && x < L.set[0].length;
    const want = inBox && L.clear && L.clear[y][x] ? 1 : 0;      // empty cell: letters reset (stay 0), shade set (1)
    if (dotAt(t, x, y) !== want) bad++;
  }
  check('Inverse on an empty cell: letters reset, the shade is SET (white text, black shade the other way round)', bad === 0, `${bad} wrong`);
  StateManager.setInverse(false);
}
// -- modes with no opposite draw no shade ------------------------------------------------------------------------------------
for (const dm of ['ink', 'paper', 'xor']) {
  const t = enter('standard_ula', true);
  StateManager.setDrawMode(dm);
  const L = place(t);
  let shadeTouched = 0;
  for (let y = 0; y < L.set.length; y++) for (let x = 0; x < L.set[0].length; x++) {
    if (L.clear && L.clear[y][x] && dotAt(t, x, y) !== 1) shadeTouched++;
  }
  check(`draw mode "${dm}": the shade is not drawn (it has no opposite)`, shadeTouched === 0);
  StateManager.setDrawMode('normal');
}
// -- every mode ----------------------------------------------------------------------------------------------------------------
for (const mode of ['multicolor_8x1', 'multicolor_8x4', 'ula_plus', 'ulanext', 'timex_hires', 'gigascreen']) {
  const t = enter(mode, true);
  const L = place(t);
  let bad = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const inBox = y < L.set.length && x < L.set[0].length;
    const want = inBox && L.clear && L.clear[y][x] ? 0 : 1;
    if (dotAt(t, x, y) !== want) bad++;
  }
  check(`${mode}: the shade is cleared, the rest of the cell kept`, bad === 0, `${bad} wrong`);
}
for (const mode of ['layer2_256', 'lores']) {
  const t = enter(mode, true);
  const L = place(t);
  let cleared = 0, kept = 0, bad = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const inBox = y < L.set.length && x < L.set[0].length;
    const v = dotAt(t, x, y);
    if (inBox && L.clear && L.clear[y][x]) { if (v < 0 || v === 3) cleared++; else bad++; }
    else if (inBox && L.set[y][x]) { if (v !== 3) kept++; else bad++; }
  }
  check(`${mode}: the shade is cleared to the transparent index, the letters are drawn`, bad === 0 && cleared > 0 && kept > 0, `cleared ${cleared} kept ${kept} bad ${bad}`);
}

// -- with Clear background as well: the shade merges into the cleared box (no extra effect) ---------------------------------
{
  tool.setTextBackground('overlap');
  const t = enter('standard_ula', true);
  const L = place(t);
  let wrong = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inBox = y < L.set.length && x < L.set[0].length;
    const want = inBox ? (L.set[y][x] ? 1 : 0) : 1;
    if (dotAt(t, x, y) !== want) wrong++;
  }
  check('Clear background + opposite shade: the whole box is cleared except the letters', wrong === 0, `${wrong} wrong`);
  tool.setTextBackground('transparent');
}

// -- saved form -------------------------------------------------------------------------------------------------------------------
{
  const base = { x: 1, y: 2, w: 3, h: 2, mask: [[true, false, false], [false, false, true]], colorSelection: null };
  const without = LayerManager._plainStamp(base);
  check('a stamp without clear dots saves with no clearMask key (byte-identical to before)', !('clearMask' in without) && JSON.stringify(Object.keys(without)) === JSON.stringify(Object.keys(LayerManager._plainStamp({ ...base, clearMask: null }))));
  const withClear = LayerManager._plainStamp({ ...base, clearMask: [[false, true, true], [true, true, false]] });
  check('a stamp with clear dots saves them', eq(withClear.clearMask, [[false, true, true], [true, true, false]]));
  check('an all-false clear mask is not written', !('clearMask' in LayerManager._plainStamp({ ...base, clearMask: [[false, false, false], [false, false, false]] })));
  check('a clear mask of the wrong shape is not written', !('clearMask' in LayerManager._plainStamp({ ...base, clearMask: [[true]] })));
  const read = LayerManager._readStamp(JSON.parse(JSON.stringify(withClear)));
  check('it reads back', read && eq(read.clearMask, withClear.clearMask));
  const bad = LayerManager._readStamp({ ...JSON.parse(JSON.stringify(withClear)), clearMask: [[true]] });
  check('a damaged clear mask is dropped on read, the stamp still loads', bad && !('clearMask' in bad));
}

// -- floating-state undo copy, parking and re-engaging --------------------------------------------------------------------------
{
  enter('standard_ula', true);
  tool._createPreviewStamp(10, 10);
  const fp = SelectionService.floatingPaste;
  const before = JSON.stringify(fp.clearMask);
  const state = SelectionService.captureFloatingState();
  check('the floating-state copy holds the clear mask', JSON.stringify(state.clearMask) === before);
  const stampLayer = fp.floatingLayer;
  SelectionService.endFloatingPaste();
  check('parking the stamp keeps it', JSON.stringify(stampLayer.stamp.clearMask) === before);
  SelectionService.startComponentReposition(stampLayer);
  check('re-engaging it brings it back', JSON.stringify(SelectionService.floatingPaste.clearMask) === before);
  check('...and its source copy', JSON.stringify(SelectionService.floatingPaste._srcClearMask) === before);
  SelectionService.restoreFloatingState(state);
  check('restoring the undo copy brings it back', JSON.stringify(SelectionService.floatingPaste.clearMask) === before);
}

// -- transforms --------------------------------------------------------------------------------------------------------------------
{
  enter('standard_ula', true);
  while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
  const set = [[true, false, false], [false, false, false]];
  const clear = [[false, true, false], [false, false, true]];
  const make = () => {
    while (SelectionService.isFloating()) SelectionService.cancelFloatingPaste();
    SelectionService.startFloatingPasteFromMask(set.map(r => [...r]), 3, 2, 20, 20, 'T', null, 'none', null, null, clear);
    return SelectionService.floatingPaste;
  };
  let fp = make();
  check('a stamp made with a clear mask has it', eq(fp.clearMask, clear) && eq(fp._srcClearMask, clear));
  SelectionService.transformStamp('flipH');
  check('flip H moves the clear dots with the dots', eq(fp.clearMask, [[false, true, false], [true, false, false]]), JSON.stringify(fp.clearMask));
  fp = make();
  SelectionService.transformStamp('flipV');
  check('flip V', eq(fp.clearMask, [[false, false, true], [false, true, false]]));
  fp = make();
  SelectionService.transformStamp('rotate90CW');
  check('a quarter turn: still 3x2 swapped, set and clear never overlap',
    fp.clearMask.length === fp.pixels.length && fp.clearMask[0].length === fp.pixels[0].length && fp.width === 2 &&
    !fp.pixels.some((r, y) => r.some((v, x) => v && fp.clearMask[y][x])));
  fp = make();
  SelectionService.transformStamp('rotate180');
  check('180 turn', eq(fp.clearMask, [[true, false, false], [false, true, false]]));
  fp = make();
  SelectionService.transformStamp('invert');
  check('Invert drops the clear dots', !('clearMask' in fp));
  fp = make();
  SelectionService.transformStamp('outline', 1, 1, 1);
  check('Outline grows the clear mask with the stamp, never over a set dot',
    fp.clearMask && fp.clearMask.length === fp.pixels.length && !fp.pixels.some((r, y) => r.some((v, x) => v && fp.clearMask[y][x])));
  fp = make();
  SelectionService.setStampScale(2, 2);
  check('scaling a stamp scales its clear dots with it', fp.clearMask && fp.clearMask.length === fp.pixels.length &&
    fp.clearMask.some(r => r.some(Boolean)) && !fp.pixels.some((r, y) => r.some((v, x) => v && fp.clearMask[y][x])));
  SelectionService.setStampScale(1, 1);
  check('...and back at scale 1 they are the original dots', eq(fp.clearMask, clear), JSON.stringify(fp.clearMask));
  fp = make();
  SelectionService.setStampRotation(45);
  check('a free turn keeps clear and set apart', !fp.pixels.some((r, y) => r.some((v, x) => v && (fp.clearMask || [])[y] && fp.clearMask[y][x])));
}

// -- re-render of a text stamp at scale 1 gives the stamp that was created -------------------------------------------------------
{
  enter('standard_ula', true);
  tool._createPreviewStamp(40, 40);
  const fp = SelectionService.floatingPaste;
  const a = JSON.stringify([fp.pixels, fp.clearMask]);
  SelectionService.setStampScale(1, 1);
  check('create == re-render at scale 1, pixels and clear dots', JSON.stringify([SelectionService.floatingPaste.pixels, SelectionService.floatingPaste.clearMask]) === a);
  tool.setTextShadowDots('same');
  check('switching the shade back to Same dots removes the clear mask from the waiting stamp', !('clearMask' in SelectionService.floatingPaste));
  tool.setTextShadowDots('opposite');
  check('...and Opposite puts it back', !!SelectionService.floatingPaste.clearMask);
}

summary();
