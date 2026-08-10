'use strict';
/**
 * Touch admission, driven by synthetic PointerEvents.
 *
 * The first automated coverage of touch anywhere in the tree — until this file
 * existed, every palm-rejection row in tests/TESTLOG.md was hardware-only, so
 * the guard could regress silently for months between the rare occasions
 * someone put a hand on a screen. Real fingers and real palm geometry stay a
 * manual row; what is pinned here is the ROUTING: given the events a touch
 * WOULD send, does it mark the picture or not?
 *
 * Structure follows input-pen.spec.js — events dispatched inside the canvas
 * iframe, pointerType being the one property the routing branches on. Touch
 * needs distinct pointerIds where the pen suite needed only one, because half
 * of what is tested here is what happens when two contacts overlap.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Dispatch one pointer event of any type at an app pixel. */
async function fire(page, type, px, py, opts) {
    await page.evaluate(([type, px, py, opts]) => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const rect = doc.getElementById('main-canvas').getBoundingClientRect();
        const win = doc.defaultView;
        doc.body.dispatchEvent(new win.PointerEvent(type, Object.assign({
            isPrimary: true, bubbles: true, cancelable: true,
            clientX: rect.left + (px + 0.5) * rect.width / ZX_SPECTRUM.WIDTH,
            clientY: rect.top + (py + 0.5) * rect.height / ZX_SPECTRUM.HEIGHT
        }, opts)));
    }, [type, px, py, opts]);
}

const touchOpts = (id, pressure) => ({
    pointerId: id, pointerType: 'touch', pressure: pressure === undefined ? 0.5 : pressure,
    button: pressure === 0 ? 0 : 0, buttons: pressure === 0 ? 0 : 1
});

/** A whole touch press-and-lift at one point. */
async function touchTap(page, px, py, id = 20) {
    await fire(page, 'pointerdown', px, py, touchOpts(id));
    await fire(page, 'pointerup', px, py, touchOpts(id, 0));
}

/** A pen press that is left DOWN, so a touch can arrive during it. */
const penDown = (page, px, py) =>
    fire(page, 'pointerdown', px, py, { pointerId: 7, pointerType: 'pen', pressure: 0.5, button: 0, buttons: 1 });
const penMoveTo = (page, px, py) =>
    fire(page, 'pointermove', px, py, { pointerId: 7, pointerType: 'pen', pressure: 0.5, button: -1, buttons: 1 });
const penUp = (page, px, py) =>
    fire(page, 'pointerup', px, py, { pointerId: 7, pointerType: 'pen', pressure: 0, button: 0, buttons: 0 });

/** A mouse press that is left DOWN. */
const mouseDown = (page, px, py) =>
    fire(page, 'pointerdown', px, py, { pointerId: 1, pointerType: 'mouse', pressure: 0.5, button: 0, buttons: 1 });
const mouseUp = (page, px, py) =>
    fire(page, 'pointerup', px, py, { pointerId: 1, pointerType: 'mouse', pressure: 0, button: 0, buttons: 0 });

const isInk = (page, x, y) => page.evaluate(([px, py]) =>
    PixelDrawRoutine.getPixelState(px, py)?.isInk === true, [x, y]);

/** Set the three touch settings directly, as Preferences would. */
const settings = (page, s) => page.evaluate((s) => {
    if ('drawing' in s) InputHandler.setTouchDrawing(s.drawing);
    if ('block' in s) StateManager.set('touchBlockWhileContact', s.block);
    if ('lockout' in s) StateManager.set('touchLockoutMs', s.lockout);
}, s);

/** Boot with the lockout window off, so a test can isolate the other layers. */
async function bootBrush(page, s) {
    const log = await boot(page);
    await page.keyboard.press('b');
    await settings(page, Object.assign({ lockout: 0 }, s || {}));
    return log;
}

test('a finger draws when nothing is in the way', async ({ page }) => {
    await bootBrush(page);
    await touchTap(page, 40, 40);
    expect(await isInk(page, 40, 40)).toBe(true);
});

test('a touch during a pen contact leaves no mark', async ({ page }) => {
    await bootBrush(page);
    await penDown(page, 30, 30);
    await touchTap(page, 90, 90);
    await penUp(page, 30, 30);

    expect(await isInk(page, 90, 90)).toBe(false);
    expect(await isInk(page, 30, 30)).toBe(true);   // the pen's own mark stands
});

