'use strict';
(function() {

/**
 * Dither - the 31 dithering and halftoning methods of ZX Paintbrush, for turning grey into 1-bit dots (Batch 8 part 8A).
 *
 *   Dither.apply(gray, w, h, 'floyd-steinberg')  ->  Uint8Array of 0 / 1, 1 = ink (the dark side)
 *
 * Every table below is transcribed from the ZX Paintbrush 2.6.4 help page "dithering_style"
 * [P, ZX Paintbrush 2.6.4 help, dithering_style, read 2026-10-10]. How the tables are USED was measured by comparing
 * the help's own 160x160 output pictures with candidate rules [M, 2026-10-10, pixel agreement with the help pictures]:
 *
 *  - grey is Rec.601 luma (see Dither.luma); thresholds T: ink when 100 * g < 255 * T       (0.997-0.999 agreement)
 *  - ordered methods: the table as printed (row = y), level 0 at the image origin, and a pixel is ink when
 *    2 * N * g < (2 * m + 1) * 255 for level m of N                                           (0.965-0.998)
 *  - the non-rectangular cluster-dot and supercell methods are LATTICE TILINGS: a small cluster of cells repeats on a
 *    lattice (two vectors), and a pixel's level is that of the cluster cell covering it     (0.976-0.996)
 *  - error diffusion scans left to right on EVERY row (not serpentine), pixel is ink when value < 127.5
 *  - Park-Kang-Kim uses its first kernel except in the highlights, see PKK_SPLIT
 *
 * Note: the Bayer matrices here are the TRANSPOSE of the ones the fade brush and the gradient use, so those stay
 * as they are and do not call this module.
 */

/** Source grey above which Park-Kang-Kim switches to its second kernel [A: the measurement could not tell; nothing rests on it]. */
const PKK_SPLIT = 224;

// ── Error diffusion kernels, [dx, dy, numerator, denominator] ──────────────────────────────────────────────────
const KERNELS = Object.freeze({
    'floyd-steinberg':       [[1,0,7,16],[-1,1,3,16],[0,1,5,16],[1,1,1,16]],
    'jarvis-judice-ninke':   [[1,0,7,48],[2,0,5,48],[-2,1,1,16],[-1,1,5,48],[0,1,7,48],[1,1,5,48],[2,1,1,16],
                              [-2,2,1,48],[-1,2,1,16],[0,2,5,48],[1,2,1,16],[2,2,1,48]],
    'zhigang-fan':           [[1,0,7,16],[-2,1,1,16],[-1,1,3,16],[0,1,5,16]],
    'shiau-fan-1':           [[1,0,1,2],[-2,1,1,8],[-1,1,1,8],[0,1,1,4]],
    'shiau-fan-2':           [[1,0,1,2],[-3,1,1,16],[-2,1,1,16],[-1,1,1,8],[0,1,1,4]],
    'stucki':                [[1,0,4,21],[2,0,2,21],[-2,1,1,21],[-1,1,2,21],[0,1,4,21],[1,1,2,21],[2,1,1,21],
                              [-2,2,1,42],[-1,2,1,21],[0,2,2,21],[1,2,1,21],[2,2,1,42]],
    'burkes':                [[1,0,1,4],[2,0,1,8],[-2,1,1,16],[-1,1,1,8],[0,1,1,4],[1,1,1,8],[2,1,1,16]],
    'sierra-3':              [[1,0,5,32],[2,0,3,32],[-2,1,1,16],[-1,1,1,8],[0,1,5,32],[1,1,1,8],[2,1,1,16],
                              [-1,2,1,16],[0,2,3,32],[1,2,1,16]],
    'sierra-2':              [[1,0,1,4],[2,0,3,16],[-2,1,1,16],[-1,1,1,8],[0,1,3,16],[1,1,1,8],[2,1,1,16]],
    'sierra-lite':           [[1,0,1,2],[-1,1,1,4],[0,1,1,4]],
    'atkinson':              [[1,0,1,8],[2,0,1,8],[-1,1,1,8],[0,1,1,8],[1,1,1,8],[0,2,1,8]],
    'false-floyd-steinberg': [[1,0,3,8],[0,1,3,8],[1,1,1,4]],
    'stevenson-arce':        [[2,0,32,200],[-3,1,12,200],[-1,1,26,200],[1,1,30,200],[3,1,16,200],
                              [-2,2,12,200],[0,2,26,200],[2,2,12,200],[-3,3,5,200],[-1,3,12,200],[1,3,12,200],[3,3,5,200]]
});

// Park-Kang-Kim: two kernels of plain decimals, as printed (kernel A sums to 0.969 and is NOT normalised).
const PKK_A = Object.freeze([[1,0,0.292],[-2,1,0.0248],[-1,1,0.3772],[0,1,0.275]]);
const PKK_B = Object.freeze([[1,0,0.4463],[-3,1,0.0779],[-2,1,0.0598],[-1,1,0.2641],[0,1,0.1519]]);

// ── Rectangular ordered matrices (row = y) ─────────────────────────────────────────────────────────────────────
const MATRICES = Object.freeze({
    'bayer-2': [[0,3],[2,1]],
    'bayer-4': [[0,12,3,15],[8,4,11,7],[2,14,1,13],[10,6,9,5]],
    'bayer-8': [
        [0,48,12,60,3,51,15,63],[32,16,44,28,35,19,47,31],[8,56,4,52,11,59,7,55],[40,24,36,20,43,27,39,23],
        [2,50,14,62,1,49,13,61],[34,18,46,30,33,17,45,29],[10,58,6,54,9,57,5,53],[42,26,38,22,41,25,37,21]],
    'cluster-4': [[12,5,6,13],[4,0,1,7],[11,3,2,8],[15,10,9,14]],
    'cluster-8': [
        [24,10,12,26,35,47,49,37],[8,0,2,14,45,59,61,51],[22,6,4,16,43,57,63,53],[30,20,18,28,33,41,55,39],
        [34,46,48,36,25,11,13,27],[44,58,60,50,9,1,3,15],[42,56,62,52,23,7,5,17],[32,40,54,38,31,21,19,29]],
    'cluster-5x3': [[9,3,0,6,12],[10,4,1,7,13],[11,5,2,8,14]]
});

// ── Lattice methods: cluster cells [dx, dy, level], lattice vectors a and b, the image position of a level-0 cell ──
const CROSS_3X3 = [[0,0,0],[1,0,1],[0,1,2],[-1,0,3],[0,-1,4]];
const CROSS_4X3 = [[0,0,0],[1,1,1],[1,-1,2],[2,0,3],[0,-1,4],[1,0,5],[-1,0,6],[0,1,7]];
const DIAG_5X4 = [[0,0,0],[1,0,1],[0,-1,2],[-1,0,3],[0,1,4],[2,0,5],[1,-1,6],[2,-2,7],[3,-1,8],[2,-1,9]];
const DIAG_4X4 = [[0,0,0],[1,0,1],[2,-1,2],[2,0,3],[1,1,4],[0,1,5],[3,1,6],[2,1,7],[3,0,8],[1,2,9]];

/** A supercell: the cluster repeated at `offsets`, level = K * clusterLevel + copy index. */
function supercell(cluster, offsets, K) {
    const out = [];
    offsets.forEach((o, j) => cluster.forEach(c => out.push([o[0] + c[0], o[1] + c[1], K * c[2] + j])));
    return out;
}

const LATTICES = Object.freeze({
    'cross-3x3':   { cells: CROSS_3X3, a: [2,-1], b: [1,2],   anchor: [0,0] },
    'cross-4x3':   { cells: CROSS_4X3, a: [3,1],  b: [-2,2],  anchor: [0,0] },
    'diagonal-cross-5x4': { cells: DIAG_5X4, a: [3,1], b: [-1,3], anchor: [8,0] },
    'diagonal-cross-4x4': { cells: DIAG_4X4, a: [4,-1], b: [2,2], anchor: [8,0] },
    'supercell-cross-3x3': { cells: supercell(CROSS_3X3, [[0,0],[3,1],[2,-1],[1,2]], 4), a: [4,-2], b: [2,4], anchor: [8,0] },
    'supercell-cross-4x3': { cells: supercell(CROSS_4X3, [[0,0],[1,3],[3,1]], 3), a: [5,-1], b: [1,-5], anchor: [17,0] },
    // The help prints 16 where the regular rule gives 17 (cell 4,-1) and 17 where it gives 19 (cell 3,2): its 40 levels are
    // 39 distinct thresholds. Used as printed [M: explains 120 of 120 deciding pixels of the help picture, the rule 47].
    'supercell-diagonal-cross-5x4': { cells: supercell(DIAG_5X4, [[0,0],[4,-2],[1,-3],[3,1]], 4), a: [6,2], b: [1,7], anchor: [30,0],
        overrides: { '4,-1': 16, '3,2': 17 } },
    'supercell-diagonal-cross-4x4': { cells: supercell(DIAG_4X4, [[0,0],[2,2],[4,-1]], 3), a: [0,5], b: [6,1], anchor: [9,0] }
});

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };

/** Build the periodic tile of a lattice method. Throws unless every pixel is covered by exactly one cluster cell. */
function buildLattice(def) {
    const [ax, ay] = def.a, [bx, by] = def.b;
    const D = ax * by - ay * bx;
    const w = Math.abs(D) / gcd(gcd(D, ay), by);
    const h = Math.abs(D) / gcd(gcd(D, ax), bx);
    const over = def.overrides || {};
    const rows = [];
    for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
            let level = -1, hits = 0;
            for (const c of def.cells) {
                const qx = x - def.anchor[0] - c[0], qy = y - def.anchor[1] - c[1];
                if ((qx * by - qy * bx) % D === 0 && (ax * qy - ay * qx) % D === 0) {
                    hits++;
                    const key = c[0] + ',' + c[1];
                    level = Object.prototype.hasOwnProperty.call(over, key) ? over[key] : c[2];
                }
            }
            if (hits !== 1) throw new Error('Dither: lattice does not tile at ' + x + ',' + y + ' (' + hits + ' cells)');
            row.push(level);
        }
        rows.push(row);
    }
    return rows;
}

