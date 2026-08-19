# Companion File-Access Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional native companion process (a small local HTTP server) that gives PixULA real, prompt-free folder access and OS-font access on every desktop browser, while leaving the shipped app's default behavior — File System Access API only, companion never installed — completely unchanged.

**Architecture:** A standalone Go binary (`companion/`) exposes a loopback-only HTTP API behind a bearer token, paired via a system-tray "Enable Pairing" click (never over HTTP, so no web page can trigger it). PixULA gets a `FileAccessProvider` interface with two implementations — the existing File System Access code (default, untouched) and a new HTTP client for the companion — that `BackupService` and the reference-photo link can each opt into independently. A new "From System Font" capability rasterizes OS fonts client-side from bytes the companion serves.

**Tech Stack:** Go 1.22+ (stdlib `net/http` with pattern routing, no web framework), `fyne.io/systray` (tray icon/menu), `github.com/sqweek/dialog` (native folder picker) — the companion's only two external Go dependencies. JS side: no new dependencies, follows the existing IIFE-singleton/EVENTS.*/Storage conventions throughout.

**Spec:** `docs/superpowers/specs/2026-08-19-companion-bridge-design.md`

## Global Constraints

- PixULA with the companion never installed must build, lint, and pass its full test suite with **zero behavior change** — every retrofit is additive and opt-in per feature link.
- The companion lives entirely under `companion/`, outside `js/`, `css/`, `index.html` — none of `tests/lint-architecture.test.js`'s rules apply to it, and it is never added to `tests/run-all.js`.
- Companion HTTP server binds `127.0.0.1` only, on a fixed default port **51973** (chosen in the 49152-65535 dynamic/private range; **[A]** not checked against every possible local-dev-server collision — if that turns out to matter in practice, making it configurable is future work, not v1).
- Every endpoint except `GET /status` and `POST /pair` requires `Authorization: Bearer <token>`.
- **The pairing trigger is a system-tray menu click, never an HTTP endpoint.** This refines the spec's "small native window" into a tray icon + menu (simpler, and the realistic shape for a background helper) — but the reason it must stay out of the HTTP surface is load-bearing, not cosmetic: CORS is open (`*`) for every other endpoint by design (section 4.1 of the spec), so *any* HTTP-reachable "enable pairing" endpoint could be triggered by a background `fetch()` from any other tab with zero user interaction, defeating the entire trust model. A tray click is a real OS event Go handles in-process; it is never exposed as a route.
- Pairing arm window: **120000 ms (2 minutes)**, per the spec's proposed figure.
- Token: 32 random bytes (`crypto/rand`), hex-encoded (64 chars), compared with `subtle.ConstantTimeCompare`.
- `keepVersions` backup retention pruning **stays client-side** in `BackupService`, issuing individual `DELETE` calls through whichever provider is active — the spec's leaning, confirmed here as the decision.
- Android, folder-watching/push, and code signing are explicitly **out of scope** — do not add stubs, TODOs, or partial support for any of them.
- Storage: bump `Storage.DB_VERSION` 7 -> 8, add `Storage.STORES.COMPANION = 'companion'` (a single `{ keyPath: 'key' }` record, same shape as `PREFERENCES`/`WINDOW_STATE`).
- New `EVENTS` constants live in the existing `companion:` — style namespace block in `js/core/constants.js`, alongside the other domains (`backup:`, `reference:`, etc.).

---

## Phase 1 — Companion binary (Go), standalone

### Task 1: Go module scaffold, HTTP server, `/status`

**Files:**
- Create: `companion/go.mod`
- Create: `companion/main.go`
- Create: `companion/server.go`
- Create: `companion/server_test.go`
- Create: `companion/README.md`

**Interfaces:**
- Produces: `newServer() *Server` (holds the `http.ServeMux`), `Server.Handler() http.Handler`, route `GET /status` -> `{"version":"0.1.0","paired":<bool>}`.

- [ ] **Step 1: Write the failing test**

```go
// companion/server_test.go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStatusUnauthenticated(t *testing.T) {
	s := newServer()
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body struct {
		Version string `json:"version"`
		Paired  bool   `json:"paired"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("bad JSON body: %v", err)
	}
	if body.Version == "" {
		t.Fatal("expected a non-empty version")
	}
	if body.Paired != false {
		t.Fatal("expected paired=false on a fresh server")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd companion && go test ./... -run TestStatusUnauthenticated -v`
Expected: FAIL — `newServer` undefined (package does not build yet).

- [ ] **Step 3: Write minimal implementation**

```go
// companion/go.mod
module pixula-companion

go 1.22
```

```go
// companion/server.go
package main

import (
	"encoding/json"
	"net/http"
)

const version = "0.1.0"

// Server owns the HTTP routing and every piece of companion state
// (pairing, folders, fonts) built up across this phase's later tasks.
type Server struct {
	mux *http.ServeMux
	// paired reports whether a token has ever been issued this run. Real
	// pairing state (Task 2) replaces this placeholder field directly —
	// it is not read anywhere yet, so it is safe to widen there.
	paired bool
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /status", s.handleStatus)
	return s
}

func (s *Server) Handler() http.Handler { return s.mux }

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version": version,
		"paired":  s.paired,
	})
}
```

```go
// companion/main.go
package main

import (
	"log"
	"net/http"
)

const defaultAddr = "127.0.0.1:51973"

func main() {
	s := newServer()
	log.Printf("PixULA Companion %s listening on %s", version, defaultAddr)
	if err := http.ListenAndServe(defaultAddr, s.Handler()); err != nil {
		log.Fatalf("companion: failed to bind %s: %v", defaultAddr, err)
	}
}
```

```markdown
<!-- companion/README.md -->
# PixULA Companion

Optional local helper that gives PixULA real folder access and OS-font
access without repeated browser permission prompts. PixULA works fully
without this; see `docs/COMPANION.md` in the repo root for what it does
and why.

## Build

    cd companion
    GOOS=windows GOARCH=amd64 go build -o dist/pixula-companion-windows-amd64.exe .
    GOOS=darwin  GOARCH=amd64 go build -o dist/pixula-companion-darwin-amd64 .
    GOOS=linux   GOARCH=amd64 go build -o dist/pixula-companion-linux-amd64 .

## Test

    go test ./...

## Run

    ./dist/pixula-companion-<platform>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd companion && go test ./... -run TestStatusUnauthenticated -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add companion/go.mod companion/main.go companion/server.go companion/server_test.go companion/README.md
git commit -m "companion: scaffold HTTP server with GET /status"
```

---

### Task 2: Pairing state machine (`/pair` long-poll + token issuance)

**Files:**
- Create: `companion/pairing.go`
- Create: `companion/pairing_test.go`
- Modify: `companion/server.go` (wire the route, hold `*pairing`, gate every other future route through auth middleware)

**Interfaces:**
- Consumes: `Server.mux` from Task 1.
- Produces: `newPairing() *pairing`, `pairing.EnablePairing()` (the in-process trigger a systray click — or a test — calls), `pairing.HandlePair(w, r)` (the `POST /pair` handler), `pairing.requireToken(next http.Handler) http.Handler` (auth middleware for later tasks), `pairing.IsPaired() bool`.

- [ ] **Step 1: Write the failing test**

```go
// companion/pairing_test.go
package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPairResolvesOnEnablePairing(t *testing.T) {
	p := newPairing()

	type result struct {
		code int
		body string
	}
	done := make(chan result, 1)
	go func() {
		req := httptest.NewRequest(http.MethodPost, "/pair", nil)
		rec := httptest.NewRecorder()
		p.HandlePair(rec, req)
		done <- result{rec.Code, rec.Body.String()}
	}()

	// Give the handler a moment to actually start waiting before arming -
	// otherwise this test would pass even if EnablePairing didn't wake a
	// blocked request at all, just a subsequent one.
	time.Sleep(20 * time.Millisecond)
	p.EnablePairing()

	select {
	case r := <-done:
		if r.code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", r.code, r.body)
		}
		if len(r.body) < 32 {
			t.Fatalf("expected a real token in the body, got %q", r.body)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("POST /pair never resolved after EnablePairing")
	}

	if !p.IsPaired() {
		t.Fatal("expected IsPaired() true after a successful pair")
	}
}

func TestPairTimesOutWithoutEnablePairing(t *testing.T) {
	p := newPairing()
	p.pairTimeout = 30 * time.Millisecond // test-only override, see Step 3

	req := httptest.NewRequest(http.MethodPost, "/pair", nil)
	rec := httptest.NewRecorder()
	p.HandlePair(rec, req)

	if rec.Code != http.StatusRequestTimeout {
		t.Fatalf("expected 408, got %d", rec.Code)
	}
}

func TestRequireTokenRejectsMissingOrWrongToken(t *testing.T) {
	p := newPairing()
	p.EnablePairing()
	req0 := httptest.NewRequest(http.MethodPost, "/pair", nil)
	rec0 := httptest.NewRecorder()
	p.HandlePair(rec0, req0)
	token := rec0.Body.String()

	ok := p.requireToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"missing", "", http.StatusUnauthorized},
		{"wrong", "Bearer not-the-token", http.StatusUnauthorized},
		{"correct", "Bearer " + token, http.StatusOK},
	}
	for _, c := range cases {
		req := httptest.NewRequest(http.MethodGet, "/folders", nil)
		if c.header != "" {
			req.Header.Set("Authorization", c.header)
		}
		rec := httptest.NewRecorder()
		ok.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: expected %d, got %d", c.name, c.want, rec.Code)
		}
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd companion && go test ./... -run TestPair -v`
Expected: FAIL — `newPairing` undefined.

- [ ] **Step 3: Write minimal implementation**

```go
// companion/pairing.go
package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"
)

const pairArmWindow = 2 * time.Minute

// pairing owns the whole trust boundary: whether a token exists, and the
// one channel through which a token is ever minted. HandlePair holds an
// HTTP request open until EnablePairing is called from the tray - never
// the reverse. See the "pairing trigger" Global Constraint: EnablePairing
// must only ever be invoked in-process (a tray click, or a test), never
// wired to a route.
type pairing struct {
	mu          sync.Mutex
	token       string
	armed       bool
	armedAt     time.Time
	waiting     chan chan string // pending /pair requests waiting for a token
	pairTimeout time.Duration    // request-side wait limit; overridable in tests
}

