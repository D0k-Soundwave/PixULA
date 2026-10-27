'use strict';
/**
 * Animations and the document around them: a new, opened or imported picture
 * replaces the animations instead of being held to their screen mode; merges
 * leave no animation without layers; a failed autosave keeps the last good
 * one whole; a damaged project cannot crash a frame change; and nothing but
 * the export moves frames while it steps through them.
 */
const { test, expect } = require('@playwright/test');
const { boot, collectConsole } = require('./helpers');

test('File > New with animations opens in the default screen mode, without them', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        window.confirm = () => true;
        StateManager.set('defaultScreenMode', 'timex_hires');
        AnimationService.createScreen();
        await FileManager.newFile();
        return { mode: ScreenModeService.getModeId(), anims: AnimationService.animations.length };
    });
    expect(r).toEqual({ mode: 'timex_hires', anims: 0 });
});

test('a project saved in another mode opens in its own mode while animations are open', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        ScreenModeService.applyModeRaw('timex_hires');
        const saved = JSON.parse(JSON.stringify(App._getProjectData()));
        ScreenModeService.applyModeRaw('standard_ula');
        AnimationService.createScreen();
        await App._loadProjectData(saved);
        return { mode: ScreenModeService.getModeId(), anims: AnimationService.animations.length };
    });
    expect(r).toEqual({ mode: 'timex_hires', anims: 0 });
});

test('a screen of another mode imports in its mode; Undo brings the animation back', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        AnimationService.createScreen();
        const res = SCRFormat.importScreen(new Uint8Array(6144), new Uint8Array(6144).fill(0x38), 'multicolor_8x1', 'Load SCR');
        const after = { success: res.success, mode: ScreenModeService.getModeId(), anims: AnimationService.animations.length };
        UndoRedo.undo();
        return { after, undone: { mode: ScreenModeService.getModeId(), anims: AnimationService.animations.length } };
    });
    expect(r).toEqual({
        after: { success: true, mode: 'multicolor_8x1', anims: 0 },
        undone: { mode: 'standard_ula', anims: 1 }
    });
});

test('switching mode by hand is still refused while there are animations', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        AnimationService.createScreen();
        return { switched: ScreenModeService.switchMode('ula_plus'), mode: ScreenModeService.getModeId() };
    });
    expect(r).toEqual({ switched: false, mode: 'standard_ula' });
});

test('merging one sprite into another leaves no animation without layers', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const S = AnimationService;
        S.createSprite({ rect: { cx: 0, cy: 0, cw: 2, ch: 2 }, frames: 2 });
        S.createSprite({ rect: { cx: 4, cy: 0, cw: 2, ch: 2 }, frames: 2 });
        LayerManager.mergeDown(LayerManager.layers.length - 1);
        const merged = S.animations.map(a => a.layerIds.length);
        UndoRedo.undo();
        return { merged, undone: S.animations.map(a => a.layerIds.length) };
    });
    expect(r).toEqual({ merged: [1], undone: [1, 1] });
});

test('flattening a screen and a sprite animation leaves one animation, and the mode can change once it is deleted', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        window.confirm = () => true;
        const S = AnimationService;
        S.createScreen();
        S.createSprite({ rect: { cx: 4, cy: 0, cw: 2, ch: 2 }, frames: 2 });
        MenuSystem._flattenImage();
        const left = S.animations.map(a => a.layerIds.length > 0);
        S.deleteAnimation();
        return { left, switched: ScreenModeService.switchMode('ula_plus') };
    });
    expect(r).toEqual({ left: [true], switched: true });
});

test('an autosave whose record cannot be written keeps every frame of the last good one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const draw = (x, y) => {
            UndoRedo.beginAction('test');
            const c = LayerManager.layers[1].getCell(x >> 3, y >> 3);
            c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
            LayerManager.composeToCanvas();
            UndoRedo.endAction();
        };
        const S = AnimationService;
        S.createScreen();
        for (let i = 0; i < 3; i++) { if (i) S.addFrame(); draw(10 + i * 8, 10); }
        FileManager.markModified();
        await App._autosaveNow();
        // the next autosave drops a frame, and its record write fails (a full disk)
        S.deleteFrame(2);
        const set = Storage.set.bind(Storage);
        Storage.set = (k, v, store) => (k === 'autosave' ? Promise.reject(new Error('QuotaExceededError')) : set(k, v, store));
        FileManager.markModified();
        await App._autosaveNow();
        Storage.set = set;
        const keys = async () => new Set((await Storage.getAll(Storage.STORES.ANIM_CELS)).map(x => x.key));
        const kept = await Storage.get('autosave');
        let have = await keys();
        const missingAfterFailure = kept.animations.cels.filter(k => !have.has(k)).length;
        // the next good autosave tidies the frame that went
        FileManager.markModified();
        await App._autosaveNow();
        const good = await Storage.get('autosave');
        have = await keys();
        return {
            missingAfterFailure,
            missingAfterGood: good.animations.cels.filter(k => !have.has(k)).length,
            unusedAfterGood: [...have].filter(k => !good.animations.cels.includes(k)).length
        };
    });
    expect(r).toEqual({ missingAfterFailure: 0, missingAfterGood: 0, unusedAfterGood: 0 });
});

test('a project whose sprite window lies off the grid opens, and its frames can be stepped', async ({ page }) => {
    const errors = collectConsole(page);
    await boot(page);
    const r = await page.evaluate(async () => {
        const S = AnimationService;
        S.createSprite({ rect: { cx: 0, cy: 0, cw: 2, ch: 2 }, frames: 2 });
        const data = JSON.parse(JSON.stringify(App._getProjectData()));
        data.animations = S.serialize();
        data.animations.list[0].rect = { cx: 30, cy: 20, cw: 8, ch: 8 };
        await App._loadProjectData(data);
        let err = null;
        try { S.next(); S.flushAll(); S.previous(); } catch (e) { err = String(e); }
        return { err, rect: S.getOpen().rect };
    });
    expect(r.err).toBe(null);
    // kept on the grid: 8 x 8 cells pulled back from the edge
    expect(r.rect).toEqual({ cx: 24, cy: 16, cw: 8, ch: 8 });
    expect(errors.errors).toEqual([]);
});

test('keys do nothing while an export steps through the frames', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const S = AnimationService;
        S.createScreen(); S.addFrame(); S.addFrame(); S.goTo(0);
        S.setBusy(true);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }));
        const busy = S.getOpen().current;
        S.setBusy(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }));
        return { busy, after: S.getOpen().current };
    });
    expect(r).toEqual({ busy: 0, after: 1 });
});

test('a GIF frame longer than the 16-bit delay field is split, not wrapped', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const still = new Uint8Array(4);
        const tl = AnimationExport.timeline([{ delayTicks: 40000, kind: 'still', phases: [still] }]);
        return { delays: tl.map(f => f.delayCs), total: tl.reduce((n, f) => n + f.delayCs, 0) };
    });
    expect(r.delays.every(d => d <= 0xFFFF)).toBe(true);
    expect(r.total).toBe(80000);
});
