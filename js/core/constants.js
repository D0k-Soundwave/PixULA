'use strict';

/**
 * The app's own version, shown in the About dialog (about.version) and
 * nowhere else — there is no build step to stamp it into, so this string
 * is the single source of truth and must be bumped by hand per release.
 * SemVer pre-release form: this is the first alpha, hence 0.x (1.0.0 is
 * reserved for the first release with no more breaking changes expected).
 */
const APP_VERSION = '0.1.0-alpha.1';

/**
 * Screen mode registry — the mode seam (docs/REFACTOR_PLAN.md §1a).
 *
 * Every geometry/palette assumption in the app flows from the active mode
 * descriptor, never from hardcoded numbers. Phase 12a made the seam live:
 * ACTIVE_SCREEN_MODE is switchable at runtime (ScreenModeService owns
 * switching and emits EVENTS.SCREEN_MODE_CHANGED); ZX_SPECTRUM and
 * ZX_COORDS below are LIVE views of the active descriptor. Phase 12b adds
 * Timex/GigaScreen/Bifrost; Phase 13 the ZX Spectrum Next modes.
 *
 * Descriptor contract:
 *   width/height     — pixel resolution
 *   attrCellW/H      — attribute cell geometry; null = no attribute grid
 *   pixelDepth       — 1 = ink/paper bitmask; 4/8 = indexed per-pixel colour
 *   paletteModel     — 'fixed16' | 'ulaplus64' | 'timexMono' | 'rgb333'
 *   screens          — sub-screen count (absent/1 = single screen; 2 =
 *     GigaScreen flicker pair: layers carry a `gigaScreen` 0|1 tag and the
 *     compositor blends the two composites)
 *   bitmapSize/attrSize/fileSize — native encoding sizes in bytes; the file
 *     layout itself lives in the io/ handler for the mode. ALL magic file
 *     sizes live here (lint bans the literals elsewhere). attrSize always
 *     equals the CELL COUNT (one attribute byte per cell) even for modes
 *     with no native attribute block (TIMEX_HIRES) — grid allocation and
 *     TOTAL_CELLS rely on it.
 *   i18n             — mode display-name translation key
 *
 * The multicolor modes (8×1/8×2/8×4 attribute cells on the fixed 16-colour
 * palette) and ULA_PLUS (standard 8×8 geometry, editable 64-colour palette:
 * 4 CLUTs × (8 ink + 8 paper); the attribute byte's FLASH/BRIGHT bits select
 * the CLUT, so nothing flashes) landed in Phase 12a. File sizes follow
 * RECOIL's reference decoder: 8×1 = 6144 bitmap + 6144 linear attrs (.mlt),
 * 8×2 = + 3072 (.ifl), 8×4 = + 1536 (no established interchange format —
 * ZX-Paintbrush stores 8×4 only in .zxp), ULAplus SCR = 6912 + 64 palette
 * registers.
 *
 * Phase 12b added the remaining classic modes (layouts per RECOIL
 * DecodeScr/DecodeTimexHires/DecodeZxImg):
 *   ULA_PLUS_8x1 — the Timex hi-colour cell grid with the ULAplus palette
 *     (SCR 12352 = interleaved bitmap + interleaved attrs + 64 registers).
 *     Plain Timex hi-colour SCREEN$ (12288) is an SCR-variant of
 *     MULTICOLOR_8x1, not a separate mode — ZX-Paintbrush treats 8×1 AS
 *     "Timex format" and the cell model is identical (decision documented
 *     in io/timex-format.js).
 *   TIMEX_HIRES — 512×192 monochrome; the whole screen shares one
 *     ink/paper pair derived from the hi-res port byte (ink = bits 3–5,
 *     paper = its complement, both at BRIGHT levels). ColorManager owns the
 *     scheme as document state (timexHiresInk); cell attribute bytes exist
 *     but are ignored at render. fileSize 12289 = two 6144 display files +
 *     the port byte.
 *   GIGASCREEN — two 256×192 standard sub-screens flicker-blended (the
 *     canvas shows the per-channel average like RECOIL's ApplyBlend).
 *     fileSize 13824 = the .img container (two 6912 screens back to back).
 *     ZX-Paintbrush has NO GigaScreen support — this mode is a Plus over
 *     parity; the editing model (layer `gigaScreen` tags + a view toggle)
 *     is our own, documented in docs/ZX_PAINTBRUSH_COMPARISON.md.
 *
 * Phase 13 added the ZX Spectrum Next family — the indexed-pixel half of
 * the seam (§1a's reserved pixelDepth 4/8 goes live). In indexed modes
 * layer cells stop being 1-bit ink/paper rows: each cell stores per-pixel
 * palette indices (Int16Array, −1 = transparent) in 8×8 STORAGE tiles —
 * attrCellW/H stay 8×8 as the storage/dirty-tracking granularity even
 * though no attribute semantics exist. paletteModel 'rgb333' = the Next's
 * 9-bit programmable palette (256 registers, document state in
 * ColorManager.nextRegisters). Indexed-mode containers are bitmap +
 * optional 512-byte palette block (the .nxi layout per RECOIL DecodeNxi);
 * there is no attribute block, so fileSize = bitmapSize + paletteBytes.
 *   LAYER2_256  — Layer 2 256×192×8bpp (.nxi 49664 = 512 palette + 49152)
 *   LAYER2_320  — Layer 2 320×256×8bpp (82432 = 512 + 81920)
 *   LAYER2_640  — Layer 2 640×256×4bpp (16 colours; same 82432 container —
 *     the 4bpp packing halves the bytes-per-pixel at double width)
 *   LORES       — LoRes 128×96×8bpp (12800 = 512 + 12288); the canvas is
 *     a true 128×96 surface, zoom/fit scale it up (sub-256 presentation)
 *   LORES_RADASTAN — Radastan 128×96×4bpp, 16 colours (6656 = 512 + 6144)
 *   ULANEXT     — ULANext enhanced attributes: classic 8×8 cells and 1-bit
 *     pixels, but the palette is the 256-entry RGB333 register file. OUR
 *     editing model (documented, ZX-PB has no Next modes): a cell's ink
 *     resolves to palette entry (bright?8:0)+ink, its paper to entry
 *     128+(bright?8:0)+paper — the ink/paper halves of the ULANext
 *     palette; FLASH is stored/exported but nothing flashes. The default
 *     register file reproduces the classic colours in both halves, so
 *     STANDARD_ULA -> ULANEXT is visually lossless. fileSize 6912 (the
 *     palette travels separately via .npl/.pal).
 * @const {Object}
 */
