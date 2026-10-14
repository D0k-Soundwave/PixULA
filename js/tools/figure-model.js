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
        // Rotation in degrees, applied only when the figure is drawn: the stored points never pick up rounding, so
        // a turn of 360, four quarter turns, or 37 then 323 give back exactly the figure you started with.
        this.rotation = 0;
    }

    // ── Editing (Batch 7 part 7C) ─────────────────────────────────────────────

    /** The centre the figure turns round: the middle of the box round its stored points. May be a half pixel. */
    pivot() {
        if (this.points.length === 0) return { x: 0, y: 0 };
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        // a figure whose outline has corners that are not stored (the parallelogram) turns about the middle of ALL its corners
        const corners = (this.fillable && this.points.length >= 3) ? this.def.polygon(this.points) : this.points;
        for (const p of corners) {
            if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
        }
        return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }

    /** The points as drawn: the stored points turned by `rotation` round the pivot, rounded to pixels. */
    rotatedPoints() {
        const deg = ShapeGenerator.constructor.rotationDeg(this.rotation);
        if (deg === 0) return this.points;
        const c = this.pivot();
        const G = ShapeGenerator.constructor;
        return this.points.map(p => {
            const r = G._rotateXY(p.x, p.y, c.x, c.y, deg);
            return { x: G._snap(r.x), y: G._snap(r.y) };
        });
    }

    getRotation() { return ShapeGenerator.constructor.rotationDeg(this.rotation); }
    setRotation(deg) { this.rotation = ShapeGenerator.constructor.rotationDeg(deg); }

    /** Make the turn part of the points (before one of them is moved), so the figure looks the same and turns from 0. */
    bakeRotation() {
        if (ShapeGenerator.constructor.rotationDeg(this.rotation) === 0) { this.rotation = 0; return; }
        this.points = this.rotatedPoints().map(p => ({ x: p.x, y: p.y }));
        this.rotation = 0;
    }

    /** Where handle `i` is drawn (the stored point turned by the rotation). */
    handlePoint(i) {
        const pts = this.rotatedPoints();
        return pts[i] ? { x: pts[i].x, y: pts[i].y } : null;
    }

    /** Move handle `i` to `p` (a drawn position). A turned figure is baked first. */
    movePoint(i, p) {
        if (!this.points[i]) return false;
        this.bakeRotation();
        this.points[i] = { x: p.x, y: p.y };
        return true;
    }

    /** True when (x, y) is inside a closed figure (even when it is not filled). */
    containsPoint(x, y) {
        const poly = this.fillable && this.points.length >= 3 ? this.def.polygon(this.rotatedPoints()) : null;
        if (!poly) return false;
        for (const p of ShapeGenerator.fillPolygon(poly)) if (p.x === x && p.y === y) return true;
        return false;
    }

    /** The figure as drawn, ready for the editor: kind of tool it came from, for Clone. */
    get tool() { return 'figure'; }

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
        c.rotation = this.rotation;
        return c;
    }

    translate(dx, dy) {
        for (const p of this.points) { p.x += dx; p.y += dy; }
    }

    toJSON() {
        return { type: this.type, options: { ...this.options }, points: this.points.map(p => ({ ...p })), kinds: this.kinds.slice(),
            rotation: this.rotation };
    }

    /** The straight lines of the figure, as [[a, b], ...] with integer points. */
    segments() { return this.def.segments(this.rotatedPoints()); }

    /** The vertices to fill (closed types with at least 3 points), else null. */
    polygon() {
        return this.fillable && this.points.length >= 3 ? this.def.polygon(this.rotatedPoints()) : null;
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
        if (this.points.length === 1) { const p0 = this.rotatedPoints()[0]; add(p0.x, p0.y); }
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
            const onMap = new Map();
            for (const p of split.on) onMap.set(p.y * 100003 + p.x, p);
            outline = Array.from(onMap.values());
            gone = new Set(split.off.map(p => p.y * 100003 + p.x));
            for (const k of onMap.keys()) gone.delete(k);
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

/** The three stored points of a parallelogram and the fourth corner they imply: with A, B, C in order, D = A + C - B. */
function parallelogramCorners(p) {
    if (p.length < 3) return p;
    return [p[0], p[1], p[2], { x: p[0].x + p[2].x - p[1].x, y: p[0].y + p[2].y - p[1].y }];
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
    // Parallelogram (3 points): point 3 is the corner after point 2; the fourth corner is worked out, never stored
    'figure-parallelogram': Object.freeze({
        maxPoints: 3, closed: true, fillable: true,
        segments: (p) => chain(parallelogramCorners(p), true),
        polygon: (p) => parallelogramCorners(p)
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

/**
 * ShapeFigure - a Shape tool drawing that stays pending and editable ("Keep editable", Batch 7 part 7C). It has the
 * same editing surface as FigureModel (handles, move, turn, clone) but its two points are the shape's drag start and
 * drag end and it is rasterised by ShapeGenerator.generateShape exactly as the one-drag commit does.
 *
 * `gen` holds the generator's own options (filled, thickness, lineStyle, rotation in degrees, rounding as a fraction
 * and the per-shape values). Its displayed handles are the drag points as they really sit after the turn: a box shape
 * turns its corners round the centre the generator uses, a shape drawn from a centre and a drag point turns its drag
 * point round the start.
 */
class ShapeFigure extends FigureModel {
    constructor(shapeType, start, end, gen = {}) {
        super('figure-shape', { filled: !!gen.filled, thickness: gen.thickness || 1, lineStyle: gen.lineStyle });
        this.shapeType = shapeType;
        this.gen = { ...gen };
        this.points = [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
        this.kinds = ['v', 'v'];
        this.finished = true;
    }

    get def() { return FigureModel.TYPES['figure-shape']; }
    get tool() { return 'shape'; }
    isComplete() { return true; }
    addPoint() { return false; }
    extendRun() { return false; }
    removeLastPoint() { return false; }

    /** The generator's bounds for the stored drag points. @private */
    _bounds() {
        const [a, b] = this.points;
        return ShapeGenerator.constructor.isCenterAnchored(this.shapeType)
            ? ShapeGenerator.constructor.centerAnchoredBounds(a.x, a.y, b.x, b.y)
            : { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }

    /** The generator options with this figure's current line style, thickness, fill and rotation. @private */
    _options(over = {}) {
        return { ...this.gen, filled: this.options.filled, thickness: this.options.thickness,
            lineStyle: this.options.lineStyle, rotation: this.getRotation(), ...over };
    }

    getRotation() { return ShapeGenerator.constructor.rotationDeg(this.gen.rotation); }
    setRotation(deg) { this.gen.rotation = ShapeGenerator.constructor.rotationDeg(deg); }

    /** The centre the shape turns round, or null for a shape that does not turn. */
    pivot() {
        const p = ShapeGenerator.rotationPivot(this.shapeType, this._bounds(), this._options({ rotation: 0 }));
        return p || { x: this.points[0].x, y: this.points[0].y };
    }

    /** True when the shape has a rotation to turn (so the editor may offer its knob). */
    get turnable() {
        return ShapeGenerator.rotationPivot(this.shapeType, this._bounds(), this._options({ rotation: 0 })) !== null;
    }

    /** The drag points as drawn after the turn. */
    rotatedPoints() {
        const deg = this.getRotation();
        if (deg === 0 || !this.turnable) return this.points;
        const G = ShapeGenerator.constructor;
        const [a, b] = this.points;
        const turn = (p, c) => { const r = G._rotateXY(p.x, p.y, c.x, c.y, deg); return { x: G._snap(r.x), y: G._snap(r.y) }; };
        if (G.BOX_ROTATABLE.has(this.shapeType) && !G.isCenterAnchored(this.shapeType)) {
            const c = this.pivot();
            return [turn(a, c), turn(b, c)];
        }
        return [{ x: a.x, y: a.y }, turn(b, a)];
    }

    bakeRotation() { /* the turn is a property of the shape, not of its points */ }

    /** Move handle `i` to the drawn position `p`. */
    movePoint(i, p) {
        const G = ShapeGenerator.constructor;
        const deg = this.getRotation();
        const [a, b] = this.points;
        if (i === 0 && (G.isCenterAnchored(this.shapeType) || !G.BOX_ROTATABLE.has(this.shapeType))) {
            this.translate(p.x - a.x, p.y - a.y);
            return true;
        }
        if (deg === 0 || !this.turnable) {
            this.points[i] = { x: p.x, y: p.y };
            return true;
        }
        const back = (q, c) => { const r = G._rotateXY(q.x, q.y, c.x, c.y, -deg); return { x: G._snap(r.x), y: G._snap(r.y) }; };
        if (G.BOX_ROTATABLE.has(this.shapeType) && !G.isCenterAnchored(this.shapeType)) {
            // the other corner stays where it is drawn: the new centre is halfway between it and the pointer
            const shown = this.rotatedPoints();
            const fixed = shown[1 - i];
            const c = { x: (fixed.x + p.x) / 2, y: (fixed.y + p.y) / 2 };
            this.points[i] = back(p, c);
            this.points[1 - i] = back(fixed, c);
            return true;
        }
        this.points[1] = back(p, a);          // drag end turned back round the start
        return true;
    }

    translate(dx, dy) {
        for (const p of this.points) { p.x += dx; p.y += dy; }
    }

    containsPoint(x, y) {
        const px = ShapeGenerator.generateShape(this.shapeType, this._bounds(),
            this._options({ filled: true, thickness: 1, lineStyle: 'solid' }));
        for (const p of px) if (p.x === x && p.y === y) return true;
        return false;
    }

    rasterise() {
        const bounds = this._bounds();
        const pixels = ShapeGenerator.generateShape(this.shapeType, bounds, this._options());
        const centre = ShapeGenerator.generateShape(this.shapeType, bounds,
            this._options({ filled: false, thickness: 1, lineStyle: 'solid' }));
        return { centre, outline: pixels, fill: null, pixels };
    }

    segments() { return []; }
    polygon() { return null; }

    clone() {
        const c = new ShapeFigure(this.shapeType, this.points[0], this.points[1], this.gen);
        c.options = { ...this.options };
        return c;
    }

    toJSON() {
        return { type: this.type, shapeType: this.shapeType, points: this.points.map(p => ({ ...p })), gen: { ...this.gen },
            options: { ...this.options } };
    }

    /** Rebuild from toJSON(). */
    static fromJSON(j) {
        const f = new ShapeFigure(j.shapeType, j.points[0], j.points[1], j.gen || {});
        if (j.options) f.options = { ...f.options, ...j.options };
        return f;
    }
}

FigureModel.TYPES = Object.freeze({
    ...FigureModel.TYPES,
    'figure-shape': Object.freeze({ maxPoints: 2, closed: false, fillable: false, segments: () => [] })
});
window.ShapeFigure = ShapeFigure;

})();
