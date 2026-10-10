'use strict';
(function() {

/**
 * FigureModel - the pure geometry of the Figure tool's point-based figures (no DOM, no drawing).
 *
 * A figure is a list of points and a type that says how they become lines:
 *   polyline    a line from each point to the next (freehand runs are just many close points)
 *   polygon     the same plus a closing line; filled per the fill option
 *   triangle    a polygon that is complete at 3 points
 *   rays        a line from the first point to each later one
 *   orthogonal  A, B, C: line A-B, then a line from the foot F of the perpendicular from C to the
 *               (infinite) line A-B, to C. A-B is never lengthened
 *   parallel    A, B, C: line A-B, then a copy of it with C at its middle: from P = C - round(d/2)
 *               to P + d, where d = B - A (an exact copy moved over)
 *
 * It reuses the existing code for the pixels - the Bresenham line (ToolBase.forEachLinePoint), the
 * disc thickening and the scanline polygon fill (ShapeGenerator) - so a figure's pixels are the
 * pixels the shapes would draw. `TYPES` is the extension point: part 7C adds the box shapes there.
 * `kinds[]` records which points were pressed ('v') and which were samples of a freehand run ('r'),
 * so Backspace removes a whole run at a time and the point handles can skip the samples.
 */
class FigureModel {

    /**
     * @param {string} type - one of FIGURE_TYPES
     * @param {{filled: boolean, thickness: number}} [options]
     */
    constructor(type, options = {}) {
        this.type = type;
        this.options = { filled: !!options.filled, thickness: Math.max(1, options.thickness | 0 || 1),
            lineStyle: ShapeGenerator.constructor.cleanLineStyle(options.lineStyle) };
        this.points = [];
        this.kinds = [];
        this.finished = false;
    }

    get def() { return FigureModel.TYPES[this.type]; }
    get closed() { return !!this.def.closed; }
    get maxPoints() { return this.def.maxPoints; }
    get fillable() { return !!this.def.fillable; }

    /** True when the figure has all the points its type takes (the fixed-size types). */
    isComplete() { return this.points.length >= this.maxPoints; }

    /**
     * Add a pressed point. Refused when the figure is finished or full; a repeat of the last point
     * is dropped (a double click, or a click that did not move).
     * @returns {boolean} whether a point was added
     */
    addPoint(p) {
        if (this.finished || this.isComplete()) return false;
        const last = this.points[this.points.length - 1];
        if (last && last.x === p.x && last.y === p.y) return false;
        this.points.push({ x: p.x, y: p.y });
        this.kinds.push('v');
        return true;
    }

    /** Add one sample of a freehand run (open-ended types only). */
    extendRun(p) {
        if (this.finished || this.isComplete()) return false;
        const last = this.points[this.points.length - 1];
        if (!last || (last.x === p.x && last.y === p.y)) return false;
        this.points.push({ x: p.x, y: p.y });
        this.kinds.push('r');
        return true;
    }

    /** Add a whole freehand run (each sample joined to the one before by a straight segment). */
    addFreehandRun(points) {
        for (const p of points) this.extendRun(p);
    }

    /**
     * Backspace: a trailing run goes as a whole (back to the point it started from), otherwise one
     * pressed point. Reopens a finished figure.
     * @returns {boolean} whether anything was removed
     */
    removeLastPoint() {
        if (this.points.length === 0) return false;
        this.finished = false;
        if (this.kinds[this.kinds.length - 1] === 'r') {
            while (this.kinds.length && this.kinds[this.kinds.length - 1] === 'r') {
                this.points.pop();
                this.kinds.pop();
            }
        } else {
            this.points.pop();
            this.kinds.pop();
        }
        return true;
    }

    finish() { this.finished = true; }

    /** A copy with `p` added - the hover preview of the next point. */
    withPoint(p) {
        const c = this.clone();
        c.finished = false;
        c.addPoint(p);
        return c;
    }

    clone() {
        const c = new FigureModel(this.type, this.options);
        c.points = this.points.map(p => ({ x: p.x, y: p.y }));
        c.kinds = this.kinds.slice();
        c.finished = this.finished;
        return c;
    }

    translate(dx, dy) {
        for (const p of this.points) { p.x += dx; p.y += dy; }
    }

    toJSON() {
        return { type: this.type, options: { ...this.options }, points: this.points.map(p => ({ ...p })), kinds: this.kinds.slice() };
    }

    /** The straight lines of the figure, as [[a, b], ...] with integer points. */
    segments() { return this.def.segments(this.points); }

    /** The vertices to fill (closed types with at least 3 points), else null. */
    polygon() {
        return this.fillable && this.points.length >= 3 ? this.def.polygon(this.points) : null;
    }

    /**
     * The pixels of the figure.
     * @returns {{centre: Array, outline: Array, fill: ?Array, pixels: Array}}
     *   centre = the 1-pixel lines; outline = those thickened; fill = interior plus lines (or null);
     *   pixels = what is drawn (fill when filled, else outline). No pixel appears twice, so XOR
     *   toggles each one once.
     */
    rasterise() {
        const centre = [];
        const seen = new Set();
        const add = (x, y) => {
            const k = y * 100003 + x;
            if (seen.has(k)) return;
            seen.add(k);
            centre.push({ x, y });
        };
        if (this.points.length === 1) add(this.points[0].x, this.points[0].y);
        // The lines as ordered runs for a line style: a new run starts when a line does not begin where the last
        // one ended (rays and the two-line figures), so the pattern starts afresh there.
        const runs = [];
        let cur = null, lastEnd = null;
        for (const [a, b] of this.segments()) {
            ToolBase.forEachLinePoint(a.x, a.y, b.x, b.y, add);
            if (!cur || !lastEnd || lastEnd.x !== a.x || lastEnd.y !== a.y) { cur = []; runs.push(cur); }
            ToolBase.forEachLinePoint(a.x, a.y, b.x, b.y, (x, y) => {
                const l = cur[cur.length - 1];
                if (!l || l.x !== x || l.y !== y) cur.push({ x, y });
            });
            lastEnd = b;
        }
        const t = this.options.thickness;
        const poly = this.options.filled ? this.polygon() : null;
        const style = this.options.lineStyle;
        let outline = t > 1 ? ShapeGenerator.thicken(centre, t) : centre;
        // Line style: dashes are drawn on a one-pixel line only (a filled figure counts as one); clear draws no outline.
        let gone = null;      // pixels a styled outline leaves out of a fill
        if (style === 'clear') {
            outline = [];
            gone = new Set(centre.map(p => p.y * 100003 + p.x));
        } else if (style !== 'solid' && (t === 1 || poly)) {
            const split = ShapeGenerator.applyLineStyle(runs, style);
            const onKeys = new Set(split.on.map(p => p.y * 100003 + p.x));
            outline = Array.from(onKeys).map(k => ({ x: k % 100003, y: Math.floor(k / 100003) }));
            gone = new Set(split.off.map(p => p.y * 100003 + p.x));
            for (const k of onKeys) gone.delete(k);
        }
        let fill = null;
        if (poly) {
            const merged = new Map();
            for (const p of ShapeGenerator.fillPolygon(poly)) merged.set(p.y * 100003 + p.x, p);
            // the scanline alone misses the bottom row of each edge: the lines complete it
            for (const p of centre) merged.set(p.y * 100003 + p.x, p);
            if (gone) for (const k of gone) merged.delete(k);
            fill = Array.from(merged.values());
        }
        return { centre, outline, fill, pixels: fill || outline };
    }

    /** One-call form for tests and previews. */
    static rasterise(type, points, options) {
        const m = new FigureModel(type, options);
        for (const p of points) m.addPoint(p);
        return m.rasterise();
    }
}

/** Lines from consecutive points; with `close`, back to the first as well. */
function chain(points, close) {
    const out = [];
    for (let i = 0; i + 1 < points.length; i++) out.push([points[i], points[i + 1]]);
    if (close && points.length > 2) out.push([points[points.length - 1], points[0]]);
    return out;
}

FigureModel.TYPES = Object.freeze({
    'figure-polyline': Object.freeze({
        maxPoints: Infinity, closed: false, fillable: false,
        segments: (p) => chain(p, false)
    }),
    'figure-polygon': Object.freeze({
        maxPoints: Infinity, closed: true, fillable: true,
        segments: (p) => chain(p, true),
        polygon: (p) => p
    }),
    'figure-triangle': Object.freeze({
        maxPoints: 3, closed: true, fillable: true,
        segments: (p) => chain(p, true),
        polygon: (p) => p
    }),
    'figure-rays': Object.freeze({
        maxPoints: Infinity, closed: false, fillable: false,
        segments: (p) => p.slice(1).map(q => [p[0], q])
    }),
    'figure-orthogonal': Object.freeze({
        maxPoints: 3, closed: false, fillable: false,
        segments: (p) => {
            if (p.length < 3) return chain(p, false);
            const [a, b, c] = p;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy;
            const t = len2 === 0 ? 0 : ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2;
            const foot = { x: Math.round(a.x + t * dx), y: Math.round(a.y + t * dy) };
            return [[a, b], [foot, c]];
        }
    }),
    'figure-parallel': Object.freeze({
        maxPoints: 3, closed: false, fillable: false,
        segments: (p) => {
            if (p.length < 3) return chain(p, false);
            const [a, b, c] = p;
            const dx = b.x - a.x, dy = b.y - a.y;
            const start = { x: c.x - Math.round(dx / 2), y: c.y - Math.round(dy / 2) };
            return [[a, b], [start, { x: start.x + dx, y: start.y + dy }]];
        }
    })
});

window.FigureModel = FigureModel;

})();
