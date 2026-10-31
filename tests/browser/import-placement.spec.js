'use strict';
/**
 * The Import dialog's Placement group: the Reference panel's controls (Fit, Fill, Stretch, Center, Scale, Rotation,
 * Offset, the flips) and a button that copies the reference layer's placement.
 *
 * The load-bearing spec is the first: opening on Fit and pressing OK must import exactly what the old Scaling = Fit
 * imported, pixel for pixel. The others check that a placement really moves the picture - in the preview and in the
 * Sharp method's full-resolution copy - and that the controls reach the result.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** A picture with structure in both directions, so a move or a mirror shows. */
const makeImage = (page, w, h) => page.evaluate(({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const d = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            d.data[i] = 30 + (x / w) * 200;
            d.data[i + 1] = ((x >> 3) + (y >> 4)) & 1 ? 200 : 20;
            d.data[i + 2] = 220 - (y / h) * 180;
            d.data[i + 3] = 255;
        }
    }
    ctx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
}, { w, h });

const decode = (page, dataUrl) => page.evaluate(async (url) => {
    const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
    window.__src = await PNGFormat.decodeToImageData(bytes.buffer, 'image/png');
}, dataUrl);

const openDialog = (page, dataUrl) => page.evaluate((url) => {
    const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
    window.__shown = ImportDialog.show(bytes.buffer, 'png');
}, dataUrl);

const pressOk = async (page) => {
    await page.locator('#dialog-import-conversion .app-dialog-footer button.primary').click();
    return page.evaluate(() => window.__shown);
};

test('opening on Fit imports exactly what Scaling = Fit did', async ({ page }) => {
    await boot(page);
    const url = await makeImage(page, 640, 360);
    await decode(page, url);
    await openDialog(page, url);
    await page.waitForSelector('#import-scale');
    const chosen = await pressOk(page);
    expect(chosen.scaling).toBe('fit');
    expect(chosen.placement).not.toBeNull();

    const same = await page.evaluate((placement) => {
        const a = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit' });
        const b = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit', placement });
        return a.map((x, i) => {
            const p = x.preview.data, q = b[i].preview.data;
            let diff = 0;
            for (let j = 0; j < p.length; j++) if (p[j] !== q[j]) diff++;
            return { id: x.id, diff };
        });
    }, chosen.placement);
    for (const m of same) expect(m.diff, m.id).toBe(0);
});

test('an offset moves the picture by whole cells, and a flip mirrors Sharp too', async ({ page }) => {
    await boot(page);
    // Screen-sized and at 100%, so every pixel lands on a pixel and the shift is exact
    await decode(page, await makeImage(page, 256, 192));
    const r = await page.evaluate(() => {
        const P = (o) => ({ scale: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false, ...o });
        const flat = (placement) => PNGFormat.quantizeForPreview(window.__src,
            { method: 'standard', dithering: 'none', placement });
        const base = flat(P({})), moved = flat(P({ offsetX: 16 }));
        let shiftDiff = 0;
        for (let y = 0; y < 192; y++) {
            for (let x = 16; x < 256; x++) {
                const a = (y * 256 + x - 16) * 4, b = (y * 256 + x) * 4;
                if (base.data[a] !== moved.data[b] || base.data[a + 1] !== moved.data[b + 1]) shiftDiff++;
            }
        }
        // The uncovered strip is ZX black, like Fit's bars
        let blackStrip = true;
        for (let y = 0; y < 192; y++) {
            for (let x = 0; x < 16; x++) {
                const o = (y * 256 + x) * 4;
                if (moved.data[o] + moved.data[o + 1] + moved.data[o + 2] !== 0) blackStrip = false;
            }
        }

        const sharp = (placement) => PNGFormat.previewRenderer(window.__src, 'fit', placement)('sharp');
        const s0 = sharp(P({})), s1 = sharp(P({ flipX: true }));
        let mirrorSame = 0;
        for (let y = 0; y < 192; y++) {
            for (let x = 0; x < 256; x++) {
                const a = (y * 256 + x) * 4, b = (y * 256 + 255 - x) * 4;
                if (s0.data[a] === s1.data[b] && s0.data[a + 1] === s1.data[b + 1]) mirrorSame++;
            }
        }
        return { shiftDiff, blackStrip, mirrorShare: mirrorSame / (256 * 192) };
    });
    expect(r.shiftDiff).toBe(0);
    expect(r.blackStrip).toBe(true);
    // Ink/paper ties may break the other way in a mirrored cell; the picture itself must mirror
    expect(r.mirrorShare).toBeGreaterThan(0.95);
});

