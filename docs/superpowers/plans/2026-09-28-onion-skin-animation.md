# Frames and Onion Skin Implementation Plan

> **Status: draft, 2026-09-28.** Written from a code study of three candidate routes. The line-by-line check of this document against the code had not finished when it was saved; check the named files and functions before building from it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add animation frames to PixULA with an onion skin whose opacity can be adjusted:
- any layer can be marked animated, and holds its own drawing in every frame;
- every other layer is shared by all frames;
- earlier and later frames show as tinted ghosts on a display-only overlay.

**Architecture:**
- **Frames.** A NEW `AnimationService` holds one frozen, copy-on-write state. Each frame maps every animated layer id to a *cel*: `packAttributeData`'s packed form, cropped to the drawn box and never mutated.
- **Frame changes.** Only the frame on screen is live in `LayerManager.layers`. Changing frame writes cels into the existing layer objects, so tools, compositor and exporters are unchanged.
- **Undo.** Undo carries the state by reference and never packs animated grids.
- **Onion skin.** A NEW `OnionSkinService` draws cached ghosts on `CanvasSystem.createOverlayCanvas` at z 60, using `ctx.globalAlpha`.

**Tech Stack:** vanilla JS IIFE singletons; no build step; Node harness (`tests/helpers/zx-stubs.js`); Playwright (`tests/browser/`, `boot` / `reload` from `helpers.js`).

**Spec:** `docs/superpowers/specs/2026-09-28-onion-skin-animation-design.md`

## Global Constraints

**Behaviour that must not change**
- **A document with no animation behaves and saves exactly as today.**
  - `AnimationService` state is `null`.
  - Every hook is a no-op.
  - `_getProjectData` stays `version: 2` with no `animation` key.
- **Ghost pixels never enter `CanvasSystem.pixels`.** The onion canvas is `createOverlayCanvas({id:'onion-skin-canvas', zIndex:60})`.
- **A cel is never written after it is made.**
- **The one rule (spec §3.3).** Each animated layer's live pixels equal the current frame's cel after every action and every frame change. `AnimationService.verify` asserts this and throws. Both test harnesses switch it on.

**Architecture and lint**
- **Commands go down and facts come up.**
  - Events are only `EVENTS.*` constants.
  - `js/core`, `js/services` and `js/tools` do no DOM or `.style` work. Use `CanvasSystem` and context calls.
  - `Helpers.clamp`, not an inline clamp.
  - No pictographs: icons are SVG symbols.
- **Every NEW global** gets a `BOOT_MANIFEST` entry in `js/app.js` and a `<script defer>` tag in `index.html` before `js/app.js`.

**Text and translations**
- **Every new user-visible string** gets a key in `js/i18n/en.js` and all 12 other locales (cs de es fr hu it pl pt ro ru sk tr), with the same `{placeholders}`.
- **Modules** build messages with `Helpers.localizedMessage(key, fallback, params)`.

**Tests and manual**
- **After every task that touches `.js`:** run `node tests/run-all.js`.
- **After any change to menus, shortcuts or panel controls:** run `node tools/build-manual.js`, then `npm run check:manual`.
- **At the end of every phase:** run `npm run test:browser`.

**Figures and releases**
- **Figures.** Every number in code comments and docs is tagged M/P/C/A and registered in `docs/FIGURES.md`.
- **Releases.**
  - Do not bump `APP_VERSION` unless the owner asks to release; then follow `.claude/skills/release/SKILL.md`.
  - Never push tags.
  - Editing `js/core/constants.js` triggers a harmless `release.yml` run on merge.

---

# Phase 1: frames and onion skin (shippable on its own)

## Task 1: Cel primitives in LayerManager

**Files:**
- Modify: `js/core/layer-manager.js`: `LayerClass` (exported as `window.Layer`), `restoreAllLayersState` (1124), `restoreFromData` (2756), static `LayerManagerClass.mirrorPlaneB`
- Test: Create `tests/cel-primitives.test.js`

**Interfaces (all NEW unless marked):**
```js
Layer.prototype.celBounds()            // -> {col,row,cols,rows} | null (null = empty layer)
Layer.prototype.packCel()              // -> Cel | null
Layer.prototype.writeCel(cel, prevCel, { fullClear = false } = {})  // -> union box | null
LayerManagerClass.packGridCel(grid, cellH)   // pure: no ZX_SPECTRUM reads
LayerManagerClass.celsEqual(a, b)            // origin + size + PACKED_KEYS arrays
LayerManagerClass.celBytes(cel)
LayerManagerClass.mirrorPlaneB(cell, cellH = ZX_SPECTRUM.CELL_HEIGHT)      // CHANGED: optional cellH
restoreAllLayersState(snapshot, { beforeCompose } = {})  // CHANGED: hook runs before the one composeToCanvas
restoreFromData(data)                        // CHANGED: sets this.lastRestoredIds[i] = new id of data[i]
```

