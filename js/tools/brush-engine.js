'use strict';
(function() {

/**
 * Canvas bounds check — geometry from the active screen mode, never literals.
 * @param {number} x @param {number} y @returns {boolean}
 */
function _inBounds(x, y) {
    return x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT;
}

// ── Geometry ────────────────────────────────────────────────────────────────
//
// All of it lives in BrushShapes (js/utils/brush-shapes.js) — the disc rule,
// the scatter sampler and the footprint envelopes. Nothing in this file may
// re-derive a radius or a particle position; the eraser and the spray tool
// read the same helpers, so a brush and its outline cannot drift apart.
//
// ── Footprint extents (hover outline) ───────────────────────────────────────
//
// Each brush declares the offsets from the stamp centre that its apply() can
// touch. These are NOT a preview of the stamp: the scattering brushes
// re-randomise on every call, so a literal preview would shimmer as the cursor
// moves. The extent is deterministic for all eight, and it is what the user
// actually needs — the blast radius, and therefore which attribute cells a
// stroke is about to clash. Verified against the real strokes in
// tests/tool-footprint.test.js, so an extent that drifts from its raster fails
// the build rather than lying on screen.

// Draw-mode resolution moved to PixelDrawRoutine.resolveUserMode — the draw
// mode is now a GLOBAL setting (StateManager) shared by every drawing tool,
// no longer a per-brush option.

/** Particles per stamp = size^2 * this * flow. */
const SCATTER_DENSITY = 0.25;

/**
 * BrushEngine - Brush system with 7 brush types
 *
 * Provides pressure sensitivity, flow rate and pattern support across round,
 * square, crosshatch, spray (uniform scatter or Poisson blue-noise), fade,
 * pattern and hatch brushes.
 *
 * THE SIZE-1 INVARIANT: at size 1 every brush writes exactly the pixel under
 * the cursor and nothing else — a 1px brush IS the pencil, which is how pixel
 * art works. Each apply() opens with a `size <= 1` guard delegating to
 * stampCentre(); Flow, scatter and hatch density have no meaning inside a
 * single pixel and are not applied there. Pinned by tests/brush-size-one.test.js.
 */
class BrushEngineClass {
    constructor() {
        this.brushes = new Map();
        this.currentBrush = 'round';
        this.currentSize = 1;
        // Shape is inherent to each brush type (SolidBrush subclasses)

        // Mask cache to avoid regenerating the same shapes every stamp
        this._patternCache = new Map();
        this._maxCacheSize = 64; // Limit cache size to prevent unbounded growth

        // Pressure Sensitivity System
        // Default OFF - all devices behave like mouse (constant size)
        this.pressureSensitivity = false;
        this.flowRate = 100;

        // Brush dynamics
        this.sizeVariation = 0;
        this.flowVariation = 0;

        // Size variation state
        this.currentSizeVariationValue = 0;
        this.variationDistance = 0;
        this.variationChangeThreshold = 10;
        this.lastVariationX = null;
        this.lastVariationY = null;

        // Pressure mapping thresholds
        this.pressureThreshold = 0.8;
        this.minPressureSize = 0.3;
        this.maxPressureSize = 1.5;

        // Drawing session state
        this.drawingSessionActive = false;

        this._initialized = false;
    }

    // Draw mode is a GLOBAL setting (StateManager). These delegate so existing
    // callers/tests keep working; the top-bar draw-mode selector is the UI.
    getDrawMode() { return StateManager.getDrawMode(); }

    /** @param {string} mode */
    setDrawMode(mode) { StateManager.setDrawMode(mode); }

    /**
     * Initialize the brush engine
     */
    initialize() {
        if (this._initialized) return true;

        this._initializeDefaultBrushes();
        this._initialized = true;

        Logger.info('BrushEngine', 'Initialized with 7 brush types');
        return true;
    }

    /**
     * Initialize default brush types
     * @private
     */
    _initializeDefaultBrushes() {
        this.registerBrush('round', new RoundBrush());
        this.registerBrush('square', new SquareBrush());
        this.registerBrush('crosshatch', new CrossHatchBrush());
        this.registerBrush('spray', new SprayBrush());
        this.registerBrush('fade', new FadeBrush());
        this.registerBrush('pattern', new PatternBrush());
        this.registerBrush('hatch', new HatchBrush());
    }

    /**
     * Register a brush type
     * @param {string} name - Brush name
     * @param {BaseBrush} brushInstance - Brush instance
     */
    registerBrush(name, brushInstance) {
        this.brushes.set(name, brushInstance);
    }

    /**
     * Set the current brush type
     * @param {string} brushName - Brush name to activate
     * @returns {boolean} True if successful
     */
    setBrush(brushName) {
        // 'stipple' was merged into 'spray' — same disc, same particle count;
        // the only difference was the radial weighting, now a slider.
        const name = BRUSH_ALIASES[brushName] || brushName;

        if (this.brushes.has(name)) {
            this.currentBrush = name;
            EventBus.emit(EVENTS.BRUSH_TYPE_CHANGED, { type: name, size: this.currentSize });
            return true;
        }
        return false;
    }

    /**
     * Set brush size
     * @param {number} size - Size in pixels (1-32)
     */
    setSize(size) {
        this.currentSize = clamp(size, 1, 32);
        EventBus.emit(EVENTS.BRUSH_SIZE_CHANGED, { size: this.currentSize });
    }

    /**
     * Enable or disable pressure sensitivity
     * @param {boolean} enabled - True to enable
     */
    setPressureSensitivity(enabled) {
        this.pressureSensitivity = enabled;
    }

    /**
     * Set flow rate
     * @param {number} rate - Flow rate (1-100)
     */
    setFlowRate(rate) {
        this.flowRate = clamp(rate, 1, 100);
    }

    /**
     * Map pressure to size multiplier
     * @param {number} pressure - Input pressure (0.0-1.0)
     * @returns {number} Size multiplier
     */
    mapPressure(pressure) {
        pressure = clamp(pressure, 0.0, 1.0);

        if (pressure < this.pressureThreshold) {
            const normalized = pressure / this.pressureThreshold;
            return this.minPressureSize + normalized * (1.0 - this.minPressureSize);
        }

        const normalized = (pressure - this.pressureThreshold) / (1.0 - this.pressureThreshold);
        return 1.0 + normalized * (this.maxPressureSize - 1.0);
    }

    /**
     * Every pixel the current brush can touch, as pixel coordinates centred on
     * (x, y) — the hover footprint. Uses the nominal size: pressure and size
     * jitter only exist mid-stroke, and hover is by definition not a stroke.
     * @param {number} x - Centre X in pixel space
     * @param {number} y - Centre Y in pixel space
     * @returns {Array<{x: number, y: number}>|null}
     */
    getFootprint(x, y, size = this.currentSize) {
        const brush = this.brushes.get(this.currentBrush);
        if (!brush) return null;

        const offsets = brush.getFootprintOffsets(size);
        if (!offsets || !offsets.length) return null;

        const points = [];
        for (let i = 0; i < offsets.length; i++) {
            points.push({ x: x + offsets[i].dx, y: y + offsets[i].dy });
        }
        return points;
    }

    /**
     * Apply brush at a point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} pressure - Pressure (0.0-1.0)
     * @param {boolean} isInk - True for ink, false for paper
     * @returns {boolean} True if any pixels were drawn
     */
    applyBrush(x, y, pressure = 1.0, isInk = true) {
        this.drawingSessionActive = true;

        const brush = this.brushes.get(this.currentBrush);
        if (!brush) {
            Logger.warn('BrushEngine', `Brush not found: ${this.currentBrush}`);
            return false;
        }

        const mappedPressure = this.mapPressure(pressure);

        // Calculate effective size
        let effectiveSize = this.currentSize;
        if (this.pressureSensitivity) {
            effectiveSize = Math.max(1, Math.round(this.currentSize * mappedPressure));
        }

        // Apply size variation
        if (this.sizeVariation > 0) {
            if (this.lastVariationX !== null && this.lastVariationY !== null) {
                const dx = x - this.lastVariationX;
                const dy = y - this.lastVariationY;
                this.variationDistance += Math.sqrt(dx * dx + dy * dy);
            }

            if (this.lastVariationX === null || this.variationDistance >= this.variationChangeThreshold) {
                this.currentSizeVariationValue = (Math.random() - 0.5) * 2 * (this.sizeVariation / 100);
                this.variationDistance = 0;
            }

            effectiveSize = Math.max(1, Math.round(effectiveSize * (1 + this.currentSizeVariationValue)));
            this.lastVariationX = x;
            this.lastVariationY = y;
        }

        // Calculate effective flow
        let effectiveFlow = this.flowRate / 100;
        if (this.pressureSensitivity) {
            effectiveFlow *= mappedPressure;
        }
        if (this.flowVariation > 0) {
            const variation = (Math.random() - 0.5) * 2 * (this.flowVariation / 100);
            effectiveFlow = Math.max(0.1, effectiveFlow * (1 + variation));
        }

        // Get current color selection
        const colorSelection = ColorManager.getCurrentSelection();

        // Get pattern data if using pattern brush
        let patternData = null;
        if (this.currentBrush === 'pattern' && PatternService.getCurrentPatternData()) {
            patternData = PatternService.getCurrentPatternData();
        }

        return brush.apply(x, y, effectiveSize, effectiveFlow, colorSelection, {
            // Pressure is only a fact when the user asked for it — otherwise a
            // pen would still modulate the density-driven brushes behind the
            // back of an unticked Pressure sensitivity checkbox.
            pressure: this.pressureSensitivity ? mappedPressure : 1.0,
            patternData: patternData,
            isInk: isInk
        });
    }

    /**
     * Apply brush continuously between two points
     * @param {number} fromX - Start X
     * @param {number} fromY - Start Y
     * @param {number} toX - End X
     * @param {number} toY - End Y
     * @param {number} pressure - Pressure
     * @param {boolean} isInk - True for ink
     * @returns {boolean} True if any pixels drawn
     */
    applyContinuousBrush(fromX, fromY, toX, toY, pressure, isInk = true) {
        const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        const spacing = Math.max(1, Math.floor(this.currentSize / 2));
        const steps = Math.max(1, Math.ceil(distance / spacing));

        let applied = false;

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = Math.round(fromX + (toX - fromX) * t);
            const y = Math.round(fromY + (toY - fromY) * t);

            if (this.applyBrush(x, y, pressure, isInk)) {
                applied = true;
            }
        }

        return applied;
    }

    /**
     * Start a drawing session
     */
    startDrawingSession() {
        this.drawingSessionActive = true;
        this.currentSizeVariationValue = 0;
        this.variationDistance = 0;
        this.lastVariationX = null;
        this.lastVariationY = null;

        // Reset stroke-aware brushes
        this.brushes.forEach(brush => {
            if (typeof brush.resetStroke === 'function') {
                brush.resetStroke();
            }
        });
    }

    /**
     * End a drawing session
     */
    endDrawingSession() {
        this.drawingSessionActive = false;
    }

    /**
     * Get list of available brushes
     * @returns {string[]} Brush names
     */
    getAvailableBrushes() {
        return Array.from(this.brushes.keys());
    }

    /**
     * Get a cached shape mask, or build and cache it.
     * @param {number} size - Mask size
     * @param {string} shape - 'round' | 'square'
     * @returns {number[][]} 2D mask
     */
    getCachedPattern(size, shape = 'round') {
        const key = `${size}_${shape}`;

        if (this._patternCache.has(key)) {
            return this._patternCache.get(key);
        }

        const pattern = shape === 'square' ? BrushShapes.square(size) : BrushShapes.disc(size);

        // Prune cache if too large (LRU-style: delete oldest entries)
        if (this._patternCache.size >= this._maxCacheSize) {
            const firstKey = this._patternCache.keys().next().value;
            this._patternCache.delete(firstKey);
        }

        this._patternCache.set(key, pattern);
        return pattern;
    }

    /**
     * Clear the shape-mask cache
     */
    clearPatternCache() {
        this._patternCache.clear();
    }
}

/**
 * Retired brush ids that still resolve. `stipple-poisson` folded into spray as
 * its Poisson distribution sub-mode; the id lands on spray so a persisted tool
 * selection never dangles. @see BrushEngineClass#setBrush
 */
const BRUSH_ALIASES = Object.freeze({
    stipple: 'spray',
    'stipple-poisson': 'spray',
    'crosshatch-advanced': 'hatch'   // rebuilt as the real Hatch brush
});

/**
 * BaseBrush - Abstract base class for all brushes
 */
class BaseBrush {
    constructor() {
        this.description = 'Base brush';
        this.supportsPressure = true;
        // Does apply() actually SPEND `flow`? Only the scattering brushes do
        // (it buys particles); the deterministic ones ignore the argument
        // entirely. The fade reads this to decide whether scaling flow is
        // enough to thin a delegate or whether it must gate the writes —
        // before it existed, a fade over hatch or pattern did not fade at all.
        // Mirrors FLOW_BRUSHES in brush-tool.js, which hides the Flow row for
        // the same reason.
        this.consumesFlow = false;
    }

    /**
     * Offsets from the stamp centre that this brush's apply() can touch — the
     * hover footprint. Default is the solid disc; the scattering brushes widen
     * it to their own envelope.
     * @param {number} size
     * @returns {Array<{dx: number, dy: number}>}
     */
    getFootprintOffsets(size) {
        return BrushShapes.discOffsets(size);
    }

    /**
     * The size-1 stamp: exactly the pixel under the cursor. Every apply()
     * routes here at size <= 1 so a 1px brush of any type behaves as the
     * pencil — no scatter, no hatch phase, no dropout.
     * @param {number} x @param {number} y
     * @param {Object} options - apply() options (isInk, patternData, ...)
     * @returns {boolean} True if the pixel was written
     */
    stampCentre(x, y, options = {}) {
        if (!_inBounds(x, y)) return false;
        const isInk = options.isInk !== undefined ? options.isInk : true;
        PixelDrawRoutine.draw(x, y, options.colorSelection, PixelDrawRoutine.resolveUserMode(isInk));
        return true;
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        return false;
    }
}

/**
 * SolidBrush - Base for solid fill brushes with a fixed footprint shape.
 * Each subclass sets its own shape; the shape dropdown is not used.
 */
class SolidBrush extends BaseBrush {
    constructor(shapeName, description) {
        super();
        this.shapeName = shapeName;
        this.description = description;
    }

    /** Solid brushes stamp exactly their shape mask — reuse it verbatim. */
    getFootprintOffsets(size) {
        return BrushShapes.maskOffsets(BrushEngine.getCachedPattern(size, this.shapeName), size);
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        if (size <= 1) return this.stampCentre(x, y, { ...options, colorSelection });

        const isInk = options.isInk !== undefined ? options.isInk : true;
        const pattern = BrushEngine.getCachedPattern(size, this.shapeName);
        const offset = Math.floor(size / 2);
        let applied = false;

        const mode = PixelDrawRoutine.resolveUserMode(isInk);

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (pattern[dy][dx] > 0) {
                    const pixelX = x + dx - offset;
                    const pixelY = y + dy - offset;

                    if (_inBounds(pixelX, pixelY)) {
                        PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                        applied = true;
                    }
                }
            }
        }

        return applied;
    }
}

