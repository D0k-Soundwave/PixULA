'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

const emitted = [];
installStubs({
  EventBus: { emit: (ch, data) => emitted.push({ ch, data }), on() {} },
  Storage: { get: async () => undefined, set: async () => {}, STORES: { PREFERENCES: 'preferences' } }
});
loadModule('js/core/color-manager.js');

check('default border is 0', ColorManager.getBorder() === 0);

ColorManager.setBorder(5);
check('setBorder stores value', ColorManager.getBorder() === 5);
check('setBorder emits COLOR_BORDER', emitted.some(e =>
  e.ch === 'color:border' && e.data && e.data.border === 5));

const before = emitted.length;
ColorManager.setBorder(5);
check('setting same value does not re-emit', emitted.length === before);

ColorManager.setBorder(99);
check('setBorder clamps high', ColorManager.getBorder() === 7);
ColorManager.setBorder(-3);
check('setBorder clamps low', ColorManager.getBorder() === 0);

summary();
