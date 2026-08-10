'use strict';
/**
 * Undo snapshots are PACKED, and packing must be invisible.
 *
 * The live cell model - one object per cell, each wrapping its own typed
 * arrays - is right for drawing and wrong for holding fifty copies of: at
 * LAYER2_640 a layer was 1.63 MB to carry 82 KB of picture. Snapshots now
 * store the same information in flat typed arrays.
 *
 * The whole bet is that it round-trips EXACTLY. A snapshot that quietly
 * normalises anything is a snapshot that repairs the document on undo, which
 * is a behaviour change hiding inside a memory optimisation - so these specs
 * wreck a layer and demand byte-identical restoration, including the case
 * where a cell's attributes are `undefined` rather than a value.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const paint = (page, n, k) => page.evaluate(({ n, k }) => {
    PixelDrawRoutine.beginBatch('paint');
    for (let i = 0; i < n; i++) {
        PixelDrawRoutine.draw((i * k) % ZX_SPECTRUM.WIDTH, (i * (k + 2)) % ZX_SPECTRUM.HEIGHT, {});
    }
    PixelDrawRoutine.endBatch();
}, { n, k });

test('a packed snapshot restores a classic-mode layer exactly', async ({ page }) => {
    await boot(page);
    await paint(page, 200, 13);

    const r = await page.evaluate(() => {
        const L = LayerManager.layers[1];
        const before = JSON.stringify(L.cloneAttributeData());
        const snap = L.packAttributeData();
        PixelDrawRoutine.beginBatch('wreck');
        for (let i = 0; i < 400; i++) PixelDrawRoutine.draw((i * 7) % 256, (i * 9) % 192, {});
        PixelDrawRoutine.endBatch();
        const wrecked = JSON.stringify(L.cloneAttributeData());
        L.unpackAttributeData(snap);
        return { changed: wrecked !== before,
                 restored: JSON.stringify(L.cloneAttributeData()) === before };
    });

    expect(r.changed).toBe(true);      // the wreck has to be real or this proves nothing
    expect(r.restored).toBe(true);
});

test('a packed snapshot restores indices and transparency exactly', async ({ page }) => {
    await boot(page);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await paint(page, 200, 11);

    const r = await page.evaluate(() => {
        const L = LayerManager.layers[1];
        const before = JSON.stringify(L.cloneAttributeData());
        const snap = L.packAttributeData();
        // Transparency is the interesting case: -1 does not fit a byte
        // alongside 0..255, so it travels as its own bitmask.
        const hadTransparent = L.attributeData.some(row =>
            row.some(c => c.indices && Array.from(c.indices).some(v => v === -1)));
        PixelDrawRoutine.beginBatch('wreck');
        for (let i = 0; i < 500; i++) PixelDrawRoutine.draw((i * 5) % 256, (i * 3) % 192, {});
        PixelDrawRoutine.endBatch();
        const wrecked = JSON.stringify(L.cloneAttributeData());
        L.unpackAttributeData(snap);
        return { hadTransparent, changed: wrecked !== before,
                 restored: JSON.stringify(L.cloneAttributeData()) === before };
    });

    expect(r.hadTransparent).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.restored).toBe(true);
});

test('an undefined attribute comes back undefined, not zero', async ({ page }) => {
    await boot(page);

    // A Uint8Array cannot hold the difference between "undefined" and 0, so the
    // pack carries a "defined" bit. Without it, undo would silently turn an
    // unset attribute into black ink.
    const r = await page.evaluate(() => {
        const L = LayerManager.layers[1];
        const c = L.attributeData[0][0];
        c.ink = undefined; c.paper = undefined; c.bright = undefined; c.flash = undefined;

        const snap = L.packAttributeData();
        c.ink = 5; c.paper = 1; c.bright = true; c.flash = true;
        L.unpackAttributeData(snap);

        return { ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash };
    });

    expect(r).toEqual({ ink: undefined, paper: undefined, bright: undefined, flash: undefined });
});

test('undo and redo still work through the packed path', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        const cell = () => {
            const c = LayerManager.layers[1].attributeData[0][0];
            return Array.from(c.pixels).join(',');
        };
        UndoRedo.undoStack = []; UndoRedo.redoStack = [];
        const start = cell();

        PixelDrawRoutine.beginBatch('stroke');
        for (let i = 0; i < 8; i++) PixelDrawRoutine.draw(i, i, {});
        PixelDrawRoutine.endBatch();
        const drawn = cell();

        UndoRedo.undo();
        const undone = cell();
        UndoRedo.redo();
        const redone = cell();

        return { changed: drawn !== start, undoneBack: undone === start, redoneAgain: redone === drawn };
    });

    expect(r.changed).toBe(true);
    expect(r.undoneBack).toBe(true);
    expect(r.redoneAgain).toBe(true);
});

/*
 * Dirty-layer tracking. beginAction cannot know what an action will touch, so
 * the grids of untouched layers are dropped at endAction by comparison -
 * comparison rather than notification from the write paths, because a missed
 * notification would silently corrupt an undo and there are several legitimate
 * ways to write a layer.
 */