class RoundBrush extends SolidBrush {
    constructor() { super('round', 'Round brush with smooth edges'); }
}

class SquareBrush extends SolidBrush {
    constructor() { super('square', 'Square brush with hard edges'); }
}

/**
 * CrossHatchBrush - Diagonal cross pattern.
 *
 * The lattice is anchored to CANVAS coordinates, not to the stamp box: a
 * stroke lays down one continuous hatch instead of a moire of stamps that each
 * restart the pattern under the cursor (the same reason PatternBrush tiles
 * absolutely).
 */
class CrossHatchBrush extends BaseBrush {
    constructor() {
        super();
        this.description = 'Cross-hatch pattern brush';
        this.spacing = 4;
    }

    /** apply() walks the whole size x size box — no radial cull. */
    getFootprintOffsets(size) {
        return BrushShapes.boxOffsets(size);
    }

    /**
     * Is this canvas pixel on the hatch?
     * @param {number} px @param {number} py
     * @returns {boolean}
     */
    _isLattice(px, py) {
        const s = this.spacing;
        const diff = ((px - py) % s + s) % s;   // negative-safe modulo
        const sum = ((px + py) % s + s) % s;
        return diff === 0 || sum === 0;
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        if (size <= 1) return this.stampCentre(x, y, { ...options, colorSelection });

        const isInk = options.isInk !== undefined ? options.isInk : true;
        const offset = Math.floor(size / 2);
        let applied = false;

        const mode = PixelDrawRoutine.resolveUserMode(isInk);

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const pixelX = x + dx - offset;
                const pixelY = y + dy - offset;

                if (this._isLattice(pixelX, pixelY) && _inBounds(pixelX, pixelY)) {
                    PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                    applied = true;
                }
            }
        }

        return applied;
    }
}

