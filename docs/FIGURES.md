# PixULA - figures register

Every operational figure in the code: the timings, caps, limits and thresholds
that later decisions rest on. **Compiled 2026-08-07, extended 2026-08-08** by
scanning `js/**` for timer arguments and `MAX_*` / `*_MS` / `*_THRESHOLD` style
constants.

| Tag | Meaning |
|---|---|
| **M** | Measured on this system. Date and method recorded |
| **P** | Published by a vendor, paper or standard. Source recorded |
| **C** | Computed from M or P figures. Working shown |
| **A** | Assumed. Invented to make something work, and marked as a guess |

**What is NOT here.** Geometry and file-format constants - 256x192, 6912, the
byte layouts, the palette register maths - are omitted on purpose. Their
provenance is the Spectrum hardware and the format specs (RECOIL and the
ZX-Modules tables are cited at each handler), they cannot be chosen differently,
and listing them would bury the figures that *were* choices. `docs/CURRENT_STATE.md`
is the separate register for measured COUNTS (files, tests, keys, registries).

---

## 1. The A figures that carry weight

The useful output of this exercise. Not every A figure matters - a 48-character
name limit can be wrong without hurting anyone. These are the guesses something
actually rests on.

**This list is empty as of 2026-08-07.** No decision currently rests on an
untagged or assumed figure. Keep it that way: an entry here is a debt, not a
record.

Five figures have left it. `MAX_LAYERS`, `DEFAULT_UNDO_LIMIT` and
`MAX_LIBRARY_FONTS` were measured, and `MapCodec.MAX_TILES` was measured and
raised 1024 -> 4096 (see section 5). The **autosave interval** left by ceasing
to be ours: it is a preference now, in minutes, 0 = off
(`StateManager.getAutosaveMinutes`). The default of 1 is still an A - inherited
from the fixed 60-second timer it replaced so nobody's behaviour changed - but
a default the user can see and change is not a constraint in the way a buried
constant was.

The A figures that remain (sections 2-4) are ones nothing rests on: interaction
slop in pixels, debounce settle times, a few name-length limits. If a decision
ever starts depending on one, it belongs back in this table until it is
measured.

## 2. Timings

| Figure | Value | Tag | Provenance |
|---|---|---|---|
| Tooltip name dwell | 400 ms | P | `tooltip-manager.js` - Windows `SPI_GETMOUSEHOVERTIME` default (Microsoft `SystemParametersInfo` docs) |
| Tooltip description delay | +1000 ms | P | same file - Windows press-and-hold threshold for the same "I mean this one" gesture |
| Tooltip re-entry warm window | 500 ms | A | same file |
| Tooltip linger after lift | 2000 ms | C | ~5 words/s reading (P) x ~12 words = ~2.5 s, less the time already spent reading during the hold |
| Touch press-and-hold | 500 ms | P | `tooltip-manager.js` - Android `ViewConfiguration` long-press default |
| Palm-rejection window | 500 ms | A | `input-handler.js` |
| Long press (canvas) | 600 ms | A | `input-handler.js` |
| FLASH clock | 320 ms | P | `layer-manager.js` - the real ULA rate (16 frames at 50 Hz) |
| GIF FLASH frame delay | 32 cs | C | `gif-format.js` - 320 ms expressed in GIF centiseconds |
| GigaScreen frame delay | 2 cs | A | `gif-format.js` - fastest most decoders honour |
| Autosave interval | user-set, default 1 min | A (default) | `StateManager.AUTOSAVE_DEFAULT_MINUTES`; 0 = off, max 60. Was a fixed 60 s behind an on/off checkbox until 2026-08-07 |
| Cursor readout throttle | 32 ms | C | `canvas-controls.js` - every 2nd frame at 60 Hz (P), ~31/s |
| Status-line dwell | 3000 ms | C | 3 dialogs - ~5 words/s reading (P) x <=8 words, plus ~1 s to notice |
| Pattern search debounce | 200 ms | C | `pattern-panel.js` - just past the 150-200 ms (P) slow-typing keystroke gap |
| TZX block pause | 1000 ms | P | `tzx-format.js` - the format's own convention |
| Font/map name-entry settle | 800 ms | A | `font-service.js`, `map-service.js` debounce |

## 3. Persistence caps

