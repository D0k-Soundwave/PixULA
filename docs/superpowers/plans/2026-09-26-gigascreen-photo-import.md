# Four-Colour Photo Import for the Two-Screen Modes - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A photo imported in GigaScreen, MultiGigaScreen 8x4/8x2/8x1 or the Timex hi-res pair uses each cell's four colour mixes, restricted to mixes that hold steady on real hardware.

**Architecture:** A new pure module, `GigaQuant` (`js/utils/giga-quant.js`), owns the steady-mix rule, the per-cell pair picker, the per-pixel renderer and the hi-res scheme picker. `PNGFormat` calls it from BOTH the import (`_applyToLayer`) and the dialog preview (`_quantizePrepared`) in two-screen modes, so the preview is the result. A bench tool measures the rule's one threshold on the seven real photos before anything depends on it.

**Tech Stack:** vanilla JS (IIFE singletons, no build, no dependencies); Node test suites run by `node tests/run-all.js`; Playwright browser specs run by `npx playwright test`.

**Spec:** `docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md` (approved 2026-09-26). Read it first.

## Global Constraints

- 7-bit ASCII in everything written: code, comments, commit messages. No emoji. Use `-`, `->`, `...`. The multiplication sign is not needed anywhere in this work.
- No AI attribution anywhere: no Co-Authored-By, no mention of Claude or AI in commits or comments.
- Never push, merge to main or tag. Commit locally only (standing rule, memory `push-only-when-resolved`).
- `node tests/run-all.js` must pass after every task. It includes the architecture lint: no inline clamp (use `Helpers.clamp`), `EVENTS.*` constants only.
- `GigaQuant` stays pure: no DOM, no `LayerManager`, no `ColorManager`. `PNGFormat` does all writing.
- The browser spec drives `PNGFormat.parse`, the call the Import dialog makes once a method is picked, rather than clicking through the dialog; the dialog itself is already covered by `tests/browser/import-methods.spec.js`.
- Every number carries a provenance tag in comments and docs: M (measured, with date and method), P (published, with source and date), C (computed, with working), A (assumed).
- The steady-mix threshold `GigaQuant.MAX_STEP = 1` is [A] until Task 6 measures it. No other code may depend on its value.
- A new script goes in `index.html` in dependency order (utils before io) and in `App`'s `BOOT_MANIFEST` (`js/app.js`).
- Blend arithmetic must equal `LayerManager._blendRGB`: per channel `(a + b) >> 1`.
- Distance is luma-weighted squared RGB, the same as `PNGFormat._dist2`: `dr*dr*0.299 + dg*dg*0.587 + db*db*0.114`.

## Review Focus

These are inputs the spec implies but no task's main tests would otherwise exercise. Each has a test added to the task named.

