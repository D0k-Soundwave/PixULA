'use strict';
/**
 * Fill tool, "Fill attributes": offered only where cells have colours. In
 * Layer 2, LoRes and Timex hi-res there are none for it to recolour, so the
 * box is not shown - and a value left on (by a preset) counts as off, so the
 * pixel-fill rows stay visible and a click is a plain fill.
 *
 * The flood itself (no wrap across the picture's edges) is covered by
 * tests/fill-attributes.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** Whether the option row for `key` is shown in the tool options panel. */
function rowShown(page, key) {
    return page.evaluate((k) => {
        const input = document.querySelector(`#tool-options-panel [data-option="${k}"]`);
        const r = input && input.closest('.tool-option');
        return !!r && !r.hidden && r.offsetParent !== null;
    }, key);
}

test('Fill attributes shows only where cells have colours; elsewhere it counts as off', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    await page.evaluate(() => ToolManager.selectTool(TOOLS.FILL));
    expect(await rowShown(page, 'attributesOnly'), 'Standard ULA offers Fill attributes').toBe(true);

    for (const mode of ['layer2_256', 'lores', 'timex_hires']) {
        await selectMode(page, mode);
        await page.evaluate(() => {
            ToolManager.selectTool(TOOLS.FILL);
            ToolManager.getCurrentTool().setAttributesOnly(true);
            OptionControls.showOptionsForTool(StateManager.getCurrentTool());
        });
        expect(await rowShown(page, 'attributesOnly'), `${mode}: no Fill attributes box`).toBe(false);
        expect(await rowShown(page, 'contiguous'), `${mode}: the pixel-fill rows stay`).toBe(true);
        expect(await rowShown(page, 'usePattern'), `${mode}: Use pattern stays`).toBe(true);

        // The click is a plain fill: the dot under it changes.
        const result = await page.evaluate(() => {
            const dot = () => { const s = PixelDrawRoutine.getPixelState(20, 20); return `${s.isInk}/${s.index}`; };
            // Indexed modes: an ink the dot does not hold yet (the picture
            // carries over from the mode before).
            ColorManager.setNextInk(PixelDrawRoutine.getPixelState(20, 20).index === 5 ? 6 : 5);
            const before = dot();
            ToolManager.getCurrentTool()._floodFill(20, 20, false);
            ToolManager.getCurrentTool().setAttributesOnly(false);
            return { before, after: dot() };
        });
        expect(result.after, `${mode}: the fill changed the dot`).not.toBe(result.before);
    }

    await selectMode(page, 'ula_plus');
    await page.evaluate(() => ToolManager.selectTool(TOOLS.FILL));
    expect(await rowShown(page, 'attributesOnly'), 'ULAplus offers it again').toBe(true);
});
