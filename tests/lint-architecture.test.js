'use strict';
/**
 * Architecture guardrails — enforces the single-source-of-truth rules from
 * docs/REFACTOR_PLAN.md mechanically. Runs as part of `node tests/run-all.js`.
 *
 * Every rule exists because the source repo (H:\smsh) drifted on exactly that
 * point (see docs/UNIFICATION_AUDIT.md Part 1). A file may not land in this
 * tree violating any of them.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function fail(file, line, rule, text) {
  failures++;
  console.log(`FAIL [${rule}] ${file}:${line}  ${text.trim().slice(0, 100)}`);
}

/**
 * Every file under `dir` with one of `exts`.
 *
 * The extension used to be hardcoded to '.js', which quietly emptied every
 * pass that walked css/: the pictograph rule says it covers "js/, css/ and
 * index.html" and had in fact never read a stylesheet (found 2026-09-16 while
 * adding the vh rule below, which found nothing for the same reason).
 */
function walk(dir, out = [], exts = ['.js']) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out, exts);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const jsFiles = walk(path.join(ROOT, 'js'));

// Strip line comments and doc-comment lines so prose mentioning a pattern
// ("use Helpers.clamp, not Math.max(Math.min(...))") doesn't trip the rules.
function codeLines(src) {
  return src.split('\n').map((l) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
    return l;
  });
}

