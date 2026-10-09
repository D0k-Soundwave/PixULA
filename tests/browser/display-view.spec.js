'use strict';
/**
 * View > Colours Off, Stop Flashing and Colour Grid (batch 3 part 3A).
 *
 * Display only: each switch changes what the canvas shows and nothing in the
 * document, the undo stack or an export. Which switch is available in which
 * screen mode, and what each shows, is pinned in Node by
 * tests/display-view.test.js; here the real menu, the real canvas and the real
 * reload are exercised.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, selectMode } = require('./helpers');

const INK = 1, PAPER = 6;

/** What the canvas shows at (x, y), after the render pipeline has run. */
async function shown(page, x, y) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(([px, py]) => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const ctx = doc.getElementById('main-canvas').getContext('2d');
        return Array.from(ctx.getImageData(px, py, 1, 1).data.slice(0, 3));
    }, [x, y]);
}

/** Cells (2,2) and (3,2): leftmost dot set, ink blue on yellow paper. (3,2) flashes. */
async function seed(page) {
    await page.evaluate(([ink, paper]) => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, flash] of [[2, false], [3, true]]) {
            const c = layer.getCell(cx, 2);
            c.pixels[0] = 0x80;
            Object.assign(c, { ink, paper, bright: false, flash });
            c.altered = true;
        }
        LayerManager.composeToCanvas();
    }, [INK, PAPER]);
}

const item = (page, id) => page.locator(`#menu-view [data-id="${id}"]`);

async function openView(page) {
    await page.click('.menu-item[data-menu="view"] .menu-label');
    await page.waitForSelector('#menu-view [data-id="colours-off"]', { state: 'visible' });
}

async function toggle(page, id) {
    await openView(page);
    await item(page, id).click();
}

const docState = (page) => page.evaluate(() => {
    const c = LayerManager.getCurrentLayer().getCell(2, 2);
    return { cell: JSON.stringify({ p: Array.from(c.pixels), i: c.ink, a: c.paper, f: c.flash }),
        undo: UndoRedo.getUndoCount() };
});

const BLACK = [0, 0, 0], WHITE = [255, 255, 255], ALT = [224, 224, 224];

test('Colours Off shows set dots black and clear dots white, and changes nothing else', async ({ page }) => {
    await boot(page);
    await seed(page);
    const normalInk = await shown(page, 16, 16);
    const normalPaper = await shown(page, 17, 16);
    expect(normalInk).not.toEqual(BLACK);
    const before = await docState(page);

    await toggle(page, 'colours-off');
    expect(await shown(page, 16, 16)).toEqual(BLACK);
    expect(await shown(page, 17, 16)).toEqual(WHITE);
    await openView(page);
    await expect(item(page, 'colours-off')).toHaveClass(/checked/);
    await page.keyboard.press('Escape');
    expect(await docState(page), 'the picture and the undo stack are untouched').toEqual(before);

    await toggle(page, 'colours-off');
    expect(await shown(page, 16, 16)).toEqual(normalInk);
    expect(await shown(page, 17, 16)).toEqual(normalPaper);
});

test('Colour Grid alternates white and light grey by cell, and excludes Colours Off', async ({ page }) => {
    await boot(page);
    await seed(page);
    await toggle(page, 'colour-grid');
    expect(await shown(page, 16, 16), 'a set dot is black').toEqual(BLACK);
    expect(await shown(page, 17, 16), 'cell (2,2) paper is white').toEqual(WHITE);
    expect(await shown(page, 25, 16), 'cell (3,2) paper is the alternate').toEqual(ALT);

    await toggle(page, 'colours-off');
    await openView(page);
    await expect(item(page, 'colours-off')).toHaveClass(/checked/);
    await expect(item(page, 'colour-grid')).not.toHaveClass(/checked/);
    await page.keyboard.press('Escape');
    expect(await shown(page, 25, 16), 'Colours off has no chessboard').toEqual(WHITE);
});

