'use strict';
(function() {

const COMPANION_BASE_URL = 'http://127.0.0.1:51973';
const TOKEN_KEY = 'token';

/**
 * CompanionBridgeService — the companion's connection state, mirroring
 * BackupService's needsPermission/getState shape (see the design spec's
 * "Failure behavior" table) so the rest of the app has one error
 * vocabulary for "an optional file-access backend isn't available right
 * now" regardless of which backend it is.
 */
class CompanionBridgeServiceClass {
    constructor() {
        this.running = false;
        this.paired = false;
        this.token = null;
    }

    async init() {
        const stored = await Storage.get(TOKEN_KEY, Storage.STORES.COMPANION);
        if (stored) {
            this.token = stored;
            this.paired = true;
        }
    }

    getState() {
        return { running: this.running, paired: this.paired, token: this.token };
    }

    /** A ready CompanionFileProvider, or null until paired. */
    getProvider() {
        if (!this.paired || !this.token) return null;
        return new CompanionFileProvider(() => this.token);
    }

    /** Unauthenticated existence check - never confers trust. */
    async checkStatus() {
        try {
            const res = await fetch(`${COMPANION_BASE_URL}/status`);
            this.running = res.ok;
        } catch (error) {
            this.running = false;
        }
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
        return this.running;
    }

    /**
     * Long-poll /pair. Resolves once the artist clicks Enable Pairing in
     * the companion's tray menu (never triggered by any web page - see
     * the design spec §4.2 and this plan's Global Constraints).
     */
    async pair() {
        const res = await fetch(`${COMPANION_BASE_URL}/pair`, { method: 'POST' });
        if (!res.ok) {
            EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
            throw new Error(`companion: pairing failed (${res.status})`);
        }
        this.token = await res.text();
        this.paired = true;
        await Storage.set(TOKEN_KEY, this.token, Storage.STORES.COMPANION);
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
        return this.token;
    }

    /** Drop the stored token, e.g. after a 401 from any endpoint. */
    async forget() {
        this.token = null;
        this.paired = false;
        await Storage.delete(TOKEN_KEY, Storage.STORES.COMPANION);
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
    }
}

window.CompanionBridgeService = new CompanionBridgeServiceClass();

})();
