'use strict';
/**
 * Batch 4 part 4B in a real browser: the three whole-cell tools in the top strip (Copy colours,
 * Invert dots, Invert dots and colours) and the Eraser's colours option. What each does to a cell is
 * pinned in Node by tests/cell-tools.test.js and tests/eraser-wiping.test.js; here: the buttons, which
 * screen modes show them, the status line, real drags (one undo step each), and how they are left.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

const cellCentre = (cx, cy) => [cx * 8 + 4, cy * 8 + 4];

async function drag(page, from, to, steps = 1, button = 'left') {
    const a = await pixelPoint(page, ...from);
    const b = await pixelPoint(page, ...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button });
    await page.mouse.move(b.x, b.y, { steps });
    await page.mouse.up({ button });
}

const undoCount = (page) => page.evaluate(() => UndoRedo.getUndoCount());

/** Give a cell colours and a dot, the way a stroke would. */
const prepare = (page, cx, cy, attrs, dotAt = null) => page.evaluate(([x, y, a, d]) => {
    const px = ZX_COORDS.cellToPixel(x, y);
    PixelDrawRoutine.draw(px.x, px.y, a, DRAW_MODE.ATTRIBUTES_ONLY, { mirror: false });
    if (d) PixelDrawRoutine.draw(px.x + d[0], px.y + d[1], a, DRAW_MODE.PIXEL_ONLY, { mirror: false });
}, [cx, cy, attrs, dotAt]);

const cellState = (page, cx, cy) => page.evaluate(([x, y]) => {
    const c = LayerManager.getCurrentLayer().getCell(x, y);
    return { ink: c.ink, paper: c.paper, bright: c.bright, dots: Array.from(c.pixels).join(',') };
}, [cx, cy]);

const BUTTONS = ['attr-transpose', 'attr-apply', 'attr-copy', 'attr-invert-dots', 'attr-invert-both'];

const state = (page) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const b = document.getElementById(id);
    return [id, { visible: b.style.visibility !== 'hidden', disabled: b.disabled }];
})), BUTTONS);

test('five cell tools sit in the strip; each is a switch and only one is armed at a time', async ({ page }) => {
    await boot(page);
    for (const id of BUTTONS) await expect(page.locator('#' + id)).toBeVisible();
    await page.click('#attr-copy');
    await expect(page.locator('#attr-copy')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#draw-mode-status')).toHaveText('Copy colours is on');
    await page.click('#attr-invert-dots');
    await expect(page.locator('#attr-copy')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#attr-invert-dots')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#draw-mode-status')).toHaveText('Invert dots is on');
    await page.click('#attr-invert-both');
    await expect(page.locator('#draw-mode-status')).toHaveText('Invert dots and colours is on');
    await page.click('#attr-invert-both');
    await expect(page.locator('#draw-mode-status')).toBeHidden();
    // from the keyboard
    await page.locator('#attr-copy').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#attr-copy')).toHaveAttribute('aria-pressed', 'true');
});

test('each tool shows only in the screen modes it exists in, and a mode switch drops one that is gone', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    let s = await state(page);
    for (const id of BUTTONS) expect(s[id], `standard ${id}`).toEqual({ visible: true, disabled: false });

    await selectMode(page, 'ula_plus');
    s = await state(page);
    expect(s['attr-invert-both'], 'ULAplus: swapping ink and paper changes the look').toEqual({ visible: false, disabled: true });
    expect(s['attr-invert-dots']).toEqual({ visible: true, disabled: false });
    expect(s['attr-copy']).toEqual({ visible: true, disabled: false });

    await selectMode(page, 'standard_ula');
    await page.click('#attr-copy');
    await selectMode(page, 'timex_hires');
    s = await state(page);
    expect(s['attr-invert-dots'], 'Timex hi-res has dots in 8x8 cells').toEqual({ visible: true, disabled: false });
    for (const id of ['attr-transpose', 'attr-apply', 'attr-copy', 'attr-invert-both']) {
        expect(s[id], `timex ${id}`).toEqual({ visible: false, disabled: true });
    }
    await expect(page.locator('#draw-mode-status')).toBeHidden();   // Copy was armed in standard: gone
    expect(await page.evaluate(() => InputHandler._attrPaintMode)).toBeNull();

    await page.click('#attr-invert-dots');
    await selectMode(page, 'layer2_256');
    s = await state(page);
    for (const id of BUTTONS) expect(s[id], `layer2 ${id}`).toEqual({ visible: false, disabled: true });
    expect(await page.evaluate(() => InputHandler._attrPaintMode)).toBeNull();
});

test('Invert dots: a drag over three cells is one undo step, and a fast jump skips none', async ({ page }) => {
    await boot(page);
    await prepare(page, 2, 5, { ink: 1, paper: 6, bright: false, flash: false });
    const before = await undoCount(page);
    await page.click('#attr-invert-dots');
    // a single jump from cell (2,5) to cell (6,5): the cells between must be inverted too
    await drag(page, cellCentre(2, 5), cellCentre(6, 5), 1);
    for (const cx of [2, 3, 4, 5, 6]) {
        expect((await cellState(page, cx, 5)).dots, `cell ${cx}`).toBe('255,255,255,255,255,255,255,255');
    }
    expect((await cellState(page, 7, 5)).dots, 'the next cell is untouched').toBe('0,0,0,0,0,0,0,0');
    expect(await undoCount(page), 'one drag, one undo step').toBe(before + 1);
    // the colours were never touched
    expect((await cellState(page, 2, 5)).ink).toBe(1);

    // back and forth over the same cell in one drag does not undo it
    await drag(page, cellCentre(2, 7), cellCentre(4, 7), 4);
    const a = await cellState(page, 3, 7);
    expect(a.dots).toBe('255,255,255,255,255,255,255,255');
    const p = await pixelPoint(page, ...cellCentre(2, 9));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (const cx of [3, 4, 3, 2]) {
        const q = await pixelPoint(page, ...cellCentre(cx, 9));
        await page.mouse.move(q.x, q.y, { steps: 2 });
    }
    await page.mouse.up();
    expect((await cellState(page, 3, 9)).dots, 'visited twice in one drag, inverted once').toBe('255,255,255,255,255,255,255,255');
});

test('Invert dots and colours leaves the cell looking the same, and undo is one step', async ({ page }) => {
    await boot(page);
    await prepare(page, 4, 4, { ink: 2, paper: 5, bright: false, flash: false }, [1, 1]);
    const look = () => page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(4, 4);
        let s = '';
        for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) s += ((c.pixels[r] >> (7 - b)) & 1 ? c.ink : c.paper) + ',';
        return s;
    });
    const same = await look();
    const dotsBefore = (await cellState(page, 4, 4)).dots;
    const before = await undoCount(page);
    await page.click('#attr-invert-both');
    await drag(page, cellCentre(4, 4), cellCentre(4, 4), 1);
    expect(await look(), 'looks the same').toBe(same);
    const after = await cellState(page, 4, 4);
    expect(after.dots, 'the dots are inverted').not.toBe(dotsBefore);
    expect([after.ink, after.paper], 'ink and paper swapped').toEqual([5, 2]);
    expect(await undoCount(page)).toBe(before + 1);
    await page.keyboard.press('Control+z');
    expect((await cellState(page, 4, 4)).dots, 'one Ctrl+Z restores it').toBe(dotsBefore);
});