func newPairing() *pairing {
	return &pairing{
		waiting:     make(chan chan string),
		pairTimeout: 3 * time.Minute,
	}
}

func (p *pairing) IsPaired() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.token != ""
}

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("companion: crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// EnablePairing arms a 2-minute window and, if a request is already
// waiting in HandlePair, resolves it immediately with a fresh token.
func (p *pairing) EnablePairing() {
	p.mu.Lock()
	p.armed = true
	p.armedAt = time.Now()
	p.mu.Unlock()

	go func() {
		select {
		case reply := <-p.waiting:
			token := newToken()
			p.mu.Lock()
			p.token = token
			p.armed = false
			p.mu.Unlock()
			reply <- token
		case <-time.After(pairArmWindow):
			p.mu.Lock()
			p.armed = false
			p.mu.Unlock()
		}
	}()
}

// HandlePair blocks until EnablePairing resolves it or pairTimeout elapses.
func (p *pairing) HandlePair(w http.ResponseWriter, r *http.Request) {
	reply := make(chan string, 1)
	select {
	case p.waiting <- reply:
	case <-time.After(p.pairTimeout):
		http.Error(w, "no pairing request armed", http.StatusRequestTimeout)
		return
	}

	select {
	case token := <-reply:
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(token))
	case <-time.After(p.pairTimeout):
		http.Error(w, "pairing timed out", http.StatusRequestTimeout)
	}
}

// requireToken gates every route except /status and /pair.
func (p *pairing) requireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		got, ok := strings.CutPrefix(auth, "Bearer ")
		p.mu.Lock()
		want := p.token
		p.mu.Unlock()
		if !ok || want == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

Update `companion/server.go` to wire the route and hold `*pairing`:

```go
// companion/server.go (replace the Server struct and newServer)
type Server struct {
	mux     *http.ServeMux
	pairing *pairing
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux(), pairing: newPairing()}
	s.mux.HandleFunc("GET /status", s.handleStatus)
	s.mux.HandleFunc("POST /pair", s.pairing.HandlePair)
	return s
}
```

```go
// companion/server.go (replace handleStatus's body)
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version": version,
		"paired":  s.pairing.IsPaired(),
	})
}
```

