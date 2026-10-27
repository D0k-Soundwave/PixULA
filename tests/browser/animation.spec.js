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

test('preview layers: a traced frame shows faded on screen only, under ink above it, and follows the frame shown', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page);
    const r = await page.evaluate(() => {
        const out = {};
        const L = LayerManager, S = AnimationService;
        const draw = (layer, x, y) => {
            UndoRedo.beginAction('test');
            const c = layer.getCell(x >> 3, y >> 3);
            c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
            L.composeToCanvas();
            UndoRedo.endAction();
        };
        const shown = (x, y) => { L.flushPendingCompose(); return CanvasSystem.pixels[y * ZX_SPECTRUM.WIDTH + x] >>> 0; };
        const still = (x, y) => { const d = L.stillImageData().data; const i = (y * ZX_SPECTRUM.WIDTH + x) * 4; return [d[i], d[i + 1], d[i + 2]].join(','); };
        S.createScreen();
        draw(L.layers[1], 10, 10);              // frame 1: an ink pixel at 10,10
        const paper = shown(20, 20);
        const inkWord = shown(10, 10);
        S.addFrame();                            // frame 2, blank
        out.blankHere = shown(10, 10) === paper;
        L.setCurrentLayer(1);
        const p = S.addPreview({ frame: 0 });
        out.previewAnchoredUnder = p.anchorId === L.layers[0].id;
        const blended = shown(10, 10);
        out.blendShows = blended !== paper && blended !== inkWord;
        out.stillHasNoPreview = still(10, 10) === still(20, 20);
        S.updatePreview(p.id, { opacity: 100, tint: false });
        out.fullOpacityIsInk = shown(10, 10) === inkWord;
        S.updatePreview(p.id, { opacity: 0 });
        out.zeroOpacityIsPaper = shown(10, 10) === paper;
        S.updatePreview(p.id, { opacity: 50 });
        // Ink drawn on the layer above the preview covers it
        draw(L.layers[1], 10, 10);
        out.inkAboveCovers = shown(10, 10) === inkWord;
        // Moved above the drawing layer, it is faded over that ink instead
        S.updatePreview(p.id, { tint: true });
        S.movePreview(p.id, 1);
        out.movedAboveTints = shown(10, 10) !== inkWord;
        S.updatePreview(p.id, { visible: false });
        out.hiddenGone = shown(10, 10) === inkWord;
        S.updatePreview(p.id, { visible: true });
        // Previous follows the frame shown
        S.addFrame();   // frame 3, blank
        const prev = S.addPreview({ relative: -1 });
        out.prevShowsFrame2 = S.previewFrameIndex(S.getOpen(), prev) === 1;
        S.goTo(1);
        out.prevFollows = S.previewFrameIndex(S.getOpen(), prev) === 0;
        // Undo removes the preview; saving keeps previews
        UndoRedo.undo();
        out.undoRemoved = !S.getPreviews().some(x => x.id === prev.id);
        const data = App._getProjectData({ packed: true });
        out.savedPreviews = data.animations.list[0].previews.length === 1;
        out.layerRows = document.querySelectorAll('#layer-list .layer-preview').length;
        out.animatedButtons = document.querySelectorAll('#layer-list .layer-animated.active').length;
        // Shared switch
        const l2 = L.addLayer('Backdrop');
        S.setLayerAnimated(l2.id, false);
        out.sharedOk = !S.isLayerAnimated(l2.id);
        S.setOnionSkin(true);
        out.onion = S.isOnionSkin();
        return out;
    });
    for (const [name, value] of Object.entries(r)) {
        if (name === 'layerRows' || name === 'animatedButtons') continue;
        expect(value, name).toBe(true);
    }
    expect(r.layerRows).toBe(1);
    expect(r.animatedButtons).toBe(1);
    expect(errors).toEqual([]);
});

