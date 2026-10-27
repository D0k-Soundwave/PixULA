'use strict';
/**
 * ZipStore - the store-only zip an animation's numbered screens are saved in
 * where the browser cannot write into a folder: the CRC-32 against known
 * values, and the archive read back entry by entry.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/zip-store.js');

const enc = (s) => new TextEncoder().encode(s);
check('CRC-32 of "123456789" is CBF43926 (the standard check value)', ZipStore.crc32(enc('123456789')) === 0xCBF43926);
check('CRC-32 of nothing is 0', ZipStore.crc32(new Uint8Array(0)) === 0);

const files = [
    { name: 'walk_001.scr', data: new Uint8Array(6912).fill(0x38, 6144) },
    { name: 'walk_002.scr', data: new Uint8Array(6912).fill(0x47, 6144) },
    { name: 'Läufer_003.scr', data: new Uint8Array([1, 2, 3]) }
];
const zip = ZipStore.build(files, new Date(2026, 9, 27, 12, 30, 10));
const dv = new DataView(zip.buffer);

// Walk the local headers
const seen = [];
let p = 0;
while (dv.getUint32(p, true) === 0x04034B50) {
    const method = dv.getUint16(p + 8, true);
    const crc = dv.getUint32(p + 14, true);
    const size = dv.getUint32(p + 18, true);
    const nameLen = dv.getUint16(p + 26, true);
    const name = new TextDecoder().decode(zip.subarray(p + 30, p + 30 + nameLen));
    const data = zip.subarray(p + 30 + nameLen, p + 30 + nameLen + size);
    seen.push({ name, method, crcOk: ZipStore.crc32(data) === crc, data });
    p += 30 + nameLen + size;
}
check('every file is there, in order', seen.map(e => e.name).join('|') === files.map(f => f.name).join('|'));
check('stored, not compressed', seen.every(e => e.method === 0));
check('each CRC matches its bytes', seen.every(e => e.crcOk));
check('the bytes come back unchanged', seen.every((e, i) => e.data.length === files[i].data.length && e.data.every((b, k) => b === files[i].data[k])));
check('names are UTF-8 (flag bit 11 set)', (dv.getUint16(6, true) & 0x0800) !== 0);

// The end record points at the central directory
const end = zip.length - 22;
check('the archive ends with the end-of-central-directory record', dv.getUint32(end, true) === 0x06054B50);
check('...counting every entry', dv.getUint16(end + 10, true) === 3);
const cdStart = dv.getUint32(end + 16, true);
check('...whose central directory starts where the files end', cdStart === p && dv.getUint32(cdStart, true) === 0x02014B50);
check('the date is stored DOS-style: 2026-10-27', dv.getUint16(12, true) === (((2026 - 1980) << 9) | (10 << 5) | 27));

summary();
