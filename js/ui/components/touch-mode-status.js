'use strict';
(function() {

/**
 * TouchModeStatus — the status-bar switch for "does a finger leave marks".
 *
 * Of the three touch-admission layers (see the block at the top of
 * js/core/input-handler.js) this is the one changed mid-drawing: a stray finger
 * becomes a nuisance while a picture is in front of you, not while you are
 * reading Preferences. So it is a button in the status bar rather than a
 * checkbox in a dialog, one click either way, and it says which state it is in
 * at all times rather than only while touch is off. That is deliberate: a
 * readout that appears only in the unusual state answers "why did that happen"
 * but never "what will happen", and this control's whole job is the second
 * question.
 *
 * It hides itself on a machine that cannot produce a touch, because a switch
 * for hardware you do not have is noise. The test is generous on purpose — the
 * declared maxTouchPoints OR any touch event actually seen — since the failure
 * that matters is a hidden switch on a machine that IS being touched, and a
 * visible one on a machine that never will be costs nothing but a word.
 *
 * Command down, fact up: the click calls InputHandler.setTouchDrawing() and the
 * label is rendered from EVENTS.TOUCH_MODE_CHANGED, never from the click.
 */
class TouchModeStatusClass {
    constructor() {
        this._el = null;
        this._revealed = false;
    }

    /** English fallback until i18n resolves. @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        this._el = document.getElementById('touch-mode-status');
        if (!this._el) {
            Logger.error('TouchModeStatus', '#touch-mode-status host not found');
            return;
        }

        this._el.addEventListener('click', () => {
            if (!window.InputHandler) return;
            InputHandler.setTouchDrawing(!InputHandler.getTouchDrawing());
        });

        EventBus.on(EVENTS.TOUCH_MODE_CHANGED, ({ drawing }) => this._render(drawing));

        // A touch anywhere reveals the switch on hardware whose maxTouchPoints
        // under-reports (some convertibles report 0 until the screen is used).
        //
        // BOTH documents, and the second one is the one that matters: every
        // canvas pointer event is dispatched on the srcdoc iframe's body and
        // does not cross the frame boundary, so listening on the top document
        // alone would miss someone who touches only the picture — precisely the
        // hidden-switch-on-a-touched-machine case this fallback exists for.
        if (!this._isTouchCapable()) {
            const onTouch = (e) => { if (e.pointerType === 'touch') this._reveal(); };
            document.addEventListener('pointerdown', onTouch, true);
            if (window.CanvasSystem) {
                CanvasSystem.onReady(() => {
                    const doc = CanvasSystem.getIframeDocument();
                    if (doc) doc.addEventListener('pointerdown', onTouch, true);
                });
            }
        }

        this._render(window.InputHandler ? InputHandler.getTouchDrawing()
                                         : TOUCH_DEFAULTS.drawing);
        Logger.debug('TouchModeStatus', 'Touch mode status initialized');
    }

    /** @private */
    _isTouchCapable() {
        return (navigator.maxTouchPoints || 0) > 0 ||
               (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
    }

    /** @private */
    _reveal() {
        if (this._revealed || !this._el) return;
        this._revealed = true;
        this._el.hidden = false;
    }

    /** @private */
    _render(drawing) {
        if (!this._el) return;
        const on = drawing !== false;

        // The label is recomposed on a locale change from this attribute, the
        // same way the draw-mode readout is (I18n._updateDOM).
        this._el.dataset.i18nTouchMode = on ? 'draws' : 'nav';
        this._el.textContent = this.describeMode(on ? 'draws' : 'nav');
        this._el.title = this._t('status.touchToggleHint',
            'Whether a finger draws on the canvas. Pan, pinch and long-press work either way.');
        this._el.dataset.i18nTitle = 'status.touchToggleHint';
        this._el.setAttribute('aria-pressed', String(on));
        this._el.classList.toggle('is-off', !on);

        if (this._revealed || this._isTouchCapable()) this._reveal();
    }

    /** Label for a touch-mode id — I18n re-renders the readout with it. */
    describeMode(mode) {
        return mode === 'nav'
            ? this._t('status.touchNav', 'Touch: navigation only')
            : this._t('status.touchDraws', 'Touch: draws');
    }
}

window.TouchModeStatus = new TouchModeStatusClass();

Logger.debug('TouchModeStatus', 'Touch mode status component loaded');

})(); // End IIFE
