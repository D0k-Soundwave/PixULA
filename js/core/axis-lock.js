'use strict';
(function() {

/**
 * AxisLock - hold X or Y while dragging to keep the stroke on one axis (Batch 7 part 7C2). ZX Paintbrush's X and Y keys:
 * X keeps the line horizontal (the y stays where it was), Y keeps it vertical.
 *
 * Pure bookkeeping, no DOM: InputHandler feeds it key events and the points of a stroke, and draws with the projected
 * points, so every tool - and its preview - only ever sees points on the axis.
 *
 *  - The line runs through the point where the lock took effect: the press point if the key was already down, otherwise
 *    the last point delivered when it went down. Pressing the other key re-anchors there and switches the axis (the key
 *    pressed last wins). Releasing the last key frees the stroke; its next point joins with a straight segment.
 *  - A key tapped without a stroke using it is a TAP (keyUp returns 'tap'): bare X still swaps ink and paper, but on the
 *    key coming UP, so that holding it can lock an axis instead of flickering the colours on every auto-repeat.
 *  - Auto-repeat is ignored. reset() clears everything (window blur, tab hidden).
 */
class AxisLockClass {
    constructor() {
        this.reset();
    }

    reset() {
        this._down = [];        // keys held, in the order they went down
        this._tap = {};         // key -> true while nothing has used it
        this._stroke = false;
        this._anchor = null;
        this._last = null;
    }

    /** @returns {boolean} whether the key is one of ours */
    static isAxisKey(key) {
        const k = String(key || '').toLowerCase();
        return k === 'x' || k === 'y';
    }

    /**
     * A key went down.
     * @param {string} key
     * @param {boolean} repeat - KeyboardEvent.repeat
     * @returns {boolean} whether the key is X or Y (and so was taken)
     */
    keyDown(key, repeat) {
        if (!AxisLockClass.isAxisKey(key)) return false;
        const k = key.toLowerCase();
        if (repeat || this._down.includes(k)) return true;
        this._down.push(k);
        this._tap[k] = true;
        // The lock starts (or changes axis) HERE, at the last point the stroke delivered.
        if (this._stroke) this._anchor = this._last ? { x: this._last.x, y: this._last.y } : null;
        return true;
    }

    /**
     * A key came up.
     * @returns {?string} 'tap' if nothing used the key while it was down, else null (also for keys not held)
     */
    keyUp(key) {
        if (!AxisLockClass.isAxisKey(key)) return null;
        const k = key.toLowerCase();
        const i = this._down.indexOf(k);
        if (i < 0) return null;
        const wasTap = this._tap[k] === true;
        this._down.splice(i, 1);
        delete this._tap[k];
        if (this._stroke) {
            this._anchor = this._down.length && this._last ? { x: this._last.x, y: this._last.y } : null;
        }
        return wasTap ? 'tap' : null;
    }

    /** The axis in force: 'x' (keeps y), 'y' (keeps x) or null. The key pressed last wins. */
    axis() {
        return this._down.length ? this._down[this._down.length - 1] : null;
    }

    /** A stroke began at `point`. */
    beginStroke(point) {
        this._stroke = true;
        this._last = { x: point.x, y: point.y };
        this._anchor = this.axis() ? { x: point.x, y: point.y } : null;
    }

    /** The stroke ended. */
    endStroke() {
        this._stroke = false;
        this._anchor = null;
        this._last = null;
    }

    /**
     * The point to use for `p`: on the locked axis, or `p` itself when nothing is held.
     * @returns {{x:number,y:number}}
     */
    project(p) {
        const ax = this.axis();
        if (!this._stroke || !ax) {
            this._last = { x: p.x, y: p.y };
            return p;
        }
        if (!this._anchor) this._anchor = this._last ? { x: this._last.x, y: this._last.y } : { x: p.x, y: p.y };
        for (const k of this._down) this._tap[k] = false;      // a stroke used the key: not a tap
        const out = ax === 'x' ? { x: p.x, y: this._anchor.y } : { x: this._anchor.x, y: p.y };
        this._last = out;
        return out;
    }
}

window.AxisLock = new AxisLockClass();
window.AxisLockClass = AxisLockClass;

})();