/** The 31 methods in the help's order. `levels`: grey levels an ordered method can show; null for error diffusion. */
const METHODS = Object.freeze([
    ['threshold-25', 'threshold', 2], ['threshold-50', 'threshold', 2], ['threshold-75', 'threshold', 2],
    ['floyd-steinberg', 'diffusion', null], ['jarvis-judice-ninke', 'diffusion', null], ['zhigang-fan', 'diffusion', null],
    ['shiau-fan-1', 'diffusion', null], ['shiau-fan-2', 'diffusion', null], ['stucki', 'diffusion', null],
    ['burkes', 'diffusion', null], ['sierra-3', 'diffusion', null], ['sierra-2', 'diffusion', null],
    ['sierra-lite', 'diffusion', null], ['atkinson', 'diffusion', null], ['false-floyd-steinberg', 'diffusion', null],
    ['park-kang-kim', 'diffusion', null], ['stevenson-arce', 'diffusion', null],
    ['bayer-2', 'bayer', 4], ['bayer-4', 'bayer', 16], ['bayer-8', 'bayer', 64],
    ['cluster-4', 'cluster', 16], ['cluster-8', 'cluster', 64], ['cluster-5x3', 'cluster', 15],
    ['cross-3x3', 'cluster', 5], ['cross-4x3', 'cluster', 8],
    ['diagonal-cross-5x4', 'cluster', 10], ['diagonal-cross-4x4', 'cluster', 10],
    ['supercell-cross-3x3', 'supercell', 20], ['supercell-cross-4x3', 'supercell', 24],
    ['supercell-diagonal-cross-5x4', 'supercell', 40], ['supercell-diagonal-cross-4x4', 'supercell', 30]
].map(([id, family, levels]) => Object.freeze({
    id, family, levels,
    i18n: 'dither.' + id.replace(/-([0-9a-z])/g, (m, ch) => ch.toUpperCase())
})));

