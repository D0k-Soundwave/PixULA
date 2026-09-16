'use strict';
/**
 * A preview must be the picture the commit leaves.
 *
 * The shape, curve and gradient previews used to hand-roll the compositor:
 * they painted the rail's colours whatever the draw mode was, ignored the
 * "use existing" boxes, and had no idea about the indexed Next modes or the
 * GigaScreen blend - so what the artist dragged out was not what landed
 * (2026-09-16). They now SIMULATE the write through the real gate
 * (PixelDrawRoutine.simulateCell) and ask the real compositor how the page
 * would show it (LayerManager.previewCellColours).
 *
 * This drives both sides for every draw mode x transparent box x bright/flash
 * combination, over the modes whose compose paths differ (classic attribute
 * cells, half-height cells, ULAplus CLUTs, the GigaScreen blend, indexed
 * pixels), against a coloured lower layer and against a bare background - and
 * fails if the preview and the real canvas ever disagree by a pixel.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

/** Records the composited RGB of every pixel the compositor writes. */
const painted = new Map();
global.CanvasSystem = withBlit({
  setPixel(x, y, r, g, b) { painted.set(x + ',' + y, r + ',' + g + ',' + b); },
  markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;   // the FLASH clock must not tick mid-comparison

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');

ColorManager.initialize();

const MODES = ['standard_ula', 'multicolor_8x4', 'ula_plus', 'gigascreen', 'layer2_256'];
const DRAW_MODES = ['normal', 'pixel_only', 'ink', 'paper', 'xor', 'xor_pixel'];

const CELL_X = 3, CELL_Y = 3;

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  LayerManager.addLayer('L2', false);
  LayerManager.setCurrentLayer(2);
}

/** Give the layer below a colour pair and some ink, so "existing" has a value. */
function seedBelow() {
  const below = LayerManager.layers[1];
  const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
  const sel = { ink: 3, paper: 5, bright: true, flash: false,
    inkTransparent: false, paperTransparent: false, index: 60 };
  for (let ly = 0; ly < ch; ly += 2) {
    for (let lx = 0; lx < cw; lx += 3) {
      PixelDrawRoutine.draw(CELL_X * cw + lx, CELL_Y * ch + ly, sel,
        DRAW_MODE.NORMAL, { layer: below, mirror: false });
    }
  }
}

/** The pixels a tool would preview in this cell: some ink, some erase. */
function writeList() {
  const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
  const inkMode = PixelDrawRoutine.resolveUserMode(true);
  const paperMode = PixelDrawRoutine.resolveUserMode(false);
  const writes = [];
  for (let ly = 0; ly < ch; ly++) {
    for (let lx = 0; lx < cw; lx++) {
      if ((lx + ly) % 4 === 0) writes.push({ localX: lx, localY: ly, mode: inkMode });
      else if ((lx + ly) % 7 === 0) writes.push({ localX: lx, localY: ly, mode: paperMode });
    }
  }
  return writes;
}

let mismatches = 0;
let compared = 0;

for (const modeId of MODES) {
  for (const drawMode of DRAW_MODES) {
    for (const inkT of [false, true]) {
      for (const paperT of [false, true]) {
        for (const bright of [false, true]) {
          for (const withLower of [false, true]) {
            enter(modeId);
            if (withLower) seedBelow();
            StateManager.setDrawMode(drawMode);
            ColorManager.setInk(2);
            ColorManager.setPaper(6);
            ColorManager.setBright(bright);
            ColorManager.setFlash(false);
            ColorManager.setInkTransparent(inkT);
            ColorManager.setPaperTransparent(paperT);
            if (typeof ColorManager.setNextInk === 'function') {
              ColorManager.setNextInk(40);
              ColorManager.setNextPaper(9);
            }

            const layer = LayerManager.getCurrentLayer();
            const selection = ColorManager.getCurrentSelection();
            const writes = writeList();

            // What the preview promises
            const simulated = PixelDrawRoutine.simulateCell(
              layer, CELL_X, CELL_Y, writes, selection);
            const promised = LayerManager.previewCellColours(
              CELL_X, CELL_Y, layer, simulated);

            // What a real write then composites onto the canvas
            const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
            painted.clear();
            for (const w of writes) {
              PixelDrawRoutine.draw(CELL_X * cw + w.localX, CELL_Y * ch + w.localY,
                selection, w.mode, { mirror: false });
            }
            LayerManager.composeCellToCanvas(CELL_X, CELL_Y);

            for (let ly = 0; ly < ch; ly++) {
              for (let lx = 0; lx < cw; lx++) {
                const real = painted.get((CELL_X * cw + lx) + ',' + (CELL_Y * ch + ly));
                const rgb = promised[ly * cw + lx];
                const preview = rgb ? rgb[0] + ',' + rgb[1] + ',' + rgb[2] : 'none';
                compared++;
                if (preview !== real) {
                  mismatches++;
                  if (mismatches <= 5) {
                    console.log(`  mismatch: ${modeId} ${drawMode} inkT=${inkT} ` +
                      `paperT=${paperT} bright=${bright} lower=${withLower} ` +
                      `at (${lx},${ly}) preview=${preview} canvas=${real}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

check(`the preview matches the composited canvas in all ${compared} pixels ` +
  `(${MODES.length} screen modes x ${DRAW_MODES.length} draw modes x the boxes)`,
  mismatches === 0);

// The preview must also follow the layer stack, not just the write: a stamp
// preview reads "what shows" through the same path.
__setActiveScreenMode('standard_ula');
AttributeSystem.clearAll();
ColorManager.applyScreenMode();
LayerManager.initialize();
LayerManager.addLayer('L2', false);
LayerManager.setCurrentLayer(2);
{
  const below = LayerManager.layers[1];
  PixelDrawRoutine.draw(24, 24, { ink: 1, paper: 4, bright: false, flash: false,
    inkTransparent: false, paperTransparent: false }, DRAW_MODE.NORMAL,
  { layer: below, mirror: false });
  const layer = LayerManager.getCurrentLayer();
  const data = LayerManager.previewCellData(3, 3, layer,
    PixelDrawRoutine.simulateCell(layer, 3, 3,
      [{ localX: 1, localY: 1, mode: DRAW_MODE.PIXEL_ONLY }],
      ColorManager.getCurrentSelection()), null);
  check('previewCellData: Pixels Only over a coloured layer keeps its colours',
    data.attrs.ink === 1 && data.attrs.paper === 4);
  check('previewCellData: the lower layer\'s own pixels are still in the composite',
    (data.pixels[0] & 0x80) !== 0);
}

summary('draw-preview-parity');
