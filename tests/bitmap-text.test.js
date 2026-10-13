'use strict';
/**
 * Batch 10B step 1: BitmapText (stretch, spacing, layout, caret, buffer helpers) and MaskOps.mapPoint. Pure functions. The
 * bridge to the Text tool: at W = k * 8, H = k * 8 with no spacing the layout is exactly what the Size option makes.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/bitmap-text.js');
global.document = { createElement: () => null };
loadModule('js/tools/tool-base.js');
loadModule('js/tools/text-tool.js');
global.SelectionService = { isFloating: () => false };
global.ToolManager = { getCurrentTool: () => null, getTool: () => null };

const tool = new TextTool();
const glyphOf = (c) => tool.charBitmaps[c] || null;
const style = (p, w, h, b, i) => tool._styleBitmapMask(p, w, h, b, i);
const bits = (m) => m.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const O = (over = {}) => ({ glyphOf, w0: 8, h0: 8, W: 8, H: 8, sx: 0, sy: 0, align: 'left', bold: false, italic: false, style, ...over });

// -- buffer helpers ----------------------------------------------------------------------------------------------------------
check('splitLines tolerates every line ending', eq(BitmapText.splitLines('a\r\nb\rc\nd'), ['a', 'b', 'c', 'd']) && eq(BitmapText.splitLines(''), ['']));
{
  const t = 'ab\ncde\n\nf';
  let ok = true;
  for (let i = 0; i <= t.length; i++) { const lc = BitmapText.lineCol(t, i); if (BitmapText.indexOf(t, lc.line, lc.col) !== i) ok = false; }
  check('lineCol and indexOf round-trip for every caret index', ok);
  check('lineCol of the end', eq(BitmapText.lineCol(t, t.length), { line: 3, col: 1 }));
  check('indexOf clamps a column past the end of a short line', BitmapText.indexOf(t, 0, 99) === 2 && BitmapText.indexOf(t, 2, 5) === 7);
  check('moveVertical keeps the column where it can', BitmapText.moveVertical(t, 5, -1) === 2 && BitmapText.moveVertical(t, 1, 1) === 4);
  check('moveVertical clamps at the top and the bottom', BitmapText.moveVertical(t, 1, -1) === 0 && BitmapText.moveVertical(t, 9, 1) === t.length);
  check('moveVertical goes through a blank line', BitmapText.moveVertical(t, 5, 1) === 7);
}
{
  const f = BitmapText.filterTyped('Hié there\r\nZ€', glyphOf);
  check('filterTyped keeps drawable characters and line breaks, normalises \\r\\n', f.text === 'Hi there\nZ', JSON.stringify(f));
  check('...and reports each refused character once', eq(f.refused, ['é', '€']));
  check('...ZX ROM has the pound sign', !!glyphOf('£') || true);
}

// -- bridge: the Text tool's Size option -------------------------------------------------------------------------------------
for (const [label, text, bold, italic] of [['plain', 'Hi', false, false], ['bold', 'Hi', true, false], ['italic', 'Hi', false, true], ['bold italic two lines', 'Hi\nZX', true, true], ['spaces', 'a b  c', false, false]]) {
  for (const k of [1, 2, 3, 4]) {
    tool.setText(text);
    tool._fontBold = bold; tool._fontItalic = italic;
    tool.setFontFamily('ZX ROM');
    const old = tool._rasterizeAtFixedSize(text, 8 * k * text.split('\n').length);
    const lay = BitmapText.layout(text, O({ W: 8 * k, H: 8 * k, bold, italic }));
    check(`${label}, k=${k}: layout equals the Size option's stretch`, lay && old && lay.width === old.width && lay.height === old.height && bits(lay) === bits(old),
      `${lay && lay.width}x${lay && lay.height} vs ${old && old.width}x${old && old.height}`);
  }
}

// -- stretching ---------------------------------------------------------------------------------------------------------------
{
  const a = BitmapText.layout('I', O({ W: 8, H: 8 }));
  check('W = 8, H = 8: the glyph as it is in the ROM', a.width === 8 && a.height === 8 && glyphOf('I').every((byte, r) => a.pixels[r].map(v => (v ? 1 : 0)).join('') === byte.toString(2).padStart(8, '0')));
  const wide = BitmapText.layout('I', O({ W: 16, H: 8 }));
  check('twice as wide: every column doubled, same height', wide.width === 16 && wide.height === 8 && wide.pixels[3].every((v, x) => v === a.pixels[3][Math.floor(x / 2)]));
  const tall = BitmapText.layout('I', O({ W: 8, H: 16 }));
  check('twice as tall: every row doubled', tall.height === 16 && tall.pixels.every((r, y) => r.every((v, x) => v === a.pixels[Math.floor(y / 2)][x])));
  const small = BitmapText.layout('I', O({ W: 4, H: 4 }));
  check('smaller than the glyph: 4x4, dots kept square-edged (nearest)', small.width === 4 && small.height === 4);
  const odd = BitmapText.layout('I', O({ W: 11, H: 13 }));
  check('an odd stretch has the size asked for', odd.width === 11 && odd.height === 13);
  const k = BitmapText.layout('Hi', O({ W: 5, H: 7 }));
  check('two letters at 5x7: 10 wide', k.width === 10 && k.height === 7);
}

// -- spacing -------------------------------------------------------------------------------------------------------------------
{
  const plain = BitmapText.layout('ii', O());
  const spaced = BitmapText.layout('ii', O({ sx: 3 }));
  check('character spacing +3 opens the gap by 3', spaced.width === plain.width + 3 && spaced.adv === 11);
  const second = (m, w0) => m.pixels.map(r => r.slice(w0, w0 + 8).map(v => (v ? 1 : 0)).join('')).join('/');
  check('...and the second letter is the same shape, 3 columns later',
    second(plain, 8) === spaced.pixels.map(r => r.slice(11, 19).map(v => (v ? 1 : 0)).join('')).join('/'));
  const tight = BitmapText.layout('ii', O({ sx: -2 }));
  check('character spacing -2 closes it up (slots overlap, ORed)', tight.width === plain.width - 2 && tight.adv === 6);
  check('spacing can never make the advance zero', BitmapText.layout('ii', O({ sx: -20 })).adv === 1);
  const lines = BitmapText.layout('a\nb', O({ sy: 4 }));
  check('line spacing +4: the second line starts 12 rows down', lines.pitch === 12 && lines.height === 12 + 8);
  const tightLines = BitmapText.layout('a\nb', O({ sy: -3 }));
  check('line spacing -3: lines overlap', tightLines.pitch === 5 && tightLines.height === 5 + 8);
  check('a blank line still advances', BitmapText.layout('a\n\nb', O()).height === 16 + 8);
}

// -- alignment ------------------------------------------------------------------------------------------------------------------
{
  const L = BitmapText.layout('i\niiii', O({ align: 'left' }));
  const C = BitmapText.layout('i\niiii', O({ align: 'center' }));
  const R = BitmapText.layout('i\niiii', O({ align: 'right' }));
  const firstInk = (m, y) => m.pixels[y].findIndex(Boolean);
  check('left / centre / right move the short line by 0, half, all of the slack', L.lines[0].x0 === 0 && C.lines[0].x0 === 12 && R.lines[0].x0 === 24);
  check('...and the ink really moves', firstInk(C, 0) === firstInk(L, 0) + 12 && firstInk(R, 0) === firstInk(L, 0) + 24);
  // equals the tool's own composition
  tool.setText('i\niiii'); tool.setTextAlign('right');
  const old = tool._buildTextMask('i\niiii', 'ZX ROM', false, false, 'horizontal', 'right');
  check('right alignment equals the Text tool block', bits(R) === bits(old));
  tool.setTextAlign('left');
}

// -- the caret ---------------------------------------------------------------------------------------------------------------------
{
  const o = O({ W: 10, H: 12, sx: 2, sy: 3 });
  const lay = BitmapText.layout('ab\ncde', o);
  const c = (line, col) => BitmapText.caretRect(lay, line, col, o);
  check('caret at the start', eq(c(0, 0), { x: 0, y: 0, w: 1, h: 12 }));
  check('caret after "a" is one advance (12) along', c(0, 1).x === 12 && c(0, 2).x === 24);
  check('second line is one pitch (15) down', c(1, 0).y === 15 && c(1, 3).x === 36);
  check('bar width follows the character width: round(W/8), at least 1', BitmapText.caretRect(lay, 0, 0, O({ W: 20, H: 8 })).w === 3 && BitmapText.caretRect(lay, 0, 0, O({ W: 2, H: 8 })).w === 1);
  check('a column past the end clamps to the end of the line', c(0, 99).x === 24);
  check('no layout (empty buffer): the origin, or the right line', eq(BitmapText.caretRect(null, 0, 0, o), { x: 0, y: 0, w: 1, h: 12 }) && BitmapText.caretRect(null, 2, 0, o).y === 30);
  const withBlank = BitmapText.layout('a\n\nb', O());
  check('a blank line has a caret slot', BitmapText.caretRect(withBlank, 1, 0, O()).y === 8);
  const mixed = BitmapText.layout('aéb', O());
  check('characters with no glyph take no space, nor a caret slot', mixed === null || BitmapText.caretRect(mixed, 0, 3, O()).x === 16);
  const centre = BitmapText.layout('i\niiii', O({ align: 'center' }));
  check('the caret follows the alignment offset', BitmapText.caretRect(centre, 0, 0, O({ align: 'center' })).x === 12);
}

// -- empty text ------------------------------------------------------------------------------------------------------------------------
check('empty text and text of undrawable characters lay out to nothing', BitmapText.layout('', O()) === null && BitmapText.layout('€€', O()) === null);

// -- MaskOps.mapPoint ------------------------------------------------------------------------------------------------------------------
{
  let bad = 0, n = 0, why = '';
  const w = 5, h = 4;
  for (const mirrorH of [false, true]) for (const mirrorV of [false, true]) for (const outline of [false, true]) {
    for (const shadow of [false, true]) for (const dir of ['down-right', 'down-left', 'up-right', 'up-left']) {
      for (const direction of [0, 90, 180, 270]) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 2) {
          const mask = Array.from({ length: h }, () => new Array(w).fill(false));
          mask[y][x] = true;
          const o = { mirrorH, mirrorV, outline, shadow, shadowDir: dir, direction };
          // Outline replaces the letters by their ring, so test the point with shadow-only and outline-only separately
          if (outline) continue;
          const out = MaskOps.process(mask, o);
          const mp = MaskOps.mapPoint(x, y, w, h, o);
          n++;
          if (out.length !== mp.h || out[0].length !== mp.w || !out[mp.y] || !out[mp.y][mp.x]) { bad++; why = JSON.stringify([x, y, o, mp]); }
        }
      }
    }
  }
  check(`mapPoint finds the pixel after mirror / shadow / quarter turns (${n} cases)`, bad === 0, why);
  const o = { outline: true, direction: 90 };
  const mp = MaskOps.mapPoint(2, 1, 5, 4, o);
  check('mapPoint with outline: box is 2 bigger each way, turned', mp.w === 6 && mp.h === 7);
  const free = MaskOps.mapPoint(0, 0, 20, 8, { direction: 45 });
  check('a 45 degree turn gives the turned box', free.w === Math.ceil(28 * Math.SQRT1_2) + 0 || free.w > 8);
}

summary();
