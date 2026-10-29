'use strict';
/**
 * AnimationService - the rules that need no layers: window sizes rounded to
 * cells, the order frames play in (Loop, Once, Ping-pong, a range), how long
 * each stays on screen, and the delay guard. The layer side (frames, undo
 * across frames, merges, saving) is checked in the real app by
 * tests/browser/animation.spec.js.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({ EventBus: { emit() {}, on() {} } });
loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/services/animation-service.js');

const A = AnimationServiceClass;
const S = new A();
const same = (r, cx, cy, cw, ch) => r && r.cx === cx && r.cy === cy && r.cw === cw && r.ch === ch;

// ── Windows are whole cells ─────────────────────────────────────────────────
check('a 16 x 16 block at 64,64 is 2 x 2 cells at cell 8,8 (Standard)', same(A.rectFromPixels(64, 64, 16, 16), 8, 8, 2, 2));
check('a 20 x 20 block rounds UP to 3 x 3 cells (24 x 24)', same(A.rectFromPixels(0, 0, 20, 20), 0, 0, 3, 3));
check('the position rounds DOWN to the cell it is in', same(A.rectFromPixels(13, 9, 8, 8), 1, 1, 1, 1));
check('a block past the right and bottom edge is pulled back onto the screen', same(A.rectFromPixels(250, 190, 16, 16), 30, 22, 2, 2));
check('a block bigger than the screen is the whole screen', same(A.rectFromPixels(0, 0, 999, 999), 0, 0, 32, 24));
check('a zero size still gives one cell', same(A.rectFromPixels(0, 0, 0, 0), 0, 0, 1, 1));
check('a selection covers every cell it touches', same(A.rectFromSelection({ x: 64, y: 64, width: 13, height: 9 }), 8, 8, 2, 2));
check('a selection starting mid-cell takes that cell too', same(A.rectFromSelection({ x: 7, y: 7, width: 2, height: 2 }), 0, 0, 2, 2));
check('no selection, no window', A.rectFromSelection(null) === null && A.rectFromSelection({ x: 0, y: 0, width: 0, height: 4 }) === null);

__setActiveScreenMode('multicolor_8x1');
check('8x1 cells: 20 x 20 becomes 24 wide and 20 high', same(A.rectFromPixels(0, 0, 20, 20), 0, 0, 3, 20));
__setActiveScreenMode('layer2_640');
check('Layer 2 640 storage cells are 8 x 8: 12 x 12 becomes 16 x 16', same(A.rectFromPixels(0, 0, 12, 12), 0, 0, 2, 2));
__setActiveScreenMode('standard_ula');

// ── Play order ──────────────────────────────────────────────────────────────
const anim = (n, delay = 5) => ({ frames: Array.from({ length: n }, () => ({ delayTicks: delay })), current: 0 });
const run = (a, steps) => {
    const seen = [];
    let i = 0;
    for (let s = 0; s < steps; s++) { i = S.nextIndex(a, i); seen.push(i); if (i < 0) break; }
    return seen.join(',');
};
S.setRepeat('loop'); S.setRange(0, null); S._dir = 1;
check('Loop runs 0..3 and starts again', run(anim(4), 6) === '1,2,3,0,1,2');
S.setRepeat('once'); S._dir = 1;
check('Once stops after the last frame', run(anim(4), 6) === '1,2,3,-1');
S.setRepeat('pingpong'); S._dir = 1;
check('Ping-pong turns at both ends without repeating them', run(anim(4), 8) === '1,2,3,2,1,0,1,2');
S.setRepeat('loop'); S.setRange(1, 2); S._dir = 1;
check('A range plays only its frames', run(anim(5), 5) === '1,2,1,2,1');
check('A frame outside the range goes to the start of the range', S.nextIndex(anim(5), 4) === 1);
S.setRange(3, 1);
check('A range typed backwards is read the right way round', JSON.stringify(S.getRange(anim(5))) === '{"from":1,"to":3}');
S.setRange(0, 99);
check('A range past the end stops at the last frame', S.getRange(anim(3)).to === 2);
S.setRange(0, null);

// ── Timing ──────────────────────────────────────────────────────────────────
check('One tick is 20 ms (the Spectrum\'s 50 Hz)', A.TICK_MS === 20);
S.setSpeed(1);
check('A 5-tick frame shows for 100 ms at x1', S.frameDuration(anim(2, 5), 0) === 100);
S.setSpeed(2);
check('...for 50 ms at x2 (speed never changes the delay)', S.frameDuration(anim(2, 5), 0) === 50);
S.setSpeed(4);
check('A 1-tick frame at x4 still shows for one tick', S.frameDuration(anim(2, 1), 0) === 20);
S.setSpeed(0.25);
check('...and for 4 ticks at x0.25', S.frameDuration(anim(2, 1), 0) === 80);
S.setSpeed(0);
check('A speed of 0 is refused', S.getSpeed() === 0.25);

// ── Delays ──────────────────────────────────────────────────────────────────
check('A delay is a whole number of ticks, at least 1', A.clampDelay(0) === 1 && A.clampDelay(2.6) === 3 && A.clampDelay(-5) === 1);
check('Nonsense gives the default delay', A.clampDelay('abc') === A.DEFAULT_DELAY_TICKS);
check('A huge delay is held to the largest', A.clampDelay(1e9) === A.MAX_DELAY_TICKS);

summary();
