// tests/scr-format.test.js
'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const calls = { bitmap: null, attrs: null, composed: 0, undo: [] };
installStubs({
  AttributeSystem: {
    importBitmap: (b) => { calls.bitmap = b; },
    importAttributes: (a) => { calls.attrs = a; },
    getCell: () => ({ ink: 0, paper: 7, bright: false, flash: false, pixels: new Uint8Array(8) }),
    setCell: () => {}
  },
  LayerManager: {
    getCurrentLayer: () => ({ setCell() {}, getCell: () => null }),
    composeToCanvas: () => { calls.composed++; },
    flattenVisible: () => ({ getCell: () => null })
  },
  UndoRedoService: { beginAction: (n) => calls.undo.push(n), endAction: () => {} }
});
loadModule('js/io/scr-format.js');

// full 6912-byte file still works
const full = new Uint8Array(6912).fill(0xAA);
check('6912-byte file parses', SCRFormat.parse(full.buffer).success === true);
check('bitmap section passed through', calls.bitmap.length === 6144 && calls.bitmap[0] === 0xAA);
check('attrs section passed through', calls.attrs.length === 768 && calls.attrs[0] === 0xAA);

// bitmap-only 6144-byte file
calls.bitmap = null; calls.attrs = null;
const bare = new Uint8Array(6144).fill(0x55);
const res = SCRFormat.parse(bare.buffer);
check('6144-byte file parses', res.success === true, res.error);
check('bitmap imported', calls.bitmap && calls.bitmap.length === 6144 && calls.bitmap[0] === 0x55);
check('attrs default to 0x38', calls.attrs && calls.attrs.length === 768 &&
  calls.attrs.every(b => b === 0x38));

// wrong sizes still rejected
check('reject 100 bytes', SCRFormat.parse(new Uint8Array(100).buffer).success === false);
check('reject 6913 bytes', SCRFormat.parse(new Uint8Array(6913).buffer).success === false);

summary();
