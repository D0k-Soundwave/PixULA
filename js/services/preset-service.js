'use strict';
(function() {

/**
 * PresetService — the user's own named setups.
 *
 * TWO LIBRARIES, TWO QUESTIONS. Tool presets (see the section at the foot of
 * the class) answer "give me that brush again": one tool's option values under
 * a name, filed by tool id, loaded from a button under that tool's own options.
 * They are the everyday kind, and they deliberately carry nothing but the tool.
 * WORKSPACE presets — the rest of this file — answer "put my whole workspace
 * back": every tool's options, the colours, the drawing modifiers, the pattern,
 * the view and the reference image WITH its position, under a name the user
 * types, in one of PresetCodec.SLOT_COUNT numbered slots reachable from
 * Alt+1..Alt+9. Both read tool options through the same schema-driven capture
 * below. Neither ever captures the artwork.
 *
 * THE SLICE REGISTRY IS THE POINT. Every kind of state a preset can carry is
 * one entry in PRESET_SLICES below, declaring how to read it and how to put it
 * back. New state becomes preset-able by adding an entry — the save dialog, the
 * manager, the codec, the file format and the tests all read the registry, so
 * there is no second list to keep in step. It is the same move the app already
 * makes with TOOLS, SCREEN_MODES, PEN_ACTIONS and FORMATS.
 *
 * SCOPED APPLY. A preset carries only the slices it was asked for, and applying
 * one touches only those. Recalling a brush must not move your canvas or swap
 * your reference image, and the only way to guarantee that is to make the scope
 * part of the record rather than a rule someone has to remember.
 *
 * TOOL OPTIONS COME FROM THE SCHEMA, NOT FROM A LIST HERE. Every tool declares
 * `static optionsSchema` and OptionControls already reads each key through
 * `get<Key>()` and writes it through `set<Key>()` (the contract in
 * js/tools/tool-base.js). Capture walks that same schema, so an option added to
 * a tool tomorrow is preset-able the day it lands with no edit to this file. A
 * key that must not travel — the text tool's typed string — marks itself
 * `preset: false` in its own schema, and tests/preset-slices.test.js fails the
 * build if any other key lacks the getter capture needs.
 *
 * NO SLICE TOUCHES THE DOCUMENT, so nothing a preset applies is undoable. Two
 * things are deliberately not slices. Screen mode: switching it converts the
 * artwork, sometimes lossily, and a preset must never do that behind the user's
 * back — a preset RECORDS the mode it was captured under and says so when it
 * does not match. And the palette: it was a slice until 2026-08-07, and it was
 * the wrong home for it. A custom palette is a document you build once and
 * reuse across pictures, so it belongs in a FILE (Image > Edit Palette…,
 * File > Load/Save Palette…, and inside every image format that carries one),
 * not inside a workspace capture that could only restore it as a side effect of
 * recalling six other things.
 *
 * Facts go up as EVENTS.PRESET_* only; no DOM here.
 */

/**
 * Storage keys.
 *
 * One record per slot rather than one library record, so saving a preset
 * rewrites its own slot and nothing else. Slots are read back by asking for
 * each key in turn instead of enumerating the store: Storage falls back to
 * localStorage when IndexedDB is unavailable, and that backend cannot list a
 * store's contents. PresetCodec.SLOT_COUNT reads are cheap and work on both.
 *
 * ASSET_INDEX is the same accommodation for the image store — a list of the
 * keys we have written, so the sweep that drops unreferenced images knows what
 * exists without enumerating.
 */
const SLOT_KEY = (slot) => `slot:${slot}`;
const ASSET_INDEX = 'asset-index';

class PresetServiceClass {
    constructor() {
        /** @type {Array<Object|null>} slot index -> preset (null = empty) */
        this._library = PresetCodec.emptyLibrary();
        this._initialized = false;

        /** @type {Map<string, Array<Object>>} tool id -> that tool's presets */
        this._toolLibrary = new Map();
        this._toolPresetsRestored = false;
    }

    // ── Slice registry ──────────────────────────────────────────────────────

    /**
     * Every kind of state a preset can carry.
     *
     *   id        stable key in the payload (also PresetCodec.SLICE_IDS)
     *   i18n      label key for the save/manager dialogs
     *   defaultOn whether the save dialog ticks it to begin with
     *   modeSensitive  its meaning depends on the palette model, so it is
     *             skipped and reported when the mode does not match
     *   capture() read current state -> a JSON-safe value, or null to skip
     *   apply(v)  put it back
     *
     * Every slice is WORKSPACE state. A slice that edited the document would
     * need an undo action around it; there is deliberately no such slice (see
     * the header).
     */
    get SLICES() {
        return PresetServiceClass.SLICES;
    }

    /** Slice ids in registry order. */
    getSliceIds() {
        return PresetServiceClass.SLICES.map(s => s.id);
    }

    /** @param {string} id @returns {Object|null} */
    getSlice(id) {
        return PresetServiceClass.SLICES.find(s => s.id === id) || null;
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Load the slot library from storage. Called in App phase 3, before the UI
     * builds, so the recall dropdown is populated on its first render.
     */
    async restorePersisted() {
        if (this._initialized) return;
        this._initialized = true;

        try {
            for (let slot = 0; slot < PresetCodec.SLOT_COUNT; slot++) {
                const payload = await Storage.get(SLOT_KEY(slot), Storage.STORES.PRESETS);
                if (!payload) continue;
                const preset = PresetCodec.decode(payload);
                // A record whose slot disagrees with its key is filed by its key
                if (preset) this._library[slot] = { ...preset, slot };
            }
            Logger.info('PresetService', `Restored ${this.listPopulated().length} preset(s)`);
            await this._dropSlotsAboveCount();
        } catch (error) {
            Logger.warn('PresetService', 'Could not restore presets', error);
        }

        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
    }

    // ── Library ─────────────────────────────────────────────────────────────

    /** Every slot, empty ones included (the manager grid). @returns {Array} */
    listSlots() {
        return this._library.map((preset, slot) => ({ slot, preset }));
    }

    /**
     * Only the filled slots, in slot order — what the recall dropdown lists.
     * An empty slot is not an option the user should have to read past.
     * @returns {Array<Object>}
     */
    listPopulated() {
        return this._library.filter(p => p !== null);
    }

    /** @param {number} slot @returns {Object|null} */
    get(slot) {
        return PresetCodec.isValidSlot(slot) ? this._library[slot] : null;
    }

    /** The lowest empty slot, or -1 when the library is full. */
    firstFreeSlot() {
        return this._library.findIndex(p => p === null);
    }

    // ── Capture ─────────────────────────────────────────────────────────────

    /**
     * Read the current setup for the named slices.
     * @param {Array<string>} sliceIds
     * @returns {{ slices: Object, asset: Object|null, meta: Object }}
     */
    capture(sliceIds) {
        const wanted = Array.isArray(sliceIds) && sliceIds.length
            ? sliceIds : this.getSliceIds();

        const slices = {};
        let asset = null;

        for (const slice of PresetServiceClass.SLICES) {
            if (!wanted.includes(slice.id)) continue;
            let value = null;
            try {
                value = slice.capture();
            } catch (error) {
                Logger.warn('PresetService', `Slice ${slice.id} failed to capture`, error);
                continue;
            }
            if (value === null || value === undefined) continue;

            // The reference slice hands back its image separately: the picture
            // is content-addressed in its own store so slots can share it.
            if (slice.id === 'reference' && value.assetData) {
                asset = value.assetData;
                value = { ...value };
                delete value.assetData;
            }
            slices[slice.id] = value;
        }

        return { slices, asset, meta: this._meta() };
    }

    /** What the preset was captured under, for the mismatch warning. @private */
    _meta() {
        const mode = window.ACTIVE_SCREEN_MODE || null;
        return {
            screenMode: mode ? mode.id : null,
            paletteModel: mode ? (mode.paletteModel || 'classic') : null
        };
    }

    /**
     * Does this preset's colour data mean the same thing in the current mode?
     * Ink 2 under STANDARD_ULA and index 2 under Layer 2 are different colours,
     * so a mismatched colour/palette slice is SKIPPED and reported rather than
     * applied to look right and paint wrong.
     * @param {Object} preset
     * @returns {boolean}
     */
    matchesActiveMode(preset) {
        if (!preset || !preset.meta || !preset.meta.paletteModel) return true;
        return preset.meta.paletteModel === this._meta().paletteModel;
    }

    // ── Save / rename / delete ──────────────────────────────────────────────

    /**
     * Capture the current setup into a slot under a name.
     * @param {number} slot
     * @param {string} name
     * @param {Array<string>} sliceIds
     * @param {string} [description] - the longer note shown on hover
     * @returns {Promise<Object|null>} the saved preset, or null if it would not encode
     */
    async save(slot, name, sliceIds, description = '') {
        if (!PresetCodec.isValidSlot(slot)) return null;

        const { slices, asset, meta } = this.capture(sliceIds);
        const existing = this._library[slot];

        const preset = {
            slot,
            name,
            description,
            created: existing ? existing.created : Date.now(),
            modified: Date.now(),
            meta,
            slices,
            asset: asset ? PresetCodec.hashAsset(asset.dataUrl) : null
        };

        const payload = PresetCodec.encode(preset);
        if (!payload) {
            Logger.warn('PresetService', 'Preset would not encode; nothing saved');
            return null;
        }

        if (asset && preset.asset) {
            await this._putAsset(preset.asset, asset);
        }

        this._library[slot] = PresetCodec.decode(payload);
        await this._persistSlot(slot);
        await this._collectAssets();

        EventBus.emit(EVENTS.PRESET_SAVED, { slot, preset: this._library[slot] });
        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
        return this._library[slot];
    }

    /**
     * Rename a slot and/or reword its hover description. Both are the user's
     * own labelling of a slot they already filled, so neither re-captures
     * anything — the setup in the slot is untouched.
     * @param {number} slot
     * @param {string} name
     * @param {string} [description] - omit to leave the existing note alone
     * @returns {Promise<boolean>}
     */
    async rename(slot, name, description) {
        const preset = this.get(slot);
        if (!preset) return false;

        const renamed = {
            ...preset,
            name,
            description: description === undefined ? preset.description : description,
            modified: Date.now()
        };
        const payload = PresetCodec.encode(renamed);
        if (!payload) return false;

        this._library[slot] = PresetCodec.decode(payload);
        await this._persistSlot(slot);

        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
        return true;
    }

    /** @param {number} slot @returns {Promise<boolean>} */
    async remove(slot) {
        if (!this.get(slot)) return false;

        this._library[slot] = null;
        try {
            await Storage.delete(SLOT_KEY(slot), Storage.STORES.PRESETS);
        } catch (error) {
            Logger.warn('PresetService', 'Could not delete preset record', error);
        }
        await this._collectAssets();

        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
        return true;
    }

    /**
     * Copy a preset into another slot (the manager's Duplicate).
     * @param {number} from @param {number} to @returns {Promise<boolean>}
     */
    async copyTo(from, to) {
        const preset = this.get(from);
        if (!preset || !PresetCodec.isValidSlot(to) || from === to) return false;

        const copy = { ...preset, slot: to, created: Date.now(), modified: Date.now() };
        const payload = PresetCodec.encode(copy);
        if (!payload) return false;

        this._library[to] = PresetCodec.decode(payload);
        await this._persistSlot(to);

        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
        return true;
    }

    // ── Apply ───────────────────────────────────────────────────────────────

    /**
     * Put a preset back.
     *
     * @param {number} slot
     * @param {Array<string>} [sliceIds] - restrict to these slices (default: all it carries)
     * @returns {Promise<{ applied: Array<string>, skipped: Array<string> }|null>}
     */
    async apply(slot, sliceIds = null) {
        const preset = this.get(slot);
        if (!preset) return null;

        const wanted = Array.isArray(sliceIds) && sliceIds.length
            ? sliceIds : Object.keys(preset.slices);
        const modeMatches = this.matchesActiveMode(preset);

        const applied = [];
        const skipped = [];

        // NOTHING A PRESET APPLIES IS UNDOABLE, because nothing it applies is
        // the document. That was not always true: the palette used to be a
        // slice, it edited the document, and applying it opened one UndoRedo
        // action so a single Ctrl+Z put it back. The palette became a FILE
        // (Image > Edit Palette…, File > Load/Save Palette…) on 2026-08-07 and
        // the slice went with it, which left no document-touching slice and no
        // reason to open an action here. If one is ever added back, the
        // machinery it needs is in the history of this file — including the
        // subtlety that cost a bug: endAction() pushes and clears the redo
        // stack whenever an action was opened, so an action opened for a slice
        // that then gets skipped destroys a redo the user could still want.
        for (const slice of PresetServiceClass.SLICES) {
            if (!wanted.includes(slice.id)) continue;
            if (!Object.prototype.hasOwnProperty.call(preset.slices, slice.id)) continue;

            // Colour meanings are mode-specific; a mismatch skips rather
            // than silently painting the wrong colour (see matchesActiveMode).
            if (slice.modeSensitive && !modeMatches) {
                skipped.push(slice.id);
                continue;
            }

            try {
                await slice.apply(preset.slices[slice.id], preset);
                applied.push(slice.id);
            } catch (error) {
                Logger.warn('PresetService', `Slice ${slice.id} failed to apply`, error);
                skipped.push(slice.id);
            }
        }

        EventBus.emit(EVENTS.PRESET_APPLIED, {
            slot, preset, applied, skipped, modeMatches
        });
        return { applied, skipped };
    }

    /**
     * Recall by number key — Alt+1..Alt+9 (InputHandler). Zero is not a preset
     * key: it would stand for a tenth slot the hand has to translate, and Alt+0
     * already means "zoom to actual size".
     *
     * An empty keyed slot is a NO-OP, deliberately: the shortcut for a preset
     * you have not saved yet should do nothing at all, not open a dialog the
     * hand was not reaching for mid-stroke.
     * @param {string} digit - '0'..'9'
     * @returns {Promise<Object|null>}
     */
    async applyByDigit(digit) {
        const slot = PresetCodec.slotForDigit(digit);
        if (slot === null || !this.get(slot)) return null;
        return this.apply(slot);
    }

    // ── Import / export (the .zxpreset file form) ───────────────────────────

    /**
     * Serialize a slot as a self-contained file (image inlined).
     * @param {number} slot
     * @returns {Promise<string|null>}
     */
    async toFile(slot) {
        const preset = this.get(slot);
        if (!preset) return null;
        const asset = preset.asset ? await this._getAsset(preset.asset) : null;
        return PresetCodec.encodeFile(preset, asset);
    }

    /**
     * Read a .zxpreset into a slot.
     * @param {string} text @param {number} slot
     * @returns {Promise<Object|null>} the stored preset
     */
    async fromFile(text, slot) {
        const decoded = PresetCodec.decodeFile(text);
        if (!decoded || !PresetCodec.isValidSlot(slot)) return null;

        const preset = { ...decoded.preset, slot, modified: Date.now() };

        // Re-key on arrival: the hash is of the content, so an image that is
        // already here is shared rather than stored twice.
        const asset = decoded.asset;
        if (asset) preset.asset = PresetCodec.hashAsset(asset.dataUrl);

        // Validate BEFORE writing the image. The sweep that drops unreferenced
        // images only runs on the success path below, so an image written for a
        // preset that then fails to encode would sit in the store, referenced by
        // nothing, until some unrelated later save happened to collect it.
        const payload = PresetCodec.encode(preset);
        if (!payload) return null;

        if (asset) await this._putAsset(preset.asset, asset);

        this._library[slot] = PresetCodec.decode(payload);
        await this._persistSlot(slot);
        await this._collectAssets();

        EventBus.emit(EVENTS.PRESET_LIBRARY_CHANGED, { presets: this.listPopulated() });
        return this._library[slot];
    }

    // ── Persistence ─────────────────────────────────────────────────────────

    /**
     * Delete slot records past the current SLOT_COUNT.
     *
     * The library shrank from 24 slots to 9 on 2026-08-07. Nothing reads slots
     * 9..23 any more, so their records would sit in IndexedDB forever, and the
     * asset sweep would strip the reference images they point at while leaving
     * the records themselves behind - orphans that look like data.
     *
     * Scans a fixed window past the end rather than enumerating, because
     * Storage falls back to localStorage where a store cannot be listed. The
     * window only has to cover counts this app has actually shipped.
     * @private
     */
    async _dropSlotsAboveCount() {
        const PREVIOUS_MAX_SLOT_COUNT = 24;
        let dropped = 0;
        for (let slot = PresetCodec.SLOT_COUNT; slot < PREVIOUS_MAX_SLOT_COUNT; slot++) {
            try {
                if (!await Storage.get(SLOT_KEY(slot), Storage.STORES.PRESETS)) continue;
                await Storage.delete(SLOT_KEY(slot), Storage.STORES.PRESETS);
                dropped++;
            } catch (error) {
                Logger.warn('PresetService', `Could not drop stale slot ${slot}`, error);
            }
        }
        if (dropped) {
            Logger.info('PresetService', `Dropped ${dropped} preset(s) above slot ${PresetCodec.SLOT_COUNT - 1}`);
            await this._collectAssets();
        }
    }

    /** @private */
    async _persistSlot(slot) {
        const preset = this._library[slot];
        if (!preset) return;
        const payload = PresetCodec.encode(preset);
        if (!payload) return;
        try {
            await Storage.set(SLOT_KEY(slot), payload, Storage.STORES.PRESETS);
        } catch (error) {
            Logger.warn('PresetService', 'Could not persist preset', error);
        }
    }

    /** @private */
    async _putAsset(key, asset) {
        const record = PresetCodec.encodeAsset(asset);
        if (!record) {
            Logger.warn('PresetService', 'Reference image too large or unreadable; not stored');
            return false;
        }
        try {
            await this._writeAsset(key, record);
            const index = await this._assetIndex();
            if (!index.includes(key)) {
                index.push(key);
                await Storage.set(ASSET_INDEX, index, Storage.STORES.PRESET_ASSETS);
            }
            return true;
        } catch (error) {
            Logger.warn('PresetService', 'Could not store reference image', error);
            return false;
        }
    }

    /**
     * Write one asset record, dropping the file link if it will not store.
     *
     * The link is the optional extra; the thumbnail and the placement ARE the
     * preset. A FileSystemFileHandle structured-clones into IndexedDB in the
     * browsers that offer one, but if that ever fails - an engine that will not
     * persist handles, a private-mode restriction - losing the whole preset over
     * it would be the wrong trade. Retry without it and keep the picture.
     * @private
     */
    async _writeAsset(key, record) {
        try {
            await Storage.set(key, record, Storage.STORES.PRESET_ASSETS);
        } catch (error) {
            if (!record.handle) throw error;
            Logger.info('PresetService',
                'File link could not be stored; keeping the thumbnail alone', error);
            const withoutLink = { ...record };
            delete withoutLink.handle;
            await Storage.set(key, withoutLink, Storage.STORES.PRESET_ASSETS);
        }
    }

    /** The keys of every image we have written. @private */
    async _assetIndex() {
        try {
            const index = await Storage.get(ASSET_INDEX, Storage.STORES.PRESET_ASSETS);
            return Array.isArray(index) ? index.filter(k => typeof k === 'string') : [];
        } catch (error) {
            return [];
        }
    }

    /** @private */
    async _getAsset(key) {
        if (!key) return null;
        try {
            return PresetCodec.decodeAsset(await Storage.get(key, Storage.STORES.PRESET_ASSETS));
        } catch (error) {
            Logger.warn('PresetService', 'Could not read reference image', error);
            return null;
        }
    }

    /**
     * Drop stored images no slot points at any more.
     *
     * Reference counting would have to survive a browser crash mid-write;
     * sweeping the slots is cheap (24 of them) and cannot leak. Runs after
     * every save, delete and import.
     * @private
     */
    async _collectAssets() {
        // BOTH libraries hold references into the image store. Sweeping against
        // the slots alone would delete the picture out from under every
        // reference preset the moment any slot was saved or cleared.
        const live = new Set(this._library.filter(p => p && p.asset).map(p => p.asset));
        for (const list of this._toolLibrary.values()) {
            for (const preset of list) if (preset.asset) live.add(preset.asset);
        }
        try {
            const index = await this._assetIndex();
            const kept = [];
            for (const key of index) {
                if (live.has(key)) kept.push(key);
                else await Storage.delete(key, Storage.STORES.PRESET_ASSETS);
            }
            if (kept.length !== index.length) {
                await Storage.set(ASSET_INDEX, kept, Storage.STORES.PRESET_ASSETS);
            }
        } catch (error) {
            Logger.warn('PresetService', 'Asset sweep failed', error);
        }
    }

    /** Read an asset for a preset (the reference slice's apply path). */
    async loadAsset(key) {
        return this._getAsset(key);
    }

    // ── Tool presets ────────────────────────────────────────────────────────
    //
    // The second, smaller library: one panel's own settings under a name, filed
    // against that panel's id and offered to that panel alone. It shares this
    // service because it shares the machinery that matters — captureToolOptions
    // reads the schema, validateOption re-checks every stored value against the
    // live one — but it is a separate library with separate facts, because a
    // brush preset and a workspace slot answer different questions.
    //
    // Why the id is the filing key and not merely a label: a list you must
    // read past is a list you stop reading. Twenty presets across six tools is
    // a scroll; the four that belong to the brush you are holding is a glance.
    // The cost is that a setup cannot be shared between two tools, which is the
    // right cost — the eraser has no use for the spray's distribution.
    //
    // MOST SCOPES ARE TOOLS; ONE IS NOT. Every entry in TOOLS is a scope whose
    // settings are its `optionsSchema`. The Reference panel is a scope too —
    // the artist calls it a tool and it behaves as one here — but its settings
    // are an image and a placement rather than schema rows, so it declares
    // itself in PRESET_SCOPES below with its own capture and apply. Adding
    // another non-tool panel to the library is one entry there; nothing in the
    // list, save, rename, delete or storage paths knows the difference.

    /**
     * One tool's presets, in save order.
     * @param {string} toolId
     * @returns {Array<Object>} never null; empty when the tool has none
     */
    listToolPresets(toolId) {
        return this._toolLibrary.get(toolId) || [];
    }

    /**
     * Every preset in the library, from every scope, in scope order.
     *
     * What the Presets panel lists. The per-panel Load rows stay scoped — a
     * tool must only be able to load its own — but the panel is the LIBRARY,
     * and a library you can only see one shelf of at a time is a drawer.
     * @returns {Array<{ scope: string, preset: Object }>}
     */
    listAllToolPresets() {
        const out = [];
        for (const scope of this.presetScopeIds()) {
            for (const preset of this.listToolPresets(scope)) out.push({ scope, preset });
        }
        return out;
    }

    /**
     * What a preset actually CHANGES, as schema entries paired with values.
     *
     * Only the settings that differ from the tool's own defaults. A brush
     * captures fifteen options and a preset typically means three of them; the
     * other twelve are the defaults restated, and printing them would bury the
     * answer to "what is this preset?" in noise. A preset that changes nothing
     * returns an empty list, and the UI says so rather than showing a blank.
     *
     * Returns the schema ENTRY beside each value rather than a formatted
     * string, because turning `{key:'size', value:1}` into "Size: 1" needs the
     * locale and the locale is not this layer's business.
     *
     * @param {string} scopeId @param {Object} options
     * @returns {Array<{ entry: Object, value: * }>}
     */
    describeToolPreset(scopeId, options) {
        if (!options) return [];

        const scope = this.getPresetScope(scopeId);
        if (scope) return scope.describe ? scope.describe(options) : [];

        const tool = ToolManager.getTool(scopeId);
        const schema = tool && tool.constructor ? tool.constructor.optionsSchema : null;
        if (!schema) return [];

        const out = [];
        for (const entry of schema) {
            if (!entry || !entry.key || entry.preset === false) continue;
            if (!Object.prototype.hasOwnProperty.call(options, entry.key)) continue;

            const value = options[entry.key];
            // `value` is the schema's word for the DEFAULT (documented in
            // tool-base.js), so this is "differs from how the tool ships".
            if (entry.value !== undefined && String(entry.value) === String(value)) continue;
            out.push({ entry, value });
        }
        return out;
    }

    /**
     * A tool preset by name (names are unique within a tool).
     * @param {string} toolId @param {string} name
     * @returns {Object|null}
     */
    getToolPreset(toolId, name) {
        const key = PresetServiceClass.normalizeName(name);
        if (!key) return null;
        return this.listToolPresets(toolId)
            .find(p => PresetServiceClass.normalizeName(p.name) === key) || null;
    }

    /** The PRESET_SCOPES entry for a non-tool scope, or null. @param {string} id */
    getPresetScope(id) {
        return PresetServiceClass.PRESET_SCOPES[id] || null;
    }

    /** Every scope id the library can file under: the tools, plus the rest. */
    presetScopeIds() {
        return [...Object.values(TOOLS), ...Object.keys(PresetServiceClass.PRESET_SCOPES)];
    }

    /**
     * Can this scope have presets at all? A tool with no options has nothing to
     * save, and offering it the buttons anyway would be offering an empty box —
     * the eyedropper and the move tool are the ones this is about. A non-tool
     * scope answers for itself: the Reference panel has nothing to save until
     * an image is actually loaded.
     * @param {string} scopeId
     * @returns {boolean}
     */
    toolSupportsPresets(scopeId) {
        const scope = this.getPresetScope(scopeId);
        if (scope) return scope.canCapture();
        return PresetServiceClass.captureToolOptions(scopeId) !== null;
    }

    /**
     * Does this scope EXIST, whether or not it can capture right now?
     *
     * The difference matters to the UI: a tool with no options should show no
     * preset controls at all, but the Reference panel with no image loaded is a
     * scope that is merely empty — its controls stay, and its list still lists.
     * @param {string} scopeId
     * @returns {boolean}
     */
    hasPresetScope(scopeId) {
        return this.getPresetScope(scopeId) !== null || this.toolSupportsPresets(scopeId);
    }

    /**
     * Capture the tool's CURRENT option values under a name.
     *
     * Saving over an existing name REPLACES it in place, keeping its position
     * in the list and its created date — re-saving "1px pencil" after adjusting
     * it is the commonest thing anyone does here, and it should not produce a
     * second entry with the same name that the user then has to tell apart.
     * Callers confirm the overwrite; this method performs it.
     *
     * @param {string} toolId
     * @param {string} name
     * @returns {Promise<Object|null>} the saved preset, or null if nothing was saved
     */
    async saveToolPreset(toolId, name) {
        const scope = this.getPresetScope(toolId);
        const captured = scope
            ? scope.capture()
            : { options: PresetServiceClass.captureToolOptions(toolId), asset: null };

        if (!captured || !captured.options) {
            Logger.warn('PresetService', `Scope ${toolId} has nothing capturable`);
            return null;
        }
        const { options, asset } = captured;

        // A scope that carries a picture stores it in the same content-addressed
        // store the slot presets use, so two presets tracing one photo hold one
        // copy of it and the preset's own record stays a few hundred bytes.
        let assetKey = null;
        if (asset && asset.dataUrl) {
            assetKey = PresetCodec.hashAsset(asset.dataUrl);
            if (!await this._putAsset(assetKey, asset)) return null;
        }

        const preset = PresetCodec.encodeToolPreset({
            tool: toolId, name, options, asset: assetKey,
            created: Date.now(), modified: Date.now()
        });
        if (!preset) {
            Logger.warn('PresetService', 'Tool preset would not encode; nothing saved');
            return null;
        }

        const list = [...this.listToolPresets(toolId)];
        const key = PresetServiceClass.normalizeName(preset.name);
        const at = list.findIndex(p => PresetServiceClass.normalizeName(p.name) === key);
        if (at >= 0) list[at] = { ...preset, created: list[at].created };
        else list.push(preset);

        if (!await this._persistToolLibrary(toolId, list)) return null;
        // Replacing a preset can strand the image the old one pointed at
        await this._collectAssets();

        EventBus.emit(EVENTS.TOOL_PRESETS_CHANGED,
            { tool: toolId, presets: this.listToolPresets(toolId) });
        return this.getToolPreset(toolId, preset.name);
    }

    /**
     * Put a tool preset's options back on its tool.
     *
     * Only the options — the tool is NOT selected as a side effect. Loading
     * happens from that tool's own panel, so the tool is already active; and a
     * load reached from the Presets panel while another tool is in hand would
     * otherwise switch tools without being asked to.
     *
     * Async because a scope that carries a picture has to fetch it out of the
     * asset store before it can put it back.
     *
     * @param {string} toolId @param {string} name
     * @returns {Promise<boolean>} false when there is no such preset
     */
    async applyToolPreset(toolId, name) {
        const preset = this.getToolPreset(toolId, name);
        if (!preset) return false;

        const scope = this.getPresetScope(toolId);
        if (scope) await scope.apply(preset.options, preset.asset);
        else PresetServiceClass.applyToolOptions(toolId, preset.options);

        // The options panel renders from its own facts, and the setters above
        // do not all emit one; a redraw of the active tool's rows is how the
        // sliders come to show what was just put behind them.
        EventBus.emit(EVENTS.TOOL_PRESET_APPLIED, { tool: toolId, name: preset.name });
        return true;
    }

    /**
     * @param {string} toolId @param {string} name
     * @returns {Promise<boolean>}
     */
    async removeToolPreset(toolId, name) {
        const key = PresetServiceClass.normalizeName(name);
        const list = this.listToolPresets(toolId).filter(
            p => PresetServiceClass.normalizeName(p.name) !== key);
        if (list.length === this.listToolPresets(toolId).length) return false;

        if (!await this._persistToolLibrary(toolId, list)) return false;
        // The picture it pointed at may now be referenced by nothing
        await this._collectAssets();

        EventBus.emit(EVENTS.TOOL_PRESETS_CHANGED,
            { tool: toolId, presets: this.listToolPresets(toolId) });
        return true;
    }

    /**
     * Relabel a tool preset. Re-captures nothing — the setup is untouched.
     * Refuses a name another preset of the same tool already holds, rather than
     * producing two entries a list cannot tell apart.
     * @param {string} toolId @param {string} name @param {string} newName
     * @returns {Promise<boolean>}
     */
    async renameToolPreset(toolId, name, newName) {
        const key = PresetServiceClass.normalizeName(name);
        const target = PresetServiceClass.normalizeName(newName);
        if (!target) return false;

        const list = [...this.listToolPresets(toolId)];
        const at = list.findIndex(p => PresetServiceClass.normalizeName(p.name) === key);
        if (at < 0) return false;
        if (target !== key && list.some(p => PresetServiceClass.normalizeName(p.name) === target)) {
            return false;
        }

        const renamed = PresetCodec.encodeToolPreset({
            ...list[at], name: newName, modified: Date.now()
        });
        if (!renamed) return false;
        list[at] = renamed;

        if (!await this._persistToolLibrary(toolId, list)) return false;

        EventBus.emit(EVENTS.TOOL_PRESETS_CHANGED,
            { tool: toolId, presets: this.listToolPresets(toolId) });
        return true;
    }

    /**
     * A name that is not yet taken for this tool: "Brush 1", "Brush 2", ...
     * The save prompt opens with it filled in, so a preset can be filed with
     * one keystroke and renamed later from the panel.
     * @param {string} toolId @param {string} label - the tool's localized name
     * @returns {string}
     */
    suggestToolPresetName(toolId, label) {
        const base = (label || toolId || 'Preset').trim();
        const taken = new Set(this.listToolPresets(toolId)
            .map(p => PresetServiceClass.normalizeName(p.name)));
        for (let n = 1; n <= PresetCodec.SLOT_COUNT * 10; n++) {
            const candidate = `${base} ${n}`;
            if (!taken.has(PresetServiceClass.normalizeName(candidate))) return candidate;
        }
        return base;
    }

    /**
     * Read every tool's list at boot. Storage's localStorage fallback cannot
     * enumerate a store, so the tools are asked for by id from the TOOLS
     * registry — the same accommodation the slot library makes.
     */
    async restoreToolPresets() {
        if (this._toolPresetsRestored) return;
        this._toolPresetsRestored = true;

        let total = 0;
        for (const toolId of this.presetScopeIds()) {
            const key = PresetCodec.toolLibraryKey(toolId);
            if (!key) continue;
            try {
                const payload = await Storage.get(key, Storage.STORES.TOOL_PRESETS);
                if (!payload) continue;
                const list = PresetCodec.decodeToolLibrary(payload, toolId);
                if (list.length) {
                    this._toolLibrary.set(toolId, list);
                    total += list.length;
                }
            } catch (error) {
                Logger.warn('PresetService', `Could not restore presets for ${toolId}`, error);
            }
        }

        Logger.info('PresetService', `Restored ${total} tool preset(s)`);
        EventBus.emit(EVENTS.TOOL_PRESETS_CHANGED, { tool: null, presets: [] });
    }

    /**
     * Write one tool's list, and only keep it in memory if it stored. A list
     * that would not encode is a list that would vanish on the next reload, so
     * the in-memory copy must not diverge from what is on disk.
     * @private
     */
    async _persistToolLibrary(toolId, list) {
        const payload = PresetCodec.encodeToolLibrary(toolId, list);
        if (!payload) {
            Logger.warn('PresetService', `Tool preset list for ${toolId} would not encode`);
            return false;
        }

        try {
            const key = PresetCodec.toolLibraryKey(toolId);
            if (list.length) await Storage.set(key, payload, Storage.STORES.TOOL_PRESETS);
            else await Storage.delete(key, Storage.STORES.TOOL_PRESETS);
        } catch (error) {
            Logger.warn('PresetService', 'Could not persist tool presets', error);
            return false;
        }

        if (list.length) this._toolLibrary.set(toolId, PresetCodec.decodeToolLibrary(payload, toolId));
        else this._toolLibrary.delete(toolId);
        return true;
    }
}

/**
 * Names are compared case-insensitively and whitespace-folded, so "1px Pencil"
 * and "1px  pencil" are the same preset. Two entries a list renders identically
 * are two entries the user cannot choose between.
 * @param {string} name
 * @returns {string}
 */
/**
 * Preset scopes that are NOT tools.
 *
 * A tool scope needs no entry here: its settings are its `optionsSchema` and
 * the generic schema capture handles it. This is for a panel that keeps
 * settings of its own shape — it declares how to read them and how to put them
 * back, and everything else about the library (naming, listing, filing,
 * storage, the asset sweep) treats it exactly like a tool.
 *
 * Each entry:
 *   i18n         label key, so the row and the list can name the scope
 *   canCapture() is there anything to save right now?
 *   capture()    -> { options, asset } | null   (asset = { dataUrl, ... } or null)
 *   apply(o, k)  put it back; k is the stored asset key, or null
 */
PresetServiceClass.PRESET_SCOPES = Object.freeze({
    /*
     * The reference image and where it sits.
     *
     * It delegates to the `reference` SLICE rather than reading
     * ReferenceLayerService itself, so there is ONE definition of what a
     * reference capture consists of and the slot presets and these presets can
     * never drift into disagreeing about it.
     *
     * An image is REQUIRED. A placement with no picture restores an offset
     * against whatever happens to be loaded, which is not a thing anyone means
     * to save — so with no image the scope reports nothing to capture, and the
     * Save button says so rather than filing an empty record.
     */
    reference: {
        i18n: 'panels.reference',

        canCapture() {
            const value = PresetService.getSlice('reference').capture();
            return !!(value && value.assetData && value.assetData.dataUrl);
        },

        /*
         * Split the slice's capture into the two things a preset record holds
         * separately: the placement, and the image that goes to the shared
         * content-addressed store. What that image IS - a link plus a thumbnail
         * rather than the photo - is the slice's decision, not this scope's, so
         * the slot library gets the same treatment. See the slice.
         */
        capture() {
            const value = PresetService.getSlice('reference').capture();
            if (!value || !value.assetData) return null;

            const options = { ...value };
            delete options.assetData;
            return { options, asset: { ...value.assetData } };
        },

        async apply(options, assetKey) {
            // The slice reads the image key off a preset-shaped object, which
            // is the same shape a slot preset hands it.
            return PresetService.getSlice('reference').apply(options, { asset: assetKey });
        },

        /**
         * What the Presets panel prints for a tracing setup. There is no
         * schema to diff against, so this names the things that actually
         * distinguish one placement from another: the picture, how big, and
         * how far over. Scale and opacity are fractions in the state and
         * percentages to a reader.
         */
        describe(options) {
            const out = [];
            const add = (i18n, fallback, value) =>
                out.push({ entry: { key: i18n, i18n, label: fallback }, value });

            if (options.fileName) add('reference.file', 'Image', options.fileName);
            if (options.scale !== undefined && options.scale !== 1) {
                add('reference.scale', 'Scale', `${Math.round(options.scale * 100)}%`);
            }
            if (options.offsetX || options.offsetY) {
                add('reference.offset', 'Offset', `${options.offsetX || 0}, ${options.offsetY || 0}`);
            }
            if (options.rotation) add('reference.rotation', 'Rotation', `${options.rotation}°`);
            return out;
        }
    }
});

PresetServiceClass.normalizeName = function(name) {
    return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
};

// ── The slices ──────────────────────────────────────────────────────────────
//
// Order here is the order the dialogs list them and the order apply() runs
// them, working outwards from the mark: what you draw with (tool and every
// tool's options), then what qualifies the mark (colours, drawing modifiers),
// then the placed content (pattern, reference image), then the palette, and
// the view LAST so a restored zoom and scroll are not moved by anything
// applied after them.

PresetServiceClass.SLICES = Object.freeze([
    {
        id: 'tool',
        i18n: 'preset.slice.tool',
        defaultOn: true,
        document: false,
        modeSensitive: false,

        /**
         * The active tool plus EVERY registered tool's options, so a preset
         * restores the whole toolbox rather than one brush. The active id is
         * the RAIL id (StateManager), not the instance id, so a preset saved on
         * Spray comes back on Spray rather than on the base Brush.
         */
        capture() {
            const tools = {};
            for (const id of ToolManager.getToolIds()) {
                const values = PresetServiceClass.captureToolOptions(id);
                if (values) tools[id] = values;
            }
            return {
                active: StateManager.getCurrentTool() || null,
                tools
            };
        },

        apply(value) {
            if (!value) return;

            // Options first, then selection: selecting rebuilds the options
            // panel from the tool's getters, so the panel shows what we set.
            for (const [id, values] of Object.entries(value.tools || {})) {
                PresetServiceClass.applyToolOptions(id, values);
            }
            // keepSize because selecting a brush VARIANT otherwise raises the
            // size to that variant's floor (spray, hatch, pattern), throwing
            // away the size the line above just restored. The floor is for a
            // fresh button press; a preset has already said what size it wants.
            if (value.active) ToolManager.selectTool(value.active, { keepSize: true });
        }
    },

    {
        id: 'color',
        i18n: 'preset.slice.color',
        defaultOn: true,
        document: false,
        modeSensitive: true,

        capture() {
            const out = {
                ink: ColorManager.getInk(),
                paper: ColorManager.getPaper(),
                bright: ColorManager.getBright(),
                flash: ColorManager.getFlash(),
                border: ColorManager.getBorder(),
                inkTransparent: !!ColorManager.inkTransparent,
                paperTransparent: !!ColorManager.paperTransparent
            };
            // Indexed (Next) and ULAplus modes carry their own selections
            if (typeof ColorManager.getIndexedInk === 'function') {
                out.nextInk = ColorManager.getIndexedInk();
                out.nextPaper = ColorManager.getIndexedPaper();
            }
            if (typeof ColorManager.getClut === 'function') {
                out.clut = ColorManager.getClut();
            }
            if (typeof ColorManager.getTimexHiresInk === 'function') {
                out.timexHiresInk = ColorManager.getTimexHiresInk();
            }
            return out;
        },

        apply(value) {
            if (!value) return;
            if (Number.isFinite(value.ink)) ColorManager.setInk(value.ink);
            if (Number.isFinite(value.paper)) ColorManager.setPaper(value.paper);
            if (typeof value.bright === 'boolean') ColorManager.setBright(value.bright);
            if (typeof value.flash === 'boolean') ColorManager.setFlash(value.flash);
            if (Number.isFinite(value.border)) ColorManager.setBorder(value.border);
            // Both directions, like every other boolean here: a preset saved
            // with opaque ink has to be able to turn transparency back OFF, or
            // recalling it leaves strokes that deposit nothing.
            if (typeof value.inkTransparent === 'boolean') {
                ColorManager.setInkTransparent(value.inkTransparent);
            }
            if (typeof value.paperTransparent === 'boolean') {
                ColorManager.setPaperTransparent(value.paperTransparent);
            }
            if (Number.isFinite(value.nextInk) && typeof ColorManager.setNextInk === 'function') {
                ColorManager.setNextInk(value.nextInk);
            }
            if (Number.isFinite(value.nextPaper) && typeof ColorManager.setNextPaper === 'function') {
                ColorManager.setNextPaper(value.nextPaper);
            }
            if (Number.isFinite(value.clut) && typeof ColorManager.setClut === 'function') {
                ColorManager.setClut(value.clut);
            }
            if (Number.isFinite(value.timexHiresInk) &&
                typeof ColorManager.setTimexHiresInk === 'function') {
                ColorManager.setTimexHiresInk(value.timexHiresInk);
            }
        }
    },

    {
        id: 'drawing',
        i18n: 'preset.slice.drawing',
        defaultOn: true,
        document: false,
        modeSensitive: false,

        /** The stroke modifiers: how a mark lands, rather than what draws it. */
        capture() {
            return {
                drawMode: StateManager.getDrawMode(),
                symmetry: StateManager.getSymmetryMode(),
                clip: StateManager.getClipMode(),
                snap: StateManager.getGridSnap(),
                nudgeStep: StateManager.get('nudgeStep'),
                pixelPerfect: StateManager.get('pixelPerfect'),
                respectCellBoundaries: StateManager.get('respectCellBoundaries')
            };
        },

        apply(value) {
            if (!value) return;
            if (typeof value.drawMode === 'string') StateManager.setDrawMode(value.drawMode);
            if (typeof value.symmetry === 'string') StateManager.setSymmetryMode(value.symmetry);
            if (typeof value.clip === 'string') StateManager.setClipMode(value.clip);
            if (typeof value.snap === 'boolean') StateManager.setGridSnap(value.snap);
            if (Number.isFinite(value.nudgeStep)) {
                StateManager.set('nudgeStep', Helpers.clamp(value.nudgeStep, 1, 32));
            }
            if (typeof value.pixelPerfect === 'boolean') {
                StateManager.set('pixelPerfect', value.pixelPerfect);
            }
            if (typeof value.respectCellBoundaries === 'boolean') {
                StateManager.set('respectCellBoundaries', value.respectCellBoundaries);
            }
        }
    },

    {
        id: 'pattern',
        i18n: 'preset.slice.pattern',
        defaultOn: false,
        document: false,
        modeSensitive: false,

        /**
         * The library path ('8x8/density-50') identifies a pattern across
         * builds; the bitmap itself is generated and lives in the library, so
         * storing it in the preset would only let the two drift apart.
         */
        capture() {
            const pattern = PatternService.getCurrentPattern();
            return pattern ? { path: pattern.path || null } : null;
        },

        async apply(value) {
            if (!value || !value.path) return;
            const pattern = PatternService.getPatternByPath(value.path);
            if (pattern) await PatternService.setCurrentPattern(pattern);
        }
    },

    {
        id: 'reference',
        i18n: 'preset.slice.reference',
        defaultOn: true,
        document: false,
        modeSensitive: false,

        /**
         * The transform AND the picture. Storing the image is what makes the
         * position worth restoring: an offset means nothing against a different
         * photo, so the two travel together or not at all. The bytes go out via
         * `assetData`, which PresetService.capture() lifts into the shared
         * content-addressed asset store.
         *
         * A LINK PLUS A THUMBNAIL, NEVER THE PHOTO. Embedding the full image
         * cost up to 8 MB a preset with nothing capping the collection (M,
         * 2026-08-07: 1.94 GiB reachable, 97% of everything the app could
         * store). What a preset means is a PLACEMENT, so it keeps a file handle
         * to fetch the real photo back at full resolution, and a ~30 KB
         * thumbnail for every case the handle cannot serve - file moved,
         * another machine, permission declined, or a `.zxpreset` shared as
         * JSON, which cannot carry a handle at all. Both preset libraries get
         * this, because both come through here.
         */
        capture() {
            const state = ReferenceLayerService.getState();
            if (!state) return null;

            const value = {
                visible: state.visible,
                opacity: state.opacity,
                offsetX: state.offsetX,
                offsetY: state.offsetY,
                scale: state.scale,
                rotation: state.rotation,
                flipX: state.flipX,
                flipY: state.flipY,
                fileName: state.fileName || ''
            };

            const url = state.imageUrl;
            if (typeof url === 'string' && url.startsWith('data:image/')) {
                const info = ReferenceLayerService.getImageInfo();
                const thumb = window.ImageSource
                    ? ImageSource.thumbnail(ReferenceLayerService.image) : '';
                value.assetData = {
                    // Fall back to the full image only where the thumbnail
                    // could not be drawn at all; a placement with no picture is
                    // worse than a large one.
                    dataUrl: thumb || url,
                    thumbnail: !!thumb,
                    // Structured-cloned into IndexedDB beside the thumbnail;
                    // dropped by the codec's file form, which is JSON.
                    handle: ReferenceLayerService.getFileHandle
                        ? ReferenceLayerService.getFileHandle() : null,
                    fileName: state.fileName || '',
                    width: info ? info.width : 0,
                    height: info ? info.height : 0
                };
            }
            return value;
        },

        /**
         * Transform first, then the image: ReferenceLayerService renders on
         * load, so setting the geometry beforehand means the picture appears
         * already placed rather than jumping into position afterwards.
         */
        async apply(value, preset) {
            if (!value) return;

            ReferenceLayerService.restoreState({
                visible: value.visible,
                opacity: value.opacity,
                offsetX: value.offsetX,
                offsetY: value.offsetY,
                scale: value.scale,
                rotation: value.rotation,
                flipX: value.flipX,
                flipY: value.flipY,
                fileName: value.fileName
            });

            if (!preset || !preset.asset) return;
            const asset = await PresetService.loadAsset(preset.asset);
            if (!asset) {
                Logger.warn('PresetService', 'Reference image missing for preset');
                return;
            }

            // The link first: it is the real photo, at the resolution the
            // artist is actually tracing from.
            if (asset.handle && window.ImageSource) {
                const file = await ImageSource.fileFromHandle(asset.handle);
                if (file) {
                    ReferenceLayerService.loadImage(file, asset.handle);
                    return;
                }
                Logger.info('PresetService',
                    'Linked reference photo unavailable; using the stored thumbnail');
            }

            if (!asset.dataUrl) {
                Logger.warn('PresetService', 'Reference image missing for preset');
                return;
            }
            // A thumbnail standing in for a photo we could not reach is a fact
            // the panel has to be able to state, so it can offer to re-point it.
            ReferenceLayerService.loadImage(asset.dataUrl, null,
                { standIn: !!asset.thumbnail && !!asset.handle });
        }
    },


    {
        id: 'view',
        i18n: 'preset.slice.view',
        defaultOn: false,
        document: false,
        modeSensitive: false,

        /**
         * Where you were looking: zoom, the scroll position under it, and which
         * grids were on. Last in the registry so nothing applied afterwards can
         * move the view out from under the figure just restored.
         */
        capture() {
            const scroll = CanvasSystem.getScrollPosition();
            const value = {
                zoom: StateManager.getZoom(),
                scrollX: scroll ? scroll.x : 0,
                scrollY: scroll ? scroll.y : 0
            };
            if (window.GridOverlay) {
                value.gridPixel = !!GridOverlay.pixelGridVisible;
                value.gridCell  = !!GridOverlay.cellGridVisible;
                value.gridBlock = !!GridOverlay.blockGridVisible;
            }
            return value;
        },

        apply(value) {
            if (!value) return;

            if (window.GridOverlay) {
                if (typeof value.gridPixel === 'boolean') GridOverlay.setPixelGridVisible(value.gridPixel);
                if (typeof value.gridCell === 'boolean') GridOverlay.setCellGridVisible(value.gridCell);
                if (typeof value.gridBlock === 'boolean') GridOverlay.setBlockGridVisible(value.gridBlock);
            }

            if (Number.isFinite(value.zoom)) CanvasSystem.setZoom(value.zoom);

            // The scroll offset is only meaningful once the canvas has been
            // laid out at the new zoom, which happens on the next frame.
            if (Number.isFinite(value.scrollX) && Number.isFinite(value.scrollY)) {
                const apply = () => CanvasSystem.setScrollPosition(value.scrollX, value.scrollY);
                if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
                else apply();
            }
        }
    }
]);

// ── Tool-option capture (schema-driven) ─────────────────────────────────────

/**
 * Read one tool's option values straight from its declared schema.
 *
 * The schema IS the list of what a tool has, and `get<Key>()` IS how the
 * options panel reads it (js/ui/components/option-controls.js), so capture
 * borrows both rather than keeping a copy that can fall behind. A key marked
 * `preset: false` opts out — the text tool's typed string does, because nobody
 * wants yesterday's caption back with their brush.
 *
 * @param {string} toolId
 * @returns {Object|null}
 */
PresetServiceClass.captureToolOptions = function(toolId) {
    const tool = ToolManager.getTool(toolId);
    const schema = tool && tool.constructor ? tool.constructor.optionsSchema : null;
    if (!schema || !schema.length) return null;

    const values = {};
    for (const entry of schema) {
        if (!entry || !entry.key || entry.preset === false) continue;
        if (entry.type === 'hint' || entry.type === 'slot') continue;

        const getter = 'get' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1);
        if (typeof tool[getter] !== 'function') continue;

        const value = tool[getter]();
        const type = typeof value;
        if (value === null || type === 'boolean' || type === 'string' ||
            (type === 'number' && Number.isFinite(value))) {
            values[entry.key] = value;
        }
    }
    return Object.keys(values).length ? values : null;
};

/**
 * Push saved option values back down a tool's setters — the same path
 * OptionControls uses when the user moves a slider.
 * @param {string} toolId @param {Object} values
 */
PresetServiceClass.applyToolOptions = function(toolId, values) {
    const tool = ToolManager.getTool(toolId);
    const schema = tool && tool.constructor ? tool.constructor.optionsSchema : null;
    if (!tool || !schema || !values) return;

    for (const entry of schema) {
        if (!entry || !entry.key || entry.preset === false) continue;
        if (!Object.prototype.hasOwnProperty.call(values, entry.key)) continue;

        const value = PresetServiceClass.validateOption(entry, values[entry.key]);
        if (value === undefined) continue;

        const setterName = entry.setter ||
            ('set' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1));
        if (typeof tool[setterName] === 'function') tool[setterName](value);
    }
};

/**
 * Check a stored value against the schema entry it belongs to.
 *
 * Presets are user data that outlives builds: a preset saved when a slider ran
 * to 64 must not push 64 into a tool whose maximum is now 32, and a select
 * value that no longer exists must not be set at all. Returns undefined for
 * "do not apply this one".
 * @param {Object} entry @param {*} value
 * @returns {*}
 */
PresetServiceClass.validateOption = function(entry, value) {
    if (entry.type === 'range') {
        if (!Number.isFinite(value)) return undefined;
        const min = Number.isFinite(entry.min) ? entry.min : -Infinity;
        const max = Number.isFinite(entry.max) ? entry.max : Infinity;
        return Helpers.clamp(value, min, max);
    }

    if (entry.type === 'check') {
        return typeof value === 'boolean' ? value : undefined;
    }

    if (entry.type === 'select' || entry.type === 'icons') {
        // A dynamic list (system fonts) cannot be checked here — the values it
        // offers depend on the machine, so trust the stored string and let the
        // tool's own setter reject what it does not know.
        if (entry.dynamic) return value;

        // A row may deliberately OFFER less than its setter ACCEPTS: the brush
        // type row lists only round and square, because every other type is a
        // rail button rather than a dropdown entry, yet the tool legitimately
        // holds 'spray'. `presetOptions` is where such an entry declares its
        // real domain; without it a preset saved on the spray brush would come
        // back as a round one (found by tests/preset-slices.test.js).
        const allowed = PresetServiceClass.optionValues(entry.presetOptions || entry.options);
        if (!allowed.length) return value;
        return allowed.some(v => String(v) === String(value)) ? value : undefined;
    }

    return value;
};

/** Flatten a select's entries (optgroups included) to their values. */
PresetServiceClass.optionValues = function(options) {
    const out = [];
    for (const opt of options || []) {
        if (opt && Array.isArray(opt.options)) out.push(...PresetServiceClass.optionValues(opt.options));
        else if (opt && opt.value !== undefined) out.push(opt.value);
    }
    return out;
};

window.PresetService = new PresetServiceClass();
window.PresetServiceClass = PresetServiceClass;

Logger.debug('PresetService', 'Preset service loaded');

})(); // End IIFE
