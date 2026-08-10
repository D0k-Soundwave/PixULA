'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({
  CanvasSystem: { getImageData: () => null },
  LayerManager: { getCurrentLayer: () => null, composeToCanvas: () => {} },
  AttributeSystem: { setCell: () => {} },
  UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
loadModule('js/utils/palette-ops.js');
loadModule('js/io/png-format.js');

// Build a 64-pixel cell: `countA` pixels of rgbA, rest rgbB (row-major)
function cell(rgbA, countA, rgbB) {
  const c = new Float32Array(192);
  for (let i = 0; i < 64; i++) {
    const [r, g, b] = i < countA ? rgbA : rgbB;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
  }
  return c;
}

// 1. Non-bright pair stays non-bright (dark red + dark white are exact bank-0 hits)
let pair = PNGFormat._chooseCellPair(cell([215, 0, 0], 20, [215, 215, 215]));
check('dark red + dark white -> bank 0', pair.bright === false);
check('paper is majority colour (white)', pair.paper === 7, `got ${pair.paper}`);
check('ink is minority colour (red)', pair.ink === 2, `got ${pair.ink}`);

// 2. Bright pair chosen when pixels are bright (255-level)
pair = PNGFormat._chooseCellPair(cell([255, 255, 255], 40, [0, 0, 0]));
check('bright white + black -> bright bank', pair.bright === true);
check('bright paper index', pair.paper === 15, `got ${pair.paper}`);

// 3. Mixed banks: majority colour wins the bank (48 bright-white px vs 16 dark-red px)
pair = PNGFormat._chooseCellPair(cell([255, 255, 255], 48, [215, 0, 0]));
check('majority bright white forces bright bank', pair.bright === true);
check('red maps to bright red in-bank', pair.ink === 10, `got ${pair.ink}`);

// 4. ...and the other way round (56 dark-red px vs 8 bright-white px —
//    at this ratio the total error is lower in bank 0)
pair = PNGFormat._chooseCellPair(cell([215, 0, 0], 56, [255, 255, 255]));
check('majority dark red keeps bank 0', pair.bright === false,
  `bright=${pair.bright} ink=${pair.ink} paper=${pair.paper}`);

// 5. Uniform cell: ink === paper, no crash
pair = PNGFormat._chooseCellPair(cell([0, 0, 215], 64, [0, 0, 0]));
check('uniform cell -> ink === paper === blue', pair.ink === 1 && pair.paper === 1);

// 6. Exact 32/32 count tie: the stable sort keeps palette order, so the
//    lower index (blue, 1) becomes paper and the higher (red, 2) ink
pair = PNGFormat._chooseCellPair(cell([0, 0, 215], 32, [215, 0, 0]));
check('32/32 tie -> lower index is paper', pair.paper === 1, `got ${pair.paper}`);
check('32/32 tie -> higher index is ink', pair.ink === 2, `got ${pair.ink}`);

// 7. Equidistant pixels (ink === paper => every pixel is an exact tie):
//    _renderCellMask's <= tie-break must classify them all as ink
const uniform = cell([0, 0, 215], 64, [0, 0, 0]);
const uniformMask = PNGFormat._renderCellMask(uniform, { ink: 1, paper: 1, bright: false }, 'none');
check('ink/paper tie renders as ink (all rows 0xFF)',
  Array.from(uniformMask).every((row) => row === 0xFF),
  `rows=[${Array.from(uniformMask).join(',')}]`);

// --- mask rendering ---
// 24 red pixels (rows 0-2), 40 white -> white is majority (paper),
// red is ink, so ink bits are set on the top 3 rows only
const half = cell([215, 0, 0], 24, [215, 215, 215]);
const p = PNGFormat._chooseCellPair(half);
check('red is ink, white is paper', p.ink === 2 && p.paper === 7);
const mask = PNGFormat._renderCellMask(half, p, 'none');
check('mask rows 0-2 are ink (0xFF)', mask[0] === 0xFF && mask[2] === 0xFF);
check('mask rows 3-7 are paper (0x00)', mask[3] === 0x00 && mask[7] === 0x00);

// Dithering a mid-grey cell between black and white produces a mix of bits
const grey = cell([108, 108, 108], 64, [0, 0, 0]);
const gp = { ink: 7, paper: 0, bright: false };
const dithered = PNGFormat._renderCellMask(grey, gp, 'floyd-steinberg');
let setBits = 0;
for (const row of dithered) for (let b = 0; b < 8; b++) if (row & (1 << b)) setBits++;
check('dithered mid-grey mixes ink and paper', setBits > 8 && setBits < 56, `setBits=${setBits}`);

// Without dithering the same grey collapses to one colour
const flat = PNGFormat._renderCellMask(grey, gp, 'none');
const flatBits = Array.from(flat).reduce((n, row) => {
  for (let b = 0; b < 8; b++) if (row & (1 << b)) n++;
  return n;
}, 0);
check('undithered mid-grey is uniform', flatBits === 0 || flatBits === 64, `bits=${flatBits}`);

summary();
