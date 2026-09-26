'use strict';
/**
 * Only a VISIBLE grid owns a backing store.
 *
 * GridOverlay's canvases sit outside the CSS-scaled picture so their lines can
 * be drawn at the real on-screen pixel size, which means each one is the
 * picture at zoom x devicePixelRatio - 8192x6144 (~200 MB) at 1600% on a 2x
 * screen. Until 2026-09-26 all three were sized on every zoom step, plus a
 * same-size cache canvas each, whether any grid was on or not: 1.2 GB of
 * canvas, and 0.75 s a zoom step (docs/FIGURES.md section 8). Now a hidden
 * grid is shrunk to 0x0 and a shown one is drawn straight into its own canvas.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test.use({ deviceScaleFactor: 2 });

/** Every grid canvas's backing-store size, plus what a visible one should be. */
const sizes = (page) => page.evaluate(() => {
    const dims = (c) => [c.width, c.height];
    const scale = CanvasSystem.getScale();
    const dpr = window.devicePixelRatio || 1;
    return {
        px: dims(GridOverlay.grid1x1Canvas),
        cell: dims(GridOverlay.grid8x8Canvas),
        block: dims(GridOverlay.grid16x16Canvas),
        expected: [Math.round(Math.round(ZX_SPECTRUM.WIDTH * scale) * dpr),
                   Math.round(Math.round(ZX_SPECTRUM.HEIGHT * scale) * dpr)]
    };
});

test('with every grid off, zooming to 1600% allocates no grid canvas at all', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        GridOverlay.setPixelGridVisible(false);
        GridOverlay.setCellGridVisible(false);
        GridOverlay.setBlockGridVisible(false);
        CanvasSystem.setZoom(1600);
    });

    const s = await sizes(page);
    expect(s.px).toEqual([0, 0]);
    expect(s.cell).toEqual([0, 0]);
    expect(s.block).toEqual([0, 0]);
    // The old per-grid cache copies are gone too
    expect(await page.evaluate(() => [GridOverlay._grid1x1Cache, GridOverlay._grid8x8Cache,
        GridOverlay._grid16x16Cache].every((c) => !c))).toBe(true);
});

test('switching one grid on sizes only that grid, and switching it off frees it', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        GridOverlay.setPixelGridVisible(false);
        GridOverlay.setBlockGridVisible(false);
        GridOverlay.setCellGridVisible(true);
        CanvasSystem.setZoom(800);
    });

    let s = await sizes(page);
    expect(s.cell).toEqual(s.expected);
    expect(s.px).toEqual([0, 0]);
    expect(s.block).toEqual([0, 0]);

    // Something is actually drawn on it
    const inked = await page.evaluate(() => {
        const c = GridOverlay.grid8x8Canvas;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
        return false;
    });
    expect(inked).toBe(true);

    await page.evaluate(() => GridOverlay.setCellGridVisible(false));
    s = await sizes(page);
    expect(s.cell).toEqual([0, 0]);
});

test('the pixel grid only takes memory from 400% up, where it is shown', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        GridOverlay.setPixelGridVisible(true);
        CanvasSystem.setZoom(200);
    });
    expect((await sizes(page)).px).toEqual([0, 0]);

    await page.evaluate(() => CanvasSystem.setZoom(400));
    const s = await sizes(page);
    expect(s.px).toEqual(s.expected);
});

test('a visible grid is redrawn when the theme changes its colour', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        GridOverlay.setCellGridVisible(true);
        CanvasSystem.setZoom(400);
        const hash = async () => {
            const c = GridOverlay.grid8x8Canvas;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            const h = await crypto.subtle.digest('SHA-1', d);
            return Array.from(new Uint8Array(h)).join(',');
        };
        const before = await hash();
        const colourBefore = GridOverlay.cellGridColor;
        // Find a theme whose cell-grid colour differs from the current one
        for (const theme of ThemeManager.getAvailableThemes()) {
            ThemeManager.setTheme(theme);
            if (GridOverlay.cellGridColor !== colourBefore) break;
        }
        return { changed: GridOverlay.cellGridColor !== colourBefore, before, after: await hash() };
    });

    expect(r.changed).toBe(true);
    expect(r.after).not.toBe(r.before);
});
