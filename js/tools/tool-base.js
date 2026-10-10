'use strict';
(function() {

/**
 * Tool Base Class
 * Base class for all drawing tools in the application
 */
class ToolBaseClass {
  /**
   * Create a new tool
   * @param {string} id - Tool identifier from TOOLS constant
   * @param {string} name - Human-readable tool name
   */
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.nameKey = `tool.${id}`;
    // Only ever seen over the grey surround, where nothing can be drawn - see
    // footprintCursor below.
    this.cursor = 'crosshair';
    /*
     * The tool's own mark IS the system pointer over the picture, and this is
     * the default: InputHandler hands the footprint to the operating system as
     * the cursor image (GridOverlay.brushCursor) - one brush pixel per canvas
     * pixel at the current zoom, in the colours it will leave - keeps it up
     * through a stroke, and draws it on the pointer canvas instead where Chrome
     * would refuse the image.
     *
     * It was the brush's alone until 2026-09-16, when the artist asked for
     * like-for-like everywhere: a crosshair says where the pointer is but
     * nothing about what will happen there, and the tools that had one were
     * exactly the ones whose size, shape and thickness the artist had chosen.
     * Every tool that answers getFootprint() now shows it; the ones that mark
     * nothing (pan, zoom, the pattern creator) return null and keep their own
     * cursors, which name what they do.
     */
    this.footprintCursor = true;
    /*
     * What colour the mark shows at each of its pixels.
     *   'paint'  - the colour the pixel will show AFTER a left click, worked
     *              out by simulating the write (the default: tools that draw)
     *   'sample' - the colour showing there NOW, because that is the colour
     *              the tool will take (the eyedropper)
     *   'none'   - no colour to promise; the neutral overlay colour (the
     *              selection bounds a region, it neither lays nor takes one)
     */
    this.markColour = 'paint';
    this.isActive = false;
    this.isDrawing = false;
  }

  /**
   * Activate this tool
   * Called when tool is selected. `this.cursor` is metadata only — the UI
   * applies it in response to EVENTS.TOOL_SELECTED (tools never touch the DOM).
   */
  activate() {
    this.isActive = true;
    Logger.debug('Tool', `${this.name} activated`);
  }

  /**
   * Deactivate this tool
   * Called when switching to another tool
   */
  deactivate() {
    this.isActive = false;
    this.isDrawing = false;
    this.clearPreview();
    Logger.debug('Tool', `${this.name} deactivated`);
  }

  /**
   * Clear any active preview drawing
   * Called on deactivate and can be called by subclasses
   */
  clearPreview() {
    if (window.GridOverlay) {
      GridOverlay.clearPreview();
    }
  }

  /**
   * Handle pointer down event
   * Parameter order matches InputHandler call convention:
   * InputHandler calls: activeTool.onPointerDown(point.x, point.y, e)
   * @param {number} pixelX - X coordinate in pixel space (0-255)
   * @param {number} pixelY - Y coordinate in pixel space (0-191)
   * @param {PointerEvent} e - Original pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    // Override in subclass
  }

  /**
   * Handle pointer move event
   * @param {number} pixelX - X coordinate in pixel space (0-255)
   * @param {number} pixelY - Y coordinate in pixel space (0-191)
   * @param {PointerEvent} e - Original pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    // Override in subclass
  }

  /**
   * Whether a drag hands this tool only the LAST coalesced sample of each
   * pointermove instead of every one. True for a tool whose move only redraws
   * a preview of "where the pointer is now" (a shape, a marquee, a pick): a
   * 1000 Hz mouse delivers ~16 samples a frame, and each earlier one was a
   * full preview that no one ever saw. False (the default) for anything that
   * lays or records something per sample - the brush, the eraser, the lasso.
   * @returns {boolean}
   */
  get coalescesPointerMoves() {
    return false;
  }

  /**
   * Handle pointer up event
   * @param {number} pixelX - X coordinate in pixel space (0-255)
   * @param {number} pixelY - Y coordinate in pixel space (0-191)
   * @param {PointerEvent} e - Original pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    // Override in subclass
  }

  /**
   * A key the active tool may claim before the global shortcuts see it (Enter and Backspace for a
   * tool with a pending figure, in Batch 7). Return true when the key was used; the input handler
   * then stops. Called with Ctrl and Alt NOT held.
   * @param {string} key - KeyboardEvent.key
   * @param {KeyboardEvent} [e]
   * @returns {boolean}
   */
  handleKey(key, e) {
    return false;
  }

  /**
   * Throw away anything the tool is holding unfinished, without drawing it. Escape calls this
   * before the tool is switched (switching tools COMMITS a pending figure, so Escape must discard
   * first). Nothing to do by default.
   */
  cancelPending() {
    // Override in subclass
  }

  /**
   * Handle pointer leave event
   * Called when pointer exits the canvas area
   * @param {PointerEvent} e - Original pointer event
   */
  onPointerLeave(e) {
    this.isDrawing = false;
  }

  /**
   * Footprint: the pixels this tool would affect if it were committed at
   * (pixelX, pixelY) right now — the "blast radius" under the cursor.
   *
   * InputHandler asks every tool for this on hover and hands the result to
   * GridOverlay.drawFootprintOutline, which strokes the BOUNDARY of the set
   * (a size-32 disc renders as a ring, not 800 opaque pixels) so the outline
   * never hides the artwork it is describing. On the ZX this is what tells you
   * how many 8x8 attribute cells a stroke is about to clash.
   *
   * The default is the single pixel under the cursor — correct for every
   * point-sized tool, and at high zoom it is the only pixel-accurate cursor
   * the app has (the CSS crosshair is a fixed screen-space glyph).
   *
   * Return null only when the tool marks nothing at all (pan, zoom). The mark
   * has its own canvas, so owning a preview is no longer a reason to opt out.
   *
   * Read geometry through the live mode views at call time (never cache it),
   * and reproduce the tool's OWN stamp geometry — an outline that disagrees
   * with what the tool actually writes is worse than no outline.
   *
   * @param {number} pixelX - X coordinate in pixel space
   * @param {number} pixelY - Y coordinate in pixel space
   * @returns {Array<{x: number, y: number}>|null}
   */
  getFootprint(pixelX, pixelY) {
    return [{ x: pixelX, y: pixelY }];
  }

  /**
   * The DRAW_MODE a left click would write at one pixel of the footprint, or
   * null if that pixel would not be written - what the mark simulates to show
   * the colour each pixel will be left in.
   *
   * The default is the global draw mode, which is what the drawing tools
   * resolve through. A tool that writes something else says so: the eraser
   * always erases, and a pattern leaves its gaps to the gap mode.
   * @param {number} pixelX
   * @param {number} pixelY
   * @returns {string|null}
   */
  markWrite(pixelX, pixelY) {
    return PixelDrawRoutine.resolveUserMode(true);
  }

  // Instance methods delegate to statics so both ShapeTool (instance)
  // and ShapeGenerator (calls ToolBase.getLinePoints statically) share one implementation.

  getLinePoints(x0, y0, x1, y1) {
    return ToolBaseClass.getLinePoints(x0, y0, x1, y1);
  }

  forEachLinePoint(x0, y0, x1, y1, callback) {
    ToolBaseClass.forEachLinePoint(x0, y0, x1, y1, callback);
  }

  // ── Static (canonical) Bresenham implementation ────────────────────────

  static forEachLinePoint(x0, y0, x1, y1, callback) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
      callback(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  }

  static getLinePoints(x0, y0, x1, y1) {
    const points = [];
    ToolBaseClass.forEachLinePoint(x0, y0, x1, y1, (x, y) => points.push({ x, y }));
    return points;
  }
}

/**
 * The "Colour core" option shared by Brush, Shape outlines and Bezier: a thick
 * line sets all its dots, but only the cells under its core take the colours.
 * Values are strings so the select carries them; colourCoreSize turns one into
 * the core's width in pixels (0 = the whole line, as before).
 */
ToolBaseClass.COLOUR_CORE_OPTS = Object.freeze([
  { value: 'whole', i18n: 'cc.whole' },
  { value: '1',     i18n: 'cc.one' },
  { value: '4',     i18n: 'cc.four' }
]);

/**
 * The Line style select row shared by Shape, Figure and Bezier (Batch 7 part 7B). The dash styles carry
 * `disabledIf: thickWhen` - they are drawn on a one-pixel line only (the rasteriser enforces it as well) -
 * and `clear: false` leaves 'clear' out (a Bezier curve has no inside to keep).
 * @param {{thickWhen: Object, clear?: boolean}} opts - `thickWhen` is a showIf-style condition that is true when
 *   the outline is thicker than one pixel
 * @returns {Object} an optionsSchema entry
 */
ToolBaseClass.lineStyleRow = ({ thickWhen, clear = true }) => ({
  type: 'select', key: 'lineStyle', i18n: 'opt.lineStyle', value: 'solid',
  options: [
    { value: 'solid',        i18n: 'lineStyle.solid' },
    { value: 'dashed',       i18n: 'lineStyle.dashed',      disabledIf: thickWhen },
    { value: 'dotted',       i18n: 'lineStyle.dotted',      disabledIf: thickWhen },
    { value: 'dash-dot',     i18n: 'lineStyle.dashDot',     disabledIf: thickWhen },
    { value: 'dash-dot-dot', i18n: 'lineStyle.dashDotDot',  disabledIf: thickWhen },
    ...(clear ? [{ value: 'clear', i18n: 'lineStyle.clear' }] : [])
  ]
});

/** @param {*} value - a COLOUR_CORE_OPTS value @returns {number} 0, 1 or 4 */
ToolBaseClass.colourCoreSize = (value) => (value === '1' ? 1 : value === '4' ? 4 : 0);

/** Same value, or 'whole' for anything else. */
ToolBaseClass.cleanColourCore = (value) => (value === '1' || value === '4' ? value : 'whole');

/**
 * Declarative tool-options contract (docs/REFACTOR_PLAN.md §2, UNIFICATION_AUDIT §2.3A).
 *
 * Every tool declares `static optionsSchema = [...]`; the OptionControls
 * renderer (js/ui/components/option-controls.js, Phase 4) owns all row markup,
 * wiring and i18n — tools never build options DOM. Entry fields:
 *
 *   type     'select' | 'range' | 'check' | 'textarea' | 'hint' | 'slot'
 *   key      option key; the value is applied to the tool via `set<Key>(value)`
 *            unless `setter` names a different method
 *   i18n     label translation key (for 'hint': the body text key)
 *   value    default value (mirrors the tool's constructor state)
 *   min / max / step / unit    range controls
 *   options  select entries { value, i18n | label } or optgroups
 *            { i18n, options: [...] }
 *   showIf   { key, equals } | { key, in: [...] } | { key, notIn: [...] }
 *            | { key, gt: n } — row visibility follows another option's
 *            current value. { cells: true } follows the SCREEN MODE instead:
 *            shown only where cells have colours (re-evaluated on a mode switch). Compound: { any: [cond...] } (OR) /
 *            { all: [cond…] } (AND), nestable.
 *   dynamic  name of an async tool method the renderer awaits to extend or
 *            replace `options` at render time (e.g. system font enumeration).
 *            Invoked with NO arguments — the method must read current tool
 *            state for context (e.g. getSizesForFont defaults to the current
 *            family). The resolved list replaces `options`; entries whose
 *            value also appears in the static `options` keep that entry's
 *            label/i18n. Dynamic rows re-resolve after any sibling select
 *            changes (race-guarded), so dependent lists stay current.
 *   presetOptions  a select whose row deliberately offers FEWER values than its
 *            setter accepts (brushType shows round/square; the other types are
 *            rail buttons) declares its real domain here, so a preset can carry
 *            a value the row does not list
 *   preset   set `false` to keep the key out of user presets (PresetService
 *            captures every other key through the same `get<Key>()` the panel
 *            reads, so a new option is preset-able the day it lands). Use it
 *            for content rather than settings — the text tool's typed string —
 *            not to avoid writing a getter: tests/preset-slices.test.js fails
 *            the build on a capturable key that has none.
 *   slot     named slot another component renders into (e.g. 'pattern-browser')
 *   syncEvent  an EVENTS.* fact; while the row is rendered, the control
 *            re-reads the tool's `get<Key>()` on every firing so it tracks
 *            state changed outside the panel (requires that getter; e.g. the
 *            zoom select follows EVENTS.CANVAS_ZOOM). Unsubscribed on the
 *            next tool render.
 *   placeholderI18n / rows     textarea controls
 */

// Expose to global scope
window.ToolBase = ToolBaseClass;

Logger.debug('ToolBase', 'Tool base class loaded');

})(); // End IIFE
