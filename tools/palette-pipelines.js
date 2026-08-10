'use strict';
/*
 * palette-pipelines.js - candidate palette builders, and the stages they
 * compose from.
 *
 * This is a BENCH file, not app code. Nothing here ships until
 * `node tools/palette-bench.js` says it beats what is already in
 * `js/utils/palette-ops.js`, on real photographs and not only the synthetic
 * set. Three "obvious" improvements were tried on 2026-08-08 and all three
 * made the picture measurably worse, which is the whole reason this file and
 * the bench exist.
 *
 * THE STAGES. Building a palette for a constrained display is the same five
 * jobs whatever the hardware; only the numbers change. Written as separate
 * functions so a mode is a COMPOSITION rather than a copy:
 *
 *   snapImage(img, codec)             1. fit every pixel to the hardware's
 *                                        master colour space, FIRST
 *   analyseCells(img, opts)           2. per cell, the dominant colours by
 *                                        pixel count, ranked
 *   clusterCells(cells, k, opts)      3. group cells into k sub-palettes,
 *                                        optionally with a spatial penalty
 *   buildBuckets(cells, assign, opts) 4. per group, quantise the ink and
 *                                        paper roles into their registers,
 *                                        optionally reserving anchors
 *   renderCells(img, palette, opts)   5. map and dither, never across a cell
 *
 * ULAplus is k=4 with an 8+8 ink/paper split; a Next 4bpp mode is k=1 with a
 * flat 16; ULANext is k=1 with 8+8 halves at fixed offsets. Same stages.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const W = 256, H = 192, CW = 8, CH = 8;
const CELLS_X = W / CW, CELLS_Y = H / CH, CELLS = CELLS_X * CELLS_Y;

/** The ULAplus hardware colour space: G3R3B2, 8*8*4 = 256 colours. NOT 512. */
const ULAPLUS_CODEC = {
    size: 256,
    toIndex: (r, g, b) => ULAPLUS.rgbToRegister(r, g, b),
    toRGB: (i) => ULAPLUS.registerToRGB(i)
};

const lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// --- stage 1 --------------------------------------------------------------

/**
 * Snap every pixel to the hardware master space BEFORE any analysis.
 *
 * The shipped pipeline snaps LAST, which lets it median-cut eight colours out
 * of a region the hardware can only express as two - the boxes then collapse
 * onto the same register and the slots are spent for nothing. Snapping first
 * makes the analysis see the colours that actually exist.
 */
function snapImage(img, codec) {
    const data = new Uint8ClampedArray(img.data.length);
    for (let i = 0; i < img.width * img.height; i++) {
        const o = i * 4;
        const rgb = codec.toRGB(codec.toIndex(img.data[o], img.data[o + 1], img.data[o + 2]));
        data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
    }
    return { width: img.width, height: img.height, data };
}

// --- stage 2 --------------------------------------------------------------

/**
 * Per cell: the unique colours present, ranked by pixel count.
 *
 * The two most frequent become the cell's paper and ink CANDIDATES. Frequency
 * rather than a luminance split, because what a cell needs is the colours it
 * is mostly made of - a cell of dark red on slightly-darker red has no
 * meaningful "light half".
 *
 * `roleByLuminance` decides which of the two is called ink: by default the
 * darker one, so the roles stay consistent across the image and the ink/paper
 * buckets in stage 4 mean something. Pure frequency order (the brief's
 * "most common = paper") makes the buckets depend on how much of each colour
 * happens to be present, which is measured as `roleByFreq` below.
 */
function analyseCells(img, opts = {}) {
    const roleByFreq = !!opts.roleByFreq;
    const cells = [];
    for (let cy = 0; cy < CELLS_Y; cy++) {
        for (let cx = 0; cx < CELLS_X; cx++) {
            const counts = new Map();
            const pixels = [];
            for (let dy = 0; dy < CH; dy++) {
                for (let dx = 0; dx < CW; dx++) {
                    const i = ((cy * CH + dy) * img.width + (cx * CW + dx)) * 4;
                    const rgb = [img.data[i], img.data[i + 1], img.data[i + 2]];
                    pixels.push(rgb);
                    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
            }
            const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
                .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);

            let first = ranked[0];
            let second = ranked[1] || ranked[0];
            let ink, paper;
            if (roleByFreq) {
                paper = first; ink = second;
            } else {
                ink = lum(first) <= lum(second) ? first : second;
                paper = ink === first ? second : first;
            }
            cells.push({ cx, cy, ink, paper, pixels, unique: ranked.length });
        }
    }
    return cells;
}