/**
 * SprayBrush - Scattered particles, in one of two distributions.
 *
 * `uniform` (default) is the merge of the old Stipple and Spray brushes, which
 * were the same brush: same disc, same per-stamp re-randomisation, dot counts
 * within 8% of each other. Their one real difference — Stipple spread its dots
 * evenly over the area, Spray piled them toward the centre — is the `weighting`
 * slider, defaulting to even.
 *
 * `poisson` is the former stand-alone Poisson-stipple brush, folded in here as
 * a sub-mode: blue-noise even spacing with no clumps. On a 1-bit target its
 * one advantage over even-weighted uniform (no wasted coincident samples) is
 * mostly invisible, so it earns a distribution option rather than a rail
 * button. The sampler (BrushShapes.poissonDisk) is O(n^2), so each size is
 * sampled once into a small pool of variants and a stamp picks one; flow takes
 * a random SUBSET of a set's points.
 */
class SprayBrush extends BaseBrush {
    constructor() {
        super();
        this.description = 'Spray brush with scattered particles';
        this.consumesFlow = true;       // flow buys particles — see BaseBrush
        this.weighting = 0;             // -100 rim .. 0 even .. +100 centre (uniform)
        this.distribution = 'uniform';  // 'uniform' polar scatter | 'poisson' blue-noise

        // Poisson sub-mode state.
        this.minDistance = 2;
        this.poissonShape = 'square';   // 'square' whole box | 'round' disc-confined
        this.maxAttempts = 30;
        this._pools = new Map();        // size -> Array<Array<{x, y}>>
        this._poolVariants = 8;
        this._maxPooledSizes = 8;
    }