| Figure | Value | Tag | Provenance |
|---|---|---|---|
| `ClipboardCodec.MAX_JSON_BYTES` | 4 MB | M+C | Worst-case copy is 479,036 B at layer2_640 (M, 2026-08-07, all 14 modes measured); 4 MB is ~8.5x that. Was 512 KB, which the worst case filled to 91.4%. Pinned by `tests/payload-headroom.test.js` |
| `FontCodec.MAX_JSON_BYTES` | 64 KB | A | Per FONT, not per library |
| `MapCodec.MAX_JSON_BYTES` | 1 MB | A | |
| `PresetCodec.MAX_JSON_BYTES` | 256 KB | A | |
| `PresetCodec.MAX_ASSET_CHARS` | 8 MB | C | ~6 MB of image (8 x 3/4); the photo size it clears is itself A |
| `PresetCodec.MAX_FILE_BYTES` | 12 MB | A | Preset + inlined asset |
| `PresetCodec.MAX_TOOL_PRESET_BYTES` | 64 KB | C | ~400 B/brush capture (M, 2026-08-07) x ~150 presets |
| `FontService.MAX_LIBRARY_BYTES` | 2 MB | C | New 2026-08-07, closing finding F2. 256 heaviest fonts is 713 KB (C from M), so 2 MB leaves room for names and future fields |
| `BackupService.DEFAULT_KEEP_VERSIONS` | 20 | C | New 2026-08-08. The autosave interval controls FREQUENCY, not total count - at the 1-minute default an eight-hour session is 480 files, which is not a history anyone reads. 20 is the last 20 minutes at that interval, or the last 10 hours at a 30-minute one. The artist sets both numbers; 0 keeps everything |
| `PatternService.MAX_PATTERN_NAME` | 48 | A | Matched to `PresetCodec.MAX_NAME` for convention |
| `ImageSource.THUMB_MAX_PX` | 256 | C | The preset stand-in shown when a linked photo cannot be reached. Big enough to be recognisable, far too small to trace from - which is why falling back to it is announced rather than silent. M: 14,551 B for a 12 MP phone photo, 385x smaller |
| `ImageSource` thumbnail quality | 0.72 | A | The usual "good enough for a preview" JPEG point; not measured against these images. Affects only the fallback |

## 4. Structural limits

| Figure | Value | Tag | Provenance |
|---|---|---|---|
| `MAX_COLORS_PER_CELL` | 2 | P | The ULA. Not a choice |
| `MAX_LAYERS` | 32 | M+C | 8,448 B per layer packed at STANDARD_ULA, 212,480 B at LAYER2_640 (M, 2026-08-07 after the snapshot work). Was 16, and was briefly raised on a figure taken at the SMALLEST mode - the largest mode is what matters, and it is now affordable there too. 31 are drawable; layer 0 is the locked Background |
| `DEFAULT_UNDO_LIMIT` | 500 | M+C | Raised from 50 on 2026-08-07 once depth stopped being expensive. A one-layer stroke is 212,480 B at LAYER2_640 and 8,448 B at STANDARD_ULA (M), so 500 is ~101 MB at the largest mode and ~4.2 MB at the smallest (C) |
| `UndoRedo.MAX_HISTORY_BYTES` | 256 MB | C | The count alone is the wrong lever: an all-layer action costs 6,586,880 B against a stroke's 212,480 B (M, 32 layers at LAYER2_640), so 500 of those would be 3.29 GB. The budget holds ~1,263 strokes or ~40 all-layer actions at that mode |
| `UndoRedo.MIN_HISTORY_ENTRIES` | 10 | A | The floor the budget may not prune past - undo must not become least reliable exactly when the document is largest |
| `PresetCodec.SLOT_COUNT` | 9 | C | Tied to the keyboard: nine digit keys, so nine slots and no unkeyed remainder. Was 24 (A, "at least 20 asked for, 24 lays out 4x6") until 2026-08-07 |
| `PresetCodec.KEY_SLOTS` | 9 | C | One per digit key that names its own slot; now equal to SLOT_COUNT by design |
| `PresetCodec.MAX_NAME` | 48 | A | |
| `PresetCodec.MAX_DESCRIPTION` | 240 | A | |
| `FontCodec.MAX_GLYPHS` | 256 | P | A byte's worth of character codes |
| `MapCodec.MAX_DIM` | 256 | A | |
| `MapCodec.MAX_TILES` | 4096 | M+C | A full 256x256 map at 4096 tiles encodes to 291,879 B, 27.8% of MAX_JSON_BYTES (M, 2026-08-07). A tile costs ~28.6 B encoded; the index grid is 174,882 B before any tile. Was 1024 |
| `SpriteService` cap | 64 | P | The Next's hardware sprite count |
| `MAX_LIBRARY_FONTS` | 256 | M+C | 2,785 B for the heaviest font (M) x 256 = 713 KB (C). Was 64 |
| `PatternService.MAX_USER_PATTERNS` | 256 | M+C | New 2026-08-07, closing the last uncapped store. 434.9 B for the heaviest record (M, 32x32) x 256 = 143 KiB (M, measured directly). Matched to MAX_LIBRARY_FONTS deliberately: both are "past the point where anyone finds one by scrolling" |
| `PatternService.MAX_PATTERN_NAME` | 48 | A | Matched to `PresetCodec.MAX_NAME` for convention, not measured |
| GIF `MAX_CODES` | 4096 | P | The LZW code-width ceiling in GIF89a |
| Long-press slop | 8 px | A | `input-handler.js` |
| Tooltip hold slop | 10 px | A | `tooltip-manager.js` |

