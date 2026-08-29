'use strict';
/**
 * The reference panel's readouts must follow the image.
 *
 * Reported symptom: load a reference image, press Center, then press a
 * direction arrow - and the image jumps somewhere else entirely instead of
 * moving one pixel.
 *
 * Cause: Center, Fit/Fill and restoreState all changed the offset (and Fit
 * the scale, and restoreState everything) while announcing only what they
 * DID - "centered", "fitted", nothing at all - never the facts that had
 * CHANGED. The panel's fields render from the fact events, so they kept the
 * old numbers, and the direction pad computed its next value from the field.
 * The first arrow press therefore wrote the pre-Center offset straight back.
 *
 * Two defences, and this file covers both: the service now announces the
 * transform facts from every one of those paths, and the pad derives its
 * next value from the service rather than from the number on screen, so a
 * future silent writer costs a stale readout rather than a corrupted offset.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** 64x64 - big enough that centring lands somewhere clearly not the origin. */
const PNG_64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJ' +
    'AAAAHUlEQVRo3u3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAA4NIQAAAV0e8gAAAAAASUVORK5CYII=';

const loadReference = async (page) => {
    await page.evaluate(async (url) => {
        ReferenceLayerService.loadImage(url);
        await new Promise((resolve) => {
            const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
        });
    }, PNG_64);
    await page.evaluate(() => {
        const toggle = document.querySelector('#reference-panel .panel-collapse');
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
    });
};

/** The service's truth beside what the panel is showing. */
const state = (page) => page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
        svc: {
            x: ReferenceLayerService.offsetX,
            y: ReferenceLayerService.offsetY,
            scale: ReferenceLayerService.scale
        },
        ui: {
            x: Number(q('#ref-offset-x').value),
            y: Number(q('#ref-offset-y').value),
            scale: Number(q('#ref-scale').value)
        }
    };
});

/** Exactly what the direction pad does for one press of the right arrow. */
const nudgeRight = (page) => page.evaluate(() => {
    const xi = document.querySelector('#ref-offset-x');
    xi.value = String(Math.round(ReferenceLayerService.offsetX) + 1);
    xi.dispatchEvent(new Event('change', { bubbles: true }));
});

test('Center leaves the panel showing where the image actually is', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => ReferenceLayerService.setOffset(40, 30));
    await page.evaluate(() => ReferenceLayerService.centerImage());

    const s = await state(page);
    expect(s.ui.x).toBe(Math.round(s.svc.x));
    expect(s.ui.y).toBe(Math.round(s.svc.y));
    // Centring must actually have moved it, or this proves nothing.
    expect(s.svc.x).not.toBe(40);
});

test('an arrow press after Center moves ONE pixel, and does not jump', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => ReferenceLayerService.setOffset(40, 30));
    await page.evaluate(() => ReferenceLayerService.centerImage());

    const centred = await state(page);
    await nudgeRight(page);
    const after = await state(page);

    expect(after.svc.x).toBe(Math.round(centred.svc.x) + 1);
    expect(after.svc.y).toBe(centred.svc.y);
});

test('Fit syncs the scale as well as the offset', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => { ReferenceLayerService.setOffset(40, 30);
                                ReferenceLayerService.setScale(150); });
    await page.evaluate(() => ReferenceLayerService.fitToCanvas('contain'));

    const s = await state(page);
    expect(s.ui.x).toBe(Math.round(s.svc.x));
    expect(s.ui.y).toBe(Math.round(s.svc.y));
    // Fit changes the scale too - that readout went stale for the same reason.
    expect(s.ui.scale).toBe(Math.round(s.svc.scale));
    expect(s.svc.scale).not.toBe(150);
});

test('an arrow press after Fit moves ONE pixel, and does not jump', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => ReferenceLayerService.setOffset(40, 30));
    await page.evaluate(() => ReferenceLayerService.fitToCanvas('contain'));

    const fitted = await state(page);
    await nudgeRight(page);
    const after = await state(page);

    expect(after.svc.x).toBe(Math.round(fitted.svc.x) + 1);
    // The axis NOT being nudged must not move. This is the half that actually
    // caught the bug: the panel commits both fields together, so a stale Y
    // rode along on every X nudge and dragged the image back with it.
    expect(after.svc.y).toBe(fitted.svc.y);
});

test('restoring a placement (preset, .pixula, reload) syncs the panel', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => ReferenceLayerService.setOffset(10, 10));
    await page.evaluate(() => ReferenceLayerService.restoreState({
        offsetX: 123, offsetY: 45, scale: 200
    }));

    const s = await state(page);
    expect(s.svc.x).toBe(123);
    expect(s.ui.x).toBe(123);
    expect(s.ui.y).toBe(45);
    expect(s.ui.scale).toBe(200);
});

test('Reset still syncs the panel, as it always did', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => { ReferenceLayerService.setOffset(40, 30);
                                ReferenceLayerService.resetTransform(); });

    const s = await state(page);
    expect(s.svc.x).toBe(0);
    expect(s.ui.x).toBe(0);
    expect(s.ui.y).toBe(0);
});

test('the real direction pad, pressed after Center, moves one pixel', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    await page.evaluate(() => ReferenceLayerService.setOffset(40, 30));
    await page.evaluate(() => ReferenceLayerService.centerImage());
    const centred = await state(page);

    // All four zones are full-size overlapping buttons separated only by
    // clip-path, so a centre-click always lands on whichever is last in the
    // DOM - aim into the right-hand triangle instead.
    const zone = page.locator('.dir-pad-zone-right:not([data-tp-transform])').first();
    await zone.scrollIntoViewIfNeeded();
    const box = await zone.boundingBox();
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5);
    await page.waitForTimeout(50);

    const after = await state(page);
    expect(after.svc.x).toBe(Math.round(centred.svc.x) + 1);
    expect(after.svc.y).toBe(centred.svc.y);
});
