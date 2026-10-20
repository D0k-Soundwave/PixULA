'use strict';
/**
 * Gradient tool: the triangle, pentagon, hexagon and octagon styles, Rotation and Zoom (owner decision 2026-10-19;
 * plan in .claude/parity/feature-gradient-shapes.md).
 *
 * A polygon style's bands are regular polygons round the start point, one side flat at the bottom at Rotation 0,
 * the drag length reaching the band's corners. Rotation (degrees, clockwise on screen) turns the edge-based styles
 * (square, diamond and the four polygons); Zoom (percent) scales their band spacing about the start point. Neither
 * applies to linear, reflected, radial, conical or spiral. At Rotation 0 and Zoom 100 Square and Diamond draw exactly
 * as before.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/dither.js');
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
global.ToolManager = { getCurrentTool: () => null };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/gradient-tool.js');
loadModule('js/i18n/en.js');

LayerManager.initialize();

const layer = LayerManager.getCurrentLayer();
const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const ev = (over = {}) => ({
  button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0, shiftKey: false, altKey: false, ...over
});
const freshTool = () => new GradientTool();
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const POLYGONS = { triangle: 3, pentagon: 5, hexagon: 6, octagon: 8 };
const EDGE = ['square', 'diamond', 'triangle', 'pentagon', 'hexagon', 'octagon'];
const DRAG_LED = ['linear', 'reflected', 'radial', 'conical', 'spiral'];

/** (dx, dy) turned by deg degrees, clockwise on screen (y grows downward). */
function turn(dx, dy, deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

const SX = 100, SY = 100, R = 40;
/** A tool whose axis runs from (SX, SY) R pixels to the right, for the position math. */
function posTool(type, opts = {}) {
  const t = freshTool();
  t.setGradientType(type);
  if (opts.rot !== undefined) t.setGradientRotation(opts.rot);
  if (opts.zoom !== undefined) t.setGradientZoom(opts.zoom);
  if (opts.wrap) { t.setWrapMode(opts.wrap); t.setRepeatCount(opts.repeats || 1); }
  t.startPoint = { x: SX, y: SY };
  t.endPoint = opts.end || { x: SX + R, y: SY };
  return t;
}
const at = (t, dx, dy) => t._getGradientPosition(SX + dx, SY + dy);

// Offsets well inside every style's first band (the smallest inner reach is the triangle's, R / 2).
const OFFSETS = [];
for (let i = 0; i < 48; i++) {
  const a = i * 2.39996, m = 0.35 * R * ((i % 7) + 1) / 7;
  OFFSETS.push({ x: m * Math.cos(a), y: m * Math.sin(a) });
}

// -- the schema ---------------------------------------------------------------------------------------------------
{
  const schema = GradientTool.optionsSchema;
  const type = schema.find(e => e.key === 'gradientType');
  const values = type.options.map(o => o.value);
  const sq = values.indexOf('square');
  check('the Type list offers the four polygon styles right after Square',
    JSON.stringify(values.slice(sq + 1, sq + 5)) === JSON.stringify(['triangle', 'pentagon', 'hexagon', 'octagon']),
    JSON.stringify(values));
  const labels = Object.fromEntries(type.options.map(o => [o.value, o.i18n]));
  check('the polygon styles reuse the existing shape names',
    labels.triangle === 'common.triangle' && labels.pentagon === 'shape.pentagon' &&
    labels.hexagon === 'shape.hexagon' && labels.octagon === 'shape.octagon', JSON.stringify(labels));

  const rot = schema.find(e => e.key === 'gradientRotation');
  check('a Rotation slider, -180 to 180 degrees, 0 to start, labelled as the Shape tool\'s',
    rot && rot.type === 'range' && rot.min === -180 && rot.max === 180 && rot.value === 0 && rot.step === 1 &&
    rot.i18n === 'opt.rotation' && rot.unit === '\u00b0', JSON.stringify(rot));
  const zoom = schema.find(e => e.key === 'gradientZoom');
  check('a Zoom slider, 25 to 400 percent, 100 to start',
    zoom && zoom.type === 'range' && zoom.min === 25 && zoom.max === 400 && zoom.value === 100 &&
    zoom.unit === '%' && zoom.i18n === 'opt.gradientZoom', JSON.stringify(zoom));
  for (const [name, e] of [['Rotation', rot], ['Zoom', zoom]]) {
    const cond = e && e.showIf;
    check(`${name} shows for exactly the edge-based styles`,
      cond && cond.key === 'gradientType' && Array.isArray(cond.in) &&
      JSON.stringify([...cond.in].sort()) === JSON.stringify([...EDGE].sort()), JSON.stringify(cond));
  }
  const keys = schema.map(e => e.key);
  check('Rotation and Zoom sit right after Type', keys.indexOf('gradientRotation') === keys.indexOf('gradientType') + 1 &&
    keys.indexOf('gradientZoom') === keys.indexOf('gradientType') + 2, JSON.stringify(keys));
  check('en has the Zoom label', window.i18n_en && window.i18n_en['opt.gradientZoom'] === 'Zoom');
}

// -- setters ------------------------------------------------------------------------------------------------------
{
  const t = freshTool();
  for (const ty of Object.keys(POLYGONS)) {
    t.setGradientType(ty);
    check(`setGradientType accepts ${ty}`, t.getGradientType() === ty);
  }
  t.setGradientType('heptagon');
  check('an unknown type is ignored', t.getGradientType() === 'octagon');

  check('Rotation starts at 0', t.getGradientRotation() === 0);
  t.setGradientRotation(30);  check('Rotation 30', t.getGradientRotation() === 30);
  t.setGradientRotation('45'); check('Rotation "45" (from a preset) is 45', t.getGradientRotation() === 45);
  t.setGradientRotation(270); check('Rotation 270 wraps to -90', t.getGradientRotation() === -90);
  t.setGradientRotation(-190); check('Rotation -190 wraps to 170', t.getGradientRotation() === 170);
  t.setGradientRotation(360); check('Rotation 360 is 0', t.getGradientRotation() === 0);
  t.setGradientRotation(25);
  t.setGradientRotation('abc'); check('Rotation that is not a number is 0', t.getGradientRotation() === 0);

  check('Zoom starts at 100', t.getGradientZoom() === 100);
  t.setGradientZoom(150);  check('Zoom 150', t.getGradientZoom() === 150);
  t.setGradientZoom('200'); check('Zoom "200" is 200', t.getGradientZoom() === 200);
  t.setGradientZoom(1000); check('Zoom is held to 400', t.getGradientZoom() === 400);
  t.setGradientZoom(5);    check('Zoom is held to 25', t.getGradientZoom() === 25);
  t.setGradientZoom(null); check('Zoom that is not a number is 100', t.getGradientZoom() === 100);
}

// -- polygon bands ------------------------------------------------------------------------------------------------
for (const [type, n] of Object.entries(POLYGONS)) {
  const t = posTool(type);
  check(`${type}: the start point reads 0`, at(t, 0, 0) === 0);

  let worst = 0;
  for (const p of OFFSETS) {
    const q = turn(p.x, p.y, 360 / n);
    worst = Math.max(worst, Math.abs(at(t, p.x, p.y) - at(t, q.x, q.y)));
  }
  check(`${type}: a turn of 360/${n} degrees reads the same (${n}-fold bands)`, worst < 1e-9, String(worst));
  let differs = 0;
  for (const p of OFFSETS) {
    const q = turn(p.x, p.y, 180 / n);
    if (Math.abs(at(t, p.x, p.y) - at(t, q.x, q.y)) > 1e-6) differs++;
  }
  check(`${type}: a turn of half a step does not (the bands have corners)`, differs > OFFSETS.length / 2, String(differs));

  // Corners at 90 + 180/n + k*360/n degrees, side middles at 90 + k*360/n (screen angles, y down): one side flat
  // at the bottom. The drag length reaches the corners.
  let bad = [];
  for (let k = 0; k < n; k++) {
    const ca = (90 + 180 / n + k * 360 / n) * Math.PI / 180;
    const sa = (90 + k * 360 / n) * Math.PI / 180;
    const apothem = Math.cos(Math.PI / n);
    const c = at(t, 0.9 * R * Math.cos(ca), 0.9 * R * Math.sin(ca));
    const s = at(t, 0.9 * R * apothem * Math.cos(sa), 0.9 * R * apothem * Math.sin(sa));
    if (!near(c, 0.9) || !near(s, 0.9)) bad.push(`k${k}: corner ${c} side ${s}`);
  }
  check(`${type}: 0.9 of the drag towards a corner, and towards the middle of a side, both read 0.9`,
    bad.length === 0, bad.join('; '));

  const turned = posTool(type, { end: { x: SX, y: SY + R } });
  check(`${type}: the drag sets the size only, not the angle`,
    OFFSETS.every(p => near(at(t, p.x, p.y), at(turned, p.x, p.y))));
}
{
  const t = posTool('triangle');
  check('triangle points up: 0.9 R straight up reads 0.9', near(at(t, 0, -0.9 * R), 0.9));
  check('triangle has a flat bottom: R / 2 straight down is already the end', at(t, 0, 0.5 * R + 0.5) === 1);
  const h = posTool('hexagon');
  check('hexagon has a flat top and bottom: a corner points right', near(at(h, 0.9 * R, 0), 0.9) &&
    near(at(h, 0, -0.8 * R), 0.8 / Math.cos(Math.PI / 6)));
}

// -- exact symmetry on the pixel grid: a pixel on a band edge must not fall on one side only ------------------------
for (const [type, n] of Object.entries(POLYGONS)) {
  const t = posTool(type);
  let mirror = 0, half = 0;
  for (let dy = -45; dy <= 45; dy++) for (let dx = -45; dx <= 45; dx++) {
    if (at(t, dx, dy) !== at(t, -dx, dy)) mirror++;
    if (n % 2 === 0 && at(t, dx, dy) !== at(t, -dx, -dy)) half++;
  }
  check(`${type}: left and right mirror each other exactly`, mirror === 0, `${mirror} differ`);
  if (n % 2 === 0) check(`${type}: a half turn gives exactly the same values`, half === 0, `${half} differ`);
}

// -- Square and Diamond at the defaults: exactly the old formulas --------------------------------------------------
{
  for (const type of ['square', 'diamond']) {
    const t = posTool(type);
    let bad = 0;
    for (let dy = -50; dy <= 50; dy++) for (let dx = -50; dx <= 50; dx++) {
      const raw = type === 'square' ? Math.max(Math.abs(dx), Math.abs(dy)) / R : (Math.abs(dx) + Math.abs(dy)) / R;
      if (at(t, dx, dy) !== clamp(raw, 0, 1)) bad++;
    }
    check(`${type} at Rotation 0, Zoom 100 reads exactly as before`, bad === 0, `${bad} differ`);
    for (const deg of [90, 180, -90]) {
      const r = posTool(type, { rot: deg });
      let diff = 0;
      for (let dy = -50; dy <= 50; dy++) for (let dx = -50; dx <= 50; dx++) if (at(r, dx, dy) !== at(t, dx, dy)) diff++;
      check(`${type} turned ${deg} degrees is the same, pixel for pixel`, diff === 0, `${diff} differ`);
    }
  }
}

// -- Rotation turns the edge-based styles, clockwise on screen ------------------------------------------------------
for (const type of EDGE) {
  for (const deg of [17, 45, -120]) {
    const t0 = posTool(type), tr = posTool(type, { rot: deg });
    let worst = 0;
    for (const p of OFFSETS) {
      const q = turn(p.x, p.y, deg);
      worst = Math.max(worst, Math.abs(at(tr, q.x, q.y) - at(t0, p.x, p.y)));
    }
    check(`${type} at Rotation ${deg}: the bands are the unturned ones, turned ${deg} degrees clockwise`, worst < 1e-9,
      String(worst));
  }
  const t0 = posTool(type), t30 = posTool(type, { rot: 30 });
  check(`${type}: Rotation 30 changes the bands`, OFFSETS.some(p => !near(at(t0, p.x, p.y), at(t30, p.x, p.y), 1e-6)));
}

// -- Zoom scales the band spacing about the start point ------------------------------------------------------------
for (const type of EDGE) {
  for (const z of [200, 50, 135]) {
    const t1 = posTool(type), tz = posTool(type, { zoom: z });
    let worst = 0;
    for (const p of OFFSETS) {
      const f = z / 100;
      worst = Math.max(worst, Math.abs(at(tz, p.x * f, p.y * f) - at(t1, p.x, p.y)));
    }
    check(`${type} at Zoom ${z}: the bands are ${z / 100} times as far apart`, worst < 1e-9, String(worst));
  }
  const rep1 = posTool(type, { wrap: 'repeat', repeats: 3 });
  const rep2 = posTool(type, { wrap: 'repeat', repeats: 3, zoom: 200 });
  check(`${type}: with Repeats, Zoom 200 makes each repeat twice as wide`,
    OFFSETS.every(p => near(at(rep2, 2 * p.x, 2 * p.y), at(rep1, p.x, p.y))));
}

// -- neither applies to the drag-led styles -------------------------------------------------------------------------
for (const type of DRAG_LED) {
  const t = posTool(type, { end: { x: SX + 30, y: SY + 20 } });
  const o = posTool(type, { end: { x: SX + 30, y: SY + 20 }, rot: 45, zoom: 200 });
  check(`${type}: Rotation and Zoom change nothing (the drag sets its direction and length)`,
    OFFSETS.every(p => at(t, p.x, p.y) === at(o, p.x, p.y)));
}

// -- drawing ------------------------------------------------------------------------------------------------------
// Each scenario draws into its own 40 x 40 box; the boxes start on multiples of 8 so the screen-anchored dither
// matrix has the same phase in every box and two boxes can be compared pixel for pixel.
const BOX = 40;
const box = (col, row) => ({ x: col * 48, y: row * 48 });
function drawBox(tool, b, end) {
  tool.onPointerDown(b.x, b.y, ev());
  tool.onPointerUp(b.x + BOX - 1, b.y + BOX - 1, ev());
  const e = end || { x: b.x + BOX - 1, y: b.y + 20 };
  tool.onPointerDown(e.x, e.y, ev());
  tool.onPointerUp(e.x, e.y, ev());
}
function boxInk(b) {
  const out = [];
  for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) out.push(isInk(b.x + x, b.y + y) ? 1 : 0);
  return out;
}
const sum = (a) => a.reduce((s, v) => s + v, 0);
const sameBits = (a, b) => a.reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);
function styled(type, set = {}) {
  const t = freshTool();
  t.setGradientType(type);
  for (const [k, v] of Object.entries(set)) t['set' + k.charAt(0).toUpperCase() + k.slice(1)](v);
  return t;
}
function attrsUniform(b) {
  const sel = ColorManager.getCurrentSelection();
  let altered = 0, wrong = 0;
  for (let cy = b.y / 8; cy < (b.y + BOX) / 8; cy++) for (let cx = b.x / 8; cx < (b.x + BOX) / 8; cx++) {
    const c = layer.getCell(cx, cy);
    if (!c || !c.altered) continue;
    altered++;
    if (c.ink !== sel.ink || c.paper !== sel.paper || c.bright !== sel.bright || c.flash !== sel.flash) wrong++;
  }
  return altered > 0 && wrong === 0;
}