const SCREEN_MODES = Object.freeze({
    STANDARD_ULA: Object.freeze({
        id: 'standard_ula',
        i18n: 'mode.standardUla',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 1,
        paletteModel: 'fixed16',
        bitmapSize: 6144,
        attrSize: 768,
        fileSize: 6912
    }),
    MULTICOLOR_8x4: Object.freeze({
        id: 'multicolor_8x4',
        i18n: 'mode.multicolor8x4',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 4,
        pixelDepth: 1,
        paletteModel: 'fixed16',
        bitmapSize: 6144,
        attrSize: 1536,
        fileSize: 7680
    }),
    MULTICOLOR_8x2: Object.freeze({
        id: 'multicolor_8x2',
        i18n: 'mode.multicolor8x2',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 2,
        pixelDepth: 1,
        paletteModel: 'fixed16',
        bitmapSize: 6144,
        attrSize: 3072,
        fileSize: 9216
    }),
    MULTICOLOR_8x1: Object.freeze({
        id: 'multicolor_8x1',
        i18n: 'mode.multicolor8x1',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 1,
        pixelDepth: 1,
        paletteModel: 'fixed16',
        bitmapSize: 6144,
        attrSize: 6144,
        fileSize: 12288
    }),
    ULA_PLUS: Object.freeze({
        id: 'ula_plus',
        i18n: 'mode.ulaPlus',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 1,
        paletteModel: 'ulaplus64',
        paletteSize: 64,
        paletteBytes: 64,
        bitmapSize: 6144,
        attrSize: 768,
        fileSize: 6976
    }),
    ULA_PLUS_8x1: Object.freeze({
        id: 'ula_plus_8x1',
        i18n: 'mode.ulaPlus8x1',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 1,
        pixelDepth: 1,
        paletteModel: 'ulaplus64',
        paletteSize: 64,
        paletteBytes: 64,
        bitmapSize: 6144,
        attrSize: 6144,
        fileSize: 12352
    }),
    TIMEX_HIRES: Object.freeze({
        id: 'timex_hires',
        i18n: 'mode.timexHires',
        width: 512,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 1,
        paletteModel: 'timexMono',
        bitmapSize: 12288,
        attrSize: 1536,
        fileSize: 12289
    }),
    GIGASCREEN: Object.freeze({
        id: 'gigascreen',
        i18n: 'mode.gigascreen',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 1,
        paletteModel: 'fixed16',
        screens: 2,
        bitmapSize: 6144,
        attrSize: 768,
        fileSize: 13824
    }),
    ULANEXT: Object.freeze({
        id: 'ulanext',
        i18n: 'mode.ulanext',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 1,
        paletteModel: 'rgb333',
        paletteSize: 256,
        bitmapSize: 6144,
        attrSize: 768,
        fileSize: 6912
    }),
    LAYER2_256: Object.freeze({
        id: 'layer2_256',
        i18n: 'mode.layer2_256',
        width: 256,
        height: 192,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 8,
        paletteModel: 'rgb333',
        paletteSize: 256,
        paletteBytes: 512,
        bitmapSize: 49152,
        attrSize: 768,
        fileSize: 49664
    }),
    LAYER2_320: Object.freeze({
        id: 'layer2_320',
        i18n: 'mode.layer2_320',
        width: 320,
        height: 256,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 8,
        paletteModel: 'rgb333',
        paletteSize: 256,
        paletteBytes: 512,
        bitmapSize: 81920,
        attrSize: 1280,
        fileSize: 82432
    }),
    LAYER2_640: Object.freeze({
        id: 'layer2_640',
        i18n: 'mode.layer2_640',
        width: 640,
        height: 256,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 4,
        paletteModel: 'rgb333',
        paletteSize: 16,
        paletteBytes: 512,
        bitmapSize: 81920,
        attrSize: 2560,
        fileSize: 82432
    }),
    LORES: Object.freeze({
        id: 'lores',
        i18n: 'mode.lores',
        width: 128,
        height: 96,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 8,
        paletteModel: 'rgb333',
        paletteSize: 256,
        paletteBytes: 512,
        bitmapSize: 12288,
        attrSize: 192,
        fileSize: 12800
    }),
    LORES_RADASTAN: Object.freeze({
        id: 'lores_radastan',
        i18n: 'mode.loresRadastan',
        width: 128,
        height: 96,
        attrCellW: 8,
        attrCellH: 8,
        pixelDepth: 4,
        paletteModel: 'rgb333',
        paletteSize: 16,
        paletteBytes: 512,
        bitmapSize: 6144,
        attrSize: 192,
        fileSize: 6656
    })
});

/** Look up a mode descriptor by its `id` string. @returns {Object|null} */
function getScreenModeById(id) {
    for (const key of Object.keys(SCREEN_MODES)) {
        if (SCREEN_MODES[key].id === id) return SCREEN_MODES[key];
    }
    return null;
}

/**
 * The active screen mode — LIVE, switchable at runtime (Phase 12a).
 *
 * Mechanism: a module-private `_activeScreenMode` binding with a window
 * accessor property, so `ACTIVE_SCREEN_MODE.width` etc. always read the
 * current descriptor in both the browser and the Node test harness.
 * `__setActiveScreenMode(id)` is the LOW-LEVEL setter: it only swaps the
 * descriptor — no conversion, no events, no canvas work. Everything above
 * it (document conversion, EVENTS.SCREEN_MODE_CHANGED, palette re-derive,
 * canvas resize, undo capture) is orchestrated by ScreenModeService
 * (js/services/screen-mode-service.js) — call THAT to switch modes.
 * Boot default stays STANDARD_ULA.
 */
let _activeScreenMode = SCREEN_MODES.STANDARD_ULA;

function __setActiveScreenMode(id) {
    const mode = getScreenModeById(id);
    if (!mode) throw new Error(`Unknown screen mode: ${id}`);
    _activeScreenMode = mode;
    return mode;
}

/**
 * ZX Spectrum hardware specifications — a LIVE view of the active screen
 * mode plus app-level limits. Geometry fields are accessors so the 264+
 * existing call-time reads across the app follow mode switches without
 * any change. CELL_SIZE is the attribute cell WIDTH (legacy name — use
 * CELL_WIDTH/CELL_HEIGHT in new code; they differ in multicolor modes).
 * @const {Object}
 */
const ZX_SPECTRUM = Object.freeze({
    get WIDTH()       { return _activeScreenMode.width; },
    get HEIGHT()      { return _activeScreenMode.height; },
    get GRID_COLS()   { return _activeScreenMode.width / _activeScreenMode.attrCellW; },
    get GRID_ROWS()   { return _activeScreenMode.height / _activeScreenMode.attrCellH; },
    get CELL_SIZE()   { return _activeScreenMode.attrCellW; },
    get CELL_WIDTH()  { return _activeScreenMode.attrCellW; },
    get CELL_HEIGHT() { return _activeScreenMode.attrCellH; },
    get TOTAL_CELLS() { return _activeScreenMode.attrSize; },
    // Phase 13: 1 = classic ink/paper bitmask cells, 4/8 = per-pixel palette
    // indices. PALETTE_SIZE is the number of drawable palette entries in the
    // active mode (16 fixed / 64 ULAplus / 2 timexMono / 16 or 256 rgb333).
    get PIXEL_DEPTH()  { return _activeScreenMode.pixelDepth; },
    get PALETTE_SIZE() {
        if (_activeScreenMode.paletteSize) return _activeScreenMode.paletteSize;
        return _activeScreenMode.paletteModel === 'timexMono' ? 2 : 16;
    },
    MAX_COLORS_PER_CELL: 2,

    /*
     * [M] 2026-08-07, measured in Chrome: one STANDARD_ULA layer serializes to
     * 95,458 bytes, and the figure does not move between an empty layer and a
     * densely drawn one - the grid is allocated whole either way, so the cost
     * is flat per layer rather than per mark.
     *
     * [C] 32 layers is therefore ~3.1 MB at STANDARD_ULA. The worst mode is
     * LAYER2_640: 80x32 = 2,560 cells of Int16Array(64), so 327 KB a layer and
     * ~10.5 MB for 32. Both are unremarkable for a desktop browser, so the old
     * cap of 16 was not protecting anything measurable. Raised to 32.
     *
     * What would justify raising it further is a real document that wants it -
     * the constraint above 32 stops being memory and starts being the layer
     * panel, which has to stay readable without a scroll of its own.
     */
    MAX_LAYERS: 32,

    /*
     * Raised from 50 to 500 on 2026-08-07, once depth stopped being expensive.
     *
     * It was 50 because an entry cost 190,261 bytes: snapshots held the live
     * cell shape (768+ objects a layer, each wrapping its own typed arrays) and
     * copied EVERY layer whether the action touched it or not. Packed
     * snapshots plus dirty-layer tracking removed both.
     *
     * [M] 2026-08-07, measured on the packed form: a one-layer stroke costs
     * 8,448 B at STANDARD_ULA and 212,480 B at LAYER2_640, the largest mode.
     * [C] So 500 entries of ordinary drawing is ~4.2 MB at STANDARD_ULA and
     * ~106 MB at LAYER2_640 - the second only if all 500 are strokes on the
     * biggest canvas the app can make.
     *
     * The figure that bounds the worst case is not this one. An action that
     * touches every layer (a mode switch, a transform over a multi-layer
     * selection) keeps every grid, so an entry can still reach 32 x 212,480 =
     * 6.8 MB. Five hundred of THOSE would be 3.4 GB - implausible as a
     * sequence, but it is the ceiling, and the honest lever on it is
     * MAX_LAYERS and the mode, not this number.
     *
     * Undo and redo share this budget rather than doubling it: undo moves an
     * entry from one stack to the other, so the two never hold more than
     * DEFAULT_UNDO_LIMIT entries between them.
     */
    DEFAULT_UNDO_LIMIT: 500,
    get SCR_FILE_SIZE() { return _activeScreenMode.fileSize; },
    get BITMAP_SIZE()   { return _activeScreenMode.bitmapSize; },
    get ATTR_SIZE()     { return _activeScreenMode.attrSize; }
});

