# PixULA contained builds

`PixULA_Micro/` holds two portable, self-contained copies of the app (gitignored
— they are generated, not source):

- **`PixULA_Micro/`** — folder copy: `index.html` + `css/` + `js/`. Runs from
  `file://` (double-click `index.html`; no server, no install, no internet).
- **`PixULA_Micro/PixULA_Inline/index.html`** — the same app as ONE
  self-contained file, with every stylesheet and script inlined (no `css/`/`js/`
  folder needed).

Both are byte-faithful to the source — same code, same load order. Measured on
the 2026-08-07 build: the folder copy is `index.html` (39,600 B) + 6
stylesheets + 124 scripts; the single file is 2,823,646 B (2.69 MB) with all
130 of those inlined.

## Building

One source of truth: `tools/build-portable.js`. It refreshes the folder copy (clean
`css/`+`js/` re-copy, so deleted files never linger) and regenerates the
single-file build (external `<link>`/`<script>` inlined in document order, so
script execution order and `@layer` first-appearance order are preserved; the
canvas iframe's `srcdoc` is left untouched).

```
npm run build:portable   # or: node tools/build-portable.js
```

## Auto-sync (keep the builds in step with the source)

A tracked git hook, `.githooks/post-commit`, runs the build after any commit
that touches `index.html`, `css/`, `js/`, or the build script itself. It uses
`core.hooksPath`, which is a **local** git setting and is therefore NOT restored
by cloning. After a fresh clone, activate it once:

```
npm run setup-hooks      # git config core.hooksPath .githooks
```

That is the only manual step. From then on, commit the app as usual and
`PixULA_Micro/` + `PixULA_Micro/PixULA_Inline/` refresh themselves. (The hook is
post-commit, so the builds track each *committed* state, not uncommitted edits.)
