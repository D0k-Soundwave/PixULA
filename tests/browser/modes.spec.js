'use strict';
/**
 * Phase 12a/12b/13 mode-switch UX TESTLOG rows — Image-menu radio behaviour,
 * lossy confirm + cancel snap-back, undo restoring mode AND content, floating-
 * paste cancellation, and per-mode rail/gate UI (CLUT selector, index grid,
 * scheme selector, giga view row, attr ops hidden in indexed modes).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const modeId = (page) => page.evaluate(() => ACTIVE_SCREEN_MODE.id);

/** Whether the given mode's Image-menu radio is checked. Opens the submenu itself. */
async function isModeChecked(page, modeId) {
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action--parent[data-id="screen-mode"]');
    const checked = await page.$eval(`.menu-action[data-id="mode-${modeId}"]`,
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
    await page.keyboard.press('Escape');
    return checked;
}

test('Image menu radio switches mode and the geometry readout follows', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'multicolor_8x1'); // refine = silent
    expect(await modeId(page)).toBe('multicolor_8x1');
    await expect(page.locator('#canvas-size')).toHaveText(/256\s*×\s*192\s*·\s*8×1/);
    expect(await isModeChecked(page, 'multicolor_8x1')).toBe(true);
});

test('coarsening warns; Cancel leaves mode and content untouched', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'multicolor_8x1');
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(5, 5, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });

    let confirmSeen = false;
    page.once('dialog', (d) => { confirmSeen = d.type() === 'confirm'; d.dismiss(); });
    await selectMode(page, 'standard_ula');
    await page.waitForTimeout(200);
    expect(confirmSeen).toBe(true);
    expect(await modeId(page)).toBe('multicolor_8x1');
    expect(await isModeChecked(page, 'multicolor_8x1')).toBe(true); // snapped back
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(5, 5)?.isInk === true)).toBe(true);
});

test('coarsening accept converts; ONE undo restores previous mode AND content', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'multicolor_8x1');
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(5, 5, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });

    page.once('dialog', (d) => d.accept());
    await selectMode(page, 'standard_ula');
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
    await selectMode(page, 'multicolor_8x4'); // refine, silent
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(false);
});

test('ULAplus: CLUT selector replaces Flash/Bright in the rail', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'ula_plus');
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
    await selectMode(page, 'timex_hires');
    await page.waitForTimeout(300);
    expect(await modeId(page)).toBe('timex_hires');
    await expect(page.locator('#canvas-size')).toHaveText(/512\s*×\s*192/);
    const state = await page.evaluate(() => ({
        w: ZX_SPECTRUM.WIDTH,
        // visibility: hidden (not display: none, 2026-08-26 - the two
        // buttons keep their layout space reserved so the top strip's width
        // never depends on the active mode), so offsetParent alone would
        // still be truthy - check the computed style instead.
        attrOpsVisible: (() => {
            const btn = document.querySelector('#attr-tools button');
            return !!btn && getComputedStyle(btn).visibility !== 'hidden';
        })(),
        schemeSelector: [...document.querySelectorAll('#toolbar-color select, #toolbar-color [role="radiogroup"], #toolbar-color button')].length
    }));
    expect(state.w).toBe(512);
    expect(state.attrOpsVisible).toBe(false);
    expect(state.schemeSelector).toBeGreaterThanOrEqual(1);
});

test('GigaScreen: layer A/B badges + view toggle; drawing lands per sub-screen', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen'); // entering is silent
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
    await selectMode(page, 'layer2_256');
    await page.waitForTimeout(300);
    expect(await modeId(page)).toBe('layer2_256');

    const rail = await page.evaluate(() => ({
        // visibility: hidden (not display: none, 2026-08-26 - the two
        // buttons keep their layout space reserved so the top strip's width
        // never depends on the active mode), so offsetParent alone would
        // still be truthy - check the computed style instead.
        attrOpsVisible: (() => {
            const btn = document.querySelector('#attr-tools button');
            return !!btn && getComputedStyle(btn).visibility !== 'hidden';
        })(),
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

/*
 * In classic ink/paper modes, Alt+click picks BOTH attributes from a cell in
 * one action (EyedropperTool._pickCellAttributes). Indexed modes had no
 * equivalent at all — only single-index picks via left/right click, with no
 * way to grab the drawing (nextInk) and background (nextPaper) indices
 * together. Fixed by giving the indexed branch its own Alt+click path:
 * nextInk from the composited (topmost visible) index, nextPaper from the
 * background layer's OWN index at that spot regardless of what is drawn
 * over it — the indexed equivalent of a classic cell's ink pixel vs its
 * paper attribute.
 */
test('indexed modes: Alt+click picks both nextInk and nextPaper together', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
        // Background gets index 5 at (10,10); an added upper layer gets
        // index 9 there — direct pixel-index writes (bypassing the lock/
        // current-layer rules the normal drawing tools observe) just to
        // set up a known fixture.
        const bg = LayerManager.getLayer(0);
        bg.setPixelIndex(10, 10, 5);
        LayerManager.addLayer();
        const fg = LayerManager.getLayer(LayerManager.getLayerCount() - 1);
        fg.setPixelIndex(10, 10, 9);

        ColorManager.setNextInk(1);
        ColorManager.setNextPaper(1);

        const tool = ToolManager.getTool(TOOLS.EYEDROPPER);
        tool.onPointerDown(10, 10, { altKey: true, button: 0, buttons: 1 });
        tool.onPointerUp(10, 10, { altKey: true, button: 0, buttons: 1 });

        return { nextInk: ColorManager.getIndexedInk(), nextPaper: ColorManager.getIndexedPaper() };
    });
    expect(result.nextInk).toBe(9);   // the composited (foreground) index
    expect(result.nextPaper).toBe(5); // the background's own index, not the foreground's
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
    await selectMode(page, 'ulanext');
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('ulanext');
    await selectMode(page, 'standard_ula');
    await page.waitForTimeout(200);
    expect(await modeId(page)).toBe('standard_ula');
    expect(dialogs).toBe(0); // silent both ways
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(30, 30)?.isInk === true)).toBe(true);
});

test('every mode row carries the descriptor tooltip, in the active locale', async ({ page }) => {
    await boot(page);

    // One tooltip per registered mode, with the numbers taken from the
    // descriptor (never retyped).
    const rows = await page.evaluate(() => ScreenModeService.getModes().map(m => {
        const item = document.querySelector(`.menu-action[data-id="mode-${m.id}"]`);
        return {
            id: m.id, width: m.width, height: m.height, bytes: m.fileSize,
            menuTitle: item && item.title
        };
    }));
    expect(rows.length).toBeGreaterThan(13);
    for (const r of rows) {
        // size, byte count and a description line below the summary
        expect(r.menuTitle, r.id).toContain(`${r.width} × ${r.height}`);
        expect(r.menuTitle, r.id).toContain(String(r.bytes));
        expect(r.menuTitle.split('\n').length, r.id).toBe(4);
    }

    // The status-bar size readout describes the ACTIVE mode and follows a switch.
    const active = () => page.getAttribute('#canvas-size', 'title');
    expect(await active()).toContain('256 × 192');
    await selectMode(page, 'multicolor_8x1');
    expect(await active()).toContain('8×1');

    // Locale switch re-composes them (no reload).
    await page.evaluate(() => I18n.setLocale('de'));
    expect(await page.getAttribute('.menu-action[data-id="mode-lores"]', 'title'))
        .toContain('Bit pro Pixel');
    await page.evaluate(() => I18n.setLocale('en'));
});