const A = box(0, 0);
{
  drawBox(styled('hexagon'), A);
  const ink = boxInk(A);
  check('a hexagon gradient draws ink', sum(ink) > 100, String(sum(ink)));
  check('and every cell it touched has the chosen Ink, Paper, Bright and Flash', attrsUniform(A));
  let outside = 0;
  for (let x = A.x; x < A.x + BOX; x++) if (isInk(x, A.y + BOX)) outside++;
  check('and nothing outside the dragged box', outside === 0);
}
{
  const plain = box(1, 0), rep = box(2, 0), mir = box(3, 0);
  drawBox(styled('octagon', { dithered: false }), plain);
  drawBox(styled('octagon', { dithered: false, wrapMode: 'repeat', repeatCount: 3 }), rep);
  drawBox(styled('octagon', { dithered: false, wrapMode: 'mirror', repeatCount: 3 }), mir);
  const changes = (b) => { let n = 0; for (let x = 1; x < BOX; x++) if (isInk(b.x + x, b.y + 20) !== isInk(b.x + x - 1, b.y + 20)) n++; return n; };
  check('octagon with Repeats 3 has more bands than one pass', changes(rep) > changes(plain), `${changes(plain)} -> ${changes(rep)}`);
  check('octagon with Mirror 3 has more bands than one pass', changes(mir) > changes(plain), `${changes(plain)} -> ${changes(mir)}`);
}
{
  // Steps 2: every pixel nearer than half way reads 0 and gets no ink at all; without steps the inside has some.
  const stepped = box(4, 0);
  drawBox(styled('pentagon', { gradientSteps: 2 }), stepped);
  const smooth = box(0, 1);
  drawBox(styled('pentagon'), smooth);
  const t = posTool('pentagon');
  let innerStepped = 0, innerSmooth = 0, outerStepped = 0;
  for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) {
    t.startPoint = { x: stepped.x + 20, y: stepped.y + 20 }; t.endPoint = { x: stepped.x + 39, y: stepped.y + 20 };
    const p = t._getGradientPosition(stepped.x + x, stepped.y + y);
    if (p < 0.45) { innerStepped += isInk(stepped.x + x, stepped.y + y); innerSmooth += isInk(smooth.x + x, smooth.y + y); }
    if (p > 0.55) outerStepped += isInk(stepped.x + x, stepped.y + y);
  }
  check('pentagon with Steps 2: no ink in the inner half, ink in the outer', innerStepped === 0 && outerStepped > 0,
    `inner ${innerStepped} outer ${outerStepped}`);
  check('pentagon without steps has ink in the inner half', innerSmooth > 0, String(innerSmooth));
}
{
  const base = box(1, 1), biased = box(2, 1);
  drawBox(styled('triangle'), base);
  drawBox(styled('triangle', { bias: 40 }), biased);
  check('triangle with Bias 40 draws more ink', sum(boxInk(biased)) > sum(boxInk(base)),
    `${sum(boxInk(base))} -> ${sum(boxInk(biased))}`);
}
{
  const b = box(3, 1);
  const tool = styled('hexagon', { ditherScale: 'atkinson', gradientRotation: 20, gradientZoom: 150 });
  drawBox(tool, b);
  tool.startPoint = { x: b.x + 20, y: b.y + 20 }; tool.endPoint = { x: b.x + 39, y: b.y + 20 };
  const gray = new Float64Array(BOX * BOX);
  for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) gray[y * BOX + x] = 255 * (1 - tool._getGradientPosition(b.x + x, b.y + y));
  const want = Dither.apply(gray, BOX, BOX, 'atkinson', { originX: b.x, originY: b.y });
  const got = boxInk(b);
  check('hexagon with a Dither method (Atkinson), turned and zoomed: drawn pixels equal Dither.apply of its grey',
    sameBits(got, Array.from(want)) === 0 && sum(got) > 0, `${sameBits(got, Array.from(want))} differ`);
}
{
  const b = box(4, 1);
  const tool = styled('octagon', { dithered: false, gradientRotation: 10 });
  drawBox(tool, b);
  tool.startPoint = { x: b.x + 20, y: b.y + 20 }; tool.endPoint = { x: b.x + 39, y: b.y + 20 };
  let bad = 0;
  for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) {
    const v = Math.min(63, Math.floor(tool._getGradientPosition(b.x + x, b.y + y) * 64));
    if ((v > 31 ? 1 : 0) !== (isInk(b.x + x, b.y + y) ? 1 : 0)) bad++;
  }
  check('octagon with Dithered off: ink exactly past the midpoint', bad === 0, `${bad} differ`);
}
{
  // Shape fill: a closed ink border, click inside it, the gradient stays inside.
  const b = box(0, 2);
  PixelDrawRoutine.beginBatch();
  for (let i = 0; i < BOX; i++) {
    for (const [x, y] of [[b.x + i, b.y], [b.x + i, b.y + BOX - 1], [b.x, b.y + i], [b.x + BOX - 1, b.y + i]]) {
      PixelDrawRoutine.draw(x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
    }
  }
  PixelDrawRoutine.endBatch();
  const tool = styled('triangle', { shapeConstraint: true, gradientRotation: 45 });
  tool.onPointerDown(b.x + 20, b.y + 20, ev());
  check('shape fill: one click inside the border goes to the gradient phase', tool._phase === 'gradient');
  tool.onPointerDown(b.x + 38, b.y + 20, ev());
  tool.onPointerUp(b.x + 38, b.y + 20, ev());
  let inside = 0;
  for (let y = 1; y < BOX - 1; y++) for (let x = 1; x < BOX - 1; x++) inside += isInk(b.x + x, b.y + y) ? 1 : 0;
  let outside = 0;
  for (let i = -1; i <= BOX; i++) {
    for (const [x, y] of [[b.x + i, b.y + BOX], [b.x + BOX, b.y + i]]) if (isInk(x, y)) outside++;
  }
  check('shape fill with a triangle style: ink inside the border, none outside', inside > 0 && outside === 0,
    `inside ${inside} outside ${outside}`);
}
{
  // Fill shape Circle: dragged from its centre; nothing outside the circle.
  const b = box(1, 2);
  const tool = styled('pentagon', { fillShape: 'circle', gradientRotation: -30, gradientZoom: 80 });
  tool.onPointerDown(b.x + 20, b.y + 20, ev());
  tool.onPointerUp(b.x + 38, b.y + 20, ev());
  tool.onPointerDown(b.x + 38, b.y + 20, ev());
  tool.onPointerUp(b.x + 38, b.y + 20, ev());
  let inside = 0, outside = 0;
  for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) {
    const d2 = (x - 20) ** 2 + (y - 20) ** 2;
    if (isInk(b.x + x, b.y + y)) { if (d2 <= 18 * 18) inside++; else outside++; }
  }
  check('fill shape Circle with a pentagon style: ink only inside the circle', inside > 0 && outside === 0,
    `inside ${inside} outside ${outside}`);
}
{
  const h0 = box(2, 2), h30 = box(3, 2);
  drawBox(styled('hexagon'), h0);
  drawBox(styled('hexagon', { gradientRotation: 30 }), h30);
  check('hexagon drawn at Rotation 30 differs from Rotation 0', sameBits(boxInk(h0), boxInk(h30)) > 20,
    String(sameBits(boxInk(h0), boxInk(h30))));
  const t0 = box(4, 2), t120 = box(0, 3);
  drawBox(styled('triangle'), t0);
  drawBox(styled('triangle', { gradientRotation: 120 }), t120);
  check('triangle drawn at Rotation 120 is the same as at 0', sameBits(boxInk(t0), boxInk(t120)) === 0,
    String(sameBits(boxInk(t0), boxInk(t120))));
  const z100 = box(1, 3), z200 = box(2, 3);
  drawBox(styled('square', { dithered: false, wrapMode: 'repeat', repeatCount: 4 }), z100);
  drawBox(styled('square', { dithered: false, wrapMode: 'repeat', repeatCount: 4, gradientZoom: 200 }), z200);
  const changes = (b) => { let n = 0; for (let x = 1; x < BOX; x++) if (isInk(b.x + x, b.y + 20) !== isInk(b.x + x - 1, b.y + 20)) n++; return n; };
  check('square with Repeats 4 at Zoom 200 has fewer, wider bands than at Zoom 100', changes(z200) < changes(z100),
    `${changes(z100)} -> ${changes(z200)}`);
}

