'use strict';
/**
 * Windows High Contrast (forced colours) keeps the palette and the on states.
 *
 * Found 2026-09-27: the system's forced colours replaced every background,
 * so all the palette swatches and the Ink/Paper wells turned white, and the
 * active tool looked like every other tool.
 */
const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./helpers');

test('forced colours: swatches keep their colours, the active tool stands out', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]');

    const r = await page.evaluate(() => {
        const bg = (el) => getComputedStyle(el).backgroundColor;
        const swatches = [...document.querySelectorAll('#color-rail .color-swatch')].slice(0, 8).map(bg);
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
