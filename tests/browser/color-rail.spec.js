'use strict';
/**
 * The vertical colour rail (#color-rail): every screen mode's palette
 * swatches, between the tool rail and the drawing area. See
 * docs/superpowers/specs/2026-08-25-colour-rail-design.md.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('the colour rail exists between the tool rail and the canvas, and holds the palette + bits', async ({ page }) => {
    await boot(page);

    const structure = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        const toolbar = document.getElementById('toolbar');
        const canvasArea = document.getElementById('canvas-area');
        const colorBar = document.getElementById('color-bar');
        return {
            railExists: !!rail,
            toolbarColorInRail: rail ? rail.contains(document.getElementById('toolbar-color')) : false,
            colourBitsInRail: rail ? rail.contains(document.getElementById('colour-bits')) : false,
            toolbarColorInColorBar: colorBar ? colorBar.contains(document.getElementById('toolbar-color')) : false,
            colourBitsInColorBar: colorBar ? colorBar.contains(document.getElementById('colour-bits')) : false,
            borderHostInColorBar: colorBar ? colorBar.contains(document.getElementById('border-host')) : false,
            toolbarLeftOfRail: toolbar && rail
                ? toolbar.getBoundingClientRect().right <= rail.getBoundingClientRect().left
                : false,
            railLeftOfCanvas: rail && canvasArea
                ? rail.getBoundingClientRect().right <= canvasArea.getBoundingClientRect().left
                : false
        };
    });
    expect(structure.railExists).toBe(true);
    expect(structure.toolbarColorInRail).toBe(true);
    expect(structure.colourBitsInRail).toBe(true);
    expect(structure.toolbarColorInColorBar).toBe(false);
    expect(structure.colourBitsInColorBar).toBe(false);
    expect(structure.borderHostInColorBar).toBe(true);
    expect(structure.toolbarLeftOfRail).toBe(true);
    expect(structure.railLeftOfCanvas).toBe(true);
});

/*
 * Ink and paper are ONE thing - the pair of colours a cell is made of - so
 * in the vertical rail they stack with a gap between the groups, reading as
 * a column the way the old horizontal bar read as a row. Each 8-swatch
 * block is a fixed ONE-column list (not a grid), scrolling rather than
 * spending rail width on a second column, and every swatch is the same
 * fixed size regardless of screen mode.
 */
test('classic mode: Ink then Paper stack vertically in the rail, each a fixed one-column list', async ({ page }) => {
    await boot(page);

    const layout = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('#clut-cluster > .btn-captioned')];
        const inkRow = blocks[0].querySelector('.clut-row');
        const swatches = [...inkRow.querySelectorAll('.color-swatch')];
        const rects = swatches.map((s) => s.getBoundingClientRect());
        return {
            blocks: blocks.length,
            inkAboveOrLeftOfPaper: blocks[0].getBoundingClientRect().bottom <=
                blocks[1].getBoundingClientRect().top + 1,
            swatchWidths: [...new Set(rects.map((r) => Math.round(r.width)))],
            // One column: every swatch sits directly below the one before it,
            // at the same horizontal position, never sharing a row.
            sameLeftEdge: [...new Set(rects.map((r) => Math.round(r.left)))].length === 1,
            everyRowDistinct: new Set(rects.map((r) => Math.round(r.top))).size === rects.length
        };
    });
    expect(layout.blocks).toBe(2); // ink, paper
    expect(layout.inkAboveOrLeftOfPaper).toBe(true);
    expect(layout.swatchWidths).toHaveLength(1);
    expect(layout.sameLeftEdge).toBe(true);
    expect(layout.everyRowDistinct).toBe(true);
});

/*
 * ULAplus: the CLUT selector (0-3) is a 2x2 grid of icon-sized squares -
 * the same fixed size as every swatch and toggle in the rail - not small
 * text buttons wrapping freely. A single digit never needs the wrap
 * behaviour the GigaScreen view row's text labels ("Blend") do.
 */
test('ULAplus: the CLUT selector is a 2x2 grid of icons the same size as the rail\'s other controls', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('ula_plus'));

    const layout = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#clut-selector .clut-select-btn')];
        const swatch = document.querySelector('#clut-cluster .color-swatch').getBoundingClientRect();
        const rects = btns.map((b) => b.getBoundingClientRect());
        return {
            count: rects.length,
            sizesMatchSwatch: rects.every((r) =>
                Math.round(r.width) === Math.round(swatch.width) &&
                Math.round(r.height) === Math.round(swatch.height)),
            // 2x2: two distinct rows, two distinct columns.
            rows: new Set(rects.map((r) => Math.round(r.top))).size,
            cols: new Set(rects.map((r) => Math.round(r.left))).size
        };
    });
    expect(layout.count).toBe(4);
    expect(layout.sizesMatchSwatch).toBe(true);
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(2);
});