// --- stage 3 --------------------------------------------------------------

/**
 * Group cells into k sub-palettes.
 *
 * The feature is the cell's ink AND paper together (6-D), not its mean: a
 * black-and-white cell has a mid-grey mean and would otherwise be filed with
 * genuinely grey cells, which is the shipped pipeline's core mistake.
 *
 * `spatialWeight` adds the cell's position to the feature, so a cluster that
 * is geographically scattered pays for it. That is what stops the sky and a
 * same-coloured puddle sharing a CLUT and fracturing the picture. 0 disables
 * it; the units are "colour distance per cell of separation", so a weight of
 * 12 makes moving one cell away cost about as much as a 12/255 colour shift.
 */
function clusterCells(cells, k, opts = {}) {
    const sw = opts.spatialWeight || 0;
    const iters = opts.iterations || 12;

    const feat = cells.map((c) => [
        c.ink[0], c.ink[1], c.ink[2], c.paper[0], c.paper[1], c.paper[2],
        c.cx * sw, c.cy * sw
    ]);
    const dist = (a, b) => {
        let s = 0;
        for (let i = 0; i < 8; i++) s += (a[i] - b[i]) ** 2;
        return s;
    };

    // Seed on luminance order so the run is deterministic and the clusters
    // start spread rather than piled on one another.
    const order = feat.map((f, i) => ({ f, i }))
        .sort((a, b) => (lum(a.f) + lum(a.f.slice(3))) - (lum(b.f) + lum(b.f.slice(3))));
    let cent = [];
    for (let j = 0; j < k; j++) {
        cent.push(order[Math.floor(((j + 0.5) / k) * (order.length - 1))].f.slice());
    }

    const assign = new Array(cells.length).fill(0);
    for (let it = 0; it < iters; it++) {
        let moved = false;
        for (let i = 0; i < feat.length; i++) {
            let bi = 0, bd = Infinity;
            for (let j = 0; j < k; j++) {
                const d = dist(feat[i], cent[j]);
                if (d < bd) { bd = d; bi = j; }
            }
            if (assign[i] !== bi) { assign[i] = bi; moved = true; }
        }
        for (let j = 0; j < k; j++) {
            const acc = new Array(8).fill(0);
            let n = 0;
            for (let i = 0; i < feat.length; i++) {
                if (assign[i] !== j) continue;
                for (let d = 0; d < 8; d++) acc[d] += feat[i][d];
                n++;
            }
            if (n) cent[j] = acc.map((v) => v / n);
        }
        if (!moved) break;
    }
    return assign;
}

// --- stage 4 --------------------------------------------------------------

/**
 * Weighted median cut over (colour, count) pairs, snapping as it goes.
 *
 * Weighted, because a colour covering 300 cells must not count the same as
 * one covering a single cell - dropping that weighting is what made the
 * endpoint experiment of 2026-08-08 lose 14%. Distinctness is enforced after
 * the snap so a returned slot is always a colour the hardware really has.
 */
