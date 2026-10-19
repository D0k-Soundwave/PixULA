'use strict';
/**
 * Batch 9 part 9B step 2: Save Selection As. The rule of each format lives in the registry (selectionRule / selectionFit);
 * the writers that take a part of the picture (options.rect) write exactly that part. Pure byte checks with synthetic screens.
 */
const fs = require('fs');
const path = require('path');
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

// Synthetic screen: distinct bitmap and attribute bytes everywhere
const screen = new Uint8Array(6912);
for (let i = 0; i < 6144; i++) screen[i] = (i * 13 + 7) & 0xFF;
for (let i = 0; i < 768; i++) screen[6144 + i] = (i * 3 + 1) & 0xFF;

// A flattened layer whose cells are derived from the same bytes (for ZXP / ColorTiles)
const flat = {
  getCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= 32 || cy >= 24) return null;
    const pixels = new Uint8Array(8);
    for (let j = 0; j < 8; j++) pixels[j] = screen[((cy * 8 + j) & 0xC0) * 32 + (((cy * 8 + j) & 0x07) << 8) + (((cy * 8 + j) & 0x38) << 2) + cx];
    const a = screen[6144 + cy * 32 + cx];
    return { pixels, ink: a & 7, paper: (a >> 3) & 7, bright: !!(a & 0x40), flash: !!(a & 0x80) };
  }
};
const imageData = { width: 256, height: 192, data: new Uint8ClampedArray(256 * 192 * 4) };
for (let i = 0; i < imageData.data.length; i++) imageData.data[i] = (i * 7 + 3) & 255;

let parsed = null;
installStubs({
  SCRFormat: { export: () => screen.slice(), canExport: () => true, parse: (b) => ({ success: true }),
    importScreen: (bitmap, attrs) => { parsed = { bitmap, attrs }; return { success: true }; } },
  LayerManager: { stillImageData: () => imageData, flattenVisible: () => flat }
});
loadModule('js/core/attribute-system.js');
loadModule('js/utils/snap-grid.js');
loadModule('js/io/format-registry.js');
loadModule('js/io/sev-format.js');
loadModule('js/io/zed-format.js');
loadModule('js/io/dev-format.js');
loadModule('js/io/bmp-format.js');
loadModule('js/io/zxm-format.js');
loadModule('js/io/ctile-format.js');

const R = FormatRegistry;
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const scrOffset = (x, y) => AttributeSystem._lineOffset(y) + (x >> 3);

