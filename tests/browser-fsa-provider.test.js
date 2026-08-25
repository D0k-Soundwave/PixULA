'use strict';
const { loadModule } = require('./helpers/zx-stubs');

global.window = global;

require('../js/services/file-access-provider.js');
require('../js/services/browser-fsa-provider.js');

async function run() {
    const base = new FileAccessProvider();
    let threw = false;
    try { await base.chooseFolder('test'); } catch (e) { threw = e.message.includes('Not implemented'); }
    if (!threw) throw new Error('base class methods must throw Not implemented');
    console.log('  ok: base class methods are abstract');

    const provider = new BrowserFSAProvider();
    if (!(provider instanceof FileAccessProvider)) {
        throw new Error('BrowserFSAProvider must extend FileAccessProvider');
    }
    console.log('  ok: BrowserFSAProvider extends FileAccessProvider');

    // isAvailable() must be a synchronous feature check, not a permission
    // check - File System Access existing (or not) on window, nothing more.
    const originalPicker = global.window.showDirectoryPicker;
    global.window.showDirectoryPicker = undefined;
    if (provider.isAvailable() !== false) throw new Error('expected isAvailable()=false without showDirectoryPicker');
    global.window.showDirectoryPicker = () => {};
    if (provider.isAvailable() !== true) throw new Error('expected isAvailable()=true with showDirectoryPicker present');
    global.window.showDirectoryPicker = originalPicker;
    console.log('  ok: isAvailable() reflects File System Access API presence');

    // chooseFolder() must call showDirectoryPicker with NO `id` option. The
    // FSA spec restricts `id` to [A-Za-z0-9_-] and 32 characters; the real
    // label this app passes ('PixULA Backups', BackupService's
    // BACKUP_FOLDER_LABEL) has a space in it, so passing it as `id` makes
    // Chrome throw a TypeError before any picker opens - i.e. the Backup
    // Folder picker could not be configured at all. This test uses that real
    // label, and a picker stub that enforces the spec's own constraint.
    const FSA_ID_RE = /^[A-Za-z0-9_-]*$/;
    let seenOpts = null;
    global.window.showDirectoryPicker = async (opts) => {
        seenOpts = opts;
        if (opts && 'id' in opts) {
            if (!FSA_ID_RE.test(String(opts.id)) || String(opts.id).length > 32) {
                const err = new TypeError(
                    `Failed to execute 'showDirectoryPicker' on 'Window': ID '${opts.id}' contains invalid characters.`);
                throw err;
            }
        }
        return { name: 'PickedFolder' };
    };

    const picked = await provider.chooseFolder('PixULA Backups');
    if (!picked || picked.name !== 'PickedFolder') throw new Error('expected chooseFolder to return the picked directory handle');
    if (!seenOpts || seenOpts.mode !== 'readwrite') throw new Error("expected showDirectoryPicker to be called with { mode: 'readwrite' }");
    if ('id' in seenOpts) throw new Error('showDirectoryPicker must NOT be given an `id` option - the label is not a valid FSA id');
    if (Object.keys(seenOpts).length !== 1) {
        throw new Error(`expected exactly one option (mode), got: ${Object.keys(seenOpts).join(', ')}`);
    }
    console.log("  ok: chooseFolder('PixULA Backups') calls showDirectoryPicker with { mode: 'readwrite' } and no id");

    // A genuine cancellation is the ONLY error swallowed; everything else
    // must surface rather than looking like the artist pressed Escape.
    global.window.showDirectoryPicker = async () => {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        throw err;
    };
    if (await provider.chooseFolder('PixULA Backups') !== null) throw new Error('expected null when the picker is cancelled');
    console.log('  ok: chooseFolder returns null on AbortError (real cancellation)');

    global.window.showDirectoryPicker = async () => { throw new TypeError('boom'); };
    let rethrew = false;
    try { await provider.chooseFolder('PixULA Backups'); } catch (e) { rethrew = e instanceof TypeError; }
    if (!rethrew) throw new Error('expected a non-AbortError to propagate out of chooseFolder');
    console.log('  ok: chooseFolder rethrows non-cancellation errors');

    global.window.showDirectoryPicker = originalPicker;
}

run().then(() => {
    console.log('ALL CHECKS PASSED');
}).catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
