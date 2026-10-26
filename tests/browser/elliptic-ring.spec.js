'use strict';
/**
 * The Shape tool's Ring, elliptic and turned (2026-10-20), in a real browser. The geometry and the pin against the old
 * circular ring are in Node (tests/elliptic-ring.test.js); here: the Rotation row, a mouse-drawn ring has the width and
 * height of the drag, Rotation turns it, Mirror, XOR and Keep editable work with it, and it draws in every screen mode.
 */
const { test, expect } = require('@playwright/test');
const { boot, pickMirror, pickDrawMode } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
async function drag(page, x1, y1, x2, y2) {
    const a = await pixelPoint(page, x1, y1);
    const b = await pixelPoint(page, x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
}
async function pickShape(page, value) {
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click(`#tool-options-panel .tool-btn[data-value="${value}"]`);
}
const rowVisible = (page, key) => page.evaluate((k) => {
    const el = document.querySelector(`#opt-${k}`);
    return !!el && !el.closest('[hidden]') && el.offsetParent !== null;
}, key);
/** The box round every ink pixel of the picture, and how many there are. */
const inkBox = (page) => page.evaluate(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
        if (!PixelDrawRoutine.getPixelState(x, y)?.isInk) continue;
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
    }
    return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
});
const inkAt = (page, x, y) => page.evaluate(([px, py]) => !!PixelDrawRoutine.getPixelState(px, py)?.isInk, [x, y]);

test('Ring shows Rotation and Inner radius; a drag sets its width and height', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'ring');
    expect(await rowVisible(page, 'rotation'), 'Rotation').toBe(true);
    expect(await rowVisible(page, 'ringInner'), 'Inner radius').toBe(true);
    await drag(page, 100, 90, 140, 110);              // 40 across, 20 down from the centre
    const box = await inkBox(page);
    expect(box, 'the ring is 81 wide and 41 high round the press point')
        .toMatchObject({ x0: 60, x1: 140, y0: 70, y1: 110 });
    expect(await inkAt(page, 100, 90), 'the hole').toBe(false);
    expect(await inkAt(page, 120, 90), 'the inner ellipse, half the width').toBe(true);
    expect(await inkAt(page, 100, 100), 'the inner ellipse, half the height').toBe(true);
});

test('equal width and height draws a circular ring', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'ring');
    await drag(page, 100, 90, 125, 115);
    const box = await inkBox(page);
    expect(box).toMatchObject({ x0: 75, x1: 125, y0: 65, y1: 115 });
});

test('Rotation turns the ring round its centre; filled keeps the hole', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'ring');
    await page.locator('#opt-rotation').fill('90');
    await drag(page, 100, 90, 140, 110);
    expect(await inkBox(page), 'a quarter turn stands it up').toMatchObject({ x0: 80, x1: 120, y0: 50, y1: 130 });
    await page.keyboard.press('Control+z');

    await page.locator('#opt-rotation').fill('30');
    await page.locator('#opt-filled').check();
    await drag(page, 100, 90, 140, 110);
    const box = await inkBox(page);
    expect(box.h, 'turned 30 degrees it is taller than 41').toBeGreaterThan(41);
    expect(box.w, 'and narrower than 81').toBeLessThan(81);
    expect(Math.abs(box.x0 + box.x1 - 200), 'centred across').toBeLessThanOrEqual(1);
    expect(Math.abs(box.y0 + box.y1 - 180), 'centred down').toBeLessThanOrEqual(1);
    expect(await inkAt(page, 100, 90), 'the hole').toBe(false);
    expect(await inkAt(page, 130, 107), 'the band, turned clockwise').toBe(true);
});

