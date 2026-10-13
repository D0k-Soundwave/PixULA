'use strict';
/**
 * Batch 10A2 in a real browser: opposite-dot shadow and contour. The Shadow dots / Contour dots rows, the preview is the
 * picture the commit leaves, the shade clears dots on a solid area, Inverse sets them, and XOR gets the hint.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
const setSelect = (page, id, v) => page.evaluate(([i, val]) => {
    const el = document.getElementById(i);
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);
const solid = (page) => page.evaluate(() => {
    PixelDrawRoutine.beginBatch('t');
    for (let y = 56; y < 88; y++) for (let x = 72; x < 104; x++) PixelDrawRoutine.draw(x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
    PixelDrawRoutine.endBatch();
});
const dots = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let n = 0;
    for (let y = 56; y < 88; y++) for (let x = 72; x < 104; x++) {
        const c = layer.getCell(x >> 3, y >> 3);
        if (c && ((c.pixels[y & 7] >> (7 - (x & 7))) & 1)) n++;
    }
    return n;
});
const frame = (page) => page.frameLocator('#canvas-frame').locator('#main-canvas').evaluate((c) => {
    const d = c.getContext('2d').getImageData(70, 54, 36, 36).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0;
    return h;
});

async function setUp(page) {
    await boot(page);
    await solid(page);
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => ToolManager.getCurrentTool().setText('A'));
    await setSelect(page, 'opt-textAnchor', 'top-left');
}

test('the dots rows show with their effect and offer Same / Opposite', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await expect(page.locator('#opt-textShadowDots')).toBeHidden();
    await expect(page.locator('#opt-textOutlineDots')).toBeHidden();
    await page.locator('#opt-textShadow').check();
    await expect(page.locator('#opt-textShadowDots')).toBeVisible();
    await page.locator('#opt-textOutline').check();
    await expect(page.locator('#opt-textOutlineDots')).toBeVisible();
    expect(await page.locator('#opt-textShadowDots option').count()).toBe(2);
    expect(await page.evaluate(() => [ToolManager.getCurrentTool().getTextShadowDots(), ToolManager.getCurrentTool().getTextOutlineDots()])).toEqual(['same', 'same']);
});

test('an opposite shade clears dots on a solid area, and the preview is the committed picture', async ({ page }) => {
    await setUp(page);
    await page.locator('#opt-textShadow').check();
    await setSelect(page, 'opt-textShadowDots', 'opposite');
    const p = await pixelPoint(page, 80, 64);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    const preview = await frame(page);
    await page.evaluate(() => { const l = SelectionService.floatingPaste.floatingLayer; l.isStamp = true; SelectionService.commitStamp(l); });
    await page.waitForTimeout(300);
    const committed = await frame(page);
    expect(await page.evaluate(() => SelectionService.floatingPaste ? 'still floating' : 'done')).toBe('done');
    expect(committed, 'what was committed is what the preview showed').toBe(preview);
    expect(await dots(page), 'the 32x32 solid block lost the shade dots').toBeLessThan(1024);
});

test('Inverse turns the opposite shade into SET dots on an empty area', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => ToolManager.getCurrentTool().setText('A'));
    await setSelect(page, 'opt-textAnchor', 'top-left');
    await page.locator('#opt-textShadow').check();
    await setSelect(page, 'opt-textShadowDots', 'opposite');
    await page.evaluate(() => StateManager.setInverse(true));
    const p = await pixelPoint(page, 80, 64);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await dots(page), 'the shade was drawn as set dots').toBeGreaterThan(0);
});

test('in XOR draw mode the hint says the shade is not drawn', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await page.locator('#opt-textShadow').check();
    await setSelect(page, 'opt-textShadowDots', 'opposite');
    await page.evaluate(() => StateManager.setDrawMode('xor'));
    await page.evaluate(() => EventBus.emit(EVENTS.STAMP_OPTIONS_CHANGED, {}));
    await expect(page.locator('#tool-options-panel .tool-option-hint:visible', { hasText: /opposite|nothing|no effect/i })).toBeVisible();
});
