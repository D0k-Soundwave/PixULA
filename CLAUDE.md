# PixULA - notes for Claude

PixULA is a zero-dependency, build-free browser app (open `index.html`); the
owner works on it only through Claude Code on the web and is not a programmer.
Finish work end to end: tested, merged to `main`, and released when asked.

## Releasing

When the owner asks to release, publish or ship, follow
`.claude/skills/release/SKILL.md` exactly. In short: bump `APP_VERSION` in
`js/core/constants.js`, regenerate the manual, test, merge to `main`. The
merge publishes the GitHub Release automatically
(`.github/workflows/release.yml`) and updates the GitHub Pages copy. Web
sessions cannot push tags - never try; the merge is the trigger.

## Testing

- `node tests/run-all.js` - the primary gate; must pass. It includes the
  architecture lint (`tests/lint-architecture.test.js`) and the translation
  check (`tests/i18n-parity.test.js`).
- `npm run test:browser` - the Playwright suite. In web sessions the
  SessionStart hook (`.claude/hooks/session-start.sh`) installs Playwright and
  points its Chrome channel at the container's Chromium. Tests that fail only
  in the cloud container are listed in the release skill.

## Rules the tests enforce

- New user-facing text needs a key in `js/i18n/en.js` AND all 12 other
  locale files, with the same `{placeholders}`.
- Parsers and other modules build messages with
  `Helpers.localizedMessage(key, englishFallback, params)`.
- After changing tools, menus, shortcuts, screen modes or formats, run
  `node tools/build-manual.js` - the in-app manual is generated from the
  running app and must not go stale (`npm run check:manual`).
- `.nojekyll` must stay at the repo root, or the GitHub Pages build breaks.
