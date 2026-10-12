'use strict';
/**
 * Batch 10A in a real browser: the Text tool's Shadow direction, Anchor and Background rows. The maths is pinned in Node
 * (tests/text-shadow-dir.test.js, text-anchor.test.js, text-background.test.js, text-defaults-pin.test.js).
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
async function textTool(page) {
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => { ToolManager.getCurrentTool().setText('Hi'); });
}
const fp = (page) => page.evaluate(() => { const f = SelectionService.floatingPaste; return f ? { x: f.x, y: f.y, w: f.width, h: f.height } : null; });

test('the Shadow direction row shows only while Shadow is ticked', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await expect(page.locator('#opt-textShadowDir')).toBeHidden();
    await page.locator('#opt-textShadow').check();
    await expect(page.locator('#opt-textShadowDir')).toBeVisible();
    expect(await page.locator('#opt-textShadowDir option').count()).toBe(4);
    await setSelect(page, 'opt-textShadowDir', 'up-left');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getTextShadowDir())).toBe('up-left');
});

test('Anchor: the click is the top-left or the bottom-right of the text box', async ({ page }) => {
    await boot(page);
    await textTool(page);
    expect(await page.locator('#opt-textAnchor option').count()).toBe(9);
    await setSelect(page, 'opt-textAnchor', 'top-left');
    let p = await pixelPoint(page, 100, 80);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    let f = await fp(page);
    expect(f, 'a text stamp follows the pointer').not.toBeNull();
    await page.mouse.move(p.x, p.y);
    f = await fp(page);
    expect([f.x, f.y]).toEqual([100, 80]);
    await setSelect(page, 'opt-textAnchor', 'bottom-right');
    await page.mouse.move(p.x + 2, p.y + 2);
    await page.mouse.move(p.x, p.y);
    f = await fp(page);
    expect([f.x + f.w - 1, f.y + f.h - 1]).toEqual([100, 80]);
});

test('Anchor with Snap on: the top-left lands on the grid', async ({ page }) => {
    await boot(page);
    await textTool(page);
    await setSelect(page, 'opt-textAnchor', 'top-left');
    await page.keyboard.press('Shift+S');
    const p = await pixelPoint(page, 101, 83);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    await page.mouse.move(p.x, p.y);
    const f = await fp(page);
    expect([f.x % 8, f.y % 8]).toEqual([0, 0]);
});

test('Background: Clear background commits a cleared box, and the Transform panel follows', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) PixelDrawRoutine.draw(80 + x, 64 + y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    await textTool(page);
    await setSelect(page, 'opt-textAnchor', 'top-left');
    await setSelect(page, 'opt-textBackground', 'overlap');
    const p = await pixelPoint(page, 80, 64);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    await page.mouse.move(p.x, p.y);
    expect(await page.evaluate(() => SelectionService.stampOptions(SelectionService.floatingPaste).clearDots)).toBe('overlap');
    await expect(page.locator('.tp-clear-dots')).toHaveValue('overlap');
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    const ink = await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        let n = 0;
        for (let y = 64; y < 80; y++) for (let x = 80; x < 96; x++) {
            const c = layer.getCell(x >> 3, y >> 3);
            if (c && ((c.pixels[y & 7] >> (7 - (x & 7))) & 1)) n++;
        }
        return n;
    });
    expect(ink, 'the solid 16x16 block was cleared where the text box is, leaving only letters').toBeLessThan(256);
});

test('the hint appears when Clear background can change nothing (XOR draw mode)', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await setSelect(page, 'opt-textBackground', 'overlap');
    await page.evaluate(() => StateManager.setDrawMode('xor'));
    await page.evaluate(() => EventBus.emit(EVENTS.STAMP_OPTIONS_CHANGED, {}));
    await expect(page.locator('#tool-options-panel .tool-option-hint:visible', { hasText: /opposite|nothing|Clear Background/i })).toBeVisible();
});
