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

**None as of this pass.** Five figures have left it. `MAX_LAYERS`, `DEFAULT_UNDO_LIMIT` and
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
| Button hold before repeat | 400 ms | A | `Helpers.REPEAT_DELAY`. Shared by the option-panel slider steppers, the Transform shift pad and the Reference offset pad. Chosen to match the tooltip name dwell above, which is this app's existing answer to "how long is a deliberate hold" - but that figure is P for a HOVER and this one is a PRESS, so the borrowing is an assumption, not an inheritance |
| Button repeat interval | 60 ms | A | `Helpers.REPEAT_INTERVAL`, same three controls. ~17 steps a second. Never measured against what a hand finds comfortable |
| Palm-rejection window | 500 ms | A | `input-handler.js` |
| Long press (canvas) | 600 ms | A | `input-handler.js` |
| FLASH clock | 320 ms | P | `layer-manager.js` - the real ULA rate (16 frames at 50 Hz) |
| GIF FLASH frame delay | 32 cs | C | `gif-format.js` - 320 ms expressed in GIF centiseconds |
| GigaScreen frame delay | 2 cs | A | `gif-format.js` - fastest most decoders honour |
| GigaScreen colours on screen | 102 | C | `Helpers.gigaBlendCount()`: the 16 attribute colours' 136 unordered pairs averaged per channel as the compositor blends them, 21 RGB values reached by more than one pair; 87 of the 102 are not any solid ZX colour. Computed at call time from `ZX_PALETTE_RGB`, 2026-09-23 |
| MGH (.mg) sizes by attribute height | 8: 14080, 4: 15616, 2: 18688, 1: 19456 bytes | P | RECOIL DecodeMg size checks, fetched 2026-09-23; `GigascreenFormat._mgLayout` derives every offset from the mode descriptors and reproduces these |
| .hrg size | 24578 bytes | P | RECOIL DecodeHrg: two 12289-byte hi-res screens, frame B at 0x3001, each with its own port byte |
| ULAplus blue levels | 0 / 109 / 182 / 255 | P | the missing third blue bit is the OR of the other two - sinclair.wiki.zxnet.co.uk/wiki/ULAplus, fetched 2026-09-23; `ULAPLUS.blueLevel`. Was 0/85/170/255 (RECOIL's `(b & 3) * 0x55`) until 2026-09-23 |
| ULANext colour indices (default ink mask 7) | ink = attr & 7; paper = 128 + (attr >> 3) | P | wiki.specnext.dev/Enhanced_ULA_Ink_Color_Mask, fetched 2026-09-23. Was ink = (bright ? 8 : 0) + ink, paper = 128 + (bright ? 8 : 0) + paper until 2026-09-23 |
| Layer 2 byte order | 256x192 row-major; 320x256 and 640x256 column-major (byte n = column n >> 8, line n & 255) | P | wiki.specnext.dev/Layer_2, fetched 2026-09-23. Was row-major for all three until 2026-09-23 |
| Timex hi-res border colour | the scheme's PAPER, bright; the border value is ignored | P | "In this mode all colours, including the BORDER, are BRIGHT, and the BORDER colour is the same as the PAPER colour" - worldofspectrum.org/faq/reference/tmxreference.htm, fetched 2026-09-26; `ColorManager.borderColour`. Was the classic colour of the border value (unverified) until 2026-09-26. The hi-res pair shows the Average blend of both frames' papers [C] |
| .rad size | 6160 bytes (6144 bitmap + 16 G3R3B2 palette) | P | RECOIL DecodeRad, fetched 2026-09-23 |
| GigaScreen colours per cell | 4 | P | two screens x (ink, paper) per 8x8 cell; RECOIL DecodeZxImg (two 768-byte attribute blocks in the 13824-byte `.img`) and SpectraLab's README, fetched 2026-09-23 |
| GigaScreen Flicker display rate | 50 Hz (one swap per 20 ms) | P | the hardware frame interrupt (archiveteam Gigascreen page); `LayerManagerClass.GIGA_FRAME_MS`, timed by the clock since `4441f84` (2026-09-23). Was A "display refresh (60 Hz typical)" - one `requestAnimationFrame` per swap - until then |
| Steady-mix step (four-colour photo import) | 2 | M | `GigaQuant.MAX_STEP`: two colours may mix when the same, or at most 2 apart in the ZX colour order with the same bright. `tools/giga-bench.js docs/bench-images`, 2026-09-26, 13 images; step 2 chosen by the artist over step 1 for the warm colours step 1 greys. Was A = 1 before measurement |
| Four-colour vs two-colour import, mean dSSIM | 0.510 flat / 0.584 dithered vs 0.666 | M | same run: step 2; step 1 was 0.517 / 0.589. Lower is better. Re-run 2026-09-26 after black started counting in both brightnesses: flat was 0.511 before, everything else unchanged |
| Four-colour vs two-colour import, mean dEblur | 16.57 flat / 13.46 dithered vs 21.73 | M | same run: step 2; step 1 was 17.32 / 14.46 |
| Four-colour import, mean frame luma gap | 16.8 flat / 18.3 dithered (0-255) | M | same run: mean abs luma difference between a pixel's two frames, what flickers on hardware; step 1 was 15.3 / 16.6, the two-colour import 0. How visible this is on a real Spectrum is NOT measured |
| Four-colour import, time per picture | ~21 ms | M | same run, `ms` column mean at step 2 (Node, this machine): one Import-dialog preview pane; the dialog renders three |
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
| `DEFAULT_UNDO_LIMIT` | 500 | M+C | Raised from 50 on 2026-08-07 once depth stopped being expensive. A one-layer stroke is 212,480 B at LAYER2_640 and 8,448 B at STANDARD_ULA (M), so 500 is ~101 MB at the largest mode and ~4.2 MB at the smallest (C). Since 2026-10-19 the depth to start with; Preferences > Undo steps changes it (stored as `pref.undoLimit`) |
| `MIN_UNDO_LIMIT` / `MAX_UNDO_LIMIT` | 1 / 2000 | P | Source: the owner's decision of 2026-10-19 (a stated requirement, not derived and not a guess): the range of Preferences > Undo steps. `Validators.isValidUndoLimit` allowed 1-500 before. 2000 one-layer steps are ~16.9 MB at STANDARD_ULA (C: 2000 x 8,448 B) and ~425 MB at LAYER2_640 (C: 2000 x 212,480 B), over `MAX_HISTORY_BYTES`, which then keeps ~1,263 (C: 268,435,456 / 212,480) - the setting's hint says the cap can keep fewer steps than set |
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
| Gradient Rotation range | -180 to 180 degrees | C | One full turn (360 degrees) centred on 0, the same range as the Shape tool's Rotation; `gradient-tool.js` ROTATION_MIN / MAX. Added 2026-10-19 (owner decision: build Rotation) |
| Gradient Zoom maximum | 400 % | C | The Coarse grain is a 2 x 2 matrix, 4 levels (C: 2 x 2). Past 4x the whole dragged size falls inside the first quarter of the ramp, one level of that grain, so a larger zoom shows nothing new with it. `gradient-tool.js` ZOOM_MAX. Added 2026-10-19 |
| Gradient Zoom minimum | 25 % | C | 1 / 4 = 0.25, the reciprocal of the maximum, so the slider zooms out as far as it zooms in; the same 0.25 to 4 span as the gradient's Curve slider. A design rule, not a measurement: the owner may move it, nothing else rests on it. `ZOOM_MIN` |
| Gradient Zoom step | 5 % | C | 375 / 5 = 75 slider positions between 25 and 400; the same step the Shape tool's percentage sliders use |

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

## 8. Render throughput - measured 2026-08-29

The first performance figures in this register. Nothing had ever been timed:
every figure above is a cap, a limit or an interval that was *chosen*, and no
commit in the repo's history mentions perf, speed or optimisation (M, `git log`
over the full history). These are throughputs that were *observed*.

