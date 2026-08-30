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
// The barrel is the pen's SECONDARY button - the browser cannot tell a barrel
// press from a mouse right-click - and every vendor ships it as right-click
// (docs/pen-info-table.md, read 2026-08-18: Surface Slim Pen "side button =
// right-click/select", XP-Pen "one side button shipped as right-click", Wacom
// "upper = right-click"). In this app the right button paints PAPER, and with
// the tip unassignable that is a one-barrel pen's ONLY route to paper.
check('barrel defaults to drawing paper, like every other secondary button',
    PenMap.actionFor('barrel', {}) === 'paper');
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
    wacomDefaults.barrel === 'paper' && wacomDefaults.barrel2 === 'menu' &&
    wacomDefaults.eraser === 'eraser');
check('an Apple Pencil has no defaults to write',
    Object.keys(PenMap.defaultsFor('apple')).length === 0);

// The barrel default is a RULE about every pen, not a fact about a few named
// ones: the barrel is the secondary button on all of them, so a profile that
// overrode it would be handing one make of pen a different app. Checked across
// the whole registry so a model added later cannot quietly opt out - the five
// that report nothing are the pens with no side button at all (four Apple
// Pencils and the Wacom bare-tip), which have nothing to assign.
const barrelDefaults = Object.keys(PEN_PROFILES)
    .map(id => [id, PenMap.defaultsFor(id).barrel]);
check('every pen with a barrel defaults it to paper - no exceptions',
    barrelDefaults.every(([, action]) => action === 'paper' || action === undefined));
check('and 18 of the 23 profiles genuinely have one to default',
    barrelDefaults.filter(([, action]) => action === 'paper').length === 18);
check('the five with none are exactly the button-less pens',
    barrelDefaults.filter(([, a]) => a === undefined).map(([id]) => id).join(',') ===
    'applePencil1,applePencil2,applePencilUsbC,applePencilPro,wacomBareTip');

// ── every action in the registry is nameable and unique ────────────────────
const ids = Object.keys(PEN_ACTIONS).map(k => PEN_ACTIONS[k].id);
check('action ids are unique', new Set(ids).size === ids.length);
check('every action carries an i18n key',
    Object.keys(PEN_ACTIONS).every(k => typeof PEN_ACTIONS[k].i18n === 'string' &&
                                        PEN_ACTIONS[k].i18n.length > 0));
check('every profile carries a label or an i18n key',
    Object.keys(PEN_PROFILES).every(k => PEN_PROFILES[k].label || PEN_PROFILES[k].i18n));

// ── Real named models (docs/pen-info-table.md, 2026-08-18) ────────────────

check('the vendor families expanded to a real, named model per profile (23)',
    Object.keys(PEN_PROFILES).length === 23);
check('every non-generic profile carries a vendor group for the dropdown',
    Object.keys(PEN_PROFILES).filter(k => k !== 'generic')
        .every(k => typeof PEN_PROFILES[k].group === 'string' && PEN_PROFILES[k].group.length > 0));

// Every retired family-level id must resolve to a model that reproduces its
// EXACT old shape - a saved choice from before the split must keep behaving
// exactly as it did, not gain or lose a control.
check('every alias resolves to a real, present profile, never generic',
    Object.keys(PEN_PROFILE_ALIASES).every(old =>
        PEN_PROFILES[PEN_PROFILE_ALIASES[old]] &&
        PEN_PROFILE_ALIASES[old] !== 'generic'));
check('aliased apple/samsung/microsoft/wacom/xppen/gaomon controlsFor matches pre-split shape',
    PenMap.controlsFor('apple').length === 0 &&
    PenMap.controlsFor('samsung').join(',') === 'barrel' &&
    PenMap.controlsFor('microsoft').join(',') === 'barrel,eraser' &&
    PenMap.controlsFor('wacom').join(',') === 'barrel,barrel2,eraser' &&
    PenMap.controlsFor('xppen').join(',') === 'barrel,barrel2' &&
    PenMap.controlsFor('gaomon').join(',') === 'barrel,barrel2');
check('aliased ids keep their old default actions too',
    JSON.stringify(PenMap.defaultsFor('wacom')) === JSON.stringify(PenMap.defaultsFor('wacomProPen2')));
check('huion and generic were not split and carry no alias',
    PEN_PROFILE_ALIASES.huion === undefined && PEN_PROFILE_ALIASES.generic === undefined);

// The one profile whose real, documented default earns an override: the Pro
// Pen 3D's middle button is pan/zoom, not the shared menu default.
check('Wacom Pro Pen 3D has no eraser (the doc lists none)',
    PenMap.controlsFor('wacomProPen3D').join(',') === 'barrel,barrel2');
check('Wacom Pro Pen 3D barrel2 defaults to Pan, not the shared Menu default',
    PenMap.actionFor('barrel2', { profile: 'wacomProPen3D' }) === 'pan');
// ...and only barrel2. Its upper button's documented default is right-click,
// which is the shared baseline now, so an override there would state a
// DIFFERENCE that does not exist.
check('Wacom Pro Pen 3D barrel takes the shared paper default like every other pen',
    PenMap.actionFor('barrel', { profile: 'wacomProPen3D' }) === 'paper');
check('every OTHER Wacom pen keeps the shared barrel2 default (menu), not pan',
    PenMap.actionFor('barrel2', { profile: 'wacomProPen2' }) === 'menu' &&
    PenMap.actionFor('barrel2', { profile: 'wacomProPen3' }) === 'menu' &&
    PenMap.actionFor('barrel2', { profile: 'wacomAccessory' }) === 'menu');
check('an explicit assignment still outranks a model\'s own default',
    PenMap.actionFor('barrel2', { profile: 'wacomProPen3D', actions: { barrel2: 'undo' } }) === 'undo');

// Every Apple/Samsung/XP-Pen/Gaomon model shares its family's shape exactly,
// even though each is its own named entry in the list.
check('all four Apple Pencil generations present nothing to assign',
    ['applePencil1', 'applePencil2', 'applePencilUsbC', 'applePencilPro']
        .every(id => PenMap.controlsFor(id).length === 0));
check('all three Samsung S Pen variants share one barrel, no eraser',
    ['sPenPhone', 'sPenTab', 'sPenFold']
        .every(id => PenMap.controlsFor(id).join(',') === 'barrel'));
// Slim Pen's top/end button is a real eraser control (Microsoft's own spec
// sheet: "Eraser and top button") — the same web-visible shape as the round
// Surface Pen's tail, despite the very different physical form factor. Only
// the legacy 2-button pen is genuinely a different shape from the other two.
// The pen this default was reported against: out of the box its side button
// must paint paper, with nothing assigned and no Preferences visit.
check('a Surface Slim Pen 2 barrel paints paper with nothing assigned',
    PenMap.actionFor('barrel', { profile: 'surfaceSlimPen' }) === 'paper' &&
    PenMap.defaultsFor('surfaceSlimPen').barrel === 'paper');

check('the current Surface Pen and Slim Pen share one shape; the legacy pen adds a barrel',
    PenMap.controlsFor('surfacePen').join(',') === 'barrel,eraser' &&
    PenMap.controlsFor('surfacePenLegacy').join(',') === 'barrel,barrel2,eraser' &&
    PenMap.controlsFor('surfaceSlimPen').join(',') === 'barrel,eraser');

summary();
