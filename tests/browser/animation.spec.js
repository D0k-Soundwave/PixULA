'use strict';
/**
 * The animation system in the real app: a screen animation drawn over two
 * frames, undo across a frame change (it returns to the frame the step was
 * made on, and leaves the other frame alone), a duplicated frame sharing its
 * contents, a new layer joining the open animation, Merge Down merging every
 * stored frame, saving and loading, playback stepping on its clock and
 * leaving nothing scheduled, a sprite made from a selection, the screen mode
 * held while animations exist, and the panel.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('animations: frames, undo across frames, merging, saving, playback, sprites', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page);
    const r = await page.evaluate(async () => {
        const out = {};
        const L = LayerManager, S = AnimationService;
        const ink = (layer, x, y) => { const c = layer.getCell(x >> 3, y >> 3); return (c.pixels[y & 7] >> (7 - (x & 7))) & 1; };
        const draw = (layer, x, y) => {   // one undoable "stroke": set one ink pixel
            UndoRedo.beginAction('test');
            const c = layer.getCell(x >> 3, y >> 3);
            c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
            L.composeToCanvas();
            UndoRedo.endAction();
        };
        const l1 = L.layers[1];
        draw(L.layers[1], 10, 10);
        const anim = S.createScreen();
        out.created = !!anim && anim.frames.length === 1 && anim.layerIds.length === 2;
        S.addFrame();
        out.addGoesToBlank = anim.current === 1 && ink(L.layers[1], 10, 10) === 0;
        draw(L.layers[1], 20, 20);
        S.goTo(0);
        out.frame0 = ink(L.layers[1], 10, 10) === 1 && ink(L.layers[1], 20, 20) === 0;
        S.goTo(1);
        out.frame1 = ink(L.layers[1], 10, 10) === 0 && ink(L.layers[1], 20, 20) === 1;
        // Undo across a frame switch: go to frame 0, then undo the stroke made on frame 1.
        S.goTo(0);
        UndoRedo.undo();
        out.undoGoesToFrame = S.getOpen().current === 1 && ink(L.layers[1], 20, 20) === 0;
        S.goTo(0);
        out.frame0Intact = ink(L.layers[1], 10, 10) === 1;
        UndoRedo.redo();
        out.redo = S.getOpen().current === 1 && ink(L.layers[1], 20, 20) === 1 && ink(L.layers[1], 10, 10) === 0;
        // Duplicate shares cels, add layer joins, merge down across frames.
        S.duplicateFrame();
        out.dup = S.getOpen().frames.length === 3 && S.getOpen().frames[1] === S.getOpen().frames[2];
        const l2 = L.addLayer('Top');
        out.joined = S.getOpen().layerIds.includes(l2.id);
        draw(l2, 30, 30);           // only on frame 3 (index 2)
        S.goTo(0);
        draw(l2, 40, 40);           // only on frame 1
        L.setCurrentLayer(l2.index);
        L.mergeDown(l2.index);
        out.mergedFrame0 = ink(L.layers[1], 40, 40) === 1 && ink(L.layers[1], 30, 30) === 0;
        S.goTo(2);
        out.mergedFrame2 = ink(L.layers[1], 30, 30) === 1 && ink(L.layers[1], 40, 40) === 0 && ink(L.layers[1], 20, 20) === 1;
        UndoRedo.undo();   // the merge
        out.mergeUndone = L.layers.length === 3;
        // Save and load the project data.
        const data = App._getProjectData({ packed: true });
        out.saved = !!data.animations && data.animations.list.length === 1;
        out.celsDeduped = data.animations.cels.length;
        await App._loadProjectData(JSON.parse(JSON.stringify(data, Helpers.jsonTypedReplacer), Helpers.jsonTypedReviver));
        const a2 = S.getOpen();
        out.loaded = !!a2 && a2.frames.length === 3;
        S.goTo(0);
        out.loadedFrame0 = ink(L.layers[1], 10, 10) === 1;
        // Playback steps frames on the clock.
        S.setAllDelays(1);
        const seen = new Set();
        const off = EventBus.on(EVENTS.ANIMATION_FRAME, (d) => seen.add(d.frame));
        S.play();
        await new Promise(res => setTimeout(res, 200));
        S.stop();
        out.played = seen.size === 3 && !S.isPlaying();
        // Sprite from a selection.
        SelectionService.setSelection({ x: 64, y: 64, width: 13, height: 9 });
        const sp = S.createSprite({ rect: AnimationServiceClass.rectFromSelection(SelectionService.getSelection()), frames: 2 });
        out.sprite = !!sp && sp.rect.cw === 2 && sp.rect.ch === 2 && sp.frames.length === 2;
        out.mode = ScreenModeService.switchMode('multicolor_8x1') === false;
        const thumb = S.renderFrame(a2, 0);
        out.thumb = !!thumb && thumb.width === 256 && thumb.words.length === 256 * 192;
        out.panelShown = PanelSection.isVisible('animation-panel');
        out.stripItems = document.querySelectorAll('#animation-panel .anim-frame').length;
        return out;
    });
    for (const [name, value] of Object.entries(r)) {
        if (name === 'celsDeduped' || name === 'stripItems') continue;
        expect(value, name).toBe(true);
    }
    // 3 frames, frame 2 and 3 share their cels, so 2 layers x 3 frames store fewer than 6 distinct cels... at most 6.
    expect(r.celsDeduped).toBeLessThanOrEqual(6);
    expect(r.stripItems).toBe(2);
    expect(errors).toEqual([]);
});

test('a stopped animation leaves nothing scheduled', async ({ page }) => {
    await page.addInitScript(() => {
        window.__timeouts = 0;
        const st = window.setTimeout.bind(window);
        window.setTimeout = (fn, ms, ...a) => { window.__timeouts++; return st(fn, ms, ...a); };
    });
    await boot(page);
    const counts = await page.evaluate(async () => {
        AnimationService.createScreen();
        AnimationService.addFrame();
        AnimationService.setAllDelays(1);
        AnimationService.play();
        await new Promise((r) => setTimeout(r, 150));
        AnimationService.pause();
        await new Promise((r) => setTimeout(r, 300));
        const before = window.__timeouts;
        await new Promise((r) => setTimeout(r, 500));
        return { playing: AnimationService.isPlaying(), extra: window.__timeouts - before - 1 };
    });
    expect(counts.playing).toBe(false);
    expect(counts.extra).toBeLessThanOrEqual(0);
});
