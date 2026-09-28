# Frames and onion skin (animation) - design

**Status:** proposed 2026-09-28 for the owner's review. Nothing is built. The line-by-line check of this document against the code had not finished when it was saved; check the named files and functions before building from it.
Plan: `docs/superpowers/plans/2026-09-28-onion-skin-animation.md`.

## 1. Recommendation

**The question.** Should animation frames use the stamp-capture style or the layer system, and which is the most efficient?

**The answer: neither as it stands. Take the storage idea from stamps and keep everything else in the layer system.**

- **Frames are stored the way a stamp is captured.** Each frame is cropped to the part that is drawn, packed small, and kept in a strip you click to bring back.
- **Unlike a stamp, the capture keeps everything:** colours, paper, bright, flash, GigaScreen screen B and Next palette indices. It uses the same compact form that undo and file saving already use.
- **Layers keep their meaning.** A film button on a layer's row makes that layer *animated*, so it has its own drawing in every frame. Every other layer (the background, scenery) is drawn once and appears in every frame.
- **The Stamps list stays a tool, not the store.** Copy a pose in one frame, step to the next frame, and stamp it one step along.
- **The onion skin is a see-through picture over the canvas.** It shows earlier frames in red and later frames in blue, with an Opacity slider. It is never part of the drawing or of any export.

**Why not use the stamp system as it is** (checked in the code):
- **Copy loses colour.** Copy/Cut keeps a one-colour mask of one layer. Colours, paper and screen B are lost (`SelectionService.copyToClipboard`, `startFloatingPaste`).
- **Stamps can vanish without undo.** Escape or a screen-mode switch deletes the engaged stamp with no Undo (`cancelFloatingPaste`, `selection-service.js:1245`).
- **Stamps can't act as ghosts.** Only the engaged stamp is ever drawn, at full strength.
- **They slow strokes and hide their memory from the undo limit.** Stamps take layer slots (32 in all). Every undo step copies every stamp's mask without the undo memory limit seeing it. With 24 full-screen stamps, each action took 32.9 ms and each undo step held 6,855,525 characters, counted as 0 bytes (M, Chromium, 2026-09-28).

**Why not one layer per frame:**
- **Frames and your own layers compete for slots.** They share 31 slots, and a frame cannot have layers of its own.
- **Every stroke slows down as frames are added.** Undo packs and compares every layer on every stroke: 36.7 ms per stroke at LAYER2_640 with 25 layers, against 2.6 ms with 1 layer (M, Chromium).
- **Memory grows fast.** Every frame stays unpacked, at 7.7x to 73x the packed size. 24 frames at MULTIGIGA_8x1 need 83 MB (C from M).
- **Frames would get mixed together.** Merge Down, Flatten and every export would combine frames that were left visible.

**Why not a whole-layer-stack snapshot per frame (the close runner-up):**
- **It stores whole layers.** It keeps full grids even when only a small sprite moves.
- **Changing frame is slow.** It rebuilds every layer on each frame change: 44 ms at LAYER2_640 with 3 layers (M, Node), and 5-10 MB of garbage per step (C).
- **Nothing is shared between frames.** Fixing the scenery means editing every frame.

| | A: one layer per frame | B: stamp-style cels, one layer | C: whole-stack snapshots | **Recommended: stamp-style cels on any layer** |
|---|---|---|---|---|
| 24 frames of a 24x24 sprite, LAYER2_640 | 39.4 MB (C) | 17.9 KB (C) | 5.3 MB (C) | **17.9 KB per animated layer (C)** |
| 24 full-screen frames, LAYER2_640 | 39.4 MB (C) | 5.1 MB (C) | 5.3 MB (C) | **5.1 MB per animated layer (C)** |
| Frame ceiling | about 30 at MULTICOLOR_8x1 and LAYER2_640 (C) | 256 [A] | 256 [A] | **256 [A] plus a 32 MB budget [A]** |
| Extra work per stroke | grows with total layers: 1.9-56.5 ms (M, Node) | +0.03-0.63 ms (M) | none | **+0.03-0.63 ms per animated layer (M)** |
| Undo memory per stroke | one grid | grid + displaced cel (up to 2x) | one grid | **displaced cel only (never more than today)** |
| Changing frame | one compose, 0.2-0.8 ms (M) | cel write 0.16-1.8 ms + changed cells (M) | up to 44 ms + 5-10 MB garbage (M/C) | **as B, per animated layer** |
| Layers inside a frame | yes, but rows drift apart | no: one layer animates | yes, none shared | **yes: animated and shared** |
| New code | ~2,050 lines [A] | ~2,300 [A] | ~2,100 [A] | **~2,600 [A]** |
| Review scores (efficiency / risk / artist, out of 10) | 3 / 4.5 / 8 | 8 / 7 / 5 | 7 / 5.5 / 7 | not scored: B plus the fixes below |

**Verdict.** Three independent reviews scored the routes. B won two of the three lenses (efficiency and implementation risk) and had the highest total: 20, against 19.5 for C and 15.5 for A. B's one serious fault was that only one layer could animate, which is why it scored lowest on artist experience.

The recommendation is B with that fault removed. Any number of layers can animate. Every layer exists in every frame, so layer rows never differ between frames. It also carries the best ideas of the other two routes:
- **From A:**
  - a test-only verify mode for the central rule (§3.3);
  - single-frame documents saving exactly as today;
  - the onion skin repainting after a mode switch;
  - Stop returning to the frame you were editing.
