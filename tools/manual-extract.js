'use strict';
/**
 * manual-extract.js - read the whole app out of a RUNNING copy of it.
 *
 * `extractManualData` is handed to Playwright's `page.evaluate`, so it is
 * serialised to a string and executed inside the app's own page. Two
 * consequences shape everything below: it may close over NOTHING from Node
 * (every helper it uses is declared inside it), and it may return only
 * structured-cloneable data.
 *
 * Why read the live app rather than parse the source: every fact a manual
 * states about a tool, a menu, a screen mode or a format is already held in a
 * registry the app itself renders from, and several are only resolved at
 * runtime (i18n strings, a tool's live defaults, which export formats the
 * active mode allows). Parsing the source would reproduce that resolution
 * badly and then drift from it. Reading the running app cannot drift: if the
 * manual says a tool has an option, the app has that option.
 *
 * Everything here is READ-ONLY. The screenshot pass (tools/manual-shots.js) is
 * the part that drives the app.
 */

/**
 * @returns {Object} one JSON-cloneable object describing the whole app.
 *   Section shapes are documented at each builder below.
 */
function extractManualData() {
    // ---- tiny helpers (declared inside: this function is serialised) ----

    /** Translate, falling back to the key so a missing string is visible. */
    const t = (key, params) => {
        if (!key) return '';
        if (window.I18n && typeof I18n.t === 'function') {
            const out = I18n.t(key, params);
            return (out === undefined || out === null) ? key : String(out);
        }
        return key;
    };

    /** The name/description pair composed into a control's `title`. */
    const titleOf = (el) => {
        const raw = el.getAttribute('title') || '';
        if (window.Helpers && typeof Helpers.splitTitle === 'function') {
            return Helpers.splitTitle(raw);
        }
        return { name: raw, desc: '' };
    };

    const values = (registry) => Object.keys(registry || {}).map((k) => registry[k]);

    // ---- tools -----------------------------------------------------------

    /**
     * A schema row's `showIf` turned into a sentence, because "shown when Fill
     * attributes is off" is a manual and `{key, equals: false}` is not. Labels
     * come from the sibling row owning the key, so the prose uses the words on
     * screen rather than an internal key name.
     */
    const describeShowIf = (cond, schema) => {
        if (!cond) return '';
        const labelFor = (key) => {
            const row = schema.find((e) => e.key === key);
            return row && row.i18n ? t(row.i18n) : key;
        };
        const valueWord = (key, value) => {
            const row = schema.find((e) => e.key === key);
            if (typeof value === 'boolean') return value ? 'on' : 'off';
            // `options` is what the ROW offers; `presetOptions` is what the
            // setter really accepts, and a condition often names one of the
            // latter - the brush rows key off types the Round/Square select
            // does not list, because those are rail buttons. Consulting both
            // is what stops half these sentences quoting a raw internal id.
            for (const list of [row && row.options, row && row.presetOptions]) {
                if (!Array.isArray(list)) continue;
                const opt = list.find((o) => o.value === value);
                if (opt) {
                    return '"' + (opt.i18n ? t(opt.i18n)
                        : (opt.label === undefined ? opt.value : opt.label)) + '"';
                }
            }
            return '"' + String(value) + '"';
        };
        const one = (c) => {
            if (!c) return '';
            if (c.all) return c.all.map(one).filter(Boolean).join(' and ');
            if (c.any) return c.any.map(one).filter(Boolean).join(' or ');
            if (!c.key) return '';
            if ('equals' in c) return labelFor(c.key) + ' is ' + valueWord(c.key, c.equals);
            if (c.in) {
                return labelFor(c.key) + ' is ' +
                    c.in.map((v) => valueWord(c.key, v)).join(' or ');
            }
            if (c.notIn) {
                return labelFor(c.key) + ' is not ' +
                    c.notIn.map((v) => valueWord(c.key, v)).join(' or ');
            }
            if ('gt' in c) return labelFor(c.key) + ' is above ' + c.gt;
            return '';
        };
        return one(cond);
    };

    /** One schema row, resolved to what the options panel would show. */
    const readOption = (entry, schema, tool) => {
        // A `hint` row is prose the panel prints, with no key and no getter -
        // it is a sentence of documentation the app already shows the artist,
        // so the manual keeps it rather than dropping it as "not an option".
        if (!entry.key) {
            return {
                key: null,
                type: entry.type || 'hint',
                label: entry.i18n ? t(entry.i18n) : '',
                shownWhen: describeShowIf(entry.showIf, schema)
            };
        }
        const getter = 'get' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1);
        const live = (tool && typeof tool[getter] === 'function') ? tool[getter]() : undefined;
        const row = {
            key: entry.key,
            type: entry.type,
            label: entry.i18n ? t(entry.i18n) : entry.key,
            // The schema's `value` IS the default - see the tool-base contract.
            default: entry.value === undefined ? null : entry.value,
            current: (live === undefined || live === null || typeof live === 'object')
                ? null : live,
            shownWhen: describeShowIf(entry.showIf, schema),
            // A `dynamic` list is built at render time (installed system fonts,
            // say), so the manual names the mechanism rather than freezing one
            // machine's answer as though it were everybody's.
            dynamic: Boolean(entry.dynamic),
            inPresets: entry.preset !== false
        };
        if (entry.type === 'range') {
            row.min = entry.min;
            row.max = entry.max;
            row.step = entry.step === undefined ? 1 : entry.step;
            row.unit = entry.unit || '';
        }
        if (Array.isArray(entry.options)) {
            row.choices = entry.options.map((o) => ({
                value: o.value,
                label: o.i18n ? t(o.i18n) : (o.label === undefined ? String(o.value) : o.label),
                // A choice carrying `tool` is a TOOL SWITCH, not a value.
                switchesToTool: o.tool || null
            }));
        }
        if (entry.type === 'slot') row.slot = entry.slot || null;
        return row;
    };

    const readTools = () => {
        const out = [];
        for (const group of (window.TOOL_GROUPS || [])) {
            for (const meta of group.tools) {
                const tool = (window.ToolManager && ToolManager.getTool)
                    ? ToolManager.getTool(meta.id) : null;
                const schema = (tool && tool.constructor && tool.constructor.optionsSchema)
                    ? tool.constructor.optionsSchema : [];
                out.push({
                    id: meta.id,
                    group: group.id,
                    groupLabel: t(group.i18n || ('toolgroup.' + group.id)),
                    icon: meta.icon || null,
                    shortcut: meta.shortcut || null,
                    name: t(meta.i18n),
                    hint: meta.hintI18n ? t(meta.hintI18n) : '',
                    // A `variantOf` entry has no rail button of its own; it is
                    // reached from its parent tool's options.
                    variantOf: meta.variantOf || null,
                    options: schema.map((e) => readOption(e, schema, tool))
                });
            }
        }
        return out;
    };

    // ---- menus -----------------------------------------------------------

    /**
     * Walked from the RENDERED menu bar rather than the definition array,
     * which is a local const inside MenuSystem._buildMenus and unreachable
     * from here. The DOM is the better source anyway: it is what the user
     * sees, already localised.
     */
    const readMenuItems = (dropdown) => {
        const items = [];
        for (const el of dropdown.children) {
            if (el.classList.contains('menu-separator')) {
                items.push({ type: 'separator' });
                continue;
            }
            if (!el.classList.contains('menu-action')) continue;
            const label = el.querySelector(':scope > .menu-action-label');
            const shortcut = el.querySelector(':scope > .menu-shortcut');
            const sub = el.querySelector(':scope > .menu-submenu');
            items.push({
                id: el.getAttribute('data-id') || null,
                label: label ? label.textContent.trim() : el.textContent.trim(),
                shortcut: shortcut ? shortcut.textContent.trim() : null,
                action: el.getAttribute('data-action') || null,
                items: sub ? readMenuItems(sub) : null
            });
        }
        return items;
    };

    const readMenus = () => {
        const menus = [];
        for (const menu of document.querySelectorAll('.menu-item[data-menu]')) {
            const label = menu.querySelector('.menu-label');
            const dropdown = menu.querySelector('.menu-dropdown');
            menus.push({
                id: menu.getAttribute('data-menu'),
                label: label ? label.textContent.trim() : '',
                items: dropdown ? readMenuItems(dropdown) : []
            });
        }
        return menus;
    };

    // ---- screen modes ----------------------------------------------------

    /**
     * `Helpers.describeScreenMode` composes name, geometry, cell layout,
     * colour count and byte total from the descriptor itself, and is what both
     * of the app's own mode pickers show on hover. Splitting its lines here
     * keeps the manual and the tooltip saying the same thing by construction.
     */
    const readScreenModes = () => values(window.SCREEN_MODES).map((mode) => {
        const lines = (window.Helpers && Helpers.describeScreenMode)
            ? Helpers.describeScreenMode(mode).split('\n') : [];
        return {
            id: mode.id,
            name: lines[0] || t(mode.i18n),
            summary: lines[1] || '',
            palette: lines[2] || '',
            description: lines[3] || '',
            width: mode.width,
            height: mode.height,
            cellW: mode.attrCellW,
            cellH: mode.attrCellH,
            pixelDepth: mode.pixelDepth || 1,
            paletteModel: mode.paletteModel,
            fileSize: mode.fileSize,
            screens: mode.screens || 1
        };
    });

    // ---- formats ---------------------------------------------------------

    const readFormats = () => {
        const reg = window.FormatRegistry;
        if (!reg) return { import: [], export: [] };
        // Maps, not plain objects - handlers register themselves into
        // `importFormats`/`exportFormats` as they load.
        const importExts = Array.from((reg.importFormats || new Map()).keys()).sort();
        const exportExts = Array.from((reg.exportFormats || new Map()).keys()).sort();
        return {
            import: importExts.map((ext) => ({ ext, label: t('format.' + ext) })),
            export: exportExts.map((ext) => ({
                ext,
                label: t('format.' + ext),
                // Several formats are gated by the active screen mode. Record
                // that a gate exists, not this session's answer to it.
                gatedByMode: typeof reg.canExport === 'function' ? !reg.canExport(ext) : false
            }))
        };
    };

    // ---- drawing modes, pen, presets, patterns ---------------------------

    const readDrawModes = () => {
        const bar = document.getElementById('draw-modes');
        if (!bar) return [];
        const out = [];
        const seen = new Set();
        for (const el of bar.querySelectorAll('[title]')) {
            const { name, desc } = titleOf(el);
            if (!name || seen.has(name)) continue;
            seen.add(name);
            out.push({ id: el.getAttribute('data-draw-mode') || null, name, desc });
        }
        return out;
    };

    const readPen = () => ({
        controls: values(window.PEN_CONTROLS).map((c) => ({
            id: c.id, name: t(c.i18n), bit: c.bit, button: c.button
        })),
        actions: values(window.PEN_ACTIONS).map((a) => ({
            id: a.id, name: t(a.i18n), heldForWholeStroke: a.stroke === true
        })),
        profiles: values(window.PEN_PROFILES).map((p) => ({
            id: p.id,
            label: p.label || t(p.i18n),
            vendor: p.group || null,
            barrels: p.barrels,
            eraser: p.eraser === true,
            userDeclaresShape: p.custom === true,
            defaults: (window.PenMap && PenMap.defaultsFor) ? PenMap.defaultsFor(p.id) : {}
        }))
    });

    const readPresetSlices = () => {
        const svc = window.PresetService;
        if (!svc || !Array.isArray(svc.SLICES)) return [];
        return svc.SLICES.map((s) => ({
            id: s.id,
            name: s.i18n ? t(s.i18n) : s.id,
            description: s.descI18n ? t(s.descI18n) : ''
        }));
    };

    /**
     * The built-in library, grouped the two ways an artist actually asks about
     * it: how big does this tile repeat, and what kind of shading is it. Keys
     * are 'WxH/name' and each record carries `w`/`h` and a category `c`
     * (density, halftone, dither, hatch, lines, texture). The density ramp is
     * the spine of the library and its names state their real ink coverage -
     * tests/pattern-library.test.js fails the build if one of them lies.
     */
    const readPatterns = () => {
        const lib = window.PATTERN_BITMAPS;
        if (!lib) return { total: 0, bySize: {}, byCategory: {}, names: [] };
        const names = Object.keys(lib);
        const bySize = {};
        const byCategory = {};
        for (const key of names) {
            const p = lib[key];
            const size = (p.w || 8) + 'x' + (p.h || 8);
            bySize[size] = (bySize[size] || 0) + 1;
            const cat = p.c || 'other';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        }
        return {
            total: names.length,
            bySize,
            byCategory,
            names: names.map((key) => ({
                key,
                name: key.slice(key.indexOf('/') + 1),
                size: (lib[key].w || 8) + 'x' + (lib[key].h || 8),
                category: lib[key].c || 'other'
            }))
        };
    };

    // ---- every named control in the workspace ---------------------------

    /**
     * The name-and-description sweep. Every two-stage control in the app
     * carries a composed `title`, and tests/browser/tooltip.spec.js already
     * fails the build if any of those descriptions is missing or merely
     * repeats its own name - so this is a complete, ENFORCED inventory of
     * "what is this thing and what does it do", which is most of what a
     * reference chapter needs and none of which has to be written twice.
     */
    const readControls = () => {
        const areas = {
            toolRail: '#tool-rail',
            panels: '#panels',
            zoom: '#zoom-controls',
            grid: '#grid-controls',
            drawModes: '#draw-modes',
            transform: '#transform-panel',
            colourRail: '#color-rail',
            colourBar: '#color-bar',
            statusBar: '#status-bar'
        };
        const out = {};
        for (const key of Object.keys(areas)) {
            const seen = new Set();
            const rows = [];
            for (const area of document.querySelectorAll(areas[key])) {
                for (const el of area.querySelectorAll('[title]')) {
                    const { name, desc } = titleOf(el);
                    if (!name || !desc || seen.has(name)) continue;
                    seen.add(name);
                    rows.push({ name, desc });
                }
            }
            if (rows.length) out[key] = rows;
        }
        return out;
    };

    // ---- shortcuts -------------------------------------------------------

    const readShortcuts = (menus) => {
        const rows = [];
        for (const menu of menus) {
            const walk = (items) => {
                for (const item of items) {
                    if (item.shortcut) {
                        rows.push({ keys: item.shortcut, what: item.label, from: menu.label });
                    }
                    if (item.items) walk(item.items);
                }
            };
            walk(menu.items);
        }
        for (const group of (window.TOOL_GROUPS || [])) {
            for (const meta of group.tools) {
                if (meta.shortcut) {
                    rows.push({
                        keys: meta.shortcut,
                        what: t(meta.i18n),
                        from: t(group.i18n || ('toolgroup.' + group.id))
                    });
                }
            }
        }
        if (window.PresetCodec && PresetCodec.KEY_SLOTS) {
            rows.push({
                keys: 'Alt+1 ... Alt+' + PresetCodec.KEY_SLOTS,
                what: t('preset.recallShortcut', { n: PresetCodec.KEY_SLOTS }),
                from: t('dialog.presets')
            });
        }
        return rows;
    };

    // ---- the icon sprite -------------------------------------------------

    /** The app's own sprite, lifted whole so a manual icon IS the app's icon. */
    const readSprite = () => {
        const sprite = document.querySelector('svg.svg-sprite');
        return sprite ? sprite.innerHTML : '';
    };

    // ---- assemble --------------------------------------------------------

    const menus = readMenus();
    return {
        generatedFrom: {
            version: window.APP_VERSION || 'unknown',
            title: t('app.title'),
            locale: (window.I18n && I18n.getLocale) ? I18n.getLocale() : 'en'
        },
        tools: readTools(),
        menus,
        screenModes: readScreenModes(),
        formats: readFormats(),
        drawModes: readDrawModes(),
        pen: readPen(),
        presetSlices: readPresetSlices(),
        patterns: readPatterns(),
        controls: readControls(),
        shortcuts: readShortcuts(menus),
        sprite: readSprite()
    };
}

module.exports = { extractManualData };
