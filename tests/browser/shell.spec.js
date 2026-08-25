'use strict';
/**
 * Phase 4 "UI shell parity" TESTLOG rows — chrome/layout, sidebar order,
 * status strip, panel-collapse persistence. Presence + wiring assertions
 * against the booted DOM; visual look stays a manual concern.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('header: menu bar, language/size selectors, speak toggle', async ({ page }) => {
    await boot(page);
    const menus = await page.$$eval('#menu-bar .menu-item .menu-label',
        els => els.map(e => e.textContent.trim()));
    expect(menus).toEqual(['File', 'Edit', 'View', 'Layer', 'Image', 'Settings', 'Help']);
    expect(await page.$$eval('#language-selector option', o => o.length)).toBe(13);
    // Theme has no header control — Settings > Theme is the sole picker
    // (see i18n-themes.spec.js).
    await expect(page.locator('#theme-selector')).toHaveCount(0);
    await expect(page.locator('#font-scale-selector')).toBeAttached();
    await expect(page.locator('#tts-toggle')).toBeAttached();
});

test('colour rail: flash, 2×8 CLUT; left rail = tool registry; top strip keeps border + attr ops', async ({ page }) => {
    await boot(page);
    // Bright/Flash and the swatch cluster live in the vertical colour rail
    // between the tool rail and the canvas, not the top strip (2026-08-25).
    await expect(page.locator('#color-rail #flash-toggle')).toBeAttached();

    const clut = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#clut-cluster .clut-row')];
        return rows.map(r => r.querySelectorAll('.color-swatch').length);
    });
    expect(clut).toEqual([8, 8]); // ink row + paper row

    // The Ink/Paper preview wells live in #color-preview at the top of the
    // left tool rail; Border and the attr ops (Swap/Recolour) stay on the
    // top #color-bar strip.
    const rail = await page.evaluate(() => ({
        wells: [...document.querySelectorAll('#color-preview .color-swatch[role="button"]')].length,
        selects: [...document.querySelectorAll('#color-bar select')].length,
        attrOps: [...document.querySelectorAll('#attr-tools button')].length
    }));
    expect(rail.wells).toBeGreaterThanOrEqual(2);
    expect(rail.selects).toBeGreaterThanOrEqual(1);
    expect(rail.attrOps).toBeGreaterThanOrEqual(2); // Swap + Apply (cycle buttons removed 2026-07-08)

    // Tool rail is generated from the TOOLS registry — assert it matches.
    // `variantOf` entries are reached from another tool's options (the bezier
    // curve, from the Shape list), so they are registry rows without a button.
    const tools = await page.evaluate(() => ({
        rail: [...document.querySelectorAll('#tool-rail button[data-tool]')].map(b => b.dataset.tool),
        registry: (window.TOOL_GROUPS || []).flatMap(
            g => (g.tools || []).filter(t => !t.variantOf).map(t => t.id || t))
    }));
    expect(tools.rail.length).toBeGreaterThanOrEqual(13);
    if (tools.registry.length) {
        expect(tools.rail).toEqual(tools.registry);
    }
});

/*
 * The top strip (#color-bar) now carries only Border and the marks group
 * (draw modes, Mirror, Swap/Recolour) — the palette cluster moved to
 * #color-rail 2026-08-25 (see tests/browser/color-rail.spec.js). Every
 * control here is still the same size and sits on one baseline.
 */
