'use strict';
/*
 * palette-bench.js - the yardstick for palette-building pipelines.
 *
 *     node tools/palette-bench.js [imageDir] [--detail] [--write outDir]
 *
 * WHY THIS EXISTS. Three plausible improvements to the ULAplus pipeline were
 * tried on 2026-08-08 and all three made the picture WORSE. Nothing about a
 * quantiser is obvious enough to change on reasoning alone, so no pipeline
 * change lands here without a before/after from this tool.
 *
 * WHAT IT MEASURES, and why mean squared error is not enough on its own.
 * MSE is dominated by area, so a smooth ramp crushed to seven levels scores
 * WELL while banding visibly - which is exactly the complaint that started
 * this. So five numbers, and the last three are the ones that catch what the
 * eye catches:
 *
 *   dSSIM    structural dissimilarity, 1 - SSIM on luma. READ THIS FIRST. It
 *            is the only column that noticed when a conversion kept the
 *            shapes; the colour columns all preferred a noisy dither that
 *            dissolved them.
 *   used     distinct registers of 64. Low is not automatically bad: an image
 *            holding six colours should use six. Read it beside dE.
 *   mse      RGB squared error per pixel. Kept for continuity, not trusted.
 *   dE       mean CIE76 deltaE in Lab, per pixel. Perceptual, but it PUNISHES
 *            dithering - see dEblur.
 *   dEblur   the same after a 3x3 blur of both images, which is roughly what
 *            the eye does. THE dither number: a two-colour cell expressing a
 *            third tone as a checker scores badly on dE and correctly here.
 *   dE95     95th-percentile deltaE. THE banding number: a ramp quantised too
 *            coarsely has a fine mean and a terrible tail.
 *   seams    fraction of adjacent cell pairs sitting on different CLUTs.
 *            Fragmentation, not ugliness - a CLUT change only matters if it
 *            SHOWS, which is what the next column measures.
 *   jump     THE seam number. For every neighbouring pixel pair straddling a
 *            cell boundary, how far the output's colour step departs from the
 *            source's, in deltaE. A smooth source rendered with a ridge along
 *            the boundary scores high; a CLUT change landing on a shared
 *            colour scores zero. This is what an anchor colour is for.
 *
 * IMAGES. A built-in synthetic set runs with no arguments, chosen to separate
 * the failure modes rather than to look pretty. Point it at a directory of
 * PNGs to use real photographs, which is what any conclusion should rest on:
 *
 *     node tools/palette-bench.js docs/bench-images
 *
 * ANY FORMAT. Drop in JPEG, PNG, WebP, AVIF, GIF or BMP. PNG is decoded here
 * with node:zlib in about sixty lines, which is the right trade for one
 * well-specified format. Everything else is converted to PNG once, on demand,
 * by handing it to Chrome through the Playwright harness this repo already
 * depends on for its browser tests - a hand-rolled JPEG decoder is hundreds of
 * lines and still falls over on the progressive files half the web serves,
 * while a conversion that cannot be wrong costs forty. Converted PNGs are
 * cached beside the source and reused until the source changes.
 *
 * The APP depends on none of this. It is a bench tool.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const { installStubs, loadModule } = require(path.join(ROOT, 'tests/helpers/zx-stubs'));
installStubs({});
loadModule('js/utils/palette-ops.js');

const W = 256, H = 192, CW = 8, CH = 8;
const CELLS_X = W / CW, CELLS_Y = H / CH, CELLS = CELLS_X * CELLS_Y;

// --- PNG in, no dependencies ---------------------------------------------

function readPNG(file) {
    const buf = fs.readFileSync(file);
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

    let pos = 8, w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
    const idat = [];
    let palette = null, trns = null;

    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const body = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            w = body.readUInt32BE(0); h = body.readUInt32BE(4);
            depth = body[8]; colour = body[9]; interlace = body[12];
        } else if (type === 'PLTE') {
            palette = body;
        } else if (type === 'tRNS') {
            trns = body;
        } else if (type === 'IDAT') {
            idat.push(body);
        } else if (type === 'IEND') break;
        pos += 12 + len;
    }
    if (depth !== 8) throw new Error(`unsupported bit depth ${depth} (need 8)`);
    if (interlace) throw new Error('interlaced PNG not supported');

    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
    if (!channels) throw new Error(`unsupported colour type ${colour}`);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const out = new Uint8ClampedArray(w * h * 4);
    const line = Buffer.alloc(stride);
    let prev = Buffer.alloc(stride);
    let p = 0;

    for (let y = 0; y < h; y++) {
        const filter = raw[p++];
        raw.copy(line, 0, p, p + stride);
        p += stride;
        // PNG scanline filters, per the spec's reconstruction formulas
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? line[i - channels] : 0;
            const b = prev[i];
            const c = i >= channels ? prev[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            line[i] = v & 0xFF;
        }
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (colour === 3) {
                const idx = line[x] * 3;
                out[o] = palette[idx]; out[o + 1] = palette[idx + 1]; out[o + 2] = palette[idx + 2];
                out[o + 3] = trns && trns[line[x]] !== undefined ? trns[line[x]] : 255;
            } else if (colour === 0 || colour === 4) {
                const g = line[x * channels];
                out[o] = out[o + 1] = out[o + 2] = g;
                out[o + 3] = colour === 4 ? line[x * channels + 1] : 255;
            } else {
                const s = x * channels;
                out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2];
                out[o + 3] = colour === 6 ? line[s + 3] : 255;
            }
        }
        prev = Buffer.from(line);
    }
    return { width: w, height: h, data: out };
}

/** Formats Chrome will decode for us when node:zlib cannot. */
const CONVERTIBLE = /\.(jpe?g|webp|avif|gif|bmp)$/i;

