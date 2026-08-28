'use strict';
(function() {

/**
 * TapeBlockDialog — TAP/TZX multi-block editing UI (Phase 9).
 *
 * A Dialog-component front end over the pure block APIs in TAPFormat /
 * TZXFormat (all byte math stays in io/): shows the tape's block list with
 * type/name/length metadata, loads a chosen SCREEN$ block into the document,
 * appends the current screen as a new block pair, removes and reorders
 * blocks, and saves the edited tape through FormatRegistry.download().
 *
 * Opened from File > Tape Blocks… (its own picker; the normal open flow
 * still rips the first SCREEN$ block untouched).
 */
class TapeBlockDialogClass {
    constructor() {
        this._state = null;
        this._listEl = null;
    }

    /** English fallback + {param} interpolation until keys land. @private */
    _t(key, fallback, params) {
        let v = fallback;
        if (window.I18n && typeof I18n.t === 'function') {
            const s = I18n.t(key, params);
            if (s && s !== key) return s;
        }
        if (params) {
            for (const [k, val] of Object.entries(params)) {
                v = v.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val));
            }
        }
        return v;
    }

    /**
     * Pick a .tap/.tzx file and open the block editor for it.
     */
    openForFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.tap,.tzx';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const buffer = await file.arrayBuffer();
            this.open(buffer, file.name);
        });
        input.click();
    }

    /**
     * Open the block editor for tape bytes.
     * @param {ArrayBuffer} buffer - Complete tape file
     * @param {string} filename - Source filename (drives format + save name)
     * @returns {boolean} False when the tape could not be parsed
     */
    open(buffer, filename) {
        const ext = FormatRegistry.getExtension(filename);
        const handler = ext === 'tzx' ? TZXFormat : TAPFormat;
        const parsed = handler.listBlocks(buffer);

        if (!parsed.success) {
            EventBus.emit(EVENTS.FILE_ERROR, { message: parsed.error });
            return false;
        }

        this._state = {
            ext,
            filename,
            handler,
            header: parsed.header || null, // TZX signature bytes
            blocks: parsed.blocks
        };

        const content = document.createElement('div');
        content.className = 'tape-dialog-body';

        const nameEl = document.createElement('div');
        nameEl.className = 'tape-dialog-file';
        nameEl.textContent = filename;
        content.appendChild(nameEl);

        this._listEl = document.createElement('div');
        this._listEl.className = 'tape-block-list';
        this._listEl.addEventListener('click', (e) => this._onListClick(e));
        content.appendChild(this._listEl);

        this._renderList();

        Dialog.open({
            id: 'tape-blocks',
            titleI18n: 'dialog.tapeBlocks',
            title: 'Tape Blocks',
            content,
            className: 'tape-dialog',
            buttons: [
                {
                    i18n: 'tape.addScreen', label: 'Add current screen',
                    onClick: () => { this._addCurrentScreen(); return false; }
                },
                {
                    i18n: 'tape.saveTape', label: 'Save tape', primary: true,
                    onClick: async () => { await this._saveTape(); return false; }
                },
                { i18n: 'dialog.close', label: 'Close' }
            ],
            onClose: () => { this._state = null; this._listEl = null; }
        });
        return true;
    }

    /**
     * Rebuild the block list DOM from current state.
     * @private
     */
    _renderList() {
        const { blocks } = this._state;
        this._listEl.textContent = '';

        if (!blocks.length) {
            const empty = document.createElement('div');
            empty.className = 'tape-block-empty';
            empty.dataset.i18n = 'tape.empty';
            empty.textContent = this._t('tape.empty', 'This tape has no blocks.');
            this._listEl.appendChild(empty);
            return;
        }

        blocks.forEach((block, i) => {
            const row = document.createElement('div');
            row.className = 'tape-block-row' + (block.isScreen ? ' is-screen' : '');

            const num = document.createElement('span');
            num.className = 'tape-block-num';
            num.textContent = String(i + 1);

            const desc = document.createElement('span');
            desc.className = 'tape-block-desc';
            desc.textContent = this._describe(block);

            const size = document.createElement('span');
            size.className = 'tape-block-size';
            size.textContent = this._t('tape.bytesUnit', '{n} bytes', { n: block.raw.length });

            const actions = document.createElement('span');
            actions.className = 'tape-block-actions';
            if (block.isScreen) {
                actions.appendChild(this._actionButton('load', i, 'tape.load', 'Load', null,
                    'tape.load.hint', 'Loads this SCREEN$ block into the document'));
            }
            actions.appendChild(this._actionButton('up', i, 'tape.moveUp', 'Move up', 'icon-arrow-up',
                'tape.moveUp.hint', 'Moves this block one place earlier on the tape'));
            actions.appendChild(this._actionButton('down', i, 'tape.moveDown', 'Move down', 'icon-arrow-down',
                'tape.moveDown.hint', 'Moves this block one place later on the tape'));
            actions.appendChild(this._actionButton('remove', i, 'tape.remove', 'Remove', 'icon-trash',
                'tape.remove.hint', 'Deletes this block from the tape'));

            row.appendChild(num);
            row.appendChild(desc);
            row.appendChild(size);
            row.appendChild(actions);
            this._listEl.appendChild(row);
        });

        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this._listEl);
    }

    /**
     * @param {string} act - data-act, read by the delegated click handler
     * @param {number} index - block index
     * @param {string} i18nKey @param {string} fallback
     * @param {string} [icon] - sprite symbol id; without one the button is
     *        captioned with its localized label instead. The icons come from
     *        the ONE sprite in index.html rather than from text glyphs: a
     *        pictographic arrow or cross in a label is a character that
     *        misaligns, fails to translate and renders as tofu where the font
     *        has no coverage, and this app already has a drawn icon for each.
     */
    _actionButton(act, index, i18nKey, fallback, icon, hintKey, hintFallback) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button tape-block-btn';
        btn.dataset.act = act;
        btn.dataset.index = String(index);
        const name = this._t(i18nKey, fallback);
        const title = Helpers.composeTitle(name, this._t(hintKey, hintFallback));
        if (icon) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);
            btn.appendChild(svg);
            btn.dataset.i18nTitleName = i18nKey;
            btn.dataset.i18nTitle = hintKey;
            btn.dataset.i18nAriaLabel = i18nKey;
            btn.title = title;
            btn.setAttribute('aria-label', name);
        } else {
            btn.dataset.i18n = i18nKey;
            btn.dataset.i18nTitleName = i18nKey;
            btn.dataset.i18nTitle = hintKey;
            btn.textContent = name;
            btn.title = title;
        }
        return btn;
    }

    /**
     * Human description of a block (localized).
     * @param {Object} block - Entry from listBlocks()
     * @returns {string}
     * @private
     */
    _describe(block) {
        if (block.kind === 'header') {
            const types = {
                0: ['tape.program', 'Program'],
                1: ['tape.numberArray', 'Number array'],
                2: ['tape.charArray', 'Character array'],
                3: ['tape.bytes', 'Bytes']
            };
            const [key, fallback] = types[block.headerType] || ['tape.headerBlock', 'Header'];
            return `${this._t(key, fallback)}: "${block.name}"`;
        }
        if (block.isScreen) return this._t('tape.screenData', 'SCREEN$ data');
        if (block.kind === 'data') return this._t('tape.data', 'Data');

        // Other TZX block types by ID
        const id = block.id;
        const names = TapeBlockDialogClass.TZX_BLOCK_NAMES[id];
        if (names) return this._t(names[0], names[1]);
        return this._t('tape.tzxBlock', 'TZX block 0x{id}', { id: id.toString(16).toUpperCase() });
    }

    /**
     * Delegated click handler for row action buttons.
     * @private
     */
    _onListClick(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn || !this._state) return;
        const i = parseInt(btn.dataset.index, 10);
        const { blocks } = this._state;

        switch (btn.dataset.act) {
            case 'load': {
                const result = this._state.handler.loadScreenBlock(blocks[i]);
                if (!result.success) {
                    EventBus.emit(EVENTS.FILE_ERROR, { message: result.error });
                } else {
                    CanvasSystem.requestRender();
                }
                break;
            }
            case 'up':
                if (i > 0) {
                    [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
                    this._renderList();
                }
                break;
            case 'down':
                if (i < blocks.length - 1) {
                    [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]];
                    this._renderList();
                }
                break;
            case 'remove':
                blocks.splice(i, 1);
                this._renderList();
                break;
        }
    }

    /**
     * Append the current document as a CODE header + SCREEN$ data pair.
     * @private
     */
    _addCurrentScreen() {
        const base = this._state.filename.replace(/\.[^.]+$/, '');
        const pair = this._state.handler.buildScreenBlockPair({ name: base });
        this._state.blocks.push(...pair);
        this._renderList();
    }

    /**
     * Serialize the edited block list and download it (the one download path).
     * @private
     */
    async _saveTape() {
        const { ext, handler, header, blocks, filename } = this._state;
        const bytes = ext === 'tzx'
            ? handler.serializeBlocks({ header, blocks })
            : handler.serializeBlocks(blocks);
        await FormatRegistry.download(bytes, filename);
    }
}

