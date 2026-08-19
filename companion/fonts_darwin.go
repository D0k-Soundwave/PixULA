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
