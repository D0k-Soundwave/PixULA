'use strict';
/**
 * Opening and closing a dialog must leave the event bus as it found it.
 *
 * Found 2026-09-27: every Preferences opening added two BACKUP_STATE_CHANGED
 * listeners that were never removed - one was never unsubscribed at all, the
 * other waited for a 'dialog-closed' event nothing sent - so each closed
 * dialog stayed referenced, and its handlers ran on every backup change.
 *
 * One warm-up opening first: a dialog may subscribe once, lazily, the first
 * time it is built, which is setup rather than a leak.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const DIALOG_ACTIONS = [
    'settings:preferences', 'settings:presets', 'help:about', 'help:shortcuts',
    'help:manual', 'image:editPalette', 'file:fontEditor', 'file:spriteEditor',
    'file:tapeBlocks'
];

test('opening and closing each dialog leaves no bus listeners behind', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const listeners = () => page.evaluate(() =>
        [...EventBus._listeners.values()].reduce((n, list) => n + list.length, 0));
    const cycle = (action) => page.evaluate(async (action) => {
        MenuSystem._executeAction(action);
        await new Promise((r) => setTimeout(r, 150));
        for (const id of [...Dialog._open.keys()]) Dialog.close(id);
    }, action);

    const grew = {};
    for (const action of DIALOG_ACTIONS) {
        await cycle(action);
        const before = await listeners();
        for (let i = 0; i < 3; i++) await cycle(action);
        const after = await listeners();
        // Only growth is a leak. The count can DROP here: a one-shot
        // subscription left by an earlier dialog may complete meanwhile.
        if (after > before) grew[action] = after - before;
    }
    expect(grew).toEqual({});
});

test('Preferences closed with OK releases its listeners too', async ({ page }) => {
    await boot(page);
    const count = () => page.evaluate(() => EventBus.listenerCount(EVENTS.BACKUP_STATE_CHANGED));
    const before = await count();
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => PreferencesDialog.open());
        await page.locator('#dialog-preferences-dialog .app-dialog-footer button.primary').click();
        await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    }
    expect(await count()).toBe(before);
});
