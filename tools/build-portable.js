'use strict';
/**
 * build-portable.js — regenerate the contained/portable build of the app so
 * it always matches the source. Run manually (`node tools/build-portable.js`)
 * or let the post-commit hook (.githooks/post-commit) run it after every commit
 * that touches index.html / css / js.
 *
 * Produces one byte-faithful build (gitignored):
 *   PixULA_Distilled/  - folder copy: index.html + css/ + js/, the smallest
 *                        thing that runs from file:// (double-click index.html;
 *                        no server, no install, no internet)
 *
 * The single-file inline build (PixULA_Distilled/PixULA_Inline/, formerly
 * PixULA_Micro/PixULA_Inline/) was removed 2026-08-12 - the folder copy alone
 * covers the "no build, no server" use case, and a second, larger artefact
 * that could silently drift from it was not worth carrying.
 * READMEs already in PixULA_Distilled/ are preserved.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DISTILLED = path.join(ROOT, 'PixULA_Distilled');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('build-portable: index.html not found at repo root'); process.exit(1);
}

// Clean css/ and js/ first so deleted source files never linger in the copy.
fs.mkdirSync(DISTILLED, { recursive: true });
fs.rmSync(path.join(DISTILLED, 'css'), { recursive: true, force: true });
fs.rmSync(path.join(DISTILLED, 'js'), { recursive: true, force: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DISTILLED, 'index.html'));
fs.cpSync(path.join(ROOT, 'css'), path.join(DISTILLED, 'css'), { recursive: true });
fs.cpSync(path.join(ROOT, 'js'), path.join(DISTILLED, 'js'), { recursive: true });

console.log('build-portable: PixULA_Distilled/ refreshed');
