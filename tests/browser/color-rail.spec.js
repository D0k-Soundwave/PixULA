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
            // Border moved to the header (2026-08-26) — it was never in the
            // rail, and as of that date it is no longer in #color-bar either.
            borderHostInHeader: !!document.querySelector('#header-controls #border-host'),
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
    expect(structure.borderHostInHeader).toBe(true);
    expect(structure.borderHostInColorBar).toBe(false);
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
 * Bright/Flash sit side by side (2026-08-26) — the rail is wide enough for
 * two icon columns (widened for the CLUT/GigaScreen pickers), so there is
 * no longer a reason to spend twice the vertical space stacking them.
 */
test('classic mode: Bright and Flash sit side by side, at the rail icon size', async ({ page }) => {
    await boot(page);

    const layout = await page.evaluate(() => {
        const bright = document.getElementById('bright-toggle').closest('.clut-bit').getBoundingClientRect();
        const flash = document.getElementById('flash-toggle').closest('.clut-bit').getBoundingClientRect();
        const rail = document.getElementById('color-rail').getBoundingClientRect();
        const railIconSize = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--rail-icon-size'));
        return {
            sameRow: Math.round(bright.top) === Math.round(flash.top),
            brightLeftOfFlash: bright.left < flash.left,
            brightSize: Math.round(bright.width) === Math.round(railIconSize) &&
                Math.round(bright.height) === Math.round(railIconSize),
            flashSize: Math.round(flash.width) === Math.round(railIconSize) &&
                Math.round(flash.height) === Math.round(railIconSize),
            bothWithinRail: bright.left >= rail.left - 0.5 && flash.right <= rail.right + 0.5
        };
    });
    expect(layout.sameRow).toBe(true);
    expect(layout.brightLeftOfFlash).toBe(true);
    expect(layout.brightSize).toBe(true);
    expect(layout.flashSize).toBe(true);
    expect(layout.bothWithinRail).toBe(true);
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
 * Every mode below 256 colours uses --rail-icon-size, chosen to match the
 * left tool rail's Ink/Paper preview wells (#color-preview .clut-preview) -
 * growing this is deliberately its OWN token, never --clut-btn-size, so
 * #color-bar's buttons (draw modes, Mirror, Swap/Recolour, Border) stay
 * exactly the size they were regardless of what the rail's icons do.
 */
test('rail icons match the left tool rail\'s Ink/Paper preview wells, and the top strip is unaffected', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    const barButtonHeightAt = () => page.evaluate(() =>
        document.querySelector('#color-bar button').getBoundingClientRect().height);
    const barButtonHeightBefore = await barButtonHeightAt();

    for (const mode of ['standard_ula', 'ula_plus', 'gigascreen', 'timex_hires', 'ulanext']) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForTimeout(150);
        const result = await page.evaluate(() => {
            const preview = document.getElementById('ink-color').getBoundingClientRect();
            const swatch = document.querySelector('#clut-cluster .color-swatch, #clut-selector .clut-select-btn');
            return {
                previewSize: preview.width,
                swatchSize: swatch ? swatch.getBoundingClientRect().width : null
            };
        });
        expect(result.swatchSize).not.toBeNull();
        expect(Math.round(result.swatchSize)).toBe(Math.round(result.previewSize));
    }

    expect(await barButtonHeightAt()).toBe(barButtonHeightBefore);
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

/*
 * The 256-entry dense grid is half-size swatches, several columns wide -
 * not a single shrunk column - so a "row" of colour reads as a reasonable
 * width in the rail rather than one small swatch looking lost in it. Dense
 * stays its own small size regardless of how big --rail-icon-size grows
 * for every other mode (below 256 colours) - 256 of them at full size
 * would be a very long scroll for no benefit. Selecting a swatch near the
 * grid's own right edge must not push its active-ink outline past the
 * rail's own visible bounds - #color-rail clips horizontally
 * (overflow-x: hidden), and an outline that lands outside that box is
 * silently cropped, not just ugly.
 */
test('the 256-entry dense grid is several half-size columns, its own size regardless of the rail icon size, markers included', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

    const layout = await page.evaluate(() => {
        const grid = document.getElementById('indexed-palette-grid');
        const rail = document.getElementById('color-rail');
        const swatches = [...grid.querySelectorAll('.color-swatch')];
        const first8 = swatches.slice(0, 8).map((s) => s.getBoundingClientRect());
        const cols = new Set(first8.map((r) => Math.round(r.left))).size;
        const rowTops = [...new Set(first8.map((r) => Math.round(r.top)))];

        // Select the right-most swatch of the first row as ink, and the one
        // beside it as paper, then check both markers stay inside the rail.
        const rightMost = swatches[cols - 1];
        rightMost.click();
        const neighbour = swatches[cols - 2];
        neighbour.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

        const railRect = rail.getBoundingClientRect();
        const inkRect = rightMost.getBoundingClientRect();
        const inkStyle = getComputedStyle(rightMost);
        const outlineReach = (parseFloat(inkStyle.outlineWidth) || 0) +
            (parseFloat(inkStyle.outlineOffset) || 0);
        const paperRect = neighbour.getBoundingClientRect();

        const railIconSize = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--rail-icon-size'));

        return {
            columns: cols,
            rowCount: rowTops.length,
            denseSwatchSize: first8[0].width,
            railIconSize,
            hasActiveInk: rightMost.classList.contains('active-ink'),
            hasActivePaper: neighbour.classList.contains('active-paper'),
            inkOutlineWithinRail: (inkRect.left - outlineReach) >= railRect.left - 0.5 &&
                (inkRect.right + outlineReach) <= railRect.right + 0.5,
            paperMarkerWithinSwatch: paperRect.width > 0 && paperRect.height > 0
        };
    });
    expect(layout.columns).toBeGreaterThan(1); // several columns, not the one-column swatch list
    expect(layout.rowCount).toBe(2); // first 8 swatches span exactly two rows
    // Dense stays small on its own terms, independent of the (larger) icon
    // size every other mode's swatches now use.
    expect(layout.denseSwatchSize).toBeLessThan(layout.railIconSize);
    expect(layout.hasActiveInk).toBe(true);
    expect(layout.hasActivePaper).toBe(true);
    expect(layout.inkOutlineWithinRail).toBe(true);
    expect(layout.paperMarkerWithinSwatch).toBe(true);
});