**Instrument.** `tools/perf-bench.js` - boots the real app in the harness's
Chrome over `file://`, times each path over enough repetitions to clear
Chrome's ~0.1 ms `performance.now()` clamp, and reports the median of 15
samples after 3 warmup passes. `tools/boot-bench.js` is its cold-boot sibling,
and `tools/speed-bench.js` (added 2026-09-26) times drags, sliders, zoom steps
and autosave through the real input pipeline. All three are instruments, not
tests; re-run them rather than trusting the numbers below after any change to
the paths they time.

**Conditions.** Baseline and optimised were measured BACK TO BACK in one
session, because an earlier baseline taken hours before gave 17.21 ms where the
back-to-back one gave 23.36 ms on the same code - this machine's throughput
moves by a third with thermal state, so any two figures compared here must come
from the same sitting. That is the main thing to know before quoting them.

### `LayerManager.composeToCanvas()` - one full recompose

| Mode / layers | Before | After | Tag | Change |
|---|---|---|---|---|
| STANDARD_ULA, 1 drawing layer | 1.05 ms | 0.215 ms | M | 4.9x |
| LAYER2_640, 1 drawing layer | 4.98 ms | 0.757 ms | M | 6.6x |
| LAYER2_640, 32 layers (the cap, every cell altered) | 23.36 ms | 14.79 ms | M | 1.6x |

The 32-layer row is the ceiling, not a typical document: it requires all 32
layers to carry altered cells across the whole of the largest canvas the app
can make. It matters because a full recompose is reachable from 43 call sites
including undo, layer visibility, merge and reorder - so before this it could
cost 23 ms, comfortably over a 60fps frame (16.7 ms, C: 1000/60), and now it
does not.

### Selection overlay - per rendered frame, while a selection exists

| Mode | Before | After | Tag |
|---|---|---|---|
| STANDARD_ULA, quarter-canvas selection | 0.472 ms | 0.000 ms | M |
| LAYER2_640, quarter-canvas selection | 1.57 ms | 0.000 ms | M |

"Before" was paid on EVERY frame that had any dirty cell, for as long as a
selection was up - including throughout a stroke drawn inside one, which is
what the clip/frisket modes are for. At STANDARD_ULA that was more than twice
the cost of a full recompose of the same canvas, repeated for a picture that
had not changed. "After" is the cached path; the first frame after the
selection actually moves still pays the full cost, which is correct.

### Live previews after the "use existing" rewrite - measured 2026-09-16

The shape/curve/gradient overlay and the floating-stamp preview stopped
reimplementing the drawing rules and now simulate the write through the gate
(`PixelDrawRoutine.simulateCell`) and ask the compositor how the page would
show it. That buys correctness in every draw mode, screen mode and layer
arrangement; this is what it costs. Measured back-to-back in one sitting
against a `git archive` of the pre-change tree, 9 layers with real content,
instrument `preview-bench.js` (median of 15, plus the repo's own
`gradient-preview.spec.js` driving a real drag).

| Path | Before | After | Tag |
|---|---|---|---|
| Shape preview, 39,100 pending pixels (a near-full-canvas drag) | 9.30 / 8.90 ms | 9.90 ms | M |
| Stamp preview, 200x150 stamp redrawn in place | 0.20 / 0.10 ms | 0.60 ms | M |
| Real gradient drag, `_updatePreview` average | 5.03 / 5.00 ms | 5.23 ms | M |
| Real gradient drag, `_updatePreview` worst | 7.60 / 7.70 ms | 9.60 ms | M |

Two "before" figures per row because the before tree was measured on both sides
of the after run: the spread between them (0.4 ms, 0.1 ms, 0.03 ms) is this
machine's drift, and it is the right yardstick for the differences.

The user-facing path costs **+0.2 ms an update, 4%** (C: 5.23 - 5.01 mean of
the two before runs). The synthetic worst case costs +0.8 ms, about twice the
drift. The stamp preview is 3-6x its old cost and still 0.6 ms, an order of
magnitude inside `CoverageOps.LIVE_BUDGET_MS` (7 ms, half a 60fps frame).
Nothing was optimised on the strength of this: the one figure that grew past
the half-frame budget is the worst case of a full-canvas gradient drag, which
was already at 7.6 ms before the change, and the gradient tool coalesces its
preview to one pass per animation frame.

### Interaction speed pass - measured 2026-09-26