- **From C:**
  - a de-duplicated pool of drawings in the saved file;
  - copies that cost nothing until they are edited;
  - undo cleared on open and New;
  - frame changes refused mid-stroke;
  - stored frames converted one at a time on a mode switch;
  - a byte budget;
  - the "Ink only" option;
  - thumbnails;
  - undo that first goes to the frame where the change was made.

Every flaw the reviews found in B is fixed below: undo memory, a double redraw, duplicated file data, cel position in comparisons, whole-layer rewrite on undo, Enter for Play, GIF export's withdrawal, frame count versus bytes, the mode-switch refactor, and the legacy Next palette check.

## 2. Goals and non-goals

**Goals (phase 1):**
- Add a frame (a copy, or blank), delete, reorder, step, and hold a frame for 1-9 beats.
- Any number of animated layers. Every other layer is shared by all frames.
- Onion skin:
  - 0-3 frames before and 0-3 after;
  - Opacity 0-100 %;
  - red/blue tint;
  - "Ink only".
- Saved in `.pixula`, autosave and backups; undoable; correct in all 18 screen modes.

**Phase 2:** playback, frame thumbnails, animated GIF export (subject to the owner's decision in §8).

**Non-goals:**
- per-frame palettes or colour cycling (palettes, Timex inks and the border belong to the whole document);
- animated GIF import (the app has no GIF decoder);
- in-betweening;
- merging layers across all frames at once (phase 3).

## 3. Frame data model

### 3.1 The cel (NEW)

A **cel** is one animated layer's drawing in one frame. It is `LayerClass.packAttributeData`'s form (`layer-manager.js:401`), restricted to a rectangle of cells:

```
Cel = frozen {
  packed: true, col, row, cols, rows,     // the box, in cells
  cellH, tile,                             // as packAttributeData
  ink, paper, flags, pixels,               // Uint8Array over cols*rows cells
  indices, transparent,                    // indexed modes, else null
  inkB, paperB, flagsB, pixelsB            // two-screen modes, else null
}
null = the layer is empty in that frame
```

**The box and why the capture is exact.**
- The box is the bounding box of every cell that differs from an empty cell.
- An empty cell is what `clearCell` (`layer-manager.js:213`) leaves: ink 0, paper 7, not bright, not flashing, no pixels, not altered, indices -1, screen B mirrored.
- Outside the box every cell is empty by definition, so the capture is exact in every mode.

**Size.** cells x (3 + cellH), plus 72 per cell in indexed modes, doubled for two screens (C, from `packAttributeData`).
- A 24x24 sprite (9 cells): 99 B at STANDARD_ULA, 288 B at MULTICOLOR_8x1, 198 B at GIGASCREEN, 747 B at LAYER2_640 (M, Node 22, 2026-09-28).
- A full screen equals `packAttributeData`: 8,448 B at STANDARD_ULA and 212,480 B at LAYER2_640 (M).

**Immutable.** A cel is never written after it is made, so frames and undo entries share it by reference, and a copied frame costs 0 bytes. Typed arrays cannot be frozen, so this is a rule. A Node test and a comment on `packAttributeData` enforce it.

**NEW primitives in `js/core/layer-manager.js`:**
- **`Layer.prototype.packCel()`:** scans for the content box and packs it. Costs 0.03-0.63 ms (M, Node, two runs).
- **`Layer.prototype.writeCel(cel, prevCel, {fullClear})`:**
  - clears `prevCel`'s box, or the whole layer when `fullClear` is set;
  - writes `cel` at its origin;
  - returns the union box to recompose.
  It is new code: `unpackAttributeData` strides by the grid's own columns and always starts at (0,0) (`layer-manager.js:482`).
- **`LayerManagerClass.celsEqual(a, b)`:** compares origin and size, then the arrays. `packedGridsEqual` ignores the origin, so two cels at different places would compare equal.
- **`LayerManagerClass.celBytes(cel)`.**
- **`LayerManagerClass.packGridCel(grid, cellH)`:** `packCel` for a plain grid with explicit geometry. It is pure (no `ZX_SPECTRUM` reads), and mode conversion uses it.

### 3.2 The animation state (NEW `js/services/animation-service.js`, `window.AnimationService`)

There is one frozen state object. It is replaced on every change and never mutated, so undo entries can hold it by reference:

```
state = null        // no animation: every hook below does nothing
state = frozen {
  frames:   [ frozen { id, hold, cels: frozen { [layerId]: Cel|null } } ],
  activeId,         // the frame on screen
  animated: [layerId, ...],   // layers with a cel in every frame
  speedTicks: 5,    // one beat, in 20 ms ticks = 10 fps [A]
  loop: true
}
```

**Timing.**
- A frame lasts `speedTicks x hold x 20 ms`.
- 20 ms is `LayerManagerClass.GIGA_FRAME_MS`, one PAL frame (P, C).
- One tick is exactly 2 cs in a GIF (C).

**Layers outside the state.** Layers that are not animated (the background, shared layers, stamps) live only in `LayerManager.layers`, exactly as today. The background and stamps can never be animated.

**Caps (NEW `ANIMATION` constants).**
- `MAX_FRAMES` 256 [A]: chosen for panel usability.
- `MAX_CEL_BYTES` 32 MB of distinct stored cels [A]: sized for save time (§13).
- Frame operations that would pass either cap are refused with a message. Strokes are never refused.

### 3.3 The one rule everything rests on

> After every completed action and every frame change, each animated layer's live pixels equal `frames[active].cels[layerId]`.

**How the rule is kept:**
- `AnimationService.syncAfterAction()` runs in `UndoRedo.endAction` and `cancelAction`.
- `goTo` writes the target frame's cels.
- Undo and redo write the restored frame's cels (§9).

**What follows from it.** The live layer stack is always exactly one picture. The compositor, draw gate, eyedropper, "use existing" colours (`attrsShowing`), selection, stamps, FLASH, the GigaScreen views and every exporter therefore work on "the frame on screen" with no change.

**Checking it (NEW `AnimationService.verify`).** Both test harnesses switch it on.
- With it on, the rule is asserted after every `endAction`, `goTo` and restore, and a break throws.
- In normal use, `goTo` still checks before it writes. If a write reached an animated layer outside undo, the change is captured into the current frame and `Logger.warn` records it. It never bleeds into the next frame.

## 4. Editing model

**Starting an animation.**
- Press New Frame when there is no animation. The layer you are drawing on (`LayerManager.activeDrawLayerIndex`) becomes animated.
- Frame 1 is its current drawing, and Frame 2 is a copy. You move to Frame 2.
- The Frames panel says: "Animated: Hero. Other layers look the same in every frame."
- There is no separate "start" step.

**Choosing which layers animate.** Use the film button on each Layers row.
- **On:** every frame starts with a copy of the layer's current drawing (one shared cel, 0 extra bytes).
- **Off:** keeps this frame's drawing in every frame. A confirm appears when other frames differ; Undo brings them back.
- New layers start shared (open question 3).

**Drawing.** Every tool works as today, on any layer.
- On an animated layer, the change is in this frame only.
- On a shared layer, the change is in every frame.
- The draw gate, compositor and tools are unchanged.

**Changing frame: `AnimationService.goTo(id)`.** It runs from the strip, the `,` and `.` keys, the menus, or playback.
1. It is refused while `UndoRedo.isActionOpen()` or `InputHandler.isDrawing`.
2. It checks the rule (§3.3).
3. It calls `writeCel(target, previous)` for each animated layer.
4. It calls `LayerManager.deferCellCompose` for the changed cells only.
5. It emits the NEW `EVENTS.FRAME_CHANGED`.

What changing frame does and does not do:
- It is not an undo step and does not mark the file modified.
- The selection stays.
- A floating stamp stays floating: `SelectionService` redraws its preview on `FRAME_CHANGED`, using its existing `_drawFloatingLayer`. So "copy the pose, press `.`, stamp it" works.

**Frame operations.** Each is one undo action, and each calls `FileManager.markModified()`:
- New Frame (a copy of this frame, placed after it);
- New Blank Frame (animated layers empty);
- Delete Frame (not the last one);
- Move Frame Earlier / Later;
- Hold longer / shorter (x1-x9);
- Remove Animation (keeps the frame on screen; every layer becomes shared).

Speed and Loop come in phase 2.

**Layer operations** keep their meaning on the frame on screen:
- **Delete Layer** on an animated layer removes it from every frame (the whole row). With 2+ frames it asks first.
- **Merge Down / Merge Selected** involving an animated layer, with 2+ frames, asks first. Only the frame on screen is merged, and an animated layer that is merged away loses its other frames. Merging in every frame is phase 3.
- **Flatten Image** with an animation asks first. It flattens the frame on screen and removes the animation in the same action.
- **Duplicate Layer** of an animated layer gives a shared copy of this frame. A copy with all frames is phase 3.
- When the last animated layer disappears, the animation is removed in the same action.
- Every one of these is undoable.

**Imports** (SCR, PNG and the rest) are already undoable actions (`SCRFormat.parse` and others open `beginAction`), so they land in the frame on screen.

## 5. Onion skin

**Owner.** NEW `js/services/onion-skin-service.js` (`window.OnionSkinService`). It copies `ReferenceLayerService`'s loop: command, clamp, redraw, save, then announce the fact (`_render` 269, `setOpacity` 360, `_saveState` 688).

**Canvas.** `CanvasSystem.createOverlayCanvas({id:'onion-skin-canvas', zIndex:60})`, called inside `CanvasSystem.onReady`. Its doc comment already names onion skin.
- **Above `#main-canvas` (50).** The artwork is opaque (`alpha:false`), so anything below it is invisible.
- **Below `function-preview` (100).** Tool previews, selection (350), cursor (400), the reference image (450) and the pointer (500) stay on top.
- **Re-requested on `SCREEN_MODE_CHANGED`**, because `applyScreenMode` resizes and so clears every container canvas. The reference layer's failure to do this is an existing bug, measured on 2026-09-28.
- **Only context calls** (`clearRect`, `drawImage`, `putImageData`, `globalAlpha`), so no lint allowlist entry is needed.

**What a ghost shows.** The neighbouring frame's *visible animated layers* only. Shared layers are the same in every frame and already on screen, so the ghost shows exactly what moves.

**How a ghost is rendered: NEW `LayerManager.renderCelsToRGBA(entries, outU32, {inkOnly, tint})`.**
- It writes each cel into a pooled scratch layer.
- Over the union box only, it composes with the same private primitives the live canvas uses: `_composeCellData`, `_composeIndexedCellData(..., transparentWhenNoBg=true)`, `_resolveCellColors`, `_blendRGB` and `_paletteWords`.
- It writes into its own `Uint32Array`, never `CanvasSystem.pixels`.

Rendering rules by mode:
- **FLASH:** phase 0 always, so the ghost is steady.
- **Two-screen modes:** slot = bitA x 2 + bitB. Slot 0 is transparent; slots 1-3 use the Average blend. A ghost never flickers.
- **Indexed modes:** -1 is transparent.
- **Timex hi-res:** uses its scheme, through `ColorManager.attrToIndices`.
- **"Ink only"** (default on):
  - paper pixels are not drawn, so an old paper colour cannot veil the picture;
  - when off, the paper of altered cells is drawn too (useful for attribute-colour animation);
  - it does not apply in indexed modes.
- **Tint** (default on): ink before is (224,64,64), ink after is (64,128,224) [A]. When off, a ghost uses its own colours.

**Which frames are ghosted.**
- Frames before: 0-3, default 1. Frames after: 0-3, default 0 [A].
- With Loop on, frame 1's "before" is the last frame.
- The farthest frame is drawn first, at alpha = opacity/100 x 0.5^(k-1) [A].

**Adjustable opacity.**
- The slider runs 0-100 %, default 40 % [A]. That is below the reference image's 50 % because a ghost tints the pixels it overlaps.
- It is built like `ReferenceLayerPanel._sliderRow`, with `OptionControls.decorateSliders` steppers.
- The data flow:
  1. The NEW command `EVENTS.ONION_SKIN` goes to `OnionSkinService.set`.
  2. `Helpers.clamp` limits the value.
  3. The overlay is redrawn from the cache only.
  4. The settings are saved to Storage `'onionSkin'`.
  5. The NEW fact `EVENTS.ONION_SKIN_CHANGED` is announced.
- One tick is a `clearRect` plus 1-6 `drawImage` calls: 0.002-0.008 ms for 1-3 ghosts (M, Chromium). There is no recompose.

**Cache.**
- One offscreen canvas per ghost, from `Helpers.createCanvas`.
- The key is the frame entry's identity, the side (before or after), the settings, the visible animated ids, the identity of `ColorManager.paletteRGB`, and the mode id.
- A frame entry is replaced whenever its cels change, so its identity is a complete invalidation test.
- The cache is an LRU of before + after + 2 entries. Each canvas is W x H x 4 bytes: 196,608 B at 256x192 and 655,360 B at 640x256 (C).

**When the overlay redraws.**
- It redraws on:
  - `FRAME_CHANGED`, `FRAME_LIST_CHANGED` and `ONION_SKIN_CHANGED`;
  - `LAYER_VISIBILITY`;
  - `SCREEN_MODE_CHANGED` and `PALETTE_CHANGED`;
  - `HISTORY_UNDO` and `HISTORY_REDO`.
- It is cleared during playback.
- It never redraws per stroke, because the current frame is never ghosted.

**Guarantees.**
- The ghost is never in `CanvasSystem.pixels`. It cannot reach PNG, BMP or JPG (`LayerManager.stillImageData`) or any `flattenVisible` export.
- `attrsShowing` and the draw gate never read it. It cannot change attribute clash or the "use existing" colours.

**Settings are per artist.** They are view settings, not document data. They live in Storage `'onionSkin'` `{enabled, opacity, before, after, tint, inkOnly}`, never in the file or in undo. The key is added to `PreferencesDialog.resetAll`.

**Limitation.** The ghost lies over opaque artwork, so it tints current pixels where the two overlap.

## 6. Playback (phase 2)

**Commands.** `AnimationService.play() / stop() / togglePlay()`, with the NEW fact `EVENTS.FRAME_PLAYBACK_CHANGED {playing}`.

**Clock.**
- A `setTimeout` chain scheduled from `performance.now()`, so it does not drift.
- Each tick is `goTo(next, {playback:true})`: one `deferCellCompose` batch and one `requestRender`.
- Measured in this container: a `setTimeout` clock at 10 fps requested 11 frames a second, and a `requestAnimationFrame` clock requested 73. Both dropped to 0 after stopping (M, Chromium).
- Its lifecycle copies `_syncGigaFlicker`: it runs only while wanted and ends itself.

**FLASH and flicker keep working.** Playback is the live compositor showing another frame, so FLASH (320 ms) and the GigaScreen Flicker view keep running across frames, as on hardware.

**Before play** a floating stamp is parked (`SelectionService.endFloatingPaste`) and the onion skin is cleared. Nothing is marked modified or put in undo.

**Stop** returns to the frame where play began (open question 7).

**What stops playback:**
- the Play/Stop button or Shift+P;
- Escape, handled first and returning before anything else Escape does;
- a pointer-down on the canvas, which is swallowed;
- any menu action except Play;
- `UndoRedo.beginAction` at depth 0, before its snapshot;
- undo, redo and `revertLast`;
- File > New and project load.

**Speed.**
- A document Speed setting of 1, 2, 3, 4, 5, 10 or 25 ticks, which is 50, 25, 16.7, 12.5, 10, 5 and 2 fps (C).
- Plus the per-frame hold, and a Loop checkbox.

**Cost per tick.**
- `writeCel` per animated layer: 0.16-1.8 ms at full screen (M, Node).
- Plus a compose of the changed cells. A full compose is 0.215 ms (STANDARD_ULA) and 0.757 ms (LAYER2_640) with 1 layer, and 14.79 ms with 32 layers at LAYER2_640 (M, FIGURES section 8).
- In the Flicker view, `_syncGigaFlicker` also recomposes every 20 ms, and a full MULTIGIGA_8x1 compose was 7.7 ms in Node (M). 50 fps may drop frames there; the 10 fps default fits comfortably (C).
- Phase 2 measures ticks in Chrome. Phase 3 adds cached-bitmap playback if any mode needs more than 10 ms of a tick [A].

**Thumbnails (phase 2).**
- Made with `renderCelsToRGBA` (untinted, "Ink only" off), scaled to 64x48 [A]: 12,288 B each (C).
- Cached by frame-entry identity. The current frame's thumbnail refreshes at most every 250 ms [A].

## 7. Saving and backward compatibility

**Saving: `App._getProjectData`.**
- With an animation, it writes `version: 3` and a NEW `animation` field.
- Without one, it writes `version: 2` and no field, byte-identical to today. The fingerprints in `project-compact.spec.js` and `autosave-compact.spec.js` hold.

```
animation: {
  v: 1, active: <frame index>, speedTicks, loop,
  layers: [<index in the top-level `layers` array>, ...],   // animated layers
  cels:   [<Cel>, ...],                                      // pool, each cel object once
  frames: [{ hold, cels: [<pool index or -1>, ...] }]        // one per animated layer
}
```

- **The pool removes duplicates by object identity.** Copied frames are written once. gzip alone would miss a 212 KB repeat, since its window is 32 KB (C).
- **Typed arrays already travel.** They go through `Helpers.jsonTypedReplacer` in `.pixula`, and IndexedDB's structured clone keeps them. `ProjectFormat` is unchanged, and backups inherit the field.
- **Older builds still open the file.** The top-level `layers` holds the live stack, which is the frame on screen. Older builds have no version gate and ignore unknown fields (`app.js:608`), so they open the file as that one picture.
- **Re-saving in an older build drops the other frames.** Released builds cannot be fixed, so the manual says so.

**Loading: `App._loadProjectData`.**
1. `LayerManager.restoreFromData(data.layers)` runs as today. It now also records `lastRestoredIds` (NEW), which maps saved index to new layer id.
2. The NEW `AnimationService.restoreFromData(data.animation, LayerManager.lastRestoredIds)` rebuilds the animation.
3. Each cel is checked against the mode: cellH, tile, screen B present or absent, box inside the grid, and array lengths. A bad cel becomes empty, with one warning built by `Helpers.localizedMessage`. It is never silently cropped (`unpackAttributeData` crops with `Math.min`).
4. The cels of the frame on screen are re-captured from the restored layers, because the top-level `layers` is the truth for that frame.
5. The legacy Next palette upgrade (`app.js:636`) also scans stored cels, through the NEW `AnimationService.usesPaletteIndices`.
6. `UndoRedo.clear()` runs at the end (NEW behaviour, open question 2).
7. A file with no `animation` field opens with no animation.

**File > New** also calls `AnimationService.reset()` and `UndoRedo.clear()`. Other imports that replace the picture (SCR, PNG and the rest) behave as today.

**Autosave.** Frame operations call `FileManager.markModified()`, because `StateManager.markModified()` does not feed `FileManager.hasChanges()`. Navigation does not mark the file modified.

**Size.**
- 24 frames of a 24x24 sprite: 2,376 B at STANDARD_ULA and 17,928 B at LAYER2_640, before gzip (C).
- 100 full-screen frames: 844,800 B at STANDARD_ULA and 21,248,000 B at LAYER2_640 (C).

## 8. Export

**Version 1.** Every existing export produces the frame on screen, because they all read the live layers or `stillImageData`. The onion skin is never included.

**Phase 2: animated GIF. The owner decides first.** GIF export was withdrawn from the UI on 2026-08-25 (`menu-system.js:18`).

The proposal is one entry, Animation > Export Animated GIF.... It calls `FileManager.exportAs('gif', {animation: true})`, which goes to a NEW branch of `GIFFormat.export(options)`: `exportAnimation()`.
1. The NEW `AnimationService.forEachFrameFlattened(fn)` visits each frame in order. It writes the frame's cels quietly (no events, no compose), calls `LayerManager.flattenVisible()`, calls `fn`, and puts the frame on screen back in a `finally`.
2. `fn` produces indices through `GIFFormat.layerToIndices(flat, phase, plane)`, with delay = speedTicks x hold x 2 cs.
3. **FLASH** (fixed16 modes only, frames where `layerHasFlash` is true): the frame's time is split at 320 ms boundaries of elapsed time, with phase = floor(t / 320) & 1.
4. **Two-screen modes:** planes A and B alternate at `GIGA_DELAY_CS` (2 cs) for the frame's duration, as today's still export does.
5. **Palette:** `ZX_PALETTE_RGB` for fixed16, otherwise `ColorManager.paletteRGB`.
6. **Loop off:** the NEW `encode({loop: null})` leaves out the NETSCAPE block. A count of 1 would make most viewers play twice.

Tests and the existing decision are respected:
- File > Save Image As still lists no GIF leaf, so `export-format-gating.spec.js:64` and `menus.spec.js:173` stay true.
- The comment at `menu-system.js:18` is updated to record the decision.

**Cost for 24 frames:** a flatten of 0.47-4.85 ms each (M, Node) plus an encode of 37-84 ms (M, synthetic, Chromium), so about 50-200 ms (C).

**Phase 3:**
- SevenuP `.sev` multi-frame import and export (up to 32 frames, standard layout);
- a PNG sprite sheet;
- per-frame arrays in the developer export.

## 9. Undo

All changes are in `js/services/undo-redo.js`, behind a `window.AnimationService` guard as `SelectionService` already is. With no animation, every step below does nothing.

1. **Animated pixels never go into snapshots.**
   - `_captureSnapshot` adds the animated layer ids to the skip set it already passes to `captureAllLayersState` (`undo-redo.js:324-332`).
   - It stores `snap.animation = AnimationService.captureState()`: the frozen state, by reference, at O(1) cost.
2. **After each action.** In `endAction`, after `dropUnchangedLayers`, and also in `cancelAction`: `AnimationService.syncAfterAction()` runs. It:
   - packs each animated layer's cel, and replaces the frame's cel when `celsEqual` fails;
   - drops ids of layers that no longer exist;
   - removes the animation when none remain.
   The entry then records `navFrameId` (the frame on screen after the action) and `celBytes = AnimationService.displacedBytes(before.animation)`.
3. **Go to the frame first.** `undo`, `redo` and `revertLast` stop playback, then call the NEW `AnimationService.ensureActive(entry.navFrameId)`.
   - This is a plain frame change, so every animated layer holds exactly what it held when the entry was made.
   - That makes the existing rule "a null grid means reuse the live layer" (`layer-manager.js:1148`) safe for animated layers.
   - The frame always exists: frames change only through undoable actions, and navigation never deletes one.
   - Only then is the counterpart captured. The counterpart gets `navFrameId` after the restore.
4. **Restore with one compose.**
   - `_restoreSnapshot` calls `AnimationService.restoreState(snap.animation)` before the layers.
   - It then calls `LayerManager.restoreAllLayersState(snap.layers, {beforeCompose})`, with a NEW optional hook that runs `AnimationService.writeActiveCels({fullClear: true})` before that method's single full compose.
   - Whole layers are cleared, because a reused layer can hold any frame. There is no second compose.
   - It emits `FRAME_LIST_CHANGED` and `FRAME_CHANGED`. `revertAction` goes through the same path.
5. **Playback stops before a snapshot.** `beginAction` at depth 0 stops playback before taking its snapshot.

**Behaviour.**
- Undo jumps to the frame where the change was made.
- Frame navigation and playback are not undo steps.
- Undo is cleared on project load, autosave restore and File > New.

**Memory.**
- A stroke entry on an animated layer holds only the displaced cel: 747 B for a sprite at LAYER2_640, where today it is 212,480 B (C).
- A full-screen cel is the same as today.
- `entryBytes` adds `entry.celBytes`.
- Each cel is counted once, by the entry that displaced it. That entry is the newest one holding the cel, and history is pruned oldest-first, so the bytes are freed when that entry goes.
- The count is stored at push time, so later changes cannot skew it.
- A state's frame list is about 8 B per frame (C). That is 1 MB for 256 frames across 500 entries, and it is not counted, like the scalars today.
- A mode-switch entry holds every old cel by reference, and it is counted.

**Scenarios with Node tests** (§16):
- draw on frame 3, go to frame 7, undo, redo;
- delete frame, undo, redo;
- New Frame as the first action, undone;
- turn Animate off, then undo;
- delete an animated layer, undo;
- flatten, undo;
- mode switch, undo;
- `revertAction` mid-stroke;
- 200 delete/undo/redo cycles keep `_pruneStack`'s total bounded.

## 10. Screen modes, GigaScreen, FLASH, indexed

**Mode switch.**
- **Refactor.** `switchMode` has three per-layer passes: conversion (`screen-mode-service.js:663-677`), the Timex scheme stamp (684-707), and GigaScreen mirror/drop (721-732). They move into the NEW `ScreenModeService._convertGridForTarget(layer, from, target)`. It runs before the mode swap with the target cell height passed explicitly, through a NEW optional `cellH` argument on `LayerManagerClass.mirrorPlaneB`. Live layers use it unchanged; the existing mode tests guard the refactor.
- **Stored cels.** The NEW `AnimationService.convertCels(from, target)` runs inside the same "Screen mode" action, while the source palette is live. Each distinct cel is converted once (a Map keeps shared cels shared):
  1. expand it into a scratch layer at the source geometry;
  2. run `_convertGridForTarget`;
  3. pack it with `packGridCel`.
  Peak extra memory is one scratch layer: 942,080 B at LAYER2_640 (C, FIGURES).
- **After the swap.** `applyConvertedCels` builds the new state. `syncAfterAction` at `endAction` re-captures the frame on screen from the converted live layers.
- **Undo** restores the old mode and every frame in one step.
- **Cost:** 0.27-9.4 ms per stored grid (M, Node), so about 1 s or less for 100 full-screen cels (C).

**Lossy warning.** `_gigaScreensDiffer` also calls the NEW `AnimationService.celPlanesDiffer(schemes)`, which compares the packed planes.

**Palette seeding.** In version 1, `_seedTargetPalette` and `_compositeRGBA` fit the frame on screen only; phase 3 uses all frames. As on every route, the coarsening vote is per cell per frame, so colours can "pop" between frames after a lossy switch.

**GigaScreen and the other two-screen modes.**
- Cels carry both screens.
- The editing views (Average, Flicker, A, B) are unchanged.
- Ghosts always use Average.

**Indexed modes (Layer 2, LoRes, Radastan).** Cels keep the -1 transparency as a bitmask.

**FLASH.**
- The live 320 ms clock keeps its phase across frames.
- Ghosts use phase 0.
- The GIF export folds the phase in by elapsed time.
- Flashing follows `ColorManager.attrToIndices`: it flashes only in fixed16 modes.

**Attribute clash.** Animated layers of other frames are not in the layer stack, so they cannot affect clash, "use existing" colours, the eyedropper or exports.

## 11. What the artist sees

**Frames panel** (NEW `js/ui/components/frames-panel.js`). It is `PanelSection.create({id:'frames-panel', titleI18n:'panels.frames', hintI18n:'panels.frames.hint'})`, placed directly under Layers. It can be collapsed, hidden and moved like any other panel.
- **Status line:**
  - with no animation: "Draw on a layer, then press New Frame to start animating it.";
  - with one: "Animated: Hero. Other layers look the same in every frame."
- **Frame strip:**
  - wrapping numbered tiles with a hold badge (x2), the current tile outlined;
  - it works as a keyboard list (`role=listbox`, arrow keys), modelled on the Stamps list (`layer-panel.js:373`);
  - click a tile to go to that frame;
  - right-click or long-press opens a menu (`CanvasContextMenu`): New Frame, New Blank Frame, Delete, Move Earlier, Move Later, Hold longer, Hold shorter;
  - thumbnails replace the numbers in phase 2.
- **Buttons:** Copy (New Frame), Blank, Delete, built with `Helpers.captionedButton` and class `layer-ctrl-btn` so the tooltip spec covers them.
- **Transport row** (`PanelSection.addExtra`):
  - Back and Next, which repeat while held (`Helpers.attachRepeatPress`);
  - "Frame 3 of 12";
  - phase 2 adds Play/Stop, Speed and Loop.
- **Onion skin group:**
  - Show onion skin;
  - Opacity (0-100 %, with -/+ steppers);
  - Frames before (0-3) and Frames after (0-3);
  - Tint (red before, blue after);
  - Ink only.

**Layers panel.** Each drawing-layer row gains a film button: lit when the layer is animated, with an `aria-pressed` state. The panel re-renders on `FRAME_LIST_CHANGED`. The stale `panels.layers.hint` claim of "opacity and blend mode" is corrected in all 13 languages.

**Animation menu** (NEW, top-level, between Layer and Image):
- New Frame, New Blank Frame, Delete Frame, Move Frame Earlier, Move Frame Later;
- Previous Frame (`,`), Next Frame (`.`);
- Onion Skin (`O`, checkbox);
- Remove Animation;
- phase 2 adds Play/Stop (Shift+P) and Export Animated GIF....

Items are enabled and disabled from `FRAME_LIST_CHANGED`. View gains a "Frames" panel toggle through `_PANEL_MENU_ITEM_BY_SECTION`.

**Keys.** They are handled in `InputHandler._handleKeyboardShortcut`, after the Alt chords and before the tool letters, and ignored while drawing:
- `,` and `.` match `e.code` Comma/Period, so they are the same physical keys on every layout;
- `O` toggles the onion skin;
- Shift+P plays and stops (phase 2). Enter is not used, because it already commits a floating stamp and presses focused buttons.

All four are free today. Their menu `shortcut` fields feed `menu-shortcuts.spec`'s clash check and the generated manual. The F1 dialog (`_showShortcuts`) gains the same rows. `_handleEscape` stops playback first and returns.

**Touch.**
- Every action has a panel button.
- The canvas long-press menu (`_showCanvasContextMenu`) gains Previous/Next Frame while an animation exists.
- A tap on the canvas stops playback.

**Icons.** NEW SVG symbols in `index.html`: `icon-film`, `icon-frame-prev`, `icon-frame-next`, `icon-frame-blank`, `icon-onion`; phase 2 adds `icon-play` and `icon-stop`. Pictographs are banned by lint.

**Z-order comment.** The comment in `index.html` (line 234) gains the onion canvas at 60, and its stale "reference below, z 10" line is removed.

## 12. Translations and manual

**Translations.**
- About 56 NEW keys in phase 1 and about 13 in phase 2, in `js/i18n/en.js` and all 12 other locales, with the same `{placeholders}`.
- No plural forms are needed ("Frame {n} of {count}").
- Modules build messages with `Helpers.localizedMessage`.

**Manual.**
- A NEW chapter, `manual/content/87-animation.md`, sits between the editors and input chapters, with the same file in all 12 language folders.
- The screenshot `img/frames-panel.png` comes from a NEW `tools/manual-shots.js` entry.
- The generated menus, shortcuts and controls tables refresh through `node tools/build-manual.js`.
- The chapter says that older versions open only the frame on screen, and that opening a file clears Undo.

## 13. Figures

| Figure | Value | Tag | Source |
|---|---|---|---|
| Packed layer | 8,448 B STANDARD_ULA; 212,480 B LAYER2_640 | M | `packAttributeData`, FIGURES.md; re-measured 2026-09-28 |
| Cel, 24x24 sprite (9 cells) | 99 / 288 / 198 / 747 B (ULA / 8x1 / GIGA / L2-640) | M | Node 22, cel bench, 2026-09-28 |
| `packCel` (scan + pack) | 0.03-0.63 ms | M | same, two runs |
| Whole-layer clear + cel write | 0.16-1.80 ms | M | same |
| Ghost render, 1-3 full layers | 0.4-4.9 ms | M | Node harness (Route C), 2026-09-28 |
| Opacity tick, 1-3 cached ghosts | 0.002-0.008 ms | M | Chromium, this container, 2026-09-28 |
| Overlay canvas | 196,608 B at 256x192; 655,360 B at 640x256 | C | W x H x 4 |
| Full compose | 0.215 / 0.757 / 14.79 ms | M | FIGURES section 8, 2026-08-29 |
| Frames-as-layers stroke | 36.7 ms (25 layers, L2-640) vs 2.6 ms (1 layer) | M | Chromium, 2026-09-28 |
| Live layer heap | 1,641,271 B L2-640; 3,469,408 B MULTIGIGA_8x1 | M | Node heap, 2026-09-28 |
| Whole-stack frame change | 9.4 ms store + 34.8 ms rebuild (L2-640, 3 layers) | M | Node, 2026-09-28 |
| Stored-grid mode conversion | 0.27-9.4 ms per grid | M | Node harness, 2026-09-28 |
| Save time | 0.6 s per 6,799,360 B packed, so ~88 ms/MB | M, C | `project-format.js:224` comment |
| GIF encode, 24 frames | 37-84 ms, 21-35 KB | M | Chromium, synthetic, 2026-09-28 |
| Playback clock | setTimeout 11 frames/s at 10 fps; rAF 73/s; 0 after stop | M | Chromium, 2026-09-28 |
| Frame tick | 20 ms; FLASH 320 ms | P, C | `GIGA_FRAME_MS`; `_startFlashClock` |
| `MAX_FRAMES` | 256 | A | panel usability |
| `MAX_CEL_BYTES` | 32 MB (about 157 full-screen L2-640 cels, 3,971 ULA; about 3 s to save) | A, C | save time above; autosave is off by default (`AUTOSAVE_DEFAULT_MINUTES = 0`) |
| Default speed / hold | 5 ticks (10 fps) / x1-x9 | A | |
| Onion defaults | 1 before, 0 after, 40 %, falloff 0.5, tint (224,64,64) / (64,128,224) | A | |
| Thumbnail | 64x48, refreshed at most every 250 ms | A | |
| Phase 3 playback-cache trigger | tick work > 10 ms | A | half the 20 ms minimum tick |

Phase 1 task 12 re-measures the M figures in Chrome with `tools/perf-bench.js` and adds a section 9 to `docs/FIGURES.md`.

## 14. Risks

- **The central rule (§3.3).**
  - *Risk:* a write that bypasses undo would bleed pixels between frames.
  - *Mitigation:* the `goTo` check, the whole-layer write on restore, the verify mode in both test harnesses, and the scenario tests.
- **Cels are shared by reference.**
  - *Risk:* code that writes into a packed array in place would corrupt frames and history at once.
  - *Mitigation:* a Node test and a comment on `packAttributeData`.
- **The mode-switch refactor** touches a path every document uses.
  - *Mitigation:* existing mode tests, plus new tests that show a cel converted through a scratch layer equals the same content converted live, for each mode family.
- **Undo is cleared on open and New.** This changes current behaviour; it has its own test and a manual note.
- **Older builds** drop the other frames if they re-save an animated file. This cannot be fixed in released builds.
- **Large animations save slowly.** Up to about 3 s per save at the 32 MB budget (C). The localStorage fallback swallows `QuotaExceededError` (existing).
- **Playback in two-screen Flicker at 50 fps** may drop frames; this is measured in phase 2.
- **Merge, Flatten and Delete** on animated layers act on the frame on screen or on the whole row, behind confirms. Artists must read them.
- **Test and lint gates the implementation must satisfy:**
  - shell and menu specs hard-code menus and panel order (`shell.spec.js:14`, `:485`; `menus.spec.js:68`);
  - `menu-shortcuts.spec` checks key clashes;
  - `tooltip.spec` needs real descriptions;
  - `render-loop-idle.spec` needs zero frame requests after Stop;
  - the manual goes stale when any titled panel control is added;
  - editing `constants.js` triggers a no-op `release.yml` run on merge.

## 15. Out of scope

- per-frame palettes;
- GIF import;
- in-betweening;
- ping-pong playback;
- merging or transforming across all frames (phase 3);
- the reference layer's existing failure to repaint after a mode switch (a separate fix);
- making autosave quota failures visible (recommended separately).

## 16. Testing

**Node** (`tests/*.test.js`, using `installStubs`, `loadModule`, `check` and `summary` from `tests/helpers/zx-stubs.js`):
- `cel-primitives`, `animation-service`, `animation-undo`, `animation-persistence`, `animation-mode-switch`, `onion-render`;
- phase 2 adds `gif-animation`, which uses the existing `parseGif`.

**Playwright:**
- `tests/browser/animation.spec.js`;
- phase 2 adds `tests/browser/animation-playback.spec.js`;
- updates to `shell.spec.js` and `menus.spec.js`.

Every task keeps `node tests/run-all.js` green. Each phase ends with `npm run test:browser` and `npm run check:manual`.
