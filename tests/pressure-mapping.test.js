'use strict';
/**
 * BrushEngine.mapPressure() (Preferences > Pen: Pressure Sensitivity +
 * Pressure strength). The curve is linear and centred on pressure 0.5 ->
 * 1.0x (neutral), swinging symmetrically toward the ends; `pressureStrength`
 * (percent, default 100) scales the size of that swing. Both preferences are
 * read live from StateManager, never cached on the engine instance, so a
 * change in Preferences takes effect on the very next stamp.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/tools/brush-engine.js');

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── Default strength (unset -> 100%) matches the documented 0.5x-1.5x span ──

StateManager.set('pressureStrength', undefined);
check('mapPressure: unset strength defaults to 100%, pressure 0 -> 0.5x',
  approx(BrushEngine.mapPressure(0), 0.5));
check('mapPressure: unset strength, pressure 0.5 (mid) is neutral -> 1.0x',
  approx(BrushEngine.mapPressure(0.5), 1.0));
check('mapPressure: unset strength, pressure 1 -> 1.5x',
  approx(BrushEngine.mapPressure(1), 1.5));

// ── The whole 0..1 range does something now, not just the top of it ────────

StateManager.set('pressureStrength', 100);
check('mapPressure: a light-but-not-zero touch already shrinks the brush',
  BrushEngine.mapPressure(0.2) < 1.0 && BrushEngine.mapPressure(0.2) > 0.5);
check('mapPressure: mapping is monotonic across the whole range',
  BrushEngine.mapPressure(0.1) < BrushEngine.mapPressure(0.4) &&
  BrushEngine.mapPressure(0.4) < BrushEngine.mapPressure(0.6) &&
  BrushEngine.mapPressure(0.6) < BrushEngine.mapPressure(0.9));

// ── Strength scales the swing, in both directions ───────────────────────────

StateManager.set('pressureStrength', 0);
check('mapPressure: 0% strength has no effect anywhere in the range',
  approx(BrushEngine.mapPressure(0), 1.0) &&
  approx(BrushEngine.mapPressure(0.5), 1.0) &&
  approx(BrushEngine.mapPressure(1), 1.0));

StateManager.set('pressureStrength', 200);
check('mapPressure: 200% strength pushes firm pressure to roughly 2.0x',
  approx(BrushEngine.mapPressure(1), 2.0));
check('mapPressure: 200% strength never goes to zero or negative',
  BrushEngine.mapPressure(0) > 0);

// ── Out-of-range inputs are clamped, not trusted ────────────────────────────

StateManager.set('pressureStrength', 100);
check('mapPressure: pressure above 1.0 is clamped',
  approx(BrushEngine.mapPressure(5), BrushEngine.mapPressure(1)));
check('mapPressure: pressure below 0.0 is clamped',
  approx(BrushEngine.mapPressure(-5), BrushEngine.mapPressure(0)));

StateManager.set('pressureStrength', 500);
check('mapPressure: strength above 200% is clamped to 200%',
  approx(BrushEngine.mapPressure(1), 2.0));

summary();
