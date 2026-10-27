'use strict';
/**
 * Animation sizing benchmark - a measurement instrument, not a test.
 *
 * Sibling of tools/perf-bench.js. Before the animation system was built its
 * plan rested on three guesses; this instrument turns each into an M figure
 * (docs/FIGURES.md):
 *
 *  1. FRAME CHANGE - what showing another frame costs: pack every drawing
 *     layer (the flush), unpack a different grid into it, recompose. Against
 *     the 20 ms Spectrum frame a 1-tick animation frame has to fit in.
 *  2. AUTOSAVE - what one autosave of a big animation costs: the IndexedDB
 *     write and the .pixula encode (the backup), with N extra packed grids
 *     standing in for stored frames. Against the 100 ms an interface may
 *     stall before it stops feeling immediate (Nielsen, 1993).
 *  3. CLOCK - screen updates a setTimeout playback clock requests against an
 *     animation-frame loop, both stepping frames at 10 per second.
 *
 *   node tools/anim-bench.js [mode] [layers] [frames]
 *   node tools/anim-bench.js layer2_640 32 500
 *
 * Figures are medians (see perf-bench.js for why). Measure back to back:
 * this machine's throughput moves with its thermal state.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const MODE = process.argv[2] || 'standard_ula';
const LAYERS = Number(process.argv[3] || 1);
const FRAMES = Number(process.argv[4] || 32);
const WARMUP = 3;
const RUNS = 11;

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

    // The installed Chrome when there is one, else Playwright's own Chromium.
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
        .catch(() => chromium.launch({ channel: 'chromium', headless: true }));
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
    if (MODE !== 'standard_ula') {
        await page.evaluate((m) => ScreenModeService.switchMode(m), MODE);
    }

    // Every layer carries altered cells, as in perf-bench, so the compose and
    // the packs see a full document rather than an empty one.
    await page.evaluate((n) => {
        for (let i = LayerManager.layers.length; i < n + 1; i++) LayerManager.addLayer('Bench ' + i, false);
        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        for (let li = 1; li < LayerManager.layers.length; li++) {
            const layer = LayerManager.layers[li];
            for (let cy = 0; cy < rows; cy++)
                for (let cx = 0; cx < cols; cx++) {
                    const cell = layer.getCell(cx, cy);
                    if (cell) { cell.altered = true; cell.pixels[0] = 0xAA ^ li; }
                }
        }
        LayerManager.composeToCanvas();
    }, LAYERS);

    const results = await page.evaluate(async ({ warmup, runs, frames }) => {
        const out = {};
        const time = (label, fn) => {
            for (let i = 0; i < warmup; i++) fn();
            const samples = [];
            for (let i = 0; i < runs; i++) {
                const t0 = performance.now();
                fn();
                samples.push(performance.now() - t0);
            }
            out[label] = samples;
        };
        const timeAsync = async (label, fn, n = runs) => {
            await fn();
            const samples = [];
            for (let i = 0; i < n; i++) {
                const t0 = performance.now();
                await fn();
                samples.push(performance.now() - t0);
            }
            out[label] = samples;
        };

        const drawing = LayerManager.layers.slice(1);
        // Two "frames": the live grids, and a second packed set to swap in.
        const other = drawing.map((l) => l.packAttributeData());

        // 1. Frame change, in its three parts and whole.
        time('flush (pack all layers)', () => { for (const l of drawing) l.packAttributeData(); });
        time('unpack all layers', () => { drawing.forEach((l, i) => l.unpackAttributeData(other[i])); });
        time('composeToCanvas', () => LayerManager.composeToCanvas());
        time('frame change (whole)', () => {
            for (const l of drawing) l.packAttributeData();
            drawing.forEach((l, i) => l.unpackAttributeData(other[i]));
            LayerManager.composeToCanvas();
        });

        // 2. Autosave and backup with `frames` stored frames of every layer.
        const project = App._getProjectData({ packed: true });
        const cels = [];
        for (let f = 0; f < frames; f++) {
            for (const l of drawing) cels.push(l.packAttributeData()); // distinct buffers, as real frames are
        }
        project.benchCels = cels;
        let bytes = 0;
        for (const c of cels) {
            for (const k of ['ink', 'paper', 'flags', 'pixels', 'indices', 'transparent', 'inkB', 'paperB', 'flagsB', 'pixelsB']) {
                if (c[k]) bytes += c[k].length;
            }
        }
        out._celBytes = bytes;
        await timeAsync('autosave IndexedDB write', () => Storage.set('anim-bench', project), 3);
        let encoded = null;
        await timeAsync('.pixula encode (backup)', async () => { encoded = await ProjectFormat.encode(project); }, 3);
        out._fileBytes = encoded ? encoded.length || encoded.byteLength || 0 : 0;
        await Storage.delete('anim-bench');

        // 3. Playback clocks: screen updates requested while stepping 10
        //    frames a second for 2 s. Counted by wrapping requestAnimationFrame.
        const count = async (useRaf) => {
            const realRaf = window.requestAnimationFrame;
            let requests = 0;
            window.requestAnimationFrame = (cb) => { requests++; return realRaf(cb); };
            const start = performance.now();
            const step = 100;
            await new Promise((resolve) => {
                let last = -1;
                if (useRaf) {
                    const tick = (now) => {
                        const f = Math.floor((now - start) / step);
                        if (f !== last) { last = f; CanvasSystem.requestRender(); }
                        if (now - start < 2000) window.requestAnimationFrame(tick); else resolve();
                    };
                    window.requestAnimationFrame(tick);
                } else {
                    let n = 0;
                    const next = () => {
                        CanvasSystem.requestRender();
                        n++;
                        if (n * step >= 2000) { resolve(); return; }
                        setTimeout(next, Math.max(0, start + n * step - performance.now()));
                    };
                    next();
                }
            });
            window.requestAnimationFrame = realRaf;
            return requests / 2;
        };
        out._clockTimeout = await count(false);
        out._clockRaf = await count(true);
        out._geometry = { mode: ACTIVE_SCREEN_MODE.id, cells: ZX_SPECTRUM.GRID_COLS * ZX_SPECTRUM.GRID_ROWS, layers: drawing.length };
        return out;
    }, { warmup: WARMUP, runs: RUNS, frames: FRAMES });

    const g = results._geometry;
    console.log('');
    console.log('PixULA animation benchmark');
    console.log('  mode      ' + g.mode + '  (' + g.cells + ' cells, ' + g.layers + ' drawing layers, ' + FRAMES + ' stored frames)');
    console.log('  method    median of ' + RUNS + ' runs after ' + WARMUP + ' warmup (saves: 3 runs)');
    console.log('  date      ' + new Date().toISOString().slice(0, 10));
    console.log('');
    for (const [label, samples] of Object.entries(results)) {
        if (label.startsWith('_')) continue;
        console.log('  ' + label.padEnd(28) + fmt(median(samples)).padStart(10) +
                    '   (min ' + fmt(Math.min(...samples)) + ', max ' + fmt(Math.max(...samples)) + ')');
    }
    console.log('  stored frame bytes          ' + (results._celBytes / 1e6).toFixed(1) + ' MB packed');
    console.log('  .pixula file                ' + (results._fileBytes / 1e6).toFixed(1) + ' MB gzipped');
    console.log('  screen updates at 10 fps    setTimeout ' + results._clockTimeout + '/s, animation frames ' + results._clockRaf + '/s');
    console.log('');
    await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
