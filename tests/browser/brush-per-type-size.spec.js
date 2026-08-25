'use strict';
/**
 * Reported 2026-08-25: "setting the spray brush default size to 4 also
 * affected the normal brush default size." Every brush type (round/square,
 * spray, pattern, hatch, fade) rode on ONE BrushEngine.currentSize field, so
 * dragging the size slider under any one of them moved it for all the others
 * too. See js/tools/brush-engine.js (BrushEngine#setBrush/#setSize, the
 * per-family _sizeByFamily map) and tests/brush-variants.test.js /
 * tests/tool-presets.test.js for the Node-level coverage of the mechanism.
 * This spec drives the real size slider in the real app and proves the fix
 * end to end: dragging it under Spray must not move what the plain Brush
 * shows, and switching back to Spray must still show what was set.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Drive the real options-panel slider, exactly as a user dragging it would. */
async function setSizeSlider(page, value) {
    const slider = page.locator('#opt-size');
    await slider.evaluate((el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

test('sizing the spray brush does not move the plain brush\'s size, and vice versa', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => ToolManager.selectTool(TOOLS.BRUSH));
    const brushDefault = await page.evaluate(() => BrushEngine.currentSize);

    await page.evaluate(() => ToolManager.selectTool(TOOLS.SPRAY));
    const sprayDefault = await page.evaluate(() => BrushEngine.currentSize);
    expect(sprayDefault, 'spray starts at its own floor, not whatever Brush was on').toBe(4);

    await setSizeSlider(page, 22);
    expect(await page.evaluate(() => BrushEngine.currentSize)).toBe(22);

    await page.evaluate(() => ToolManager.selectTool(TOOLS.BRUSH));
    const brushAfter = await page.evaluate(() => BrushEngine.currentSize);
    expect(brushAfter, "the plain Brush's own size must be unaffected by sizing Spray").toBe(brushDefault);
    expect(await page.locator('#opt-size').inputValue(), 'the panel slider agrees').toBe(String(brushDefault));

    await page.evaluate(() => ToolManager.selectTool(TOOLS.SPRAY));
    expect(await page.evaluate(() => BrushEngine.currentSize), 'spray kept the size it was set to').toBe(22);
    expect(await page.locator('#opt-size').inputValue()).toBe('22');
});
