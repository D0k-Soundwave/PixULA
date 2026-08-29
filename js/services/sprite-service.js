'use strict';
(function() {

/**
 * SpriteService — the ZX Spectrum Next sprite sheet model (Phase 13).
 * Pure logic, no DOM (FontService pattern); facts go up ONLY via
 * EVENTS.SPRITE_CHANGED / SPRITE_LOADED.
 *
 * Model:
 *   - Sprites are 16×16 patterns. Pixels are stored UNPACKED as palette
 *     indices (Uint8Array(256), row-major) whatever the sheet depth; the
 *     4bpp packing exists only in the .spr codec (io/spr-format.js).
 *   - The sheet has ONE depth, 8 or 4 bpp (like the hardware's pattern
 *     memory view). Switching depth masks every index into the 4bpp
 *     window (documented destructive, like the font editor's width
 *     re-shape).
 *   - Transparency follows the hardware defaults: index 0xE3 in 8bpp
 *     (sprite transparency register $4B boot value), its low nibble 0x03
 *     in 4bpp. The editor paints transparency with the right-button/
 *     eraser exactly like the hardware would render it (skipped).
 *   - The sheet caps at 64 sprites — one 16 KB pattern-memory bank of
 *     8bpp patterns (128 four-bit patterns don't get a second cap; a full
 *     4bpp bank is 128, but one shared cap keeps the model simple and a
 *     .spr export of 64×128 bytes still loads fine everywhere).
 *   - Colours resolve through the document's Next palette (ColorManager
 *     rgb333 registers) — sprites carry indices, never RGB.
 *
 * The sheet is session state; .spr files are its persistence (documented
 * scope decision — no IndexedDB store, unlike fonts/maps).
 */
const SPRITE_SIZE = 16;
const SPRITE_PIXELS = SPRITE_SIZE * SPRITE_SIZE;
const MAX_SPRITES = 64;

class SpriteServiceClass {
    constructor() {
        this.sprites = [new Uint8Array(SPRITE_PIXELS).fill(0xE3)];
        this.depth = 8; // 8 | 4 bpp
        this.current = 0;
    }

    // ── Sheet shape ─────────────────────────────────────────────────────────

    get SPRITE_SIZE() { return SPRITE_SIZE; }
    get MAX_SPRITES() { return MAX_SPRITES; }

    /** The sheet's transparency index for its depth. */
    transparencyIndex() {
        return this.depth === 8 ? 0xE3 : 0x03;
    }

    /** Highest drawable palette index at the sheet depth. */
    maxIndex() {
        return this.depth === 8 ? 255 : 15;
    }

    getDepth() { return this.depth; }

    /**
     * Set the sheet depth. 8->4 masks every index to its low nibble
     * (documented destructive).
     * @param {number} depth - 8 | 4
     */
    setDepth(depth) {
        const d = depth === 4 ? 4 : 8;
        if (d === this.depth) return;
        if (d === 4) {
            for (const spr of this.sprites) {
                for (let i = 0; i < spr.length; i++) spr[i] &= 0x0F;
            }
        }
        this.depth = d;
        EventBus.emit(EVENTS.SPRITE_CHANGED, { depth: d });
    }

    getCount() { return this.sprites.length; }
    getCurrent() { return this.current; }

    setCurrent(n) {
        this.current = clamp(n | 0, 0, this.sprites.length - 1);
        EventBus.emit(EVENTS.SPRITE_CHANGED, { current: this.current });
    }

    /** Append an empty (fully transparent) sprite. @returns {number|-1} its index */
    addSprite() {
        if (this.sprites.length >= MAX_SPRITES) return -1;
        this.sprites.push(new Uint8Array(SPRITE_PIXELS).fill(this.transparencyIndex()));
        EventBus.emit(EVENTS.SPRITE_CHANGED, { count: this.sprites.length });
        return this.sprites.length - 1;
    }

    /** Remove a sprite (the sheet keeps at least one). */
    removeSprite(n) {
        if (this.sprites.length <= 1) return false;
        if (n < 0 || n >= this.sprites.length) return false;
        this.sprites.splice(n, 1);
        if (this.current >= this.sprites.length) this.current = this.sprites.length - 1;
        EventBus.emit(EVENTS.SPRITE_CHANGED, { count: this.sprites.length });
        return true;
    }

    // ── Pixels ──────────────────────────────────────────────────────────────

    /** The live pattern of sprite n (Uint8Array(256)). Treat as read-only. */
    getSprite(n) {
        return this.sprites[n] || null;
    }

    /** Replace sprite n's pattern (values masked to the sheet depth). */
    setSprite(n, pixels) {
        const spr = this.sprites[n];
        if (!spr || !pixels || pixels.length !== SPRITE_PIXELS) return false;
        const mask = this.depth === 8 ? 0xFF : 0x0F;
        for (let i = 0; i < SPRITE_PIXELS; i++) spr[i] = pixels[i] & mask;
        EventBus.emit(EVENTS.SPRITE_CHANGED, { sprite: n });
        return true;
    }

    getPixel(n, x, y) {
        const spr = this.sprites[n];
        if (!spr) return 0;
        return spr[(y & 15) * SPRITE_SIZE + (x & 15)];
    }

    setPixel(n, x, y, index) {
        const spr = this.sprites[n];
        if (!spr) return;
        spr[(y & 15) * SPRITE_SIZE + (x & 15)] = clamp(index | 0, 0, this.maxIndex());
        EventBus.emit(EVENTS.SPRITE_CHANGED, { sprite: n });
    }

    clearSprite(n) {
        const spr = this.sprites[n];
        if (!spr) return;
        spr.fill(this.transparencyIndex());
        EventBus.emit(EVENTS.SPRITE_CHANGED, { sprite: n });
    }

    // ── Ops (all in place on sprite n) ──────────────────────────────────────

    flipH(n) { this._remap(n, (x, y) => [SPRITE_SIZE - 1 - x, y]); }
    flipV(n) { this._remap(n, (x, y) => [x, SPRITE_SIZE - 1 - y]); }
    rotateCW(n) { this._remap(n, (x, y) => [y, SPRITE_SIZE - 1 - x]); }

    /** @private */
    _remap(n, srcOf) {
        const spr = this.sprites[n];
        if (!spr) return;
        const out = new Uint8Array(SPRITE_PIXELS);
        for (let y = 0; y < SPRITE_SIZE; y++) {
            for (let x = 0; x < SPRITE_SIZE; x++) {
                const [sx, sy] = srcOf(x, y);
                out[y * SPRITE_SIZE + x] = spr[sy * SPRITE_SIZE + sx];
            }
        }
        spr.set(out);
        EventBus.emit(EVENTS.SPRITE_CHANGED, { sprite: n });
    }

    // ── Canvas bridges (indexed modes only) ─────────────────────────────────

    /** True while sprites can capture from / stamp to the canvas. */
    isCanvasCompatible() {
        return ZX_SPECTRUM.PIXEL_DEPTH > 1;
    }

    /**
     * Capture a 16×16 canvas region (composited) into sprite n.
     * Transparent composite pixels become the sheet's transparency index.
     * @param {number} n - Sprite index
     * @param {number} px - Left pixel
     * @param {number} py - Top pixel
     */
    captureFromCanvas(n, px, py) {
        if (!this.isCanvasCompatible() || !this.sprites[n]) return false;
        const flattened = LayerManager.flattenVisible();
        const out = new Uint8Array(SPRITE_PIXELS);
        const mask = this.depth === 8 ? 0xFF : 0x0F;
        for (let y = 0; y < SPRITE_SIZE; y++) {
            for (let x = 0; x < SPRITE_SIZE; x++) {
                const idx = flattened.getPixelIndex(px + x, py + y);
                out[y * SPRITE_SIZE + x] =
                    (idx >= 0 ? idx : this.transparencyIndex()) & mask;
            }
        }
        this.sprites[n].set(out);
        EventBus.emit(EVENTS.SPRITE_CHANGED, { sprite: n });
        return true;
    }

    /**
     * Turn sprite n into a draggable stamp layer (SelectionService), instead
     * of writing it onto the canvas immediately. The artist positions it by
     * dragging (or clicking repeatedly, brush-mode) then commits — same
     * mechanism paste and placed brush content already use. Uses the
     * existing indexed floating-stamp path (`floatingPaste.indices`); no
     * `attrs` involved, sprites carry no ZX attribute.
     * @param {number} n - Sprite index
     * @returns {boolean}
     */
    saveAsStamp(n) {
        if (!this.isCanvasCompatible() || !this.sprites[n]) return false;
        const spr = this.sprites[n];
        const transparent = this.transparencyIndex();
        const mask = [];
        const indices = [];
        for (let y = 0; y < SPRITE_SIZE; y++) {
            const maskRow = [];
            const idxRow = [];
            for (let x = 0; x < SPRITE_SIZE; x++) {
                const idx = spr[y * SPRITE_SIZE + x];
                const opaque = idx !== transparent;
                maskRow.push(opaque);
                idxRow.push(opaque ? idx : -1);
            }
            mask.push(maskRow);
            indices.push(idxRow);
        }

        SelectionService.startFloatingPasteFromMask(mask, SPRITE_SIZE, SPRITE_SIZE, 0, 0, 'Save as Stamp');
        if (!SelectionService.floatingPaste) return false; // max layers reached
        SelectionService.floatingPaste.indices = indices;
        SelectionService.floatingPaste._srcIndices = indices.map(r => [...r]);
        SelectionService.floatingPaste.floatingLayer.clear();
        LayerManager.composeToCanvas();
        SelectionService._drawFloatingLayer();
        LayerManager.flushPendingCompose();
        CanvasSystem.requestRender();
        return true;
    }

    // ── Sheet load/replace (the .spr codec's write path) ────────────────────

    /**
     * Replace the whole sheet.
     * @param {Uint8Array[]} sprites - Unpacked 256-entry patterns
     * @param {number} depth - 8 | 4
     */
    loadSheet(sprites, depth) {
        if (!sprites || !sprites.length) return false;
        this.depth = depth === 4 ? 4 : 8;
        const mask = this.depth === 8 ? 0xFF : 0x0F;
        this.sprites = sprites.slice(0, MAX_SPRITES).map((s) => {
            const out = new Uint8Array(SPRITE_PIXELS);
            for (let i = 0; i < SPRITE_PIXELS; i++) out[i] = (s[i] || 0) & mask;
            return out;
        });
        this.current = 0;
        EventBus.emit(EVENTS.SPRITE_LOADED, { count: this.sprites.length, depth: this.depth });
        return true;
    }
}

window.SpriteService = new SpriteServiceClass();

Logger.debug('SpriteService', 'Sprite service loaded');

})(); // End IIFE
