'use strict';
(function() {

/**
 * BrushShapes — the app's ONLY definition of brush geometry.
 *
 * Three consumers used to carry three different ideas of "round": the round
 * brush culled at `floor(size/2) - 0.5`, the eraser and the hover-footprint
 * helper culled at `floor(size/2)`, so the same slider number meant 37 pixels
 * in one place and 49 in another. Worse, the brush rule made sizes 2k and 2k+1
 * produce byte-identical masks — half of a 32-step slider was dead. Everything
 * round now comes from `disc()`.
 *
 * Likewise the scatter maths: the stipple and spray brushes and the standalone
 * spray tool each rolled their own particle loop, and two of them were the same
 * brush wearing different names. `scatterPoints()` is the single sampler; the
 * only thing that separates the old pair is the `weighting` argument.
 *
 * Pure, dependency-free, no DOM (Node-tested in tests/brush-shapes.test.js).
 */
const BrushShapes = {

    /**
     * The radius a brush of `size` draws with, in pixels.
     *
     * `size/2 - 0.25` rather than `floor(size/2)`: the quarter-pixel inset is
     * what makes every integer size land on a DIFFERENT set of cells (verified
     * over 1..32 — strictly increasing counts, no duplicate masks), and it puts
     * the whole disc inside the size x size box. Size 1 gives 0.25, which is
     * below the half-pixel rounding threshold in every direction — that is how
     * the scatter brushes are guaranteed to stay on the centre pixel at size 1.
     *
     * @param {number} size - Brush size in pixels (>= 1)
     * @returns {number}
     */
    radiusFor(size) {
        return Math.max(0, size / 2 - 0.25);
    },

    /**
     * Filled disc of diameter `size` as a size x size 0/1 mask.
     *
     * Cell-CENTRE sampling: cell (x, y) is in when its centre (x+0.5, y+0.5)
     * lies within `radiusFor(size)` of the box centre (size/2, size/2). Even
     * sizes therefore straddle the centre honestly instead of being silently
     * demoted to the odd size below them. The ramp is 1, 4, 5, 12, 21, 24, 37,
     * 44, ... — a pixel, a 2x2, a plus, then true discs.
     *
     * A size with a hand-curated replacement in `BRUSH_SHAPE_OVERRIDES`
     * (built by `tools/brush-shape-designer.html`, never hand-edited —
     * see `js/data/brush-shape-overrides.js`) returns that mask instead;
     * every other size still comes from the formula. This is the ONLY
     * place that table is read, so discOffsets/maskOffsets and every
     * consumer of disc() inherit an override for free.
     *
     * @param {number} size - Diameter in pixels
     * @returns {number[][]} row-major mask
     */
    disc(size) {
        const n = Math.max(1, Math.round(size));
        const override = BrushShapes._overrideMask(n);
        if (override) return override;

        const c = n / 2;
        const r = BrushShapes.radiusFor(n);
        const rr = r * r;
        const mask = [];

        for (let y = 0; y < n; y++) {
            mask[y] = new Array(n).fill(0);
            for (let x = 0; x < n; x++) {
                const dx = x + 0.5 - c;
                const dy = y + 0.5 - c;
                if (dx * dx + dy * dy <= rr) mask[y][x] = 1;
            }
        }
        return mask;
    },

    /**
     * The curated mask for `size`, reconstructed from its centre-relative
     * offset list, or `null` if this size has no override.
     * @param {number} size
     * @returns {number[][]|null}
     * @private
     */
    _overrideMask(size) {
        const table = window.BRUSH_SHAPE_OVERRIDES;
        const offsets = table && table.masks && table.masks[size];
        if (!offsets) return null;

        const offset = Math.floor(size / 2);
        const mask = [];
        for (let y = 0; y < size; y++) mask[y] = new Array(size).fill(0);
        offsets.forEach(o => {
            const x = o.dx + offset, y = o.dy + offset;
            if (x >= 0 && x < size && y >= 0 && y < size) mask[y][x] = 1;
        });
        return mask;
    },

    /**
     * Is `size` flagged (via the same curated table) as producing a poor
     * round shape? Sizes/tools that offer a brush-size slider skip it —
     * see `nearestAllowedSize`.
     * @param {number} size
     * @returns {boolean}
     */
    isSizeExcluded(size) {
        const table = window.BRUSH_SHAPE_OVERRIDES;
        const excluded = table && table.excludedSizes;
        return !!(excluded && excluded.indexOf(Math.round(size)) !== -1);
    },

    /**
     * `size` clamped to [1, max], then nudged to the nearest size that
     * isn't excluded (searching outward, ties broken downward). Sizes
     * beyond the curated table's range (the eraser's 33..128) are never
     * excluded, so this is a no-op there.
     * @param {number} size
     * @param {number} max
     * @returns {number}
     */
    nearestAllowedSize(size, max) {
        const n = clamp(Math.round(size), 1, max);
        if (!BrushShapes.isSizeExcluded(n)) return n;
        for (let d = 1; d <= max; d++) {
            if (n - d >= 1 && !BrushShapes.isSizeExcluded(n - d)) return n - d;
            if (n + d <= max && !BrushShapes.isSizeExcluded(n + d)) return n + d;
        }
        return n; // every size in range excluded - nothing sane to return instead
    },

    /**
     * Solid size x size mask.
     * @param {number} size
     * @returns {number[][]}
     */
    square(size) {
        const n = Math.max(1, Math.round(size));
        const mask = [];
        for (let y = 0; y < n; y++) mask[y] = new Array(n).fill(1);
        return mask;
    },

    /**
     * The same cells as `disc()`, expressed as offsets from the stamp centre —
     * the form the eraser and the hover footprints want.
     * @param {number} size
     * @returns {Array<{dx: number, dy: number}>}
     */
    discOffsets(size) {
        return BrushShapes.maskOffsets(BrushShapes.disc(size), size);
    },

    /**
     * Set bits of a size x size mask as centre-relative offsets. The centre is
     * `floor(size/2)`, which is where every apply() loop centres its stamp.
     * @param {number[][]} mask
     * @param {number} size
     * @returns {Array<{dx: number, dy: number}>}
     */
    maskOffsets(mask, size) {
        const n = Math.max(1, Math.round(size));
        const offset = Math.floor(n / 2);
        const out = [];
        for (let dy = 0; dy < n; dy++) {
            if (!mask[dy]) continue;
            for (let dx = 0; dx < n; dx++) {
                if (mask[dy][dx] > 0) out.push({ dx: dx - offset, dy: dy - offset });
            }
        }
        return out;
    },

    /**
     * Every cell of the size x size box, as centre-relative offsets — the
     * envelope for brushes that walk the whole box (the crosshatches, the
     * pattern reveal, the Poisson scatter).
     * @param {number} size
     * @returns {Array<{dx: number, dy: number}>}
     */
    boxOffsets(size) {
        const n = Math.max(1, Math.round(size));
        const offset = Math.floor(n / 2);
        const out = [];
        for (let dy = 0; dy < n; dy++) {
            for (let dx = 0; dx < n; dx++) {
                out.push({ dx: dx - offset, dy: dy - offset });
            }
        }
        return out;
    },

    /**
     * Radial exponent for a scatter weighting.
     *
     * A particle's distance from the centre is `radius * u^p` for a uniform u.
     * p = 0.5 spreads the particles EVENLY over the disc's area (equal ink per
     * square pixel); p = 1.0 spreads them evenly along the radius, which piles
     * them up in the middle because the inner rings have less area to fill.
     * The old Stipple brush was the former, the old Spray brush the latter —
     * that difference, and nothing else, is what this slider now exposes.
     *
     * `p = 0.5 * 2^(weighting/100)` maps -100 -> 0.25 (rim-biased), 0 -> 0.5
     * (even, the default), +100 -> 1.0 (the historical spray).
     *
     * @param {number} weighting - -100 (rim) .. 0 (even) .. +100 (centre)
     * @returns {number}
     */
    weightExponent(weighting) {
        const w = clamp(Number(weighting) || 0, -100, 100);
        return 0.5 * Math.pow(2, w / 100);
    },

    /**
     * Scatter `count` particles inside a disc of `radius`, as integer offsets
     * from the stamp centre. Offsets may repeat — that is real: two particles
     * landing on one pixel is what makes a spray build up.
     *
     * @param {number} radius - In pixels (see radiusFor for the brush-size form)
     * @param {number} weighting - -100 (rim) .. 0 (even) .. +100 (centre)
     * @param {number} count - Particles to place
     * @param {Function} [rng] - Injectable source of [0, 1) for tests
     * @returns {Array<{dx: number, dy: number}>}
     */
    scatterPoints(radius, weighting, count, rng = Math.random) {
        const n = Math.max(0, Math.floor(count));
        const r = Math.max(0, radius);
        const p = BrushShapes.weightExponent(weighting);
        const out = [];

        for (let i = 0; i < n; i++) {
            const angle = rng() * 2 * Math.PI;
            const dist = r * Math.pow(rng(), p);
            out.push({
                dx: Math.round(Math.cos(angle) * dist),
                dy: Math.round(Math.sin(angle) * dist)
            });
        }
        return out;
    },

    /**
     * Every cell a `scatterPoints(radius, ...)` particle can land in — the
     * hover outline for any scattering brush, and a hard upper bound the
     * footprint tests hold the sampler to.
     *
     * NOT simply `dx^2 + dy^2 <= radius^2`: the sampler picks a real point
     * inside the circle and then rounds each axis INDEPENDENTLY, so a point
     * inside can round to a cell outside — at 45 degrees both axes gain half a
     * pixel at once (r = 4: a point at distance 3.99 rounds to (3, 3), whose
     * distance is 4.24). A cell is reachable exactly when the nearest corner of
     * its rounding square lies inside the circle, which is what the
     * `max(0, |d| - 0.5)` terms measure. A tighter disc here would leave the
     * outermost particles landing outside their own outline.
     *
     * @param {number} radius
     * @returns {Array<{dx: number, dy: number}>}
     */
    scatterEnvelope(radius) {
        const r = Math.max(0, radius);
        if (r < 0.5) return [{ dx: 0, dy: 0 }];   // every particle rounds to the centre

        const rr = r * r;
        const reach = Math.ceil(r) + 1;           // rounding gains at most half a pixel per axis
        const out = [];

        for (let dy = -reach; dy <= reach; dy++) {
            for (let dx = -reach; dx <= reach; dx++) {
                const nx = Math.max(0, Math.abs(dx) - 0.5);
                const ny = Math.max(0, Math.abs(dy) - 0.5);
                if (nx * nx + ny * ny < rr) out.push({ dx, dy });
            }
        }
        return out;
    },

    /**
     * The curated hatch directions — every angle that renders as clean, evenly
     * spaced lines on this grid. Each is an integer direction (a, b); the
     * angles BETWEEN these stair-step into irregular jaggies that read as
     * noise rather than as hatching, which is why the angle is a choice from
     * this set and never a free variable. `deg` labels the UI only.
     *
     * 16 directions (doubled from the original 8, 2026-08-22): every a/b pair
     * with |a|,|b| <= 3, one Farey mediant slotted between each original
     * neighbour (e.g. (3,1) between (1,0) and (2,1)). Denominator 4+ was
     * tried and rejected — at this canvas's resolution those slopes read as
     * noise, the same call the original 8 already made. This is the ONE
     * list: the fixed-angle dropdown (`HATCH_ANGLE_OPTS` in brush-tool.js)
     * and 'follow' mode (`snapHatchAngle` below) both read it directly, so
     * there is no second place that can fall behind.
     */
    HATCH_ANGLES: Object.freeze([
        Object.freeze({ id: '0',   a:  1, b: 0, deg: 0 }),
        Object.freeze({ id: '18',  a:  3, b: 1, deg: 18.4 }),
        Object.freeze({ id: '27',  a:  2, b: 1, deg: 26.6 }),
        Object.freeze({ id: '34',  a:  3, b: 2, deg: 33.7 }),
        Object.freeze({ id: '45',  a:  1, b: 1, deg: 45 }),
        Object.freeze({ id: '56',  a:  2, b: 3, deg: 56.3 }),
        Object.freeze({ id: '63',  a:  1, b: 2, deg: 63.4 }),
        Object.freeze({ id: '72',  a:  1, b: 3, deg: 71.6 }),
        Object.freeze({ id: '90',  a:  0, b: 1, deg: 90 }),
        Object.freeze({ id: '108', a: -1, b: 3, deg: 108.4 }),
        Object.freeze({ id: '117', a: -1, b: 2, deg: 116.6 }),
        Object.freeze({ id: '124', a: -2, b: 3, deg: 123.7 }),
        Object.freeze({ id: '135', a: -1, b: 1, deg: 135 }),
        Object.freeze({ id: '146', a: -3, b: 2, deg: 146.3 }),
        Object.freeze({ id: '153', a: -2, b: 1, deg: 153.4 }),
        Object.freeze({ id: '162', a: -3, b: 1, deg: 161.6 })
    ]),

    /**
     * The direction for a hatch-angle id, defaulting to 45 degrees.
     * @param {string} id
     * @returns {{a: number, b: number, id: string, deg: number}}
     */
    hatchDirection(id) {
        return BrushShapes.HATCH_ANGLES.find(h => h.id === id) ||
            BrushShapes.HATCH_ANGLES.find(h => h.id === '45');
    },

    /**
     * Is this CANVAS pixel on the hatch?
     *
     * Anchored to absolute canvas coordinates, never to the stamp box: that is
     * what makes a dragged stroke one continuous set of lines instead of a
     * moire of stamps that each restart the pattern, and what makes a SECOND
     * pass at another angle interlock with the first into a true cross-hatch.
     *
     * Ink coverage is `thickness / spacing` (to integer-rounding) at EVERY
     * angle — the projection `-b*px + a*py` visits each residue equally
     * often on any one row, because one of its coefficients is always +/-1.
     * So the two dials are a tone control by construction, the same
     * guarantee the ordered pattern ramp makes, rather than something
     * eyeballed per angle.
     *
     * That projection's own unit step covers `len = hypot(a, b)` PIXELS of
     * real on-screen distance perpendicular to the line, not one — a 45deg
     * pass has len=1.41, a shallow one like 18deg has len=3.16. Left alone,
     * the same spacing/thickness numbers would then draw 45deg lines ~41%
     * closer together than 0deg ones, and the shallowest angles up to 3.16x
     * closer — which is exactly why they used to look nearly solid. `spacing`
     * and `thickness` are scaled by `len` before use so the dials mean the
     * same physical on-screen distance at every angle (0/90, len=1, are
     * unchanged); the trade is that at the smallest `spacing` values the
     * tone ratio can drift a few percent off its nominal value, the ordinary
     * cost of fitting a rational fraction onto a small integer period.
     *
     * @param {number} px - Canvas X
     * @param {number} py - Canvas Y
     * @param {{a: number, b: number}} dir - A HATCH_ANGLES direction
     * @param {number} spacing - Distance between line starts (>= 2)
     * @param {number} thickness - Line width, clamped to <= spacing
     * @returns {boolean}
     */
    onHatchLine(px, py, dir, spacing, thickness) {
        const len = Math.hypot(dir.a, dir.b);
        const s = Math.max(2, Math.round(spacing * len));
        const t = clamp(Math.round(thickness * len), 1, s);
        const v = -dir.b * px + dir.a * py;
        return (((v % s) + s) % s) < t;
    },

    /**
     * Snap a movement vector onto the nearest hatch angle — the "follow the
     * stroke" mode. Hatch lines are UNDIRECTED, so the match is on |cos|:
     * sweeping left or right along one axis yields the same hatch.
     *
     * `currentId` + `margin` give hysteresis. Without it a hand wobbling on the
     * boundary between two neighbouring angles would flicker between them every
     * few pixels; the angle only changes once a new candidate is clearly better.
     *
     * The default margin must stay below the smallest score gap between any
     * exact match and its closest neighbour in HATCH_ANGLES (~0.0077 for the
     * 16-angle set, computed from the tightest ~7deg spacing) — otherwise a
     * `currentId` left over from a PREVIOUS stroke (HatchBrush never resets
     * `_followId` itself, only the tracking that feeds it) can outrank a
     * movement that is exactly, unambiguously aligned with a different
     * candidate, and 'follow' mode gets stuck on the last stroke's angle.
     * That headroom shrank when the angle set doubled (was 0.06 against 8
     * angles ~22.5deg apart); this default shrank with it.
     *
     * @param {number} dx @param {number} dy - Smoothed movement vector
     * @param {string|null} currentId - The angle currently held
     * @param {number} [margin] - How much better a rival must be to win
     * @returns {string|null} An angle id, or null when the vector is too short
     *                        to carry a direction (caller holds what it had)
     */
    snapHatchAngle(dx, dy, currentId = null, margin = 0.005) {
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) return null;

        const ux = dx / len, uy = dy / len;
        let best = null, bestScore = -1, currentScore = -1;

        for (const h of BrushShapes.HATCH_ANGLES) {
            const hl = Math.sqrt(h.a * h.a + h.b * h.b);
            const score = Math.abs((h.a * ux + h.b * uy) / hl);
            if (score > bestScore) { bestScore = score; best = h.id; }
            if (h.id === currentId) currentScore = score;
        }

        if (currentScore >= 0 && bestScore - currentScore < margin) return currentId;
        return best;
    },

    /**
     * Poisson-disk sample of the size x size box: points no closer than
     * `minDistance`, grown from one random seed (Bridson-style). Even spacing,
     * no clumps — the blue-noise scatter the Spray brush stamps in its
     * `poisson` distribution. O(n^2) in the point count, so callers pool the
     * result per size rather than sampling on every stamp.
     *
     * Points are box coordinates in [0, size); the brush clamps and centres
     * them. rng is injectable so the sampler is Node-testable like scatterPoints.
     *
     * @param {number} size - Box side in pixels
     * @param {number} minDistance - Minimum spacing between points (>= 1)
     * @param {number} [maxAttempts=30] - Candidate tries per active point
     * @param {Function} [rng=Math.random] - Injectable source of [0, 1)
     * @returns {Array<{x: number, y: number}>}
     */
    poissonDisk(size, minDistance, maxAttempts = 30, rng = Math.random) {
        const n = Math.max(1, Math.round(size));
        const minD = Math.max(1, minDistance);
        const minSq = minD * minD;
        const points = [{ x: rng() * n, y: rng() * n }];
        const active = [0];

        const farEnough = (x, y) => {
            for (const p of points) {
                const dx = x - p.x, dy = y - p.y;
                if (dx * dx + dy * dy < minSq) return false;
            }
            return true;
        };

        while (active.length > 0) {
            const ai = Math.floor(rng() * active.length);
            const origin = points[active[ai]];
            let found = false;

            for (let i = 0; i < maxAttempts; i++) {
                const angle = rng() * 2 * Math.PI;
                const radius = minD * (1 + rng());
                const nx = origin.x + Math.cos(angle) * radius;
                const ny = origin.y + Math.sin(angle) * radius;
                if (nx >= 0 && nx < n && ny >= 0 && ny < n && farEnough(nx, ny)) {
                    points.push({ x: nx, y: ny });
                    active.push(points.length - 1);
                    found = true;
                    break;
                }
            }
            if (!found) active.splice(ai, 1);
        }
        return points;
    }
};

window.BrushShapes = BrushShapes;

})(); // End IIFE