/**
 * Convert everything in `dir` that is not a PNG, caching the result beside it.
 *
 * Launches one browser for the whole batch and skips anything already
 * converted and still newer than its source.
 * @returns {Promise<number>} how many files were converted
 */
async function convertNonPNG(dir) {
    const pending = fs.readdirSync(dir).filter((f) => {
        if (!CONVERTIBLE.test(f)) return false;
        const out = path.join(dir, path.basename(f, path.extname(f)) + '.png');
        return !fs.existsSync(out) ||
            fs.statSync(out).mtimeMs < fs.statSync(path.join(dir, f)).mtimeMs;
    });
    if (!pending.length) return 0;

    let chromium;
    try {
        ({ chromium } = require('@playwright/test'));
    } catch (e) {
        console.error(`  ${pending.length} non-PNG image(s) need converting, but Playwright
` +
                      '  is not installed. Run `npm install`, or convert them yourself.');
        return 0;
    }

    console.log(`Converting ${pending.length} image(s) to PNG (cached beside the source)...`);
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage();
    let done = 0;
    for (const file of pending) {
        const src = path.join(dir, file);
        const dataUrl = 'data:application/octet-stream;base64,' +
            fs.readFileSync(src).toString('base64');
        const res = await page.evaluate(async (url) => {
            const img = new Image();
            img.src = url;
            try { await img.decode(); } catch (e) { return { error: e.message }; }
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            return { data: c.toDataURL('image/png') };
        }, dataUrl);
        if (res.error) {
            console.error(`  could not decode ${file}: ${res.error}`);
            continue;
        }
        fs.writeFileSync(path.join(dir, path.basename(file, path.extname(file)) + '.png'),
            Buffer.from(res.data.split(',')[1], 'base64'));
        done++;
    }
    await browser.close();
    console.log(`  converted ${done}
`);
    return done;
}

/** Box-filter down (or nearest up) to the Spectrum screen. Step 1 of the pipeline. */
function fitToScreen(img) {
    if (img.width === W && img.height === H) return img;
    const out = new Uint8ClampedArray(W * H * 4);
    const sx = img.width / W, sy = img.height / H;
    for (let y = 0; y < H; y++) {
        const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
        for (let x = 0; x < W; x++) {
            const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
            let r = 0, g = 0, b = 0, n = 0;
            for (let yy = y0; yy < y1 && yy < img.height; yy++) {
                for (let xx = x0; xx < x1 && xx < img.width; xx++) {
                    const i = (yy * img.width + xx) * 4;
                    r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
                }
            }
            const o = (y * W + x) * 4;
            out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
        }
    }
    return { width: W, height: H, data: out };
}

