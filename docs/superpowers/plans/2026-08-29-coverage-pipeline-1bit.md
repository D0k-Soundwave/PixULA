# Coverage Pipeline, 1-bit Half - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry every stamp transform - scale, the text effects, warp and rotation - through a coverage domain and threshold ONCE at the end, so a warped stamp stops coming apart into twenty-two extra pieces and a downscaled dither pattern stops vanishing.

**Architecture:** `CoverageOps` grows the operations the chain needs (`transform`, `warp`, `flipH`/`flipV`/`shadow`/`outline`, `toMaskToned`). `SelectionService._recomputeStampTransform` enters the domain once with `fromMask`, runs its existing Step 1b / 2 / 3 chain against those, and leaves once through `toMaskToned`. A self-timing budget keeps a slider responsive on large stamps by falling back to today's boolean path mid-gesture.

**Tech Stack:** Vanilla ES2020, IIFE singletons on `window`, no build step, no dependencies. Node test harness (`tests/run-all.js`, stubs in `tests/helpers/zx-stubs.js`, no framework). Playwright for browser specs.

**Spec:** `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md`

**Predecessor:** `docs/superpowers/plans/2026-08-29-coverage-rasterisation-vector.md` (merged as PR #1). It built `CoverageOps` with `create`/`size`/`get`/`fromMask`/`toMask`/`area` and the two threshold constants. This plan assumes all of that exists.

**Deviation from the spec, deliberate:** spec 4.1 names this `toneCorrect(cov,
threshold, window, tolerance)` and says "`toMask` should route through it rather
than offering both". This plan names it **`toMaskToned`** and keeps both. The
name because it returns a MASK - it is a way OUT of the domain, and a caller
reading `toneCorrect` would reasonably expect a coverage buffer back. Both
because the bench has to be able to compare a plainly-thresholded pipeline
against a tone-corrected one, which is the comparison that produced the rule in
the first place, and because Task 4's own tests assert what a plain threshold
does to a sparse field before showing the rule undoing it. `toMask` is not a
trap left lying around: Task 5 routes the live path through `toMaskToned`, and
Task 7's architecture note says which one production uses.

## A constraint the spec did not state

Spec 4.1 describes `transform(cov, {scaleX, scaleY, degrees}, box, ss)` as "the
single composed inverse map... Replaces two sequential resamples with one", and
4.3 says "Step order is unchanged". **Those two cannot both hold in general.**
Scale happens in Step 1 and rotation in Step 3, with the text effects (1b) and
warp (2) in between - so scale and rotation can only be composed when nothing
sits between them.

This plan resolves it the way that keeps 4.3's promise, because changing what
warp and shadow LOOK LIKE is not on the table:

- **Composition is an optimisation, applied only when the chain is empty
  between the two** - no effects, no warp. `transform` takes both and the
  caller decides.
- **Otherwise scale and rotation are separate coverage steps.** Still a strict
  improvement on today: one quantisation at the end instead of three, which is
  where the measured win actually comes from. The bench's warp gain (dComp
  21.49 -> 1.20) was measured on warp ALONE, with no composition involved.

## Global Constraints

Copied verbatim from the spec and from CLAUDE.md's enforced rules. Every task's requirements implicitly include this section.

- `CoverageOps.SUPERSAMPLE = 8` (exists). At 4 a 1-bit source scores 0.973, BELOW the 0.976 nearest-neighbour path it replaces; at 8 it scores 0.994 [M].
- `CoverageOps.INK_COVERAGE = 0.50` (exists) - the unbiased area cut, and the right one for 1-bit sources whose coverage is exact geometry. **This half uses it, not `GLYPH_COVERAGE`.**
- `TONE_WINDOW = 8`, `TONE_TOLERANCE = 0.10` - spec section 6. A 16px window leaves visible blocky seams; 0.10 and 0.20 are within noise numerically and the sheets favour 0.10.
- `LIVE_BUDGET_MS = 7` - spec section 5. 16.7 ms frame less the measured 0.04-0.89 ms rest-of-tick, halved for paint and GC headroom.
- **`js/core/`, `js/services/` and `js/tools/` must not touch the DOM.** Rule `dom-in-logic-layer` matches `document.createElement(`, `getElementById`, `querySelector`, `.style.x =`. Use `Helpers.createCanvas`.
- **Never `Math.max(a, Math.min(b, c))` on one line** - rule `inline-clamp`. Use `Helpers.clamp`.
- **`EventBus.emit/on` take `EVENTS.*` constants** - rule `event-string-literal`.
- **ASCII only in `js/`, `css/` and `index.html`, comments included.**
- **A font family is a SINGLE name, never a CSS list** - the rasterisers build `${size}px "${family}"`, so `'Arial, sans-serif'` falls back silently. Two measurement harnesses were wrong this way before it was noticed.
- This plan adds **no user-visible strings**, so no i18n work.
- `node tests/run-all.js` after every task. New Node suites need no registration.
- `tools/text-transform-bench.js` is the gate. **Read its header first**: its ground truth shares the candidate's bias on sparse sources, so a pipeline that correctly restores a texture scores WORSE than one that deletes it. IoU there is a regression guard, not an optimisation target - tune on the contact sheets (`--write <dir>`).

---

### Task 1: `CoverageOps.transform` - scale and rotation as one inverse map

**Files:**
- Modify: `js/utils/coverage-ops.js`
- Modify: `tests/coverage-ops.test.js`

**Interfaces:**
- Consumes: `CoverageOps.create`/`get`/`area`/`fromMask`/`toMask` (predecessor plan).
- Produces: `CoverageOps.transform(cov, opts, box, ss)` -> `{data, w, h}` where `opts` is `{scaleX = 1, scaleY = 1, degrees = 0}`, `box` is `{w, h}`, and `ss` defaults to `SUPERSAMPLE`. Also `CoverageOps.boxFor(w, h, opts)` -> `{w, h}`, the output box a transform needs.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-ops.test.js`, before `summary()`:

```js
// -- boxFor / transform ------------------------------------------------------
check('boxFor: identity leaves the box alone',
  eq(CoverageOps.boxFor(8, 4, {}), { w: 8, h: 4 }));
check('boxFor: scale multiplies', eq(CoverageOps.boxFor(8, 4, { scaleX: 2, scaleY: 3 }), { w: 16, h: 12 }));
check('boxFor: a quarter turn swaps the axes',
  eq(CoverageOps.boxFor(8, 4, { degrees: 90 }), { w: 4, h: 8 }));

// A solid block is the clearest subject: every interior pixel is fully covered
// whatever the transform does, so a wrong inverse map shows as lost area.
const solid = CoverageOps.fromMask(Array.from({ length: 6 }, () => new Array(10).fill(T)));

const ident = CoverageOps.transform(solid, {}, CoverageOps.boxFor(10, 6, {}));
check('transform: identity is a faithful copy',
  eq(CoverageOps.toMask(ident), CoverageOps.toMask(solid)));

const scaled = CoverageOps.transform(solid, { scaleX: 2, scaleY: 2 },
  CoverageOps.boxFor(10, 6, { scaleX: 2, scaleY: 2 }));
