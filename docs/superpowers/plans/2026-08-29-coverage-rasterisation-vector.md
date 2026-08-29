# Coverage Rasterisation, Vector Half - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide every system-font stamp pixel from area COVERAGE instead of one alpha sample, and rasterise rotated text THROUGH the transform, so a stamp stops losing ~28% of its stroke weight and stops coming apart into extra pieces.

**Architecture:** A new pure `CoverageOps` module owns the coverage domain and its two boundary functions. `TextTool._rasterizeRaw` computes coverage by supersampling and thresholds once, which fixes untransformed text. A new `TextTool._renderThrough` puts the rotation into the canvas matrix so the font engine rasterises an already-turned outline, which fixes rotated text; `SelectionService._recomputeStampTransform` routes vector text stamps to it. Bitmap fonts and 1-bit artwork are untouched by this plan.

**Tech Stack:** Vanilla ES2020, IIFE singletons on `window`, no build step, no dependencies. Node test harness (`tests/run-all.js`, stubs in `tests/helpers/zx-stubs.js`, no framework). Playwright for browser specs (the only dev dependency).

**Spec:** `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md`

**Scope note:** The spec covers two separable subsystems. This plan is the VECTOR half (spec section 4.2 plus the `fromMask`/`toMask` boundary of 4.1). The 1-bit half - the full coverage domain, `warp`, `toneCorrect`, the `_recomputeStampTransform` rewire for artwork, and the live budget of section 5 - is a second plan that builds on Task 1 of this one. The spec says the vector half "carries none of this risk" and "is separable from the rest of the design"; splitting sequences the work without reducing it.

**Deviation from the spec, deliberate:** Spec 4.2 says `_rasterizeRaw` "returns COVERAGE, not booleans". This plan has it compute coverage internally and return a thresholded mask, leaving its three callers untouched. Nothing in the vector half consumes the fractional values - spec 4.3 gets its coverage source from `_renderThrough`, not from `_rasterizeRaw` - so returning coverage here would be churn with no consumer. Plan 2 exposes it if the 1-bit path needs it. Task 3 Step 5 pins the two rasterisers against each other at 0 degrees so they cannot drift apart in the meantime.

## Global Constraints

Copied verbatim from the spec and from CLAUDE.md's mechanically-enforced rules. Every task's requirements implicitly include this section.

- `CoverageOps.SUPERSAMPLE = 8`. Spec section 6: ss=4 measures BELOW the shipped chain on a 1-bit source (0.973 against 0.976); render-through gains 0.959 against 0.937 at ss=8.
- `CoverageOps.INK_COVERAGE = 0.50`. Spec section 6: 0.959 at 0.50 against 0.938 at 0.40, tone 0.98 against 1.07. **This is NOT `font-rasterizer.js`'s 0.40** - that was measured for fitting glyphs into EIGHT ROWS, where a stem is ~0.7px wide. The two sites keep their own measured values and neither may be shared as a constant without re-measuring at the other's sizes.
- **`js/core/`, `js/services/` and `js/tools/` must not touch the DOM.** `tests/lint-architecture.test.js` rule `dom-in-logic-layer` matches `document.createElement(`, `getElementById`, `querySelector`, and `.style.x =`. `text-tool.js` is NOT on its allowlist. Use `Helpers.createCanvas(w, h)`. Setting `canvas.width`/`canvas.height` is fine; setting `canvas.style.*` is not, and is never needed for an offscreen buffer.
- **Never `Math.max(a, Math.min(b, c))` on one line** - rule `inline-clamp`. Use `Helpers.clamp`.
- **`EventBus.emit/on` take `EVENTS.*` constants, never string literals** - rule `event-string-literal`.
- **ASCII only in `js/`, `css/` and `index.html`, comments included.** The emoji/pictograph pass reads raw lines. Use `->` for arrows and words for status.
- Every new user-visible string needs a key in ALL 13 locale files or `tests/i18n-parity.test.js` fails the build. **This plan adds no user-visible strings.**
- `node tests/run-all.js` is the primary gate and must pass after every task. New Node suites need no registration - it globs `tests/*.test.js`.
- A post-commit hook rebuilds `PixULA_Distilled/`. Do not hand-edit that directory.

---

### Task 1: The coverage domain and its boundary

Creates the module both halves of the spec build on. Deliberately small: only the two boundary functions and the constants, because nothing in the vector half needs `transform`, `warp` or `toneCorrect`, and writing them here without a consumer would be untested speculation.

