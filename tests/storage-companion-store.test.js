'use strict';
const { installStubs, loadModule } = require('./helpers/zx-stubs');

installStubs({
    Logger: { info() {}, debug() {}, warn() {}, error() {} }
});
loadModule('js/utils/storage.js');

async function run() {
    // storage.js opens a real IndexedDB in the browser; under Node's stub
    // environment it falls back to the localStorage shim (see zx-stubs),
    // which is enough to prove the store NAME and version are registered -
    // the actual browser-backed store creation is covered by the existing
    // Playwright persistence specs, unchanged by this task.
    if (Storage.DB_VERSION < 8) {
        throw new Error(`expected DB_VERSION >= 8, got ${Storage.DB_VERSION}`);
    }
    if (Storage.STORES.COMPANION !== 'companion') {
        throw new Error(`expected STORES.COMPANION === 'companion', got ${Storage.STORES.COMPANION}`);
    }
    console.log('  ok: DB_VERSION bumped to 8');
    console.log('  ok: STORES.COMPANION registered');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