const BY_ID = new Map(METHODS.map(m => [m.id, m]));
const THRESHOLD = { 'threshold-25': 25, 'threshold-50': 50, 'threshold-75': 75 };
const _tiles = new Map();

/** @returns {number[][]} the ordered matrix / lattice tile of a method (cached; callers get a copy from Dither.matrix) */
function tileOf(id) {
    let t = _tiles.get(id);
    if (!t) {
        t = MATRICES[id] || buildLattice(LATTICES[id]);
        _tiles.set(id, t);
    }
    return t;
}

class DitherClass {
    constructor() {
        this.METHODS = METHODS;
        this.PKK_SPLIT = PKK_SPLIT;
    }

    /** @returns {?Object} the method entry, or null */
    get(id) { return BY_ID.get(id) || null; }

    /** Rec.601 luma, 0..255 (the grey ZX Paintbrush converts with). */
    luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

    /** A copy of the ordered matrix of a method: {w, h, n, levels} (levels row-major as rows), or null. */
    matrix(id) {
        const m = BY_ID.get(id);
        if (!m || m.levels === null || m.family === 'threshold') return null;
        const t = tileOf(id);
        return { w: t[0].length, h: t.length, n: m.levels, levels: t.map(r => r.slice()) };
    }

    /** A copy of the error-diffusion kernel(s): [[dx, dy, weight], ...], or {a, b} for park-kang-kim. */
    kernel(id) {
        if (id === 'park-kang-kim') return { a: PKK_A.map(k => k.slice()), b: PKK_B.map(k => k.slice()) };
        const k = KERNELS[id];
        return k ? k.map(t => [t[0], t[1], t[2] / t[3]]) : null;
    }

