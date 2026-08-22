/**
 * Canvas System
 *
 * Handles all canvas rendering and coordinate transformation
 */

'use strict';

(function() {

// Scroll headroom around the scaled canvas inside the iframe shell
const SCROLL_MARGIN = 64;

class CanvasSystemClass {
  constructor() {
    // Canvas references
    this.canvas = null;
    this.ctx = null;
    this.iframe = null;
    this.iframeDoc = null;

    // Display state
    this.zoom = DEFAULT_ZOOM;
    this.panX = 0;
    this.panY = 0;
    this._pendingScroll = null;  // scroll target consumed by updateCanvasSize (zoomTo)
    this._zoomPreview = null;    // live pinch preview { baseScale, zoom, ax, ay }

    // ImageData for efficient pixel manipulation
    this.imageData = null;
    this.pixels = null;  // Uint32Array view of imageData

    // Dirty tracking
    this.dirtyRegions = new Set();  // Set of "cellX,cellY" strings
    this.fullRedrawNeeded = true;

    // Cached canvas rect for coordinate transformation
    this.canvasRect = null;
    this.rectCacheTime = 0;
    this.RECT_CACHE_DURATION = 100;  // ms

    // Animation frame
    this.rafId = null;
    this.renderPending = false;

    // Initialization state
    this._initialized = false;
    this._initCallbacks = [];

    // Event listener cleanup
    this._eventUnsubscribers = [];
    this._boundOnZoomChanged = null;
    this._boundOnCanvasModified = null;
  }

  /**
   * Initialize the canvas system
   * @returns {Promise} Resolves when iframe is loaded and canvas is ready
   */
  initialize() {
    return new Promise((resolve, reject) => {
      this.iframe = document.getElementById('canvas-frame');
      if (!this.iframe) {
        reject(new Error('Canvas iframe not found'));
        return;
      }

      // Store resolve for use in _initFromIframe
      this._initResolve = resolve;
      this._initReject = reject;

      // Add load listener first to avoid race condition
      this.iframe.addEventListener('load', () => {
        Logger.debug('CanvasSystem', 'Iframe load event fired');
        if (this._initialized) {
          // Chromium re-navigates srcdoc iframes on file:// after the initial
          // load (the benign "unique security origins" fallback). The fresh
          // body drops the backdrop mirror, so the border/theme colour would
          // show only as a thin strip of #canvas-area around the iframe. The
          // render loop runs on the PARENT window and keeps drawing, so all
          // that needs restoring on the new body is the backdrop.
          this.syncBackdropColor();
          return;
        }
        this._initFromIframe();
      });

      // Check if already loaded (handles case where load fired before listener added)
      const checkLoaded = () => {
        try {
          const doc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
          if (doc && doc.getElementById('main-canvas')) {
            Logger.debug('CanvasSystem', 'Iframe already loaded');
            this._initFromIframe();
            return true;
          }
        } catch (e) {
          // Cross-origin or not yet loaded
        }
        return false;
      };

      // Try immediately
      if (!checkLoaded()) {
        Logger.debug('CanvasSystem', 'Waiting for iframe load event');

        // Poll as fallback (some browsers/protocols don't fire load reliably)
        let attempts = 0;
        const pollInterval = setInterval(() => {
          attempts++;
          if (checkLoaded() || this._initialized) {
            clearInterval(pollInterval);
          } else if (attempts > 50) { // 5 seconds max
            clearInterval(pollInterval);
            Logger.error('CanvasSystem', 'Iframe load timeout');
            if (this._initReject) {
              this._initReject(new Error('Iframe load timeout'));
            }
          }
        }, 100);
      }
    });
  }

  /**
   * Initialize from loaded iframe
   * @private
   */
  _initFromIframe() {
    // Guard against multiple calls
    if (this._initialized) {
      return;
    }

    try {
      this.iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
    } catch (e) {
      Logger.error('CanvasSystem', 'Cannot access iframe document', e);
      if (this._initReject) {
        this._initReject(new Error('Cannot access iframe document'));
      }
      return;
    }

    this.canvas = this.iframeDoc.getElementById('main-canvas');

    if (!this.canvas) {
      Logger.error('CanvasSystem', 'Main canvas not found in iframe');
      if (this._initReject) {
        this._initReject(new Error('Main canvas not found in iframe'));
      }
      return;
    }

    // Pen/mouse-to-pixel latency, not readback speed, is what this canvas is
    // tuned for: it is a pure putImageData sink (getImageData() below returns
    // the cached JS-side buffer, never a canvas readback — the only ctx-level
    // getImageData calls in the codebase run on OTHER, throwaway canvases in
    // io/ and the selection/text/pattern tools). `willReadFrequently` forces a
    // software-rendered canvas, which was paying that cost for a readback
    // pattern that does not happen here — and a software canvas cannot be
    // handed to the display controller the way `desynchronized` wants.
    // `desynchronized` (P, developer.chrome.com/blog/desynchronized,
    // 2026-08-12 read) lets the browser skip the compositor queue and in some
    // cases hand this canvas's buffer straight to the display controller,
    // which is what stylus apps need to stay under the ~50ms hand-eye
    // coordination threshold the same article cites — safe here because the
    // canvas is opaque (alpha: false) and the render loop already writes a
    // whole new frame with putImageData rather than clearing in place, which
    // is the flicker-avoidance pattern the hint calls for.
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });

    this.ctx.imageSmoothingEnabled = false;

    // Paper colour from the single palette source (constants.js) — the
    // iframe srcdoc deliberately carries no palette hex values.
    this.canvas.style.backgroundColor = ZX_PALETTE[7];

    this.imageData = this.ctx.createImageData(
      ZX_SPECTRUM.WIDTH,
      ZX_SPECTRUM.HEIGHT
    );

    this.pixels = new Uint32Array(this.imageData.data.buffer);

    this.zoom = StateManager.getZoom();
    this.updateCanvasSize();

    // Store bound functions for proper unsubscription
    this._boundOnZoomChanged = this._onZoomChanged.bind(this);
    this._boundOnCanvasModified = this._onCanvasModified.bind(this);

    this._eventUnsubscribers.push(
      EventBus.on(EVENTS.CANVAS_ZOOM, this._boundOnZoomChanged),
      EventBus.on(EVENTS.CANVAS_DIRTY, this._boundOnCanvasModified)
    );

    this._startRenderLoop();
    this._watchDevicePixelRatio();

    this.clear();
    this.syncBackdropColor();

    this._initialized = true;

    // Run any callbacks waiting for initialization
    this._initCallbacks.forEach(cb => cb());
    this._initCallbacks = [];

    // Resolve the initialization promise
    if (this._initResolve) {
      this._initResolve();
      this._initResolve = null;
    }

    Logger.info('CanvasSystem', 'Initialized with iframe');
  }

  /**
   * Check if canvas system is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Run callback when initialized
   * @param {Function} callback
   */
  onReady(callback) {
    if (this._initialized) {
      callback();
    } else {
      this._initCallbacks.push(callback);
    }
  }

  /**
   * Get canvas element from iframe
   * @param {string} id - Canvas element ID
   * @returns {HTMLCanvasElement|null}
   */
  getCanvasElement(id) {
    if (!this.iframeDoc) return null;
    return this.iframeDoc.getElementById(id);
  }

  /**
   * Get the iframe document
   * @returns {Document|null}
   */
  getIframeDocument() {
    return this.iframeDoc;
  }

  /**
   * Get the iframe element
   * @returns {HTMLIFrameElement|null}
   */
  getIframe() {
    return this.iframe;
  }

  /**
   * Re-apply the active screen mode's geometry to every canvas in the
   * iframe (Phase 12a — called by ScreenModeService after a mode switch).
   * Resizes the drawing stack + overlay canvases, the container, and
   * recreates the imageData buffer. All 12a modes share 256×192 so this
   * is currently a same-size rebuild, but the path is generic — 12b's
   * Timex hi-res 512×192 rides on it.
   */
  applyScreenMode() {
    if (!this._initialized || !this.iframeDoc) return;

    const w = ZX_SPECTRUM.WIDTH;
    const h = ZX_SPECTRUM.HEIGHT;

    const container = this.iframeDoc.getElementById('canvas-container');
    if (container) {
      container.style.width = w + 'px';
      container.style.height = h + 'px';
      // Every canvas in the drawing stack (incl. dynamically created
      // overlays) takes the mode's intrinsic size. Resizing clears them;
      // the compositor / overlay owners repaint on SCREEN_MODE_CHANGED.
      container.querySelectorAll('canvas').forEach((canvas) => {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      });
    }

    this.imageData = this.ctx.createImageData(w, h);
    this.pixels = new Uint32Array(this.imageData.data.buffer);
    this.pixels.fill(0xFF000000);

    this.updateCanvasSize();
    this.invalidateRectCache();
    this.fullRedrawNeeded = true;
    this.requestRender();
  }

  /**
   * Create (or return an existing) overlay canvas inside the iframe's
   * #canvas-container. The sanctioned path for services (reference layer,
   * onion skin, …) to obtain an in-iframe canvas without touching the DOM
   * themselves (architecture rule: DOM access lives in canvas-system only).
   * The canvas is sized to the active screen mode and positioned to overlay
   * the drawing stack; stacking order is controlled via zIndex.
   * @param {Object} opts
   * @param {string} opts.id - Element id; if it already exists it is returned as-is
   * @param {string} [opts.className]
   * @param {number|string} [opts.zIndex=10]
   * @returns {HTMLCanvasElement|null} null when the iframe is not ready
   */
  createOverlayCanvas({ id, className = '', zIndex = 10 } = {}) {
    if (!this.iframeDoc || !id) return null;
    const existing = this.iframeDoc.getElementById(id);
    if (existing) {
      // Refresh geometry when the screen mode changed since creation
      if (existing.width !== ZX_SPECTRUM.WIDTH || existing.height !== ZX_SPECTRUM.HEIGHT) {
        existing.width  = ZX_SPECTRUM.WIDTH;
        existing.height = ZX_SPECTRUM.HEIGHT;
        existing.style.width  = ZX_SPECTRUM.WIDTH + 'px';
        existing.style.height = ZX_SPECTRUM.HEIGHT + 'px';
      }
      return existing;
    }
    const container = this.iframeDoc.getElementById('canvas-container');
    if (!container) return null;

    const canvas = this.iframeDoc.createElement('canvas');
    canvas.id = id;
    if (className) canvas.className = className;
    canvas.width = ZX_SPECTRUM.WIDTH;
    canvas.height = ZX_SPECTRUM.HEIGHT;
    // Intrinsic-size CSS: #canvas-container's scale() transform applies the zoom,
    // so the overlay must NOT be sized in scaled pixels (that would compound).
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = ZX_SPECTRUM.WIDTH + 'px';
    canvas.style.height = ZX_SPECTRUM.HEIGHT + 'px';
    canvas.style.pointerEvents = 'none';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.zIndex = String(zIndex);
    container.appendChild(canvas);
    return canvas;
  }

  /**
   * Set the pointer cursor shown over the canvas area.
   * Tools stay DOM-free — they command this through CanvasSystem
   * (move/zoom grab/zoom cursors; UI applies tool.cursor on TOOL_SELECTED).
   * @param {string} cursor - CSS cursor value
   */
  setCanvasCursor(cursor) {
    if (this.iframeDoc && this.iframeDoc.body) {
      this.iframeDoc.body.style.cursor = cursor || 'default';
    }
  }

  /**
   * Current scroll offset of the canvas viewport (the iframe scrolls its body).
   * @returns {{x: number, y: number}}
   */
  getScrollPosition() {
    const s = this.iframeDoc && (this.iframeDoc.scrollingElement || this.iframeDoc.body);
    return s ? { x: s.scrollLeft, y: s.scrollTop } : { x: 0, y: 0 };
  }

  /**
   * Set the scroll offset of the canvas viewport (used by the move tool to pan).
   * @param {number} x @param {number} y
   */
  setScrollPosition(x, y) {
    const s = this.iframeDoc && (this.iframeDoc.scrollingElement || this.iframeDoc.body);
    if (!s) return;
    s.scrollLeft = x;
    s.scrollTop = y;
  }

  /**
   * Visible size of the canvas viewport (used by zoom fit-to-window).
   * @returns {{width: number, height: number}}
   */
  getViewportSize() {
    return {
      width: this.iframe ? this.iframe.clientWidth : 0,
      height: this.iframe ? this.iframe.clientHeight : 0
    };
  }

  /** devicePixelRatio of the rendering context. @private */
  _dpr() {
    const w = this.iframe && this.iframe.contentWindow;
    return (w && w.devicePixelRatio) || window.devicePixelRatio || 1;
  }

  /**
   * Effective CSS scale for a nominal zoom: snapped so every ZX pixel covers
   * a whole number of DEVICE pixels. At DPR 1 this is exactly zoom/100; at
   * fractional OS scaling (125%/150% Windows) it deviates slightly from
   * nominal so pixels render as uniform squares instead of shimmering —
   * the same reason Validators.isValidZoom demands whole steps.
   * @param {number} zoom - nominal zoom percentage
   * @returns {number} CSS scale factor
   */
  getScaleFor(zoom) {
    const dpr = this._dpr();
    return Math.max(1, Math.round((zoom / 100) * dpr)) / dpr;
  }

  /** Effective CSS scale at the current zoom. */
  getScale() {
    return this.getScaleFor(this.zoom);
  }

  /**
   * Largest whole zoom level whose effective footprint fits the viewport.
   * No safety margin: the iframe's own scrollbar (when the canvas overflows
   * ITS document) never shrinks `iframe.clientWidth`/`clientHeight` as
   * measured from the outer document, so a snug fit needs no headroom — a
   * flat px margin here previously made Fit stop a whole level early
   * whenever the true fit landed within that margin of the boundary
   * (measured 2026-08-22: at DPR 1 and DPR 2 a 40px margin picked 200%
   * while 300% rendered with zero overflow). Uses the same rounding as
   * `updateCanvasSize()` so this predicts exactly what gets rendered.
   * @returns {number} Zoom percentage
   */
  fitZoom() {
    const { width, height } = this.getViewportSize();
    if (!width || !height) return ZOOM_CONFIG.DEFAULT;
    const levels = ZOOM_CONFIG.LEVELS;
    for (let i = levels.length - 1; i >= 0; i--) {
      const s = this.getScaleFor(levels[i]);
      const scaledW = Math.round(ZX_SPECTRUM.WIDTH * s);
      const scaledH = Math.round(ZX_SPECTRUM.HEIGHT * s);
      if (scaledW <= width && scaledH <= height) {
        return levels[i];
      }
    }
    return ZOOM_CONFIG.MIN;
  }

  /**
   * Update canvas display size based on zoom
   */
  updateCanvasSize() {
    if (!this.iframeDoc) return;

    const scale = this.getScale();
    const scaledW = Math.round(ZX_SPECTRUM.WIDTH * scale);
    const scaledH = Math.round(ZX_SPECTRUM.HEIGHT * scale);

    // The SCROLL_MARGIN is over-scroll room so a zoomed-in canvas can be panned
    // past its edges. Add it ONLY on an axis where the canvas is bigger than the
    // viewport (i.e. it actually needs scrolling). On an axis where the canvas
    // already fits, the shell equals the canvas exactly, so flexbox centres it
    // with no scrollbar — a zoom level that fits entirely never scrolls.
    const vp = this.getViewportSize();
    const marginX = (vp.width && scaledW > vp.width) ? SCROLL_MARGIN : 0;
    const marginY = (vp.height && scaledH > vp.height) ? SCROLL_MARGIN : 0;
    const shellW = scaledW + marginX * 2;
    const shellH = scaledH + marginY * 2;

    // The shell is the only thing inside body. Its fixed size IS the scrollable area.
    // Flexbox centring on body handles the small-zoom case (shell smaller than viewport).
    // flex-shrink:0 ensures shell stays exact size, body overflows, scrollbars activate.
    const shell = this.iframeDoc.getElementById('canvas-shell');
    if (shell) {
      shell.style.width  = shellW + 'px';
      shell.style.height = shellH + 'px';
    }

    // Place canvas-container and grid-wrapper at the per-axis margin inside shell.
    // transform-origin:top left means scale(s) extends visually from there to +scaledX.
    const container = this.iframeDoc.getElementById('canvas-container');
    if (container) {
      container.style.left = marginX + 'px';
      container.style.top  = marginY + 'px';
      container.style.transform = `scale(${scale})`;
    }
    const gw = this.iframeDoc.getElementById('grid-wrapper');
    if (gw) {
      gw.style.left   = marginX + 'px';
      gw.style.top    = marginY + 'px';
      gw.style.width  = scaledW + 'px';
      gw.style.height = scaledH + 'px';
    }

    // Place the scroll: a pending target from zoomTo() (anchored zoom) wins;
    // otherwise centre the shell so the canvas appears in the middle
    // (boot, mode switches, restore paths).
    const body = this.iframeDoc.body;
    const scroller = this.iframeDoc.scrollingElement || body;
    if (scroller) {
      const pending = this._pendingScroll;
      this._pendingScroll = null;
      const place = () => {
        if (pending) {
          scroller.scrollLeft = pending.left;
          scroller.scrollTop  = pending.top;
        } else {
          scroller.scrollLeft = Math.max(0, (scroller.scrollWidth  - scroller.clientWidth)  / 2);
          scroller.scrollTop  = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
        }
      };
      if (this.iframe && this.iframe.contentWindow) {
        this.iframe.contentWindow.requestAnimationFrame(place);
      } else {
        place();
      }
    }

    // Invalidate cached rect
    this.canvasRect = null;

    this.fullRedrawNeeded = true;
    this.requestRender();
  }

  /**
   * Push #canvas-area's resolved background colour into the iframe body.
   * The canvas iframe is loaded via srcdoc on file://, which Chromium treats
   * as a unique/opaque origin (the benign "unique security origins" console
   * warning noted in the browser test harness) — cross-process iframes in
   * that state do not compositor-blend a transparent body through to the
   * parent, so the CSS-only approach (#canvas-area background showing
   * through a transparent iframe) renders opaque white regardless of the
   * theme or the BorderControl preview. Reading the already-resolved colour
   * here (rather than re-deriving it from theme/border state) keeps this a
   * single mirror of whatever #canvas-area actually shows.
   *
   * The same boundary blocks custom properties, so the theme's --canvas-edge
   * (the hairline separating the picture from the border colour) is mirrored
   * here too: one call keeps both the border colour and the edge line current
   * on every theme switch, border pick and srcdoc re-navigation.
   */
  syncBackdropColor() {
    const area = document.getElementById('canvas-area');
    if (!area) return;

    // Read the SETTLED backdrop colour. #canvas-area's background may be
    // mid-transition when a border/theme change fires this (Chrome animates it
    // when motion is enabled), and getComputedStyle returns the interpolated
    // value — the transition's START colour at t=0. Writing that to the iframe
    // body pins it one border selection behind #canvas-area (the frame finishes
    // animating to the new colour, the iframe interior stays on the old one).
    // Suppressing the transition and forcing a reflow snaps the read to the
    // target colour, and the reflow also settles any custom-property recalc.
    // Use an inline !important override so it also beats a stylesheet-level
    // !important transition (e.g. one injected by a browser extension such as
    // Dark Reader) — inline !important wins the cascade over any selector.
    const prevValue = area.style.getPropertyValue('transition');
    const prevPriority = area.style.getPropertyPriority('transition');
    area.style.setProperty('transition', 'none', 'important');
    void area.offsetWidth; // force style/layout recalc
    const color = getComputedStyle(area).backgroundColor;
    if (prevValue) area.style.setProperty('transition', prevValue, prevPriority);
    else area.style.removeProperty('transition');

    // Target the LIVE iframe document, not the cached this.iframeDoc: Chromium
    // re-navigates srcdoc iframes on file://, replacing the body our cached
    // reference points at, so a cached-body write lands on a detached body
    // while the visible one stays unpainted (border shows only as a strip).
    const edge = getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas-edge').trim();

    let doc = null;
    try {
      doc = (this.iframe && (this.iframe.contentDocument
        || (this.iframe.contentWindow && this.iframe.contentWindow.document)))
        || this.iframeDoc;
    } catch (e) {
      doc = this.iframeDoc;
    }
    const body = doc && doc.body;
    if (!body) return;
    body.style.backgroundColor = color;
    // Set it on the iframe's own root so the srcdoc rule's var() resolves;
    // an unset property leaves the outline on its `transparent` fallback.
    if (edge) doc.documentElement.style.setProperty('--canvas-edge', edge);
  }

  /**
   * Clear the canvas to black
   */
  clear() {
    // Fill pixels array with black (0xFF000000 in ABGR format)
    this.pixels.fill(0xFF000000);
    this.fullRedrawNeeded = true;
    this.requestRender();
  }

  /**
   * Set a pixel color in the buffer
   * @param {number} x - X coordinate (0-255)
   * @param {number} y - Y coordinate (0-191)
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   */
  setPixel(x, y, r, g, b) {
    if (!Validators.isValidPixelCoord(x, y)) return;

    const index = y * ZX_SPECTRUM.WIDTH + x;
    // ABGR format for Uint32Array
    this.pixels[index] = (255 << 24) | (b << 16) | (g << 8) | r;
  }

  /**
   * Set a pixel by color index
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} colorIndex - ZX palette index (0-15)
   */
  setPixelByIndex(x, y, colorIndex) {
    if (!Validators.isValidPixelCoord(x, y)) return;

    const rgb = window.ColorManager
      ? ColorManager.getRGB(colorIndex)
      : ZX_PALETTE_RGB[colorIndex];
    if (!rgb) return;

    this.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
  }

  /**
   * Get the full color index (0-15) from base color and bright flag —
   * fixed16 semantics only. Mode-aware attribute resolution lives in
   * ColorManager.attrToIndices; this stays for the fixed16 paths and the
   * headless test harness.
   * @param {number} baseColor - Base color (0-7)
   * @param {boolean} bright - Bright flag
   * @returns {number} - Full color index (0-15)
   */
  getColorIndex(baseColor, bright) {
    // Black is always black regardless of bright
    if (baseColor === 0) return 0;
    return bright ? baseColor + 8 : baseColor;
  }

  /**
   * Mark a cell as dirty (needs re-render)
   * @param {number} cellX - Cell X (0-31)
   * @param {number} cellY - Cell Y (0-23)
   */
  markCellDirty(cellX, cellY) {
    if (!Validators.isValidCellCoord(cellX, cellY)) return;
    this.dirtyRegions.add(`${cellX},${cellY}`);
    this.requestRender();
  }

  /**
   * Mark all cells as dirty
   */
  markAllDirty() {
    this.fullRedrawNeeded = true;
    this.requestRender();
  }

  /**
   * Request a render on next animation frame
   */
  requestRender() {
    this.renderPending = true;
  }

  /**
   * Start the render loop
   * @private
   */
  _startRenderLoop() {
    const loop = () => {
      if (this.renderPending) {
        this._render();
        this.renderPending = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Perform the actual render
   * Uses dirty region tracking for partial updates when beneficial
   * @private
   */
  _render() {
    // Flush draw-routine pixel changes: compose each unique dirty cell once.
    LayerManager.flushPendingCompose();

    // Full redraw if flagged or more than half the canvas is dirty
    // (at that point, full redraw is more efficient than many small ones)
    const HALF_CANVAS_CELLS = (ZX_SPECTRUM.GRID_COLS * ZX_SPECTRUM.GRID_ROWS) / 2;

    if (this.fullRedrawNeeded || this.dirtyRegions.size >= HALF_CANVAS_CELLS) {
      // Full canvas update
      this.ctx.putImageData(this.imageData, 0, 0);
    } else if (this.dirtyRegions.size > 0) {
      // Partial update - only dirty cells
      const cellW = ZX_SPECTRUM.CELL_WIDTH;
      const cellH = ZX_SPECTRUM.CELL_HEIGHT;
      for (const key of this.dirtyRegions) {
        const [cellX, cellY] = key.split(',').map(Number);
        const x = cellX * cellW;
        const y = cellY * cellH;
        // putImageData with dirty rect: source offset and size
        this.ctx.putImageData(
          this.imageData,
          0, 0,  // destination x, y
          x, y,  // source x, y (dirty rect origin)
          cellW, cellH  // width, height
        );
      }
    }

    this.dirtyRegions.clear();
    this.fullRedrawNeeded = false;

    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Render a specific cell from layer data
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   * @param {Object} cellData - Cell data { ink, paper, bright, pixels }
   */
  renderCell(cellX, cellY, cellData) {
    if (!Validators.isValidCellCoord(cellX, cellY)) return;

    const cellW = ZX_SPECTRUM.CELL_WIDTH;
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    const baseX = cellX * cellW;
    const baseY = cellY * cellH;

    let inkRgb, paperRgb;
    if (window.ColorManager && ColorManager.attrToIndices) {
      const t = ColorManager.attrToIndices(cellData);
      inkRgb = ColorManager.getRGB(t.ink);
      paperRgb = ColorManager.getRGB(t.paper);
    } else {
      inkRgb = ZX_PALETTE_RGB[this.getColorIndex(cellData.ink, cellData.bright)];
      paperRgb = ZX_PALETTE_RGB[this.getColorIndex(cellData.paper, cellData.bright)];
    }

    for (let row = 0; row < cellH; row++) {
      const pixelByte = cellData.pixels[row];
      for (let col = 0; col < cellW; col++) {
        const x = baseX + col;
        const y = baseY + row;
        const bitPosition = 7 - col;
        const isInk = (pixelByte >> bitPosition) & 1;

        const rgb = isInk ? inkRgb : paperRgb;
        this.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
      }
    }

    this.markCellDirty(cellX, cellY);
  }

  /**
   * Convert screen coordinates to pixel coordinates
   *
   * IMPORTANT: This method does NOT clamp or reject out-of-bounds coordinates.
   * Coordinates outside canvas (negative or > 255/191) are returned as-is.
   * This allows tools to track drawing that extends beyond canvas boundaries
   * (e.g., drawing a circle that extends off-screen, or brush strokes that
   * go in and out of the canvas area).
   *
   * Bounds checking is handled by PixelDrawRoutine, which silently ignores
   * out-of-bounds coordinates. This is the single enforcement point.
   *
   * @param {number} screenX - Screen X (from pointer event)
   * @param {number} screenY - Screen Y (from pointer event)
   * @returns {Object} { x, y } pixel coordinates (may be outside 0-255, 0-191)
   */
  screenToPixel(screenX, screenY) {
    const rect = this._getCanvasRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };

    // Measure the scale from the rect itself: correct under DPR-snapped
    // zoom (getScale ≠ zoom/100) and during the pinch preview transform.
    const scaleX = rect.width  / ZX_SPECTRUM.WIDTH;
    const scaleY = rect.height / ZX_SPECTRUM.HEIGHT;

    return {
      x: Math.floor((screenX - rect.left) / scaleX),
      y: Math.floor((screenY - rect.top)  / scaleY)
    };
  }

  /**
   * Check if pixel coordinates are within canvas bounds
   * Use this when you need to know if a point is inside the canvas
   * (e.g., for cursor changes, UI feedback)
   *
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @returns {boolean} True if inside canvas bounds
   */
  isInsideCanvas(pixelX, pixelY) {
    return Validators.isValidPixelCoord(pixelX, pixelY);
  }

  /**
   * Convert pixel coordinates to screen coordinates
   * @param {number} pixelX - Pixel X
   * @param {number} pixelY - Pixel Y
   * @returns {Object} { x, y } screen coordinates
   */
  pixelToScreen(pixelX, pixelY) {
    const rect = this._getCanvasRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };

    // Measured-rect scale — see screenToPixel.
    return {
      x: rect.left + pixelX * (rect.width  / ZX_SPECTRUM.WIDTH),
      y: rect.top  + pixelY * (rect.height / ZX_SPECTRUM.HEIGHT)
    };
  }

  /**
   * Get cached canvas bounding rect (accounts for iframe offset)
   * @private
   */
  _getCanvasRect() {
    const now = Date.now();
    if (!this.canvasRect || (now - this.rectCacheTime) > this.RECT_CACHE_DURATION) {
      if (!this.canvas || !this.iframe) return null;

      // Get iframe position in parent document
      const iframeRect = this.iframe.getBoundingClientRect();

      // Get canvas position inside iframe
      const canvasRect = this.canvas.getBoundingClientRect();

      // Combine positions (canvas coords are relative to iframe viewport)
      this.canvasRect = {
        left: iframeRect.left + canvasRect.left,
        top: iframeRect.top + canvasRect.top,
        right: iframeRect.left + canvasRect.right,
        bottom: iframeRect.top + canvasRect.bottom,
        width: canvasRect.width,
        height: canvasRect.height
      };
      this.rectCacheTime = now;
    }
    return this.canvasRect;
  }

  /**
   * Invalidate rect cache (call on resize/scroll)
   */
  invalidateRectCache() {
    this.canvasRect = null;
  }

  /**
   * Scroll the canvas viewport by (dx, dy) pixels.
   * Positive dx/dy moves the viewport right/down (canvas appears to shift left/up).
   * @param {number} dx
   * @param {number} dy
   */
  pan(dx, dy) {
    if (!this.iframeDoc) return;
    const scroller = this.iframeDoc.scrollingElement || this.iframeDoc.body;
    if (!scroller) return;
    scroller.scrollLeft -= dx;
    scroller.scrollTop  -= dy;
    this.invalidateRectCache();
  }

  /**
   * Handle zoom change event
   * @private
   */
  _onZoomChanged(data) {
    this.zoom = data.zoom;
    this.updateCanvasSize();
  }

  /**
   * Handle canvas modified event
   * @private
   */
  _onCanvasModified(data) {
    if (data && data.cells) {
      data.cells.forEach(cell => {
        this.markCellDirty(cell.cellX, cell.cellY);
      });
    } else {
      this.markAllDirty();
    }
  }

  /**
   * Get the current ImageData
   * @returns {ImageData}
   */
  getImageData() {
    return this.imageData;
  }

  /**
   * Get a pixel color at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} { r, g, b } or null if out of bounds
   */
  getPixel(x, y) {
    if (!Validators.isValidPixelCoord(x, y)) return null;

    const index = y * ZX_SPECTRUM.WIDTH + x;
    const pixel = this.pixels[index];

    return {
      r: pixel & 0xFF,
      g: (pixel >> 8) & 0xFF,
      b: (pixel >> 16) & 0xFF
    };
  }

  /**
   * Check if a full redraw is needed
   * @returns {boolean}
   */
  needsFullRedraw() {
    return this.fullRedrawNeeded;
  }

  /**
   * Get the set of dirty cell keys
   * @returns {Set<string>}
   */
  getDirtyRegions() {
    return new Set(this.dirtyRegions);
  }

  /**
   * Export canvas as data URL
   * @param {string} type - MIME type
   * @param {number} quality - Quality for lossy formats
   * @returns {string}
   */
  toDataURL(type = 'image/png', quality = 0.92) {
    return this.canvas.toDataURL(type, quality);
  }

  /**
   * Get current zoom level
   * @returns {number}
   */
  getZoom() {
    return this.zoom;
  }

  /**
   * Set zoom level directly (also updates state). The point at the viewport
   * centre stays put — callers with a pointer/gesture anchor use zoomTo().
   * @param {number} zoom - Zoom percentage
   */
  setZoom(zoom) {
    if (Validators.isValidZoom(zoom)) {
      this.zoomTo(zoom);
    }
  }

  /**
   * Zoom keeping a canvas point visually stationary (anchored zoom). The
   * scroll correction rides into updateCanvasSize via _pendingScroll so it
   * lands in the same frame as the transform change.
   * @param {number} zoom - Nominal zoom %, snapped onto the LEVELS grid
   * @param {number} [anchorX] - Canvas pixel to hold (default: the point at
   *                             the viewport centre stays centred)
   * @param {number} [anchorY]
   * @param {boolean} [centre=false] - Move the anchor TO the viewport centre
   *                                   instead of holding its current position
   */
  zoomTo(zoom, anchorX, anchorY, centre = false) {
    zoom = ZOOM_CONFIG.snap(zoom);
    const scroller = this.iframeDoc &&
        (this.iframeDoc.scrollingElement || this.iframeDoc.body);
    if (!scroller) {
      StateManager.setZoom(zoom);
      return;
    }

    const s0 = this.getScale();
    const s1 = this.getScaleFor(zoom);
    const vw = scroller.clientWidth;
    const vh = scroller.clientHeight;

    if (anchorX === undefined || anchorY === undefined) {
      // Default anchor: whatever canvas point sits at the viewport centre
      anchorX = (scroller.scrollLeft + vw / 2 - SCROLL_MARGIN) / s0;
      anchorY = (scroller.scrollTop  + vh / 2 - SCROLL_MARGIN) / s0;
      centre = true;
    }
    const vx = centre ? vw / 2 : SCROLL_MARGIN + anchorX * s0 - scroller.scrollLeft;
    const vy = centre ? vh / 2 : SCROLL_MARGIN + anchorY * s0 - scroller.scrollTop;
    this._pendingScroll = {
      left: Math.max(0, SCROLL_MARGIN + anchorX * s1 - vx),
      top:  Math.max(0, SCROLL_MARGIN + anchorY * s1 - vy)
    };
    StateManager.setZoom(zoom);
  }

  /**
   * Zoom so a canvas-pixel rect fills the viewport (largest fitting LEVELS
   * entry) and centre the view on it — marquee zoom and fit-to-selection.
   * No safety margin, for the same reason as `fitZoom()`: the iframe's own
   * scrollbar never shrinks the outer viewport size this checks against, so
   * a flat px margin only made this stop a level early.
   * @param {number} x - Rect left (canvas pixels)
   * @param {number} y - Rect top
   * @param {number} w - Rect width
   * @param {number} h - Rect height
   */
  zoomToRect(x, y, w, h) {
    if (!(w > 0) || !(h > 0)) return;
    const { width, height } = this.getViewportSize();
    const levels = ZOOM_CONFIG.LEVELS;
    let target = ZOOM_CONFIG.MIN;
    for (let i = levels.length - 1; i >= 0; i--) {
      const s = this.getScaleFor(levels[i]);
      if (w * s <= width && h * s <= height) {
        target = levels[i];
        break;
      }
    }
    this.zoomTo(target, x + w / 2, y + h / 2, true);
  }

  // ── Pinch zoom preview ────────────────────────────────────────────────────

  /**
   * Live pinch preview: scale the canvas stack with a plain CSS transform
   * (no relayout; a transient non-integer scale is fine) keeping the anchor
   * canvas pixel visually fixed. With transform-origin at top-left,
   * translate(A·(s0−s)) scale(s) maps p -> A(s0−s) + s·p, which leaves p=A
   * at its committed position A·s0 for every preview scale s.
   * commitZoomPreview() snaps to the nearest level and applies the real zoom.
   * @param {number} zoom - Continuous nominal zoom from the gesture
   * @param {number} anchorX - Canvas pixel under the gesture centroid
   * @param {number} anchorY
   */
  setZoomPreview(zoom, anchorX, anchorY) {
    if (!this.iframeDoc) return;
    const container = this.iframeDoc.getElementById('canvas-container');
    if (!container) return;

    if (!this._zoomPreview) {
      this._zoomPreview = { baseScale: this.getScale(), zoom: this.zoom, ax: anchorX, ay: anchorY };
    }
    const p = this._zoomPreview;
    p.zoom = clamp(zoom, ZOOM_CONFIG.MIN, ZOOM_CONFIG.MAX);

    const s0 = p.baseScale;
    const s  = s0 * (p.zoom / (this.zoom || 100));
    const tx = p.ax * (s0 - s);
    const ty = p.ay * (s0 - s);
    container.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

    // The grid wrapper's content is laid out in s0-scaled CSS px, so the
    // same visual transform needs the RELATIVE scale s/s0.
    const gw = this.iframeDoc.getElementById('grid-wrapper');
    if (gw) {
      gw.style.transformOrigin = '0 0';
      gw.style.transform = `translate(${tx}px, ${ty}px) scale(${s / s0})`;
    }
    this.invalidateRectCache();
  }

  /** Commit the pinch preview: snap to the nearest level, anchored zoom. */
  commitZoomPreview() {
    const p = this._zoomPreview;
    if (!p) return;
    this._zoomPreview = null;
    this._clearPreviewTransform();
    this.zoomTo(p.zoom, p.ax, p.ay);
  }

  /** Abandon the pinch preview and restore the committed transform. */
  cancelZoomPreview() {
    if (!this._zoomPreview) return;
    this._zoomPreview = null;
    this._clearPreviewTransform();
    this.updateCanvasSize();
  }

  /** @private */
  _clearPreviewTransform() {
    if (!this.iframeDoc) return;
    const gw = this.iframeDoc.getElementById('grid-wrapper');
    if (gw) {
      gw.style.transform = '';
      gw.style.transformOrigin = '';
    }
    // The container transform is rewritten by updateCanvasSize (which both
    // commit and cancel trigger), so it needs no explicit reset here.
    this.invalidateRectCache();
  }

  /**
   * Re-apply the layout when devicePixelRatio changes (browser zoom, moving
   * the window to a monitor with different scaling) — the effective scale
   * depends on it. GridOverlay rebuilds from the fact. @private
   */
  _watchDevicePixelRatio() {
    const arm = () => {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onChange = () => {
        mq.removeEventListener('change', onChange);
        this.updateCanvasSize();
        EventBus.emit(EVENTS.CANVAS_SCALE_CHANGED, { scale: this.getScale() });
        arm();
      };
      mq.addEventListener('change', onChange);
    };
    arm();
  }

  /**
   * Destroy the canvas system and cleanup resources
   */
  destroy() {
    // Stop render loop
    this.stopRenderLoop();

    // Unsubscribe from all EventBus events
    this._eventUnsubscribers.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this._eventUnsubscribers = [];
    this._boundOnZoomChanged = null;
    this._boundOnCanvasModified = null;

    // Clear references
    this.canvas = null;
    this.ctx = null;
    this.iframe = null;
    this.iframeDoc = null;
    this.imageData = null;
    this.pixels = null;
    this.dirtyRegions.clear();
    this._initCallbacks = [];
    this._initialized = false;

    Logger.info('CanvasSystem', 'Destroyed and cleaned up event listeners');
  }
}

// Create singleton instance
const CanvasSystemInstance = new CanvasSystemClass();

// Export
window.CanvasSystem = CanvasSystemInstance;

Logger.debug('CanvasSystem', 'Canvas system loaded');

})(); // End IIFE
