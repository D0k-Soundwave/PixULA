'use strict';
/**
 * Save it, load it back, save it again - the bytes must match.
 *
 * For every screen mode and every format the app can both write AND read,
 * this exports the document, feeds those exact bytes back to the same
 * handler's parse(), and exports a second time. Anything that survives its
 * own file must produce the same file twice.
 *
 * Four defects were found by running this, all of one kind: a handler for a
 * FIXED container reading `ZX_SPECTRUM.SCR_FILE_SIZE`, which is a live view
 * on the ACTIVE screen mode. A tape block, a ZED document, a SEV frame and
 * an SNA snapshot all carry a classic 6912-byte SCREEN$ no matter what the
 * artist is drawing in, so in ULAplus (fileSize 6976) those handlers asked
 * for 64 bytes that are not there:
 *   - .tzx could not reload its own export at all, while .tap - byte-
 *     identical content, a fixed constant - loaded fine.
 *   - .zed and .sev reported success and silently replaced the artist's
 *     ULAplus palette with a flat grey, because the buffer they built was
 *     64 bytes too long and the attribute fill ran into the palette block.
 *   - .sna handed SCRFormat the 64 bytes of snapshot RAM that follow the
 *     screen, so an emulator's memory became the artist's colours; in an
 *     indexed mode it failed with a size error naming a number no snapshot
 *     contains.
 * A fifth: .atr wrote the ACTIVE mode's attribute block (6144 bytes in the
 * 8x1 modes) but would only read 768, so the app rejected its own file.
 *
 * PNG, JPG and GIF are exempt from byte-identity BY DESIGN and are checked
 * only for a clean import: they go through the photo-import pipeline, which
 * requantizes against a palette generated from the image (and in ULAplus
 * builds a whole new register file). Round-tripping one is not what they
 * are for, and JPEG could not do it anyway.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Every leaf of the Save Image As submenu, in menu order. */
const EXPORT_FORMATS = [
    'scr', 'zxp', 'mlt', 'ifl', 'hrg', 'img', 'nxi', 'sl2', 'slr', 'ctile',
    'tap', 'tzx', 'png', 'bmp', 'jpg', 'zed', 'sev', 'pal', 'npl',
    'asm', 'c', 'bin', 'atr'
];

/** Quantizing photo formats: import success only, never byte-identity. */
const LOSSY = ['png', 'jpg', 'gif'];

test('every format the app both writes and reads survives its own file', async ({ page }) => {
    test.setTimeout(180000);
    await boot(page);
    page.on('dialog', (d) => d.accept()); // lossy mode-switch confirms

    const modes = await page.evaluate(() => ScreenModeService.getModes().map((m) => m.id));
    const problems = [];

    for (const mode of modes) {
        const rows = await page.evaluate(async ({ mode, exts, lossy }) => {
            let written = null;
            window.showSaveFilePicker = async () => ({
                name: 'out',
                createWritable: async () => ({
                    write: async (d) => {
                        written = d instanceof Blob
                            ? new Uint8Array(await d.arrayBuffer()) : new Uint8Array(d);
                    },
                    close: async () => {}
                })
            });

            const grab = async (ext) => {
                written = null;
                await FileManager.exportAs(ext);
                return written;
            };

            /**
             * A clean document in `mode`, with a deterministic drawing and
             * both palette register files back at their defaults - an
             * import may have edited them, and ColorManager.reset() does
             * not (they are document state, not tool state).
             */
            const freshDocument = () => {
                ScreenModeService.applyModeRaw(mode);
                LayerManager.reset();
                AttributeSystem.clearAll();
                ColorManager.reset();
                ColorManager.setUlaplusRegisters(ULAPLUS.defaultRegisters());
                ColorManager.setNextRegisters(NEXTRGB333.defaultRegisters());
                LayerManager.setBackgroundColor(7);

                const sel = StateManager.getColorSelection();
                UndoRedo.beginAction('round trip');
                for (let i = 0; i < 200; i++) {
                    PixelDrawRoutine.draw((i * 7) % ZX_SPECTRUM.WIDTH,
                        (i * 13) % ZX_SPECTRUM.HEIGHT, sel);
                }
                UndoRedo.endAction();
                LayerManager.composeToCanvas();
            };

            const out = [];
            for (const ext of exts) {
                freshDocument();
                if (!FormatRegistry.isExportCompatible(ext)) continue;
                const importer = FormatRegistry.getImportHandler(ext);
                if (!importer) continue; // export-only (bmp, asm, c, bin)

                const first = await grab(ext);
                if (!first) { out.push({ ext, note: 'exported nothing' }); continue; }

                let parsed, threw = null;
                try {
                    parsed = importer.parse(first.buffer.slice(
                        first.byteOffset, first.byteOffset + first.byteLength), {});
                    if (parsed && typeof parsed.then === 'function') parsed = await parsed;
                } catch (e) { threw = String((e && e.message) || e); }

                if (threw || !parsed || parsed.success === false) {
                    out.push({ ext, imported: false,
                               why: threw || (parsed && parsed.error) || 'no result' });
                    continue;
                }
                if (lossy.includes(ext)) { out.push({ ext, imported: true, exempt: true }); continue; }

                LayerManager.composeToCanvas();
                const second = FormatRegistry.isExportCompatible(ext) ? await grab(ext) : null;

                let same = true;
                if (!second) same = 'wrote nothing the second time';
                else if (second.length !== first.length) {
                    same = `${first.length} bytes, then ${second.length}`;
                } else {
                    let diff = 0;
                    for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) diff++;
                    if (diff) same = `${diff} of ${first.length} bytes differ`;
                }
                out.push({ ext, imported: true, same });
            }
            return out;
        }, { mode, exts: EXPORT_FORMATS, lossy: LOSSY });

        for (const r of rows) {
            const where = `${mode} / .${r.ext}`;
            if (r.note) { problems.push(`${where}: ${r.note}`); continue; }
            if (!r.imported) { problems.push(`${where}: cannot read its own export - ${r.why}`); continue; }
            if (!r.exempt && r.same !== true) problems.push(`${where}: ${r.same}`);
        }
    }

    expect(problems.join('\n')).toBe('');
});
