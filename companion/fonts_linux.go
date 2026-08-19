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
