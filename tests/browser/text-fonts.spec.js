'use strict';
/**
 * System font detection.
 *
 * The text tool used to offer sixteen hardcoded family names on file://,
 * because queryLocalFonts() resolves with an EMPTY ARRAY there rather than
 * throwing, and the old code cached that fallback for the session. These specs
 * pin the replacement: probe-based detection that finds what is really
 * installed, and does not offer one typeface twice under a legacy alias.
 *
 * Counts are machine-dependent, so nothing here asserts an exact number - only
 * that detection is doing real work and that its rules hold.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('detection finds far more than the old hardcoded list, and only real fonts',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const detected = FontProbe.detect();
            return {
                candidates: FontProbe.CANDIDATES.length,
                detected: detected.length,
                // Every result must be a candidate; detection cannot invent names
                allFromCandidates: detected.every(f => FontProbe.CANDIDATES.includes(f)),
                sorted: detected.every((f, i) => i === 0 || f.localeCompare(detected[i - 1]) >= 0),
                stable: JSON.stringify(FontProbe.detect()) === JSON.stringify(detected)
            };
        });

        expect(r.candidates).toBeGreaterThanOrEqual(250);
        // The old list was 16. Any machine running this has more than that.
        expect(r.detected).toBeGreaterThan(20);
        expect(r.detected).toBeLessThanOrEqual(r.candidates);
        expect(r.allFromCandidates).toBe(true);
        expect(r.sorted).toBe(true);
        expect(r.stable).toBe(true);
    });

test('a legacy alias is not offered alongside the font it resolves to',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const cvs = document.createElement('canvas');
            const ctx = cvs.getContext('2d');
            const P = 'mmmmmmmmmmlli WM@1234567890';
            const w = (family, generic) => {
                ctx.font = `72px "${family}", ${generic}`;
                return ctx.measureText(P).width;
            };
            const generics = ['monospace', 'sans-serif', 'serif'];
            const identical = (a, b) => generics.every(g => w(a, g) === w(b, g));

            const detected = new Set(FontProbe.detect());
            const out = [];
            for (const [alias, target] of [['Helvetica', 'Arial'], ['Times', 'Times New Roman'],
                                           ['Courier', 'Courier New']]) {
                out.push({ alias, target, same: identical(alias, target),
                           aliasListed: detected.has(alias), targetListed: detected.has(target) });
            }
            return out;
        });

        for (const row of r) {
            if (row.same) {
                // Substituted here: the system serves the target, so listing the
                // alias would offer one typeface twice under two names.
                expect(row.aliasListed).toBe(false);
            } else if (row.aliasListed) {
                // Genuinely a different font on this machine - keeping it is right.
                expect(row.same).toBe(false);
            }
        }
    });

test('the font family select is populated from detection, ZX ROM first',
    async ({ page }) => {
        await boot(page);
        await page.click('#tool-rail .tool-btn[data-tool="text"]');

        await page.waitForFunction(() => {
            const s = [...document.querySelectorAll('#tool-options-panel-content select')]
                .find(x => x.name === 'fontFamily' || x.id === 'opt-fontFamily');
            return s && s.options.length > 20;
        });

        const r = await page.evaluate(() => {
            const s = [...document.querySelectorAll('#tool-options-panel-content select')]
                .find(x => x.name === 'fontFamily' || x.id === 'opt-fontFamily');
            const values = [...s.options].map(o => o.value);
            return { first: values[0], count: values.length,
                     detected: FontProbe.detect().length };
        });

        // The bitmap fonts lead; ZX ROM is always the first of them
        expect(r.first).toBe('ZX ROM');
        // The list is the bitmap fonts plus everything detected
        expect(r.count).toBeGreaterThanOrEqual(r.detected + 1);
    });

test('a failed enumeration is not cached for the session', async ({ page }) => {
    await boot(page);

    // queryLocalFonts resolving empty is a FAILURE, not an answer: the old code
    // cached the fallback on the first call and could never recover.
    const r = await page.evaluate(async () => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        tool._cachedFonts = null;

        const real = window.queryLocalFonts;
        window.queryLocalFonts = async () => [];         // the file:// behaviour
        const viaProbe = await tool._enumerateFonts();
        const cachedAfterFailure = tool._cachedFonts;

        // Now let it succeed, as it would over http(s) with permission granted
        window.queryLocalFonts = async () => [{ family: 'Pretend Sans' }];
        const viaApi = await tool._enumerateFonts();
        window.queryLocalFonts = real;
        tool._cachedFonts = null;

        return { probeCount: viaProbe.length, cachedAfterFailure,
                 apiWon: viaApi.includes('Pretend Sans'), apiCount: viaApi.length };
    });

    expect(r.probeCount).toBeGreaterThan(20);
    expect(r.cachedAfterFailure).toBeNull();   // nothing pinned
    expect(r.apiWon).toBe(true);               // the later success takes over
});
