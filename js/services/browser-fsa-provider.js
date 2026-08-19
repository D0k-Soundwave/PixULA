'use strict';
(function() {

/**
 * BrowserFSAProvider — today's File System Access API behaviour, wrapped
 * behind FileAccessProvider so BackupService/ReferenceLayerService can
 * treat it identically to CompanionFileProvider. folderRef IS the
 * FileSystemDirectoryHandle; permission handling (queryPermission /
 * requestPermission, the 'prompt' reset on browser restart) stays exactly
 * as it always worked - this class does not change that behaviour, only
 * relocates it behind the shared interface.
 */
class BrowserFSAProvider extends FileAccessProvider {
    isAvailable() {
        return typeof window.showDirectoryPicker === 'function';
    }

    async chooseFolder(label) {
        try {
            return await window.showDirectoryPicker({ id: label, mode: 'readwrite' });
        } catch (error) {
            if (error && error.name === 'AbortError') return null;
            throw error;
        }
    }

    /** @private */
    async _permission(handle, request) {
        const opts = { mode: 'readwrite' };
        let state = await handle.queryPermission(opts);
        if (state === 'prompt' && request) state = await handle.requestPermission(opts);
        return state;
    }

    async listFiles(folderRef) {
        const out = [];
        for await (const [name, entry] of folderRef.entries()) {
            if (entry.kind !== 'file') continue;
            const file = await entry.getFile();
            out.push({ name, size: file.size, mtime: file.lastModified });
        }
        return out;
    }

    async readFile(folderRef, relPath) {
        const fileHandle = await folderRef.getFileHandle(relPath);
        const file = await fileHandle.getFile();
        return file.arrayBuffer();
    }

    async writeFile(folderRef, relPath, bytes) {
        const fileHandle = await folderRef.getFileHandle(relPath, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(bytes);
        await writable.close();
    }

    async deleteFile(folderRef, relPath) {
        try {
            await folderRef.removeEntry(relPath);
            return true;
        } catch (error) {
            if (error && error.name === 'NotFoundError') return false;
            throw error;
        }
    }
}

window.BrowserFSAProvider = BrowserFSAProvider;

})();