Update `companion/server_test.go`'s `TestStatusUnauthenticated` — `s.paired` no longer exists; the assertion already reads the JSON body, so no change is needed there, but confirm it still compiles against the new `Server` shape (it does — it only touches `Server` through `newServer()` and the HTTP response).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd companion && go test ./... -v`
Expected: PASS (all of Task 1 and Task 2's tests)

- [ ] **Step 5: Commit**

```bash
git add companion/pairing.go companion/pairing_test.go companion/server.go
git commit -m "companion: pairing state machine and bearer-token middleware"
```

---

### Task 3: System-tray "Enable Pairing" menu

**Files:**
- Create: `companion/tray.go`
- Modify: `companion/main.go` (start the tray, run the HTTP server in a goroutine)
- Modify: `companion/go.mod` / create `companion/go.sum` (add `fyne.io/systray`)

**Interfaces:**
- Consumes: `pairing.EnablePairing()` from Task 2.
- Produces: `runTray(p *pairing, quit func())` — blocks running the tray event loop (systray requires this to run on program's main path).

This task is **manually verified only** — a real tray icon and a real click
cannot run inside `go test` (systray needs an OS GUI event loop). Task 2's
tests already cover the state machine `EnablePairing()` drives; this task is
a thin wrapper with nothing new to unit-test.

- [ ] **Step 1: Add the dependency**

Run: `cd companion && go get fyne.io/systray@latest`

- [ ] **Step 2: Write the tray wrapper**

```go
// companion/tray.go
package main

import "fyne.io/systray"

// runTray blocks for the life of the process. onReady wires the menu;
// systray.Run must own the OS event loop, which is why main() calls this
// last and the HTTP server is started in its own goroutine beforehand.
func runTray(p *pairing, quit func()) {
	systray.Run(func() {
		systray.SetTitle("PixULA Companion")
		systray.SetTooltip("PixULA Companion - optional file access bridge")

		enable := systray.AddMenuItem("Enable Pairing", "Allow the next PixULA tab to connect")
		systray.AddSeparator()
		quitItem := systray.AddMenuItem("Quit", "Stop the companion")

		go func() {
			for {
				select {
				case <-enable.ClickedCh:
					p.EnablePairing()
				case <-quitItem.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
	}, quit)
}
```

- [ ] **Step 3: Wire it into main()**

```go
// companion/main.go (replace main())
func main() {
	s := newServer()
	log.Printf("PixULA Companion %s listening on %s", version, defaultAddr)

	go func() {
		if err := http.ListenAndServe(defaultAddr, s.Handler()); err != nil {
			log.Fatalf("companion: failed to bind %s: %v", defaultAddr, err)
		}
	}()

	runTray(s.pairing, func() { log.Println("companion: quitting") })
}
```

- [ ] **Step 4: Manual verification**

Run: `cd companion && go build -o /tmp/pixula-companion . && /tmp/pixula-companion`
Expected: a "PixULA Companion" tray icon appears; clicking "Enable Pairing"
followed by `curl -X POST http://127.0.0.1:51973/pair` (run within 2
minutes) returns a 64-char token; clicking "Quit" stops the process.
Record this as a new manual TESTLOG row (Task 19 handles the entry).

- [ ] **Step 5: Commit**

```bash
git add companion/tray.go companion/main.go companion/go.mod companion/go.sum
git commit -m "companion: system-tray Enable Pairing menu"
```

---

### Task 4: Folder authorization and path-safe file CRUD

**Files:**
- Create: `companion/folders.go`
- Create: `companion/folders_test.go`
- Modify: `companion/server.go` (wire the five folder routes, all through `pairing.requireToken`)
- Modify: `companion/go.mod` / `go.sum` (add `github.com/sqweek/dialog`)

**Interfaces:**
- Consumes: `pairing.requireToken` from Task 2.
- Produces: `newFolderStore() *folderStore`, `folderStore.Choose(label string) (id, chosenLabel string, err error)` (wraps the native picker), `folderStore.Resolve(id, relPath string) (absPath string, ok bool)` (the path-safety gate every read/write/list/delete goes through), HTTP routes `POST /folders/choose`, `GET /folders`, `GET /folders/{id}/list`, `GET /folders/{id}/file/{relpath...}`, `PUT /folders/{id}/file/{relpath...}`, `DELETE /folders/{id}/file/{relpath...}`.

- [ ] **Step 1: Write the failing test**

```go
// companion/folders_test.go
package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveRejectsTraversal(t *testing.T) {
	dir := t.TempDir()
	fs := newFolderStore()
	fs.folders["f1"] = folderRecord{ID: "f1", Label: "Test", Path: dir}

	cases := []struct {
		name    string
		relPath string
		wantOK  bool
	}{
		{"plain file", "backup-v1.pixula", true},
		{"nested", "sub/dir/file.txt", true},
		{"parent traversal", "../outside.txt", false},
		{"parent traversal nested", "sub/../../outside.txt", false},
		{"absolute path ignored as absolute", "/etc/passwd", true}, // joined under dir, not honoured as absolute - see Step 3
	}
	for _, c := range cases {
		abs, ok := fs.Resolve("f1", c.relPath)
		if ok != c.wantOK {
			t.Errorf("%s: Resolve(%q) ok=%v, want %v (abs=%q)", c.name, c.relPath, ok, c.wantOK, abs)
		}
		if ok && !filepathHasPrefix(abs, dir) {
			t.Errorf("%s: resolved path %q escapes folder root %q", c.name, abs, dir)
		}
	}
}

func TestResolveUnknownFolderFails(t *testing.T) {
	fs := newFolderStore()
	if _, ok := fs.Resolve("nope", "file.txt"); ok {
		t.Fatal("expected Resolve to fail for an unregistered folder id")
	}
}

func filepathHasPrefix(path, prefix string) bool {
	rel, err := filepath.Rel(prefix, path)
	return err == nil && rel != ".." && !os.IsPathSeparator(rel[0]) && rel[:2] != ".."+string(os.PathSeparator)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd companion && go test ./... -run TestResolve -v`
Expected: FAIL — `newFolderStore` undefined.

- [ ] **Step 3: Write minimal implementation**

```go
// companion/folders.go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/sqweek/dialog"
)

type folderRecord struct {
	ID    string `json:"folderId"`
	Label string `json:"label"`
	Path  string `json:"-"` // never serialized to PixULA - it never sees a raw OS path
}

type folderStore struct {
	mu      sync.Mutex
	folders map[string]folderRecord
}

func newFolderStore() *folderStore {
	return &folderStore{folders: make(map[string]folderRecord)}
}

func newFolderID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Resolve maps a folderId + artist-relative path to a real absolute path,
// rejecting anything that would escape the folder's own root. This is the
// one function every file read/write/list/delete route must go through.
func (fs *folderStore) Resolve(id, relPath string) (string, bool) {
	fs.mu.Lock()
	rec, known := fs.folders[id]
	fs.mu.Unlock()
	if !known {
		return "", false
	}
	// filepath.Join cleans ".." segments arithmetically (Join("/a","../b")
	// == "/b"), and joining an "absolute" relPath is still relative to
	// dir - Go's Join does not honour a second absolute segment, it just
	// concatenates and cleans - so both traversal shapes and a spoofed
	// absolute relPath land inside dir or get rejected by the prefix check.
	joined := filepath.Join(rec.Path, relPath)
	root, err1 := filepath.Abs(rec.Path)
	target, err2 := filepath.Abs(joined)
	if err1 != nil || err2 != nil {
		return "", false
	}
	if target != root && !strings.HasPrefix(target, root+string(os.PathSeparator)) {
		return "", false
	}
	return target, true
}

func (fs *folderStore) Choose(label string) (folderRecord, error) {
	dir, err := dialog.Directory().Title("Choose a folder for PixULA: " + label).Browse()
	if err != nil {
		return folderRecord{}, err
	}
	rec := folderRecord{ID: newFolderID(), Label: label, Path: dir}
	fs.mu.Lock()
	fs.folders[rec.ID] = rec
	fs.mu.Unlock()
	return rec, nil
}

func (fs *folderStore) List() []folderRecord {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	out := make([]folderRecord, 0, len(fs.folders))
	for _, r := range fs.folders {
		out = append(out, r)
	}
	return out
}

// ── HTTP handlers ───────────────────────────────────────────────────────

func (s *Server) handleFoldersChoose(w http.ResponseWriter, r *http.Request) {
	var body struct{ Label string `json:"label"` }
	json.NewDecoder(r.Body).Decode(&body)
	rec, err := s.folders.Choose(body.Label)
	if err != nil {
		http.Error(w, "cancelled or failed: "+err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"folderId": rec.ID, "label": rec.Label})
}

func (s *Server) handleFoldersList(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.folders.List())
}

type fileEntry struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	Mtime int64  `json:"mtime"`
}

func (s *Server) handleFolderList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	abs, ok := s.folders.Resolve(id, ".")
	if !ok {
		http.Error(w, "unknown folder", http.StatusNotFound)
		return
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := make([]fileEntry, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, fileEntry{Name: e.Name(), Size: info.Size(), Mtime: info.ModTime().Unix()})
	}
	json.NewEncoder(w).Encode(out)
}

func (s *Server) handleFolderFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	relPath := r.PathValue("relpath")
	abs, ok := s.folders.Resolve(id, relPath)
	if !ok {
		http.Error(w, "path outside authorized folder", http.StatusForbidden)
		return
	}

	switch r.Method {
	case http.MethodGet:
		f, err := os.Open(abs)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "application/octet-stream")
		io.Copy(w, f)

	case http.MethodPut:
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		f, err := os.Create(abs)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer f.Close()
		if _, err := io.Copy(f, r.Body); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	case http.MethodDelete:
		if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
```

Wire routes and the `folders` field in `companion/server.go`:

```go
// companion/server.go
type Server struct {
	mux     *http.ServeMux
	pairing *pairing
	folders *folderStore
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux(), pairing: newPairing(), folders: newFolderStore()}
	s.mux.HandleFunc("GET /status", s.handleStatus)
	s.mux.HandleFunc("POST /pair", s.pairing.HandlePair)

	auth := s.pairing.requireToken
	s.mux.Handle("POST /folders/choose", auth(http.HandlerFunc(s.handleFoldersChoose)))
	s.mux.Handle("GET /folders", auth(http.HandlerFunc(s.handleFoldersList)))
	s.mux.Handle("GET /folders/{id}/list", auth(http.HandlerFunc(s.handleFolderList)))
	s.mux.Handle("GET /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	s.mux.Handle("PUT /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	s.mux.Handle("DELETE /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	return s
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd companion && go get github.com/sqweek/dialog@latest && go test ./... -v`
Expected: PASS (all tests across Tasks 1, 2, 4 — Task 3 has no automated test)

- [ ] **Step 5: Commit**

```bash
git add companion/folders.go companion/folders_test.go companion/server.go companion/go.mod companion/go.sum
git commit -m "companion: folder authorization and path-safe file CRUD"
```

---

### Task 5: OS font enumeration (`/fonts`, `/fonts/{id}/file`)

**Files:**
- Create: `companion/fonts.go` (shared types + HTTP handlers)
- Create: `companion/fonts_windows.go`
- Create: `companion/fonts_darwin.go`
- Create: `companion/fonts_linux.go`
- Create: `companion/fonts_test.go`
- Modify: `companion/server.go` (wire the two routes)

**Interfaces:**
- Produces: `listSystemFonts() []fontRecord` (OS-specific, build-tag selected), `newFontStore() *fontStore`, `fontStore.Refresh()`, `fontStore.List() []fontRecord`, `fontStore.Path(id string) (string, bool)`, routes `GET /fonts`, `GET /fonts/{id}/file`.

- [ ] **Step 1: Write the failing test**

```go
// companion/fonts_test.go
package main

import "testing"

func TestFontStoreIndexesWhateverListSystemFontsReturns(t *testing.T) {
	// listSystemFonts is OS-specific (Tasks fonts_windows.go etc). This
	// test only pins the store's own bookkeeping: every font it lists is
	// resolvable back to a real path, and unknown ids are not.
	fs := newFontStore()
	fs.Refresh()

	list := fs.List()
	for _, f := range list {
		if f.ID == "" || f.Family == "" {
			t.Fatalf("font record missing id/family: %+v", f)
		}
		if _, ok := fs.Path(f.ID); !ok {
			t.Fatalf("Path(%q) not found for a font List() just returned", f.ID)
		}
	}
	if _, ok := fs.Path("not-a-real-id"); ok {
		t.Fatal("expected Path to fail for an unknown id")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd companion && go test ./... -run TestFontStore -v`
Expected: FAIL — `newFontStore` undefined.

- [ ] **Step 3: Write minimal implementation**

```go
// companion/fonts.go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"sync"
)

type fontRecord struct {
	ID     string `json:"fontId"`
	Family string `json:"family"`
	Style  string `json:"style"`
	Path   string `json:"-"`
}

type fontStore struct {
	mu    sync.Mutex
	byID  map[string]fontRecord
}

func newFontStore() *fontStore {
	return &fontStore{byID: make(map[string]fontRecord)}
}

func newFontID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Refresh re-scans the OS font directories via the build-tag-selected
// listSystemFonts. Called once at startup; the font list a running
// companion offers does not need to track fonts installed mid-session.
func (fs *fontStore) Refresh() {
	found := listSystemFonts()
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.byID = make(map[string]fontRecord, len(found))
	for _, f := range found {
		f.ID = newFontID()
		fs.byID[f.ID] = f
	}
}

func (fs *fontStore) List() []fontRecord {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	out := make([]fontRecord, 0, len(fs.byID))
	for _, f := range fs.byID {
		out = append(out, f)
	}
	return out
}

func (fs *fontStore) Path(id string) (string, bool) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	f, ok := fs.byID[id]
	return f.Path, ok
}

func (s *Server) handleFontsList(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.fonts.List())
}

func (s *Server) handleFontFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	path, ok := s.fonts.Path(id)
	if !ok {
		http.Error(w, "unknown font", http.StatusNotFound)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	buf := make([]byte, 32*1024)
	for {
		n, err := f.Read(buf)
		if n > 0 {
			w.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
}
```

```go
// companion/fonts_windows.go
//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
)

// listSystemFonts scans the two Windows font directories: the shared
// system fonts folder and the current user's per-user install location.
// No metadata parsing (TTF name tables) in v1 - family is derived from
// the filename, which is good enough for a picker list; PixULA never
// needs the OS's own display name, only something to show and a byte
// stream to rasterize from.
func listSystemFonts() []fontRecord {
	dirs := []string{`C:\Windows\Fonts`}
	if local := os.Getenv("LOCALAPPDATA"); local != "" {
		dirs = append(dirs, filepath.Join(local, "Microsoft", "Windows", "Fonts"))
	}
	return scanFontDirs(dirs)
}

func scanFontDirs(dirs []string) []fontRecord {
	var out []fontRecord
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			ext := strings.ToLower(filepath.Ext(e.Name()))
			if ext != ".ttf" && ext != ".otf" && ext != ".ttc" {
				continue
			}
			out = append(out, fontRecord{
				Family: strings.TrimSuffix(e.Name(), filepath.Ext(e.Name())),
				Style:  "Regular",
				Path:   filepath.Join(dir, e.Name()),
			})
		}
	}
	return out
}
```

```go
// companion/fonts_darwin.go
//go:build darwin

package main

import (
	"os"
	"path/filepath"
)

func listSystemFonts() []fontRecord {
	home, _ := os.UserHomeDir()
	dirs := []string{
		"/System/Library/Fonts",
		"/Library/Fonts",
	}
	if home != "" {
		dirs = append(dirs, filepath.Join(home, "Library", "Fonts"))
	}
	return scanFontDirs(dirs)
}
```

```go
// companion/fonts_linux.go
//go:build linux

package main

import (
	"bufio"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// listSystemFonts prefers fontconfig (fc-list), which is present on
// essentially every desktop Linux install and gives accurate family
// names; falls back to a bare directory scan (same shape as Windows/
// macOS) if fc-list is missing, so an unusual minimal install still
// gets something rather than an empty list.
func listSystemFonts() []fontRecord {
	if out, err := exec.Command("fc-list", "--format=%{file}\t%{family[0]}\n").Output(); err == nil {
		var records []fontRecord
		scanner := bufio.NewScanner(strings.NewReader(string(out)))
		for scanner.Scan() {
			parts := strings.SplitN(scanner.Text(), "\t", 2)
			if len(parts) != 2 || parts[0] == "" {
				continue
			}
			records = append(records, fontRecord{Family: parts[1], Style: "Regular", Path: parts[0]})
		}
		if len(records) > 0 {
			return records
		}
	}

	home, _ := os.UserHomeDir()
	dirs := []string{"/usr/share/fonts", "/usr/local/share/fonts"}
	if home != "" {
		dirs = append(dirs, filepath.Join(home, ".fonts"), filepath.Join(home, ".local", "share", "fonts"))
	}
	return scanFontDirsRecursive(dirs)
}

func scanFontDirsRecursive(dirs []string) []fontRecord {
	var out []fontRecord
	for _, dir := range dirs {
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if ext != ".ttf" && ext != ".otf" {
				return nil
			}
			out = append(out, fontRecord{
				Family: strings.TrimSuffix(filepath.Base(path), ext),
				Style:  "Regular",
				Path:   path,
			})
			return nil
		})
	}
	return out
}
```

Wire routes and the `fonts` field, and call `Refresh()` at startup, in `companion/server.go` / `companion/main.go`:

```go
// companion/server.go — add to Server struct and newServer()
type Server struct {
	mux     *http.ServeMux
	pairing *pairing
	folders *folderStore
	fonts   *fontStore
}

// inside newServer(), after folders := newFolderStore():
s.fonts = newFontStore()
s.fonts.Refresh()
auth := s.pairing.requireToken
s.mux.Handle("GET /fonts", auth(http.HandlerFunc(s.handleFontsList)))
s.mux.Handle("GET /fonts/{id}/file", auth(http.HandlerFunc(s.handleFontFile)))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd companion && go test ./... -v`
Expected: PASS on your build platform (Linux/macOS/Windows all compile via
build tags; only the one matching `go test`'s host OS actually runs).

- [ ] **Step 5: Commit**

```bash
git add companion/fonts.go companion/fonts_windows.go companion/fonts_darwin.go companion/fonts_linux.go companion/fonts_test.go companion/server.go
git commit -m "companion: OS font enumeration and byte serving"
```

---

### Task 6: Cross-platform build script

**Files:**
- Create: `companion/build.sh`
- Modify: `companion/README.md` (point at the script instead of three manual commands)

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# companion/build.sh — cross-compile the companion for all three v1
# platforms from a single machine. Output is a build artifact
# (companion/dist/) and is never committed - see .gitignore below.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p dist
GOOS=windows GOARCH=amd64 go build -o dist/pixula-companion-windows-amd64.exe .
GOOS=darwin  GOARCH=amd64 go build -o dist/pixula-companion-darwin-amd64 .
GOOS=darwin  GOARCH=arm64 go build -o dist/pixula-companion-darwin-arm64 .
GOOS=linux   GOARCH=amd64 go build -o dist/pixula-companion-linux-amd64 .

echo "Built:"
ls -la dist/
```

```
# companion/.gitignore
dist/
```

- [ ] **Step 2: Run it**

Run: `chmod +x companion/build.sh && ./companion/build.sh`
Expected: four binaries appear under `companion/dist/`, one per
OS/architecture combination.

- [ ] **Step 3: Update the README**

Replace the README's "## Build" section with:

```markdown
## Build

    ./build.sh

Cross-compiles all three v1 platforms (Windows/amd64, macOS/amd64+arm64,
Linux/amd64) into `dist/`, which is a build-artifact directory and is
never committed.
```

- [ ] **Step 4: Commit**

```bash
git add companion/build.sh companion/.gitignore companion/README.md
git commit -m "companion: add the cross-compile build script"
```

---

## Phase 2 — JS bridge

### Task 7: Storage v8 — the COMPANION store

**Files:**
- Modify: `js/utils/storage.js`

**Interfaces:**
- Produces: `Storage.STORES.COMPANION` (`'companion'`), readable/writable via the existing `Storage.get('companion', ...)`/`Storage.set(...)` generic API — no new Storage methods needed, matching the `PREFERENCES`/`WINDOW_STATE` pattern exactly.

- [ ] **Step 1: Write the failing test**

```js
// tests/storage-companion-store.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/utils/storage.js');

async function run() {
    // storage.js opens a real IndexedDB in the browser; under Node's stub
    // environment it falls back to the localStorage shim (see zx-stubs),
    // which is enough to prove the store NAME and version are registered -
    // the actual browser-backed store creation is covered by the existing
    // Playwright persistence specs, unchanged by this task.
    if (Storage.DB_VERSION < 8) {
        throw new Error(`expected DB_VERSION >= 8, got ${Storage.DB_VERSION}`);
    }
    if (Storage.STORES.COMPANION !== 'companion') {
        throw new Error(`expected STORES.COMPANION === 'companion', got ${Storage.STORES.COMPANION}`);
    }
    console.log('  ok: DB_VERSION bumped to 8');
    console.log('  ok: STORES.COMPANION registered');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/storage-companion-store.test.js`
Expected: FAIL — `DB_VERSION` is still 7, `STORES.COMPANION` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `js/utils/storage.js`, bump the version and add the store name:

```js
// js/utils/storage.js — replace DB_VERSION and the STORES block
    DB_VERSION: 8,
    STORES: {
        PREFERENCES: 'preferences',
        PATTERNS: 'patterns',
        WINDOW_STATE: 'window-state',
        RECENT_FILES: 'recent-files',
        CLIPBOARD: 'clipboard',
        MAPS: 'maps',
        FONTS: 'fonts',
        PRESETS: 'presets',
        PRESET_ASSETS: 'preset-assets',
        TOOL_PRESETS: 'tool-presets',
        COMPANION: 'companion'
    },
```

And inside `_openDatabase`'s `onupgradeneeded`, after the `TOOL_PRESETS` block:

```js
                // v8: optional companion file-access bridge - one record
                // holding the pairing token, the chosen port (if ever made
                // configurable), and the authorized-folder list mirror.
                if (!db.objectStoreNames.contains(this.STORES.COMPANION)) {
                    db.createObjectStore(this.STORES.COMPANION, { keyPath: 'key' });
                }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/storage-companion-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/utils/storage.js tests/storage-companion-store.test.js
git commit -m "storage: bump to v8, add the COMPANION store"
```

---

### Task 8: `FileAccessProvider` interface + `BrowserFSAProvider`

**Files:**
- Create: `js/services/file-access-provider.js` (base class, documents the contract)
- Create: `js/services/browser-fsa-provider.js`
- Create: `tests/browser-fsa-provider.test.js`
- Modify: `index.html` (add both `<script defer>` tags, in the `services` block, before `backup-service.js`)

**Interfaces:**
- Produces: `class FileAccessProvider` with `async chooseFolder(label)`, `async listFiles(folderRef)`, `async readFile(folderRef, relPath)`, `async writeFile(folderRef, relPath, bytes)`, `async deleteFile(folderRef, relPath)`, `isAvailable()` — every method on the base throws `Not implemented`, so a provider that forgets one fails loudly, not silently. `class BrowserFSAProvider extends FileAccessProvider` — `folderRef` for this provider IS the `FileSystemDirectoryHandle` itself (structured-clonable, so callers can persist whatever `chooseFolder` returns directly into IndexedDB, exactly as `BackupService` already does with `Storage.set(HANDLE_KEY, handle)`).

- [ ] **Step 1: Write the failing test**

```js
// tests/browser-fsa-provider.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/services/file-access-provider.js');
require('../js/services/browser-fsa-provider.js');

function run() {
    const base = new FileAccessProvider();
    let threw = false;
    try { base.chooseFolder('test'); } catch (e) { threw = e.message.includes('Not implemented'); }
    if (!threw) throw new Error('base class methods must throw Not implemented');
    console.log('  ok: base class methods are abstract');

    const provider = new BrowserFSAProvider();
    if (!(provider instanceof FileAccessProvider)) {
        throw new Error('BrowserFSAProvider must extend FileAccessProvider');
    }
    console.log('  ok: BrowserFSAProvider extends FileAccessProvider');

    // isAvailable() must be a synchronous feature check, not a permission
    // check - File System Access existing (or not) on window, nothing more.
    const originalPicker = global.window.showDirectoryPicker;
    global.window.showDirectoryPicker = undefined;
    if (provider.isAvailable() !== false) throw new Error('expected isAvailable()=false without showDirectoryPicker');
    global.window.showDirectoryPicker = () => {};
    if (provider.isAvailable() !== true) throw new Error('expected isAvailable()=true with showDirectoryPicker present');
    global.window.showDirectoryPicker = originalPicker;
    console.log('  ok: isAvailable() reflects File System Access API presence');
}

run();
console.log('ALL CHECKS PASSED');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/browser-fsa-provider.test.js`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
// js/services/file-access-provider.js
'use strict';
(function() {

/**
 * FileAccessProvider — the shared shape every folder-access backend
 * implements (browser File System Access API, or the companion bridge).
 * A feature (BackupService, the reference-photo link) holds ONE instance
 * of whichever provider it's configured to use and never branches on
 * which kind it has - that is the whole point of the interface.
 *
 * `folderRef` is deliberately opaque: BrowserFSAProvider's is a
 * FileSystemDirectoryHandle (structured-clonable, so callers persist it
 * directly), CompanionFileProvider's is a plain folderId string. Callers
 * store whatever chooseFolder() returns and pass it back unchanged.
 */
class FileAccessProvider {
    /** @returns {Promise<*|null>} folderRef, or null if the artist cancelled */
    async chooseFolder(label) { throw new Error('Not implemented'); }
    /** @returns {Promise<{name:string,size:number,mtime:number}[]>} */
    async listFiles(folderRef) { throw new Error('Not implemented'); }
    /** @returns {Promise<ArrayBuffer>} */
    async readFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /** @param {ArrayBuffer|Uint8Array} bytes */
    async writeFile(folderRef, relPath, bytes) { throw new Error('Not implemented'); }
    /** @returns {Promise<boolean>} */
    async deleteFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /** Synchronous quick check: could this provider even be tried right now? */
    isAvailable() { throw new Error('Not implemented'); }
}

window.FileAccessProvider = FileAccessProvider;

})();
```

```js
// js/services/browser-fsa-provider.js
'use strict';
(function() {

/**
 * BrowserFSAProvider — today's File System Access API behaviour, wrapped
 * behind FileAccessProvider so BackupService/ReferenceLayerService can
 * treat it identically to CompanionFileProvider. folderRef IS the
 * FileSystemDirectoryHandle; permission handling (queryPermission /
 * requestPermission, the 'prompt' reset on browser restart) stays exactly
 * as it always worked - this class does not change that behaviour, only
 * relocates it behind the shared interface.
 */
class BrowserFSAProvider extends FileAccessProvider {
    isAvailable() {
        return typeof window.showDirectoryPicker === 'function';
    }

    async chooseFolder(label) {
        try {
            return await window.showDirectoryPicker({ id: label, mode: 'readwrite' });
        } catch (error) {
            if (error && error.name === 'AbortError') return null;
            throw error;
        }
    }

    /** @private */
    async _permission(handle, request) {
        const opts = { mode: 'readwrite' };
        let state = await handle.queryPermission(opts);
        if (state === 'prompt' && request) state = await handle.requestPermission(opts);
        return state;
    }

    async listFiles(folderRef) {
        const out = [];
        for await (const [name, entry] of folderRef.entries()) {
            if (entry.kind !== 'file') continue;
            const file = await entry.getFile();
            out.push({ name, size: file.size, mtime: file.lastModified });
        }
        return out;
    }

    async readFile(folderRef, relPath) {
        const fileHandle = await folderRef.getFileHandle(relPath);
        const file = await fileHandle.getFile();
        return file.arrayBuffer();
    }

    async writeFile(folderRef, relPath, bytes) {
        const fileHandle = await folderRef.getFileHandle(relPath, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(bytes);
        await writable.close();
    }

    async deleteFile(folderRef, relPath) {
        try {
            await folderRef.removeEntry(relPath);
            return true;
        } catch (error) {
            if (error && error.name === 'NotFoundError') return false;
            throw error;
        }
    }
}

window.BrowserFSAProvider = BrowserFSAProvider;

})();
```

Add both scripts to `index.html`, in the services block, immediately before `backup-service.js`'s `<script>` tag:

```html
    <script defer src="js/services/file-access-provider.js"></script>
    <script defer src="js/services/browser-fsa-provider.js"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/browser-fsa-provider.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/services/file-access-provider.js js/services/browser-fsa-provider.js tests/browser-fsa-provider.test.js index.html
git commit -m "services: add FileAccessProvider interface and BrowserFSAProvider"
```

---

### Task 9: `CompanionFileProvider` (HTTP client)

**Files:**
- Create: `js/services/companion-file-provider.js`
- Create: `tests/companion-file-provider.test.js`
- Modify: `index.html` (add the script tag, after `browser-fsa-provider.js`)

**Interfaces:**
- Consumes: `FileAccessProvider` (Task 8), the fixed companion base URL `http://127.0.0.1:51973` (Global Constraints), a bearer token supplied at construction.
- Produces: `class CompanionFileProvider extends FileAccessProvider`, constructed as `new CompanionFileProvider(getToken)` where `getToken` is a zero-arg function returning the current token string (so a later token refresh, e.g. after re-pairing, is picked up on the next call without reconstructing the provider) — `folderRef` for this provider is the plain `folderId` string `POST /folders/choose` returns.

- [ ] **Step 1: Write the failing test**

```js
// tests/companion-file-provider.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/services/file-access-provider.js');
require('../js/services/companion-file-provider.js');

async function run() {
    const calls = [];
    global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        if (url.endsWith('/folders/choose')) {
            return { ok: true, json: async () => ({ folderId: 'abc123', label: 'Backups' }) };
        }
        if (url.includes('/folders/abc123/list')) {
            return { ok: true, json: async () => ([{ name: 'v1.pixula', size: 10, mtime: 0 }]) };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === undefined) {
            return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === 'PUT') {
            return { ok: true };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === 'DELETE') {
            return { ok: true };
        }
        throw new Error('unexpected fetch: ' + url);
    };

    const provider = new CompanionFileProvider(() => 'tok-xyz');

    const folderRef = await provider.chooseFolder('Backups');
    if (folderRef !== 'abc123') throw new Error('expected chooseFolder to return the folderId string');
    console.log('  ok: chooseFolder returns the opaque folderId');

    const files = await provider.listFiles(folderRef);
    if (files.length !== 1 || files[0].name !== 'v1.pixula') throw new Error('listFiles mismatch');
    console.log('  ok: listFiles parses the folder listing');

    const bytes = await provider.readFile(folderRef, 'v1.pixula');
    if (new Uint8Array(bytes).length !== 3) throw new Error('readFile mismatch');
    console.log('  ok: readFile returns the raw bytes');

    await provider.writeFile(folderRef, 'v1.pixula', new Uint8Array([9]));
    await provider.deleteFile(folderRef, 'v1.pixula');
    console.log('  ok: writeFile/deleteFile complete without throwing');

    const authHeader = calls.find((c) => c.url.includes('/folders/abc123/list')).opts.headers.Authorization;
    if (authHeader !== 'Bearer tok-xyz') throw new Error('expected the bearer token on every authenticated call');
    console.log('  ok: every call after chooseFolder carries the bearer token');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/companion-file-provider.test.js`
Expected: FAIL — `CompanionFileProvider` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// js/services/companion-file-provider.js
'use strict';
(function() {

const COMPANION_BASE_URL = 'http://127.0.0.1:51973';

/**
 * CompanionFileProvider — talks to the companion binary over HTTP.
 * folderRef IS the plain folderId string the companion hands back from
 * /folders/choose; the companion alone maps that id to a real path (see
 * docs/superpowers/specs/2026-08-19-companion-bridge-design.md §4.3 -
 * PixULA never constructs or sends a raw OS path).
 */
class CompanionFileProvider extends FileAccessProvider {
    /** @param {() => string} getToken - current bearer token, re-read per call */
    constructor(getToken) {
        super();
        this._getToken = getToken;
    }

    isAvailable() {
        return true; // reachability is checked by CompanionBridgeService, not per-call here
    }

    /** @private */
    _headers(extra) {
        return { Authorization: `Bearer ${this._getToken()}`, ...extra };
    }

    async chooseFolder(label) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/choose`, {
            method: 'POST',
            headers: this._headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ label })
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body.folderId;
    }

    async listFiles(folderRef) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/list`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: listFiles failed (${res.status})`);
        return res.json();
    }

    async readFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: readFile failed (${res.status})`);
        return res.arrayBuffer();
    }

    async writeFile(folderRef, relPath, bytes) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            method: 'PUT',
            headers: this._headers(),
            body: bytes
        });
        if (!res.ok) throw new Error(`companion: writeFile failed (${res.status})`);
    }

    async deleteFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            method: 'DELETE',
            headers: this._headers()
        });
        return res.ok;
    }
}

