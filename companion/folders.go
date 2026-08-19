package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	// browse opens the OS's own folder picker. It is a field rather than a
	// direct call so the choose route's cancelled-vs-failed handling can be
	// tested without a real native dialog; production always uses the
	// dialog package, wired in newFolderStore.
	browse func(label string) (string, error)
}

func newFolderStore() *folderStore {
	return &folderStore{
		folders: make(map[string]folderRecord),
		browse: func(label string) (string, error) {
			return dialog.Directory().Title("Choose a folder for PixULA: " + label).Browse()
		},
	}
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

	// The check above is purely lexical. It does not protect against a
	// symlink (or, on Windows, a junction/reparse point) sitting inside the
	// authorized folder and pointing outside it - lexically the joined path
	// stays under root, but the OS would follow the link and actually touch
	// a file elsewhere. Resolve the REAL path and check it against the REAL
	// root too. target may not exist yet (a PUT creating a new file), so
	// walk up to the nearest existing ancestor and resolve that instead -
	// this also catches a symlinked directory placed inside the authorized
	// folder before any file under it exists.
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", false // authorized folder itself vanished/unreadable
	}
	checkPath := target
	for {
		real, err := filepath.EvalSymlinks(checkPath)
		if err == nil {
			if real != realRoot && !strings.HasPrefix(real, realRoot+string(os.PathSeparator)) {
				return "", false
			}
			break
		}
		parent := filepath.Dir(checkPath)
		if parent == checkPath {
			break // reached filesystem root without finding an existing ancestor
		}
		checkPath = parent
	}
	// Known residual limitation, deliberately not closed here: there is a
	// TOCTOU window between this check and the actual os.Open/os.Create/
	// os.Remove call - a symlink could theoretically be swapped in between.
	// Closing that needs platform-specific O_NOFOLLOW-style opens and is
	// disproportionate for a v1 local single-user companion process.
	return target, true
}

func (fs *folderStore) Choose(label string) (folderRecord, error) {
	dir, err := fs.browse(label)
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

// -- HTTP handlers -----------------------------------------------------

func (s *Server) handleFoldersChoose(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label string `json:"label"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	rec, err := s.folders.Choose(body.Label)
	if err != nil {
		// A cancelled picker and a broken one must not look the same to
		// PixULA: 204 (nothing chosen) is the ONE response the client maps
		// to "the artist pressed Escape" and reports silently. Anything
		// else - a picker that could not open, an OS-level failure - is a
		// real error the client surfaces, exactly like the browser
		// provider, which swallows only AbortError and rethrows the rest.
		if errors.Is(err, dialog.ErrCancelled) {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Error(w, "folder picker failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"folderId": rec.ID, "label": rec.Label})
}

func (s *Server) handleFoldersList(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.folders.List())
}

type fileEntry struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	// Mtime is MILLISECONDS since the Unix epoch, matching what the browser
	// provider reports (File.lastModified) and JavaScript's own Date.now().
	// The two providers are interchangeable behind one interface, so a
	// consumer must never have to ask which backend produced a timestamp.
	Mtime int64 `json:"mtime"`
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
		out = append(out, fileEntry{Name: e.Name(), Size: info.Size(), Mtime: info.ModTime().UnixMilli()})
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
