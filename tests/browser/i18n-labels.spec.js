'use strict';
/**
 * Screen-reader labels and hover titles follow the chosen language, both on
 * a live switch and after a reload in that language.
 *
 * Found 2026-09-27: the landmark labels in index.html (Tools, Colours,
 * Drawing modes, Mirror), the layer/stamp lists, the Interface-size tooltip,
 * the panels' collapse buttons, the Ink/Paper wells and the slider -/+
 * buttons were set once in English (or once at build time) with no
 * data-i18n-* key to re-translate them.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const readLabels = (page) => page.evaluate(() => {
    const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a);
    return {
        toolbar: attr('#toolbar', 'aria-label'),
        colorRail: attr('#color-rail', 'aria-label'),
        colorBar: attr('#color-bar', 'aria-label'),
        mirror: attr('#mirror-modes', 'aria-label'),
        layerList: attr('#layer-list', 'aria-label'),
        stampList: attr('#stamp-list', 'aria-label'),
        fontScaleTitle: attr('#font-scale-selector', 'title'),
        paperTitle: attr('#paper-color', 'title'),
        paperAria: attr('#paper-color', 'aria-label'),
        minus: attr('.slider-step-minus', 'aria-label'),
        collapseText: document.querySelector('.panel-collapse .sr-only')?.textContent.trim(),
        collapseTitle: attr('.panel-collapse', 'title'),
        patternCreator: attr('.tool-btn[data-tool="pattern-creator"]', 'aria-label'),
        menuBar: attr('#menu-bar', 'aria-label'),
        language: attr('#language-selector', 'aria-label'),
        canvasFrame: attr('#canvas-frame', 'aria-label'),
        layerControls: attr('#layer-controls', 'aria-label'),
        layerLock: attr('.layer-lock', 'aria-label')
    };
});

const expected = (page, locale) => page.evaluate((locale) => {
    const t = window['i18n_' + locale];
    return {
        toolbar: t['panel.tools'], colorRail: t['preset.slice.color'],
        colorBar: t['preset.slice.drawing'], mirror: t['view.mirror'],
        layerList: t['panels.layers'], stampList: t['panels.stamps'],
        fontScaleTitle: t['a11y.textSize'], paperTitle: t['color.paper'], paperAria: t['color.paper'],
        minus: t['a11y.decrease'], collapseText: t['panel.collapse'],
        patternCreator: t['tool.patternCreator'],
        menuBar: t['a11y.mainMenu'], language: t['a11y.language'],
        canvasFrame: t['a11y.canvasFrame'].replace('{w}', '256').replace('{h}', '192'),
        layerControls: t['a11y.layerControls'], layerLock: t['a11y.toggleLayerLock']
    };
}, locale);

test('labels re-translate on a live language switch', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => I18n.setLocale('de'));
    const got = await readLabels(page);
    const want = await expected(page, 'de');
    for (const [k, v] of Object.entries(want)) expect(got[k], k).toBe(v);
    expect(got.collapseTitle.startsWith(want.collapseText)).toBe(true);
});

test('labels are translated after a reload in that language', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => I18n.setLocale('fr'));
    await page.waitForTimeout(300); // the locale choice persists asynchronously
    await reload(page);
    expect(await page.evaluate(() => I18n.getLocale())).toBe('fr');
    const got = await readLabels(page);
    const want = await expected(page, 'fr');
    for (const [k, v] of Object.entries(want)) expect(got[k], k).toBe(v);
    expect(got.collapseTitle.startsWith(want.collapseText)).toBe(true);
});

test('a new document names its first layer in the chosen language', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => I18n.setLocale('de'));
    await page.waitForTimeout(300); // the locale choice persists asynchronously
    await reload(page);
    expect(await page.evaluate(() => LayerManager.getLayer(1).name)).toBe('Ebene 1');
    // and the keyboard's own names for the modifier keys
    expect(await page.evaluate(() => Helpers.shortcutLabel('Ctrl+Shift+S'))).toBe('Strg+Umschalt+S');
});
