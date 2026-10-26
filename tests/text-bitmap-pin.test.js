'use strict';
/**
 * Pins how the Text tool and BitmapText render text in a glyph-byte font BEFORE big and proportional fonts are added (Batch 10C3). Until
 * now only ZX ROM text was pinned; nothing rendered a saved 4, 6 or 8 wide library font. The fingerprints below were recorded from the
 * code before that work. Single-line behaviour must not change. (Multi-line text at a fixed Size is the one deliberate change - the
 * size-jump bug the owner asked to have fixed - so the fixed-size group uses single-line text only.)
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

// Three classic library fonts: 4, 6 and 8 wide, a few glyphs each, made from a fixed recipe
const mkFont = (width) => {
  const mask = (0xFF << (8 - width)) & 0xFF;
  const glyphs = [];
  for (let i = 0; i < 96; i++) glyphs.push(Uint8Array.from({ length: 8 }, (_, y) => ((i * 41 + y * 13 + 7) & 0xFF) & mask));
  return { name: 'F' + width, width, firstCode: 32, glyphs };
};
const fonts = { F4: mkFont(4), F6: mkFont(6), F8: mkFont(8) };
global.FontService = { getLibraryFont: (n) => fonts[n] || null, listLibrary: () => Object.keys(fonts) };

const tool = new TextTool();
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
const bits = (m) => (m ? m.width + 'x' + m.height + ':' + m.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/') : 'null');

const got = {};
// 1. _buildTextMask: families x layouts x alignments x bold / italic x one and two lines
{
  const parts = [];
  for (const fam of ['ZX ROM', 'zxfont:F4', 'zxfont:F6', 'zxfont:F8']) {
    for (const layout of ['horizontal', 'reversed', 'vertical-down', 'vertical-up']) {
      for (const align of ['left', 'center', 'right']) {
        for (const [b, i] of [[false, false], [true, false], [false, true], [true, true]]) {
          for (const text of ['Hi W', 'Hi\nWorld']) parts.push(bits(tool._buildTextMask(text, fam, b, i, layout, align)));
        }
      }
    }
  }
  got.mask = parts.length + ':' + fnv(parts.join('|'));
}
// 2. BitmapText.layout and caretRect, ZX ROM and the 6 wide font
{
  const parts = [];
  for (const fam of ['ZX ROM', 'zxfont:F6', 'zxfont:F4']) {
    tool.setFontFamily(fam);
    for (const [W, H, sx, sy] of [[8, 8, 0, 0], [16, 16, 0, 0], [12, 20, 2, 3], [5, 9, -1, -2], [30, 11, 4, 0], [6, 8, 0, 0], [3, 3, 1, 1]]) {
      for (const align of ['left', 'center', 'right']) {
        const o = { ...tool._typeLayoutOptions(), W, H, sx, sy, align };
        const lay = BitmapText.layout('Hi W\nlonger line\n\nx', o);
        parts.push(lay ? lay.width + 'x' + lay.height + ' adv' + lay.adv + ' p' + lay.pitch + ' ' + lay.lines.map(l => l.x0 + ',' + l.y0 + ',' + l.before.join('.')).join(';') + ' ' +
          lay.pixels.map(r => r.map(v => (v ? 1 : 0)).join('')).join('/') : 'null');
        for (let line = 0; line < 4; line++) for (let col = 0; col <= 12; col++) {
          const c = BitmapText.caretRect(lay, line, col, o);
          parts.push([c.x, c.y, c.w, c.h].join(','));
        }
      }
    }
  }
  got.layout = parts.length + ':' + fnv(parts.join('|'));
}
// 3. The size a single-line stamp is made at, and the width a font change gives
{
  const parts = [];
  for (const fam of ['ZX ROM', 'zxfont:F4', 'zxfont:F6', 'zxfont:F8']) {
    tool.setFontFamily(fam);
    parts.push('w' + tool._charW);
    for (const size of [8, 16, 24, 32, 48, 64]) {
      const r = tool._rasterizeAtFixedSize('Hello', size);
      parts.push(size + ':' + (r ? r.width + 'x' + r.height + ':' + fnv(r.pixels.map(rw => rw.map(v => (v ? 1 : 0)).join('')).join('/')) : 'null'));
    }
  }
  got.fixed = parts.length + ':' + fnv(parts.join('|'));
}
// 4. filterTyped and glyph availability through the tool
{
  const parts = [];
  for (const fam of ['ZX ROM', 'zxfont:F6']) {
    tool.setFontFamily(fam);
    const g = tool._glyphSource();
    const f = BitmapText.filterTyped('Hi é~\n€Z{}', g.glyphOf);
    parts.push(f.text + '|' + f.refused.join('') + '|' + g.w0 + 'x' + g.h0);
  }
  got.typed = fnv(parts.join('|'));
}

if (process.env.PIN_PRINT) console.log(JSON.stringify(got, null, 1));
const want = require('./helpers/text-bitmap-pin.json');
for (const k of Object.keys(want)) check(`text rendering pinned: ${k}`, got[k] === want[k], `${got[k]} vs ${want[k]}`);
check('every pinned group is covered', Object.keys(want).length === Object.keys(got).length);
summary();
