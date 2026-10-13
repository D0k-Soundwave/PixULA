'use strict';

/**
 * MapFind - the pure engine behind "find repeated elements" (Batch 11A). No DOM, no services.
 *
 * Data shapes. A SCREEN or a BLOCK is { w, h, cellH, screens, bitmap, attrs }: w x h attribute cells, each `cellH` dot rows of one byte (MSB =
 * leftmost dot, the same layout as layer cell.pixels), `screens` = 1 (ZX Spectrum) or 2 (GigaScreen and the Timex hi-res pair); `bitmap` holds
 * screens x w x h x cellH bytes and `attrs` screens x w x h attribute bytes, cells in reading order, screen A first.
 *
 * Three ways to say two cells are "the same" (ZX Paintbrush's):
 *   'exact'   the dots and the attribute bytes of every screen are equal;
 *   'dots'    the dots are equal, whatever the colours;
 *   'visual'  every dot shows the same colour in BOTH flash phases. A dot's colour is the pair (colour in the steady phase, colour in the inverted
 *             phase), taken from a COLOUR TABLE built from the live palette; with two screens the two dots are blended per phase,
 *             (a + b) >> 1 per channel, as the compositor does. Two cells match when their dots' colour pairs are equal up to renaming, which
 *             is what a canonical key by first appearance gives. It is independent of every display toggle on purpose.
 */
