'use strict';
(function() {

const COMPANION_BASE_URL = 'http://127.0.0.1:51973';

/**
 * CompanionFileProvider — talks to the companion binary over HTTP.
 * folderRef IS the plain folderId string the companion hands back from
 * /folders/choose; the companion alone maps that id to a real path (see
 * docs/superpowers/specs/2026-08-19-companion-bridge-design.md §4.3 -
 * PixULA never constructs or sends a raw OS path).
 */
class CompanionFileProvider extends FileAccessProvider {
    /** @param {() => string} getToken - current bearer token, re-read per call */
    constructor(getToken) {
        super();
        this._getToken = getToken;
    }

    isAvailable() {
        return true; // reachability is checked by CompanionBridgeService, not per-call here
    }

    /** @private */
    _headers(extra) {
        return { Authorization: `Bearer ${this._getToken()}`, ...extra };
    }

    async chooseFolder(label) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/choose`, {
            method: 'POST',
            headers: this._headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ label })
        });
        // 204 is the companion's "picker closed, nothing chosen" - the only
        // response that means the artist cancelled, and the only one that may
        // return null: BackupService reads a null return as "pressed Escape"
        // and reports nothing at all, so collapsing a 401 (a token a
        // restarted companion no longer knows) or a 500 into it would hide a
        // real failure behind a silent no-op. Everything else throws, exactly
        // as BrowserFSAProvider rethrows anything that is not an AbortError.
        if (res.status === 204) return null;
        if (!res.ok) throw new Error(`companion: chooseFolder failed (${res.status})`);
        const body = await res.json();
        return body.folderId;
    }

    async listFiles(folderRef) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${encodeURIComponent(folderRef)}/list`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: listFiles failed (${res.status})`);
        return res.json();
    }

    async readFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${encodeURIComponent(folderRef)}/file/${encodeURIComponent(relPath)}`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: readFile failed (${res.status})`);
        return res.arrayBuffer();
    }

    async writeFile(folderRef, relPath, bytes) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${encodeURIComponent(folderRef)}/file/${encodeURIComponent(relPath)}`, {
            method: 'PUT',
            headers: this._headers(),
            body: bytes
        });
        if (!res.ok) throw new Error(`companion: writeFile failed (${res.status})`);
    }

    async deleteFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${encodeURIComponent(folderRef)}/file/${encodeURIComponent(relPath)}`, {
            method: 'DELETE',
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: deleteFile failed (${res.status})`);
        return true;
    }

    /**
     * List OS-installed fonts the companion can see. Each entry is
     * { fontId, family, style } — no font bytes here, that is readFontFile.
     * @returns {Promise<Array<{fontId:string, family:string, style:string}>>}
     */
    async listFonts() {
        const res = await fetch(`${COMPANION_BASE_URL}/fonts`, { headers: this._headers() });
        if (!res.ok) throw new Error(`companion: listFonts failed (${res.status})`);
        return res.json();
    }

    /**
     * Read one system font's raw file bytes (TTF/OTF) by id, for
     * client-side rasterization (FontRasterizer) — no font rendering ever
     * happens in the companion itself.
     * @param {string} fontId
     * @returns {Promise<ArrayBuffer>}
     */
    async readFontFile(fontId) {
        const res = await fetch(`${COMPANION_BASE_URL}/fonts/${encodeURIComponent(fontId)}/file`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: readFontFile failed (${res.status})`);
        return res.arrayBuffer();
    }
}

window.CompanionFileProvider = CompanionFileProvider;

})();
