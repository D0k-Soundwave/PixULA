'use strict';
/**
 * Touch admission (TouchPolicy — pure resolution, no DOM).
 *
 * The three layers that decide whether a finger draws, navigates or is dropped,
 * and the one ordering rule that is easy to get backwards: IGNORE outranks
 * NAVIGATE, so a rejected palm does nothing at all rather than panning the
 * canvas out from under the stroke it landed during.
 *
 * This suite exists because until it was written NOTHING in the tree exercised
 * touch — the palm rows in tests/TESTLOG.md were hardware-only, so the guard
 * could regress silently between the rare occasions someone put a hand on a
 * screen.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/touch-policy.js');

const NOW = 1000000;

/** Defaults, overridable per case — every test states only what it is about. */
const state = (over) => Object.assign({
    touchDrawing: true,
    blockWhileContact: true,
    lockoutMs: 500,
    lastPreciseTime: 0,     // never
    now: NOW,
    activeContact: null
}, over || {});

// ── layer 3: the master switch ─────────────────────────────────────────────
check('with nothing else in the way, a finger draws',
    TouchPolicy.decide(state()) === 'draw');
check('switch off, a finger navigates instead of drawing',
    TouchPolicy.decide(state({ touchDrawing: false })) === 'navigate');
check('the switch does not care what the pen did long ago',
    TouchPolicy.decide(state({ lastPreciseTime: NOW - 60000 })) === 'draw');

// ── layer 1: no double touch ───────────────────────────────────────────────
check('a pen contact in flight drops the touch entirely',
    TouchPolicy.decide(state({ activeContact: 'pen' })) === 'ignore');
check('a mouse button down drops the touch entirely',
    TouchPolicy.decide(state({ activeContact: 'mouse' })) === 'ignore');
check('a touch stroke in flight is NOT a reason to reject (second finger = pinch)',
    TouchPolicy.decide(state({ activeContact: 'touch' })) === 'draw');
check('layer 1 can be switched off on its own',
    TouchPolicy.decide(state({ activeContact: 'pen', blockWhileContact: false,
                               lockoutMs: 0 })) === 'draw');

// ── layer 2: the lockout window ────────────────────────────────────────────
check('a touch inside the lockout window is dropped',
    TouchPolicy.decide(state({ lastPreciseTime: NOW - 200 })) === 'ignore');
check('a touch just outside the window draws',
    TouchPolicy.decide(state({ lastPreciseTime: NOW - 501 })) === 'draw');
check('the window boundary is exclusive: exactly lockoutMs later is allowed',
    TouchPolicy.decide(state({ lastPreciseTime: NOW - 500 })) === 'draw');
check('lockoutMs 0 disables the window entirely',
    TouchPolicy.decide(state({ lockoutMs: 0, lastPreciseTime: NOW })) === 'draw');
check('a longer window catches a palm the 500ms default would have missed',
    TouchPolicy.decide(state({ lockoutMs: 2000, lastPreciseTime: NOW - 1500 })) === 'ignore');

// ── ordering: IGNORE outranks NAVIGATE ─────────────────────────────────────
// A palm rejected by layer 1 or 2 must not fall through to "well, it can pan
// then" — panning mid-stroke cannot be undone, unlike a mark.
check('a pen contact beats the off switch: ignore, not navigate',
    TouchPolicy.decide(state({ touchDrawing: false, activeContact: 'pen' })) === 'ignore');
check('the lockout window beats the off switch: ignore, not navigate',
    TouchPolicy.decide(state({ touchDrawing: false,
                               lastPreciseTime: NOW - 100 })) === 'ignore');

// ── lockoutRemaining: the "why" behind a verdict ───────────────────────────
check('remaining is the unspent part of the window',
    TouchPolicy.lockoutRemaining(state({ lastPreciseTime: NOW - 200 })) === 300);
check('remaining is 0 once the window has passed',
    TouchPolicy.lockoutRemaining(state({ lastPreciseTime: NOW - 900 })) === 0);
check('remaining is 0 when the window is switched off',
    TouchPolicy.lockoutRemaining(state({ lockoutMs: 0, lastPreciseTime: NOW })) === 0);
// A clock that steps backwards must not open the gate: rejecting one finger is
// cheaper than accepting a palm stroke across the picture.
check('a backwards clock jump keeps the window shut',
    TouchPolicy.lockoutRemaining(state({ lastPreciseTime: NOW + 5000 })) === 500);

// ── normalizeLockout: a stored value outlives the build that wrote it ──────
check('a sane value passes through',
    TouchPolicy.normalizeLockout(750) === 750);
check('a string from a number input is parsed',
    TouchPolicy.normalizeLockout('250') === 250);
check('nonsense falls back to the default',
    TouchPolicy.normalizeLockout('abc') === TOUCH_DEFAULTS.lockoutMs);
check('undefined falls back to the default',
    TouchPolicy.normalizeLockout(undefined) === TOUCH_DEFAULTS.lockoutMs);
check('an over-range value is clamped to the field maximum',
    TouchPolicy.normalizeLockout(99999) === TOUCH_DEFAULTS.LOCKOUT_MAX_MS);
check('a negative value clamps to 0 (the window off), not to the default',
    TouchPolicy.normalizeLockout(-50) === 0);

// ── the defaults registry itself ───────────────────────────────────────────
check('touch draws out of the box (a tablet with no pen must just work)',
    TOUCH_DEFAULTS.drawing === true);
check('the no-double-touch layer is on out of the box',
    TOUCH_DEFAULTS.blockWhileContact === true);
check('the default window is the value the hardcoded palm guard used',
    TOUCH_DEFAULTS.lockoutMs === 500);

summary('touch-policy');
