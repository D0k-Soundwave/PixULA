'use strict';

/**
 * Input Validators
 * Validation functions for all user and system inputs
 */

/**
 * Valid zoom levels (percentages) - 100 to 1600 in steps of 100
 * @const {number[]}
 */
const ZOOM_LEVELS = Object.freeze([
    100, 200, 300, 400, 500, 600, 700, 800,
    900, 1000, 1100, 1200, 1300, 1400, 1500, 1600
]);

const Validators = {
    /**
     * Validate pixel X coordinate
     * @param {number} x - X coordinate
     * @returns {boolean}
     */
    isValidPixelX(x) {
        return Number.isInteger(x) && x >= 0 && x < ZX_SPECTRUM.WIDTH;
    },

    /**
     * Validate pixel Y coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    isValidPixelY(y) {
        return Number.isInteger(y) && y >= 0 && y < ZX_SPECTRUM.HEIGHT;
    },

    /**
     * Validate pixel coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    isValidPixelCoord(x, y) {
        return this.isValidPixelX(x) && this.isValidPixelY(y);
    },

    /**
     * Validate cell X coordinate
     * @param {number} x - Cell X
     * @returns {boolean}
     */
    isValidCellX(x) {
        return Number.isInteger(x) && x >= 0 && x < ZX_SPECTRUM.GRID_COLS;
    },

    /**
     * Validate cell Y coordinate
     * @param {number} y - Cell Y
     * @returns {boolean}
     */
    isValidCellY(y) {
        return Number.isInteger(y) && y >= 0 && y < ZX_SPECTRUM.GRID_ROWS;
    },

    /**
     * Validate cell coordinates
     * @param {number} x - Cell X
     * @param {number} y - Cell Y
     * @returns {boolean}
     */
    isValidCellCoord(x, y) {
        return this.isValidCellX(x) && this.isValidCellY(y);
    },

    /**
     * Validate base color index (0-7)
     * @param {number} color - Color index
     * @returns {boolean}
     */
    isValidBaseColor(color) {
        return Number.isInteger(color) && color >= 0 && color < 8;
    },

    /**
     * Validate INK color (0-7)
     * @param {number} ink - INK color
     * @returns {boolean}
     */
    isValidInk(ink) {
        return this.isValidBaseColor(ink);
    },

    /**
     * Validate PAPER color (0-7)
     * @param {number} paper - PAPER color
     * @returns {boolean}
     */
    isValidPaper(paper) {
        return this.isValidBaseColor(paper);
    },

    /**
     * Validate zoom level (100-1600 in steps of 100)
     * @param {number} zoom - Zoom percentage
     * @returns {boolean}
     */
    isValidZoom(zoom) {
        return Number.isInteger(zoom) && zoom >= 100 && zoom <= 1600 && zoom % 100 === 0;
    },

    /**
     * Validate attribute cell data
     * @param {Object} cell - Cell data
     * @returns {boolean}
     */
    isValidCellData(cell) {
        if (!cell || typeof cell !== 'object') return false;
        // Indexed-mode cells (Phase 13): per-pixel palette indices
        if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
            return cell.indices instanceof Int16Array &&
                   cell.indices.length === ZX_SPECTRUM.CELL_WIDTH * ZX_SPECTRUM.CELL_HEIGHT;
        }
        return this.isValidInk(cell.ink) &&
               this.isValidPaper(cell.paper) &&
               typeof cell.bright === 'boolean' &&
               typeof cell.flash === 'boolean' &&
               cell.pixels instanceof Uint8Array &&
               cell.pixels.length === ZX_SPECTRUM.CELL_HEIGHT;
    },

    /**
     * Validate a palette index for the active mode (Phase 13)
     * @param {number} index - Palette index
     * @returns {boolean}
     */
    isValidPaletteIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < ZX_SPECTRUM.PALETTE_SIZE;
    },

    /**
     * Validate undo limit
     * @param {number} limit - Undo limit
     * @returns {boolean}
     */
    isValidUndoLimit(limit) {
        return Number.isInteger(limit) && limit >= 1 && limit <= 500;
    },

    /**
     * Sanitize color index to base color (0-7)
     * @param {number} color - Color index
     * @returns {number}
     */
    sanitizeBaseColor(color) {
        const num = parseInt(color, 10);
        if (isNaN(num)) return 0;
        return clamp(num, 0, 7);
    }
};

// Expose to global scope
window.Validators = Validators;
window.ZOOM_LEVELS = ZOOM_LEVELS;
