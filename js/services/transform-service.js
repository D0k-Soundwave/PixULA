'use strict';
(function() {

/**
 * Transform Service
 *
 * Provides transformation operations for pixels and selections.
 * All operations work on the current selection or entire canvas.
 */

class TransformServiceClass {
  constructor() {
    this.tempBuffer = null;
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
          row.push({
            isInk:  layer.getPixelState(pixelX, pixelY),
            ink:    cell ? cell.ink   : 0,
            paper:  cell ? cell.paper : 7,
            bright: cell ? cell.bright : false,
            flash:  cell ? cell.flash  : false
          });
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
    const bgLayer = LayerManager.layers[0];
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
    for (let py = 0; py < buffer.length; py++) {
      for (let px = 0; px < buffer[py].length; px++) {
        const pixelX = area.x + px, pixelY = area.y + py;
        if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
        const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
        const key = `${cellPos.x},${cellPos.y}`;
        if (!destPaper.has(key)) {
          const cell  = layer   ? layer.getCell(cellPos.x, cellPos.y)   : null;
          const bg    = bgLayer ? bgLayer.getCell(cellPos.x, cellPos.y) : null;
          const src   = (cell && cell.altered) ? cell : bg;
          destPaper.set(key, src ? src.paper : fallback.paper);
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
        if (!cellColors.has(key)) {
          cellColors.set(key, { ink: p.ink, bright: p.bright, flash: p.flash, hasInk: p.isInk });
        } else if (p.isInk && !cellColors.get(key).hasInk) {
          cellColors.set(key, { ink: p.ink, bright: p.bright, flash: p.flash, hasInk: true });
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
          PixelDrawRoutine.draw(pixelX, pixelY, colorSel, p.isInk ? DRAW_MODE.NORMAL : DRAW_MODE.ERASE);
        }
      }
    });
  }

  /**
   * Apply buffer to an area (bool only — colour comes from current selection)
   * @param {boolean[][]} buffer - 2D array of pixel states
   * @param {Object} area - { x, y, width, height }
   * @private
   */
  _applyBuffer(buffer, area) {
    const color   = ColorManager.getCurrentSelection();
    const layer   = LayerManager.getCurrentLayer();
    const bgLayer = LayerManager.layers[0];

    // Snapshot destination-cell paper before writing (same reason as _applyBufferWithAttrs)
    const destPaper = new Map();
    for (let py = 0; py < buffer.length; py++) {
      for (let px = 0; px < buffer[py].length; px++) {
        const pixelX = area.x + px, pixelY = area.y + py;
        if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;
        const cellPos = ZX_COORDS.pixelToCell(pixelX, pixelY);
        const key = `${cellPos.x},${cellPos.y}`;
        if (!destPaper.has(key)) {
          const cell  = layer   ? layer.getCell(cellPos.x, cellPos.y)   : null;
          const bg    = bgLayer ? bgLayer.getCell(cellPos.x, cellPos.y) : null;
          const src   = (cell && cell.altered) ? cell : bg;
          destPaper.set(key, src ? src.paper : color.paper);
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
            const mode  = buffer[py][px] ? DRAW_MODE.NORMAL : DRAW_MODE.ERASE;
            PixelDrawRoutine.draw(pixelX, pixelY, { ...color, paper: destPaper.get(key) ?? color.paper }, mode);
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
   * Rotate 90 degrees clockwise
   * Note: For non-square selections, this may crop or pad pixels
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

    // Place rotated content centered in the original bounding box (all-paper padding)
    const output = src.map(row => row.map(p => ({ isInk: false, ink: p.ink, paper: p.paper, bright: p.bright, flash: p.flash })));
    const offsetX = Math.floor((area.width  - rotated[0].length) / 2);
    const offsetY = Math.floor((area.height - rotated.length)    / 2);
    for (let ry = 0; ry < rotated.length; ry++) {
      for (let rx = 0; rx < rotated[ry].length; rx++) {
        const dx = offsetX + rx, dy = offsetY + ry;
        if (dx >= 0 && dx < area.width && dy >= 0 && dy < area.height) output[dy][dx] = rotated[ry][rx];
      }
    }

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

    // Place centered in original bounding box (all-paper padding)
    const output = src.map(row => row.map(p => ({ isInk: false, ink: p.ink, paper: p.paper, bright: p.bright, flash: p.flash })));
    const offsetX = Math.floor((area.width  - rotated[0].length) / 2);
    const offsetY = Math.floor((area.height - rotated.length)    / 2);
    for (let ry = 0; ry < rotated.length; ry++) {
      for (let rx = 0; rx < rotated[ry].length; rx++) {
        const dx = offsetX + rx, dy = offsetY + ry;
        if (dx >= 0 && dx < area.width && dy >= 0 && dy < area.height) output[dy][dx] = rotated[ry][rx];
      }
    }

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
    this._applyBufferWithAttrs(output, area);
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

    const src = Helpers.createCanvas(w, h);
    const sCtx = src.getContext('2d');
    sCtx.fillStyle = '#fff'; sCtx.fillRect(0, 0, w, h);
    sCtx.fillStyle = '#000';
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++)
      if (buffer[py][px].isInk) sCtx.fillRect(px, py, 1, 1);

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
   * Shift pixels in a direction (preserves cell colour attributes).
   * wrap=true rolls pixels around the edge (ZX-PB "rolling"); wrap=false
   * scrolls them out and feeds in background (paper) rows/columns.
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @param {number} amount - Pixels to shift (default 1)
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shift(direction, amount = 1, wrap = true) {
    const area = this._getWorkArea();
    const buffer = this._copyToBufferWithAttrs(area);
    if (!buffer) return;

    const h = buffer.length;
    const w = buffer[0].length;
    const shifted = [];
    // Vacated pixels in no-wrap mode: no ink; _applyBufferWithAttrs erases
    // them and keeps each destination cell's existing paper.
    const background = { isInk: false, ink: 0, paper: 7, bright: false, flash: false };

    for (let py = 0; py < h; py++) {
      const row = [];
      for (let px = 0; px < w; px++) {
        let srcX = px, srcY = py;
        switch (direction) {
          case 'up':    srcY = py + amount; break;
          case 'down':  srcY = py - amount; break;
          case 'left':  srcX = px + amount; break;
          case 'right': srcX = px - amount; break;
        }
        if (wrap) {
          srcX = ((srcX % w) + w) % w;
          srcY = ((srcY % h) + h) % h;
          row.push(buffer[srcY][srcX]);
        } else {
          row.push(
            (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h)
              ? buffer[srcY][srcX] : background
          );
        }
      }
      shifted.push(row);
    }

    PixelDrawRoutine.beginBatch();
    this._applyBufferWithAttrs(shifted, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', `Shift ${direction} by ${amount} (${wrap ? 'wrap' : 'no-wrap'}) applied`);
  }

  /**
   * Shift up
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftUp(amount = 1, wrap = true) {
    this.shift('up', amount, wrap);
  }

  /**
   * Shift down
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftDown(amount = 1, wrap = true) {
    this.shift('down', amount, wrap);
  }

  /**
   * Shift left
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftLeft(amount = 1, wrap = true) {
    this.shift('left', amount, wrap);
  }

  /**
   * Shift right
   * @param {number} amount - Pixels to shift
   * @param {boolean} wrap - Roll around the edge (default true)
   */
  shiftRight(amount = 1, wrap = true) {
    this.shift('right', amount, wrap);
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
    const outlined = buffer.map((row, ry) =>
      row.map((cell, rx) => cell || (outer[ry][rx] && !inner[ry][rx]))
    );

    PixelDrawRoutine.beginBatch();
    this._applyBuffer(outlined, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', `Outline gap=${gap} size=${outlineSize} applied`);
  }

  /**
   * Invert all pixels in the area
   */
  invert() {
    const area = this._getWorkArea();
    const buffer = this._copyToBuffer(area);
    if (!buffer) return;

    const inverted = buffer.map(row => row.map(pixel => !pixel));

    PixelDrawRoutine.beginBatch();
    this._applyBuffer(inverted, area);
    PixelDrawRoutine.endBatch();

    Logger.debug('TransformService', 'Invert applied');
  }

  /**
   * Shift every altered cell's ink colour on the current layer by step (±1, wraps 0-7).
   * Unaltered (transparent) cells are skipped to avoid poisoning future drawing.
   * @param {number} step - +1 or -1
   */
  cycleLayerInk(step) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;
    const baseColors = ZX_PALETTE.length / 2;
    PixelDrawRoutine.beginBatch('Cycle Layer Ink');
    // A whole-layer recolour, not a tool stroke: neither mirrored nor clipped.
    PixelDrawRoutine.suspendStrokeHooks(() => {
      for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
        for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
          const cell = layer.getCell(cx, cy);
          if (!cell || !cell.altered) continue;
          const newInk = (cell.ink + step + baseColors) % baseColors;
          const px = ZX_COORDS.cellToPixel(cx, cy);
          PixelDrawRoutine.draw(px.x, px.y,
            { ink: newInk, paper: cell.paper, bright: cell.bright, flash: cell.flash },
            DRAW_MODE.ATTRIBUTES_ONLY, { layer });
        }
      }
    });
    PixelDrawRoutine.endBatch();
  }

  /**
   * Shift every altered cell's paper colour on the current layer by step (±1, wraps 0-7).
   * @param {number} step - +1 or -1
   */
  cycleLayerPaper(step) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;
    const baseColors = ZX_PALETTE.length / 2;
    PixelDrawRoutine.beginBatch('Cycle Layer Paper');
    // A whole-layer recolour, not a tool stroke: neither mirrored nor clipped.
    PixelDrawRoutine.suspendStrokeHooks(() => {
      for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
        for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
          const cell = layer.getCell(cx, cy);
          if (!cell || !cell.altered) continue;
          const newPaper = (cell.paper + step + baseColors) % baseColors;
          const px = ZX_COORDS.cellToPixel(cx, cy);
          PixelDrawRoutine.draw(px.x, px.y,
            { ink: cell.ink, paper: newPaper, bright: cell.bright, flash: cell.flash },
            DRAW_MODE.ATTRIBUTES_ONLY, { layer });
        }
      }
    });
    PixelDrawRoutine.endBatch();
  }


}

window.TransformService = new TransformServiceClass();

Logger.debug('TransformService', 'Transform service loaded');

})(); // End IIFE
