'use strict';
/**
 * A reference preset LINKS to the photo; it does not carry it.
 *
 * Embedding cost up to 8 MB a preset with no cap on the collection (M,
 * 2026-08-07: 242 assets reachable = 1.94 GiB, 97% of everything the app could
 * store). A preset now keeps a file handle for the real photo plus a ~30 KB
 * thumbnail for every case the handle cannot serve - moved file, another
 * machine, declined permission, or a shared `.zxpreset`, which is JSON and
 * cannot hold a handle at all.
 *
 * showOpenFilePicker is a native dialog Playwright cannot drive, so the handle
 * paths run against a stub implementing the same methods. Picking a real file
 * stays a manual TESTLOG row.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/**
 * Load a noisy 800x600 as the reference image; resolves to its data-URL length.
 *
 * Noise at photographic dimensions, deliberately: a small flat graphic
 * compresses to less than its own thumbnail, so it would prove nothing about
 * the case the linking exists for, which is a tracing PHOTOGRAPH.
 */
const loadImage = (page) => page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    const data = ctx.createImageData(800, 600);
    for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] = Math.random() * 256;
        data.data[i + 1] = Math.random() * 256;
        data.data[i + 2] = Math.random() * 256;
        data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const url = c.toDataURL('image/png');
    ReferenceLayerService.loadImage(url);
    await new Promise((done) => {
        const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); done(); });
    });
    return url.length;
});

const clearPresets = (page) => page.evaluate(async () => {
    for (const p of PresetService.listToolPresets('reference').slice()) {
        await PresetService.removeToolPreset('reference', p.name);
    }
});

test('the thumbnail is far smaller than the photo it stands in for', async ({ page }) => {
    await boot(page);
    const fullChars = await loadImage(page);

    const r = await page.evaluate(() => {
        const thumb = ImageSource.thumbnail(ReferenceLayerService.image);
        return {
            chars: thumb.length,
            isJpeg: thumb.startsWith('data:image/jpeg'),
            maxPx: ImageSource.constructor.THUMB_MAX_PX
        };
    });

    expect(r.isJpeg).toBe(true);
    expect(r.chars).toBeGreaterThan(0);
    expect(r.chars).toBeLessThan(fullChars);
    expect(r.maxPx).toBe(256);
});

test('an image smaller than the thumbnail box is not blown up', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        c.getContext('2d').fillRect(0, 0, 8, 8);
        ReferenceLayerService.loadImage(c.toDataURL('image/png'));
        await new Promise((done) => {
            const off = EventBus.on(EVENTS.REFERENCE_LOADED, () => { off(); done(); });
        });
    });

    const size = await page.evaluate(async () => {
        const thumb = ImageSource.thumbnail(ReferenceLayerService.image);
        const img = new Image();
        await new Promise((done) => { img.onload = done; img.src = thumb; });
        return { w: img.naturalWidth, h: img.naturalHeight };
    });

    expect(size).toEqual({ w: 8, h: 8 });
});

test('a saved preset stores a thumbnail and a handle, not the photo', async ({ page }) => {
    await boot(page);
    await loadImage(page);
    await clearPresets(page);

    const r = await page.evaluate(async () => {
        // Stand in for what showOpenFilePicker would have handed back
        ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };
        await PresetService.saveToolPreset('reference', 'Linked');

        const preset = PresetService.getToolPreset('reference', 'Linked');
        const asset = await PresetService.loadAsset(preset.asset);
        return {
            presetBytes: JSON.stringify(preset).length,
            isThumbnail: asset.thumbnail === true,
            hasHandle: !!(asset.handle && asset.handle.stub)
        };
    });

    expect(r.isThumbnail).toBe(true);
    expect(r.hasHandle).toBe(true);          // structured-cloned into IndexedDB
    expect(r.presetBytes).toBeLessThan(1000); // the record stays a placement
});

test('applying prefers the linked file, and falls back to the thumbnail', async ({ page }) => {
    await boot(page);
    await loadImage(page);
    await clearPresets(page);

    const r = await page.evaluate(async () => {
        const out = {};
        const settle = () => new Promise((done) => setTimeout(done, 300));

        // A stored handle must survive structured clone into IndexedDB, so the
        // stub is a plain object and the READING of it is what gets stubbed.
        // That keeps the test on the branch it is about - prefer the link, fall
        // back to the thumbnail - rather than on permission plumbing no
        // automated run can drive anyway.
        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 32;
        c.getContext('2d').fillRect(0, 0, 32, 32);
        const blob = await new Promise((done) => c.toBlob(done, 'image/png'));
        let linkWorks = true;
        ImageSource.fileFromHandle = async (handle) => (
            handle && linkWorks ? new File([blob], 'photo.png', { type: 'image/png' }) : null
        );

        ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };
        ReferenceLayerService.setOffset(21, -9);
        await PresetService.saveToolPreset('reference', 'Linked');

        // Wreck it, recall: the FULL file comes back, at its real 32x32 - not
        // the 800x600 thumbnail's dimensions
        ReferenceLayerService.clearImage();
        await PresetService.applyToolPreset('reference', 'Linked');
        await settle();
        out.fromHandle = {
            w: ReferenceLayerService.image ? ReferenceLayerService.image.naturalWidth : 0,
            offsetX: ReferenceLayerService.getOffset().x
        };

        // Break the link the way a moved file does, and recall again
        linkWorks = false;
        ReferenceLayerService.clearImage();
        await PresetService.applyToolPreset('reference', 'Linked');
        await settle();
        out.fromThumbnail = {
            w: ReferenceLayerService.image ? ReferenceLayerService.image.naturalWidth : 0,
            hasImage: ReferenceLayerService.hasImage(),
            offsetX: ReferenceLayerService.getOffset().x
        };
        return out;
    });

    // The link served the real file at its real size, with the placement
    expect(r.fromHandle.w).toBe(32);
    expect(r.fromHandle.offsetX).toBe(21);
    // The broken link still produced a picture, and the same placement - and it
    // is visibly the THUMBNAIL, 256 px on its longest edge from an 800x600
    expect(r.fromThumbnail.hasImage).toBe(true);
    expect(r.fromThumbnail.w).toBe(256);
    expect(r.fromThumbnail.offsetX).toBe(21);
});

