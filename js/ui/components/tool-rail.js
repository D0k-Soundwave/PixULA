'use strict';
(function() {

/**
 * ToolRail — the left tool rail, generated from the TOOL_GROUPS registry
 * (constants.js). One button per registry entry: the sprite icon, the registry
 * label as its accessible name, and a title carrying name + shortcut +
 * description for the hover tag (TooltipManager). Replaces the old app's 12
 * hand-written buttons and the Phase-3 temporary rail.
 *
 * Commands go down (ToolManager.selectTool on click); the active state
 * renders from the EVENTS.TOOL_SELECTED fact. The rail also applies the
 * selected tool's cursor to the canvas on that same event.
 */

// Rail ids that light the 'shape' umbrella button — the ShapeTool variants and
// the bezier curve, which is picked from the same Shape option list.
const SHAPE_VARIANT_IDS = new Set([
    'shape', TOOLS.LINE, TOOLS.RECTANGLE, TOOLS.ROUNDED_RECTANGLE,
    TOOLS.PARALLELOGRAM, TOOLS.CIRCLE, TOOLS.ELLIPSE,
    TOOLS.TRIANGLE, TOOLS.POLYGON, TOOLS.STAR, TOOLS.BEZIER
]);

class ToolRailClass {
    constructor() {
        this._host = null;
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        this._host = document.getElementById('tool-rail');
        if (!this._host) {
            Logger.error('ToolRail', '#tool-rail not found');
            return;
        }

        this._build();

        EventBus.on(EVENTS.TOOL_SELECTED, (data) => this._sync(data.currentTool));
        this._sync(StateManager.getCurrentTool());

        // Undo/redo buttons enable from the history facts (StateManager paths
        // written by UndoRedo._updateState). The click path is focus-agnostic,
        // so undo/redo always work even if a hotkey is swallowed elsewhere.
        EventBus.on(EVENTS.STATE_CHANGED, (data) => {
            if (data.path === 'history.canUndo') this._setActionEnabled('undo', data.newValue);
            else if (data.path === 'history.canRedo') this._setActionEnabled('redo', data.newValue);
        });
        this._setActionEnabled('undo', !!StateManager.get('history.canUndo'));
        this._setActionEnabled('redo', !!StateManager.get('history.canRedo'));

        Logger.info('ToolRail', 'Initialized from TOOL_GROUPS registry');
    }

    /**
     * Build one group shell: a printed heading spanning both columns, and the
     * grid the buttons go into. The heading IS the group's accessible name
     * (aria-labelledby, not a duplicate aria-label), so screen readers and eyes
     * are told the same thing from the same string.
     * @private
     */
    _buildGroupShell(id, i18nKey, fallback, extraClass) {
        const groupEl = document.createElement('div');
        groupEl.className = extraClass ? `tool-group ${extraClass}` : 'tool-group';
        groupEl.setAttribute('role', 'group');
        groupEl.dataset.group = id;

        const label = document.createElement('h2');
        label.className = 'tool-group-label';
        label.id = `tool-group-${id}`;
        label.dataset.i18n = i18nKey;
        label.textContent = this._t(i18nKey, fallback);
        groupEl.setAttribute('aria-labelledby', label.id);
        groupEl.appendChild(label);

        return groupEl;
    }

    /** @private */
    _build() {
        this._host.appendChild(this._buildActionGroup());
        for (const group of TOOL_GROUPS) {
            const groupEl = this._buildGroupShell(group.id, group.i18n, group.id);

            for (const meta of group.tools) {
                // A `variantOf` tool is reached from its parent's options
                // (bezier from the Shape list), so it gets no button here.
                if (meta.variantOf) continue;
                groupEl.appendChild(this._buildButton(meta));
            }
            this._host.appendChild(groupEl);

            // The drawing guide sits directly under the selection modes: it is
            // powered BY the selection, and when it lived in the status strip
            // that relationship was invisible — you could arm it with nothing
            // selected and it silently did nothing.
            if (group.id === 'select') this._host.appendChild(this._buildGuideGroup());
        }
    }

    /**
     * Drawing-guide toggles — a mode, not a tool, so (like undo/redo) they sit
     * outside the TOOL_GROUPS loop and never take the tool `active` state.
     * Exclusive: clicking the armed one turns the guide off. Commands go down
     * to StateManager; the pressed state renders from the CLIP_CHANGED fact.
     * @private
     */
    _buildGuideGroup() {
        const groupEl = this._buildGroupShell('guide', 'view.clip', 'Guide', 'tool-guide');

        const defs = [
            { mode: 'inside',  icon: 'icon-guide-in',  i18n: 'view.clip.inside',
              hint: 'view.clip.inside.hint' },
            { mode: 'outside', icon: 'icon-guide-out', i18n: 'view.clip.outside',
              hint: 'view.clip.outside.hint' }
        ];

        const buttons = new Map();
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-btn';
            btn.id = `clip-${def.mode}-toggle`;
            btn.dataset.guide = def.mode;
            // The rail paints its lit state from .active (css/components.css);
            // aria-pressed alone is invisible.
            const armed = StateManager.getClipMode() === def.mode;
            btn.classList.toggle('active', armed);
            btn.setAttribute('aria-pressed', String(armed));

            this._dressIconButton(btn, {
                icon: def.icon,
                nameKey: def.i18n, nameFallback: def.mode,
                hintKey: def.hint
            });

            btn.addEventListener('click', () => {
                StateManager.setClipMode(
                    StateManager.getClipMode() === def.mode ? 'off' : def.mode);
            });

            groupEl.appendChild(btn);
            buttons.set(def.mode, btn);
        }

        EventBus.on(EVENTS.CLIP_CHANGED, (data) => {
            for (const [mode, btn] of buttons) {
                const on = data.mode === mode;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-pressed', String(on));
            }
            Storage.set('clipMode', data.mode).catch(() => {});
        });

        return groupEl;
    }

    /**
     * The Undo/Redo action group — history commands, not tools, so they live
     * outside the TOOL_GROUPS loop and never carry a tool `active` state.
     * @private
     */
    _buildActionGroup() {
        const groupEl = this._buildGroupShell('history', 'toolgroup.history', 'History', 'tool-actions');
        groupEl.appendChild(this._buildActionButton(
            'undo', 'icon-undo', 'app.undo', 'Ctrl+Z', () => UndoRedo.undo()));
        groupEl.appendChild(this._buildActionButton(
            'redo', 'icon-redo', 'app.redo', 'Ctrl+Y', () => UndoRedo.redo()));
        return groupEl;
    }

    /**
     * Give a rail button its icon, its accessible name and its tooltip, and
     * return the element to append. ONE place, so every rail button is dressed
     * identically.
     *
     * The rail prints no captions: 24 controls each carrying a keyword made a
     * column of text with icons in it, and a keyword is a poor name anyway
     * ("Cells", "Creator"). The name now arrives on hover as a tag, and what
     * the tool is FOR arrives a moment later — see js/ui/tooltip-manager.js.
     * The title is composed from these attributes, so I18n recomposes it on a
     * locale change and the tooltip re-splits it.
     * @private
     */
    _dressIconButton(btn, { icon, nameKey, nameFallback, hintKey, shortcut }) {
        const name = this._t(nameKey, nameFallback);
        btn.dataset.i18nTitleName = nameKey;
        if (shortcut) btn.dataset.shortcut = shortcut;
        if (hintKey) btn.dataset.i18nTitle = hintKey;
        btn.title = Helpers.composeTitle(name, hintKey ? this._t(hintKey, '') : '', shortcut);

        // The button holds only the icon, so it needs its name spelled out for
        // assistive tech — the hover tag is pointer-only.
        btn.dataset.i18nAriaLabel = nameKey;
        btn.setAttribute('aria-label', name);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('tool-icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${icon}`);
        svg.appendChild(use);
        btn.appendChild(svg);

        return btn;
    }

    /** @private */
    _buildActionButton(id, icon, i18nKey, shortcut, handler) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.action = id;
        btn.disabled = true;

        this._dressIconButton(btn, {
            icon, nameKey: i18nKey, nameFallback: id, shortcut,
            hintKey: `${i18nKey}.hint`
        });
        btn.addEventListener('click', () => handler());
        return btn;
    }

    /** @private */
    _setActionEnabled(id, enabled) {
        if (!this._host) return;
        const btn = this._host.querySelector(`.tool-btn[data-action="${id}"]`);
        if (btn) btn.disabled = !enabled;
    }

    /** @private */
    _buildButton(meta) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.tool = meta.id;
        btn.setAttribute('aria-pressed', 'false');

        this._dressIconButton(btn, {
            icon: meta.icon,
            nameKey: meta.i18n, nameFallback: meta.id,
            hintKey: meta.hintI18n,
            shortcut: meta.shortcut
        });
        btn.addEventListener('click', () => ToolManager.selectTool(meta.id));
        return btn;
    }

    /**
     * Render active state from the current tool fact and apply its cursor.
     * @private
     */
    _sync(toolId) {
        if (!this._host) return;

        this._host.querySelectorAll('.tool-btn').forEach((btn) => {
            const id = btn.dataset.tool;
            // Only real tools carry the active state. The undo/redo actions and
            // the drawing-guide toggles share the .tool-btn look but are NOT
            // tools, and their own pressed/enabled state must survive a tool
            // switch — this guard is what stops _sync from clobbering it.
            if (!id) return;
            const isActive = id === toolId ||
                (id === 'shape' && SHAPE_VARIANT_IDS.has(toolId));
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });

        // Apply the selected tool's cursor over the canvas (move/zoom manage
        // their own grab/zoom cursors in activate()).
        const tool = ToolManager.getCurrentTool();
        if (tool && window.CanvasSystem) CanvasSystem.setCanvasCursor(tool.cursor);
    }
}

window.ToolRail = new ToolRailClass();

Logger.debug('ToolRail', 'Tool rail component loaded');

})(); // End IIFE
