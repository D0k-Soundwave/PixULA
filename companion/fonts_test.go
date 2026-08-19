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
