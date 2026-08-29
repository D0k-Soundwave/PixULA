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

// -- Multi-line ---------------------------------------------------------------
// The bitmap path is Node-tested in tests/text-layout.test.js. What needs a
// real browser is the vector path: canvas fillText does not break lines, so
// before 2026-08-30 everything typed came out as one line however many times
// Enter was pressed.
//
// A SINGLE family name, never a CSS list - _rasterizeRaw builds the font string
// by quoting the family, so a list becomes one family nobody has and canvas
// falls back silently.
const FAMILY = 'Arial';
const NL = String.fromCharCode(10);

test('a system font renders two lines, not one', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(([family, nl]) => {
        const TT = () => ToolManager.getTool(TOOLS.TEXT);
        // INK() lives in the Node scope; this callback runs in the browser.
        const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
        const one  = TT()._rasterizeWithFont('AB', family, 24, false, false, 'horizontal', 'left');
        const two  = TT()._rasterizeWithFont('AB' + nl + 'AB', family, 24, false, false, 'horizontal', 'left');
        const wide = TT()._rasterizeWithFont('AB' + nl + 'ABCDEF', family, 24, false, false, 'horizontal', 'left');
        const long = TT()._rasterizeWithFont('ABCDEF', family, 24, false, false, 'horizontal', 'left');
        return {
            one:  { w: one.width, h: one.height, ink: ink(one.pixels) },
            two:  { w: two.width, h: two.height, ink: ink(two.pixels) },
            wide: { w: wide.width },
            long: { w: long.width }
        };
    }, [FAMILY, NL]);

    // Two lines of the same text: taller, no wider, and twice the ink.
    expect(r.two.h).toBeGreaterThan(r.one.h);
    expect(r.two.w).toBe(r.one.w);
    expect(r.two.ink).toBe(r.one.ink * 2);
    // The block is as wide as its longest line, not the two concatenated.
    expect(r.wide.w).toBe(r.long.w);
});

test('lines of differing height stay on a shared vertical datum', async ({ page }) => {
    await boot(page);

    // The discriminating case. A tall stem has more ascent than a round
    // lowercase letter, so if every line keeps the common top-baseline origin
    // the second line's ink starts LESS than one advance below the first's.
    // Trimming each line to its own ink before stacking - the obvious
    // implementation, and the wrong one - puts both tops flush and makes the
    // gap exactly one advance.
    const r = await page.evaluate(([family, nl]) => {
        const TT = () => ToolManager.getTool(TOOLS.TEXT);
        const size = 32;
        const m = TT()._rasterizeWithFont('oo' + nl + 'll', family, size, false, false, 'horizontal', 'left');
        const inkFrom = (from) => {
            for (let y = from; y < m.height; y++) if (m.pixels[y].some(Boolean)) return y;
            return -1;
        };
        const first = inkFrom(0);
        let y = first;
        while (y < m.height && m.pixels[y].some(Boolean)) y++;
        return { first, second: inkFrom(y), advance: Math.round(size * 1.2) };
    }, [FAMILY, NL]);

    expect(r.first).toBe(0);                    // the block is trimmed to its ink
    expect(r.second).toBeGreaterThan(0);        // there really are two lines
    expect(r.second).toBeLessThan(r.advance);   // shared datum, not per-line trims
});

test('alignment moves the short line, and does not resize the block',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(([family, nl]) => {
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            const text = 'i' + nl + 'MMMM';   // line 1 is the one with slack
            const edge = (align) => {
                const m = TT()._rasterizeWithFont(text, family, 24, false, false, 'horizontal', align);
                let min = m.width;
                for (let y = 0; y < 10; y++) {            // safely inside line 1
                    for (let x = 0; x < m.width; x++) if (m.pixels[y][x] && x < min) min = x;
                }
                return { min, w: m.width };
            };
            return { left: edge('left'), center: edge('center'), right: edge('right') };
        }, [FAMILY, NL]);

        expect(r.left.min).toBeLessThan(r.center.min);
        expect(r.center.min).toBeLessThan(r.right.min);
        // Within a pixel or two, not exactly equal: `_rasterizeRaw` pads each
        // line by 2px, so a short line pushed to the far edge can carry its
        // ink a pixel past where the long line's own ink was trimmed to.
        expect(Math.abs(r.center.w - r.left.w)).toBeLessThanOrEqual(2);
        expect(Math.abs(r.right.w - r.left.w)).toBeLessThanOrEqual(2);
    });

