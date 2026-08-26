'use strict';
/**
 * ColorRailToggle (js/ui/components/colorrail-toggle.js) — the folder-style
 * tab that collapses the vertical colour rail into the left toolbar and
 * expands it back out. The rail is a floating overlay on top of the canvas
 * (css/layout.css, css/components.css .rail-collapse-tab), not a grid
 * column — collapsing/expanding slides it with a transform rather than
 * resizing it, so its own bounding box stays a fixed width in both states;
 * these specs check its POSITION and #color-rail-content's visibility,
 * never its width.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

/** What's actually on top at the rail's own position: the rail while
 *  expanded, the canvas underneath once it's collapsed out of the way. */
function topElementAtRailCenter() {
    const rail = document.getElementById('color-rail');
    const r = rail.getBoundingClientRect();
    // Sample where the rail sits when EXPANDED (its resting position before
    // any collapse transform), since that is the point collapsing must free.
    const toolbar = document.getElementById('toolbar').getBoundingClientRect();
    const x = toolbar.right + 20;
    const y = r.top + 40;
    const el = document.elementFromPoint(x, y);
    return {
        insideRail: !!(el && el.closest('#color-rail')),
        insideCanvas: !!(el && el.closest('#canvas-viewport'))
    };
}

test('the colour rail starts expanded, drawn over the canvas, with the tab pointing to collapse it', async ({ page }) => {
    await boot(page);

    const tab = page.locator('#color-rail-toggle');
    await expect(page.locator('#color-rail')).toBeVisible();
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
    const contentDisplay = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-rail-content')).display);
    expect(contentDisplay).not.toBe('none');
    const top = await page.evaluate(topElementAtRailCenter);
    expect(top.insideRail).toBe(true);
});

test('clicking the tab collapses the rail out of the way and reveals the canvas underneath', async ({ page }) => {
    await boot(page);

    const before = await page.evaluate(topElementAtRailCenter);
    expect(before.insideRail).toBe(true);
    expect(before.insideCanvas).toBe(false);

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);

    const after = await page.evaluate(topElementAtRailCenter);
    expect(after.insideRail).toBe(false);
    expect(after.insideCanvas).toBe(true);

    const contentDisplay = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-rail-content')).display);
    expect(contentDisplay).toBe('none');
    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');

    // #panels never moves because of this — it is not part of the same
    // grid track as the rail (the rail floats, it does not consume a
    // column), which is the whole point of the floating design.
    const panelsLeft = await page.evaluate(() =>
        document.getElementById('panels').getBoundingClientRect().left);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(panelsLeft).toBeLessThan(viewportWidth);
});

test('the tab stays visible and clickable in both states', async ({ page }) => {
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

    // Clicking it again brings the rail straight back over the canvas.
    await tab.click();
    await page.waitForTimeout(150);
    const top = await page.evaluate(topElementAtRailCenter);
    expect(top.insideRail).toBe(true);
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
});

test('the collapsed state survives a reload', async ({ page }) => {
    await boot(page);
    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');

    await reload(page);

    await expect(page.locator('#color-rail-toggle')).toHaveAttribute('aria-expanded', 'false');
    const contentDisplay = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-rail-content')).display);
    expect(contentDisplay).toBe('none');
    const top = await page.evaluate(topElementAtRailCenter);
    expect(top.insideCanvas).toBe(true);
});

test('collapsing works the same in a 256-colour indexed mode, without breaking the dense grid underneath', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    let top = await page.evaluate(topElementAtRailCenter);
    expect(top.insideCanvas).toBe(true);

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    top = await page.evaluate(topElementAtRailCenter);
    expect(top.insideRail).toBe(true);

    const swatchWidth = await page.evaluate(() =>
        document.querySelector('#indexed-palette-grid .color-swatch').getBoundingClientRect().width);
    expect(swatchWidth).toBe(27); // the dense grid rebuilt correctly, unaffected by the collapse cycle
});

/*
 * The tab is deliberately positioned to start exactly at the rail's own
 * right edge and extend only rightward (css/components.css: left: 100% of
 * #color-rail) rather than centred across the boundary with half its bulk
 * overlapping backward — an earlier version did that and could cover the
 * rail's own swatches when expanded, or a tool-rail button when collapsed
 * (the boundary then coincides with the toolbar's edge, since collapsing
 * slides the whole rail there). Pins that guarantee with real bounding-box
 * checks against every icon-bearing region it sits next to, in both states.
 */
test('the tab never overlaps the toolbar, the colour rail, or the top colour-bar strip', async ({ page }) => {
    await boot(page);

    async function overlapReport() {
        return page.evaluate(() => {
            const tab = document.getElementById('color-rail-toggle').getBoundingClientRect();
            // 1px tolerance: left: 100% and the parent's own width are each
            // computed independently under `zoom`, so two boxes that are
            // mathematically meant to touch exactly can land a fractional
            // pixel apart — the same sub-pixel rounding tolerated elsewhere
            // in this suite at fractional --ui-scale values, not a real gap
            // or a real overlap either way.
            const EPS = 1;
            const overlaps = (b) => !(tab.right <= b.left + EPS || tab.left >= b.right - EPS ||
                tab.bottom <= b.top + EPS || tab.top >= b.bottom - EPS);
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

/*
 * The whole point of making the rail an overlay rather than a grid column:
 * #panels must never move or lose width because of the rail, at any window
 * size, expanded or collapsed. A fixed rail column previously reserved
 * width out of a fixed budget (toolbar + rail + panels) that the canvas's
 * 1fr track could not always give back, which on a narrow-enough window
 * pushed #panels off the right edge of the viewport entirely.
 */
test('the right-hand panels never move because of the colour rail, expanded or collapsed', async ({ page }) => {
    await boot(page);

    const positions = {};
    positions.expanded = await page.evaluate(() =>
        document.getElementById('panels').getBoundingClientRect().left);

    await page.click('#color-rail-toggle');
    await page.waitForTimeout(150);
    positions.collapsed = await page.evaluate(() =>
        document.getElementById('panels').getBoundingClientRect().left);

    expect(positions.collapsed).toBe(positions.expanded);
});
