'use strict';
/**
 * Coloured CHX characters in a real browser (owner decision 2026-10-19: keep, edit AND type in colour). A .chx is opened in
 * the Font Editor through its own Import, edited with the Attributes tool and Remove attributes (one Undo step each), saved
 * to the library, and typed with the Text tool's Attributes: Own attributes - as a stamp and with Type on canvas.
 * The byte layout is pinned in Node (tests/chx-colour.test.js, chx-colour-pin.test.js); the placement maths too
 * (tests/text-chx-colour.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const HEADER = 5 + 512;
// chars = [{code, cols, rows, attrs?, blocks}]
function buildChx(chars) {
    let size = HEADER;
    for (const c of chars) size += 3 + c.cols * c.rows * (c.attrs ? 9 : 8);
    const out = Buffer.alloc(size);
    out.set([0x43, 0x48, 0x58, 0, 0], 0);
    let off = HEADER;
    for (const c of chars) {
        out[5 + c.code * 2] = off & 0xFF; out[6 + c.code * 2] = off >> 8;
        out[off] = c.attrs ? 0 : 1; out[off + 1] = c.cols; out[off + 2] = c.rows;
        let o = off + 3;
        for (let b = 0; b < c.cols * c.rows; b++) {
            for (let y = 0; y < 8; y++) out[o++] = c.blocks[b * 8 + y];
            if (c.attrs) out[o++] = c.attrs[b];
        }
        off = o;
    }
    return out;
}
const A1 = 2 | (6 << 3) | 0x40;      // red Ink, yellow Paper, Bright
const A2 = 1 | (5 << 3);             // blue Ink, cyan Paper
const full = (n) => Array.from({ length: n * 8 }, () => 0x81);
const CHX = buildChx([
    { code: 32, cols: 2, rows: 1, blocks: new Array(16).fill(0) },
    { code: 65, cols: 2, rows: 1, blocks: full(2), attrs: [A1, A2] },     // 'A' coloured, two blocks
    { code: 66, cols: 2, rows: 1, blocks: full(2) }                      // 'B' uncoloured
]);

async function openEditor(page) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    await expect(page.locator('.fe-new-big')).toBeVisible();
}
async function importChx(page, bytes = CHX) {
    await page.locator('.fe-file-input').setInputFiles({ name: 'col.chx', mimeType: 'application/octet-stream', buffer: bytes });
    await page.waitForFunction(() => FontService.width === 16 && FontService.hasColours());
}
const colours = (page, code) => page.evaluate((c) => { const a = FontService.getColours(c); return a ? Array.from(a) : null; }, code);
const setBar = (page, ink, paper, bright = false, flash = false) => page.evaluate(([i, p, b, f]) => {
    ColorManager.setInk(i); ColorManager.setPaper(p); ColorManager.setBright(b); ColorManager.setFlash(f);
}, [ink, paper, bright, flash]);
/** The colour of the one-character editor at glyph pixel (x, y), as #rrggbb. */
const editorColour = (page, x, y) => page.evaluate(([px, py]) => {
    const c = document.querySelector('.fe-glyph-canvas');
    const w = FontService.width, h = FontService.height;
    const d = c.getContext('2d').getImageData(Math.floor((px + 0.5) * c.width / w), Math.floor((py + 0.5) * c.height / h), 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}, [x, y]);
async function clickEditor(page, x, y) {
    const box = await page.locator('.fe-glyph-canvas').boundingBox();
    const w = await page.evaluate(() => FontService.width), h = await page.evaluate(() => FontService.height);
    await page.mouse.click(box.x + (x + 0.5) * box.width / w, box.y + (y + 0.5) * box.height / h);
}
async function selectChar(page, code) {
    await page.evaluate((c) => FontEditorDialog._selectGlyph(c), code);
}

test('opening a coloured .chx keeps its attributes, shows them, and saves the same file back', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await importChx(page);
    expect(await colours(page, 65)).toEqual([A1, A2]);
    expect(await colours(page, 66)).toBeNull();
    await selectChar(page, 65);
    // pixel 1 of block 0 is a paper pixel (0x81 = ink at both ends): yellow Paper, bright; pixel 0 is an ink pixel: bright red
    expect(await editorColour(page, 1, 3)).toBe('#FFFF00');
    expect(await editorColour(page, 0, 3)).toBe('#FF0000');
    // block 1: cyan Paper and blue Ink, not bright
    expect(await editorColour(page, 9, 3)).toBe('#00D7D7');
    expect(await editorColour(page, 8, 3)).toBe('#0000D7');
    await expect(page.locator('.fe-attr-state')).toContainText(/own attributes/i);
    await selectChar(page, 66);
    expect(await editorColour(page, 1, 3)).toBe('#D7D7D7');
    await expect(page.locator('.fe-attr-state')).not.toContainText(/own attributes/i);
    const out = await page.evaluate(() => Array.from(FontFormat.export('chx')));
    const back = await page.evaluate((bytes) => {
        const r = FontFormat.parseFont(Uint8Array.from(bytes), 'chx');
        return Array.from(FontFormat.exportFont(r.font, 'chx'));
    }, out);
    expect(back).toEqual(out);
    const rec = out[5 + 65 * 2] | (out[6 + 65 * 2] << 8);
    expect([out[rec], out[rec + 3 + 8], out[rec + 3 + 9 + 8]]).toEqual([0, A1, A2]);
});

