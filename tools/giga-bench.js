'use strict';
/*
 * giga-bench.js - measures GigaQuant's steady-mix threshold on real photos.
 *
 *     node tools/giga-bench.js docs/bench-images [--write outDir]
 *
 * Compares, on each photo, what the two-screen import produced before
 * 2026-09-26 (the best two-colour cell on both screens) with the four-colour
 * converter at MAX_STEP 1 and 2, flat and dithered. Columns are
 * palette-bench's (read dSSIM first; dEblur judges dithering) plus two more:
 *
 *   flick   mean |luma(frame A) - luma(frame B)| per pixel, 0-255. What the
 *           eye sees flicker on real hardware. Zero for the two-colour
 *           baseline; the steady rule keeps it small by construction.
 *   ms      milliseconds per conversion, the cost of one preview pane.
 */
const path = require('path');
const fs = require('fs');
const bench = require('./palette-bench.js'); // installs the stubs and constants
const { loadModule } = require(path.join(__dirname, '..', 'tests/helpers/zx-stubs'));
loadModule('js/utils/giga-quant.js');

const { W, H, CW, CH, CELLS_X, CELLS_Y, CELLS } = bench;
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

function cellSamples(img, cx, cy) {
    const out = new Float32Array(CW * CH * 3);
    for (let dy = 0; dy < CH; dy++) {
        for (let dx = 0; dx < CW; dx++) {
            const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
            out.set([img.data[i], img.data[i + 1], img.data[i + 2]], (dy * CW + dx) * 3);
        }
    }
    return out;
}

/** Before this work: the best two-colour cell, the same on both screens. */
function twoColour(img) {
    const out = new Uint8ClampedArray(W * H * 4);
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const s = cellSamples(img, cx, cy);
        let best = null;
        for (const bright of [false, true]) {
            for (let ink = 0; ink < 8; ink++) {
                for (let paper = ink; paper < 8; paper++) {
                    const a = GigaQuant.colourRGB(ink, bright), b = GigaQuant.colourRGB(paper, bright);
                    let err = 0;
                    for (let i = 0; i < CW * CH; i++) {
                        err += Math.min(GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], a),
                                        GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], b));
                    }
                    if (!best || err < best.err) best = { a, b, err };
                }
            }
        }
        for (let i = 0; i < CW * CH; i++) {
            const c = GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], best.a)
                <= GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], best.b) ? best.a : best.b;
            const o = ((cy * CH + Math.floor(i / CW)) * W + cx * CW + (i % CW)) * 4;
            out.set([c[0], c[1], c[2], 255], o);
        }
    }
    return { image: { width: W, height: H, data: out }, flick: 0 };
}

function fourColour(img, maxStep, dithering) {
    const out = new Uint8ClampedArray(W * H * 4);
    let flick = 0;
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const s = cellSamples(img, cx, cy);
        const pick = GigaQuant.chooseCell(s, maxStep);
        const r = GigaQuant.renderCell(s, pick, dithering, CW, CH, maxStep);
        for (let i = 0; i < CW * CH; i++) {
            const slot = r.slots[i];
            const baseA = GIGA_SLOTS.bitA(slot) ? pick.a.ink : pick.a.paper;
            const baseB = GIGA_SLOTS.bitB(slot) ? pick.b.ink : pick.b.paper;
            flick += Math.abs(luma(GigaQuant.colourRGB(baseA, pick.a.bright))
                            - luma(GigaQuant.colourRGB(baseB, pick.b.bright)));
            const c = r.slotRGB[slot];
            const o = ((cy * CH + Math.floor(i / CW)) * W + cx * CW + (i % CW)) * 4;
            out.set([c[0], c[1], c[2], 255], o);
        }
    }
    return { image: { width: W, height: H, data: out }, flick: flick / (W * H) };
}

const VARIANTS = [
    { name: 'two-colour', run: (img) => twoColour(img) },
    { name: 'step1-flat', run: (img) => fourColour(img, 1, 'none') },
    { name: 'step1-fs', run: (img) => fourColour(img, 1, 'floyd-steinberg') },
    { name: 'step2-flat', run: (img) => fourColour(img, 2, 'none') },
    { name: 'step2-fs', run: (img) => fourColour(img, 2, 'floyd-steinberg') }
];

async function main() {
    const args = process.argv.slice(2);
    const writeAt = args.indexOf('--write');
    const outDir = writeAt >= 0 ? args[writeAt + 1] : null;
    const dir = args.find((a) => !a.startsWith('--') && a !== outDir);
    if (!dir || !fs.existsSync(dir)) {
        console.error('Usage: node tools/giga-bench.js docs/bench-images [--write outDir]');
        process.exit(1);
    }
    await bench.convertNonPNG(dir);
    const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
    if (outDir) fs.mkdirSync(outDir, { recursive: true });
    const totals = new Map();
    const cellClut = new Int8Array(CELLS);
    for (const f of files) {
        const img = bench.fitToScreen(bench.readPNG(path.join(dir, f)));
        console.log(`\n${f}`);
        console.log('  variant       dSSIM   used     dE  dEblur   dE95   flick      ms');
        for (const v of VARIANTS) {
            const t0 = process.hrtime.bigint();
            const res = v.run(img);
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            const colours = [];
            for (let i = 0; i < W * H; i++) colours.push(res.image.data.slice(i * 4, i * 4 + 3).join());
            const s = bench.score(img, res.image, colours, cellClut);
            const row = { ...s, flick: res.flick, ms };
            if (!totals.has(v.name)) totals.set(v.name, []);
            totals.get(v.name).push(row);
            console.log('  ' + v.name.padEnd(12) + fmt(row));
            if (outDir) bench.writePNG(path.join(outDir, `${path.basename(f, '.png')}--${v.name}.png`), res.image);
        }
    }
    console.log(`\n=== mean across ${files.length} images ===`);
    const mean = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;
    for (const [name, rows] of totals) {
        const m = {};
        for (const k of ['dssim', 'used', 'dE', 'dEblur', 'dE95', 'flick', 'ms']) m[k] = mean(rows, k);
        console.log('  ' + name.padEnd(12) + fmt(m));
    }
}

function fmt(r) {
    return r.dssim.toFixed(3).padStart(6) + '  ' + String(Math.round(r.used)).padStart(4) + '  ' +
        r.dE.toFixed(2).padStart(6) + '  ' + r.dEblur.toFixed(2).padStart(6) + '  ' +
        r.dE95.toFixed(2).padStart(6) + '  ' + r.flick.toFixed(1).padStart(6) + '  ' +
        r.ms.toFixed(0).padStart(6);
}

main().catch((e) => { console.error(e); process.exit(1); });
