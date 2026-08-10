'use strict';
/**
 * Tool presets — save this brush, get this brush back.
 *
 * The feature's promise is narrow and testable: a preset saved from a tool's
 * own panel restores that tool's settings, MOVES NOTHING ELSE, and is offered
 * to no other tool. Each of those three is a separate way the thing could go
 * wrong in use, so each gets its own check against the real UI over file://,
 * real IndexedDB and a real F5.
 *
 * The "moves nothing else" one matters most. It is the reason this exists as a
 * separate kind of preset from the slotted workspace capture: a control under
 * the brush sliders that silently changed the ink colour or jumped the zoom
 * would be a control nobody could use mid-drawing.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const clearToolPresets = (page) => page.evaluate(async () => {
    // presetScopeIds, not Object.values(TOOLS): the reference scope is not a
    // tool, and a leftover tracing preset would leak into the next spec.
    for (const id of PresetService.presetScopeIds()) {
        for (const preset of PresetService.listToolPresets(id).slice()) {
            await PresetService.removeToolPreset(id, preset.name);
        }
    }
});

const brushState = (page) => page.evaluate(() => {
    const brush = ToolManager.getTool(TOOLS.BRUSH);
    return { size: brush.getSize(), brushType: brush.getBrushType() };
});

test('a tool preset restores that tool and moves nothing else', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    // A whole working setup, of which the preset must restore only the brush
    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.BRUSH);
        const brush = ToolManager.getTool(TOOLS.BRUSH);
        brush.setSize(14);
        brush.setBrushType('square');
        ColorManager.setInk(3);
        StateManager.setSymmetryMode('off');
        StateManager.setZoom(200);
    });
    await page.evaluate(() => PresetService.saveToolPreset(TOOLS.BRUSH, 'Fat square'));

    // Wreck the brush AND move everything around it
    await page.evaluate(() => {
        const brush = ToolManager.getTool(TOOLS.BRUSH);
        brush.setSize(1);
        brush.setBrushType('round');
        ColorManager.setInk(6);
        StateManager.setSymmetryMode('h');
        StateManager.setZoom(400);
    });

    await page.evaluate(() => PresetService.applyToolPreset(TOOLS.BRUSH, 'Fat square'));

    expect(await brushState(page)).toEqual({ size: 14, brushType: 'square' });

    // ...and everything that is not the brush stayed where the artist left it
    const around = await page.evaluate(() => ({
        ink: ColorManager.getInk(),
        symmetry: StateManager.getSymmetryMode(),
        zoom: StateManager.getZoom()
    }));
    expect(around).toEqual({ ink: 6, symmetry: 'h', zoom: 400 });
});

test('the options panel shows the values a preset just put behind it', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(21);
    });
    await page.evaluate(() => PresetService.saveToolPreset(TOOLS.BRUSH, 'Twenty one'));

    // Wreck it the way a user does — by dragging the slider, so the panel and
    // the tool genuinely agree before the preset is loaded over the top.
    await page.fill('#tool-options-panel-content input[type="range"]', '2');
    await page.dispatchEvent('#tool-options-panel-content input[type="range"]', 'input');
    expect((await brushState(page)).size).toBe(2);

    // Through the UI, not the service: the select IS the load control
    await page.selectOption('#tool-preset-select', 'Twenty one');

    expect(await page.inputValue('#tool-options-panel-content input[type="range"]')).toBe('21');
    // the menu returns to its prompt so the same entry can be picked again
    expect(await page.inputValue('#tool-preset-select')).toBe('');
});

test('a tool is offered only its own presets', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    await page.evaluate(async () => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(7);
        await PresetService.saveToolPreset(TOOLS.BRUSH, 'Brush one');

        ToolManager.selectTool(TOOLS.ERASER);
        ToolManager.getTool(TOOLS.ERASER).setSize(30);
        await PresetService.saveToolPreset(TOOLS.ERASER, 'Eraser one');
    });

    const onEraser = await page.evaluate(() =>
        Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
    expect(onEraser).toEqual(['', 'Eraser one']);

    await page.evaluate(() => ToolManager.selectTool(TOOLS.BRUSH));
    const onBrush = await page.evaluate(() =>
        Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
    expect(onBrush).toEqual(['', 'Brush one']);

    // ...but the PANEL is the library and shows both, whichever tool is held
    const panel = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#tool-preset-panel-content .preset-library-load'))
            .map(b => ({
                scope: b.querySelector('.preset-library-scope').textContent,
                settings: b.querySelector('.preset-library-settings').textContent,
                name: b.title
            })));

    expect(panel).toHaveLength(2);
    expect(panel.map(r => r.scope.toLowerCase())).toEqual(['brush', 'eraser']);
    // The row leads with the tool and what the preset changes; the name you
    // gave it is the hover, because across tools the name identifies nothing
    expect(panel[0].name).toBe('Brush one');
    expect(panel[1].name).toBe('Eraser one');
    expect(panel[0].settings).toMatch(/7/);
    expect(panel[1].settings).toMatch(/30/);
});

test('a library row names the settings it changes, not the fifteen it does not',
    async ({ page }) => {
        await boot(page);
        await clearToolPresets(page);

        await page.evaluate(async () => {
            ToolManager.selectTool(TOOLS.BRUSH);
            const brush = ToolManager.getTool(TOOLS.BRUSH);
            brush.setSize(16);
            brush.setPressureSensitivity(true);
            await PresetService.saveToolPreset(TOOLS.BRUSH, 'Fat marker');
        });

        const row = await page.evaluate(() => {
            const b = document.querySelector('#tool-preset-panel-content .preset-library-load');
            return b.querySelector('.preset-library-settings').textContent;
        });

        expect(row).toMatch(/16/);
        // A checkbox reads as a word, not as "true"
        expect(row).toMatch(/on/i);
        expect(row).not.toMatch(/true/);
        // Untouched options are absent: the brush captures many more than two
        expect(row).not.toMatch(/jitter/i);

        // A preset that changes nothing says so rather than showing a blank
        await page.evaluate(async () => {
            const brush = ToolManager.getTool(TOOLS.BRUSH);
            brush.setSize(1);
            brush.setPressureSensitivity(false);
            await PresetService.saveToolPreset(TOOLS.BRUSH, 'Straight out of the box');
        });
        const rows = await page.evaluate(() =>
            Array.from(document.querySelectorAll('#tool-preset-panel-content .preset-library-settings'))
                .map(e => e.textContent));
        expect(rows.some(r => /default/i.test(r))).toBe(true);
    });

test('nothing in the Presets panel is named after one tool', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    await page.evaluate(async () => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(9);
        await PresetService.saveToolPreset(TOOLS.BRUSH, 'Nine');
    });

    const panel = await page.evaluate(() => {
        const save = document.querySelector('#tool-preset-panel-content .preset-panel-save');
        return {
            title: document.getElementById('tool-preset-panel-title').textContent,
            saveLabel: save.textContent,
            saveTitle: save.title
        };
    });

    // The panel lists every tool, so its chrome must not claim one of them
    expect(panel.title).toBe('Presets');
    expect(panel.saveLabel).not.toMatch(/brush/i);
    // ...but the tool it will save is still knowable, from the tooltip
    expect(panel.saveTitle).toMatch(/brush/i);

    // and it follows the tool in hand
    await page.evaluate(() => ToolManager.selectTool(TOOLS.ERASER));
    const afterSwitch = await page.evaluate(() =>
        document.querySelector('#tool-preset-panel-content .preset-panel-save').title);
    expect(afterSwitch).toMatch(/eraser/i);
    expect(afterSwitch).not.toMatch(/\{tool\}/);
});

test('loading from the library takes that preset\'s tool in hand first',
    async ({ page }) => {
        await boot(page);
        await clearToolPresets(page);

        await page.evaluate(async () => {
            ToolManager.selectTool(TOOLS.ERASER);
            ToolManager.getTool(TOOLS.ERASER).setSize(41);
            await PresetService.saveToolPreset(TOOLS.ERASER, 'Big rubber');
            ToolManager.selectTool(TOOLS.BRUSH);
        });

        expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('brush');

        await page.click('#tool-preset-panel-content .preset-library-load');

        // A list spanning tools would otherwise be a list where most rows
        // appear to do nothing
        expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('eraser');
        expect(await page.evaluate(() =>
            ToolManager.getTool(TOOLS.ERASER).getSize())).toBe(41);
    });

test('a brush variant is its own tool, sharing one class but not one list',
    async ({ page }) => {
        await boot(page);
        await clearToolPresets(page);

        await page.evaluate(async () => {
            ToolManager.selectTool(TOOLS.SPRAY);
            await PresetService.saveToolPreset(TOOLS.SPRAY, 'My spray');
            ToolManager.selectTool(TOOLS.BRUSH);
        });

        // On the base Brush button the spray's preset is not on offer, even
        // though one BrushTool instance serves them both
        const onBrush = await page.evaluate(() =>
            Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
        expect(onBrush).toEqual(['']);

        await page.evaluate(() => ToolManager.selectTool(TOOLS.SPRAY));
        const onSpray = await page.evaluate(() =>
            Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
        expect(onSpray).toEqual(['', 'My spray']);
    });

test('tool presets survive a reload, in the real database', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    await page.evaluate(async () => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(19);
        await PresetService.saveToolPreset(TOOLS.BRUSH, 'Nineteen');
    });

    await reload(page);

    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(1);
    });
    await page.evaluate(() => PresetService.applyToolPreset(TOOLS.BRUSH, 'Nineteen'));
    expect((await brushState(page)).size).toBe(19);

    // and it is listed on the first render after boot, not only after a change
    const listed = await page.evaluate(() =>
        Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
    expect(listed).toContain('Nineteen');
});

test('the panel renames and deletes; re-saving a name replaces it', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    await page.evaluate(async () => {
        ToolManager.selectTool(TOOLS.BRUSH);
        ToolManager.getTool(TOOLS.BRUSH).setSize(5);
        await PresetService.saveToolPreset(TOOLS.BRUSH, 'Five');
    });

    // Re-saving the same name replaces rather than making an unreadable twin
    await page.evaluate(async () => {
        ToolManager.getTool(TOOLS.BRUSH).setSize(6);
        await PresetService.saveToolPreset(TOOLS.BRUSH, 'Five');
    });
    let names = await page.evaluate(() =>
        PresetService.listToolPresets(TOOLS.BRUSH).map(p => p.name));
    expect(names).toEqual(['Five']);
    expect(await page.evaluate(() =>
        PresetService.getToolPreset(TOOLS.BRUSH, 'Five').options.size)).toBe(6);

    // The name lives on the row's hover, so that is where a rename shows
    await page.evaluate(() => PresetService.renameToolPreset(TOOLS.BRUSH, 'Five', 'Six really'));
    names = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#tool-preset-panel-content .preset-library-load'))
            .map(b => b.title));
    expect(names).toEqual(['Six really']);

    await page.evaluate(() => PresetService.removeToolPreset(TOOLS.BRUSH, 'Six really'));
    expect(await page.evaluate(() =>
        document.querySelectorAll('#tool-preset-panel-content .preset-library-load').length)).toBe(0);
});

test('a tool with nothing to capture says so instead of offering empty controls',
    async ({ page }) => {
        await boot(page);

        await page.evaluate(() => ToolManager.selectTool(TOOLS.EYEDROPPER));
        expect(await page.evaluate(() =>
            document.getElementById('tool-preset-bar').hidden)).toBe(true);
        expect(await page.evaluate(() =>
            document.querySelector('#tool-preset-panel-content .no-options') !== null)).toBe(true);
        expect(await page.evaluate(() =>
            document.querySelector('#tool-preset-panel-content .preset-panel-save'))).toBeNull();
    });

test('the Presets panel is ordinary sidebar chrome: titled, and it collapses',
    async ({ page }) => {
        await boot(page);

        const panel = await page.evaluate(() => {
            const section = document.getElementById('tool-preset-panel');
            const title = document.getElementById('tool-preset-panel-title');
            return {
                inSidebar: section.parentElement.id === 'panels',
                stampedFromTemplate: section.classList.contains('panel'),
                title: title.textContent,
                labelled: section.getAttribute('aria-labelledby') === title.id
            };
        });
        expect(panel.inSidebar).toBe(true);
        expect(panel.stampedFromTemplate).toBe(true);
        expect(panel.title).toMatch(/preset/i);
        expect(panel.labelled).toBe(true);

        await page.click('#tool-preset-panel .panel-collapse');
        expect(await page.evaluate(() =>
            document.getElementById('tool-preset-panel-content').style.display)).toBe('none');
    });

// ── The Reference panel is a preset scope too ───────────────────────────────
//
// It is not a rail tool and never becomes the active one, so its panel is both
// "its options" and "its presets": the same row and the same list as a tool
// gets, pointed at the `reference` scope. What makes it worth its own specs is
// that its settings include a PICTURE, which lives in the shared asset store.

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91' +
    'JpzAAAAF0lEQVQI12P8z8DAwMDAxMDAwMDAwAAADgEBAKl5FQAAAAAASUVORK5CYII=';

const loadReference = (page, url) => page.evaluate(async (u) => {
    ReferenceLayerService.loadImage(u);
    await new Promise((resolve) => {
        const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); resolve(); });
    });
}, url);

test('the Reference panel has the same controls a tool has', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);

    const controls = await page.evaluate(() => ({
        row: document.querySelector('#reference-panel .preset-bar') !== null,
        select: document.getElementById('reference-preset-select') !== null,
        save: document.getElementById('reference-preset-save') !== null,
        list: document.querySelector('#reference-panel .preset-list-host') !== null
    }));
    expect(controls).toEqual({ row: true, select: true, save: true, list: true });

    // Nothing to save until there is an image; the controls stay put and say so
    expect(await page.evaluate(() =>
        document.getElementById('reference-preset-save').disabled)).toBe(true);

    await loadReference(page, TINY_PNG);
    expect(await page.evaluate(() =>
        document.getElementById('reference-preset-save').disabled)).toBe(false);
});

test('a reference preset carries the picture AND its placement', async ({ page }) => {
    await boot(page);
    await clearToolPresets(page);
    await loadReference(page, TINY_PNG);

    await page.evaluate(async () => {
        ReferenceLayerService.restoreState({ offsetX: 21, offsetY: -9, scale: 3, rotation: 90 });
        await PresetService.saveToolPreset('reference', 'Head study');
    });

    // Wreck the placement and throw the picture away entirely
    await page.evaluate(async () => {
        ReferenceLayerService.restoreState({ offsetX: 0, offsetY: 0, scale: 1, rotation: 0 });
        EventBus.emit(EVENTS.REFERENCE_CLEAR);
        await new Promise(r => setTimeout(r, 50));
    });
    expect(await page.evaluate(() => {
        const s = ReferenceLayerService.getState();
        return !s || !s.imageUrl;
    })).toBe(true);

    await page.evaluate(() => PresetService.applyToolPreset('reference', 'Head study'));
    await page.waitForFunction(() => {
        const s = ReferenceLayerService.getState();
        return s && s.imageUrl && s.offsetX === 21;
    });

    const restored = await page.evaluate(() => {
        const s = ReferenceLayerService.getState();
        return { offsetX: s.offsetX, offsetY: s.offsetY, scale: s.scale, rotation: s.rotation,
                 hasImage: !!s.imageUrl };
    });
    expect(restored).toEqual({ offsetX: 21, offsetY: -9, scale: 3, rotation: 90, hasImage: true });
});

test('reference presets are offered to the Reference panel and to nothing else',
    async ({ page }) => {
        await boot(page);
        await clearToolPresets(page);
        await loadReference(page, TINY_PNG);

        await page.evaluate(async () => {
            await PresetService.saveToolPreset('reference', 'Tracing A');
            ToolManager.selectTool(TOOLS.BRUSH);
            ToolManager.getTool(TOOLS.BRUSH).setSize(4);
            await PresetService.saveToolPreset(TOOLS.BRUSH, 'Brush one');
        });

        const refList = await page.evaluate(() =>
            Array.from(document.getElementById('reference-preset-select').options).map(o => o.value));
        expect(refList).toEqual(['', 'Tracing A']);

        const toolList = await page.evaluate(() =>
            Array.from(document.getElementById('tool-preset-select').options).map(o => o.value));
        expect(toolList).toEqual(['', 'Brush one']);

        // The sidebar Presets panel is the LIBRARY, so it shows both — and the
        // reference one is labelled by its scope like any other row
        const panelRows = await page.evaluate(() =>
            Array.from(document.querySelectorAll('#tool-preset-panel-content .preset-library-load'))
                .map(b => ({ scope: b.querySelector('.preset-library-scope').textContent,
                             name: b.title })));
        expect(panelRows.map(r => r.name).sort()).toEqual(['Brush one', 'Tracing A']);
        expect(panelRows.find(r => r.name === 'Tracing A').scope).toMatch(/reference/i);

        // ...and the Reference panel's own list does show it, with its controls
        const refNames = await page.evaluate(() =>
            Array.from(document.querySelectorAll('#reference-panel .preset-panel-load'))
                .map(b => b.textContent));
        expect(refNames).toEqual(['Tracing A']);
    });

test('two reference presets tracing one photo store it once, and survive F5',
    async ({ page }) => {
        await boot(page);
        await clearToolPresets(page);
        await loadReference(page, TINY_PNG);

        await page.evaluate(async () => {
            ReferenceLayerService.restoreState({ offsetX: 5 });
            await PresetService.saveToolPreset('reference', 'Spot one');
            ReferenceLayerService.restoreState({ offsetX: 40 });
            await PresetService.saveToolPreset('reference', 'Spot two');
        });

        const keys = await page.evaluate(() =>
            PresetService.listToolPresets('reference').map(p => p.asset));
        expect(keys[0]).toBe(keys[1]);
        expect(typeof keys[0]).toBe('string');

        await reload(page);

        const after = await page.evaluate(() =>
            PresetService.listToolPresets('reference').map(p => ({ n: p.name, x: p.options.offsetX })));
        expect(after).toEqual([{ n: 'Spot one', x: 5 }, { n: 'Spot two', x: 40 }]);

        // and the picture is still there to be restored
        await page.evaluate(() => PresetService.applyToolPreset('reference', 'Spot two'));
        await page.waitForFunction(() => {
            const s = ReferenceLayerService.getState();
            return s && s.imageUrl && s.offsetX === 40;
        });
    });