1. **A mid-grey photo.** No steady mix is mid-grey (black and white are not neighbours). A reasonable person expects it never to come out as a flickering black/white mix. Like today's two-colour import, a perfectly flat grey cell may come out as one steady colour: the picker counts nearest mixes, and a uniform cell has one. Test in Task 2 (grey cell: every chosen slot steady under Flat and Smooth).
2. **MultiGigaScreen 8x1 cells (8 pixels per cell).** The picker must still work when a cell has fewer pixels than candidate mixes. Test in Task 2 (`h = 1`).
3. **The hi-res pair with the Sharp method.** Sharp samples the full-size photo per cell; in the hi-res pair the picture is 512 wide and there is no per-cell choice. It must not crash and must produce a mixed-colour preview (it may differ slightly from Flat, because Sharp's pixel samples are block means of the original). Test in Task 5.
4. **Undo after a hi-res pair import.** One Ctrl+Z must restore both the picture and BOTH schemes. Test in Task 5.
5. **Import over an existing two-screen drawing.** Nothing of the old screen B may survive in cells the photo covers. Test in Task 4 (kept from the existing suite).

---

### Task 1: GigaQuant core - the steady rule and the steady palette

**Files:**
- Create: `js/utils/giga-quant.js`
- Modify: `index.html` (script tag after `js/utils/palette-ops.js`, line 506)
- Modify: `js/app.js` (`BOOT_MANIFEST`, after the `PaletteOps` entry at line 34)
- Test: `tests/giga-quant.test.js` (new)

**Interfaces:**
- Produces: `window.GigaQuant` with `MAX_STEP` (number), `colourRGB(base, bright) -> Uint8Array`, `blend(c1, c2) -> number[3]`, `isSteady(baseA, brightA, baseB, brightB, maxStep?) -> boolean`, `steadyPalette(maxStep?) -> Array<{a:{base,bright}, b:{base,bright}, rgb:number[3]}>`, `slotsFor(pick, maxStep?) -> Array<{slot:number, rgb:number[3]}>` where `pick = {a:{ink,paper,bright}, b:{ink,paper,bright}}`, `_dist2(r, g, b, rgb) -> number`.

- [ ] **Step 1: Write the failing test**

Create `tests/giga-quant.test.js`:

```js
'use strict';
/**
 * GigaQuant - the four-colour converter for the two-screen modes
 * (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md).
 *
 * Section 1: the steady-mix rule and the steady palette.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/giga-quant.js');

const Q = GigaQuant;

// --- 1. The steady rule ---------------------------------------------------

check('a colour mixed with itself is steady', Q.isSteady(3, false, 3, false, 1));
check('a colour mixed with its bright self is steady', Q.isSteady(5, false, 5, true, 1));
check('neighbours in the colour order are steady', Q.isSteady(1, false, 2, false, 1));
check('neighbours of different brightness are not', !Q.isSteady(1, false, 2, true, 1));
check('two steps apart is not steady at step 1', !Q.isSteady(1, false, 3, false, 1));
check('two steps apart is steady at step 2', Q.isSteady(1, false, 3, false, 2));
check('black and white never are at step 1', !Q.isSteady(0, false, 7, false, 1));
check('the default step is MAX_STEP', Q.isSteady(4, true, 5, true) === Q.isSteady(4, true, 5, true, Q.MAX_STEP));

// --- 2. Colours and the blend ---------------------------------------------

check('colourRGB reads the fixed palette', Q.colourRGB(2, false) === ZX_PALETTE_RGB[2]
  && Q.colourRGB(2, true) === ZX_PALETTE_RGB[10]);
const bl = Q.blend([215, 0, 0], [0, 0, 215]);
check('blend is the per-channel average, floored', bl[0] === 107 && bl[1] === 0 && bl[2] === 107,
  `got ${bl}`);

// --- 3. The steady palette -------------------------------------------------

const pal = Q.steadyPalette(1);
check('every palette entry is steady',
  pal.every(e => Q.isSteady(e.a.base, e.a.bright, e.b.base, e.b.bright, 1)));
check('the palette holds every plain colour',
  [0, 1, 2, 3, 4, 5, 6, 7].every(c => pal.some(e => e.a.base === c && e.b.base === c)));
check('the palette is cached per step', Q.steadyPalette(1) === pal && Q.steadyPalette(2) !== pal);
check('a looser step allows more mixes', Q.steadyPalette(2).length > pal.length);

// --- 4. A pair's usable slots ----------------------------------------------

const bw = { a: { ink: 0, paper: 7, bright: false }, b: { ink: 0, paper: 7, bright: false } };
const usable = Q.slotsFor(bw, 1).map(s => s.slot).join();
check('black-on-white on both screens keeps only the two steady slots', usable === '0,3', usable);
const nb = { a: { ink: 1, paper: 2, bright: false }, b: { ink: 2, paper: 1, bright: false } };
check('neighbour colours give all four slots', Q.slotsFor(nb, 1).length === 4);
check('a slot shows the blend of its two frames',
  Q.slotsFor(nb, 1).find(s => s.slot === 3).rgb.join() === Q.blend(ZX_PALETTE_RGB[1], ZX_PALETTE_RGB[2]).join());

summary();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/giga-quant.test.js`
Expected: FAIL - `ENOENT` for `js/utils/giga-quant.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `js/utils/giga-quant.js`:

```js
'use strict';
(function() {

/**
 * GigaQuant - converts a photo into the two-screen modes' four colours per
 * cell (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md).
 *
 * A two-screen cell holds one attribute per screen, so its four colours are
 * the four pairings of screen A's ink/paper with screen B's (GIGA_SLOTS: slot
 * = bitA * 2 + bitB). Only STEADY mixes are used - pairs whose two frames are
 * close in brightness - so the picture holds still on real hardware instead
 * of flickering. That was the artist's choice (2026-09-26) over accuracy
 * against the app's Average display.
 *
 * Pure: takes RGB samples, returns attributes and pixel planes. No DOM, no
 * layers - PNGFormat does the writing, for the import and the preview alike.
 */
class GigaQuantClass {
  constructor() {
    /**
     * How far apart two colours may be, in the Spectrum's own colour order
     * (n = G*4 + R*2 + B, black 0 to white 7 in rising luminance), and still
     * mix steadily. [A] 2026-09-26 - tools/giga-bench.js measures it; until
     * then nothing may depend on its value.
     */
    this.MAX_STEP = 1;
    this._paletteCache = new Map();
  }

  /** RGB of a fixed-palette colour. */
  colourRGB(base, bright) {
    return ZX_PALETTE_RGB[(base & 7) + (bright ? 8 : 0)];
  }

  /** The Average display's blend - the same arithmetic as LayerManager._blendRGB. */
  blend(c1, c2) {
    return [(c1[0] + c2[0]) >> 1, (c1[1] + c2[1]) >> 1, (c1[2] + c2[2]) >> 1];
  }

  /**
   * Does a mix of these two colours hold steady? The same colour always does
   * (bright or not); otherwise they must share the bright setting and sit at
   * most maxStep apart in the colour order.
   */
  isSteady(baseA, brightA, baseB, brightB, maxStep = this.MAX_STEP) {
    if (baseA === baseB) return true;
    return !!brightA === !!brightB && Math.abs(baseA - baseB) <= maxStep;
  }

  /**
   * Every steady mix of the fixed palette, with the colour the Average
   * display shows for it. Cached per step.
   * @returns {Array<{a:{base:number,bright:boolean}, b:{base:number,bright:boolean}, rgb:number[]}>}
   */
  steadyPalette(maxStep = this.MAX_STEP) {
    let palette = this._paletteCache.get(maxStep);
    if (palette) return palette;
    palette = [];
    for (const brightA of [false, true]) {
      for (let a = 0; a < 8; a++) {
        for (const brightB of [false, true]) {
          for (let b = 0; b < 8; b++) {
            if (!this.isSteady(a, brightA, b, brightB, maxStep)) continue;
            palette.push({
              a: { base: a, bright: brightA },
              b: { base: b, bright: brightB },
              rgb: this.blend(this.colourRGB(a, brightA), this.colourRGB(b, brightB))
            });
          }
        }
      }
    }
    this._paletteCache.set(maxStep, palette);
    return palette;
  }

  /**
   * The slots a pair of attributes can show steadily, with their colours.
   * @param {{a:{ink:number,paper:number,bright:boolean}, b:{ink:number,paper:number,bright:boolean}}} pick
   * @returns {Array<{slot:number, rgb:number[]}>}
   */
  slotsFor(pick, maxStep = this.MAX_STEP) {
    const out = [];
    for (let slot = 0; slot < GIGA_SLOTS.COUNT; slot++) {
      const baseA = GIGA_SLOTS.bitA(slot) ? pick.a.ink : pick.a.paper;
      const baseB = GIGA_SLOTS.bitB(slot) ? pick.b.ink : pick.b.paper;
      if (!this.isSteady(baseA, pick.a.bright, baseB, pick.b.bright, maxStep)) continue;
      out.push({
        slot,
        rgb: this.blend(this.colourRGB(baseA, pick.a.bright), this.colourRGB(baseB, pick.b.bright))
      });
    }
    return out;
  }

  /** Luma-weighted squared distance - the same measure as PNGFormat._dist2. */
  _dist2(r, g, b, rgb) {
    const dr = r - rgb[0];
    const dg = g - rgb[1];
    const db = b - rgb[2];
    return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
  }
}

window.GigaQuant = new GigaQuantClass();

})(); // End IIFE
```

Add to `index.html` directly after the `palette-ops.js` line:

```html
    <script defer src="js/utils/giga-quant.js"></script>
```

Add to `BOOT_MANIFEST` in `js/app.js` directly after `['PaletteOps', 'js/utils/palette-ops.js'],`:

```js
    ['GigaQuant',        'js/utils/giga-quant.js'],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tests/giga-quant.test.js` - Expected: `ALL CHECKS PASSED`.
Run: `node tests/run-all.js` - Expected: `ALL TEST FILES PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/utils/giga-quant.js index.html js/app.js tests/giga-quant.test.js
git commit -m "feat: GigaQuant core - the steady-mix rule for two-screen photo import"
```

---

### Task 2: GigaQuant - choosing and drawing one cell

**Files:**
- Modify: `js/utils/giga-quant.js`
- Test: `tests/giga-quant.test.js`

**Interfaces:**
- Consumes: Task 1's `steadyPalette`, `slotsFor`, `_dist2`, `colourRGB`.
- Produces: `chooseCell(samples, maxStep?) -> pick` (`samples` is a flat `[r,g,b,...]` Float32Array of any length divisible by 3; `pick = {a:{ink,paper,bright}, b:{ink,paper,bright}}`, always with at least one usable slot), and `renderCell(cellRGB, pick, dithering, w, h, maxStep?) -> {pixelsA:Uint8Array(h), pixelsB:Uint8Array(h), slots:Uint8Array(w*h), slotRGB:Array<number[]|null>(4)}` where `dithering` is `'none'` or `'floyd-steinberg'`, row bytes are MSB = leftmost pixel, and `slotRGB[s]` is null for an unusable slot.

- [ ] **Step 1: Write the failing tests**

Insert before `summary();` in `tests/giga-quant.test.js`:

```js
// --- 5. Choosing a cell ------------------------------------------------------

const cellOf = (w, h, colourAt) => {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out.set(colourAt(x, y), (y * w + x) * 3);
  }
  return out;
};
const cellError = (cell, w, h, r) => {
  let err = 0;
  for (let i = 0; i < w * h; i++) {
    const rgb = r.slotRGB[r.slots[i]];
    err += Q._dist2(cell[i * 3], cell[i * 3 + 1], cell[i * 3 + 2], rgb);
  }
  return err;
};
const allSteady = (pick, r) =>
  Array.from(r.slots).every(s => Q.slotsFor(pick, 1).some(u => u.slot === s));

