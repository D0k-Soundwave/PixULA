'use strict';
(function() {

/**
 * PanelSection — the one source of sidebar panel chrome.
 *
 * Stamps the #tpl-panel <template> for every right-sidebar section (Layers,
 * Transform, Tool Options, Reference), wires the collapse/expand header and
 * persists each section's open/closed state across reloads (Storage
 * WINDOW_STATE store — replaces the old app.js _setupPanelCollapse block).
 */
class PanelSectionClass {
    constructor() {
        this.STORE_KEY = 'panelCollapse';
        /** @type {Map<string, { section, content, title, button }>} */
        this._sections = new Map();
        this._restored = null; // persisted collapse states (async)
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
     * @returns {{ section: HTMLElement, content: HTMLElement, title: HTMLElement }}
     */
    create({ id, titleI18n, title, collapsed = false }) {
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

        const entry = { section, content, title: titleEl, button };
        this._sections.set(id, entry);

        this._setCollapsedDom(entry, collapsed);

        header.addEventListener('click', () => {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            this._setCollapsedDom(entry, expanded);
            this._save();
        });

        host.appendChild(fragment);

        // Apply any persisted state that resolved before this panel existed
        if (this._restored && Object.prototype.hasOwnProperty.call(this._restored, content.id)) {
            this._setCollapsedDom(entry, !this._restored[content.id]);
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
    }

    /** Persist all sections' states. @private */
    _save() {
        if (!window.Storage) return;
        const states = {};
        for (const { button, content } of this._sections.values()) {
            states[content.id] = button.getAttribute('aria-expanded') === 'true';
        }
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        Promise.resolve(Storage.set(this.STORE_KEY, states, store)).catch(() => {});
    }

    /**
     * Restore persisted collapse states. Called once from App init after all
     * panels are created (also applied late to panels created afterwards).
     */
    async restore() {
        if (!window.Storage) return;
        const store = (Storage.STORES && Storage.STORES.WINDOW_STATE) || 'window-state';
        try {
            const states = await Storage.get(this.STORE_KEY, store);
            if (!states) return;
            this._restored = states;
            for (const entry of this._sections.values()) {
                const key = entry.content.id;
                if (Object.prototype.hasOwnProperty.call(states, key)) {
                    this._setCollapsedDom(entry, !states[key]);
                }
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

    /** Toggle a section (menu View actions). Returns the new expanded state. */
    toggle(id) {
        const collapsed = this.isCollapsed(id);
        this.setCollapsed(id, !collapsed);
        return collapsed; // was collapsed -> now expanded
    }
}

window.PanelSection = new PanelSectionClass();

Logger.debug('PanelSection', 'Panel section component loaded');

})(); // End IIFE
