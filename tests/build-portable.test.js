'use strict';
/**
 * The portable build's entry-file rename - real filesystem work, since the
 * whole point of the rename is what actually lands in PixULA_Distilled/.
 * Byte-faithfulness (source in, source out, only the entry filename
 * differs) is exactly the claim docs/PORTABLE_BUILDS.md makes, so this
 * checks it against the real repo tree rather than a synthetic fixture.
 */
const fs = require('fs');
const path = require('path');
const { check, summary } = require('./helpers/zx-stubs');
const { ENTRY_FILENAME, appVersion, build } = require('../tools/build-portable.js');

check('entry filename is PixULA.html', ENTRY_FILENAME === 'PixULA.html');

const ROOT = path.resolve(__dirname, '..');
const DISTILLED = path.join(ROOT, 'PixULA_Distilled');

build();

const entryPath = path.join(DISTILLED, ENTRY_FILENAME);
check('build() writes the renamed entry file', fs.existsSync(entryPath));
check('build() leaves no stale index.html behind',
  !fs.existsSync(path.join(DISTILLED, 'index.html')));

const sourceHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builtHtml = fs.readFileSync(entryPath, 'utf8');
check('the built entry file is byte-identical to the source (only the filename differs)',
  builtHtml === sourceHtml);

check('css/ and js/ were copied', fs.existsSync(path.join(DISTILLED, 'css')) &&
  fs.existsSync(path.join(DISTILLED, 'js')));

// -- what a downloader actually receives ------------------------------------
// The folder someone unzips is the whole product to them, and until 2026-08-30
// it carried no licence text at all - PixULA is GPL-3.0-or-later, which
// requires the licence to travel with it.
const licenseOut = path.join(DISTILLED, 'LICENSE');
check('the build carries the licence', fs.existsSync(licenseOut));
check('and it is the same licence the repo ships, byte for byte',
  fs.existsSync(licenseOut) &&
  fs.readFileSync(licenseOut).equals(fs.readFileSync(path.join(ROOT, 'LICENSE'))));

// Generated, not hand-placed, so it cannot name a version the build is not.
const readmeOut = path.join(DISTILLED, 'README.txt');
const readme = fs.existsSync(readmeOut) ? fs.readFileSync(readmeOut, 'utf8') : '';
check('the build carries a readme', !!readme);
check('the readme names the version the app reports',
  readme.includes(appVersion(ROOT)));
check('the readme says how to start it', readme.includes(ENTRY_FILENAME));

// APP_VERSION is the single source of truth and the release tag is checked
// against it, so a build that cannot read it must fail loudly, not silently
// ship an unnamed version.
check('the version comes from APP_VERSION in constants.js',
  appVersion(ROOT) ===
    fs.readFileSync(path.join(ROOT, 'js', 'core', 'constants.js'), 'utf8')
      .match(/APP_VERSION\s*=\s*'([^']+)'/)[1]);

summary();
