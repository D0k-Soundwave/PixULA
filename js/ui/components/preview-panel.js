'use strict';
(function() {

/**
 * PreviewPanel - a small map of the whole picture with a frame for the part the viewport shows (Batch 9 part 9B).
 * Click or drag on it to scroll the canvas there; the arrow keys pan it by a quarter of the frame. Hidden until
 * View > Preview switches it on; it does no work while hidden or collapsed.
 *
 * The miniature is drawn from the live canvas (drawImage), so it is exactly what the canvas shows, flicker and all.
 */
class PreviewPanelClass {
    constructor() {
        this.ID = 'preview-panel';
        /**
         * Redraw rate. [C] 32 ms is every second frame of a 60 Hz display [P: 16.7 ms a frame], ~31 redraws a second - the
         * rate the pointer readout uses: a map being glanced at, not an animation, and a stroke can ask for many more.
         */
        this.THROTTLE_MS = 32;
        this._canvas = null;
        this._pending = null;
        this._last = 0;
        this._dragging = false;
        this.drawCount = 0;      // redraws done, for the tests
    }

    /** @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        const panel = PanelSection.create({
            id: this.ID,
            titleI18n: 'panels.preview',
            title: 'Preview',
            hintI18n: 'panels.preview.hint',
            hint: 'A small map of the whole picture. The frame is the part you see; click or drag on the map to go there. Right-click this header to move the whole panel up or down',
            visible: false
        });
        if (!panel) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'preview-canvas';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.tabIndex = 0;
        canvas.setAttribute('role', 'img');
        canvas.dataset.i18nAriaLabel = 'preview.aria';
        canvas.setAttribute('aria-label', this._t('preview.aria',
            'Map of the whole picture. Click or drag to scroll the canvas; the arrow keys pan it.'));
        panel.content.appendChild(canvas);
        this._canvas = canvas;

        canvas.addEventListener('pointerdown', (e) => {
            this._dragging = true;
            canvas.setPointerCapture(e.pointerId);
            this._goTo(e);
            e.preventDefault();
        });
        canvas.addEventListener('pointermove', (e) => { if (this._dragging) this._goTo(e); });
        const stop = (e) => {
            this._dragging = false;
            if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        };
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointercancel', stop);
        canvas.addEventListener('keydown', (e) => this._onKey(e));

        for (const name of ['CANVAS_RENDER', 'CANVAS_SCROLL', 'CANVAS_ZOOM', 'CANVAS_SCALE_CHANGED',
                            'SCREEN_MODE_CHANGED', 'PANEL_VISIBILITY_CHANGED']) {
            EventBus.on(EVENTS[name], () => this.request());
        }
        window.addEventListener('resize', () => this.request());
        if (window.ResizeObserver) new ResizeObserver(() => this.request()).observe(panel.content);
        this.request();
    }

    /** Whether there is anything to draw to: shown and not folded away. */
    isShown() {
        return !!this._canvas && PanelSection.isVisible(this.ID) && !PanelSection.isCollapsed(this.ID);
    }

    /** Ask for a redraw; at most one every THROTTLE_MS, and the last request always lands. */
    request() {
        if (!this.isShown()) return;
        const wait = this.THROTTLE_MS - (performance.now() - this._last);
        if (wait <= 0) {
            this.draw();
        } else if (!this._pending) {
            this._pending = setTimeout(() => { this._pending = null; this.draw(); }, wait);
        }
    }

    /** Draw the miniature and the frame. */
    draw() {
        if (!this.isShown() || !window.CanvasSystem || !CanvasSystem.canvas) return;
        this._last = performance.now();
        const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
        // The element fills the panel's width and keeps the picture's shape (CSS aspect-ratio); the backing store follows its
        // measured size, so a click maps to the picture with no distortion.
        this._canvas.style.aspectRatio = W + ' / ' + H;
        const cssW = Math.max(80, this._canvas.getBoundingClientRect().width);
        const dpr = window.devicePixelRatio || 1;
        const pw = Math.round(cssW * dpr), ph = Math.round(cssW * H / W * dpr);
        if (this._canvas.width !== pw || this._canvas.height !== ph) {
            this._canvas.width = pw;
            this._canvas.height = ph;
        }
        const ctx = this._canvas.getContext('2d');
        // Smoothing keeps thin lines visible when the map is smaller than the picture; at 1:1 or bigger it would blur dots.
        ctx.imageSmoothingEnabled = pw < W;
        ctx.drawImage(CanvasSystem.canvas, 0, 0, W, H, 0, 0, pw, ph);

        const v = CanvasSystem.getVisibleRect();
        if (v) {
            const sx = pw / W, sy = ph / H;
            ctx.lineWidth = Math.max(1, Math.round(dpr));
            const x = v.x * sx + ctx.lineWidth / 2, y = v.y * sy + ctx.lineWidth / 2;
            const w = v.w * sx - ctx.lineWidth, h = v.h * sy - ctx.lineWidth;
            ctx.strokeStyle = '#000';
            ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(x, y, w, h);
        }
        this.drawCount++;
    }

    /** The picture pixel under a pointer event on the map. @private */
    _pixelAt(e) {
        const r = this._canvas.getBoundingClientRect();
        return {
            x: Helpers.clamp((e.clientX - r.left) / r.width * ZX_SPECTRUM.WIDTH, 0, ZX_SPECTRUM.WIDTH),
            y: Helpers.clamp((e.clientY - r.top) / r.height * ZX_SPECTRUM.HEIGHT, 0, ZX_SPECTRUM.HEIGHT)
        };
    }

    /** @private */
    _goTo(e) {
        const p = this._pixelAt(e);
        CanvasSystem.centreOn(p.x, p.y);
        this.request();
    }

    /** Arrow keys pan by a quarter of the frame. They must not reach the document handler, which would nudge a selection. @private */
    _onKey(e) {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d || e.ctrlKey || e.altKey || e.metaKey) return;
        const v = CanvasSystem.getVisibleRect();
        if (!v) return;
        CanvasSystem.centreOn(v.x + v.w / 2 + d[0] * v.w / 4, v.y + v.h / 2 + d[1] * v.h / 4);
        e.preventDefault();
        e.stopPropagation();
        this.request();
    }
}

window.PreviewPanel = new PreviewPanelClass();

})();
