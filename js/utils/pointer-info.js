/**
 * PointerInfo - what the pointer readout says about a pixel (batch 3 part 3B).
 *
 * Pure: no DOM, no state. Every function takes the screen-mode descriptor, so
 * Node tests can try every mode without switching the app's. Memory bases and
 * the PLOT row count are in SPECTRUM_MEMORY (constants.js, with their sources).
 * The constants are read when a function runs, never at load: utils load before
 * constants.js.
 */
(function () {
'use strict';

/**
 * Offset of a scan line in the Spectrum display file (the interleave).
 * [P] ZX BASIC manual ch. 24: the screen is stored in three thirds of eight
 * character rows, each row's eight scan lines 256 bytes apart. The bit form
 * ((y & 0xC0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) is [C] from that, and
 * is the same one AttributeSystem, TimexFormat and MulticolorFormat use.
 */
function lineOffset(y) {
    return ((y & 0xC0) << 5) + ((y & 7) << 8) + ((y & 0x38) << 2);
}

class PointerInfoClass {
    /**
     * The BASIC PLOT Y of a screen row, or null where PLOT has no value:
     * outside the top PLOT_ROWS rows, or in a mode that is not the 256x192
     * one-bit screen PLOT draws on.
     * @param {Object} mode - a SCREEN_MODES entry
     * @param {number} y - row, 0 at the top
     * @returns {number|null}
     */
    plotY(mode, y) {
        const std = SCREEN_MODES.STANDARD_ULA;
        if (!mode || mode.pixelDepth > 1 || mode.width !== std.width || mode.height !== std.height) return null;
        if (!Number.isInteger(y) || y < 0 || y >= SPECTRUM_MEMORY.PLOT_ROWS) return null;
        return SPECTRUM_MEMORY.PLOT_ROWS - 1 - y;
    }

    /**
     * The attribute byte of a cell: FLASH 128 + BRIGHT 64 + PAPER * 8 + INK.
     * [P] ZX BASIC manual ch. 16 (ATTR). In ULAplus the top two bits are the
     * CLUT, which is flash * 2 + bright - the same number. Null where the mode
     * has no cell colours.
     * @param {Object} mode
     * @param {{ink: number, paper: number, bright: boolean, flash: boolean}} attrs
     * @returns {number|null}
     */
    attributeByte(mode, attrs) {
        if (!this._hasCells(mode) || !attrs) return null;
        return (attrs.flash ? 128 : 0) | (attrs.bright ? 64 : 0) | ((attrs.paper & 7) << 3) | (attrs.ink & 7);
    }

    /**
     * The attribute split into what it means in this mode, or null.
     *   fixed16: ink, paper, bright, flash
     *   clut (ULAplus): CLUT 0-3, ink, paper
     *   ulanext: the palette entries (ink = byte & 7, paper = 128 + (byte >> 3);
     *            [P] wiki.specnext.dev, read 2026-10-09)
     */
    attributeParts(mode, attrs) {
        const byte = this.attributeByte(mode, attrs);
        if (byte === null) return null;
        if (mode.paletteModel === 'ulaplus64') {
            return { kind: 'clut', clut: byte >> 6, ink: byte & 7, paper: (byte >> 3) & 7 };
        }
        if (mode.paletteModel === 'rgb333') {
            return { kind: 'ulanext', ink: byte & 7, paper: 128 + (byte >> 3) };
        }
        return { kind: 'fixed16', ink: byte & 7, paper: (byte >> 3) & 7, bright: !!(byte & 64), flash: !!(byte & 128) };
    }

    /**
     * Memory addresses of the byte holding pixel (x, y) and of its attribute
     * byte, in the modes with a fixed Spectrum layout; an empty list elsewhere.
     * Each entry: { screen: 'A'|'B'|null, bitmap, attr (number|null), where }.
     * @param {Object} mode
     * @param {number} x
     * @param {number} y
     * @returns {Array<{screen: ?string, bitmap: number, attr: ?number, where: string}>}
     */
    addresses(mode, x, y) {
        if (!mode) return [];
        const M = SPECTRUM_MEMORY;
        const off = lineOffset(y);
        const col = x >> 3;
        const cell = (y >> 3) * 32 + col;
        switch (mode.id) {
            case 'standard_ula':
            case 'ula_plus':
            case 'ulanext':
                return [{ screen: null, bitmap: M.DISPLAY_FILE + off + col, attr: M.ATTRIBUTES + cell, where: '48K' }];
            case 'multicolor_8x1':
            case 'ula_plus_8x1':
                return [{ screen: null, bitmap: M.DISPLAY_FILE + off + col,
                    attr: M.DFILE2 + off + col, where: 'Timex' }];
            case 'timex_hires':
                return [{ screen: null, bitmap: ((col & 1) ? M.DFILE2 : M.DISPLAY_FILE) + off + (col >> 1),
                    attr: null, where: 'Timex' }];
            case 'gigascreen':
                return [
                    { screen: 'A', bitmap: M.DISPLAY_FILE + off + col, attr: M.ATTRIBUTES + cell, where: 'bank 5' },
                    { screen: 'B', bitmap: M.BANK7 + off + col,
                        attr: M.BANK7 + M.ATTRIBUTES_OFFSET + cell, where: 'bank 7' }
                ];
            default:
                return [];
        }
    }

    /**
     * An address as the readout shows it: "$4890" (digits padded to `width`).
     * Built with no string replacement, so a "$" can never be read as a pattern.
     */
    hex(n, width = 4) {
        return '$' + n.toString(16).toUpperCase().padStart(width, '0');
    }

    /** Cell colours exist: 1-bit dots and not the Timex hi-res pair. @private */
    _hasCells(mode) {
        return !!mode && mode.pixelDepth <= 1 && mode.paletteModel !== 'timexMono';
    }
}

window.PointerInfo = new PointerInfoClass();

})();