function weightedCut(entries, want, codec) {
    if (!entries.length) return [];
    let boxes = [entries];
    while (boxes.length < want) {
        let bi = -1, bestSpread = -1;
        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].length < 2) continue;
            for (let ch = 0; ch < 3; ch++) {
                let lo = 255, hi = 0;
                for (const e of boxes[i]) { const v = e.rgb[ch]; if (v < lo) lo = v; if (v > hi) hi = v; }
                const spread = (hi - lo) * (ch === 1 ? 1.4 : 1.0);   // green carries most luminance
                if (spread > bestSpread) { bestSpread = spread; bi = i; }
            }
        }
        if (bi < 0 || bestSpread <= 0) break;

        const box = boxes[bi];
        let ch = 0, best = -1;
        for (let c = 0; c < 3; c++) {
            let lo = 255, hi = 0;
            for (const e of box) { const v = e.rgb[c]; if (v < lo) lo = v; if (v > hi) hi = v; }
            const spread = (hi - lo) * (c === 1 ? 1.4 : 1.0);
            if (spread > best) { best = spread; ch = c; }
        }
        box.sort((a, b) => a.rgb[ch] - b.rgb[ch]);
        // Split at the weighted median, not the middle of the list
        const total = box.reduce((s, e) => s + e.n, 0);
        let acc = 0, cut = 1;
        for (let i = 0; i < box.length; i++) {
            acc += box[i].n;
            if (acc >= total / 2) { cut = Math.max(1, Math.min(i + 1, box.length - 1)); break; }
        }
        boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }

    const out = [];
    const seen = new Set();
    for (const box of boxes) {
        let r = 0, g = 0, b = 0, n = 0;
        for (const e of box) { r += e.rgb[0] * e.n; g += e.rgb[1] * e.n; b += e.rgb[2] * e.n; n += e.n; }
        const idx = codec.toIndex(r / n, g / n, b / n);
        if (seen.has(idx)) continue;
        seen.add(idx);
        out.push(idx);
    }
    return out;
}

/**
 * Per cluster, fill the ink and paper registers.
 *
 * `anchors` reserves the first ink slot and first paper slot in EVERY cluster
 * for the same colour, so two neighbouring cells on different CLUTs still
 * share a background and no seam appears between them. It costs one slot of
 * each half.
 */
function buildBuckets(cells, assign, opts) {
    const { k, inkSlots, paperSlots, codec, anchorInk, anchorPaper } = opts;
    const regs = new Uint8Array(k * (inkSlots + paperSlots));

    for (let j = 0; j < k; j++) {
        const inkCounts = new Map(), paperCounts = new Map();
        for (let i = 0; i < cells.length; i++) {
            if (assign[i] !== j) continue;
            for (const [map, rgb] of [[inkCounts, cells[i].ink], [paperCounts, cells[i].paper]]) {
                const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
                const cur = map.get(key);
                if (cur) cur.n++; else map.set(key, { rgb, n: 1 });
            }
        }
        const toEntries = (m) => [...m.values()];

        const inkReserved = anchorInk !== undefined ? 1 : 0;
        const paperReserved = anchorPaper !== undefined ? 1 : 0;
        const ink = weightedCut(toEntries(inkCounts), inkSlots - inkReserved, codec);
        const paper = weightedCut(toEntries(paperCounts), paperSlots - paperReserved, codec);

        const base = j * (inkSlots + paperSlots);
        if (inkReserved) regs[base] = anchorInk;
        for (let c = 0; c < inkSlots - inkReserved; c++) {
            regs[base + inkReserved + c] = ink.length ? ink[Math.min(c, ink.length - 1)] : anchorInk || 0;
        }
        if (paperReserved) regs[base + inkSlots] = anchorPaper;
        for (let c = 0; c < paperSlots - paperReserved; c++) {
            regs[base + inkSlots + paperReserved + c] =
                paper.length ? paper[Math.min(c, paper.length - 1)] : anchorPaper || 0;
        }
    }
    return regs;
}

/** The image's single most common colour, snapped. The anchor candidate. */
function dominantColour(img, codec) {
    const counts = new Map();
    for (let i = 0; i < img.width * img.height; i++) {
        const o = i * 4;
        const idx = codec.toIndex(img.data[o], img.data[o + 1], img.data[o + 2]);
        counts.set(idx, (counts.get(idx) || 0) + 1);
    }
    let best = 0, bn = -1;
    for (const [idx, n] of counts) if (n > bn) { bn = n; best = idx; }
    return best;
}

// --- stage 5 --------------------------------------------------------------

/**
 * Map every cell to its CLUT's best ink/paper pair and dither inside it.
 *
 * Error diffusion is confined to the cell, as it must be: a cell is two
 * colours, and error carried across the boundary is error the next cell
 * cannot express and will smear further. `dither: 'none'` renders the plain
 * nearest-colour result, which is what isolates a palette's own quality from
 * the dither's.
 */
