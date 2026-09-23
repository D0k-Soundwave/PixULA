'use strict';
/**
 * GigaScreen as one surface (2026-09-23). Every cell holds both screens, a
 * stroke paints one of the cell's four blends onto both, and Average /
 * Flicker / A / B only choose what the canvas shows.
 *
 * The first three specs pin what was broken before, each measured on the old
 * tag model: pressing "B" and drawing left the mark on screen A where the
 * canvas could not show it (paper, [215,215,215]); entering the mode turned a
 * black line into [107,107,107]; and no stroke could ever produce a solid
 * colour. Everything here draws with the real pointer over the canvas.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

/** One brush click at app pixel (px, py). */
async function dab(page, px, py) {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
}

/** What the canvas shows at (x, y), after the render pipeline has run. */
async function shown(page, x, y) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(([px, py]) => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const ctx = doc.getElementById('main-canvas').getContext('2d');
        return Array.from(ctx.getImageData(px, py, 1, 1).data.slice(0, 3));
    }, [x, y]);
}

const PAPER_WHITE = [215, 215, 215];

test('entering GigaScreen leaves the picture exactly as it was', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await dab(page, 60, 60);
    const before = await shown(page, 60, 60);
    expect(before).not.toEqual(PAPER_WHITE);

    await selectMode(page, 'gigascreen'); // entering is lossless, so no confirm
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe('gigascreen');
    expect(await shown(page, 60, 60)).toEqual(before);
});

test('choosing the A or B display never stops a stroke from showing', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await page.waitForTimeout(200);
    await page.keyboard.press('b');

    // The reported bug: press B, draw, and nothing appeared.
    for (const [view, x] of [['b', 40], ['a', 80], ['average', 120], ['flicker', 160]]) {
        await page.click(`#giga-view-row [data-giga-view="${view}"]`);
        await dab(page, x, 100);
        await page.click('#giga-view-row [data-giga-view="average"]');
        expect(await shown(page, x, 100), `drawn while showing ${view}`).not.toEqual(PAPER_WHITE);
    }
});

test('each Paint swatch paints its own blend, and the swatch shows the canvas colour', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await page.waitForTimeout(200);
    await page.keyboard.press('b');

    // Screen A: red ink on white. Screen B: blue ink on yellow.
    await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="2"]');
    await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="1"]');
    await page.click('#clut-cluster .color-swatch[data-role="paperB"][data-base="6"]');

    const blends = await page.evaluate(() => ColorManager.getGigaSlotRGB().map(c => Array.from(c)));
    // Four different colours: the point of GigaScreen
    expect(new Set(blends.map(String)).size).toBe(4);

    for (let slot = 0; slot < 4; slot++) {
        const swatch = page.locator(`#giga-slot-picker [data-slot="${slot}"]`);
        await swatch.click();
        await expect(swatch).toHaveAttribute('aria-checked', 'true');
        const x = 20 + slot * 48;
        await dab(page, x, 140);
        expect(await shown(page, x, 140), `slot ${slot} on the canvas`).toEqual(blends[slot]);
        const swatchRGB = await swatch.evaluate(el =>
            getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
        expect(swatchRGB, `slot ${slot} swatch`).toEqual(blends[slot]);
    }
});

test('the same ink on both screens paints a solid colour', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await page.waitForTimeout(200);
    await page.keyboard.press('b');
    await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="0"]');
    await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="0"]');
    await page.click('#giga-slot-picker [data-slot="3"]');
    await dab(page, 100, 100);
    expect(await shown(page, 100, 100)).toEqual([0, 0, 0]);
});

test('the eyedropper picks both screens and the blend under the pointer', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await page.waitForTimeout(200);
    await page.keyboard.press('b');
    await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="2"]');
    await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="4"]');
    await page.click('#giga-slot-picker [data-slot="2"]');
    await dab(page, 100, 100);

    // Change everything, then pick it back off the canvas
    await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="5"]');
    await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="3"]');
    await page.click('#giga-slot-picker [data-slot="0"]');
    await page.evaluate(() => ToolManager.selectTool('eyedropper'));
    await dab(page, 100, 100);

    const picked = await page.evaluate(() => ({
        ink: ColorManager.getInk(), inkB: ColorManager.getScreenB().ink, slot: ColorManager.getGigaSlot()
    }));
    expect(picked).toEqual({ ink: 2, inkB: 4, slot: 2 });
});

