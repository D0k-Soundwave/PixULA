'use strict';
/**
 * Right-click on a sidebar panel's title bar to move it up/down, persisted
 * in Storage WINDOW_STATE (panelOrder), alongside panelCollapse.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

function panelOrder(page) {
    return page.$$eval('#panels > .panel', els => els.map(e => e.id));
}

test('right-click on a panel title bar opens a Move up/Move down menu', async ({ page }) => {
    await boot(page);
    const order = await panelOrder(page);
    expect(order.length).toBeGreaterThanOrEqual(2);

    // The second panel is neither first nor last, so both items are enabled.
    const header = page.locator(`#${order[1]} .panel-header`);
    await header.click({ button: 'right' });

    const items = page.locator('.canvas-context-menu__item');
    await expect(items).toHaveCount(2);
    expect((await items.nth(0).textContent()).trim()).toMatch(/move up/i);
    expect((await items.nth(1).textContent()).trim()).toMatch(/move down/i);
    expect(await items.nth(0).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(false);
    expect(await items.nth(1).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(false);
    await page.keyboard.press('Escape');
});

test('Move up is disabled on the first panel, Move down disabled on the last', async ({ page }) => {
    await boot(page);
    // The Presets panel is hidden by default (pref.showPresetsPanel); show it
    // so every DOM child is a visible, clickable header for this boundary check.
    await page.evaluate(() => StateManager.set('showPresetsPanel', true));
    const order = await panelOrder(page);

    const first = page.locator(`#${order[0]} .panel-header`);
    await first.click({ button: 'right' });
    let items = page.locator('.canvas-context-menu__item');
    expect(await items.nth(0).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(true);
    expect(await items.nth(1).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(false);
    await page.mouse.click(10, 10); // dismiss

    const last = page.locator(`#${order[order.length - 1]} .panel-header`);
    await last.click({ button: 'right' });
    items = page.locator('.canvas-context-menu__item');
    expect(await items.nth(0).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(false);
    expect(await items.nth(1).evaluate(el => el.classList.contains('canvas-context-menu__item--disabled'))).toBe(true);
    await page.mouse.click(10, 10); // dismiss
});

test('Move down reorders the panel and persists across F5 (WINDOW_STATE)', async ({ page }) => {
    await boot(page);
    const before = await panelOrder(page);
    const target = before[1];

    const header = page.locator(`#${target} .panel-header`);
    await header.click({ button: 'right' });
    await page.locator('.canvas-context-menu__item', { hasText: /move down/i }).click();

    const after = await panelOrder(page);
    expect(after[2]).toBe(target);
    expect(after[1]).toBe(before[2]);

    await page.waitForTimeout(300); // persistence debounce
    await reload(page);
    const restored = await panelOrder(page);
    expect(restored).toEqual(after);
});

test('hovering a panel title bar names the panel, says what it is for, and explains the right-click', async ({ page }) => {
    await boot(page);
    const order = await panelOrder(page);
    const tip = page.locator('.app-tooltip');
    const name = page.locator('.app-tooltip-name');
    const desc = page.locator('.app-tooltip-desc');

    await expect(tip).toBeHidden();
    await page.locator(`#${order[1]} .panel-header`).hover();

    await expect(tip).toBeVisible();
    await expect(desc).toBeVisible({ timeout: 5000 });
    expect(await name.textContent()).not.toBe('');
    const descText = await desc.textContent();
    expect(descText).toBeTruthy();
    expect(descText).not.toBe(await name.textContent());
    // Every panel's hint ends with the shared reorder instruction, so both
    // what-this-panel-is-for AND the right-click explanation are present.
    expect(descText).toMatch(/right-click/i);
});

test('clicking the canvas closes an open panel reorder menu', async ({ page }) => {
    await boot(page);
    const order = await panelOrder(page);
    const header = page.locator(`#${order[1]} .panel-header`);
    await header.click({ button: 'right' });
    await expect(page.locator('.canvas-context-menu')).toHaveCount(1);

    // The canvas lives in its own iframe document; a pointerdown there must
    // still be seen as "outside" the menu, which lives on the top document.
    const frame = page.frameLocator('#canvas-frame');
    await frame.locator('body').click({ position: { x: 10, y: 10 } });

    await expect(page.locator('.canvas-context-menu')).toHaveCount(0);
});
