'use strict';

/**
 * FontHistory - the Font Editor's undo and redo stacks (Batch 10C2). Pure: it holds snapshots, it knows nothing about fonts.
 *
 * A snapshot is any object with a `bytes` number (its approximate size). The stacks are capped by TOTAL BYTES, not by count, because a
 * 256-glyph 32 x 32 font is 32 KB and a classic one 2 KB. [C] The heaviest snapshot is 256 x 128 = 32,768 bytes of glyphs plus 512 of
 * shading; at a 2 MB cap that is about 62 steps of the heaviest font and thousands of the lightest - 2 MB is the order of every other
 * persistence path in the app (FontService.MAX_LIBRARY_BYTES). The oldest snapshots are dropped first. A coloured font's snapshot also
 * holds its block attributes: [C] every glyph of the heaviest font coloured adds 256 x 16 = 4,096 bytes, 37,376 in all, about 56 steps.
 */
class FontHistory {
    constructor(maxBytes = 2 * 1024 * 1024) {
        this.maxBytes = maxBytes;
        this.past = [];
        this.future = [];
    }

    /** Record the state BEFORE a change. Clears redo. */
    push(snapshot) {
        this.past.push(snapshot);
        this.future = [];
        this._trim();
    }

    canUndo() { return this.past.length > 0; }
    canRedo() { return this.future.length > 0; }

    /**
     * Step back: returns the state to restore, remembering `current` for redo. Null if there is nothing to undo.
     */
    undo(current) {
        if (!this.past.length) return null;
        this.future.push(current);
        return this.past.pop();
    }

    /** Step forward: returns the state to restore, remembering `current` for undo. Null if nothing to redo. */
    redo(current) {
        if (!this.future.length) return null;
        this.past.push(current);
        return this.future.pop();
    }

    clear() {
        this.past = [];
        this.future = [];
    }

    /** Total bytes held. */
    bytes() {
        let n = 0;
        for (const s of this.past) n += s.bytes;
        for (const s of this.future) n += s.bytes;
        return n;
    }

    /** @private */
    _trim() {
        while (this.past.length > 1 && this.bytes() > this.maxBytes) this.past.shift();
    }
}

window.FontHistory = FontHistory;