A sweep of what runs per pointer move, per slider tick, per zoom step and per
autosave, rather than per compose. Instrument `tools/speed-bench.js`: it drives
the real input pipeline with synthetic PointerEvents, each move carrying the 16
coalesced samples a 1000 Hz mouse delivers per 60 Hz frame. Before is a
`git archive` of `e87a26a`; before and after were measured in ONE sitting, in
the order before, after, before, after, and both runs are given. The machine is
a cloud container with no GPU (headless Chromium 1194).

**Software canvas** (Chromium's default without a GPU):

| Path | Before | After | Tag | Change |
|---|---|---|---|---|
| Marquee drag over busy artwork, per move | 63.1 / 60.9 ms | 0.29 / 0.30 ms | M | coalesced samples + one masked fill |
| Marquee preview, full canvas | 15.7 / 15.6 ms | 0.28 / 0.29 ms | M | one masked fill, not a fillRect per pixel |
| Filled-rectangle drag, per move | 88.0 / 85.2 ms | 8.1 / 7.6 ms | M | the shape tool takes the last coalesced sample |
| Eraser size 128, full-width drag | 797 / 815 ms | 261 / 250 ms | M | memoised disc, byte-grid dedupe, byte-grid `boundaryPoints` |
| Rotate-image slider, per tick, full canvas | 63.1 / 66.9 ms | 25.6 / 27.7 ms | M | batched writes, source mask drawn once per snapshot |
| Grid backing store at 1600%, DPR 2, all grids off | 1208 MB | 0 MB | M | only visible grids own a canvas |
| ...and the zoom step that allocates it | 777 / 742 ms | 0.4 / 0.2 ms | M | |
| Grid backing store at 1600%, DPR 2, cell grid on | 1208 MB | 201 MB | M | no hidden grids, no cache copies |
| ...and its zoom step | 824 / 780 ms | 127 / 122 ms | M | |
| Autosave capture, 3000x2000 reference loaded, every tick after the first | 157 / 142 ms | 16.6 / 16.0 ms | M | the reference's JPEG encode is cached per image |
| Autosave capture, first tick after loading the reference | 144 / 183 ms | 189 / 164 ms | M | unchanged, and should be: it still encodes once |

**Accelerated canvas** (the same build with `--use-angle=swiftshader`, so the
canvas takes the GPU path on an emulated GPU). This is the only way to see the
per-upload cost on this machine, but SwiftShader runs the GPU on the CPU and
inflates every draw call, so read these for direction, not magnitude - a real
GPU sits somewhere between the two tables:

| Path | Before | After | Tag |
|---|---|---|---|
| Render pass, 165 dirty 8x1 cells (one size-32 stamp) | 1.31 / 1.21 ms | 0.090 / 0.085 ms | M |
| Render pass, 2 dirty cells in opposite corners | 0.040 / 0.050 ms | 0.065 / 0.055 ms | M |
| Marquee drag, per move | 1177 / 1178 ms | 0.23 / 0.35 ms | M |
| Rotate-image slider, per tick | 725 / 713 ms | 32.9 / 33.3 ms | M |
| Idle editor, animation frames requested per second | 60 / 60.5 | 0 / 0 | M |

The corner row is the one-upload box's worst case: it re-sends every clean pixel
between two far-apart cells. It costs +0.015 ms (C: 0.060 - 0.045 means), inside
the drift of the rows around it, against 1.2 ms saved on an ordinary stroke.

Every change was checked for identical output, not only for speed: the marquee
preview canvas, the grid canvases (DPR 1 and 2, three modes, three zooms, after
a theme change) and the rotated layer data (four modes, with and without a
selection, including the undo stack) are byte-identical before and after, and
the eraser's output is pinned by `tests/tool-footprint.test.js`.

What is left in the eraser drag (CPU profile of the after tree, one drag): about
120 ms walking all 12,796 offsets of the disc at every step, most of which the
previous step already cleared, and about 57 ms building the per-move hover
footprint. Stamping only the leading edge of each step would take most of the
first; it is a rewrite of the stroke, so it was not part of this pass.

### Shift and the Move choice - measured 2026-10-08

Batch 2 part 2B2 changed `TransformService.shift` (diagonals, a per-axis
amount, and the Move content choice). Instrument: a Node harness that runs
`shift` 40 times per run on a picture with dots on every third row and fifth
column, two runs back to back in one sitting. Before = commit 92fd7c2 (the
single-direction shift, 1 pixel); after = the working tree (2B2). Node, not
the browser: read for the ratio and the order of magnitude.

| Path | Before | After | Tag |
|---|---|---|---|
| Layer 2 640x256, shift 1 pixel left/right | 29.0 to 30.6 ms per call | 29.6 to 31.0 ms per call | M, 2026-10-08, 2 runs each |
| multigiga_8x1 256x192 (two screens), diagonal whole-cell step, content both | not measured (the diagonal did not exist) | 12.2 to 13.3 ms per call | M, 2026-10-08, 2 runs each |

Reading: the Layer 2 path is unchanged within the run-to-run spread (about
2 ms here), so the rounding fix and the new diagonals add no measurable cost
there. The multigiga figure is the worst case the pad can ask for: one
diagonal press is two passes over the whole screen. [C] mid-point of the two
multigiga runs: (12.2 + 13.3) / 2 = 12.7 ms per call. A held diagonal keeps
up with its repeat only while the repeat interval is longer than that. The
repeat interval in Helpers.REPEAT_INTERVAL is 60 ms ([A]: a guess, never
measured), so the check passes with the 60 ms guess. Measure the real hand
cadence before relying on it.

### XOR strokes and the drawing-modes strip - measured 2026-10-07 and 2026-10-08

XOR / Over remembered which pixels a stroke had toggled in a Set of
`"layer:pixel"` strings, built on every write; XOR / Pixel had no memory at all
and toggled on every write. Both were replaced by one byte-per-pixel array per
stroke plus, for the renamed XOR / Every Pass, a pass rule
(`PixelDrawRoutine.nextPass`). Instrument: a Node probe that drives the real
FillTool and BrushTool through the `tests/draw-mode-matrix.test.js` harness,
median of 15 interleaved runs (9 for strokes), old and new code run back to
back in one sitting (2026-10-08). Node, not the browser: read for the ratio.

| Path | Before | After | Tag |
|---|---|---|---|
| Full-screen fill, STANDARD_ULA, Normal | 7.1 ms | 7.5 ms | M |
| ...XOR / Over | 14.3 ms | 7.9 ms | M |
| ...XOR / Pixel -> XOR / Every Pass | 7.3 ms | 7.9 ms | M |
| Full-screen fill, LAYER2_640, Normal | 25.3 ms | 26.0 ms | M |
| ...XOR / Over | 60.7 ms | 27.8 ms | M |
| ...XOR / Every Pass | 25.4 ms | 27.3 ms | M |
| 90-event wavy stroke, size 8, XOR / Every Pass | 0.6 ms | 1.1 ms | M |
| ...size 32 | 8.7 ms | 7.8 ms | M |
| ...size 32, Mirror H+V | 31.2 ms | 29.5 ms | M |

Before the change, the LAYER2_640 XOR cost was ESTIMATED at about 18 ms over
Normal (C: (12.0 - 6.6) ms on the standard screen x 3.33 for the larger one,
assuming linear scaling). Measured, it was 35.4 ms over (C: 60.7 - 25.3) - the
estimate was half the real cost, so linear scaling did not hold.

What the pass rule fixed, in pixels kept (M, Node probe 2026-10-07; and M,
real mouse drags at 400% zoom in Chrome through InputHandler, 2026-10-08):

| Stroke | XOR / Over | XOR / Pixel (before) | XOR / Every Pass (after) |
|---|---|---|---|
| Size 5, 41 px, 1-px steps (Node) | 221 | 205 | 221 |
| Size 5, 41 px, 4-px steps (Node) | 221 | 115 | 221 |
| Thin ellipse / star / polygon (Node) | 166 / 346 / 194 | 164 / 340 / 191 | 166 / 346 / 194 |
| Size 5 drag in Chrome, slow / fast | 296 / 296 | 280 / 157 | 296 / 296 |
| Size 5 drag in Chrome with Mirror H, each side | 221 | 124 | 221 |

The strip's three groups gained two dividers. ColorBarFit's settled scale and
the icon width, before -> after (M, Chrome, 2026-10-08): 800 px window
0.590 -> 0.570 (31.8 -> 30.8 px), 1024 px 0.928 -> 0.895 (50.1 -> 48.3 px),
1366 and 1600 px unchanged at 1 (54 px), 1366 px at 200% 0.414 -> 0.401
(44.7 -> 43.3 px). One row everywhere, as before. At 1024 px and 200% the
strip was already at 0.154, a hair above ColorBarFit's 0.15 FLOOR, and now
sits on it at both device pixel ratios; the test that checks the DPR margin
grows moved to 1200 px (0.277 / 0.270), where the scale is not floored.

### View switches (Colours Off, Colour Grid, Stop Flashing) - 2026-10-09

| Figure | Before | After | Tag |
|---|---|---|---|
| `composeToCanvas`, standard_ula, 768 cells, 8 layers, mean of 40 | 0.41 / 0.34 ms | 0.35 / 0.33 ms | M, 2026-10-09, Node with blits stubbed, 2 runs each. The "before" runs had the old inline FLASH swap put back in, not a checkout |
| multicolor_8x1, 6,144 cells | 3.52 / 3.58 ms | 3.39 / 3.67 ms | M, same method |
| multigiga_8x1 Average, 6,144 cells | 14.04 / 13.76 ms | 13.66 / 14.34 ms | M, same method |
| timex_hires, 1,536 cells | 0.87 / 0.79 ms | 0.78 / 0.76 ms | M, same method |
| layer2_640, 2,560 cells (not touched by the rule) | 0.650 / 0.649 / 0.698 ms | 0.634 / 0.638 / 0.639 ms | M, same method, three alternating runs |
| The two calls added to `composeToCanvas` (`_refreshDisplayFlags`, `_syncFlashClock`) | - | about 8.5 ns per compose | M, same method |
| Display greys in `DISPLAY_VIEW_COLOURS`: chessboard 224, screen A only 170, screen B only 102 (of 255) | - | - | A, 2026-10-09: three levels chosen to be told apart from each other and from white and black. Nothing depends on the exact values; change them freely |

No decision rests on the grey levels. The compose cost did not move beyond run to
run noise, so no optimisation was needed.

### Pointer readout and custom grid - 2026-10-09 (batch 3 part 3B)

| Figure | Value | Tag |
|---|---|---|
| Display file at $4000, attributes at $5800, PLOT rows 176 | as written | P, ZX BASIC manual ch. 17 and 24, read 2026-10-09 |
| Timex second display file at $6000, hi-colour attribute = pixel byte + $2000, hi-res columns alternate | as written | P, TS2068 port map, read 2026-10-09 |
| Shadow screen in bank 7 at $C000 | as written | P, World of Spectrum 128K reference, read 2026-10-09 |
| GigaScreen screen A = bank 5, screen B = bank 7 | convention | A: the .img file does not say; shown labelled, nothing depends on it |
| Custom grid draws a direction only when step x scale >= 4 CSS px | 4 px | C: the pixel grid shows from 400%, 1 px x 4 |
| Custom grid default step | 4 | A: a visible but not crowded start; the owner sets their own |
| Custom grid default colour | #00aa00 (light), #008800 / #3f7f3a (themes) | A: chosen to differ from the pixel, cell and block grids |
| Readout refresh | 32 ms throttle, unchanged | C, as before |

### Inverse and Colour core - 2026-10-09 (batch 4 part 4A)

| Figure | Before | After | Tag |
|---|---|---|---|
| Layer 2 640x256 whole-screen fill, 163,840 `draw()` calls with `resolveUserMode`, steady state of 5 runs | 20.9 to 21.8 ms | 20.5 to 22.3 ms | M, 2026-10-09, Node with blits stubbed, 2 runs each back to back; "before" is `pixel-draw-routine.js` from commit c6d7a13. A first version read Inverse with a keyed lookup (`get('draw.inverse')`): 24.0 to 25.4 ms (+15%). Made a plain field; recorded so the keyed read is not tried again |
| standard_ula, one 32 px brush stroke over 250 px, steady state | 1.7 to 2.2 ms | 1.8 to 2.3 ms | M, same method (core off) |
| Strip icon width, 800 / 1024 / 1200 px window, default interface size | 30.8 / 48.3 / 54 px | with the Inverse button 28.3 / 44.5 / 54 px | M, 2026-10-09, Playwright |
| Strip rows at 1024 px window, 200% interface size | 1 row (16 px icons, the floor) | 2 rows | M, 2026-10-09, Playwright; see batch-04.md |

### The 15-button strip - 2026-10-09 (batch 4 part 4B)

| Figure | Value | Tag |
|---|---|---|
| Strip icon width, 800 / 1024 / 1200 px window, default interface size, 15 buttons | 22.7 / 36.0 / 46.2 px (12 buttons: 28.3 / 44.5 / 54) | M, 2026-10-09, Playwright; matched the 2026-10-09 prediction made with clones of a button |
| Strip rows with 15 buttons, 1024/1280/1366/1600 px x interface 100/125/150/200% | 1 row everywhere except 1024 px at 200% (2 rows) | M, 2026-10-09, Playwright |
| Interface fit floor (ColorBarFit), icon width at the floor | 16 px at scale 0.15 | M, 2026-10-09 |

### What was measured and NOT acted on

| Path | Figure | Tag | Why it was left |
|---|---|---|---|
| `deferCellCompose` x804 (one size-32 brush stamp) | 0.023 ms | M | The per-pixel `` `${cellX},${cellY}` `` key allocation is real and is ~48,000 strings/second while drawing (C), but it costs 23 microseconds a stamp. Converting the three coordinate-keyed Sets to numeric keys would be churn in the two most mode-tested files in the app for no measurable gain |
| `markCellDirty` over a full canvas | 0.041 ms | M | Same encoding, same conclusion |
| Boot to `html[data-app-ready]` | 170 ms | M | See below |
| DOMContentLoaded, all 13 locale tables eager | 51.9 ms | M | All 13 locales load as `<script>` at boot; 12 are never read. 777 KB of 3.05 MB of app JS (C) |
| DOMContentLoaded, 12 locales lazy-injected | 48.6 ms | M | **3.3 ms, 6.4%.** Implemented, measured, and REVERTED: it makes `I18n.setLocale` asynchronous - a trap for any future caller or test asserting on translated text straight after a switch - and 3.3 ms does not buy that. Recorded here so the decision does not have to be rediscovered. Revisit if the app is ever targeted at storage slower than this machine's |
| Indexed stacking, top-down with early exit | 13.04 -> 16.82 ms | M | Tried as an optimisation and it was SLOWER. Upper layers are mostly transparent in any real document, so the early exit almost never fires and the per-pixel "already decided" test is pure overhead. Reverted; the reason is recorded in `_composeIndexedCellData` so it is not tried again |
| Reference-layer slider, the IndexedDB save on every `input` tick (2026-09-26) | 0.029 ms a tick | M | Debouncing it would open a window in which a quick reload loses the last value, to save 0.03 ms |
| `TransformPanel._sync` on every `CANVAS_RENDER` (2026-09-26) | 1.4 us a frame | M | Two lookups and two no-op writes in the usual no-stamp case. Nothing to win |
| Boot: preset slots (24 keyed reads, the 2026-08-07 slot-drop migration included) and tool presets (28 keyed reads) (2026-09-26) | 4 ms + 4 ms | M | Read key by key on purpose - the localStorage fallback cannot enumerate a store, and a record is filed by its key, which `getAll()` does not return. Running them in parallel would change what a failed read part-way through leaves applied, for about 8 ms |
| Boot: the Patterns panel draws its 62 thumbnails while hidden (2026-09-26) | 3.7 ms of drawing, 4.6 ms wall | M | Asynchronous and not awaited by boot, so it is not on the path to `data-app-ready`. Deferring it to first show would leave the panel empty for anything that looks at it before then |
| Autosave: skip a tick when nothing changed since the last one (2026-09-26) | not built | - | The autosave captures layer, palette, reference and tool state, not only pixels, and not all of those set FileManager's unsaved flag. A change counter tied to that flag could silently leave a change out of the crash-recovery record. The per-tick cost is now 16 ms (the table above), once a minute at most |

Two of the rows above are things that looked like optimisations and were not,
and four more are costs that turned out too small to be worth the change they
would need. That is the point of measuring first.

### Stamp placement and preview after the one write plan - measured 2026-10-10

Batch 5 part 5A routed `stampAt`, `commitStamp` and both previews through one
write plan (`SelectionService._forEachStampWrite`). Measured in Node against the
repo's test stubs (no canvas, so this is the logic cost only, not rendering),
a full-canvas stamp with a third of its dots set, plain default settings,
median of 7 calls, two runs back to back against a `git archive` of the tree
before part 5A (commit ad47ff8), one sitting.

| Path | Before (run 1 / 2) | After (run 1 / 2) | Tag |
|---|---|---|---|
| `stampAt`, 256x192 stamp, standard_ula | 1.9 / 2.0 ms | 2.1 / 2.1 ms | M |
| Preview (`moveFloatingPaste`), 256x192, standard_ula | 1.0 / 0.9 ms | 1.6 / 1.6 ms | M |
| `stampAt`, 640x256 stamp, layer2_640 | 8.6 / 9.7 ms | 10.8 / 10.4 ms | M |
| Preview, 640x256, layer2_640 | 2.8 / 2.9 ms | 2.8 / 2.7 ms | M |

The classic preview now collects the stamp's writes into a per-cell map before
simulating, instead of walking each cell's pixels in turn: +0.6 ms (C: 1.6 -
1.0) on a stamp that covers the whole picture, which is the worst case. That is
a tenth of `CoverageOps.LIVE_BUDGET_MS` (7 ms), so nothing was changed on the
strength of it. The indexed default path is the old direct one and is unchanged.

