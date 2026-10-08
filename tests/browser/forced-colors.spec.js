'use strict';
/**
 * Windows High Contrast (forced colours) keeps the palette and the on states.
 *
 * Found 2026-09-27: the system's forced colours replaced every background,
 * so all the palette swatches and the Ink/Paper wells turned white, and the
 * active tool looked like every other tool.
 *
 * Found 2026-09-28 (review of the first fix): opting out of forced colours is
 * inherited, so setting it on the open menu, the current layer row and the
 * canvas area took the system colours away from everything inside them.
 */
const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./helpers');

test('forced colours: swatches keep their colours, the active tool stands out', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]');

    const r = await page.evaluate(() => {
        const bg = (el) => getComputedStyle(el).backgroundColor;
        // The ink row by role: the rail also holds checkered "use existing"
        // boxes, which are swatch-shaped but carry no colour of their own.
        const swatches = [...document.querySelectorAll('#color-rail .color-swatch[data-role="ink"]')].slice(0, 8).map(bg);
        const tool = document.querySelector('.tool-btn.active');
        const other = document.querySelector('.tool-btn[data-tool]:not(.active)');
        return {
            forced: matchMedia('(forced-colors: active)').matches,
            distinctSwatches: new Set(swatches).size,
            inkWell: bg(document.getElementById('ink-color')),
            paperWell: bg(document.getElementById('paper-color')),
            activeTool: bg(tool),
            otherTool: bg(other)
        };
    });
    expect(r.forced).toBe(true);
    expect(r.distinctSwatches).toBe(8);
    // Black ink on white paper, the defaults
    expect(r.inkWell).toBe('rgb(0, 0, 0)');
    expect(r.paperWell).not.toBe(r.inkWell);
    expect(r.activeTool).not.toBe(r.otherTool);
});

test('forced colours stay on inside the open menu, the current layer and the colour rail', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]');
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.evaluate(() => {
        // A border colour chosen: the canvas area keeps the picture's colour
        document.getElementById('canvas-area').classList.add('border-preview');
    });

    const r = await page.evaluate(() => {
        const adjust = (el) => getComputedStyle(el).forcedColorAdjust;
        const label = document.querySelector('.menu-item.active > .menu-label');
        const row = document.querySelector('.layer-item.current');
        const tool = document.querySelector('.tool-btn.active');
        const icon = tool.querySelector('svg');
        return {
            menuRow: adjust(document.querySelector('.menu-item.active .menu-action')),
            menuLabelMarked: getComputedStyle(label).backgroundColor !== getComputedStyle(document.body).backgroundColor,
            // Its text is drawn as written, not over a forced plain backing
            menuLabelText: getComputedStyle(label).forcedColorAdjust === 'none' &&
                getComputedStyle(label).color !== getComputedStyle(label).backgroundColor,
            layerRow: adjust(row),
            layerName: adjust(row.querySelector('.layer-name') || row),
            layerRowOutline: getComputedStyle(row).outlineStyle,
            colorRail: adjust(document.getElementById('color-rail')),
            canvasArea: adjust(document.getElementById('canvas-area')),
            // The active tool's icon draws in the highlight text colour
            iconMatchesButton: !icon || getComputedStyle(icon).color === getComputedStyle(tool).color
        };
    });
    expect(r).toEqual({
        menuRow: 'auto', menuLabelMarked: true, menuLabelText: true,
        layerRow: 'auto', layerName: 'auto', layerRowOutline: 'solid',
        colorRail: 'auto', canvasArea: 'none',
        iconMatchesButton: true
    });
});
