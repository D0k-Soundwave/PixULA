'use strict';
/**
 * FontRasterizer against a REAL font, in a real browser.
 *
 * tests/font-rasterizer.test.js (Node) pins the contract - glyph count,
 * Uint8Array(8) rows, width masking - but its canvas stub draws nothing and
 * returns all-zero alpha, so every one of those assertions also passes on a
 * rasterizer that produces nothing at all. That is exactly how a version
 * that rendered blank/clipped glyphs shipped. This spec closes that hole:
 * it hands FontRasterizer the bytes of an actual installed font and asserts
 * the bitmaps contain real, plausible letterforms.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** First installed font file we can find, whatever platform this runs on. */
const FONT_CANDIDATES = [
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
    'C:/Windows/Fonts/verdana.ttf',
    'C:/Windows/Fonts/tahoma.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
];

function findFont() {
    for (const p of FONT_CANDIDATES) {
        try {
            if (fs.statSync(p).isFile()) return p;
        } catch (e) { /* next candidate */ }
    }
    return null;
}

const FONT_PATH = findFont();

/** Rasterize in the page and bring the rows back as plain arrays. */
async function rasterize(page, fontPath, opts) {
    const bytes = Array.from(fs.readFileSync(fontPath));
    return page.evaluate(async ({ bytes, opts }) => {
        const buf = new Uint8Array(bytes).buffer;
        const glyphs = await FontRasterizer.rasterize(buf, opts);
        return glyphs.map((g) => Array.from(g));
    }, { bytes, opts });
}

const bits = (rows) => rows.reduce((n, byte) => n + byte.toString(2).split('1').length - 1, 0);
const inkedRows = (rows) => rows.filter((byte) => byte !== 0).length;

/** ASCII art, printed into the test log so a human can see the letterform. */
function art(label, rows, cellWidth) {
    const lines = rows.map((byte) => {
        let s = '';
        for (let x = 0; x < cellWidth; x++) s += (byte & (0x80 >> x)) ? '#' : '.';
        return s;
    });
    return `${label}\n${lines.join('\n')}`;
}

test.describe('FontRasterizer with a real font', () => {
    test.skip(!FONT_PATH, 'no installed TTF found on this machine to rasterize');

    test('produces real, non-blank, non-saturated letterforms', async ({ page }) => {
        await boot(page);

        const firstCode = 32;
        const cellWidth = 8;
        const glyphs = await rasterize(page, FONT_PATH, {
            pointSize: 12, cellWidth, firstCode, count: 96
        });
        expect(glyphs).toHaveLength(96);

        const at = (ch) => glyphs[ch.charCodeAt(0) - firstCode];

        // Print the letterforms this run actually produced - the whole point
        // of this spec is that a human can see them, not just a green tick.
        for (const ch of ['A', 'M', 'W', 'H', 'E', 'g', 'a', 'i', '0']) {
            console.log(art(`${FONT_PATH} 12px '${ch}'`, at(ch), cellWidth));
        }

        // Space must be blank; letters must not be.
        expect(bits(at(' '))).toBe(0);

        for (const ch of ['A', 'M', 'W', 'H', 'E', 'N', 'a', 'e', 'o', '0', '8']) {
            const g = at(ch);
            const n = bits(g);
            // Not blank (the shipped bug), not a solid block (a threshold
            // that inks everything is just as unusable as one that inks
            // nothing) - a real 8x8 letter lands well inside these bounds.
            expect(n, `'${ch}' should carry ink`).toBeGreaterThan(5);
            expect(n, `'${ch}' should not be a solid block`).toBeLessThan(48);
            // And it must occupy several rows: a glyph clipped out of frame
            // by bad vertical placement shows up as ink in one or two rows.
            expect(inkedRows(g), `'${ch}' should span several rows`).toBeGreaterThanOrEqual(4);
        }

        // The thin-stem characters are the ones that vanished: a stem at
        // this size is under one pixel wide, so unless the glyph is snapped
        // to the pixel grid it splits across two columns at ~35% each and
        // disappears under any usable threshold, leaving holes in the middle
        // of the alphabet.
        for (const ch of ['I', 'l', 'i', '1', '!']) {
            const g = at(ch);
            console.log(art(`${FONT_PATH} 12px '${ch}'`, g, cellWidth));
            expect(bits(g), `'${ch}' must not be blank`).toBeGreaterThan(0);
            expect(inkedRows(g), `'${ch}' must be a real stem, not one stray pixel`).toBeGreaterThanOrEqual(3);
        }

        // Every row byte must fit the cell width and be a byte.
        for (const g of glyphs) {
            expect(g).toHaveLength(8);
            for (const byte of g) expect(byte).toBeGreaterThanOrEqual(0);
        }

        // The capitals share one baseline: their ink must end on the same
        // row. A per-glyph "centre it in the cell" placement (the other
        // obvious way to fix clipping) fails this, and reads as ransom-note
        // text in a word.
        const lastInkRow = (g) => g.reduce((last, byte, y) => (byte ? y : last), -1);
        const baselines = ['A', 'M', 'H', 'E', 'N', 'T'].map((ch) => lastInkRow(at(ch)));
        expect(new Set(baselines).size, `capitals must share a baseline, got rows ${baselines}`).toBe(1);
    });

    test('masks to the cell width and honours smaller point sizes', async ({ page }) => {
        await boot(page);

        for (const cellWidth of [4, 6]) {
            const glyphs = await rasterize(page, FONT_PATH, {
                pointSize: 12, cellWidth, firstCode: 65, count: 26
            });
            const mask = (0xFF << (8 - cellWidth)) & 0xFF;
            for (const g of glyphs) {
                for (const byte of g) expect(byte & ~mask).toBe(0);
            }
            // Narrow cells still carry ink - masking must not be the only
            // thing that happened.
            expect(bits(glyphs[0])).toBeGreaterThan(3);
            console.log(art(`${FONT_PATH} 12px 'A' at width ${cellWidth}`, glyphs[0], cellWidth));
        }

        // A size small enough to fit the cell is honoured as asked, so it
        // produces visibly less ink than one that has to be fitted down.
        const small = await rasterize(page, FONT_PATH, { pointSize: 5, cellWidth: 8, firstCode: 65, count: 1 });
        const large = await rasterize(page, FONT_PATH, { pointSize: 12, cellWidth: 8, firstCode: 65, count: 1 });
        console.log(art(`${FONT_PATH} 5px 'A'`, small[0], 8));
        expect(inkedRows(small[0])).toBeLessThan(inkedRows(large[0]));
        expect(bits(small[0])).toBeGreaterThan(0);
    });
});
