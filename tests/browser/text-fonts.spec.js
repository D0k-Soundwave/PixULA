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

test('queryLocalFonts is never called - it can show a real browser permission dialog',
    async ({ page }) => {
        await boot(page);

        // Regression pin: a persistent, un-mockable "This file wants to use
        // the fonts on your computer" dialog appeared on this exact file://
        // app (found 2026-08-23) - the text tool used to call
        // window.queryLocalFonts() unconditionally (later, on a companion-
        // backed branch, it was tried as a fallback). It must never be
        // called at all any more, under any circumstance.
        const r = await page.evaluate(() => {
            let called = false;
            window.queryLocalFonts = async () => { called = true; return []; };

            const tool = ToolManager.getTool(TOOLS.TEXT);
            tool._cachedFonts = null;
            tool._enumerateFonts();
            tool._cachedFonts = null;

            return called;
        });

        expect(r).toBe(false);
    });

test('the library changing invalidates the cached font list', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        tool._cachedFonts = null;

        const first = tool._enumerateFonts();
        const stillCached = tool._enumerateFonts() === first; // same array instance

        EventBus.emit(EVENTS.FONT_LIBRARY_CHANGED);
        const invalidated = tool._cachedFonts === null;

        return { stillCached, invalidated, count: first.length };
    });

    expect(r.count).toBeGreaterThan(20);
    expect(r.stillCached).toBe(true);
    expect(r.invalidated).toBe(true);
});
