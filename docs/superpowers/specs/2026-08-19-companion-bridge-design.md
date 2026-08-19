# Companion file-access bridge — design

Status: approved in chat, pending spec review. Written 2026-08-19.

## 1. Motivation

Every folder-linking feature PixULA has today (`BackupService`, the
reference-photo link in `ReferenceLayerService`/`ImageSource`) goes through
the browser's File System Access API. That API has two separate limits:

1. **Chromium desktop only re-prompts anyway.** A `FileSystemDirectoryHandle`
   survives in IndexedDB across reloads, but Chrome resets its permission to
   `'prompt'` on every browser restart and refuses to silently re-grant it —
   `requestPermission()` needs a live user gesture, which an autosave timer
   is not. This is why `BackupService.needsPermission` and the Resume
   Backups button exist (`js/services/backup-service.js`).
2. **Firefox, Safari, and Android Chrome don't implement the API at all.**
   Artists on those browsers have no folder-linking capability today, full
   stop — not a rougher version of what desktop Chrome has, nothing.

This spec adds an optional native companion process — a small local HTTP
server the artist can choose to run alongside PixULA — that solves both,
plus enables a new capability neither problem was blocking: using real
installed OS fonts as a source for PixULA's bitmap font editor.

**Hard constraint, carried through every decision below:** PixULA must
remain fully functional exactly as it is today with the companion never
installed. Nothing existing changes shape; the companion is purely additive
and per-feature opt-in.

## 2. Goals / non-goals

**Goals (v1):**
- Windows, Linux, macOS desktop.
- Backup folder and reference-photo link can optionally use the companion
  instead of File System Access API.
- A new "From System Font" capability in the Font Editor, backed by the
  companion enumerating and serving OS font files.
- Pairing with no typed code and no separate artifact (no browser
  extension) beyond the one companion binary.

**Explicit non-goals (v1), each a real future extension point, not a rejection:**
- **Android.** No stock mechanism runs a persistent loopback server on an
  unrooted device without either Termux (an extra ask of the artist) or a
  dedicated APK (a second native project). Deferred rather than solved
  awkwardly.