{
  // A cell that is exactly one steady mix: blue with red, both normal
  const mix = Q.blend(ZX_PALETTE_RGB[1], ZX_PALETTE_RGB[2]);
  const cell = cellOf(8, 8, () => mix);
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  check('a cell of one steady mix is reproduced exactly', cellError(cell, 8, 8, r) === 0,
    `error ${cellError(cell, 8, 8, r)}`);
}

{
  // Black and white halves: two steady slots (black/black, white/white)
  const cell = cellOf(8, 8, (x) => (x < 4 ? [0, 0, 0] : [215, 215, 215]));
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  check('black and white halves are reproduced exactly', cellError(cell, 8, 8, r) === 0);
  check('... using only steady slots', allSteady(pick, r));
  check('... and the rows say which screen is ink',
    r.pixelsA[0] === r.pixelsB[0] && (r.pixelsA[0] === 0x0F || r.pixelsA[0] === 0xF0),
    `A ${r.pixelsA[0]} B ${r.pixelsB[0]}`);
}

{
  // Review Focus 1: mid grey has no steady mix of its own
  const cell = cellOf(8, 8, () => [128, 128, 128]);
  const pick = Q.chooseCell(cell, 1);
  const flat = Q.renderCell(cell, pick, 'none', 8, 8, 1);
  const smooth = Q.renderCell(cell, pick, 'floyd-steinberg', 8, 8, 1);
  check('grey uses only steady slots', allSteady(pick, flat) && allSteady(pick, smooth));
}

