'use strict';
/*
 * Payload headroom - the worst case every persistence cap has to survive.
 *
 * Both caps checked here fail SILENTLY when exceeded: the clipboard simply
 * does not persist, so a copy survives until the next reload and then is not
 * there, and a map record that will not encode is a map that will not save.
 * Nothing in the app tells the artist either has happened.
 *
 * That makes these the caps most worth a build gate. Because the suite walks
 * the SCREEN_MODES registry rather than a fixed list, adding a mode larger
 * than anything shipped today fails HERE, at the point where the cap can still
 * be raised, instead of on a machine belonging to whoever tried to copy on it.
 *
 * Measured 2026-08-07: the clipboard worst case is 479,036 B at layer2_640,
 * which was 91.4% of the old 512 KB cap. The cap is 4 MB now.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs({});
loadModule('js/utils/clipboard-codec.js');
loadModule('js/utils/map-codec.js');

const MODES = Object.values(global.SCREEN_MODES);

/** The largest thing a copy can be in this mode: every pixel, every cell distinct. */
function worstClipboard(mode) {
    const W = mode.width, H = mode.height;
    const cw = mode.attrCellW, ch = mode.attrCellH;
    const pixels = [];
    for (let y = 0; y < H; y++) pixels.push(new Array(W).fill(true));

    const cells = [];
    for (let cy = 0; cy < H / ch; cy++) {
        for (let cx = 0; cx < W / cw; cx++) {
            cells.push({
                relX: cx * cw, relY: cy * ch,
                data: {
                    ink: (cx + cy) % 8, paper: (cx * 3) % 8, bright: 1, flash: 0,
                    pixels: Array.from({ length: ch }, (_, i) => (i * 37 + cx) & 0xFF)
                }
            });
        }
    }

    const clip = { width: W, height: H, pixels, cells, mode: mode.id };
    if (mode.pixelDepth > 1) {
        clip.indices = pixels.map((_, y) =>
            Array.from({ length: W }, (_, x) => (x + y) & 0xFF));
    }
    return clip;
}

console.log('--- clipboard: worst-case copy in every registered mode ---');

let worstName = '';
let worstBytes = 0;

for (const mode of MODES) {
    global.__setActiveScreenMode(mode.id);
    const encoded = ClipboardCodec.encode(worstClipboard(mode));
    check(`${mode.id}: a full-canvas copy encodes`, !!encoded);
    if (!encoded) continue;

    const bytes = JSON.stringify(encoded).length;
    const pct = (bytes / ClipboardCodec.MAX_JSON_BYTES * 100).toFixed(1);
    if (bytes > worstBytes) { worstBytes = bytes; worstName = mode.id; }

    // A cap the worst case sits near is a cap that is about to be a bug. The
    // old 512 KB was at 91.4% for layer2_640 - fitting, and one mode away from
    // not fitting.
    check(`${mode.id}: ${bytes} B is under half the cap (${pct}%)`,
        bytes * 2 < ClipboardCodec.MAX_JSON_BYTES);
}

console.log(`  worst mode: ${worstName} at ${worstBytes} B ` +
    `(${(worstBytes / ClipboardCodec.MAX_JSON_BYTES * 100).toFixed(1)}% of ` +
    `${ClipboardCodec.MAX_JSON_BYTES} B)`);

console.log('--- map: a full map at the tile cap ---');

const tiles = [];
for (let i = 0; i < MapCodec.MAX_TILES; i++) {
    tiles.push({
        kind: MapCodec.TILE_KINDS.ULA_CELL,
        bitmap: Array.from({ length: 8 }, (_, r) => (i * 31 + r * 7) & 0xFF),
        attr: (i * 13) & 0xFF
    });
}
const dim = MapCodec.MAX_DIM;
const cells = new Int16Array(dim * dim);
for (let i = 0; i < cells.length; i++) cells[i] = i % MapCodec.MAX_TILES;

const mapDoc = {
    name: 'worst case map', tileKind: MapCodec.TILE_KINDS.ULA_CELL, tiles,
    map: { width: dim, height: dim, cells }
};
const encodedMap = MapCodec.encode(mapDoc);
check('the largest legal map encodes', !!encodedMap);

if (encodedMap) {
    const bytes = JSON.stringify(encodedMap).length;
    const pct = (bytes / MapCodec.MAX_JSON_BYTES * 100).toFixed(1);
    console.log(`  ${dim}x${dim} with ${MapCodec.MAX_TILES} tiles: ${bytes} B (${pct}%)`);
    check(`the largest legal map is under half MAX_JSON_BYTES (${pct}%)`,
        bytes * 2 < MapCodec.MAX_JSON_BYTES);

    // And it must come back: a cap that admits a payload decode rejects would
    // be worse than one that refused it up front.
    const round = MapCodec.decode(encodedMap);
    check('the largest legal map decodes', !!round);
    check('every tile survives the round trip',
        !!round && round.tiles.length === MapCodec.MAX_TILES);
    check('the index grid survives the round trip',
        !!round && round.map.cells.length === dim * dim &&
        round.map.cells[0] === cells[0] &&
        round.map.cells[cells.length - 1] === cells[cells.length - 1]);
}

// One tile past the cap must be refused, or the cap is decoration
const overflow = MapCodec.encode({
    ...mapDoc,
    tiles: tiles.concat([{ kind: MapCodec.TILE_KINDS.ULA_CELL,
                           bitmap: [1, 2, 3, 4, 5, 6, 7, 8], attr: 7 }])
});
check('one tile past MAX_TILES is refused', overflow === null);

summary('payload-headroom');
