'use strict';
/**
 * The recovery autosave of an animation stores each frame once.
 *
 * Measured 2026-10-27 (FIGURES.md "Animation sizing"): one autosave wrote the
 * whole project, every frame included, as one record - 85-175 ms at about
 * 100 MB of frames, over the 100 ms an interface may stall. Now the record
 * names the frames by key and each cel is its own record, written when new:
 * a second autosave after one stroke writes one cel, a deleted frame's cels
 * leave the store, and a reload restores every frame. A declined restore
 * empties the store.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const setup = (page) => page.evaluate(async () => {
    const L = LayerManager, S = AnimationService;
    const draw = (x, y) => {
        UndoRedo.beginAction('test');
        const c = L.layers[1].getCell(x >> 3, y >> 3);
        c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
        L.composeToCanvas();
        UndoRedo.endAction();
    };
    S.createScreen();
    for (let i = 0; i < 5; i++) { if (i) S.addFrame(); draw(10 + i * 8, 10); }
    FileManager.markModified();
    await App._autosaveNow();
    const first = await Storage.count(Storage.STORES.ANIM_CELS);
    const record = await Storage.get('autosave');
    // one more stroke on the frame shown: only that frame's cel is new
    const calls = [];
    const set = Storage.set.bind(Storage);
    Storage.set = (k, v, store) => { if (store === Storage.STORES.ANIM_CELS) calls.push(k); return set(k, v, store); };
    draw(100, 100);
    S.goTo(0);   // leaving the frame stores it
    FileManager.markModified();
    await App._autosaveNow();
    Storage.set = set;
    const afterStroke = calls.length;
    S.deleteFrame(0);
    FileManager.markModified();
    await App._autosaveNow();
    return {
        first, afterStroke,
        recordHoldsKeys: record.animations.celRefs === true && typeof record.animations.cels[0] === 'string',
        afterDelete: await Storage.count(Storage.STORES.ANIM_CELS),
        frames: S.getOpen().frames.length
    };
});

test('an animation autosave writes each frame once, and a reload restores them', async ({ page }) => {
    await boot(page);
    const r = await setup(page);
    // 2 animated layers (background and layer 1) x 5 frames; frames with an untouched background share its cel
    expect(r.recordHoldsKeys).toBe(true);
    expect(r.first).toBeGreaterThanOrEqual(5);
    expect(r.afterStroke).toBe(1);
    expect(r.afterDelete).toBeLessThan(r.first + 1);
    page.on('dialog', (d) => d.accept());
    await reload(page);
    const back = await page.evaluate(() => {
        const a = AnimationService.getOpen();
        const ink = (x, y) => { const c = LayerManager.layers[1].getCell(x >> 3, y >> 3); return (c.pixels[y & 7] >> (7 - (x & 7))) & 1; };
        const seen = [];
        for (let i = 0; i < a.frames.length; i++) { AnimationService.goTo(i); seen.push(ink(18 + i * 8, 10)); }
        return { frames: a.frames.length, seen: seen.join('') };
    });
    expect(back.frames).toBe(r.frames);
    // frames 2..5 kept their own pixel (frame 1 was deleted)
    expect(back.seen).toBe('1111');
});

test('declining the restore empties the frame store', async ({ page }) => {
    await boot(page);
    await setup(page);
    page.on('dialog', (d) => d.type() === 'confirm' ? d.dismiss() : d.accept());
    await reload(page);
    expect(await page.evaluate(() => Storage.count(Storage.STORES.ANIM_CELS))).toBe(0);
    expect(await page.evaluate(() => AnimationService.hasAnimations())).toBe(false);
});
