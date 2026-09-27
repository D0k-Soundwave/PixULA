'use strict';
/**
 * A shortcut printed in a menu is a promise: pressing it must do what the menu
 * item does, and nothing else.
 *
 * Found 2026-09-27, all three at once: the View menu printed G for Show Grid
 * while G has always been the Fill tool; the Layer menu printed Ctrl+E for
 * Merge Down with no handler behind it at all; and Ctrl+Shift+N, printed for
 * New Layer, fell into the plain Ctrl+N branch (the key is lowercased, and
 * nothing checked Shift) and offered to discard the artwork instead. Ctrl+N
 * and Ctrl+Shift+N are also chords Chrome, Edge and Safari keep for their own
 * new-window commands, so a menu that prints them promises a key the page
 * never receives.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Chords the browser keeps for itself - a page never sees these. */
const BROWSER_RESERVED = ['Ctrl+N', 'Ctrl+Shift+N', 'Ctrl+T', 'Ctrl+Shift+T',
    'Ctrl+W', 'Ctrl+Shift+W', 'Ctrl+Tab'];

const layerCount = (page) => page.evaluate(() => LayerManager.getLayerCount());

/** Keys must reach the app, not a focused panel control. */
const focusApp = (page) => page.evaluate(() => {
    const el = document.activeElement;
    if (el && el !== document.body) el.blur();
});

test('no key is claimed by two commands, and none is one the browser keeps', async ({ page }) => {
    await boot(page);
    const claims = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.menu-action')) {
            const key = el.querySelector(':scope > .menu-shortcut');
            if (key) out.push([key.textContent.trim(), 'menu:' + el.dataset.action]);
        }
        for (const group of TOOL_GROUPS) {
            for (const meta of group.tools) {
                if (meta.shortcut) out.push([meta.shortcut, 'tool:' + meta.id]);
            }
        }
        return out;
    });
    expect(claims.length).toBeGreaterThan(20);

    const byKey = new Map();
    for (const [key, what] of claims) {
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(what);
    }
    const clashes = [...byKey].filter(([, whats]) => whats.length > 1);
    expect(clashes, JSON.stringify(clashes)).toEqual([]);

    const reserved = claims.filter(([key]) => BROWSER_RESERVED.includes(key));
    expect(reserved, JSON.stringify(reserved)).toEqual([]);
});

test('Shift+N adds a layer', async ({ page }) => {
    await boot(page);
    await focusApp(page);
    const before = await layerCount(page);
    await page.keyboard.press('Shift+N');
    expect(await layerCount(page)).toBe(before + 1);
});

test('Ctrl+Shift+N adds a layer and never offers to discard the picture', async ({ page }) => {
    await boot(page);
    const prompts = [];
    page.on('dialog', (d) => { prompts.push(d.message()); d.dismiss(); });
    await page.evaluate(() => { FileManager.hasUnsavedChanges = true; });
    await focusApp(page);
    const before = await layerCount(page);
    await page.keyboard.press('Control+Shift+N');
    expect(await layerCount(page)).toBe(before + 1);
    expect(prompts).toEqual([]);
});

test('Alt+N starts a new picture, asking first when there is unsaved work', async ({ page }) => {
    await boot(page);
    const prompts = [];
    page.on('dialog', (d) => { prompts.push(d.type()); d.dismiss(); });
    await page.evaluate(() => { FileManager.hasUnsavedChanges = true; });
    await focusApp(page);
    await page.keyboard.press('Alt+N');
    await expect.poll(() => prompts.length).toBe(1);
    expect(prompts[0]).toBe('confirm');
    // Dismissed: the unsaved work is still there.
    expect(await page.evaluate(() => FileManager.hasUnsavedChanges)).toBe(true);
});

test('Ctrl+E merges the current layer down, exactly as Layer > Merge Down does', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        LayerManager.addLayer();
        LayerManager.addLayer();
        LayerManager.setCurrentLayer(LayerManager.getLayerCount() - 1);
    });
    await focusApp(page);
    const before = await layerCount(page);
    await page.keyboard.press('Control+E');
    expect(await layerCount(page)).toBe(before - 1);
});

test('Shift+G toggles the grid and leaves the tool alone; G is still Fill', async ({ page }) => {
    await boot(page);
    await focusApp(page);
    const state = () => page.evaluate(() => ({
        grid: GridOverlay.cellGridVisible,
        tool: ToolManager.currentTool?.id
    }));
    const before = await state();
    await page.keyboard.press('Shift+G');
    const after = await state();
    expect(after.grid).toBe(!before.grid);
    expect(after.tool).toBe(before.tool);

    await page.keyboard.press('g');
    expect((await state()).tool).toBe(await page.evaluate(() => TOOLS.FILL));
});
