'use strict';
(function() {

/**
 * CompanionDialog — Settings > Companion…. Shows connection status,
 * offers Connect (drives CompanionBridgeService.pair(), which blocks
 * until the artist clicks Enable Pairing in the companion's tray menu),
 * and lists authorized folders (informational only here — folders are
 * chosen from the feature that needs one, e.g. Backup Folder settings,
 * not from this dialog).
 */
class CompanionDialogClass {
    /** English fallback helper (same pattern as the other components). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    async open() {
        const content = document.createElement('div');
        content.className = 'companion-dialog';

        const status = document.createElement('p');
        status.className = 'companion-dialog-status';
        content.appendChild(status);

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'panel-button companion-dialog-refresh';
        refreshBtn.dataset.i18n = 'companion.refresh';
        refreshBtn.textContent = this._t('companion.refresh', 'Check Again');

        const connectBtn = document.createElement('button');
        connectBtn.type = 'button';
        connectBtn.className = 'panel-button companion-dialog-connect';
        connectBtn.dataset.i18n = 'companion.connect';
        connectBtn.textContent = this._t('companion.connect', 'Connect');

        content.appendChild(refreshBtn);
        content.appendChild(connectBtn);

        const render = () => {
            const state = CompanionBridgeService.getState();
            if (!state.running) {
                status.textContent = this._t('companion.notRunning', 'Companion not running');
                connectBtn.hidden = true;
            } else if (!state.paired) {
                status.textContent = this._t('companion.notConnected', 'Companion running, not connected');
                connectBtn.hidden = false;
            } else {
                status.textContent = this._t('companion.connected', 'Connected');
                connectBtn.hidden = true;
            }
        };

        refreshBtn.addEventListener('click', async () => {
            await CompanionBridgeService.checkStatus();
            render();
        });

        connectBtn.addEventListener('click', async () => {
            status.textContent = this._t('companion.waiting', 'Click Enable Pairing in the companion tray icon...');
            try {
                await CompanionBridgeService.pair();
            } catch (error) {
                Logger.warn('CompanionDialog', 'Pairing failed', error);
            }
            render();
        });

        await CompanionBridgeService.checkStatus();
        render();

        Dialog.open({
            id: 'companion',
            titleI18n: 'companion.title',
            title: 'Companion',
            content
        });
    }
}

window.CompanionDialog = new CompanionDialogClass();

Logger.debug('CompanionDialog', 'CompanionDialog component loaded');

})(); // End IIFE
