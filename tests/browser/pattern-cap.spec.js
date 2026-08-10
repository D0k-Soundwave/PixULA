'use strict';
/**
 * The user pattern library has a limit, on the same convention as every other
 * store.
 *
 * PATTERNS was the one persistence path with no bound of any kind - not a
 * count, not a byte cap - which survived only because the records are small.
 * MAX_USER_PATTERNS (256) matches FontService.MAX_LIBRARY_FONTS, and the rule
 * that re-saving an existing name is exempt matches both the font library and
 * the tool presets: replacing a record does not add one.
 *
 * Sizing (M, 2026-08-07, navigator.storage.estimate deltas in this harness):
 * 50 patterns of each size = 150 records = 62,519 B. The worst case the cap
 * allows - 256 records, all 32x32, 48-character names - is 146,086 B.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const clearPatterns = (page) => page.evaluate(async () => {
    for (const r of await Storage.getAll(Storage.STORES.PATTERNS)) {
        await Storage.delete(r.id ?? r.key ?? (r.value || r).name, Storage.STORES.PATTERNS);
    }
});

const fill = (page, n, size) => page.evaluate(async ({ n, size }) => {
    const bitmap = new Uint8Array(size * size).fill(1);
    for (let i = 0; i < n; i++) {
        await PatternService.savePatternData('bulk ' + i, size, bitmap);
    }
    return (await Storage.getAll(Storage.STORES.PATTERNS)).length;
}, { n, size });

test('the cap matches the font library convention', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => ({
        patterns: PatternService.MAX_USER_PATTERNS,
        fonts: FontService.MAX_LIBRARY_FONTS,
        name: PatternService.MAX_PATTERN_NAME,
        presetName: PresetCodec.MAX_NAME
    }));
    expect(r.patterns).toBe(256);
    expect(r.patterns).toBe(r.fonts);
    expect(r.name).toBe(r.presetName);
});

test('saving past the cap fails rather than growing without bound', async ({ page }) => {
    await boot(page);
    await clearPatterns(page);

    const r = await page.evaluate(async () => {
        const max = PatternService.MAX_USER_PATTERNS;
        const bitmap = new Uint8Array(64).fill(1);
        for (let i = 0; i < max; i++) {
            await PatternService.savePatternData('bulk ' + i, 8, bitmap);
        }
        const atCap = (await Storage.getAll(Storage.STORES.PATTERNS)).length;

        let announced = null;
        const off = EventBus.on(EVENTS.PATTERN_LIBRARY_FULL, (d) => { announced = d; });
        const overflow = await PatternService.savePatternData('one too many', 8, bitmap);
        off();

        return {
            atCap, overflow, announced,
            after: (await Storage.getAll(Storage.STORES.PATTERNS)).length
        };
    });

    expect(r.atCap).toBe(256);
    expect(r.overflow).toBe(false);
    expect(r.after).toBe(256);          // the rejected one was not written
    expect(r.announced).toEqual({ max: 256 });
});

test('re-saving an existing name replaces it, cap or no cap', async ({ page }) => {
    await boot(page);
    await clearPatterns(page);

    const r = await page.evaluate(async () => {
        const max = PatternService.MAX_USER_PATTERNS;
        for (let i = 0; i < max; i++) {
            await PatternService.savePatternData('bulk ' + i, 8, new Uint8Array(64).fill(1));
        }
        // A full library must still let you edit what is already in it
        const replaced = await PatternService.savePatternData(
            'bulk 0', 8, new Uint8Array(64).fill(0));
        const all = await Storage.getAll(Storage.STORES.PATTERNS);
        const hits = all.filter(r => (r.value ?? r).name === 'bulk 0');
        return {
            replaced,
            count: all.length,
            copies: hits.length,
            allZero: Array.from((hits[0].value ?? hits[0]).data).every(b => b === 0)
        };
    });

    expect(r.replaced).toBe(true);
    expect(r.count).toBe(256);    // replaced in place, not added
    expect(r.copies).toBe(1);     // and not left as a twin
    expect(r.allZero).toBe(true); // and it really is the new bitmap
});

test('saving one name repeatedly leaves one record, not a pile', async ({ page }) => {
    await boot(page);
    await clearPatterns(page);

    // The store is keyed by an autoIncrement id, so Storage.set appends. Before
    // savePatternData looked for the name first, pressing Save five times in
    // the Pattern Creator left five entries the library could not distinguish -
    // and nothing bounded how far that went.
    const r = await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
            await PatternService.savePatternData('same name', 8, new Uint8Array(64).fill(1));
        }
        const user = await PatternService.getUserPatterns();
        return {
            records: (await Storage.getAll(Storage.STORES.PATTERNS)).length,
            listed: user.length
        };
    });

    expect(r.records).toBe(1);
    expect(r.listed).toBe(1);
});

test('an empty name is refused, and a long one is trimmed to the cap', async ({ page }) => {
    await boot(page);
    await clearPatterns(page);

    const r = await page.evaluate(async () => {
        const bitmap = new Uint8Array(64).fill(1);
        const blank = await PatternService.savePatternData('   ', 8, bitmap);
        const long = await PatternService.savePatternData('n'.repeat(200), 8, bitmap);
        const names = (await Storage.getAll(Storage.STORES.PATTERNS))
            .map(x => (x.value ?? x).name);
        return { blank, long, names };
    });

    expect(r.blank).toBe(false);
    expect(r.long).toBe(true);
    expect(r.names).toEqual(['n'.repeat(48)]);
});

test('the Pattern Creator saves through the service, so the cap applies there too',
    async ({ page }) => {
        await boot(page);
        await clearPatterns(page);
        await fill(page, 256, 8);

        // The creator used to write straight to Storage, which meant the cap
        // only applied to whichever path you happened to use
        const r = await page.evaluate(async () => {
            const panel = window.PatternCreatorPanel;
            if (!panel || typeof panel._save !== 'function') return { skipped: true };
            panel._name = 'from the creator';
            await panel._save();
            const names = (await Storage.getAll(Storage.STORES.PATTERNS))
                .map(x => (x.value ?? x).name);
            return {
                count: names.length,
                leaked: names.includes('from the creator')
            };
        });

        expect(r.skipped).toBeUndefined();
        expect(r.count).toBe(256);
        expect(r.leaked).toBe(false);
    });

test('50 of each size is far inside the cap, and small on disk', async ({ page }) => {
    await boot(page);
    await clearPatterns(page);

    const r = await page.evaluate(async () => {
        const before = (await navigator.storage.estimate()).usage;
        for (const size of [8, 16, 32]) {
            const bitmap = new Uint8Array(size * size);
            for (let j = 0; j < bitmap.length; j++) bitmap[j] = Math.random() < 0.5 ? 1 : 0;
            for (let i = 0; i < 50; i++) {
                await PatternService.savePatternData('user pattern ' + size + ' ' + i, size, bitmap);
            }
        }
        const after = (await navigator.storage.estimate()).usage;
        return {
            count: (await Storage.getAll(Storage.STORES.PATTERNS)).length,
            bytes: after - before,
            max: PatternService.MAX_USER_PATTERNS
        };
    });

    expect(r.count).toBe(150);
    expect(r.count).toBeLessThan(r.max);
    // M: 62,519 B across five runs (62,393 - 62,583). A generous band, because
    // storage.estimate() is page-quantized: the point is the ORDER, ~60 KB
    expect(r.bytes).toBeGreaterThan(30 * 1024);
    expect(r.bytes).toBeLessThan(160 * 1024);
});