## 5. Revisions - all resolved 2026-08-07

Every row of this section has been applied or withdrawn. Nothing here is
outstanding.

| Figure | Was | Now | Outcome |
|---|---|---|---|
| `ClipboardCodec.MAX_JSON_BYTES` | 512 KB | **4 MB** | **Applied.** Re-measured across all 14 modes, not just one: the worst case is **479,036 B at layer2_640 - 91.4% of the old cap**, with multicolor_8x1 and ula_plus_8x1 both at 78.5%. Three modes, not one, were near a cap whose failure is silent |
| `MapCodec.MAX_TILES` | 1024 | **4096** | **Applied.** A full 256x256 map at 4096 tiles encodes to 291,879 B, 27.8% of `MAX_JSON_BYTES` (M) |
| `PresetCodec.MAX_ASSET_CHARS` | 8 MB | 8 MB | **Withdrawn.** Moot: a preset stores a 256 px thumbnail (M: 14,551 B for a 12 MP phone photo), not the picture. The cap now guards only the fallback where a thumbnail could not be drawn at all, and 8 MB is generous for that |
| `PresetCodec.MAX_FILE_BYTES` | 12 MB | 12 MB | **Withdrawn.** Was only raised to stay above the asset cap, which is no longer moving |

**Two corrections to the figures this section was originally written on**, both
in the direction of the recommendation being MORE justified rather than less:

- The clipboard worst case was recorded as 444,396 B (85%). Measuring every
  registered mode rather than one gives **479,036 B (91.4%)**, and finds two
  further modes above 78%.
- "Tile data is 9 B each, so 4096 tiles is 36 KB" was the RAW size. Encoded -
  base64 inside a JSON array - a tile costs **~28.6 B** (M), 3x that. The
  conclusion held anyway because the index grid dominates: 174,882 B before a
  single tile is added.

**Both caps are now pinned by `tests/payload-headroom.test.js`**, which walks
the `SCREEN_MODES` registry and fails the build if any mode's worst-case copy
exceeds half its cap. These two failures are silent in the app - a clipboard
that will not encode just does not persist, and the artist finds out at the next
reload - so they are exactly the caps that need a build gate rather than a
measurement in a document. Verified to fail at the old values.

**Applied earlier the same day:** `DEFAULT_UNDO_LIMIT` is now 500, with a 256 MB
`MAX_HISTORY_BYTES` budget beside it - see section 4 and the worst-case table
below.

### The undo note - RESOLVED 2026-08-07

You were right that a screen is tiny. The snapshot was not, and closing that
gap was the work.

**What it was.** Each layer grid was 768 cell objects (2,560 at LAYER2_640),
every one carrying five scalars, its own `Uint8Array(8)` and, in indexed
modes, its own `Int16Array` - so 5,120 typed-array wrappers a layer to hold
82 KB of picture. And every snapshot copied EVERY layer, whether the action
touched it or not.

**What was done.** Two changes, both measured:

1. *Packed snapshots.* `packAttributeData()`/`unpackAttributeData()` store the
   same information in six flat typed arrays. The live cell model is unchanged -
   this is the snapshot representation only, so drawing, compositing and the
   format handlers see exactly what they always did.
2. *Dirty-layer tracking.* At `endAction` - the first moment the app knows what
   an action touched - the grids of unchanged layers are dropped by COMPARISON
   (not by the write paths notifying, which could miss one and corrupt an undo).
   `restoreAllLayersState` reuses the live layer object where the snapshot kept
   no grid.

