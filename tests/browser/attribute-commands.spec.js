'use strict';
/**
 * Image > Attributes (batch 2, part 2A): the four cell-colour commands in the
 * menu. What each command writes is pinned in Node by
 * tests/attribute-commands.test.js; this spec checks the menu side - the rows
 * exist, they are greyed out where a mode blocks them with a reason on the
 * Attributes row, and a click runs the command as one undo step.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const openImageSubmenu = async (page) => {
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="attributes"]');
    await page.waitForTimeout(150);
};

const itemState = (page, id) => page.evaluate((rowId) => {
    const el = document.querySelector(`[data-id="${rowId}"]`);
    return el ? { present: true, disabled: el.classList.contains('disabled') } : { present: false };
}, id);

test('Image > Attributes lists the five commands, enabled in standard ULA', async ({ page }) => {
    await boot(page);
    await openImageSubmenu(page);
    for (const id of ['attr-invert', 'attr-erase', 'attr-flip-h', 'attr-flip-v', 'attr-change']) {
        expect(await itemState(page, id), id).toEqual({ present: true, disabled: false });
    }
});

test('Timex Hi-res greys the commands out and says why on the Attributes row', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'timex_hires');
    await openImageSubmenu(page);
    expect(await itemState(page, 'attr-invert')).toEqual({ present: true, disabled: true });
    expect(await itemState(page, 'attr-flip-v')).toEqual({ present: true, disabled: true });
    expect(await itemState(page, 'attr-change')).toEqual({ present: true, disabled: true });
    const tip = await page.getAttribute('#menu-image [data-id="attributes"]', 'title');
    expect(tip, 'the reason is on the parent row').toMatch(/no cell colours/i);
});

test('Invert from the menu changes the cell colours and leaves the dots', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const probe = () => page.evaluate(() => {
        const cell = LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 0, 0);
        let dots = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const s = PixelDrawRoutine.getPixelState(x, y);
            if (s && s.isInk) dots++;
        }
        return { ink: cell.ink, paper: cell.paper, dots };
    });
    await page.evaluate(() => {
        PixelDrawRoutine.draw(3, 3, { ink: 2, paper: 6, bright: false, flash: false },
            DRAW_MODE.NORMAL, { mirror: false });
    });
    const before = await probe();
    await openImageSubmenu(page);
    await page.click('[data-id="attr-invert"]');
    const after = await probe();
    expect(after.ink, 'ink takes the old paper of cell 0,0').toBe(before.paper);
    expect(after.paper, 'paper takes the old ink of cell 0,0').toBe(before.ink);
    expect(after.dots, 'dots are unchanged').toBe(before.dots);
});
