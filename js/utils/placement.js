'use strict';
(function() {

/**
 * Placement - where a picture sits on the screen: scale (percent of its own size, negative mirrors it), offset (the
 * top-left of the scaled picture, in screen pixels), rotation (degrees about its centre) and two flips.
 *
 * One description for the two places a picture is laid on the screen: the Reference layer (traced over the canvas)
 * and the Import dialog (converted into it). Both used to own the Fit / Fill sums; they are here once, and so is the
 * drawing, so a placement copied from the reference lands the import on exactly the same pixels.
 *
 * Pure apart from draw(), which needs a 2D context; Node can test the rest.
 */
class PlacementClass {
    /** The picture at its own size, top-left on the screen, unturned. */
    identity() {
        return { scale: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false };
    }

    /**
     * The scale, in percent, that makes a w x h picture fit the screen ('contain': all of it shows, with bars) or fill
     * it ('cover': no bars, the overhang cut). Anything else is 100.
     */
    fitScale(mode, w, h, outW = ZX_SPECTRUM.WIDTH, outH = ZX_SPECTRUM.HEIGHT) {
        if (!w || !h) return 100;
        if (mode === 'contain') return Math.min(outW / w, outH / h) * 100;
        if (mode === 'cover') return Math.max(outW / w, outH / h) * 100;
        return 100;
    }

    /** The offset that puts a w x h picture, at `scale` percent, in the middle of the screen. */
    centredOffset(scale, w, h, outW = ZX_SPECTRUM.WIDTH, outH = ZX_SPECTRUM.HEIGHT) {
        const s = scale / 100;
        return { x: (outW - w * s) / 2, y: (outH - h * s) / 2 };
    }

    /** A whole placement for Fit ('contain') or Fill ('cover'): centred, unturned, the flips kept from `from`. */
    fitted(mode, w, h, from = null, outW = ZX_SPECTRUM.WIDTH, outH = ZX_SPECTRUM.HEIGHT) {
        const scale = this.fitScale(mode, w, h, outW, outH);
        const o = this.centredOffset(scale, w, h, outW, outH);
        return { scale, offsetX: o.x, offsetY: o.y, rotation: 0,
            flipX: !!(from && from.flipX), flipY: !!(from && from.flipY) };
    }

    /**
     * The placement that puts a picture of size (w, h) where another picture of size (refW, refH) sits under
     * `ref`: the same centre, rotation and flips, scaled to fit inside the box the other one covers. For the same
     * picture this is `ref` itself; for a different one it is the nearest match that keeps its proportions.
     */
    matching(ref, refW, refH, w, h) {
        if (!ref || !refW || !refH || !w || !h) return null;
        const scale = ref.scale * Math.min(refW / w, refH / h);
        const s = ref.scale / 100, t = scale / 100;
        const cx = ref.offsetX + refW * s / 2, cy = ref.offsetY + refH * s / 2;
        return { scale, offsetX: cx - w * t / 2, offsetY: cy - h * t / 2,
            rotation: ref.rotation || 0, flipX: !!ref.flipX, flipY: !!ref.flipY };
    }

    /**
     * Draw `image` (w x h) under placement `p`. `k` multiplies the whole layout, for a target that is a whole multiple
     * of the screen size (the Sharp conversion's high-resolution copy). The caller owns the context's other state
     * (alpha, smoothing); this saves and restores the transform only.
     *
     * The centre is offset + size/2 with the SIGNED size, as the Reference layer has always drawn it: a negative scale
     * flips the source through drawImage's negative width.
     */
    draw(ctx, image, w, h, p, k = 1) {
        const s = p.scale / 100;
        const iw = w * s * k, ih = h * s * k;
        ctx.save();
        ctx.translate(p.offsetX * k + iw / 2, p.offsetY * k + ih / 2);
        if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(p.flipX ? -1 : 1, p.flipY ? -1 : 1);
        ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
        ctx.restore();
    }
}

window.Placement = new PlacementClass();

})(); // End IIFE