function renderCells(img, regs, assign, opts) {
    const { inkSlots, paperSlots, codec, dither } = opts;
    const per = inkSlots + paperSlots;
    const rgbs = Array.from(regs, (r) => codec.toRGB(r));
    const out = new Uint8ClampedArray(W * H * 4);
    const cellClut = new Int8Array(CELLS);

    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const clut = assign[ci];
        const base = clut * per;
        const inks = rgbs.slice(base, base + inkSlots);
        const papers = rgbs.slice(base + inkSlots, base + per);
        cellClut[ci] = clut;

        // The pair that costs least over this cell's own pixels
        let bi = 0, bp = 0, bestErr = Infinity;
        for (let a = 0; a < inks.length; a++) {
            for (let b = 0; b < papers.length; b++) {
                let err = 0;
                for (let dy = 0; dy < CH; dy++) {
                    for (let dx = 0; dx < CW; dx++) {
                        const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                        const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
                        err += Math.min(d2(px, inks[a]), d2(px, papers[b]));
                    }
                }
                if (err < bestErr) { bestErr = err; bi = a; bp = b; }
            }
        }

        const inkRGB = inks[bi], paperRGB = papers[bp];
        const errBuf = dither === 'fs' ? new Float64Array(CW * CH * 3) : null;

        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                const li = (dy * CW + dx) * 3;
                let r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
                if (errBuf) { r += errBuf[li]; g += errBuf[li + 1]; b += errBuf[li + 2]; }
                const px = [r, g, b];
                const pick = d2(px, inkRGB) <= d2(px, paperRGB) ? inkRGB : paperRGB;

                if (errBuf) {
                    const er = r - pick[0], eg = g - pick[1], eb = b - pick[2];
                    // Floyd-Steinberg, but every neighbour outside this cell
                    // is simply dropped - error must not cross the boundary
                    const spread = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
                    for (const [ox, oy, w] of spread) {
                        const nx = dx + ox, ny = dy + oy;
                        if (nx < 0 || nx >= CW || ny < 0 || ny >= CH) continue;
                        const ni = (ny * CW + nx) * 3;
                        errBuf[ni] += er * w; errBuf[ni + 1] += eg * w; errBuf[ni + 2] += eb * w;
                    }
                }
                out[i] = pick[0]; out[i + 1] = pick[1]; out[i + 2] = pick[2]; out[i + 3] = 255;
            }
        }
    }
    return { image: { width: W, height: H, data: out }, cellClut };
}

// --- the variants under test ---------------------------------------------

/**
 * EXACTLY what the app does today: the shipped builder AND the shipped
 * per-cell picker, whose ink/paper slots come from a most-frequent heuristic
 * rather than a search. This is the true baseline; `shipped` below keeps the
 * same palette but renders with the exhaustive pair search the staged variants
 * use, which isolates how much of any difference is the PALETTE and how much
 * is the MAPPER.
 */
function appToday(img, opts = {}) {
    const regs = PaletteOps.buildUlaplusRegisters(img);
    const rgbs = Array.from(regs, (r) => ULAPLUS.registerToRGB(r));
    const out = new Uint8ClampedArray(W * H * 4);
    const cellClut = new Int8Array(CELLS);

    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const flat = [];
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                flat.push(img.data[i], img.data[i + 1], img.data[i + 2]);
            }
        }
        const pick = PaletteOps.chooseUlaplusCellPair(flat, rgbs);
        cellClut[ci] = pick.clut;
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
                const c = d2(px, pick.inkRGB) <= d2(px, pick.paperRGB) ? pick.inkRGB : pick.paperRGB;
                out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
            }
        }
    }
    return { regs, image: { width: W, height: H, data: out }, cellClut };
}

/** The shipped PALETTE, rendered with the exhaustive pair search. */
function shipped(img, opts = {}) {
    const regs = PaletteOps.buildUlaplusRegisters(img);
    const rgbs = Array.from(regs, (r) => ULAPLUS.registerToRGB(r));
    const assign = new Int8Array(CELLS);
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const flat = [];
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                flat.push(img.data[i], img.data[i + 1], img.data[i + 2]);
            }
        }
        assign[ci] = PaletteOps.chooseUlaplusCellPair(flat, rgbs).clut;
    }
    return { regs, ...renderCells(img, regs, assign, {
        inkSlots: 8, paperSlots: 8, codec: ULAPLUS_CODEC, dither: opts.dither || 'none'
    }) };
}

