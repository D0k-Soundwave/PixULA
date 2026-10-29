'use strict';
(function() {

/**
 * NewSpriteDialog - Animation > New Sprite Animation...
 *
 * Asks for the sprite's name, size (typed, a quick pick, or the current
 * selection), position and starting frame count. The size is rounded up to
 * whole cells of the screen mode, and the dialog says what it became before
 * OK. To place a sprite by clicking, select the block first (Selection tool,
 * Size = Custom): the dialog then fills in from it. AnimationService makes
 * the animation; this file only asks for the numbers.
 */
class NewSpriteDialogClass {
    constructor() {
        /** [A] Quick picks: common square sprite sizes. Any size that fits can be typed. */
        this.QUICK_SIZES = [8, 16, 24, 32, 48];
        /** [A] Most frames to start with: an input guard only; frames can be added afterwards. */
        this.MAX_START_FRAMES = 999;
    }

    _t(key, fallback, params) {
        return Helpers.localizedMessage(key, fallback, params);
    }

    /**
     * @param {{fromSelection?: boolean}} [opts] - fromSelection also brings the selected pixels in as frame 1
     */
    open({ fromSelection = false } = {}) {
        if (!window.AnimationService) return;
        const sel = window.SelectionService && SelectionService.hasSelection() ? SelectionService.getSelection() : null;
        if (fromSelection && !sel) {
            EventBus.emit(EVENTS.STATUS_NOTICE, { text: this._t('anim.needSelection', 'Select a block of the picture first.') });
            return;
        }
        const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
        let init = sel ? AnimationServiceClass.rectFromSelection(sel) : null;
        if (!init) {
            const v = CanvasSystem.getVisibleRect ? CanvasSystem.getVisibleRect() : null;
            const mx = v ? v.x + v.w / 2 : W / 2, my = v ? v.y + v.h / 2 : H / 2;
            init = AnimationServiceClass.rectFromPixels(mx - 8, my - 8, 16, 16);
        }
        const px = (r) => ({ x: r.cx * ZX_SPECTRUM.CELL_WIDTH, y: r.cy * ZX_SPECTRUM.CELL_HEIGHT,
                             w: r.cw * ZX_SPECTRUM.CELL_WIDTH, h: r.ch * ZX_SPECTRUM.CELL_HEIGHT });
        const p = px(init);
        const content = document.createElement('div');
        content.className = 'new-sprite-dialog-body';
        content.innerHTML = `
            <label class="pref-row">
                <span data-i18n="anim.name">${this._t('anim.name', 'Name')}</span>
                <input type="text" id="new-sprite-name" maxlength="40" value="${Helpers.escapeHTML(AnimationService._defaultName('sprite'))}">
            </label>
            <div class="pref-row new-sprite-quick" role="group" aria-label="${Helpers.escapeHTML(this._t('anim.quickSizes', 'Quick sizes'))}" data-i18n-aria-label="anim.quickSizes">
                <span data-i18n="anim.quickSizes">${this._t('anim.quickSizes', 'Quick sizes')}</span>
                ${this.QUICK_SIZES.map(s => `<button type="button" class="new-sprite-pick" data-size="${s}">${s} x ${s}</button>`).join('')}
            </div>
            <label class="pref-row">
                <span data-i18n="anim.width">${this._t('anim.width', 'Width (pixels)')}</span>
                <input type="number" id="new-sprite-w" min="1" max="${W}" step="1" value="${p.w}">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.height">${this._t('anim.height', 'Height (pixels)')}</span>
                <input type="number" id="new-sprite-h" min="1" max="${H}" step="1" value="${p.h}">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.posX">${this._t('anim.posX', 'X (pixels)')}</span>
                <input type="number" id="new-sprite-x" min="0" max="${W - 1}" step="1" value="${p.x}">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.posY">${this._t('anim.posY', 'Y (pixels)')}</span>
                <input type="number" id="new-sprite-y" min="0" max="${H - 1}" step="1" value="${p.y}">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.startFrames">${this._t('anim.startFrames', 'Frames to start with')}</span>
                <input type="number" id="new-sprite-frames" min="1" max="${this.MAX_START_FRAMES}" step="1" value="1">
            </label>
            <div class="pref-row">
                <button type="button" id="new-sprite-use-sel" data-i18n="anim.useSelection" ${sel ? '' : 'disabled'}>${this._t('anim.useSelection', 'Use selection')}</button>
            </div>
            <div class="pref-block__hint new-sprite-result" aria-live="polite"></div>
            <div class="pref-block__hint" data-i18n="anim.newSpriteHint">${this._t('anim.newSpriteHint',
                'Sizes are rounded up to whole attribute cells, so a frame never splits a cell\'s colours. To place the sprite by clicking, select the block first with the Selection tool (Size: Custom).')}</div>
        `;

        const $ = (id) => content.querySelector('#' + id);
        const read = () => AnimationServiceClass.rectFromPixels(
            Number($('new-sprite-x').value), Number($('new-sprite-y').value),
            Number($('new-sprite-w').value), Number($('new-sprite-h').value));
        const show = () => {
            const r = read();
            const out = content.querySelector('.new-sprite-result');
            if (!r) { out.textContent = this._t('anim.sizeInvalid', 'Type a width and height of at least 1 pixel.'); return; }
            const q = px(r);
            const typedW = Math.round(Number($('new-sprite-w').value)), typedH = Math.round(Number($('new-sprite-h').value));
            out.textContent = (q.w !== typedW || q.h !== typedH)
                ? this._t('anim.sizeRounded', '{w} x {h} becomes {rw} x {rh} at {x}, {y}.', { w: typedW, h: typedH, rw: q.w, rh: q.h, x: q.x, y: q.y })
                : this._t('anim.sizeExact', '{rw} x {rh} at {x}, {y}.', { rw: q.w, rh: q.h, x: q.x, y: q.y });
        };
        content.addEventListener('input', show);
        for (const b of content.querySelectorAll('.new-sprite-pick')) {
            b.addEventListener('click', () => { $('new-sprite-w').value = b.dataset.size; $('new-sprite-h').value = b.dataset.size; show(); });
        }
        $('new-sprite-use-sel').addEventListener('click', () => {
            const r = sel && AnimationServiceClass.rectFromSelection(sel);
            if (!r) return;
            const q = px(r);
            $('new-sprite-x').value = q.x; $('new-sprite-y').value = q.y;
            $('new-sprite-w').value = q.w; $('new-sprite-h').value = q.h;
            show();
        });
        show();

        Dialog.open({
            id: 'new-sprite-dialog',
            titleI18n: 'anim.newSpriteTitle',
            title: 'New Sprite Animation',
            content,
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'dialog.ok', label: 'OK', primary: true,
                    onClick: () => {
                        const rect = read();
                        if (!rect) { show(); return false; }   // stays open, saying why
                        const frames = Helpers.clamp(Math.round(Number($('new-sprite-frames').value)) || 1, 1, this.MAX_START_FRAMES);
                        const fromLayer = fromSelection ? LayerManager.getCurrentLayer() : null;
                        const anim = AnimationService.createSprite({
                            name: $('new-sprite-name').value.trim() || null,
                            rect, frames,
                            fromLayer: fromLayer && !fromLayer.isStamp ? fromLayer : null
                        });
                        if (anim && fromSelection && window.SelectionService) SelectionService.clear();
                        return anim ? undefined : false;
                    }
                }
            ]
        });
        const first = document.getElementById('new-sprite-w');
        if (first) first.focus();
    }
}

window.NewSpriteDialog = new NewSpriteDialogClass();

})();