/**
 * Default zoom level (percentage)
 * @const {number}
 */
const DEFAULT_ZOOM = 100;

/**
 * ZX Spectrum 16-color palette (8 normal + 8 bright)
 * Index 0-7: Normal colors, Index 8-15: Bright colors
 * @const {string[]}
 */
const ZX_PALETTE = Object.freeze([
    '#000000', '#0000D7', '#D70000', '#D700D7',
    '#00D700', '#00D7D7', '#D7D700', '#D7D7D7',
    '#000000', '#0000FF', '#FF0000', '#FF00FF',
    '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'
]);

/**
 * Pre-computed RGB values for fast access
 * @const {Uint8Array[]}
 */
const ZX_PALETTE_RGB = Object.freeze([
    new Uint8Array([0, 0, 0]),       new Uint8Array([0, 0, 215]),
    new Uint8Array([215, 0, 0]),     new Uint8Array([215, 0, 215]),
    new Uint8Array([0, 215, 0]),     new Uint8Array([0, 215, 215]),
    new Uint8Array([215, 215, 0]),   new Uint8Array([215, 215, 215]),
    new Uint8Array([0, 0, 0]),       new Uint8Array([0, 0, 255]),
    new Uint8Array([255, 0, 0]),     new Uint8Array([255, 0, 255]),
    new Uint8Array([0, 255, 0]),     new Uint8Array([0, 255, 255]),
    new Uint8Array([255, 255, 0]),   new Uint8Array([255, 255, 255])
]);

/**
 * A cell with nothing in it: black ink on white paper, no bright, no flash.
 *
 * What a new layer's cells start as and what the eraser returns a cell to.
 * It was the bare literals 0 and 7 in four places, which is four chances for
 * "default" to come to mean different things in different code paths.
 * @const {Object}
 */
const DEFAULT_CELL_ATTRS = Object.freeze({
    ink: 0,
    paper: 7,
    bright: false,
    flash: false
});

/**
 * Drawing modes for PixelDrawRoutine
 * @const {Object}
 */
const DRAW_MODE = Object.freeze({
    /*
     * The two mouse buttons and the eraser tool are THREE different things, and
     * conflating them was a bug (found 2026-08-08):
     *
     *   NORMAL       left button  - set the pixel to ink, stamp the cell's
     *                               ink/paper/bright/flash from the attribute bar
     *   NORMAL_ERASE right button - CLEAR the pixel, stamp the same attributes.
     *                               Removing ink is not the same as declining to
     *                               colour the cell: on the Spectrum the right
     *                               button paints paper, and the cell still takes
     *                               the colours you have selected
     *   ERASE_ALL    eraser tool  - clear the pixel AND, once nothing is left in
     *                               the cell, take its attributes with it
     *   ERASE        primitive    - clear the pixel, touch nothing else. NOT a
     *                               user-facing mode: the selection and transform
     *                               services move pixels with it and must not
     *                               have attributes written underneath them, and
     *                               Pixels Only uses it for its right button
     */
    NORMAL: 'normal',
    NORMAL_ERASE: 'normal_erase',
    ERASE_ALL: 'erase_all',
    TRANSPARENT: 'transparent',
    ERASE: 'erase',
    ATTRIBUTES_ONLY: 'attributes_only',
    PIXEL_ONLY: 'pixel_only',   // draw pixel bit, preserve all cell attributes
    INK: 'ink',                 // recolour ONLY the cell's ink attribute (+ flash), no pixels
    PAPER: 'paper',             // recolour ONLY the cell's paper attribute (+ flash), no pixels
    XOR: 'xor',                 // toggle pixel bit (ArtStudio OVER), once per STROKE
    XOR_PIXEL: 'xor_pixel'      // toggle pixel bit on every write, no once-per-stroke gate
});

/**
 * Tool identifiers
 * @const {Object}
 */
const TOOLS = Object.freeze({
    BRUSH: 'brush',
    ERASER: 'eraser',
    FILL: 'fill',
    LINE: 'line',
    RECTANGLE: 'rectangle',
    ROUNDED_RECTANGLE: 'rounded-rectangle',
    PARALLELOGRAM: 'parallelogram',
    CIRCLE: 'circle',
    ELLIPSE: 'ellipse',
    TRIANGLE: 'triangle',
    POLYGON: 'polygon',
    STAR: 'star',
    BEZIER: 'bezier',
    SELECTION: 'selection',
    // Viewport pan tool. The id string is legacy ('transform') and is kept for
    // persisted-session compatibility (the saved current-tool id is the raw
    // string); the UI label is "Pan" (i18n tool.pan).
    MOVE: 'transform',
    EYEDROPPER: 'eyedropper',
    GRADIENT: 'gradient',
    TEXT: 'text',
    SPRAY: 'spray',
    ZOOM: 'zoom',
    // Brush-type rail buttons — each is a BrushTool variant (ToolManager
    // ._brushVariants) that selects the base brush and pins BrushEngine to
    // this type, mirroring the shape-variant ids above. The id string IS the
    // brush type (as LINE/CIRCLE ids are the shape type). Round and square
    // stay under BRUSH itself (the Round/Square selector in the brush options).
    FADE: 'fade',
    PATTERN: 'pattern',
    HATCH: 'hatch',
    // Selection-mode rail buttons — variants on the one SelectionTool
    // (ToolManager._selectionVariants), the same routing the brush types use.
    // SELECTION itself hosts the rectangle marquee.
    SELECT_CELL: 'select-cell',
    SELECT_LASSO: 'select-lasso',
    SELECT_ELLIPSE: 'select-ellipse',
    PATTERN_CREATOR: 'pattern-creator'
});

/**
 * PEN CONTROLS — the four things a browser can ever learn about a stylus.
 *
 * W3C Pointer Events gives a pen the mouse's button vocabulary: the tip is the
 * primary button and the barrel is the secondary one, which is why a barrel
 * press and a mouse right-click are indistinguishable by `button`/`buttons`
 * alone. Note the two properties number things differently — `button === 1` is
 * the middle button but `buttons & 2` is the right/barrel bit — so both are
 * spelled out here rather than derived. Both are needed: `buttons` says what is
 * HELD (the only thing a move carries), `button` says what CHANGED (the only
 * thing a lift carries), so a control is recognised through the whole gesture.
 *
 *   TIP      contact          button 0, buttons bit 1
 *   BARREL   side button      button 2, buttons bit 2
 *   BARREL2  second side button — reported ONLY if the tablet driver maps it to
 *            a middle click (button 1, buttons bit 4). Two-button pens (Wacom,
 *            XP-Pen, Huion, Gaomon) are the common case, but whether the browser
 *            sees the second button at all is a driver setting, not a pen fact.
 *   ERASER   inverted tail    button 5, buttons bit 32
 *
 * Everything else a modern stylus can do — Apple Pencil 2's double-tap, Pencil
 * Pro's squeeze and barrel roll, S Pen air gestures — travels over private
 * vendor APIs that no web page can read. A profile below may describe such a
 * pen, but it can only ever assign the controls in this table.
 * @const {Object}
 */
