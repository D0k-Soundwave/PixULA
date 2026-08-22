'use strict';
(function() {

/**
 * ColorBarFit — keeps the top colour bar's own icon size independent of
 * --ui-scale, dialling it EITHER way to make the best use of the room
 * available. Every other chrome region (#header, #toolbar, #panels,
 * #status-bar, #canvas-controls) scales 1:1 with the artist's chosen
 * interface size; this bar alone can dial its OWN zoom (--colorbar-scale,
 * multiplied into --ui-scale for #color-bar's zoom in css/layout.css) up or
 * down: shrink when the interface-size setting would otherwise push its
 * content past two rows (fragmenting further at high magnification), or grow
 * (2026-08-22) when a wide window leaves the bar's natural size with room to
 * spare, so that space becomes bigger icons rather than empty margin — a
 * single comfortably-fitting row is grown to fill it, and a bar that already
 * needs two rows at its natural size is grown to fill THOSE properly,
 * without either ever being pushed into a row it did not already need.
 *
 * The indexed Next palette (the 256-entry scrolling grid) is the documented
 * exception to "always wrap, never scroll" — it is a single element that
 * cannot wrap, so shrinking icons would not buy it a second row and only
 * makes it harder to use. It opts out entirely (--colorbar-scale stays 1).
 *
 * There is a combination no amount of shrinking here can fix: #color-bar
 * sits in the #app grid's middle (1fr) column, flanked by #toolbar and
 * #panels, whose tracks are calc(--toolbar-width * --ui-scale) and
 * calc(--panel-width * --ui-scale) - fixed, NOT reduced by
 * --colorbar-scale, because they are a different region entirely. At
 * (128 + 280) = 408px base width (css/variables.css), those two tracks
 * alone can reach a narrow window's full width at a high enough scale,
 * leaving #color-bar's own column at zero regardless of what happens
 * inside it - fixing that would mean shrinking the tool rail and side
 * panels too, well beyond this bar. THIS is why the interface-size
 * selector's presets stop at 200% (index.html; 85%-300% until
 * 2026-08-10): measured that day, every window width from 1024px up
 * reaches two rows at every preset up to 200%, and 250%/300% were the
 * only presets that could still land on the unfixable combination on an
 * ordinary laptop-width window - so the ceiling was lowered rather than
 * carrying a known-broken corner behind a selector option. A value
 * stored before that change is clamped to the new max on restore
 * (js/ui/components/app-settings.js).
 *
 * #color-bar's own grid-computed width is NOT trusted as the "how much
 * room do I have" answer, because it can be wrong: `zoom` on a grid item
 * and the browser's own automatic-minimum-size accounting for that item
 * have been seen (2026-08-12, a 2560x1440 display) to disagree with the
 * grid column's actual size, in a way this component's own layout reads
 * cannot tell apart from "there just is not enough room" - so it looked
 * indistinguishable from correct behaviour in every automated check, and
 * only ever reproduced on real hardware. #canvas-area shares the exact
 * same grid column (css/layout.css grid-template-areas) but carries no
 * zoom of its own, so it is a clean, second, independent reading of that
 * column's true width. _pinWidth() below forces #color-bar's own layout
 * width (in ITS zoomed frame, so divided by the current combined zoom
 * before writing it) to match #canvas-area's, every time --colorbar-scale
 * changes as well as every refit - so whatever the grid+zoom disagreement
 * was, this component now measures rows against the real number instead
 * of whatever its own zoomed self-report said.
 */
class ColorBarFitClass {
    constructor() {
        this.MAX_ROWS = 2;
        // The smallest scale worth trying - established by testing down to
        // an 800px-wide window at the interface-size selector's 200%
        // ceiling (tests/browser/shell.spec.js); nothing below it was ever
        // needed, so it is where the search below gives up rather than
        // shrinking icons to nothing.
        this.FLOOR = 0.15;
        // The largest scale worth growing to when there is room to spare
        // (2026-08-22) - A: not measured for this bar specifically, chosen to
        // match the interface-size selector's own 200% ceiling elsewhere in
        // the app (app-settings.js) rather than invent a second convention
        // for "how big is too big" for a scaled control.
        this.MAX_SCALE = 2;
        // How close the search gets to the true largest-scale-that-fits
        // before it stops refining, in scale units (so ~1% of the full
        // 0-1 range) - fine enough that nobody would see the difference
        // between this and an exact answer, coarse enough to stay a
        // handful of layout reads rather than dozens.
        this.PRECISION = 0.01;
        // Safety margin applied to whatever scale the search finds "just
        // fits" MAX_ROWS at - see _margined()'s own comment for why a
        // razor's-edge fit is not safe to use as-is.
        this.BASE_MARGIN = 0.02;
        this.DPR_MARGIN_FACTOR = 0.1;
        this._bar = null;
        this._canvasArea = null;
        this._scale = 1;
    }

    init() {
        this._bar = document.getElementById('color-bar');
        this._canvasArea = document.getElementById('canvas-area');
        if (!this._bar) {
            Logger.error('ColorBarFit', '#color-bar not found');
            return;
        }

        const refit = Helpers.debounce(() => this.refit(), 120);
        window.addEventListener('resize', refit);
        EventBus.on(EVENTS.UI_SCALE_CHANGED, refit);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, refit);
        // Captions/labels change width on a locale switch.
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, refit);
        // Chrome does not always repaint a window at the right DPI/zoom the
        // instant it is moved to a monitor with different display scaling,
        // or restored from being minimized - the stale layout this component
        // measured against boot has been seen to persist, visibly wrong,
        // until *something* forces a recompute (opening DevTools is the
        // common manual workaround). Regaining focus/visibility is the
        // moment that stale state is most likely to have just been fixed
        // (or introduced), so re-checking then costs nothing when nothing
        // changed and self-heals when something did.
        window.addEventListener('focus', refit);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refit();
        });

        this.refit();
        // One extra check shortly after boot: the very first refit() above
        // runs mid-init, potentially before the browser's first real paint
        // of this bar has settled at its true on-screen size - the same
        // "measured too early" class of issue as the DPI case above, just
        // arriving from the other end of the timeline.
        setTimeout(() => this.refit(), 300);
        Logger.info('ColorBarFit', 'Initialized');
    }

    /**
     * Recompute --colorbar-scale to make the best use of whatever room the
     * bar has, in whichever direction the natural (scale 1) size calls for:
     * SHRINK if that natural size already overflows past MAX_ROWS (the
     * original 2026-08-10 behaviour), or GROW if it does not, so a wide
     * window's slack space goes into bigger, more legible icons instead of
     * sitting unused beside a bar still rendered at its base size. Either
     * way the target is the row count the content ALREADY has at scale 1 -
     * growing never pushes it into a row it did not already need, which is
     * what keeps a comfortably-one-row window at one row instead of
     * ballooning icons until a second row becomes "worth it" too.
     *
     * Both directions binary-search rather than step a fixed ladder (1, 0.9,
     * 0.8, ... or 1, 1.1, 1.2, ...): row count does not change smoothly with
     * scale, it jumps at the point content stops fitting a row, and a coarse
     * ladder can step straight past the true edge to a much smaller (or,
     * growing, a much larger) value than the content actually allows -
     * found the shrinking way round, 2026-08-10.
     *
     * The edge itself turned out not to be safe to land on either (also
     * 2026-08-12): a scale measured as "just fits" in this component's OWN
     * reading can still wrap to one row more on the SAME machine, because
     * that reading and the browser's actual paint are two separate rounding
     * passes over the same fractional-DPR layout, and they do not always
     * agree to the pixel. _margined() steps back from the edge in whichever
     * direction it was approached, rather than trusting it exactly.
     */
    refit() {
        if (!this._bar) return;
        if (window.ZX_SPECTRUM && ZX_SPECTRUM.PIXEL_DEPTH > 1) {
            this._setScale(1);
            return;
        }

        this._setScale(1);
        const naturalRows = this._rowCount();

        if (naturalRows > this.MAX_ROWS) {
            this._shrinkToFit(this.MAX_ROWS);
        } else {
            this._growToFill(naturalRows);
        }
    }

    /**
     * Binary search DOWN from scale 1 for the largest scale that keeps the
     * bar within `targetRows` - used when even the natural (scale 1) size
     * already needs more rows than that. The floor is exempt from the
     * safety margin since it is already the smallest size this component
     * will use.
     * @private
     */
    _shrinkToFit(targetRows) {
        this._setScale(this.FLOOR);
        if (this._rowCount() > targetRows) return; // floor is the best available; leave it as-is

        // Invariant through the loop: lo fits (<= targetRows), hi does not.
        let lo = this.FLOOR, hi = 1;
        while (hi - lo > this.PRECISION) {
            const mid = (lo + hi) / 2;
            this._setScale(mid);
            if (this._rowCount() <= targetRows) lo = mid; else hi = mid;
        }
        this._setScale(this._margined(lo));
    }

    /**
     * Binary search UP from scale 1 for the largest scale that still fits
     * within `targetRows` - the row count the bar's content already needs at
     * scale 1, so growing fills whatever room is going spare without ever
     * spilling into an extra row it did not already have.
     * @private
     */
    _growToFill(targetRows) {
        this._setScale(this.MAX_SCALE);
        if (this._rowCount() <= targetRows) {
            this._setScale(this._margined(this.MAX_SCALE));
            return; // even the ceiling still fits at the natural row count
        }

        // Invariant through the loop: lo fits (<= targetRows), hi does not.
        let lo = 1, hi = this.MAX_SCALE;
        while (hi - lo > this.PRECISION) {
            const mid = (lo + hi) / 2;
            this._setScale(mid);
            if (this._rowCount() <= targetRows) lo = mid; else hi = mid;
        }
        this._setScale(this._margined(lo));
    }

    /**
     * Step back from a scale the search found to "just fit" - see the
     * comment on refit() for why the edge itself is not safe.
     * The margin grows with how far window.devicePixelRatio sits from a
     * clean integer: native display scaling (Windows "125%", "150%"...)
     * is exactly what produces a fractional DPR, and fractional DPR is
     * what forces the browser to round CSS-pixel layout to physical
     * pixels unevenly across many small elements (18 swatches, a dozen
     * icon buttons) - each one a few tenths of a physical pixel off
     * compounds into several real CSS pixels of difference by the far
     * edge of a row, which is what actually flips a razor's-edge wrap
     * decision between two runs of the identical page.
     * @private
     */
    _margined(scale) {
        const dpr = window.devicePixelRatio || 1;
        const fractional = Math.abs(dpr - Math.round(dpr));
        const margin = this.BASE_MARGIN + fractional * this.DPR_MARGIN_FACTOR;
        return Math.max(this.FLOOR, scale * (1 - margin));
    }

    /**
     * Force #color-bar's own OUTER (visual) width to match #canvas-area's -
     * see the class comment for why its own grid-computed width is not
     * trusted. Called from _setScale(), every time, not once per refit():
     * #color-bar's zoom is `--ui-scale * --colorbar-scale` (css/layout.css),
     * so --colorbar-scale is ALSO a multiplier on #color-bar's own box, not
     * just its content - pin the width once before the search loop starts
     * shrinking that second factor and the bar's outer edge would shrink
     * right along with its icons, when the whole point is for it to hold
     * still while only the content inside gets smaller. Dividing the target
     * outer width by the CURRENT combined zoom, every time either factor
     * changes, is what keeps the outer width constant through the search.
     *
     * Deliberately no "did the target change" cache: the whole point is to
     * correct #color-bar's own width regardless of how it drifted, and a
     * cache keyed on the target value cannot tell "nothing needs fixing"
     * apart from "the DOM disagrees with what I last wrote and I did not
     * notice" - which is exactly the kind of drift this exists to catch.
     *
     * #color-bar and #canvas-area are two items in the SAME grid column
     * (css/layout.css), and an explicit width on either one can contribute
     * to how wide the grid decides that shared column is - so a width
     * written onto #color-bar from a PREVIOUS call is cleared before this
     * one measures #canvas-area. Skipping that step turns this into
     * positive feedback: #color-bar's width grows the column, growing
     * #canvas-area, which this method then reads as the new target and
     * grows #color-bar again - caught 2026-08-12 when a corrupted width
     * "healed" to five figures instead of matching the canvas.
     * @private
     */
    _pinWidth() {
        if (!this._canvasArea) return;
        this._bar.style.width = '';
        const outerWidth = this._canvasArea.getBoundingClientRect().width;
        if (!(outerWidth > 0)) return;
        const uiScale = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--ui-scale')) || 1;
        this._bar.style.width = `${outerWidth / (uiScale * this._scale)}px`;
    }

    /** @private */
    _setScale(scale) {
        this._scale = scale;
        this._bar.style.setProperty('--colorbar-scale', String(scale));
        this._pinWidth();
    }

    /**
     * Distinct row count, by bucketing the top edge of every visible
     * control - the same technique used to pin this behaviour in
     * tests/browser/shell.spec.js. getBoundingClientRect() forces the
     * layout this needs to reflect the scale just set.
     * @private
     */
    _rowCount() {
        const tops = new Set();
        const els = this._bar.querySelectorAll('.color-swatch, button, select, .clut-bit');
        for (const el of els) {
            if (el.offsetParent === null) continue;
            tops.add(Math.round(el.getBoundingClientRect().top / 10));
        }
        return tops.size;
    }
}

window.ColorBarFit = new ColorBarFitClass();

Logger.debug('ColorBarFit', 'Colour bar auto-fit component loaded');

})(); // End IIFE