test('Copy colours picks on the press, paints the cells dragged over, and leaves the rail alone', async ({ page }) => {
    await boot(page);
    await prepare(page, 3, 3, { ink: 1, paper: 6, bright: true, flash: false });
    await prepare(page, 4, 3, { ink: 2, paper: 5, bright: false, flash: false }, [2, 2]);
    await prepare(page, 5, 3, { ink: 3, paper: 4, bright: false, flash: false });
    const rail = () => page.evaluate(() => JSON.stringify(ColorManager.getCurrentSelection()));
    const railBefore = await rail();
    const dots = (await cellState(page, 4, 3)).dots;
    const before = await undoCount(page);
    await page.click('#attr-copy');
    await drag(page, cellCentre(3, 3), cellCentre(5, 3), 4);
    for (const cx of [4, 5]) {
        const c = await cellState(page, cx, 3);
        expect([c.ink, c.paper, c.bright], `cell ${cx}`).toEqual([1, 6, true]);
    }
    expect((await cellState(page, 4, 3)).dots, 'dots untouched').toBe(dots);
    expect(await rail(), 'the rail is untouched').toBe(railBefore);
    expect(await undoCount(page)).toBe(before + 1);
});

test('how a cell tool is left: right-click and a new tool end it; Escape does not', async ({ page }) => {
    await boot(page);
    await page.click('#attr-invert-dots');
    await page.keyboard.press('Escape');
    await expect(page.locator('#attr-invert-dots')).toHaveAttribute('aria-pressed', 'true');
    const p = await pixelPoint(page, 60, 60);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await expect(page.locator('#attr-invert-dots')).toHaveAttribute('aria-pressed', 'false');

    await page.click('#attr-copy');
    await page.keyboard.press('b');
    await expect(page.locator('#attr-copy')).toHaveAttribute('aria-pressed', 'false');

    await page.click('#attr-invert-both');
    await page.click('#draw-modes [data-draw-mode="xor"]');
    await expect(page.locator('#attr-invert-both')).toHaveAttribute('aria-pressed', 'false');
    await page.click('#draw-modes [data-draw-mode="normal"]');
});

test('the Eraser\'s Colours option: shown where cells have colours, and Set wipes with the rail colours', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.keyboard.press('e');
    const rowVisible = () => page.evaluate(() => {
        const input = document.querySelector('#tool-options-panel [data-option="eraserColours"]');
        const r = input && input.closest('.tool-option');
        return !!r && !r.hidden && r.offsetParent !== null;
    });
    expect(await rowVisible(), 'standard ULA').toBe(true);
    await prepare(page, 6, 6, { ink: 1, paper: 6, bright: true, flash: false }, [3, 3]);
    await page.selectOption('#tool-options-panel [data-option="eraserColours"]', 'set');
    await page.evaluate(() => { ColorManager.setInk(2); ColorManager.setPaper(5); ColorManager.setBright(false); });
    await page.evaluate(() => ToolManager.getCurrentTool().setSize(8));
    await drag(page, cellCentre(6, 6), cellCentre(6, 6), 1);
    const c = await cellState(page, 6, 6);
    expect([c.ink, c.paper, c.bright], 'wiped cell takes the rail colours').toEqual([2, 5, false]);
    await selectMode(page, 'timex_hires');
    expect(await rowVisible(), 'Timex hi-res has no cell colours').toBe(false);
    await selectMode(page, 'layer2_256');
    expect(await rowVisible(), 'Layer 2').toBe(false);
});