const PEN_CONTROLS = Object.freeze({
    TIP:     Object.freeze({ id: 'tip',     bit: 1,  button: 0, i18n: 'pref.penTip' }),
    BARREL:  Object.freeze({ id: 'barrel',  bit: 2,  button: 2, i18n: 'pref.penBarrel' }),
    BARREL2: Object.freeze({ id: 'barrel2', bit: 4,  button: 1, i18n: 'pref.penBarrel2' }),
    ERASER:  Object.freeze({ id: 'eraser',  bit: 32, button: 5, i18n: 'pref.penEraser' })
});

/**
 * PEN ACTIONS — every action a pen control can be assigned in Preferences.
 *
 * `i18n` reuses an existing key wherever the action already has a name in the
 * UI (a tool, a menu command), so the settings cannot drift from the thing they
 * name. `stroke: true` marks the actions that run for the whole press-drag-lift
 * gesture; the rest fire once on press.
 * @const {Object}
 */
const PEN_ACTIONS = Object.freeze({
    NONE:        Object.freeze({ id: 'none',        i18n: 'pen.act.none' }),
    INK:         Object.freeze({ id: 'ink',         i18n: 'pen.act.ink',    stroke: true }),
    PAPER:       Object.freeze({ id: 'paper',       i18n: 'pen.act.paper',  stroke: true }),
    EYEDROPPER:  Object.freeze({ id: 'eyedropper',  i18n: 'tool.eyedropper', stroke: true }),
    // The eyedropper's other half: its right-button behaviour picks the paper
    // colour. Worth its own entry because a pen control cannot hold a modifier.
    EYEDROPPER_PAPER: Object.freeze({ id: 'eyedropperPaper', i18n: 'pen.act.eyedropperPaper', stroke: true }),
    ERASER:      Object.freeze({ id: 'eraser',      i18n: 'tool.eraser',    stroke: true }),
    PAN:         Object.freeze({ id: 'pan',         i18n: 'tool.pan',       stroke: true }),
    MENU:        Object.freeze({ id: 'menu',        i18n: 'pen.act.menu' }),
    UNDO:        Object.freeze({ id: 'undo',        i18n: 'app.undo' }),
    REDO:        Object.freeze({ id: 'redo',        i18n: 'app.redo' }),
    SWAP_COLORS: Object.freeze({ id: 'swapColors',  i18n: 'color.swap' }),
    PREV_TOOL:   Object.freeze({ id: 'prevTool',    i18n: 'pen.act.prevTool' })
});

/**
 * PEN PROFILES — what a real, named pen model physically has, and what its
 * controls should do out of the box.
 *
 * A profile is NOT detection. Nothing here is measured: the browser reports the
 * same four bits whatever the badge on the pen says, and tablet drivers let the
 * owner remap the buttons anyway. What a profile buys is the row shape (an
 * Apple Pencil has nothing to assign, so it shows nothing to assign) and a set
 * of defaults that suit that pen. The Preferences pen check is the measurement:
 * it prints what the browser actually receives when the user presses each
 * control, and that always outranks this table.
 *
 * `barrels` counts side buttons the web can see; `eraser` is an inverted tail.
 * `custom: true` (generic only) lets the user declare the shape themselves.
 * `group` sorts models under a vendor heading in the Preferences dropdown
 * (docs/pen-info-table.md is the source list); entries with no `group` render
 * ungrouped (only `generic` today). Brand and model names are proper nouns and
 * carry no i18n key — they read the same in every locale.
 *
 * `defaults` overrides PEN_DEFAULT_ACTIONS per control for models whose real,
 * documented out-of-the-box behaviour both differs AND survives translation
 * into an action this app actually has (see wacomProPen3D below) — most
 * vendor defaults are OS-level concepts ("right-click", "double-click", a
 * launcher shortcut) with no meaningful pixel-art equivalent, so most models
 * below omit `defaults` and keep the shared baseline rather than force one.
 *
 * Many vendors ship several models that are electrically identical from a
 * browser's point of view (same button/eraser shape, same real defaults) —
 * they are still listed separately so an artist can find their exact pen by
 * name, even where picking a sibling model would behave identically.
 *
 * Physically real controls this table can never represent, because no
 * PointerEvent bit carries them: Apple Pencil 2/Pro's double-tap, Pencil
 * Pro's squeeze and barrel-roll gyro, S Pen Air actions (BLE, a separate
 * channel from drawing input), Surface Pen's OS-level tail click/hold app
 * shortcuts (as opposed to its tail's eraser-invert bit, which IS
 * represented), the Wacom Art Pen's barrel rotation, and the Airbrush Pen's
 * analog wheel. A third physical button on modular Wacom pens (Pro Pen 3's
 * upper/middle/front) is also unrepresentable past the two the bitmask
 * distinguishes — see PEN_CONTROLS above.
 *
 * Sources are the vendors' own published specifications, read 2026-08-05
 * (family-level table) and docs/pen-info-table.md (model-level list, read
 * 2026-08-18).
 * @const {Object}
 */
