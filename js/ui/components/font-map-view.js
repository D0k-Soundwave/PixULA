'use strict';
(function() {

/**
 * FontMapView - the Font Editor's all-characters map (Batch 10C2b).
 *
 * Every glyph of the working font laid out as ONE bitmap (FontMap), 16 across, so a stroke can run from one character into the next.
 * CellGridEditor cannot do this job (it repaints every pixel on every pointer move, ends a stroke when the pointer leaves, has no pointer
 * capture and no stroke hooks), so this is its own small surface:
 *   - painting goes straight into the bitmap and a scratch canvas; only the changed rectangle is pushed to the scratch canvas, and the
 *     visible canvas is redrawn once per animation frame;
 *   - a stroke ends on pointer up / cancel / lost capture and is committed ONCE: onCommit(touchedGlyphIndices, bitmap) - the host
 *     writes it back with a single FontService.replaceGlyphs, which is one change and so one undo step;
 *   - tools: brush, eraser, line, fill (stays inside the clicked character), shade (click a column of a character), move (drag to scroll,
 *     for fingers: the surface otherwise keeps every touch for drawing).
 * The host (FontEditorDialog) owns the font; this holds a copy of the picture and the zoom.
 */
class FontMapView {
    /**
     * @param {Object} opts
     * @param {function(number):void} opts.onSelect - a character was clicked (glyph index)
     * @param {function(Set<number>, Uint8Array):void} opts.onCommit - a stroke ended
     * @param {function(number, number):void} opts.onShade - shade tool click: (glyph index, 8-pixel column)
     * @param {function(number):{left:number,right:number}} opts.getShade
     * @param {function(number, number, number):?{ink:number[], paper:number[]}} [opts.getColours] - the RGB pair of a
     *   character's 8x8 block (glyph index, block column, block row), or null for the default (a coloured CHX character)
     * @param {function(number, number, number, boolean):void} [opts.onAttrs] - Attributes tool click: (glyph index, block
     *   column, block row, erase)
     */
    constructor(opts) {
        this._onSelect = opts.onSelect || (() => {});
        this._onCommit = opts.onCommit || (() => {});
        this._onShade = opts.onShade || (() => {});
        this._getShade = opts.getShade || (() => ({ left: 0, right: 0 }));
        this._getColours = opts.getColours || null;
        this._onAttrs = opts.onAttrs || (() => {});

        this._map = new Uint8Array(0);
        this._w = 0; this._h = 0; this._gw = 8; this._gh = 8; this._count = 0;
        this._zoom = 2;
        this._tool = 'brush';
        this._selected = -1;
        this._touched = new Set();
        this._drawing = false;
        this._last = null;
        this._lineStart = null;
        this._linePreview = null;
        this._pan = null;
        this._dirty = null;
        this._frame = 0;

        this.element = document.createElement('div');
        this.element.className = 'fe-map-viewport';
        this.element.tabIndex = 0;
        this.element.setAttribute('role', 'application');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'fe-map-canvas';
        this.element.appendChild(this.canvas);
        this._ctx = this.canvas.getContext('2d');
        this._scratch = null;
        this._img = null;
        this._hatch = null;

        this.canvas.addEventListener('pointerdown', e => this._down(e));
        this.canvas.addEventListener('pointermove', e => this._move(e));
        this.canvas.addEventListener('pointerup', e => this._up(e));
        this.canvas.addEventListener('pointercancel', e => this._up(e));
        this.canvas.addEventListener('lostpointercapture', e => this._up(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Load the font's glyphs (GlyphBits layout) and repaint. */
    setData(glyphs, gw, gh) {
        this._gw = gw; this._gh = gh; this._count = glyphs.length;
        const l = FontMap.layout(gw, gh, glyphs.length);
        this._w = l.width; this._h = l.height;
        this._map = FontMap.compose(glyphs, gw, gh);
        this._scratch = Helpers.createCanvas(this._w, this._h);
        this._img = this._scratch.getContext('2d').createImageData(this._w, this._h);
        this._paintAll();
        if (this._zoom > this.maxZoom()) this._zoom = this.maxZoom();
        this._sizeCanvas();
        this.redraw();
    }

    setTool(tool) {
        this._tool = tool;
        this._lineStart = null;
        this._linePreview = null;
        this.canvas.style.cursor = tool === 'move' ? 'grab' : (tool === 'shade' || tool === 'attrs') ? 'pointer' : 'crosshair';
        this._scheduleRedraw();
    }

    getTool() { return this._tool; }

    setSelected(index) {
        this._selected = index;
        this._scheduleRedraw();
    }

    /**
     * Largest whole-number zoom keeping the canvas to 2048 pixels a side. [M] 2026-10-13, Chromium on this machine: redrawing a 512 x 512
     * picture to a canvas of 1536 / 2048 / 3072 / 4096 pixels a side took 8.6 / 12.8 / 29.5 / 51.2 ms (median of 9, readback included, so
     * the work is finished); a frame is 16.7 ms [C: 1000 / 60], so 2048 is the largest that stays inside one.
     */
    maxZoom() {
        const side = Math.max(this._w, this._h, 1);
        const cap = Math.floor(2048 / side);
        return cap < 1 ? 1 : cap;
    }

    getZoom() { return this._zoom; }

    setZoom(z) {
        const next = Helpers.clamp(Math.round(z), 1, this.maxZoom());
        if (next === this._zoom) return false;
        this._zoom = next;
        this._sizeCanvas();
        this.redraw();
        return true;
    }

    zoomIn() { return this.setZoom(this._zoom + 1); }
    zoomOut() { return this.setZoom(this._zoom - 1); }

    /** The biggest whole zoom that shows the whole map in the viewport (at least 1). */
    fit() {
        const vw = this.element.clientWidth || this._w;
        const vh = this.element.clientHeight || this._h;
        const whole = Math.floor(Math.min(vw / this._w, vh / this._h));
        return this.setZoom(whole < 1 ? 1 : whole);
    }

    /** Scroll so the glyph is in view. */
    scrollToIndex(index) {
        if (index < 0 || index >= this._count) return;
        const r = FontMap.glyphRect(index, this._gw, this._gh);
        const z = this._zoom;
        const el = this.element;
        const x0 = r.x * z, y0 = r.y * z, x1 = (r.x + r.w) * z, y1 = (r.y + r.h) * z;
        if (x0 < el.scrollLeft) el.scrollLeft = x0;
        else if (x1 > el.scrollLeft + el.clientWidth) el.scrollLeft = x1 - el.clientWidth;
        if (y0 < el.scrollTop) el.scrollTop = y0;
        else if (y1 > el.scrollTop + el.clientHeight) el.scrollTop = y1 - el.clientHeight;
    }

    /** Pixels set in the glyph's cell of the map (for tests). */
    getBitmap() { return this._map; }

    // ── Painting ───────────────────────────────────────────────────────────

    _rgb(css, fallback) {
        const m = /^#([0-9a-f]{6})$/i.exec(css || '');
        if (!m) return fallback;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    _colours() {
        return { ink: this._rgb(ZX_PALETTE[0], [0, 0, 0]), paper: this._rgb(ZX_PALETTE[7], [215, 215, 215]) };
    }

    /**
     * The RGB a map pixel shows: its block's Ink or Paper for a coloured character, else the default pair.
     * @private
     */
    _rgbAt(x, y, on, def) {
        if (this._getColours) {
            const cell = FontMap.cellAt(x, y, this._gw, this._gh, this._count);
            const c = cell ? this._getColours(cell.index, cell.lx >> 3, cell.ly >> 3) : null;
            if (c) return on ? c.ink : c.paper;
        }
        return on ? def.ink : def.paper;
    }

    _paintAll() {
        const def = this._colours();
        const d = this._img.data;
        for (let i = 0; i < this._map.length; i++) {
            const c = this._rgbAt(i % this._w, Math.floor(i / this._w), this._map[i], def);
            d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
        }
        this._scratch.getContext('2d').putImageData(this._img, 0, 0);
        this._dirty = null;
    }

    /** Repaint from the host's colours (an attribute changed; the pixels did not). */
    repaint() {
        if (!this._scratch) return;
        this._paintAll();
        this._scheduleRedraw();
    }

    /** Set a pixel in the bitmap and the scratch image; remember the changed rectangle. @private */
    _put(x, y, v) {
        const i = FontMap.setPixel(this._map, x, y, v, this._gw, this._gh, this._count);
        if (i < 0) return;
        this._touched.add(i);
        const c = this._rgbAt(x, y, v, this._colours());
        const o = (y * this._w + x) * 4;
        const d = this._img.data;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
        const b = this._dirty;
        if (!b) this._dirty = { x0: x, y0: y, x1: x, y1: y };
        else { if (x < b.x0) b.x0 = x; if (y < b.y0) b.y0 = y; if (x > b.x1) b.x1 = x; if (y > b.y1) b.y1 = y; }
    }

    _flushDirty() {
        const b = this._dirty;
        if (!b) return;
        this._scratch.getContext('2d').putImageData(this._img, 0, 0, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
        this._dirty = null;
    }

    _sizeCanvas() {
        this.canvas.width = this._w * this._zoom;
        this.canvas.height = this._h * this._zoom;
        this.canvas.style.width = this.canvas.width + 'px';
        this.canvas.style.height = this.canvas.height + 'px';
    }

    _scheduleRedraw() {
        if (this._frame) return;
        this._frame = requestAnimationFrame(() => { this._frame = 0; this.redraw(); });
    }

    _hatchPattern() {
        if (this._hatch) return this._hatch;
        const c = Helpers.createCanvas(8, 8);
        const g = c.getContext('2d');
        g.fillStyle = 'rgba(110,110,110,0.55)';
        g.fillRect(0, 0, 8, 8);
        g.strokeStyle = 'rgba(40,40,40,0.6)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.moveTo(-4, 4); g.lineTo(4, -4); g.moveTo(4, 12); g.lineTo(12, 4); g.stroke();
        this._hatch = this._ctx.createPattern(c, 'repeat');
        return this._hatch;
    }

    redraw() {
        if (!this._scratch) return;
        this._flushDirty();
        const ctx = this._ctx;
        const z = this._zoom, gw = this._gw, gh = this._gh;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this._scratch, 0, 0, this._w * z, this._h * z);

        // pixel grid only when the pixels are big enough to read it
        if (z >= 8) {
            ctx.strokeStyle = 'rgba(128,128,128,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= this._w; x++) { ctx.moveTo(x * z + 0.5, 0); ctx.lineTo(x * z + 0.5, this._h * z); }
            for (let y = 0; y <= this._h; y++) { ctx.moveTo(0, y * z + 0.5); ctx.lineTo(this._w * z, y * z + 0.5); }
            ctx.stroke();
        }
        // 8-pixel column lines inside wide characters (what the shader works in)
        if (gw > 8) {
            ctx.strokeStyle = 'rgba(128,128,128,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let cx = 0; cx < 16; cx++) for (let k = 1; k < gw / 8; k++) {
                const x = (cx * gw + k * 8) * z + 0.5;
                ctx.moveTo(x, 0); ctx.lineTo(x, this._h * z);
            }
            ctx.stroke();
        }
        // character boundaries
        ctx.strokeStyle = 'rgba(100,100,100,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let cx = 0; cx <= 16; cx++) { const x = cx * gw * z + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, this._h * z); }
        const rows = Math.ceil(this._count / 16);
        for (let cy = 0; cy <= rows; cy++) { const y = cy * gh * z + 0.5; ctx.moveTo(0, y); ctx.lineTo(this._w * z, y); }
        ctx.stroke();

        // shading: hatch the columns that are not saved
        const cols = gw >> 3;
        if (cols >= 1) {
            ctx.fillStyle = this._hatchPattern();
            for (let i = 0; i < this._count; i++) {
                const sh = this._getShade(i);
                if (!sh.left && !sh.right) continue;
                const r = FontMap.glyphRect(i, gw, gh);
                if (sh.left) ctx.fillRect(r.x * z, r.y * z, sh.left * 8 * z, gh * z);
                if (sh.right) ctx.fillRect((r.x + (cols - sh.right) * 8) * z, r.y * z, sh.right * 8 * z, gh * z);
            }
        }

        // line preview
        if (this._linePreview) {
            const { x0, y0, x1, y1, value } = this._linePreview;
            ctx.fillStyle = value ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
            let x = x0, y = y0;
            const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;
            for (;;) {
                if (FontMap.cellAt(x, y, gw, gh, this._count)) ctx.fillRect(x * z, y * z, z, z);
                if (x === x1 && y === y1) break;
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
        }

        // selection
        if (this._selected >= 0 && this._selected < this._count) {
            const r = FontMap.glyphRect(this._selected, gw, gh);
            ctx.strokeStyle = ZX_PALETTE[9];
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x * z + 1, r.y * z + 1, r.w * z - 2, r.h * z - 2);
        }
    }

    // ── Pointer ────────────────────────────────────────────────────────────

    _pixel(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        return {
            x: Math.floor(((e.clientX - rect.left) * sx) / this._zoom),
            y: Math.floor(((e.clientY - rect.top) * sy) / this._zoom)
        };
    }

    _down(e) {
        e.preventDefault();
        if (!this._scratch) return;
        const p = this._pixel(e);
        const cell = FontMap.cellAt(p.x, p.y, this._gw, this._gh, this._count);
        if (cell) this._onSelect(cell.index);
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }

        if (this._tool === 'move') {
            this._pan = { x: e.clientX, y: e.clientY, left: this.element.scrollLeft, top: this.element.scrollTop };
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        if (!cell) return;
        if (this._tool === 'shade') {
            this._onShade(cell.index, cell.col8);
            return;
        }
        const erase = CellGridEditor.isEraseEvent(e);
        if (this._tool === 'attrs') {
            this._onAttrs(cell.index, cell.col8, cell.ly >> 3, erase);
            return;
        }
        if (this._tool === 'fill') {
            FontMap.fillInside(this._map, p.x, p.y, erase ? 0 : 1, this._gw, this._gh, this._count);
            this._paintAll();
            this._touched.add(cell.index);
            this._finish();
            return;
        }
        this._drawing = true;
        this._erase = erase || this._tool === 'eraser';
        if (this._tool === 'line') {
            this._lineStart = p;
            this._linePreview = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, value: !this._erase };
        } else {
            this._put(p.x, p.y, this._erase ? 0 : 1);
            this._last = p;
        }
        this._scheduleRedraw();
    }

    _move(e) {
        if (this._pan) {
            this.element.scrollLeft = this._pan.left - (e.clientX - this._pan.x);
            this.element.scrollTop = this._pan.top - (e.clientY - this._pan.y);
            return;
        }
        if (!this._drawing) return;
        const p = this._pixel(e);
        if (this._tool === 'line') {
            if (this._lineStart) this._linePreview = { x0: this._lineStart.x, y0: this._lineStart.y, x1: p.x, y1: p.y, value: !this._erase };
        } else if (this._last) {
            // join this sample to the last one so a fast stroke leaves no gaps
            FontMap.line(this._map, this._last.x, this._last.y, p.x, p.y, this._erase ? 0 : 1, this._gw, this._gh, this._count, this._touched);
            this._paintLineDirty(this._last, p);
            this._last = p;
        }
        this._scheduleRedraw();
    }

    /** After FontMap.line wrote into the bitmap, bring the scratch image up to date for that rectangle. @private */
    _paintLineDirty(a, b) {
        const cx = (v) => Helpers.clamp(v, 0, this._w - 1);
        const cy = (v) => Helpers.clamp(v, 0, this._h - 1);
        const x0 = cx(a.x < b.x ? a.x : b.x), x1 = cx(a.x > b.x ? a.x : b.x);
        const y0 = cy(a.y < b.y ? a.y : b.y), y1 = cy(a.y > b.y ? a.y : b.y);
        const def = this._colours();
        const d = this._img.data;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const c = this._rgbAt(x, y, this._map[y * this._w + x], def);
                const o = (y * this._w + x) * 4;
                d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
            }
        }
        const bb = this._dirty;
        if (!bb) this._dirty = { x0, y0, x1, y1 };
        else { bb.x0 = Math.min(bb.x0, x0); bb.y0 = Math.min(bb.y0, y0); bb.x1 = Math.max(bb.x1, x1); bb.y1 = Math.max(bb.y1, y1); }
    }

    _up(e) {
        if (this._pan) {
            this._pan = null;
            this.canvas.style.cursor = 'grab';
            return;
        }
        if (!this._drawing) return;
        this._drawing = false;
        if (this._tool === 'line' && this._lineStart) {
            const p = this._pixel(e);
            FontMap.line(this._map, this._lineStart.x, this._lineStart.y, p.x, p.y, this._erase ? 0 : 1, this._gw, this._gh, this._count, this._touched);
            this._lineStart = null;
            this._linePreview = null;
            this._paintAll();
        }
        this._last = null;
        this._finish();
    }

    /** End of a stroke: hand the touched characters to the host once. @private */
    _finish() {
        const touched = this._touched;
        this._touched = new Set();
        this._flushDirty();
        this._scheduleRedraw();
        if (touched.size) this._onCommit(touched, this._map);
    }
}

window.FontMapView = FontMapView;

})();
