# Pictures from snapshots and Next programs - Design

**Status:** design approved in conversation 2026-09-26; awaiting review of
this document. Nothing is built. Group A of the format roadmap
(`docs/FORMAT_ROADMAP.md`); groups B-D are separate projects.

## 1. Goal

Open the picture inside `.z80`, `.szx`, `.snx` and `.nex` files, the way
`.sna` already works: File > Open, pick the file, the picture it holds appears
in the mode it was made for. Import only - writing a picture back into a
program or snapshot is not a thing an artist does.

Along the way, fix `.sna`: a 128K snapshot records which of its two screens is
showing, and the app always took the first.

## 2. Which picture, and how it is decoded

Each format's job is only to FIND the picture's bytes and say which layout
they are in. Decoding is handed to the importer that already reads that
layout, so no layout is implemented twice:

| Picture | Handed to |
|---|---|
| Standard 6912-byte screen | `SCRFormat.parse` (6912 bytes) |
| Timex hi-colour (8x1) | `SCRFormat.parse` (12288 bytes: bitmap + attributes in screen order) |
| Timex hi-res 512x192 | `SCRFormat.parse` (12289 bytes: both display files + the port byte) |
| Layer 2 / LoRes (Next) | `NXIFormat._load(ext, mode, bitmap, palette)` with the mode stated explicitly |

### 2.1 The screen of a Spectrum or Timex machine

The screen lives in one 16K RAM bank, with 0x4000 at its offset 0.

- **Which bank.** On a 128K-class machine, bit 3 of the last value written to
  port 0x7FFD selects bank 7 (the "shadow" screen) instead of bank 5. Every
  other machine shows bank 5.
- **Which layout (Timex machines only).** Bits 0-2 of the last value written
  to port 0xFF [P, worldofspectrum.org/faq/reference/tmxreference.htm,
  fetched 2026-09-26]:

  | Bits 0-2 | Layout | Bytes taken from the bank |
  |---|---|---|
  | 000 | standard screen 0 | 0x0000-0x1AFF |
  | 001 | standard screen 1 | 0x2000-0x3AFF |
  | 010 | hi-colour | bitmap 0x0000-0x17FF, then attributes 0x2000-0x37FF |
  | 110 | hi-res | display file 0x0000-0x17FF, then 0x2000-0x37FF, then the port byte itself (colour in bits 3-5) |
  | anything else | standard screen 0 | 0x0000-0x1AFF |

### 2.2 `.z80` [P, worldofspectrum.org/faq/reference/z80format.htm, fetched 2026-09-26]

- **Version.** A 30-byte header. If the word at offset 6 (PC) is non-zero it
  is version 1; otherwise the word at offset 30 is 23 (v2) or 54/55 (v3).
- **Version 1** is always 48K: the 48K of RAM from 0x4000 follows the header,
  compressed when bit 5 of byte 12 is set (byte 12 = 255 reads as 1).
- **Compression:** `ED ED nn bb` means byte `bb` repeated `nn` times; version
  1's data ends with `00 ED ED 00`.
- **Versions 2 and 3:** memory blocks follow the extended header, each a
  length word, a page number and the data; length 0xFFFF means 16384 bytes,
  uncompressed. In 48K mode page 8 is 0x4000-0x7FFF; in 128K mode page n is
  RAM bank n - 3, so bank 5 is page 8 and bank 7 is page 10.
- **Machine (byte 34).** 128K-class: v2 values 3, 4; v3 values 4, 5, 6; and
  7, 8 (+3), 9 (Pentagon), 10 (Scorpion), 12 (+2), 13 (+2A) in either.
  Timex: 14 (TC2048), 15 (TC2068), 128 (TS2068). Byte 35 is the last write to
  0x7FFD; byte 36 is the last write to 0xFF on a Timex machine.

### 2.3 `.szx` [P, spectaculator.com/docs/zx-state/, fetched 2026-09-26]

- **Header.** 8 bytes: `ZXST`, major and minor version, machine id, flags.
  Blocks follow, each a 4-character id and a 32-bit little-endian size.
- **`RAMP` blocks** hold RAM pages: flags word (bit 0 = zlib-compressed),
  page number, data. The browser's `DecompressionStream('deflate')` inflates
  zlib data, so no library is added.
- **`SPCR`** holds the border and port 0x7FFD; **`SCLD`** holds port 0xFF.
- **`PLTT`** (version 1.5) holds a ULAplus palette: a flags byte (bit 0 =
  palette switched on), the current register, then the 64 registers [P,
  libspectrum `szx.c` `read_pltt_chunk`, fetched 2026-09-26]. When it is
  switched on, the picture imports as ULAplus with those colours
  (`SCRFormat.parse`, 6976 bytes).
- **Machines.** 128K-class ids: 2, 3, 4, 5, 6, 7, 10, 13, 14, 16. Timex ids:
  8, 9, 12. Any machine with an `SCLD` block uses its port 0xFF for the layout.

### 2.4 `.snx` and the `.sna` fix

The Next wiki calls `.snx` "Identical to 128K `.sna`, but leaves file handle 0
open" [P, wiki.specnext.dev/File_Formats, fetched 2026-09-26]. **Real files
disagree:** all five `.snx` files in the official Next distribution are 49179
bytes, a 48K `.sna` [M, 2026-09-26]. So `.snx` is read by the `.sna` code and
accepts both sizes, and anything after a 128K `.sna`'s data.