test('a link that will not store costs the link, not the preset', async ({ page }) => {
    await boot(page);
    await loadImage(page);
    await clearPresets(page);

    const r = await page.evaluate(async () => {
        // A function does not structured-clone, so writing this record throws
        // DataCloneError - standing in for any engine that will not persist a
        // handle. The placement and the thumbnail must still survive.
        ReferenceLayerService.fileHandle = { name: 'photo.png', reopen: () => null };
        ReferenceLayerService.setOffset(7, 3);
        const saved = await PresetService.saveToolPreset('reference', 'Awkward');

        const preset = PresetService.getToolPreset('reference', 'Awkward');
        const asset = preset ? await PresetService.loadAsset(preset.asset) : null;
        return {
            saved: !!saved,
            hasThumbnail: !!(asset && asset.dataUrl),
            hasHandle: !!(asset && asset.handle),
            offsetX: preset ? preset.options.offsetX : null
        };
    });

    expect(r.saved).toBe(true);
    expect(r.hasThumbnail).toBe(true);
    expect(r.offsetX).toBe(7);
    expect(r.hasHandle).toBe(false); // the link is what was given up
});

test('clearing the image drops the link with it', async ({ page }) => {
    await boot(page);
    await loadImage(page);

    const stillLinked = await page.evaluate(() => {
        ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };
        ReferenceLayerService.clearImage();
        return !!ReferenceLayerService.getFileHandle();
    });

    expect(stillLinked).toBe(false);
});

test('the panel says when it is showing a stand-in, and offers to re-point it', async ({ page }) => {
    await boot(page);
    // The Reference panel ships collapsed, and a notice inside a collapsed
    // panel is a notice nobody reads
    await page.evaluate(() => PanelSection.setCollapsed('reference-panel', false));
    await loadImage(page);
    await clearPresets(page);

    const note = page.locator('.image-info .panel-note');
    await expect(note).toBeHidden();

    await page.evaluate(async () => {
        ImageSource.fileFromHandle = async () => null; // the photo has moved
        ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };
        await PresetService.saveToolPreset('reference', 'Moved');
        ReferenceLayerService.clearImage();
        await PresetService.applyToolPreset('reference', 'Moved');
    });

    await expect(note).toBeVisible();
    await expect(note.locator('button')).toHaveText(/Locate/i);

    // Loading a real picture again clears the condition
    await loadImage(page);
    await expect(note).toBeHidden();
});

test('a slot preset links its reference photo too', async ({ page }) => {
    await boot(page);
    await loadImage(page);

    const r = await page.evaluate(async () => {
        ReferenceLayerService.fileHandle = { name: 'photo.png', stub: true };
        await PresetService.save(0, 'Slot', ['reference']);
        const preset = PresetService.get(0);
        const asset = await PresetService.loadAsset(preset.asset);
        return { isThumbnail: asset.thumbnail === true, hasHandle: !!asset.handle };
    });

    // Both libraries come through the same slice, so neither embeds the photo
    expect(r.isThumbnail).toBe(true);
    expect(r.hasHandle).toBe(true);
});

test('a shared .zxpreset carries the thumbnail but never the handle', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(() => {
        const asset = {
            dataUrl: 'data:image/jpeg;base64,AAAA', fileName: 'p.jpg',
            width: 10, height: 10, thumbnail: true, handle: { stub: true }
        };
        const record = PresetCodec.encodeAsset(asset);
        const file = PresetCodec.encodeFile(
            { slot: 0, name: 'x', slices: { reference: { scale: 1 } }, meta: {}, asset: 'key' },
            asset
        );
        return {
            recordKeepsHandle: !!record.handle,
            fileHasHandle: file.includes('handle'),
            fileHasThumbnail: file.includes('thumbnail')
        };
    });

    expect(r.recordKeepsHandle).toBe(true);
    expect(r.fileHasHandle).toBe(false);
    expect(r.fileHasThumbnail).toBe(true);
});
