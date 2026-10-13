'use strict';
(function() {

/**
 * CanvasTextEntry - the keyboard side of "Type on canvas" (Batch 10B).
 *
 * The Text tool keeps the text, the caret and the picture preview; this holds the KEYBOARD. It owns one hidden text field in
 * the main document that takes focus when you click the picture to start typing. A real text field is used on purpose: it
 * brings the on-screen keyboard on touch devices, accented and composed characters (IME, dead keys, AltGr), paste, Backspace,
 * Delete, Left / Right / Home / End and Shift+Enter for free, and InputHandler already switches every shortcut off while a text
 * field has the focus.
 *
 * Talks to the tool through EventBus (EVENTS.TEXT_ENTRY_*). A small row of buttons - Draw, New line, Cancel - is shown while
 * a session is open, for devices with no Shift+Enter or Escape.
 */
class CanvasTextEntryClass {
    constructor() {
        /**
         * Caret blink period. [P] The ZX Spectrum FLASH attribute swaps every 16 frames; [C] at 50 Hz that is 16/50 s = 320 ms,
         * the same period LayerManager's FLASH clock uses.
         */
        this.BLINK_MS = 320;
        this._ta = null;
        this._row = null;
        this._timer = null;
        this._on = true;
        this._open = false;
        this._lastCaret = -1;
    }

    /** @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        const ta = document.createElement('textarea');
        ta.id = 'canvas-text-entry';
        ta.dataset.canvasText = '1';
        ta.setAttribute('wrap', 'off');
        ta.setAttribute('rows', '1');
        ta.setAttribute('spellcheck', 'false');
        ta.setAttribute('autocomplete', 'off');
        ta.setAttribute('autocorrect', 'off');
        ta.setAttribute('autocapitalize', 'off');
        ta.setAttribute('enterkeyhint', 'done');
        ta.dataset.i18nAriaLabel = 'a11y.canvasText';
        ta.setAttribute('aria-label', this._t('a11y.canvasText', 'Text typed onto the picture'));
        // Never display:none (it could not take focus). 16px so iOS does not zoom the page on focus [A: verify on a device].
        ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;padding:0;border:0;' +
            'font-size:16px;pointer-events:none;resize:none;overflow:hidden;z-index:-1;';
        document.body.appendChild(ta);
        this._ta = ta;

        const row = document.createElement('div');
        row.id = 'canvas-text-buttons';
        row.className = 'canvas-text-buttons';
        row.hidden = true;
        row.setAttribute('role', 'group');
        row.dataset.i18nAriaLabel = 'a11y.canvasText';
        row.setAttribute('aria-label', this._t('a11y.canvasText', 'Text typed onto the picture'));
        const mk = (id, i18n, fb, event, primary) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.id = id;
            b.className = 'panel-button' + (primary ? ' primary' : '');
            b.dataset.i18n = i18n;
            b.textContent = this._t(i18n, fb);
            // keep the keyboard where it is: a press on the button must not take the focus off the field
            b.addEventListener('pointerdown', (e) => e.preventDefault());
            b.addEventListener('click', () => {
                EventBus.emit(event);
                if (event === EVENTS.TEXT_ENTRY_NEWLINE) this._focus();
            });
            row.appendChild(b);
        };
        mk('canvas-text-draw', 'text.entry.draw', 'Draw', EVENTS.TEXT_ENTRY_COMMIT, true);
        mk('canvas-text-newline', 'text.entry.newLine', 'New line', EVENTS.TEXT_ENTRY_NEWLINE, false);
        mk('canvas-text-cancel', 'text.entry.cancel', 'Cancel', EVENTS.TEXT_ENTRY_CANCEL, false);
        document.body.appendChild(row);
        this._row = row;

        // The field tells the tool what it holds
        ta.addEventListener('input', () => this._changed());
        ta.addEventListener('keyup', () => this._caretMoved());
        ta.addEventListener('click', () => this._caretMoved());
        document.addEventListener('selectionchange', () => { if (document.activeElement === ta) this._caretMoved(); });
        ta.addEventListener('keydown', (e) => this._onKey(e));
        ta.addEventListener('focus', () => this._startBlink());
        ta.addEventListener('blur', () => this._stopBlink(false));

        // A session is open but something else has the focus (a click on an option took it): typing must still go into the text, not act
        // as tool shortcuts. The keystroke is handed back to the field before anything else sees it.
        window.addEventListener('keydown', (e) => this._stolenKey(e), true);

        EventBus.on(EVENTS.TEXT_ENTRY_OPEN, (d) => this._onOpen(d));
        EventBus.on(EVENTS.TEXT_ENTRY_CLOSE, () => this._onClose());
    }

    /** @private */
    _tool() {
        return window.ToolManager ? ToolManager.getTool(TOOLS.TEXT) : null;
    }

    /** The tool opened or edited a session: show it in the field, and (when asked) take the keyboard. @private */
    _onOpen(d) {
        const ta = this._ta;
        if (!ta) return;
        this._open = true;
        this._row.hidden = false;
        if (ta.value !== d.text) ta.value = d.text;
        ta.setSelectionRange(d.caret, d.caret);
        this._lastCaret = d.caret;
        this._place(d.x, d.y);
        if (d.refocus !== false) {
            this._focus();
            // A press on the picture is followed by the browser moving focus into the picture's frame; take it back once the
            // press has finished.
            const doc = window.CanvasSystem && CanvasSystem.iframeDoc;
            if (doc) {
                const again = () => { doc.removeEventListener('pointerup', again, true); if (this._open) this._focus(); };
                doc.addEventListener('pointerup', again, true);
            }
        }
    }

    /** @private */
    _stolenKey(e) {
        if (!this._open || e.target === this._ta || e.isComposing) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab') return;
        const t = e.target;
        const tag = t && t.tagName;
        const textLike = ['text', 'number', 'search', 'email', 'url', 'password', 'tel'];
        if ((tag === 'INPUT' && textLike.includes(t.type)) || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
        const k = e.key;
        const editing = k.length === 1 || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Escape'].includes(k);
        if (!editing) return;
        e.stopImmediatePropagation();
        this._focus();
        if (k === 'Enter' || k === 'Escape' || k === 'ArrowUp' || k === 'ArrowDown') {
            e.preventDefault();
            this._onKey(e);
        }
    }

    /** @private */
    _onClose() {
        this._open = false;
        this._stopBlink(false);
        if (this._row) this._row.hidden = true;
        if (this._ta) { this._ta.value = ''; if (document.activeElement === this._ta) this._ta.blur(); }
    }

    /** @private */
    _focus() {
        if (this._ta) this._ta.focus({ preventScroll: true });
    }

    /** Put the field where the text is, so a candidate window / the keyboard shows near it. @private */
    _place(x, y) {
        if (!window.CanvasSystem || !CanvasSystem.pixelToScreen) return;
        const p = CanvasSystem.pixelToScreen(x, y);
        this._ta.style.left = Helpers.clamp(Math.round(p.x), 0, window.innerWidth - 2) + 'px';
        this._ta.style.top = Helpers.clamp(Math.round(p.y), 0, window.innerHeight - 2) + 'px';
    }

    /** @private */
    _changed() {
        if (!this._open) return;
        this._lastCaret = this._ta.selectionStart;
        EventBus.emit(EVENTS.TEXT_ENTRY_CHANGED, { text: this._ta.value, caret: this._ta.selectionStart });
        this._startBlink();      // every keystroke restarts the caret "on"
    }

    /** @private */
    _caretMoved() {
        if (!this._open || this._ta.selectionStart === this._lastCaret) return;
        this._lastCaret = this._ta.selectionStart;
        EventBus.emit(EVENTS.TEXT_ENTRY_CHANGED, { text: this._ta.value, caret: this._ta.selectionStart });
    }

    /** @private */
    _onKey(e) {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            EventBus.emit(EVENTS.TEXT_ENTRY_COMMIT);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            EventBus.emit(EVENTS.TEXT_ENTRY_CANCEL);
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            // A one-row field has no lines to move through: move by the picture's lines
            e.preventDefault();
            const to = BitmapText.moveVertical(this._ta.value, this._ta.selectionStart, e.key === 'ArrowUp' ? -1 : 1);
            this._ta.setSelectionRange(to, to);
            this._caretMoved();
        }
    }

    /** The caret shows for half of every period, and is restarted "on" by every keystroke. @private */
    _startBlink() {
        this._stopBlink(true);
        if (!this._open) return;
        const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (still) return;
        this._timer = setInterval(() => { this._on = !this._on; this._draw(); }, this.BLINK_MS);
    }

    /** @private */
    _stopBlink(visible) {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._on = !!visible;
        if (this._open) this._draw();
    }

    /** @private */
    _draw() {
        const tool = this._tool();
        if (tool && tool._typing && tool._typing.active) tool._typing.preview(this._on);
    }
}

window.CanvasTextEntry = new CanvasTextEntryClass();

})();
