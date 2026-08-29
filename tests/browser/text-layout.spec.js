'use strict';
/**
 * Text layout, angle and mirror - the parts that need a real browser.
 *
 * The pure glyph placement is Node-tested in tests/text-layout.test.js and the
 * mask algebra in tests/text-mask-ops.test.js. What is left here is everything
 * those cannot reach: the system-font vertical path (canvas rasterization), the
 * option rows actually existing and being wired to the setters, and the round
 * trip through a floating stamp - which is where a placement is most easily
 * lost, because SelectionService re-rasterizes from the font on every scale or
 * rotation and has to hand the layout back to the tool to do it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Ink count of a bool[][] mask. */
const INK = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);

test('the tool options panel offers eight angles, four layouts and both mirrors',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const schema = TextTool.optionsSchema;
            const entry = (k) => schema.find(e => e.key === k);
            return {
                angles: entry('textDirection').options.map(o => o.value),
                layouts: entry('textLayout').options.map(o => o.value),
                hasMirrorH: !!entry('textMirrorH'),
                hasMirrorV: !!entry('textMirrorV'),
                // Every option label must be translatable; a bare English
                // string here would pass i18n-parity and still ship untranslated.
                layoutsLocalized: entry('textLayout').options.every(o => !!o.i18n)
            };
        });

        expect(r.angles).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
        expect(r.layouts).toEqual(['horizontal', 'reversed', 'vertical-down', 'vertical-up']);
        expect(r.hasMirrorH).toBe(true);
        expect(r.hasMirrorV).toBe(true);
        expect(r.layoutsLocalized).toBe(true);
    });

test('every new option has the getter/setter pair the panel and presets need',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            // window.TextTool is the CLASS (it carries the schema); the live
            // instance with the rasterizers on it comes from the registry.
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            TT().setTextLayout('vertical-up');
            TT().setTextDirection(135);
            TT().setTextMirrorH(true);
            TT().setTextMirrorV(true);
            const got = {
                layout: TT().getTextLayout(),
                direction: TT().getTextDirection(),
                mirrorH: TT().getTextMirrorH(),
                mirrorV: TT().getTextMirrorV()
            };
            // Values that no longer exist must fall back, not be forced onto
            // the nearest offered step - a preset outlives the build that
            // wrote it, and "upright" is the safe answer.
            TT().setTextLayout('diagonal-ish');
            TT().setTextDirection(37);
            return { ...got, badLayout: TT().getTextLayout(), badAngle: TT().getTextDirection() };
        });

        expect(r).toEqual({
            layout: 'vertical-up', direction: 135, mirrorH: true, mirrorV: true,
            badLayout: 'horizontal', badAngle: 0
        });
    });

test('a system font stacks into upright letters, not a rotated line', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        // window.TextTool is the CLASS (it carries the schema); the live
        // instance with the rasterizers on it comes from the registry.
        const TT = () => ToolManager.getTool(TOOLS.TEXT);
        const family = 'Arial, sans-serif';
        const flat = TT()._rasterizeWithFont('III', family, 24, false, false, 'horizontal');
        const down = TT()._rasterizeWithFont('III', family, 24, false, false, 'vertical-down');
        const up   = TT()._rasterizeWithFont('III', family, 24, false, false, 'vertical-up');
        return {
            flat: { w: flat.width, h: flat.height },
            down: { w: down.width, h: down.height },
            up:   { w: up.width,   h: up.height },
            // A stem of 'I' is tall and thin. Stacked, each one STAYS tall and
            // thin - a rotated line would make every stem wide and short.
            downPixels: down.pixels
        };
    });

    // The flat line is wider than it is tall; the column is the other way round.
    expect(r.flat.w).toBeGreaterThan(r.flat.h);
    expect(r.down.h).toBeGreaterThan(r.down.w);
    // Three copies of one glyph, so the column is three bands of the same height.
    expect(r.down.h % 3).toBe(0);
    expect(r.up).toEqual(r.down);

    // Each band must carry ink - a column with an empty third means the band
    // union was computed from one character instead of all of them.
    const band = r.down.h / 3;
    for (let i = 0; i < 3; i++) {
        expect(INK(r.downPixels.slice(i * band, (i + 1) * band))).toBeGreaterThan(0);
    }
});

