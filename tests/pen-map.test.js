'use strict';
/**
 * Pen button mapping (PenMap — pure resolution, no DOM).
 *
 * Covers the button-bit decoding (including the two traps: `button` and
 * `buttons` number things differently, and an inverted pen reports ONLY the
 * eraser bit), the profile shape each make of pen presents, and the two rules
 * the design rests on — a profile never disables real hardware, and the tip is
 * never assignable.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/pen-map.js');

const ev = (buttons, button) => ({ buttons, button: typeof button === 'number' ? button : -1 });

// ── control decoding ───────────────────────────────────────────────────────
check('nothing pressed resolves to no control',
    PenMap.controlFromEvent(ev(0)) === null);
check('tip contact (buttons bit 1) is the tip',
    PenMap.controlFromEvent(ev(1)) === 'tip');
check('barrel (buttons bit 2) is the barrel',
    PenMap.controlFromEvent(ev(2)) === 'barrel');
check('second barrel arrives as the middle bit (4)',
    PenMap.controlFromEvent(ev(4)) === 'barrel2');
check('eraser tail is bit 32, not a tip press',
    PenMap.controlFromEvent(ev(32)) === 'eraser');
check('eraser wins over a simultaneous tip bit',
    PenMap.controlFromEvent(ev(1 | 32)) === 'eraser');
check('upper button wins when a driver sends both barrel bits',
    PenMap.controlFromEvent(ev(2 | 4)) === 'barrel2');
// button vs buttons: button===1 is the MIDDLE button, buttons&2 is the RIGHT one
check('button 2 with no buttons mask still reads as the barrel',
    PenMap.controlFromEvent(ev(0, 2)) === 'barrel');
check('button 0 with no buttons mask reads as the tip',
    PenMap.controlFromEvent(ev(0, 0)) === 'tip');
check('a bare middle-button number (1) is not mistaken for a barrel',
    PenMap.controlFromEvent(ev(0, 1)) === null);

// ── profile shapes ─────────────────────────────────────────────────────────
check('Apple Pencil presents nothing to assign',
    PenMap.controlsFor('apple').length === 0);
check('S Pen presents one barrel and no eraser',
    PenMap.controlsFor('samsung').join(',') === 'barrel');
check('Surface Pen presents a barrel and an eraser tail',
    PenMap.controlsFor('microsoft').join(',') === 'barrel,eraser');
check('Wacom presents both barrels and the eraser',
    PenMap.controlsFor('wacom').join(',') === 'barrel,barrel2,eraser');
check('XP-Pen / Huion / Gaomon present two barrels, no eraser',
    PenMap.controlsFor('xppen').join(',') === 'barrel,barrel2' &&
    PenMap.controlsFor('huion').join(',') === 'barrel,barrel2' &&
    PenMap.controlsFor('gaomon').join(',') === 'barrel,barrel2');
check('an unknown profile id falls back to generic',
    PenMap.getProfile('nonesuch').id === 'generic');

// ── generic profile: the user declares the shape ───────────────────────────
check('generic honours a declared two-button pen with an eraser',
    PenMap.controlsFor('generic', { barrels: 2, eraser: true }).join(',') ===
    'barrel,barrel2,eraser');
check('generic honours a declared button-less pen',
    PenMap.controlsFor('generic', { barrels: 0, eraser: false }).length === 0);
check('generic clamps a silly button count',
    PenMap.shape('generic', { barrels: 9 }).barrels === 2 &&
    PenMap.shape('generic', { barrels: -3 }).barrels === 0);
check('a fixed profile ignores a custom shape',
    PenMap.controlsFor('apple', { barrels: 2, eraser: true }).length === 0);

// ── action resolution ──────────────────────────────────────────────────────
check('barrel defaults to the eyedropper it has always been',
    PenMap.actionFor('barrel', {}) === 'eyedropper');
check('eraser tail defaults to erasing',
    PenMap.actionFor('eraser', {}) === 'eraser');
check('second barrel defaults to the canvas menu',
    PenMap.actionFor('barrel2', {}) === 'menu');
check('an assignment is honoured',
    PenMap.actionFor('barrel', { actions: { barrel: 'pan' } }) === 'pan');
check('an unknown assignment reads as nothing rather than throwing',
    PenMap.actionFor('barrel', { actions: { barrel: 'teleport' } }) === 'none');
check('the tip is never assignable — it always draws',
    PenMap.actionFor('tip', { actions: { tip: 'undo' } }) === 'ink');

// Rule 1: a profile never disables hardware that is genuinely there.
check('an eraser press still acts even under a profile with no eraser',
    PenMap.controlsFor('samsung').indexOf('eraser') === -1 &&
    PenMap.actionFor('eraser', {}) === 'eraser');

// ── stroke vs one-shot ─────────────────────────────────────────────────────
check('drawing actions are strokes',
    PenMap.isStroke('ink') && PenMap.isStroke('paper') &&
    PenMap.isStroke('eyedropper') && PenMap.isStroke('eraser') && PenMap.isStroke('pan'));
check('menu/undo/redo/swap/prevTool fire once on the press',
    !PenMap.isStroke('menu') && !PenMap.isStroke('undo') && !PenMap.isStroke('redo') &&
    !PenMap.isStroke('swapColors') && !PenMap.isStroke('prevTool'));
check('nothing is not a stroke', !PenMap.isStroke('none'));

// ── defaults for a whole profile ───────────────────────────────────────────
const wacomDefaults = PenMap.defaultsFor('wacom');
check('defaultsFor covers exactly the profile\'s controls',
    Object.keys(wacomDefaults).sort().join(',') === 'barrel,barrel2,eraser');
check('defaultsFor maps each to its default action',
    wacomDefaults.barrel === 'eyedropper' && wacomDefaults.barrel2 === 'menu' &&
    wacomDefaults.eraser === 'eraser');
check('an Apple Pencil has no defaults to write',
    Object.keys(PenMap.defaultsFor('apple')).length === 0);

// ── every action in the registry is nameable and unique ────────────────────
const ids = Object.keys(PEN_ACTIONS).map(k => PEN_ACTIONS[k].id);
check('action ids are unique', new Set(ids).size === ids.length);
check('every action carries an i18n key',
    Object.keys(PEN_ACTIONS).every(k => typeof PEN_ACTIONS[k].i18n === 'string' &&
                                        PEN_ACTIONS[k].i18n.length > 0));
check('every profile carries a label or an i18n key',
    Object.keys(PEN_PROFILES).every(k => PEN_PROFILES[k].label || PEN_PROFILES[k].i18n));

summary();
