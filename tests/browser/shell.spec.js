'use strict';
/**
 * Phase 4 "UI shell parity" TESTLOG rows — chrome/layout, sidebar order,
 * status strip, panel-collapse persistence. Presence + wiring assertions
 * against the booted DOM; visual look stays a manual concern.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('header: menu bar, language/theme/size selectors, speak toggle', async ({ page }) => {
    await boot(page);
    const menus = await page.$$eval('#menu-bar .menu-item .menu-label',
        els => els.map(e => e.textContent.trim()));
    expect(menus).toEqual(['File', 'Edit', 'View', 'Layer', 'Image', 'Settings', 'Help']);
    expect(await page.$$eval('#language-selector option', o => o.length)).toBe(13);
    expect(await page.$$eval('#theme-selector option', o => o.length)).toBe(6);
    await expect(page.locator('#font-scale-selector')).toBeAttached();
    await expect(page.locator('#tts-toggle')).toBeAttached();
});

test('top colour bar: flash, 2×8 CLUT, wells, border, attr ops; left rail = tool registry', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#flash-toggle')).toBeAttached();

    const clut = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#clut-cluster .clut-row')];
        return rows.map(r => r.querySelectorAll('.color-swatch').length);
    });
    expect(clut).toEqual([8, 8]); // ink row + paper row

    // The colour cluster, Border dropdown and attr ops live in the top
    // #color-bar; the Ink/Paper preview wells moved to #color-preview at the
    // top of the left tool rail.
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
 * However many rows the colour bar takes, each has to read as one.
 *
 * Every control is the same size, captioned above by the same mechanism
 * (Helpers.captionWrap), and sits on one --clut-cell-size pitch, so a row
 * shares a baseline and an even grid. None of that held until 2026-08-09:
 * Ink, Paper and Border carried inline labels of their own while Bright,
 * Flash, Swap and the draw modes were captioned, centring the mixture pushed
 * Bright and Flash 7px below the swatches beside them, and a caption wider
 * than its button widened that one wrapper so the icons sat at irregular
 * intervals. Geometry, because that is the only form in which "aligned" can
 * be asserted.
 */
