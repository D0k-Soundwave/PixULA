'use strict';
(function() {

/**
 * Text Tool
 *
 * Select a font and size from the options panel, type text, then move the
 * cursor over the canvas — a stamp preview follows the cursor.
 *
 * Left-click stamps ink; right-click erases ink.  The stamp stays active
 * (brush mode) until "Disengage Stamp" is clicked in the Transform panel.
 * Changing font, size, bold, or italic re-engages the stamp automatically.
 *
 * Full transform controls (scale, rotate, warp, flip) are available in the
 * Transform panel while the stamp is engaged.
 */
class TextToolClass extends ToolBase {
  /**
   * How glyphs are PLACED, before any rotation or mirroring. Adding one is a
   * row here plus a branch in `_buildTextMask`/`_rasterizeWithFont`; the
   * schema, the setter's validation and the i18n all read this list.
   */
  static LAYOUTS = [
    { id: 'horizontal',    i18n: 'opt.layout.horizontal' },
    { id: 'reversed',      i18n: 'opt.layout.reversed' },
    { id: 'vertical-down', i18n: 'opt.layout.verticalDown' },
    { id: 'vertical-up',   i18n: 'opt.layout.verticalUp' }
  ];

  /** True for the layouts that stack glyphs into a column. @private */
  static _isVertical(layout) {
    return layout === 'vertical-down' || layout === 'vertical-up';
  }

  /**
   * Declarative options - rendered by OptionControls (contract in tool-base.js).
   * fontFamily/textSize carry `dynamic` hooks: the renderer awaits the named
   * tool method to extend (fonts) or replace (clean sizes) the option list.
   */
  static optionsSchema = [
    // `preset: false` — the typed string is CONTENT, not a setting. A preset
    // restores how you were working, and nobody wants yesterday's caption back
    // along with their font and their outline settings.
    { type: 'textarea', key: 'textContent', setter: 'setText', i18n: 'opt.text',
      placeholderI18n: 'opt.textPlaceholder', rows: 3, value: '', preset: false },
    { type: 'select', key: 'fontFamily', setter: 'setFontFamily', i18n: 'opt.font', value: 'ZX ROM',
      options: [{ value: 'ZX ROM', label: 'ZX ROM (8\u00d78 bitmap)' }],
      dynamic: '_enumerateFonts' },
    { type: 'select', key: 'textSize', setter: 'setTextSize', i18n: 'opt.size', value: 16,
      options: [8, 16, 24, 32, 48, 64].map(s => ({ value: s, label: s + 'px' })),
      dynamic: 'getSizesForFont' },
    { type: 'check', key: 'fontBold',   i18n: 'opt.bold',   value: false },
    { type: 'check', key: 'fontItalic', i18n: 'opt.italic', value: false },
    // Layout PLACES the glyphs; direction TURNS the finished block. They are
    // separate controls because a quarter turn lays the letters on their
    // sides, which is not what "vertical text" means on a sign - and no
    // amount of rotating gets you a column of upright letters.
    { type: 'select', key: 'textLayout', i18n: 'opt.layout', value: 'horizontal',
      options: TextToolClass.LAYOUTS.map(l => ({ value: l.id, i18n: l.i18n })) },
    // Multiples of 90 are exact (MaskOps takes the transpose path); the
    // diagonals resample, so they are worth more pixels of text size.
    { type: 'select', key: 'textDirection', i18n: 'opt.direction', value: 0,
      options: [0, 45, 90, 135, 180, 225, 270, 315]
        .map(d => ({ value: d, label: d + '°' })) },
    { type: 'check', key: 'textMirrorH', i18n: 'opt.mirrorH', value: false },
    { type: 'check', key: 'textMirrorV', i18n: 'opt.mirrorV', value: false },
    { type: 'check', key: 'textShadow',  i18n: 'opt.shadow',  value: false },
    { type: 'check', key: 'textOutline', i18n: 'opt.outline', value: false },
    { type: 'hint', i18n: 'text.hint' }
  ];

  constructor() {
    super(TOOLS.TEXT, 'Text');
    this.cursor = 'crosshair';
    this._text            = '';
    this._fontFamily      = 'ZX ROM';
    this._fontSize        = 16;
    this._fontBold        = false;
    this._fontItalic      = false;
    this._textLayout      = 'horizontal';  // glyph placement (TextToolClass.LAYOUTS)
    this._textDirection   = 0;      // degrees clockwise; 90s exact, 45s resampled
    this._textMirrorH     = false;  // mirror left-right (MaskOps.flipH, exact)
    this._textMirrorV     = false;  // mirror top-bottom (MaskOps.flipV, exact)
    this._textShadow      = false;  // drop shadow (MaskOps offset-OR)
    this._textOutline     = false;  // hollow contour (MaskOps dilate-minus-glyph)
    this._fixedSize       = 16;   // px height; always > 0 (selected from dropdown)
    this._cachedFonts     = null;
    this._sizeCache       = new Map(); // fontFamily -> number[] of clean sizes
    this._textStampActive = false;
    this._disengaged      = false; // true after Disengage button; clears on settings change

    this.charBitmaps = this._createCharacterBitmaps();

    // Saved bitmap fonts feed the font list — drop the cache when the
    // font editor's library changes so the next open re-enumerates.
    EventBus.on(EVENTS.FONT_LIBRARY_CHANGED, () => { this._cachedFonts = null; });

    // Drive stamp cursor-following.  This event fires on every pointermove
    // (including hover, no button needed).
    EventBus.on(EVENTS.INPUT_POINTER_MOVE, (data) => {
      if (!window.ToolManager || ToolManager.getCurrentTool()?.id !== TOOLS.TEXT) return;
      if (!this._fixedSize || !this._text.trim()) return;
      if (this._disengaged) return;
      if (!window.SelectionService) return;
      if (this._ownStampFloating()) {
        this._textStampActive = true;
        SelectionService.moveStampPreview(data.x, data.y);
      } else {
        this._createPreviewStamp(data.x, data.y);
      }
    });
  }

  // ── Getters / setters ──────────────────────────────────────────────────────

  getText()        { return this._text; }
  setText(v)       { this._text = v || '';             this._disengaged = false; this._updatePreviewIfActive(); }

  getFontFamily()  { return this._fontFamily; }
  setFontFamily(v) { this._fontFamily = v || 'ZX ROM'; this._disengaged = false; this._updatePreviewIfActive(); }

  getFontSize()    { return this._fontSize; }
  setFontSize(v)   { this._fontSize = clamp(parseInt(v, 10) || 16, 4, 128); }

  getFontBold()    { return this._fontBold; }
  setFontBold(v)   { this._fontBold = !!v;              this._disengaged = false; this._updatePreviewIfActive(); }

  getFontItalic()  { return this._fontItalic; }
  setFontItalic(v) { this._fontItalic = !!v;             this._disengaged = false; this._updatePreviewIfActive(); }

  getTextSize()       { return this._fixedSize; }
  setTextSize(v)      { this._fixedSize = Math.max(1, parseInt(v, 10) || 16); this._disengaged = false; this._updatePreviewIfActive(); }

  getTextLayout()  { return this._textLayout; }
  setTextLayout(v) {
    this._textLayout = TextToolClass.LAYOUTS.some(l => l.id === v) ? v : 'horizontal';
    this._disengaged = false; this._updatePreviewIfActive();
  }

  getTextDirection()  { return this._textDirection; }
  setTextDirection(v) {
    // Snapped to the offered steps rather than clamped: an out-of-range value
    // from an older preset should fall back to upright, not to 315.
    const d = parseInt(v, 10) || 0;
    this._textDirection = (d % 45 === 0 && d >= 0 && d < 360) ? d : 0;
    this._disengaged = false; this._updatePreviewIfActive();
  }

  getTextMirrorH()    { return this._textMirrorH; }
  setTextMirrorH(v)   { this._textMirrorH = !!v; this._disengaged = false; this._updatePreviewIfActive(); }

  getTextMirrorV()    { return this._textMirrorV; }
  setTextMirrorV(v)   { this._textMirrorV = !!v; this._disengaged = false; this._updatePreviewIfActive(); }

  getTextShadow()     { return this._textShadow; }
  setTextShadow(v)    { this._textShadow = !!v;  this._disengaged = false; this._updatePreviewIfActive(); }

  getTextOutline()    { return this._textOutline; }
  setTextOutline(v)   { this._textOutline = !!v; this._disengaged = false; this._updatePreviewIfActive(); }

  /**
   * The effect/direction fields carried on fontInfo — SelectionService
   * re-applies them (via MaskOps.process) whenever it re-rasterizes the
   * stamp, so preview and commit stay WYSIWYG.
   * @private
   */
  _effectOpts() {
    return {
      // `layout` is not a MaskOps field - it is consumed by the rasterizers,
      // which is why SelectionService has to hand it back to them when it
      // re-rasterizes. It rides here because fontInfo is the one envelope
      // both halves of that round trip already agree on.
      layout:    this._textLayout,
      direction: this._textDirection,
      mirrorH:   this._textMirrorH,
      mirrorV:   this._textMirrorV,
      shadow:    this._textShadow,
      outline:   this._textOutline
    };
  }

  notifyDisengaged() { this._disengaged = true; this._textStampActive = false; }

  // ── Font enumeration ──────────────────────────────────────────────────────

  /**
   * Bitmap families rasterize from glyph bytes (no canvas): the built-in
   * 'ZX ROM' charset and Phase 10 font-editor library fonts, which ride
   * on the fontFamily value as 'zxfont:<library name>'.
   */
  isBitmapFont(family) {
    return family === 'ZX ROM' ||
           (typeof family === 'string' && family.startsWith('zxfont:'));
  }

  /** Saved-font select entries ({ value, label }). @private */
  _libraryFontOptions() {
    if (!window.FontService) return [];
    return FontService.listLibrary().map(name => {
      const font = FontService.getLibraryFont(name);
      return {
        value: 'zxfont:' + name,
        label: font ? `${name} (${font.width}×8)` : name
      };
    });
  }

  /**
   * The fontFamily select's `dynamic` hook. Its result REPLACES the schema
   * options (OptionControls contract), so every bitmap font must be in it.
   *
   * ALWAYS `FontProbe.detect()`, NEVER `window.queryLocalFonts()` and never
   * a server/companion call. That browser API used to be tried first and
   * preferred whenever it enumerated successfully, but it gates behind
   * Chrome's persistent Local Font Access permission dialog, and it turns
   * out to actually SHOW that dialog on `file://` (found 2026-08-23, from a
   * real screenshot: an uninvited "This file wants to use the fonts on your
   * computer" prompt on ANY reload that lands on the text tool - a prior
   * version of this comment claimed the permission "reads prompt but no
   * prompt is ever shown", measured 2026-08-07; that was wrong, or stopped
   * being true in a later Chrome). `FontProbe.detect()` finds real installed
   * fonts by canvas measurement, with zero permission of any kind, at the
   * cost of only finding families on its own candidate list - on this
   * machine it finds ~64 where the old hardcoded list named 16, several of
   * which were not even installed (measured 2026-08-07).
   *
   * Cached on `this` (invalidated by `EVENTS.FONT_LIBRARY_CHANGED`, since
   * `bitmapFonts` depends on the library) - `FontProbe` holds its own
   * internal cache too, but concatenating `bitmapFonts` + `detect()` on
   * every call is pointless work the select does not need repeated.
   */
  _enumerateFonts() {
    if (this._cachedFonts) return this._cachedFonts;

    const bitmapFonts = ['ZX ROM', ...this._libraryFontOptions()];
    const detected = window.FontProbe ? FontProbe.detect() : [];
    this._cachedFonts = [...bitmapFonts, ...(detected.length ? detected : ['sans-serif', 'serif', 'monospace'])];
    return this._cachedFonts;
  }

  // ── Canvas interaction ────────────────────────────────────────────────────

  onPointerDown(pixelX, pixelY, e) {
    // When the text tool's OWN stamp is the current stamp, pointer-down is
    // handled entirely by input-handler and this method is NOT called. We
    // reach here either with no stamp engaged, or with some OTHER tool's
    // stamp (e.g. a clipboard paste) still floating from before this tool
    // was selected — ToolManager.selectTool() moves the current layer off a
    // stamp on tool switch, so a foreign stamp no longer intercepts clicks.
    const text = this._text.trim();
    if (text && this._fixedSize > 0) {
      this._disengaged = false;
      if (window.SelectionService && !this._ownStampFloating()) {
        this._createPreviewStamp(pixelX, pixelY);
      }
    }
  }

  /**
   * True when the currently floating stamp (if any) is one THIS tool
   * created. `fontInfo` is set only by TextTool's own
   * `startFloatingPasteFromMask` calls — every other caller (clipboard
   * paste, system-clipboard image paste) leaves it null — so it is the
   * reliable "is this stamp mine" check, unlike a blanket
   * `SelectionService.isFloating()`, which is also true for a stamp left
   * floating by an entirely different tool.
   * @private
   */
  _ownStampFloating() {
    if (!window.SelectionService || !SelectionService.isFloating()) return false;
    const fp = SelectionService.floatingPaste;
    return !!(fp && fp.fontInfo);
  }

  onPointerMove(pixelX, pixelY, e) {
    // Cursor-following is handled by the INPUT_POINTER_MOVE EventBus listener.
  }

  onPointerUp(pixelX, pixelY, e) {
    // No drag-to-size mode; nothing to commit on pointer-up.
  }

  deactivate() {
    this._textStampActive = false;
    super.deactivate();
  }

  // ── Fixed-size preview ────────────────────────────────────────────────────

  _createPreviewStamp(x, y) {
    const text = this._text.trim();
    if (!text || !this._fixedSize) return;

    const result = this._rasterizeAtFixedSize(text, this._fixedSize);
    if (!result) return;

    const fontInfo = {
      text,
      fontFamily: this._fontFamily,
      fontSize:   this._fixedSize,
      bold:       this._fontBold,
      italic:     this._fontItalic,
      ...this._effectOpts(),
    };

    // Direction + shadow/contour as pure mask post-processing, BEFORE the
    // stamp is created — the floating preview is exactly the committed result.
    const pixels = window.MaskOps
      ? MaskOps.process(result.pixels, fontInfo)
      : result.pixels;
    const width  = pixels[0] ? pixels[0].length : result.width;
    const height = pixels.length;

    // Centre stamp on cursor position
    const px = x - Math.floor(width  / 2);
    const py = y - Math.floor(height / 2);

    if (window.SelectionService) {
      SelectionService.startFloatingPasteFromMask(
        pixels, width, height,
        px, py, 'Text', fontInfo, 'none'
      );
      this._textStampActive = true;
    }
  }

  // ── Live option preview ───────────────────────────────────────────────────

  _updatePreviewIfActive() {
    if (!this._textStampActive) return;
    if (!window.SelectionService || !SelectionService.isFloating()) {
      this._textStampActive = false;
      return;
    }

    const text = this._text.trim();
    if (!text) return;

    const fontInfo = {
      text,
      fontFamily: this._fontFamily,
      fontSize:   this._fixedSize > 0 ? this._fixedSize : 100,
      bold:       this._fontBold,
      italic:     this._fontItalic,
      ...this._effectOpts(),
    };

    let targetW = 0, targetH = 0;
    if (this._fixedSize > 0) {
      if (this.isBitmapFont(this._fontFamily)) {
        const src = this._buildTextMask(text, this._fontFamily);
        const scale = Math.max(1, Math.round(this._fixedSize / 8));
        if (src) {
          targetW = src.width * scale;
          targetH = src.height * scale;
        }
      } else {
        const src = this._rasterizeWithFont(text, this._fontFamily, this._fixedSize, this._fontBold, this._fontItalic);
        if (src) { targetW = src.width; targetH = src.height; }
      }
    }

    SelectionService.refreshTextStamp(fontInfo, null, targetW, targetH);
  }

  // ── Rasterization helpers ─────────────────────────────────────────────────

  _rasterizeAtFixedSize(text, targetHeight) {
    if (this.isBitmapFont(this._fontFamily)) {
      const src = this._buildTextMask(text, this._fontFamily);
      if (!src) return null;
      const scale = Math.max(1, Math.round(targetHeight / src.height));
      return this._scaleToFit(src.pixels, src.width, src.height,
        src.width * scale, src.height * scale);
    }
    return this._rasterizeWithFont(text, this._fontFamily, targetHeight, this._fontBold, this._fontItalic);
  }

  _scaleToFit(pixels, srcW, srcH, maxW, maxH) {
    if (!srcW || !srcH || !maxW || !maxH) return null;
    const scale = Math.min(maxW / srcW, maxH / srcH);
    if (scale <= 0) return null;
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));
    const out = [];
    for (let dy = 0; dy < dstH; dy++) {
      const sy = Math.min(Math.floor(dy / scale), srcH - 1);
      const row = [];
      for (let dx = 0; dx < dstW; dx++) {
        row.push(pixels[sy][Math.min(Math.floor(dx / scale), srcW - 1)]);
      }
      out.push(row);
    }
    return { pixels: out, width: dstW, height: dstH };
  }

  /**
   * Rasterize text from glyph bytes (no canvas) at 1× — the bitmap-font
   * path for both 'ZX ROM' and Phase 10 'zxfont:<name>' library fonts.
   * The advance width is the font's glyph width (8 for ZX ROM, 4/6/8 for
   * library fonts), so narrow Sinclair fonts keep their tight spacing.
   * Characters outside the font take no space, like unknown ZX ROM chars.
   * @param {string} text
   * @param {string} [family] - defaults to the tool's current family
   * @returns {{ pixels: boolean[][], width: number, height: number }|null}
   */
  _buildTextMask(text, family = this._fontFamily, bold = this._fontBold,
                 italic = this._fontItalic, layout = this._textLayout) {
    const charH = 8;
    let charW = 8;
    let glyphOf; // char -> row byte array (MSB = left), or null

    if (family === 'ZX ROM' || !family.startsWith('zxfont:')) {
      glyphOf = (c) => this.charBitmaps[c] || null;
    } else {
      const font = window.FontService
        ? FontService.getLibraryFont(family.slice('zxfont:'.length))
        : null;
      if (!font) return null;
      charW = font.width;
      glyphOf = (c) => {
        const i = c.charCodeAt(0) - font.firstCode;
        return i >= 0 && i < font.glyphs.length ? font.glyphs[i] : null;
      };
    }

    // The glyphs that will actually be drawn, in PLACEMENT order.
    const glyphs = [];
    for (let i = 0; i < text.length; i++) {
      const bitmap = glyphOf(text[i]);
      if (bitmap) glyphs.push(bitmap);
    }
    if (!glyphs.length) return null;
    // Both backwards layouts are the same operation on the ORDER of the
    // glyphs; the letterforms themselves are never touched, which is what
    // separates 'reversed' from a mirror.
    if (layout === 'reversed' || layout === 'vertical-up') glyphs.reverse();

    if (TextToolClass._isVertical(layout)) {
      return this._stackGlyphs(glyphs, charW, charH, bold, italic);
    }

    const totalWidth = glyphs.length * charW;
    const pixels = Array.from({ length: charH }, () => new Array(totalWidth).fill(false));
    let curX = 0;
    for (const bitmap of glyphs) {
      for (let row = 0; row < charH; row++) {
        for (let col = 0; col < charW; col++) {
          if ((bitmap[row] >> (7 - col)) & 1) pixels[row][curX + col] = true;
        }
      }
      curX += charW;
    }
    if (!bold && !italic) return { pixels, width: totalWidth, height: charH };
    return this._styleBitmapMask(pixels, totalWidth, charH, bold, italic);
  }

  /**
   * Stack glyph cells into a column, each letter upright and centred on the
   * widest.
   *
   * Styling happens PER GLYPH, before the stack is assembled, and that is not
   * an optimization - `_styleBitmapMask`'s italic shear is measured against
   * the mask's own height, so styling a 5-letter column as one 40px-tall mask
   * shears it by up to 13px and smears the whole thing into a diagonal streak
   * instead of slanting each letter by 2px. Pinned by tests/text-layout.test.js.
   *
   * @param {Array<Uint8Array|number[]>} glyphs - row bytes, MSB = left
   * @param {number} charW
   * @param {number} charH
   * @param {boolean} bold
   * @param {boolean} italic
   * @returns {{ pixels: boolean[][], width: number, height: number }}
   * @private
   */
  _stackGlyphs(glyphs, charW, charH, bold, italic) {
    const cells = glyphs.map((bitmap) => {
      const pixels = Array.from({ length: charH }, (_, row) =>
        Array.from({ length: charW }, (_, col) => !!((bitmap[row] >> (7 - col)) & 1)));
      return (bold || italic)
        ? this._styleBitmapMask(pixels, charW, charH, bold, italic)
        : { pixels, width: charW, height: charH };
    });

    const width = cells.reduce((w, c) => Math.max(w, c.width), 0);
    const out = [];
    for (const cell of cells) {
      const pad = Math.floor((width - cell.width) / 2);
      for (const row of cell.pixels) {
        const line = new Array(width).fill(false);
        for (let x = 0; x < cell.width; x++) if (row[x]) line[pad + x] = true;
        out.push(line);
      }
    }
    return { pixels: out, width, height: out.length };
  }

  /**
   * Faux bold/italic for the 1-bit bitmap-font path (ZX ROM + library fonts),
   * which has no real weight/style axis. Bold ORs each pixel with its left
   * neighbour (a 1-px rightward thickening); italic shears rows horizontally
   * (top rows lean right, up to +2 px) and widens the mask to avoid clipping.
   * Vector/system fonts get true weight/style from the canvas font string in
   * _rasterizeWithFont instead.
   * @private
   */
  _styleBitmapMask(pixels, w, h, bold, italic) {
    let grid = pixels, width = w;
    if (bold) {
      const out = Array.from({ length: h }, () => new Array(width).fill(false));
      for (let y = 0; y < h; y++)
        for (let x = 0; x < width; x++)
          out[y][x] = grid[y][x] || (x > 0 && grid[y][x - 1]);
      grid = out;
    }
    if (italic) {
      const shiftOf = (y) => Math.floor((h - 1 - y) / 3);   // 0..2 px, top leans right
      const newW = width + shiftOf(0);
      const out = Array.from({ length: h }, () => new Array(newW).fill(false));
      for (let y = 0; y < h; y++) {
        const s = shiftOf(y);
        for (let x = 0; x < width; x++) if (grid[y][x]) out[y][x + s] = true;
      }
      grid = out; width = newW;
    }
    return { pixels: grid, width, height: h };
  }

  _rasterizeWithFont(text, fontFamily, fontSize, bold = false, italic = false,
                     layout = this._textLayout) {
    if (TextToolClass._isVertical(layout)) {
      return this._stackRasterized(text, fontFamily, fontSize, bold, italic, layout);
    }
    if (layout === 'reversed') text = [...text].reverse().join('');

    const raw = this._rasterizeRaw(text, fontFamily, fontSize, bold, italic);
    if (!raw) return null;
    const trimmed = this._trimMask(raw);
    return trimmed;
  }

  /**
   * Rasterize a string to an UNTRIMMED mask. Split out of
   * `_rasterizeWithFont` because the vertical layouts need every character
   * measured against the same box: trimming each letter to its own ink first
   * would stack an 'o' and an 'A' at the same height and throw the baselines
   * away.
   *
   * Each output pixel is decided from the COVERAGE of an ss x ss block, not
   * from one alpha sample at its centre. That single sample is why this used
   * to lose stroke weight wherever a stroke is thinner than a pixel: measured
   * 2026-08-29, four bare stems ('IIII' at 16px) weighed 0.811 of a correct
   * render, and `ZX SPECTRUM` at 16px came apart into 19 connected pieces.
   * A mixed string hides it - 'Hamburgefonstiv' weighed 0.925, because its
   * bowls and crossbars are wide enough to survive a centre sample.
   *
   * `js/utils/font-rasterizer.js` reached the same conclusion for the Font
   * Editor in 2026-08-19; this is that fix, on the path that never got it.
   * Its threshold is 0.40 and this one is 0.30, and both are measured at their
   * own sizes - see `CoverageOps.GLYPH_COVERAGE`, which is deliberately NOT
   * the unbiased `INK_COVERAGE` a 1-bit source takes.
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
    // single threshold this whole function exists to defer. The alpha sum is
    // compared against a pre-multiplied cut rather than divided down first -
    // the same decision, one less division per pixel, and this inner loop runs
    // once per subsample of every stamp.
    const rowStride = w * ss;
    const cut = CoverageOps.GLYPH_COVERAGE * 255 * ss * ss;
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

  /** Ink bounds of a raw mask, or null where it drew nothing. @private */
  _inkBounds(raw) {
    let y0 = raw.height, y1 = -1, x0 = raw.width, x1 = -1;
    for (let ry = 0; ry < raw.height; ry++) for (let rx = 0; rx < raw.width; rx++) if (raw.pixels[ry][rx]) {
      if (rx < x0) x0 = rx; if (rx > x1) x1 = rx;
      if (ry < y0) y0 = ry; if (ry > y1) y1 = ry;
    }
    return y1 < 0 ? null : { x0, x1, y0, y1 };
  }

  /** Crop a raw mask to its ink. @private */
  _trimMask(raw) {
    const b = this._inkBounds(raw);
    if (!b) return null;
    return {
      pixels: raw.pixels.slice(b.y0, b.y1 + 1).map(row => row.slice(b.x0, b.x1 + 1)),
      width:  b.x1 - b.x0 + 1,
      height: b.y1 - b.y0 + 1,
    };
  }

  /**
   * Stack a system font's characters into a column of upright letters.
   *
   * Each character is rasterized on its own (canvas has no notion of vertical
   * text) and trimmed HORIZONTALLY only. The vertical band is the union of
   * every character's ink, applied to all of them, so descenders and
   * x-heights keep their real proportions instead of every letter being
   * squeezed to its own bounding box.
   * @returns {{ pixels: boolean[][], width: number, height: number }|null}
   * @private
   */
  _stackRasterized(text, fontFamily, fontSize, bold, italic, layout) {
    const chars = layout === 'vertical-up' ? [...text].reverse() : [...text];

    let bandTop = Infinity, bandBottom = -1;
    const cells = [];
    for (const ch of chars) {
      const raw = this._rasterizeRaw(ch, fontFamily, fontSize, bold, italic);
      const b = this._inkBounds(raw);
      if (!b) continue;                       // whitespace draws nothing
      if (b.y0 < bandTop)    bandTop = b.y0;
      if (b.y1 > bandBottom) bandBottom = b.y1;
      cells.push({ raw, x0: b.x0, x1: b.x1 });
    }
    if (!cells.length) return null;

    const width = cells.reduce((w, c) => Math.max(w, c.x1 - c.x0 + 1), 0);
    const out = [];
    for (const cell of cells) {
      const cw = cell.x1 - cell.x0 + 1;
      const pad = Math.floor((width - cw) / 2);
      for (let ry = bandTop; ry <= bandBottom; ry++) {
        const line = new Array(width).fill(false);
        for (let x = 0; x < cw; x++) if (cell.raw.pixels[ry][cell.x0 + x]) line[pad + x] = true;
        out.push(line);
      }
    }
    return { pixels: out, width, height: out.length };
  }

  // ── Font size quality scanning ─────────────────────────────────────────────

  /**
   * Return the sizes at which fontFamily renders cleanly as 1-bit pixel art.
   * Results are cached per family so repeated font switches are instant.
   * Returns a Promise so callers can await without blocking the UI.
   * Callable with no argument (defaults to the tool's current family) — the
   * OptionControls renderer invokes `dynamic` methods argument-free.
   * @param {string} [fontFamily]
   * @returns {Promise<number[]>}
   */
  async getSizesForFont(fontFamily = this._fontFamily) {
    if (this.isBitmapFont(fontFamily)) return [8, 16, 24, 32, 48, 64];
    if (this._sizeCache.has(fontFamily)) return this._sizeCache.get(fontFamily);
    const sizes = this._qualityScan(fontFamily);
    this._sizeCache.set(fontFamily, sizes);
    return sizes;
  }

  /**
   * Render a test string at each candidate size and score how binary the alpha
   * channel is. A font at its "native" size (bitmap or well-hinted vector) will
   * have mostly 0 or 255 alpha; a poorly-matched size will have many mid-values.
   * @param {string} fontFamily
   * @returns {number[]} ascending list of clean pixel sizes
   * @private
   */
  _qualityScan(fontFamily) {
    const CANDIDATES = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,24,26,28,32,36,40,48,56,64];
    const TEST = 'HOomeagn0123IXkpqy'; // wide mix: curves, stems, ascenders, descenders

    const scored = CANDIDATES.map(size => {
      const off = Helpers.createCanvas(1, 1);
      const ctx = off.getContext('2d');
      const fontStr = `${size}px "${fontFamily}"`;
      ctx.font = fontStr;
      const tw = Math.max(1, Math.ceil(ctx.measureText(TEST).width) + 2);
      const th = Math.max(1, size * 2);
      off.width = tw; off.height = th;
      ctx.font = fontStr;
      ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
      ctx.fillText(TEST, 1, 0);
      const data = ctx.getImageData(0, 0, tw, th).data;
      let ink = 0, sharp = 0;
      for (let i = 3; i < data.length; i += 4) {
        const a = data[i];
        if (a > 20) { ink++; if (a > 220) sharp++; }
      }
      return { size, score: ink > 10 ? sharp / ink : 0 };
    });

    Logger.debug('TextTool', `Size scan "${fontFamily}": ` +
      scored.map(s => `${s.size}:${Math.round(s.score * 100)}%`).join(' '));

    // Try progressively looser thresholds until we have ≥3 sizes
    for (const t of [0.90, 0.82, 0.74, 0.62]) {
      const pass = scored.filter(s => s.score >= t).map(s => s.size);
      if (pass.length >= 3) return pass;
    }

    // Absolute fallback: top 6 by score (never return the full unfiltered list)
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(s => s.size)
      .sort((a, b) => a - b);
  }

  getCharBitmap(char) { return this.charBitmaps[char] || null; }

  /**
   * Per-character lookup for the built-in 'ZX ROM' charset, derived from
   * the shared ZX_ROM_FONT table (js/data/zx-rom-font.js — the single
   * source of truth this tool's original inline table moved to; the
   * Phase 10 FontService loads the same bytes for its ROM reset).
   * @private
   */
  _createCharacterBitmaps() {
    const map = {};
    for (let i = 0; i < ZX_ROM_FONT_COUNT; i++) {
      map[String.fromCharCode(ZX_ROM_FONT_FIRST + i)] =
        Array.from(ZX_ROM_FONT.subarray(i * 8, (i + 1) * 8));
    }
    return map;
  }

}

window.TextTool = TextToolClass;

Logger.debug('TextTool', 'Text tool loaded');

})(); // End IIFE
