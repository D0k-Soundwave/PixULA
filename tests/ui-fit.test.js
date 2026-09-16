'use strict';
/**
 * Interface scale-to-fit (UiFit - pure resolution, no DOM).
 *
 * PixULA keeps ONE layout at every size; a small touch screen gets the same
 * layout shrunk until it fits. These checks pin the rules that decide how far:
 * a desktop is never touched, the artist's Interface Size is a ceiling, the
 * picture outranks the tool rail, and nothing goes below the 44px touch floor.
 *
 * The chrome sizes below are the ones measured on 2026-09-15 (Playwright,
 * installed Chrome, touch emulation): tokens 128/280/148/40/24 from
 * css/variables.css, colour bar 78 and canvas controls 53 as rendered, canvas
 * viewport padding 16 per side, tool rail content 852.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/ui-fit.js');

const CHROME = {
    toolbarW: 128, panelsW: 280, colourRailW: 148,
    headerH: 40, statusH: 24, colourBarH: 78, canvasControlsH: 53,
    padW: 32, padH: 32
};

/** A touch tablet showing the standard 256x192 screen, at 100% chosen. */
const screen = (over) => Object.assign({
    userScale: 1,
    touchPrimary: true,
    viewportW: 1024,
    viewportH: 768,
    chrome: CHROME,
    railContentH: 852,
    modeW: 256,
    modeH: 192
}, over || {});

const near = (a, b) => Math.abs(a - b) < 1e-9;

// -- desktop is never fitted ---------------------------------------------------
check('a desktop keeps exactly the Interface Size the artist chose',
    UiFit.effectiveScale(screen({ touchPrimary: false, userScale: 1.25, viewportH: 400 })) === 1.25);
check('a desktop at 100% on a short window stays at 100%',
    UiFit.effectiveScale(screen({ touchPrimary: false, viewportW: 800, viewportH: 500 })) === 1);

// -- the worked examples from the plan -------------------------------------------
// 1024x768: rail limit 768 / (40 + 24 + 852) = 0.8384 [C]; the picture has room.
check('1024x768 tablet: shrinks to 0.838 so all 22 tools show',
    near(UiFit.effectiveScale(screen()), 0.838));
check('1180x820 tablet: 820 / 916 = 0.895',
    near(UiFit.effectiveScale(screen({ viewportW: 1180, viewportH: 820 })), 0.895));
check('1280x800 tablet: 800 / 916 = 0.873',
    near(UiFit.effectiveScale(screen({ viewportW: 1280, viewportH: 800 })), 0.873));
// 844x390: the rail would need 0.426, below the floor, so the floor holds and
// the rail scrolls; the picture's own limit (390-32-192)/195 = 0.851 is met.
check('844x390 phone: the floor holds and the rail scrolls',
    near(UiFit.effectiveScale(screen({ viewportW: 844, viewportH: 390 })), UiFit.FLOOR));
check('844x390 phone: the picture still fits at the floor',
    UiFit.pictureLimit(screen({ viewportW: 844, viewportH: 390 })) >= UiFit.FLOOR);

// -- the artist's choice is a ceiling -------------------------------------------
check('a roomy tablet stays at the 100% the artist chose, not larger',
    UiFit.effectiveScale(screen({ viewportW: 1600, viewportH: 1200 })) === 1);
check('a roomy tablet stays at the 85% the artist chose',
    near(UiFit.effectiveScale(screen({ userScale: 0.85, viewportW: 1600, viewportH: 1200 })), 0.85));
check('a 200% choice on a 1024x768 tablet still comes down to what fits',
    near(UiFit.effectiveScale(screen({ userScale: 2 })), 0.838));
check('a choice below the floor is honoured, not raised to it',
    UiFit.effectiveScale(screen({ userScale: 0.5 })) === 0.5);

// -- the floor -------------------------------------------------------------------
check('the floor keeps 54px rail icons at 44px or more',
    54 * UiFit.FLOOR >= 44);
check('a tiny screen never drops below the floor',
    near(UiFit.effectiveScale(screen({ viewportW: 400, viewportH: 300 })), UiFit.FLOOR));

// -- the picture outranks the rail -----------------------------------------------
// LAYER2_640 on a 1200x2000 screen: rail has room for 2.18, the picture only
// (1200 - 32 - 640) / 556 = 0.9496 [C].
check('a wide Next screen: the picture decides when it is the tighter limit',
    near(UiFit.effectiveScale(screen({ viewportW: 1200, viewportH: 2000, modeW: 640, modeH: 256 })), 0.949));
check('a wide Next screen on 1024x768: its 1x picture cannot fit, the floor holds',
    near(UiFit.effectiveScale(screen({ modeW: 640, modeH: 256 })), UiFit.FLOOR));

// -- rounding and bad input --------------------------------------------------------
check('a snapped scale never exceeds the true limit',
    UiFit.effectiveScale(screen()) <= UiFit.railLimit(screen()));
check('the result carries no float noise into --ui-scale',
    String(UiFit.effectiveScale(screen())) === '0.838');
check('missing chrome sizes do not produce NaN',
    Number.isFinite(UiFit.effectiveScale(screen({ chrome: {} }))));
check('no state at all falls back to 100%',
    UiFit.effectiveScale() === 1);
check('a garbage user scale falls back to 100% on desktop',
    UiFit.effectiveScale(screen({ touchPrimary: false, userScale: NaN })) === 1);

summary('ui-fit');
