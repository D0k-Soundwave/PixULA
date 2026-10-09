'use strict';
/**
 * The draw-mode selector against the screen modes.
 *
 * Ink Recolour and Paper Recolour act on a cell's ink and paper attributes.
 * The indexed Next modes give every pixel its own palette index and Timex
 * hi-res shares one pair across the whole screen, so neither has those
 * attributes - and offered there, Ink Recolour did exactly what Normal did
 * while Paper Recolour painted the background index (2026-09-16). They are now
 * withdrawn in those modes, the way ClutBar already withdraws the Swap and
 * Recolour attribute ops, and a mode left standing in one of them falls back
 * to Normal rather than quietly meaning something else.
 *
 * The rules each mode follows once it is in force are pinned in Node, by
 * tests/draw-mode-matrix.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, pickCellTool, pickDrawMode } = require('./helpers');

/** The draw modes the pop-up offers, in grid order (opened, read, closed). */
async function offered(page) {
    await page.click('#draw-mode-select');
    const ids = await page.$$eval('.strip-popup .tool-btn', (els) => els.map((e) => e.dataset.drawMode));
    await page.keyboard.press('Escape');
    return ids;
}

test('Ink and Paper Recolour are withdrawn where cells have no attributes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    expect(await offered(page), 'all six are offered in Standard ULA')
        .toEqual(['normal', 'pixel_only', 'xor', 'xor_pixel', 'ink', 'paper']);

    // Stand in Ink Recolour, then move to a mode that has no cell attributes.
    await page.evaluate(() => StateManager.setDrawMode('ink'));
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
    await page.waitForTimeout(200);

    expect(await offered(page), 'Ink and Paper Recolour are not offered in Layer 2')
        .toEqual(['normal', 'pixel_only', 'xor', 'xor_pixel']);
    expect(await page.evaluate(() => StateManager.getDrawMode()),
        'and the mode the artist was standing in falls back to Normal').toBe('normal');
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('data-value', 'normal');
    await expect(page.locator('#draw-mode-status')).toBeHidden();
});

/*
 * Three kinds of control share the strip - pick-one draw modes, the Swap and
 * Recolour cell operations, the Mirror toggles - and used to run as one
 * undivided row, so nothing said that Recolour (whole cell, ignores the tool)
 * is not Ink Recolour (through the tool). A divider now sits between each
 * group, with the colour-only draw modes last, beside the cell operations.
 */
test('the strip is three selectors, divided: draw mode, cell tool, Mirror', async ({ page }) => {
    await boot(page);
    const layout = await page.evaluate(() => {
        const box = (el) => el.getBoundingClientRect();
        const row = document.getElementById('marks-icons-row');
        const buttons = [...row.querySelectorAll('button')];
        const dividers = [...row.querySelectorAll('.marks-divider')];
        const [a, b, c] = ['draw-mode-select', 'cell-tool-select', 'mirror-select']
            .map((id) => document.getElementById(id));
        return {
            ids: buttons.map((el) => el.id),
            dividers: dividers.length,
            hidden: dividers.every((d) => d.getAttribute('aria-hidden') === 'true'),
            firstBetween: box(dividers[0]).left >= box(a).right && box(dividers[0]).right <= box(b).left,
            secondBetween: box(dividers[1]).left >= box(b).right && box(dividers[1]).right <= box(c).left,
            popups: [a, b, c].map((el) => el.getAttribute('aria-haspopup'))
        };
    });
    expect(layout.ids).toEqual(['draw-mode-select', 'cell-tool-select', 'mirror-select']);
    expect(layout.dividers).toBe(2);
    expect(layout.hidden, 'dividers are decoration, not controls').toBe(true);
    expect(layout.firstBetween, 'a divider between the draw mode and the cell tool').toBe(true);
    expect(layout.secondBetween, 'a divider between the cell tool and Mirror').toBe(true);
    expect(layout.popups).toEqual(['true', 'true', 'true']);

    // The order of the grid, and the name of the one the id kept (saved preferences carry xor_pixel).
    expect(await offered(page)).toEqual(['normal', 'pixel_only', 'xor', 'xor_pixel', 'ink', 'paper']);
    await page.click('#draw-mode-select');
    expect(await page.getAttribute('.strip-popup #draw-mode-xor_pixel', 'aria-label')).toBe('XOR / Every Pass');
    await page.keyboard.press('Escape');
});

/*
 * Swap or Recolour, once switched on, takes over every tool until it is
 * switched off - and with Recolour on, a stroke over cells already in the
 * chosen colours changes nothing visible. So the status bar names it while it
 * is on, ahead of the draw mode, and the chosen draw mode's button stops
 * reading as the thing in force.
 */
test('a switched-on Swap or Recolour says so in the status bar', async ({ page }) => {
    await boot(page);
    const status = page.locator('#draw-mode-status');
    const overridden = () => page.evaluate(() =>
        document.getElementById('draw-modes').classList.contains('overridden'));

    await expect(status).toBeHidden();
    await pickCellTool(page, 'apply');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Recolour is on');
    expect(await overridden()).toBe(true);

    await pickCellTool(page, 'apply');
    await expect(status).toBeHidden();
    expect(await overridden()).toBe(false);

    // Under a non-Normal draw mode the readout hands back to that mode. Arm
    // directly: clicking a draw mode is itself a new draw method, which
    // switches Swap/Recolour off.
    await pickDrawMode(page, 'paper');
    await pickCellTool(page, 'swap');
    await expect(status).toHaveText('Swap is on');
    await pickCellTool(page, 'swap');
    await expect(status).toContainText('Paper Recolour');

    // ...and picking a draw mode switches the operation off, readout and all.
    await pickCellTool(page, 'swap');
    await pickDrawMode(page, 'normal');
    await expect(status).toBeHidden();
    expect(await overridden()).toBe(false);
});