const RULES = [
  {
    name: 'inline-clamp',
    why: 'use Helpers.clamp / clamp()',
    re: /Math\.max\s*\([^;\n]*Math\.min|Math\.min\s*\([^;\n]*Math\.max/,
    allow: ['js/utils/helpers.js'],
  },
  {
    name: 'blob-download',
    why: 'only FormatRegistry.download / Helpers.downloadFile may create object URLs',
    re: /URL\.createObjectURL/,
    allow: ['js/utils/helpers.js', 'js/io/format-registry.js'],
  },
  {
    name: 'dom-in-logic-layer',
    why: 'core/services/tools must not touch the DOM (UI renders from bus events) — '
      + 'covers querying/creating nodes AND mutating an already-held element\'s '
      + 'inline style (a canvas owner can hold a real DOM node without ever '
      + 'calling querySelector/createElement, so style mutation needs its own check)',
    re: /\b(getElementById|querySelector(All)?|document\.createElement)\s*\(|\.style\.\w+\s*=|\.style\.(setProperty|removeProperty)\s*\(/,
    onlyUnder: ['js/core/', 'js/services/', 'js/tools/'],
    // Each entry owns a real DOM-attached element outright (not an offscreen
    // Helpers.createCanvas() scratch canvas, which is never styled): canvas-system
    // is the canvas/container owner; color-manager writes the --zx-* CSS custom
    // properties (the documented single source for that); input-handler sets
    // touch-action/user-select on the live canvas target; reference-layer-service
    // gets its canvas from CanvasSystem.createOverlayCanvas() (the one module
    // allowed to touch the DOM tree) but then owns that canvas's context, image
    // loads and inline size/position/display outright — the same shape of
    // exception the first two already have.
    allow: [
      'js/core/canvas-system.js',
      'js/core/color-manager.js',
      'js/core/input-handler.js',
      'js/services/reference-layer-service.js',
    ],
  },
  {
    name: 'event-string-literal',
    why: 'use EVENTS.* constants, never string channel names',
    re: /EventBus\s*\.\s*(emit|on|once|off)\s*\(\s*['"`]/,
    allow: ['js/core/event-bus.js'],
  },
  {
    name: 'shadow-dom',
    why: 'light-DOM components only (theming + data-i18n cannot pierce shadow roots)',
    re: /attachShadow/,
    allow: [],
  },
  {
    name: 'onclick-assignment',
    why: 'use addEventListener or delegation',
    re: /\.on(click|dblclick|change|input|submit|mousedown|mouseup|mousemove|keydown|keyup|keypress|pointerdown|pointerup|pointermove|touchstart|touchend|contextmenu)\s*=[^=]/,
    allow: [],
  },
  {
    name: 'hardcoded-screen-geometry',
    why: 'SCR/bitmap sizes come from the active SCREEN_MODES descriptor (constants.js)',
    re: /\b(6912|6144)\b/,
    allow: ['js/core/constants.js'],
    // This rule is about CODE typing a screen size instead of reading it from
    // the descriptor, so it is scoped to the code. js/data/ holds generated
    // blobs - the pattern bitmaps, the ROM font, the manual - where a matching
    // four digits is either data the registry itself produced (the manual
    // prints "6912 bytes" because describeScreenMode() said so) or a chance
    // run inside base64, which is where this first bit. Neither is a
    // programmer hardcoding geometry, and neither is fixable in the file,
    // since the file is generated.
    notUnder: ['js/data/'],
  },
];

for (const file of jsFiles) {
  const r = rel(file);
  const lines = codeLines(fs.readFileSync(file, 'utf8'));
  for (const rule of RULES) {
    if (rule.allow.includes(r)) continue;
    if (rule.onlyUnder && !rule.onlyUnder.some((d) => r.startsWith(d))) continue;
    if (rule.notUnder && rule.notUnder.some((d) => r.startsWith(d))) continue;
    lines.forEach((line, i) => {
      if (rule.re.test(line)) fail(r, i + 1, rule.name, `${line}  -> ${rule.why}`);
    });
  }
}

/*
 * No emoji or pictographs, anywhere - including inside comments, which is why
 * this pass reads the RAW file rather than codeLines().
 *
 * They are multi-byte sequences, often with variation selectors, and they
 * corrupt across encodings, render as tofu where the font has no coverage,
 * misalign monospaced output and turn into noise in diffs and grep. A UI label
 * built from one also cannot be translated. The app has a drawn SVG sprite for
 * every icon it needs, and words for every status it reports.
 *
 * Deliberately NOT flagged: box drawing (U+2500-257F) in the ASCII diagrams,
 * typographic punctuation, and the maths and scientific symbols that carry
 * meaning here - the degree sign in "90 deg" and the multiplication sign in
 * "256x192" are the notation, not decoration.
 */
const PICTOGRAPH_RANGES = [
  [0x1F000, 0x1FAFF],   // emoji blocks
  [0x2600, 0x27BF],     // misc symbols and dingbats: check marks, warning signs
  [0x2B00, 0x2BFF],     // misc symbols and arrows
  [0x2190, 0x21FF],     // arrows
  [0x2900, 0x297F],     // supplemental arrows
];
const VARIATION_SELECTOR_16 = 0xFE0F;

function firstPictograph(line) {
  for (const ch of line) {
    const cp = ch.codePointAt(0);
    if (cp === VARIATION_SELECTOR_16) return ch;
    for (const [lo, hi] of PICTOGRAPH_RANGES) if (cp >= lo && cp <= hi) return ch;
  }
  return null;
}

const textFiles = [
  ...jsFiles,
  ...['index.html'].map((f) => path.join(ROOT, f)),
  ...walk(path.join(ROOT, 'css'), [], ['.css']),
];
for (const file of textFiles) {
  if (!fs.existsSync(file)) continue;
  const r = rel(file);
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const ch = firstPictograph(line);
    if (!ch) return;
    const cp = 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    fail(r, i + 1, 'pictograph',
      `${line.trim().slice(0, 70)}  -> ${cp} - use words, "->", or an SVG sprite icon`);
  });
}

/*
 * A height measured in `vh` must be paired with the same height in `dvh`.
 *
 * On a phone or tablet `vh` is the LARGE viewport - the height the page would
 * have if the browser's address bar were hidden - so anything sized by it is
 * taller than what is actually on screen. The app found this the hard way
 * (2026-09-16): the reset's `body { min-height: 100vh }` made the page taller
 * than the visible area while `overflow: hidden` stopped it being scrolled to,
 * so the bottom of the app - the status bar and the canvas controls - sat
 * under the browser's own chrome with no way to reach it, and the dialogs'
 * `max-height: 90vh` could take their buttons off screen the same way.
 *
 * `dvh` is the visible viewport and follows the bar as it hides and shows. The
 * `vh` line stays as the fallback for anything that does not know `dvh`, so
 * the rule is "paired", not "banned". A `vh` inside a comment is prose.
 */
// Matches the declaration anywhere in the line, so a one-line rule
// (`.x { max-height: 70vh; }`) is caught as well as the app's usual
// one-declaration-per-line form. The pairing may be on the same line or the
// next one, which is how both forms are written.
// `\bvh\b` would never match: in `70vh` the digit and the unit are both word
// characters, so there is no boundary in front of the `v`. The digit is part
// of the pattern instead, which also stops `90dvh` matching as a bare `vh`.
const HEIGHT_VH = /(min-height|max-height|height)\s*:\s*[^;}]*?\d\s*vh\b/g;
for (const file of walk(path.join(ROOT, 'css'), [], ['.css'])) {
  const r = rel(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  // Block-comment state, so PROSE about a rule ("the global grid sets
  // max-height: 40vh, we must not apply it here") is not read as the rule.
  const inComment = [];
  let open = false;
  for (const line of lines) {
    const started = line.indexOf('/*');
    const ended = line.lastIndexOf('*/');
    inComment.push(open || (started >= 0 && ended < started));
    if (started >= 0 && ended < started) open = true;
    else if (ended >= 0 && open && ended > line.indexOf('/*')) open = false;
  }
  lines.forEach((line, i) => {
    if (inComment[i] || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
    // The pair may be on this line or on the next DECLARATION - a comment
    // between the two is still a pair.
    let here = line;
    for (let j = i + 1; j < lines.length && j <= i + 8; j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith('/*') || t.startsWith('*') || inComment[j]) continue;
      here += '\n' + lines[j];
      break;
    }
    for (const m of line.matchAll(HEIGHT_VH)) {
      const prop = m[1];
      const paired = new RegExp(`${prop}\\s*:\\s*[^;}]*dvh\\b`);
      if (paired.test(here)) continue;
      fail(r, i + 1, 'vh-without-dvh',
        `${line.trim()}  -> follow it with the same ${prop} in dvh (vh is the ` +
        'address-bar-hidden height; the bottom ends up off screen on a tablet)');
    }
  });
}

// index.html rules: no inline hex colours (palette single source is constants.js),
// no inline event handlers.
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  fs.readFileSync(indexPath, 'utf8').split('\n').forEach((line, i) => {
    if (/style\s*=\s*"[^"]*#[0-9a-fA-F]{3,8}\b/.test(line)) {
      fail('index.html', i + 1, 'inline-colour', `${line} -> generate from ZX_PALETTE / use tokens`);
    }
    if (/\son(click|change|input|load|mouse\w+|key\w+)\s*=\s*"/.test(line)) {
      fail('index.html', i + 1, 'inline-handler', `${line} -> wire in the owning component`);
    }
  });
}

console.log(
  failures === 0
    ? `lint-architecture: ${jsFiles.length} JS file(s) clean\n\nALL CHECKS PASSED`
    : `\n${failures} ARCHITECTURE VIOLATION(S)`
);
process.exit(failures ? 1 : 0);
