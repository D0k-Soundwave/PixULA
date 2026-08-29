'use strict';
/**
 * Hot-path benchmark for the render/compose pipeline.
 *
 * Sibling of tools/palette-bench.js: a measurement instrument, not a test.
 * It boots the real app in the real browser (the Playwright harness's Chrome,
 * driven over file://) and times the paths that run while an artist draws,
 * so a performance change can be stated as an M figure instead of asserted.
 *
 *   node tools/perf-bench.js            # STANDARD_ULA
 *   node tools/perf-bench.js layer2_640 # the largest canvas the app makes
 *
 * Reported figures are the MEDIAN of `RUNS` timed passes after `WARMUP`
 * discarded ones - a median rather than a mean because the first pass after
 * a mode switch pays for JIT and cache population, and one such outlier
 * moves a mean over a handful of samples but not a median.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const MODE = process.argv[2] || 'standard_ula';
const WARMUP = 3;
const RUNS = 15;
const LAYERS = Number(process.argv[3] || 1);

/** Median of a numeric array. Does not mutate the input. */
function median(xs) {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const fmt = (ms) => (ms < 1 ? ms.toFixed(3) : ms.toFixed(2)) + ' ms';

async function main() {
    let chromium;
    try {
        ({ chromium } = require('@playwright/test'));
    } catch (e) {
        console.error('Needs the test harness: npm install');
        process.exit(1);
    }

    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });

    if (MODE !== 'standard_ula') {
        await page.evaluate((m) => ScreenModeService.switchMode(m), MODE);
    }

    // Compose cost scales with the number of visible layers carrying altered
    // cells, so the worst case is the layer cap, not the default document.
    if (LAYERS > 1) {
        await page.evaluate((n) => {
            for (let i = LayerManager.layers.length; i < n + 1; i++) {
                LayerManager.addLayer('Bench ' + i, false);
            }
            // Every layer must actually carry altered cells, or the compose
            // loop skips them and the figure understates the real worst case.
            const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
            for (let li = 1; li < LayerManager.layers.length; li++) {
                const layer = LayerManager.layers[li];
                for (let cy = 0; cy < rows; cy++)
                    for (let cx = 0; cx < cols; cx++) {
                        const cell = layer.getCell(cx, cy);
                        if (cell) { cell.altered = true; cell.pixels[0] = 0xAA; }
                    }
            }
        }, LAYERS);
    }

    const results = await page.evaluate(async ({ warmup, runs }) => {
        const out = {};
        // Chrome clamps performance.now() to ~0.1ms, which is the same order
        // as a single pass of some of these. Each sample therefore times
        // `reps` passes and divides, so the reported figure is a real
        // per-pass cost rather than a quantised one.
        const time = (label, reps, fn) => {
            for (let i = 0; i < warmup * reps; i++) fn();
            const samples = [];
            for (let i = 0; i < runs; i++) {
                const t0 = performance.now();
                for (let r = 0; r < reps; r++) fn();
                samples.push((performance.now() - t0) / reps);
            }
            out[label] = samples;
        };

        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        out._geometry = {
            mode: ACTIVE_SCREEN_MODE.id,
            width: ZX_SPECTRUM.WIDTH, height: ZX_SPECTRUM.HEIGHT,
            cells: cols * rows, pixels: ZX_SPECTRUM.WIDTH * ZX_SPECTRUM.HEIGHT,
            layers: LayerManager.layers.length
        };

        // 1. A full recompose - what every layer toggle, undo and merge costs.
        time('composeToCanvas', 200, () => LayerManager.composeToCanvas());

        // 2. The queue-a-cell call the draw gate makes once per PIXEL written.
        //    Timed over one size-32 disc's worth of pixels (804) so the figure
        //    is "per brush stamp" rather than per call.
        time('deferCellCompose x804', 2000, () => {
            for (let i = 0; i < 804; i++) {
                LayerManager.deferCellCompose(i % cols, (i * 7) % rows);
            }
            LayerManager._pendingComposeCells.clear();
        });

        // 3. The dirty-set round trip: mark every cell, then the render pass's
        //    own decode of those keys. Measured together because they are two
        //    halves of one encoding choice.
        time('markCellDirty full canvas', 2000, () => {
            for (let cy = 0; cy < rows; cy++)
                for (let cx = 0; cx < cols; cx++) CanvasSystem.markCellDirty(cx, cy);
            CanvasSystem.dirtyRegions.clear();
        });

        // 4. The selection overlay, which re-renders on EVERY frame that has
        //    any dirty cell for as long as a selection exists - including
        //    while drawing inside one, which is what the clip/frisket modes
        //    are for. Measured with a selection over a quarter of the canvas.
        if (window.SelectionService && window.GridOverlay) {
            SelectionService.setSelection({
                x: 0, y: 0,
                width: Math.floor(ZX_SPECTRUM.WIDTH / 2),
                height: Math.floor(ZX_SPECTRUM.HEIGHT / 2)
            });
            time('selection overlay frame', 200, () => GridOverlay._renderSelectionOverlay());
            SelectionService.clear();
            time('no-selection overlay frame', 2000, () => GridOverlay._renderSelectionOverlay());
        }

        // 5. setPixel across the whole canvas - the compose inner loop's
        //    per-pixel cost, isolated from the compositing decisions above.
        time('setPixel full canvas', 200, () => {
            const w = ZX_SPECTRUM.WIDTH, h = ZX_SPECTRUM.HEIGHT;
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) CanvasSystem.setPixel(x, y, 0, 0, 0);
        });

        return out;
    }, { warmup: WARMUP, runs: RUNS });

    const g = results._geometry;
    delete results._geometry;

    console.log('');
    console.log('PixULA hot-path benchmark');
    console.log('  mode      ' + g.mode + '  ' + g.width + 'x' + g.height +
                '  (' + g.cells + ' cells, ' + g.pixels + ' pixels, ' + g.layers + ' layers)');
    console.log('  method    median of ' + RUNS + ' runs after ' + WARMUP + ' warmup');
    console.log('  date      ' + new Date().toISOString().slice(0, 10));
    console.log('');
    for (const [label, samples] of Object.entries(results)) {
        const med = median(samples);
        const lo = Math.min(...samples), hi = Math.max(...samples);
        console.log('  ' + label.padEnd(28) + fmt(med).padStart(10) +
                    '   (min ' + fmt(lo) + ', max ' + fmt(hi) + ')');
    }
    console.log('');

    await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
