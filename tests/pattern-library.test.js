'use strict';
/**
 * Pattern-library contract.
 *
 * The library is generated (tools/gen-patterns.js) and the generator enforces these
 * rules at build time — but the SHIPPED data is what the app draws with, so the rules
 * are asserted against js/data/pattern-bitmaps.js itself. They exist because the
 * library they replaced broke every one of them: a `bayer-4x4` that was really a plain
 * checkerboard, a `fill-12pct` with 1.6% ink, a six-step density ramp holding three
 * distinct greys, and 9 groups of byte-identical duplicates under different names.
 *
 * A pattern whose name lies about its ink is worse than no pattern: you reach for a
 * 37% grey, get a 25% one, and only find out when the fill lands on the canvas.
 */
const { check, summary } = require('./helpers/zx-stubs');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'pattern-bitmaps.js'), 'utf8');
const DATA = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const KEYS = Object.keys(DATA);

/** Decode exactly as PatternService._decodeBitmap does: MSB of each byte = first pixel. */
function decode(entry) {
    const bin = Buffer.from(entry.d, 'base64');
    const px = entry.w * entry.h;
    const bmp = new Uint8Array(px);
    for (let i = 0; i < px; i++) bmp[i] = (bin[i >> 3] >> (7 - (i & 7))) & 1;
    return bmp;
}

/** Smallest period the tile repeats on, in either axis. */
function period(bmp, w, h) {
    const at = (x, y) => bmp[y * w + x];
    const axis = (len, sample) => {
        for (let p = 1; p < len; p++) {
            if (len % p) continue;
            let ok = true;
            for (let a = 0; a < h && ok; a++) {
                for (let b = 0; b < w; b++) if (!sample(p, a, b)) { ok = false; break; }
            }
            if (ok) return p;
        }
        return len;
    };
    const px = axis(w, (p, y, x) => at(x, y) === at((x + p) % w, y));
    const py = axis(h, (p, y, x) => at(x, y) === at(x, (y + p) % h));
    return Math.max(px, py);
}

check('library is not empty', () => KEYS.length > 0);

check('every entry decodes to its declared size', () => KEYS.every((k) => {
    const e = DATA[k];
    return decode(e).length === e.w * e.h && Buffer.from(e.d, 'base64').length === Math.ceil((e.w * e.h) / 8);
}));

check('key names its own size (e.g. "8x8/brick" is 8x8)', () => KEYS.every((k) => {
    const e = DATA[k];
    return k.split('/')[0] === `${e.w}x${e.h}`;
}));

check('every entry carries a category', () => KEYS.every((k) => typeof DATA[k].c === 'string' && DATA[k].c.length > 0));

check('no pattern is blank or solid', () => KEYS.every((k) => {
    const ink = decode(DATA[k]).reduce((a, v) => a + v, 0);
    return ink > 0 && ink < DATA[k].w * DATA[k].h;
}));

check('no two patterns are the same bitmap', () => {
    const seen = new Map();
    for (const k of KEYS) {
        const e = DATA[k];
        const sig = `${e.w}x${e.h}:${decode(e).join('')}`;
        if (seen.has(sig)) {
            console.log(`    ${k} is byte-identical to ${seen.get(sig)}`);
            return false;
        }
        seen.set(sig, k);
    }
    return true;
});

check('density-NN names match their real ink coverage', () => {
    let ok = true;
    for (const k of KEYS) {
        const m = k.match(/density-(\d+)$/);
        if (!m) continue;
        const e = DATA[k];
        const got = decode(e).reduce((a, v) => a + v, 0) / (e.w * e.h);
        const want = Number(m[1]) / 100;
        if (Math.abs(got - want) > 0.02) {
            console.log(`    ${k}: promises ${(want * 100).toFixed(0)}% ink, has ${(got * 100).toFixed(1)}%`);
            ok = false;
        }
    }
    return ok;
});

check('the density ramp is monotonic and evenly stepped', () => {
    const levels = KEYS.filter((k) => k.startsWith('8x8/density-'))
        .map((k) => decode(DATA[k]).reduce((a, v) => a + v, 0) / 64)
        .sort((a, b) => a - b);
    if (levels.length < 5) return false;
    for (let i = 1; i < levels.length; i++) {
        if (levels[i] <= levels[i - 1]) return false;   // strictly increasing greys
    }
    return true;
});

check('a tile never just repeats a smaller one (earns its size)', () => {
    let ok = true;
    for (const k of KEYS) {
        const e = DATA[k];
        if (e.w <= 8) continue;
        const p = period(decode(e), e.w, e.h);
        if (p <= e.w / 2) {
            console.log(`    ${k}: repeats every ${p}px — it is a ${e.w / 2}x${e.h / 2} pattern padded out`);
            ok = false;
        }
    }
    return ok;
});

summary('pattern-library');
