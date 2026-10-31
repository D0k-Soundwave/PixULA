'use strict';
(function() {

/**
 * ImportDialog — the image import conversion dialog (Phase 8).
 *
 * Shown by FileManager before a PNG/JPG import is parsed: brightness,
 * contrast, placement and dithering with a live preview of the exact
 * quantized result. Placement is the Reference panel's: Fit / Fill / Stretch /
 * Center, Scale, Rotation, Offset with the direction pad, the flips, and a
 * button that copies the reference layer's placement (js/utils/placement.js
 * is the one description both use). All pixel math stays in io/ (PNGFormat:
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
     *   placement:?Object,dithering:string,method:string,choice:string}|null>}
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

        // Opens on Fit, which is what Scaling's default always was. Stretch
        // is not a placement (it scales the two sides apart), so it is a
        // flag that sets the placement aside rather than a value of it.
        const state = { brightness: 0, contrast: 0, dither: 'floyd-steinberg', ditherTouched: false,
                        placement: Placement.fitted('contain', decoded.width, decoded.height), stretch: false };
        // The Dither method drives Smooth always, and Sharp once the person has chosen one (until then Sharp is shown, and imported, exactly
        // as it always was: no dither). Flat never dithers.
        const ditherFor = (id) => (id === 'smooth' ? state.dither : (id === 'sharp' && state.ditherTouched ? state.dither : undefined));
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

            // Two groups side by side (wrapping on a narrow window): what the
            // picture looks like, and where it sits
            const controlsWrap = document.createElement('div');
            controlsWrap.className = 'import-controls';
            content.appendChild(controlsWrap);
            const controls = document.createElement('div');
            controls.className = 'import-controls__group';
            controlsWrap.appendChild(controls);
            const placeGroup = document.createElement('div');
            placeGroup.className = 'import-controls__group import-placement';
            controlsWrap.appendChild(placeGroup);

            const scalingNow = () => (state.stretch ? 'stretch' : 'fit');
            const placementNow = () => (state.stretch ? null : { ...state.placement });

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
                const key = `${state.brightness}|${state.contrast}|${state.stretch ? 'stretch' : JSON.stringify(state.placement)}`;
                if (key !== rendererKey) {
                    const adjusted = (state.brightness !== 0 || state.contrast !== 0)
                        ? PNGFormat.applyBrightnessContrast(decoded, state.brightness, state.contrast)
                        : decoded;
                    renderer = PNGFormat.previewRenderer(adjusted, scalingNow(), placementNow());
                    rendererKey = key;
                }
                for (const p of panes) {
                    // Smooth (and Sharp, once a method was chosen) dither dots; their panes also depend on the chosen Dither method
                    const paneKey = ditherFor(p.spec.id) ? `${key}|${ditherFor(p.spec.id)}` : key;
                    if (!ids.includes(p.spec.id) || drawnKey.get(p.spec.id) === paneKey) continue;
                    const q = renderer(p.spec.id, ditherFor(p.spec.id));
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
                row.title = this._t('import.dither.hint', 'How the Smooth conversion turns shades into ink and paper pixels.');
                row.dataset.i18nTitle = 'import.dither.hint';
                dsel.addEventListener('change', () => {
                    state.dither = dsel.value;
                    state.ditherTouched = true;
                    // Flat does not dither: look at a conversion that does
                    if (chosen.id === 'flat') select(METHODS.find((m) => m.id === 'smooth'));
                    catchUp(0);
                    refresh();
                });
                row.appendChild(label);
                row.appendChild(dsel);
                controls.appendChild(row);
            };

            addRange('brightness', 'import.brightness', 'Brightness');
            addRange('contrast',   'import.contrast',   'Contrast');
            addDitherSelect();
            const syncPlacement = this._buildPlacementControls(placeGroup, state, decoded, () => refresh());
            syncPlacement();


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
                          brightness: state.brightness,
                          contrast: state.contrast,
                          scaling: scalingNow(),
                          placement: placementNow(),
                          method: chosen.method,
                          dithering: ditherFor(chosen.id) || chosen.dithering,
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

    /**
     * The Placement group: the Reference panel's controls, laid on the import
     * instead of the reference layer. Every control writes state.placement
     * (or state.stretch) and calls onChange; the returned sync() redraws the
     * controls from the state, for the buttons that change several values.
     * @param {HTMLElement} host
     * @param {Object} state - the dialog state (placement, stretch)
     * @param {{width:number,height:number}} decoded - the picture, for Fit / Fill / Center
     * @param {function()} onChange
     * @returns {function()} sync
     * @private
     */
    _buildPlacementControls(host, state, decoded, onChange) {
        const W = decoded.width, H = decoded.height;
        const changed = () => { sync(); onChange(); };

        const heading = document.createElement('div');
        heading.className = 'panel-label';
        heading.dataset.i18n = 'reference.fit';
        heading.textContent = this._t('reference.fit', 'Placement');
        host.appendChild(heading);

        const mkButton = (row, i18n, fallback, hintKey, hintFallback, onClick, toggle = false) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = toggle ? 'panel-button small toggle' : 'panel-button small';
            btn.dataset.i18n = i18n;
            btn.textContent = this._t(i18n, fallback);
            if (hintKey) {
                btn.dataset.i18nTitle = hintKey;
                btn.title = this._t(hintKey, hintFallback);
            }
            btn.addEventListener('click', onClick);
            row.appendChild(btn);
            return btn;
        };
        const fitTo = (mode) => {
            state.stretch = false;
            state.placement = Placement.fitted(mode, W, H, state.placement);
            changed();
        };

        const fitRow = document.createElement('div');
        fitRow.className = 'panel-row button-row';
        host.appendChild(fitRow);
        mkButton(fitRow, 'reference.contain', 'Fit', 'reference.contain.hint',
            'Scale so the whole image fits inside the canvas', () => fitTo('contain'));
        mkButton(fitRow, 'reference.cover', 'Fill', 'reference.cover.hint',
            'Scale so the image fills the canvas, cropping the overhang', () => fitTo('cover'));
        const stretchBtn = mkButton(fitRow, 'import.scalingStretch', 'Stretch', 'import.stretch.hint',
            'Pull the picture to the exact size of the screen, whatever its shape', () => {
                state.stretch = !state.stretch;
                changed();
            }, true);
        const centerBtn = mkButton(fitRow, 'reference.center', 'Center', 'reference.center.hint',
            'Recentre the image at its current scale', () => {
                const o = Placement.centredOffset(state.placement.scale, W, H);
                state.placement = { ...state.placement, offsetX: o.x, offsetY: o.y };
                changed();
            });

        // Scale and Rotation: the Reference panel's ranges (see its comments -
        // a negative scale mirrors; rotation is signed)
        const slider = (id, i18n, fallback, min, max, unit, prop) => {
            const row = document.createElement('div');
            row.className = 'tool-option';
            const label = document.createElement('label');
            label.htmlFor = id;
            const span = document.createElement('span');
            span.dataset.i18n = i18n;
            span.textContent = this._t(i18n, fallback);
            const valueEl = document.createElement('span');
            valueEl.className = 'opt-value';
            label.appendChild(span);
            label.appendChild(document.createTextNode(': '));
            label.appendChild(valueEl);
            const range = document.createElement('input');
            range.type = 'range';
            range.id = id;
            range.min = String(min);
            range.max = String(max);
            range.className = 'opt-input';
            range.addEventListener('input', () => {
                const v = parseInt(range.value, 10) || 0;
                if (prop === 'scale') {
                    // Zoom about the picture's centre, as a person expects of
                    // a scale control, rather than about its corner. 0 would
                    // make the picture vanish, so it holds at 1.
                    const p = state.placement, next = v || 1;
                    const d = (p.scale - next) / 100;
                    state.placement = { ...p, scale: next,
                        offsetX: p.offsetX + W * d / 2, offsetY: p.offsetY + H * d / 2 };
                } else {
                    state.placement = { ...state.placement, [prop]: v };
                }
                changed();
            });
            row.appendChild(label);
            row.appendChild(range);
            host.appendChild(row);
            if (window.OptionControls) OptionControls.decorateSliders(row);
            return { range, sync: () => {
                const v = Math.round(state.placement[prop]);
                range.value = String(v);
                valueEl.textContent = `${v}${unit}`;
            } };
        };
        const scale = slider('import-scale', 'reference.scale', 'Scale', -99, 500, '%', 'scale');
        const rotation = slider('import-rotation', 'reference.rotation', 'Rotation', -180, 180, '°', 'rotation');

        // Offset: the two fields and the held-to-repeat direction pad, the
        // Reference panel's own (Helpers.buildDirPad + attachRepeatPress).
        // The fields and the flips stack beside the pad, so the group stays
        // short enough to fit a small window.
        const offWrap = document.createElement('div');
        offWrap.className = 'import-offset';
        host.appendChild(offWrap);
        const offFields = document.createElement('div');
        offFields.className = 'import-offset__fields';
        offWrap.appendChild(offFields);
        const offLabel = document.createElement('div');
        offLabel.className = 'panel-label';
        offLabel.dataset.i18n = 'reference.offset';
        offLabel.textContent = this._t('reference.offset', 'Offset');
        offFields.appendChild(offLabel);
        const offRow = document.createElement('div');
        offRow.className = 'panel-row input-row';
        offFields.appendChild(offRow);
        const mkNum = (id, i18n, fallback, prop) => {
            const l = document.createElement('label');
            l.htmlFor = id;
            l.dataset.i18n = i18n;
            l.textContent = this._t(i18n, fallback);
            const input = document.createElement('input');
            input.type = 'number';
            input.id = id;
            input.className = 'panel-input small';
            // Unreadable leaves the axis where it is (the Reference panel's
            // readAxis, for the same reason)
            input.addEventListener('change', () => {
                const typed = parseInt(input.value, 10);
                if (Number.isFinite(typed)) state.placement = { ...state.placement, [prop]: typed };
                changed();
            });
            offRow.appendChild(l);
            offRow.appendChild(input);
            return input;
        };
        const offX = mkNum('import-offset-x', 'reference.x', 'X', 'offsetX');
        const offY = mkNum('import-offset-y', 'reference.y', 'Y', 'offsetY');
        const nudge = (prop, delta) => {
            state.placement = { ...state.placement, [prop]: Math.round(state.placement[prop]) + delta };
            changed();
        };
        const { element: pad, zones } = Helpers.buildDirPad();
        Helpers.attachRepeatPress(zones.up,    () => nudge('offsetY', -1));
        Helpers.attachRepeatPress(zones.down,  () => nudge('offsetY', 1));
        Helpers.attachRepeatPress(zones.left,  () => nudge('offsetX', -1));
        Helpers.attachRepeatPress(zones.right, () => nudge('offsetX', 1));
        offWrap.appendChild(pad);

        const flipRow = document.createElement('div');
        flipRow.className = 'panel-row button-row';
        offFields.appendChild(flipRow);
        const flipX = mkButton(flipRow, 'reference.flipH', 'Flip H', null, null, () => {
            state.placement = { ...state.placement, flipX: !state.placement.flipX };
            changed();
        }, true);
        const flipY = mkButton(flipRow, 'reference.flipV', 'Flip V', null, null, () => {
            state.placement = { ...state.placement, flipY: !state.placement.flipY };
            changed();
        }, true);

        // The reference layer's placement, carried over: line the photo up as
        // a reference, then import it on exactly those pixels. Rotation comes
        // back from the service as 0-359; the slider is signed.
        const refInfo = (window.ReferenceLayerService && ReferenceLayerService.hasImage())
            ? ReferenceLayerService.getImageInfo() : null;
        const useRef = mkButton(host, 'import.useReference', 'Use reference placement', 'import.useReference.hint',
            'Place the picture where the reference image sits on the canvas', () => {
                const r = ReferenceLayerService.getState();
                const rot = ((Math.round(r.rotation || 0) % 360) + 360) % 360;
                const p = Placement.matching({ ...r, rotation: rot > 180 ? rot - 360 : rot },
                    refInfo.width, refInfo.height, W, H);
                if (!p) return;
                state.stretch = false;
                state.placement = p;
                changed();
            });
        useRef.classList.add('full-width');
        useRef.disabled = !refInfo;

        const placementOnly = [scale.range, rotation.range, offX, offY, centerBtn, flipX, flipY,
            zones.up, zones.down, zones.left, zones.right];
        const sync = () => {
            scale.sync();
            rotation.sync();
            offX.value = String(Math.round(state.placement.offsetX));
            offY.value = String(Math.round(state.placement.offsetY));
            flipX.classList.toggle('active', !!state.placement.flipX);
            flipY.classList.toggle('active', !!state.placement.flipY);
            stretchBtn.classList.toggle('active', state.stretch);
            // Stretch has no position, size or turn of its own
            for (const el of placementOnly) el.disabled = state.stretch;
        };
        return sync;
    }

    /**
     * "Make a fill from a picture": the same controls as the import dialog but one result, a pattern tile
     * (Batch 8 part 8B2). A tile is 8, 16 or 32 pixels square (the pattern library's sizes), so the preview is the tile
     * repeated, built by the same PNGFormat.patternFromImage the result comes from.
     * @param {ArrayBuffer} buffer - Raw file bytes
     * @param {string} ext - 'png' | 'jpg' | 'jpeg' | 'gif'
     * @returns {Promise<{size:number,bitmap:Uint8Array}|null|undefined>} the tile; null if cancelled; undefined if the file
     *   could not be read as a picture
     */
    async showPattern(buffer, ext) {
        const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
            : (ext === 'gif') ? 'image/gif' : 'image/png';
        const decoded = await PNGFormat.decodeToImageData(buffer, mime);
        if (!decoded) return undefined;

        const state = { brightness: 0, contrast: 0, scaling: 'crop', size: 32, dither: 'floyd-steinberg' };

        return new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (!settled) { settled = true; resolve(value); }
            };

            const content = document.createElement('div');
            content.className = 'import-dialog-body';

            const preview = document.createElement('canvas');
            preview.className = 'import-preview pattern-from-picture-preview';
            preview.width = 128;
            preview.height = 128;
            content.appendChild(preview);

            const controls = document.createElement('div');
            controls.className = 'import-controls';
            content.appendChild(controls);

            const tile = () => PNGFormat.patternFromImage(decoded, {
                size: state.size, dithering: state.dither, brightness: state.brightness,
                contrast: state.contrast, scaling: state.scaling
            });
            const draw = () => {
                if (settled) return;
                const bits = tile();
                const n = state.size, zoom = Math.max(1, Math.floor(128 / (n * 2)));
                const ctx = preview.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, 128, 128);
                ctx.fillStyle = '#000';
                // the tile repeated, so the join shows
                for (let ty = 0; ty * n * zoom < 128; ty++) {
                    for (let tx = 0; tx * n * zoom < 128; tx++) {
                        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                            if (bits[y * n + x]) ctx.fillRect((tx * n + x) * zoom, (ty * n + y) * zoom, zoom, zoom);
                        }
                    }
                }
            };
            let rafPending = false;
            const refresh = () => {
                if (rafPending) return;
                rafPending = true;
                requestAnimationFrame(() => { rafPending = false; draw(); });
            };

            const row = (key, i18n, fallback, control) => {
                const r = document.createElement('div');
                r.className = 'tool-option';
                const label = document.createElement('label');
                label.htmlFor = `pattern-${key}`;
                const span = document.createElement('span');
                span.dataset.i18n = i18n;
                span.textContent = this._t(i18n, fallback);
                label.appendChild(span);
                control.id = `pattern-${key}`;
                control.className = 'opt-input';
                r.appendChild(label);
                r.appendChild(control);
                controls.appendChild(r);
                return r;
            };
            const range = (key, i18n, fallback) => {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = '-100';
                input.max = '100';
                input.value = '0';
                input.addEventListener('input', () => { state[key] = parseInt(input.value, 10) || 0; refresh(); });
                const r = row(key, i18n, fallback, input);
                if (window.OptionControls) OptionControls.decorateSliders(r);
            };
            const select = (key, i18n, fallback, options, parse) => {
                const el = document.createElement('select');
                for (const opt of options) {
                    const o = document.createElement('option');
                    o.value = opt.value;
                    if (opt.i18n) o.dataset.i18n = opt.i18n;
                    o.textContent = opt.i18n ? this._t(opt.i18n, opt.fallback) : opt.fallback;
                    if (String(opt.value) === String(state[key])) o.selected = true;
                    el.appendChild(o);
                }
                el.addEventListener('change', () => { state[key] = parse ? parse(el.value) : el.value; refresh(); });
                row(key, i18n, fallback, el);
            };

            range('brightness', 'import.brightness', 'Brightness');
            range('contrast', 'import.contrast', 'Contrast');
            select('scaling', 'import.scaling', 'Scaling', [
                { value: 'fit',     i18n: 'import.scalingFit',     fallback: 'Fit (letterbox)' },
                { value: 'stretch', i18n: 'import.scalingStretch', fallback: 'Stretch' },
                { value: 'crop',    i18n: 'import.scalingCrop',    fallback: 'Crop (fill)' }
            ]);
            select('size', 'import.tileSize', 'Tile size', [8, 16, 32].map((n) => (
                { value: n, i18n: null, fallback: n + 'x' + n })), (v) => parseInt(v, 10));

            const dsel = document.createElement('select');
            for (const [fam, fb] of [['threshold', 'Threshold'], ['diffusion', 'Error diffusion'], ['bayer', 'Bayer matrix'],
                                     ['cluster', 'Cluster dot'], ['supercell', 'Supercell']]) {
                const og = document.createElement('optgroup');
                og.dataset.i18nLabel = `dither.family.${fam}`;
                og.label = this._t(`dither.family.${fam}`, fb);
                for (const m of Dither.METHODS.filter((x) => x.family === fam)) {
                    const o = document.createElement('option');
                    o.value = m.id;
                    o.dataset.i18n = m.i18n;
                    o.textContent = this._t(m.i18n, m.id);
                    if (m.id === state.dither) o.selected = true;
                    og.appendChild(o);
                }
                dsel.appendChild(og);
            }
            dsel.addEventListener('change', () => { state.dither = dsel.value; refresh(); });
            row('dither', 'import.dither', 'Dither', dsel);

            Dialog.open({
                id: 'pattern-from-picture',
                titleI18n: 'dialog.patternFromPicture',
                title: 'Make a fill from a picture',
                content,
                className: 'import-conversion-dialog',
                buttons: [
                    { i18n: 'dialog.cancel', label: 'Cancel', onClick: () => { settle(null); } },
                    { i18n: 'dialog.ok', label: 'OK', primary: true,
                      onClick: () => settle({ size: state.size, bitmap: tile() }) }
                ],
                onClose: () => settle(null)
            });
            draw();
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
