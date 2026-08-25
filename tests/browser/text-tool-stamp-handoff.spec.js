'use strict';
/**
 * Reported 2026-08-25: after Copy/Paste, switching to the Text tool and
 * typing left the pasted stamp active - every hover just relocated the
 * paste, no text stamp ever formed, until the paste's layer was deleted.
 *
 * Root cause was in js/tools/text-tool.js: its pointer handlers treated ANY
 * floating stamp (`SelectionService.isFloating()`) as "my own preview is
 * live", which is also true for a stamp some other tool (or a system-
 * clipboard image paste) left floating. See js/tools/text-tool.js
 * `_ownStampFloating()` for the fix (keyed on `floatingPaste.fontInfo`,
 * which only TextTool ever sets) and tests/text-tool-stamp-handoff.test.js
 * for the Node-level unit coverage. This spec drives the real app end to
 * end through the real EventBus/SelectionService/ToolManager singletons.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('selecting Text after a paste starts a new text stamp instead of just moving the pasted one', async ({ page }) => {
    await boot(page);

    // Simulate "Copy, then Paste": a floating stamp with no fontInfo, exactly
    // like SelectionService.startFloatingPaste (the real paste path) creates.
    await page.evaluate(() => {
        const pixels = [[true, true], [true, true]];
        SelectionService.startFloatingPasteFromMask(pixels, 2, 2, 50, 50, 'Paste');
    });

    const pastedLayerIndex = await page.evaluate(() => SelectionService.floatingPaste.floatingLayer.index);
    expect(await page.evaluate(() => SelectionService.floatingPaste.fontInfo)).toBeNull();

    // Switch to the Text tool and type, exactly as the report describes.
    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.TEXT);
        ToolManager.getTool(TOOLS.TEXT).setText('HI');
    });

    // Move the mouse over the canvas - the real INPUT_POINTER_MOVE path.
    await page.evaluate(() => {
        EventBus.emit(EVENTS.INPUT_POINTER_MOVE, { x: 100, y: 100, buttons: 0, pointerType: 'mouse' });
    });

    const fp = await page.evaluate(() => {
        const f = SelectionService.floatingPaste;
        return f ? { fontInfo: f.fontInfo, layerIndex: f.floatingLayer.index } : null;
    });

    expect(fp, 'a stamp should be floating after hovering with Text active').not.toBeNull();
    expect(fp.fontInfo, 'the floating stamp must be a TEXT stamp, not the leftover paste').toBeTruthy();
    expect(fp.fontInfo.text).toBe('HI');
    expect(fp.layerIndex, 'a fresh stamp layer, not the old paste layer, is now floating')
        .not.toBe(pastedLayerIndex);
});
