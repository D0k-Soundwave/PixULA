'use strict';
/**
 * Persistence TESTLOG rows — Phase 7 autosave/session, Phase 9 persistent
 * clipboard, pref toggles, and the per-mode F5 matrices from Phases
 * 12a/12b/13. All ride the real IndexedDB on file:// plus the native
 * restore confirm() that App.init shows.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const drawSeed = (page) => page.evaluate(() => {
    UndoRedo.beginAction('seed');
    PixelDrawRoutine.draw(25, 25, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
    UndoRedo.endAction();
});
const seedIsInk = (page) => page.evaluate(() =>
    PixelDrawRoutine.getPixelState(25, 25)?.isInk === true);
const writeAutosave = (page) => page.evaluate(async () => {
    await Storage.set('autosave', App._getProjectData());
});

test('autosave restore prompt: accept restores layers/colours/zoom/border', async ({ page }) => {
    await boot(page);
    await drawSeed(page);
    // Through ColorManager, the owner of the colour selection. This used to set
    // the top-level 'ink' state path, which nothing but the autosave snapshot
    // ever read — so the test round-tripped a value the app does not use and
    // passed while restore was actually resetting the artist's ink (fixed
    // 2026-08-06 in App._getProjectData/_loadProjectData).
    await page.evaluate(() => { ColorManager.setInk(4); CanvasSystem.setZoom(300); });
    await writeAutosave(page);

    page.on('dialog', (d) => d.accept());
    await reload(page);
    expect(await seedIsInk(page)).toBe(true);
    const state = await page.evaluate(() => ({
        ink: ColorManager.getInk(),
        zoom: CanvasSystem.zoomLevel ?? CanvasSystem.zoom
    }));
    expect(state.ink).toBe(4);
    expect(state.zoom).toBe(300);
});

test('autosave restore prompt: decline clears the autosave and boots defaults', async ({ page }) => {
    await boot(page);
    await drawSeed(page);
    await writeAutosave(page);

    // beforeunload must always be accepted or the reload never happens;
    // only the autosave confirm() gets declined.
    page.on('dialog', (d) => d.type() === 'confirm' ? d.dismiss() : d.accept());
    await reload(page);
    expect(await seedIsInk(page)).toBe(false);
    expect(await page.evaluate(async () => await Storage.get('autosave'))).toBeFalsy();
});

test('beforeunload warns with unsaved changes', async ({ page }) => {
    await boot(page);
    // Real user gesture (Chrome requires activation for the dialog) + a change
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    await page.mouse.click(box.x + 40, box.y + 40);
    expect(await page.evaluate(() => FileManager.hasChanges())).toBe(true);

    let saw = null;
    page.on('dialog', (d) => { saw = d.type(); d.accept(); });
    await page.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 300));
    expect(saw).toBe('beforeunload');
});

test('preferences checkboxes reflect live state when reopened', async ({ page }) => {
    await boot(page);
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:preferences"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const boxes = dlg.locator('input[type="checkbox"]');
    expect(await boxes.count()).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');

    // Change live state OUTSIDE the dialog — reopening must show it,
    // not the defaults (the Phase 7 TESTLOG row's point). confirmClear is a
    // real StateManager-backed boolean with its own checkbox (#pref-confirm-
    // clear), unlike 'autosave' (Storage's autosave-snapshot record, not a
    // StateManager preference key at all — this test used to toggle that by
    // mistake and only passed because its checkbox lookup fell back to
    // "whichever checkbox is first in the dialog" and coincidentally landed
    // on confirmClear's own then-default value).
    const was = await page.evaluate(() => {
        const v = StateManager.get('confirmClear') !== false;
        StateManager.set('confirmClear', !v);
        return !v;
    });
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await expect(dlg).toBeVisible();
    const shown = await page.evaluate(() => {
        const dlgEl = [...document.querySelectorAll('#preferences-dialog, .dialog, dialog, [role="dialog"]')]
            .find(el => el.offsetParent !== null || el.open);
        const box = dlgEl.querySelector('#pref-confirm-clear');
        return box.checked;
    });
    expect(shown).toBe(was);
    await page.keyboard.press('Escape');
});

test('internal clipboard persists across F5: paste enabled at boot, same pixels', async ({ page }) => {
    await boot(page);
    await drawSeed(page);
    await page.evaluate(() => {
        SelectionService.selectAll();
        SelectionService.copyToClipboard();
    });
    await page.waitForTimeout(500); // persist debounce -> CLIPBOARD store

    // accept beforeunload (navigation), decline the autosave confirm
    page.on('dialog', (d) => d.type() === 'confirm' ? d.dismiss() : d.accept());
    await reload(page);

    // Edit > Paste enabled straight from boot
    await page.click('.menu-item[data-menu="edit"] .menu-label');
    const pasteDisabled = await page.$eval('.menu-action[data-id="paste"]',
        el => el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true');
    expect(pasteDisabled).toBe(false);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+v');
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(true);
    await page.keyboard.press('Enter'); // commit at 0,0 — seed pixel returns
    expect(await seedIsInk(page)).toBe(true);
});

test('grid snap and symmetry mode persist across F5', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('Shift+s');
    await page.click('#grid-controls button[data-i18n="view.mirrorH"]');
    await page.waitForTimeout(400);

    page.on('dialog', (d) => d.accept());
    await reload(page);
    expect(await page.getAttribute('#grid-snap-toggle', 'aria-pressed')).toBe('true');
    expect(await page.evaluate(() =>
        StateManager.get('symmetryMode') ?? StateManager.getSymmetryMode?.())).toBe('h');
});

test('working map and working font persist across F5 (MAPS/FONTS stores)', async ({ page }) => {
    await boot(page);
    const seeded = await page.evaluate(() => {
        const tile = MapService.getTiles().length
            ? 0
            : MapService.addTile({ kind: 'ula-cell', bitmap: new Uint8Array(8).fill(0xAA), attr: 0x38 });
        MapService.setMapCell(2, 3, 0);
        FontService.invertGlyph(66); // 'B'
        return {
            cell: MapService.getMapCell(2, 3),
            glyph: Array.from(FontService.getGlyph(66))
        };
    });
    await page.waitForTimeout(900); // debounce-persist both stores

    page.on('dialog', (d) => d.accept());
    await reload(page);
    const after = await page.evaluate(() => ({
        cell: MapService.getMapCell(2, 3),
        glyph: Array.from(FontService.getGlyph(66))
    }));
    expect(after.cell).toBe(seeded.cell);
    expect(after.glyph).toEqual(seeded.glyph);
});

// ── Per-mode F5 restore (Phases 12a / 12b / 13) ─────────────────────────
// Representative document state per family: content pixel everywhere,
// plus the mode's palette/scheme/tag state where one exists.
const MODES = [
    'STANDARD_ULA', 'MULTICOLOR_8x4', 'MULTICOLOR_8x2', 'MULTICOLOR_8x1',
    'ULA_PLUS', 'ULA_PLUS_8x1', 'TIMEX_HIRES', 'GIGASCREEN',
    'ULANEXT', 'LAYER2_256', 'LAYER2_320', 'LAYER2_640',
    'LORES', 'LORES_RADASTAN'
];

for (const mode of MODES) {
    test(`F5 in ${mode} restores mode + content + palette state`, async ({ page }) => {
        await boot(page);
        const setup = await page.evaluate(async (modeName) => {
            const id = SCREEN_MODES[modeName].id;
            ScreenModeService.switchMode(id);
            UndoRedo.beginAction('seed');
            PixelDrawRoutine.draw(9, 9, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
            UndoRedo.endAction();

            let extra = null;
            if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus') {
                ColorManager.setUlaplusRegister(5, 0b00110110);
                extra = ['ulaplus', 5, ColorManager.ulaplusRegisters[5]];
            } else if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
                ColorManager.setNextRegister?.(10, 0x155);
                extra = ['next', 10, ColorManager.nextRegisters[10]];
            } else if (ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
                ColorManager.setTimexHiresInk(3);
                extra = ['timex', null, 3];
            } else if (ACTIVE_SCREEN_MODE.screens === 2) {
                extra = ['giga', null,
                    LayerManager.layers.filter(l => l.gigaScreen !== undefined).length];
            }
            await Storage.set('autosave', App._getProjectData());
            return { id, extra };
        }, mode);

        page.on('dialog', (d) => d.accept());
        await reload(page);

        expect(await page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe(setup.id);
        expect(await page.evaluate(() =>
            PixelDrawRoutine.getPixelState(9, 9)?.isInk === true)).toBe(true);

        if (setup.extra) {
            const [kind, idx, want] = setup.extra;
            const got = await page.evaluate(([k, i]) => {
                if (k === 'ulaplus') return ColorManager.ulaplusRegisters[i];
                if (k === 'next') return ColorManager.nextRegisters[i];
                if (k === 'timex') return ColorManager.getTimexHiresInk();
                if (k === 'giga') return LayerManager.layers
                    .filter(l => l.gigaScreen !== undefined).length;
                return null;
            }, [kind, idx]);
            expect(got, `${kind} state after F5`).toBe(want);
        }
    });
}
