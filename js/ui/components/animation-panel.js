'use strict';
(function() {

function svgUse(iconId) {
    return `<svg class="row-icon" aria-hidden="true"><use href="#${iconId}"/></svg>`;
}

/** A captioned icon button, as the Layers panel builds them (layer-panel.js captionedIconBtn). */
function captionedIconBtn(capKey, capText, nameKey, name, hintKey, hint, attrs, iconId) {
    const btn = `<button type="button" ${attrs} data-i18n-title="${hintKey}" ` +
        `data-i18n-title-name="${nameKey}" data-i18n-aria-label="${nameKey}" ` +
        `aria-label="${Helpers.escapeHTML(Helpers.tr(nameKey, name))}" ` +
        `title="${Helpers.escapeHTML(Helpers.composeTitle(Helpers.tr(nameKey, name), Helpers.tr(hintKey, hint)))}">` +
        `${svgUse(iconId)}</button>`;
    return Helpers.captionedButton(btn, capKey, capText);
}

/** An icon button with its name and what it does in the tooltip (no caption: the symbols say it). */
function iconBtn(nameKey, name, hintKey, hint, attrs, iconId) {
    return `<button type="button" ${attrs} data-i18n-title="${hintKey}" ` +
        `data-i18n-title-name="${nameKey}" data-i18n-aria-label="${nameKey}" ` +
        `aria-label="${Helpers.escapeHTML(Helpers.tr(nameKey, name))}" ` +
        `title="${Helpers.escapeHTML(Helpers.composeTitle(Helpers.tr(nameKey, name), Helpers.tr(hintKey, hint)))}">` +
        `${svgUse(iconId)}</button>`;
}

/**
 * AnimationPanel - the right-hand Animation panel: the animation picker, the
 * play controls, the frame strip and the frame settings. Built the way the
 * Transform and Reference panels are (tool-option rows, decorated sliders),
 * and drawn only from AnimationService facts (ANIMATION_CHANGED /
 * ANIMATION_FRAME); commands go straight down to AnimationService.
 *
 * Hidden until there is an animation (View > Animation shows it any time).
 */
class AnimationPanelClass {
    constructor() {
        this.ID = 'animation-panel';
        /** [A] How often the shown frame's thumbnail follows drawing: four times a second is enough for a strip. */
        this.THUMB_REFRESH_MS = 250;
        /** [A] Thumbnails drawn per idle moment, so a long strip fills in without holding up the page. */
        this.THUMBS_PER_CHUNK = 8;
        this._el = {};
        this._thumbs = new WeakMap();     // Frame -> ImageData (frames are immutable)
        this._thumbTimer = null;
        this._fillTimer = null;
        this._paletteKey = null;
    }

    init() {
        const panel = PanelSection.create({
            id: this.ID,
            titleI18n: 'panels.animation',
            title: 'Animation',
            hintI18n: 'panels.animation.hint',
            hint: 'Frames of the picture or of a sprite: play them, step through them, and set each frame\'s delay. Right-click this header to move the whole panel up or down',
            visible: false
        });
        if (!panel) return;
        this._content = panel.content;
        this._build(panel.content);
        if (window.OptionControls) OptionControls.decorateSliders(panel.content);

        EventBus.on(EVENTS.ANIMATION_CHANGED, () => {
            if (AnimationService.hasAnimations() && !PanelSection.isVisible(this.ID)) PanelSection.setVisible(this.ID, true);
            this._renderAll();
        });
        EventBus.on(EVENTS.ANIMATION_FRAME, () => this._renderFrameState());
        EventBus.on(EVENTS.CANVAS_RENDER, () => this._scheduleLiveThumb());
        for (const name of ['SCREEN_MODE_CHANGED', 'LAYER_VISIBILITY', 'LAYER_ORDER', 'PANEL_VISIBILITY_CHANGED']) {
            EventBus.on(EVENTS[name], () => { this._thumbs = new WeakMap(); this._renderStrip(); });
        }
        this._renderAll();
    }

    isShown() {
        return !!this._content && PanelSection.isVisible(this.ID) && !PanelSection.isCollapsed(this.ID);
    }

    // ── Markup ──────────────────────────────────────────────────────────────

    /** @private */
    _build(content) {
        const t = (k, f) => Helpers.escapeHTML(Helpers.tr(k, f));
        content.innerHTML = `
            <div class="anim-empty panel-help"><small data-i18n="anim.empty">${t('anim.empty', 'No animation yet. Start one from the whole picture, or from a block of it for a sprite.')}</small></div>
            <div class="anim-buttons anim-new-row">
                <button type="button" class="panel-button anim-new-screen" data-i18n="menu.animation.newScreen">${t('menu.animation.newScreen', 'New Screen Animation')}</button>
                <button type="button" class="panel-button anim-new-sprite" data-i18n="menu.animation.newSprite">${t('menu.animation.newSprite', 'New Sprite Animation...')}</button>
            </div>
            <div class="anim-body">
                <div class="anim-row anim-picker-row">
                    <label for="anim-picker" data-i18n="anim.animation">${t('anim.animation', 'Animation')}</label>
                    <select id="anim-picker" class="anim-picker"></select>
                    <button type="button" class="layer-btn anim-rename" data-i18n-title="anim.rename" data-i18n-aria-label="anim.rename"
                            title="${t('anim.rename', 'Rename animation')}" aria-label="${t('anim.rename', 'Rename animation')}">${svgUse('icon-rename')}</button>
                    <button type="button" class="layer-btn anim-delete" data-i18n-title="anim.delete" data-i18n-aria-label="anim.delete"
                            title="${t('anim.delete', 'Delete animation (its layers keep the frame shown)')}" aria-label="${t('anim.delete', 'Delete animation (its layers keep the frame shown)')}">${svgUse('icon-trash')}</button>
                </div>
                <div class="anim-transport" role="group" aria-label="${t('anim.transport', 'Play controls')}" data-i18n-aria-label="anim.transport">
                    ${iconBtn('anim.first', 'First Frame', 'anim.first.hint', 'Go to the first frame', 'class="layer-ctrl-btn anim-first"', 'icon-anim-first')}
                    ${iconBtn('anim.previous', 'Previous Frame', 'anim.previous.hint', 'Go to the frame before (,). Hold to keep stepping', 'class="layer-ctrl-btn anim-prev"', 'icon-anim-prev')}
                    ${iconBtn('anim.play', 'Play or Pause', 'anim.play.hint', 'Play the animation, or pause it on the frame shown (Enter)', 'class="layer-ctrl-btn anim-play"', 'icon-anim-play')}
                    ${iconBtn('anim.stop', 'Stop', 'anim.stop.hint', 'Stop playing and go back to the frame playing started from', 'class="layer-ctrl-btn anim-stop"', 'icon-anim-stop')}
                    ${iconBtn('anim.next', 'Next Frame', 'anim.next.hint', 'Go to the frame after (.). Hold to keep stepping', 'class="layer-ctrl-btn anim-next"', 'icon-anim-next')}
                    ${iconBtn('anim.last', 'Last Frame', 'anim.last.hint', 'Go to the last frame', 'class="layer-ctrl-btn anim-last"', 'icon-anim-last')}
                </div>
                <div class="tool-option anim-scrub-row">
                    <span class="anim-readout" aria-live="polite"></span>
                    <input type="range" class="anim-scrub" min="1" max="1" step="1" value="1"
                           aria-label="${t('anim.scrub', 'Frame shown')}" data-i18n-aria-label="anim.scrub">
                </div>
                <div class="anim-strip" role="listbox" aria-label="${t('anim.frames', 'Frames')}" data-i18n-aria-label="anim.frames"></div>
                <div class="anim-frame-controls" role="group" aria-label="${t('anim.frameControls', 'Frame controls')}" data-i18n-aria-label="anim.frameControls">
                    ${captionedIconBtn('cap.add', 'Add', 'anim.addFrame', 'Add Frame', 'anim.addFrame.hint', 'Add a blank frame after the one shown', 'class="layer-ctrl-btn anim-add"', 'icon-plus')}
                    ${captionedIconBtn('cap.duplicate', 'Duplicate', 'anim.duplicateFrame', 'Duplicate Frame', 'anim.duplicateFrame.hint', 'Add a copy of the frame shown after it', 'class="layer-ctrl-btn anim-dup"', 'icon-duplicate')}
                    ${captionedIconBtn('cap.delete', 'Delete', 'anim.deleteFrame', 'Delete Frame', 'anim.deleteFrame.hint', 'Delete the frame shown', 'class="layer-ctrl-btn anim-del"', 'icon-minus')}
                    <span class="layer-ctrl-divider"></span>
                    ${captionedIconBtn('cap.left', 'Left', 'anim.moveEarlier', 'Move Frame Earlier', 'anim.moveEarlier.hint', 'Move the frame shown one place earlier', 'class="layer-ctrl-btn anim-earlier"', 'icon-anim-prev')}
                    ${captionedIconBtn('cap.right', 'Right', 'anim.moveLater', 'Move Frame Later', 'anim.moveLater.hint', 'Move the frame shown one place later', 'class="layer-ctrl-btn anim-later"', 'icon-anim-next')}
                </div>
                <div class="anim-row anim-delay-row">
                    <label for="anim-delay" data-i18n="anim.delay" data-i18n-title="anim.delay.hint"
                           title="${t('anim.delay.hint', 'How long the frame shown stays on screen, in Spectrum frames (50 a second)')}">${t('anim.delay', 'Delay (1/50 s)')}</label>
                    <input type="number" id="anim-delay" class="anim-delay" min="1" max="${AnimationServiceClass.MAX_DELAY_TICKS}" step="1">
                    <button type="button" class="panel-button small anim-delay-all" data-i18n="anim.setAll" data-i18n-title="anim.setAll.hint"
                            title="${t('anim.setAll.hint', 'Give every frame this delay')}">${t('anim.setAll', 'Set all')}</button>
                </div>
                <div class="tool-option">
                    <label for="anim-repeat" data-i18n="anim.repeat">${t('anim.repeat', 'Repeat')}</label>
                    <select id="anim-repeat" class="anim-repeat">
                        <option value="loop" data-i18n="anim.repeat.loop">${t('anim.repeat.loop', 'Loop')}</option>
                        <option value="once" data-i18n="anim.repeat.once">${t('anim.repeat.once', 'Once')}</option>
                        <option value="pingpong" data-i18n="anim.repeat.pingpong">${t('anim.repeat.pingpong', 'Ping-pong')}</option>
                    </select>
                </div>
                <div class="tool-option">
                    <label for="anim-speed" data-i18n="anim.speed" data-i18n-title="anim.speed.hint"
                           title="${t('anim.speed.hint', 'Plays faster or slower without changing the delays')}">${t('anim.speed', 'Speed')}</label>
                    <select id="anim-speed" class="anim-speed">
                        ${[0.25, 0.5, 1, 2, 4].map(v => `<option value="${v}">x${v}</option>`).join('')}
                    </select>
                </div>
                <div class="anim-row anim-range-row">
                    <label for="anim-from" data-i18n="anim.range" data-i18n-title="anim.range.hint"
                           title="${t('anim.range.hint', 'Play only these frames')}">${t('anim.range', 'Play frames')}</label>
                    <input type="number" id="anim-from" class="anim-from" min="1" step="1">
                    <span data-i18n="anim.rangeTo">${t('anim.rangeTo', 'to')}</span>
                    <input type="number" class="anim-to" min="1" step="1"
                           aria-label="${t('anim.rangeToFrame', 'Last frame to play')}" data-i18n-aria-label="anim.rangeToFrame">
                </div>
                <label class="anim-row" data-i18n-title="anim.onion.hint"
                       title="${t('anim.onion.hint', 'Show the frames before and after faded, as preview layers in the Layers panel (set their opacity there)')}">
                    <input type="checkbox" class="anim-onion">
                    <span data-i18n="anim.onion">${t('anim.onion', 'Onion skin')}</span>
                </label>
            </div>
        `;
        const q = (s) => content.querySelector(s);
        this._el = {
            empty: q('.anim-empty'), newRow: q('.anim-new-row'), body: q('.anim-body'),
            picker: q('.anim-picker'), rename: q('.anim-rename'), del: q('.anim-delete'),
            first: q('.anim-first'), prev: q('.anim-prev'), play: q('.anim-play'), stop: q('.anim-stop'),
            next: q('.anim-next'), last: q('.anim-last'),
            readout: q('.anim-readout'), scrub: q('.anim-scrub'), strip: q('.anim-strip'),
            add: q('.anim-add'), dup: q('.anim-dup'), delFrame: q('.anim-del'),
            earlier: q('.anim-earlier'), later: q('.anim-later'),
            delay: q('.anim-delay'), delayAll: q('.anim-delay-all'),
            repeat: q('.anim-repeat'), speed: q('.anim-speed'), from: q('.anim-from'), to: q('.anim-to'),
            onion: q('.anim-onion')
        };
        const e = this._el;
        const S = AnimationService;
        q('.anim-new-screen').addEventListener('click', () => S.createScreen());
        q('.anim-new-sprite').addEventListener('click', () => window.NewSpriteDialog && NewSpriteDialog.open());
        e.picker.addEventListener('change', () => S.open(Number(e.picker.value)));
        e.rename.addEventListener('click', () => this._rename());
        e.del.addEventListener('click', () => this.confirmDeleteOpen());
        e.first.addEventListener('click', () => { S.pause(); S.first(); });
        Helpers.attachRepeatPress(e.prev, () => { S.pause(); S.previous(); });
        e.play.addEventListener('click', () => S.togglePlay());
        e.stop.addEventListener('click', () => S.stop());
        Helpers.attachRepeatPress(e.next, () => { S.pause(); S.next(); });
        e.last.addEventListener('click', () => { S.pause(); S.last(); });
        e.scrub.addEventListener('input', () => { S.pause(); S.goTo(Number(e.scrub.value) - 1); });
        e.add.addEventListener('click', () => S.addFrame());
        e.dup.addEventListener('click', () => S.duplicateFrame());
        e.delFrame.addEventListener('click', () => S.deleteFrame());
        e.earlier.addEventListener('click', () => S.moveFrame(-1));
        e.later.addEventListener('click', () => S.moveFrame(1));
        e.delay.addEventListener('change', () => S.setDelay(e.delay.value));
        e.delayAll.addEventListener('click', () => S.setAllDelays(e.delay.value));
        e.repeat.addEventListener('change', () => S.setRepeat(e.repeat.value));
        e.speed.addEventListener('change', () => S.setSpeed(e.speed.value));
        const range = () => {
            const from = Math.max(1, Number(e.from.value) || 1) - 1;
            const to = e.to.value === '' ? null : Math.max(1, Number(e.to.value) || 1) - 1;
            S.setRange(from, to);
        };
        e.from.addEventListener('change', range);
        e.to.addEventListener('change', range);
        e.onion.addEventListener('change', () => S.setOnionSkin(e.onion.checked));
        e.strip.addEventListener('click', (ev) => {
            const item = ev.target.closest('.anim-frame');
            if (!item) return;
            if (ev.target.closest('.anim-trace')) { S.toggleTrace(Number(item.dataset.index)); return; }
            S.pause();
            S.goTo(Number(item.dataset.index));
        });
        e.strip.addEventListener('keydown', (ev) => {
            const item = ev.target.closest('.anim-frame');
            if (!item || (ev.key !== 'Enter' && ev.key !== ' ')) return;
            ev.preventDefault();
            S.pause();
            S.goTo(Number(item.dataset.index));
        });
    }

    /** Animation > Delete Animation and the panel's bin: asks first. */
    confirmDeleteOpen() {
        const a = AnimationService.getOpen();
        if (a && confirm(Helpers.localizedMessage('anim.confirmDelete',
            'Delete the animation "{name}"? Its layers keep the frame shown; the other frames are lost (Undo brings them back).', { name: a.name }))) {
            AnimationService.deleteAnimation(a.id);
        }
    }

    _rename() {
        const a = AnimationService.getOpen();
        if (!a) return;
        const name = prompt(Helpers.localizedMessage('anim.renamePrompt', 'Name of the animation:'), a.name);
        if (name !== null) AnimationService.rename(a.id, name);
    }

    // ── Rendering from facts ────────────────────────────────────────────────

    _renderAll() {
        const e = this._el;
        if (!e.body) return;
        const S = AnimationService;
        const any = S.hasAnimations();
        e.empty.hidden = any;
        e.body.hidden = !any;
        e.picker.textContent = '';
        for (const a of S.animations) {
            const o = document.createElement('option');
            o.value = String(a.id);
            o.textContent = a.name;
            if (a.id === S.openId) o.selected = true;
            e.picker.appendChild(o);
        }
        e.repeat.value = S.getRepeat();
        e.onion.checked = S.isOnionSkin();
        e.speed.value = String(S.getSpeed());
        this._renderStrip();
        this._renderFrameState();
    }

    _renderFrameState() {
        const e = this._el;
        const S = AnimationService;
        const a = S.getOpen();
        if (!e.body || !a) return;
        const n = a.frames.length;
        e.readout.textContent = Helpers.localizedMessage('anim.readout', 'Frame {n} of {count}', { n: a.current + 1, count: n });
        e.scrub.max = String(n);
        e.scrub.value = String(a.current + 1);
        e.scrub.disabled = n < 2;
        if (document.activeElement !== e.delay) e.delay.value = String(a.frames[a.current].delayTicks);
        const { from, to } = S.getRange(a);
        e.from.max = e.to.max = String(n);
        if (document.activeElement !== e.from) e.from.value = String(from + 1);
        if (document.activeElement !== e.to) e.to.value = String(to + 1);
        const playing = S.isPlaying();
        e.play.classList.toggle('active', playing);
        e.play.setAttribute('aria-pressed', String(playing));
        const use = e.play.querySelector('use');
        if (use) use.setAttribute('href', playing ? '#icon-anim-pause' : '#icon-anim-play');
        e.delFrame.disabled = n < 2;
        e.earlier.disabled = a.current === 0;
        e.later.disabled = a.current === n - 1;
        for (const item of e.strip.children) {
            const on = Number(item.dataset.index) === a.current;
            item.classList.toggle('current', on);
            item.setAttribute('aria-selected', String(on));
            if (on && playing === false) item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        if (!playing) this._drawThumb(a, a.current, true);
    }

    _renderStrip() {
        const e = this._el;
        if (!e.strip) return;
        const a = AnimationService.getOpen();
        e.strip.textContent = '';
        clearTimeout(this._fillTimer);
        this._fillTimer = null;
        if (!a) return;
        a.frames.forEach((f, i) => {
            const item = document.createElement('div');
            item.className = 'anim-frame';
            item.dataset.index = String(i);
            item.tabIndex = 0;
            item.setAttribute('role', 'option');
            const canvas = document.createElement('canvas');
            canvas.className = 'anim-thumb';
            canvas.width = a.rect.cw * ZX_SPECTRUM.CELL_WIDTH;
            canvas.height = a.rect.ch * ZX_SPECTRUM.CELL_HEIGHT;
            const label = document.createElement('span');
            label.className = 'anim-frame-label';
            const num = document.createElement('b');
            num.textContent = String(i + 1);
            const delay = document.createElement('small');
            delay.textContent = String(f.delayTicks);
            label.append(num, delay);
            const trace = document.createElement('button');
            trace.type = 'button';
            const traced = AnimationService.isTraced(i, a);
            trace.className = 'anim-trace' + (traced ? ' active' : '');
            trace.setAttribute('aria-pressed', String(traced));
            trace.textContent = Helpers.tr('anim.trace', 'Trace');
            trace.title = Helpers.tr('anim.trace.hint', 'Show this frame faded while you draw the others (a preview layer in the Layers panel)');
            item.title = Helpers.localizedMessage('anim.frameTitle', 'Frame {n}, delay {delay}/50 s', { n: i + 1, delay: f.delayTicks });
            item.append(canvas, label, trace);
            e.strip.appendChild(item);
        });
        this._fillThumbs(a, 0);
    }

    /** Draw the strip's thumbnails a few at a time; nothing stays scheduled once they are drawn. */
    _fillThumbs(a, start) {
        if (!this.isShown() || AnimationService.getOpen() !== a) return;
        const end = Math.min(a.frames.length, start + this.THUMBS_PER_CHUNK);
        for (let i = start; i < end; i++) this._drawThumb(a, i, i === a.current);
        if (end < a.frames.length) this._fillTimer = setTimeout(() => this._fillThumbs(a, end), 0);
        else this._fillTimer = null;
    }

    _drawThumb(a, i, live) {
        const item = this._el.strip && this._el.strip.children[i];
        if (!item || !this.isShown()) return;
        const canvas = item.querySelector('canvas');
        const frame = a.frames[i];
        let img = !live && this._thumbs.get(frame);
        if (!img) {
            const pic = AnimationService.renderFrame(a, i);
            if (!pic) return;
            img = new ImageData(new Uint8ClampedArray(pic.words.buffer), pic.width, pic.height);
            if (!live) this._thumbs.set(frame, img);
        }
        if (canvas.width !== img.width) canvas.width = img.width;
        if (canvas.height !== img.height) canvas.height = img.height;
        canvas.getContext('2d').putImageData(img, 0, 0);
    }

    /** The frame shown follows drawing, at most every THUMB_REFRESH_MS. */
    _scheduleLiveThumb() {
        if (this._thumbTimer || !this.isShown() || AnimationService.isPlaying()) return;
        const a = AnimationService.getOpen();
        if (!a) return;
        this._thumbTimer = setTimeout(() => {
            this._thumbTimer = null;
            const b = AnimationService.getOpen();
            if (b && !AnimationService.isPlaying()) this._drawThumb(b, b.current, true);
        }, this.THUMB_REFRESH_MS);
    }
}

window.AnimationPanel = new AnimationPanelClass();

})();