### Figure tool geometry cost - measured 2026-10-10

Node, repo test stubs (no canvas, so this is the geometry only; the compositor preview that follows is
measured in the browser specs, not here). A filled four-corner polygon covering the whole canvas (the worst
case a person can draw), median of 9 calls, two runs back to back in one sitting.

| Path | Run 1 / 2 | Tag |
|---|---|---|
| `FigureModel.rasterise`, 256x192 (49,152 pixels), standard_ula | 4.5 / 4.6 ms | M |
| `PixelDrawRoutine.strokeTargets`, same pixels | 4.1 / 4.0 ms | M |
| `FigureModel.rasterise`, 640x256 (163,840 pixels), layer2_640 | 10.9 / 10.6 ms | M |
| `PixelDrawRoutine.strokeTargets`, same pixels | 13.0 / 13.0 ms | M |

A full-canvas fill in Layer 2 640 costs about 24 ms of geometry (C: 10.9 + 13.0) per preview redraw, which is over
the 7 ms `CoverageOps.LIVE_BUDGET_MS` budget [P: CoverageOps, read 2026-10-10]. That is the extreme case; a figure the size of
a sprite is a few hundred pixels [A: not measured]. Corrected 2026-10-10 (group B review): since Batch 7C the Figure
preview is NOT only redrawn on a click. `figure-tool.js` re-renders the full figure, fill included, on every hover
move while points are being placed, and point-mode drags re-render on every move; `FigureEditor.render` rasterises
twice (the plan, and `knob()`), and an editable Shape rasterises twice more. Worst case per move in Layer 2 640 is about
35 ms [C: 2 x 10.9 + 13.0, from the table], five times the 7 ms budget. Not yet fixed; it is only reached with a
full-canvas filled figure, and a figure of a few hundred pixels is far below it. Open item: rasterise once per render.

