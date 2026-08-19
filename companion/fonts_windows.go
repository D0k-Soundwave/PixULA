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