/** Minimal PNG writer, so --write can produce something you can actually look at. */
function writePNG(file, img) {
    const stride = img.width * 3;
    const raw = Buffer.alloc((stride + 1) * img.height);
    for (let y = 0; y < img.height; y++) {
        raw[y * (stride + 1)] = 0;
        for (let x = 0; x < img.width; x++) {
            const s = (y * img.width + x) * 4, d = y * (stride + 1) + 1 + x * 3;
            raw[d] = img.data[s]; raw[d + 1] = img.data[s + 1]; raw[d + 2] = img.data[s + 2];
        }
    }
    const chunk = (type, body) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
        const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    fs.writeFileSync(file, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
    ]));
}

let CRC_TABLE = null;
function crc32(buf) {
    if (!CRC_TABLE) {
        CRC_TABLE = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            CRC_TABLE[n] = c;
        }
    }
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return c ^ -1;
}

// --- metrics --------------------------------------------------------------

/** sRGB -> CIE L*a*b*, D65. Needed because RGB distance is not what the eye reports. */
function toLab(r, g, b) {
    const f = (v) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
    const R = f(r), G = f(g), B = f(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const k = (v) => v > 0.008856 ? Math.cbrt(v) : (7.787 * v + 16 / 116);
    x = k(x); y = k(y); z = k(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Score a rendered result against its source.
 * @param {Object} src   - {width,height,data} the 256x192 source
 * @param {Object} out   - {width,height,data} the rendered result
 * @param {Uint8Array} regs - the 64 registers used
 * @param {Int8Array} cellClut - CLUT chosen per cell, for the seam metric
 */
function score(src, out, regs, cellClut) {
    let mse = 0;
    const dEs = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        const dr = src.data[o] - out.data[o];
        const dg = src.data[o + 1] - out.data[o + 1];
        const db = src.data[o + 2] - out.data[o + 2];
        mse += dr * dr + dg * dg + db * db;
        const a = toLab(src.data[o], src.data[o + 1], src.data[o + 2]);
        const b = toLab(out.data[o], out.data[o + 1], out.data[o + 2]);
        dEs[i] = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    }
    const sorted = Float64Array.from(dEs).sort();
    let dESum = 0;
    for (let i = 0; i < dEs.length; i++) dESum += dEs[i];

    /*
     * dEblur - the same comparison after both images are blurred 3x3.
     *
     * Per-pixel dE is the WRONG yardstick for dithered output and will always
     * prefer a flat, wrong colour to a dithered, right one: a checker of two
     * colours has enormous per-pixel error and is exactly how a two-colour
     * cell expresses a third tone. The eye integrates over a few pixels, so
     * measuring after a small blur is what tells you which one looks better
     * from a normal viewing distance. Judge dithering on THIS column; judge
     * banding on dE95.
     */
    const blur = (im) => {
        const o = new Float64Array(W * H * 3);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                let r = 0, g = 0, b = 0, n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const yy = y + dy, xx = x + dx;
                        if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
                        const i = (yy * W + xx) * 4;
                        r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; n++;
                    }
                }
                const d = (y * W + x) * 3;
                o[d] = r / n; o[d + 1] = g / n; o[d + 2] = b / n;
            }
        }
        return o;
    };
    const bs = blur(src), bo = blur(out);
    let dEBlurSum = 0;
    for (let i = 0; i < W * H; i++) {
        const a2 = toLab(bs[i * 3], bs[i * 3 + 1], bs[i * 3 + 2]);
        const b2 = toLab(bo[i * 3], bo[i * 3 + 1], bo[i * 3 + 2]);
        dEBlurSum += Math.sqrt((a2[0] - b2[0]) ** 2 + (a2[1] - b2[1]) ** 2 + (a2[2] - b2[2]) ** 2);
    }

    let seams = 0, pairs = 0;
    for (let cy = 0; cy < CELLS_Y; cy++) {
        for (let cx = 0; cx < CELLS_X; cx++) {
            const c = cellClut[cy * CELLS_X + cx];
            if (cx + 1 < CELLS_X) { pairs++; if (cellClut[cy * CELLS_X + cx + 1] !== c) seams++; }
            if (cy + 1 < CELLS_Y) { pairs++; if (cellClut[(cy + 1) * CELLS_X + cx] !== c) seams++; }
        }
    }

    /*
     * Seam harshness. Walk every neighbouring pixel pair that crosses a cell
     * boundary and compare the STEP the output takes with the step the source
     * takes. A smooth source rendered with a ridge along the boundary scores
     * high; a CLUT change that happens to land on a shared colour scores zero
     * - which counting CLUT changes can never show, and which is exactly what
     * a reserved anchor colour is supposed to buy.
     */
    let jump = 0, jumpN = 0;
    const labAt = (im, x, y) => {
        const o = (y * W + x) * 4;
        return toLab(im.data[o], im.data[o + 1], im.data[o + 2]);
    };
    const step = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    for (let y = 0; y < H; y++) {
        for (let x = CW - 1; x < W - 1; x += CW) {          // vertical boundaries
            jump += Math.abs(step(labAt(out, x, y), labAt(out, x + 1, y)) -
                             step(labAt(src, x, y), labAt(src, x + 1, y)));
            jumpN++;
        }
    }
    for (let y = CH - 1; y < H - 1; y += CH) {              // horizontal boundaries
        for (let x = 0; x < W; x++) {
            jump += Math.abs(step(labAt(out, x, y), labAt(out, x, y + 1)) -
                             step(labAt(src, x, y), labAt(src, x, y + 1)));
            jumpN++;
        }
    }

    /*
     * dSSIM - structural dissimilarity, 1 - SSIM on luma over 8x8 windows.
     *
     * The column that finally agreed with the eye. Every other number here
     * scores a pixel or a small neighbourhood in isolation, so all of them
     * prefer a noisy dither that gets the average tone right over a clean
     * result that keeps the shapes: dE punishes dithering, dEblur forgives it,
     * and NEITHER can see that an edge has been destroyed. SSIM compares local
     * mean, variance and covariance, which is to say it asks whether the
     * STRUCTURE survived - and structure is what makes a picture readable.
     *
     * Read this first and the colour columns second. A conversion that keeps
     * the shapes and shifts the hues still looks like the photograph; one that
     * nails the hues and dissolves the shapes does not.
     */
    const luma = (im) => {
        const o = new Float64Array(W * H);
        for (let i = 0; i < W * H; i++) {
            const q = i * 4;
            o[i] = 0.299 * im.data[q] + 0.587 * im.data[q + 1] + 0.114 * im.data[q + 2];
        }
        return o;
    };
    const la = luma(src), lb = luma(out);
    const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
    let ssimSum = 0, ssimN = 0;
    for (let by = 0; by + 8 <= H; by += 4) {
        for (let bx = 0; bx + 8 <= W; bx += 4) {
            let ma = 0, mb = 0;
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    ma += la[(by + y) * W + bx + x];
                    mb += lb[(by + y) * W + bx + x];
                }
            }
            ma /= 64; mb /= 64;
            let va = 0, vb = 0, cov = 0;
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const da = la[(by + y) * W + bx + x] - ma;
                    const db = lb[(by + y) * W + bx + x] - mb;
                    va += da * da; vb += db * db; cov += da * db;
                }
            }
            va /= 63; vb /= 63; cov /= 63;
            ssimSum += ((2 * ma * mb + C1) * (2 * cov + C2)) /
                       ((ma * ma + mb * mb + C1) * (va + vb + C2));
            ssimN++;
        }
    }

    return {
        dssim: 1 - ssimSum / ssimN,
        used: new Set(Array.from(regs)).size,
        mse: mse / (W * H),
        dE: dESum / dEs.length,
        dEblur: dEBlurSum / (W * H),
        dE95: sorted[Math.floor(sorted.length * 0.95)],
        seams: seams / pairs,
        jump: jump / jumpN
    };
}

