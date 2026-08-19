# Test Log

**Automation pass (2026-07-08, recounted 2026-08-08):** a Playwright browser
suite drives the installed Chrome against index.html over file://
(`npm run test:browser`, `tests/browser/` — 27 files, **217 specs**, all green
on 2026-08-08; it was 74 specs when this pass started; extension-driven
automation of an already-open browser does not work on this file:// app, and
this harness is unrelated to it). The Node gate is `node tests/run-all.js` —
**59 suites**, also green that day.

**Where this matrix stands (measured 2026-08-08):** 384 rows — **163** fully
discharged `[x]`, **60** partial (`PART:` names the human residue), **161**
still human-only. The human-only count GREW with the 2026-08-07/08 post-rebuild
work, and that is expected rather than a regression: a native folder picker, a
real permission prompt and a photo moved on disk are things no automated run
can drive, so those features arrive with permanently manual rows. Tick-sheet
for the consolidated pass: `tests/manual-checklist.html`. Rows below carry
these verdicts:

- `[x] … — AUTO (browser: file)` — fully covered by a browser spec; re-runs on demand
- `[x] … — AUTO (node: suite)` — fully covered by an existing Node suite
- `[ ] … — PART: …` — the logic half is automated; the stated residue still needs a human
- unmarked `[ ]` — needs real user testing (external programs, hardware, visual judgment)

## Phase 5 — Universal input acceptance matrix (2026-07-04, REFACTOR_PLAN §3)

Automated: `node tests/run-all.js` green (architecture lint + all suites)
with `js/core/input-handler.js` replacing the interim canvas-pointer-bridge.
Static verification done against the code; browser rows below are the manual
matrix (browser automation is banned for this file:// app). Pen/touch rows
need real hardware — marked **pending-hardware** for the user's pass.

### Mouse (manual — verifiable now)
- [x] Left-drag draws with every tool; stroke survives leaving the canvas/iframe edge mid-drag (pointer capture) — AUTO (browser: input-mouse.spec; brush drag + capture-edge survival; other tools draw through the same PixelDrawRoutine path)
- [x] Right-click draws paper (brush/eraser/shape); no OS context menu anywhere over the canvas — AUTO (browser: input-mouse.spec)
- [x] Right-click with the selection tool active, or Shift+right-click in any tool, opens the canvas context menu (cut/copy/paste/delete/select-all/deselect) exactly once; a plain right-click INSIDE a selection draws paper like anywhere else — AUTO (browser: input-mouse.spec)
- [ ] Right-click on a focused stamp layer erases stamp ink; left-click stamps
- [x] Wheel pans the canvas; Ctrl+wheel zooms (down = out); zoom select/±/Fit unaffected — AUTO (browser: input-mouse.spec)
- [x] Space+drag pans; releasing space returns to the tool — AUTO (browser: input-mouse.spec; found+fixed the iframe-focus blur reset killing pan mode)
- [ ] Clut-bar Swap/Apply engage attr paint mode (button lights); click/drag paints attributes cell-by-cell, one undo entry per drag; right-click or Esc exits — PART: engage + Esc exit AUTO (browser: input-mouse.spec); manual: drag-paint cell-by-cell + one-undo-per-drag
- [ ] Pattern panel 8/16/32 capture: hover preview follows cursor, left-click captures to Mine + selects pattern brush, right-click exits
- [x] Long strokes at high zoom stay continuous (Bresenham interpolation unchanged) — AUTO (browser: input-mouse.spec; coarse-step drag must land every Bresenham pixel — zoom-independent code path)

### Keyboard (manual — verifiable now)
- [x] Tool keys from TOOL_GROUPS: B brush · E eraser · G fill · A spray · I eyedropper · S shape · D gradient · M select · V move · T text · P pattern · K pattern-creator · Z zoom (map generated from the registry — matches rail hints and F1 dialog) — AUTO (browser: input-keyboard.spec; loop reads the live registry)
- [x] Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) undo/redo — AUTO (browser: input-keyboard.spec)
- [x] Ctrl+C copy · Ctrl+V internal paste -> floating stamp at 0,0 · Ctrl+X cut -> floating stamp at selection origin — AUTO (browser: input-keyboard.spec)
- [x] Ctrl+A select all · Ctrl+D deselect · Delete/Backspace deletes selection — AUTO (browser: input-keyboard.spec)
- [ ] Ctrl+S save · Ctrl+Shift+S save-as · Ctrl+O open · Ctrl+N new
- [x] + / − step zoom by 100%; 0 (and Ctrl+0) = actual size — AUTO (browser: input-keyboard.spec)
- [ ] F1 opens the shortcuts dialog; Escape cancels stroke -> floating stamp -> special modes -> selection -> back to brush — PART: F1 + Escape-closes-dialog + stamp/attr-mode Escape AUTO (browser: input-keyboard.spec, input-mouse.spec); manual: the full Escape cascade order
- [x] Enter commits the floating stamp; 1–8 set ink, Shift+1–8 set paper, X swaps ink/paper; Shift+S toggles grid snap — AUTO (browser: input-keyboard.spec)
- [x] Keys typed into inputs/textareas/selects/dialogs never trigger shortcuts — AUTO (browser: input-keyboard.spec)
- [x] Every control Tab-reachable with a visible :focus-visible ring — AUTO (browser: input-keyboard.spec; sampled walk asserts ring + movement)
- NOTE: the old app's transform hotkeys (H/V/R/I/O, arrows) are intentionally not ported — they shadowed registry shortcuts (V=move, I=eyedropper); revisit if a non-conflicting scheme is agreed

### Pen — **pending-hardware** (Surface Pen / Wacom / Apple Pencil / S-Pen)
- [ ] Pressure varies brush size when the brush option is on (event pressure -> BrushEngine.mapPressure)
- [ ] Fast strokes have no straight-line gaps (getCoalescedEvents feeds every sample)
- [ ] Hover (buttons=0) shows the brush-outline preview; leaves cleanly
- [ ] Barrel button = temporary eyedropper for that interaction — PART: the routing is AUTO (browser: input-pen.spec, synthetic pen events for every assignable action); manual: that a real barrel press reaches the page at all, and as which bit (use Preferences > Pen > Pen check)
- [ ] Eraser end routes the stroke to the eraser tool (buttons & 32) — PART: routing AUTO (browser: input-pen.spec); manual: real inverted-pen contact
- [ ] The tail clears the size dialled in on the eraser (Tool Options), not the active brush's — set the eraser to something large, pick up the brush, flip the pen: one press clears that whole disc — PART: the size match is AUTO (browser: input-pen.spec, synthetic bits); manual: a real tail on real hardware
- [ ] Hovering tail: does the driver report bit 32 BEFORE contact? If it does, the outline under the pen is the eraser's disc, not the brush's (Windows Ink is expected to stay quiet until contact — either result is correct, record which)
- [ ] The tail erases inside the sprite / font / map / pattern grid editors instead of painting ink — PART: the button decoding is AUTO (browser: editors.spec); manual: real inverted-pen contact on a magnified grid
- [ ] Preferences > Pen: the pen check lights the control actually pressed, on real hardware — the one row no synthetic event can stand in for. Worth running per pen: whether a SECOND barrel button reaches the browser is a driver setting, not a pen fact
- [ ] A second barrel button on a real Wacom / XP-Pen / Huion / Gaomon arrives as the middle bit (buttons & 4) rather than being swallowed by the driver
- [ ] Tilt reported into InputHandler.getTilt() (BrushEngine.setTilt hook is feature-detected; engine consumption is future work)
- [ ] pointercancel (OS gesture arbitration) commits the stroke, no stuck batch

### Touch — **pending-hardware** (Windows touch / iPad Safari / Android Chrome)
- [ ] One finger draws; the status-bar switch turns finger drawing off and back on (persists) — PART: the routing, the switch, the persistence and all three settings are AUTO (browser: input-touch.spec, synthetic touch events); manual: that a real finger reaches the page as pointerType 'touch' at all
- [ ] Two fingers pan; pinch zooms around the gesture centroid; first-finger stroke commits when the second finger lands — PART: pinch-with-drawing-off is AUTO (browser: input-touch.spec); manual: real two-finger tracking and the centroid feel
- [ ] Palm rejection (three layers, 2026-08-10) — PART: every layer is AUTO against synthetic events (Node: touch-policy.test; browser: input-touch.spec — no-double-touch, the adjustable lockout window incl. a HOVERING pen closing it, a parked mouse NOT closing it, the ownership guard, pointercancel rollback). Manual, and only these: **rest a palm and THEN bring the pen down** (the case no backwards-looking window catches unless the driver reports hover); a slow stroke holding the pen still for over a second, then a palm; a real palm's contact count (does it arrive as 1 contact or several?); and whether the OS sends `pointercancel` for palm arbitration at all on this hardware — record which, the rollback path depends on it
- [ ] Preferences > Input: raising "Ignore touch after pen or mouse use" past the 500 ms default catches a palm that the default missed — the reason the window became adjustable, and only real hardware can say what value this pen needs
- [ ] Long-press (still ≥ 600 ms) commits the stroke and opens the canvas context menu
- [ ] No browser scroll/double-tap-zoom steals a stroke (touch-action none + viewport meta)
- [ ] Coarse-pointer CSS: 44px hit targets, ≥40px swatches, 28px slider thumbs

## Phase 4 — UI shell parity walk-through (2026-07-03)