check('transform: doubling doubles the box', scaled.w === 20 && scaled.h === 12);
check('transform: doubling a solid block quadruples its area',
  Math.abs(CoverageOps.area(scaled) / CoverageOps.area(solid) - 4) < 0.1);

const turned = CoverageOps.transform(solid, { degrees: 90 }, CoverageOps.boxFor(10, 6, { degrees: 90 }));
check('transform: a quarter turn swaps the box', turned.w === 6 && turned.h === 10);
check('transform: a quarter turn conserves area',
  Math.abs(CoverageOps.area(turned) - CoverageOps.area(solid)) < 0.5);

// THE point of the domain: a shrink that a threshold would erase still carries
// its ink. A 4x4 block of single pixels at quarter scale covers 1/16 of each
// output pixel - nothing survives a 0.50 cut, and the area is still right.
const sparse = CoverageOps.fromMask(Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => (x % 4 === 0 && y % 4 === 0))));
const shrunk = CoverageOps.transform(sparse, { scaleX: 0.25, scaleY: 0.25 },
  CoverageOps.boxFor(16, 16, { scaleX: 0.25, scaleY: 0.25 }));
check('transform: a shrink preserves AREA even where the threshold empties it',
  CoverageOps.toMask(shrunk).every(r => r.every(v => !v)) &&
  Math.abs(CoverageOps.area(shrunk) - CoverageOps.area(sparse)) < 1.5);

