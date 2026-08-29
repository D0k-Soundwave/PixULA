'use strict';
(function() {

/**
 * PreferencesDialog — Settings > Preferences… and Reset All Preferences.
 *
 * Extracted out of MenuSystem (2026-08-29 debt pass): the whole Preferences
 * dialog (~650 lines) used to be hand-built inline in what is nominally "the
 * menu bar" component, unlike every other dialog (PaletteEditorDialog,
 * PresetDialog, ImportDialog), which each got its own file. Pure
 * restructuring — every method here is the same code, same call order, same
 * DOM and Storage keys as before the move; MenuSystem now only routes
 * `settings:preferences` to `open()` and `settings:resetAll` to `resetAll()`.
 */
class PreferencesDialogClass {

    /**
     * English fallback (dialog builds DOM, I18n.apply re-translates).
     *
     * `params` used to be accepted by callers and silently dropped: it was
     * never forwarded to I18n.t, so a parameterised string came out with its
     * `{placeholder}` intact in every language except English, where the
     * fallback template literal had already interpolated the value.
     * `msg.confirmReopen` had shipped that way. Same class of bug as the CLUT
     * labels: a parameterised string must carry its parameters to every place
     * that re-translates it, which for DOM elements means `data-i18n-param-*`
     * (read back by `I18nClass.paramsOf`) and here means this argument.
     * @param {string} key
     * @param {string} [fallback] - English text, used when the key is missing
     * @param {Object} [params] - values for any {placeholder} in the string
     * @private
     */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        if (fallback && params) {
            return String(fallback).replace(/\{(\w+)\}/g,
                (m, name) => (name in params ? params[name] : m));
        }
        return fallback;
    }

    /** Settings > Preferences… */
    open() {
        const content = document.createElement('div');
        content.className = 'preferences-dialog-body';
        content.innerHTML = `
            <h3 data-i18n="pref.general">${this._t('pref.general', 'General')}</h3>
            <label class="pref-row">
                <span data-i18n="pref.autosaveMinutes">${this._t('pref.autosaveMinutes', 'Autosave every (minutes, 0 = off)')}</span>
                <input type="number" id="pref-autosave-minutes" name="pref-autosave-minutes"
                       min="0" max="60" step="1" value="0">
            </label>
            <label class="pref-row">
                <span data-i18n="pref.defaultScreenMode">${this._t('pref.defaultScreenMode', 'New document screen type')}</span>
                <select id="pref-default-screen-mode" name="pref-default-screen-mode">
                    ${(window.ScreenModeService ? ScreenModeService.getModes() : []).map(m =>
                        `<option value="${m.id}" data-i18n="${m.i18n}">${this._t(m.i18n, m.id)}</option>`).join('')}
                </select>
            </label>
            <div class="pref-block__hint" data-i18n="pref.defaultScreenModeHint">${this._t('pref.defaultScreenModeHint', 'The screen mode File > New starts a blank canvas in.')}</div>
            <label class="pref-row">
                <input type="checkbox" id="pref-restore-on-boot" name="pref-restore-on-boot" checked>
                <span data-i18n="pref.restoreOnBoot">${this._t('pref.restoreOnBoot', 'Offer to restore unsaved work on start')}</span>
            </label>
            <div class="pref-block__hint" data-i18n="pref.restoreOnBootHint">${this._t('pref.restoreOnBootHint', 'Off starts every session with a blank canvas. Autosave still runs on its own interval above, in case of a crash within the session - this only decides whether it is ever offered back.')}</div>
            <label class="pref-row">
                <input type="checkbox" id="pref-confirm-clear" name="pref-confirm-clear" checked>
                <span data-i18n="pref.confirmClear">${this._t('pref.confirmClear', 'Confirm before clearing')}</span>
            </label>
            <div class="pref-block" id="pref-backup">
                <div class="pref-block__label" data-i18n="pref.backupFolder">${this._t('pref.backupFolder', 'Backup folder')}</div>
                <div class="pref-block__hint" data-i18n="pref.backupHint">${this._t('pref.backupHint', 'Each autosave also writes the whole document here as a numbered version, so you can go back to any of them.')}</div>
                <div class="pref-block__status" id="pref-backup-status"></div>
                <div class="pref-row">
                    <button type="button" class="panel-button" id="pref-backup-choose"
                            data-i18n="pref.backupChoose">${this._t('pref.backupChoose', 'Choose Folder...')}</button>
                    <button type="button" class="panel-button" id="pref-backup-resume" hidden
                            data-i18n="pref.backupResume">${this._t('pref.backupResume', 'Resume Backups')}</button>
                    <button type="button" class="panel-button" id="pref-backup-forget" hidden
                            data-i18n="pref.backupForget">${this._t('pref.backupForget', 'Stop')}</button>
                </div>
                <label class="pref-row">
                    <span data-i18n="pref.backupKeep">${this._t('pref.backupKeep', 'Versions to keep (0 = all)')}</span>
                    <input type="number" id="pref-backup-keep" name="pref-backup-keep"
                           min="0" max="999" step="1" value="20">
                </label>
            </div>
            <h3 data-i18n="pref.drawing">${this._t('pref.drawing', 'Drawing')}</h3>
            <label class="pref-row">
                <input type="checkbox" id="pref-reset-draw-mode" name="pref-reset-draw-mode">
                <span data-i18n="pref.resetDrawMode">${this._t('pref.resetDrawMode', 'Picking a tool returns the draw mode to Normal')}</span>
            </label>
            <label class="pref-row">
                <span data-i18n="pref.nudgeStep">${this._t('pref.nudgeStep', 'Arrow-key nudge distance (pixels)')}</span>
                <input type="number" id="pref-nudge-step" name="pref-nudge-step" min="1" max="32" value="1">
            </label>
            <h3 data-i18n="pref.input">${this._t('pref.input', 'Input')}</h3>
            <label class="pref-row">
                <input type="checkbox" id="pref-touch-draw" name="pref-touch-draw">
                <span data-i18n="pref.touchDrawing">${this._t('pref.touchDrawing', 'Touch draws on the canvas')}</span>
            </label>
            <label class="pref-row">
                <input type="checkbox" id="pref-touch-no-double" name="pref-touch-no-double">
                <span data-i18n="pref.touchNoDouble">${this._t('pref.touchNoDouble', 'Ignore touch while a pen or mouse button is down')}</span>
            </label>
            <label class="pref-row">
                <span data-i18n="pref.touchLockout">${this._t('pref.touchLockout', 'Ignore touch after pen or mouse use (milliseconds)')}</span>
                <input type="number" id="pref-touch-lockout" name="pref-touch-lockout"
                       min="0" max="${TOUCH_DEFAULTS.LOCKOUT_MAX_MS}" step="${TOUCH_DEFAULTS.LOCKOUT_STEP_MS}"
                       value="${TOUCH_DEFAULTS.lockoutMs}">
            </label>
            <div class="pref-block__hint" data-i18n="pref.touchLockoutHint">${this._t('pref.touchLockoutHint', 'Catches the palm that lands just before or just after the pen does. A hovering pen counts; a mouse counts only while it is dragging. 0 turns the window off.')}</div>
            <h3 data-i18n="pref.pen">${this._t('pref.pen', 'Pen')}</h3>
            <label class="pref-row">
                <input type="checkbox" id="pref-pressure-sensitivity" name="pref-pressure-sensitivity">
                <span data-i18n="pref.pressureSensitivity">${this._t('pref.pressureSensitivity', 'Pressure Sensitivity')}</span>
            </label>
            <label class="pref-row" id="pref-pressure-strength-row" hidden>
                <span data-i18n="pref.pressureStrength">${this._t('pref.pressureStrength', 'Pressure strength')} (%)</span>
                <input type="number" id="pref-pressure-strength" name="pref-pressure-strength"
                       min="0" max="200" step="5" value="100">
            </label>
            <div class="pref-block__hint" id="pref-pressure-strength-hint" hidden data-i18n="pref.pressureStrengthHint">${this._t('pref.pressureStrengthHint', 'How strongly pen pressure changes brush size and flow. 0% turns the effect off; 200% is the most dramatic.')}</div>
            <label class="pref-row">
                <span data-i18n="pref.penProfile">${this._t('pref.penProfile', 'Pen model')}</span>
                <select id="pref-pen-profile" name="pref-pen-profile"></select>
            </label>
            <div id="pref-pen-shape" hidden>
                <label class="pref-row">
                    <span data-i18n="pref.penButtonCount">${this._t('pref.penButtonCount', 'Side buttons')}</span>
                    <select id="pref-pen-barrels" name="pref-pen-barrels">
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                    </select>
                </label>
                <label class="pref-row">
                    <input type="checkbox" id="pref-pen-eraser-end" name="pref-pen-eraser-end">
                    <span data-i18n="pref.penHasEraser">${this._t('pref.penHasEraser', 'Has an eraser end')}</span>
                </label>
            </div>
            <div id="pref-pen-controls"></div>
            <div class="pen-check" id="pref-pen-check">
                <div class="pen-check__label" data-i18n="pref.penCheck">${this._t('pref.penCheck', 'Pen check')}</div>
                <div class="pen-check__hint" data-i18n="pref.penCheckHint">${this._t('pref.penCheckHint', 'Press each control against this box. Whatever the browser reports lights up - that is what can be assigned.')}</div>
                <div class="pen-check__bits"></div>
            </div>
            <h3 data-i18n="pref.privacy">${this._t('pref.privacy', 'Privacy')}</h3>
            <div class="pref-block" id="pref-privacy">
                <div class="pref-block__hint" data-i18n="pref.privacyStatement">${this._t('pref.privacyStatement', 'This program has no network access of any kind. Nothing you draw, and nothing about how you use it, is ever sent anywhere - there is no server, no analytics and no third-party code. What it keeps is kept on this machine, for you.')}</div>
                <div class="pref-block__label" data-i18n="pref.privacyStored">${this._t('pref.privacyStored', 'Stored in this browser')}</div>
                <div class="pref-block__status" id="pref-privacy-usage"></div>
                <div class="pref-block__label" data-i18n="pref.privacyDisk">${this._t('pref.privacyDisk', 'Written outside the browser')}</div>
                <div class="pref-block__status" id="pref-privacy-disk"></div>
                <div class="pref-row">
                    <button type="button" class="panel-button" id="pref-privacy-clear"
                            data-i18n="pref.privacyClear">${this._t('pref.privacyClear', 'Clear All Stored Data...')}</button>
                </div>
                <div class="pref-block__hint" data-i18n="pref.privacyClearHint">${this._t('pref.privacyClearHint', 'Empties everything listed above and reloads. Files you saved yourself, including backup versions, are left alone.')}</div>
            </div>
            <h3 data-i18n="pref.accessibility">${this._t('pref.accessibility', 'Accessibility')}</h3>
            <label class="pref-row">
                <input type="checkbox" id="tts-toggle" name="tts-toggle">
                <span data-i18n="a11y.speak">${this._t('a11y.speak', 'Speak')}</span>
            </label>
            <div class="pref-block__hint" data-i18n="a11y.speakHint">${this._t('a11y.speakHint', 'Speak UI changes aloud')}</div>
        `;
        this._initPenPreferences(content);
        this._initBackupPreferences(content);
        this._initPrivacyPreferences(content);
        if (window.A11yAnnouncer) A11yAnnouncer.wireTtsToggle(content);
        // Reflect the live state (seeded from Storage at boot)
        const autosaveMinutes = content.querySelector('#pref-autosave-minutes');
        if (autosaveMinutes) {
            autosaveMinutes.value = String(StateManager.getAutosaveMinutes());
            // A number input left EMPTY has no value for the spinner to step
            // from, so the HTML stepping algorithm falls back to a base of 0
            // and the very first spinner click lands on 1 - not the 0 the
            // empty field actually reads as. Snapping empty back to '0' the
            // instant it happens means the spinner always steps from the
            // value on screen, matching what a clamp on save would store.
            autosaveMinutes.addEventListener('input', () => {
                if (autosaveMinutes.value === '') autosaveMinutes.value = '0';
            });
        }
        const defaultScreenMode = content.querySelector('#pref-default-screen-mode');
        if (defaultScreenMode) {
            defaultScreenMode.value = StateManager.get('defaultScreenMode') || 'standard_ula';
        }
        const restoreOnBoot = content.querySelector('#pref-restore-on-boot');
        if (restoreOnBoot) restoreOnBoot.checked = StateManager.get('restoreOnBoot') !== false;
        const confirmClear = content.querySelector('#pref-confirm-clear');
        if (confirmClear) confirmClear.checked = StateManager.get('confirmClear') !== false;
        const resetDrawMode = content.querySelector('#pref-reset-draw-mode');
        if (resetDrawMode) resetDrawMode.checked = StateManager.get('resetDrawModeOnTool') === true;
        const nudgeStep = content.querySelector('#pref-nudge-step');
        if (nudgeStep) nudgeStep.value = String(clamp(parseInt(StateManager.get('nudgeStep'), 10) || 1, 1, 32));
        const touchDraw = content.querySelector('#pref-touch-draw');
        if (touchDraw) touchDraw.checked = StateManager.get('touchDrawing') !== false;
        const touchNoDouble = content.querySelector('#pref-touch-no-double');
        if (touchNoDouble) touchNoDouble.checked = StateManager.get('touchBlockWhileContact') !== false;
        const touchLockout = content.querySelector('#pref-touch-lockout');
        if (touchLockout) {
            touchLockout.value = String(TouchPolicy.normalizeLockout(StateManager.get('touchLockoutMs')));
        }
        this._initPressurePreferences(content);

        Dialog.open({
            id: 'preferences-dialog',
            titleI18n: 'dialog.preferences',
            title: 'Preferences',
            content,
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'dialog.ok', label: 'OK', primary: true,
                    onClick: (dialog) => this._save(dialog)
                }
            ]
        });
    }

    /**
     * Wire the Preferences privacy block.
     *
     * It prints the LIVE contents of the database rather than a paragraph
     * someone wrote once: "what does this keep about me" should be answered by
     * counting, the same way every other figure in this project is. Stores
     * holding nothing are left out - a list of twelve zeroes is harder to read
     * than the two lines that are actually true.
     * @private
     */
    _initPrivacyPreferences(root) {
        const block = root.querySelector('#pref-privacy');
        if (!block) return;

        const usage = block.querySelector('#pref-privacy-usage');
        const disk = block.querySelector('#pref-privacy-disk');
        const clear = block.querySelector('#pref-privacy-clear');

        const renderDisk = () => {
            const lines = [];
            const backup = window.BackupService ? BackupService.getState() : null;
            if (backup && backup.configured) {
                lines.push(this._t('pref.privacyDiskBackup',
                    'Backup versions in the folder {folder}.',
                    { folder: backup.folderName }));
            }
            // A linked reference photo is a pointer to a file of the artist's
            // own, which is exactly the kind of thing this list exists to name.
            if (window.ReferenceLayerService && ReferenceLayerService.getFileHandle &&
                ReferenceLayerService.getFileHandle()) {
                lines.push(this._t('pref.privacyDiskReference',
                    'A link to your reference photo.'));
            }
            disk.textContent = lines.length
                ? lines.join(' ')
                : this._t('pref.privacyDiskNone', 'Nothing. No folder or file is linked.');
        };

        const renderUsage = async () => {
            usage.textContent = this._t('pref.privacyCounting', 'Counting...');
            try {
                const info = await Storage.describeUsage();
                const filled = info.stores.filter(s => s.records);
                const parts = filled.map(s => `${s.store}: ${s.records}`);
                if (info.localKeys) {
                    parts.push(this._t('pref.privacyLocalKeys', '{count} settings keys',
                        { count: info.localKeys }));
                }
                const size = typeof info.bytes === 'number'
                    ? this._t('pref.privacySize', 'About {kb} KB in total.',
                        { kb: Math.round(info.bytes / 1024) }) : '';
                usage.textContent = parts.length
                    ? `${parts.join(', ')}. ${size}`.trim()
                    : this._t('pref.privacyEmpty', 'Nothing stored yet.');
            } catch (error) {
                usage.textContent = this._t('pref.privacyUnknown',
                    'Could not read the stored data.');
            }
        };

        clear.addEventListener('click', async () => {
            if (!confirm(this._t('msg.confirmClearData',
                'Delete everything this program has stored in the browser, and reload? Files you saved yourself are not touched.'))) {
                return;
            }
            await Storage.clearEverything();
            location.reload();
        });

        renderDisk();
        renderUsage();
        EventBus.on(EVENTS.BACKUP_STATE_CHANGED, renderDisk);
    }

    /**
     * Wire the Preferences backup block.
     *
     * All three buttons act IMMEDIATELY rather than on OK, because two of them
     * open a native permission flow: `showDirectoryPicker` and
     * `requestPermission` both need the click itself as the user gesture, and
     * deferring them to the dialog's OK handler would put a second click
     * between the gesture and the ask - which Chrome does not accept. The keep
     * count is an ordinary field and is read back with the rest on OK.
     * @private
     */
    _initBackupPreferences(root) {
        const block = root.querySelector('#pref-backup');
        if (!block) return;

        const status = block.querySelector('#pref-backup-status');
        const choose = block.querySelector('#pref-backup-choose');
        const resume = block.querySelector('#pref-backup-resume');
        const forget = block.querySelector('#pref-backup-forget');
        const keep = block.querySelector('#pref-backup-keep');

        const render = (state) => {
            keep.value = String(state.keepVersions);

            if (!state.supported) {
                status.textContent = this._t('pref.backupUnsupported',
                    'This browser cannot write to a folder.');
                choose.disabled = true;
                resume.hidden = forget.hidden = true;
                return;
            }
            resume.hidden = !state.needsPermission;
            forget.hidden = !state.configured;

            if (!state.configured) {
                status.textContent = this._t('pref.backupOff',
                    'Off - autosave only saves inside the browser.');
            } else if (state.needsPermission) {
                status.textContent = this._t('pref.backupNeedsPermission',
                    'Paused - the browser needs permission for this folder again.');
            } else if (state.lastWritten) {
                status.textContent = this._t('pref.backupLast',
                    'Backing up to {folder}. Last saved {file}.',
                    { folder: state.folderName, file: state.lastWritten.name });
            } else {
                status.textContent = this._t('pref.backupReady', 'Backing up to {folder}.',
                    { folder: state.folderName });
            }
        };

        choose.addEventListener('click', async () => {
            await BackupService.chooseFolder();
        });
        resume.addEventListener('click', async () => {
            await BackupService.resume();
        });
        forget.addEventListener('click', async () => {
            await BackupService.forgetFolder();
        });

        // The service is the fact source; the dialog only renders it. That is
        // what keeps the status right after a pick without re-reading anything.
        const off = EventBus.on(EVENTS.BACKUP_STATE_CHANGED, render);
        block.addEventListener('dialog-closed', off);

        render(BackupService.getState());
    }

    /**
     * Read the pen block back out of the dialog.
     *
     * Only the controls the chosen profile shows are written, and any earlier
     * assignment for a control that is no longer visible is KEPT: switching to
     * a simpler pen to try it should not silently discard the mapping you had.
     * @returns {?{profile: string, custom: Object, actions: Object}}
     * @private
     */
    _readPenPreferences(dialog) {
        const profileSelect = dialog.querySelector('#pref-pen-profile');
        if (!profileSelect) return null;
        const barrelsSelect = dialog.querySelector('#pref-pen-barrels');
        const eraserCheck = dialog.querySelector('#pref-pen-eraser-end');

        const previous = (window.InputHandler && InputHandler.getPenConfig)
            ? InputHandler.getPenConfig().actions : {};
        const actions = Object.assign({}, previous);
        for (const select of dialog.querySelectorAll('[data-pen-control]')) {
            actions[select.getAttribute('data-pen-control')] = select.value;
        }

        return {
            profile: profileSelect.value,
            custom: {
                barrels: barrelsSelect ? parseInt(barrelsSelect.value, 10) : 1,
                eraser: eraserCheck ? eraserCheck.checked : false
            },
            actions
        };
    }

    /**
     * Wire the Preferences pressure block: reflect live state, and show the
     * strength row only while the checkbox is on (same hide-don't-disable
     * pattern as #pref-pen-shape below).
     * @private
     */
    _initPressurePreferences(root) {
        const enabledCheck = root.querySelector('#pref-pressure-sensitivity');
        const strengthRow = root.querySelector('#pref-pressure-strength-row');
        const strengthHint = root.querySelector('#pref-pressure-strength-hint');
        const strengthInput = root.querySelector('#pref-pressure-strength');
        if (!enabledCheck || !strengthRow || !strengthInput) return;

        enabledCheck.checked = StateManager.get('pressureSensitivity') === true;
        const rawStrength = StateManager.get('pressureStrength');
        strengthInput.value = String(clamp(typeof rawStrength === 'number' ? rawStrength : 100, 0, 200));

        const syncStrengthVisibility = () => {
            strengthRow.hidden = !enabledCheck.checked;
            if (strengthHint) strengthHint.hidden = !enabledCheck.checked;
        };
        syncStrengthVisibility();
        enabledCheck.addEventListener('change', syncStrengthVisibility);
    }

    /**
     * Wire the Preferences pen block: the model selector, the generic profile's
     * own shape controls, the per-control action rows and the live pen check.
     *
     * The rows are rebuilt rather than hidden, because which controls exist is
     * the profile's whole contribution — an Apple Pencil has nothing to assign
     * and should say so rather than show three inert selects.
     * @private
     */
    _initPenPreferences(root) {
        const profileSelect = root.querySelector('#pref-pen-profile');
        const shapeBlock = root.querySelector('#pref-pen-shape');
        const barrelsSelect = root.querySelector('#pref-pen-barrels');
        const eraserCheck = root.querySelector('#pref-pen-eraser-end');
        const controls = root.querySelector('#pref-pen-controls');
        if (!profileSelect || !controls) return;

        const config = (window.InputHandler && InputHandler.getPenConfig)
            ? InputHandler.getPenConfig()
            : { profile: PEN_PROFILES.generic.id, custom: {}, actions: {} };

        // Grouped by vendor (optgroup) so ~20 real models stay scannable;
        // `generic` carries no group and renders as a plain top-level option.
        const groups = new Map();
        for (const key of Object.keys(PEN_PROFILES)) {
            const profile = PEN_PROFILES[key];
            const option = document.createElement('option');
            option.value = profile.id;
            // Brand and model names are proper nouns — only the generic entry
            // is a phrase that needs translating.
            option.textContent = profile.label || this._t(profile.i18n, 'Generic / other');
            if (profile.i18n) option.setAttribute('data-i18n', profile.i18n);

            if (!profile.group) {
                profileSelect.appendChild(option);
                continue;
            }
            let optgroup = groups.get(profile.group);
            if (!optgroup) {
                optgroup = document.createElement('optgroup');
                optgroup.label = profile.group;
                groups.set(profile.group, optgroup);
                profileSelect.appendChild(optgroup);
            }
            optgroup.appendChild(option);
        }
        // A saved family-level id (from before the list was split into real
        // models) resolves through PEN_PROFILE_ALIASES so the picker highlights
        // the specific model it now means, not a mismatched value that falls
        // through to nothing and reads as Generic.
        profileSelect.value = PenMap.getProfile(config.profile).id;
        if (barrelsSelect) barrelsSelect.value = String(PenMap.shape(config.profile, config.custom).barrels);
        if (eraserCheck) eraserCheck.checked = PenMap.shape(config.profile, config.custom).eraser === true;

        const readShape = () => ({
            barrels: barrelsSelect ? parseInt(barrelsSelect.value, 10) : 1,
            eraser: eraserCheck ? eraserCheck.checked : false
        });
        const render = () => {
            const profileId = profileSelect.value;
            const isCustom = PenMap.getProfile(profileId).custom === true;
            if (shapeBlock) shapeBlock.hidden = !isCustom;
            this._renderPenControlRows(controls, profileId, readShape(), config.actions);
        };

        const penCheck = this._initPenCheck(root.querySelector('#pref-pen-check'));
        const renderPenCheck = () => penCheck.setControls(
            [PEN_CONTROLS.TIP.id, ...PenMap.controlsFor(profileSelect.value, readShape())]);
        const renderAll = () => { render(); renderPenCheck(); };

        profileSelect.addEventListener('change', renderAll);
        if (barrelsSelect) barrelsSelect.addEventListener('change', renderAll);
        if (eraserCheck) eraserCheck.addEventListener('change', renderAll);
        renderAll();
    }

    /**
     * One action row per assignable control, plus the fixed note about the tip.
     * @private
     */
    _renderPenControlRows(container, profileId, custom, assigned) {
        container.textContent = '';
        const controlList = PenMap.controlsFor(profileId, custom);

        if (controlList.length === 0) {
            const note = document.createElement('p');
            note.className = 'pref-note';
            note.setAttribute('data-i18n', 'pref.penNoControls');
            note.textContent = this._t('pref.penNoControls',
                'This pen has no buttons a browser can see.');
            container.appendChild(note);
            return;
        }

        for (const controlId of controlList) {
            const control = Object.keys(PEN_CONTROLS)
                .map(k => PEN_CONTROLS[k]).find(c => c.id === controlId);
            const row = document.createElement('label');
            row.className = 'pref-row';

            const label = document.createElement('span');
            label.setAttribute('data-i18n', control.i18n);
            label.textContent = this._t(control.i18n, controlId);
            row.appendChild(label);

            const select = document.createElement('select');
            select.setAttribute('data-pen-control', controlId);
            select.name = `pref-pen-${controlId}`;
            for (const key of Object.keys(PEN_ACTIONS)) {
                const action = PEN_ACTIONS[key];
                const option = document.createElement('option');
                option.value = action.id;
                option.setAttribute('data-i18n', action.i18n);
                option.textContent = this._t(action.i18n, action.id);
                select.appendChild(option);
            }
            select.value = PenMap.actionFor(controlId, { profile: profileId, actions: assigned });
            row.appendChild(select);
            container.appendChild(row);
        }

        // The tip is stated, not offered — see js/utils/pen-map.js
        const tipRow = document.createElement('p');
        tipRow.className = 'pref-note';
        tipRow.setAttribute('data-i18n', 'pref.penTipFixed');
        tipRow.textContent = this._t('pref.penTipFixed',
            'The pen tip always draws with the active tool.');
        container.appendChild(tipRow);
    }

    /**
     * The pen check: a box that prints what the browser ACTUALLY reports when
     * each control is pressed against it. It only shows the controls the
     * current profile (and, for generic, the declared shape) claims to have -
     * `setControls()` rebuilds the chip row from the same `PenMap.controlsFor()`
     * list the action rows above it use, plus the tip. A chip for a button the
     * chosen pen does not have would never light and would just read as a
     * broken control instead of a nonexistent one.
     * @private
     * @returns {{setControls: (controlIds: string[]) => void}}
     */
    _initPenCheck(box) {
        if (!box) return { setControls() {} };
        const bits = box.querySelector('.pen-check__bits');
        if (!bits) return { setControls() {} };

        let chips = {};
        const setControls = (controlIds) => {
            bits.textContent = '';
            chips = {};
            for (const controlId of controlIds) {
                const control = Object.keys(PEN_CONTROLS)
                    .map(k => PEN_CONTROLS[k]).find(c => c.id === controlId);
                if (!control) continue;
                const chip = document.createElement('span');
                chip.className = 'pen-check__bit';
                chip.setAttribute('data-i18n', control.i18n);
                chip.textContent = this._t(control.i18n, control.id);
                bits.appendChild(chip);
                chips[control.id] = chip;
            }
        };

        const light = (e) => {
            if (e.pointerType !== 'pen') return;
            const control = PenMap.controlFromEvent(e);
            for (const id of Object.keys(chips)) {
                chips[id].classList.toggle('pen-check__bit--lit', id === control);
                if (id === control) chips[id].classList.add('pen-check__bit--seen');
            }
        };
        const clear = () => {
            for (const id of Object.keys(chips)) {
                chips[id].classList.remove('pen-check__bit--lit');
            }
        };

        box.addEventListener('pointerdown', light);
        box.addEventListener('pointermove', light);
        box.addEventListener('pointerup', clear);
        box.addEventListener('pointerleave', clear);
        // A barrel press is a right-click to the OS: keep the browser's own
        // menu out of the way while the user is testing the button.
        box.addEventListener('contextmenu', (e) => e.preventDefault());

        return { setControls };
    }

    /** @private */
    _save(dialog) {
        const autosaveEl = dialog.querySelector('#pref-autosave-minutes');
        const defaultScreenModeEl = dialog.querySelector('#pref-default-screen-mode');
        const restoreOnBoot = dialog.querySelector('#pref-restore-on-boot');
        const confirmClear = dialog.querySelector('#pref-confirm-clear');
        const resetDrawMode = dialog.querySelector('#pref-reset-draw-mode');
        const nudgeStepEl = dialog.querySelector('#pref-nudge-step');
        const nudgeStep = nudgeStepEl ? clamp(parseInt(nudgeStepEl.value, 10) || 1, 1, 32) : 1;
        const touchDraw = dialog.querySelector('#pref-touch-draw');
        const touchNoDouble = dialog.querySelector('#pref-touch-no-double');
        const touchLockoutEl = dialog.querySelector('#pref-touch-lockout');
        const touchLockout = touchLockoutEl
            ? TouchPolicy.normalizeLockout(touchLockoutEl.value)
            : TOUCH_DEFAULTS.lockoutMs;
        const pressureEnabled = dialog.querySelector('#pref-pressure-sensitivity');
        const pressureStrengthEl = dialog.querySelector('#pref-pressure-strength');
        // 0 is a real, meaningful value (pressure has no effect) so it must
        // survive - unlike nudgeStep's `|| 1` above, NaN is the only fallback case.
        const parsedStrength = pressureStrengthEl ? parseInt(pressureStrengthEl.value, 10) : NaN;
        const pressureStrength = clamp(Number.isNaN(parsedStrength) ? 100 : parsedStrength, 0, 200);

        // Minutes, 0 = off. Clamped rather than rejected: a number field can
        // be typed into, and a silently ignored entry is worse than a capped one.
        if (autosaveEl) {
            StateManager.setAutosaveMinutes(clamp(parseInt(autosaveEl.value, 10) || 0, 0, 60));
        }
        if (defaultScreenModeEl) StateManager.set('defaultScreenMode', defaultScreenModeEl.value);
        if (restoreOnBoot) StateManager.set('restoreOnBoot', restoreOnBoot.checked);
        if (confirmClear) StateManager.set('confirmClear', confirmClear.checked);
        if (resetDrawMode) StateManager.set('resetDrawModeOnTool', resetDrawMode.checked);
        if (nudgeStepEl) StateManager.set('nudgeStep', nudgeStep);
        // The drawing switch has a second home in the status bar, so it goes
        // through InputHandler — the single writer — rather than being set here
        // and left to drift out of step with the button.
        if (touchDraw) InputHandler.setTouchDrawing(touchDraw.checked);
        if (touchNoDouble) StateManager.set('touchBlockWhileContact', touchNoDouble.checked);
        if (touchLockoutEl) StateManager.set('touchLockoutMs', touchLockout);
        // Saving here is always an explicit choice, whichever way the
        // checkbox lands - it must outrank InputHandler's auto-enable-on-
        // first-pen-event for the rest of this session too, not just after
        // the next reload (see _maybeAutoEnablePressure).
        if (pressureEnabled) {
            StateManager.set('pressureSensitivity', pressureEnabled.checked);
            StateManager.set('pressureSensitivityExplicit', true);
        }
        if (pressureStrengthEl) StateManager.set('pressureStrength', pressureStrength);

        // The folder itself was set by its own button (it needs the click as a
        // gesture); only the count is an ordinary field. BackupService owns
        // this one - it is not a StateManager preference.
        const keepEl = dialog.querySelector('#pref-backup-keep');
        if (keepEl) BackupService.setKeepVersions(parseInt(keepEl.value, 10) || 0);

        const pen = this._readPenPreferences(dialog);
        if (pen) {
            StateManager.set('pen.profile', pen.profile);
            StateManager.set('pen.custom', pen.custom);
            StateManager.set('pen.actions', pen.actions);
        }

        Storage.set('preferences', {
            autosaveMinutes: StateManager.getAutosaveMinutes(),
            defaultScreenMode: defaultScreenModeEl?.value,
            restoreOnBoot: restoreOnBoot?.checked,
            confirmClear: confirmClear?.checked,
            // No checkbox of its own — the View menu's Tool Presets toggle
            // is the only control now, and it already writes straight
            // through to StateManager, which is the live truth here.
            showPresetsPanel: StateManager.get('showPresetsPanel') === true,
            resetDrawModeOnTool: resetDrawMode?.checked,
            nudgeStep,
            // touchDrawing is deliberately absent: it persists under its own
            // Storage key because the status-bar toggle writes it outside this
            // dialog, and this whole-object write would clobber that.
            touchBlockWhileContact: touchNoDouble?.checked,
            touchLockoutMs: touchLockout,
            pressureSensitivity: pressureEnabled?.checked,
            pressureStrength,
            penProfile: pen?.profile,
            penCustom: pen?.custom,
            penActions: pen?.actions
        });

        Logger.info('PreferencesDialog', 'Preferences saved');
    }

    /** Settings > Reset All Preferences */
    resetAll() {
        if (confirm(this._t('msg.confirmResetAll', 'Reset all preferences to defaults and reload?'))) {
            if (window.ThemeManager) ThemeManager.setTheme('dark');
            StateManager.setAutosaveMinutes(StateManager.AUTOSAVE_DEFAULT_MINUTES);
            Logger.info('PreferencesDialog', 'All preferences reset');
            // Finish the async deletes before reloading so they aren't cut off
            Promise.allSettled([
                Storage.delete('preferences'),
                Storage.delete('theme'),
                Storage.delete('gridSnap'),
                Storage.delete('touchDrawing'),
                Storage.delete('colorrailCollapsed'),
                Storage.delete('panelCollapse', Storage.STORES.WINDOW_STATE),
                Storage.delete('panelVisibility', Storage.STORES.WINDOW_STATE),
                Storage.delete('panelOrder', Storage.STORES.WINDOW_STATE)
            ]).then(() => location.reload());
        }
    }
}

window.PreferencesDialog = new PreferencesDialogClass();

Logger.debug('PreferencesDialog', 'Preferences dialog loaded');

})(); // End IIFE
