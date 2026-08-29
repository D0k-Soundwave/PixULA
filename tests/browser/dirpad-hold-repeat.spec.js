'use strict';
/**
 * The Transform and Reference direction pads repeat while held.
 *
 * Both are pixel-at-a-time controls - shifting the picture, or sliding a
 * traced photo into register - so crossing any real distance used to mean
 * dozens of separate clicks. They now step once on press and keep stepping
 * after Helpers.REPEAT_DELAY, through the same Helpers.attachRepeatPress the
 * option-panel slider steppers use.
 *
 * The row that matters most is the undo one. Each shift is its own undo entry
 * when clicked, so an unbracketed hold would leave roughly one entry per
 * repeat - a two-second hold measured ~27 - and undoing it would mean 27
 * presses of Ctrl+Z, in a history that is capped and holds real edits. The
 * hold is one gesture and must be one entry.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Lay down a row of ink so a shift has something to move. */
const drawRow = (page) => page.evaluate(() => {
    for (let x = 5; x < 40; x++) {
        PixelDrawRoutine.draw(x, 20, { ink: 2, paper: 7, bright: false, flash: false },
                              DRAW_MODE.NORMAL);
    }
});

const undoDepth = (page) => page.evaluate(() => UndoRedo.undoStack.length);

const firstInkX = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) if (layer.getPixelState(x, 20)) return x;
    return -1;
});

// Both panels render the SAME dir-pad classes, so the Transform pad is
// addressed by the data attribute only its zones carry.
const TRANSFORM_PAD = 'button[data-tp-transform="shiftRight"]';
// The Reference pad has no data attribute of its own, so it is found by
// being the dir-pad that is NOT the Transform one.
const REFERENCE_PAD = '.dir-pad-zone-right:not([data-tp-transform])';

/** 2x2 PNG - enough to make the Reference panel consider an image loaded. */
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91' +
    'JpzAAAAF0lEQVQI12P8z8DAwMDAxMDAwMDAwAAADgEBAKl5FQAAAAAASUVORK5CYII=';

/**
 * Load a reference image and open the panel.
 *
 * Two separate gates, both of which leave the pad unreachable: the pad is
 * DISABLED until an image exists (a placement with nothing to place would do
 * nothing), and the Reference panel starts COLLAPSED, so its content is
 * display:none and has no layout box for a pointer to land on.
 */
const loadReference = async (page) => {
    await page.evaluate(async (url) => {
        ReferenceLayerService.loadImage(url);
        await new Promise((resolve) => {
            const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
        });
        ReferenceLayerService.setOffset(0, 0);
    }, TINY_PNG);

    await page.evaluate(() => {
        const toggle = document.querySelector('#reference-panel .panel-collapse');
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
    });
    await page.waitForSelector(REFERENCE_PAD, { state: 'visible' });
};

const refOffset = (page) => page.evaluate(() => ({
    x: ReferenceLayerService.offsetX,
    y: ReferenceLayerService.offsetY
}));

/**
 * Where inside a pad to aim for a given direction.
 *
 * All four zones are full-size overlapping buttons (`inset: 0`) separated
 * only by clip-path triangles, so every one of them has the SAME bounding
 * box and a plain centre-click always lands on whichever is last in the DOM.
 * Aiming into the triangle is both the only way to hit the intended zone and
 * a truer test, since it is what a pointer actually does.
 */
const AIM = {
    up:    { fx: 0.50, fy: 0.15 },
    down:  { fx: 0.50, fy: 0.85 },
    left:  { fx: 0.15, fy: 0.50 },
    right: { fx: 0.85, fy: 0.50 }
};

/**
 * Centre of `dir`'s triangle within the pad `padSelector` occupies.
 *
 * Scrolls it into view first: these gestures are driven with page.mouse
 * rather than locator.click(), because a click can only land on one point
 * and we need a press and a release separated by a real wait. page.mouse
 * takes viewport coordinates and does NOT scroll anything into view the way
 * locator.click() does, so without this the whole gesture lands on empty
 * space below the fold and the test fails looking like a broken feature.
 */
async function aimAt(page, padSelector, dir) {
    const zone = page.locator(padSelector).first();
    await zone.scrollIntoViewIfNeeded();
    const box = await zone.boundingBox();
    return { x: box.x + box.width * AIM[dir].fx, y: box.y + box.height * AIM[dir].fy };
}

/** Press inside a zone, hold for `ms`, release - a real pointer gesture. */
async function hold(page, padSelector, dir, ms) {
    const at = await aimAt(page, padSelector, dir);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
}