### Line style and rotation cost - measured 2026-10-10

Node, repo test stubs, a 601 x 241 ellipse (about 1,300 pixels [C: counted from the raster of that ellipse]) in Layer 2 640, median of 7 calls, two runs back to
back in one sitting.

| Path | Run 1 / 2 | Tag |
|---|---|---|
| Solid | 0.0 / 0.1 ms | M |
| Dashed (orderOutline walk + pattern) | 0.9 / 1.0 ms | M |
| Rotated 30 degrees (sampled outline) | 0.8 / 0.7 ms | M |
| Rotated 30 degrees and dashed | 1.2 / 1.4 ms | M |

All far inside the 7 ms live budget (C: 1.4 / 7 = 20 percent at worst). The outline walk is quadratic only when it has
to jump between pieces, which a one-pixel closed outline does not.

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


### Dither module timing - measured 2026-10-10 (Batch 8 part 8A)

`node tools/dither-bench.js`, Node v24.19.0, a 640x256 grey image (163,840 pixels; a ramp plus fixed noise), median of 9
calls per method, two runs back to back in one sitting [M]. Run 1 / run 2:

| Methods | Run 1 / 2 | Tag |
|---|---|---|
| 3 thresholds | 0.17 / 0.17-0.18 ms each | M |
| 9 ordered, cluster and supercell methods, bayer 2/4/8 | 0.34-0.52 ms each | M |
| Error diffusion, small kernels (Sierra Lite, False FS, FS, Zhigang Fan, Shiau-Fan, Atkinson, Burkes, Sierra 2-row) | 1.9-3.1 ms each | M |
| Error diffusion, large kernels (JJN, Stucki, Sierra 3-row) | 3.9-4.5 ms each | M |
| Park-Kang-Kim | 6.5 / 6.6 ms | M |
| Stevenson-Arce | 16.8 / 16.7 ms | M |
| All 31, summed | 64.4 / 63.x ms | C: sum of the 31 medians |

