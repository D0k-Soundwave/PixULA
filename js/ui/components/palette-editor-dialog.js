'use strict';
(function() {

/**
 * PaletteEditorDialog — the editable-palette editor (Phase 12a, generalised
 * for the Next in Phase 13).
 *
 * Image > Edit Palette… edits whichever register file the active mode's
 * palette model owns:
 *
 *   ulaplus64 — a 4×16 grid: one row per CLUT, split visually into the ink
 *     half (entries 0–7) and paper half (8–15). Picked colours snap to the
 *     nearest G3R3B2 register (ULAPLUS.rgbToRegister).
 *
 *   rgb333 (Phase 13) — the mode's palette window (256 entries for Layer 2
 *     / LoRes / ULANext, the first 16 for the 4bpp modes) in rows of 16.
 *     Picked colours snap to the nearest 9-bit RGB333 register
 *     (NEXTRGB333.rgbToRegister). ULANext's paper half starts at entry 128
 *     — the row tooltips carry the index so it stays findable.
 *
 * Writes go through ColorManager.setUlaplusRegister/setNextRegister inside
 * an undo action, so palette edits are undoable like everything else (the
 * undo snapshot carries both register files). Swatches are coloured via
 * the --zx-N tokens ColorManager publishes, so every edit is live
 * everywhere at once — the canvas needs the explicit recompose below
 * (12a gap found in the 12b pass).
 *
 * Only meaningful while an editable-palette mode is active (the register
 * files belong to the document); other modes get a localized pointer to
 * switch first.
 */
class PaletteEditorDialogClass {

    /** English fallback (dialog builds DOM, I18n.apply re-translates). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** The active palette model's editor traits, or null. @private */
    _traits() {
        const model = ACTIVE_SCREEN_MODE.paletteModel;
        if (model === 'ulaplus64') {
            return {
                model,
                count: 64,
                titleI18n: 'palette.title',
                title: 'ULAplus Palette',
                hintI18n: 'palette.hint',
                hint: 'Click a colour to edit it. Values snap to the G3R3B2 register grid (8 levels of green/red, 4 of blue).',
                getHex: (i) => ULAPLUS.registerToHex(ColorManager.getUlaplusRegisters()[i]),
                getReg: (i) => ColorManager.getUlaplusRegisters()[i],
                setFromRGB: (i, r, g, b) =>
                    ColorManager.setUlaplusRegister(i, ULAPLUS.rgbToRegister(r, g, b)),
                reset: () => ColorManager.setUlaplusRegisters(ULAPLUS.defaultRegisters()),
                rowLabel: (row) => this._t('palette.clut', 'CLUT {n}', { n: row })
                    .replace('{n}', String(row)),
                rowLabelI18n: 'palette.clut',
                // The Image2ULAplus pipeline: k-means CLUT clustering plus a
                // per-half median cut, the same one PNG import runs.
                buildFromImage: (imageData) =>
                    ColorManager.setUlaplusRegisters(PaletteOps.buildUlaplusRegisters(imageData)),
                // .npl's trailing transparency index is a Next idea; the
                // 64-byte ULAplus form has only the one shape.
                fileKinds: ['pal'],
                encode: (kind) => NextPaletteFormat.export(kind)
            };
        }
        if (model === 'rgb333') {
            return {
                model,
                count: ZX_SPECTRUM.PALETTE_SIZE,
                titleI18n: 'palette.nextTitle',
                title: 'Next Palette',
                hintI18n: 'palette.nextHint',
                hint: 'Click a colour to edit it. Values snap to the 9-bit RGB333 register grid (8 levels per channel).',
                getHex: (i) => NEXTRGB333.registerToHex(ColorManager.getNextRegisters()[i]),
                getReg: (i) => ColorManager.getNextRegisters()[i],
                setFromRGB: (i, r, g, b) =>
                    ColorManager.setNextRegister(i, NEXTRGB333.rgbToRegister(r, g, b)),
                reset: () => ColorManager.setNextRegisters(NEXTRGB333.defaultRegisters()),
                rowLabel: (row) => String(row * 16),
                rowLabelI18n: null,
                // Median cut into the mode's palette WINDOW — 16 entries for
                // the 4bpp modes, 256 for the 8bpp ones — leaving the rest of
                // the register file at its documented defaults.
                buildFromImage: (imageData) => ColorManager.setNextRegisters(
                    PaletteOps.buildNextRegisters(imageData, ZX_SPECTRUM.PALETTE_SIZE)),
                // Both Next forms: .pal is the 512-byte register pair dump,
                // .npl the same plus the trailing transparency index.
                fileKinds: ['pal', 'npl'],
                encode: (kind) => NextPaletteFormat.export(kind)
            };
        }
        return null;
    }

    /**
     * The same shape as _traits(), but backed by a local register buffer
     * instead of the live document (ColorManager). Used by File > Create
     * Palette…: building a palette from scratch — by eye or by sampling a
     * photo — must not touch the document, so there is no UndoRedo action,
     * no canvas recompose, and swatches paint from this buffer directly
     * rather than the --zx-N tokens (those only ever reflect the document's
     * OWN palette). Seeded from the active model's defaults, same as a
     * fresh document would show.
     * @private
     */
    _scratchTraits() {
        const model = ACTIVE_SCREEN_MODE.paletteModel;
        if (model === 'ulaplus64') {
            const regs = ULAPLUS.defaultRegisters();
            return {
                model, count: 64, scratch: true,
                titleI18n: 'palette.createTitle',
                title: 'Create Palette',
                hintI18n: 'palette.createHint',
                hint: 'Click a swatch to pick a colour, or sample one from a photo below. Nothing here touches your document — save it as a file when you are happy with it.',
                getHex: (i) => ULAPLUS.registerToHex(regs[i]),
                getReg: (i) => regs[i],
                setFromRGB: (i, r, g, b) => { regs[i] = ULAPLUS.rgbToRegister(r, g, b); },
                reset: () => regs.set(ULAPLUS.defaultRegisters()),
                rowLabel: (row) => this._t('palette.clut', 'CLUT {n}', { n: row })
                    .replace('{n}', String(row)),
                rowLabelI18n: 'palette.clut',
                buildFromImage: (imageData) => regs.set(PaletteOps.buildUlaplusRegisters(imageData)),
                fileKinds: ['pal'],
                encode: (kind) => NextPaletteFormat.encodeUlaplus(regs)
            };
        }
        if (model === 'rgb333') {
            const regs = NEXTRGB333.defaultRegisters();
            return {
                model, count: ZX_SPECTRUM.PALETTE_SIZE, scratch: true,
                titleI18n: 'palette.createTitle',
                title: 'Create Palette',
                hintI18n: 'palette.createHint',
                hint: 'Click a swatch to pick a colour, or sample one from a photo below. Nothing here touches your document — save it as a file when you are happy with it.',
                getHex: (i) => NEXTRGB333.registerToHex(regs[i]),
                getReg: (i) => regs[i],
                setFromRGB: (i, r, g, b) => { regs[i] = NEXTRGB333.rgbToRegister(r, g, b); },
                reset: () => regs.set(NEXTRGB333.defaultRegisters()),
                rowLabel: (row) => String(row * 16),
                rowLabelI18n: null,
                buildFromImage: (imageData) => regs.set(
                    PaletteOps.buildNextRegisters(imageData, ZX_SPECTRUM.PALETTE_SIZE)),
                fileKinds: ['pal', 'npl'],
                encode: (kind) => {
                    const pal = NextPaletteFormat.encode(regs);
                    if (kind !== 'npl') return pal;
                    const npl = new Uint8Array(513);
                    npl.set(pal);
                    npl[512] = 0xE3;
                    return npl;
                }
            };
        }
        return null;
    }

    /** Open (or focus) the palette editor. */
    open() {
        if (Dialog.isOpen('palette-editor')) return;
        const traits = this._traits();
        if (!traits) { this._needsPaletteMode(); return; }
        this._createDialog(traits);
    }

    /** File > Create Palette… — build a new palette from scratch, saved only as a file. */
    create() {
        if (Dialog.isOpen('create-palette')) return;
        const traits = this._scratchTraits();
        if (!traits) { this._needsPaletteMode(); return; }
        this._createDialog(traits);
    }

    /** @private */
    _createDialog(traits) {
        const content = document.createElement('div');
        content.className = 'palette-editor';
        if (traits.count > 64) content.classList.add('palette-editor-large');

        const hint = document.createElement('p');
        hint.className = 'palette-editor-hint';
        hint.dataset.i18n = traits.hintI18n;
        hint.textContent = this._t(traits.hintI18n, traits.hint);
        content.appendChild(hint);

        // Hidden native picker, retargeted per swatch click
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'palette-editor-picker';
        picker.setAttribute('aria-hidden', 'true');
        picker.tabIndex = -1;
        content.appendChild(picker);
        let pickerTarget = -1;

        picker.addEventListener('input', () => {
            if (pickerTarget < 0) return;
            const hex = picker.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            if (traits.scratch) {
                traits.setFromRGB(pickerTarget, r, g, b);
                this._repaintSwatch(content, pickerTarget, traits);
                this._refreshTitles(content, traits);
                return;
            }
            UndoRedo.beginAction('Palette');
            traits.setFromRGB(pickerTarget, r, g, b);
            UndoRedo.endAction();
            // The composited canvas stores resolved RGB — swatches follow the
            // --zx-N tokens by themselves, the canvas needs a recompose
            // (12a gap found in the 12b pass: edits never repainted it).
            LayerManager.composeToCanvas();
            this._refreshTitles(content, traits);
        });

        const rows = Math.ceil(traits.count / 16);
        for (let row = 0; row < rows; row++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'palette-editor-clut';

            const label = document.createElement('span');
            label.className = 'palette-editor-clut-label';
            if (traits.rowLabelI18n) {
                label.dataset.i18n = traits.rowLabelI18n;
                label.dataset.i18nParamN = String(row);
            }
            label.textContent = traits.rowLabel(row);
            rowEl.appendChild(label);

            const swatches = document.createElement('div');
            swatches.className = 'palette-editor-swatches';
            for (let i = 0; i < 16 && row * 16 + i < traits.count; i++) {
                const index = row * 16 + i;
                const sw = document.createElement('button');
                sw.type = 'button';
                sw.className = 'color-swatch palette-editor-swatch'
                    + (traits.model === 'ulaplus64' && i === 8 ? ' palette-editor-paper-start' : '');
                sw.dataset.index = String(index);
                // Scratch swatches paint from the local buffer directly — there
                // is no --zx-N token for a palette that was never applied to
                // the document, and one wouldn't stay live anyway.
                if (traits.scratch) sw.style.backgroundColor = traits.getHex(index);
                else sw.style.setProperty('background-color', `var(--zx-${index})`);
                sw.addEventListener('click', () => {
                    pickerTarget = index;
                    picker.value = traits.getHex(index);
                    picker.click();
                });
                swatches.appendChild(sw);
            }
            rowEl.appendChild(swatches);
            content.appendChild(rowEl);
        }

        content.appendChild(this._buildTools(content, traits));

        this._refreshTitles(content, traits);

        Dialog.open({
            id: traits.scratch ? 'create-palette' : 'palette-editor',
            titleI18n: traits.titleI18n,
            title: traits.title,
            content,
            className: 'palette-editor-dialog',
            buttons: [
                {
                    i18n: 'palette.reset', label: 'Reset to defaults',
                    onClick: () => {
                        this._edit(content, traits, () => traits.reset());
                        return false; // keep open
                    }
                },
                { i18n: 'dialog.close', label: 'Close', primary: true }
            ]
        });
    }

    // ── Menu entry points (File > Load / Save Palette…) ─────────────────────
    //
    // The same two jobs the dialog's buttons do, reachable without opening it:
    // loading a palette you keep on disk is something you do at the START of a
    // picture, before you have any reason to be looking at the swatches.

    /** File > Load Palette… */
    loadFromFile() {
        const traits = this._traits();
        if (!traits) { this._needsPaletteMode(); return; }

        // A picker with no dialog behind it: created, clicked, discarded.
        const loader = document.createElement('input');
        loader.type = 'file';
        loader.accept = '.pal,.npl';
        loader.hidden = true;
        loader.addEventListener('change', async (event) => {
            await this._loadFile(event, document, traits);
            loader.remove();
        });
        document.body.appendChild(loader);
        loader.click();
    }

    /** File > Save Palette… */
    saveToFile() {
        const traits = this._traits();
        if (!traits) { this._needsPaletteMode(); return; }
        this._saveFile(traits.fileKinds[0], traits);
    }

    /** @private */
    _needsPaletteMode() {
        alert(this._t('mode.needsEditablePalette',
            'The palette is editable in ULAplus and ZX Spectrum Next modes — switch the screen mode first.'));
    }

    /**
     * The palette's own file and generator controls.
     *
     * A palette is a DOCUMENT of its own in every editor that supports custom
     * palettes — you build one, keep it, and use it across pictures — so Load
     * and Save belong here, next to the swatches, not only as two entries in an
     * Export dropdown of two dozen formats. The file handling itself is
     * `NextPaletteFormat`, which already picks the right byte form for the
     * active palette model; this is the way in.
     * @private
     */
    _buildTools(content, traits) {
        const tools = document.createElement('div');
        tools.className = 'palette-editor-tools';

        // ── Files ────────────────────────────────────────────────────────
        const files = this._toolRow(tools, 'palette.files', 'Palette file');

        // Create Palette starts from a blank slate on purpose — loading a
        // file into it is what File > Load Palette… already does.
        if (!traits.scratch) {
            const loader = document.createElement('input');
            loader.type = 'file';
            loader.accept = '.pal,.npl';
            loader.hidden = true;
            loader.addEventListener('change', (e) => this._loadFile(e, content, traits));
            tools.appendChild(loader);

            files.appendChild(this._button('palette.load', 'Load...', 'palette.loadHint',
                'Replace this palette with one from a .pal or .npl file',
                () => loader.click()));
        }

        // Only the Next has two file forms worth choosing between, so only the
        // Next gets a chooser. One option in a select is a question with one
        // answer.
        let kindSelect = null;
        if (traits.fileKinds.length > 1) {
            kindSelect = document.createElement('select');
            kindSelect.className = 'palette-editor-kind';
            kindSelect.dataset.i18nTitle = 'palette.kindHint';
            kindSelect.title = this._t('palette.kindHint',
                'Which file form to write');
            for (const kind of traits.fileKinds) {
                const opt = document.createElement('option');
                opt.value = kind;
                opt.textContent = `.${kind}`;
                kindSelect.appendChild(opt);
            }
            files.appendChild(kindSelect);
        }

        files.appendChild(this._button('palette.save', 'Save...', 'palette.saveHint',
            'Write this palette out as a file you can load into another picture',
            () => this._saveFile(kindSelect ? kindSelect.value : traits.fileKinds[0], traits)));

        // ── Build from an image ──────────────────────────────────────────
        const build = this._toolRow(tools, 'palette.build', 'Build');

        const imagePicker = document.createElement('input');
        imagePicker.type = 'file';
        imagePicker.accept = 'image/*';
        imagePicker.hidden = true;
        imagePicker.addEventListener('change', (e) => this._buildFromImage(e, content, traits));
        tools.appendChild(imagePicker);

        build.appendChild(this._button('palette.fromImage', 'From image...',
            'palette.fromImageHint',
            'Choose a photo and fit this palette to its colours. The picture is not imported',
            () => imagePicker.click()));

        // ── Ramp ─────────────────────────────────────────────────────────
        //
        // The endpoints are entries you have already set, not two colours
        // picked here: you place the darkest and lightest shade by eye, then
        // ask for the evenly-spaced steps between them. That is the order the
        // job is actually done in, and it needs no second colour picker.
        const ramp = this._toolRow(tools, 'palette.ramp', 'Ramp');

        const from = this._indexInput('palette-ramp-from', 0, traits.count - 1, 0);
        const to = this._indexInput('palette-ramp-to', 0, traits.count - 1,
            Math.min(7, traits.count - 1));

        ramp.appendChild(this._indexLabel('palette.rampFrom', 'From', from));
        ramp.appendChild(this._indexLabel('palette.rampTo', 'To', to));
        ramp.appendChild(this._button('palette.rampApply', 'Blend', 'palette.rampHint',
            'Fill the entries between these two with an even blend of the colours at each end',
            () => this._applyRamp(content, traits,
                parseInt(from.value, 10), parseInt(to.value, 10))));

        return tools;
    }

    /** One labelled row of tool controls. @private */
    _toolRow(host, i18n, fallback) {
        const row = document.createElement('div');
        row.className = 'palette-editor-tool-row';

        const label = document.createElement('span');
        label.className = 'palette-editor-tool-label';
        label.dataset.i18n = i18n;
        label.textContent = this._t(i18n, fallback);
        row.appendChild(label);

        host.appendChild(row);
        return row;
    }

    /** @private */
    _button(i18n, fallback, titleI18n, titleFallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button palette-editor-tool-button';
        btn.dataset.i18n = i18n;
        btn.textContent = this._t(i18n, fallback);
        btn.dataset.i18nTitle = titleI18n;
        btn.title = this._t(titleI18n, titleFallback);
        btn.addEventListener('click', onClick);
        return btn;
    }

    /** @private */
    _indexInput(id, min, max, value) {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.className = 'palette-editor-index';
        input.min = String(min);
        input.max = String(max);
        input.value = String(value);
        return input;
    }

    /** @private */
    _indexLabel(i18n, fallback, input) {
        const label = document.createElement('label');
        label.className = 'palette-editor-index-label';
        label.htmlFor = input.id;
        const text = document.createElement('span');
        text.dataset.i18n = i18n;
        text.textContent = this._t(i18n, fallback);
        label.appendChild(text);
        label.appendChild(input);
        return label;
    }

    /** #rrggbb -> [r,g,b]. @private */
    _hexToRGB(hex) {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16),
                parseInt(hex.slice(5, 7), 16)];
    }

    /**
     * Every write to the register file goes through here: one undo action, a
     * recompose (the composited canvas holds resolved RGB, so it does not
     * follow the --zx-N tokens the swatches do) and a tooltip refresh. A
     * scratch buffer (Create Palette) skips undo and recompose entirely —
     * it is not the document — and repaints its own swatches directly since
     * there is no --zx-N token to follow.
     * @private
     */
    _edit(content, traits, fn) {
        if (traits.scratch) {
            fn();
            this._repaintAll(content, traits);
            this._refreshTitles(content, traits);
            return;
        }
        UndoRedo.beginAction('Palette');
        fn();
        UndoRedo.endAction();
        LayerManager.composeToCanvas();
        this._refreshTitles(content, traits);
    }

    /** Repaint one scratch swatch's background from its current value. @private */
    _repaintSwatch(content, index, traits) {
        const sw = content.querySelector(`.palette-editor-swatch[data-index="${index}"]`);
        if (sw) sw.style.backgroundColor = traits.getHex(index);
    }

    /** Repaint every scratch swatch's background. @private */
    _repaintAll(content, traits) {
        content.querySelectorAll('.palette-editor-swatch').forEach((sw) => {
            sw.style.backgroundColor = traits.getHex(parseInt(sw.dataset.index, 10));
        });
    }

    /** @private */
    async _loadFile(event, content, traits) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;

        const ext = FormatRegistry.getExtension(file.name);
        const handler = FormatRegistry.getImportHandler(ext);
        if (!handler) {
            alert(this._t('palette.loadFailed', 'That file is not a palette this build reads.'));
            return;
        }

        try {
            // The handler opens its own undo action and writes the register
            // file itself — it is the same path File > Open takes.
            const buffer = await Helpers.readFileAsArrayBuffer(file);
            const result = handler.parse(buffer);
            if (!result || result.success === false) {
                alert(this._t('palette.loadFailed', 'That file is not a palette this build reads.'));
                return;
            }
            LayerManager.composeToCanvas();
            this._refreshTitles(content, traits);
        } catch (error) {
            Logger.warn('PaletteEditorDialog', 'Palette load failed', error);
            alert(this._t('palette.loadFailed', 'That file is not a palette this build reads.'));
        }
    }

    /** @private */
    _saveFile(kind, traits) {
        try {
            let name = `palette.${kind}`;
            if (!name.toLowerCase().endsWith(`.${kind}`)) name += `.${kind}`;
            FormatRegistry.download(traits.encode(kind), name);
        } catch (error) {
            Logger.warn('PaletteEditorDialog', 'Palette save failed', error);
            alert(error.message || this._t('palette.saveFailed', 'The palette could not be saved.'));
        }
    }

    /** @private */
    async _buildFromImage(event, content, traits) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;

        try {
            const buffer = await Helpers.readFileAsArrayBuffer(file);
            const imageData = await PNGFormat.decodeToImageData(buffer, file.type || 'image/png');
            if (!imageData) throw new Error('undecodable');
            this._edit(content, traits, () => traits.buildFromImage(imageData));
        } catch (error) {
            Logger.warn('PaletteEditorDialog', 'Palette build failed', error);
            alert(this._t('palette.buildFailed', 'That image could not be read.'));
        }
    }

    /**
     * Fill the run between two entries with an even blend of the colours at
     * its ends. Both ends are rewritten too — snapping them to the register
     * grid changes nothing, since they were already on it, and it keeps the
     * result a single uninterrupted ramp.
     * @private
     */
    _applyRamp(content, traits, from, to) {
        if (!Number.isInteger(from) || !Number.isInteger(to)) return;
        const lo = Helpers.clamp(Math.min(from, to), 0, traits.count - 1);
        const hi = Helpers.clamp(Math.max(from, to), 0, traits.count - 1);
        if (hi - lo < 2) {
            alert(this._t('palette.rampTooShort',
                'Choose two entries with at least one between them.'));
            return;
        }

        const start = this._hexToRGB(traits.getHex(lo));
        const end = this._hexToRGB(traits.getHex(hi));
        const colours = PaletteOps.rampRGB(start, end, hi - lo + 1);

        this._edit(content, traits, () => {
            for (let i = 0; i < colours.length; i++) {
                traits.setFromRGB(lo + i, colours[i][0], colours[i][1], colours[i][2]);
            }
        });
    }

    /** Swatch tooltips show index + register value. @private */
    _refreshTitles(content, traits) {
        content.querySelectorAll('.palette-editor-swatch').forEach((sw) => {
            const i = parseInt(sw.dataset.index, 10);
            const reg = traits.getReg(i);
            let role = String(i);
            if (traits.model === 'ulaplus64') {
                role = `${i} · ${(i % 16) < 8
                    ? this._t('color.ink', 'Ink')
                    : this._t('color.paper', 'Paper')} ${i % 8}`;
            }
            const width = traits.model === 'ulaplus64' ? 2 : 3;
            sw.title = `${role} · 0x${reg.toString(16).padStart(width, '0').toUpperCase()}`;
            sw.setAttribute('aria-label', sw.title);
        });
    }
}

window.PaletteEditorDialog = new PaletteEditorDialogClass();

Logger.debug('PaletteEditorDialog', 'Palette editor dialog loaded');

})(); // End IIFE
