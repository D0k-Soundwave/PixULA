'use strict';
/**
 * Placement - the one description of where a picture sits on the screen, shared by the Reference layer and the
 * Import dialog. The sums are pure; draw() is checked against a recording context, and against the transform the
 * Reference layer drew with before it moved here, so moving it changed nothing.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/placement.js');
const P = window.Placement;
const near = (a, b) => Math.abs(a - b) < 1e-9;

__setActiveScreenMode('standard_ula');

// -- Fit and Fill --------------------------------------------------------------------------------------------------
check('contain: a 512x192 picture fits at 50%', near(P.fitScale('contain', 512, 192), 50));
check('cover: a 512x192 picture fills at 100%', near(P.fitScale('cover', 512, 192), 100));
check('contain: a 128x96 picture fits at 200%', near(P.fitScale('contain', 128, 96), 200));
check('anything else is natural size', P.fitScale('stretch', 512, 192) === 100 && P.fitScale('none', 10, 10) === 100);
check('a zero-sized picture is natural size, not Infinity', P.fitScale('contain', 0, 0) === 100);

const c = P.centredOffset(50, 512, 192);
check('centred: 512x192 at 50% sits 0,48 (256x96 in the middle)', near(c.x, 0) && near(c.y, 48));
const neg = P.centredOffset(-50, 512, 192);
check('centred: a mirrored scale centres too (signed size, centre at the middle)',
  near(neg.x + 512 * -0.5 / 2, 128) && near(neg.y + 192 * -0.5 / 2, 96));

const f = P.fitted('cover', 100, 100, { flipX: true, flipY: false, rotation: 33 });
check('fitted: Fill a square is 256% (the wider side), centred, unturned',
  near(f.scale, 256) && near(f.offsetX, 0) && near(f.offsetY, -32) && f.rotation === 0);
check('fitted: the flips are kept', f.flipX === true && f.flipY === false);

// -- matching another picture's placement --------------------------------------------------------------------------
const ref = { scale: 40, offsetX: 10, offsetY: -5, rotation: 30, flipX: true, flipY: false };
const same = P.matching(ref, 800, 600, 800, 600);
check('matching: the same picture gets the same placement',
  near(same.scale, 40) && near(same.offsetX, 10) && near(same.offsetY, -5) && same.rotation === 30 && same.flipX);
const half = P.matching(ref, 800, 600, 400, 300);
check('matching: a half-size copy is scaled up to cover the same pixels',
  near(half.scale, 80) && near(half.offsetX, 10) && near(half.offsetY, -5));
const tall = P.matching(ref, 800, 600, 300, 600);
const centre = (p, w, h) => [p.offsetX + w * p.scale / 100 / 2, p.offsetY + h * p.scale / 100 / 2];
check('matching: a different shape keeps the centre and fits inside the box',
  near(centre(tall, 300, 600)[0], centre(ref, 800, 600)[0]) && near(centre(tall, 300, 600)[1], centre(ref, 800, 600)[1]) &&
  near(600 * tall.scale / 100, 600 * 0.4));
check('matching: nothing to match is null', P.matching(ref, 0, 0, 10, 10) === null && P.matching(null, 1, 1, 1, 1) === null);

// -- draw ----------------------------------------------------------------------------------------------------------
const recorder = () => {
  const calls = [];
  const ctx = {};
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'drawImage']) {
    ctx[name] = (...args) => calls.push([name, ...args]);
  }
  return { ctx, calls };
};
const img = { tag: 'image' };

// The Reference layer's _render before the move, verbatim in its sums
const oldRender = (ctx, w, h, s) => {
  const scaleValue = s.scale / 100;
  const imgWidth = w * scaleValue, imgHeight = h * scaleValue;
  ctx.save();
  ctx.translate(s.offsetX + imgWidth / 2, s.offsetY + imgHeight / 2);
  if (s.rotation !== 0) ctx.rotate((s.rotation * Math.PI) / 180);
  ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1);
  ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
  ctx.restore();
};
for (const s of [ref, { scale: -60, offsetX: 3, offsetY: 4, rotation: 0, flipX: false, flipY: true },
                 { scale: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false }]) {
  const a = recorder(), b = recorder();
  P.draw(a.ctx, img, 640, 480, s);
  oldRender(b.ctx, 640, 480, s);
  check(`draw: the same calls as the Reference layer always made (scale ${s.scale}, rotation ${s.rotation})`,
    JSON.stringify(a.calls) === JSON.stringify(b.calls), JSON.stringify(a.calls));
}

const k2 = recorder(), k1 = recorder();
P.draw(k2.ctx, img, 640, 480, ref, 2);
P.draw(k1.ctx, img, 640, 480, ref, 1);
const t2 = k2.calls.find((x) => x[0] === 'translate'), t1 = k1.calls.find((x) => x[0] === 'translate');
const d2 = k2.calls.find((x) => x[0] === 'drawImage'), d1 = k1.calls.find((x) => x[0] === 'drawImage');
check('draw: k doubles the whole layout (for the Sharp copy at twice the screen)',
  near(t2[1], t1[1] * 2) && near(t2[2], t1[2] * 2) && near(d2[4], d1[4] * 2) && near(d2[5], d1[5] * 2));

check('identity is natural size at the origin', JSON.stringify(P.identity()) ===
  JSON.stringify({ scale: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false }));

summary();