test('the pen stroke survives a touch landing mid-stroke', async ({ page }) => {
    // The regression that made this whole change necessary: the touch used to
    // overwrite currentPointerId, so the pen's later moves were dropped and the
    // rest of its stroke never appeared.
    await bootBrush(page);
    await penDown(page, 20, 60);
    await penMoveTo(page, 40, 60);
    await touchTap(page, 200, 150);          // palm lands mid-stroke
    await penMoveTo(page, 60, 60);           // pen carries on
    await penUp(page, 60, 60);

    expect(await isInk(page, 40, 60)).toBe(true);
    expect(await isInk(page, 60, 60)).toBe(true);   // the half after the palm
    expect(await isInk(page, 200, 150)).toBe(false);
});

test('a touch during a mouse drag leaves no mark', async ({ page }) => {
    // The mouse had NO protection at all before this change.
    await bootBrush(page);
    await mouseDown(page, 25, 25);
    await touchTap(page, 100, 100);
    await mouseUp(page, 25, 25);

    expect(await isInk(page, 100, 100)).toBe(false);
    expect(await isInk(page, 25, 25)).toBe(true);
});

test('switching the no-double-touch layer off readmits touch to the gesture path', async ({ page }) => {
    // What the setting controls, exactly. It cannot re-enable double-touch
    // DRAWING — one stroke at a time is a hard invariant, not a preference —
    // so what turning it off changes is that palm contacts are tracked again
    // and two of them can still pinch the canvas mid-stroke. That is the
    // behaviour anyone unticking it is choosing.
    await bootBrush(page, { block: false });
    await penDown(page, 30, 30);
    await fire(page, 'pointerdown', 90, 90, touchOpts(22));
    expect(await page.evaluate(() => InputHandler.touches.size)).toBe(1);
    expect(await isInk(page, 90, 90)).toBe(false);
    await fire(page, 'pointerup', 90, 90, touchOpts(22, 0));
    await penUp(page, 30, 30);

    // ...and with it on (the default) the contact is dropped before it is even
    // counted, which is what stops two palm contacts starting a pinch.
    await settings(page, { block: true });
    await penDown(page, 30, 30);
    await fire(page, 'pointerdown', 90, 90, touchOpts(23));
    expect(await page.evaluate(() => InputHandler.touches.size)).toBe(0);
    await penUp(page, 30, 30);
});

test('a touch inside the lockout window leaves no mark; outside it, it draws', async ({ page }) => {
    await bootBrush(page, { lockout: 500 });
    // A pen tap, then a finger while the window is still open.
    await penDown(page, 10, 10);
    await penUp(page, 10, 10);
    await touchTap(page, 120, 40);
    expect(await isInk(page, 120, 40)).toBe(false);

    // Once the window has passed, the same finger draws.
    await page.waitForTimeout(600);
    await touchTap(page, 120, 40);
    expect(await isInk(page, 120, 40)).toBe(true);
});

test('a HOVERING pen closes the window — the palm that lands before the tip', async ({ page }) => {
    // The case no backwards-looking guard catches unless hover counts: the hand
    // is resting before the tip ever touches down.
    await bootBrush(page, { lockout: 500 });
    await fire(page, 'pointermove', 15, 15,
        { pointerId: 7, pointerType: 'pen', pressure: 0, button: -1, buttons: 0 });
    await touchTap(page, 140, 60);
    expect(await isInk(page, 140, 60)).toBe(false);
});

test('a parked mouse cursor does NOT close the window', async ({ page }) => {
    // Counting a hovering mouse would silently disable touch drawing for as
    // long as the cursor sat over the canvas — a mode nobody chose.
    await bootBrush(page, { lockout: 500 });
    await fire(page, 'pointermove', 15, 15,
        { pointerId: 1, pointerType: 'mouse', pressure: 0, button: -1, buttons: 0 });
    await touchTap(page, 150, 70);
    expect(await isInk(page, 150, 70)).toBe(true);
});