- [ ] **Step 1: Write the failing tests** in `tests/cel-primitives.test.js`.
  - Round trip for each mode: draw a small shape and a full-screen shape, then `packCel`, then `writeCel` into a cleared layer. Check the result with `packAttributeData` against the original using `LayerManagerClass.packedGridsEqual`.
  - Modes: STANDARD_ULA, MULTICOLOR_8x1, TIMEX_HIRES, GIGASCREEN (with screen B different from A), LAYER2_256, LAYER2_640, LORES.
  - An empty layer gives `null`.
  - A 24x24 sprite at STANDARD_ULA packs to 99 B.
  - `celsEqual` is false for the same content at a different origin.
  - Editing the layer after `packCel` leaves the cel's arrays unchanged.
  - `writeCel` with `prevCel` clears only the old box. It returns the union box.
  - `packGridCel` with explicit geometry equals `packCel` on the same content.
  - `beforeCompose` runs before `composeToCanvas`.
  - `lastRestoredIds` maps saved index to id.
- [ ] **Step 2:** Run `node tests/cel-primitives.test.js`. Expected: FAIL (the methods are missing).
- [ ] **Step 3: Implement.**
  - An empty cell is the state `clearCell` (213) leaves: ink 0, paper 7, not bright, not flashing, zero pixels, not altered, indices -1, screen B mirrored. Compare cells against it field by field.
  - `writeCel` is new code. `unpackAttributeData` strides by `p.cols` from (0,0) and cannot do this.
  - `unpack` copies with `slice`, so live cells never alias a cel's arrays.
  - Add a comment on `packAttributeData`: "packed grids and cels are shared by reference; never write into one".
- [ ] **Step 4:** Run the test (expect PASS), then `node tests/run-all.js`.
- [ ] **Step 5:** Commit: `feat(layers): cel primitives for animation frames`.

## Task 2: AnimationService model, events, constants and boot wiring

**Files:**
- Create: `js/services/animation-service.js`
- Modify: `js/core/constants.js`, `js/app.js` (`BOOT_MANIFEST`; `_initManagers`, next to `ReferenceLayerService.initialize()` at 264), `index.html` (script tag after `js/services/reference-layer-service.js`, line 540)
- Test: Create `tests/animation-service.test.js`

**Interfaces:**
```js
// constants.js (NEW)
EVENTS.FRAME_CHANGED       = 'frame:changed'      // {id, index, count, playback}
EVENTS.FRAME_LIST_CHANGED  = 'frame:listChanged'  // {count, animatedIds}
EVENTS.ONION_SKIN          = 'onion:set'          // command {enabled?, opacity?, before?, after?, tint?, inkOnly?}
EVENTS.ONION_SKIN_CHANGED  = 'onion:changed'      // fact: full settings
const ANIMATION = Object.freeze({ MAX_FRAMES: 256 /*A*/, MAX_CEL_BYTES: 32 * 1024 * 1024 /*A*/,
  DEFAULT_SPEED_TICKS: 5 /*A*/, MAX_HOLD: 9 /*A*/, ONION_MAX_FRAMES: 3 /*A*/,
  ONION_DEFAULTS: Object.freeze({ enabled: true, opacity: 40, before: 1, after: 0, tint: true, inkOnly: true }) /*A*/,
  ONION_TINT_BEFORE: [224, 64, 64] /*A*/, ONION_TINT_AFTER: [64, 128, 224] /*A*/, ONION_FALLOFF: 0.5 /*A*/ });
window.ANIMATION = ANIMATION;

// AnimationService (NEW)
initialize(); reset(); isAnimated(); captureState(); frameCount(); activeIndex();
animatedLayerIds(); isLayerAnimated(id); layerDiffersAcrossFrames(id);
newFrame(); newBlankFrame(); deleteFrame(id?); moveFrame(id, delta); setHold(id, n);
setLayerAnimated(layerId, on); removeAnimation();
goTo(id, {playback} = {}); next(); prev(); ensureActive(id);
syncAfterAction(); displacedBytes(prevState); restoreState(state); writeActiveCels({fullClear});
animatedAmong(layerIds);   // -> names of animated layers among ids, when frameCount() >= 2 (for confirms)
verify = false;
```

- [ ] **Step 1: Write the failing tests** in `tests/animation-service.test.js`. Load `layer-manager.js`, `undo-redo.js` and `animation-service.js`, with `verify` on. Cover:
  - **Starting and frame operations:**
    - the first `newFrame` animates `LayerManager.activeDrawLayerIndex`'s layer and moves to frame 2;
    - frame 2 shares frame 1's cel object (0 bytes);
    - `newBlankFrame` gives `null` cels;
    - `deleteFrame` refuses the last frame and goes to a neighbour;
    - `moveFrame` and `setHold` clamp to 1..`ANIMATION.MAX_HOLD`.
  - **Frame changes:**
    - `goTo` writes the target cel and restores the previous frame exactly;
    - it is refused while `UndoRedo.isActionOpen()`;
    - `FRAME_CHANGED` is emitted.
  - **Keeping the rule after actions:**
    - `syncAfterAction` records a stroke into the current frame only;
    - it drops a deleted layer's id;
    - `removeAnimation` happens when none are left.
  - **Animate on and off:**
    - `setLayerAnimated(id, true)` shares the current cel in every frame;
    - `setLayerAnimated(id, false)` keeps the current frame.
  - **Caps and memory:**
    - `MAX_FRAMES` and `MAX_CEL_BYTES` refuse with `Helpers.localizedMessage('msg.frameLimit'|'msg.animationTooLarge', ...)`;
    - `displacedBytes` counts only cels the live state no longer references.
  - **Verify mode** throws when a layer is written behind the service's back.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.** State shape as in spec §3.2.
  - **Every change** builds a new frozen state and emits `FRAME_LIST_CHANGED` and/or `FRAME_CHANGED`.
  - **Frame operations** each call `UndoRedo.beginAction(label)` / `endAction()` and `FileManager.markModified()`. They refuse when an action is open.
  - **`goTo`, before writing:**
    - refuse while `UndoRedo.isActionOpen() || InputHandler.isDrawing`;
    - check the rule with `celsEqual(layer.packCel(), activeCel)`. On a mismatch, `verify` throws; otherwise `Logger.warn` and capture;
    - call `LayerManager.deferCellCompose` over the union boxes.
  - **`ensureActive`** skips the `isDrawing` guard (undo has already cancelled the open action).