const PEN_PROFILES = Object.freeze({
    generic: Object.freeze({
        id: 'generic', i18n: 'pen.profile.generic', custom: true,
        barrels: 1, eraser: false
    }),

    // ── Apple ────────────────────────────────────────────────────────────
    // Every generation: no web-visible buttons at all. The 2nd-gen/Pro
    // double-tap and the Pro's squeeze are private APIs.
    applePencil1: Object.freeze({
        id: 'applePencil1', label: 'Apple Pencil (1st generation)', group: 'Apple',
        barrels: 0, eraser: false
    }),
    applePencil2: Object.freeze({
        id: 'applePencil2', label: 'Apple Pencil (2nd generation)', group: 'Apple',
        barrels: 0, eraser: false
    }),
    applePencilUsbC: Object.freeze({
        id: 'applePencilUsbC', label: 'Apple Pencil (USB-C)', group: 'Apple',
        barrels: 0, eraser: false
    }),
    applePencilPro: Object.freeze({
        id: 'applePencilPro', label: 'Apple Pencil Pro', group: 'Apple',
        barrels: 0, eraser: false
    }),

    // ── Samsung ──────────────────────────────────────────────────────────
    // One side button, no eraser tail, on every S Pen variant Samsung ships
    // today. Hover + button opens Air Command, and BLE top buttons on newer
    // pens drive Air actions — both travel over a channel a web page cannot
    // read, so all three list entries share this exact shape.
    sPenPhone: Object.freeze({
        id: 'sPenPhone', label: 'Samsung S Pen (Galaxy phones)', group: 'Samsung',
        barrels: 1, eraser: false
    }),
    sPenTab: Object.freeze({
        id: 'sPenTab', label: 'Samsung S Pen (Galaxy Tab)', group: 'Samsung',
        barrels: 1, eraser: false
    }),
    sPenFold: Object.freeze({
        id: 'sPenFold', label: 'Samsung S Pen (Fold Edition / Pro / Creator Edition)',
        group: 'Samsung', barrels: 1, eraser: false
    }),

    // ── Microsoft ────────────────────────────────────────────────────────
    surfacePen: Object.freeze({
        // Current Surface Pen: one barrel, tail eraser (its invert bit is
        // real and distinct from the tail's separate OS-level Bluetooth
        // click/hold app shortcuts, which are not).
        id: 'surfacePen', label: 'Surface Pen (current)', group: 'Microsoft',
        barrels: 1, eraser: true
    }),
    surfacePenLegacy: Object.freeze({
        // Surface Pro 3/4-era pen: an extra side button over the current one.
        id: 'surfacePenLegacy', label: 'Surface Pen (2-button, older)', group: 'Microsoft',
        barrels: 2, eraser: true
    }),
    surfaceSlimPen: Object.freeze({
        // Slim Pen / Slim Pen 2: flat-edge side button, PLUS a real eraser -
        // Microsoft's own fact sheet and support pages list it as "Eraser and
        // top button" (the same control the round Surface Pen puts on its
        // tail), not a plain shortcut button. Corrected 2026-08-22 - it had
        // been coded as no-eraser, which the pen check UI used to mask by
        // showing every control regardless of profile.
        id: 'surfaceSlimPen', label: 'Surface Slim Pen / Slim Pen 2', group: 'Microsoft',
        barrels: 1, eraser: true
    }),

    // ── Wacom ────────────────────────────────────────────────────────────
    wacomProPen3: Object.freeze({
        // Modular grip: up to three side buttons, but only two are ever
        // distinguishable to a browser (see PEN_CONTROLS) — capped at 2.
        id: 'wacomProPen3', label: 'Wacom Pro Pen 3', group: 'Wacom',
        barrels: 2, eraser: true
    }),
    wacomProPen2: Object.freeze({
        id: 'wacomProPen2', label: 'Wacom Pro Pen 2', group: 'Wacom',
        barrels: 2, eraser: true
    }),
    wacomProPen3D: Object.freeze({
        // No eraser. Its middle button's documented real default is genuinely
        // distinct and genuinely representable — hover pans, contact +
        // vertical move zooms — which is exactly how our own Pan pen-action
        // already works, so it is the one profile below that earns a real
        // `defaults` override rather than the shared baseline.
        id: 'wacomProPen3D', label: 'Wacom Pro Pen 3D', group: 'Wacom',
        barrels: 2, eraser: false,
        defaults: { barrel: PEN_ACTIONS.MENU.id, barrel2: PEN_ACTIONS.PAN.id }
    }),
    wacomAccessory: Object.freeze({
        // Grip/Classic/Art/Airbrush/Inking pens: same button+eraser shape
        // across the range. The Art Pen's barrel rotation and the Airbrush's
        // analog wheel have no control here. Finetip and Ballpoint pens are
        // NOT this shape — see wacomBareTip below.
        id: 'wacomAccessory',
        label: 'Wacom Grip / Classic / Art / Airbrush / Inking Pen', group: 'Wacom',
        barrels: 2, eraser: true
    }),
    wacomBareTip: Object.freeze({
        // Finetip Pen / Ballpoint Pen (Intuos Pro Paper Edition): refillable
        // real-ink nibs, no side buttons and no eraser at all per Wacom's own
        // store pages — pressure only, nothing to assign.
        id: 'wacomBareTip', label: 'Wacom Finetip Pen / Ballpoint Pen', group: 'Wacom',
        barrels: 0, eraser: false
    }),

    // ── XP-Pen ───────────────────────────────────────────────────────────
    // Every line shares the same two-side-button, no-eraser shape and the
    // same "one button right-click, one a driver-configured Function Key"
    // real default — Function Key has no fixed real-world action to mirror.
    // PA-series marketing calls this a "one-click toggle to eraser mode",
    // which reads like a distinct hardware eraser sensor but is not — it is
    // that same Function Key, with "switch to eraser" as one of the driver's
    // assignable actions (verified 2026-08-22 against XP-Pen's own product
    // pages: no PA model lists a separate eraser end).
    xppenX: Object.freeze({
        id: 'xppenX', label: 'XP-Pen X3 / X4 series', group: 'XP-Pen',
        barrels: 2, eraser: false
    }),
    xppenPA: Object.freeze({
        id: 'xppenPA', label: 'XP-Pen PA series (PA1/PA2/PA5/PA6)', group: 'XP-Pen',
        barrels: 2, eraser: false
    }),
    xppenP: Object.freeze({
        id: 'xppenP', label: 'XP-Pen P series (Star / Deco)', group: 'XP-Pen',
        barrels: 2, eraser: false
    }),

    // ── Huion ────────────────────────────────────────────────────────────
    // Not itemised in docs/pen-info-table.md; kept as the one family-level
    // entry it has always been (still grouped, for a consistent dropdown).
    huion: Object.freeze({
        id: 'huion', label: 'Huion', group: 'Huion', barrels: 2, eraser: false
    }),

    // ── Gaomon ───────────────────────────────────────────────────────────
    // Same two-button, no-eraser shape and the same driver-remappable
    // defaults across the range.
    gaomonAp50: Object.freeze({
        id: 'gaomonAp50', label: 'Gaomon ArtPaint AP50', group: 'Gaomon',
        barrels: 2, eraser: false
    }),
    gaomonAp32: Object.freeze({
        id: 'gaomonAp32', label: 'Gaomon ArtPaint AP32', group: 'Gaomon',
        barrels: 2, eraser: false
    }),
    gaomonAp20: Object.freeze({
        id: 'gaomonAp20', label: 'Gaomon ArtPaint AP20 / AP40', group: 'Gaomon',
        barrels: 2, eraser: false
    })
});

/**
 * Retired family-level profile ids that still resolve, to a specific model
 * that reproduces the old family's exact shape and defaults — a saved choice
 * from before the pen list was split into real models (2026-08-18) must keep
 * behaving exactly as it did, never fall back to generic and silently gain or
 * lose controls. @see PenMap#getProfile
 * @const {Object}
 */
const PEN_PROFILE_ALIASES = Object.freeze({
    apple: 'applePencil2',
    samsung: 'sPenPhone',
    microsoft: 'surfacePen',
    wacom: 'wacomProPen2',
    xppen: 'xppenX',
    gaomon: 'gaomonAp50'
    // huion and generic kept their own id - no alias needed.
});

/**
 * Out-of-the-box action for each control, shared by every profile that does
 * not name its own `defaults` override. The barrel keeps the eyedropper it
 * has always had and the tail keeps erasing, so an existing pen behaves
 * exactly as it did before this setting existed; the second barrel is new
 * ground and takes the canvas menu, which is otherwise a keyboard-only route.
 * @const {Object}
 */
const PEN_DEFAULT_ACTIONS = Object.freeze({
    tip:     PEN_ACTIONS.INK.id,          // fixed: the tip always draws
    barrel:  PEN_ACTIONS.EYEDROPPER.id,
    barrel2: PEN_ACTIONS.MENU.id,
    eraser:  PEN_ACTIONS.ERASER.id
});

/**
 * Touch admission — the three independent layers that decide whether a finger
 * on the glass draws, navigates, or is dropped on the floor. js/utils/
 * touch-policy.js resolves them; these are the out-of-the-box values.
 *
 * `drawing` stays true because a tablet with no pen to hand must work out of
 * the box, and the other two layers are what stop a palm rather than a blanket
 * ban. It is the ONE of the three reached without opening Preferences (the
 * status-bar toggle), because it is the one you change mid-drawing.
 *
 * `lockoutMs` is the old hardcoded PALM_WINDOW_MS. It was never measured on any
 * hardware - it is inherited, and it stops being a constraint by becoming
 * adjustable. LOCKOUT_MAX_MS brackets it generously rather than claiming a
 * ceiling anyone established.
 * @const {Object}
 */
const TOUCH_DEFAULTS = Object.freeze({
    drawing: true,            // a finger leaves marks
    blockWhileContact: true,  // ...but never while a pen or mouse contact is down
    lockoutMs: 500,           // ...nor within this long of the last one
    LOCKOUT_MAX_MS: 5000,
    LOCKOUT_STEP_MS: 50
});

/**
 * Tool rail / keyboard / menu metadata — the single source for everything the
 * UI needs to present a tool (docs/REFACTOR_PLAN.md §2 ledger: "tool metadata
 * (id, icon, i18n key, shortcut, options schema) -> TOOLS registry only").
 * The options schema itself lives as `static optionsSchema` on each tool class
 * (it needs tool-scope constants); everything else is here.
 *
 * Order matters: the tool rail renders groups and tools in this order, and each
 * group's `i18n` label is PRINTED as a heading above its buttons — so a group is
 * a claim about what its tools have in common, not just a separator. Cut them by
 * what the tool DOES to the picture (a dragged nib, an area fill, a dragged
 * outline, a selection, placed artwork, the viewport), because that is what an
 * artist is looking for when they scan the rail.
 *   icon     — <symbol> id in the index.html SVG sprite
 *   i18n     — label translation key (the tool's full name: aria-label + the
 *              hover name tag)
 *   hintI18n — description key: ONE sentence saying what the tool is FOR, shown
 *              when the pointer rests on the button (js/ui/tooltip-manager.js).
 *              It must not restate the name — the tag above it already did.
 *   shortcut — single-key shortcut (Phase-5 keyboard map is generated from this)
 *   variantOf — this tool is reached from ANOTHER tool's options, not from a
 *              button of its own: the rail skips it, everything else (shortcut,
 *              label, options schema, announcer) still finds it here
 *
 * The 'shape' rail entry is the ShapeTool umbrella: ToolManager._shapeVariants
 * routes it (and line/circle/… ids) onto the registered rectangle base tool.
 */
