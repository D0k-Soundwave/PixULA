# PixULA - work to do

Follow-ups from the companion file-access bridge (merged to `main` 2026-08-19).
Nothing here is broken or blocking - the branch merged with a green suite -
but these were found and deliberately deferred along the way, either because
they were out of scope for the plan that found them, or because fixing them
needed a human decision this session couldn't make alone. Grouped by how much
it matters, not by when it was found.

---

## Should do soon

**No "Use Companion" UI exists for Backup or Reference photo.**
`BackupService.setProviderKind()` and `ReferenceLayerService.setProviderKind()`
both work and are tested (Tasks 12-13 of the companion-bridge plan), but
nothing in the app's UI ever calls either one. Today an artist can pair the
companion (Settings > Companion...) and use "From System Font" in the Font
Editor - that's it. The mechanism for backups and reference photos is built
and sitting there unreachable. This is the biggest gap: it's the difference
between "the companion works" and "the companion is a feature anyone can
actually turn on." Needs: a control in Backup Folder Settings and the
Reference panel (design not yet decided - where it lives, what it looks
like), each calling the matching `setProviderKind('companion')`.
Source: `docs/COMPANION.md` "What works today"; SDD ledger, Tasks 12-13.

**Push `main` to `origin`.** Local `main` is currently ~41 commits ahead of
`origin/main` (the whole companion-bridge branch plus the doc/test fixes that
followed it). Nothing has been pushed yet.

**Manual TESTLOG verification pass.** `tests/TESTLOG.md`'s "Companion
file-access bridge" section (9 rows, added 2026-08-19) needs an actual human
at a keyboard - none of it can be automated:
- Tray icon appears on launch; Enable Pairing resolves a waiting tab within
  the 2-minute window (Windows/macOS/Linux - this dev machine only covers
  Windows so far).
- A second Enable Pairing click while armed is a no-op (the double-arm race
  found and fixed during implementation - worth confirming by hand once,
  since the automated test covers the code path, not the physical click).
- `/folders/choose` opens the real native picker; cancelling returns no
  folderId.
- `/fonts` lists real installed fonts on Windows, macOS, and Linux (with and
  without fontconfig present on Linux).
- Gatekeeper/SmartScreen warning appears on first run of the unsigned binary
  (expected, already documented, just needs confirming once per platform).
- `build.sh` actually run on a real Mac and a real Linux box, to confirm the
  documented cross-compile limitation (cgo+Cocoa; the sqweek/dialog
  non-cgo-Linux bug) is real and not a guess.
- A rejected token (401, e.g. after restarting the companion) correctly
  drops PixULA back to unpaired and re-offers pairing - the C3 fix from the
  final review. The automated test covers the state-machine logic; this row
  confirms it end-to-end with a real restarted binary.

## Worth doing, not urgent

**Chrome Private Network Access (PNA) is unverified.** The CORS fix (critical,
found and fixed 2026-08-19) is tested via Go's `httptest`, which cannot model
PNA. If Chrome ever classifies a `file://` page's initiator address space as
*public* rather than *local*, the preflight to loopback would need an
`Access-Control-Allow-Private-Network: true` header the companion doesn't
send, and the whole feature would silently stop working in a Chrome update -
exactly the shape of bug the CORS gap already was. Belief (not yet checked):
`file://` maps to `local`, so this isn't an issue. Add a manual TESTLOG row
and actually check, rather than let another unverified premise sit there.
Source: final whole-branch review, Recommendations.

**No `Access-Control-Max-Age` on the companion's CORS preflight responses.**
Every authenticated call (folder list, file read/write/delete, font list/
read) currently pays a fresh `OPTIONS` preflight round-trip - harmless, just
slower than it needs to be for what will be a fairly chatty local API. One
line (`w.Header().Set("Access-Control-Max-Age", "600")` or similar) in
`companion/server.go`'s OPTIONS handler.

**`EVENTS.COMPANION_STATE_CHANGED` has no listener anywhere in `js/`.**
`CompanionBridgeService` emits it correctly on every state transition, but
`CompanionDialog` re-renders by calling `getState()` directly rather than
listening on the bus. Per this project's own command/event architecture rule
(CLAUDE.md), UI should render from events, not direct calls - today it's
decorative. Low priority since it works; worth fixing when someone's already
in that file for another reason.

