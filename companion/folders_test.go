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