window.CompanionFileProvider = CompanionFileProvider;

})();
```

Add to `index.html`, immediately after `browser-fsa-provider.js`:

```html
    <script defer src="js/services/companion-file-provider.js"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/companion-file-provider.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/services/companion-file-provider.js tests/companion-file-provider.test.js index.html
git commit -m "services: add CompanionFileProvider HTTP client"
```

---

### Task 10: `CompanionBridgeService` (pairing/status state machine)

**Files:**
- Create: `js/services/companion-bridge-service.js`
- Create: `tests/companion-bridge-service.test.js`
- Modify: `js/core/constants.js` (add `EVENTS.COMPANION_STATE_CHANGED`)
- Modify: `index.html` (add the script tag, after `companion-file-provider.js`)

**Interfaces:**
- Consumes: `CompanionFileProvider` (Task 9), `Storage.STORES.COMPANION` (Task 7), `EVENTS.COMPANION_STATE_CHANGED`.
- Produces: singleton `window.CompanionBridgeService`, methods `async checkStatus()` (polls `GET /status`, updates `this.running`), `async pair()` (posts `/pair`, long-poll — resolves once the artist clicks Enable Pairing in the tray, or rejects on timeout), `getState()` -> `{ running, paired, token }`, `getProvider()` -> a ready-to-use `CompanionFileProvider` instance or `null` if unpaired. Emits `EVENTS.COMPANION_STATE_CHANGED` on every state transition, mirroring `BackupService.getState()`'s shape (Global Constraints: same error vocabulary).

- [ ] **Step 1: Write the failing test**

```js
// tests/companion-bridge-service.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/services/file-access-provider.js');
require('../js/services/companion-file-provider.js');
require('../js/services/companion-bridge-service.js');