test('the status-bar switch turns finger drawing off and back on', async ({ page }) => {
    await bootBrush(page);
    const toggle = page.locator('#touch-mode-status');

    await page.evaluate(() => TouchModeStatus._reveal());
    await expect(toggle).toContainText('draws');

    await toggle.click();
    await expect(toggle).toContainText('navigation only');
    await touchTap(page, 70, 70);
    expect(await isInk(page, 70, 70)).toBe(false);

    await toggle.click();
    await expect(toggle).toContainText('draws');
    await touchTap(page, 70, 70);
    expect(await isInk(page, 70, 70)).toBe(true);
});

test('with drawing off a finger pans instead, and the choice survives a reload', async ({ page }) => {
    await bootBrush(page, { drawing: false });

    // A drag with one finger: no mark, and it is routed to the pan path.
    await fire(page, 'pointerdown', 80, 80, touchOpts(21));
    expect(await page.evaluate(() => InputHandler._dragPanActive)).toBe(true);
    await fire(page, 'pointermove', 110, 110, touchOpts(21));
    await fire(page, 'pointerup', 110, 110, touchOpts(21, 0));
    expect(await isInk(page, 80, 80)).toBe(false);
    expect(await page.evaluate(() => InputHandler.getTouchDrawing())).toBe(false);

    // The switch persists under its own Storage key; wait for the write to land
    // rather than racing the reload against it.
    await expect.poll(() => page.evaluate(() => Storage.get('touchDrawing')))
        .toBe(false);
    await page.reload();
    await page.waitForSelector('html[data-app-ready]', { timeout: 15000 });
    expect(await page.evaluate(() => InputHandler.getTouchDrawing())).toBe(false);
});

test('two fingers still pinch-zoom with drawing switched off', async ({ page }) => {
    await bootBrush(page, { drawing: false });
    const zoomBefore = await page.evaluate(() => StateManager.getZoom());

    await fire(page, 'pointerdown', 100, 90, touchOpts(31));
    await fire(page, 'pointerdown', 110, 90, touchOpts(32));
    await fire(page, 'pointermove', 60, 90, touchOpts(31));
    await fire(page, 'pointermove', 200, 90, touchOpts(32));
    await fire(page, 'pointerup', 60, 90, touchOpts(31, 0));
    await fire(page, 'pointerup', 200, 90, touchOpts(32, 0));

    expect(await page.evaluate(() => StateManager.getZoom())).toBeGreaterThan(zoomBefore);
});

test('two palm contacts during a pen stroke do not hijack it into a pinch', async ({ page }) => {
    await bootBrush(page);
    const zoomBefore = await page.evaluate(() => StateManager.getZoom());

    await penDown(page, 20, 100);
    await penMoveTo(page, 40, 100);
    await fire(page, 'pointerdown', 150, 150, touchOpts(41));
    await fire(page, 'pointerdown', 170, 150, touchOpts(42));
    await fire(page, 'pointermove', 120, 150, touchOpts(41));
    await fire(page, 'pointermove', 210, 150, touchOpts(42));
    await fire(page, 'pointerup', 120, 150, touchOpts(41, 0));
    await fire(page, 'pointerup', 210, 150, touchOpts(42, 0));
    await penMoveTo(page, 60, 100);
    await penUp(page, 60, 100);

    expect(await page.evaluate(() => StateManager.getZoom())).toBe(zoomBefore);
    expect(await isInk(page, 60, 100)).toBe(true);
});

test('palm arbitration (pointercancel on touch) rolls the stroke back', async ({ page }) => {
    await bootBrush(page);
    await fire(page, 'pointerdown', 55, 55, touchOpts(51));
    await fire(page, 'pointermove', 75, 55, touchOpts(51));
    expect(await isInk(page, 55, 55)).toBe(true);   // it was drawing

    await fire(page, 'pointercancel', 75, 55, touchOpts(51, 0));
    expect(await isInk(page, 55, 55)).toBe(false);
    expect(await isInk(page, 75, 55)).toBe(false);
});

test('a cancelled touch does not eat the previous action', async ({ page }) => {
    // The trap in rolling a stroke back: a stroke that marked nothing leaves the
    // undo stack untouched, and a bare undo() there throws away the artist's
    // PREVIOUS action instead of the palm's.
    await bootBrush(page);
    await touchTap(page, 45, 45);                  // a real mark, kept
    expect(await isInk(page, 45, 45)).toBe(true);

    // A contact that is cancelled without ever moving or marking.
    await fire(page, 'pointerdown', 45, 45, touchOpts(52));
    await fire(page, 'pointercancel', 45, 45, touchOpts(52, 0));

    expect(await isInk(page, 45, 45)).toBe(true);
});