A 128K `.sna` (131103 or 147487 bytes) holds banks 5, 2 and the one paged at
0xC000 (`n` = port 0x7FFD bits 0-2), then the 7FFD byte at offset 49181, then
the remaining banks in ascending order. The screen is bank 7 when bit 3 of
that byte is set: at offset 27 + 32768 when `n` is 7, otherwise in the
remaining banks.

### 2.5 `.nex` [P, wiki.specnext.dev/NEX_file_format and
Alternative_NEX_file_formats, fetched 2026-09-26]

- **Header.** 512 bytes starting `Next`. Byte 10 holds the loading-screen
  flags: 1 Layer 2, 2 ULA, 4 LoRes, 8 Timex hi-res, 16 Timex hi-colour,
  64 "see flags 2" (V1.3), 128 no palette block. Byte 152 (flags 2): 1 = Layer
  2 320x256x8, 2 = Layer 2 640x256x4.
- **After the header, in order:** the 512-byte palette (present unless flag
  128; used by Layer 2 and LoRes), Layer 2 (49152), ULA (6912), LoRes (12288),
  hi-res (12288), hi-colour (12288), wide Layer 2 (81920). Only flagged blocks
  are present.
- **Hi-res colour:** byte 138, encoded like port 0xFF bits 3-5.
- **No picture:** 13 of the 22 real `.nex` files in the Next distribution carry
  no loading screen [M, 2026-09-26], and flags 2 = 3 is a tile-mode screen,
  which is a palette and not a picture. Both answer "this file has no loading
  screen".
- **Several screens in one file:** the wiki recommends one; if several are
  present, the first in the order above is imported.

## 3. Errors

Every format answers `{ success: false, error }` with a plain message for:
a wrong signature, a file too short for what its header claims, a compressed
block that does not decode, a `.nex` with no loading screen, and a snapshot
missing the page that holds the screen. Nothing half-imports: the picture is
built completely before any importer is called.

## 4. Where it lives

- `js/io/z80-format.js`, `js/io/szx-format.js`, `js/io/nex-format.js` - one
  handler each, registered as import-only like `SNAFormat`.
- `js/io/snapshot-screen.js` (`SnapshotScreen`, pure): the parts two formats
  share - "which bank shows", "which Timex layout", "build the screen bytes
  from a 16K bank" - so `.z80` and `.szx` cannot disagree about them.
- `js/io/sna-format.js`: the 128K screen fix, and `snx` registered to it.
- File-type lists, labels in all 13 languages, and the generated manual
  follow wherever the existing formats are listed.

## 5. Testing

Tested against real files, not only files built from the specification.

### 5.1 Real files (downloaded, never redistributed)

A script, `tools/fetch-snapshot-fixtures.js`, downloads them from pinned
addresses into a folder git ignores, and checks each against a SHA-256 in a
committed manifest (`tests/fixtures/snapshots/manifest.json`). The manifest
holds addresses, fingerprints and expected results only - none of the files.
Found 2026-09-26 [M]:

| Source | Files | Covers |
|---|---|---|
| Official Next distribution (gitlab.com/thesmog358/tbblue, commit `dbfe9443`) | 22 `.nex`, 5 `.snx`, 6 `.z80` | Layer 2 with and without palette; `.nex` with no loading screen; 48K `.snx`; `.z80` v2 48K and 128K |
| Fuse emulator library test files (github.com/fuse-emulator/libspectrum) | 6 `.szx`, 2 `.z80` | zlib-compressed and plain RAM pages; `PLTT`; `SCLD`/`SPCR` fragments with no RAM; `.z80` v3 48K and +3 |
| World of Spectrum mirror on archive.org | 13 `.z80` | v1 compressed; v3 48K and 128K; Timex TC2048 and TS2068 (screen 1); a 128K snapshot showing the shadow screen (`DOOM_PD.Z80`, port 0x7FFD = 0x1B) |

### 5.2 Files written by third-party tools (committed)

The remaining cases have no real file found, so established tools write them,
from artwork this project owns - so they can be committed:

- **SkoolKit 10.1** `bin2sna`: 128K `.z80` and `.szx` showing the shadow
  screen, with different pictures in banks 5 and 7.
- **sjasmplus 1.24.0** `SAVENEX`: one `.nex` per loading-screen type - ULA,
  Timex hi-colour, Timex hi-res, LoRes, Layer 2 256, 320 and 640.

A script records the tool versions and regenerates them.

### 5.3 What "correct" is checked against

- **`.z80` and `.szx`:** SkoolKit's own snapshot reader, run once when the
  manifest is built. It decompresses independently, so the screen bytes it
  reports are an oracle the app's code did not produce. The manifest stores
  their SHA-256.
- **`.nex` written by sjasmplus:** the artwork fed to it.
- **Real `.nex`:** the block at the offset the spec gives, read by a separate
  script, plus the mode and palette the app chose.
- **`.sna` shadow screen:** no real file or third-party writer was found, so
  this one case is built from the layout in section 2.4.

### 5.4 Suites

- `tests/snapshot-real-files.test.js` runs every fixture in the manifest. The
  committed ones always run; the downloaded ones run when present, and the
  suite says how many it skipped.
- Node tests built from the layouts cover every error case in section 3.
- A browser test opens one file of each kind through the app's own file
  loading.
