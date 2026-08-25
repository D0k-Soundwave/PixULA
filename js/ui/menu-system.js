'use strict';
(function() {

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
        // not a menu-reachable toggle. Presets is not here either — it has
        // its own showPresetsPanel-preference visibility, synced separately.
        this._PANEL_MENU_ITEM_BY_SECTION = {
            'reference-panel':    'panel-reference',
            'tool-options-panel': 'panel-tools',
            'layer-panel':        'panel-layers',
            'transform-panel':    'panel-transform'
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
        this._updateMirrorToggles();
        if (window.StateManager) this._updateToggleState('grid-snap', StateManager.getGridSnap());

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
     * Build the menu structure
     * @private
     */
    _buildMenus() {
        const menuDefinitions = [
            {
                id: 'file',
                label: 'File',
                items: [
                    { id: 'new', label: 'New', shortcut: 'Ctrl+N', action: 'file:new' },
                    { id: 'import', label: 'Load...', shortcut: 'Ctrl+O', action: 'file:import' },
                    { id: 'export', label: 'Save...', shortcut: 'Ctrl+E', action: 'file:export' },
                    { id: 'export-options', label: 'Export with Options...', action: 'file:exportOptions' },
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
                    { type: 'separator' },
                    { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', action: 'edit:cut' },
                    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', action: 'edit:copy' },
                    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', action: 'edit:paste' },
                    { id: 'delete', label: 'Delete', shortcut: 'Del', action: 'edit:delete' },
                    { type: 'separator' },
                    { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A', action: 'edit:selectAll' },
                    { id: 'deselect', label: 'Deselect', shortcut: 'Ctrl+D', action: 'edit:deselect' }
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
                    { id: 'grid', label: 'Show Grid', shortcut: 'G', action: 'view:toggleGrid', toggle: true },
                    { id: 'pixel-grid', label: 'Show Pixel Grid', action: 'view:togglePixelGrid', toggle: true },
                    { id: 'grid-snap', label: 'Snap', shortcut: 'Shift+S', action: 'view:toggleSnap', toggle: true, i18n: 'view.snap' },
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
                    { id: 'panel-presets', label: 'Tool Presets', action: 'view:toggleToolPresets', toggle: true, i18n: 'panels.presets' }
                ]
            },
            {
                id: 'layer',
                label: 'Layer',
                items: [
                    { id: 'layer-new', label: 'New Layer', shortcut: 'Ctrl+Shift+N', action: 'layer:new' },
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
                    // Screen modes (Phase 12a/13) live in their own flyout —
                    // 14 radio-style toggles is a wall in a flat dropdown.
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
                    { id: 'about', label: 'About', action: 'help:about' },
                    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: 'F1', action: 'help:shortcuts' }
                ]
            }
        ];

        let html = '';

        menuDefinitions.forEach(menu => {
            html += `
                <div class="menu-item" data-menu="${menu.id}">
                    <span class="menu-label" data-i18n="menu.${menu.id}">${menu.label}</span>
                    <div class="menu-dropdown" id="menu-${menu.id}">
                        ${this._buildMenuItems(menu.items)}
                    </div>
                </div>
            `;
        });

        this.element.innerHTML = html;
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
                return '<div class="menu-separator"></div>';
            }

            // A submenu parent carries `items` instead of `action` — its own
            // i18n key is mandatory (there is no action id to derive one from).
            if (item.items) {
                return `
                    <div class="menu-action menu-action--parent" data-id="${item.id}" aria-haspopup="true" aria-expanded="false">
                        <span class="menu-action-label" data-i18n="${item.i18n}">${item.label}</span>
                        <span class="menu-submenu-arrow" aria-hidden="true"></span>
                        <div class="menu-dropdown menu-submenu" id="menu-${item.id}">
                            ${this._buildMenuItems(item.items)}
                        </div>
                    </div>
                `;
            }

            const shortcutHtml = item.shortcut
                ? `<span class="menu-shortcut">${item.shortcut}</span>`
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

            return `
                <div class="menu-action${toggleClass}" data-action="${item.action}" data-id="${item.id}"${modeAttr}>
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
        };
        document.addEventListener('keydown', this._boundDocKeydownHandler);

        // Keep Edit menu item states in sync with selection/clipboard changes.
        // Short-circuits when state hasn't changed to avoid DOM churn per frame.
        this._lastHasSel  = false;
        this._lastHasClip = false;
        EventBus.on(EVENTS.CANVAS_RENDER, () => this._updateEditMenuState());

        // Keep View toggles in sync with grid facts
        EventBus.on(EVENTS.GRID_VISIBILITY, (state) => {
            this._updateToggleState('grid', !!state.cell);
            this._updateToggleState('pixel-grid', !!state.pixel);
        });

        EventBus.on(EVENTS.THEME_CHANGED, ({ theme }) => this._updateThemeToggles(theme));

        // Keep the Image-menu mode radios in sync with the mode fact
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => this._updateModeToggles());

        // Keep the View-menu Mirror radios and Snap toggle in sync with their
        // facts (both can also change from the canvas-controls rail).
        EventBus.on(EVENTS.SYMMETRY_CHANGED, ({ mode }) => this._updateMirrorToggles(mode));
        EventBus.on(EVENTS.GRID_SNAP_CHANGED, ({ snap }) => this._updateToggleState('grid-snap', !!snap));

        // Keep each View-menu panel checkbox in sync with PanelSection's own
        // visibility fact — fired on creation, on restore() resolving
        // persisted state, and on setVisible()/toggleVisibility() from
        // anywhere else, so the menu reflects reality on load and stays right
        // however the panel was added or removed (not only via this menu).
        EventBus.on(EVENTS.PANEL_VISIBILITY_CHANGED, ({ id, visible }) => {
            const itemId = this._PANEL_MENU_ITEM_BY_SECTION[id];
            if (itemId) this._updateToggleState(itemId, visible);
        });

        // Presets' whole-panel visibility rides on the showPresetsPanel
        // preference (also flipped from Preferences > General), not on
        // PanelSection — see the view:toggleToolPresets case above.
        EventBus.on(EVENTS.STATE_CHANGED, (data) => {
            if (data && data.path === 'showPresetsPanel') {
                this._updateToggleState('panel-presets', !!data.newValue);
            }
        });
        if (window.StateManager) {
            this._updateToggleState('panel-presets', StateManager.get('showPresetsPanel') === true);
        }
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

        if (menuId === 'edit') this._updateEditMenuState();
        if (menuId === 'view') this._updateViewMenuState();

        const menuItem = this.element.querySelector(`[data-menu="${menuId}"]`);
        const dropdown = this.element.querySelector(`#menu-${menuId}`);

        if (menuItem && dropdown) {
            menuItem.classList.add('active');
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
        this.element.querySelectorAll('.menu-action--parent').forEach(parent => {
            parent.setAttribute('aria-expanded', 'false');
        });
        this.activeMenu = null;
        this._menuOpen = false;
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
        switch (actionId) {
            // File
            case 'file:new':    FileManager.newFile();  break;
            case 'file:save':   FileManager.save();     break;
            case 'file:saveAs': FileManager.saveAs();   break;
            case 'file:export':
                // No native picker on this engine (Firefox, Safari) - the
                // format-select dialog is the only way to ask "which
                // format" at all there.
                if (typeof window.showSaveFilePicker === 'function') {
                    FileManager.exportViaNativePicker();
                } else {
                    this._showExportDialog();
                }
                break;
            case 'file:exportOptions': this._showExportDialog(); break;
            case 'file:loadProject': FileManager.loadProjectFile(); break;
            case 'file:loadPalette': PaletteEditorDialog.loadFromFile(); break;
            case 'file:savePalette': PaletteEditorDialog.saveToFile(); break;
            case 'file:createPalette': PaletteEditorDialog.create(); break;
            case 'file:import': FileManager.openFile(); break;
            case 'file:tapeBlocks': TapeBlockDialog.openForFile(); break;
            case 'file:mapEditor': MapEditorDialog.open(); break;
            case 'file:fontEditor': FontEditorDialog.open(); break;
            case 'file:spriteEditor': SpriteEditorDialog.open(); break;

            // Edit
            case 'edit:undo': UndoRedo.undo(); break;
            case 'edit:redo': UndoRedo.redo(); break;
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
            case 'view:toggleSnap':
                StateManager.setGridSnap(!StateManager.getGridSnap());
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
            case 'view:toggleToolOptions': PanelSection.toggleVisibility('tool-options-panel'); break;
            case 'view:toggleLayers':      PanelSection.toggleVisibility('layer-panel');        break;
            case 'view:toggleTransform':   PanelSection.toggleVisibility('transform-panel');    break;
            // Presets is not on PanelSection's visibility axis: its whole-panel
            // show/hide is already owned by the showPresetsPanel preference
            // (ToolPresetPanel._syncVisibility, also set from Preferences >
            // General), so the menu flips that same flag rather than layering
            // a second, competing visibility mechanism onto one panel.
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
            case 'image:flipH':       TransformService.flipHorizontal(); break;
            case 'image:flipV':       TransformService.flipVertical();   break;
            case 'image:rotate90cw':  TransformService.rotate90CW();     break;
            case 'image:rotate90ccw': TransformService.rotate90CCW();    break;
            case 'image:rotate180':   TransformService.rotate180();      break;
            case 'image:invert':      TransformService.invert();         break;
            case 'image:clear':       this._clearCanvas();               break;

            // Screen modes (Phase 12a)
            case 'image:modeStandardUla':   this.requestScreenMode('standard_ula');   break;
            case 'image:modeMulticolor8x4': this.requestScreenMode('multicolor_8x4'); break;
            case 'image:modeMulticolor8x2': this.requestScreenMode('multicolor_8x2'); break;
            case 'image:modeMulticolor8x1': this.requestScreenMode('multicolor_8x1'); break;
            case 'image:modeUlaPlus':       this.requestScreenMode('ula_plus');       break;
            case 'image:modeUlaPlus8x1':    this.requestScreenMode('ula_plus_8x1');   break;
            case 'image:modeTimexHires':    this.requestScreenMode('timex_hires');    break;
            case 'image:modeGigascreen':    this.requestScreenMode('gigascreen');     break;
            // ZX Spectrum Next modes (Phase 13)
            case 'image:modeUlanext':       this.requestScreenMode('ulanext');        break;
            case 'image:modeLayer2_256':    this.requestScreenMode('layer2_256');     break;
            case 'image:modeLayer2_320':    this.requestScreenMode('layer2_320');     break;
            case 'image:modeLayer2_640':    this.requestScreenMode('layer2_640');     break;
            case 'image:modeLores':         this.requestScreenMode('lores');          break;
            case 'image:modeLoresRadastan': this.requestScreenMode('lores_radastan'); break;
            case 'image:editPalette':       PaletteEditorDialog.open();               break;

            // Settings
            case 'settings:preferences': this._showPreferences(); break;
            case 'settings:presets': PresetDialog.open(); break;
            case 'settings:themeDark':     this._setTheme('dark');     break;
            case 'settings:themeLight':    this._setTheme('light');    break;
            case 'settings:themeMidnight': this._setTheme('midnight'); break;
            case 'settings:themeNord':     this._setTheme('nord');     break;
            case 'settings:themeDracula':  this._setTheme('dracula');  break;
            case 'settings:themeSepia':    this._setTheme('sepia');    break;
            case 'settings:themeCrimson':  this._setTheme('crimson');  break;
            case 'settings:themeCitrus':   this._setTheme('citrus');   break;
            case 'settings:resetAll':       this._resetAllPreferences();  break;

            // Help
            case 'help:about':     this._showAbout();     break;
            case 'help:shortcuts': this._showShortcuts(); break;

            default:
                Logger.warn('MenuSystem', `Unknown action: ${actionId}`);
        }
    }

    /**
     * Show export format dialog (Dialog component; the border picked here is a
     * one-off override for this export only — it must not change the document
     * border chosen via the left-rail Border dropdown).
     * @private
     */
    _showExportDialog() {
        // Mode-gated handlers (nxi/sl2 need an indexed mode, pal/npl an
        // editable palette) refuse with a localized message on OK.
        const formats = ['scr', 'zxp', 'mlt', 'ifl', 'hrg', 'img', 'nxi', 'sl2', 'slr', 'ctile',
            'tap', 'tzx', 'png', 'bmp', 'jpg', 'gif', 'zed', 'sev', 'pal', 'npl',
            'asm', 'c', 'bin', 'atr'];
        const borderNames = ['black', 'blue', 'red', 'magenta', 'green', 'cyan', 'yellow', 'white'];

        const content = document.createElement('div');
        content.className = 'export-dialog-body';
        content.innerHTML = `
            <label for="export-format" data-i18n="dialog.exportFormat">${this._t('dialog.exportFormat', 'Export format')}</label>
            <select id="export-format" class="dialog-select">
                ${formats.map(f => `<option value="${f}" data-i18n="format.${f}">${this._t('format.' + f, f.toUpperCase())}</option>`).join('')}
            </select>
            <div id="export-tape-options" hidden>
                <label for="export-border" data-i18n="dialog.borderColor">${this._t('dialog.borderColor', 'Border colour')}</label>
                <select id="export-border" class="dialog-select">
                    ${borderNames.map((name, idx) =>
                        `<option value="${idx}" data-i18n="color.${name}">${this._t('color.' + name, name.charAt(0).toUpperCase() + name.slice(1))}</option>`).join('')}
                </select>
            </div>
            <div id="export-gif-options" hidden>
                <label class="dialog-check-row">
                    <input type="checkbox" id="export-gif-animate">
                    <span data-i18n="dialog.gifAnimate">${this._t('dialog.gifAnimate', 'Animate FLASH cells (two-frame loop)')}</span>
                </label>
            </div>
        `;

        const formatSelect = content.querySelector('#export-format');
        const tapeOptions = content.querySelector('#export-tape-options');
        const borderSelect = content.querySelector('#export-border');
        const gifOptions = content.querySelector('#export-gif-options');
        const gifAnimate = content.querySelector('#export-gif-animate');

        borderSelect.value = String(ColorManager.getBorder());
        formatSelect.addEventListener('change', () => {
            const isTape = formatSelect.value === 'tap' || formatSelect.value === 'tzx';
            tapeOptions.hidden = !isTape;
            gifOptions.hidden = formatSelect.value !== 'gif';
        });

        Dialog.open({
            id: 'export-dialog',
            titleI18n: 'dialog.exportImage',
            title: 'Export Image',
            content,
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'app.export', label: 'Export', primary: true,
                    // async: exportAs() now opens a real native Save dialog
                    // (showSaveFilePicker) - keepOpen (returning false) is
                    // what stops this dialog closing out from under it before
                    // the artist has even chosen a location, and what leaves
                    // it open again if they cancelled the native one.
                    onClick: async () => {
                        const format = formatSelect.value;
                        const exportOptions = {};
                        if ((format === 'tap' || format === 'tzx') && borderSelect) {
                            exportOptions.border = parseInt(borderSelect.value, 10) || 0;
                        }
                        if (format === 'gif' && gifAnimate) {
                            exportOptions.animated = gifAnimate.checked;
                        }
                        const saved = await FileManager.exportAs(format, exportOptions);
                        return saved !== false;
                    }
                }
            ]
        });
    }

    /** @private */
    _updateToggleState(itemId, active) {
        const item = this.element.querySelector(`[data-id="${itemId}"]`);
        if (item) item.classList.toggle('checked', active);
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
            LayerManager.removeLayer(LayerManager.layers.length - 1, false);
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
    _showAbout() {
        const content = document.createElement('div');
        content.className = 'about-dialog-body';
        content.innerHTML = `
            <h2>PixULA</h2>
            <p data-i18n="about.subtitle">${this._t('about.subtitle', 'ZX Spectrum Pixel Art Editor')}</p>
            <p data-i18n="about.version">${this._t('about.version', 'Version 2.0.0')}</p>
            <p class="about-specs">
                <span data-i18n="about.techSpec">${this._t('about.techSpec', '256×192 pixels, 32×24 attribute cells')}</span><br>
                <span data-i18n="about.colorSpec">${this._t('about.colorSpec', '16 colours (8 + 8 bright), 2 per cell')}</span>
            </p>
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
            ['Ctrl+N', this._t('app.new', 'New')],
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
                `<tr><td><kbd>${key}</kbd></td><td>${action}</td></tr>`).join('')
        }</tbody>`;

        Dialog.open({
            id: 'shortcuts-dialog',
            titleI18n: 'help.shortcuts',
            title: 'Keyboard Shortcuts',
            content
        });
    }

    /** @private */
    _showPreferences() {
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
            <label class="pref-row">
                <input type="checkbox" id="pref-show-presets-panel" name="pref-show-presets-panel">
                <span data-i18n="pref.showPresetsPanel">${this._t('pref.showPresetsPanel', 'Show Presets panel in sidebar')}</span>
            </label>
            <div class="pref-block" id="pref-companion">
                <div class="pref-block__label" data-i18n="pref.companion">${this._t('pref.companion', 'Companion')}</div>
                <div class="pref-block__hint" data-i18n="pref.companionHint">${this._t('pref.companionHint', 'A small local program that gives the backup folder and reference photos prompt-free access, and the Font Editor real OS fonts. Optional - everything works without it.')}</div>
                <label class="pref-row">
                    <input type="checkbox" id="pref-companion-enabled" name="pref-companion-enabled">
                    <span data-i18n="pref.companionUse">${this._t('pref.companionUse', 'Use Companion')}</span>
                </label>
                <div class="pref-block__status" id="pref-companion-status"></div>
            </div>
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
        `;
        this._initPenPreferences(content);
        this._initCompanionPreferences(content);
        this._initBackupPreferences(content);
        this._initPrivacyPreferences(content);
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
        const showPresetsPanel = content.querySelector('#pref-show-presets-panel');
        if (showPresetsPanel) showPresetsPanel.checked = StateManager.get('showPresetsPanel') === true;
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
                    onClick: (dialog) => this._savePreferences(dialog)
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
     * Wire the Preferences Companion block: one switch that pairs (if
     * needed) and applies to every companion-capable feature at once -
     * Backup and Reference. System fonts need no wiring here:
     * FontEditorDialog already checks CompanionBridgeService.getProvider()
     * directly, so it starts working the instant this pairs, with no
     * separate flag of its own - this switch is what Backup/Reference get
     * to match that same always-available-once-paired behaviour, replacing
     * the two per-feature checkboxes (and the separate Settings >
     * Companion... dialog) an earlier pass built. Per-feature toggling
     * turned out to solve a problem nobody had: the companion, once paired,
     * is strictly more capable for every feature, so there was never a real
     * reason to want it on for one and off for another.
     *
     * The companion arms pairing automatically at launch (main.go) -
     * running the process is itself the proof a human is at the machine -
     * so the FIRST time this switch is turned on in a session, pair()
     * resolves immediately with no tray interaction needed. Turning it off
     * again does not drop the pairing itself (CompanionBridgeService keeps
     * its token) - it only routes Backup/Reference back to the browser, so
     * turning it back on later the same session is instant too.
     * @private
     */
    _initCompanionPreferences(root) {
        const block = root.querySelector('#pref-companion');
        if (!block) return;

        const enabled = block.querySelector('#pref-companion-enabled');
        const status = block.querySelector('#pref-companion-status');

        const render = () => {
            enabled.checked = BackupService.getProviderKind() === 'companion';
            status.textContent = enabled.checked
                ? this._t('pref.companionOn',
                    'On - the backup folder and reference photos use it.')
                : this._t('pref.companionOff', 'Off - everything uses the browser.');
        };

        // A folder/handle chosen under the OLD backend is meaningless to the
        // new one - BackupService._permission() trusts _providerKind alone
        // and would otherwise report "granted" for a handle the new backend
        // can't use. Forgetting the link (not the files) forces a fresh
        // Choose Folder under whichever backend is now active.
        const applyProviderKind = async (kind) => {
            if (BackupService.isConfigured) await BackupService.forgetFolder();
            BackupService.setProviderKind(kind);
            ReferenceLayerService.setProviderKind(kind);
        };

        enabled.addEventListener('change', async () => {
            if (!enabled.checked) {
                await applyProviderKind('browser');
                render();
                return;
            }

            if (!CompanionBridgeService.getProvider()) {
                status.textContent = this._t('pref.companionConnecting', 'Looking for the companion...');
                const running = await CompanionBridgeService.checkStatus();
                if (!running) {
                    enabled.checked = false;
                    status.textContent = this._t('pref.companionNotRunning',
                        'Companion not running - start it, then try again.');
                    return;
                }
                try {
                    await CompanionBridgeService.pair();
                } catch (error) {
                    Logger.warn('MenuSystem', 'Companion pairing failed', error);
                    enabled.checked = false;
                    status.textContent = this._t('pref.companionPairFailed',
                        'Could not pair with the companion.');
                    return;
                }
            }

            await applyProviderKind('companion');
            render();
        });

        render();
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
    _savePreferences(dialog) {
        const autosaveEl = dialog.querySelector('#pref-autosave-minutes');
        const defaultScreenModeEl = dialog.querySelector('#pref-default-screen-mode');
        const restoreOnBoot = dialog.querySelector('#pref-restore-on-boot');
        const confirmClear = dialog.querySelector('#pref-confirm-clear');
        const showPresetsPanel = dialog.querySelector('#pref-show-presets-panel');
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
        if (showPresetsPanel) StateManager.set('showPresetsPanel', showPresetsPanel.checked);
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
            showPresetsPanel: showPresetsPanel?.checked,
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

        Logger.info('MenuSystem', 'Preferences saved');
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

    /** @private */
    _resetAllPreferences() {
        if (confirm(this._t('msg.confirmResetAll', 'Reset all preferences to defaults and reload?'))) {
            if (window.ThemeManager) ThemeManager.setTheme('dark');
            StateManager.setAutosaveMinutes(StateManager.AUTOSAVE_DEFAULT_MINUTES);
            Logger.info('MenuSystem', 'All preferences reset');
            // Finish the async deletes before reloading so they aren't cut off
            Promise.allSettled([
                Storage.delete('preferences'),
                Storage.delete('theme'),
                Storage.delete('gridSnap'),
                Storage.delete('touchDrawing'),
                Storage.delete('panelCollapse', Storage.STORES.WINDOW_STATE),
                Storage.delete('panelVisibility', Storage.STORES.WINDOW_STATE),
                Storage.delete('panelOrder', Storage.STORES.WINDOW_STATE)
            ]).then(() => location.reload());
        }
    }

    /**
     * Enable or disable a menu item
     */
    setItemEnabled(itemId, enabled) {
        const item = this.element.querySelector(`[data-id="${itemId}"]`);
        if (item) item.classList.toggle('disabled', !enabled);
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
