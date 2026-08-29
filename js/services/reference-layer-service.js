/**
 * Reference Layer Service
 *
 * Manages reference images that can be overlaid on the canvas for tracing.
 * Reference images are non-editable and always sit ABOVE the main canvas: the
 * ZX document paints paper in every cell, so it is opaque and anything stacked
 * under it is invisible. Tracing works through the layer's opacity, not through
 * stacking order — hence there is no above/below choice to make.
 *
 * Ported from the old app's ui/reference-layer-manager.js — the logic lives in
 * services/ now. It gets its canvas element from CanvasSystem.
 * createOverlayCanvas() (the one module allowed to touch the DOM TREE — add,
 * remove or reparent nodes) rather than creating one itself, but it then owns
 * that canvas outright: drawing into its 2D context, loading images into it,
 * and setting its element's inline size/position/display. That is normal
 * canvas-layer ownership, not a DOM-tree violation — it is the same shape of
 * exception canvas-system.js and input-handler.js already have, and it is on
 * the lint's allowlist for exactly that reason (tests/lint-architecture.test.js's
 * dom-in-logic-layer rule, which also checks inline-style mutation now).
 */

'use strict';
(function() {

class ReferenceLayerServiceClass {
    constructor() {
        this.canvas = null;
        this.ctx = null;

        this.image = null;
        this.imageUrl = null;
        this.fileName = null;

        /*
         * Where the picture came from on disk, when the picker gave us a way
         * back to it. Reference PRESETS store this instead of the photo: a
         * placement is a few hundred bytes and a tracing photo was up to 8 MB.
         * Null whenever the image arrived by any other route - a plain file
         * input, a data URL, or a preset falling back to its thumbnail.
         */
        this.fileHandle = null;

        /**
         * True while the loaded picture is a preset's thumbnail standing in for
         * a photo the link could not reach. It is far too small to trace from,
         * so the panel says so and offers to re-point the link.
         */
        this.isStandIn = false;

        this.visible = true;
        this.opacity = 50;

        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 100;
        this.rotation = 0;
        this.flipX = false;
        this.flipY = false;

        this.lockAspectRatio = true;
        this.fitMode = 'none';

        this._initialized = false;
        this._eventUnsubscribers = [];
    }

    /**
     * Initialize the reference layer system
     */
    initialize() {
        if (this._initialized) return;

        // Wait for CanvasSystem to be ready with iframe
        CanvasSystem.onReady(() => {
            this._createCanvas();
            if (!this.canvas) {
                Logger.warn('ReferenceLayerService', 'Could not create overlay canvas (iframe not ready?)');
                return;
            }

            this._setupEventListeners();
            this._loadState();

            this._initialized = true;
            Logger.info('ReferenceLayerService', 'Initialized');
        });
    }

    /**
     * Create the reference layer canvas via the CanvasSystem overlay seam.
     * z-index 450 puts it over the drawing and the cursor overlay (400).
     * @private
     */
    _createCanvas() {
        this.canvas = CanvasSystem.createOverlayCanvas({
            id: 'reference-layer-canvas',
            className: 'reference-layer-canvas',
            zIndex: 450
        });
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.ctx.imageSmoothingEnabled = false;

        this._updateVisibility();
    }

    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Store unsubscribe functions for cleanup
        this._eventUnsubscribers.push(
            EventBus.on(EVENTS.CANVAS_ZOOM, (data) => {
                this._updateCanvasSize(data.zoom);
            }),
            EventBus.on(EVENTS.REFERENCE_LOAD, (data) => {
                // `handle` is present only when the picker could give one; it
                // is what lets a preset link to the photo instead of embedding
                // it. Absent for drag-drop, a plain input, or a data URL.
                this.loadImage(data.file || data.url, data.handle || null);
            }),
            EventBus.on(EVENTS.REFERENCE_CLEAR, () => {
                this.clearImage();
            }),
            EventBus.on(EVENTS.REFERENCE_VISIBILITY, (data) => {
                this.setVisible(data.visible);
            }),
            EventBus.on(EVENTS.REFERENCE_OPACITY, (data) => {
                this.setOpacity(data.opacity);
            }),
            EventBus.on(EVENTS.REFERENCE_OFFSET, (data) => {
                this.setOffset(data.x, data.y);
            }),
            EventBus.on(EVENTS.REFERENCE_SCALE, (data) => {
                this.setScale(data.scale);
            }),
            EventBus.on(EVENTS.REFERENCE_ROTATION, (data) => {
                this.setRotation(data.rotation);
            }),
            EventBus.on(EVENTS.REFERENCE_FLIP, (data) => {
                this.setFlip(data.flipX, data.flipY);
            }),
            EventBus.on(EVENTS.REFERENCE_FIT, (data) => {
                this.fitToCanvas(data.mode);
            }),
            EventBus.on(EVENTS.REFERENCE_CENTER, () => {
                this.centerImage();
            }),
            EventBus.on(EVENTS.REFERENCE_RESET, () => {
                this.resetTransform();
            })
        );
    }

    /**
     * Load a reference image from file or URL
     * @param {File|string} source - File object or URL
     * @param {Object|null} [handle] - FileSystemFileHandle, so a preset saved
     *   against this image can link to it rather than embedding it
     * @param {{standIn?: boolean}} [options] - standIn marks the picture as a
     *   preset's low-resolution stand-in for a photo that could not be reached,
     *   which the panel says out loud rather than letting someone trace it
     */
    loadImage(source, handle = null, options = {}) {
        if (!source) return;

        // Set before the async decode, so REFERENCE_LOADED already carries it
        // and anything saving a preset on that fact sees the right handle.
        this.fileHandle = handle;
        this.isStandIn = !!(options && options.standIn);

        if (source instanceof File) {
            this._loadFromFile(source);
        } else if (typeof source === 'string') {
            this._loadFromUrl(source);
        }
    }

    /** The disk handle for the current image, or null if there is no way back. */
    getFileHandle() { return this.fileHandle; }

    /** Is the loaded picture a stand-in for a photo the link could not reach? */
    isStandingIn() { return this.isStandIn; }

    /**
     * Load image from File object
     * @param {File} file - Image file
     * @private
     */
    _loadFromFile(file) {
        if (!file.type.startsWith('image/')) {
            Logger.warn('ReferenceLayerService', 'Invalid file type: ' + file.type);
            return;
        }

        this.fileName = file.name;

        Helpers.readFileAsDataURL(file)
            .then((dataUrl) => this._loadFromUrl(dataUrl))
            .catch(() => Logger.error('ReferenceLayerService', 'Failed to read file'));
    }

    /**
     * Load image from URL or data URL
     * @param {string} url - Image URL
     * @private
     */
    _loadFromUrl(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            this.image = img;
            this.imageUrl = url;

            if (!this.fileName && !url.startsWith('data:')) {
                const parts = url.split('/');
                this.fileName = parts[parts.length - 1];
            }

            this._render();
            this._saveState();

            EventBus.emit(EVENTS.REFERENCE_LOADED, {
                width: img.naturalWidth,
                height: img.naturalHeight,
                fileName: this.fileName,
                standIn: this.isStandIn
            });

            Logger.info('ReferenceLayerService', 'Image loaded: ' + this.fileName);
        };

        img.onerror = () => {
            Logger.error('ReferenceLayerService', 'Failed to load image');
            EventBus.emit(EVENTS.REFERENCE_ERROR, { message: 'Failed to load image' });
        };

        img.src = url;
    }

    /**
     * Clear the reference image
     */
    clearImage() {
        this.image = null;
        this.imageUrl = null;
        this.fileName = null;
        // The link goes with the picture, or the next preset saved would claim
        // to point at a photo that is no longer loaded.
        this.fileHandle = null;
        this.isStandIn = false;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_CLEARED);
        Logger.info('ReferenceLayerService', 'Image cleared');
    }

    /**
     * Render the reference image
     * @private
     */
    _render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.image || !this.visible) return;

        this.ctx.save();
        this.ctx.globalAlpha = this.opacity / 100;

        const scaleValue = this.scale / 100;
        const imgWidth = this.image.naturalWidth * scaleValue;
        const imgHeight = this.image.naturalHeight * scaleValue;

        const centerX = this.offsetX + imgWidth / 2;
        const centerY = this.offsetY + imgHeight / 2;

        this.ctx.translate(centerX, centerY);

        if (this.rotation !== 0) {
            this.ctx.rotate((this.rotation * Math.PI) / 180);
        }

        this.ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);

        this.ctx.drawImage(
            this.image,
            -imgWidth / 2,
            -imgHeight / 2,
            imgWidth,
            imgHeight
        );

        this.ctx.restore();
    }

    /**
     * The reference layer canvas lives inside #canvas-container, which already applies the
     * zoom via a CSS scale transform. Sizing this canvas in already-scaled pixels would
     * compound with that transform (e.g. 10× at 1000% zoom), making it 100× the intrinsic
     * size and blowing out the iframe's scrollable area. Keep CSS dimensions at intrinsic
     * ZX size; the parent transform handles visual scaling.
     * @param {number} zoom - Zoom percentage (unused; kept for event-handler signature)
     * @private
     */
    _updateCanvasSize(zoom) {
        if (!this.canvas) return;
        this.canvas.style.width  = `${ZX_SPECTRUM.WIDTH}px`;
        this.canvas.style.height = `${ZX_SPECTRUM.HEIGHT}px`;
    }

    /**
     * Update canvas visibility
     * @private
     */
    _updateVisibility() {
        this.canvas.style.display = this.visible ? '' : 'none';
    }

    /**
     * Set visibility
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        this.visible = visible;
        this._updateVisibility();
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_VISIBILITY_CHANGED, { visible });
    }

    /**
     * Get visibility state
     * @returns {boolean}
     */
    isVisible() {
        return this.visible;
    }

    /**
     * Toggle visibility
     * @returns {boolean} New visibility state
     */
    toggleVisible() {
        this.setVisible(!this.visible);
        return this.visible;
    }

    /**
     * Set opacity
     * @param {number} opacity - Opacity (0-100)
     */
    setOpacity(opacity) {
        this.opacity = Helpers.clamp(opacity, 0, 100);
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_OPACITY_CHANGED, { opacity: this.opacity });
    }

    /**
     * Get opacity
     * @returns {number}
     */
    getOpacity() {
        return this.opacity;
    }

    /**
     * Set offset
     * @param {number} x - X offset in pixels
     * @param {number} y - Y offset in pixels
     */
    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_OFFSET_CHANGED, { x, y });
    }

    /**
     * Announce the current transform as facts.
     *
     * For the operations that move the image WITHOUT the caller naming a
     * value - Center, Fit, Fill - which each announced only what they DID
     * ("centered", "fitted") and never what CHANGED. The panel's fields
     * follow the fact events, so they went stale, and the direction pad
     * computes its next nudge from the field: pressing an arrow after Center
     * wrote the pre-Center value straight back and the image jumped. That is
     * the bug this exists to prevent, but it was never only about the pad -
     * any listener reading these facts was being lied to.
     *
     * The "what I did" events are kept as well, because something may care
     * that a fit HAPPENED rather than merely that the numbers moved.
     * @private
     */
    _announceTransform() {
        EventBus.emit(EVENTS.REFERENCE_OFFSET_CHANGED, { x: this.offsetX, y: this.offsetY });
        EventBus.emit(EVENTS.REFERENCE_SCALE_CHANGED, { scale: this.scale });
        EventBus.emit(EVENTS.REFERENCE_ROTATION_CHANGED, { rotation: this.rotation });
        EventBus.emit(EVENTS.REFERENCE_FLIP_CHANGED, { flipX: this.flipX, flipY: this.flipY });
    }

    /**
     * Get offset
     * @returns {Object} { x, y }
     */
    getOffset() {
        return { x: this.offsetX, y: this.offsetY };
    }

    /**
     * Set scale
     * @param {number} scale - Scale percentage (-99-500). Negative mirrors
     *   the image at |scale| - _render()'s drawImage call flips its source
     *   for free when the destination width/height goes negative.
     */
    setScale(scale) {
        this.scale = Helpers.clamp(scale, -99, 500);
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_SCALE_CHANGED, { scale: this.scale });
    }

    /**
     * Get scale
     * @returns {number}
     */
    getScale() {
        return this.scale;
    }

    /**
     * Set rotation
     * @param {number} rotation - Rotation in degrees (0-360)
     */
    setRotation(rotation) {
        this.rotation = ((rotation % 360) + 360) % 360;
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_ROTATION_CHANGED, { rotation: this.rotation });
    }

    /**
     * Get rotation
     * @returns {number}
     */
    getRotation() {
        return this.rotation;
    }

    /**
     * Set flip state
     * @param {boolean} flipX - Flip horizontally
     * @param {boolean} flipY - Flip vertically
     */
    setFlip(flipX, flipY) {
        if (flipX !== undefined) this.flipX = flipX;
        if (flipY !== undefined) this.flipY = flipY;
        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_FLIP_CHANGED, { flipX: this.flipX, flipY: this.flipY });
    }

    /**
     * Get flip state
     * @returns {Object} { flipX, flipY }
     */
    getFlip() {
        return { flipX: this.flipX, flipY: this.flipY };
    }

    /**
     * Fit image to canvas
     * @param {string} mode - 'contain', 'cover', 'stretch', or 'none'
     */
    fitToCanvas(mode = 'contain') {
        if (!this.image) return;

        this.fitMode = mode;
        const imgWidth = this.image.naturalWidth;
        const imgHeight = this.image.naturalHeight;
        const canvasWidth = ZX_SPECTRUM.WIDTH;
        const canvasHeight = ZX_SPECTRUM.HEIGHT;

        let newScale = 100;
        let newOffsetX = 0;
        let newOffsetY = 0;

        switch (mode) {
            case 'contain': {
                const scaleX = canvasWidth / imgWidth;
                const scaleY = canvasHeight / imgHeight;
                newScale = Math.min(scaleX, scaleY) * 100;
                break;
            }
            case 'cover': {
                const scaleX = canvasWidth / imgWidth;
                const scaleY = canvasHeight / imgHeight;
                newScale = Math.max(scaleX, scaleY) * 100;
                break;
            }
            case 'stretch': {
                newScale = 100;
                break;
            }
            case 'none':
            default:
                newScale = 100;
                break;
        }

        const scaledWidth = imgWidth * (newScale / 100);
        const scaledHeight = imgHeight * (newScale / 100);
        newOffsetX = (canvasWidth - scaledWidth) / 2;
        newOffsetY = (canvasHeight - scaledHeight) / 2;

        this.scale = newScale;
        this.offsetX = newOffsetX;
        this.offsetY = newOffsetY;
        this.rotation = 0;

        this._render();
        this._saveState();

        // Fit/Fill move the offset AND the scale AND clear the rotation, so
        // all three facts have to go out - the scale slider went stale here
        // for the same reason the offset fields did.
        this._announceTransform();
        EventBus.emit(EVENTS.REFERENCE_FITTED, { mode, scale: newScale });
    }

    /**
     * Center image on canvas
     */
    centerImage() {
        if (!this.image) return;

        const scaleValue = this.scale / 100;
        const imgWidth = this.image.naturalWidth * scaleValue;
        const imgHeight = this.image.naturalHeight * scaleValue;

        this.offsetX = (ZX_SPECTRUM.WIDTH - imgWidth) / 2;
        this.offsetY = (ZX_SPECTRUM.HEIGHT - imgHeight) / 2;

        this._render();
        this._saveState();

        this._announceTransform();
        EventBus.emit(EVENTS.REFERENCE_CENTERED);
    }

    /**
     * Reset all transform properties to defaults
     */
    resetTransform() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 100;
        this.rotation = 0;
        this.flipX = false;
        this.flipY = false;

        this._render();
        this._saveState();

        EventBus.emit(EVENTS.REFERENCE_TRANSFORM_RESET);
    }

    /**
     * Check if an image is loaded
     * @returns {boolean}
     */
    hasImage() {
        return this.image !== null;
    }

    /**
     * Get image info
     * @returns {Object|null}
     */
    getImageInfo() {
        if (!this.image) return null;

        return {
            width: this.image.naturalWidth,
            height: this.image.naturalHeight,
            fileName: this.fileName
        };
    }

    /**
     * Get current state
     * @returns {Object}
     */
    getState() {
        return {
            visible: this.visible,
            opacity: this.opacity,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            scale: this.scale,
            rotation: this.rotation,
            flipX: this.flipX,
            flipY: this.flipY,
            fileName: this.fileName,
            imageUrl: this.imageUrl
        };
    }

    /**
     * Restore state from object.
     * A `position` field from a pre-removal session is ignored, not honoured —
     * restoring 'below' would hide the layer under the opaque document.
     * @param {Object} state - State to restore
     */
    restoreState(state) {
        if (!state) return;

        if (state.visible !== undefined) this.visible = state.visible;
        if (state.opacity !== undefined) this.opacity = state.opacity;
        if (state.offsetX !== undefined) this.offsetX = state.offsetX;
        if (state.offsetY !== undefined) this.offsetY = state.offsetY;
        if (state.scale !== undefined) this.scale = state.scale;
        if (state.rotation !== undefined) this.rotation = state.rotation;
        if (state.flipX !== undefined) this.flipX = state.flipX;
        if (state.flipY !== undefined) this.flipY = state.flipY;
        if (state.fileName !== undefined) this.fileName = state.fileName;

        this._updateVisibility();

        if (state.imageUrl) {
            this._loadFromUrl(state.imageUrl);
        } else {
            this._render();
        }

        // Restoring is a wholesale transform change - recalling a preset,
        // opening a .pixula, reloading the app - so the facts go out for the
        // same reason Center and Fit send them. Without this the panel showed
        // the PREVIOUS image's placement after a preset was recalled, and the
        // first press of the direction pad wrote that stale placement back.
        this._announceTransform();
        EventBus.emit(EVENTS.REFERENCE_OPACITY_CHANGED, { opacity: this.opacity });
        EventBus.emit(EVENTS.REFERENCE_VISIBILITY_CHANGED, { visible: this.visible });
    }

    /**
     * Save state to storage
     * @private
     */
    _saveState() {
        const state = this.getState();
        delete state.imageUrl;
        Storage.set('referenceLayer', state);
    }

    /**
     * Load state from storage
     * @private
     */
    async _loadState() {
        const state = await Storage.get('referenceLayer');
        if (state) {
            this.restoreState(state);
        }

        const zoom = StateManager.getZoom();
        this._updateCanvasSize(zoom);
    }

    /**
     * Destroy the reference layer service
     */
    destroy() {
        // Unsubscribe from all EventBus events
        this._eventUnsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._eventUnsubscribers = [];

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.remove();
        }

        this.canvas = null;
        this.ctx = null;
        this.image = null;
        this._initialized = false;

        Logger.info('ReferenceLayerService', 'Destroyed and cleaned up event listeners');
    }
}

window.ReferenceLayerService = new ReferenceLayerServiceClass();
// Port-compatibility alias: UI modules from the old tree call ReferenceLayerManager.
window.ReferenceLayerManager = window.ReferenceLayerService;

Logger.debug('ReferenceLayerService', 'Reference layer service loaded');

})(); // End IIFE