    /**
     * Uniform scatters inside the disc; Poisson fills its box (square) or the
     * disc (round), so the hover envelope follows the active distribution and,
     * for Poisson, its shape.
     */
    getFootprintOffsets(size) {
        if (this.distribution === 'poisson') {
            return this.poissonShape === 'round'
                ? BrushShapes.discOffsets(size)
                : BrushShapes.boxOffsets(size);
        }
        return BrushShapes.scatterEnvelope(BrushShapes.radiusFor(size));
    }

    /** @param {number} value - -100 (rim) .. 0 (even) .. +100 (centre) */
    setWeighting(value) {
        this.weighting = clamp(value, -100, 100);
    }

    /** @param {string} value - 'uniform' | 'poisson' */
    setDistribution(value) {
        this.distribution = value === 'poisson' ? 'poisson' : 'uniform';
    }

    /** @param {number} value - Minimum spacing between Poisson points (>= 1). */
    setMinDistance(value) {
        this.minDistance = Math.max(1, value);
        this._pools.clear();
    }

    /**
     * @param {string} value - 'square' (whole box) | 'round' (disc-confined).
     * Only filters the shared point pool, so no re-sample is needed.
     */
    setPoissonShape(value) {
        this.poissonShape = value === 'round' ? 'round' : 'square';
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        if (size <= 1) return this.stampCentre(x, y, { ...options, colorSelection });

        return this.distribution === 'poisson'
            ? this._applyPoisson(x, y, size, flow, colorSelection, options)
            : this._applyUniform(x, y, size, flow, colorSelection, options);
    }

    /** Polar scatter with independent per-axis rounding — see BrushShapes. @private */
    _applyUniform(x, y, size, flow, colorSelection, options) {
        const isInk = options.isInk !== undefined ? options.isInk : true;
        const mode = PixelDrawRoutine.resolveUserMode(isInk);

        const count = Math.max(1, Math.round(size * size * SCATTER_DENSITY * flow));
        const points = BrushShapes.scatterPoints(BrushShapes.radiusFor(size), this.weighting, count);
        let applied = false;

        for (let i = 0; i < points.length; i++) {
            const pixelX = x + points[i].dx;
            const pixelY = y + points[i].dy;

            if (_inBounds(pixelX, pixelY)) {
                PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                applied = true;
            }
        }

        return applied;
    }

    /**
     * Blue-noise stipple. Flow takes a random SUBSET of a pooled point set — a
     * prefix would shrink the sprayed blob (the sampler emits points in growth
     * order from one seed) instead of thinning it. @private
     */
    _applyPoisson(x, y, size, flow, colorSelection, options) {
        const isInk = options.isInk !== undefined ? options.isInk : true;
        const mode = PixelDrawRoutine.resolveUserMode(isInk);

        const points = this._pickPointSet(size);
        const offset = Math.floor(size / 2);
        const wanted = clamp(Math.round(points.length * flow), 1, points.length);
        // Round confines the stipple to the disc (same mask the footprint uses,
        // so the outline bounds it exactly); square keeps the whole box.
        const disc = this.poissonShape === 'round' ? BrushEngine.getCachedPattern(size, 'round') : null;
        let applied = false;

        for (const point of this._randomSubset(points, wanted)) {
            const col = clamp(Math.round(point.x), 0, size - 1);
            const row = clamp(Math.round(point.y), 0, size - 1);
            if (disc && !disc[row][col]) continue;

            const pixelX = x + col - offset;
            const pixelY = y + row - offset;

            if (_inBounds(pixelX, pixelY)) {
                PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                applied = true;
            }
        }

        return applied;
    }

