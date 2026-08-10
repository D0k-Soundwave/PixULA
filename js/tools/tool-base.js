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
    this.cursor = 'crosshair';
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
   * Handle pointer up event
   * @param {number} pixelX - X coordinate in pixel space (0-255)
   * @param {number} pixelY - Y coordinate in pixel space (0-191)
   * @param {PointerEvent} e - Original pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
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
   * Return null when there is nothing to show:
   *   - the tool has no footprint at all (pan, zoom)
   *   - the tool owns the hover preview itself via onPointerHover, or is
   *     mid-gesture with a live preview on the function-preview canvas
   *     (gradient phase 2, bezier handle editing) — a footprint drawn there
   *     would clear it
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
 *            current value. Compound: { any: [cond…] } (OR) /
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

/** Shared draw-mode select options (brush, shape; fill filters to its subset). */
ToolBaseClass.DRAW_MODE_OPTS = Object.freeze([
  { value: 'normal',          i18n: 'dm.normal' },
  { value: 'attributes_only', i18n: 'dm.attributesOnly' },
  { value: 'pixel_only',      i18n: 'dm.pixelsOnly' },
  { value: 'paper',           i18n: 'dm.paper' },
  { value: 'xor',             i18n: 'dm.xor' }
]);

// Expose to global scope
window.ToolBase = ToolBaseClass;

Logger.debug('ToolBase', 'Tool base class loaded');

})(); // End IIFE
