'use strict';
(function() {

/**
 * ZipStore - writes a .zip of files stored without compression.
 *
 * Used where several files must reach the artist as one download (an
 * animation's numbered screens, in browsers that cannot write into a folder).
 * Spectrum screens are a few KB each and an unpacked zip opens everywhere, so
 * there is nothing to gain from deflate here and a decoder-free format to keep.
 *
 * Layout (PKWARE APPNOTE 6.3.x, section 4.3): a local file header and the
 * bytes for each file, then the central directory, then the end-of-central-
 * directory record. Method 0 (stored), CRC-32 of each file, names in UTF-8
 * (general purpose bit 11). No zip64: [P] a plain zip holds up to 65,535
 * entries of up to 4 GB each, far past an animation's screens.
 */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

const ZipStore = {
    /** [P] zip entry count limit without zip64 (APPNOTE 4.4.21: 2 bytes). */
    MAX_ENTRIES: 0xFFFF,

    /** CRC-32 (the zip / PNG polynomial 0xEDB88320) of a byte array. */
    crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    },

    /**
     * Build the zip.
     * @param {Array<{name: string, data: Uint8Array}>} files
     * @param {Date} [when] - the time stamp written for every entry
     * @returns {Uint8Array}
     */
    build(files, when = new Date()) {
        if (files.length > this.MAX_ENTRIES) throw new Error('Too many files for one zip');
        const enc = new TextEncoder();
        const time = ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xFFFF;
        const date = (((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xFFFF;
        const entries = files.map(f => ({ name: enc.encode(f.name), data: f.data, crc: this.crc32(f.data) }));
        const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
        const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
        const out = new Uint8Array(localSize + centralSize + 22);
        const dv = new DataView(out.buffer);
        let p = 0;
        const offsets = [];
        for (const e of entries) {
            offsets.push(p);
            dv.setUint32(p, 0x04034B50, true);       // local file header signature
            dv.setUint16(p + 4, 20, true);           // version needed: 2.0
            dv.setUint16(p + 6, 0x0800, true);       // flags: UTF-8 names
            dv.setUint16(p + 8, 0, true);            // method: stored
            dv.setUint16(p + 10, time, true);
            dv.setUint16(p + 12, date, true);
            dv.setUint32(p + 14, e.crc, true);
            dv.setUint32(p + 18, e.data.length, true);
            dv.setUint32(p + 22, e.data.length, true);
            dv.setUint16(p + 26, e.name.length, true);
            dv.setUint16(p + 28, 0, true);
            out.set(e.name, p + 30);
            out.set(e.data, p + 30 + e.name.length);
            p += 30 + e.name.length + e.data.length;
        }
        const central = p;
        entries.forEach((e, i) => {
            dv.setUint32(p, 0x02014B50, true);       // central directory header signature
            dv.setUint16(p + 4, 20, true);           // version made by
            dv.setUint16(p + 6, 20, true);           // version needed
            dv.setUint16(p + 8, 0x0800, true);
            dv.setUint16(p + 10, 0, true);
            dv.setUint16(p + 12, time, true);
            dv.setUint16(p + 14, date, true);
            dv.setUint32(p + 16, e.crc, true);
            dv.setUint32(p + 20, e.data.length, true);
            dv.setUint32(p + 24, e.data.length, true);
            dv.setUint16(p + 28, e.name.length, true);
            // extra length, comment length, disk number, internal / external attributes: all 0
            dv.setUint32(p + 42, offsets[i], true);
            out.set(e.name, p + 46);
            p += 46 + e.name.length;
        });
        dv.setUint32(p, 0x06054B50, true);           // end of central directory
        dv.setUint16(p + 8, entries.length, true);
        dv.setUint16(p + 10, entries.length, true);
        dv.setUint32(p + 12, p - central, true);
        dv.setUint32(p + 16, central, true);
        return out;
    }
};

window.ZipStore = ZipStore;

})();