/** The six-step method, parameterised so each element can be isolated. */
function staged(img, cfg) {
    const codec = ULAPLUS_CODEC;
    const snapped = cfg.snapFirst ? snapImage(img, codec) : img;
    const cells = analyseCells(snapped, { roleByFreq: cfg.roleByFreq });
    const assign = clusterCells(cells, 4, { spatialWeight: cfg.spatialWeight });

    let anchorInk, anchorPaper;
    if (cfg.anchors) {
        anchorInk = anchorPaper = dominantColour(snapped, codec);
    }
    const regs = buildBuckets(cells, assign, {
        k: 4, inkSlots: 8, paperSlots: 8, codec, anchorInk, anchorPaper
    });
    return { regs, ...renderCells(snapped, regs, assign, {
        inkSlots: 8, paperSlots: 8, codec, dither: cfg.dither || 'none'
    }) };
}

/**
 * Crop to 4:3 about the centre. The Spectrum screen is 4:3, and squashing a
 * 16:9 photo into it distorts everything before a single colour decision is
 * made.
 */
function cropTo43(img) {
    const want = 4 / 3;
    const have = img.width / img.height;
    if (Math.abs(have - want) < 0.001) return img;

    let cw2, ch2, ox, oy;
    if (have > want) { ch2 = img.height; cw2 = Math.round(img.height * want); }
    else { cw2 = img.width; ch2 = Math.round(img.width / want); }
    ox = Math.floor((img.width - cw2) / 2);
    oy = Math.floor((img.height - ch2) / 2);

    const data = new Uint8ClampedArray(cw2 * ch2 * 4);
    for (let y = 0; y < ch2; y++) {
        for (let x = 0; x < cw2; x++) {
            const s2 = ((y + oy) * img.width + (x + ox)) * 4, d = (y * cw2 + x) * 4;
            data[d] = img.data[s2]; data[d + 1] = img.data[s2 + 1];
            data[d + 2] = img.data[s2 + 2]; data[d + 3] = 255;
        }
    }
    return { width: cw2, height: ch2, data };
}

/**
 * Decide at FULL resolution, shrink afterwards.
 *
 * Every other variant here box-filters the photo down to 256x192 first and
 * then asks each 8x8 cell for two colours. That averages 4x4 blocks of real
 * detail into one pixel BEFORE anything looks at it, so fine bright detail is
 * already grey mush by the time the quantiser sees it.
 *
 * This splits the ORIGINAL into the same 32x24 grid - cells of maybe 32x24
 * pixels rather than 8x8 - and picks each cell's two colours from all of that
 * evidence. Only then does it shrink, and the way it shrinks is the point:
 *
 *   'mean'     each output pixel takes the average of the source block it
 *              covers and picks the nearer of the cell's two colours. Simple,
 *              and equivalent to a very good downscale followed by a threshold.
 *   'coverage' each output pixel measures what FRACTION of its source block
 *              was nearer the ink, then thresholds that fraction against an
 *              ordered Bayer matrix. A block that was 40% ink becomes ink 40%
 *              of the time in a fixed pattern - so the cell can express tones
 *              between its two colours, computed from real detail rather than
 *              from a blur. This is supersampled dithering, and it is the
 *              version worth having.
 */
const BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
];

