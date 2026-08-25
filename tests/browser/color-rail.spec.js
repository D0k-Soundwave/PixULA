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
