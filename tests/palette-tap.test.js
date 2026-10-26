'use strict';
/**
 * Batch 6 part 6B: the ULAplus palette tape (.tap). PixULA writes a 176-byte tape holding a one-line BASIC loader and a
 * Z80 routine that sets the 64 ULAplus registers, then `LOAD ""` for the next file on the tape. It reads any tape whose
 * first Program block ends in `REM <code> <64 palette bytes> 0x0D`, which is the layout ZX Paintbrush 2.6.4 writes too.
 *
 * Layout [M, byte compare of the 13 palette tapes in C:\Program Files (x86)\ZX-Paintbrush\, 2026-10-10]: only the 64
 * palette bytes (file offsets 110-173) and the data checksum differ between those files. [C] 176 = 21 (header block)
 * + 2 + 1 + 151 (program) + 1 (checksum); 151 = 4 (line number and length) + 147; 147 = 42 (BASIC) + 40 (routine, padded)
 * + 64 (palette) + 1 (0x0D).
 *
 * The ZX Paintbrush sample files are NOT copied into the repository (licence unknown). When the installed folder exists
 * the test reads them from there; when it does not, that part is skipped with a printed note.
 */
const fs = require('fs');
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };
global.SelectionService = {
  hasSelection() { return false; }, getSelection() { return null; }, isFloating() { return false; },
  engagedStamp() { return null; }, clear() {}, setSelection() {}, restoreFloatingState() {},
  captureFloatingState() { return null; }, selection: null
};

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/io/format-registry.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/tap-format.js');

ColorManager.initialize();

const regsDefault = Array.from(ULAPLUS.defaultRegisters());
const regsOther = Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 0xFF);
const sameArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const hex = (arr) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');

// --- what PixULA writes ------------------------------------------------------------------------------------------------
const tap = TAPFormat.buildUlaplusPaletteTap(regsOther, 'mypalette');
check('the tape is 176 bytes', tap.length === 176, String(tap.length));

check('header block: length 19, flag 0, type Program',
  tap[0] === 0x13 && tap[1] === 0x00 && tap[2] === 0x00 && tap[3] === 0x00);
check('the tape name is padded to 10 characters', String.fromCharCode(...tap.slice(4, 14)) === 'mypalette ');
check('program data length 151, autostart line 10, program length 151',
  tap[14] === 151 && tap[15] === 0 && tap[16] === 10 && tap[17] === 0 && tap[18] === 151 && tap[19] === 0);
let x = 0;
for (let i = 2; i < 20; i++) x ^= tap[i];
check('header checksum', tap[20] === x);
check('data block: length 153, flag 0xFF', tap[21] === 0x99 && tap[22] === 0x00 && tap[23] === 0xFF);
check('BASIC line 10, line length 147', tap[24] === 0x00 && tap[25] === 0x0A && tap[26] === 147 && tap[27] === 0);
x = 0;
for (let i = 23; i < 175; i++) x ^= tap[i];
check('data checksum', tap[175] === x);

// RANDOMIZE USR (VAL "46"+PEEK VAL "23635"+VAL "256"*PEEK VAL "23636"): LOAD "": REM
check('BASIC bytes, token by token',
  sameArr(Array.from(tap.slice(28, 70)), [0xf9, 0xc0, 0x28, 0xb0, 0x22, 0x34, 0x36, 0x22, 0x2b, 0xbe, 0xb0, 0x22, 0x32, 0x33, 0x36,
    0x33, 0x35, 0x22, 0x2b, 0xb0, 0x22, 0x32, 0x35, 0x36, 0x22, 0x2a, 0xbe, 0xb0, 0x22, 0x32, 0x33, 0x36, 0x33, 0x36, 0x22, 0x29,
    0x3a, 0xef, 0x22, 0x22, 0x3a, 0xea]));
check('the address in the BASIC line (46) is where the routine sits: 4 + 42', 4 + 42 === 46 && 24 + 46 === 70);

const routine = [0x21, 0x28, 0x00, 0x09, 0x0E, 0x3B, 0xAF, 0x06, 0xBF, 0xED, 0x79, 0x06, 0xFF, 0x56, 0xED, 0x51, 0x23, 0x3C, 0xFE, 0x40,
  0x20, 0xF1, 0x06, 0xBF, 0x3E, 0x40, 0xED, 0x79, 0x06, 0xFF, 0x3E, 0x01, 0xED, 0x79, 0xC9];