// -- the rules ------------------------------------------------------------------------------------------------------
{
  const menu = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'menu-system.js'), 'utf8');
  const block = menu.slice(menu.indexOf('const EXPORT_FORMATS'), menu.indexOf(']);', menu.indexOf('const EXPORT_FORMATS')));
  const exts = [...block.matchAll(/\['([a-z0-9]+)',/g)].map(m => m[1]);
  const missing = exts.filter(e => !['pal', 'npl', 'zxm'].includes(e) && !R.selectionRule(e));
  check('every Save Image As format except the palettes and .zxm (the whole picture with its elements) has a Save Selection As rule', exts.length > 20 && missing.length === 0, missing.join());
  check('palettes have none', !R.selectionRule('pal') && !R.selectionRule('npl'));
  const rules = new Set(Object.values(R.SELECTION_RULES));
  check('the rule names are the four known ones', eq([...rules].sort(), ['cells', 'pixels', 'screen', 'tiles16']));
}
for (const ext of Object.keys(R.SELECTION_RULES)) R.registerExport(ext, { canExport: () => true, exportAndDownload: async () => true });
{
  __setActiveScreenMode('standard_ula');
  const part = { x: 3, y: 5, width: 20, height: 11 };
  check('no selection: none', R.selectionFit('png', null).reason === 'none');
  check('not a picture format: notPicture', R.selectionFit('pal', part).reason === 'notPicture');
  check('pixels: any rectangle as it is', eq(R.selectionFit('png', part), { ok: true, rect: part, snapped: false }));
  const cells = R.selectionFit('sev', part);
  check('cells: fitted to whole cells, covering the part', cells.ok && cells.snapped && eq(cells.rect, { x: 0, y: 0, width: 24, height: 16 }), JSON.stringify(cells));
  const tiles = R.selectionFit('ctile', part);
  check('tiles16: fitted to the 16 grid', tiles.ok && tiles.snapped && eq(tiles.rect, { x: 0, y: 0, width: 32, height: 16 }), JSON.stringify(tiles));
  check('an aligned part is not "snapped"', R.selectionFit('sev', { x: 8, y: 8, width: 16, height: 16 }).snapped === false);
  check('screen: refused for a part', R.selectionFit('scr', part).reason === 'screenOnly');
  check('screen: accepted for the whole screen', eq(R.selectionFit('scr', { x: 0, y: 0, width: 256, height: 192 }), { ok: true, rect: null, snapped: false }));
  check('a format the mode cannot export is refused with mode',
    (R.registerExport('sev', { canExport: () => false }), R.selectionFit('sev', part).reason === 'mode'));
  R.registerExport('sev', SEVFormat);
  check('a handler that cannot dump a part here is refused with layout',
    (R.registerExport('asm', { canExport: () => true, canExportRect: () => false }), R.selectionFit('asm', part).reason === 'layout'));
  R.registerExport('asm', DevFormat);
  R.registerExport('asm', { canExport: () => true, canExportRect: () => true });
  __setActiveScreenMode('multicolor_8x4');
  const mc = R.selectionFit('zxp', { x: 3, y: 5, width: 20, height: 11 });
  check('multicolor 8x4: cells are 8x4 high', mc.ok && eq(mc.rect, { x: 0, y: 4, width: 24, height: 12 }), JSON.stringify(mc));
  __setActiveScreenMode('standard_ula');
}

// -- Helpers.cropImageData -------------------------------------------------------------------------------------------
{
  const c = Helpers.cropImageData(imageData, { x: 5, y: 7, width: 10, height: 4 });
  let ok = c.width === 10 && c.height === 4;
  for (let y = 0; y < 4 && ok; y++) for (let x = 0; x < 10; x++) for (let k = 0; k < 4; k++) {
    if (c.data[(y * 10 + x) * 4 + k] !== imageData.data[((7 + y) * 256 + 5 + x) * 4 + k]) ok = false;
  }
  check('cropImageData copies exactly that part', ok);
  const before = imageData.data[0];
  c.data[0] = before ^ 255;
  check('...and never touches the source', imageData.data[0] === before);
  const edge = Helpers.cropImageData(imageData, { x: 250, y: 190, width: 99, height: 99 });
  check('a rectangle past the edge is clamped', edge.width === 6 && edge.height === 2);
}

// -- BMP of a rectangle ------------------------------------------------------------------------------------------------
{
  const full = BMPFormat.export();
  const rect = { x: 40, y: 30, width: 17, height: 9 };
  const part = BMPFormat.export({ rect });
  const dv = new DataView(part.buffer);
  check('BMP of a rectangle has its size in the header', dv.getInt32(18, true) === 17 && dv.getInt32(22, true) === -9);
  const fullDv = new DataView(full.buffer);
  const rowFull = Math.ceil(256 * 3 / 4) * 4, rowPart = Math.ceil(17 * 3 / 4) * 4;
  let ok = true;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 17; x++) for (let k = 0; k < 3; k++) {
    if (part[54 + y * rowPart + x * 3 + k] !== full[54 + (30 + y) * rowFull + (40 + x) * 3 + k]) ok = false;
  }
  check('...and its pixels are the crop of the full BMP', ok);
  check('...and its file length matches', part.length === 54 + rowPart * 9 && fullDv.getUint32(2, true) === full.length);
}

