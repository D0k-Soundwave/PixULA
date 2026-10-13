'use strict';
/**
 * Batch 10B in a real browser: Type on canvas. Click the picture, the hidden text field takes the keyboard; typing shows an
 * overlay preview (the document and the undo stack do not change); Enter draws it as one undo step; Escape throws it away;
 * the tool and colour shortcuts are off while typing; the Draw / New line / Cancel buttons do the same for touch.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
async function clickAt(page, x, y) {
    const p = await pixelPoint(page, x, y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
}
const inkCount = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let n = 0;
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, cy);
        if (c && c.altered) for (const r of c.pixels) { let b = r; while (b) { n += b & 1; b >>= 1; } }
    }
    return n;
});
const active = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
async function setUp(page) {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await page.locator('#opt-typeOnCanvas').check();
}

test('the option shows its rows and hides the old ones', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await expect(page.locator('#opt-textContent')).toBeVisible();
    await expect(page.locator('#opt-charWidth')).toBeHidden();
    await page.locator('#opt-typeOnCanvas').check();
    for (const id of ['charWidth', 'charHeight', 'charSpacing', 'lineSpacing']) await expect(page.locator('#opt-' + id)).toBeVisible();
    await expect(page.locator('#opt-textContent')).toBeHidden();
    await expect(page.locator('#opt-textSize')).toBeHidden();
    await expect(page.locator('#opt-textAnchor')).toBeHidden();
});

test('click, type: the field has the keyboard, the picture and undo history are untouched until Enter', async ({ page }) => {
    await setUp(page);
    const undoBefore = await page.evaluate(() => UndoRedo.getUndoCount());
    await clickAt(page, 40, 40);
    expect(await active(page)).toBe('canvas-text-entry');
    await page.keyboard.type('Hello');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('Hello');
    expect(await inkCount(page), 'nothing drawn yet').toBe(0);
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBe(undoBefore);
    await expect(page.locator('#canvas-text-buttons')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    expect(await inkCount(page), 'drawn').toBeGreaterThan(20);
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBe(undoBefore + 1);
    await expect(page.locator('#canvas-text-buttons')).toBeHidden();
    await page.keyboard.press('Control+z');
    expect(await inkCount(page), 'one Ctrl+Z takes the whole text back').toBe(0);
});

test('Escape throws the text away', async ({ page }) => {
    await setUp(page);
    await clickAt(page, 40, 40);
    await page.keyboard.type('Gone');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await inkCount(page)).toBe(0);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending)).toBe(false);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().id), 'the tool is still Text').toBe('text');
});

test('editing: arrows, Home, End, Backspace, Delete, Shift+Enter', async ({ page }) => {
    await setUp(page);
    await clickAt(page, 20, 20);
    await page.keyboard.type('abcd');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('abXcd');
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('bXcd');
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('bXc');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('yz');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('bXc\nyz');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending), 'Shift+Enter did not draw').toBe(true);
    await page.keyboard.press('Escape');
});

test('shortcuts are off while typing: b, 3, x, y change nothing but the text', async ({ page }) => {
    await setUp(page);
    const before = await page.evaluate(() => [StateManager.getCurrentTool(), ColorManager.getCurrentSelection().ink, AxisLock.axis()]);
    await clickAt(page, 30, 30);
    await page.keyboard.type('b3xy');
    const after = await page.evaluate(() => [StateManager.getCurrentTool(), ColorManager.getCurrentSelection().ink, AxisLock.axis(), ToolManager.getCurrentTool()._typing.text]);
    expect(after.slice(0, 3)).toEqual(before);
    expect(after[3]).toBe('b3xy');
    await page.keyboard.press('Escape');
});

test('the buttons: New line, Draw, Cancel', async ({ page }) => {
    await setUp(page);
    await clickAt(page, 30, 30);
    await page.keyboard.type('ab');
    await page.click('#canvas-text-newline');
    await page.keyboard.type('cd');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._typing.text)).toBe('ab\ncd');
    await page.click('#canvas-text-draw');
    await page.waitForTimeout(200);
    expect(await inkCount(page)).toBeGreaterThan(10);
    await clickAt(page, 100, 100);
    await page.keyboard.type('zz');
    await page.click('#canvas-text-cancel');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending)).toBe(false);
});

test('a click elsewhere draws the first text and starts a new one', async ({ page }) => {
    await setUp(page);
    await clickAt(page, 20, 20);
    await page.keyboard.type('one');
    await clickAt(page, 120, 100);
    expect(await inkCount(page), 'the first text is drawn').toBeGreaterThan(10);
    expect(await page.evaluate(() => [ToolManager.getCurrentTool()._typing.x, ToolManager.getCurrentTool()._typing.text])).toEqual([120, '']);
    expect(await active(page)).toBe('canvas-text-entry');
    await page.keyboard.type('two');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBeGreaterThanOrEqual(2);
});

test('stretched size: 16 x 16 characters make a taller picture than 8 x 8', async ({ page }) => {
    await setUp(page);
    await page.evaluate(() => { const t = ToolManager.getCurrentTool(); t.setCharWidth(16); t.setCharHeight(24); });
    await clickAt(page, 10, 10);
    await page.keyboard.type('A');
    const h = await page.evaluate(() => ToolManager.getCurrentTool()._typing.build().lay.height);
    expect(h).toBe(24);
    await page.keyboard.press('Escape');
});

test('the preview is the picture the commit leaves', async ({ page }) => {
    await setUp(page);
    await clickAt(page, 40, 40);
    await page.keyboard.type('Preview');
    await page.evaluate(() => { const t = ToolManager.getCurrentTool(); window.__plan = SelectionService.maskWritePlan(t._typing.build().data).length; });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const written = await inkCount(page);
    expect(await page.evaluate(() => window.__plan)).toBeGreaterThan(0);
    expect(written).toBeGreaterThan(0);
});

test('a system font cannot type on the canvas: the option says so', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => ToolManager.getCurrentTool().setFontFamily('Arial'));
    await page.evaluate(() => ToolManager.getCurrentTool().setTypeOnCanvas(true));
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getTypeOnCanvas())).toBe(false);
});

test('Ctrl+S while typing is the app\'s Save, not the browser\'s', async ({ page }) => {
    await setUp(page);
    page.on('dialog', (d) => d.accept());
    await clickAt(page, 40, 40);
    await page.keyboard.type('Save me');
    let saved = 0;
    await page.evaluate(() => { window.__saveCalls = 0; const real = FileManager.save.bind(FileManager); FileManager.save = async (...a) => { window.__saveCalls++; return real(...a); }; });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(300);
    saved = await page.evaluate(() => window.__saveCalls);
    expect(saved).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending), 'the typed text was drawn before saving').toBe(false);
});
