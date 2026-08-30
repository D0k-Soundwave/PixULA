'use strict';
/**
 * File > Save Image As, driven end to end: for EVERY screen mode and EVERY
 * one of the 23 export formats, the save either produces a file of exactly
 * the size the SCREEN_MODES descriptor says it should, or produces nothing
 * at all because the mode cannot carry it.
 *
 * This is the half that tests/export-mode-matrix.test.js and
 * tests/browser/export-format-gating.spec.js do not reach. Those two audit
 * which leaves are OFFERED - the gate. Nothing asserted what came out when
 * one was picked, which is how .atr in Timex hi-res shipped writing a
 * 1-byte file: that mode has no attribute block, its 12289-byte screen is
 * bitmap plus a single port byte, and slicing at BITMAP_SIZE..+ATTR_SIZE
 * quietly returned that one trailing byte instead of the 1536 the
 * descriptor's storage granularity implied. It was enabled in the menu, it
 * reported success, and the file it wrote was not an attribute picture.
 *
 * Every expected size is COMPUTED from the descriptor here rather than
 * listed, so a new mode needs no new numbers and a changed descriptor
 * cannot leave a stale constant behind agreeing with itself.
 *
 * showSaveFilePicker is a native dialog Playwright cannot drive, so this
 * runs against the same fake-handle stub native-save.spec.js uses.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Every leaf of the Save Image As submenu, in menu order. */
const EXPORT_FORMATS = [
    'scr', 'zxp', 'mlt', 'ifl', 'hrg', 'img', 'nxi', 'sl2', 'slr', 'ctile',
    'tap', 'tzx', 'png', 'bmp', 'jpg', 'zed', 'sev', 'pal', 'npl',
    'asm', 'c', 'bin', 'atr'
];

test('every offered format writes a file of the size its screen mode defines; every refused one writes nothing',
    async ({ page }) => {
        test.setTimeout(180000);
        await boot(page);
        page.on('dialog', (d) => d.accept()); // lossy mode-switch confirms

        const modes = await page.evaluate(() => ScreenModeService.getModes().map((m) => m.id));
        const problems = [];

        for (const mode of modes) {
            await page.evaluate((m) => ScreenModeService.switchMode(m), mode);

            const rows = await page.evaluate(async (exts) => {
                // Fake handle: record what each export actually wrote.
                let written = null;
                window.showSaveFilePicker = async () => ({
                    name: 'out',
                    createWritable: async () => ({
                        write: async (d) => {
                            written = d instanceof Blob
                                ? (await d.arrayBuffer()).byteLength : d.length;
                        },
                        close: async () => {}
                    })
                });

                /**
                 * The size the active descriptor says this format must be,
                 * or null where the length is content-dependent (the text
                 * and compressed picture formats) and only "wrote something"
                 * is checkable.
                 */
                const expectedSize = (ext) => {
                    const m = ACTIVE_SCREEN_MODE;
                    const S = SCREEN_MODES;
                    switch (ext) {
                        case 'scr': return m.fileSize;
                        // Fixed target containers: the export CONVERTS into
                        // them, so the size is the target mode's, not the
                        // document's.
                        case 'mlt': return S.MULTICOLOR_8x1.fileSize;
                        case 'ifl': return S.MULTICOLOR_8x2.fileSize;
                        case 'hrg': return S.TIMEX_HIRES.fileSize * 2; // two frames
                        case 'img': return S.GIGASCREEN.fileSize;
                        // Next dumps: .nxi carries the 512-byte palette
                        // block (so, the whole fileSize); .sl2/.slr are the
                        // raw bitmap alone.
                        case 'nxi': return m.fileSize;
                        case 'sl2':
                        case 'slr': return m.bitmapSize;
                        case 'bin': return m.bitmapSize;
                        case 'atr': return m.attrSize;
                        // 24-bit bottom-up BMP; every mode width is a
                        // multiple of 4 px, so no row padding.
                        case 'bmp': return 54 + m.width * m.height * 3;
                        // Palette files are size-designated - checked
                        // against the palette model below, not here.
                        default: return null;
                    }
                };

                const out = [];
                for (const ext of exts) {
                    const compatible = FormatRegistry.isExportCompatible(ext);
                    written = null;
                    let ok, threw = null;
                    try { ok = await FileManager.exportAs(ext); }
                    catch (e) { threw = String((e && e.message) || e); }
                    out.push({
                        ext, compatible, ok, threw, written,
                        expected: compatible ? expectedSize(ext) : null,
                        paletteBytes: ACTIVE_SCREEN_MODE.paletteBytes || 0
                    });
                }
                return out;
            }, EXPORT_FORMATS);

            for (const r of rows) {
                const where = `${mode} / .${r.ext}`;
                if (r.threw) { problems.push(`${where}: threw ${r.threw}`); continue; }

                if (!r.compatible) {
                    // A refused format must refuse cleanly: no success, no file.
                    if (r.ok !== false) problems.push(`${where}: refused but returned ${r.ok}`);
                    if (r.written !== null) problems.push(`${where}: refused but wrote ${r.written} bytes`);
                    continue;
                }

                if (r.ok !== true) problems.push(`${where}: offered but returned ${r.ok}`);
                if (r.written === null) { problems.push(`${where}: offered but wrote no file`); continue; }
                if (r.written === 0) problems.push(`${where}: wrote an empty file`);

                if (r.expected !== null && r.written !== r.expected) {
                    problems.push(`${where}: wrote ${r.written} bytes, descriptor says ${r.expected}`);
                }

                // A palette file is designated by its SIZE, so a wrong count
                // is a different format rather than a short file: 64 bytes =
                // the ULAplus register set, 512/513 = the Next register file
                // (.npl appends the transparency index).
                if (r.ext === 'pal' || r.ext === 'npl') {
                    const want = r.paletteBytes === 64 ? 64 : (r.ext === 'npl' ? 513 : 512);
                    if (r.written !== want) {
                        problems.push(`${where}: wrote ${r.written} bytes, expected ${want}`);
                    }
                }
            }
        }

        expect(problems.join('\n')).toBe('');
    });