// -- SEV / ZED of a block of cells ---------------------------------------------------------------------------------------
{
  const part = { x: 16, y: 24, width: 32, height: 16 };      // cells 2..5, rows 3..4
  const sev = SEVFormat.export({ rect: part });
  check('SEV header carries the block size', (sev[10] | (sev[11] << 8)) === 32 && (sev[12] | (sev[13] << 8)) === 16);
  check('SEV length is 14 + 4*2*9', sev.length === 14 + 8 * 9);
  const dec = SEVFormat.decodeToScreen(sev);
  let ok = dec.success;
  for (let cy = 0; cy < 2 && ok; cy++) for (let cx = 0; cx < 4; cx++) {
    for (let j = 0; j < 8; j++) if (dec.scr[scrOffset(cx * 8, cy * 8 + j)] !== screen[scrOffset(16 + cx * 8, 24 + cy * 8 + j)]) ok = false;
    if (dec.scr[6144 + cy * 32 + cx] !== screen[6144 + (3 + cy) * 32 + 2 + cx]) ok = false;
  }
  check('SEV: decoding puts the block at the top left, bytes equal to the source cells', ok);
  let threw = false;
  try { SEVFormat.export({ rect: { x: 3, y: 0, width: 16, height: 16 } }); } catch (e) { threw = true; }
  check('SEV: a part that is not whole cells is refused', threw);

  const zed = ZEDFormat.export({ rect: part });
  const zdec = ZEDFormat.decodeToScreen(zed);
  let zok = zdec.success;
  for (let cy = 0; cy < 2 && zok; cy++) for (let cx = 0; cx < 4; cx++) {
    for (let j = 0; j < 8; j++) if (zdec.scr[scrOffset(cx * 8, cy * 8 + j)] !== screen[scrOffset(16 + cx * 8, 24 + cy * 8 + j)]) zok = false;
    if (zdec.scr[6144 + cy * 32 + cx] !== screen[6144 + (3 + cy) * 32 + 2 + cx]) zok = false;
  }
  check('ZED: the block decodes to the same cells at the top left', zok);
  check('the whole-screen exports are unchanged (no rect)', SEVFormat.export().length === 14 + 768 * 9 && same(SEVFormat.decodeToScreen(SEVFormat.export()).scr, screen));
}

// -- ASM / C / BIN / ATR of a block --------------------------------------------------------------------------------------
{
  const part = { x: 16, y: 24, width: 32, height: 16 };
  const bin = DevFormat.generate('bin', 'part', part);
  check('BIN: w/8 bytes a row, top to bottom', bin.length === 4 * 16);
  let ok = true;
  for (let y = 0; y < 16; y++) for (let b = 0; b < 4; b++) if (bin[y * 4 + b] !== screen[scrOffset(16 + b * 8, 24 + y)]) ok = false;
  check('BIN: the bytes are the rows of the part', ok);
  const atr = DevFormat.generate('atr', 'part', part);
  check('ATR: one byte a cell, row by row', atr.length === 8 && atr[0] === screen[6144 + 3 * 32 + 2] && atr[4] === screen[6144 + 4 * 32 + 2] && atr[7] === screen[6144 + 4 * 32 + 5]);
  const asm = Buffer.from(DevFormat.generate('asm', 'part', part)).toString('utf8');
  check('ASM: says what the bytes are and holds 64 + 8 of them', asm.includes('4 bytes a row') && (asm.match(/\$[0-9A-F]{2}/g) || []).length === 72);
  const c = Buffer.from(DevFormat.generate('c', 'part', part)).toString('utf8');
  check('C: arrays of 64 and 8', c.includes('part_bitmap[64]') && c.includes('part_attributes[8]'));
  let threw = false;
  try { DevFormat.generate('bin', 'p', { x: 4, y: 0, width: 8, height: 8 }); } catch (e) { threw = true; }
  check('a part that is not whole cells is refused', threw);
  check('without a rect the dump is the whole screen as before', DevFormat.generate('bin', 'p').length === 6144);
  __setActiveScreenMode('timex_hires');
  check('Timex hi-res cannot dump a part', DevFormat.canExportRect() === false);
  __setActiveScreenMode('standard_ula');
}