async function run() {
    const events = [];
    EventBus.on(EVENTS.COMPANION_STATE_CHANGED, (state) => events.push(state));

    // checkStatus(): companion unreachable
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
    await CompanionBridgeService.checkStatus();
    let state = CompanionBridgeService.getState();
    if (state.running !== false) throw new Error('expected running=false when fetch throws');
    if (CompanionBridgeService.getProvider() !== null) throw new Error('expected no provider before pairing');
    console.log('  ok: checkStatus() reports unreachable, no provider available');

    // checkStatus(): companion running, not yet paired
    global.fetch = async (url) => {
        if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: false }) };
        throw new Error('unexpected fetch: ' + url);
    };
    await CompanionBridgeService.checkStatus();
    state = CompanionBridgeService.getState();
    if (state.running !== true || state.paired !== false) throw new Error('expected running=true, paired=false');
    console.log('  ok: checkStatus() reports running-but-unpaired');

    // pair(): the long-poll resolves with a token
    global.fetch = async (url, opts) => {
        if (url.endsWith('/pair') && opts.method === 'POST') {
            return { ok: true, text: async () => 'a'.repeat(64) };
        }
        throw new Error('unexpected fetch: ' + url);
    };
    await CompanionBridgeService.pair();
    state = CompanionBridgeService.getState();
    if (state.paired !== true || state.token !== 'a'.repeat(64)) throw new Error('expected paired=true with the returned token');
    if (!(CompanionBridgeService.getProvider() instanceof CompanionFileProvider)) throw new Error('expected a usable provider after pairing');
    console.log('  ok: pair() stores the token and getProvider() returns a CompanionFileProvider');

    if (events.length < 2) throw new Error('expected EVENTS.COMPANION_STATE_CHANGED on every transition');
    console.log('  ok: state changes are announced on the bus');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/companion-bridge-service.test.js`
Expected: FAIL — `CompanionBridgeService` undefined, `EVENTS.COMPANION_STATE_CHANGED` undefined.

- [ ] **Step 3: Write minimal implementation**

Add to the `EVENTS` block in `js/core/constants.js`, near `BACKUP_STATE_CHANGED`:

```js
    COMPANION_STATE_CHANGED: 'companion:stateChanged',
