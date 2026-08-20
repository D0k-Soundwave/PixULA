'use strict';
/**
 * The brush/eraser/line/fill mini-toolset shared by the Pattern Creator,
 * Font Editor and Map Editor dialogs (all three built from the CellGridEditor
 * surface) — previously hand-copied into all three with no hover hint in any
 * copy. Helpers.miniToolButton is now the one source of truth.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

// Font Editor and Map Editor are reached from the File menu; Pattern Creator
// is a TOOL (shortcut K) whose activate() opens its own dialog — confirmed
// against js/ui/menu-system.js (file:fontEditor/file:mapEditor) and
// js/tools/pattern-creator-tool.js (PatternCreatorPanel.open() on activate).
const DIALOGS = [
    { name: 'pattern-creator', host: '.pc-toolbar', open: async (page) => { await page.keyboard.press('k'); } },
    { name: 'font-editor', host: '.app-dialog-body', open: async (page) => {
        await page.click('.menu-item[data-menu="file"] .menu-label');
        await page.click('.menu-action[data-id="font-editor"]');
    } },
    { name: 'map-editor', host: '.app-dialog-body', open: async (page) => {
        await page.click('.menu-item[data-menu="file"] .menu-label');
        await page.click('.menu-action[data-id="map-editor"]');
    } }
];

for (const { name, host, open } of DIALOGS) {
    test(`mini-toolset in ${name} has real two-stage tooltips on all four tools`, async ({ page }) => {
        await boot(page);
        await open(page);
        await expect(page.locator(host).first()).toBeAttached();

        for (const tool of ['brush', 'eraser', 'line', 'fill']) {
            const btn = page.locator(`button[data-tool="${tool}"]`).first();
            await expect(btn).toBeAttached();
            const title = await btn.getAttribute('title');
            const { name: tName, desc } = await page.evaluate(
                (t) => Helpers.splitTitle(t), title);
            expect(desc).toBeTruthy();
            expect(desc).not.toBe(tName);
        }
    });
}
