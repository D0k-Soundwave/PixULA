'use strict';
(function() {

/**
 * ZXM Format Handler — ZX-Paintbrush map format (.zxm)
 *
 * No public byte-level spec of .zxm exists (verified 2026-07-04: the old
 * zxmodules.de is a dead parked domain, its Wayback captures never had a
 * zxmformat.html page, the current zx-modules.jimdofree.com file-format
 * table does not list *.ZXM, and neither RECOIL nor dexvert decode it).
 * This handler is therefore reconstructed from two hard evidence sources:
 *
 * 1. The .zxp text grammar, from RECOIL's open-source DecodeZxp
 *    (recoil.sourceforge.net — reads ZX-Paintbrush pictures):
 *      line 1: "ZX-Paintbrush image"  (or "ZX-Paintbrush extended image"
 *              for 8×1 attribute lines — not supported here until the
 *              Phase 12 multicolor modes land)
 *      blank line
 *      H bitmap rows of W chars, each '0' (paper), '1' (ink) or
 *              '*' (transparent — only legal inside map elements)
 *      blank line
 *      H/8 attribute rows (8×8 mode) of W/8 space-separated hex bytes
 *      [optional ULA+ palette block — rejected here, STANDARD_ULA only]
 *
 * 2. The ZX-Paintbrush 2.6.1 executable's loader strings (portable
 *    release, inspected 2026-07-04), which name the .zxm sections and
 *    constraints verbatim: "[Base ZXP picture]", "[Map ZXP picture]",
 *    "[Map positions]", "[End of file]", "Only one base picture
 *    allowed!", "No base ZXP picture found!", "Missing position list!",
 *    "Transparent base images are not allowed!", "Map list/map element
 *    has an unmatching attribute height!", "Unknown section!".
 *
 * File layout written by this exporter (CRLF, matching a DOS-lineage
 * Windows program; the parser accepts LF too):
 *
 *   [Base ZXP picture]
 *   <ZXP image of the full screen: the map window at (0,0), empty cells
 *    rendered as blank paper cells with attribute 0x38>
 *   [Map ZXP picture]          <- one per tileset tile, in tileset order
 *   <ZXP image of one tile (8×8: 8 rows + 1 attr byte)>
 *   [Map positions]            <- immediately after its element
 *   [x,y]                      <- one per placement, pixel coordinates
 *   [End of file]
 *
 * Documented assumptions (chosen to round-trip our own output; the
 * "round-trips with real ZX-Paintbrush" check is a manual TESTLOG row):
 * - Positions are written "[x,y]" in PIXEL coordinates. Evidence: the
 *   exe formats positions as "[%d,%d]" with default "[0,0]" and a
 *   4-digit edit mask, and describes blocks "at pixel position (%d,%d)".
 *   The parser also accepts unbracketed "x,y" and cell-rounds non-
 *   aligned values.
 * - A "[Map positions]" section binds to the preceding "[Map ZXP
 *   picture]"; every element requires one ("Missing position list!"),
 *   but we accept (and write, for unused tiles) empty position lists.
 * - Map dimensions are NOT stored in .zxm (ZX-Paintbrush maps live on
 *   one screen). Import infers them from the position extent, minimum
 *   one screen; full fidelity is the native .zxtm format's job. Export
 *   writes ALL positions, including off-screen ones for maps larger
 *   than a screen — real ZX-Paintbrush may clamp or reject those.
 * - On import, tiles come from the map elements only (sliced into
 *   attribute cells; multi-cell elements are deduped, one-cell elements
 *   are kept 1:1 in file order). Base-picture content not covered by a
 *   position is background art, not a tile, and is ignored.
 * - '*' (transparent) pixels in elements are read as paper bits — our
 *   tile model is 1-bit + attr and has no per-pixel transparency.
 */
class ZXMFormatClass {
  constructor() {
    this.IDENTIFIER = 'ZX-Paintbrush image';
    this.IDENTIFIER_EXT = 'ZX-Paintbrush extended image';
    this.SEC_BASE = '[Base ZXP picture]';
    this.SEC_ELEMENT = '[Map ZXP picture]';
    this.SEC_POSITIONS = '[Map positions]';
    this.SEC_EOF = '[End of file]';
    this.DEFAULT_ATTR = 0x38;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('zxm', this);
    FormatRegistry.registerExport('zxm', this);
    // Standalone .zxp pictures (RECOIL parity — DecodeZxp): classic and
    // extended (8×1 per-line attribute) forms, optional trailing ULAplus
    // palette block. Handled here because the .zxm grammar embeds the
    // same picture syntax.
    FormatRegistry.registerImport('zxp', {
      parse: (buffer) => this.parseZxp(buffer)
    });
    FormatRegistry.registerExport('zxp', {
      export: () => this.exportZxp(),
      exportAndDownload: (filename, options, handle) => this.exportZxpAndDownload(filename, handle)
    });
    Logger.info('ZXMFormat', 'Initialized (zxm/zxp)');
  }

  // ── Standalone .zxp pictures (RECOIL DecodeZxp grammar) ─────────────────

  /**
   * Parse a standalone ZX-Paintbrush picture. Grammar per RECOIL's
   * DecodeZxp: identifier line ("ZX-Paintbrush image" or "ZX-Paintbrush
   * extended image"), blank, bitmap rows of 0/1/* ('*' renders as paper),
   * blank, attribute rows of hex bytes — one row per CELL row (8×8) or
   * one per PIXEL line (the extended 8×1 form; like RECOIL we infer the
   * form from the row count, the identifier is informational) — then an
   * optional blank line + 64 hex bytes = the ULAplus G3R3B2 registers.
   * Pictures smaller than the screen land top-left on a blank screen
   * (attr 0x38); larger ones crop (documented).
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parseZxp(buffer) {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    const lines = text.split(/\r\n|\n|\r/);
    let i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    const ident = (lines[i] || '').trim();
    if (ident !== this.IDENTIFIER && ident !== this.IDENTIFIER_EXT) {
      return { success: false, error: 'Missing ZXP identifier' };
    }
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;

    // Bitmap rows
    const rows = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const row = lines[i].trim();
      if (!/^[01*]+$/.test(row)) return { success: false, error: 'Invalid pixel definition(s)' };
      if (rows.length && row.length !== rows[0].length) {
        return { success: false, error: 'Pixel width error' };
      }
      rows.push(row);
      i++;
    }
    if (!rows.length) return { success: false, error: 'Bad image content' };
    const width = rows[0].length;
    const height = rows.length;
    if (width % 8 !== 0) return { success: false, error: 'Invalid picture size' };

    // Attribute rows (count decides the form), then the optional palette
    while (i < lines.length && lines[i].trim() === '') i++;
    const attrRows = [];
    let palette = null;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === '') {
        // A blank line may precede the ULAplus palette block
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length) {
          const parts = lines[j].trim().split(/\s+/);
          if (parts.length === 64 && parts.every(p => /^[0-9a-fA-F]{1,2}$/.test(p))) {
            palette = Uint8Array.from(parts, p => parseInt(p, 16));
            i = j + 1;
          }
        }
        break;
      }
      const parts = line.split(/\s+/);
      if (parts.length !== width / 8
          || !parts.every(p => /^[0-9a-fA-F]{1,2}$/.test(p))) {
        return { success: false, error: 'Invalid attribute definition(s)' };
      }
      attrRows.push(Uint8Array.from(parts, p => parseInt(p, 16)));
      i++;
    }

    const perLine = attrRows.length === height;
    if (!perLine && attrRows.length !== Math.ceil(height / 8)) {
      return { success: false, error: 'Invalid attribute definition(s)' };
    }

    const mode = perLine
      ? (palette ? SCREEN_MODES.ULA_PLUS_8x1 : SCREEN_MODES.MULTICOLOR_8x1)
      : (palette ? SCREEN_MODES.ULA_PLUS : SCREEN_MODES.STANDARD_ULA);

    // Compose full-screen bitmap (ULA interleave) + linear attributes,
    // picture at the top-left, blank (paper 7, ink 0) elsewhere
    const bitmap = new Uint8Array(mode.bitmapSize);
    for (let y = 0; y < Math.min(height, mode.height); y++) {
      const base = AttributeSystem._lineOffset(y);
      for (let col = 0; col < Math.min(width, mode.width) / 8; col++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          if (rows[y][col * 8 + b] === '1') byte |= 0x80 >> b;
        }
        bitmap[base + col] = byte;
      }
    }
    const attrs = new Uint8Array(mode.attrSize).fill(0x38);
    const cellH = mode.attrCellH;
    const screenCols = mode.width / 8;
    for (let r = 0; r < Math.min(attrRows.length, mode.height / cellH); r++) {
      const src = attrRows[r];
      attrs.set(src.subarray(0, Math.min(src.length, screenCols)), r * screenCols);
    }

    return SCRFormat.importScreen(bitmap, attrs, mode.id, 'Load ZXP', palette);
  }

  /**
   * Export the composited document as a standalone .zxp text picture.
   * Classic form in 8×8-cell modes; the extended per-line form in the
   * multicolor modes (8×2/8×4 rows repeat their cell's attribute — the
   * lossless upward representation); ULAplus modes append the 64-register
   * palette block. Other palette/pixel models have no ZXP representation.
   * @returns {Uint8Array} UTF-8 text
   */
  exportZxp() {
    const mode = ACTIVE_SCREEN_MODE;
    if ((mode.pixelDepth || 1) !== 1 || (mode.screens || 1) === 2
        || (mode.paletteModel !== 'fixed16' && mode.paletteModel !== 'ulaplus64')) {
      throw new Error(Helpers.localizedMessage('mode.zxpNeedsClassic',
        'ZXP holds classic and ULAplus cell pictures — switch out of this screen mode first.'));
    }

    const flattened = LayerManager.flattenVisible();
    const extended = mode.attrCellH !== 8;
    const lines = [extended ? this.IDENTIFIER_EXT : this.IDENTIFIER, ''];

    const cellAt = (cx, cy) => flattened.getCell(cx, cy);
    const attrByte = (cell) => (cell.flash ? 0x80 : 0) | (cell.bright ? 0x40 : 0)
      | ((cell.paper & 7) << 3) | (cell.ink & 7);

    for (let y = 0; y < mode.height; y++) {
      let row = '';
      const cy = Math.floor(y / mode.attrCellH);
      for (let cx = 0; cx < mode.width / 8; cx++) {
        const bits = cellAt(cx, cy).pixels[y % mode.attrCellH];
        for (let b = 0; b < 8; b++) row += (bits & (0x80 >> b)) ? '1' : '0';
      }
      lines.push(row);
    }
    lines.push('');

    const attrRowCount = extended ? mode.height : mode.height / 8;
    for (let r = 0; r < attrRowCount; r++) {
      const cy = extended ? Math.floor(r / mode.attrCellH) : r;
      const parts = [];
      for (let cx = 0; cx < mode.width / 8; cx++) {
        parts.push(attrByte(cellAt(cx, cy)).toString(16).toUpperCase().padStart(2, '0'));
      }
      lines.push(parts.join(' '));
    }

    if (mode.paletteModel === 'ulaplus64') {
      const regs = window.ColorManager
        ? ColorManager.getUlaplusRegisters() : ULAPLUS.defaultRegisters();
      lines.push('', Array.from(regs,
        r => r.toString(16).toUpperCase().padStart(2, '0')).join(' '));
    }

    return new TextEncoder().encode(lines.join('\r\n') + '\r\n');
  }

  /** @param {string} filename */
  async exportZxpAndDownload(filename = 'image.zxp', handle = null) {
    let name = filename || 'image.zxp';
    if (!name.toLowerCase().endsWith('.zxp')) name = `${name}.zxp`;
    return FormatRegistry.download(this.exportZxp(), name, undefined, handle);
  }

  /**
   * Parse ZXM file data (import) into the working map document.
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const result = this.parseText(new TextDecoder().decode(new Uint8Array(buffer)));
    if (!result.success) return result;
    MapService.loadDocument(result.doc);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'zxm' });
    Logger.info('ZXMFormat',
      `ZXM map loaded (${result.doc.tiles.length} tiles, ${result.doc.map.width}×${result.doc.map.height})`);
    return { success: true };
  }

  /**
   * Export the working map document as ZXM bytes.
   * @returns {Uint8Array} Complete ZXM document (UTF-8/ASCII text)
   */
  export() {
    return new TextEncoder().encode(this.buildText(MapService.toDocument()));
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Target filename
   */
  async exportAndDownload(filename = 'map.zxm', options = {}, handle = null) {
    const name = filename.endsWith('.zxm') ? filename : `${filename}.zxm`;
    return FormatRegistry.download(this.export(), name, 'text/plain', handle);
  }

  // ── Pure text codec (Node-tested against synthetic documents) ───────────

  /**
   * Build the complete .zxm text for a map document.
   * @param {Object} doc - { tiles, map: { width, height, cells } }
   * @returns {string}
   */
  buildText(doc) {
    const { w: tw, h: th } = this._tileSize();
    const cols = ACTIVE_SCREEN_MODE.width / tw;
    const rows = ACTIVE_SCREEN_MODE.height / th;
    const lines = [];

    // Base picture: the top-left screen window of the rendered map
    lines.push(this.SEC_BASE);
    this._pushZxpImage(lines, ACTIVE_SCREEN_MODE.width, ACTIVE_SCREEN_MODE.height,
      (px, py) => {
        const tile = this._tileAt(doc, (px / tw) | 0, (py / th) | 0, cols, rows);
        return tile ? ((tile.bitmap[py % th] >> (tw - 1 - (px % tw))) & 1) : 0;
      },
      (cx, cy) => {
        const tile = this._tileAt(doc, cx, cy, cols, rows);
        return tile ? tile.attr : this.DEFAULT_ATTR;
      });

    // One element + position list per tileset tile, in tileset order
    for (let t = 0; t < doc.tiles.length; t++) {
      const tile = doc.tiles[t];
      lines.push(this.SEC_ELEMENT);
      this._pushZxpImage(lines, tw, th,
        (px, py) => (tile.bitmap[py] >> (tw - 1 - px)) & 1,
        () => tile.attr);

      lines.push(this.SEC_POSITIONS);
      const { width, height, cells } = doc.map;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (cells[y * width + x] === t) {
            lines.push(`[${x * tw},${y * th}]`);
          }
        }
      }
    }

    lines.push(this.SEC_EOF);
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Parse .zxm text into a map document.
   * @param {string} text
   * @returns {Object} { success: true, doc } or { success: false, error }
   */
  parseText(text) {
    const { w: tw, h: th } = this._tileSize();
    const lines = String(text).split(/\r\n|\n|\r/);
    let i = 0;
    const nextNonBlank = () => {
      while (i < lines.length && lines[i].trim() === '') i++;
      return i < lines.length ? lines[i] : null;
    };

    let base = null;
    const elements = []; // { cellsW, cellsH, tiles: [tile per cell], positions: [{x,y}] }
    let sawEof = false;

    while (i < lines.length) {
      const line = nextNonBlank();
      if (line === null) break;
      const marker = line.trim();

      if (this._sameMarker(marker, this.SEC_EOF)) { sawEof = true; break; }

      if (this._sameMarker(marker, this.SEC_BASE)) {
        if (base) return { success: false, error: 'Only one base picture allowed' };
        i++;
        const img = this._parseZxpImage(lines, () => i, v => { i = v; }, false);
        if (img.error) return { success: false, error: `Base picture: ${img.error}` };
        if (img.width !== ACTIVE_SCREEN_MODE.width || img.height !== ACTIVE_SCREEN_MODE.height) {
          return { success: false, error: 'Base picture is not one screen' };
        }
        base = img;
        continue;
      }

      if (this._sameMarker(marker, this.SEC_ELEMENT)) {
        i++;
        const img = this._parseZxpImage(lines, () => i, v => { i = v; }, true);
        if (img.error) return { success: false, error: `Map element: ${img.error}` };
        if (img.width % tw !== 0 || img.height % th !== 0) {
          return { success: false, error: 'Map element size is not a multiple of the cell size' };
        }
        elements.push({
          cellsW: img.width / tw,
          cellsH: img.height / th,
          tiles: this._sliceToTiles(img, tw, th),
          positions: null
        });
        continue;
      }

      if (this._sameMarker(marker, this.SEC_POSITIONS)) {
        if (!elements.length) return { success: false, error: 'Position list without a map element' };
        const el = elements[elements.length - 1];
        if (el.positions) return { success: false, error: 'Duplicate position list' };
        el.positions = [];
        i++;
        while (i < lines.length) {
          const raw = lines[i].trim();
          if (raw === '') { i++; continue; }
          if (raw.startsWith('[') && !/^\[\s*-?\d/.test(raw)) break; // next section
          const m = raw.match(/^\[?\s*(-?\d+)\s*,\s*(-?\d+)\s*\]?$/);
          if (!m) return { success: false, error: 'Bad map element position' };
          const x = parseInt(m[1], 10), y = parseInt(m[2], 10);
          if (x < 0 || y < 0) return { success: false, error: 'Bad map element position' };
          el.positions.push({ x, y });
          i++;
        }
        continue;
      }

      return { success: false, error: `Unknown section: ${marker.slice(0, 40)}` };
    }

    if (!base) return { success: false, error: 'No base ZXP picture found' };
    if (!sawEof) return { success: false, error: 'Missing [End of file] marker' };
    for (const el of elements) {
      if (!el.positions) return { success: false, error: 'Missing position list' };
    }

    return { success: true, doc: this._composeDocument(elements, tw, th) };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  _tileSize() {
    // 'ula-cell' tile geometry comes from the KIND (same pinning as
    // MapService.getTileSize), never from the runtime-switchable active
    // mode — a .zxm written under standard ULA must parse identically
    // while a multicolor mode is active.
    return {
      w: SCREEN_MODES.STANDARD_ULA.attrCellW,
      h: SCREEN_MODES.STANDARD_ULA.attrCellH
    };
  }

  _sameMarker(line, marker) {
    return line.toLowerCase() === marker.toLowerCase();
  }

  _tileAt(doc, cx, cy, cols, rows) {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
    if (cx >= doc.map.width || cy >= doc.map.height) return null;
    const idx = doc.map.cells[cy * doc.map.width + cx];
    return idx >= 0 ? doc.tiles[idx] : null;
  }

  /**
   * Append one ZXP image (identifier, blank, bitmap rows, blank, attr rows)
   * to the output lines.
   * @private
   */
  _pushZxpImage(lines, width, height, inkAt, attrAt) {
    const { w: tw, h: th } = this._tileSize();
    lines.push(this.IDENTIFIER, '');
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) row += inkAt(x, y) ? '1' : '0';
      lines.push(row);
    }
    lines.push('');
    for (let cy = 0; cy < height / th; cy++) {
      const parts = [];
      for (let cx = 0; cx < width / tw; cx++) {
        parts.push(attrAt(cx, cy).toString(16).toUpperCase().padStart(2, '0'));
      }
      lines.push(parts.join(' '));
    }
    lines.push('');
  }

  /**
   * Parse one ZXP image starting at the current line index (which must be
   * the identifier line). Advances the index past the attribute rows.
   * @returns {Object} { width, height, bits: Uint8Array(w*h), attrs:
   *                     Uint8Array(cells) } or { error }
   * @private
   */
  _parseZxpImage(lines, getI, setI, allowTransparent) {
    const { w: tw, h: th } = this._tileSize();
    let i = getI();
    while (i < lines.length && lines[i].trim() === '') i++;
    const ident = i < lines.length ? lines[i].trim() : '';
    if (ident === this.IDENTIFIER_EXT) {
      return { error: 'Unsupported screen format (extended 8×1 attributes)' };
    }
    if (ident !== this.IDENTIFIER) return { error: 'Missing ZXP identifier' };
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;

    // Bitmap rows: runs of 0/1/* ended by a blank line
    const rows = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const row = lines[i].trim();
      if (!/^[01*]+$/.test(row)) return { error: 'Invalid pixel definition(s)' };
      if (row.includes('*') && !allowTransparent) {
        return { error: 'Transparent pixels are not allowed here' };
      }
      if (rows.length && row.length !== rows[0].length) {
        return { error: 'Pixel width error' };
      }
      rows.push(row);
      i++;
    }
    if (!rows.length) return { error: 'Bad image content' };
    const width = rows[0].length, height = rows.length;
    if (width % tw !== 0 || height % th !== 0) return { error: 'Invalid picture size' };

    // Attribute rows: hex bytes, one row per cell row
    while (i < lines.length && lines[i].trim() === '') i++;
    const cellRows = height / th, cellCols = width / tw;
    const attrs = new Uint8Array(cellRows * cellCols);
    for (let cy = 0; cy < cellRows; cy++) {
      if (i >= lines.length) return { error: 'Invalid attribute definition(s)' };
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length !== cellCols) return { error: 'Invalid attribute definition(s)' };
      for (let cx = 0; cx < cellCols; cx++) {
        if (!/^[0-9a-fA-F]{1,2}$/.test(parts[cx])) {
          return { error: 'Invalid attribute definition(s)' };
        }
        attrs[cy * cellCols + cx] = parseInt(parts[cx], 16);
      }
      i++;
    }

    const bits = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        bits[y * width + x] = rows[y][x] === '1' ? 1 : 0; // '*' -> paper
      }
    }
    setI(i);
    return { width, height, bits, attrs };
  }

  /** Slice a parsed element image into per-cell tiles (row-major). @private */
  _sliceToTiles(img, tw, th) {
    const tiles = [];
    for (let cy = 0; cy < img.height / th; cy++) {
      for (let cx = 0; cx < img.width / tw; cx++) {
        const bitmap = new Uint8Array(th);
        for (let y = 0; y < th; y++) {
          let byte = 0;
          for (let x = 0; x < tw; x++) {
            if (img.bits[(cy * th + y) * img.width + cx * tw + x]) byte |= 0x80 >> x;
          }
          bitmap[y] = byte;
        }
        tiles.push({
          kind: MapCodec.TILE_KINDS.ULA_CELL,
          bitmap,
          attr: img.attrs[cy * (img.width / tw) + cx]
        });
      }
    }
    return tiles;
  }

  /**
   * Compose the imported elements + positions into our tileset/map document.
   * One-cell elements keep 1:1 file order (round-trip fidelity); multi-cell
   * elements are sliced with dedup.
   * @private
   */
  _composeDocument(elements, tw, th) {
    const cols = ACTIVE_SCREEN_MODE.width / tw;
    const rows = ACTIVE_SCREEN_MODE.height / th;
    const tiles = [];
    const findOrAdd = (tile, dedup) => {
      if (dedup) {
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i].attr === tile.attr &&
              tiles[i].bitmap.every((b, k) => b === tile.bitmap[k])) {
            return i;
          }
        }
      }
      tiles.push(tile);
      return tiles.length - 1;
    };

    // Assign tile indices, then compute the needed map extent
    const placements = []; // { mapX, mapY, tileIndex }
    let maxX = cols - 1, maxY = rows - 1;
    for (const el of elements) {
      const multi = el.tiles.length > 1;
      const indices = el.tiles.map(t => findOrAdd(t, multi));
      for (const pos of el.positions) {
        const cellX = Math.round(pos.x / tw);
        const cellY = Math.round(pos.y / th);
        for (let sy = 0; sy < el.cellsH; sy++) {
          for (let sx = 0; sx < el.cellsW; sx++) {
            const mx = cellX + sx, my = cellY + sy;
            if (mx >= MapCodec.MAX_DIM || my >= MapCodec.MAX_DIM) continue;
            placements.push({ mapX: mx, mapY: my, tileIndex: indices[sy * el.cellsW + sx] });
            if (mx > maxX) maxX = mx;
            if (my > maxY) maxY = my;
          }
        }
      }
    }

    const width = maxX + 1, height = maxY + 1;
    const cells = new Int16Array(width * height);
    cells.fill(-1);
    for (const p of placements) cells[p.mapY * width + p.mapX] = p.tileIndex;

    return {
      name: '',
      tileKind: MapCodec.TILE_KINDS.ULA_CELL,
      tiles,
      map: { width, height, cells }
    };
  }
}

// Create singleton
window.ZXMFormat = new ZXMFormatClass();

Logger.debug('ZXMFormat', 'ZXM format handler loaded');

})(); // End IIFE
