'use strict';
/**
 * Gradient tool in a real browser: the triangle, pentagon, hexagon and octagon styles, Rotation and Zoom (owner
 * decision 2026-10-19; plan in .claude/parity/feature-gradient-shapes.md). The band math is pinned in Node by
 * tests/gradient-shapes.test.js; this checks the panel, a real mouse drag, presets and every screen mode.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const setSelect = (page, id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, value]);

const setRange = (page, id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, value]);

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}

/** Phase 1 drag from (x1, y1) to (x2, y2), then press and release at the axis end (ex, ey). */
async function mouseGradient(page, x1, y1, x2, y2, ex, ey) {
    const a = await pixelPoint(page, x1, y1), b = await pixelPoint(page, x2, y2), e = await pixelPoint(page, ex, ey);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await page.mouse.move(e.x, e.y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.up();
}

/** 1 / 0 for every pixel of the box, row by row. */
const inkBits = (page, x, y, w, h) => page.evaluate(([bx, by, bw, bh]) => {
    const out = [];
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        out.push(PixelDrawRoutine.getPixelState(bx + i, by + j)?.isInk ? 1 : 0);
    }
    return out;
}, [x, y, w, h]);

const rowVisible = (page, id) => page.evaluate((sel) => {
    const el = document.getElementById(sel);
    return !!el && !el.closest('[hidden]') && el.offsetParent !== null;
}, id);

test('the Type list has the four polygon styles; Rotation and Zoom show only for the edge-based styles', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('d');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('gradient');

    const labels = await page.locator('#opt-gradientType option').allTextContents();
    for (const name of ['Triangle', 'Pentagon', 'Hexagon', 'Octagon']) expect(labels).toContain(name);
    expect(labels.indexOf('Triangle')).toBe(labels.indexOf('Square') + 1);

    for (const [type, shown] of [['linear', false], ['radial', false], ['reflected', false], ['conical', false],
        ['spiral', false], ['hexagon', true], ['square', true], ['diamond', true], ['triangle', true],
        ['pentagon', true], ['octagon', true]]) {
        await setSelect(page, 'opt-gradientType', type);
        expect(await rowVisible(page, 'opt-gradientRotation'), `Rotation for ${type}`).toBe(shown);
        expect(await rowVisible(page, 'opt-gradientZoom'), `Zoom for ${type}`).toBe(shown);
    }
    await expect(page.locator('#opt-gradientRotation')).toHaveAttribute('min', '-180');
    await expect(page.locator('#opt-gradientRotation')).toHaveAttribute('max', '180');
    await expect(page.locator('#opt-gradientZoom')).toHaveAttribute('min', '25');
    await expect(page.locator('#opt-gradientZoom')).toHaveAttribute('max', '400');

    await setRange(page, 'opt-gradientRotation', 30);
    await setRange(page, 'opt-gradientZoom', 150);
    expect(await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.GRADIENT);
        return [t.getGradientType(), t.getGradientRotation(), t.getGradientZoom()];
    })).toEqual(['octagon', 30, 150]);
    await expect(page.locator('#tool-options-panel')).toContainText('30\u00b0');
    await expect(page.locator('#tool-options-panel')).toContainText('150%');
});

test('a mouse-drawn hexagon is symmetric about its start; Rotation turns it, a triangle repeats every 120', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('d');
    await setSelect(page, 'opt-gradientType', 'hexagon');
    await page.evaluate(() => ToolManager.getTool(TOOLS.GRADIENT).setDithered(false));

    // Box (8,8)-(48,48): the centre start point is (28,28).
    await mouseGradient(page, 8, 8, 48, 48, 48, 28);
    const bits = await inkBits(page, 8, 8, 41, 41);
    const ink = bits.reduce((a, b) => a + b, 0);
    expect(ink).toBeGreaterThan(200);
    expect(ink).toBeLessThan(41 * 41);
    let asym = 0;
    for (let j = 0; j < 41; j++) for (let i = 0; i < 41; i++) if (bits[j * 41 + i] !== bits[(40 - j) * 41 + (40 - i)]) asym++;
    expect(asym, 'a half turn about the start maps the hexagon onto itself').toBe(0);

    // The same hexagon at Rotation 30, drawn into a box with the same dither phase.
    await setRange(page, 'opt-gradientRotation', 30);
    await mouseGradient(page, 64, 8, 104, 48, 104, 28);
    const turned = await inkBits(page, 64, 8, 41, 41);
    const diff = turned.reduce((n, v, i) => n + (v === bits[i] ? 0 : 1), 0);
    expect(diff).toBeGreaterThan(20);

    // Triangle: 120 degrees is the same picture as 0.
    await setSelect(page, 'opt-gradientType', 'triangle');
    await setRange(page, 'opt-gradientRotation', 0);
    await mouseGradient(page, 120, 8, 160, 48, 160, 28);
    const t0 = await inkBits(page, 120, 8, 41, 41);
    await setRange(page, 'opt-gradientRotation', 120);
    await mouseGradient(page, 176, 8, 216, 48, 216, 28);
    const t120 = await inkBits(page, 176, 8, 41, 41);
    expect(t120.reduce((n, v, i) => n + (v === t0[i] ? 0 : 1), 0)).toBe(0);
    expect(t0.reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
});