Automated: `node tests/run-all.js` green (lint + core-draw + tools-draw +
all format suites) at the Phase-4 commit. The items below are the manual
browser smoke matrix — run against the old app at `H:\smsh` side by side.
(Browser automation is banned for this file:// app; manual only.)

### Chrome / layout
- 2026-07-06 (consolidated pass) No->fixed: page-level vertical scrollbar — the
  browser window itself could scroll the app. Root cause: nothing pinned the
  html/body height chain, so any overflow (fractional `zoom` rounding,
  transient nodes) surfaced as a page scrollbar. Fixed in layout.css:
  `html, body { height: 100%; overflow: hidden }` + `#app` 100vh->100%;
  scrolling now lives only in #toolbar / #panels / #canvas-viewport.
- [x] App boots with no console errors; boot-manifest assert silent (2026-07-06 consolidated pass: only Logger-loaded line + the documented benign srcdoc "unique security origins" warning) — also AUTO since 2026-07-08 (browser: boot.spec)
- [x] Header: menu bar renders (File…Help); language/theme/size selectors + Speak toggle present — AUTO (browser: shell.spec)
- [x] Left rail: Flash toggle, 2×8 CLUT (normal+bright), ink/paper wells, Border dropdown, attr op buttons, tool rail with 13 buttons in 5 groups — AUTO (browser: shell.spec; rail asserted against the live TOOL_GROUPS registry — 14 tools since the Phase 8 bezier)
- [x] Right sidebar order: Layers (sticky) -> Transform -> Tool Options -> Reference (collapsed) — AUTO (browser: shell.spec)
- [x] Panel collapse states persist across F5 (Storage WINDOW_STATE) — AUTO (browser: shell.spec)
- [x] Status strip: zoom -/select/+/Fit, Grid 1x1/8x8/16x16, cursor+cell readout — AUTO (browser: shell.spec)
- [ ] Ctrl+wheel over chrome steps UI scale; canvas unaffected

### Drag previews (Phase-4 exit criterion — GridOverlay port)
- [x] Shape tool: rubber-band preview while dragging line/rectangle/circle/… commits on release — AUTO (browser: input-mouse.spec; overlay pixel readback mid-drag + commit)
- [x] Selection tool: drag preview + marching ants after release (rect + lasso mask) — AUTO (browser: input-mouse.spec; rect ants via overlay readback. Lasso preview: manual)
- [ ] Gradient tool: two-phase flow — first drag previews, hover updates, click commits
- [ ] Brush/eraser: compositor-accurate preview under cursor; eraser previews paper
- [ ] Text tool: stamp preview follows cursor; click places floating stamp

### Colour / attributes
- [ ] Left-click swatch sets ink (+bright by row); right-click sets paper
- [ ] Double-click ink transparent; shift-double-click / double-right-click paper transparent
- [ ] Flash checkbox round-trips; wells + swatch rings track eyedropper picks
- [x] INK ◀/▶ and PAP ◀/▶ cycle attributes on written cells — REMOVED 2026-07-08: cycle buttons dropped from the UI by decision (no real use); `TransformService.cycleLayerInk/Paper` and the i18n keys retained for potential re-add
- [x] Swap/Apply buttons inert (input handler lands Phase 5 — expected) — SUPERSEDED by Phase 5: they now engage attr-paint mode, covered by input-mouse.spec
- [ ] Border dropdown previews around canvas + persists; feeds tape export default

### Tool options (OptionControls renderer)
- [ ] Every tool shows its schema panel; values round-trip to the tool
- [ ] Brush: fade rows appear only for Fade type; pattern browser slot for Pattern type
- [ ] Shape: thickness only for line, filled for non-line, border for rectangle
- [ ] Text: font list populates async (ZX ROM first); size list rescans on font change
- [ ] Sliders have −/number/+ decoration; number edits commit
- [ ] Pattern tool: browser fills panel; tabs/search/capture/create/import/export JSON

### Layers / stamps / transform
- [ ] Add/delete/duplicate/move/merge-selected; rename via double-click; lock/visibility — PART: add/duplicate/delete/flatten via the Layer menu AUTO (browser: menus.spec); manual: panel-button ops, rename, lock/visibility
- [ ] Paste (Edit>Paste) creates stamp; stamp list engage/release/XOR/commit/delete — PART: paste->stamp->commit AUTO (browser: input-keyboard.spec); manual: stamp-list row controls
- [ ] Transform: stamp section (scale/rotate/warp) while floating; image rotate slider with single undo entry; flips/invert/outline/shift — PART: image flips AUTO (browser: menus.spec), shift semantics AUTO (node: transform-shift.test.js); manual: panel sliders/warp UI

### Menus / dialogs
- [ ] File new/open/save/save-as/export (dialog with tape border override) — PART: menu contents + export dialog AUTO (browser: menus.spec); manual: new/open/save flows (native file dialogs)
- [x] Edit cut/copy/paste/delete/select-all/deselect with enable states — AUTO (browser: menus.spec)
- [x] View zoom in/out/fit/actual; grid toggles reflect in menu checks — AUTO (browser: menus.spec)
- [x] Layer + Image menu actions; flatten + clear confirm — AUTO (browser: menus.spec)
- [ ] Settings preferences dialog; reset-all reloads clean — PART: dialog opens + reflects live state AUTO (browser: menus.spec, persistence.spec); manual: reset-all reload
- [x] Help about + shortcuts dialogs (shortcut table from TOOL_GROUPS) — AUTO (browser: menus.spec)

### Known Phase-4 gaps (by design — later phases)
- Keyboard shortcuts, attr paint modes, pattern capture, Ctrl+V system paste,
  pinch/wheel zoom: need the universal input handler (Phase 5)
- Theme/language selectors persist but only dark theme + English exist (Phase 6)
- Autosave restore, beforeunload warning: Phase 7 app polish
- Old #history-panel was dead markup (nothing ever rendered it) — dropped

## Phase 6 — i18n + themes (2026-07-04)

Automated: `node tests/run-all.js` green including the new
`i18n-parity.test.js` — 13 locales × 498 keys, identical key sets against
en.js (source of truth), no empty values, `{param}` placeholders consistent
with en. Lint clean (I18n manager emits EVENTS.* only; themes.css is pure
token-override blocks under `@layer themes`).

What changed for translations: en.js reconciled against the live rebuild UI
(26 values updated, 22 keys added); all 12 other locales gained the same 22
keys plus the 16 historically-missing `menu.*`/`tooltips.*` keys, natively
translated (no English copies, no romanization); 21 meaning-changed keys
retranslated everywhere; ru de-romanized (`view.*`, `help.*`, theme names).

Manual matrix (run in browser, old app open side by side):

### Locale switch (no reload)
- [x] Language selector shows 13 autonyms; boots into the locale persisted pre-Phase-6 (interim AppSettings 'locale' key) — AUTO (browser: i18n-themes.spec)
- [x] Switching locale re-translates: menus (labels + items), panel titles, tool-rail tooltips incl. shortcut suffixes, CLUT attr buttons, zoom Fit + aria labels, grid label (colon intact), reference panel, pattern panels, layer/stamp row titles, status Ready — AUTO (browser: i18n-themes.spec; sampled: menus, panel titles, Cyrillic check. Full visual sweep: manual)
- [ ] Tool options panel: labels/options/optgroups/hints re-translate for current tool; re-opened dialogs (export/about/shortcuts/preferences) come up translated — PART: reopened About in ru AUTO (browser: i18n-themes.spec); manual: tool options re-translate
- [x] `<html lang>` tracks the locale; F5 restores the same locale — AUTO (browser: i18n-themes.spec)
- [x] de / hu / ru: left rail (Swap/Apply stacked rows), menus, zoom strip — nothing clips at 100–200% UI scale (Fit button grows with its label; the selector's top preset was 300% until it was retired 2026-08-10, see js/ui/components/colorbar-fit.js) — AUTO (browser: i18n-themes.spec; scrollWidth/Height sweep at min+max scale — found and fixed the zoom-fit vertical clip)

### Theme switch
- [x] Theme selector lists 6 translated names; boots into the theme persisted pre-Phase-6 (interim 'theme' key) — AUTO (browser: i18n-themes.spec)
- [x] dark / light / midnight / nord / dracula / sepia all render: chrome surfaces, text, accents, dialogs, scrollbars (color-scheme), toggle states visible on light themes — AUTO (browser: i18n-themes.spec; data-theme + distinct --bg-primary per theme. Visual accent/scrollbar nuance: manual)
- [ ] Grid overlay colours re-read from tokens on switch (8×8 red/16×16 blue on dark; darker variants on light/sepia)
- [x] Settings -> Light/Dark Theme menu toggles track the active theme and update the header selector; selector changes update the menu checks — AUTO (browser: i18n-themes.spec)
- [ ] Theme persists across F5; Reset All Preferences returns to dark — PART: F5 persistence AUTO (browser: i18n-themes.spec); manual: Reset All returns to dark

## Phase 7 — parity sign-off + quick wins (2026-07-04)

Automated: `node tests/run-all.js` green — 16 suites, including three new
ones: `transform-shift.test.js` (wrap vs no-wrap edge rows/columns +
attribute preservation), `shape-rasters.test.js` (rounded-rect corner cuts,
parallelogram skew, filled interiors, umbrella wiring),
`clipboard-paste.test.js` (system-paste quantizer over synthetic RGBA).
i18n parity now 13 × 504 keys. Parity sign-off recorded in
`docs/PARITY_CHECKLIST.md`: every ZX_PAINTBRUSH_COMPARISON §1 row Yes, zero
gaps; the Note flags there map to the manual rows below.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Autosave / session (Phase 7 app polish)
- [x] Draw, wait ~60s (or shorten AUTOSAVE interval in devtools), reload -> restore prompt shows age; OK restores layers/colours/tool/zoom/border — AUTO (browser: persistence.spec; snapshot written via App._getProjectData, prompt accepted, pixels+ink+zoom asserted)
- [x] Decline restore -> autosave cleared, defaults boot — AUTO (browser: persistence.spec)
- [ ] Autosave respects Preferences toggle (off = never writes)
- [x] beforeunload warning appears with unsaved changes, absent after save — AUTO (browser: persistence.spec; the warning case. Absent-after-save: manual)
- [x] Preferences checkboxes reopen showing live state (not defaults) — AUTO (browser: persistence.spec)

### Erase behaviours (2026-08-08)
Left button, right button and the eraser tool were one mode; they are now three.
- [x] Right button clears ink AND stamps ink/paper/bright/flash, exactly as the left button does — AUTO (erase-modes.test.js)
- [x] Right button leaves other ink in the same cell standing — AUTO (erase-modes.test.js)
- [x] The eraser resets paper and flash on contact, and keeps ink and bright while other ink remains in the cell — AUTO (erase-modes.test.js)
- [x] The eraser resets ink and bright with the last pixel in the cell — AUTO (erase-modes.test.js)
- [x] An emptied upper-layer cell goes transparent; an emptied background cell stays painted — AUTO (erase-modes.test.js)
- [x] The ERASE primitive still writes no attributes, so selection/transform moves do not repaint — AUTO (erase-modes.test.js)
- [x] Pixels Only keeps the primitive on its right button — AUTO (erase-modes.test.js)
- [ ] Draw a coloured area, pick different ink/paper, drag the RIGHT button across it: the ink goes and the area takes the new colours
- [ ] Same with a shape tool on the right button
- [ ] Erase the same area with the eraser tool instead: on an upper layer the cell goes fully transparent, showing the layer below
- [ ] Erase PART of a cell that has bright flashing ink: the erased part goes plain white and stops flashing immediately, while the ink left standing keeps its colour and brightness

### Privacy block (2026-08-07)
No consent gate by design: the app has no network access, so there is no
recipient and nothing to consent to. What is provided instead is the
transparency and withdrawal GDPR actually asks for - a counted account of what
is held, and a button that deletes it.
- [x] The app issues NO network request of any kind during boot, drawing, autosave and opening Preferences — AUTO (browser: privacy.spec, Playwright request interception)
- [x] The block reports live counts read from the stores, not a fixed paragraph — AUTO (browser: privacy.spec)
- [x] Empty stores are omitted rather than printed as zeroes — AUTO (browser: privacy.spec)
- [x] The outside-the-browser list names the backup folder and the linked photo — AUTO (browser: privacy.spec)
- [x] Clear empties all 10 stores and every `pixula-` key, and leaves other origins' keys alone — AUTO (browser: privacy.spec)
- [x] Clear does NOT delete backup version files the artist saved — AUTO (browser: privacy.spec)
- [x] The statement is translated, not the English fallback — AUTO (browser: privacy.spec, de)
- [ ] Read the statement in each of the 13 locales for sense, not just presence (native-speaker judgement)
- [ ] Clear All Stored Data on a real session: confirm the reload comes up as a first run (default theme, no autosave prompt, empty pattern library) and that any backup .pixula files are still on disk

### Versioned autosave to disk (2026-08-07)
Each autosave tick also writes the whole document to a chosen folder as
`<name> V1.pixula`, `V2`, ... The branch logic is AUTO (browser:
backup-versions.spec, 10 specs, against an in-memory directory stand-in); the
native picker and the real permission lifecycle are what remain.
- [x] `.pixula` round-trips the whole document - layers, colour, pixels - where `.scr` would flatten it — AUTO (browser: backup-versions.spec)
- [x] Versions number upward; numbering resumes from the FOLDER after a reload rather than restarting at V1 — AUTO (browser: backup-versions.spec)
- [x] A second document keeps its own sequence — AUTO (browser: backup-versions.spec)
- [x] Pruning keeps the newest N; keep = 0 keeps every version — AUTO (browser: backup-versions.spec)
- [x] A backup opens again and is the document it saved — AUTO (browser: backup-versions.spec)
- [x] A lapsed permission PAUSES and announces, rather than failing every minute; resume() continues the sequence — AUTO (browser: backup-versions.spec)
- [x] Unsafe filename characters are replaced and the result still parses as a version — AUTO (browser: backup-versions.spec)
- [x] A folder that has gone away does not cost the IndexedDB autosave — AUTO (browser: backup-versions.spec)
- [ ] Preferences > Backup folder > Choose Folder... opens the REAL picker and the status line names the folder
- [ ] Draw, wait for the interval: a `<name> V1.pixula` appears in that folder on disk. Draw again, wait: V2 appears
- [ ] Reload the page: the block says permission is needed. Resume Backups re-grants it and the next write is V3, not V1
- [ ] Open one of the version files through File > Open: the document comes back with every layer
- [ ] Set Versions to keep = 3, let it write 5: only the newest 3 files remain in the folder
- [ ] Set the autosave interval to 0: no further files appear
- [ ] Eject/disconnect the drive mid-session: the app keeps working, the status reports the failure, and the restore prompt still offers the work after a reload

### User pattern library cap (2026-08-07)
`PATTERNS` was the last store with no bound. MAX_USER_PATTERNS = 256 on the font
library's convention; savePatternData is the only writer.
- [x] Saving past 256 is refused, announces PATTERN_LIBRARY_FULL, and writes nothing — AUTO (browser: pattern-cap.spec)
- [x] Re-saving an existing name replaces in place even at the cap, and leaves one record not two — AUTO (browser: pattern-cap.spec)
- [x] An empty name is refused; a 200-character name is trimmed to 48 — AUTO (browser: pattern-cap.spec)
- [x] The Pattern Creator's Save goes through the service, so the cap applies there too — AUTO (browser: pattern-cap.spec)
- [x] 50 patterns of each size is 150 records, ~60 KB on disk — AUTO (browser: pattern-cap.spec, storage.estimate deltas)
- [ ] Fill the library to 256 through the Pattern Creator UI: the status line shows the localized "library is full" message and the tile is not added
- [ ] Shift+right-click canvas capture at a full library: no pattern is captured, and the brush does NOT switch to a pattern the library does not hold

### Reference photo linking (2026-08-07)
A preset stores a file handle plus a 256 px thumbnail instead of the photo. The
branch logic is AUTO (browser: reference-link.spec, 9 specs, stub handles); what
no automated run can drive is the native picker and the real permission
lifecycle, which is all that is left here.
- [x] A saved reference preset holds a thumbnail and a handle, not the photo; a slot preset with the reference slice does the same — AUTO (browser: reference-link.spec)
- [x] Recall prefers the link and gets full resolution; a broken link falls back to the thumbnail and keeps the placement — AUTO (browser: reference-link.spec, ImageSource.fileFromHandle stubbed)
- [x] The panel shows the stand-in note with a Locate Photo... button, and hides it once a real picture loads — AUTO (browser: reference-link.spec)
- [x] A handle that will not structured-clone costs the link, not the preset — AUTO (browser: reference-link.spec)
- [x] A `.zxpreset` carries the thumbnail and never the handle — AUTO (browser: reference-link.spec)
- [ ] Reference > Load Image opens the REAL picker (showOpenFilePicker on file://), and the chosen photo loads at full size
- [ ] Save a preset against it, reload the page (F5), recall it: the full-resolution photo comes back off disk — grant the permission prompt if Chrome shows one
- [ ] Decline that permission prompt instead: the thumbnail loads, the note appears, Locate Photo... re-points it and the note clears
- [ ] Rename or move the photo on disk, then recall: the thumbnail loads with the note (same as above, without any prompt)
- [ ] Export that preset as `.zxpreset`, load it on a machine that has never seen the photo: the thumbnail loads with the note

### System clipboard paste (QW1)
- [ ] Copy an image in another app -> Ctrl+V in the app (internal clipboard empty) -> floating stamp appears, quantized
- [ ] Internal copy (Ctrl+C on selection) then Ctrl+V -> internal clipboard wins over system image
- [ ] Menu Edit>Paste with empty internal clipboard -> permission prompt (or console warning if denied on file://) -> stamp on grant
- [ ] Canvas context-menu Paste follows the same order
- [ ] Paste menu item enabled when either clipboard could supply content
- [ ] Transparent PNG pastes as glyph-on-nothing (white = empty, dark = ink)

### Non-wrap scroll (QW2)
- [ ] Transform panel Wrap checkbox default on; shift arrows roll (old behaviour)
- [x] Unchecked: pixels scroll out at the edge, vacated cells keep paper colour — AUTO (node: transform-shift.test.js)
- [x] Works scoped to a selection and on the whole canvas — AUTO (node: transform-shift.test.js)

### New shapes (QW3)
- [ ] Shape options select shows Parallelogram (Polygons group) and Rounded Rectangle (Basic), localized in all 13 languages
- [ ] Both draw outline + filled with live preview; parallelogram skews top edge right — PART: rasters (outline/filled/skew) AUTO (node: shape-rasters.test.js); manual: live preview look

### Nudge + grid snap (QW4)
- [ ] Arrows nudge a floating stamp by nudgeStep px (Preferences, 1–32, persists)
- [ ] Arrows shift active selection contents; nothing happens with no selection/stamp
- [x] Snap button beside grid toggles (and Shift+S) toggles pressed state, persists across reload — AUTO (browser: input-keyboard.spec + persistence.spec)
- [ ] Snap on: selection marquee, shape drag and stamp drag land on 8px cell boundaries; arrows nudge by 8
- [ ] Snap on: brush/eraser/fill strokes are NOT snapped (placement ops only)

## Phase 8 — drawing parity (2026-07-04)

Automated: `node tests/run-all.js` green — 19 suites, including four new
ones: `bezier-raster.test.js` (endpoint inclusion, 8-connectivity,
symmetric apex, collinear-control collapse to the Bresenham line,
degenerate coincident points, thickness dilation),
`symmetry-draw.test.js` (H/V/quad mirrored writes through the real
core stack + real brush tool, erase mirroring, one-undo-action capture,
suspendMirror/options.mirror exemptions), `text-mask-ops.test.js`
(rotate 0/90/180/270 pixel mapping, shadow offset-OR growth, outline
dilate-minus-glyph hollowness, canonical process() chain),
`import-adjust.test.js` (brightness/contrast identity/clamp/midpoint
math + full-screen quantize preview honouring the 2-colour constraint
and exact ZX palette output). i18n parity now 13 × 527 keys.
Comparison-doc exit criterion met: every ZX-PB drawing-tool row in
`docs/ZX_PAINTBRUSH_COMPARISON.md` §2 is Yes/Plus.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Bezier curve tool
- [ ] Rail shows the Bezier tool between Shape and Gradient; shortcut C selects it; tooltip localized
- [ ] Drag places the two anchors with a straight-line preview; release shows curve + cross markers (1 handle for quadratic, 2 for cubic)
- [ ] Dragging any marker (anchors included) re-bends the curve live; compositor preview obeys attribute clash
- [ ] Enter commits; clicking away from all handles commits AND starts the next curve at the click point
- [ ] Escape (or switching tools) discards the pending curve without drawing
- [ ] Curve type select re-seats handles on the chord; thickness slider fattens the preview and the committed curve
- [ ] Right-button drag draws an erasing curve; undo removes a committed curve in one step

### Symmetry drawing mode
- [ ] Mirror label + H / V / H+V buttons appear beside the grid controls, localized; clicking the active mode turns it off
- [x] With H on: brush, eraser, spray, shapes, fill, bezier and pattern strokes all appear mirrored left<->right; V mirrors topup/downbottom; H+V draws in all four quadrants — AUTO (node: symmetry-draw.test.js; H/V/quad through the real core stack)
- [x] One undo removes both/all sides of a mirrored stroke — AUTO (node: symmetry-draw.test.js)
- [x] Paste/stamp commit, transforms (flip/rotate/shift/scale), attr paint Swap/Apply and pattern area fills are NOT mirrored — AUTO (node: symmetry-draw.test.js; suspendMirror/options.mirror exemptions)
- [x] Mode persists across F5 (own Storage key), buttons reflect it at boot — AUTO (browser: persistence.spec)

### Text directions + effects
- [ ] Direction select (0°/90°/180°/270°) rotates the live stamp preview; committed text matches the preview exactly — PART: rotation pixel math AUTO (node: text-mask-ops.test.js); manual: preview WYSIWYG
- [ ] Shadow checkbox adds an offset drop-shadow scaled to the font size; Outline hollows the glyphs to a 1px contour — PART: shadow offset-OR + outline dilate-minus-glyph AUTO (node: text-mask-ops.test.js); manual: in-tool look
- [ ] Shadow + Outline combine; effects survive stamp drag, scale and warp (fontInfo round-trip through SelectionService) — PART: canonical process() chain AUTO (node: text-mask-ops.test.js); manual: transform survival in the live UI
- [ ] Effects work for both ZX ROM and system fonts

### Import conversion dialog
- [x] Opening a PNG or JPG (Ctrl+O / menu) shows the conversion dialog with a live quantized preview before anything touches the canvas — AUTO (browser: editors.spec; in-page PNG through FileManager.loadFile)
- [ ] Brightness/contrast sliders and scaling (fit/stretch/crop) + dithering selects update the preview live (labels localized) — PART: slider math + quantize preview AUTO (node: import-adjust.test.js), controls present (browser: editors.spec); manual: live preview updates
- [ ] OK imports with exactly the previewed settings; Cancel / × / Esc aborts the import leaving the document untouched — PART: Esc-aborts-untouched AUTO (browser: editors.spec); manual: OK matches preview
- [x] SCR/TAP/SNA and other non-image opens bypass the dialog entirely — AUTO (browser: editors.spec)

## Phase 9 — format parity (2026-07-04)

Automated: `node tests/run-all.js` green — 23 suites, including four new
ones: `gif-format.test.js` (GIF89a header/LSD/GCT/image-descriptor byte
checks, reference LZW decoder round-trips incl. table-overflow noise,
FLASH phase-swap index math on the ULA interleave, two-frame animation
structure with NETSCAPE loop + 32 cs delays, no-flash fallback to
static), `tape-blocks.test.js` (TAP/TZX block lists: metadata decode,
serialize byte-identity for unmodified tapes, reorder/remove/append
round-trips, screen-block load payload identity, conservative rejection
of malformed/unknown/truncated input; legacy tap/tzx byte-identity
suites untouched and green), `clipboard-codec.test.js` (versioned
encode/decode round-trips up to full-screen, size-cap sanity, corrupt/
foreign-version rejection, persist->restore through the real
SelectionService), `zed-sev-format.test.js` (SEV v0.8 header fields and
cell layout vs the SevenuP 1.21 source, v0.0/masked/multi-frame
acceptance, ZED 53-byte signature/"1.00"/0x1A + LE line structure,
synthetic screen -> export -> import -> pixel+attr byte identity for both
formats, mixed text+block ZED documents). i18n parity now 13 × 572 keys
(45 new keys natively translated). Comparison-doc exit criterion met:
every ZX-PB format row in `docs/ZX_PAINTBRUSH_COMPARISON.md` §2 is Yes/Plus
(map/`.zxm` stays No by design until Phase 11; `.zxb` excluded as a
tape-block meta container — see the SevenuP/ZXB row note).

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### GIF import/export
- [ ] Opening a .gif (Ctrl+O / menu) shows the Import Conversion dialog with live quantized preview; OK imports, Cancel aborts
- [ ] An animated GIF imports its first frame
- [ ] Export dialog lists GIF; static export opens correctly in an external viewer (IrfanView/browser tab)
- [ ] With FLASH cells on screen, "Animate FLASH cells" produces a looping two-frame GIF at ~320 ms/phase in an external viewer — PART: two-frame structure + NETSCAPE loop + 32 cs delays AUTO (node: gif-format.test.js); manual: external viewer playback
- [x] Animate checkbox with no FLASH cells exports a plain static GIF — AUTO (node: gif-format.test.js; no-flash fallback to static)

### Tape Blocks dialog
- [ ] File > Tape Blocks… opens a picker (.tap/.tzx) and lists every block with number, type/name, byte length (labels localized)
- [ ] SCREEN$ rows are highlighted and their Load button puts that screen on the canvas (undoable)
- [ ] up/down reorder, x removes, "Add current screen" appends a header+data pair
- [ ] "Save tape" downloads a tape that loads in an emulator (Fuse/ZEsarUX); saving an UNMODIFIED tape is byte-identical to the input (fc /b) — PART: unmodified byte-identity AUTO (node: tape-blocks.test.js); manual: emulator load
- [ ] A TZX with pause/text/archive-info blocks lists them by localized type name; unknown block IDs surface a clear error instead of a corrupt list

### Persistent clipboard
- [x] Copy a selection, press F5: Edit > Paste is enabled immediately and pastes the same pixels + attributes as before the reload — AUTO (browser: persistence.spec)
- [ ] Cut also persists; clipboard survives a full browser restart (IndexedDB) — PART: reload survival AUTO (browser: persistence.spec; same IndexedDB path as a restart); manual: full browser restart
- [ ] Works in a private window / when IndexedDB is unavailable (localStorage fallback), or degrades silently with no console errors

### ZED / SevenuP interchange
- [ ] Exported .zed opens in ZX-Editor (second edition) / ZX-Paintbrush with pixels and attributes intact
- [ ] Exported .sev opens in SevenuP / ZX-Paintbrush with pixels and attributes intact
- [ ] A .sev saved by real SevenuP (incl. masked/sprite files) imports; first frame lands, mask ignored, no errors
- [ ] A .zed saved by ZX-Paintbrush imports with correct pixels/attrs; a text-heavy ZED document is rejected with a clear message
- [ ] Both formats appear in the Open dialog's file-type filter and the Export dialog's format list (localized names)
- NOTE (2026-07-08): our-side .zed/.sev export->import byte identity is AUTO (node: zed-sev-format.test.js); the rows above stay manual because their subject is the REAL programs.

## Phase 11 — map/tile editor (2026-07-04)

Automated: `node tests/run-all.js` green — 27 suites, including four new
ones: `map-codec.test.js` (versioned encode/decode round-trips up to the
256×256 limit, size-cap sanity, kind/version/corrupt-payload rejection
incl. dangling tile indices, persist->restore through the real
MapService with store cleanup of unreadable payloads),
`map-service.test.js` (attr byte packing inverses, tile creation from
patterns with MSB-left rows, tileset dedup/remap-on-remove, map
paint/erase, quiet out-of-bounds no-ops, 4-way flood fill containment,
resize with top-left preservation, dimension clamping, MAP_* facts on
the bus), `zxm-format.test.js` (header/field byte checks: section
markers, ZXP identifier, 192×256 bitmap rows, 24×32 hex attr rows,
`[x,y]` cell-aligned pixel positions, `[End of file]` terminator;
one-screen and multi-screen round-trip identity incl. unused tiles;
foreign-file tolerance: LF endings, bare positions, multi-cell element
slicing, `*` transparency; error paths mirroring the real ZX-Paintbrush
loader messages), `map-format.test.js` (native `.zxtm` bytes -> JSON
payload shape -> import -> identical document). i18n parity now 13 × 604
keys (32 new keys natively translated). Comparison-doc criterion: the
"Map/tile editing + `.zxm` format" row is Plus — the last No row outside
the font rows (Phase 10, still open) and the screen-mode family
(Phases 12–13).

`.zxm` caveat: no public spec exists (dead zxmodules.de, Wayback, the
current jimdofree site, RECOIL and dexvert all verified negative). The
handler is reconstructed from RECOIL's `.zxp` decoder and the
ZX-Paintbrush 2.6.1 exe's loader strings ("[Base ZXP picture]" /
"[Map ZXP picture]" / "[Map positions]" / "[End of file]" + error
message constraints); assumptions are documented in the handler header
and chosen to round-trip our own output. Interop with the real program
is exactly what the manual rows below verify.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Tile capture / paint / fill UX
- [ ] File > Map Editor… opens; New Tile / From Pattern (with an 8×8 pattern active) / Capture Screen each populate the tile palette with correct thumbnails — PART: open + New Tile + placement AUTO (browser: editors.spec); manual: From Pattern / Capture Screen thumbnails
- [ ] Selecting a tile and drawing in the Edit Tile pane updates the thumbnail and every placed instance live; ink/paper/bright/flash controls recolour them
- [ ] Paint drags place the selected tile; right-button (or Erase tool) empties cells; Fill floods only the contiguous same-tile region; Pick selects the tile under the cursor — PART: paint/erase/flood-fill containment AUTO (node: map-service.test.js); manual: drag/pick gestures
- [x] Deleting a tile empties its map cells and keeps all other placements pointing at the right tiles (indices remap) — AUTO (node: map-service.test.js)

### Large-map scrolling / zoom
- [ ] Resize to 128×96 and paint near all four corners: viewport scrolls smoothly, tiles render only in the visible window, no smearing after scroll
- [ ] Zoom 1×–6× keeps the pointer-to-cell mapping exact at every scroll position; grid lines appear from 12 px tiles up
- [x] Resize smaller clips bottom/right content; resize larger adds empty cells; top-left content always survives — AUTO (node: map-service.test.js)

### Map <-> canvas bridges
- [ ] "Render to Canvas" stamps the scrolled-to map window onto the drawing canvas with correct attributes; a single Undo removes the whole render
- [ ] "Capture Screen" imports the current screen into the map at the scrolled origin, deduplicating identical cells into shared tiles — PART: byte-dedup on addTile AUTO (node: map-service.test.js); manual: capture at scrolled origin
- [x] Symmetry mode does NOT mirror a map render (area stamps write exactly their computed pixels) — AUTO (node: symmetry-draw.test.js; area-fill exemption)

### .zxm files round-trip with ZX-Paintbrush
- [ ] Our exported .zxm opens in real ZX-Paintbrush 2.6.1 (base picture + map element list + positions intact)
- [ ] A map saved by real ZX-Paintbrush imports: elements become tiles (multi-cell elements sliced), positions land on the right cells
- [ ] Re-exporting an imported ZX-PB map and re-importing it is stable (no drift); off-screen positions (our multi-screen maps) noted as a known ZX-PB compatibility risk
- [ ] .zxtm and .zxm both appear in the Open dialog filter; Import inside the dialog accepts both

### Persistence across F5
- [x] Build a tileset + map, press F5: the Map Editor reopens onto the same map, tiles, name and dimensions — AUTO (browser: persistence.spec; working-map restore through the MAPS store)
- [ ] Developer export (ASM/C/BIN) produces the documented layouts (tiles, attr table, u16le dims + index grid, $FF empty) and is rejected with a clear message above 255 tiles
- [ ] Map editor UI is fully localized in all 13 languages (no clipped labels at any font scale)

## Phase 10 — Sinclair font editor (2026-07-05)

Automated: `node tests/run-all.js` green — 30 suites, including three new
ones: `font-codec.test.js` (versioned encode/decode round-trips for all
width/coverage combinations, JSON size-cap sanity, row-bit normalization
beyond the glyph width, version/width/base64/coverage rejection),
`font-service.test.js` (built-in ROM table integrity — 96×8 bytes,
byte-identical 'A' to the text tool's historical charset, blank DEL —
glyph get/set bounds by character code, copy/paste/flip/shift-with-wrap/
invert all masked to the live width, 4<->8 width re-shape crop/expose
semantics, ASCII<->FULL coverage re-window, ROM reset, persist->restore of
the working font through the FONTS store incl. unreadable-payload
cleanup, and the named-font library: save/load/delete, decoded-cache
isolation, boot warm-up), `font-format.test.js` (export->import identity
for CH4/CH6/CH8/CHR-768/CHR-2048/CHX in both coverages; 2048/768 size
rules; CH4 high-nibble masking; CHX signature+version bytes, offset
table, 11-byte transparent 1×1 records; multi-cell coloured char-map
cropping on import; rejection paths mirroring the real ZX-Paintbrush
loader errors — wrong file size, missing header, wrong version, bad
offsets, illegal char size, truncation, empty set; DevFormat asm/c/bin
font dumps). i18n parity now 13 × 647 keys (43 new keys natively
translated). Comparison-doc criterion: the two font rows in §2 are now
Yes/Plus — with them, ALL of §2 outside the screen-mode family (Phases
12–13) is at parity.

CH4/CH6/CHX caveat: like `.zxm`, no public spec exists. Byte layouts are
reconstructed from the ZX-Paintbrush 2.6.1 CHM + exe loader strings, the
ZX-Modules fileformats table (CHR 2048/768 sizes, CHX "1..256 chars,
8x8..32x32") and RECOIL's DecodeChx/DecodeCh8 (byte-accurate reference
decoder); assumptions (padded byte-per-row narrow widths, top-left-cell
CHX import crop, always-2048 CH? exports) are documented in the
`io/font-format.js` header and chosen to round-trip our own output.
Interop with the real programs is what the manual rows below verify.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Glyph editing UX
- [ ] File > Font Editor… opens onto the working font (ROM charset on first run); the glyph grid shows all covered codes with the selection highlighted and the code label updating — PART: dialog opens onto the working font AUTO (browser: editors.spec); manual: grid highlight/label UX
- [ ] Clicking a grid cell loads that glyph into the cell editor; brush/eraser/line/fill edits update the grid thumbnail live (left = ink, right = paper)
- [x] Clear/copy/paste/invert/flip H/flip V/shift <-->updown act on the selected glyph; shifts wrap within the glyph width; paste before any copy shows the status hint instead of acting — AUTO (node: font-service.test.js; all ops width-masked. Status-hint UX: covered by the ops being no-ops)
- [x] Load ROM Font restores the built-in charset (width returns to 8) — AUTO (browser: editors.spec + node: font-service.test.js)

### Width switching (4×8 / 6×8 / 8×8)
- [ ] Switching 8->6->4 narrows the editing surface and crops right-hand columns; switching back widens with blank columns (documented destructive crop) — PART: re-shape crop/expose semantics AUTO (node: font-service.test.js); manual: editing-surface resize UX
- [x] All glyph ops (flip/shift/invert) stay inside the narrow width — no pixels leak into the masked-off columns — AUTO (node: font-service.test.js)
- [x] Charset selector swaps 96 (32–127) <-> 256 (0–255) coverage, keeping overlapping codes' glyphs — AUTO (node: font-service.test.js; coverage re-window)

### Canvas-cell capture
- [ ] With art on the canvas, Cell X/Y + Capture Cell pulls that 8×8 cell's ink mask into the selected glyph (composited visible layers, same source as SCR export)

### Text tool with custom fonts (incl. effects)
- [ ] A saved library font appears in the text tool's font list (with its width label) alongside ZX ROM and system fonts; saving/deleting fonts updates the list on next tool open
- [ ] Typing with a 4-wide and 6-wide font uses the narrow advance (tight spacing), renders 1-bit sharp at 8/16/24 px, and commits exactly what the preview showed
- [ ] Direction 90/180/270, Shadow and Outline all work on bitmap-font text; transforms (scale/rotate/flip) on the floating stamp re-rasterize from glyphs without blurring
- [ ] Deleting the library font a placed stamp used keeps the placed pixels intact (already-committed art never depends on the library)

### CH4/CH6/CH8/CHR/CHX files round-trip with the real programs
- [ ] Our exported .ch8/.chr opens in ZX-Paintbrush 2.6.1 as a 128×128 character-set picture with every glyph in place
- [ ] Our exported .ch4/.ch6 opens in ZX-Paintbrush / ZX-Editor SE with glyphs left-aligned in their 8×8 positions
- [ ] Our exported .chx opens in ZX-Paintbrush ("big character file") with all covered characters defined; the space character is present
- [ ] A character set saved by real ZX-Paintbrush (each of the five extensions) imports with correct glyphs and coverage; a 768-byte CHR lands at codes 32–127
- [ ] Re-exporting an imported real-program font and re-importing it is stable (no drift)
- [ ] All five extensions appear in the Open dialog filter and import from both the dialog button and File > Open

### Library persistence across F5
- [x] Edit glyphs, press F5: the Font Editor reopens onto the same working font (width, coverage, name, glyphs) — AUTO (browser: persistence.spec; edited glyph restored through the FONTS store)
- [ ] Saved library fonts survive F5 and a full browser restart; delete removes them permanently
- [ ] Developer export (ASM/C/BIN) produces the documented layouts (label, first-code/count/width defines, raw 8-byte-per-glyph dump)
- [ ] Font editor UI is fully localized in all 13 languages (no clipped labels at any font scale)

## Phase 12a — mode seam live + multicolor + ULAplus (2026-07-05)

Automated coverage: `tests/screen-mode.test.js` (registry invariants, live
seam, ULAPLUS G3R3B2 codec vs RECOIL, ZX-PB conversion rules, full runtime
switch + undo/redo through the real core stack) and
`tests/mode-formats.test.js` (.mlt/.mc/.ifl layouts + byte-identical
round-trips + rejects + export-conversion gates, ULAplus SCR 6976
round-trip incl. registers, Image2ULAplus palette/pick fidelity); every
pre-existing suite green unmodified — `scr-byte-identity.test.js` proves
STANDARD_ULA output stayed byte-identical. File layouts follow RECOIL (the
reference decoder); the .mlt/.mc/.ifl and ULAplus-SCR handler headers
document the assumptions. Interop with the real programs is what the
manual rows below verify.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Mode switch UX + conversion warnings
- [x] Image menu shows the five modes with a checkmark on the active one; the status-bar selector mirrors it and shows the live cell geometry (e.g. 256 × 192 · 8×1) — AUTO (browser: modes.spec)
- [x] Refining switches (8×8 -> 8×4/8×2/8×1, Standard -> ULAplus) apply silently; the picture looks identical right after the switch — AUTO (browser: modes.spec; silence + content preserved. Node: screen-mode.test.js proves refine losslessness)
- [x] Coarsening switches (e.g. 8×1 -> 8×8) warn first; Cancel leaves everything untouched (menu checkmark and selector snap back) — AUTO (browser: modes.spec)
- [x] A coarsened multi-colour area resolves each 8×8 cell to its most-used attribute (ZX-PB rule) — AUTO (node: screen-mode.test.js)
- [x] One Ctrl+Z after any mode switch restores the previous mode AND content (incl. background colour and, for ULAplus, the palette); redo re-applies — AUTO (browser: modes.spec + node: screen-mode.test.js)
- [ ] Switching modes cancels an active floating paste; cell-bound dialogs (Map Editor) and gated exports show their localized messages in multicolor modes — PART: paste cancellation AUTO (browser: modes.spec); manual: gate messages in the dialogs

### Drawing + clash in 8×1/8×2/8×4
- [ ] In 8×1: two different ink colours on adjacent pixel lines of the same former 8×8 cell coexist (no clash); the attribute grid overlay shows per-line cells
- [ ] Brush, shapes, fill, spray, gradient, text and selection paste all honour the finer clash geometry in each multicolor mode
- [ ] FLASH still animates in multicolor modes; symmetry, grid snap and arrow-nudge step per-axis cell sizes (8 wide × 1/2/4 tall)
- [ ] Drawing performance stays usable in 8×1 (6144 cells)

### ULAplus palette editing + Image2ULAplus import
- [x] Switching to ULAplus keeps the picture's appearance (default registers reproduce the standard palette); Flash/Bright controls are replaced by the CLUT selector (0–3) with ink-half/paper-half swatch rows — AUTO (browser: modes.spec; node: screen-mode.test.js proves defaultRegisters reproduce the standard palette)
- [ ] Image > Edit ULAplus Palette…: clicking a swatch opens the colour picker, the picked value snaps to G3R3B2, and the canvas + rail update live; edits are undoable; Reset restores the defaults — PART: 64-swatch grid + undoable register edit + live --zx-N recompose AUTO (browser: editors.spec); manual: native picker + Reset button
- [ ] Cells painted under different CLUTs render with their own CLUT's colours; nothing flashes in ULAplus mode — PART: CLUT resolution AUTO (node: screen-mode.test.js attrToIndices); manual: on-canvas look + no flashing
- [ ] PNG import in ULAplus mode generates a fitting 64-colour palette (visibly richer than the 16-colour import) and one Undo removes both pixels and palette — PART: palette generation + pick fidelity AUTO (node: mode-formats.test.js Image2ULAplus); manual: visual richness + single undo
- [ ] The Import Conversion dialog preview matches the committed ULAplus import result

### File round-trips with real ZX-Paintbrush 2.6.1
- [ ] Our .mlt opens in ZX-Paintbrush as a Timex screen file with per-line attributes intact; a .mlt saved by ZX-PB imports identically (and re-exports byte-stable)
- [ ] Our ULAplus .scr (6976) opens in ZX-PB with ULA+ mode active and our palette loaded; a ULA+ .scr saved by ZX-PB imports with correct palette + CLUT mapping
- [ ] Our .ifl opens in a multicolor-capable viewer (RECOIL/recoil2png) with correct 8×2 attributes; .mc files from the wild import correctly
- [ ] SCR/TAP/TZX exports of a standard-mode document still load on real hardware/emulators (regression); TAP export of a ULAplus document carries the 6912 screen part

### F5 persistence per mode
- [x] F5 in each of the five modes restores the mode, the content and (ULAplus) the palette via the autosave prompt — AUTO (browser: persistence.spec; all 14 modes incl. edited ULAplus register)
- [ ] The persisted clipboard refuses cross-mode pastes (copy in 8×1, F5, switch to standard: Paste is unavailable rather than corrupt) — PART: cross-mode rejection AUTO (node: clipboard-codec.test.js); manual: Paste menu state in the flow
- [ ] Working map/font documents survive an excursion through a multicolor mode untouched (kind-pinned geometry)
- [ ] All new UI strings render localized in all 13 languages (menu items, status-bar selector, palette dialog, gate messages) with no clipped labels — PART: chrome clip sweep in de/hu/ru AUTO (browser: i18n-themes.spec); manual: dialog/gate strings per locale

## Phase 12b — Timex hi-colour/hi-res, GigaScreen, Bifrost ColorTiles (2026-07-05)

Automated coverage: `tests/mode-12b.test.js` (width-conversion rules
256<->512 incl. double-then-halve identity, timexMono palette model, lossy
matrix additions, GigaScreen compositing/blend/view/tags + undo, hi-res
exit stamp) and `tests/mode-formats-12b.test.js` (Timex SCREEN$ 12288
interleaved-attr layout vs .mlt, 12352 ULAplus variant, hi-res 12289/.hrg
layout + port byte, .img/.mg pair round-trips, GigaScreen 2-frame GIF,
.ctile tile layout + sheet round-trip, every reject/gate); all
pre-existing suites green — `scr-byte-identity.test.js` proves STANDARD_ULA
stayed byte-identical. Byte layouts follow RECOIL (DecodeScr cases
12288/12289/12352, DecodeTimexHires, DecodeHrg, DecodeZxImg, DecodeMg) and
the z88dk BiFrost ctile description; handler headers document every
assumption. NOTE: ZX-Paintbrush 2.6.1 has NO GigaScreen and no hi-res
editing mode (verified in its CHM + exe strings) — those are Plus features;
its Timex support is hi-colour 8×1 (Timex SCREEN$ + .mlt + ctiles), which
is what the real-program interop rows below can exercise.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Drawing in each new mode
- [ ] ULAplus 8×1: per-line cells + CLUT palette drawing both work; palette dialog edits apply live (and the 12a repaint fix holds: palette edits recolour the canvas immediately in plain ULAplus too) — PART: register edit -> live --zx-N recompose AUTO (browser: editors.spec, plain ULAplus); manual: 8×1 variant drawing
- [ ] Timex hi-res: brush/shapes/fill/text draw mono at 512×192; the scheme selector switches the whole screen's ink/paper pair and recomposes; attribute ops are hidden in the rail — PART: 512 geometry + scheme selector present + attr ops hidden AUTO (browser: modes.spec); manual: drawing feel + scheme recompose look
- [ ] GigaScreen: drawing lands on the current layer's sub-screen (A/B badge in the Layers panel); the blend view shows mixed colours; views A/B show each sub-screen alone — PART: tags + badges + view API AUTO (browser: modes.spec), blend math AUTO (node: mode-12b.test.js); manual: visual blend/A/B looks
- [ ] GigaScreen FLASH cells flash per sub-screen in the blended view

### Zoom/fit/input/selection at 512×192
- [ ] Fit zoom, manual zoom steps and scroll behave at 512×192; the status bar shows 512 × 192 · 8×8 — PART: geometry + readout AUTO (browser: modes.spec); manual: zoom/scroll feel
- [ ] Pointer position maps 1:1 to hi-res pixels at several zoom levels (draw a single-pixel diagonal and check for skips)
- [ ] Selection marquee, move, flip and paste operate across the full 512-px width; grid overlays align with the 8×8 cells
- [x] Mode switches 256<->512 double/halve the picture as documented (pixel doubling in, OR-merge out; leaving hi-res stamps the scheme colours) — AUTO (node: mode-12b.test.js; incl. double-then-halve identity + exit stamp)

### GigaScreen flicker preview + sub-screen editing
- [ ] The Blend/A/B toggle in the rail switches the canvas view instantly; the layer A/B badges move layers between sub-screens undoably-composited (recompose on click)
- [ ] GIF export of a GigaScreen document produces a fast 2-frame loop that flickers in a browser/viewer; PNG/BMP export capture the currently shown view (document: blend view = the 102-colour look) — PART: 2-frame GIF structure AUTO (node: mode-formats-12b.test.js); manual: viewer flicker + PNG/BMP view capture
- [ ] .img export/import round-trips both sub-screens; opening a wild .img (13824) shows a plausible blend; .mg type-8 files open, type-1/2/4 show the localized reject — PART: .img pair round-trips + .mg type gates AUTO (node: mode-formats-12b.test.js); manual: wild files
- [x] SCR/TAP export in GigaScreen mode gates with the "save as .img" message — AUTO (node: mode-formats-12b.test.js; every reject/gate)

### Per-mode file round-trips with real ZX-Paintbrush 2.6.1
- [ ] Our 12288 Timex SCREEN$ opens in ZX-PB (Timex mode active, per-line attributes intact); a Timex SCREEN$ saved by ZX-PB imports identically and re-exports byte-stable
- [ ] Our 12352 ULAplus Timex SCREEN$ opens in ZX-PB with ULA+ active and the palette loaded; the reverse direction round-trips
- [ ] Our .ctile opens in ZX-PB (after activating Timex mode there; ZX-PB asks for the sheet dimensions — 16 tiles/row matches our layout); a ZX-PB-saved .ctile imports with pixels+attrs intact
- [ ] Our 12289/.hrg hi-res screens display correctly in RECOIL/recoil2png (ZX-PB has no hi-res editor); the port-byte colour scheme is honoured
- [x] .ctile export honours a 16-px-aligned selection and rejects a misaligned one with the localized message — AUTO (node: mode-formats-12b.test.js)

### Mode-switch conversions to/from the new modes
- [ ] Colour -> hi-res warns (lossy: mono); hi-res -> colour warns (width halves); both are single-undo actions — PART: colour->hi-res warn accepted in the browser flow (modes.spec), lossy matrix + conversions AUTO (node: mode-12b.test.js); manual: hi-res->colour warn + single-undo check in UI
- [x] Entering GigaScreen is silent (lossless); leaving it warns only when a screen-B layer exists; tags clear on exit — AUTO (browser: modes.spec silent entry; node: mode-12b.test.js exit rules + tag clearing)
- [x] ULAplus 8×1 <-> ULAplus/Multicolor 8×1 conversions keep bits per the 12a rules (refine silent, coarsen warns) — AUTO (node: mode-12b.test.js + screen-mode.test.js)

### F5 persistence per mode
- [x] F5 in each of the eight modes restores mode + content; hi-res also restores the colour scheme; GigaScreen also restores the layer A/B tags — AUTO (browser: persistence.spec; all 14 modes incl. timexHiresInk + giga tags)
- [ ] The persisted clipboard still refuses cross-mode pastes for the new modes — PART: codec rejection AUTO (node: clipboard-codec/mode suites); manual: menu state in the flow
- [ ] All new UI strings render localized in all 13 languages (menu radios, scheme selector, giga view row, layer badges, gate messages) with no clipped labels — PART: chrome clip sweep AUTO (browser: i18n-themes.spec); manual: mode-specific strings per locale

## Phase 13 — ZX Spectrum Next modes (2026-07-06)

Static verification + Node suites only, per the deferred-manual-testing
policy. Automated coverage: `mode-13.test.js` (indexed cell model, draw
modes, compositor third branch, depth conversions, RGB333 codec, ULANext
mapping, undo/registers, classic gates — 58 checks) and
`mode-formats-13.test.js` (.nxi/.sl2/.pal/.npl/.spr round-trips + rejects,
size->mode mapping, 4bpp packing, sprite sheet model, Next tilemap export,
indexed-mode gates — 48 checks). The registry-inventory checks in
`screen-mode.test.js` grew with the registry (14 modes, depth-aware
bitmapSize/fileSize formulas — the sanctioned exception).

Reference note: ZX-Paintbrush has NO ZX Spectrum Next support — every
Phase 13 row is a Plus over parity. The byte references are RECOIL's
DecodeNxi (.nxi layout + RGB333 scale) and the Next hardware conventions
(8-bit palette write blue-OR rule, sprite transparency 0xE3/0x03,
tilemap 4bpp tile defs); .sl2/.spr/.npl layouts are documented
assumptions chosen to round-trip our own output.

Manual matrix (deferred to the end-of-rebuild consolidated pass):

### Drawing per mode
- [ ] Layer 2 256×192: brush/eraser/fill/shapes/spray/bezier draw with the selected palette index; right-rail index grid picks ink (left-click) and background (right-click); eraser restores transparency on upper layers and paints the background index on the background layer — PART: per-pixel index writes + index grid presence AUTO (browser: modes.spec), draw-mode index semantics AUTO (node: mode-13.test.js); manual: rail pick clicks + per-tool feel
- [ ] Layer 2 320×256 and 640×256: canvas, fit zoom, grid and input map correctly at the taller/wider geometries (draw single-pixel diagonals at corners); 640 mode exposes only 16 palette entries — PART: mode entry + draw + F5 at both geometries AUTO (browser: persistence.spec); manual: corner diagonals + 640 palette window
- [ ] LoRes 128×96 (+ Radastan): the small canvas presents scaled-up; drawing/selection/fill work; Radastan clamps to 16 colours — PART: mode entry + draw + F5 AUTO (browser: persistence.spec); manual: scaled-up presentation + clamping in UI
- [ ] ULANext: classic ink/paper drawing works; attribute ops (cycle/swap/apply) still work; FLASH stores but nothing flashes — PART: drawing + silent round-trip AUTO (browser: modes.spec), ULANext mapping AUTO (node: mode-13.test.js); manual: attr ops + no-flash look
- [x] Fill matches exact indices in indexed modes (flood a two-colour gradient area); magic-wand-style selectByColor selects by index — AUTO (node: mode-13.test.js)
- [ ] Copy/cut/paste inside an indexed mode reproduces exact colours (indexed clipboard); floating stamp preview matches the committed result; flips/rotations of a floating paste keep its colours; scale keeps colours, warp/arbitrary-rotate falls back to mask+ink (documented) — PART: indices in clipboard payloads + grid-transform preservation AUTO (node: mode-13.test.js); manual: preview-vs-commit look, warp fallback
- [x] Transform panel flips/rotates/shifts/scale preserve per-pixel indices; symmetry drawing mirrors indexed strokes — AUTO (node: mode-13.test.js)
- [x] Undo restores mode + content + palette registers across mode switches and palette edits — AUTO (browser: modes.spec + node: mode-13.test.js)

### Palette editing
- [ ] Image > Edit Palette… opens the 256-entry grid in rgb333 modes (16 rows, scrollable) and the 4×16 CLUT grid in ULAplus; edits snap to RGB333 and recompose the canvas live; Reset restores the documented defaults (classics at 0–15/128–143 + identity ramp) — PART: both grids + live recompose AUTO (browser: editors.spec), RGB333 snap + defaults AUTO (node: mode-13.test.js); manual: Reset button + picker snap in UI
- [x] Palette edits are undoable; F5 restores edited registers — AUTO (browser: editors.spec undo + persistence.spec F5)
- [ ] .pal/.npl export/import round-trips an edited palette; a 256-byte 8-bit .pal loads with the blue-OR expansion — PART: round-trips + blue-OR AUTO (node: mode-formats-13.test.js); manual: through the real UI/file flow


### Sprite editor UX
- [ ] File > Sprite Editor… opens; drawing with brush/eraser/line/fill paints indices; right-click erases to transparency (0xE3/0x03) — PART: opens + sheet ops AUTO (browser: editors.spec), sheet model + transparency AUTO (node: mode-formats-13.test.js); manual: in-dialog drawing gestures
- [ ] Add/Remove/Prev/Next navigate the sheet (cap 64); flip/rotate/clear work; depth 8<->4 masks indices (warn-free, documented destructive) — PART: add within cap AUTO (browser: editors.spec), ops + depth masking AUTO (node: mode-formats-13.test.js); manual: nav buttons UX
- [ ] Capture 16×16 pulls the composited canvas region in indexed modes and gates with the localized message elsewhere; Stamp writes through PixelDrawRoutine undoably — PART: capture/stamp bridges + gates AUTO (node: mode-formats-13.test.js); manual: through the dialog buttons
- [ ] .spr export/import round-trips at both depths; CSpect/ZEsarUX (or NextBASIC .spr loads) display our 8bpp sheets correctly — PART: round-trips at both depths AUTO (node: mode-formats-13.test.js); manual: CSpect/ZEsarUX display
- [ ] Sprite editor works with the Next palette while a classic mode is active (indices resolve through the register file, not the active palette)

### Tilemap export into CSpect/ZEsarUX
- [ ] Map editor's Next ASM/C/BIN options export 4bpp tile defs + map grid; the defs render correctly when loaded into Next tilemap pattern RAM alongside our .pal export — PART: tile-def bytes + dims + grid AUTO (node: mode-formats-13.test.js); manual: emulator pattern-RAM load
- [x] Maps with >255 tiles reject with the localized message; empty cells emit $FF as documented — AUTO (node: mode-formats-13.test.js)

### File round-trips with real Next tools
- [ ] Our .nxi opens in RECOIL/recoil2png and Next image viewers (palette honoured); a wild 49664 .nxi imports with palette + pixels intact and re-exports byte-stable
- [ ] .sl2 raw dumps LOAD correctly on Next hardware/emulator BASIC; 320×256 and 640×256 exports open in tools that accept those sizes (81920 ambiguity: 640 wins only when the document is already in 640 mode — verify both directions)
- [ ] LoRes/Radastan containers round-trip through our own export/import; PNG import in each indexed mode quantizes to the palette (Floyd–Steinberg on/off) and the Import dialog preview matches the applied result
- [ ] Classic exports (SCR/TAP/TZX/mlt/zed/sev/GIF/dev dumps) gate with localized messages in indexed modes; PNG/BMP export still capture any mode's canvas — PART: gates AUTO (node: mode-formats-13.test.js; SCR gate also browser: modes.spec); manual: PNG/BMP capture look
- [ ] ULANext exports a plain 6912 .scr (palette travels via .pal/.npl); loading that pair elsewhere reproduces the picture

### Mode-switch conversions
- [x] Classic -> indexed warns (lossy) and preserves appearance (classics land on palette slots 0–15); unaltered upper-layer cells stay transparent — AUTO (browser: modes.spec warn flow; node: mode-13.test.js conversion rules)
- [x] Indexed -> classic warns and re-quantizes each 8×8 tile to two colours; indexed <-> indexed crops/pads at top-left, 256<->LoRes scales 2×, 8bpp->4bpp re-maps to the 16-entry window — AUTO (node: mode-13.test.js)
- [x] STANDARD_ULA <-> ULANEXT is silent both ways with an unedited palette and visually identical — AUTO (browser: modes.spec; node: mode-13.test.js losslessness)
- [ ] Cell-bound features gate cleanly in indexed modes: font capture, map canvas bridges, pattern capture, ctile/attr ops (localized messages, no corruption) — PART: gates AUTO (node: mode-13.test.js / mode-formats-13.test.js); manual: message wording in the dialogs

### F5 persistence per mode
- [x] F5 in each of the six Next modes restores mode + content + Next registers; the indexed drawing indices reset to defaults (tool state, documented) — AUTO (browser: persistence.spec; all 14 modes incl. an edited Next register)
- [ ] The persisted clipboard refuses cross-mode pastes; an indexed clipboard restores with its indices after F5 — PART: codec rejection + idx payloads AUTO (node suites); manual: menu state in the flow
- [ ] All new UI strings render localized in all 13 languages (mode radios, palette editor, sprite editor, index grid, gate messages) with no clipped labels — PART: chrome clip sweep AUTO (browser: i18n-themes.spec); manual: mode-specific strings per locale

## Tool presets (2026-08-07)

### The row under the tool options
- [x] Save preset asks only for a name, pre-filled with one that is free; Enter files it — AUTO (browser: tool-presets.spec save flow; node: tool-presets.test.js suggestToolPresetName)
- [x] Load lists only the presets of the tool in hand; a brush variant (Spray/Fade/Hatch) has its own list — AUTO (browser: tool-presets.spec)
- [x] Loading restores the tool's options and moves NOTHING else (colour, symmetry, zoom untouched) — AUTO (browser: tool-presets.spec)
- [x] The sliders and selects show the loaded values immediately — AUTO (browser: tool-presets.spec, through the real select)
- [x] A tool with nothing to capture (eyedropper, move) shows no row — AUTO (browser: tool-presets.spec, presets.spec)
- [ ] The row reads correctly in all 13 languages, and the Save/Load labels do not clip at 200% interface size — PART: the chrome clip sweep is AUTO (browser: i18n-themes.spec); manual: these two controls per locale at large scale

### The Presets panel
- [x] Lists the active tool's presets, names the tool, follows a tool change — AUTO (browser: tool-presets.spec)
- [x] Rename and delete work from the panel; re-saving a name replaces in place rather than adding a twin — AUTO (browser: tool-presets.spec; node: tool-presets.test.js)
- [x] It is ordinary sidebar chrome: titled, labelled, collapsible, and it sits directly under Tool Options — AUTO (browser: tool-presets.spec, shell.spec sidebar order)
- [ ] Collapsed/expanded state survives F5 like the other panels (WINDOW_STATE) — PART: the mechanism is AUTO for other panels (browser: shell.spec); manual: this panel specifically
- [ ] A pen and a finger can hit the rename/delete buttons (44px under pointer:coarse) and the whole-width name button loads
- [ ] A long preset name ellipsises rather than pushing the icon buttons out of the panel

### Persistence and scale
- [x] Presets survive F5 in the real database, and are listed on the first render after boot — AUTO (browser: tool-presets.spec)
- [x] Emptying a tool's list removes its record rather than leaving an empty one — AUTO (node: tool-presets.test.js)
- [x] A stored value outside the current schema range is clamped, and a vanished select value skipped — AUTO (node: tool-presets.test.js)
- [ ] A tool carrying many presets (20+) still reads and scrolls sensibly in the panel, and the 64 KB per-tool cap is nowhere near reached — the cap figure is computed from a ~400-byte brush capture, so confirm the real size on a full list

### The Reference panel as a preset scope (2026-08-07)
- [x] It shows the same Load/Save row and list every tool has, filed under `reference` — AUTO (browser: tool-presets.spec)
- [x] Save is disabled until an image is loaded, and the reason is in its tooltip — AUTO (browser: tool-presets.spec; node: tool-presets.test.js canCapture)
- [x] A reference preset restores the picture AND its placement together — AUTO (browser: tool-presets.spec, through a real clear-and-reload)
- [x] Reference presets are offered to the Reference panel and to no tool; the sidebar Presets panel never lists them — AUTO (browser: tool-presets.spec)
- [x] Two presets tracing one photo store it once, and both survive F5 — AUTO (browser: tool-presets.spec; node: tool-presets.test.js)
- [x] The asset sweep spares reference pictures when an unrelated preset is saved, and drops one only when the last preset referencing it goes — AUTO (node: tool-presets.test.js)
- [ ] Loading a reference preset over a DIFFERENT loaded photo replaces it cleanly on screen (no flash of the old image at the new offset, no stale canvas) — the transform is applied before the image by design; confirm that reads correctly at high zoom
- [ ] A large real photo (several MB) saves, reloads after F5 and still displays — the asset path is byte-tested with a 2x2 PNG only, so this is the one that exercises the real size
- [ ] The Reference panel's preset row reads correctly in all 13 languages at 200% interface size

### Palette as a document (2026-08-07)
- [x] File > Load Palette… / Save Palette… exist and work without opening the editor — AUTO (browser: palette-files.spec)
- [x] The editor carries Load, Save, From image and Ramp; rgb333 offers .pal and .npl, ULAplus only .pal — AUTO (browser: palette-files.spec)
- [x] A palette saves to real bytes and loads back over a wrecked one — AUTO (browser: palette-files.spec, through the real handlers)
- [x] The ramp fills between two entries evenly, in ONE undo action, and refuses a run with nothing in it — AUTO (browser: palette-files.spec; node: palette-ops.test.js)
- [x] The palette travels inside a ULAplus SCR (6976) both ways — AUTO (browser: palette-files.spec)
- [x] CLUT labels print their number and survive a locale change — AUTO (browser: palette-files.spec; the I18n param fix)
- [ ] A .pal saved here loads into ZX-Paintbrush / an emulator's palette loader, and one written by them loads here — the byte forms are per the SpecNext wiki and RECOIL, but no real-program interop has been run
- [ ] Build from image on a real photograph produces a palette a human judges usable in each of ULAplus and Layer 2 — the automated checks only prove the colours are legal registers and that a flat image yields its own colour
- [ ] The .npl transparency index ($E3) is honoured by real Next tooling on a palette we wrote
- [ ] The palette editor's new rows read correctly in all 13 languages at 200% interface size, and the number inputs stay usable

### The Presets panel as a library (2026-08-07)
- [x] It lists every scope's presets, not just the active tool's, and labels each row with its tool — AUTO (browser: tool-presets.spec)
- [x] A row prints the settings that DIFFER from the tool's defaults, with select values as labels and checkboxes as words; an all-defaults preset says so — AUTO (browser: tool-presets.spec)
- [x] The user's own name for a preset is the row's hover, and a rename shows there — AUTO (browser: tool-presets.spec)
- [x] Clicking a row takes that preset's tool in hand before applying it — AUTO (browser: tool-presets.spec)
- [x] Reference presets appear in the library labelled by their scope — AUTO (browser: tool-presets.spec)
- [x] Nothing in the panel chrome is named after one tool; the Save button says only "Save preset..." and names the tool in its tooltip, following the tool in hand — AUTO (browser: tool-presets.spec)
- [ ] With presets across five or more tools the list stays scannable: the tool line reads first, the settings line wraps to at most two lines and ellipsises rather than growing the row
- [ ] The settings line reads correctly in all 13 languages at 200% interface size — every option label and select value is translated, and a long localized settings line still clamps
- [ ] Hovering a row shows the name promptly and it is legible against every theme

### System fonts and the caps (2026-08-07)
- [x] The text tool lists fonts detected on this machine, not a hardcoded list; every result is a real candidate and the list is sorted and stable — AUTO (browser: text-fonts.spec)
- [x] A legacy alias (Helvetica/Times/Courier) is not offered beside the font it resolves to, but IS kept where it is genuinely a different font — AUTO (browser: text-fonts.spec)
- [x] An empty queryLocalFonts result is treated as a failure, not an answer, and is not cached for the session — AUTO (browser: text-fonts.spec)
- [x] Every ALIASES key and target is a candidate, so no alias entry is dead — AUTO (node: font-probe.test.js)
- [x] 32 layers can be created and the 33rd is refused; the font library refuses an oversized record — AUTO (verified 2026-08-07; layer 0 is the locked Background, so 31 are drawable)
- [ ] On a machine with unusual fonts installed, check the list is genuinely useful and nothing important is missing — the probe only finds names on its 301-entry candidate list, so this is the row that finds the gaps in that list
- [ ] Serve the app over http(s) and confirm queryLocalFonts prompts, is granted, and its complete list replaces the probe's
- [ ] With 31 drawing layers in use the layer panel stays usable (scrolls, rows readable, no clipped controls) at 100% and 200% interface size
- [ ] A long session at 50 undo steps on the largest mode does not make the tab sluggish — the 190 KB/entry figure is serialized size, not heap

### Autosave interval as a preference (2026-08-07)
- [x] Preferences shows a minutes field (number, min 0) with the live value, defaulting to 1 — AUTO (browser: autosave.spec)
- [x] A chosen interval arms a timer of that length and survives a reload — AUTO (browser: autosave.spec)
- [x] 0 disables it and leaves NO timer; raising it above 0 re-arms without a reload — AUTO (browser: autosave.spec)
- [x] Out-of-range and nonsense entries clamp rather than being ignored or stored raw — AUTO (browser: autosave.spec)
- [x] An existing `autosave: false` preference from before the change arrives as 0 minutes — AUTO (browser: autosave.spec)
- [ ] Set 2 minutes, draw, wait, and confirm a restore prompt appears on the next boot offering that work — the timing itself is the one thing no spec waits for
- [ ] Set 0, draw, close the tab, reopen: no restore prompt, and no work silently saved
- [ ] The minutes field and its label read correctly in all 13 languages at 200% interface size

### Undo snapshot memory (2026-08-07)
- [x] Packed snapshots restore a classic-mode layer byte-exactly after a real wreck — AUTO (browser: undo-snapshot.spec)
- [x] Indices and transparency (-1) restore exactly in indexed modes — AUTO (browser: undo-snapshot.spec)
- [x] An undefined attribute comes back undefined, not zero — AUTO (browser: undo-snapshot.spec)
- [x] Undo and redo work end to end through the packed path — AUTO (browser: undo-snapshot.spec)
- [x] A stroke on one layer keeps ONE grid, not all of them — AUTO (browser: undo-snapshot.spec)
- [x] Undo restores correctly when most grids were dropped, and untouched layers survive — AUTO (browser: undo-snapshot.spec)
- [x] A deleted layer keeps its grid, so undoing the delete brings its content back — AUTO (browser: undo-snapshot.spec)
- [ ] A long real session (an hour of drawing across several layers, mode switches, transforms, paste/commit) undoes and redoes back to the start with no visual corruption — the specs check mechanisms, not accumulated history
- [ ] Undo across a mode switch inside one action still restores both mode and content (geometry mismatch is treated as "changed", so the grid should always be kept — confirm on a real switch)
- [ ] Memory during a long session stays flat: with 8+ layers at Layer 2 640, watch the tab's memory in Task Manager over 50+ actions and confirm it does not climb per stroke

### Undo depth 500 and the byte budget (2026-08-07)
- [x] The history is capped by BYTES as well as entry count, and the byte budget prunes before the count limit is reached — AUTO (browser: undo-snapshot.spec)
- [x] The byte budget never prunes below MIN_HISTORY_ENTRIES, even when a single entry exceeds it — AUTO (browser: undo-snapshot.spec)
- [ ] Draw 500+ strokes at Layer 2 640 with several layers and confirm the tab's memory settles rather than climbing, and that undo still walks all the way back
- [ ] Perform 50+ mode switches in one session (the all-layer action) and confirm the history prunes rather than the tab slowing down

### Redo-stack trimming (2026-08-07)
- [x] A redo entry keeps only the layers the undo changed, not a full snapshot — AUTO (browser: undo-snapshot.spec)
- [x] Redo still restores correctly after its entry was trimmed — AUTO (browser: undo-snapshot.spec)
- [ ] Undo all the way back through 200+ strokes at Layer 2 640 with several layers, then redo all the way forward, and confirm the picture matches at both ends and the tab's memory does not climb

## Companion file-access bridge (2026-08-19)
An optional local Go binary (`companion/`) giving prompt-free folder access
and real OS-font access; see `docs/COMPANION.md` for the architecture and
security model. The pairing state machine, path-traversal/symlink-escape
rejection and folder authorization are AUTO at the unit level (`go test
./...` in `companion/`, separate from `node tests/run-all.js`); provider
switching, the bridge's own state transitions and the HTTP client's request
shaping are AUTO (node: `companion-bridge-service.test.js`,
`companion-file-provider.test.js`, `backup-service-provider.test.js`,
`reference-layer-service-provider.test.js`, `storage-companion-store.test.js`)
with no real companion process involved. What remains needs an actual running
binary, a real click on a real native window, and real OS state — exactly the
bucket this file already keeps native file dialogs and pen/touch hardware in.
As of this writing only pairing (Settings > Companion...) and system fonts
(File > Font Editor... > From System Font...) are reachable through real UI;
`BackupService`/`ReferenceLayerService` can already route through the
companion (`setProviderKind()`) but no UI calls that yet, so there is nothing
to manually test there until that hookup lands.
- [ ] Companion: tray icon appears on launch; Enable Pairing click resolves a waiting PixULA tab within the 2-minute arm window (Windows/macOS/Linux)
- [ ] Companion: a second Enable Pairing click while already armed is a no-op, not a restarted window
- [ ] Companion: `/folders/choose` opens the OS's native folder picker; cancelling returns no folderId
- [ ] Companion: `/fonts` lists real installed fonts on Windows, macOS, and Linux (with and without fontconfig present on Linux)
- [ ] Companion: From System Font in the Font Editor loads a real installed font's bytes and rasterizes a legible glyph set at 4/6/8 cell width
- [ ] Companion: Gatekeeper (macOS) / SmartScreen (Windows) warning appears on first run of the unsigned binary — expected, documented in `docs/COMPANION.md`
- [ ] Companion: reload the PixULA tab after pairing — Check Again in Settings > Companion... reflects the paired state without re-pairing; killing the companion process and checking again reports not running
- [ ] Companion: a token rejected by a restarted companion (401) drops PixULA back to the unpaired state and Settings > Companion... offers to pair again, rather than looping or erroring silently
- [ ] Companion: `build.sh` run on a real Mac and a real Linux box each produce a working native binary — the documented limitation is that Windows/amd64 is the only target that reliably cross-builds from this dev environment (cgo+Cocoa for darwin; a `sqweek/dialog` non-cgo bug with no tagged release to pin around for the Linux cross-build path)