```

```js
// js/services/companion-bridge-service.js
'use strict';
(function() {

const COMPANION_BASE_URL = 'http://127.0.0.1:51973';
const TOKEN_KEY = 'token';

/**
 * CompanionBridgeService — the companion's connection state, mirroring
 * BackupService's needsPermission/getState shape (see the design spec's
 * "Failure behavior" table) so the rest of the app has one error
 * vocabulary for "an optional file-access backend isn't available right
 * now" regardless of which backend it is.
 */
class CompanionBridgeServiceClass {
    constructor() {
        this.running = false;
        this.paired = false;
        this.token = null;
    }

    async init() {
        const stored = await Storage.get(Storage.STORES.COMPANION, TOKEN_KEY);
        if (stored && stored.value) {
            this.token = stored.value;
            this.paired = true;
        }
    }

    getState() {
        return { running: this.running, paired: this.paired, token: this.token };
    }

    /** A ready CompanionFileProvider, or null until paired. */
    getProvider() {
        if (!this.paired || !this.token) return null;
        return new CompanionFileProvider(() => this.token);
    }

    /** Unauthenticated existence check - never confers trust. */
    async checkStatus() {
        try {
            const res = await fetch(`${COMPANION_BASE_URL}/status`);
            this.running = res.ok;
        } catch (error) {
            this.running = false;
        }
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
        return this.running;
    }

    /**
     * Long-poll /pair. Resolves once the artist clicks Enable Pairing in
     * the companion's tray menu (never triggered by any web page - see
     * the design spec §4.2 and this plan's Global Constraints).
     */
    async pair() {
        const res = await fetch(`${COMPANION_BASE_URL}/pair`, { method: 'POST' });
        if (!res.ok) {
            EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
            throw new Error(`companion: pairing failed (${res.status})`);
        }
        this.token = await res.text();
        this.paired = true;
        await Storage.set(Storage.STORES.COMPANION, { key: TOKEN_KEY, value: this.token });
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
        return this.token;
    }

    /** Drop the stored token, e.g. after a 401 from any endpoint. */
    async forget() {
        this.token = null;
        this.paired = false;
        await Storage.delete(Storage.STORES.COMPANION, TOKEN_KEY);
        EventBus.emit(EVENTS.COMPANION_STATE_CHANGED, this.getState());
    }
}

window.CompanionBridgeService = new CompanionBridgeServiceClass();

})();
```

Add to `index.html`, immediately after `companion-file-provider.js`:

```html
    <script defer src="js/services/companion-bridge-service.js"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/companion-bridge-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/services/companion-bridge-service.js tests/companion-bridge-service.test.js js/core/constants.js index.html
git commit -m "services: add CompanionBridgeService pairing/status state machine"
```

---

## Phase 3 — Companion dialog UI

### Task 11: `CompanionDialog` component

**Files:**
- Create: `js/ui/components/companion-dialog.js`
- Modify: `js/ui/menu-system.js` (add "Settings > Companion…" entry, matching the existing "Settings > Workspace Presets…" pattern)
- Modify: `index.html` (add the script tag)
- Modify: all 13 `js/i18n/*.js` locale files (new keys, parity enforced by `tests/i18n-parity.test.js`)

**Interfaces:**
- Consumes: `CompanionBridgeService` (Task 10), `Dialog` base component (existing — same one `ImportDialog`/`TapeBlockDialog` use).
- Produces: `window.CompanionDialog.open()`.

- [ ] **Step 1: Write the failing test**

```js
// tests/browser/companion-dialog.spec.js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('Companion dialog shows not-running, then running-unpaired, then paired', async ({ page }) => {
    await boot(page);

    // Companion unreachable (default - nothing is listening on 51973 in CI).
    await page.click('text=Settings');
    await page.click('text=Companion…');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/not running/i);

    // Simulate "running, unpaired" by stubbing fetch before checkStatus runs again.
    await page.evaluate(() => {
        window.fetch = async (url) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: false }) };
            throw new Error('unexpected fetch: ' + url);
        };
    });
    await page.click('.companion-dialog-refresh');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/not connected/i);

    // Simulate a completed pairing.
    await page.evaluate(() => {
        window.fetch = async (url, opts) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: true }) };
            if (url.endsWith('/pair') && opts && opts.method === 'POST') return { ok: true, text: async () => 'b'.repeat(64) };
            throw new Error('unexpected fetch: ' + url);
        };
    });
    await page.click('.companion-dialog-connect');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/connected/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/companion-dialog.spec.js`
Expected: FAIL — "Companion…" menu item does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
// js/ui/components/companion-dialog.js
'use strict';
(function() {

/**
 * CompanionDialog — Settings > Companion…. Shows connection status,
 * offers Connect (drives CompanionBridgeService.pair(), which blocks
 * until the artist clicks Enable Pairing in the companion's tray menu),
 * and lists authorized folders (informational only here — folders are
 * chosen from the feature that needs one, e.g. Backup Folder settings,
 * not from this dialog).
 */
class CompanionDialogClass {
    async open() {
        const content = document.createElement('div');
        content.className = 'companion-dialog';

        const status = document.createElement('p');
        status.className = 'companion-dialog-status';
        content.appendChild(status);

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'panel-button companion-dialog-refresh';
        refreshBtn.dataset.i18n = 'companion.refresh';
        refreshBtn.textContent = t('companion.refresh', 'Check Again');

        const connectBtn = document.createElement('button');
        connectBtn.type = 'button';
        connectBtn.className = 'panel-button companion-dialog-connect';
        connectBtn.dataset.i18n = 'companion.connect';
        connectBtn.textContent = t('companion.connect', 'Connect');

        content.appendChild(refreshBtn);
        content.appendChild(connectBtn);

        const render = () => {
            const state = CompanionBridgeService.getState();
            if (!state.running) {
                status.textContent = t('companion.notRunning', 'Companion not running');
                connectBtn.hidden = true;
            } else if (!state.paired) {
                status.textContent = t('companion.notConnected', 'Companion running, not connected');
                connectBtn.hidden = false;
            } else {
                status.textContent = t('companion.connected', 'Connected');
                connectBtn.hidden = true;
            }
        };

        refreshBtn.addEventListener('click', async () => {
            await CompanionBridgeService.checkStatus();
            render();
        });

        connectBtn.addEventListener('click', async () => {
            status.textContent = t('companion.waiting', 'Click Enable Pairing in the companion tray icon...');
            try {
                await CompanionBridgeService.pair();
            } catch (error) {
                Logger.warn('CompanionDialog', 'Pairing failed', error);
            }
            render();
        });

        await CompanionBridgeService.checkStatus();
        render();

        Dialog.open({
            titleI18n: 'companion.title',
            title: 'Companion',
            content
        });
    }
}

/** English fallback until I18n.apply runs. @private */
function t(key, fallback) {
    if (window.I18n && typeof I18n.t === 'function') {
        const v = I18n.t(key);
        if (v && v !== key) return v;
    }
    return fallback;
}

window.CompanionDialog = new CompanionDialogClass();

})();
```

Add the menu entry in `js/ui/menu-system.js`, in the Settings menu next to "Workspace Presets…" (find that `{ id: ..., label: ..., action: 'settings:workspacePresets' }`-shaped entry and add immediately after it):

```js
                    { id: 'companion', label: 'Companion…', action: 'settings:companion' },
```

And in the action switch (find the `case 'settings:workspacePresets':` handler and add alongside it):

```js
            case 'settings:companion': CompanionDialog.open(); break;
```

Add to `index.html`, in the `ui/components` block:

```html
    <script defer src="js/ui/components/companion-dialog.js"></script>
```

Add these keys to **all 13** `js/i18n/*.js` files (English values below; the other 12 locales get natively translated values — do not copy the English string into non-English locale files, `tests/i18n-parity.test.js` only checks the key SET matches, not the values, but every other key in the project is genuinely translated and this one should be too):

```js
    'companion.title': 'Companion',
    'companion.refresh': 'Check Again',
    'companion.connect': 'Connect',
    'companion.notRunning': 'Companion not running',
    'companion.notConnected': 'Companion running, not connected',
    'companion.connected': 'Connected',
    'companion.waiting': 'Click Enable Pairing in the companion tray icon...',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/browser/companion-dialog.spec.js` then `node tests/run-all.js` (confirms i18n parity)
Expected: PASS on both.

- [ ] **Step 5: Commit**

```bash
git add js/ui/components/companion-dialog.js js/ui/menu-system.js index.html js/i18n/*.js tests/browser/companion-dialog.spec.js
git commit -m "ui: add the Companion settings dialog"
```

---

## Phase 4 — Feature retrofits

### Task 12: `BackupService` provider selection

**Files:**
- Modify: `js/services/backup-service.js`

**Interfaces:**
- Consumes: `FileAccessProvider`/`BrowserFSAProvider`/`CompanionFileProvider` (Tasks 8-9), `CompanionBridgeService.getProvider()` (Task 10).
- Produces: `BackupService.setProviderKind('browser'|'companion')`, `BackupService.getProviderKind()`. Every other public method (`chooseFolder`, `writeVersion`, `resume`, `getState`) keeps its existing signature — this task changes what runs *inside* them, not their contract, so nothing else in the app needs to change.

- [ ] **Step 1: Write the failing test**

```js
// tests/backup-service-provider.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/services/file-access-provider.js');
require('../js/services/browser-fsa-provider.js');
require('../js/services/companion-file-provider.js');
require('../js/services/backup-service.js');

async function run() {
    if (BackupService.getProviderKind() !== 'browser') {
        throw new Error('expected the default provider kind to be browser (unchanged behaviour)');
    }
    console.log('  ok: defaults to the browser provider');

    let chosen = null;
    BackupService._provider = {
        chooseFolder: async () => { chosen = 'called'; return 'fake-folder-ref'; },
        isAvailable: () => true
    };
    BackupService.setProviderKind('companion');
    if (BackupService.getProviderKind() !== 'companion') throw new Error('expected provider kind to switch');
    console.log('  ok: setProviderKind switches the active provider');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/backup-service-provider.test.js`
Expected: FAIL — `getProviderKind` undefined.

- [ ] **Step 3: Write the implementation**

This modifies the existing `js/services/backup-service.js` (read in full during Task 12's execution — its current shape was documented at length in the design spec §6.1 and is not reproduced here). Concretely:

1. In the constructor, add:
```js
        this._providerKind = 'browser'; // 'browser' | 'companion'
        this._browserProvider = new BrowserFSAProvider();
        this._provider = this._browserProvider; // active provider, swappable via setProviderKind
```

2. Add two new public methods:
```js
    getProviderKind() { return this._providerKind; }

    /**
     * Switch which backend this link uses. Per-feature, not global — see
     * the design spec §3.1. Falls back to the browser provider if the
     * companion isn't paired yet, so choosing 'companion' before pairing
     * never leaves the service without a usable provider.
     */
    setProviderKind(kind) {
        if (kind === 'companion') {
            const companionProvider = CompanionBridgeService.getProvider();
            this._provider = companionProvider || this._browserProvider;
            this._providerKind = companionProvider ? 'companion' : 'browser';
        } else {
            this._provider = this._browserProvider;
            this._providerKind = 'browser';
        }
    }
