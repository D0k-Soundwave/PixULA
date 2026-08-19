'use strict';
(function() {

/**
 * FileAccessProvider — the shared shape every folder-access backend
 * implements (browser File System Access API, or the companion bridge).
 * A feature (BackupService, the reference-photo link) holds ONE instance
 * of whichever provider it's configured to use and never branches on
 * which kind it has - that is the whole point of the interface.
 *
 * `folderRef` is deliberately opaque: BrowserFSAProvider's is a
 * FileSystemDirectoryHandle (structured-clonable, so callers persist it
 * directly), CompanionFileProvider's is a plain folderId string. Callers
 * store whatever chooseFolder() returns and pass it back unchanged.
 */
class FileAccessProvider {
    /** @returns {Promise<*|null>} folderRef, or null if the artist cancelled */
    async chooseFolder(label) { throw new Error('Not implemented'); }
    /**
     * `mtime` is MILLISECONDS since the Unix epoch - the File API's
     * `file.lastModified` / `Date.now()` convention - in EVERY provider. The
     * companion converts on its own side (Go's UnixMilli) so a caller never
     * has to know which backend a listing came from.
     * @returns {Promise<{name:string,size:number,mtime:number}[]>}
     */
    async listFiles(folderRef) { throw new Error('Not implemented'); }
    /** @returns {Promise<ArrayBuffer>} */
    async readFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /** @param {ArrayBuffer|Uint8Array} bytes */
    async writeFile(folderRef, relPath, bytes) { throw new Error('Not implemented'); }
    /** @returns {Promise<boolean>} */
    async deleteFile(folderRef, relPath) { throw new Error('Not implemented'); }
    /** Synchronous quick check: could this provider even be tried right now? */
    isAvailable() { throw new Error('Not implemented'); }
}

window.FileAccessProvider = FileAccessProvider;

})();