function supersampled(orig, cfg) {
    const codec = ULAPLUS_CODEC;
    const src = cropTo43(orig);
    const sw = src.width / CELLS_X, sh = src.height / CELLS_Y;

    // Stage 2 at full resolution: each cell's two dominant colours, by count
    const cells = [];
    for (let cy = 0; cy < CELLS_Y; cy++) {
        for (let cx = 0; cx < CELLS_X; cx++) {
            const x0 = Math.floor(cx * sw), x1 = Math.floor((cx + 1) * sw);
            const y0 = Math.floor(cy * sh), y1 = Math.floor((cy + 1) * sh);
            const counts = new Map();
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * src.width + x) * 4;
                    const idx = codec.toIndex(src.data[i], src.data[i + 1], src.data[i + 2]);
                    const e = counts.get(idx);
                    if (e) e.n++; else counts.set(idx, { rgb: codec.toRGB(idx), n: 1 });
                }
            }
            const ranked = [...counts.values()].sort((a, b) => b.n - a.n);
            const f = ranked[0].rgb, sec = (ranked[1] || ranked[0]).rgb;
            const ink = lum(f) <= lum(sec) ? f : sec;
            const paper = ink === f ? sec : f;
            cells.push({ cx, cy, ink, paper, x0, x1, y0, y1 });
        }
    }

    const assign = clusterCells(cells, 4, { spatialWeight: cfg.spatialWeight || 0 });
    const regs = buildBuckets(cells, assign, {
        k: 4, inkSlots: 8, paperSlots: 8, codec,
        anchorInk: cfg.anchors ? dominantColour(src, codec) : undefined,
        anchorPaper: cfg.anchors ? dominantColour(src, codec) : undefined
    });
    const rgbs = Array.from(regs, (r) => codec.toRGB(r));

    const out = new Uint8ClampedArray(W * H * 4);
    const cellClut = new Int8Array(CELLS);

    for (let ci = 0; ci < CELLS; ci++) {
        const cell = cells[ci];
        const clut = assign[ci];
        cellClut[ci] = clut;
        const inks = rgbs.slice(clut * 16, clut * 16 + 8);
        const papers = rgbs.slice(clut * 16 + 8, clut * 16 + 16);

        // Pick the pair over the cell's FULL-RESOLUTION pixels
        let bi = 0, bp = 0, bestErr = Infinity;
        for (let a = 0; a < inks.length; a++) {
            for (let b = 0; b < papers.length; b++) {
                let err = 0;
                for (let y = cell.y0; y < cell.y1; y += 2) {
                    for (let x = cell.x0; x < cell.x1; x += 2) {
                        const i = (y * src.width + x) * 4;
                        const px = [src.data[i], src.data[i + 1], src.data[i + 2]];
                        err += Math.min(d2(px, inks[a]), d2(px, papers[b]));
                    }
                }
                if (err < bestErr) { bestErr = err; bi = a; bp = b; }
            }
        }
        const inkRGB = inks[bi], paperRGB = papers[bp];

        // Shrink: each output pixel covers a block of the original
        const bw = (cell.x1 - cell.x0) / CW, bh = (cell.y1 - cell.y0) / CH;
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const bx0 = Math.floor(cell.x0 + dx * bw), bx1 = Math.max(bx0 + 1, Math.floor(cell.x0 + (dx + 1) * bw));
                const by0 = Math.floor(cell.y0 + dy * bh), by1 = Math.max(by0 + 1, Math.floor(cell.y0 + (dy + 1) * bh));

                let r = 0, g = 0, b = 0, n = 0, inkN = 0;
                for (let y = by0; y < by1 && y < src.height; y++) {
                    for (let x = bx0; x < bx1 && x < src.width; x++) {
                        const i = (y * src.width + x) * 4;
                        const px = [src.data[i], src.data[i + 1], src.data[i + 2]];
                        r += px[0]; g += px[1]; b += px[2]; n++;
                        if (d2(px, inkRGB) <= d2(px, paperRGB)) inkN++;
                    }
                }
                const i = ((cell.cy * CH + dy) * W + (cell.cx * CW + dx)) * 4;
                let c;
                if (cfg.shrink === 'coverage') {
                    // What fraction of the real detail was ink, ordered-dithered
                    const frac = inkN / n;
                    c = frac * 64 > BAYER8[dy & 7][dx & 7] ? inkRGB : paperRGB;
                } else {
                    const mean = [r / n, g / n, b / n];
                    c = d2(mean, inkRGB) <= d2(mean, paperRGB) ? inkRGB : paperRGB;
                }
                out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
            }
        }
    }
    return { regs, image: { width: W, height: H, data: out }, cellClut };
}

/*
 * DIAGNOSTICS. Neither of these can be encoded in a ULAplus attribute byte -
 * they exist to say WHERE the quality goes, by removing one constraint at a
 * time and looking at what comes back.
 *
 *   free2   64 colours chosen globally, any 2 of them per cell. Removes both
 *           the CLUT grouping and the ink/paper split. This is the ceiling
 *           for "64 registers, two colours a cell".
 *   noHalf  our 4 CLUTs, but a cell may take any 2 of its CLUT's 16 - the
 *           ink/paper half split removed and nothing else.
 *
 * If free2 looks good and noHalf does not, the CLUT grouping is the problem.
 * If noHalf looks good and the shipped output does not, the LUMINANCE SPLIT
 * into ink and paper halves is the problem.
 */