test('a multi-line stamp keeps its lines through a scale and a rotation',
    async ({ page }) => {
        await boot(page);

        // The path that loses things: SelectionService re-rasterises from
        // fontInfo on every transform, and rotation alone is served by
        // _renderThrough, which draws with fillText and so needs the lines
        // handed to it too.
        const r = await page.evaluate(([family, nl]) => {
            const TT = () => ToolManager.getTool(TOOLS.TEXT);
            const text = 'AB' + nl + 'AB';
            const info = {
                text, fontFamily: family, fontSize: 24, bold: false, italic: false,
                layout: 'horizontal', align: 'left', direction: 0,
                mirrorH: false, mirrorV: false, shadow: false, outline: false
            };
            const m = TT()._rasterizeWithFont(text, family, 24, false, false, 'horizontal', 'left');
            const single = TT()._rasterizeWithFont('AB', family, 24, false, false, 'horizontal', 'left');
            SelectionService.startFloatingPasteFromMask(
                m.pixels, m.width, m.height, 40, 40, 'Place Text', info, 'none');

            const ratio = () => {
                const fp = SelectionService.floatingPaste;
                return fp.height / fp.width;
            };
            const placed = ratio();
            SelectionService.setStampScale(2, 2);
            const scaled = ratio();
            SelectionService.setStampRotation(45);
            const spun = SelectionService.floatingPaste.pixels.length;
            SelectionService.cancelFloatingPaste();
            return { placed, scaled, spun, single: single.height / single.width };
        }, [FAMILY, NL]);

        // Two lines are proportionally much taller than one; if a transform
        // dropped the newline the block would collapse to the single-line
        // aspect ratio.
        expect(r.placed).toBeGreaterThan(r.single * 1.5);
        expect(r.scaled).toBeGreaterThan(r.single * 1.5);
        expect(r.spun).toBeGreaterThan(0);
    });

test('the alignment row exists, is translatable, and drives the tool',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const entry = TextTool.optionsSchema.find(e => e.key === 'textAlign');
            const tool = ToolManager.getTool(TOOLS.TEXT);
            tool.setTextAlign('right');
            const got = tool.getTextAlign();
            tool.setTextAlign('nonsense');
            const fallback = tool.getTextAlign();
            tool.setTextAlign('left');
            return {
                values: entry ? entry.options.map(o => o.value) : null,
                localized: entry ? entry.options.every(o => !!o.i18n) : false,
                labelKey: entry ? entry.i18n : null,
                got, fallback,
                // It must ride on fontInfo or a re-raster reverts it.
                onFontInfo: Object.prototype.hasOwnProperty.call(tool._effectOpts(), 'align')
            };
        });

        expect(r.values).toEqual(['left', 'center', 'right']);
        expect(r.localized).toBe(true);
        expect(r.labelKey).toBe('opt.align');
        expect(r.got).toBe('right');
        expect(r.fallback).toBe('left');
        expect(r.onFontInfo).toBe(true);
    });

test('typing two lines into the box produces a two-line stamp', async ({ page }) => {
    await boot(page);

    // The artist's actual path: the textarea sets the text, and the tool builds
    // its own preview stamp. Everything above this drives the rasterisers
    // directly, so this is the one check that the newline survives the whole
    // way from the option row to a floating stamp.
    const r = await page.evaluate((nl) => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        ToolManager.selectTool(TOOLS.TEXT);
        tool.setFontFamily('ZX ROM');
        tool.setTextSize(8);

        const place = (text) => {
            if (SelectionService.floatingPaste) SelectionService.cancelFloatingPaste();
            tool.setText(text);
            tool._createPreviewStamp(120, 90);
            const fp = SelectionService.floatingPaste;
            return fp ? { w: fp.width, h: fp.height } : null;
        };
        const one = place('AB');
        const two = place('AB' + nl + 'CD');
        if (SelectionService.floatingPaste) SelectionService.cancelFloatingPaste();
        return { one, two };
    }, String.fromCharCode(10));

    expect(r.one).toEqual({ w: 16, h: 8 });
    // Two 8x8 rows of two glyphs: same width, twice the height.
    expect(r.two).toEqual({ w: 16, h: 16 });
});
