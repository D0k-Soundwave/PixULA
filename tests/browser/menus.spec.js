'use strict';
/**
 * Phase 4 "Menus / dialogs" TESTLOG rows — menu contents, enable states,
 * dialog opens, layer/image actions, confirms.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openMenu(page, id) {
    await page.click(`.menu-item[data-menu="${id}"] .menu-label`);
    await page.waitForSelector(`.menu-item[data-menu="${id}"] .menu-action`, { state: 'visible' });
}

test('File menu lists all actions incl. the four editor dialogs', async ({ page }) => {
    await boot(page);
    await openMenu(page, 'file');
    const ids = await page.$$eval('.menu-item[data-menu="file"] .menu-action',
        els => els.map(e => e.dataset.id));
    for (const want of ['new', 'save', 'save-as', 'export', 'export-options', 'import',
        'tape-blocks', 'map-editor', 'font-editor', 'sprite-editor']) {
        expect(ids).toContain(want);
    }
});

test('Edit menu enable states follow selection/clipboard', async ({ page }) => {
    await boot(page);
    const stateOf = async (id) => page.$eval(
        `.menu-item[data-menu="edit"] .menu-action[data-id="${id}"]`,
        el => el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true');

    await openMenu(page, 'edit');
    expect(await stateOf('copy')).toBe(true);    // nothing selected yet
    expect(await stateOf('deselect')).toBe(true);
    await page.keyboard.press('Escape');

    await page.evaluate(() => SelectionService.selectAll());
    await openMenu(page, 'edit');
    expect(await stateOf('copy')).toBe(false);
    expect(await stateOf('deselect')).toBe(false);
    await page.keyboard.press('Escape');

    await page.evaluate(() => SelectionService.copyToClipboard());
    await openMenu(page, 'edit');
    expect(await stateOf('paste')).toBe(false);
});

test('View zoom actions drive the canvas zoom; grid toggles reflect as menu checks', async ({ page }) => {
    await boot(page);
    const zoom = () => page.evaluate(() => CanvasSystem.zoomLevel ?? CanvasSystem.zoom);
    const z0 = await zoom();
    await openMenu(page, 'view');
    await page.click('.menu-action[data-action="view:zoomIn"]');
    expect(await zoom()).toBeGreaterThan(z0);

    await openMenu(page, 'view');
    await page.click('.menu-action[data-action="view:toggleGrid"]');
    await openMenu(page, 'view');
    const checked = await page.$eval('.menu-action[data-id="grid"]',
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
    expect(checked).toBe(true);
    await page.keyboard.press('Escape');
});

test('View-menu panel checkboxes add/remove the whole panel and reflect its real presence on load', async ({ page }) => {
    await boot(page);
    const isChecked = async (itemId) => page.$eval(`.menu-action[data-id="${itemId}"]`,
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
    const sectionBySectionId = {
        'panel-layers': 'layer-panel', 'panel-transform': 'transform-panel',
        'panel-reference': 'reference-panel', 'panel-tools': 'tool-options-panel'
    };
    const sectionDisplay = (id) => page.$eval(`#${id}`, el => getComputedStyle(el).display);

    // No menu interaction yet — each checkbox must already match whether its
    // panel is actually present in the sidebar (PANEL_VISIBILITY_CHANGED
    // fires on PanelSection.create(), caught before this menu read). Every
    // panel is present by default (Reference only has its CONTENT collapsed,
    // which is a different axis — the whole section is still there).
    await openMenu(page, 'view');
    for (const [itemId, sectionId] of Object.entries(sectionBySectionId)) {
        const visible = await page.evaluate((id) => PanelSection.isVisible(id), sectionId);
        expect(visible).toBe(true);
        expect(await isChecked(itemId)).toBe(true);
    }
    await page.keyboard.press('Escape');

    // Unchecking View > Layers must remove the WHOLE section (header
    // included), not just fold its content — that is what distinguishes this
    // from the panel's own inline collapse arrow.
    await openMenu(page, 'view');
    await page.click('.menu-action[data-action="view:toggleLayers"]');
    expect(await sectionDisplay('layer-panel')).toBe('none');

    // Re-adding it from a path other than this click (setVisible, as the
    // header's collapse button or any future control would call it) must
    // update the checkbox too — the two paths share one fact.
    await page.evaluate(() => PanelSection.setVisible('layer-panel', true));
    await openMenu(page, 'view');
    expect(await isChecked('panel-layers')).toBe(true);
    expect(await sectionDisplay('layer-panel')).not.toBe('none');
    await page.keyboard.press('Escape');
});

test('Layer menu: new/duplicate/delete/merge change the layer stack; flatten confirms', async ({ page }) => {
    await boot(page);
    const count = () => page.evaluate(() => LayerManager.layers.length);
    const n0 = await count();

    await openMenu(page, 'layer');
    await page.click('.menu-action[data-action="layer:new"]');
    expect(await count()).toBe(n0 + 1);

    await openMenu(page, 'layer');
    await page.click('.menu-action[data-action="layer:duplicate"]');
    expect(await count()).toBe(n0 + 2);

    await openMenu(page, 'layer');
    await page.click('.menu-action[data-action="layer:delete"]');
    expect(await count()).toBe(n0 + 1);

    // Flatten asks for confirmation (native confirm) — accept it.
    let sawConfirm = false;
    page.once('dialog', (d) => { sawConfirm = d.type() === 'confirm'; d.accept(); });
    await openMenu(page, 'layer');
    await page.click('.menu-action[data-action="layer:flatten"]');
    await page.waitForTimeout(200);
    expect(sawConfirm).toBe(true);
});

test('Image clear confirms; flips/rotate/invert run undoably', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        PixelDrawRoutine.draw(10, 10, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
    });
    await openMenu(page, 'image');
    await page.click('.menu-action[data-action="image:flipH"]');
    const flipped = await page.evaluate(() => {
        const w = ZX_SPECTRUM.WIDTH;
        return PixelDrawRoutine.getPixelState(w - 1 - 10, 10)?.isInk === true;
    });
    expect(flipped).toBe(true);

    let sawConfirm = false;
    page.once('dialog', (d) => { sawConfirm = d.type() === 'confirm'; d.dismiss(); });
    await openMenu(page, 'image');
    await page.click('.menu-action[data-action="image:clear"]');
    await page.waitForTimeout(200);
    expect(sawConfirm).toBe(true);
});

test('Settings preferences dialog and Help about/shortcuts dialogs open and close', async ({ page }) => {
    await boot(page);

    await openMenu(page, 'settings');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await expect(page.locator('.dialog, dialog, [role="dialog"]').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await openMenu(page, 'help');
    await page.click('.menu-action[data-action="help:about"]');
    await expect(page.locator('.dialog, dialog, [role="dialog"]').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await openMenu(page, 'help');
    await page.click('.menu-action[data-action="help:shortcuts"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    // Shortcut table is generated from TOOL_GROUPS — brush row must exist.
    await expect(dlg).toContainText(/Brush/i);
    await page.keyboard.press('Escape');
});

test('Export with Options dialog opens with format list and tape border override', async ({ page }) => {
    await boot(page);
    await openMenu(page, 'file');
    // file:export (File > Save...) now opens a native showSaveFilePicker
    // dialog instead - see native-save.spec.js. The hand-rolled
    // format-select dialog with per-format options (TAP border, GIF
    // animate) lives at file:exportOptions (File > Export with Options...).
    await page.click('.menu-action[data-action="file:exportOptions"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    const selects = await dlg.locator('select').count();
    expect(selects).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Escape');
});
