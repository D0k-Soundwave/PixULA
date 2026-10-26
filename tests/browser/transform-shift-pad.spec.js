'use strict';
/**
 * Batch 2 part 2B2 - the Transform panel's Move choice and the 3x3 shift pad.
 *
 *   - the pad has eight shift zones in reading order, the centre empty
 *   - Move is shown where the mode has cell colours and hidden elsewhere
 *   - the default Move ("Dots and colours") steps one whole cell
 *   - a held diagonal is one undo entry and moves both axes
 *   - Enter on a focused zone steps once, as a click does
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const PAD_ZONES = 'button[data-tp-transform^="shift"]';
const ZONE = (dir) => `button[data-tp-transform="shift${dir}"]`;

// Where to aim inside a zone (fraction of its box). The zones are clipped to
// ninths, so each aim point sits well inside its own ninth.
const AIM = {
    Up: [0.5, 0.15], Down: [0.5, 0.85], Left: [0.15, 0.5], Right: [0.85, 0.5],
    UpLeft: [0.15, 0.15], UpRight: [0.85, 0.15], DownLeft: [0.15, 0.85], DownRight: [0.85, 0.85]
};

async function aim(page, dir) {
    const zone = page.locator(ZONE(dir)).first();
    await zone.scrollIntoViewIfNeeded();
    const box = await zone.boundingBox();
    return { x: box.x + box.width * AIM[dir][0], y: box.y + box.height * AIM[dir][1] };
}

async function hold(page, dir, ms) {
    const at = await aim(page, dir);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
}

const setMove = (page, value) => page.evaluate((v) => {
    const move = document.querySelector('.tp-shift-move');
    move.value = v;
    move.dispatchEvent(new Event('change'));
}, value);

const drawBlock = (page) => page.evaluate(() => {
    for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) {
        PixelDrawRoutine.draw(x, y, { ink: 2, paper: 7, bright: false, flash: false }, DRAW_MODE.PIXEL_ONLY, { mirror: false });
    }
});

const inkBox = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
        if (layer.getPixelState(x, y)) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
    }
    return { minX, minY };
});

const undoDepth = (page) => page.evaluate(() => UndoRedo.undoStack.length);

test('the pad has eight shift zones in reading order, the centre empty', async ({ page }) => {
    await boot(page);
    const order = await page.$$eval(PAD_ZONES, (els) => els.map((e) => e.dataset.tpTransform));
    expect(order).toEqual([
        'shiftUpLeft', 'shiftUp', 'shiftUpRight',
        'shiftLeft', 'shiftRight',
        'shiftDownLeft', 'shiftDown', 'shiftDownRight'
    ]);
});

test('Move is shown in standard ULA and hidden where there are no cell colours', async ({ page }) => {
    await boot(page);
    const row = page.locator('.tp-shift-move-row');
    await expect(row).toBeVisible();

    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await expect(row).toBeHidden();
});

test('the default Move steps a whole cell, and Dots only steps a pixel', async ({ page }) => {
    await boot(page);
    await drawBlock(page);
    const start = await inkBox(page);

    await page.mouse.click(...Object.values(await aim(page, 'Right')));
    await page.waitForTimeout(50);
    expect((await inkBox(page)).minX).toBe(start.minX + 8);

    await setMove(page, 'dots');
    await page.mouse.click(...Object.values(await aim(page, 'Right')));
    await page.waitForTimeout(50);
    expect((await inkBox(page)).minX).toBe(start.minX + 9);
});

test('a held diagonal moves both axes and is one undo entry', async ({ page }) => {
    await boot(page);
    await drawBlock(page);
    await setMove(page, 'dots');
    const start = await inkBox(page);
    const depth = await undoDepth(page);

    await hold(page, 'DownRight', 900);
    await page.waitForTimeout(50);

    const moved = await inkBox(page);
    expect(moved.minX).toBeGreaterThan(start.minX);
    expect(moved.minY).toBeGreaterThan(start.minY);
    expect(await undoDepth(page) - depth).toBe(1);

    await page.evaluate(() => UndoRedo.undo());
    expect(await inkBox(page)).toEqual(start);
});

test('Enter on a focused zone steps once, as a click does', async ({ page }) => {
    await boot(page);
    await drawBlock(page);
    await setMove(page, 'dots');
    const start = await inkBox(page);

    await page.locator(ZONE('Left')).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);

    expect((await inkBox(page)).minX).toBe(start.minX - 1);
});

// Owner decision (batch 2B2): the arrow keys follow the Move choice. The
// default moves a whole cell with its paper; Dots only moves a pixel.
test('the arrow keys follow the Move choice: a cell by default, a pixel for Dots only', async ({ page }) => {
    await boot(page);
    await drawBlock(page);
    await page.evaluate(() => {
        StateManager.setGridSnap(false);
        SelectionService.selectAll();
    });
    const start = await inkBox(page);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    expect((await inkBox(page)).minX).toBe(start.minX + 8);

    await setMove(page, 'dots');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    expect((await inkBox(page)).minX).toBe(start.minX + 9);
});

// The Move choice is for content moves. A floating stamp keeps the one-pixel nudge (the 2B2 decision that
// "the one-pixel stamp nudge survives"): Move is greyed out then, so there is no way back to it otherwise.
test('the arrow keys nudge a floating stamp by one pixel, whatever the Move choice', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        StateManager.setGridSnap(false);
        const mask = [[true, true], [true, true]];
        SelectionService.startFloatingPasteFromMask(mask, 2, 2, 40, 40, 'test', null, 'none');
    });
    const x = () => page.evaluate(() => SelectionService.floatingPaste.x);
    const y = () => page.evaluate(() => SelectionService.floatingPaste.y);
    expect(await x()).toBe(40);
    await page.keyboard.press('ArrowRight');
    expect(await x(), 'one pixel, not a cell').toBe(41);
    await page.keyboard.press('ArrowDown');
    expect(await y()).toBe(41);
    await page.keyboard.press('ArrowLeft');
    expect(await x()).toBe(40);
    await page.evaluate(() => StateManager.setGridSnap(true));
    await page.keyboard.press('ArrowRight');
    expect(await x(), 'with Snap on a nudge is one cell').toBe(48);
});