{
  // Property: random cells never land on a flickering slot
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let ok = true;
  for (let t = 0; t < 200 && ok; t++) {
    const cell = cellOf(8, 8, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
    const pick = Q.chooseCell(cell, 1);
    for (const d of ['none', 'floyd-steinberg']) {
      if (!allSteady(pick, Q.renderCell(cell, pick, d, 8, 8, 1))) ok = false;
    }
  }
  check('200 random cells use only steady slots', ok);
}

{
  // Review Focus 2: MultiGigaScreen 8x1 - eight pixels in a cell
  const cell = cellOf(8, 1, (x) => (x % 2 ? [0, 0, 215] : [215, 0, 0]));
  const pick = Q.chooseCell(cell, 1);
  const r = Q.renderCell(cell, pick, 'none', 8, 1, 1);
  check('an 8x1 cell is chosen and drawn', r.pixelsA.length === 1 && r.slots.length === 8);
  check('an 8x1 cell of two neighbour colours is exact', cellError(cell, 8, 1, r) === 0,
    `error ${cellError(cell, 8, 1, r)}`);
}

{
  // The Sharp method hands chooseCell more samples than renderCell draws
  const many = cellOf(24, 24, (x) => (x < 12 ? [0, 0, 0] : [215, 215, 215]));
  const pick = Q.chooseCell(many, 1);
  check('chooseCell accepts any number of samples', Q.slotsFor(pick, 1).length > 0);
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tests/giga-quant.test.js`
Expected: FAIL - `TypeError: Q.chooseCell is not a function`.

- [ ] **Step 3: Write the implementation**

Add these methods to `GigaQuantClass` in `js/utils/giga-quant.js`, after `slotsFor`:

```js
  /**
   * Choose one cell's two attributes (spec section 4).
   *
   * 1. Each sample's nearest steady mix, counted.
   * 2. The most-used mixes name the colours each screen needs; each screen's
   *    candidate pairs come from those colours only - a few dozen
   *    combinations instead of the 16,384 of a full search [C: 128
   *    attributes per screen (8 ink x 8 paper x 2 bright), squared].
   * 3. Every combination is scored by giving each sample its nearest USABLE
   *    slot; the least total error wins. Each screen-A candidate is also
   *    tried with the same pair on screen B, which always has two steady
   *    slots (a colour mixed with itself), so a pick always exists.
   * @param {Float32Array|number[]} samples - flat r,g,b triples
   * @returns {{a:{ink:number,paper:number,bright:boolean}, b:{ink:number,paper:number,bright:boolean}}}
   */
  chooseCell(samples, maxStep = this.MAX_STEP) {
    const palette = this.steadyPalette(maxStep);
    const n = samples.length / 3;
    const counts = new Array(palette.length).fill(0);
    for (let i = 0; i < n; i++) {
      const r = samples[i * 3], g = samples[i * 3 + 1], b = samples[i * 3 + 2];
      let nearest = 0, nd = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const d = this._dist2(r, g, b, palette[p].rgb);
        if (d < nd) { nd = d; nearest = p; }
      }
      counts[nearest]++;
    }
    const top = counts
      .map((count, index) => ({ count, index }))
      .filter((e) => e.count > 0)
      .sort((x, y) => y.count - x.count)
      .slice(0, GIGA_SLOTS.COUNT)
      .map((e) => palette[e.index]);

    const pairsA = this._candidatePairs(top.map((t) => t.a));
    const pairsB = this._candidatePairs(top.map((t) => t.b));

    let best = null;
    const tryPick = (pick) => {
      const slots = this.slotsFor(pick, maxStep);
      if (!slots.length) return;
      let err = 0;
      for (let i = 0; i < n; i++) {
        const r = samples[i * 3], g = samples[i * 3 + 1], b = samples[i * 3 + 2];
        let nd = Infinity;
        for (const s of slots) {
          const d = this._dist2(r, g, b, s.rgb);
          if (d < nd) nd = d;
        }
        err += nd;
        if (best && err >= best.err) return;
      }
      best = { pick, err };
    };
    for (const a of pairsA) {
      tryPick({ a, b: a });
      for (const b of pairsB) tryPick({ a, b });
    }
    return best.pick;
  }

  /**
   * One screen's candidate attributes from the colours the top mixes need:
   * every unordered ink/paper pair of those colours within one bright
   * setting (black belongs to both - it is the same colour either way).
   * @param {Array<{base:number, bright:boolean}>} colours
   * @returns {Array<{ink:number, paper:number, bright:boolean}>}
   * @private
   */
  _candidatePairs(colours) {
    const pairs = [];
    for (const bright of [false, true]) {
      const bases = [...new Set(colours
        .filter((c) => c.bright === bright || c.base === 0)
        .map((c) => c.base))];
      for (let i = 0; i < bases.length; i++) {
        for (let j = i; j < bases.length; j++) {
          pairs.push({ ink: bases[j], paper: bases[i], bright });
        }
      }
    }
    return pairs;
  }

  /**
   * Draw one cell with a chosen pick: each pixel takes its nearest usable
   * slot. Floyd-Steinberg diffuses the error inside the cell only, as the
   * two-colour path does (PNGFormat._renderCellMask), since the colours
   * change at every cell boundary.
   * @param {Float32Array} cellRGB - flat r,g,b for the w x h cell (not mutated)
   * @param {Object} pick - from chooseCell (or hiresPick)
   * @param {string} dithering - 'none' or 'floyd-steinberg'
   * @param {number} w
   * @param {number} h
   * @returns {{pixelsA:Uint8Array, pixelsB:Uint8Array, slots:Uint8Array, slotRGB:Array}}
   */
  renderCell(cellRGB, pick, dithering, w, h, maxStep = this.MAX_STEP) {
    const usable = this.slotsFor(pick, maxStep);
    const slotRGB = [null, null, null, null];
    for (const s of usable) slotRGB[s.slot] = s.rgb;
    const buf = Float32Array.from(cellRGB);
    const pixelsA = new Uint8Array(h);
    const pixelsB = new Uint8Array(h);
    const slots = new Uint8Array(w * h);
    const diffuse = dithering === 'floyd-steinberg';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        const r = Helpers.clamp(buf[i], 0, 255);
        const g = Helpers.clamp(buf[i + 1], 0, 255);
        const b = Helpers.clamp(buf[i + 2], 0, 255);
        let best = usable[0], bd = Infinity;
        for (const s of usable) {
          const d = this._dist2(r, g, b, s.rgb);
          if (d < bd) { bd = d; best = s; }
        }
        slots[y * w + x] = best.slot;
        const bit = 1 << (w - 1 - x);
        if (GIGA_SLOTS.bitA(best.slot)) pixelsA[y] |= bit;
        if (GIGA_SLOTS.bitB(best.slot)) pixelsB[y] |= bit;
        if (diffuse) {
          const er = r - best.rgb[0], eg = g - best.rgb[1], eb = b - best.rgb[2];
          this._diffuse(buf, x + 1, y, er, eg, eb, 7 / 16, w, h);
          this._diffuse(buf, x - 1, y + 1, er, eg, eb, 3 / 16, w, h);
          this._diffuse(buf, x, y + 1, er, eg, eb, 5 / 16, w, h);
          this._diffuse(buf, x + 1, y + 1, er, eg, eb, 1 / 16, w, h);
        }
      }
    }
    return { pixelsA, pixelsB, slots, slotRGB };
  }

  /** Add a share of the error to one neighbour inside the cell. @private */
  _diffuse(buf, x, y, er, eg, eb, factor, w, h) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 3;
    buf[i] += er * factor;
    buf[i + 1] += eg * factor;
    buf[i + 2] += eb * factor;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tests/giga-quant.test.js` - Expected: `ALL CHECKS PASSED`.
Run: `node tests/run-all.js` - Expected: `ALL TEST FILES PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/utils/giga-quant.js tests/giga-quant.test.js
git commit -m "feat: GigaQuant chooses and draws a two-screen cell from steady mixes"
```

---

### Task 3: GigaQuant - the Timex hi-res pair's schemes

**Files:**
- Modify: `js/utils/giga-quant.js`
- Test: `tests/giga-quant.test.js`

**Interfaces:**
- Consumes: Task 1's `slotsFor`, `_dist2`; Task 2's pick shape.
- Produces: `hiresPick(inkA, inkB) -> pick` (scheme n = ink n on paper n ^ 7, bright, per `ColorManager._deriveTimexMonoPalette`), and `chooseHiresSchemes(image, maxStep?) -> {inkA:number, inkB:number}` where `image = {width, height, data: Uint8ClampedArray RGBA}`.

- [ ] **Step 1: Write the failing tests**

Insert before `summary();`:

```js
// --- 6. The hi-res pair ----------------------------------------------------

