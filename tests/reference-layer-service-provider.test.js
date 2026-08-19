'use strict';
const { installStubs, loadModule } = require('./helpers/zx-stubs');

installStubs();

loadModule('js/services/file-access-provider.js');
loadModule('js/services/browser-fsa-provider.js');
loadModule('js/services/companion-file-provider.js');
loadModule('js/services/companion-bridge-service.js');
loadModule('js/utils/image-source.js');
loadModule('js/services/reference-layer-service.js');

async function run() {
    // --- ReferenceLayerService.getProviderKind()/setProviderKind() ---
    // Same contract as BackupService.getProviderKind()/setProviderKind()
    // (tests/backup-service-provider.test.js): defaults to browser, falls
    // back to browser while unpaired, switches once paired, switches back.

    if (ReferenceLayerService.getProviderKind() !== 'browser') {
        throw new Error('expected the default provider kind to be browser (unchanged behaviour)');
    }
    console.log('  ok: defaults to the browser provider, existing behaviour untouched');

    ReferenceLayerService.setProviderKind('companion');
    if (ReferenceLayerService.getProviderKind() !== 'browser') {
        throw new Error('expected setProviderKind(companion) to fall back to browser while unpaired');
    }
    console.log('  ok: setProviderKind falls back to the browser provider when the companion is not paired');

    CompanionBridgeService.paired = true;
    CompanionBridgeService.token = 'x'.repeat(64);

    ReferenceLayerService.setProviderKind('companion');
    if (ReferenceLayerService.getProviderKind() !== 'companion') {
        throw new Error('expected provider kind to switch to companion once paired');
    }
    console.log('  ok: setProviderKind switches once the companion is paired');

    ReferenceLayerService.setProviderKind('browser');
    if (ReferenceLayerService.getProviderKind() !== 'browser') {
        throw new Error('expected provider kind to switch back to browser');
    }
    console.log('  ok: setProviderKind switches back to the browser provider');

    // --- ImageSource.fileFromHandle(): dispatch by the HANDLE'S SHAPE ---
    //
    // This is the actual retrofit point (design spec s6.2): a linked
    // photo's FileSystemFileHandle becomes, under the companion, a
    // {folderId, relPath} pair. Every case below is run with
    // ReferenceLayerService still set to 'browser' (from the block above),
    // proving the dispatch is genuinely shape-driven and not gated by that
    // flag - a handle restored from an old preset must resolve by what it
    // IS, exactly the discipline BackupService.initialize() needed a
    // follow-up fix to add (see its "infer provider kind from the restored
    // folder ref at boot" commit). Getting it right the first time here is
    // the point of this test.

    if (ReferenceLayerService.getProviderKind() !== 'browser') {
        throw new Error('test setup: expected to still be on the browser provider kind for the shape-dispatch checks below');
    }

    // Browser-shaped handle, permission already granted: unchanged behaviour.
    {
        const fakeFile = { name: 'photo.png' };
        const handle = {
            getFile: async () => fakeFile,
            queryPermission: async () => 'granted'
        };
        const result = await ImageSource.fileFromHandle(handle);
        if (result !== fakeFile) throw new Error('expected the browser-shaped handle to resolve via getFile()');
        console.log('  ok: a browser-shaped (FileSystemFileHandle) link still reads via getFile()');
    }

    // Browser-shaped handle, permission denied: null (thumbnail fallback), not a throw.
    {
        const handle = {
            getFile: async () => { throw new Error('should not be called'); },
            queryPermission: async () => 'denied'
        };
        const result = await ImageSource.fileFromHandle(handle);
        if (result !== null) throw new Error('expected a denied browser permission to resolve to null');
        console.log('  ok: a browser-shaped link with permission denied resolves to null, not a throw');
    }

    // Companion-shaped handle, companion currently paired: reads through
    // whatever CompanionBridgeService.getProvider() returns right now.
    {
        let readArgs = null;
        CompanionBridgeService.getProvider = () => ({
            readFile: async (folderId, relPath) => {
                readArgs = { folderId, relPath };
                return new TextEncoder().encode('fake-bytes').buffer;
            }
        });

        const handle = { folderId: 'folder-1', relPath: 'sub/photo.jpg' };
        const result = await ImageSource.fileFromHandle(handle);

        if (!readArgs || readArgs.folderId !== 'folder-1' || readArgs.relPath !== 'sub/photo.jpg') {
            throw new Error('expected the companion provider\'s readFile to be called with the handle\'s folderId/relPath');
        }
        if (!(result instanceof File)) throw new Error('expected a companion-shaped handle to resolve to a File');
        if (result.name !== 'photo.jpg') throw new Error('expected the File name to come from relPath when fileName is absent');
        if (result.type !== 'image/jpeg') throw new Error('expected the MIME type to be inferred from the extension');
        console.log('  ok: a companion-shaped {folderId, relPath} link reads through the live companion provider');
    }

    // Companion-shaped handle, companion NOT currently paired (even though
    // ReferenceLayerService's own flag still says 'browser' from above -
    // shape alone drives this, the flag is irrelevant to the read):
    // null, never a throw from calling .readFile on a null provider.
    {
        CompanionBridgeService.getProvider = () => null;
        const handle = { folderId: 'folder-1', relPath: 'sub/photo.jpg' };
        const result = await ImageSource.fileFromHandle(handle);
        if (result !== null) throw new Error('expected an unpaired companion to resolve a companion-shaped handle to null');
        console.log('  ok: a companion-shaped link resolves to null (not a throw) while the companion is unreachable/unpaired');
    }

    // Companion-shaped handle, provider paired but the read itself fails
    // (folder revoked, file moved, 403 outside the authorized root, etc.):
    // null, not a throw - identical fallback story as every other case.
    {
        CompanionBridgeService.getProvider = () => ({
            readFile: async () => { throw new Error('companion: readFile failed (404)'); }
        });
        const handle = { folderId: 'folder-1', relPath: 'gone.jpg' };
        const result = await ImageSource.fileFromHandle(handle);
        if (result !== null) throw new Error('expected a failed companion read to resolve to null, not throw');
        console.log('  ok: a companion read failure resolves to null (thumbnail fallback), not a throw');
    }

    // Unrecognized shape and no handle at all: null.
    {
        if ((await ImageSource.fileFromHandle(null)) !== null) throw new Error('expected a null handle to resolve to null');
        if ((await ImageSource.fileFromHandle({})) !== null) throw new Error('expected an unrecognized handle shape to resolve to null');
        console.log('  ok: a missing or unrecognized handle shape resolves to null');
    }
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
