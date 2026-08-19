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

func filepathHasPrefix(path, prefix string) bool {
	rel, err := filepath.Rel(prefix, path)
	return err == nil && rel != ".." && !os.IsPathSeparator(rel[0]) && rel[:2] != ".."+string(os.PathSeparator)
}
