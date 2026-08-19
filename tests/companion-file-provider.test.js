'use strict';
global.window = global;

require('../js/services/file-access-provider.js');
require('../js/services/companion-file-provider.js');

async function run() {
    const calls = [];
    global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        if (url.endsWith('/folders/choose')) {
            return { ok: true, json: async () => ({ folderId: 'abc123', label: 'Backups' }) };
        }
        if (url.includes('/folders/abc123/list')) {
            return { ok: true, json: async () => ([{ name: 'v1.pixula', size: 10, mtime: 0 }]) };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === undefined) {
            return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === 'PUT') {
            return { ok: true };
        }
        if (url.includes('/folders/abc123/file/v1.pixula') && opts.method === 'DELETE') {
            return { ok: true };
        }
        if (url.includes('/folders/abc123/file/') && url.includes('%20') && opts.method === undefined) {
            return { ok: true, arrayBuffer: async () => new Uint8Array([5, 6, 7]).buffer };
        }
        if (url.includes('/folders/abc123/file/') && url.includes('%E2%9C%93') && opts.method === 'PUT') {
            return { ok: true };
        }
        if (url.includes('/folders/abc123/file/') && url.includes('%E2%9C%93') && opts.method === 'DELETE') {
            return { status: 403, ok: false };
        }
        throw new Error('unexpected fetch: ' + url);
    };

    const provider = new CompanionFileProvider(() => 'tok-xyz');

    const folderRef = await provider.chooseFolder('Backups');
    if (folderRef !== 'abc123') throw new Error('expected chooseFolder to return the folderId string');
    console.log('  ok: chooseFolder returns the opaque folderId');

    const files = await provider.listFiles(folderRef);
    if (files.length !== 1 || files[0].name !== 'v1.pixula') throw new Error('listFiles mismatch');
    console.log('  ok: listFiles parses the folder listing');

    const bytes = await provider.readFile(folderRef, 'v1.pixula');
    if (new Uint8Array(bytes).length !== 3) throw new Error('readFile mismatch');
    console.log('  ok: readFile returns the raw bytes');

    await provider.writeFile(folderRef, 'v1.pixula', new Uint8Array([9]));
    await provider.deleteFile(folderRef, 'v1.pixula');
    console.log('  ok: writeFile/deleteFile complete without throwing');

    const authHeader = calls.find((c) => c.url.includes('/folders/abc123/list')).opts.headers.Authorization;
    if (authHeader !== 'Bearer tok-xyz') throw new Error('expected the bearer token on every authenticated call');
    console.log('  ok: every call after chooseFolder carries the bearer token');

    // Test URL encoding for filenames with spaces
    const spaceFilename = 'My Project V1.pixula';
    const spaceBytes = await provider.readFile(folderRef, spaceFilename);
    if (new Uint8Array(spaceBytes).length !== 3) throw new Error('readFile with spaces failed');
    const spaceCall = calls.find((c) => c.url.includes('%20'));
    if (!spaceCall) throw new Error('space in filename was not URL-encoded');
    console.log('  ok: filenames with spaces are URL-encoded as %20');

    // Test URL encoding for filenames with unicode
    const unicodeFilename = 'project✓.pixula';
    await provider.writeFile(folderRef, unicodeFilename, new Uint8Array([42]));
    const unicodeCall = calls.find((c) => c.url.includes('%E2%9C%93'));
    if (!unicodeCall) throw new Error('unicode in filename was not URL-encoded');
    console.log('  ok: unicode characters in filenames are percent-encoded');

    // Test deleteFile throws on error response
    let deleteThrew = false;
    try {
        await provider.deleteFile(folderRef, unicodeFilename);
    } catch (e) {
        if (e.message.includes('deleteFile failed')) deleteThrew = true;
    }
    if (!deleteThrew) throw new Error('deleteFile should throw on non-ok status');
    console.log('  ok: deleteFile throws on non-ok response');

    // Test deleteFile returns true on success
    const deleteResult = await provider.deleteFile(folderRef, 'v1.pixula');
    if (deleteResult !== true) throw new Error('deleteFile should return true on success');
    console.log('  ok: deleteFile returns true on success');
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