- **Push/live folder watching.** Nothing in the two retrofitted features or
  the font capability needs the companion to notify PixULA of an external
  change; request/response HTTP is sufficient. Folder watching (e.g. "this
  reference photo changed on disk") is a plausible future feature but is
  out of scope here.
- **Code signing / notarization.** An unsigned binary will trigger
  Gatekeeper (macOS) and SmartScreen (Windows) warnings on first run
  regardless of implementation language. Real friction, not solved by this
  spec — noted so it isn't discovered late.

## 3. Architecture

### 3.1 The provider abstraction

A new `FileAccessProvider` interface is introduced with two implementations:

- **`BrowserFSAProvider`** — today's File System Access API code, extracted
  from `BackupService`/`ReferenceLayerService` into a shared shape but
  behaviorally unchanged. Remains the default for every feature.
- **`CompanionFileProvider`** — new, talks to the companion over HTTP.

Each feature that links a folder picks its provider independently and can
switch per-link; switching to the companion is something the artist does
once per feature, not a global toggle. If the companion is not paired (or
not running), a feature configured to use it falls back to reporting
unavailable exactly the way `needsPermission` does today — never to a
broken or silently-degraded state.

### 3.2 The companion process

A standalone native process, **written in Go, built as one static binary
per OS** (Windows/Linux/macOS) via cross-compilation from a single
codebase. Chosen over a Node script (requires an installed runtime — too
much friction for an artist audience) and over a Deno/Bun compiled binary
(same "one file, no install" property, but ~80-100 MB per platform vs a few
MB for Go, and a less mature cross-compilation history). The tradeoff
accepted: the project gains a second language, isolated entirely to
`companion/`, which stays outside every existing lint/test rule scoped to
`js/`, `css/`, and `index.html`.

It exposes an HTTP server bound to `127.0.0.1` only (refuses non-loopback
connections) and, separately, a small native window used solely for the
pairing button and the list of authorized folders — it is not a general
settings UI.

### 3.3 Repo layout

```
companion/
  go.mod
  main.go            - HTTP server, routing
  pairing.go         - pairing state machine (see 4.2)
  folders.go         - folder authorization, path-safety
  fonts_windows.go    } OS-specific font enumeration,
  fonts_darwin.go     } selected by Go build tags
  fonts_linux.go      }
  *_test.go          - go test suite
  README.md          - build/run instructions

js/services/
  file-access-provider.js      - shared interface
  browser-fsa-provider.js      - existing FSA logic, extracted
  companion-file-provider.js   - new, HTTP client
  companion-bridge-service.js  - pairing/status state machine, EVENTS.*

js/ui/components/
  companion-dialog.js  - Settings > Companion..., pairing status,
                         authorized-folder list, per-feature "use
                         companion" toggles

docs/COMPANION.md      - protocol, security model, build/run (mirrors the
                         docs/PORTABLE_BUILDS.md pattern)
```

## 4. Security model

### 4.1 Why the origin can't be checked

PixULA runs from `file://` with no build step and no server (a hard
constraint of the project — see `CLAUDE.md`). A `file://` page's Origin
header is opaque/null, indistinguishable from any other local HTML file
open in the same browser. Every design choice below follows from not being
able to use Origin as a trust signal — unlike e.g. Figma's Font Helper,
which can check `Origin: https://www.figma.com` because Figma is served
over a real origin. CORS is therefore opened permissively
(`Access-Control-Allow-Origin: *`); it provides no access control here, and
the design does not pretend otherwise. The token (4.2) is the entire
access-control boundary.

### 4.2 Pairing: the Enable Pairing button

No code is typed or copied. The flow:

1. Companion serves `GET /status` unauthenticated (existence check only —
   no trust conferred).
2. PixULA, unpaired, sends `POST /pair`. The companion holds the connection
   open (long-poll) rather than responding immediately.
3. Nothing happens until the artist clicks **Enable Pairing** in the
   companion's own native window — a click that only a person physically at
   that window can produce; no web page can trigger it. This is the
   security property a typed code was providing, without the code — and
   arguably stronger, since a malicious page can fake a "type this code
   here" prompt but cannot fake a click landing on a different process's
   native window.
4. On click, the companion resolves the (one) pending `/pair` request,
   mints a token, and returns it. PixULA stores it in IndexedDB alongside
   its other state and sends it as a bearer token on every subsequent
   request.
5. If no request is pending within some short window after arming, or if
   the pending request itself times out unanswered, pairing mode
   auto-disarms rather than staying open indefinitely. **[A]** — the
   specific window (proposed ~2 minutes) is an assumption to be tuned
   during implementation, not a figure this design depends on.

**Residual risk, stated plainly:** if multiple tabs are racing a `/pair`
request at the moment Enable Pairing is clicked, whichever request the
companion happens to resolve first wins the token — an inherent limit of
any zero-origin-check local scheme, not specific to this design, and no
worse than the equivalent risk with a typed code (which is just as
phishable by a fake in-page prompt).

### 4.3 Path safety

PixULA never sends the companion a raw OS path. `POST /folders/choose`
opens the companion's own native OS folder picker (no File System Access
API involved at all) and returns an opaque `folderId`; the companion alone
maps that id to the real path, persisted in its own local state. Every
subsequent read/write/list/delete call is scoped to `folderId` +
relative-path, and the companion resolves and validates the result stays
within that folder, rejecting any `.. ` traversal attempt server-side.

Fonts are the one exception: `GET /fonts` enumerates fixed, OS-defined font
directories (not artist-chosen), so there is no folder authorization step
for that capability — it is read-only and has no concept of a chosen
folder.

## 5. HTTP API surface

All endpoints except `/status` and `/pair` require `Authorization: Bearer
<token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/status` | Existence/version check, unauthenticated |
| POST | `/pair` | Long-poll pairing (4.2) |
| POST | `/folders/choose` | Native folder picker -> `{folderId, label}` |
| GET | `/folders` | List authorized folders (id, label, kind) |
| GET | `/folders/:id/list` | Directory listing (name, size, mtime) |
| GET | `/folders/:id/file/:relpath` | Read file bytes |
| PUT | `/folders/:id/file/:relpath` | Write file bytes |
| DELETE | `/folders/:id/file/:relpath` | Delete file (backup retention pruning) |
| GET | `/fonts` | Installed families -> `{fontId, family, style}[]` |
| GET | `/fonts/:id/file` | Raw font file bytes |

## 6. Feature retrofits

### 6.1 Backup folder (`BackupService`)