    /**
     * One of the pre-generated point sets for this size — sampled once per size
     * into a pool because BrushShapes.poissonDisk is O(n^2).
     * @private
     * @returns {Array<{x: number, y: number}>}
     */
    _pickPointSet(size) {
        let pool = this._pools.get(size);

        if (!pool) {
            pool = [];
            for (let i = 0; i < this._poolVariants; i++) {
                pool.push(BrushShapes.poissonDisk(size, this.minDistance, this.maxAttempts));
            }
            if (this._pools.size >= this._maxPooledSizes) {
                this._pools.delete(this._pools.keys().next().value);
            }
            this._pools.set(size, pool);
        }

        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * `count` points drawn without replacement — a partial Fisher-Yates over an
     * index list, so the thinning is spatially uniform.
     * @private
     */
    _randomSubset(points, count) {
        if (count >= points.length) return points;

        const idx = points.map((_, i) => i);
        const out = [];
        for (let i = 0; i < count; i++) {
            const j = i + Math.floor(Math.random() * (idx.length - i));
            const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
            out.push(points[idx[i]]);
        }
        return out;
    }
}

/**
 * The four zones a fade passes through, as density bands. The Bayer 4x4 gives
 * 16 dither levels, so each zone owns four of them — the coarsest split that
 * still reads as distinct on a two-colour cell.
 *
 * Their DEFAULT weights below are the density spans themselves (0/40/35/25),
 * which is what makes an untouched fade identical to the plain linear ramp
 * this replaced: within every zone the interpolation works out to 1 - t.
 * Pinned by tests/fade-zones.test.js.
 */
const FADE_ZONES = Object.freeze([
    Object.freeze({ name: 'solid',   from: 1,    to: 1    }),
    Object.freeze({ name: 'dense',   from: 1,    to: 0.6  }),
    Object.freeze({ name: 'sparse',  from: 0.6,  to: 0.25 }),
    Object.freeze({ name: 'stipple', from: 0.25, to: 0    })
]);

const FADE_ZONE_DEFAULTS = Object.freeze([0, 40, 35, 25]);

/**
 * Ordered-dither threshold maps, as the fade's texture choices.
 *
 * All are DETERMINISTIC functions of canvas-absolute x/y, which is what lets
 * a dither align between strokes and survive being redrawn: paint the same
 * stroke twice and the same pixels land. That rules out white noise seeded
 * per call, and it is why 'noise' below is a hash of the coordinates rather
 * than Math.random().
 *
 * Error diffusion (Floyd-Steinberg, Atkinson, ...) is deliberately absent:
 * a pixel's threshold there depends on error pushed from pixels above and to
 * the left, which do not exist yet while the pointer is still moving. It
 * would have to run on stroke commit, re-graining the whole stroke on
 * pointer-up. Worth doing one day as its own mode; not a peer of these.
 */
const bayerMatrix = (n) => {
    if (n === 1) return [[0]];
    const half = bayerMatrix(n / 2);
    const size = n / 2;
    const out = Array.from({ length: n }, () => new Array(n));
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const v = half[y][x] * 4;
            out[y][x] = v;
            out[y][x + size] = v + 2;
            out[y + size][x] = v + 3;
            out[y + size][x + size] = v + 1;
        }
    }
    return out;
};

/** Normalize an integer threshold map to the 0..1 range the fade compares against. */
const normalizeMatrix = (m) => {
    const n = m.length * m[0].length;
    return m.map(row => row.map(v => v / n));
};

// The classic 8x8 clustered-dot (45 degree) screen: thresholds grow outward
// from two centres, so ink forms GROWING DOTS rather than dispersing. The
// halftone look, and the one dither here that survives being printed.
const CLUSTERED_8 = [
    [24, 10, 12, 26, 35, 47, 49, 37],
    [ 8,  0,  2, 14, 45, 59, 61, 51],
    [22,  6,  4, 16, 43, 57, 63, 53],
    [30, 20, 18, 28, 33, 41, 55, 39],
    [34, 46, 48, 38, 25, 11, 13, 27],
    [44, 58, 60, 50,  9,  1,  3, 15],
    [42, 56, 62, 52, 23,  7,  5, 17],
    [32, 40, 54, 36, 31, 21, 19, 29]
];

const FADE_DITHERS = Object.freeze({
    // 16 levels. The historical fade, and still the default.
    ordered4: Object.freeze({ matrix: normalizeMatrix(bayerMatrix(4)) }),
    // 64 levels — four times the gradation, which is what the four zones want.
    ordered8: Object.freeze({ matrix: normalizeMatrix(bayerMatrix(8)) }),
    halftone: Object.freeze({ matrix: normalizeMatrix(CLUSTERED_8) }),
    // Interleaved gradient noise: dispersed like blue noise, no tiling grid,
    // and a pure function of the coordinates so it stays repeatable.
    noise: Object.freeze({ fn: (x, y) => {
        const v = 0.06711056 * x + 0.00583715 * y;
        const f = 52.9829189 * (v - Math.floor(v));
        return f - Math.floor(f);
    }})
});