check('transform: an empty buffer is safe',
  CoverageOps.transform(CoverageOps.create(0, 0), {}, { w: 0, h: 0 }).data.length === 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/coverage-ops.test.js`
Expected: `TypeError: CoverageOps.boxFor is not a function`.

- [ ] **Step 3: Implement**

Add to `js/utils/coverage-ops.js`, after `area`:

```js
    /**
     * The output box a transform needs: the source box scaled, then its
     * corners turned. Callers size their buffer from this so nothing clips.
     * @param {number} w
     * @param {number} h
     * @param {{scaleX?: number, scaleY?: number, degrees?: number}} opts
     */
    boxFor(w, h, opts = {}) {
        const sx = opts.scaleX == null ? 1 : opts.scaleX;
        const sy = opts.scaleY == null ? 1 : opts.scaleY;
        const rad = (opts.degrees || 0) * Math.PI / 180;
        const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
        const sw = Math.max(1, Math.round(w * sx));
        const sh = Math.max(1, Math.round(h * sy));
        return {
            w: Math.max(1, Math.ceil(sw * c + sh * s)),
            h: Math.max(1, Math.ceil(sw * s + sh * c))
        };
    },

    /**
     * Scale and rotation as ONE inverse map, sampling coverage.
     *
     * Composing them is an optimisation and not always available: in the stamp
     * chain the text effects and warp sit BETWEEN the scale and the rotation,
     * and reordering them would change what a shadow or an arch looks like.
     * The caller passes both only when the chain between them is empty;
     * otherwise it calls this twice and pays two maps, which is still one
     * quantisation at the end instead of three.
     *
     * `ss` subsamples per axis. At 1 this degenerates to nearest-neighbour,
     * which is what the interactive fallback wants.
     *
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {{scaleX?: number, scaleY?: number, degrees?: number}} opts
     * @param {{w: number, h: number}} box
     * @param {number} [ss=SUPERSAMPLE]
     */
    transform(cov, opts, box, ss = CoverageOps.SUPERSAMPLE) {
        const out = CoverageOps.create(box.w, box.h);
        if (!cov.w || !cov.h || !box.w || !box.h) return out;

        const sx = opts.scaleX == null ? 1 : opts.scaleX;
        const sy = opts.scaleY == null ? 1 : opts.scaleY;
        const rad = (opts.degrees || 0) * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const step = 1 / ss, base = step / 2, n = ss * ss;

        for (let dy = 0; dy < box.h; dy++) {
            for (let dx = 0; dx < box.w; dx++) {
                let sum = 0;
                for (let j = 0; j < ss; j++) {
                    const v = dy + base + j * step - box.h / 2;
                    for (let i = 0; i < ss; i++) {
                        const u = dx + base + i * step - box.w / 2;
                        // un-rotate (same sense as MaskOps.rotate), then un-scale
                        const xr =  u * cos + v * sin;
                        const yr = -u * sin + v * cos;
                        const px = Math.floor(xr / sx + cov.w / 2);
                        const py = Math.floor(yr / sy + cov.h / 2);
                        sum += CoverageOps.get(cov, px, py);
                    }
                }
                out.data[dy * box.w + dx] = sum / n;
            }
        }
        return out;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/coverage-ops.test.js`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Run the gate and commit**

Run: `node tests/run-all.js` - expect `ALL TEST FILES PASSED`.

```bash
git add js/utils/coverage-ops.js tests/coverage-ops.test.js
git commit -m "feat: scale and rotation as one coverage map

transform() samples coverage through a composed inverse map, and boxFor()
sizes the buffer it needs. Composition is an optimisation the caller opts
into: in the stamp chain the text effects and warp sit between the scale and
the rotation, and reordering them would change what a shadow or an arch looks
like.

The test that matters is the shrink: a sparse pattern scaled to a quarter
carries its full area even though a 0.50 threshold empties it completely. That
is the whole reason for the domain - the information survives to the end,
where one decision is taken about it."
```

---

### Task 2: `CoverageOps.warp` - the largest measured win in the bench

Warp is the worst-performing operation in the app: `dComp` 21.49 against an ideal of 0, meaning a warped stamp comes apart into roughly twenty-two more pieces than it should. Coverage takes it to 1.20 [M].

**Files:**
- Modify: `js/utils/coverage-ops.js`
- Modify: `tests/coverage-ops.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: `CoverageOps.warp(cov, effect, intensity = 0.5, ss = SUPERSAMPLE)` -> `{data, w, h}`. `effect` is one of `'arch-up'`, `'arch-down'`, `'wave'`, `'flag'`, `'slant-right'`, `'slant-left'`, `'inflate'`, `'perspective-top'`, `'perspective-bottom'`; anything else returns a copy.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-ops.test.js`:

```js
// -- warp --------------------------------------------------------------------
// The nine effects must mirror SelectionService._applyWarpEffect's inverse
// maps exactly - this is a coverage TWIN of that function, not a second
// implementation of the geometry, so any disagreement in the bench is about
// sampling and never about a different curve.
const warpBlock = CoverageOps.fromMask(
  Array.from({ length: 12 }, () => new Array(24).fill(T)));

const EFFECTS = ['arch-up', 'arch-down', 'wave', 'flag', 'slant-right',
  'slant-left', 'inflate', 'perspective-top', 'perspective-bottom'];

check('warp: an unknown effect is a copy',
  eq(CoverageOps.toMask(CoverageOps.warp(warpBlock, 'nope')), CoverageOps.toMask(warpBlock)));

check('warp: every effect returns a non-empty buffer and keeps ink', (() => {
  return EFFECTS.every((e) => {
    const w = CoverageOps.warp(warpBlock, e);
    return w.w > 0 && w.h > 0 && CoverageOps.area(w) > 0;
  });
})());

// The four that grow the canvas must actually grow it, or content clips.
check('warp: arch and wave grow the height, slants grow the width', (() => {
  const base = CoverageOps.size(warpBlock);
  const taller = ['arch-up', 'arch-down', 'wave', 'flag']
    .every((e) => CoverageOps.warp(warpBlock, e).h > base.h);
  const wider = ['slant-right', 'slant-left']
    .every((e) => CoverageOps.warp(warpBlock, e).w > base.w);
  return taller && wider;
})());

check('warp: intensity 0 leaves an arch flat', (() => {
  const flat = CoverageOps.warp(warpBlock, 'arch-up', 0);
  return flat.h === warpBlock.h && flat.w === warpBlock.w;
})());

// The point of doing it in coverage: a stretch thins the ink rather than
// deleting it. Under 'inflate' the centre magnifies and the edges compress,
// and the total area must be close to what went in.
check('warp: inflate keeps most of the area rather than dropping it', (() => {
  const w = CoverageOps.warp(warpBlock, 'inflate');
  const ratio = CoverageOps.area(w) / CoverageOps.area(warpBlock);
  return ratio > 0.85 && ratio < 1.15;
})());

check('warp: an empty buffer is safe',
  CoverageOps.warp(CoverageOps.create(0, 0), 'wave').data.length === 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/coverage-ops.test.js`
Expected: `TypeError: CoverageOps.warp is not a function`.

- [ ] **Step 3: Implement**

Add to `js/utils/coverage-ops.js`. **Mirror `SelectionService._applyWarpEffect` line for line** - the expansion amounts, the `nx`/`ny` normalisation and every per-effect formula. The only differences are that `dx`/`dy` become continuous subsample positions and that the result is coverage rather than a boolean.

```js
    /**
     * The warp inverse maps, evaluated at subsample positions instead of once
     * per output pixel - a coverage twin of
     * `SelectionService._applyWarpEffect`, deliberately mirroring it rather
     * than reimplementing the geometry, so any difference is about SAMPLING
     * and never about a different curve.
     *
     * `round` rather than `floor` when landing in the source, matching the
     * original: it places a source pixel's square on [i-0.5, i+0.5), and the
     * two must share one convention.
     *
     * Warp is where this domain pays for itself most. Measured 2026-08-29 over
     * all nine effects: the shipped boolean path scores IoU 0.615 with dComp
     * 21.49 - a warped stamp coming apart into twenty-two more pieces than it
     * should - against 0.959 and 1.20 here.
     */
    warp(cov, effect, intensity = 0.5, ss = CoverageOps.SUPERSAMPLE) {
        const srcW = cov.w, srcH = cov.h;
        let outW = srcW, outH = srcH, expandTop = 0, expandLeft = 0;
        const arcH    = Math.round(srcH * intensity * 0.8);
        const waveAmp = Math.round(srcH * intensity * 0.25);
        const flagAmp = Math.round(srcH * intensity * 0.2);
        const slantX  = Math.round(srcH * intensity * 0.7);
        switch (effect) {
            case 'arch-up':    expandTop  = arcH;    outH = srcH + arcH; break;
            case 'arch-down':                        outH = srcH + arcH; break;
            case 'wave':       expandTop  = waveAmp; outH = srcH + 2 * waveAmp; break;
            case 'flag':       expandTop  = flagAmp; outH = srcH + 2 * flagAmp; break;
            case 'slant-right':                      outW = srcW + slantX; break;
            case 'slant-left': expandLeft = slantX;  outW = srcW + slantX; break;
        }

        const out = CoverageOps.create(outW, outH);
        if (!srcW || !srcH) return out;
        const step = 1 / ss, base = step / 2, n = ss * ss;

        for (let dy = 0; dy < outH; dy++) {
            for (let dx = 0; dx < outW; dx++) {
                let sum = 0;
                for (let j = 0; j < ss; j++) {
                    const fy = dy + base + j * step;
                    for (let i = 0; i < ss; i++) {
                        const fx = dx + base + i * step;
                        const srcDy = fy - expandTop, srcDx = fx - expandLeft;
                        const nx = fx / (outW - 1 || 1) - 0.5;
                        const ny = fy / (outH - 1 || 1) - 0.5;
                        let sx = srcDx, sy = srcDy;
                        switch (effect) {
                            case 'arch-up':   sy = srcDy + arcH * (1 - 4 * nx * nx); break;
                            case 'arch-down': sy = srcDy - arcH * (1 - 4 * nx * nx); break;
                            case 'wave':      sy = srcDy + waveAmp * Math.sin(4 * Math.PI * fx / outW); break;
                            case 'flag':      sy = srcDy + flagAmp * Math.sin(2 * Math.PI * fx / outW); break;
                            case 'slant-right': sx = srcDx - (srcH - 1 - srcDy) * intensity * 0.7; break;
                            case 'slant-left':  sx = srcDx + (srcH - 1 - srcDy) * intensity * 0.7; break;
                            case 'inflate': {
                                const r = Math.sqrt(nx * nx + ny * ny);
                                const f = 1 + intensity * 1.5 * r * r;
                                sx = (nx / f + 0.5) * srcW; sy = (ny / f + 0.5) * srcH; break;
                            }
                            case 'perspective-top': {
                                const f = Math.max(0.1, 1 - intensity * (1 - fy / (outH - 1 || 1)));
                                sx = (nx / f + 0.5) * srcW; sy = srcDy; break;
                            }
                            case 'perspective-bottom': {
                                const f = Math.max(0.1, 1 - intensity * fy / (outH - 1 || 1));
                                sx = (nx / f + 0.5) * srcW; sy = srcDy; break;
                            }
                        }
                        sum += CoverageOps.get(cov, Math.round(sx), Math.round(sy));
                    }
                }
                out.data[dy * outW + dx] = sum / n;
            }
        }
        return out;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/coverage-ops.test.js` - expect `ALL CHECKS PASSED`.

- [ ] **Step 5: Run the gate and commit**

Run: `node tests/run-all.js`.

```bash
git add js/utils/coverage-ops.js tests/coverage-ops.test.js
git commit -m "feat: the nine warp maps, sampled as coverage

A coverage twin of SelectionService._applyWarpEffect, mirroring its geometry
line for line rather than reimplementing it, so any difference between them is
about sampling and never about a different curve.

Warp is the worst path in the app: measured over all nine effects, the shipped
boolean version scores dComp 21.49 - a warped stamp coming apart into
twenty-two more pieces than it should - against 1.20 here.

No caller yet; the wiring task takes it."
```

---

### Task 3: The coverage counterparts of the mask effects

`_recomputeStampTransform` runs the text effects between the scale and the warp. They have to happen in the domain, or the chain has to leave and re-enter it and the whole point is lost.

**Files:**
- Modify: `js/utils/coverage-ops.js`
- Modify: `tests/coverage-ops.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: `CoverageOps.flipH(cov)`, `CoverageOps.flipV(cov)`, `CoverageOps.shadow(cov, dx, dy)`, `CoverageOps.outline(cov)`, and `CoverageOps.process(cov, opts)` where `opts` carries the same `{mirrorH, mirrorV, outline, shadow, shadowOffset}` fields `MaskOps.process` takes. **`direction` is deliberately NOT handled here** - rotation is `transform`'s job and doing it twice is the failure mode the predecessor plan had to guard against.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-ops.test.js`:

```js
// -- effects in the domain ---------------------------------------------------
// Each is the coverage twin of the MaskOps operation of the same name, and the
// pair must agree exactly on a fully-covered (1-bit) input - that is what makes
// it safe to move the chain into the domain without changing what anything
// looks like.
const fxMask = [[T, T, F], [F, F, T]];
const fxCov = CoverageOps.fromMask(fxMask);

check('flipH: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.flipH(fxCov)), MaskOps.flipH(fxMask)));
check('flipV: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.flipV(fxCov)), MaskOps.flipV(fxMask)));
check('shadow: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.shadow(fxCov, 1, 1)), MaskOps.shadow(fxMask, 1, 1)));
check('outline: agrees with MaskOps on a 1-bit input',
  eq(CoverageOps.toMask(CoverageOps.outline(fxCov)), MaskOps.outline(fxMask)));

// Partial coverage is where they must differ: a boolean OR cannot express
// "half covered", and keeping the fraction is the whole point.
const half = CoverageOps.create(2, 1);
half.data[0] = 0.4;
check('shadow: takes the MAX of glyph and shadow, not a boolean OR', (() => {
  const s = CoverageOps.shadow(half, 1, 0);
  return Math.abs(CoverageOps.get(s, 0, 0) - 0.4) < 1e-6 &&
         Math.abs(CoverageOps.get(s, 1, 0) - 0.4) < 1e-6;
})());

check('process: mirrors run FIRST, then outline, then shadow', (() => {
  const manual = CoverageOps.shadow(
    CoverageOps.outline(CoverageOps.flipV(CoverageOps.flipH(fxCov))), 1, 1);
  const viaProcess = CoverageOps.process(fxCov,
    { mirrorH: true, mirrorV: true, outline: true, shadow: true, shadowOffset: 1 });
  return eq(CoverageOps.toMask(viaProcess), CoverageOps.toMask(manual));
})());
check('process: no options is a faithful copy',
  eq(CoverageOps.toMask(CoverageOps.process(fxCov, {})), fxMask));
check('process: IGNORES direction - rotation belongs to transform()',
  eq(CoverageOps.toMask(CoverageOps.process(fxCov, { direction: 90 })), fxMask));
```

`tests/coverage-ops.test.js` must now `loadModule('js/utils/mask-ops.js')` alongside `coverage-ops.js`, since it compares against it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/coverage-ops.test.js`
Expected: `TypeError: CoverageOps.flipH is not a function`.

- [ ] **Step 3: Implement**

Add to `js/utils/coverage-ops.js`:

```js
    /** Mirror left-right. Exact - a reindex, no resampling. */
    flipH(cov) {
        const out = CoverageOps.create(cov.w, cov.h);
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                out.data[y * cov.w + x] = cov.data[y * cov.w + (cov.w - 1 - x)];
            }
        }
        return out;
    },

    /** Mirror top-bottom. Exact, as `flipH`. */
    flipV(cov) {
        const out = CoverageOps.create(cov.w, cov.h);
        for (let y = 0; y < cov.h; y++) {
            out.data.set(cov.data.subarray((cov.h - 1 - y) * cov.w, (cov.h - y) * cov.w), y * cov.w);
        }
        return out;
    },

    /**
     * Drop shadow: the MAX of the glyph and a copy offset by (dx, dy).
     * Max rather than a boolean OR, which is what `MaskOps.shadow` does and
     * cannot express a half-covered pixel - on a 1-bit input the two agree
     * exactly, and on a fractional one this keeps the fraction.
     */
    shadow(cov, dx, dy) {
        const ox = Math.max(0, dx), oy = Math.max(0, dy);
        const gx = Math.max(0, -dx), gy = Math.max(0, -dy);
        const outW = cov.w + Math.abs(dx), outH = cov.h + Math.abs(dy);
        const out = CoverageOps.create(outW, outH);
        if (!cov.w || !cov.h) return out;
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                const v = cov.data[y * cov.w + x];
                if (v <= 0) continue;
                const gi = (y + gy) * outW + (x + gx);
                const si = (y + oy) * outW + (x + ox);
                if (v > out.data[gi]) out.data[gi] = v;
                if (v > out.data[si]) out.data[si] = v;
            }
        }
        return out;
    },

    /**
     * Hollow contour: an 8-neighbour dilation minus the glyph, one pixel of
     * padding on every side. The dilation takes the neighbourhood MAX and the
     * subtraction scales by what the glyph does NOT cover, so a half-covered
     * glyph pixel leaves half a pixel of ring rather than all or nothing.
     */
    outline(cov) {
        const outW = cov.w + 2, outH = cov.h + 2;
        const out = CoverageOps.create(outW, outH);
        if (!cov.w || !cov.h) return out;
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                const v = cov.data[y * cov.w + x];
                if (v <= 0) continue;
                for (let ny = y; ny <= y + 2; ny++) {
                    for (let nx = x; nx <= x + 2; nx++) {
                        const i = ny * outW + nx;
                        if (v > out.data[i]) out.data[i] = v;
                    }
                }
            }
        }
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                const i = (y + 1) * outW + (x + 1);
                out.data[i] *= (1 - cov.data[y * cov.w + x]);
            }
        }
        return out;
    },

    /**
     * The text effect chain, in `MaskOps.process`'s canonical order minus its
     * rotation: mirror -> outline -> shadow.
     *
     * `direction` is deliberately ignored. Rotation is `transform`'s job, and
     * applying it in both places is exactly the double-turn the vector half
     * had to guard against with its `rotationApplied` flag.
     */
    process(cov, opts = {}) {
        let out = cov;
        if (opts.mirrorH) out = CoverageOps.flipH(out);
        if (opts.mirrorV) out = CoverageOps.flipV(out);
        if (opts.outline) out = CoverageOps.outline(out);
        if (opts.shadow) {
            const off = opts.shadowOffset || Math.max(1, Math.round(cov.h / 8));
            out = CoverageOps.shadow(out, off, off);
        }
        return out;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/coverage-ops.test.js` - expect `ALL CHECKS PASSED`.

- [ ] **Step 5: Run the gate and commit**

```bash
git add js/utils/coverage-ops.js tests/coverage-ops.test.js
git commit -m "feat: the text effects, in the coverage domain

flipH/flipV/shadow/outline and the process() chain, each agreeing exactly with
its MaskOps twin on a 1-bit input - which is what makes it safe to move the
stamp chain into the domain without changing what anything looks like - and
keeping the fraction where the input is partially covered, which a boolean OR
cannot express.

process() deliberately ignores `direction`. Rotation belongs to transform(),
and applying it in both places is the double-turn the vector half already had
to guard against."
```

---

### Task 4: `CoverageOps.toMaskToned` - the rule that stops a dither vanishing

Spec 4.4, and the reason section 7.1 stopped being a blocking objection. A flat 0.50 cut deletes any pattern too sparse to reach half anywhere: a 25%-dense tile downscaled to 0.6 disappears entirely, and dither IS this app's shading system.

**Files:**
- Modify: `js/utils/coverage-ops.js`
- Modify: `tests/coverage-ops.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: `CoverageOps.TONE_WINDOW` = `8`, `CoverageOps.TONE_TOLERANCE` = `0.10`, and `CoverageOps.toMaskToned(cov, threshold, window, tolerance)` -> `boolean[][]`. **The plain `toMask` stays** - Task 5 routes through `toMaskToned`, and the two exist separately so the bench can compare them.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-ops.test.js`:

```js
// -- local tone correction ---------------------------------------------------
check('TONE_WINDOW is 8 - a 16px window leaves visible blocky seams',
  CoverageOps.TONE_WINDOW === 8);
check('TONE_TOLERANCE is 0.10', CoverageOps.TONE_TOLERANCE === 0.10);

// A LETTERFORM: interior fully covered, background empty. The threshold loses
// no tone, so the rule must not fire - measured on the bench's ZX suite it
// matches plain coverage to three decimals, and that no-op is what makes it
// safe to apply everywhere.
const shape = CoverageOps.create(16, 16);
for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) shape.data[y * 16 + x] = 1;
check('toneCorrect: a solid shape is untouched - the threshold lost no tone',
  eq(CoverageOps.toMaskToned(shape), CoverageOps.toMask(shape)));

