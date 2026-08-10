'use strict';
/**
 * build-portable.js — regenerate the contained/portable builds of the app so
 * they always match the source. Run manually (`node tools/build-portable.js`)
 * or let the post-commit hook (.githooks/post-commit) run it after every commit
 * that touches index.html / css / js.
 *
 * Produces two byte-faithful builds (gitignored):
 *   PixULA_Micro/                - folder copy: index.html + css/ + js/, the
 *                                  smallest thing that runs from file://
 *   PixULA_Micro/PixULA_Inline/  - single self-contained index.html, every
 *                                  stylesheet and script inlined into it
 *
 * The single-file build inlines external <link>/<script> in document order, so
 * script execution order and @layer first-appearance order are preserved. The
 * canvas iframe's srcdoc (its own inline <script>, no src=) is left untouched.
 * READMEs already in PixULA_Micro/ are preserved.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MICRO = path.join(ROOT, 'PixULA_Micro');
const INLINE = path.join(MICRO, 'PixULA_Inline');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('build-portable: index.html not found at repo root'); process.exit(1);
}

// ── 1. Folder copy ──────────────────────────────────────────────────────────
// Clean css/ and js/ first so deleted source files never linger in the copy.
fs.mkdirSync(MICRO, { recursive: true });
fs.rmSync(path.join(MICRO, 'css'), { recursive: true, force: true });
fs.rmSync(path.join(MICRO, 'js'), { recursive: true, force: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(MICRO, 'index.html'));
fs.cpSync(path.join(ROOT, 'css'), path.join(MICRO, 'css'), { recursive: true });
fs.cpSync(path.join(ROOT, 'js'), path.join(MICRO, 'js'), { recursive: true });

// ── 2. Single-file build ────────────────────────────────────────────────────
let html = rd('index.html');
let css = 0, js = 0;

html = html.replace(/<link\b[^>]*\bhref="(css\/[^"]+)"[^>]*>/g, (_m, href) => {
  css++;
  return `<!-- ${href} -->\n<style>\n${rd(href)}\n</style>`;
});
html = html.replace(/<script\b[^>]*\bsrc="(js\/[^"]+)"[^>]*><\/script>/g, (_m, src) => {
  js++;
  const code = rd(src).replace(/<\/script/gi, '<\\/script'); // defensive
  return `<!-- ${src} -->\n<script>\n${code}\n</script>`;
});

const leftover = (html.match(/(?:href="css\/|src="js\/)/g) || []).length;
if (leftover) { console.error(`build-portable: ${leftover} external ref(s) not inlined`); process.exit(1); }

fs.mkdirSync(INLINE, { recursive: true });
fs.writeFileSync(path.join(INLINE, 'index.html'), html, 'utf8');

const mb = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
console.log(`build-portable: folder copy refreshed; single file inlined ${css} css + ${js} js (${mb} MB)`);
