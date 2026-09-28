'use strict';
/**
 * Undo and redo give back exactly the document they should, and in a big
 * document they no longer copy every layer to do it.
 *
 * Found 2026-09-28: each undo or redo packed every layer's grid before
 * restoring, then compared them all to throw most away again - 70-80 ms a
 * step in a 32-layer LAYER2_640 document. Grids the step never touches are
 * now left out from the start. The speed check is judged against the cost of
 * packing every layer on THIS machine, so a slow runner cannot fail it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a random run of edits undoes and redoes step for step', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const fp = () => [LayerManager.getBackgroundLayer(), ...LayerManager.layers.slice(1)].map((l) => {
            const p = l.packAttributeData();
            return `${l.id}:${l.name}:${l.visible}:` + Object.keys(p).filter((k) => p[k] && p[k].BYTES_PER_ELEMENT)
                .map((k) => p[k].reduce((h, v) => (h * 31 + v) | 0, 7)).join(',');
        }).join('|') + `#${ScreenModeService.getModeId()}`;

        let s = 12345;
        const rnd = (n) => (s = (s * 16807) % 2147483647) % n;
        const sel = () => ColorManager.getCurrentSelection();
        const actions = [
            () => { // a stroke on some layer
                const i = 1 + rnd(LayerManager.layers.length - 1);
                LayerManager.setCurrentLayer(i);
                UndoRedo.beginAction('stroke');
                for (let k = 0; k < 30; k++) PixelDrawRoutine.draw(rnd(ZX_SPECTRUM.WIDTH), rnd(ZX_SPECTRUM.HEIGHT), sel(), DRAW_MODE.NORMAL);
                UndoRedo.endAction();
            },
            () => LayerManager.addLayer(null, true),
            () => { if (LayerManager.layers.length > 3) LayerManager.removeLayer(1 + rnd(LayerManager.layers.length - 1)); },
            () => { UndoRedo.beginAction('bg'); LayerManager.setBackgroundColor(rnd(8)); UndoRedo.endAction(); },
            () => { UndoRedo.beginAction('hide'); LayerManager.setLayerVisibility(1, !LayerManager.layers[1].visible); UndoRedo.endAction(); },
            () => ScreenModeService.switchMode(['standard_ula', 'gigascreen', 'layer2_256', 'ula_plus'][rnd(4)])
        ];

        UndoRedo.clear();
        const states = [fp()];
        for (let n = 0; n < 40; n++) {
            actions[rnd(actions.length)]();
            LayerManager.flushPendingCompose();
            if (fp() !== states[states.length - 1]) states.push(fp());
            else UndoRedo.undoStack.length > states.length - 1 && UndoRedo.undoStack.pop();
        }
        const steps = UndoRedo.getUndoCount();
        const bad = [];
        // All the way back, all the way forward, then back and forth
        for (let i = steps; i > 0; i--) { UndoRedo.undo(); if (fp() !== states[i - 1]) bad.push(`undo to ${i - 1}`); }
        for (let i = 1; i <= steps; i++) { UndoRedo.redo(); if (fp() !== states[i]) bad.push(`redo to ${i}`); }
        let at = steps;
        for (let k = 0; k < 30; k++) {
            if (rnd(2) && at > 0) { UndoRedo.undo(); at--; } else if (at < steps) { UndoRedo.redo(); at++; }
            if (fp() !== states[at]) bad.push(`mixed step ${k} at ${at}`);
        }
        return { steps, statesSeen: states.length, bad };
    });
    expect(r.steps).toBe(r.statesSeen - 1);
    expect(r.steps).toBeGreaterThan(20);
    expect(r.bad).toEqual([]);
});

test('undo and redo in a 32-layer LAYER2_640 document do not copy every layer', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        ScreenModeService.applyModeRaw('layer2_640');
        LayerManager.reset();
        while (LayerManager.getLayerCount() < 32) if (!LayerManager.addLayer(null, false)) break;
        LayerManager.setCurrentLayer(1);
        const sel = ColorManager.getCurrentSelection();
        const best = (fn) => {
            let m = Infinity;
            for (let i = 0; i < 5; i++) { const t0 = performance.now(); fn(); m = Math.min(m, performance.now() - t0); }
            return m;
        };
        // The yardstick: packing every layer once, what each step used to do twice
        const packAll = best(() => LayerManager.captureAllLayersState());
        UndoRedo.clear();
        for (let n = 0; n < 5; n++) {
            UndoRedo.beginAction('stroke');
            for (let k = 0; k < 50; k++) PixelDrawRoutine.draw(10 + k, 10 + n, sel, DRAW_MODE.NORMAL);
            UndoRedo.endAction();
        }
        let undo = Infinity, redo = Infinity;
        for (let n = 0; n < 5; n++) {
            let t0 = performance.now(); UndoRedo.undo(); undo = Math.min(undo, performance.now() - t0);
        }
        for (let n = 0; n < 5; n++) {
            let t0 = performance.now(); UndoRedo.redo(); redo = Math.min(redo, performance.now() - t0);
        }
        return { packAll, undo, redo };
    });
    // Measured 2026-09-28 against packAll: before, undo 2.8x and redo 3.2x;
    // after, both 0.65x (the restore and a recompose remain)
    expect(r.undo).toBeLessThan(r.packAll * 1.5);
    expect(r.redo).toBeLessThan(r.packAll * 1.5);
});
