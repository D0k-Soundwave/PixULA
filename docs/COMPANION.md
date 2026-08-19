# PixULA Companion

An optional native helper process the artist can run alongside PixULA to get
real, unprompted folder access and OS-font access. **PixULA works fully
without it, exactly as it does today** — the companion is purely additive
and, as of this writing, only reaches the app through two paths: pairing
status (Settings > Companion...) and the Font Editor's From System Font
row. See "What works today" below for the precise boundary.

## Why it exists

Every folder-linking feature PixULA has — `BackupService`'s backup folder,
and the reference-photo link in `ReferenceLayerService`/`ImageSource` —
goes through the browser's File System Access API, which has two separate
limits:

1. **Chromium desktop re-prompts anyway.** A `FileSystemDirectoryHandle`
   survives in IndexedDB across reloads, but Chrome resets its permission to
   `'prompt'` on every browser restart and refuses to silently re-grant it —
   `requestPermission()` needs a live user gesture, which an autosave timer
   is not. This is why `BackupService.needsPermission` and the Resume
   Backups button exist.
2. **Firefox, Safari, and Android Chrome don't implement the API at all.**
   Artists on those browsers have no folder-linking capability today, full
   stop.

The companion is a small local HTTP server, written in Go, that solves both
by moving the actual filesystem access into a native process the artist
starts once and leaves running — plus it enables a capability neither
problem was blocking: using real installed OS fonts as a source for
PixULA's bitmap font editor, which needs a native process because reading
OS font directories isn't something any browser API exposes at all.

## What works today

Be precise about this, because it is easy to overstate: pairing and status
are fully wired, and system fonts are fully wired end to end through real
UI. **Backup folder and reference-photo companion support is built and
tested at the service layer, but has no UI hookup yet.**

- **Pairing (Settings > Companion...).** `CompanionDialog` shows whether the
  companion is running, checks status on demand, and drives the pairing
  flow (see below). This is real, reachable UI.
- **System fonts (File > Font Editor... > From System Font...).** Fully
  reachable: it lists the companion's enumerated OS font families, reads
  the chosen font's bytes, and rasterizes it client-side into a normal
  bitmap font. If the companion isn't paired, the button explains that
  ("Connect the Companion (Settings > Companion...) to use system fonts.")
  rather than failing silently.
- **Backup folder and reference photo.** `BackupService.setProviderKind()`
  and `ReferenceLayerService.setProviderKind()` both exist, are correct,
  and are covered by their own test suites
  (`tests/backup-service-provider.test.js`,
  `tests/reference-layer-service-provider.test.js`) — switching either
  service's provider to `'companion'` genuinely routes its reads/writes
  through `CompanionFileProvider` instead of the browser's File System
  Access API. **What does not exist is a caller.** There is no "Use
  Companion" checkbox in Backup Folder settings and none in the Reference
  panel; `CompanionDialog` covers pairing only, not per-feature provider
  choice. An artist can pair the companion today and it will do nothing for
  backups or the reference photo — those two features stay on the browser
  provider regardless of pairing state, until that UI is added. This is a
  known v1 gap, not a bug: the mechanism and its tests exist so the UI work
  is the only thing left.

## Non-goals for v1

Carried from the design spec, each a real future extension point rather
than a rejection:

- **Android.** No stock mechanism runs a persistent loopback server on an
  unrooted device without either Termux (an extra ask of the artist) or a
  dedicated APK (a second native project).
- **Push/live folder watching.** Nothing PixULA does today needs the
  companion to notify it of an external change; request/response HTTP is
  sufficient.
- **Code signing / notarization.** An unsigned binary triggers Gatekeeper
  (macOS) and SmartScreen (Windows) warnings on first run. Real friction,
  not solved here.

## Architecture

A `FileAccessProvider` interface (`js/services/file-access-provider.js`)
has two implementations that a feature can pick between independently:

- **`BrowserFSAProvider`** (`js/services/browser-fsa-provider.js`) — the
  File System Access API path. Remains the default for every feature.
- **`CompanionFileProvider`** (`js/services/companion-file-provider.js`) —
  talks to the companion binary over HTTP, using a bearer token supplied by
  `CompanionBridgeService`.