const FADE_DITHER_IDS = Object.freeze(Object.keys(FADE_DITHERS));

/**
 * FadeBrush - Draws solid near stroke start, dithers to nothing over distance.
 * Uses Bayer 4x4 ordered dithering for clean ZX-style falloff.
 *
 * Fade length is the whole stroke's travel; the four zone weights divide that
 * travel between the solid head, the two dither bands and the stipple tail.
 * The weights are RELATIVE (normalized against their sum), so lengthening one
 * zone never forces the artist to go rebalance the other three.
 */
class FadeBrush extends BaseBrush {
    constructor() {
        super();
        this.description = 'Fades from solid to empty over stroke distance';
        this.fadeLength = 64;
        this.fadeBrushType = 'round';
        this.zoneWeights = [...FADE_ZONE_DEFAULTS];
        this.ditherType = 'ordered4';
        // 'origin' | 'travel' — see travelled(). Distance from the click point
        // is the default because it is REVERSIBLE: draw away and the ink thins,
        // draw back and it recovers, so a fade can be worked into rather than
        // being spent the moment the hand wanders.
        this.measureFrom = 'origin';
        this._strokeDistance = 0;
        this._lastX = null;
        this._lastY = null;
        this._originX = null;
        this._originY = null;
    }

    /**
     * The dither threshold at a canvas position, 0..1. A pixel survives when
     * the fade's density exceeds it.
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    thresholdAt(x, y) {
        const dither = FADE_DITHERS[this.ditherType] || FADE_DITHERS.ordered4;
        if (dither.fn) return dither.fn(x, y);
        const m = dither.matrix;
        const h = m.length;
        const w = m[0].length;
        // Modulo that stays correct left of the origin.
        return m[((y % h) + h) % h][((x % w) + w) % w];
    }

    /**
     * How far into the fade a stamp at (x, y) is, in pixels.
     *
     * 'travel' accumulates PATH LENGTH, so it only ever grows: one tapered
     * stroke that dies wherever it happens to run out, whichever way it wandered.
     *
     * 'origin' measures the straight line back to the click point, so the fade
     * is a radial falloff centred there — draw away and the ink thins, draw back
     * and it recovers, circle the anchor and the density holds. Reversible,
     * which path length can never be.
     *
     * @param {number} x
     * @param {number} y
     * @returns {number} Distance into the fade, in pixels
     */
    travelled(x, y) {
        if (this.measureFrom === 'origin') {
            const dx = x - (this._originX === null ? x : this._originX);
            const dy = y - (this._originY === null ? y : this._originY);
            return Math.sqrt(dx * dx + dy * dy);
        }
        return this._strokeDistance;
    }

    /** Fade stamps through its delegate, so it inherits the delegate's extent. */
    getFootprintOffsets(size) {
        const delegate = BrushEngine.brushes.get(this.fadeBrushType);
        return delegate ? delegate.getFootprintOffsets(size) : BrushShapes.discOffsets(size);
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        // The stroke's anchor: where the pointer went down. 'origin' measures
        // from it, and resetStroke() forgets it again.
        if (this._originX === null) {
            this._originX = x;
            this._originY = y;
        }

        // Track cumulative stroke distance
        if (this._lastX !== null) {
            const dx = x - this._lastX;
            const dy = y - this._lastY;
            this._strokeDistance += Math.sqrt(dx * dx + dy * dy);
        }
        this._lastX = x;
        this._lastY = y;

        // Density falls from 1.0 (solid) to 0.0 across the four zones
        const fadeDensity = this.densityAt(this.travelled(x, y) / this.fadeLength);
        if (fadeDensity <= 0) return false;

        // At 1px the fade is still a fade — the dither threshold decides this
        // one pixel — but it is never a scatter or a hatch.
        if (size <= 1) {
            return this._ditherPixel(x, y, fadeDensity, colorSelection, options);
        }

        // Get the delegate brush
        const delegate = BrushEngine.brushes.get(this.fadeBrushType);
        if (!delegate) return false;

        // A brush that spends `flow` on particle COUNT already thins itself, so
        // scaling flow is its fade; gating it as well would fade twice as fast.
        if (delegate.consumesFlow) {
            return delegate.apply(x, y, size, flow * fadeDensity, colorSelection, options);
        }

        // Everything else — the solids, hatch, crosshatch, pattern — ignores
        // flow entirely. They fade by having their writes thinned at the gate,
        // which is the ONE dither implementation for every delegate.
        return PixelDrawRoutine.withDitherGate(
            (px, py) => fadeDensity > this.thresholdAt(px, py),
            () => delegate.apply(x, y, size, flow, colorSelection, options)
        );
    }

    /**
     * One pixel, kept or dropped by its dither threshold. The size-1 path,
     * which has no delegate to gate.
     * @private
     * @returns {boolean}
     */
    _ditherPixel(x, y, density, colorSelection, options) {
        if (!_inBounds(x, y)) return false;
        if (density <= this.thresholdAt(x, y)) return false;

        const isInk = options.isInk !== undefined ? options.isInk : true;
        PixelDrawRoutine.draw(x, y, colorSelection, PixelDrawRoutine.resolveUserMode(isInk));
        return true;
    }

