'use strict';

/**
 * PresetCodec — versioned, pure serializer for user presets.
 *
 * A preset is a NAMED, SLOT-FILED capture of the app's working setup: the
 * tools and their options, the colours, the drawing modifiers, the view, the
 * pattern and the reference image with its position. It is deliberately NOT
 * the artwork — a preset restores how you were working, never what you drew.
 *
 * Follows the MapCodec/FontCodec/ClipboardCodec pattern: pure, no DOM, no
 * globals beyond its own object, so `tests/preset-codec.test.js` drives it in
 * Node. Everything that knows what a slice MEANS lives in PresetService; this
 * file only knows the payload's shape, its version and its limits.
 *
 * SLICES. A preset carries only the slices it was asked to capture, each under
 * its own key, so applying one touches only those. That is the whole reason
 * the payload is a map rather than a flat blob: loading a brush preset must
 * not move your canvas or swap your reference image.
 *
 * THE IMAGE. The reference image travels as a data URL in a SEPARATE asset
 * record keyed by content hash (see hashAsset), never inside the preset — ten
 * presets tracing one photo store one copy of it, and a slot's own record
 * stays small enough to rewrite on every save. A data URL rather than a Blob
 * because Storage falls back to localStorage when IndexedDB is unavailable and
 * localStorage holds strings only; the documented cost is base64's ~33% size
 * inflation (4 characters per 3 bytes).
 *
 * The .zxpreset FILE form (encodeFile/decodeFile) is the same payload with the
 * asset inlined, so a shared preset is self-contained and one file.
 */
