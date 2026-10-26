'use strict';
/**
 * Batch 3 part 3B in a real browser: the pointer readout (attribute and memory
 * addresses, PLOT coordinates), the custom grid (View menu, dialog, drawing,
 * memory), the owner's grid colours, and what is remembered across a reload.
 * The arithmetic is pinned in Node by tests/pointer-info.test.js and
 * tests/custom-grid.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, selectMode } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

async function hover(page, px, py) {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x - 3, p.y - 3);
    await page.waitForTimeout(60);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(120);
}

const text = (page, id) => page.locator(id).textContent();

const setReadout = (page, detail, yDirection) =>
    page.evaluate(([d, y]) => StateManager.setReadout(d, y), [detail, yDirection]);

test('by default the readout shows position only', async ({ page }) => {
    await boot(page);
    await hover(page, 10, 20);
    expect(await text(page, '#cursor-position')).toBe('X: 10, Y: 20');
    expect(await text(page, '#cell-position')).toBe('Cell: 1, 2');
    await expect(page.locator('#attr-readout')).toBeHidden();
    await expect(page.locator('#addr-readout')).toBeHidden();
});

test('Standard ULA: the attribute and the addresses under the pointer', async ({ page }) => {
    await boot(page);
    // Cell (1,2): ink 3, paper 5, bright and flash both on = 235.
    await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(1, 2);
        Object.assign(c, { ink: 3, paper: 5, bright: true, flash: true });
        c.altered = true;
    });
    await setReadout(page, 'addresses', 'screen');
    await hover(page, 10, 20);
    expect(await text(page, '#attr-readout')).toBe('Attribute 235 ($EB): Ink 3, Paper 5, Bright 1, Flash 1');
    // (10,20): y = 20 = 00010100b. byte = $4000 + ((y & 0xC0) << 5 = 0) + ((y & 7 = 4) << 8 = $400)
    //          + ((y & 0x38 = $10) << 2 = $40) + (10 >> 3 = 1) = $4441; attribute = $5800 + (20 >> 3 = 2) * 32 + 1 = $5841
    expect(await text(page, '#addr-readout')).toBe('Byte $4441, attribute $5841 (48K)');
});

test('the readout changes at once when the preference changes', async ({ page }) => {
    await boot(page);
    await hover(page, 10, 20);
    await setReadout(page, 'attribute', 'screen');
    await expect(page.locator('#attr-readout')).toBeVisible();
    await expect(page.locator('#attr-readout')).not.toHaveText('');
    await setReadout(page, 'position', 'screen');
    await expect(page.locator('#attr-readout')).toBeHidden();
});

test('PLOT: Y counts from the bottom over the top 176 rows, and shows a dash below', async ({ page }) => {
    await boot(page);
    await setReadout(page, 'position', 'plot');
    await hover(page, 10, 0);
    expect(await text(page, '#cursor-position')).toBe('X: 10, PLOT Y: 175');
    await hover(page, 10, 175);
    expect(await text(page, '#cursor-position')).toBe('X: 10, PLOT Y: 0');
    await hover(page, 10, 180);
    expect(await text(page, '#cursor-position')).toBe('X: 10, PLOT Y: -');
    // Only the readout moved: a tool still gets screen coordinates.
    expect(await page.evaluate(() => PointerInfo.plotY(ACTIVE_SCREEN_MODE, 0))).toBe(175);
});

test('modes: GigaScreen shows both screens, Timex hi-res and Layer 2 show what they can', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await setReadout(page, 'addresses', 'screen');

    await selectMode(page, 'gigascreen');
    await hover(page, 255, 191);
    expect(await text(page, '#addr-readout')).toBe(
        'A Byte $57FF, attribute $5AFF (bank 5) | B Byte $D7FF, attribute $DAFF (bank 7)');
    expect(await text(page, '#attr-readout')).toMatch(/^A Attribute \d+ \(\$[0-9A-F]{2}\): .* \| B Attribute /);

    await selectMode(page, 'timex_hires');
    await hover(page, 264, 96);
    expect(await text(page, '#addr-readout')).toBe('Byte $6890 (Timex)');
    expect(await text(page, '#attr-readout')).toBe('No attribute cells in this mode');

    await selectMode(page, 'layer2_256');
    await hover(page, 10, 10);
    expect(await text(page, '#addr-readout')).toBe('No memory address in this mode');
    expect(await text(page, '#attr-readout')).toBe('No attribute cells in this mode');

    await selectMode(page, 'ula_plus');
    await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(0, 0);
        Object.assign(c, { ink: 1, paper: 6, bright: false, flash: true });
        c.altered = true;
    });
    await hover(page, 2, 2);
    expect(await text(page, '#attr-readout')).toBe('Attribute 177 ($B1): CLUT 2, Ink 1, Paper 6');
});

test('the Preferences dialog sets the readout and the Y direction, and OK is what applies them', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => PreferencesDialog.open());
    await page.selectOption('#pref-readout-detail', 'addresses');
    await page.selectOption('#pref-y-direction', 'plot');
    // Cancel changes nothing.
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => StateManager.getReadout())).toEqual({ detail: 'position', yDirection: 'screen' });

    await page.evaluate(() => PreferencesDialog.open());
    await page.selectOption('#pref-readout-detail', 'addresses');
    await page.selectOption('#pref-y-direction', 'plot');
    await page.click('#dialog-preferences-dialog .app-dialog-footer button.primary');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => StateManager.getReadout())).toEqual({ detail: 'addresses', yDirection: 'plot' });

    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => StateManager.getReadout())).toEqual({ detail: 'addresses', yDirection: 'plot' });
});

// -- the custom grid ----------------------------------------------------------

const gridPixel = (page, px, py) => page.evaluate(([x, y]) => {
    const c = GridOverlay.gridCustomCanvas;
    const scale = CanvasSystem.getScale();
    const dpr = window.devicePixelRatio || 1;
    const ctx = c.getContext('2d');
    // The strongest alpha along a 3-pixel strip across the line (the lines are anti-aliased).
    let best = 0;
    for (let d = -1; d <= 1; d++) {
        const data = ctx.getImageData(Math.round(x * scale * dpr) + d, Math.round(y * scale * dpr), 1, 1).data;
        best = Math.max(best, data[3]);
    }
    return best;
}, [px, py]);

async function openCustomGrid(page) {
    await page.click('.menu-item[data-menu="view"] .menu-label');
    await page.click('#menu-view [data-id="custom-grid-settings"]');
    await page.waitForSelector('#dialog-custom-grid-dialog');
}

test('Custom Grid... sets X and Y steps independently, draws them, and OK switches the grid on', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => CanvasSystem.setZoom(400));
    expect(await page.evaluate(() => GridOverlay.gridCustomCanvas.width)).toBe(0);

    await openCustomGrid(page);
    await page.fill('#custom-grid-x', '32');
    await page.fill('#custom-grid-y', '48');
    await page.click('#dialog-custom-grid-dialog .app-dialog-footer button.primary');
    expect(await page.evaluate(() => [GridOverlay.customGridVisible, GridOverlay.customStepX, GridOverlay.customStepY]))
        .toEqual([true, 32, 48]);

    // A vertical line at x = 32 and 64 ... a horizontal one at y = 48 and 96, none at x = 16 or y = 24.
    expect(await gridPixel(page, 32, 10)).toBeGreaterThan(0);
    expect(await gridPixel(page, 64, 10)).toBeGreaterThan(0);
    expect(await gridPixel(page, 16, 10)).toBe(0);
    expect(await gridPixel(page, 10, 48)).toBeGreaterThan(0);
    expect(await gridPixel(page, 10, 24)).toBe(0);

    await page.click('.menu-item[data-menu="view"] .menu-label');
    await expect(page.locator('#menu-view [data-id="custom-grid"]')).toHaveClass(/checked/);
    await page.keyboard.press('Escape');
});

test('Cancel in the Custom Grid dialog changes nothing; steps clamp to the screen', async ({ page }) => {
    await boot(page);
    await openCustomGrid(page);
    await page.fill('#custom-grid-x', '99');
    await page.click('#dialog-custom-grid-dialog .app-dialog-footer button:not(.primary)');
    expect(await page.evaluate(() => [GridOverlay.customGridVisible, GridOverlay.customStepX])).toEqual([false, 4]);

    await openCustomGrid(page);
    await page.fill('#custom-grid-x', '9999');
    await page.fill('#custom-grid-y', '0');
    await page.click('#dialog-custom-grid-dialog .app-dialog-footer button.primary');
    expect(await page.evaluate(() => [GridOverlay.customStepX, GridOverlay.customStepY]))
        .toEqual([await page.evaluate(() => ZX_SPECTRUM.WIDTH), 1]);
});

test('the custom grid works from the keyboard and works in other modes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.click('.menu-item[data-menu="view"] .menu-label');
    await page.locator('#menu-view [data-id="custom-grid"]').focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => GridOverlay.customGridVisible)).toBe(true);
    for (const mode of ['gigascreen', 'timex_hires', 'layer2_256']) {
        await selectMode(page, mode);
        await page.evaluate(() => CanvasSystem.setZoom(400));
        const size = await page.evaluate(() => GridOverlay.gridCustomCanvas.width);
        expect(size, `${mode}: the custom grid has a canvas`).toBeGreaterThan(0);
    }
});

test('all four grids come back after a reload, with the custom steps', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        GridOverlay.setPixelGridVisible(true);
        GridOverlay.setBlockGridVisible(true);
        GridOverlay.setCustomGridSteps(20, 12);
        GridOverlay.setCustomGridVisible(true);
    });
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => ({
        pixel: GridOverlay.pixelGridVisible, cell: GridOverlay.cellGridVisible,
        block: GridOverlay.blockGridVisible, custom: GridOverlay.customGridVisible,
        x: GridOverlay.customStepX, y: GridOverlay.customStepY
    }))).toEqual({ pixel: true, cell: false, block: true, custom: true, x: 20, y: 12 });
    await page.click('.menu-item[data-menu="view"] .menu-label');
    await expect(page.locator('#menu-view [data-id="custom-grid"]')).toHaveClass(/checked/);
    await expect(page.locator('#menu-view [data-id="pixel-grid"]')).toHaveClass(/checked/);
    await page.keyboard.press('Escape');
});

test('a hidden custom grid takes no memory', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => [GridOverlay.gridCustomCanvas.width, GridOverlay.gridCustomCanvas.height])).toEqual([0, 0]);
});

// -- grid colours -------------------------------------------------------------

test('grid colours: change one, it applies on OK, Reset returns it to the theme and follows later theme changes', async ({ page }) => {
    await boot(page);
    const themeCell = await page.evaluate(() => GridOverlay.themeGridColour('cell'));
    await page.evaluate(() => PreferencesDialog.open());
    await page.fill('#pref-gridcolour-cell', '#12ab34');
    await expect(page.locator('#pref-gridcolour-cell-theme')).not.toBeChecked();
    await page.click('#dialog-preferences-dialog .app-dialog-footer button.primary');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => GridOverlay.cellGridColor)).toBe('#12ab34');
    expect(await page.evaluate(() => GridOverlay.pixelGridColor)).not.toBe('#12ab34');

    // Remembered.
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => GridOverlay.cellGridColor)).toBe('#12ab34');

    // Cancel keeps it; Reset then OK returns to the theme.
    await page.evaluate(() => PreferencesDialog.open());
    await page.click('#pref-gridcolours-reset');
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => GridOverlay.cellGridColor)).toBe('#12ab34');

    await page.evaluate(() => PreferencesDialog.open());
    await page.click('#pref-gridcolours-reset');
    await page.click('#dialog-preferences-dialog .app-dialog-footer button.primary');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => GridOverlay.cellGridColor.toLowerCase())).toBe(themeCell.toLowerCase());

    // Following the theme: a theme change recolours the grid.
    await page.evaluate(() => ThemeManager.setTheme('light'));
    await page.waitForTimeout(200);
    const light = await page.evaluate(() => [GridOverlay.cellGridColor.toLowerCase(), GridOverlay.themeGridColour('cell')]);
    expect(light[0]).toBe(light[1]);
});