test('a revoked palm stroke is not redoable', async ({ page }) => {
    // Rolling back with a plain undo() would push the palm's marks onto the
    // redo stack: Redo lights up out of nowhere and Ctrl+Y re-applies exactly
    // what the platform just decided was never intentional.
    await bootBrush(page);
    await fire(page, 'pointerdown', 65, 65, touchOpts(53));
    await fire(page, 'pointercancel', 65, 65, touchOpts(53, 0));

    expect(await isInk(page, 65, 65)).toBe(false);
    expect(await page.evaluate(() => UndoRedo.canRedo())).toBe(false);
});

test('a revoked palm stroke rolls back with a full undo stack', async ({ page }) => {
    // The rollback used to test the stack DEPTH, which stops growing once
    // endAction starts pruning — so past the limit the palm's marks would have
    // stayed on the picture. Shrink the limit rather than drawing 500 strokes.
    await bootBrush(page);
    await page.evaluate(() => UndoRedo.setMaxStates(3));
    for (const x of [10, 12, 14, 16, 18]) await touchTap(page, x, 120);
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBe(3);

    await fire(page, 'pointerdown', 90, 120, touchOpts(54));
    await fire(page, 'pointercancel', 90, 120, touchOpts(54, 0));
    expect(await isInk(page, 90, 120)).toBe(false);
});

test('a stale stroke of the same kind is released rather than deadlocking the canvas', async ({ page }) => {
    // A stroke whose pointer vanishes without a lift (possible when
    // setPointerCapture fails, which _capturePointer tolerates) must not leave
    // the canvas undrawable: a mouse and a pen can each only have one contact,
    // so a fresh press of the same kind proves the held one is gone.
    await bootBrush(page);
    await penDown(page, 30, 140);
    await page.evaluate(() => { InputHandler.currentPointerId = 999; });  // pointer lost

    await penDown(page, 50, 140);
    await penUp(page, 50, 140);
    expect(await isInk(page, 50, 140)).toBe(true);
});

test('an attribute-paint drag is protected from touch like any other stroke', async ({ page }) => {
    // Attribute paint sets isDrawing itself, and used to leave the stroke's
    // pointerType null — so activeContact read null and layer 1 protected
    // nothing for the whole drag.
    await bootBrush(page);
    await page.evaluate(() => InputHandler.enterAttrPaintMode('apply'));
    await mouseDown(page, 40, 160);
    expect(await page.evaluate(() => InputHandler._touchState().activeContact)).toBe('mouse');

    // Two palm contacts must not end the attribute batch and pinch the canvas.
    const zoomBefore = await page.evaluate(() => StateManager.getZoom());
    await fire(page, 'pointerdown', 150, 160, touchOpts(61));
    await fire(page, 'pointerdown', 170, 160, touchOpts(62));
    expect(await page.evaluate(() => InputHandler.touches.size)).toBe(0);
    expect(await page.evaluate(() => StateManager.getZoom())).toBe(zoomBefore);
    await mouseUp(page, 40, 160);
    await page.evaluate(() => InputHandler.exitAttrPaintMode());
});

test('Preferences reflects and saves all three touch settings', async ({ page }) => {
    await bootBrush(page);
    await settings(page, { drawing: false, block: false, lockout: 1200 });

    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await expect(page.locator('#pref-touch-draw')).not.toBeChecked();
    await expect(page.locator('#pref-touch-no-double')).not.toBeChecked();
    await expect(page.locator('#pref-touch-lockout')).toHaveValue('1200');

    await page.check('#pref-touch-draw');
    await page.check('#pref-touch-no-double');
    await page.fill('#pref-touch-lockout', '250');
    await page.click('#dialog-preferences-dialog .panel-button.primary');

    expect(await page.evaluate(() => [
        InputHandler.getTouchDrawing(),
        StateManager.get('touchBlockWhileContact'),
        StateManager.get('touchLockoutMs')
    ])).toEqual([true, true, 250]);
});
