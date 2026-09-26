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