// --- built-in synthetic images -------------------------------------------

function synth(fn) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const c = fn(x, y);
            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
        }
    }
    return { width: W, height: H, data };
}

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function builtinImages() {
    seed = 12345;
    return [
        // Smooth wide-area gradients: the banding case. Few distinct colours
        // exist in the register grid across a slow ramp, so dE95 is the tell.
        ['gradient-landscape', synth((x, y) => {
            let r, g, b;
            if (y < H * 0.45) { const t = y / (H * 0.45); r = 90 + 60 * t; g = 130 + 70 * t; b = 200 + 40 * t; }
            else if (y > H * 0.75) { const t = (y - H * 0.75) / (H * 0.25); r = 70 - 30 * t; g = 50 - 22 * t; b = 30 - 14 * t; }
            else { const t = (y - H * 0.45) / (H * 0.3); r = 40 + 50 * t; g = 100 + 60 * t; b = 40 + 30 * t; }
            const dx = x - W * 0.62, dy = y - H * 0.55;
            if (dx * dx + dy * dy < 34 * 34) { r = 235; g = 90; b = 70; }
            const n = ((x * 7 + y * 13) % 17) - 8;
            return [r + n, g + n, b + n];
        })],
        // Narrow hues over a wide luminance range: the skin-tone case, where
        // MSE looks fine and the result bands.
        ['skin-and-fabric', synth((x, y) => {
            const t = y / H, s = Math.sin(x / 18) * 0.5 + 0.5;
            return [190 - 60 * t + 30 * s, 150 - 70 * t + 20 * s, 130 - 70 * t + 15 * s];
        })],
        // Four separated colour regions: does the CLUT clustering find them,
        // and does it keep each one contiguous? The seam metric answers.
        ['four-regions', synth((x, y) => {
            const left = x < W / 2, top = y < H / 2;
            const base = left ? (top ? [40, 60, 170] : [30, 120, 60])
                : (top ? [200, 60, 50] : [210, 190, 90]);
            const n = (rnd() - 0.5) * 40;
            return [base[0] + n, base[1] + n, base[2] + n];
        })],
        // High local variance: the case where a per-cell two-colour model is
        // genuinely hard and every pipeline should struggle honestly.
        ['noisy-detail', synth((x, y) => {
            const base = [120 + 80 * Math.sin(x / 40) * Math.cos(y / 30),
                          110 + 70 * Math.sin(y / 25),
                          130 + 60 * Math.cos((x + y) / 35)];
            return base.map(v => v + (rnd() - 0.5) * 90);
        })],
        // Few flat colours: a pipeline should use few registers here and
        // score near-perfect. Catches a builder that spends slots for nothing.
        ['flat-graphic', synth((x, y) => {
            const pal = [[20, 20, 30], [220, 40, 50], [240, 230, 70], [30, 140, 200], [250, 250, 250], [15, 120, 60]];
            return pal[(Math.floor(x / 32) + Math.floor(y / 24)) % pal.length];
        })],
        // A single dominant background behind scattered subjects: the case
        // the anchor-colour idea is FOR. Without an anchor, neighbouring
        // cells on different CLUTs render the same background differently.
        ['subjects-on-ground', synth((x, y) => {
            const bg = [28, 30, 36];
            for (let k = 0; k < 6; k++) {
                const cx = 30 + k * 38, cy = 50 + ((k % 3) * 45);
                const dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy < 22 * 22) {
                    const hues = [[220, 70, 60], [70, 200, 90], [240, 210, 80],
                                  [90, 120, 240], [230, 120, 200], [120, 230, 220]];
                    return hues[k];
                }
            }
            return [bg[0] + (rnd() - 0.5) * 8, bg[1] + (rnd() - 0.5) * 8, bg[2] + (rnd() - 0.5) * 8];
        })]
    ];
}

