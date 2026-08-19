package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
