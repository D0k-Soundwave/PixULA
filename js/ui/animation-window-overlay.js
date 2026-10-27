'use strict';
(function() {

/**
 * AnimationWindowOverlay - outlines the open sprite animation's window on the
 * picture. Display only: it never writes a pixel or an attribute.
 *
 * One canvas of the picture's own size inside the canvas container (so it
 * zooms and scrolls with the picture), made the way MapElementOverlay makes
 * its own. The outline runs one pixel OUTSIDE the window, so it never hides a
 * pixel of the sprite, dark and light in turn so it shows on any picture. It
 * is left off while the animation plays.
 */
class AnimationWindowOverlayClass {
    constructor() {
        this.ID = 'animation-window-canvas';
        this._canvas = null;
    }

    init() {
        const redraw = () => this.draw();
        EventBus.on(EVENTS.ANIMATION_CHANGED, redraw);
        EventBus.on(EVENTS.ANIMATION_FRAME, redraw);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, redraw);
        EventBus.on(EVENTS.FILE_NEW, redraw);
        if (window.CanvasSystem && CanvasSystem.onReady) CanvasSystem.onReady(redraw);
    }

    /** @private */
    _ensure() {
        if (!window.CanvasSystem || !CanvasSystem.createOverlayCanvas) return null;
        const c = CanvasSystem.createOverlayCanvas({ id: this.ID, zIndex: 125 });
        if (c) this._canvas = c;
        return this._canvas;
    }

    /** The window outlined now, in pixels, or null (the tests read this). */
    describe() {
        const a = window.AnimationService && AnimationService.getOpen();
        if (!a || a.kind !== 'sprite' || AnimationService.isPlaying()) return null;
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        return { x: a.rect.cx * cw, y: a.rect.cy * ch, w: a.rect.cw * cw, h: a.rect.ch * ch };
    }

    draw() {
        const canvas = this._ensure();
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const r = this.describe();
        if (!r) return;
        // Two dashes, offset by one, so the line alternates black and white.
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
        ctx.lineDashOffset = 2;
        ctx.strokeStyle = 'rgb(255, 255, 255)';
        ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
    }
}

window.AnimationWindowOverlay = new AnimationWindowOverlayClass();

})();
