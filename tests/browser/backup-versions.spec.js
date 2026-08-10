'use strict';
/**
 * Versioned autosave to disk.
 *
 * Each autosave tick writes the whole document to a chosen folder as
 * `<name> V1.pixula`, `V2`, ... so the artist can go back to any of them.
 *
 * `showDirectoryPicker` is a native dialog Playwright cannot drive, so these
 * run against an in-memory stand-in implementing the parts of
 * FileSystemDirectoryHandle the service actually uses: getFileHandle,
 * removeEntry, entries, queryPermission, requestPermission. Choosing a real
 * folder and the real permission lifecycle stay manual TESTLOG rows.
 *
 * The property that matters most here is the LAST one: a folder that goes away
 * must never cost the artist the database autosave.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Install a fake directory and point BackupService at it. */
const useFakeFolder = (page, permission = 'granted') => page.evaluate((permission) => {
    const files = new Map();
    window.__files = files;
    window.__perm = permission;

    const fileHandle = (name) => ({
        kind: 'file',
        name,
        createWritable: async () => ({
            write: async (bytes) => { files.set(name, bytes.slice()); },
            close: async () => {}
        }),
        getFile: async () => new File([files.get(name)], name)
    });

    window.__dir = {
        kind: 'directory',
        name: 'Backups',
        queryPermission: async () => window.__perm,
        requestPermission: async () => { window.__perm = 'granted'; return 'granted'; },
        getFileHandle: async (name, opts) => {
            if (!files.has(name) && !(opts && opts.create)) throw new Error('not found');
            if (!files.has(name)) files.set(name, new Uint8Array());
            return fileHandle(name);
        },
        removeEntry: async (name) => { files.delete(name); },
        entries: async function* () {
            for (const name of [...files.keys()]) yield [name, fileHandle(name)];
        }
    };

    BackupService.directory = window.__dir;
    BackupService.needsPermission = permission !== 'granted';
}, permission);

const names = (page) => page.evaluate(() => [...window.__files.keys()]);

test('a project file round-trips the whole document, layers and all', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        LayerManager.addLayer();
        LayerManager.addLayer();
        PixelDrawRoutine.draw(4, 4, { mirror: false });
        ColorManager.setInk(5);
        const before = {
            layers: LayerManager.getAllLayers().length,
            ink: ColorManager.getInk(),
            pixel: !!PixelDrawRoutine.getPixelState(4, 4).isInk
        };

        const bytes = await ProjectFormat.encode(App._getProjectData());
        const isGzip = bytes[0] === 0x1F && bytes[1] === 0x8B;

        // Wreck it thoroughly, then read the file back
        while (LayerManager.getAllLayers().length > 2) LayerManager.removeLayer(1);
        ColorManager.setInk(0);

        await ProjectFormat.parse(bytes);
        return {
            before, isGzip, bytes: bytes.length, canCompress: ProjectFormat.canCompress,
            after: {
                layers: LayerManager.getAllLayers().length,
                ink: ColorManager.getInk(),
                pixel: !!PixelDrawRoutine.getPixelState(4, 4).isInk
            }
        };
    });

    // The whole point: .scr would have brought back one flattened layer
    expect(r.after.layers).toBe(r.before.layers);
    expect(r.after.layers).toBeGreaterThan(2); // background + more than one drawing layer
    expect(r.after.ink).toBe(5);
    expect(r.after.pixel).toBe(true);
    if (r.canCompress) expect(r.isGzip).toBe(true);
});

test('versions number upward and the newest is the highest', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    const written = await page.evaluate(async () => {
        const out = [];
        for (let i = 0; i < 3; i++) {
            out.push(await BackupService.writeVersion(App._getProjectData(), 'Castle'));
        }
        return out;
    });

    expect(written).toEqual(['Castle V1.pixula', 'Castle V2.pixula', 'Castle V3.pixula']);
    expect((await names(page)).sort()).toEqual(
        ['Castle V1.pixula', 'Castle V2.pixula', 'Castle V3.pixula']);
});

test('numbering resumes from the folder, not from memory', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    // A previous session's files are already there; a fresh service must not
    // restart at V1 and overwrite them
    const next = await page.evaluate(async () => {
        window.__files.set('Castle V1.pixula', new Uint8Array([1]));
        window.__files.set('Castle V7.pixula', new Uint8Array([1]));
        BackupService.lastWritten = null;
        return BackupService.writeVersion(App._getProjectData(), 'Castle');
    });

    expect(next).toBe('Castle V8.pixula');
});

test('another document keeps its own sequence', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    const r = await page.evaluate(async () => {
        await BackupService.writeVersion(App._getProjectData(), 'Castle');
        await BackupService.writeVersion(App._getProjectData(), 'Castle');
        return BackupService.writeVersion(App._getProjectData(), 'Dragon');
    });

    expect(r).toBe('Dragon V1.pixula');
});