- [ ] **Step 4: Boot wiring.**
  - Add `['AnimationService','js/services/animation-service.js']` to `BOOT_MANIFEST`.
  - Add the script tag.
  - Call `AnimationService.initialize()` in `_initManagers`. It registers the listener that resets the service on `EVENTS.FILE_NEW`.
- [ ] **Step 5:** Run `node tests/run-all.js` (lint covers the new file), then commit: `feat(animation): frame store service`.

## Task 3: Undo integration

**Files:**
- Modify: `js/services/undo-redo.js`: `beginAction` (63), `endAction` (75), `cancelAction` (122), `revertLast` (181), `undo` (200), `redo` (230), `_captureSnapshot` (295), `_restoreSnapshot` (355), `entryBytes`
- Test: Create `tests/animation-undo.test.js`

- [ ] **Step 1: Write the failing scenario tests**, each with `verify` on:
  - draw on frame 3, `goTo` frame 7, undo. Expect frame 3 on screen with the stroke gone, and frame 7 untouched. Redo returns to frame 3 with the stroke;
  - `deleteFrame`, then undo and redo;
  - the first `newFrame`, undone. Expect no animation and the layer exactly as before;
  - `newBlankFrame` as the first action, undone;
  - animate off, then undo;
  - delete an animated layer (`LayerManager.removeLayer`), then undo. Expect every frame back;
  - Flatten-style removal, then undo;
  - `revertAction` mid-stroke on an animated layer;
  - 200 rounds of `deleteFrame` / undo / redo. The `_pruneStack` total stays bounded, and each cel is counted once;
  - a document with no animation produces snapshots identical to today's apart from `animation: null`;
  - `undo-partial-capture.spec.js` still passes (browser, rerun in Task 11).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement the five rules** (spec §9):
  1. **`_captureSnapshot`.** Add `AnimationService.animatedLayerIds()` to the `skip` Set passed to `LayerManager.captureAllLayersState`, creating the Set when `partial` is false. Set `snap.animation = AnimationService.captureState()`.
  2. **`endAction`**, after `dropUnchangedLayers` and the background compare:
     - call `AnimationService.syncAfterAction()`;
     - set `entry.navFrameId` to the current active id;
     - set `entry.celBytes = AnimationService.displacedBytes(before.animation)`.
     `cancelAction` at depth 0 also calls `syncAfterAction()`.
  3. **`undo`, `redo` and `revertLast`:**
     1. call `AnimationService.stop()` (a no-op until Phase 2);
     2. pop the entry;
     3. call `AnimationService.ensureActive(entry.navFrameId)`;
     4. capture the counterpart;
     5. restore;
     6. set `counterpart.navFrameId` to the active id after the restore, and `counterpart.celBytes = AnimationService.displacedBytes(counterpart.before.animation)` in `redo`.
  4. **`_restoreSnapshot`.** Call `AnimationService.restoreState(snap.animation)` before the background. Then call `LayerManager.restoreAllLayersState(snap.layers, { beforeCompose: () => AnimationService.writeActiveCels({ fullClear: true }) })`.
  5. **`beginAction` at depth 0** calls `AnimationService.stop()` before `_captureSnapshot`.
  - **`entryBytes`** adds `entry.celBytes || 0`.
  - **Every call** is guarded with `window.AnimationService`, as `SelectionService` is.
- [ ] **Step 4:** Run the test (expect PASS), then `node tests/run-all.js`. `tests/layer-merge.test.js` and the other undo tests must stay green.
- [ ] **Step 5:** Commit: `feat(animation): undo owns frames by reference`.

## Task 4: Saving, loading, New, and clearing undo on load

**Files:**
- Modify: `js/app.js`: `_getProjectData` (570), `_loadProjectData` (608; legacy Next check at 636)
- Modify: `js/io/file-manager.js`: `newFile` (181)
- Modify: `js/services/animation-service.js`
- Test: Create `tests/animation-persistence.test.js`

**Interfaces:** NEW `AnimationService.serialize()`, `restoreFromData(data, idBySavedIndex)` and `usesPaletteIndices(lo, hi)`. The saved shape is in spec §7.

