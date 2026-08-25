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
const { ENTRY_FILENAME, build } = require('../tools/build-portable.js');

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

summary();