test('Zoom spreads the bands: with Repeats, Zoom 200 draws fewer, wider rings', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('d');
    await setSelect(page, 'opt-gradientType', 'octagon');
    await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.GRADIENT);
        t.setDithered(false);
        t.setWrapMode('repeat');
        t.setRepeatCount(4);
    });
    const changes = (bits) => { let n = 0; for (let i = 1; i < 41; i++) if (bits[20 * 41 + i] !== bits[20 * 41 + i - 1]) n++; return n; };
    await mouseGradient(page, 8, 64, 48, 104, 48, 84);
    const z100 = await inkBits(page, 8, 64, 41, 41);
    await setRange(page, 'opt-gradientZoom', 200);
    await mouseGradient(page, 64, 64, 104, 104, 104, 84);
    const z200 = await inkBits(page, 64, 64, 41, 41);
    expect(changes(z200)).toBeLessThan(changes(z100));
    expect(changes(z200)).toBeGreaterThan(0);
});

test('a tool preset keeps the style, Rotation and Zoom', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        for (const p of PresetService.listToolPresets(TOOLS.GRADIENT).slice()) await PresetService.removeToolPreset(TOOLS.GRADIENT, p.name);
        ToolManager.selectTool(TOOLS.GRADIENT);
        const t = ToolManager.getTool(TOOLS.GRADIENT);
        t.setGradientType('pentagon');
        t.setGradientRotation(-45);
        t.setGradientZoom(250);
        await PresetService.saveToolPreset(TOOLS.GRADIENT, 'Turned pentagon');
        t.setGradientType('linear');
        t.setGradientRotation(0);
        t.setGradientZoom(100);
    });
    await page.evaluate(() => PresetService.applyToolPreset(TOOLS.GRADIENT, 'Turned pentagon'));
    expect(await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.GRADIENT);
        return [t.getGradientType(), t.getGradientRotation(), t.getGradientZoom()];
    })).toEqual(['pentagon', -45, 250]);
    await expect(page.locator('#opt-gradientZoom')).toHaveValue('250');
    await page.evaluate(async () => {
        for (const p of PresetService.listToolPresets(TOOLS.GRADIENT).slice()) await PresetService.removeToolPreset(TOOLS.GRADIENT, p.name);
    });
});

test('an octagon at Rotation 20 and Zoom 150 draws in every screen mode', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const modes = await page.evaluate(() => ScreenModeService.getModes().map(m => m.id));
    expect(modes.length).toBeGreaterThan(10);
    for (const mode of modes.filter(m => m !== 'standard_ula').concat('standard_ula')) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await expect.poll(() => page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe(mode);
        const result = await page.evaluate(() => {
            ToolManager.selectTool(TOOLS.GRADIENT);
            const t = ToolManager.getTool(TOOLS.GRADIENT);
            t.setGradientType('octagon');
            t.setGradientRotation(20);
            t.setGradientZoom(150);
            t.setDithered(true);
            t.setWrapMode('clamp');
            const x1 = 8, y1 = 8, x2 = 8 + 56, y2 = 8 + 56;
            const state = () => {
                const out = [];
                for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
                    const s = PixelDrawRoutine.getPixelState(x, y);
                    out.push(s ? `${s.isInk ? 1 : 0}:${s.index ?? ''}` : '-');
                }
                return out;
            };
            LayerManager.getCurrentLayer().clear();   // the picture carries over from the last mode
            const before = state();
            const ev = { button: 0, buttons: 1, pressure: 1, shiftKey: false, altKey: false, clientX: 0, clientY: 0 };
            UndoRedo.beginAction('gradient test');
            t.onPointerDown(x1, y1, ev);
            t.onPointerUp(x2, y2, ev);
            t.onPointerDown(x2, 36, ev);
            t.onPointerUp(x2, 36, ev);
            UndoRedo.endAction();
            const after = state();
            let changed = 0;
            for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) changed++;
            return { changed, total: before.length };
        });
        expect(result.changed, `${mode}: the octagon gradient changes pixels`).toBeGreaterThan(50);
        expect(result.changed, `${mode}: but not every pixel`).toBeLessThan(result.total);
    }
});

test('the labels follow the language', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('d');
    await page.evaluate(() => I18n.setLocale('pl'));
    await setSelect(page, 'opt-gradientType', 'hexagon');
    const want = await page.evaluate(() => ['shape.hexagon', 'opt.gradientZoom', 'opt.rotation'].map(k => I18n.t(k)));
    expect(want[1]).toBe('Powiększenie');
    const labels = await page.locator('#opt-gradientType option').allTextContents();
    expect(labels).toContain(want[0]);
    await expect(page.locator('#tool-options-panel')).toContainText(want[1]);
    await expect(page.locator('#tool-options-panel')).toContainText(want[2]);
    await page.evaluate(() => I18n.setLocale('en'));
});
