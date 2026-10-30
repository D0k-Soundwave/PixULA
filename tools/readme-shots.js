'use strict';
/**
 * readme-shots.js - the README's pictures, as code.
 *
 *   node tools/readme-shots.js       writes docs/screenshots/*.png
 *
 * The manual's pictures (tools/manual-shots.js) explain one control each, on
 * an empty canvas. These show the app at work, so they need artwork: a sunset
 * the script paints as an ordinary full-colour picture and then brings in
 * through the app's own importer (Sharp), exactly as a person importing a
 * photo would. Re-run it after the interface changes; nothing here is a
 * picture somebody once took and nobody can retake.
 *
 * Unlike manual/img/, docs/screenshots/ is committed: GitHub shows the README
 * pictures from the repository itself.
 */
const fs = require('fs');
const path = require('path');
const { withApp } = require('./build-manual.js');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

/**
 * Paint the sunset in the page and return it as PNG bytes: a sky going from
 * night to orange, stars, a low sun, two ranges of mountains and the sun's
 * reflection on the sea. Full colour and smooth on purpose - the point of the
 * picture is what the import does to it.
 */
const paintScene = (page) => page.evaluate(() => {
    const W = 768, H = 576, horizon = Math.round(H * 0.64);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#060a30');
    sky.addColorStop(0.45, '#3a1a70');
    sky.addColorStop(0.75, '#c03a78');
    sky.addColorStop(1, '#ffa040');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, horizon);

    // Stars: a fixed scatter, so every run paints the same picture
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) g.fillRect(rnd() * W, rnd() * horizon * 0.45, 2, 2);

    const sunX = W * 0.66, sunY = horizon - 18, sunR = 78;
    const sun = g.createRadialGradient(sunX, sunY, 8, sunX, sunY, sunR);
    sun.addColorStop(0, '#fff6a0');
    sun.addColorStop(0.7, '#ffd040');
    sun.addColorStop(1, '#ff8a30');
    g.fillStyle = sun;
    g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.fill();

    const range = (colour, base, peaks) => {
        g.fillStyle = colour;
        g.beginPath();
        g.moveTo(0, horizon);
        for (const [x, y] of peaks) g.lineTo(x * W, base - y);
        g.lineTo(W, horizon);
        g.closePath();
        g.fill();
    };
    range('#6a2a80', horizon, [[0, 60], [0.12, 130], [0.22, 80], [0.34, 150], [0.46, 70], [0.58, 40], [1, 20]]);
    range('#1c0c38', horizon, [[0, 30], [0.08, 90], [0.18, 40], [0.3, 70], [0.4, 20], [0.85, 10], [0.93, 60], [1, 90]]);

    const sea = g.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, '#5a2468');
    sea.addColorStop(1, '#06061c');
    g.fillStyle = sea;
    g.fillRect(0, horizon, W, H - horizon);

    // The sun's path on the water: stripes narrowing towards the viewer
    for (let i = 0; i < 14; i++) {
        const y = horizon + 6 + i * 14;
        const half = sunR * (1 - i / 16);
        g.fillStyle = i % 2 ? '#ff9a40' : '#ffd060';
        g.fillRect(sunX - half, y, half * 2, 5);
    }

    const bin = atob(c.toDataURL('image/png').split(',')[1]);
    return Array.from(bin, (ch) => ch.charCodeAt(0));
});

/** Boot fresh: every shot starts from the app as a person opens it. */
const fresh = async (page) => {
    await page.reload();
    await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
};

/**
 * Bring the scene in through the importer's Sharp conversion, filling the
 * screen. A cell of one solid colour can come in as all ink pixels; such a
 * cell is rewritten as the same colour in paper with no ink pixels, as an
 * artist leaves a plain area. The picture does not change, but the ball of
 * the animation shot can then take a cell's ink without the whole cell
 * turning white.
 */
const importScene = (page, bytes) => page.evaluate(async (bytes) => {
    await PNGFormat.parse(new Uint8Array(bytes).buffer,
        { method: 'detail', dithering: 'none', scaling: 'crop' });
    const layer = LayerManager.getCurrentLayer();
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
        for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            const c = layer.getCell(cx, cy);
            if (c && c.pixels.every((row) => row === 0xFF)) {
                c.paper = c.ink;
                c.pixels.fill(0);
            }
        }
    }
    LayerManager.composeToCanvas();
    CanvasSystem.zoomToFit();
}, bytes);

