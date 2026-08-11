'use strict';
(function() {

/**
 * Reference Layer Panel
 *
 * Sidebar section (collapsed by default) for loading and controlling
 * reference images: opacity, offset, scale, rotation, flip, fit, clear.
 * Rebuilt from the old floating-window panel — floating windows are retired;
 * the panel is a PanelSection like every other.
 *
 * Commands go DOWN as EVENTS.REFERENCE_* command events (the
 * ReferenceLayerService owns the logic); control state renders from the
 * EVENTS.REFERENCE_*_CHANGED facts.
 */
class ReferenceLayerPanelClass {
    constructor() {
        this.fileInput = null;
        this.controls = {};
        this._initialized = false;
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    initialize() {
        if (this._initialized) return;

        const panel = PanelSection.create({
            id: 'reference-panel',
            titleI18n: 'panels.reference',
            title: 'Reference',
            collapsed: true
        });
        if (!panel) return;

        const content = panel.content;
        content.appendChild(this._createLoadSection());
        content.appendChild(this._createInfoSection());
        content.appendChild(this._createVisibilitySection());
        content.appendChild(this._createOpacitySection());
        content.appendChild(this._createPositionSection());
        content.appendChild(this._createTransformSection());
        content.appendChild(this._createFitSection());
        content.appendChild(this._createPresetSection());
        content.appendChild(this._createActionsSection());

        if (window.OptionControls) OptionControls.decorateSliders(content);
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(content);

        this._setupEventListeners();
        this._enableControls(false);

        this._initialized = true;
        Logger.info('ReferenceLayerPanel', 'Initialized (sidebar section)');
    }

    /** Toggle the sidebar section (View menu). */
    toggle() {
        return PanelSection.toggle('reference-panel');
    }

    // ── Sections ─────────────────────────────────────────────────────────────

    /** @private */
    _createLoadSection() {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'panel-button primary full-width';
        loadBtn.dataset.i18n = 'reference.load';
        loadBtn.textContent = this._t('reference.load', 'Load Image');
        /*
         * Prefer the handle-returning picker: a reference PRESET stores the
         * link rather than the photo, and only showOpenFilePicker gives a way
         * back to the file. ImageSource falls back to the hidden input below
         * where that API is missing, and this click is the user gesture both
         * routes require.
         */
        loadBtn.addEventListener('click', () => this._pickImage());
        this.controls.loadBtn = loadBtn;

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.id = 'ref-file-input';
        this.fileInput.name = 'ref-file';
        this.fileInput.accept = 'image/*';
        this.fileInput.dataset.i18nAriaLabel = 'reference.load';
        this.fileInput.setAttribute('aria-label', this._t('reference.load', 'Load Image'));
        this.fileInput.hidden = true;
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) EventBus.emit(EVENTS.REFERENCE_LOAD, { file });
            this.fileInput.value = '';
        });

        section.appendChild(loadBtn);
        section.appendChild(this.fileInput);
        return section;
    }

    /** @private */
    _createInfoSection() {
        const section = document.createElement('div');
        section.className = 'panel-section image-info';
        section.hidden = true;

        const label = document.createElement('div');
        label.className = 'panel-label';
        label.dataset.i18n = 'reference.imageInfo';
        label.textContent = this._t('reference.imageInfo', 'Image Info');

        const info = document.createElement('div');
        info.className = 'info-content';
        const filename = document.createElement('span');
        filename.className = 'filename';
        const dimensions = document.createElement('span');
        dimensions.className = 'dimensions';
        info.appendChild(filename);
        info.appendChild(dimensions);

        /*
         * A preset links to its photo and keeps a small thumbnail for when the
         * link cannot be followed - moved file, another machine, declined
         * permission. Loading the thumbnail silently would leave the artist
         * tracing a 256 px stand-in and wondering why the detail went, so the
         * panel states it and offers the one action that fixes it.
         */
        const standIn = document.createElement('div');
        standIn.className = 'panel-note';
        standIn.hidden = true;

        const standInText = document.createElement('span');
        standInText.dataset.i18n = 'reference.standIn';
        standInText.textContent = this._t('reference.standIn',
            'Showing a low-resolution copy - the linked photo could not be found.');

        const locate = document.createElement('button');
        locate.type = 'button';
        locate.className = 'panel-button full-width';
        locate.dataset.i18n = 'reference.locate';
        locate.textContent = this._t('reference.locate', 'Locate Photo...');
        locate.addEventListener('click', () => this._pickImage());

        standIn.appendChild(standInText);
        standIn.appendChild(locate);

        section.appendChild(label);
        section.appendChild(info);
        section.appendChild(standIn);
        this.controls.infoSection = section;
        this.controls.infoFilename = filename;
        this.controls.infoDimensions = dimensions;
        this.controls.standInNote = standIn;
        return section;
    }

    /**
     * Ask for an image and load it, keeping the link where the browser gives
     * one. Shared by the Load button and the stand-in notice's Locate button:
     * re-pointing a broken link is the same act as choosing a photo.
     * @private
     */
    async _pickImage() {
        if (!window.ImageSource || !ImageSource.canLink) { this.fileInput.click(); return; }
        const picked = await ImageSource.pick();
        if (picked) EventBus.emit(EVENTS.REFERENCE_LOAD, picked);
    }

    /** @private */
    _createVisibilitySection() {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const row = document.createElement('div');
        row.className = 'panel-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'ref-visible';
        checkbox.checked = true;
        checkbox.addEventListener('change', () => {
            EventBus.emit(EVENTS.REFERENCE_VISIBILITY, { visible: checkbox.checked });
        });
        this.controls.visible = checkbox;

        const label = document.createElement('label');
        label.htmlFor = 'ref-visible';
        label.dataset.i18n = 'reference.visible';
        label.textContent = this._t('reference.visible', 'Visible');

        row.appendChild(checkbox);
        row.appendChild(label);

        section.appendChild(row);
        return section;
    }

    /** Build a labelled slider row. @private */
    _sliderRow({ id, i18n, fallback, min, max, value, unit, event, payloadKey }) {
        const wrap = document.createDocumentFragment();

        const label = document.createElement('label');
        label.htmlFor = id;
        label.dataset.i18n = i18n;
        label.textContent = this._t(i18n, fallback);

        const row = document.createElement('div');
        row.className = 'panel-row slider-row-host';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = id;
        slider.name = id;
        slider.min = String(min);
        slider.max = String(max);
        slider.value = String(value);
        slider.className = 'panel-slider';

        const valueEl = document.createElement('span');
        valueEl.className = 'slider-value';
        valueEl.textContent = `${value}${unit}`;

        slider.addEventListener('input', () => {
            valueEl.textContent = `${slider.value}${unit}`;
            EventBus.emit(event, { [payloadKey]: parseInt(slider.value, 10) });
        });

        row.appendChild(slider);
        row.appendChild(valueEl);
        wrap.appendChild(label);
        wrap.appendChild(row);
        return { fragment: wrap, slider, valueEl };
    }

    /** @private */
    _createOpacitySection() {
        const section = document.createElement('div');
        section.className = 'panel-section';
        const { fragment, slider, valueEl } = this._sliderRow({
            id: 'ref-opacity', i18n: 'reference.opacity', fallback: 'Opacity',
            min: 0, max: 100, value: 50, unit: '%',
            event: EVENTS.REFERENCE_OPACITY, payloadKey: 'opacity'
        });
        this.controls.opacity = slider;
        this.controls.opacityValue = valueEl;
        section.appendChild(fragment);
        return section;
    }

    /** @private */
    _createPositionSection() {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const label = document.createElement('div');
        label.className = 'panel-label';
        label.dataset.i18n = 'reference.offset';
        label.textContent = this._t('reference.offset', 'Offset');

        const row = document.createElement('div');
        row.className = 'panel-row input-row';

        const mkNum = (id, i18n, fallback) => {
            const l = document.createElement('label');
            l.htmlFor = id;
            l.dataset.i18n = i18n;
            l.textContent = this._t(i18n, fallback);
            const input = document.createElement('input');
            input.type = 'number';
            input.id = id;
            input.name = id;
            input.value = '0';
            input.className = 'panel-input small';
            row.appendChild(l);
            row.appendChild(input);
            return input;
        };

        const xInput = mkNum('ref-offset-x', 'reference.x', 'X');
        const yInput = mkNum('ref-offset-y', 'reference.y', 'Y');

        const updateOffset = () => {
            EventBus.emit(EVENTS.REFERENCE_OFFSET, {
                x: parseInt(xInput.value, 10) || 0,
                y: parseInt(yInput.value, 10) || 0
            });
        };
        xInput.addEventListener('change', updateOffset);
        yInput.addEventListener('change', updateOffset);

        this.controls.offsetX = xInput;
        this.controls.offsetY = yInput;

        // Same cross-of-four-arrows pad as the Transform panel's Shift -
        // nudges the same X/Y fields above by one canvas pixel rather than
        // requiring a typed value for a small reposition.
        const pad = document.createElement('div');
        pad.className = 'dir-pad';

        const OFFSET_STEP = 1;
        const nudge = (input, delta) => {
            input.value = String((parseInt(input.value, 10) || 0) + delta);
            updateOffset();
        };

        const mkNudge = (dirClass, dx, dy, glyphEntity) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `panel-button small ${dirClass}`;
            // innerHTML, not textContent: an HTML entity (matching the
            // Transform panel's Shift pad) rather than a raw arrow
            // character, which tests/lint-architecture.test.js flags as a
            // pictograph wherever it appears in js/ source.
            btn.innerHTML = glyphEntity;
            btn.addEventListener('click', () => {
                if (dx) nudge(xInput, dx * OFFSET_STEP);
                if (dy) nudge(yInput, dy * OFFSET_STEP);
            });
            pad.appendChild(btn);
            return btn;
        };

        mkNudge('dir-pad-up', 0, -1, '&#x2191;');
        mkNudge('dir-pad-left', -1, 0, '&#x2190;');
        mkNudge('dir-pad-right', 1, 0, '&#x2192;');
        mkNudge('dir-pad-down', 0, 1, '&#x2193;');

        section.appendChild(label);
        section.appendChild(row);
        section.appendChild(pad);
        return section;
    }

    /** @private */
    _createTransformSection() {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const scale = this._sliderRow({
            id: 'ref-scale', i18n: 'reference.scale', fallback: 'Scale',
            // Negative scale mirrors the image (drawImage with a negative
            // width/height flips its source - ReferenceLayerService._render
            // does this for free, no extra branch needed) at the same
            // centred offset a positive scale of the same magnitude would
            // use, so this is one slider for "flip AND resize" together
            // rather than a second control. -99, not -100 or a symmetric
            // -500: never quite reaching a full-size mirror keeps 0 (a
            // vanished image) a deliberate drag past a limit, not a
            // resting value the thumb parks on.
            min: -99, max: 500, value: 100, unit: '%',
            event: EVENTS.REFERENCE_SCALE, payloadKey: 'scale'
        });
        this.controls.scale = scale.slider;
        this.controls.scaleValue = scale.valueEl;

        // Signed range matching every other rotate control in the app; the
        // service normalizes to 0–359 internally, the CHANGED listener
        // converts back to signed for display.
        const rotation = this._sliderRow({
            id: 'ref-rotation', i18n: 'reference.rotation', fallback: 'Rotation',
            min: -180, max: 180, value: 0, unit: '°',
            event: EVENTS.REFERENCE_ROTATION, payloadKey: 'rotation'
        });
        this.controls.rotation = rotation.slider;
        this.controls.rotationValue = rotation.valueEl;

        const flipRow = document.createElement('div');
        flipRow.className = 'panel-row button-row';

        const emitFlip = () => {
            EventBus.emit(EVENTS.REFERENCE_FLIP, {
                flipX: this.controls.flipX.classList.contains('active'),
                flipY: this.controls.flipY.classList.contains('active')
            });
        };

        const mkFlip = (i18n, fallback) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'panel-button toggle';
            btn.dataset.i18n = i18n;
            btn.textContent = this._t(i18n, fallback);
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                emitFlip();
            });
            flipRow.appendChild(btn);
            return btn;
        };

        this.controls.flipX = mkFlip('reference.flipH', 'Flip H');
        this.controls.flipY = mkFlip('reference.flipV', 'Flip V');

        section.appendChild(scale.fragment);
        section.appendChild(rotation.fragment);
        section.appendChild(flipRow);
        return section;
    }

    /** @private */
    _createFitSection() {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const label = document.createElement('div');
        label.className = 'panel-label';
        label.dataset.i18n = 'reference.fit';
        label.textContent = this._t('reference.fit', 'Placement');

        const mkBtn = (row, i18n, fallback, hintFallback, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'panel-button small';
            btn.dataset.i18n = i18n;
            btn.dataset.i18nTitle = `${i18n}.hint`;
            btn.textContent = this._t(i18n, fallback);
            btn.title = this._t(`${i18n}.hint`, hintFallback);
            btn.addEventListener('click', onClick);
            row.appendChild(btn);
            return btn;
        };

        const row = document.createElement('div');
        row.className = 'panel-row button-row';
        mkBtn(row, 'reference.contain', 'Fit', 'Scale so the whole image fits inside the canvas',
            () => EventBus.emit(EVENTS.REFERENCE_FIT, { mode: 'contain' }));
        mkBtn(row, 'reference.cover', 'Fill', 'Scale so the image fills the canvas, cropping the overhang',
            () => EventBus.emit(EVENTS.REFERENCE_FIT, { mode: 'cover' }));

        const row2 = document.createElement('div');
        row2.className = 'panel-row button-row';
        mkBtn(row2, 'reference.center', 'Center', 'Recentre the image at its current scale',
            () => EventBus.emit(EVENTS.REFERENCE_CENTER));
        mkBtn(row2, 'reference.reset', 'Reset', 'Restore offset, scale, rotation and flip (keeps the image)',
            () => EventBus.emit(EVENTS.REFERENCE_RESET));

        section.appendChild(label);
        section.appendChild(row);
        section.appendChild(row2);
        return section;
    }

    /**
     * The panel's own presets — the same controls every tool has, pointed at
     * the `reference` scope.
     *
     * A reference is set up as a job of its own: you place a photo once and
     * want it back later at exactly that offset and scale, and you want the
     * PHOTO back, not just the numbers. So the list here holds reference setups
     * and nothing else, exactly as the brush's list holds brushes — the panel
     * is both "the reference tool's options" and "the reference tool's presets",
     * because the reference is not a rail tool and never becomes the active one.
     *
     * The image travels with the placement in the shared content-addressed
     * asset store, so several presets tracing one photo store it once.
     * @private
     */
    _createPresetSection() {
        const section = document.createElement('div');
        section.className = 'panel-section reference-presets';

        this._presetRow = PresetControls.buildRow('reference',
            { idPrefix: 'reference-preset' });
        section.appendChild(this._presetRow.element);

        this._presetList = PresetControls.buildList('reference');
        section.appendChild(this._presetList.element);

        // Both halves render from the library fact; the Save button also has to
        // follow the IMAGE, since there is nothing to save until one is loaded.
        const refresh = () => {
            this._presetRow.refresh();
            this._presetList.refresh();
        };
        EventBus.on(EVENTS.TOOL_PRESETS_CHANGED, (data) => {
            if (!data || !data.tool || data.tool === 'reference') refresh();
        });
        EventBus.on(EVENTS.REFERENCE_LOADED, refresh);
        EventBus.on(EVENTS.REFERENCE_CLEARED, refresh);

        return section;
    }

    /** @private */
    _createActionsSection() {
        const section = document.createElement('div');
        section.className = 'panel-section actions';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'panel-button danger full-width';
        clearBtn.dataset.i18n = 'reference.clear';
        clearBtn.textContent = this._t('reference.clear', 'Clear Image');
        clearBtn.addEventListener('click', () => EventBus.emit(EVENTS.REFERENCE_CLEAR));
        this.controls.clearBtn = clearBtn;

        section.appendChild(clearBtn);
        return section;
    }

    // ── Fact listeners ───────────────────────────────────────────────────────

    /** @private */
    _setupEventListeners() {
        EventBus.on(EVENTS.REFERENCE_LOADED, (data) => {
            this._updateImageInfo(data);
            this._enableControls(true);
        });

        EventBus.on(EVENTS.REFERENCE_CLEARED, () => {
            this._updateImageInfo(null);
            this._resetControls();
            this._enableControls(false);
        });

        EventBus.on(EVENTS.REFERENCE_VISIBILITY_CHANGED, (data) => {
            this.controls.visible.checked = data.visible;
        });

        EventBus.on(EVENTS.REFERENCE_OPACITY_CHANGED, (data) => {
            this.controls.opacity.value = data.opacity;
            this.controls.opacityValue.textContent = data.opacity + '%';
        });

        EventBus.on(EVENTS.REFERENCE_OFFSET_CHANGED, (data) => {
            this.controls.offsetX.value = Math.round(data.x);
            this.controls.offsetY.value = Math.round(data.y);
        });

        EventBus.on(EVENTS.REFERENCE_SCALE_CHANGED, (data) => {
            this.controls.scale.value = data.scale;
            this.controls.scaleValue.textContent = Math.round(data.scale) + '%';
        });

        EventBus.on(EVENTS.REFERENCE_ROTATION_CHANGED, (data) => {
            // Service facts are normalized 0–359; the slider is signed −180…180.
            // ±180 are the same angle, so when the slider already shows the
            // fact (mod 360) leave the thumb alone — rewriting it would snap
            // +180 to −180 under the user's pointer mid-drag.
            const norm = ((Math.round(data.rotation) % 360) + 360) % 360;
            const current = ((parseInt(this.controls.rotation.value, 10) % 360) + 360) % 360;
            if (current !== norm) {
                this.controls.rotation.value = norm > 180 ? norm - 360 : norm;
            }
            this.controls.rotationValue.textContent = `${this.controls.rotation.value}°`;
        });

        EventBus.on(EVENTS.REFERENCE_FLIP_CHANGED, (data) => {
            this.controls.flipX.classList.toggle('active', data.flipX);
            this.controls.flipY.classList.toggle('active', data.flipY);
        });

        EventBus.on(EVENTS.REFERENCE_TRANSFORM_RESET, () => {
            this._resetControls();
        });
    }

    /** @private */
    _updateImageInfo(data) {
        const section = this.controls.infoSection;
        if (!data) {
            section.hidden = true;
            return;
        }
        section.hidden = false;
        this.controls.infoFilename.textContent = data.fileName || this._t('reference.unknownFile', 'Unknown file');
        this.controls.infoDimensions.textContent = `${data.width} x ${data.height}`;
        this.controls.standInNote.hidden = !data.standIn;
    }

    /** @private */
    _resetControls() {
        this.controls.visible.checked = true;
        this.controls.opacity.value = 50;
        this.controls.opacityValue.textContent = '50%';
        this.controls.offsetX.value = 0;
        this.controls.offsetY.value = 0;
        this.controls.scale.value = 100;
        this.controls.scaleValue.textContent = '100%';
        this.controls.rotation.value = 0;
        this.controls.rotationValue.textContent = '0';
        this.controls.flipX.classList.remove('active');
        this.controls.flipY.classList.remove('active');
    }

    /** @private */
    _enableControls(enabled) {
        // presetBtn included: with no image loaded there is no tracing setup to
        // save, and a button that saves an empty reference is a button that
        // fills a slot with nothing.
        const names = [
            'visible', 'opacity',
            'offsetX', 'offsetY', 'scale', 'rotation',
            'flipX', 'flipY', 'clearBtn', 'presetBtn'
        ];
        names.forEach((name) => {
            if (this.controls[name]) this.controls[name].disabled = !enabled;
        });
    }
}

window.ReferenceLayerPanel = new ReferenceLayerPanelClass();

Logger.debug('ReferenceLayerPanel', 'Reference layer panel loaded');

})(); // End IIFE