test('every row of the colour bar sits on one baseline and one pitch',
    async ({ page }) => {
        await boot(page);

        /*
         * The bar is cut by what a control DOES: palette (which colour),
         * attrs (Bright/Flash/Border - cell/screen attributes, its own
         * sibling group so it can wrap independently of the swatches) and
         * marks (how a stroke combines). Swap and Recolour belong to marks:
         * they are attribute OPS, and they sit inline with the draw modes
         * rather than off with the swatches or with Bright/Flash/Border.
         */
        const split = await page.evaluate(() => ({
            swatchesInMarks: document.querySelectorAll('#color-bar-controls .color-swatch').length,
            marks: [...document.querySelectorAll('#color-bar-controls button')]
                .map((b) => b.id || b.dataset.drawMode),
            // Bright/Flash and Border are their own block, one palette-icon
            // pitch after the paper clut.
            attrsGroupKeeps: ['#bright-toggle', '#flash-toggle', '#border-select']
                .filter((s) => document.querySelector(`#toolbar-attrs ${s}`)).length
        }));
        expect(split.swatchesInMarks).toBe(0);
        // Draw modes first, Swap/Recolour after XOR (moved 2026-08-10).
        expect(split.marks).toEqual(['normal', 'ink', 'paper', 'pixel_only', 'xor',
            'attr-transpose', 'attr-apply']);
        expect(split.attrsGroupKeeps).toBe(3);

        // One pitch for every icon in the marks run, whatever its caption's
        // length - and they share the row's width evenly, so it fills the bar
        const pitch = await page.evaluate(() => {
            const cells = [...document.querySelectorAll(
                '#color-bar-controls .btn-captioned:not(.caption-wide)')]
                .filter((el) => el.offsetParent !== null);
            const rect = (c) => c.getBoundingClientRect();
            const row = document.getElementById('color-bar-controls').getBoundingClientRect();
            return {
                n: cells.length,
                widths: [...new Set(cells.map((c) => Math.round(rect(c).width)))],
                // How much of the row the run actually covers
                covered: (rect(cells[cells.length - 1]).right - rect(cells[0]).left) / row.width
            };
        });
        expect(pitch.n).toBe(7);                    // Swap, Recolour + 5 draw modes
        expect(pitch.widths).toHaveLength(1);
        expect(pitch.covered).toBeGreaterThan(0.98);

        /*
         * Ink and paper are ONE thing - the pair of colours a cell is made of.
         * They sit exactly one colour box apart, so they read as a pair; when
         * the cluster was spread to fill the row instead they read as two
         * unrelated palettes. The swatches inside each block stay touching,
         * because a gap between two colours reads as a boundary.
         */
        const pair = await page.evaluate(() => {
            const blocks = [...document.querySelectorAll('#clut-cluster > .btn-captioned')];
            const swatch = document.querySelector('.color-swatch').getBoundingClientRect().width;
            const between = blocks[1].getBoundingClientRect().left -
                            blocks[0].getBoundingClientRect().right;
            const inside = [...blocks[0].querySelectorAll('.clut-row .color-swatch')]
                .map((s) => s.getBoundingClientRect());
            return {
                blocks: blocks.length,
                gapInSwatches: between / swatch,
                widestInnerGap: Math.max(...inside.slice(1).map(
                    (r, i) => r.left - inside[i].right))
            };
        });
        expect(pair.blocks).toBe(2);                       // ink, paper
        expect(pair.gapInSwatches).toBeCloseTo(1, 1);      // one colour box apart
        expect(pair.widestInnerGap).toBeLessThan(4);       // and touching within a block

        const bar = await page.evaluate(() => {
            const controls = [...document.querySelectorAll(
                '#color-bar .color-swatch, #color-bar button, #color-bar select, #color-bar .clut-bit')]
                .filter((el) => el.offsetParent !== null);
            const round = (n) => Math.round(n * 10) / 10;
            // Group by the row each control wrapped onto, then report the
            // distinct top/bottom edges and heights within each row
            const rows = new Map();
            for (const el of controls) {
                const r = el.getBoundingClientRect();
                const key = round(Math.round(r.top / 40));   // coarse row bucket
                if (!rows.has(key)) rows.set(key, []);
                rows.get(key).push({ top: round(r.top), h: round(r.height) });
            }
            return [...rows.values()].map((row) => ({
                count: row.length,
                tops: [...new Set(row.map((c) => c.top))],
                heights: [...new Set(row.map((c) => c.h))]
            }));
        });

        expect(bar.length).toBeGreaterThan(0);
        for (const row of bar) {
            expect(row.count).toBeGreaterThan(1);
            // One top edge and one height per row: nothing sits high or low,
            // and no control is a different size from the swatches
            expect(row.tops).toHaveLength(1);
            expect(row.heights).toHaveLength(1);
        }

        /*
         * Bottom-aligning means a control that LOST its caption would still
         * line up, so geometry alone cannot catch that - and an inline label
         * beside the swatches is exactly what this replaced. Assert the
         * mechanism instead: every control is inside a caption wrapper, every
         * caption is the shared .btn-label, and nothing carries a label of its
         * own devising.
         */
        const captions = await page.evaluate(() => {
            const uncaptioned = [...document.querySelectorAll(
                '#color-bar .color-swatch, #color-bar button, #color-bar select, #color-bar .clut-bit')]
                .filter((el) => el.offsetParent !== null && !el.closest('.btn-captioned'))
                .map((el) => el.id || el.className);
            const labels = [...document.querySelectorAll('#color-bar .btn-label')];
            return {
                uncaptioned,
                styles: [...new Set(labels.map((l) => {
                    const cs = getComputedStyle(l);
                    return `${cs.fontSize}|${cs.fontWeight}|${cs.textAlign}`;
                }))],
                // No control may carry a label the caption mechanism did not build
                strays: document.querySelectorAll('#color-bar label:not(.clut-bit)').length
            };
        });
        expect(captions.uncaptioned).toEqual([]);
        // One distinct style, whatever the font-scale setting makes it
        expect(captions.styles).toHaveLength(1);
        expect(captions.strays).toBe(0);
    });

/*
 * The bar EARNS its second row. It is chrome above the artwork, so a row it
 * did not need is canvas the artist did not get, and whether it needs one is
 * not knowable in advance: the screen mode decides how wide the palette is (a
 * 256-entry indexed palette against a 16-colour one), and the window and the
 * interface-size setting decide how much room that has to fit in. So the bar
 * is one wrapping row, not two fixed lines - measured 2026-08-09 at scale 1
 * in en: one row from ~2200px of viewport, two below it, and one row up to
 * interface size 125%.
 */
const barRows = (page) => page.evaluate(() => {
    const tops = new Set();
    for (const el of document.querySelectorAll(
        '#color-bar .color-swatch, #color-bar button, #color-bar select, #color-bar .clut-bit')) {
        if (el.offsetParent === null) continue;
        tops.add(Math.round(el.getBoundingClientRect().top / 20));
    }
    return tops.size;
});