check('the Z80 routine (35 bytes), pinned', sameArr(Array.from(tap.slice(70, 105)), routine));
check('then 5 bytes of padding, so the palette starts 40 bytes after the routine',
  sameArr(Array.from(tap.slice(105, 110)), [0, 0, 0, 0, 0]) && 70 + 40 === 110);
check('the 64 palette bytes are at 110-173', sameArr(Array.from(tap.slice(110, 174)), regsOther));
check('the line ends with 0x0D', tap[174] === 0x0D);

// the routine really does what it claims: run it on a tiny Z80 model of just these opcodes
{
  const mem = new Uint8Array(65536);
  const base = 0x6000;
  mem.set(tap.slice(70, 110), base);
  mem.set(tap.slice(110, 174), base + 40);
  const out = [];
  let B = (base >> 8), C = base & 0xFF, H = 0, L = 0, A = 0, D = 0, pc = base, steps = 0;
  const port = () => (B << 8) | C;
  while (steps++ < 5000) {
    const op = mem[pc];
    if (op === 0x21) { L = mem[pc + 1]; H = mem[pc + 2]; pc += 3; }
    else if (op === 0x09) { const s = ((H << 8) | L) + ((B << 8) | C); H = (s >> 8) & 0xFF; L = s & 0xFF; pc += 1; }
    else if (op === 0x0E) { C = mem[pc + 1]; pc += 2; }
    else if (op === 0xAF) { A = 0; pc += 1; }
    else if (op === 0x06) { B = mem[pc + 1]; pc += 2; }
    else if (op === 0x56) { D = mem[(H << 8) | L]; pc += 1; }
    else if (op === 0x23) { const s = (((H << 8) | L) + 1) & 0xFFFF; H = s >> 8; L = s & 0xFF; pc += 1; }
    else if (op === 0x3C) { A = (A + 1) & 0xFF; pc += 1; }
    else if (op === 0x3E) { A = mem[pc + 1]; pc += 2; }
    else if (op === 0xFE) { pc += 2; }
    else if (op === 0x20) { const cp = mem[pc - 1]; const off = mem[pc + 1] << 24 >> 24; pc += 2; if (A !== cp) pc += off; }
    else if (op === 0xED) {
      const sub = mem[pc + 1];
      if (sub === 0x79) out.push([port(), A]);
      else if (sub === 0x51) out.push([port(), D]);
      else break;
      pc += 2;
    }
    else if (op === 0xC9) break;
    else break;
  }
  const writes = out.length;
  let good = writes === 64 * 2 + 2;
  for (let i = 0; i < 64 && good; i++) {
    if (out[2 * i][0] !== 0xBF3B || out[2 * i][1] !== i) good = false;
    if (out[2 * i + 1][0] !== 0xFF3B || out[2 * i + 1][1] !== regsOther[i]) good = false;
  }
  good = good && out[128][0] === 0xBF3B && out[128][1] === 0x40 && out[129][0] === 0xFF3B && out[129][1] === 1;
  check('the routine writes entries 0-63 to the ULAplus ports, then switches the palette on', good, `writes ${writes}`);
}

// --- reading --------------------------------------------------------------------------------------------------------------
check('PixULA reads its own tape back', sameArr(Array.from(TAPFormat.findUlaplusPalette(tap)), regsOther));
check('the default palette round-trips', sameArr(Array.from(TAPFormat.findUlaplusPalette(TAPFormat.buildUlaplusPaletteTap(regsDefault))), regsDefault));
check('a palette tape is not a document', TAPFormat.importsDocumentFor(tap.buffer) === false);

// a tape in ZX Paintbrush's shape: line 0, a name that starts with an INVERSE code, another 82-byte prefix
{
  const t = Uint8Array.from(tap);
  t[24] = 0; t[25] = 0;                         // line 0
  t.set([0x14, 0x01, ...Array.from('64colour').map(c => c.charCodeAt(0))], 4);
  t.fill(0x41, 28, 44);                           // different BASIC, still before the REM
  t[30] = 0xC0;                                   // ... that starts the code with USR
  t[44] = 0xEA;
  check('a tape with another loader and line number is accepted', sameArr(Array.from(TAPFormat.findUlaplusPalette(t)), regsOther));
}

