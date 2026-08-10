'use strict';
/**
 * showIf-hidden option rows must actually be HIDDEN. The row is a
 * .tool-option { display: flex }, which overrode the UA [hidden] default until
 * utilities.css added `[hidden] { display: none !important }`. Without that the
 * fade options, flow, jitter-spacing etc. showed for every brush type.
 *
 * Brush TYPES are tool-rail buttons now (not a dropdown), so switching type
 * means clicking a rail button — which reselects the brush tool, re-renders the
 * options panel from the variant's brushType, and runs _applyVisibility.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const setSelect = (page, id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, value]);

/** Click a brush-family rail button (brush, crosshatch, spray, fade, …). */
const selectBrush = (page, id) => page.click(`.tool-btn[data-tool="${id}"]`);

/** Click a shape in the options icon grid. */
const pickShape = (page, value) =>
    page.click(`#tool-options-panel .opt-icon-grid .tool-btn[data-value="${value}"]`);

test('the bezier curve is picked from the Shape list, not its own button', async ({ page }) => {
    await boot(page);

    // No rail button of its own — it lives under the shape umbrella.
    expect(await page.locator('#tool-rail .tool-btn[data-tool="bezier"]').count()).toBe(0);

    await page.click('.tool-btn[data-tool="shape"]');
    await expect(page.locator('#tool-options-panel .tool-btn[data-value="bezier"]')).toHaveCount(1);

    // Choosing it switches TOOLS, and the panel becomes the curve's own.
    await pickShape(page, 'bezier');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('bezier');
    await expect(page.locator('#opt-curveType')).toBeVisible();
    // The umbrella button stays lit, so the rail still says where you are.
    await expect(page.locator('.tool-btn[data-tool="shape"]')).toHaveClass(/active/);

    // Its shortcut survives leaving the rail (the registry, not the button,
    // is what the keyboard map is generated from).
    await page.click('.tool-btn[data-tool="brush"]');
    await page.keyboard.press('c');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('bezier');

    // And the Shape button is the way back to the geometric shapes.
    await page.click('.tool-btn[data-tool="shape"]');
    await pickShape(page, 'circle');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().shapeType)).toBe('circle');
});

test('the curve keeps the shape list, and picking one goes back with it', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="shape"]');
    await pickShape(page, 'bezier');

    // The list is still there, still saying where you are — the curve is not a
    // dead end you can only leave via the rail.
    const lit = '#tool-options-panel .opt-icon-grid .tool-btn.active';
    await expect(page.locator('#tool-options-panel .opt-icon-grid')).toBeVisible();
    expect(await page.getAttribute(lit, 'data-value')).toBe('bezier');

    // Picking a shape from it switches back to Shape AND lands on that shape.
    await pickShape(page, 'ellipse');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('shape');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().shapeType)).toBe('ellipse');
    expect(await page.getAttribute(lit, 'data-value')).toBe('ellipse');
    await expect(page.locator('#opt-curveType')).toHaveCount(0);
});

test('the shape grid draws each shape, and the picked one brings its own dial', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="shape"]');

    const grid = page.locator('#tool-options-panel .opt-icon-grid');
    const buttons = grid.locator('.tool-btn');
    const registered = await page.evaluate(() =>
        SHAPE_TYPE_OPTS.flatMap(g => g.options).length);
    expect(await buttons.count(), 'one button per registry entry').toBe(registered);

    // Every button carries a picture: a shape's own raster, or a sprite for the
    // curve. An empty <path d=""> is the failure this catches.
    const drawn = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#tool-options-panel .opt-icon-grid .tool-btn').forEach((b) => {
            const path = b.querySelector('path[d]');
            const use = b.querySelector('use');
            if (!use && (!path || (path.getAttribute('d') || '').length < 8)) out.push(b.dataset.value);
        });
        return out;
    });
    expect(drawn, 'no blank tiles').toEqual([]);

    // Per-shape parameters appear only under their own shape.
    const shown = (id) => page.locator(`#opt-${id}`).isVisible();
    expect(await shown('starPoints')).toBe(false);
    await pickShape(page, 'star');
    expect(await shown('starPoints'), 'the star brings its point count').toBe(true);
    expect(await shown('gearTeeth')).toBe(false);

    await pickShape(page, 'gear');
    expect(await shown('starPoints')).toBe(false);
    expect(await shown('gearTeeth')).toBe(true);

    // The dial reaches the raster: 12 teeth must draw more than 3 do.
    const teeth = (n) => page.evaluate((v) => {
        ToolManager.getCurrentTool().setGearTeeth(v);
        return ShapeGenerator.generateShape('gear',
            { x1: 0, y1: 0, x2: 60, y2: 60 },
            ToolManager.getCurrentTool()._shapeOptions()).length;
    }, n);
    expect(await teeth(12)).toBeGreaterThan(await teeth(3));

    // Arc and sector share one sweep dial but not its default.
    await pickShape(page, 'arc');
    expect(await shown('arcSpan')).toBe(true);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getArcSpan())).toBe(180);
    await pickShape(page, 'sector');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getArcSpan())).toBe(90);
    expect(await page.inputValue('#opt-arcSpan'), 'the slider followed').toBe('90');
});

