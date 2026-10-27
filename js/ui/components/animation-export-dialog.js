'use strict';
(function() {

/**
 * AnimationExportDialog - Animation > Export > Numbered Screens...
 *
 * Asks for the screen format (the ones the mode can save), the base name,
 * the first number, how many digits and which frames, then hands them to
 * AnimationExport. Says where the files will go: a folder the browser lets
 * it write into, or one .zip.
 */
class AnimationExportDialogClass {
    _t(key, fallback, params) { return Helpers.localizedMessage(key, fallback, params); }

    open() {
        const why = AnimationExport.refusal('screens');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return; }
        const a = AnimationService.getOpen();
        const n = a.frames.length;
        const formats = AnimationExport.screenFormats();
        const folder = typeof BrowserFSAProvider === 'function' && new BrowserFSAProvider().isAvailable();
        const esc = (v) => Helpers.escapeHTML(String(v));
        const content = document.createElement('div');
        content.className = 'anim-export-dialog-body';
        content.innerHTML = `
            <label class="pref-row">
                <span data-i18n="anim.export.format">${esc(this._t('anim.export.format', 'Screen format'))}</span>
                <select id="anim-export-format">${formats.map(([ext, label]) => `<option value="${ext}">${esc(label)}</option>`).join('')}</select>
            </label>
            <label class="pref-row">
                <span data-i18n="anim.export.base">${esc(this._t('anim.export.base', 'File name'))}</span>
                <input type="text" id="anim-export-base" maxlength="60" value="${esc(AnimationExport.baseName(a))}">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.export.first">${esc(this._t('anim.export.first', 'First number'))}</span>
                <input type="number" id="anim-export-first" min="0" max="99999" step="1" value="1">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.export.digits">${esc(this._t('anim.export.digits', 'Digits'))}</span>
                <input type="number" id="anim-export-digits" min="1" max="6" step="1" value="3">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.export.from">${esc(this._t('anim.export.from', 'From frame'))}</span>
                <input type="number" id="anim-export-from" min="1" max="${n}" step="1" value="1">
            </label>
            <label class="pref-row">
                <span data-i18n="anim.export.to">${esc(this._t('anim.export.to', 'To frame'))}</span>
                <input type="number" id="anim-export-to" min="1" max="${n}" step="1" value="${n}">
            </label>
            <div class="pref-block__hint anim-export-example" aria-live="polite"></div>
            <div class="pref-block__hint">${esc(folder
                ? this._t('anim.export.whereFolder', 'You choose a folder next, and every screen is written into it.')
                : this._t('anim.export.whereZip', 'This browser cannot write into a folder, so the screens are saved together as one .zip.'))}</div>
        `;
        const $ = (id) => content.querySelector('#' + id);
        const read = () => {
            const from = Helpers.clamp(Math.round(Number($('anim-export-from').value)) || 1, 1, n) - 1;
            const to = Helpers.clamp(Math.round(Number($('anim-export-to').value)) || n, 1, n) - 1;
            const lo = from <= to ? from : to, hi = from <= to ? to : from;
            return {
                ext: $('anim-export-format').value,
                base: $('anim-export-base').value.replace(/[\\/:*?"<>|\x00-\x1F]+/g, '').trim() || AnimationExport.baseName(a),
                first: Helpers.clamp(Math.round(Number($('anim-export-first').value)) || 0, 0, 99999),
                digits: Helpers.clamp(Math.round(Number($('anim-export-digits').value)) || 3, 1, 6),
                from: lo, to: hi
            };
        };
        const show = () => {
            const o = read();
            const count = o.to - o.from + 1;
            const width = Math.max(o.digits, String(o.first + count - 1).length);
            content.querySelector('.anim-export-example').textContent = this._t('anim.export.example',
                '{count} files: {first} ... {last}', {
                    count,
                    first: AnimationExport.numberedName(o.base, o.ext, o.first, width),
                    last: AnimationExport.numberedName(o.base, o.ext, o.first + count - 1, width)
                });
        };
        content.addEventListener('input', show);
        content.addEventListener('change', show);
        show();

        Dialog.open({
            id: 'anim-export-dialog',
            titleI18n: 'anim.export.title',
            title: 'Export Numbered Screens',
            content,
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'dialog.ok', label: 'OK', primary: true,
                    // Not awaited: the folder picker must open straight from this click.
                    onClick: () => { AnimationExport.exportNumbered(read()); }
                }
            ]
        });
    }
}

window.AnimationExportDialog = new AnimationExportDialogClass();

})();
