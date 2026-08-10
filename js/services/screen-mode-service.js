'use strict';
(function() {

/**
 * ScreenModeService — owns runtime screen-mode switching (Phase 12a).
 *
 * The seam mechanism: constants.js holds the SCREEN_MODES registry and the
 * LIVE ACTIVE_SCREEN_MODE accessor with its low-level `__setActiveScreenMode`
 * setter (descriptor swap only). THIS service is the only caller of that
 * setter. It orchestrates everything a switch entails:
 *
 *   switchMode(id)    — user-facing switch: cancels any floating paste,
 *                       captures ONE undo action (so a single Undo restores
 *                       the previous mode AND content), converts every
 *                       layer's attribute grid between cell geometries,
 *                       re-derives the palette, rebuilds the canvases, and
 *                       announces EVENTS.SCREEN_MODE_CHANGED.
 *   applyModeRaw(id)  — restore path (undo/redo, autosave, file import):
 *                       swaps the descriptor and rebuilds the environment
 *                       WITHOUT converting content or touching undo — the
 *                       caller supplies content that already matches.
 *
 * Document conversion rules (ZX-Paintbrush semantics, help file
 * `sets_attribute_format_*.htm`):
 *   - Refining the attribute grid (8×8 -> 8×4/8×2/8×1) is LOSSLESS: each
 *     cell splits into sub-cells that inherit its attributes.
 *   - Coarsening (e.g. 8×1 -> 8×8) is LOSSY: pixels are kept verbatim, and
 *     each merged cell takes the MOST FREQUENT attribute byte among its
 *     altered source sub-cells ("the conversion checks the most used
 *     colours"); ties go to the first (topmost) occurrence. Unaltered
 *     source cells don't vote; a fully unaltered group stays unaltered.
 *   - fixed16 <-> ulaplus64 keeps every attribute bit verbatim (ZX-PB:
 *     "keeps the number of the palette" — FLASH/BRIGHT become the CLUT
 *     selector). Standard -> ULAplus is visually near-identical (default
 *     registers reproduce the standard palette); ULAplus -> fixed16 is
 *     LOSSY when the palette was edited (registers are dropped).
 *
 * Width conversion rules (Phase 12b — ZX-Paintbrush has no 512-px mode, so
 * these are ours, chosen to preserve the picture's appearance):
 *   - 256 -> 512 (into Timex hi-res): every pixel doubles horizontally, so
 *     the image looks the same at the new resolution; colour information
 *     collapses to the mono scheme — LOSSY.
 *   - 512 -> 256: horizontal pairs merge with OR (a set pixel in either
 *     column survives — lines never drop out) — LOSSY. Cell attributes of
 *     merged pairs vote like coarsening does.
 *   - When both the width and the cell height differ, the height converts
 *     first at the source width, then the width.
 *   - Leaving Timex hi-res, every altered cell (and the background) is
 *     stamped with the hi-res scheme's ink/paper (BRIGHT set), so the
 *     switched document looks exactly like the hi-res canvas did.
 *
 * GigaScreen rules (Phase 12b — ZX-PB has no GigaScreen; our model):
 *   - Layers carry a `gigaScreen` 0|1 tag (sub-screen A/B); entering
 *     GigaScreen tags nothing (everything starts on screen A) — LOSSLESS.
 *   - Leaving GigaScreen clears the tags, so both sub-screens' layers
 *     stack into one screen — LOSSY when any drawing layer sat on screen B.
 *
 * isConversionLossy(from, to) encodes exactly those rules so the UI can
 * warn before calling switchMode. Boot default stays STANDARD_ULA.
 */
class ScreenModeServiceClass {

    /** The active mode descriptor. */
    getMode() {
        return ACTIVE_SCREEN_MODE;
    }

    /** The active mode id string (e.g. 'standard_ula'). */
    getModeId() {
        return ACTIVE_SCREEN_MODE.id;
    }

    /** All registered descriptors, in registry order. */
    getModes() {
        return Object.keys(SCREEN_MODES).map(k => SCREEN_MODES[k]);
    }

    /**
     * Would switching lose information? (See conversion rules above.)
     * @param {string} fromId @param {string} toId
     * @returns {boolean}
     */
    isConversionLossy(fromId, toId) {
        const from = getScreenModeById(fromId);
        const to = getScreenModeById(toId);
        if (!from || !to || from === to) return false;
        // Pixel-depth changes (Phase 13): 1-bit -> indexed drops FLASH and
        // attribute editability; indexed -> 1-bit re-quantizes to 2 colours
        // per cell; 8bpp -> 4bpp collapses to 16 colours. All lossy.
        if ((from.pixelDepth || 1) !== (to.pixelDepth || 1)) return true;
        if (from.pixelDepth > 1 && to.pixelDepth > 1
            && (to.paletteSize || 256) < (from.paletteSize || 256)) return true;
        // Leaving the rgb333 palette family drops the register file's
        // edits (mirrors the ULAplus rule below).
        if (from.paletteModel === 'rgb333' && to.paletteModel !== 'rgb333'
            && window.ColorManager && ColorManager.isNextPaletteEdited()) {
            return true;
        }
        if (to.attrCellH > from.attrCellH) return true;
        if (to.width < from.width) return true;
        if (to.height < from.height) return true;
        if (to.paletteModel === 'timexMono' && from.paletteModel !== 'timexMono') {
            return true; // colours collapse to the mono scheme
        }
        if (from.paletteModel === 'ulaplus64' && to.paletteModel !== 'ulaplus64'
            && window.ColorManager && ColorManager.isUlaplusPaletteEdited()) {
            return true;
        }
        if ((from.screens || 1) === 2 && (to.screens || 1) !== 2
            && window.LayerManager
            && LayerManager.layers.some(l => !l.isBackground && l.gigaScreen === 1)) {
            return true; // screen-B layers merge into the single screen
        }
        return false;
    }

    /**
     * Convert one layer's attribute grid between two modes' cell
     * geometries. PURE — takes and returns plain attributeData arrays
     * (rows of cells { ink, paper, bright, flash, pixels, altered }),
     * touches no app state. Cells are one byte wide in every classic mode,
     * so height changes split/merge rows and width changes (Phase 12b —
     * Timex hi-res) double/halve the pixels within each row.
     * @param {Array} data - Source attributeData
     * @param {Object} from - Source mode descriptor
     * @param {Object} to - Target mode descriptor
     * @returns {Array} attributeData at the target geometry
     */
    convertAttributeData(data, from, to) {
        if (from.width !== to.width) {
            // Two steps: cell height first at the source width, then the
            // width (the intermediate descriptor is target-height/source-width).
            let heightConverted = data;
            if (from.attrCellH !== to.attrCellH) {
                const mid = {
                    width: from.width, height: to.height,
                    attrCellW: from.attrCellW, attrCellH: to.attrCellH
                };
                heightConverted = this.convertAttributeData(data, from, mid);
            }
            return to.width > from.width
                ? this._doubleGridWidth(heightConverted, to)
                : this._halveGridWidth(heightConverted, to);
        }

        const cols = to.width / to.attrCellW;
        const toRows = to.height / to.attrCellH;
        const out = [];

        if (from.attrCellH === to.attrCellH) {
            // Same geometry (palette-model-only switch) — deep copy
            for (let y = 0; y < toRows; y++) {
                const row = [];
                for (let x = 0; x < cols; x++) {
                    row.push(this._cloneCell(data[y][x]));
                }
                out.push(row);
            }
            return out;
        }

        if (to.attrCellH < from.attrCellH) {
            // Refining — split each source cell into k sub-cells (lossless)
            const k = from.attrCellH / to.attrCellH;
            for (let y = 0; y < toRows; y++) {
                const src = data[Math.floor(y / k)];
                const sub = y % k;
                const row = [];
                for (let x = 0; x < cols; x++) {
                    const s = src[x];
                    row.push({
                        ink: s.ink, paper: s.paper,
                        bright: s.bright, flash: s.flash,
                        pixels: new Uint8Array(
                            s.pixels.subarray(sub * to.attrCellH, (sub + 1) * to.attrCellH)),
                        altered: s.altered
                    });
                }
                out.push(row);
            }
            return out;
        }

        // Coarsening — merge k source cells per target cell (lossy attrs)
        const k = to.attrCellH / from.attrCellH;
        for (let y = 0; y < toRows; y++) {
            const row = [];
            for (let x = 0; x < cols; x++) {
                const sources = [];
                for (let i = 0; i < k; i++) {
                    sources.push(data[y * k + i][x]);
                }
                const pixels = new Uint8Array(to.attrCellH);
                for (let i = 0; i < k; i++) {
                    pixels.set(sources[i].pixels, i * from.attrCellH);
                }
                const winner = this._mostFrequentAttrs(sources);
                row.push({
                    ink: winner.ink, paper: winner.paper,
                    bright: winner.bright, flash: winner.flash,
                    pixels,
                    altered: sources.some(s => s.altered)
                });
            }
            out.push(row);
        }
        return out;
    }

    /**
     * The most frequent attribute byte among the ALTERED cells of a merge
     * group (ties -> first occurrence, scanning top to bottom). Falls back
     * to the first cell's attributes when nothing is altered.
     * @private
     */
    _mostFrequentAttrs(sources) {
        const counts = new Map();
        let best = null;
        let bestCount = 0;
        for (const s of sources) {
            if (!s.altered) continue;
            const key = (s.ink & 7) | ((s.paper & 7) << 3)
                | (s.bright ? 0x40 : 0) | (s.flash ? 0x80 : 0);
            const n = (counts.get(key) || 0) + 1;
            counts.set(key, n);
            if (n > bestCount) {
                bestCount = n;
                best = s;
            }
        }
        return best || sources[0];
    }

    /** @private */
    _cloneCell(c) {
        return {
            ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash,
            pixels: new Uint8Array(c.pixels), altered: c.altered
        };
    }

    /**
     * Double the grid's width (256 -> 512): every source cell splits into
     * two target cells, its pixels stretched 2× horizontally (high nibble ->
     * left cell, low nibble -> right cell); attributes copy to both halves.
     * @param {Array} grid - attributeData at the target cell height
     * @param {Object} to - Target mode descriptor
     * @returns {Array}
     * @private
     */
    _doubleGridWidth(grid, to) {
        const out = [];
        for (let y = 0; y < grid.length; y++) {
            const row = [];
            for (let x = 0; x < grid[y].length; x++) {
                const s = grid[y][x];
                const left = this._cloneCell(s);
                const right = this._cloneCell(s);
                for (let r = 0; r < s.pixels.length; r++) {
                    left.pixels[r] = ScreenModeServiceClass.DOUBLE_NIBBLE[s.pixels[r] >> 4];
                    right.pixels[r] = ScreenModeServiceClass.DOUBLE_NIBBLE[s.pixels[r] & 0x0F];
                }
                row.push(left, right);
            }
            out.push(row);
        }
        return out;
    }

    /**
     * Halve the grid's width (512 -> 256): horizontal pixel pairs merge
     * with OR (a set pixel in either column survives); each target cell's
     * attributes vote between its two source cells like coarsening does.
     * @param {Array} grid - attributeData at the target cell height
     * @param {Object} to - Target mode descriptor
     * @returns {Array}
     * @private
     */
    _halveGridWidth(grid, to) {
        const out = [];
        for (let y = 0; y < grid.length; y++) {
            const row = [];
            for (let x = 0; x < grid[y].length; x += 2) {
                const l = grid[y][x];
                const r = grid[y][x + 1];
                const winner = this._mostFrequentAttrs([l, r]);
                const pixels = new Uint8Array(l.pixels.length);
                for (let i = 0; i < pixels.length; i++) {
                    pixels[i] = (this._halveByte(l.pixels[i]) << 4)
                        | this._halveByte(r.pixels[i]);
                }
                row.push({
                    ink: winner.ink, paper: winner.paper,
                    bright: winner.bright, flash: winner.flash,
                    pixels,
                    altered: l.altered || r.altered
                });
            }
            out.push(row);
        }
        return out;
    }

    /** OR-merge a byte's bit pairs into a nibble (MSB-left). @private */
    _halveByte(b) {
        return ((b >> 6 | b >> 7) & 1) << 3
            | ((b >> 4 | b >> 5) & 1) << 2
            | ((b >> 2 | b >> 3) & 1) << 1
            | ((b | b >> 1) & 1);
    }

    // ─── Indexed-depth conversion (Phase 13) ───────────────────────────────
    //
    // Rules (ours — ZX-PB has no Next modes; chosen to preserve appearance,
    // consistent with the 12b width rules):
    //   - Geometry: per axis, an exact 2× difference resamples (×2 =
    //     replicate, ÷2 = merge, preferring a SET/ink source pixel so lines
    //     never drop out — the 12b OR-merge generalised); any other
    //     difference crops/pads at the top-left. So 256×192 <-> LoRes 128×96
    //     scales, 256×192 <-> 320×256 pads/crops.
    //   - 1-bit -> indexed: each visible pixel takes the nearest target-
    //     palette entry to its rendered colour (ink or paper of its cell,
    //     resolved through the source mode's palette model). Unaltered
    //     upper-layer cells stay transparent; altered cells paint their
    //     paper too (they were opaque in the classic compositor).
    //   - indexed -> 1-bit: per target cell, the most frequent colour
    //     becomes PAPER, the second INK (nearest classic-16 matches; BRIGHT
    //     from the ink pick, FLASH off); pixels map to whichever is nearer.
    //     Fully-transparent upper-layer cells stay unaltered.
    //   - indexed -> indexed: indices pass through; a smaller target palette
    //     window (4bpp modes) re-maps by nearest colour.

    /** Per-axis sample source coordinates for a target coordinate. @private */
    _axisSamples(t, fromN, toN) {
        if (toN === fromN * 2) return [t >> 1];
        if (toN * 2 === fromN) return [t * 2, t * 2 + 1];
        return [t];
    }

    /** Nearest palette index to an [r,g,b] within a paletteRGB list. @private */
    _nearestIndex(rgb, paletteRGB, cache) {
        const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
        const hit = cache.get(key);
        if (hit !== undefined) return hit;
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < paletteRGB.length; i++) {
            const p = paletteRGB[i];
            const dr = rgb[0] - p[0];
            const dg = rgb[1] - p[1];
            const db = rgb[2] - p[2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; best = i; }
        }
        cache.set(key, best);
        return best;
    }

    /**
     * Convert one layer's grid across a pixel-depth boundary (or between
     * two indexed geometries). Called with the SOURCE mode still active,
     * so source colours resolve through the live ColorManager.
     * @param {Layer} layer - Source layer (for isBackground and grid)
     * @param {Object} from - Source mode descriptor
     * @param {Object} to - Target mode descriptor
     * @returns {Array} attributeData at the target geometry/depth
     * @private
     */
    _convertDepthGrid(layer, from, to) {
        const fromDepth = from.pixelDepth || 1;
        const toDepth = to.pixelDepth || 1;
        const isBg = layer.isBackground;
        const data = layer.attributeData;

        // Sampled view of one source pixel: null = transparent/out-of-range,
        // else { rgb, set, index } (index only for indexed sources).
        const srcPixel = (x, y) => {
            if (x < 0 || y < 0 || x >= from.width || y >= from.height) return null;
            const cx = Math.floor(x / from.attrCellW);
            const cy = Math.floor(y / from.attrCellH);
            const cell = data[cy] && data[cy][cx];
            if (!cell) return null;
            if (fromDepth > 1) {
                const idx = cell.indices
                    ? cell.indices[(y % from.attrCellH) * from.attrCellW + (x % from.attrCellW)]
                    : -1;
                if (idx < 0) return isBg ? { rgb: ColorManager.getRGB(0), set: false, index: 0 } : null;
                return { rgb: ColorManager.getRGB(idx), set: true, index: idx };
            }
            if (!isBg && !cell.altered) return null;
            const set = ((cell.pixels[y % from.attrCellH] >> (7 - (x % from.attrCellW))) & 1) === 1;
            const t = ColorManager.attrToIndices(cell);
            return { rgb: ColorManager.getRGB(set ? t.ink : t.paper), set };
        };

        // One sample per target pixel: prefer a SET source pixel in the
        // covered block (merge rule), else the first in-range one.
        const sample = (tx, ty) => {
            const xs = this._axisSamples(tx, from.width, to.width);
            const ys = this._axisSamples(ty, from.height, to.height);
            let first = null;
            for (const sy of ys) {
                for (const sx of xs) {
                    const p = srcPixel(sx, sy);
                    if (p && p.set) return p;
                    if (p && !first) first = p;
                }
            }
            return first;
        };

        const cols = to.width / to.attrCellW;
        const rows = to.height / to.attrCellH;
        const cellW = to.attrCellW;
        const cellH = to.attrCellH;
        const out = [];
        const cache = new Map();

        if (toDepth > 1) {
            // Target palette: the register file the rebuild will seed/keep.
            const regs = (window.ColorManager && ColorManager.nextRegisters)
                ? ColorManager.nextRegisters : NEXTRGB333.defaultRegisters();
            const n = to.paletteSize || 256;
            const targetRGB = [];
            for (let i = 0; i < n; i++) targetRGB.push(NEXTRGB333.registerToRGB(regs[i]));
            const sameFamily = fromDepth > 1; // index passthrough when it fits

            for (let cy = 0; cy < rows; cy++) {
                const row = [];
                for (let cx = 0; cx < cols; cx++) {
                    const indices = new Int16Array(cellW * cellH).fill(isBg ? NEXTRGB333.DEFAULT_PAPER : -1);
                    let any = false;
                    for (let ly = 0; ly < cellH; ly++) {
                        for (let lx = 0; lx < cellW; lx++) {
                            const p = sample(cx * cellW + lx, cy * cellH + ly);
                            if (!p) continue;
                            any = true;
                            indices[ly * cellW + lx] = (sameFamily && p.index !== undefined && p.index < n)
                                ? p.index
                                : this._nearestIndex(p.rgb, targetRGB, cache);
                        }
                    }
                    row.push({
                        ink: 0, paper: 7, bright: false, flash: false,
                        pixels: new Uint8Array(cellH),
                        indices,
                        altered: isBg || any
                    });
                }
                out.push(row);
            }
            return out;
        }

        // indexed -> 1-bit: 2-colour re-quantization per target cell. A
        // ULAplus target quantizes against the (possibly just-seeded) 64
        // registers — per cell the cheapest CLUT + ink/paper slots, the
        // same picker PNG import uses. Every other target quantizes
        // against the classic 16 (the attribute BITS are classic
        // ink/paper/bright; rgb333 1-bit targets read them through their
        // default palettes, which reproduce the classics).
        const upRGB = (to.paletteModel === 'ulaplus64' && window.PaletteOps
            && window.ColorManager)
            ? Array.from(ColorManager.getUlaplusRegisters(),
                (r) => ULAPLUS.registerToRGB(r))
            : null;
        const dist = (a, b) => {
            const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
            return dr * dr + dg * dg + db * db;
        };
        for (let cy = 0; cy < rows; cy++) {
            const row = [];
            for (let cx = 0; cx < cols; cx++) {
                const block = [];
                for (let ly = 0; ly < cellH; ly++) {
                    for (let lx = 0; lx < cellW; lx++) {
                        block.push(sample(cx * cellW + lx, cy * cellH + ly));
                    }
                }
                const cell = {
                    ink: 0, paper: 7, bright: false, flash: false,
                    pixels: new Uint8Array(cellH), altered: false
                };
                if (block.some(p => p)) {
                    // Frequency-rank the block's colours
                    const counts = new Map();
                    for (const p of block) {
                        if (!p) continue;
                        const key = (p.rgb[0] << 16) | (p.rgb[1] << 8) | p.rgb[2];
                        counts.set(key, (counts.get(key) || 0) + 1);
                    }
                    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                    const toRGB = (key) => [key >> 16 & 255, key >> 8 & 255, key & 255];
                    const paperRGB = toRGB(ranked[0][0]);
                    const inkRGB = ranked.length > 1 ? toRGB(ranked[1][0]) : paperRGB;

                    if (upRGB) {
                        // Transparent samples count as the block's most
                        // frequent colour for CLUT scoring purposes
                        const cellRGB = new Float32Array(cellW * cellH * 3);
                        for (let i = 0; i < block.length; i++) {
                            const rgb = block[i] ? block[i].rgb : paperRGB;
                            cellRGB[i * 3] = rgb[0];
                            cellRGB[i * 3 + 1] = rgb[1];
                            cellRGB[i * 3 + 2] = rgb[2];
                        }
                        const pick = PaletteOps.chooseUlaplusCellPair(cellRGB, upRGB);
                        cell.ink = pick.inkSlot;
                        cell.paper = pick.paperSlot;
                        cell.bright = (pick.clut & 1) !== 0;
                        cell.flash = (pick.clut & 2) !== 0;
                        for (let ly = 0; ly < cellH; ly++) {
                            for (let lx = 0; lx < cellW; lx++) {
                                const p = block[ly * cellW + lx];
                                if (p && dist(p.rgb, pick.inkRGB) < dist(p.rgb, pick.paperRGB)) {
                                    cell.pixels[ly] |= 1 << (7 - lx);
                                }
                            }
                        }
                    } else {
                        const inkIdx = this._nearestIndex(inkRGB, ZX_PALETTE_RGB, cache);
                        cell.bright = inkIdx >= 8;
                        cell.ink = inkIdx & 7;
                        // Paper picked within the ink's bright half (one bright bit per cell)
                        const half = cell.bright ? ZX_PALETTE_RGB.slice(8, 16) : ZX_PALETTE_RGB.slice(0, 8);
                        const halfCache = new Map();
                        cell.paper = this._nearestIndex(paperRGB, half, halfCache);
                        for (let ly = 0; ly < cellH; ly++) {
                            for (let lx = 0; lx < cellW; lx++) {
                                const p = block[ly * cellW + lx];
                                if (p && dist(p.rgb, inkRGB) < dist(p.rgb, paperRGB)) {
                                    cell.pixels[ly] |= 1 << (7 - lx);
                                }
                            }
                        }
                    }
                    cell.altered = true;
                }
                if (isBg) cell.altered = true;
                row.push(cell);
            }
            out.push(row);
        }
        return out;
    }

    /**
     * Switch the document to another screen mode, converting content.
     * One undo action: undoing restores the previous mode and content.
     * The UI is responsible for warning first when isConversionLossy().
     * @param {string} id - Target mode id
     * @returns {boolean} True if the mode changed
     */
    switchMode(id) {
        const target = getScreenModeById(id);
        if (!target) {
            Logger.warn('ScreenModeService', `Unknown screen mode: ${id}`);
            return false;
        }
        const from = ACTIVE_SCREEN_MODE;
        if (target === from) return false;

        // A floating stamp straddles two geometries mid-drag — commit the
        // decision for the user by cancelling it (documented behaviour).
        if (window.SelectionService && SelectionService.isFloating
            && SelectionService.isFloating()) {
            SelectionService.cancelFloatingPaste();
        }

        UndoRedo.beginAction('Screen mode');

        // Seed the target mode's editable palette from the source BEFORE
        // converting — the depth converter quantizes against it, so the
        // converted pixels land on source-faithful colours.
        this._seedTargetPalette(from, target);

        // Convert every layer's grid at the OLD geometry, then swap.
        // Classic <-> classic keeps the pure cell-geometry conversion; any
        // switch involving an indexed mode (pixelDepth > 1, Phase 13) goes
        // through the depth converter, which needs the live source-palette
        // resolution (ColorManager) and so is not part of the pure API.
        const fromDepth = from.pixelDepth || 1;
        const targetDepth = target.pixelDepth || 1;
        const converted = (fromDepth === 1 && targetDepth === 1)
            ? LayerManager.layers.map(
                layer => this.convertAttributeData(layer.attributeData, from, target))
            : LayerManager.layers.map(
                layer => this._convertDepthGrid(layer, from, target));
        __setActiveScreenMode(target.id);
        LayerManager.layers.forEach((layer, i) => {
            layer.attributeData = converted[i];
        });

        // Leaving Timex hi-res: the mono canvas showed the scheme's colours,
        // not the (ignored) stored attributes — stamp the scheme onto every
        // altered cell and the background so the switched document looks
        // exactly like the hi-res canvas did (rule documented above).
        if (from.paletteModel === 'timexMono' && target.paletteModel !== 'timexMono'
            && targetDepth === 1 && window.ColorManager) {
            const ink = ColorManager.getTimexHiresInk();
            const paper = ink ^ 7;
            for (const layer of LayerManager.layers) {
                for (const row of layer.attributeData) {
                    for (const cell of row) {
                        if (!layer.isBackground && !cell.altered) continue;
                        cell.ink = ink;
                        cell.paper = paper;
                        cell.bright = true;
                        cell.flash = false;
                    }
                }
            }
        }

        // Leaving GigaScreen: clear the sub-screen tags — every layer now
        // stacks into the single screen (lossy when screen B had content;
        // isConversionLossy warned first).
        if ((from.screens || 1) === 2 && (target.screens || 1) !== 2) {
            LayerManager.layers.forEach(layer => { layer.gigaScreen = 0; });
        }

        this._rebuildEnvironment();

        UndoRedo.endAction();

        StateManager.markModified();
        EventBus.emit(EVENTS.SCREEN_MODE_CHANGED, { mode: target.id, previous: from.id });
        Logger.info('ScreenModeService', `Switched ${from.id} -> ${target.id}`);
        return true;
    }

    /**
     * Seed the TARGET mode's editable palette from the source document so
     * conversions land "as close to the source as possible". Runs inside
     * the mode switch's undo action with the SOURCE mode still active
     * (undo restores the previous registers with the previous mode). A
     * palette the user already edited in the target model is never
     * replaced. fixed16/timexMono sources need no seeding into rgb333 —
     * the default register file already holds the classics.
     * @param {Object} from - Source mode descriptor
     * @param {Object} to - Target mode descriptor
     * @private
     */
    _seedTargetPalette(from, to) {
        if (!window.ColorManager || !window.PaletteOps) return;

        // -> rgb333: carry an edited ULAplus palette into the register file
        // (the 64 G3R3B2 colours snap onto the 9-bit grid at entries 0–63;
        // the rest keep the defaults, so the classic slots survive).
        if (to.paletteModel === 'rgb333' && from.paletteModel === 'ulaplus64'
            && ColorManager.isUlaplusPaletteEdited()
            && !ColorManager.isNextPaletteEdited()) {
            const src = ColorManager.getUlaplusRegisters();
            const regs = NEXTRGB333.defaultRegisters();
            for (let i = 0; i < 64; i++) {
                const rgb = ULAPLUS.registerToRGB(src[i]);
                regs[i] = NEXTRGB333.rgbToRegister(rgb[0], rgb[1], rgb[2]);
            }
            ColorManager.setNextRegisters(regs);
            return;
        }

        if (to.paletteModel === 'ulaplus64' && from.paletteModel === 'rgb333'
            && !ColorManager.isUlaplusPaletteEdited()) {
            if ((from.pixelDepth || 1) > 1) {
                // Indexed source -> build a 64-register palette from the
                // composited image (the same Image2ULAplus pipeline PNG
                // import uses); the cell quantizer below then works with
                // source-faithful registers.
                const rgba = this._compositeRGBA(from);
                if (rgba) {
                    ColorManager.setUlaplusRegisters(PaletteOps.buildUlaplusRegisters(rgba));
                }
            } else if (ColorManager.isNextPaletteEdited()) {
                // ULANext (1-bit rgb333) -> ULAplus: the cell bits transfer
                // unchanged, so map the palette deterministically onto the
                // CLUT layout (CLUT = flash×2 + bright; ink from the ink
                // window, paper from 128+) — appearance is preserved.
                const next = ColorManager.getNextRegisters();
                const regs = new Uint8Array(64);
                for (let clut = 0; clut < 4; clut++) {
                    const brightOff = (clut & 1) ? 8 : 0;
                    for (let c = 0; c < 8; c++) {
                        const inkRGB = NEXTRGB333.registerToRGB(next[brightOff + c]);
                        const paperRGB = NEXTRGB333.registerToRGB(next[128 + brightOff + c]);
                        regs[clut * 16 + c] = ULAPLUS.rgbToRegister(inkRGB[0], inkRGB[1], inkRGB[2]);
                        regs[clut * 16 + 8 + c] =
                            ULAPLUS.rgbToRegister(paperRGB[0], paperRGB[1], paperRGB[2]);
                    }
                }
                ColorManager.setUlaplusRegisters(regs);
            }
        }
    }

    /**
     * Composite the visible document to screen-sized RGBA at the SOURCE
     * mode's geometry, resolved through the live source palette — the
     * input for palette generation. @private
     */
    _compositeRGBA(from) {
        const layer = LayerManager.flattenVisible();
        if (!layer) return null;
        const W = from.width, H = from.height;
        const cw = from.attrCellW, ch = from.attrCellH;
        const indexed = (from.pixelDepth || 1) > 1;
        const data = new Uint8ClampedArray(W * H * 4);
        for (let cy = 0; cy < H / ch; cy++) {
            for (let cx = 0; cx < W / cw; cx++) {
                const cell = layer.getCell(cx, cy);
                if (!cell) continue;
                const t = indexed ? null : ColorManager.attrToIndices(cell);
                for (let ly = 0; ly < ch; ly++) {
                    for (let lx = 0; lx < cw; lx++) {
                        let rgb;
                        if (indexed) {
                            const idx = cell.indices ? cell.indices[ly * cw + lx] : -1;
                            rgb = ColorManager.getRGB(idx >= 0 ? idx : NEXTRGB333.DEFAULT_PAPER);
                        } else {
                            const set = ((cell.pixels[ly] >> (7 - lx)) & 1) === 1;
                            rgb = ColorManager.getRGB(set ? t.ink : t.paper);
                        }
                        const o = ((cy * ch + ly) * W + (cx * cw + lx)) * 4;
                        data[o] = rgb[0];
                        data[o + 1] = rgb[1];
                        data[o + 2] = rgb[2];
                        data[o + 3] = 255;
                    }
                }
            }
        }
        return { width: W, height: H, data };
    }

    /**
     * Apply a mode WITHOUT converting content or touching undo — for
     * restore paths (undo/redo snapshots, autosave, file imports whose
     * byte length declares the mode). The caller replaces the document
     * content right after.
     * @param {string} id - Mode id
     * @returns {boolean} True if the mode changed
     */
    applyModeRaw(id) {
        const target = getScreenModeById(id);
        if (!target) {
            Logger.warn('ScreenModeService', `Unknown screen mode: ${id}`);
            return false;
        }
        const from = ACTIVE_SCREEN_MODE;
        if (target === from) return false;

        __setActiveScreenMode(target.id);
        // Content is about to be replaced by the caller; reset every
        // layer grid to the new geometry so nothing reads mixed shapes.
        LayerManager.layers.forEach(layer => layer.clear());
        this._rebuildEnvironment();

        EventBus.emit(EVENTS.SCREEN_MODE_CHANGED, { mode: target.id, previous: from.id });
        return true;
    }

    /**
     * Rebuild the mode-dependent environment after the descriptor swap:
     * scratch attribute grid, palette (+ CSS tokens), canvas stack, and a
     * full recompose. @private
     */
    _rebuildEnvironment() {
        AttributeSystem.clearAll();
        if (window.ColorManager) ColorManager.applyScreenMode();
        if (window.CanvasSystem && CanvasSystem.applyScreenMode) {
            CanvasSystem.applyScreenMode();
        }
        LayerManager.composeToCanvas();
    }
}

/** Nibble -> byte with every bit doubled (bit 3 -> bits 7,6 … bit 0 -> bits 1,0). */
ScreenModeServiceClass.DOUBLE_NIBBLE = (() => {
    const t = new Uint8Array(16);
    for (let n = 0; n < 16; n++) {
        let b = 0;
        for (let i = 0; i < 4; i++) {
            if (n & (1 << i)) b |= 0x03 << (i * 2);
        }
        t[n] = b;
    }
    return t;
})();

window.ScreenModeService = new ScreenModeServiceClass();

Logger.debug('ScreenModeService', 'Screen mode service loaded');

})();
