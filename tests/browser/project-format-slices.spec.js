'use strict';
/**
 * `.pixula` full-snapshot scope (2026-08-23): the payload now carries the
 * same six `PresetServiceClass.SLICES` a workspace preset does (tool,
 * colour, drawing modifiers, pattern, reference image + placement, view),
 * not just layers/screen-mode/palette/a narrow tool-colour-zoom triple. See
 * the doc comment at the top of js/io/project-format.js for the full
 * reasoning, including why the undo/redo stack and app-level Preferences
 * are deliberately still excluded.
 *
 * The reference image is the one genuinely new mechanism: it is EMBEDDED
 * (via ImageSource.thumbnail at ProjectFormat.REFERENCE_IMAGE_MAX_PX),
 * never linked, because a FileSystemFileHandle cannot survive JSON and a
 * link-only project would need "Locate Photo..." on every single reopen,
 * including seconds later on the same machine.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** A small solid-colour canvas as a data URL, loaded as the reference image. */
const loadReferenceImage = (page, w, h) => page.evaluate(async ({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a06030';
    ctx.fillRect(0, 0, w, h);
    ReferenceLayerService.loadImage(c.toDataURL('image/png'));
    await new Promise((done) => {
        const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); done(); });
    });
}, { w, h });

test('a .pixula round-trip carries every slice, not just layers and colour', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        // tool
        ToolManager.selectTool('eraser');
        ToolManager.getTool('eraser').setSize(11);

        // color
        ColorManager.setInk(3);

        // drawing
        StateManager.setSymmetryMode('h');
        StateManager.set('nudgeStep', 7);

        // pattern
        await PatternService.setCurrentPattern(PatternService.getPatternByPath('8x8/density-50'));

        // view
        CanvasSystem.setZoom(250);
        if (window.GridOverlay) GridOverlay.setPixelGridVisible(true);

        const before = {
            tool: StateManager.getCurrentTool(),
            eraserSize: ToolManager.getTool('eraser').getSize(),
            ink: ColorManager.getInk(),
            symmetry: StateManager.getSymmetryMode(),
            nudgeStep: StateManager.get('nudgeStep'),
            patternPath: PatternService.getCurrentPattern().path,
            zoom: CanvasSystem.zoomLevel ?? CanvasSystem.zoom,
            gridPixel: window.GridOverlay ? GridOverlay.pixelGridVisible : null
        };

        const bytes = await ProjectFormat.encode(App._getProjectData());
        const version = App._getProjectData().version;

        // Wreck every one of those, then read the file back.
        ToolManager.getTool('eraser').setSize(3);
        ToolManager.selectTool('brush');
        ColorManager.setInk(0);
        StateManager.setSymmetryMode('off');
        StateManager.set('nudgeStep', 1);
        await PatternService.setCurrentPattern(PatternService.getPatternByPath('8x8/hatch'));
        CanvasSystem.setZoom(100);
        if (window.GridOverlay) GridOverlay.setPixelGridVisible(false);

        await ProjectFormat.parse(bytes);

        return {
            version,
            before,
            after: {
                tool: StateManager.getCurrentTool(),
                eraserSize: ToolManager.getTool('eraser').getSize(),
                ink: ColorManager.getInk(),
                symmetry: StateManager.getSymmetryMode(),
                nudgeStep: StateManager.get('nudgeStep'),
                patternPath: PatternService.getCurrentPattern().path,
                zoom: CanvasSystem.zoomLevel ?? CanvasSystem.zoom,
                gridPixel: window.GridOverlay ? GridOverlay.pixelGridVisible : null
            }
        };
    });

    expect(r.version).toBe(2);
    expect(r.after).toEqual(r.before);
});

test('the reference image survives a .pixula round-trip embedded, not as a stand-in',
    async ({ page }) => {
        await boot(page);
        await loadReferenceImage(page, 64, 48);

        const r = await page.evaluate(async () => {
            EventBus.emit(EVENTS.REFERENCE_OFFSET, { x: 12, y: -5 });
            EventBus.emit(EVENTS.REFERENCE_SCALE, { scale: 1.5 });
            // A handle would be dropped by any JSON path regardless - set one
            // to prove the project payload does not carry it forward.
            ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };

            const bytes = await ProjectFormat.encode(App._getProjectData());
            const rawHandle = App._getProjectData().slices.reference.assetData.handle;

            ReferenceLayerService.clearImage();
            await ProjectFormat.parse(bytes);
            await new Promise((done) => setTimeout(done, 50));

            return {
                rawHandle,
                hasImage: ReferenceLayerService.hasImage(),
                isStandIn: ReferenceLayerService.isStandingIn(),
                offset: ReferenceLayerService.getOffset(),
                scale: ReferenceLayerService.getState().scale,
                width: ReferenceLayerService.image ? ReferenceLayerService.image.naturalWidth : 0,
                height: ReferenceLayerService.image ? ReferenceLayerService.image.naturalHeight : 0
            };
        });

        expect(r.rawHandle).toBeNull();
        expect(r.hasImage).toBe(true);
        expect(r.isStandIn).toBe(false);
        expect(r.offset).toEqual({ x: 12, y: -5 });
        expect(r.scale).toBe(1.5);
        expect(r.width).toBe(64);
        expect(r.height).toBe(48);
    });

test('an oversized reference image is downscaled to the embed cap', async ({ page }) => {
    await boot(page);
    // Longest edge well past ProjectFormat.REFERENCE_IMAGE_MAX_PX (4096).
    await loadReferenceImage(page, 5000, 10);

    const r = await page.evaluate(async () => {
        const bytes = await ProjectFormat.encode(App._getProjectData());
        ReferenceLayerService.clearImage();
        await ProjectFormat.parse(bytes);
        await new Promise((done) => setTimeout(done, 50));
        return {
            cap: ProjectFormat.REFERENCE_IMAGE_MAX_PX,
            width: ReferenceLayerService.image ? ReferenceLayerService.image.naturalWidth : 0
        };
    });

    expect(r.width).toBeLessThanOrEqual(r.cap);
    expect(r.width).toBeGreaterThan(0);
});

test('a pre-slices project (only the old "state" block) still restores through the fallback',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(async () => {
            LayerManager.addLayer();
            const legacy = {
                version: 1,
                timestamp: Date.now(),
                screenMode: ScreenModeService.getModeId(),
                ulaplusRegisters: null,
                nextRegisters: null,
                timexHiresInk: null,
                layers: LayerManager.getAllLayers(),
                state: { tool: 'eraser', ink: 6, paper: 2, bright: true, flash: false, border: 5, zoom: 400 }
            };

            ColorManager.setInk(0);
            ToolManager.selectTool('brush');
            CanvasSystem.setZoom(100);

            await App._loadProjectData(legacy);

            return {
                tool: StateManager.getCurrentTool(),
                ink: ColorManager.getInk(),
                border: ColorManager.getBorder(),
                zoom: CanvasSystem.zoomLevel ?? CanvasSystem.zoom
            };
        });

        expect(r.tool).toBe('eraser');
        expect(r.ink).toBe(6);
        expect(r.border).toBe(5);
        expect(r.zoom).toBe(400);
    });