{
  const p = Q.hiresPick(2, 5);
  check('a hi-res pick is each scheme\'s ink on its complement, bright',
    p.a.ink === 2 && p.a.paper === 5 && p.a.bright === true
      && p.b.ink === 5 && p.b.paper === 2 && p.b.bright === true);

  // A 16x8 image, left half one steady mix of two bright schemes' inks,
  // right half another: some scheme pair reproduces it exactly
  const target = Q.blend(ZX_PALETTE_RGB[10], ZX_PALETTE_RGB[11]); // bright red + bright magenta
  const W2 = 16, H2 = 8;
  const data = new Uint8ClampedArray(W2 * H2 * 4);
  for (let i = 0; i < W2 * H2; i++) data.set([...target, 255], i * 4);
  const s = Q.chooseHiresSchemes({ width: W2, height: H2, data }, 1);
  const pick = Q.hiresPick(s.inkA, s.inkB);
  check('the chosen schemes can show the image\'s colour steadily',
    Q.slotsFor(pick, 1).some(u => u.rgb.join() === target.join()),
    `schemes ${s.inkA}/${s.inkB}`);
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tests/giga-quant.test.js`
Expected: FAIL - `TypeError: Q.hiresPick is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `GigaQuantClass` after `_diffuse`:

```js
  /**
   * The pick a hi-res scheme pair stands for: scheme n is ink n on paper
   * n ^ 7, both bright (ColorManager._deriveTimexMonoPalette).
   */
  hiresPick(inkA, inkB) {
    return {
      a: { ink: inkA & 7, paper: (inkA & 7) ^ 7, bright: true },
      b: { ink: inkB & 7, paper: (inkB & 7) ^ 7, bright: true }
    };
  }

  /**
   * The Timex hi-res pair has ONE scheme per screen for the whole picture,
   * so there is no per-cell choice: all 64 scheme pairings [C: 8 x 8] are
   * scored against the image using only their steady slots, and the best
   * wins. A pairing with no steady slot is skipped; (n, n) always has two.
   * @param {{width:number, height:number, data:Uint8ClampedArray}} image
   * @returns {{inkA:number, inkB:number}}
   */
  chooseHiresSchemes(image, maxStep = this.MAX_STEP) {
    const n = image.width * image.height;
    const d = image.data;
    let best = null;
    for (let inkA = 0; inkA < 8; inkA++) {
      for (let inkB = 0; inkB < 8; inkB++) {
        const slots = this.slotsFor(this.hiresPick(inkA, inkB), maxStep);
        if (!slots.length) continue;
        let err = 0;
        for (let p = 0; p < n; p++) {
          const o = p * 4;
          let nd = Infinity;
          for (const s of slots) {
            const dd = this._dist2(d[o], d[o + 1], d[o + 2], s.rgb);
            if (dd < nd) nd = dd;
          }
          err += nd;
          if (best && err >= best.err) break;
        }
        if (!best || err < best.err) best = { inkA, inkB, err };
      }
    }
    return { inkA: best.inkA, inkB: best.inkB };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tests/giga-quant.test.js` - Expected: `ALL CHECKS PASSED`.
Run: `node tests/run-all.js` - Expected: `ALL TEST FILES PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/utils/giga-quant.js tests/giga-quant.test.js
git commit -m "feat: GigaQuant picks the Timex hi-res pair's two schemes"
```

---

### Task 4: PNGFormat - import and preview through GigaQuant

**Files:**
- Modify: `js/io/png-format.js` (`_applyToLayer` near line 294; `_preparePreview` near line 472; `_quantizePrepared` near line 505)
- Test: `tests/gigascreen-ops.test.js` (section 1, "Photo import fills both screens")

**Interfaces:**
- Consumes: `GigaQuant.chooseCell`, `renderCell`, `hiresPick`, `chooseHiresSchemes` (Tasks 2-3); existing `PNGFormat._cellSamples(screen, source, cellX, cellY, w, h) -> {cellRGB, decideRGB}`.
- Produces: `PNGFormat._gigaCell(hiresPick, decideRGB, cellRGB, dithering, w, h) -> {pick, result}` (private, shared by import and preview); the prepared object from `_preparePreview` gains `giga: boolean` and `hiresPick: pick|null`.

- [ ] **Step 1: Replace the section-1 test in `tests/gigascreen-ops.test.js`**

`tests/gigascreen-ops.test.js` must load GigaQuant before `png-format.js`. Add after `loadModule('js/utils/palette-ops.js');`:

```js
loadModule('js/utils/giga-quant.js');
```

Replace the whole block under `// --- 1. Photo import fills both screens ---` (from its opening `{` to its closing `}`) with:

```js
{
  const layer = gigaDoc();
  // Something different on screen B already, where the photo will land
  layer.setCell(0, 0, { ink: 0, paper: 7, bright: false, flash: false, pixels: rows(0),
    inkB: 4, paperB: 1, brightB: true, flashB: false, pixelsB: rows(0xFF) });
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
  const data = new Uint8ClampedArray(W * H * 4);
  // A ramp between two neighbour colours: only mixes can show its middle
  for (let i = 0; i < W * H; i++) {
    const t = (i % W) / (W - 1);
    data.set([Math.round(215 * (1 - t)), 0, Math.round(215 * t), 255], i * 4);
  }
  const image = { width: W, height: H, data };
  PNGFormat._applyToLayer(image, 'none', null);

  let flicker = null, differ = false;
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS && !flicker; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS && !flicker; cx++) {
      const c = layer.getCell(cx, cy);
      if (c.inkB !== c.ink || c.paperB !== c.paper
          || c.pixelsB.some((r, i) => r !== c.pixels[i])) differ = true;
      for (let y = 0; y < c.pixels.length; y++) {
        for (let x = 0; x < 8; x++) {
          const bitA = (c.pixels[y] >> (7 - x)) & 1, bitB = (c.pixelsB[y] >> (7 - x)) & 1;
          const baseA = bitA ? c.ink : c.paper, baseB = bitB ? c.inkB : c.paperB;
          if (!GigaQuant.isSteady(baseA, c.bright, baseB, c.brightB)) flicker = `${cx},${cy}`;
        }
      }
    }
  }
  check('a photo imported into GigaScreen shows only steady mixes', flicker === null,
    `flickering pixel in cell ${flicker}`);
  check('the two screens are not simply copies of each other', differ);
  const c = layer.getCell(0, 0);
  check('the old screen-B drawing is gone', c.inkB !== 4 || c.pixelsB[0] !== 0xFF);

  // The preview is exactly what the import wrote, seen through the Average blend
  const flat = PNGFormat.quantizePreviewSet(image, { scaling: 'fit' }).find(s => s.id === 'flat').preview;
  let mismatch = null;
  for (let py = 0; py < H && !mismatch; py++) {
    for (let px = 0; px < W && !mismatch; px++) {
      const cell = layer.getCell(px >> 3, py >> 3);
      const y = py & 7, bit = 7 - (px & 7);
      const baseA = (cell.pixels[y] >> bit) & 1 ? cell.ink : cell.paper;
      const baseB = (cell.pixelsB[y] >> bit) & 1 ? cell.inkB : cell.paperB;
      const want = GigaQuant.blend(GigaQuant.colourRGB(baseA, cell.bright),
        GigaQuant.colourRGB(baseB, cell.brightB));
      const o = (py * W + px) * 4;
      if (flat.data[o] !== want[0] || flat.data[o + 1] !== want[1] || flat.data[o + 2] !== want[2]) {
        mismatch = `${px},${py}`;
      }
    }
  }
  check('the Flat preview is exactly the imported picture', mismatch === null, `differs at ${mismatch}`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/gigascreen-ops.test.js`
Expected: FAIL on `the two screens are not simply copies of each other` (the import still mirrors screen A) and on `the Flat preview is exactly the imported picture`.

- [ ] **Step 3: Implement in `js/io/png-format.js`**

3a. Add this private method directly above `_applyToLayer`:

```js
  /**
   * One cell in a two-screen mode (GigaScreen, MultiGigaScreen, the hi-res
   * pair): its two attributes and both pixel planes, from GigaQuant. The
   * import and the preview both come through here, so the preview IS the
   * result. The hi-res pair has one scheme pair for the whole picture
   * (hiresPick); every other two-screen mode chooses per cell.
   * @returns {{pick:Object, result:Object}}
   * @private
   */
  _gigaCell(hiresPick, decideRGB, cellRGB, dithering, w, h) {
    const pick = hiresPick || GigaQuant.chooseCell(decideRGB);
    return { pick, result: GigaQuant.renderCell(cellRGB, pick, dithering, w, h) };
  }
```

3b. In `_applyToLayer`, replace the `const twoScreens = ZX_SPECTRUM.SCREENS === 2;` line and everything from `for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {` down to the end of that first cell loop (the one that calls `layer.setCell`) with:

```js
    const twoScreens = ZX_SPECTRUM.SCREENS === 2;

    UndoRedoService.beginAction('Load PNG');

    let paletteRGBs = null;
    if (ulaplus) {
      const regs = this.buildUlaplusPalette(imageData);
      if (window.ColorManager) ColorManager.setUlaplusRegisters(regs);
      paletteRGBs = Array.from(regs, (r) => ULAPLUS.registerToRGB(r));
    }

    // The hi-res pair: its two schemes are document state, set inside this
    // undo action so one Ctrl+Z restores them with the picture.
    let hiresPick = null;
    if (twoScreens && ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
      const schemes = GigaQuant.chooseHiresSchemes(imageData);
      hiresPick = GigaQuant.hiresPick(schemes.inkA, schemes.inkB);
      if (window.ColorManager) {
        ColorManager.setTimexHiresInk(schemes.inkA);
        ColorManager.setTimexHiresInkB(schemes.inkB);
      }
    }

    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const { cellRGB, decideRGB } =
          this._cellSamples(imageData, source, cellX, cellY, cw, ch);

        // Two-screen modes: four steady colours per cell, both screens
        // written (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md)
        if (twoScreens) {
          const { pick, result } =
            this._gigaCell(hiresPick, decideRGB, cellRGB, dithering, cw, ch);
          layer.setCell(cellX, cellY, {
            ink: pick.a.ink, paper: pick.a.paper, bright: pick.a.bright, flash: false,
            pixels: result.pixelsA,
            inkB: pick.b.ink, paperB: pick.b.paper, brightB: pick.b.bright, flashB: false,
            pixelsB: result.pixelsB
          });
          continue;
        }

        let attrs, pixels;
        if (ulaplus) {
          const pick = this._chooseCellPairUlaplus(decideRGB, paletteRGBs);
          pixels = this._renderCellMask(cellRGB, pick, dithering, cw, ch);
          attrs = {
            ink: pick.inkSlot,
            paper: pick.paperSlot,
            bright: (pick.clut & 1) !== 0,
            flash: (pick.clut & 2) !== 0
          };
        } else {
          const pair = this._chooseCellPair(decideRGB);
          pixels = this._renderCellMask(cellRGB, pair, dithering, cw, ch);
          attrs = {
            ink: pair.ink % 8,
            paper: pair.paper % 8,
            bright: pair.bright,
            flash: false
          };
        }

        layer.setCell(cellX, cellY, {
          ink: attrs.ink,
          paper: attrs.paper,
          bright: attrs.bright,
          flash: attrs.flash,
          pixels: pixels
        });
      }
    }
```

The replaced span runs from the `const twoScreens` line through the closing braces of the first cell loop, so it includes the existing `UndoRedoService.beginAction('Load PNG');` and `paletteRGBs` lines (re-stated above) and the `if (twoScreens) { data.inkB = ...; data.pixelsB = pixels; }` mirror added in `b81b072`, which is gone afterwards. The "Sync to AttributeSystem" loop after it stays unchanged.

3c. In `_preparePreview`, replace its final two statements (from `// ULAplus: preview the palette ...` to the `return`) with:

```js
    // ULAplus: preview the palette the import would generate, same rule
    const paletteRGBs = ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64'
      ? Array.from(this.buildUlaplusPalette(scaled), (r) => ULAPLUS.registerToRGB(r))
      : null;
    // Two-screen modes: the hi-res pair's schemes depend only on the scaled
    // image, so they are chosen once here and shared by the three methods
    const giga = ZX_SPECTRUM.SCREENS === 2;
    let hiresPick = null;
    if (giga && ACTIVE_SCREEN_MODE.paletteModel === 'timexMono') {
      const schemes = GigaQuant.chooseHiresSchemes(scaled);
      hiresPick = GigaQuant.hiresPick(schemes.inkA, schemes.inkB);
    }
    return { scaled, source, nextRGB: null, paletteRGBs, giga, hiresPick };
```

and change the indexed early return in the same method to `return { scaled, source, nextRGB, paletteRGBs: null, giga: false, hiresPick: null };`.

3d. In `_quantizePrepared`, inside the cell loop, directly after
`const { cellRGB, decideRGB } = this._cellSamples(scaled, source, cellX, cellY, cw, ch);`, insert:

```js
        // Two-screen modes: the Average blend of the cell's steady slots,
        // from the same _gigaCell the import writes with
        if (prepared.giga) {
          const { result } = this._gigaCell(prepared.hiresPick, decideRGB, cellRGB, dithering, cw, ch);
          const start = ZX_COORDS.cellToPixel(cellX, cellY);
          for (let dy = 0; dy < ch; dy++) {
            for (let dx = 0; dx < cw; dx++) {
              const rgb = result.slotRGB[result.slots[dy * cw + dx]];
              const o = ((start.y + dy) * ZX_SPECTRUM.WIDTH + (start.x + dx)) * 4;
              out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; out[o + 3] = 255;
            }
          }
          continue;
        }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tests/gigascreen-ops.test.js` - Expected: `ALL CHECKS PASSED`.
Run: `node tests/run-all.js` - Expected: `ALL TEST FILES PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/io/png-format.js tests/gigascreen-ops.test.js
git commit -m "feat: photo import in two-screen modes uses four steady colours per cell"
```

---

### Task 5: Browser spec - each two-screen mode through the real app

**Files:**
- Create: `tests/browser/giga-import.spec.js`

**Interfaces:**
- Consumes: `PNGFormat.decodeToImageData(buffer, mime)`, `PNGFormat.quantizePreviewSet(image, {scaling})`, `PNGFormat.parse(buffer, {method, dithering})` (the call the Import dialog makes once a method is picked), `selectMode(page, id)` and `boot(page)` from `tests/browser/helpers.js`.

- [ ] **Step 1: Write the spec**

```js
'use strict';
/**
 * Four-colour photo import in the two-screen modes, through the real app
 * (docs/superpowers/specs/2026-09-26-gigascreen-photo-import-design.md).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** A colourful ramp as a PNG data URL: blends are the only way to show it. */
const makeImage = (page) => page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 384;
    const ctx = c.getContext('2d');
    const d = ctx.createImageData(512, 384);
    for (let y = 0; y < 384; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            d.data[i] = (x / 512) * 255;
            d.data[i + 1] = (y / 384) * 200;
            d.data[i + 2] = 255 - (x / 512) * 200;
            d.data[i + 3] = 255;
        }
    }
    ctx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
});

const loadSource = (page, url) => page.evaluate(async (dataUrl) => {
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0));
    window.__buf = bytes.buffer;
    window.__src = await PNGFormat.decodeToImageData(bytes.buffer, 'image/png');
}, url);

for (const mode of ['gigascreen', 'multigiga_8x4', 'multigiga_8x1', 'timex_hires_giga']) {
    test(`${mode}: previews mix colours and the import writes two different screens`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        await selectMode(page, mode);
        await page.waitForTimeout(200);
        await loadSource(page, await makeImage(page));

        const r = await page.evaluate(() => {
            const set = PNGFormat.quantizePreviewSet(window.__src, { scaling: 'fit' });
            const by = (id) => set.find((s) => s.id === id).preview;
            const palette = new Set(ZX_PALETTE_RGB.map((c) => c.join()));
            const mixed = (p) => {
                for (let i = 0; i < p.data.length; i += 4) {
                    if (!palette.has(`${p.data[i]},${p.data[i + 1]},${p.data[i + 2]}`)) return true;
                }
                return false;
            };
            const same = (a, b) => a.data.every((v, i) => v === b.data[i]);
            return {
                // Review Focus 3: every method, Sharp included, yields a mixed preview
                mixed: set.every((s) => mixed(s.preview)),
                smoothDiffers: !same(by('smooth'), by('flat'))
            };
        });
        expect(r.mixed, 'every preview uses mixed colours').toBe(true);
        expect(r.smoothDiffers, 'Smooth differs from Flat').toBe(true);

        // White-on-black schemes before the import, which a colourful ramp
        // will not choose, so the undo check below is not vacuous
        const before = await page.evaluate(() => {
            ColorManager.setTimexHiresInk(7);
            ColorManager.setTimexHiresInkB(7);
            return [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()];
        });
        const w = await page.evaluate(async () => {
            const res = await PNGFormat.parse(window.__buf, { method: 'standard', dithering: 'none' });
            let differ = false;
            const layer = LayerManager.getCurrentLayer();
            for (const row of layer.attributeData) {
                for (const c of row) {
                    if (c.inkB !== c.ink || c.pixelsB.some((v, i) => v !== c.pixels[i])) differ = true;
                }
            }
            return { ok: res.success, differ,
                schemes: [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()] };
        });
        expect(w.ok).toBe(true);
        expect(w.differ, 'the two screens differ').toBe(true);

        if (mode === 'timex_hires_giga') {
            expect(w.schemes, 'the import chose its own schemes').not.toEqual(before);
            // Review Focus 4: one undo restores the picture AND both schemes
            await page.evaluate(() => UndoRedo.undo());
            expect(await page.evaluate(() =>
                [ColorManager.getTimexHiresInk(), ColorManager.getTimexHiresInkB()]),
                'undo restores both schemes').toEqual(before);
        }
    });
}
```

- [ ] **Step 2: Run the spec**

Run: `npx playwright test tests/browser/giga-import.spec.js`
Expected: 4 passed.

- [ ] **Step 3: Run the whole browser suite**

Run: `npx playwright test`
Expected: all passed (495 before this plan, 499 after it).

- [ ] **Step 4: Commit**

```bash
git add tests/browser/giga-import.spec.js
git commit -m "test: four-colour import in every two-screen mode through the real app"
```

---

### Task 6: Measure the threshold, record it, update the docs

**Files:**
- Create: `tools/giga-bench.js`
- Modify: `js/utils/giga-quant.js` (the `MAX_STEP` comment, and its value only if the measurement says so)
- Modify: `docs/FIGURES.md` (new rows)
- Modify (local-only, not tracked by git): `CLAUDE.md`, `docs/CURRENT_STATE.md`
- Modify: `js/data/manual-content.js` only if `node tools/build-manual.js --check` reports it stale

**Interfaces:**
- Consumes: `tools/palette-bench.js` exports (`readPNG`, `convertNonPNG`, `fitToScreen`, `score`, `writePNG`, `W`, `H`, `CW`, `CH`, `CELLS_X`, `CELLS_Y`, `CELLS`), `GigaQuant.chooseCell`, `renderCell`.

- [ ] **Step 1: Write the bench**

```js
'use strict';
/*
 * giga-bench.js - measures GigaQuant's steady-mix threshold on real photos.
 *
 *     node tools/giga-bench.js docs/bench-images [--write outDir]
 *
 * Compares, on each photo, what the two-screen import produced before
 * 2026-09-26 (the best two-colour cell on both screens) with the four-colour
 * converter at MAX_STEP 1 and 2, flat and dithered. Columns are
 * palette-bench's (read dSSIM first; dEblur judges dithering) plus two more:
 *
 *   flick   mean |luma(frame A) - luma(frame B)| per pixel, 0-255. What the
 *           eye sees flicker on real hardware. Zero for the two-colour
 *           baseline; the steady rule keeps it small by construction.
 *   ms      milliseconds per conversion, the cost of one preview pane.
 */
const path = require('path');
const fs = require('fs');
const bench = require('./palette-bench.js'); // installs the stubs and constants
const { loadModule } = require(path.join(__dirname, '..', 'tests/helpers/zx-stubs'));
loadModule('js/utils/giga-quant.js');

const { W, H, CW, CH, CELLS_X, CELLS_Y, CELLS } = bench;
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

function cellSamples(img, cx, cy) {
    const out = new Float32Array(CW * CH * 3);
    for (let dy = 0; dy < CH; dy++) {
        for (let dx = 0; dx < CW; dx++) {
            const i = ((cy * CH + dy) * W + (cx * CW + dx)) * 4;
            out.set([img.data[i], img.data[i + 1], img.data[i + 2]], (dy * CW + dx) * 3);
        }
    }
    return out;
}

/** Before this work: the best two-colour cell, the same on both screens. */
function twoColour(img) {
    const out = new Uint8ClampedArray(W * H * 4);
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const s = cellSamples(img, cx, cy);
        let best = null;
        for (const bright of [false, true]) {
            for (let ink = 0; ink < 8; ink++) {
                for (let paper = ink; paper < 8; paper++) {
                    const a = GigaQuant.colourRGB(ink, bright), b = GigaQuant.colourRGB(paper, bright);
                    let err = 0;
                    for (let i = 0; i < CW * CH; i++) {
                        err += Math.min(GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], a),
                                        GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], b));
                    }
                    if (!best || err < best.err) best = { a, b, err };
                }
            }
        }
        for (let i = 0; i < CW * CH; i++) {
            const c = GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], best.a)
                <= GigaQuant._dist2(s[i * 3], s[i * 3 + 1], s[i * 3 + 2], best.b) ? best.a : best.b;
            const o = ((cy * CH + Math.floor(i / CW)) * W + cx * CW + (i % CW)) * 4;
            out.set([c[0], c[1], c[2], 255], o);
        }
    }
    return { image: { width: W, height: H, data: out }, flick: 0 };
}

function fourColour(img, maxStep, dithering) {
    const out = new Uint8ClampedArray(W * H * 4);
    let flick = 0;
    for (let ci = 0; ci < CELLS; ci++) {
        const cx = ci % CELLS_X, cy = Math.floor(ci / CELLS_X);
        const s = cellSamples(img, cx, cy);
        const pick = GigaQuant.chooseCell(s, maxStep);
        const r = GigaQuant.renderCell(s, pick, dithering, CW, CH, maxStep);
        for (let i = 0; i < CW * CH; i++) {
            const slot = r.slots[i];
            const baseA = GIGA_SLOTS.bitA(slot) ? pick.a.ink : pick.a.paper;
            const baseB = GIGA_SLOTS.bitB(slot) ? pick.b.ink : pick.b.paper;
            flick += Math.abs(luma(GigaQuant.colourRGB(baseA, pick.a.bright))
                            - luma(GigaQuant.colourRGB(baseB, pick.b.bright)));
            const c = r.slotRGB[slot];
            const o = ((cy * CH + Math.floor(i / CW)) * W + cx * CW + (i % CW)) * 4;
            out.set([c[0], c[1], c[2], 255], o);
        }
    }
    return { image: { width: W, height: H, data: out }, flick: flick / (W * H) };
}

const VARIANTS = [
    { name: 'two-colour', run: (img) => twoColour(img) },
    { name: 'step1-flat', run: (img) => fourColour(img, 1, 'none') },
    { name: 'step1-fs', run: (img) => fourColour(img, 1, 'floyd-steinberg') },
    { name: 'step2-flat', run: (img) => fourColour(img, 2, 'none') },
    { name: 'step2-fs', run: (img) => fourColour(img, 2, 'floyd-steinberg') }
];

async function main() {
    const args = process.argv.slice(2);
    const writeAt = args.indexOf('--write');
    const outDir = writeAt >= 0 ? args[writeAt + 1] : null;
    const dir = args.find((a) => !a.startsWith('--') && a !== outDir);
    if (!dir || !fs.existsSync(dir)) {
        console.error('Usage: node tools/giga-bench.js docs/bench-images [--write outDir]');
        process.exit(1);
    }
    await bench.convertNonPNG(dir);
    const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
    if (outDir) fs.mkdirSync(outDir, { recursive: true });
    const totals = new Map();
    const cellClut = new Int8Array(CELLS);
    for (const f of files) {
        const img = bench.fitToScreen(bench.readPNG(path.join(dir, f)));
        console.log(`\n${f}`);
        console.log('  variant       dSSIM   used     dE  dEblur   dE95   flick      ms');
        for (const v of VARIANTS) {
            const t0 = process.hrtime.bigint();
            const res = v.run(img);
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            const colours = [];
            for (let i = 0; i < W * H; i++) colours.push(res.image.data.slice(i * 4, i * 4 + 3).join());
            const s = bench.score(img, res.image, colours, cellClut);
            const row = { ...s, flick: res.flick, ms };
            if (!totals.has(v.name)) totals.set(v.name, []);
            totals.get(v.name).push(row);
            console.log('  ' + v.name.padEnd(12) + fmt(row));
            if (outDir) bench.writePNG(path.join(outDir, `${path.basename(f, '.png')}--${v.name}.png`), res.image);
        }
    }
    console.log(`\n=== mean across ${files.length} images ===`);
    const mean = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;
    for (const [name, rows] of totals) {
        const m = {};
        for (const k of ['dssim', 'used', 'dE', 'dEblur', 'dE95', 'flick', 'ms']) m[k] = mean(rows, k);
        console.log('  ' + name.padEnd(12) + fmt(m));
    }
}

function fmt(r) {
    return r.dssim.toFixed(3).padStart(6) + '  ' + String(Math.round(r.used)).padStart(4) + '  ' +
        r.dE.toFixed(2).padStart(6) + '  ' + r.dEblur.toFixed(2).padStart(6) + '  ' +
        r.dE95.toFixed(2).padStart(6) + '  ' + r.flick.toFixed(1).padStart(6) + '  ' +
        r.ms.toFixed(0).padStart(6);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it on the real photos**

Run: `node tools/giga-bench.js docs/bench-images --write C:/Users/D0k/AppData/Local/Temp/claude/giga-bench-out`
Expected: a table per photo and a mean table with five rows. Keep the full output.

- [ ] **Step 3: Decide MAX_STEP from the numbers**

No invented cut-off decides this: flicker is judged by eye on real output, and the artist chose "watchable on hardware" as the aim. Report to the artist, for step 1 and step 2: the mean dSSIM, dEblur and flick rows, and where the renders were written so they can look at them. Recommend step 1 unless step 2 is clearly better on dSSIM and dEblur for both methods. Change `MAX_STEP` only on their answer.

Update the `MAX_STEP` comment in `js/utils/giga-quant.js` from `[A] 2026-09-26` to `[M] <date>, tools/giga-bench.js on docs/bench-images: <mean dSSIM and flick for step 1 and step 2>; was [A] 1 before measurement`.

- [ ] **Step 4: Record the figures**

Add rows to `docs/FIGURES.md` in its existing table format: the threshold (M, with the bench numbers and date), the four-colour vs two-colour mean dSSIM and dEblur (M), and the preview cost per method in ms (M, from the `ms` column). Record that the threshold was [A] = 1 before.

- [ ] **Step 5: Update local notes and the manual**

- `CLAUDE.md` GigaScreen section: add a bullet naming `GigaQuant`, the steady-mix rule, the measured `MAX_STEP`, and that the three import methods produce four colours in two-screen modes (plain two-colour import is gone there, by the artist's choice).
- `docs/CURRENT_STATE.md`: Node suites 93 -> 94 (`giga-quant.test.js`); browser spec files 83 -> 84 and specs 495 -> 499 (measure with `ls tests/*.test.js | wc -l` and `npx playwright test --list | tail -1`).
- Run `node tools/build-manual.js --check`; if stale, run `node tools/build-manual.js`.

- [ ] **Step 6: Final gate**

Run: `node tests/run-all.js` - Expected: `ALL TEST FILES PASSED`.
Run: `npx playwright test` - Expected: all passed.

- [ ] **Step 7: Commit (locally; do not push)**

```bash
git add tools/giga-bench.js js/utils/giga-quant.js docs/FIGURES.md js/data/manual-content.js
git commit -m "chore: measure the steady-mix threshold for four-colour import"
```