// A DITHER FIELD: 0.25 everywhere. A plain threshold empties it; the rule must
// put the tone back.
const field = CoverageOps.create(16, 16);
field.data.fill(0.25);
check('toneCorrect: a plain threshold deletes a 25% field',
  CoverageOps.toMask(field).every(r => r.every(v => !v)));
const toned = CoverageOps.toMaskToned(field);
const tonedInk = toned.reduce((n, r) => n + r.filter(Boolean).length, 0);
check('toneCorrect: restores it at roughly the right density',
  tonedInk > 0.15 * 256 && tonedInk < 0.35 * 256);

// Pixels come back in order of COVERAGE, so the restored texture follows the
// artwork's own geometry. Ranking in Bayer order replaced a checkerboard with
// its own weave; here the higher-covered column must be the one that inks.
const graded = CoverageOps.create(8, 8);
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) graded.data[y * 8 + x] = (x < 4) ? 0.35 : 0.15;
}
check('toneCorrect: puts ink back where the coverage is highest', (() => {
  const m = CoverageOps.toMaskToned(graded);
  const left = m.reduce((n, r) => n + r.slice(0, 4).filter(Boolean).length, 0);
  const right = m.reduce((n, r) => n + r.slice(4).filter(Boolean).length, 0);
  return left > right;
})());

