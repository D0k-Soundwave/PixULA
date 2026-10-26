/**
 * GridLines - which lines the custom (user-defined) grid draws. Pure: no DOM.
 * GridOverlay strokes what this returns.
 */
(function () {
'use strict';

const DEFAULT_STEP = 4;

/**
 * Closest the lines may be on screen. [C] The pixel grid shows from 400%, where
 * a one-pixel step is 4 CSS px apart; below that the lines merge into a solid
 * colour. The custom grid follows the same rule per direction.
 */
const MIN_GAP_CSS_PX = 4;

class GridLinesClass {
    /** Step 1..size, whole numbers; junk becomes the default. */
    clampStep(step, size) {
        const n = Math.round(Number(step));
        if (!Number.isFinite(n)) return DEFAULT_STEP;
        return Helpers.clamp(n, 1, size);
    }

    /** Inner line positions in pixels: step, 2 * step, ... below `size`. */
    positions(size, step) {
        const out = [];
        for (let p = step; p < size; p += step) out.push(p);
        return out;
    }

    /**
     * The lines to draw. A direction whose lines would be closer than
     * MIN_GAP_CSS_PX on screen (step * scale) is left out.
     * @param {number} width - picture width in pixels
     * @param {number} height
     * @param {number} stepX
     * @param {number} stepY
     * @param {number} [scale=Infinity] - CSS pixels per picture pixel
     * @returns {{xs: number[], ys: number[]}}
     */
    lines(width, height, stepX, stepY, scale = Infinity) {
        const sx = this.clampStep(stepX, width);
        const sy = this.clampStep(stepY, height);
        return {
            xs: sx * scale >= MIN_GAP_CSS_PX ? this.positions(width, sx) : [],
            ys: sy * scale >= MIN_GAP_CSS_PX ? this.positions(height, sy) : []
        };
    }
}

window.GridLines = new GridLinesClass();
GridLines.DEFAULT_STEP = DEFAULT_STEP;
GridLines.MIN_GAP_CSS_PX = MIN_GAP_CSS_PX;

})();