- [ ] **Step 1: Write the failing tests:**
  - **Round trip.** Serialize, run `ProjectFormat.encode` then `decode`, then restore. Every frame's cels are `celsEqual`.
  - **The pool.** A copied frame is written once: `cels.length` is the number of distinct objects.
  - **Documents with no animation.** `_getProjectData` output stays `version: 2` with no `animation` key.
  - **A damaged cel** (wrong `cellH`) loads as empty, with one warning.
  - **The frame on screen** is re-captured from the restored `layers`.
  - **Old files.** A file without `animation` loads with no animation.
  - **`usesPaletteIndices`** finds indices that exist only in a stored cel.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`_getProjectData`:** when `AnimationService.isAnimated()`, set `version: 3` and add `animation: AnimationService.serialize()`.
  - **`_loadProjectData`**, after `restoreFromData`:
    - call `AnimationService.restoreFromData(data.animation, LayerManager.lastRestoredIds)`;
    - change the legacy check to `LayerManager.usesPaletteIndices(...) || AnimationService.usesPaletteIndices(...)`;
    - at the end, call `UndoRedo.clear()`.
  - **`newFile`:** call `UndoRedo.clear()` before `EventBus.emit(EVENTS.FILE_NEW)`.
  - **Before relying on the clear**, grep `tests/` for any spec that expects undo after New or Open, and update it deliberately.
- [ ] **Step 4:** Run the test (expect PASS), then `node tests/run-all.js`. Commit: `feat(animation): save and load frames; clear undo on open and New`.

## Task 5: Converting stored frames on a screen-mode switch

**Files:**
- Modify: `js/services/screen-mode-service.js`: `switchMode` (633; passes at 663-677, 684-707 and 721-732), `_gigaScreensDiffer` (173)
- Modify: `js/services/animation-service.js`
- Test: Create `tests/animation-mode-switch.test.js`

**Interfaces:**
- NEW `ScreenModeService._convertGridForTarget(layer, from, target)` returns a grid at target geometry. It covers conversion, attaching plane B, the Timex scheme stamp, and GigaScreen mirror or drop with explicit `target.attrCellH`.
- NEW `AnimationService.convertCels(from, target)` returns a `Map` from old cel to new cel.
- NEW `applyConvertedCels(map)`.
- NEW `celPlanesDiffer(schemes)`.

- [ ] **Step 1: Write the failing tests.**
  - **Scratch path equals the live path.** For each family, a cel converted through a scratch layer equals the same drawing converted as a live layer after `packCel`. Families:
    - classic 8x8 to 8x1 and back;
    - classic to LAYER2_256 and back;
    - GIGASCREEN to STANDARD_ULA and back;
    - TIMEX_HIRES to STANDARD_ULA.
  - **Sharing survives.** Shared cels stay shared (one Map entry).
  - **Undo.** Undoing the switch restores the mode and every frame.
  - **The lossy check.** `isConversionLossy` reports a stored frame whose screen B differs.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Refactor `switchMode` so each live layer goes through `_convertGridForTarget` before `__setActiveScreenMode`.**
  - `ColorManager.setTimexHiresInkB` stays after the swap, where it is today.
  - Run the existing mode tests: `tests/mode-12b.test.js`, `tests/mode-13.test.js`, `tests/gigascreen-ops.test.js`. They must pass unchanged before the next step.
- [ ] **Step 4: Convert stored cels.**
  - After the live conversion, and before the swap, call `AnimationService.convertCels(from, target)`. Each distinct cel is converted once through one scratch `Layer`: expand with `writeCel(fullClear)`, run `_convertGridForTarget`, then `LayerManagerClass.packGridCel(grid, target.attrCellH)`.
  - After the swap, call `AnimationService.applyConvertedCels(map)`. `endAction`'s sync re-captures the frame on screen.
  - `_gigaScreensDiffer` returns true if `AnimationService.celPlanesDiffer(schemes)` does.
- [ ] **Step 5:** Run the test (expect PASS), then `node tests/run-all.js`. Commit: `feat(animation): convert stored frames on mode switch`.

## Task 6: Ghost renderer and OnionSkinService

**Files:**
- Modify: `js/core/layer-manager.js` (NEW `renderCelsToRGBA`)
- Create: `js/services/onion-skin-service.js`
- Modify: `js/app.js` (`BOOT_MANIFEST`, `_initManagers`), `index.html` (script tag after animation-service; z-index comment at 234: add onion 60, remove the stale "10: reference below" line), `js/ui/components/preferences-dialog.js` (`resetAll` 729: `Storage.delete('onionSkin')`)
- Test: Create `tests/onion-render.test.js`

**Interfaces:**
```js
LayerManager.renderCelsToRGBA(entries /* [{cel}] bottom->top */, outU32, { inkOnly, tint /* [r,g,b]|null */ })
  // -> union box | null; composes with _composeCellData / _composeIndexedCellData(..., true) /
  //    _resolveCellColors / _blendRGB / _paletteWords on pooled scratch layers; FLASH phase 0
OnionSkinService.initialize(); getSettings(); set(partial)   // set is also reached via EVENTS.ONION_SKIN
```

- [ ] **Step 1: Write the failing tests:**
  - **Classic:** ink pixels in the resolved ink colour or the tint, and paper transparent under "Ink only". With "Ink only" off, the paper of altered cells is drawn.
  - **Two-screen:** slot 0 transparent, slots 1-3 in the Average blend.
  - **Indexed:** -1 transparent.
  - **FLASH:** a flashing cell renders at phase 0 whatever `_flashInverted` is.
  - **`CanvasSystem.pixels`** is unchanged after a render.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement `renderCelsToRGBA`** as specified in spec §5.
