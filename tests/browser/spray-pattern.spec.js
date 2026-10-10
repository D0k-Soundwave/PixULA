'use strict';
/**
 * Batch 7 part 7C2 in a real browser: the Spray brush's Pattern distribution lays whole little figures. The geometry is
 * pinned in Node (tests/spray-pattern.test.js); this checks the options and that a stamp draws through the real brush.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const setSelect = (page, id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, value]);

test('Pattern shows the figure, its size and Filled; the other sub-modes hide them', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="spray"]');
    for (const id of ['opt-patternShape', 'opt-patternSize', 'opt-patternFilled']) {
        expect(await page.locator('#' + id).isVisible(), id + ' hidden at first').toBe(false);
    }
    await setSelect(page, 'opt-distribution', 'pattern');
    expect(await page.locator('#opt-patternShape').isVisible()).toBe(true);
    expect(await page.locator('#opt-patternSize').isVisible()).toBe(true);
    expect(await page.locator('#opt-patternFilled').isVisible()).toBe(true);
    expect(await page.locator('#opt-weighting').isVisible()).toBe(false);
    await setSelect(page, 'opt-patternShape', 'line');
    expect(await page.locator('#opt-patternFilled').isVisible(), 'a line has no inside').toBe(false);
});

test('a Pattern stamp draws whole figures inside the spray area', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="spray"]');
    await setSelect(page, 'opt-distribution', 'pattern');
    await setSelect(page, 'opt-patternShape', 'square');
    const res = await page.evaluate(() => {
        const tool = ToolManager.getCurrentTool();
        tool.setSize(24);
        tool.setFlowRate(1);
        tool.setPatternSize(3);
        tool.setPatternFilled(true);
        const brush = BrushEngine.brushes.get('spray');
        PixelDrawRoutine.beginBatch('t');
        brush.apply(128, 96, 24, 1, ColorManager.getCurrentSelection(), {});
        PixelDrawRoutine.endBatch();
        const layer = LayerManager.getCurrentLayer();
        let n = 0, far = 0;
        for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) {
            const c = layer.getCell(x >> 3, y >> 3);
            if (c && c.altered && ((c.pixels[y & 7] >> (7 - (x & 7))) & 1)) {
                n++;
                if ((x - 128) ** 2 + (y - 96) ** 2 > 12 * 12) far++;
            }
        }
        return { n, far };
    });
    expect(res.n, 'dots were laid').toBeGreaterThan(8);
    expect(res.far, 'none outside the disc').toBe(0);
});
