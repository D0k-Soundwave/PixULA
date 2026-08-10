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
     * @param {number} size - Diameter in pixels
     * @returns {number[][]} row-major mask
     */
    disc(size) {
        const n = Math.max(1, Math.round(size));
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
     */
    HATCH_ANGLES: Object.freeze([
        Object.freeze({ id: '0',   a:  1, b: 0, deg: 0 }),
        Object.freeze({ id: '27',  a:  2, b: 1, deg: 26.6 }),
        Object.freeze({ id: '45',  a:  1, b: 1, deg: 45 }),
        Object.freeze({ id: '63',  a:  1, b: 2, deg: 63.4 }),
        Object.freeze({ id: '90',  a:  0, b: 1, deg: 90 }),
        Object.freeze({ id: '117', a: -1, b: 2, deg: 116.6 }),
        Object.freeze({ id: '135', a: -1, b: 1, deg: 135 }),
        Object.freeze({ id: '153', a: -2, b: 1, deg: 153.4 })
    ]),

    /**
     * The direction for a hatch-angle id, defaulting to 45 degrees.
     * @param {string} id
     * @returns {{a: number, b: number, id: string, deg: number}}
     */
    hatchDirection(id) {
        return BrushShapes.HATCH_ANGLES.find(h => h.id === id) || BrushShapes.HATCH_ANGLES[2];
    },

    /**
     * Is this CANVAS pixel on the hatch?
     *
     * Anchored to absolute canvas coordinates, never to the stamp box: that is
     * what makes a dragged stroke one continuous set of lines instead of a
     * moire of stamps that each restart the pattern, and what makes a SECOND
     * pass at another angle interlock with the first into a true cross-hatch.
     *
     * Ink coverage is exactly `thickness / spacing` at EVERY angle — the
     * projection `-b*px + a*py` visits each residue equally often, because one
     * of its coefficients is always +/-1. So the two dials are an exact tone
     * control by construction, the same guarantee the ordered pattern ramp
     * makes, rather than something eyeballed per angle.
     *
     * @param {number} px - Canvas X
     * @param {number} py - Canvas Y
     * @param {{a: number, b: number}} dir - A HATCH_ANGLES direction
     * @param {number} spacing - Distance between line starts (>= 2)
     * @param {number} thickness - Line width, clamped to <= spacing
     * @returns {boolean}
     */
    onHatchLine(px, py, dir, spacing, thickness) {
        const s = Math.max(2, Math.round(spacing));
        const t = clamp(Math.round(thickness), 1, s);
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
     * @param {number} dx @param {number} dy - Smoothed movement vector
     * @param {string|null} currentId - The angle currently held
     * @param {number} [margin] - How much better a rival must be to win
     * @returns {string|null} An angle id, or null when the vector is too short
     *                        to carry a direction (caller holds what it had)
     */
    snapHatchAngle(dx, dy, currentId = null, margin = 0.06) {
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
