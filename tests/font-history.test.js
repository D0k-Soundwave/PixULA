'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
installStubs({});
loadModule('js/utils/font-history.js');

const snap = (name, bytes = 10) => ({ name, bytes });
const h = new FontHistory(100);
check('empty history cannot undo or redo', !h.canUndo() && !h.canRedo() && h.undo(snap('now')) === null && h.redo(snap('now')) === null);
h.push(snap('a')); h.push(snap('b'));
check('push makes undo possible', h.canUndo() && !h.canRedo());
let got = h.undo(snap('c'));
check('undo returns the last pushed state', got.name === 'b');
check('undo makes redo possible', h.canRedo());
got = h.undo(snap('b'));
check('undo again returns the one before', got.name === 'a');
got = h.redo(snap('a'));
check('redo returns what undo stepped back from', got.name === 'b');
h.push(snap('x'));
check('a new change clears redo', !h.canRedo());
// byte cap: drops the oldest first, keeps at least one
const small = new FontHistory(50);
for (let i = 0; i < 10; i++) small.push(snap('s' + i, 20));
check('the cap drops the oldest snapshots', small.bytes() <= 50 && small.past[small.past.length - 1].name === 's9' && small.past.length === 2);
const huge = new FontHistory(10);
huge.push(snap('big', 1000));
check('a single snapshot bigger than the cap is still kept (one step of undo)', huge.canUndo());
// redo bytes count towards the cap but never discard redo entries
small.clear();
check('clear empties both stacks', !small.canUndo() && !small.canRedo() && small.bytes() === 0);
summary();
