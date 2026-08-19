package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sqweek/dialog"
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

func TestResolveRejectsSymlinkEscape(t *testing.T) {
	dir := t.TempDir()
	outside := t.TempDir()
	secret := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(secret, []byte("top secret"), 0o644); err != nil {
		t.Fatalf("writing outside fixture file: %v", err)
	}

	fs := newFolderStore()
	fs.folders["f1"] = folderRecord{ID: "f1", Label: "Test", Path: dir}

	t.Run("symlink to a file that already exists", func(t *testing.T) {
		link := filepath.Join(dir, "escape-file")
		if err := os.Symlink(secret, link); err != nil {
			t.Skipf("os.Symlink not available in this environment (needs admin rights or Developer Mode on Windows): %v", err)
		}
		if _, ok := fs.Resolve("f1", "escape-file"); ok {
			t.Error("Resolve should reject a symlink inside the authorized folder that points to a file outside it")
		}
	})

	t.Run("symlinked directory with a not-yet-existing file under it", func(t *testing.T) {
		linkDir := filepath.Join(dir, "escape-dir")
		if err := os.Symlink(outside, linkDir); err != nil {
			t.Skipf("os.Symlink not available in this environment (needs admin rights or Developer Mode on Windows): %v", err)
		}
		// "newfile.txt" does not exist yet under the symlinked directory -
		// this is the PUT-creating-a-new-file case, which must walk up to
		// the symlinked ancestor to catch the escape.
		if _, ok := fs.Resolve("f1", "escape-dir/newfile.txt"); ok {
			t.Error("Resolve should reject a path through a symlinked directory inside the authorized folder that points outside it")
		}
	})
}

func TestResolveUnknownFolderFails(t *testing.T) {
	fs := newFolderStore()
	if _, ok := fs.Resolve("nope", "file.txt"); ok {
		t.Fatal("expected Resolve to fail for an unregistered folder id")
	}
}

// A cancelled picker and a failed one must be distinguishable by status
// code alone: PixULA maps 204 (and only 204) to "the artist pressed
// Escape" and reports it silently, so any real failure answering the same
// way would vanish without a message. See
// js/services/companion-file-provider.js's chooseFolder.
func TestFoldersChooseDistinguishesCancelFromFailure(t *testing.T) {
	cases := []struct {
		name     string
		browseFn func(string) (string, error)
		wantCode int
	}{
		{"cancelled picker", func(string) (string, error) { return "", dialog.ErrCancelled }, http.StatusNoContent},
		{"picker failed", func(string) (string, error) { return "", errors.New("no display available") }, http.StatusInternalServerError},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := newServer()
			s.folders.browse = c.browseFn
			req := httptest.NewRequest(http.MethodPost, "/folders/choose", strings.NewReader(`{"label":"PixULA Backups"}`))
			rec := httptest.NewRecorder()
			s.handleFoldersChoose(rec, req)
			if rec.Code != c.wantCode {
				t.Errorf("got %d, want %d (body: %q)", rec.Code, c.wantCode, rec.Body.String())
			}
		})
	}
}

func TestFoldersChooseReturnsFolderID(t *testing.T) {
	dir := t.TempDir()
	s := newServer()
	s.folders.browse = func(string) (string, error) { return dir, nil }
	req := httptest.NewRequest(http.MethodPost, "/folders/choose", strings.NewReader(`{"label":"PixULA Backups"}`))
	rec := httptest.NewRecorder()
	s.handleFoldersChoose(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200 (body: %q)", rec.Code, rec.Body.String())
	}
	var body struct {
		FolderID string `json:"folderId"`
		Label    string `json:"label"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("bad JSON body: %v", err)
	}
	if body.FolderID == "" || body.Label != "PixULA Backups" {
		t.Fatalf("unexpected body: %+v", body)
	}
	if _, ok := s.folders.Resolve(body.FolderID, "file.txt"); !ok {
		t.Error("expected the returned folderId to resolve against the chosen folder")
	}
}

// Mtime is reported in MILLISECONDS since the epoch, matching the browser
// provider's file.lastModified. The two providers sit behind one interface,
// so a consumer must never have to ask which backend produced a timestamp.
func TestFolderListMtimeIsMilliseconds(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "v1.pixula"), []byte("x"), 0o644); err != nil {
		t.Fatalf("writing fixture: %v", err)
	}
	s := newServer()
	rec0 := folderRecord{ID: "f1", Label: "Test", Path: dir}
	s.folders.folders[rec0.ID] = rec0

	req := httptest.NewRequest(http.MethodGet, "/folders/f1/list", nil)
	req.SetPathValue("id", "f1")
	rec := httptest.NewRecorder()
	s.handleFolderList(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200 (body: %q)", rec.Code, rec.Body.String())
	}
	var entries []fileEntry
	if err := json.NewDecoder(rec.Body).Decode(&entries); err != nil {
		t.Fatalf("bad JSON body: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	info, err := os.Stat(filepath.Join(dir, "v1.pixula"))
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if entries[0].Mtime != info.ModTime().UnixMilli() {
		t.Errorf("mtime = %d, want %d (milliseconds, not seconds)", entries[0].Mtime, info.ModTime().UnixMilli())
	}
	// Guards against a silent revert to .Unix(): seconds-since-epoch is
	// ~1.7e9 today, milliseconds ~1.7e12, so this threshold separates them
	// unambiguously for any date between 2001 and the year 33658.
	if entries[0].Mtime < 1e12 {
		t.Errorf("mtime = %d looks like SECONDS, not milliseconds", entries[0].Mtime)
	}
}

func filepathHasPrefix(path, prefix string) bool {
	rel, err := filepath.Rel(prefix, path)
	return err == nil && rel != ".." && !os.IsPathSeparator(rel[0]) && rel[:2] != ".."+string(os.PathSeparator)
}
