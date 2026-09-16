'use strict';
/**
 * The hardware brush cursor's geometry (CursorImage - pure, no DOM).
 *
 * One brush pixel is one canvas pixel at every zoom, the image stays inside
 * Chrome's 128 DIP cap or is refused, and the hotspot lands the image's grid
 * on the canvas grid.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/cursor-image.js');

const one = [{ x: 10, y: 20, colour: 'rgb(1,2,3)' }];
const square = (n) => {
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push({ x: 50 + x, y: 60 + y, colour: 'red' });
  return out;
};

// --- one pixel is one canvas pixel at every zoom ----------------------------

for (const [zoom, dpr, dev, dip] of [[1, 1, 1, 1], [4, 1, 4, 4], [8, 1, 8, 8], [2, 2, 4, 2], [4, 1.5, 6, 4]]) {
  const p = CursorImage.plan(one, zoom, dpr);
  check(`size 1 at scale ${zoom}, dpr ${dpr}: ${dev} device px, ${dip} DIP`,
    p.devW === dev && p.devH === dev && p.wDip === dip && p.hDip === dip && p.fits);
}

{
  const p = CursorImage.plan(square(8), 4, 1);
  check('an 8x8 footprint at 400% is 32 DIP, one cell per canvas pixel',
    p.cols === 8 && p.rows === 8 && p.cellDev === 4 && p.wDip === 32);
}

// --- the 128 DIP cap ---------------------------------------------------------

check('32 pixels at 400% is exactly 128 DIP: kept', CursorImage.plan(square(32), 4, 1).fits === true);
check('33 pixels at 400% is 132 DIP: refused', CursorImage.plan(square(33), 4, 1).fits === false);
check('the cap is in DIP, not device px: 64 at 200% on a 2x display is kept',
  CursorImage.plan(square(64), 2, 2).fits === true);

// --- hotspot -----------------------------------------------------------------

{
  const p = CursorImage.plan(square(8), 4, 1);           // image covers x 50..57
  const h = CursorImage.hotspot(p, 54.25, 63.5, 4);
  check('hotspot is the pointer offset inside the image, in DIP', h.x === 17 && h.y === 14);
  check('a pointer outside the image has no hotspot', CursorImage.hotspot(p, 49.9, 63, 4) === null);
}

// --- viewport ---------------------------------------------------------------

{
  const p = CursorImage.plan(square(8), 4, 1);           // 32x32 DIP
  const hot = { x: 16, y: 16 };
  check('fully inside the viewport: kept', CursorImage.insideViewport(p, hot, 100, 100, 800, 600));
  check('crossing the left edge: dropped', !CursorImage.insideViewport(p, hot, 10, 100, 800, 600));
  check('crossing the bottom edge: dropped', !CursorImage.insideViewport(p, hot, 100, 590, 800, 600));
}

// --- key and CSS ---------------------------------------------------------------

{
  const a = CursorImage.plan([{ x: 1, y: 1, colour: 'red' }], 4, 1);
  const b = CursorImage.plan([{ x: 9, y: 7, colour: 'red' }], 4, 1);
  const c = CursorImage.plan([{ x: 9, y: 7, colour: 'blue' }], 4, 1);
  check('the same image at a different place shares a cache key', a.key === b.key);
  check('a different colour does not', b.key !== c.key);
  check('CSS at dpr 1 is a plain url with the hotspot',
    CursorImage.cssValue('data:x', 1, { x: 3, y: 4 }) === 'url("data:x") 3 4, none');
  check('CSS at dpr 2 declares the resolution',
    CursorImage.cssValue('data:x', 2, { x: 3, y: 4 }) === 'image-set(url("data:x") 2x) 3 4, none');
}

summary('cursor-image');
