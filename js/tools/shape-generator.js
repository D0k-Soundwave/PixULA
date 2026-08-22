'use strict';
(function() {

/**
 * Shape Generator
 *
 * Comprehensive shape system with 30+ drawable shapes.
 * Features:
 * - Mathematical algorithms for precise rendering
 * - Filled and outlined variants for all shapes
 * - ZX Spectrum pixel-perfect rendering at 256x192
 * - Zero-point anchor drawing support
 */

/**
 * Shape categories for anchor behavior
 */
const SHAPE_CATEGORIES = Object.freeze({
    RADIAL_CENTER: 'radial_center',     // center-out drawing
    CORNER_DRAG: 'corner_drag',         // corner to corner
    BASE_UP: 'base_up',                 // base to apex
    DIRECTIONAL: 'directional',         // start to end vector
    CENTER_SYMMETRIC: 'center_symmetric', // center-based symmetric
    POLYGON_REGULAR: 'polygon_regular'  // regular polygon inscribed
});

/**
 * How each shape is posed inside a preview box (ShapeGenerator.iconRaster).
 * Unlisted shapes take the whole box, corner to corner.
 *   radius — x1,y1 is the CENTRE and the second point sets the radius; `dir`
 *            is the direction the drag would have gone (it decides which way
 *            an arc opens, where a diamond's first vertex lands, which side a
 *            crescent is lit from), `radius` scales it down where the shape
 *            draws outside its nominal circle.
 *   half   — the vertex shapes (star/flower/gear) whose radius is the box
 *            diagonal over sqrt(2), i.e. its side: a half-size box fills the
 *            icon, a full-size one draws at twice the box.
 * @const {Object}
 */
/**
 * Shapes whose icon carries their side count as a numeral.
 *
 * An outline can only say so much at 25 pixels: a pentagon reads, a hexagon
 * reads, and from seven sides up every one of them is a circle with a slightly
 * lumpy edge — the button for a nonagon and the button for a dodecagon were
 * the same picture. What distinguishes them is a NUMBER, so the icon prints
 * it, in the machine's own 8x8 charset (js/data/zx-rom-font.js — the same
 * glyphs the text tool sets). The whole regular-polygon family is numbered,
 * not just the ambiguous half: a row reading 5 6 7 8 9 10 12 is scannable in
 * a way that a row of shapes with numbers on only some of them is not.
 * @const {Object}
 */
const ICON_BADGE = Object.freeze({
    pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8,
    nonagon: 9, decagon: 10, dodecagon: 12
});

/**
 * Icons drawn specially, for shapes whose own raster stops saying what it is
 * once it is this small. Each is still built from the shape's construction —
 * the same parts in the same places — so it represents the shape rather than
 * illustrating it: this is a posing decision, not a different drawing.
 *
 * Called with the generator as `this`, given the box's highest coordinate.
 * @const {Object<string, function(number): Array<{x: number, y: number}>>}
 */
const ICON_ART = Object.freeze({
    /**
     * A flower is a ring of petal circles with the parts inside their
     * neighbours removed. At icon size the petals are wider than the gaps
     * between them, so the merge closes every notch and the shape comes out a
     * cloud. The icon draws the same ring UNMERGED and slightly tighter, which
     * is the picture the merge is trying to give you at a size where it can.
     */
    flower(max) {
        const c = Math.round(max / 2);
        const petalR = Math.max(2, Math.round(max * 0.17));
        const ringR = Math.max(3, Math.round(max * 0.33));

        const pts = [];
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI / 3);
            pts.push(...this._midpointCircle(
                Math.round(c + ringR * Math.cos(angle)),
                Math.round(c + ringR * Math.sin(angle)),
                petalR));
        }
        return pts;
    },

    /**
     * A gear's teeth are cut from arcs that meet at the tooth flanks. Below
     * about a pixel per flank those arcs cross each other and the icon becomes
     * a scribble with a hole in it. The icon states the same three parts —
     * rim, teeth, bore — with the teeth as solid blocks on the rim, which is
     * how a cog reads at this size.
     */
    gear(max) {
        const c = Math.round(max / 2);
        const rimR = Math.max(3, Math.round(max * 0.29));
        const boreR = Math.max(1, Math.round(max * 0.11));
        const tooth = Math.max(1, Math.round(max * 0.045));   // half-side of the block
        const toothAt = rimR + tooth;

        const pts = [
            ...this._midpointCircle(c, c, rimR),
            ...this._midpointCircle(c, c, boreR)
        ];
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const tx = Math.round(c + toothAt * Math.cos(angle));
            const ty = Math.round(c + toothAt * Math.sin(angle));
            for (let dy = -tooth; dy <= tooth; dy++) {
                for (let dx = -tooth; dx <= tooth; dx++) pts.push({ x: tx + dx, y: ty + dy });
            }
        }
        return pts;
    }
});

const POLYGON_POSE = { mode: 'radius', dir: [0, -1] };   // first vertex at the top
/** Wide box: what tells a rectangle from a square, an ellipse from a circle. */
const WIDE_POSE = { mode: 'box', box: [0, 0.16, 1, 0.84] };
const ICON_POSE = Object.freeze({
    rectangle: WIDE_POSE,
    ellipse:   WIDE_POSE,
    // Struck from a centre, first vertex / lit side / opening in `dir`.
    arc:      { mode: 'radius', origin: [0.5, 0.78], dir: [0, -1] },
    sector:   { mode: 'radius', origin: [0.5, 1], dir: [0, -1], radius: 1.4 },
    triangle: { mode: 'radius', origin: [0.5, 1], dir: [0, -1], radius: 1.7 },
    house:    { mode: 'radius', origin: [0.5, 1], dir: [0, -1], radius: 1.7 },
    // Left edge to right edge: the diagonal a corner-to-corner pose gives is
    // the one direction an arrow reads worst in.
    arrow:    { mode: 'radius', origin: [0, 0.5], dir: [1, 0], radius: 2 },
    spiral:   { mode: 'radius', dir: [1, 0] },
    ring:     { mode: 'radius', dir: [1, 0] },
    moon:     { mode: 'radius', dir: [1, 0] },
    diamond:  { mode: 'radius', dir: [0, -1] },
    pentagon: POLYGON_POSE, hexagon:  POLYGON_POSE, heptagon: POLYGON_POSE,
    octagon:  POLYGON_POSE, nonagon:  POLYGON_POSE, decagon:  POLYGON_POSE,
    dodecagon: POLYGON_POSE, polygon: POLYGON_POSE,
    trapezoid: POLYGON_POSE, kite: POLYGON_POSE,
    star:    { mode: 'half' },
    flower:  { mode: 'half' },
    gear:    { mode: 'half' }
});

/**
 * All available shape types
 */
const EXTENDED_SHAPE_TYPES = Object.freeze({
    // Basic
    LINE: 'line',
    RECTANGLE: 'rectangle',
    SQUARE: 'square',
    ROUNDED_RECTANGLE: 'rounded-rectangle',

    // Radial
    CIRCLE: 'circle',
    ELLIPSE: 'ellipse',
    ARC: 'arc',
    SECTOR: 'sector',
    RING: 'ring',

    // Polygons
    TRIANGLE: 'triangle',
    DIAMOND: 'diamond',
    PENTAGON: 'pentagon',
    HEXAGON: 'hexagon',
    HEPTAGON: 'heptagon',
    OCTAGON: 'octagon',
    NONAGON: 'nonagon',
    DECAGON: 'decagon',
    DODECAGON: 'dodecagon',
    POLYGON: 'polygon',

    // Arrows
    ARROW: 'arrow',
    ARROW_UP: 'arrow-up',
    ARROW_RIGHT: 'arrow-right',
    ARROW_DOWN: 'arrow-down',
    ARROW_LEFT: 'arrow-left',

    // Symbols
    CROSS: 'x',
    PLUS: 'plus',
    HEART: 'heart',
    STAR: 'star',

    // Complex
    HOUSE: 'house',
    MOON: 'moon',
    FLOWER: 'flower',
    GEAR: 'gear',
    SPIRAL: 'spiral',
    BOWTIE: 'bowtie',
    HOURGLASS: 'hourglass',

    // Quadrilaterals
    TRAPEZOID: 'trapezoid',
    PARALLELOGRAM: 'parallelogram',
    KITE: 'kite'
});

// Expose shape types
window.EXTENDED_SHAPE_TYPES = EXTENDED_SHAPE_TYPES;

class ShapeGeneratorClass {
    constructor() {
        this.shapes = new Map();
        this.filledShapes = new Map();
        this.categoryMap = new Map();

        // Pre-allocated buffers for fill operations (reduces GC pressure)
        // Sized from the active screen mode (max pixel count + slack)
        this._fillBufferX = new Uint16Array(ZX_SPECTRUM.WIDTH * ZX_SPECTRUM.HEIGHT + 1024);
        this._fillBufferY = new Uint16Array(ZX_SPECTRUM.WIDTH * ZX_SPECTRUM.HEIGHT + 1024);
        this._fillBufferLength = 0;

        // Edge buffers (max ~100 edges for complex shapes)
        this._edgeYMin = new Int16Array(128);
        this._edgeYMax = new Int16Array(128);
        this._edgeX = new Int16Array(128);
        this._edgeDeltaX = new Int16Array(128);
        this._edgeDeltaY = new Int16Array(128);
        this._edgeXStep = new Int8Array(128);
        this._edgeOrder = new Uint8Array(128);

        // Active edge buffers
        this._activeIdx = new Uint8Array(64);
        this._activeX = new Int16Array(64);
        this._activeError = new Int16Array(64);

        // Intersection buffer
        this._intersections = new Int16Array(64);

        // Vertex buffer (max ~100 vertices)
        this._vertexX = new Int16Array(128);
        this._vertexY = new Int16Array(128);

        this._initializeShapes();
    }

    /**
     * Double the scanline fill buffers.
     *
     * They are sized at construction from the screen mode in force THEN, and a
     * mode switch can hand us a bigger screen (Layer 2 at 640x256 is over three
     * times the standard 256x192). Writes past the end of a typed array are
     * silently dropped, so without this a large-mode fill would quietly lose
     * its bottom rows rather than fail.
     * @private
     */
    _growFillBuffer() {
        const grown = this._fillBufferX.length * 2;
        const x = new Uint16Array(grown);
        const y = new Uint16Array(grown);
        x.set(this._fillBufferX);
        y.set(this._fillBufferY);
        this._fillBufferX = x;
        this._fillBufferY = y;
    }