/** A single deliberate tap inside a zone. */
async function tap(page, padSelector, dir) {
    const at = await aimAt(page, padSelector, dir);
    await page.mouse.click(at.x, at.y);
}

test('the timings are one definition, shared by every repeating control', async ({ page }) => {
    await boot(page);
    const t = await page.evaluate(() => ({
        delay: Helpers.REPEAT_DELAY,
        interval: Helpers.REPEAT_INTERVAL,
        exposed: typeof Helpers.attachRepeatPress === 'function'
    }));
    expect(t.exposed).toBe(true);
    expect(t.delay).toBeGreaterThan(0);
    expect(t.interval).toBeGreaterThan(0);
    // A hold must not start repeating so fast that a deliberate single tap
    // becomes two steps.
    expect(t.delay).toBeGreaterThanOrEqual(250);
});

test('a tap on the shift pad moves exactly one step', async ({ page }) => {
    await boot(page);
    await drawRow(page);

    const before = await firstInkX(page);
    await tap(page, TRANSFORM_PAD, 'right');
    await page.waitForTimeout(50);

    expect(await firstInkX(page)).toBe(before + 1);
});

test('holding the shift pad keeps moving, and is ONE undo entry', async ({ page }) => {
    await boot(page);
    await drawRow(page);

    const startX = await firstInkX(page);
    const depthBefore = await undoDepth(page);

    await hold(page, TRANSFORM_PAD, 'right', 1200);
    await page.waitForTimeout(50);

    const movedX = await firstInkX(page);
    // It must have repeated, not just fired the initial press.
    expect(movedX - startX).toBeGreaterThan(2);

    // ...and the whole hold is one entry, not one per repeat.
    expect(await undoDepth(page) - depthBefore).toBe(1);

    // One Ctrl+Z puts the picture back exactly where it started.
    await page.evaluate(() => UndoRedo.undo());
    expect(await firstInkX(page)).toBe(startX);
});

test('a hold that moves nothing leaves no undo entry behind', async ({ page }) => {
    await boot(page);
    // No ink anywhere: shifting still has a work area, so this asserts the
    // bracket does not push an entry for a gesture the service refused.
    const depthBefore = await undoDepth(page);

    await page.evaluate(() => {
        // Force the refusal path the bracket exists to handle.
        const real = TransformService.shift.bind(TransformService);
        TransformService._realShift = real;
        TransformService.shift = () => false;
    });

    await hold(page, TRANSFORM_PAD, 'right', 900);
    await page.waitForTimeout(50);

    expect(await undoDepth(page)).toBe(depthBefore);

    await page.evaluate(() => { TransformService.shift = TransformService._realShift; });
});

test('flip and rotate do NOT repeat when held', async ({ page }) => {
    await boot(page);
    await drawRow(page);

    // flipH is its own inverse: if it repeated, a long hold would land on a
    // coin-toss of an orientation. Held here for well past the repeat delay.
    const before = await firstInkX(page);
    const flip = page.locator('button[data-tp-transform="flipH"]');
    if (await flip.count() === 0) test.skip(true, 'no flipH button in this build');

    const fbox = await flip.boundingBox();
    await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await page.waitForTimeout(50);
    const once = await firstInkX(page);

    // One flip only: flipping back must restore the original position.
    await page.click('button[data-tp-transform="flipH"]');
    await page.waitForTimeout(50);
    expect(await firstInkX(page)).toBe(before);
    expect(once).not.toBe(before);
});

test('the Reference pad nudges once on a tap and keeps going when held', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    const start = await refOffset(page);

    await tap(page, REFERENCE_PAD, 'right');
    await page.waitForTimeout(50);
    const afterTap = await refOffset(page);
    expect(afterTap.x).toBe(start.x + 1);
    expect(afterTap.y).toBe(start.y);

    await hold(page, REFERENCE_PAD, 'right', 1200);
    await page.waitForTimeout(50);
    const afterHold = await refOffset(page);

    // The hold must have repeated well past the single step a tap gives.
    expect(afterHold.x - afterTap.x).toBeGreaterThan(2);
    expect(afterHold.y).toBe(start.y);
});

test('the Reference pad moves the axis it points at, not another', async ({ page }) => {
    await boot(page);
    await loadReference(page);

    const start = await refOffset(page);
    await hold(page, REFERENCE_PAD, 'down', 900);
    await page.waitForTimeout(50);

    const after = await refOffset(page);
    expect(after.y).toBeGreaterThan(start.y);
    expect(after.x).toBe(start.x);
});