Against the 7 ms `CoverageOps.LIVE_BUDGET_MS` budget [P: coverage-ops.js, read 2026-10-10] every method but Stevenson-Arce fits at
this size; error diffusion is a serial scan and cannot be done per pointer move on a full 640x256 image either way, so 8B
should preview on a reduced image or debounce it. `PKK_SPLIT = 224` in `js/utils/dither.js` is an [A] figure: the
measurement against the help pictures could not tell kernel A from kernel B in the highlights, and nothing rests on it.

### Dither in import and gradient - measured 2026-10-10 (Batch 8 part 8B)

`node tools/import-dither-bench.js`, Node v24.19.0, standard_ula (256x192, 49,152 pixels [C: 256 x 192]), the Smooth
conversion of one image (cell pairs chosen, dots rendered, preview painted), median of 9, two runs back to back [M]:

| Dither | Run 1 / 2 | Tag |
|---|---|---|
| Floyd-Steinberg (the importer's own, unchanged) | 4.4 / 4.2 ms | M |
| Bayer 8 (through Dither.paletteIndices) | 5.0 / 5.1 ms | M |
| Stevenson-Arce | 6.3 / 6.5 ms | M |

All within the 7 ms live-preview budget [P: CoverageOps.LIVE_BUDGET_MS] at this size. The gradient tool now runs one
`Dither.apply` over the whole gradient rectangle for a method: the full-canvas Layer 2 640 case (163,840 pixels)
costs the Dither time already measured above (0.2-0.5 ms ordered, 2-4.5 ms most kernels, 6.6 ms Park-Kang-Kim, 16.8 ms
Stevenson-Arce [M, 2026-10-10 section above]) plus the existing per-pixel position loop; a before / after run of the
gradient preview on layer2_640 was NOT made [A: nothing was measured]. A picture-made fill is at most 32 x 32 = 1,024
pixels [C], negligible.

### Preview panel and New Picture from Selection - measured 2026-10-12 (Batch 9 part 9B)

One redraw of the Preview map (drawImage of the live canvas into the panel's canvas, frame stroked, then a 1-pixel read-back to
force the work to finish), median of 200, two runs back to back, in the Playwright Chrome [M]:

| Mode | Run 1 / 2 | Tag |
|---|---|---|
| standard_ula | 0.5 / 0.4 ms | M |
| layer2_640 | 0.6 / 0.3 ms | M |

Against the 32 ms redraw interval [C: every second frame of a 60 Hz display; 16.7 ms a frame, P] that is about 1-2 % of the interval [C: 0.6 / 32].
The cheaper route the plan hoped for (drawImage from the live canvas rather than a copy through getImageData) was the one used and
it agrees with the canvas pixel for pixel in the spec; the getImageData alternative was NOT timed [A: assumed slower, never measured].

`node tools/crop-bench.js`: LayerManager.cropToCells at layer2_640 (80 x 32 cells a layer) with 32 drawing layers, median of 7,
two runs: 56.1 / 31.7 ms [M, Node v24.19.0, repo test stubs]. The undo entry holds every layer [P: about 6.8 MB, undo-redo.js comment
of 2026-08-07]. A one-off action, not a per-frame cost.

### Text stamp re-render with opposite dots - measured 2026-10-13 (Batch 10A2)

`node tools/text-layers-bench.js`, Node v24.19.0: "Hello world", ZX ROM 16 px, shadow and outline on, re-rendered at scale 1.5 by
SelectionService.setStampScale, median of 15, two runs back to back [M]:

| Dots | Run 1 / 2 | Tag |
|---|---|---|
| Same | 1.6 / 1.4 ms | M |
| Opposite (a second coverage chain for the clear dots) | 1.6 / 1.5 ms | M |

Against the 7 ms live budget [P: CoverageOps.LIVE_BUDGET_MS] both fit by a wide margin at this size; the plan's estimate that opposite
dots "double the coverage work" [A] did not show up in the total at this size (the effect chain is a small part of it).

### Type on canvas preview cost - measured 2026-10-13

Method: Playwright run in this machine's Chromium, mode layer2_640 (640 wide), Text tool, Type on canvas, Clear background on, one
full-width line of 78 "M" characters at 8x8, `TextTyping.preview(true)` timed with `performance.now()` for 15 consecutive keystroke
rebuilds; median and worst of the 15, run three times.

| Path | Figure | Tag |
|---|---|---|
| Preview per keystroke, median | 0.7 to 1.0 ms | M |
| Preview per keystroke, worst of 15 | 3.1 to 4.3 ms | M |
| Budget | 7 ms (`CoverageOps.LIVE_BUDGET_MS`, half a 60 fps frame) | C: 1000/60/2 = 8.3, the code constant is 7 |

Median is about 7 times inside the budget and the worst case about 1.6 times inside it; nothing was optimised.

### Big font (CHX) sizes - computed 2026-10-13

| Figure | Value | Tag |
|---|---|---|
| Heaviest big font record in the library: 256 glyphs of 32 x 32 | 256 x 128 = 32,768 bytes; base64 = ceil(32,768 / 3) x 4 = 43,692 characters | C |
| Its shading list | 256 x 2 = 512 bytes; base64 = 684 characters | C |
| Encoded total against `FontCodec.MAX_JSON_BYTES` | about 44.5 KB of 64 KB (65,536) | C: 43,692 + 684 + about 100 for the other fields |
| Big fonts that fit the 2 MB library cap in the worst case | 2,097,152 / 44,500 = 47 | C |
| Heaviest CHX file: 256 characters of 4 x 4 blocks, transparent | 517 + 256 x (3 + 16 x 8) = 33,653 bytes | C |
| Same, all coloured (9 bytes a block, not written by PixULA) | 517 + 256 x (3 + 16 x 9) = 38,149 bytes, under the 65,535 reach of the 2-byte offsets | C |
| Glyph grid repaint for 256 glyphs of 32 x 32 | 256 x 32 x 32 = 262,144 pixel tests | C |

### Font Editor map and undo - measured 2026-10-13

Method: Node (tests/font-map.test.js, `FONTMAP_TIME=1`, two runs back to back) and Playwright in this machine's Chromium (tests/browser/font-editor-map.spec.js,
a 4 x 4-block 256-character font = 512 x 512 map).