**Files:**
- Create: `js/utils/coverage-ops.js`
- Create: `tests/coverage-ops.test.js`
- Modify: `index.html` (add the script tag beside `js/utils/mask-ops.js`, line 469)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CoverageOps.SUPERSAMPLE` -> `8`
  - `CoverageOps.INK_COVERAGE` -> `0.50`
  - `CoverageOps.create(w, h)` -> `{ data: Float32Array, w: number, h: number }`
  - `CoverageOps.fromMask(mask: boolean[][])` -> `{ data, w, h }`
  - `CoverageOps.toMask(cov: {data,w,h}, threshold?: number)` -> `boolean[][]`
  - `CoverageOps.area(cov)` -> `number` (sum of all coverage; the honest denominator for a tone ratio)
  - `CoverageOps.get(cov, x, y)` -> `number` (0 outside bounds)
  - `CoverageOps.size(cov)` -> `{ w: number, h: number }` (mirrors `MaskOps.size`, so the two modules read alike)

- [ ] **Step 1: Write the failing test**

Create `tests/coverage-ops.test.js`:

```js
'use strict';
/**
 * CoverageOps - the coverage domain and its two boundary functions.
 *
 * A coverage buffer holds, per output pixel, the FRACTION of that pixel the
 * source covers. It exists because thresholding to 1 bit early and then
 * resampling the binary result destroys information no later step can
 * recover: measured, the finest possible resample of an already-thresholded
 * raster scores 0.311 where the crudest scores 0.309 (see
 * docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md).
 *
 * Float32Array rather than number[][] because a 640x256 stamp rotated is
 * ~393k output pixels, and this buffer is built and discarded on a slider.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/utils/coverage-ops.js');

const T = true, F = false;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- constants carry their measured justification (spec section 6) ----------
check('SUPERSAMPLE is 8 - ss=4 measures below the shipped chain on 1-bit',
  CoverageOps.SUPERSAMPLE === 8);
check('INK_COVERAGE is 0.50, NOT font-rasterizer.js 0.40 (different sizes)',
  CoverageOps.INK_COVERAGE === 0.50);

// -- create ----------------------------------------------------------------
const blank = CoverageOps.create(3, 2);
check('create: dimensions', blank.w === 3 && blank.h === 2);
check('create: Float32Array of w*h', blank.data instanceof Float32Array && blank.data.length === 6);
check('create: starts empty', CoverageOps.area(blank) === 0);
check('size: mirrors MaskOps.size', eq(CoverageOps.size(blank), { w: 3, h: 2 }));

// -- fromMask / toMask round trip -------------------------------------------
const mask = [[T, T, F], [F, F, T]];
const cov = CoverageOps.fromMask(mask);
check('fromMask: dimensions follow the mask', cov.w === 3 && cov.h === 2);
check('fromMask: set pixels are fully covered, clear ones not at all',
  CoverageOps.get(cov, 0, 0) === 1 && CoverageOps.get(cov, 2, 0) === 0);
check('fromMask -> toMask is the identity at any threshold in (0, 1]',
  eq(CoverageOps.toMask(cov, 0.01), mask) &&
  eq(CoverageOps.toMask(cov, 0.50), mask) &&
  eq(CoverageOps.toMask(cov, 1.00), mask));

// -- toMask thresholds, and defaults to INK_COVERAGE ------------------------
const partial = CoverageOps.create(2, 1);
partial.data[0] = 0.49;
partial.data[1] = 0.50;
check('toMask: >= threshold inks, < threshold does not',
  eq(CoverageOps.toMask(partial, 0.5), [[F, T]]));
check('toMask: default threshold is INK_COVERAGE',
  eq(CoverageOps.toMask(partial), CoverageOps.toMask(partial, CoverageOps.INK_COVERAGE)));

// -- area is the CONTINUOUS ink, which a threshold can destroy --------------
// A 25% field thresholds to nothing while still carrying real ink. That is
// the whole reason area() exists rather than counting the thresholded mask.
const sparse = CoverageOps.create(4, 4);
sparse.data.fill(0.25);
check('area: sums coverage, not inked pixels', Math.abs(CoverageOps.area(sparse) - 4) < 1e-6);
check('area: a sparse field thresholds to nothing but is NOT empty',
  CoverageOps.toMask(sparse, 0.5).every(r => r.every(v => v === false)) &&
  CoverageOps.area(sparse) > 0);

// -- bounds safety ----------------------------------------------------------
check('get: outside the buffer reads 0',
  CoverageOps.get(cov, -1, 0) === 0 && CoverageOps.get(cov, 0, -1) === 0 &&
  CoverageOps.get(cov, 3, 0) === 0 && CoverageOps.get(cov, 0, 2) === 0);
check('fromMask/toMask: empty input is safe',
  eq(CoverageOps.toMask(CoverageOps.fromMask([])), []));

summary();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/coverage-ops.test.js`
Expected: crash with `Cannot find module` or `CoverageOps is not defined` - the module does not exist yet.

- [ ] **Step 3: Write the module**

Create `js/utils/coverage-ops.js`:

```js
'use strict';
(function() {

/**
 * CoverageOps - the coverage domain.
 *
 * A coverage buffer holds, per output pixel, the FRACTION of that pixel its
 * source covers. It exists because the alternative - threshold to 1 bit first,
 * then resample the binary result - destroys information that no later step
 * can recover. Measured 2026-08-29: the FINEST possible resample of an
 * already-thresholded raster scores 0.311 against ground truth where the
 * crudest scores 0.309. Sixteen-times supersampling of a binary source buys
 * 0.002, so no better resampler will ever matter; the fix has to be upstream
 * of the threshold, which is what this domain is for.
 *
 * `MaskOps` keeps its boolean API and is unaffected - it serves tools, tests
 * and the hover footprint, none of which want a coverage buffer.
 *
 * Float32Array rather than a number[][]: a 640x256 stamp rotated is ~393k
 * output pixels, and this buffer is built and thrown away on every tick of a
 * slider drag.
 *
 * Pure and dependency-free (Node-tested in tests/coverage-ops.test.js).
 */
const CoverageOps = {

    /**
     * Subsamples per axis when measuring coverage.
     *
     * 8, measured. At 4 the result falls BELOW the nearest-neighbour chain it
     * replaces on a 1-bit source (0.973 against 0.976) - too coarse to resolve
     * the half-coverage tie-break - and rasterising a vector glyph through a
     * transform gains 0.959 against 0.937 by moving from 4 to 8.
     */
    SUPERSAMPLE: 8,

    /**
     * Ink where at least this fraction of the pixel is covered.
     *
     * 0.50, measured at stamp sizes: 0.959 against 0.938 at 0.40, with a tone
     * ratio of 0.98 against 1.07 - 0.40 fattens the letterforms here.
     *
     * `js/utils/font-rasterizer.js` measured 0.40 for the SAME decision and
     * that is not a contradiction to resolve by picking one. It fits glyphs
     * into eight rows, where a typical stem is ~0.7px wide and a half-pixel
     * test drops strokes that are unambiguously there. Stamps run at 16-64px.
     * The threshold is size-dependent; neither site may adopt the other's
     * value without re-measuring at its own sizes.
     */
    INK_COVERAGE: 0.50,

    /** @returns {{data: Float32Array, w: number, h: number}} an empty buffer */
    create(w, h) {
        return { data: new Float32Array(Math.max(0, w) * Math.max(0, h)), w, h };
    },

    /** @returns {{w: number, h: number}} */
    size(cov) {
        return { w: cov.w, h: cov.h };
    },

    /** Coverage at (x, y); 0 outside the buffer, so callers need no guard. */
    get(cov, x, y) {
        if (x < 0 || y < 0 || x >= cov.w || y >= cov.h) return 0;
        return cov.data[y * cov.w + x];
    },

    /**
     * Enter the domain. A set pixel is fully covered, a clear one not at all -
     * which is exactly what makes a 1-bit source's own coverage map lossless.
     * @param {boolean[][]} mask
     */
    fromMask(mask) {
        const h = mask.length;
        const w = h ? mask[0].length : 0;
        const cov = CoverageOps.create(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (mask[y][x]) cov.data[y * w + x] = 1;
            }
        }
        return cov;
    },

    /**
     * Leave the domain. This is the ONE quantisation the whole pipeline is
     * allowed, and it belongs at the very end - every threshold taken earlier
     * is information thrown away before anything downstream can use it.
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {number} [threshold=INK_COVERAGE]
     * @returns {boolean[][]}
     */
    toMask(cov, threshold = CoverageOps.INK_COVERAGE) {
        const out = [];
        for (let y = 0; y < cov.h; y++) {
            const row = new Array(cov.w);
            for (let x = 0; x < cov.w; x++) row[x] = cov.data[y * cov.w + x] >= threshold;
            out.push(row);
        }
        return out;
    },

    /**
     * Total continuous ink. The honest denominator for "did this keep the
     * right AMOUNT of ink", because the thresholded mask is empty for any
     * field too sparse to reach the cut anywhere - a 25% dither downscaled
     * has real ink and no inked pixels, and dividing by that produced tone
     * ratios of 576 while the bench was being written.
     */
    area(cov) {
        let sum = 0;
        for (let i = 0; i < cov.data.length; i++) sum += cov.data[i];
        return sum;
    }
};

