'use strict';
/**
 * Interaction benchmark: what a drag, a slider, a zoom step and an autosave
 * cost, driven through the app's real input pipeline.
 *
 * Sibling of tools/perf-bench.js (the compose paths) and tools/boot-bench.js
 * (cold boot). A measurement instrument, not a test: it boots the real app
 * in the harness's Chrome over file:// and reports medians. Written for the
 * 2026-09-26 speed pass; the figures are in docs/FIGURES.md section 8.
 *
 *   node tools/speed-bench.js                  # every section, this checkout
 *   node tools/speed-bench.js shape marquee    # just those sections
 *   node tools/speed-bench.js --app ../old     # another checkout (a before tree)
 *
 * Sections: render eraser shape marquee rotate grid autosave idle
 *
 * Pointer input is synthetic PointerEvents dispatched on InputHandler's own
 * target, with `coalescedEvents` set so a move carries the 16 samples a
 * 1000 Hz mouse delivers per 60 Hz frame. `PIXULA_CHROME=/path/to/chrome`
 * launches that binary instead of the installed Chrome channel;
 * `PIXULA_CHROME_ARGS` adds flags (e.g. SwiftShader's, to get an accelerated
 * canvas on a machine without a GPU, which `render` needs to mean anything).
 *
 * Compare two trees BACK TO BACK in one sitting: FIGURES section 8 records
 * this machine drifting by a third with thermal state.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const argv = process.argv.slice(2);
let appDir = path.join(__dirname, '..');
const SECTIONS = [];
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app') appDir = argv[++i];
    else SECTIONS.push(argv[i]);
}
const APP_DIR = path.resolve(appDir);
const APP_URL = pathToFileURL(path.join(APP_DIR, 'index.html')).href;
const want = (s) => !SECTIONS.length || SECTIONS.includes(s);

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (ms) => (ms < 1 ? ms.toFixed(3) : ms.toFixed(2)) + ' ms';

async function boot(browser, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
    return { ctx, page };
}

/** In-page pointer and artwork helpers, installed once per page as window.__b. */
async function installHelpers(page) {
    await page.evaluate(() => {
        window.__b = {
            pt(px, py) {
                const r = InputHandler.canvas.getBoundingClientRect();
                return { clientX: r.left + (px + 0.5) * r.width / ZX_SPECTRUM.WIDTH,
                         clientY: r.top + (py + 0.5) * r.height / ZX_SPECTRUM.HEIGHT };
            },
            ev(type, px, py, extra = {}) {
                const W = InputHandler.inputTarget.ownerDocument.defaultView;
                return new W.PointerEvent(type, Object.assign({
                    bubbles: true, cancelable: true, composed: true,
                    pointerId: 1, pointerType: 'mouse', isPrimary: true,
                    button: type === 'pointermove' ? -1 : 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                    pressure: type === 'pointerup' ? 0 : 0.5
                }, this.pt(px, py), extra));
            },
            fire(type, px, py, extra) {
                InputHandler.inputTarget.dispatchEvent(this.ev(type, px, py, extra));
            },
            /** One pointermove carrying `samples` coalesced samples from `from` to `to`. */
            fireCoalesced(from, to, samples) {
                const list = [];
                for (let i = 1; i <= samples; i++) {
                    list.push(this.ev('pointermove',
                        Math.round(from[0] + (to[0] - from[0]) * i / samples),
                        Math.round(from[1] + (to[1] - from[1]) * i / samples)));
                }
                InputHandler.inputTarget.dispatchEvent(this.ev('pointermove', to[0], to[1], { coalescedEvents: list }));
            },
            /** Busy artwork: 80% of the canvas inked in a diagonal hatch. */
            inkAll() {
                const sel = ColorManager.getCurrentSelection();
                PixelDrawRoutine.beginBatch();
                for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++)
                    for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++)
                        if ((x * 7 + y * 3) % 5) PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL);
                PixelDrawRoutine.endBatch();
            }
        };
    });
}

