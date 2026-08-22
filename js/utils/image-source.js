'use strict';
(function() {

/**
 * ImageSource - picking an image, remembering where it came from, and keeping
 * a small stand-in for when it is no longer there.
 *
 * WHY. A reference preset used to embed the whole tracing photo: up to 8 MB of
 * base64 per preset, and nothing capped the collection (M, 2026-08-07: 242
 * distinct assets reachable = 1.94 GiB, 97% of everything the app could store).
 * A preset is a placement, not a photo library.
 *
 * WHAT IT KEEPS INSTEAD. Two things, because either alone fails:
 *
 *   handle    A FileSystemFileHandle, so the FULL-RESOLUTION photo is read back
 *             off disk. Handles structured-clone into IndexedDB (verified on
 *             file://), so they survive a reload.
 *   thumbnail A downscaled data URL, ~30 KB. The handle can fail for reasons
 *             that are nobody's fault - the file moved, the preset came from
 *             another machine, the permission was declined - and a placement
 *             with no picture at all is the exact thing the reference scope
 *             exists to prevent. The thumbnail always loads.
 *
 * The thumbnail is also what travels inside a shared `.zxpreset`, because that
 * file form is JSON and a handle is not serialisable to it.
 *
 * PERMISSION. Chrome will not silently reopen a stored handle in a new session;
 * requestPermission() needs a user gesture. Recalling a preset IS a gesture, so
 * the ask lands on a click the artist already made - but the first recall of a
 * linked photo each session may show a prompt, and if it is declined the
 * thumbnail carries on.
 */

/*
 * Thumbnail size, longest edge.
 *
 * [C] 256 px. It is the fallback shown when the real photo cannot be reached,
 * and its job is to be recognisable and to hold the placement's meaning - not
 * to trace against. At 256 px a JPEG of a photograph is ~20-30 KB, so 242 of
 * them is ~7 MB against the 1.94 GiB the full images could reach. Larger buys
 * detail nobody traces from; smaller stops being recognisable.
 */
const THUMB_MAX_PX = 256;

/*
 * [A] 0.72 JPEG quality. Chosen as the usual "good enough for a preview" point;
 * not measured against these images specifically. It only affects the fallback.
 */
const THUMB_QUALITY = 0.72;

/** Pickers offer these; the same list the file input used. */
const IMAGE_TYPES = Object.freeze({
    description: 'Images',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'] }
});

class ImageSourceClass {
    /** Is the handle path available at all? @returns {boolean} */
    get canLink() {
        return typeof window.showOpenFilePicker === 'function';
    }

    /**
     * Ask the artist for an image.
     *
     * Uses showOpenFilePicker when it exists, because only that returns a
     * handle we can store; falls back to a hidden <input type="file">, which
     * gives the file but no way back to it later. MUST be called from a user
     * gesture either way.
     * @returns {Promise<{file: File, handle: Object|null}|null>} null if cancelled
     */
    async pick() {
        if (this.canLink) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [IMAGE_TYPES], multiple: false, excludeAcceptAllOption: false
                });
                if (!handle) return null;
                return { file: await handle.getFile(), handle };
            } catch (error) {
                // AbortError is the artist closing the dialog, not a failure
                if (error && error.name === 'AbortError') return null;
                Logger.warn('ImageSource', 'File picker unavailable; falling back', error);
            }
        }
        const file = await this._pickWithInput();
        return file ? { file, handle: null } : null;
    }

    /** @private */
    _pickWithInput() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'image-source-file-input';
            input.name = 'image-source-file-input';
            input.accept = 'image/*';
            input.hidden = true;
            input.addEventListener('change', () => {
                const file = input.files && input.files[0];
                input.remove();
                resolve(file || null);
            });
            // A cancelled dialog fires no event in most browsers, so the
            // promise simply never settles - the element is removed with the
            // dialog's own lifetime and nothing is left running.
            document.body.appendChild(input);
            input.click();
        });
    }

    /**
     * Read the file back from a stored handle.
     *
     * Two shapes reach here, and the shape is what decides how to read it -
     * never a session-local "which provider is preferred" flag. A handle
     * can be restored from a preset captured in an earlier session (its own
     * or a companion install's), so it has to resolve by what it actually
     * IS, not by whatever this session happens to be configured for right
     * now. Trusting a flag instead of the value's own shape is exactly the
     * bug `BackupService` shipped and then had to fix (see
     * `js/services/backup-service.js` `initialize()` and its
     * `_isValidFolderRef`/shape-inference comment) - this starts with that
     * fix already applied rather than repeating the mistake:
     *
     *   - a `FileSystemFileHandle` (has `.getFile`) -> the existing browser
     *     FSA permission dance, unchanged.
     *   - a companion-shaped `{folderId, relPath}` (design spec s6.2) ->
     *     read through whatever `CompanionBridgeService.getProvider()`
     *     returns RIGHT NOW, re-derived on every call rather than cached,
     *     so a pairing that lapsed since the handle was captured reads back
     *     as "unreachable" (-> thumbnail), never as a thrown error.
     *
     * Returns null for every ordinary reason either path can fail - moved,
     * renamed, deleted, permission declined, companion not paired - because
     * all of them mean the same thing to the caller: use the thumbnail.
     * @param {Object} handle - FileSystemFileHandle, a companion-shaped
     *   {folderId, relPath, fileName?, mimeType?}, or a stub in tests
     * @returns {Promise<File|null>}
     */
    async fileFromHandle(handle) {
        if (!handle) return null;
        if (typeof handle.getFile === 'function') return this._browserFileFromHandle(handle);
        if (typeof handle.folderId === 'string' && typeof handle.relPath === 'string') {
            return this._companionFileFromHandle(handle);
        }
        return null;
    }

    /** @private */
    async _browserFileFromHandle(handle) {
        try {
            if (typeof handle.queryPermission === 'function') {
                let state = await handle.queryPermission({ mode: 'read' });
                if (state === 'prompt' && typeof handle.requestPermission === 'function') {
                    state = await handle.requestPermission({ mode: 'read' });
                }
                if (state !== 'granted') return null;
            }
            return await handle.getFile();
        } catch (error) {
            Logger.info('ImageSource', 'Linked file unavailable; using thumbnail', error);
            return null;
        }
    }

    /** @private */
    async _companionFileFromHandle(handle) {
        const provider = window.CompanionBridgeService && CompanionBridgeService.getProvider();
        if (!provider) {
            Logger.info('ImageSource', 'Companion not paired; using thumbnail');
            return null;
        }
        try {
            const bytes = await provider.readFile(handle.folderId, handle.relPath);
            const name = handle.fileName || handle.relPath.split('/').pop() || 'image';
            return new File([bytes], name, { type: handle.mimeType || this._guessMimeType(name) });
        } catch (error) {
            Logger.info('ImageSource', 'Linked file unavailable; using thumbnail', error);
            return null;
        }
    }

    /** Extension -> MIME, for the companion path (no browser File to read a type from). @private */
    _guessMimeType(name) {
        const ext = String(name).split('.').pop().toLowerCase();
        const MIME_BY_EXT = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp'
        };
        return MIME_BY_EXT[ext] || 'application/octet-stream';
    }

    /**
     * A downscaled data URL of an already-loaded image.
     * @param {HTMLImageElement} img
     * @param {number} [maxPx]
     * @returns {string} data URL, or '' if it could not be drawn
     */
    thumbnail(img, maxPx = THUMB_MAX_PX) {
        if (!img || !img.naturalWidth || !img.naturalHeight) return '';

        // Downscale only: an image already smaller than the box is kept as it
        // is rather than blown up into a bigger, blurrier "thumbnail".
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = longest > maxPx ? maxPx / longest : 1;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = Helpers.createCanvas(w, h);
        const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return '';

        ctx.drawImage(img, 0, 0, w, h);
        try {
            // JPEG: a photograph's thumbnail is a third the size of the PNG and
            // the artefacts do not matter at this size. PNG would keep alpha,
            // which a tracing reference does not need.
            return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
        } catch (error) {
            Logger.warn('ImageSource', 'Thumbnail encode failed', error);
            return '';
        }
    }

    /** File -> data URL, for the no-handle fallback path. @returns {Promise<string>} */
    dataUrlFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }
}

ImageSourceClass.THUMB_MAX_PX = THUMB_MAX_PX;

window.ImageSource = new ImageSourceClass();

Logger.debug('ImageSource', 'Image source loaded');

})(); // End IIFE