| | Native picture | Per layer before | Per layer after |
|---|---|---|---|
| STANDARD_ULA | 6,912 B | 95,281 B | **8,448 B** |
| LAYER2_640 | 82,432 B | 1,633,345 B | **212,480 B** |

| Worst case, 32 layers at LAYER2_640 | Entry | 50-deep history |
|---|---|---|
| Before | 52,107,466 B | 2.43 GiB |
| Packed | 6,799,360 B | 324 MB |
| Packed + one-layer stroke | **212,480 B** | **10.6 MB** |

A one-layer stroke in a 32-layer document keeps ONE grid (M, verified: 31
layers in the entry, 1 grid kept). Undo depth could now be raised well past 50;
it has been left at 50 pending a decision, since the reason to keep it low is
gone.

Two round-trip hazards the specs caught, both of which would have been silent:
an index of -1 does not fit a byte alongside 0..255 (transparency travels as
its own bitmask), and a cell's attributes can be `undefined` rather than a
value (a "defined" bit preserves it, because a snapshot must return the
document as it WAS, not as it should have been).

Still available, not done: indexed modes pack a byte per index where the mode
uses 4 bits, and still carry the classic 1-bit array and attribute bytes that
nothing reads there. Worth roughly another 2x, at some risk to the exact
round-trip guarantee, so it wants its own pass.

## 6. Maximum size, everything at its cap

Every component at its limit, on the largest document the tool can make:
**LAYER2_640** (640x256, 4 bits per pixel) with all 32 layers. Measured
2026-08-07 unless the row says otherwise.

### Per-unit figures behind the table

| Unit | Size | Tag |
|---|---|---|
| Native picture, LAYER2_640 | 82,432 B | M (mode descriptor) |
| Packed snapshot layer | 212,480 B | M |
| Live layer (object graph) | 942,080 B | C - 2,560 cells x 368 B, from V8's object layout; heap is not measurable here |
| Undo entry, one-layer stroke | 212,480 B | M |
| Undo entry, all-layer action | 6,586,880 B | M |
| Composite canvas surface | 655,360 B | C - 640 x 256 x 4 |
| Distinct reference assets reachable | 242 | M - 9 slots + 233 reference presets in a 64 KB scope record at 281 B each |

### Runtime memory

| Component | Bytes | |
|---|---|---|
| Undo + redo history | 268,435,456 | 256.0 MiB - the `MAX_HISTORY_BYTES` budget IS the ceiling |
| Reference image, decoded | ~96,000,000 | ~91.6 MiB - see the note below |
| Live document, 32 layers | 30,146,560 | 28.8 MiB |
| Preset libraries | 4,259,840 | 4.1 MiB |
| Canvas surfaces (4) | 2,621,440 | 2.5 MiB |
| Font library | ~1,048,576 | 1.0 MiB |
| Clipboard + floating stamp | ~900,000 | 0.9 MiB |
| Map, sprites, patterns | ~170,000 | 0.2 MiB |
| **Runtime total** | **~403,600,000** | **~385 MiB** |

### Persistent storage

| Store | Bytes | |
|---|---|---|
| `PRESET_ASSETS` | 3,521,342 | 3.4 MiB - see "Closed" below; was 2,030,043,136 (1,936 MiB, 97% of all storage) until presets stopped embedding the photo on 2026-08-07 |
| autosave record | 11,648,539 | 11.1 MiB - M 2026-08-07, the measurement that prediction asked for. 56,124,434 B as JSON; Chrome's IndexedDB compresses (Snappy), so what lands is 4.8x smaller with INCOMPRESSIBLE content and 40.5x smaller with regular content (1,362,793 B). 11.1 MiB is the honest ceiling |
| `PRESETS` (9 x 256 KB) | 2,359,296 | 2.3 MiB |
| `FONTS` (2 MB + working) | 2,162,688 | 2.1 MiB |
| `TOOL_PRESETS` (29 x 64 KB) | 1,900,544 | 1.8 MiB |
| `MAPS` | 1,048,576 | 1.0 MiB |
| `CLIPBOARD` | 4,194,304 | 4.0 MiB - `MAX_JSON_BYTES`, raised from 512 KB on 2026-08-07 |
| `PATTERNS` | 146,086 | 143 KiB - M, 256 records all 32x32 with 48-char names, the worst case `MAX_USER_PATTERNS` allows |
| preferences / window-state / recent | ~10,240 | negligible |
| **Storage total** | **~26,991,615** | **~25.7 MiB** |