Choosing the companion as the provider replaces the browser folder picker
with the companion's native one via `/folders/choose`, and every write
(`writeVersion`) and the read side of retention (`keepVersions` pruning via
`DELETE`) goes through the provider interface instead of
`FileSystemDirectoryHandle` calls directly. `needsPermission` becomes
provider-agnostic: "unavailable, here's why" rather than two divergent
error models. Version numbering (read off the folder listing, not
remembered — see `CLAUDE.md`) is unchanged in behavior, just sourced from
`GET /folders/:id/list` instead of iterating a `FileSystemDirectoryHandle`.

### 6.2 Reference photo link (`ReferenceLayerService` / `ImageSource`)

Same shape: the linked photo's `FileSystemFileHandle` becomes, when the
companion provider is chosen, a `folderId` + relative path pointing at the
photo's containing folder. The existing stand-in/thumbnail-fallback
behavior (`isStandIn`, the Locate Photo… button) is unchanged — it is
exactly as valid a fallback for "companion unreachable" as it already is
for "permission lapsed."

### 6.3 System fonts (new — `FontEditorDialog`)

A new **"From System Font"** row alongside the existing ROM/Capture/Import
rows. The companion's role is deliberately minimal: enumerate families
(`GET /fonts`) and serve raw font bytes (`GET /fonts/:id/file`) — no
font-rendering code runs in the companion at all. Rasterization happens
entirely client-side: PixULA loads the bytes with the standard `FontFace`
API, the artist picks a point size and cell width (4/6/8, matching
`FontService`'s existing width model), and glyphs are rendered to an
offscreen canvas and thresholded into the same `Uint8Array` row-byte format
every other glyph source produces (`FontService.set`, mirroring how
ROM/Capture already populate a bitmap font). Once generated, it is a normal
saved font — the text tool, warp/effects pipeline, and library all need
zero changes, because they already only understand the bitmap model.

OS-specific enumeration is the one platform-divergent piece of the
companion, isolated behind Go build tags (3.3): Windows font directories,
macOS `/System/Library/Fonts` + `/Library/Fonts` + `~/Library/Fonts`, Linux
via `fontconfig`/`fc-list` where present.

## 7. Failure behavior

| Condition | Behavior |
|---|---|
| Companion not running | `GET /status` fails to connect; feature reports unavailable, falls back to its normal browser-native path (FSA picker/prompt) |
| Companion running, unpaired | Feature reports "not connected"; Companion dialog offers to pair |
| Token rejected (401) | Bridge clears the stored token, re-enters the unpaired state, surfaces the same "not connected" status |
| Path outside authorized folder (403) | Surfaced as an error on that specific operation; does not affect pairing state |

No condition here differs in kind from what `BackupService.needsPermission`
already models — this reuses that shape rather than inventing a second
error vocabulary.

## 8. Testing

- **`companion/*_test.go`** (Go's own `go test`, run separately from `node
  tests/run-all.js` — a different toolchain, not merged into the existing
  runner): pairing state machine, path-traversal rejection, folder
  authorization.
- **`tests/companion-bridge.test.js`** (Node, stubbed `fetch`, same pattern
  as `tests/helpers/zx-stubs.js`): the bridge's own state transitions
  (unpaired -> pairing -> paired -> token-rejected -> re-pair) and
  request/response shaping, with no real companion process involved.
- **Playwright**: a spec driving the Companion dialog's UI states against a
  mocked `fetch` — pairing flow, "not connected" fallback messaging.
- **Manual**: an actual running companion binary, a real click on Enable
  Pairing, a real native folder-picker dialog, and real OS font enumeration
  are inherently unautomatable from this project's existing harnesses
  (`CLAUDE.md` already places pen/touch hardware and native file dialogs in
  this bucket) — new TESTLOG rows in the same category, not a gap specific
  to this feature.

## 9. Distribution (not fully specified here)

Binaries are build artifacts, not committed to the repo. Exact release
mechanism (e.g. GitHub Releases per platform) and the default HTTP port
**[A — not yet chosen; to be picked during implementation from the
49152-65535 dynamic/private range, checked against common local-dev-server
conflicts]** are implementation-plan decisions, not design decisions — they
don't change any interface or security property above.

## 10. Open questions carried into the implementation plan

- Exact default port and any user override mechanism if it's taken.
- Exact pairing-window timeout (currently [A], ~2 minutes).
- Whether `keepVersions` retention pruning logic moves into the companion
  or stays client-side issuing individual `DELETE` calls (leaning:
  stays client-side, unchanged from today, since it's pure policy that
  doesn't need to live server-side).
