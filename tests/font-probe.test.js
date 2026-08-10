'use strict';
/**
 * FontProbe's tables - the parts that can be wrong without anything failing.
 *
 * The detection itself needs a real browser and lives in
 * tests/browser/text-fonts.spec.js. What is checkable here is the data, and
 * the data has a specific way of going quietly wrong: an ALIASES entry whose
 * key is not in CANDIDATES can never fire, because a family is only considered
 * for suppression if it was detected first. That happened while this was being
 * written - 'Courier' and 'Arial Unicode MS' sat in ALIASES and in no candidate
 * list, so the table looked like it was doing work it could not do, and a
 * verification run reported them "dropped" when they had simply never been
 * there.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
global.Helpers = { createCanvas: () => null };   // no canvas in Node; detect() returns []

loadModule('js/utils/font-probe.js');

const src = require('fs').readFileSync('js/utils/font-probe.js', 'utf8');
const names = (block) => [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);
const CANDIDATES = names(src.match(/const CANDIDATES = Object\.freeze\(\[([\s\S]*?)\]\);/)[1]);
const aliasBlock = src.match(/const ALIASES = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
const aliasPairs = [...aliasBlock.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]);

check('the candidate list is substantial', CANDIDATES.length >= 250, `${CANDIDATES.length}`);
check('exposed CANDIDATES matches the source list',
  FontProbe.CANDIDATES.length === CANDIDATES.length);

const dupes = CANDIDATES.filter((n, i) => CANDIDATES.indexOf(n) !== i);
check('no duplicate candidates', dupes.length === 0, dupes.join(', '));

const blank = CANDIDATES.filter(n => !n.trim());
check('no empty candidate names', blank.length === 0);

// The one that bit: an alias nobody probes for is an alias that does nothing
const orphanKeys = aliasPairs.filter(([k]) => !CANDIDATES.includes(k)).map(([k]) => k);
check('every ALIASES key is a candidate (or the entry can never fire)',
  orphanKeys.length === 0, orphanKeys.join(', '));

const orphanTargets = aliasPairs.filter(([, v]) => !CANDIDATES.includes(v)).map(([, v]) => v);
check('every ALIASES target is a candidate (or suppression can never match)',
  orphanTargets.length === 0, orphanTargets.join(', '));

check('no alias points at itself', aliasPairs.every(([k, v]) => k !== v));
check('no alias chains (a target is never itself an alias key)',
  aliasPairs.every(([, v]) => !aliasPairs.some(([k2]) => k2 === v)),
  aliasPairs.filter(([, v]) => aliasPairs.some(([k2]) => k2 === v)).map(p => p.join('->')).join(', '));

// Sitka is the worked example in the header: the bare family does not exist on
// Windows, so listing it finds nothing while the six optical sizes are missed.
check('Sitka is listed by its optical-size families, not as a bare name',
  !CANDIDATES.includes('Sitka') &&
  ['Sitka Text', 'Sitka Small', 'Sitka Banner', 'Sitka Display',
   'Sitka Heading', 'Sitka Subheading'].every(n => CANDIDATES.includes(n)));

check('detect() survives having no canvas and returns an array',
  Array.isArray(FontProbe.detect()) && FontProbe.detect().length === 0);

summary();
