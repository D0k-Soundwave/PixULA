'use strict';
(function() {

/**
 * UiFit - pure resolution of "what interface scale does this screen need".
 *
 * PixULA has ONE layout at every size (css/layout.css): tool rail | canvas |
 * panels. A small screen is handled by shrinking that same layout, not by
 * rearranging it, and the shrink is this function. The artist's Interface
 * Size choice is an upper bound, never overwritten: the scale actually applied
 * is the smaller of what they chose and what fits. AppSettings is the one
 * caller and the one writer of --ui-scale; this file measures nothing and
 * touches no DOM, so it is Node-tested in tests/ui-fit.test.js.
 *
 * Only a touch-PRIMARY device is fitted. A desktop window is left exactly as
 * the artist sized it, because a desktop that is short of room has a better
 * answer than a smaller interface - a bigger window.
 *
 * Two limits, in priority order:
 *
 * 1. **The picture** at 1x must fit the canvas frame beside the floating
 *    colour rail. That is the one thing drawing cannot do without.
 * 2. **The tool rail** must show every tool without scrolling.
 *
 * Neither may push the scale below FLOOR. Where the rail cannot fit above it
 * (a phone held sideways) the rail scrolls, as it already does on a desktop
 * 900px tall - a tool you scroll to beats a tool too small to hit.
 *
 * Every size passed in is in UNZOOMED CSS px (what the element measures at
 * --ui-scale 1). Zoomed regions scale linearly, so a caller divides a live
 * measurement by the scale in force when it was taken.
 */
const UiFit = {

    /**
     * The smallest scale fitting will ever choose: the rail's 54px icons
     * (--rail-icon-size) stay at least 44 CSS px, the WCAG 2.1 SC 2.5.5
     * target size [P: W3C WCAG 2.1 Recommendation, 2018-06-05].
     * 44 / 54 = 0.8148 [C], kept to the 0.815 that clears it.
     * @const
     */
    FLOOR: 0.815,

    /**
     * Scales are applied to this precision. Coarser than a live measurement's
     * rounding noise, so a re-measure of an unchanged screen lands on the same
     * value instead of re-emitting a scale change that moves nothing.
     * @const
     */
    STEP: 0.001,

    /**
     * @param {Object} s
     * @param {number}  s.userScale - the Interface Size the artist chose
     * @param {boolean} s.touchPrimary - (hover: none) and (pointer: coarse)
     * @param {number}  s.viewportW - layout viewport, CSS px
     * @param {number}  s.viewportH
     * @param {Object}  s.chrome - unzoomed sizes, CSS px:
     *        toolbarW, panelsW, colourRailW (columns that eat width);
     *        headerH, statusH, colourBarH, canvasControlsH (rows that eat
     *        the canvas column's height); padW, padH (the canvas viewport's
     *        own padding, which is NOT zoomed)
     * @param {number}  s.railContentH - the tool rail's full content height
     * @param {number}  s.modeW - active screen mode, pixels at 1x
     * @param {number}  s.modeH
     * @returns {number} the scale to apply
     */
    effectiveScale(s) {
        const user = UiFit._positive(s && s.userScale, 1);
        if (!s || !s.touchPrimary) return user;

        const limit = Math.min(UiFit.pictureLimit(s), UiFit.railLimit(s));
        const fitted = Math.max(UiFit.FLOOR, limit);
        // Never ABOVE the artist's own choice, even when they chose below
        // the floor - the floor bounds what fitting takes away, not what the
        // artist may ask for.
        return UiFit._snap(Math.min(user, fitted));
    },

    /**
     * Largest scale at which the active screen at 1x fits the canvas frame,
     * on both axes, beside the colour rail (which floats over the canvas
     * column rather than taking a track, so it is counted against the frame).
     * @param {Object} s - as effectiveScale()
     * @returns {number} Infinity when nothing eats space on either axis
     */
    pictureLimit(s) {
        const c = (s && s.chrome) || {};
        const across = UiFit._n(c.toolbarW) + UiFit._n(c.panelsW) + UiFit._n(c.colourRailW);
        const down = UiFit._n(c.headerH) + UiFit._n(c.statusH) +
            UiFit._n(c.colourBarH) + UiFit._n(c.canvasControlsH);
        const w = UiFit._limit(UiFit._n(s.viewportW) - UiFit._n(c.padW) - UiFit._n(s.modeW), across);
        const h = UiFit._limit(UiFit._n(s.viewportH) - UiFit._n(c.padH) - UiFit._n(s.modeH), down);
        return Math.min(w, h);
    },

    /**
     * Largest scale at which the whole tool rail shows without scrolling. The
     * rail runs from the header's bottom to the status bar's top, and both of
     * those rows AND the rail's content scale together:
     * H - (header + status) * s >= content * s.
     * @param {Object} s - as effectiveScale()
     * @returns {number}
     */
    railLimit(s) {
        const c = (s && s.chrome) || {};
        const perScale = UiFit._n(c.headerH) + UiFit._n(c.statusH) + UiFit._n(s.railContentH);
        return UiFit._limit(UiFit._n(s.viewportH), perScale);
    },

    /** room / perScale, with "nothing scales" meaning no limit. @private */
    _limit(room, perScale) {
        if (perScale <= 0) return Infinity;
        return Math.max(0, room) / perScale;
    },

    /** Round DOWN to STEP, so a snapped scale never exceeds the true limit. @private */
    _snap(scale) {
        const steps = Math.floor(scale / UiFit.STEP + 1e-9);
        // toFixed strips the float noise (0.838 * 1000 steps * 0.001 is not
        // exactly 0.838), which would otherwise land in --ui-scale verbatim.
        return Number((steps * UiFit.STEP).toFixed(6));
    },

    /** A finite non-negative number, else 0. @private */
    _n(value) {
        return Number.isFinite(value) && value > 0 ? value : 0;
    },

    /** A finite positive number, else the fallback. @private */
    _positive(value, fallback) {
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }
};

window.UiFit = UiFit;

})(); // End IIFE