const TOOL_GROUPS = Object.freeze([
    Object.freeze({
        // Everything that lays ink on the picture: strokes first, then the two
        // area fills, then the shape umbrella, with the eyedropper last because
        // it takes colour rather than laying it.
        id: 'paint',
        i18n: 'toolgroup.paint',
        tools: Object.freeze([
            // The brush family: BRUSH hosts round/square; the rest are brushType
            // variants (ToolManager._brushVariants) that ride on the same BrushTool.
            Object.freeze({ id: TOOLS.BRUSH,               icon: 'icon-brush',            i18n: 'tool.brush',             hintI18n: 'tool.brush.hint',             shortcut: 'B' }),
            Object.freeze({ id: TOOLS.SPRAY,               icon: 'icon-spray',            i18n: 'tool.spray',             hintI18n: 'tool.spray.hint',             shortcut: 'A' }),
            Object.freeze({ id: TOOLS.FADE,                icon: 'icon-fade',             i18n: 'tool.fade',              hintI18n: 'tool.fade.hint',              shortcut: 'F' }),
            Object.freeze({ id: TOOLS.PATTERN,             icon: 'icon-pattern',          i18n: 'tool.pattern',           hintI18n: 'tool.pattern.hint',           shortcut: 'P' }),
            Object.freeze({ id: TOOLS.HATCH,               icon: 'icon-hatch',            i18n: 'tool.hatch',             hintI18n: 'tool.hatch.hint',             shortcut: 'H' }),
            Object.freeze({ id: TOOLS.ERASER,     icon: 'icon-eraser',     i18n: 'tool.eraser',     hintI18n: 'tool.eraser.hint',     shortcut: 'E' }),
            Object.freeze({ id: TOOLS.FILL,       icon: 'icon-fill',       i18n: 'tool.fill',       hintI18n: 'tool.fill.hint',       shortcut: 'G' }),
            Object.freeze({ id: TOOLS.GRADIENT,   icon: 'icon-gradient',   i18n: 'tool.gradient',   hintI18n: 'tool.gradient.hint',   shortcut: 'D' }),
            Object.freeze({ id: 'shape',          icon: 'icon-shapes',     i18n: 'tool.shape',      hintI18n: 'tool.shape.hint',      shortcut: 'S' }),
            // The curve lives INSIDE the shape umbrella: it is one more thing to
            // drag out, and the Shape option list is where you pick which. Kept
            // in the registry so its shortcut, label and options schema are found
            // exactly like any tool's — `variantOf` only says "no rail button".
            Object.freeze({ id: TOOLS.BEZIER,     icon: 'icon-bezier',     i18n: 'tool.bezier',     hintI18n: 'tool.bezier.hint', shortcut: 'C', variantOf: 'shape' }),
            Object.freeze({ id: TOOLS.EYEDROPPER, icon: 'icon-eyedropper', i18n: 'tool.eyedropper', hintI18n: 'tool.eyedropper.hint', shortcut: 'I' })
        ])
    }),
    Object.freeze({
        id: 'select',
        i18n: 'toolgroup.select',
        tools: Object.freeze([
            Object.freeze({ id: TOOLS.SELECTION,    icon: 'icon-selection',    i18n: 'tool.select', hintI18n: 'tool.selection.hint', shortcut: 'M' }),
            Object.freeze({ id: TOOLS.SELECT_ELLIPSE, icon: 'icon-select-ellipse', i18n: 'sel.ellipse', hintI18n: 'sel.ellipse.hint' }),
            Object.freeze({ id: TOOLS.SELECT_LASSO, icon: 'icon-select-lasso', i18n: 'sel.lasso', hintI18n: 'sel.lasso.hint' }),
            Object.freeze({ id: TOOLS.SELECT_CELL,  icon: 'icon-select-cell',  i18n: 'sel.cell',  hintI18n: 'sel.cell.hint' })
        ])
    }),
    Object.freeze({
        // Artwork made elsewhere and placed: a typeset string, a tile you drew.
        id: 'content',
        i18n: 'toolgroup.content',
        tools: Object.freeze([
            Object.freeze({ id: TOOLS.TEXT,            icon: 'icon-text',    i18n: 'tool.text',           hintI18n: 'tool.text.hint', shortcut: 'T' }),
            Object.freeze({ id: TOOLS.PATTERN_CREATOR, icon: 'icon-pattern-creator', i18n: 'tool.patternCreator', hintI18n: 'tool.patternCreator.hint', shortcut: 'K' })
        ])
    }),
    Object.freeze({
        id: 'view',
        i18n: 'toolgroup.view',
        tools: Object.freeze([
            Object.freeze({ id: TOOLS.ZOOM,       icon: 'icon-zoom',       i18n: 'tool.zoom',       hintI18n: 'tool.zoom.hint',       shortcut: 'Z' }),
            Object.freeze({ id: TOOLS.MOVE,       icon: 'icon-move',       i18n: 'tool.pan',        hintI18n: 'tool.pan.hint',        shortcut: 'V' })
        ])
    })
]);

/**
 * Canvas zoom configuration — the single source for the zoom dropdown options,
 * the +/- step buttons, wheel zoom, and the Fit computation.
 * @const {Object}
 */
const ZOOM_CONFIG = (() => {
    const MIN = 100, MAX = 1600, STEP = 100;
    const levels = [];
    for (let z = MIN; z <= MAX; z += STEP) levels.push(z);
    const ladder = [];
    for (let z = MIN; z <= MAX; z *= 2) ladder.push(z);
    return Object.freeze({
        MIN, MAX, STEP,
        DEFAULT: 200,
        /** Every zoom select renders exactly this list — never a local loop. */
        LEVELS: Object.freeze(levels),
        /** Multiplicative stops (100/200/400/800/1600) for the step controls:
         *  +/- buttons, wheel, keyboard and zoom-tool clicks. A doubling per
         *  stop feels uniform where a linear ±STEP is a leap at 100% and
         *  imperceptible at 1500%. The select still lists every LEVELS entry. */
        LADDER: Object.freeze(ladder),
        /** Nearest LEVELS entry to an arbitrary zoom (pinch lands between). */
        snap(zoom) {
            return clamp(Math.round((zoom || MIN) / STEP) * STEP, MIN, MAX);
        },
        /** Next LADDER stop from an arbitrary zoom in the given direction
         *  (+1 up / -1 down); clamps at the ends. */
        step(zoom, direction) {
            const z = clamp(zoom || MIN, MIN, MAX);
            if (direction > 0) {
                for (const l of ladder) { if (l > z) return l; }
                return MAX;
            }
            for (let i = ladder.length - 1; i >= 0; i--) {
                if (ladder[i] < z) return ladder[i];
            }
            return MIN;
        }
    });
})();

/**
 * Event names for EventBus
 * Namespace format: 'category:action'
 * @const {Object}
 */
