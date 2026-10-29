'use strict';
(function() {

/**
 * FigureEditor - the pending figure and everything you can do to it before it is drawn (Batch 7 part 7C): the live
 * preview (the same write plan the commit uses), the point handles and the turn knob, dragging a point, moving the
 * figure, turning it, the cursor-key nudge, taking an edit back, and the commit. It holds no DOM and no tool state of
 * its own beyond the figure: FigureTool (point figures) and ShapeTool (a shape kept editable) each own one.
 *
 * Edits to a pending figure are NOT undo steps. Each finished drag or nudge pushes a copy of the figure as it was onto
 * `edits`; Ctrl+Z (ToolManager.undo -> tool.undoPending) pops them. The commit is one batch, so one undo step.
 *
 * FigureHistory (below) remembers the last figure that was drawn, for Edit > Clone Last Figure.
 */

/** Marker half-size on screen in CSS pixels (as the Bezier tool's). */
const EDITOR_HANDLE_SCREEN_RADIUS = 4;
/** Pointer-to-marker grab distance floor, in canvas pixels. */
const EDITOR_GRAB_RADIUS = 4;
/** How many edits are kept for taking back [A: far more than anyone makes before pressing Enter]. */
const EDITOR_MAX_EDITS = 64;

class FigureEditor {
    /**
     * @param {{colourCore: function(): string}} host - the tool's current Colour core setting
     */
    constructor(host) {
        this.host = host;
        this.model = null;
        this.erase = false;
        this.edits = [];
        this._drag = null;
    }

    get active() { return !!this.model; }

    open(model, erase = false) {
        this.model = model;
        this.erase = !!erase;
        this.edits = [];
        this._drag = null;
    }

    close() {
        this.model = null;
        this.edits = [];
        this._drag = null;
        this.erase = false;
    }

    // ── Sizes ─────────────────────────────────────────────────────────────────

    /** Marker radius in ZX pixels for the current zoom (screen size / scale, at least one pixel). */
    handleRadius() {
        const zoom = (window.StateManager && typeof StateManager.getZoom === 'function'
            ? StateManager.getZoom() : 0) || DEFAULT_ZOOM || 100;
        return Math.max(1, Math.round(EDITOR_HANDLE_SCREEN_RADIUS / (zoom / 100)));
    }

    /** Never smaller than what is drawn, or the person aims at the marker they see and misses it. */
    grabRadius() {
        return Math.max(EDITOR_GRAB_RADIUS, this.handleRadius() + 1);
    }

    // ── The write plan (the preview IS the commit) ────────────────────────────

    /** The pixels, colour core and erase flag for a figure. */
    plan(model = this.model) {
        const r = model.rasterise();
        let core = null;
        const size = ToolBase.colourCoreSize(this.host.colourCore());
        const t = model.options.thickness;
        const filled = model.tool === 'shape'
            ? ShapeGenerator.constructor.fillsInside(model.shapeType, model.options.filled)
            : !!model.options.filled && model.fillable && model.points.length >= 3;
        if (size && !filled && t > size && window.ColorManager && ColorManager.hasCellAttributes()) {
            core = ShapeGenerator.corePredicate(r.centre, size);
        }
        return { pixels: r.pixels, core, erase: this.erase };
    }

    /** Draw the figure as one undoable batch, remember it for Clone, and close. */
    commit(label) {
        const model = this.model;
        if (!model) return false;
        const plan = this.plan(model);
        const mode = PixelDrawRoutine.resolveUserMode(!plan.erase);
        const color = ColorManager.getCurrentSelection();
        PixelDrawRoutine.beginBatch(label || 'Figure');
        PixelDrawRoutine.withColourCore(plan.core, () => {
            for (const p of plan.pixels) PixelDrawRoutine.draw(p.x, p.y, color, mode);
        });
        PixelDrawRoutine.endBatch();
        FigureHistory.record({ tool: model.tool, model: model.clone(), erase: this.erase });
        this.close();
        return true;
    }

    // ── Preview ───────────────────────────────────────────────────────────────

    /**
     * The compositor preview of the figure (only the pixels the commit would write: mirror, drawing guide, locked
     * layer) and, unless `handles` is false, its point markers and turn knob.
     */
    render(model = this.model, handles = true) {
        if (!window.GridOverlay || !model) return;
        const plan = this.plan(model);
        const t = PixelDrawRoutine.strokeTargets(plan.pixels, plan.core);
        PixelDrawRoutine.withColourCore(t.isCore, () => {
            if (plan.erase) GridOverlay.drawCompositorPreview([], t.pixels);
            else GridOverlay.drawCompositorPreview(t.pixels, []);
        });
        if (handles) this.renderHandles();
    }

    /** The markers: anchors for pressed points, a control for the third point of a 3-point line figure, the knob. */
    handleList() {
        const m = this.model;
        const out = [];
        if (!m) return out;
        const radius = this.handleRadius();
        const shown = m.rotatedPoints();
        const active = this._drag;
        shown.forEach((p, i) => {
            const isShape = m.tool === 'shape';
            if (!isShape && m.kinds[i] !== 'v' && !(i === shown.length - 1 && m.kinds[i] === 'r')) return;
            const control = (m.type === FIGURE_TYPES.ORTHOGONAL || m.type === FIGURE_TYPES.PARALLEL) && i === 2;
            out.push({ x: p.x, y: p.y, radius, kind: control ? 'control' : 'anchor', index: i,
                active: !!(active && active.mode === 'point' && active.index === i) });
        });
        const knob = this.knob();
        if (knob) out.push({ x: knob.x, y: knob.y, radius, kind: 'rotate', index: -1,
            active: !!(active && active.mode === 'rotate') });
        return out;
    }

    /** Where the turn knob sits: above the top-centre of the drawn figure, or below it when that would be off the top. */
    knob() {
        const m = this.model;
        if (!m || m.turnable === false || (m.tool === 'figure' && m.points.length < 2)) return null;
        const px = m.rasterise().pixels;
        if (!px.length) return null;
        let top = Infinity, bottom = -Infinity;
        for (const p of px) { if (p.y < top) top = p.y; if (p.y > bottom) bottom = p.y; }
        const off = 3 * this.handleRadius() + 2;
        const c = m.pivot();
        const x = Math.round(c.x);
        const above = top - off;
        return { x, y: above >= 0 ? above : bottom + off };
    }

    renderHandles() {
        if (!window.GridOverlay || !this.model) return;
        const handles = this.handleList();
        const links = [];
        const knob = handles.find(h => h.kind === 'rotate');
        if (knob) {
            const c = this.model.pivot();
            links.push(...ShapeGenerator.generateShape('line', { x1: Math.round(c.x), y1: Math.round(c.y), x2: knob.x, y2: knob.y }));
        }
        GridOverlay.drawHandles(handles, links);
    }

    // ── Hit testing ───────────────────────────────────────────────────────────

    /**
     * What is under (x, y): a point handle, the turn knob, the body of the figure, or nothing.
     * @returns {?{mode: 'point'|'rotate'|'move', index?: number}}
     */
    hitTest(x, y) {
        const m = this.model;
        if (!m) return null;
        const grab = this.grabRadius();
        let best = null, bestD = Infinity;
        for (const h of this.handleList()) {
            if (h.kind === 'rotate') continue;
            const d = Math.max(Math.abs(h.x - x), Math.abs(h.y - y));
            if (d <= grab && d < bestD) { best = h; bestD = d; }
        }
        if (best) return { mode: 'point', index: best.index };
        const knob = this.knob();
        if (knob && Math.max(Math.abs(knob.x - x), Math.abs(knob.y - y)) <= grab) return { mode: 'rotate' };
        const near = this.handleRadius();
        for (const p of m.rasterise().pixels) {
            if (Math.abs(p.x - x) <= near && Math.abs(p.y - y) <= near) return { mode: 'move' };
        }
        if (m.containsPoint(x, y)) return { mode: 'move' };
        return null;
    }

    // ── Dragging ──────────────────────────────────────────────────────────────

    /** Start an edit from a hit. Nothing changes until the pointer moves. */
    begin(hit, x, y) {
        const m = this.model;
        const piv = m.pivot();
        this._drag = {
            mode: hit.mode, index: hit.index, last: { x, y }, moved: false, snapshot: m.clone(),
            // the pointer arrives on grid points: a shape kept short of them moves by them (ShapeFigure.moveGridPoint)
            grid: !!(window.StateManager && StateManager.getGridSnap()),
            startAngle: Math.atan2(y - piv.y, x - piv.x) * 180 / Math.PI, startRotation: m.getRotation()
        };
    }

    /** Continue the edit. @returns {boolean} whether the figure changed */
    drag(x, y) {
        const d = this._drag;
        const m = this.model;
        if (!d || !m) return false;
        if (x === d.last.x && y === d.last.y) return false;
        if (d.mode === 'point') {
            // Each move starts again from the figure as it was when the drag began, so the rounding of one move cannot
            // build on the last: on a turned box shape that walked the opposite corner away over a slow drag.
            const from = d.snapshot.clone();
            if (!(d.grid && from.moveGridPoint && from.moveGridPoint(d.index, { x, y }))) from.movePoint(d.index, { x, y });
            this.model = from;
        } else if (d.mode === 'move') {
            m.translate(x - d.last.x, y - d.last.y);
        } else if (d.mode === 'rotate') {
            const piv = m.pivot();
            const a = Math.atan2(y - piv.y, x - piv.x) * 180 / Math.PI;
            m.setRotation(d.startRotation + Math.round(a - d.startAngle));
        }
        d.last = { x, y };
        d.moved = true;
        return true;
    }

    /** Finish the edit; a drag that moved is remembered for Ctrl+Z. @returns {boolean} whether anything changed */
    end() {
        const d = this._drag;
        this._drag = null;
        if (!d || !d.moved) return false;
        this._pushEdit(d.snapshot);
        return true;
    }

    _pushEdit(snapshot) {
        this.edits.push(snapshot);
        if (this.edits.length > EDITOR_MAX_EDITS) this.edits.shift();
    }

    /** Move the whole figure by (dx, dy) as one edit (the cursor keys). */
    nudge(dx, dy) {
        if (!this.model) return false;
        this._pushEdit(this.model.clone());
        this.model.translate(dx, dy);
        return true;
    }

    /** Forget the edits (the figure went back to being drawn: a snapshot from before that is no longer one step back). */
    forgetEdits() {
        this.edits = [];
    }

    /** Take back the last edit. @returns {boolean} whether there was one */
    undoEdit() {
        if (!this.edits.length) return false;
        this.model = this.edits.pop();
        this._drag = null;
        return true;
    }
}

/**
 * The last figure that was drawn by the Figure tool, the Shape tool or the Bezier tool - what Edit > Clone Last Figure
 * reopens. Deliberately NOT part of the undo history: Ctrl+Z followed by Clone reopens the drawn figure for editing,
 * which is how a drawn figure is re-coloured or changed. Cleared when the document changes.
 */
const FigureHistory = {
    _last: null,

    /** @param {{tool: string, model?: Object, erase: boolean}} rec */
    record(rec) {
        this._last = rec;
        if (window.EventBus && EVENTS.FIGURE_HISTORY_CHANGED) EventBus.emit(EVENTS.FIGURE_HISTORY_CHANGED, { has: true });
    },

    last() { return this._last; },
    has() { return !!this._last; },

    clear() {
        const had = !!this._last;
        this._last = null;
        if (had && window.EventBus && EVENTS.FIGURE_HISTORY_CHANGED) EventBus.emit(EVENTS.FIGURE_HISTORY_CHANGED, { has: false });
    },

    /**
     * Edit > Clone Last Figure: commit whatever is pending (it becomes the last figure), then open a pending copy of
     * the last figure, in the current rail colours, in the tool that drew it.
     * @returns {boolean} whether a copy was opened
     */
    cloneLast() {
        const current = window.ToolManager ? ToolManager.getCurrentTool() : null;
        if (current && typeof current.commitPending === 'function') current.commitPending();
        const rec = this._last;
        if (!rec) {
            EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('figure.nothingToClone',
                'There is no figure to clone yet.') });
            return false;
        }
        const id = rec.tool === 'bezier' ? TOOLS.BEZIER : (rec.tool === 'shape' ? 'shape' : TOOLS.FIGURE);
        const tool = ToolManager.getTool(id);
        if (!tool || typeof tool.openFigure !== 'function') return false;
        tool.prepareClone(rec);
        ToolManager.selectTool(id);
        tool.openFigure(rec);
        return true;
    }
};

window.FigureEditor = FigureEditor;
window.FigureHistory = FigureHistory;

if (window.EventBus && window.EVENTS) {
    for (const name of ['FILE_NEW', 'FILE_OPEN', 'SCREEN_MODE_CHANGED']) {
        if (EVENTS[name]) EventBus.on(EVENTS[name], () => FigureHistory.clear());
    }
}

})();