test('old versions are pruned to the keep count, newest kept', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    const kept = await page.evaluate(async () => {
        await BackupService.setKeepVersions(3);
        for (let i = 0; i < 6; i++) {
            await BackupService.writeVersion(App._getProjectData(), 'Castle');
        }
        return (await BackupService.listVersions('Castle')).map(v => v.version);
    });

    expect(kept).toEqual([6, 5, 4]);
});

test('keep = 0 keeps every version', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    const count = await page.evaluate(async () => {
        await BackupService.setKeepVersions(0);
        for (let i = 0; i < 8; i++) {
            await BackupService.writeVersion(App._getProjectData(), 'Castle');
        }
        return (await BackupService.listVersions('Castle')).length;
    });

    expect(count).toBe(8);
});

test('a backup can be opened again and is the document it saved', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    const r = await page.evaluate(async () => {
        LayerManager.addLayer();
        PixelDrawRoutine.draw(9, 9, { mirror: false });
        const layers = LayerManager.getAllLayers().length;
        await BackupService.writeVersion(App._getProjectData(), 'Castle');

        while (LayerManager.getAllLayers().length > 2) LayerManager.removeLayer(1);

        const bytes = window.__files.get('Castle V1.pixula');
        const project = await ProjectFormat.decode(bytes);
        App._loadProjectData(project);
        return {
            layersBefore: layers,
            layersAfter: LayerManager.getAllLayers().length,
            pixel: !!PixelDrawRoutine.getPixelState(9, 9).isInk
        };
    });

    expect(r.layersAfter).toBe(r.layersBefore);
    expect(r.pixel).toBe(true);
});

test('a lapsed permission pauses backups instead of failing every minute',
    async ({ page }) => {
        await boot(page);
        await useFakeFolder(page, 'granted');

        const r = await page.evaluate(async () => {
            await BackupService.writeVersion(App._getProjectData(), 'Castle');

            // What a reload looks like: the handle is still there, the grant is not
            window.__perm = 'prompt';
            let announced = null;
            const off = EventBus.on(EVENTS.BACKUP_STATE_CHANGED, (s) => { announced = s; });
            const blocked = await BackupService.writeVersion(App._getProjectData(), 'Castle');
            off();

            const paused = { blocked, needsPermission: BackupService.needsPermission,
                             active: BackupService.isActive,
                             announcedPermission: !!(announced && announced.needsPermission) };

            // Resume() is the gesture the button provides
            const resumed = await BackupService.resume();
            const after = await BackupService.writeVersion(App._getProjectData(), 'Castle');
            return { paused, resumed, after };
        });

        expect(r.paused.blocked).toBeNull();
        expect(r.paused.needsPermission).toBe(true);
        expect(r.paused.active).toBe(false);
        expect(r.paused.announcedPermission).toBe(true);
        // and nothing was written in between, so numbering has no hole
        expect(r.resumed).toBe(true);
        expect(r.after).toBe('Castle V2.pixula');
    });

test('a filename that cannot be written is made safe and still parses back',
    async ({ page }) => {
        await boot(page);
        await useFakeFolder(page);

        const written = await page.evaluate(() =>
            BackupService.writeVersion(App._getProjectData(), 'my/pic:v2*.scr'));

        // Path and wildcard characters gone, extension dropped, still V-numbered
        expect(written).toBe('my-pic-v2- V1.pixula');
        expect(BackupServiceVersionParses(written)).toBe(true);

        function BackupServiceVersionParses(name) {
            return /^(.*) V(\d+)\.pixula$/i.test(name);
        }
    });

test('the database autosave survives a folder that has gone away', async ({ page }) => {
    await boot(page);
    await useFakeFolder(page);

    // THE property this feature must not break. Disk backups are additive; the
    // IndexedDB record is the crash recovery and may never depend on a folder.
    const r = await page.evaluate(async () => {
        await Storage.delete('autosave');
        PixelDrawRoutine.draw(3, 3, { mirror: false });
        FileManager.hasUnsavedChanges = true;

        // The folder throws on every write, the way an unplugged drive does
        window.__dir.getFileHandle = async () => { throw new Error('device gone'); };

        // Exactly what the autosave tick does
        const project = App._getProjectData();
        await Storage.set('autosave', project);
        const disk = await BackupService.writeVersion(project, 'Castle');

        const record = await Storage.get('autosave');
        return {
            disk,
            recovered: !!(record && Array.isArray(record.layers)),
            reportedError: !!BackupService.lastError
        };
    });

    expect(r.disk).toBeNull();        // the disk copy failed
    expect(r.recovered).toBe(true);   // the work is still recoverable
    expect(r.reportedError).toBe(true); // and it did not fail silently
});
