# PixULA contained build

`PixULA_Distilled/` holds a portable, self-contained copy of the app
(gitignored — it is generated, not source): `index.html` + `css/` + `js/`.
Runs from `file://` (double-click `index.html`; no server, no install, no
internet).

It is byte-faithful to the source — same code, same load order.

A single-file build with every stylesheet and script inlined
(`PixULA_Distilled/PixULA_Inline/`, formerly `PixULA_Micro/PixULA_Inline/`)
existed until 2026-08-12 and was removed: the folder copy alone already
covers the "no build, no server" use case, and a second, larger artefact
that could silently drift from it was not worth carrying.

## Building

One source of truth: `tools/build-portable.js`. It refreshes the folder copy
(clean `css/`+`js/` re-copy, so deleted files never linger).

```
npm run build:portable   # or: node tools/build-portable.js
```

## Auto-sync (keep the build in step with the source)

A tracked git hook, `.githooks/post-commit`, runs the build after any commit
that touches `index.html`, `css/`, `js/`, or the build script itself. It uses
`core.hooksPath`, which is a **local** git setting and is therefore NOT restored
by cloning. After a fresh clone, activate it once:

```
npm run setup-hooks      # git config core.hooksPath .githooks
```

That is the only manual step. From then on, commit the app as usual and
`PixULA_Distilled/` refreshes itself. (The hook is post-commit, so the build
tracks each *committed* state, not uncommitted edits.)
