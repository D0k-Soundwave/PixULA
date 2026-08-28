'use strict';
(function() {

/**
 * FileAccessProvider — the shared shape a folder-access backend implements
 * (currently just the browser File System Access API). A feature
 * (BackupService, the reference-photo link) holds ONE instance of whichever
 * provider it's configured to use and never branches on which kind it has -
 * that is the whole point of the interface.
 *
 * `folderRef` is deliberately opaque: BrowserFSAProvider's is a
 * FileSystemDirectoryHandle (structured-clonable, so callers persist it
 * directly). Callers store whatever chooseFolder() returns and pass it
 * back unchanged.
 */
class FileAccessProvider {
    /** @returns {Promise<*|null>} folderRef, or null if the artist cancelled */
    async chooseFolder(label) { throw new Error('Not implemented'); }
    /**
     * `mtime` is MILLISECONDS since the Unix epoch - the File API's
     * `file.lastModified` / `Date.now()` convention.
     * @returns {Promise<{name:string,size:number,mtime:number}[]>}
     */
    async listFiles(folderRef) { throw new Error('Not implemented'); }
    /** @returns {Promise<ArrayBuffer>} */
    async readFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /** @param {ArrayBuffer|Uint8Array} bytes */
    async writeFile(folderRef, relPath, bytes) { throw new Error('Not implemented'); }
    /** @returns {Promise<boolean>} */
    async deleteFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /**
     * Query (and, if `request`, ask for) write permission on a folderRef.
     * @param {*} folderRef
     * @param {boolean} request - also prompt if permission is not yet decided
     * @returns {Promise<'granted'|'denied'|'prompt'>}
     */
    async getPermission(folderRef, request) { throw new Error('Not implemented'); }
    /** Synchronous quick check: could this provider even be tried right now? */
    isAvailable() { throw new Error('Not implemented'); }
}

window.FileAccessProvider = FileAccessProvider;

})();
