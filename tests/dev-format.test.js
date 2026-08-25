'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const testScreen = new Uint8Array(6912);
for (let i = 0; i < 6912; i++) testScreen[i] = i & 0xFF;

let scrCanExport = true;
installStubs({ SCRFormat: { export: () => testScreen.slice(), canExport: () => scrCanExport } });
loadModule('js/io/dev-format.js');

const text = (u8) => Buffer.from(u8).toString('utf8');

// --- bin: bitmap only ---
const bin = DevFormat.generate('bin', 'screen');
check('bin is 6144 bytes', bin.length === 6144);
check('bin content = bitmap section', bin.every((v, i) => v === (i & 0xFF)));

// --- atr: attributes only ---
const atr = DevFormat.generate('atr', 'screen');
check('atr is 768 bytes', atr.length === 768);
check('atr content = attr section', atr.every((v, i) => v === ((6144 + i) & 0xFF)));

// --- asm ---
const asm = text(DevFormat.generate('asm', 'my screen!'));
check('asm has sanitized bitmap label', asm.includes('my_screen__bitmap:'));
check('asm has attributes label', asm.includes('my_screen__attributes:'));
const defbCount = (asm.match(/DEFB /g) || []).length;
check('asm DEFB line count', defbCount === 6144 / 16 + 768 / 16, `got ${defbCount}`);
const asmBytes = (asm.match(/\$[0-9A-F]{2}/g) || []).length;
check('asm emits 6912 bytes', asmBytes === 6912, `got ${asmBytes}`);
check('asm first data byte is $00', asm.includes('DEFB $00,$01,$02'));

// --- c ---
const c = text(DevFormat.generate('c', 'screen'));
check('c bitmap array header', c.includes('const unsigned char screen_bitmap[6144] = {'));
check('c attributes array header', c.includes('const unsigned char screen_attributes[768] = {'));
const cBytes = (c.match(/0x[0-9A-F]{2}/g) || []).length;
check('c emits 6912 bytes', cBytes === 6912, `got ${cBytes}`);
check('c braces balanced', (c.match(/{/g) || []).length === (c.match(/}/g) || []).length);
check('c arrays terminated', (c.match(/};/g) || []).length === 2);

// --- unknown extension throws ---
let threw = false;
try { DevFormat.generate('xyz', 'a'); } catch { threw = true; }
check('unknown extension throws', threw);

// --- canExport() delegates to SCRFormat.canExport() ---
// (generate() calls SCRFormat.export() internally, so asm/c/bin/atr inherit
// its mode gate — this is the same condition, not a separate one)
check('DevFormat.canExport delegates true', DevFormat.canExport() === true);
scrCanExport = false;
check('DevFormat.canExport delegates false', DevFormat.canExport() === false);

summary();
