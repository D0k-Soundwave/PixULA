'use strict';
const { installStubs, loadModule } = require('./helpers/zx-stubs');

const mockStorage = new Map();
const eventListeners = new Map();

installStubs({
    Storage: {
        STORES: {
            COMPANION: 'companion'
        },
        async get(storeName, key) {
            const storeData = mockStorage.get(storeName) || new Map();
            return storeData.get(key) || null;
        },
        async set(storeName, item) {
            const storeData = mockStorage.get(storeName) || new Map();
            storeData.set(item.key, item);
            mockStorage.set(storeName, storeData);
        },
        async delete(storeName, key) {
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
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
