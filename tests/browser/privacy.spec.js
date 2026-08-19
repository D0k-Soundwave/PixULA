'use strict';
/**
 * The Privacy block in Preferences.
 *
 * There is no consent gate and deliberately so: the app has no network access,
 * so there is no recipient and nothing to consent to. What GDPR actually asks
 * for in that situation is transparency and a way to withdraw - a truthful
 * account of what is held, and a button that deletes it. That is what this is.
 *
 * The first spec is the load-bearing one: it asserts the claim the statement
 * makes. If someone ever adds a fetch, the paragraph in Preferences becomes a
 * false statement about privacy, and this fails.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const openPreferences = async (page) => {
    await page.click('.menu-item[data-menu="settings"]');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await page.waitForSelector('#pref-privacy');
};

test('the app makes no network requests at all', async ({ page }) => {
    const requests = [];
    page.on('request', (req) => {
        const url = req.url();
        // The page and its own files are not "network"; anything else is.
        if (!url.startsWith('file://') && !url.startsWith('data:') &&
            !url.startsWith('blob:') && !url.startsWith('about:')) {
            requests.push(url);
        }
    });

    await boot(page);
    // Exercise the paths most likely to reach out, if any did
    await page.evaluate(async () => {
        PixelDrawRoutine.draw(2, 2, { mirror: false });
        await Storage.set('autosave', App._getProjectData());
        await PatternService.savePatternData('probe', 8, new Uint8Array(64).fill(1));
    });
    await openPreferences(page);
    await page.waitForTimeout(500);

    expect(requests).toEqual([]);
});

test('the privacy block reports what is actually stored, by counting it',
    async ({ page }) => {
        await boot(page);

        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                await PatternService.savePatternData('probe ' + i, 8, new Uint8Array(64).fill(1));
            }
        });

        await openPreferences(page);
        const usage = page.locator('#pref-privacy-usage');
        await expect(usage).not.toHaveText(/Counting/);
        // Counted, not asserted: three patterns were just written
        await expect(usage).toContainText('patterns: 3');
        await expect(usage).toContainText('KB');
    });

test('an empty store is left out rather than printed as a zero', async ({ page }) => {
    await boot(page);

    const text = await page.evaluate(async () => {
        const info = await Storage.describeUsage();
        return {
            hasEmpty: info.stores.some(s => s.records === 0),
            allStoresListed: info.stores.length === Object.keys(Storage.STORES).length
        };
    });

    // describeUsage reports every store; the UI is what filters
    expect(text.allStoresListed).toBe(true);
    expect(text.hasEmpty).toBe(true);

    await openPreferences(page);
    const usage = await page.locator('#pref-privacy-usage').textContent();
    expect(usage).not.toContain(': 0');
});

test('the outside-the-browser list names the backup folder and the photo link',
    async ({ page }) => {
        await boot(page);

        await openPreferences(page);
        // Nothing linked yet
        await expect(page.locator('#pref-privacy-disk')).toContainText(/Nothing/i);

        await page.evaluate(() => {
            BackupService.directory = { name: 'My Backups' };
            BackupService.needsPermission = false;
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, BackupService.getState());
        });

        await expect(page.locator('#pref-privacy-disk')).toContainText('My Backups');
    });

test('clearing empties every store and every pixula- key', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        await PatternService.savePatternData('probe', 8, new Uint8Array(64).fill(1));
        await Storage.set('autosave', { layers: [] });
        localStorage.setItem('pixula-probe', '1');
        localStorage.setItem('somebody-elses-key', 'keep me');

        const before = await Storage.describeUsage();
        const result = await Storage.clearEverything();
        const after = await Storage.describeUsage();

        return {
            before: before.stores.reduce((n, s) => n + (s.records || 0), 0),
            after: after.stores.reduce((n, s) => n + (s.records || 0), 0),
            storeCount: Object.keys(Storage.STORES).length,
            cleared: result,
            ourKeyGone: localStorage.getItem('pixula-probe') === null,
            theirKeyKept: localStorage.getItem('somebody-elses-key') === 'keep me'
        };
    });

    expect(r.before).toBeGreaterThan(0);
    expect(r.after).toBe(0);
    // What this test is really about: EVERY store in Storage.STORES was
    // cleared, none skipped. Read the count from the registry rather than
    // restating it, so adding a store cannot leave this asserting the old
    // number (which is exactly what the COMPANION store, DB v8, did to the
    // literal 10 that used to sit here).
    expect(r.cleared.stores).toBe(r.storeCount);
    expect(r.storeCount).toBe(11); // 11 as of DB v8; a new store is a deliberate edit here
    // Withdrawal deletes OUR data, not everything on the origin
    expect(r.ourKeyGone).toBe(true);
    expect(r.theirKeyKept).toBe(true);
});

test('clearing does not touch files the artist saved themselves', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        // A stand-in folder holding two backup versions
        const files = new Map([['Castle V1.pixula', new Uint8Array([1])],
                               ['Castle V2.pixula', new Uint8Array([1])]]);
        BackupService.directory = {
            name: 'Backups',
            removeEntry: async (n) => { files.delete(n); },
            entries: async function* () { for (const k of [...files.keys()]) yield [k, { kind: 'file' }]; }
        };

        await Storage.clearEverything();
        return { remaining: files.size };
    });

    // Deleting someone's artwork to honour a privacy request is the opposite
    // of the point
    expect(r.remaining).toBe(2);
});

test('the privacy statement is translated, not just the English fallback',
    async ({ page }) => {
        await boot(page);
        await page.evaluate(() => I18n.setLocale('de'));
        await openPreferences(page);

        const text = await page.locator('#pref-privacy .pref-block__hint').first().textContent();
        expect(text).toContain('Netzwerkzugriff');
        expect(text).not.toContain('network access');
    });