`CompanionBridgeService` (`js/services/companion-bridge-service.js`) owns
the connection state (running/paired/token), mirroring
`BackupService.needsPermission`'s shape so the rest of the app has one
error vocabulary for "an optional file-access backend isn't available
right now," whichever backend it is. `CompanionDialog`
(`js/ui/components/companion-dialog.js`, Settings > Companion...) is the
UI for that state: a status line, a Check Again button, and a Connect
button that starts pairing.

The companion process itself is a standalone Go binary
(`companion/`, one static binary per OS) exposing an HTTP server bound to
`127.0.0.1` only, plus a small native system-tray presence used solely for
the Enable Pairing action (`companion/tray.go`) — it is not a general
settings UI.

### Repo layout

```
companion/
  go.mod
  main.go        - entry point, binds 127.0.0.1:51973, starts the tray
  server.go       - HTTP routing, /status
  pairing.go      - pairing state machine (see below)
  folders.go      - folder authorization, path-safety, folder HTTP handlers
  fonts.go, fonts_windows.go, fonts_darwin.go, fonts_linux.go
                  - OS font enumeration, split by Go build tags
  tray.go         - the native window / tray icon with Enable Pairing
  *_test.go       - go test suite
  build.sh        - attempts all four v1 targets, see "Building" below
  README.md       - build/run instructions (authoritative; this doc links
                    to it rather than duplicating it)

js/services/
  file-access-provider.js      - shared provider interface
  browser-fsa-provider.js      - existing FSA logic, extracted behind it
  companion-file-provider.js   - HTTP client implementing the interface
  companion-bridge-service.js  - pairing/status state, EVENTS.*

js/ui/components/
  companion-dialog.js  - Settings > Companion..., pairing status only
                         (see "What works today" — no per-feature toggles)
```

## Security model

### Why the origin can't be checked

PixULA runs from `file://` with no build step and no server. A `file://`
page's Origin header is opaque/null, indistinguishable from any other
local HTML file open in the same browser, so Origin cannot be used as a
trust signal the way a real-origin web app (e.g. one checking
`Origin: https://example.com`) could. CORS is therefore opened
permissively; it provides no access control here by design. **The bearer
token is the entire access-control boundary.**

### Pairing: the Enable Pairing button

No code is typed or copied anywhere. The flow, as implemented
(`companion/pairing.go`):

1. The companion serves `GET /status` unauthenticated — an existence check
   only, it confers no trust.
2. PixULA, unpaired, sends `POST /pair`. The companion holds the
   connection open (long-poll) rather than responding immediately.
3. Nothing happens until the artist clicks **Enable Pairing** in the
   companion's own tray window — a click only a person physically at that
   window can produce; no web page can trigger it. This is the security
   property a typed code would provide, without the code, and arguably
   stronger: a malicious page can fake a "type this code here" prompt but
   cannot fake a click landing on a different process's native window.
4. On click, the companion resolves the (one) pending `/pair` request,
   mints a 32-byte random token (hex-encoded to 64 characters), and
   returns it. PixULA stores it (IndexedDB, via `Storage`) and sends it as
   `Authorization: Bearer <token>` on every subsequent request. Every
   authenticated route compares the token with `crypto/subtle`'s
   constant-time comparison, never `==`.
5. **The pairing arm window is 2 minutes** (`pairArmWindow` in
   `companion/pairing.go`). If Enable Pairing is not clicked within that
   window after arming, arming clears and the artist must click Connect
   again in PixULA to re-arm. Separately, a `/pair` request that has been
   waiting longer than its own long-poll timeout (3 minutes,
   `pairTimeout`) gives up and returns a 408 rather than hanging forever.
   `EnablePairing()` is idempotent against being invoked twice while
   already armed — calling it again while armed is a no-op rather than
   restarting or double-consuming the window (a real bug found and fixed
   during implementation).

**Residual risk, stated plainly:** if multiple tabs are racing a `/pair`
request at the moment Enable Pairing is clicked, whichever request the
companion happens to resolve first wins the token. This is an inherent
limit of any zero-origin-check local scheme, not specific to this design,
and no worse than the equivalent risk with a typed code (which is just as
phishable by a fake in-page prompt).

