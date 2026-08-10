'use strict';
/**
 * Phase 5 "Keyboard" TESTLOG rows — the shortcut map is generated from
 * the TOOLS registry, so the spec reads the expected bindings from the
 * live registry rather than hardcoding them.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const tool = (page) => page.evaluate(() => ToolManager.currentTool?.id);

test('every registry shortcut selects its tool', async ({ page }) => {
    await boot(page);
    const map = await page.evaluate(() =>
        (window.TOOL_GROUPS || []).flatMap(g => g.tools || [])
            .filter(t => t.shortcut)
            .map(t => [t.shortcut, t.id]));
    expect(map.length).toBeGreaterThanOrEqual(13);
    for (const [key, id] of map) {
        // A previous tool may have focused one of its panel inputs
        // (pattern-creator name field) — keys must go to the app.
        await page.evaluate(() => {
            const el = document.activeElement;
            if (el && el !== document.body) el.blur();
        });
        await page.keyboard.press(key.toLowerCase());
        // Umbrella / variant shortcuts activate a base tool: shape variants ride
        // on the rectangle tool, brush-type variants (spray, fade, pattern) on
        // the brush tool. Accept the base-tool relationship.
        const ok = await page.evaluate((wantId) => {
            const active = ToolManager.currentTool?.id;
            if (active === wantId) return true;
            const shape = ToolManager._shapeVariants?.[wantId];
            if (shape && shape.baseTool === active) return true;
            const brush = ToolManager._brushVariants?.[wantId];
            return !!brush && active === TOOLS.BRUSH;
        }, id);
        expect(ok, `key ${key} -> ${id}`).toBe(true);
    }
});

test('Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo and redo', async ({ page }) => {
    await boot(page);
    const isInk = () => page.evaluate(() =>
        PixelDrawRoutine.getPixelState(30, 30)?.isInk === true);
    await page.evaluate(() => {
        UndoRedo.beginAction('test');
        PixelDrawRoutine.draw(30, 30, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });
    expect(await isInk()).toBe(true);
    await page.keyboard.press('Control+z');
    expect(await isInk()).toBe(false);
    await page.keyboard.press('Control+y');
    expect(await isInk()).toBe(true);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    expect(await isInk()).toBe(true);
});

test('Ctrl+A/D select; Delete clears; Ctrl+C/V/X clipboard + floating stamp; Enter commits; Esc cancels', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(10, 10, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });

    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(true);
    await page.keyboard.press('Control+d');
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(false);

    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+d');
    await page.keyboard.press('Control+v');
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(true);
    await page.keyboard.press('Escape'); // cancels the stamp
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(false);

    await page.keyboard.press('Control+v');
    await page.keyboard.press('Enter');  // commits the stamp
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(false);
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(10, 10)?.isInk === true)).toBe(true);

    // Cut leaves a floating stamp at the selection origin, source cleared
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+x');
    expect(await page.evaluate(() => !!SelectionService.floatingPaste)).toBe(true);
    await page.keyboard.press('Escape');

    // Delete clears selected pixels
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(10, 10)?.isInk === true)).toBe(false);
});

test('+/− step the zoom LADDER; 0 returns to actual size', async ({ page }) => {
    await boot(page);
    const zoom = () => page.evaluate(() => CanvasSystem.zoomLevel ?? CanvasSystem.zoom);
    const ladder = await page.evaluate(() => Array.from(ZOOM_CONFIG.LADDER));
    const z0 = await zoom();
    await page.keyboard.press('+');
    const zUp = await zoom();
    expect(zUp).toBeGreaterThan(z0);
    expect(ladder).toContain(zUp);   // steps land on multiplicative stops
    await page.keyboard.press('-');
    const zDown = await zoom();
    expect(zDown).toBeLessThan(zUp);
    expect(ladder).toContain(zDown);
    await page.keyboard.press('0');
    const z = await zoom();
    expect(z === 100 || z === 1).toBe(true); // whichever unit the system uses
});

test('F1 opens shortcuts dialog (generated from TOOL_GROUPS); Escape closes', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('F1');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/Brush/i);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
});

test('1–8 set ink, Shift+1–8 set paper, X swaps, Shift+S toggles snap', async ({ page }) => {
    await boot(page);
    const sel = () => page.evaluate(() => {
        const s = ColorManager.getCurrentSelection();
        return { ink: s.ink, paper: s.paper };
    });

    await page.keyboard.press('4');
    const afterInk = await sel();
    await page.keyboard.press('7');
    const afterInk2 = await sel();
    expect(afterInk2.ink).not.toBe(afterInk.ink);
    expect(afterInk2.paper).toBe(afterInk.paper);

    await page.keyboard.press('Shift+2');
    const afterPaper = await sel();
    expect(afterPaper.paper).not.toBe(afterInk2.paper);
    expect(afterPaper.ink).toBe(afterInk2.ink);

    await page.keyboard.press('x');
    const swapped = await sel();
    expect(swapped.ink).toBe(afterPaper.paper);
    expect(swapped.paper).toBe(afterPaper.ink);

    const pressed = () => page.getAttribute('#grid-snap-toggle', 'aria-pressed');
    const p0 = await pressed();
    await page.keyboard.press('Shift+s');
    expect(await pressed()).not.toBe(p0);
    await page.keyboard.press('Shift+s'); // restore
});

test('keys typed into inputs/selects never trigger shortcuts', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    expect(await tool(page)).toBe('brush');
    await page.focus('#zoom-level');
    await page.keyboard.press('e');       // eraser shortcut — must be ignored
    expect(await tool(page)).toBe('brush');
    await page.focus('#language-selector');
    await page.keyboard.press('g');       // fill shortcut — must be ignored
    expect(await tool(page)).toBe('brush');
});

test('controls are Tab-reachable with a visible focus indicator', async ({ page }) => {
    await boot(page);
    await page.focus('#language-selector');
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
            const el = document.activeElement;
            const cs = getComputedStyle(el);
            return {
                id: el.id || el.className,
                hasRing: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none'
            };
        });
        seen.add(info.id);
        expect(info.hasRing, `focus ring on ${info.id}`).toBe(true);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6); // focus actually moves
});
