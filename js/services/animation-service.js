'use strict';
(function() {

/**
 * AnimationService - frames for the picture (screen animations) or for one
 * fixed block of it (sprite animations).
 *
 * An animation is a WINDOW (a block of whole cells; the whole grid for a
 * screen animation) plus a list of FRAMES. Each frame holds its own contents
 * for the animation's Animated layers, as packed grids (cels) in exactly the
 * form LayerClass.packAttributeData writes. Every other layer is Shared: it
 * looks the same in every frame.
 *
 * Only one frame of each animation is LIVE - its contents sit in the layers
 * themselves, so every tool, undo, clash rule and export works on a frame
 * unchanged. The rest are packed. The live frame's stored cels may be stale
 * (the layers are the truth for it); `flush` writes the layers back.
 *
 * Frames and their cel tables are never changed in place: a change makes a new
 * Frame. That lets an undo snapshot hold the frame list as a plain copy of
 * references, a duplicated frame share its cels until one is edited, and
 * caches key on a frame's identity.
 *
 * Commands come down from the UI as direct calls; facts go up as
 * EVENTS.ANIMATION_CHANGED (structure) and EVENTS.ANIMATION_FRAME (what is
 * shown, playing or not).
 */

/** [P] One Spectrum frame: the ULA interrupt runs at 50 Hz. Delays count these. */
const TICK_MS = 20;
/** [A] Starting delay of a new animation's frames (100 ms); a default only, set per frame. */
const DEFAULT_DELAY_TICKS = 5;
/** Longest delay a frame can be given: [A] a guard against nonsense input only [C: 65,535 x 20 ms = about 22 minutes]. */
const MAX_DELAY_TICKS = 0xFFFF;

function makeFrame(delayTicks, cels) {
    return Object.freeze({ delayTicks, cels: Object.freeze(Object.assign({}, cels)) });
}

function copyAnimation(a) {
    return Object.assign({}, a, {
        rect: Object.assign({}, a.rect), layerIds: a.layerIds.slice(), frames: a.frames.slice(),
        previews: (a.previews || []).slice()
    });
}

/** [A] A new preview layer's opacity; a starting value only, set per layer. */
const DEFAULT_PREVIEW_OPACITY = 40;
/** [A] Tints: earlier frames red, later frames blue (the usual onion-skin colours); each preview can switch its tint off. */
const TINT_EARLIER = [224, 64, 64];
const TINT_LATER = [64, 128, 224];

class AnimationServiceClass {
    constructor() {
        this.animations = [];
        this.openId = null;
        this._nextId = 1;
        // Playback settings belong to the session, not the document.
        this.playback = { speed: 1, repeat: 'loop', from: 0, to: null };
        this._playing = false;
        this._timer = null;
        this._due = 0;
        this._dir = 1;
        this._playStart = 0;
        this._blank = new Map();
    }

    static get TICK_MS() { return TICK_MS; }
    static get DEFAULT_DELAY_TICKS() { return DEFAULT_DELAY_TICKS; }
    static get MAX_DELAY_TICKS() { return MAX_DELAY_TICKS; }

    init() {
        EventBus.on(EVENTS.LAYER_CREATED, (d) => this._onLayerCreated(d));
        EventBus.on(EVENTS.LAYER_DELETED, (d) => this._onLayerDeleted(d));
        EventBus.on(EVENTS.LAYER_DUPLICATED, (d) => this._onLayerDuplicated(d));
        EventBus.on(EVENTS.LAYERS_MERGING, (d) => this._onLayersMerging(d));
        EventBus.on(EVENTS.FILE_NEW, () => this.reset());
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    hasAnimations() { return this.animations.length > 0; }
    getOpen() { return this.animations.find(a => a.id === this.openId) || null; }
    getAnimation(id) { return this.animations.find(a => a.id === id) || null; }
    isPlaying() { return this._playing; }

    /** Playing, or an export stepping through the frames: drawing waits. */
    isBusy() { return this._playing || !!this._busy; }

    /** AnimationExport holds drawing off while it shows each frame in turn. */
    setBusy(on) { this._busy = !!on; }

    /** The animation a layer is Animated in, or null when it is Shared everywhere. */
    animationOfLayer(layerId) {
        return this.animations.find(a => a.layerIds.includes(layerId)) || null;
    }

    isLayerAnimated(layerId) { return !!this.animationOfLayer(layerId); }

    /** The whole grid, in cells. */
    static fullRect() {
        return { cx: 0, cy: 0, cw: ZX_SPECTRUM.GRID_COLS, ch: ZX_SPECTRUM.GRID_ROWS };
    }

    /**
     * A block in pixels as whole cells of the active mode: the size is rounded
     * UP to the cells (a frame never splits a cell's attributes), the position
     * DOWN, and the block is kept on the screen.
     * @returns {{cx:number, cy:number, cw:number, ch:number}|null} null when nothing fits
     */
    static rectFromPixels(x, y, w, h) {
        const cw = ZX_SPECTRUM.CELL_WIDTH, chh = ZX_SPECTRUM.CELL_HEIGHT;
        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        const wc = Helpers.clamp(Math.ceil(Math.max(1, Math.round(w)) / cw), 1, cols);
        const hc = Helpers.clamp(Math.ceil(Math.max(1, Math.round(h)) / chh), 1, rows);
        if (!(wc > 0 && hc > 0)) return null;
        const cx = Helpers.clamp(Math.floor(Math.round(x) / cw), 0, cols - wc);
        const cy = Helpers.clamp(Math.floor(Math.round(y) / chh), 0, rows - hc);
        return { cx, cy, cw: wc, ch: hc };
    }

    /** A window read from a file, as whole cells kept on the grid (a damaged file cannot reach past it). */
    static onGrid(rect) {
        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        const int = (v, lo, hi) => Helpers.clamp(Math.round(Number(v)) || 0, lo, hi);
        const cw = int(rect.cw, 1, cols), ch = int(rect.ch, 1, rows);
        return { cx: int(rect.cx, 0, cols - cw), cy: int(rect.cy, 0, rows - ch), cw, ch };
    }

    /** The cells a pixel selection covers, every partly covered cell included. */
    static rectFromSelection(sel) {
        if (!sel || !(sel.width > 0) || !(sel.height > 0)) return null;
        const cw = ZX_SPECTRUM.CELL_WIDTH, chh = ZX_SPECTRUM.CELL_HEIGHT;
        const x0 = Math.floor(sel.x / cw) * cw, y0 = Math.floor(sel.y / chh) * chh;
        return AnimationServiceClass.rectFromPixels(x0, y0, sel.x + sel.width - x0, sel.y + sel.height - y0);
    }

    _isFull(rect) {
        return rect.cx === 0 && rect.cy === 0 &&
            rect.cw === ZX_SPECTRUM.GRID_COLS && rect.ch === ZX_SPECTRUM.GRID_ROWS;
    }

    _packRect(anim) { return this._isFull(anim.rect) ? null : anim.rect; }

    // ── Live frame <-> stored frames ────────────────────────────────────────

    /**
     * Write an animation's live frame back into its frame list. The frame keeps
     * its identity when nothing changed (the same comparison undo trims with).
     * @returns {boolean} true when the stored frame changed
     */
    flush(anim = this.getOpen()) {
        if (!anim || !anim.frames.length) return false;
        const frame = anim.frames[anim.current];
        const rect = this._packRect(anim);
        let changed = false;
        const cels = Object.assign({}, frame.cels);
        for (const id of anim.layerIds) {
            const layer = LayerManager.getLayerById(id);
            if (!layer) continue;
            let cel = layer.packAttributeData(rect);
            if (!LayerManagerClass.packedGridsEqual(cel, frame.cels[id])) {
                // A layer with nothing drawn shares the one blank cel, so empty frames cost nothing to keep or save.
                const blank = this._blankCel(rect, layer.isBackground);
                if (LayerManagerClass.packedGridsEqual(cel, blank)) cel = blank;
                cels[id] = cel;
                changed = true;
            }
        }
        if (changed) anim.frames[anim.current] = makeFrame(frame.delayTicks, cels);
        return changed;
    }

    /** Flush every animation (each one's layers hold its live frame, open or not). */
    flushAll() {
        for (const a of this.animations) this.flush(a);
    }

    /** A packed "nothing drawn" block for a layer that has no cel in a frame. */
    _blankCel(rect, isBackground) {
        const key = [ACTIVE_SCREEN_MODE.id, rect ? `${rect.cx},${rect.cy},${rect.cw},${rect.ch}` : 'all', isBackground].join('|');
        let cel = this._blank.get(key);
        if (!cel) {
            cel = new Layer(0, '', isBackground, -1).packAttributeData(rect);
            this._blank.set(key, cel);
        }
        return cel;
    }

    /** Put a stored frame into the animation's layers. Does not flush, compose or announce. */
    _loadCels(anim, frame) {
        const rect = this._packRect(anim);
        for (const id of anim.layerIds) {
            const layer = LayerManager.getLayerById(id);
            if (!layer) continue;
            layer.unpackAttributeData(frame.cels[id] || this._blankCel(rect, layer.isBackground));
        }
    }

    /** Recompose the window. */
    _compose(anim) {
        if (this._isFull(anim.rect)) {
            LayerManager.composeToCanvas();
            return;
        }
        const r = anim.rect;
        for (let y = r.cy; y < r.cy + r.ch; y++)
            for (let x = r.cx; x < r.cx + r.cw; x++) LayerManager.deferCellCompose(x, y);
        LayerManager.flushPendingCompose();
        CanvasSystem.requestRender();
    }

    _emitFrame() {
        const a = this.getOpen();
        EventBus.emit(EVENTS.ANIMATION_FRAME, {
            id: a ? a.id : null,
            frame: a ? a.current : 0,
            count: a ? a.frames.length : 0,
            playing: this._playing
        });
    }

    _emitChanged() {
        this._syncHook();
        EventBus.emit(EVENTS.ANIMATION_CHANGED, { openId: this.openId, count: this.animations.length });
        this._emitFrame();
    }

    /**
     * Show frame `index` of the open animation. A frame change touches the
     * layers between actions exactly as Undo does, so it is refused while an
     * action is open (mid-stroke). Not an undo step.
     * @returns {boolean} true when the frame shown changed
     */
    goTo(index, { flush = true, anim = this.getOpen() } = {}) {
        if (!anim) return false;
        if (window.UndoRedo && UndoRedo.isActionOpen()) return false;
        const n = anim.frames.length;
        const i = Helpers.clamp(index | 0, 0, n - 1);
        if (i === anim.current) return false;
        if (flush) this.flush(anim);
        anim.current = i;
        this._loadCels(anim, anim.frames[i]);
        this._compose(anim);
        this._emitFrame();
        return true;
    }

    next() { const a = this.getOpen(); if (a) this.goTo((a.current + 1) % a.frames.length); }
    previous() { const a = this.getOpen(); if (a) this.goTo((a.current - 1 + a.frames.length) % a.frames.length); }
    first() { this.goTo(0); }
    last() { const a = this.getOpen(); if (a) this.goTo(a.frames.length - 1); }

    // ── Pictures of frames (thumbnails, sheets) ─────────────────────────────

    /** A scratch layer per animated layer, kept for reuse while the mode stays. @private */
    _scratch(id, isBackground) {
        if (!this._scratchLayers || this._scratchMode !== ACTIVE_SCREEN_MODE.id) {
            this._scratchLayers = new Map();
            this._scratchMode = ACTIVE_SCREEN_MODE.id;
        }
        let s = this._scratchLayers.get(id);
        if (!s) { s = new Layer(0, '', isBackground, -1); this._scratchLayers.set(id, s); }
        return s;
    }

    /**
     * A picture of frame `index` of `anim`: its window, as ABGR words, from the
     * stored cels (the live layers for the frame shown). The frame is never
     * loaded, so this is safe at any moment. Shared layers are left out - they
     * are the same in every frame - except the background, which gives the
     * cells their paper.
     * @returns {{width:number, height:number, words:Uint32Array}|null}
     */
    renderFrame(anim, index) {
        const frame = anim && anim.frames[index];
        if (!frame) return null;
        const live = index === anim.current;
        const rect = anim.rect;
        const packRect = this._packRect(anim);
        const bg = LayerManager.getBackgroundLayer();
        const layers = [];
        let bgSource = bg;
        for (const id of anim.layerIds) {
            const layer = LayerManager.getLayerById(id);
            if (!layer) continue;
            let source = layer;
            if (!live) {
                source = this._scratch(id, layer.isBackground);
                source.unpackAttributeData(frame.cels[id] || this._blankCel(packRect, layer.isBackground));
            }
            if (layer.isBackground) bgSource = source;
            else if (layer.visible && !layer.isStamp) layers.push({ layer, source });
        }
        layers.sort((p, q) => p.layer.index - q.layer.index);
        const entries = [];
        const width = rect.cw * ZX_SPECTRUM.CELL_WIDTH, height = rect.ch * ZX_SPECTRUM.CELL_HEIGHT;
        const words = new Uint32Array(width * height);
        LayerManager.renderCellsToWords(rect, (x, y) => {
            entries.length = 0;
            for (const { layer, source } of layers) {
                const cell = source.getCell(x, y);
                if (cell && cell.altered) entries.push({ layer, cell, index: layer.index });
            }
            return { entries, bgCell: bgSource ? bgSource.getCell(x, y) : null };
        }, words);
        return { width, height, words };
    }

    // ── Animations ──────────────────────────────────────────────────────────

    _defaultName(kind) {
        const n = this.animations.length + 1;
        return kind === 'screen'
            ? Helpers.localizedMessage('anim.defaultScreenName', 'Animation {n}', { n })
            : Helpers.localizedMessage('anim.defaultSpriteName', 'Sprite {n}', { n });
    }

    _notice(key, fallback, params) {
        EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage(key, fallback, params) });
    }

    /**
     * Animation > New Screen Animation: the whole screen, every layer not
     * already in an animation (the background too), the picture as frame 1.
     * @returns {Object|null} the animation
     */
    createScreen(name = null) {
        if (window.UndoRedo && UndoRedo.isActionOpen()) return null;
        const ids = LayerManager.layers
            .filter(l => !l.isStamp && !this.animationOfLayer(l.id))
            .map(l => l.id);
        if (!ids.length) {
            this._notice('anim.noFreeLayers', 'Every layer already belongs to an animation.');
            return null;
        }
        this.pause();
        UndoRedo.beginAction('New animation');
        this.flushAll();
        const anim = {
            id: this._nextId++,
            name: name || this._defaultName('screen'),
            kind: 'screen',
            rect: AnimationServiceClass.fullRect(),
            layerIds: ids,
            frames: [makeFrame(DEFAULT_DELAY_TICKS, {})],
            previews: [],
            current: 0
        };
        this.animations.push(anim);
        this.openId = anim.id;
        this.flush(anim);
        UndoRedo.endAction();
        this._emitChanged();
        return anim;
    }

    /**
     * A sprite animation over a block of cells, on a new layer of its own.
     * `fromLayer` (optional) gives frame 1: the block's contents are moved
     * from that layer onto the new one.
     * @param {{name?:string, rect:{cx,cy,cw,ch}, frames?:number, fromLayer?:Object}} opts
     * @returns {Object|null}
     */
    createSprite({ name = null, rect, frames = 1, fromLayer = null, moreFrames = null } = {}) {
        if (window.UndoRedo && UndoRedo.isActionOpen()) return null;
        if (!rect || rect.cw < 1 || rect.ch < 1) return null;
        this.pause();
        UndoRedo.beginAction('New sprite animation');
        this.flushAll();
        const label = name || this._defaultName('sprite');
        const layer = LayerManager.addLayer(label, false);
        if (!layer) {
            UndoRedo.cancelAction();
            this._notice('anim.noLayerSlot', 'There is no room for another layer (the most is {n}).',
                { n: LayerManager.maxLayers });
            return null;
        }
        // addLayer announced the layer inside no action of its own, so it joined nothing.
        const open = this.getOpen();
        if (open) open.layerIds = open.layerIds.filter(id => id !== layer.id);
        if (fromLayer) {
            const block = fromLayer.packAttributeData(rect);
            layer.unpackAttributeData(block);
            fromLayer.unpackAttributeData(this._blankCel(rect, fromLayer.isBackground));
        }
        const anim = {
            id: this._nextId++,
            name: label,
            kind: 'sprite',
            rect: Object.assign({}, rect),
            layerIds: [layer.id],
            frames: [],
            previews: [],
            current: 0
        };
        const count = Math.max(1, frames | 0);
        for (let i = 0; i < count; i++) anim.frames.push(makeFrame(DEFAULT_DELAY_TICKS, {}));
        // Frames that arrive with their contents (a multi-frame import): block-packed cels for the new layer.
        for (const cel of moreFrames || []) anim.frames.push(makeFrame(DEFAULT_DELAY_TICKS, { [layer.id]: cel }));
        this.animations.push(anim);
        this.openId = anim.id;
        this.flush(anim);
        LayerManager.setCurrentLayer(layer.index);
        LayerManager.composeToCanvas();
        UndoRedo.endAction();
        this._emitChanged();
        return anim;
    }

    /** Make another animation the open one (its layers already show its live frame). */
    open(id) {
        if (id === this.openId || !this.getAnimation(id)) return;
        this.pause();
        this.flush();
        this.openId = id;
        this._emitChanged();
    }

    rename(id, name) {
        const a = this.getAnimation(id);
        const clean = String(name || '').trim();
        if (!a || !clean || clean === a.name) return;
        UndoRedo.beginAction('Rename animation');
        a.name = clean;
        UndoRedo.endAction();
        this._emitChanged();
    }

    /** Delete an animation: its layers keep the frame shown, as ordinary layers. */
    deleteAnimation(id = this.openId) {
        const a = this.getAnimation(id);
        if (!a || (window.UndoRedo && UndoRedo.isActionOpen())) return;
        this.pause();
        UndoRedo.beginAction('Delete animation');
        this.animations = this.animations.filter(x => x !== a);
        if (this.openId === id) this.openId = this.animations.length ? this.animations[this.animations.length - 1].id : null;
        UndoRedo.endAction();
        this._emitChanged();
    }

    // ── Frames ──────────────────────────────────────────────────────────────

    /**
     * Run a frame action as one undo step on the open animation. `reload` puts
     * the frame then shown into the layers (needed whenever the frame at
     * `current` is no longer the one that was live).
     * @private
     */
    _frameAction(label, fn, { reload = false } = {}) {
        const a = this.getOpen();
        if (!a || (window.UndoRedo && UndoRedo.isActionOpen())) return false;
        this.pause();
        UndoRedo.beginAction(label);
        this.flush(a);
        fn(a);
        if (reload) {
            this._loadCels(a, a.frames[a.current]);
            this._compose(a);
        }
        UndoRedo.endAction();
        this._emitChanged();
        return true;
    }

    /** Add a frame after the one shown and go to it: blank, or a copy (sharing its cels). */
    addFrame({ copy = false } = {}) {
        return this._frameAction('Add frame', (a) => {
            const cur = a.frames[a.current];
            // A blank frame is blank on the drawing layers; it keeps the frame's background.
            const bg = LayerManager.getBackgroundLayer();
            const keep = bg && a.layerIds.includes(bg.id) && cur.cels[bg.id] ? { [bg.id]: cur.cels[bg.id] } : {};
            a.frames.splice(a.current + 1, 0, copy ? cur : makeFrame(cur.delayTicks, keep));
            a.current++;
        }, { reload: true });
    }

    duplicateFrame() { return this.addFrame({ copy: true }); }

    deleteFrame(index = null) {
        const a = this.getOpen();
        if (!a) return false;
        if (a.frames.length <= 1) {
            this._notice('anim.lastFrame', 'An animation keeps at least one frame. Delete the animation instead.');
            return false;
        }
        const i = index === null ? a.current : index;
        return this._frameAction('Delete frame', (x) => {
            x.frames.splice(i, 1);
            if (x.current > i || x.current >= x.frames.length) x.current = Math.max(0, x.current - 1);
        }, { reload: true });
    }

    /** Move the frame shown one place earlier (-1) or later (+1). */
    moveFrame(dir) {
        const a = this.getOpen();
        if (!a) return false;
        const j = a.current + (dir < 0 ? -1 : 1);
        if (j < 0 || j >= a.frames.length) return false;
        return this._frameAction('Move frame', (x) => {
            const f = x.frames[x.current];
            x.frames[x.current] = x.frames[j];
            x.frames[j] = f;
            x.current = j;   // the same contents are live: no load needed
        });
    }

    static clampDelay(ticks) {
        const t = Math.round(Number(ticks));
        return Number.isFinite(t) ? Helpers.clamp(t, 1, MAX_DELAY_TICKS) : DEFAULT_DELAY_TICKS;
    }

    setDelay(ticks, index = null) {
        const a = this.getOpen();
        if (!a) return false;
        const i = index === null ? a.current : index;
        const t = AnimationServiceClass.clampDelay(ticks);
        if (!a.frames[i] || a.frames[i].delayTicks === t) return false;
        return this._frameAction('Frame delay', (x) => { x.frames[i] = makeFrame(t, x.frames[i].cels); });
    }

    setAllDelays(ticks) {
        const a = this.getOpen();
        if (!a) return false;
        const t = AnimationServiceClass.clampDelay(ticks);
        return this._frameAction('Frame delays', (x) => { x.frames = x.frames.map(f => makeFrame(t, f.cels)); });
    }

    /**
     * Animation > Frame to Stamp: the frame's window becomes a stamp to carry
     * into another frame - Edit > Copy of the window, on the layer being drawn.
     */
    frameToStamp() {
        const a = this.getOpen();
        if (!a || !window.SelectionService || (window.UndoRedo && UndoRedo.isActionOpen())) return false;
        this.pause();
        const r = a.rect;
        SelectionService.setSelection({
            x: r.cx * ZX_SPECTRUM.CELL_WIDTH, y: r.cy * ZX_SPECTRUM.CELL_HEIGHT,
            width: r.cw * ZX_SPECTRUM.CELL_WIDTH, height: r.ch * ZX_SPECTRUM.CELL_HEIGHT
        });
        return SelectionService.copyOrCut(false);
    }

    /**
     * Animation > Stamps to Frames: each parked stamp in the Stamps list becomes
     * a new frame after the one shown, placed where it is parked, on the
     * animation's layer. A copy of the stamp is committed, so the stamps stay.
     * @returns {number} frames added
     */
    stampsToFrames() {
        const a = this.getOpen();
        if (!a || !window.SelectionService || (window.UndoRedo && UndoRedo.isActionOpen())) return 0;
        const stamps = LayerManager.layers.filter(l => l.isStamp && l.stamp);
        if (!stamps.length) {
            this._notice('anim.noStamps', 'There are no stamps to make frames from. Copy or paste something first.');
            return 0;
        }
        this.pause();
        if (SelectionService.isFloating()) SelectionService.endFloatingPaste();
        // The stamps land on an Animated layer of this animation: the one being drawn on, or its top one.
        const cur = LayerManager.getCurrentLayer();
        let target = cur && a.layerIds.includes(cur.id) && !cur.isBackground ? cur : null;
        if (!target) {
            target = a.layerIds.map(id => LayerManager.getLayerById(id))
                .filter(l => l && !l.isBackground).sort((p, q) => q.index - p.index)[0] || null;
        }
        if (!target) return 0;
        let added = 0;
        for (const stamp of stamps) {
            LayerManager.setCurrentLayer(target.index);
            if (!this.addFrame()) break;
            const copy = LayerManager.duplicateLayer(stamp.index);
            if (!copy) break;
            LayerManager.setCurrentLayer(target.index);
            if (SelectionService.commitStamp(copy, { mirror: false })) added++;
        }
        this._notice('anim.stampsToFramesDone', 'Added {n} frames from the stamps.', { n: added });
        return added;
    }

    // ── Layers: Animated or Shared ──────────────────────────────────────────

    /**
     * Make a layer Animated in the open animation (its contents copied into
     * every frame) or Shared (keeps the frame shown, in every frame).
     */
    setLayerAnimated(layerId, animated) {
        if (window.UndoRedo && UndoRedo.isActionOpen()) return false;
        const layer = LayerManager.getLayerById(layerId);
        if (!layer || layer.isStamp) return false;
        const owner = this.animationOfLayer(layerId);
        if (animated) {
            const a = this.getOpen();
            if (!a || owner) return false;
            UndoRedo.beginAction('Animated layer');
            this.flush(a);
            const cel = layer.packAttributeData(this._packRect(a));
            a.layerIds.push(layerId);
            a.frames = a.frames.map(f => makeFrame(f.delayTicks, Object.assign({}, f.cels, { [layerId]: cel })));
            UndoRedo.endAction();
        } else {
            if (!owner) return false;
            UndoRedo.beginAction('Shared layer');
            this.flush(owner);
            owner.layerIds = owner.layerIds.filter(id => id !== layerId);
            owner.frames = owner.frames.map(f => {
                const cels = Object.assign({}, f.cels);
                delete cels[layerId];
                return makeFrame(f.delayTicks, cels);
            });
            if (!owner.layerIds.length) this._dropAnimation(owner);
            UndoRedo.endAction();
        }
        this._emitChanged();
        return true;
    }

    _dropAnimation(a) {
        this.animations = this.animations.filter(x => x !== a);
        if (this.openId === a.id) this.openId = this.animations.length ? this.animations[0].id : null;
    }

    _onLayerCreated(d) {
        // Only a layer the artist adds (inside its own undo action) joins the open
        // animation; undo and file loading rebuild layers without one.
        if (!d || d.layerId === undefined || !window.UndoRedo || !UndoRedo.isActionOpen()) return;
        const a = this.getOpen();
        const layer = LayerManager.getLayerById(d.layerId);
        if (!a || !layer || layer.isStamp || this.animationOfLayer(d.layerId)) return;
        a.layerIds.push(d.layerId);   // no cels: blank in every other frame, as it is now
        this._emitChanged();
    }

    _onLayerDeleted(d) {
        if (!d || d.layerId === undefined || !window.UndoRedo || !UndoRedo.isActionOpen()) return;
        const a = this.animationOfLayer(d.layerId);
        if (!a) return;
        a.layerIds = a.layerIds.filter(id => id !== d.layerId);
        a.frames = a.frames.map(f => {
            const cels = Object.assign({}, f.cels);
            delete cels[d.layerId];
            return makeFrame(f.delayTicks, cels);
        });
        if (!a.layerIds.length) this._dropAnimation(a);
        this._emitChanged();
    }

    _onLayerDuplicated(d) {
        if (!d) return;
        const src = this.animationOfLayer(d.fromId);
        // addLayer may have put the copy into the open animation; it belongs with its source.
        for (const a of this.animations) {
            if (a !== src) a.layerIds = a.layerIds.filter(id => id !== d.toId);
        }
        if (src) {
            if (!src.layerIds.includes(d.toId)) src.layerIds.push(d.toId);
            src.frames = src.frames.map(f => f.cels[d.fromId]
                ? makeFrame(f.delayTicks, Object.assign({}, f.cels, { [d.toId]: f.cels[d.fromId] }))
                : f);
        }
        this._emitChanged();
    }

    /**
     * A merge or flatten is about to change the live layers: do the same to
     * every stored frame of each animation involved, then put the live frame
     * back exactly as it was so the live merge that follows runs as always.
     * Calling mergeDown once per frame cannot work - it deletes the upper layer.
     */
    _onLayersMerging({ targetId, sourceIds = [], flatten = false } = {}) {
        const involved = [targetId, ...sourceIds];
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        for (const a of this.animations) {
            if (!involved.some(id => a.layerIds.includes(id))) continue;
            this.flush(a);
            const rect = this._packRect(a);
            const r = a.rect;
            const target = LayerManager.getLayerById(targetId);
            if (!target) continue;
            const frames = a.frames.map((f) => {
                this._loadCels(a, f);
                let cel;
                if (flatten) {
                    cel = LayerManager.flattenVisible().packAttributeData(rect);
                } else {
                    const scratch = new Layer(0, '', target.isBackground, -1);
                    scratch.unpackAttributeData(target.packAttributeData());
                    for (const sid of sourceIds) {
                        const src = LayerManager.getLayerById(sid);
                        if (!src || !src.visible) continue;
                        for (let y = r.cy; y < r.cy + r.ch; y++)
                            for (let x = r.cx; x < r.cx + r.cw; x++)
                                LayerManager._mergeCellInto(scratch.getCell(x, y), src.getCell(x, y), cellH);
                    }
                    cel = scratch.packAttributeData(rect);
                }
                const cels = Object.assign({}, f.cels);
                for (const sid of sourceIds) delete cels[sid];
                cels[targetId] = cel;
                return makeFrame(f.delayTicks, cels);
            });
            // Back to the live frame as it was, before the live merge runs.
            this._loadCels(a, a.frames[a.current]);
            a.frames = frames;
            a.layerIds = a.layerIds.filter(id => !sourceIds.includes(id));
            if (!a.layerIds.includes(targetId)) a.layerIds.push(targetId);
            // The merged-away layers leave every other animation too.
            for (const b of this.animations) {
                if (b !== a) b.layerIds = b.layerIds.filter(id => id !== targetId && !sourceIds.includes(id));
            }
        }
        // An animation whose every layer was merged into another's has nothing left to animate.
        for (const b of this.animations.filter(x => !x.layerIds.length)) this._dropAnimation(b);
        this._emitChanged();
    }

    // ── Preview layers (tracing frames) ─────────────────────────────────────
    //
    // A preview is a row in the Layers panel that shows another frame faded
    // over the picture, by the layer system's own transparency rule: its paper
    // pixels and empty cells are clear, ink of the layers above it covers it.
    // It is display only - never a layer, never drawn on, never in an export:
    // LayerManager calls `_blendPreviews` after composing each cell, and
    // stillImageData() leaves it out exactly as it leaves out FLASH and the
    // view switches.

    /** The frame index a preview shows, or -1 (none, or the frame being drawn). */
    previewFrameIndex(anim, p) {
        if (!anim || !p) return -1;
        const n = anim.frames.length;
        const i = p.frameRef.relative !== undefined ? anim.current + p.frameRef.relative : p.frameRef.frame;
        return i >= 0 && i < n && i !== anim.current ? i : -1;
    }

    getPreviews(anim = this.getOpen()) { return anim ? anim.previews : []; }

    /** Name shown in the Layers panel. */
    previewName(p) {
        if (p.name) return p.name;
        if (p.frameRef.relative === -1) return Helpers.localizedMessage('anim.previewPrevious', 'Trace: previous frame');
        if (p.frameRef.relative === 1) return Helpers.localizedMessage('anim.previewNext', 'Trace: next frame');
        return Helpers.localizedMessage('anim.previewFrame', 'Trace: frame {n}', { n: p.frameRef.frame + 1 });
    }

    /** By default a preview sits just under the layer being drawn on, so new ink covers it. @private */
    _defaultAnchor() {
        const cur = LayerManager.getCurrentLayer();
        const below = cur && cur.index > 0 ? LayerManager.layers[cur.index - 1] : LayerManager.layers[0];
        return below ? below.id : LayerManager.layers[0].id;
    }

    /** Layer > New Preview Layer, the Trace toggle and the onion skin switch. */
    addPreview(frameRef, { visible = true } = {}) {
        const a = this.getOpen();
        if (!a || (window.UndoRedo && UndoRedo.isActionOpen())) return null;
        UndoRedo.beginAction('New preview layer');
        const p = Object.freeze({
            id: this._nextId++, name: null, frameRef: Object.freeze(Object.assign({}, frameRef)), source: 'animated',
            opacity: DEFAULT_PREVIEW_OPACITY, tint: true, visible, anchorId: this._defaultAnchor()
        });
        a.previews = a.previews.concat([p]);
        UndoRedo.endAction();
        this._previewsChanged(a);
        return p;
    }

    removePreview(id) {
        const a = this.getOpen();
        if (!a || !a.previews.some(p => p.id === id)) return;
        UndoRedo.beginAction('Delete preview layer');
        a.previews = a.previews.filter(p => p.id !== id);
        UndoRedo.endAction();
        this._previewsChanged(a);
    }

    /**
     * Change a preview. Opacity, tint and show/hide are view settings and are
     * not undo steps; source and name are.
     */
    updatePreview(id, patch) {
        const a = this.getOpen();
        const p = a && a.previews.find(x => x.id === id);
        if (!p) return;
        const next = Object.assign({}, p, patch);
        next.opacity = Helpers.clamp(Math.round(Number(next.opacity)) || 0, 0, 100);
        const step = ('source' in patch) || ('name' in patch);
        if (step) UndoRedo.beginAction('Preview layer');
        a.previews = a.previews.map(x => (x.id === id ? Object.freeze(next) : x));
        if (step) UndoRedo.endAction();
        this._previewsChanged(a);
    }

    /** Move a preview one layer up (+1) or down (-1) in the stack. */
    movePreview(id, dir) {
        const a = this.getOpen();
        const p = a && a.previews.find(x => x.id === id);
        if (!p) return;
        const stack = LayerManager.layers.filter(l => !l.isStamp);
        const at = stack.findIndex(l => l.id === p.anchorId);
        const to = at + (dir > 0 ? 1 : -1);
        if (at < 0 || to < 0 || to >= stack.length) return;
        UndoRedo.beginAction('Move preview layer');
        a.previews = a.previews.map(x => (x.id === id ? Object.freeze(Object.assign({}, x, { anchorId: stack[to].id })) : x));
        UndoRedo.endAction();
        this._previewsChanged(a);
    }

    /** The Trace toggle on frame `index`: add a preview of it, or take it away. */
    toggleTrace(index) {
        const a = this.getOpen();
        if (!a) return;
        const p = a.previews.find(x => x.frameRef.frame === index);
        if (p) this.removePreview(p.id); else this.addPreview({ frame: index });
    }

    isTraced(index, anim = this.getOpen()) {
        return !!anim && anim.previews.some(x => x.frameRef.frame === index);
    }

    /** The onion skin: the Previous and Next previews, shown or hidden together. */
    isOnionSkin(anim = this.getOpen()) {
        return !!anim && anim.previews.some(x => x.frameRef.relative !== undefined && x.visible);
    }

    setOnionSkin(on) {
        const a = this.getOpen();
        if (!a) return;
        const rel = a.previews.filter(x => x.frameRef.relative !== undefined);
        if (on && !rel.length) {
            this.addPreview({ relative: -1 });
            this.addPreview({ relative: 1 });
            return;
        }
        for (const p of rel) this.updatePreview(p.id, { visible: !!on });
    }

    /** Recompose and announce after a preview change. @private */
    _previewsChanged(a) {
        this._syncHook();
        this._compose(a);
        this._emitChanged();
    }

    /**
     * Install the compositor's display hook only while some preview could be
     * seen, so a picture without previews composes exactly as before.
     */
    _syncHook() {
        const a = this.getOpen();
        const want = !!a && !this._playing && (a.previews || []).some(p => p.visible && p.opacity > 0);
        LayerManager.setDisplayHook(want ? this._hook || (this._hook = (x, y, entries) => this._blendPreviews(x, y, entries)) : null);
    }

    /** The traced frame's Animated layers merged into one layer, cached by frame identity. @private */
    _previewLayer(anim, p, index) {
        const frame = anim.frames[index];
        if (!this._previewCache) this._previewCache = new WeakMap();
        let byFrame = this._previewCache.get(frame);
        if (!byFrame) { byFrame = new Map(); this._previewCache.set(frame, byFrame); }
        const key = ACTIVE_SCREEN_MODE.id + '|' + p.source + '|' + anim.layerIds.join(',');
        let merged = byFrame.get(key);
        if (merged) return merged;
        merged = new Layer(0, '', false, -1);
        const packRect = this._packRect(anim);
        const r = anim.rect;
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const sources = anim.layerIds
            .map(id => LayerManager.getLayerById(id))
            .filter(l => l && !l.isBackground && (p.source === 'animated' || l.id === p.source))
            .sort((x, y) => x.index - y.index);
        const tmp = new Layer(0, '', false, -1);
        for (const l of sources) {
            tmp.unpackAttributeData(frame.cels[l.id] || this._blankCel(packRect, false));
            for (let y = r.cy; y < r.cy + r.ch; y++)
                for (let x = r.cx; x < r.cx + r.cw; x++)
                    LayerManager._mergeCellInto(merged.getCell(x, y), tmp.getCell(x, y), cellH);
        }
        byFrame.set(key, merged);
        return merged;
    }

    /**
     * LayerManager's display hook: blend each visible preview into one cell
     * the compositor has just written. Only the preview's ink pixels, only
     * where no visible layer above its place in the stack has ink, at its
     * opacity. Writes the display buffer only.
     * @param {number} cellX
     * @param {number} cellY
     * @param {Array} entries - the cell's visible altered layers [{layer, cell, index}], bottom to top
     * @private
     */
    _blendPreviews(cellX, cellY, entries) {
        const a = this.getOpen();
        if (!a || this._playing) return;
        const r = a.rect;
        if (cellX < r.cx || cellY < r.cy || cellX >= r.cx + r.cw || cellY >= r.cy + r.ch) return;
        const px = CanvasSystem.pixels;
        if (!px) return;
        const cellW = ZX_SPECTRUM.CELL_WIDTH, cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const W = ZX_SPECTRUM.WIDTH;
        const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
        const giga = ZX_SPECTRUM.SCREENS === 2;
        const baseX = cellX * cellW, baseY = cellY * cellH;
        let stackIndex = null;
        for (const p of a.previews) {
            if (!p.visible || p.opacity <= 0) continue;
            const fi = this.previewFrameIndex(a, p);
            if (fi < 0) continue;
            const cell = this._previewLayer(a, p, fi).getCell(cellX, cellY);
            if (!cell || !cell.altered) continue;
            if (!stackIndex) stackIndex = new Map(LayerManager.layers.map((l, i) => [l.id, i]));
            const anchorAt = stackIndex.has(p.anchorId) ? stackIndex.get(p.anchorId) : 0;
            let colour = null;
            if (p.tint) {
                colour = fi < a.current ? TINT_EARLIER : TINT_LATER;
            } else if (!indexed) {
                // FLASH follows the picture's phase; a flashing cell joins the flash clock's set.
                const res = LayerManager._resolveCellColors(cell, 0);
                if (res.flashing) LayerManager._trackFlash(cellX, cellY, true);
                const inverted = res.flashing && LayerManager._flashInverted && !LayerManager._disp.noFlash;
                colour = inverted ? res.paper : res.ink;
            }
            const alpha = p.opacity / 100;
            const words = indexed && !colour ? LayerManager._paletteWords() : null;
            for (let row = 0; row < cellH; row++) {
                let above = 0, ink = 0;
                if (!indexed) {
                    for (const e of entries) {
                        if (e.index <= anchorAt) continue;
                        above |= e.cell.pixels[row] | (giga && e.cell.pixelsB ? e.cell.pixelsB[row] : 0);
                    }
                    ink = cell.pixels[row] | (giga && cell.pixelsB ? cell.pixelsB[row] : 0);
                    if (!(ink & ~above & 0xFF)) continue;
                }
                for (let col = 0; col < cellW; col++) {
                    let rgb = colour;
                    if (indexed) {
                        const k = row * cellW + col;
                        const v = cell.indices[k];
                        if (v < 0) continue;
                        let covered = false;
                        for (const e of entries) {
                            if (e.index > anchorAt && e.cell.indices && e.cell.indices[k] >= 0) { covered = true; break; }
                        }
                        if (covered) continue;
                        if (!rgb) {
                            const w = words[v];
                            rgb = [w & 0xFF, (w >> 8) & 0xFF, (w >> 16) & 0xFF];
                        }
                    } else {
                        const bit = 1 << (cellW - 1 - col);
                        if (!(ink & bit) || (above & bit)) continue;
                    }
                    const at = (baseY + row) * W + baseX + col;
                    const d = px[at];
                    const R = d & 0xFF, G = (d >> 8) & 0xFF, B = (d >> 16) & 0xFF;
                    px[at] = (255 << 24) |
                        (Math.round(B + (rgb[2] - B) * alpha) << 16) |
                        (Math.round(G + (rgb[1] - G) * alpha) << 8) |
                        Math.round(R + (rgb[0] - R) * alpha);
                }
            }
        }
    }

    // ── Undo ────────────────────────────────────────────────────────────────

    /** Everything undo needs, as cheap copies: frames are immutable, so the arrays hold references. */
    captureState() {
        return {
            list: this.animations.map(copyAnimation),
            openId: this.openId,
            nextId: this._nextId
        };
    }

    /** Put the animation structure back. The layers are restored by undo itself. */
    restoreState(state) {
        if (!state) return;
        // A picture without animations, before and after: nothing to put back or redraw.
        if (!state.list.length && !this.animations.length) return;
        this.pause();
        this.animations = state.list.map(copyAnimation);
        this.openId = state.openId;
        this._nextId = Math.max(this._nextId, state.nextId || 1);
        this._emitChanged();
    }

    /**
     * Before undo or redo restores `state`: show, in every animation, the frame
     * the step was made on. An undo step keeps only the grids its action
     * changed and trusts the live layers for the rest - which holds only while
     * the same frame is live. This move is an ordinary frame change.
     */
    alignTo(state) {
        if (!state) return;
        for (const s of state.list) {
            const a = this.getAnimation(s.id);
            if (!a || a.current === s.current || s.current >= a.frames.length) continue;
            this.goTo(s.current, { anim: a });
        }
    }

    // ── Documents ───────────────────────────────────────────────────────────

    reset() {
        this.pause();
        this.animations = [];
        this.openId = null;
        this._emitChanged();
    }

    /**
     * The animations for a saved project, or null when there are none. Layers
     * are written by their place in `layers` (ids are not saved); each distinct
     * cel is written once, so shared and unchanged frames cost nothing extra.
     * @param {Object[]} layers - LayerManager.layers, in saved order
     */
    serialize(layers = LayerManager.layers, { celRefs = false } = {}) {
        if (!this.animations.length) return null;
        this.flushAll();
        const cels = [];
        const celIndex = new Map();
        const ref = (cel) => {
            if (!celIndex.has(cel)) { celIndex.set(cel, cels.length); cels.push(cel); }
            return celIndex.get(cel);
        };
        const place = new Map(layers.map((l, i) => [l.id, i]));
        const list = this.animations.map(a => ({
            name: a.name,
            kind: a.kind,
            rect: Object.assign({}, a.rect),
            layers: a.layerIds.filter(id => place.has(id)).map(id => place.get(id)),
            current: a.current,
            previews: (a.previews || []).map(p => ({
                name: p.name,
                frameRef: Object.assign({}, p.frameRef),
                source: p.source !== 'animated' && place.has(p.source) ? place.get(p.source) : 'animated',
                opacity: p.opacity, tint: p.tint, visible: p.visible,
                anchor: place.has(p.anchorId) ? place.get(p.anchorId) : 0
            })),
            frames: a.frames.map(f => {
                const c = {};
                for (const id of Object.keys(f.cels)) {
                    if (place.has(Number(id))) c[place.get(Number(id))] = ref(f.cels[id]);
                }
                return { delay: f.delayTicks, cels: c };
            })
        }));
        const open = this.animations.findIndex(a => a.id === this.openId);
        // The autosave record carries keys; storeAutosaveCels writes the cels themselves, each once.
        if (celRefs) return { version: 1, celRefs: true, cels: cels.map(c => this.celKey(c)), list, open };
        return { version: 1, cels, list, open };
    }

    // ── Autosave: frames stored once each ───────────────────────────────────
    //
    // One autosave used to write the whole project as one IndexedDB record,
    // every frame included: 85-175 ms at about 100 MB of frames (M,
    // FIGURES.md), over the 100 ms an interface may stall (P, Nielsen 1993).
    // Frames are immutable, so a frame written once never needs writing
    // again: the record holds each cel's key, and only new cels are written,
    // one small record each, to Storage.STORES.ANIM_CELS.

    /** A cel's key in the autosave store, given the first time it is asked for. */
    celKey(cel) {
        if (!this._celKeys) this._celKeys = new WeakMap();
        let key = this._celKeys.get(cel);
        if (!key) {
            if (!this._celSession) this._celSession = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            this._celCounter = (this._celCounter || 0) + 1;
            key = this._celSession + '-' + this._celCounter;
            this._celKeys.set(cel, key);
        }
        return key;
    }

    /**
     * Before an autosave record with `celRefs` is written: write the cels it
     * names that are not stored yet. Nothing is deleted here - the record on
     * disk still names the old cels until the new one is safely written
     * (pruneAutosaveCels, after).
     * @param {Object} data - serialize(..., { celRefs: true }) output
     * @returns {Promise<number>} cels written
     */
    async storeAutosaveCels(data) {
        if (!this._storedCels) this._storedCels = new Set();
        const byKey = new Map();
        for (const a of this.animations) {
            for (const f of a.frames) for (const id of Object.keys(f.cels)) byKey.set(this.celKey(f.cels[id]), f.cels[id]);
        }
        let written = 0;
        for (const key of (data && data.celRefs ? data.cels : [])) {
            if (this._storedCels.has(key) || !byKey.has(key)) continue;
            await Storage.set(key, byKey.get(key), Storage.STORES.ANIM_CELS);
            this._storedCels.add(key);
            written++;
        }
        return written;
    }

    /**
     * After the autosave record naming `data`'s cels is written: delete the
     * stored cels it no longer names. Called only once the record is on disk,
     * so a failed write leaves the last good record whole.
     * @param {?Object} data - the written record's `animations` (none: every cel goes)
     * @returns {Promise<number>} cels deleted
     */
    async pruneAutosaveCels(data) {
        if (!this._storedCels) return 0;
        const wanted = new Set(data && data.celRefs ? data.cels : []);
        let deleted = 0;
        for (const key of [...this._storedCels]) {
            if (wanted.has(key)) continue;
            await Storage.delete(key, Storage.STORES.ANIM_CELS);
            this._storedCels.delete(key);
            deleted++;
        }
        return deleted;
    }

    /**
     * Before an autosave record is loaded: turn its cel keys back into cels
     * from the store. The cels keep their keys, so the next autosave does not
     * write them again.
     * @param {Object} data - the record's `animations`
     */
    async resolveAutosaveCels(data) {
        if (!data || !data.celRefs) return;
        const records = await Storage.getAll(Storage.STORES.ANIM_CELS);
        const byKey = new Map(records.map(r => [r.key, r.value]));
        if (!this._celKeys) this._celKeys = new WeakMap();
        this._storedCels = new Set(byKey.keys());
        data.cels = data.cels.map((key) => {
            const cel = byKey.get(key) || null;
            if (cel) this._celKeys.set(cel, key);
            return cel;
        });
        delete data.celRefs;
    }

    /** No autosave to restore (declined, stale or absent): its stored cels go too. */
    async clearAutosaveCels() {
        this._storedCels = new Set();
        try { await Storage.clear(Storage.STORES.ANIM_CELS); } catch (e) { /* the store may not exist in a fallback */ }
    }

    /** Read `serialize` output back over freshly restored layers. */
    load(data, layers = LayerManager.layers) {
        this.pause();
        this.animations = [];
        this.openId = null;
        if (!data || !Array.isArray(data.list) || !Array.isArray(data.cels)) { this._emitChanged(); return; }
        for (const s of data.list) {
            const layerIds = (s.layers || []).filter(i => layers[i]).map(i => layers[i].id);
            if (!layerIds.length || !Array.isArray(s.frames) || !s.frames.length) continue;
            const frames = s.frames.map(f => {
                const cels = {};
                for (const [place, ci] of Object.entries(f.cels || {})) {
                    const layer = layers[Number(place)];
                    if (layer && data.cels[ci]) cels[layer.id] = data.cels[ci];
                }
                return makeFrame(AnimationServiceClass.clampDelay(f.delay), cels);
            });
            this.animations.push({
                id: this._nextId++,
                name: String(s.name || this._defaultName(s.kind)),
                kind: s.kind === 'sprite' ? 'sprite' : 'screen',
                rect: s.rect && s.kind === 'sprite' ? AnimationServiceClass.onGrid(s.rect) : AnimationServiceClass.fullRect(),
                layerIds,
                frames,
                previews: (Array.isArray(s.previews) ? s.previews : []).map(p => Object.freeze({
                    id: this._nextId++,
                    name: p.name || null,
                    frameRef: Object.freeze(p.frameRef && p.frameRef.relative !== undefined
                        ? { relative: p.frameRef.relative < 0 ? -1 : 1 }
                        : { frame: Helpers.clamp((p.frameRef && p.frameRef.frame) | 0, 0, frames.length - 1) }),
                    source: p.source === 'animated' || !layers[p.source] ? 'animated' : layers[p.source].id,
                    opacity: Helpers.clamp(Math.round(Number(p.opacity)) || 0, 0, 100),
                    tint: p.tint !== false,
                    visible: p.visible !== false,
                    anchorId: layers[p.anchor] ? layers[p.anchor].id : layers[0].id
                })),
                current: Helpers.clamp(s.current | 0, 0, frames.length - 1)
            });
        }
        const open = this.animations[data.open] || this.animations[0];
        this.openId = open ? open.id : null;
        this._emitChanged();
    }

    // ── Playback ────────────────────────────────────────────────────────────

    setSpeed(speed) { const s = Number(speed); if (s > 0) this.playback.speed = s; this._emitFrame(); }
    getSpeed() { return this.playback.speed; }
    setRepeat(mode) { if (['loop', 'once', 'pingpong'].includes(mode)) this.playback.repeat = mode; this._emitFrame(); }
    getRepeat() { return this.playback.repeat; }

    /** Play from frame A to frame B (indices; B null = the last frame). */
    setRange(from, to) {
        this.playback.from = Math.max(0, from | 0);
        this.playback.to = to === null || to === undefined ? null : Math.max(0, to | 0);
        this._emitFrame();
    }

    getRange(anim = this.getOpen()) {
        const n = anim ? anim.frames.length : 1;
        let from = Math.min(this.playback.from, n - 1);
        let to = this.playback.to === null ? n - 1 : Math.min(this.playback.to, n - 1);
        if (to < from) [from, to] = [to, from];
        return { from, to };
    }

    /** How long frame `i` stays on screen while playing, in ms: its delay / speed, never under one tick. */
    frameDuration(anim, i) {
        return Math.max(TICK_MS, (anim.frames[i].delayTicks * TICK_MS) / this.playback.speed);
    }

    /** Which frame follows `i` under the repeat setting; -1 when playback should end. */
    nextIndex(anim, i) {
        const { from, to } = this.getRange(anim);
        if (i < from || i > to) return from;
        if (this.playback.repeat === 'pingpong') {
            if (from === to) return from;
            let j = i + this._dir;
            if (j > to || j < from) { this._dir = -this._dir; j = i + this._dir; }
            return j;
        }
        if (i < to) return i + 1;
        return this.playback.repeat === 'once' ? -1 : from;
    }

    play() {
        const a = this.getOpen();
        if (!a || this._playing || a.frames.length < 2) return false;
        if (window.UndoRedo && UndoRedo.isActionOpen()) return false;
        this.flushAll();
        this._playing = true;
        this._syncHook();   // previews are hidden while playing
        this._dir = 1;
        this._playStart = a.current;
        const { from, to } = this.getRange(a);
        if (a.current < from || a.current > to) this.goTo(from, { flush: false });
        this._due = performance.now() + this.frameDuration(a, a.current);
        this._schedule();
        this._emitFrame();
        return true;
    }

    _schedule() {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._tick(), Math.max(0, this._due - performance.now()));
    }

    _tick() {
        this._timer = null;
        const a = this.getOpen();
        if (!this._playing || !a) { this.pause(); return; }
        const j = this.nextIndex(a, a.current);
        if (j < 0) { this.pause(); return; }
        // Nothing can be edited while playing, so the frame shown never needs a flush.
        this.goTo(j, { flush: false });
        // From the previous due time, not from now: the clock does not drift.
        this._due += this.frameDuration(a, a.current);
        const now = performance.now();
        if (this._due < now) this._due = now;   // a frame that took longer than its delay is shown late
        this._schedule();
    }

    pause() {
        if (this._timer) clearTimeout(this._timer);
        this._timer = null;
        if (!this._playing) return;
        this._playing = false;
        this._syncHook();
        const a = this.getOpen();
        if (a && a.previews.length) this._compose(a);   // the previews come back
        this._emitFrame();
    }

    togglePlay() { if (this._playing) this.pause(); else this.play(); }

    /** Stop: back to the frame playback started from. */
    stop() {
        const wasPlaying = this._playing;
        this.pause();
        if (wasPlaying) this.goTo(this._playStart, { flush: false });
    }
}

window.AnimationServiceClass = AnimationServiceClass;
window.AnimationService = new AnimationServiceClass();

})();
