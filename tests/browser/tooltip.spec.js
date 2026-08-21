'use strict';
/**
 * The rail's hover tags (js/ui/tooltip-manager.js). The rail prints no
 * captions, so the tooltip IS how a tool names itself: a name tag on hover,
 * and the description only if the pointer stays. These assert the two stages
 * and their content, not the exact millisecond thresholds — those are tuned in
 * one place and would make the suite a timing test.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

test('rail buttons carry no printed caption', async ({ page }) => {
    await boot(page);
    expect(await page.locator('#tool-rail .btn-label').count()).toBe(0);
    // Icon-only means the accessible name must come from the button itself.
    const unnamed = await page.$$eval('#tool-rail .tool-btn',
        els => els.filter(e => !e.getAttribute('aria-label')).length);
    expect(unnamed).toBe(0);
});

test('hover tags the tool by name, then grows its description', async ({ page }) => {
    await boot(page);
    const tip = page.locator('.app-tooltip');
    const name = page.locator('.app-tooltip-name');
    const desc = page.locator('.app-tooltip-desc');

    await expect(tip).toBeHidden();
    await page.locator('#tool-rail .tool-btn[data-tool="fade"]').hover();

    // Stage 1: the name tag, with the shortcut and nothing else.
    await expect(tip).toBeVisible();
    await expect(name).toHaveText(/^Fade \(F\)$/);
    await expect(desc).toBeHidden();

    // Stage 2: the sentence, from the registry's hint key.
    await expect(desc).toBeVisible({ timeout: 5000 });
    const expected = await page.evaluate(() => window.I18n.t('tool.fade.hint'));
    await expect(desc).toHaveText(expected);
    expect(expected).not.toMatch(/^Fade/); // a description, not the name again

    // Leaving takes the whole thing away and hands the title back, so I18n and
    // assistive tech still see it.
    await page.mouse.move(800, 500);
    await expect(tip).toBeHidden();
    const title = await page.getAttribute('#tool-rail .tool-btn[data-tool="fade"]', 'title');
    expect(title).toContain('Fade (F)');
    expect(title).toContain(expected);
});

test('keyboard focus tags the control, a pointer-focused button does not', async ({ page }) => {
    await boot(page);
    const tip = page.locator('.app-tooltip');

    // Tab until focus lands in the rail (the header controls come first).
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => !!document.activeElement.closest('#tool-rail'))) break;
    }
    expect(await page.evaluate(() => !!document.activeElement.closest('#tool-rail'))).toBe(true);
    await expect(tip).toBeVisible();
    const focused = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    await expect(page.locator('.app-tooltip-name')).toContainText(focused);

    // Clicking a tool focuses it too, and there the click already said what it
    // is — no tag for that (:focus-visible).
    await page.keyboard.press('Escape');
    await page.locator('#tool-rail .tool-btn[data-tool="eraser"]').click();
    await page.mouse.move(600, 600);
    await expect(tip).toBeHidden();
});

test('every rail control has a description that is not its own name', async ({ page }) => {
    await boot(page);
    const bad = await page.evaluate(() => {
        const out = [];
        for (const btn of document.querySelectorAll('#tool-rail .tool-btn')) {
            const { name, desc } = Helpers.splitTitle(btn.getAttribute('title') || '');
            if (!desc || desc === name) out.push(btn.getAttribute('aria-label') || name);
        }
        return out;
    });
    expect(bad).toEqual([]);
});

/*
 * The main-workspace areas already swept for real hints, generalized beyond
 * the rail's own test above. #tool-options-panel-content is deliberately
 * excluded: only the Shape Type row's "basic" category has real hints so
 * far (batch 1 of docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md);
 * every other tool's icon-grid options are still name-only pending batch 2/3,
 * so including that panel here would make this test flaky against work not
 * yet done. Remove the exclusion once batch 2/3 finishes that panel.
 */