### Grand total

**~430,600,000 B = 411 MiB** - roughly 385 MiB resident and 26 MiB on disk.
It was 2.32 GiB before the reference-linking change below.

### The document at maximum

The question this whole table answers: **a full 640x256 canvas with all 32
layers painted edge to edge**, every cell altered and opaque. M 2026-08-07,
`layer2_640`, 32x80 attribute grid, measured in the Playwright harness.

| Representation | Bytes | |
|---|---|---|
| Native picture file (one screen) | 82,432 | The mode's own `fileSize` - what the Spectrum would load |
| Packed snapshot, one layer | 212,480 | What undo holds per layer |
| **Packed snapshot, all 32 layers** | **6,586,880** | 6.28 MiB - one undo entry for an all-layer action |
| Autosave record, as JSON | 56,124,434 | 53.5 MiB - the in-memory serialization |
| **Autosave record, on disk** | **11,648,539** | **11.1 MiB** - worst case, incompressible content |
| Autosave record, on disk, regular content | 1,362,793 | 1.3 MiB - 40.5x compression |
| Live document (object graph) | ~30,146,560 | ~28.8 MiB - C, from V8 object layout; the heap is not measurable here |

Chrome's IndexedDB compresses values (Snappy), which is why the on-disk figure
is 4.8x under the JSON with random content and 40.5x under it with regular
content. **Pixel art is regular**, so a real document lands nearer the 1.3 MiB
end; 11.1 MiB is the number to size against because it is the one that cannot
be exceeded.

**The autosave record needs no cap, and should not get one.** It is a SINGLE
record, overwritten on every save - not a collection - so its maximum is the
maximum document, and that is already bounded by `MAX_LAYERS` and the largest
mode in `SCREEN_MODES`. The stores that needed caps were the ones that grow by
accumulating rows. Worse, a cap here would fail in the one place a failure is
least acceptable: it would silently decline to save the artist's work, which is
the exact event autosave exists to prevent. The right artefact is this figure,
not a limit.

What genuinely bounds the document is therefore `MAX_LAYERS` x the largest
mode. At 32 layers and `layer2_640` that is **11.1 MiB on disk and 6.28 MiB per
all-layer undo entry** - and the undo budget, not the document, is what the
256 MB `MAX_HISTORY_BYTES` is really sizing (~40 all-layer actions, ~1,263
one-layer strokes).

### What the total is actually made of

**The undo budget, 256 MiB**, is now 62% of everything and is the largest
single component. It is deliberate, bounded by `MAX_HISTORY_BYTES`, and the
only one of these figures that is a policy rather than a consequence.

The **artwork itself is 28.8 MiB** live and 11.1 MiB on disk - the 32-layer
document at the largest mode, measured above. Everything the tool exists to make
is 7% of its own maximum footprint.

### Closed 2026-08-07: presets link their reference photo

`PRESET_ASSETS` was **1.94 GiB, 97% of all storage** - each reference image was
capped at 8 MB but the COLLECTION was not, and 242 distinct ones were reachable.
A preset records a PLACEMENT, so it now stores a `FileSystemFileHandle` for the
real photo plus a downscaled thumbnail (256 px longest edge, JPEG q0.72) for
every case the link cannot serve: file moved, another machine, permission
declined, or a `.zxpreset` shared as JSON, which cannot carry a handle at all.
Full resolution comes back off disk whenever the link resolves.

| Photo | Embedded (base64 chars) | Thumbnail | Ratio |
|---|---|---|---|
| 1920x1080 JPEG q0.9 | 958,691 | 8,531 | 112x |
| 4032x3024 (12 MP phone) | 5,603,515 | 14,551 | 385x |

M, 2026-08-07, measured in the Playwright harness against synthesized
photographic content. Recomputing the worst case at the 8 MB cap: 242 assets x
14,551 B = **3,521,342 B (3.4 MiB)**, against 2,030,043,136 B before - a **577x**
reduction, and the aggregate cap that was the recommended fix is no longer
needed, because the thing it would have capped is no longer stored.

The two runtime figures below are unchanged by this: one decoded reference image
still sits in memory at full size while it is being traced, which is the point
of loading it.

