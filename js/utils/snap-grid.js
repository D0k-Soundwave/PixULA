'use strict';
(function() {

/**
 * SnapGrid - the step the pointer jumps in when Snap is on, and the blocks the Selection tool picks (Batch 9). Pure: it
 * reads the active screen mode and nothing else, so Node can test it.
 *
 * A snap STEP is one of four kinds:
 *   cell    the attribute cell of the mode (8x8, or 8x4 / 8x2 / 8x1 in the multicolor modes)
 *   block16 16 x 16 pixels (the size of a Bifrost / Nirvana tile)
 *   screen  one 256 x 192 screen, offered only on a canvas bigger than that (Layer 2 320 and 640)
 *   custom  the person's own x and y
 */
class SnapGridClass {
    constructor() {
        this.KINDS = Object.freeze(['cell', 'block16', 'screen', 'custom']);
        /** 16 x 16 [P, ZX Paintbrush 2.6.4 help, selector_16x16, read 2026-10-12: "matches Bifrost and Nirvana tiles"]. */
        this.BLOCK16 = 16;
        /** The custom step a fresh install starts with [A: any value would do; nothing rests on it]. */
        this.DEFAULT_CUSTOM = Object.freeze({ x: 24, y: 24 });
    }

    /** One Spectrum screen, from the mode table (never typed in). */
    screenSize() {
        const m = SCREEN_MODES.STANDARD_ULA;
        return { w: m.width, h: m.height };
    }

    /** Whether a whole Spectrum screen is smaller than the canvas, i.e. "Screen" means something. */
    screenFits() {
        const s = this.screenSize();
        return ZX_SPECTRUM.WIDTH > s.w && ZX_SPECTRUM.HEIGHT > s.h;
    }

    /** A step kind that is allowed here: Screen falls back to Cell where it does not fit; junk becomes Cell. */
    cleanKind(kind) {
        if (!this.KINDS.includes(kind)) return 'cell';
        if (kind === 'screen' && !this.screenFits()) return 'cell';
        return kind;
    }

    /** 1..size, whole numbers; junk becomes the default custom step. */
    _clampStep(v, size, fallback) {
        const n = Math.round(Number(v));
        return Number.isFinite(n) ? Helpers.clamp(n, 1, size) : fallback;
    }

    /**
     * The step in pixels for a kind, on the active canvas. A step is never bigger than the canvas.
     * @param {string} kind
     * @param {{x:number,y:number}} [custom]
     * @returns {{w:number,h:number}}
     */
    sizeOf(kind, custom) {
        const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
        const c = custom || this.DEFAULT_CUSTOM;
        switch (this.cleanKind(kind)) {
            case 'block16': return { w: Helpers.clamp(this.BLOCK16, 1, W), h: Helpers.clamp(this.BLOCK16, 1, H) };
            case 'screen': { const s = this.screenSize(); return { w: Helpers.clamp(s.w, 1, W), h: Helpers.clamp(s.h, 1, H) }; }
            case 'custom': return { w: this._clampStep(c.x, W, this.DEFAULT_CUSTOM.x), h: this._clampStep(c.y, H, this.DEFAULT_CUSTOM.y) };
            default: return { w: ZX_SPECTRUM.CELL_WIDTH, h: ZX_SPECTRUM.CELL_HEIGHT };
        }
    }

    /** The nearest multiple of `step` (halves round up), the rule Snap has always used. */
    snap(v, step) {
        return Math.round(v / step) * step;
    }

    /** The multiple of `step` at or below `v`. */
    floor(v, step) {
        return Math.floor(v / step) * step;
    }

    /**
     * The whole blocks a press and a drag cover. Blocks are `size` wide and tall and sit on a grid whose first block starts
     * at `origin`. The block under the press is always included; a drag adds every whole block toward the pointer.
     * Blocks that would cross the canvas edge are left out; if even the first does not fit it is pulled back inside.
     * @param {{x:number,y:number}} start - where the press landed
     * @param {{x:number,y:number}} end - where the pointer is now
     * @param {{w:number,h:number}} size
     * @param {{x:number,y:number}} [origin] - where the grid starts
     * @returns {{x:number,y:number,w:number,h:number}}
     */
    blockRect(start, end, size, origin) {
        const o = origin || { x: 0, y: 0 };
        const axis = (a, b, o1, s, limit) => {
            const i0 = Math.floor((a - o1) / s), i1 = Math.floor((b - o1) / s);
            const lo = i0 < i1 ? i0 : i1, hi = i0 < i1 ? i1 : i0;
            let x = o1 + lo * s;
            let n = hi - lo + 1;
            // blocks past the edge are dropped; the first block is pulled back inside
            while (n > 1 && x < 0) { x += s; n--; }
            while (n > 1 && x + n * s > limit) n--;
            if (x < 0) x = 0;
            if (x + n * s > limit) x = Helpers.clamp(limit - n * s, 0, limit);
            return { x, w: n * s };
        };
        const ax = axis(start.x, end.x, o.x, size.w, ZX_SPECTRUM.WIDTH);
        const ay = axis(start.y, end.y, o.y, size.h, ZX_SPECTRUM.HEIGHT);
        return { x: ax.x, y: ay.x, w: ax.w, h: ay.w };
    }

    /**
     * How far an arrow key moves a thing placed on the grid.
     * @param {{x:number,y:number}} step - the snap step (width, height as x, y)
     * @param {{snap:boolean, wholeCells:boolean, pref:number}} o
     *   snap: Snap is on; wholeCells: the thing carries its colours, so it only moves in whole cells; pref: the nudge distance
     * @returns {{x:number,y:number}}
     */
    nudgeStep(step, o) {
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        if (!o.snap) return o.wholeCells ? { x: cw, y: ch } : { x: o.pref, y: o.pref };
        if (!o.wholeCells) return { x: step.x, y: step.y };
        // whole cells: the step rounded to cells, at least one
        const cells = (v, c) => { const r = Math.round(v / c) * c; return r > c ? r : c; };
        return { x: cells(step.x, cw), y: cells(step.y, ch) };
    }
}

window.SnapGrid = new SnapGridClass();

})();
