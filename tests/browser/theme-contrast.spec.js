'use strict';
/**
 * Text and icons on the accent colour stay readable in every theme.
 *
 * Found 2026-09-27: --on-accent was white everywhere, which measured 2.0:1 on
 * the default Dark theme's green OK button and under the 4.5:1 minimum in
 * seven of the eight themes. It now follows each theme's background (Sepia
 * sets black); the red delete button has its own --on-error.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const MIN = 4.5; // WCAG 2 AA, normal text

test('on-accent and on-error clear 4.5:1 in all eight themes', async ({ page }) => {
    await boot(page);
    const themes = await page.evaluate(() =>
        [...document.querySelectorAll('.menu-action[data-action^="settings:theme"]')].map((e) => e.dataset.action));
    expect(themes).toHaveLength(8);

    const low = [];
    for (const theme of themes) {
        await page.evaluate((a) => MenuSystem._executeAction(a), theme);
        // Theme changes fade colours in; measure the settled values.
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => {
            const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
            const lum = ([r, g, b]) => {
                const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
                return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const ratio = (fg, bg) => {
                const a = lum(rgb(fg)), b = lum(rgb(bg));
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            };
            const sample = (className, style) => {
                const el = document.createElement('button');
                el.className = className;
                if (style) Object.assign(el.style, style);
                el.textContent = 'OK';
                document.body.appendChild(el);
                const cs = getComputedStyle(el);
                const v = ratio(cs.color, cs.backgroundColor);
                el.remove();
                return v;
            };
            const tool = document.querySelector('.tool-btn.active');
            const ts = getComputedStyle(tool);
            return {
                okButton: sample('panel-button primary'),
                activeToggle: sample('panel-button active'),
                activeTool: ratio(ts.color, ts.backgroundColor),
                deleteX: sample('', { background: 'var(--accent-error)', color: 'var(--on-error)' })
            };
        });
        for (const [what, v] of Object.entries(r)) {
            if (v < MIN) low.push(`${theme} ${what} ${v.toFixed(2)}`);
        }
    }
    expect(low).toEqual([]);
});