test('Flicker alternates the two screens, exports a still Average, and stops when the mode changes', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await page.waitForTimeout(200);
    await page.keyboard.press('b');
    await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="2"]');
    await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="1"]');
    await page.click('#giga-slot-picker [data-slot="3"]');
    await dab(page, 100, 100);
    const average = await shown(page, 100, 100);

    await page.click('#giga-view-row [data-giga-view="flicker"]');
    const seen = await page.evaluate(async () => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const ctx = doc.getElementById('main-canvas').getContext('2d');
        const out = new Set();
        for (let i = 0; i < 12; i++) {
            await new Promise(r => requestAnimationFrame(r));
            out.add(Array.from(ctx.getImageData(100, 100, 1, 1).data.slice(0, 3)).join(','));
        }
        return [...out];
    });
    // Screen A's red and screen B's blue, never the average
    expect(seen.sort()).toEqual(['0,0,215', '215,0,0']);

    const still = await page.evaluate(() =>
        Array.from(LayerManager.stillImageData().data.slice((100 * 256 + 100) * 4, (100 * 256 + 100) * 4 + 3)));
    expect(still).toEqual(average);

    page.on('dialog', (d) => d.accept()); // screen B differs, so leaving warns
    await selectMode(page, 'standard_ula');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => LayerManager._gigaFlickerId)).toBeNull();
});

/*
 * The other flicker pairs (2026-09-23) reuse the same surface. The rail must
 * offer Paint in each, and each Paint swatch must paint the colour it shows.
 */
for (const mode of ['multigiga_8x4', 'multigiga_8x2', 'multigiga_8x1']) {
    test(`${mode}: each Paint swatch paints its own blend`, async ({ page }) => {
        await boot(page);
        await selectMode(page, mode); // entering from Standard ULA refines, so no confirm
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe(mode);
        await page.keyboard.press('b');
        await page.click('#clut-cluster .color-swatch[data-role="ink"][data-base="2"]');
        await page.click('#clut-cluster .color-swatch[data-role="inkB"][data-base="1"]');
        await page.click('#clut-cluster .color-swatch[data-role="paperB"][data-base="6"]');
        const blends = await page.evaluate(() => ColorManager.getGigaSlotRGB().map(c => Array.from(c)));
        for (let slot = 0; slot < 4; slot++) {
            await page.click(`#giga-slot-picker [data-slot="${slot}"]`);
            const x = 20 + slot * 48;
            await dab(page, x, 140);
            expect(await shown(page, x, 140), `slot ${slot}`).toEqual(blends[slot]);
        }
    });
}

test('hi-res pair: two schemes, four Paint colours, each painted as shown', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept()); // colour -> mono conversion warns
    await selectMode(page, 'timex_hires_giga');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe('timex_hires_giga');

    // A scheme row per screen, and Paint above them
    await expect(page.locator('#hires-scheme-row')).toBeVisible();
    await expect(page.locator('#hires-scheme-row-b')).toBeVisible();
    await page.click('#hires-scheme-row [data-scheme="2"]');
    await page.click('#hires-scheme-row-b [data-scheme="4"]');
    expect(await page.evaluate(() =>
        [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()])).toEqual([2, 4]);

    await page.keyboard.press('b');
    const blends = await page.evaluate(() => ColorManager.getGigaSlotRGB().map(c => Array.from(c)));
    expect(new Set(blends.map(String)).size).toBe(4);
    for (let slot = 0; slot < 4; slot++) {
        const swatch = page.locator(`#giga-slot-picker [data-slot="${slot}"]`);
        await swatch.click();
        // The 512-wide canvas is zoomed wider than the viewport and its left
        // edge sits under the tool rail, so the marks go in its middle - a
        // dab at x = 40 clicked the eyedropper button instead.
        const x = 240 + slot * 24;
        await dab(page, x, 100);
        expect(await shown(page, x, 100), `slot ${slot} on the canvas`).toEqual(blends[slot]);
        const swatchRGB = await swatch.evaluate(el =>
            getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
        expect(swatchRGB, `slot ${slot} swatch`).toEqual(blends[slot]);
    }
});
