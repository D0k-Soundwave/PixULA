'use strict';
/**
 * Zoom to Fit keeps the picture clear of the colour rail. The rail floats
 * over the left edge of the canvas frame (css/layout.css #color-rail), so a
 * fit sized to the whole frame put Timex hi-res's left columns under it,
 * where no draw tool could reach them (audit 2026-10-18, S2A-8).
 *
 * Measured in the default 1600x900 window (playwright.config.js).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/**
 * Canvas and rail rectangles, and what a click at 1% across and 10% down the
 * picture hits. 10% down keeps the probe off the rail's collapse tab, which
 * pokes 32 px into the frame at mid-height (clearing it too would cost Timex
 * hi-res a whole zoom level at this window size: 200% -> 100%).
 */
function measure(page) {
    return page.evaluate(() => {
        const frame = document.getElementById('canvas-frame');
        const fr = frame.getBoundingClientRect();
        const canvas = frame.contentDocument.getElementById('main-canvas');
        const cr = canvas.getBoundingClientRect();
        const rail = document.getElementById('color-rail').getBoundingClientRect();
        const ratio = fr.width / frame.clientWidth;
        const left = fr.left + cr.left * ratio;
        const width = cr.width * ratio;
        const hit = document.elementFromPoint(left + width * 0.01, fr.top + (cr.top + cr.height * 0.1) * ratio);
        return { left, right: left + width, frameRight: fr.right, railRight: rail.right,
            zoom: CanvasSystem.zoom, hit: hit ? hit.id : null };
    });
}

for (const mode of ['timex_hires', 'standard_ula', 'layer2_640']) {
    test(`Zoom to Fit in ${mode} leaves the picture clear of the expanded colour rail`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        await selectMode(page, mode);
        await page.evaluate(() => {
            if (ColorRailToggle.isCollapsed()) ColorRailToggle.setCollapsed(false);
            CanvasSystem.zoomToFit();
        });
        await page.waitForTimeout(150);
        const m = await measure(page);
        expect(m.left, `${mode}: the picture starts right of the rail`).toBeGreaterThanOrEqual(m.railRight - 0.5);
        expect(m.right, `${mode}: and ends inside the frame`).toBeLessThanOrEqual(m.frameRight + 0.5);
        expect(m.hit, `${mode}: a click at the picture's left edge reaches the canvas`).toBe('canvas-frame');
    });
}

test('collapsing the rail while following Fit re-fits to the room it frees', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'timex_hires');
    await page.evaluate(() => {
        if (ColorRailToggle.isCollapsed()) ColorRailToggle.setCollapsed(false);
        CanvasSystem.zoomToFit();
    });
    await page.waitForTimeout(150);
    const expanded = await measure(page);
    await page.evaluate(() => ColorRailToggle.setCollapsed(true));
    await page.waitForTimeout(150);
    const collapsed = await measure(page);
    expect(collapsed.zoom, 'the freed room is used').toBeGreaterThanOrEqual(expanded.zoom);
    expect(collapsed.hit).toBe('canvas-frame');
    await page.evaluate(() => ColorRailToggle.setCollapsed(false));
    await page.waitForTimeout(150);
    const back = await measure(page);
    expect(back.zoom, 'expanding again re-fits clear of the rail').toBe(expanded.zoom);
    expect(back.left).toBeGreaterThanOrEqual(back.railRight - 0.5);
});
