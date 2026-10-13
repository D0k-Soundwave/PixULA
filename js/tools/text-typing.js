'use strict';
(function() {

/**
 * TextTyping - one "Type on canvas" session of the Text tool (Batch 10B): the text typed so far, the caret, where on the
 * picture the first letter is, and everything needed to show it (an overlay, never a layer) and to draw it (one undo step).
 *
 * The keyboard itself belongs to the UI (js/ui/components/canvas-text-entry.js keeps a hidden text field focused and tells
 * the tool what it holds); this class never touches the DOM. It lays the text out with BitmapText, runs the Text tool's
 * effects over it (MaskOps.processLayers), and hands the result to the same write plan a stamp uses.
 */
class TextTyping {
    /** @param {Object} tool - the TextTool (supplies the font, size, spacing and effect options) */
    constructor(tool) {
        this.tool = tool;
        this.active = false;
        this.text = '';
        this.caret = 0;
        this.x = 0;      // picture pixel the first letter's top-left sits on
        this.y = 0;
        this._last = null;
    }

    /** Begin a session with the first letter at (x, y). */
    open(x, y) {
        this.active = true;
        this.text = '';
        this.caret = 0;
        this.x = x;
        this.y = y;
        this._last = null;
    }

    /** End the session without drawing anything. */
    close() {
        this.active = false;
        this.text = '';
        this.caret = 0;
        this._last = null;
    }

    /** Replace the buffer (the text field changed). */
    setBuffer(text, caret) {
        this.text = String(text);
        this.caret = Helpers.clamp(caret == null ? this.text.length : caret, 0, this.text.length);
    }

    /** Insert at the caret. */
    insert(str) {
        this.text = this.text.slice(0, this.caret) + str + this.text.slice(this.caret);
        this.caret += str.length;
    }

    /** Backspace. @returns {boolean} whether anything was deleted */
    backspace() {
        if (this.caret <= 0) return false;
        this.text = this.text.slice(0, this.caret - 1) + this.text.slice(this.caret);
        this.caret -= 1;
        return true;
    }

    /** Delete. @returns {boolean} */
    deleteForward() {
        if (this.caret >= this.text.length) return false;
        this.text = this.text.slice(0, this.caret) + this.text.slice(this.caret + 1);
        return true;
    }

    /** Move the whole text by (dx, dy) pixels (cursor keys while the text field is not focused). */
    nudge(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    /**
     * Lay the buffer out and work out what it draws.
     * @returns {{lay: ?Object, data: ?Object, caret: {x:number,y:number,w:number,h:number}, caretPixels: Array<{x:number,y:number}>}}
     *   data is the mask in the shape the stamp write plan takes (null when the text draws nothing)
     */
    build() {
        const tool = this.tool;
        const o = tool._typeLayoutOptions();
        const lay = BitmapText.layout(this.text, o);
        const eff = tool._effectOpts();
        const lc = BitmapText.lineCol(this.text, this.caret);
        const cr = BitmapText.caretRect(lay, lc.line, lc.col, o);

        // The block is placed so the first letter's top-left (raw pixel 0,0) lands on the click, whatever the mirror,
        // contour, shadow and Direction do to the box.
        const rawW = lay ? lay.width : Math.max(1, o.W), rawH = lay ? lay.height : Math.max(1, o.H);
        const origin = MaskOps.mapPoint(0, 0, rawW, rawH, eff);
        const ox = this.x - origin.x, oy = this.y - origin.y;

        let data = null;
        if (lay) {
            const L = MaskOps.processLayers(lay.pixels, eff);
            data = {
                mask: L.pixels, clearMask: L.clearMask, opts: tool._stampOpts(),
                x: ox, y: oy, w: L.pixels[0].length, h: L.pixels.length, colorSelection: null
            };
        }

        // the caret bar: its two ends carried through the same effects, then joined
        const a = MaskOps.mapPoint(cr.x, cr.y, rawW, rawH, eff);
        const b = MaskOps.mapPoint(cr.x, cr.y + cr.h - 1, rawW, rawH, eff);
        const pts = [];
        const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
        for (let i = 0; i <= steps; i++) {
            const px = Math.round(a.x + (b.x - a.x) * i / steps) + ox;
            const py = Math.round(a.y + (b.y - a.y) * i / steps) + oy;
            const thick = Math.max(1, cr.w);
            for (let k = 0; k < thick; k++) pts.push({ x: px + k, y: py });
        }
        this._last = { lay, data };
        return { lay, data, caret: cr, caretPixels: pts };
    }

    /**
     * The caret index a press at a picture point means, when the point is on the text; null when it is not (or when the text
     * is turned or mirrored, where this simple map does not hold).
     * @returns {?number}
     */
    slotAt(px, py) {
        if (!this.active) return null;
        const tool = this.tool;
        const eff = tool._effectOpts();
        if (eff.direction || eff.mirrorH || eff.mirrorV) return null;
        const o = tool._typeLayoutOptions();
        const b = this.build();
        if (!b.lay || !b.data) return null;
        if (px < b.data.x || py < b.data.y || px >= b.data.x + b.data.w || py >= b.data.y + b.data.h) return null;
        // back into the laid-out block: undo the contour padding and the shadow's glyph shift
        const org = MaskOps.mapPoint(0, 0, b.lay.width, b.lay.height, eff);
        const lx = px - b.data.x - org.x, ly = py - b.data.y - org.y;
        const line = Helpers.clamp(Math.floor(ly / b.lay.pitch), 0, b.lay.lines.length - 1);
        const l = b.lay.lines[line];
        let slot = Math.round((lx - l.x0) / b.lay.adv);
        slot = Helpers.clamp(slot, 0, l.before[l.before.length - 1]);
        // the column whose drawable-glyph count is slot (the first such column)
        let col = l.before.indexOf(slot);
        if (col < 0) col = l.text.length;
        return BitmapText.indexOf(this.text, line, col);
    }

    /** Show the text as the picture would be left, and the caret. */
    preview(caretVisible = true) {
        if (!this.active || !window.GridOverlay) return;
        const b = this.build();
        const layerIdx = LayerManager.activeDrawLayerIndex;
        const plan = b.data ? SelectionService.maskWritePlan(b.data) : [];
        GridOverlay.drawWritesPreview(plan, layerIdx);
        GridOverlay.drawCaret(caretVisible ? b.caretPixels : []);
    }

    /** Take the preview and the caret down. */
    clearPreview() {
        if (window.GridOverlay) { GridOverlay.clearCompositePreview(); GridOverlay.clearCursorOverlay(); }
    }

    /**
     * Draw the text into the active drawing layer as one undo step and end the session. If there is nowhere to draw (no
     * layer selected, locked) nothing changes and the session stays open.
     * @returns {boolean} false if it could not be drawn
     */
    commit() {
        if (!this.active) return true;
        const b = this.build();
        if (!b.data) { this.clearPreview(); this.close(); return true; }
        if (!SelectionService.bakeMask(b.data, 'Text')) return false;
        this.clearPreview();
        this.close();
        return true;
    }

    /** Throw the text away and end the session. */
    cancel() {
        this.clearPreview();
        this.close();
    }
}

window.TextTyping = TextTyping;

})();