- [ ] **Step 4: Implement `OnionSkinService`,** copying `ReferenceLayerService`'s structure.
  - **Canvas.** Created in `CanvasSystem.onReady` with `createOverlayCanvas({id:'onion-skin-canvas', zIndex:60})`. It is re-requested on `SCREEN_MODE_CHANGED`.
  - **Settings.** Loaded from Storage `'onionSkin'`. Defaults are `ANIMATION.ONION_DEFAULTS`.
  - **On `EVENTS.ONION_SKIN`:** clamp with `Helpers.clamp`, redraw, save, then emit `ONION_SKIN_CHANGED`.
  - **Drawing.**
    - Clear with `clearRect`.
    - For each ghost, farthest first, set `globalAlpha = opacity/100 * ONION_FALLOFF^(k-1)` and call `drawImage` of the cached offscreen canvas (`Helpers.createCanvas` plus `putImageData`).
    - With Loop on, wrap around the ends.
  - **Cache.** Keyed by frame-entry identity, side, settings, visible animated ids, `ColorManager.paletteRGB` identity and the mode id. An LRU of before + after + 2 entries.
  - **Redraw** on:
    - `FRAME_CHANGED`, `FRAME_LIST_CHANGED` and `ONION_SKIN_CHANGED`;
    - `LAYER_VISIBILITY`;
    - `SCREEN_MODE_CHANGED` and `PALETTE_CHANGED`;
    - `HISTORY_UNDO` and `HISTORY_REDO`.
  - **Context calls only:** no `.style` writes, no DOM queries.
- [ ] **Step 5:** Add the key to `BOOT_MANIFEST` and the init call. Run the test (expect PASS), then `node tests/run-all.js`. Commit: `feat(animation): onion skin overlay`.

## Task 7: Frames panel, Layers-row film button, confirms, stamp redraw

**Files:**
- Create: `js/ui/components/frames-panel.js`
- Modify:
  - `js/app.js`: `BOOT_MANIFEST`; `_initUI` (308), with `FramesPanel.init()` right after `LayerPanel.init()`;
  - `index.html`: script tag after `js/ui/components/layer-panel.js` (618); SVG symbols `icon-film`, `icon-frame-prev`, `icon-frame-next`, `icon-frame-blank`, `icon-onion` in `svg.svg-sprite` (397);
  - `css/components.css`: NEW `.frames-panel` section, tokens only, with every `vh` paired with `dvh`;
  - `js/ui/components/layer-panel.js`: row template around 176; `_attachLayerListEvents` (219); listeners at 78-82 gain `FRAME_LIST_CHANGED`; `_attachButtons` (324) delete and merge confirms;
  - `js/ui/menu-system.js`: cases `layer:delete` / `layer:merge` / `layer:flatten` (907-913); `_flattenImage` (981) calls `AnimationService.removeAnimation()` inside its action when animated;
  - `js/core/input-handler.js`: Ctrl+E merge confirm (~1917);
  - `js/services/selection-service.js`: constructor listener for `EVENTS.FRAME_CHANGED` that calls `this._drawFloatingLayer()` when `this.floatingPaste` is set;
  - `js/ui/tooltip-manager.js`: `SELECTOR` (36), only if a new control class is not already covered.

- [ ] **Step 1: Build `FramesPanel.init()`** with `PanelSection.create({id:'frames-panel', titleI18n:'panels.frames', title:'Frames', hintI18n:'panels.frames.hint'})`.
  - **Status line.**
  - **Frame strip:** `role=listbox`, arrow keys, click to `goTo`, right-click or long-press opening `CanvasContextMenu.show` with the frame actions.
  - **Buttons:** Copy, Blank and Delete, made with `Helpers.captionedButton` and class `layer-ctrl-btn`.
  - **Transport row** via `PanelSection.addExtra`: Back and Next with `Helpers.attachRepeatPress`, plus the "Frame {n} of {count}" label.
  - **Onion group:** checkbox; Opacity slider (0-100) built like `ReferenceLayerPanel._sliderRow` and then `OptionControls.decorateSliders(content)`; Frames before and after selects (0-3); Tint and Ink only checkboxes. Each emits `EVENTS.ONION_SKIN`.
  - **Rendering:** only from `FRAME_CHANGED`, `FRAME_LIST_CHANGED` and `ONION_SKIN_CHANGED`, using `data-i18n*` attributes plus `I18n.apply(root)`.
- [ ] **Step 2: Add the Layers-row film button.**
  - It is a `layer-btn layer-animate` button with `aria-pressed` and `title` / `data-i18n-title` of `layer.animate.on` or `layer.animate.off`.
  - A click calls `AnimationService.setLayerAnimated(layer.id, !on)`.
  - Turning it off asks `msg.confirmUnanimateLayer` first, when `layerDiffersAcrossFrames`.
- [ ] **Step 3: Add the confirms**, each skipped when `AnimationService.animatedAmong(ids)` is empty:
  - `msg.confirmDeleteAnimatedLayer`: Delete button, `layer:delete`;
  - `msg.confirmMergeAnimated`: merge button, `layer:merge`, Ctrl+E;
  - `msg.confirmFlattenAnimation`: `_flattenImage`, shown in place of `msg.confirmFlatten` when animated.
