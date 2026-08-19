'use strict';
(function() {

/**
 * OptionControls — the one renderer for tool option rows.
 *
 * Consumes each tool's `static optionsSchema` (contract documented in
 * js/tools/tool-base.js) and owns ALL option-row markup, wiring, slider
 * decoration and i18n attributes. Tools never build DOM; the old app's
 * 1,349-line hand-written tool-options.js is replaced by this renderer
 * plus the per-tool schemas (docs/REFACTOR_PLAN.md §2).
 *
 * Renders into #tool-options-content on EVENTS.TOOL_SELECTED.
 * Value changes go DOWN as direct setter calls (`set<Key>` / entry.setter);
 * the change fact goes UP as EVENTS.TOOL_OPTIONS.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Side of the box a shape icon is rastered into, in pixels. ODD on purpose:
 * the centred shapes put their centre at (size-1)/2 and their radius at the
 * same figure, and only an odd box makes both whole — an even one rounds the
 * two apart and clips a circle against the edge it should touch.
 */
const SHAPE_ICON_SIZE = 25;

/** English fallback until the i18n layer lands (Phase 6). */
function t(key, fallback) {
    if (window.I18n && typeof I18n.t === 'function') {
        const v = I18n.t(key);
        if (v && v !== key) return v;
    }
    if (fallback !== undefined) return fallback;
    // Derive a readable label from the key tail: 'opt.fadeLength' -> 'Fade Length'
    const tail = key.split('.').pop();
    return tail.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

class OptionControlsClass {
    constructor() {
        this.contentArea = null;
        this.titleElement = null;
        this.panelElement = null;
        this.currentToolId = null;
        this._rows = [];          // [{ entry, rowEl, inputEl }] for the current tool
        this._values = {};        // current option values by key
        this._dynamicToken = 0;   // race guard for async dynamic option loads
        this._syncOffs = [];      // unsubscribers for the current tool's syncEvent rows
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        // Own sidebar section, stamped from the tpl-panel template.
        const panel = PanelSection.create({
            id: 'tool-options-panel',
            titleI18n: 'panels.tools',
            title: 'Tool Options'
        });
        if (!panel) {
            Logger.error('OptionControls', 'Could not create tool options panel');
            return;
        }
        this.contentArea  = panel.content;
        this.titleElement = panel.title;
        this.panelElement = panel.section;

        EventBus.on(EVENTS.TOOL_SELECTED, (data) => this.showOptionsForTool(data.currentTool));

        // A tool preset writes straight through the setters, which is the same
        // path a slider drag takes and therefore emits nothing a row listens
        // for. Without this the values change and the controls go on showing
        // what they showed before — the one way a preset can appear not to
        // have worked while having worked perfectly.
        EventBus.on(EVENTS.TOOL_PRESET_APPLIED, (data) => {
            if (data && data.tool === this.currentToolId) this.showOptionsForTool(data.tool);
        });

        this._initialized = true;

        const current = ToolManager.getCurrentTool();
        if (current) this.showOptionsForTool(StateManager.getCurrentTool() || current.id);

        Logger.info('OptionControls', 'Initialized (schema renderer)');
    }

    /**
     * Render the options panel for a tool id (rail id — shape variants
     * resolve to the ShapeTool instance via ToolManager.getTool).
     * @param {string} toolId
     */
    showOptionsForTool(toolId) {
        if (!toolId || !this.contentArea) return;

        const tool = ToolManager.getTool(toolId);
        this.currentToolId = toolId;
        this._rows = [];
        this._values = {};
        this._dynamicToken++;
        this._disposeSyncRows();
        this.contentArea.textContent = '';

        const schema = tool && tool.constructor ? tool.constructor.optionsSchema : null;

        if (!tool || !schema || schema.length === 0) {
            const p = document.createElement('p');
            p.className = 'no-options';
            p.dataset.i18n = 'tools.noOptions';
            p.textContent = t('tools.noOptions', 'No options for this tool');
            this.contentArea.appendChild(p);
        } else {
            for (const entry of schema) {
                const row = this._buildRow(tool, entry);
                if (row) {
                    this.contentArea.appendChild(row);
                }
            }
            this._applyVisibility();
            this._resolveDynamicRows(tool);
            this._bindSyncRows(tool);
        }

        if (this.titleElement) {
            const meta = this._railMeta(toolId);
            this.titleElement.dataset.i18n = meta ? meta.i18n : `tool.${toolId}`;
            this.titleElement.textContent = t(this.titleElement.dataset.i18n, tool ? tool.name : toolId);
        }
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this.contentArea);
    }

    /** Find the TOOL_GROUPS entry for a rail id. @private */
    _railMeta(toolId) {
        return Helpers.toolRailMeta(toolId);
    }

    /** Current value of an option key (for showIf and external readers). */
    getOption(key) {
        return this._values[key];
    }

    // ── Row builders ─────────────────────────────────────────────────────────

    /** @private */
    _buildRow(tool, entry) {
        const row = document.createElement('div');
        row.className = 'tool-option';

        let inputEl = null;
        switch (entry.type) {
            case 'select':   inputEl = this._buildSelect(tool, entry, row);   break;
            case 'icons':    inputEl = this._buildIconGrid(tool, entry, row); break;
            case 'range':    inputEl = this._buildRange(tool, entry, row);    break;
            case 'check':    inputEl = this._buildCheck(tool, entry, row);    break;
            case 'textarea': inputEl = this._buildTextarea(tool, entry, row); break;
            case 'hint':     this._buildHint(entry, row);                     break;
            case 'slot':     this._buildSlot(entry, row);                     break;
            default:
                Logger.warn('OptionControls', `Unknown schema type: ${entry.type}`);
                return null;
        }

        this._rows.push({ entry, rowEl: row, inputEl });
        return row;
    }

    /** The tool-getter method name a schema entry's key reads from. @private */
    _getterName(entry) {
        return 'get' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1);
    }

    /** Initial value: tool getter wins over schema default. @private */
    _initialValue(tool, entry) {
        const getter = this._getterName(entry);
        const value = (typeof tool[getter] === 'function') ? tool[getter]() : entry.value;
        this._values[entry.key] = value;
        return value;
    }

    /** @private */
    _label(entry, forId) {
        const label = document.createElement('label');
        if (forId) label.htmlFor = forId;
        const span = document.createElement('span');
        span.dataset.i18n = entry.i18n;
        span.textContent = t(entry.i18n);
        label.appendChild(span);
        return label;
    }

    /** @private */
    _buildSelect(tool, entry, row) {
        const id = `opt-${entry.key}`;
        row.appendChild(this._label(entry, id));

        const select = document.createElement('select');
        select.id = id;
        select.name = entry.key;
        select.className = 'opt-input';
        select.dataset.option = entry.key;

        this._populateSelect(select, entry.options || []);

        const value = this._initialValue(tool, entry);
        if (value !== undefined) select.value = String(value);

        select.addEventListener('change', () => {
            this._commit(tool, entry, this._coerce(select.value, entry));
            // A select may control which entries a sibling dynamic list offers
            // (e.g. fontFamily -> textSize). Re-resolve dynamics on any select change.
            this._resolveDynamicRows(tool, entry.key);
        });

        row.appendChild(select);
        return select;
    }

    /**
     * Fill a select from schema entries: { value, i18n | label } or optgroups
     * { i18n, options: [...] }. @private
     */
    _populateSelect(select, options) {
        select.textContent = '';
        for (const opt of options) {
            if (opt && Array.isArray(opt.options)) {
                const group = document.createElement('optgroup');
                group.label = t(opt.i18n, opt.label);
                if (opt.i18n) group.dataset.i18nLabel = opt.i18n;
                for (const sub of opt.options) group.appendChild(this._optionEl(sub));
                select.appendChild(group);
            } else {
                select.appendChild(this._optionEl(opt));
            }
        }
    }

    /** @private */
    _optionEl(opt) {
        const el = document.createElement('option');
        el.value = String(opt.value);
        if (opt.i18n) {
            el.dataset.i18n = opt.i18n;
            el.textContent = t(opt.i18n, opt.label);
        } else {
            el.textContent = opt.label !== undefined ? opt.label : String(opt.value);
        }
        return el;
    }

    /**
     * A grid of icon buttons — the same control as a `select`, laid out like
     * the tool rail. Used where the choice IS a picture (the shape list): a
     * dropdown of thirty words makes you read and remember names for things
     * you would recognise instantly, and hides all but one of them until you
     * open it. Optgroups become printed headings, exactly as the rail's groups
     * do, and each button carries a composed title so the hover tag names it.
     *
     * The picture is the shape's OWN raster (ShapeGenerator.iconRaster) drawn
     * at its default parameters, not a hand-drawn glyph, so a button cannot
     * come to disagree with what the tool draws. `icon` on an option overrides
     * it with a sprite symbol, for entries that are not shapes at all (the
     * bezier curve, which is a tool).
     * @private
     */
    _buildIconGrid(tool, entry, row) {
        row.classList.add('tool-option-icons');
        const label = this._label(entry);
        label.id = `opt-${entry.key}-label`;
        row.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'opt-icon-grid';
        grid.setAttribute('role', 'group');
        // The printed label names the group for screen readers too — one
        // string for both, the rail's rule (aria-labelledby, not a copy).
        grid.setAttribute('aria-labelledby', label.id);

        const current = this._initialValue(tool, entry);
        const buttons = [];

        const addOption = (opt) => {
            const btn = this._buildIconButton(tool, entry, opt, current);
            buttons.push(btn);
            grid.appendChild(btn);
        };

        for (const opt of entry.options || []) {
            if (opt && Array.isArray(opt.options)) {
                const heading = document.createElement('h3');
                heading.className = 'opt-icon-group-label';
                if (opt.i18n) heading.dataset.i18n = opt.i18n;
                heading.textContent = t(opt.i18n, opt.label);
                grid.appendChild(heading);
                opt.options.forEach(addOption);
            } else if (opt) {
                addOption(opt);
            }
        }

        // Clicks land on the buttons; this one listener keeps the lit state in
        // step with the value the panel holds.
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn || !grid.contains(btn)) return;
            const value = this._coerce(btn.dataset.value, entry);
            for (const other of buttons) {
                const on = other === btn;
                other.classList.toggle('active', on);
                other.setAttribute('aria-pressed', String(on));
            }
            this._commit(tool, entry, value);
        });

        row.appendChild(grid);
        return grid;
    }

    /** One shape button: its picture, its name, its lit state. @private */
    _buildIconButton(tool, entry, opt, current) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.value = String(opt.value);

        const name = t(opt.i18n, opt.label !== undefined ? opt.label : String(opt.value));
        // Same attributes the rail's buttons carry, so I18n recomposes the
        // title on a locale change and TooltipManager raises the name tag.
        if (opt.i18n) {
            btn.dataset.i18nTitleName = opt.i18n;
            btn.dataset.i18nAriaLabel = opt.i18n;
        }
        btn.title = Helpers.composeTitle(name, '', '');
        btn.setAttribute('aria-label', name);

        const on = String(opt.value) === String(current);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));

        btn.appendChild(opt.icon ? this._spriteIcon(opt.icon) : this._shapeIcon(opt.value));
        return btn;
    }

    /** @private */
    _spriteIcon(id) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('tool-icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttribute('href', `#${id}`);
        svg.appendChild(use);
        return svg;
    }

    /** The shape drawn as itself, in pixels. @private */
    _shapeIcon(shapeType) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('tool-icon', 'shape-icon');
        svg.setAttribute('viewBox', `0 0 ${SHAPE_ICON_SIZE} ${SHAPE_ICON_SIZE}`);
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('aria-hidden', 'true');

        const path = document.createElementNS(SVG_NS, 'path');
        const pixels = (window.ShapeGenerator && typeof ShapeGenerator.iconRaster === 'function')
            ? ShapeGenerator.iconRaster(shapeType, SHAPE_ICON_SIZE)
            : [];
        path.setAttribute('d', Helpers.pixelsToPath(pixels));
        path.setAttribute('fill', 'currentColor');
        svg.appendChild(path);
        return svg;
    }

    /** @private */
    _buildRange(tool, entry, row) {
        const id = `opt-${entry.key}`;

        const label = this._label(entry, id);
        const valueEl = document.createElement('span');
        valueEl.className = 'opt-value';
        const unit = entry.unit || '';
        label.appendChild(document.createTextNode(': '));
        label.appendChild(valueEl);
        row.appendChild(label);

        const range = document.createElement('input');
        range.type = 'range';
        range.id = id;
        range.name = entry.key;
        range.className = 'opt-input';
        range.dataset.option = entry.key;
        if (entry.min  !== undefined) range.min  = String(entry.min);
        if (entry.max  !== undefined) range.max  = String(entry.max);
        if (entry.step !== undefined) range.step = String(entry.step);

        const value = this._initialValue(tool, entry);
        range.value = String(value !== undefined ? value : (entry.min || 0));
        valueEl.textContent = `${range.value}${unit}`;

        range.addEventListener('input', () => {
            valueEl.textContent = `${range.value}${unit}`;
            this._commit(tool, entry, parseFloat(range.value));
            // A setter may snap the dragged value elsewhere (e.g. a brush
            // size excluded for a poor round shape) - re-read the tool so
            // the slider and label show what actually took effect, not a
            // number the drag passed through but the tool rejected.
            const getter = this._getterName(entry);
            if (typeof tool[getter] === 'function') {
                const actual = tool[getter]();
                if (actual !== undefined && String(actual) !== range.value) {
                    range.value = String(actual);
                    valueEl.textContent = `${actual}${unit}`;
                }
            }
        });

        row.appendChild(range);
        this._decorateSlider(range);
        return range;
    }

    /** @private */
    _buildCheck(tool, entry, row) {
        const label = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.id = `opt-${entry.key}`;
        check.name = entry.key;
        check.className = 'opt-input';
        check.dataset.option = entry.key;
        check.checked = !!this._initialValue(tool, entry);

        check.addEventListener('change', () => {
            this._commit(tool, entry, check.checked);
        });

        const span = document.createElement('span');
        span.dataset.i18n = entry.i18n;
        span.textContent = t(entry.i18n);

        label.appendChild(check);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(span);
        row.appendChild(label);
        return check;
    }

    /** @private */
    _buildTextarea(tool, entry, row) {
        const id = `opt-${entry.key}`;
        row.appendChild(this._label(entry, id));

        const ta = document.createElement('textarea');
        ta.id = id;
        ta.className = 'opt-textarea';
        ta.dataset.option = entry.key;
        ta.rows = entry.rows || 3;
        if (entry.placeholderI18n) {
            ta.dataset.i18nPlaceholder = entry.placeholderI18n;
            ta.placeholder = t(entry.placeholderI18n, 'Type text here…');
        }
        const value = this._initialValue(tool, entry);
        ta.value = value !== undefined ? String(value) : '';

        ta.addEventListener('input', () => {
            this._commit(tool, entry, ta.value);
        });

        row.appendChild(ta);
        return ta;
    }

    /** @private */
    _buildHint(entry, row) {
        row.classList.add('tool-option-hint');
        row.dataset.i18n = entry.i18n;
        row.textContent = t(entry.i18n, '');
    }

    /**
     * Named slot another component renders into. (The pattern browser is no
     * longer a slot — it owns the dedicated Patterns panel; see PatternPanel.)
     * @private
     */
    _buildSlot(entry, row) {
        row.classList.add('tool-option-slot');
        const slot = document.createElement('div');
        slot.dataset.slot = entry.slot;
        row.appendChild(slot);
    }

    // ── Value plumbing ───────────────────────────────────────────────────────

    /** Coerce a select's string value back to its schema type. @private */
    _coerce(raw, entry) {
        const sample = this._sampleOptionValue(entry);
        if (typeof sample === 'number') {
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : raw;
        }
        if (typeof sample === 'boolean') return raw === 'true';
        return raw;
    }

    /** @private */
    _sampleOptionValue(entry) {
        const opts = entry.options || [];
        for (const opt of opts) {
            if (opt && Array.isArray(opt.options)) {
                if (opt.options.length) return opt.options[0].value;
            } else if (opt) {
                return opt.value;
            }
        }
        return undefined;
    }

    /** The chosen option object, looked up through optgroups. @private */
    _findOption(entry, value) {
        for (const opt of entry.options || []) {
            if (opt && Array.isArray(opt.options)) {
                const hit = opt.options.find((o) => o && o.value === value);
                if (hit) return hit;
            } else if (opt && opt.value === value) {
                return opt;
            }
        }
        return null;
    }

    /**
     * Apply a changed value to the tool (command down) and announce the fact.
     * @private
     */
    _commit(tool, entry, value) {
        // An option may name another TOOL rather than a setting. Two levels say
        // so: the ENTRY's `tool` is the list's home tool (the shape list belongs
        // to Shape), and an option may override it with its own (the bezier
        // curve inside that list). Either way the choice lands on a different
        // tool INSTANCE, so it is a tool switch — and the value is carried onto
        // that tool FIRST, because the rebuilt panel reads its getter. That is
        // what makes "pick Circle while the curve tool is up" arrive at a
        // circle instead of merely leaving the curve behind. Selecting rebuilds
        // this panel from the new tool's schema, so there is no option fact of
        // ours left to announce.
        const chosen = this._findOption(entry, value);
        const targetId = (chosen && chosen.tool) || entry.tool;
        const target = targetId ? ToolManager.getTool(targetId) : null;
        if (target && target !== tool && targetId !== this.currentToolId) {
            this._applyValue(target, entry, value);
            ToolManager.selectTool(targetId);
            return;
        }

        this._values[entry.key] = value;
        this._applyValue(tool, entry, value);

        this._applyVisibility();

        EventBus.emit(EVENTS.TOOL_OPTIONS, {
            tool: this.currentToolId,
            option: entry.key,
            value,
            options: { ...this._values }
        });
    }

    /** Push one option value down to a tool via its setter. @private */
    _applyValue(tool, entry, value) {
        const setterName = entry.setter ||
            ('set' + entry.key.charAt(0).toUpperCase() + entry.key.slice(1));
        if (typeof tool[setterName] === 'function') {
            tool[setterName](value);
        } else {
            Logger.warn('OptionControls', `${tool.id} has no setter ${setterName}`);
        }
    }

    /** Re-evaluate every row's showIf against current values. @private */
    _applyVisibility() {
        for (const { entry, rowEl } of this._rows) {
            if (!entry.showIf) continue;
            rowEl.hidden = !this._evalShowIf(entry.showIf);
        }
    }

    /**
     * Evaluate a showIf condition against current option values. Leaf forms:
     * { key, equals } | { key, in } | { key, notIn } | { key, gt }. Compound
     * forms: { any: [cond…] } (OR) and { all: [cond…] } (AND), nestable.
     * @private
     */
    _evalShowIf(cond) {
        if (Array.isArray(cond.any)) return cond.any.some(c => this._evalShowIf(c));
        if (Array.isArray(cond.all)) return cond.all.every(c => this._evalShowIf(c));
        const actual = this._values[cond.key];
        if ('equals' in cond) return actual === cond.equals;
        if ('in' in cond)     return cond.in.includes(actual);
        if ('notIn' in cond)  return !cond.notIn.includes(actual);
        if ('gt' in cond)     return Number(actual) > cond.gt;
        return true;
    }

    /**
     * Rows with `syncEvent` re-read their tool getter whenever that fact
     * fires, so the control tracks state changed outside the panel (e.g. the
     * zoom select following EVENTS.CANVAS_ZOOM). Subscriptions live only as
     * long as the current render — _disposeSyncRows drops them before the
     * next tool's rows are built. @private
     */
    _bindSyncRows(tool) {
        for (const { entry, inputEl } of this._rows) {
            if (!entry.syncEvent || !inputEl) continue;
            const getter = this._getterName(entry);
            if (typeof tool[getter] !== 'function') {
                Logger.warn('OptionControls', `${tool.id}: syncEvent on '${entry.key}' needs a ${getter}() getter`);
                continue;
            }
            this._syncOffs.push(EventBus.on(entry.syncEvent, () => {
                const value = this._initialValue(tool, entry);
                if (value === undefined) return;
                if (inputEl.type === 'checkbox') inputEl.checked = !!value;
                else inputEl.value = String(value);
                this._applyVisibility();
            }));
        }
    }

    /** @private */
    _disposeSyncRows() {
        for (const off of this._syncOffs) off();
        this._syncOffs = [];
    }

    // ── Dynamic (async) select options ──────────────────────────────────────

    /**
     * Resolve every `dynamic` select for the current tool. Invokes the named
     * async tool method with no arguments; the result replaces the option
     * list (entries matching a static option's value keep its label/i18n).
     * Race-guarded: a newer tool switch or re-resolve invalidates the result.
     * @param {ToolBase} tool
     * @param {string} [changedKey] - skip the row that caused the change
     * @private
     */
    _resolveDynamicRows(tool, changedKey) {
        const token = ++this._dynamicToken;

        for (const { entry, inputEl } of this._rows) {
            if (!entry.dynamic || entry.type !== 'select') continue;
            if (entry.key === changedKey) continue;
            if (typeof tool[entry.dynamic] !== 'function') continue;

            const select = inputEl;
            const previous = this._values[entry.key];
            select.disabled = true;

            Promise.resolve(tool[entry.dynamic]()).then((result) => {
                if (token !== this._dynamicToken || !result || !result.length) {
                    select.disabled = false;
                    return;
                }

                // Preserve static labels for values that exist in the schema
                const staticByValue = new Map();
                for (const opt of (entry.options || [])) {
                    if (opt && !Array.isArray(opt.options)) staticByValue.set(String(opt.value), opt);
                }
                const options = result.map((item) => {
                    if (item && typeof item === 'object' && 'value' in item) return item;
                    return staticByValue.get(String(item)) || { value: item, label: String(item) };
                });

                this._populateSelect(select, options);
                select.disabled = false;

                // Restore previous value, else snap to the closest numeric or first entry
                const values = options.map((o) => o.value);
                let next = values.find((v) => String(v) === String(previous));
                if (next === undefined) {
                    if (typeof previous === 'number' && typeof values[0] === 'number') {
                        next = values.reduce((best, v) =>
                            Math.abs(v - previous) < Math.abs(best - previous) ? v : best, values[0]);
                    } else {
                        next = values[0];
                    }
                }
                select.value = String(next);
                if (String(next) !== String(previous)) {
                    this._commit(tool, entry, next);
                }
                if (window.I18n && typeof I18n.apply === 'function') I18n.apply(select);
            }).catch((err) => {
                select.disabled = false;
                Logger.warn('OptionControls', `dynamic ${entry.dynamic} failed`, err);
            });
        }
    }

    // ── Slider decoration (shared) ───────────────────────────────────────────

    /**
     * Decorate every range input inside `root` with a number-input + (−/+)
     * step buttons. Existing listeners keep firing via synthetic input/change
     * events. Idempotent. Public: the Transform panel reuses it.
     * @param {HTMLElement} root
     */
    decorateSliders(root) {
        if (!root) return;
        root.querySelectorAll('input[type="range"]').forEach((r) => this._decorateSlider(r));
    }

    /** @private */
    _decorateSlider(range) {
        if (range.dataset.sliderDecorated === '1') return;
        range.dataset.sliderDecorated = '1';

        const min = parseFloat(range.min) || 0;
        const max = range.max !== '' ? parseFloat(range.max) : 100;
        // A native range input re-validates its OWN value against its step
        // on every assignment (and re-validates again the moment the step
        // attribute itself changes back, which rules out toggling step to
        // bypass it) - so a nudge that isn't a multiple of the element's own
        // step, from its own min, is silently snapped back to where it
        // started. Stepping by the element's real granularity keeps every
        // nudge legal instead of fighting that browser behaviour.
        const step = parseFloat(range.step) || 1;
        const fmt = (v) => String(Math.round(v));

        const rowEl = document.createElement('div');
        rowEl.className = 'slider-row';
        range.parentNode.insertBefore(rowEl, range);
        rowEl.appendChild(range);

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'slider-step slider-step-minus';
        minusBtn.textContent = '−';
        minusBtn.setAttribute('aria-label', t('a11y.decrease', 'Decrease'));

        const num = document.createElement('input');
        num.type = 'number';
        num.className = 'slider-num';
        num.min = String(min);
        num.max = String(max);
        num.step = '1';
        num.value = fmt(parseFloat(range.value) || 0);

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'slider-step slider-step-plus';
        plusBtn.textContent = '+';
        plusBtn.setAttribute('aria-label', t('a11y.increase', 'Increase'));

        rowEl.appendChild(minusBtn);
        rowEl.appendChild(num);
        rowEl.appendChild(plusBtn);

        // Intercept programmatic `range.value = X` so the number input stays in
        // sync with code paths that reset/sync sliders without firing events.
        const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(range, 'value', {
            configurable: true,
            get() { return valueDesc.get.call(this); },
            set(v) {
                valueDesc.set.call(this, v);
                const cur = parseFloat(valueDesc.get.call(this));
                num.value = Number.isFinite(cur) ? fmt(cur) : valueDesc.get.call(this);
            }
        });

        // User drag/wheel updates the value internally without the JS setter —
        // mirror it into the number input on every event.
        const syncNum = () => {
            const cur = parseFloat(valueDesc.get.call(range));
            if (Number.isFinite(cur)) num.value = fmt(cur);
        };
        range.addEventListener('input', syncNum);
        range.addEventListener('change', syncNum);

        const fireInput  = () => range.dispatchEvent(new Event('input',  { bubbles: true }));
        const fireChange = () => range.dispatchEvent(new Event('change', { bubbles: true }));

        const setValue = (v, { commit = true } = {}) => {
            if (!Number.isFinite(v)) v = parseFloat(range.value) || 0;
            v = clamp(Math.round(v), min, max);
            range.value = String(v); // overridden setter syncs num
            fireInput();
            if (commit) fireChange();
        };

        const commitNum = () => setValue(parseFloat(num.value));
        num.addEventListener('change', commitNum);
        num.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitNum(); num.blur(); }
        });

        // +/- by the slider's own step (1 where none is set)
        minusBtn.addEventListener('click', () => setValue((parseFloat(range.value) || 0) - step));
        plusBtn.addEventListener('click',  () => setValue((parseFloat(range.value) || 0) + step));
    }
}

window.OptionControls = new OptionControlsClass();

Logger.debug('OptionControls', 'Option controls renderer loaded');

})(); // End IIFE