    /**
     * Reset stroke tracking (called via BrushEngine.startDrawingSession)
     */
    resetStroke() {
        this._strokeDistance = 0;
        this._lastX = null;
        this._lastY = null;
        this._originX = null;
        this._originY = null;
    }

    /**
     * Ink density at a point along the stroke.
     *
     * `t` is travel as a fraction of fadeLength. The zone weights partition
     * that travel; each zone interpolates linearly across its own density
     * band, so the ramp stays monotone however the weights are set.
     *
     * @param {number} t - Travelled fraction of the fade length (0 = start)
     * @returns {number} Density 0..1
     */
    densityAt(t) {
        if (!(t > 0)) return 1;
        if (t >= 1) return 0;

        const weights = this.zoneWeights;
        let total = 0;
        for (let i = 0; i < FADE_ZONES.length; i++) total += Math.max(0, weights[i] || 0);

        // Every zone zeroed leaves no travel to fade across, which would read
        // as a stroke that vanishes on contact. Fall back to the plain ramp.
        if (total <= 0) return 1 - t;

        let start = 0;
        for (let i = 0; i < FADE_ZONES.length; i++) {
            const span = Math.max(0, weights[i] || 0) / total;
            if (span <= 0) continue;
            if (t < start + span || i === FADE_ZONES.length - 1) {
                const zone = FADE_ZONES[i];
                const local = clamp((t - start) / span, 0, 1);
                return zone.from + (zone.to - zone.from) * local;
            }
            start += span;
        }
        return 0;
    }

    setFadeLength(length) {
        this.fadeLength = clamp(length, 8, 256);
    }

    /**
     * Set one zone's relative length.
     * @param {number} index - Zone index into FADE_ZONES
     * @param {number} weight - Relative length 0..100
     */
    setZoneWeight(index, weight) {
        if (index < 0 || index >= FADE_ZONES.length) return;
        this.zoneWeights[index] = clamp(weight, 0, 100);
    }

    setFadeBrushType(type) {
        this.fadeBrushType = type;
    }

    /**
     * Choose the dither texture the fade dissolves through.
     * @param {string} type - A FADE_DITHERS id
     */
    setDitherType(type) {
        if (FADE_DITHERS[type]) this.ditherType = type;
    }

    /**
     * Choose what the fade measures: path length or the click point.
     * @param {string} mode - 'travel' | 'origin'
     */
    setMeasureFrom(mode) {
        if (mode === 'travel' || mode === 'origin') this.measureFrom = mode;
    }
}

/**
 * PatternBrush - Scratch-off reveal brush using a tiled pattern.
 * The pattern tiles at canvas-absolute coordinates so it appears as a
 * consistent layer beneath the canvas. Left-click draws ink where the
 * pattern has a 1-bit and erases (paper) where it has a 0-bit, revealing
 * the pattern as if scratching away an opaque coating. Right-click erases
 * the entire brush footprint back to paper.
 */
class PatternBrush extends BaseBrush {
    constructor() {
        super();
        this.description = 'Pattern reveal brush';
    }

    /** Reveals/erases across the whole size x size box. */
    getFootprintOffsets(size) {
        return BrushShapes.boxOffsets(size);
    }

    /** At 1px the reveal is still a reveal: this pixel's tile bit decides. */
    stampCentre(x, y, options = {}) {
        if (!_inBounds(x, y)) return false;

        const isInk = options.isInk !== undefined ? options.isInk : true;
        const patternData = options.patternData;
        if (isInk && (!patternData || !patternData.bitmap)) {
            Logger.warn('BrushEngine', 'No pattern data for pattern brush');
            return false;
        }

        const mode = (!isInk || this._tileBit(patternData, x, y))
            ? PixelDrawRoutine.resolveUserMode(isInk)
            : PixelDrawRoutine.resolveUserMode(false);

        PixelDrawRoutine.draw(x, y, options.colorSelection, mode);
        return true;
    }

    /**
     * The pattern bit under a CANVAS pixel (absolute tiling).
     * @private
     * @returns {boolean}
     */
    _tileBit(patternData, pixelX, pixelY) {
        const px = ((pixelX % patternData.width) + patternData.width) % patternData.width;
        const py = ((pixelY % patternData.height) + patternData.height) % patternData.height;
        return !!patternData.bitmap[py * patternData.width + px];
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        const isInk = options.isInk !== undefined ? options.isInk : true;
        const patternData = options.patternData;

        if (isInk && (!patternData || !patternData.bitmap)) {
            Logger.warn('BrushEngine', 'No pattern data for pattern brush');
            return false;
        }

        if (size <= 1) return this.stampCentre(x, y, { ...options, colorSelection });

        const offset = Math.floor(size / 2);
        let applied = false;

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const pixelX = x + dx - offset;
                const pixelY = y + dy - offset;

                if (!_inBounds(pixelX, pixelY)) continue;

                if (!isInk) {
                    PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, PixelDrawRoutine.resolveUserMode(false));
                    applied = true;
                    continue;
                }

                const mode = this._tileBit(patternData, pixelX, pixelY)
                    ? PixelDrawRoutine.resolveUserMode(true)
                    : PixelDrawRoutine.resolveUserMode(false);
                PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                applied = true;
            }
        }

        return applied;
    }
}

