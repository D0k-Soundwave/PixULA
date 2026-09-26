'use strict';
/**
 * Four-colour photo import in the two-screen modes, through the real app
 * (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** A colourful ramp as a PNG data URL: blends are the only way to show it. */
const makeImage = (page) => page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 384;
    const ctx = c.getContext('2d');
    const d = ctx.createImageData(512, 384);
    for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            d.data[i] = (x / 512) * 255;
            d.data[i + 1] = (y / 384) * 200;
            d.data[i + 2] = 255 - (x / 512) * 200;
            d.data[i + 3] = 255;
        }
    }
    ctx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
});

const loadSource = (page, url) => page.evaluate(async (dataUrl) => {
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0));
    window.__buf = bytes.buffer;
    window.__src = await PNGFormat.decodeToImageData(bytes.buffer, 'image/png');
}, url);

for (const mode of ['gigascreen', 'multigiga_8x4', 'multigiga_8x1', 'timex_hires_giga']) {
    test(`${mode}: previews mix colours and the import writes two different screens`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        await selectMode(page, mode);
        await page.waitForTimeout(200);
        await loadSource(page, await makeImage(page));

        const r = await page.evaluate(() => {
            const set = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit' });
            const by = (id) => set.find((s) => s.id === id).preview;
            const palette = new Set(ZX_PALETTE_RGB.map((c) => Array.from(c).join()));
            const mixed = (p) => {
                for (let i = 0; i < p.data.length; i += 4) {
                    if (!palette.has(`${p.data[i]},${p.data[i + 1]},${p.data[i + 2]}`)) return true;
                }
                return false;
            };
            const same = (a, b) => a.data.every((v, i) => v === b.data[i]);
            return {
                // Review Focus 3: every method, Sharp included, yields a mixed preview
                mixed: set.every((s) => mixed(s.preview)),
                smoothDiffers: !same(by('smooth'), by('flat'))
            };
        });
        expect(r.mixed, 'every preview uses mixed colours').toBe(true);
        expect(r.smoothDiffers, 'Smooth differs from Flat').toBe(true);

        // White-on-black schemes before the import, which a colourful ramp
        // will not choose, so the undo check below is not vacuous
        const before = await page.evaluate(() => {
            ColorManager.setTimexHiresInk(7);
            ColorManager.setTimexHiresInkB(7);
            return [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()];
        });
        const w = await page.evaluate(async () => {
            const res = await PNGFormat.parse(window.__buf, { method: 'standard', dithering: 'none' });
            let differ = false;
            const layer = LayerManager.getCurrentLayer();
            for (const row of layer.attributeData) {
                for (const c of row) {
                    if (c.inkB !== c.ink || c.pixelsB.some((v, i) => v !== c.pixels[i])) differ = true;
                }
            }
            return { ok: res.success, differ,
                schemes: [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()] };
        });
        expect(w.ok).toBe(true);
        expect(w.differ, 'the two screens differ').toBe(true);

        if (mode === 'timex_hires_giga') {
            expect(w.schemes, 'the import chose its own schemes').not.toEqual(before);
            // Review Focus 4: one undo restores the picture AND both schemes
            await page.evaluate(() => UndoRedo.undo());
            expect(await page.evaluate(() =>
                [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()]),
                'undo restores both schemes').toEqual(before);
        }
    });
}
