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
}

run().then(() => {
    console.log('ALL CHECKS PASSED');
}).catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
