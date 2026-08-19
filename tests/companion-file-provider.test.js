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
}

run().then(() => console.log('ALL CHECKS PASSED')).catch((e) => { console.error(e); process.exit(1); });