const EVENTS = Object.freeze({
    // Pixel events
    PIXEL_BATCH_START: 'pixel:batchStart',
    PIXEL_BATCH_END: 'pixel:batchEnd',

    // Layer events
    LAYER_CREATED: 'layer:created',
    LAYER_DELETED: 'layer:deleted',
    LAYER_SELECTED: 'layer:selected',
    LAYER_VISIBILITY: 'layer:visibility',
    LAYER_ORDER: 'layer:order',

    // Tool events
    TOOL_SELECTED: 'tool:selected',
    TOOL_OPTIONS: 'tool:options',
    BRUSH_TYPE_CHANGED: 'brush:typeChanged',
    BRUSH_SIZE_CHANGED: 'brush:sizeChanged',

    // Color events
    COLOR_INK: 'color:ink',
    COLOR_PAPER: 'color:paper',
    COLOR_BRIGHT: 'color:bright',
    COLOR_FLASH: 'color:flash',
    COLOR_BORDER: 'color:border',
    PALETTE_CHANGED: 'color:paletteChanged',

    // Canvas events
    CANVAS_RENDER: 'canvas:render',
    CANVAS_DIRTY: 'canvas:dirty',
    CANVAS_ZOOM: 'canvas:zoom',
    CANVAS_SCALE_CHANGED: 'canvas:scaleChanged',
    GRID_SNAP_CHANGED: 'grid:snapChanged',
    GRID_VISIBILITY: 'grid:visibility',
    SYMMETRY_CHANGED: 'symmetry:changed',
    CLIP_CHANGED: 'clip:changed',
    DRAW_MODE_CHANGED: 'draw:modeChanged',

    // Input events
    INPUT_POINTER_MOVE: 'input:pointerMove',
    INPUT_KEY_DOWN: 'input:keyDown',
    INPUT_WHEEL_ZOOM: 'input:wheelZoom',
    INPUT_WHEEL_PAN: 'input:wheelPan',
    TOUCH_MODE_CHANGED: 'input:touchModeChanged',

    // Shortcut events
    SHORTCUT_SAVE: 'shortcut:save',
    SHORTCUT_OPEN: 'shortcut:open',
    SHORTCUT_NEW: 'shortcut:new',
    SHORTCUT_PAN_MODE: 'shortcut:panMode',

    // History events
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',

    // UI events
    UI_THEME_CHANGE: 'ui:themeChange',
    UI_LANGUAGE_CHANGE: 'ui:languageChange',
    UI_SCALE_CHANGED: 'ui:scaleChanged',
    THEME_CHANGED: 'theme:changed',
    PANEL_COLLAPSE_CHANGED: 'ui:panelCollapseChanged',
    PANEL_VISIBILITY_CHANGED: 'ui:panelVisibilityChanged',
    COLORRAIL_COLLAPSE_CHANGED: 'ui:colorrailCollapseChanged',

    // File events
    FILE_NEW: 'file:new',
    FILE_OPEN: 'file:open',
    FILE_SAVE: 'file:save',
    FILE_EXPORT: 'file:export',
    FILE_IMPORT: 'file:import',
    FILE_ERROR: 'file:error',

    // Pattern events
    BACKUP_STATE_CHANGED: 'backup:stateChanged',
    BACKUP_WRITTEN: 'backup:written',
    PATTERN_CHANGED: 'pattern:changed',
    PATTERN_LIBRARY_FULL: 'pattern:libraryFull',

    // Map/tile editor events (facts from MapService)
    MAP_CHANGED: 'map:changed',
    MAP_TILESET_CHANGED: 'map:tilesetChanged',
    MAP_LOADED: 'map:loaded',

    // Font editor events (facts from FontService)
    FONT_CHANGED: 'font:changed',
    FONT_LOADED: 'font:loaded',
    FONT_LIBRARY_CHANGED: 'font:libraryChanged',

    // Sprite editor events (facts from SpriteService, Phase 13)
    SPRITE_CHANGED: 'sprite:changed',
    SPRITE_LOADED: 'sprite:loaded',

    // Reference layer — commands (UI -> service)
    REFERENCE_LOAD: 'reference:load',
    REFERENCE_CLEAR: 'reference:clear',
    REFERENCE_VISIBILITY: 'reference:visibility',
    REFERENCE_OPACITY: 'reference:opacity',
    REFERENCE_OFFSET: 'reference:offset',
    REFERENCE_SCALE: 'reference:scale',
    REFERENCE_ROTATION: 'reference:rotation',
    REFERENCE_FLIP: 'reference:flip',
    REFERENCE_FIT: 'reference:fit',
    REFERENCE_CENTER: 'reference:center',
    REFERENCE_RESET: 'reference:reset',

    // Reference layer — facts (service -> UI)
    REFERENCE_LOADED: 'reference:loaded',
    REFERENCE_ERROR: 'reference:error',
    REFERENCE_CLEARED: 'reference:cleared',
    REFERENCE_VISIBILITY_CHANGED: 'reference:visibilityChanged',
    REFERENCE_OPACITY_CHANGED: 'reference:opacityChanged',
    REFERENCE_OFFSET_CHANGED: 'reference:offsetChanged',
    REFERENCE_SCALE_CHANGED: 'reference:scaleChanged',
    REFERENCE_ROTATION_CHANGED: 'reference:rotationChanged',
    REFERENCE_FLIP_CHANGED: 'reference:flipChanged',
    REFERENCE_FITTED: 'reference:fitted',
    REFERENCE_CENTERED: 'reference:centered',
    REFERENCE_TRANSFORM_RESET: 'reference:transformReset',

    // User presets (facts from PresetService — the slot library and recalls)
    PRESET_SAVED: 'preset:saved',
    PRESET_APPLIED: 'preset:applied',
    PRESET_LIBRARY_CHANGED: 'preset:libraryChanged',

    // Tool presets — one tool's own options under a name, filed by tool id.
    // Separate facts from the slot library above because they are a separate
    // library: a listener showing the brush's presets must not redraw for a
    // workspace slot being filled, and vice versa.
    TOOL_PRESET_APPLIED: 'toolPreset:applied',
    TOOL_PRESETS_CHANGED: 'toolPreset:changed',

    // Autosave cadence (Preferences > autosave minutes; 0 = off)
    AUTOSAVE_INTERVAL_CHANGED: 'autosave:intervalChanged',

    // Attribute paint mode
    ATTR_PAINT_MODE: 'attr:paintMode',

    // Transform events — a fixed-angle rotation (90/180) was baked into the
    // document via TransformService, as opposed to the transform panel's
    // live free-angle slider. The panel listens for this to reset the
    // cumulative-rotation readout it keeps beside that slider.
    TRANSFORM_FIXED_ROTATE: 'transform:fixedRotate',

    // State events
    STATE_CHANGED: 'state:changed',
    STATE_RESET: 'state:reset',

    // Screen mode (Phase 12a — emitted by ScreenModeService on every switch)
    SCREEN_MODE_CHANGED: 'mode:changed',

    // GigaScreen view fact (Phase 12b — emitted by LayerManager when the
    // canvas view toggles between the blend and a single sub-screen)
    GIGA_VIEW_CHANGED: 'mode:gigaViewChanged'
});

/**
 * Pixel/cell coordinate utilities — LIVE against the active screen mode.
 * Centralised so every module uses the same formula.
 * pixelToCell: pixel -> attribute cell (cell geometry from the descriptor)
 * cellToPixel: cell  -> top-left pixel of that cell
 * cellIndex:   cell  -> flat index into a GRID_COLS×GRID_ROWS attribute array
 */
const ZX_COORDS = Object.freeze({
    pixelToCell: (px, py) => ({
        x: Math.floor(px / _activeScreenMode.attrCellW),
        y: Math.floor(py / _activeScreenMode.attrCellH)
    }),
    cellToPixel: (cx, cy) => ({
        x: cx * _activeScreenMode.attrCellW,
        y: cy * _activeScreenMode.attrCellH
    }),
    cellIndex: (cx, cy) =>
        cy * (_activeScreenMode.width / _activeScreenMode.attrCellW) + cx
});

/**
 * ULAplus palette register math — single source for the G3R3B2 encoding
 * (register byte layout GGGRRRBB, per the ULAplus spec; integer scaling
 * replicates RECOIL's reference decoder exactly so our rendering matches
 * the ecosystem's).
 *
 * defaultRegisters(): a 64-register set that reproduces the standard
 * Spectrum palette as closely as G3R3B2 allows. CLUT layout follows the
 * hardware mapping CLUT = FLASH*2 + BRIGHT: CLUTs 0/2 hold the non-bright
 * colours (G=R=level 5 of 7 ≈ 0xB6, B=level 2 of 3 ≈ 0xAA — chosen so
 * bright and non-bright stay visually distinct within 2-bit blue), CLUTs
 * 1/3 the bright ones. Ink half = entries 0–7, paper half = entries 8–15
 * of each CLUT, both holding the same 8 base colours.
 */
