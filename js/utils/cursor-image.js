'use strict';
(function() {

/**
 * CursorImage - pure planning for the hardware brush cursor: the tool's mark
 * handed to the operating system AS the pointer image, so it moves with the
 * pen with no app lag.
 *
 * The artist's rule (2026-09-16): the pointer IS the brush - its size, its
 * colour and its position - and one brush pixel is one canvas pixel at every
 * zoom. So a size-1 brush is a 1x1 square at 100%, 4x4 at 400%, 8x8 at 800%.
 *
 * This file decides only geometry and whether the browser will take the
 * image; GridOverlay renders it. Two limits come from Chrome itself, read in
 * its source on 2026-09-16 (P):
 *
 * - **Size.** `ui::Cursor::AreDimensionsValidForWeb` refuses an image wider
 *   or taller than `kMaximumCursorDIPSize` = 128 DIP (ui/base/cursor/
 *   cursor.cc). A size-32 brush at 400% is exactly 128.
 * - **Edges.** `EventHandler::SelectCursor` drops a custom cursor that is not
 *   fully inside the top-level visual viewport (blink core/input/
 *   event_handler.cc). The rect is scaled by the OS cursor accessibility size,
 *   which a page cannot read, so a Windows "larger pointer" setting can still
 *   drop an image this check accepted.
 *
 * Either refusal falls back to the app-drawn mark - exact, a refresh late -
 * never to a crosshair.
 *
 * **Grid alignment.** The hotspot is the pointer's offset inside the image,
 * recomputed on every move, so the image's pixel grid lands on the canvas
 * grid at each event. Between events the OS moves the image with the pen, so
 * while moving it can sit up to one refresh of travel off the grid; at rest
 * it covers exactly the pixels a click paints.
 */
const CursorImage = {
    /** P: Chromium ui/base/cursor/cursor.cc kMaximumCursorDIPSize, read 2026-09-16. */
    MAX_DIP: 128,

    /**
     * @param {Array<{x:number,y:number,colour:string}>} marks - picture pixels
     *   to paint in the image, each with its CSS colour
     * @param {number} scale - CSS px per picture pixel (CanvasSystem.getScale,
     *   device-snapped so scale * dpr is whole)
     * @param {number} dpr - device pixels per CSS px
     * @returns {Object|null} null for no marks; otherwise
     *   { fits, minX, minY, cols, rows, cellDev, devW, devH, wDip, hDip, key }
     */
    plan(marks, scale, dpr) {
        if (!marks || marks.length === 0 || !(scale > 0) || !(dpr > 0)) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < marks.length; i++) {
            const m = marks[i];
            if (m.x < minX) minX = m.x;
            if (m.x > maxX) maxX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.y > maxY) maxY = m.y;
        }
        const cols = maxX - minX + 1;
        const rows = maxY - minY + 1;
        const cellDev = Math.max(1, Math.round(scale * dpr));
        const devW = cols * cellDev;
        const devH = rows * cellDev;
        // Chrome sizes the image in DIP as its device size over the image-set
        // resolution, rounded up.
        const wDip = Math.ceil(devW / dpr);
        const hDip = Math.ceil(devH / dpr);
        const fits = wDip <= this.MAX_DIP && hDip <= this.MAX_DIP;

        // What the image looks like, independent of where it is: the key a
        // rendered image is cached under.
        let key = `${cellDev}|${dpr}|${cols}x${rows}`;
        for (let i = 0; i < marks.length; i++) {
            const m = marks[i];
            key += `|${m.x - minX},${m.y - minY},${m.colour}`;
        }
        return { fits, minX, minY, cols, rows, cellDev, devW, devH, wDip, hDip, key };
    },

    /**
     * The hotspot that puts the image's grid on the canvas grid: the pointer's
     * offset from the image's top-left corner, in DIP.
     * @param {Object} plan - from plan()
     * @param {number} fx - pointer position in picture pixels, fractional
     * @param {number} fy
     * @param {number} scale - CSS px per picture pixel
     * @returns {{x:number,y:number}|null} null when the pointer is outside the
     *   image (Chrome would ignore such a hotspot and use the corner)
     */
    hotspot(plan, fx, fy, scale) {
        const x = Math.floor((fx - plan.minX) * scale);
        const y = Math.floor((fy - plan.minY) * scale);
        if (x < 0 || y < 0 || x >= plan.wDip || y >= plan.hDip) return null;
        return { x, y };
    },

    /**
     * Would Chrome keep an image this size at this hotspot? Mirrors its
     * containment test: the whole image inside the top-level viewport.
     * @param {Object} plan
     * @param {{x:number,y:number}} hot
     * @param {number} topX - pointer position in top-level viewport CSS px
     * @param {number} topY
     * @param {number} viewW - top-level viewport size, scrollbars excluded
     * @param {number} viewH
     * @returns {boolean}
     */
    insideViewport(plan, hot, topX, topY, viewW, viewH) {
        const left = Math.floor(topX - hot.x);
        const top = Math.floor(topY - hot.y);
        return left >= 0 && top >= 0 &&
               left + plan.wDip <= viewW && top + plan.hDip <= viewH;
    },

    /**
     * The CSS cursor value. At a device pixel ratio other than 1 the image is
     * declared at that resolution, so one canvas pixel is drawn crisp rather
     * than stretched by the display scale.
     * @param {string} url - the rendered image
     * @param {number} dpr
     * @param {{x:number,y:number}} hot
     * @returns {string}
     */
    cssValue(url, dpr, hot) {
        const image = dpr === 1
            ? `url("${url}")`
            : `image-set(url("${url}") ${dpr}x)`;
        return `${image} ${hot.x} ${hot.y}, none`;
    }
};

window.CursorImage = CursorImage;

})(); // End IIFE
