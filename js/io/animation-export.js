'use strict';
(function() {

/**
 * AnimationExport - Animation > Export: an animation's frames out of PixULA.
 *
 *  - Numbered Spectrum screens: one file per frame, walk_001.scr, walk_002.scr,
 *    in the mode's own screen format. Each frame is shown in turn and saved
 *    through that format's own Save Image As code, with FormatRegistry
 *    capturing the bytes instead of saving them, so every file is byte for byte
 *    what a single save of that frame writes - Flash, palettes and layout
 *    included. Written into a chosen folder where the browser can, else as one
 *    store-only .zip (ZipStore).
 *  - Animated GIF (GIFFormat.encode): frame changes, the FLASH swap every 16
 *    ticks and the GigaScreen swap every tick, merged on the one 50 Hz count.
 *  - PNG sprite sheet, SevenuP .sev with all frames, tape (one SCREEN$ per
 *    frame), Next .spr (16 x 16 sprites in the indexed modes).
 *
 * The whole screen of a frame is what it looks like then: for a sprite
 * animation, the backdrop with the sprite's frame in its window.
 */

/** Screen formats a frame can be saved as, in the order the dialog offers them; each is shown only where it can export. */
const SCREEN_EXTS = ['scr', 'zxp', 'mlt', 'ifl', 'hrg', 'img', 'mg8', 'mg4', 'mg2', 'mg1', 'nxi', 'sl2', 'slr', 'bin', 'atr', 'png', 'bmp'];
/** [C] FLASH swaps every 320 ms (P, FIGURES.md section on the FLASH clock) = 16 ticks of 20 ms. */
const FLASH_TICKS = 16;
/** [C] One tick in GIF hundredths of a second: 20 ms / 10 ms. */
const CS_PER_TICK = AnimationServiceClass.TICK_MS / 10;
/** [A] Frames across a PNG sheet before it starts a new row; a layout choice, not a limit. */
const SHEET_COLUMNS = 16;
/** [P] Next sprites: 16 x 16 pixels, at most 64 in a sheet (SpriteService). */
const SPR_SIZE = 16;

class AnimationExportClass {
    _t(key, fallback, params) { return Helpers.localizedMessage(key, fallback, params); }

    _notice(key, fallback, params) {
        EventBus.emit(EVENTS.STATUS_NOTICE, { text: this._t(key, fallback, params) });
    }

    /** A file name from the animation's name: the characters file systems refuse are taken out. */
    baseName(anim) {
        const s = String(anim && anim.name || '').replace(/[\\/:*?"<>|\x00-\x1F]+/g, '').trim();
        return s || 'animation';
    }

    /** Screen formats the current mode can save, as [ext, label]. */
    screenFormats() {
        return SCREEN_EXTS
            .map(ext => [ext, FormatRegistry.getExportHandler(ext)])
            .filter(([, h]) => h && (typeof h.canExport !== 'function' || h.canExport()))
            .map(([ext]) => [ext, this._t('format.' + ext, ext.toUpperCase())]);
    }

    /** Why `kind` cannot export now, or null. */
    refusal(kind) {
        const a = AnimationService.getOpen();
        if (!a) return this._t('anim.needAnimation', 'Preview layers show other frames of an animation. Start one from the Animation menu first.');
        const n = a.frames.length;
        if (kind === 'sev') {
            if (!Helpers.hasStandardScreenLayout()) return this._t('anim.export.sevMode', 'SevenuP files hold Standard screens only.');
            if (n > SEVFormat.MAX_FRAMES) return this._t('anim.export.sevFrames', 'A SevenuP file holds at most {n} frames.', { n: SEVFormat.MAX_FRAMES });
        }
        if ((kind === 'tap' || kind === 'tzx') && !TAPFormat.canExport()) {
            return this._t('anim.export.tapeMode', 'Tapes hold Standard screens only.');
        }
        if (kind === 'spr') {
            const w = a.rect.cw * ZX_SPECTRUM.CELL_WIDTH, h = a.rect.ch * ZX_SPECTRUM.CELL_HEIGHT;
            if (!window.SpriteService || !SpriteService.isCanvasCompatible() || w !== SPR_SIZE || h !== SPR_SIZE) {
                return this._t('anim.export.sprShape', 'Next sprites are 16 x 16 in the Layer 2 and LoRes modes: make a 16 x 16 sprite animation there.');
            }
            if (n > SpriteService.MAX_SPRITES) return this._t('anim.export.sprFrames', 'A sprite sheet holds at most {n} sprites.', { n: SpriteService.MAX_SPRITES });
        }
        if (kind === 'screens' && !this.screenFormats().length) {
            return this._t('anim.export.noScreenFormat', 'This screen mode has no screen file format.');
        }
        return null;
    }

    /**
     * Show each frame of `indices` in turn and call `fn(i)` - a real frame
     * change, so whatever runs sees the picture exactly as it is at that frame.
     * Drawing is held off meanwhile, and the frame that was shown comes back.
     * @private
     */
    async _eachFrame(indices, fn) {
        const S = AnimationService;
        const a = S.getOpen();
        S.pause();
        S.flushAll();
        const origin = a.current;
        S.setBusy(true);
        try {
            for (const i of indices) {
                S.goTo(i, { anim: a });
                await fn(i);
            }
        } finally {
            S.goTo(origin, { anim: a });
            S.setBusy(false);
        }
    }

    /** The frame indices from..to (1-based input clamped to the animation). @private */
    _range(a, from, to) {
        const n = a.frames.length;
        const f = Helpers.clamp((from | 0) || 0, 0, n - 1);
        const t = Helpers.clamp(to === null || to === undefined ? n - 1 : (to | 0), 0, n - 1);
        const out = [];
        for (let i = Math.min(f, t); i <= Math.max(f, t); i++) out.push(i);
        return out;
    }

    /** Bytes of a captured download (a format may hand over a Blob). @private */
    async _bytes(data) {
        if (data instanceof Uint8Array) return data;
        if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
        return new Uint8Array(data);
    }

    /** The numbered file name for the k-th file. */
    numberedName(base, ext, number, digits) {
        return `${base}_${String(number).padStart(digits, '0')}.${ext}`;
    }

    /**
     * Every frame as its own Spectrum screen file, numbered in frame order.
     * @param {{ext: string, base?: string, first?: number, digits?: number, from?: number, to?: ?number, folder?: boolean}} opts
     *   from/to are 0-based frame indices; folder false forces the zip
     * @returns {Promise<number>} files written (0 when cancelled)
     */
    async exportNumbered({ ext, base = null, first = 1, digits = 3, from = 0, to = null, folder = true } = {}) {
        const why = this.refusal('screens');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return 0; }
        const a = AnimationService.getOpen();
        const handler = FormatRegistry.getExportHandler(ext);
        if (!handler || (typeof handler.canExport === 'function' && !handler.canExport())) return 0;
        const name = base || this.baseName(a);
        const indices = this._range(a, from, to);
        const last = first + indices.length - 1;
        const width = Math.max(digits | 0, String(last).length);

        // The folder first: the browser only offers its picker straight after a click.
        let provider = null, folderRef = null;
        if (folder && typeof BrowserFSAProvider === 'function') {
            provider = new BrowserFSAProvider();
            if (provider.isAvailable()) {
                folderRef = await provider.chooseFolder('pixula-animation-screens');
                if (!folderRef) return 0;   // cancelled
            } else {
                provider = null;
            }
        }

        const files = [];
        await this._eachFrame(indices, async (i) => {
            const file = this.numberedName(name, ext, first + files.length, width);
            const got = await FormatRegistry.captureDownloads(() => handler.exportAndDownload(file, {}, null));
            if (got.length) files.push({ name: file, data: await this._bytes(got[0].data) });
        });
        if (!files.length) return 0;

        if (folderRef) {
            for (const f of files) await provider.writeFile(folderRef, f.name, f.data);
        } else {
            const zip = ZipStore.build(files);
            const saved = await FormatRegistry.download(zip, `${name}.zip`, 'application/zip');
            if (!saved) return 0;
        }
        this._notice('anim.export.screensDone', 'Saved {n} screens.', { n: files.length });
        return files.length;
    }

    /** Frame order for the GIF: the range, played as the Repeat setting plays it. @private */
    _sequence(a) {
        const { from, to } = AnimationService.getRange(a);
        const seq = [];
        for (let i = from; i <= to; i++) seq.push(i);
        if (AnimationService.getRepeat() === 'pingpong') for (let i = to - 1; i > from; i--) seq.push(i);
        return seq;
    }

    /** Cut a window out of a whole-screen index array. @private */
    _crop(indices, a) {
        if (a.kind !== 'sprite') return indices;
        const W = ZX_SPECTRUM.WIDTH;
        const x0 = a.rect.cx * ZX_SPECTRUM.CELL_WIDTH, y0 = a.rect.cy * ZX_SPECTRUM.CELL_HEIGHT;
        const w = a.rect.cw * ZX_SPECTRUM.CELL_WIDTH, h = a.rect.ch * ZX_SPECTRUM.CELL_HEIGHT;
        const out = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) out.set(indices.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w);
        return out;
    }

    /**
     * The GIF timeline: each frame for its delay, split wherever FLASH or the
     * GigaScreen swap changes phase, on one 50 Hz count from the start.
     * @param {Array<{delayTicks:number, kind:string, phases:Uint8Array[]}>} shots - in play order
     * @returns {Array<{indices: Uint8Array, delayCs: number}>}
     */
    timeline(shots) {
        const out = [];
        let t = 0;
        for (const s of shots) {
            for (let k = 0; k < s.delayTicks; k++, t++) {
                const phase = s.kind === 'giga' ? (t & 1) : s.kind === 'flash' ? (Math.floor(t / FLASH_TICKS) & 1) : 0;
                const indices = s.phases[Math.min(phase, s.phases.length - 1)];
                const prev = out[out.length - 1];
                if (prev && prev.indices === indices) prev.delayCs += CS_PER_TICK;
                else out.push({ indices, delayCs: CS_PER_TICK });
            }
        }
        return out;
    }

    async exportGif() {
        const why = this.refusal('gif');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return false; }
        const a = AnimationService.getOpen();
        const seq = this._sequence(a);
        const shot = new Map();
        let palette = null;
        await this._eachFrame([...new Set(seq)], async (i) => {
            const p = GIFFormat.phases();
            palette = p.palette;
            shot.set(i, { delayTicks: a.frames[i].delayTicks, kind: p.kind, phases: p.phases.map(x => this._crop(x, a)) });
        });
        const frames = this.timeline(seq.map(i => shot.get(i)));
        const w = a.kind === 'sprite' ? a.rect.cw * ZX_SPECTRUM.CELL_WIDTH : ZX_SPECTRUM.WIDTH;
        const h = a.kind === 'sprite' ? a.rect.ch * ZX_SPECTRUM.CELL_HEIGHT : ZX_SPECTRUM.HEIGHT;
        const gif = GIFFormat.encode({
            width: w, height: h, palette, frames,
            loop: AnimationService.getRepeat() === 'once' ? null : 0
        });
        return FormatRegistry.download(gif, `${this.baseName(a)}.gif`, 'image/gif');
    }

    /** All frames side by side (16 across) as one PNG. */
    async exportSheet() {
        const why = this.refusal('sheet');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return false; }
        const a = AnimationService.getOpen();
        const w = a.rect.cw * ZX_SPECTRUM.CELL_WIDTH, h = a.rect.ch * ZX_SPECTRUM.CELL_HEIGHT;
        const n = a.frames.length;
        const cols = Math.min(n, SHEET_COLUMNS), rows = Math.ceil(n / cols);
        const canvas = Helpers.createCanvas(cols * w, rows * h);
        const ctx = canvas.getContext('2d');
        const pictures = [];
        if (a.kind === 'sprite') {
            // A sprite sheet holds the sprite: its own layers over the paper, without the backdrop.
            for (let i = 0; i < n; i++) {
                AnimationService.flush(a);
                const pic = AnimationService.renderFrame(a, i);
                pictures.push(new ImageData(new Uint8ClampedArray(pic.words.buffer), pic.width, pic.height));
            }
        } else {
            await this._eachFrame(this._range(a, 0, null), async () => {
                pictures.push(Helpers.cropImageData(LayerManager.stillImageData(), { x: 0, y: 0, width: w, height: h }));
            });
        }
        pictures.forEach((img, i) => ctx.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h));
        const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create PNG'))), 'image/png'));
        return FormatRegistry.download(blob, `${this.baseName(a)}-sheet.png`, 'image/png');
    }

    /** Every frame in one SevenuP file: the window's cells for a sprite, the whole screen otherwise. */
    async exportSev() {
        const why = this.refusal('sev');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return false; }
        const a = AnimationService.getOpen();
        const screens = [];
        await this._eachFrame(this._range(a, 0, null), async () => {
            screens.push(SCRFormat.export().subarray(0, SCREEN_MODES.STANDARD_ULA.fileSize).slice());
        });
        const part = a.kind === 'sprite' ? { cx: a.rect.cx, cy: a.rect.cy, cols: a.rect.cw, rows: a.rect.ch } : null;
        return FormatRegistry.download(SEVFormat.encodeFrames(screens, part), `${this.baseName(a)}.sev`);
    }

    /** One SCREEN$ per frame on a tape, named walk001, walk002 (the tape header holds 10 characters). */
    async exportTape(ext = 'tap') {
        const why = this.refusal(ext);
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return false; }
        const a = AnimationService.getOpen();
        const base = this.baseName(a).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '').slice(0, 7) || 'frame';
        const fmt = ext === 'tzx' ? TZXFormat : TAPFormat;
        const blocks = [];
        let k = 0;
        await this._eachFrame(this._range(a, 0, null), async () => {
            k++;
            const tapeName = (base + String(k).padStart(3, '0')).slice(-10);
            blocks.push(...fmt.buildScreenBlockPair({ name: tapeName }));
        });
        let bytes;
        if (ext === 'tzx') {
            const header = new Uint8Array(10);
            for (let i = 0; i < 7; i++) header[i] = TZXFormat.SIGNATURE.charCodeAt(i);
            header[7] = 0x1A;
            header[8] = TZXFormat.VERSION[0];
            header[9] = TZXFormat.VERSION[1];
            bytes = TZXFormat.serializeBlocks({ header, blocks });
        } else {
            bytes = TAPFormat.serializeBlocks(blocks);
        }
        return FormatRegistry.download(bytes, `${this.baseName(a)}.${ext}`);
    }

    /** Each frame as one 16 x 16 Next sprite in a .spr sheet. */
    async exportSpr() {
        const why = this.refusal('spr');
        if (why) { EventBus.emit(EVENTS.STATUS_NOTICE, { text: why }); return false; }
        const a = AnimationService.getOpen();
        const depth = SpriteService.getDepth();
        const mask = depth === 8 ? 0xFF : 0x0F;
        const x0 = a.rect.cx * ZX_SPECTRUM.CELL_WIDTH, y0 = a.rect.cy * ZX_SPECTRUM.CELL_HEIGHT;
        const sprites = [];
        await this._eachFrame(this._range(a, 0, null), async () => {
            // As SpriteService.captureFromCanvas reads a sprite: the composite, transparent where nothing is drawn.
            const flat = LayerManager.flattenVisible();
            const out = new Uint8Array(SPR_SIZE * SPR_SIZE);
            for (let y = 0; y < SPR_SIZE; y++)
                for (let x = 0; x < SPR_SIZE; x++) {
                    const idx = flat.getPixelIndex(x0 + x, y0 + y);
                    out[y * SPR_SIZE + x] = (idx >= 0 ? idx : SpriteService.transparencyIndex()) & mask;
                }
            sprites.push(out);
        });
        return FormatRegistry.download(SpriteFormat.encode(sprites, depth), `${this.baseName(a)}.spr`);
    }
}

window.AnimationExport = new AnimationExportClass();

})();