test('the Attributes tool gives a block the bar\'s attributes; Remove attributes; both undo in one step', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await importChx(page);
    await selectChar(page, 66);
    await setBar(page, 3, 4, true, true);                    // magenta Ink, green Paper, Bright, Flash
    await page.click('button[data-tool="attrs"]');
    await clickEditor(page, 12, 4);                          // block 1 of an uncoloured character
    const attr = 3 | (4 << 3) | 0x40 | 0x80;
    expect(await colours(page, 66), 'the first block colours the whole character').toEqual([attr, attr]);
    expect(await page.evaluate(() => FontService.getGlyph(66).every(b => b === 0x81)), 'the tool does not draw pixels').toBe(true);
    await setBar(page, 7, 1);
    await clickEditor(page, 2, 2);
    expect(await colours(page, 66)).toEqual([7 | (1 << 3), attr]);
    await page.click('.fe-undo');
    expect(await colours(page, 66)).toEqual([attr, attr]);
    await page.click('.fe-attr-remove');
    expect(await colours(page, 66)).toBeNull();
    await page.click('.fe-undo');
    expect(await colours(page, 66)).toEqual([attr, attr]);
    await page.click('.fe-undo');
    expect(await colours(page, 66)).toBeNull();
    await page.click('.fe-redo');
    expect(await colours(page, 66)).toEqual([attr, attr]);
    // Colour all blocks: every block the bar's attributes
    await setBar(page, 0, 2);
    await page.click('.fe-attr-all');
    expect(await colours(page, 66)).toEqual([2 << 3, 2 << 3]);
});

test('the Attributes tool keeps what a block has where the bar is set to use existing', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await importChx(page);
    await selectChar(page, 65);                              // blocks A1 (red on yellow, Bright) and A2 (blue on cyan)
    await setBar(page, 4, 3);                                // green Ink, magenta Paper...
    await page.evaluate(() => { ColorManager.setPaperTransparent(true); ColorManager.setBrightTransparent(true); });
    await page.click('button[data-tool="attrs"]');
    await clickEditor(page, 2, 2);
    expect(await colours(page, 65), 'Ink and Flash from the bar, Paper and Bright kept').toEqual([4 | (6 << 3) | 0x40, A2]);
    await page.click('.fe-attr-all');
    expect(await colours(page, 65), 'All blocks: each block keeps its own Paper and Bright').toEqual([4 | (6 << 3) | 0x40, 4 | (5 << 3)]);
    // an uncoloured character's blocks count as black Ink on white Paper (56)
    await selectChar(page, 66);
    await clickEditor(page, 2, 2);
    expect(await colours(page, 66)).toEqual([4 | (7 << 3), 4 | (7 << 3)]);
});