**The reference image note.** The decoded image in memory is still unbounded:
the artist loads a photo to trace, the browser holds it as RGBA, and a
6000x4000 photo is ~96 MB whatever it cost on disk. That figure is C from an A -
the compression ratio is assumed, not measured - and it remains the only place
where a documented cap does not bound what actually gets allocated. Linking did
not change it and was never going to: it is ONE image, the one in front of you,
and shrinking it would mean tracing a worse picture. What linking removed was
the 241 OTHER copies sitting in storage behind it.

### Closed 2026-08-07: the pattern library has a limit

`PATTERNS` was the one store with nothing bounding it - not a count, not a byte
cap. It now uses the same convention as the font library:
`PatternService.MAX_USER_PATTERNS` = 256 (equal to `MAX_LIBRARY_FONTS`) with
re-saving an existing name exempt, and `MAX_PATTERN_NAME` = 48 (equal to
`PresetCodec.MAX_NAME`).

Record cost, M 2026-08-07 - `navigator.storage.estimate()` deltas in the
Playwright harness, N=1000 per size in a fresh context so page quantization
amortizes, with a ~20-character name:

| Tile | Packed bitmap | Per record on disk |
|---|---|---|
| 8x8 | 8 B | 139.7 B |
| 16x16 | 32 B | 206.5 B |
| 32x32 | 128 B | 434.9 B |

**50 of each size = 150 records = 62,519 B (61.1 KiB).** M, direct measurement
of exactly that population, five runs spanning 62,393-62,583 B. It is higher
than summing the per-size figures above (39,055 B) because at 150 records the
fixed page overhead is spread over far fewer rows; the direct figure is the one
to quote for that question.

**Worst case the cap allows: 256 records, all 32x32, all with 48-character
names = 146,086 B (143 KiB)** (M). A fifth of the map store's single-record cap.
The count is not defending the disk - it stops the list becoming unnavigable,
which is the limit actually reached first.

Two defects surfaced while measuring, both fixed in the same commit:

1. **The store appended on every save.** `PATTERNS` is keyed by an
   autoIncrement `id`, not by name, so `Storage.set(name, ...)` created a NEW
   record each time. Saving one name five times left five entries the library
   list could not tell apart, and nothing bounded how far that went - the real
   unbounded growth here was the Save button, not the number of distinct
   patterns. `savePatternData` now deletes the name's existing records first.
2. **`data: Array.from(packed)`** stores a plain array of numbers rather than
   the `Uint8Array`. M: 268 B/record against 130 B/record for the same content
   typed, averaged over 1,500 records - **2.07x**. Left alone deliberately: at
   143 KiB worst case it buys nothing, and changing the stored shape would need
   a migration for records already on disk. Recorded here so the next person
   sizing this store knows the headroom exists.

## 7. Corrections

Figures that were wrong or unstated and have since been fixed. Kept visible
because the correction history is the point.

| Figure | Was | Now | Why it was wrong |
|---|---|---|---|
| `MAX_LIBRARY_FONTS` reasoning | "comfortably inside FontCodec.MAX_JSON_BYTES (64 KB)" | The codec cap is PER FONT; the library record has no cap at all | Written 2026-08-07 during this pass and corrected the same hour after checking `_persistLibrary`. The claim was plausible and false, which is exactly the failure this register exists to catch |
| Tooltip 400 / 1000 / 2000 ms | tagged A in the first draft of this table | P, P and C - the code cites Microsoft's `SPI_GETMOUSEHOVERTIME`, the Windows press-and-hold threshold, and a reading-speed computation | The first draft of this register was written from the constant names without reading the comment block above them. Same failure as the row above, in the opposite direction: three well-sourced figures libelled as guesses |

---

## Method

Scanned with a script over `js/**/*.js` matching timer arguments and
constant-name patterns (`MAX_*`, `*_MS`, `*_DELAY`, `*_TIMEOUT`, `*_LIMIT`,
`*_THRESHOLD`, `*_SLOP`). 45 figures found; the prose-only ones are tagged in
these tables rather than in 37 separate comment edits, which is what the
register is for.

The measurements behind sections 3 and 4 were taken in Chrome on 2026-08-07 by
serializing the real structures in the running app: `JSON.stringify` of one
layer (95,458 B), of one undo entry after a full-canvas stroke (190,261 B) and
of a 256-glyph font payload (2,785 B). Serialized size is a proxy for heap, not
heap itself - it is the honest thing to quote because it is what was actually
observed, and it is the right order of magnitude for deciding whether a cap is
protecting anything. Where a decision needs the true heap figure, say so and
measure it with the profiler.