test('a stroke on one layer keeps one grid, not all of them', async ({ page }) => {
    await boot(page);
    page.on('dialog', d => d.accept());

    await page.evaluate(() => ScreenModeService.switchMode('layer2_640'));
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_640');
    await page.evaluate(() => {
        while (LayerManager.layers.length < 8) LayerManager.addLayer();
    });

    const r = await page.evaluate(() => {
        UndoRedo.undoStack = []; UndoRedo.redoStack = [];
        PixelDrawRoutine.beginBatch('one layer');
        for (let i = 0; i < 100; i++) PixelDrawRoutine.draw(i, i, {});
        PixelDrawRoutine.endBatch();

        const layers = UndoRedo.undoStack[0].before.layers.layers;
        return { inEntry: layers.length,
                 gridsKept: layers.filter(L => L.attributeData !== null).length };
    });

    expect(r.inEntry).toBeGreaterThan(1);
    // Only the layer actually drawn on carries its pixels
    expect(r.gridsKept).toBe(1);
});

test('undo restores correctly when most grids were dropped', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        while (LayerManager.layers.length < 6) LayerManager.addLayer();
        const read = (i) => Array.from(LayerManager.layers[i].attributeData[0][0].pixels).join(',');

        // Give an untouched layer recognisable content first
        LayerManager.setCurrentLayer(2);
        PixelDrawRoutine.beginBatch('layer 2');
        for (let i = 0; i < 8; i++) PixelDrawRoutine.draw(i, 0, {});
        PixelDrawRoutine.endBatch();
        const layer2Content = read(2);

        // Now draw on a different layer
        LayerManager.setCurrentLayer(4);
        UndoRedo.undoStack = []; UndoRedo.redoStack = [];
        const before4 = read(4);
        PixelDrawRoutine.beginBatch('layer 4');
        for (let i = 0; i < 8; i++) PixelDrawRoutine.draw(i, 0, {});
        PixelDrawRoutine.endBatch();
        const after4 = read(4);

        UndoRedo.undo();

        return {
            layer4Changed: after4 !== before4,
            layer4Restored: read(4) === before4,
            // The untouched layer's pixels were never stored, and must survive
            layer2Intact: read(2) === layer2Content
        };
    });

    expect(r.layer4Changed).toBe(true);
    expect(r.layer4Restored).toBe(true);
    expect(r.layer2Intact).toBe(true);
});

test('a deleted layer keeps its grid, so undoing the delete brings it back',
    async ({ page }) => {
        await boot(page);

        // The safety property behind reuse: only a layer that still exists may
        // be marked unchanged, so a null grid always has a live counterpart.
        const r = await page.evaluate(() => {
            while (LayerManager.layers.length < 4) LayerManager.addLayer();
            LayerManager.setCurrentLayer(2);
            PixelDrawRoutine.beginBatch('content');
            for (let i = 0; i < 8; i++) PixelDrawRoutine.draw(i, 0, {});
            PixelDrawRoutine.endBatch();
            const content = Array.from(LayerManager.layers[2].attributeData[0][0].pixels).join(',');
            const countBefore = LayerManager.layers.length;

            UndoRedo.beginAction('delete');
            LayerManager.removeLayer(2);
            UndoRedo.endAction();
            const countAfter = LayerManager.layers.length;

            UndoRedo.undo();

            return {
                deleted: countAfter === countBefore - 1,
                countRestored: LayerManager.layers.length === countBefore,
                contentRestored:
                    Array.from(LayerManager.layers[2].attributeData[0][0].pixels).join(',') === content
            };
        });

        expect(r.deleted).toBe(true);
        expect(r.countRestored).toBe(true);
        expect(r.contentRestored).toBe(true);
    });

/*
 * The history is bounded by BYTES as well as by count, because entries are not
 * the same size: a one-layer stroke and an all-layer action differ 32x at the
 * largest mode. A count alone would let 500 all-layer actions reach ~3.3 GB.
 */

