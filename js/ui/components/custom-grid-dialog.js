'use strict';
(function() {

/**
 * CustomGridDialog - View > Custom Grid...
 *
 * Sets the X step and the Y step of the user-defined grid (ZX Paintbrush's
 * "user defined grid"), each independently, 1 pixel up to the screen size.
 * OK switches the grid on with those steps; Cancel, Escape and the close
 * button change nothing. GridOverlay owns the grid and its drawing; this file
 * only asks for the two numbers.
 */
class CustomGridDialogClass {
    /** English fallback + {param} interpolation until keys land. @private */
    _t(key, fallback, params) {
        return Helpers.localizedMessage(key, fallback, params);
    }

    open() {
        if (!window.GridOverlay) return;
        const maxX = ZX_SPECTRUM.WIDTH;
        const maxY = ZX_SPECTRUM.HEIGHT;
        const content = document.createElement('div');
        content.className = 'custom-grid-dialog-body';
        content.innerHTML = `
            <label class="pref-row">
                <span data-i18n="grid.custom.stepX">${this._t('grid.custom.stepX', 'X step (pixels)')}</span>
                <input type="number" id="custom-grid-x" name="custom-grid-x"
                       min="1" max="${maxX}" step="1" value="${GridOverlay.customStepX}">
            </label>
            <label class="pref-row">
                <span data-i18n="grid.custom.stepY">${this._t('grid.custom.stepY', 'Y step (pixels)')}</span>
                <input type="number" id="custom-grid-y" name="custom-grid-y"
                       min="1" max="${maxY}" step="1" value="${GridOverlay.customStepY}">
            </label>
            <div class="pref-block__hint" data-i18n="grid.custom.hint">${this._t('grid.custom.hint',
                'Lines are drawn every step pixels, X and Y set separately. Lines closer than 4 screen pixels apart are left out until you zoom in.')}</div>
        `;

        const num = (el, max, old) => {
            const n = Math.round(Number(el.value));
            return Number.isFinite(n) ? Helpers.clamp(n, 1, max) : old;
        };

        Dialog.open({
            id: 'custom-grid-dialog',
            titleI18n: 'view.customGridSettings.title',
            title: 'Custom Grid',
            content,
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'dialog.ok', label: 'OK', primary: true,
                    onClick: (dialog) => {
                        const x = num(dialog.querySelector('#custom-grid-x'), maxX, GridOverlay.customStepX);
                        const y = num(dialog.querySelector('#custom-grid-y'), maxY, GridOverlay.customStepY);
                        GridOverlay.setCustomGridSteps(x, y);
                        GridOverlay.setCustomGridVisible(true);
                    }
                }
            ]
        });
        const first = document.getElementById('custom-grid-x');
        if (first) first.focus();
    }
}

window.CustomGridDialog = new CustomGridDialogClass();

})();
