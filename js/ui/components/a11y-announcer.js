'use strict';
(function() {

/**
 * A11yAnnouncer — visually-hidden live-region announcer for assistive tech,
 * with optional spoken feedback (speech synthesis, off by default).
 *
 * Extracted from the old app.js _setupAnnouncer. Announces tool changes and
 * attribute paint-mode changes; other components call announce() directly.
 */
class A11yAnnouncerClass {
    constructor() {
        this._region = null;
        this._tts = false;
        this._ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
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
        this._region = document.getElementById('a11y-announcer');
        this._loadTtsState();

        EventBus.on(EVENTS.TOOL_SELECTED, (data) => {
            const id = data && data.currentTool;
            if (!id) return;
            this.announce(this._toolLabel(id));
        });

        EventBus.on(EVENTS.ATTR_PAINT_MODE, ({ mode }) => {
            if (mode === 'swap')       this.announce(this._t('a11y.attrModeSwap', 'Swap ink/paper mode on'));
            else if (mode === 'apply') this.announce(this._t('a11y.attrModeApply', 'Apply attributes mode on'));
            else                       this.announce(this._t('a11y.attrModeOff', 'Attribute mode off'));
        });

        Logger.debug('A11yAnnouncer', 'Initialized');
    }

    /** Resolve a tool id to its localised rail label. @private */
    _toolLabel(toolId) {
        for (const group of TOOL_GROUPS) {
            for (const meta of group.tools) {
                if (meta.id === toolId) return this._t(meta.i18n, toolId);
            }
        }
        // Shape variants report the variant id — fall back to the umbrella label
        return this._t(`tool.${toolId}`, toolId);
    }

    /**
     * Announce a message to assistive tech (and speak it if TTS is enabled).
     * @param {string} msg
     */
    announce(msg) {
        if (this._region && msg) {
            this._region.textContent = '';
            this._region.textContent = msg;
        }
        this._speak(msg);
    }

    /** @private */
    _speak(msg) {
        if (!this._tts || !this._ttsSupported || !msg) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            if (window.I18n && typeof I18n.getLocale === 'function') u.lang = I18n.getLocale();
            window.speechSynthesis.speak(u);
        } catch (e) { /* speech unavailable — ignore */ }
    }

    /**
     * Load the saved TTS preference at boot, independent of whether any
     * checkbox for it exists yet — speech must work from the very first
     * announcement of a session, not only after the artist has opened
     * Settings > Preferences once. @private
     */
    _loadTtsState() {
        if (!window.Storage) return;
        Promise.resolve(Storage.get('ttsEnabled')).then((v) => {
            this._tts = !!v;
        }).catch(() => {});
    }

    /**
     * Wire the Speak checkbox wherever one currently exists (Settings >
     * Preferences, moved there 2026-08-26 from the header). Unlike most of
     * this component's setup, this is NOT boot-time-only: the Preferences
     * dialog is rebuilt from scratch every time it opens, so MenuSystem
     * calls this again on every open rather than once at init().
     * @param {ParentNode} [root=document]
     */
    wireTtsToggle(root) {
        const ttsToggle = (root || document).querySelector('#tts-toggle');
        if (!ttsToggle) return;

        if (!this._ttsSupported) {
            ttsToggle.disabled = true;
            ttsToggle.title = 'Speech synthesis is not available in this browser';
            return;
        }

        ttsToggle.checked = this._tts;
        ttsToggle.addEventListener('change', () => {
            this._tts = ttsToggle.checked;
            if (window.Storage) Promise.resolve(Storage.set('ttsEnabled', this._tts)).catch(() => {});
            if (!this._tts) window.speechSynthesis.cancel();
        });
    }
}

window.A11yAnnouncer = new A11yAnnouncerClass();

Logger.debug('A11yAnnouncer', 'A11y announcer component loaded');

})(); // End IIFE
