'use strict';
/**
 * Pen button assignment (Preferences > Pen) driven by synthetic PointerEvents.
 *
 * Real pen hardware stays a manual TESTLOG row — what is pinned here is the
 * routing: given the button bits a pen WOULD send, does the assigned action
 * run? Events are dispatched inside the canvas iframe with pointerType 'pen',
 * because that is the one property the routing branches on.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Dispatch a pen press-and-lift at app pixel (px, py) with the given bits. */
async function penTap(page, px, py, buttons, button) {
    await page.evaluate(([px, py, buttons, button]) => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const canvas = doc.getElementById('main-canvas');
        const rect = canvas.getBoundingClientRect();
        const clientX = rect.left + (px + 0.5) * rect.width / ZX_SPECTRUM.WIDTH;
        const clientY = rect.top + (py + 0.5) * rect.height / ZX_SPECTRUM.HEIGHT;
        const opts = {
            pointerId: 7, pointerType: 'pen', isPrimary: true, bubbles: true,
            cancelable: true, clientX, clientY, pressure: 0.5
        };
        const win = doc.defaultView;
        doc.body.dispatchEvent(new win.PointerEvent('pointerdown',
            Object.assign({}, opts, { buttons, button })));
        doc.body.dispatchEvent(new win.PointerEvent('pointerup',
            Object.assign({}, opts, { buttons: 0, button, pressure: 0 })));
    }, [px, py, buttons, button]);
}

/** Dispatch a pen HOVER move (no contact) carrying the given held bits. */
async function penHover(page, px, py, buttons) {
    await page.evaluate(([px, py, buttons]) => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const canvas = doc.getElementById('main-canvas');
        const rect = canvas.getBoundingClientRect();
        const win = doc.defaultView;
        doc.body.dispatchEvent(new win.PointerEvent('pointermove', {
            pointerId: 7, pointerType: 'pen', isPrimary: true, bubbles: true,
            cancelable: true, pressure: 0, button: -1, buttons,
            clientX: rect.left + (px + 0.5) * rect.width / ZX_SPECTRUM.WIDTH,
            clientY: rect.top + (py + 0.5) * rect.height / ZX_SPECTRUM.HEIGHT
        }));
    }, [px, py, buttons]);
}

/** Assign actions to pen controls, as the Preferences dialog would. */
const assign = (page, actions) =>
    page.evaluate((a) => StateManager.set('pen.actions', a), actions);

const isInk = (page, x, y) => page.evaluate(([px, py]) =>
    PixelDrawRoutine.getPixelState(px, py)?.isInk === true, [x, y]);

/** Set the eraser's size through the real slider, then leave it selected or not. */
const setEraserSize = async (page, size) => {
    await page.keyboard.press('e');
    await page.evaluate((v) => {
        const el = document.getElementById('opt-size');
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, size);
};

/** Ink the whole canvas so an erase has something to remove. */
const inkAll = (page) => page.evaluate(() => {
    const sel = ColorManager.getCurrentSelection();
    PixelDrawRoutine.beginBatch();
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++)
        for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++)
            PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL);
    PixelDrawRoutine.endBatch();
});

/** Lit-pixel count on the hover-outline overlay. */
const overlayLit = (page) => page.evaluate(() => {
    const cvs = GridOverlay.functionPreviewCanvas;
    if (!cvs) return 0;
    const { data } = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
    return lit;
});

const TIP = 1, BARREL = 2, BARREL2 = 4, ERASER = 32;

test('the pen tip draws with the active tool', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await penTap(page, 40, 40, TIP, 0);
    expect(await isInk(page, 40, 40)).toBe(true);
});

test('the eraser end erases, whatever the active tool is', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await penTap(page, 50, 50, TIP, 0);
    expect(await isInk(page, 50, 50)).toBe(true);

    await penTap(page, 50, 50, ERASER, 5);
    expect(await isInk(page, 50, 50)).toBe(false);
});

test('the pen eraser clears the size set in Tool Options, not the active tool\'s', async ({ page }) => {
    await boot(page);
    // A size dialled in on the eraser, then left behind: the artist is holding
    // the brush (size 1) when they flip the pen over.
    await setEraserSize(page, 24);
    await page.keyboard.press('b');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getSize())).toBe(1);

    await inkAll(page);
    await penTap(page, 128, 96, ERASER, 5);

    // The eraser's own footprint contract says which pixels those are — assert
    // against it rather than against a hand-computed radius, so the disc rule
    // and the test cannot drift apart.
    const cleared = await page.evaluate(() => {
        const fp = ToolManager.getTool(TOOLS.ERASER).getFootprint(128, 96);
        let inside = 0, missed = 0, maxDx = 0;
        for (const p of fp) {
            if (p.x < 0 || p.y < 0 || p.x >= ZX_SPECTRUM.WIDTH || p.y >= ZX_SPECTRUM.HEIGHT) continue;
            inside++;
            maxDx = Math.max(maxDx, Math.abs(p.x - 128));
            if (PixelDrawRoutine.getPixelState(p.x, p.y)?.isInk === true) missed++;
        }
        return { inside, missed, maxDx };
    });
    expect(cleared.inside, 'a size-24 disc is a real area').toBeGreaterThan(100);
    expect(cleared.missed, 'every pixel the eraser promises is cleared').toBe(0);

    // And it stops there: one pixel past the disc is untouched (a brush-sized
    // erase would have failed the line above; a runaway one fails here).
    expect(await isInk(page, 128 + cleared.maxDx + 1, 96), 'nothing beyond the disc').toBe(true);
});