test.describe('the colour bar spends only the height it needs', () => {
    test.describe('given room for everything', () => {
        test.use({ viewport: { width: 2560, height: 900 } });

        test('it is a single row', async ({ page }) => {
            await boot(page);
            expect(await barRows(page)).toBe(1);
        });
    });

    test.describe('given a narrow window', () => {
        test.use({ viewport: { width: 1366, height: 900 } });

        test('it wraps, the marks group stays whole, and nothing overflows',
            async ({ page }) => {
                await boot(page);
                expect(await barRows(page)).toBeGreaterThan(1);

                // The marks run is never split: Swap, Recolour and the five
                // draw modes stay on one line together, which is the grouping
                // the whole run exists for
                const marksRows = await page.evaluate(() => {
                    const tops = new Set();
                    for (const b of document.querySelectorAll('#color-bar-controls button')) {
                        if (b.offsetParent === null) continue;
                        tops.add(Math.round(b.getBoundingClientRect().top / 20));
                    }
                    return tops.size;
                });
                expect(marksRows).toBe(1);
            });
    });
});

/*
 * ColorBarFit (js/ui/components/colorbar-fit.js): raising the interface-size
 * setting used to fragment the bar into three, four, five+ short rows well
 * before any other chrome region showed a problem, because #color-bar's own
 * icons grew with --ui-scale while the column they sit in did not (found
 * 2026-08-10). #color-bar now scales by --ui-scale times its own
 * --colorbar-scale (css/layout.css), and this component dials that second
 * factor down - independently of every other region - until the bar's
 * content fits two rows again, or the floor is reached.
 *
 * This holds across the whole interface-size range at every window width
 * tested, from 1024px up. It does NOT hold at every width for every scale
 * this component could in principle be asked to reach - #toolbar and
 * #panels are a DIFFERENT region, scaling by plain --ui-scale with no floor
 * of their own ((--toolbar-width + --panel-width) = 408px base,
 * css/variables.css), so past a high enough scale those two tracks alone
 * can exceed a narrow window and leave #color-bar's own grid column at
 * zero regardless of --colorbar-scale - no amount of shrinking inside it
 * can conjure a column that isn't there. That is exactly why the
 * interface-size selector's presets stop at 200% (85%-300% until
 * 2026-08-10, index.html): every window width from 1024px up reaches two
 * rows at every preset the selector now offers, so the impossible
 * combination is simply not reachable through it any more. A value stored
 * from before the presets were narrowed is clamped to the new max on
 * restore (js/ui/components/app-settings.js) rather than reapplying a
 * scale the selector can no longer even show as selected.
 */