| Path | Figure | Tag |
|---|---|---|
| `FontMap.compose` of 256 glyphs of 32 x 32 | 0.26 / 0.21 ms | M |
| `FontMap.decompose` of all 256 | 0.89 / 0.88 ms | M |
| `FontMapView.setData` (compose + paint the image + size the canvas) | 1.9 ms | M |
| One pointer move while drawing (handler only; the canvas is redrawn once per animation frame) | 0.008 ms mean over 200 moves | M |
| `FontMapView.redraw` at zoom 1 and 3 | below 0.1 ms (the browser timer rounds to 0.1 ms; the drawing itself runs on the GPU) | M, a ceiling only |
| Budget | 16.7 ms = one 60 fps frame | C: 1000 / 60 |
| Map canvas redraw at 1536 / 2048 / 3072 / 4096 pixels a side (512 x 512 picture) | 8.6 / 12.8 / 29.5 / 51.2 ms, median of 9 with readback | M, 2026-10-13 (replaces an untagged 1600-pixel guess) |
| Map zoom cap | 2048 / 512 = 4 at the largest map: the largest canvas that redraws inside 16.7 ms | C from the row above |
| Undo history cap | 2 MB; the heaviest snapshot 256 x (128 + 2) = 33,280 bytes, so about 63 steps | C: 2,097,152 / 33,280 |

### Type on canvas with a big proportional font - measured 2026-10-13

Method: Playwright in this machine's Chromium, mode layer2_640, a 32 x 32 font (256-glyph class, shaded on alternate letters), Character width and
height 64, a line of 9 letters (496 x 64 pixels), `TextTyping.preview(true)` timed for 15 keystroke rebuilds, two runs back to back.

| Path | Figure | Tag |
|---|---|---|
| Preview per keystroke, median | 2.7 and 2.9 ms | M |
| Preview per keystroke, worst of 15 | 8.8 and 9.6 ms | M |
| Budget | 16.7 ms = one 60 fps frame; the 7 ms `CoverageOps.LIVE_BUDGET_MS` is the stamp-preview budget, which the worst case here (8.8 and 9.6 ms) exceeds | C: 1000 / 60 |
| Same measure with the 8 x 8 ROM font, full-width line, Clear background (Batch 10B) | median about 1 ms, worst about 4 ms | M, 2026-10-13 |

The worst case is inside a frame but only by 1.7 times; nothing was optimised.

### Dither methods in the indexed imports - measured 2026-10-13