    /**
     * Dither a grey image to dots.
     * @param {ArrayLike<number>} gray - w*h values, 0 (black) .. 255 (white); clamped
     * @param {number} w
     * @param {number} h
     * @param {string} id - a Dither.METHODS id
     * @param {{serpentine?: boolean, originX?: number, originY?: number}} [opts] - serpentine: error diffusion only;
     *        origin: ordered methods only, the image position the matrix is anchored at
     * @returns {Uint8Array} 1 = ink
     */
    apply(gray, w, h, id, opts = {}) {
        const m = BY_ID.get(id);
        if (!m) throw new Error('Dither: unknown method ' + id);
        if (!gray || gray.length !== w * h) throw new Error('Dither: gray must hold w*h values');
        const out = new Uint8Array(w * h);
        if (m.family === 'threshold') {
            const T = THRESHOLD[id];
            for (let i = 0; i < out.length; i++) out[i] = 100 * Helpers.clamp(gray[i], 0, 255) < 255 * T ? 1 : 0;
            return out;
        }
        if (m.family === 'diffusion') return this._diffuse(gray, w, h, id, !!opts.serpentine, out);
        const t = tileOf(id), tw = t[0].length, th = t.length, N = m.levels;
        const ox = opts.originX | 0, oy = opts.originY | 0;
        for (let y = 0; y < h; y++) {
            const row = t[(((y + oy) % th) + th) % th];
            for (let x = 0; x < w; x++) {
                const lv = row[(((x + ox) % tw) + tw) % tw];
                out[y * w + x] = 2 * N * Helpers.clamp(gray[y * w + x], 0, 255) < (2 * lv + 1) * 255 ? 1 : 0;
            }
        }
        return out;
    }

