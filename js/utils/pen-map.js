'use strict';
(function() {

/**
 * PenMap — pure resolution of "which pen control is this, and what should it do".
 *
 * Sits between the raw button bits of a PointerEvent and the actions the input
 * handler performs, so the mapping can be reasoned about (and Node-tested in
 * tests/pen-map.test.js) without a pen, a browser or a DOM.
 *
 * Two rules are worth stating because they are the whole point of the design:
 *
 * 1. **A profile never disables hardware.** If a control arrives that the
 *    chosen profile says the pen does not have, it still resolves to its
 *    default action rather than being dropped. The profile is an unverified
 *    claim about the make of pen (see PEN_PROFILES) — the press in front of us
 *    is a fact, and a fact outranks a claim. This is what keeps a wrong
 *    profile from silently killing a working button.
 * 2. **The tip is not assignable.** It always draws with the active tool.
 *    Every other binding overloads a control that is otherwise idle; binding
 *    the tip would overload the one contact drawing needs.
 *
 * A control's out-of-the-box action is resolved through `defaultAction()`,
 * which checks the chosen model's own `defaults` override (PEN_PROFILES)
 * before falling back to the baseline every other pen shares
 * (PEN_DEFAULT_ACTIONS) — most models share the baseline outright, since most
 * vendor "real" defaults are OS-level concepts with no pixel-art equivalent.
 */
const PenMap = {

    /**
     * @param {string} id
     * @returns {Object} profile descriptor (generic when the id is unknown).
     *   Retired family-level ids resolve through PEN_PROFILE_ALIASES first, to
     *   the specific model that reproduces their exact old shape and defaults.
     */
    getProfile(id) {
        const resolved = PEN_PROFILE_ALIASES[id] || id;
        return PEN_PROFILES[resolved] || PEN_PROFILES.generic;
    },

    /**
     * The control shape to present: how many side buttons and whether there is
     * an eraser tail. The generic profile takes the shape from the user's own
     * declaration; every other profile states it.
     * @param {string} profileId
     * @param {{barrels?: number, eraser?: boolean}} [custom] - generic only
     * @returns {{barrels: number, eraser: boolean}}
     */
    shape(profileId, custom) {
        const profile = PenMap.getProfile(profileId);
        if (!profile.custom) return { barrels: profile.barrels, eraser: profile.eraser };
        const declared = custom || {};
        const barrels = Number.isFinite(declared.barrels)
            ? Helpers.clamp(Math.round(declared.barrels), 0, 2)
            : profile.barrels;
        const eraser = typeof declared.eraser === 'boolean' ? declared.eraser : profile.eraser;
        return { barrels, eraser };
    },

    /**
     * The assignable controls for a profile, in the order Preferences shows
     * them. The tip is deliberately absent — see the note at the top.
     * @param {string} profileId
     * @param {{barrels?: number, eraser?: boolean}} [custom]
     * @returns {string[]} control ids
     */
    controlsFor(profileId, custom) {
        const { barrels, eraser } = PenMap.shape(profileId, custom);
        const controls = [];
        if (barrels >= 1) controls.push(PEN_CONTROLS.BARREL.id);
        if (barrels >= 2) controls.push(PEN_CONTROLS.BARREL2.id);
        if (eraser) controls.push(PEN_CONTROLS.ERASER.id);
        return controls;
    },

    /**
     * Which control a pointer event represents, from its button bits.
     *
     * Order matters: the eraser tail is checked first because an inverted pen
     * in contact reports ONLY bit 32 (it is not also a tip press), and the
     * second barrel before the first because some drivers send both bits when
     * the upper button is held. A press with no recognised bit is the tip.
     *
     * @param {{buttons?: number, button?: number}} e - pointer event (or a stub)
     * @returns {string|null} control id, or null when nothing is pressed
     */
    controlFromEvent(e) {
        const buttons = (e && typeof e.buttons === 'number') ? e.buttons : 0;
        const button = (e && typeof e.button === 'number') ? e.button : -1;
        if (buttons & PEN_CONTROLS.ERASER.bit)  return PEN_CONTROLS.ERASER.id;
        if (buttons & PEN_CONTROLS.BARREL2.bit) return PEN_CONTROLS.BARREL2.id;
        if ((buttons & PEN_CONTROLS.BARREL.bit) ||
            button === PEN_CONTROLS.BARREL.button) return PEN_CONTROLS.BARREL.id;
        if ((buttons & PEN_CONTROLS.TIP.bit) ||
            button === PEN_CONTROLS.TIP.button) return PEN_CONTROLS.TIP.id;
        return null;
    },

    /**
     * The action assigned to a control.
     * @param {string} controlId
     * @param {Object} [config] - {profile: 'wacomProPen3D', actions: {barrel: 'menu', ...}}
     * @returns {string} action id (never null; unmapped controls fall back to
     *          the chosen profile's default, or the shared one, and an
     *          unknown assignment reads as 'none')
     */
    actionFor(controlId, config) {
        if (controlId === PEN_CONTROLS.TIP.id) return PEN_ACTIONS.INK.id;
        const assigned = config && config.actions ? config.actions[controlId] : null;
        const chosen = assigned || PenMap.defaultAction(config && config.profile, controlId);
        return PenMap.isAction(chosen) ? chosen : PEN_ACTIONS.NONE.id;
    },

    /**
     * The out-of-the-box action for a control under a profile: that model's
     * own `defaults` override if it names one for this control (real,
     * documented, and representable — e.g. the Wacom Pro Pen 3D's middle
     * button defaulting to Pan), else the baseline every other pen shares.
     * @param {string} profileId
     * @param {string} controlId
     * @returns {string} action id
     */
    defaultAction(profileId, controlId) {
        const profile = PenMap.getProfile(profileId);
        const override = profile.defaults && profile.defaults[controlId];
        return override || PEN_DEFAULT_ACTIONS[controlId] || PEN_ACTIONS.NONE.id;
    },

    /** @returns {boolean} true when the id names a real action */
    isAction(actionId) {
        for (const key in PEN_ACTIONS) {
            if (PEN_ACTIONS[key].id === actionId) return true;
        }
        return false;
    },

    /**
     * Does this action run for the whole press-drag-lift gesture (a stroke),
     * or fire once on the press?
     * @param {string} actionId
     * @returns {boolean}
     */
    isStroke(actionId) {
        for (const key in PEN_ACTIONS) {
            if (PEN_ACTIONS[key].id === actionId) return PEN_ACTIONS[key].stroke === true;
        }
        return false;
    },

    /**
     * The starting configuration for a profile: every control it declares,
     * mapped to that control's default action.
     * @param {string} profileId
     * @param {{barrels?: number, eraser?: boolean}} [custom]
     * @returns {{barrel: string, barrel2: string, eraser: string}}
     */
    defaultsFor(profileId, custom) {
        const actions = {};
        for (const control of PenMap.controlsFor(profileId, custom)) {
            actions[control] = PenMap.defaultAction(profileId, control);
        }
        return actions;
    }
};

window.PenMap = PenMap;

})(); // End IIFE
