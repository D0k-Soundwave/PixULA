'use strict';
/**
 * The pattern browser lives in its own 'Patterns' sidebar panel, shown ONLY
 * while the Brush tool's pattern brush type is the active context. The pattern
 * brush is reached from its own tool-rail button (a BrushTool variant via
 * ToolManager._brushVariants), not a standalone tool class. Verifies visibility
 * toggling and that the rail button routes onto the brush, not a Pattern class.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const panelVisible = (page) => page.evaluate(() => {
    const s = document.getElementById('patterns-panel');
    return !!s && s.style.display !== 'none' && !s.hidden;
});
const selectBrushType = (page, type) => page.evaluate((t) => {
    ToolManager.selectTool(TOOLS.BRUSH);
    ToolManager.getTool(TOOLS.BRUSH).setBrushType(t);
}, type);

test('Patterns panel exists but is hidden by default', async ({ page }) => {
    await boot(page);
    expect(await page.$('#patterns-panel')).not.toBeNull();
    expect(await panelVisible(page)).toBe(false);
});

test('Patterns panel shows only for the brush pattern type', async ({ page }) => {
    await boot(page);

    await selectBrushType(page, 'pattern');
    expect(await panelVisible(page)).toBe(true);
    // The browser itself renders inside it.
    expect(await page.$('#patterns-panel .psb')).not.toBeNull();

    await selectBrushType(page, 'round');
    expect(await panelVisible(page)).toBe(false);

    // Switching to a different tool also hides it.
    await selectBrushType(page, 'pattern');
    expect(await panelVisible(page)).toBe(true);
    await page.evaluate(() => ToolManager.selectTool(TOOLS.ERASER));
    expect(await panelVisible(page)).toBe(false);
});

test('the Pattern rail button rides on the brush, not a standalone tool class', async ({ page }) => {
    await boot(page);

    // It IS on the rail now (a brush-type button)...
    expect(await page.locator('#tool-rail button[data-tool="pattern"]').count()).toBe(1);
    // ...but it is not a registered tool class — it routes onto BrushTool.
    const wiring = await page.evaluate(() => ({
        registeredClass: window.ToolManager.getToolIds().includes('pattern'),
        resolvesToBrush: ToolManager.getTool('pattern') === ToolManager.getTool(TOOLS.BRUSH),
        isBrushVariant: !!ToolManager._brushVariants?.pattern
    }));
    expect(wiring.registeredClass).toBe(false);
    expect(wiring.resolvesToBrush).toBe(true);
    expect(wiring.isBrushVariant).toBe(true);

    // Clicking it selects the brush tool, pins the pattern type, shows the panel.
    await page.click('#tool-rail button[data-tool="pattern"]');
    expect(await page.evaluate(() => BrushEngine.currentBrush)).toBe('pattern');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().id)).toBe('brush');
    expect(await panelVisible(page)).toBe(true);
});

/* ── Preview fidelity ──────────────────────────────────────────────────────
   Every pattern preview in the app is drawn by Helpers.createPatternPreview at an
   integer device-pixel zoom, holding a whole number of tiles. Two things silently
   undo that and both have happened here: a CSS width that disagrees with the
   backing store (the browser then resamples by a fraction and the artwork shears),
   and a border-box border eating a pixel off each edge. The checks below are
   geometric rather than visual because that is what fails first and invisibly. */

/** A canvas is pixel-perfect only if its CONTENT box is exactly backing/dpr. */
const measure = (page, selector) => page.evaluate((sel) => {
    const out = [];
    for (const cv of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(cv);
        out.push({
            backingW: cv.width, backingH: cv.height,
            cssW: parseFloat(cs.width), cssH: parseFloat(cs.height),
            dpr: window.devicePixelRatio || 1
        });
    }
    return out;
}, selector);

const expectNoRescale = (boxes) => {
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
        expect(b.cssW).toBeCloseTo(b.backingW / b.dpr, 2);
        expect(b.cssH).toBeCloseTo(b.backingH / b.dpr, 2);
    }
};

const showTier = async (page, tier) => {
    await page.evaluate((t) => {
        document.querySelectorAll('.psb-tab').forEach(b => { if (b.dataset.size === t) b.click(); });
    }, tier);
    await page.waitForFunction(() => document.querySelectorAll('.pattern-item canvas').length > 0);
};

for (const [tier, tileSize, zoom] of [['8x8', 8, 8], ['16x16', 16, 4], ['32x32', 32, 2]]) {
    test(`${tier} thumbnails show one whole tile at ${zoom}x, unrescaled`, async ({ page }) => {
        await boot(page);
        await selectBrushType(page, 'pattern');
        await showTier(page, tier);

        const boxes = await measure(page, '.pattern-item canvas');
        expectNoRescale(boxes);
        for (const b of boxes) {
            // one complete tile, no crop, at an exact integer magnification
            expect(b.backingW % tileSize).toBe(0);
            expect(b.backingH % tileSize).toBe(0);
            expect(b.backingW / tileSize).toBe(zoom * b.dpr);
        }
    });
}

test('the selected-pattern preview holds whole tiles, unrescaled', async ({ page }) => {
    await boot(page);
    await selectBrushType(page, 'pattern');
    for (const [tier, tileSize] of [['8x8', 8], ['16x16', 16], ['32x32', 32]]) {
        await showTier(page, tier);
        await page.click('.pattern-item');
        await page.waitForFunction(() => !document.querySelector('.psb-apply-btn').disabled);
        const [b] = await measure(page, '.psb-canvas');
        expect(b.cssW).toBeCloseTo(b.backingW / b.dpr, 2);
        expect(b.backingW % tileSize).toBe(0);
        expect(b.backingH % tileSize).toBe(0);
    }
});

test('the Pattern Creator preview holds whole tiles, unrescaled', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => PatternCreatorPanel.open());
    for (const size of [8, 16, 32]) {
        await page.evaluate((s) => {
            const tab = [...document.querySelectorAll('.pc-size-tabs button')]
                .find(b => Number(b.dataset.size) === s);
            tab.click();
        }, size);
        await page.waitForFunction(() => !!document.querySelector('.pc-preview-canvas'));
        const [b] = await measure(page, '.pc-preview-canvas');
        expect(b.cssW).toBeCloseTo(b.backingW / b.dpr, 2);
        expect(b.backingW % size).toBe(0);
        expect(b.backingH % size).toBe(0);
    }
});

test('the panel is titled Pattern Library', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#patterns-panel .panel-title')).toHaveText('Pattern Library');
});