async function main() {
    let chromium;
    try {
        ({ chromium } = require('@playwright/test'));
    } catch (e) {
        console.error('Needs the test harness: npm install');
        process.exit(1);
    }
    const launch = { headless: true, args: (process.env.PIXULA_CHROME_ARGS || '').split(' ').filter(Boolean) };
    if (process.env.PIXULA_CHROME) launch.executablePath = process.env.PIXULA_CHROME;
    else launch.channel = 'chrome';
    const browser = await chromium.launch(launch);

    const rows = [];
    const rec = (label, samples) => rows.push([label, samples]);
    const note = (label, text) => rows.push([label, text]);

    // One frame's upload after a size-32 stamp in an 8x1-cell mode, and the
    // box's worst case: two dirty cells in opposite corners.
    if (want('render')) {
        const { ctx, page } = await boot(browser);
        await page.evaluate(() => ScreenModeService.switchMode('multicolor_8x1'));
        const s = await page.evaluate(() => {
            const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
            const cx0 = Math.floor((ZX_SPECTRUM.WIDTH / 2 - 16) / cw), cx1 = Math.floor((ZX_SPECTRUM.WIDTH / 2 + 16) / cw);
            const cy0 = Math.floor((ZX_SPECTRUM.HEIGHT / 2 - 16) / ch), cy1 = Math.floor((ZX_SPECTRUM.HEIGHT / 2 + 16) / ch);
            const stamp = () => { for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) CanvasSystem.markCellDirty(x, y); };
            const corners = () => {
                CanvasSystem.markCellDirty(0, 0);
                CanvasSystem.markCellDirty(ZX_SPECTRUM.GRID_COLS - 1, ZX_SPECTRUM.GRID_ROWS - 1);
            };
            // A 1px readback ends each sample, so queued GPU uploads are paid for inside it.
            const flush = () => CanvasSystem.ctx.getImageData(0, 0, 1, 1);
            const run = (mark) => {
                const samples = [];
                for (let w = 0; w < 5; w++) { mark(); CanvasSystem._render(); }
                flush();
                for (let r = 0; r < 15; r++) {
                    const t0 = performance.now();
                    for (let k = 0; k < 20; k++) { mark(); CanvasSystem._render(); }
                    flush();
                    samples.push((performance.now() - t0) / 20);
                }
                return samples;
            };
            return { stamp: run(stamp), corners: run(corners), cells: (cx1 - cx0 + 1) * (cy1 - cy0 + 1) };
        });
        rec(`render: ${s.cells} dirty 8x1 cells`, s.stamp);
        rec('render: 2 cells, opposite corners', s.corners);
        await ctx.close();
    }

    // A full-width size-128 eraser drag, one move per pixel.
    if (want('eraser')) {
        const { ctx, page } = await boot(browser);
        await installHelpers(page);
        rec('eraser: size-128 full-width drag', await page.evaluate(() => {
            ToolManager.selectTool(TOOLS.ERASER);
            ToolManager.getCurrentTool().setSize(128);
            const samples = [];
            for (let r = 0; r < 7; r++) {
                __b.inkAll();
                const t0 = performance.now();
                __b.fire('pointerdown', 0, 96);
                for (let x = 1; x < ZX_SPECTRUM.WIDTH; x++) __b.fire('pointermove', x, 96);
                __b.fire('pointerup', ZX_SPECTRUM.WIDTH - 1, 96);
                samples.push(performance.now() - t0);
            }
            return samples.slice(2);
        }));
        await ctx.close();
    }

    // A filled rectangle dragged across the canvas: per pointermove.
    if (want('shape')) {
        const { ctx, page } = await boot(browser);
        await installHelpers(page);
        rec('shape: filled-rect drag, per move', await page.evaluate(() => {
            ToolManager.selectTool(TOOLS.RECTANGLE);
            const tool = ToolManager.getCurrentTool();
            if (tool.setShapeType) tool.setShapeType('rectangle');
            tool.filled = true;
            __b.inkAll();
            const samples = [];
            for (let r = 0; r < 7; r++) {
                __b.fire('pointerdown', 2, 2);
                const t0 = performance.now();
                let prev = [2, 2];
                for (let i = 1; i <= 30; i++) {
                    const to = [Math.round(2 + 250 * i / 30), Math.round(2 + 185 * i / 30)];
                    __b.fireCoalesced(prev, to, 16);
                    prev = to;
                }
                samples.push((performance.now() - t0) / 30);
                __b.fire('pointerup', prev[0], prev[1]);
                UndoRedo.undo();
            }
            return samples.slice(2);
        }));
        await ctx.close();
    }

    // A marquee dragged over busy artwork: per pointermove, and one
    // full-canvas preview on its own.
    if (want('marquee')) {
        const { ctx, page } = await boot(browser);
        await installHelpers(page);
        rec('marquee: drag, per move', await page.evaluate(() => {
            __b.inkAll();
            ToolManager.selectTool(TOOLS.SELECTION);
            const samples = [];
            for (let r = 0; r < 7; r++) {
                __b.fire('pointerdown', 1, 1);
                const t0 = performance.now();
                let prev = [1, 1];
                for (let i = 1; i <= 30; i++) {
                    const to = [Math.round(1 + 253 * i / 30), Math.round(1 + 189 * i / 30)];
                    __b.fireCoalesced(prev, to, 16);
                    prev = to;
                }
                samples.push((performance.now() - t0) / 30);
                __b.fire('pointerup', prev[0], prev[1]);
                SelectionService.clear();
            }
            return samples.slice(2);
        }));
        rec('marquee: full-canvas preview', await page.evaluate(() => {
            const samples = [];
            for (let r = 0; r < 15; r++) {
                const t0 = performance.now();
                for (let k = 0; k < 10; k++) GridOverlay.drawSelectionPreview(0, 0, ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
                samples.push((performance.now() - t0) / 10);
            }
            return samples;
        }));
        await ctx.close();
    }

    // The rotate-image slider: ticks from one snapshot, whole canvas.
    if (want('rotate')) {
        const { ctx, page } = await boot(browser);
        await installHelpers(page);
        rec('rotate: slider tick, full canvas', await page.evaluate(() => {
            __b.inkAll();
            const area = TransformService._getWorkArea();
            const snap = TransformService._copyToBufferWithAttrs(area);
            const samples = [];
            for (let r = 0; r < 5; r++) {
                UndoRedo.beginAction('Rotate image');
                const t0 = performance.now();
                for (let d = 1; d <= 30; d++) TransformService.rotateFromSnapshot(snap, area, d * 3);
                samples.push((performance.now() - t0) / 30);
                UndoRedo.endAction();
                UndoRedo.undo();
            }
            return samples.slice(1);
        }));
        await ctx.close();
    }

    // Grid canvas backing store and zoom-step time at 1600% on a 2x screen.
    if (want('grid')) {
        for (const cellGrid of [false, true]) {
            const { ctx, page } = await boot(browser, { deviceScaleFactor: 2 });
            const r = await page.evaluate((cellGrid) => {
                const bytes = () => ['grid1x1Canvas', 'grid8x8Canvas', 'grid16x16Canvas',
                    '_grid1x1Cache', '_grid8x8Cache', '_grid16x16Cache']
                    .reduce((sum, k) => {
                        const c = GridOverlay[k];
                        return sum + (c && c.width ? c.width * c.height * 4 : 0);
                    }, 0);
                if (cellGrid) GridOverlay.setCellGridVisible(true);
                const t0 = performance.now();
                CanvasSystem.setZoom(1600);
                return { ms: performance.now() - t0, mb: bytes() / 1e6 };
            }, cellGrid);
            note(`grid @1600% DPR2, ${cellGrid ? 'cell grid on' : 'all grids off'}`,
                `${r.mb.toFixed(0)} MB backing store, zoom step ${fmt(r.ms)}`);
            await ctx.close();
        }
    }

    // An autosave capture with a 3000x2000 reference photo loaded.
    if (want('autosave')) {
        const { ctx, page } = await boot(browser);
        const r = await page.evaluate(async () => {
            const c = document.createElement('canvas');
            c.width = 3000; c.height = 2000;
            const x = c.getContext('2d');
            const img = x.createImageData(3000, 2000);
            for (let i = 0; i < img.data.length; i += 4) {
                img.data[i] = (i * 13) & 255; img.data[i + 1] = (i * 7 >> 3) & 255;
                img.data[i + 2] = (i >> 9) & 255; img.data[i + 3] = 255;
            }
            x.putImageData(img, 0, 0);
            const url = c.toDataURL('image/jpeg', 0.9);
            await new Promise((res) => { EventBus.once(EVENTS.REFERENCE_LOADED, res); EventBus.emit(EVENTS.REFERENCE_LOAD, { url }); });
            const samples = [];
            for (let i = 0; i < 7; i++) {
                const t0 = performance.now();
                App._getProjectData();
                samples.push(performance.now() - t0);
            }
            return samples;
        });
        rec('autosave: capture, first tick', [r[0]]);
        rec('autosave: capture, later ticks', r.slice(1));
        await ctx.close();
    }

    // Animation frames requested per second by an idle editor.
    if (want('idle')) {
        const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
        const page = await ctx.newPage();
        await page.addInitScript(() => {
            window.__raf = 0;
            const raf = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); };
        });
        await page.goto(APP_URL);
        await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
        await page.waitForTimeout(1500);
        const a = await page.evaluate(() => window.__raf);
        await page.waitForTimeout(2000);
        const b = await page.evaluate(() => window.__raf);
        note('idle: animation frames / s', String((b - a) / 2));
        await ctx.close();
    }

    await browser.close();

    console.log('');
    console.log('PixULA interaction benchmark');
    console.log('  app       ' + APP_DIR);
    console.log('  date      ' + new Date().toISOString().slice(0, 10));
    console.log('');
    for (const [label, v] of rows) {
        if (typeof v === 'string') { console.log('  ' + label.padEnd(40) + '  ' + v); continue; }
        const extra = v.length > 1 ? '   (min ' + fmt(Math.min(...v)) + ', max ' + fmt(Math.max(...v)) + ')' : '';
        console.log('  ' + label.padEnd(40) + fmt(median(v)).padStart(11) + extra);
    }
    console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
