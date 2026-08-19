'use strict';
const { installStubs, loadModule } = require('./helpers/zx-stubs');

const mockStorage = new Map();
const eventListeners = new Map();

installStubs({
    Storage: {
        STORES: {
            COMPANION: 'companion'
        },
        async get(key, storeName) {
            const storeData = mockStorage.get(storeName) || new Map();
            const rec = storeData.get(key);
            return rec ? rec.value : null;
        },
        async set(key, value, storeName) {
            const storeData = mockStorage.get(storeName) || new Map();
            storeData.set(key, { key, value });
            mockStorage.set(storeName, storeData);
        },
        async delete(key, storeName) {
            const storeData = mockStorage.get(storeName);
            if (storeData) storeData.delete(key);
        }
    },
    EventBus: {
        on(eventName, handler) {
            if (!eventListeners.has(eventName)) {
                eventListeners.set(eventName, []);
            }
            eventListeners.get(eventName).push(handler);
        },
        emit(eventName, data) {
            const handlers = eventListeners.get(eventName) || [];
            handlers.forEach(h => h(data));
        }
    }
});
loadModule('js/services/file-access-provider.js');
loadModule('js/services/companion-file-provider.js');
loadModule('js/services/companion-bridge-service.js');

async function run() {
    // init(): restore a previously-stored token
    {
        const storedToken = 'b'.repeat(64);
        mockStorage.set('companion', new Map([['token', { key: 'token', value: storedToken }]]));
        const serviceWithToken = new (window.CompanionBridgeService.constructor)();
        await serviceWithToken.init();
        const state = serviceWithToken.getState();
        if (state.paired !== true || state.token !== storedToken) throw new Error('expected init() to restore stored token');
        if (!(serviceWithToken.getProvider() instanceof CompanionFileProvider)) throw new Error('expected a usable provider after init() restore');
        console.log('  ok: init() restores a previously-stored token and enables pairing');
    }

    // Clear storage for the rest of the test
    mockStorage.clear();

    const events = [];
    EventBus.on(EVENTS.COMPANION_STATE_CHANGED, (state) => events.push(state));

    // checkStatus(): companion unreachable
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
    await CompanionBridgeService.checkStatus();
    let state = CompanionBridgeService.getState();
    if (state.running !== false) throw new Error('expected running=false when fetch throws');
    if (CompanionBridgeService.getProvider() !== null) throw new Error('expected no provider before pairing');
    console.log('  ok: checkStatus() reports unreachable, no provider available');

    // checkStatus(): companion running, not yet paired
    global.fetch = async (url) => {
        if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: false }) };
        throw new Error('unexpected fetch: ' + url);
    };
    await CompanionBridgeService.checkStatus();
    state = CompanionBridgeService.getState();
    if (state.running !== true || state.paired !== false) throw new Error('expected running=true, paired=false');
    console.log('  ok: checkStatus() reports running-but-unpaired');

    // pair(): the long-poll resolves with a token
    global.fetch = async (url, opts) => {
        if (url.endsWith('/pair') && opts.method === 'POST') {
            return { ok: true, text: async () => 'a'.repeat(64) };
        }
        throw new Error('unexpected fetch: ' + url);
    };
    await CompanionBridgeService.pair();
    state = CompanionBridgeService.getState();
    if (state.paired !== true || state.token !== 'a'.repeat(64)) throw new Error('expected paired=true with the returned token');
    if (!(CompanionBridgeService.getProvider() instanceof CompanionFileProvider)) throw new Error('expected a usable provider after pairing');
    console.log('  ok: pair() stores the token and getProvider() returns a CompanionFileProvider');

    if (events.length < 2) throw new Error('expected EVENTS.COMPANION_STATE_CHANGED on every transition');
    console.log('  ok: state changes are announced on the bus');

    // A companion that is still running but reports paired=false has thrown
    // its only token away (it lives in process memory and does not survive a
    // restart), so the token stored here is provably dead. checkStatus() must
    // notice and return to the unpaired state - otherwise the dialog says
    // "Connected" forever, hides Connect, and every authenticated call 401s
    // with no way back short of clearing IndexedDB by hand.
    {
        // Still paired locally from the pair() step above.
        if (CompanionBridgeService.getState().paired !== true) throw new Error('precondition: expected the service to be paired here');
        global.fetch = async (url) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: false }) };
            throw new Error('unexpected fetch: ' + url);
        };
        await CompanionBridgeService.checkStatus();
        state = CompanionBridgeService.getState();
        if (state.running !== true) throw new Error('expected running=true - the companion is up, only its pairing is gone');
        if (state.paired !== false || state.token !== null) {
            throw new Error('expected a restarted companion to drop the stale token and return to the unpaired state');
        }
        if (CompanionBridgeService.getProvider() !== null) throw new Error('expected no provider once the stale token is dropped');
        const stillStored = await Storage.get('token', Storage.STORES.COMPANION);
        if (stillStored) throw new Error('expected the stale token to be deleted from storage, not just from memory');
        console.log('  ok: checkStatus() drops a stale token when a running companion reports paired=false');
    }

    // The inverse must NOT fire: a companion that still holds a pairing
    // leaves the stored token exactly where it is.
    {
        CompanionBridgeService.paired = true;
        CompanionBridgeService.token = 'c'.repeat(64);
        await Storage.set('token', CompanionBridgeService.token, Storage.STORES.COMPANION);
        global.fetch = async (url) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: true }) };
            throw new Error('unexpected fetch: ' + url);
        };
        await CompanionBridgeService.checkStatus();
        state = CompanionBridgeService.getState();
        if (state.paired !== true || state.token !== 'c'.repeat(64)) {
            throw new Error('expected a live pairing to be left alone by checkStatus()');
        }
        console.log('  ok: checkStatus() leaves a live pairing untouched');
    }

    // An unreachable companion says nothing about the token's validity - the
    // artist may simply have the binary closed - so nothing is forgotten.
    {
        global.fetch = async () => { throw new Error('ECONNREFUSED'); };
        await CompanionBridgeService.checkStatus();
        state = CompanionBridgeService.getState();
        if (state.running !== false) throw new Error('expected running=false when unreachable');
        if (state.paired !== true || state.token !== 'c'.repeat(64)) {
            throw new Error('expected an unreachable companion to leave the stored token alone');
        }
        console.log('  ok: checkStatus() keeps the token when the companion is simply not running');
    }
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
