'use strict';
/**
 * Batch 10C3 step 3: the Text tool draws big and proportional library fonts. A synthetic 16 x 16 font with narrow letters; the stamp
 * (the non-typing Text tool), the Size list, the font-change rule and the size-jump fix. The typed path is covered with the stamp path
 * in tests/text-type-commit.test.js.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/utils/glyph-bits.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/bitmap-text.js');
global.document = { createElement: () => null };
loadModule('js/tools/tool-base.js');
loadModule('js/tools/text-tool.js');
global.SelectionService = { isFloating: () => false };
global.ToolManager = { getCurrentTool: () => null, getTool: () => null };

const G = GlyphBits;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bits = (m) => (m ? m.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/') : null);

// 'A' (65): full 16 wide, ink in columns 0 and 15. 'i' (105): saved part is the right 8 columns (left shaded), ink at saved x 0 and 3.
// 'B' (66): shaded all the way across (left out of the file). 'W' (87): full, ink at 7 and 8.
const glyphs = Array.from({ length: 96 }, () => new Uint8Array(32));
const px = (code, x, y) => G.setPixel(glyphs[code - 32], 16, x, y, true);
for (let y = 0; y < 16; y++) { px(65, 0, y); px(65, 15, y); px(87, 7, y); px(87, 8, y); px(105, 8, y); px(105, 11, y); px(66, 4, y); }
const shade = glyphs.map(() => [0, 0]);
shade[105 - 32] = [1, 0];
shade[66 - 32] = [0, 2];
const big = { name: 'P', width: 16, height: 16, firstCode: 32, glyphs, shade };
const small6 = { name: 'S', width: 6, firstCode: 32, glyphs: Array.from({ length: 96 }, (_, i) => Uint8Array.from({ length: 8 }, (_, y) => (i * 41 + y * 13 + 7) & 0xFC)), shade: null };
global.FontService = { getLibraryFont: (n) => (n === 'P' ? big : n === 'S' ? small6 : null), listLibrary: () => ['P', 'S'] };

const tool = new TextTool();
const FAM = 'zxfont:P';

// -- the stamp mask ---------------------------------------------------------------------------------------------------------
{
  const m = tool._buildTextMask('Ai', FAM, false, false, 'horizontal', 'left');
  check('Ai: 16 + 8 wide, 16 high', m && m.width === 24 && m.height === 16);
  const col = (x) => m.pixels.reduce((n, r) => n + (r[x] ? 1 : 0), 0);
  check('A keeps both edges; i draws its saved columns only', col(0) === 16 && col(15) === 16 && col(16) === 16 && col(19) === 16 && col(17) === 0);
  const lo = tool._buildTextMask('ABi', FAM, false, false, 'horizontal', 'left');
  check('a character left out of the file takes no space', lo.width === 24);
  const rev = tool._buildTextMask('Ai', FAM, false, false, 'reversed', 'left');
  const rcol = (x) => rev.pixels.reduce((n, r) => n + (r[x] ? 1 : 0), 0);
  check('reversed puts the letters in the other order, widths included', rev.width === 24 && rcol(0) === 16 && rcol(3) === 16 && rcol(8) === 16 && rcol(23) === 16);
  const v = tool._buildTextMask('Ai', FAM, false, false, 'vertical-down', 'left');
  check('vertical: widest letter sets the width, the narrow one is centred, height is 2 cells', v.width === 16 && v.height === 32);
  const vcol = (x, y0) => v.pixels.slice(y0, y0 + 16).reduce((n, r) => n + (r[x] ? 1 : 0), 0);
  check('...the 8 wide i is centred (4 columns in)', vcol(4, 16) === 16 && vcol(7, 16) === 16 && vcol(0, 16) === 0 && vcol(0, 0) === 16);
  const vu = tool._buildTextMask('Ai', FAM, false, false, 'vertical-up', 'left');
  check('vertical-up reverses the stack', vu.height === 32 && vu.pixels.slice(0, 16).reduce((n, r) => n + (r[4] ? 1 : 0), 0) === 16);
  const two = tool._buildTextMask('Ai\nW', FAM, false, false, 'horizontal', 'right');
  check('two lines: 16 high rows, widest line sets the width, right aligned', two.height === 32 && two.width === 24);
  check('a font with a missing family draws nothing', tool._buildTextMask('A', 'zxfont:none', false, false, 'horizontal', 'left') === null);
}

// -- a classic saved font is unchanged (the pin test checks the bytes; this checks the shape) ----------------------------------
{
  const m = tool._buildTextMask('ab', 'zxfont:S', false, false, 'horizontal', 'left');
  check('a 6 wide classic font: 2 letters = 12 columns, 8 high', m.width === 12 && m.height === 8);
}

// -- Size: the scale is the Size divided by the font's own height, not by the height of the block ---------------------------------
{
  tool.setFontFamily(FAM);
  const a = tool._rasterizeAtFixedSize('Ai', 16);
  const b = tool._rasterizeAtFixedSize('Ai', 32);
  check('Size 16 on a 16 high font is 1x, Size 32 is 2x', a.width === 24 && a.height === 16 && b.width === 48 && b.height === 32);
  const two = tool._rasterizeAtFixedSize('Ai\nW', 16);
  check('two lines at Size 16 stay 1x (32 high), not squeezed', two.height === 32 && two.width === 24);
  tool.setFontFamily('ZX ROM');
  const r1 = tool._rasterizeAtFixedSize('Hi\nZX', 16);
  check('THE FIX: two lines of ZX ROM at Size 16 are 2x (32 x 32), the size the Size list says', r1.width === 32 && r1.height === 32, `${r1.width}x${r1.height}`);
  const r2 = tool._rasterizeAtFixedSize('ABC', 16);
  const vlay = tool._textLayout;
  tool._textLayout = 'vertical-down';
  const r3 = tool._rasterizeAtFixedSize('ABC', 16);
  tool._textLayout = vlay;
  check('...vertical text at Size 16 is 2x as well (16 wide, 48 high)', r2.height === 16 && r3.width === 16 && r3.height === 48, `${r3.width}x${r3.height}`);
}

// -- the Size list ------------------------------------------------------------------------------------------------------------
(async () => {
  check('Size list of ZX ROM and a classic saved font is the old list', eq(await tool.getSizesForFont('ZX ROM'), [8, 16, 24, 32, 48, 64]) && eq(await tool.getSizesForFont('zxfont:S'), [8, 16, 24, 32, 48, 64]));
  check('Size list of a 16 high font goes in steps of 16', eq(await tool.getSizesForFont(FAM), [16, 32, 48, 64]));

  // -- changing font keeps the zoom -------------------------------------------------------------------------------------------
  tool.setFontFamily('ZX ROM');
  tool.setCharHeight(16); tool.setCharWidth(16);
  tool.setFontFamily(FAM);
  check('ROM stretched 2x to a 16 high font: height 32, width 32 (the same 2x zoom)', tool._charH === 32 && tool._charW === 32, `${tool._charW}x${tool._charH}`);
  tool.setFontFamily('ZX ROM');
  check('...and back to ROM: 16 x 16 again', tool._charH === 16 && tool._charW === 16, `${tool._charW}x${tool._charH}`);
  tool.setCharHeight(8); tool.setCharWidth(8);
  tool.setFontFamily('zxfont:S');
  check('a classic 6 wide font keeps the old rule: width = 6 x height / 8', tool._charH === 8 && tool._charW === 6);
  tool.setFontFamily(FAM);
  check('1x ROM to the 16 high font: 16 x 16', tool._charH === 16 && tool._charW === 16);

  // -- typing options see the font ----------------------------------------------------------------------------------------------
  tool.setFontFamily(FAM);
  const o = tool._typeLayoutOptions();
  check('type layout options carry the span function, the stride and the font size', typeof o.spanOf === 'function' && o.fw === 16 && o.w0 === 16 && o.h0 === 16);
  check('typing refuses a left-out character like a missing one', BitmapText.filterTyped('ABéi', o.glyphOf).refused.join('') === 'Bé');
  summary();
})();
