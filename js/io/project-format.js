'use strict';
(function() {

/**
 * ProjectFormat - `.pixula`, the whole document as a file.
 *
 * WHY IT EXISTS. Every other format in js/io/ is a PICTURE: one screen,
 * flattened, in whatever byte layout its target program reads. Save defaulted
 * to `.scr`, which is 6,912 bytes of one composited screen - so until this
 * existed there was no way to put a 32-layer document on disk and get it back.
 * That is fine for handing a picture to an emulator and useless as a backup,
 * which is what versioned autosave needs.
 *
 * WHAT IT IS. Exactly the payload `App._getProjectData()` already produces and
 * `App._loadProjectData()` already restores. That is deliberate: the autosave
 * record in IndexedDB and this file are THE SAME OBJECT, so a restore path
 * that works for one cannot rot for the other. Adding a field to the snapshot
 * puts it in the file for free. Two parts:
 *
 *   - The document itself: layers, screen mode, both palette register files,
 *     the Timex hi-res ink.
 *   - `slices`: the SAME six `PresetServiceClass.SLICES` a workspace preset
 *     captures (tool - every tool's options, not just which is active - plus
 *     colour, drawing modifiers, pattern, reference image + placement, and
 *     view), applied through `PresetService.applyCapturedSlices()` - one
 *     mechanism, not a second one reimplemented here. Everything genuinely
 *     app-level (theme, locale, pen mapping, autosave interval - `pref.*`
 *     Storage keys) stays OUT, matching every mainstream art tool surveyed
 *     when this scope was decided (2026-08-23): none of them put install
 *     preferences in a document either. The undo/redo stack ALSO stays out,
 *     on purpose - no mainstream tool persists a live command stack across a
 *     save/reopen, and PixULA's own history is byte-budget-capped precisely
 *     because it was built assuming it never has to survive one.
 *
 * THE REFERENCE IMAGE IS EMBEDDED, NOT LINKED. Every other place a reference
 * photo travels (a preset, a `.zxpreset` file) keeps a link-plus-thumbnail
 * ONLY - never the photo - because a preset is a small, frequently-recalled
 * settings snippet and embedding cost 1.94 GiB once, unbounded, across a
 * whole library (M, 2026-08-07). Neither risk applies to a `.pixula`: it is
 * one file, one image, saved because the artist explicitly asked to save
 * THIS project, not accumulated silently in a database. And a
 * `FileSystemFileHandle` cannot survive JSON regardless of policy - the
 * SAME reason `PresetCodec.encodeFile` already drops it for a shared
 * `.zxpreset` - so "link only" would mean re-locating the source photo on
 * every single reopen, including seconds later on the same machine. So
 * `.pixula` embeds the image itself (via `ImageSource.thumbnail()`, same
 * function presets use, at REFERENCE_IMAGE_MAX_PX/_QUALITY instead of the
 * preset-sized default) and drops the handle unconditionally.
 * REFERENCE_IMAGE_MAX_PX is a reasoned starting figure, not a measured one
 * [C, 2026-08-23]: PixULA's largest working canvas is 640x256
 * (LAYER2_640) and a reference is only ever traced at some zoom multiple of
 * that, so resolution past what a generous tracing-zoom ceiling could ever
 * show buys nothing - it was not checked against a corpus of real reference
 * photos, so treat it as the one figure in this file worth revisiting.
 *
 * ON DISK. gzip of the UTF-8 JSON, via the platform's own CompressionStream -
 * no library, and the app stays dependency-free. It matters at this size: a
 * fully-painted 32-layer 640x256 document is 56,124,434 B of JSON (M,
 * 2026-08-07). Where CompressionStream is missing the plain JSON is written
 * instead; decode sniffs the gzip magic (1f 8b) and handles either, so files
 * stay readable across both paths and a `.pixula` written by an older build
 * still opens - `App._loadProjectData()` still reads a pre-slices file's
 * `state` block for exactly that reason.
 *
 * NOT A PICTURE FORMAT. No emulator or converter reads this - it is ours. Use
 * SCR/PNG/NXI to hand the artwork to anything else.
 */

/** gzip magic, so decode can tell a compressed file from bare JSON. */
const GZIP_MAGIC = [0x1F, 0x8B];

/*
 * Typed arrays do not survive JSON, and the failure is SILENT.
 *
 * A layer cell holds `pixels` as a Uint8Array and, in indexed modes, `indices`
 * as an Int16Array. `JSON.stringify` has no representation for either: it emits
 * a plain object of numeric keys, `{"0":255,"1":0,...}`, and `JSON.parse` hands
 * back exactly that. `LayerManager.restoreFromData` then sees a truthy
 * `attributeData` and carries on, so the file loads, the layers are all there,
 * the names and opacities are right - and every pixel is gone.
 *
 * The autosave record hides this because IndexedDB uses STRUCTURED CLONE, which
 * preserves typed arrays natively. The moment the same payload goes to JSON it
 * stops being true, which is why this lives here and not in the snapshot: the
 * snapshot is not JSON-safe and was never required to be.
 *
 * So typed arrays are tagged and base64'd on the way out and rebuilt on the way
 * in. Base64 rather than a number array because a number array costs about 2x
 * (M, 2026-08-07, measured on the pattern store) for the same bytes.
 */
const TYPED_ARRAYS = Object.freeze({
    Uint8Array, Int8Array, Uint8ClampedArray,
    Uint16Array, Int16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array
});

/** The marker key. Chosen to be one no document field would ever use. */
const TA_TAG = '$ta';

/** Bumped only for a change decode cannot infer; the payload carries its own `version`. */
const CONTAINER_VERSION = 1;

/*
 * The embedded reference image's size/quality cap - see the doc comment
 * above ("THE REFERENCE IMAGE IS EMBEDDED, NOT LINKED") for the reasoning
 * and its provenance ([C], not measured against real photos).
 */
const REFERENCE_IMAGE_MAX_PX = 4096;
const REFERENCE_IMAGE_QUALITY = 0.9;

/** Every slice a project restores - see the doc comment above. */
const PROJECT_SLICE_IDS = Object.freeze(['tool', 'color', 'drawing', 'pattern', 'reference', 'view']);

class ProjectFormatClass {
    constructor() {
        this.extension = 'pixula';
        this.mimeType = 'application/gzip';
        // Instance properties, not class statics: window.ProjectFormat is
        // the singleton every caller actually holds, and a class-static
        // (ProjectFormatClass.X) is invisible from an instance without
        // reaching through .constructor first.
        this.REFERENCE_IMAGE_MAX_PX = REFERENCE_IMAGE_MAX_PX;
        this.REFERENCE_IMAGE_QUALITY = REFERENCE_IMAGE_QUALITY;
        this.SLICE_IDS = PROJECT_SLICE_IDS;
    }

    /** Is the platform's gzip available? @returns {boolean} */
    get canCompress() {
        return typeof CompressionStream === 'function';
    }

    /**
     * The document as file bytes.
     * @param {Object} project - an `App._getProjectData()` payload
     * @returns {Promise<Uint8Array|null>}
     */
    async encode(project) {
        if (!project || typeof project !== 'object') {
            Logger.warn('ProjectFormat', 'Nothing to encode');
            return null;
        }

        const json = JSON.stringify(
            { ...project, container: CONTAINER_VERSION }, ProjectFormatClass.replacer);
        const bytes = new TextEncoder().encode(json);
        if (!this.canCompress) return bytes;

        try {
            return await this._gzip(bytes);
        } catch (error) {
            // A document that will not compress must still save.
            Logger.warn('ProjectFormat', 'gzip failed; writing plain JSON', error);
            return bytes;
        }
    }

    /**
     * File bytes back to a document.
     * @param {Uint8Array|ArrayBuffer} data
     * @returns {Promise<Object|null>} null if it is not one of ours
     */
    async decode(data) {
        let bytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
        if (!bytes.length) return null;

        if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
            try {
                bytes = await this._gunzip(bytes);
            } catch (error) {
                Logger.error('ProjectFormat', 'Could not decompress project', error);
                return null;
            }
        }

        try {
            const project = JSON.parse(
                new TextDecoder().decode(bytes), ProjectFormatClass.reviver);
            // Layers are the point; a payload without them is some other JSON
            // that happens to be sitting behind our extension.
            if (!project || !Array.isArray(project.layers)) {
                Logger.warn('ProjectFormat', 'Not a project file (no layers)');
                return null;
            }
            return project;
        } catch (error) {
            Logger.error('ProjectFormat', 'Could not parse project', error);
            return null;
        }
    }

    /** @private */
    async _gzip(bytes) {
        const stream = new Blob([bytes]).stream()
            .pipeThrough(new CompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    /** @private */
    async _gunzip(bytes) {
        const stream = new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // --- FormatRegistry adapters ---------------------------------------

    /**
     * Import: hand the parsed document to the app's own restore path.
     *
     * Returns `{success, error}`, the contract every OTHER format handler's
     * parse() already follows (see e.g. SCRFormat.importScreen) - this one
     * used to return a bare boolean, which FileManager.loadFile() reads as
     * `result.success` regardless: `true.success` and `false.success` are
     * both `undefined`, so `!result.success` was ALWAYS true and every
     * `.pixula` opened through File > Load Project... logged
     * Logger.error('FileManager', undefined) and quietly skipped
     * currentFilename/hasUnsavedChanges/the recent-files entry, even on a
     * clean load. Nothing caught it because every existing caller of this
     * method (autosave restore, the backup round-trip test) calls it
     * directly, bypassing FileManager.loadFile() entirely.
     */
    async parse(data) {
        const project = await this.decode(data);
        if (!project) return { success: false, error: 'Not a valid .pixula project file' };
        await App._loadProjectData(project);
        LayerManager.composeToCanvas();
        return { success: true };
    }

    /** Export: the live document as bytes. */
    async export() {
        return this.encode(App._getProjectData());
    }

    /** Export + download, the FormatRegistry export contract. */
    async exportAndDownload(filename) {
        const bytes = await this.export();
        if (!bytes) return false;
        FormatRegistry.download(bytes, filename, this.mimeType);
        return true;
    }
}

/** Bytes -> base64, chunked so a large layer cannot blow the argument limit. */
function toBase64(u8) {
    let out = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < u8.length; i += CHUNK) {
        out += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
    }
    return btoa(out);
}

/** base64 -> bytes. */
function fromBase64(str) {
    const bin = atob(str);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
}

/** JSON replacer: tag and encode any typed array. */
ProjectFormatClass.replacer = function(key, value) {
    // `this[key]` is the ORIGINAL value; `value` has already been through any
    // toJSON, which for a typed array means nothing - but reading the original
    // keeps this correct if that ever changes.
    const raw = this[key];
    if (!raw || !ArrayBuffer.isView(raw) || raw instanceof DataView) return value;
    const type = raw.constructor.name;
    if (!TYPED_ARRAYS[type]) return value;
    return {
        [TA_TAG]: type,
        d: toBase64(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))
    };
};

/** JSON reviver: rebuild a tagged typed array. */
ProjectFormatClass.reviver = function(key, value) {
    if (!value || typeof value !== 'object' || !value[TA_TAG]) return value;
    const Ctor = TYPED_ARRAYS[value[TA_TAG]];
    if (!Ctor) return value;
    const bytes = fromBase64(value.d || '');
    return new Ctor(bytes.buffer, bytes.byteOffset, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
};

window.ProjectFormat = new ProjectFormatClass();

if (window.FormatRegistry) {
    FormatRegistry.registerImport('pixula', window.ProjectFormat);
    FormatRegistry.registerExport('pixula', window.ProjectFormat);
}

Logger.debug('ProjectFormat', 'Project format loaded');

})(); // End IIFE
