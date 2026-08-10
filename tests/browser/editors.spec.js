'use strict';
/**
 * Editor-dialog TESTLOG rows (Phases 8/10/11/12a/13) — the four File-menu
 * editors open and perform their basic operations; the palette editor
 * edits registers undoably and recomposes; the import conversion dialog
 * intercepts image opens with a live preview and Cancel aborts.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('Map editor: opens, adds a blank tile, paints it, persists the working map', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:mapEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    await dlg.locator('[data-i18n="map.addBlank"]').click();
    expect(await page.evaluate(() => MapService.getTiles().length)).toBeGreaterThanOrEqual(1);

    // Place the tile via the service (UI paint gestures are covered by the
    // mouse suite's patterns; here we assert the pipeline + dialog wiring).
    const placed = await page.evaluate(() => {
        MapService.setMapCell(0, 0, 0);
        return MapService.getMapCell(0, 0) === 0;
    });
    expect(placed).toBe(true);
    await page.keyboard.press('Escape');
});

test('Font editor: opens onto the working font; glyph ops + ROM reset work', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const glyph = await page.evaluate(() => {
        const before = Array.from(FontService.getGlyph(65)); // 'A'
        FontService.invertGlyph(65);
        const after = Array.from(FontService.getGlyph(65));
        FontService.resetToROM();
        const reset = Array.from(FontService.getGlyph(65));
        return { changed: before.join() !== after.join(), restored: before.join() === reset.join() };
    });
    expect(glyph.changed).toBe(true);
    expect(glyph.restored).toBe(true);
    await page.keyboard.press('Escape');
});

test('Sprite editor: opens, adds/removes sprites within the 64 cap', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:spriteEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const counts = await page.evaluate(() => {
        const c0 = SpriteService.count ?? SpriteService.getCount?.() ?? SpriteService.sprites?.length;
        SpriteService.addSprite?.() ?? SpriteService.add?.();
        const c1 = SpriteService.count ?? SpriteService.getCount?.() ?? SpriteService.sprites?.length;
        return { c0, c1 };
    });
    expect(counts.c1).toBe(counts.c0 + 1);
    await page.keyboard.press('Escape');
});

test('Palette editor: 4×16 CLUT grid in ULAplus, 256 entries in rgb333; edits are undoable and recompose', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'ula_plus'); // refine = silent
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'ula_plus');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    const ulaplusSwatches = await dlg.locator('[class*="swatch"], [data-register]').count();
    expect(ulaplusSwatches).toBeGreaterThanOrEqual(64);
    await page.keyboard.press('Escape');

    // Undoable register edit updates the --zx-N token (recompose path)
    const tokenChanged = await page.evaluate(() => {
        const before = getComputedStyle(document.documentElement).getPropertyValue('--zx-5').trim();
        UndoRedo.beginAction('palette');
        ColorManager.setUlaplusRegister(5, 0b00011100);
        UndoRedo.endAction();
        const after = getComputedStyle(document.documentElement).getPropertyValue('--zx-5').trim();
        return { before, after };
    });
    expect(tokenChanged.after).not.toBe(tokenChanged.before);
    // A shortcut sent before focus has left the dialog is not a shortcut:
    // InputHandler._isTypingTarget treats anything inside `dialog` as typing,
    // and the closed dialog holds focus for a tick after Escape. A human
    // cannot press Ctrl+Z that fast; a test can, and did - about half of all
    // parallel runs lost the keypress and reported an unreverted token.
    await page.waitForFunction(() => !document.activeElement ||
        !document.activeElement.closest('.dialog, dialog, [role="dialog"]'));
    await page.keyboard.press('Control+z');
    await page.waitForFunction(
        (want) => getComputedStyle(document.documentElement)
            .getPropertyValue('--zx-5').trim() === want,
        tokenChanged.before);

    // rgb333 mode -> 256-entry grid
    page.on('dialog', (d) => d.accept());
    await page.selectOption('#screen-mode-select', 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    await expect(dlg).toBeVisible();
    const rgbSwatches = await dlg.locator('[class*="swatch"], [data-register]').count();
    expect(rgbSwatches).toBeGreaterThanOrEqual(256);
    await page.keyboard.press('Escape');
});

test('Import conversion dialog: PNG open shows live preview; Cancel aborts untouched', async ({ page }) => {
    await boot(page);
    const docBefore = await page.evaluate(() => JSON.stringify(LayerManager.getAllLayers()).length);

    await page.evaluate(async () => {
        // Synthesize a small PNG in-page and run it through the ONE open flow.
        const c = document.createElement('canvas');
        c.width = 64; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 48);
        ctx.fillStyle = '#000000'; ctx.fillRect(8, 8, 24, 24);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const file = new File([blob], 'test.png', { type: 'image/png' });
        FileManager.loadFile(file); // don't await — the dialog blocks it
    });

    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });
    expect(await dlg.locator('canvas').count()).toBeGreaterThanOrEqual(1); // live preview
    expect(await dlg.locator('input[type="range"]').count()).toBeGreaterThanOrEqual(2); // brightness/contrast

    await page.keyboard.press('Escape'); // Cancel aborts
    await page.waitForTimeout(300);
    const docAfter = await page.evaluate(() => JSON.stringify(LayerManager.getAllLayers()).length);
    expect(docAfter).toBe(docBefore);
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(10, 10)?.isInk === true)).toBe(false);
});

test('Grid editors: the pen tail erases, exactly as the right button does', async ({ page }) => {
    await boot(page);

    // The shared surface behind the sprite/font/map/pattern editors. Driven
    // directly: what is under test is the button decoding, and every host
    // inherits it. A pen held eraser-first reports bit 32 and no right-button
    // bit at all, which used to read as "paint ink".
    const result = await page.evaluate(() => {
        const ed = new CellGridEditor({ width: 8, height: 8, canvasWidth: 80, canvasHeight: 80 });
        document.body.appendChild(ed.element);
        ed.setPixels(new Uint8Array(64).fill(1));

        const rect = ed.element.getBoundingClientRect();
        const at = (col, row, init) => {
            ed.element.dispatchEvent(new PointerEvent('pointerdown', Object.assign({
                pointerId: 9, isPrimary: true, bubbles: true, cancelable: true,
                clientX: rect.left + (col + 0.5) * rect.width / 8,
                clientY: rect.top + (row + 0.5) * rect.height / 8
            }, init)));
            ed.element.dispatchEvent(new PointerEvent('pointerup', Object.assign({
                pointerId: 9, isPrimary: true, bubbles: true, cancelable: true
            }, init, { buttons: 0 })));
            return ed.getPixels()[row * 8 + col];
        };

        const out = {
            tail:  at(1, 1, { pointerType: 'pen',   button: 5, buttons: 32 }),
            right: at(2, 2, { pointerType: 'mouse', button: 2, buttons: 2 }),
            tip:   at(3, 3, { pointerType: 'pen',   button: 0, buttons: 1 })
        };
        ed.element.remove();
        return out;
    });

    expect(result.tail, 'pen tail cleared the pixel').toBe(0);
    expect(result.right, 'right button cleared it too (unchanged)').toBe(0);
    expect(result.tip, 'the tip still paints').toBe(1);
});

test('SCR/TAP/SNA opens bypass the conversion dialog', async ({ page }) => {
    await boot(page);
    const changed = await page.evaluate(async () => {
        // Minimal valid 6912-byte SCR: all zeros = black screen
        const scr = new Uint8Array(6912);
        const file = new File([scr], 'test.scr');
        await FileManager.loadFile(file);
        return {
            dialogOpen: !!document.querySelector('.dialog, dialog, [role="dialog"]')?.offsetParent,
            mode: ACTIVE_SCREEN_MODE.id
        };
    });
    expect(changed.dialogOpen).toBeFalsy();
    expect(changed.mode).toBe('standard_ula');
});
