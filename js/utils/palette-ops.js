'use strict';
(function() {

/**
 * PaletteOps — pure palette-generation math (no DOM, Node-testable).
 *
 * The single home for "build a custom palette from source pixels":
 *   - buildUlaplusRegisters(imageData): the Image2ULAplus-style pipeline
 *     (k-means CLUT clustering + per-half median cut) that PNG import has
 *     used since Phase 12a — moved here so mode CONVERSION can build the
 *     same source-faithful palette (PNGFormat delegates).
 *   - chooseUlaplusCellPair(cellRGB, paletteRGBs): the per-cell CLUT +
 *     ink/paper slot picker that pairs with it.
 *   - buildNextRegisters(imageData, n): median-cut an image to the active
 *     rgb333 palette window (16 or 256 colours), snapped to the 9-bit
 *     grid; the rest of the register file keeps the documented defaults
 *     (classics at 0–15/128–143, identity ramp elsewhere).
 *   - rampRGB(from, to, steps): the shading tool. Nothing to do with an
 *     image — it fills a run of registers with an even interpolation
 *     between the two colours already at its ends.
 *
 * The image builders take {width, height, data} RGBA (ImageData-shaped).
 */
class PaletteOpsClass {

  /**
   * An even RGB interpolation from `from` to `to`, inclusive of both.
   *
   * The shading tool. On a two-colour cell you fake a grey by dithering, but a
   * palette mode can hold the greys themselves — and a hand-picked run of eight
   * shades is never as even as the eye wants, because it is the EVENNESS the
   * eye reads as a surface curving away rather than as eight separate colours.
   *
   * Interpolated in plain RGB rather than a perceptual space. That is the right
   * call HERE and only here: the result is immediately snapped to the mode's
   * register grid (8 levels a channel on both ULAplus and RGB333), which is
   * coarse enough that the difference between an sRGB and a Lab ramp is
   * routinely smaller than one step. A finer palette would deserve better.
   *
   * @param {number[]} from - [r,g,b] 0-255
   * @param {number[]} to   - [r,g,b] 0-255
   * @param {number} steps  - how many colours to produce, including both ends
   * @returns {Array<number[]>} `steps` [r,g,b] triples
   */
  rampRGB(from, to, steps) {
    const n = Math.max(1, Math.floor(steps));
    if (n === 1) return [[...from]];

    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out.push([
        Math.round(from[0] + (to[0] - from[0]) * t),
        Math.round(from[1] + (to[1] - from[1]) * t),
        Math.round(from[2] + (to[2] - from[2]) * t)
      ]);
    }
    return out;
  }

  /** Squared RGB distance. @private */
  _dist2(r, g, b, rgb) {
    const dr = r - rgb[0], dg = g - rgb[1], db = b - rgb[2];
    return dr * dr + dg * dg + db * db;
  }

  /**
   * Median-cut a pixel list to at most `count` representative colours.
   * @param {Array<number[]>} pixels - [r,g,b] triplets
   * @param {number} count - Target colour count (power of two works best)
   * @returns {Array<number[]>} Representative [r,g,b] colours (≥ 1)
   */
  medianCut(pixels, count) {
    let boxes = [pixels];
    while (boxes.length < count) {
      // Split the box with the largest channel range
      let bestBox = -1, bestRange = -1, bestChannel = 0;
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.length < 2) continue;
        for (let ch = 0; ch < 3; ch++) {
          let lo = 255, hi = 0;
          for (const p of box) {
            if (p[ch] < lo) lo = p[ch];
            if (p[ch] > hi) hi = p[ch];
          }
          if (hi - lo > bestRange) { bestRange = hi - lo; bestBox = i; bestChannel = ch; }
        }
      }
      if (bestBox < 0 || bestRange <= 0) break; // nothing left to split

      const box = boxes[bestBox];
      box.sort((a, b) => a[bestChannel] - b[bestChannel]);
      const mid = box.length >> 1;
      boxes.splice(bestBox, 1, box.slice(0, mid), box.slice(mid));
    }

    return boxes.map((box) => {
      let r = 0, g = 0, b = 0;
      for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
      return [r / box.length, g / box.length, b / box.length];
    });
  }

  /**
   * Build a 64-register ULAplus palette from an image (Image2ULAplus-style;
   * ZX-PB ships Image2ULAplus as a separate tool, so this is OUR pipeline,
   * documented and chosen for per-cell fidelity):
   *
   *   1. Cluster the image's cells into 4 groups by mean cell colour
   *      (k-means, luminance-quartile seeds) — each group becomes one CLUT,
   *      so cells with similar colouring share registers.
   *   2. Per CLUT: split the member pixels at the median luminance; the
   *      darker half is median-cut to 8 colours -> the CLUT's INK half, the
   *      lighter half to 8 -> its PAPER half. The per-cell mask can invert
   *      freely, so the split costs no pairings.
   *   3. Every colour snaps to the G3R3B2 register grid.
   *
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @returns {Uint8Array} 64 register bytes
   */
  buildUlaplusRegisters(imageData) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const cw = SCREEN_MODES.ULA_PLUS.attrCellW;
    const chh = SCREEN_MODES.ULA_PLUS.attrCellH;
    const cellsX = Math.floor(w / cw), cellsY = Math.floor(h / chh);

    // Mean colour per cell
    const cellMeans = [];
    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < chh; dy++) {
          for (let dx = 0; dx < cw; dx++) {
            const i = ((cy * chh + dy) * w + (cx * cw + dx)) * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2];
          }
        }
        const n = cw * chh;
        cellMeans.push([r / n, g / n, b / n]);
      }
    }

    // K-means (k=4) over cell means, seeded at luminance quartiles
    const lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    const byLum = cellMeans.map((c, i) => ({ c, i })).sort((a, b) => lum(a.c) - lum(b.c));
    const centroids = [0.125, 0.375, 0.625, 0.875].map(
      (q) => byLum[Math.floor(q * (byLum.length - 1))].c.slice()
    );
    const assign = new Array(cellMeans.length).fill(0);
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < cellMeans.length; i++) {
        let bi = 0, bd = Infinity;
        for (let k = 0; k < 4; k++) {
          const d = this._dist2(cellMeans[i][0], cellMeans[i][1], cellMeans[i][2], centroids[k]);
          if (d < bd) { bd = d; bi = k; }
        }
        assign[i] = bi;
      }
      for (let k = 0; k < 4; k++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < cellMeans.length; i++) {
          if (assign[i] !== k) continue;
          r += cellMeans[i][0]; g += cellMeans[i][1]; b += cellMeans[i][2]; n++;
        }
        if (n) centroids[k] = [r / n, g / n, b / n];
      }
    }

    // Per CLUT: gather member pixels, split by luminance, median-cut halves
    const defaults = ULAPLUS.defaultRegisters();
    const regs = new Uint8Array(64);
    for (let k = 0; k < 4; k++) {
      const pixels = [];
      for (let ci = 0; ci < cellMeans.length; ci++) {
        if (assign[ci] !== k) continue;
        const cx = ci % cellsX, cy = Math.floor(ci / cellsX);
        for (let dy = 0; dy < chh; dy++) {
          for (let dx = 0; dx < cw; dx++) {
            const i = ((cy * chh + dy) * w + (cx * cw + dx)) * 4;
            pixels.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
      }

      if (pixels.length === 0) {
        // Empty cluster — keep the default CLUT so the registers stay sane
        regs.set(defaults.subarray(k * 16, k * 16 + 16), k * 16);
        continue;
      }

      pixels.sort((a, b) => lum(a) - lum(b));
      const mid = Math.floor(pixels.length / 2);
      const dark = pixels.slice(0, Math.max(1, mid));
      const light = pixels.slice(Math.min(mid, pixels.length - 1));

      const inkHalf = this.medianCut(dark, 8);
      const paperHalf = this.medianCut(light, 8);
      for (let c = 0; c < 8; c++) {
        regs[k * 16 + c] = ULAPLUS.rgbToRegister(...inkHalf[Math.min(c, inkHalf.length - 1)]);
        regs[k * 16 + 8 + c] = ULAPLUS.rgbToRegister(...paperHalf[Math.min(c, paperHalf.length - 1)]);
      }
    }

    return regs;
  }

  /**
   * ULAplus cell pair: for each of the 4 CLUTs, find the most-used colour
   * of its ink half and of its paper half independently, score the pair's
   * total error over the cell, keep the cheapest CLUT (ties -> lower CLUT).
   * The mask decides per pixel anyway, so a "dark paper / light ink" cell
   * simply renders with the bits inverted — no fidelity is lost.
   * @param {Float32Array|number[]} cellRGB - Flat [r,g,b, r,g,b, …] cell pixels
   * @param {Array<number[]>} paletteRGBs - 64 [r,g,b] entries
   * @returns {{clut:number, inkSlot:number, paperSlot:number,
   *            inkRGB:number[], paperRGB:number[]}}
   */
  chooseUlaplusCellPair(cellRGB, paletteRGBs) {
    const pixelCount = cellRGB.length / 3;
    let best = null;

    for (let clut = 0; clut < 4; clut++) {
      const inkHalf = paletteRGBs.slice(clut * 16, clut * 16 + 8);
      const paperHalf = paletteRGBs.slice(clut * 16 + 8, clut * 16 + 16);

      const inkCounts = new Array(8).fill(0);
      const paperCounts = new Array(8).fill(0);
      for (let i = 0; i < pixelCount; i++) {
        const r = cellRGB[i * 3], g = cellRGB[i * 3 + 1], b = cellRGB[i * 3 + 2];
        let ni = 0, nd = Infinity;
        for (let c = 0; c < 8; c++) {
          const d = this._dist2(r, g, b, inkHalf[c]);
          if (d < nd) { nd = d; ni = c; }
        }
        inkCounts[ni]++;
        let np = 0; nd = Infinity;
        for (let c = 0; c < 8; c++) {
          const d = this._dist2(r, g, b, paperHalf[c]);
          if (d < nd) { nd = d; np = c; }
        }
        paperCounts[np]++;
      }

      const argmax = (arr) => arr.reduce((m, v, i) => (v > arr[m] ? i : m), 0);
      const inkSlot = argmax(inkCounts);
      const paperSlot = argmax(paperCounts);

      let err = 0;
      for (let i = 0; i < pixelCount; i++) {
        const r = cellRGB[i * 3], g = cellRGB[i * 3 + 1], b = cellRGB[i * 3 + 2];
        err += Math.min(
          this._dist2(r, g, b, inkHalf[inkSlot]),
          this._dist2(r, g, b, paperHalf[paperSlot])
        );
      }

      if (!best || err < best.err) {
        best = {
          clut, inkSlot, paperSlot,
          inkRGB: inkHalf[inkSlot], paperRGB: paperHalf[paperSlot], err
        };
      }
    }

    return best;
  }

  /**
   * Build a 256-register Next RGB333 file whose first `n` entries (the
   * active mode's drawable palette window) are median-cut from the image —
   * "a palette as close to the source as possible". Registers outside the
   * window keep the documented defaults, so the classic slots at 128–143
   * (ULANext paper half) survive for 16-entry windows.
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @param {number} n - Palette window size (16 for 4bpp modes, 256 for 8bpp)
   * @returns {Uint16Array} 256 9-bit registers
   */
  buildNextRegisters(imageData, n) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;

    // Subsample large screens: median-cut sorts boxes repeatedly, and
    // ~25k samples describe the colour distribution as well as 164k do.
    const total = w * h;
    const stride = Math.max(1, Math.floor(total / 25000));
    const pixels = [];
    for (let i = 0; i < total; i += stride) {
      const o = i * 4;
      pixels.push([data[o], data[o + 1], data[o + 2]]);
    }

    const regs = NEXTRGB333.defaultRegisters();
    if (!pixels.length) return regs;

    const colours = this.medianCut(pixels, n);
    // Snap to the 9-bit grid and dedupe (median cut can converge boxes);
    // duplicates waste window slots, so fill remaining slots from defaults.
    const seen = new Set();
    let slot = 0;
    for (const c of colours) {
      const reg = NEXTRGB333.rgbToRegister(c[0], c[1], c[2]);
      if (seen.has(reg)) continue;
      seen.add(reg);
      regs[slot++] = reg;
      if (slot >= n) break;
    }
    // Left-over slots (dedupe shrank the set) keep their default entries.
    return regs;
  }
}

window.PaletteOps = new PaletteOpsClass();

Logger.debug('PaletteOps', 'Palette operations loaded');

})(); // End IIFE
