'use strict';
(function() {

/**
 * InputHandler — the universal input layer (docs/REFACTOR_PLAN.md §3).
 *
 * One Pointer-Events pipeline for mouse, touch and pressure pens, plus the
 * global keyboard map. Replaces the interim Phase-4 canvas-pointer-bridge.
 *
 * Input convention (do not change): the active tool's
 * onPointerDown/Move/Up/Leave are called DIRECTLY — ToolManager's
 * handlePointerUp clears isDrawing before delegating, which breaks the
 * gradient tool's two-phase flow. EVENTS.INPUT_POINTER_MOVE is emitted on
 * every move (cursor readout, text-tool stamp preview) and hover is forwarded
 * to tools implementing onPointerHover (gradient phase 2).
 *
 * Stroke integrity: setPointerCapture on pointerdown so strokes survive
 * leaving the canvas/iframe edge; getCoalescedEvents on pointermove feeds
 * every high-rate pen sample through the tools' existing Bresenham
 * interpolation; pointercancel is treated as stroke-end-with-commit.
 * Everything is feature-detected — a plain mouse is the always-works baseline.
 *
 * Pointer-type routing:
 *   pen      pressure flows to tools via the event (BrushEngine.mapPressure
 *            consumes it); tilt is recorded and handed to BrushEngine.setTilt
 *            where that hook exists; hover (buttons===0) shows a brush-outline
 *            preview via GridOverlay. Every control EXCEPT the tip is
 *            assignable in Preferences (barrel, second barrel, eraser tail ->
 *            any PEN_ACTIONS entry); js/utils/pen-map.js decodes which control
 *            was pressed and looks up its action, and _applyPenAction performs
 *            it. The tip always draws with the active tool.
 *   touch    one finger draws; two fingers pan (fact: EVENTS.INPUT_WHEEL_PAN —
 *            CanvasControls listens) + pinch-zoom around the gesture centroid
 *            (live CanvasSystem.setZoomPreview, committed snapped on release);
 *            long-press opens CanvasContextMenu. WHETHER a finger draws is
 *            decided by js/utils/touch-policy.js (pure, Node-tested) from three
 *            independent settings — see the touch-admission block below.
 *   mouse    unchanged: right-click is paper (tools read e.button/e.buttons)
 *            everywhere on the canvas, inside an active selection included;
 *            SHIFT+right-click opens the context menu in any tool, and a
 *            plain right-click opens it under the selection tool, which has
 *            no mark to make. Wheel pans and Ctrl+wheel zooms.
 *
 * Keyboard: the single-key tool map is GENERATED from TOOL_GROUPS (single
 * source with the rail and the shortcuts dialog — includes the 'shape'
 * umbrella id). The old app's transform hotkeys (H/V/R/I/O) are intentionally
 * NOT ported: they shadowed registry shortcuts (V=move, I=eyedropper).
 *
 * Special canvas modes (API relied on by components):
 *   enterAttrPaintMode/exitAttrPaintMode + _attrPaintMode  (clut-bar Swap/Recolour)
 *   enterPatternCaptureMode                                 (pattern-panel)
 *   exitPatternCaptureMode                                  (transform-panel)
 * EVENTS.ATTR_PAINT_MODE announces the mode fact. Attribute paint mode is
 * STICKY: it is disarmed only by a new draw method (a tool choice or a
 * draw-mode change) or by clicking its own button off — a layer change,
 * Escape and transform actions all leave it armed. Pattern capture is
 * transient and exits on any of those.
 *
 * Touch admission (three layers, TOUCH_DEFAULTS + js/utils/touch-policy.js):
 *   1. no double touch — a touch arriving while a pen or mouse contact is down
 *      is the hand holding that device, not a second input device;
 *   2. the lockout window — touch ignored for `touchLockoutMs` after the last
 *      pen event (HOVER included: a pen approaching is the only warning that a
 *      palm is about to land) or mouse drag sample;
 *   3. the drawing switch — `touchDrawing` off leaves touch every navigation
 *      job (pan, pinch, long-press) and takes away only the mark.
 * A rejected contact does NOTHING — it does not fall through to panning,
 * because a palm that scrolls the canvas mid-stroke cannot be undone the way a
 * mark can. Layer 3 is the one reached without opening Preferences, from the
 * status-bar toggle, because it is the one changed mid-drawing;
 * setTouchDrawing() is its single writer and EVENTS.TOUCH_MODE_CHANGED the fact.
 *
 * Two things that are NOT touch-specific but exist for the same reason:
 * a pointerdown from a second pointer never takes over a stroke already in
 * flight (that is what let a palm both draw AND kill the pen stroke it landed
 * during), and a pointercancel on a TOUCH pointer REVERTS its stroke rather
 * than committing it — the OS retracting a contact is palm arbitration, and it
 * is better at that than any timer here.
 */
class InputHandlerClass {
  constructor() {
    this.canvas = null;       // main-canvas — coordinate reference
    this.inputTarget = null;  // iframe <body> — receives pointer/wheel events

    // Stroke state
    this.isDrawing = false;
    this.currentPointerId = null;
    // pointerType of the stroke in flight — TouchPolicy's activeContact, and
    // the thing that makes "is a pen down right now" answerable.
    this._strokePointerType = null;
    this.lastPoint = null;
    this.pressure = 1.0;
    this.tilt = { x: 0, y: 0 };
    this._strokeTool = null;  // per-stroke override (a pen control's action)
    this._penButtons = null;  // rewritten button mask for this stroke, or null
    this._penPanPending = false;       // a pen control asked for a pan drag
    this._contextMenuConsumed = false; // a pen control already spent this press

    // Keyboard state
    this.keysDown = new Set();
    this.modifiers = { shift: false, ctrl: false, alt: false, meta: false };
    this._toolShortcuts = this._buildToolShortcutMap();

    // Touch gesture state
    this.touches = new Map(); // touch pointers only
    this._gesture = { active: false, initialDistance: 0, initialZoom: 100, lastCentroid: null };

    // Palm rejection — timestamp of the most recent PRECISE input: any pen
    // event (hover included) or any mouse sample with a button down. A parked
    // mouse cursor is deliberately not precise input; see _notePreciseInput.
    // The window itself is TOUCH_DEFAULTS.lockoutMs, a live preference.
    this._lastPreciseTime = 0;
    // Once true, pressure sensitivity is permanently resolved (explicit
    // choice or already on) and _maybeAutoEnablePressure has nothing left
    // to decide — cached so the pen hover/move hot path stops re-reading
    // StateManager for it after the first resolution.
    this._pressureAutoDecided = false;
    // Set for the life of one touch when the policy said navigate: the pan
    // branch reads it instead of re-deciding, so one contact gets one verdict.
    this._touchNavigating = false;
    // A touch stroke the OS may yet retract (palm arbitration). Only touch,
    // because only touch gets arbitrated.
    this._touchStrokeRevocable = false;

    // Long-press (touch) -> context menu
    this._longPressTimer = null;
    this._longPressOrigin = null;
    this.LONG_PRESS_MS = 600;
    this.LONG_PRESS_SLOP_PX = 8;

    // Special modes
    this._stampMode = null;          // 'stamp' | 'erase' | null
    this._patternCaptureSize = 0;    // 0 = inactive
    this._attrPaintMode = null;      // 'apply' | 'swap' | null
    this._attrPaintLastCell = null;
    this._escapeToolReset = false;   // true while Escape resets to the brush

    // Panning
    this._panMode = false;           // space-bar pan
    // A drag-pan that is not the space bar: one finger under the pan-only
    // preference, or a pen control assigned the pan action.
    this._dragPanActive = false;
    this._lastPanClient = null;

    // Hover footprint outline (mouse + pen; touch never hovers)
    this._hoverOutlineShown = false;
    this._hoverOutlinePoint = null;
    this._hoverOutlineTool = null;   // tool id the outline was computed for
  }

  /** Initialize: wait for the canvas iframe, then attach all listeners. */
  init() {
    // Suppress the OS context menu over the iframe even before srcdoc loads
    document.addEventListener('contextmenu', (e) => {
      const iframe = CanvasSystem.getIframe && CanvasSystem.getIframe();
      if (iframe && (e.target === iframe || iframe.contains(e.target))) {
        e.preventDefault();
      }
    }, true);

    this._attachKeyboardEvents(document);

    // The touch settings are seeded in app.js with every other preference —
    // this used to be the one place that did its own, and the inconsistency
    // was the reason it went on being missed.

    CanvasSystem.onReady(() => {
      this.canvas = CanvasSystem.getCanvasElement('main-canvas');
      const iframeDoc = CanvasSystem.getIframeDocument();
      if (!this.canvas || !iframeDoc || !iframeDoc.body) {
        Logger.error('InputHandler', 'Canvas iframe not available');
        return;
      }
      this.inputTarget = iframeDoc.body;

      this._attachPointerEvents();
      this._attachWheelEvents();
      this._keyboardDoc = iframeDoc;
      this._attachKeyboardEvents(iframeDoc); // keys while canvas has focus
      this._suppressIframeContextMenu(iframeDoc);
      this._closeMenusOnIframeInteraction(iframeDoc);
      this._preventDefaults();

      // Chromium re-navigates srcdoc iframes on file:// after the initial
      // load (the benign "unique security origins" fallback), replacing the
      // document — and with it the keydown listener attached above. Without a
      // re-bind, the fresh iframe body swallows Ctrl+Z/Y and the tool keys
      // whenever the canvas has focus. Re-attach on every subsequent load.
      const iframe = CanvasSystem.getIframe && CanvasSystem.getIframe();
      if (iframe) iframe.addEventListener('load', () => this._rebindIframeKeyboard());

      Logger.info('InputHandler', 'Initialized (universal input, Phase 5)');
    });

    // A deliberate new DRAW METHOD — a tool choice or a draw-mode change —
    // exits the special canvas modes. Attribute paint mode is otherwise
    // STICKY (see deactivateSpecialModes): a layer change, Escape or a
    // transform leaves it armed, so it drops only here or when its own
    // Swap/Recolour button is clicked off.
    EventBus.on(EVENTS.TOOL_SELECTED,  () => {
      if (!this._escapeToolReset) this.deactivateSpecialModes();
      this._clearHoverOutline();
    });
    EventBus.on(EVENTS.DRAW_MODE_CHANGED, () => this.deactivateSpecialModes());
    EventBus.on(EVENTS.LAYER_SELECTED, () => this.exitPatternCaptureMode());

    // An option change (size, brush type, thickness…) changes the footprint
    // under a cursor that never moved. Repaint in place so dragging the size
    // slider shows the new footprint live instead of waiting for a mouse move.
    EventBus.on(EVENTS.TOOL_OPTIONS, () => {
      if (!this._hoverOutlineShown || !this._hoverOutlinePoint) return;
      const tool = ToolManager.getCurrentTool();
      if (!tool) return;
      const point = this._hoverOutlinePoint;
      this._hoverOutlineTool = null;   // invalidate the memo, force a recompute
      this._drawToolFootprint(point, tool);
    });
  }

  // ── Special canvas modes ──────────────────────────────────────────────────

  /**
   * Enter attribute paint mode: clicking/dragging applies the chosen
   * attribute operation cell-by-cell without touching pixel bits.
   * @param {'apply'|'swap'} mode
   */
  enterAttrPaintMode(mode) {
    this._attrPaintMode = mode;
    this._attrPaintLastCell = null;
    EventBus.emit(EVENTS.ATTR_PAINT_MODE, { mode });
  }

  /** Exit attribute paint mode and return to normal tool behaviour. */
  exitAttrPaintMode() {
    this._attrPaintMode = null;
    this._attrPaintLastCell = null;
    EventBus.emit(EVENTS.ATTR_PAINT_MODE, { mode: null });
  }

  /**
   * Enter pattern capture mode: hovering previews a fixed-size area,
   * left-click captures it to the Mine pattern library, right-click exits.
   * @param {number} size - Capture area in pixels (8, 16, or 32)
   */
  enterPatternCaptureMode(size) {
    this._patternCaptureSize = size;
    if (window.GridOverlay) GridOverlay.clearFunctionPreview();
  }

  /** @private */
  _exitPatternCaptureMode() {
    this._patternCaptureSize = 0;
    if (window.GridOverlay) GridOverlay.clearFunctionPreview();
  }

  /**
   * Exit all special canvas modes (attr paint, pattern capture).
   *
   * Reserved for a deliberate new DRAW METHOD — a tool choice or a draw-mode
   * change. Attribute paint mode is sticky by design: everything else that
   * merely happens to touch the canvas (layer change, Escape, a transform)
   * must call exitPatternCaptureMode() instead so the armed Swap/Recolour
   * operation survives.
   */
  deactivateSpecialModes() {
    if (this._attrPaintMode) this.exitAttrPaintMode();
    this.exitPatternCaptureMode();
  }

  /**
   * Exit pattern capture only, leaving any armed attribute operation intact.
   * @see deactivateSpecialModes for why attribute paint mode is sticky.
   */
  exitPatternCaptureMode() {
    if (this._patternCaptureSize > 0) this._exitPatternCaptureMode();
  }

  /**
   * Apply the active attribute paint operation to the cell under the point.
   * Skips re-application to the same cell within one drag stroke.
   * @param {{x: number, y: number}} point
   * @private
   */
  _applyAttrPaintAtPoint(point) {
    const cell = ZX_COORDS.pixelToCell(point.x, point.y);

    if (this._attrPaintLastCell &&
        this._attrPaintLastCell.x === cell.x &&
        this._attrPaintLastCell.y === cell.y) return;
    this._attrPaintLastCell = cell;

    if (!Validators.isValidCellCoord(cell.x, cell.y)) return;
    const layer = LayerManager.getCurrentLayer();
    if (!layer || layer.locked) return;

    const px = ZX_COORDS.cellToPixel(cell.x, cell.y);
    // Attr paint targets exactly the cell under the pointer — no symmetry
    if (this._attrPaintMode === 'apply') {
      PixelDrawRoutine.draw(px.x, px.y,
        ColorManager.getCurrentSelection(), DRAW_MODE.ATTRIBUTES_ONLY, { layer, mirror: false });
    } else if (this._attrPaintMode === 'swap') {
      const cellData = layer.getCell(cell.x, cell.y);
      if (!cellData) return;
      PixelDrawRoutine.draw(px.x, px.y,
        { ink: cellData.paper, paper: cellData.ink, bright: cellData.bright, flash: cellData.flash },
        DRAW_MODE.ATTRIBUTES_ONLY, { layer, mirror: false });
    }

    CanvasSystem.requestRender();
  }

  /** @private */
  _executePatternCapture(point) {
    const size = this._patternCaptureSize;
    // Exit synchronously before any async work so no later click is captured
    this._exitPatternCaptureMode();

    const x = clamp(point.x, 0, ZX_SPECTRUM.WIDTH  - size);
    const y = clamp(point.y, 0, ZX_SPECTRUM.HEIGHT - size);
    const bitmap = new Uint8Array(size * size);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const state = PixelDrawRoutine.getPixelState(x + px, y + py);
        bitmap[py * size + px] = (state && state.isInk) ? 1 : 0;
      }
    }

    if (!window.PatternService) return;
    const name = `cap-${Date.now().toString(36).slice(-6)}`;
    const patternObj = { name, userDefined: true, width: size, height: size, bitmap };

    PatternService.savePatternData(name, size, bitmap)
      .then(async (saved) => {
        // A capture that could not be filed must not become the active
        // pattern: the artist would be drawing with something the library
        // does not have, and would lose it at the next reload.
        if (!saved) return;
        await PatternService.setCurrentPattern(patternObj);
        ToolManager.selectTool(TOOLS.BRUSH);
        const brushTool = ToolManager.getTool(TOOLS.BRUSH);
        if (brushTool && typeof brushTool.setBrushType === 'function') {
          brushTool.setBrushType('pattern');
        }
      });
  }

  // ── Pointer pipeline ──────────────────────────────────────────────────────

  /** @private */
  _attachPointerEvents() {
    const target = this.inputTarget;

    target.addEventListener('pointerdown',   (e) => this._onPointerDown(e));
    target.addEventListener('pointermove',   (e) => this._onPointerMove(e));
    target.addEventListener('pointerup',     (e) => this._onPointerUp(e));
    // pointercancel means the system took the pointer away. For a pen or a
    // mouse that is an OS gesture interrupting real work, so the stroke so far
    // is kept (end-with-commit). For a TOUCH pointer it is palm arbitration —
    // the platform deciding the contact was never intentional — and Windows Ink
    // and iPadOS are better at that judgement than any timer in this file, so
    // the stroke is rolled back instead. Committing it was the old behaviour
    // and is exactly the mark the artist is complaining about.
    target.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch') this._revokeTouchStroke(e);
      else this._onPointerUp(e);
    });

    target.addEventListener('pointerleave', (e) => {
      if (this._patternCaptureSize > 0) {
        if (window.GridOverlay) GridOverlay.clearFunctionPreview();
        return;
      }
      if (this.isDrawing) {
        // Without capture (older engines) a stroke can leave the surface —
        // commit it. With capture held, leave only fires after up.
        this._onPointerUp(e);
        return;
      }
      this._clearHoverOutline();
      const tool = ToolManager.getCurrentTool();
      if (tool) tool.onPointerLeave(e);
    });

    // Right-click is a drawing action (paper) for every drawing tool, over the
    // whole canvas — an active selection does not carve a hole in the tool the
    // artist is holding (that read as the right button being broken, and with
    // the drawing guide set to 'inside' it broke exactly the region being
    // worked in). The canvas menu is reached by SHIFT+right-click in any tool
    // (no pointer path binds Shift to the right button, so the combination is
    // free everywhere), by a plain right-click under the SELECTION tool, whose
    // right button has no mark to make, and by long-press on touch.
    // contextmenu fires after pointerup, so one right-click = one action.
    target.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!window.CanvasContextMenu) return;
      // A pen barrel press reports button 2 and has already run as a stroke
      // (eyedropper) — it must not also raise the menu.
      if (this._contextMenuConsumed) { this._contextMenuConsumed = false; return; }
      const activeTool = ToolManager.getCurrentTool();
      if (e.shiftKey || (activeTool && activeTool.id === TOOLS.SELECTION)) {
        this._showCanvasContextMenu(e.clientX, e.clientY);
      }
    }, true);
  }

  /**
   * Suppress the OS right-click menu across the canvas iframe (both phases,
   * inner document and outer <iframe> element — engines differ on the target).
   * @param {Document} iframeDoc
   * @private
   */
  _suppressIframeContextMenu(iframeDoc) {
    const prevent = (e) => e.preventDefault();
    iframeDoc.addEventListener('contextmenu', prevent, true);
    iframeDoc.addEventListener('contextmenu', prevent);
    const outer = CanvasSystem.getIframe && CanvasSystem.getIframe();
    if (outer) {
      outer.addEventListener('contextmenu', prevent, true);
      outer.addEventListener('contextmenu', prevent);
    }
  }

  /**
   * Close any open menu-bar dropdown, and any open CanvasContextMenu (the
   * canvas edit menu, or PanelSection's panel reorder menu), the moment a
   * pointer goes down on the canvas. Both components' own click-outside
   * handlers live on the top document and never see this: the iframe is a
   * separate document, and it covers most of the screen, so without this a
   * menu only closed on a second click or Escape.
   * @param {Document} iframeDoc
   * @private
   */
  _closeMenusOnIframeInteraction(iframeDoc) {
    iframeDoc.addEventListener('pointerdown', () => {
      if (window.MenuSystem) MenuSystem.closeAllMenus();
      if (window.CanvasContextMenu) CanvasContextMenu.hide();
    }, true);
  }

  /** @private */
  _onPointerDown(e) {
    this._notePreciseInput(e);

    // ── Touch admission (js/utils/touch-policy.js) ──
    // Decided FIRST, before any bookkeeping: a rejected contact must not even
    // reach this.touches, or two palm contacts would start a pinch.
    this._touchNavigating = false;
    if (e.pointerType === 'touch') {
      const verdict = TouchPolicy.decide(this._touchState());
      if (verdict === TouchPolicy.IGNORE) return;
      this._touchNavigating = (verdict === TouchPolicy.NAVIGATE);
    }

    // ── One stroke at a time, part 1: everything that is not touch ──
    // The main guard is below, after the two-finger gesture gets its exception.
    // This half has to run FIRST because the special canvas modes underneath it
    // return before ever reaching that point — attribute paint sets isDrawing
    // and currentPointerId of its own, so without this a second pen or mouse
    // press took over an attribute drag exactly as it used to take over a
    // stroke. Touch is excluded here and judged below.
    if (e.pointerType !== 'touch' && this._isForeignPointer(e)) return;

    // ── Pattern capture mode — before any state mutation ──
    if (this._patternCaptureSize > 0) {
      if (e.button === 0) {
        this._executePatternCapture(this._getCanvasPoint(e, false));
      } else if (e.button === 2) {
        this._exitPatternCaptureMode();
      }
      return;
    }

    // ── Attribute paint mode ──
    if (this._attrPaintMode) {
      if (e.button === 2) {
        this.exitAttrPaintMode();
        return;
      }
      this._capturePointer(e);
      this.isDrawing = true;
      this.currentPointerId = e.pointerId;
      // An attribute drag is a stroke like any other as far as touch admission
      // is concerned: without this, activeContact read null for its whole
      // duration and layer 1 protected nothing while the artist recoloured.
      this._strokePointerType = e.pointerType;
      this._attrPaintLastCell = null;
      PixelDrawRoutine.beginBatch(this._attrPaintMode === 'apply' ? 'Apply Attribute' : 'Swap INK/PAP');
      this._applyAttrPaintAtPoint(this._getCanvasPoint(e, false));
      return;
    }

    // ── Touch bookkeeping: second finger starts the pan/pinch gesture ──
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        this._cancelLongPress();
        this._endActiveStroke(e); // finger 1 stroke: end-with-commit
        this._beginGesture();
        return;
      }
    }

    // ── One stroke at a time, part 2: touch ──
    // The two-finger gesture is unaffected: it returned above, before this.
    if (this._isForeignPointer(e)) return;

    // ── Pen routing: whatever the owner assigned to the control they pressed ──
    // The bit decoding and the assignment lookup are pure (js/utils/pen-map.js,
    // Node-tested); this block only performs the result. The tip is never
    // assignable — it draws with the active tool, because it is the one contact
    // drawing needs (a tip binding would fight the brush's Build up option and
    // precise work at high zoom, where the whole gesture happens inside a few
    // screen pixels).
    this._strokeTool = null;
    this._penButtons = null;
    this._contextMenuConsumed = false;
    if (e.pointerType === 'pen') {
      const control = PenMap.controlFromEvent(e);
      if (control && control !== PEN_CONTROLS.TIP.id) {
        // A pen control is spent on its assignment: it never also runs the
        // active tool, and never trails an OS context menu into the app.
        this._contextMenuConsumed = true;
        const action = PenMap.actionFor(control, this.getPenConfig());
        if (!this._applyPenAction(action, e)) return;
      }
    }

    // ── Right-click context-menu gate (mouse) ──
    // Shift+right-click asks for the menu in any tool, over anything — an
    // explicit request outranks the stamp erase. A plain right-click defers
    // only under the SELECTION tool. Either way: start no stroke, and let the
    // contextmenu event (fires after up) open the menu. Every other
    // right-click draws, wherever the pointer is, selection or not.
    if (e.pointerType !== 'pen' && e.button === 2 && window.CanvasContextMenu) {
      if (e.shiftKey) return;
      const stampActive = LayerManager.getCurrentLayer()?.isStamp;
      if (!stampActive) {
        const tool = ToolManager.getCurrentTool();
        if (tool && tool.id === TOOLS.SELECTION) return;
      }
    }

    this._capturePointer(e);
    this.isDrawing = true;
    this.currentPointerId = e.pointerId;
    this._strokePointerType = e.pointerType;
    // Only a touch that is actually MARKING can be revoked; a navigating one
    // has nothing to roll back and must not reach the undo stack at all.
    this._touchStrokeRevocable = (e.pointerType === 'touch' && !this._touchNavigating);
    this.pressure = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 1.0;
    this._updateTilt(e);

    const point = this._getCanvasPoint(e);
    this.lastPoint = point;
    this._clearHoverOutline();

    // Long-press -> context menu (touch only; cancelled by movement/up/gesture)
    if (e.pointerType === 'touch') this._startLongPress(e);

    // ── Panning: space-bar pan (any pointer) / navigating touch / pen button ──
    if (this._panMode || this._penPanPending || this._touchNavigating) {
      this._dragPanActive = (this._penPanPending || this._touchNavigating) && !this._panMode;
      this._penPanPending = false;
      this._lastPanClient = { x: e.clientX, y: e.clientY };
      return;
    }

    // ── Stamp interaction: LMB/tip stamps ink, RMB/eraser-end erases ──
    // A pen control assigned the eyedropper is the exception: the owner asked
    // that button for a colour, so it picks one instead of stamping.
    const penPickup = this._strokeTool && this._strokeTool.id === TOOLS.EYEDROPPER;
    if (!penPickup && this._beginStampInteraction(this._toolEvent(e), point)) return;

    // ── Delegate to the (possibly rerouted) tool — DIRECT call ──
    const tool = this._strokeTool || ToolManager.getCurrentTool();
    if (tool) tool.onPointerDown(point.x, point.y, this._toolEvent(e));
  }

  /**
   * Perform a pen control's assigned action.
   *
   * @param {string} action - PEN_ACTIONS id
   * @param {PointerEvent} e
   * @returns {boolean} true to carry on into the stroke pipeline, false when
   *          the gesture is already complete (one-shot actions and 'none')
   * @private
   */
  _applyPenAction(action, e) {
    const A = PEN_ACTIONS;
    switch (action) {
      // Drawing actions: the tool runs, but the button mask it reads is
      // rewritten, because a tool decides ink-or-paper from the SECONDARY bit
      // and the control that was actually pressed may be a different one.
      case A.INK.id:
        this._penButtons = PEN_CONTROLS.TIP.bit;
        return true;
      case A.PAPER.id:
        this._penButtons = PEN_CONTROLS.TIP.bit | PEN_CONTROLS.BARREL.bit;
        return true;
      case A.EYEDROPPER.id:
        // Pick INK — the plain meaning of "eyedropper". (Paper-picking is the
        // eyedropper's right-button behaviour, so it needs the barrel bit.)
        this._strokeTool = ToolManager.getTool(TOOLS.EYEDROPPER);
        this._penButtons = PEN_CONTROLS.TIP.bit;
        return true;
      case A.EYEDROPPER_PAPER.id:
        this._strokeTool = ToolManager.getTool(TOOLS.EYEDROPPER);
        this._penButtons = PEN_CONTROLS.TIP.bit | PEN_CONTROLS.BARREL.bit;
        return true;
      case A.ERASER.id:
        // Keep the eraser bit in the mask: downstream "is this an erase
        // gesture?" tests (the stamp path) read it directly.
        this._strokeTool = ToolManager.getTool(TOOLS.ERASER);
        this._penButtons = PEN_CONTROLS.TIP.bit | PEN_CONTROLS.ERASER.bit;
        return true;
      case A.PAN.id:
        this._penPanPending = true;
        return true;

      // One-shot actions: nothing is drawn and no stroke begins.
      case A.MENU.id:
        this._showCanvasContextMenu(e.clientX, e.clientY);
        return false;
      case A.UNDO.id:
        UndoRedo.undo();
        return false;
      case A.REDO.id:
        UndoRedo.redo();
        return false;
      case A.SWAP_COLORS.id:
        ColorManager.swapColors();
        return false;
      case A.PREV_TOOL.id: {
        const previous = StateManager.get('tool.previous');
        if (previous) ToolManager.selectTool(previous);
        return false;
      }
      default:
        return false; // 'none' — the control is deliberately inert
    }
  }

  /**
   * The event a tool should see. Identical to the real one unless a pen
   * control's action rewrote the button mask, in which case the tool reads the
   * rewritten `buttons`/`button` and everything else passes through untouched
   * (native methods are bound to the real event so calling them still works).
   * @private
   */
  _toolEvent(e) {
    if (this._penButtons === null) return e;
    const buttons = this._penButtons;
    return new Proxy(e, {
      get(target, prop) {
        if (prop === 'buttons') return buttons;
        if (prop === 'button') return (buttons & PEN_CONTROLS.BARREL.bit) ? 2 : 0;
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }

  /**
   * The live pen configuration: which profile, and what each control does.
   * Read at CALL time so a Preferences change takes effect on the next press
   * with no wiring in between.
   * @returns {{profile: string, custom: Object, actions: Object}}
   */
  getPenConfig() {
    return {
      profile: StateManager.get('pen.profile') || PEN_PROFILES.generic.id,
      custom: StateManager.get('pen.custom') || {},
      actions: StateManager.get('pen.actions') || {}
    };
  }

  /** @private */
  _onPointerMove(e) {
    this._notePreciseInput(e);

    const point = this._getCanvasPoint(e);
    EventBus.emit(EVENTS.INPUT_POINTER_MOVE, {
      x: point.x,
      y: point.y,
      pressure: (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 1.0,
      pointerType: e.pointerType,
      buttons: e.buttons
    });

    // Touch tracking + two-finger gesture
    const touch = this.touches.get(e.pointerId);
    if (touch) {
      touch.x = e.clientX;
      touch.y = e.clientY;
    }
    if (this._gesture.active) {
      if (this.touches.size >= 2) this._handleGesture();
      return;
    }

    // Long-press slop: real movement means it's a stroke, not a press
    if (this._longPressTimer && this._longPressOrigin) {
      const dx = e.clientX - this._longPressOrigin.clientX;
      const dy = e.clientY - this._longPressOrigin.clientY;
      if ((dx * dx + dy * dy) > this.LONG_PRESS_SLOP_PX * this.LONG_PRESS_SLOP_PX) {
        this._cancelLongPress();
      }
    }

    // Floating stamp preview follows the cursor
    if (SelectionService.isFloating()) {
      const current = LayerManager.getCurrentLayer();
      if (current && current.isStamp) {
        SelectionService.moveStampPreview(point.x, point.y);
      }
    }

    // Pattern capture hover preview (independent of draw state)
    if (this._patternCaptureSize > 0) {
      const size = this._patternCaptureSize;
      const cx = clamp(point.x, 0, ZX_SPECTRUM.WIDTH  - size);
      const cy = clamp(point.y, 0, ZX_SPECTRUM.HEIGHT - size);
      if (window.GridOverlay) GridOverlay.drawSelectionPreview(cx, cy, size, size);
      return;
    }

    if (!this.isDrawing || e.pointerId !== this.currentPointerId) {
      if (!this.isDrawing) this._handleHover(point, e);
      return;
    }

    // Attribute paint drag
    if (this._attrPaintMode) {
      this._applyAttrPaintAtPoint(this._getCanvasPoint(e, false));
      return;
    }

    // Space-bar / one-finger panning
    if (this._panMode || this._dragPanActive) {
      if (this._lastPanClient) {
        CanvasSystem.pan(e.clientX - this._lastPanClient.x,
                         e.clientY - this._lastPanClient.y);
      }
      this._lastPanClient = { x: e.clientX, y: e.clientY };
      return;
    }

    this.pressure = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 1.0;
    this._updateTilt(e);

    // Stamp continuous painting/erasing
    if (this._stampMode) {
      const current = LayerManager.getCurrentLayer();
      const stamp = (current && current.isStamp) ? current : null;
      if (stamp) {
        const events = this._samplesOf(e);
        for (let i = 0; i < events.length; i++) {
          const cp = this._getCanvasPoint(events[i]);
          SelectionService.moveStampPreview(cp.x, cp.y);
          if (this._stampMode === 'erase') {
            SelectionService.eraseAt(stamp);
          } else {
            SelectionService.stampAt(stamp);
          }
        }
        CanvasSystem.requestRender();
        return;
      }
    }

    // Coalesced samples straight into the tool (RAF deferral adds a frame of
    // lag); each event carries its own pressure for the brush engine.
    const events = this._samplesOf(e);
    const tool = this._strokeTool || ToolManager.getCurrentTool();
    if (!tool) return;

    for (let i = 0; i < events.length; i++) {
      const sample = events[i];
      const samplePoint = this._getCanvasPoint(sample);

      // Skip samples that stayed on the same canvas pixel (common at high zoom)
      if (this.lastPoint &&
          samplePoint.x === this.lastPoint.x &&
          samplePoint.y === this.lastPoint.y) {
        continue;
      }

      tool.onPointerMove(samplePoint.x, samplePoint.y, this._toolEvent(sample));
      this.lastPoint = samplePoint;
    }
  }

  /** Shared by pointerup and pointercancel (stroke-end-with-commit). @private */
  _onPointerUp(e) {
    // Before the stroke state is cleared: a mouse RELEASE reports buttons 0,
    // and it is still the end of a drag the lockout window should cover.
    this._notePreciseInput(e);

    if (this.inputTarget.hasPointerCapture && this.inputTarget.hasPointerCapture(e.pointerId)) {
      this.inputTarget.releasePointerCapture(e.pointerId);
    }

    this.touches.delete(e.pointerId);
    if (this._gesture.active && this.touches.size < 2) this._endGesture();
    this._cancelLongPress();

    if (!this.isDrawing || e.pointerId !== this.currentPointerId) return;
    this.isDrawing = false;
    this.currentPointerId = null;
    this._strokePointerType = null;
    this._touchStrokeRevocable = false;
    this._touchNavigating = false;

    const point = this._getCanvasPoint(e);

    // Close the stamp batch opened in pointerdown; the tool never saw this
    // stroke (pointerdown returned before delegation), so don't notify it.
    if (this._stampMode) {
      PixelDrawRoutine.endBatch();
      this._stampMode = null;
      this._strokeTool = null;
      this.lastPoint = null;
      return;
    }

    if (this._attrPaintMode) {
      PixelDrawRoutine.endBatch();
      this._attrPaintLastCell = null;
      this._strokeTool = null;
      this.lastPoint = null;
      return;
    }

    if (this._panMode || this._dragPanActive) {
      this._dragPanActive = false;
      this._strokeTool = null;
      this._lastPanClient = null;
      this.lastPoint = null;
      return;
    }

    const tool = this._strokeTool || ToolManager.getCurrentTool();
    const toolEvent = this._toolEvent(e);
    this._strokeTool = null;
    this._penButtons = null;
    if (tool) tool.onPointerUp(point.x, point.y, toolEvent);

    this.lastPoint = null;
  }

  /**
   * Is this press a DIFFERENT pointer from the stroke already in flight — the
   * palm landing during someone else's stroke?
   *
   * A second pointer never takes over a stroke in progress. Before this guard,
   * a palm landing mid-stroke overwrote currentPointerId, which both let the
   * palm draw AND orphaned the stroke it landed during (that stroke's later
   * moves no longer matched the id and were dropped) — so the mark that
   * appeared was a line from the pen to the palm.
   *
   * The one exception is not a timer, it is a fact about the hardware: a mouse
   * and a pen can each have only ONE contact at a time, so a fresh press of the
   * SAME kind proves the held pointer is gone. Without that, a stroke whose
   * pointer vanished without a lift — possible only when setPointerCapture
   * failed, which _capturePointer deliberately tolerates — would leave the
   * canvas undrawable until a reload, since every pen or touch contact gets a
   * new id and could never match the stale one. The takeover used to recover
   * from that by accident. A palm is still blocked, because a palm is 'touch'
   * and the stroke it is interrupting is not.
   * @private
   */
  _isForeignPointer(e) {
    if (!this.isDrawing || this.currentPointerId === null) return false;
    if (e.pointerId === this.currentPointerId) return false;
    if (e.pointerType === this._strokePointerType && e.pointerType !== 'touch') {
      Logger.warn('InputHandler',
        `Stale ${e.pointerType} stroke (pointer ${this.currentPointerId} never lifted) — releasing`);
      this._endActiveStroke(e);
      return false;
    }
    return true;
  }

  /**
   * The pointer samples a move carries: the high-rate coalesced ones where the
   * engine has them, otherwise the event itself.
   *
   * The empty-list fallback is not theoretical. getCoalescedEvents() returns []
   * for any UNTRUSTED event, so a synthetic pointermove — every one the browser
   * test suite dispatches — drove exactly zero samples into the tool, and a
   * stroke made of moves drew nothing at all. Real hardware always yields at
   * least one sample, so nothing changes in production; what changes is that
   * the pipeline can be tested end to end without a hand.
   * @private
   */
  _samplesOf(e) {
    if (typeof e.getCoalescedEvents !== 'function') return [e];
    const samples = e.getCoalescedEvents();
    return (samples && samples.length) ? samples : [e];
  }

  /** setPointerCapture, feature-detected. @private */
  _capturePointer(e) {
    if (this.inputTarget.setPointerCapture) {
      try {
        this.inputTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // Pointer already gone (e.g. cancelled) — stroke continues uncaptured
      }
    }
  }

  /**
   * End the active stroke as if the pointer lifted at its last position
   * (palm arbitration / second-finger gesture start). Commit, don't discard.
   * @private
   */
  _endActiveStroke(e) {
    if (!this.isDrawing) return;
    const synth = {
      pointerId: this.currentPointerId,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      button: 0,
      buttons: 0,
      pressure: 0
    };
    // Route through the normal up path using the real last canvas point
    if (this.currentPointerId !== null &&
        this.inputTarget.hasPointerCapture &&
        this.inputTarget.hasPointerCapture(this.currentPointerId)) {
      this.inputTarget.releasePointerCapture(this.currentPointerId);
    }
    this.isDrawing = false;
    this.currentPointerId = null;
    this._strokePointerType = null;
    this._touchStrokeRevocable = false;

    if (this._stampMode) {
      PixelDrawRoutine.endBatch();
      this._stampMode = null;
    } else if (this._attrPaintMode) {
      PixelDrawRoutine.endBatch();
      this._attrPaintLastCell = null;
    } else if (!this._panMode && !this._dragPanActive) {
      const tool = this._strokeTool || ToolManager.getCurrentTool();
      this._strokeTool = null;
      if (tool && this.lastPoint) {
        tool.onPointerUp(this.lastPoint.x, this.lastPoint.y, synth);
      }
    }
    this._strokeTool = null;
    this._dragPanActive = false;
    this._lastPanClient = null;
    this.lastPoint = null;
  }

  /**
   * Stamp-layer interaction: when the focused layer is a stamp, a click
   * stamps (tip/LMB) or erases (RMB / pen eraser end) instead of drawing.
   * @returns {boolean} True if the event was consumed
   * @private
   */
  _beginStampInteraction(e, point) {
    const current = LayerManager.getCurrentLayer();
    const stamp = (current && current.isStamp) ? current : null;
    if (!stamp) return false;

    // Re-engage floating tracking for THIS stamp (undo/redo can detach it)
    const fp = SelectionService.floatingPaste;
    if (!fp || fp.floatingLayer !== stamp) {
      SelectionService.startComponentReposition(stamp);
    }

    SelectionService.moveStampPreview(point.x, point.y);
    PixelDrawRoutine.beginBatch();
    const erase = e.button === 2 || (e.buttons & 32) !== 0;
    if (erase) {
      SelectionService.eraseAt(stamp);
      this._stampMode = 'erase';
    } else {
      SelectionService.stampAt(stamp);
      this._stampMode = 'stamp';
    }
    CanvasSystem.requestRender();
    return true;
  }

  // ── Hover ─────────────────────────────────────────────────────────────────

  /** @private */
  _handleHover(point, e) {
    const tool = ToolManager.getCurrentTool();
    if (!tool) return;

    if (e.buttons === 0 && typeof tool.onPointerHover === 'function') {
      tool.onPointerHover(point.x, point.y, e);
    }

    // Hover footprint: every tool that has one, on every device that hovers.
    //
    // `buttons === 0` is the real gate — touch pointers only fire pointermove
    // while in contact, so touch is excluded by it and needs no test of its own.
    // Mouse and pen both hover, and both get the outline.
    //
    // The exception is a pen held eraser-first: it is about to erase, not to
    // draw, so the outline must describe the ERASER (see _hoverEraser) and the
    // control's own bit is allowed to be set while it does.
    //
    // A tool that owns the function-preview canvas itself opts out by returning
    // null from getFootprint() (gradient phase 2, bezier handle editing); the
    // two special canvas modes below own it too.
    const eraser = this._hoverEraser(e);
    if ((e.buttons === 0 || eraser) && !this._attrPaintMode && this._patternCaptureSize === 0) {
      this._drawToolFootprint(point, eraser || tool);
    } else {
      this._clearHoverOutline();
    }
  }

  /**
   * The eraser, when a HOVERING pen is carrying a control that would erase —
   * the inverted tail, or any barrel the owner assigned the Eraser action.
   * Null for every other pointer and every other assignment.
   *
   * A press on that control clears the app eraser's disc at the size set in
   * Tool Options (_applyPenAction routes the stroke to the eraser tool
   * instance), so what the hover promises has to be that same disc: outlining
   * the active brush's single pixel and then clearing 128 of them is the app
   * lying about what it is about to do.
   *
   * Whether a tail is visible BEFORE contact is the driver's call — Windows Ink
   * only raises the eraser flag on contact, and on that hardware this returns
   * null throughout the hover and nothing changes. Where the bit does arrive
   * (a barrel button held while hovering always reports its bit), the outline
   * is the erase.
   * @private
   */
  _hoverEraser(e) {
    if (e.pointerType !== 'pen') return null;
    const control = PenMap.controlFromEvent(e);
    if (!control || control === PEN_CONTROLS.TIP.id) return null;
    if (PenMap.actionFor(control, this.getPenConfig()) !== PEN_ACTIONS.ERASER.id) return null;
    return ToolManager.getTool(TOOLS.ERASER) || null;
  }

  /**
   * Ask the active tool for the pixels it would touch here and outline them.
   * Redraws only when the canvas pixel under the cursor changes, or when the
   * tool or one of its options changed (EVENTS.TOOL_SELECTED / TOOL_OPTIONS
   * both invalidate the memo) — so a stationary cursor costs nothing.
   * @private
   */
  _drawToolFootprint(point, tool) {
    if (!window.GridOverlay) return;

    if (this._hoverOutlinePoint &&
        this._hoverOutlinePoint.x === point.x &&
        this._hoverOutlinePoint.y === point.y &&
        this._hoverOutlineTool === tool.id) return;

    const pixels = (typeof tool.getFootprint === 'function')
      ? tool.getFootprint(point.x, point.y)
      : null;

    // A single-pixel footprint is not worth drawing: the outline would sit
    // exactly under the cursor that already points at it, so it reads as
    // flicker rather than information. Only a real blast radius earns the ink.
    // The gate is here, not in the tools — getFootprint() stays truthful about
    // what the tool touches (fill and the eyedropper DO touch one pixel), and
    // rendering is the renderer's call.
    if (!pixels || pixels.length <= 1) {
      this._clearHoverOutline();
      return;
    }

    this._hoverOutlinePoint = { x: point.x, y: point.y };
    this._hoverOutlineTool = tool.id;
    GridOverlay.drawFootprintOutline(pixels);
    this._hoverOutlineShown = true;
  }

  /** @private */
  _clearHoverOutline() {
    this._hoverOutlinePoint = null;
    this._hoverOutlineTool = null;
    if (!this._hoverOutlineShown) return;
    this._hoverOutlineShown = false;
    if (window.GridOverlay) GridOverlay.clearFunctionPreview();
  }

  // ── Two-finger pan + pinch zoom ───────────────────────────────────────────

  /** @private */
  _beginGesture() {
    const pts = Array.from(this.touches.values());
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    this._gesture = {
      active: true,
      initialDistance: Math.hypot(dx, dy),
      initialZoom: StateManager.getZoom() || 100,
      lastCentroid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      previewing: false,
      anchor: null
    };
  }

  /** @private */
  _endGesture() {
    // Fingers lifted: the live preview commits, snapped to a whole level
    if (this._gesture.previewing) CanvasSystem.commitZoomPreview();
    this._gesture = {
      active: false, initialDistance: 0, initialZoom: 100,
      lastCentroid: null, previewing: false, anchor: null
    };
  }

  /** @private */
  _handleGesture() {
    const pts = Array.from(this.touches.values());
    const centroid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

    // Pan: the canvas follows the centroid (fact consumed by CanvasControls,
    // which calls CanvasSystem.pan(-deltaX, -deltaY))
    const last = this._gesture.lastCentroid;
    if (last) {
      const dx = centroid.x - last.x;
      const dy = centroid.y - last.y;
      if (dx !== 0 || dy !== 0) {
        EventBus.emit(EVENTS.INPUT_WHEEL_PAN, { deltaX: -dx, deltaY: -dy });
      }
    }
    this._gesture.lastCentroid = centroid;

    // Pinch: live CSS preview around the anchor pixel (CanvasSystem), so the
    // gesture feels continuous; the zoom itself commits snapped to a whole
    // level when the fingers lift (_endGesture) — integer-scaled rendering
    // without a stepped gesture.
    const scale = this._gesture.initialDistance > 0 ? distance / this._gesture.initialDistance : 1;
    const newZoom = clamp(this._gesture.initialZoom * scale, ZOOM_CONFIG.MIN, ZOOM_CONFIG.MAX);
    if (!this._gesture.previewing) {
      if (Math.abs(newZoom - this._gesture.initialZoom) < 1) return; // dead zone
      // Anchor: the canvas pixel under the centroid when the pinch engages
      this._gesture.anchor =
          this._getCanvasPoint({ clientX: centroid.x, clientY: centroid.y }, false);
      this._gesture.previewing = true;
    }
    CanvasSystem.setZoomPreview(newZoom, this._gesture.anchor.x, this._gesture.anchor.y);
  }

  // ── Touch admission ───────────────────────────────────────────────────────

  /**
   * Note that a PRECISE pointer was just used, which is what the lockout window
   * measures from.
   *
   * A pen counts always, hover included — a pen approaching the glass is the
   * only advance warning that a palm is about to land, and it is why the window
   * catches a palm arriving BEFORE the tip touches down.
   *
   * A mouse counts only while it is dragging (or ending a drag). Counting a
   * hovering mouse would mean a cursor parked anywhere over the canvas silently
   * disabled touch drawing for as long as it sat there, which is a mode nobody
   * chose and nothing announces.
   * @private
   */
  _notePreciseInput(e) {
    if (e.pointerType === 'pen') {
      this._lastPreciseTime = Date.now();
      this._maybeAutoEnablePressure();
      return;
    }
    if (e.pointerType === 'mouse' &&
        (e.buttons !== 0 || this._strokePointerType === 'mouse')) {
      this._lastPreciseTime = Date.now();
    }
  }

  /**
   * The first time this session sees a real pen, and nobody has ever
   * explicitly chosen a Pressure Sensitivity preference (Preferences > Pen —
   * saved just now or in a past session), turn it on. An explicit choice,
   * either way, always wins and this never fires again once one exists —
   * `pressureSensitivityExplicit` is set both when a saved preference is
   * loaded at boot and the moment Preferences is saved, so this can't
   * override a choice made earlier in the same session either.
   * @private
   */
  _maybeAutoEnablePressure() {
    if (this._pressureAutoDecided) return;
    if (StateManager.get('pressureSensitivityExplicit') === true ||
        StateManager.get('pressureSensitivity') === true) {
      this._pressureAutoDecided = true;
      return;
    }
    StateManager.set('pressureSensitivity', true);
    this._pressureAutoDecided = true;
  }

  /**
   * The live inputs to TouchPolicy.decide(). Read at CALL time — a cached copy
   * would go stale the moment a preference changed mid-session.
   * @private
   */
  _touchState() {
    return {
      touchDrawing: StateManager.get('touchDrawing') !== false,
      blockWhileContact: StateManager.get('touchBlockWhileContact') !== false,
      lockoutMs: TouchPolicy.normalizeLockout(StateManager.get('touchLockoutMs')),
      lastPreciseTime: this._lastPreciseTime,
      now: Date.now(),
      activeContact: this.isDrawing ? this._strokePointerType : null
    };
  }

  /**
   * The system took a touch pointer away: palm arbitration. Roll the stroke
   * back rather than committing it — see the pointercancel listener.
   * @private
   */
  _revokeTouchStroke(e) {
    const wasOurs = this.isDrawing && e.pointerId === this.currentPointerId &&
                    this._touchStrokeRevocable;
    if (!wasOurs || !window.UndoRedo) {
      this._onPointerUp(e);
      return;
    }

    // End the stroke through the normal path first, so the tool, the stamp
    // batch and the pan state all close properly. A tool that finishes its
    // shape on pointerup would otherwise be left mid-gesture with its marks
    // pulled out from under it.
    const topBefore = UndoRedo.peekLast();
    this._onPointerUp(e);

    // Roll back only what THIS stroke wrote, and only if it wrote anything: a
    // stroke that marked nothing closes its action without pushing, and a bare
    // undo() there would throw away the artist's PREVIOUS action instead.
    //
    // The test is entry IDENTITY, not stack depth. endAction prunes, so once
    // the history is at its limit a push shifts the oldest entry off and the
    // COUNT is unchanged — a depth test would silently stop rolling palms back
    // after 500 actions, which is both the worst possible failure here and one
    // no test would ever reach.
    if (UndoRedo.isActionOpen()) {
      UndoRedo.revertAction();
    } else {
      const topAfter = UndoRedo.peekLast();
      if (!topAfter || topAfter === topBefore) return;
      UndoRedo.revertLast();
    }
    Logger.debug('InputHandler', 'Touch stroke revoked by palm arbitration');
  }

  /**
   * Whether a finger leaves marks. The single writer of the setting — the
   * status-bar toggle and the Preferences checkbox both come through here, so
   * the two cannot drift and there is one place the fact is announced from.
   * @param {boolean} on
   */
  setTouchDrawing(on) {
    const value = on !== false;
    StateManager.set('touchDrawing', value);
    // Its own Storage key, like gridSnap and symmetryMode: it is toggled from
    // outside the Preferences dialog, and the dialog writes `preferences` as
    // one whole object, which would clobber it.
    if (window.Storage) Storage.set('touchDrawing', value).catch(() => {});
    EventBus.emit(EVENTS.TOUCH_MODE_CHANGED, { drawing: value });
  }

  /** @returns {boolean} whether a finger currently leaves marks */
  getTouchDrawing() {
    return StateManager.get('touchDrawing') !== false;
  }

  // ── Long-press (touch) -> context menu ────────────────────────────────────

  /** @private */
  _startLongPress(e) {
    this._cancelLongPress();
    this._longPressOrigin = { clientX: e.clientX, clientY: e.clientY };
    const pointerId = e.pointerId;
    this._longPressTimer = setTimeout(() => {
      this._longPressTimer = null;
      if (!this._gesture.active && (this.isDrawing || this._dragPanActive) &&
          this.currentPointerId === pointerId) {
        // The finger has been still for the whole window: end the stroke
        // (commit — same semantics as pointercancel) and open the menu.
        this._endActiveStroke({
          pointerType: 'touch',
          clientX: this._longPressOrigin.clientX,
          clientY: this._longPressOrigin.clientY
        });
        this._showCanvasContextMenu(this._longPressOrigin.clientX, this._longPressOrigin.clientY);
      }
    }, this.LONG_PRESS_MS);
  }

  /** @private */
  _cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    this._longPressOrigin = null;
  }

  // ── Canvas context menu ───────────────────────────────────────────────────

  /**
   * Show the selection context menu. Coordinates are iframe-local client
   * coords; converted to main-window coords for CanvasContextMenu.
   * @private
   */
  _showCanvasContextMenu(clientX, clientY) {
    if (!window.CanvasContextMenu) return;
    const iframe = CanvasSystem.getIframe && CanvasSystem.getIframe();
    const iRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
    const screenX = iRect.left + clientX;
    const screenY = iRect.top  + clientY;

    const hasSel  = SelectionService.hasSelection();
    const hasClip = SelectionService.hasClipboard();
    // Rebuilt on every open, so labels always reflect the current locale
    const t = (k, fallback) => {
      if (window.I18n && typeof I18n.t === 'function') {
        const v = I18n.t(k);
        if (v && v !== k) return v;
      }
      return fallback;
    };

    CanvasContextMenu.show(screenX, screenY, [
      {
        label: t('menu.edit.cut', 'Cut'),
        disabled: !hasSel,
        action: () => {
          const sel = SelectionService.getSelection();
          SelectionService.copyToClipboard();
          SelectionService.deleteSelection();
          SelectionService.startFloatingPaste(sel ? sel.x : 0, sel ? sel.y : 0);
          SelectionService.clear();
        }
      },
      {
        label: t('menu.edit.copy', 'Copy'),
        disabled: !hasSel,
        action: () => SelectionService.copyToClipboard()
      },
      {
        label: t('menu.edit.paste', 'Paste'),
        disabled: !hasClip &&
          !(navigator.clipboard && typeof navigator.clipboard.read === 'function'),
        action: () => {
          if (hasClip) {
            const sel = SelectionService.getSelection();
            SelectionService.startFloatingPaste(sel ? sel.x : 0, sel ? sel.y : 0);
            SelectionService.clear();
          } else if (window.FileManager) {
            FileManager.pasteFromSystemClipboard();
          }
        }
      },
      { separator: true },
      {
        label: t('menu.edit.delete', 'Delete'),
        disabled: !hasSel,
        action: () => {
          SelectionService.deleteSelection();
          SelectionService.clear();
          CanvasSystem.requestRender();
        }
      },
      { separator: true },
      {
        label: t('menu.edit.selectAll', 'Select All'),
        action: () => { SelectionService.selectAll(); CanvasSystem.requestRender(); }
      },
      {
        label: t('menu.edit.deselect', 'Deselect'),
        disabled: !hasSel,
        action: () => { SelectionService.clear(); CanvasSystem.requestRender(); }
      }
    ]);
  }

  // ── Coordinates ───────────────────────────────────────────────────────────

  /**
   * Convert an iframe-local pointer event to canvas pixel coordinates.
   * The canvas rect is scaled by the zoom transform, so divide it back out.
   * @param {{clientX: number, clientY: number}} e
   * @param {boolean} [snap=true] - honour the grid-snap preference
   * @returns {{x: number, y: number}}
   * @private
   */
  _getCanvasPoint(e, snap = true) {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    // Measure the scale from the rect itself: correct under DPR-snapped
    // zoom (CanvasSystem.getScale ≠ zoom/100) and the pinch preview.
    const scaleX = rect.width  / ZX_SPECTRUM.WIDTH;
    const scaleY = rect.height / ZX_SPECTRUM.HEIGHT;

    let px = Math.floor((e.clientX - rect.left) / scaleX);
    let py = Math.floor((e.clientY - rect.top) / scaleY);

    if (snap && StateManager.getGridSnap() && this._snapContextActive()) {
      const cellW = ZX_SPECTRUM.CELL_WIDTH;
      const cellH = ZX_SPECTRUM.CELL_HEIGHT;
      px = Math.floor(px / cellW) * cellW;
      py = Math.floor(py / cellH) * cellH;
    }
    return { x: px, y: py };
  }

  /**
   * Grid snap applies to PLACEMENT operations only — selection marquees,
   * shape drags, text/paste stamp positioning — never to freehand strokes
   * (brush/eraser/fill/spray keep pixel accuracy regardless of the toggle).
   * @returns {boolean}
   * @private
   */
  _snapContextActive() {
    if (window.SelectionService && SelectionService.isFloating()) return true;
    const tool = window.ToolManager && ToolManager.getCurrentTool();
    if (!tool) return false;
    return tool.id === TOOLS.SELECTION ||
           tool.id === TOOLS.RECTANGLE || // ShapeTool base — all shape variants
           tool.id === TOOLS.BEZIER ||    // anchor/handle placement
           tool.id === TOOLS.TEXT;
  }

  /** Record pen tilt; hand it to the brush engine where the hook exists. @private */
  _updateTilt(e) {
    if (typeof e.tiltX !== 'number') return;
    this.tilt = { x: e.tiltX || 0, y: e.tiltY || 0 };
    if (window.BrushEngine && typeof BrushEngine.setTilt === 'function') {
      BrushEngine.setTilt(this.tilt.x, this.tilt.y);
    }
  }

  // ── Wheel ─────────────────────────────────────────────────────────────────

  /** @private */
  _attachWheelEvents() {
    this.inputTarget.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const point = this._getCanvasPoint(e, false);
        // delta carries the deltaY sign: positive (wheel down) = zoom out
        EventBus.emit(EVENTS.INPUT_WHEEL_ZOOM, { delta: e.deltaY, x: point.x, y: point.y });
      } else {
        EventBus.emit(EVENTS.INPUT_WHEEL_PAN, { deltaX: e.deltaX, deltaY: e.deltaY });
      }
    }, { passive: false });
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  /**
   * Single-key tool shortcuts, GENERATED from the TOOL_GROUPS registry —
   * the same source that renders the rail and the shortcuts dialog. Includes
   * the 'shape' umbrella id (ToolManager routes it onto ShapeTool).
   * @returns {Map<string, string>} lowercase key -> tool id
   * @private
   */
  _buildToolShortcutMap() {
    const map = new Map();
    for (const group of TOOL_GROUPS) {
      for (const meta of group.tools) {
        if (meta.shortcut) map.set(meta.shortcut.toLowerCase(), meta.id);
      }
    }
    return map;
  }

  /**
   * Re-attach keyboard shortcuts to the CURRENT live iframe document after a
   * srcdoc re-navigation (see the load hook in init). Idempotent per document:
   * it binds only when the live document differs from the one already bound,
   * so a load event that returns the same document is a no-op. Pointer /
   * wheel / rendering are deliberately untouched.
   * @private
   */
  _rebindIframeKeyboard() {
    const iframe = CanvasSystem.getIframe && CanvasSystem.getIframe();
    if (!iframe) return;
    let doc = null;
    try {
      doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
    } catch (e) {
      doc = null;
    }
    if (!doc || doc === this._keyboardDoc) return;
    this._keyboardDoc = doc;
    this._attachKeyboardEvents(doc);
    Logger.debug('InputHandler', 'Re-bound keyboard to re-navigated iframe document');
  }

  /** @private */
  _attachKeyboardEvents(doc) {
    doc.addEventListener('keydown', (e) => {
      if (this._isTypingTarget(e.target)) return;
      this.keysDown.add(e.key);
      this._updateModifiers(e);
      this._handleKeyboardShortcut(e);
    });

    doc.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
      this._updateModifiers(e);
      if (e.key === ' ' && this._panMode) {
        this._panMode = false;
        this._lastPanClient = null;
        EventBus.emit(EVENTS.SHORTCUT_PAN_MODE, { active: false });
      }
    });

    // Only attach the blur reset once (init calls this per document)
    if (doc === document) {
      window.addEventListener('blur', () => {
        // The main window also "blurs" when focus moves INTO the canvas
        // iframe (e.g. select a zoom level, then space+drag to pan) — that
        // is an in-app focus move, not the user leaving. document.hasFocus()
        // stays true while focus is anywhere in our frame tree, so defer one
        // tick and only reset when the user genuinely left the window.
        setTimeout(() => {
          if (document.hasFocus()) return;
          this.keysDown.clear();
          this.modifiers = { shift: false, ctrl: false, alt: false, meta: false };
          if (this._panMode) {
            this._panMode = false;
            EventBus.emit(EVENTS.SHORTCUT_PAN_MODE, { active: false });
          }
        }, 0);
      });
    }
  }

  /** Keys typed into inputs/textareas/selects/dialogs are never shortcuts. @private */
  _isTypingTarget(target) {
    return !!(target && target.closest &&
      target.closest('input, textarea, select, dialog, [contenteditable="true"]'));
  }

  /** @private */
  _updateModifiers(e) {
    this.modifiers.shift = e.shiftKey;
    this.modifiers.ctrl = e.ctrlKey;
    this.modifiers.alt = e.altKey;
    this.modifiers.meta = e.metaKey;
  }

  /**
   * Universal Escape — cancels everything in progress and returns to the
   * brush tool ready to draw. Works from any state.
   * @private
   */
  _handleEscape(e) {
    e.preventDefault();

    // 1. End any in-progress stroke (close open batches so undo stays sound)
    if (this.isDrawing) {
      if (this.currentPointerId !== null &&
          this.inputTarget && this.inputTarget.hasPointerCapture &&
          this.inputTarget.hasPointerCapture(this.currentPointerId)) {
        this.inputTarget.releasePointerCapture(this.currentPointerId);
      }
      if (PixelDrawRoutine.isInBatch) PixelDrawRoutine.endBatch();
      this.isDrawing = false;
      this.currentPointerId = null;
      this.lastPoint = null;
      this._stampMode = null;
      this._strokeTool = null;
      this.touches.clear();
      this._endGesture();
      this._cancelLongPress();
    }

    // 2. Cancel floating paste / stamp placement
    if (SelectionService.isFloating()) {
      SelectionService.cancelFloatingPaste();
      this._stampMode = null;
    }

    // 3. Exit pattern capture. An armed attribute operation is STICKY and
    //    survives Escape — only a new draw method or clicking its own
    //    Swap/Recolour button off disarms it.
    this.exitPatternCaptureMode();

    // 4. Clear any active selection marquee
    if (SelectionService.hasSelection()) {
      SelectionService.clear();
    }

    // 5. Back to the brush, ready to draw. Flagged so the TOOL_SELECTED
    //    handler reads this as an incidental reset rather than a deliberate
    //    new draw method, and leaves the armed attribute operation alone.
    this._escapeToolReset = true;
    try {
      ToolManager.selectTool(TOOLS.BRUSH);
    } finally {
      this._escapeToolReset = false;
    }
    CanvasSystem.requestRender();
  }

  /**
   * Arrow-key nudge. Floating stamp -> reposition; active selection -> shift
   * its contents (wrap, matching the old app's arrow behaviour). Step comes
   * from the nudgeStep preference; with grid snap on it becomes one cell so
   * nudged placement stays cell-aligned. No stamp and no selection -> arrows
   * stay free.
   * @param {KeyboardEvent} e
   * @param {string} key - lowercased e.key ('arrowup' … 'arrowright')
   * @private
   */
  _handleArrowNudge(e, key) {
    const dir = {
      arrowup:    { dx: 0,  dy: -1, name: 'up' },
      arrowdown:  { dx: 0,  dy: 1,  name: 'down' },
      arrowleft:  { dx: -1, dy: 0,  name: 'left' },
      arrowright: { dx: 1,  dy: 0,  name: 'right' }
    }[key];
    if (!dir) return;

    const prefStep = clamp(parseInt(StateManager.get('nudgeStep'), 10) || 1, 1, 32);
    // Snap-nudge steps one cell — per axis, since cells are not square in
    // the multicolor modes (8 wide × 1/2/4 tall)
    const snap = StateManager.getGridSnap();
    const stepX = snap ? ZX_SPECTRUM.CELL_WIDTH : prefStep;
    const stepY = snap ? ZX_SPECTRUM.CELL_HEIGHT : prefStep;
    const step = dir.dx !== 0 ? stepX : stepY;

    if (SelectionService.isFloating()) {
      e.preventDefault();
      const fp = SelectionService.floatingPaste;
      SelectionService.moveFloatingPaste(fp.x + dir.dx * step, fp.y + dir.dy * step);
      return;
    }

    if (SelectionService.hasSelection()) {
      e.preventDefault();
      TransformService.shift(dir.name, step);
      CanvasSystem.requestRender();
    }
  }

  /** @private */
  _handleKeyboardShortcut(e) {
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    if (key === 'escape') {
      this._handleEscape(e);
      return;
    }

    // F1 — keyboard shortcuts dialog
    if (e.key === 'F1') {
      e.preventDefault();
      if (window.MenuSystem && typeof MenuSystem.showShortcuts === 'function') {
        MenuSystem.showShortcuts();
      }
      return;
    }

    // Enter commits the floating paste/stamp
    if (key === 'enter' && SelectionService.isFloating()) {
      e.preventDefault();
      const fp = SelectionService.floatingPaste;
      if (fp && fp.floatingLayer && fp.floatingLayer.isStamp) {
        SelectionService.commitActiveStamp();
      } else {
        SelectionService.endFloatingPaste();
      }
      this._stampMode = null;
      return;
    }

    // ── Ctrl combos ──
    if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); UndoRedo.undo(); return; }
    if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); UndoRedo.redo(); return; }
    if (ctrl && key === 's') {
      e.preventDefault();
      if (e.shiftKey) FileManager.saveAs(); else FileManager.save();
      return;
    }
    if (ctrl && key === 'o') { e.preventDefault(); FileManager.openFile(); return; }
    if (ctrl && key === 'n') { e.preventDefault(); FileManager.newFile(); return; }
    if (ctrl && key === 'a') {
      e.preventDefault();
      SelectionService.selectAll();
      CanvasSystem.requestRender();
      return;
    }
    if (ctrl && key === 'd') {
      e.preventDefault();
      SelectionService.clear();
      CanvasSystem.requestRender();
      return;
    }
    if (ctrl && key === 'c') {
      e.preventDefault();
      if (SelectionService.hasSelection()) SelectionService.copyToClipboard();
      return;
    }
    // Paste: internal clipboard first; otherwise leave the keydown
    // unprevented so the native 'paste' event fires and FileManager can
    // rip a system-clipboard image into a floating stamp (QW1).
    if (ctrl && key === 'v') {
      if (SelectionService.hasClipboard()) {
        e.preventDefault();
        SelectionService.startFloatingPaste(0, 0);
        SelectionService.clear();
      }
      return;
    }
    if (ctrl && key === 'x') {
      e.preventDefault();
      if (SelectionService.hasSelection()) {
        const sel = SelectionService.getSelection();
        SelectionService.copyToClipboard();
        SelectionService.deleteSelection();
        SelectionService.startFloatingPaste(sel.x, sel.y);
        SelectionService.clear();
      }
      return;
    }

    // Preset recall: Alt+1..Alt+9 load the first nine slots. Alt+0 is NOT one
    // of them — it keeps meaning "zoom to actual size", the way it always has.
    //
    // Alt rather than Ctrl because Chrome and Firefox reserve Ctrl+digit for
    // tab switching and a page cannot intercept it; and rather than a bare
    // digit because 1-8 already set the ink colour (below). An empty slot does
    // nothing — see PresetService.applyByDigit.
    if (e.altKey && !ctrl && !e.shiftKey) {
      const presetDigit = e.code && e.code.match(/^Digit([1-9])$/);
      if (presetDigit) {
        e.preventDefault();
        PresetService.applyByDigit(presetDigit[1]);
        return;
      }
    }

    // NOTE: this sits ABOVE every unmodified-key shortcut on purpose — an Alt
    // chord must be resolved before any bare key, or a bare-key branch that
    // ignores altKey swallows it. That is exactly what the '0' zoom shortcut
    // below did to Alt+0 while it was a preset key (found by
    // tests/browser/presets.spec.js).

    // ── Arrow keys: nudge the floating stamp / shift the selection ──
    // Phase 5 deliberately left the arrows unbound; they now nudge at the
    // configurable step (pref.nudgeStep), or one attribute cell with grid
    // snap on, whenever a stamp is floating or a selection is active.
    if (key.startsWith('arrow')) {
      this._handleArrowNudge(e, key);
      return;
    }

    if (key === 'delete' || key === 'backspace') {
      if (SelectionService.hasSelection()) {
        e.preventDefault();
        SelectionService.deleteSelection();
        CanvasSystem.requestRender();
      }
      return;
    }

    // ── Zoom: + / − step, 0 = actual size (Ctrl+0 also) ──
    if (key === '+' || key === '=') {
      this._stepZoom(1);
      return;
    }
    if (key === '-') {
      this._stepZoom(-1);
      return;
    }
    if (key === '0') {
      if (ctrl) e.preventDefault();
      CanvasSystem.setZoom(ZOOM_CONFIG.MIN);
      return;
    }

    // Space engages pan mode (drag to scroll)
    if (key === ' ' && !this.isDrawing) {
      e.preventDefault();
      if (!this._panMode) {
        this._panMode = true;
        EventBus.emit(EVENTS.SHORTCUT_PAN_MODE, { active: true });
      }
      return;
    }

    // Grid snap toggle (Shift+S)
    if (!ctrl && e.shiftKey && !e.altKey && key === 's') {
      e.preventDefault();
      StateManager.setGridSnap(!StateManager.getGridSnap());
      return;
    }

    // ── Tool shortcuts — generated from TOOL_GROUPS ──
    if (!ctrl && !e.shiftKey && !e.altKey) {
      const toolId = this._toolShortcuts.get(key);
      if (toolId) {
        ToolManager.selectTool(toolId);
        return;
      }
      // Swap ink/paper (not a registry tool — colour operation)
      if (key === 'x') {
        e.preventDefault();
        ColorManager.swapColors();
        return;
      }
    }

    // Colour keys: 1–8 set INK, Shift+1–8 set PAPER
    if (!ctrl && !e.altKey) {
      const digitMatch = e.code && e.code.match(/^Digit([1-8])$/);
      if (digitMatch) {
        e.preventDefault();
        const colorIndex = parseInt(digitMatch[1], 10) - 1;
        if (e.shiftKey) ColorManager.setPaper(colorIndex);
        else ColorManager.setInk(colorIndex);
        return;
      }
    }

    // Fact for anything listening to raw key input
    EventBus.emit(EVENTS.INPUT_KEY_DOWN, {
      key: e.key,
      code: e.code,
      modifiers: { ...this.modifiers }
    });
  }

  /** Keyboard zoom step (no UI dependency — commands go down). @private */
  _stepZoom(direction) {
    const zoom = StateManager.getZoom() || ZOOM_CONFIG.DEFAULT;
    CanvasSystem.setZoom(ZOOM_CONFIG.step(zoom, direction));
  }

  // ── Browser default suppression ──────────────────────────────────────────

  /** @private */
  _preventDefaults() {
    const target = this.inputTarget;

    // The browser must never steal a stroke for scrolling/selection/drag
    target.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) e.preventDefault();
    }, { passive: false });
    target.addEventListener('dragstart', (e) => e.preventDefault());

    target.style.touchAction = 'none';
    target.style.userSelect = 'none';
    target.style.webkitUserSelect = 'none';
  }

  // ── Public state accessors ────────────────────────────────────────────────

  /** @returns {boolean} True if the given key is currently pressed */
  isKeyDown(key) {
    return this.keysDown.has(key);
  }

  /** @returns {{shift: boolean, ctrl: boolean, alt: boolean, meta: boolean}} */
  getModifiers() {
    return { ...this.modifiers };
  }

  /** @returns {number} Current stylus pressure (0.0–1.0; 1.0 for mouse) */
  getPressure() {
    return this.pressure;
  }

  /** @returns {{x: number, y: number}} Last reported pen tilt in degrees */
  getTilt() {
    return { ...this.tilt };
  }

  /** @returns {boolean} */
  getIsDrawing() {
    return this.isDrawing;
  }
}

window.InputHandler = new InputHandlerClass();

Logger.debug('InputHandler', 'Input handler loaded');

})(); // End IIFE