    /**
     * Choose one of a few colours for every pixel of a small block (an attribute cell) with a Dither method.
     * Each pixel is placed between its two nearest colours (luma-weighted distance, the importer's own measure), as a grey
     * running from the darker of the two (0) to the lighter (255); one Dither.apply over the block then decides which of
     * the two it takes: a 1 (ink) is the darker. Ordered methods are anchored at the block's screen position (ox, oy), so
     * the screen continues across cells. Error diffusion stays inside the block.
     * @param {ArrayLike<number>} rgb - flat r,g,b for the w x h block
     * @param {Array<ArrayLike<number>>} colours - 1..n [r, g, b] triplets
     * @returns {Uint8Array} w*h indices into `colours`
     */
    paletteIndices(rgb, colours, id, w, h, ox = 0, oy = 0) {
        const out = new Uint8Array(w * h);
        if (colours.length < 2) return out;
        const luma = colours.map(c => this.luma(c[0], c[1], c[2]));
        const gray = new Float64Array(w * h);
        const lo = new Int16Array(w * h), hi = new Int16Array(w * h);
        // A picture repeats its colours, and a 256-colour palette makes the two-nearest search the cost of the whole import: whole-number
        // colours are looked up once (the same arithmetic, so the same answer). Cells with fractional colours do not use the table.
        const memo = colours.length > 16 ? new Map() : null;
        for (let i = 0; i < w * h; i++) {
            const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
            let key = -1;
            if (memo && Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b) && r >= 0 && g >= 0 && b >= 0 && r < 256 && g < 256 && b < 256) {
                key = (r << 16) | (g << 8) | b;
                const hit = memo.get(key);
                if (hit) { gray[i] = hit[0]; lo[i] = hit[1]; hi[i] = hit[2]; continue; }
            }
            let n1 = -1, d1 = Infinity, n2 = -1, d2 = Infinity;
            for (let k = 0; k < colours.length; k++) {
                const c = colours[k], dr = r - c[0], dg = g - c[1], db = b - c[2];
                const d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
                if (d < d1) { n2 = n1; d2 = d1; n1 = k; d1 = d; } else if (d < d2) { n2 = k; d2 = d; }
            }
            const dark = luma[n1] <= luma[n2] ? n1 : n2, light = dark === n1 ? n2 : n1;
            const D = colours[dark], L = colours[light];
            const lr = L[0] - D[0], lg = L[1] - D[1], lb = L[2] - D[2];
            const den = lr * lr * 0.299 + lg * lg * 0.587 + lb * lb * 0.114;
            const s = den > 0 ? ((r - D[0]) * lr * 0.299 + (g - D[1]) * lg * 0.587 + (b - D[2]) * lb * 0.114) / den : 0;
            gray[i] = 255 * Helpers.clamp(s, 0, 1);
            lo[i] = dark; hi[i] = light;
            if (key >= 0) memo.set(key, [gray[i], dark, light]);
        }
        const ink = this.apply(gray, w, h, id, { originX: ox, originY: oy });
        for (let i = 0; i < w * h; i++) out[i] = ink[i] === 1 ? lo[i] : hi[i];
        return out;
    }

    /** @private */
    _diffuse(gray, w, h, id, serpentine, out) {
        const buf = new Float64Array(w * h);
        for (let i = 0; i < buf.length; i++) buf[i] = Helpers.clamp(gray[i], 0, 255);
        const src = id === 'park-kang-kim' ? Float64Array.from(buf) : null;
        const kern = id === 'park-kang-kim' ? null : this.kernel(id);
        for (let y = 0; y < h; y++) {
            const flip = serpentine && (y & 1) === 1;
            for (let s = 0; s < w; s++) {
                const x = flip ? w - 1 - s : s;
                const i = y * w + x;
                const v = buf[i];
                const ink = v < 127.5;
                out[i] = ink ? 1 : 0;
                const err = v - (ink ? 0 : 255);
                if (err === 0) continue;
                const taps = kern || (src[i] > PKK_SPLIT ? PKK_B : PKK_A);
                for (const t of taps) {
                    const nx = x + (flip ? -t[0] : t[0]), ny = y + t[1];
                    if (nx < 0 || nx >= w || ny >= h) continue;
                    buf[ny * w + nx] += err * t[2];
                }
            }
        }
        return out;
    }
}

window.Dither = new DitherClass();

})();