const MapFind = {
    MODES: Object.freeze(['exact', 'dots', 'visual']),

    /** An empty screen or block. */
    make(w, h, cellH, screens) {
        return { w, h, cellH, screens, bitmap: new Uint8Array(screens * w * h * cellH), attrs: new Uint8Array(screens * w * h) };
    },

    /** The w x h block of cells at (x, y) of a screen, as a block of its own. */
    slice(scr, x, y, w, h) {
        const out = this.make(w, h, scr.cellH, scr.screens);
        const cells = scr.w * scr.h, bcells = w * h;
        for (let p = 0; p < scr.screens; p++) {
            for (let cy = 0; cy < h; cy++) {
                for (let cx = 0; cx < w; cx++) {
                    const si = p * cells + (y + cy) * scr.w + (x + cx);
                    const bi = p * bcells + cy * w + cx;
                    out.attrs[bi] = scr.attrs[si];
                    for (let r = 0; r < scr.cellH; r++) out.bitmap[bi * scr.cellH + r] = scr.bitmap[si * scr.cellH + r];
                }
            }
        }
        return out;
    },

    /**
     * The colour table: for each plane (screen) and attribute byte, the 24-bit colour a set and a clear dot shows in the steady phase and in the
     * inverted (FLASH) phase.
     * @param {number} planes - 1 or 2
     * @param {function(number, number): {ink:number, paper:number, flashing:boolean}} resolve - (plane, attr) -> 24-bit colours
     */
    tableFrom(planes, resolve) {
        const data = new Uint32Array(planes * 256 * 4);
        for (let p = 0; p < planes; p++) {
            for (let a = 0; a < 256; a++) {
                const r = resolve(p, a);
                const o = (p * 256 + a) * 4;
                data[o] = r.paper;                              // clear dot, steady
                data[o + 1] = r.flashing ? r.ink : r.paper;     // clear dot, inverted phase
                data[o + 2] = r.ink;                            // set dot, steady
                data[o + 3] = r.flashing ? r.paper : r.ink;     // set dot, inverted phase
            }
        }
        return { planes, data, at: (plane, attr, bit, phase) => data[(plane * 256 + attr) * 4 + bit * 2 + phase] };
    },

    /** (a + b) >> 1 per channel of two 24-bit colours (the GigaScreen blend). */
    blend(a, b) {
        return ((((a >> 16) & 255) + ((b >> 16) & 255)) >> 1) << 16 | ((((a >> 8) & 255) + ((b >> 8) & 255)) >> 1) << 8 | (((a & 255) + (b & 255)) >> 1);
    },

    /**
     * One id per cell, in reading order, for a screen or a block. Equal ids mean "the same" under the mode. Ids come from `interner` (a Map), so a
     * screen and a block that share one interner share ids.
     * @returns {Int32Array}
     */
    ids(data, mode, table, interner) {
        const cells = data.w * data.h, H = data.cellH, S = data.screens;
        const out = new Int32Array(cells);
        for (let c = 0; c < cells; c++) {
            let key;
            if (mode === 'visual') {
                const labels = {};
                let next = 0, codes = '', pairs = '';
                for (let r = 0; r < H; r++) {
                    for (let b = 7; b >= 0; b--) {
                        let c0, c1;
                        if (S === 1) {
                            const bit = (data.bitmap[c * H + r] >> b) & 1;
                            const a = data.attrs[c];
                            c0 = table.at(0, a, bit, 0); c1 = table.at(0, a, bit, 1);
                        } else {
                            const bitA = (data.bitmap[c * H + r] >> b) & 1;
                            const bitB = (data.bitmap[(cells + c) * H + r] >> b) & 1;
                            const aA = data.attrs[c], aB = data.attrs[cells + c];
                            c0 = this.blend(table.at(0, aA, bitA, 0), table.at(1, aB, bitB, 0));
                            c1 = this.blend(table.at(0, aA, bitA, 1), table.at(1, aB, bitB, 1));
                        }
                        const pk = c0 * 16777216 + c1;
                        let l = labels[pk];
                        if (l === undefined) { l = next++; labels[pk] = l; pairs += pk + ','; }
                        codes += String.fromCharCode(97 + l);
                    }
                }
                key = codes + '|' + pairs;
            } else {
                let parts = '';
                for (let p = 0; p < S; p++) {
                    if (mode === 'exact') parts += data.attrs[p * cells + c] + ':';
                    const o = (p * cells + c) * H;
                    for (let r = 0; r < H; r++) parts += data.bitmap[o + r] + ',';
                    parts += ';';
                }
                key = parts;
            }
            let id = interner.get(key);
            if (id === undefined) { id = interner.size; interner.set(key, id); }
            out[c] = id;
        }
        return out;
    },

    /** Every cell position where the block's id grid appears in the screen's, in reading order. */
    search(screenIds, cols, rows, blockIds, bw, bh) {
        const out = [];
        for (let y = 0; y + bh <= rows; y++) {
            for (let x = 0; x + bw <= cols; x++) {
                let ok = true;
                for (let by = 0; by < bh && ok; by++) {
                    const so = (y + by) * cols + x, bo = by * bw;
                    for (let bx = 0; bx < bw; bx++) if (screenIds[so + bx] !== blockIds[bo + bx]) { ok = false; break; }
                }
                if (ok) out.push({ x, y });
            }
        }
        return out;
    },

    /**
     * Find a block in a screen.
     * @param {Object} scr - screen
     * @param {Object} block - block (same cell height and screen count)
     * @param {string} mode - 'exact' | 'dots' | 'visual'
     * @param {?Object} table - from tableFrom (needed by 'visual')
     * @returns {?{x:number,y:number}[]} places in reading order, or null if the block cannot be compared with the screen
     */
    find(scr, block, mode, table) {
        if (!this.MODES.includes(mode) || !scr || !block) return null;
        if (scr.cellH !== block.cellH || scr.screens !== block.screens) return null;
        if (mode === 'visual' && (!table || table.planes < scr.screens)) return null;
        if (block.w > scr.w || block.h > scr.h || block.w < 1 || block.h < 1) return [];
        const interner = new Map();
        const blockIds = this.ids(block, mode, table, interner);
        const screenIds = this.ids(scr, mode, table, interner);
        return this.search(screenIds, scr.w, scr.h, blockIds, block.w, block.h);
    },

    /**
     * Places that do not overlap each other: the source first, then the rest in reading order, each kept only if it touches none already kept.
     * @param {{x:number,y:number}[]} positions
     * @param {number} w @param {number} h - the block size in cells
     * @param {{x:number,y:number}} source
     */
    disjoint(positions, w, h, source) {
        const sorted = positions.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const ordered = [];
        if (source && sorted.some(p => p.x === source.x && p.y === source.y)) ordered.push({ x: source.x, y: source.y });
        for (const p of sorted) if (!source || p.x !== source.x || p.y !== source.y) ordered.push(p);
        const kept = [];
        for (const p of ordered) {
            if (kept.every(q => p.x + w <= q.x || q.x + w <= p.x || p.y + h <= q.y || q.y + h <= p.y)) kept.push(p);
        }
        return kept;
    }
};

window.MapFind = MapFind;