/**
 * HatchBrush - pen-and-ink hatching.
 *
 * Replaces the old "advanced crosshatch", which did not actually hatch: it
 * anchored its lattice to the STAMP BOX (so every stamp restarted the phase
 * and a dragged stroke moired), shredded its own lines with a per-pixel
 * `Math.random() < flow` gate (so any flow below 100% turned hatching into
 * noise), and rode a radial falloff on the moving cursor (so tone came out
 * lumpy). Its density dials were never even wired to the UI.
 *
 * This one is DETERMINISTIC and CANVAS-ANCHORED. A stroke lays one continuous
 * set of parallel lines, and a second pass at another angle interlocks with
 * the first — which is how you cross-hatch here: by hand, one direction at a
 * time, exactly as in pen work. There is deliberately no "cross" mode.
 *
 * Tone is exactly thickness/spacing at every angle (see BrushShapes
 * .onHatchLine). On a 1-bit cell that is the only honest way to shade: ink
 * over ink is idempotent, so tone can only come from line spacing and from
 * crossing directions, never from opacity or from re-stamping.
 */
class HatchBrush extends BaseBrush {
    constructor() {
        super();
        this.description = 'Pen-and-ink hatching';
        this.angle = 'follow';      // a HATCH_ANGLES id, or 'follow' (stroke direction)
        this.spacing = 4;
        this.thickness = 1;
        this.nib = 'round';         // 'round' | 'square'

        // 'follow' state: a smoothed movement vector and the angle it settled
        // on. Reset per stroke via resetStroke().
        this._followId = '45';
        this._dirX = 0;
        this._dirY = 0;
        this._lastX = null;
        this._lastY = null;
    }

    /**
     * The nib envelope. Like the basic crosshatch before it, the hover outline
     * is the blast radius rather than the exact lattice: stroking the boundary
     * of a dozen disjoint hatch lines would be visual noise, and what the
     * artist needs from the outline is which cells the stroke can clash.
     */
    getFootprintOffsets(size) {
        return this.nib === 'square'
            ? BrushShapes.boxOffsets(size)
            : BrushShapes.discOffsets(size);
    }

    /** @param {string} value - a HATCH_ANGLES id, or 'follow' */
    setAngle(value) {
        this.angle = value;
    }

    /** @param {number} value - distance between line starts */
    setSpacing(value) {
        this.spacing = clamp(Math.round(value), 2, 16);
    }

    /** @param {number} value - line width (tone = thickness/spacing) */
    setThickness(value) {
        this.thickness = clamp(Math.round(value), 1, 8);
    }

    /** @param {string} value - 'round' | 'square' */
    setNib(value) {
        this.nib = value === 'square' ? 'square' : 'round';
    }

    /** Stroke-direction tracking restarts per stroke. */
    resetStroke() {
        this._dirX = 0;
        this._dirY = 0;
        this._lastX = null;
        this._lastY = null;
    }

    /**
     * Feed the smoothed stroke direction that 'follow' mode snaps from. The
     * EMA is the difference between "hatching follows my gesture" and "the
     * angle flickers with every tremor"; the snap adds hysteresis on top.
     * @private
     */
    _trackDirection(x, y) {
        if (this._lastX !== null) {
            const dx = x - this._lastX;
            const dy = y - this._lastY;
            if (dx !== 0 || dy !== 0) {
                const k = 0.35;
                this._dirX = this._dirX * (1 - k) + dx * k;
                this._dirY = this._dirY * (1 - k) + dy * k;
                const snapped = BrushShapes.snapHatchAngle(this._dirX, this._dirY, this._followId);
                if (snapped) this._followId = snapped;
            }
        }
        this._lastX = x;
        this._lastY = y;
    }

    /** The direction actually hatched with right now. @private */
    _activeDirection() {
        return BrushShapes.hatchDirection(this.angle === 'follow' ? this._followId : this.angle);
    }

    apply(x, y, size, flow, colorSelection, options = {}) {
        // Tracked even at size 1, so a 1px stroke still steers 'follow' mode.
        this._trackDirection(x, y);
        if (size <= 1) return this.stampCentre(x, y, { ...options, colorSelection });

        const isInk = options.isInk !== undefined ? options.isInk : true;
        const mode = PixelDrawRoutine.resolveUserMode(isInk);
        const dir = this._activeDirection();
        const offset = Math.floor(size / 2);
        const nib = BrushEngine.getCachedPattern(size, this.nib);
        let applied = false;

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (!nib[dy] || nib[dy][dx] <= 0) continue;

                const pixelX = x + dx - offset;
                const pixelY = y + dy - offset;
                if (!_inBounds(pixelX, pixelY)) continue;
                // The lattice is a function of CANVAS position, so overlapping
                // stamps reinforce one set of lines rather than moireing.
                if (!BrushShapes.onHatchLine(pixelX, pixelY, dir, this.spacing, this.thickness)) continue;

                PixelDrawRoutine.draw(pixelX, pixelY, colorSelection, mode);
                applied = true;
            }
        }

        return applied;
    }
}

// Create singleton instance
window.BrushEngine = new BrushEngineClass();

// Export brush classes for custom brush creation
window.BaseBrush = BaseBrush;
window.RoundBrush = RoundBrush;
window.SquareBrush = SquareBrush;
window.CrossHatchBrush = CrossHatchBrush;
window.SprayBrush = SprayBrush;
window.FadeBrush = FadeBrush;
window.FADE_ZONES = FADE_ZONES;
window.FADE_DITHERS = FADE_DITHERS;
window.FADE_DITHER_IDS = FADE_DITHER_IDS;
window.PatternBrush = PatternBrush;
window.HatchBrush = HatchBrush;

Logger.debug('BrushEngine', 'Brush engine loaded with 7 brush types');

})(); // End IIFE
