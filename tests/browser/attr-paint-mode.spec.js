'use strict';
/**
 * Attribute paint mode (clut-bar Swap / Recolour) is STICKY: it is disarmed
 * only by a new draw method — a tool choice or a draw-mode change — or by
 * clicking its own button off. A layer change, Escape and transform actions
 * all leave it armed. Pattern capture stays transient and exits on all three.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const mode = (page) => page.evaluate(() => InputHandler._attrPaintMode);
const arm = (page, m) => page.evaluate((x) => InputHandler.enterAttrPaintMode(x), m);

test('attr mode STAYS armed through layer change, Escape and transform', async ({ page }) => {
    await boot(page);

    // Layer change
    await arm(page, 'apply');
    await page.evaluate(() => { LayerManager.addLayer(); LayerManager.setCurrentLayer(1); });
    expect(await mode(page), 'survives layer change').toBe('apply');

    // Escape (incl. its brush reset)
    await page.keyboard.press('Escape');
    expect(await mode(page), 'survives Escape').toBe('apply');
    expect(await page.evaluate(() => ToolManager.currentTool?.id), 'Escape still resets tool').toBe('brush');

    // Transform
    await page.evaluate(() => TransformPanel.applyTransform('flip-h'));
    expect(await mode(page), 'survives transform').toBe('apply');
});

test('attr mode EXITS on a new draw method or clicking the button off', async ({ page }) => {
    await boot(page);

    // Draw-mode change
    await arm(page, 'swap');
    await page.evaluate(() => StateManager.setDrawMode('xor'));
    expect(await mode(page), 'exits on draw-mode change').toBe(null);

    // Tool change
    await arm(page, 'swap');
    await page.evaluate(() => ToolManager.selectTool('line'));
    expect(await mode(page), 'exits on tool change').toBe(null);

    // Button toggles off
    await page.click('#attr-apply');
    expect(await mode(page), 'button arms').toBe('apply');
    await page.click('#attr-apply');
    expect(await mode(page), 'button disarms').toBe(null);

    // Other button switches mode
    await page.click('#attr-apply');
    await page.click('#attr-transpose');
    expect(await mode(page), 'other button switches').toBe('swap');
});

test('pattern capture still exits on layer change / Escape / transform', async ({ page }) => {
    await boot(page);
    const cap = () => page.evaluate(() => InputHandler._patternCaptureSize);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    expect(await cap()).toBe(16);
    await page.keyboard.press('Escape');
    expect(await cap(), 'pattern capture exits on Escape').toBe(0);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    await page.evaluate(() => { LayerManager.addLayer(); LayerManager.setCurrentLayer(1); });
    expect(await cap(), 'pattern capture exits on layer change').toBe(0);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    await page.evaluate(() => TransformPanel.applyTransform('flip-h'));
    expect(await cap(), 'pattern capture exits on transform').toBe(0);
});