test('a stacked system-font column keeps every letter on a shared baseline',
    async ({ page }) => {
        await boot(page);

        // 'x' has no ascender or descender, 'g' has a descender, 'H' is full
        // height. Trimming each letter to its own box would make all three the
        // same height; a shared band keeps their real proportions.
        const r = await page.evaluate(() => {
            // window.TextTool is the CLASS (it carries the schema); the live
            // instance with the rasterizers on it comes from the registry.
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            const m = TT()._rasterizeWithFont('Hxg', 'Arial, sans-serif', 32,
                false, false, 'vertical-down');
            const band = m.height / 3;
            const rows = (i) => m.pixels.slice(i * band, (i + 1) * band);
            const inked = (rowsIn) => rowsIn.reduce((n, r2, y) => (r2.some(Boolean) ? n.concat(y) : n), []);
            return {
                band,
                H: inked(rows(0)),
                x: inked(rows(1)),
                g: inked(rows(2))
            };
        });

        expect(Number.isInteger(r.band)).toBe(true);
        // The x-height letter must occupy strictly fewer rows of its band than
        // the cap-height letter, and start lower down it.
        expect(r.x.length).toBeLessThan(r.H.length);
        expect(r.x[0]).toBeGreaterThan(r.H[0]);
        // The descender must reach lower in its band than 'x' does in its own.
        expect(r.g[r.g.length - 1]).toBeGreaterThan(r.x[r.x.length - 1]);
    });

test('a stamp keeps its layout through a scale and a rotation', async ({ page }) => {
    await boot(page);

    // SelectionService rebuilds the mask from the font on every transform, so
    // a layout it forgets to pass back reverts the column to a line - silently,
    // and only once the artist touches a slider.
    const r = await page.evaluate(() => {
        // window.TextTool is the CLASS (it carries the schema); the live
        // instance with the rasterizers on it comes from the registry.
        const TT = () => ToolManager.getTool(TOOLS.TEXT);
        const info = {
            text: 'ABC', fontFamily: 'ZX ROM', fontSize: 8, bold: false, italic: false,
            layout: 'vertical-down', direction: 0, mirrorH: false, mirrorV: false,
            shadow: false, outline: false
        };
        const m = TT()._buildTextMask('ABC', 'ZX ROM', false, false, 'vertical-down');
        SelectionService.startFloatingPasteFromMask(
            m.pixels, m.width, m.height, 40, 40, 'Place Text', info, 'none');

        const at = () => {
            const fp = SelectionService.floatingPaste;
            return { w: fp.width, h: fp.height };
        };
        const placed = at();
        SelectionService.setStampScale(2, 2);
        const scaled = at();
        SelectionService.setStampRotation(0);
        const respun = at();
        SelectionService.cancelFloatingPaste();
        return { placed, scaled, respun };
    });

    // Taller than wide at every step: 8x24, then 16x48.
    expect(r.placed.h).toBeGreaterThan(r.placed.w);
    expect(r.scaled.h).toBeGreaterThan(r.scaled.w);
    expect(r.respun.h).toBeGreaterThan(r.respun.w);
    expect(r.scaled.h).toBeGreaterThan(r.placed.h);
});

