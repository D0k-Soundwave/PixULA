'use strict';
/**
 * Save it, load it back - for the formats reached from the EDITORS rather
 * than from File > Save Image As: fonts, maps and sprites.
 * `format-round-trip.spec.js` walks the Save Image As list and so reaches
 * none of them, which is how the defect below survived.
 *
 * It also pins their MODE INDEPENDENCE, which is where that defect was.
 * Font glyphs, `ula-cell` map tiles and Next sprites are each defined on
 * their own fixed geometry, so the bytes must not change with whatever the
 * canvas happens to be in. `ZXMFormat._tileSize()` says exactly this - and
 * pinned the tile while leaving the base picture around it on
 * ACTIVE_SCREEN_MODE. Measured before the fix (2026-08-30): one 8x6 map
 * wrote 53,065 bytes under standard ULA, 104,521 under Timex hi-res,
 * 173,265 under Layer 2 640 and 14,269 under LoRes; and the standard-ULA
 * file was then REJECTED - "Base picture is not one screen" - when read
 * back in any mode of a different size.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Four modes of four different sizes - 256x192, 512x192, 640x256, 128x96. */
const MODES = ['standard_ula', 'timex_hires', 'layer2_640', 'lores'];

test('the editor formats survive their own files, and do not change with the screen mode',
    async ({ page }) => {
        test.setTimeout(180000);
        await boot(page);
        page.on('dialog', (d) => d.accept());

        const problems = [];
        const bytesPerMode = {}; // "kind/ext" -> { mode: byte length }

        for (const mode of MODES) {
            const rows = await page.evaluate(async (mode) => {
                ScreenModeService.applyModeRaw(mode);

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
                const grab = async (fn) => { written = null; await fn(); return written; };
                const bufOf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
                const rows = [];

                // ---------------- fonts ----------------
                // .ch4/.ch6/.ch8 are 2048-byte 256-character dumps, so they
                // widen a 96-glyph font to the full window - documented in
                // js/io/font-format.js, and why only .chr (which has a
                // 768-byte 96-char variant) and .chx keep the coverage.
                const WIDENS = ['ch4', 'ch6', 'ch8'];
                for (const coverage of ['ASCII', 'FULL']) {
                    for (const ext of ['ch4', 'ch6', 'ch8', 'chr', 'chx']) {
                        const width = ext === 'ch4' ? 4 : ext === 'ch6' ? 6 : 8;
                        FontService.resetToROM(false);
                        FontService.setWidth(width);
                        FontService.setCoverage(coverage);
                        const cov = FontService.getCoverage();
                        const before = [];
                        for (let c = cov.firstCode; c < cov.firstCode + cov.count; c++) {
                            before.push(Array.from(FontService.getGlyph(c) || []).join(','));
                        }

                        let bytes = null, ok = false, why = null;
                        try {
                            bytes = await grab(() => FontFormat.exportAndDownload('f.' + ext));
                            const res = FormatRegistry.getImportHandler(ext).parse(bufOf(bytes));
                            ok = !!(res && res.success);
                            if (!ok) why = res && res.error;
                        } catch (e) { why = String((e && e.message) || e); }

                        let same = true;
                        if (ok) {
                            for (let i = 0; i < before.length; i++) {
                                const c = cov.firstCode + i;
                                const now = Array.from(FontService.getGlyph(c) || []).join(',');
                                if (before[i] !== now) { same = 'glyph ' + c + ' changed'; break; }
                            }
                        }
                        const after = FontService.getCoverage();
                        const covOk = (WIDENS.includes(ext) && coverage === 'ASCII')
                            ? after.count === 256
                            : (after.firstCode === cov.firstCode && after.count === cov.count);
                        rows.push({ id: 'font/' + ext + '@' + coverage,
                                    bytes: bytes ? bytes.length : null, ok, why, same, covOk });
                    }
                }

                // ---------------- maps ----------------
                const seedMap = (w, h) => {
                    MapService.loadDocument({ tiles: [], map: { width: w, height: h,
                        cells: new Int16Array(w * h).fill(-1) } });
                    for (let i = 0; i < 5; i++) {
                        const bm = new Uint8Array(8);
                        for (let y = 0; y < 8; y++) bm[y] = (i * 37 + y * 11) & 0xFF;
                        MapService.addTile(MapService.createTile(bm, (0x38 + i) & 0x7F));
                    }
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) MapService.setMapCell(x, y, (x + y) % 5);
                    }
                };
                const mapSnap = () => {
                    const d = MapService.toDocument();
                    return { w: d.map.width, h: d.map.height,
                             tiles: d.tiles.map(t => Array.from(t.bitmap).join(',') + ':' + t.attr),
                             cells: Array.from(d.map.cells) };
                };
                const MAP_RUNS = [
                    ['zxtm', () => MapFormat.exportAndDownload('m.zxtm')],
                    ['zxm', () => ZXMFormat.exportAndDownload('m.zxm')]
                ];
                for (const [ext, run] of MAP_RUNS) {
                    // 40x30 - larger than a screen, so .zxm's documented
                    // "minimum one screen" floor cannot mask a lost extent.
                    seedMap(40, 30);
                    const before = mapSnap();
                    let bytes = null, ok = false, why = null;
                    try {
                        bytes = await grab(run);
                        const res = FormatRegistry.getImportHandler(ext).parse(bufOf(bytes));
                        ok = !!(res && res.success);
                        if (!ok) why = res && res.error;
                    } catch (e) { why = String((e && e.message) || e); }

                    let same = true;
                    if (ok) {
                        const after = mapSnap();
                        if (after.w !== before.w || after.h !== before.h) {
                            same = before.w + 'x' + before.h + ' came back ' + after.w + 'x' + after.h;
                        } else if (after.tiles.join('|') !== before.tiles.join('|')) {
                            same = 'tileset changed';
                        } else if (after.cells.join() !== before.cells.join()) {
                            same = 'map cells changed';
                        }
                    }
                    rows.push({ id: 'map/' + ext, bytes: bytes ? bytes.length : null,
                                ok, why, same, covOk: true });
                }

                // ---------------- sprites ----------------
                // loadSheet() refuses an empty array, so one blank sprite is
                // how the sheet is actually reset.
                const blank = new Uint8Array(16 * 16);
                for (const depth of [8, 4]) {
                    SpriteService.loadSheet([blank], depth);
                    const max = depth === 8 ? 256 : 16;
                    for (let n = 0; n < 3; n++) {
                        if (n) SpriteService.addSprite();
                        const px = new Uint8Array(16 * 16);
                        for (let i = 0; i < px.length; i++) px[i] = (i * (n + 3)) % max;
                        SpriteService.setSprite(n, px);
                    }
                    const before = [];
                    for (let n = 0; n < SpriteService.getCount(); n++) {
                        before.push(Array.from(SpriteService.getSprite(n) || []).join(','));
                    }

                    let bytes = null, ok = false, why = null;
                    try {
                        bytes = await grab(() => SpriteFormat.exportAndDownload('s.spr'));
                        const res = FormatRegistry.getImportHandler('spr').parse(bufOf(bytes));
                        ok = !!(res && res.success);
                        if (!ok) why = res && res.error;
                    } catch (e) { why = String((e && e.message) || e); }

                    let same = true;
                    if (ok) {
                        if (SpriteService.getCount() !== before.length) {
                            same = before.length + ' sprites came back ' + SpriteService.getCount();
                        } else {
                            for (let n = 0; n < before.length; n++) {
                                const now = Array.from(SpriteService.getSprite(n) || []).join(',');
                                if (before[n] !== now) { same = 'sprite ' + n + ' changed'; break; }
                            }
                        }
                    }
                    rows.push({ id: 'sprite/spr@' + depth + 'bpp',
                                bytes: bytes ? bytes.length : null, ok, why, same, covOk: true });
                }

                return rows;
            }, mode);

            for (const r of rows) {
                const where = `${mode} / ${r.id}`;
                if (!r.ok) { problems.push(`${where}: cannot read its own export - ${r.why}`); continue; }
                if (r.same !== true) problems.push(`${where}: ${r.same}`);
                if (!r.covOk) problems.push(`${where}: coverage window not as documented`);
                (bytesPerMode[r.id] = bytesPerMode[r.id] || {})[mode] = r.bytes;
            }
        }

        // The file must be the same one whatever the canvas is in.
        for (const id of Object.keys(bytesPerMode)) {
            const byMode = bytesPerMode[id];
            if (new Set(Object.values(byMode)).size > 1) {
                problems.push(`${id}: file size follows the screen mode - ` +
                    Object.keys(byMode).map((m) => `${m}=${byMode[m]}`).join(', '));
            }
        }

        expect(problems.join('\n')).toBe('');
    });
