# Format roadmap — unsupported formats for future addition

Compiled 2026-07-11 during the RECOIL-parity pass. "RECOIL parity" here
means: every ZX-family format RECOIL 6.4.5 decodes either imports into the
editor or is listed below with the reason it doesn't yet. Byte layouts cited
from `recoil.ci`/`recoil.c` 6.4.5 (the ecosystem's reference decoder) and
the SpecNext wiki.

Recounted 2026-08-08: **44 extensions** are registered for import and/or
export across 23 handler files in `js/io/` (25 files, less the open flow and
the registry) — the list below, plus two that are not picture formats:
`.zxpreset` (user presets, 2026-08-06) and `.pixula` (the native project file,
2026-08-07 — the whole layered document rather than one flattened screen, so
it has no place in a roadmap about interchange). Full list and method:
`docs/CURRENT_STATE.md` §4.

Nothing on the unsupported list below moved in that time: the post-rebuild
work added a format of our own and changed none of the interchange ones.

## Supported as of this pass (for reference)

scr (6912/6144/6976/12288/12352/12289) · zxp (classic + extended + ULAplus
palette; import + export) · mlt · mc · ifl · hrg · img · mg/mg1/mg2/mg4/mg8 ·
hlr · bsc (both variants) · atr (import + export) · ctile · tap · tzx · sna ·
zed · sev · ch4/ch6/ch8/chr/chx · zxm/zxtm · nxi · sl2 · slr · pal/npl
(64/256/512/513 size-designated) · spr · png/bmp/jpg/gif · asm/c/bin ·
Next tilemap dev export.

## RECOIL ZX-family formats not yet supported

| Ext | What it is (per recoil.c) | Notes for a future implementation |
|---|---|---|
| `.stl` | Attribute GigaScreen at 4×4 blocks: 3072 bytes = two 1536-byte frames, blended (`DecodeStl`, SPECTRUM4X4, 2 frames) | Needs either a 4×4-block attribute view or the .hlr treatment (pattern bitmap + attrs); frame pairing would drop to frame A like .mg1/2/4 |
| `.rgb` | Three 6144-byte monochrome screens = R/G/B channels blended (`DecodeZxRgb`, components 16/8/0) | Could import as three layers or a quantized composite; no cell model holds true RGB per pixel |
| `.3` | Same tri-screen container with the components in 0/16/8 order (`Decode3`) | Same as `.rgb` |
| `.zxs` | "ZX_SSCII" 2452-byte character-mapped screen (SSCII text art) | Rasterize via the ROM font like the ZED importer; import-only |
| `.chrd` | "chr$" UDG/character dump: header `chr$` + columns/rows/bytesPerCell (9 = 8 bitmap + 1 attr), multi-frame | Close to the font/ctile machinery; could land in the font editor as a capture source |
| `.bsp` | Border Screen "plus": ≥6982 bytes, framed border screens incl. multi-frame flicker variants (`DecodeBsp`) | The screen core could import like .bsc; border + flicker frames dropped |
| `.grf` | Profi 512×240 (`DecodeProfiGrf`) | Clone-specific hi-res; would need a new mode descriptor on the 12a seam |
| `.sxg` | SXG container (ZX Evolution/Sprinter graphics) | Clone-specific palette+bitmap container |
| `.bmc4` etc. | Various clone/tool one-offs RECOIL handles under other platforms | Catalogue as encountered |

## Next-ecosystem formats not yet supported (SpecNext wiki)

| Ext | What it is | Notes |
|---|---|---|
| `.shc` | Compressed 6912 SCREEN$ (ZX7-family compression) | Needs a decompressor; screens then follow the normal SCR path |
| `.shr` | Compressed Layer 2 256×192 | Same, into the nxi path |
| `.snx` / `.nex` | Next program containers with embedded loading screens | Screen-rip import like .sna/.tap would be natural |
| `.z80` / `.szx` | Snapshot formats (we rip screens from .sna only) | .z80 v1-3 RAM paging + .szx zlib blocks needed |
| `.vid` / `.flc` | Video/animation containers | Out of editor scope for now |

## SAM Coupé formats not yet supported

The SAM Coupé (Miles Gordon Technology, 1989) is a distinct machine, not a
ZX-family clone or Next-ecosystem member — its own 128-colour palette and
four hardware modes (1: 256×192 1bpp, 8×8 attribute cells, Spectrum-
compatible; 2: 256×192 1bpp, 8×1 attribute cells; 3: 512×192 2bpp direct
pixel, 4 colours; 4: 256×192 4bpp direct pixel, 16 colours) would need their
own palette codec and mode descriptors on the 12a seam before any of its
formats could import as real editable pixels rather than a flattened
composite. Researched 2026-08-25 from RECOIL's format list; **not yet
cross-checked against RECOIL's own source** the way every ZX-family row
above is (`recoil.c`'s exact byte layouts/headers) — do that before
implementing, per this project's usual method for a new format.

| Ext | What it is (per RECOIL's format list) | Notes for a future implementation |
|---|---|---|
| `.ss1` | Mode 1 screen dump, 256×192, 128-colour palette | Structurally close to .scr's classic path; needs the SAM 128-colour codec, not ULAPLUS/NEXTRGB333 |
| `.ss2` | Mode 2 screen dump, 256×192, 128-colour palette, 8×1 attribute cells | Parallels MULTICOLOR_8x1's attribute model; different palette |
| `.ss3` | Mode 3 screen dump, 512×192, 4-colour (2bpp) direct pixel | No cell attributes at all — closer in shape to the Next indexed modes |
| `.ss4` / `.scs4` | Mode 4 screen dump, 256×192, 16-colour (4bpp) direct pixel | SAM's most-used native mode; same "no attribute" shape as .ss3 |
| `.ssx` | Flexible/mode-tagged variant, up to 512×192 | Mode carried in the file itself rather than fixed by extension |
| `.lce` | 256×384, 2 frames | Purpose unconfirmed — likely a paint program's own layered/dual-screen format, not a plain mode dump |

## Known partial-support decisions (documented losses)

- `.hrg`, `.mg1`, `.mg2`, `.mg4`: only the FIRST sub-screen imports (our
  GigaScreen model pairs 8×8-cell screens only); export of the pair exists
  for .hrg (same screen twice) and .img/8×8 .mg has no export (mg is
  import-only).
- `.bsc`: border stripe bytes are dropped both variants (no border bitmap
  model); the 11904 variant's screen core imports as MULTICOLOR_8x4.
- `.atr`/`.hlr`: the bitmap RECOIL synthesizes ((x^y)&1 dither / the file's
  8 pattern bytes) is imported as real editable pixels.
- `.pal` pair form: the Layer 2 priority bit (byte1 bit 7) is dropped on
  import, written 0 on export; `.npl` byte 513 (transparency index) is
  ignored on import, $E3 on export — we model neither pixel priority nor
  global transparency.
- `.zxp`: pictures smaller than the screen import top-left over 0x38
  attrs; larger crop. 8×2/8×4 documents export as the extended (8×1)
  form — lossless upward, and what ZX-Paintbrush itself loads.
- GigaScreen GIF/img exports blend/pair only the two flattened sub-screen
  composites; per-layer sub-screen detail beyond the tags is flattened.
