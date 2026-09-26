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
