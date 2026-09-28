'use strict';
/**
 * Counts read correctly in languages with more than two plural forms.
 *
 * Found 2026-09-27: every count had a singular and one plural, so Polish
 * said "2 minut temu" and "2 bajtów", where it needs "2 minuty temu" and
 * "2 bajty" (Czech, Slovak, Russian and Romanian likewise). The autosave
 * prompt also doubled its "ago" in most languages ("von vor vor 2 Minuten").
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('plural forms follow each language\'s rules', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const say = (code, key, ns) => { I18n.setLocale(code); return ns.map((n) => I18n.plural(key, n)); };
        const out = {
            en: say('en', 'plural.minutesAgo', [1, 2]),
            pl: say('pl', 'plural.minutesAgo', [1, 2, 5, 22, 25]),
            plBytes: say('pl', 'plural.tapeBytes', [6912, 6922]),
            cs: say('cs', 'plural.tapeBytes', [1, 3, 17]),
            ru: say('ru', 'plural.hoursAgo', [1, 3, 11, 21]),
            ro: say('ro', 'plural.tapeBytes', [1, 19, 20])
        };
        I18n.setLocale('en');
        return out;
    });
    expect(r.en).toEqual(['1 minute ago', '2 minutes ago']);
    expect(r.pl).toEqual(['1 minutę temu', '2 minuty temu', '5 minut temu', '22 minuty temu', '25 minut temu']);
    expect(r.plBytes).toEqual(['6912 bajtów', '6922 bajty']);
    expect(r.cs).toEqual(['1 bajt', '3 bajty', '17 bajtů']);
    expect(r.ru).toEqual(['1 час назад', '3 часа назад', '11 часов назад', '21 час назад']);
    expect(r.ro).toEqual(['1 octet', '19 octeți', '20 de octeți']);
});

test('the English fallback picks singular or plural without I18n', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const f = 'one: {n} byte | other: {n} bytes';
        return [Helpers.localizedPlural('plural.none', 1, f), Helpers.localizedPlural('plural.none', 7, f)];
    });
    expect(r).toEqual(['1 byte', '7 bytes']);
});

test('one parser for plural forms, and one set of rules per language', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        // A mistyped tag is ignored by the fallback exactly as by I18n.plural
        const typo = Helpers.localizedPlural('plural.none', 1, 'on: {n} byte | other: {n} bytes');
        I18n.setLocale('pl');
        for (let n = 0; n < 50; n++) I18n.plural('plural.tapeBytes', n);
        const rules = I18n._pluralRules.get('pl');
        I18n.plural('plural.tapeBytes', 3);
        const same = I18n._pluralRules.get('pl') === rules;
        I18n.setLocale('en');
        return { typo, same, cached: rules instanceof Intl.PluralRules };
    });
    expect(r).toEqual({ typo: '1 bytes', same: true, cached: true });
});

for (const [code, expected] of [
    ['pl', '(zapisaną automatycznie 2 minuty temu)'],
    ['de', '(gesichert vor 2 Minuten)'],
    ['en', 'from 2 minutes ago']
]) {
    test(`${code}: the autosave prompt says how long ago once`, async ({ page }) => {
        await boot(page);
        await page.evaluate(async (code) => {
            I18n.setLocale(code);
            const project = App._getProjectData();
            project.timestamp = Date.now() - 150000; // two and a half minutes
            await Storage.set('autosave', project);
        }, code);
        let prompt = null;
        page.on('dialog', (d) => { if (d.type() === 'confirm') prompt = d.message(); d.dismiss(); });
        await reload(page);
        expect(prompt).toContain(expected);
    });
}
