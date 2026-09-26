# Interaction Speed Pass - Plan and Outcome

**Goal:** find what still costs time while an artist works - per pointer move,
per slider tick, per zoom step, per autosave - and fix what can be fixed with
low risk and no visible change, measuring every change before and after.

**Status: DONE 2026-09-26, released in 0.1.0-alpha.8.** Nine fixes shipped,
each measured and each checked for identical output; four candidates were
measured and deliberately left; the bigger rewrites found along the way are
listed in `docs/TODO.md` under "Performance - the deeper tier".

**Where the numbers are:** `docs/FIGURES.md` section 8, "Interaction speed pass
- measured 2026-09-26" (tag M throughout). **Instrument:** `tools/speed-bench.js`.
**Verification rows:** `tests/TESTLOG.md`, "Speed pass (2026-09-26)".

---

## 1. What was already true

Section 8 of FIGURES already recorded a compose pass (2026-08-29): the
`composeToCanvas` fast path, the memoised selection overlay, "what the page
shows" asked once per cell per stroke. It also recorded what was measured and
rejected - numeric keys for the dirty-cell Sets (23 us a stamp), lazy locale
loading (3.3 ms, reverted for making `setLocale` async), top-down indexed
stacking (slower). None of that was reopened.

## 2. How it was found

Three read-only sweeps - rendering and overlays, input and drawing, boot and
persistence - produced about twenty candidates. Each was checked against the
code before it went into the plan, and the ones kept were those that were
both clearly costly and fixable without changing what the artist sees.

## 3. What shipped

| # | Change | Where | Before -> after (software canvas, M) |
|---|---|---|---|
| 1 | One `putImageData` for the box around the frame's dirty cells, not one per cell | `js/core/canvas-system.js` `_render` | 1.26 -> 0.09 ms a frame for 165 dirty 8x1 cells (accelerated canvas) |
| 2 | Ask for an animation frame only when a render is pending | `js/core/canvas-system.js` `requestRender` | 60 -> 0 frames a second while idle |
| 3 | Preview-only tools take the last coalesced sample (`ToolBase.coalescesPointerMoves`) | `js/core/input-handler.js`, shape / gradient / bezier / eyedropper / selection tools | shape drag 87 -> 8 ms a move |
| 4 | Memoised disc offsets, byte-grid dedupe in the eraser and in `boundaryPoints` | `js/utils/brush-shapes.js`, `js/tools/eraser-tool.js`, `js/utils/mask-ops.js` | size-128 eraser drag 806 -> 255 ms |
| 5 | Marquee preview drawn as one masked fill | `js/ui/grid-overlay.js` `drawSelectionPreview` | full-canvas preview 15.7 -> 0.29 ms; marquee drag 62 -> 0.3 ms a move |
| 6 | Rotate-image slider batched, source mask cached per snapshot | `js/services/transform-service.js` | 65 -> 27 ms a tick |
| 7 | Only visible grids own a canvas; no cache copies | `js/ui/grid-overlay.js` | 1208 -> 0 MB at 1600% DPR 2 with grids off; zoom step 760 -> 0.3 ms |
| 8 | Reference thumbnail cached per image; autosave ticks never overlap | `js/utils/image-source.js`, `js/app.js` | autosave capture with a 3000x2000 photo 150 -> 16 ms a tick |
| 9 | Backup folder listed once per write, names only | `js/services/backup-service.js`, `js/services/browser-fsa-provider.js` | 2 listings + 101 file reads -> 1 listing + 0 reads (50-file folder) |

## 4. How "no visible change" was checked

Not by eye. For each output-affecting change the before and after trees were
run side by side and the result compared byte for byte: the marquee preview
canvas (four modes, full / partial / off-canvas / empty rectangles), every
visible grid canvas (DPR 1 and 2, three modes, three zooms, after a theme
change) and the rotated layer data plus the undo stack (four modes, with and
without a selection). All identical. The eraser's output was already pinned by
`tests/tool-footprint.test.js`. Those checks are now permanent specs - see the
TESTLOG section - and each was run against the pre-pass tree to show it fails
there where it pins a fix.

## 5. Measured and deliberately left

Recorded in FIGURES section 8's "What was measured and NOT acted on":

- the reference slider's per-tick save (0.029 ms);
- `TransformPanel._sync` on every frame (1.4 us);
- the boot-time preset reads (~8 ms, keyed on purpose for the localStorage
  fallback);
- the hidden Patterns panel's boot thumbnails (3.7 ms, asynchronous);
- skipping autosave ticks when nothing changed - not built, because the
  unsaved flag does not cover everything the autosave captures, so a skip
  could silently leave a change out of the crash-recovery record.

## 6. Found in passing

The manual said the browser-storage autosave "is always made and needs no
setting up". It has been off by default since the interval became a
preference (`StateManagerClass.AUTOSAVE_DEFAULT_MINUTES = 0`). Corrected in
`manual/content/80-files.md` and the generated `js/data/manual-content.js`.