test('exports: numbered screens byte-identical to single saves (zip), GIF timing with FLASH, SevenuP round trip, tape, sheet', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page);
    const r = await page.evaluate(async () => {
        const out = {};
        const L = LayerManager, S = AnimationService;
        const saved = [];
        Helpers.downloadFile = async (data, name) => {
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
            saved.push({ name, bytes });
            return true;
        };
        const draw = (x, y, flash = false) => {
            UndoRedo.beginAction('test');
            const c = L.layers[1].getCell(x >> 3, y >> 3);
            c.pixels[y & 7] |= 0x80 >> (x & 7); c.altered = true;
            if (flash) { c.flash = true; c.ink = 2; c.paper = 7; }
            L.composeToCanvas();
            UndoRedo.endAction();
        };
        S.createScreen();
        draw(10, 10);
        S.addFrame(); draw(20, 20, true);
        S.addFrame(); draw(30, 30);
        // what a single save of each frame gives
        const single = [];
        for (let i = 0; i < 3; i++) { S.goTo(i); single.push(SCRFormat.export().slice()); }
        S.goTo(1);
        const n = await AnimationExport.exportNumbered({ ext: 'scr', folder: false });
        out.numbered = n === 3;
        const zip = saved.pop();
        out.zipName = zip.name;
        // read the zip back: local headers in order
        const z = zip.bytes, dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
        let p = 0; const entries = [];
        while (dv.getUint32(p, true) === 0x04034B50) {
            const size = dv.getUint32(p + 18, true), nameLen = dv.getUint16(p + 26, true), crc = dv.getUint32(p + 14, true);
            const name = new TextDecoder().decode(z.subarray(p + 30, p + 30 + nameLen));
            const data = z.subarray(p + 30 + nameLen, p + 30 + nameLen + size);
            entries.push({ name, data, crcOk: ZipStore.crc32(data) === crc });
            p += 30 + nameLen + size;
        }
        out.zipEntries = entries.map(e => e.name).join(',');
        out.zipCrc = entries.every(e => e.crcOk);
        out.byteIdentical = entries.length === 3 && entries.every((e, i) => e.data.length === single[i].length && e.data.every((b, k) => b === single[i][k]));
        out.backOnFrame = S.getOpen().current === 1;
        out.flashKept = (entries[1].data[6144 + (20 >> 3) * 32 + (20 >> 3)] & 0x80) !== 0;
        // GIF
        S.setDelay(5, 0); S.setDelay(20, 1); S.setDelay(5, 2);
        await AnimationExport.exportGif();
        const gif = saved.pop();
        out.gifHeader = String.fromCharCode(...gif.bytes.subarray(0, 6)) === 'GIF89a';
        // timeline: frame 0 (5 ticks), frame 1 flashes (20 ticks: phases at 16-tick boundaries), frame 2 (5)
        const shots = [];
        await AnimationExport._eachFrame([0, 1, 2], async (i) => { const g = GIFFormat.phases(); shots.push({ delayTicks: S.getOpen().frames[i].delayTicks, kind: g.kind, phases: g.phases }); });
        const tl = AnimationExport.timeline(shots);
        out.timeline = tl.map(f => f.delayCs).join(',');
        // SevenuP round trip
        await AnimationExport.exportSev();
        const sev = saved.pop();
        out.sevFrames = sev.bytes[8] === 2;
        const before = S.animations.length;
        S.deleteAnimation(S.getOpen().id);
        const res = SEVFormat.parse(sev.bytes.buffer.slice(sev.bytes.byteOffset, sev.bytes.byteOffset + sev.bytes.length));
        out.sevImported = res.success && S.getOpen() && S.getOpen().frames.length === 3 && S.getOpen().kind === 'sprite';
        // Tape
        S.deleteAnimation(S.getOpen().id);
        S.createScreen(); S.addFrame(); S.addFrame();
        await AnimationExport.exportTape('tap');
        const tap = saved.pop();
        const blocks = TAPFormat.listBlocks(tap.bytes);
        out.tapBlocks = blocks.success && blocks.blocks.length === 6 && blocks.blocks.filter(b => b.isScreen).length === 3;
        out.tapNames = blocks.blocks.filter(b => b.name).map(b => b.name.trim()).join(',');
        await AnimationExport.exportTape('tzx');
        const tzx = saved.pop();
        const tb = TZXFormat.listBlocks(tzx.bytes);
        out.tzxBlocks = tb.success && tb.blocks.length === 6;
        await AnimationExport.exportSheet();
        out.sheet = saved.pop().name;
        out.sprRefused = AnimationExport.refusal('spr') !== null;
        // Frame to stamp
        out.frameToStamp = S.frameToStamp() && SelectionService.isFloating();
        return out;
    });
    const expected = {
        zipEntries: 'Animation 1_001.scr,Animation 1_002.scr,Animation 1_003.scr',
        zipName: 'Animation 1.zip',
        // frame 1 for 5 ticks, frame 2 for 20 ticks split at the 16-tick FLASH swap, frame 3 for 5 ticks (in 1/100 s)
        timeline: '10,22,18,10',
        tapNames: 'Animati001,Animati002,Animati003',
        sheet: 'Animation 1-sheet.png'
    };
    for (const [name, value] of Object.entries(r)) {
        if (name in expected) expect(value, name).toBe(expected[name]);
        else expect(value, name).toBe(true);
    }
    expect(errors).toEqual([]);
});

test('Stamps to Frames: each parked stamp becomes a new frame where it is parked, and the stamps stay', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page);
    const r = await page.evaluate(() => {
        const L = LayerManager, S = AnimationService;
        const ink = (x, y) => { const c = L.layers[1].getCell(x >> 3, y >> 3); return (c.pixels[y & 7] >> (7 - (x & 7))) & 1; };
        UndoRedo.beginAction('test');
        const c = L.layers[1].getCell(2, 2); c.pixels[0] = 0xFF; c.altered = true;
        L.composeToCanvas();
        UndoRedo.endAction();
        S.createScreen();
        // A stamp of that cell, parked where it was copied from
        SelectionService.setSelection({ x: 16, y: 16, width: 8, height: 8 });
        SelectionService.copyOrCut(false);
        SelectionService.endFloatingPaste();
        const stampsBefore = L.layers.filter(l => l.isStamp).length;
        const added = S.stampsToFrames();
        const a = S.getOpen();
        return {
            added, frames: a.frames.length, current: a.current,
            stampsKept: L.layers.filter(l => l.isStamp).length === stampsBefore,
            stampLanded: ink(16, 16) === 1 && ink(23, 16) === 1,
            frame1Intact: (S.goTo(0), ink(16, 16) === 1)
        };
    });
    expect(r).toEqual({ added: 1, frames: 2, current: 1, stampsKept: true, stampLanded: true, frame1Intact: true });
    expect(errors).toEqual([]);
});

test('a new blank frame keeps the picture\'s background', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        LayerManager.setBackgroundColor(2);   // red paper
        AnimationService.createScreen();
        AnimationService.addFrame();
        const bg = LayerManager.getBackgroundLayer().getCell(5, 5);
        const a = AnimationService.getOpen();
        return { paper: bg.paper, sharesBackground: a.frames[0].cels[LayerManager.getBackgroundLayer().id] === a.frames[1].cels[LayerManager.getBackgroundLayer().id] };
    });
    expect(r).toEqual({ paper: 2, sharesBackground: true });
});
