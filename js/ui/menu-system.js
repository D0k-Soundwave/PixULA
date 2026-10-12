'use strict';
(function() {

/**
 * Every picture-export format File > Save Image As offers — the single
 * source both the menu build (below) and its enabled/disabled state
 * (`_updateExportAsMenuState`) read, filtered live through
 * FormatRegistry.isExportCompatible() (mode-dependent).
 *
 * This is the ONLY save-format surface in the app (2026-08-28): the earlier
 * File > Save.../Ctrl+E action (`FileManager.exportViaNativePicker()` on
 * engines with a native Save picker, `_showExportDialog()`'s dropdown as
 * the Firefox/Safari fallback) was withdrawn in favour of one menu that
 * looks and behaves the same on every browser — Save Image As already did,
 * since its per-format leaves go through the same native-picker-or-download
 * branch inside `Helpers.downloadFile()` regardless of engine.
 *
 * GIF export was withdrawn from the UI 2026-08-25 (menu only — the encoder
 * in js/io/gif-format.js, its tests and its animate-FLASH option stay
 * exactly as they were, simply unreached from anywhere in the app).
 */
const EXPORT_FORMATS = Object.freeze([
    ['scr',   'ZX Spectrum Screen (.scr)'],
    ['zxp',   'ZX-Paintbrush Image (.zxp)'],
    ['mlt',   'Timex/Multicolor Screen 8\u00d71 (.mlt)'],
    ['ifl',   'Multicolor Screen 8\u00d72 (.ifl)'],
    ['hrg',   'Timex Hi-res Screen (.hrg)'],
    ['img',   'GigaScreen Image (.img)'],
    ['mg8',   'MultiArtist 8×8 Image (.mg8)'],
    ['mg4',   'MultiArtist 8×4 Image (.mg4)'],
    ['mg2',   'MultiArtist 8×2 Image (.mg2)'],
    ['mg1',   'MultiArtist 8×1 Image (.mg1)'],
    ['nxi',   'Next Layer 2 Image (.nxi)'],
    ['sl2',   'Next Layer 2 Dump (.sl2)'],
    ['slr',   'Next LoRes Dump (.slr)'],
    ['ctile', 'BIFROST ColorTiles (.ctile)'],
    ['tap',   'ZX Spectrum Tape (.tap)'],
    ['tzx',   'ZX Spectrum Tape TZX (.tzx)'],
    ['png',   'PNG Image (.png)'],
    ['bmp',   'BMP Image (.bmp)'],
    ['jpg',   'JPEG Image (.jpg)'],
    ['zed',   'ZX-Editor document (.zed)'],
    ['sev',   'SevenuP graphic (.sev)'],
    ['pal',   'Palette (.pal)'],
    ['npl',   'Next Palette (.npl)'],
    ['asm',   'Assembly source (.asm)'],
    ['c',     'C array source (.c)'],
    ['bin',   'Raw bitmap only (.bin)'],
    ['atr',   'Attributes only (.atr)']
]);

/**
 * MenuSystem - Application menu bar
 * Provides File, Edit, View, Layer, Image, Settings and Help menus.
 *
 * Ported from H:\smsh and conformed: modal dialogs use the Dialog component
 * (floating windows retired), panel toggles go through PanelSection, zoom
 * actions through CanvasControls, and everything renders with data-i18n
 * attributes + English fallbacks until i18n lands (Phase 6).
 */
class MenuSystemClass {
    constructor() {
        this.element = null;
        this.activeMenu = null;
        this._initialized = false;
        this._menuOpen = false;

        this._boundDocClickHandler = null;
        this._boundDocKeydownHandler = null;

        // PanelSection section id -> View-menu checkbox item id, read by the
        // EVENTS.PANEL_VISIBILITY_CHANGED listener below. Patterns is not
        // here: its section visibility is automatic (pattern-brush context),
        // not a menu-reachable toggle. Presets IS here even though its
        // whole-panel visibility is driven by the showPresetsPanel
        // preference rather than a direct view:togglePresets action — it
        // still reaches the DOM through PanelSection.setVisible() (see
        // ToolPresetPanel._syncVisibility()), which fires this same event,
        // so one listener keeps every panel's checkbox honest regardless of
        // what triggered the change.
        this._PANEL_MENU_ITEM_BY_SECTION = {
            'reference-panel':    'panel-reference',
            'tool-options-panel': 'panel-tools',
            'layer-panel':        'panel-layers',
            'transform-panel':    'panel-transform',
            'preview-panel':      'panel-preview',
            'tool-preset-panel':  'panel-presets'
        };
    }

    /** English fallback until i18n lands (Phase 6). @private */
    /**
     * Translate, with an English fallback and optional parameters.
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

    /**
     * Initialize the menu system
     * @param {string} containerId - ID of the menu container element
     */
    init(containerId = 'menu-bar') {
        if (this._initialized) return;

        this.element = document.getElementById(containerId);
        if (!this.element) {
            Logger.error('MenuSystem', `#${containerId} not found`);
            return;
        }

        this._buildMenus();
        this._attachEvents();
        this._initialized = true;

        if (window.ThemeManager) {
            this._updateThemeToggles(ThemeManager.getTheme());
        }
        this._updateModeToggles();
        this._updateExportAsMenuState();
        this._updateExportSelectionMenuState();
        this._updateMirrorToggles();
        if (window.StateManager) this._updateToggleState('grid-snap', StateManager.getGridSnap());
        this._updateDisplayViewMenuState();

        Logger.info('MenuSystem', 'Initialized');
    }

    /**
     * Switch the document's screen mode from any UI entry point (Image menu,
     * status-bar selector). Warns first when the conversion is lossy — the
     * switch itself is one undoable action either way.
     * @param {string} modeId - SCREEN_MODES id
     * @returns {boolean} True if the mode changed
     */
    requestScreenMode(modeId) {
        if (!window.ScreenModeService) return false;
        if (modeId === ScreenModeService.getModeId()) return false;
        if (ScreenModeService.isConversionLossy(ScreenModeService.getModeId(), modeId)) {
            const ok = confirm(this._t('mode.lossyConfirm',
                'This conversion reduces colour detail and cannot keep every attribute. ' +
                'You can undo it. Continue?'));
            if (!ok) {
                // Selector UIs may have optimistically moved — snap them back
                EventBus.emit(EVENTS.SCREEN_MODE_CHANGED, {
                    mode: ScreenModeService.getModeId(),
                    previous: ScreenModeService.getModeId()
                });
                return false;
            }
        }
        return ScreenModeService.switchMode(modeId);
    }

    /** Sync the Image-menu mode radio checkmarks to the active mode. @private */
    _updateModeToggles() {
        if (!window.ScreenModeService) return;
        const active = ScreenModeService.getModeId();
        for (const mode of ScreenModeService.getModes()) {
            this._updateToggleState(`mode-${mode.id}`, mode.id === active);
        }
    }

    /**
     * The View > Colours Off / Stop Flashing / Colour Grid rows: checked from
     * the stored choice, and greyed out (with the reason as a tooltip) in the
     * screen modes where the switch cannot apply. A choice stays stored while
     * its row is greyed out; it applies again in a mode that supports it.
     * @private
     */
    _updateDisplayViewMenuState() {
        if (!window.StateManager || !window.LayerManager || !this.element) return;
        const v = StateManager.getDisplayView();
        this._updateToggleState('colours-off', v.coloursOff);
        this._updateToggleState('stop-flashing', v.stopFlashing);
        this._updateToggleState('colour-grid', v.colourGrid);
        const can = LayerManager.displayViewAvailability();
        const noDots = ['view.display.noDots', 'Every pixel has its own colour in this screen mode, so there are no dots to show.'];
        const noCells = ['view.display.noCells', 'This screen mode has no colour cells.'];
        const noFlash = ['view.display.noFlash', 'Nothing flashes in this screen mode.'];
        const rows = [
            ['colours-off', can.coloursOff, noDots],
            ['colour-grid', can.colourGrid, can.indexed ? noDots : noCells],
            ['stop-flashing', can.stopFlashing, noFlash]
        ];
        for (const [id, enabled, reason] of rows) {
            this.setItemEnabled(id, enabled);
            const item = this.element.querySelector(`[data-id="${id}"]`);
            if (!item) continue;
            if (enabled) item.removeAttribute('title');
            else item.title = this._t(reason[0], reason[1]);
        }
    }

    /**
     * Grey out the Image > Attributes rows the current mode, stamp or locked
     * layer blocks. The reason goes on the Attributes row tooltip: a disabled
     * row takes no pointer events, so a tooltip on it would never show.
     * @private
     */
    _updateAttributeMenuState() {
        if (!window.TransformService) return;
        const blocked = TransformService.attributeCommandsBlocked();
        for (const id of ['attr-invert', 'attr-erase', 'attr-flip-h', 'attr-flip-v', 'attr-change']) {
            this.setItemEnabled(id, !blocked);
        }
        const parent = this.element.querySelector('[data-id="attributes"]');
        if (parent) {
            const reasons = {
                noCellAttributes: ['menu.image.attrNoCells', 'This screen mode has no cell colours.'],
                stamp: ['menu.image.attrStamp', 'Finish or cancel the stamp first.'],
                locked: ['menu.image.attrLocked', 'This layer is locked.']
            };
            const r = reasons[blocked];
            if (r) parent.title = this._t(r[0], r[1]);
            else parent.removeAttribute('title');
        }
    }

    /**
     * Image > Palette: tick the slot in use, grey the rows out where the mode has a fixed palette
     * (slots) or no ULAplus palette (the inverter). The reason goes on the Palette row tooltip: a
     * disabled row takes no pointer events, so a tooltip on it would never show.
     * @private
     */
    _updatePaletteMenuState() {
        if (!window.TransformService || !window.ColorManager) return;
        const b = TransformService.paletteCommandsBlocked();
        const active = ColorManager.getPaletteSlot();
        for (let i = 0; i < 4; i++) {
            this.setItemEnabled(`palette-slot-${i + 1}`, !b.slots);
            this._updateToggleState(`palette-slot-${i + 1}`, !b.slots && i === active);
        }
        this.setItemEnabled('palette-invert', !b.invert);
        // File > Save Palette as TAP: a ULAplus palette only. A disabled row takes no pointer
        // events, but the row title is still read by assistive technology and the status line.
        const tapOk = ColorManager.paletteSlotKind() === 'ulaplus64';
        this.setItemEnabled('save-palette-tap', tapOk);
        const tapRow = this.element.querySelector('[data-id="save-palette-tap"]');
        if (tapRow) {
            if (tapOk) tapRow.removeAttribute('title');
            else tapRow.title = this._t('mode.paletteTapNeedsUlaplus', 'The palette tape is for the ULAplus modes.');
        }
        const parent = this.element.querySelector('[data-id="palette-slots"]');
        if (!parent) return;
        const reason = b.slots ? ['menu.image.paletteFixed', 'This screen mode has fixed colours, so it has no palette slots.']
            : (b.invert === 'nextPalette'
                ? ['menu.image.invertPaletteNext', 'The palette inverter is for ULAplus palettes; the Next modes keep ink and paper in different parts of the palette.']
                : null);
        if (reason) parent.title = this._t(reason[0], reason[1]);
        else parent.removeAttribute('title');
    }

    /**
     * Grey out the Image > Dots rows the current state blocks (TransformService
     * dotCommandsBlocked). The reasons go on the Dots row tooltip; a disabled
     * row takes no pointer events, so the tooltip would never show on a row.
     * @private
     */
    _updateDotMenuState() {
        if (!window.TransformService) return;
        const b = TransformService.dotCommandsBlocked();
        this.setItemEnabled('dots-flip-h', !b.flip);
        this.setItemEnabled('dots-flip-v', !b.flip);
        this.setItemEnabled('dots-invert', !b.invert);
        // Image > Flip / Rotate / Invert Colors act on the picture, or on a floating stamp; a
        // stamp that carries its own cell colours cannot be reshaped, and a stamp layer is not
        // the picture. Greyed out with the reason as a tooltip (the rows are pointer-reachable).
        const stampBlock = (b.flip === 'stampAttrs' || b.flip === 'stamp') ? b.flip : null;
        const stampReasons = {
            stampAttrs: ['menu.image.dotsStampAttrs', 'This stamp keeps its own colours, so it cannot be flipped here.'],
            stamp: ['menu.image.attrStamp', 'Finish or cancel the stamp first.']
        };
        for (const id of ['flip-h', 'flip-v', 'rotate-90cw', 'rotate-90ccw', 'rotate-180', 'invert']) {
            this.setItemEnabled(id, !stampBlock);
            const row = this.element.querySelector(`[data-id="${id}"]`);
            if (!row) continue;
            if (stampBlock) row.title = this._t(stampReasons[stampBlock][0], stampReasons[stampBlock][1]);
            else row.removeAttribute('title');
        }
        const parent = this.element.querySelector('[data-id="dots"]');
        if (!parent) return;
        const reasons = {
            locked: ['menu.image.attrLocked', 'This layer is locked.'],
            stamp: ['menu.image.attrStamp', 'Finish or cancel the stamp first.'],
            stampAttrs: ['menu.image.dotsStampAttrs', 'This stamp keeps its own colours, so it cannot be flipped here.'],
            noCellAttributes: ['menu.image.dotsNoCells', 'Invert Dots and Colours needs cell colours, which this screen mode does not have.'],
            palette: ['menu.image.dotsPalette', 'Invert Dots and Colours needs the fixed 16 colours: in ULAplus and ULANext, swapping ink and paper would change how the picture looks.']
        };
        const texts = [b.flip, b.invert]
            .filter((r, i, all) => r && all.indexOf(r) === i)
            .map((r) => this._t(reasons[r][0], reasons[r][1]));
        if (texts.length) parent.title = texts.join(' ');
        else parent.removeAttribute('title');
    }

    /**
     * Disable each Save Image As leaf the active screen mode can't actually
     * export (e.g. nxi/sl2 need an indexed mode) — applied as
     * enabled/disabled rather than "listed at all", since a static menu tree
     * can't be rebuilt per mode.
     * @private
     */
    _updateExportAsMenuState() {
        if (!window.FormatRegistry) return;
        for (const [ext] of EXPORT_FORMATS) {
            this.setItemEnabled('export-as-' + ext, FormatRegistry.isExportCompatible(ext));
        }
    }

    /**
     * Save Selection As: open each format whose rule lets the selection through, and say why the shut ones are shut.
     * @private
     */
    _updateExportSelectionMenuState() {
        if (!window.FormatRegistry || !window.FileManager) return;
        const rect = FileManager.selectionRect();
        const reasons = {
            none: ['export.sel.none', 'Select part of the picture first.'],
            mode: ['export.sel.mode', 'This screen mode cannot be saved in this format.'],
            layout: ['export.sel.layout', 'This screen mode cannot save a part in this format.'],
            screenOnly: ['export.sel.screenOnly', 'This format saves a whole screen: select all of it first.']
        };
        for (const [ext] of EXPORT_FORMATS) {
            if (!FormatRegistry.selectionRule(ext)) continue;
            const id = 'export-selection-' + ext;
            const fit = FormatRegistry.selectionFit(ext, rect);
            this.setItemEnabled(id, fit.ok);
            const el = this.element.querySelector('[data-id="' + id + '"]');
            if (!el) continue;
            const r = reasons[fit.reason];
            if (r) el.title = this._t(r[0], r[1]); else el.removeAttribute('title');
        }
    }

    /**
     * Build the menu structure
     * @private
     */
    _buildMenus() {
        const menuDefinitions = [
            {
                id: 'file',
                label: 'File',
                items: [
                    { id: 'new', label: 'New', shortcut: 'Alt+N', action: 'file:new' },
                    { id: 'import', label: 'Load...', shortcut: 'Ctrl+O', action: 'file:import' },
                    // One leaf per picture format — picking a format here IS
                    // the only step; each leaf goes straight to the OS's own
                    // save picker (or its browser-download fallback) for that
                    // one format. This is the ONE save-format entry point
                    // (2026-08-28) — the separate Save.../Ctrl+E action that
                    // opened a native multi-format picker on Chromium was
                    // withdrawn so the menu looks and behaves the same on
                    // every browser. Disabled per format live — see
                    // _updateExportAsMenuState().
                    { id: 'export-as', label: 'Save Image As', i18n: 'menu.file.exportAs',
                      items: EXPORT_FORMATS.map(([ext, label]) => ({
                          id: 'export-as-' + ext, label, i18n: 'format.' + ext,
                          action: 'file:exportAs:' + ext
                      })) },
                    // The same formats for just the selection: each leaf is open when its rule lets the selection
                    // through (see FormatRegistry.selectionFit and _updateExportSelectionMenuState).
                    { id: 'export-selection', label: 'Save Selection As', i18n: 'menu.file.exportSelection',
                      items: EXPORT_FORMATS.filter(([ext]) => !['pal', 'npl'].includes(ext)).map(([ext, label]) => ({
                          id: 'export-selection-' + ext, label, i18n: 'format.' + ext,
                          action: 'file:exportSelection:' + ext
                      })) },
                    { type: 'separator' },
                    { id: 'load-project', label: 'Load Project...', action: 'file:loadProject' },
                    { id: 'save', label: 'Save Project', shortcut: 'Ctrl+S', action: 'file:save' },
                    { id: 'save-as', label: 'Save Project As...', shortcut: 'Ctrl+Shift+S', action: 'file:saveAs' },
                    { type: 'separator' },
                    // A palette is a document of its own in every editor that
                    // supports custom palettes: you build one and reuse it
                    // across pictures. It gets its own way in and out, not
                    // just two entries buried in the Export format list.
                    { id: 'load-palette', label: 'Load Palette...', action: 'file:loadPalette' },
                    { id: 'save-palette', label: 'Save Palette...', action: 'file:savePalette' },
                    { id: 'save-palette-tap', label: 'Save Palette as TAP...', action: 'file:savePaletteTap', i18n: 'menu.file.savePaletteTap' },
                    { id: 'create-palette', label: 'Create Palette...', action: 'file:createPalette' },
                    { type: 'separator' },
                    { id: 'tape-blocks', label: 'Tape Blocks...', action: 'file:tapeBlocks' },
                    { id: 'map-editor', label: 'Map Editor...', action: 'file:mapEditor' },
                    { id: 'font-editor', label: 'Font Editor...', action: 'file:fontEditor' },
                    { id: 'sprite-editor', label: 'Sprite Editor...', action: 'file:spriteEditor' }
                ]
            },
            {
                id: 'edit',
                label: 'Edit',
                items: [
                    { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: 'edit:undo' },
                    { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', action: 'edit:redo' },
                    // Reopen the last drawn figure (Figure, Shape or Bezier) as a pending copy to move, turn or change.
                    { id: 'clone-figure', label: 'Clone Last Figure', shortcut: 'Shift+C', action: 'edit:cloneFigure', i18n: 'menu.edit.cloneFigure' },
                    { type: 'separator' },
                    { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', action: 'edit:cut' },
                    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', action: 'edit:copy' },
                    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', action: 'edit:paste' },
                    { id: 'delete', label: 'Delete', shortcut: 'Del', action: 'edit:delete' },
                    { type: 'separator' },
                    { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A', action: 'edit:selectAll' },
                    { id: 'deselect', label: 'Deselect', shortcut: 'Ctrl+D', action: 'edit:deselect' },
                    { type: 'separator' },
                    { id: 'selection-to-cells', label: 'Fit Selection to Cells', action: 'edit:selectionToCells', i18n: 'menu.edit.selectionToCells' },
                    { id: 'new-from-selection', label: 'New Picture from Selection', action: 'edit:newFromSelection', i18n: 'menu.edit.newFromSelection' }
                ]
            },
            {
                id: 'view',
                label: 'View',
                items: [
                    { id: 'zoom-in', label: 'Zoom In', shortcut: '+', action: 'view:zoomIn' },
                    { id: 'zoom-out', label: 'Zoom Out', shortcut: '-', action: 'view:zoomOut' },
                    { id: 'zoom-fit', label: 'Fit to Window', action: 'view:zoomFit' },
                    { id: 'zoom-fit-selection', label: 'Fit to Selection', action: 'view:zoomFitSelection' },
                    { id: 'zoom-actual', label: 'Actual Size', shortcut: '0', action: 'view:zoomActual' },
                    { type: 'separator' },
                    { id: 'grid', label: 'Show Grid', shortcut: 'Shift+G', action: 'view:toggleGrid', toggle: true },
                    { id: 'pixel-grid', label: 'Show Pixel Grid', action: 'view:togglePixelGrid', toggle: true },
                    { id: 'custom-grid', label: 'Show Custom Grid', action: 'view:toggleCustomGrid', toggle: true, i18n: 'view.customGrid' },
                    { id: 'custom-grid-settings', label: 'Custom Grid...', action: 'view:customGridSettings', i18n: 'view.customGridSettings' },
                    { id: 'grid-snap', label: 'Snap', shortcut: 'Shift+S', action: 'view:toggleSnap', toggle: true, i18n: 'view.snap' },
                    { type: 'separator' },
                    // Display-only: they change what the screen shows, never the picture.
                    { id: 'colours-off', label: 'Colours Off', action: 'view:toggleColoursOff', toggle: true, i18n: 'view.coloursOff' },
                    { id: 'stop-flashing', label: 'Stop Flashing', action: 'view:toggleStopFlashing', toggle: true, i18n: 'view.stopFlashing' },
                    { id: 'colour-grid', label: 'Colour Grid', action: 'view:toggleColourGrid', toggle: true, i18n: 'view.colourGrid' },
                    { type: 'separator' },
                    // The tool-stroke mirror modifier (rail: canvas-controls.js)
                    // as a radio group — bare "H"/"V" labels only make sense
                    // under a "Mirror" heading, which a flat list can't offer.
                    { id: 'mirror', label: 'Mirror', i18n: 'view.mirror', items: [
                        { id: 'mirror-off',  label: 'Off',        action: 'view:mirrorOff',  toggle: true, i18n: 'common.off' },
                        { id: 'mirror-h',    label: 'Horizontal', action: 'view:mirrorH',    toggle: true, i18n: 'view.mirrorH' },
                        { id: 'mirror-v',    label: 'Vertical',   action: 'view:mirrorV',    toggle: true, i18n: 'view.mirrorV' },
                        { id: 'mirror-both', label: 'H+V',        action: 'view:mirrorBoth', toggle: true, i18n: 'view.mirrorBoth' }
                    ]},
                    { type: 'separator' },
                    // Every collapsible sidebar panel except Patterns, which
                    // has its own inline collapse header, this is the
                    // menu-reachable equivalent. Patterns is left out: its
                    // whole section auto-shows/hides on the pattern brush
                    // context (PatternPanel._updatePanelVisibility), and a
                    // manual collapse toggle here would only ever be visible
                    // while that context already shows the panel.
                    { id: 'panel-layers', label: 'Layers', action: 'view:toggleLayers', toggle: true, i18n: 'panels.layers' },
                    { id: 'panel-transform', label: 'Transform', action: 'view:toggleTransform', toggle: true, i18n: 'panels.transform' },
                    { id: 'panel-reference', label: 'Reference Panel', action: 'view:toggleReference', toggle: true },
                    { id: 'panel-tools', label: 'Tool Options', action: 'view:toggleToolOptions', toggle: true },
                    { id: 'panel-preview', label: 'Preview', action: 'view:togglePreview', toggle: true, i18n: 'panels.preview' },
                    { id: 'panel-presets', label: 'Tool Presets', action: 'view:toggleToolPresets', toggle: true, i18n: 'panels.presets' }
                ]
            },
            {
                id: 'layer',
                label: 'Layer',
                items: [
                    { id: 'layer-new', label: 'New Layer', shortcut: 'Shift+N', action: 'layer:new' },
                    { id: 'layer-duplicate', label: 'Duplicate Layer', action: 'layer:duplicate' },
                    { id: 'layer-delete', label: 'Delete Layer', action: 'layer:delete' },
                    { type: 'separator' },
                    { id: 'layer-merge', label: 'Merge Down', shortcut: 'Ctrl+E', action: 'layer:merge' },
                    { id: 'layer-flatten', label: 'Flatten Image', action: 'layer:flatten' },
                    { type: 'separator' },
                    { id: 'layer-up', label: 'Move Up', action: 'layer:moveUp' },
                    { id: 'layer-down', label: 'Move Down', action: 'layer:moveDown' }
                ]
            },
            {
                id: 'image',
                label: 'Image',
                items: [
                    { id: 'flip-h', label: 'Flip Horizontal', action: 'image:flipH' },
                    { id: 'flip-v', label: 'Flip Vertical', action: 'image:flipV' },
                    { type: 'separator' },
                    { id: 'rotate-90cw', label: 'Rotate 90 CW', action: 'image:rotate90cw' },
                    { id: 'rotate-90ccw', label: 'Rotate 90 CCW', action: 'image:rotate90ccw' },
                    { id: 'rotate-180', label: 'Rotate 180', action: 'image:rotate180' },
                    { type: 'separator' },
                    { id: 'invert', label: 'Invert Colors', action: 'image:invert' },
                    { id: 'clear', label: 'Clear Canvas', action: 'image:clear' },
                    { type: 'separator' },
                    // Cell colours only (dots stay). Each row is greyed out where
                    // the mode, a stamp or a locked layer blocks it; the reason
                    // shows as the Attributes row tooltip (_updateAttributeMenuState).
                    { id: 'attributes', label: 'Attributes', i18n: 'menu.image.attributes', items: [
                        { id: 'attr-invert', label: 'Invert', action: 'image:attrInvert' },
                        { id: 'attr-erase', label: 'Erase', action: 'image:attrErase' },
                        { type: 'separator' },
                        { id: 'attr-flip-h', label: 'Flip Horizontal', action: 'image:attrFlipH' },
                        { id: 'attr-flip-v', label: 'Flip Vertical', action: 'image:attrFlipV' },
                        { type: 'separator' },
                        { id: 'attr-change', label: 'Change...', action: 'image:attrChange' }
                    ]},
                    // Dots only (the colours stay in their cells), except
                    // Invert Dots and Colours, which inverts both. Reasons on
                    // the Dots row as for Attributes (_updateDotMenuState).
                    { id: 'dots', label: 'Dots', i18n: 'menu.image.dots', items: [
                        { id: 'dots-flip-h', label: 'Flip Horizontal', action: 'image:dotsFlipH' },
                        { id: 'dots-flip-v', label: 'Flip Vertical', action: 'image:dotsFlipV' },
                        { type: 'separator' },
                        { id: 'dots-invert', label: 'Invert Dots and Colours', action: 'image:dotsInvert' }
                    ]},
                    { type: 'separator' },
                    // Screen modes (Phase 12a/13) live in their own flyout —
                    // 18 radio-style toggles is a wall in a flat dropdown.
                    // Labels reuse the mode.* keys from the SCREEN_MODES
                    // registry; `mode` names the descriptor whose composed
                    // tooltip the row shows (Helpers.describeScreenMode).
                    { id: 'screen-mode', label: 'Screen Mode', i18n: 'menu.image.screenMode', items: [
                        { id: 'mode-standard_ula',   label: 'Standard ULA',   action: 'image:modeStandardUla',   toggle: true, i18n: 'mode.standardUla', mode: 'standard_ula' },
                        { id: 'mode-multicolor_8x4', label: 'Multicolor 8×4', action: 'image:modeMulticolor8x4', toggle: true, i18n: 'mode.multicolor8x4', mode: 'multicolor_8x4' },
                        { id: 'mode-multicolor_8x2', label: 'Multicolor 8×2', action: 'image:modeMulticolor8x2', toggle: true, i18n: 'mode.multicolor8x2', mode: 'multicolor_8x2' },
                        { id: 'mode-multicolor_8x1', label: 'Multicolor 8×1', action: 'image:modeMulticolor8x1', toggle: true, i18n: 'mode.multicolor8x1', mode: 'multicolor_8x1' },
                        { id: 'mode-ula_plus',       label: 'ULAplus',        action: 'image:modeUlaPlus',       toggle: true, i18n: 'mode.ulaPlus', mode: 'ula_plus' },
                        { id: 'mode-ula_plus_8x1',   label: 'ULAplus 8×1 (Timex)', action: 'image:modeUlaPlus8x1', toggle: true, i18n: 'mode.ulaPlus8x1', mode: 'ula_plus_8x1' },
                        { id: 'mode-timex_hires',    label: 'Timex Hi-res 512×192', action: 'image:modeTimexHires', toggle: true, i18n: 'mode.timexHires', mode: 'timex_hires' },
                        { id: 'mode-gigascreen',     label: 'GigaScreen',     action: 'image:modeGigascreen',    toggle: true, i18n: 'mode.gigascreen', mode: 'gigascreen' },
                        // Flicker pairs on the finer cells and in hi-res (2026-09-23)
                        { id: 'mode-multigiga_8x4',  label: 'MultiGigaScreen 8×4', action: 'image:modeMultigiga8x4', toggle: true, i18n: 'mode.multigiga8x4', mode: 'multigiga_8x4' },
                        { id: 'mode-multigiga_8x2',  label: 'MultiGigaScreen 8×2', action: 'image:modeMultigiga8x2', toggle: true, i18n: 'mode.multigiga8x2', mode: 'multigiga_8x2' },
                        { id: 'mode-multigiga_8x1',  label: 'MultiGigaScreen 8×1', action: 'image:modeMultigiga8x1', toggle: true, i18n: 'mode.multigiga8x1', mode: 'multigiga_8x1' },
                        { id: 'mode-timex_hires_giga', label: 'Timex Hi-res GigaScreen', action: 'image:modeTimexHiresGiga', toggle: true, i18n: 'mode.timexHiresGiga', mode: 'timex_hires_giga' },
                        { type: 'separator' },
                        // ZX Spectrum Next modes (Phase 13)
                        { id: 'mode-ulanext',        label: 'ULANext',         action: 'image:modeUlanext',       toggle: true, i18n: 'mode.ulanext', mode: 'ulanext' },
                        { id: 'mode-layer2_256',     label: 'Layer 2 256×192', action: 'image:modeLayer2_256',    toggle: true, i18n: 'mode.layer2_256', mode: 'layer2_256' },
                        { id: 'mode-layer2_320',     label: 'Layer 2 320×256', action: 'image:modeLayer2_320',    toggle: true, i18n: 'mode.layer2_320', mode: 'layer2_320' },
                        { id: 'mode-layer2_640',     label: 'Layer 2 640×256', action: 'image:modeLayer2_640',    toggle: true, i18n: 'mode.layer2_640', mode: 'layer2_640' },
                        { id: 'mode-lores',          label: 'LoRes 128×96',    action: 'image:modeLores',         toggle: true, i18n: 'mode.lores', mode: 'lores' },
                        { id: 'mode-lores_radastan', label: 'Radastan 128×96', action: 'image:modeLoresRadastan', toggle: true, i18n: 'mode.loresRadastan', mode: 'lores_radastan' }
                    ]},
                    { type: 'separator' },
                    // Four palettes per palette kind (ULAplus, Next), and the ULAplus palette
                    // inverter. Greyed out where the mode has a fixed palette; the reason shows
                    // as the Palette row tooltip (_updatePaletteMenuState).
                    { id: 'palette-slots', label: 'Palette', i18n: 'menu.image.palette', items: [
                        { id: 'palette-slot-1', label: 'Slot 1', action: 'image:paletteSlot1', toggle: true, i18n: 'menu.image.paletteSlot1' },
                        { id: 'palette-slot-2', label: 'Slot 2', action: 'image:paletteSlot2', toggle: true, i18n: 'menu.image.paletteSlot2' },
                        { id: 'palette-slot-3', label: 'Slot 3', action: 'image:paletteSlot3', toggle: true, i18n: 'menu.image.paletteSlot3' },
                        { id: 'palette-slot-4', label: 'Slot 4', action: 'image:paletteSlot4', toggle: true, i18n: 'menu.image.paletteSlot4' },
                        { type: 'separator' },
                        { id: 'palette-invert', label: 'Invert Palette', action: 'image:invertPalette', i18n: 'menu.image.invertPalette' }
                    ]},
                    { id: 'edit-palette', label: 'Edit Palette...', action: 'image:editPalette' }
                ]
            },
            {
                id: 'settings',
                label: 'Settings',
                items: [
                    { id: 'preferences', label: 'Preferences...', action: 'settings:preferences' },
                    { id: 'presets', label: 'Workspace Presets...', action: 'settings:presets' },
                    { type: 'separator' },
                    // All 8 themes — the sole theme picker (a header <select>
                    // duplicated this until 2026-08-21; removed as redundant).
                    { id: 'theme', label: 'Theme', i18n: 'menu.settings.theme', items: [
                        { id: 'theme-dark',     label: 'Dark',     action: 'settings:themeDark',     toggle: true, i18n: 'theme.dark' },
                        { id: 'theme-light',    label: 'Light',    action: 'settings:themeLight',    toggle: true, i18n: 'theme.light' },
                        { id: 'theme-midnight', label: 'Midnight', action: 'settings:themeMidnight', toggle: true, i18n: 'theme.midnight' },
                        { id: 'theme-nord',     label: 'Nord',     action: 'settings:themeNord',     toggle: true, i18n: 'theme.nord' },
                        { id: 'theme-dracula',  label: 'Dracula',  action: 'settings:themeDracula',  toggle: true, i18n: 'theme.dracula' },
                        { id: 'theme-sepia',    label: 'Sepia',    action: 'settings:themeSepia',    toggle: true, i18n: 'theme.sepia' },
                        { id: 'theme-crimson',  label: 'Crimson',  action: 'settings:themeCrimson',  toggle: true, i18n: 'theme.crimson' },
                        { id: 'theme-citrus',   label: 'Citrus',   action: 'settings:themeCitrus',   toggle: true, i18n: 'theme.citrus' }
                    ]},
                    { type: 'separator' },
                    { id: 'reset-preferences', label: 'Reset All Preferences', action: 'settings:resetAll' }
                ]
            },
            {
                id: 'help',
                label: 'Help',
                items: [
                    { id: 'manual', label: 'Manual', action: 'help:manual' },
                    { id: 'about', label: 'About', action: 'help:about' },
                    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: 'F1', action: 'help:shortcuts' }
                ]
            }
        ];

        let html = '';

        // ARIA menubar roles, and a roving tabindex: exactly one label is in
        // the Tab order (the first), and the arrow keys move between the rest
        // (_onMenuKeydown) - see the WAI-ARIA menubar pattern.
        menuDefinitions.forEach((menu, i) => {
            html += `
                <div class="menu-item" data-menu="${menu.id}" role="none">
                    <span class="menu-label" data-i18n="menu.${menu.id}" role="menuitem"
                          tabindex="${i === 0 ? 0 : -1}" aria-haspopup="menu" aria-expanded="false"
                          aria-controls="menu-${menu.id}">${menu.label}</span>
                    <div class="menu-dropdown" id="menu-${menu.id}" role="menu">
                        ${this._buildMenuItems(menu.items)}
                    </div>
                </div>
            `;
        });

        this.element.innerHTML = html;
        this.element.setAttribute('role', 'menubar');
        // Localise the freshly-built menu; locale changes re-translate it via
        // the persistent data-i18n attributes (I18n.setLocale -> apply).
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this.element);
    }

    /**
     * Build menu items HTML
     * @private
     */
    _buildMenuItems(items) {
        return items.map(item => {
            if (item.type === 'separator') {
                return '<div class="menu-separator" role="separator"></div>';
            }

            // A submenu parent carries `items` instead of `action` — its own
            // i18n key is mandatory (there is no action id to derive one from).
            if (item.items) {
                return `
                    <div class="menu-action menu-action--parent" data-id="${item.id}" role="menuitem" tabindex="-1" aria-haspopup="menu" aria-expanded="false">
                        <span class="menu-action-label" data-i18n="${item.i18n}">${item.label}</span>
                        <span class="menu-submenu-arrow" aria-hidden="true"></span>
                        <div class="menu-dropdown menu-submenu" id="menu-${item.id}" role="menu">
                            ${this._buildMenuItems(item.items)}
                        </div>
                    </div>
                `;
            }

            const shortcutHtml = item.shortcut
                ? `<span class="menu-shortcut" data-i18n-shortcut="${item.shortcut}">${Helpers.shortcutLabel(item.shortcut)}</span>`
                : '';

            const toggleClass = item.toggle ? ' menu-toggle' : '';
            // Stable i18n key derived from the action, e.g. 'file:saveAs' ->
            // 'menu.file.saveAs'; an explicit item.i18n overrides (used by
            // the screen-mode items to reuse the mode.* registry keys).
            const i18nKey = item.i18n || ('menu.' + item.action.replace(':', '.'));
            // Screen-mode rows carry the composed descriptor tooltip (size,
            // attribute layout, colours, palette, what the mode is for);
            // I18n fills and re-translates it from this attribute.
            const modeAttr = item.mode ? ` data-i18n-mode-title="${item.mode}"` : '';

            const role = item.toggle
                ? 'role="menuitemcheckbox" aria-checked="false"' : 'role="menuitem"';

            return `
                <div class="menu-action${toggleClass}" data-action="${item.action}" data-id="${item.id}"${modeAttr} ${role} tabindex="-1">
                    <span class="menu-action-label" data-i18n="${i18nKey}">${item.label}</span>
                    ${shortcutHtml}
                </div>
            `;
        }).join('');
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEvents() {
        this.element.querySelectorAll('.menu-item').forEach(menuItem => {
            menuItem.addEventListener('mouseenter', () => {
                if (this._menuOpen) {
                    this._showMenu(menuItem.dataset.menu);
                }
            });

            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const menuId = menuItem.dataset.menu;

                if (this.activeMenu === menuId && this._menuOpen) {
                    this._closeAllMenus();
                } else {
                    this._showMenu(menuId);
                }
            });
        });

        this.element.querySelectorAll('.menu-action:not(.menu-action--parent)').forEach(action => {
            action.addEventListener('click', (e) => {
                e.stopPropagation();
                // A greyed-out row that carries a reason (its tooltip) still
                // receives the pointer so the reason can show; it does nothing.
                if (action.classList.contains('disabled')) return;
                this._executeAction(action.dataset.action);
                this._closeAllMenus();
            });
        });

        // Submenu parents toggle their flyout instead of executing+closing —
        // click for touch/keyboard-less access, hover once the bar is already
        // in "browsing" mode (mirrors the top-level menuItem mouseenter above).
        // Always OPEN, never toggle-closed: a real mouse click is preceded by
        // the mouseenter below, which already opened it — toggling on click
        // would immediately close what hover just opened. Touch/keyboard have
        // no such preceding hover, so click-to-open still reaches them.
        // Closing is handled elsewhere: a sibling submenu opening, a leaf
        // click, an outside click, or Escape.
        this.element.querySelectorAll('.menu-action--parent').forEach(parent => {
            parent.addEventListener('click', (e) => {
                e.stopPropagation();
                this._openSubmenu(parent);
            });
            parent.addEventListener('mouseenter', () => {
                if (this._menuOpen) this._openSubmenu(parent);
            });
        });

        this._boundDocClickHandler = () => this._closeAllMenus();
        document.addEventListener('click', this._boundDocClickHandler);

        this._boundDocKeydownHandler = (e) => {
            if (e.key === 'Escape' && this._menuOpen) {
                this._closeAllMenus();
            }
            // F10 puts keyboard focus on the menu bar, as in desktop apps
            // (the bar is also the first Tab stop).
            if (e.key === 'F10' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                this._focusLabel(this.element.querySelector('.menu-label'));
            }
        };
        document.addEventListener('keydown', this._boundDocKeydownHandler);
        this.element.addEventListener('keydown', (e) => this._onMenuKeydown(e));

        // Keep Edit menu item states in sync with selection/clipboard changes.
        // Short-circuits when state hasn't changed to avoid DOM churn per frame.
        this._lastHasSel  = false;
        this._lastHasClip = false;
        EventBus.on(EVENTS.CANVAS_RENDER, () => this._updateEditMenuState());

        // Keep View toggles in sync with grid facts
        EventBus.on(EVENTS.GRID_VISIBILITY, (state) => {
            this._updateToggleState('grid', !!state.cell);
            this._updateToggleState('pixel-grid', !!state.pixel);
            this._updateToggleState('custom-grid', !!state.custom);
        });

        EventBus.on(EVENTS.THEME_CHANGED, ({ theme }) => this._updateThemeToggles(theme));

        // Keep the Image-menu mode radios, and Save Image As's per-format
        // availability, in sync with the mode fact
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => {
            this._updateModeToggles();
            this._updateExportAsMenuState();
            this._updateAttributeMenuState();
            this._updateDotMenuState();
            this._updatePaletteMenuState();
            this._updateDisplayViewMenuState();
        });
        EventBus.on(EVENTS.PALETTE_SLOT_CHANGED, () => this._updatePaletteMenuState());

        // Keep the View-menu Mirror radios and Snap toggle in sync with their
        // facts (both can also change from the canvas-controls rail).
        EventBus.on(EVENTS.SYMMETRY_CHANGED, ({ mode }) => this._updateMirrorToggles(mode));
        EventBus.on(EVENTS.GRID_SNAP_CHANGED, ({ snap }) => this._updateToggleState('grid-snap', !!snap));
        EventBus.on(EVENTS.DISPLAY_VIEW_CHANGED, () => this._updateDisplayViewMenuState());
        // The greyed-out reasons are written into tooltips; follow the language.
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, () => {
            this._updateDisplayViewMenuState();
            this._updateAttributeMenuState();
            this._updateDotMenuState();
            this._updatePaletteMenuState();
        });

        // Keep each View-menu panel checkbox in sync with PanelSection's own
        // visibility fact — fired on creation, on restore() resolving
        // persisted state, and on setVisible()/toggleVisibility() from
        // anywhere else, so the menu reflects reality on load and stays right
        // however the panel was added or removed (not only via this menu).
        EventBus.on(EVENTS.PANEL_VISIBILITY_CHANGED, ({ id, visible }) => {
            const itemId = this._PANEL_MENU_ITEM_BY_SECTION[id];
            if (itemId) this._updateToggleState(itemId, visible);
        });
    }

    /**
     * Open a submenu, closing any sibling submenu at the same level first.
     * @private
     */
    _openSubmenu(parent) {
        const dropdown = parent.querySelector(':scope > .menu-submenu');
        if (!dropdown) return;
        const level = parent.parentElement;
        if (level) {
            level.querySelectorAll(':scope > .menu-action--parent').forEach(sibling => {
                if (sibling !== parent) this._closeSubmenu(sibling);
            });
        }
        parent.setAttribute('aria-expanded', 'true');
        dropdown.classList.add('visible');
        this._positionSubmenu(dropdown);
    }

    /** @private */
    _closeSubmenu(parent) {
        const dropdown = parent.querySelector(':scope > .menu-submenu');
        parent.setAttribute('aria-expanded', 'false');
        if (!dropdown) return;
        dropdown.classList.remove('visible', 'menu-submenu--flip');
        // Nested-nested submenus never occur today, but leaving one open
        // would survive this close and reappear stale next time.
        dropdown.querySelectorAll('.menu-dropdown.visible').forEach(d => d.classList.remove('visible'));
    }

    /**
     * Flip a freshly-opened submenu to the left of its parent when it would
     * otherwise run off the right edge of the window.
     * @private
     */
    _positionSubmenu(dropdown) {
        dropdown.classList.remove('menu-submenu--flip');
        const rect = dropdown.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            dropdown.classList.add('menu-submenu--flip');
        }
    }

    /** @private */
    _showMenu(menuId) {
        this._closeAllMenus();

        if (menuId === 'file') this._updatePaletteMenuState();
        if (menuId === 'edit') this._updateEditMenuState();
        if (menuId === 'file') this._updateExportSelectionMenuState();
        if (menuId === 'view') this._updateViewMenuState();
        if (menuId === 'image') {
            this._updateAttributeMenuState();
            this._updateDotMenuState();
            this._updatePaletteMenuState();
        }

        const menuItem = this.element.querySelector(`[data-menu="${menuId}"]`);
        const dropdown = this.element.querySelector(`#menu-${menuId}`);

        if (menuItem && dropdown) {
            menuItem.classList.add('active');
            menuItem.querySelector('.menu-label')?.setAttribute('aria-expanded', 'true');
            dropdown.classList.add('visible');
            this.activeMenu = menuId;
            this._menuOpen = true;
        }
    }

    /**
     * Refresh the enabled/disabled state of Edit menu clipboard items.
     */
    _updateEditMenuState() {
        const hasSel  = !!(window.SelectionService && SelectionService.hasSelection());
        // Paste stays enabled when a system-clipboard read is possible —
        // we cannot know synchronously whether an image is actually there
        const canPaste = !!(window.SelectionService && SelectionService.hasClipboard()) ||
            !!(navigator.clipboard && typeof navigator.clipboard.read === 'function');
        // Clone Last Figure is open once a figure has been drawn.
        const hasFigure = !!(window.FigureHistory && FigureHistory.has());
        this.setItemEnabled('clone-figure', hasFigure);
        // The selection becomes a new picture only when nothing is floating (a paste in flight would be lost).
        const floating = !!(window.SelectionService && SelectionService.isFloating());
        this.setItemEnabled('selection-to-cells', hasSel && !floating);
        this.setItemEnabled('new-from-selection', hasSel && !floating);
        if (hasSel === this._lastHasSel && canPaste === this._lastHasClip) return;
        this._lastHasSel  = hasSel;
        this._lastHasClip = canPaste;
        this.setItemEnabled('cut',      hasSel);
        this.setItemEnabled('copy',     hasSel);
        this.setItemEnabled('paste',    canPaste);
        this.setItemEnabled('delete',   hasSel);
        this.setItemEnabled('deselect', hasSel);
    }

    /**
     * Refresh the enabled state of selection-dependent View menu items.
     */
    _updateViewMenuState() {
        this.setItemEnabled('zoom-fit-selection',
            !!(window.SelectionService && SelectionService.hasSelection()));
    }

    /** @private */
    _closeAllMenus() {
        this.element.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        this.element.querySelectorAll('.menu-dropdown').forEach(dropdown => {
            dropdown.classList.remove('visible', 'menu-submenu--flip');
        });
        this.element.querySelectorAll('.menu-action--parent, .menu-label').forEach(el => {
            el.setAttribute('aria-expanded', 'false');
        });
        this.activeMenu = null;
        this._menuOpen = false;
    }

    /**
     * Keyboard access to the menus (the WAI-ARIA menubar pattern).
     *
     * On the bar: Left/Right move between menus (carrying an open menu with
     * them), Enter/Space/Down open one and focus its first item, Up its last.
     * In a menu: Up/Down move (skipping separators and disabled rows),
     * Enter/Space run the row or open its submenu, Right opens a submenu or
     * moves to the next menu, Left closes a submenu or moves to the previous
     * menu, Escape closes one level and returns focus, Tab closes and moves on.
     *
     * Handled keys stop here, so the canvas shortcuts on the document (arrow
     * nudge, tool letters) never also act on them. Ctrl/Cmd/Alt chords pass
     * straight through: Ctrl+S still saves with a menu focused.
     * @private
     */
    _onMenuKeydown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target.closest('[role^="menuitem"]');
        if (!target || !this.element.contains(target)) return;
        const key = e.key;
        const labels = [...this.element.querySelectorAll('.menu-label')];
        const step = (list, from, delta) => list[(list.indexOf(from) + delta + list.length) % list.length];
        let handled = true;

        if (target.classList.contains('menu-label')) {
            if (key === 'ArrowRight' || key === 'ArrowLeft') {
                const wasOpen = this._menuOpen;
                const next = step(labels, target, key === 'ArrowRight' ? 1 : -1);
                this._focusLabel(next);
                if (wasOpen) this._openFromKeyboard(next, false);
            } else if (key === 'Home' || key === 'End') {
                this._focusLabel(labels[key === 'Home' ? 0 : labels.length - 1]);
            } else if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
                this._openFromKeyboard(target, true);
            } else if (key === 'ArrowUp') {
                this._openFromKeyboard(target, true, true);
            } else if (key === 'Escape') {
                this._closeAllMenus();
            } else if (key !== 'Tab') {
                handled = key.length === 1; // swallow plain letters, let F-keys through
            } else {
                handled = false;
            }
        } else {
            const list = target.parentElement;
            const items = this._menuRows(list);
            const isParent = target.classList.contains('menu-action--parent');
            const inSubmenu = list.classList.contains('menu-submenu');
            const label = target.closest('.menu-item')?.querySelector('.menu-label');
            if (key === 'ArrowDown' || key === 'ArrowUp') {
                step(items, target, key === 'ArrowDown' ? 1 : -1)?.focus();
            } else if (key === 'Home' || key === 'End') {
                items[key === 'Home' ? 0 : items.length - 1]?.focus();
            } else if (isParent && (key === 'Enter' || key === ' ' || key === 'ArrowRight')) {
                this._openSubmenu(target);
                this._menuRows(target.querySelector(':scope > .menu-submenu'))[0]?.focus();
            } else if (key === 'Enter' || key === ' ') {
                if (!target.classList.contains('disabled')) {
                    target.click();
                    // Back to the bar unless the action moved focus on purpose
                    // (a dialog it opened, say).
                    const now = document.activeElement;
                    if (label && (!now || now === document.body || this.element.contains(now))) {
                        this._focusLabel(label);
                    }
                }
            } else if ((key === 'ArrowLeft' || key === 'Escape') && inSubmenu) {
                const parent = list.parentElement;
                this._closeSubmenu(parent);
                parent.focus();
            } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
                const next = step(labels, label, key === 'ArrowRight' ? 1 : -1);
                this._focusLabel(next);
                this._openFromKeyboard(next, true);
            } else if (key === 'Escape') {
                this._closeAllMenus();
                if (label) this._focusLabel(label);
            } else if (key === 'Tab') {
                this._closeAllMenus();
                handled = false;
            } else {
                handled = key.length === 1;
            }
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /** The rows of one menu level that keyboard focus can land on. @private */
    _menuRows(list) {
        if (!list) return [];
        return [...list.children].filter(el =>
            /^menuitem/.test(el.getAttribute('role') || '') && !el.classList.contains('disabled'));
    }

    /** Move the bar's single Tab stop to `label` and focus it. @private */
    _focusLabel(label) {
        if (!label) return;
        this.element.querySelectorAll('.menu-label').forEach(l => { l.tabIndex = l === label ? 0 : -1; });
        label.focus();
    }

    /** Open the menu under `label`; optionally focus its first (or last) row. @private */
    _openFromKeyboard(label, focusRow, last = false) {
        const menuItem = label.closest('.menu-item');
        if (!menuItem) return;
        this._showMenu(menuItem.dataset.menu);
        if (!focusRow) return;
        const rows = this._menuRows(menuItem.querySelector(':scope > .menu-dropdown'));
        rows[last ? rows.length - 1 : 0]?.focus();
    }

    /**
     * Public close-outside hook. The document 'click' listener above cannot
     * see a click inside the canvas iframe - it is a separate document, and
     * it covers most of the screen - so InputHandler calls this directly on
     * pointerdown there instead.
     */
    closeAllMenus() {
        this._closeAllMenus();
    }

    /**
     * Execute a menu action — direct singleton calls (commands go down)
     * @private
     */
    _executeAction(actionId) {
        // File > Save Image As leaves carry their format in the action id
        // itself ('file:exportAs:tap') rather than one switch case per
        // format — see the File menu's export-as submenu in _buildMenus().
        if (actionId.startsWith('file:exportSelection:')) {
            FileManager.exportSelectionAs(actionId.slice('file:exportSelection:'.length));
            return;
        }
        if (actionId.startsWith('file:exportAs:')) {
            FileManager.exportAs(actionId.slice('file:exportAs:'.length));
            return;
        }

        switch (actionId) {
            // File
            case 'file:new':    FileManager.newFile();  break;
            case 'file:save':   FileManager.save();     break;
            case 'file:saveAs': FileManager.saveAs();   break;
            case 'file:loadProject': FileManager.loadProjectFile(); break;
            case 'file:loadPalette': PaletteEditorDialog.loadFromFile(); break;
            case 'file:savePalette': PaletteEditorDialog.saveToFile(); break;
            case 'file:savePaletteTap': PaletteEditorDialog.saveToFile('tap'); break;
            case 'file:createPalette': PaletteEditorDialog.create(); break;
            case 'file:import': FileManager.openFile(); break;
            case 'file:tapeBlocks': TapeBlockDialog.openForFile(); break;
            case 'file:mapEditor': MapEditorDialog.open(); break;
            case 'file:fontEditor': FontEditorDialog.open(); break;
            case 'file:spriteEditor': SpriteEditorDialog.open(); break;

            // Edit
            case 'edit:undo': ToolManager.undo(); break;
            case 'edit:redo': UndoRedo.redo(); break;
            case 'edit:cloneFigure': FigureHistory.cloneLast(); break;
            case 'edit:cut':
                SelectionService.copyOrCut(true);
                break;
            case 'edit:copy':
                SelectionService.copyOrCut(false);
                break;
            case 'edit:paste':
                if (SelectionService.hasClipboard()) {
                    const clip = SelectionService.clipboard;
                    SelectionService.startFloatingPaste(clip.originX || 0, clip.originY || 0);
                    SelectionService.clear();
                } else {
                    // No keyboard gesture here, so the paste-event path can't
                    // fire — go through navigator.clipboard.read() instead
                    FileManager.pasteFromSystemClipboard();
                }
                break;
            case 'edit:delete':
                SelectionService.deleteSelection();
                SelectionService.clear();
                CanvasSystem.requestRender();
                break;
            case 'edit:selectAll':
                SelectionService.selectAll();
                CanvasSystem.requestRender();
                break;
            case 'edit:deselect':
                SelectionService.clear();
                CanvasSystem.requestRender();
                break;
            case 'edit:selectionToCells':
                FileManager.fitSelectionToCells();
                break;
            case 'edit:newFromSelection':
                FileManager.newFromSelection();
                break;

            // View — zoom goes through the canvas-controls path
            case 'view:zoomIn':  CanvasControls.stepZoom(1);  break;
            case 'view:zoomOut': CanvasControls.stepZoom(-1); break;
            case 'view:zoomFit': CanvasControls.applyFit();   break;
            case 'view:zoomFitSelection': {
                if (window.SelectionService && SelectionService.hasSelection()) {
                    const sel = SelectionService.getSelection();
                    CanvasSystem.zoomToRect(sel.x, sel.y, sel.width, sel.height);
                }
                break;
            }
            case 'view:zoomActual':
                CanvasSystem.setZoom(ZOOM_CONFIG.MIN);
                break;
            case 'view:toggleGrid':
                GridOverlay.toggle();
                break;
            case 'view:togglePixelGrid':
                GridOverlay.togglePixelGrid();
                break;
            case 'view:toggleCustomGrid':
                GridOverlay.toggleCustomGrid();
                break;
            case 'view:customGridSettings':
                CustomGridDialog.open();
                break;
            case 'view:toggleSnap':
                StateManager.setGridSnap(!StateManager.getGridSnap());
                break;
            case 'view:toggleColoursOff':
                StateManager.setColoursOff(!StateManager.getDisplayView().coloursOff);
                break;
            case 'view:toggleStopFlashing':
                StateManager.setStopFlashing(!StateManager.getDisplayView().stopFlashing);
                break;
            case 'view:toggleColourGrid':
                StateManager.setColourGrid(!StateManager.getDisplayView().colourGrid);
                break;
            case 'view:mirrorOff':  StateManager.setSymmetryMode('off');  break;
            case 'view:mirrorH':    StateManager.setSymmetryMode('h');    break;
            case 'view:mirrorV':    StateManager.setSymmetryMode('v');    break;
            case 'view:mirrorBoth': StateManager.setSymmetryMode('quad'); break;
            // Adds/removes the whole panel from the sidebar (PanelSection's
            // visibility axis, not its collapse axis — see panel-section.js).
            // The menu's own checked state is not set here — it follows
            // EVENTS.PANEL_VISIBILITY_CHANGED (see _attachEvents), the same
            // fact any other caller of setVisible/toggleVisibility fires, so
            // the two paths can never disagree.
            case 'view:toggleReference':   PanelSection.toggleVisibility('reference-panel');    break;
            case 'view:togglePreview':     PanelSection.toggleVisibility('preview-panel');      break;
            case 'view:toggleToolOptions': PanelSection.toggleVisibility('tool-options-panel'); break;
            case 'view:toggleLayers':      PanelSection.toggleVisibility('layer-panel');        break;
            case 'view:toggleTransform':   PanelSection.toggleVisibility('transform-panel');    break;
            // Presets' whole-panel show/hide is still owned by the
            // showPresetsPanel preference (also set from Preferences >
            // General) rather than a direct toggleVisibility() call here —
            // but that preference reaches PanelSection.setVisible() itself
            // (ToolPresetPanel._syncVisibility), which is what fires the
            // same PANEL_VISIBILITY_CHANGED fact the checkbox above follows,
            // so there is still only one thing this menu item's checked
            // state can disagree with: the panel's own last preference read.
            case 'view:toggleToolPresets': StateManager.set('showPresetsPanel', !StateManager.get('showPresetsPanel')); break;

            // Layer
            case 'layer:new':       LayerManager.addLayer(); break;
            case 'layer:duplicate': LayerManager.duplicateLayer(LayerManager.currentLayerIndex); break;
            case 'layer:delete':    LayerManager.removeLayer(LayerManager.currentLayerIndex); break;
            case 'layer:merge':     LayerManager.mergeDown(LayerManager.currentLayerIndex); break;
            case 'layer:flatten':   this._flattenImage(); break;
            case 'layer:moveUp':    LayerManager.moveLayerUp(LayerManager.currentLayerIndex); break;
            case 'layer:moveDown':  LayerManager.moveLayerDown(LayerManager.currentLayerIndex); break;

            // Image
            // Through the Transform panel's one entry point, which sends a floating
            // stamp to SelectionService.transformStamp instead of the picture.
            case 'image:flipH':       TransformPanel.applyTransform('flipH');        break;
            case 'image:flipV':       TransformPanel.applyTransform('flipV');        break;
            case 'image:rotate90cw':  TransformPanel.applyTransform('rotate90CW');   break;
            case 'image:rotate90ccw': TransformPanel.applyTransform('rotate90CCW');  break;
            case 'image:rotate180':   TransformPanel.applyTransform('rotate180');    break;
            case 'image:invert':      TransformPanel.applyTransform('invert');       break;
            case 'image:clear':       this._clearCanvas();               break;

            // Image > Attributes (cell colours; dots untouched)
            case 'image:attrInvert':   TransformService.invertAttributes();        break;
            case 'image:attrErase':    TransformService.eraseAttributes();         break;
            case 'image:attrFlipH':    TransformService.flipAttributesHorizontal(); break;
            case 'image:attrFlipV':    TransformService.flipAttributesVertical();   break;
            case 'image:attrChange':   ChangeAttributesDialog.open();              break;

            // Image > Dots (dots only; Invert Dots and Colours inverts both)
            case 'image:dotsFlipH':    TransformService.dotsFlip('h');             break;
            case 'image:dotsFlipV':    TransformService.dotsFlip('v');             break;
            case 'image:dotsInvert':   TransformService.invertDotsAndColours();    break;

            // Screen modes (Phase 12a)
            case 'image:modeStandardUla':   this.requestScreenMode('standard_ula');   break;
            case 'image:modeMulticolor8x4': this.requestScreenMode('multicolor_8x4'); break;
            case 'image:modeMulticolor8x2': this.requestScreenMode('multicolor_8x2'); break;
            case 'image:modeMulticolor8x1': this.requestScreenMode('multicolor_8x1'); break;
            case 'image:modeUlaPlus':       this.requestScreenMode('ula_plus');       break;
            case 'image:modeUlaPlus8x1':    this.requestScreenMode('ula_plus_8x1');   break;
            case 'image:modeTimexHires':    this.requestScreenMode('timex_hires');    break;
            case 'image:modeGigascreen':    this.requestScreenMode('gigascreen');     break;
            case 'image:modeMultigiga8x4':  this.requestScreenMode('multigiga_8x4');  break;
            case 'image:modeMultigiga8x2':  this.requestScreenMode('multigiga_8x2');  break;
            case 'image:modeMultigiga8x1':  this.requestScreenMode('multigiga_8x1');  break;
            case 'image:modeTimexHiresGiga': this.requestScreenMode('timex_hires_giga'); break;
            // ZX Spectrum Next modes (Phase 13)
            case 'image:modeUlanext':       this.requestScreenMode('ulanext');        break;
            case 'image:modeLayer2_256':    this.requestScreenMode('layer2_256');     break;
            case 'image:modeLayer2_320':    this.requestScreenMode('layer2_320');     break;
            case 'image:modeLayer2_640':    this.requestScreenMode('layer2_640');     break;
            case 'image:modeLores':         this.requestScreenMode('lores');          break;
            case 'image:modeLoresRadastan': this.requestScreenMode('lores_radastan'); break;
            case 'image:editPalette':       PaletteEditorDialog.open();               break;
            case 'image:paletteSlot1':      TransformService.selectPaletteSlot(0);    break;
            case 'image:paletteSlot2':      TransformService.selectPaletteSlot(1);    break;
            case 'image:paletteSlot3':      TransformService.selectPaletteSlot(2);    break;
            case 'image:paletteSlot4':      TransformService.selectPaletteSlot(3);    break;
            case 'image:invertPalette':     TransformService.invertPalette();         break;

            // Settings
            case 'settings:preferences': PreferencesDialog.open(); break;
            case 'settings:presets': PresetDialog.open(); break;
            case 'settings:themeDark':     this._setTheme('dark');     break;
            case 'settings:themeLight':    this._setTheme('light');    break;
            case 'settings:themeMidnight': this._setTheme('midnight'); break;
            case 'settings:themeNord':     this._setTheme('nord');     break;
            case 'settings:themeDracula':  this._setTheme('dracula');  break;
            case 'settings:themeSepia':    this._setTheme('sepia');    break;
            case 'settings:themeCrimson':  this._setTheme('crimson');  break;
            case 'settings:themeCitrus':   this._setTheme('citrus');   break;
            case 'settings:resetAll':       PreferencesDialog.resetAll();  break;

            // Help
            case 'help:manual':    this._openManual();    break;
            case 'help:about':     this._showAbout();     break;
            case 'help:shortcuts': this._showShortcuts(); break;

            default:
                Logger.warn('MenuSystem', `Unknown action: ${actionId}`);
        }
    }

    /** @private */
    _updateToggleState(itemId, active) {
        const item = this.element.querySelector(`[data-id="${itemId}"]`);
        if (!item) return;
        item.classList.toggle('checked', active);
        if (item.getAttribute('role') === 'menuitemcheckbox') item.setAttribute('aria-checked', String(!!active));
    }

    /**
     * Flatten image (merge all layers). Confirms first.
     * @private
     */
    _flattenImage() {
        if (!confirm(this._t('msg.confirmFlatten', 'Flatten all layers into one? This cannot be separated again.'))) {
            return;
        }

        UndoRedo.beginAction('Flatten');

        // Bake any stamps into drawing layers first so their content is
        // included in the flatten (commitAllStamps uses nested undo).
        SelectionService.commitAllStamps();

        const flatLayer = LayerManager.flattenVisible();

        // Strip down to background + one drawing layer, removing from top
        while (LayerManager.layers.length > 2) {
            // removeLayer refuses the last drawing layer; never spin on it
            if (!LayerManager.removeLayer(LayerManager.layers.length - 1, false)) break;
        }

        // Overwrite the surviving drawing layer (index 1) with flattened data
        const target = LayerManager.layers[1];
        target.restoreAttributeData(flatLayer.cloneAttributeData());
        target.name = 'Flattened';
        target.isStamp = false;

        LayerManager.selectedLayers.clear();
        LayerManager.selectedLayers.add(1);
        LayerManager.currentLayerIndex = 1;

        LayerManager.composeToCanvas();
        EventBus.emit(EVENTS.LAYER_ORDER);

        UndoRedo.endAction();
    }

    /**
     * Clear the current layer. Confirms first.
     * @private
     */
    _clearCanvas() {
        if (StateManager.get('confirmClear') !== false &&
            !confirm(this._t('msg.confirmClear', 'Clear the current layer?'))) {
            return;
        }
        const layer = LayerManager.getCurrentLayer();
        if (layer) {
            layer.clear();
            LayerManager.composeToCanvas();
        }
    }

    /** @private */
    /**
     * Open the manual, which lives inside the app rather than beside it.
     *
     * ManualDialog loads js/data/manual-content.js on first use and shows it in
     * an ordinary app dialog - see that file for why the manual is carried in
     * `js/` and not as a separate page.
     * @private
     */
    _openManual() {
        ManualDialog.open();
    }

    _showAbout() {
        const author = 'D0k of Raww Arse';
        const repoUrl = 'https://github.com/D0k-Soundwave/PixULA';
        const content = document.createElement('div');
        content.className = 'about-dialog-body';
        content.innerHTML = `
            <h2>PixULA</h2>
            <p data-i18n="about.subtitle">${this._t('about.subtitle', 'ZX Spectrum Pixel Art Editor')}</p>
            <p data-i18n="about.version" data-i18n-param-version="${APP_VERSION}">${this._t('about.version', 'Version {version}', { version: APP_VERSION })}</p>
            <p class="about-specs">
                <span data-i18n="about.techSpec">${this._t('about.techSpec', '256×192 pixels, 32×24 attribute cells')}</span><br>
                <span data-i18n="about.colorSpec">${this._t('about.colorSpec', '16 colours (8 + 8 bright), 2 per cell')}</span>
            </p>
            <p class="about-meta" data-i18n="about.author" data-i18n-param-name="${author}">${this._t('about.author', 'Made by {name}', { name: author })}</p>
            <p class="about-meta" data-i18n="about.license">${this._t('about.license', 'Licensed under the GNU General Public License v3.0')}</p>
            <p class="about-meta" data-i18n="about.inspiration">${this._t('about.inspiration', 'Inspired by ZX Paintbrush by Claus Jahn')}</p>
            <p class="about-links"><a href="${repoUrl}" target="_blank" rel="noopener noreferrer">github.com/D0k-Soundwave/PixULA</a></p>
            <p class="about-meta" data-i18n="about.getInvolved">${this._t('about.getInvolved', 'Report a bug, suggest a feature, or contribute on GitHub')}</p>
        `;
        Dialog.open({
            id: 'about-dialog',
            titleI18n: 'dialog.about',
            title: 'About',
            content
        });
    }

    /** Public entry for the shortcuts dialog (F1 in the input handler). */
    showShortcuts() {
        this._showShortcuts();
    }

    /** @private */
    _showShortcuts() {
        const shortcuts = [
            ['Alt+N', this._t('app.new', 'New')],
            ['Ctrl+O', this._t('app.open', 'Load')],
            ['Ctrl+S', this._t('app.save', 'Save Project')],
            ['Ctrl+Z', this._t('app.undo', 'Undo')],
            ['Ctrl+Y', this._t('app.redo', 'Redo')],
            ['Ctrl+C / Ctrl+V / Ctrl+X', this._t('app.copy', 'Copy') + ' / ' + this._t('app.paste', 'Paste') + ' / ' + this._t('app.cut', 'Cut')]
        ];
        // Tool shortcuts come straight from the registry (single source)
        for (const group of TOOL_GROUPS) {
            for (const meta of group.tools) {
                if (meta.shortcut) shortcuts.push([meta.shortcut, this._t(meta.i18n, meta.id)]);
            }
        }
        shortcuts.push(['+/-', this._t('view.zoomIn', 'Zoom in') + '/' + this._t('view.zoomOut', 'Zoom out')]);
        // Bright, Flash and "use existing" - one list with the key handler
        for (const s of COLOUR_SHORTCUTS) shortcuts.push([s.keys, this._t(s.i18n, s.en)]);
        // ULAplus CLUT keys - one list with the key handler
        shortcuts.push([CLUT_SHORTCUTS.keys, this._t(CLUT_SHORTCUTS.i18n, CLUT_SHORTCUTS.en)]);
        shortcuts.push(['X / Y', this._t('help.axisLock', 'Hold while drawing: keep to a horizontal (X) or vertical (Y) line. Tap X: swap ink and paper')]);
        shortcuts.push(['Shift+C', this._t('menu.edit.cloneFigure', 'Clone Last Figure')]);
        // Inverse - one list with the key handler
        for (const s of MODE_SHORTCUTS) shortcuts.push([s.keys, this._t(s.i18n, s.en)]);
        // Preset recall — both the key range and the number in the description
        // are generated from the codec, so changing how many slots are keyed
        // cannot leave this row saying otherwise.
        shortcuts.push([`Alt+1...Alt+${PresetCodec.KEY_SLOTS}`,
                        this._t('preset.recallShortcut', 'Load preset 1-{n}')
                            .replace('{n}', String(PresetCodec.KEY_SLOTS))]);
        // The one mouse row: a modifier nobody can guess, in the only place
        // the app lists what the keys do.
        shortcuts.push([this._t('help.shiftRightClick', 'Shift+Right-click'),
                        this._t('help.canvasMenu', 'Canvas menu (cut, copy, paste, select)')]);

        const content = document.createElement('table');
        content.className = 'shortcuts-table';
        content.innerHTML = `<tbody>${
            shortcuts.map(([key, action]) =>
                `<tr><td><kbd>${Helpers.shortcutLabel(key)}</kbd></td><td>${action}</td></tr>`).join('')
        }</tbody>`;

        Dialog.open({
            id: 'shortcuts-dialog',
            titleI18n: 'help.shortcuts',
            title: 'Keyboard Shortcuts',
            content
        });
    }

    /** @private */
    _updateThemeToggles(activeTheme) {
        for (const id of ['dark', 'light', 'midnight', 'nord', 'dracula', 'sepia', 'crimson', 'citrus']) {
            this._updateToggleState(`theme-${id}`, activeTheme === id);
        }
    }

    /** @private */
    _updateMirrorToggles(mode) {
        const m = mode || (window.StateManager ? StateManager.getSymmetryMode() : 'off');
        this._updateToggleState('mirror-off', m === 'off');
        this._updateToggleState('mirror-h', m === 'h');
        this._updateToggleState('mirror-v', m === 'v');
        this._updateToggleState('mirror-both', m === 'quad');
    }

    /** @private */
    _setTheme(id) {
        if (window.ThemeManager) ThemeManager.setTheme(id);
        else EventBus.emit(EVENTS.UI_THEME_CHANGE, { theme: id });
    }

    /**
     * Enable or disable a menu item
     */
    setItemEnabled(itemId, enabled) {
        const item = this.element.querySelector(`[data-id="${itemId}"]`);
        if (!item) return;
        item.classList.toggle('disabled', !enabled);
        item.setAttribute('aria-disabled', String(!enabled));
    }

    /**
     * Set the checked state of a toggle menu item
     */
    setItemChecked(itemId, checked) {
        this._updateToggleState(itemId, checked);
    }

    /**
     * Destroy the menu system and cleanup event listeners
     */
    destroy() {
        if (this._boundDocClickHandler) {
            document.removeEventListener('click', this._boundDocClickHandler);
            this._boundDocClickHandler = null;
        }
        if (this._boundDocKeydownHandler) {
            document.removeEventListener('keydown', this._boundDocKeydownHandler);
            this._boundDocKeydownHandler = null;
        }
        this._closeAllMenus();
        this._initialized = false;
    }
}

window.MenuSystem = new MenuSystemClass();

Logger.debug('MenuSystem', 'Menu system module loaded');

})(); // End IIFE