test('every row of the top strip sits on one baseline and one pitch', async ({ page }) => {
    await boot(page);

    const split = await page.evaluate(() => ({
        swatchesInMarks: document.querySelectorAll('#color-bar-controls .color-swatch').length,
        swatchesInColorBar: document.querySelectorAll('#color-bar .color-swatch').length,
        marks: [...document.querySelectorAll('#color-bar-controls button')]
            .map((b) => b.id || b.dataset.drawMode),
        attrsGroupKeeps: ['#border-select'].filter((s) => document.querySelector(`#toolbar-attrs ${s}`)).length,
        bitsMovedOut: ['#bright-toggle', '#flash-toggle'].filter((s) => document.querySelector(`#toolbar-attrs ${s}`)).length
    }));
    expect(split.swatchesInMarks).toBe(0);
    expect(split.swatchesInColorBar).toBe(0); // no swatches on the top strip at all now
    expect(split.marks).toEqual(['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel',
        'symmetry-h-toggle', 'symmetry-v-toggle', 'symmetry-quad-toggle',
        'attr-transpose', 'attr-apply']);
    expect(split.attrsGroupKeeps).toBe(1); // just Border now
    expect(split.bitsMovedOut).toBe(0);    // Bright/Flash live in #color-rail

    const pitch = await page.evaluate(() => {
        const label = document.getElementById('marks-group-label');
        const cells = [...document.querySelectorAll('#marks-icons-row button')]
            .filter((el) => el.offsetParent !== null);
        const rect = (c) => c.getBoundingClientRect();
        return {
            n: cells.length,
            widths: [...new Set(cells.map((c) => Math.round(rect(c).width)))],
            labelText: label ? label.textContent.trim() : null,
            labelAboveIcons: label ? rect(label).bottom <= rect(cells[0]).top + 1 : false
        };
    });
    expect(pitch.n).toBe(11);        // Swap, Recolour + 6 draw modes + 3 mirror toggles
    expect(pitch.widths).toHaveLength(1);
    expect(pitch.labelText).toBeTruthy();
    expect(pitch.labelAboveIcons).toBe(true);

    const bar = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('#color-bar button, #color-bar select')]
            .filter((el) => el.offsetParent !== null);
        const round = (n) => Math.round(n * 10) / 10;
        const rows = new Map();
        for (const el of controls) {
            const r = el.getBoundingClientRect();
            const key = round(Math.round(r.top / 40));
            if (!rows.has(key)) rows.set(key, []);
            rows.get(key).push({ top: round(r.top), h: round(r.height) });
        }
        return [...rows.values()].map((row) => ({
            count: row.length,
            tops: [...new Set(row.map((c) => c.top))],
            heights: [...new Set(row.map((c) => c.h))]
        }));
    });

    expect(bar.length).toBe(1); // ALWAYS exactly one row now
    for (const row of bar) {
        expect(row.count).toBeGreaterThan(1);
        expect(row.tops).toHaveLength(1);
        expect(row.heights).toHaveLength(1);
    }

    const captions = await page.evaluate(() => {
        const uncaptioned = [...document.querySelectorAll('#color-bar button, #color-bar select')]
            .filter((el) => el.offsetParent !== null && !el.closest('#marks-icons-row')
                && !el.closest('.btn-captioned'))
            .map((el) => el.id || el.className);
        const labels = [...document.querySelectorAll('#color-bar .btn-label')];
        const groupLabel = document.getElementById('marks-group-label');
        const styleOf = (l) => {
            const cs = getComputedStyle(l);
            return `${cs.fontSize}|${cs.fontWeight}|${cs.textAlign}`;
        };
        const marksIconsCaptioned = [...document.querySelectorAll('#marks-icons-row button')]
            .filter((el) => el.offsetParent !== null && el.closest('.btn-captioned'))
            .map((el) => el.id || el.className);
        return {
            uncaptioned,
            styles: [...new Set(labels.map(styleOf))],
            groupLabelStyle: groupLabel ? styleOf(groupLabel) : null,
            marksIconsCaptioned,
            strays: document.querySelectorAll('#color-bar label:not(.clut-bit)').length
        };
    });
    expect(captions.uncaptioned).toEqual([]);
    expect(captions.styles).toHaveLength(1);
    expect(captions.groupLabelStyle).toBe(captions.styles[0]);
    expect(captions.marksIconsCaptioned).toEqual([]);
    expect(captions.strays).toBe(0);
});

/*
 * The top strip is now small enough (Border + 11 marks icons) that
 * ColorBarFit's job changed from "keep it to two rows" to "keep it to
 * exactly one, always" — see js/ui/components/colorbar-fit.js. Unlike the
 * old two-row bar, there is no width at which a second row is acceptable.
 */
const barRows = (page) => page.evaluate(() => {
    const tops = new Set();
    for (const el of document.querySelectorAll('#color-bar button, #color-bar select')) {
        if (el.offsetParent === null) continue;
        tops.add(Math.round(el.getBoundingClientRect().top / 20));
    }
    return tops.size;
});