**Why arming is tray-click-only, not an HTTP route:** nothing in
`companion/pairing.go`'s HTTP surface can arm pairing — `EnablePairing()`
is only ever called from the tray click handler (or a test). If arming
were reachable over HTTP, any page that could reach `127.0.0.1:51973`
(which, given the open CORS policy, is any page in any tab) could arm and
then win its own pairing race without the artist doing anything. Routing
the one trust-conferring action through a click on a separate native
window — something no page can synthesize — is what makes the open CORS
policy above safe to accept rather than a hole.

### Path safety

PixULA never sends the companion a raw OS path. `POST /folders/choose`
opens the companion's own native OS folder picker (no File System Access
API involved) and returns an opaque `folderId`; only the companion maps
that id to a real path, held in its own in-memory state. Every subsequent
read/write/list/delete call is scoped to `folderId` + a relative path, and
`folderStore.Resolve()` (`companion/folders.go`) validates the result
before touching disk, in two layers:

1. **Lexical:** `filepath.Join` + `filepath.Abs` the candidate against the
   folder's root, and reject anything that doesn't stay under the root
   (both a `..`-traversal relative path and a spoofed absolute relative
   path are caught this way).
2. **Symlink-escape:** the lexical check alone doesn't protect against a
   symlink (or, on Windows, a junction/reparse point) sitting inside the
   authorized folder and pointing outside it — lexically the joined path
   stays under root, but the OS would follow the link and actually touch a
   file elsewhere. `Resolve()` additionally resolves symlinks on both the
   root and the target (walking up to the nearest existing ancestor when
   the target doesn't exist yet, e.g. a `PUT` creating a new file) and
   checks the *real* path against the *real* root too. This closes a real
   gap found beyond the original design's ".. traversal" language during
   implementation.

**Deliberately not closed:** there is a TOCTOU window between this check
and the actual `os.Open`/`os.Create`/`os.Remove` call — a symlink could
theoretically be swapped in between the check and the operation.
Closing that needs platform-specific `O_NOFOLLOW`-style opens and is
disproportionate for a v1 local, single-user companion process; it is a
known, accepted residual limitation, not a promise that the window is
closed.

Fonts are the one exception to all of this: `GET /fonts` enumerates fixed,
OS-defined font directories (not artist-chosen), so there is no folder
authorization step for that capability at all — it is read-only with no
concept of a chosen folder.

## HTTP API

Default port: **51973**, bound to `127.0.0.1` only (`companion/main.go`).
All endpoints except `/status` and `/pair` require
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/status` | Existence/version check, unauthenticated |
| POST | `/pair` | Long-poll pairing (see above) |
| POST | `/folders/choose` | Native folder picker -> `{folderId, label}` |
| GET | `/folders` | List authorized folders (id, label) |
| GET | `/folders/:id/list` | Directory listing (name, size, mtime) |
| GET | `/folders/:id/file/:relpath` | Read file bytes |
| PUT | `/folders/:id/file/:relpath` | Write file bytes |
| DELETE | `/folders/:id/file/:relpath` | Delete file (backup retention pruning) |
| GET | `/fonts` | Installed families -> `{fontId, family, style}[]` |
| GET | `/fonts/:id/file` | Raw font file bytes |

`js/services/companion-file-provider.js` implements a client method per
row: `chooseFolder`, `listFiles`, `readFile`, `writeFile`, `deleteFile`,
and (added for the system-font capability) `listFonts()` and
`readFontFile(fontId)`, which call the two `/fonts` routes.

## System fonts

The companion's role in the Font Editor's From System Font capability is
deliberately minimal: enumerate families (`GET /fonts`) and serve raw font
bytes (`GET /fonts/:id/file`) — no font-rendering code runs in the
companion at all. Rasterization happens entirely client-side: PixULA loads
the bytes with the standard `FontFace` API, the artist picks a point size
and cell width (4/6/8, matching `FontService`'s existing width model), and
glyphs are rendered to an offscreen canvas and thresholded into the same
row-byte bitmap format every other glyph source produces. Once generated,
it is a normal saved font — the text tool, warp/effects pipeline, and
library need zero changes.

Font enumeration is the one platform-divergent piece of the companion,
isolated behind Go build tags (`fonts_windows.go`, `fonts_darwin.go`,
`fonts_linux.go`).

## Failure behavior

| Condition | Behavior |
|---|---|
| Companion not running | `GET /status` fails to connect; feature reports unavailable, falls back to its normal browser-native path where one exists |
| Companion running, unpaired | Feature reports "not connected"; Companion dialog offers to pair |
| Token rejected (401) | Bridge clears the stored token, re-enters the unpaired state, surfaces the same "not connected" status |
| Path outside authorized folder (403) | Surfaced as an error on that specific operation; does not affect pairing state |

No condition here differs in kind from what `BackupService.needsPermission`
already models — this reuses that shape rather than inventing a second
error vocabulary.

## Building and running

`companion/README.md` is the authoritative build/run reference; this
section only summarizes the one thing worth knowing before you go there.

**Cross-compiling the companion for all four v1 targets from one machine
does not currently work, and this is a real, structural limitation, not a
bug to be fixed by more code here.** `companion/build.sh` attempts
Windows/amd64, macOS/amd64, macOS/arm64, and Linux/amd64 from whatever
host it runs on, and prints a pass/fail summary rather than assuming
success — as of 2026-08-19, only windows/amd64 reliably builds this way:

- The native folder picker depends on `github.com/sqweek/dialog`, whose
  macOS implementation needs cgo bindings into the Cocoa framework. That
  requires either building on an actual Mac or a macOS SDK/cross-toolchain
  this project doesn't set up — a structural fact about cross-compiling
  cgo to a different OS, not something fixable in this repo's own code.
- Cross-compiling to Linux from another OS currently fails for a different
  reason: without cgo enabled (the normal state when cross-compiling), Go
  falls back to `dialog`'s non-cgo Linux path, and that fallback has a bug
  in the pseudo-version this module resolves to (several call sites use
  lowercase, unexported method names where only the exported ones exist,
  so the package fails to compile). There is no tagged release of
  `sqweek/dialog` to pin around it (`go list -m -versions` returns none).

**In practice: building for macOS or Linux today requires running the
build natively on that OS**, where cgo and the real system toolchain
(Xcode command line tools / gcc-clang) are available and the working cgo
path is used instead of the broken fallback. `build.sh` run on Windows
will reliably produce only the Windows binary; run the same script again
on a Mac or Linux box to get that platform's binary. See
`companion/README.md` for the exact commands (`./build.sh`, `go test
./...`, `./dist/pixula-companion-<platform>`).

Binaries are build artifacts (`companion/dist/`, gitignored) — not
committed to the repo, matching `PixULA_Distilled/`'s convention for the
portable app build.

## Testing

- **`companion/*_test.go`** — Go's own `go test`, run separately from
  `node tests/run-all.js` (a different toolchain, not merged into the
  existing runner): pairing state machine, path-traversal and
  symlink-escape rejection, folder authorization.
- **`tests/backup-service-provider.test.js`,
  `tests/reference-layer-service-provider.test.js`,
  `tests/companion-bridge-service.test.js`,
  `tests/companion-file-provider.test.js`,
  `tests/storage-companion-store.test.js`** (Node, part of the normal
  `node tests/run-all.js` run) — provider switching, the bridge's own
  state transitions (unpaired -> pairing -> paired -> token-rejected ->
  re-pair), the HTTP client's request shaping, and token persistence, with
  no real companion process involved.
- **Manual** — an actual running companion binary, a real click on Enable
  Pairing, a real native folder-picker dialog, and real OS font
  enumeration are inherently unautomatable from this project's existing
  harnesses (`CLAUDE.md` already places pen/touch hardware and native
  file dialogs in this bucket). TESTLOG rows for this feature live in the
  same category, not as a gap specific to the companion.

## What this doc is not

It does not restate `companion/README.md`'s build/run steps beyond the
cross-compilation caveat above, and it does not walk through "how to make
backups use the companion" — that UI does not exist yet (see "What works
today"). When it lands, this doc is the place its own walkthrough belongs.
