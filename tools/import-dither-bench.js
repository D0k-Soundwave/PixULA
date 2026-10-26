'use strict';
/**
 * Times the Smooth import conversion (PNGFormat._quantizePrepared) with three dithers at standard_ula: the importer's own
 * Floyd-Steinberg, Bayer 8 and Stevenson-Arce. Median of 9, two runs. Usage: node tools/import-dither-bench.js
 */
const path = require('path');
const { installStubs, loadModule } = require(path.join(__dirname, '..', 'tests', 'helpers', 'zx-stubs'));

installStubs({
    CanvasSystem: { getImageData: () => null },
    LayerManager: { getCurrentLayer: () => null, composeToCanvas: () => {} },
    AttributeSystem: { setCell: () => {} },
    UndoRedoService: { beginAction: () => {}, endAction: () => {} }
});
for (const f of ['js/utils/helpers.js', 'js/utils/palette-ops.js', 'js/utils/dither.js', 'js/utils/giga-quant.js', 'js/io/png-format.js']) {
    loadModule(f);
}
const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
const img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
let s = 12345;
for (let i = 0; i < W * H; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    img.data[i * 4] = (i % W) * 255 / W + ((s >> 8) & 31);
    img.data[i * 4 + 1] = Math.floor(i / W) * 255 / H;
    img.data[i * 4 + 2] = (s >> 16) & 255;
    img.data[i * 4 + 3] = 255;
}
const render = PNGFormat.previewRenderer(img, 'fit');
for (const id of ['floyd-steinberg', 'bayer-8', 'stevenson-arce']) {
    const t = [];
    for (let i = 0; i < 9; i++) {
        const a = process.hrtime.bigint();
        render('smooth', id);
        t.push(Number(process.hrtime.bigint() - a) / 1e6);
    }
    t.sort((a, b) => a - b);
    console.log(id.padEnd(18) + t[4].toFixed(1) + ' ms');
}