check('toneCorrect: an empty buffer is safe', eq(CoverageOps.toMaskToned(CoverageOps.create(0, 0)), []));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/coverage-ops.test.js`
Expected: `TypeError: CoverageOps.toMaskToned is not a function`.

- [ ] **Step 3: Implement**

Add the constants beside `INK_COVERAGE`, and the function after `toMask`:

```js
    /** Tone-correction window edge, in px. One ZX cell. 16 leaves visible seams. */
    TONE_WINDOW: 8,

    /**
     * Tone error, as a fraction of the window, that must be exceeded before
     * anything is put back. 0.10 and 0.20 are within noise numerically
     * (artwork 0.949 against 0.954, photos 0.971 against 0.976); the contact
     * sheets favour 0.10 on the sparse tiles and 0.005 of IoU is the measured
     * price of taking them at their word.
     */
    TONE_TOLERANCE: 0.10,
```

```js
    /**
     * Leave the domain, putting back tone the threshold destroyed.
     *
     * The trigger is not "is the transform compressing" - a downscaled glyph
     * compresses too, and dithering one is exactly what must not happen - but
     * "did the threshold lose tone HERE", which separates the two cases
     * directly. Over each window: a letterform's interior is coverage 1 and
     * stays inked, its background is 0 and stays empty, and its edge band
     * roughly balances, so the deficit is near zero and nothing is touched.
     * A 25% dither field is 0.25 in every pixel and thresholds to NOTHING, so
     * the deficit is the whole tone and the rule restores it.
     *
     * Pixels come back in order of COVERAGE, not in Bayer order, so the
     * restored texture follows the artwork's own geometry - ranking by Bayer
     * replaced a checkerboard with its own weave and a diagonal tile with
     * generic noise. Ties, which is what a uniform field is, break on Bayer
     * order: that scatters the selection instead of clumping it into one
     * corner of the window.
     *
     * Measured no-op on letterforms: 0.994 / dComp 0.23, matching plain
     * coverage to three decimals on the bench's 1-bit glyph suite.
     */
    toMaskToned(cov, threshold = CoverageOps.INK_COVERAGE,
                win = CoverageOps.TONE_WINDOW, tolFrac = CoverageOps.TONE_TOLERANCE) {
        const out = CoverageOps.toMask(cov, threshold);
        if (!cov.w || !cov.h) return out;

        const jitter = (y, x) => (63 - CoverageOps._BAYER8[y & 7][x & 7]) / 63 * 1e-3;
        for (let wy = 0; wy < cov.h; wy += win) {
            for (let wx = 0; wx < cov.w; wx += win) {
                const cells = [];
                let areaSum = 0, inked = 0;
                for (let y = wy; y < Math.min(cov.h, wy + win); y++) {
                    for (let x = wx; x < Math.min(cov.w, wx + win); x++) {
                        cells.push([y, x]);
                        areaSum += cov.data[y * cov.w + x];
                        if (out[y][x]) inked++;
                    }
                }
                if (!cells.length) continue;
                const deficit = areaSum - inked;
                const tol = Math.max(1, tolFrac * cells.length);
                if (Math.abs(deficit) <= tol) continue;

                const key = ([y, x]) => cov.data[y * cov.w + x] + jitter(y, x);
                if (deficit > 0) {
                    const cand = cells.filter(([y, x]) => !out[y][x]).sort((a, b) => key(b) - key(a));
                    let need = Math.round(deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = true;
                } else {
                    const cand = cells.filter(([y, x]) => out[y][x]).sort((a, b) => key(a) - key(b));
                    let need = Math.round(-deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = false;
                }
            }
        }
        return out;
    },
```

And the Bayer table, as a module-private constant beside the object:

```js
/**
 * 8x8 ordered (Bayer) threshold matrix, 0..63. Used ONLY to break ties when
 * tone correction ranks equally-covered pixels - a uniform field has no
 * coverage order, and without a tie-break the restored ink clumps into one
 * corner of the window instead of scattering.
 */
const BAYER8 = (() => {
    let g = [[0]];
    for (let k = 1; k < 4; k++) {
        const n = g.length, out = [];
        for (let y = 0; y < n * 2; y++) out.push(new Array(n * 2).fill(0));
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const v = g[y][x] * 4;
                out[y][x] = v; out[y][x + n] = v + 2;
                out[y + n][x] = v + 3; out[y + n][x + n] = v + 1;
            }
        }
        g = out;
    }
    return g;
})();
```

with `_BAYER8: BAYER8,` as a member so the method can reach it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/coverage-ops.test.js` - expect `ALL CHECKS PASSED`.

- [ ] **Step 5: Run the gate and commit**