// rejected
{
  const bad = (label, mutate) => {
    const t = Uint8Array.from(tap);
    const r = mutate(t) || t;
    check(`rejected: ${label}`, TAPFormat.findUlaplusPalette(r) === null);
  };
  bad('a Bytes header instead of a Program', (t) => { t[3] = 3; });
  bad('no final 0x0D', (t) => { t[174] = 0; });
  bad('no REM before the palette', (t) => { t.fill(0x20, 28, 110); });
  bad('a line too short to hold 64 bytes', (t) => { t[26] = 40; });
  bad('a truncated tape', (t) => t.slice(0, 120));
  bad('an empty tape', () => new Uint8Array(0));
  bad('a loader with no USR before the REM', (t) => { t.fill(0x41, 28, 44); });
  bad('a longer program: more BASIC lines after the REM line', (t) => {
    const len = t[21] | (t[22] << 8);                // the data block's length word
    const extra = [0x00, 0x14, 0x03, 0x00, 0xF9, 0x0D];
    const cut = 21 + 2 + len - 1;                    // the checksum byte
    const out = new Uint8Array(t.length + extra.length);
    out.set(t.subarray(0, cut), 0);
    out.set(extra, cut);
    out[21] = (len + extra.length) & 0xFF; out[22] = ((len + extra.length) >> 8) & 0xFF;
    return out;
  });
}
{
  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  check('a screen tape holds no palette', TAPFormat.findUlaplusPalette(TAPFormat.export({ border: 1, name: 'x' })) === null);
}

// --- loading ---------------------------------------------------------------------------------------------------------------
__setActiveScreenMode('ula_plus');
AttributeSystem.clearAll();
ColorManager.applyScreenMode();
LayerManager.initialize();
ColorManager.setUlaplusRegisters(null);
ColorManager.resetPaletteSlots();
{
  const depth = UndoRedo.undoStack.length;
  const r = TAPFormat.parse(tap.buffer);
  check('parse loads the palette from a palette tape', r.success === true);
  check('and the live ULAplus registers are the tape', sameArr(Array.from(ColorManager.getUlaplusRegisters()), regsOther));
  check('as one undo step', UndoRedo.undoStack.length === depth + 1);
  UndoRedo.undo();
  check('undo puts the old palette back', sameArr(Array.from(ColorManager.getUlaplusRegisters()), regsDefault));
}

// a tape with a screen AND a palette keeps its screen behaviour
{
  const screenTap = TAPFormat.export({ border: 1, name: 'x' });
  check('a screen tape still reports it replaces the document', TAPFormat.importsDocumentFor(screenTap.buffer) === true);
}

// --- the real ZX Paintbrush tapes, when this machine has them ----------------------------------------------------------------
const DIR = 'C:\\Program Files (x86)\\ZX-Paintbrush\\';
if (fs.existsSync(DIR)) {
  const names = ['amber_screen', 'c64', 'demo', 'generic', 'gradients', 'green_screen', 'jet_set_willy', 'knight_lore',
    'manic_miner', 'primaries', 'rgb', 'rgb_alt', 'standard'];
  let all = true;
  for (const n of names) {
    const bytes = new Uint8Array(fs.readFileSync(DIR + n + '.tap'));
    const p = TAPFormat.findUlaplusPalette(bytes);
    const ok = bytes.length === 176 && p && sameArr(Array.from(p), Array.from(bytes.slice(110, 174)));
    if (!ok) { all = false; console.log('  not read: ' + n); }
  }
  check('all 13 ZX Paintbrush palette tapes are read, 64 bytes each, from offset 110', all);
  const rgb = TAPFormat.findUlaplusPalette(new Uint8Array(fs.readFileSync(DIR + 'rgb.tap')));
  check('rgb.tap holds the expected bytes [M, hex dump 2026-10-10]',
    hex(rgb) === 'fffefdfcf7f6f5f4bfbebdbcb7b2b5b47f7e7d7c777675741f1e1d1c17161514efeeedece3e2e1e0afaeadaca3a2a1a06f6e6d6c636261602f0e0d0c03020100');
  const std = TAPFormat.findUlaplusPalette(new Uint8Array(fs.readFileSync(DIR + 'standard.tap')));
  check('standard.tap holds the expected bytes [M, hex dump 2026-10-10]',
    hex(std) === '0002181bc0c3d8db0002181bc0c3d8db00031c1fe0e3fcff00031c1fe0e3fcffdbd8c3c01b180200dbd8c3c01b180200fffce3e01f1c0300fffce3e01f1c0300');
  const dir = fs.readdirSync(DIR).filter(f => /\.tap$/i.test(f));
  check('the folder holds exactly those 13 tapes', dir.length === 13, String(dir.length));
} else {
  console.log('  SKIP: the ZX Paintbrush folder is not on this machine; its sample tapes were not read');
}

summary();
