'use strict';
/**
 * Gradient tool control workflow additions: midpoint bias, gamma/ease curve,
 * wrap/repeat/mirror, axis angle-snap, axis keyboard nudge, and lock-axis
 * reuse. Each is pure math or state on GradientTool itself except axis-nudge,
 * which is wired through InputHandler and covered separately in
 * tests/browser/input-keyboard.spec.js.
 *
 * Every new control defaults to a no-op so the existing 7-type/dither/steps
 * behaviour (pinned in tools-draw.test.js and gradient-preview.spec.js) stays
 * byte-identical — checked here too via the "defaults reproduce baseline"
 * assertions.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b + (br ? 8 : 0); }, setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  getCurrentSelection() { return { ink: 2, paper: 6, bright: true, flash: false }; }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; }, hasClipboard() { return false; }
};

// Minimal stand-in so the tool's own EVENTS.TOOL_OPTIONS listener (mirrors
// bezier-tool's CANVAS_ZOOM listener) can gate on "is this the active tool" -
// tests point it at whichever GradientTool instance they're driving.
let _currentTool = null;
global.ToolManager = { getCurrentTool: () => _currentTool };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/gradient-tool.js');

LayerManager.initialize();

const layer = LayerManager.getCurrentLayer();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const ev = (over = {}) => ({
  button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  shiftKey: false, altKey: false, ...over
});

// A fresh tool instance per scenario. There's no layer-clear API, so every
// scenario below draws into its own disjoint rectangle rather than reusing
// coordinates - ink is additive/never erased, so overlap would corrupt counts.
function freshTool() {
  return new GradientTool();
}

function countInkInRect(x1, y1, x2, y2) {
  let n = 0;
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (isInk(x, y)) n++;
  return n;
}

// Draw a left->right linear gradient over a fixed rect, dithered off (hard
// 50% split) so results are deterministic pixel counts.
function drawLinearRect(tool, x1, y1, x2, y2) {
  tool.setDithered(false);
  tool.onPointerDown(x1, y1, ev());
  tool.onPointerUp(x2, y2, ev());          // phase 1: lock rect
  const cy = Math.round((y1 + y2) / 2);
  tool.onPointerDown(x1, cy, ev());
  tool.onPointerUp(x2, cy, ev());           // phase 2: L->R axis, commit
}

// ── Bias: shifts the ink/paper threshold without moving the axis ──────────

{
  const tool = freshTool();
  check('gradient: getBias defaults to 0', tool.getBias() === 0);
  drawLinearRect(tool, 0, 0, 63, 15);
  const baseline = countInkInRect(0, 0, 63, 15);

  const toolPos = freshTool();
  toolPos.setBias(40);
  drawLinearRect(toolPos, 64, 0, 127, 15);
  const withPositiveBias = countInkInRect(64, 0, 127, 15);
  check('gradient: positive bias increases ink coverage', withPositiveBias > baseline,
    `baseline=${baseline} biased=${withPositiveBias}`);

  const toolNeg = freshTool();
  toolNeg.setBias(-40);
  drawLinearRect(toolNeg, 128, 0, 191, 15);
  const withNegativeBias = countInkInRect(128, 0, 191, 15);
  check('gradient: negative bias decreases ink coverage', withNegativeBias < baseline,
    `baseline=${baseline} biased=${withNegativeBias}`);

  check('gradient: setBias clamps to -50..50', (() => {
    toolNeg.setBias(999);
    const hi = toolNeg.getBias();
    toolNeg.setBias(-999);
    const lo = toolNeg.getBias();
    return hi === 50 && lo === -50;
  })());
}

// ── Gamma curve: reshapes the ramp before step quantization ───────────────

{
  const tool = freshTool();
  check('gradient: getGammaCurve defaults to 1 (linear, no-op)', tool.getGammaCurve() === 1);

  // gamma < 1 pushes the whole ramp toward 1 (pos ** gamma grows faster than
  // pos for pos in (0,1)), so more of the shape crosses the ink threshold.
  const eased = freshTool();
  eased.setGammaCurve(0.4);
  drawLinearRect(eased, 0, 32, 63, 47);
  const easedInk = countInkInRect(0, 32, 63, 47);

  const linear = freshTool();
  drawLinearRect(linear, 64, 32, 127, 47);
  const linearInk = countInkInRect(64, 32, 127, 47);

  check('gradient: gamma < 1 increases ink coverage vs linear', easedInk > linearInk,
    `linear=${linearInk} eased=${easedInk}`);

  check('gradient: setGammaCurve clamps to 0.25..4', (() => {
    eased.setGammaCurve(999);
    const hi = eased.getGammaCurve();
    eased.setGammaCurve(-5);
    const lo = eased.getGammaCurve();
    return hi === 4 && lo === 0.25;
  })());
}

// ── Wrap/repeat/mirror: generalizes past the original single clamp ────────

{
  const tool = freshTool();
  check('gradient: getWrapMode defaults to clamp', tool.getWrapMode() === 'clamp');
  check('gradient: getRepeatCount defaults to 1', tool.getRepeatCount() === 1);

  check('gradient: setWrapMode rejects unknown values', (() => {
    tool.setWrapMode('nonsense');
    return tool.getWrapMode() === 'clamp';
  })());
  check('gradient: setRepeatCount clamps at the top end (0..8 range, see the dedicated block below)', (() => {
    tool.setRepeatCount(99);
    return tool.getRepeatCount() === 8;
  })());
}

{
  // wrapMode: 'clamp' (default) must reproduce the exact single-band output
  // regardless of repeatCount — the option is meant to be inert until the
  // artist actually switches wrapMode, even if repeatCount was left nonzero
  // from a previous mode.
  const withStaleRepeat = freshTool();
  withStaleRepeat.repeatCount = 4;
  drawLinearRect(withStaleRepeat, 0, 64, 63, 79);
  const staleInk = countInkInRect(0, 64, 63, 79);

  const plain = freshTool();
  drawLinearRect(plain, 64, 64, 127, 79);
  const plainInk = countInkInRect(64, 64, 127, 79);

  check('gradient: clamp wrapMode ignores repeatCount (inert until switched)',
    staleInk === plainInk, `stale=${staleInk} plain=${plainInk}`);
}

{
  // wrapMode 'repeat' with repeatCount N puts N ink bands across the axis
  // instead of one continuous ramp -> more ink/paper transitions along a
  // scanline than the single-band default.
  const repeated = freshTool();
  repeated.setWrapMode('repeat');
  repeated.setRepeatCount(4);
  drawLinearRect(repeated, 0, 96, 127, 96);

  const countTransitions = (y, x1, x2) => {
    let transitions = 0, prev = isInk(x1, y);
    for (let x = x1 + 1; x <= x2; x++) {
      const cur = isInk(x, y);
      if (cur !== prev) transitions++;
      prev = cur;
    }
    return transitions;
  };
  const repeatedTransitions = countTransitions(96, 0, 127);

  const single = freshTool();
  drawLinearRect(single, 0, 112, 127, 112);
  const singleTransitions = countTransitions(112, 0, 127);

  check('gradient: repeat wrapMode produces more ink/paper transitions than a single band',
    repeatedTransitions > singleTransitions,
    `repeated=${repeatedTransitions} single=${singleTransitions}`);
}

// ── Angle-snap: Shift held during phase 2 snaps the axis to 15deg steps ───

function snappedPoint(startX, startY, rawX, rawY, stepDeg = 15) {
  const dx = rawX - startX, dy = rawY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const rawAngle = Math.atan2(dy, dx);
  const stepRad = stepDeg * Math.PI / 180;
  const snappedAngle = Math.round(rawAngle / stepRad) * stepRad;
  return {
    x: Math.round(startX + dist * Math.cos(snappedAngle)),
    y: Math.round(startY + dist * Math.sin(snappedAngle))
  };
}

{
  const tool = freshTool();
  tool.onPointerDown(80, 80, ev());
  tool.onPointerUp(120, 120, ev());   // phase 1 -> phase 2, centre (100,100)
  check('gradient: phase 2 entered', tool._phase === 'gradient');
  const start = tool.startPoint;

  tool.onPointerMove(133, 105, ev({ shiftKey: false }));
  check('gradient: no Shift -> endPoint follows the raw pointer exactly',
    tool.endPoint.x === 133 && tool.endPoint.y === 105);

  tool.onPointerMove(133, 105, ev({ shiftKey: true }));
  const expected = snappedPoint(start.x, start.y, 133, 105);
  check('gradient: Shift held -> endPoint snaps to the nearest 15deg axis',
    tool.endPoint.x === expected.x && tool.endPoint.y === expected.y,
    `got (${tool.endPoint.x},${tool.endPoint.y}) expected (${expected.x},${expected.y})`);

  const distBefore = Math.hypot(133 - start.x, 105 - start.y);
  const distAfter  = Math.hypot(tool.endPoint.x - start.x, tool.endPoint.y - start.y);
  check('gradient: Shift snap preserves axis distance (within 1px rounding)',
    Math.abs(distBefore - distAfter) <= 1);
}

// ── Lock axis: reuse the last committed axis, scaled to the new shape ─────

{
  const tool = freshTool();
  check('gradient: getLockAxis defaults to false', tool.getLockAxis() === false);
  tool.setLockAxis(true);
  check('gradient: setLockAxis(true) takes effect', tool.getLockAxis() === true);

  // First shape: nothing locked yet (no prior commit), so phase 2 starts at
  // the raw release cursor exactly like the unlocked default.
  tool.onPointerDown(0, 0, ev());
  tool.onPointerUp(39, 39, ev());
  check('gradient: no prior commit -> phase 2 starts at the raw cursor even with lockAxis on',
    tool.endPoint.x === 39 && tool.endPoint.y === 39);

  // Commit a 45deg axis from the shape centre to its corner.
  const bounds1 = tool._shapeBounds, centre1 = tool.startPoint;
  tool.onPointerDown(39, 39, ev());
  tool.onPointerUp(39, 39, ev());     // commits; _resetAll() clears phase state
  check('gradient: tool resets to shape phase after commit', tool._phase === 'shape');

  const ratio = Math.hypot(39 - centre1.x, 39 - centre1.y) / Math.hypot(bounds1.width / 2, bounds1.height / 2);
  const angle = Math.atan2(39 - centre1.y, 39 - centre1.x);

  // Second, differently-sized shape: phase 2 should pre-fill from the locked
  // ratio/angle scaled to the NEW bounds, not from the release cursor.
  tool.onPointerDown(100, 100, ev());
  tool.onPointerUp(179, 139, ev());   // release cursor is (179,139) - must NOT be endPoint
  const bounds2 = tool._shapeBounds, centre2 = tool.startPoint;
  const newDist = ratio * Math.hypot(bounds2.width / 2, bounds2.height / 2);
  const expected = {
    x: Math.round(centre2.x + newDist * Math.cos(angle)),
    y: Math.round(centre2.y + newDist * Math.sin(angle))
  };
  check('gradient: locked axis pre-fills phase 2 on the next shape, scaled to its bounds',
    tool.endPoint.x === expected.x && tool.endPoint.y === expected.y,
    `got (${tool.endPoint.x},${tool.endPoint.y}) expected (${expected.x},${expected.y}) release was (179,139)`);
  check('gradient: locked pre-fill still shows a live, still-draggable preview (phase unchanged)',
    tool._phase === 'gradient');
}

{
  // Same two-shape sequence, lockAxis OFF: phase 2 must start at the raw
  // release cursor exactly as before this feature existed.
  const tool = freshTool();
  tool.onPointerDown(0, 0, ev());
  tool.onPointerUp(39, 39, ev());
  tool.onPointerDown(39, 39, ev());
  tool.onPointerUp(39, 39, ev());
  tool.onPointerDown(100, 100, ev());
  tool.onPointerUp(179, 139, ev());
  check('gradient: lockAxis off -> phase 2 always starts at the raw release cursor',
    tool.endPoint.x === 179 && tool.endPoint.y === 139);
}

// ── ZX attribute clash: every altered cell keeps ONE ink/paper/bright/flash ──
// None of the new controls touch attribute-writing code (they only reshape
// the position/threshold math feeding the same single-colour
// PixelDrawRoutine.draw call _drawGradient always used), so this should hold
// for every combination exactly as it already does for the 7 base types.
// A per-cell clash is structurally impossible in this data model (one ink/
// paper/bright/flash field per cell - see attribute-system.js), so what this
// actually pins is that every new option still stamps the SAME selection
// consistently, rather than only checking something that can't fail.

const sel = ColorManager.getCurrentSelection();

function checkCellAttrsUniform(label, x1, y1, x2, y2) {
  const cellX1 = Math.floor(x1 / ZX_SPECTRUM.CELL_WIDTH),  cellX2 = Math.floor(x2 / ZX_SPECTRUM.CELL_WIDTH);
  const cellY1 = Math.floor(y1 / ZX_SPECTRUM.CELL_HEIGHT), cellY2 = Math.floor(y2 / ZX_SPECTRUM.CELL_HEIGHT);
  let sawAltered = false, mismatch = null;
  for (let cy = cellY1; cy <= cellY2 && !mismatch; cy++) {
    for (let cx = cellX1; cx <= cellX2; cx++) {
      const cell = layer.getCell(cx, cy);
      if (!cell || !cell.altered) continue;
      sawAltered = true;
      if (cell.ink !== sel.ink || cell.paper !== sel.paper || cell.bright !== sel.bright || cell.flash !== sel.flash) {
        mismatch = { cx, cy, cell: { ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash } };
        break;
      }
    }
  }
  check(label, sawAltered && !mismatch,
    mismatch ? JSON.stringify(mismatch) : (sawAltered ? '' : 'no altered cells in range'));
}

{
  const t = freshTool();
  drawLinearRect(t, 0, 140, 99, 155);
  checkCellAttrsUniform('gradient attrs: default options', 0, 140, 99, 155);
}
{
  const t = freshTool();
  t.setBias(35);
  drawLinearRect(t, 100, 140, 199, 155);
  checkCellAttrsUniform('gradient attrs: bias', 100, 140, 199, 155);
}
{
  const t = freshTool();
  t.setGammaCurve(2.5);
  drawLinearRect(t, 0, 156, 99, 171);
  checkCellAttrsUniform('gradient attrs: gamma curve', 0, 156, 99, 171);
}
{
  const t = freshTool();
  t.setWrapMode('repeat');
  t.setRepeatCount(3);
  drawLinearRect(t, 100, 156, 199, 171);
  checkCellAttrsUniform('gradient attrs: wrap repeat', 100, 156, 199, 171);
}
{
  const t = freshTool();
  t.setWrapMode('mirror');
  t.setRepeatCount(3);
  drawLinearRect(t, 0, 172, 99, 187);
  checkCellAttrsUniform('gradient attrs: wrap mirror', 0, 172, 99, 187);
}
{
  const t = freshTool();
  t.setLockAxis(true);
  t.onPointerDown(100, 172, ev());
  t.onPointerUp(139, 187, ev());
  t.onPointerDown(139, 187, ev());
  t.onPointerUp(139, 187, ev());
  t.onPointerDown(160, 172, ev());
  t.onPointerUp(199, 187, ev());   // pre-filled axis from the lock, still commits normally
  t.onPointerDown(180, 180, ev());
  t.onPointerUp(190, 185, ev());
  checkCellAttrsUniform('gradient attrs: lock axis reuse', 100, 172, 199, 187);
}

// ── Repeats = 0: a flat, position-independent dithered texture wash ───────
// Multiplying raw*0 would otherwise collapse gradientPos to a constant 0
// (all-paper, invisible) rather than a genuine even texture, so 0 is a
// special case mapped to the midpoint (0.5) instead - a deliberate "ignore
// the gradient direction, just show the dither pattern" mode.

{
  const t = freshTool();
  t.setWrapMode('repeat');
  check('gradient: setRepeatCount clamps to 0..8 (0 now allowed)', (() => {
    t.setRepeatCount(-3);
    const lo = t.getRepeatCount();
    t.setRepeatCount(99);
    const hi = t.getRepeatCount();
    return lo === 0 && hi === 8;
  })());

  t.setRepeatCount(0);
  // Deliberately NOT using drawLinearRect - it forces dithered off, and the
  // point of this test is the dithered TEXTURE, not a hard split.
  t.onPointerDown(0, 16, ev());
  t.onPointerUp(63, 23, ev());     // 64x8 rect, exactly one row of 8x8 dither tiles
  t.onPointerDown(0, 19, ev());
  t.onPointerUp(63, 19, ev());     // axis direction is irrelevant once flattened
  let inkCount = 0;
  for (let y = 16; y <= 23; y++) for (let x = 0; x <= 63; x++) if (isInk(x, y)) inkCount++;
  check('gradient: repeatCount 0 gives an even ~50% dithered wash, not an empty or solid fill',
    inkCount === 256, `inkCount=${inkCount} of 512 (expected exactly 256 - the 8x8 Bayer matrix at its midpoint)`);
}

// ── Start point: centre (default), the phase-1 drag point, or one of the
// eight named edge/corner positions on the shape's bounding box ──────────

{
  const tool = freshTool();
  check('gradient: getStartAnchor defaults to centre', tool.getStartAnchor() === 'centre');
  check('gradient: setStartAnchor rejects unknown values', (() => {
    tool.setStartAnchor('nonsense');
    return tool.getStartAnchor() === 'centre';
  })());

  tool.onPointerDown(50, 60, ev());
  tool.onPointerUp(89, 99, ev());
  const b = tool._shapeBounds;
  const expectedCentre = {
    x: Math.round(b.x + (b.width - 1) / 2),
    y: Math.round(b.y + (b.height - 1) / 2)
  };
  check('gradient: centre anchor starts the axis at the bounding-box centre',
    tool.startPoint.x === expectedCentre.x && tool.startPoint.y === expectedCentre.y,
    `got (${tool.startPoint.x},${tool.startPoint.y}) expected (${expectedCentre.x},${expectedCentre.y})`);
}
{
  const tool = freshTool();
  tool.setStartAnchor('drag');
  check('gradient: setStartAnchor(drag) takes effect', tool.getStartAnchor() === 'drag');

  tool.onPointerDown(150, 60, ev());   // the drag-start corner
  tool.onPointerUp(189, 99, ev());     // bounding-box centre would be (170,80) - must NOT land here
  check('gradient: drag anchor starts the axis at the drag-start point, not the centre',
    tool.startPoint.x === 150 && tool.startPoint.y === 60,
    `got (${tool.startPoint.x},${tool.startPoint.y})`);
}

{
  // The eight named edge/corner anchors, all against one shared bounding box
  // (0,0)-(79,39): width 80, height 40 -> x1=0,x2=79,cxMid=40; y1=0,y2=39,cyMid=20.
  const expectedByAnchor = {
    top:          { x: 40, y: 0 },
    bottom:       { x: 40, y: 39 },
    left:         { x: 0,  y: 20 },
    right:        { x: 79, y: 20 },
    topLeft:      { x: 0,  y: 0 },
    topRight:     { x: 79, y: 0 },
    bottomLeft:   { x: 0,  y: 39 },
    bottomRight:  { x: 79, y: 39 }
  };
  for (const [anchor, expected] of Object.entries(expectedByAnchor)) {
    const tool = freshTool();
    tool.setStartAnchor(anchor);
    tool.onPointerDown(0, 0, ev());
    tool.onPointerUp(79, 39, ev());
    check(`gradient: '${anchor}' anchor starts the axis at (${expected.x},${expected.y})`,
      tool.startPoint.x === expected.x && tool.startPoint.y === expected.y,
      `got (${tool.startPoint.x},${tool.startPoint.y})`);
  }
}

{
  // Drag anchor + lock axis: the "reach" a locked axis scales against must
  // be the FULL diagonal (corner to opposite corner), not the half-diagonal
  // centre-anchor uses. Reference-computed independently here (not "must
  // land on the corner" - that only coincides with a 45deg axis on a SQUARE
  // shape, which would pass just as well with the half-diagonal formula
  // since uniform aspect ratio cancels the difference out).
  const tool = freshTool();
  tool.setStartAnchor('drag');
  tool.setLockAxis(true);

  tool.onPointerDown(0, 0, ev());
  tool.onPointerUp(39, 39, ev());
  const boundsA = tool._shapeBounds, startA = tool.startPoint;
  const commitX = 39, commitY = 10;   // off-diagonal on purpose
  tool.onPointerDown(commitX, commitY, ev());
  tool.onPointerUp(commitX, commitY, ev());

  const dxA = commitX - startA.x, dyA = commitY - startA.y;
  const angle = Math.atan2(dyA, dxA);
  const reachA = Math.hypot(boundsA.width, boundsA.height);   // FULL diagonal
  const ratio = Math.hypot(dxA, dyA) / reachA;

  tool.onPointerDown(100, 100, ev());
  tool.onPointerUp(179, 139, ev());
  const boundsB = tool._shapeBounds, startB = tool.startPoint;
  const reachB = Math.hypot(boundsB.width, boundsB.height);
  const dist = ratio * reachB;
  const expected = {
    x: Math.round(startB.x + dist * Math.cos(angle)),
    y: Math.round(startB.y + dist * Math.sin(angle))
  };
  check('gradient: drag anchor + lock axis scales against the full diagonal, not half',
    tool.endPoint.x === expected.x && tool.endPoint.y === expected.y,
    `got (${tool.endPoint.x},${tool.endPoint.y}) expected (${expected.x},${expected.y})`);
}

{
  // Edge anchor ('top') + lock axis: the reach must scale against
  // hypot(width/2, height) - the farthest corner from a horizontally-centred
  // top-edge point - not the drag/corner full-diagonal formula.
  const tool = freshTool();
  tool.setStartAnchor('top');
  tool.setLockAxis(true);

  tool.onPointerDown(0, 0, ev());
  tool.onPointerUp(79, 39, ev());     // bounds 80x40 -> top anchor at (40,0)
  const boundsA = tool._shapeBounds, startA = tool.startPoint;
  const commitX = 60, commitY = 30;
  tool.onPointerDown(commitX, commitY, ev());
  tool.onPointerUp(commitX, commitY, ev());

  const dxA = commitX - startA.x, dyA = commitY - startA.y;
  const angle = Math.atan2(dyA, dxA);
  const reachA = Math.hypot(boundsA.width / 2, boundsA.height);
  const ratio = Math.hypot(dxA, dyA) / reachA;

  tool.onPointerDown(100, 100, ev());
  tool.onPointerUp(199, 179, ev());   // a different 100x80 shape
  const boundsB = tool._shapeBounds, startB = tool.startPoint;
  const reachB = Math.hypot(boundsB.width / 2, boundsB.height);
  const dist = ratio * reachB;
  const expected = {
    x: Math.round(startB.x + dist * Math.cos(angle)),
    y: Math.round(startB.y + dist * Math.sin(angle))
  };
  check('gradient: top anchor + lock axis scales against hypot(width/2, height)',
    tool.endPoint.x === expected.x && tool.endPoint.y === expected.y,
    `got (${tool.endPoint.x},${tool.endPoint.y}) expected (${expected.x},${expected.y})`);
}

// ── An option change mid-phase-2 refreshes the live preview in place ──────
// Changing gradientType/wrapMode/startAnchor/bias/gamma/etc. from the panel
// doesn't move the pointer, so nothing would otherwise trigger a redraw
// until the next mouse move - the preview would silently go stale. Mirrors
// bezier-tool's own CANVAS_ZOOM listener (redraw its pending preview on an
// external change), gated the same way: only the active tool, only mid-gesture.

{
  const tool = freshTool();
  _currentTool = tool;

  tool.onPointerDown(0, 100, ev());
  tool.onPointerUp(39, 139, ev());   // phase 1 -> phase 2, centre anchor
  check('gradient: phase 2 entered for the option-change test', tool._phase === 'gradient');
  const before = { ...tool.startPoint };

  let scheduleCalls = 0;
  const origSchedule = tool._scheduleUpdatePreview.bind(tool);
  tool._scheduleUpdatePreview = function() { scheduleCalls++; origSchedule(); };

  tool.setStartAnchor('topLeft');
  EventBus.emit(EVENTS.TOOL_OPTIONS, { tool: tool.id, key: 'startAnchor', value: 'topLeft' });

  check('gradient: an option change mid-phase-2 schedules a preview refresh',
    scheduleCalls > 0);
  const b = tool._shapeBounds;
  check('gradient: startAnchor change mid-phase-2 recomputes startPoint immediately (not on next shape)',
    tool.startPoint.x === b.x && tool.startPoint.y === b.y &&
    (tool.startPoint.x !== before.x || tool.startPoint.y !== before.y),
    `before (${before.x},${before.y}) after (${tool.startPoint.x},${tool.startPoint.y})`);

  _currentTool = null;
}
{
  // Guarded: an option change while this tool ISN'T the active one must not
  // touch it - two gradient-tool instances (e.g. mid-refactor UI state)
  // should never cross-update each other.
  const tool = freshTool();
  _currentTool = null;   // nothing is "active"
  tool.onPointerDown(0, 100, ev());
  tool.onPointerUp(39, 139, ev());
  let scheduleCalls = 0;
  tool._scheduleUpdatePreview = () => { scheduleCalls++; };
  EventBus.emit(EVENTS.TOOL_OPTIONS, { tool: tool.id });
  check('gradient: option-change listener ignores events when this tool is not the active one',
    scheduleCalls === 0);
}
{
  // Guarded: still in phase 1 (no locked shape yet) - nothing to refresh.
  const tool = freshTool();
  _currentTool = tool;
  let scheduleCalls = 0;
  tool._scheduleUpdatePreview = () => { scheduleCalls++; };
  EventBus.emit(EVENTS.TOOL_OPTIONS, { tool: tool.id });
  check('gradient: option-change listener is a no-op in phase 1', scheduleCalls === 0);
  _currentTool = null;
}

summary();
