'use strict';
/**
 * User presets — save a working setup, wreck it, recall it.
 *
 * The end-to-end proof that the slice registry, the codec, IndexedDB and the
 * recall bar are one working path. Rides the real storage on file://, so the
 * F5 checks are the genuine "does it survive a restart" question rather than an
 * in-memory imitation.
 *
 * The reference image is the interesting case: its POSITION is only meaningful
 * against the picture it was placed over, so the two must come back together
 * (and the image is content-hashed, so two presets tracing one photo must store
 * it once).
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

// A 2x2 red PNG — small, real, and a genuine data:image/ URL
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91' +
    'JpzAAAAF0lEQVQI12P8z8DAwMDAxMDAwMDAwAAADgEBAKl5FQAAAAAASUVORK5CYII=';

const clearPresets = (page) => page.evaluate(async () => {
    for (let i = 0; i < PresetCodec.SLOT_COUNT; i++) await PresetService.remove(i);
});

const setup = (page, opts) => page.evaluate((o) => {
    ToolManager.selectTool(TOOLS.BRUSH);
    const brush = ToolManager.getTool(TOOLS.BRUSH);
    brush.setSize(o.size);
    brush.setBrushType(o.brushType);
    ColorManager.setInk(o.ink);
    ColorManager.setPaper(o.paper);
    StateManager.setSymmetryMode(o.symmetry);
}, opts);

const readSetup = (page) => page.evaluate(() => {
    const brush = ToolManager.getTool(TOOLS.BRUSH);
    return {
        size: brush.getSize(),
        brushType: brush.getBrushType(),
        ink: ColorManager.getInk(),
        paper: ColorManager.getPaper(),
        symmetry: StateManager.getSymmetryMode()
    };
});

test('a saved preset restores the tool, its options, the colours and the modes', async ({ page }) => {
    await boot(page);
    await clearPresets(page);

    await setup(page, { size: 9, brushType: 'square', ink: 2, paper: 5, symmetry: 'h' });
    const saved = await page.evaluate(() =>
        PresetService.save(0, 'Blue square 9', ['tool', 'color', 'drawing'])
            .then(p => p && p.name));
    expect(saved).toBe('Blue square 9');

    // Wreck every one of them
    await setup(page, { size: 1, brushType: 'round', ink: 7, paper: 0, symmetry: 'off' });
    expect(await readSetup(page)).toEqual({
        size: 1, brushType: 'round', ink: 7, paper: 0, symmetry: 'off'
    });

    await page.evaluate(() => PresetService.apply(0));
    expect(await readSetup(page)).toEqual({
        size: 9, brushType: 'square', ink: 2, paper: 5, symmetry: 'h'
    });
});

test('slot presets survive a reload, and the manager lists filled and empty alike', async ({ page }) => {
    await boot(page);
    await clearPresets(page);

    await setup(page, { size: 14, brushType: 'round', ink: 3, paper: 1, symmetry: 'off' });
    await page.evaluate(() => PresetService.save(2, 'Fat round', ['tool', 'color']));
    await page.evaluate(() => PresetService.save(5, 'Second one', ['color']));

    await reload(page);

    const after = await page.evaluate(() => ({
        populated: PresetService.listPopulated().map(p => ({ slot: p.slot, name: p.name })),
        slots: PresetService.listSlots().length,
        shortcuts: PresetService.listPopulated().map(p => PresetCodec.slotShortcut(p.slot))
    }));

    expect(after.slots).toBe(9);
    expect(after.populated).toEqual([
        { slot: 2, name: 'Fat round' },
        { slot: 5, name: 'Second one' }
    ]);
    // the first nine slots answer to a key, and say which
    expect(after.shortcuts).toEqual(['Alt+3', 'Alt+6']);

    // and the restored preset still works after the reload
    await setup(page, { size: 1, brushType: 'round', ink: 7, paper: 7, symmetry: 'off' });
    await page.evaluate(() => PresetService.apply(2));
    const state = await readSetup(page);
    expect(state.size).toBe(14);
    expect(state.ink).toBe(3);
});

test('a preset carries the reference image with its position, across a reload',
    async ({ page }) => {
        await boot(page);
        await clearPresets(page);

        await page.evaluate(async (url) => {
            ReferenceLayerService.loadImage(url);
            // loadImage decodes asynchronously; wait for the fact
            await new Promise((resolve) => {
                const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
            });
            ReferenceLayerService.setOffset(17, -23);
            ReferenceLayerService.setScale(180);
            ReferenceLayerService.setOpacity(35);
        }, TINY_PNG);

        await page.evaluate(() => PresetService.save(1, 'Tracing setup', ['reference']));

        // Clear the reference entirely, then reload for good measure
        await page.evaluate(() => ReferenceLayerService.clearImage());
        await reload(page);
        expect(await page.evaluate(() => ReferenceLayerService.hasImage())).toBe(false);

        await page.evaluate(async () => {
            await PresetService.apply(1);
            await new Promise((resolve) => {
                const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
            });
        });

        const ref = await page.evaluate(() => ({
            hasImage: ReferenceLayerService.hasImage(),
            offset: ReferenceLayerService.getOffset(),
            scale: ReferenceLayerService.getScale(),
            opacity: ReferenceLayerService.getOpacity()
        }));

        expect(ref.hasImage).toBe(true);
        expect(ref.offset).toEqual({ x: 17, y: -23 });
        expect(ref.scale).toBe(180);
        expect(ref.opacity).toBe(35);
    });

test('two presets tracing the same image store it once', async ({ page }) => {
    await boot(page);
    await clearPresets(page);

    await page.evaluate(async (url) => {
        ReferenceLayerService.loadImage(url);
        await new Promise((resolve) => {
            const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
        });
    }, TINY_PNG);

    await page.evaluate(async () => {
        await PresetService.save(0, 'Close up', ['reference']);
        ReferenceLayerService.setOffset(40, 40);
        await PresetService.save(1, 'Wide', ['reference']);
    });

    const keys = await page.evaluate(() => ({
        a: PresetService.get(0).asset,
        b: PresetService.get(1).asset
    }));
    expect(keys.a).toBeTruthy();
    expect(keys.b).toBe(keys.a);   // content-addressed: one copy, two presets
});

test('a preset exports to a .zxpreset file and imports back into a free slot',
    async ({ page }) => {
        await boot(page);
        await clearPresets(page);

        await setup(page, { size: 21, brushType: 'square', ink: 6, paper: 2, symmetry: 'v' });
        await page.evaluate(() => PresetService.save(0, 'Portable', ['tool', 'color', 'drawing']));

        const text = await page.evaluate(() => PresetService.toFile(0));
        expect(typeof text).toBe('string');

        const landed = await page.evaluate(async (t) => {
            await PresetService.remove(0);
            const free = PresetService.firstFreeSlot();
            const stored = await PresetService.fromFile(t, free);
            return stored ? { slot: stored.slot, name: stored.name } : null;
        }, text);

        expect(landed).toEqual({ slot: 0, name: 'Portable' });

        await setup(page, { size: 1, brushType: 'round', ink: 0, paper: 7, symmetry: 'off' });
        await page.evaluate(() => PresetService.apply(0));
        expect(await readSetup(page)).toEqual({
            size: 21, brushType: 'square', ink: 6, paper: 2, symmetry: 'v'
        });
    });

test('the tool preset bar sits BELOW the tool options and survives a tool change',
    async ({ page }) => {
        await boot(page);

        expect(await page.$('#tool-preset-select')).not.toBeNull();

        await page.evaluate(() => ToolManager.selectTool(TOOLS.FILL));
        expect(await page.$('#tool-preset-select')).not.toBeNull();

        await page.evaluate(() => ToolManager.selectTool(TOOLS.BRUSH));
        expect(await page.$('#tool-preset-select')).not.toBeNull();

        // exactly one bar in this panel, not one per tool render. (Scoped:
        // the Reference panel has a row of its own, pointed at its own scope.)
        expect(await page.evaluate(() =>
            document.querySelectorAll('#tool-options-panel .preset-bar').length)).toBe(1);

        // and it is after the options, not before them: "save preset" is
        // what you reach for once the options above it are set
        const order = await page.evaluate(() => {
            const content = document.getElementById('tool-options-panel-content');
            const bar = document.querySelector('.preset-bar');
            // Node.DOCUMENT_POSITION_FOLLOWING === 4
            return (content.compareDocumentPosition(bar) & 4) === 4;
        });
        expect(order).toBe(true);

        const label = await page.textContent('#tool-preset-save');
        expect(label).toMatch(/preset/i);

        // a tool with nothing to capture gets no row at all, rather than two
        // controls that can only report emptiness
        await page.evaluate(() => ToolManager.selectTool(TOOLS.EYEDROPPER));
        expect(await page.evaluate(() =>
            document.getElementById('tool-preset-bar').hidden)).toBe(true);

        await page.evaluate(() => ToolManager.selectTool(TOOLS.BRUSH));
        expect(await page.evaluate(() =>
            document.getElementById('tool-preset-bar').hidden)).toBe(false);
    });

test('Alt+1..Alt+9 recall the first nine slots; an empty slot does nothing',
    async ({ page }) => {
        await boot(page);
        await clearPresets(page);

        await setup(page, { size: 11, brushType: 'square', ink: 5, paper: 1, symmetry: 'off' });
        await page.evaluate(() => PresetService.save(0, 'Alt one', ['tool', 'color']));

        await setup(page, { size: 26, brushType: 'round', ink: 2, paper: 6, symmetry: 'off' });
        await page.evaluate(() => PresetService.save(8, 'Alt nine', ['tool', 'color']));

        // wreck it, then recall slot 1 with Alt+1
        await setup(page, { size: 1, brushType: 'round', ink: 0, paper: 7, symmetry: 'off' });
        await page.keyboard.press('Alt+Digit1');
        await page.waitForFunction(() => ToolManager.getTool(TOOLS.BRUSH).getSize() === 11);
        expect((await readSetup(page)).ink).toBe(5);

        // Alt+9 is the last keyed slot
        await page.keyboard.press('Alt+Digit9');
        await page.waitForFunction(() => ToolManager.getTool(TOOLS.BRUSH).getSize() === 26);
        expect((await readSetup(page)).ink).toBe(2);

        // An empty keyed slot must not change anything, and must not throw
        await page.keyboard.press('Alt+Digit5');
        await page.waitForTimeout(50);
        expect((await readSetup(page)).size).toBe(26);
    });

test('Alt+0 recalls nothing and still zooms to actual size', async ({ page }) => {
    await boot(page);
    await clearPresets(page);

    // Zero is not a preset key. It would have to stand for a tenth slot, and
    // there is no tenth slot: the library is exactly the nine digits.
    expect(await page.evaluate(() => PresetCodec.slotForDigit('0'))).toBeNull();
    expect(await page.evaluate(() => PresetCodec.SLOT_COUNT)).toBe(9);
    expect(await page.evaluate(() => PresetCodec.isValidSlot(9))).toBe(false);

    // The LAST slot is keyed, so there is a real preset for Alt+0 to leave alone
    await setup(page, { size: 19, brushType: 'square', ink: 4, paper: 3, symmetry: 'off' });
    await page.evaluate(() => PresetService.save(8, 'Ninth slot', ['tool', 'color']));
    expect(await page.evaluate(() => PresetCodec.slotShortcut(8))).toBe('Alt+9');

    await setup(page, { size: 2, brushType: 'round', ink: 0, paper: 7, symmetry: 'off' });
    await page.evaluate(() => CanvasSystem.setZoom(400));

    await page.keyboard.press('Alt+Digit0');
    await page.waitForFunction(() => (CanvasSystem.zoomLevel ?? CanvasSystem.zoom) === ZOOM_CONFIG.MIN);

    // the preset was not loaded — Alt+0 kept its old meaning
    expect((await readSetup(page)).size).toBe(2);

    // ...and Alt+9 does recall it
    await page.keyboard.press('Alt+Digit9');
    await page.waitForFunction(() => ToolManager.getTool(TOOLS.BRUSH).getSize() === 19);
});

test('a bare digit still sets the ink colour, unshadowed by preset recall',
    async ({ page }) => {
        await boot(page);
        await clearPresets(page);
        await page.evaluate(() => PresetService.save(2, 'Slot three', ['tool']));

        await page.evaluate(() => ColorManager.setInk(0));
        await page.keyboard.press('Digit3');
        expect(await page.evaluate(() => ColorManager.getInk())).toBe(2);

        // and Shift+digit still sets paper
        await page.keyboard.press('Shift+Digit5');
        expect(await page.evaluate(() => ColorManager.getPaper())).toBe(4);
    });

test('a slot preset carries a hover description, and knows its own shortcut',
    async ({ page }) => {
        await boot(page);
        await clearPresets(page);

        await page.evaluate(() =>
            PresetService.save(0, 'Sprite tracing', ['tool'], 'Traced at 3x with the grid off'));
        await page.evaluate(() =>
            PresetService.save(8, 'The last one', ['tool'], ''));

        const listed = await page.evaluate(() => PresetService.listPopulated().map(p => ({
            name: p.name, description: p.description, shortcut: PresetCodec.slotShortcut(p.slot)
        })));

        expect(listed[0].name).toBe('Sprite tracing');
        expect(listed[0].shortcut).toBe('Alt+1');
        expect(listed[0].description).toBe('Traced at 3x with the grid off');
        // EVERY slot is keyed since the library shrank to nine, including the
        // last one - there is no unkeyed tier any more. A preset with no note
        // still reports an empty description rather than a missing one.
        expect(listed[1].name).toBe('The last one');
        expect(listed[1].shortcut).toBe('Alt+9');
        expect(listed[1].description).toBe('');

        // the description survives a reload and a rename leaves it alone
        await reload(page);
        await page.evaluate(() => PresetService.rename(0, 'Renamed'));
        const after = await page.evaluate(() => PresetService.get(0));
        expect(after.name).toBe('Renamed');
        expect(after.description).toBe('Traced at 3x with the grid off');
    });

test('saving never captures the artwork', async ({ page }) => {
    await boot(page);
    await clearPresets(page);

    await page.evaluate(() => {
        UndoRedo.beginAction('seed');
        PixelDrawRoutine.draw(30, 30, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        UndoRedo.endAction();
    });
    await page.evaluate(() => PresetService.save(0, 'Everything', PresetService.getSliceIds()));

    const payload = await page.evaluate(() => JSON.stringify(PresetService.get(0)));
    // A preset is a workspace, not a document: no layer, pixel or grid data
    expect(payload).not.toMatch(/"layers"/);
    expect(payload).not.toMatch(/"pixels"/);
    // and it stays small enough to rewrite on every save
    expect(payload.length).toBeLessThan(20000);
});

test('nine slots, every one reachable by a chord, and no stale rows left behind',
    async ({ page }) => {
        await boot(page);

        // Records where the OLD 24-slot library would have put them. Nothing
        // reads slots 9..23 now, so they must not simply sit in IndexedDB.
        await page.evaluate(async () => {
            for (const slot of [9, 15, 23]) {
                await Storage.set('slot:' + slot, {
                    v: 1, slot, name: 'Old ' + slot, description: '',
                    created: 1, modified: 1, meta: {},
                    slices: { color: { ink: 1 } }, asset: null
                }, Storage.STORES.PRESETS);
            }
        });

        await reload(page);

        const r = await page.evaluate(async () => {
            const stale = [];
            for (const s of [9, 15, 23]) {
                stale.push(!!await Storage.get('slot:' + s, Storage.STORES.PRESETS));
            }
            return {
                slotCount: PresetCodec.SLOT_COUNT,
                keySlots: PresetCodec.KEY_SLOTS,
                librarySize: PresetService.listSlots().length,
                everySlotKeyed: PresetService.listSlots()
                    .every(({ slot }) => PresetCodec.slotShortcut(slot) !== null),
                stale,
                ninthInvalid: PresetCodec.isValidSlot(9)
            };
        });

        expect(r.slotCount).toBe(9);
        // The count IS the keyboard: no unkeyed remainder, by construction
        expect(r.keySlots).toBe(r.slotCount);
        expect(r.librarySize).toBe(9);
        expect(r.everySlotKeyed).toBe(true);
        expect(r.ninthInvalid).toBe(false);
        // _dropSlotsAboveCount cleared them on boot
        expect(r.stale).toEqual([false, false, false]);
    });
