'use strict';
(function() {

/**
 * Tooltip Manager
 *
 * The left tool rail (#toolbar) scrolls, so `overflow-y: auto` forces
 * `overflow-x` to a clipping value — CSS ::after fly-out tooltips on the tool
 * buttons would clip at the rail's right edge, exactly where the opaque
 * canvas iframe begins.
 *
 * Fix: one shared tooltip node appended to <body> with `position: fixed`.
 * Fixed positioning is not clipped by an ancestor's overflow, and a top-level
 * z-index keeps it above the canvas iframe.
 *
 * TWO STAGES. The rail's buttons carry no printed caption, so hovering one
 * must answer "what is this?" quickly — that is the name tag: the control's
 * name and its shortcut, nothing else. Keep the pointer there and the tag
 * grows a second line saying what the tool is FOR. Sweeping the rail therefore
 * costs a name at a glance, and only a deliberate pause spends the reader's
 * attention on a sentence.
 *
 * TOUCH HAS NO HOVER, so a finger gets both stages at once by pressing and
 * holding — and that press does NOT activate the button, exactly as a
 * long-press does on Android. Without the suppression, the only way to ask
 * "what is this tool?" on a tablet would be to select it and find out.
 *
 * Text is read live from the element's `title` (kept localised by I18n via
 * `data-i18n-title`) and split on the separator Helpers.composeTitle joined
 * with, so a control needs no tooltip-specific markup. While the custom
 * tooltip is shown the `title` attribute is temporarily removed so the native
 * OS tooltip does not duplicate it.
 */

// Elements that opt into the styled fly-out tooltip.
const SELECTOR = '.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header, .app-dialog-close, #zoom-out, #zoom-in, #zoom-fit';
const GAP = 8; // px between the anchor element and the tooltip

/* Dwell timings.
   NAME_MS: Windows' own definition of "the pointer has stopped on this thing"
   is SPI_GETMOUSEHOVERTIME, which defaults to 400 ms [P: Microsoft
   SystemParametersInfo docs]. Matching it means the tag appears exactly when
   the OS would consider the hover intentional, and a fast sweep down the rail
   raises nothing.
   DESC_MS: measured from when the NAME is up, not from entry. A name tag is
   two or three words, read in well under half a second; if the pointer is
   still on the button a full second after that, the reader is not scanning,
   they are asking — 1000 ms is also Windows' press-and-hold threshold for the
   same "I mean this one" gesture on touch [P].
   WARM_MS: while moving between neighbouring buttons the delay is already
   paid, so a tag that was up moments ago reappears instantly; the description
   still costs its own dwell on each new control. */
const NAME_MS = 400;
const DESC_MS = 1000;
const WARM_MS = 500;

/* Touch.
   HOLD_MS: Android's own long-press threshold, ViewConfiguration's default
   getLongPressTimeout() = 500 ms [P]. A finger that has been down that long is
   asking about the control, not tapping it, and the same number is the one
   users' hands are already trained on from every other app on the device.
   HOLD_SLOP: 10 CSS px of finger travel cancels the hold — below a fingertip's
   own contact wobble it would cancel constantly; above it, a drag would raise
   tooltips.
   LINGER_MS: how long the tag stays after the finger lifts. A description here
   runs to a dozen words, and comfortable silent reading is ~5 words/second, so
   ~2.5 s covers the sentence; 2000 ms is that minus the time already spent
   reading while still holding, and it clears well before the next deliberate
   tap. */
const HOLD_MS = 500;
const HOLD_SLOP = 10;
const LINGER_MS = 2000;

class TooltipManagerClass {
    constructor() {
        this.el = null;          // the shared tooltip node
        this.nameEl = null;      // name + shortcut line
        this.descEl = null;      // what the control is for
        this.current = null;     // element currently described
        this._savedTitle = null; // title text stashed while shown
        this._pending = null;    // element waiting out its name delay
        this._nameTimer = 0;
        this._descTimer = 0;
        this._hiddenAt = 0;      // when the last tooltip went away (warm window)
        this._lingerTimer = 0;   // keeps the tag up after a finger lifts
        this._holdTimer = 0;     // touch press-and-hold
        this._holdFrom = null;   // {x, y} where the finger went down
        this._eatClick = false;  // a hold fired: swallow the click it would make
    }

    init() {
        if (this.el) return; // idempotent

        const el = document.createElement('div');
        el.className = 'app-tooltip';
        el.setAttribute('role', 'tooltip');
        el.setAttribute('aria-hidden', 'true');
        el.hidden = true;

        this.nameEl = document.createElement('span');
        this.nameEl.className = 'app-tooltip-name';
        this.descEl = document.createElement('span');
        this.descEl.className = 'app-tooltip-desc';
        this.descEl.hidden = true;
        el.appendChild(this.nameEl);
        el.appendChild(this.descEl);

        document.body.appendChild(el);
        this.el = el;

        // Pointer (not mouse) events, delegated so dynamically wired buttons
        // are covered too. Pointer events carry pointerType, which is the ONLY
        // reliable way to tell a real hover from the mouseover a tap
        // synthesizes afterwards — that compat event used to raise a tooltip
        // no finger could then dismiss.
        document.addEventListener('pointerover', (e) => this._onOver(e));
        document.addEventListener('pointerout', (e) => this._onOut(e));

        // Keyboard: mirror hover for focus so AT/keyboard users get the hint.
        document.addEventListener('focusin', (e) => this._onFocus(e));
        document.addEventListener('focusout', (e) => this._onBlur(e));

        // Any of these should dismiss immediately.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
        document.addEventListener('pointerdown', (e) => this._onDown(e), true);
        document.addEventListener('pointermove', (e) => this._onMove(e), true);
        document.addEventListener('pointerup', (e) => this._onUp(e), true);
        document.addEventListener('pointercancel', () => this._cancelHold(), true);
        // A hold must not also select the tool it described. Capture phase, so
        // the button's own listener never sees it.
        document.addEventListener('click', (e) => {
            if (!this._eatClick) return;
            this._eatClick = false;
            e.preventDefault();
            e.stopPropagation();
        }, true);
        // The platform context menu on a long press would land on top of ours.
        document.addEventListener('contextmenu', (e) => {
            if (this._holdTimer || this._eatClick) e.preventDefault();
        }, true);

        // Position is viewport-fixed, so scrolling the rail would desync it.
        window.addEventListener('scroll', () => this.hide(), true);
        window.addEventListener('blur', () => this.hide());
    }

    /**
     * A finger going down on a control starts the press-and-hold; anything
     * else (mouse, pen) dismisses, as a click always did.
     * @private
     */
    _onDown(e) {
        this._cancelHold();
        const target = e.pointerType === 'touch' && e.target.closest &&
            e.target.closest(SELECTOR);
        if (!target) {
            this.hide();
            return;
        }
        this._holdFrom = { x: e.clientX, y: e.clientY };
        this._holdTimer = window.setTimeout(() => {
            this._holdTimer = 0;
            // Touch gets one stage, not two: there is no "keep hovering" to
            // ask with, so the hold answers the whole question at once.
            this.show(target);
            this._expand(target);
            this._eatClick = true;
        }, HOLD_MS);
    }

    /** @private */
    _onMove(e) {
        if (!this._holdTimer || !this._holdFrom) return;
        if (Math.abs(e.clientX - this._holdFrom.x) > HOLD_SLOP ||
            Math.abs(e.clientY - this._holdFrom.y) > HOLD_SLOP) {
            this._cancelHold();
        }
    }

    /**
     * Lifting before the hold fires is an ordinary tap. Lifting after it leaves
     * the tag up briefly, so the sentence survives the finger coming off it.
     * @private
     */
    _onUp() {
        this._cancelHold();
        if (this.current) {
            this._lingerTimer = window.setTimeout(() => this.hide(), LINGER_MS);
        }
    }

    /** @private */
    _cancelHold() {
        if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = 0; }
        this._holdFrom = null;
    }

    _onOver(e) {
        if (e.pointerType === 'touch') return; // a finger holds, it does not hover
        const target = e.target.closest && e.target.closest(SELECTOR);
        if (!target || target === this.current || target === this._pending) return;
        // Moving between buttons inside the warm window skips the wait — the
        // reader has already shown they are reading tooltips.
        const warm = (Date.now() - this._hiddenAt) < WARM_MS;
        this._arm(target, warm ? 0 : NAME_MS);
    }

    _onOut(e) {
        if (e.pointerType === 'touch') return; // the linger timer owns that path
        const target = e.target.closest && e.target.closest(SELECTOR);
        const active = this.current || this._pending;
        if (!active || target !== active) return;
        // Ignore moves that stay within the same element.
        if (e.relatedTarget && active.contains(e.relatedTarget)) return;
        this.hide();
    }

    _onFocus(e) {
        const target = e.target.closest && e.target.closest(SELECTOR);
        if (!target) return;
        // Only KEYBOARD focus asks for the tag: clicking or tapping a button
        // focuses it too, and there the user has just told us what it is by
        // pressing it. :focus-visible is the browser's own answer to that
        // question, so we do not have to track input modality ourselves.
        if (target.matches && !target.matches(':focus-visible')) return;
        // Focus is already a deliberate act — no dwell to prove intent.
        this._arm(target, 0);
    }

    _onBlur(e) {
        const target = e.target.closest && e.target.closest(SELECTOR);
        const active = this.current || this._pending;
        if (target && target === active) this.hide();
    }

    /**
     * Queue `target`'s name tag, then its description one dwell later.
     * @param {HTMLElement} target
     * @param {number} delay ms before the name tag appears (0 = now)
     * @private
     */
    _arm(target, delay) {
        this.hide(); // clears timers and restores any previous element's title
        this._pending = target;
        if (delay > 0) {
            this._nameTimer = window.setTimeout(() => this.show(target), delay);
        } else {
            this.show(target);
        }
    }

    /**
     * Show the name tag for `target` and start the description's dwell.
     * @param {HTMLElement} target
     */
    show(target) {
        if (!this.el) return;
        const { name, desc } = Helpers.splitTitle(target.getAttribute('title') || '');
        if (!name) return;

        // Whatever was described before gets its title back first — the touch
        // path reaches show() directly, without going through _arm.
        if (this.current && this.current !== target) this.hide();
        this._clearTimers();
        this._pending = null;

        // Suppress the native OS tooltip while ours is visible; the value is
        // restored on hide so I18n and assistive tech still see it.
        this.current = target;
        this._savedTitle = target.getAttribute('title');
        target.removeAttribute('title');

        this.nameEl.textContent = name;
        this.descEl.textContent = desc;
        this.descEl.hidden = true;
        this.el.hidden = false;
        this.el.setAttribute('aria-hidden', 'false');
        this._position(target);

        if (desc) {
            this._descTimer = window.setTimeout(() => this._expand(target), DESC_MS);
        }
    }

    /** Grow the name tag into the full description. @private */
    _expand(target) {
        if (this.current !== target || !this.descEl.textContent) return;
        this.descEl.hidden = false;
        this._position(target);
    }

    hide() {
        this._clearTimers();
        this._pending = null;
        if (this.current && this._savedTitle != null) {
            // Restore the localised title for I18n / native fallback / AT.
            this.current.setAttribute('title', this._savedTitle);
        }
        const wasShown = !!this.current;
        this.current = null;
        this._savedTitle = null;
        if (this.el) {
            this.el.hidden = true;
            this.el.setAttribute('aria-hidden', 'true');
            this.descEl.hidden = true;
        }
        if (wasShown) this._hiddenAt = Date.now();
    }

    /** @private */
    _clearTimers() {
        if (this._nameTimer) { clearTimeout(this._nameTimer); this._nameTimer = 0; }
        if (this._descTimer) { clearTimeout(this._descTimer); this._descTimer = 0; }
        if (this._lingerTimer) { clearTimeout(this._lingerTimer); this._lingerTimer = 0; }
    }

    _position(target) {
        const rect = target.getBoundingClientRect();
        const tip = this.el;
        // Measure after content is set (node is visible at this point).
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        // Prefer the right of the anchor (matches the fly-out direction);
        // flip to the left if it would leave the viewport.
        let left = rect.right + GAP;
        if (left + tw > vw - 2) {
            left = rect.left - GAP - tw;
        }
        left = clamp(left, 2, vw - tw - 2);

        // Vertically centre on the anchor, clamped into the viewport.
        const top = clamp(rect.top + (rect.height - th) / 2, 2, vh - th - 2);

        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
    }
}

window.Tooltip = new TooltipManagerClass();
window.Tooltip.SELECTOR = SELECTOR;

Logger.debug('Tooltip', 'Tooltip manager loaded');

})(); // End IIFE