test('the All characters map draws the blocks in their attributes and the Attributes tool works there', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await importChx(page);
    await page.click('.fe-map-toggle');
    await page.waitForFunction(() => FontEditorDialog._mapView && FontEditorDialog._mapView.getZoom() >= 1);
    const mapColour = (gx, gy) => page.evaluate(([x, y]) => {
        const v = FontEditorDialog._mapView;
        const z = v.getZoom();
        const d = v.canvas.getContext('2d').getImageData(Math.floor((x + 0.5) * z), Math.floor((y + 0.5) * z), 1, 1).data;
        return '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    }, [gx, gy]);
    // 'A' is index 33: map column 1, row 2 of 16 x 8 characters
    const ax = 1 * 16, ay = 2 * 8;
    expect(await mapColour(ax + 1, ay + 3)).toBe('#FFFF00');
    expect(await mapColour(ax + 9, ay + 3)).toBe('#00D7D7');
    await setBar(page, 2, 7);
    await page.click('button[data-tool="attrs"]');
    const z = await page.evaluate(() => FontEditorDialog._mapView.getZoom());
    const box = await page.evaluate(() => { const r = FontEditorDialog._mapView.canvas.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    // 'B' (index 34): second block
    await page.mouse.click(box.x + (2 * 16 + 12 + 0.5) * z, box.y + (ay + 4 + 0.5) * z);
    expect(await colours(page, 66)).toEqual([2 | (7 << 3), 2 | (7 << 3)]);
    expect(await mapColour(2 * 16 + 1, ay + 3)).toBe('#D7D7D7');
});

test('the Attributes tool is refused with a reason where the bar has no attributes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'timex_hires');
    await page.waitForFunction(() => ScreenModeService.getModeId() === 'timex_hires');
    await openEditor(page);
    await importChx(page);
    await selectChar(page, 66);
    await page.click('button[data-tool="attrs"]');
    await clickEditor(page, 2, 2);
    expect(await colours(page, 66)).toBeNull();
    await expect(page.locator('.fe-status')).toContainText(/attribute bar/i);
});

// -- Text tool ----------------------------------------------------------------

async function saveColouredFont(page, name = 'Col') {
    await openEditor(page);
    await importChx(page);
    await page.fill('.fe-name', name);
    await page.click('.fe-lib-save');
    await page.waitForFunction((n) => FontService.listLibrary().includes(n), name);
    await page.keyboard.press('Escape');
}
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
const setSelect = (page, id, v) => page.evaluate(([i, val]) => {
    const el = document.getElementById(i);
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);
const cellAttrs = (page, cx, cy) => page.evaluate(([x, y]) => {
    const c = LayerManager.layers[LayerManager.activeDrawLayerIndex].getCell(x, y);
    return c ? { ink: c.ink, paper: c.paper, bright: !!c.bright, flash: !!c.flash, pixels: c.pixels[0] } : null;
}, [cx, cy]);

test('the Attributes choice shows only for a coloured font, and only in modes with 8x8 attribute cells', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await saveColouredFont(page);
    await page.click('.tool-btn[data-tool="text"]');
    await expect(page.locator('#opt-textColours')).toBeHidden();                 // ZX ROM
    await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setFontFamily('zxfont:Col'));
    await setSelect(page, 'opt-fontFamily', 'zxfont:Col');
    await expect(page.locator('#opt-textColours')).toBeVisible();
    for (const [mode, shown] of [['multicolor_8x4', false], ['timex_hires', false], ['ula_plus', true], ['gigascreen', true],
                                 ['ulanext', true], ['layer2_256', false], ['lores', false], ['standard_ula', true]]) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForFunction((m) => ScreenModeService.getModeId() === m, mode);
        await page.click('.tool-btn[data-tool="text"]');
        if (shown) await expect(page.locator('#opt-textColours'), mode).toBeVisible();
        else await expect(page.locator('#opt-textColours'), mode).toBeHidden();
    }
});

test('a text stamp with Own attributes places a coloured letter\'s attributes and an uncoloured one in the bar\'s', async ({ page }) => {
    await boot(page);
    await saveColouredFont(page);
    await page.click('.tool-btn[data-tool="text"]');
    await setSelect(page, 'opt-fontFamily', 'zxfont:Col');
    await setBar(page, 4, 0);                              // green Ink on black Paper
    await setSelect(page, 'opt-textAnchor', 'top-left');
    await page.evaluate(() => { const t = ToolManager.getTool(TOOLS.TEXT); t.setText('AB'); t.setTextSize(8); });
    await setSelect(page, 'opt-textColours', 'own');
    const p = await pixelPoint(page, 19, 21);             // not on a cell corner: the coloured text goes onto the grid
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 1, p.y + 1);
    await page.mouse.move(p.x, p.y);
    const f = await page.evaluate(() => { const s = SelectionService.floatingPaste; return { x: s.x, y: s.y, own: SelectionService.stampColoured(s) }; });
    expect(f).toEqual({ x: 16, y: 16, own: true });
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await cellAttrs(page, 2, 2)).toMatchObject({ ink: 2, paper: 6, bright: true, pixels: 0x81 });
    expect(await cellAttrs(page, 3, 2)).toMatchObject({ ink: 1, paper: 5, bright: false, pixels: 0x81 });
    expect(await cellAttrs(page, 4, 2)).toMatchObject({ ink: 4, paper: 0, pixels: 0x81 });
    expect(await cellAttrs(page, 5, 2)).toMatchObject({ ink: 4, paper: 0, pixels: 0x81 });
    // the same text with the Attribute bar: all four cells in the bar's attributes
    await setSelect(page, 'opt-textColours', 'rail');
    const q = await pixelPoint(page, 16, 64);
    await page.mouse.move(q.x, q.y); await page.mouse.move(q.x + 1, q.y); await page.mouse.move(q.x, q.y);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(150);
    for (let cx = 2; cx < 6; cx++) expect(await cellAttrs(page, cx, 8)).toMatchObject({ ink: 4, paper: 0 });
});