Method: Playwright in this machine's Chromium, `PNGFormat._quantizeIndices` on a full-screen noise picture (every pixel a different colour), median of 3,
two runs back to back; the palette is the one the importer builds for the picture.

| Mode (screen, palette) | Floyd-Steinberg | Bayer 8 | Atkinson | Tag |
|---|---|---|---|---|
| Layer 2 256 (256 x 192, 256 colours) | 17 and 20 ms | 8 ms | 9 ms | M |
| Layer 2 640 (640 x 256, 16 colours) | 8 and 9 ms | 13 ms | 15 and 16 ms | M |
| LoRes (128 x 96, 256 colours) | 5 ms | 7 and 8 ms | 8 and 12 ms | M |

Each is well under the 100 ms a person starts to notice a pause at [P: Nielsen, response times, widely cited]; nothing was optimised beyond a table of
already-seen colours in `Dither.paletteIndices` (palettes of more than 16 colours only, same answer).

### Gradient preview with a Dither method at Layer 2 640 - measured 2026-10-13 (group C review)

Method: Playwright in Chromium on this machine, full-canvas gradient `_updatePreview`, median of 7, two runs back to back (taken by the reviewer).

| Grain | Run 1 | Run 2 | Tag |
|---|---|---|---|
| Bayer 8 (the gradient's own) | 34.6 ms | 28.7 ms | M |
| Floyd-Steinberg | 35.1 ms | 38.0 ms | M |
| Stevenson-Arce | 36.0 ms | 45.0 ms | M |

All are above the 7 ms live budget (`CoverageOps.LIVE_BUDGET_MS`) - the preview was already about four times over it before the dither methods (Bayer 8, 28.7 to 34.6 ms),
and the methods add 0 to 16 ms on top. This replaces the earlier 'nothing was measured' note; no change was made on the strength of it.

### Map elements: find speed and record size - measured 2026-10-13

Method: `node tools/map-find-bench.js` (Node, this machine), a screen of the mode filled with four dot patterns and varied attributes, `captureScreen` and
`findElement` with a 1 x 1 and a 4 x 4 block, median of 7, two runs back to back (the ranges are the two runs).

| Mode (cells) | Capture the picture | exact / dots, either block | visual, either block | Tag |
|---|---|---|---|---|
| Standard ULA (32 x 24) | 0.1 to 0.4 ms | 0.2 to 0.4 ms | 2.9 to 3.3 ms | M |
| GigaScreen (32 x 24, two screens) | 0.2 to 0.4 ms | 0.3 to 0.4 ms | 3.2 to 3.6 ms | M |
| Timex hi-res pair (64 x 24, two screens; no exact) | 0.4 to 1.0 ms | 0.5 to 0.8 ms (dots) | 7.7 to 7.8 ms | M |

A find is a few milliseconds even on the biggest grid, so it runs synchronously (the earlier estimate was [A] until this measurement). The slowest, the Timex pair
with Visual compare, is 7.8 ms against a 16.7 ms frame [C: 1000 / 60].

| Figure | Value | Tag |
|---|---|---|
| Smallest element record as stored (1 x 1, one screen, one place) | 95 bytes | M |
| Room left beside the largest map | 1,048,576 - 291,879 = 756,697 bytes | C: `MapCodec.MAX_JSON_BYTES` less the largest-map row measured 2026-08-07 |
| Smallest elements that fit there | 756,697 / (95 + 1) = 7,882 | C |
| `MapCodec.MAX_ELEMENTS` | 4,096, below 7,882, so it never binds before the size limit does | C |
| Full-screen two-screen elements beside the largest map | 40 fit; the largest document then encodes to 1,032,628 bytes | M (tests/map-elements.test.js) |

### Map elements: Visual compare after each GigaScreen screen is compared on its own - measured 2026-10-14

`node tools/map-find-bench.js`, two runs back to back. This replaces the GigaScreen and Timex-pair "visual" rows above (3.2 to 3.6 ms and 7.7 to 7.8 ms [M, 2026-10-13], measured when the two screens were blended).

| Mode | Visual compare, 1x1 or 4x4 block (before -> now) | Tag |
|---|---|---|
| GigaScreen (32 x 24, two screens) | 3.2 to 3.6 ms -> 4.2 to 4.3 ms | M |
| Timex hi-res pair (64 x 24, two screens) | 7.7 to 7.8 ms -> 6.8 to 6.9 ms | M |
| Standard ULA | 2.7 to 2.8 ms (unchanged) | M |

All are well under a 16.7 ms frame [C: 1000 / 60], so the find still runs straight away.


### Gradient polygon styles, Rotation and Zoom - measured 2026-10-20

Method: a temporary Playwright spec (deleted after), Chrome on this machine, Layer 2 640, a full-canvas gradient
(640 x 256 = 163,840 pixels [C]), axis from corner to corner, Bayer 8, `_updatePreview` median of 7. Before = the
working tree with `gradient-tool.js` taken back to the last commit (no new styles), after = with them, the edge-based
styles at Rotation 20 (the turned path). Two sessions of two runs each, before and after back to back; the figures are
the range over the four runs [M].

| Style | Before | After | Tag |
|---|---|---|---|
| Square | 35.6 to 39.1 ms | 34.5 to 39.0 ms | M |
| Diamond | 32.0 to 42.7 ms | 30.4 to 37.2 ms | M |
| Radial (untouched, for scale) | 29.6 to 37.6 ms | 28.4 to 34.1 ms | M |
| Triangle | - | 35.7 to 47.0 ms | M |
| Octagon | - | 31.5 to 39.2 ms | M |

The run-to-run spread of one unchanged style is up to 10.7 ms (C: Diamond before, 42.7 - 32.0), so Square and Diamond,
which now go through the turned path, show no change that can be told from it. The triangle is the slowest new style
(its worst run 47.0 ms against 42.7 ms for the worst old one, C: 47.0 - 42.7 = 4.3 ms). All are over the 7 ms live
budget (`CoverageOps.LIVE_BUDGET_MS`) at this size, as every style already was (Gradient preview with a Dither method
at Layer 2 640, above); nothing was changed on the strength of it.
