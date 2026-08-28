'use strict';

/**
 * Helper Utilities
 * Common utility functions used throughout the application
 */

/**
 * What joins a control's name to its description inside a `title`. One
 * constant, because composeTitle writes it and splitTitle reads it back.
 */
const TITLE_SEPARATOR = ' — ';

/** The base64 alphabet encodeBase64/decodeBase64 pack bytes against. */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const Helpers = {
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number}
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Localized message with an English fallback — for modules (io handlers,
     * services) that surface user-facing strings but must also run headless
     * (Node tests) or before I18n loads.
     * @param {string} key - i18n key
     * @param {string} fallback - English fallback
     * @returns {string}
     */
    localizedMessage(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    },

    /**
     * Whether the active screen mode has the standard 8×8-cell 256×192
     * layout — the non-throwing twin of assertStandardScreenLayout(), for
     * callers (a format's canExport()) that want a yes/no instead of a
     * catch block. GigaScreen shares Standard ULA's cell height, width and
     * pixel depth (its only difference is the second sub-screen), so the
     * `screens` check is required too — without it this returned true for
     * GigaScreen and every hasStandardScreenLayout()-gated canExport()
     * (tap/tzx/zed/sev) disagreed with its own export(), which still went
     * through SCRFormat.export()'s separate two-screens gate and threw.
     * @returns {boolean}
     */
    hasStandardScreenLayout() {
        return ZX_SPECTRUM.CELL_HEIGHT === SCREEN_MODES.STANDARD_ULA.attrCellH &&
            ZX_SPECTRUM.WIDTH === SCREEN_MODES.STANDARD_ULA.width &&
            ZX_SPECTRUM.PIXEL_DEPTH === 1 &&
            (ACTIVE_SCREEN_MODE.screens || 1) !== 2;
    },

    /**
     * Throw when the active screen mode lacks the standard 8×8-cell 256×192
     * layout — the shared gate for classic 6912-byte SCREEN$-family exports
     * (Phase 12a; multicolor modes have no SCREEN$ representation).
     */
    assertStandardScreenLayout() {
        if (!this.hasStandardScreenLayout()) {
            throw new Error(this.localizedMessage('mode.formatNeedsStandard',
                'This format needs a standard screen layout — switch to Standard ULA or ULAplus mode first.'));
        }
    },

    /**
     * Whether the active mode uses the classic 1-bit ink/paper cell model —
     * the non-throwing twin of assertClassicPixelModel().
     * @returns {boolean}
     */
    hasClassicPixelModel() {
        return ZX_SPECTRUM.PIXEL_DEPTH === 1;
    },

    /**
     * Throw (localized) unless the active mode uses the classic 1-bit
     * ink/paper cell model — the gate for classic-mode formats and
     * cell-attribute features under the indexed Next modes (Phase 13).
     */
    assertClassicPixelModel() {
        if (!this.hasClassicPixelModel()) {
            throw new Error(this.localizedMessage('mode.needsClassicPixels',
                'This works in the classic ink/paper modes only — the current mode uses indexed pixels.'));
        }
    },

    /**
     * Deep clone an object (JSON-safe objects only)
     * @param {Object} obj - Object to clone
     * @returns {Object}
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Shallow merge objects (creates new object)
     * @param {...Object} objects - Objects to merge
     * @returns {Object}
     */
    merge(...objects) {
        return Object.assign({}, ...objects);
    },

    /**
     * Generate a unique ID
     * @param {string} prefix - Optional prefix
     * @returns {string}
     */
    generateId(prefix = '') {
        const random = Math.random().toString(36).substring(2, 9);
        const timestamp = Date.now().toString(36);
        return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    },

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function}
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle a function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @returns {Function}
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Wait for a specified duration
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise}
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Convert degrees to radians
     * @param {number} degrees
     * @returns {number}
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    /**
     * Convert radians to degrees
     * @param {number} radians
     * @returns {number}
     */
    toDegrees(radians) {
        return radians * (180 / Math.PI);
    },

    /**
     * Linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number}
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Calculate distance between two points
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {number}
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Check if two rectangles overlap
     * @param {Object} r1 - { x, y, width, height }
     * @param {Object} r2 - { x, y, width, height }
     * @returns {boolean}
     */
    rectsOverlap(r1, r2) {
        return r1.x < r2.x + r2.width &&
               r1.x + r1.width > r2.x &&
               r1.y < r2.y + r2.height &&
               r1.y + r1.height > r2.y;
    },

    /**
     * Check if a point is inside a rectangle
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {Object} rect - { x, y, width, height }
     * @returns {boolean}
     */
    pointInRect(px, py, rect) {
        return px >= rect.x &&
               px < rect.x + rect.width &&
               py >= rect.y &&
               py < rect.y + rect.height;
    },

    /**
     * Format bytes to human-readable string
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Format a number with leading zeros
     * @param {number} num - Number to format
     * @param {number} digits - Total digits
     * @returns {string}
     */
    padNumber(num, digits) {
        return String(num).padStart(digits, '0');
    },

    /**
     * Get current timestamp in ISO format
     * @returns {string}
     */
    timestamp() {
        return new Date().toISOString();
    },

    /**
     * Create a 2D array filled with a value
     * @param {number} rows - Number of rows
     * @param {number} cols - Number of columns
     * @param {*} fill - Fill value or factory function
     * @returns {Array}
     */
    create2DArray(rows, cols, fill = null) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () =>
                typeof fill === 'function' ? fill() : fill
            )
        );
    },

    /**
     * Swap two values in an array
     * @param {Array} arr - Array
     * @param {number} i - First index
     * @param {number} j - Second index
     */
    swap(arr, i, j) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
    },

    /**
     * Remove duplicates from array
     * @param {Array} arr
     * @returns {Array}
     */
    unique(arr) {
        return [...new Set(arr)];
    },

    /**
     * Group array elements by a key function
     * @param {Array} arr - Array to group
     * @param {Function} keyFn - Function to get key
     * @returns {Object}
     */
    groupBy(arr, keyFn) {
        return arr.reduce((acc, item) => {
            const key = keyFn(item);
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
    },

    /**
     * Convert hex color to RGB object
     * @param {string} hex - Hex color (#RRGGBB or #RGB)
     * @returns {Object|null} { r, g, b }
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            };
        }
        const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if (short) {
            return {
                r: parseInt(short[1] + short[1], 16),
                g: parseInt(short[2] + short[2], 16),
                b: parseInt(short[3] + short[3], 16)
            };
        }
        return null;
    },

    /**
     * Convert RGB to hex color
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {string}
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    /**
     * Create an offscreen scratch canvas. The one sanctioned way for logic-layer
     * modules (services/tools) to get a canvas for raster math — they must not
     * touch the DOM themselves.
     * @param {number} width
     * @param {number} height
     * @returns {HTMLCanvasElement}
     */
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    },

    /**
     * Paint a 1-bit pattern into a canvas so that EVERY pattern pixel is exactly the
     * same number of device pixels — the one way patterns are previewed anywhere in
     * the app (library grid, library preview, Pattern Creator).
     *
     * Two things break a pattern preview, and both are fixed here rather than in each
     * caller. Fitting a tile to a fixed box scales by a fraction, so pattern pixels
     * land on 1.4 screen pixels and the artwork shears — the zoom is therefore always
     * an INTEGER, and the canvas is sized from the zoom rather than the zoom from the
     * canvas. And a backing store measured in CSS pixels is resampled again by the
     * display's device-pixel ratio (1.25 and 1.5 are the common Windows settings), so
     * the zoom is counted in DEVICE pixels and the CSS size derived back from it.
     *
     * The canvas holds a whole number of complete tiles: a preview that clips a tile
     * mid-motif tells the artist nothing about a pattern they have not seen before.
     *
     * @param {Uint8Array} bitmap 1 = ink, row-major
     * @param {number} w tile width in pattern pixels
     * @param {number} h tile height in pattern pixels
     * @param {Object} [opts]
     * @param {number} [opts.box=64] target size in CSS px; the result is the largest
     *                 whole number of tiles at an integer zoom that fits inside it
     * @param {number} [opts.minTiles=1] tiles to show along the shorter axis; 2 shows
     *                 the repeat, 1 shows the single tile as large as possible
     * @param {string} [opts.ink='#000'] ink colour
     * @param {string} [opts.paper='#fff'] paper colour
     * @returns {{canvas: HTMLCanvasElement, zoom: number, tilesX: number, tilesY: number, cssWidth: number, cssHeight: number}}
     */
    createPatternPreview(bitmap, w, h, opts = {}) {
        const box = opts.box || 64;
        const minTiles = Math.max(1, opts.minTiles || 1);
        const ink = opts.ink || '#000';
        const paper = opts.paper || '#fff';
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

        // Zoom is device pixels per pattern pixel, so it survives fractional DPR.
        const budget = box * dpr;
        const zoom = Math.max(1, Math.floor(budget / (Math.max(w, h) * minTiles)));
        const tilesX = Math.max(1, Math.floor(budget / (w * zoom)));
        const tilesY = Math.max(1, Math.floor(budget / (h * zoom)));

        const deviceW = tilesX * w * zoom;
        const deviceH = tilesY * h * zoom;
        const canvas = this.createCanvas(deviceW, deviceH);
        canvas.style.width = `${deviceW / dpr}px`;
        canvas.style.height = `${deviceH / dpr}px`;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, deviceW, deviceH);
        ctx.fillStyle = ink;
        // One fillRect per ink pixel of one tile, repeated: at these sizes that is a
        // few thousand rects worst case, and it keeps the edges exactly on the grid.
        for (let ty = 0; ty < tilesY; ty++) {
            for (let tx = 0; tx < tilesX; tx++) {
                const ox = tx * w * zoom;
                const oy = ty * h * zoom;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        if (!bitmap[y * w + x]) continue;
                        ctx.fillRect(ox + x * zoom, oy + y * zoom, zoom, zoom);
                    }
                }
            }
        }
        return { canvas, zoom, tilesX, tilesY, cssWidth: deviceW / dpr, cssHeight: deviceH / dpr };
    },

    /**
     * Save data to a file, preferring a real native Save dialog.
     *
     * `showSaveFilePicker` gives the artist an actual OS dialog - a real
     * folder to navigate, a real filename to edit, no silent drop into
     * Downloads - the same File System Access API `ImageSource`/
     * `BackupService` already use for Open/folder pickers on this exact
     * `file://` app (so it is known to work here, not just in theory).
     * The anchor-click/blob-download trick below only ever gave the
     * browser's OWN download location with zero choice - kept as the
     * fallback for engines without the API (Firefox, Safari) and for the
     * rare case the native call itself throws for a reason other than the
     * artist cancelling.
     * @param {Blob|string} data - Data to save
     * @param {string} filename - Suggested filename
     * @param {string} mimeType - MIME type (for string data)
     * @param {?FileSystemFileHandle} [handle] - a location already chosen by
     *   an EARLIER showSaveFilePicker() call (e.g. FileManager picking the
     *   format from the extension the artist typed) - write straight there
     *   instead of opening a SECOND, redundant native dialog for the same
     *   information.
     * @returns {Promise<boolean>} false only if the artist cancelled the
     *   native picker - a fallback download always "succeeds" from here
     */
    async downloadFile(data, filename, mimeType = 'application/octet-stream', handle = null) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });

        if (handle) {
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        }

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const dot = filename.lastIndexOf('.');
                const ext = dot > 0 ? filename.slice(dot) : '';
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: ext ? [{ description: ext.slice(1).toUpperCase(), accept: { [mimeType]: [ext] } }] : undefined
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return true;
            } catch (error) {
                if (error && error.name === 'AbortError') return false; // the artist cancelled
                Logger.warn('Helpers', 'showSaveFilePicker failed; falling back to a browser download', error);
                // fall through to the anchor-click path below
            }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    },

    /**
     * Read a file as ArrayBuffer
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>}
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Read a file as text
     * @param {File} file - File to read
     * @returns {Promise<string>}
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },

    /**
     * Read a file as DataURL
     * @param {File} file - File to read
     * @returns {Promise<string>}
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Escape a string for safe insertion into innerHTML
     * @param {string} str
     * @returns {string}
     */
    escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Translate a key with an English fallback for the window between a
     * component building its DOM and I18n resolving (boot order, and the
     * data-i18n attributes re-apply on every locale change anyway).
     * @private-ish — the caption helpers below are the usual entry points.
     */
    tr(i18nKey, fallback) {
        return (window.I18n && typeof I18n.t === 'function' &&
            I18n.t(i18nKey) !== i18nKey) ? I18n.t(i18nKey) : fallback;
    },

    /**
     * The caption that names an icon button. It sits OUTSIDE the button, above
     * it, so the icon control keeps its own square size — see .btn-captioned
     * in css/components.css. Captions are ONE keyword: where a control's own
     * label is longer, the registry/caller passes a short `cap.*` key instead,
     * and the full name lives in the tooltip (see composeTitle).
     * @param {string} i18nKey  caption key (kept in data-i18n, so a locale
     *                          switch re-translates it in place)
     * @param {string} fallback English text used until i18n resolves
     * @returns {string} HTML for the caption span
     */
    captionHTML(i18nKey, fallback) {
        return `<span class="btn-label" data-i18n="${i18nKey}">${this.escapeHTML(this.tr(i18nKey, fallback))}</span>`;
    },

    /**
     * Wrap already-built button markup in a captioned column.
     * @param {string} buttonHTML markup for the control itself
     * @returns {string} HTML for the caption + control
     */
    captionedButton(buttonHTML, i18nKey, fallback) {
        return `<span class="btn-captioned">${this.captionHTML(i18nKey, fallback)}${buttonHTML}</span>`;
    },

    /**
     * One button in the small brush/eraser/line/fill toolset shared by the
     * Pattern Creator, Font Editor, Map Editor and Sprite Editor dialogs'
     * CellGridEditor surface. Previously hand-copied identically into each
     * with no hover hint in any copy — this is the one source of truth now,
     * so the dialogs cannot drift from each other again.
     * @param {string} tool         CellGridEditor tool id: 'brush'|'eraser'|'line'|'fill'
     * @param {string} letter       single-glyph icon shown on the button
     * @param {string} nameKey      i18n key for the button's name
     * @param {string} nameFallback English fallback for the name
     * @param {string} hintKey      i18n key for the "how it works" sentence
     * @param {string} hintFallback English fallback for the hint
     * @param {boolean} [active]    initial active state
     * @returns {string} HTML for the captioned button
     */
    miniToolButton(tool, letter, nameKey, nameFallback, hintKey, hintFallback, active = false) {
        const name = this.tr(nameKey, nameFallback);
        const hint = this.tr(hintKey, hintFallback);
        const title = this.composeTitle(name, hint);
        const cls = 'tool-btn' + (active ? ' active' : '');
        return `<span class="btn-captioned">${this.captionHTML(nameKey, nameFallback)}` +
            `<button type="button" data-tool="${tool}" class="${cls}" ` +
            `data-i18n-title-name="${nameKey}" data-i18n-title="${hintKey}" data-i18n-aria-label="${nameKey}" ` +
            `aria-label="${this.escapeHTML(name)}" title="${this.escapeHTML(title)}">` +
            `<span class="tool-icon">${letter}</span></button></span>`;
    },

    /**
     * The DOM-builder counterpart: returns the wrapper holding the caption and
     * `el`. Callers keep their own reference to `el` (state, events); only the
     * wrapper is appended.
     * @param {HTMLElement} el
     * @returns {HTMLElement} wrapper
     */
    captionWrap(el, i18nKey, fallback) {
        const wrap = document.createElement('span');
        wrap.className = 'btn-captioned';
        const label = document.createElement('span');
        label.className = 'btn-label';
        label.dataset.i18n = i18nKey;
        label.textContent = this.tr(i18nKey, fallback);
        wrap.appendChild(label);
        wrap.appendChild(el);
        return wrap;
    },

    /**
     * The compass-style four-zone directional pad: one hollow zone per
     * direction (up/left/right/down), filled solid on hover/focus to say
     * which way it will move something - see the .dir-pad rule in
     * css/components.css. Shared by the Transform panel's Shift group and
     * the Reference panel's Offset nudges, which is the point of pulling it
     * out here: both places used to build this control independently (a
     * static template string in one, a DOM-built closure in the other) and
     * had to be hand-updated in lockstep on every redesign. Callers wire
     * their own click handlers onto the returned zone buttons and decide
     * their own enable/disable state; this only builds the shared markup.
     * @returns {{element: HTMLElement, zones: {up: HTMLButtonElement, left: HTMLButtonElement, right: HTMLButtonElement, down: HTMLButtonElement}}}
     */
    buildDirPad() {
        const pad = document.createElement('div');
        pad.className = 'dir-pad';

        const ZONES = [
            { dir: 'up',    icon: 'icon-dirpad-up',    i18n: 'dirpad.up',    fallback: 'Shift up' },
            { dir: 'left',  icon: 'icon-dirpad-left',  i18n: 'dirpad.left',  fallback: 'Shift left' },
            { dir: 'right', icon: 'icon-dirpad-right', i18n: 'dirpad.right', fallback: 'Shift right' },
            { dir: 'down',  icon: 'icon-dirpad-down',  i18n: 'dirpad.down',  fallback: 'Shift down' }
        ];

        const zones = {};
        for (const z of ZONES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `dir-pad-zone dir-pad-zone-${z.dir}`;
            btn.dataset.i18nAriaLabel = z.i18n;
            btn.setAttribute('aria-label', this.tr(z.i18n, z.fallback));
            // innerHTML, not a raw arrow character: tests/lint-architecture.test.js
            // flags a pictograph wherever it appears in js/ source.
            btn.innerHTML = `<svg class="dir-pad-glyph" aria-hidden="true"><use href="#${z.icon}"/></svg>`;
            pad.appendChild(btn);
            zones[z.dir] = btn;
        }

        return { element: pad, zones };
    },

    /**
     * Turn a set of pixels into SVG path data — one subpath per horizontal RUN
     * of set pixels, so a 100-pixel icon is a handful of commands rather than
     * 100 rects.
     *
     * SVG rather than a canvas because these are ICONS: a path inherits
     * `currentColor` the way the sprite symbols do (so a pixel icon goes white
     * on a selected button without anyone tracking the theme), and it stays
     * crisp at any device-pixel ratio, which a fixed-size backing store does
     * not. Pair it with shape-rendering="crispEdges" — the runs abut exactly,
     * and antialiasing would draw a seam between them.
     * @param {Array<{x: number, y: number}>} pixels
     * @returns {string} path data, '' for an empty set
     */
    pixelsToPath(pixels) {
        if (!pixels || !pixels.length) return '';

        // Row-major order is what makes a run a run.
        const sorted = [...pixels].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const parts = [];
        let runY = sorted[0].y, runX = sorted[0].x, runLen = 1;

        const flush = () => parts.push(`M${runX} ${runY}h${runLen}v1h-${runLen}z`);

        for (let i = 1; i < sorted.length; i++) {
            const p = sorted[i];
            if (p.y === runY && p.x === runX + runLen) { runLen++; continue; }
            if (p.y === runY && p.x === runX + runLen - 1) continue;   // duplicate
            flush();
            runY = p.y; runX = p.x; runLen = 1;
        }
        flush();
        return parts.join('');
    },

    /**
     * The TOOL_GROUPS entry for a rail id, or null.
     *
     * A rail id is what the artist points at, and it is not always a tool
     * INSTANCE: the brush variants and the shape variants ride on one class
     * each, so `ToolManager.getTool('spray')` hands back the brush. Anything
     * that needs a tool's own label, icon or group has to come here, and it
     * lives in one place because three components ask (the options panel title,
     * the tool preset bar, the Presets panel) and a fourth will.
     * @param {string} toolId rail id
     * @returns {Object|null}
     */
    toolRailMeta(toolId) {
        if (!toolId) return null;
        for (const group of TOOL_GROUPS) {
            for (const meta of group.tools) {
                if (meta.id === toolId) return meta;
            }
        }
        return null;
    },

    /**
     * The tooltip for an icon button: the FULL name, its shortcut, then what it
     * does. I18n recomposes this on a locale change from the
     * data-i18n-title-name / data-i18n-title / data-shortcut attributes, so
     * this join lives in one place.
     * @param {string} name full control name
     * @param {string} [hint] description of what it does (dropped if it just
     *                        repeats the name)
     * @param {string} [shortcut] keyboard shortcut, e.g. 'B'
     */
    composeTitle(name, hint, shortcut) {
        let title = shortcut ? `${name} (${shortcut})` : name;
        if (hint && hint !== name && !hint.startsWith(`${name} (`)) {
            title += `${TITLE_SEPARATOR}${hint}`;
        }
        return title;
    },

    /**
     * Take a composed title back apart, so the fly-out tooltip can show the
     * name first and the description only on a longer hover. The separator is
     * the one composeTitle joined with — split and join are deliberately
     * neighbours, because a title built here is read back there.
     *
     * Only the FIRST separator splits: a description may legitimately contain
     * one of its own ("Confine every tool to the selection — drawing stops at
     * its edge").
     * @param {string} title
     * @returns {{name: string, desc: string}}
     */
    splitTitle(title) {
        const text = (title || '').trim();
        const at = text.indexOf(TITLE_SEPARATOR);
        if (at < 0) return { name: text, desc: '' };
        return {
            name: text.slice(0, at).trim(),
            desc: text.slice(at + TITLE_SEPARATOR.length).trim()
        };
    },

    /**
     * Fill `{param}` placeholders in text with values from `params`. This is
     * the same substitution I18nClass.t() runs on a resolved translation —
     * needed here too because a component's own `_t(key, fallback, params)`
     * wrapper returns `fallback` UN-interpolated when I18n is not ready yet or
     * the key is missing, so the caller must still fill it in by hand.
     * @param {string} text
     * @param {Object} [params]
     * @returns {string}
     */
    interpolate(text, params) {
        return String(text).replace(/\{(\w+)\}/g,
            (match, key) => (params && params[key] !== undefined ? params[key] : match));
    },

    /**
     * Encode bytes as base64. The one implementation ClipboardCodec,
     * FontCodec and MapCodec each carried their own byte-identical copy of,
     * for the same reason as everywhere else in this file: a fix to one
     * would not have reached the other two.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    encodeBase64(bytes) {
        const T = BASE64_ALPHABET;
        let out = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
            const n = (b0 << 16) | ((b1 || 0) << 8) | (b2 || 0);
            out += T[(n >> 18) & 63] + T[(n >> 12) & 63];
            out += i + 1 < bytes.length ? T[(n >> 6) & 63] : '=';
            out += i + 2 < bytes.length ? T[n & 63] : '=';
        }
        return out;
    },

    /**
     * Decode a string produced by encodeBase64(); null on malformed input.
     * @param {string} str
     * @returns {Uint8Array|null}
     */
    decodeBase64(str) {
        if (typeof str !== 'string' || str.length % 4 !== 0) return null;
        const T = BASE64_ALPHABET;
        const pad = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
        const out = new Uint8Array((str.length / 4) * 3 - pad);
        let o = 0;
        for (let i = 0; i < str.length; i += 4) {
            const idx = [0, 1, 2, 3].map(k => {
                const ch = str[i + k];
                return ch === '=' ? 0 : T.indexOf(ch);
            });
            if (idx.some(v => v < 0)) return null;
            const n = (idx[0] << 18) | (idx[1] << 12) | (idx[2] << 6) | idx[3];
            if (o < out.length) out[o++] = (n >> 16) & 0xFF;
            if (o < out.length) out[o++] = (n >> 8) & 0xFF;
            if (o < out.length) out[o++] = n & 0xFF;
        }
        return out;
    },

    /**
     * The screen-mode tooltip: name, exact canvas size and attribute layout,
     * how many colours are on screen at once, whether the palette is
     * editable, and what machine the mode belongs to. Every number is read
     * from the SCREEN_MODES descriptor (never retyped into a string), so a
     * new mode needs one `mode.desc.*` prose key and nothing else. Both entry
     * points — the Image-menu radios and the status-bar selector — render
     * through this one composer, and I18n re-runs it on a locale change via
     * the data-i18n-mode-title attribute.
     * @param {Object} mode descriptor from SCREEN_MODES
     * @returns {string} multi-line tooltip text ('' for an unknown mode)
     */
    describeScreenMode(mode) {
        if (!mode) return '';
        const t = (key, params) =>
            (window.I18n && typeof I18n.t === 'function') ? I18n.t(key, params) : key;

        const depth = mode.pixelDepth || 1;
        const colours = mode.paletteModel === 'fixed16' ? 15
            : mode.paletteModel === 'timexMono' ? 2
                : (mode.paletteSize || 16);

        // Timex hi-res carries attribute bytes but the ULA ignores them —
        // the whole screen shares one colour pair, so saying "8×8 cells"
        // would be a lie.
        const cells = depth > 1
            ? t('mode.info.indexed', { bpp: depth })
            : mode.paletteModel === 'timexMono'
                ? t('mode.info.cellsIgnored')
                : t('mode.info.cells', { cw: mode.attrCellW, ch: mode.attrCellH });

        const paletteKey = {
            fixed16: 'mode.info.paletteFixed',
            timexMono: 'mode.info.paletteSchemes',
            ulaplus64: 'mode.info.paletteUlaplus',
            rgb333: 'mode.info.paletteNext'
        }[mode.paletteModel] || 'mode.info.paletteFixed';

        return [
            t(mode.i18n),
            t('mode.info.summary', {
                w: mode.width, h: mode.height, cells, colours, bytes: mode.fileSize
            }),
            t(paletteKey, { colours }),
            // 'mode.standardUla' -> 'mode.desc.standardUla'
            t(mode.i18n.replace('mode.', 'mode.desc.'))
        ].join('\n');
    }
};

// Global clamp function for convenience
function clamp(value, min, max) {
    return Helpers.clamp(value, min, max);
}

/**
 * Floyd-Steinberg error-diffusion dithering on a 2D coverage map.
 * @param {number[][]} coverage - 2D array of [0,1] values (0=ink, 1=paper)
 * @param {number} w
 * @param {number} h
 * @returns {boolean[][]} true = ink pixel
 */
function floydSteinbergDither(coverage, w, h) {
    const buf = coverage.map(row => row.slice());
    const out = Array.from({ length: h }, () => new Array(w).fill(false));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const old = buf[y][x];
            const newV = old < 0.5 ? 0 : 1;
            out[y][x] = newV === 0;
            const err = old - newV;
            if (x + 1 < w)           buf[y][x + 1]           += err * 7 / 16;
            if (y + 1 < h) {
                if (x > 0)            buf[y + 1][x - 1]       += err * 3 / 16;
                                      buf[y + 1][x]           += err * 5 / 16;
                if (x + 1 < w)        buf[y + 1][x + 1]       += err * 1 / 16;
            }
        }
    }
    return out;
}

// Expose to global scope
window.Helpers = Helpers;
window.clamp = clamp;
window.floydSteinbergDither = floydSteinbergDither;
