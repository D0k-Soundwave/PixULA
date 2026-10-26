'use strict';
(function() {

/**
 * StripSelector - one button in the top strip that stands for a whole GROUP of
 * choices (the draw modes, Mirror, the whole-cell tools).
 *
 * The button shows only the choice in force. Clicking it opens a small pop-up
 * grid, two icons wide, that grows downward as the group needs; picking an
 * icon (or pressing Escape, or clicking anywhere else) takes it away again.
 * The pop-up is a floating layer on <body> (position: fixed), the same
 * arrangement as the shared tooltip, so opening it never moves anything in
 * the strip and the strip's size never depends on how many choices a group
 * has. Hover text on the button and on every icon in the pop-up is the app's
 * usual two-stage tooltip (js/ui/tooltip-manager.js): the controls are
 * `.tool-btn` buttons whose `title` is Helpers.composeTitle(name, hint).
 *
 * Keyboard: Enter, Space or Arrow Down on the button opens the grid and
 * focuses the choice in force; the arrow keys move around the grid (two
 * columns), Enter or Space picks, Escape closes and returns to the button,
 * Tab closes.
 *
 * What a group offers is asked for at the moment it opens (`options()`), so a
 * screen mode that takes a choice away needs no bookkeeping here.
 *
 * config:
 *   host      element the button is appended to
 *   id        DOM id of the button
 *   group     [i18n key, English] the group's name, e.g. "Draw mode"
 *   options() Array<{value, icon, name:[key,en], hint:[key,en], available?:boolean,
 *             domId?:string, data?:Object}> - every choice, in grid order; an
 *             `available: false` one is not offered (but still names the
 *             current choice if it is in force)
 *   current() the value in force
 *   isActive(value)  true if the button should read as switched on (default: never)
 *   select(value)    make that choice
 *   events    EVENTS.* facts after which the button redraws itself
 */
class StripSelector {
    constructor(config) {
        this.config = config;
        this.button = null;
        this.popup = null;
        this._items = [];
        this._onDown = (e) => this._outsideDown(e);
        this._onViewChange = () => this.close();
        // Escape closes the pop-up and nothing else: without this the same press would reach
        // InputHandler's Escape cascade (it cancels a selection and picks the Brush).
        this._onEscape = (e) => {
            if (e.key !== 'Escape' || !this.popup) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            this.close();
            this.button.focus({ preventScroll: true });
        };
        this._build();
    }

    /** English fallback until i18n has the key. @private */
    _t(pair) {
        return typeof pair === 'function' ? pair() : Helpers.localizedMessage(pair[0], pair[1]);
    }

    /** @private */
    _build() {
        const c = this.config;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = c.id;
        btn.className = 'tool-btn strip-selector';
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.appendChild(this._icon(null));
        btn.addEventListener('click', () => (this.isOpen() ? this.close() : this.open()));
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); this.open(true); }
        });
        c.host.appendChild(btn);
        this.button = btn;

        for (const channel of (c.events || [])) EventBus.on(channel, () => this.refresh());
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, () => this.refresh());
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => this.close());
        this.refresh();
    }

    /** An <svg><use> for a symbol id. @private */
    _icon(symbol) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('tool-icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        if (symbol) use.setAttribute('href', `#${symbol}`);
        svg.appendChild(use);
        return svg;
    }

    /** The option in force (even if the mode no longer offers it), or null. @private */
    _currentOption() {
        const value = this.config.current();
        return this.config.options().find((o) => o.value === value) || null;
    }

    /** Redraw the button from the choice in force. */
    refresh() {
        const c = this.config;
        const cur = this._currentOption();
        const group = this._t(c.group);
        if (cur) {
            const use = this.button.querySelector('use');
            use.setAttribute('href', `#${cur.icon}`);
            const name = this._t(cur.name);
            this.button.setAttribute('aria-label', `${group}: ${name}`);
            const choose = Helpers.localizedMessage('strip.choose', 'Click to choose another');
            this.button.title = Helpers.composeTitle(`${group}: ${name}`, `${this._t(cur.hint)}. ${choose}`);
        }
        const active = !!(c.isActive && c.isActive(c.current()));
        this.button.classList.toggle('active', active);
        this.button.dataset.value = String(c.current());
    }

    /** Show or hide the whole selector without moving anything (visibility, not display). */
    setAvailable(on) {
        this.button.style.visibility = on ? '' : 'hidden';
        this.button.disabled = !on;
        this.button.setAttribute('aria-hidden', String(!on));
        if (!on) this.close();
    }

    isOpen() {
        return !!this.popup;
    }

    /**
     * Open the pop-up grid under the button.
     * @param {boolean} [focusCurrent] - move keyboard focus into the grid
     */
    open(focusCurrent = false) {
        if (this.popup) return;
        const c = this.config;
        const offered = c.options().filter((o) => o.available !== false);
        if (offered.length === 0) return;
        const current = c.current();

        const popup = document.createElement('div');
        popup.className = 'strip-popup';
        popup.setAttribute('role', 'menu');
        popup.setAttribute('aria-label', this._t(c.group));
        const rect = this.button.getBoundingClientRect();
        popup.style.setProperty('--strip-item-w', `${rect.width}px`);
        popup.style.setProperty('--strip-item-h', `${rect.height}px`);

        this._items = offered.map((o) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'tool-btn strip-popup-item';
            if (o.domId) item.id = o.domId;
            for (const [k, v] of Object.entries(o.data || {})) item.dataset[k] = v;
            const name = this._t(o.name);
            // The app's two-stage tooltip reads the title; the data attributes let I18n keep it localised.
            if (Array.isArray(o.name)) item.dataset.i18nTitleName = o.name[0];
            if (Array.isArray(o.hint)) item.dataset.i18nTitle = o.hint[0];
            item.title = Helpers.composeTitle(name, this._t(o.hint));
            item.setAttribute('aria-label', name);
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('aria-checked', String(o.value === current));
            item.classList.toggle('active', o.value === current);
            item.appendChild(this._icon(o.icon));
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._choose(o.value);
            });
            item.addEventListener('keydown', (e) => this._itemKey(e));
            popup.appendChild(item);
            return item;
        });

        document.body.appendChild(popup);
        this.popup = popup;
        this.button.setAttribute('aria-expanded', 'true');
        this._place(rect);

        // Capture phase: a press anywhere that is not this selector closes it before the
        // target's own handler runs, so one click both dismisses and acts (as a menu does).
        document.addEventListener('pointerdown', this._onDown, true);
        document.addEventListener('keydown', this._onEscape, true);
        window.addEventListener('resize', this._onViewChange);
        window.addEventListener('blur', this._onViewChange);

        if (focusCurrent) {
            const i = Math.max(0, offered.findIndex((o) => o.value === current));
            this._items[i].focus();
        }
    }

    /** Under the button, kept on screen. @private */
    _place(rect) {
        const p = this.popup;
        const margin = 4;
        let left = rect.left;
        let top = rect.bottom + margin;
        const w = p.offsetWidth, h = p.offsetHeight;
        if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - w);
        if (top + h > window.innerHeight - margin) top = Math.max(margin, rect.top - margin - h);
        p.style.left = `${Math.round(left)}px`;
        p.style.top = `${Math.round(top)}px`;
    }

    /** Take the pop-up away. */
    close() {
        if (!this.popup) return;
        this.popup.remove();
        this.popup = null;
        this._items = [];
        this.button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this._onDown, true);
        document.removeEventListener('keydown', this._onEscape, true);
        window.removeEventListener('resize', this._onViewChange);
        window.removeEventListener('blur', this._onViewChange);
    }

    /** @private */
    _choose(value) {
        this.close();
        this.config.select(value);
        this.refresh();
        this.button.focus({ preventScroll: true });
    }

    /** @private */
    _outsideDown(e) {
        if (this.popup && (this.popup.contains(e.target) || this.button.contains(e.target))) return;
        this.close();
    }

    /** Arrow keys around a two-column grid; Escape and Tab leave. @private */
    _itemKey(e) {
        const items = this._items;
        const i = items.indexOf(document.activeElement);
        const move = (to) => {
            e.preventDefault();
            if (to >= 0 && to < items.length) items[to].focus();
        };
        switch (e.key) {
            case 'ArrowRight': move(i + 1); break;
            case 'ArrowLeft':  move(i - 1); break;
            case 'ArrowDown':  move(i + 2); break;
            case 'ArrowUp':    move(i - 2); break;
            case 'Home':       move(0); break;
            case 'End':        move(items.length - 1); break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                this.close();
                this.button.focus({ preventScroll: true });
                break;
            case 'Tab':
                this.close();
                break;
            default:
        }
    }
}

window.StripSelector = StripSelector;

Logger.debug('StripSelector', 'Strip selector loaded');

})(); // End IIFE