test('Stop Flashing holds a flashing cell still; without it the cell flashes', async ({ page }) => {
    await boot(page);
    await seed(page);
    const sample = async () => {
        const seen = new Set();
        for (let i = 0; i < 14; i++) {
            seen.add((await shown(page, 24, 16)).join(','));
            await page.waitForTimeout(100);
        }
        return seen;
    };
    expect((await sample()).size, 'the cell flashes between two looks').toBe(2);
    await toggle(page, 'stop-flashing');
    const held = await sample();
    expect(held.size, 'stopped: one look only').toBe(1);
    // the normal phase: the dot is the ink, not the paper
    expect(await shown(page, 24, 16)).toEqual(await page.evaluate(() => Array.from(ColorManager.getRGB(1))));
    await toggle(page, 'stop-flashing');
    expect((await sample()).size, 'resumed: flashing again').toBe(2);
});

test('an image export is byte-identical with the switches on and off', async ({ page }) => {
    await boot(page);
    await seed(page);
    const hash = () => page.evaluate(() => {
        const d = LayerManager.stillImageData().data;
        let h = 2166136261;
        for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619) >>> 0;
        return h;
    });
    const off = await hash();
    await toggle(page, 'colours-off');
    expect(await hash()).toBe(off);
    await toggle(page, 'colour-grid');
    expect(await hash()).toBe(off);
    await toggle(page, 'stop-flashing');
    expect(await hash()).toBe(off);
});

test('rows are greyed out with a reason in the modes where they cannot apply', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const state = async () => {
        await openView(page);
        const out = {};
        for (const id of ['colours-off', 'stop-flashing', 'colour-grid']) {
            const el = item(page, id);
            out[id] = {
                disabled: (await el.getAttribute('class')).includes('disabled'),
                title: (await el.getAttribute('title')) || ''
            };
        }
        await page.keyboard.press('Escape');
        return out;
    };
    let s = await state();
    for (const id of Object.keys(s)) expect(s[id], `standard ULA ${id}`).toEqual({ disabled: false, title: '' });

    await selectMode(page, 'ula_plus');
    s = await state();
    expect(s['stop-flashing'].disabled, 'ULAplus does not flash').toBe(true);
    expect(s['stop-flashing'].title).not.toBe('');
    expect(s['colours-off'].disabled).toBe(false);
    expect(s['colour-grid'].disabled).toBe(false);

    await selectMode(page, 'timex_hires');
    s = await state();
    expect(s['colour-grid'].disabled, 'Timex hi-res has no cells').toBe(true);
    expect(s['colour-grid'].title).not.toBe('');
    expect(s['stop-flashing'].disabled).toBe(true);
    expect(s['colours-off'].disabled).toBe(false);

    await selectMode(page, 'layer2_256');
    s = await state();
    for (const id of Object.keys(s)) {
        expect(s[id].disabled, `Layer 2 ${id}`).toBe(true);
        expect(s[id].title, `Layer 2 ${id} hint`).not.toBe('');
    }
});

test('a greyed-out row does nothing when clicked', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await openView(page);
    await item(page, 'colours-off').click({ force: true });
    expect(await page.evaluate(() => StateManager.getDisplayView().coloursOff)).toBe(false);
});

test('the switches work from the keyboard', async ({ page }) => {
    await boot(page);
    await seed(page);
    await openView(page);
    await item(page, 'colours-off').focus();
    await page.keyboard.press('Enter');
    expect(await shown(page, 16, 16)).toEqual(BLACK);
    expect(await page.evaluate(() => StateManager.getDisplayView().coloursOff)).toBe(true);
});

test('the choices are remembered across a reload', async ({ page }) => {
    await boot(page);
    await toggle(page, 'colours-off');
    await toggle(page, 'stop-flashing');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => StateManager.getDisplayView())).toEqual(
        { coloursOff: true, stopFlashing: true, colourGrid: false });
    await openView(page);
    await expect(item(page, 'colours-off')).toHaveClass(/checked/);
    await expect(item(page, 'stop-flashing')).toHaveClass(/checked/);
    await page.keyboard.press('Escape');
});
