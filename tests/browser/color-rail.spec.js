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
 * block is a fixed 2-column grid, not stretched to the rail's width, so a
 * screen-mode change can never resize a swatch.
 */
test('classic mode: Ink then Paper stack vertically in the rail, each a fixed 2-column grid', async ({ page }) => {
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
            firstRowPair: Math.abs(rects[0].top - rects[1].top) < 1,
            thirdDropsRow: rects[2].top > rects[0].top + 1
        };
    });
    expect(layout.blocks).toBe(2); // ink, paper
    expect(layout.inkAboveOrLeftOfPaper).toBe(true);
    expect(layout.swatchWidths).toHaveLength(1);
    expect(layout.firstRowPair).toBe(true);
    expect(layout.thirdDropsRow).toBe(true);
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