window.CoverageOps = CoverageOps;

if (window.Logger) Logger.debug('CoverageOps', 'Coverage operations loaded');

})(); // End IIFE
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/coverage-ops.test.js`
Expected: `ALL CHECKS PASSED`

- [ ] **Step 5: Register the script**

In `index.html`, immediately after the `mask-ops.js` line (currently line 469):

```html
    <script defer src="js/utils/mask-ops.js"></script>
    <script defer src="js/utils/coverage-ops.js"></script>
```

It must come after `helpers.js` (line 467). It is a sibling of `mask-ops.js`, and neither may come to depend on the other.

- [ ] **Step 6: Run the full gate**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`, including `lint-architecture` and `i18n-parity`.

- [ ] **Step 7: Commit**

```bash
git add js/utils/coverage-ops.js tests/coverage-ops.test.js index.html
git commit -m "feat: a coverage domain, so the 1-bit threshold can happen once and last

Per-pixel coverage fractions, with the two functions that enter and leave
the domain. Thresholding early and resampling the binary result destroys
information nothing downstream can recover: measured, the finest possible
resample of an already-thresholded raster scores 0.311 where the crudest
scores 0.309.

Float32Array because a rotated full-canvas stamp is ~393k output pixels
built and discarded on every slider tick. MaskOps keeps its boolean API
untouched - tools, tests and the hover footprint all want that one."
```

---

### Task 2: Decide vector glyph pixels from coverage, not one alpha sample

The defect this plan exists for, and the larger half of the win. With NO transform at all - scale 1, 0 degrees - system-font text currently scores IoU 0.35 against a correct render at tone 0.72, and `ZX SPECTRUM` at 16px comes apart into 8 extra connected components. The cause is one line.

**Files:**
- Modify: `js/tools/text-tool.js` (`_rasterizeRaw`, around line 551)
- Create: `tests/browser/text-render-quality.spec.js`

**Interfaces:**
- Consumes: `CoverageOps.SUPERSAMPLE`, `CoverageOps.INK_COVERAGE` (Task 1).
- Produces: `TextTool._rasterizeRaw(text, fontFamily, fontSize, bold, italic)` -> `{ pixels: boolean[][], width: number, height: number }` - **signature and return shape unchanged**, so `_inkBounds`, `_trimMask` and `_stackRasterized` need no edit. Only the pixel decisions improve.

- [ ] **Step 1: Write the failing test**

This needs a real canvas and a real installed font, so it is a browser spec. Create `tests/browser/text-render-quality.spec.js`:

