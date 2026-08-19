'use strict';
const { installStubs, loadModule } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/font-rasterizer.js');

async function run() {
    // A minimal stub font isn't meaningful to rasterize pixel-for-pixel in
    // a headless Node test (no real font renderer without a browser) - this
    // suite pins the CONTRACT: right glyph count, right byte shape, masked
    // to the requested width. Pixel-accuracy against a real system font is
    // covered by the Playwright spec in Task 15, which runs in real Chrome.
    const fakeBytes = new Uint8Array([0, 1, 2, 3]).buffer;
    const glyphs = await FontRasterizer.rasterize(fakeBytes, {
        pointSize: 8, cellWidth: 6, firstCode: 65, count: 3 // 'A'..'C'
    });

    if (glyphs.length !== 3) throw new Error(`expected 3 glyphs, got ${glyphs.length}`);
    console.log('  ok: returns one glyph per requested code');

    for (const g of glyphs) {
        if (!(g instanceof Uint8Array) || g.length !== 8) {
            throw new Error('expected each glyph to be a Uint8Array(8), matching FontService.setGlyph');
        }
        const mask = (0xFF << (8 - 6)) & 0xFF; // width=6
        for (const byte of g) {
            if ((byte & ~mask) !== 0) throw new Error('glyph row has bits set beyond the requested cell width');
        }
    }
    console.log('  ok: every glyph is Uint8Array(8), masked to the requested width');

    // Test 1: validation guards throw for bad values
    try {
        await FontRasterizer.rasterize(fakeBytes, {
            pointSize: 0, cellWidth: 6, firstCode: 65, count: 1
        });
        throw new Error('expected pointSize: 0 to throw');
    } catch (e) {
        if (!e.message.includes('pointSize must be > 0')) throw e;
        console.log('  ok: validation rejects pointSize <= 0');
    }

    try {
        await FontRasterizer.rasterize(fakeBytes, {
            pointSize: 8, cellWidth: 9, firstCode: 65, count: 1
        });
        throw new Error('expected cellWidth: 9 to throw');
    } catch (e) {
        if (!e.message.includes('cellWidth must be 1-8')) throw e;
        console.log('  ok: validation rejects cellWidth > 8');
    }

    try {
        await FontRasterizer.rasterize(fakeBytes, {
            pointSize: 8, cellWidth: 6, firstCode: 65, count: -1
        });
        throw new Error('expected count: -1 to throw');
    } catch (e) {
        if (!e.message.includes('count must be >= 0')) throw e;
        console.log('  ok: validation rejects count < 0');
    }

    // Test 2: document.fonts.delete(face) runs even when rasterization throws
    global._testCanvasThrowAfter(2); // throw on the 2nd getImageData call (2nd glyph)
    try {
        await FontRasterizer.rasterize(fakeBytes, {
            pointSize: 8, cellWidth: 6, firstCode: 65, count: 3
        });
        throw new Error('expected mid-loop error to propagate');
    } catch (e) {
        if (!e.message.includes('test: simulated canvas error')) throw e;
    }
    // The critical check: the face should have been deleted despite the error
    const faces = document.fonts._fonts;
    if (faces.size !== 0) {
        throw new Error(`expected face to be cleaned up, but ${faces.size} faces remain in document.fonts`);
    }
    console.log('  ok: document.fonts cleanup runs even when rasterization throws mid-loop');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
