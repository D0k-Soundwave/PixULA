'use strict';
(function() {

/**
 * TransformPanel — the permanent Transform sidebar section.
 *
 * Extracted from the old ToolOptions._initTransformPanel/_wireTransformPanel/
 * _syncTransformPanel. Two modes, switched by what is focused:
 *   - stamp section (engaged stamp / floating paste): XOR, scale X/Y, rotate,
 *     warp shape, reset — live via SelectionService stamp transforms
 *   - image section (no stamp): live rotation slider over the layer/selection
 * Plus the always-available ops: flip H/V, invert, outline (gap/thickness),
 * shift arrows with 1px/8px step.
 */
class TransformPanelClass {
    constructor() {
        this._content = null;
        this._outlineGap = 1;
        this._outlineSize = 1;
        this._shiftWrap = true;
    }

    init() {
        const panel = PanelSection.create({
            id: 'transform-panel',
            titleI18n: 'panels.transform',
            title: 'Transform'
        });
        if (!panel) return;

        this._content = panel.content;
        this._build(this._content);
        this._wire(this._content);
        if (window.OptionControls) OptionControls.decorateSliders(this._content);
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this._content);

        EventBus.on(EVENTS.CANVAS_RENDER,  () => this._sync());
        EventBus.on(EVENTS.LAYER_SELECTED, () => this._sync());
        this._sync();

        Logger.info('TransformPanel', 'Initialized');
    }

    /**
     * Build the panel body. The Shift dir-pad is injected via the shared
     * Helpers.buildDirPad() (also used by the Reference panel's Offset pad)
     * rather than hand-written into the template string below, so the two
     * controls cannot drift out of lockstep on a future redesign.
     * @private
     */
    _build(content) {
        content.innerHTML = `
          <div class="tp-stamp-section" hidden>
            <div class="tool-option">
              <label><input type="checkbox" class="tp-xor" data-i18n-title-name="transform.xorMode" data-i18n-title="transform.xorMode.hint"> <span data-i18n="transform.xorMode">XOR Mode</span></label>
            </div>
            <hr class="tool-option-separator">
            <div class="tool-option">
              <label><span data-i18n="transform.scaleX">Scale X</span>: <span class="tp-sx-val">100%</span></label>
              <input type="range" class="tp-sx" min="10" max="400" step="5" value="100" data-i18n-title-name="transform.scaleX" data-i18n-title="transform.scaleX.hint">
            </div>
            <div class="tool-option">
              <label><span data-i18n="transform.scaleY">Scale Y</span>: <span class="tp-sy-val">100%</span></label>
              <input type="range" class="tp-sy" min="10" max="400" step="5" value="100" data-i18n-title-name="transform.scaleY" data-i18n-title="transform.scaleY.hint">
            </div>
            <div class="tool-option">
              <label><span data-i18n="transform.rotate">Rotate</span>: <span class="tp-rot-val">0&#xb0;</span></label>
              <input type="range" class="tp-rot" min="-180" max="180" step="1" value="0" data-i18n-title-name="transform.rotate" data-i18n-title="transform.rotate.hint">
            </div>
            <div class="tool-option">
              <label data-i18n="transform.shape">Shape</label>
              <select class="tp-warp" data-i18n-title-name="transform.shape" data-i18n-title="transform.shape.hint">
                <option value="none" data-i18n="transform.warp.none">None</option>
                <option value="arch-up" data-i18n="transform.warp.archUp">Arch Up</option>
                <option value="arch-down" data-i18n="transform.warp.archDown">Arch Down</option>
                <option value="wave" data-i18n="transform.warp.wave">Wave</option>
                <option value="flag" data-i18n="transform.warp.flag">Flag</option>
                <option value="slant-right" data-i18n="transform.warp.slantRight">Slant Right</option>
                <option value="slant-left" data-i18n="transform.warp.slantLeft">Slant Left</option>
                <option value="inflate" data-i18n="transform.warp.inflate">Inflate</option>
                <option value="perspective-top" data-i18n="transform.warp.perspectiveTop">Perspective Top</option>
                <option value="perspective-bottom" data-i18n="transform.warp.perspectiveBottom">Perspective Bottom</option>
              </select>
            </div>
            <div class="tool-option">
              <button type="button" class="panel-button small tp-reset" data-i18n="transform.reset" data-i18n-title-name="transform.reset" data-i18n-title="transform.reset.hint">Reset</button>
            </div>
            <hr class="tool-option-separator">
          </div>
          <div class="tp-image-section">
            <div class="tool-option">
              <label><span data-i18n="transform.rotate">Rotate</span>: <span class="tp-img-rot-val">0&#xb0;</span></label>
              <input type="range" class="tp-img-rot" min="-180" max="180" step="1" value="0" data-i18n-title-name="transform.rotate" data-i18n-title="transform.rotate.hint">
            </div>
          </div>
          <div class="tool-option">
            <div class="button-row">
              <button type="button" class="panel-button small" data-tp-transform="flipH" data-i18n-title-name="transform.flipH" data-i18n-title="transform.flipH.hint">&#x2194; <span data-i18n="transform.flipH">Flip H</span></button>
              <button type="button" class="panel-button small" data-tp-transform="flipV" data-i18n-title-name="transform.flipV" data-i18n-title="transform.flipV.hint">&#x2195; <span data-i18n="transform.flipV">Flip V</span></button>
              <button type="button" class="panel-button small" data-tp-transform="invert" data-i18n-title-name="transform.invert" data-i18n-title="transform.invert.hint">&#x25A0; <span data-i18n="transform.invert">Invert</span></button>
            </div>
          </div>
          <div class="tool-option tp-group tp-outline-group">
            <div class="button-row">
              <button type="button" class="panel-button small" data-tp-transform="outline" data-i18n-title-name="transform.outline" data-i18n-title="transform.outline.hint">&#x25AD; <span data-i18n="transform.outline">Outline</span></button>
            </div>
            <label><span data-i18n="transform.gap">Gap</span>: <span class="tp-og-val">1</span>px</label>
            <input type="range" class="tp-og" min="0" max="8" value="1" data-i18n-title-name="transform.gap" data-i18n-title="transform.gap.hint">
            <label><span data-i18n="transform.thickness">Thickness</span>: <span class="tp-os-val">1</span>px</label>
            <input type="range" class="tp-os" min="1" max="8" value="1" data-i18n-title-name="transform.thickness" data-i18n-title="transform.thickness.hint">
          </div>
          <div class="tool-option tp-group tp-shift-group">
            <label data-i18n="transform.shift">Shift</label>
            <div class="dir-pad-slot"></div>
            <div class="tp-shift-opts">
              <select class="tp-shift-step" data-i18n-aria-label="transform.shiftStep" aria-label="Shift step" data-i18n-title-name="transform.shiftStep" data-i18n-title="transform.shiftStep.hint">
                <option value="1" data-i18n="transform.shiftStep.pixel">1 pixel</option>
                <option value="cell" data-i18n="transform.shiftStep.cell">1 cell</option>
              </select>
              <label><input type="checkbox" class="tp-shift-wrap" checked data-i18n-title-name="transform.shiftWrap" data-i18n-title="transform.shiftWrap.hint"> <span data-i18n="transform.shiftWrap">Wrap around</span></label>
            </div>
          </div>
        `;

        const { element: pad, zones } = Helpers.buildDirPad();
        zones.up.dataset.tpTransform = 'shiftUp';
        zones.left.dataset.tpTransform = 'shiftLeft';
        zones.right.dataset.tpTransform = 'shiftRight';
        zones.down.dataset.tpTransform = 'shiftDown';
        content.querySelector('.dir-pad-slot').replaceWith(pad);

        // Unlike every other task in this batch, this class has no _t()
        // helper of its own and never needed one — this whole panel is a
        // static innerHTML template with data-i18n attributes, and
        // init()'s existing `I18n.apply(this._content)` call (line 35,
        // right after _build()/_wire() run) already stamps every
        // [data-i18n-title] element's title generically, the same
        // mechanism every other control in the app goes through. The
        // data-i18n-title-name/data-i18n-title pairs added above are
        // enough; no manual stamping loop is needed here. Dir-pad zones
        // carry neither attribute (out of scope — see Global Constraints),
        // so I18n.apply's sweep never touches them.
    }

    /** Wire all events on the permanent transform panel (called once). @private */
    _wire(content) {
        const getScale = () => ({
            sx: parseInt(content.querySelector('.tp-sx').value, 10) / 100,
            sy: parseInt(content.querySelector('.tp-sy').value, 10) / 100,
        });

        content.querySelector('.tp-xor').addEventListener('change', (e) => {
            const layer = LayerManager.getCurrentLayer();
            const stamp = (layer && layer.isStamp) ? layer : null;
            if (!stamp) return;
            LayerManager.setLayerXorMode(stamp.index, e.target.checked);
            CanvasSystem.requestRender();
        });

        content.querySelector('.tp-sx').addEventListener('input', (e) => {
            content.querySelector('.tp-sx-val').textContent = `${e.target.value}%`;
            if (SelectionService.isFloating()) {
                SelectionService.setStampScale(getScale().sx, getScale().sy);
            }
        });

        content.querySelector('.tp-sy').addEventListener('input', (e) => {
            content.querySelector('.tp-sy-val').textContent = `${e.target.value}%`;
            if (SelectionService.isFloating()) {
                SelectionService.setStampScale(getScale().sx, getScale().sy);
            }
        });

        content.querySelector('.tp-rot').addEventListener('input', (e) => {
            content.querySelector('.tp-rot-val').textContent = `${e.target.value}°`;
            if (SelectionService.isFloating()) {
                SelectionService.setStampRotation(parseFloat(e.target.value));
            }
        });

        content.querySelector('.tp-warp').addEventListener('change', (e) => {
            if (SelectionService.isFloating()) {
                SelectionService.setStampWarp(e.target.value);
            }
        });

        content.querySelector('.tp-reset').addEventListener('click', () => {
            if (SelectionService.isFloating()) {
                SelectionService.setStampScale(1, 1);
                SelectionService.setStampRotation(0);
                SelectionService.setStampWarp('none');
            }
        });

        content.querySelector('.tp-og').addEventListener('input', (e) => {
            content.querySelector('.tp-og-val').textContent = e.target.value;
            this._outlineGap = parseInt(e.target.value, 10);
        });

        content.querySelector('.tp-os').addEventListener('input', (e) => {
            content.querySelector('.tp-os-val').textContent = e.target.value;
            this._outlineSize = parseInt(e.target.value, 10);
        });

        content.querySelector('.tp-shift-wrap').addEventListener('change', (e) => {
            this._shiftWrap = e.target.checked;
        });

        content.querySelectorAll('button[data-tp-transform]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.tpTransform;
                let amount;
                if (type.startsWith('shift')) {
                    const step = content.querySelector('.tp-shift-step').value;
                    // 'cell' resolves per axis at click time — cells are not
                    // square in multicolor modes (CELL_HEIGHT is 8/4/2/1).
                    amount = step === 'cell'
                        ? ((type === 'shiftLeft' || type === 'shiftRight')
                            ? ZX_SPECTRUM.CELL_WIDTH : ZX_SPECTRUM.CELL_HEIGHT)
                        : (parseInt(step, 10) || 1);
                }
                this.applyTransform(type, amount);
            });
        });

        // ── Image rotation slider ─────────────────────────────────────────
        // Live preview: snapshot the layer/selection on first input, rotate
        // from that snapshot on every tick (avoids accumulated quality loss
        // WITHIN one drag), commit one undo entry once the interaction
        // settles, reset to 0.
        //
        // "Once the interaction settles" is load-bearing, not cosmetic. Each
        // rotation is nearest-neighbour: a point at radius r only crosses a
        // pixel boundary once r*sin(degrees) passes ~0.5px. At 1 degree that
        // needs r > ~28px, so anything closer to the pivot than that is
        // rotated to the SAME pixel it started at - correct for that single
        // degree, not a bug. The bug was committing (which snapshots the
        // ALREADY-ROUNDED result as the new starting point) after every
        // single stepper click: content inside that radius rounds back to
        // itself on every fresh snapshot, forever, no matter how many clicks
        // accumulate - the centre of a shape visibly never rotated while the
        // outer rim eventually did, because only the rim ever crossed the
        // threshold on any individual click. A drag never hit this, because
        // 'change' only ever fired once, at release - every tick mid-drag
        // rotated the CURRENT click's full angle from the one original
        // snapshot, so nothing was ever re-quantized until the final commit.
        // The fix is the same shape a drag already has: let a burst of
        // stepper clicks share one open snapshot and commit only after the
        // clicks stop, instead of after each one.
        const imgRot    = content.querySelector('.tp-img-rot');
        const imgRotVal = content.querySelector('.tp-img-rot-val');
        let _imgRotSnap = null;
        let _imgRotArea = null;
        let _imgRotOpen = false;
        let _imgRotCommitTimer = null;

        const beginImgRot = () => {
            if (_imgRotOpen) return false;
            const area = TransformService._getWorkArea();
            const snap = TransformService._copyToBufferWithAttrs(area);
            if (!snap) return false;
            _imgRotArea = area;
            _imgRotSnap = snap;
            UndoRedo.beginAction('Rotate image');
            _imgRotOpen = true;
            return true;
        };

        const commitImgRot = () => {
            if (_imgRotCommitTimer) { clearTimeout(_imgRotCommitTimer); _imgRotCommitTimer = null; }
            if (!_imgRotOpen) return;
            UndoRedo.endAction();
            _imgRotOpen = false;
            _imgRotSnap = null;
            _imgRotArea = null;
            imgRot.value = 0;
            imgRotVal.textContent = '0°';
        };

        // A real drag's 'change' fires once, at release - committing right
        // then is already correct. A stepper click's 'change' fires on every
        // click; waiting this long after the LAST one before committing lets
        // a burst of clicks share the drag's one-snapshot, one-commit shape
        // instead of each click re-quantizing an already-rounded result.
        // [A] chosen to comfortably exceed a deliberate next click, never
        // measured against real click cadence.
        const IMG_ROT_COMMIT_IDLE_MS = 500;
        const scheduleCommitImgRot = () => {
            if (_imgRotCommitTimer) clearTimeout(_imgRotCommitTimer);
            _imgRotCommitTimer = setTimeout(commitImgRot, IMG_ROT_COMMIT_IDLE_MS);
        };

        imgRot.addEventListener('input', (e) => {
            const deg = parseInt(e.target.value, 10) || 0;
            imgRotVal.textContent = `${deg}°`;
            if (!_imgRotOpen && !beginImgRot()) return;
            TransformService.rotateFromSnapshot(_imgRotSnap, _imgRotArea, deg);
            CanvasSystem.requestRender();
        });

        imgRot.addEventListener('change', scheduleCommitImgRot);
        imgRot.addEventListener('blur', commitImgRot);
    }

    /**
     * Apply a transform operation to the active stamp or current layer/selection.
     * Also called by keyboard hotkeys (Phase 5).
     * @param {string} type - Transform type identifier
     * @param {number} [amountOverride] - shift amount override
     */
    applyTransform(type, amountOverride) {
        // Clear the transient pattern-capture overlay only — an armed
        // Swap/Recolour operation is sticky and survives a transform.
        if (window.InputHandler && typeof InputHandler.exitPatternCaptureMode === 'function') {
            InputHandler.exitPatternCaptureMode();
        }
        const amount = amountOverride !== undefined ? amountOverride : 1;
        const outlineGap  = this._outlineGap;
        const outlineSize = this._outlineSize;

        if (SelectionService.isFloating()) {
            SelectionService.transformStamp(type, amount, outlineGap, outlineSize);
            return;
        }

        switch (type) {
            case 'flipH':       TransformService.flipHorizontal();                 break;
            case 'flipV':       TransformService.flipVertical();                   break;
            case 'rotate90CW':  TransformService.rotate90CW();                     break;
            case 'rotate90CCW': TransformService.rotate90CCW();                    break;
            case 'rotate180':   TransformService.rotate180();                      break;
            case 'shiftUp':     TransformService.shiftUp(amount, this._shiftWrap);    break;
            case 'shiftDown':   TransformService.shiftDown(amount, this._shiftWrap); break;
            case 'shiftLeft':   TransformService.shiftLeft(amount, this._shiftWrap); break;
            case 'shiftRight':  TransformService.shiftRight(amount, this._shiftWrap);break;
            case 'invert':      TransformService.invert();                         break;
            case 'outline':     TransformService.outline(outlineGap, outlineSize); break;
        }
        CanvasSystem.requestRender();
    }

    /** Sync the panel's live values to the current floating stamp state. @private */
    _sync() {
        const content = this._content;
        if (!content) return;

        const focusedLayer  = LayerManager.getCurrentLayer();
        const engagedStamp  = (focusedLayer && focusedLayer.isStamp) ? focusedLayer : null;
        const isFloating    = SelectionService.isFloating();
        const fp            = isFloating ? SelectionService.floatingPaste : null;
        const isReallyFloat = isFloating && fp && fp._isBrushStamp !== true;

        const stampSection = content.querySelector('.tp-stamp-section');
        stampSection.hidden = !(engagedStamp || isReallyFloat);

        const imageSection = content.querySelector('.tp-image-section');
        if (imageSection) imageSection.hidden = !!(engagedStamp || isReallyFloat);

        if (!engagedStamp && !isReallyFloat) return;

        if (engagedStamp) {
            content.querySelector('.tp-xor').checked = engagedStamp.xorMode || false;
        }

        // Sync scale/rotate/warp sliders from fp (works in brush and floating modes)
        if (!fp || fp._scaleX === undefined) return;

        const scaleX = Math.round((fp._scaleX || 1) * 100);
        const scaleY = Math.round((fp._scaleY || 1) * 100);
        const rot    = Math.round(fp._rotation || 0);
        const warp   = fp._warpEffect || 'none';

        content.querySelector('.tp-sx').value            = scaleX;
        content.querySelector('.tp-sx-val').textContent  = `${scaleX}%`;
        content.querySelector('.tp-sy').value            = scaleY;
        content.querySelector('.tp-sy-val').textContent  = `${scaleY}%`;
        content.querySelector('.tp-rot').value           = rot;
        content.querySelector('.tp-rot-val').textContent = `${rot}°`;
        content.querySelector('.tp-warp').value          = warp;
    }
}

window.TransformPanel = new TransformPanelClass();

Logger.debug('TransformPanel', 'Transform panel component loaded');

})(); // End IIFE