/**
 * i18n key + English fallback per supported TZX block ID (matches the
 * length table in TZXFormat._blockSpan).
 */
TapeBlockDialogClass.TZX_BLOCK_NAMES = {
    0x10: ['tzx.b10', 'Standard speed data'],
    0x11: ['tzx.b11', 'Turbo speed data'],
    0x12: ['tzx.b12', 'Pure tone'],
    0x13: ['tzx.b13', 'Pulse sequence'],
    0x14: ['tzx.b14', 'Pure data'],
    0x15: ['tzx.b15', 'Direct recording'],
    0x20: ['tzx.b20', 'Pause / stop the tape'],
    0x21: ['tzx.b21', 'Group start'],
    0x22: ['tzx.b22', 'Group end'],
    0x23: ['tzx.b23', 'Jump to block'],
    0x24: ['tzx.b24', 'Loop start'],
    0x25: ['tzx.b25', 'Loop end'],
    0x26: ['tzx.b26', 'Call sequence'],
    0x27: ['tzx.b27', 'Return from sequence'],
    0x28: ['tzx.b28', 'Select block'],
    0x2A: ['tzx.b2a', 'Stop tape if in 48K mode'],
    0x2B: ['tzx.b2b', 'Set signal level'],
    0x30: ['tzx.b30', 'Text description'],
    0x31: ['tzx.b31', 'Message'],
    0x32: ['tzx.b32', 'Archive info'],
    0x33: ['tzx.b33', 'Hardware type'],
    0x35: ['tzx.b35', 'Custom info'],
    0x5A: ['tzx.b5a', 'Glue block']
};

window.TapeBlockDialog = new TapeBlockDialogClass();

Logger.debug('TapeBlockDialog', 'Tape block dialog loaded');

})(); // End IIFE
