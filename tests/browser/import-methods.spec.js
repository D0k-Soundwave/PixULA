'use strict';
/**
 * Three conversions, shown side by side, chosen by eye.
 *
 * Measured on seven real photographs (tools/palette-bench.js), each method WON
 * a different metric and lost the others, and no single number predicted which
 * picture a person would prefer. So the app stops choosing: it renders all
 * three and lets the artist pick.
 *
 *   sharp   colours chosen from every pixel of the ORIGINAL the cell covers,
 *           not from the 64 already-averaged screen pixels. Best structure.
 *   smooth  dithered. Best average tone, noisier up close.
 *   flat    no dither. Cleanest blocks.
 *
 * The load-bearing spec here is the second one: the three panes must actually
 * differ. A chooser whose options render identically is worse than no chooser,
 * and it is exactly what a silently-ignored `method` option would produce.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** A detailed test image: fine structure the downscale would otherwise eat. */
const makeImage = (page, w = 512, h = 384) => page.evaluate(({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const d = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            // A smooth ramp plus one-pixel detail, which is the case the
            // full-resolution method exists for
            const fine = ((x ^ y) & 1) ? 70 : 0;
            d.data[i] = 40 + (x / w) * 180 + fine;
            d.data[i + 1] = 30 + (y / h) * 120;
            d.data[i + 2] = 200 - (x / w) * 150 + fine;
            d.data[i + 3] = 255;
        }
    }
    ctx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
}, { w, h });

/** Decode through the app's own seam, and park the result for the page code. */
const decodeToImageData = (page, dataUrl) => page.evaluate(async (url) => {
    const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
    window.__src = await PNGFormat.decodeToImageData(bytes.buffer, 'image/png');
    return { w: window.__src.width, h: window.__src.height };
}, dataUrl);

test('the three methods produce visibly different pictures', async ({ page }) => {
    await boot(page);
    await decodeToImageData(page, await makeImage(page));

    // Drive the SAME table the dialog renders, so a drifted pairing cannot
    // pass here while the panes show something else
    const r = await page.evaluate(() => {
        // Share of pixels differing in red or green. Both channels, because
        // two ZX colours can share a red level - comparing red alone puts
        // smooth vs flat under the threshold on this image.
        const differing = (a, b) => {
            let n = 0;
            for (let i = 0; i < a.data.length; i += 4) {
                if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1]) n++;
            }
            return n / (a.data.length / 4);
        };
        const hash = (q) => {
            let h = 0;
            for (let i = 0; i < q.data.length; i += 4) {
                h = (h * 31 + q.data[i] + q.data[i + 1] * 3 + q.data[i + 2] * 7) | 0;
            }
            return h;
        };
        const set = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit' });
        const by = (id) => set.find((s) => s.id === id).preview;
        return {
            ids: set.map((s) => s.id),
            hashes: set.map((s) => hash(s.preview)),
            sharpVsFlat: differing(by('sharp'), by('flat')),
            smoothVsFlat: differing(by('smooth'), by('flat'))
        };
    });

    // All three distinct - if `method` were ignored, sharp would equal flat
    expect(r.ids).toEqual(['sharp', 'smooth', 'flat']);
    expect(new Set(r.hashes).size).toBe(3);
    expect(r.sharpVsFlat).toBeGreaterThan(0.02);
    expect(r.smoothVsFlat).toBeGreaterThan(0.02);
});

test('the sharp method reads the original, not the downscaled copy', async ({ page }) => {
    await boot(page);

    /*
     * A one-pixel checker of black and white averages to mid-grey the moment
     * it is scaled down, so the standard path sees grey and renders grey. The
     * full-resolution path sees the real black and white the cell is made of
     * and renders both, which is the whole reason the method exists.
     *
     * Compared against a genuinely flat mid-grey of the same average: the two
     * are indistinguishable after the downscale and obviously different before
     * it.
     */
    const r = await page.evaluate(() => {
        const build = (checker) => {
            const c = document.createElement('canvas');
            c.width = 512; c.height = 384;
            const ctx = c.getContext('2d');
            const d = ctx.createImageData(512, 384);
            for (let y = 0; y < 384; y++) {
                for (let x = 0; x < 512; x++) {
                    const i = (y * 512 + x) * 4;
                    // Both average to mid-grey over any 2x2 block; one is flat,
                    // the other a one-pixel checker of black and white
                    const v = checker ? (((x ^ y) & 1) ? 255 : 0) : 128;
                    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
                    d.data[i + 3] = 255;
                }
            }
            ctx.putImageData(d, 0, 0);
            return ctx.getImageData(0, 0, 512, 384);
        };
        const flatSrc = build(false), checkSrc = build(true);
        const opt = (m) => ({ method: m, dithering: 'none', scaling: 'fit' });
        const diff = (a, b) => {
            let n = 0;
            for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i]) n++;
            return n / (a.data.length / 4);
        };
        return {
            standard: diff(PNGFormat.quantizeForPreview(flatSrc, opt('standard')),
                           PNGFormat.quantizeForPreview(checkSrc, opt('standard'))),
            detail: diff(PNGFormat.quantizeForPreview(flatSrc, opt('detail')),
                         PNGFormat.quantizeForPreview(checkSrc, opt('detail')))
        };
    });

    // Downscaling averages the checker to the same grey as the flat source,
    // so the standard path renders them near-identically
    expect(r.standard).toBeLessThan(0.05);
    // The full-resolution path sees black and white and keeps them
    expect(r.detail).toBeGreaterThan(0.2);
});

test('the dialog shows one preview per method and the pick reaches the import',
    async ({ page }) => {
        await boot(page);
        const dataUrl = await makeImage(page);

        const shown = page.evaluate(async (url) => {
            const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
            return ImportDialog.show(bytes.buffer, 'png');
        }, dataUrl);

        await page.waitForSelector('.import-methods .import-method');
        const panes = page.locator('.import-methods .import-method');
        await expect(panes).toHaveCount(3);
        await expect(panes.first()).toHaveClass(/active/);

        // Every pane painted something, and they are not all the same picture
        const painted = await page.evaluate(() =>
            [...document.querySelectorAll('.import-method canvas')].map((c) =>
                c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0, 4000)
                    .reduce((h, v) => (h * 31 + v) | 0, 0)));
        expect(new Set(painted).size).toBe(3);

        await panes.nth(1).click();                       // Smooth
        await expect(panes.nth(1)).toHaveClass(/active/);
        await expect(panes.first()).not.toHaveClass(/active/);

        await page.locator('#dialog-import-conversion .app-dialog-footer button.primary').click();
        const chosen = await shown;
        expect(chosen.method).toBe('standard');
        expect(chosen.dithering).toBe('floyd-steinberg');
        expect(chosen.choice).toBe('smooth');
    });
