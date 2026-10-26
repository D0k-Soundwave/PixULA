'use strict';
/**
 * Batch 7 part 7C2: AxisLock - the X and Y keys held while dragging. Pure bookkeeping, so tested without a browser:
 * every projected point lies on the axis; the line runs through the press point (or the point where the key went down);
 * the key pressed last wins and re-anchors; a tapped key is a TAP; auto-repeat is ignored; reset clears.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
loadModule('js/core/axis-lock.js');

const A = () => new AxisLockClass();
const p = (x, y) => ({ x, y });
const same = (a, b) => a.x === b.x && a.y === b.y;

{
  const L = A();
  L.keyDown('x', false);
  L.beginStroke(p(10, 20));
  const out = [p(15, 22), p(30, 5), p(2, 90)].map(q => L.project(q));
  check('X held at the press: every point keeps the press y (horizontal)', out.every(o => o.y === 20));
  check('...and follows the pointer in x', out[0].x === 15 && out[1].x === 30 && out[2].x === 2);
  check('releasing X after the stroke used it is not a tap', L.keyUp('x') === null);
}
{
  const L = A();
  L.keyDown('y', false);
  L.beginStroke(p(10, 20));
  const out = [p(15, 22), p(30, 5)].map(q => L.project(q));
  check('Y held at the press: every point keeps the press x (vertical)', out.every(o => o.x === 10) && out[1].y === 5);
}
{
  const L = A();
  L.beginStroke(p(10, 20));
  const a = L.project(p(15, 22));
  check('no key: points pass through untouched', a.x === 15 && a.y === 22);
  L.project(p(40, 50));                       // last delivered point (40,50)
  L.keyDown('x', false);                      // X goes down mid-stroke
  const b = L.project(p(60, 9));
  check('X pressed mid-stroke anchors at the last point delivered', b.x === 60 && b.y === 50);
  L.keyUp('x');
  const c = L.project(p(70, 12));
  check('releasing frees the stroke: the next point is the real one', same(c, p(70, 12)));
}
{
  const L = A();
  L.keyDown('x', false);
  L.beginStroke(p(10, 20));
  L.project(p(30, 99));                       // locked to y = 20
  L.keyDown('y', false);                      // switch to Y at (30,20)
  const out = L.project(p(55, 70));
  check('the key pressed last wins and re-anchors where the stroke is', out.x === 30 && out.y === 70);
  L.keyUp('y');
  const back = L.project(p(80, 40));
  check('releasing it returns to the other key, anchored at the last point', back.x === 80 && back.y === 70);
}
{
  const L = A();
  check('a key tapped with no stroke is a tap', (L.keyDown('x', false), L.keyUp('x') === 'tap'));
  check('...and a Y tap too (the caller decides it does nothing)', (L.keyDown('y', false), L.keyUp('y') === 'tap'));
  L.keyDown('x', false);
  L.keyDown('x', true);
  L.keyDown('x', true);
  check('auto-repeat is ignored: still one key held', L.axis() === 'x' && L._down.length === 1);
  check('a key held through a stroke that did not move is still a tap only if nothing used it',
    (L.beginStroke(p(1, 1)), L.endStroke(), L.keyUp('x') === 'tap'));
  check('a key that was never pressed here is not a tap', L.keyUp('x') === null);
  check('other keys are not ours', L.keyDown('q', false) === false && L.keyUp('q') === null);
  check('upper-case works too (Caps Lock)', (L.keyDown('X', false), L.axis() === 'x'));
  L.reset();
  check('reset clears the keys', L.axis() === null && L.keyUp('x') === null);
}
{
  const L = A();
  L.keyDown('x', false);
  L.beginStroke(p(5, 5));
  // many points, all on the axis
  let ok = true;
  for (let i = 0; i < 200; i++) if (L.project(p(i * 3 % 256, (i * 7) % 192)).y !== 5) ok = false;
  check('200 points of a wandering stroke all lie on the axis', ok);
  L.endStroke();
  const after = L.project(p(9, 9));
  check('after the stroke the lock does not carry over', same(after, p(9, 9)));
  check('...but a new stroke with X still down locks at its own press point', (L.beginStroke(p(40, 60)), L.project(p(90, 5)).y === 60));
}

{
  const L = A();
  check('projectAbout with no key returns the point', same(L.projectAbout(p(5, 5), p(9, 9)), p(9, 9)));
  L.keyDown('x', false);
  check('projectAbout X keeps the anchor y', same(L.projectAbout(p(5, 5), p(9, 40)), p(9, 5)));
  L.keyDown('y', false);
  check('projectAbout Y keeps the anchor x', same(L.projectAbout(p(5, 5), p(9, 40)), p(5, 40)));
  check('projectAbout without an anchor returns the point', same(L.projectAbout(null, p(9, 40)), p(9, 40)));
}

summary();
