'use strict';
/**
 * The colour state behind the rail: what Swap moves, what a pick announces,
 * and where "use existing" means nothing at all.
 *
 * Three faults this pins, all found 2026-09-16:
 *  - Swap moved the two colours but left the "use existing" boxes behind, so
 *    the colour arriving under a well was still being ignored; and in the
 *    indexed Next modes it swapped the classic pair nobody was looking at
 *    rather than the two indices the wells actually show.
 *  - setSelection (the eyedropper's only path) announced ink alone, so the
 *    Bright and Flash toggles, the bright swatch bank and the ULAplus CLUT
 *    buttons went on showing the state from before the pick.
 *  - In modes whose cells have no attributes (indexed Next, Timex hi-res) the
 *    boxes still reported as on, offering a setting that could not do
 *    anything.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');

ColorManager.initialize();

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
}

/** Record the colour facts one call announces. */
function announced(fn) {
  const seen = [];
  const offs = [
    [EVENTS.COLOR_INK, 'ink'], [EVENTS.COLOR_PAPER, 'paper'],
    [EVENTS.COLOR_BRIGHT, 'bright'], [EVENTS.COLOR_FLASH, 'flash']
  ].map(([channel, name]) => {
    const handler = () => seen.push(name);
    EventBus.on(channel, handler);
    return () => EventBus.off && EventBus.off(channel, handler);
  });
  fn();
  offs.forEach((off) => off());
  return seen;
}

// ── Swap ───────────────────────────────────────────────────────────────────

enter('standard_ula');
ColorManager.setInk(2);
ColorManager.setPaper(5);
ColorManager.setInkTransparent(true);
ColorManager.setPaperTransparent(false);
ColorManager.swapColors();
check('Swap moves the colours', ColorManager.getInk() === 5 && ColorManager.getPaper() === 2);
check('Swap moves "use existing" with them',
  ColorManager.isInkTransparent() === false && ColorManager.isPaperTransparent() === true);
check('Swap announces both channels',
  JSON.stringify(announced(() => ColorManager.swapColors()).sort()) ===
  JSON.stringify(['ink', 'paper']));

ColorManager.setInkTransparent(false);
ColorManager.setPaperTransparent(false);

enter('layer2_256');
ColorManager.setNextInk(40);
ColorManager.setNextPaper(9);
ColorManager.swapColors();
check('Swap in an indexed mode swaps the two indices the wells show',
  ColorManager.getIndexedInk() === 9 && ColorManager.getIndexedPaper() === 40);

// ── A pick announces every channel it changed ──────────────────────────────

enter('standard_ula');
ColorManager.setInk(0);
ColorManager.setPaper(7);
ColorManager.setBright(false);
ColorManager.setFlash(false);
ColorManager.setInkTransparent(true);

const facts = announced(() => ColorManager.setSelection({
  ink: 3, paper: 4, bright: true, flash: true,
  inkTransparent: false, paperTransparent: false
}));
check('a pick announces ink, paper, bright and flash',
  ['ink', 'paper', 'bright', 'flash'].every((f) => facts.includes(f)));
check('a pick applies all four', ColorManager.getInk() === 3 &&
  ColorManager.getPaper() === 4 && ColorManager.getBright() === true &&
  ColorManager.getFlash() === true);
check('a pick clears "use existing" - it IS choosing a colour',
  ColorManager.isInkTransparent() === false);

const quiet = announced(() => ColorManager.setSelection({
  ink: 5, paper: 4, bright: true, flash: true
}));
check('a pick that changes only the ink announces only ink',
  JSON.stringify(quiet) === JSON.stringify(['ink']));

// ── Where cells have no attributes ─────────────────────────────────────────

enter('standard_ula');
ColorManager.setInkTransparent(true);
ColorManager.setPaperTransparent(true);
check('classic: the boxes are in force', ColorManager.isInkTransparent() === true);
check('classic: hasCellAttributes', ColorManager.hasCellAttributes() === true);

enter('layer2_256');
check('indexed Next: cells have no attributes', ColorManager.hasCellAttributes() === false);
check('indexed Next: the boxes report off, so nothing acts on them',
  ColorManager.isInkTransparent() === false && ColorManager.isPaperTransparent() === false);
check('indexed Next: and the drawing selection agrees',
  ColorManager.getCurrentSelection().inkTransparent === false);

enter('timex_hires');
check('Timex hi-res: cell attributes are ignored, so the boxes are off too',
  ColorManager.hasCellAttributes() === false &&
  ColorManager.isInkTransparent() === false);

enter('ula_plus');
check('ULAplus has ink and paper per cell, so the boxes mean something',
  ColorManager.hasCellAttributes() === true);
check('...and the setting was remembered across those modes, not lost',
  ColorManager.isInkTransparent() === true && ColorManager.isPaperTransparent() === true);

enter('ulanext');
check('ULANext has classic cells too', ColorManager.hasCellAttributes() === true);

// ── A new document ─────────────────────────────────────────────────────────

enter('standard_ula');
const onReset = announced(() => ColorManager.reset());
check('reset announces all four channels',
  ['ink', 'paper', 'bright', 'flash'].every((f) => onReset.includes(f)));
check('reset clears both boxes',
  ColorManager.isInkTransparent() === false && ColorManager.isPaperTransparent() === false);

summary('colour-state');