**`BackupService.forgetFolder()` doesn't reset `_providerKind`/`_provider`.**
Clears `this.directory` but leaves the provider selection pointed at
whichever backend was active - the next `chooseFolder()` would go to the
wrong one. Small, contained fix once someone's touching that file.

**`companion/folders.go`'s symlink walk-up loop fails open**, not closed, if
it ever exhausts without a successful `EvalSymlinks` call (theoretically
unreachable outside a TOCTOU race already accepted as a known limitation, but
a path-safety primitive reads more safely with an explicit `return "", false`
at the bottom rather than falling through to "allowed"). One line.
Source: Task 4 review, deferred minor.

**`tests/browser/system-font-import.spec.js` stubs `FontRasterizer`
wholesale.** No UI-level test exercises the real rasterization algorithm end
to end - only the dedicated `font-rasterizer.spec.js` (added in the final
review's C2 fix) does, calling `FontRasterizer.rasterize()` directly. Worth
rewiring the UI spec to use the real thing now that real-font loading in-page
is proven to work, so a future regression in the Font Editor's wiring (not
just the rasterizer itself) would get caught.

**`js/ui/components/font-editor-dialog.js`: width is applied before
rasterization can fail.** `FontService.setWidth(cellWidth)` runs before
`FontRasterizer.rasterize()` - if rasterization throws (now a real
possibility since the C2 fix added input validation), the width change is
left applied with no glyphs generated to match it. Reorder, or roll back the
width on failure.

## Nice to have

- **Host header validation on the companion** (accept only
  `127.0.0.1:51973`/`localhost:51973`) - cheap defense-in-depth against DNS
  rebinding, which would otherwise make a remote page same-origin with the
  companion and bypass CORS entirely. The bearer token still holds the line
  either way; this closes an attack shape for a few lines of Go. Source:
  final review, Recommendations.
- **`deleteFile`'s return-value semantics diverge between providers**
  (browser: `false` means "already gone"; companion: always `true`, since
  the Go handler swallows not-found into a 204) - no consumer reads the
  return value today, so this is purely a documentation gap
  (`FileAccessProvider.deleteFile`'s JSDoc doesn't state what the boolean
  means). Add the JSDoc line, or drop the return value from the interface.
- **`mtime` units are now consistent (both milliseconds) but no consumer
  reads `mtime` or `size` from `listFiles()` at all.** Worth asking whether
  the interface should carry fields nothing uses - see the final review's
  Recommendation #4 (a narrower interface would also remove the
  `listVersions()` performance regression noted below, since
  `BrowserFSAProvider.listFiles()` currently calls `entry.getFile()` on every
  file just to populate fields nobody reads).
- **`BackupService.listVersions()` performance regression on the browser
  path.** Now calls `entry.getFile()` for every file in the backup folder
  (to populate `size`/`mtime`) where the old code only read names. Called
  twice per backup write; at the 1-minute default autosave interval with
  retention off, an 8-hour session is ~480 files x 2 = ~960 real filesystem
  reads/minute. Not correctness-breaking, just wasteful. Likely resolved
  together with the interface-narrowing item above.
- **`tests/browser/font-rasterizer.spec.js` self-skips silently** if none of
  its 8 candidate real-font paths exist on a machine - meaning C2's only real
  (non-stubbed) regression guard can vanish with no loud signal in CI. A skip
  is defensible; it should be loud, not silent.
- A few `go.mod` dependency entries (`fyne.io/systray`, `github.com/sqweek/dialog`)
  are marked `// indirect` despite being direct imports - cosmetic, `go mod
  tidy` would normalize it, doesn't affect builds.
- A couple of Go handlers ignore error returns on `io.Copy`/`json.Decode`
  where a malformed request or a mid-stream failure would produce a
  slightly-wrong response instead of a clean error (`companion/folders.go`).
  Low likelihood, low impact for a local single-user tool.

---

*Compiled 2026-08-20 from the companion-bridge SDD execution ledger and the
final whole-branch review's findings. Delete or check off items here as they
land; this file is a punch list, not a design document.*
