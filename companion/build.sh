#!/usr/bin/env bash
# companion/build.sh - attempt a cross-compile of the companion for all
# four v1 platforms from whatever machine this runs on.
#
# Cross-compiling is NOT guaranteed to work for every target from every
# host: the companion depends on github.com/sqweek/dialog for the native
# folder picker, and that package needs cgo + the real OS toolchain on
# darwin, and has a bug in its non-cgo Linux fallback (no tagged release
# exists to pin around it as of 2026-08-19 - see companion/README.md).
# So this script does NOT assume success. It tries each target, records
# whether that target's `go build` actually exited 0, and prints a
# summary at the end so you can see the status of all four attempts
# rather than stopping at the first failure.
#
# Exit code: non-zero only if the windows/amd64 build failed - that is
# the one target guaranteed to work on a Windows dev machine (a native,
# non-cross build), so its failure means something is actually broken
# in this tree. A darwin or linux failure is reported but does not fail
# the script by itself.
set -uo pipefail
cd "$(dirname "$0")"

mkdir -p dist

# target id, GOOS, GOARCH, output filename
TARGETS=(
  "windows-amd64|windows|amd64|pixula-companion-windows-amd64.exe"
  "darwin-amd64|darwin|amd64|pixula-companion-darwin-amd64"
  "darwin-arm64|darwin|arm64|pixula-companion-darwin-arm64"
  "linux-amd64|linux|amd64|pixula-companion-linux-amd64"
)

declare -a RESULT_NAMES=()
declare -a RESULT_STATUS=()
declare -a RESULT_DETAIL=()
WINDOWS_OK=1

for entry in "${TARGETS[@]}"; do
  IFS='|' read -r name goos goarch out <<<"$entry"
  echo "==> building $name"
  log="$(mktemp)"
  if GOOS="$goos" GOARCH="$goarch" go build -o "dist/$out" . >"$log" 2>&1; then
    RESULT_NAMES+=("$name")
    RESULT_STATUS+=("ok")
    RESULT_DETAIL+=("dist/$out")
    [ "$name" = "windows-amd64" ] && WINDOWS_OK=0
  else
    RESULT_NAMES+=("$name")
    RESULT_STATUS+=("FAILED")
    # first line of the error is usually the most useful one to summarise
    RESULT_DETAIL+=("$(head -n 1 "$log")")
    echo "    $name failed - see full output below"
    cat "$log"
  fi
  rm -f "$log"
done

echo
echo "==> summary"
for i in "${!RESULT_NAMES[@]}"; do
  printf '  %-16s %-6s %s\n' "${RESULT_NAMES[$i]}" "${RESULT_STATUS[$i]}" "${RESULT_DETAIL[$i]}"
done

echo
if [ -n "$(ls -A dist 2>/dev/null)" ]; then
  echo "==> dist/ contents"
  ls -la dist/
fi

if [ "$WINDOWS_OK" -ne 0 ]; then
  echo
  echo "windows/amd64 build failed - that target is a native build on this" \
       "host and is expected to always succeed. Treating this as a real" \
       "failure."
  exit 1
fi

exit 0