const settle = (page, ms = 400) => page.waitForTimeout(ms);

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = (name) => path.join(OUT_DIR, name);

    await withApp(async (page) => {
        const scene = await paintScene(page);

        // 1. The app at work: the whole window, the picture fitted to it
        await fresh(page);
        await importScene(page, scene);
        await page.mouse.move(2, 2);
        await settle(page);
        await page.screenshot({ path: out('pixula-workspace.png') });

        // 2. What makes a Spectrum picture a Spectrum picture: close in on
        // the sun and the mountains with the 8x8 cell grid on - every cell
        // holds two colours, ink and paper, and no more
        await fresh(page);
        await importScene(page, scene);
        await page.evaluate(() => {
            GridOverlay.toggleCellGrid();
            CanvasSystem.setZoom(800);
        });
        await settle(page);
        await page.evaluate(() => {
            const s = CanvasSystem.iframeDoc.scrollingElement || CanvasSystem.iframeDoc.body;
            const canvas = CanvasSystem.iframeDoc.querySelector('canvas');
            const scale = CanvasSystem.getScale();
            // Screen pixel (150, 112): the sun's lower edge meeting the mountains and the sea
            s.scrollLeft = canvas.offsetLeft + 150 * scale - s.clientWidth / 2;
            s.scrollTop = canvas.offsetTop + 112 * scale - s.clientHeight / 2;
        });
        await page.mouse.move(2, 2);
        await settle(page);
        // The canvas area only: right of the colour rail's collapse tab
        const view = await page.locator('#canvas-viewport').boundingBox();
        const tab = await page.locator('#color-rail').boundingBox();
        const left = Math.ceil(tab.x + tab.width) + 48;
        await page.screenshot({
            path: out('pixula-colour-cells.png'),
            clip: { x: left, y: view.y, width: view.x + view.width - left, height: view.height }
        });
        // The app remembers its grids across reloads: put this one back
        await page.evaluate(() => GridOverlay.toggleCellGrid());

        // 3. Animation: a ball bouncing over the sunset, six frames of the
        // whole screen. The ball is drawn into each frame with Paper and
        // Bright on "use existing", so a cell keeps its own paper and only
        // its ink turns white - attribute clash, as on the real machine.
        // (On a layer of its own the ball would bring that layer's paper
        // with it, a white square round every frame.)
        await fresh(page);
        await importScene(page, scene);
        await page.evaluate(() => {
            const L = LayerManager, S = AnimationService;
            const sceneLayer = L.layers.find((l) => !l.isBackground && !l.isStamp);
            L.setCurrentLayer(sceneLayer.index);
            S.createScreen();
            // Six copies of the plain scene first, then a ball in each
            for (let i = 1; i < 6; i++) { S.goTo(0); S.duplicateFrame(); }
            ColorManager.setInk(7);
            ColorManager.setPaperTransparent(true);
            ColorManager.setBrightTransparent(true);
            const draw = (x, y) => PixelDrawRoutine.draw(
                x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
            // One bounce through the night sky, above the glow: there the
            // cells are black paper with nothing inked, so the ball stays
            // round (lower down, a cell inked magenta would turn white whole)
            const path = [[28, 10], [62, 22], [96, 32], [130, 38], [164, 32], [198, 22]];
            path.forEach(([cx, cy], i) => {
                S.goTo(i);
                const r = 6;
                UndoRedo.beginAction('readme: ball');
                for (let y = -r; y <= r; y++) {
                    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) draw(cx + x, cy + y);
                }
                UndoRedo.endAction();
            });
            S.goTo(3);
            // Room for the Animation panel: fold the tool panels above it
            for (const id of ['tool-options-panel', 'transform-panel']) {
                if (PanelSection.isVisible(id)) PanelSection.setCollapsed(id, true);
            }
            L.composeToCanvas();
            CanvasSystem.zoomToFit();
        });
        await page.mouse.move(2, 2);
        await settle(page, 800);   // the frame strip draws its thumbnails when idle
        await page.screenshot({ path: out('pixula-animation.png') });

        // 4. Importing: the same sunset as it arrives, with the three
        // conversions side by side to choose from
        await fresh(page);
        await page.evaluate((bytes) => {
            window.__readmeImport = ImportDialog.show(new Uint8Array(bytes).buffer, 'png');
        }, scene);
        await page.waitForSelector('.import-methods .import-method');
        // Wait until all three previews have painted something different
        await page.waitForFunction(() => new Set(
            [...document.querySelectorAll('.import-method canvas')].map((c) =>
                c.getContext('2d').getImageData(0, 0, c.width, c.height).data
                    .reduce((h, v) => (h * 31 + v) | 0, 0))).size === 3, null, { timeout: 30000 });
        await page.mouse.move(2, 2);
        await settle(page);
        await page.locator('.app-dialog').first().screenshot({ path: out('pixula-import.png') });
        await page.keyboard.press('Escape');
    });

    for (const f of fs.readdirSync(OUT_DIR).filter((n) => n.endsWith('.png')).sort()) {
        console.log('readme-shots: ' + f + ' ' + (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0) + ' KB');
    }
}

if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
