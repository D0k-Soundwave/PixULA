'use strict';
/**
 * File > Save Project / Save Project As now open a real native Save dialog
 * (showSaveFilePicker), not the old hand-rolled SaveDialog text field -
 * that dialog only ever asked "what filename", which showSaveFilePicker
 * already asks as part of choosing a real location, so asking twice would
 * have meant two prompts for one save. The native call itself needs no
 * separate permission step - the picker IS the artist's consent, same as
 * showOpenFilePicker already works on this file:// app for Reference
 * photos and Load.
 *
 * showSaveFilePicker is a native dialog Playwright cannot drive, so these
 * run against a stub returning a fake FileSystemFileHandle - the same
 * pattern backup-versions.spec.js already uses for showDirectoryPicker.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Install a fake handle at some virtual path; window.showSaveFilePicker resolves to it. */
const stubSavePicker = (page, filename) => page.evaluate((filename) => {
    const files = new Map();
    window.__savedFiles = files;
    let calls = 0;
    window.__savePickerCalls = () => calls;

    window.showSaveFilePicker = async () => {
        calls++;
        return {
            name: filename,
            createWritable: async () => ({
                write: async (data) => {
                    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
                    files.set(filename, bytes);
                },
                close: async () => {}
            })
        };
    };
}, filename);

test('Save Project opens the native picker once and writes directly, no hand-rolled dialog',
    async ({ page }) => {
        await boot(page);
        await stubSavePicker(page, 'Castle.pixula');

        const r = await page.evaluate(async () => {
            const ok = await FileManager.saveAs();
            return {
                ok,
                currentFilename: FileManager.currentFilename,
                hasUnsavedChanges: FileManager.hasChanges(),
                pickerCalls: window.__savePickerCalls(),
                bytesWritten: window.__savedFiles.get('Castle.pixula').length,
                saveDialogOpen: Dialog.isOpen('save-project')
            };
        });

        expect(r.ok).toBe(true);
        expect(r.currentFilename).toBe('Castle.pixula');
        expect(r.hasUnsavedChanges).toBe(false);
        expect(r.pickerCalls).toBe(1);
        expect(r.bytesWritten).toBeGreaterThan(0);
        // The old text-field dialog must never have opened at all.
        expect(r.saveDialogOpen).toBe(false);
    });

test('a repeat Ctrl+S writes silently to the same handle - no second picker call',
    async ({ page }) => {
        await boot(page);
        await stubSavePicker(page, 'Castle.pixula');

        const r = await page.evaluate(async () => {
            await FileManager.saveAs();
            LayerManager.addLayer(); // make a change worth re-saving
            const ok = await FileManager.save();
            return { ok, pickerCalls: window.__savePickerCalls() };
        });

        expect(r.ok).toBe(true);
        expect(r.pickerCalls).toBe(1); // still just the one from saveAs()
    });

test('cancelling the native picker leaves the document dirty, not silently "saved"',
    async ({ page }) => {
        await boot(page);
        await page.evaluate(() => {
            const err = new Error('cancelled');
            err.name = 'AbortError';
            window.showSaveFilePicker = async () => { throw err; };
        });

        const r = await page.evaluate(async () => {
            FileManager.hasUnsavedChanges = true;
            const ok = await FileManager.saveAs();
            return { ok, hasUnsavedChanges: FileManager.hasChanges() };
        });

        expect(r.ok).toBe(false);
        expect(r.hasUnsavedChanges).toBe(true);
    });

test('New file drops a previously-open handle - the next save is not silently misdirected',
    async ({ page }) => {
        await boot(page);
        await stubSavePicker(page, 'Castle.pixula');

        const r = await page.evaluate(async () => {
            await FileManager.saveAs();
            const hadHandle = !!FileManager._fileHandle;
            await FileManager.newFile();
            return { hadHandle, handleAfterNew: FileManager._fileHandle };
        });

        expect(r.hadHandle).toBe(true);
        expect(r.handleAfterNew).toBeNull();
    });

test('File > Save... opens the native picker with the extension choosing the format, not a dropdown',
    async ({ page }) => {
        await boot(page);
        await stubSavePicker(page, 'castle.png');

        const r = await page.evaluate(async () => {
            const ok = await FileManager.exportViaNativePicker();
            return {
                ok,
                bytesWritten: window.__savedFiles.get('castle.png').length,
                pickerCalls: window.__savePickerCalls(),
                exportDialogOpen: Dialog.isOpen('export-dialog')
            };
        });

        expect(r.ok).toBe(true);
        expect(r.bytesWritten).toBeGreaterThan(0);
        expect(r.pickerCalls).toBe(1); // one dialog, not a dropdown then a second prompt
        expect(r.exportDialogOpen).toBe(false); // the old format-select dialog never opened
    });

test('File > Save... cancelling the native picker does not silently succeed', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const err = new Error('cancelled');
        err.name = 'AbortError';
        window.showSaveFilePicker = async () => { throw err; };
    });

    const ok = await page.evaluate(() => FileManager.exportViaNativePicker());
    expect(ok).toBe(false);
});

test('typing a non-.pixula extension in the native dialog still saves that format',
    async ({ page }) => {
        await boot(page);
        await stubSavePicker(page, 'flat.scr');

        const r = await page.evaluate(async () => {
            const ok = await FileManager.saveAs();
            return {
                ok,
                currentFilename: FileManager.currentFilename,
                bytesWritten: window.__savedFiles.get('flat.scr').length
            };
        });

        expect(r.ok).toBe(true);
        expect(r.currentFilename).toBe('flat.scr');
        expect(r.bytesWritten).toBe(6912); // a standard SCR
    });
