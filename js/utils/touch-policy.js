'use strict';
(function() {

/**
 * TouchPolicy — pure resolution of "should this finger draw, navigate, or be
 * ignored entirely".
 *
 * Sits between a touch pointerdown and everything the input handler does with
 * it, so the decision can be reasoned about (and Node-tested in
 * tests/touch-policy.test.js) without a touchscreen, a pen or a DOM. The whole
 * of it is one function; the value is that it is one function in one place
 * rather than three conditions scattered down _onPointerDown.
 *
 * Three layers, independent, none of them a latch:
 *
 * 1. **No double touch** (`blockWhileContact`). While a pen tip or a mouse
 *    button is actually down, a touch is not a second input device — it is the
 *    hand holding the first one. Dropped.
 * 2. **The lockout window** (`lockoutMs`). A palm usually lands slightly before
 *    or after the pen, not during, so the block extends either side of the
 *    contact by a span the artist sets. Pen HOVER counts as pen activity: a pen
 *    approaching the glass is the best warning available that a palm is about
 *    to arrive. A mouse counts only while it is dragging, or a parked cursor
 *    would disable touch for as long as it sat there.
 * 3. **The drawing switch** (`touchDrawing`). Off means one finger pans, two
 *    pinch and long-press opens the menu — touch keeps every navigation job and
 *    loses only the ability to leave a mark.
 *
 * **`ignore` outranks `navigate`, and that ordering is the design.** It would
 * be easy to treat a rejected palm as "not drawing, therefore panning", but a
 * palm that scrolls the canvas out from under a stroke in progress is at least
 * as destructive as one that draws on it, and unlike a mark it cannot be
 * undone. A rejected contact does nothing at all.
 */
const TouchPolicy = {

    /** The three verdicts. @const */
    DRAW: 'draw',
    NAVIGATE: 'navigate',
    IGNORE: 'ignore',

    /**
     * @param {Object} state
     * @param {boolean} state.touchDrawing - the master switch (status bar)
     * @param {boolean} state.blockWhileContact - layer 1
     * @param {number}  state.lockoutMs - layer 2 span; 0 disables it
     * @param {number}  state.lastPreciseTime - ms timestamp of the last pen
     *        event or mouse drag sample; 0 when there has never been one
     * @param {number}  state.now - ms timestamp of the touch being judged
     * @param {string|null} state.activeContact - pointerType of the stroke
     *        already in flight ('pen' | 'mouse' | 'touch'), or null
     * @returns {string} DRAW | NAVIGATE | IGNORE
     */
    decide(state) {
        const s = state || {};

        // 1. A pen or mouse contact is down: this finger is part of the hand.
        //    A touch stroke already in flight is NOT a reason to reject — that
        //    is the second-finger gesture, which the caller handles itself.
        if (s.blockWhileContact !== false &&
            (s.activeContact === 'pen' || s.activeContact === 'mouse')) {
            return TouchPolicy.IGNORE;
        }

        // 2. Inside the lockout window. lastPreciseTime 0 means "never", which
        //    must not read as "at the epoch, which is a long time ago" on a
        //    clock that could be anything — but it does, and that is correct:
        //    now - 0 is enormous, so the window is open. Stated so nobody
        //    "fixes" it into a special case.
        if (TouchPolicy.lockoutRemaining(s) > 0) return TouchPolicy.IGNORE;

        // 3. The master switch. Touch keeps pan, pinch and long-press.
        if (s.touchDrawing === false) return TouchPolicy.NAVIGATE;

        return TouchPolicy.DRAW;
    },

    /**
     * Milliseconds left on the lockout window, 0 when it is not in force.
     * Split out because it is the honest answer to "why was that ignored" and
     * a test that asserts a boundary wants the number, not the verdict.
     * @param {Object} state - as decide()
     * @returns {number}
     */
    lockoutRemaining(state) {
        const s = state || {};
        const span = Number.isFinite(s.lockoutMs) ? s.lockoutMs : 0;
        if (span <= 0) return 0;
        const now = Number.isFinite(s.now) ? s.now : 0;
        const last = Number.isFinite(s.lastPreciseTime) ? s.lastPreciseTime : 0;
        const elapsed = now - last;
        // A clock that jumped backwards leaves a negative elapsed. Treat it as
        // inside the window: erring towards rejecting one finger beats erring
        // towards a palm stroke across the picture.
        if (elapsed >= span) return 0;
        return span - Math.max(elapsed, 0);
    },

    /**
     * Clamp a stored/typed lockout span to the range the Preferences field
     * offers. A preference outlives the build that wrote it, so the value is
     * re-validated on the way in rather than trusted.
     * @param {*} value
     * @returns {number}
     */
    normalizeLockout(value) {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return TOUCH_DEFAULTS.lockoutMs;
        return Helpers.clamp(n, 0, TOUCH_DEFAULTS.LOCKOUT_MAX_MS);
    }
};

window.TouchPolicy = TouchPolicy;

})(); // End IIFE