// The manual's paragraph on the styles must not promise an option for a style the panel hides it for: Wrap, Repeats
// and Curve are not shown for Reflected, so the sentence naming Repeats and Curve has to name that style as the
// exception, and Radial (round, not led by the drag) must not be counted among the drag-led styles.
{
  const fs = require('fs');
  const path = require('path');
  const md = fs.readFileSync(path.join(__dirname, '..', 'manual', 'content', '50-tools.md'), 'utf8');
  const para = md.split(/\r?\n/).find((l) => l.startsWith('**Gradient styles, Rotation and Zoom.**')) || '';
  check('the Tools chapter has the Gradient styles paragraph', para.length > 0);
  const schema = GradientTool.optionsSchema;
  const label = (key) => window.i18n_en[key];
  const typeLabel = (v) => label(schema.find((e) => e.key === 'gradientType').options.find((o) => o.value === v).i18n);
  const sentences = para.split(/(?<=\.)\s+/);
  for (const key of ['repeatCount', 'gammaCurve']) {
    const row = schema.find((e) => e.key === key);
    const hiddenFor = [].concat(...[row.showIf].flatMap((s) => (s.all || [s]))
      .filter((s) => s.key === 'gradientType' && s.notIn).map((s) => s.notIn));
    const s = sentences.find((t) => t.includes(label('opt.repeatCount')) && t.includes(label('opt.gammaCurve'))) || '';
    for (const v of hiddenFor) {
      check(`the manual names ${typeLabel(v)} as a style without ${label(row.i18n)}`, s.includes(typeLabel(v)), s);
    }
  }
  const dragLed = sentences.find((t) => /direction from the drag/.test(t)) || '';
  check('the manual does not say Radial takes its direction from the drag',
    !new RegExp(`(other styles|${typeLabel('radial')}[^.]*take their direction)`).test(dragLed), dragLed);
}

summary();