```js
'use strict';
/**
 * Vector text is rasterised from area COVERAGE, not from one alpha sample.
 *
 * `_rasterizeRaw` used to decide each pixel with `data[...+3] > 127`: one
 * sample, at the pixel centre. A typical sans stem is well under a pixel wide
 * at these sizes, so strokes that are unambiguously there scored under half
 * opacity at the centre and vanished. Measured before the fix: ink weight
 * 0.72 of a correct render, and `ZX SPECTRUM` at 16px broken into 8 more
 * connected components than it should have.
 *
 * These specs pin the two properties that would silently rot - stroke weight
 * and connectivity - without asserting exact pixel counts, which depend on the
 * installed font.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** 8-connected components of a bool[][] mask. */
const COMPONENTS = `(m) => {
    const h = m.length, w = h ? m[0].length : 0;
    const seen = Array.from({ length: h }, () => new Array(w).fill(false));
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!m[y][x] || seen[y][x]) continue;
        n++;
        const stack = [[x, y]];
        seen[y][x] = true;
        while (stack.length) {
            const [cx, cy] = stack.pop();
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
                const nx = cx + i, ny = cy + j;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (m[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
            }
        }
    }
    return n;
}`;

test('a word rasterises as one connected piece per word, not in fragments',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(([componentsSrc]) => {
            const components = eval(componentsSrc);
            const tool = ToolManager.getTool(TOOLS.TEXT);
            // Two words, so the correct answer is a small number of pieces -
            // letters may legitimately touch or not, but a stem shattering
            // into three is not legitimate.
            const m = tool._rasterizeWithFont('ZX SPECTRUM', 'Arial, sans-serif',
                16, false, false, 'horizontal');
            return { comps: components(m.pixels), w: m.width, h: m.height };
        }, [COMPONENTS]);

        // 11 glyphs; before the fix this measured 8 components MORE than the
        // reference render. Allowing one component per glyph plus slack still
        // catches the shattering, which produced far more.
        expect(r.comps).toBeLessThanOrEqual(13);
        expect(r.w).toBeGreaterThan(0);
        expect(r.h).toBeGreaterThan(0);
    });

test('stroke weight survives - a coverage decision inks what a centre sample missed',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (m) => m.pixels.reduce((n, row) => n + row.filter(Boolean).length, 0);

            // A high-resolution render of the same string, thresholded the same
            // way, is the reference: it has enough pixels that a centre sample
            // and a coverage measure agree. Scaling its ink down by the area
            // ratio gives what the small render SHOULD weigh.
            const small = tool._rasterizeWithFont('Hamburgefonstiv', 'Arial, sans-serif',
                16, false, false, 'horizontal');
            const large = tool._rasterizeWithFont('Hamburgefonstiv', 'Arial, sans-serif',
                128, false, false, 'horizontal');
            const areaRatio = (small.width * small.height) / (large.width * large.height);
            return { ratio: ink(small) / (ink(large) * areaRatio) };
        });

        // Before the fix this sat around 0.72 - roughly 28% of the stroke
        // weight simply absent. A correct render lands near 1.0; the window is
        // wide because the reference is itself a raster, not an outline.
        expect(r.ratio).toBeGreaterThan(0.88);
        expect(r.ratio).toBeLessThan(1.15);
    });

test('an empty or whitespace string still returns null rather than a blank mask',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            return {
                empty: tool._rasterizeWithFont('', 'Arial, sans-serif', 16, false, false, 'horizontal'),
                space: tool._rasterizeWithFont('   ', 'Arial, sans-serif', 16, false, false, 'horizontal')
            };
        });

        expect(r.empty).toBeNull();
        expect(r.space).toBeNull();
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: the stroke-weight spec FAILS with a ratio around 0.72, below the 0.88 floor. The connectivity spec may pass or fail depending on the installed font - the stroke-weight one is the definitive red.

- [ ] **Step 3: Rewrite `_rasterizeRaw` to measure coverage**

In `js/tools/text-tool.js`, replace the body of `_rasterizeRaw` (currently at line 551). The existing doc comment above it stays; add the new paragraph shown here.

```js
  /**
   * Rasterize a string to an UNTRIMMED mask. Split out of
   * `_rasterizeWithFont` because the vertical layouts need every character
   * measured against the same box: trimming each letter to its own ink first
   * would stack an 'o' and an 'A' at the same height and throw the baselines
   * away.
   *
   * Each output pixel is decided from the COVERAGE of an ss x ss block, not
   * from one alpha sample at its centre. That single sample is why this used
   * to lose about 28% of a string's stroke weight and break `ZX SPECTRUM` at
   * 16px into 8 extra pieces: a sans stem is well under a pixel wide at these
   * sizes, so a stroke that is unambiguously present scores under half opacity
   * at the exact centre and disappears. `js/utils/font-rasterizer.js` reached
   * the same conclusion for the Font Editor in 2026-08-19; this is that fix,
   * on the path the Font Editor does not use.
   *
   * @returns {{ pixels: boolean[][], width: number, height: number }}
   * @private
   */
  _rasterizeRaw(text, fontFamily, fontSize, bold, italic) {
    const ss = CoverageOps.SUPERSAMPLE;
    const weight  = bold   ? 'bold'   : 'normal';
    const style   = italic ? 'italic' : 'normal';

    // Measure at the FINAL size, then render at ss times it. Measuring at the
    // supersampled size and dividing would let a rounding difference in the
    // font's advance widths change the output box.
    const probe = Helpers.createCanvas(1, 1);
    const pctx = probe.getContext('2d');
    pctx.font = `${style} ${weight} ${fontSize}px "${fontFamily}"`;
    const w = Math.max(1, Math.ceil(pctx.measureText(text).width) + 2);
    const h = Math.max(1, Math.ceil(fontSize * 1.5));

    const off = Helpers.createCanvas(w * ss, h * ss);
    const ctx = off.getContext('2d');
    ctx.font = `${style} ${weight} ${fontSize * ss}px "${fontFamily}"`;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 1 * ss, 0);
    const data = ctx.getImageData(0, 0, w * ss, h * ss).data;

    // Box-filter each ss x ss block into one coverage fraction, then take the
    // single threshold this whole function exists to defer.
    const rowStride = w * ss;
    const samples = ss * ss;
    const cut = CoverageOps.INK_COVERAGE * 255 * samples;
    const pixels = [];
    for (let y = 0; y < h; y++) {
      const row = new Array(w);
      for (let x = 0; x < w; x++) {
        let alpha = 0;
        for (let j = 0; j < ss; j++) {
          const base = ((y * ss + j) * rowStride + x * ss) * 4 + 3;
          for (let i = 0; i < ss; i++) alpha += data[base + i * 4];
        }
        row[x] = alpha >= cut;
      }
      pixels.push(row);
    }

    return { pixels, width: w, height: h };
  }
```

Four things to notice while editing:
- `Helpers.createCanvas`, never `document.createElement('canvas')` - `text-tool.js` is under `js/tools/` and is not on the `dom-in-logic-layer` allowlist.
- The alpha sum is compared against a pre-multiplied cut rather than divided by `255 * samples` first. Same decision, one less division per pixel, and the inner loop runs once per subsample of every stamp.
- `fillText` is offset by `1 * ss`, matching the old `fillText(text, 1, 0)` at the new scale. Dropping the `* ss` shifts the glyph a fraction of a pixel and moves the ink bounds.
- **No existing Node suite needs `coverage-ops.js` added to its `loadModule` list.** Six of them load `text-tool.js` (`preset-slices`, `text-layout`, `text-tool-stamp-handoff`, `tool-footprint`, `tool-option-fixes`, `tools-draw`) and not one calls a rasteriser - they all exercise the bitmap path, which never reaches `CoverageOps`. A NEW Node suite that touches `_rasterizeRaw` would need it, and would fail with `CoverageOps is not defined` rather than anything subtler.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: 3 passed.

- [ ] **Step 5: Run both gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`.

Run: `npx playwright test --reporter=line`
Expected: all specs pass. Pay attention to `tests/browser/text-fonts.spec.js`, `font-rasterizer.spec.js` and `system-font-import.spec.js` - they exercise neighbouring font paths and are the ones most likely to notice a changed raster.

- [ ] **Step 6: Commit**

```bash
git add js/tools/text-tool.js tests/browser/text-render-quality.spec.js
git commit -m "fix: vector text was losing a quarter of its stroke weight to one alpha sample

_rasterizeRaw decided each pixel from a single sample at its centre. A sans
stem is well under a pixel wide at stamp sizes, so strokes that are
unambiguously there scored below half opacity at that one point and vanished:
measured, ink weight 0.72 of a correct render, and ZX SPECTRUM at 16px broken
into 8 more connected pieces than it should be.

It now measures the coverage of an 8x8 block per pixel and thresholds once.
js/utils/font-rasterizer.js reached the same conclusion for the Font Editor in
2026-08-19 and has exactly one caller; this is that fix on the path that never
got it.

The threshold here is 0.50, not font-rasterizer's 0.40 - that was measured for
fitting glyphs into eight rows, where a 0.7px stem needs rescuing. At 16-64px
0.40 fattens the letterforms (tone 1.07 against 0.98)."
```