- [ ] **Step 4:** Add `FramesPanel` to `BOOT_MANIFEST`. Run `node tests/run-all.js` (lint: pictographs, `vh`/`dvh`, inline colours). Commit: `feat(animation): Frames panel and layer film button`.

## Task 8: Animation menu, View toggle, keys, F1, long-press, Escape

**Files:**
- Modify `js/ui/menu-system.js`:
  - `menuDefinitions` (200): a NEW `{id:'animation'}` between `layer` and `image`, with items `animation:newFrame`, `newBlankFrame`, `deleteFrame`, `moveFrameEarlier`, `moveFrameLater`, `prevFrame` (shortcut `,`), `nextFrame` (shortcut `.`), `onionSkin` (shortcut `O`, `toggle:true`) and `removeAnimation`;
  - View gets `{id:'panel-frames', action:'view:toggleFrames', toggle:true, i18n:'panels.frames'}`;
  - `_PANEL_MENU_ITEM_BY_SECTION` (81) maps `'frames-panel': 'panel-frames'`;
  - `_executeAction` (801) routes `animation:*` to `AnimationService` or `OnionSkinService`, and `view:toggleFrames` to `PanelSection.toggleVisibility('frames-panel')`;
  - `setItemEnabled` / `_updateToggleState` are driven from `FRAME_LIST_CHANGED` and `ONION_SKIN_CHANGED`;
  - `_showShortcuts` (1078) gains the `,` `.` `O` rows.
- Modify `js/core/input-handler.js`:
  - `_handleKeyboardShortcut`: after the Alt-chord block and before the TOOL_GROUPS branch, with no modifiers and not while `isDrawing`:
    - `e.code === 'Comma'` calls `prev()`;
    - `e.code === 'Period'` calls `next()`;
    - `key === 'o'` toggles the onion skin.
  - `_showCanvasContextMenu` (1522): Previous and Next Frame items when `AnimationService.frameCount() > 1`.
- Test: `tests/browser/menu-shortcuts.spec.js` runs unchanged and must stay green.

- [ ] **Step 1:** Implement the menu, the View toggle, the keys, F1 and the long-press items.
- [ ] **Step 2:** Run `node tests/run-all.js`, then `npx playwright test tests/browser/menu-shortcuts.spec.js tests/browser/menus.spec.js`.
- [ ] **Step 3:** Commit: `feat(animation): Animation menu and frame keys`.

## Task 9: Translations (13 locales)

**Files:** `js/i18n/en.js` plus `cs.js`, `de.js`, `es.js`, `fr.js`, `hu.js`, `it.js`, `pl.js`, `pt.js`, `ro.js`, `ru.js`, `sk.js`, `tr.js`.

- [ ] **Step 1: Add these NEW keys to `en.js`**, with placeholders exactly as shown:
  - **Menu:**
    - `menu.animation`;
    - `menu.animation.newFrame`, `.newBlankFrame`, `.deleteFrame`, `.moveFrameEarlier`, `.moveFrameLater`, `.prevFrame`, `.nextFrame`, `.onionSkin`, `.removeAnimation`.
  - **Panel and frames:**
    - `panels.frames`, `panels.frames.hint`. The hint ends with "Right-click this header to move the whole panel up or down".
    - `frame.status.none`; `frame.status.animated` (`{names}`); `frame.counter` (`{n}`, `{count}`); `frame.tile` (`{n}`); `frame.holdBadge` (`{n}`).
    - `frame.new`, `frame.new.hint`, `frame.blank`, `frame.blank.hint`, `frame.delete`, `frame.delete.hint`, `frame.prev`, `frame.prev.hint`, `frame.next`, `frame.next.hint`, `frame.holdLonger`, `frame.holdShorter`.
    - `cap.blank`, `cap.prev`, `cap.next`. Reuse the existing `cap.copy` and `cap.delete`.
    - `a11y.frameList`.
  - **Layer row:** `layer.animate.on`, `layer.animate.off`, `a11y.toggleLayerAnimated`.
  - **Onion skin:** `onion.title`, `onion.show`, `onion.show.hint`, `onion.opacity`, `onion.opacity.hint`, `onion.before`, `onion.before.hint`, `onion.after`, `onion.after.hint`, `onion.tint`, `onion.tint.hint`, `onion.inkOnly`, `onion.inkOnly.hint`.
  - **Messages:**
    - `msg.confirmUnanimateLayer` (`{name}`), `msg.confirmDeleteAnimatedLayer` (`{name}`), `msg.confirmMergeAnimated`, `msg.confirmFlattenAnimation`, `msg.confirmRemoveAnimation`;
    - `msg.frameLimit` (`{max}`), `msg.animationTooLarge` (`{mb}`), `msg.animationFrameDamaged` (`{n}`, `{name}`).
  - **Rewrite** `panels.layers.hint`, dropping "opacity and blend mode".
- [ ] **Step 2:** Translate every key into the 12 locales with identical placeholders. No plural keys are needed.
- [ ] **Step 3:** Run `node tests/i18n-parity.test.js`, then `node tests/run-all.js`. Commit: `i18n: animation strings in 13 languages`.

## Task 10: Manual chapter (13 languages)