    /**
     * Initialize all shape generators
     * @private
     */
    _initializeShapes() {
        // Map shapes to categories
        this._mapCategories();

        // Register outline generators
        this.shapes.set('line', this._generateLine.bind(this));
        this.shapes.set('rectangle', this._generateRectangle.bind(this));
        this.shapes.set('square', this._generateSquare.bind(this));
        this.shapes.set('circle', this._generateCircle.bind(this));
        this.shapes.set('ellipse', this._generateEllipse.bind(this));
        this.shapes.set('arc', this._generateArc.bind(this));
        this.shapes.set('sector', this._generateSector.bind(this));
        this.shapes.set('triangle', this._generateTriangle.bind(this));
        this.shapes.set('diamond', this._generateDiamond.bind(this));
        this.shapes.set('pentagon', this._generatePentagon.bind(this));
        this.shapes.set('hexagon', this._generateHexagon.bind(this));
        this.shapes.set('octagon', this._generateOctagon.bind(this));
        this.shapes.set('polygon', this._generatePolygon.bind(this));
        this.shapes.set('arrow', this._generateArrow.bind(this));
        this.shapes.set('arrow-up', this._generateArrowUp.bind(this));
        this.shapes.set('arrow-right', this._generateArrowRight.bind(this));
        this.shapes.set('arrow-down', this._generateArrowDown.bind(this));
        this.shapes.set('arrow-left', this._generateArrowLeft.bind(this));
        this.shapes.set('x', this._generateCross.bind(this));
        this.shapes.set('plus', this._generatePlus.bind(this));
        this.shapes.set('heart', this._generateHeart.bind(this));
        this.shapes.set('star', this._generateStar.bind(this));
        this.shapes.set('house', this._generateHouse.bind(this));
        this.shapes.set('moon', this._generateMoon.bind(this));
        this.shapes.set('flower', this._generateFlower.bind(this));
        this.shapes.set('gear', this._generateGear.bind(this));
        this.shapes.set('spiral', this._generateSpiral.bind(this));
        this.shapes.set('bowtie', this._generateBowtie.bind(this));
        this.shapes.set('hourglass', this._generateHourglass.bind(this));
        this.shapes.set('trapezoid', this._generateTrapezoid.bind(this));
        this.shapes.set('parallelogram', this._generateParallelogram.bind(this));
        this.shapes.set('kite', this._generateKite.bind(this));
        this.shapes.set('heptagon', this._generateHeptagon.bind(this));
        this.shapes.set('nonagon', this._generateNonagon.bind(this));
        this.shapes.set('decagon', this._generateDecagon.bind(this));
        this.shapes.set('dodecagon', this._generateDodecagon.bind(this));
        this.shapes.set('ring', this._generateRing.bind(this));
        this.shapes.set('rounded-rectangle', this._generateRoundedRectangle.bind(this));

        // Register filled versions
        const fillable = [
            'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'diamond',
            'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'dodecagon',
            'polygon', 'heart', 'star', 'house',
            'trapezoid', 'parallelogram', 'kite', 'moon', 'flower', 'gear',
            'arrow', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'sector',
            'bowtie', 'hourglass', 'ring', 'rounded-rectangle'
        ];

        fillable.forEach(shape => {
            this.filledShapes.set(shape, (bounds, options) => {
                return this._generateFilledShape(shape, bounds, options);
            });
        });

        Logger.debug('ShapeGenerator', `Initialized ${this.shapes.size} shapes`);
    }

