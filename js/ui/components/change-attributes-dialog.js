'use strict';
(function() {

/**
 * ChangeAttributesDialog - Image > Attributes > Change...
 *
 * Find and replace over cell colours. Find says which cells to match (Any
 * for a field that does not matter); Replace with says what they become (Keep
 * for a field that stays). The count of cells that will change is live. OK
 * applies it as one undo step; Cancel, Escape and the close button change
 * nothing.
 *
 * Layout follows the mode: GigaScreen has a Screen A and a Screen B group and
 * one Flash (it covers both screens); ULAplus shows CLUT 0-3 instead of Bright
 * and Flash; every other cell mode shows Bright and Flash. The service does the
 * matching and writing (TransformService.changeAttributes); this file only
 * builds the controls.
 */

const CHANGE_ATTR_BASE_NAMES = ['black', 'blue', 'red', 'magenta', 'green', 'cyan', 'yellow', 'white'];

/** A find or replace set with every field unset (null). */
function emptyAttrSet() {
    return { ink: null, paper: null, bright: null, flash: null,
             inkB: null, paperB: null, brightB: null, flashB: null };
}

class ChangeAttributesDialogClass {
    constructor() {
        this._state = null;
        this._countEl = null;
        this._swatches = [];
    }

    /** English fallback + {param} interpolation until keys land. @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const s = I18n.t(key, params);
            if (s && s !== key) return s;
        }
        let v = fallback;
        if (params) {
            for (const [k, val] of Object.entries(params)) {
                v = v.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val));
            }
        }
        return v;
    }

    /**
     * Open the dialog. Does nothing where the Attributes commands are blocked
     * (no cell colours, a floating stamp, a locked layer): the menu greys the
     * row out, and the service checks again.
     */
    open() {
        if (!window.TransformService || TransformService.attributeCommandsBlocked()) return;
        this._state = { find: emptyAttrSet(), replace: emptyAttrSet() };
        this._swatches = [];

        const giga = ZX_SPECTRUM.SCREENS === 2;
        const plus = ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64';

        const form = document.createElement('div');
        form.className = 'attr-change';

        const scope = document.createElement('p');
        scope.className = 'attr-change-scope';
        const onSelection = SelectionService.hasSelection();
        scope.textContent = this._t('attrChange.scope', 'Applies to: {scope}', {
            scope: onSelection
                ? this._t('attrChange.scopeSelection', 'Selection')
                : this._t('attrChange.scopeWhole', 'Whole picture')
        });
        form.appendChild(scope);

        form.appendChild(this._buildSide('find', giga, plus));
        form.appendChild(this._buildSide('replace', giga, plus));

        this._countEl = document.createElement('p');
        this._countEl.className = 'attr-change-count';
        this._countEl.setAttribute('aria-live', 'polite');
        form.appendChild(this._countEl);

        form.addEventListener('change', () => this._refresh());
        this._refresh();

        Dialog.open({
            id: 'change-attributes',
            titleI18n: 'attrChange.title',
            title: 'Change Attributes',
            className: 'attr-change-dialog',
            content: form,
            buttons: [
                { id: 'cancel', i18n: 'dialog.cancel', label: 'Cancel' },
                { id: 'ok', i18n: 'dialog.ok', label: 'OK', primary: true,
                  onClick: () => {
                      TransformService.changeAttributes(this._state.find, this._state.replace);
                  } }
            ],
            onClose: () => { this._state = null; this._swatches = []; this._countEl = null; }
        });
    }

    /**
     * One side (Find or Replace with) as a titled block of groups.
     * @private
     */
    _buildSide(side, giga, plus) {
        const isFind = side === 'find';
        const any = isFind ? 'any' : 'keep';
        const anyLabel = isFind ? this._t('attrChange.any', 'Any') : this._t('attrChange.keep', 'Keep');
        const block = document.createElement('div');
        block.className = 'attr-change-side';
        const title = document.createElement('h3');
        title.className = 'attr-change-side-title';
        title.textContent = isFind ? this._t('attrChange.find', 'Find') : this._t('attrChange.replace', 'Replace with');
        block.appendChild(title);

        const colourOptions = (field, plane) => {
            const opts = [{ token: any, label: anyLabel, text: true }];
            for (let v = 0; v < 8; v++) {
                opts.push({ token: String(v), value: v, colourName: CHANGE_ATTR_BASE_NAMES[v], plane, field });
            }
            return opts;
        };
        const onOff = () => [
            { token: any, label: anyLabel, text: true },
            { token: 'on', value: true, label: this._t('attrChange.on', 'On') },
            { token: 'off', value: false, label: this._t('attrChange.off', 'Off') }
        ];

        if (giga) {
            block.appendChild(this._group(side, 'screenA', this._t('giga.screenA', 'Screen A'), [
                { field: 'ink', legend: this._t('color.ink', 'Ink'), options: colourOptions('ink', 0) },
                { field: 'paper', legend: this._t('color.paper', 'Paper'), options: colourOptions('paper', 0) },
                { field: 'bright', legend: this._t('giga.brightA', 'Bright A'), options: onOff() }
            ]));
            block.appendChild(this._group(side, 'screenB', this._t('giga.screenB', 'Screen B'), [
                { field: 'inkB', legend: this._t('color.ink', 'Ink'), options: colourOptions('inkB', 1) },
                { field: 'paperB', legend: this._t('color.paper', 'Paper'), options: colourOptions('paperB', 1) },
                { field: 'brightB', legend: this._t('giga.brightB', 'Bright B'), options: onOff() }
            ]));
            block.appendChild(this._group(side, 'flash', this._t('attrChange.flashBoth', 'Flash (both screens)'), [
                { field: 'flash', legend: this._t('color.flash', 'Flash'), options: onOff(), pair: 'flashB' }
            ]));
            return block;
        }

        const inkPaper = [
            { field: 'ink', legend: this._t('color.ink', 'Ink'), options: colourOptions('ink', 0) },
            { field: 'paper', legend: this._t('color.paper', 'Paper'), options: colourOptions('paper', 0) }
        ];
        if (plus) {
            const clutOpts = [{ token: any, label: anyLabel, text: true }];
            for (let c = 0; c < 4; c++) clutOpts.push({ token: String(c), value: c, clut: true, label: String(c) });
            block.appendChild(this._group(side, 'main', '', inkPaper.concat([
                { field: 'clut', legend: this._t('attrChange.clut', 'CLUT'), options: clutOpts }
            ])));
        } else {
            block.appendChild(this._group(side, 'main', '', inkPaper.concat([
                { field: 'bright', legend: this._t('color.bright', 'Bright'), options: onOff() },
                { field: 'flash', legend: this._t('color.flash', 'Flash'), options: onOff() }
            ])));
        }
        return block;
    }

    /**
     * A fieldset of rows; each row is one attribute field with its radio
     * options. Radios share a name per row, so Tab and the arrow keys work
     * with no key code here.
     * @private
     */
    _group(side, id, caption, rows) {
        const box = document.createElement('div');
        box.className = 'attr-change-group';
        if (caption) {
            const cap = document.createElement('div');
            cap.className = 'attr-change-caption';
            cap.textContent = caption;
            box.appendChild(cap);
        }
        for (const row of rows) {
            const fs = document.createElement('fieldset');
            fs.className = 'attr-change-field';
            const lg = document.createElement('legend');
            lg.textContent = row.legend;
            fs.appendChild(lg);
            for (const opt of row.options) {
                fs.appendChild(this._option(side, row, opt));
            }
            box.appendChild(fs);
        }
        return box;
    }

    /** One radio with its label; colour options carry a swatch. @private */
    _option(side, row, opt) {
        const label = document.createElement('label');
        label.className = 'attr-change-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `attr-change-${side}-${row.field}`;
        input.value = opt.token;
        input.checked = opt.token === (side === 'find' ? 'any' : 'keep');
        input.addEventListener('change', () => this._choose(side, row, opt));
        label.appendChild(input);
        if (opt.colourName) {
            const sw = document.createElement('span');
            sw.className = 'attr-change-swatch';
            const name = this._t(`color.${opt.colourName}`, opt.colourName);
            sw.title = name;
            label.title = name;
            this._swatches.push({ el: sw, side, plane: opt.plane, field: row.field, value: opt.value });
            label.appendChild(sw);
        } else {
            const text = document.createElement('span');
            text.textContent = opt.label;
            label.appendChild(text);
        }
        return label;
    }

    /**
     * A radio was picked: write the value into the state. The Flash control on
     * GigaScreen sets both screens' flash, and CLUT sets bright and flash.
     * @private
     */
    _choose(side, row, opt) {
        const set = this._state[side];
        const value = opt.token === 'any' || opt.token === 'keep' ? null : opt.value;
        if (row.field === 'clut') {
            set.bright = value === null ? null : (value & 1) !== 0;
            set.flash = value === null ? null : (value & 2) !== 0;
        } else {
            set[row.field] = value;
            if (row.pair) set[row.pair] = value;
        }
    }

    /**
     * Recount the cells that will change and colour the swatches for the
     * current bright and flash, so a paper swatch shows its bank.
     * @private
     */
    _refresh() {
        if (!this._state) return;
        const n = TransformService.previewChangeAttributes(this._state.find, this._state.replace);
        if (this._countEl) {
            this._countEl.textContent = Helpers.localizedPlural('plural.changeAttrCells', n,
                'one: {n} cell will change | other: {n} cells will change');
        }
        for (const s of this._swatches) {
            const set = this._state[s.side];
            const plane = s.plane;
            const bright = plane === 1 ? set.brightB : set.bright;
            const flash = set.flash;
            const attrs = { ink: s.value, paper: s.value, bright: !!bright, flash: !!flash };
            const idx = ColorManager.attrToIndices(attrs, plane);
            const isInk = s.field === 'ink' || s.field === 'inkB';
            const index = isInk ? idx.ink : idx.paper;
            s.el.style.setProperty('background-color', `var(--zx-${index})`);
        }
    }
}

window.ChangeAttributesDialog = new ChangeAttributesDialogClass();

Logger.debug('ChangeAttributesDialog', 'Change Attributes dialog loaded');

})(); // End IIFE