test('every two-stage control in the main workspace chrome has a real description', async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(() => {
        const out = [];
        let total = 0;
        const areas = [
            '#tool-rail', '#panels', '#zoom-controls', '.app-dialog-header',
            '#grid-controls', '#draw-modes', '#transform-panel'
        ];
        const seen = new Set();
        for (const areaSelector of areas) {
            for (const area of document.querySelectorAll(areaSelector)) {
                for (const el of area.querySelectorAll('[data-i18n-title-name]')) {
                    if (el.closest('#tool-options-panel-content')) continue;
                    // KNOWN GAP, deliberately out of scope (see the batch 2
                    // plan's Global Constraints): the shift dir-pad zones
                    // (Helpers.buildDirPad()) are shared verbatim by the
                    // Transform panel (shift the layer/selection) and the
                    // Reference panel (shift the reference image) — one
                    // hint text would be correct for one context and wrong
                    // for the other, and the builder has no parameter to
                    // vary it. They carry aria-label only, no title, by
                    // design. Remove this exclusion once buildDirPad() (or
                    // its two call sites) can express context-specific
                    // hints.
                    if (el.classList.contains('dir-pad-zone')) continue;
                    if (seen.has(el)) continue;
                    seen.add(el);
                    total++;
                    if (!el.matches(window.Tooltip.SELECTOR)) {
                        out.push(`${el.className || el.tagName} carries data-i18n-title-name but TooltipManager.SELECTOR does not match it`);
                        continue;
                    }
                    const { name, desc } = Helpers.splitTitle(el.getAttribute('title') || '');
                    if (!desc || desc === name) {
                        out.push(el.getAttribute('aria-label') || name || el.className);
                    }
                }
            }
        }
        return { bad: out, total };
    });
    expect(result.bad).toEqual([]);
    expect(result.total).toBeGreaterThan(0);
});

/*
 * The main-workspace sweep above never opens a dialog, so nothing in
 * Font/Map/Sprite/Palette Editor, Tape Block, Import or the Workspace
 * Presets manager was ever checked by it — those dialogs' own SELECTOR-
 * matched controls (all wired in batch 3 of
 * docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md) had no
 * mechanical check that the match actually fires; only a human reviewer
 * catching a dropped or mistyped class kept it honest. This test opens
 * each of those seven dialogs in turn and runs the exact same sweep
 * against its body, closing it before the next one opens (the app boots
 * once for the whole test).
 */