/*
 * GigaScreen: Blend spans both icon columns on its own row (the "no split"
 * choice reads as the odd one out above the pair, not a third option
 * beside them); A and B sit below it, one icon each, side by side - never
 * three options crammed into one row.
 */
test('GigaScreen: Blend spans two icon columns, with A and B beneath it', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => ScreenModeService.switchMode('gigascreen'));

    const layout = await page.evaluate(() => {
        const swatch = document.querySelector('#clut-cluster .color-swatch').getBoundingClientRect();
        const byView = (v) => document.querySelector(`#giga-view-row [data-giga-view="${v}"]`).getBoundingClientRect();
        const blend = byView('blend');
        const a = byView('a');
        const b = byView('b');
        const round = (n) => Math.round(n);
        return {
            oneIconWidth: round(swatch.width),
            oneIconHeight: round(swatch.height),
            blendWidth: round(blend.width),
            blendHeight: round(blend.height),
            aAndBHeightMatchSwatch: round(a.height) === round(swatch.height) &&
                round(b.height) === round(swatch.height),
            aAndBWidthMatchSwatch: round(a.width) === round(swatch.width) &&
                round(b.width) === round(swatch.width),
            blendAboveAandB: round(blend.bottom) <= round(a.top) + 1 &&
                round(blend.bottom) <= round(b.top) + 1,
            aLeftOfB: a.left < b.left,
            aAndBSameRow: round(a.top) === round(b.top)
        };
    });
    // Blend is TWO icon widths wide, one icon tall - not three equal cells.
    expect(layout.blendWidth).toBeGreaterThan(layout.oneIconWidth * 1.5);
    expect(layout.blendHeight).toBe(layout.oneIconHeight);
    expect(layout.aAndBHeightMatchSwatch).toBe(true);
    expect(layout.aAndBWidthMatchSwatch).toBe(true);
    expect(layout.blendAboveAandB).toBe(true);
    expect(layout.aAndBSameRow).toBe(true);
    expect(layout.aLeftOfB).toBe(true);
});

/*
 * The colour rail is a FIXED width - it never grows to accommodate a wider
 * mode's palette. Unlike the old top #color-bar (which wrapped a swatch
 * block that didn't fit), the rail scrolls VERTICALLY instead: every
 * swatch is reachable by scrolling, none is ever permanently clipped.
 */
test.describe('the colour rail stays within its fixed width, in every screen mode', () => {
    for (const width of [1024, 1366, 1600, 2560]) {
        test(`at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await boot(page);
            page.on('dialog', (d) => d.accept()); // lossy mode-switch confirms

            const modes = await page.evaluate(() => Object.values(SCREEN_MODES).map((m) => m.id));
            const tooWide = [];
            for (const id of modes) {
                await page.evaluate((m) => ScreenModeService.switchMode(m), id);
                const bad = await page.evaluate((m) => {
                    const rail = document.getElementById('color-rail');
                    const group = document.getElementById('toolbar-color');
                    const over = group.offsetWidth - rail.clientWidth;
                    if (over > 1) return `${m}: group +${over}px`;
                    if (rail.scrollWidth > rail.clientWidth + 1) return `${m}: rail scrolls sideways`;
                    return null;
                }, id);
                if (bad) tooWide.push(bad);
            }
            expect(tooWide).toEqual([]);
        });
    }
});

/*
 * The rail's core sizing rule (css/layout.css): it scales with --ui-scale
 * like every other chrome region and has NO independent multiplier of its
 * own — unlike #color-bar, which ColorBarFit dials back separately via
 * --colorbar-scale. Only ever exercised above at the default scale (1); this
 * pins the claim at a scale where a stray independent factor would actually
 * show up as either overflow or a `zoom` value that disagrees with
 * --ui-scale.
 */
test('the rail scales only by --ui-scale, with no independent multiplier, at a non-default scale', async ({ page }) => {
    await boot(page);
    await page.selectOption('#font-scale-selector', '2');
    await page.waitForTimeout(250);

    const result = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        return {
            hasHorizontalOverflow: rail.scrollWidth > rail.clientWidth + 1,
            railZoom: getComputedStyle(rail).zoom,
            uiScale: getComputedStyle(document.documentElement)
                .getPropertyValue('--ui-scale').trim()
        };
    });
    expect(result.hasHorizontalOverflow).toBe(false);
    expect(parseFloat(result.railZoom)).toBe(parseFloat(result.uiScale));
});

test('the 256-entry indexed palette scrolls vertically, and every swatch is reachable', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

    const before = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        return { scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight };
    });
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    const reached = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        rail.scrollTop = rail.scrollHeight;
        const swatches = document.querySelectorAll('#indexed-palette-grid .color-swatch');
        const last = swatches[swatches.length - 1];
        const r = last.getBoundingClientRect();
        const railBox = rail.getBoundingClientRect();
        return r.top >= railBox.top - 0.5 && r.bottom <= railBox.bottom + 0.5;
    });
    expect(reached).toBe(true);
});
