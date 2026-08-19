# PixULA Companion

Optional local helper that gives PixULA real folder access and OS-font
access without repeated browser permission prompts. PixULA works fully
without this; see `docs/COMPANION.md` in the repo root for what it does
and why.

## Build

    cd companion
    ./build.sh

`build.sh` attempts all four v1 targets (Windows/amd64, macOS/amd64,
macOS/arm64, Linux/amd64) and prints a summary of which ones actually
succeeded; it puts anything that builds into `dist/` (never committed -
see `.gitignore`). It does not assume all four will succeed, and as of
2026-08-19 only the windows/amd64 build reliably does, for a reason
outside this repo's own code: the native folder picker depends on
`github.com/sqweek/dialog`, which needs cgo plus the real OS toolchain to
build for its target, so it cannot be cross-compiled from an unrelated
host OS in the general case.

- **Same-OS builds work.** Building on the target OS itself uses cgo and
  the real system toolchain (MSVC/mingw on Windows, Xcode command line
  tools on macOS, gcc/clang on Linux), which is the supported way to get
  a working binary for that OS. `./build.sh` run natively on that OS will
  build its own target.
- **Cross-compiling to darwin from another OS does not work and has no
  workaround here.** `dialog`'s darwin implementation needs cgo bindings
  into the Cocoa framework, which requires either building on an actual
  Mac or a macOS SDK/cross-toolchain (e.g. osxcross) that this project
  does not set up. This is a structural limitation of cross-compiling
  cgo to darwin, not a bug in this repo.
- **Cross-compiling to linux from another OS is currently broken
  upstream.** Without cgo enabled (the normal state when cross-compiling),
  `go build` uses `dialog`'s non-cgo Linux fallback, and that fallback has
  a bug as of the `v0.0.0-20260123140253-64c163d53aac` pseudo-version this
  module resolves to (`go list -m -versions github.com/sqweek/dialog`
  returns no tagged releases to pin around it): several call sites use
  lowercase, unexported method names (`b.yesNo`, `b.info`, `b.error`,
  `b.load`, `b.save`, `b.browse`) where only the exported `YesNo`/`Info`/
  `Error`/`Load`/`Save`/`Browse` exist, so the package fails to compile.
  Getting a linux binary today needs either building natively on Linux
  with cgo enabled (which uses `dialog`'s cgo path instead of the broken
  fallback) or an upstream fix to `sqweek/dialog`.

## Test

    go test ./...

## Run

    ./dist/pixula-companion-<platform>