test.describe('the top strip is always exactly one row', () => {
    for (const width of [1024, 1366, 1600, 2560]) {
        test(`at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await boot(page);
            expect(await barRows(page)).toBe(1);
        });
    }
});

/*
 * The one-row guarantee is exercised above only in the boot default (classic
 * fixed16). Since the palette moved out of #color-bar (2026-08-25), a screen-
 * mode switch no longer changes what #color-bar itself contains — but
 * ColorBarFit re-measures on EVENTS.SCREEN_MODE_CHANGED (js/ui/components/
 * colorbar-fit.js), and #toolbar-attrs (Border) does gain/lose content across
 * modes nothing here had covered switching TO.
 */
test('the top strip stays exactly one row after switching screen mode', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept()); // lossy mode-switch confirm
    await page.evaluate(() => ScreenModeService.switchMode('ula_plus'));
    expect(await barRows(page)).toBe(1);
});

/*
 * ColorBarFit (js/ui/components/colorbar-fit.js): the top strip must never
 * wrap to a second row, at any interface-size setting or window width from
 * 1024px up. This is the same shrink-only binary search the bar always
 * used, just retargeted from "fits two rows" to "fits one, always" now that
 * the palette cluster (the thing that used to make two rows necessary)
 * lives in #color-rail instead — see docs/superpowers/specs/
 * 2026-08-25-colour-rail-design.md.
 *
 * As before, this does NOT hold at every width for every scale this
 * component could in principle be asked to reach — #toolbar, #color-rail
 * and #panels are different regions with no floor of their own, so past a
 * high enough combined width those tracks alone can exceed a narrow window
 * and leave #color-bar's own grid column at zero regardless of
 * --colorbar-scale. That is exactly why the interface-size selector's
 * presets stop at 200%.
 */
test.describe('ColorBarFit keeps the top strip at one row across interface sizes', () => {
    for (const width of [1024, 1366, 1600]) {
        test.describe(`at ${width}px`, () => {
            test.use({ viewport: { width, height: 900 } });
            for (const scale of ['1.25', '1.5', '2']) {
                test(`${Math.round(scale * 100)}% still gets one row`,
                    async ({ page }) => {
                        await boot(page);
                        await page.selectOption('#font-scale-selector', scale);
                        await page.waitForTimeout(250);
                        const result = await page.evaluate(() => {
                            const bar = document.getElementById('color-bar');
                            const tops = new Set();
                            for (const el of document.querySelectorAll('#color-bar button, #color-bar select')) {
                                if (el.offsetParent === null) continue;
                                tops.add(Math.round(el.getBoundingClientRect().top / 10));
                            }
                            return {
                                rows: tops.size,
                                hasHorizontalOverflow: bar.scrollWidth > bar.clientWidth + 1
                            };
                        });
                        expect(result.rows).toBe(1);
                        expect(result.hasHorizontalOverflow).toBe(false);
                    });
            }
        });
    }

    test('the selector offers nothing above 200%, and a stale stored value above it is clamped down',
        async ({ page }) => {
            await boot(page);
            const values = await page.$$eval('#font-scale-selector option', o => o.map(x => x.value));
            expect(values.map(Number)).toEqual(expect.arrayContaining([0.85, 1, 1.25, 1.5, 2]));
            expect(Math.max(...values.map(Number))).toBe(2);

            await page.evaluate(() => Storage.set('uiFontScale', '3'));
            await reload(page);
            const after = await page.evaluate(() => ({
                selector: document.getElementById('font-scale-selector').value,
                uiScale: getComputedStyle(document.documentElement)
                    .getPropertyValue('--ui-scale').trim()
            }));
            expect(after.selector).toBe('2');
            expect(after.uiScale).toBe('2');
        });

    test('the safety margin actually grows at a fractional device pixel ratio',
        async ({ page }) => {
            const scaleAt = async (dpr) => {
                await page.setViewportSize({ width: 1024, height: 900 });
                const client = await page.context().newCDPSession(page);
                await client.send('Emulation.setDeviceMetricsOverride', {
                    width: 1024, height: 900, deviceScaleFactor: dpr, mobile: false
                });
                await boot(page);
                await page.selectOption('#font-scale-selector', '2');
                await page.waitForTimeout(300);
                return parseFloat(await page.evaluate(() =>
                    getComputedStyle(document.getElementById('color-bar'))
                        .getPropertyValue('--colorbar-scale').trim()));
            };
            const atIntegerDpr = await scaleAt(1);
            const atFractionalDpr = await scaleAt(1.25);
            expect(atFractionalDpr).toBeLessThan(atIntegerDpr);
        });
});

test('top bar: global draw-mode selector drives StateManager and persists', async ({ page }) => {
    await boot(page);

    // No attributes_only: it did the same job as the Recolour attribute op and
    // was retired with it. StateManager rejects the value, so a document saved
    // in that mode comes back Normal rather than in a mode with no way out.
    const modes = await page.$$eval('#draw-modes button[data-draw-mode]', b => b.map(x => x.dataset.drawMode));
    expect(modes).toEqual(['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel']);
    const retired = await page.evaluate(() => {
        StateManager.setDrawMode('attributes_only');
        return StateManager.getDrawMode();
    });
    expect(retired).toBe('normal');

    // Draw mode is now global — no per-tool "Draw Mode" option survives.
    const perTool = await page.evaluate(() => ['BrushTool', 'ShapeTool', 'FillTool']
        .filter(n => window[n] && (window[n].optionsSchema || []).some(o => o.key === 'drawMode')));
    expect(perTool).toEqual([]);

    await page.click('#draw-modes button[data-draw-mode="xor"]');
    const st = await page.evaluate(() => ({
        dm: StateManager.getDrawMode(),
        active: document.querySelector('#draw-modes button.active')?.dataset.drawMode
    }));
    expect(st.dm).toBe('xor');
    expect(st.active).toBe('xor');

    await reload(page);
    const after = await page.evaluate(() => StateManager.getDrawMode());
    expect(after).toBe('xor'); // persisted across F5
});

/* A draw mode that cannot be seen is a trap: in Paper Recolour every tool
   paints paper on paper, which reads as "nothing works". The bar used to sit
   off the right edge of the colour bar on any window narrower than its ~1500px
   of content, behind an auto-hiding scrollbar. */
test.describe('the global draw mode can never hide', () => {
    test.use({ viewport: { width: 1366, height: 900 } });

    test('the selector stays on screen on a narrow window, and the status bar names it', async ({ page }) => {
        await boot(page);

        // Every mode button is inside the viewport — the bar wraps, not scrolls.
        const offscreen = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            return [...document.querySelectorAll('#draw-modes button[data-draw-mode]')]
                .filter(b => { const r = b.getBoundingClientRect(); return r.right > vw || r.left < 0; })
                .map(b => b.dataset.drawMode);
        });
        expect(offscreen).toEqual([]);

        // Normal is the quiet default: no readout.
        await expect(page.locator('#draw-mode-status')).toBeHidden();

        await page.click('#draw-modes button[data-draw-mode="paper"]');
        await expect(page.locator('#draw-mode-status')).toBeVisible();
        await expect(page.locator('#draw-mode-status')).toContainText('Paper Recolour');

        // The mode persists across F5, so the warning has to come back with it.
        await reload(page);
        await expect(page.locator('#draw-mode-status')).toContainText('Paper Recolour');

        // Preference off (the default): picking a tool leaves the mode alone.
        await page.click('#tool-rail .tool-btn[data-tool="fill"]');
        expect(await page.evaluate(() => StateManager.getDrawMode())).toBe('paper');

        // Preference on: picking a tool returns to Normal and clears the readout.
        await page.evaluate(() => StateManager.set('resetDrawModeOnTool', true));
        await page.click('#tool-rail .tool-btn[data-tool="brush"]');
        expect(await page.evaluate(() => StateManager.getDrawMode())).toBe('normal');
        await expect(page.locator('#draw-mode-status')).toBeHidden();
    });
});

// Reference leads because it is set up once at the start of a picture.
// Presets is last and preference-gated (Preferences > General, off by
// default), so it stays in the DOM (for its own specs) but is not laid out
// unless that preference is on.
test('right sidebar order: Reference -> Layers -> Tool Options -> Patterns -> Transform -> Presets (collapsed)', async ({ page }) => {
    await boot(page);
    const panels = await page.$$eval('#panels > section', els => els.map(e => e.id));
    expect(panels).toEqual(['reference-panel', 'layer-panel', 'tool-options-panel',
        'patterns-panel', 'transform-panel', 'tool-preset-panel']);
    const refCollapsed = await page.evaluate(() =>
        window.PanelSection ? PanelSection.isCollapsed('reference-panel') : null);
    if (refCollapsed !== null) expect(refCollapsed).toBe(true);
    // Off by default, so the Presets panel takes up no room in the sidebar
    expect(await page.evaluate(() =>
        getComputedStyle(document.getElementById('tool-preset-panel')).display)).toBe('none');
});

test('panel collapse state persists across F5 (WINDOW_STATE)', async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() => {
        const was = PanelSection.isCollapsed('transform-panel');
        PanelSection.setCollapsed('transform-panel', !was);
        return !was;
    });
    await page.waitForTimeout(300); // persistence debounce
    await reload(page);
    const after = await page.evaluate(() => PanelSection.isCollapsed('transform-panel'));
    expect(after).toBe(before);
});

test('panel visibility (whole-panel add/remove) persists across F5 (WINDOW_STATE)', async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() => {
        const was = PanelSection.isVisible('layer-panel');
        PanelSection.setVisible('layer-panel', !was);
        return !was;
    });
    await page.waitForTimeout(300); // persistence debounce
    await reload(page);
    const after = await page.evaluate(() => PanelSection.isVisible('layer-panel'));
    expect(after).toBe(before);
});

test('status strip: zoom controls, grid toggles, readouts', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#zoom-out')).toBeAttached();
    await expect(page.locator('#zoom-in')).toBeAttached();
    await expect(page.locator('#zoom-fit')).toBeAttached();
    await expect(page.locator('#zoom-level')).toBeAttached();
    for (const id of ['grid-1x1-toggle', 'grid-8x8-toggle', 'grid-16x16-toggle', 'grid-snap-toggle']) {
        await expect(page.locator('#' + id)).toBeAttached();
    }
    await expect(page.locator('#cursor-position')).toBeAttached();
    await expect(page.locator('#canvas-size')).toHaveText(/256\s*×\s*192/);
});

test('zoom in/out/fit buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const cases = [
        { id: '#zoom-out', hintKey: 'view.zoomOut.hint', shortcut: '-' },
        { id: '#zoom-in', hintKey: 'view.zoomIn.hint', shortcut: '+' },
        { id: '#zoom-fit', hintKey: 'view.zoomFit.hint', shortcut: null }
    ];
    for (const { id, hintKey, shortcut } of cases) {
        const title = await page.getAttribute(id, 'title');
        expect(title).toBeTruthy();
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
        const expectedHint = await page.evaluate((k) => window.I18n.t(k), hintKey);
        expect(desc).toBe(expectedHint);
        if (shortcut) expect(name).toContain(`(${shortcut})`);
    }
});

test('Image > Screen Mode lists every registered mode as a radio', async ({ page }) => {
    await boot(page);
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action--parent[data-id="screen-mode"]');
    const modes = await page.$$eval('.menu-action[data-id^="mode-"]', els => els.map(e => e.dataset.id));
    expect(modes.length).toBe(14);
    await page.keyboard.press('Escape');
});

test('drawing guide: toggle confines every tool to the selection, and persists', async ({ page }) => {
    await boot(page);

    const guide = page.locator('#clip-inside-toggle');
    const protectBtn = page.locator('#clip-outside-toggle');
    await expect(guide).toBeAttached();
    await expect(protectBtn).toBeAttached();

    // The rail paints its lit state from .active, so assert the CLASS, not just
    // aria-pressed: checking the ARIA alone passes happily on a button that
    // renders completely dead, which is exactly how this shipped once.
    const lit = async (loc) => (await loc.getAttribute('class') || '').split(/\s+/).includes('active');
    expect(await guide.getAttribute('aria-pressed')).toBe('false');
    expect(await lit(guide), 'starts unlit').toBe(false);

    // A selection plus the guide on: the brush may not paint outside it.
    await page.evaluate(() => {
        SelectionService.setSelection({ x: 40, y: 40, width: 8, height: 8 });
    });
    await guide.click();
    expect(await guide.getAttribute('aria-pressed')).toBe('true');
    expect(await lit(guide), 'lights when armed').toBe(true);

    const paint = (x, y) => page.evaluate(([px, py]) => {
        UndoRedo.beginAction('guide-test');
        PixelDrawRoutine.draw(px, py, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
        return PixelDrawRoutine.getPixelState(px, py)?.isInk === true;
    }, [x, y]);

    expect(await paint(43, 43), 'inside the guide paints').toBe(true);
    expect(await paint(80, 80), 'outside the guide is blocked').toBe(false);

    // The fill tool inherits containment from the same seam — it is the gate,
    // not the tool, that enforces it. A flood from far outside the region is
    // CONTAINED, not merely suppressed: it stops at the barrier and still
    // fills what lies within it.
    await page.evaluate(() => {
        UndoRedo.beginAction('guide-fill');
        ToolManager.selectTool('fill');
        ToolManager.getCurrentTool().onPointerDown(120, 120, { button: 0 });
        UndoRedo.endAction();
    });
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(120, 120)?.isInk === true),
        'the flood never escapes the barrier').toBe(false);
    expect(await page.evaluate(() =>
        PixelDrawRoutine.getPixelState(45, 45)?.isInk === true),
        'but it does fill inside it').toBe(true);

    // Wipe between phases (suspended, so the guide cannot block the wipe).
    const clearCanvas = () => page.evaluate(() => {
        UndoRedo.beginAction('wipe');
        PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
        UndoRedo.endAction();
    });
    await clearCanvas();

    // Out is the frisket: the same region, opposite polarity. Exclusive with
    // In, exactly like the mirror group.
    await protectBtn.click();
    expect(await guide.getAttribute('aria-pressed')).toBe('false');
    expect(await protectBtn.getAttribute('aria-pressed')).toBe('true');
    expect(await lit(guide), 'In unlights when Out takes over').toBe(false);
    expect(await lit(protectBtn), 'Out lights').toBe(true);
    expect(await paint(44, 44), 'inside is now protected').toBe(false);
    expect(await paint(81, 81), 'outside now paints').toBe(true);

    // Clicking the active mode turns the guide off entirely.
    await protectBtn.click();
    expect(await page.evaluate(() => StateManager.getClipMode())).toBe('off');
    expect(await lit(guide) || await lit(protectBtn), 'neither lit when off').toBe(false);
    expect(await paint(82, 82), 'guide off paints anywhere').toBe(true);

    // The guide is a mode, not a tool: switching tools must not un-press it.
    // _sync() renders tool active-state across every .tool-btn, and the guide
    // toggles share that class — without a data-tool guard it silently cleared
    // them on the next tool click and at boot.
    await guide.click();
    await page.click('.tool-btn[data-tool="hatch"]');
    expect(await guide.getAttribute('aria-pressed'),
        'guide survives a tool switch').toBe('true');
    expect(await lit(guide), 'and stays lit through it').toBe(true);
    expect(await page.evaluate(() => StateManager.getClipMode())).toBe('inside');

    // Survives a reload under its own Storage key.
    await page.reload();
    await page.waitForSelector('html[data-app-ready]');
    expect(await page.locator('#clip-inside-toggle').getAttribute('aria-pressed')).toBe('true');
    expect(await lit(page.locator('#clip-inside-toggle')), 'lit after reload').toBe(true);
    expect(await page.evaluate(() => StateManager.getClipMode())).toBe('inside');
});

test('selection modes are one-click rail buttons that drive the one SelectionTool', async ({ page }) => {
    await boot(page);

    const modes = {
        'select-lasso': 'freeform',
        'select-ellipse': 'ellipse',
        'select-cell': 'cell'
    };
    for (const [id, mode] of Object.entries(modes)) {
        expect(await page.locator(`.tool-btn[data-tool="${id}"]`).count(), `${id} exists`).toBe(1);
        await page.click(`.tool-btn[data-tool="${id}"]`);
        expect(await page.evaluate(() => ToolManager.getCurrentTool().id)).toBe('selection');
        expect(await page.evaluate(() => ToolManager.getTool('selection')._selectMode)).toBe(mode);
    }

    // The base Select button is the rectangle marquee, so it returns there
    // rather than silently keeping the last mode behind an icon that says otherwise.
    await page.click('.tool-btn[data-tool="selection"]');
    expect(await page.evaluate(() => ToolManager.getTool('selection')._selectMode)).toBe('rectangle');
});

test('ellipse selection commits a round mask, not its bounding box', async ({ page }) => {
    await boot(page);

    const shape = await page.evaluate(() => {
        const sel = ToolManager.getTool('selection')
            ._rasterizeEllipse({ x: 8, y: 8, width: 32, height: 32 });
        if (!sel || !sel.mask) return null;
        let on = 0;
        for (const row of sel.mask) for (const v of row) if (v) on++;
        return {
            corner: sel.mask[0][0],
            centre: sel.mask[16][16],
            widestRow: sel.mask[16][1],
            coverage: on / (sel.width * sel.height)
        };
    });

    expect(shape, 'ellipse rasterised').not.toBeNull();
    expect(shape.corner, 'corners fall outside the ellipse').toBe(false);
    expect(shape.centre, 'the centre is inside').toBe(true);
    expect(shape.widestRow, 'the widest row reaches the edge').toBe(true);
    // A circle covers pi/4 of its bounding box; allow for rasterisation.
    expect(shape.coverage).toBeGreaterThan(0.72);
    expect(shape.coverage).toBeLessThan(0.82);
});
