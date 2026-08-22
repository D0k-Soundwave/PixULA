'use strict';
(function() {

/**
 * PanelSection — the one source of sidebar panel chrome.
 *
 * Stamps the #tpl-panel <template> for every right-sidebar section (Layers,
 * Transform, Tool Options, Reference), wires the collapse/expand header and
 * persists each section's open/closed state across reloads (Storage
 * WINDOW_STATE store — replaces the old app.js _setupPanelCollapse block).
 *
 * Two independent axes, each persisted under its own key: **collapse**
 * (isCollapsed/setCollapsed/toggle) folds a present panel down to its title
 * bar via the header's own arrow; **visibility** (isVisible/setVisible/
 * toggleVisibility) adds or removes the whole section — header included —
 * from #panels, which is what the View menu's panel checkboxes drive.
 * Collapsing a hidden panel (or vice versa) is fine: the two states are
 * independent, so removing a panel remembers whatever collapse state it had
 * when it comes back.
 */
class PanelSectionClass {
    constructor() {
        this.STORE_KEY = 'panelCollapse';
        this.VISIBILITY_KEY = 'panelVisibility';
        this.ORDER_KEY = 'panelOrder';
        /** @type {Map<string, { section, content, title, button }>} */
        this._sections = new Map();
        this._restored = null; // persisted collapse states (async)
        this._restoredVisibility = null; // persisted whole-section visibility (async)
        this._restoredOrder = null; // persisted panel order (async)
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * Create a sidebar panel from the tpl-panel template and append it to #panels.
     * @param {Object} opts
     * @param {string} opts.id          - section element id (e.g. 'layer-panel')
     * @param {string} opts.titleI18n   - i18n key for the <h2>
     * @param {string} opts.title       - English fallback title
     * @param {boolean} [opts.collapsed] - initial state when nothing is persisted
     * @param {string} [opts.hintI18n]  - i18n key for the header's hover hint
     *   (what this panel is for; the right-click reorder instruction is
     *   folded into the same sentence, since a header's title carries only
     *   one hint key - see the comment at its call site below)
     * @param {string} [opts.hint]      - English fallback for hintI18n
     * @returns {{ section: HTMLElement, content: HTMLElement, title: HTMLElement }}
     */
    create({ id, titleI18n, title, collapsed = false, hintI18n, hint }) {
        const host = document.getElementById('panels');
        const tpl = document.getElementById('tpl-panel');
        if (!host || !tpl) {
            Logger.error('PanelSection', '#panels or #tpl-panel missing');
            return null;
        }

        const fragment = tpl.content.cloneNode(true);
        const section = fragment.querySelector('.panel');
        const header  = fragment.querySelector('.panel-header');
        const titleEl = fragment.querySelector('.panel-title');
        const button  = fragment.querySelector('.panel-collapse');
        const content = fragment.querySelector('.panel-content');

        section.id = id;
        titleEl.id = `${id}-title`;
        content.id = `${id}-content`;
        section.setAttribute('aria-labelledby', titleEl.id);
        button.setAttribute('aria-controls', content.id);
        titleEl.dataset.i18n = titleI18n;
        titleEl.textContent = this._t(titleI18n, title);

        // Hover hint: the header's own name (already visible as the h2) plus
        // what this specific panel is for, composed the same way every other
        // control's two-stage tooltip is (Helpers.composeTitle / I18n's
        // data-i18n-title + data-i18n-title-name pair keeps it live on a
        // locale switch). I18n.apply() re-composes from ONE key per header
        // (data-i18n-title), so the right-click-to-reorder instruction -
        // true of every panel alike - is folded into each panel's own hint
        // sentence at the source (each hintI18n value ends with it) rather
        // than composed from two separate keys here.
        header.dataset.i18nTitleName = titleI18n;
        header.dataset.i18nTitle = hintI18n;
        header.title = Helpers.composeTitle(
            this._t(titleI18n, title),
            this._t(hintI18n, hint)
        );

        const entry = { section, content, title: titleEl, button };
        this._sections.set(id, entry);

        this._setCollapsedDom(entry, collapsed);
        this._setVisibleDom(entry, true); // default: present in the sidebar

        header.addEventListener('click', () => {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            this._setCollapsedDom(entry, expanded);
            this._save();
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._showReorderMenu(id, e.clientX, e.clientY);
        });

        host.appendChild(fragment);

        // Apply any persisted state that resolved before this panel existed
        if (this._restored && Object.prototype.hasOwnProperty.call(this._restored, content.id)) {
            this._setCollapsedDom(entry, !this._restored[content.id]);
        }
        if (this._restoredVisibility && Object.prototype.hasOwnProperty.call(this._restoredVisibility, id)) {
            this._setVisibleDom(entry, this._restoredVisibility[id]);
        }
        if (this._restoredOrder && this._restoredOrder.includes(id)) {
            this._applyOrder(this._restoredOrder);
        }

        return { section, content, title: titleEl };
    }

    /**
     * Append an element to a section BESIDE its content, and have the collapse
     * hide it too.
     *
     * A caller needs this when its row must survive the content element being
     * emptied — OptionControls clears #tool-options-panel-content on every tool
     * change, so ToolPresetBar's row cannot live inside it. Anything simply
     * appended to the section, though, stayed on screen when the panel was
     * collapsed: the header would fold its contents away and leave one
     * bordered row hanging under it, with aria-controls describing only half
     * of what had gone.
     * @param {string} id - the section id passed to create()
     * @param {HTMLElement} element
     * @returns {boolean} false if there is no such section (caller appends itself)
     */
    addExtra(id, element) {
        const entry = this._sections.get(id);
        if (!entry || !element) return false;

        entry.section.appendChild(element);
        entry.extras = entry.extras || [];
        entry.extras.push(element);

        // Screen readers are told the whole of what the button folds away, so
        // the extra needs an id to be named by.
        if (!element.id) element.id = `${id}-extra-${entry.extras.length}`;
        const controls = entry.button.getAttribute('aria-controls') || '';
        entry.button.setAttribute('aria-controls', `${controls} ${element.id}`.trim());

        this._setCollapsedDom(entry, entry.button.getAttribute('aria-expanded') !== 'true');
        return true;
    }

    /** @private */
    _setCollapsedDom(entry, collapsed) {
        entry.button.setAttribute('aria-expanded', String(!collapsed));
        entry.content.style.display = collapsed ? 'none' : '';
        for (const extra of entry.extras || []) {
            extra.style.display = collapsed ? 'none' : '';
        }
        // The one fact for "is this panel open" — covers header-click
        // collapse, setCollapsed(), and restore()'s persisted state alike,
        // so any listener (the View-menu checkboxes) stays right regardless
        // of which of those changed it.
        EventBus.emit(EVENTS.PANEL_COLLAPSE_CHANGED, { id: entry.section.id, expanded: !collapsed });
    }

    /**
     * Add or remove a whole section from the sidebar — distinct from collapse:
     * collapse folds a present panel to its title bar, this takes the panel out
     * of #panels' layout entirely (header included), the way the View menu's
     * panel checkboxes are meant to work. Collapse state is left untouched
     * underneath, so re-adding a panel restores whatever collapse state it had.
     * @private
     */
    _setVisibleDom(entry, visible) {
        entry.section.style.display = visible ? '' : 'none';
        EventBus.emit(EVENTS.PANEL_VISIBILITY_CHANGED, { id: entry.section.id, visible });
    }

    /** Persist all sections' collapse states. @private */
    _save() {
        if (!window.Storage) return;
        const states = {};
        for (const { button, content } of this._sections.values()) {
            states[content.id] = button.getAttribute('aria-expanded') === 'true';
        }
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        Promise.resolve(Storage.set(this.STORE_KEY, states, store)).catch(() => {});
    }

    /** Persist all sections' whole-panel visibility. @private */
    _saveVisibility() {
        if (!window.Storage) return;
        const states = {};
        for (const [id, entry] of this._sections.entries()) {
            states[id] = entry.section.style.display !== 'none';
        }
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        Promise.resolve(Storage.set(this.VISIBILITY_KEY, states, store)).catch(() => {});
    }

    /** Show the Move up/Move down context menu for a panel's title bar. @private */
    _showReorderMenu(id, screenX, screenY) {
        if (!window.CanvasContextMenu) return;
        const host = document.getElementById('panels');
        const entry = this._sections.get(id);
        if (!host || !entry) return;
        const children = Array.from(host.children);
        const idx = children.indexOf(entry.section);

        CanvasContextMenu.show(screenX, screenY, [
            {
                label: this._t('panel.moveUp', 'Move up'),
                disabled: idx <= 0,
                action: () => this._moveSection(id, -1)
            },
            {
                label: this._t('panel.moveDown', 'Move down'),
                disabled: idx < 0 || idx >= children.length - 1,
                action: () => this._moveSection(id, 1)
            }
        ]);
    }

    /** Move a panel one slot up (-1) or down (+1) within #panels. @private */
    _moveSection(id, delta) {
        const host = document.getElementById('panels');
        const entry = this._sections.get(id);
        if (!host || !entry) return;
        const children = Array.from(host.children);
        const idx = children.indexOf(entry.section);
        const target = idx + delta;
        if (idx < 0 || target < 0 || target >= children.length) return;

        if (delta < 0) {
            host.insertBefore(entry.section, children[target]);
        } else {
            host.insertBefore(entry.section, children[target + 1] || null);
        }
        this._saveOrder();
    }

    /** Persist the panels' current DOM order. @private */
    _saveOrder() {
        if (!window.Storage) return;
        const host = document.getElementById('panels');
        if (!host) return;
        const order = Array.from(host.children).map((el) => el.id).filter(Boolean);
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        Promise.resolve(Storage.set(this.ORDER_KEY, order, store)).catch(() => {});
    }

    /** Reorder #panels' children to match a persisted id order. @private */
    _applyOrder(order) {
        const host = document.getElementById('panels');
        if (!host) return;
        for (const id of order) {
            const entry = this._sections.get(id);
            if (entry) host.appendChild(entry.section);
        }
    }

    /**
     * Restore persisted collapse states and panel order. Called once from App
     * init after all panels are created (also applied late to panels created
     * afterwards).
     */
    async restore() {
        if (!window.Storage) return;
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        try {
            const [states, visibility, order] = await Promise.all([
                Storage.get(this.STORE_KEY, store),
                Storage.get(this.VISIBILITY_KEY, store),
                Storage.get(this.ORDER_KEY, store)
            ]);
            if (states) {
                this._restored = states;
                for (const entry of this._sections.values()) {
                    const key = entry.content.id;
                    if (Object.prototype.hasOwnProperty.call(states, key)) {
                        this._setCollapsedDom(entry, !states[key]);
                    }
                }
            }
            if (visibility) {
                this._restoredVisibility = visibility;
                for (const [id, entry] of this._sections.entries()) {
                    if (Object.prototype.hasOwnProperty.call(visibility, id)) {
                        this._setVisibleDom(entry, visibility[id]);
                    }
                }
            }
            if (Array.isArray(order) && order.length) {
                this._restoredOrder = order;
                this._applyOrder(order);
            }
        } catch (e) { /* defaults apply */ }
    }

    /** Is a section currently collapsed? */
    isCollapsed(id) {
        const entry = this._sections.get(id);
        return entry ? entry.button.getAttribute('aria-expanded') !== 'true' : false;
    }

    /** Set a section's collapsed state programmatically (persisted). */
    setCollapsed(id, collapsed) {
        const entry = this._sections.get(id);
        if (!entry) return;
        this._setCollapsedDom(entry, collapsed);
        this._save();
    }

    /** Toggle a section's collapse (its own header arrow). Returns the new expanded state. */
    toggle(id) {
        const collapsed = this.isCollapsed(id);
        this.setCollapsed(id, !collapsed);
        return collapsed; // was collapsed -> now expanded
    }

    /** Is a whole section currently present in the sidebar? */
    isVisible(id) {
        const entry = this._sections.get(id);
        return entry ? entry.section.style.display !== 'none' : false;
    }

    /** Add (true) or remove (false) a whole section from the sidebar (persisted). */
    setVisible(id, visible) {
        const entry = this._sections.get(id);
        if (!entry) return;
        this._setVisibleDom(entry, visible);
        this._saveVisibility();
    }

    /** Toggle a section's presence in the sidebar (menu View actions). Returns the new visible state. */
    toggleVisibility(id) {
        const visible = this.isVisible(id);
        this.setVisible(id, !visible);
        return !visible;
    }
}

window.PanelSection = new PanelSectionClass();

Logger.debug('PanelSection', 'Panel section component loaded');

})(); // End IIFE
