'use strict';
(function() {

/**
 * Transform Service
 *
 * Provides transformation operations for pixels and selections.
 * All operations work on the current selection or entire canvas.
 */

// Dot movement per shift direction, as [dx, dy] steps.
const SHIFT_VECTORS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  upLeft: [-1, -1], upRight: [1, -1], downLeft: [-1, 1], downRight: [1, 1]
};

class TransformServiceClass {
  constructor() {
    this.tempBuffer = null;
    // Source ink masks of the buffers _rotateAttrBuffer has turned - see there.
    // Weak, so a snapshot the rotate slider lets go of takes its mask with it.
    this._rotateSourceMasks = new WeakMap();
  }

  /**
   * Get the working area (selection or entire canvas)
   * @returns {Object} { x, y, width, height }
   * @private
   */
  _getWorkArea() {
    if (SelectionService.hasSelection()) {
      return SelectionService.getSelection();
    }
    return {
      x: 0,
      y: 0,
      width: ZX_SPECTRUM.WIDTH,
      height: ZX_SPECTRUM.HEIGHT
    };
  }

  /**
   * Copy pixel states from an area to a buffer (bool only, no colour)
   * @param {Object} area - { x, y, width, height }
   * @returns {boolean[][]}
   * @private
   */
  _copyToBuffer(area) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return null;

    const buffer = [];
    for (let py = 0; py < area.height; py++) {
      const row = [];
      for (let px = 0; px < area.width; px++) {
        const pixelX = area.x + px;
        const pixelY = area.y + py;
        row.push(Validators.isValidPixelCoord(pixelX, pixelY)
          ? layer.getPixelState(pixelX, pixelY) : false);
      }
      buffer.push(row);
    }
    return buffer;
  }

  /**
   * GigaScreen: the blend (GIGA_SLOTS) each pixel of an area shows - the
   * two-screen counterpart of _copyToBuffer, for the transforms that compute
   * pixels rather than move them (invert, outline). Paper on both screens
   * outside the canvas.
   * @param {Object} area - { x, y, width, height }
   * @returns {number[][]|null}
   * @private
   */
  _copySlots(area) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return null;
    const slots = [];
    for (let py = 0; py < area.height; py++) {
      const row = [];
      for (let px = 0; px < area.width; px++) {
        const pixelX = area.x + px;
        const pixelY = area.y + py;
        row.push(Validators.isValidPixelCoord(pixelX, pixelY)
          ? layer.getPixelSlot(pixelX, pixelY) : GIGA_SLOTS.PAPER_PAPER);
      }
      slots.push(row);
    }
    return slots;
  }

  /**
   * Copy pixel states AND cell attributes from an area to an attributed buffer.
   * Each entry: { isInk, ink, paper, bright, flash }
   * @param {Object} area - { x, y, width, height }
   * @returns {Array[][]}
   * @private
   */
  _copyToBufferWithAttrs(area) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return null;

    // Indexed modes (Phase 13): the "attributed" buffer is the per-pixel
    // palette index — entries { idx } (−1 = transparent/out of range).
    const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;

    const buffer = [];
    for (let py = 0; py < area.height; py++) {
      const row = [];
      for (let px = 0; px < area.width; px++) {
        const pixelX = area.x + px;
        const pixelY = area.y + py;
        if (Validators.isValidPixelCoord(pixelX, pixelY)) {
          if (indexed) {
            row.push({ idx: layer.getPixelIndex(pixelX, pixelY) });
            continue;
          }
          const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
          const cell  = layer.getCell(cellPos.x, cellPos.y);
          const entry = {
            isInk:  layer.getPixelState(pixelX, pixelY),
            ink:    cell ? cell.ink   : 0,
            paper:  cell ? cell.paper : 7,
            bright: cell ? cell.bright : false,
            flash:  cell ? cell.flash  : false
          };
          // GigaScreen: which of the four blends the pixel shows, and screen
          // B's colours, so a transform moves the picture on both screens.
          if (cell && cell.pixelsB) {
            entry.slot = layer.getPixelSlot(pixelX, pixelY);
            entry.inkB = cell.inkB;
            entry.paperB = cell.paperB;
            entry.brightB = cell.brightB;
            entry.flashB = cell.flashB;
          }
          row.push(entry);
        } else {
          row.push(indexed
            ? { idx: -1 }
            : { isInk: false, ink: 0, paper: 7, bright: false, flash: false });
        }
      }
      buffer.push(row);
    }
    return buffer;
  }

  /**
   * Apply buffer to an area, using original colour attributes per pixel.
   * For each destination cell the colour is determined by the first ink pixel
   * that maps into it (falling back to the first paper pixel's colour).
   * @param {Array[][]} buffer - attributed buffer from _copyToBufferWithAttrs
   * @param {Object} area - { x, y, width, height }
   * @private
   */
  _applyBufferWithAttrs(buffer, area) {
    const layer   = LayerManager.getCurrentLayer();
    const fallback = ColorManager.getCurrentSelection();

    // Indexed modes (Phase 13): write the buffered palette indices back;
    // −1 erases (transparent on upper layers, paper on the background).
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      PixelDrawRoutine.suspendMirror(() => {
        for (let py = 0; py < buffer.length; py++) {
          for (let px = 0; px < buffer[py].length; px++) {
            const pixelX = area.x + px, pixelY = area.y + py;
            if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
            const p = buffer[py][px];
            if (p.idx != null && p.idx >= 0) {
              PixelDrawRoutine.draw(pixelX, pixelY,
                { ...fallback, index: p.idx }, DRAW_MODE.NORMAL);
            } else {
              PixelDrawRoutine.draw(pixelX, pixelY, fallback, DRAW_MODE.ERASE);
            }
          }
        }
      });
      return;
    }

    // Snapshot destination-cell paper BEFORE any writes so in-place transforms
    // (rotate, flip, scale, shift) inherit the paper already on the canvas rather
    // than importing the source pixel's paper into the wrong destination cell.
    const destPaper = new Map();
    const giga = ZX_SPECTRUM.SCREENS === 2;
    const destPaperB = new Map();
    for (let py = 0; py < buffer.length; py++) {
      for (let px = 0; px < buffer[py].length; px++) {
        const pixelX = area.x + px, pixelY = area.y + py;
        if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
        const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
        const key = `${cellPos.x},${cellPos.y}`;
        if (!destPaper.has(key)) {
          // The paper the destination cell SHOWS (its own when it has one,
          // else what the page shows there) - never the placeholder white an
          // empty upper-layer cell stores.
          destPaper.set(key, layer
            ? LayerManager.attrsAsSeen(layer, cellPos.x, cellPos.y).paper
            : fallback.paper);
          if (giga) {
            destPaperB.set(key, layer
              ? LayerManager.attrsAsSeen(layer, cellPos.x, cellPos.y, 1).paper
              : fallback.paper);
          }
        }
      }
    }

    // Build per-destination-cell ink colour from the transformed buffer (first-ink-wins)
    const cellColors = new Map();
    for (let py = 0; py < buffer.length; py++) {
      for (let px = 0; px < buffer[py].length; px++) {
        const pixelX = area.x + px, pixelY = area.y + py;
        if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
        const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
        const key = `${cellPos.x},${cellPos.y}`;
        const p = buffer[py][px];
        const colours = { ink: p.ink, bright: p.bright, flash: p.flash, hasInk: p.isInk,
          inkB: p.inkB, brightB: p.brightB, flashB: p.flashB };
        if (!cellColors.has(key)) {
          cellColors.set(key, colours);
        } else if (p.isInk && !cellColors.get(key).hasInk) {
          cellColors.set(key, colours);
        }
      }
    }

    // Transforms write exactly the computed buffer — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < buffer.length; py++) {
        for (let px = 0; px < buffer[py].length; px++) {
          const pixelX = area.x + px, pixelY = area.y + py;
          if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
          const p   = buffer[py][px];
          const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
          const key = `${cellPos.x},${cellPos.y}`;
          const c   = cellColors.get(key) || fallback;
          const colorSel = { ink: c.ink, paper: destPaper.get(key) ?? fallback.paper, bright: c.bright, flash: c.flash };
          if (giga) {
            colorSel.inkB = c.inkB != null ? c.inkB : c.ink;
            colorSel.paperB = destPaperB.get(key) ?? colorSel.paper;
            colorSel.brightB = c.brightB != null ? c.brightB : c.bright;
            colorSel.flashB = c.flashB != null ? c.flashB : c.flash;
            colorSel.gigaSlot = p.slot != null ? p.slot : GIGA_SLOTS.INK_INK;
          }
          PixelDrawRoutine.draw(pixelX, pixelY, colorSel, p.isInk ? DRAW_MODE.NORMAL : DRAW_MODE.ERASE);
        }
      }
    });
  }

  /**
   * Apply buffer to an area (bool only — colour comes from current selection)
   * @param {Array[]} buffer - 2D array of pixel states; in GigaScreen, the
   *   blend (GIGA_SLOTS) each pixel takes, 0 being paper on both screens
   * @param {Object} area - { x, y, width, height }
   * @private
   */
  _applyBuffer(buffer, area) {
    const color   = ColorManager.getCurrentSelection();
    const layer   = LayerManager.getCurrentLayer();
    const giga    = ZX_SPECTRUM.SCREENS === 2;

    // Snapshot destination-cell paper before writing (same reason as
    // _applyBufferWithAttrs) - screen B's too, so neither screen reads a
    // value this loop has already written.
    const destPaper = new Map();
    const destPaperB = new Map();
    for (let py = 0; py < buffer.length; py++) {
      for (let px = 0; px < buffer[py].length; px++) {
        const pixelX = area.x + px, pixelY = area.y + py;
        if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
        const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
        const key = `${cellPos.x},${cellPos.y}`;
        if (!destPaper.has(key)) {
          destPaper.set(key, layer
            ? LayerManager.attrsAsSeen(layer, cellPos.x, cellPos.y).paper
            : color.paper);
          if (giga) {
            destPaperB.set(key, layer
              ? LayerManager.attrsAsSeen(layer, cellPos.x, cellPos.y, 1).paper
              : (color.paperB ?? color.paper));
          }
        }
      }
    }

    // Transforms write exactly the computed buffer — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < buffer.length; py++) {
        for (let px = 0; px < buffer[py].length; px++) {
          const pixelX = area.x + px;
          const pixelY = area.y + py;
          if (Validators.isValidPixelCoord(pixelX, pixelY)) {
            const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
            const key   = `${cellPos.x},${cellPos.y}`;
            const value = buffer[py][px];
            const on    = giga ? value !== GIGA_SLOTS.PAPER_PAPER : !!value;
            const mode  = on ? DRAW_MODE.NORMAL : DRAW_MODE.ERASE;
            const sel = { ...color, paper: destPaper.get(key) ?? color.paper };
            // GigaScreen: the buffer says which blend, and screen B keeps
            // the paper it shows too
            if (giga) {
              sel.paperB = destPaperB.get(key) ?? sel.paper;
              if (on) sel.gigaSlot = value;
            }
            PixelDrawRoutine.draw(pixelX, pixelY, sel, mode);
          }
        }
      }
    });
  }

  /**
   * Flip horizontally (mirror left-right)
   */
  flipHorizontal() {
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;

    const flipped = buffer.map(row => row.slice().reverse());

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(flipped, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', 'Flip horizontal applied');
  }

  /**
   * Flip vertically (mirror top-bottom)
   */
  flipVertical() {
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;

    const flipped = buffer.slice().reverse();

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(flipped, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', 'Flip vertical applied');
  }

  /**
   * Mirror the dots left-right; each cell keeps its colours (the Image >
   * Dots > Flip Horizontal command). Indexed and Timex modes have no cell
   * colours and flip as Flip Horizontal does.
   */
  flipDotsHorizontal() {
    this._flipDots('h');
  }

  /** Mirror the dots top-bottom; colours stay in their cells. */
  flipDotsVertical() {
    this._flipDots('v');
  }

  /** @private */
  _flipDots(axis) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer || layer.locked) return;
    if (!ColorManager.hasCellAttributes()) {
      if (axis === 'h') this.flipHorizontal(); else this.flipVertical();
      return;
    }
    const area = this._getWorkArea();
    const before = this._dotGrid(area);
    if (!before) return;
    const after = axis === 'h'
      ? before.map(row => row.slice().reverse())
      : before.slice().reverse();

    PixelDrawRoutine.beginBatch();
    this._writeDots(area, before, after);
    PixelDrawRoutine.endBatch();
  }

  /**
   * Why each Image > Dots command is unavailable right now, or null.
   * `flip` is a stamp with its own cell colours or a locked/absent layer;
   * `invert` is every reason the attribute commands are blocked, plus a
   * floating stamp (its dots live on the stamp, not the picture).
   * @returns {{flip: (string|null), invert: (string|null)}}
   */
  dotCommandsBlocked() {
    const layer = LayerManager.getCurrentLayer();
    const fp = this._floatingPaste();
    let flip = null;
    if (!layer || layer.locked) flip = 'locked';
    else if (fp) flip = fp.attrs ? 'stampAttrs' : null;
    else if (layer.isStamp) flip = 'stamp';
    let invert = this.attributeCommandsBlocked();
    if (!invert && fp) invert = 'stamp';
    return { flip, invert };
  }

  /**
   * Mirror the dots of the picture, or of a floating stamp. A stamp is flipped
   * by SelectionService.transformStamp so the stamp is never written through
   * the picture's cells (the Image menu's own Flip does that; see the batch
   * 2 log). Blocked cases are reported by dotCommandsBlocked and do nothing.
   * @param {'h'|'v'} axis
   */
  dotsFlip(axis) {
    if (this.dotCommandsBlocked().flip) return;
    const fp = this._floatingPaste();
    if (fp) {
      SelectionService.transformStamp(axis === 'h' ? 'flipH' : 'flipV');
      return;
    }
    this._flipDots(axis);
  }

  /** The floating stamp, or null. @private */
  _floatingPaste() {
    if (!window.SelectionService || !SelectionService.isFloating()) return null;
    return SelectionService.floatingPaste || null;
  }

  /**
   * Invert the dots and swap ink and paper of each whole cell the work area
   * touches, so the picture looks the same. Cells that are see-through on an
   * upper layer are left alone: inverting them would fill them. Blocked on a
   * stamp, a locked layer and modes without cell colours.
   * @returns {number} cells changed
   */
  invertDotsAndColours() {
    if (this.dotCommandsBlocked().invert) return 0;
    const layer = LayerManager.getCurrentLayer();
    const rect = this._attributeCellRect(this._getWorkArea());
    const pixels = {
      x: rect.x0 * ZX_SPECTRUM.CELL_WIDTH,
      y: rect.y0 * ZX_SPECTRUM.CELL_HEIGHT,
      width: (rect.x1 - rect.x0 + 1) * ZX_SPECTRUM.CELL_WIDTH,
      height: (rect.y1 - rect.y0 + 1) * ZX_SPECTRUM.CELL_HEIGHT
    };
    const skip = (cx, cy) => !layer.isBackground && !layer.isCellAltered(cx, cy);
    const before = this._dotGrid(pixels);
    if (!before) return 0;
    const giga = ZX_SPECTRUM.SCREENS === 2;
    const after = before.map((row, py) => row.map((v, px) => {
      const cx = Math.floor(px / ZX_SPECTRUM.CELL_WIDTH) + rect.x0;
      const cy = Math.floor(py / ZX_SPECTRUM.CELL_HEIGHT) + rect.y0;
      if (skip(cx, cy)) return v;
      return giga ? GIGA_SLOTS.INK_INK - v : !v;
    }));

    let cells = 0;
    PixelDrawRoutine.beginBatch();
    PixelDrawRoutine.suspendClip(() => {
      const writes = this._planCellWrites(rect, (cx, cy, grid) => {
        const c = grid[cy - rect.y0][cx - rect.x0];
        return skip(cx, cy) ? { ...c } : this._swapInkPaper(c);
      });
      this._applyCellWrites(writes);
      cells = writes.length;
      this._writeDots(pixels, before, after);
    });
    PixelDrawRoutine.endBatch();
    Logger.debug('TransformService', `Invert dots and colours: ${cells} cells`);
    return cells;
  }

  /** Is this buffer entry a marked pixel? Indexed entries carry `idx`. */
  _entryIsInk(p) { return p.idx !== undefined ? p.idx >= 0 : !!p.isInk; }

  /** The empty counterpart of a buffer entry, keeping its cell colours. */
  _blankEntry(p) {
    return p.idx !== undefined
      ? { idx: -1 }
      : { isInk: false, ink: p.ink, paper: p.paper, bright: p.bright, flash: p.flash };
  }

  /**
   * Bounding box of the marked pixels in an attributed buffer, or null if it
   * holds none.
   * @private
   */
  _inkBounds(buf) {
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let y = 0; y < buf.length; y++) {
      for (let x = 0; x < buf[y].length; x++) {
        if (!this._entryIsInk(buf[y][x])) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY };
  }

  /**
   * Shrink an attributed buffer, PREFERRING INK.
   *
   * Each output pixel covers a rectangle of source pixels and takes the first
   * marked one in it, falling back to the top-left. Point-sampling instead
   * (the plain nearest-neighbour `scale()` uses) drops any mark that happens
   * to fall between the sampled rows: shrinking by 0.87 discards 13% of the
   * source rows outright, so a one-pixel mark simply vanishes - which is the
   * loss this whole path exists to prevent, reappearing one tier down.
   *
   * This is the same rule the screen-mode converter uses when it halves a
   * grid (SET pixels win the merge), so a shrink here reads the way a mode
   * change does. Marks can still MERGE when two land in one output pixel;
   * that is inherent to shrinking, and unlike dropping them it is visible.
   * @private
   */
  _shrinkPreferInk(buf, newW, newH) {
    const h = buf.length, w = buf[0].length;
    const out = [];
    for (let y = 0; y < newH; y++) {
      const row = [];
      const y0 = Math.floor(y * h / newH);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / newH));
      for (let x = 0; x < newW; x++) {
        const x0 = Math.floor(x * w / newW);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / newW));
        let pick = buf[y0][x0];
        outer:
        for (let sy = y0; sy < y1 && sy < h; sy++) {
          for (let sx = x0; sx < x1 && sx < w; sx++) {
            if (this._entryIsInk(buf[sy][sx])) { pick = buf[sy][sx]; break outer; }
          }
        }
        row.push(pick);
      }
      out.push(row);
    }
    return out;
  }

  /**
   * Place a rotated buffer back into the work area WITHOUT destroying marks.
   *
   * A 90-degree turn of a non-square area does not fit the box it came from -
   * on the whole 256x192 canvas the result is 192x256 - and the old code
   * simply centred it and let whatever fell outside be written out of bounds
   * and lost. On the full canvas that silently destroyed source columns 0-31
   * and 224-255 while padding 64 columns of blank paper, so turning a picture
   * twice did not give it back. Clipping is the one outcome a transform must
   * not have: it is not recoverable by another transform, and nothing on
   * screen says it happened.
   *
   * Three tiers, cheapest and most faithful first, so the lossy one runs only
   * where the alternative is losing the marks outright:
   *
   *   1. CENTRE, as before. The common case - a motif inside a selection, or
   *      any square area - lands here and is bit-for-bit what it always was.
   *   2. SHIFT, when centring would clip but the marked region itself fits.
   *      Off-centre but lossless, and lossless beats centred.
   *   3. SHRINK, only when the marked region is genuinely wider or taller than
   *      the box, by the LEAST factor that makes it fit, ink-preferring so no
   *      mark is dropped (`_shrinkPreferInk`). Marks can merge, which shrinking
   *      always can; none disappears, which is what the old behaviour could not
   *      say. Undo covers it.
   *
   * @param {Array[][]} rotated - the turned buffer
   * @param {Array[][]} src - the original buffer, read for its cell colours
   * @param {Object} area - { x, y, width, height }
   * @returns {Array[][]} a buffer the size of `area`
   * @private
   */
  _placeRotated(rotated, src, area) {
    let buf = rotated;
    let box = this._inkBounds(buf);

    // Tier 3: shrink only if a shift could not save the marks either.
    if (box) {
      const inkW = box.maxX - box.minX + 1;
      const inkH = box.maxY - box.minY + 1;
      const f = Math.min(1, area.width / inkW, area.height / inkH);
      if (f < 1) {
        buf = this._shrinkPreferInk(buf,
          Math.max(1, Math.round(buf[0].length * f)),
          Math.max(1, Math.round(buf.length * f)));
        box = this._inkBounds(buf);
      }
    }

    const output = src.map(row => row.map(p => this._blankEntry(p)));
    const bw = buf[0].length, bh = buf.length;
    let offX = Math.floor((area.width  - bw) / 2);
    let offY = Math.floor((area.height - bh) / 2);

    // Tiers 1 and 2 are one step: clamp the centred offset into the range that
    // keeps the marked region inside. Already inside -> the clamp is a no-op
    // and the placement is the centred one. The `lo <= hi` guard is the case
    // the shrink above could not quite close through rounding; centring is the
    // honest fallback there.
    if (box) {
      const loX = -box.minX, hiX = area.width  - 1 - box.maxX;
      const loY = -box.minY, hiY = area.height - 1 - box.maxY;
      if (loX <= hiX) offX = Helpers.clamp(offX, loX, hiX);
      if (loY <= hiY) offY = Helpers.clamp(offY, loY, hiY);
    }

    for (let ry = 0; ry < bh; ry++) {
      for (let rx = 0; rx < buf[ry].length; rx++) {
        const dx = offX + rx, dy = offY + ry;
        if (dx >= 0 && dx < area.width && dy >= 0 && dy < area.height) output[dy][dx] = buf[ry][rx];
      }
    }
    return output;
  }

  /**
   * Rotate 90 degrees clockwise.
   * A non-square area does not fit the box it came from; `_placeRotated`
   * shifts or, as a last resort, shrinks rather than clipping.
   */
  rotate90CW() {
    const area = this._getWorkArea();
    const src = this._copyToBufferWithAttrs(area);
    if (!src) return;

    const h = src.length, w = src[0].length;

    // Build rotated attributed buffer (w×h -> h×w)
    const rotated = [];
    for (let x = 0; x < w; x++) {
      const row = [];
      for (let y = h - 1; y >= 0; y--) row.push(src[y][x]);
      rotated.push(row);
    }

    const output = this._placeRotated(rotated, src, area);

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(output, area);
    PixelDrawRoutine.endBatch();

    EventBus.emit(EVENTS.TRANSFORM_FIXED_ROTATE, { degrees: 90 });
    Logger.debug('TransformService', 'Rotate 90 CW applied');
  }

  /**
   * Rotate 90 degrees counter-clockwise
   */
  rotate90CCW() {
    const area = this._getWorkArea();
    const src = this._copyToBufferWithAttrs(area);
    if (!src) return;

    const h = src.length, w = src[0].length;

    // Build CCW rotated attributed buffer
    const rotated = [];
    for (let x = w - 1; x >= 0; x--) {
      const row = [];
      for (let y = 0; y < h; y++) row.push(src[y][x]);
      rotated.push(row);
    }

    const output = this._placeRotated(rotated, src, area);

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(output, area);
    PixelDrawRoutine.endBatch();

    EventBus.emit(EVENTS.TRANSFORM_FIXED_ROTATE, { degrees: -90 });
    Logger.debug('TransformService', 'Rotate 90 CCW applied');
  }

  /**
   * Rotate 180 degrees
   */
  rotate180() {
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;

    const rotated = buffer.slice().reverse().map(row => row.slice().reverse());

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(rotated, area);
    PixelDrawRoutine.endBatch();

    EventBus.emit(EVENTS.TRANSFORM_FIXED_ROTATE, { degrees: 180 });
    Logger.debug('TransformService', 'Rotate 180 applied');
  }

  /**
   * Rotate by an arbitrary angle using nearest-neighbor sampling on an offscreen canvas.
   * Pixels outside the rotated area are cleared; original cell colours are preserved
   * for pixels that remain within the area.
   * @param {number} degrees - Rotation angle (clockwise positive)
   */
  rotateArbitrary(degrees) {
    if (!degrees) return;
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;
    const output = this._rotateAttrBuffer(buffer, degrees);
    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(output, area);
    PixelDrawRoutine.endBatch();
    Logger.debug('TransformService', `Rotate ${degrees}° applied`);
  }

  /**
   * Rotate a pre-captured snapshot buffer by `degrees` and apply to `area`.
   * Does NOT open an undo action — the caller wraps the whole drag in one
   * beginAction/endAction so live-preview ticks share a single undo entry.
   * Intended for slider-style live rotation where rotating-from-current would
   * accumulate quality loss between ticks.
   * @param {Array[][]} srcBuffer - Attributed snapshot from _copyToBufferWithAttrs
   * @param {Object} area - { x, y, width, height } that srcBuffer was captured from
   * @param {number} degrees - Rotation angle relative to the snapshot (0 = no change)
   */
  rotateFromSnapshot(srcBuffer, area, degrees) {
    if (!srcBuffer) return;
    const output = degrees === 0 ? srcBuffer : this._rotateAttrBuffer(srcBuffer, degrees);
    // Batched like every other transform: unbatched, each of the area's
    // pixels emitted its own CANVAS_DIRTY and marked the document modified,
    // on every tick of the slider. Nests inside the slider's open action.
    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(output, area);
    PixelDrawRoutine.endBatch();
  }

  /**
   * Pure rotation of an attributed buffer using crisp nearest-neighbour sampling.
   * Returns a new buffer the same size as the input; pixels outside the rotated
   * area become non-ink. Cell attributes are carried through unchanged.
   * @private
   */
  _rotateAttrBuffer(buffer, degrees) {
    const rad = degrees * Math.PI / 180;
    const h = buffer.length, w = buffer[0].length;

    // Indexed buffers ({ idx } entries, Phase 13): pure inverse-mapped
    // nearest-neighbour rotation of the index grid — no canvas mask pass
    // (that path keys off isInk, which indexed entries don't carry).
    if (buffer[0][0] && buffer[0][0].idx !== undefined) {
      const cos = Math.cos(-rad), sin = Math.sin(-rad);
      const cxm = w / 2, cym = h / 2;
      return Array.from({ length: h }, (_, ry) =>
        Array.from({ length: w }, (_, rx) => {
          const dx = rx + 0.5 - cxm, dy = ry + 0.5 - cym;
          const sx = Math.floor(cxm + dx * cos - dy * sin);
          const sy = Math.floor(cym + dx * sin + dy * cos);
          return (sx >= 0 && sx < w && sy >= 0 && sy < h)
            ? { idx: buffer[sy][sx].idx } : { idx: -1 };
        })
      );
    }

    // The ink mask of the source depends on the buffer alone, and the rotate
    // slider hands the SAME snapshot in on every tick - so it is drawn once
    // per snapshot, not one fillRect per ink pixel per tick.
    let src = this._rotateSourceMasks.get(buffer);
    if (!src) {
      src = Helpers.createCanvas(w, h);
      const sCtx = src.getContext('2d');
      sCtx.fillStyle = '#fff'; sCtx.fillRect(0, 0, w, h);
      sCtx.fillStyle = '#000';
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++)
        if (buffer[py][px].isInk) sCtx.fillRect(px, py, 1, 1);
      this._rotateSourceMasks.set(buffer, src);
    }

    const dst = Helpers.createCanvas(w, h);
    const dCtx = dst.getContext('2d');
    dCtx.fillStyle = '#fff'; dCtx.fillRect(0, 0, w, h);
    dCtx.translate(w / 2, h / 2);
    dCtx.rotate(rad);
    dCtx.imageSmoothingEnabled = false;
    dCtx.drawImage(src, -w / 2, -h / 2);

    const imgData = dCtx.getImageData(0, 0, w, h).data;
    const isInkMap = Array.from({ length: h }, (_, ry) =>
      Array.from({ length: w }, (_, rx) => imgData[(ry * w + rx) * 4] < 128)
    );

    return buffer.map((row, ry) => row.map((p, rx) => ({ ...p, isInk: isInkMap[ry][rx] })));
  }

  /**
   * Shift the work area. Dots move; what travels with them depends on content:
   *   'both'    - dots move. On a whole-cell step each cell's colours move too
   *               (paper included); otherwise only the ink follows the dots.
   *   'dots'    - dots move one step; every cell keeps its colours.
   *   'colours' - cell colours move one cell per step; dots stay put.
   * Modes without cell colours always act as 'both'.
   * Diagonals are one horizontal pass then one vertical pass.
   * @param {string} direction - up, down, left, right, upLeft, upRight, downLeft, downRight
   * @param {number|{x:number,y:number}} amount - pixels (a number applies to both axes)
   * @param {boolean} wrap - roll around the edge (default true)
   * @param {string} content - 'both' (default), 'dots' or 'colours'
   * @returns {boolean} whether anything changed. False when there is no
   *   layer, the layer is locked, or the step moved nothing; the Transform
   *   panel uses it to drop an undo entry that did nothing.
   */
  shift(direction, amount = 1, wrap = true, content = 'both') {
    const vec = SHIFT_VECTORS[direction];
    const layer = LayerManager.getCurrentLayer();
    if (!vec || !layer || layer.locked) return false;

    const area = this._getWorkArea();
    const stepX = typeof amount === 'object' ? amount.x : amount;
    const stepY = typeof amount === 'object' ? amount.y : amount;
    const useContent = ColorManager.hasCellAttributes() ? content : 'both';

    const passes = [];
    if (vec[0]) passes.push([vec[0] * stepX, 0]);
    if (vec[1]) passes.push([0, vec[1] * stepY]);

    let changed = false;
    PixelDrawRoutine.beginBatch();
    for (const [vx, vy] of passes) {
      if (this._shiftPass(area, vx, vy, wrap, useContent)) changed = true;
    }
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', `Shift ${direction} (${useContent}, ${wrap ? 'wrap' : 'no-wrap'}) ${changed ? 'applied' : 'no change'}`);
    return changed;
  }

  /**
   * One axis-aligned pass of a shift. Caller holds the batch.
   * @param {Object} area - { x, y, width, height }
   * @param {number} vx - dot movement in pixels (horizontal)
   * @param {number} vy - dot movement in pixels (vertical)
   * @returns {boolean} whether anything changed
   * @private
   */
  _shiftPass(area, vx, vy, wrap, content) {
    if (content === 'dots') return this._shiftDots(area, vx, vy, wrap);
    if (content === 'colours') {
      // Colours move whole cells: a pixel step becomes at least one cell.
      const cells = (v, size) => Math.sign(v) * Math.max(1, Math.round(Math.abs(v) / size));
      return this._shiftColours(area,
        vx ? cells(vx, ZX_SPECTRUM.CELL_WIDTH) : 0,
        vy ? cells(vy, ZX_SPECTRUM.CELL_HEIGHT) : 0, wrap);
    }
    // 'both': a whole-cell step moves dots and colours together; anything
    // finer is today's pixel shift, where the paper stays in its cell.
    const aligned = vx % ZX_SPECTRUM.CELL_WIDTH === 0 && vy % ZX_SPECTRUM.CELL_HEIGHT === 0;
    if (!ColorManager.hasCellAttributes() || !aligned) return this._shiftBuffer(area, vx, vy, wrap);
    // Dots and colours must share one rectangle, or a dot wraps into a cell
    // whose colours did not travel with it. Round the selection out to whole
    // cells: a whole cell moves, its dots included, even outside the marquee.
    const whole = this._cellPixelRect(area);
    const dots = this._shiftDots(whole, vx, vy, wrap);
    const cells = this._shiftColours(whole, vx / ZX_SPECTRUM.CELL_WIDTH, vy / ZX_SPECTRUM.CELL_HEIGHT, wrap);
    return dots || cells;
  }

  /**
   * The dots of an area: pixel states (bool), or GigaScreen blend slots.
   * @returns {Array[][]|null}
   * @private
   */
  _dotGrid(area) {
    return ZX_SPECTRUM.SCREENS === 2 ? this._copySlots(area) : this._copyToBuffer(area);
  }

  /** The value meaning "no dot" in a dot grid. @private */
  _offDot() {
    return ZX_SPECTRUM.SCREENS === 2 ? GIGA_SLOTS.PAPER_PAPER : false;
  }

  /**
   * Write a dot grid over an area, touching only pixels whose value changed.
   * Colours are never written (PIXEL_ONLY and ERASE leave them), so every cell
   * keeps its colours and a see-through cell stays see-through. Caller holds
   * the batch.
   * @param {Object} area
   * @param {Array[][]} before - grid as read
   * @param {Array[][]} after - grid to write
   * @returns {boolean} whether any pixel changed
   * @private
   */
  _writeDots(area, before, after) {
    const sel = ColorManager.getCurrentSelection();
    const giga = ZX_SPECTRUM.SCREENS === 2;
    let changed = false;
    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < after.length; py++) {
        for (let px = 0; px < after[py].length; px++) {
          const pixelX = area.x + px, pixelY = area.y + py;
          if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
          const v = after[py][px];
          if (v === before[py][px]) continue;
          changed = true;
          if (giga) {
            if (v === GIGA_SLOTS.PAPER_PAPER) {
              PixelDrawRoutine.draw(pixelX, pixelY, sel, DRAW_MODE.ERASE);
            } else {
              PixelDrawRoutine.draw(pixelX, pixelY, { ...sel, gigaSlot: v }, DRAW_MODE.PIXEL_ONLY);
            }
          } else {
            PixelDrawRoutine.draw(pixelX, pixelY, sel, v ? DRAW_MODE.PIXEL_ONLY : DRAW_MODE.ERASE);
          }
        }
      }
    });
    return changed;
  }

  /**
   * Move the dots of an area by (vx, vy) pixels; colours stay in their cells.
   * @returns {boolean} whether anything changed
   * @private
   */
  _shiftDots(area, vx, vy, wrap) {
    const before = this._dotGrid(area);
    if (!before) return false;
    const h = before.length, w = before[0].length;
    const off = this._offDot();
    const after = [];
    for (let py = 0; py < h; py++) {
      const row = [];
      for (let px = 0; px < w; px++) {
        const srcX = px - vx, srcY = py - vy;
        if (wrap) {
          row.push(before[((srcY % h) + h) % h][((srcX % w) + w) % w]);
        } else {
          row.push((srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) ? before[srcY][srcX] : off);
        }
      }
      after.push(row);
    }
    return this._writeDots(area, before, after);
  }

  /**
   * Move cell colours by (cvx, cvy) whole cells within the cell rectangle the
   * area touches. A no-wrap cell with no source keeps its own colours.
   * Caller holds the batch.
   * @returns {boolean} whether any cell changed
   * @private
   */
  _shiftColours(area, cvx, cvy, wrap) {
    if (this.attributeCommandsBlocked()) return false;
    const rect = this._attributeCellRect(area);
    const w = rect.x1 - rect.x0 + 1, h = rect.y1 - rect.y0 + 1;
    const writes = this._planCellWrites(rect, (cx, cy, grid) => {
      const ox = cx - rect.x0, oy = cy - rect.y0;
      let sx = ox - cvx, sy = oy - cvy;
      if (wrap) {
        sx = ((sx % w) + w) % w;
        sy = ((sy % h) + h) % h;
      } else if (sx < 0 || sx >= w || sy < 0 || sy >= h) {
        return { ...grid[oy][ox] };
      }
      return { ...grid[sy][sx] };
    });
    if (writes.length === 0) return false;
    this._applyCellWrites(writes);
    return true;
  }

  /**
   * The legacy whole-pixel shift: dots and their cell colours (ink) move
   * together; paper stays in its cell. Caller holds the batch.
   * @returns {boolean} true (the area was shifted)
   * @private
   */
  _shiftBuffer(area, vx, vy, wrap) {
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return false;

    const h = buffer.length;
    const w = buffer[0].length;
    const shifted = [];
    // Vacated pixels in no-wrap mode: no ink; _applyBufferWithAttrs erases
    // them and keeps each destination cell's existing paper.
    const background = { isInk: false, ink: 0, paper: 7, bright: false, flash: false };

    for (let py = 0; py < h; py++) {
      const row = [];
      for (let px = 0; px < w; px++) {
        const srcX = px - vx, srcY = py - vy;
        if (wrap) {
          row.push(buffer[((srcY % h) + h) % h][((srcX % w) + w) % w]);
        } else {
          row.push((srcX >= 0 && srcX < w && srcY >= 0 && srcY < h)
            ? buffer[srcY][srcX] : background);
        }
      }
      shifted.push(row);
    }

    this._applyBufferWithAttrs(shifted, area);
    return true;
  }

  /**
   * Shift up
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftUp(amount = 1, wrap = true) {
    return this.shift('up', amount, wrap);
  }

  /**
   * Shift down
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftDown(amount = 1, wrap = true) {
    return this.shift('down', amount, wrap);
  }

  /**
   * Shift left
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftLeft(amount = 1, wrap = true) {
    return this.shift('left', amount, wrap);
  }

  /**
   * Shift right
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftRight(amount = 1, wrap = true) {
    return this.shift('right', amount, wrap);
  }

  /**
   * Scale the area by a factor
   * @param {number} scaleX - Horizontal scale factor
   * @param {number} scaleY - Vertical scale factor
   */
  scale(scaleX, scaleY) {
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;

    const h = buffer.length;
    const w = buffer[0].length;
    const newW = Math.max(1, Math.round(w * scaleX));
    const newH = Math.max(1, Math.round(h * scaleY));

    // Nearest-neighbor resample
    const scaledBuffer = [];
    for (let outY = 0; outY < newH; outY++) {
      const row = [];
      for (let outX = 0; outX < newW; outX++) {
        const origX = Math.floor(outX * w / newW);
        const origY = Math.floor(outY * h / newH);
        row.push(buffer[origY][origX]);
      }
      scaledBuffer.push(row);
    }

    // Center scaled result in original area; pad with all-paper original-colour entries
    const output = buffer.map(row => row.map(p => ({ isInk: false, ink: p.ink, paper: p.paper, bright: p.bright, flash: p.flash })));
    const offsetX = Math.floor((area.width - newW) / 2);
    const offsetY = Math.floor((area.height - newH) / 2);

    for (let outY = 0; outY < newH; outY++) {
      for (let outX = 0; outX < newW; outX++) {
        const dx = offsetX + outX, dy = offsetY + outY;
        if (dx >= 0 && dx < area.width && dy >= 0 && dy < area.height) {
          output[dy][dx] = scaledBuffer[outY][outX];
        }
      }
    }

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(output, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', `Scale ${scaleX}x${scaleY} applied`);
  }

  /**
   * Mark all paper pixels reachable from the buffer boundary via 4-connected flood fill.
   * Used to constrain dilation so it only grows into exterior space, not enclosed holes.
   * @param {boolean[][]} buffer - ink map (true = ink)
   * @param {number} h
   * @param {number} w
   * @returns {boolean[][]} exterior mask (true = exterior paper pixel)
   */
  markExteriorBuffer(buffer, h, w) {
    const exterior = Array.from({ length: h }, () => new Array(w).fill(false));
    const queue = [];
    const seed = (ry, rx) => {
      if (!buffer[ry][rx] && !exterior[ry][rx]) {
        exterior[ry][rx] = true;
        queue.push(ry * w + rx);
      }
    };
    for (let rx = 0; rx < w; rx++) { seed(0, rx); seed(h - 1, rx); }
    for (let ry = 1; ry < h - 1; ry++) { seed(ry, 0); seed(ry, w - 1); }
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const ry = (idx / w) | 0, rx = idx % w;
      for (const [dy, dx] of dirs) {
        const ny = ry + dy, nx = rx + dx;
        if (ny >= 0 && ny < h && nx >= 0 && nx < w && !buffer[ny][nx] && !exterior[ny][nx]) {
          exterior[ny][nx] = true;
          queue.push(ny * w + nx);
        }
      }
    }
    return exterior;
  }

  /**
   * Morphological dilation constrained to exterior pixels only.
   * Enclosed holes (not reachable from outside) are never filled.
   * @param {boolean[][]} src
   * @param {boolean[][]} exterior - from markExteriorBuffer
   * @param {number} h
   * @param {number} w
   * @param {number} steps
   * @returns {boolean[][]}
   */
  dilateExteriorBuffer(src, exterior, h, w, steps) {
    let cur = src.map(row => [...row]);
    for (let s = 0; s < steps; s++) {
      const prev = cur;
      cur = prev.map(row => [...row]);
      for (let ry = 0; ry < h; ry++) {
        for (let rx = 0; rx < w; rx++) {
          if (!prev[ry][rx] && exterior[ry][rx]) {
            expand: for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = rx + dx, ny = ry + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && prev[ny][nx]) {
                  cur[ry][rx] = true;
                  break expand;
                }
              }
            }
          }
        }
      }
    }
    return cur;
  }

  /**
   * Draw an outline ring around the exterior of ink pixels.
   * Enclosed holes are never outlined — only the outer boundary gets the ring.
   * Result: original pixels + gap (empty) + outline ring on exterior only.
   * @param {number} [gap=1] - Empty pixels between original and outline
   * @param {number} [outlineSize=1] - Thickness of the ink outline ring
   */
  outline(gap = 1, outlineSize = 1) {
    const area = this._getWorkArea();
    const buffer = this._copyToBuffer(area);
    if (!buffer) return;

    const h = buffer.length;
    const w = buffer[0].length;
    const exterior = this.markExteriorBuffer(buffer, h, w);
    const inner    = this.dilateExteriorBuffer(buffer, exterior, h, w, gap);
    const outer    = this.dilateExteriorBuffer(inner,  exterior, h, w, outlineSize);
    let outlined = buffer.map((row, ry) =>
      row.map((cell, rx) => cell || (outer[ry][rx] && !inner[ry][rx]))
    );
    // GigaScreen: marked pixels keep their blend and the ring takes the one
    // the artist paints with, rather than every pixel becoming the Paint slot
    if (ZX_SPECTRUM.SCREENS === 2) {
      const slots = this._copySlots(area);
      const paint = ColorManager.getGigaSlot();
      outlined = outlined.map((row, ry) => row.map((on, rx) => {
        if (buffer[ry][rx]) return slots[ry][rx];
        return on ? paint : GIGA_SLOTS.PAPER_PAPER;
      }));
    }

    PixelDrawRoutine.beginBatch();
    this._applyBuffer(outlined, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', `Outline gap=${gap} size=${outlineSize} applied`);
  }

  /**
   * Invert all pixels in the area. GigaScreen inverts each screen on its own:
   * slot s becomes 3 - s, so inverting twice gives the picture back.
   */
  invert() {
    const area = this._getWorkArea();
    const buffer = ZX_SPECTRUM.SCREENS === 2 ? this._copySlots(area) : this._copyToBuffer(area);
    if (!buffer) return;

    const inverted = ZX_SPECTRUM.SCREENS === 2
      ? buffer.map(row => row.map(slot => GIGA_SLOTS.INK_INK - slot))
      : buffer.map(row => row.map(pixel => !pixel));

    PixelDrawRoutine.beginBatch();
    this._applyBuffer(inverted, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', 'Invert applied');
  }

  // ── Attribute commands (Image > Attributes) ─────────────────────────────
  // They change cell colours and leave every dot where it is. The work area
  // is rounded out to whole cells, and each command is one undo step.

  /**
   * Why the attribute commands cannot run now, or null when they can.
   * Checked in the service too, so a shortcut or a stale menu cannot bypass it.
   * @returns {string|null} 'noCellAttributes' | 'stamp' | 'locked' | null
   */
  attributeCommandsBlocked() {
    if (!ColorManager.hasCellAttributes()) return 'noCellAttributes';
    const layer = LayerManager.getCurrentLayer();
    if (!layer || layer.isStamp) return 'stamp';
    if (layer.locked) return 'locked';
    return null;
  }

  /**
   * The pixel rectangle of the whole cells the area touches.
   * @returns {{x:number, y:number, width:number, height:number}}
   * @private
   */
  _cellPixelRect(area) {
    const r = this._attributeCellRect(area);
    return {
      x: r.x0 * ZX_SPECTRUM.CELL_WIDTH,
      y: r.y0 * ZX_SPECTRUM.CELL_HEIGHT,
      width: (r.x1 - r.x0 + 1) * ZX_SPECTRUM.CELL_WIDTH,
      height: (r.y1 - r.y0 + 1) * ZX_SPECTRUM.CELL_HEIGHT
    };
  }

  /**
   * The cell rectangle the work area touches, clamped to the grid.
   * @returns {{x0:number, y0:number, x1:number, y1:number}}
   * @private
   */
  _attributeCellRect(area) {
    const a = ZX_COORDS.pixelToCell(area.x, area.y);
    const b = ZX_COORDS.pixelToCell(area.x + area.width - 1, area.y + area.height - 1);
    return {
      x0: Math.max(0, a.x),
      y0: Math.max(0, a.y),
      x1: Math.min(ZX_SPECTRUM.GRID_COLS - 1, b.x),
      y1: Math.min(ZX_SPECTRUM.GRID_ROWS - 1, b.y)
    };
  }

  /**
   * The colours a cell shows: screen A, and screen B on GigaScreen.
   * @private
   */
  _readCellAttrs(layer, cx, cy) {
    const a = LayerManager.attrsAsSeen(layer, cx, cy);
    const e = { ink: a.ink, paper: a.paper, bright: a.bright, flash: a.flash };
    if (ZX_SPECTRUM.SCREENS === 2) {
      const b = LayerManager.attrsAsSeen(layer, cx, cy, 1);
      e.inkB = b.ink; e.paperB = b.paper; e.brightB = b.bright; e.flashB = b.flash;
    }
    return e;
  }

  /** Write one cell's colours with ATTRIBUTES_ONLY (dots are never touched). @private */
  _writeCellAttrs(layer, cx, cy, e) {
    const px = ZX_COORDS.cellToPixel(cx, cy);
    const sel = { ink: e.ink, paper: e.paper, bright: e.bright, flash: e.flash };
    if (ZX_SPECTRUM.SCREENS === 2) {
      sel.inkB = e.inkB; sel.paperB = e.paperB; sel.brightB = e.brightB; sel.flashB = e.flashB;
    }
    PixelDrawRoutine.draw(px.x, px.y, sel, DRAW_MODE.ATTRIBUTES_ONLY, { layer });
  }

  /** True when two attribute sets agree on every field the target carries. @private */
  _sameAttrs(next, cur) {
    for (const k of Object.keys(next)) {
      if (next[k] !== cur[k]) return false;
    }
    return true;
  }

  /**
   * Rewrite the colours of a cell rectangle. Every source is read before the
   * first write, so a flip never reads a cell it has already changed. Cells
   * whose colours would not change are skipped, so no-op commands add no undo
   * step and see-through upper-layer cells stay see-through.
   * @param {{x0,y0,x1,y1}} rect - cell rectangle
   * @param {Function} targetOf - (cx, cy, grid, rect) => attrs to write there
   * @returns {number} cells changed
   * @private
   */
  _rewriteCells(rect, targetOf) {
    const writes = this._planCellWrites(rect, targetOf);
    if (writes.length === 0) return 0;

    PixelDrawRoutine.beginBatch();
    this._applyCellWrites(writes);
    PixelDrawRoutine.endBatch();
    return writes.length;
  }

  /**
   * Read the cell rectangle and say what each cell should become. Reads
   * everything before returning, so no write can change a source. Makes no
   * writes and opens no batch, so a caller may use it inside its own batch
   * (PixelDrawRoutine.beginBatch does not nest).
   * @returns {Array<{cx:number, cy:number, next:Object}>} cells that change
   * @private
   */
  _planCellWrites(rect, targetOf) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return [];
    const grid = [];
    for (let cy = rect.y0; cy <= rect.y1; cy++) {
      const row = [];
      for (let cx = rect.x0; cx <= rect.x1; cx++) row.push(this._readCellAttrs(layer, cx, cy));
      grid.push(row);
    }
    const writes = [];
    for (let cy = rect.y0; cy <= rect.y1; cy++) {
      for (let cx = rect.x0; cx <= rect.x1; cx++) {
        const next = targetOf(cx, cy, grid, rect);
        const cur = grid[cy - rect.y0][cx - rect.x0];
        if (!this._sameAttrs(next, cur)) writes.push({ cx, cy, next });
      }
    }
    return writes;
  }

  /**
   * Write planned cell colours. Caller holds the batch.
   * @private
   */
  _applyCellWrites(writes) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;
    PixelDrawRoutine.suspendMirror(() => {
      for (const w of writes) this._writeCellAttrs(layer, w.cx, w.cy, w.next);
    });
  }

  /** Swap ink and paper of one cell's colours; bright and flash stay. @private */
  _swapInkPaper(c) {
    const next = { ink: c.paper, paper: c.ink, bright: c.bright, flash: c.flash };
    if (ZX_SPECTRUM.SCREENS === 2) {
      next.inkB = c.paperB; next.paperB = c.inkB;
      next.brightB = c.brightB; next.flashB = c.flashB;
    }
    return next;
  }

  /**
   * Swap ink and paper of each cell; bright and flash stay. GigaScreen swaps
   * each screen's own pair. Running it twice gives the picture back.
   * @returns {number} cells changed
   */
  invertAttributes() {
    if (this.attributeCommandsBlocked()) return 0;
    const rect = this._attributeCellRect(this._getWorkArea());
    return this._rewriteCells(rect, (cx, cy, grid) =>
      this._swapInkPaper(grid[cy - rect.y0][cx - rect.x0]));
  }

  /**
   * Write the current colours to each cell. "Use existing" boxes are honoured:
   * a kept part keeps what each cell shows.
   * @returns {number} cells changed
   */
  eraseAttributes() {
    if (this.attributeCommandsBlocked()) return 0;
    const rect = this._attributeCellRect(this._getWorkArea());
    const rail = ColorManager.getCurrentSelection();
    return this._rewriteCells(rect, (cx, cy, grid) => {
      const c = grid[cy - rect.y0][cx - rect.x0];
      const next = {
        ink: rail.inkTransparent ? c.ink : rail.ink,
        paper: rail.paperTransparent ? c.paper : rail.paper,
        bright: rail.brightTransparent ? c.bright : rail.bright,
        flash: rail.flashTransparent ? c.flash : rail.flash
      };
      if (ZX_SPECTRUM.SCREENS === 2) {
        next.inkB = rail.inkTransparent ? c.inkB : (rail.inkB != null ? rail.inkB : rail.ink);
        next.paperB = rail.paperTransparent ? c.paperB : (rail.paperB != null ? rail.paperB : rail.paper);
        next.brightB = rail.brightTransparent ? c.brightB : (rail.brightB != null ? rail.brightB : rail.bright);
        next.flashB = rail.flashTransparent ? c.flashB : (rail.flashB != null ? rail.flashB : rail.flash);
      }
      return next;
    });
  }

  /**
   * Mirror the cell colours left-right across the work area's cell rectangle.
   * @returns {number} cells changed
   */
  flipAttributesHorizontal() {
    if (this.attributeCommandsBlocked()) return 0;
    const rect = this._attributeCellRect(this._getWorkArea());
    return this._rewriteCells(rect, (cx, cy, grid) => {
      const mx = rect.x0 + rect.x1 - cx;
      return { ...grid[cy - rect.y0][mx - rect.x0] };
    });
  }

  /**
   * Mirror the cell colours top-bottom across the work area's cell rectangle.
   * @returns {number} cells changed
   */
  flipAttributesVertical() {
    if (this.attributeCommandsBlocked()) return 0;
    const rect = this._attributeCellRect(this._getWorkArea());
    return this._rewriteCells(rect, (cx, cy, grid) => {
      const my = rect.y0 + rect.y1 - cy;
      return { ...grid[my - rect.y0][cx - rect.x0] };
    });
  }

}

window.TransformService = new TransformServiceClass();

Logger.debug('TransformService', 'Transform service loaded');

})(); // End IIFE
