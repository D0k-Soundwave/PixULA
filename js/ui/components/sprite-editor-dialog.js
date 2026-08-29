'use strict';
(function() {

/**
 * SpriteEditorDialog — the ZX Spectrum Next 16×16 sprite editor (Phase 13,
 * File > Sprite Editor…; FontEditorDialog pattern, reusing the shared
 * CellGridEditor in its indexed mode — the same surface that edits
 * patterns, map tiles and font glyphs).
 *
 * The editing surface paints palette INDICES resolved through the
 * document's Next RGB333 register file (whatever the active screen mode —
 * sprites always live in the Next palette). Left button paints the
 * drawing index (the field below, kept in sync with the indexed ink);
 * right button / eraser paint the sheet's transparency index (0xE3 at
 * 8bpp, 0x03 at 4bpp), which renders in its palette colour.
 *
 * Canvas capture/stamp bridges gate on the indexed modes
 * (SpriteService.isCanvasCompatible) with a localized status message.
 */
class SpriteEditorDialogClass {
    constructor() {
        this._editor = null;
        this._content = null;
        this._drawIndex = 0;
    }

    /** English fallback (dialog builds DOM, I18n.apply re-translates). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** Open (or focus) the sprite editor. */
    open() {
        if (Dialog.isOpen('sprite-editor')) return;
        this._drawIndex = window.ColorManager ? ColorManager.nextInk : 0;
        this._createDialog();
    }

    /** Palette hex for an index via the document's Next registers. @private */
    _colorOf(index) {
        const regs = window.ColorManager
            ? ColorManager.getNextRegisters() : NEXTRGB333.defaultRegisters();
        return NEXTRGB333.registerToHex(regs[index & 0xFF]);
    }

    /** @private */
    _createDialog() {
        const c = document.createElement('div');
        c.className = 'sprite-editor';
        this._content = c;

        const mkBtn = (cls, i18n, fallback, hintI18n, hint) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.dataset.i18n = i18n;
            b.textContent = this._t(i18n, fallback);
            if (hintI18n) {
                b.dataset.i18nTitleName = i18n;
                b.dataset.i18nTitle = hintI18n;
                b.title = Helpers.composeTitle(this._t(i18n, fallback), this._t(hintI18n, hint));
            }
            return b;
        };
        const row = (cls) => {
            const d = document.createElement('div');
            d.className = `sprite-editor-row ${cls || ''}`;
            return d;
        };

        // ── Sheet navigation ────────────────────────────────────────────────
        const nav = row('sprite-editor-nav');
        const mkNav = (cls, glyph, ariaI18n, aria, hintI18n, hint) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.textContent = glyph; // directional glyph, not a translatable word
            b.dataset.i18nAriaLabel = ariaI18n;
            b.setAttribute('aria-label', this._t(ariaI18n, aria));
            if (hintI18n) {
                b.dataset.i18nTitleName = ariaI18n;
                b.dataset.i18nTitle = hintI18n;
                b.title = Helpers.composeTitle(this._t(ariaI18n, aria), this._t(hintI18n, hint));
            }
            return b;
        };
        const prev = mkNav('se-prev', '◀', 'sprite.prevSprite', 'Previous sprite',
            'sprite.prevSprite.hint', 'Moves to the previous sprite in the sheet');
        const label = document.createElement('span');
        label.className = 'se-counter';
        const next = mkNav('se-next', '▶', 'sprite.nextSprite', 'Next sprite',
            'sprite.nextSprite.hint', 'Moves to the next sprite in the sheet');
        const add = mkBtn('se-add', 'sprite.add', 'Add',
            'sprite.add.hint', 'Adds a new blank sprite after the current one (64 per sheet)');
        const remove = mkBtn('se-remove', 'sprite.remove', 'Remove',
            'sprite.remove.hint', 'Deletes the current sprite from the sheet');
        nav.append(prev, label, next, add, remove);
        c.appendChild(nav);

        // ── Editing surface (shared CellGridEditor, indexed) ───────────────
        this._editor = new CellGridEditor({
            width: 16,
            height: 16,
            canvasWidth: 320,
            canvasHeight: 320,
            className: 'sprite-editor-surface',
            indexed: true,
            getColor: (v) => this._colorOf(v),
            getDrawValue: () => Helpers.clamp(this._drawIndex, 0, SpriteService.maxIndex()),
            getEraseValue: () => SpriteService.transparencyIndex(),
            onChange: () => {
                SpriteService.setSprite(SpriteService.getCurrent(), this._editor.getPixels());
            }
        });
        c.appendChild(this._editor.element);

        // ── Mini-tools ──────────────────────────────────────────────────────
        // Shared with Font Editor / Map Editor (Helpers.miniToolButton) rather
        // than hand-rolled here a third time — see docs/superpowers/specs/
        // 2026-08-20-tooltip-coverage-design.md §3.
        const tools = row('sprite-editor-tools');
        tools.innerHTML = [
            Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true),
            Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour'),
            Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points'),
            Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')
        ].join('');
        tools.querySelectorAll('button[data-tool]').forEach((b) => {
            b.addEventListener('click', () => {
                this._editor.setTool(b.dataset.tool);
                tools.querySelectorAll('button[data-tool]').forEach((x) =>
                    x.classList.toggle('active', x === b));
            });
        });
        c.appendChild(tools);

        // ── Ops + depth + drawing index ────────────────────────────────────
        const ops = row('sprite-editor-ops');
        const flipH = mkBtn('se-flip-h', 'sprite.flipH', 'Flip H',
            'sprite.flipH.hint', 'Mirrors the current sprite left-to-right');
        const flipV = mkBtn('se-flip-v', 'sprite.flipV', 'Flip V',
            'sprite.flipV.hint', 'Mirrors the current sprite top-to-bottom');
        const rot = mkBtn('se-rotate', 'sprite.rotate', 'Rotate',
            'sprite.rotate.hint', 'Rotates the current sprite 90 degrees clockwise');
        const clear = mkBtn('se-clear', 'sprite.clear', 'Clear',
            'sprite.clear.hint', 'Empties the current sprite back to fully transparent');
        ops.append(flipH, flipV, rot, clear);

        const depthLabel = document.createElement('label');
        depthLabel.className = 'se-depth';
        const depthSpan = document.createElement('span');
        depthSpan.dataset.i18n = 'sprite.depth';
        depthSpan.textContent = this._t('sprite.depth', 'Depth');
        const depthSel = document.createElement('select');
        depthSel.id = 'se-depth';
        depthSel.name = 'se-depth';
        for (const d of [8, 4]) {
            const o = document.createElement('option');
            o.value = String(d);
            o.textContent = `${d} bpp`;
            depthSel.appendChild(o);
        }
        depthSel.value = String(SpriteService.getDepth());
        depthLabel.append(depthSpan, depthSel);
        ops.appendChild(depthLabel);

        const idxLabel = document.createElement('label');
        idxLabel.className = 'se-index';
        const idxSpan = document.createElement('span');
        idxSpan.dataset.i18n = 'sprite.drawIndex';
        idxSpan.textContent = this._t('sprite.drawIndex', 'Index');
        const idxInput = document.createElement('input');
        idxInput.type = 'number';
        idxInput.id = 'se-index';
        idxInput.name = 'se-index';
        idxInput.min = '0';
        idxInput.max = String(SpriteService.maxIndex());
        idxInput.value = String(this._drawIndex);
        const idxWell = document.createElement('span');
        idxWell.className = 'color-swatch se-index-well';
        idxLabel.append(idxSpan, idxInput, idxWell);
        ops.appendChild(idxLabel);
        c.appendChild(ops);

        // ── Canvas bridges ──────────────────────────────────────────────────
        const bridge = row('sprite-editor-bridge');
        const mkNum = (cls, max) => {
            const i = document.createElement('input');
            i.type = 'number';
            i.className = cls;
            i.id = cls;
            i.name = cls;
            i.min = '0';
            i.max = String(max);
            i.value = '0';
            return i;
        };
        const bx = mkNum('se-x', 9999);
        const by = mkNum('se-y', 9999);
        const capture = mkBtn('se-capture', 'sprite.capture', 'Capture 16×16',
            'sprite.capture.hint', 'Copies a 16×16 block from the canvas at X,Y into the current sprite');
        const saveStamp = mkBtn('se-save-stamp', 'sprite.saveAsStamp', 'Save as Stamp',
            'sprite.saveAsStamp.hint', 'Creates a draggable stamp of the current sprite you can position and place on the canvas');
        bridge.append(bx, by, capture, saveStamp);
        c.appendChild(bridge);

        // ── File row ────────────────────────────────────────────────────────
        const file = row('sprite-editor-file');
        const importBtn = mkBtn('se-import', 'sprite.import', 'Import .spr…',
            'sprite.import.hint', 'Replaces the whole sheet with one loaded from a .spr file');
        const exportBtn = mkBtn('se-export', 'sprite.export', 'Export .spr',
            'sprite.export.hint', 'Saves the whole sheet as a .spr file');
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.id = 'se-file-input';
        picker.name = 'se-file-input';
        picker.accept = '.spr';
        picker.hidden = true;
        file.append(importBtn, exportBtn, picker);
        c.appendChild(file);

        // ── Status line ─────────────────────────────────────────────────────
        const status = document.createElement('p');
        status.className = 'sprite-editor-status';
        c.appendChild(status);
        const say = (msg) => { status.textContent = msg; };

        // ── Wiring ──────────────────────────────────────────────────────────
        const syncSurface = () => {
            const spr = SpriteService.getSprite(SpriteService.getCurrent());
            if (spr) this._editor.setPixels(spr);
            label.textContent =
                `${SpriteService.getCurrent() + 1} / ${SpriteService.getCount()}`;
            idxInput.max = String(SpriteService.maxIndex());
            idxWell.style.setProperty('background-color', this._colorOf(this._drawIndex));
        };

        prev.addEventListener('click', () =>
            SpriteService.setCurrent(SpriteService.getCurrent() - 1));
        next.addEventListener('click', () =>
            SpriteService.setCurrent(SpriteService.getCurrent() + 1));
        add.addEventListener('click', () => {
            const n = SpriteService.addSprite();
            if (n < 0) say(this._t('sprite.full', 'The sheet is full (64 sprites).'));
            else SpriteService.setCurrent(n);
        });
        remove.addEventListener('click', () => {
            SpriteService.removeSprite(SpriteService.getCurrent());
        });
        flipH.addEventListener('click', () => SpriteService.flipH(SpriteService.getCurrent()));
        flipV.addEventListener('click', () => SpriteService.flipV(SpriteService.getCurrent()));
        rot.addEventListener('click', () => SpriteService.rotateCW(SpriteService.getCurrent()));
        clear.addEventListener('click', () => SpriteService.clearSprite(SpriteService.getCurrent()));
        depthSel.addEventListener('change', () => {
            SpriteService.setDepth(parseInt(depthSel.value, 10));
        });
        idxInput.addEventListener('change', () => {
            this._drawIndex = Helpers.clamp(
                parseInt(idxInput.value, 10) || 0, 0, SpriteService.maxIndex());
            idxInput.value = String(this._drawIndex);
            idxWell.style.setProperty('background-color', this._colorOf(this._drawIndex));
        });

        const bridgeGate = () => {
            if (SpriteService.isCanvasCompatible()) return true;
            say(this._t('mode.spriteNeedsIndexed',
                'Canvas capture/stamp works in the Layer 2 / LoRes modes — switch the screen mode first.'));
            return false;
        };
        capture.addEventListener('click', () => {
            if (!bridgeGate()) return;
            if (SpriteService.captureFromCanvas(SpriteService.getCurrent(),
                parseInt(bx.value, 10) || 0, parseInt(by.value, 10) || 0)) {
                say(this._t('sprite.captured', 'Canvas region captured into the sprite.'));
            }
        });
        saveStamp.addEventListener('click', () => {
            if (!bridgeGate()) return;
            if (SpriteService.saveAsStamp(SpriteService.getCurrent())) {
                say(this._t('sprite.stampSaved', 'Stamp created — drag it into place, then click to commit.'));
            }
        });

        importBtn.addEventListener('click', () => picker.click());
        picker.addEventListener('change', async () => {
            const f = picker.files && picker.files[0];
            picker.value = '';
            if (!f) return;
            try {
                const result = SpriteFormat.parse(await Helpers.readFileAsArrayBuffer(f));
                say(result.success
                    ? this._t('sprite.loaded', 'Sprite sheet loaded.')
                    : result.error);
            } catch (err) {
                say(err.message);
            }
        });
        exportBtn.addEventListener('click', async () => {
            await SpriteFormat.exportAndDownload('sprites.spr');
        });

        this._onChanged = () => syncSurface();
        EventBus.on(EVENTS.SPRITE_CHANGED, this._onChanged);
        EventBus.on(EVENTS.SPRITE_LOADED, this._onChanged);

        syncSurface();

        Dialog.open({
            id: 'sprite-editor',
            titleI18n: 'sprite.title',
            title: 'Sprite Editor',
            content: c,
            className: 'sprite-editor-dialog',
            buttons: [{ i18n: 'dialog.close', label: 'Close', primary: true }],
            onClose: () => {
                EventBus.off(EVENTS.SPRITE_CHANGED, this._onChanged);
                EventBus.off(EVENTS.SPRITE_LOADED, this._onChanged);
                this._editor = null;
                this._content = null;
            }
        });
    }
}

window.SpriteEditorDialog = new SpriteEditorDialogClass();

Logger.debug('SpriteEditorDialog', 'Sprite editor dialog loaded');

})(); // End IIFE