test('fade options are hidden for non-fade brush types, shown for fade', async ({ page }) => {
    await boot(page);
    await selectBrush(page, 'brush');

    expect(await page.locator('#opt-fadeBrushType').isVisible()).toBe(false);
    expect(await page.locator('#opt-fadeLength').isVisible()).toBe(false);

    await selectBrush(page, 'fade');
    expect(await page.locator('#opt-fadeBrushType').isVisible()).toBe(true);
    expect(await page.locator('#opt-fadeLength').isVisible()).toBe(true);

    await selectBrush(page, 'spray');
    expect(await page.locator('#opt-fadeBrushType').isVisible()).toBe(false);
});

test('flow / build-up hidden for solid brushes, shown for scattering ones', async ({ page }) => {
    await boot(page);
    await selectBrush(page, 'brush');

    // The base Brush button: Round/Square selector shown, scatter rows hidden.
    expect(await page.locator('#opt-brushType').isVisible()).toBe(true);
    expect(await page.locator('#opt-flowRate').isVisible()).toBe(false);
    expect(await page.locator('#opt-continuous').isVisible()).toBe(false);
    expect(await page.locator('#opt-weighting').isVisible()).toBe(false);

    await selectBrush(page, 'spray');
    // On a variant the Round/Square selector is gone; the scatter rows appear.
    expect(await page.locator('#opt-brushType').isVisible()).toBe(false);
    expect(await page.locator('#opt-flowRate').isVisible()).toBe(true);
    expect(await page.locator('#opt-continuous').isVisible()).toBe(true);
    // Distribution picks the spray sub-mode; Weighting is the uniform dial (the
    // retired Stipple brush at its 'even' end), Min spacing the Poisson one.
    expect(await page.locator('#opt-distribution').isVisible()).toBe(true);
    expect(await page.locator('#opt-weighting').isVisible()).toBe(true);
    expect(await page.locator('#opt-minDistance').isVisible()).toBe(false);
    expect(await page.locator('#opt-poissonShape').isVisible()).toBe(false);

    // Switching to the Poisson distribution swaps Weighting for Min spacing +
    // Shape; Flow stays (both distributions thin by flow), the former stipple.
    await setSelect(page, 'opt-distribution', 'poisson');
    expect(await page.locator('#opt-flowRate').isVisible()).toBe(true);
    expect(await page.locator('#opt-weighting').isVisible()).toBe(false);
    expect(await page.locator('#opt-minDistance').isVisible()).toBe(true);
    expect(await page.locator('#opt-poissonShape').isVisible()).toBe(true);
});

test('every brush type has its own rail button; spray drives the brush spray', async ({ page }) => {
    await boot(page);

    for (const id of ['brush', 'spray', 'fade', 'pattern',
                      'hatch']) {
        expect(await page.locator(`.tool-btn[data-tool="${id}"]`).count(),
            `${id} rail button exists`).toBe(1);
    }

    // Clicking a variant selects the brush tool and pins the engine type.
    await selectBrush(page, 'hatch');
    expect(await page.evaluate(() => BrushEngine.currentBrush)).toBe('hatch');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().id)).toBe('brush');

    // The repurposed Spray button now draws the brush 'spray' type.
    await selectBrush(page, 'spray');
    expect(await page.evaluate(() => BrushEngine.currentBrush)).toBe('spray');

    // Returning to Brush snaps back to a solid type.
    await selectBrush(page, 'brush');
    expect(await page.evaluate(() => ['round', 'square'].includes(BrushEngine.currentBrush))).toBe(true);
});

test('jitter spacing hidden until size jitter is dialled up', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    expect(await page.locator('#opt-variationRate').isVisible()).toBe(false);
    await page.evaluate(() => {
        const el = document.getElementById('opt-sizeVariation');
        el.value = '40';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(await page.locator('#opt-variationRate').isVisible()).toBe(true);
});

/*
 * Attribute flood fill is what the retired Attributes Only draw mode could do
 * and the Recolour attribute op cannot: Recolour paints the cell under the
 * pointer, this recolours every connected cell sharing the start cell's
 * attribute ("make all the cyan cells blue"). When the mode went, this was its
 * only door, so it became a Fill option - and the pixel-flood options, which
 * mean nothing to it, hide while it is on.
 */
test('Fill attributes only recolours connected cells, touching no pixel', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="fill"]');

    const shown = () => page.evaluate(() =>
        [...document.querySelectorAll('#tool-options-panel .tool-option')]
            .filter((r) => r.offsetParent !== null)
            .map((r) => r.textContent.trim()));

    expect(await shown()).toHaveLength(4);           // + contiguous, diagonal, pattern
    await page.click('#opt-attributesOnly');
    expect(await shown()).toHaveLength(1);           // a pixel flood's options are irrelevant

    const r = await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        // A 3x3 block of one attribute, in a field of another
        for (let cy = 0; cy < 3; cy++) {
            for (let cx = 0; cx < 3; cx++) {
                const c = layer.getCell(cx, cy);
                layer.setCell(cx, cy,
                    { ink: 2, paper: 0, bright: false, flash: false, pixels: c.pixels });
            }
        }
        const pixelsBefore = Array.from(layer.getCell(0, 0).pixels).join();

        ColorManager.setInk(5);
        ToolManager.getCurrentTool()._floodFill(0, 0, false);

        return {
            filled: [layer.getCell(0, 0).ink, layer.getCell(2, 2).ink],
            beyondTheBlock: layer.getCell(10, 10).ink,
            pixelsUntouched: Array.from(layer.getCell(0, 0).pixels).join() === pixelsBefore
        };
    });

    expect(r.filled).toEqual([5, 5]);        // every connected same-attribute cell
    expect(r.beyondTheBlock).toBe(0);        // and no others
    expect(r.pixelsUntouched).toBe(true);    // attributes only means attributes only
});