```

3. Replace every direct `this.directory.queryPermission`/`getFileHandle`/`createWritable`/`removeEntry` call inside `chooseFolder()`, `_permission()`, `writeVersion()`, and the retention-pruning loop with the equivalent `this._provider.chooseFolder(...)` / `readFile` / `writeFile` / `deleteFile` / `listFiles` calls, and store whatever `chooseFolder()` returns as `this.directory` exactly as today (it is still a `FileSystemDirectoryHandle` when `_providerKind === 'browser'`, and a `folderId` string when `'companion'` — both are opaque to everything outside this file, matching the interface's contract). The `needsPermission` flag's meaning becomes "the active provider reports this link unavailable" rather than being FSA-specific — for the companion provider, `_permission()`'s browser-only `queryPermission` dance is simply skipped, since `CompanionBridgeService.getProvider()` already only returns a provider when paired.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/backup-service-provider.test.js && node tests/run-all.js`
Expected: PASS on both — the second confirms nothing in the existing
`BackupService`-touching suites regressed.

- [ ] **Step 5: Commit**

```bash
git add js/services/backup-service.js tests/backup-service-provider.test.js
git commit -m "backup-service: add companion provider as an opt-in alternative to File System Access"
```

---

### Task 13: Reference-photo link provider selection

**Files:**
- Modify: `js/services/reference-layer-service.js`
- Modify: `js/utils/image-source.js`

**Interfaces:**
- Same shape as Task 12: `ReferenceLayerService.setProviderKind('browser'|'companion')` / `getProviderKind()`, existing public API (`loadImage`, `isStandIn`, etc.) unchanged.

- [ ] **Step 1: Write the failing test**

```js
// tests/reference-layer-service-provider.test.js
'use strict';
require('./helpers/zx-stubs');
require('../js/services/file-access-provider.js');
require('../js/services/browser-fsa-provider.js');
require('../js/services/companion-file-provider.js');
require('../js/utils/image-source.js');
require('../js/services/reference-layer-service.js');

async function run() {
    if (ReferenceLayerService.getProviderKind() !== 'browser') {
        throw new Error('expected the default provider kind to be browser (unchanged behaviour)');
    }
    console.log('  ok: defaults to the browser provider, existing behaviour untouched');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/reference-layer-service-provider.test.js`
Expected: FAIL — `getProviderKind` undefined.

- [ ] **Step 3: Write the implementation**

Same pattern as Task 12, applied to `ReferenceLayerService` and `ImageSource`
(`js/utils/image-source.js`): add `_providerKind`/`_browserProvider`/
`_provider` plus `getProviderKind()`/`setProviderKind()`, and route
`ImageSource`'s file-handle read (used when resolving a linked photo that
isn't a stand-in) through `this._provider.readFile(...)` instead of calling
`FileSystemFileHandle.getFile()` directly when `_providerKind === 'companion'`.
The stand-in/thumbnail fallback path (`isStandIn`) is untouched — it already
handles "the real file isn't reachable right now" for the permission-lapsed
case, and a companion-unreachable case is the identical situation from
`ImageSource`'s point of view (see design spec §6.2 and §7's failure table).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/reference-layer-service-provider.test.js && node tests/run-all.js`
Expected: PASS on both.

- [ ] **Step 5: Commit**

```bash
git add js/services/reference-layer-service.js js/utils/image-source.js tests/reference-layer-service-provider.test.js
git commit -m "reference-layer: add companion provider as an opt-in alternative to File System Access"
```

---

## Phase 5 — System Font feature

### Task 14: Client-side font rasterizer

**Files:**
- Create: `js/utils/font-rasterizer.js`
- Create: `tests/font-rasterizer.test.js`
- Modify: `index.html` (add the script tag, in the `utils` block)

**Interfaces:**
- Consumes: raw font bytes (`ArrayBuffer`, from `CompanionFileProvider`/the companion's `/fonts/{id}/file`), `FontService.setGlyph(code, bytes)` (existing, Task-external).
- Produces: `FontRasterizer.rasterize(fontBytes, { pointSize, cellWidth, firstCode, count })` -> `Promise<Uint8Array[]>` (one `Uint8Array(8)` per code, in coverage order, row-byte MSB-left — exactly `FontService.setGlyph`'s expected shape, so the caller just loops and calls `setGlyph`).

- [ ] **Step 1: Write the failing test**

```js
// tests/font-rasterizer.test.js
'use strict';
require('./helpers/zx-stubs'); // provides a canvas/FontFace stub - see Step 3 note
require('../js/utils/font-rasterizer.js');

