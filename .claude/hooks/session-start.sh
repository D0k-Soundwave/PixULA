#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Makes a fresh cloud session able to run everything a release needs:
#   - `npm install` brings in the one dev dependency (@playwright/test) that
#     the browser suite (`npm run test:browser`) and the manual builder
#     (`node tools/build-manual.js`) drive Chrome with;
#   - both of those launch Playwright's `channel: 'chrome'` - an INSTALLED
#     Google Chrome, which a cloud container does not have. It does ship a
#     Chromium (PLAYWRIGHT_BROWSERS_PATH, /opt/pw-browsers), so Chrome's
#     expected path is pointed at that. Nothing in the repo changes.
#
# Local machines are left alone: they have their own Chrome and node_modules.
# Idempotent and non-interactive; a missing browser is a warning, not a failed
# session, because the Node suite (`node tests/run-all.js`) needs neither.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "session-start: installing dev dependencies (Playwright)..."
npm install --no-audit --no-fund --loglevel=error

CHROME=/opt/google/chrome/chrome
if [ ! -x "$CHROME" ]; then
  CHROMIUM=""
  for candidate in \
      "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}/chromium" \
      "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"/chromium-*/chrome-linux/chrome; do
    if [ -x "$candidate" ]; then CHROMIUM="$candidate"; break; fi
  done
  if [ -n "$CHROMIUM" ] && mkdir -p "$(dirname "$CHROME")" 2>/dev/null \
      && ln -sf "$CHROMIUM" "$CHROME" 2>/dev/null; then
    echo "session-start: Chrome channel -> $CHROMIUM"
  else
    echo "session-start: WARNING - no Chromium found to stand in for Chrome;" \
         "browser tests and the manual build will not run (Node tests still will)." >&2
  fi
fi

echo "session-start: ready (node tests/run-all.js, npm run test:browser, npm run build:manual)"