module.exports = {
    W, H, CW, CH, CELLS_X, CELLS_Y, CELLS,
    readPNG, convertNonPNG, writePNG, fitToScreen, score, toLab, synth, builtinImages
};

// --- CLI ------------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    const writeAt = args.indexOf('--write');
    const outDir = writeAt >= 0 ? args[writeAt + 1] : null;
    const dir = args.find((a) => !a.startsWith('--') && a !== outDir);

    let images;
    if (dir) {
        if (!fs.existsSync(dir)) {
            console.error(`No such directory: ${dir}\n` +
                'Paths are relative to the repo root, so run this from there:\n' +
                '  node tools/palette-bench.js docs/bench-images');
            process.exit(1);
        }
        await convertNonPNG(dir);
        const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
        if (!files.length) {
            console.error(`No PNGs in ${dir}. Put some there, or run with no arguments for the synthetic set.`);
            process.exit(1);
        }
        images = files.map((f) => {
            try {
                const raw = readPNG(path.join(dir, f));
                return [path.basename(f, path.extname(f)), fitToScreen(raw), raw];
            } catch (e) {
                console.error(`  skipped ${f}: ${e.message}`);
                return null;
            }
        }).filter(Boolean);
    } else {
        images = builtinImages();
        console.log('Synthetic set. Point at a directory of PNGs for real photographs:\n' +
                    '  node tools/palette-bench.js docs/bench-images\n');
    }

    const { VARIANTS } = require('./palette-pipelines.js');

    if (outDir) fs.mkdirSync(outDir, { recursive: true });

    const totals = new Map();
    for (const [name, img, orig] of images) {
        console.log(`\n${name}`);
        console.log('  variant          dSSIM   used     dE  dEblur   dE95   seams    jump');
        for (const v of VARIANTS) {
            const res = v.run(img, orig || img);
            const s = score(img, res.image, res.regs, res.cellClut);
            if (!totals.has(v.name)) totals.set(v.name, []);
            totals.get(v.name).push(s);
            console.log('  ' + v.name.padEnd(16) +
                s.dssim.toFixed(3).padStart(5) + '  ' +
                String(s.used).padStart(4) + '  ' +
                s.dE.toFixed(2).padStart(6) + '  ' + s.dEblur.toFixed(2).padStart(6) + '  ' +
                s.dE95.toFixed(2).padStart(6) + '  ' +
                (s.seams * 100).toFixed(1).padStart(5) + '%  ' + s.jump.toFixed(2).padStart(6));
            if (outDir) writePNG(path.join(outDir, `${name}--${v.name}.png`), res.image);
        }
        if (outDir) writePNG(path.join(outDir, `${name}--source.png`), img);
    }

    console.log('\n=== mean across ' + images.length + ' images ===');
    console.log('  variant          dSSIM   used     dE  dEblur   dE95   seams    jump');
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    for (const [name, rows] of totals) {
        console.log('  ' + name.padEnd(16) +
            mean(rows.map(r => r.dssim)).toFixed(3).padStart(5) + '  ' +
            mean(rows.map(r => r.used)).toFixed(1).padStart(4) + '  ' +
            mean(rows.map(r => r.dE)).toFixed(2).padStart(6) + '  ' + mean(rows.map(r => r.dEblur)).toFixed(2).padStart(6) + '  ' +
            mean(rows.map(r => r.dE95)).toFixed(2).padStart(6) + '  ' +
            (mean(rows.map(r => r.seams)) * 100).toFixed(1).padStart(5) + '%  ' + mean(rows.map(r => r.jump)).toFixed(2).padStart(6));
    }
    console.log('\nLower is better for every column except `used`, which should be read\n' +
                'beside dE: few registers on a flat graphic is right, few on a gradient\n' +
                'is banding. dE95 is the banding number, jump is the seam number.');
    if (outDir) console.log(`\nRendered comparisons written to ${outDir}/`);
}

if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
