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

  /**
   * How multiple lines line up against each other.
   *
   * The value is CSS's `center`, not the British spelling used in the label -
   * it is an identifier, and every other alignment value in the codebase and
   * the platform reads this way.
   */
  static ALIGNMENTS = [
    { id: 'left',   i18n: 'opt.align.left' },
    { id: 'center', i18n: 'opt.align.center' },
    { id: 'right',  i18n: 'opt.align.right' }
  ];

  /** Which way the shadow falls, relative to the letters. Down-right is the original shadow. */
  static SHADOW_DIRS = [
    { id: 'down-right', i18n: 'opt.shadowDir.downRight' },
    { id: 'down-left',  i18n: 'opt.shadowDir.downLeft' },
    { id: 'up-right',   i18n: 'opt.shadowDir.upRight' },
    { id: 'up-left',    i18n: 'opt.shadowDir.upLeft' }
  ];

  /** How a shadow or contour is drawn: in the letters' own dot state (the original), or the opposite (ZX Paintbrush's). */
  static EFFECT_DOTS = [
    { id: 'same',     i18n: 'opt.effectDots.same' },
    { id: 'opposite', i18n: 'opt.effectDots.opposite' }
  ];

  /** Which point of the text block the click is: nine, Centre being where text has always landed. */
  static ANCHORS = [
    { id: 'top-left',     i18n: 'opt.anchor.topLeft' },
    { id: 'top',          i18n: 'opt.anchor.top' },
    { id: 'top-right',    i18n: 'opt.anchor.topRight' },
    { id: 'left',         i18n: 'opt.anchor.left' },
    { id: 'center',       i18n: 'opt.anchor.center' },
    { id: 'right',        i18n: 'opt.anchor.right' },
    { id: 'bottom-left',  i18n: 'opt.anchor.bottomLeft' },
    { id: 'bottom',       i18n: 'opt.anchor.bottom' },
    { id: 'bottom-right', i18n: 'opt.anchor.bottomRight' }
  ];

  /**
   * Split typed text into lines, tolerating any line ending.
   *
   * A newline used to reach the rasterisers as an ordinary character and be
   * silently DROPPED - `glyphOf` has no glyph for it, and canvas `fillText`
   * does not break lines - so everything typed came out as one line. Splitting
   * here, before either rasteriser runs, also means the `reversed` and
   * `vertical-up` reversals land per LINE, which is what they should do.
   *
   * A blank line is meaningful: it survives as an empty entry and the composer
   * still advances for it.
   * @param {string} text
   * @returns {string[]} always at least one entry
   * @private
   */
  static _splitLines(text) {
    return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  }

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
    // Type on canvas (Batch 10B): click the picture, type on it, Enter draws it. Bitmap fonts only.
    { type: 'check', key: 'typeOnCanvas', i18n: 'opt.typeOnCanvas', value: false, syncEvent: EVENTS.TOOL_OPTIONS },
    { type: 'hint', i18n: 'text.typeHint', showIf: { key: 'typeOnCanvas', equals: true } },
    { type: 'hint', i18n: 'text.typeBitmapOnly',
      showIf: { all: [ { key: 'typeOnCanvas', equals: true }, { bitmapFont: false } ] } },
    { type: 'range', key: 'charWidth', i18n: 'opt.charWidth', min: 1, max: 64, value: 8, unit: 'px',
      showIf: { all: [ { key: 'typeOnCanvas', equals: true }, { bitmapFont: true } ] } },
    { type: 'range', key: 'charHeight', i18n: 'opt.charHeight', min: 1, max: 64, value: 8, unit: 'px',
      showIf: { all: [ { key: 'typeOnCanvas', equals: true }, { bitmapFont: true } ] } },
    { type: 'range', key: 'charSpacing', i18n: 'opt.charSpacing', min: -8, max: 32, value: 0, unit: 'px',
      showIf: { all: [ { key: 'typeOnCanvas', equals: true }, { bitmapFont: true } ] } },
    { type: 'range', key: 'lineSpacing', i18n: 'opt.lineSpacing', min: -8, max: 32, value: 0, unit: 'px',
      showIf: { all: [ { key: 'typeOnCanvas', equals: true }, { bitmapFont: true } ] } },
    { type: 'textarea', key: 'textContent', setter: 'setText', i18n: 'opt.text',
      placeholderI18n: 'opt.textPlaceholder', rows: 3, value: '', preset: false,
      showIf: { key: 'typeOnCanvas', equals: false } },
    { type: 'select', key: 'fontFamily', setter: 'setFontFamily', i18n: 'opt.font', value: 'ZX ROM',
      options: [{ value: 'ZX ROM', i18n: 'opt.font.zxRom', label: 'ZX ROM (8\u00d78 bitmap)' }],
      dynamic: '_enumerateFonts' },
    { type: 'select', key: 'textSize', setter: 'setTextSize', i18n: 'opt.size', value: 16,
      showIf: { key: 'typeOnCanvas', equals: false },
      options: [8, 16, 24, 32, 48, 64].map(s => ({ value: s, label: s + 'px' })),
      dynamic: 'getSizesForFont' },
    { type: 'check', key: 'fontBold',   i18n: 'opt.bold',   value: false },
    { type: 'check', key: 'fontItalic', i18n: 'opt.italic', value: false },
    // Layout PLACES the glyphs; direction TURNS the finished block. They are
    // separate controls because a quarter turn lays the letters on their
    // sides, which is not what "vertical text" means on a sign - and no
    // amount of rotating gets you a column of upright letters.
    { type: 'select', key: 'textLayout', i18n: 'opt.layout', value: 'horizontal',
      showIf: { key: 'typeOnCanvas', equals: false },
      options: TextToolClass.LAYOUTS.map(l => ({ value: l.id, i18n: l.i18n })) },
    // Alignment moves a line along the axis it RUNS on, so under the two
    // column layouts these read as top/middle/bottom.
    { type: 'select', key: 'textAlign', i18n: 'opt.align', value: 'left',
      options: TextToolClass.ALIGNMENTS.map(a => ({ value: a.id, i18n: a.i18n })) },
    // Which point of the finished text block the click is. Centre is where text has always landed; it is separate from
    // Alignment, which only lines the lines up inside the block.
    { type: 'select', key: 'textAnchor', i18n: 'opt.anchor', value: 'center',
      showIf: { key: 'typeOnCanvas', equals: false },
      options: TextToolClass.ANCHORS.map(a => ({ value: a.id, i18n: a.i18n })) },
    // Multiples of 90 are exact (MaskOps takes the transpose path); the
    // diagonals resample, so they are worth more pixels of text size.
    { type: 'select', key: 'textDirection', i18n: 'opt.direction', value: 0,
      options: [0, 45, 90, 135, 180, 225, 270, 315]
        .map(d => ({ value: d, label: d + '°' })) },
    { type: 'check', key: 'textMirrorH', i18n: 'opt.mirrorH', value: false },
    { type: 'check', key: 'textMirrorV', i18n: 'opt.mirrorV', value: false },
    { type: 'check', key: 'textShadow',  i18n: 'opt.shadow',  value: false },
    // Which way the shadow falls, relative to the letters (it turns with Direction). Down-right is the original shadow.
    { type: 'select', key: 'textShadowDir', i18n: 'opt.shadowDir', value: 'down-right',
      showIf: { key: 'textShadow', equals: true },
      options: TextToolClass.SHADOW_DIRS.map(d => ({ value: d.id, i18n: d.i18n })) },
    // ZX Paintbrush draws shading and contour in the OPPOSITE dot state to the letters (a white shade behind black text).
    // Same dots is PixULA's original behaviour. Each effect has its own switch.
    { type: 'select', key: 'textShadowDots', i18n: 'opt.shadowDots', value: 'same',
      showIf: { key: 'textShadow', equals: true }, options: TextToolClass.EFFECT_DOTS.map(d => ({ value: d.id, i18n: d.i18n })) },
    { type: 'check', key: 'textOutline', i18n: 'opt.outline', value: false },
    { type: 'select', key: 'textOutlineDots', i18n: 'opt.outlineDots', value: 'same',
      showIf: { key: 'textOutline', equals: true }, options: TextToolClass.EFFECT_DOTS.map(d => ({ value: d.id, i18n: d.i18n })) },
    // The opposite dots are written like Clear background: the opposite of the draw mode in force, nothing in the modes
    // that have no opposite (XOR, Ink only, Paper only) - say so there instead of silently drawing nothing.
    { type: 'hint', i18n: 'transform.clearDots.noEffectHint',
      showIf: { all: [ { any: [ { all: [ { key: 'textShadow', equals: true }, { key: 'textShadowDots', equals: 'opposite' } ] },
                                { all: [ { key: 'textOutline', equals: true }, { key: 'textOutlineDots', equals: 'opposite' } ] } ] },
                       { clearDotsNoEffect: true } ] } },
    // Clear background = the stamp's Clear dots (Transform panel): the box's clear dots are written as well as the
    // letters, so the text sits on a cleared patch. Inverse gives reset-dot text in the same way.
    { type: 'select', key: 'textBackground', i18n: 'opt.textBackground', value: 'transparent',
      syncEvent: EVENTS.STAMP_OPTIONS_CHANGED,
      options: [{ value: 'transparent', i18n: 'transform.clearDots.transparent' },
                { value: 'overlap', i18n: 'transform.clearDots.overlap' }] },
    { type: 'hint', i18n: 'transform.clearDots.noEffectHint',
      showIf: { all: [ { key: 'textBackground', equals: 'overlap' }, { clearDotsNoEffect: true } ] } },
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
    this._textAlign       = 'left';        // how multiple lines line up (ALIGNMENTS)
    this._textDirection   = 0;      // degrees clockwise; 90s exact, 45s resampled
    this._textMirrorH     = false;  // mirror left-right (MaskOps.flipH, exact)
    this._textMirrorV     = false;  // mirror top-bottom (MaskOps.flipV, exact)
    this._textShadow      = false;  // drop shadow (MaskOps offset-OR)
    this._textShadowDots  = 'same';         // 'same' | 'opposite' (EFFECT_DOTS)
    this._textOutlineDots = 'same';
    this._textShadowDir   = 'down-right';   // which way it falls (TextToolClass.SHADOW_DIRS)
    this._textAnchor      = 'center';       // which point of the block the click is (ANCHORS)
    this._textOutline     = false;  // hollow contour (MaskOps dilate-minus-glyph)
    this._typeOnCanvas    = false;  // Type on canvas (Batch 10B)
    this._charW           = 8;      // typed text: character cell width and height in picture pixels
    this._charH           = 8;
    this._charSpacing     = 0;
    this._lineSpacing     = 0;
    // (a quiet stand-in where the typing module is not loaded, as in tests of other things)
    this._typing          = window.TextTyping ? new TextTyping(this) : { active: false, preview() {}, cancel() {}, commit() { return true; } };
    this._fontH0          = 8;           // cell height of the font the character size was set for (keeps the zoom on a font change)
    this._textBackground  = 'transparent';  // 'overlap' = Clear background: the box's clear dots are written too
    this._fixedSize       = 16;   // px height; always > 0 (selected from dropdown)
    this._cachedFonts     = null;
    this._sizeCache       = new Map(); // fontFamily -> number[] of clean sizes
    this._textStampActive = false;
    this._disengaged      = false; // true after Disengage button; clears on settings change

    this.charBitmaps = this._createCharacterBitmaps();

    // Saved bitmap fonts feed the font list — drop the cache when the
    // font editor's library changes so the next open re-enumerates.
    EventBus.on(EVENTS.FONT_LIBRARY_CHANGED, () => { this._cachedFonts = null; });

    // Type on canvas: the hidden text field (canvas-text-entry.js) reports what it holds; the picture it would leave is
    // redrawn whenever something it depends on changes.
    EventBus.on(EVENTS.TEXT_ENTRY_CHANGED, (d) => this._onEntryChanged(d));
    EventBus.on(EVENTS.TEXT_ENTRY_COMMIT, () => this._onEntryCommit());
    EventBus.on(EVENTS.TEXT_ENTRY_CANCEL, () => this.cancelPending());
    EventBus.on(EVENTS.TEXT_ENTRY_NEWLINE, () => this._typeNewline());
    const redrawTyping = () => { if (this._typing.active) this._typing.preview(); };
    for (const name of ['COLOR_INK', 'COLOR_PAPER', 'COLOR_BRIGHT', 'COLOR_FLASH', 'PALETTE_CHANGED', 'PALETTE_SLOT_CHANGED',
      'DRAW_MODE_CHANGED', 'INVERSE_CHANGED', 'SYMMETRY_CHANGED', 'CLIP_CHANGED', 'LAYER_SELECTED', 'LAYER_VISIBILITY',
      'HISTORY_UNDO', 'HISTORY_REDO', 'CANVAS_ZOOM', 'SCREEN_MODE_CHANGED']) {
      if (EVENTS[name]) EventBus.on(EVENTS[name], redrawTyping);
    }
    for (const name of ['FILE_NEW', 'FILE_OPEN']) {
      if (EVENTS[name]) EventBus.on(EVENTS[name], () => { if (this._typing.active) this.cancelPending(); });
    }

    // The Transform panel's Clear dots changes the very same setting of the waiting stamp: follow it, so the two controls
    // never disagree. (Only for the stamp this tool made - fontInfo is set by no one else.)
    EventBus.on(EVENTS.STAMP_OPTIONS_CHANGED, () => {
      const fp = window.SelectionService ? SelectionService.floatingPaste : null;
      if (!fp || !fp.fontInfo) return;
      const v = SelectionService.stampOptions(fp).clearDots;
      if (v !== this._textBackground) this._textBackground = v;
    });

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
  setFontFamily(v) {
    this._fontFamily = v || 'ZX ROM';
    this._disengaged = false;
    // Keep the zoom: the character size is a multiple of the font's own cell, so a switch to a font of another height carries the
    // same multiple (ZX ROM stretched to 16 high is 2x; a 16 high font then comes up 32 high). A font with other-width glyphs keeps
    // the letters' proportions: width follows height * w0 / h0.
    const g = this._glyphSource();
    if (g) {
      const zoom = this._charH / (this._fontH0 || 8);
      this._charH = Helpers.clamp(Math.round(zoom * g.h0), 1, 64);
      this._charW = Helpers.clamp(Math.round(g.w0 * this._charH / g.h0), 1, 64);
    }
    this._fontH0 = g ? g.h0 : 8;
    this._updatePreviewIfActive();
  }

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

  getTextAlign()  { return this._textAlign; }
  setTextAlign(v) {
    this._textAlign = TextToolClass.ALIGNMENTS.some(a => a.id === v) ? v : 'left';
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

  getTextShadowDots()  { return this._textShadowDots; }
  setTextShadowDots(v) {
    if (!TextToolClass.EFFECT_DOTS.some(d => d.id === v)) return;
    this._textShadowDots = v;  this._disengaged = false;  this._updatePreviewIfActive();
  }

  getTextOutlineDots()  { return this._textOutlineDots; }
  setTextOutlineDots(v) {
    if (!TextToolClass.EFFECT_DOTS.some(d => d.id === v)) return;
    this._textOutlineDots = v;  this._disengaged = false;  this._updatePreviewIfActive();
  }

  getTextShadowDir()  { return this._textShadowDir; }
  setTextShadowDir(v) {
    if (!TextToolClass.SHADOW_DIRS.some(d => d.id === v)) return;
    this._textShadowDir = v;  this._disengaged = false;  this._updatePreviewIfActive();
  }

  // ── Type on canvas (Batch 10B) ────────────────────────────────────────────

  getTypeOnCanvas() { return this._typeOnCanvas; }
  /** Turning it on needs a bitmap font and takes the tool's own waiting stamp away; turning it off draws what is typed. */
  setTypeOnCanvas(v) {
    const on = !!v;
    if (on === this._typeOnCanvas) return;
    if (on) {
      if (!this.isBitmapFont(this._fontFamily)) {
        EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('text.typeBitmapOnly',
          'Type on canvas needs a bitmap font (ZX ROM or a saved font).') });
        EventBus.emit(EVENTS.TOOL_OPTIONS);
        return;
      }
      if (this._ownStampFloating()) SelectionService.cancelFloatingPaste();
      this._textStampActive = false;
      this._typeOnCanvas = true;
    } else {
      this.commitPending();
      this._typeOnCanvas = false;
    }
    this._disengaged = false;
  }

  getCharWidth()  { return this._charW; }
  setCharWidth(v)  { this._charW = Helpers.clamp(Math.round(Number(v)) || 1, 1, 64); this._updatePreviewIfActive(); }
  getCharHeight() { return this._charH; }
  setCharHeight(v) { this._charH = Helpers.clamp(Math.round(Number(v)) || 1, 1, 64); this._updatePreviewIfActive(); }
  getCharSpacing() { return this._charSpacing; }
  setCharSpacing(v) { const n = Math.round(Number(v)); this._charSpacing = Helpers.clamp(Number.isFinite(n) ? n : 0, -8, 32); this._updatePreviewIfActive(); }
  getLineSpacing() { return this._lineSpacing; }
  setLineSpacing(v) { const n = Math.round(Number(v)); this._lineSpacing = Helpers.clamp(Number.isFinite(n) ? n : 0, -8, 32); this._updatePreviewIfActive(); }

  /**
   * The glyph source of a bitmap font family: { glyphOf(char) -> row bytes | null, spanOf, fw, w0, h0, proportional }, or null
   * (ZX ROM has full 8 x 8 cells; a library font brings its own size and, if it has shading, its letters' saved widths).
   * @private
   */
  _glyphSourceFor(family) {
    if (family === 'ZX ROM') {
      return { glyphOf: (c) => this.charBitmaps[c] || null, spanOf: null, fw: 8, w0: 8, h0: 8, proportional: false };
    }
    if (!String(family).startsWith('zxfont:')) return null;
    const font = window.FontService ? FontService.getLibraryFont(family.slice('zxfont:'.length)) : null;
    return font ? BitmapText.fontSource(font) : null;
  }

  /** The glyph source of the current bitmap font. @private */
  _glyphSource() {
    return this._glyphSourceFor(this._fontFamily);
  }

  /** Everything BitmapText.layout needs for the text being typed. @private */
  _typeLayoutOptions() {
    const g = this._glyphSource() || { glyphOf: () => null, w0: 8, h0: 8 };
    return {
      glyphOf: g.glyphOf, spanOf: g.spanOf || null, fw: g.fw || g.w0, w0: g.w0, h0: g.h0, W: this._charW, H: this._charH, sx: this._charSpacing, sy: this._lineSpacing,
      align: this._textAlign, bold: this._fontBold, italic: this._fontItalic,
      style: (p, w, h, b, i) => this._styleBitmapMask(p, w, h, b, i)
    };
  }

  /** Whether a typing session is open. */
  get hasPending() { return !!(this._typing && this._typing.active); }

  /** The pointer is not pre-rounded to the snap step while typing: the tool floors the press itself. */
  get snapsPointer() { return !this._typeOnCanvas; }

  /** Open a typing session at a picture point (the press, dropped to the snap cell when Snap is on). @private */
  _startTyping(x, y) {
    if (window.StateManager && StateManager.getGridSnap()) {
      const st = StateManager.getGridSnapSize();
      x = SnapGrid.floor(x, st.w);
      y = SnapGrid.floor(y, st.h);
    }
    this._typing.open(x, y);
    EventBus.emit(EVENTS.TEXT_ENTRY_OPEN, { text: '', caret: 0, x, y, refocus: true });
    this._typing.preview();
  }

  /** The text field changed. @private */
  _onEntryChanged(d) {
    if (!this._typing.active || !d) return;
    const g = this._glyphSource();
    let text = d.text, caret = d.caret;
    if (g) {
      const f = BitmapText.filterTyped(text, g.glyphOf);
      if (f.text !== text) {
        // characters the font cannot draw are refused, and the person is told which
        caret = Helpers.clamp(caret - (text.length - f.text.length), 0, f.text.length);
        text = f.text;
        EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('text.noGlyph',
          'This font has no {char}.', { char: f.refused.join(' ') }) });
        EventBus.emit(EVENTS.TEXT_ENTRY_OPEN, { text, caret, x: this._typing.x, y: this._typing.y, refocus: false });
      }
    }
    this._typing.setBuffer(text, caret);
    this._typing.preview();
  }

  /** Enter in the text field, or the Draw button. @private */
  _onEntryCommit() {
    if (!this._typing.active) return;
    this.commitPending();
  }

  /** The New line button. @private */
  _typeNewline() {
    if (!this._typing.active) return;
    this._typing.insert('\n');
    EventBus.emit(EVENTS.TEXT_ENTRY_OPEN, { text: this._typing.text, caret: this._typing.caret, x: this._typing.x, y: this._typing.y, refocus: true });
    this._typing.preview();
  }

  /** Draw what is typed (save, tool switch, click elsewhere, Draw). A session that cannot be drawn says why and stays open. */
  commitPending() {
    if (!this._typing.active) return;
    if (this._typing.commit()) {
      EventBus.emit(EVENTS.TEXT_ENTRY_CLOSE);
    } else {
      EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('text.cannotDraw',
        'There is no unlocked drawing layer to draw the text on.') });
    }
  }

  /** Escape / Cancel: throw the typed text away. */
  cancelPending() {
    if (!this._typing.active) return;
    this._typing.cancel();
    EventBus.emit(EVENTS.TEXT_ENTRY_CLOSE);
  }

  /** The keys the tool may claim when the text field does not hold the keyboard (it is the fallback: the field handles them itself). */
  handleKey(key) {
    if (!this._typing.active) return false;
    if (key === 'Enter') { this.commitPending(); return true; }
    if (key === 'Backspace') { this.undoPending(); return true; }
    return false;
  }

  /** Edit > Undo while typing and the field is not focused: take back the last character. */
  undoPending() {
    if (!this._typing.active) return false;
    this._typing.backspace();
    if (!this._typing.text) { this.cancelPending(); return true; }
    EventBus.emit(EVENTS.TEXT_ENTRY_OPEN, { text: this._typing.text, caret: this._typing.caret, x: this._typing.x, y: this._typing.y, refocus: false });
    this._typing.preview();
    return true;
  }

  /** Cursor keys while the field is not focused: move the whole text. */
  nudgePending(dx, dy) {
    if (!this._typing.active) return false;
    this._typing.nudge(dx, dy);
    this._typing.preview();
    return true;
  }

  getTextBackground() { return this._textBackground; }
  /** 'transparent' (Leave background) | 'overlap' (Clear background). Patches the waiting stamp, no undo entry. */
  setTextBackground(v) {
    if (v !== 'transparent' && v !== 'overlap') return;
    this._textBackground = v;
    this._disengaged = false;
    if (this._textStampActive && this._ownStampFloating()) {
      SelectionService.refreshTextStamp(null, null, 0, 0, { clearDots: v });
    }
  }

  /** The settings a new text stamp starts with: null unless Clear background is on. @private */
  _stampOpts() {
    return this._textBackground === 'overlap' ? { clearDots: 'overlap' } : null;
  }

  getTextAnchor()     { return this._textAnchor; }
  setTextAnchor(v) {
    if (!TextToolClass.ANCHORS.some(a => a.id === v)) return;
    this._textAnchor = v;  this._disengaged = false;  this._updatePreviewIfActive();
  }

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
      // `align` rides here for exactly the reason `layout` does: it is
      // consumed by the rasterisers, so SelectionService has to hand it back
      // to them on every re-raster or a scaled stamp silently re-flows to the
      // default.
      align:     this._textAlign,
      direction: this._textDirection,
      mirrorH:   this._textMirrorH,
      mirrorV:   this._textMirrorV,
      shadow:    this._textShadow,
      shadowDir: this._textShadowDir,
      shadowDots: this._textShadowDots,
      outlineDots: this._textOutlineDots,
      // Where the click sits in the finished block: SelectionService keeps it when the stamp is re-rendered or moved.
      anchor:    this._textAnchor,
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

  /** Saved-font select entries ({ value, label }): "Name (16x16)" or "Name (16x16, proportional)". @private */
  _libraryFontOptions() {
    if (!window.FontService) return [];
    return FontService.listLibrary().map(name => {
      const font = FontService.getLibraryFont(name);
      if (!font) return { value: 'zxfont:' + name, label: name };
      const h = font.height === undefined ? 8 : font.height;
      const prop = BitmapText.fontSource(font).proportional;
      return {
        value: 'zxfont:' + name,
        label: Helpers.localizedMessage(prop ? 'text.fontLabelProportional' : 'text.fontLabel',
          prop ? '{name} ({w}x{h}, proportional)' : '{name} ({w}x{h})', { name, w: font.width, h })
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
    if (this._typeOnCanvas) {
      if (e && e.button === 2) { this.cancelPending(); return; }
      // A press on the text already typed moves the caret to it; a press anywhere else draws the text and starts a new one.
      if (this._typing.active) {
        const slot = this._typing.slotAt(pixelX, pixelY);
        if (slot !== null) {
          this._typing.caret = slot;
          EventBus.emit(EVENTS.TEXT_ENTRY_OPEN, { text: this._typing.text, caret: slot, x: this._typing.x, y: this._typing.y, refocus: true });
          this._typing.preview();
          return;
        }
        if (!this._typing.commit()) {
          EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('text.cannotDraw',
            'There is no unlocked drawing layer to draw the text on.') });
          return;
        }
        EventBus.emit(EVENTS.TEXT_ENTRY_CLOSE);
      }
      this._startTyping(pixelX, pixelY);
      return;
    }
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
    // Typed text is drawn when you leave the tool (as a waiting figure is), not lost
    if (this._typing && this._typing.active) this.commitPending();
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
    const layers = window.MaskOps ? MaskOps.processLayers(result.pixels, fontInfo) : { pixels: result.pixels, clearMask: null };
    const pixels = layers.pixels;
    const width  = pixels[0] ? pixels[0].length : result.width;
    const height = pixels.length;

    // Put the anchor point of the finished block on the cursor (Centre = the old centring)
    const a = window.MaskOps ? MaskOps.anchorOffset(this._textAnchor, width, height)
      : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const px = x - a.x;
    const py = y - a.y;

    if (window.SelectionService) {
      SelectionService.startFloatingPasteFromMask(
        pixels, width, height,
        px, py, 'Text', fontInfo, 'none', this._stampOpts(), { w: result.width, h: result.height }, layers.clearMask
      );
      this._textStampActive = true;
    }
  }

  // ── Live option preview ───────────────────────────────────────────────────

  _updatePreviewIfActive() {
    if (this._typing && this._typing.active) { this._typing.preview(); return; }
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
        const scale = Math.max(1, Math.round(this._fixedSize / this._fontCellHeight(this._fontFamily)));
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
      // The Size is a multiple of the font's own cell height - NOT of the block's height, which grows with every extra line (or
      // letter, in a column): that made two-line and vertical text land at half size and jump when any option changed.
      const scale = Math.max(1, Math.round(targetHeight / this._fontCellHeight(this._fontFamily)));
      return this._scaleToFit(src.pixels, src.width, src.height,
        src.width * scale, src.height * scale);
    }
    return this._rasterizeWithFont(text, this._fontFamily, targetHeight, this._fontBold, this._fontItalic);
  }

  /** Height of one cell of a bitmap font (8 for ZX ROM and the classic sizes). @private */
  _fontCellHeight(family) {
    const g = this._glyphSourceFor(family);
    return g ? g.h0 : 8;
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
   * Compose per-line masks into one block.
   *
   * Lines run PERPENDICULAR to the glyph run: a horizontal layout stacks them
   * down the page, and the column layouts (whose glyph run is already
   * vertical) place each line as a further column across. Either way they are
   * composed in reading order - first line top, or leftmost - because
   * `reversed`/`vertical-up` reverse glyphs WITHIN a line, and reversing the
   * line order too would put line 1 at the bottom, which is not what those
   * controls mean.
   *
   * `align` moves each line along the axis it runs on, so in the column
   * layouts left/centre/right read as top/middle/bottom.
   *
   * @param {Array<Object|null>} masks - one per line; null where the line drew
   *   nothing, which still advances
   * @param {boolean} vertical - true when lines stack across rather than down
   * @param {string} align - 'left' | 'center' | 'right'
   * @param {number} advance - the pitch from one line to the next
   * @returns {{pixels: boolean[][], width: number, height: number}|null}
   * @private
   */
  _composeLines(masks, vertical, align, advance) {
    // `cross` is the axis a line runs along, the one `align` moves it on;
    // `along` is the stacking axis.
    const cross = (m) => (vertical ? m.height : m.width);
    const along = (m) => (vertical ? m.width  : m.height);

    const at = [];
    let p = 0, crossMax = 0, total = 0;
    for (const m of masks) {
      at.push(p);
      if (m) {
        if (cross(m) > crossMax) crossMax = cross(m);
        // The block ends where the LAST line ends, not at n advances: a vector
        // line box is taller than its advance, so multiplying the advance out
        // would clip the final line's descenders.
        if (p + along(m) > total) total = p + along(m);
      }
      p += advance;
    }
    if (!crossMax || total <= 0) return null;

    const width  = vertical ? total : crossMax;
    const height = vertical ? crossMax : total;
    const pixels = Array.from({ length: height }, () => new Array(width).fill(false));

    for (let i = 0; i < masks.length; i++) {
      const m = masks[i];
      if (!m) continue;
      const slack = crossMax - cross(m);
      const off = align === 'center' ? Math.floor(slack / 2)
                : align === 'right'  ? slack
                : 0;
      for (let y = 0; y < m.height; y++) {
        const row = m.pixels[y];
        for (let x = 0; x < m.width; x++) {
          if (!row[x]) continue;
          const px = vertical ? at[i] + x : off + x;
          const py = vertical ? off + y   : at[i] + y;
          if (py >= 0 && py < height && px >= 0 && px < width) pixels[py][px] = true;
        }
      }
    }
    return { pixels, width, height };
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
                 italic = this._fontItalic, layout = this._textLayout,
                 align = this._textAlign) {
    const src = (family === 'ZX ROM' || !family.startsWith('zxfont:'))
      ? this._glyphSourceFor('ZX ROM')
      : this._glyphSourceFor(family);
    if (!src) return null;
    const charH = src.h0;
    const charW = src.w0;

    const vertical = TextToolClass._isVertical(layout);
    const masks = TextToolClass._splitLines(text)
      .map((line) => this._buildLineMask(line, src, bold, italic, layout));

    // Rows advance by the cell height exactly - ZX ROM cells already carry
    // their own spacing, and this is how the Spectrum stacks its text rows.
    // Columns advance by a uniform pitch so they read as a grid and a blank
    // line still leaves a gap.
    const pitch = vertical
      ? (masks.reduce((w, m) => Math.max(w, m ? m.width : 0), 0) || charW)
      : charH;
    return this._composeLines(masks, vertical, align, pitch);
  }

  /**
   * One line of glyph-byte text. This is the whole of what `_buildTextMask`
   * used to be, reused per line rather than reimplemented.
   * @returns {{pixels: boolean[][], width: number, height: number}|null}
   *   null when the line has no drawable glyph
   * @private
   */
  _buildLineMask(text, src, bold, italic, layout) {
    // Both backwards layouts are the same operation on the ORDER of the glyphs; the letterforms themselves are never touched,
    // which is what separates 'reversed' from a mirror.
    const reverse = layout === 'reversed' || layout === 'vertical-up';
    if (TextToolClass._isVertical(layout)) {
      // the glyphs that will actually be drawn, in PLACEMENT order
      const recs = [];
      for (let i = 0; i < text.length; i++) {
        const g = src.glyphOf(text[i]);
        if (!g) continue;
        const sp = (src.spanOf && src.spanOf(text[i])) || { x0: 0, w: src.w0 };
        recs.push({ g, x0: sp.x0, w: sp.w });
      }
      if (!recs.length) return null;
      if (reverse) recs.reverse();
      return this._stackGlyphs(recs, src.fw || src.w0, src.h0, bold, italic);
    }
    const native = BitmapText.nativeLine(text, {
      glyphOf: src.glyphOf, spanOf: src.spanOf, fw: src.fw || src.w0, w0: src.w0, h0: src.h0, reverse,
      bold, italic, style: (p, w, h, b, it) => this._styleBitmapMask(p, w, h, b, it)
    });
    return native ? { pixels: native.pixels, width: native.width, height: native.height } : null;
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
   * @param {Array<{g: Uint8Array, x0: number, w: number}>} recs - glyph bytes and the saved span of each letter
   * @param {number} fw - row width of the glyph bytes
   * @param {number} charH
   * @param {boolean} bold
   * @param {boolean} italic
   * @returns {{ pixels: boolean[][], width: number, height: number }}
   * @private
   */
  _stackGlyphs(recs, fw, charH, bold, italic) {
    const cells = recs.map((r) => {
      const pixels = Array.from({ length: charH }, (_, row) =>
        Array.from({ length: r.w }, (_, col) => !!BitmapText.bit(r.g, fw, r.x0 + col, row)));
      return (bold || italic)
        ? this._styleBitmapMask(pixels, r.w, charH, bold, italic)
        : { pixels, width: r.w, height: charH };
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
                     layout = this._textLayout, align = this._textAlign) {
    const lines = TextToolClass._splitLines(text);

    if (TextToolClass._isVertical(layout)) {
      const cols = lines.map((line) =>
        this._stackRasterized(line, fontFamily, fontSize, bold, italic, layout));
      const pitch = cols.reduce((w, c) => Math.max(w, c ? c.width : 0), 0);
      return pitch ? this._composeLines(cols, true, align, pitch) : null;
    }

    // Compose the lines UNTRIMMED, then trim the block once.
    //
    // `_rasterizeRaw` draws every line from the same `textBaseline: 'top'`
    // origin, so raw masks already share a vertical datum and stack with their
    // baselines aligned. Trimming each line to its own ink first would throw
    // that datum away - a line of all-x-height letters would ride up to meet
    // one with ascenders. It is the same rule `_stackRasterized` follows when
    // it bands its glyphs before trimming.
    const raws = lines.map((line) => this._rasterizeRaw(
      layout === 'reversed' ? [...line].reverse().join('') : line,
      fontFamily, fontSize, bold, italic));

    // 1.2em is the usual `normal` line-height for Latin faces. The composer
    // ends the block at the last line's own extent, so a line box taller than
    // this advance still is not clipped.
    const block = this._composeLines(raws, false, align, Math.round(fontSize * 1.2));
    return block ? this._trimMask(block) : null;
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
   * Returns raw COVERAGE. The caller thresholds, and for a glyph that means
   * `CoverageOps.GLYPH_COVERAGE` rather than the unbiased area cut.
   *
   * @param {string} text
   * @param {string} fontFamily - a SINGLE family; a CSS list would be quoted
   *   into one name nobody has and fall back silently
   * @param {number} fontSize - the FINAL size in px, scale already applied
   * @param {number} degrees - clockwise
   * @param {{w: number, h: number}} box - the output box, in final pixels
   * @returns {{data: Float32Array, w: number, h: number}} coverage
   * @private
   */
  _renderThrough(text, fontFamily, fontSize, degrees, box, align = this._textAlign) {
    const ss = CoverageOps.SUPERSAMPLE;
    const out = CoverageOps.create(box.w, box.h);
    if (!text || box.w <= 0 || box.h <= 0) return out;

    const fs = fontSize * ss;
    const font = `${fs}px "${fontFamily}"`;
    const pad = Math.ceil(fs);

    // Lines are drawn by ONE routine used by both passes, so the ink centre
    // pass 1 measures is the centre of exactly what pass 2 draws. Drawing the
    // raw string instead would collapse a paragraph to one line here even
    // though the rest of the pipeline had kept it - `fillText` does not break
    // lines. The advance matches `_rasterizeWithFont`'s, in supersampled units.
    const lines = TextToolClass._splitLines(text);
    const advance = Math.round(fontSize * 1.2) * ss;
    const drawLines = (c, ox, oy) => {
      const widths = lines.map((l) => c.measureText(l).width);
      const widest = widths.reduce((a, b) => Math.max(a, b), 0);
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        const slack = widest - widths[i];
        const dx = align === 'center' ? slack / 2 : align === 'right' ? slack : 0;
        c.fillText(lines[i], ox + dx, oy + i * advance);
      }
    };

    // Pass 1 - where is this string's ink, relative to the draw origin?
    const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
    const probe = Helpers.createCanvas(
      Math.ceil(fs * (longest + 2)) + pad * 2,
      Math.ceil(fs * 3) + (lines.length - 1) * advance);
    const pctx = probe.getContext('2d');
    pctx.font = font;
    pctx.textBaseline = 'alphabetic';
    pctx.fillStyle = '#000';
    const originX = pad, originY = Math.round(fs * 1.5);
    drawLines(pctx, originX, originY);

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
    drawLines(ctx, originX, originY);

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
    if (this.isBitmapFont(fontFamily)) {
      const h0 = this._fontCellHeight(fontFamily);
      return h0 === 8 ? [8, 16, 24, 32, 48, 64] : [1, 2, 3, 4].map(k => k * h0);
    }
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