test.describe('ColorBarFit keeps the bar at two rows across interface sizes', () => {
    for (const width of [1024, 1366, 1600]) {
        test.describe(`at ${width}px`, () => {
            test.use({ viewport: { width, height: 900 } });
            for (const scale of ['1.25', '1.5', '2']) {
                test(`${Math.round(scale * 100)}% still gets two rows`,
                    async ({ page }) => {
                        await boot(page);
                        await page.selectOption('#font-scale-selector', scale);
                        await page.waitForTimeout(250);
                        const result = await page.evaluate(() => {
                            const bar = document.getElementById('color-bar');
                            const tops = new Set();
                            for (const el of document.querySelectorAll(
                                '#color-bar .color-swatch, #color-bar button, #color-bar select, #color-bar .clut-bit')) {
                                if (el.offsetParent === null) continue;
                                tops.add(Math.round(el.getBoundingClientRect().top / 10));
                            }
                            return {
                                rows: tops.size,
                                hasHorizontalOverflow: bar.scrollWidth > bar.clientWidth + 1
                            };
                        });
                        expect(result.rows).toBeLessThanOrEqual(2);
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

    /*
     * A scale ColorBarFit measures as "exactly two rows" in its OWN read
     * can still paint as three on the SAME machine (found 2026-08-12, a
     * 2560x1440 display at 125% Windows scaling): its row count and the
     * browser's actual layout are two separate roundings of the same
     * fractional-device-pixel-ratio geometry, and a scale landing exactly
     * on the boundary between them has zero margin for the two to
     * disagree. ColorBarFit._margined() backs off from that edge by an
     * amount that grows with how far window.devicePixelRatio sits from a
     * whole number - fractional scaling (Windows "125%", "150%"...) is
     * exactly what produces a fractional DPR. This does not (cannot,
     * confirmed on real hardware but never reproduced by Playwright's DPR
     * emulation) prove the margin is large enough for every real display -
     * it pins that the margin EXISTS and scales with DPR, so a future
     * change cannot silently zero it out the way the original edge-exact
     * search did.
     */
    test('the safety margin actually grows at a fractional device pixel ratio',
        async ({ page }) => {
            const scaleAt = async (dpr) => {
                await page.setViewportSize({ width: 1024, height: 900 });
                // deviceScaleFactor is fixed per browser context in Playwright,
                // not settable mid-test - reload with a fresh context field
                // instead by re-navigating; simplest is two separate contexts,
                // so this drives dpr via emulation on THIS page's CDP session.
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
            // Same content, same width, same interface-size - the only
            // difference is DPR, so any gap in the settled scale is the
            // margin's own DPR term, not a coincidence of what fit.
            expect(atFractionalDpr).toBeLessThan(atIntegerDpr);
        });

    test('the indexed Next grid opts out - it scrolls by design, shrinking it would not help',
        async ({ page }) => {
            await boot(page);
            page.on('dialog', (d) => d.accept()); // classic->indexed warns (lossy)
            await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
            await page.selectOption('#font-scale-selector', '2');
            await page.waitForTimeout(250);
            const scale = await page.evaluate(() =>
                getComputedStyle(document.getElementById('color-bar'))
                    .getPropertyValue('--colorbar-scale').trim());
            expect(scale).toBe('1');
        });
});

/*
 * The colour group is NEVER wider than the bar - at any window width, any
 * interface size, in any screen mode. It wraps a swatch block onto its own
 * line rather than overflowing, so Bright, Flash and Border keep their place
 * at the right end instead of being pushed off it, and no swatch ends up
 * behind an overlay scrollbar that takes no space and announces nothing.
 * The one exception it cannot wrap is the indexed Next grid - a single
 * element ~2700px wide - which scrolls inside the group, leaving the group
 * itself within the bar.
 */
test.describe('the colour group fits the bar', () => {
    for (const width of [1024, 1366, 1600, 2560]) {
        test(`at ${width}px, in every screen mode`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await boot(page);

            const modes = await page.evaluate(
                () => Object.values(SCREEN_MODES).map((m) => m.id));
            const tooWide = [];
            for (const id of modes) {
                await page.evaluate((m) => ScreenModeService.switchMode(m), id);
                const bad = await page.evaluate((m) => {
                    const bar = document.getElementById('color-bar');
                    const group = document.getElementById('toolbar-color');
                    // offsetWidth both sides: getBoundingClientRect is scaled
                    // by the chrome's `zoom` and would not compare like for like
                    const over = group.offsetWidth - bar.clientWidth;
                    if (over > 1) return `${m}: group +${over}px`;

                    const offRight = ['#bright-toggle', '#flash-toggle', '#border-select']
                        .map((s) => document.querySelector(s))
                        .filter((el) => el && el.offsetParent &&
                            el.getBoundingClientRect().right >
                                document.documentElement.clientWidth + 0.5).length;
                    if (offRight) return `${m}: ${offRight} control(s) off screen`;

                    // ...and it fits by WRAPPING, not by hiding colours behind
                    // an overlay scrollbar. The indexed grid is the documented
                    // exception: 256 swatches in one element that cannot wrap.
                    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) return null;
                    const cluster = document.getElementById('clut-cluster');
                    const box = cluster.getBoundingClientRect();
                    const hidden = [...cluster.querySelectorAll('.color-swatch')]
                        .filter((s) => {
                            const r = s.getBoundingClientRect();
                            return r.right > box.right + 0.5 || r.left < box.left - 0.5;
                        }).length;
                    return hidden ? `${m}: ${hidden} swatch(es) out of view` : null;
                }, id);
                if (bad) tooWide.push(bad);
            }
            expect(tooWide).toEqual([]);
        });
    }
});

test('top bar: global draw-mode selector drives StateManager and persists', async ({ page }) => {
    await boot(page);

    // No attributes_only: it did the same job as the Recolour attribute op and
    // was retired with it. StateManager rejects the value, so a document saved
    // in that mode comes back Normal rather than in a mode with no way out.
    const modes = await page.$$eval('#draw-modes button[data-draw-mode]', b => b.map(x => x.dataset.drawMode));
    expect(modes).toEqual(['normal', 'ink', 'paper', 'pixel_only', 'xor']);
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

// Presets sits directly under Tool Options because it lists the presets of the
// tool whose options are above it — the two panels are one subject.
test('right sidebar order: Layers -> Tool Options -> Presets -> Patterns -> Transform -> Reference (collapsed)', async ({ page }) => {
    await boot(page);
    const panels = await page.$$eval('#panels > section', els => els.map(e => e.id));
    expect(panels).toEqual(['layer-panel', 'tool-options-panel', 'tool-preset-panel',
        'patterns-panel', 'transform-panel', 'reference-panel']);
    const refCollapsed = await page.evaluate(() =>
        window.PanelSection ? PanelSection.isCollapsed('reference-panel') : null);
    if (refCollapsed !== null) expect(refCollapsed).toBe(true);
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

test('status strip: zoom controls, grid toggles, readouts, mode selector', async ({ page }) => {
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
    const modes = await page.$$eval('#screen-mode-select option', o => o.map(x => x.value));
    expect(modes.length).toBe(14);
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
        'select-wand': 'wand',
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
