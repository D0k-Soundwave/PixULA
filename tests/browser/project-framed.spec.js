'use strict';
/**
 * A project with animations is saved framed (container 2): the document, then
 * each animation frame compressed on its own, once.
 *
 * Found 2026-10-29: a disk backup gzipped the whole project, every frame
 * included, on every autosave - 500 distinct Layer 2 640 frames took about
 * 3.0 s and froze the page for 2.4 s each time. Frames never change once
 * made, so each is compressed once and its part kept; a backup after one
 * changed frame took 18-20 ms. These pin what that rests on: the framed file
 * opens back to the same frames, an unchanged frame is not compressed again,
 * a document without animations is still the plain gzip every older build
 * reads, and a damaged framed file is refused rather than half read.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** A screen animation of three frames, each with its own ink. */
const animate = (page) => page.evaluate(() => {
    const L = LayerManager, S = AnimationService;
    const draw = (x, y) => {
        UndoRedo.beginAction('test');
        const c = L.layers[1].getCell(x >> 3, y >> 3);
        c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
        L.composeToCanvas();
        UndoRedo.endAction();
    };
    S.createScreen();
    draw(10, 10);
    S.addFrame(); draw(60, 20);
    S.addFrame(); draw(120, 90);
    S.setDelay(9, 1);
    S.goTo(1);
});

/** Every frame of every animation, as text, read from the stored cels. */
const frames = (page) => page.evaluate(() => {
    const data = AnimationService.serialize();
    return {
        list: data.list.map((a) => ({ kind: a.kind, current: a.current, frames: a.frames })),
        cels: data.cels.map((c) => JSON.stringify(c, Helpers.jsonTypedReplacer))
    };
});

test('a project with animations is framed and opens back to the same frames', async ({ page }) => {
    await boot(page);
    await animate(page);
    const before = await frames(page);
    const saved = await page.evaluate(async () => {
        const bytes = await ProjectFormat.export();
        return { bytes: Array.from(bytes), head: Array.from(bytes.subarray(0, 8)) };
    });
    // 0x89 'PXU' CR LF SUB LF: not gzip, so 0.1.0-beta.2 and older refuse it
    expect(saved.head).toEqual([0x89, 0x50, 0x58, 0x55, 0x0D, 0x0A, 0x1A, 0x0A]);

    await page.evaluate(async (bytes) => {
        FileManager.hasUnsavedChanges = false;
        await FileManager.newFile();
        await FileManager.loadFile(new File([new Uint8Array(bytes)], 'Bounce.pixula'));
    }, saved.bytes);
    expect(await frames(page)).toEqual(before);
});

test('a frame is compressed once: the next save compresses only what changed', async ({ page }) => {
    await boot(page);
    await animate(page);
    const r = await page.evaluate(async () => {
        let gzips = 0;
        const real = ProjectFormat._gzip.bind(ProjectFormat);
        ProjectFormat._gzip = (bytes) => { gzips++; return real(bytes); };
        const count = async () => {
            gzips = 0;
            await ProjectFormat.encode(App._getProjectData({ packed: true }));
            return gzips;
        };
        const cels = AnimationService.serialize().cels.length;
        const first = await count();
        const unchanged = await count();
        // One more ink pixel on the frame shown: that frame's cel is new
        UndoRedo.beginAction('test');
        const c = LayerManager.layers[1].getCell(0, 0);
        c.pixels[0] |= 0x80; c.altered = true;
        UndoRedo.endAction();
        const afterEdit = await count();
        return { cels, first, unchanged, afterEdit };
    });
    // The document part is compressed every time; a cel only when it is new
    expect(r.first).toBe(1 + r.cels);
    expect(r.unchanged).toBe(1);
    expect(r.afterEdit).toBe(2);
});

test('a project without animations is still one plain gzip', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        PixelDrawRoutine.draw(5, 5, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        const bytes = await ProjectFormat.export();
        const project = await ProjectFormat.decode(bytes);
        return { head: [bytes[0], bytes[1]], container: project.container };
    });
    expect(r.head).toEqual([0x1F, 0x8B]);
    expect(r.container).toBe(1);
});

test('a damaged framed file is refused, not half read', async ({ page }) => {
    await boot(page);
    await animate(page);
    const r = await page.evaluate(async () => {
        const bytes = await ProjectFormat.export();
        const cut = await ProjectFormat.decode(bytes.subarray(0, bytes.length - 40));
        const wrongCount = bytes.slice();
        new DataView(wrongCount.buffer).setUint32(8, 2, true);   // two parts claimed, more present
        return { cut, wrongCount: await ProjectFormat.decode(wrongCount) };
    });
    expect(r.cut).toBeNull();
    expect(r.wrongCount).toBeNull();
});
