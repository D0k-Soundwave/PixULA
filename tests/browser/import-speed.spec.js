'use strict';
/**
 * Importing a big photo stays quick, and the preview is still the result.
 *
 * Found 2026-09-28: a 12 MP phone photo was carried whole into the Import
 * dialog, and every Brightness/Contrast step redid all three previews from
 * it - 1.3 to 3.7 s a step (0.3 to 0.75 s for a 1024x768 one). A photo is
 * now loaded at no more than 4x the screen in each direction, the colour
 * matching is faster (the same results, checked against the old code in
 * every mode), and a slider drag redraws only the chosen preview until it
 * rests.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** A w x h photo-like JPEG, as bytes on window.__bytes. */
const makePhoto = (page, w, h) => page.evaluate(async ({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c83'); g.addColorStop(0.5, '#38c'); g.addColorStop(1, '#fe4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsl(${i * 37 % 360},70%,${30 + i % 50}%)`;
        ctx.fillRect((i * 97) % w, (i * 53) % h, w / 20, h / 30);
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    window.__bytes = await blob.arrayBuffer();
}, { w, h });

test('a photo loads at no more than 4x the screen, and a smaller one whole', async ({ page }) => {
    await boot(page);
    const size = async (mode) => page.evaluate(async (mode) => {
        ScreenModeService.applyModeRaw(mode);
        const img = await PNGFormat.decodeToImageData(window.__bytes, 'image/jpeg');
        return `${img.width}x${img.height}`;
    }, mode);
    await makePhoto(page, 4032, 3024);
    expect(await size('standard_ula')).toBe('1024x768');
    expect(await size('layer2_640')).toBe('2560x1920');
    await makePhoto(page, 800, 600);
    expect(await size('standard_ula')).toBe('800x600');
});

test('the Sharp preview of a big photo is exactly what the import draws', async ({ page }) => {
    await boot(page);
    await makePhoto(page, 3000, 2000);
    const same = await page.evaluate(async () => {
        ScreenModeService.applyModeRaw('standard_ula');
        const img = await PNGFormat.decodeToImageData(window.__bytes, 'image/jpeg');
        const preview = PNGFormat.quantizePreviewSet(img, { scaling: 'fit' }).find((p) => p.id === 'sharp').preview;
        await PNGFormat.parse(window.__bytes, { method: 'detail', dithering: 'none', scaling: 'fit' });
        LayerManager.composeToCanvas();
        const drawn = LayerManager.stillImageData();
        let differ = 0;
        for (let i = 0; i < preview.data.length; i += 4) {
            if (preview.data[i] !== drawn.data[i] || preview.data[i + 1] !== drawn.data[i + 1] ||
                preview.data[i + 2] !== drawn.data[i + 2]) differ++;
        }
        return differ;
    });
    expect(same).toBe(0);
});

test('a slider drag redraws only the chosen preview, and the rest catch up', async ({ page }) => {
    await boot(page);
    await makePhoto(page, 4032, 3024);
    const shown = page.evaluate(() => ImportDialog.show(window.__bytes, 'jpg'));
    await page.waitForSelector('#import-brightness');
    const hashes = () => page.evaluate(() => [...document.querySelectorAll('.import-method canvas')].map((c) =>
        c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((h, v) => (h * 31 + v) | 0, 7)));
    await expect.poll(async () => new Set(await hashes()).size).toBe(3);
    const before = await hashes();

    const r = await page.evaluate(async () => {
        // Count the previews rendered, per frame of the drag
        const real = PNGFormat._quantizePrepared;
        let rendered = 0;
        PNGFormat._quantizePrepared = function (...a) { rendered++; return real.apply(this, a); };
        const range = document.getElementById('import-brightness');
        const perFrame = [];
        for (let v = 10; v <= 50; v += 10) {
            rendered = 0;
            range.value = String(v);
            range.dispatchEvent(new Event('input'));
            await new Promise((r) => requestAnimationFrame(() => r()));
            await new Promise((r) => setTimeout(r, 0));
            perFrame.push(rendered);
        }
        rendered = 0;
        await new Promise((r) => setTimeout(r, 400)); // rest
        const afterRest = rendered;
        PNGFormat._quantizePrepared = real;
        return { perFrame, afterRest };
    });
    // One preview a frame while dragging (three before), the other two once
    expect(r.perFrame).toEqual([1, 1, 1, 1, 1]);
    expect(r.afterRest).toBe(2);

    // After the drag rests, all three show the new brightness
    await expect.poll(async () => {
        const now = await hashes();
        return now.filter((h, i) => h !== before[i]).length;
    }).toBe(3);

    await page.locator('#dialog-import-conversion .app-dialog-footer button:not(.primary)').click();
    expect(await shown).toBeNull();
});

test('the faster colour matchers choose exactly what the plain versions did', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        let s = 99;
        const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const cell = (n) => {
            const c = new Float32Array(n * 3);
            const base = [rnd() * 255, rnd() * 255, rnd() * 255];
            for (let i = 0; i < c.length; i++) c[i] = Math.round(Math.min(255, Math.max(0, base[i % 3] + (rnd() - 0.5) * 160)));
            return c;
        };
        const d2 = (r, g, b, p) => { const dr = r - p[0], dg = g - p[1], db = b - p[2]; return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114; };
        const e2 = (r, g, b, p) => (r - p[0]) * (r - p[0]) + (g - p[1]) * (g - p[1]) + (b - p[2]) * (b - p[2]);
        const nearestIn = (dist, r, g, b, list) => {
            let best = 0, bd = Infinity;
            list.forEach((p, i) => { const d = dist(r, g, b, p); if (d < bd) { bd = d; best = i; } });
            return best;
        };
        // The plain versions, as they were before 2026-09-28
        const plainPair = (c) => {
            let best = null;
            for (const bright of [false, true]) {
                const base = bright ? 8 : 0, bank = ZX_PALETTE_RGB.slice(base, base + 8);
                const counts = new Array(8).fill(0);
                for (let i = 0; i < c.length / 3; i++) counts[nearestIn(d2, c[i * 3], c[i * 3 + 1], c[i * 3 + 2], bank)]++;
                const sorted = counts.map((count, index) => ({ count, index })).sort((a, b) => b.count - a.count);
                const paper = base + sorted[0].index, ink = sorted[1].count > 0 ? base + sorted[1].index : paper;
                let err = 0;
                for (let i = 0; i < c.length / 3; i++) {
                    err += Math.min(d2(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], ZX_PALETTE_RGB[ink]),
                        d2(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], ZX_PALETTE_RGB[paper]));
                }
                if (!best || err < best.err) best = { ink, paper, bright, err };
            }
            return `${best.ink},${best.paper},${best.bright}`;
        };
        const plainUlaplus = (c, pal) => {
            let best = null;
            for (let clut = 0; clut < 4; clut++) {
                const ink = pal.slice(clut * 16, clut * 16 + 8), paper = pal.slice(clut * 16 + 8, clut * 16 + 16);
                const ic = new Array(8).fill(0), pc = new Array(8).fill(0);
                for (let i = 0; i < c.length / 3; i++) {
                    ic[nearestIn(e2, c[i * 3], c[i * 3 + 1], c[i * 3 + 2], ink)]++;
                    pc[nearestIn(e2, c[i * 3], c[i * 3 + 1], c[i * 3 + 2], paper)]++;
                }
                const argmax = (a) => a.reduce((m, v, i) => (v > a[m] ? i : m), 0);
                const is = argmax(ic), ps = argmax(pc);
                let err = 0;
                for (let i = 0; i < c.length / 3; i++) {
                    err += Math.min(e2(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], ink[is]), e2(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], paper[ps]));
                }
                if (!best || err < best.err) best = { clut, is, ps, err };
            }
            return `${best.clut},${best.is},${best.ps}`;
        };
        const pal = Array.from({ length: 64 }, () => [rnd() * 255 | 0, rnd() * 255 | 0, rnd() * 255 | 0]);
        let pairDiff = 0, ulaDiff = 0;
        for (let t = 0; t < 400; t++) {
            const c = cell(64 * (1 + (t % 4)));
            const fast = PNGFormat._chooseCellPair(c);
            if (`${fast.ink},${fast.paper},${fast.bright}` !== plainPair(c)) pairDiff++;
            const u = PaletteOps.chooseUlaplusCellPair(c, pal);
            if (`${u.clut},${u.inkSlot},${u.paperSlot}` !== plainUlaplus(c, pal)) ulaDiff++;
        }
        return { pairDiff, ulaDiff };
    });
    expect(r).toEqual({ pairDiff: 0, ulaDiff: 0 });
});
