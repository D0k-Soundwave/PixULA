'use strict';
/**
 * build-portable.js — regenerate the contained/portable build of the app so
 * it always matches the source. Run manually (`node tools/build-portable.js`)
 * or let the post-commit hook (.githooks/post-commit) run it after every commit
 * that touches index.html / css / js.
 *
 * Produces one byte-faithful build (gitignored):
 *   PixULA_Distilled/  - folder copy: PixULA.html + css/ + js/, the smallest
 *                        thing that runs from file:// (double-click
 *                        PixULA.html; no server, no install, no internet)
 *
 * css/ and js/ are byte-faithful copies of the source; the HTML is
 * byte-faithful too except for its filename - index.html is renamed to
 * PixULA.html (2026-08-24). The dev tree's own index.html is never touched
 * or renamed.
 *
 * The single-file inline build (PixULA_Distilled/PixULA_Inline/, formerly
 * PixULA_Micro/PixULA_Inline/) was removed 2026-08-12 - the folder copy alone
 * covers the "no build, no server" use case, and a second, larger artefact
 * that could silently drift from it was not worth carrying.
 *
 * LICENSE and README.txt are written on every build (2026-08-30). The licence
 * is a distribution obligation - PixULA is GPL-3.0-or-later, and until this
 * the folder someone downloaded carried no licence text at all - and the
 * readme is GENERATED rather than hand-placed so it cannot fall out of step
 * with the version it names. Anything else already in the folder is left
 * alone; only css/, js/ and the entry file are cleaned.
 */
const fs = require('fs');
const path = require('path');

const ENTRY_FILENAME = 'PixULA.html';
const REPO_URL = 'https://github.com/D0k-Soundwave/PixULA';

/**
 * The app's version, read from its single source of truth.
 *
 * `APP_VERSION` in js/core/constants.js says of itself that there is no build
 * step to stamp it into and that it is bumped by hand per release, so this
 * reads that constant rather than introducing a second place to be wrong.
 * @param {string} root
 * @returns {string}
 */
function appVersion(root) {
  const src = fs.readFileSync(path.join(root, 'js', 'core', 'constants.js'), 'utf8');
  const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('build-portable: APP_VERSION not found in js/core/constants.js');
  return m[1];
}

/**
 * The note that ships beside the app.
 *
 * Plain .txt, not .md: this is read by whoever unzipped the folder, on
 * whatever they had to hand, and a .txt opens on a double-click where a .md
 * may not.
 * @param {string} root
 * @returns {string}
 */
function readmeText(root) {
  return [
    'PixULA ' + appVersion(root),
    '',
    'A pixel art editor for the ZX Spectrum and ZX Spectrum Next.',
    '',
    'TO RUN IT',
    '  Double-click PixULA.html. It opens in your browser and that is all',
    '  there is to it - no install, no server, and no internet connection.',
    '  Any reasonably modern browser will do.',
    '',
    'YOUR WORK STAYS ON THIS MACHINE',
    '  PixULA has no network access of any kind. Nothing you draw is sent',
    '  anywhere. Pictures are saved where you choose to save them.',
    '',
    'LICENCE',
    '  GNU General Public License v3.0 or later - the full text is in the',
    '  LICENSE file beside this one. PixULA is free software: you may use,',
    '  study, share and change it.',
    '',
    'SOURCE AND ISSUES',
    '  ' + REPO_URL,
    ''
  ].join('\n');
}

function build() {
  const ROOT = path.resolve(__dirname, '..');
  const DISTILLED = path.join(ROOT, 'PixULA_Distilled');
  const indexPath = path.join(ROOT, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('build-portable: index.html not found at repo root'); process.exit(1);
  }

  // Clean css/ and js/ first so deleted source files never linger in the copy.
  fs.mkdirSync(DISTILLED, { recursive: true });
  fs.rmSync(path.join(DISTILLED, 'css'), { recursive: true, force: true });
  fs.rmSync(path.join(DISTILLED, 'js'), { recursive: true, force: true });
  // Stale from 2026-08-30, when the manual was briefly a folder beside the app.
  // It lives in js/data/manual-content.js now and travels with js/.
  fs.rmSync(path.join(DISTILLED, 'manual'), { recursive: true, force: true });
  // Stale name from before the 2026-08-24 rename - never left behind so an
  // artist can't end up with two half-matching entry points in one folder.
  fs.rmSync(path.join(DISTILLED, 'index.html'), { force: true });

  fs.copyFileSync(indexPath, path.join(DISTILLED, ENTRY_FILENAME));
  fs.cpSync(path.join(ROOT, 'css'), path.join(DISTILLED, 'css'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'js'), path.join(DISTILLED, 'js'), { recursive: true });


  // Re-copied rather than copied-if-missing, so an amended licence reaches the
  // build the same way an amended source file does.
  const licensePath = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(licensePath)) {
    fs.copyFileSync(licensePath, path.join(DISTILLED, 'LICENSE'));
  }
  fs.writeFileSync(path.join(DISTILLED, 'README.txt'), readmeText(ROOT), 'utf8');

  console.log('build-portable: PixULA_Distilled/ refreshed');
}

if (require.main === module) {
  build();
}

module.exports = { ENTRY_FILENAME, REPO_URL, appVersion, readmeText, build };
