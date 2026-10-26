'use strict';
(function() {

/**
 * MapElementOverlay - draws the map elements over the picture (Batch 11B). Display only: it never writes a dot or an attribute.
 *
 * One canvas of the picture's own size inside the canvas container (so it zooms and scrolls with the picture), above the picture and below the stroke
 * previews, the selection and the pointer. Each place of each element that fits the current screen is covered by a hatched box carrying the
 * element's number; a find in progress outlines its places, the current one heavier.
 */
/** The digits 0 to 9, 3 wide and 5 high, one row per byte (bit 4 = left). */
const DIGITS_3X5 = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 1, 1], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7]];

class MapElementOverlayClass {
    constructor() {
        this.ID = 'map-element-canvas';
        this._canvas = null;
        this._highlight = null;     // { places: [{x,y}], w, h, current }
        this._hatch = null;
        this._pictures = false;     // false = numbered boxes, true = the elements' own pictures (Shift+M)
        this.drawCount = 0;         // redraws done, for the tests
    }

    init() {
        const redraw = () => this.draw();
        EventBus.on(EVENTS.MAP_ELEMENTS_CHANGED, redraw);
        EventBus.on(EVENTS.MAP_LOADED, redraw);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, redraw);
        EventBus.on(EVENTS.FILE_NEW, redraw);
        // the pictures (Shift+M) are drawn in the live palette's colours; the numbered boxes do not depend on colours
        const recolour = () => { if (this._pictures) this.draw(); };
        EventBus.on(EVENTS.PALETTE_CHANGED, recolour);
        EventBus.on(EVENTS.PALETTE_SLOT_CHANGED, recolour);
        if (window.CanvasSystem && CanvasSystem.onReady) CanvasSystem.onReady(redraw);
    }

    /** The canvas, made on first use (the picture's frame may not exist before that). @private */
    _ensure() {
        if (!window.CanvasSystem || !CanvasSystem.createOverlayCanvas) return null;
        const c = CanvasSystem.createOverlayCanvas({ id: this.ID, zIndex: 120 });
        if (c && c !== this._canvas) { this._canvas = c; this._hatch = null; }
        return this._canvas;
    }

    /** True while the elements show their own pictures instead of numbered boxes. */
    get pictures() { return this._pictures; }

    setPictures(on) {
        on = !!on;
        if (on === this._pictures) return;
        this._pictures = on;
        this.draw();
        EventBus.emit(EVENTS.MAP_ELEMENT_DISPLAY_CHANGED, { pictures: on });
    }

    /** Shift+M / View > Map Element Pictures. With no elements it says so instead of doing nothing. */
    togglePictures() {
        // turning them OFF always works (pictures may be on from a mode the elements fitted); turning them on needs an element that fits
        if (!this._pictures && (!window.MapService || !MapService.elements.some(e => MapService.elementFitsScreen(e)))) {
            EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('mapel.none', 'No map elements on this picture.') });
            return;
        }
        this.setPictures(!this._pictures);
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
            el.positions.forEach(p => covers.push({ n: el.number, index: i, x: p.x, y: p.y, w: el.w, h: el.h }));
        });
        return { covers, highlight: this._highlight, pictures: this._pictures };
    }

    draw() {
        const canvas = this._ensure();
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        const d = this.describe();
        if (this._pictures) {
            const table = MapService.colourTable();
            const images = new Map();
            // keyed by list position, not number: two elements can never share a picture, even if a file gave them the same number
            MapService.elements.forEach((el, i) => { if (MapService.elementFitsScreen(el)) images.set(i, this.renderElement(ctx, el, table)); });
            for (const c of d.covers) ctx.putImageData(images.get(c.index), c.x * cw, c.y * ch);
        } else {
            for (const c of d.covers) this._cover(ctx, c.x * cw, c.y * ch, c.w * cw, c.h * ch);
            // the numbers go on after every box, so a number wider than its box is not painted over by the next box
            for (const c of d.covers) this._label(ctx, c.x * cw, c.y * ch, c.w * cw, c.h * ch, c.n);
        }
        const h = d.highlight;
        if (h && h.places) {
            h.places.forEach((p, i) => this._outline(ctx, p.x * cw, p.y * ch, h.w * cw, h.h * ch, i === h.current));
        }
        this.drawCount++;
    }

    /**
     * An element's own picture as ImageData, in the colours it shows in the steady phase of the live palette (the GigaScreen pair is blended, as
     * the Average view shows it). The colour table is the one Visual compare reads, so the picture and the find agree.
     * @returns {ImageData}
     */
    renderElement(ctx, el, table) {
        const cw = ZX_SPECTRUM.CELL_WIDTH, H = el.bitmap.length / (el.screens * el.w * el.h);
        const W = el.w * cw, Hh = el.h * H;
        const img = ctx.createImageData(W, Hh);
        const cells = el.w * el.h;
        for (let cy = 0; cy < el.h; cy++) {
            for (let cx = 0; cx < el.w; cx++) {
                const c = cy * el.w + cx;
                for (let r = 0; r < H; r++) {
                    for (let b = 0; b < 8; b++) {
                        let rgb;
                        const bitA = (el.bitmap[c * H + r] >> (7 - b)) & 1;
                        if (el.screens === 1) {
                            rgb = table.at(0, el.attrs[c], bitA, 0);
                        } else {
                            const bitB = (el.bitmap[(cells + c) * H + r] >> (7 - b)) & 1;
                            rgb = MapFind.blend(table.at(0, el.attrs[c], bitA, 0), table.at(1, el.attrs[cells + c], bitB, 0));
                        }
                        const o = ((cy * H + r) * W + cx * cw + b) * 4;
                        img.data[o] = (rgb >> 16) & 255; img.data[o + 1] = (rgb >> 8) & 255; img.data[o + 2] = rgb & 255; img.data[o + 3] = 255;
                    }
                }
            }
        }
        return img;
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

    /** A hatched box. @private */
    _cover(ctx, x, y, w, h) {
        ctx.fillStyle = this._pattern(ctx);
        ctx.fillRect(x, y, w, h);
    }

    /**
     * The element's number, top left of its box, in small 3 x 5 digits four columns apart: two digits fit the one cell of the narrowest
     * element (10, 11 ... are not read as 1). A longer number is never cut short - it runs on past the box on a dark strip. @private
     */
    _label(ctx, x, y, w, h, n) {
        const s = String(n);
        const width = 1 + s.length * 4;
        if (width > w) {
            ctx.fillStyle = '#000';
            ctx.fillRect(x, y, width + 1, h < 7 ? h : 7);
        }
        for (let k = 0; k < s.length; k++) this._digit(ctx, s.charCodeAt(k) - 48, x + 1 + k * 4, y + 1, '#000', 1);
        for (let k = 0; k < s.length; k++) this._digit(ctx, s.charCodeAt(k) - 48, x + 1 + k * 4, y + 1, '#fff', 0);
    }

    /** One 3 x 5 digit at (x, y) (shadow offset by `off`). @private */
    _digit(ctx, d, x, y, colour, off) {
        if (d < 0 || d > 9) return;
        ctx.fillStyle = colour;
        const rows = DIGITS_3X5[d];
        for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (rows[r] & (4 >> b)) ctx.fillRect(x + b + off, y + r + off, 1, 1);
    }

    /** A black and white outline (readable on any colour). @private */
    _outline(ctx, x, y, w, h, current) {
        // one dark pixel outside, one light pixel inside: a single cell keeps a 4 x 4 centre visible so what was found can still be seen
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.strokeStyle = current ? '#ff0' : '#fff';
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    }
}

window.MapElementOverlay = new MapElementOverlayClass();

})();