```bash
git add js/utils/coverage-ops.js tests/coverage-ops.test.js
git commit -m "feat: put back tone a flat threshold destroys

A 0.50 cut deletes any pattern too sparse to reach half anywhere - a 25%-dense
tile downscaled to 0.6 disappears entirely, and dither is this app's whole
shading system.

The trigger is not whether the transform is compressing, which a downscaled
glyph also is, but whether the threshold LOST TONE in this window. A
letterform's interior is coverage 1 and stays inked and its background is 0, so
the deficit is near zero and nothing is touched - measured a no-op to three
decimals on the bench's glyph suite. A dither field is 0.25 everywhere and
thresholds to nothing, so the whole tone comes back.

Pixels return in order of coverage so the restored texture keeps the artwork's
own geometry; Bayer order replaced a checkerboard with its own weave. Ties -
which is what a uniform field is - break on Bayer, to scatter rather than clump.

Three alternatives were measured and rejected: Bayer everywhere wrecks shape
(0.787 against 0.994 on glyphs), per-line dropout rescue misfires on artwork
where a blank row is usually background, and a whole-blank guard is
discontinuous in the rotation angle - blank at four angles and dense at the
fifth, which on a slider is a pattern flickering in and out."
```

---

### Task 5: Route the 1-bit chain through the domain

**Files:**
- Modify: `js/services/selection-service.js` (`_recomputeStampTransform`, lines 703-850)
- Create: `tests/browser/stamp-coverage-pipeline.spec.js`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: no new public API. The 1-bit path enters the domain once and leaves once.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/stamp-coverage-pipeline.spec.js`:

```js
'use strict';
/**
 * The 1-bit stamp chain runs in the coverage domain and thresholds once.
 *
 * Two defects this pins. A WARPED stamp used to come apart: measured over all
 * nine effects, the boolean path scores dComp 21.49 against 1.20 here - a
 * warped stamp gaining twenty-two pieces it should not have. And a sparse
 * DITHER pattern used to vanish when downscaled, because a 25%-dense tile
 * never reaches a half-coverage cut anywhere.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

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

/** A 48x48 stamp of the shipped diagonal-line pattern - 25% dense. */
const DIAGONAL = `() => {
    const e = window.PATTERN_BITMAPS['8x8/diagonal-left'];
    const bin = atob(e.d);
    const bits = [];
    for (let by = 0; by < bin.length; by++)
        for (let bit = 7; bit >= 0; bit--) bits.push((bin.charCodeAt(by) >> bit) & 1);
    return Array.from({ length: 48 }, (_, y) =>
        Array.from({ length: 48 }, (_, x) => !!bits[(y % e.h) * e.w + (x % e.w)]));
}`;

test('a warped stamp keeps its letterforms instead of coming apart',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(([componentsSrc]) => {
            const components = eval(componentsSrc);
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const m = tool._buildTextMask('HELLO', 'ZX ROM', false, false, 'horizontal');
            const out = {};
            for (const effect of ['arch-up', 'wave', 'inflate', 'perspective-top']) {
                SelectionService.startFloatingPasteFromMask(
                    m.pixels, m.width, m.height, 40, 40, 'bench',
                    { text: 'HELLO', fontFamily: 'ZX ROM', fontSize: 8,
                      bold: false, italic: false, layout: 'horizontal' }, 'none');
                SelectionService.setStampScale(3, 3);
                const flat = components(SelectionService.floatingPaste.pixels);
                SelectionService.setStampWarp(effect);
                out[effect] = { flat, warped: components(SelectionService.floatingPaste.pixels) };
                SelectionService.endFloatingPaste(false);
            }
            return out;
        }, [COMPONENTS]);

        for (const [effect, v] of Object.entries(r)) {
            // A warp bends the letterforms; it must not multiply them.
            expect(v.warped, `${effect}: ${v.flat} pieces flat, ${v.warped} warped`)
                .toBeLessThanOrEqual(Math.ceil(v.flat * 1.5) + 2);
        }
    });

test('a sparse dither pattern survives being scaled down', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(([diagonalSrc]) => {
        const mask = eval(diagonalSrc)();
        const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
        SelectionService.startFloatingPasteFromMask(mask, 48, 48, 40, 40, 'bench', null, 'none');
        const before = ink(SelectionService.floatingPaste.pixels);
        SelectionService.setStampScale(0.6, 0.6);
        const fp = SelectionService.floatingPaste;
        const after = ink(fp.pixels);
        const area = fp.width * fp.height;
        SelectionService.endFloatingPaste(false);
        return { before, after, area, srcArea: 48 * 48 };
    }, [DIAGONAL]);

    expect(r.before).toBeGreaterThan(0);
    // The tile is ~25% dense. Shrunk to 0.6 it must still read as a 25% field -
    // a plain threshold leaves NOTHING, which is what 7.1 of the design spec is
    // about. Density, not ink count, because the box shrank too.
    const densityBefore = r.before / r.srcArea;
    const densityAfter = r.after / r.area;
    expect(r.after).toBeGreaterThan(0);
    expect(densityAfter / densityBefore).toBeGreaterThan(0.6);
    expect(densityAfter / densityBefore).toBeLessThan(1.6);
});

