'use strict';
/**
 * ColorRailToggle (js/ui/components/colorrail-toggle.js) — the folder-style
 * tab that collapses the vertical colour rail into the left toolbar and
 * expands it back out. See css/layout.css for the grid mechanics and
 * css/components.css (.rail-collapse-tab) for the tab itself.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('the colour rail starts expanded, with the tab pointing to collapse it', async ({ page }) => {
    await boot(page);

    const rail = page.locator('#color-rail');
    const tab = page.locator('#color-rail-toggle');
    await expect(rail).toBeVisible();
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
    expect(await rail.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(100);
});

test('clicking the tab collapses the rail into the toolbar and gives the canvas the space back', async ({ page }) => {
    await boot(page);

    const before = await page.evaluate(() => ({
        railWidth: document.getElementById('color-rail').getBoundingClientRect().width,
        canvasLeft: document.getElementById('canvas-area').getBoundingClientRect().left
    }));

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        const content = document.getElementById('color-rail-content');
        return {
            railWidth: rail.getBoundingClientRect().width,
            canvasLeft: document.getElementById('canvas-area').getBoundingClientRect().left,
            contentHidden: getComputedStyle(content).display === 'none'
        };
    });

    expect(after.railWidth).toBeLessThan(before.railWidth);
    expect(after.railWidth).toBeLessThan(5); // collapses to (effectively) zero
    expect(after.contentHidden).toBe(true);
    // The canvas column reclaims the width the rail gave up.
    expect(before.canvasLeft - after.canvasLeft).toBeGreaterThan(before.railWidth - 10);
    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('the tab stays visible and clickable in both states, straddling the boundary it controls', async ({ page }) => {
    await boot(page);
    const tab = page.locator('#color-rail-toggle');

    await expect(tab).toBeVisible();
    const expandedBox = await tab.boundingBox();
    expect(expandedBox.width).toBeGreaterThan(0);

    await tab.click();
    await page.waitForTimeout(150);
    await expect(tab).toBeVisible();
    const collapsedBox = await tab.boundingBox();
    expect(collapsedBox.width).toBeGreaterThan(0);

    // Clicking it again (still visible, still in the same place relative to
    // the toolbar) must bring the rail straight back.
    await tab.click();
    await page.waitForTimeout(150);
    const railWidth = await page.evaluate(() =>
        document.getElementById('color-rail').getBoundingClientRect().width);
    expect(railWidth).toBeGreaterThan(100);
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
});

test('the collapsed state survives a reload', async ({ page }) => {
    await boot(page);
    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');

    await reload(page);

    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');
    const railWidth = await page.evaluate(() =>
        document.getElementById('color-rail').getBoundingClientRect().width);
    expect(railWidth).toBeLessThan(5);
});

test('collapsing works the same in a 256-colour indexed mode, without breaking the dense grid underneath', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    let railWidth = await page.evaluate(() =>
        document.getElementById('color-rail').getBoundingClientRect().width);
    expect(railWidth).toBeLessThan(5);

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    railWidth = await page.evaluate(() =>
        document.getElementById('color-rail').getBoundingClientRect().width);
    expect(railWidth).toBeGreaterThan(100);

    const swatchWidth = await page.evaluate(() =>
        document.querySelector('#indexed-palette-grid .color-swatch').getBoundingClientRect().width);
    expect(swatchWidth).toBe(27); // the dense grid rebuilt correctly, unaffected by the collapse cycle
});

/*
 * The tab is deliberately positioned to start exactly at the colorrail/canvas
 * boundary and extend only rightward (css/components.css: left: 100% of a
 * host scoped to the canvas row, css/layout.css) rather than centred across
 * the boundary with half its bulk overlapping backward — an earlier version
 * did that and could cover the rail's own swatches when expanded, or a
 * tool-rail button when collapsed (the boundary then coincides with the
 * toolbar's edge). Pins that guarantee with real bounding-box checks against
 * every icon-bearing region it sits next to, in both states.
 */
test('the tab never overlaps the toolbar, the colour rail, or the top colour-bar strip', async ({ page }) => {
    await boot(page);

    async function overlapReport() {
        return page.evaluate(() => {
            const tab = document.getElementById('color-rail-toggle').getBoundingClientRect();
            const overlaps = (b) => !(tab.right <= b.left || tab.left >= b.right ||
                tab.bottom <= b.top || tab.top >= b.bottom);
            return {
                toolbar: overlaps(document.getElementById('toolbar').getBoundingClientRect()),
                rail: overlaps(document.getElementById('color-rail').getBoundingClientRect()),
                colorbar: overlaps(document.getElementById('color-bar').getBoundingClientRect())
            };
        });
    }

    const expanded = await overlapReport();
    expect(expanded).toEqual({ toolbar: false, rail: false, colorbar: false });

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);

    const collapsed = await overlapReport();
    expect(collapsed).toEqual({ toolbar: false, rail: false, colorbar: false });
});