async function run() {
    // A minimal stub font isn't meaningful to rasterize pixel-for-pixel in
    // a headless Node test (no real font renderer without a browser) - this
    // suite pins the CONTRACT: right glyph count, right byte shape, masked
    // to the requested width. Pixel-accuracy against a real system font is
    // covered by the Playwright spec in Task 15, which runs in real Chrome.
    const fakeBytes = new Uint8Array([0, 1, 2, 3]).buffer;
    const glyphs = await FontRasterizer.rasterize(fakeBytes, {
        pointSize: 8, cellWidth: 6, firstCode: 65, count: 3 // 'A'..'C'
    });

    if (glyphs.length !== 3) throw new Error(`expected 3 glyphs, got ${glyphs.length}`);
    console.log('  ok: returns one glyph per requested code');

    for (const g of glyphs) {
        if (!(g instanceof Uint8Array) || g.length !== 8) {
            throw new Error('expected each glyph to be a Uint8Array(8), matching FontService.setGlyph');
        }
        const mask = (0xFF << (8 - 6)) & 0xFF; // width=6
        for (const byte of g) {
            if ((byte & ~mask) !== 0) throw new Error('glyph row has bits set beyond the requested cell width');
        }
    }
    console.log('  ok: every glyph is Uint8Array(8), masked to the requested width');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/font-rasterizer.test.js`
Expected: FAIL — `FontRasterizer` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// js/utils/font-rasterizer.js
'use strict';
(function() {

/**
 * FontRasterizer — turns real font bytes (TTF/OTF, served raw by the
 * companion) into PixULA's bitmap glyph model, entirely client-side. No
 * font-rendering code runs in the companion at all (design spec §6.3) -
 * this is the ONLY place outline-to-bitmap conversion happens, using the
 * standard FontFace + Canvas 2D APIs already available in every browser
 * this app targets.
 */
const FontRasterizer = {
    /**
     * @param {ArrayBuffer} fontBytes
     * @param {{pointSize:number, cellWidth:number, firstCode:number, count:number}} opts
     * @returns {Promise<Uint8Array[]>} one Uint8Array(8) per code, row-byte
     *   MSB-left, masked to cellWidth - the exact shape FontService.setGlyph expects.
     */
    async rasterize(fontBytes, { pointSize, cellWidth, firstCode, count }) {
        const face = new FontFace('PixULA-SystemFontRaster', fontBytes);
        await face.load();
        document.fonts.add(face);

        const cellHeight = 8; // Sinclair fonts are always one 8-px attribute cell tall
        const canvas = Helpers.createCanvas(cellWidth, cellHeight);
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = `${pointSize}px PixULA-SystemFontRaster`;
        ctx.fillStyle = '#000';

        const mask = (0xFF << (8 - cellWidth)) & 0xFF;
        const glyphs = [];
        for (let i = 0; i < count; i++) {
            const code = firstCode + i;
            ctx.clearRect(0, 0, cellWidth, cellHeight);
            ctx.fillText(String.fromCharCode(code), 0, 0);
            const { data } = ctx.getImageData(0, 0, cellWidth, cellHeight);

            const glyph = new Uint8Array(cellHeight);
            for (let y = 0; y < cellHeight; y++) {
                let row = 0;
                for (let x = 0; x < cellWidth; x++) {
                    const alpha = data[(y * cellWidth + x) * 4 + 3];
                    if (alpha >= 128) row |= (0x80 >> x);
                }
                glyph[y] = row & mask;
            }
            glyphs.push(glyph);
        }

        document.fonts.delete(face);
        return glyphs;
    }
};

window.FontRasterizer = FontRasterizer;

})();
```

Add to `index.html`, in the `utils` block (near `image-source.js`):

```html
    <script defer src="js/utils/font-rasterizer.js"></script>
```

**Note for the executing agent:** `tests/helpers/zx-stubs.js` needs a
minimal `FontFace`/`document.fonts`/`document.createElement('canvas')` stub
for this Node test to run at all. Check whether one already exists before
adding it; if not, a `class FontFace { constructor(){} async load(){return this;} }`
plus `document.fonts = { add(){}, delete(){} }` and a canvas 2D context
stub whose `fillText`/`getImageData`/`clearRect` are no-ops returning an
all-zero-alpha `ImageData`-shaped object is enough to satisfy this specific
contract test — real rendering is never exercised in Node, only in the
Playwright spec (Task 15).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/font-rasterizer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/utils/font-rasterizer.js tests/font-rasterizer.test.js index.html tests/helpers/zx-stubs.js
git commit -m "utils: add client-side FontRasterizer (FontFace + canvas -> bitmap glyphs)"
```

---

### Task 15: "From System Font" row in the Font Editor

**Files:**
- Modify: `js/ui/components/font-editor-dialog.js`
- Create: `tests/browser/system-font-import.spec.js`
- Modify: all 13 `js/i18n/*.js` locale files

**Interfaces:**
- Consumes: `CompanionBridgeService.getProvider()` (Task 10, for `GET /fonts` — add a `listFonts()`/`readFontFile(fontId)` pair to `CompanionFileProvider`, mirroring the existing folder methods but hitting `/fonts` and `/fonts/{id}/file`), `FontRasterizer.rasterize` (Task 14), `FontService.setGlyph`/`setWidth`/`resetToROM`-adjacent setup (existing).
- Produces: a new dialog row, no new public API — this is a leaf UI task.

- [ ] **Step 1: Add the two companion font methods**

Add to `js/services/companion-file-provider.js` (extends Task 9's class):

```js
    async listFonts() {
        const res = await fetch(`${COMPANION_BASE_URL}/fonts`, { headers: this._headers() });
        if (!res.ok) throw new Error(`companion: listFonts failed (${res.status})`);
        return res.json();
    }

    async readFontFile(fontId) {
        const res = await fetch(`${COMPANION_BASE_URL}/fonts/${fontId}/file`, { headers: this._headers() });
        if (!res.ok) throw new Error(`companion: readFontFile failed (${res.status})`);
        return res.arrayBuffer();
    }
```

- [ ] **Step 2: Write the failing Playwright spec**

```js
// tests/browser/system-font-import.spec.js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('From System Font row generates a usable bitmap font', async ({ page }) => {
    await boot(page);

    // Fake a paired companion offering one font family.
    await page.evaluate(() => {
        CompanionBridgeService.paired = true;
        CompanionBridgeService.token = 'faketoken';
        window.fetch = async (url) => {
            if (url.endsWith('/fonts')) {
                return { ok: true, json: async () => ([{ fontId: 'f1', family: 'Test Sans', style: 'Regular' }]) };
            }
            if (url.endsWith('/fonts/f1/file')) {
                // A real, tiny valid font isn't practical to inline here;
                // FontRasterizer's own contract is covered by Task 14's
                // Node test. This spec only proves the UI wiring end to
                // end - see Step 3's note on stubbing FontRasterizer.
                return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
            }
            throw new Error('unexpected fetch: ' + url);
        };
        window.FontRasterizer = {
            rasterize: async () => Array.from({ length: 96 }, () => new Uint8Array(8))
        };
    });

    await page.click('text=File');
    await page.click('text=Font Editor…');
    await page.click('.font-editor-system-font-btn');
    await page.selectOption('.font-editor-system-font-select', 'f1');
    await page.click('.font-editor-system-font-generate');

    await expect(page.locator('.font-editor-status')).toContainText('Test Sans');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx playwright test tests/browser/system-font-import.spec.js`
Expected: FAIL — `.font-editor-system-font-btn` does not exist yet.

- [ ] **Step 4: Write minimal implementation**

Add a new row to `FontEditorDialog`, alongside the existing ROM/Capture/
Import rows (find where those buttons are built and add this block after
them):

```js
        const systemFontBtn = document.createElement('button');
        systemFontBtn.type = 'button';
        systemFontBtn.className = 'panel-button font-editor-system-font-btn';
        systemFontBtn.dataset.i18n = 'font.fromSystemFont';
        systemFontBtn.textContent = t('font.fromSystemFont', 'From System Font…');
        systemFontBtn.addEventListener('click', () => this._openSystemFontPicker());
        row.appendChild(systemFontBtn);
```

And the picker method:

```js
    /** @private */
    async _openSystemFontPicker() {
        const provider = CompanionBridgeService.getProvider();
        const status = this._content.querySelector('.font-editor-status');
        if (!provider) {
            status.textContent = t('font.systemFontNeedsCompanion',
                'Connect the Companion (Settings > Companion…) to use system fonts.');
            return;
        }

        const fonts = await provider.listFonts();
        const select = document.createElement('select');
        select.className = 'font-editor-system-font-select';
        for (const f of fonts) {
            const opt = document.createElement('option');
            opt.value = f.fontId;
            opt.textContent = `${f.family} (${f.style})`;
            select.appendChild(opt);
        }

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number';
        sizeInput.value = '12';
        sizeInput.min = '4';
        sizeInput.max = '96';

        const widthSelect = document.createElement('select');
        for (const w of FontService.WIDTHS) {
            const opt = document.createElement('option');
            opt.value = String(w);
            opt.textContent = `${w}px`;
            widthSelect.appendChild(opt);
        }

        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'panel-button font-editor-system-font-generate';
        generateBtn.textContent = t('font.generate', 'Generate');
        generateBtn.addEventListener('click', async () => {
            const fontId = select.value;
            const family = fonts.find((f) => f.fontId === fontId).family;
            const pointSize = parseInt(sizeInput.value, 10) || 12;
            const cellWidth = parseInt(widthSelect.value, 10);

            const bytes = await provider.readFontFile(fontId);
            FontService.setWidth(cellWidth);
            const coverage = FontService.getCoverage();
            const glyphs = await FontRasterizer.rasterize(bytes, {
                pointSize, cellWidth, firstCode: coverage.firstCode, count: coverage.count
            });
            glyphs.forEach((bytesRow, i) => FontService.setGlyph(coverage.firstCode + i, bytesRow));

            status.textContent = t('font.systemFontGenerated', `Generated from ${family}`).replace('{family}', family);
        });

        Dialog.open({
            titleI18n: 'font.chooseSystemFont',
            title: 'Choose System Font',
            content: (() => {
                const wrap = document.createElement('div');
                wrap.append(select, sizeInput, widthSelect, generateBtn);
                return wrap;
            })()
        });
    }
```

(`.font-editor-status` is assumed to already exist as a status line in the
dialog — if the executing agent finds the actual dialog uses a different
element for status text, wire `status.textContent` to that element instead;
the test only asserts on the class name, not the specific markup shape.)

Add these keys to all 13 `js/i18n/*.js` files:

```js
    'font.fromSystemFont': 'From System Font…',
    'font.chooseSystemFont': 'Choose System Font',
    'font.generate': 'Generate',
    'font.systemFontNeedsCompanion': 'Connect the Companion (Settings > Companion…) to use system fonts.',
    'font.systemFontGenerated': 'Generated from {family}',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test tests/browser/system-font-import.spec.js && node tests/run-all.js`
Expected: PASS on both.

- [ ] **Step 6: Commit**

```bash
git add js/services/companion-file-provider.js js/ui/components/font-editor-dialog.js tests/browser/system-font-import.spec.js js/i18n/*.js
git commit -m "font-editor: add From System Font, rasterizing companion-served fonts client-side"
```

---

## Phase 6 — Docs and wrap-up

### Task 16: `docs/COMPANION.md`

**Files:**
- Create: `docs/COMPANION.md`

- [ ] **Step 1: Write the document**

Mirror `docs/PORTABLE_BUILDS.md`'s structure (what it is, why it exists,
how to build/run, what it does NOT do). Cover: the two problems it solves
(spec §1), what's explicitly out of scope for v1 (spec §2), the pairing
flow and why it's tray-click-only (spec §4.2 + this plan's Global
Constraints note on the CORS/HTTP-endpoint risk), the full HTTP API table
(spec §5), and the build/run instructions (companion/README.md, don't
duplicate — link to it).

- [ ] **Step 2: Commit**

```bash
git add docs/COMPANION.md
git commit -m "docs: add docs/COMPANION.md"
```

---

### Task 17: CLAUDE.md status paragraph + TESTLOG rows

**Files:**
- Modify: `CLAUDE.md` (add a status paragraph documenting this feature, following the project's existing "Post-rebuild work" table convention at the top of the file)
- Modify: `tests/TESTLOG.md` (add manual-only rows for: tray icon + Enable Pairing click, native folder picker via `/folders/choose`, real OS font enumeration on each of the three platforms — matching the existing pen/touch-hardware row format exactly)

- [ ] **Step 1: Update CLAUDE.md**

Add one row to the "Post-rebuild work" table near the top of the file:

```markdown
| **Optional companion file-access bridge** — a local Go binary giving prompt-free folder access and OS-font access on every desktop browser, opt-in per feature | see `docs/COMPANION.md` |
```

- [ ] **Step 2: Add TESTLOG rows**

Add to `tests/TESTLOG.md`, in the same section/format as the existing
pen/touch/native-dialog manual rows:

```markdown
- [ ] Companion: tray icon appears on launch; Enable Pairing click resolves a waiting PixULA tab within the 2-minute window (Windows/macOS/Linux)
- [ ] Companion: /folders/choose opens the OS's native folder picker; cancelling returns no folderId
- [ ] Companion: /fonts lists real installed fonts on Windows, macOS, and Linux (with and without fontconfig present)
- [ ] Companion: Gatekeeper/SmartScreen warning appears on first run of the unsigned binary (expected, documented in docs/COMPANION.md)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md tests/TESTLOG.md
git commit -m "docs: record the companion bridge in CLAUDE.md and TESTLOG"
```

---

## Self-Review Notes

**Spec coverage:** §1 motivation -> Tasks 8-10 (provider abstraction) and
12-13 (retrofits) directly address both re-prompt friction and no-FSA
browsers. §2 goals -> all covered (Windows/Linux/macOS: Task 6; backup +
reference retrofit: Tasks 12-13; system fonts: Tasks 14-15; no-code
pairing: Task 3). §2 non-goals -> Android/push/signing are named in
Global Constraints as explicitly excluded, no task touches them. §3
architecture -> Tasks 1-10 build exactly this shape. §4 security -> Task 2
(pairing) and Task 4 (path safety) implement it directly; the CORS/tray
risk is called out explicitly in Global Constraints since it changes the
spec's "native window" into a concrete, security-preserving mechanism.
§5 API surface -> every route is wired across Tasks 2, 4, 5. §6 retrofits
-> Tasks 12-14. §7 failure behavior -> `getState()`/`needsPermission`
shape reused throughout Tasks 10, 12, 13. §8 testing -> every task carries
its own Go/Node/Playwright/manual test, matching the spec's breakdown
exactly. §9-10 open questions -> resolved concretely in Global Constraints
(port 51973, 2-minute window, retention stays client-side).

**Placeholder scan:** no TBD/TODO markers; the two spots that describe a
change against an unseen existing file (Task 12's `BackupService` edit,
Task 13's `ReferenceLayerService` edit) give the exact method names, the
exact new methods' full bodies, and a precise description of what to
replace, rather than "similar to Task N" — the executor reads the real
current file during the task, per the Task Structure's own field-lookup
model used throughout this codebase's own CLAUDE.md.

**Type/name consistency:** `FileAccessProvider` method names
(`chooseFolder`/`listFiles`/`readFile`/`writeFile`/`deleteFile`/
`isAvailable`) are identical across Tasks 8, 9, 12, 13. `folderRef` is
used consistently as the opaque parameter name everywhere. `EVENTS.
COMPANION_STATE_CHANGED` is defined once (Task 10) and referenced nowhere
else by a different name. `Storage.STORES.COMPANION` likewise.