test('a quarter turn of pixel artwork is still lossless', async ({ page }) => {
    await boot(page);

    // The domain must not cost the exact cases anything. A 90 degree turn is a
    // pure reindex and has to stay one.
    const r = await page.evaluate(() => {
        const mask = Array.from({ length: 16 }, (_, y) =>
            Array.from({ length: 24 }, (_, x) => ((x * 7 + y * 3) % 5) === 0));
        const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
        SelectionService.startFloatingPasteFromMask(mask, 24, 16, 40, 40, 'bench', null, 'none');
        SelectionService.setStampRotation(90);
        const turned = SelectionService.floatingPaste;
        const out = { src: ink(mask), turned: ink(turned.pixels), w: turned.width, h: turned.height };
        SelectionService.endFloatingPaste(false);
        return out;
    });

    expect(r.w).toBe(16);
    expect(r.h).toBe(24);
    expect(r.turned).toBe(r.src);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/browser/stamp-coverage-pipeline.spec.js --reporter=line`
Expected: the warp spec FAILS (the boolean path fragments), and the dither spec FAILS with `after` at or near 0. The quarter-turn spec should already pass - it is a guard against the change costing an exact case, not a driver.

- [ ] **Step 3: Rewrite the chain**

In `_recomputeStampTransform`, after Step 1 has produced `srcPixels`/`srcW`/`srcH` and the vector branch has had its chance, replace Steps 1b, 2 and 3 with a single domain pass. The `rotationApplied` flag from the vector half still short-circuits the rotation.

```js
    // ── Steps 1b-3, in the coverage domain ────────────────────────────────
    // Enter ONCE and leave ONCE. Every threshold taken between here and the
    // end is information destroyed before anything downstream can use it -
    // measured, the finest possible resample of an already-thresholded raster
    // scores 0.311 where the crudest scores 0.309.
    //
    // Scale is NOT composed with the rotation here even though CoverageOps.
    // transform can: the effects and the warp sit between them in this chain,
    // and reordering would change what a shadow or an arch looks like. Two
    // maps with one quantisation still beats three quantisations.
    const fi2 = fp.fontInfo;
    const wantsEffects = fi2 && (fi2.mirrorH || fi2.mirrorV || fi2.shadow || fi2.outline);
    const wantsWarp = fp._warpEffect && fp._warpEffect !== 'none';
    const wantsSpin = fp._rotation !== 0 && !rotationApplied;
    const wantsDirection = fi2 && fi2.direction && !rotationApplied;

    if (wantsEffects || wantsWarp || wantsSpin || wantsDirection) {
      let cov = CoverageOps.fromMask(srcPixels);
      if (wantsEffects) cov = CoverageOps.process(cov, fi2);
      if (wantsDirection) {
        cov = CoverageOps.transform(cov, { degrees: fi2.direction },
          CoverageOps.boxFor(cov.w, cov.h, { degrees: fi2.direction }));
      }
      if (wantsWarp) cov = CoverageOps.warp(cov, fp._warpEffect);
      if (wantsSpin) {
        cov = CoverageOps.transform(cov, { degrees: fp._rotation },
          CoverageOps.boxFor(cov.w, cov.h, { degrees: fp._rotation }));
      }
      // toMaskToned, not toMask: a sparse dither field thresholds to nothing,
      // and dither is this app's shading system (design spec 7.1).
      srcPixels = CoverageOps.toMaskToned(cov);
      srcW = cov.w;
      srcH = cov.h;
    }
```

Delete the old Step 1b block, the old Step 2 warp call and the old Step 3 rotation call. `_applyWarpEffect` and `_rotateMask` stay - `_applyWarpEffect` is still called from the paste path at line 611, and `_rotateMask` is `MaskOps.rotate`'s wrapper.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/browser/stamp-coverage-pipeline.spec.js --reporter=line`
Expected: 3 passed.

- [ ] **Step 5: Run both gates**

Run: `node tests/run-all.js` then `npx playwright test --reporter=line`.

Watch these especially - they exercise the chain being rewritten:
- `tests/browser/text-render-quality.spec.js` (the vector half; `rotationApplied` must still suppress the double turn)
- `tests/browser/text-stamp-rotation-lossless.spec.js` (45 and back to 0 must restore exactly)
- `tests/browser/stamp-xor.spec.js`, `stamp-draw-mode.spec.js`, `text-tool-stamp-handoff.spec.js`

- [ ] **Step 6: Commit**

```bash
git add js/services/selection-service.js tests/browser/stamp-coverage-pipeline.spec.js
git commit -m "feat: the stamp chain runs in coverage and thresholds once

Steps 1b, 2 and 3 enter the domain once and leave once, so the effects, the
warp and the rotation each stop quantising their own output for the next one to
resample. Measured over all nine warp effects, the boolean path scores dComp
21.49 - a warped stamp coming apart into twenty-two more pieces than it should
- against 1.20 here.

It leaves through toMaskToned rather than toMask, so a sparse dither pattern
survives being scaled down instead of vanishing at the cut.

Scale is deliberately NOT composed with the rotation despite transform() being
able to: the effects and the warp sit between them in this chain, and
reordering would change what a shadow or an arch looks like."
```

---

### Task 6: Keep it interactive

A full 640x256 stamp at ss=8 costs ~91 ms for the coverage map plus ~15 ms for tone correction [M] - six dropped frames per slider tick. A typical text stamp is 2.3 ms and needs no help at all.

**Files:**
- Modify: `js/services/selection-service.js`
- Modify: `js/utils/coverage-ops.js`
- Create: `tests/browser/stamp-live-budget.spec.js`

**Interfaces:**
- Consumes: Task 5.
- Produces: `CoverageOps.LIVE_BUDGET_MS` = `7`; `SelectionService.beginStampGesture()` / `endStampGesture()`, called by the Transform panel around a slider drag.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/stamp-live-budget.spec.js`:

```js
'use strict';
/**
 * A slider stays responsive on a large stamp.
 *
 * The budget is not a hardcoded pixel count - that would be a constant
 * measured on one machine and wrong on every other. The code times its own
 * first pass of a gesture and, if it exceeds LIVE_BUDGET_MS, drops to the
 * cheap path for the rest of that gesture and takes the exact one on release.
 * A slow machine degrades where a fast one stays exact, which is correct on
 * both.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a gesture on a large stamp degrades instead of dropping frames',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const big = Array.from({ length: 200 }, (_, y) =>
                Array.from({ length: 400 }, (_, x) => ((x + y) % 3) === 0));
            SelectionService.startFloatingPasteFromMask(big, 400, 200, 10, 10, 'bench', null, 'none');

            SelectionService.beginStampGesture();
            const t0 = performance.now();
            for (let d = 5; d <= 40; d += 5) SelectionService.setStampRotation(d);
            const perTick = (performance.now() - t0) / 8;
            const duringGesture = SelectionService.floatingPaste.pixels.length;
            SelectionService.endStampGesture();
            const afterRelease = SelectionService.floatingPaste.pixels.length;
            SelectionService.endFloatingPaste(false);
            return { perTick, duringGesture, afterRelease };
        });

        // Eight ticks of a 400x200 stamp. Without the fallback each is ~30ms.
        expect(r.perTick).toBeLessThan(20);
        // Releasing recomputes exactly, so the stamp is still the right shape.
        expect(r.afterRelease).toBeGreaterThan(0);
    });

test('a small stamp stays exact for the whole gesture', async ({ page }) => {
    await boot(page);

    // Below the budget nothing changes: the same result during the drag and
    // after release, so there is no visible snap on the stamps most people use.
    const r = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        const m = tool._buildTextMask('AB', 'ZX ROM', false, false, 'horizontal');
        SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height,
            40, 40, 'bench', null, 'none');
        SelectionService.beginStampGesture();
        SelectionService.setStampRotation(30);
        const during = SelectionService.floatingPaste.pixels.map((r2) => [...r2]);
        SelectionService.endStampGesture();
        const after = SelectionService.floatingPaste.pixels.map((r2) => [...r2]);
        SelectionService.endFloatingPaste(false);
        return { same: JSON.stringify(during) === JSON.stringify(after) };
    });

    expect(r.same).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/browser/stamp-live-budget.spec.js --reporter=line`
Expected: both FAIL with `SelectionService.beginStampGesture is not a function`.

- [ ] **Step 3: Implement**

Add the constant to `js/utils/coverage-ops.js`:

```js
    /**
     * How long one coverage pass may take before the interactive path gives up
     * on it for the rest of a gesture, in ms.
     *
     * 7, and it ties to the frame rather than to taste. A drag is direct
     * manipulation, so it wants 60fps: 16.7 ms. The rest of a slider tick -
     * re-raster, floating redraw, compose, render - measures 0.04 ms on a 16x8
     * stamp and 0.89 ms on a 352x32 one, so the pass may have most of the frame
     * before anything drops. 7 is under half of it, leaving room for paint and
     * a GC pause: running right at 16 means any hiccup drops a frame.
     *
     * Deliberately a TIME and not a pixel count. A pixel threshold would be
     * measured on one machine and wrong on every other; timing the pass lets a
     * slow machine degrade on a stamp where a fast one stays exact.
     */
    LIVE_BUDGET_MS: 7,
```

In `SelectionService`, add the gesture bracket and the fallback:

```js
  /**
   * Bracket a continuous gesture - a slider drag, a warp being scrubbed.
   *
   * Preview cheap, commit exact, the split the Transform panel's image
   * rotation slider already uses. The first coverage pass of the gesture is
   * TIMED, and if it overruns `CoverageOps.LIVE_BUDGET_MS` the rest of the
   * gesture takes the nearest-neighbour path at ss = 1 - same cost as before
   * any of this - with the exact pass taken once on release.
   */
  beginStampGesture() {
    this._gestureActive = true;
    this._gestureCheap = false;
  }

  endStampGesture() {
    const wasCheap = this._gestureCheap;
    this._gestureActive = false;
    this._gestureCheap = false;
    if (wasCheap) this._recomputeStampTransform();
  }
```

In the domain pass from Task 5, take `ss` from the gesture state and time the first pass:

```js
      const ss = this._gestureCheap ? 1 : CoverageOps.SUPERSAMPLE;
      const t0 = (this._gestureActive && !this._gestureCheap) ? performance.now() : 0;
```

pass `ss` into every `CoverageOps.transform`/`warp` call, and after the pass:

```js
      if (t0 && performance.now() - t0 > CoverageOps.LIVE_BUDGET_MS) {
        // One overrun is enough. Re-timing every tick would spend the budget
        // discovering it is out of budget.
        this._gestureCheap = true;
      }
```

Wire the Transform panel's sliders to the bracket in `js/ui/components/transform-panel.js` - `pointerdown` on `.tp-rot`, `.tp-sx`, `.tp-sy` calls `beginStampGesture`, and `change` (which fires on release, unlike `input`) calls `endStampGesture`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/browser/stamp-live-budget.spec.js --reporter=line` - expect 2 passed.

- [ ] **Step 5: Run both gates and commit**

Run: `node tests/run-all.js` then `npx playwright test --reporter=line`.

```bash
git add js/utils/coverage-ops.js js/services/selection-service.js js/ui/components/transform-panel.js tests/browser/stamp-live-budget.spec.js
git commit -m "perf: a gesture on a large stamp degrades instead of dropping frames

A full 640x256 stamp costs ~91ms for the coverage map plus ~15ms for tone
correction - six dropped frames per slider tick - while a typical text stamp is
2.3ms and needs no help at all.

The budget is a TIME the code measures about itself, not a pixel count: a pixel
threshold would be measured on one machine and wrong on every other. The first
pass of a gesture is timed, and one overrun drops the rest of that gesture to
nearest-neighbour with the exact pass taken on release. A slow machine degrades
where a fast one stays exact.

7ms ties to the frame: 16.7ms at 60fps less the measured 0.04-0.89ms
rest-of-tick, halved for paint and GC headroom. Running right at 16 means any
hiccup drops a frame."
```

---

### Task 7: Re-measure, and write down what is now true

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md`

- [ ] **Step 1: Re-run the bench and record the before/after**

Run: `node tools/text-transform-bench.js --write <scratch>/sheets`

`current` is the shipped path, so the warp and artwork suites should move. Expect warp's `dComp` to fall from 21.49 toward 1.20 and the artwork suite's `gone` column to stay at 0.

**Read the sheets, not only the table.** The bench's ground truth deletes sparse content the same way a plain threshold does, so a correctly tone-corrected result scores WORSE on IoU than one that threw the texture away. `art-pattern_diagonal_left-down.png` and `warp-pattern_diagonal_left-arch-up.png` are the two that matter.

If the ZX glyph suite has moved from 0.994, tone correction is firing where it should be a no-op - stop and investigate rather than adjusting the tolerance.

- [ ] **Step 2: Add the architecture note to CLAUDE.md**

Immediately after the coverage-rasterisation note added by the predecessor plan:

```markdown
**The whole stamp transform chain runs in a coverage domain and thresholds
ONCE, at the end.** `_recomputeStampTransform` enters with
`CoverageOps.fromMask` and leaves with `toMaskToned`; the text effects, the
warp and the rotation each run against `CoverageOps` in between. Every
threshold taken earlier is information destroyed before anything downstream can
use it - the finest possible resample of an already-thresholded raster scores
0.311 where the crudest scores 0.309. Warp gained the most: `dComp` 21.49 to
1.20 over all nine effects, a warped stamp no longer coming apart into
twenty-two pieces it should not have.

**Scale is NOT composed with the rotation, and that is deliberate.**
`CoverageOps.transform` can take both, but in this chain the effects and the
warp sit between them and reordering would change what a shadow or an arch
looks like. Two maps with one quantisation still beats three quantisations;
composition is available for a caller whose chain between them is empty.

**`toMaskToned` is how the domain is left, never `toMask`.** A flat 0.50 cut
deletes any pattern too sparse to reach half anywhere - a 25%-dense tile
downscaled to 0.6 disappears entirely - and dither IS this app's shading
system. The rule fires on "did the threshold lose tone in this window", not on
"is the transform compressing", because a downscaled glyph compresses too and
dithering one is exactly what must not happen. It is a measured no-op on
letterforms (0.994, matching plain coverage to three decimals). Pixels come
back in order of COVERAGE so the restored texture keeps the artwork's own
geometry; Bayer order replaced a checkerboard with its own weave.

**A gesture times itself.** `beginStampGesture`/`endStampGesture` bracket a
slider drag; the first coverage pass is timed and one overrun of
`CoverageOps.LIVE_BUDGET_MS` drops the rest of that gesture to
nearest-neighbour, with the exact pass on release. The budget is a TIME rather
than a pixel count on purpose - a pixel threshold is measured on one machine
and wrong on every other.
```

- [ ] **Step 3: Update the measured counts in `docs/CURRENT_STATE.md`**

```bash
ls tests/*.test.js | wc -l
ls tests/browser/*.spec.js | wc -l
npx playwright test --reporter=line 2>&1 | tail -1
```

- [ ] **Step 4: Mark the spec implemented**

Replace the `Status:` paragraph with one recording that sections 4.1, 4.3, 4.4 and 5 are now live, naming both plans, and keeping the note that two of its figures were corrected during the first half.

- [ ] **Step 5: Run both gates and commit**

```bash
git add CLAUDE.md docs/CURRENT_STATE.md docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md
git commit -m "docs: record the coverage pipeline, and what it cost to get right

The architecture note names the four things a future reader would otherwise
rediscover: that the chain enters the domain once and leaves once; that scale
is deliberately not composed with the rotation because the effects and warp sit
between them; that the domain is left through toMaskToned and never toMask,
because a flat cut deletes the dither patterns this app shades with; and that
the interactive budget is a time the code measures about itself rather than a
constant someone picked."
```

---

## What this plan does NOT do

- **Indexed (`fp._srcIndices`) stamps.** They already fall back to mask-plus-current-ink under warp or rotation, a documented Phase 13 limitation. Carrying per-pixel palette indices through a coverage domain is a different problem - there is no meaningful "half an index" - and needs its own design.
- **`TransformService`.** Flip, rotate and shift on the LAYER or selection are a separate path with their own attribute handling; only floating stamps move here.
- **The `_applyWarpEffect` call at line 611**, on the paste-creation path. It builds the initial stamp from an already-boolean mask, so there is nothing for the domain to preserve.
- **Widening the vector fast path.** It still serves only rotation-alone; with warp now good in the domain, whether it should also serve warped vector text is a measured question for its own change.