---

### Task 3: Rasterise rotated text THROUGH the transform

With Task 2 in, untransformed text is right and rotated text is still resampled once after the fact (measured: 0.94 at 0 degrees falling to 0.68 at 45). Rotating the glyph in the canvas matrix instead lets the font engine draw an already-turned outline, and holds 0.96 at every angle.

**Files:**
- Modify: `js/tools/text-tool.js` (add `_renderThrough` after `_rasterizeRaw`)
- Modify: `tests/browser/text-render-quality.spec.js` (add specs)

**Interfaces:**
- Consumes: `CoverageOps.SUPERSAMPLE`, `CoverageOps.INK_COVERAGE`, `CoverageOps.create` (Task 1); `TextTool._rasterizeRaw` (Task 2).
- Produces: `TextTool._renderThrough(text, fontFamily, fontSize, degrees, box)` -> `{ data: Float32Array, w: number, h: number }` - a coverage buffer sized exactly `box`, with the string's ink centred in it. `box` is `{ w, h }`. Task 4 calls this and `CoverageOps.toMask`s the result.

- [ ] **Step 1: Write the failing test**

Append to `tests/browser/text-render-quality.spec.js`:

```js
test('render-through returns a coverage buffer filling the box it was given',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 64, h: 48 };
            const cov = tool._renderThrough('Ag', 'Arial, sans-serif', 24, 0, box);
            return {
                w: cov.w, h: cov.h,
                len: cov.data.length,
                isF32: cov.data instanceof Float32Array,
                area: CoverageOps.area(cov),
                max: Math.max(...cov.data),
                min: Math.min(...cov.data)
            };
        });

        expect(r.w).toBe(64);
        expect(r.h).toBe(48);
        expect(r.len).toBe(64 * 48);
        expect(r.isF32).toBe(true);
        expect(r.area).toBeGreaterThan(0);
        // Coverage is a fraction, always
        expect(r.max).toBeLessThanOrEqual(1);
        expect(r.min).toBeGreaterThanOrEqual(0);
    });

test('rotating through the transform keeps the ink instead of eroding it',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 96, h: 96 };
            const at = (deg) => CoverageOps.area(
                tool._renderThrough('HELLO', 'Arial, sans-serif', 20, deg, box));
            return { a0: at(0), a15: at(15), a45: at(45), a90: at(90) };
        });

        // A rotation moves ink, it does not consume it. Resampling a
        // thresholded raster loses several percent per generation; rasterising
        // through the matrix should hold to within the box's own rounding.
        for (const a of [r.a15, r.a45, r.a90]) {
            expect(a / r.a0).toBeGreaterThan(0.92);
            expect(a / r.a0).toBeLessThan(1.08);
        }
    });

test('the ink is centred on the box, not hung off the em baseline',
    async ({ page }) => {
        await boot(page);

        // textBaseline centres on the em box and the rest of the pipeline
        // centres on ink; the gap between those is several pixels of pure
        // misalignment that would read as the stamp jumping when engaged.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 80, h: 80 };
            const cov = tool._renderThrough('x', 'Arial, sans-serif', 24, 0, box);
            let sx = 0, sy = 0, total = 0;
            for (let y = 0; y < cov.h; y++) {
                for (let x = 0; x < cov.w; x++) {
                    const v = CoverageOps.get(cov, x, y);
                    sx += x * v; sy += y * v; total += v;
                }
            }
            return { cx: sx / total, cy: sy / total, mid: 40 };
        });

        // An 'x' is symmetric, so its centre of ink should sit near the box
        // centre on both axes. A baseline-centred draw puts it several pixels
        // high.
        expect(Math.abs(r.cx - r.mid)).toBeLessThan(3);
        expect(Math.abs(r.cy - r.mid)).toBeLessThan(3);
    });

test('render-through at 0 degrees agrees with the untransformed rasteriser',
    async ({ page }) => {
        await boot(page);

        // Two rasterisers for one job is exactly the drift this repo keeps
        // eliminating. They are allowed to exist separately only while they
        // agree; this is what makes that checkable.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const flat = tool._rasterizeWithFont('Hamburg', 'Arial, sans-serif',
                24, false, false, 'horizontal');
            const box = { w: flat.width + 8, h: flat.height + 8 };
            const through = CoverageOps.toMask(
                tool._renderThrough('Hamburg', 'Arial, sans-serif', 24, 0, box));
            return { flatInk: ink(flat.pixels), throughInk: ink(through) };
        });

        expect(r.throughInk / r.flatInk).toBeGreaterThan(0.92);
        expect(r.throughInk / r.flatInk).toBeLessThan(1.08);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: the four new specs FAIL with `tool._renderThrough is not a function`.

- [ ] **Step 3: Implement `_renderThrough`**

In `js/tools/text-tool.js`, add immediately after `_rasterizeRaw`:

```js
  /**
   * Rasterize a string THROUGH a transform: the rotation goes into the canvas
   * matrix, so the font engine draws an already-turned outline rather than a
   * resampler turning a picture of one.
   *
   * This is not a better resampler, it is the absence of one. Measured
   * 2026-08-29: resampling the thresholded raster holds 0.94 unrotated and
   * falls to 0.68 at 45 degrees, while this holds 0.96 at every angle with the
   * component count essentially unchanged. Only a VECTOR font can do it - a
   * bitmap glyph has no outline to re-rasterise, which is why the 1-bit
   * sources need a different answer entirely.
   *
   * Placement is measured before it is drawn. `textBaseline` centres on the em
   * box while every other stage of the stamp pipeline centres on INK, and the
   * gap between those is several pixels of pure misalignment - it would read
   * as the stamp jumping the moment it engaged. So: one pass to find where the
   * ink actually sits relative to the draw origin, then draw about that point.
   *
   * @param {string} text
   * @param {string} fontFamily
   * @param {number} fontSize - the FINAL size in px, scale already applied
   * @param {number} degrees - clockwise
   * @param {{w: number, h: number}} box - the output box, in final pixels
   * @returns {{data: Float32Array, w: number, h: number}} coverage
   * @private
   */
  _renderThrough(text, fontFamily, fontSize, degrees, box) {
    const ss = CoverageOps.SUPERSAMPLE;
    const out = CoverageOps.create(box.w, box.h);
    if (!text || box.w <= 0 || box.h <= 0) return out;

    const fs = fontSize * ss;
    const font = `${fs}px "${fontFamily}"`;
    const pad = Math.ceil(fs);

    // Pass 1 - where is this string's ink, relative to the draw origin?
    const probe = Helpers.createCanvas(
      Math.ceil(fs * (text.length + 2)) + pad * 2, Math.ceil(fs * 3));
    const pctx = probe.getContext('2d');
    pctx.font = font;
    pctx.textBaseline = 'alphabetic';
    pctx.fillStyle = '#000';
    const originX = pad, originY = Math.round(fs * 1.5);
    pctx.fillText(text, originX, originY);

    const pw = probe.width, ph = probe.height;
    const pd = pctx.getImageData(0, 0, pw, ph).data;
    let x0 = pw, y0 = ph, x1 = -1, y1 = -1;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        if (pd[(y * pw + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return out;                       // drew nothing
    const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;

    // Pass 2 - draw about that ink centre, rotation in the matrix
    const W = box.w * ss, H = box.h * ss;
    const canvas = Helpers.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.translate(W / 2, H / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.translate(-cx, -cy);
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.fillText(text, originX, originY);

    // Box-filter each ss x ss block into a coverage fraction
    const data = ctx.getImageData(0, 0, W, H).data;
    const samples = ss * ss * 255;
    for (let y = 0; y < box.h; y++) {
      for (let x = 0; x < box.w; x++) {
        let alpha = 0;
        for (let j = 0; j < ss; j++) {
          const base = ((y * ss + j) * W + x * ss) * 4 + 3;
          for (let i = 0; i < ss; i++) alpha += data[base + i * 4];
        }
        out.data[y * box.w + x] = alpha / samples;
      }
    }
    return out;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: 7 passed.

- [ ] **Step 5: Run both gates**

Run: `node tests/run-all.js` then `npx playwright test --reporter=line`
Expected: both fully green. `_renderThrough` has no callers yet, so nothing else should move.

- [ ] **Step 6: Commit**

```bash
git add js/tools/text-tool.js tests/browser/text-render-quality.spec.js
git commit -m "feat: rasterise rotated vector text through the transform, not after it

The rotation goes into the canvas matrix, so the font engine draws an
already-turned outline instead of a resampler turning a picture of one. Not a
better resampler - the absence of one. Measured: resampling the thresholded
raster holds 0.94 unrotated and falls to 0.68 at 45 degrees; this holds 0.96
at every angle.

Placement is measured before it is drawn. textBaseline centres on the em box
while the rest of the stamp pipeline centres on ink, and the gap between them
is several pixels that would read as the stamp jumping when it engaged.

No callers yet - Task 4 wires it into the stamp pipeline."
```

---

### Task 4: Route vector text stamps through it

Everything so far is unreachable from the app. This connects it, which is also where a regression would first be visible to a person.

**Files:**
- Modify: `js/services/selection-service.js` (`_recomputeStampTransform`, Step 1 at lines 716-745 and Step 3 at 766-771)
- Modify: `tests/browser/text-render-quality.spec.js` (add a spec)

**Interfaces:**
- Consumes: `TextTool._renderThrough` (Task 3), `TextTool.isBitmapFont` (existing), `CoverageOps.toMask` (Task 1).
- Produces: no new public API. `_recomputeStampTransform` gains a vector-text branch and a `rotationApplied` local.

**Design change agreed 2026-08-29, after the plan was written:** the branch also
serves the text tool's own `direction`, by composing it with the slider angle
into ONE rotation handed to the rasteriser. Without that, Direction 45 and the
Transform slider at 45 would be two controls that both say "rotate this text"
and disagree on sharpness - the same objection that justified collapsing
`SelectionService._rotateMask` into `MaskOps.rotate` earlier. It is legal
because with no warp between them, two rotations of a block compose exactly;
the guard below is what guarantees nothing sits between them.

- [ ] **Step 1: Write the failing test**

Append to `tests/browser/text-render-quality.spec.js`:

```js
test('a rotated system-font stamp keeps its ink through the live pipeline',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (px) => px.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const mask = tool._rasterizeWithFont('HELLO', 'Arial, sans-serif',
                24, false, false, 'horizontal');
            SelectionService.startFloatingPasteFromMask(
                mask.pixels, mask.width, mask.height, 40, 40, 'Place Text',
                { text: 'HELLO', fontFamily: 'Arial, sans-serif', fontSize: 24,
                  bold: false, italic: false, layout: 'horizontal' },
                'none');

            const flat = ink(SelectionService.floatingPaste.pixels);
            SelectionService.setStampRotation(45);
            const turned = ink(SelectionService.floatingPaste.pixels);
            SelectionService.setStampRotation(0);
            const back = ink(SelectionService.floatingPaste.pixels);
            SelectionService.endFloatingPaste(false);
            return { flat, turned, back };
        });

        expect(r.flat).toBeGreaterThan(0);
        // A quarter of the ink used to disappear into the rotation
        expect(r.turned / r.flat).toBeGreaterThan(0.90);
        expect(r.turned / r.flat).toBeLessThan(1.12);
        // Rotating away and back rebuilds from the font, so it must return
        expect(r.back / r.flat).toBeGreaterThan(0.95);
    });
```

Also append this, for the composed case:

```js
test('the text tool Direction and the Transform slider agree at the same angle',
    async ({ page }) => {
        await boot(page);

        // Both controls say "rotate this text". If only one of them reaches
        // the font engine they disagree about sharpness at the same angle,
        // which is the objection that collapsed _rotateMask into MaskOps.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (px) => px.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const place = (info) => {
                const m = tool._rasterizeWithFont(info.text, info.fontFamily,
                    info.fontSize, false, false, 'horizontal');
                SelectionService.startFloatingPasteFromMask(
                    m.pixels, m.width, m.height, 40, 40, 'Place Text', info, 'none');
            };
            const base = { text: 'HELLO', fontFamily: 'Arial, sans-serif',
                fontSize: 24, bold: false, italic: false, layout: 'horizontal' };

            // via the tool's own Direction
            place({ ...base, direction: 45 });
            const viaDirection = ink(SelectionService.floatingPaste.pixels);
            SelectionService.endFloatingPaste(false);

            // via the Transform slider
            place({ ...base, direction: 0 });
            SelectionService.setStampRotation(45);
            const viaSlider = ink(SelectionService.floatingPaste.pixels);
            SelectionService.endFloatingPaste(false);

            return { viaDirection, viaSlider };
        });

        expect(r.viaDirection).toBeGreaterThan(0);
        // The same angle by either route must weigh the same
        expect(r.viaDirection / r.viaSlider).toBeGreaterThan(0.92);
        expect(r.viaDirection / r.viaSlider).toBeLessThan(1.09);
    });

test('direction and the slider compose rather than cancelling or doubling',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = () => {
                const fp = SelectionService.floatingPaste;
                return { w: fp.width, h: fp.height };
            };
            const m = tool._rasterizeWithFont('HELLO', 'Arial, sans-serif',
                24, false, false, 'horizontal');
            SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height,
                40, 40, 'Place Text',
                { text: 'HELLO', fontFamily: 'Arial, sans-serif', fontSize: 24,
                  bold: false, italic: false, layout: 'horizontal', direction: 90 },
                'none');
            const at90 = box();
            // direction 90 + slider -90 is upright again: a WIDE box, not tall
            SelectionService.setStampRotation(-90);
            const composed = box();
            SelectionService.endFloatingPaste(false);
            return { at90, composed };
        });

        // 'HELLO' is wider than it is tall upright, and the reverse at 90.
        expect(r.at90.h).toBeGreaterThan(r.at90.w);
        expect(r.composed.w).toBeGreaterThan(r.composed.h);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: the rotated-stamp spec FAILS - `turned / flat` sits well below 0.90, because the stamp still resamples a thresholded raster. The composition spec may already pass (MaskOps and Step 3 do compose today, just at lower quality); the agreement spec is the definitive red once the fast path exists for one route and not the other.

- [ ] **Step 3: Add the vector branch**

In `js/services/selection-service.js`, inside `_recomputeStampTransform`, the vector-font branch of Step 1 currently reads:

```js
      } else if (tool) {
        const mask = tool._rasterizeWithFont(
          fi.text, fi.fontFamily, fi.fontSize * fp._scaleX,
          fi.bold, fi.italic, fi.layout
        );
```

Insert this ABOVE that `else if`, so it takes precedence for the case it can serve:

```js
      } else if (tool && (fp._rotation || fi.direction)
                 && (!fp._warpEffect || fp._warpEffect === 'none')
                 && (!fi.layout || fi.layout === 'horizontal')
                 && !fi.mirrorH && !fi.mirrorV
                 && !fi.shadow && !fi.outline) {
        // Vector text turned by rotation alone: hand the angle to the font
        // engine rather than resampling its output. Measured 2026-08-29: 0.96
        // at every angle against 0.68 at 45 for the resampled path.
        //
        // BOTH rotations compose into one. The text tool's `direction` and the
        // Transform slider are two controls that both say "rotate this text",
        // and serving only one of them would leave them disagreeing about
        // sharpness at the same angle - the objection that collapsed
        // SelectionService._rotateMask into MaskOps.rotate. With no warp
        // between them two rotations of a block compose exactly, and the guard
        // is what guarantees nothing sits between them.
        //
        // The guard stays narrow ON PURPOSE: every excluded field is a
        // mask-space effect MaskOps applies AFTER this point (Step 1b/2), so
        // serving them here would apply them in the wrong order and change
        // what they look like. Widening it further is a measured change, not a
        // tidy-up.
        //
        // `_warpEffect` defaults to the STRING 'none', not to null - testing it
        // for truthiness alone means this branch never fires at all.
        const totalDeg = (fp._rotation || 0) + (fi.direction || 0);
        const rad = totalDeg * Math.PI / 180;
        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
        const box = {
          w: Math.max(1, Math.ceil(targetW * cos + targetH * sin)),
          h: Math.max(1, Math.ceil(targetW * sin + targetH * cos))
        };
        srcPixels = CoverageOps.toMask(
          tool._renderThrough(fi.text, fi.fontFamily, fi.fontSize * fp._scaleX,
            totalDeg, box));
        srcW = box.w;
        srcH = box.h;
        rotationApplied = true;
      } else if (tool) {
```

Declare the flag with the other locals near the top of the method, beside `srcPixels`:

```js
    let srcPixels, srcW, srcH;
    let rotationApplied = false;   // the vector path turns the glyph itself
```

Then suppress Step 1b for that case, or `direction` gets applied a second time
in mask space. It currently reads:

```js
    if (fp.fontInfo && window.MaskOps &&
        (fp.fontInfo.direction || fp.fontInfo.mirrorH || fp.fontInfo.mirrorV ||
         fp.fontInfo.shadow || fp.fontInfo.outline)) {
```

Add the flag. Nothing else in that condition can be true when it is set - the
branch's own guard excludes every other field - so this suppresses the
direction and nothing more:

```js
    // `rotationApplied` means the glyph was rasterised already-turned above,
    // direction included. The vector branch's guard excludes every other field
    // in this condition, so skipping it here drops the duplicate rotation and
    // nothing else.
    if (fp.fontInfo && window.MaskOps && !rotationApplied &&
        (fp.fontInfo.direction || fp.fontInfo.mirrorH || fp.fontInfo.mirrorV ||
         fp.fontInfo.shadow || fp.fontInfo.outline)) {
```

Then guard Step 3 so the rotation is not applied twice - it currently reads `if (fp._rotation !== 0) {`:

```js
    // ── Step 3: Apply rotation ────────────────────────────────────────────
    // Skipped where the glyph was rasterised already-turned above: doing both
    // would rotate the stamp twice and is the obvious way for this to break.
    if (fp._rotation !== 0 && !rotationApplied) {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/browser/text-render-quality.spec.js --reporter=line`
Expected: 10 passed.

- [ ] **Step 5: Run both gates**

Run: `node tests/run-all.js` then `npx playwright test --reporter=line`
Expected: both fully green. Watch `tests/browser/text-stamp-rotation-lossless.spec.js` especially - it rotates a stamp to 45 and back to 0 and asserts the pixels return exactly, which is precisely what a double-applied rotation would break.

- [ ] **Step 6: Commit**

```bash
git add js/services/selection-service.js tests/browser/text-render-quality.spec.js
git commit -m "feat: a rotated system-font stamp is drawn turned, not turned after drawing

_recomputeStampTransform now hands the angle to the font engine for vector
text that the slider is only rotating, and skips its own rotation step for
that case. Measured: the resampled path holds 0.68 at 45 degrees, this holds
0.96 at every angle.

The guard is deliberately narrow - warp, the text tool's own direction and
mirrors, shadow and outline are all mask-space effects that MaskOps applies
after this point, so serving them here would apply them in the wrong order.
Widening it is a measured change, not a tidy-up."
```

---

### Task 5: Record what changed, and leave the gate in place

The spec's figures are only true while the bench agrees with them. This closes the loop and writes down the two things a future reader will otherwise have to rediscover.

**Files:**
- Modify: `CLAUDE.md` (a new architecture note beside the existing text-placement one)
- Modify: `docs/CURRENT_STATE.md` (test counts)
- Modify: `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md` (status line)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing executable.

- [ ] **Step 1: Re-run the bench and confirm the spec's figures still hold**

Run: `node tools/text-transform-bench.js`

Expected, in the `System font` block: `current` should now score close to what the spec records for `render-through` rather than for `current`, because `current` IS the shipped path and the shipped path has changed. Record the new numbers - this is the before/after the spec's section 3 promises.

If the vector suite has NOT moved, the wiring in Task 4 is not being reached; do not proceed to Step 2.

- [ ] **Step 2: Add the architecture note to CLAUDE.md**

Insert immediately before the existing `**There are TWO preset libraries...**` paragraph:

```markdown
**Vector text is decided from COVERAGE, and rotated text is drawn already
turned.** `_rasterizeRaw` used to decide each pixel from one alpha sample at
its centre, which at stamp sizes lost about 28% of a string's stroke weight and
broke `ZX SPECTRUM` at 16px into 8 extra connected pieces - a sans stem is well
under a pixel wide there, so a stroke that is unambiguously present scores
below half opacity at that one point. It now measures an 8x8 block per pixel
and thresholds once, through `CoverageOps` (`js/utils/coverage-ops.js`, pure,
Node-tested, sibling of `MaskOps` and independent of it).

Three things to know before touching it. **The threshold is 0.50 here and 0.40
in `font-rasterizer.js`, and that is not a contradiction to resolve by picking
one** - that file fits glyphs into EIGHT ROWS where a 0.7px stem needs
rescuing, this runs at 16-64px where 0.40 measurably fattens the letterforms.
Neither may adopt the other's value without re-measuring at its own sizes.
**`_renderThrough` puts the rotation in the canvas matrix** so the font engine
draws a turned outline rather than a resampler turning a picture of one; it is
reached from `_recomputeStampTransform` only for vector text the slider is
ONLY rotating, because warp, the tool's own direction and mirrors, shadow and
outline are mask-space effects `MaskOps` applies after that point and serving
them early would apply them in the wrong order. And **the rotation must then
be skipped in Step 3** (`rotationApplied`), or the stamp turns twice.

`tools/text-transform-bench.js` is the gate: no change to this path lands
without a before/after from it, the way `palette-bench.js` gates the other.
Read its header first - its ground truth shares the candidate's bias on sparse
sources, so its IoU column is a regression guard and not an optimisation
target.
```

- [ ] **Step 3: Update the measured counts in `docs/CURRENT_STATE.md`**

Run these and put the results in the table (the file's own rule is that measured counts carry their method and date):

```bash
ls tests/*.test.js | wc -l
ls tests/browser/*.spec.js | wc -l
npx playwright test --reporter=line 2>&1 | tail -1
```

Update the `Node suites`, `Browser spec files` and `Browser specs` rows, dated 2026-08-29, noting `coverage-ops` and `text-render-quality` as the new files.

- [ ] **Step 4: Mark the spec's vector half done**

In `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md`, replace the `Status:` paragraph with exactly this:

```markdown
Status: the VECTOR half is implemented - section 4.2 in full, and the
`fromMask`/`toMask` boundary of 4.1 - by
`docs/superpowers/plans/2026-08-29-coverage-rasterisation-vector.md`.

NOT implemented: 4.1's `transform`/`warp`/`flipH`/`flipV`/`shadow`/`outline`/
`toneCorrect`, the 1-bit branch of 4.3, the local-tone rule of 4.4, and the
live budget of section 5. Those are the second plan; pasted artwork, ZX ROM and
library-font stamps still take the nearest-neighbour path described in
section 1.

Section 7.1 was a blocking objection - the extended bench found a case the
design did not survive - and is RESOLVED by the local-tone rule in 4.4.
Sections 10.1 and 10.2 are resolved too, and no A-tagged figure remains.
```

- [ ] **Step 5: Run the full gate one last time**

Run: `node tests/run-all.js` then `npx playwright test --reporter=line`
Expected: both fully green.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/CURRENT_STATE.md docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md
git commit -m "docs: record the coverage rasterisation, and why its threshold is not the other one

The architecture note names the three things a future reader would otherwise
rediscover: that 0.50 here and 0.40 in font-rasterizer.js are both measured and
size-dependent rather than a contradiction; that render-through is reached only
for vector text the slider is only rotating, because everything excluded is a
mask-space effect applied later; and that Step 3's rotation must then be
skipped or the stamp turns twice.

Counts in CURRENT_STATE re-measured. The spec's status records which of its
sections are now live and which are still Plan 2."
```

---

## What this plan does NOT do

Named so the next plan has a clean boundary and nobody assumes these landed:

- **`CoverageOps.transform` / `warp` / `flipH` / `flipV` / `shadow` / `outline`** (spec 4.1). No consumer until the 1-bit path moves into the domain.
- **`CoverageOps.toneCorrect`** (spec 4.4). The rule that stops a downscaled dither field vanishing. Only 1-bit sources can hit that failure, and none of them reach the coverage domain in this plan.
- **The 1-bit branch of `_recomputeStampTransform`** (spec 4.3). Pasted artwork, ZX ROM and library-font stamps keep today's nearest-neighbour path exactly.
- **The live budget and `LIVE_BUDGET_MS`** (spec 5). Nothing here is slow enough to need it: `_renderThrough` measured 3.04 ms for a long string at 64px, within noise of the 2.51 ms path it replaces. The budget exists for the JS coverage map over large 1-bit stamps, which Plan 2 introduces.
- **Warp quality** (spec section 3, the largest single win at `dComp` 21.49 -> 1.20). Warp is a mask-space effect on both source kinds and belongs with the domain work.