const PresetCodec = {
    VERSION: 1,

    /**
     * How many slots the library holds: NINE, one per digit key.
     *
     * The count is the keyboard, not a storage decision. A workspace preset
     * restores the whole setup at once, which is a thing you do mid-drawing and
     * therefore by muscle memory - so a slot you cannot reach with a chord is a
     * slot you will not use, and 24 of them meant fifteen that existed only in
     * a dialog. Nine is what the digit row offers, so every slot has a key and
     * the library has no silent second tier.
     *
     * Was 24 until 2026-08-07 (chosen then to lay out 4x6 in the manager grid,
     * with only the first nine keyed). Nine lays out 3x3.
     *
     * Slots are addressed 0..8 and every one is always present in the library -
     * an empty slot is a null entry, not a missing key, which is what lets the
     * manager show "Slot 7 (empty)" while the recall lists only the filled ones.
     */
    SLOT_COUNT: 9,

    /**
     * How many slots answer to a chord. DELIBERATELY EQUAL TO SLOT_COUNT - the
     * whole point of the count above is that there is no unkeyed remainder.
     * The two constants stay separate because the code reads better naming the
     * reason at each site, and `tests/preset-codec.test.js` fails the build if
     * they ever drift apart.
     *
     * Alt+1..Alt+9, one per digit that names its own slot. Zero is not one of
     * them: it would have to stand for a tenth slot the hand has to translate,
     * and Alt+0 already meant "zoom to actual size" before presets existed.
     *
     * Alt rather than Ctrl because Chrome and Firefox reserve Ctrl+digit for
     * tab switching and a page cannot intercept it, and rather than a bare
     * digit because 1-8 already set the ink colour.
     */
    KEY_SLOTS: 9,

    /** A preset name the user types. Long enough to be a sentence fragment. */
    MAX_NAME: 48,

    /**
     * The longer note behind the name, shown on hover. A name has to stay short
     * enough to read in a dropdown; this is where "the one for the sprite sheet,
     * traced at 3x with the grid off" goes.
     */
    MAX_DESCRIPTION: 240,

    /**
     * Every slice id there is — the codec's membership check, and the key
     * order of the payload it writes. The order the DIALOGS list them and
     * apply() runs them in is PresetService.SLICES' order, which is the one
     * with reasoning behind it; this list only has to be complete.
     *
     * PresetService owns the capture/apply behaviour for each; the codec only
     * checks membership, so an unknown slice in a payload from a newer build
     * is DROPPED with the rest of the preset intact rather than failing the
     * whole load.
     */
    SLICE_IDS: Object.freeze([
        'tool', 'color', 'drawing', 'view', 'pattern', 'reference'
    ]),

    /**
     * Serialized-size caps.
     *
     * MAX_ASSET_CHARS covers the data URL, so it is the image's byte size plus
     * base64's third again. 8 MB of characters is ~6 MB of image (C: 8 x 3/4),
     * which clears a 4000x3000 photographic JPEG at typical quality with room
     * to spare (A - the photo figure is an estimate; measure your own
     * references if you want the cap tightened). A preset record without its
     * asset is a few kilobytes, so MAX_JSON_BYTES is generous by comparison and
     * exists only to stop a corrupt payload being persisted.
     */
    MAX_ASSET_CHARS: 8 * 1024 * 1024,
    MAX_JSON_BYTES: 256 * 1024,
    /** The file form inlines the asset, so it needs room for both. */
    MAX_FILE_BYTES: 12 * 1024 * 1024,

    /** Guards against a pathological nested value reaching the store. */
    MAX_DEPTH: 8,
    MAX_STRING: 4096,

    /** Native file extension (registered by js/io/preset-format.js). */
    EXTENSION: 'zxpreset',
    /** Magic string in the file form, so a wrong file is rejected by name. */
    FILE_MAGIC: 'PIXULA-PRESET',

    // ── Slots ───────────────────────────────────────────────────────────────

    /** @param {*} slot @returns {boolean} */
    isValidSlot(slot) {
        return Number.isInteger(slot) && slot >= 0 && slot < this.SLOT_COUNT;
    },

    /**
     * The shortcut a slot answers to, or null when it has none.
     * Slot 0..8 -> Alt+1..Alt+9; everything above is unkeyed.
     * @param {number} slot
     * @returns {string|null}
     */
    slotShortcut(slot) {
        if (!this.isValidSlot(slot) || slot >= this.KEY_SLOTS) return null;
        return `Alt+${slot + 1}`;
    },

    /**
     * The slot a digit key recalls: '1'..'9' -> 0..8. '0' recalls nothing —
     * it keeps its old meaning (zoom to actual size).
     * @param {string} digit
     * @returns {number|null}
     */
    slotForDigit(digit) {
        const n = parseInt(digit, 10);
        if (!Number.isInteger(n) || n < 1 || n > this.KEY_SLOTS) return null;
        return n - 1;
    },

    /** An empty library: every slot present, every slot null. */
    emptyLibrary() {
        return new Array(this.SLOT_COUNT).fill(null);
    },

    // ── Preset records ──────────────────────────────────────────────────────

    /**
     * Encode a preset for storage.
     * @param {Object} preset - { slot, name, created, modified, meta, slices, asset }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encode(preset) {
        if (!preset || typeof preset !== 'object') return null;
        if (!this.isValidSlot(preset.slot)) return null;
        if (!preset.slices || typeof preset.slices !== 'object') return null;

        const slices = {};
        let sliceCount = 0;
        for (const id of this.SLICE_IDS) {
            if (!Object.prototype.hasOwnProperty.call(preset.slices, id)) continue;
            const value = this._sanitize(preset.slices[id], 0);
            if (value === undefined) return null;
            slices[id] = value;
            sliceCount++;
        }
        // A preset that captured nothing would silently do nothing on recall.
        if (sliceCount === 0) return null;

        const payload = {
            v: this.VERSION,
            slot: preset.slot,
            name: this._name(preset.name, preset.slot),
            description: this._description(preset.description),
            created: this._time(preset.created),
            modified: this._time(preset.modified),
            meta: this._sanitize(preset.meta || {}, 0) || {},
            slices,
            asset: typeof preset.asset === 'string' && preset.asset ? preset.asset : null
        };

        if (JSON.stringify(payload).length > this.MAX_JSON_BYTES) return null;
        return payload;
    },

    /**
     * Decode a stored payload back to a preset.
     * Unknown slices are dropped, not fatal: a preset saved by a later build
     * still restores everything this build understands.
     * @param {Object} payload
     * @returns {Object|null}
     */
    decode(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload.v !== this.VERSION) return null;
        if (!this.isValidSlot(payload.slot)) return null;
        if (!payload.slices || typeof payload.slices !== 'object') return null;

        const slices = {};
        let sliceCount = 0;
        for (const id of this.SLICE_IDS) {
            if (!Object.prototype.hasOwnProperty.call(payload.slices, id)) continue;
            const value = this._sanitize(payload.slices[id], 0);
            if (value === undefined) continue;
            slices[id] = value;
            sliceCount++;
        }
        if (sliceCount === 0) return null;

        return {
            slot: payload.slot,
            name: this._name(payload.name, payload.slot),
            description: this._description(payload.description),
            created: this._time(payload.created),
            modified: this._time(payload.modified),
            meta: this._sanitize(payload.meta || {}, 0) || {},
            slices,
            asset: typeof payload.asset === 'string' && payload.asset ? payload.asset : null
        };
    },

    // ── Assets (the reference image) ────────────────────────────────────────

    /**
     * Content key for an asset's data URL.
     *
     * FNV-1a over the characters, salted with the length, printed hex. Not a
     * cryptographic hash and not meant to be one: it exists so that two presets
     * pointing at the same photo share one stored copy, and a collision would
     * merely show the wrong picture, never corrupt anything. Chosen over
     * crypto.subtle because that needs a secure context and this app runs from
     * file://, where support is not something to bet the reference image on.
     * @param {string} dataUrl
     * @returns {string|null}
     */
    hashAsset(dataUrl) {
        if (typeof dataUrl !== 'string' || !dataUrl) return null;
        let h = 0x811c9dc5;
        for (let i = 0; i < dataUrl.length; i++) {
            h ^= dataUrl.charCodeAt(i);
            // 32-bit FNV prime multiply without losing the high bits to floats
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return `a${dataUrl.length.toString(36)}-${h.toString(16).padStart(8, '0')}`;
    },

    /**
     * Validate and normalize an asset record for storage.
     * @param {Object} asset - { dataUrl, fileName, width, height }
     * @returns {Object|null}
     */
    encodeAsset(asset) {
        if (!asset || typeof asset.dataUrl !== 'string') return null;
        if (!asset.dataUrl.startsWith('data:image/')) return null;
        if (asset.dataUrl.length > this.MAX_ASSET_CHARS) return null;

        const record = {
            v: this.VERSION,
            dataUrl: asset.dataUrl,
            fileName: typeof asset.fileName === 'string'
                ? asset.fileName.slice(0, this.MAX_STRING) : '',
            width: Number.isFinite(asset.width) ? Math.round(asset.width) : 0,
            height: Number.isFinite(asset.height) ? Math.round(asset.height) : 0,
            // True when dataUrl is a downscaled stand-in rather than the photo
            thumbnail: asset.thumbnail === true
        };

        /*
         * The disk handle rides along ONLY into IndexedDB, which uses
         * structured clone and can carry it. It is deliberately absent from
         * every JSON path: `encodeFile` builds a shareable `.zxpreset`, and a
         * handle means nothing on another machine even if JSON could hold it -
         * which it cannot. A shared preset travels with its thumbnail.
         */
        if (asset.handle) record.handle = asset.handle;

        return record;
    },

    /** @param {Object} record @returns {Object|null} */
    decodeAsset(record) {
        if (!record || record.v !== this.VERSION) return null;
        return this.encodeAsset(record);
    },

    // ── The .zxpreset file form ─────────────────────────────────────────────

    /**
     * Encode one preset (with its image inlined) as a shareable file.
     * @param {Object} preset
     * @param {Object|null} asset - the asset record the preset references
     * @returns {string|null} UTF-8 JSON text
     */
    encodeFile(preset, asset) {
        const payload = this.encode(preset);
        if (!payload) return null;

        const file = { magic: this.FILE_MAGIC, v: this.VERSION, preset: payload };
        if (payload.asset) {
            const encoded = asset ? this.encodeAsset(asset) : null;
            if (encoded) {
                // A handle is not JSON and would land as `{}` - worse than
                // absent, because it looks like a link that could be followed.
                // The thumbnail is what makes a shared preset self-contained.
                delete encoded.handle;
                file.asset = encoded;
            } else {
                // The image could not travel; the transform still can. Say so in
                // the payload rather than shipping a preset that points at a
                // picture the receiving machine has never seen.
                file.preset = { ...payload, asset: null };
            }
        }

        const text = JSON.stringify(file);
        if (text.length > this.MAX_FILE_BYTES) return null;
        return text;
    },

    /**
     * Decode a .zxpreset file.
     * @param {string} text
     * @returns {{ preset: Object, asset: Object|null }|null}
     */
    decodeFile(text) {
        if (typeof text !== 'string' || text.length > this.MAX_FILE_BYTES) return null;
        let file;
        try { file = JSON.parse(text); } catch (e) { return null; }
        if (!file || file.magic !== this.FILE_MAGIC) return null;

        const preset = this.decode(file.preset);
        if (!preset) return null;

        const asset = file.asset ? this.decodeAsset(file.asset) : null;
        // A preset naming an asset the file did not carry keeps its transform
        // and drops the picture, rather than dangling at a key that is not here.
        if (preset.asset && !asset) preset.asset = null;

        return { preset, asset };
    },

    // ── Tool presets ────────────────────────────────────────────────────────

    /*
     * A TOOL preset is the other kind, and a deliberately smaller idea: one
     * panel's own settings under a name, filed against that panel's id.
     * Nothing else rides along — not the colour, not the draw mode, not the
     * view — because these are recalled from a button under the panel's own
     * controls MID-DRAWING, and a control in that position must not move
     * anything the artist is not looking at. A workspace-wide capture is what
     * the slotted preset above is for.
     *
     * The scope id is the filing key AND the load filter: a brush preset is
     * offered to the brush and to nothing else, so a name never has to say
     * which tool it belongs to and a list never has to be read past. Most
     * scopes are tools; the Reference panel is the one that is not, and the
     * only difference visible at this level is that its records carry an
     * `asset` key (see PresetService.PRESET_SCOPES).
     *
     * One STORE RECORD PER TOOL, holding that tool's whole list in order. A
     * record per preset would need an index to list a tool's presets and a
     * scan to count them; a tool's list is a few hundred bytes and is rewritten
     * whole on every save.
     */

    /**
     * Cap on ONE TOOL'S serialized list.
     *
     * Option values are scalars — numbers, short strings, booleans. The
     * fattest schema in the app is the brush's, and a captured brush encodes to
     * roughly 400 bytes with its name and timestamps (M, measured on the
     * default brush 2026-08-07), so 64 KB is around 150 brush presets for one
     * tool. That is far past the point where a sidebar list stops being
     * readable, which is the real limit — this cap only exists so a corrupt or
     * runaway payload cannot be persisted. Matches FontCodec's per-record cap.
     */
    MAX_TOOL_PRESET_BYTES: 64 * 1024,

    /** Storage key for a tool's list. @param {string} toolId */
    toolLibraryKey(toolId) {
        return typeof toolId === 'string' && toolId ? `tool:${toolId}` : null;
    },

    /**
     * Encode one tool preset.
     * @param {Object} preset - { tool, name, options, created, modified }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encodeToolPreset(preset) {
        if (!preset || typeof preset !== 'object') return null;
        if (typeof preset.tool !== 'string' || !preset.tool) return null;
        if (!preset.options || typeof preset.options !== 'object') return null;

        const options = this._sanitize(preset.options, 0);
        if (options === undefined) return null;
        // A preset that captured no option would silently do nothing on recall.
        if (Object.keys(options).length === 0) return null;

        // The name is the only thing a list shows, so there is no such thing as
        // a usable default for one. Refuse rather than invent.
        const name = this._toolPresetName(preset.name);
        if (!name) return null;

        return {
            tool: preset.tool,
            name,
            created: this._time(preset.created),
            modified: this._time(preset.modified),
            options,
            // The key of a picture in the shared asset store, for a scope that
            // carries one (the Reference panel). Never the picture itself: a
            // tool's whole list is rewritten on every save, and a megabyte of
            // base64 riding along would make that a bad bargain.
            asset: typeof preset.asset === 'string' && preset.asset ? preset.asset : null
        };
    },

    /**
     * Decode one tool preset. An option key this build no longer has is NOT
     * dropped here — PresetService re-validates every value against the live
     * schema on apply, which is the only place that knows what the tool
     * currently accepts.
     * @param {Object} payload
     * @returns {Object|null}
     */
    decodeToolPreset(payload) {
        return this.encodeToolPreset(payload);
    },

    /**
     * Encode a tool's whole list for its store record.
     * @param {string} toolId
     * @param {Array<Object>} presets
     * @returns {Object|null}
     */
    encodeToolLibrary(toolId, presets) {
        if (typeof toolId !== 'string' || !toolId) return null;
        if (!Array.isArray(presets)) return null;

        const out = [];
        for (const preset of presets) {
            const encoded = this.encodeToolPreset({ ...preset, tool: toolId });
            if (encoded) out.push(encoded);
        }

        const payload = { v: this.VERSION, tool: toolId, presets: out };
        if (JSON.stringify(payload).length > this.MAX_TOOL_PRESET_BYTES) return null;
        return payload;
    },

    /**
     * Decode a tool's stored list. A record filed under one tool but claiming
     * another is read as the KEY says, exactly as a slot record is.
     * @param {Object} payload
     * @param {string} toolId - the key it was stored under
     * @returns {Array<Object>} possibly empty, never null
     */
    decodeToolLibrary(payload, toolId) {
        if (!payload || typeof payload !== 'object') return [];
        if (payload.v !== this.VERSION) return [];
        if (!Array.isArray(payload.presets)) return [];

        const out = [];
        for (const entry of payload.presets) {
            const preset = this.decodeToolPreset({ ...entry, tool: toolId });
            if (preset) out.push(preset);
        }
        return out;
    },

    // ── Internals ───────────────────────────────────────────────────────────

    /**
     * A tool preset's name. Unlike a slot, it has no number to fall back on —
     * an unnamed one would be indistinguishable from the next unnamed one in a
     * list where the name is the ONLY thing shown, so the caller must supply a
     * usable one and an empty name is refused rather than invented.
     * @private
     */
    _toolPresetName(name) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        return trimmed ? trimmed.slice(0, this.MAX_NAME) : '';
    },

    /** A named slot, or a default that still identifies itself. @private */
    _name(name, slot) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (trimmed) return trimmed.slice(0, this.MAX_NAME);
        return `Preset ${slot + 1}`;
    },

    /** The hover note. Optional — an empty one means "no tooltip". @private */
    _description(value) {
        return typeof value === 'string'
            ? value.trim().slice(0, this.MAX_DESCRIPTION) : '';
    },

    /** @private */
    _time(value) {
        return Number.isFinite(value) && value > 0 ? Math.round(value) : Date.now();
    },

    /**
     * Deep-copy a JSON-safe value, rejecting anything that is not.
     * Returns undefined for a value that must not be persisted (a function, a
     * DOM node, a cycle, a number that is not finite), which every caller
     * treats as "this payload is not encodable".
     * @private
     */
    _sanitize(value, depth) {
        if (depth > this.MAX_DEPTH) return undefined;
        if (value === null) return null;

        const type = typeof value;
        if (type === 'boolean') return value;
        if (type === 'number') return Number.isFinite(value) ? value : undefined;
        if (type === 'string') return value.slice(0, this.MAX_STRING);

        if (Array.isArray(value)) {
            const out = [];
            for (const item of value) {
                const clean = this._sanitize(item, depth + 1);
                if (clean === undefined) return undefined;
                out.push(clean);
            }
            return out;
        }

        if (type === 'object') {
            // Typed arrays (palette registers) travel as plain arrays
            if (ArrayBuffer.isView(value)) return Array.from(value);
            if (Object.getPrototypeOf(value) !== Object.prototype &&
                Object.getPrototypeOf(value) !== null) {
                return undefined;
            }
            const out = {};
            for (const key of Object.keys(value)) {
                const clean = this._sanitize(value[key], depth + 1);
                if (clean === undefined) continue; // drop the key, keep the object
                out[key] = clean;
            }
            return out;
        }

        return undefined;
    }
};

if (typeof window !== 'undefined') window.PresetCodec = PresetCodec;
