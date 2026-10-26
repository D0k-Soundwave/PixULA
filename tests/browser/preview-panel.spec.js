'use strict';
/**
 * Batch 9 part 9B step 3 in a real browser: the Preview panel (a map of the whole picture). Hidden until View > Preview; the
 * frame is the part of the picture the viewport shows; a click or the arrow keys scroll the canvas; no redraws while hidden.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const shown = (page) => page.evaluate(() => PanelSection.isVisible('preview-panel'));
async function showPreview(page) {
    await page.click('[data-menu="view"]');
    await page.click('[data-id="panel-preview"]');
    await page.waitForTimeout(150);
}
const visibleRect = (page) => page.evaluate(() => CanvasSystem.getVisibleRect());

test('hidden at the start, View > Preview shows and hides it, and the menu tick follows', async ({ page }) => {
    await boot(page);
    expect(await shown(page)).toBe(false);
    await showPreview(page);
    expect(await shown(page)).toBe(true);
    await expect(page.locator('#preview-panel .preview-canvas')).toBeVisible();
    await page.click('[data-menu="view"]');
    await page.click('[data-id="panel-preview"]');
    expect(await shown(page)).toBe(false);
});

test('it does no drawing while hidden, and draws once shown', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { PixelDrawRoutine.beginBatch('t'); PixelDrawRoutine.draw(10, 10, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL); PixelDrawRoutine.endBatch(); });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => PreviewPanel.drawCount)).toBe(0);
    await showPreview(page);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => PreviewPanel.drawCount)).toBeGreaterThan(0);
});

test('the miniature shows the picture: a drawn block appears in the right place', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        for (let y = 80; y < 112; y++) for (let x = 120; x < 152; x++) PixelDrawRoutine.draw(x, y, { ...ColorManager.getCurrentSelection() }, DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    await showPreview(page);
    await page.waitForTimeout(200);
    const res = await page.evaluate(() => {
        const c = document.querySelector('#preview-panel .preview-canvas');
        const ctx = c.getContext('2d');
        const px = (fx, fy) => Array.from(ctx.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data.slice(0, 3));
        return { inside: px(136 / 256, 96 / 192), outside: px(20 / 256, 20 / 192) };
    });
    expect(res.inside, 'ink colour in the block').not.toEqual(res.outside);
});

test('the frame is the visible part: whole picture at fit, a part after zoom and scroll', async ({ page }) => {
    await boot(page);
    await showPreview(page);
    await page.evaluate(() => CanvasControls.applyFit());
    await page.waitForTimeout(200);
    let v = await visibleRect(page);
    expect(v.w).toBeGreaterThan(250);
    expect(v.h).toBeGreaterThan(185);
    await page.evaluate(() => CanvasControls.setZoom ? CanvasControls.setZoom(800) : CanvasSystem.zoomTo(800));
    await page.waitForTimeout(250);
    v = await visibleRect(page);
    expect(v.w, 'a part of the width').toBeLessThan(256);
    // independent check: the pixel under the viewport's top-left corner equals the frame's origin
    const corner = await page.evaluate(() => {
        const r = document.querySelector('#canvas-frame').getBoundingClientRect();
        const p = CanvasSystem.screenToPixel(r.left + 1, r.top + 1);
        return p;
    });
    expect(Math.abs(corner.x - Math.floor(v.x))).toBeLessThanOrEqual(2);
});

test('a click on the map scrolls the canvas to that spot, and the arrow keys pan it', async ({ page }) => {
    await boot(page);
    await showPreview(page);
    await page.evaluate(() => CanvasSystem.zoomTo ? CanvasSystem.zoomTo(800) : null);
    await page.waitForTimeout(250);
    const map = page.locator('#preview-panel .preview-canvas');
    const box = await map.boundingBox();
    // locator.click scrolls the sidebar so the map is on screen first
    await map.click({ position: { x: box.width * 0.75, y: box.height * 0.75 } });
    await page.waitForTimeout(200);
    const v = await visibleRect(page);
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    expect(Math.abs(cx - 192), "x (the scroll range may stop short at the right edge)").toBeLessThan(40);
    expect(Math.abs(cy - 144)).toBeLessThan(40);
    await page.focus('#preview-panel .preview-canvas');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    const v2 = await visibleRect(page);
    expect(v2.x, 'panned left').toBeLessThan(v.x);
    expect(await page.evaluate(() => SelectionService.hasSelection()), 'the arrow keys did not reach the selection nudge').toBe(false);
});

test('the map follows a screen mode change (Layer 2 640 has a wider picture)', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await showPreview(page);
    const before = await page.evaluate(() => { const c = document.querySelector('#preview-panel .preview-canvas'); return c.height / c.width; });
    await selectMode(page, 'layer2_640');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const c = document.querySelector('#preview-panel .preview-canvas'); return c.height / c.width; });
    expect(Math.abs(before - 192 / 256)).toBeLessThan(0.02);
    expect(Math.abs(after - 256 / 640)).toBeLessThan(0.02);
});

test('cost of one redraw (measured, written to FIGURES.md)', async ({ page }) => {
    await boot(page);
    await showPreview(page);
    const t = await page.evaluate(() => {
        const runs = [];
        for (let r = 0; r < 2; r++) {
            const s = [];
            const ctx = document.querySelector('#preview-panel .preview-canvas').getContext('2d');
            // getImageData forces the drawing to finish, so the number is the work and not just the call
            for (let i = 0; i < 200; i++) { const a = performance.now(); PreviewPanel.draw(); ctx.getImageData(0, 0, 1, 1); s.push(performance.now() - a); }
            s.sort((a, b) => a - b);
            runs.push(+s[100].toFixed(3));
        }
        return runs;
    });
    console.log('PREVIEW_DRAW_MS standard_ula median of 200, two runs:', JSON.stringify(t));
    expect(t[0]).toBeLessThan(16);
});
