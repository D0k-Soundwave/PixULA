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

    /**
     * Unauthenticated existence check - never confers trust.
     *
     * It also reads the `paired` flag the companion reports, because the
     * companion's token lives ONLY in its own process memory: restarting the
     * binary invalidates every token it ever issued, while this side still
     * holds one in IndexedDB. A running companion reporting paired=false has
     * no token at all, so the one stored here is provably dead - drop it and
     * go back to the unpaired state (the Companion dialog then shows Connect
     * again). Without this the dialog reads "Connected" forever, hides the
     * only way to re-pair, and every authenticated call 401s with nothing to
     * recover it - see docs/COMPANION.md's Failure behavior table.
     */
    async checkStatus() {
        let serverPaired = null;
        try {
            const res = await fetch(`${COMPANION_BASE_URL}/status`);
            this.running = res.ok;
            if (res.ok) {
                try {
                    const body = await res.json();
                    if (body && typeof body.paired === 'boolean') serverPaired = body.paired;
                } catch (parseError) {
                    // An unreadable body says nothing about pairing; leave the
                    // stored token alone rather than forgetting it on a guess.
                    Logger.warn('CompanionBridgeService', 'Could not read /status body', parseError);
                }
            }
        } catch (error) {
            this.running = false;
        }

        if (this.running && serverPaired === false && this.paired) {
            Logger.info('CompanionBridgeService', 'Companion reports no pairing - dropping the stale token');
            await this.forget(); // emits COMPANION_STATE_CHANGED itself
            return this.running;
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
