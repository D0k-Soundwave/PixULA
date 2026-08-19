//go:build windows

package main

import (
	"os"
	"path/filepath"
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