test('Mirror draws a mirrored copy of the elliptic ring', async ({ page }) => {
    await boot(page);
    await pickMirror(page, 'h');
    await pickShape(page, 'ring');
    await drag(page, 60, 90, 90, 105);
    const right = await page.evaluate(() => {
        let n = 0;
        for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) for (let x = 128; x < ZX_SPECTRUM.WIDTH; x++) {
            if (PixelDrawRoutine.getPixelState(x, y)?.isInk) n++;
        }
        return n;
    });
    const box = await inkBox(page);
    expect(right, 'ink pixels on the right half').toBeGreaterThan(50);
    expect(box.x0 + box.x1, 'the two copies are mirror images about the middle').toBe(255);
    expect(box.h).toBe(31);
});

test('XOR: drawing the same elliptic ring twice takes it away again', async ({ page }) => {
    await boot(page);
    await pickDrawMode(page, 'xor');
    await pickShape(page, 'ring');
    await page.locator('#opt-rotation').fill('20');
    await drag(page, 100, 90, 140, 110);
    expect((await inkBox(page)).n, 'drawn').toBeGreaterThan(100);
    await drag(page, 100, 90, 140, 110);
    expect((await inkBox(page)).n, 'XORed away').toBe(0);
});

test('Keep editable: the elliptic ring stays pending, its handle reshapes it, Enter draws it', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'ring');
    await page.locator('#opt-pointMode').check();
    await drag(page, 100, 90, 140, 110);
    expect((await inkBox(page)).n, 'nothing is drawn on release').toBe(0);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending)).toBe(true);
    await drag(page, 140, 110, 130, 120);             // the drag-point handle: 30 across, 30 down
    await page.keyboard.press('Enter');
    expect(await inkBox(page)).toMatchObject({ x0: 70, x1: 130, y0: 60, y1: 120 });
});

test('an elliptic ring at Rotation 30 draws exactly its pixels in every screen mode', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const modes = await page.evaluate(() => ScreenModeService.getModes().map(m => m.id));
    expect(modes.length).toBeGreaterThan(10);
    for (const mode of modes.filter(m => m !== 'standard_ula').concat('standard_ula')) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await expect.poll(() => page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe(mode);
        const result = await page.evaluate(() => {
            ToolManager.selectTool(TOOLS.RECTANGLE);
            const t = ToolManager.getCurrentTool();
            t.setShapeType('ring');
            t.setPointMode(false);
            t.setFilled(false);
            t.setThickness(1);
            t.setRotation(30);
            const cx = 60, cy = 60, ex = 90, ey = 75;
            const state = () => {
                const out = new Map();
                for (let y = 20; y < 100; y++) for (let x = 20; x < 100; x++) {
                    const s = PixelDrawRoutine.getPixelState(x, y);
                    out.set(x + ',' + y, s ? `${s.isInk ? 1 : 0}:${s.index ?? ''}` : '-');
                }
                return out;
            };
            LayerManager.getCurrentLayer().clear();   // the picture carries over from the last mode
            const before = state();
            const ev = { button: 0, buttons: 1, pressure: 1, shiftKey: false, altKey: false, clientX: 0, clientY: 0 };
            UndoRedo.beginAction('ring test');
            t.onPointerDown(cx, cy, ev);
            t.onPointerUp(ex, ey, ev);
            UndoRedo.endAction();
            const after = state();
            const changed = [];
            for (const [k, v] of after) if (before.get(k) !== v) changed.push(k);
            const want = new Set(ShapeGenerator.generateShape('ring',
                ShapeGenerator.constructor.centerAnchoredBounds(cx, cy, ex, ey), t._shapeOptions()).map(p => p.x + ',' + p.y));
            const missing = [...want].filter(k => !changed.includes(k));
            const extra = changed.filter(k => !want.has(k));
            return { changed: changed.length, want: want.size, missing: missing.length, extra: extra.length };
        });
        expect(result.want, `${mode}: the ring has pixels`).toBeGreaterThan(100);
        expect(result.missing, `${mode}: every ring pixel is drawn`).toBe(0);
        expect(result.extra, `${mode}: and nothing else`).toBe(0);
    }
});