const ULAPLUS = Object.freeze({
    /** G3R3B2 register byte -> [r, g, b] (0–255 each). */
    registerToRGB(byte) {
        const r = (byte & 0x1C) * 73 >> 3;
        const g = (byte >> 5) * 73 >> 1;
        const b = (byte & 0x03) * 85;
        return [r, g, b];
    },

    /** [r, g, b] -> nearest G3R3B2 register byte. */
    rgbToRegister(r, g, b) {
        const r3 = Math.round(r * 7 / 255);
        const g3 = Math.round(g * 7 / 255);
        const b2 = Math.round(b * 3 / 255);
        return ((g3 & 7) << 5) | ((r3 & 7) << 2) | (b2 & 3);
    },

    /** G3R3B2 register byte -> '#rrggbb' hex string. */
    registerToHex(byte) {
        const [r, g, b] = this.registerToRGB(byte);
        const h = (v) => v.toString(16).padStart(2, '0');
        return `#${h(r)}${h(g)}${h(b)}`;
    },

    /** The default 64-register palette (see block comment above). */
    defaultRegisters() {
        const regs = new Uint8Array(64);
        for (let clut = 0; clut < 4; clut++) {
            const bright = (clut & 1) !== 0;
            for (let base = 0; base < 8; base++) {
                // ZX base colour bit layout: G = bit 2, R = bit 1, B = bit 0
                const g = (base & 4) ? (bright ? 7 : 5) : 0;
                const r = (base & 2) ? (bright ? 7 : 5) : 0;
                const b = (base & 1) ? (bright ? 3 : 2) : 0;
                const reg = (g << 5) | (r << 2) | b;
                regs[clut * 16 + base] = reg;     // ink half
                regs[clut * 16 + 8 + base] = reg; // paper half
            }
        }
        return regs;
    }
});

/**
 * ZX Spectrum Next 9-bit RGB333 palette register math (Phase 13) — single
 * source for the Next palette encoding, mirroring ULAPLUS above.
 *
 * A register is 9 bits: RRRGGGBBB (r3<<6 | g3<<3 | b3). The interchange
 * byte pair (as .nxi / .npl / .pal store it, and as the hardware's nreg
 * $44 two-write sequence takes it) is byte0 = RRRGGGBB (the top two blue
 * bits), byte1 bit 0 = the blue LSB — layout and the 3-bit channel scale
 * `n*73>>1` are RECOIL's DecodeNxi exactly, so our rendering matches the
 * reference decoder. byteToRegister() is the hardware's 8-bit palette
 * write rule (nreg $41): the missing blue LSB becomes the OR of the two
 * stored blue bits.
 *
 * defaultRegisters(): OUR documented default (the hardware boot palette
 * is the plain identity RRRGGGBB ramp): entries 0–15 and 128–143 hold the
 * classic ZX 16 colours (non-bright at level 6 of 7 — 219 ≈ the ZX's 215,
 * exact enough that classic->indexed conversion lands on these slots;
 * bright at 7), so every rgb333 mode starts with usable classics and
 * ULANEXT reproduces the standard look in both its ink and paper halves;
 * every other entry is the identity ramp. DEFAULT_INK/DEFAULT_PAPER are
 * the boot drawing indices for indexed modes (black on white, like the
 * classic ink 0 / paper 7).
 */
const NEXTRGB333 = Object.freeze({
    DEFAULT_INK: 0,
    DEFAULT_PAPER: 7,

    /** 9-bit register -> [r, g, b] (0–255 each; RECOIL's n*73>>1 scale). */
    registerToRGB(reg) {
        return [
            ((reg >> 6) & 7) * 73 >> 1,
            ((reg >> 3) & 7) * 73 >> 1,
            (reg & 7) * 73 >> 1
        ];
    },

    /** [r, g, b] -> nearest 9-bit register. */
    rgbToRegister(r, g, b) {
        const q = (v) => Math.round(v * 7 / 255) & 7;
        return (q(r) << 6) | (q(g) << 3) | q(b);
    },

    /** 9-bit register -> '#rrggbb' hex string. */
    registerToHex(reg) {
        const [r, g, b] = this.registerToRGB(reg);
        const h = (v) => v.toString(16).padStart(2, '0');
        return `#${h(r)}${h(g)}${h(b)}`;
    },

    /** Interchange byte pair (RRRGGGBB + blue-LSB byte) -> 9-bit register. */
    bytesToRegister(b0, b1) {
        return (((b0 >> 5) & 7) << 6) | (((b0 >> 2) & 7) << 3)
            | (((b0 & 3) << 1) | (b1 & 1));
    },

    /** 9-bit register -> [byte0, byte1] interchange pair. */
    registerToBytes(reg) {
        const b3 = reg & 7;
        return [
            (((reg >> 6) & 7) << 5) | (((reg >> 3) & 7) << 2) | (b3 >> 1),
            b3 & 1
        ];
    },

    /** 8-bit RRRGGGBB -> 9-bit register (blue LSB = OR of the two blue bits). */
    byteToRegister(b0) {
        const b2 = b0 & 3;
        return (((b0 >> 5) & 7) << 6) | (((b0 >> 2) & 7) << 3)
            | ((b2 << 1) | ((b2 | (b2 >> 1)) & 1));
    },

    /** The default 256-register palette (see block comment above). */
    defaultRegisters() {
        const regs = new Uint16Array(256);
        for (let i = 0; i < 256; i++) regs[i] = this.byteToRegister(i);
        for (let base = 0; base < 8; base++) {
            for (const bright of [false, true]) {
                const level = bright ? 7 : 6;
                const reg = (((base & 2) ? level : 0) << 6)
                    | (((base & 4) ? level : 0) << 3)
                    | ((base & 1) ? level : 0);
                const i = base + (bright ? 8 : 0);
                regs[i] = reg;        // ink half (and Layer 2 classics)
                regs[128 + i] = reg;  // ULANext paper half
            }
        }
        return regs;
    }
});

// Expose to global scope
window.APP_VERSION = APP_VERSION;
window.SCREEN_MODES = SCREEN_MODES;
window.NEXTRGB333 = NEXTRGB333;
// ACTIVE_SCREEN_MODE is an accessor so every `ACTIVE_SCREEN_MODE.width`-style
// read stays live across runtime mode switches (no lexical const on purpose —
// bare references must resolve to this window property in browser AND Node).
Object.defineProperty(window, 'ACTIVE_SCREEN_MODE', {
    get: () => _activeScreenMode,
    configurable: true
});
window.getScreenModeById = getScreenModeById;
window.__setActiveScreenMode = __setActiveScreenMode;
window.ULAPLUS = ULAPLUS;
window.ZX_SPECTRUM = ZX_SPECTRUM;
window.ZX_PALETTE = ZX_PALETTE;
window.ZX_PALETTE_RGB = ZX_PALETTE_RGB;
window.DEFAULT_ZOOM = DEFAULT_ZOOM;
window.DRAW_MODE = DRAW_MODE;
window.DEFAULT_CELL_ATTRS = DEFAULT_CELL_ATTRS;
window.TOOLS = TOOLS;
window.TOOL_GROUPS = TOOL_GROUPS;
window.PEN_CONTROLS = PEN_CONTROLS;
window.PEN_ACTIONS = PEN_ACTIONS;
window.PEN_PROFILES = PEN_PROFILES;
window.PEN_PROFILE_ALIASES = PEN_PROFILE_ALIASES;
window.PEN_DEFAULT_ACTIONS = PEN_DEFAULT_ACTIONS;
window.TOUCH_DEFAULTS = TOUCH_DEFAULTS;
window.ZOOM_CONFIG = ZOOM_CONFIG;
window.EVENTS = EVENTS;
window.ZX_COORDS = ZX_COORDS;