test('the history is capped by bytes, not only by entry count', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        const K = UndoRedoService.constructor;
        const realBudget = K.MAX_HISTORY_BYTES;
        // Small enough to bite within a few strokes, but comfortably above
        // MIN_HISTORY_ENTRIES x an entry - otherwise the FLOOR is what stops
        // the pruning and the budget is not what is being tested. At
        // STANDARD_ULA an entry is ~8.4 KB, so ten of them is ~84 KB.
        K.MAX_HISTORY_BYTES = 150 * 1024;

        UndoRedo.undoStack = []; UndoRedo.redoStack = [];
        UndoRedo.maxStates = 500;

        for (let s = 0; s < 40; s++) {
            PixelDrawRoutine.beginBatch('s' + s);
            for (let i = 0; i < 4; i++) PixelDrawRoutine.draw((s * 4 + i) % 256, s % 192, {});
            PixelDrawRoutine.endBatch();
        }

        const total = UndoRedo.undoStack.reduce((n, e) => n + K.entryBytes(e), 0);
        const out = {
            entries: UndoRedo.undoStack.length,
            underCount: UndoRedo.undoStack.length < 500,     // pruned before the count limit
            withinBudget: total <= K.MAX_HISTORY_BYTES,
            aboveFloor: UndoRedo.undoStack.length >= K.MIN_HISTORY_ENTRIES,
            entryBytesPositive: K.entryBytes(UndoRedo.undoStack[0]) > 0
        };
        K.MAX_HISTORY_BYTES = realBudget;
        return out;
    });

    expect(r.entryBytesPositive).toBe(true);
    expect(r.underCount).toBe(true);      // the BYTE budget did the pruning
    expect(r.withinBudget).toBe(true);
    expect(r.aboveFloor).toBe(true);      // never pruned below a usable history
});

test('the byte budget never prunes below the floor', async ({ page }) => {
    await boot(page);

    // A budget smaller than a single entry must still leave MIN_HISTORY_ENTRIES,
    // or undo would be least reliable exactly when the document is largest.
    const r = await page.evaluate(() => {
        const K = UndoRedoService.constructor;
        const realBudget = K.MAX_HISTORY_BYTES;
        K.MAX_HISTORY_BYTES = 1;

        UndoRedo.undoStack = []; UndoRedo.redoStack = [];
        for (let s = 0; s < 25; s++) {
            PixelDrawRoutine.beginBatch('s' + s);
            PixelDrawRoutine.draw(s % 256, s % 192, {});
            PixelDrawRoutine.endBatch();
        }
        const entries = UndoRedo.undoStack.length;
        K.MAX_HISTORY_BYTES = realBudget;
        return { entries, floor: K.MIN_HISTORY_ENTRIES };
    });

    expect(r.entries).toBe(r.floor);
});

test('the redo stack is trimmed too, not left holding full snapshots',
    async ({ page }) => {
        await boot(page);

        // undo() captures its counterpart BEFORE the restore, so it can only be
        // trimmed after. Left untrimmed, undoing a run of cheap one-layer
        // strokes would convert a small undo stack into a huge redo stack, and
        // the byte budget never sees the redo side.
        const r = await page.evaluate(() => {
            const K = UndoRedoService.constructor;
            while (LayerManager.layers.length < 6) LayerManager.addLayer();
            LayerManager.setCurrentLayer(3);

            UndoRedo.undoStack = []; UndoRedo.redoStack = [];
            for (let s = 0; s < 5; s++) {
                PixelDrawRoutine.beginBatch('s' + s);
                for (let i = 0; i < 4; i++) PixelDrawRoutine.draw(s * 4 + i, s, {});
                PixelDrawRoutine.endBatch();
            }
            const undoEntry = K.entryBytes(UndoRedo.undoStack[UndoRedo.undoStack.length - 1]);

            UndoRedo.undo();
            const redoEntry = K.entryBytes(UndoRedo.redoStack[UndoRedo.redoStack.length - 1]);
            const gridsInRedo = UndoRedo.redoStack[UndoRedo.redoStack.length - 1]
                .before.layers.layers.filter(L => L.attributeData !== null).length;

            // And the round trip must still be correct. Compare the WHOLE
            // layer: a single cell probe can sit outside the stroke the undo
            // actually reverted, and then proves nothing.
            const whole = () => Array.from(
                LayerManager.layers[3].packAttributeData().pixels).join(',');
            const afterUndo = whole();
            UndoRedo.redo();
            const afterRedo = whole();

            return { undoEntry, redoEntry, gridsInRedo,
                     redoChangedIt: afterRedo !== afterUndo };
        });

        expect(r.undoEntry).toBeGreaterThan(0);
        // A one-layer undo produces a one-layer redo entry, not a full document
        expect(r.gridsInRedo).toBe(1);
        expect(r.redoEntry).toBeLessThanOrEqual(r.undoEntry * 2);
        expect(r.redoChangedIt).toBe(true);
    });