test('the controls reach the result; Stretch sets the placement aside', async ({ page }) => {
    await boot(page);
    const url = await makeImage(page, 512, 192);
    await openDialog(page, url);
    await page.waitForSelector('#import-scale');

    // Fill: a 512x192 picture fills the screen at 100%, so the scale reads 100
    await page.locator('.import-placement button[data-i18n="reference.cover"]').click();
    await expect(page.locator('#import-scale')).toHaveValue('100');

    await page.locator('#import-offset-x').fill('10');
    await page.locator('#import-offset-x').dispatchEvent('change');
    await page.locator('.import-placement button[data-i18n="reference.flipV"]').click();
    await expect(page.locator('.import-placement button[data-i18n="reference.flipV"]')).toHaveClass(/active/);

    // No reference image is loaded, so there is nothing to copy
    await expect(page.locator('.import-placement button[data-i18n="import.useReference"]')).toBeDisabled();

    const placed = await pressOk(page);
    expect(placed.scaling).toBe('fit');
    expect(placed.placement.scale).toBeCloseTo(100, 6);
    expect(placed.placement.offsetX).toBe(10);
    expect(placed.placement.flipY).toBe(true);

    await openDialog(page, url);
    await page.waitForSelector('#import-scale');
    await page.locator('.import-placement button[data-i18n="import.scalingStretch"]').click();
    await expect(page.locator('#import-scale')).toBeDisabled();
    const stretched = await pressOk(page);
    expect(stretched.scaling).toBe('stretch');
    expect(stretched.placement).toBeNull();
});

test('Use reference placement puts the import where the reference sits', async ({ page }) => {
    await boot(page);
    const url = await makeImage(page, 400, 300);
    await page.evaluate((u) => ReferenceLayerService.loadImage(u), url);
    await page.waitForFunction(() => ReferenceLayerService.hasImage());
    await page.evaluate(() => {
        ReferenceLayerService.setScale(50);
        ReferenceLayerService.setOffset(12, -6);
        ReferenceLayerService.setRotation(270);
        ReferenceLayerService.setFlip(true, false);
    });

    await openDialog(page, url);
    await page.waitForSelector('#import-scale');
    const btn = page.locator('.import-placement button[data-i18n="import.useReference"]');
    await expect(btn).toBeEnabled();
    await btn.click();
    // The service keeps 0-359; the dialog's slider is signed
    await expect(page.locator('#import-rotation')).toHaveValue('-90');
    const chosen = await pressOk(page);
    expect(chosen.placement.scale).toBeCloseTo(50, 6);
    expect(chosen.placement.offsetX).toBeCloseTo(12, 6);
    expect(chosen.placement.offsetY).toBeCloseTo(-6, 6);
    expect(chosen.placement.rotation).toBe(-90);
    expect(chosen.placement.flipX).toBe(true);
});

test('with a placement, the import draws exactly what the preview showed', async ({ page }) => {
    await boot(page);
    const url = await makeImage(page, 900, 500);
    await decode(page, url);
    const differ = await page.evaluate(async (u) => {
        const bytes = Uint8Array.from(atob(u.split(',')[1]), (c) => c.charCodeAt(0));
        const placement = { scale: 37, offsetX: -20, offsetY: 15, rotation: 25, flipX: true, flipY: false };
        const out = {};
        for (const [id, method, dithering] of [['sharp', 'detail', 'none'], ['flat', 'standard', 'none']]) {
            const preview = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit', placement })
                .find((p) => p.id === id).preview;
            await PNGFormat.parse(bytes.buffer, { method, dithering, scaling: 'fit', placement });
            LayerManager.composeToCanvas();
            const drawn = LayerManager.stillImageData();
            let n = 0;
            for (let i = 0; i < preview.data.length; i += 4) {
                if (preview.data[i] !== drawn.data[i] || preview.data[i + 1] !== drawn.data[i + 1] ||
                    preview.data[i + 2] !== drawn.data[i + 2]) n++;
            }
            out[id] = n;
        }
        return out;
    }, url);
    expect(differ).toEqual({ sharp: 0, flat: 0 });
});
