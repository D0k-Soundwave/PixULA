# PixULA contained build

`PixULA_Distilled/` holds a portable, self-contained copy of the app
(gitignored — it is generated, not source): `PixULA.html` + `css/` +
`js/`, plus the `LICENSE` and a generated `README.txt` that ship with it.
Runs from `file://` (double-click `PixULA.html`; no server, no install, no
internet).

It is byte-faithful to the source — same code, same load order. The only
difference from the source is the entry file's name: `index.html` is copied
to `PixULA.html` (2026-08-24). The dev tree's own `index.html` keeps its
name and is never touched.

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

## Releasing

The download on the Releases page is this same folder, zipped - but built by
CI from a clean checkout of the tag, never uploaded from a working copy. That
distinction matters: a local `PixULA_Distilled/` can be stale, and it can hold
files nothing references any more (it carried an abandoned 9.7 MB companion
binary for six days), and neither is visible by looking at the resulting zip.

To cut one:

1. Bump `APP_VERSION` in `js/core/constants.js`. It is the single source of
   truth for the version - the About box reads it, and so does the readme
   written into the build.
2. Commit it.
3. Tag and push:

```
git tag v<APP_VERSION>
git push origin v<APP_VERSION>
```

`.github/workflows/release.yml` does the rest. Every step is a gate, in order:

- **the tag must equal `APP_VERSION`**, or the release page and the running app
  would name different versions and nobody could tell which build they had;
- **`node tests/run-all.js` must pass** (it needs no install - all Node
  built-ins). The Playwright suite is deliberately not run here: it drives an
  installed Chrome, which the runner has no reason to have;
- the portable folder is built, zipped as `PixULA-<version>/` inside
  `PixULA-<version>.zip` so two downloads cannot unzip over each other, and
  published with `gh`. A tag carrying `-alpha`, `-beta` or `-rc` is marked a
  pre-release automatically.

A tag is public the moment it is pushed. The gates run before anything is
published, so a broken asset is never uploaded - but a bad tag has to be
deleted rather than edited.
