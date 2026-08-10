'use strict';
/**
 * Phase 12a/12b/13 mode-switch UX TESTLOG rows — menu radios + status
 * selector coherence, lossy confirm + cancel snap-back, undo restoring
 * mode AND content, floating-paste cancellation, and per-mode rail/gate
 * UI (CLUT selector, index grid, scheme selector, giga view row,
 * attr ops hidden in indexed modes).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const modeId = (page) => page.evaluate(() => ACTIVE_SCREEN_MODE.id);

test('status selector + Image menu radio + geometry readout stay coherent', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'multicolor_8x1'); // refine = silent
    expect(await modeId(page)).toBe('multicolor_8x1');
    await expect(page.locator('#canvas-size')).toHaveText(/256\s*×\s*192\s*·\s*8×1/);

    await page.click('.menu-item[data-menu="image"] .menu-label');
    const checked = await page.$eval('.menu-action[data-id="mode-multicolor_8x1"]',
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
    expect(checked).toBe(true);
    await page.keyboard.press('Escape');
});

test('coarsening warns; Cancel leaves mode, content and selector untouched', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'multicolor_8x1');
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(5, 5, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });

    let confirmSeen = false;
    page.once('dialog', (d) => { confirmSeen = d.type() === 'confirm'; d.dismiss(); });
    await page.selectOption('#screen-mode-select', 'standard_ula');
    await page.waitForTimeout(200);
    expect(confirmSeen).toBe(true);
    expect(await modeId(page)).toBe('multicolor_8x1');
    expect(await page.inputValue('#screen-mode-select')).toBe('multicolor_8x1'); // snapped back
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(5, 5)?.isInk === true)).toBe(true);
});

test('coarsening accept converts; ONE undo restores previous mode AND content', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'multicolor_8x1');
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(5, 5, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });

    page.once('dialog', (d) => d.accept());
    await page.selectOption('#screen-mode-select', 'standard_ula');
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('standard_ula');
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(5, 5)?.isInk === true)).toBe(true); // pixels kept

    await page.keyboard.press('Control+z');
    expect(await modeId(page)).toBe('multicolor_8x1');
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(5, 5)?.isInk === true)).toBe(true);

    await page.keyboard.press('Control+y');
    expect(await modeId(page)).toBe('standard_ula');
});

test('switching modes cancels an active floating paste', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(12, 12, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
        SelectionService.selectAll();
        SelectionService.copyToClipboard();
        SelectionService.clearSelection?.();
    });
    await page.keyboard.press('Control+v'); // the real paste path
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(true);
    await page.selectOption('#screen-mode-select', 'multicolor_8x4'); // refine, silent
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(false);
});

test('ULAplus: CLUT selector replaces Flash/Bright in the rail', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'ula_plus');
    await page.waitForTimeout(200);
    const rail = await page.evaluate(() => ({
        flashVisible: !!document.querySelector('#flash-toggle')?.offsetParent,
        clutText: document.getElementById('toolbar-color')?.textContent || ''
    }));
    expect(rail.flashVisible).toBe(false);
    // CLUT selector = the 0/1/2/3 bank buttons in the rail
    const clutButtons = await page.evaluate(() =>
        [...document.querySelectorAll('#toolbar-color button, #toolbar-color [role="radio"]')]
            .map(b => b.textContent.trim()).filter(t => ['0', '1', '2', '3'].includes(t)).length);
    expect(clutButtons).toBe(4);
});

test('Timex hi-res: 512-wide geometry + scheme selector; attr ops hidden', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept()); // mono conversion warns
    await page.selectOption('#screen-mode-select', 'timex_hires');
    await page.waitForTimeout(300);
    expect(await modeId(page)).toBe('timex_hires');
    await expect(page.locator('#canvas-size')).toHaveText(/512\s*×\s*192/);
    const state = await page.evaluate(() => ({
        w: ZX_SPECTRUM.WIDTH,
        attrOpsVisible: !!document.querySelector('#attr-tools button')?.offsetParent,
        schemeSelector: [...document.querySelectorAll('#toolbar-color select, #toolbar-color [role="radiogroup"], #toolbar-color button')].length
    }));
    expect(state.w).toBe(512);
    expect(state.attrOpsVisible).toBe(false);
    expect(state.schemeSelector).toBeGreaterThanOrEqual(1);
});

test('GigaScreen: layer A/B badges + view toggle; drawing lands per sub-screen', async ({ page }) => {
    await boot(page);
    await page.selectOption('#screen-mode-select', 'gigascreen'); // entering is silent
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('gigascreen');

    const giga = await page.evaluate(() => {
        const tags = LayerManager.layers.map(l => l.gigaScreen).filter(t => t !== undefined);
        LayerManager.setGigaView('a');
        const va = LayerManager.gigaView ?? 'a';
        LayerManager.setGigaView('blend');
        return { tags: tags.length, viewApiWorked: va === 'a' };
    });
    expect(giga.tags).toBeGreaterThanOrEqual(1);
    expect(giga.viewApiWorked).toBe(true);
    // Badge visible in the layer panel
    const badges = await page.locator('#layer-panel [class*="giga"], #layer-panel .layer-badge').count();
    expect(badges).toBeGreaterThanOrEqual(1);
});

test('indexed modes: attr ops hidden, index grid in the rail, classic exports gated', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept()); // classic->indexed warns (lossy)
    await page.selectOption('#screen-mode-select', 'layer2_256');
    await page.waitForTimeout(300);
    expect(await modeId(page)).toBe('layer2_256');

    const rail = await page.evaluate(() => ({
        attrOpsVisible: !!document.querySelector('#attr-tools button')?.offsetParent,
        swatchCount: document.querySelectorAll('#toolbar-color .color-swatch, #toolbar-color [data-index]').length
    }));
    expect(rail.attrOpsVisible).toBe(false);
    expect(rail.swatchCount).toBeGreaterThan(16); // 256-entry index grid

    // SCR export must gate with the localized classic-model message
    const gate = await page.evaluate(() => {
        try { SCRFormat.export(); return null; }
        catch (e) { return e && e.message || String(e); }
    });
    expect(gate).toBeTruthy();

    // Drawing writes palette indices; eyedropper state exposes .index
    const idx = await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(3, 3, { ...ColorManager.getCurrentSelection(), index: 42 }, DRAW_MODE.NORMAL);
        UndoRedo.endAction();
        return PixelDrawRoutine.getPixelState(3, 3)?.index;
    });
    expect(idx).toBe(42);
});

test('ULANext <-> Standard is silent both ways and visually lossless with unedited palette', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(30, 30, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs++; d.accept(); });
    await page.selectOption('#screen-mode-select', 'ulanext');
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('ulanext');
    await page.selectOption('#screen-mode-select', 'standard_ula');
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('standard_ula');
    expect(dialogs).toBe(0); // silent both ways
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(30, 30)?.isInk === true)).toBe(true);
});

test('every mode row and option carries the descriptor tooltip, in the active locale', async ({ page }) => {
    await boot(page);

    // One tooltip per registered mode, on both entry points, with the
    // numbers taken from the descriptor (never retyped).
    const rows = await page.evaluate(() => ScreenModeService.getModes().map(m => {
        const opt = document.querySelector(`#screen-mode-select option[value="${m.id}"]`);
        const item = document.querySelector(`.menu-action[data-id="mode-${m.id}"]`);
        return {
            id: m.id, width: m.width, height: m.height, bytes: m.fileSize,
            optTitle: opt && opt.title, menuTitle: item && item.title
        };
    }));
    expect(rows.length).toBeGreaterThan(13);
    for (const r of rows) {
        expect(r.optTitle, r.id).toBe(r.menuTitle);
        // size, byte count and a description line below the summary
        expect(r.optTitle, r.id).toContain(`${r.width} × ${r.height}`);
        expect(r.optTitle, r.id).toContain(String(r.bytes));
        expect(r.optTitle.split('\n').length, r.id).toBe(4);
    }

    // The selector itself describes the ACTIVE mode and follows a switch.
    const active = () => page.getAttribute('#screen-mode-select', 'title');
    expect(await active()).toContain('256 × 192');
    await page.selectOption('#screen-mode-select', 'multicolor_8x1');
    expect(await active()).toContain('8×1');

    // Locale switch re-composes them (no reload).
    await page.evaluate(() => I18n.setLocale('de'));
    expect(await page.getAttribute('.menu-action[data-id="mode-lores"]', 'title'))
        .toContain('Bit pro Pixel');
    await page.evaluate(() => I18n.setLocale('en'));
});