**Files:**
- Create `manual/content/87-animation.md` plus `manual/content/<cs,de,es,fr,hu,it,pl,pt,ro,ru,sk,tr>/87-animation.md`.
- Modify `tools/manual-shots.js` `SHOTS` (121): add `{ id: 'frames-panel', crop: '#frames-panel', reach: <build a 4-frame demo with the onion on>, after: <undo it and restore the view> }`.

- [ ] **Step 1: Write the English chapter.**
  - Headings: `## Animation`; `### Frames and animated layers`; `### Onion skin`; `### Carrying a drawing to the next frame` (stamps); `### Saving an animation`.
  - The last section says that older versions open only the frame on screen, and that opening a file or File > New clears Undo.
  - One picture line: `![The Frames panel, with four frames and the onion skin settings](img/frames-panel.png)`.
  - Heading anchors must be unique across chapters.
- [ ] **Step 2:** Write the 12 translations with the same file name, translated headings, and the same picture line.
- [ ] **Step 3:** Run `node tools/build-manual.js`, then `npm run check:manual`. The generated menus, shortcuts and controls tables and `panels.png` are refreshed. Commit: `docs(manual): animation chapter in 13 languages`.

## Task 11: Browser spec and shell updates

**Files:**
- Create: `tests/browser/animation.spec.js`
- Modify:
  - `tests/browser/shell.spec.js`: line 14 becomes `['File','Edit','View','Layer','Animation','Image','Settings','Help']`; line 485 inserts `'frames-panel'` after `'layer-panel'`;
  - `tests/browser/menus.spec.js`: `sectionBySectionId` (68) adds `'panel-frames': 'frames-panel'`;
  - `tests/browser/helpers.js`: `boot` (78) sets `AnimationService.verify = true` after the app is ready.

- [ ] **Step 1: Write the specs**, using `boot` / `reload` / `selectMode`:
  - **Frame editing:**
    - New Frame from the panel, then draw, then `,` and `.` show each frame's own drawing;
    - the film button animates a second layer;
    - a shared layer's stroke shows in every frame.
  - **Onion skin:**
    - with the onion on, pixels of `#onion-skin-canvas` change when Opacity moves;
    - the bytes of `LayerManager.stillImageData()` and of a PNG export stay identical.
  - **Undo across frames:** draw on frame 1, go to 3, Ctrl+Z. Frame 1 is shown with the stroke gone.
  - **Persistence:**
    - a `.pixula` round trip through `ProjectFormat` export and decode;
    - `reload()` with autosave restore;
    - a single-frame document's saved grids match the fingerprint approach of `project-compact.spec.js`;
    - undo is empty after opening a project.
  - **Mode switch:** switching mode keeps every frame, and the onion canvas is repainted after a size change (standard_ula to timex_hires).
  - **Idle:** 0 `requestAnimationFrame` calls in a quiet second with the onion on, copying `render-loop-idle.spec.js`.
- [ ] **Step 2:** Run `npm run test:browser`, the full suite. Fix any failure at its cause.
- [ ] **Step 3:** Commit: `test(animation): browser coverage`.

## Task 12: Figures

**Files:** `tools/perf-bench.js`, `docs/FIGURES.md` (NEW section 9, "Animation - measured 2026-09-28").

- [ ] **Step 1:** Extend `tools/perf-bench.js` to time these at STANDARD_ULA, MULTICOLOR_8x1, MULTIGIGA_8x1 and LAYER2_640, in Chrome:
  - `packCel`;
  - `goTo`;
  - `renderCelsToRGBA`;
  - an onion opacity tick;
  - `convertCels` per cel;
  - a save with 24 full-screen frames.
- [ ] **Step 2:** Record them as M with the date. Register the A figures from `ANIMATION` (`MAX_FRAMES`, `MAX_CEL_BYTES`, speed, hold, onion defaults, tints) with their reasoning. Replace the Node-only M figures in the spec's §13.
- [ ] **Step 3:** Run `node tests/run-all.js`, then `npm run test:browser` and `npm run check:manual`. Commit, and merge Phase 1 to `main` when the owner asks.

---

# Phase 2: playback, thumbnails, animated GIF (shippable on its own)

## Task 13: Playback

**Files:**
- `js/services/animation-service.js`: NEW `play()`, `stop()`, `togglePlay()`, `isPlaying()`, `setSpeed(ticks)`, `setLoop(on)`, `_syncPlayback()`
- `js/core/constants.js`: `EVENTS.FRAME_PLAYBACK_CHANGED = 'frame:playbackChanged'`; `ANIMATION.SPEED_TICK_OPTIONS = [1,2,3,4,5,10,25]`
- `js/core/input-handler.js`: `_handleEscape` (1765) stops playback first and returns; `_onPointerDown` (511) stops and swallows while playing; Shift+P in `_handleKeyboardShortcut`
- `js/ui/menu-system.js`: `animation:play` with shortcut `Shift+P`; `_executeAction` stops playback before any other action
- `js/ui/components/frames-panel.js`: Play/Stop, Speed select, Loop checkbox
- `index.html`: `icon-play` and `icon-stop`
- Test: Create `tests/browser/animation-playback.spec.js`

