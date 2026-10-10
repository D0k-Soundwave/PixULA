'use strict';
/**
 * Batch 8 part 8B2 in a real browser: Patterns panel > From picture... opens a pattern-making dialog (no conversion
 * panes), OK adds a tile to the Mine tab and makes it the current pattern, Cancel adds nothing, and the tile survives a
 * reload. The tile maths is pinned in Node (tests/pattern-from-picture.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

async function makePng(page, name) {
    return page.evaluate(async (n) => {
        const c = document.createElement('canvas');
        c.width = 96; c.height = 96;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 96, 0);
        g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        return { name: n, mimeType: 'image/png', buffer: Array.from(new Uint8Array(await blob.arrayBuffer())) };
    }, name);
}
async function openPanel(page) {
    await page.click('.tool-btn[data-tool="pattern"]');
    await expect(page.locator('.psb-picture-btn')).toBeVisible();
}
async function pickFile(page, file) {
    await page.setInputFiles('#psb-picture-input', { name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.buffer) });
}

test('From picture shows only for the pattern brush, and its dialog has the tile controls but no panes', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="brush"]');
    await expect(page.locator('.psb-picture-btn')).toBeHidden();
    await openPanel(page);
    await pickFile(page, await makePng(page, 'ramp.png'));
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });
    await expect(dlg.locator('#pattern-dither')).toBeVisible();
    await expect(dlg.locator('#pattern-size')).toBeVisible();
    expect(await dlg.locator('.import-method').count()).toBe(0);
    expect(await dlg.locator('#pattern-dither option').count()).toBe(31);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => PatternService.getUserPatterns().then((p) => p.length))).toBe(0);
});

test('OK adds a tile, makes it current, and it survives a reload', async ({ page }) => {
    await boot(page);
    await openPanel(page);
    await pickFile(page, await makePng(page, 'ramp.png'));
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });
    await dlg.locator('#pattern-size').selectOption('16');
    await dlg.locator('#pattern-dither').selectOption('bayer-4');
    await dlg.getByRole('button', { name: /^OK$/ }).click();
    await expect.poll(() => page.evaluate(() => PatternService.getUserPatterns().then((p) => p.map((x) => x.name).join()))).toBe('ramp');
    const info = await page.evaluate(async () => {
        const mine = (await PatternService.getUserPatterns())[0];
        const cur = PatternService.getCurrentPattern();
        return { w: mine.width, ink: Array.from(mine.bitmap).reduce((a, b) => a + b, 0), cur: cur && cur.name };
    });
    expect(info.w).toBe(16);
    expect(info.ink, 'a dithered ramp is part ink').toBeGreaterThan(40);
    expect(info.ink).toBeLessThan(216);
    expect(info.cur).toBe('ramp');

    await reload(page);
    expect(await page.evaluate(() => PatternService.getUserPatterns().then((p) => p.length))).toBe(1);
});

test('the same file twice makes "ramp 2", it does not replace "ramp"', async ({ page }) => {
    await boot(page);
    await openPanel(page);
    const file = await makePng(page, 'ramp.png');
    for (let i = 0; i < 2; i++) {
        await pickFile(page, file);
        const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
        await expect(dlg).toBeVisible({ timeout: 10000 });
        await dlg.getByRole('button', { name: /^OK$/ }).click();
        await expect.poll(() => page.evaluate(() => PatternService.getUserPatterns().then((p) => p.length))).toBe(i + 1);
    }
    expect(await page.evaluate(() => PatternService.getUserPatterns().then((p) => p.map((x) => x.name).sort().join()))).toBe('ramp,ramp 2');
});
