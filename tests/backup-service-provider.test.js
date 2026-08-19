'use strict';
const { installStubs } = require('./helpers/zx-stubs');

installStubs({
    Storage: {
        STORES: { COMPANION: 'companion' },
        async get() { return null; },
        async set() {},
        async delete() {}
    }
});

require('../js/services/file-access-provider.js');
require('../js/services/browser-fsa-provider.js');
require('../js/services/companion-file-provider.js');
require('../js/services/companion-bridge-service.js');
require('../js/services/backup-service.js');

async function run() {
    if (BackupService.getProviderKind() !== 'browser') {
        throw new Error('expected the default provider kind to be browser (unchanged behaviour)');
    }
    console.log('  ok: defaults to the browser provider');

    if (BackupService._provider !== BackupService._browserProvider) {
        throw new Error('expected the default active provider to be the BrowserFSAProvider instance');
    }
    console.log('  ok: the browser provider is active by default');

    // Not yet paired: choosing 'companion' must fall back to the browser
    // provider rather than leaving the service without a usable one.
    BackupService.setProviderKind('companion');
    if (BackupService.getProviderKind() !== 'browser') {
        throw new Error('expected setProviderKind(companion) to fall back to browser while unpaired');
    }
    if (BackupService._provider !== BackupService._browserProvider) {
        throw new Error('expected the browser provider instance to remain active while unpaired');
    }
    console.log('  ok: setProviderKind falls back to the browser provider when the companion is not paired');

    // Simulate a paired companion, the way CompanionBridgeService.init()/pair() would leave it.
    CompanionBridgeService.paired = true;
    CompanionBridgeService.token = 'x'.repeat(64);

    BackupService.setProviderKind('companion');
    if (BackupService.getProviderKind() !== 'companion') {
        throw new Error('expected provider kind to switch to companion once paired');
    }
    if (!(BackupService._provider instanceof CompanionFileProvider)) {
        throw new Error('expected the active provider to be a CompanionFileProvider');
    }
    console.log('  ok: setProviderKind switches the active provider once the companion is paired');

    BackupService.setProviderKind('browser');
    if (BackupService.getProviderKind() !== 'browser') {
        throw new Error('expected provider kind to switch back to browser');
    }
    if (BackupService._provider !== BackupService._browserProvider) {
        throw new Error('expected the browser provider instance to be restored');
    }
    console.log('  ok: setProviderKind switches back to the browser provider');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