function oracleFree2(img) {
    const codec = ULAPLUS_CODEC;
    const counts = new Map();
    for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        const idx = codec.toIndex(img.data[o], img.data[o + 1], img.data[o + 2]);
        const e = counts.get(idx);
        if (e) e.n++; else counts.set(idx, { rgb: codec.toRGB(idx), n: 1 });
    }
    const palette = weightedCut([...counts.values()], 64, codec).map((i) => codec.toRGB(i));
    return renderPairs(img, palette, () => palette, 0);
}

function oracleNoHalf(img) {
    const codec = ULAPLUS_CODEC;
    const snapped = snapImage(img, codec);
    const cells = analyseCells(snapped, {});
    const assign = clusterCells(cells, 4, { spatialWeight: 12 });
    const regs = buildBuckets(cells, assign, {
        k: 4, inkSlots: 8, paperSlots: 8, codec
    });
    const rgbs = Array.from(regs, (r) => codec.toRGB(r));
    return renderPairs(snapped, rgbs,
        (ci) => rgbs.slice(assign[ci] * 16, assign[ci] * 16 + 16), assign);
}

/** Shared renderer for the diagnostics: best UNRESTRICTED pair from a set. */
function renderPairs(img, allRGB, setFor, assign) {
    const out = new Uint8ClampedArray(W * H * 4);
    const cellClut = new Int8Array(CELLS);
    const regsSeen = new Set();
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const set = setFor(ci);
        cellClut[ci] = assign ? assign[ci] : 0;
        const px = [];
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                px.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
            }
        }
        let bestA = set[0], bestB = set[0], bestErr = Infinity;
        for (let a = 0; a < set.length; a++) {
            for (let b = a; b < set.length; b++) {
                let err = 0;
                for (const p of px) err += Math.min(d2(p, set[a]), d2(p, set[b]));
                if (err < bestErr) { bestErr = err; bestA = set[a]; bestB = set[b]; }
            }
        }
        let k = 0;
        for (let dy = 0; dy < CH; dy++) {
            for (let dx = 0; dx < CW; dx++, k++) {
                const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
                const c = d2(px[k], bestA) <= d2(px[k], bestB) ? bestA : bestB;
                out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
            }
        }
    }
    for (const c of allRGB) regsSeen.add(ULAPLUS.rgbToRegister(...c));
    return { regs: Uint8Array.from(regsSeen), image: { width: W, height: H, data: out }, cellClut };
}

const VARIANTS = [
    { name: 'app-today', run: (img) => appToday(img) },
    { name: 'shipped+pair', run: (img) => shipped(img) },
    { name: 'staged', run: (img) => staged(img, { snapFirst: true }) },
    { name: 'staged+spatial', run: (img) => staged(img, { snapFirst: true, spatialWeight: 12 }) },
    { name: 'staged+anchor', run: (img) => staged(img, { snapFirst: true, anchors: true }) },
    { name: 'staged+both', run: (img) => staged(img, { snapFirst: true, spatialWeight: 12, anchors: true }) },
    { name: 'staged+freq', run: (img) => staged(img, { snapFirst: true, roleByFreq: true }) },
    { name: 'shipped+fs', run: (img) => shipped(img, { dither: 'fs' }) },
    { name: 'super-mean', run: (img, orig) => supersampled(orig, { spatialWeight: 12, shrink: 'mean' }) },
    { name: 'super-cover', run: (img, orig) => supersampled(orig, { spatialWeight: 12, shrink: 'coverage' }) },
    { name: 'super-cov+anc', run: (img, orig) => supersampled(orig, { spatialWeight: 12, anchors: true, shrink: 'coverage' }) },
    { name: 'DIAG-free2', run: (img) => oracleFree2(img) },
    { name: 'DIAG-noHalf', run: (img) => oracleNoHalf(img) },
    { name: 'staged+fs', run: (img) => staged(img, { snapFirst: true, spatialWeight: 12, dither: 'fs' }) }
];

module.exports = {
    VARIANTS, appToday, supersampled, cropTo43, snapImage, analyseCells, clusterCells, buildBuckets, weightedCut,
    renderCells, dominantColour, shipped, staged, ULAPLUS_CODEC
};