- [ ] **Step 1: Write the failing spec:**
  - Play steps through the frames. While playing, about fps + 1 frame requests a second.
  - After Stop:
    - 0 requests in a quiet second;
    - the frame where play began is shown;
    - the file is not marked modified;
    - no undo entry was added.
  - Escape stops playback without cancelling a floating stamp.
  - A canvas tap stops playback without drawing.
  - A menu action stops playback.
  - The FLASH clock keeps running.
- [ ] **Step 2: Implement the clock** as a `setTimeout` chain scheduled from `performance.now()`.
  - Each tick calls `goTo(next, {playback:true})`.
  - Play parks a floating stamp (`SelectionService.endFloatingPaste()`) and clears the onion overlay.
  - Stop is idempotent, and `stop()` from `UndoRedo.beginAction` runs before its snapshot.
  - Also stop on `FILE_NEW` and in `_loadProjectData`.
- [ ] **Step 3:** Add the i18n keys to all 13 locales: `menu.animation.play`, `frame.play`, `frame.play.hint`, `frame.stop`, `frame.stop.hint`, `frame.speed`, `frame.speed.hint`, `frame.fps` (`{fps}`), `frame.loop`, `frame.loop.hint`, `cap.play`, `cap.stop`. Add the F1 row for Shift+P.
- [ ] **Step 4:** Run `node tests/run-all.js`, then `npm run test:browser`. Commit: `feat(animation): playback`.

## Task 14: Thumbnails

**Files:** `js/ui/components/frames-panel.js`, `css/components.css`.

- [ ] **Step 1: Render each tile.** Use `LayerManager.renderCelsToRGBA` (no tint, "Ink only" off), then `putImageData` into an offscreen canvas and `drawImage` scaled to 64x48 [A].
  - Cache by frame-entry identity.
  - Refresh the current frame's tile at most every 250 ms [A].
- [ ] **Step 2:** Run `node tests/run-all.js` and `npm run test:browser`, then commit: `feat(animation): frame thumbnails`.

## Task 15: Animated GIF export (only after the owner approves bringing GIF back)

**Files:**
- `js/io/gif-format.js`: `encode` (309) takes `loop: null` to leave out the NETSCAPE block; `export(options)` (62) gains an `options.animation` branch calling NEW `exportAnimation()`
- `js/services/animation-service.js`: NEW `forEachFrameFlattened(fn)`
- `js/ui/menu-system.js`: `animation:exportGif` calls `FileManager.exportAs('gif', { animation: true })`; the comment at line 18 records the decision
- Test: Create `tests/gif-animation.test.js`, reusing `parseGif` from `tests/gif-format.test.js` (60)

- [ ] **Step 1: Write the failing tests.** Check the frame count, the delays (speedTicks x hold x 2 cs), the loop block (present when Loop is on, absent when off), FLASH splitting at 320 ms in a fixed16 mode, two-screen A/B alternation at 2 cs, and that the frame on screen is restored afterwards.
- [ ] **Step 2: Implement** as specified in spec §8. `forEachFrameFlattened` writes cels without events or compose and restores the frame on screen in a `finally`.
- [ ] **Step 3:** Confirm that `export-format-gating.spec.js:64` and `menus.spec.js:173` still pass: Save Image As keeps no GIF leaf. Add the i18n key `menu.animation.exportGif` to all 13 locales.
- [ ] **Step 4:** Run `node tests/run-all.js`, then `npm run test:browser`. Commit: `feat(animation): export animated GIF`.

## Task 16: Phase 2 manual, figures, full pass

- [ ] **Step 1:** Add `### Playing it back` and `### Exporting an animated GIF` to `87-animation.md` in all 13 languages.
- [ ] **Step 2:** Run `node tools/build-manual.js`, then `npm run check:manual`.
- [ ] **Step 3:** Measure playback ticks and GIF export in Chrome with `tools/perf-bench.js`, and record the results in `docs/FIGURES.md` section 9. If any mode needs more than 10 ms of a tick [A], log it for Phase 3.
- [ ] **Step 4:** Run `node tests/run-all.js` and `npm run test:browser`, then commit.

---

# Phase 3: extras (one PR each, all optional)

- [ ] **Cached-bitmap playback** on a NEW overlay, for modes where Task 16 measured more than 10 ms per tick. Frames are pre-rendered by `renderCelsToRGBA`, with a byte cap [A].
- [ ] **Merge Down / Merge Selected in every frame.**
- [ ] **Duplicate an animated layer with all its frames.**
- [ ] **Palette seeding across all frames** (`_seedTargetPalette` / `_compositeRGBA`).
- [ ] **SevenuP `.sev`** multi-frame import and export: `js/io/sev-format.js`, P2 = N-1, up to 32 frames, standard layout.
- [ ] **PNG sprite sheet**, and per-frame arrays in the developer export.
- [ ] **Two-screen GIF with an Average palette** instead of A/B alternation.
- [ ] **Pen-button actions** for previous and next frame (`PEN_ACTIONS`).
- [ ] **A "hide unchanged pixels" ghost option.**
- [ ] **Make autosave failures visible:** `js/utils/storage.js` swallows `QuotaExceededError`.

Every extra follows the same constraints:
- translation keys in all 13 locales;
- the manual chapter updated in all 13 languages;
- `node tests/run-all.js`, `npm run test:browser` and `npm run check:manual` all green.
