'use strict';
(function() {

/**
 * ImportDialog — the image import conversion dialog (Phase 8).
 *
 * Shown by FileManager before a PNG/JPG import is parsed: brightness,
 * contrast, scaling (fit/stretch/crop) and dithering with a live preview of
 * the exact quantized result. All pixel math stays in io/ (PNGFormat:
 * applyBrightnessContrast + quantizeForPreview — the same engine parse()
 * runs on OK), this component only owns the dialog DOM and the preview
 * canvas. Cancel (button, ×, or Esc) resolves null and the import aborts.
 */
class ImportDialogClass {
    /** English fallback helper (same pattern as the other components). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * Show the conversion dialog for an image file buffer.
     * @param {ArrayBuffer} buffer - Raw file bytes
     * @param {string} ext - File extension ('png' | 'jpg' | 'jpeg' | 'gif')
     * @returns {Promise<{brightness:number,contrast:number,scaling:string,
     *   dithering:string,method:string,choice:string}|null>}
     *   The chosen conversion options, or null if the user cancelled.
     */
    async show(buffer, ext) {
        const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
            : (ext === 'gif') ? 'image/gif' : 'image/png';
        const decoded = await PNGFormat.decodeToImageData(buffer, mime);
        // Undecodable: skip the dialog and proceed with defaults — parse()
        // will fail the same way and surface the error (null means "user
        // cancelled" to FileManager, which would swallow it silently).
        if (!decoded) return {};

        // The three conversions are defined once beside the code that runs
        // them (PNGFormat.IMPORT_METHODS) - what each one is and why there
        // are three is written up there.
        const METHODS = PNGFormat.IMPORT_METHODS;

        const state = { brightness: 0, contrast: 0, scaling: 'fit', dither: 'floyd-steinberg' };
        let chosen = METHODS[0];

        return new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (!settled) { settled = true; resolve(value); }
            };

            const content = document.createElement('div');
            content.className = 'import-dialog-body';

            // One live preview per method, side by side. Clicking one picks it.
            const methodRow = document.createElement('div');
            methodRow.className = 'import-methods';
            methodRow.setAttribute('role', 'radiogroup');
            methodRow.dataset.i18nAriaLabel = 'import.method';
            methodRow.setAttribute('aria-label', this._t('import.method', 'Conversion'));
            content.appendChild(methodRow);

            const panes = METHODS.map((m) => {
                const pane = document.createElement('button');
                pane.type = 'button';
                pane.className = 'import-method';
                pane.setAttribute('role', 'radio');
                pane.dataset.method = m.id;

                const c = document.createElement('canvas');
                c.className = 'import-preview';
                c.width = ZX_SPECTRUM.WIDTH;
                c.height = ZX_SPECTRUM.HEIGHT;

                const cap = document.createElement('span');
                cap.className = 'import-method__label';
                cap.dataset.i18n = m.i18n;
                cap.textContent = this._t(m.i18n, m.fallback);

                const hintKey = `${m.i18n}.hint`;
                pane.dataset.i18nTitleName = m.i18n;
                pane.dataset.i18nTitle = hintKey;
                pane.title = Helpers.composeTitle(this._t(m.i18n, m.fallback), this._t(hintKey, m.hint));

                pane.appendChild(c);
                pane.appendChild(cap);
                pane.addEventListener('click', () => select(m));
                methodRow.appendChild(pane);
                return { spec: m, pane, ctx: c.getContext('2d') };
            });

            // One writer for the selection, so the initial state and a click
            // cannot set different things (aria-checked was the usual casualty)
            const select = (m) => {
                chosen = m;
                for (const q of panes) {
                    const on = q.spec === m;
                    q.pane.classList.toggle('active', on);
                    q.pane.setAttribute('aria-checked', on ? 'true' : 'false');
                }
            };
            select(chosen);

            const controls = document.createElement('div');
            controls.className = 'import-controls';
            content.appendChild(controls);

            // rAF-coalesced preview refresh (slider drags fire fast). The
            // CHOSEN method redraws at once; the other two once the controls
            // have rested for PREVIEW_REST_MS, so a drag costs one preview a
            // frame instead of three (found 2026-09-28: with a big photo a
            // step took 0.3-3.7 s). The downscale and generated palette are
            // shared by all three (PNGFormat.previewRenderer), made once per
            // setting.
            let rafPending = false;
            let restTimer = null;
            let renderer = null, rendererKey = null;
            const drawnKey = new Map();   // method id -> setting it shows
            const paint = (ids) => {
                const baseKey = `${state.brightness}|${state.contrast}|${state.scaling}`;
                const key = baseKey;
                if (key !== rendererKey) {
                    const adjusted = (state.brightness !== 0 || state.contrast !== 0)
                        ? PNGFormat.applyBrightnessContrast(decoded, state.brightness, state.contrast)
                        : decoded;
                    renderer = PNGFormat.previewRenderer(adjusted, state.scaling);
                    rendererKey = key;
                }
                for (const p of panes) {
                    // Only the Smooth conversion dithers dots; its pane also depends on the chosen Dither method
                    const paneKey = p.spec.id === 'smooth' ? `${key}|${state.dither}` : key;
                    if (!ids.includes(p.spec.id) || drawnKey.get(p.spec.id) === paneKey) continue;
                    const q = renderer(p.spec.id, p.spec.id === 'smooth' ? state.dither : undefined);
                    p.ctx.putImageData(new ImageData(q.data, q.width, q.height), 0, 0);
                    drawnKey.set(p.spec.id, paneKey);
                }
            };
            const catchUp = (ms) => {
                clearTimeout(restTimer);
                restTimer = setTimeout(() => {
                    if (!settled) paint(METHODS.map((m) => m.id));
                }, ms);
            };
            const refresh = (opening = false) => {
                // Every input event puts the catch-up off again
                if (!opening) catchUp(ImportDialogClass.PREVIEW_REST_MS);
                if (rafPending) return;
                rafPending = true;
                requestAnimationFrame(() => {
                    rafPending = false;
                    // A frame queued before Cancel/OK would otherwise render
                    // into detached canvases
                    if (settled) return;
                    paint([chosen.id]);
                    if (opening) catchUp(0);
                });
            };

            const addRange = (key, i18n, fallback) => {
                const row = document.createElement('div');
                row.className = 'tool-option';
                const label = document.createElement('label');
                label.htmlFor = `import-${key}`;
                const span = document.createElement('span');
                span.dataset.i18n = i18n;
                span.textContent = this._t(i18n, fallback);
                const valueEl = document.createElement('span');
                valueEl.className = 'opt-value';
                valueEl.textContent = '0';
                label.appendChild(span);
                label.appendChild(document.createTextNode(': '));
                label.appendChild(valueEl);
                const range = document.createElement('input');
                range.type = 'range';
                range.id = `import-${key}`;
                range.min = '-100';
                range.max = '100';
                range.value = '0';
                range.className = 'opt-input';
                range.addEventListener('input', () => {
                    state[key] = parseInt(range.value, 10) || 0;
                    valueEl.textContent = range.value;
                    refresh();
                });
                row.appendChild(label);
                row.appendChild(range);
                controls.appendChild(row);
                if (window.OptionControls) OptionControls.decorateSliders(row);
            };

            const addSelect = (key, i18n, fallback, options) => {
                const row = document.createElement('div');
                row.className = 'tool-option';
                const label = document.createElement('label');
                label.htmlFor = `import-${key}`;
                const span = document.createElement('span');
                span.dataset.i18n = i18n;
                span.textContent = this._t(i18n, fallback);
                label.appendChild(span);
                const select = document.createElement('select');
                select.id = `import-${key}`;
                select.className = 'opt-input';
                for (const opt of options) {
                    const el = document.createElement('option');
                    el.value = opt.value;
                    el.dataset.i18n = opt.i18n;
                    el.textContent = this._t(opt.i18n, opt.fallback);
                    if (opt.value === state[key]) el.selected = true;
                    select.appendChild(el);
                }
                select.addEventListener('change', () => {
                    state[key] = select.value;
                    refresh();
                });
                row.appendChild(label);
                row.appendChild(select);
                controls.appendChild(row);
            };

            // The Dither method (Batch 8 part 8B) drives the Smooth conversion; the indexed modes keep their own
            // colour dither, so there it is shown shut with the reason.
            const addDitherSelect = () => {
                const row = document.createElement('div');
                row.className = 'tool-option';
                const label = document.createElement('label');
                label.htmlFor = 'import-dither';
                const span = document.createElement('span');
                span.dataset.i18n = 'import.dither';
                span.textContent = this._t('import.dither', 'Dither');
                label.appendChild(span);
                const dsel = document.createElement('select');
                dsel.id = 'import-dither';
                dsel.className = 'opt-input';
                const groups = [['threshold', 'Threshold'], ['diffusion', 'Error diffusion'], ['bayer', 'Bayer matrix'],
                                ['cluster', 'Cluster dot'], ['supercell', 'Supercell']];
                for (const [fam, fb] of groups) {
                    const og = document.createElement('optgroup');
                    og.dataset.i18nLabel = `dither.family.${fam}`;
                    og.label = this._t(`dither.family.${fam}`, fb);
                    for (const m of Dither.METHODS.filter((x) => x.family === fam)) {
                        const el = document.createElement('option');
                        el.value = m.id;
                        el.dataset.i18n = m.i18n;
                        el.textContent = this._t(m.i18n, m.id);
                        if (m.id === state.dither) el.selected = true;
                        og.appendChild(el);
                    }
                    dsel.appendChild(og);
                }
                const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
                if (indexed) {
                    dsel.disabled = true;
                    row.title = this._t('import.ditherIndexed', 'This mode keeps its own colour dither.');
                    row.dataset.i18nTitle = 'import.ditherIndexed';
                } else {
                    row.title = this._t('import.dither.hint', 'How the Smooth conversion turns shades into dots.');
                    row.dataset.i18nTitle = 'import.dither.hint';
                }
                dsel.addEventListener('change', () => {
                    state.dither = dsel.value;
                    select(METHODS.find((m) => m.id === 'smooth'));
                    refresh();
                });
                row.appendChild(label);
                row.appendChild(dsel);
                controls.appendChild(row);
            };

            addRange('brightness', 'import.brightness', 'Brightness');
            addRange('contrast',   'import.contrast',   'Contrast');
            addSelect('scaling', 'import.scaling', 'Scaling', [
                { value: 'fit',     i18n: 'import.scalingFit',     fallback: 'Fit (letterbox)' },
                { value: 'stretch', i18n: 'import.scalingStretch', fallback: 'Stretch' },
                { value: 'crop',    i18n: 'import.scalingCrop',    fallback: 'Crop (fill)' }
            ]);
            addDitherSelect();


            Dialog.open({
                id: 'import-conversion',
                titleI18n: 'dialog.importImage',
                title: 'Import Image',
                content,
                className: 'import-conversion-dialog',
                buttons: [
                    { i18n: 'dialog.cancel', label: 'Cancel', onClick: () => { settle(null); } },
                    { i18n: 'dialog.ok', label: 'OK', primary: true,
                      onClick: () => settle({
                          ...state,
                          method: chosen.method,
                          dithering: chosen.id === 'smooth' ? state.dither : chosen.dithering,
                          choice: chosen.id
                      }) }
                ],
                // × button and Esc land here without a prior settle -> cancel
                onClose: () => settle(null)
            });

            // Opening: the chosen method first, the others right after
            refresh(true);
        });
    }
}

/**
 * How long the controls must rest before the two previews that are not the
 * chosen one catch up. [A] Long enough that a slider drag's steady stream
 * of input events keeps putting it off, short enough to feel immediate once
 * the drag stops.
 */
ImportDialogClass.PREVIEW_REST_MS = 150;

window.ImportDialog = new ImportDialogClass();

Logger.debug('ImportDialog', 'Import conversion dialog loaded');

})(); // End IIFE