// -- a part in the 8x1 modes: the attribute block is in the ULA line interleave, one row a pixel line ----------------
for (const mode of ['multicolor_8x1', 'ula_plus_8x1']) {
  __setActiveScreenMode(mode);
  const attrOf = (y, col) => (y * 7 + col * 3 + 1) & 0xFF;
  const mc = new Uint8Array(ACTIVE_SCREEN_MODE.fileSize);
  for (let i = 0; i < 6144; i++) mc[i] = (i * 13 + 7) & 0xFF;
  for (let y = 0; y < 192; y++) for (let col = 0; col < 32; col++) mc[6144 + AttributeSystem._lineOffset(y) + col] = attrOf(y, col);
  const exportBefore = SCRFormat.export;
  SCRFormat.export = () => mc.slice();
  const part = { x: 16, y: 8, width: 16, height: 16 };
  const r = DevFormat.rectBytes(part);
  const want = [];
  for (let line = 0; line < 16; line++) for (let c = 0; c < 2; c++) want.push(attrOf(8 + line, 2 + c));
  check(mode + ': a part keeps each pixel line\'s own attribute bytes', r.rows === 16 && r.cols === 2 && same(Array.from(r.attrs), want),
    JSON.stringify(Array.from(r.attrs).slice(0, 8)) + ' want ' + JSON.stringify(want.slice(0, 8)));
  const atr = DevFormat.generate('atr', 'part', part);
  check(mode + ': ATR of a part is those bytes', same(Array.from(atr), want));
  SCRFormat.export = exportBefore;
  __setActiveScreenMode('standard_ula');
}

// -- ZXP of a block ----------------------------------------------------------------------------------------------------
{
  const part = { x: 16, y: 24, width: 32, height: 16 };
  const text = Buffer.from(ZXMFormat.exportZxp({ rect: part })).toString('utf8').split('\r\n');
  const bitmapRows = text.slice(2, 2 + 16);
  check('ZXP: 16 bitmap rows of 32 pixels', bitmapRows.length === 16 && bitmapRows.every(r => r.length === 32 && /^[01]+$/.test(r)));
  const attrRows = text.slice(2 + 16 + 1, 2 + 16 + 1 + 2);
  check('ZXP: 2 attribute rows of 4 cells', attrRows.length === 2 && attrRows.every(r => r.split(' ').length === 4));
  check('ZXP: first pixel row is the source row', bitmapRows[0] === [...Array(4)].map((_, b) => screen[scrOffset(16 + b * 8, 24)].toString(2).padStart(8, '0')).join(''));
  const back = ZXMFormat.parseZxp(new TextEncoder().encode(text.join('\r\n')).buffer);
  check('ZXP: the block loads back at the top left', back.success === true && parsed && parsed.bitmap[scrOffset(0, 0)] === screen[scrOffset(16, 24)]);
  let threw = false;
  try { ZXMFormat.exportZxp({ rect: { x: 3, y: 0, width: 16, height: 16 } }); } catch (e) { threw = true; }
  check('ZXP: a part that is not whole cells is refused', threw);
}

// -- ColorTiles ---------------------------------------------------------------------------------------------------------
{
  __setActiveScreenMode('multicolor_8x1');
  check('ctile with no rect saves the whole canvas', CtileFormat.export().length === 192 * 64);
  const t = CtileFormat.export({ rect: { x: 16, y: 32, width: 32, height: 16 } });
  check('ctile with a rect: 2 tiles of 64 bytes', t.length === 2 * 64);
  let threw = false;
  try { CtileFormat.export({ rect: { x: 8, y: 0, width: 16, height: 16 } }); } catch (e) { threw = true; }
  check('ctile: a part off the 16 grid is refused', threw);
  __setActiveScreenMode('standard_ula');
}

summary();
