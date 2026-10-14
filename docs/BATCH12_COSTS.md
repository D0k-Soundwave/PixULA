# Batch 12 - what each file item would cost

Written 2026-10-14 for Batch 12 part 12A. One part = one working session, the unit the parity plan uses.
Tags: **M** measured here, **P** published (source and date), **C** computed from the parts shown, **A** assumed (a guess, marked as one).
Where a browser feature's support is recalled rather than looked up today, it is tagged **A** and must be checked before it is relied on.

Zero dependencies is a project rule: anything that needs a decoder must be written in PixULA or use what the browser provides.

| # | Item | What it gives you | Parts | Main risk |
|---|------|-------------------|-------|-----------|
| 1 | PZX read and write | The tape format modern emulators prefer | 1 [C: reader 0.5 + writer 0.5, same shape as the TZX handler already here] | None big: the format is small and public |
| 2 | Turbo loaders for TZX / PZX | A faster-loading tape | 2 [A] | The loaders are Z80 machine code; there is no assembler here and nothing in the repo can run one to test it |
| 3 | Disk images: TRD/SCL, DSK, MGT/IMG | Put a screen on a disk image, take one off | 3 [C: TRD+SCL 1, DSK 1, MGT+IMG 1] | Each disk loader is a Z80 or BASIC stub; a BASIC stub is testable like the TAP loader, machine code is not |
| 4 | Nirvana .btile | The tile files the Nirvana engine uses | 1 [A] | Layout taken from ZX Paintbrush's help only; the .ctile code is the model |
| 5a | Archives: zip | Open a picture inside a .zip | 1 [C: central directory 0.5 + inflate 0.5] | Needs `DecompressionStream('deflate-raw')` |
| 5b | Archives: rar and the other 28 | Open a picture inside any archive | 28+ [A: one decoder each, several are large] | Each is a decompressor written from scratch; rar is proprietary |
| 5c | Warajevo TAP | A tape variant from the Warajevo tools | 0.5 [A] | Spec is thin |
| 6a | Header changer | Edit the name/type/start of a tape header | 0.5 [A] | None big |
| 6b | Memory editor | Hex-edit the bytes of a tape block | 1 [A] | Hex grid UI; undo |
| 6c | Data block composer | Build any block byte by byte | 1 [A] | Overlaps 6b |
| 6d | Pulse editor | Edit the pulses of a TZX/PZX block as a waveform | 2 [A] | A waveform editor; needs the pulse model of 1 |
| 7 | ASM and BIN export settings | Number base, prefixes, bytes per line, layout, attributes mixed in | 1 [A] | The fixed layout in `dev-format.js` is pinned by tests; defaults must stay |
| 8 | Change picture size | Add or remove space around the picture | 4+ [A] | The canvas is the screen mode's size. Documents bigger than a screen would change layers, undo, every export, Layer 2 and the Preview panel. The Map Editor already covers bigger-than-a-screen work |
| 9 | Print with preview | Print the picture at a chosen size over pages | 1 [C: print stylesheet 0.5 + size/pages dialog 0.5] | `window.print()` is available in every browser; page layout across several sheets is the work |
| 10a | Picture converter: black and white mode | A 1-bit conversion of a photo | 0.3 [A] | None |
| 10b | Picture converter: GIF frame picker | Choose which frame of a GIF to import | 1 [A] | `ImageDecoder` (WebCodecs) is the only no-library way to get frames; its support in Firefox and Safari is **not** established here [A - check MDN before building] |
| 11 | Options left after Batch 3 | Info bar formats, display sizes | 0.5 [A] | None |

## Notes behind the numbers

- Existing code to build on: `tap-format.js` and `tzx-format.js` (blocks, BASIC loader), `ctile-format.js` (tile files), `dev-format.js` (asm/c/bin), `import-dialog.js` (converter), `gif-format.js` (first frame only).
- PZX: Patrik Rak's PZX specification (blocks PZXT, PULS, DATA, BRWS, PAUS, STOP) [P: published with the PZX tools, recalled, not re-fetched today - read it again before writing code].
- zip: inflate through `DecompressionStream`; the zip central-directory structure is the PKWARE APPNOTE [P: recalled].
- Part counts tagged [C] add the small parts shown; tagged [A] are guesses and are the figures the choices below rest on - treat them as ranges.
