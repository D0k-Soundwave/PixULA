'use strict';
(function() {

/**
 * CanvasContextMenu
 *
 * Lightweight right-click / long-press context menu for canvas operations.
 * Attaches to document.body so it renders above everything, including the
 * iframe. Consumed by the input layer (long-press on touch, Phase 5).
 */
class CanvasContextMenuClass {
    constructor() {
        this._el = null;
        this._dismissFn = null;
    }

    /**
     * Show the context menu at the given screen coordinates.
     * @param {number} screenX - X in main-window CSS pixels
     * @param {number} screenY - Y in main-window CSS pixels
     * @param {Array} items   - [{ label, action, disabled?, separator? }]
     */
    show(screenX, screenY, items) {
        this.hide();

        const menu = document.createElement('ul');
        menu.className = 'canvas-context-menu';
        menu.style.left = screenX + 'px';
        menu.style.top  = screenY + 'px';

        for (const item of items) {
            if (item.separator) {
                const sep = document.createElement('li');
                sep.className = 'canvas-context-menu__sep';
                menu.appendChild(sep);
                continue;
            }

            const li = document.createElement('li');
            li.className = 'canvas-context-menu__item' +
                (item.disabled ? ' canvas-context-menu__item--disabled' : '');
            li.textContent = item.label;

            if (!item.disabled) {
                li.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hide();
                    item.action();
                });
            }
            menu.appendChild(li);
        }

        document.body.appendChild(menu);
        this._el = menu;

        // Clamp to viewport so it never appears off-screen
        const r = menu.getBoundingClientRect();
        if (r.right  > window.innerWidth)  menu.style.left = (screenX - r.width)  + 'px';
        if (r.bottom > window.innerHeight) menu.style.top  = (screenY - r.height) + 'px';

        // Dismiss when clicking anywhere outside the menu
        this._dismissFn = (e) => { if (!menu.contains(e.target)) this.hide(); };
        setTimeout(() => document.addEventListener('pointerdown', this._dismissFn), 0);
    }

    /** Remove the menu from the DOM. */
    hide() {
        if (this._el) { this._el.remove(); this._el = null; }
        if (this._dismissFn) {
            document.removeEventListener('pointerdown', this._dismissFn);
            this._dismissFn = null;
        }
    }
}

window.CanvasContextMenu = new CanvasContextMenuClass();

Logger.debug('CanvasContextMenu', 'Canvas context menu loaded');

})(); // End IIFE