    /**
     * Map shapes to their drawing categories
     * @private
     */
    _mapCategories() {
        const radialCenter = ['circle', 'ellipse', 'arc', 'sector', 'spiral', 'star', 'flower', 'gear', 'moon', 'diamond', 'ring'];
        const cornerDrag = ['rectangle', 'square', 'bowtie', 'rounded-rectangle'];
        const baseUp = ['triangle', 'house'];
        const directional = ['line', 'arrow'];
        const centerSymmetric = ['heart', 'x', 'plus', 'hourglass', 'kite'];
        const polygonRegular = ['pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'dodecagon', 'polygon', 'trapezoid', 'parallelogram'];

        radialCenter.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.RADIAL_CENTER));
        cornerDrag.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.CORNER_DRAG));
        baseUp.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.BASE_UP));
        directional.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.DIRECTIONAL));
        centerSymmetric.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.CENTER_SYMMETRIC));
        polygonRegular.forEach(s => this.categoryMap.set(s, SHAPE_CATEGORIES.POLYGON_REGULAR));

        // Fixed directional arrows
        ['arrow-up', 'arrow-right', 'arrow-down', 'arrow-left'].forEach(s => {
            this.categoryMap.set(s, SHAPE_CATEGORIES.DIRECTIONAL);
        });
    }

    /**
     * Generate shape points
     * @param {string} shapeType - Type of shape
     * @param {Object} bounds - {x1, y1, x2, y2}
     * @param {Object} options - {filled, strokeWidth}
     * @returns {Array<{x: number, y: number}>}
     */
    generateShape(shapeType, bounds, options = {}) {
        const { filled = false } = options;

        if (!shapeType || !bounds) {
            Logger.warn('ShapeGenerator', 'Invalid shape or bounds');
            return [];
        }

        const standardBounds = this._standardizeBounds(shapeType, bounds);

        if (filled && this.filledShapes.has(shapeType)) {
            return this.filledShapes.get(shapeType)(standardBounds, options);
        }

        const generator = this.shapes.get(shapeType);
        if (!generator) {
            Logger.warn('ShapeGenerator', `Unknown shape: ${shapeType}`);
            return [];
        }

        // Outline shapes honour a stroke thickness: dilate the 1-px outline by a
        // disc (the same _thickenPoints the line and nib footprint use). Filled
        // shapes returned above and are never thickened. thickness 1 = no change.
        const points = generator(standardBounds, options);
        const thickness = Helpers.clamp(Math.round(options.thickness || 1), 1, 16);
        return thickness > 1 ? this._thickenPoints(points, thickness) : points;
    }

    /**
     * Get list of available shapes
     * @returns {string[]}
     */
    getAvailableShapes() {
        return Array.from(this.shapes.keys());
    }

    /**
     * Check if a shape type is supported
     * @param {string} shapeType
     * @returns {boolean}
     */
    hasShape(shapeType) {
        return this.shapes.has(shapeType);
    }

    /**
     * Get shape category
     * @param {string} shapeType
     * @returns {string|null}
     */
    getCategory(shapeType) {
        return this.categoryMap.get(shapeType) || null;
    }

    /**
     * Rasterize a shape POSED to fill a size x size preview box — the picture
     * on a shape's button in the tool options.
     *
     * The icon is the shape's own raster rather than a hand-drawn glyph, so it
     * cannot drift from what the tool actually draws: change a generator and
     * its button changes with it. That is the whole reason this lives next to
     * the generators instead of in the sprite sheet.
     *
     * Posing is a separate question from interpreting a drag, and needs its own
     * answer: some generators read `bounds` as two corners, some read x1,y1 as
     * the CENTRE with the second point setting a radius (a drag that would
     * start in the middle of the picture), and the vertex shapes take the box
     * DIAGONAL as their radius, so a full-box pose draws them at double size.
     * ICON_POSE records which is which; everything unlisted is corner-to-corner.
     *
     * @param {string} shapeType
     * @param {number} [size=24] - box side in pixels
     * @param {Object} [options] - generator options (filled, points, teeth, …)
     * @returns {Array<{x: number, y: number}>} points, deduplicated, clipped
     *          to the box
     */
    iconRaster(shapeType, size = 24, options = {}) {
        const max = Math.max(1, Math.round(size)) - 1;
        const c = Math.round(max / 2);
        const pose = ICON_POSE[shapeType] || { mode: 'box' };

        let bounds;
        if (pose.mode === 'radius') {
            // `origin` (fractions of the box, default its centre) is where the
            // drag would have STARTED; the second point is one radius away
            // along `dir`, radius being a multiple of the box half-width.
            const ox = Math.round((pose.origin ? pose.origin[0] : 0.5) * max);
            const oy = Math.round((pose.origin ? pose.origin[1] : 0.5) * max);
            const r = Math.round(c * (pose.radius || 1));
            bounds = { x1: ox, y1: oy, x2: ox + pose.dir[0] * r, y2: oy + pose.dir[1] * r };
        } else if (pose.mode === 'half') {
            // Box of side c, centred: these read radius = diagonal / sqrt(2),
            // which for a square box is its SIDE — so side c fills the icon.
            const h = Math.round(c / 2);
            bounds = { x1: c - h, y1: c - h, x2: c + h, y2: c + h };
        } else if (pose.box) {
            // Explicit corners as fractions of the box.
            bounds = {
                x1: Math.round(pose.box[0] * max), y1: Math.round(pose.box[1] * max),
                x2: Math.round(pose.box[2] * max), y2: Math.round(pose.box[3] * max)
            };
        } else {
            bounds = { x1: 0, y1: 0, x2: max, y2: max };
        }

        const points = ICON_ART[shapeType]
            ? ICON_ART[shapeType].call(this, max)
            : this.generateShape(shapeType, bounds, options);
        if (ICON_BADGE[shapeType]) points.push(...this._badgePixels(ICON_BADGE[shapeType], max));

        const seen = new Set();
        const out = [];
        for (const p of points) {
            const x = Math.round(p.x), y = Math.round(p.y);
            if (x < 0 || x > max || y < 0 || y > max) continue;
            const key = y * (max + 1) + x;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ x, y });
        }
        return out;
    }

    /**
     * The side-count numeral for an icon, centred in the box, set in the ZX
     * charset. Each glyph is trimmed to its own ink before the digits are
     * spaced, because the ROM cells carry their own side bearings and two
     * digits laid out on the 8-pixel advance would sit a third of the box
     * apart. Empty when the charset is not loaded — an outline with no number
     * beats an exception.
     * @param {number} number
     * @param {number} max - highest coordinate in the box
     * @returns {Array<{x: number, y: number}>}
     * @private
     */
    _badgePixels(number, max) {
        const font = (typeof window !== 'undefined') ? window.ZX_ROM_FONT : null;
        if (!font) return [];

        const GLYPH = 8;          // ZX cell: 8 rows, MSB the leftmost pixel
        const GAP = 1;            // between digits, once each is trimmed
        const digits = [];

        for (const ch of String(number)) {
            const base = (ch.charCodeAt(0) - 32) * GLYPH;
            const cell = [];
            let minX = GLYPH, maxX = -1, minY = GLYPH, maxY = -1;
            for (let row = 0; row < GLYPH; row++) {
                const bits = font[base + row] || 0;
                for (let col = 0; col < GLYPH; col++) {
                    if (!((bits >> (GLYPH - 1 - col)) & 1)) continue;
                    cell.push({ x: col, y: row });
                    if (col < minX) minX = col;
                    if (col > maxX) maxX = col;
                    if (row < minY) minY = row;
                    if (row > maxY) maxY = row;
                }
            }
            if (maxX < 0) continue;
            digits.push({ cell, minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
        if (!digits.length) return [];

        const totalW = digits.reduce((sum, d) => sum + d.w, 0) + GAP * (digits.length - 1);
        const totalH = Math.max(...digits.map((d) => d.h));
        let ox = Math.round((max + 1 - totalW) / 2);
        const oy = Math.round((max + 1 - totalH) / 2);

        const out = [];
        for (const d of digits) {
            for (const p of d.cell) out.push({ x: ox + p.x - d.minX, y: oy + p.y - d.minY });
            ox += d.w + GAP;
        }
        return out;
    }

    /**
     * Standardize bounds based on shape category
     * @private
     */
    _standardizeBounds(shapeType, bounds) {
        const { x1, y1, x2, y2 } = bounds;
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        const width = Math.abs(deltaX);
        const height = Math.abs(deltaY);
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        return {
            x1, y1, x2, y2,
            deltaX, deltaY,
            width, height,
            left, right, top, bottom,
            centerX, centerY,
            radius,
            radiusX: width / 2,
            radiusY: height / 2
        };
    }

    // ===== LINE ALGORITHMS =====

    _bresenhamLine(x0, y0, x1, y1) {
        return ToolBase.getLinePoints(x0, y0, x1, y1);
    }

    // ===== BEZIER CURVES (Phase 8) =====
    //
    // Pure math: de Casteljau evaluation flattened to integer samples, then
    // Bresenham segments between consecutive samples (the same primitive
    // every other shape uses), deduplicated. The BezierTool owns the
    // interaction; these methods own the raster so it stays Node-testable.

    /**
     * Rasterize a quadratic bezier (one control handle).
     * @param {{x:number,y:number}} p0 - Start anchor
     * @param {{x:number,y:number}} c1 - Control handle
     * @param {{x:number,y:number}} p1 - End anchor
     * @param {Object} [options] - { thickness }
     * @returns {Array<{x:number,y:number}>}
     */
    generateQuadraticBezier(p0, c1, p1, options = {}) {
        return this._rasterizeBezier([p0, c1, p1], options);
    }

    /**
     * Rasterize a cubic bezier (two control handles).
     * @param {{x:number,y:number}} p0 - Start anchor
     * @param {{x:number,y:number}} c1 - First control handle
     * @param {{x:number,y:number}} c2 - Second control handle
     * @param {{x:number,y:number}} p1 - End anchor
     * @param {Object} [options] - { thickness }
     * @returns {Array<{x:number,y:number}>}
     */
    generateCubicBezier(p0, c1, c2, p1, options = {}) {
        return this._rasterizeBezier([p0, c1, c2, p1], options);
    }

    /**
     * Flatten a bezier of any order to deduplicated pixels.
     * Sample count derives from the control-net length (an upper bound on
     * the arc length), so degenerate curves (coincident points) cost almost
     * nothing and long curves stay smooth.
     * @param {Array<{x:number,y:number}>} ctrl - Control polygon
     * @param {Object} options - { thickness }
     * @returns {Array<{x:number,y:number}>}
     * @private
     */
    _rasterizeBezier(ctrl, options = {}) {
        const thickness = Helpers.clamp(Math.round(options.thickness || 1), 1, 16);

        let net = 0;
        for (let i = 1; i < ctrl.length; i++) {
            net += Math.hypot(ctrl[i].x - ctrl[i - 1].x, ctrl[i].y - ctrl[i - 1].y);
        }
        const steps = Helpers.clamp(Math.ceil(net * 2), 8, 512);

        // Flatten to integer samples (skip consecutive duplicates)
        const samples = [];
        for (let s = 0; s <= steps; s++) {
            const p = this._deCasteljau(ctrl, s / steps);
            const x = Math.round(p.x);
            const y = Math.round(p.y);
            const last = samples[samples.length - 1];
            if (!last || last.x !== x || last.y !== y) samples.push({ x, y });
        }

        // Connect samples with Bresenham segments, deduplicating pixels
        const seen = new Set();
        const points = [];
        const add = (x, y) => {
            const key = x * 4096 + y + 2048; // unique for the coordinate ranges in play
            if (!seen.has(key)) { seen.add(key); points.push({ x, y }); }
        };
        add(samples[0].x, samples[0].y);
        for (let i = 1; i < samples.length; i++) {
            ToolBase.forEachLinePoint(
                samples[i - 1].x, samples[i - 1].y, samples[i].x, samples[i].y, add);
        }

        return thickness > 1 ? this._thickenPoints(points, thickness) : points;
    }

    /** Evaluate a bezier at t via de Casteljau (any order). @private */
    _deCasteljau(ctrl, t) {
        let pts = ctrl;
        while (pts.length > 1) {
            const next = [];
            for (let i = 1; i < pts.length; i++) {
                next.push({
                    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
                });
            }
            pts = next;
        }
        return pts[0];
    }

    /**
     * The nib a thickness-N stroke stamps at a single point — the hover
     * footprint for the shape and bezier tools. Routed through _thickenPoints
     * so the outline is the same disc the raster dilates with, by construction
     * rather than by a second copy of the maths.
     * @param {number} x - Centre X
     * @param {number} y - Centre Y
     * @param {number} thickness - Stroke thickness
     * @returns {Array<{x: number, y: number}>}
     */
    nibFootprint(x, y, thickness) {
        const t = Helpers.clamp(Math.round(thickness || 1), 1, 16);
        if (t <= 1) return [{ x, y }];
        return this._thickenPoints([{ x, y }], t);
    }

    /** Stamp a disc of the given diameter over every point (deduplicated). @private */
    _thickenPoints(points, thickness) {
        const r = thickness / 2;
        const r2 = r * r + 0.01;
        const lo = Math.floor(-r);
        const hi = Math.ceil(r);
        const seen = new Set();
        const out = [];
        for (const p of points) {
            for (let dy = lo; dy <= hi; dy++) {
                for (let dx = lo; dx <= hi; dx++) {
                    if (dx * dx + dy * dy > r2) continue;
                    const x = p.x + dx;
                    const y = p.y + dy;
                    const key = x * 4096 + y + 2048;
                    if (!seen.has(key)) { seen.add(key); out.push({ x, y }); }
                }
            }
        }
        return out;
    }

    // ===== BASIC SHAPES =====

    _generateLine(bounds) {
        // Thickness is applied centrally in generateShape (outline path).
        return this._bresenhamLine(
            Math.round(bounds.x1), Math.round(bounds.y1),
            Math.round(bounds.x2), Math.round(bounds.y2)
        );
    }

    _generateRectangle(bounds) {
        const { left, right, top, bottom } = bounds;
        const points = [];

        for (let x = left; x <= right; x++) {
            points.push({ x, y: top });
            points.push({ x, y: bottom });
        }
        for (let y = top + 1; y < bottom; y++) {
            points.push({ x: left, y });
            points.push({ x: right, y });
        }

        return points;
    }

    _generateSquare(bounds) {
        const size = Math.max(bounds.width, bounds.height);
        const squareBounds = {
            ...bounds,
            right: bounds.left + size,
            bottom: bounds.top + size
        };
        return this._generateRectangle(squareBounds);
    }

    _generateRoundedRectangle(bounds, options = {}) {
        const { left, right, top, bottom } = bounds;
        const width = right - left;
        const height = bottom - top;

        if (width < 2 || height < 2) {
            return this._generateRectangle(bounds);
        }

        // A QUARTER of the smaller side, never more than half of it (which is a
        // stadium) and never less than one pixel. Measured against the previous
        // rule — 30% of HALF the side, floored at 2 — which pinned the radius at
        // 2 for every box below 20 px, and a 2 px circular corner only bites one
        // pixel: a 17 px rounded rectangle was a plain rectangle with the corner
        // pixels nicked off. The old floor could also exceed the cap on boxes
        // under 4 px, rounding a corner wider than the box's own half.
        const minSide = Math.min(width, height);
        const cornerRadius = clamp(Math.round(minSide * 0.25), 1, Math.floor(minSide / 2));

        const points = [];

        // Top edge (between corners)
        for (let x = left + cornerRadius; x <= right - cornerRadius; x++) {
            points.push({ x, y: top });
            points.push({ x, y: bottom });
        }

        // Side edges (between corners)
        for (let y = top + cornerRadius; y <= bottom - cornerRadius; y++) {
            points.push({ x: left, y });
            points.push({ x: right, y });
        }

        // The corners are QUADRANTS OF THE SAME MIDPOINT CIRCLE the circle tool
        // draws, filtered by which side of the corner centre they fall on. The
        // previous code sampled the arc at a few angles and joined the samples
        // with straight segments, which let a sample round back onto the row
        // above and put ink outside the corner it was cutting. Sharing the
        // rasteriser also means a rounded corner and a circle of the same radius
        // are the same pixels, by construction.
        const corners = [
            { cx: left + cornerRadius,  cy: top + cornerRadius,    sx: -1, sy: -1 },
            { cx: right - cornerRadius, cy: top + cornerRadius,    sx:  1, sy: -1 },
            { cx: right - cornerRadius, cy: bottom - cornerRadius, sx:  1, sy:  1 },
            { cx: left + cornerRadius,  cy: bottom - cornerRadius, sx: -1, sy:  1 }
        ];

        for (const corner of corners) {
            for (const p of this._midpointCircle(corner.cx, corner.cy, cornerRadius)) {
                const dx = p.x - corner.cx;
                const dy = p.y - corner.cy;
                if (dx * corner.sx >= 0 && dy * corner.sy >= 0) points.push(p);
            }
        }

        return points;
    }

    // ===== RADIAL SHAPES =====

    _generateCircle(bounds) {
        const cx = Math.round(bounds.centerX);
        const cy = Math.round(bounds.centerY);
        const r = Math.round(Math.max(bounds.radiusX, bounds.radiusY));

        return this._midpointCircle(cx, cy, r);
    }

    _midpointCircle(cx, cy, r) {
        const points = [];
        let x = 0;
        let y = r;
        let d = 1 - r;

        const plotSymmetric = (px, py) => {
            points.push({ x: cx + px, y: cy + py });
            points.push({ x: cx - px, y: cy + py });
            points.push({ x: cx + px, y: cy - py });
            points.push({ x: cx - px, y: cy - py });
            points.push({ x: cx + py, y: cy + px });
            points.push({ x: cx - py, y: cy + px });
            points.push({ x: cx + py, y: cy - px });
            points.push({ x: cx - py, y: cy - px });
        };

        plotSymmetric(x, y);

        while (x < y) {
            if (d < 0) {
                d += 2 * x + 3;
            } else {
                d += 2 * (x - y) + 5;
                y--;
            }
            x++;
            plotSymmetric(x, y);
        }

        return points;
    }

    _generateEllipse(bounds) {
        const cx = Math.round(bounds.centerX);
        const cy = Math.round(bounds.centerY);
        const rx = Math.round(bounds.radiusX);
        const ry = Math.round(bounds.radiusY);

        return this._midpointEllipse(cx, cy, rx, ry);
    }

    _midpointEllipse(cx, cy, rx, ry) {
        const points = [];
        if (rx === 0 || ry === 0) {
            if (rx === 0) {
                for (let y = cy - ry; y <= cy + ry; y++) {
                    points.push({ x: cx, y });
                }
            } else {
                for (let x = cx - rx; x <= cx + rx; x++) {
                    points.push({ x, y: cy });
                }
            }
            return points;
        }

        const plotSymmetric = (x, y) => {
            points.push({ x: cx + x, y: cy + y });
            points.push({ x: cx - x, y: cy + y });
            points.push({ x: cx + x, y: cy - y });
            points.push({ x: cx - x, y: cy - y });
        };

        const rxSq = rx * rx;
        const rySq = ry * ry;
        const twoRxSq = 2 * rxSq;
        const twoRySq = 2 * rySq;

        // Region 1
        let x = 0;
        let y = ry;
        let px = 0;
        let py = twoRxSq * y;
        let p = Math.round(rySq - (rxSq * ry) + (0.25 * rxSq));

        plotSymmetric(x, y);

        while (px < py) {
            x++;
            px += twoRySq;
            if (p < 0) {
                p += rySq + px;
            } else {
                y--;
                py -= twoRxSq;
                p += rySq + px - py;
            }
            plotSymmetric(x, y);
        }

        // Region 2
        p = Math.round(rySq * (x + 0.5) * (x + 0.5) + rxSq * (y - 1) * (y - 1) - rxSq * rySq);

        while (y > 0) {
            y--;
            py -= twoRxSq;
            if (p > 0) {
                p += rxSq - py;
            } else {
                x++;
                px += twoRySq;
                p += rxSq - py + px;
            }
            plotSymmetric(x, y);
        }

        return points;
    }

    _generateArc(bounds, options = {}) {
        const { x1, y1, x2, y2 } = bounds;
        const points = [];

        // Calculate drag angle and radius
        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));

        if (r <= 0) return points;

        const dragAngle = Math.atan2(dy, dx);

        // Arc center is at start point, arc passes through drag point
        const cx = Math.round(x1);
        const cy = Math.round(y1);

        // Arc spans 180 degrees (PI radians), with middle point at drag point
        const arcSpan = options.arcSpan || Math.PI;
        const startAngle = dragAngle - arcSpan / 2;
        const endAngle = dragAngle + arcSpan / 2;

        const steps = Math.max(20, Math.round(r * arcSpan));
        for (let i = 0; i <= steps; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / steps);
            const x = Math.round(cx + r * Math.cos(angle));
            const y = Math.round(cy + r * Math.sin(angle));
            points.push({ x, y });
        }

        return points;
    }

    _generateSector(bounds, options = {}) {
        const { x1, y1, x2, y2 } = bounds;
        const points = [];

        // Calculate drag angle and radius
        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));

        if (r <= 0) return points;

        const dragAngle = Math.atan2(dy, dx);

        // Sector center is at start point, arc passes through drag point
        const cx = Math.round(x1);
        const cy = Math.round(y1);

        // Sector spans 90 degrees (PI/2 radians), with middle point at drag point
        const arcSpan = options.arcSpan || (Math.PI / 2);
        const startAngle = dragAngle - arcSpan / 2;
        const endAngle = dragAngle + arcSpan / 2;

        // Generate arc portion
        const arcOptions = { ...options, arcSpan };
        const arcPoints = this._generateArc(bounds, arcOptions);
        points.push(...arcPoints);

        // Lines from center to arc endpoints
        if (arcPoints.length > 0) {
            points.push(...this._bresenhamLine(cx, cy, arcPoints[0].x, arcPoints[0].y));
            points.push(...this._bresenhamLine(cx, cy, arcPoints[arcPoints.length - 1].x, arcPoints[arcPoints.length - 1].y));
        }

        return points;
    }

    // ===== POLYGONS =====

    _generateTriangle(bounds) {
        const { x1, y1, x2, y2 } = bounds;

        // Apex is at the drag point (x2, y2)
        const apex = { x: Math.round(x2), y: Math.round(y2) };

        // Calculate drag angle and distance
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dragAngle = Math.atan2(dy, dx);
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r === 0) return [apex];

        // Base corners extend back from apex, perpendicular to drag direction
        // Base is at the start point, width is proportional to height (equilateral)
        const baseDistance = r;  // How far back the base is from apex
        const baseWidth = r * Math.tan(Math.PI / 6);  // For equilateral triangle

        const baseCenterX = x1;
        const baseCenterY = y1;
        const perpAngle = dragAngle + Math.PI / 2;

        const base1 = {
            x: Math.round(baseCenterX + baseWidth * Math.cos(perpAngle)),
            y: Math.round(baseCenterY + baseWidth * Math.sin(perpAngle))
        };
        const base2 = {
            x: Math.round(baseCenterX - baseWidth * Math.cos(perpAngle)),
            y: Math.round(baseCenterY - baseWidth * Math.sin(perpAngle))
        };

        const points = [];
        points.push(...this._bresenhamLine(apex.x, apex.y, base1.x, base1.y));
        points.push(...this._bresenhamLine(apex.x, apex.y, base2.x, base2.y));
        points.push(...this._bresenhamLine(base1.x, base1.y, base2.x, base2.y));

        return points;
    }

    _generateDiamond(bounds) {
        const { x1, y1, x2, y2 } = bounds;

        // Top vertex is at the drag point
        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.sqrt(dx * dx + dy * dy);
        const dragAngle = Math.atan2(dy, dx);

        if (r === 0) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const cx = Math.round(x1);
        const cy = Math.round(y1);

        // Diamond has 4 vertices: top at drag point, others at 90 degree intervals
        const top = { x: Math.round(x2), y: Math.round(y2) };
        const right = {
            x: Math.round(cx + r * Math.cos(dragAngle + Math.PI / 2)),
            y: Math.round(cy + r * Math.sin(dragAngle + Math.PI / 2))
        };
        const bottom = {
            x: Math.round(cx + r * Math.cos(dragAngle + Math.PI)),
            y: Math.round(cy + r * Math.sin(dragAngle + Math.PI))
        };
        const left = {
            x: Math.round(cx + r * Math.cos(dragAngle - Math.PI / 2)),
            y: Math.round(cy + r * Math.sin(dragAngle - Math.PI / 2))
        };

        const points = [];
        points.push(...this._bresenhamLine(top.x, top.y, right.x, right.y));
        points.push(...this._bresenhamLine(right.x, right.y, bottom.x, bottom.y));
        points.push(...this._bresenhamLine(bottom.x, bottom.y, left.x, left.y));
        points.push(...this._bresenhamLine(left.x, left.y, top.x, top.y));

        return points;
    }

    /**
     * Generate regular polygon with one vertex at drag point
     * @param {Object} bounds - Bounds with x1,y1 (center) and x2,y2 (vertex)
     * @param {number} sides - Number of sides
     * @returns {Array} Points array
     * @private
     */
    _generateRegularPolygonFromDrag(bounds, sides) {
        const { x1, y1, x2, y2 } = bounds;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.sqrt(dx * dx + dy * dy);
        const dragAngle = Math.atan2(dy, dx);

        if (r === 0) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const cx = Math.round(x1);
        const cy = Math.round(y1);

        const points = [];
        const vertices = [];

        // First vertex is at drag point, others follow at equal angles
        for (let i = 0; i < sides; i++) {
            const angle = dragAngle + (2 * Math.PI * i / sides);
            vertices.push({
                x: Math.round(cx + r * Math.cos(angle)),
                y: Math.round(cy + r * Math.sin(angle))
            });
        }

        for (let i = 0; i < sides; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % sides];
            points.push(...this._bresenhamLine(v1.x, v1.y, v2.x, v2.y));
        }

        return points;
    }

    _generatePentagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 5);
    }

    _generateHexagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 6);
    }

    _generateOctagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 8);
    }

    _generateHeptagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 7);
    }

    _generateNonagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 9);
    }

    _generateDecagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 10);
    }

    _generateDodecagon(bounds) {
        return this._generateRegularPolygonFromDrag(bounds, 12);
    }

    _generatePolygon(bounds, options = {}) {
        const { sides = 6 } = options;
        return this._generateRegularPolygonFromDrag(bounds, sides);
    }

    // ===== ARROWS =====

    _generateArrow(bounds) {
        const { x1, y1, x2, y2 } = bounds;
        const points = [];

        // Calculate arrow direction and length
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length < 2) return points;

        // Unit vector along arrow direction
        const ux = dx / length;
        const uy = dy / length;

        // Perpendicular unit vector
        const px = -uy;
        const py = ux;

        // Arrow proportions
        const headLength = Math.max(6, length * 0.35);
        const headWidth = Math.max(4, length * 0.25);
        const shaftWidth = Math.max(1, length * 0.1);

        // Calculate 7 vertices of the arrow polygon
        // Tip at (x2, y2)
        const tip = { x: Math.round(x2), y: Math.round(y2) };

        // Head base (where head meets shaft)
        const headBaseX = x2 - ux * headLength;
        const headBaseY = y2 - uy * headLength;

        // Head left and right corners (wide part of arrowhead)
        const headLeft = {
            x: Math.round(headBaseX + px * headWidth),
            y: Math.round(headBaseY + py * headWidth)
        };
        const headRight = {
            x: Math.round(headBaseX - px * headWidth),
            y: Math.round(headBaseY - py * headWidth)
        };

        // Shaft corners at head junction
        const shaftHeadLeft = {
            x: Math.round(headBaseX + px * shaftWidth),
            y: Math.round(headBaseY + py * shaftWidth)
        };
        const shaftHeadRight = {
            x: Math.round(headBaseX - px * shaftWidth),
            y: Math.round(headBaseY - py * shaftWidth)
        };

        // Shaft corners at tail
        const shaftTailLeft = {
            x: Math.round(x1 + px * shaftWidth),
            y: Math.round(y1 + py * shaftWidth)
        };
        const shaftTailRight = {
            x: Math.round(x1 - px * shaftWidth),
            y: Math.round(y1 - py * shaftWidth)
        };

        // Draw the closed polygon: tip -> headLeft -> shaftHeadLeft -> shaftTailLeft
        // -> shaftTailRight -> shaftHeadRight -> headRight -> tip
        const vertices = [
            tip, headLeft, shaftHeadLeft, shaftTailLeft,
            shaftTailRight, shaftHeadRight, headRight
        ];

        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            points.push(...this._bresenhamLine(v1.x, v1.y, v2.x, v2.y));
        }

        return points;
    }

    _generateDirectionalArrow(bounds, direction) {
        const { centerX, centerY, radius } = bounds;
        const size = Math.round(radius / Math.sqrt(2));
        const headSize = Math.max(4, size * 0.4);
        const shaftWidth = Math.max(2, size * 0.3);
        const points = [];

        let tip, base, left, right;

        switch (direction) {
            case 'up':
                tip = { x: Math.round(centerX), y: Math.round(centerY - size) };
                base = { x: Math.round(centerX), y: Math.round(centerY + size) };
                left = { x: Math.round(centerX - headSize), y: Math.round(centerY - size + headSize) };
                right = { x: Math.round(centerX + headSize), y: Math.round(centerY - size + headSize) };
                break;
            case 'down':
                tip = { x: Math.round(centerX), y: Math.round(centerY + size) };
                base = { x: Math.round(centerX), y: Math.round(centerY - size) };
                left = { x: Math.round(centerX - headSize), y: Math.round(centerY + size - headSize) };
                right = { x: Math.round(centerX + headSize), y: Math.round(centerY + size - headSize) };
                break;
            case 'left':
                tip = { x: Math.round(centerX - size), y: Math.round(centerY) };
                base = { x: Math.round(centerX + size), y: Math.round(centerY) };
                left = { x: Math.round(centerX - size + headSize), y: Math.round(centerY - headSize) };
                right = { x: Math.round(centerX - size + headSize), y: Math.round(centerY + headSize) };
                break;
            case 'right':
            default:
                tip = { x: Math.round(centerX + size), y: Math.round(centerY) };
                base = { x: Math.round(centerX - size), y: Math.round(centerY) };
                left = { x: Math.round(centerX + size - headSize), y: Math.round(centerY - headSize) };
                right = { x: Math.round(centerX + size - headSize), y: Math.round(centerY + headSize) };
                break;
        }

        // Shaft
        points.push(...this._bresenhamLine(base.x, base.y, tip.x, tip.y));
        // Arrowhead
        points.push(...this._bresenhamLine(tip.x, tip.y, left.x, left.y));
        points.push(...this._bresenhamLine(tip.x, tip.y, right.x, right.y));

        return points;
    }

    _generateArrowUp(bounds) { return this._generateDirectionalArrow(bounds, 'up'); }
    _generateArrowDown(bounds) { return this._generateDirectionalArrow(bounds, 'down'); }
    _generateArrowLeft(bounds) { return this._generateDirectionalArrow(bounds, 'left'); }
    _generateArrowRight(bounds) { return this._generateDirectionalArrow(bounds, 'right'); }

    // ===== SYMBOLS =====

    _generateCross(bounds) {
        const { centerX, centerY, radiusX, radiusY } = bounds;
        const cx = Math.round(centerX);
        const cy = Math.round(centerY);
        const rx = Math.round(radiusX);
        const ry = Math.round(radiusY);

        const points = [];
        points.push(...this._bresenhamLine(cx - rx, cy - ry, cx + rx, cy + ry));
        points.push(...this._bresenhamLine(cx + rx, cy - ry, cx - rx, cy + ry));

        return points;
    }

    _generatePlus(bounds) {
        const { centerX, centerY, radiusX, radiusY } = bounds;
        const cx = Math.round(centerX);
        const cy = Math.round(centerY);
        const rx = Math.round(radiusX);
        const ry = Math.round(radiusY);

        const points = [];
        points.push(...this._bresenhamLine(cx - rx, cy, cx + rx, cy));
        points.push(...this._bresenhamLine(cx, cy - ry, cx, cy + ry));

        return points;
    }

    _generateHeart(bounds) {
        const { centerX, centerY, radiusX, radiusY } = bounds;
        const scale = Math.min(radiusX, radiusY);

        if (scale <= 0) return [{ x: Math.round(centerX), y: Math.round(centerY) }];

        // Generate vertices along parametric heart curve
        const vertices = [];
        for (let t = 0; t <= 2 * Math.PI; t += 0.1) {
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

            vertices.push({
                x: Math.round(centerX + x * scale / 16),
                y: Math.round(centerY + y * scale / 16)
            });
        }

        // Connect vertices with lines
        const points = [];
        for (let i = 0; i < vertices.length - 1; i++) {
            points.push(...this._bresenhamLine(
                vertices[i].x, vertices[i].y,
                vertices[i + 1].x, vertices[i + 1].y
            ));
        }
        // Close the shape
        if (vertices.length > 1) {
            points.push(...this._bresenhamLine(
                vertices[vertices.length - 1].x, vertices[vertices.length - 1].y,
                vertices[0].x, vertices[0].y
            ));
        }

        return points;
    }

    _generateStar(bounds, options = {}) {
        const { points: numPoints = 5 } = options;
        const { centerX, centerY, radius } = bounds;
        const cx = Math.round(centerX);
        const cy = Math.round(centerY);
        const outerR = Math.round(radius / Math.sqrt(2));
        const innerR = Math.round(outerR * 0.4);

        const vertices = [];
        const totalPoints = numPoints * 2;

        for (let i = 0; i < totalPoints; i++) {
            const angle = -Math.PI / 2 + (2 * Math.PI * i / totalPoints);
            const r = i % 2 === 0 ? outerR : innerR;
            vertices.push({
                x: Math.round(cx + r * Math.cos(angle)),
                y: Math.round(cy + r * Math.sin(angle))
            });
        }

        const linePoints = [];
        for (let i = 0; i < totalPoints; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % totalPoints];
            linePoints.push(...this._bresenhamLine(v1.x, v1.y, v2.x, v2.y));
        }

        return linePoints;
    }

    // ===== COMPLEX SHAPES =====

    _generateHouse(bounds) {
        const { x1, y1, x2, y2 } = bounds;

        // Calculate drag direction
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dragAngle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return [{ x: Math.round(x1), y: Math.round(y1) }];

        // Roof peak is at the drag point
        const roofPeak = { x: Math.round(x2), y: Math.round(y2) };

        // House dimensions relative to drag distance
        const houseHeight = distance;
        const houseWidth = distance * 0.8;
        const roofHeight = houseHeight * 0.4;

        // Calculate perpendicular direction for house width
        const perpAngle = dragAngle + Math.PI / 2;

        // Roof eaves (where roof meets walls) - 40% of the way from peak toward base
        const roofBaseX = x2 - (roofHeight * Math.cos(dragAngle));
        const roofBaseY = y2 - (roofHeight * Math.sin(dragAngle));

        const roofLeft = {
            x: Math.round(roofBaseX + (houseWidth / 2) * Math.cos(perpAngle)),
            y: Math.round(roofBaseY + (houseWidth / 2) * Math.sin(perpAngle))
        };
        const roofRight = {
            x: Math.round(roofBaseX - (houseWidth / 2) * Math.cos(perpAngle)),
            y: Math.round(roofBaseY - (houseWidth / 2) * Math.sin(perpAngle))
        };

        // Base corners (at the start point level, extending perpendicular)
        const baseLeft = {
            x: Math.round(x1 + (houseWidth / 2) * Math.cos(perpAngle)),
            y: Math.round(y1 + (houseWidth / 2) * Math.sin(perpAngle))
        };
        const baseRight = {
            x: Math.round(x1 - (houseWidth / 2) * Math.cos(perpAngle)),
            y: Math.round(y1 - (houseWidth / 2) * Math.sin(perpAngle))
        };

        const points = [];

        // Roof
        points.push(...this._bresenhamLine(roofPeak.x, roofPeak.y, roofLeft.x, roofLeft.y));
        points.push(...this._bresenhamLine(roofPeak.x, roofPeak.y, roofRight.x, roofRight.y));

        // Walls
        points.push(...this._bresenhamLine(roofLeft.x, roofLeft.y, baseLeft.x, baseLeft.y));
        points.push(...this._bresenhamLine(roofRight.x, roofRight.y, baseRight.x, baseRight.y));

        // Base
        points.push(...this._bresenhamLine(baseLeft.x, baseLeft.y, baseRight.x, baseRight.y));

        return points;
    }

    _generateMoon(bounds, options = {}) {
        const { phase = 0.3 } = options;
        const { x1, y1, x2, y2 } = bounds;

        // Calculate drag direction and radius
        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r <= 1) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const dragAngle = Math.atan2(dy, dx);

        // Outer circle center
        const cx1 = x1;
        const cy1 = y1;
        const r1 = r;

        // Inner circle (cutout) - offset in drag direction
        const r2 = r * 0.8;
        const cx2 = cx1 + r * phase * Math.cos(dragAngle);
        const cy2 = cy1 + r * phase * Math.sin(dragAngle);

        const points = [];

        // Generate crescent by tracing arcs:
        // - Outer circle arc: points NOT inside inner circle
        // - Inner circle arc: points inside outer circle

        const steps = Math.max(60, Math.round(r * 4));

        // Helper: check if point is inside a circle
        const isInsideCircle = (px, py, ccx, ccy, cr) => {
            const ddx = px - ccx;
            const ddy = py - ccy;
            return (ddx * ddx + ddy * ddy) < (cr * cr);
        };

        // Trace outer circle, only keeping points outside inner circle
        let prevOutside = null;
        for (let i = 0; i <= steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            const px = cx1 + r1 * Math.cos(angle);
            const py = cy1 + r1 * Math.sin(angle);

            const outside = !isInsideCircle(px, py, cx2, cy2, r2);

            if (outside) {
                const rx = Math.round(px);
                const ry = Math.round(py);
                if (prevOutside !== null) {
                    points.push(...this._bresenhamLine(prevOutside.x, prevOutside.y, rx, ry));
                }
                prevOutside = { x: rx, y: ry };
            } else {
                prevOutside = null;
            }
        }

        // Trace inner circle, only keeping points inside outer circle
        let prevInside = null;
        for (let i = 0; i <= steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            const px = cx2 + r2 * Math.cos(angle);
            const py = cy2 + r2 * Math.sin(angle);

            const inside = isInsideCircle(px, py, cx1, cy1, r1);

            if (inside) {
                const rx = Math.round(px);
                const ry = Math.round(py);
                if (prevInside !== null) {
                    points.push(...this._bresenhamLine(prevInside.x, prevInside.y, rx, ry));
                }
                prevInside = { x: rx, y: ry };
            } else {
                prevInside = null;
            }
        }

        return points;
    }

    _generateRing(bounds, options = {}) {
        const { innerRatio = 0.5 } = options;
        const { x1, y1, x2, y2 } = bounds;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const outerR = Math.sqrt(dx * dx + dy * dy);

        if (outerR <= 1) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const cx = x1;
        const cy = y1;
        const innerR = outerR * innerRatio;

        const points = [];
        const steps = Math.max(60, Math.round(outerR * 4));

        const isInsideCircle = (px, py, ccx, ccy, cr) => {
            const ddx = px - ccx;
            const ddy = py - ccy;
            return (ddx * ddx + ddy * ddy) < (cr * cr);
        };

        // Trace outer circle, keep points outside inner circle
        let prevOutside = null;
        for (let i = 0; i <= steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            const px = cx + outerR * Math.cos(angle);
            const py = cy + outerR * Math.sin(angle);

            if (!isInsideCircle(px, py, cx, cy, innerR)) {
                const rx = Math.round(px);
                const ry = Math.round(py);
                if (prevOutside !== null) {
                    points.push(...this._bresenhamLine(prevOutside.x, prevOutside.y, rx, ry));
                }
                prevOutside = { x: rx, y: ry };
            } else {
                prevOutside = null;
            }
        }
        // Close the outer circle
        if (prevOutside !== null && points.length > 0) {
            const first = points[0];
            points.push(...this._bresenhamLine(prevOutside.x, prevOutside.y, first.x, first.y));
        }

        // Trace inner circle (all points are inside outer, so draw all)
        let prevInner = null;
        for (let i = 0; i <= steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            const px = cx + innerR * Math.cos(angle);
            const py = cy + innerR * Math.sin(angle);
            const rx = Math.round(px);
            const ry = Math.round(py);

            if (prevInner !== null) {
                points.push(...this._bresenhamLine(prevInner.x, prevInner.y, rx, ry));
            }
            prevInner = { x: rx, y: ry };
        }

        return points;
    }

    _generateFlower(bounds, options = {}) {
        const { petals = 6 } = options;
        const { centerX, centerY, radius } = bounds;
        const cx = centerX;
        const cy = centerY;
        const outerR = radius / Math.sqrt(2);
        const petalR = outerR * 0.4;

        // Build list of petal circles
        const circles = [];

        for (let i = 0; i < petals; i++) {
            const angle = (2 * Math.PI * i) / petals;
            const pcx = cx + (outerR - petalR) * Math.cos(angle);
            const pcy = cy + (outerR - petalR) * Math.sin(angle);
            circles.push({ cx: pcx, cy: pcy, r: petalR, rSq: petalR * petalR });
        }

        const points = [];
        const steps = Math.max(40, Math.round(outerR * 3));

        // Helper: check if point is inside any circle except the one at index
        const isInsideOther = (px, py, exceptIdx) => {
            for (let i = 0; i < circles.length; i++) {
                if (i === exceptIdx) continue;
                const c = circles[i];
                const ddx = px - c.cx;
                const ddy = py - c.cy;
                if (ddx * ddx + ddy * ddy < c.rSq) return true;
            }
            return false;
        };

        // Trace each circle, only keeping points not inside other circles
        for (let ci = 0; ci < circles.length; ci++) {
            const c = circles[ci];
            let prev = null;

            for (let i = 0; i <= steps; i++) {
                const angle = (2 * Math.PI * i) / steps;
                const px = c.cx + c.r * Math.cos(angle);
                const py = c.cy + c.r * Math.sin(angle);

                if (!isInsideOther(px, py, ci)) {
                    const rx = Math.round(px);
                    const ry = Math.round(py);
                    if (prev !== null) {
                        points.push(...this._bresenhamLine(prev.x, prev.y, rx, ry));
                    }
                    prev = { x: rx, y: ry };
                } else {
                    prev = null;
                }
            }
        }

        return points;
    }

    /**
     * The gear's geometry, in one place.
     *
     * Outline and fill used to derive this separately and disagree: the outline
     * built teeth x 4 vertices (outer, outer, inner, inner - square teeth, a
     * cog) while _getShapeVertices built teeth x 2 alternating ones (outer,
     * inner - pointed teeth, an eight-pointed star), so filling a gear changed
     * its shape. Both now read this.
     *
     * @param {Object} bounds - Standardized bounds
     * @param {number} teeth
     * @returns {{cx: number, cy: number, outerR: number, innerR: number,
     *            holeR: number, vertices: Array<{x: number, y: number}>}}
     * @private
     */
    _gearGeometry(bounds, teeth) {
        const { centerX, centerY, radius } = bounds;
        const cx = Math.round(centerX);
        const cy = Math.round(centerY);
        const outerR = Math.round(radius / Math.sqrt(2));
        const innerR = Math.round(outerR * 0.7);
        const holeR = Math.round(outerR * 0.2);

        const vertices = [];
        const totalPoints = Math.max(1, Math.round(teeth)) * 4;
        for (let i = 0; i < totalPoints; i++) {
            const angle = (2 * Math.PI * i) / totalPoints;
            const r = (i % 4 < 2) ? outerR : innerR;
            vertices.push({
                x: Math.round(cx + r * Math.cos(angle)),
                y: Math.round(cy + r * Math.sin(angle))
            });
        }

        return { cx, cy, outerR, innerR, holeR, vertices };
    }

    _generateGear(bounds, options = {}) {
        const { teeth = 8 } = options;
        const { cx, cy, holeR, vertices } = this._gearGeometry(bounds, teeth);

        const points = [];
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            points.push(...this._bresenhamLine(v1.x, v1.y, v2.x, v2.y));
        }

        // Center hole
        points.push(...this._midpointCircle(cx, cy, holeR));

        return points;
    }

    _generateSpiral(bounds, options = {}) {
        const { turns = 3 } = options;
        const { x1, y1, x2, y2 } = bounds;

        // Spiral starts at click point and ends at drag point
        const cx = Math.round(x1);
        const cy = Math.round(y1);

        const dx = x2 - x1;
        const dy = y2 - y1;
        const maxR = Math.sqrt(dx * dx + dy * dy);
        const dragAngle = Math.atan2(dy, dx);

        if (maxR <= 0) return [{ x: cx, y: cy }];

        const points = [];
        const steps = turns * 60;

        let prevX = cx;
        let prevY = cy;

        for (let i = 1; i <= steps; i++) {
            // Spiral outward, ending exactly at drag point
            const progress = i / steps;
            const angle = dragAngle - (2 * Math.PI * turns * (1 - progress));
            const r = maxR * progress;
            const x = Math.round(cx + r * Math.cos(angle));
            const y = Math.round(cy + r * Math.sin(angle));

            points.push(...this._bresenhamLine(prevX, prevY, x, y));
            prevX = x;
            prevY = y;
        }

        return points;
    }

    _generateBowtie(bounds) {
        const { left, right, top, bottom, centerX, centerY } = bounds;
        const points = [];

        // Two triangles meeting at center
        points.push(...this._bresenhamLine(left, top, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(left, bottom, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(left, top, left, bottom));

        points.push(...this._bresenhamLine(right, top, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(right, bottom, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(right, top, right, bottom));

        return points;
    }

    _generateHourglass(bounds) {
        const { left, right, top, bottom, centerX, centerY } = bounds;
        const points = [];

        // Two triangles stacked
        points.push(...this._bresenhamLine(left, top, right, top));
        points.push(...this._bresenhamLine(left, top, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(right, top, Math.round(centerX), Math.round(centerY)));

        points.push(...this._bresenhamLine(left, bottom, right, bottom));
        points.push(...this._bresenhamLine(left, bottom, Math.round(centerX), Math.round(centerY)));
        points.push(...this._bresenhamLine(right, bottom, Math.round(centerX), Math.round(centerY)));

        return points;
    }

    // ===== QUADRILATERALS =====

    _generateTrapezoid(bounds) {
        const { left, right, top, bottom, centerX } = bounds;
        const width = right - left;
        const inset = Math.round(width * 0.2);

        const points = [];
        points.push(...this._bresenhamLine(left + inset, top, right - inset, top));
        points.push(...this._bresenhamLine(left, bottom, right, bottom));
        points.push(...this._bresenhamLine(left, bottom, left + inset, top));
        points.push(...this._bresenhamLine(right, bottom, right - inset, top));

        return points;
    }

    _generateParallelogram(bounds) {
        const { left, right, top, bottom, deltaX, deltaY } = bounds;
        const width = right - left;
        const skew = Math.round(width * 0.25);

        // The lean follows the drag diagonal, not just the drag's bounding
        // box: left/right/top/bottom alone can't tell a top-left-to-bottom-
        // right drag from its mirror image, since both produce the same box.
        // It also has to keep the point the artist actually pressed down on
        // (and the point they dragged to) as REAL corners of the shape - a
        // parallelogram's parallel-sides constraint only leaves two exact
        // corners, always on one diagonal, with the other diagonal inset by
        // the skew - so that diagonal must be the one the artist dragged
        // along, or the shape appears to start from a corner they never
        // touched. A "\" diagonal (deltaX and deltaY sharing a sign - top-
        // left to bottom-right, or that same drag reversed) keeps top-left
        // and bottom-right exact; a "/" diagonal mirrors it, keeping top-
        // right and bottom-left exact instead. A drag square to one axis
        // (deltaX or deltaY zero) has no diagonal to read, so it falls back
        // to the "\" pairing.
        const mirrored = (deltaX < 0) === (deltaY < 0);

        const topLeft = mirrored ? left : left + skew;
        const topRight = mirrored ? right - skew : right;
        const bottomLeft = mirrored ? left + skew : left;
        const bottomRight = mirrored ? right : right - skew;

        const points = [];
        points.push(...this._bresenhamLine(topLeft, top, topRight, top));
        points.push(...this._bresenhamLine(bottomLeft, bottom, bottomRight, bottom));
        points.push(...this._bresenhamLine(topLeft, top, bottomLeft, bottom));
        points.push(...this._bresenhamLine(topRight, top, bottomRight, bottom));

        return points;
    }

    _generateKite(bounds) {
        const { x1, y1, x2, y2 } = bounds;

        // Nose is at the drag point (x2, y2)
        const nose = { x: Math.round(x2), y: Math.round(y2) };

        // Calculate drag angle and distance
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dragAngle = Math.atan2(dy, dx);
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r === 0) return [nose];

        // Kite proportions relative to drag distance
        const totalLength = r * 1.6;  // Total length from nose to tail
        const wingOffset = r * 0.3;   // How far back from nose the wings are
        const wingWidth = r * 0.5;    // Half-width of wings

        // Tail extends back past the start point
        const tail = {
            x: Math.round(x2 - totalLength * Math.cos(dragAngle)),
            y: Math.round(y2 - totalLength * Math.sin(dragAngle))
        };

        // Wings are perpendicular, positioned between nose and start point
        const perpAngle = dragAngle + Math.PI / 2;
        const wingCenterX = x2 - wingOffset * Math.cos(dragAngle);
        const wingCenterY = y2 - wingOffset * Math.sin(dragAngle);

        const wing1 = {
            x: Math.round(wingCenterX + wingWidth * Math.cos(perpAngle)),
            y: Math.round(wingCenterY + wingWidth * Math.sin(perpAngle))
        };
        const wing2 = {
            x: Math.round(wingCenterX - wingWidth * Math.cos(perpAngle)),
            y: Math.round(wingCenterY - wingWidth * Math.sin(perpAngle))
        };

        const points = [];
        points.push(...this._bresenhamLine(nose.x, nose.y, wing1.x, wing1.y));
        points.push(...this._bresenhamLine(nose.x, nose.y, wing2.x, wing2.y));
        points.push(...this._bresenhamLine(wing1.x, wing1.y, tail.x, tail.y));
        points.push(...this._bresenhamLine(wing2.x, wing2.y, tail.x, tail.y));

        return points;
    }

    // ===== FILL ALGORITHMS =====

    _generateFilledShape(shapeType, bounds, options) {
        // Use unified outline-based scanline fill for all shapes
        const generator = this.shapes.get(shapeType);
        if (!generator) return [];

        // Moon needs special handling for crescent fill
        if (shapeType === 'moon') {
            return this._fillMoon(bounds, options);
        }

        // Flower needs special handling for merged circles fill
        if (shapeType === 'flower') {
            return this._fillFlower(bounds, options);
        }

        // Ring needs special handling for annulus fill
        if (shapeType === 'ring') {
            return this._fillRing(bounds, options);
        }

        // A gear has a bore, and a scanline fill of its tooth ring has no way
        // to leave one: fill the cog, then punch the hole.
        if (shapeType === 'gear') {
            return this._fillGear(bounds, options);
        }

        // For shapes with clean polygon vertices, use polygon scanline fill
        const vertices = this._getShapeVertices(shapeType, bounds, options);
        if (vertices.length >= 3) {
            return this._fillPolygonScanline(shapeType, bounds, options);
        }

        // For all other shapes (including circle, ellipse, rectangle), use outline-based fill
        return this._fillFromOutline(generator, bounds, options);
    }

    /**
     * The crescent: every pixel inside the outer disc and outside the cutout.
     *
     * Tested pixel by pixel rather than by SPANS. The span version computed
     * `ceil(cx - dx) .. floor(cx + dx)` per row, which does two harmful things
     * near the horns, where the crescent is thinner than a pixel: a row whose
     * span is under a pixel wide comes out EMPTY (a gap across the crescent),
     * and the narrow cutout slot near a horn leaves a one-pixel speck stranded
     * on the far side of it. Measured at drag 8, 17 and 41 the result was two
     * or three disconnected pieces rather than a crescent.
     *
     * A tapering horn still ends where its pixels run out, but it ends
     * CONNECTED, which is the property that makes it a crescent.
     */
    _fillMoon(bounds, options = {}) {
        const { phase = 0.3 } = options;
        const { x1, y1, x2, y2 } = bounds;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r <= 1) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const dragAngle = Math.atan2(dy, dx);

        // Outer circle
        const cx1 = x1;
        const cy1 = y1;
        const r1Sq = r * r;

        // Inner circle (cutout)
        const r2 = r * 0.8;
        const cx2 = cx1 + r * phase * Math.cos(dragAngle);
        const cy2 = cy1 + r * phase * Math.sin(dragAngle);
        const r2Sq = r2 * r2;

        const points = [];
        const minY = Math.floor(cy1 - r);
        const maxY = Math.ceil(cy1 + r);
        const minX = Math.floor(cx1 - r);
        const maxX = Math.ceil(cx1 + r);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const ox = x - cx1, oy = y - cy1;
                if (ox * ox + oy * oy > r1Sq) continue;
                const ix = x - cx2, iy = y - cy2;
                if (ix * ix + iy * iy < r2Sq) continue;
                points.push({ x, y });
            }
        }

        // A disc minus a disc is ONE region, so anything the sampling has left
        // stranded is an artefact of the sampling: where a horn tapers below a
        // pixel, a lone centre can fall inside the sliver while its neighbours
        // do not, and the horn ends in a detached speck a pixel or two past the
        // crescent. Keeping the body drops those and nothing else.
        return this._largestComponent(points);
    }

    /**
     * The biggest 8-connected group of pixels in a set.
     * @param {Array<{x: number, y: number}>} points
     * @returns {Array<{x: number, y: number}>}
     * @private
     */
    _largestComponent(points) {
        if (points.length < 2) return points;

        const index = new Map();
        for (const p of points) index.set(p.x + ',' + p.y, p);

        const seen = new Set();
        let best = points;
        let bestSize = 0;

        for (const key of index.keys()) {
            if (seen.has(key)) continue;
            const group = [];
            const stack = [key];
            seen.add(key);
            while (stack.length) {
                const k = stack.pop();
                const p = index.get(k);
                group.push(p);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const nk = (p.x + dx) + ',' + (p.y + dy);
                        if (index.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
                    }
                }
            }
            if (group.length > bestSize) { bestSize = group.length; best = group; }
        }
        return best;
    }

    /**
     * Filled gear: the cog polygon, minus the bore.
     * @private
     */
    _fillGear(bounds, options = {}) {
        const { teeth = 8 } = options;
        const { cx, cy, holeR } = this._gearGeometry(bounds, teeth);
        const holeSq = holeR * holeR;

        const filled = this._fillPolygonScanline('gear', bounds, options);
        if (holeR <= 0) return filled;

        const points = [];
        for (const p of filled) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            if (dx * dx + dy * dy < holeSq) continue;
            points.push(p);
        }
        return points;
    }

    _fillFlower(bounds, options = {}) {
        const { petals = 6 } = options;
        const { centerX, centerY, radius } = bounds;
        const cx = centerX;
        const cy = centerY;
        const outerR = radius / Math.sqrt(2);
        const petalR = outerR * 0.4;

        // Build list of petal circles
        const circles = [];

        for (let i = 0; i < petals; i++) {
            const angle = (2 * Math.PI * i) / petals;
            const pcx = cx + (outerR - petalR) * Math.cos(angle);
            const pcy = cy + (outerR - petalR) * Math.sin(angle);
            circles.push({ cx: pcx, cy: pcy, r: petalR, rSq: petalR * petalR });
        }

        // Find bounding box of all circles
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const c of circles) {
            minX = Math.min(minX, c.cx - c.r);
            maxX = Math.max(maxX, c.cx + c.r);
            minY = Math.min(minY, c.cy - c.r);
            maxY = Math.max(maxY, c.cy + c.r);
        }

        minX = Math.floor(minX);
        maxX = Math.ceil(maxX);
        minY = Math.floor(minY);
        maxY = Math.ceil(maxY);

        const points = [];

        // Fill any pixel that is inside any circle
        for (let y = minY; y <= maxY; y++) {
            if (y < 0 || y >= ZX_SPECTRUM.HEIGHT) continue;

            for (let x = minX; x <= maxX; x++) {
                if (x < 0 || x >= ZX_SPECTRUM.WIDTH) continue;

                // Check if inside any circle
                for (const c of circles) {
                    const ddx = x - c.cx;
                    const ddy = y - c.cy;
                    if (ddx * ddx + ddy * ddy <= c.rSq) {
                        points.push({ x, y });
                        break;
                    }
                }
            }
        }

        return points;
    }

    _fillRing(bounds, options = {}) {
        const { innerRatio = 0.5 } = options;
        const { x1, y1, x2, y2 } = bounds;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const outerR = Math.sqrt(dx * dx + dy * dy);

        if (outerR <= 1) return [{ x: Math.round(x1), y: Math.round(y1) }];

        const cx = x1;
        const cy = y1;
        const innerR = outerR * innerRatio;
        const outerRSq = outerR * outerR;
        const innerRSq = innerR * innerR;

        const points = [];

        const minY = Math.floor(cy - outerR);
        const maxY = Math.ceil(cy + outerR);

        for (let y = minY; y <= maxY; y++) {
            if (y < 0 || y >= ZX_SPECTRUM.HEIGHT) continue;

            const dyy = y - cy;
            const dyySq = dyy * dyy;
            if (dyySq > outerRSq) continue;

            const dxOuter = Math.sqrt(outerRSq - dyySq);
            const outerXMin = Math.ceil(cx - dxOuter);
            const outerXMax = Math.floor(cx + dxOuter);

            let innerXMin = Infinity;
            let innerXMax = -Infinity;

            if (dyySq < innerRSq) {
                const dxInner = Math.sqrt(innerRSq - dyySq);
                innerXMin = Math.ceil(cx - dxInner);
                innerXMax = Math.floor(cx + dxInner);
            }

            for (let x = outerXMin; x <= outerXMax; x++) {
                if (x < 0 || x >= ZX_SPECTRUM.WIDTH) continue;
                if (x >= innerXMin && x <= innerXMax) continue;
                points.push({ x, y });
            }
        }

        return points;
    }

    _fillPolygonScanline(shapeType, bounds, options) {
        const generator = this.shapes.get(shapeType);
        if (!generator) return [];

        // Get vertices from the shape generator
        const vertices = this._getShapeVertices(shapeType, bounds, options);
        if (vertices.length < 3) {
            // Fallback to outline-based fill for shapes without clean vertices
            return this._fillFromOutline(generator, bounds, options);
        }

        const n = vertices.length;

        // Find Y bounds (vertices already rounded in _getShapeVertices)
        // Allow shapes to extend beyond canvas - we'll clip pixels when adding to buffer
        let minY = vertices[0].y, maxY = vertices[0].y;
        for (let i = 1; i < n; i++) {
            if (vertices[i].y < minY) minY = vertices[i].y;
            if (vertices[i].y > maxY) maxY = vertices[i].y;
        }

        // Use pre-allocated typed arrays for edges
        let edgeCount = 0;
        for (let i = 0; i < n; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % n];
            if (v1.y === v2.y) continue; // Skip horizontal

            const top = v1.y < v2.y ? v1 : v2;
            const bot = v1.y < v2.y ? v2 : v1;
            const deltaX = bot.x - top.x;

            this._edgeYMin[edgeCount] = top.y;
            this._edgeYMax[edgeCount] = bot.y;
            this._edgeX[edgeCount] = top.x;
            this._edgeDeltaX[edgeCount] = Math.abs(deltaX);
            this._edgeDeltaY[edgeCount] = bot.y - top.y;
            this._edgeXStep[edgeCount] = deltaX > 0 ? 1 : -1;
            edgeCount++;
        }

        if (edgeCount === 0) return [];

        // Build sort order using pre-allocated array
        for (let i = 0; i < edgeCount; i++) this._edgeOrder[i] = i;
        // Simple insertion sort for small arrays (faster than Array.sort for n < 50)
        for (let i = 1; i < edgeCount; i++) {
            const key = this._edgeOrder[i];
            const keyY = this._edgeYMin[key];
            let j = i - 1;
            while (j >= 0 && this._edgeYMin[this._edgeOrder[j]] > keyY) {
                this._edgeOrder[j + 1] = this._edgeOrder[j];
                j--;
            }
            this._edgeOrder[j + 1] = key;
        }

        // Reset fill buffer
        this._fillBufferLength = 0;

        let activeCount = 0;
        let orderIdx = 0;

        for (let y = minY; y <= maxY; y++) {
            // Activate edges starting at this y
            while (orderIdx < edgeCount && this._edgeYMin[this._edgeOrder[orderIdx]] === y) {
                const ei = this._edgeOrder[orderIdx];
                this._activeIdx[activeCount] = ei;
                this._activeX[activeCount] = this._edgeX[ei];
                this._activeError[activeCount] = 0;
                activeCount++;
                orderIdx++;
            }

            // Collect intersections and step active edges
            let intCount = 0;
            let writeIdx = 0;
            for (let i = 0; i < activeCount; i++) {
                const ei = this._activeIdx[i];
                if (y >= this._edgeYMax[ei]) continue; // Edge ended

                this._intersections[intCount++] = this._activeX[i];

                // Bresenham step
                let err = this._activeError[i] + this._edgeDeltaX[ei];
                let x = this._activeX[i];
                const dy = this._edgeDeltaY[ei];
                const step = this._edgeXStep[ei];
                while (err >= dy) {
                    x += step;
                    err -= dy;
                }

                this._activeIdx[writeIdx] = ei;
                this._activeX[writeIdx] = x;
                this._activeError[writeIdx] = err;
                writeIdx++;
            }
            activeCount = writeIdx;

            if (intCount < 2) continue;

            // Sort intersections (insertion sort for small arrays)
            for (let i = 1; i < intCount; i++) {
                const key = this._intersections[i];
                let j = i - 1;
                while (j >= 0 && this._intersections[j] > key) {
                    this._intersections[j + 1] = this._intersections[j];
                    j--;
                }
                this._intersections[j + 1] = key;
            }

            // Fill between pairs - only add pixels within canvas bounds
            for (let i = 0; i < intCount - 1; i += 2) {
                const xStart = this._intersections[i];
                const xEnd = this._intersections[i + 1];
                for (let x = xStart; x <= xEnd; x++) {
                    // Clip to canvas bounds when adding to buffer. Geometry
                    // from the ACTIVE mode: these were literal 255/191, which
                    // clipped every filled shape to the standard screen even in
                    // a 512x192 Timex or a 320x256 Layer 2 document.
                    if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) {
                        if (this._fillBufferLength >= this._fillBufferX.length) this._growFillBuffer();
                        this._fillBufferX[this._fillBufferLength] = x;
                        this._fillBufferY[this._fillBufferLength] = y;
                        this._fillBufferLength++;
                    }
                }
            }
        }

        // Convert buffer to point array (required by existing API)
        const fillPoints = new Array(this._fillBufferLength);
        for (let i = 0; i < this._fillBufferLength; i++) {
            fillPoints[i] = { x: this._fillBufferX[i], y: this._fillBufferY[i] };
        }
        return fillPoints;
    }

    _getShapeVertices(shapeType, bounds, options) {
        const { centerX, centerY, radiusX, radiusY, radius, x1, y1, x2, y2,
                left, right, top, bottom } = bounds;
        const scale = Math.min(radiusX || radius, radiusY || radius) || Math.abs(x2 - x1) / 2;

        switch (shapeType) {
            case 'heart': {
                const vertices = [];
                // Use 0.15 step for ~42 vertices - good balance of quality and performance
                for (let t = 0; t <= 2 * Math.PI; t += 0.15) {
                    const x = 16 * Math.pow(Math.sin(t), 3);
                    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                    vertices.push({
                        x: Math.round(centerX + x * scale / 16),
                        y: Math.round(centerY + y * scale / 16)
                    });
                }
                return vertices;
            }
            case 'star': {
                const numPoints = options.points || 5;
                const cx = Math.round(centerX);
                const cy = Math.round(centerY);
                const outerR = (radius || scale) / Math.sqrt(2);
                const innerR = outerR * 0.4;
                const vertices = [];
                const totalPoints = numPoints * 2;
                for (let i = 0; i < totalPoints; i++) {
                    const angle = -Math.PI / 2 + (2 * Math.PI * i / totalPoints);
                    const r = i % 2 === 0 ? outerR : innerR;
                    vertices.push({
                        x: Math.round(cx + r * Math.cos(angle)),
                        y: Math.round(cy + r * Math.sin(angle))
                    });
                }
                return vertices;
            }
            case 'gear':
                // The vertices the OUTLINE is drawn from, so a filled gear and
                // an outlined one are the same cog. See _gearGeometry.
                return this._gearGeometry(bounds, options.teeth || 8).vertices;
            case 'bowtie': {
                // Two triangles meeting at the centre, as one ring: the generic
                // row-span fill cannot see the waist (both vertical end edges
                // are present on every row, so it fills the whole box), which
                // made a filled bowtie a solid rectangle.
                const cx = Math.round(centerX);
                const cy = Math.round(centerY);
                return [
                    { x: left,  y: top },    { x: cx, y: cy },
                    { x: right, y: top },    { x: right, y: bottom },
                    { x: cx,    y: cy },     { x: left,  y: bottom }
                ];
            }
            default:
                return [];
        }
    }

    _fillFromOutline(generator, bounds, options) {
        const outlinePoints = generator(bounds, options);
        if (outlinePoints.length === 0) return [];

        const scanlines = new Map();
        outlinePoints.forEach(point => {
            const y = point.y;
            if (!scanlines.has(y)) {
                scanlines.set(y, new Set());
            }
            scanlines.get(y).add(point.x);
        });

        const fillPoints = [];
        for (const [y, xSet] of scanlines) {
            if (xSet.size === 0) continue;
            const xValues = Array.from(xSet).sort((a, b) => a - b);
            const minX = xValues[0];
            const maxX = xValues[xValues.length - 1];
            for (let x = minX; x <= maxX; x++) {
                if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) {
                    fillPoints.push({ x, y });
                }
            }
        }
        return fillPoints;
    }
}

// Create singleton instance
const ShapeGenerator = new ShapeGeneratorClass();

// Expose to global scope
window.ShapeGenerator = ShapeGenerator;

Logger.debug('ShapeGenerator', 'Shape generator loaded with 30+ shapes');

})(); // End IIFE
