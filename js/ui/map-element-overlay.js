'use strict';
(function() {

/**
 * MapElementOverlay - draws the map elements over the picture (Batch 11B). Display only: it never writes a dot or an attribute.
 *
 * One canvas of the picture's own size inside the canvas container (so it zooms and scrolls with the picture), above the picture and below the stroke
 * previews, the selection and the pointer. Each place of each element that fits the current screen is covered by a hatched box carrying the
 * element's number; a find in progress outlines its places, the current one heavier.
 */
class MapElementOverlayClass {
    constructor() {
        this.ID = 'map-element-canvas';
        this._canvas = null;
        this._highlight = null;     // { places: [{x,y}], w, h, current }
        this._hatch = null;
        this.drawCount = 0;         // redraws done, for the tests
    }

    init() {
        const redraw = () => this.draw();
        EventBus.on(EVENTS.MAP_ELEMENTS_CHANGED, redraw);
        EventBus.on(EVENTS.MAP_LOADED, redraw);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, redraw);
        EventBus.on(EVENTS.FILE_NEW, redraw);
        if (window.CanvasSystem && CanvasSystem.onReady) CanvasSystem.onReady(redraw);
    }

    /** The canvas, made on first use (the picture's frame may not exist before that). @private */
    _ensure() {
        if (!window.CanvasSystem || !CanvasSystem.createOverlayCanvas) return null;
        const c = CanvasSystem.createOverlayCanvas({ id: this.ID, zIndex: 120 });
        if (c && c !== this._canvas) { this._canvas = c; this._hatch = null; }
        return this._canvas;
    }

    /** Outline the places of a find in progress. Pass null to take the outline away. */
    setHighlight(h) {
        this._highlight = h;
        this.draw();
    }

    /** What would be drawn, as plain data (the tests read this instead of pixels). */
    describe() {
        const covers = [];
        const els = window.MapService ? MapService.elements : [];
        els.forEach((el, i) => {
            if (!MapService.elementFitsScreen(el)) return;
            el.positions.forEach(p => covers.push({ n: i + 1, x: p.x, y: p.y, w: el.w, h: el.h }));
        });
        return { covers, highlight: this._highlight };
    }

    draw() {
        const canvas = this._ensure();
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        const d = this.describe();
        for (const c of d.covers) this._cover(ctx, c.x * cw, c.y * ch, c.w * cw, c.h * ch, c.n);
        const h = d.highlight;
        if (h && h.places) {
            h.places.forEach((p, i) => this._outline(ctx, p.x * cw, p.y * ch, h.w * cw, h.h * ch, i === h.current));
        }
        this.drawCount++;
    }

    /** @private */
    _pattern(ctx) {
        if (this._hatch) return this._hatch;
        const t = Helpers.createCanvas(4, 4);
        const g = t.getContext('2d');
        g.fillStyle = '#4a4a5a';
        g.fillRect(0, 0, 4, 4);
        g.fillStyle = '#8a8aa0';
        for (let i = 0; i < 4; i++) g.fillRect(i, 3 - i, 1, 1);
        this._hatch = ctx.createPattern(t, 'repeat');
        return this._hatch;
    }

    /** A hatched box with the element's number in the ZX ROM font. @private */
    _cover(ctx, x, y, w, h, n) {
        ctx.fillStyle = this._pattern(ctx);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff';
        const s = String(n);
        // digits are 8 x 8 ROM glyphs: put them top-left, one cell wide each, clipped to the box
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        for (let k = 0; k < s.length; k++) this._glyph(ctx, s.charCodeAt(k), x + k * 8, y, '#000', 1);
        for (let k = 0; k < s.length; k++) this._glyph(ctx, s.charCodeAt(k), x + k * 8, y, '#fff', 0);
        ctx.restore();
    }

    /** One ROM glyph at (x, y) (shadow offset by `off`). @private */
    _glyph(ctx, code, x, y, colour, off) {
        if (code < 32 || code > 127) return;
        ctx.fillStyle = colour;
        for (let r = 0; r < 8; r++) {
            const bits = ZX_ROM_FONT[(code - 32) * 8 + r];
            for (let b = 0; b < 8; b++) if (bits & (0x80 >> b)) ctx.fillRect(x + b + off, y + r + off, 1, 1);
        }
    }

    /** A black and white outline (readable on any colour). @private */
    _outline(ctx, x, y, w, h, current) {
        ctx.lineWidth = current ? 2 : 1;
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.strokeStyle = current ? '#ff0' : '#fff';
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    }
}

window.MapElementOverlay = new MapElementOverlayClass();

})();
