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
        if (!res.ok) return null;
        const body = await res.json();
        return body.folderId;
    }

    async listFiles(folderRef) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/list`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: listFiles failed (${res.status})`);
        return res.json();
    }

    async readFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`companion: readFile failed (${res.status})`);
        return res.arrayBuffer();
    }

    async writeFile(folderRef, relPath, bytes) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            method: 'PUT',
            headers: this._headers(),
            body: bytes
        });
        if (!res.ok) throw new Error(`companion: writeFile failed (${res.status})`);
    }

    async deleteFile(folderRef, relPath) {
        const res = await fetch(`${COMPANION_BASE_URL}/folders/${folderRef}/file/${relPath}`, {
            method: 'DELETE',
            headers: this._headers()
        });
        return res.ok;
    }
}

window.CompanionFileProvider = CompanionFileProvider;

})();
