'use strict';
/**
 * Times every Dither method on a 640x256 grey image (a ramp plus fixed pseudo-random noise), median of 9 calls.
 * Usage: node tools/dither-bench.js   (run it twice back to back, as docs/FIGURES.md does)
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
for (const f of ['js/utils/helpers.js', 'js/utils/dither.js']) {
    // eslint-disable-next-line no-eval
    (0, eval)(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
}
const W = 640, H = 256;
const gray = new Uint8Array(W * H);
let s = 987654321;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    gray[y * W + x] = Math.max(0, Math.min(255, Math.round(x / (W - 1) * 255 + ((s >> 8) & 31) - 16)));
}
let total = 0;
for (const m of window.Dither.METHODS) {
    const t = [];
    for (let i = 0; i < 9; i++) {
        const a = process.hrtime.bigint();
        window.Dither.apply(gray, W, H, m.id);
        t.push(Number(process.hrtime.bigint() - a) / 1e6);
    }
    t.sort((a, b) => a - b);
    total += t[4];
    console.log(m.id.padEnd(32) + t[4].toFixed(2) + ' ms');
}
console.log('total'.padEnd(32) + total.toFixed(1) + ' ms (node ' + process.version + ')');
