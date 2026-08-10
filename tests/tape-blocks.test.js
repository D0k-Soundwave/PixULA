'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const testScreen = new Uint8Array(6912);
for (let i = 0; i < 6912; i++) testScreen[i] = (i * 5 + 1) & 0xFF;

let parsedPayload = null;
installStubs({
  SCRFormat: {
    export: () => testScreen.slice(),
    parse: (buffer) => {
      parsedPayload = new Uint8Array(buffer);
      return { success: parsedPayload.length === 6912 };
    }
  }
});
loadModule('js/io/tap-format.js');
loadModule('js/io/tzx-format.js');

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── TAP block list ──────────────────────────────────────────────────────────
const tap = TAPFormat.export({ border: 2, name: 'blocktest' });
{
  const parsed = TAPFormat.listBlocks(tap.buffer);
  check('TAP listBlocks succeeds', parsed.success === true);
  const b = parsed.blocks;
  check('TAP: 4 blocks', b.length === 4);
  check('TAP: kinds header/data/header/data',
    b[0].kind === 'header' && b[1].kind === 'data' &&
    b[2].kind === 'header' && b[3].kind === 'data');
  check('TAP: header names decoded', b[0].name === 'blocktest' && b[2].name === 'blocktest');
  check('TAP: header types Program(0) and Bytes(3)',
    b[0].headerType === 0 && b[2].headerType === 3);
  check('TAP: Bytes header params (16384, len 6912)',
    b[2].param1 === 16384 && b[2].dataLen === 6912);
  check('TAP: only the CODE data block is a screen',
    b[3].isScreen === true && !b[0].isScreen && !b[1].isScreen && !b[2].isScreen);
  check('TAP: offsets/lengths tile the file exactly',
    b.every((blk, i) => i === 0 ? blk.offset === 0 : blk.offset === b[i - 1].offset + b[i - 1].length) &&
    b[3].offset + b[3].length === tap.length);

  // Unmodified round-trip must be byte-identical
  check('TAP: serialize(list) is byte-identical', same(TAPFormat.serializeBlocks(b), tap));

  // Reorder + remove still serializes to a parseable tape
  const edited = [b[2], b[3]];
  const rebuilt = TAPFormat.serializeBlocks(edited);
  const reparsed = TAPFormat.listBlocks(rebuilt.buffer);
  check('TAP: edited tape reparses', reparsed.success && reparsed.blocks.length === 2 &&
    reparsed.blocks[1].isScreen === true);

  // Load the screen block
  parsedPayload = null;
  const load = TAPFormat.loadScreenBlock(b[3]);
  check('TAP: loadScreenBlock feeds SCRFormat the exact screen bytes',
    load.success === true && same(parsedPayload, testScreen));

  // Append pair built from the current document
  const pair = TAPFormat.buildScreenBlockPair({ name: 'blocktest' });
  check('TAP: buildScreenBlockPair matches export()-produced blocks',
    same(pair[0].raw, b[2].raw) && same(pair[1].raw, b[3].raw));

  // Malformed input is rejected, not mangled
  check('TAP: stray trailing byte rejected',
    TAPFormat.listBlocks(Uint8Array.from([...tap, 0x00]).buffer).success === false);
  check('TAP: truncated block rejected',
    TAPFormat.listBlocks(tap.slice(0, tap.length - 4).buffer).success === false);
}

// ── TZX block list ──────────────────────────────────────────────────────────
const tzx = TZXFormat.export({ border: 2, name: 'blocktest' });
{
  const parsed = TZXFormat.listBlocks(tzx.buffer);
  check('TZX listBlocks succeeds', parsed.success === true);
  check('TZX: 10-byte signature header preserved', same(parsed.header, tzx.slice(0, 10)));
  const b = parsed.blocks;
  check('TZX: 4 standard speed blocks', b.length === 4 && b.every(x => x.id === 0x10));
  check('TZX: embedded TAP metadata decoded',
    b[0].kind === 'header' && b[0].name === 'blocktest' &&
    b[2].headerType === 3 && b[3].isScreen === true);
  check('TZX: serialize(list) is byte-identical', same(TZXFormat.serializeBlocks(parsed), tzx));

  parsedPayload = null;
  const load = TZXFormat.loadScreenBlock(b[3]);
  check('TZX: loadScreenBlock feeds SCRFormat the exact screen bytes',
    load.success === true && same(parsedPayload, testScreen));

  const pair = TZXFormat.buildScreenBlockPair({ name: 'blocktest' });
  check('TZX: buildScreenBlockPair matches export()-produced blocks',
    same(pair[0].raw, b[2].raw) && same(pair[1].raw, b[3].raw));
}

// Synthetic TZX with non-data blocks between the data blocks
{
  const text = 'made by test';
  const parts = [
    ...tzx.slice(0, 10),                                   // signature
    0x30, text.length, ...[...text].map(c => c.charCodeAt(0)), // text description
    0x20, 0xE8, 0x03,                                      // pause 1000ms
    ...tzx.slice(10)                                       // the four 0x10 blocks
  ];
  const messy = Uint8Array.from(parts);
  const parsed = TZXFormat.listBlocks(messy.buffer);
  check('TZX: mixed-block tape walks fully',
    parsed.success === true && parsed.blocks.length === 6);
  check('TZX: non-data blocks keep kind tzx and no screen flag',
    parsed.blocks[0].id === 0x30 && parsed.blocks[0].kind === 'tzx' &&
    parsed.blocks[1].id === 0x20 && !parsed.blocks[0].isScreen);
  check('TZX: screen still found among mixed blocks',
    parsed.blocks.filter(x => x.isScreen).length === 1);
  check('TZX: mixed-block serialize byte-identical',
    same(TZXFormat.serializeBlocks(parsed), messy));

  // Reorder: move screen pair to the front, drop the loader pair
  const edited = { header: parsed.header, blocks: [parsed.blocks[4], parsed.blocks[5], parsed.blocks[0]] };
  const rebuilt = TZXFormat.serializeBlocks(edited);
  const reparsed = TZXFormat.listBlocks(rebuilt.buffer);
  check('TZX: reordered tape reparses with screen first',
    reparsed.success && reparsed.blocks.length === 3 && reparsed.blocks[1].isScreen === true);

  // The single-screen import path still works on the edited tape
  parsedPayload = null;
  check('TZX: legacy parse() loads the edited tape', TZXFormat.parse(rebuilt.buffer).success === true &&
    same(parsedPayload, testScreen));
}

// Error paths
check('TZX: bad signature rejected',
  TZXFormat.listBlocks(new Uint8Array(20).buffer).success === false);
{
  const unknown = Uint8Array.from([...tzx.slice(0, 10), 0x19, 1, 2, 3]);
  check('TZX: unknown block ID rejected conservatively',
    TZXFormat.listBlocks(unknown.buffer).success === false);
  const truncated = tzx.slice(0, tzx.length - 100);
  check('TZX: truncated block rejected',
    TZXFormat.listBlocks(truncated.buffer).success === false);
}

summary();
