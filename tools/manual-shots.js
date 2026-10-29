'use strict';
/**
 * manual-shots.js - the manual's screenshots, as code.
 *
 * Every picture in the manual is taken from the real app, in the same
 * Playwright session that extracts its facts. The list below says how to reach
 * each state and what to crop to, so a screenshot is reproducible and
 * reviewable in a diff rather than being a mystery PNG somebody once took and
 * nobody can retake.
 *
 * A shot is placed in the prose by an ordinary Markdown image line -
 * `![alt](img/workspace.png)` - so a human still decides which pictures the
 * manual uses and where. A shot nothing references fails the build: it would
 * be dead weight in a download, and the download is the whole point.
 *
 * Sizes are measured, not guessed. As of 2026-08-30 the full 1600x900
 * workspace is 65.5 KB and a cropped panel is 4-13 KB, so the whole set costs
 * far less than the artwork budget - which is why crops are preferred anyway:
 * a picture of the one panel being discussed is a better illustration than a
 * picture of the whole window with an arrow on it.
 */

/**
 * Open a top-level menu and leave it open.
 *
 * Shoot `#menu-<id>` (the dropdown), never `.menu-item[data-menu=<id>]` (the
 * label): the dropdown is absolutely positioned, so cropping to the label
 * yields a 600-byte picture of the word "File".
 */
const openMenu = (menu) => async (page) => {
    await page.click('.menu-item[data-menu="' + menu + '"] .menu-label');
    await page.waitForTimeout(150);
};

/**
 * Open a dialog through its real menu route, as a user would.
 *
 * Waits for `.app-dialog` rather than `.app-dialog-body`: the editors add a
 * body element, Preferences does not, and the outer element is the one every
 * dialog in the app actually shares.
 */
const openDialog = (menu, action) => async (page) => {
    await page.click('.menu-item[data-menu="' + menu + '"] .menu-label');
    await page.click('.menu-action[data-action="' + action + '"]');
    await page.waitForSelector('.app-dialog', { timeout: 5000 });
    await page.waitForTimeout(250);
};

/** Escape closes any dialog or open menu; harmless when nothing is open. */
const closeAll = async (page) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.mouse.move(2, 2);
};

/**
 * Draw the picture that explains attribute clash.
 *
 * Two strokes cross. The first is blue on white, the second red - and in the
 * cells where they cross, the BLUE line turns red too, because the cell holds
 * one ink colour for all 64 of its dots. That is the whole idea in one image,
 * and it has to be drawn rather than described.
 */
const drawClashDemo = async (page) => {
    await page.evaluate(() => {
        const draw = (x, y) => PixelDrawRoutine.draw(
            x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);

        UndoRedo.beginAction('manual: clash demo');
        // Paper stays the DEFAULT white rather than bright white: a touched
        // cell must differ from an untouched one in exactly one way - the ink
        // colour - or the picture teaches two things at once and neither
        // clearly. Bright would put a halo round both lines and read as part
        // of the effect.
        ColorManager.setPaper(7);

        // Drawn around the MIDDLE of the canvas, not the top-left corner:
        // zooming re-centres the scroller, so artwork in a corner scrolls out
        // of frame at anything past about 400%.
        const cx = Math.round(ZX_SPECTRUM.WIDTH / 2);
        const cy = Math.round(ZX_SPECTRUM.HEIGHT / 2);
        const reach = 20;

        // A blue diagonal, then a red one crossing it.
        ColorManager.setInk(1);
        for (let i = -reach; i < reach; i++) {
            draw(cx + i, cy + i); draw(cx + i + 1, cy + i);
        }
        ColorManager.setInk(2);
        for (let i = -reach; i < reach; i++) {
            draw(cx + i, cy - i); draw(cx + i + 1, cy - i);
        }

        UndoRedo.endAction();
        LayerManager.composeToCanvas();

        GridOverlay.toggleCellGrid();
        // 800% so 40 pixels of artwork fill the frame. At 400% the demo sat in
        // one corner of a mostly empty canvas.
        CanvasSystem.setZoom(800);
    });
    await page.waitForTimeout(300);
};

/** Undo the demo and put the view back, so later shots are unaffected. */
const clearClashDemo = async (page) => {
    await page.evaluate(() => {
        GridOverlay.toggleCellGrid();
        CanvasSystem.setZoom(100);
        UndoRedo.undo();
        LayerManager.composeToCanvas();
    });
    await page.waitForTimeout(200);
};

/**
 * Build the animation the Animation chapter's pictures show: a ball bouncing
 * over the ground in six frames. The ground is drawn once on a Shared layer
 * and the ball on an Animated one, so the Layers panel shows both kinds of
 * row; Onion skin is on, so it shows the two preview
 * layers too.
 */
