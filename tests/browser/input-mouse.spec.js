'use strict';
/**
 * Phase 5 "Mouse" TESTLOG rows + Phase 4 drag previews — real pointer
 * input over the canvas iframe. Coordinates map through the live
 * #main-canvas bounding box so zoom/fit never breaks the spec.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

const isInk = (page, x, y) => page.evaluate(([px, py]) =>
    PixelDrawRoutine.getPixelState(px, py)?.isInk === true, [x, y]);

test('left-drag draws with the brush; stroke is continuous (Bresenham)', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    const from = await pixelPoint(page, 20, 40);
    const to = await pixelPoint(page, 120, 40);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 3 }); // coarse — interpolation must fill
    await page.mouse.up();
    for (const px of [20, 45, 70, 95, 120]) {
        expect(await isInk(page, px, 40), `pixel ${px},40`).toBe(true);
    }
});

test('stroke survives leaving the canvas edge mid-drag (pointer capture)', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    const a = await pixelPoint(page, 200, 100);
    const outside = { x: 30, y: 450 };   // over the left toolbar, outside the iframe
    const b = await pixelPoint(page, 200, 150);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(outside.x, outside.y, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    expect(await isInk(page, 200, 100)).toBe(true);
    expect(await isInk(page, 200, 150)).toBe(true);
});

test('right-click draws paper; no app context menu with brush active', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    const p = await pixelPoint(page, 50, 50);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await isInk(page, 50, 50)).toBe(true);

    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    expect(await isInk(page, 50, 50)).toBe(false); // paper restored
    expect(await page.locator('.canvas-context-menu').count()).toBe(0);
});

test('right-click with selection tool opens the canvas context menu exactly once', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('m');
    const a = await pixelPoint(page, 30, 30);
    const b = await pixelPoint(page, 90, 90);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(true);

    const inside = await pixelPoint(page, 60, 60);
    await page.mouse.click(inside.x, inside.y, { button: 'right' });
    const menus = page.locator('.canvas-context-menu');
    await expect(menus.first()).toBeVisible();
    expect(await menus.count()).toBe(1);
    await page.keyboard.press('Escape');
});

test('right-click draws paper INSIDE an active selection, no context menu', async ({ page }) => {
    await boot(page);
    // Make a selection, then pick up a drawing tool: the selection must not
    // carve a hole in the right button.
    await page.keyboard.press('m');
    const a = await pixelPoint(page, 30, 30);
    const b = await pixelPoint(page, 90, 90);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(true);

    await page.keyboard.press('b');
    const inside = await pixelPoint(page, 60, 60);
    await page.mouse.move(inside.x, inside.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await isInk(page, 60, 60)).toBe(true);

    await page.mouse.move(inside.x, inside.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    expect(await isInk(page, 60, 60)).toBe(false); // paper, same as outside
    expect(await page.locator('.canvas-context-menu').count()).toBe(0);
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(true);
});

test('Shift+right-click opens the canvas menu in a drawing tool, and draws nothing', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    const p = await pixelPoint(page, 70, 40);
    expect(await isInk(page, 70, 40)).toBe(false);

    await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.keyboard.up('Shift');

    const menus = page.locator('.canvas-context-menu');
    await expect(menus.first()).toBeVisible();
    expect(await menus.count()).toBe(1);
    expect(await isInk(page, 70, 40)).toBe(false); // the modifier is not a stroke
    await page.keyboard.press('Escape');
});

test('wheel pans the canvas; Ctrl+wheel zooms (down = out)', async ({ page }) => {
    await boot(page);
    // Zoom in far enough that the viewport can actually scroll.
    await page.selectOption('#zoom-level', '800');
    const p = await pixelPoint(page, 128, 96);
    // CanvasSystem.pan scrolls the IFRAME's scrolling element.
    const scroll = () => page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const sc = doc.scrollingElement || doc.body;
        return { left: sc.scrollLeft, top: sc.scrollTop };
    });
    const s0 = await scroll();
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);
    const s1 = await scroll();
    expect(s1.top !== s0.top || s1.left !== s0.left).toBe(true);

    const zoom = () => page.evaluate(() => CanvasSystem.zoomLevel ?? CanvasSystem.zoom);
    const z0 = await zoom();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 120); // wheel down = zoom out
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    expect(await zoom()).toBeLessThan(z0);
});

test('space+drag pans without drawing; releasing space returns to the tool', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.selectOption('#zoom-level', '800');
    const p = await pixelPoint(page, 128, 96);
    const scroll = () => page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const sc = doc.scrollingElement || doc.body;
        return sc.scrollLeft + sc.scrollTop;
    });
    const s0 = await scroll();

    // selectOption left focus on the zoom <select> — space must not go there
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.down(' ');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 120, p.y - 80, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up(' ');

    expect(await scroll()).not.toBe(s0);
    expect(await isInk(page, 128, 96)).toBe(false); // pan drew nothing
});

test('shape tool shows a rubber-band preview mid-drag; selection shows a border after release', async ({ page }) => {
    await boot(page);
    const overlayActive = () => page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        return [...doc.querySelectorAll('canvas')].some(c => {
            if (c.id === 'main-canvas') return false;
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
            return false;
        });
    });

    await page.keyboard.press('s'); // shape
    const a = await pixelPoint(page, 40, 40);
    const b = await pixelPoint(page, 140, 120);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    expect(await overlayActive(), 'shape preview mid-drag').toBe(true);
    await page.mouse.up();

    await page.keyboard.press('Control+z'); // remove the committed shape

    await page.keyboard.press('m'); // selection
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150); // CANVAS_RENDER -> _renderSelectionOverlay settles
    expect(await overlayActive(), 'selection border after release').toBe(true);
});

// Attribute paint mode is STICKY — Escape leaves it armed and only a new
// draw method or the button itself disarms it. Full matrix in
// tests/browser/attr-paint-mode.spec.js.
test('Swap/Recolour engage attribute-paint mode; Esc leaves it armed, the button disarms', async ({ page }) => {
    await boot(page);
    const swapBtn = page.locator('#attr-transpose');
    const isEngaged = () => swapBtn.evaluate(el =>
        el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true');

    await swapBtn.click();
    expect(await isEngaged(), 'engages on click').toBe(true);

    await page.keyboard.press('Escape');
    expect(await isEngaged(), 'survives Escape').toBe(true);

    await swapBtn.click();
    expect(await isEngaged(), 'clicking the button off disarms').toBe(false);
});