test('every two-stage control in every batch-3 dialog has a real description', async ({ page }) => {
    await boot(page);

    const sweepDialog = async () => {
        // Several of the dialogs below open via page.evaluate (no real mouse
        // move of their own), so the cursor can be left resting, from an
        // earlier real click elsewhere in this test, exactly over a control
        // in the dialog that just appeared under it. Chromium re-hit-tests on
        // layout change and fires a genuine pointerover in that case, and
        // TooltipManager.show() strips that control's `title` attribute (by
        // design, to suppress the native OS tooltip) before the sweep below
        // ever reads it — seen for real with the Import dialog's middle
        // (smooth) pane landing under a menu click left over from the
        // Palette Editor section. Moving the mouse off to a neutral corner
        // first forces a real pointerout, which restores any stripped title
        // via TooltipManager.hide(), so the sweep always sees the same title
        // an actual reader would.
        await page.mouse.move(2, 2);
        return page.evaluate(() => {
            const out = [];
            const body = document.querySelector('.app-dialog-body');
            if (!body) return { bad: ['NO DIALOG BODY FOUND'], total: 0 };
            // Sweep by the marker attribute, not by SELECTOR itself — a class
            // silently dropped from SELECTOR must show up as a failure here,
            // which querying FOR SELECTOR could never do (see the design note
            // above Task 2). One deliberate exception: .pattern-item never
            // sets this marker (its name is a user pattern name, not an i18n
            // key) — its SELECTOR membership is checked separately in
            // pattern-thumbnail-tooltip.spec.js instead.
            let total = 0;
            for (const el of body.querySelectorAll('[data-i18n-title-name]')) {
                total++;
                if (!el.matches(window.Tooltip.SELECTOR)) {
                    out.push(`${el.className || el.tagName} carries data-i18n-title-name but TooltipManager.SELECTOR does not match it`);
                    continue;
                }
                const { name, desc } = Helpers.splitTitle(el.getAttribute('title') || '');
                if (!desc || desc === name) {
                    out.push(el.getAttribute('aria-label') || name || el.className);
                }
            }
            return { bad: out, total };
        });
    };

    const closeDialog = async () => {
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.app-dialog-body'));
    };

    // Font Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    const fontResult = await sweepDialog();
    expect(fontResult.bad, 'Font Editor').toEqual([]);
    expect(fontResult.total, 'Font Editor should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Map Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:mapEditor"]');
    const mapResult = await sweepDialog();
    expect(mapResult.bad, 'Map Editor').toEqual([]);
    expect(mapResult.total, 'Map Editor should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Sprite Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:spriteEditor"]');
    const spriteResult = await sweepDialog();
    expect(spriteResult.bad, 'Sprite Editor').toEqual([]);
    expect(spriteResult.total, 'Sprite Editor should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Palette Editor — needs an editable-palette mode; rgb333 (Next) also
    // renders the kind select, so it exercises more of the dialog than
    // ULAplus alone would.
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    const paletteResult = await sweepDialog();
    expect(paletteResult.bad, 'Palette Editor').toEqual([]);
    expect(paletteResult.total, 'Palette Editor should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Back to a standard screen layout: TAPFormat.export (below, for the
    // Tape Block dialog) requires it, and layer2_256 (just selected above)
    // does not have it.
    await selectMode(page, 'standard_ula');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'standard_ula');

    // Tape Block dialog — built directly from a real in-memory TAP file,
    // same as tests/browser/tape-block-tooltip.spec.js.
    await page.evaluate(() => {
        const buf = TAPFormat.export({ border: 0, name: 'test' });
        TapeBlockDialog.open(buf.buffer, 'test.tap');
    });
    const tapeResult = await sweepDialog();
    expect(tapeResult.bad, 'Tape Block').toEqual([]);
    expect(tapeResult.total, 'Tape Block should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Import dialog — a synthesized PNG through the real open flow, same
    // as tests/browser/import-method-tooltip.spec.js.
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 48);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const file = new File([blob], 'test.png', { type: 'image/png' });
        FileManager.loadFile(file);
    });
    await page.waitForSelector('.app-dialog-body', { timeout: 10000 });
    const importResult = await sweepDialog();
    expect(importResult.bad, 'Import').toEqual([]);
    expect(importResult.total, 'Import should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();

    // Workspace Presets manager — seed one filled slot first so both the
    // filled-row and empty-row action buttons render.
    await page.evaluate(() => PresetService.save(0, 'Batch 4 check', ['color']));
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:presets"]');
    const presetResult = await sweepDialog();
    expect(presetResult.bad, 'Workspace Presets manager').toEqual([]);
    expect(presetResult.total, 'Workspace Presets manager should sweep at least one control').toBeGreaterThan(0);
    await closeDialog();
});

/* Touch has no hover, so the whole tooltip hangs off press-and-hold. Real touch
   events (CDP), not synthetic ones: the point is that the browser's own tap
   still selects a tool while a hold does not. */
test.describe('touch', () => {
    test.use({ hasTouch: true });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    test('a tap picks the tool; a press-and-hold explains it instead', async ({ page, context }) => {
        await boot(page);
        const cdp = await context.newCDPSession(page);
        const tip = page.locator('.app-tooltip');
        const at = async (tool) => {
            const box = await page.locator(`#tool-rail .tool-btn[data-tool="${tool}"]`).boundingBox();
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        };
        const touch = (type, points) =>
            cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

        // Tap: the tool changes and nothing is explained.
        await touch('touchStart', [await at('fill')]);
        await sleep(80);
        await touch('touchEnd', []);
        await expect(page.locator('#tool-rail .tool-btn[data-tool="fill"]')).toHaveClass(/active/);
        await expect(tip).toBeHidden();

        // Hold: both stages at once, and the tool must NOT change — otherwise
        // the only way to ask what a tool is would be to select it.
        await page.evaluate(() => ToolManager.selectTool('brush'));
        await touch('touchStart', [await at('eraser')]);
        await expect(tip).toBeVisible({ timeout: 3000 });
        await expect(page.locator('.app-tooltip-name')).toHaveText(/^Eraser \(E\)$/);
        await expect(page.locator('.app-tooltip-desc')).toBeVisible();
        await touch('touchEnd', []);
        expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('brush');

        // It lingers past the lift so the sentence survives the finger coming
        // off it, then clears itself.
        await expect(tip).toBeVisible();
        await expect(tip).toBeHidden({ timeout: 5000 });
    });
});