test('Own attributes are refused with a reason when an effect or the size moves the blocks off the cells', async ({ page }) => {
    await boot(page);
    await saveColouredFont(page);
    await page.click('.tool-btn[data-tool="text"]');
    await setSelect(page, 'opt-fontFamily', 'zxfont:Col');
    await page.evaluate(() => { const t = ToolManager.getTool(TOOLS.TEXT); t.setText('AB'); t.setTextSize(8); });
    await setSelect(page, 'opt-textColours', 'own');
    await page.locator('#opt-textMirrorH').check();
    expect(await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).textColoursBlocked())).toBe('effects');
    await expect(page.getByText(/Own attributes need upright/)).toBeVisible();
    expect(await page.locator('#opt-textColours option[value="own"]').isDisabled()).toBe(true);
    await page.locator('#opt-textMirrorH').uncheck();
    expect(await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).textColoursBlocked())).toBeNull();
    // Type on canvas at a character width of 12: the 8-pixel blocks become 6 wide
    await page.locator('#opt-typeOnCanvas').check();
    await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setCharWidth(12));
    await page.evaluate(() => EventBus.emit(EVENTS.TOOL_OPTIONS));
    expect(await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).textColoursBlocked())).toBe('geometry');
    await expect(page.getByText(/do not sit on the picture/)).toBeVisible();
});

test('Type on canvas with Own attributes: Enter draws the letters in their own attributes, one undo', async ({ page }) => {
    await boot(page);
    await saveColouredFont(page);
    await page.click('.tool-btn[data-tool="text"]');
    await setSelect(page, 'opt-fontFamily', 'zxfont:Col');
    await setBar(page, 6, 1);
    await setSelect(page, 'opt-textColours', 'own');
    await page.locator('#opt-typeOnCanvas').check();
    const undoBefore = await page.evaluate(() => UndoRedo.getUndoCount());
    const p = await pixelPoint(page, 35, 43);              // the text starts on the cell grid: (32, 40)
    await page.mouse.click(p.x, p.y);
    await page.keyboard.type('BA');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    expect(await cellAttrs(page, 4, 5)).toMatchObject({ ink: 6, paper: 1, pixels: 0x81 });
    expect(await cellAttrs(page, 5, 5)).toMatchObject({ ink: 6, paper: 1, pixels: 0x81 });
    expect(await cellAttrs(page, 6, 5)).toMatchObject({ ink: 2, paper: 6, bright: true, pixels: 0x81 });
    expect(await cellAttrs(page, 7, 5)).toMatchObject({ ink: 1, paper: 5, pixels: 0x81 });
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBe(undoBefore + 1);
});

test('in GigaScreen a coloured letter gives its attributes to both screens', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await saveColouredFont(page);
    await page.evaluate(() => ScreenModeService.switchMode('gigascreen'));
    await page.waitForFunction(() => ScreenModeService.getModeId() === 'gigascreen');
    await page.click('.tool-btn[data-tool="text"]');
    await setSelect(page, 'opt-fontFamily', 'zxfont:Col');
    await setSelect(page, 'opt-textAnchor', 'top-left');
    await page.evaluate(() => { const t = ToolManager.getTool(TOOLS.TEXT); t.setText('A'); t.setTextSize(8); });
    await setSelect(page, 'opt-textColours', 'own');
    const p = await pixelPoint(page, 40, 40);
    await page.mouse.move(p.x, p.y); await page.mouse.move(p.x + 1, p.y); await page.mouse.move(p.x, p.y);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(150);
    const c = await page.evaluate(() => {
        const cell = LayerManager.layers[LayerManager.activeDrawLayerIndex].getCell(5, 5);
        return { a: [cell.ink, cell.paper, !!cell.bright], b: [cell.inkB, cell.paperB, !!cell.brightB], pa: cell.pixels[0], pb: cell.pixelsB[0] };
    });
    expect(c.a).toEqual([2, 6, true]);
    expect(c.b).toEqual([2, 6, true]);
    expect([c.pa, c.pb]).toEqual([0x81, 0x81]);
});