test('any control assigned the eraser uses that same size', async ({ page }) => {
    await boot(page);
    await setEraserSize(page, 16);
    await assign(page, { barrel: 'eraser' });
    await page.keyboard.press('b');
    await inkAll(page);

    await penTap(page, 64, 96, BARREL, 2);
    const reach = await page.evaluate(() => Math.max(
        ...ToolManager.getTool(TOOLS.ERASER).getFootprint(0, 0).map((p) => p.x)));
    expect(reach, 'size 16 reaches well past one pixel').toBeGreaterThan(3);
    expect(await isInk(page, 64 + reach, 96), 'the barrel erased the eraser\'s disc').toBe(false);
    expect(await isInk(page, 64 + reach + 1, 96), 'and no further').toBe(true);
});

test('a hovering pen held eraser-first outlines the eraser, not the brush', async ({ page }) => {
    await boot(page);
    await setEraserSize(page, 24);
    await page.keyboard.press('b');
    await page.evaluate(() => { BrushEngine.setBrush('round'); BrushEngine.setSize(1); });

    // Plain hover: the brush's single pixel is below the outline gate.
    await penHover(page, 128, 96, 0);
    expect(await overlayLit(page), 'brush at size 1 draws no outline').toBe(0);

    // Same position, tail down (a driver that reports the tail before contact).
    await penHover(page, 128, 96, ERASER);
    expect(await overlayLit(page), 'the eraser disc is outlined').toBeGreaterThan(0);

    // Flipped back: the eraser outline goes with it.
    await penHover(page, 128, 96, 0);
    expect(await overlayLit(page), 'outline cleared with the flip back').toBe(0);

    // A control assigned something else is not an eraser and gets no ring.
    await assign(page, { barrel: 'menu' });
    await penHover(page, 128, 96, BARREL);
    expect(await overlayLit(page), 'a menu button is not an eraser').toBe(0);
});

test('a barrel assigned Draw paper erases; assigned Draw ink it draws', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await assign(page, { barrel: 'paper' });
    await penTap(page, 60, 60, TIP, 0);
    expect(await isInk(page, 60, 60)).toBe(true);
    await penTap(page, 60, 60, BARREL, 2);
    expect(await isInk(page, 60, 60)).toBe(false);

    // The same button, reassigned, lays ink instead — including the case the
    // raw bits would otherwise mean "paper" to every tool.
    await assign(page, { barrel: 'ink' });
    await penTap(page, 70, 70, BARREL, 2);
    expect(await isInk(page, 70, 70)).toBe(true);
});

test('a barrel assigned the canvas menu opens it and draws nothing', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await assign(page, { barrel: 'menu' });
    await penTap(page, 80, 80, BARREL, 2);

    const menus = page.locator('.canvas-context-menu');
    await expect(menus.first()).toBeVisible();
    expect(await menus.count()).toBe(1);
    expect(await isInk(page, 80, 80)).toBe(false);
    await page.keyboard.press('Escape');
});

test('a barrel assigned Undo undoes the last stroke', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await assign(page, { barrel: 'undo' });
    await penTap(page, 90, 90, TIP, 0);
    expect(await isInk(page, 90, 90)).toBe(true);

    await penTap(page, 20, 20, BARREL, 2);
    expect(await isInk(page, 90, 90)).toBe(false); // stroke undone
    expect(await isInk(page, 20, 20)).toBe(false); // and nothing drawn where it pressed
});

test('the second barrel button is assignable in its own right', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await assign(page, { barrel: 'eyedropper', barrel2: 'paper' });
    await penTap(page, 100, 100, TIP, 0);
    expect(await isInk(page, 100, 100)).toBe(true);

    // Driver-reported middle bit — the only way a second barrel reaches a page.
    await penTap(page, 100, 100, BARREL2, 1);
    expect(await isInk(page, 100, 100)).toBe(false);
});

test('a control assigned Nothing is inert', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await assign(page, { barrel: 'none' });
    await penTap(page, 110, 110, BARREL, 2);
    expect(await isInk(page, 110, 110)).toBe(false);
    expect(await page.locator('.canvas-context-menu').count()).toBe(0);
});

test('Preferences shows the controls the chosen pen model has', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => MenuSystem._showPreferences());
    const profile = page.locator('#pref-pen-profile');
    await expect(profile).toBeVisible();

    // Wacom: two barrels and an eraser tail
    await profile.selectOption('wacom');
    expect(await page.locator('[data-pen-control]').count()).toBe(3);

    // Apple Pencil: nothing a browser can see, and it says so
    await profile.selectOption('apple');
    expect(await page.locator('[data-pen-control]').count()).toBe(0);
    await expect(page.locator('#pref-pen-controls .pref-note').first()).toBeVisible();

    // Generic: the user declares the shape themselves
    await profile.selectOption('generic');
    await expect(page.locator('#pref-pen-shape')).toBeVisible();
    await page.selectOption('#pref-pen-barrels', '2');
    await page.check('#pref-pen-eraser-end');
    expect(await page.locator('[data-pen-control]').count()).toBe(3);
});

test('an assignment made in Preferences survives a reload', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => MenuSystem._showPreferences());
    await page.selectOption('#pref-pen-profile', 'wacom');
    await page.selectOption('[data-pen-control="barrel"]', 'menu');
    await page.locator('#dialog-preferences-dialog .app-dialog-footer button.primary').click();

    await page.reload();
    await page.waitForSelector('html[data-app-ready]');
    const stored = await page.evaluate(() => InputHandler.getPenConfig());
    expect(stored.profile).toBe('wacom');
    expect(stored.actions.barrel).toBe('menu');

    await page.keyboard.press('b');
    await penTap(page, 120, 120, BARREL, 2);
    await expect(page.locator('.canvas-context-menu').first()).toBeVisible();
});
