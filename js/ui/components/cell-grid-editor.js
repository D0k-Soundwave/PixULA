'use strict';
(function() {

/**
 * CellGridEditor — the shared magnified 1-bit pixel-grid editing surface.
 *
 * Factored out of the Pattern Creator (Phase 11) so every "draw into a
 * tiny bitmap" feature uses one editing component instead of three
 * hand-rolled canvases. Consumers: PatternCreatorPanel (8/16/32 patterns),
 * MapEditorDialog (tile editing); the Phase 10 Sinclair font editor is the
 * planned third consumer (4×8/6×8/8×8 glyphs — width ≠ height is
 * supported for exactly that reason).
 *
 * Multi-instance class (NOT a singleton): each host owns an instance and
 * adopts `element` (a <canvas>) into its own DOM. Mini-tools: brush,
 * eraser, line (rubber-band preview), fill. Left button paints ink,
 * right button paints paper, exactly like the original Pattern Creator
 * surface. Hosts learn about edits via the onChange callback — this is
 * host-internal UI state, not an app-wide fact, so nothing is emitted on
 * the bus.
 *
 * Indexed mode (Phase 13, the sprite editor): pass `indexed: true` plus
 * `getColor(value)` / `getDrawValue()` / `getEraseValue()` and the surface
 * edits palette INDICES instead of 0/1 bits — left button paints the
 * current index, right button / eraser paint the erase (transparency)
 * value, every cell renders through getColor. The bitmap stays a
 * Uint8Array (indices 0–255); 1-bit consumers are untouched.
 */
class CellGridEditor {
    /**
     * @param {Object} opts
     * @param {number} opts.width  - bitmap width in pixels
     * @param {number} opts.height - bitmap height in pixels
     * @param {number} [opts.canvasWidth=256]  - on-screen canvas width
     * @param {number} [opts.canvasHeight=256] - on-screen canvas height
     * @param {Function} [opts.getInk]   - () => CSS colour for set bits
     * @param {Function} [opts.getPaper] - () => CSS colour for clear bits
     * @param {Function} [opts.onChange] - called after any committed edit
     * @param {string} [opts.className]  - class for the canvas element
     */
    constructor(opts) {
        this._w = opts.width;
        this._h = opts.height;
        this._canvasW = opts.canvasWidth || 256;
        this._canvasH = opts.canvasHeight || 256;
        this._getInk = opts.getInk || (() => ZX_PALETTE[0]);
        this._getPaper = opts.getPaper || (() => ZX_PALETTE[7]);
        this._onChange = opts.onChange || null;
        // Indexed mode (Phase 13): values are palette indices
        this._indexed = !!opts.indexed;
        this._getColor = opts.getColor || null;
        this._getDrawValue = opts.getDrawValue || (() => 1);
        this._getEraseValue = opts.getEraseValue || (() => 0);

        this._pixels = new Uint8Array(this._w * this._h);
        this._tool = 'brush';
        this._isDrawing = false;
        this._lineStart = null;

        this.element = document.createElement('canvas');
        this.element.width = this._canvasW;
        this.element.height = this._canvasH;
        if (opts.className) this.element.className = opts.className;
        this._ctx = this.element.getContext('2d');

        this._attachEvents();
        this.redraw();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Active mini-tool: 'brush' | 'eraser' | 'line' | 'fill'. */
    setTool(tool) {
        this._tool = tool;
        this._lineStart = null;
    }

    getTool() { return this._tool; }

    /**
     * Resize the bitmap (contents reset to paper). The optional canvas
     * dimensions let hosts with variable aspect ratios (the font editor's
     * 4×8/6×8/8×8 glyphs) keep the on-screen pixel size square.
     */
    setSize(width, height, canvasWidth, canvasHeight) {
        this._w = width;
        this._h = height;
        if (canvasWidth) {
            this._canvasW = canvasWidth;
            this.element.width = canvasWidth;
        }
        if (canvasHeight) {
            this._canvasH = canvasHeight;
            this.element.height = canvasHeight;
        }
        this._pixels = new Uint8Array(width * height);
        this._lineStart = null;
        this.redraw();
    }

    getSize() { return { width: this._w, height: this._h }; }

    /** Replace the bitmap contents (copied; length must match the size). */
    setPixels(pixels) {
        if (!pixels || pixels.length !== this._w * this._h) return;
        this._pixels = Uint8Array.from(pixels);
        this.redraw();
    }

    /** The live bitmap (Uint8Array of 0/1). Treat as read-only. */
    getPixels() { return this._pixels; }

    clear() {
        this._pixels.fill(0);
        this.redraw();
        this._changed();
    }

    /** Repaint the surface (paper, ink, grid lines). */
    redraw() {
        const ctx = this._ctx;
        const sx = this._canvasW / this._w;
        const sy = this._canvasH / this._h;

        ctx.clearRect(0, 0, this._canvasW, this._canvasH);
        ctx.fillStyle = this._getPaper();
        ctx.fillRect(0, 0, this._canvasW, this._canvasH);

        if (this._indexed && this._getColor) {
            for (let y = 0; y < this._h; y++) {
                for (let x = 0; x < this._w; x++) {
                    ctx.fillStyle = this._getColor(this._pixels[y * this._w + x]);
                    ctx.fillRect(x * sx, y * sy, sx, sy);
                }
            }
        } else {
            ctx.fillStyle = this._getInk();
            for (let y = 0; y < this._h; y++) {
                for (let x = 0; x < this._w; x++) {
                    if (this._pixels[y * this._w + x]) {
                        ctx.fillRect(x * sx, y * sy, sx, sy);
                    }
                }
            }
        }

        ctx.strokeStyle = 'rgba(128,128,128,0.4)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= this._w; i++) {
            ctx.beginPath(); ctx.moveTo(i * sx, 0); ctx.lineTo(i * sx, this._canvasH); ctx.stroke();
        }
        for (let i = 0; i <= this._h; i++) {
            ctx.beginPath(); ctx.moveTo(0, i * sy); ctx.lineTo(this._canvasW, i * sy); ctx.stroke();
        }
    }

    // ── Event wiring ───────────────────────────────────────────────────────

    _attachEvents(){
        this.element.addEventListener('pointerdown', e => this._onPointerDown(e));
        this.element.addEventListener('pointermove', e => this._onPointerMove(e));
        this.element.addEventListener('pointerup', e => this._onPointerUp(e));
        this.element.addEventListener('pointerleave', () => {
            if (this._isDrawing && this._tool !== 'line') this._isDrawing = false;
        });
        this.element.addEventListener('contextmenu', e => e.preventDefault());
    }

    _pixelCoord(e) {
        const rect = this.element.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (rect.width / this._w));
        const y = Math.floor((e.clientY - rect.top) / (rect.height / this._h));
        return {
            x: clamp(x, 0, this._w - 1),
            y: clamp(y, 0, this._h - 1)
        };
    }

    /**
     * Does this pointer mean "erase"? The right mouse button, and the pen's
     * inverted tail — a stylus that paints ink when it is held eraser-first is
     * not doing what its own casing says. Both `button` (the one that changed,
     * the only thing a pointerup still carries) and `buttons` (what is held
     * during a drag) are read, because neither alone covers both moments.
     * @private
     */
    _isErase(e) {
        return e.button === 2 || e.button === PEN_CONTROLS.ERASER.button ||
               (e.buttons & 2) !== 0 || (e.buttons & PEN_CONTROLS.ERASER.bit) !== 0;
    }

    _onPointerDown(e) {
        e.preventDefault();
        this._isDrawing = true;
        const { x, y } = this._pixelCoord(e);
        if (this._tool === 'line') {
            this._lineStart = { x, y };
        } else if (this._tool === 'fill') {
            this._floodFill(x, y, this._isErase(e) ? this._eraseValue() : this._drawValue());
            this.redraw();
            this._changed();
        } else {
            this._setPixel(x, y, (this._tool === 'eraser' || this._isErase(e))
                ? this._eraseValue() : this._drawValue());
            this.redraw();
            this._changed();
        }
    }

    _onPointerMove(e) {
        if (!this._isDrawing) return;
        const { x, y } = this._pixelCoord(e);
        if (this._tool === 'brush' || this._tool === 'eraser') {
            this._setPixel(x, y, (this._tool === 'eraser' || this._isErase(e))
                ? this._eraseValue() : this._drawValue());
            this.redraw();
            this._changed();
        } else if (this._tool === 'line' && this._lineStart) {
            this.redraw();
            this._drawLinePreview(this._lineStart.x, this._lineStart.y, x, y);
        }
    }

    _onPointerUp(e) {
        if (!this._isDrawing) return;
        this._isDrawing = false;
        if (this._tool === 'line' && this._lineStart) {
            const { x, y } = this._pixelCoord(e);
            const value = this._isErase(e) ? this._eraseValue() : this._drawValue();
            ToolBase.forEachLinePoint(this._lineStart.x, this._lineStart.y, x, y,
                (px, py) => this._setPixel(px, py, value));
            this._lineStart = null;
            this.redraw();
            this._changed();
        }
    }

    // ── Drawing primitives ─────────────────────────────────────────────────

    /** Left-button value: 1 for 1-bit consumers, the current index when indexed. @private */
    _drawValue() {
        return this._indexed ? this._getDrawValue() : 1;
    }

    /** Erase value: 0 for 1-bit consumers, the transparency index when indexed. @private */
    _eraseValue() {
        return this._indexed ? this._getEraseValue() : 0;
    }

    _setPixel(x, y, value) {
        if (x < 0 || x >= this._w || y < 0 || y >= this._h) return;
        this._pixels[y * this._w + x] = value;
    }

    _floodFill(startX, startY, fillValue) {
        const target = this._pixels[startY * this._w + startX];
        if (target === fillValue) return;
        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= this._w || y < 0 || y >= this._h) continue;
            if (this._pixels[y * this._w + x] !== target) continue;
            this._pixels[y * this._w + x] = fillValue;
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    _drawLinePreview(x0, y0, x1, y1) {
        const ctx = this._ctx;
        const sx = this._canvasW / this._w;
        const sy = this._canvasH / this._h;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ToolBase.forEachLinePoint(x0, y0, x1, y1, (x, y) => {
            ctx.fillRect(x * sx, y * sy, sx, sy);
        });
    }

    _changed() {
        if (this._onChange) this._onChange();
    }
}

window.CellGridEditor = CellGridEditor;

Logger.debug('CellGridEditor', 'Cell grid editor component loaded');

})(); // End IIFE