test('a 45 degree direction turns the text and is not snapped to a quarter turn',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            // window.TextTool is the CLASS (it carries the schema); the live
            // instance with the rasterizers on it comes from the registry.
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            const m = TT()._buildTextMask('ABC', 'ZX ROM', false, false, 'horizontal');
            const box = (opts) => {
                const p = MaskOps.process(m.pixels, opts);
                return { w: p[0].length, h: p.length };
            };
            return {
                flat: box({ direction: 0 }),
                d45:  box({ direction: 45 }),
                d90:  box({ direction: 90 }),
                d135: box({ direction: 135 })
            };
        });

        // 24x8 upright, 8x24 on a quarter turn, and a near-square box on the
        // diagonals - which is exactly what a snap-to-90 would NOT produce.
        expect(r.flat).toEqual({ w: 24, h: 8 });
        expect(r.d90).toEqual({ w: 8, h: 24 });
        expect(r.d45).not.toEqual(r.d90);
        expect(r.d45).not.toEqual(r.flat);
        expect(r.d45).toEqual(r.d135);
        expect(Math.abs(r.d45.w - r.d45.h)).toBeLessThanOrEqual(1);
    });

test('mirroring a text stamp mirrors the TEXT, not the artwork under it',
    async ({ page }) => {
        await boot(page);

        // The Transform panel's Flip H/V go through TransformService, which
        // works on the layer or selection - press them with text engaged and
        // you mirror the picture underneath. The text tool's own mirrors are
        // the only ones that reach the stamp.
        const r = await page.evaluate(() => {
            // window.TextTool is the CLASS (it carries the schema); the live
            // instance with the rasterizers on it comes from the registry.
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            const m = TT()._buildTextMask('AB', 'ZX ROM', false, false, 'horizontal');
            const plain    = MaskOps.process(m.pixels, {});
            const mirrored = MaskOps.process(m.pixels, { mirrorH: true });
            const ink = (g) => g.reduce((n, row) => n + row.filter(Boolean).length, 0);
            return {
                changed: JSON.stringify(plain) !== JSON.stringify(mirrored),
                // Exact: a mirror moves pixels, it never resamples them.
                lossless: ink(plain) === ink(mirrored),
                sameBox: plain.length === mirrored.length &&
                         plain[0].length === mirrored[0].length,
                involution: JSON.stringify(MaskOps.flipH(mirrored)) === JSON.stringify(plain)
            };
        });

        expect(r.changed).toBe(true);
        expect(r.lossless).toBe(true);
        expect(r.sameBox).toBe(true);
        expect(r.involution).toBe(true);
    });

test('the rows render in the real options panel and drive the tool', async ({ page }) => {
    await boot(page);
    await page.click('#tool-rail .tool-btn[data-tool="text"]');

    const panel = '#tool-options-panel';
    // Present, labelled and in the order the panel declares them.
    await expect(page.locator(`${panel} select[data-option="textLayout"]`)).toHaveCount(1);
    await expect(page.locator(`${panel} select[data-option="textDirection"]`)).toHaveCount(1);
    await expect(page.locator(`${panel} [data-option="textMirrorH"]`)).toHaveCount(1);
    await expect(page.locator(`${panel} [data-option="textMirrorV"]`)).toHaveCount(1);

    // Localized, not raw keys or bare values.
    const labels = await page.locator(`${panel} select[data-option="textLayout"] option`).allTextContents();
    expect(labels).toEqual(['Horizontal', 'Reversed', 'Vertical, down', 'Vertical, up']);
    const angles = await page.locator(`${panel} select[data-option="textDirection"] option`).allTextContents();
    expect(angles).toEqual(['0°', '45°', '90°', '135°',
                            '180°', '225°', '270°', '315°']);

    // Changing a row must reach the tool - a select the renderer builds but
    // never wires looks completely correct and does nothing.
    await page.selectOption(`${panel} select[data-option="textLayout"]`, 'vertical-down');
    await page.selectOption(`${panel} select[data-option="textDirection"]`, '225');
    await page.check(`${panel} [data-option="textMirrorH"]`);

    const state = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        return {
            layout: tool.getTextLayout(),
            direction: tool.getTextDirection(),
            mirrorH: tool.getTextMirrorH()
        };
    });
    expect(state).toEqual({ layout: 'vertical-down', direction: 225, mirrorH: true });
});
