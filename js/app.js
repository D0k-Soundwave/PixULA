'use strict';
(function() {

/**
 * App — pure phase orchestration, zero DOM wiring (docs/REFACTOR_PLAN.md §2).
 *
 * Grows one phase at a time as layers are ported:
 *   Phase 1: Core (Storage, StateManager, EventBus)
 *   Phase 2: Managers (CanvasSystem, LayerManager, ColorManager, UndoRedo)
 *   Phase 3: I/O (FormatRegistry, format handlers, FileManager)
 *   Phase 4: Tools (register tools into ToolManager)
 *   Phase 5: UI components
 *   Phase 6: Input (InputHandler)
 *   Phase 7: Final (events, autosave, initial render)
 *
 * Current port status: phases 1–2 + initial render. Later phases activate
 * as their modules land (see the boot manifest below).
 */

// Boot manifest: every global that must exist after script load, and the
// file that provides it. The assert names the missing file on failure —
// with 40+ dependency-ordered <script> tags and no bundler, a wrong or
// missing tag must fail loudly, not as a random TypeError later.
const BOOT_MANIFEST = [
    ['Logger',           'js/utils/logger.js'],
    ['Helpers',          'js/utils/helpers.js'],
    ['clamp',            'js/utils/helpers.js'],
    ['Validators',       'js/utils/validators.js'],
    ['MaskOps',          'js/utils/mask-ops.js'],
    ['BrushShapes',      'js/utils/brush-shapes.js'],
    ['TouchPolicy',      'js/utils/touch-policy.js'],
    ['PaletteOps',       'js/utils/palette-ops.js'],
    ['Storage',          'js/utils/storage.js'],
    ['BackupService',    'js/services/backup-service.js'],
    ['ProjectFormat',    'js/io/project-format.js'],
    ['FontProbe',        'js/utils/font-probe.js'],
    ['ImageSource',      'js/utils/image-source.js'],
    ['PresetCodec',      'js/utils/preset-codec.js'],
    ['ZX_SPECTRUM',      'js/core/constants.js'],
    ['SCREEN_MODES',     'js/core/constants.js'],
    ['ZX_PALETTE',       'js/core/constants.js'],
    ['EVENTS',           'js/core/constants.js'],
    ['TOOLS',            'js/core/constants.js'],
    ['DRAW_MODE',        'js/core/constants.js'],
    ['EventBus',         'js/core/event-bus.js'],
    ['StateManager',     'js/core/state-manager.js'],
    ['ColorManager',     'js/core/color-manager.js'],
    ['AttributeSystem',  'js/core/attribute-system.js'],
    ['CanvasSystem',     'js/core/canvas-system.js'],
    ['PixelDrawRoutine', 'js/core/pixel-draw-routine.js'],
    ['LayerManager',     'js/core/layer-manager.js'],
    ['InputHandler',     'js/core/input-handler.js'],
    ['PATTERN_BITMAPS',  'js/data/pattern-bitmaps.js'],
    ['UndoRedo',         'js/services/undo-redo.js'],
    ['ScreenModeService', 'js/services/screen-mode-service.js'],
    ['SelectionService', 'js/services/selection-service.js'],
    ['TransformService', 'js/services/transform-service.js'],
    ['PatternService',   'js/services/pattern-service.js'],
    ['ReferenceLayerService', 'js/services/reference-layer-service.js'],
    ['PresetService',    'js/services/preset-service.js'],
    ['FormatRegistry',   'js/io/format-registry.js'],
    ['SCRFormat',        'js/io/scr-format.js'],
    ['MulticolorFormat', 'js/io/multicolor-format.js'],
    ['TimexFormat',      'js/io/timex-format.js'],
    ['GigascreenFormat', 'js/io/gigascreen-format.js'],
    ['CtileFormat',      'js/io/ctile-format.js'],
    ['TAPFormat',        'js/io/tap-format.js'],
    ['TZXFormat',        'js/io/tzx-format.js'],
    ['SNAFormat',        'js/io/sna-format.js'],
    ['PNGFormat',        'js/io/png-format.js'],
    ['JPGFormat',        'js/io/jpg-format.js'],
    ['BMPFormat',        'js/io/bmp-format.js'],
    ['DevFormat',        'js/io/dev-format.js'],
    ['PresetFormat',     'js/io/preset-format.js'],
    ['FileManager',      'js/io/file-manager.js'],
    ['ToolBase',         'js/tools/tool-base.js'],
    ['ToolManager',      'js/tools/tool-manager.js'],
    ['BrushEngine',      'js/tools/brush-engine.js'],
    ['ShapeGenerator',   'js/tools/shape-generator.js'],
    ['BrushTool',        'js/tools/brush-tool.js'],
    ['BezierTool',       'js/tools/bezier-tool.js'],
    ['EraserTool',       'js/tools/eraser-tool.js'],
    ['FillTool',         'js/tools/fill-tool.js'],
    ['ShapeTool',        'js/tools/shape-tool.js'],
    ['EyedropperTool',   'js/tools/eyedropper-tool.js'],
    ['SelectionTool',    'js/tools/selection-tool.js'],
    ['GradientTool',     'js/tools/gradient-tool.js'],
    ['TextTool',         'js/tools/text-tool.js'],
    ['MoveTool',         'js/tools/move-tool.js'],
    ['ZoomTool',         'js/tools/zoom-tool.js'],
    ['PatternCreatorTool', 'js/tools/pattern-creator-tool.js'],
    ['PanelSection',     'js/ui/components/panel-section.js'],
    ['Dialog',           'js/ui/components/dialog.js'],
    ['ImportDialog',     'js/ui/components/import-dialog.js'],
    ['PaletteEditorDialog', 'js/ui/components/palette-editor-dialog.js'],
    ['PresetDialog',     'js/ui/components/preset-dialog.js'],
    ['A11yAnnouncer',    'js/ui/components/a11y-announcer.js'],
    ['Tooltip',          'js/ui/tooltip-manager.js'],
    ['CanvasContextMenu', 'js/ui/canvas-context-menu.js'],
    ['GridOverlay',      'js/ui/grid-overlay.js'],
    ['PatternPanel',     'js/ui/pattern-panel.js'],
    ['PatternCreatorPanel', 'js/ui/pattern-creator-panel.js'],
    ['OptionControls',   'js/ui/components/option-controls.js'],
    ['PresetControls',   'js/ui/components/preset-controls.js'],
    ['ToolPresetBar',    'js/ui/components/tool-preset-bar.js'],
    ['ToolPresetPanel',  'js/ui/components/tool-preset-panel.js'],
    ['ToolPresetDialog', 'js/ui/components/tool-preset-dialog.js'],
    ['ToolRail',         'js/ui/components/tool-rail.js'],
    ['ClutBar',          'js/ui/components/clut-bar.js'],
    ['DrawModeBar',      'js/ui/components/draw-mode-bar.js'],
    ['ColorBarFit',      'js/ui/components/colorbar-fit.js'],
    ['TouchModeStatus',  'js/ui/components/touch-mode-status.js'],
    ['LayerPanel',       'js/ui/components/layer-panel.js'],
    ['TransformPanel',   'js/ui/components/transform-panel.js'],
    ['AppSettings',      'js/ui/components/app-settings.js'],
    ['CanvasControls',   'js/ui/components/canvas-controls.js'],
    ['BorderControl',    'js/ui/border-control.js'],
    ['ReferenceLayerPanel', 'js/ui/reference-layer-panel.js'],
    ['ThemeManager',     'js/ui/theme-manager.js'],
    ['MenuSystem',       'js/ui/menu-system.js'],
    ['I18n',             'js/i18n/i18n-manager.js']
];

class AppClass {

    async init() {
        try {
            this._assertBootManifest();

            await this._initCore();      // Phase 1
            await this._initManagers();  // Phase 2
            await this._initIO();        // Phase 3
            this._initTools();           // Phase 4
            await this._initUI();        // Phase 5
            this._initInput();           // Phase 6
            await this._initFinal();     // Phase 7

            Logger.info('App', 'Initialized');
            // Boot beacon for the browser test harness (tests/browser/):
            // waitForSelector('html[data-app-ready]') is the "fully booted" gate.
            document.documentElement.dataset.appReady = '1';
        } catch (error) {
            Logger.error('App', 'Initialization failed', error);
            throw error;
        }
    }

    _assertBootManifest() {
        const missing = BOOT_MANIFEST.filter(([name]) => window[name] === undefined);
        if (missing.length) {
            throw new Error(
                'Boot manifest check failed — missing global(s): ' +
                missing.map(([name, file]) => `${name} (${file})`).join(', ') +
                '. Check the <script> tags in index.html (order and presence).'
            );
        }
    }

    /** Phase 1: core systems (no dependencies) */
    async _initCore() {
        await Storage.initialize();

        // Default state values; autosave restore (Phase 7) overrides later.
        StateManager.setZoom(200);
        StateManager.set('gridEnabled', true);
        StateManager.setCurrentTool(TOOLS.BRUSH);
        StateManager.set('ink', 0);
        StateManager.set('paper', 7);
        StateManager.set('bright', false);
        StateManager.set('flash', false);
        StateManager.set('showPresetsPanel', false);

        // Seed persisted preferences into state (the Preferences dialog
        // saves them as one object; absent keys keep their defaults).
        try {
            const prefs = await Storage.get('preferences');
            if (prefs && typeof prefs === 'object') {
                // Autosave cadence. `autosaveMinutes` is the live preference;
                // `autosave` is the boolean this replaced on 2026-08-07, still
                // read so an existing "autosave: false" arrives as 0 minutes
                // rather than silently switching itself back on.
                if (typeof prefs.autosaveMinutes === 'number') {
                    StateManager.setAutosaveMinutes(prefs.autosaveMinutes);
                } else if (prefs.autosave === false) {
                    StateManager.setAutosaveMinutes(0);
                }
                if (typeof prefs.defaultScreenMode === 'string') StateManager.set('defaultScreenMode', prefs.defaultScreenMode);
                if (typeof prefs.restoreOnBoot === 'boolean') StateManager.set('restoreOnBoot', prefs.restoreOnBoot);
                if (typeof prefs.confirmClear === 'boolean') StateManager.set('confirmClear', prefs.confirmClear);
                if (typeof prefs.resetDrawModeOnTool === 'boolean') StateManager.set('resetDrawModeOnTool', prefs.resetDrawModeOnTool);
                if (typeof prefs.nudgeStep === 'number') StateManager.set('nudgeStep', prefs.nudgeStep);
                if (typeof prefs.showPresetsPanel === 'boolean') StateManager.set('showPresetsPanel', prefs.showPresetsPanel);
                // Touch admission, layers 1 and 2 (js/utils/touch-policy.js).
                // Layer 3, the drawing switch, has its own key below — it is
                // toggled from the status bar, outside this record.
                if (typeof prefs.touchBlockWhileContact === 'boolean') {
                    StateManager.set('touchBlockWhileContact', prefs.touchBlockWhileContact);
                }
                if (typeof prefs.touchLockoutMs === 'number') {
                    StateManager.set('touchLockoutMs', TouchPolicy.normalizeLockout(prefs.touchLockoutMs));
                }
                // Pressure sensitivity (Preferences > Pen). Absent means nobody
                // has ever saved a choice, so InputHandler auto-enables it the
                // first time a pen shows up this session (see
                // _maybeAutoEnablePressure); a present boolean is an explicit
                // choice from a past session and must outrank that auto-detect.
                if (typeof prefs.pressureSensitivity === 'boolean') {
                    StateManager.set('pressureSensitivity', prefs.pressureSensitivity);
                    StateManager.set('pressureSensitivityExplicit', true);
                }
                if (typeof prefs.pressureStrength === 'number') {
                    StateManager.set('pressureStrength', prefs.pressureStrength);
                }
                // `touchPanOnly` was the single off-by-default checkbox this
                // replaced on 2026-08-10. Read once, never written again, so
                // anyone who had turned it on keeps the behaviour they chose.
                if (prefs.touchPanOnly === true) StateManager.set('touchDrawing', false);
                // Pen button assignments (Preferences > Pen). Absent keys leave
                // PEN_DEFAULT_ACTIONS in charge, so a pen behaves as it always
                // has until its owner says otherwise.
                if (typeof prefs.penProfile === 'string') StateManager.set('pen.profile', prefs.penProfile);
                if (prefs.penCustom && typeof prefs.penCustom === 'object') StateManager.set('pen.custom', prefs.penCustom);
                if (prefs.penActions && typeof prefs.penActions === 'object') StateManager.set('pen.actions', prefs.penActions);
            }
            // Grid snap persists under its own key (toggled outside the dialog)
            const snap = await Storage.get('gridSnap');
            if (typeof snap === 'boolean') StateManager.setGridSnap(snap);
            // Symmetry mode too (Phase 8 mirror-while-drawing)
            const sym = await Storage.get('symmetryMode');
            if (typeof sym === 'string') StateManager.setSymmetryMode(sym);
            // Drawing guide (selection confines/protects every tool's marks)
            const clip = await Storage.get('clipMode');
            if (typeof clip === 'string') StateManager.setClipMode(clip);
            // Global draw mode (top-bar selector)
            const dm = await Storage.get('drawMode', Storage.STORES.PREFERENCES);
            if (typeof dm === 'string') StateManager.setDrawMode(dm);
            // The touch drawing switch, its own key for the same reason as grid
            // snap: the status-bar toggle writes it outside the dialog, which
            // saves `preferences` as one whole object. Last, so an explicit
            // choice outranks the migrated touchPanOnly above.
            const touchDraw = await Storage.get('touchDrawing');
            if (typeof touchDraw === 'boolean') StateManager.set('touchDrawing', touchDraw);
        } catch (error) {
            Logger.warn('App', 'Could not read preferences', error);
        }
    }

    /** Phase 2: managers + services (depend on core; CanvasSystem waits for the iframe) */
    async _initManagers() {
        await CanvasSystem.initialize();
        LayerManager.initialize();
        ColorManager.initialize();
        UndoRedo.initialize();
        ReferenceLayerService.initialize(); // defers its work to CanvasSystem.onReady
    }

    /** Phase 3: I/O (FileManager initializes the registry and every format handler) */
    async _initIO() {
        FileManager.initialize();
        await PatternService.initialize();
        // Persistent internal clipboard (Phase 9): restore before the UI's
        // first render so Edit > Paste enable-state is right from boot
        await SelectionService.restorePersistedClipboard();
        // Persistent tileset + map (Phase 11): restored before the UI so the
        // map editor opens onto the user's working map
        await MapService.restorePersisted();
        // Persistent working font + named-font library (Phase 10): the
        // library cache must be warm before the text tool rasterizes
        await FontService.restorePersisted();
        // The user's own named setups: restored before the UI so both preset
        // lists are populated on their first render rather than after it
        await PresetService.restorePersisted();
        await PresetService.restoreToolPresets();
    }

    /** Phase 4: register the tools; shape and brush-type variants ride on
     *  ShapeTool / BrushTool respectively (ToolManager._shapeVariants,
     *  ._brushVariants), so they are rail buttons without their own classes. */
    _initTools() {
        ToolManager.register(new BrushTool());
        ToolManager.register(new EraserTool());
        ToolManager.register(new FillTool());
        ToolManager.register(new ShapeTool());
        ToolManager.register(new BezierTool());
        ToolManager.register(new EyedropperTool());
        ToolManager.register(new SelectionTool());
        ToolManager.register(new GradientTool());
        ToolManager.register(new TextTool());
        ToolManager.register(new MoveTool());
        ToolManager.register(new ZoomTool());
        ToolManager.register(new PatternCreatorTool());

        ToolManager.initialize(TOOLS.BRUSH);
    }

    /** Phase 5: UI shell — every component renders from bus events;
     *  commands go down as direct singleton calls. */
    async _initUI() {
        // Locale + theme first, so every component below builds already
        // translated/themed (they read I18n.t and the CSS tokens at build).
        // Both boot from the Storage keys the interim AppSettings paths
        // persisted under ('locale' / 'theme'), so earlier choices carry over.
        await I18n.init();
        await ThemeManager.init();

        // Header
        MenuSystem.init('menu-bar');
        AppSettings.init();

        // Colour rail + top strip (ClutBar builds #toolbar-color, now inside
        // #color-rail, before BorderControl appends #border-host inside
        // #color-bar) + left rail tools
        ClutBar.init();
        ColorRailToggle.init(); // async (Storage) — restores a persisted collapse, fire-and-forget like PanelSection.restore()
        BorderControl.initialize();
        DrawModeBar.init();
        ColorBarFit.init(); // after the bar's own content exists, before anything measures it
        TouchModeStatus.init();
        ToolRail.init();

        // Canvas chrome + overlays
        GridOverlay.init();
        CanvasControls.init();

        // Right sidebar — creation order IS the visual/AT order:
        // Reference -> Layers -> Tool Options -> Transform -> Presets. Reference
        // leads because it is set up once at the start of a picture; Tool Options
        // sits right under Layers because it changes with every tool selection;
        // Transform is mostly stamp-contextual. Presets is last and only shown
        // when the "Show Presets panel" preference (Preferences > General) is
        // on — see ToolPresetPanel's own display toggle. All panels scroll
        // together inside #panels (no sticky sections — see layout.css).
        ReferenceLayerPanel.initialize();
        LayerPanel.init();
        OptionControls.init();
        ToolPresetBar.init();  // save/load row at the foot of the tool options
        PatternPanel.init();   // dedicated Patterns panel (shown only for the brush's pattern type)
        TransformPanel.init();
        ToolPresetPanel.init(); // the Presets panel, last and preference-gated
        PanelSection.restore(); // persisted collapse states (async)

        // Cross-cutting helpers
        A11yAnnouncer.init();
        Tooltip.init();
    }

    /** Phase 6: universal input — pointer capture, coalesced events,
     *  pointer-type routing, gestures, keyboard map (REFACTOR_PLAN §3). */
    _initInput() {
        InputHandler.init();
    }

    /** Phase 7: final setup — error surfacing, autosave, unload warning,
     *  initial render. Autosave restore runs after the fit-zoom so a
     *  restored zoom wins. */
    async _initFinal() {
        // Surface file load/save/export errors to the user
        EventBus.on(EVENTS.FILE_ERROR, (data) => {
            alert(data.message);
        });

        // Start at the largest clean 100% zoom that fits the frame here.
        CanvasSystem.setZoom(CanvasControls.fitZoom());

        await this._checkAutosave();
        // Before the timer: restoring the folder handle decides whether the
        // first tick can write to disk or has to ask for permission back.
        await BackupService.initialize();
        this._setupAutosave();
        this._setupUnloadWarning();

        LayerManager.composeToCanvas();
        CanvasSystem.requestRender();
    }

    /**
     * Offer to restore autosaved work from a previous session (< 24h old).
     *
     * `restoreOnBoot` (Preferences > General, default on) gates the OFFER
     * only, not the writing — autosave keeps running on its own interval
     * either way, as crash protection within the current session. With it
     * off, any leftover record from a previous session is discarded here
     * rather than left to linger unreachable: someone who wants every
     * session to start blank should not find their last drawing still
     * sitting in storage the day they turn this back on.
     */
    async _checkAutosave() {
        try {
            const autosaveData = await Storage.get('autosave');
            if (!autosaveData || !autosaveData.timestamp) return;

            if (StateManager.get('restoreOnBoot') === false) {
                await Storage.delete('autosave');
                Logger.debug('App', 'Autosave restore offer skipped (restoreOnBoot off)');
                return;
            }

            const ageMs = Date.now() - autosaveData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000;
            if (ageMs > maxAge) {
                Logger.debug('App', 'Autosave data too old, ignoring');
                await Storage.delete('autosave');
                return;
            }

            const ageMinutes = Math.floor(ageMs / 60000);
            let ageText;
            if (ageMinutes < 60) {
                ageText = ageMinutes === 1
                    ? I18n.t('msg.minuteAgo', { n: ageMinutes })
                    : I18n.t('msg.minutesAgo', { n: ageMinutes });
            } else {
                const ageHours = Math.floor(ageMinutes / 60);
                ageText = ageHours === 1
                    ? I18n.t('msg.hourAgo', { n: ageHours })
                    : I18n.t('msg.hoursAgo', { n: ageHours });
            }

            if (confirm(I18n.t('msg.autosaveFound', { age: ageText }))) {
                await this._loadProjectData(autosaveData);
                Logger.info('App', 'Autosave restored');
            } else {
                // User declined, clear the stale autosave
                await Storage.delete('autosave');
            }
        } catch (error) {
            Logger.warn('App', 'Failed to check autosave', error);
        }
    }

    /**
     * Autosave on the cadence the artist chose (Preferences, in minutes).
     *
     * Re-arms whenever that preference changes rather than only at boot: the
     * interval decides how much work a crash can destroy, so someone who has
     * just raised it after losing some expects the new number to apply now,
     * not next session.
     *
     * Zero means off, and off means NO TIMER - not a timer that wakes up and
     * returns. A polling loop nobody asked for is still a polling loop.
     */
    _setupAutosave() {
        this._armAutosave();
        EventBus.on(EVENTS.AUTOSAVE_INTERVAL_CHANGED, () => this._armAutosave());
    }

    /** @private */
    _armAutosave() {
        // Always leave the field DEFINED, even on the first call with autosave
        // already off: "no timer" reads as null, and a property that is simply
        // absent makes "is it running?" unanswerable from outside.
        if (this._autosaveInterval) clearInterval(this._autosaveInterval);
        this._autosaveInterval = null;

        const minutes = StateManager.getAutosaveMinutes();
        if (minutes <= 0) {
            Logger.info('App', 'Autosave disabled');
            return;
        }

        const MS_PER_MINUTE = 60000;
        this._autosaveInterval = setInterval(async () => {
            if (!FileManager.hasChanges()) return;
            const project = this._getProjectData();

            // The database record FIRST and on its own try: it is the crash
            // recovery, and it must not be lost to a folder that went away.
            try {
                await Storage.set('autosave', project);
                Logger.debug('App', 'Autosaved');
            } catch (error) {
                Logger.error('App', 'Autosave failed', error);
            }

            // Versioned copies on disk are additive - better artefacts, but
            // allowed to fail. BackupService announces its own failures.
            if (window.BackupService && BackupService.isActive) {
                await BackupService.writeVersion(project, this._backupBaseName());
            }
        }, minutes * MS_PER_MINUTE);
        Logger.info('App', `Autosave every ${minutes} minute(s)`);
    }

    /** Warn before leaving with unsaved changes. */
    _setupUnloadWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (FileManager.hasChanges()) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
    }

    /**
     * The name versioned backups are filed under.
     *
     * The document's own filename where it has one, so the trail sits next to
     * the picture it belongs to; otherwise a fixed 'Untitled', which means an
     * unnamed session keeps ONE numbered sequence rather than starting a fresh
     * one on every reload.
     * @private
     */
    _backupBaseName() {
        return (window.FileManager && FileManager.currentFilename) || 'Untitled';
    }

    /**
     * Snapshot the document for autosave / `.pixula`.
     *
     * `slices` is the SAME six `PresetServiceClass.SLICES` a workspace preset
     * captures - tool, colour, drawing modifiers, pattern, reference image +
     * placement, view - reusing their capture() rather than a second,
     * bespoke set of fields that could drift from what presets already do.
     * The reference image is embedded (not the preset-sized thumbnail: see
     * ProjectFormat's doc comment for the full reasoning), and its
     * FileSystemFileHandle is dropped unconditionally - it cannot survive
     * JSON regardless, the same reason PresetCodec.encodeFile drops it for a
     * shared `.zxpreset`.
     * @private
     */
    _getProjectData() {
        // embedReferenceAsset keeps the image inline on slices.reference.
        // assetData rather than lifted into a separate returned `asset` -
        // there is no content-addressed store to lift it into here.
        const { slices } = PresetService.capture(ProjectFormat.SLICE_IDS, {
            referenceMaxPx: ProjectFormat.REFERENCE_IMAGE_MAX_PX,
            referenceQuality: ProjectFormat.REFERENCE_IMAGE_QUALITY,
            embedReferenceAsset: true
        });
        if (slices.reference && slices.reference.assetData) {
            // Never the handle - it cannot survive JSON regardless of policy.
            slices.reference.assetData.handle = null;
        }

        return {
            version: 2,
            timestamp: Date.now(),
            screenMode: ScreenModeService.getModeId(),
            ulaplusRegisters: ColorManager.ulaplusRegisters
                ? Array.from(ColorManager.ulaplusRegisters) : null,
            nextRegisters: ColorManager.nextRegisters
                ? Array.from(ColorManager.nextRegisters) : null,
            timexHiresInk: ColorManager.getTimexHiresInk(),
            layers: LayerManager.getAllLayers(),
            slices
        };
    }

    /**
     * Restore an autosave snapshot / opened `.pixula` over the boot defaults.
     *
     * `data.slices` is the current shape (version 2+); `data.state` is read
     * as a fallback so a file saved before this change still restores its
     * narrower tool/colour/zoom set rather than nothing at all - `slices`
     * always wins where both are present, since it is a strict superset.
     * @private
     */
    async _loadProjectData(data) {
        // Mode first (raw — the layer data below already matches its
        // geometry), then the ULAplus palette it may reference.
        if (data.screenMode && data.screenMode !== ScreenModeService.getModeId()) {
            ScreenModeService.applyModeRaw(data.screenMode);
        }
        if (data.ulaplusRegisters) {
            ColorManager.setUlaplusRegisters(data.ulaplusRegisters);
        }
        if (data.nextRegisters) {
            ColorManager.setNextRegisters(data.nextRegisters);
        }
        if (data.timexHiresInk !== undefined && data.timexHiresInk !== null) {
            ColorManager.setTimexHiresInk(data.timexHiresInk);
        }

        if (data.layers) {
            LayerManager.restoreFromData(data.layers);
            // restoreFromData replaces the stack silently; announce it so
            // the layer panel re-renders (same fact menu-system emits).
            EventBus.emit(EVENTS.LAYER_ORDER);
        }

        if (data.slices) {
            await PresetService.applyCapturedSlices(data.slices);
        } else if (data.state) {
            // Pre-2026-08-23 file/autosave shape.
            if (data.state.tool) ToolManager.selectTool(data.state.tool);
            // Through ColorManager so the colour bar and the drawing gate both
            // see the restored selection (see _getProjectData above).
            if (data.state.ink !== undefined) ColorManager.setInk(data.state.ink);
            if (data.state.paper !== undefined) ColorManager.setPaper(data.state.paper);
            if (data.state.bright !== undefined) ColorManager.setBright(data.state.bright);
            if (data.state.flash !== undefined) ColorManager.setFlash(data.state.flash);
            if (data.state.border !== undefined) ColorManager.setBorder(data.state.border);
            if (data.state.zoom) CanvasSystem.setZoom(data.state.zoom);
        }

        // The restored document is still unsaved work
        FileManager.markModified();
        LayerManager.composeToCanvas();
    }
}

window.App = new AppClass();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.App.init());
} else {
    window.App.init();
}

})();
