'use strict';
const { installStubs } = require('./helpers/zx-stubs');

// Keyed exactly like BackupService's own HANDLE_KEY ('backupFolder') and
// KEEP_KEY ('backupKeepVersions') - kept mutable so the initialize() tests
// below can control what a fresh instance restores at boot.
const mockStored = { backupFolder: null, backupKeepVersions: null };

installStubs({
    Storage: {
        STORES: { COMPANION: 'companion' },
        async get(key) {
            return Object.prototype.hasOwnProperty.call(mockStored, key) ? mockStored[key] : null;
        },
        async set(key, value) { mockStored[key] = value; },
        async delete(key) { mockStored[key] = null; }
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

    // initialize(): a stored companion folderId (a plain string) with a
    // currently-paired companion must infer the companion provider kind -
    // not trust the constructor default of 'browser' - and come up active.
    {
        mockStored.backupFolder = 'companion-folder-paired';
        CompanionBridgeService.paired = true;
        CompanionBridgeService.token = 'y'.repeat(64);

        const fresh = new (BackupService.constructor)();
        await fresh.initialize();

        if (fresh.getProviderKind() !== 'companion') {
            throw new Error('expected initialize() to infer the companion provider kind from a string folderId');
        }
        if (!fresh.isActive) {
            throw new Error('expected the service to be active when the companion is currently paired');
        }
        if (fresh.needsPermission) {
            throw new Error('expected needsPermission=false when the companion is currently paired');
        }
        if (!(fresh._provider instanceof CompanionFileProvider)) {
            throw new Error('expected the live provider to be a CompanionFileProvider, not the constructor-default browser provider');
        }
        console.log('  ok: initialize() infers the companion kind from a string folderId and comes up active when paired');
    }

    // initialize(): the same shape of stored folderId, but the companion is
    // NOT currently paired this session. Before this fix, _providerKind
    // stayed at the constructor default 'browser' regardless of what
    // this.directory turned out to be, so the next writeVersion() would run
    // the folderId string through BrowserFSAProvider.writeFile() - which
    // calls .getFileHandle on it and is guaranteed to fail, silently, on
    // every autosave tick. It must instead surface exactly like a lapsed
    // browser permission: needsPermission=true, isActive=false, and no
    // provider call is ever attempted.
    {
        mockStored.backupFolder = 'companion-folder-unpaired';
        CompanionBridgeService.paired = false;
        CompanionBridgeService.token = null;

        const fresh = new (BackupService.constructor)();
        await fresh.initialize();

        if (fresh.getProviderKind() !== 'companion') {
            throw new Error('expected initialize() to still recognize the companion-shaped folderId even while unpaired');
        }
        if (fresh.isActive) {
            throw new Error('expected the service to stay inactive - never silently switch to the browser provider - while the companion is not paired');
        }
        if (!fresh.needsPermission) {
            throw new Error('expected needsPermission=true while the companion is not currently paired');
        }

        // The guarantee that matters in practice: a write attempt in this
        // state must no-op via the isActive gate rather than throw trying to
        // use a folderId string as a FileSystemDirectoryHandle.
        const result = await fresh.writeVersion({}, 'Untitled');
        if (result !== null) {
            throw new Error('expected writeVersion() to no-op while unavailable, not attempt a mismatched provider write');
        }
        console.log('  ok: initialize() recognizes an unpaired companion folderId and stays unavailable rather than falling back to the browser provider');
    }
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
