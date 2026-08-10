'use strict';
(function() {

/**
 * Color Manager
 *
 * Manages color selection and palette for the ZX Spectrum editor.
 * Handles INK, PAPER, BRIGHT, and FLASH attributes.
 */

/**
 * Calculate full color index (0-15) from base color and bright flag
 * @param {number} baseColor - Base color index (0-7)
 * @param {boolean} bright - Bright flag
 * @returns {number} Full color index (0-15)
 */
function getColorIndex(baseColor, bright) {
    return baseColor + (bright ? 8 : 0);
}

class ColorManagerClass {
    constructor() {
        this.ink = 0;
        this.paper = 7;
        this.bright = false;
        this.flash = false;
        this.border = 0;
        // Transparent mode: when true, that color passes through to layer below
        this.inkTransparent = false;
        this.paperTransparent = false;
        // Active palette — ZX_PALETTE in fixed16 modes; the 64 editable
        // ULAplus registers derive it in ulaplus64 mode. Everything that
        // needs a palette colour reads it from here, never from a second copy.
        this.palette = ZX_PALETTE.slice();
        this.paletteRGB = ZX_PALETTE_RGB.slice();
        // ULAplus register file (Uint8Array(64), G3R3B2) — document state,
        // lazily seeded from the default set the first time ULAplus mode
        // activates; carried by undo snapshots, autosave and the SCR variant.
        this.ulaplusRegisters = null;
        // Timex hi-res colour scheme (document state in timexMono mode):
        // the ink colour 0–7 from the hi-res port byte's bits 3–5; paper is
        // always its complement (ink ^ 7) and both render at BRIGHT levels
        // (RECOIL renders hi-res fully saturated). Carried by undo snapshots,
        // autosave and the 12289 SCR variant's port byte.
        this.timexHiresInk = 0;
        // Next RGB333 register file (Uint16Array(256), 9-bit values) —
        // document state for every rgb333 mode (Phase 13), lazily seeded
        // from NEXTRGB333.defaultRegisters(); ONE palette per document,
        // shared by Layer 2 / LoRes / ULANext. Carried by undo snapshots,
        // autosave and the .nxi/.npl/.pal palette blocks.
        this.nextRegisters = null;
        // Indexed-mode drawing state (pixelDepth > 1): the palette index the
        // brush paints (nextInk) and the index ERASE/PAPER writes on the
        // background layer (nextPaper). Tool state like ink/paper, not
        // document state.
        this.nextInk = NEXTRGB333.DEFAULT_INK;
        this.nextPaper = NEXTRGB333.DEFAULT_PAPER;
        this._writtenTokenCount = 0;
    }

    /**
     * Initialize color manager from stored state
     */
    initialize() {
        const colorState = StateManager.getSection('color');
        if (colorState) {
            this.ink = colorState.ink;
            this.paper = colorState.paper;
            this.bright = colorState.bright;
            this.flash = colorState.flash;
        }
        this.applyScreenMode();
        Logger.info('ColorManager', 'Initialized', this.getCurrentSelection());
    }

    /**
     * Re-derive the active palette from the active screen mode's palette
     * model. fixed16 -> ZX_PALETTE; ulaplus64 -> the 64 G3R3B2 registers;
     * timexMono -> a 2-entry [paper, ink] palette from the hi-res scheme.
     * Called by ScreenModeService on every mode switch (commands go down);
     * announces the result as an EVENTS.PALETTE_CHANGED fact.
     */
    applyScreenMode() {
        if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64') {
            if (!this.ulaplusRegisters) {
                this.ulaplusRegisters = ULAPLUS.defaultRegisters();
            }
            this._derivePaletteFromRegisters();
        } else if (ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
            this._deriveTimexMonoPalette();
        } else if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
            this._deriveNextPalette();
        } else {
            this.palette = ZX_PALETTE.slice();
            this.paletteRGB = ZX_PALETTE_RGB.slice();
        }
        // Keep the indexed drawing indices inside the active palette
        this.nextInk = clamp(this.nextInk, 0, this.palette.length - 1);
        this.nextPaper = clamp(this.nextPaper, 0, this.palette.length - 1);
        this._writePaletteTokens();
        EventBus.emit(EVENTS.PALETTE_CHANGED, { palette: this.palette });
    }

    /**
     * Rebuild the palette from the Next RGB333 register file (Phase 13).
     * The active palette exposes the mode's drawable window: paletteSize
     * entries (256 for the 8bpp modes and ULANext, the first 16 for the
     * 4bpp modes) — the full 256-register file stays intact underneath.
     * @private
     */
    _deriveNextPalette() {
        const regs = this.getNextRegisters();
        const n = ACTIVE_SCREEN_MODE.paletteSize || 256;
        this.palette = [];
        this.paletteRGB = [];
        for (let i = 0; i < n; i++) {
            this.palette.push(NEXTRGB333.registerToHex(regs[i]));
            this.paletteRGB.push(Uint8Array.from(NEXTRGB333.registerToRGB(regs[i])));
        }
    }

    /**
     * Rebuild the 2-entry timexMono palette from the hi-res scheme:
     * index 0 = paper (complement of ink), index 1 = ink, both from the
     * BRIGHT half of the fixed palette. @private
     */
    _deriveTimexMonoPalette() {
        const ink = this.timexHiresInk & 7;
        const paper = ink ^ 7;
        this.palette = [ZX_PALETTE[paper + 8], ZX_PALETTE[ink + 8]];
        this.paletteRGB = [ZX_PALETTE_RGB[paper + 8], ZX_PALETTE_RGB[ink + 8]];
    }

    /** Rebuild palette/paletteRGB from the ULAplus register file. @private */
    _derivePaletteFromRegisters() {
        const regs = this.ulaplusRegisters;
        this.palette = [];
        this.paletteRGB = [];
        for (let i = 0; i < regs.length; i++) {
            const rgb = ULAPLUS.registerToRGB(regs[i]);
            this.palette.push(ULAPLUS.registerToHex(regs[i]));
            this.paletteRGB.push(Uint8Array.from(rgb));
        }
    }

    /**
     * Publish the active palette as indexed CSS tokens (--zx-0 … --zx-N) on
     * :root. CSS never hardcodes palette hex values; variables.css only
     * defines readable aliases (--zx-blue: var(--zx-1)). Re-run whenever the
     * palette changes (editable-palette modes); stale tokens from a longer
     * previous palette are removed.
     */
    _writePaletteTokens() {
        // Headless (Node test) runs exercise the palette model without a DOM
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        this.palette.forEach((hex, i) => root.style.setProperty(`--zx-${i}`, hex));
        for (let i = this.palette.length; i < this._writtenTokenCount; i++) {
            root.style.removeProperty(`--zx-${i}`);
        }
        this._writtenTokenCount = this.palette.length;

        // The border is a ULA HARDWARE register, not part of the document
        // palette: it is always one of the 8 non-bright classic colours, in
        // every screen mode, and no editable palette model (ULAplus, rgb333,
        // timexMono) can redefine it. Publishing it as its own token set keeps
        // the border preview exact — reading --zx-0…7 instead would hand it a
        // ULAplus register, or nothing at all in the 2-entry timexMono palette.
        for (let n = 0; n < 8; n++) {
            root.style.setProperty(`--zx-border-${n}`, ZX_PALETTE[n]);
        }

        // Timex hi-res: the scheme selector previews all 8 ink/paper pairs,
        // which live outside the 2-entry active palette — publish them as
        // their own tokens so the UI never hardcodes colours.
        if (ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
            for (let n = 0; n < 8; n++) {
                root.style.setProperty(`--zx-scheme-ink-${n}`, ZX_PALETTE[n + 8]);
                root.style.setProperty(`--zx-scheme-paper-${n}`, ZX_PALETTE[(n ^ 7) + 8]);
            }
        } else {
            for (let n = 0; n < 8; n++) {
                root.style.removeProperty(`--zx-scheme-ink-${n}`);
                root.style.removeProperty(`--zx-scheme-paper-${n}`);
            }
        }
    }

    /**
     * Get the active palette (array of hex strings, index = colour index)
     * @returns {string[]}
     */
    getPalette() {
        return this.palette;
    }

    /**
     * RGB triplet for a palette index (active palette, any mode).
     * @param {number} index
     * @returns {Uint8Array} [r, g, b]
     */
    getRGB(index) {
        return this.paletteRGB[index] || this.paletteRGB[0];
    }

    /**
     * Resolve a cell attribute set to palette indices for the active mode.
     * fixed16: BRIGHT offsets by 8 (black stays black — the classic special
     * case), FLASH means the cell really flashes. ulaplus64: FLASH/BRIGHT
     * select one of 4 CLUTs (CLUT = flash*2 + bright), ink indexes the
     * CLUT's first half, paper its second half, and nothing flashes.
     * timexMono: the fixed screen-wide pair — ink 1, paper 0.
     * @param {Object} attrs - { ink, paper, bright, flash }
     * @returns {{ink: number, paper: number, flashing: boolean}}
     */
    attrToIndices(attrs) {
        if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64') {
            const clut = (attrs.flash ? 2 : 0) + (attrs.bright ? 1 : 0);
            return {
                ink: clut * 16 + (attrs.ink & 7),
                paper: clut * 16 + 8 + (attrs.paper & 7),
                flashing: false
            };
        }
        if (ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
            // The whole hi-res screen shares one ink/paper pair — cell
            // attribute bytes are ignored at render, and nothing flashes.
            return { ink: 1, paper: 0, flashing: false };
        }
        if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
            if (ACTIVE_SCREEN_MODE.pixelDepth > 1) {
                // Indexed modes have no cell attributes — the "current
                // colours" are the indexed drawing indices (this keeps
                // getInkColorIndex/getInkRGB and every preview consumer
                // working unchanged).
                return { ink: this.nextInk, paper: this.nextPaper, flashing: false };
            }
            // ULANext (documented model, constants.js): ink resolves in the
            // palette's ink half, paper in the paper half at 128+; BRIGHT
            // offsets by 8 within each half, FLASH is stored but nothing
            // flashes.
            return {
                ink: (attrs.bright ? 8 : 0) + (attrs.ink & 7),
                paper: 128 + (attrs.bright ? 8 : 0) + (attrs.paper & 7),
                flashing: false
            };
        }
        return {
            ink: attrs.ink === 0 ? 0 : (attrs.bright ? attrs.ink + 8 : attrs.ink),
            paper: attrs.paper === 0 ? 0 : (attrs.bright ? attrs.paper + 8 : attrs.paper),
            flashing: !!attrs.flash
        };
    }

    // ─── ULAplus register file (document state in ulaplus64 mode) ──────────

    /** The 64 G3R3B2 registers (seeded with the defaults on first use). */
    getUlaplusRegisters() {
        if (!this.ulaplusRegisters) {
            this.ulaplusRegisters = ULAPLUS.defaultRegisters();
        }
        return this.ulaplusRegisters;
    }

    /**
     * Replace the whole register file (undo restore, SCR import, autosave).
     * Re-derives the palette when ULAplus mode is active.
     * @param {Uint8Array|number[]|null} regs - 64 register bytes (null = defaults)
     */
    setUlaplusRegisters(regs) {
        this.ulaplusRegisters = regs ? Uint8Array.from(regs) : null;
        if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64') {
            this.applyScreenMode();
        }
    }

    /**
     * Set one palette register (the palette editor's write path).
     * @param {number} index - 0-63
     * @param {number} byte - G3R3B2 register value
     */
    setUlaplusRegister(index, byte) {
        const regs = this.getUlaplusRegisters();
        if (index < 0 || index >= regs.length) return;
        regs[index] = byte & 0xFF;
        if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64') {
            this.applyScreenMode();
        }
        StateManager.markModified();
    }

    // ─── Timex hi-res scheme (document state in timexMono mode) ────────────

    /** The hi-res ink colour (0–7); paper is always its complement. */
    getTimexHiresInk() {
        return this.timexHiresInk & 7;
    }

    /**
     * Set the hi-res colour scheme (the scheme selector's and the 12289 SCR
     * import's write path). Re-derives the palette when hi-res mode is
     * active; the caller recomposes the canvas (commands go down).
     * @param {number} ink - Ink colour 0–7 (paper becomes ink ^ 7)
     */
    setTimexHiresInk(ink) {
        this.timexHiresInk = ink & 7;
        if (ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
            this.applyScreenMode();
        }
        StateManager.markModified();
    }

    // ─── Next RGB333 register file (document state in rgb333 modes) ────────

    /** The 256 9-bit registers (seeded with the defaults on first use). */
    getNextRegisters() {
        if (!this.nextRegisters) {
            this.nextRegisters = NEXTRGB333.defaultRegisters();
        }
        return this.nextRegisters;
    }

    /**
     * Replace the whole Next register file (undo restore, palette import,
     * autosave). Re-derives the palette when an rgb333 mode is active.
     * @param {Uint16Array|number[]|null} regs - 256 register values (null = defaults)
     */
    setNextRegisters(regs) {
        this.nextRegisters = regs ? Uint16Array.from(regs) : null;
        if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
            this.applyScreenMode();
        }
    }

    /**
     * Set one Next palette register (the palette editor's write path).
     * @param {number} index - 0-255
     * @param {number} value - 9-bit RGB333 register
     */
    setNextRegister(index, value) {
        const regs = this.getNextRegisters();
        if (index < 0 || index >= regs.length) return;
        regs[index] = value & 0x1FF;
        if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
            this.applyScreenMode();
        }
        StateManager.markModified();
    }

    /** True if the Next register file differs from the default set. */
    isNextPaletteEdited() {
        if (!this.nextRegisters) return false;
        const def = NEXTRGB333.defaultRegisters();
        for (let i = 0; i < def.length; i++) {
            if (this.nextRegisters[i] !== def[i]) return true;
        }
        return false;
    }

    // ─── Indexed drawing indices (tool state in pixelDepth > 1 modes) ──────

    /** The palette index the brush paints in indexed modes. */
    getIndexedInk() {
        return clamp(this.nextInk, 0, this.palette.length - 1);
    }

    /** The background/erase palette index in indexed modes. */
    getIndexedPaper() {
        return clamp(this.nextPaper, 0, this.palette.length - 1);
    }

    /**
     * Select the indexed ink (announced on the classic COLOR_INK channel so
     * swatch UI / stamp previews refresh through their existing listeners).
     * @param {number} index
     */
    setNextInk(index) {
        this.nextInk = clamp(index | 0, 0, this.palette.length - 1);
        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
    }

    /**
     * Select the indexed paper/erase index.
     * @param {number} index
     */
    setNextPaper(index) {
        this.nextPaper = clamp(index | 0, 0, this.palette.length - 1);
        EventBus.emit(EVENTS.COLOR_PAPER, this.getCurrentSelection());
    }

    /** True if the register file differs from the default set. */
    isUlaplusPaletteEdited() {
        if (!this.ulaplusRegisters) return false;
        const def = ULAPLUS.defaultRegisters();
        for (let i = 0; i < def.length; i++) {
            if (this.ulaplusRegisters[i] !== def[i]) return true;
        }
        return false;
    }

    // ─── CLUT selection (ULAplus UI convenience over bright/flash) ─────────

    /** Active CLUT number (0-3) = flash*2 + bright. */
    getClut() {
        return (this.flash ? 2 : 0) + (this.bright ? 1 : 0);
    }

    /**
     * Select the active CLUT by number — writes the underlying bright/flash
     * bits (the ZX-Paintbrush model: the CLUT grid IS the bright/flash pair).
     * @param {number} clut - 0-3
     */
    setClut(clut) {
        const c = clamp(clut | 0, 0, 3);
        this.setBright((c & 1) !== 0);
        this.setFlash((c & 2) !== 0);
    }

    /**
     * Get current INK base color (0-7)
     * @returns {number}
     */
    getInk() {
        return this.ink;
    }

    /**
     * Get current PAPER base color (0-7)
     * @returns {number}
     */
    getPaper() {
        return this.paper;
    }

    /**
     * Get current BRIGHT flag
     * @returns {boolean}
     */
    getBright() {
        return this.bright;
    }

    /**
     * Get current FLASH flag
     * @returns {boolean}
     */
    getFlash() {
        return this.flash;
    }

    /**
     * Get INK color index with bright applied (0-15)
     * Alias for tools that expect full color index
     * @returns {number}
     */
    getCurrentInk() {
        return this.getInkColorIndex();
    }

    /**
     * Get PAPER color index with bright applied (0-15)
     * Alias for tools that expect full color index
     * @returns {number}
     */
    getCurrentPaper() {
        return this.getPaperColorIndex();
    }

    /**
     * Set INK base color (0-7)
     * Clears transparent mode when a new color is selected
     * @param {number} ink - Base color index
     */
    setInk(ink) {
        if (!Validators.isValidBaseColor(ink)) {
            Logger.warn('ColorManager', 'Invalid INK color', ink);
            return;
        }
        this.ink = ink;
        this.inkTransparent = false; // Clear transparent when setting color
        StateManager.set('color.ink', ink);
        StateManager.set('color.inkTransparent', false);
        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
    }

    /**
     * Set PAPER base color (0-7)
     * Clears transparent mode when a new color is selected
     * @param {number} paper - Base color index
     */
    setPaper(paper) {
        if (!Validators.isValidBaseColor(paper)) {
            Logger.warn('ColorManager', 'Invalid PAPER color', paper);
            return;
        }
        this.paper = paper;
        this.paperTransparent = false; // Clear transparent when setting color
        StateManager.set('color.paper', paper);
        StateManager.set('color.paperTransparent', false);
        EventBus.emit(EVENTS.COLOR_PAPER, this.getCurrentSelection());
    }

    /**
     * Set BRIGHT flag
     * @param {boolean} bright
     */
    setBright(bright) {
        this.bright = Boolean(bright);
        StateManager.set('color.bright', this.bright);
        EventBus.emit(EVENTS.COLOR_BRIGHT, this.getCurrentSelection());
    }

    /**
     * Set FLASH flag
     * @param {boolean} flash
     */
    setFlash(flash) {
        this.flash = Boolean(flash);
        StateManager.set('color.flash', this.flash);
        EventBus.emit(EVENTS.COLOR_FLASH, this.getCurrentSelection());
    }

    /**
     * Get the document border colour (0-7, non-bright only — real border has no BRIGHT)
     * @returns {number}
     */
    getBorder() {
        return this.border;
    }

    /**
     * Set the document border colour
     * @param {number} border - 0-7 (clamped)
     */
    setBorder(border) {
        const b = clamp(border | 0, 0, 7);
        if (b === this.border) return;
        this.border = b;
        EventBus.emit(EVENTS.COLOR_BORDER, { border: b });
    }

    /**
     * Get INK transparent flag
     * @returns {boolean}
     */
    isInkTransparent() {
        return this.inkTransparent;
    }

    /**
     * Get PAPER transparent flag
     * @returns {boolean}
     */
    isPaperTransparent() {
        return this.paperTransparent;
    }

    /**
     * Set INK transparent mode
     * @param {boolean} transparent
     */
    setInkTransparent(transparent) {
        this.inkTransparent = Boolean(transparent);
        StateManager.set('color.inkTransparent', this.inkTransparent);
        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
    }

    /**
     * Set PAPER transparent mode
     * @param {boolean} transparent
     */
    setPaperTransparent(transparent) {
        this.paperTransparent = Boolean(transparent);
        StateManager.set('color.paperTransparent', this.paperTransparent);
        EventBus.emit(EVENTS.COLOR_PAPER, this.getCurrentSelection());
    }

    /**
     * Toggle INK transparent mode
     */
    toggleInkTransparent() {
        this.setInkTransparent(!this.inkTransparent);
    }

    /**
     * Toggle PAPER transparent mode
     */
    togglePaperTransparent() {
        this.setPaperTransparent(!this.paperTransparent);
    }

    /**
     * Swap INK and PAPER colors
     */
    swapColors() {
        const tempInk = this.ink;
        this.ink = this.paper;
        this.paper = tempInk;
        StateManager.setMultiple({
            'color.ink': this.ink,
            'color.paper': this.paper
        });
        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
        EventBus.emit(EVENTS.COLOR_PAPER, this.getCurrentSelection());
    }

    /**
     * Get complete color selection object
     * @returns {Object} { ink, paper, bright, flash, inkTransparent, paperTransparent }
     */
    getCurrentSelection() {
        return {
            ink: this.ink,
            paper: this.paper,
            bright: this.bright,
            flash: this.flash,
            inkTransparent: this.inkTransparent,
            paperTransparent: this.paperTransparent
        };
    }

    /**
     * Get INK full color index with bright applied — index into the ACTIVE
     * palette (0-15 in fixed16 modes, 0-63 in ULAplus mode).
     * @returns {number}
     */
    getInkColorIndex() {
        return this.attrToIndices(this).ink;
    }

    /**
     * Get PAPER full color index with bright applied — index into the ACTIVE
     * palette (0-15 in fixed16 modes, 0-63 in ULAplus mode).
     * @returns {number}
     */
    getPaperColorIndex() {
        return this.attrToIndices(this).paper;
    }

    /**
     * Get INK RGB hex value from the active palette
     * @returns {string} Hex color string
     */
    getInkRGB() {
        return this.palette[this.getInkColorIndex()];
    }

    /**
     * Get PAPER RGB hex value from the active palette
     * @returns {string} Hex color string
     */
    getPaperRGB() {
        return this.palette[this.getPaperColorIndex()];
    }

    /**
     * Get INK RGB array from the active palette
     * @returns {Uint8Array} [r, g, b]
     */
    getInkRGBArray() {
        return this.getRGB(this.getInkColorIndex());
    }

    /**
     * Get PAPER RGB array from the active palette
     * @returns {Uint8Array} [r, g, b]
     */
    getPaperRGBArray() {
        return this.getRGB(this.getPaperColorIndex());
    }

    /**
     * Set complete color selection from object
     * @param {Object} selection - { ink, paper, bright, flash }
     */
    setSelection(selection) {
        if (!selection || typeof selection !== 'object') return;

        if (Validators.isValidBaseColor(selection.ink)) {
            this.ink = selection.ink;
        }
        if (Validators.isValidBaseColor(selection.paper)) {
            this.paper = selection.paper;
        }
        if (typeof selection.bright === 'boolean') {
            this.bright = selection.bright;
        }
        if (typeof selection.flash === 'boolean') {
            this.flash = selection.flash;
        }

        StateManager.setSection('color', {
            ink: this.ink,
            paper: this.paper,
            bright: this.bright,
            flash: this.flash
        });

        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
    }

    /**
     * Reset to default colors (black ink, white paper, no bright/flash, no transparency)
     */
    reset() {
        this.ink = 0;
        this.paper = 7;
        this.bright = false;
        this.flash = false;
        this.inkTransparent = false;
        this.paperTransparent = false;

        StateManager.setSection('color', this.getCurrentSelection());
        EventBus.emit(EVENTS.COLOR_INK, this.getCurrentSelection());
    }
}

// Export getColorIndex utility for use by other modules
window.getColorIndex = getColorIndex;

// Create singleton instance
window.ColorManager = new ColorManagerClass();

Logger.debug('ColorManager', 'Color manager loaded');

})(); // End IIFE