const buildAnimDemo = async (page) => {
    await page.evaluate(() => {
        const L = LayerManager, S = AnimationService;
        window.__manualInk = [ColorManager.ink, ColorManager.paper];
        const draw = (x, y) => PixelDrawRoutine.draw(
            x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        const ground = L.layers.find((l) => !l.isBackground && !l.isStamp);
        L.setCurrentLayer(ground.index);
        UndoRedo.beginAction('manual: ground');
        ColorManager.setPaper(7);
        ColorManager.setInk(4);
        for (let y = 168; y < ZX_SPECTRUM.HEIGHT; y++) {
            for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) draw(x, y);
        }
        UndoRedo.endAction();

        S.createScreen();
        S.setLayerAnimated(ground.id, false);
        const ball = L.addLayer('Ball');
        L.setCurrentLayer(ball.index);
        ColorManager.setInk(2);
        // Centre heights of one bounce: high, falling, on the ground, rising
        const heights = [36, 76, 120, 148, 120, 76];
        heights.forEach((cy, i) => {
            if (i > 0) S.addFrame();
            const cx = 48 + i * 32, r = 20;
            UndoRedo.beginAction('manual: ball');
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) draw(cx + x, cy + y);
            }
            UndoRedo.endAction();
        });
        S.goTo(2);
        S.setOnionSkin(true);
        L.composeToCanvas();
    });
    await page.waitForTimeout(600);   // the frame strip draws its thumbnails when idle
};

/** Undo the whole demo, close its panel and give the colours back. */
const clearAnimDemo = async (page) => {
    await closeAll(page);
    await page.evaluate(() => {
        AnimationService.setOnionSkin(false);
        while (UndoRedo.canUndo()) UndoRedo.undo();
        UndoRedo.clear();
        AnimationService.reset();
        PanelSection.setVisible(AnimationPanel.ID, false);
        ColorManager.setInk(window.__manualInk[0]);
        ColorManager.setPaper(window.__manualInk[1]);
        LayerManager.composeToCanvas();
    });
    await page.waitForTimeout(200);
};

/**
 * @type {Array<{id: string, crop: ?string, reach: ?Function, after: ?Function}>}
 *   `crop` is a selector to shoot; null means the whole viewport.
 *   `reach` puts the app into the state; `after` puts it back.
 */
const SHOTS = [
    { id: 'workspace', crop: null },

    { id: 'tool-rail', crop: '#toolbar' },
    { id: 'colour-rail', crop: '#color-rail' },
    { id: 'colour-bar', crop: '#color-bar' },
    { id: 'panels', crop: '#panels' },
    { id: 'status-bar', crop: '#status-bar' },

    {
        id: 'menu-file',
        crop: '#menu-file',
        reach: openMenu('file'),
        after: closeAll
    },
    {
        id: 'menu-image',
        crop: '#menu-image',
        reach: openMenu('image'),
        after: closeAll
    },

    {
        id: 'tool-options-brush',
        crop: '#tool-options-panel-content',
        reach: async (page) => {
            await page.keyboard.press('b');
            await page.waitForTimeout(200);
        }
    },

    {
        id: 'attribute-clash',
        // The canvas itself lives inside the srcdoc iframe, so the viewport
        // that HOLDS the iframe is what the top-level page can crop to.
        crop: '#canvas-viewport',
        reach: drawClashDemo,
        after: clearClashDemo
    },

    {
        id: 'dialog-preferences',
        crop: '.app-dialog',
        reach: openDialog('settings', 'settings:preferences'),
        after: closeAll
    },
    {
        id: 'dialog-font-editor',
        crop: '.app-dialog',
        reach: openDialog('file', 'file:fontEditor'),
        after: closeAll
    },
    {
        id: 'dialog-map-editor',
        crop: '.app-dialog',
        reach: openDialog('file', 'file:mapEditor'),
        after: closeAll
    },
    {
        id: 'dialog-sprite-editor',
        crop: '.app-dialog',
        reach: openDialog('file', 'file:spriteEditor'),
        after: closeAll
    },

    // The Animation chapter. Each shot builds the demo and takes it down
    // again, so any one of them can be re-taken alone (--shots=).
    {
        id: 'menu-animation',
        crop: '#menu-animation',
        reach: async (page) => { await buildAnimDemo(page); await openMenu('animation')(page); },
        after: clearAnimDemo
    },
    {
        id: 'dialog-new-sprite',
        crop: '.app-dialog',
        reach: openDialog('animation', 'animation:newSprite'),
        after: closeAll
    },
    {
        id: 'animation-panel',
        crop: '#animation-panel',
        reach: buildAnimDemo,
        after: clearAnimDemo
    },
    {
        id: 'animation-layers',
        crop: '#layer-panel',
        reach: buildAnimDemo,
        after: clearAnimDemo
    },

    // File > Tape Blocks is deliberately absent. It opens the OS file picker
    // FIRST and only shows its dialog once a tape has been chosen, so there is
    // nothing to photograph without driving a native dialog no automation can
    // reach. The chapter describes it in words instead.
];

module.exports = { SHOTS };
