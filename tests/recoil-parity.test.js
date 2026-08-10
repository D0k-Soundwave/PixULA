'use strict';
/**
 * RECOIL-parity import/export checks: .atr, .bsc (both variants), .hlr,
 * .mg2/.mg4/.mg1 (MultiArtist sub-variants), and standalone .zxp
 * (classic / extended / ULAplus palette). Layouts per RECOIL 6.4.5
 * (recoil.ci: DecodeAtr / DecodeBsc / DecodeHlr / DecodeMg / DecodeZxp).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/screen-mode-service.js');
loadModule('js/utils/map-codec.js');
loadModule('js/io/scr-format.js');
loadModule('js/io/gigascreen-format.js');
loadModule('js/io/dev-format.js');
loadModule('js/io/zxm-format.js');

ColorManager.initialize();
LayerManager.initialize();

const STD = SCREEN_MODES.STANDARD_ULA;
const lineOffset = (y) => AttributeSystem._lineOffset(y);

function reset(modeId = 'standard_ula') {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

function cell(cx, cy) {
  return LayerManager.getCurrentLayer().getCell(cx, cy);
}

// ─── .atr ────────────────────────────────────────────────────────────────────

reset();
{
  const attrs = new Uint8Array(768).fill(0x38);
  attrs[33] = 0x47; // cell (1,1): bright white ink on black paper
  const res = DevFormat.parse(attrs.buffer.slice(0));
  check('.atr imports as a standard screen', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'standard_ula');
  const c = cell(1, 1);
  check('.atr attribute lands in the cell',
    c.ink === 7 && c.paper === 0 && c.bright === true);
  check('.atr synthesizes the (x^y)&1 dither bitmap',
    c.pixels[0] === 0x55 && c.pixels[1] === 0xAA);
  check('.atr rejects other sizes',
    DevFormat.parse(new Uint8Array(767).buffer).success === false);
}

// ─── .bsc ────────────────────────────────────────────────────────────────────

reset();
{
  // 11136: standard screen + border (border dropped)
  const bsc = new Uint8Array(11136);
  bsc[lineOffset(0)] = 0x80; // pixel (0,0)
  bsc[6144 + 0] = 0x45;      // cell (0,0) attr
  const res = SCRFormat.parseBsc(bsc.buffer.slice(0));
  const c = cell(0, 0);
  check('.bsc 11136 imports the screen core', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'standard_ula'
    && c.pixels[0] === 0x80 && c.ink === 5 && c.bright === true);
}
reset();
{
  // 11904: 8×4 attribute variant — two 768-byte half blocks
  const bsc = new Uint8Array(11904);
  bsc[6144 + 0] = 0x41;        // cell row 0, UPPER half (lines 0-3)
  bsc[6144 + 768 + 0] = 0x42;  // cell row 0, LOWER half (lines 4-7)
  const res = SCRFormat.parseBsc(bsc.buffer.slice(0));
  check('.bsc 11904 imports as MULTICOLOR_8x4', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'multicolor_8x4');
  check('.bsc 8×4 halves land on consecutive attr rows',
    cell(0, 0).ink === 1 && cell(0, 1).ink === 2);
  check('.bsc rejects other sizes',
    SCRFormat.parseBsc(new Uint8Array(11137).buffer).success === false);
}

// ─── .hlr ────────────────────────────────────────────────────────────────────

reset();
{
  const hlr = new Uint8Array(1628);
  [0x76, 0xAF, 0xD3, 0xFE, 0x21, 0x00, 0x58].forEach((v, i) => { hlr[i] = v; });
  hlr.fill(0x0F, 84, 92);  // pattern rows: right half ink
  hlr[92] = 0x41;          // frame A cell (0,0)
  hlr[860] = 0x42;         // frame B cell (0,0)
  const res = GigascreenFormat.parse('hlr', hlr.buffer.slice(0));
  check('.hlr imports as a GigaScreen pair', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'gigascreen' && LayerManager.layers.length >= 2);
  const frameA = LayerManager.layers
    .map(l => l.getCell(0, 0))
    .find(c => c && c.ink === 1);
  check('.hlr pattern bitmap + frame A attrs land',
    !!frameA && frameA.pixels[0] === 0x0F);
  hlr[0] = 0;
  check('.hlr rejects a bad signature',
    GigascreenFormat.parse('hlr', hlr.buffer.slice(0)).success === false);
}

// ─── .mg sub-variants ────────────────────────────────────────────────────────

function mgHeader(height, size) {
  const mg = new Uint8Array(size);
  mg[0] = 0x4D; mg[1] = 0x47; mg[2] = 0x48; mg[3] = 1; mg[4] = height;
  return mg;
}

reset();
{
  const mg = mgHeader(2, 18688);
  mg[256 + lineOffset(0)] = 0xF0;
  mg[12544 + 0] = 0x43;  // frame A, attr row 0 (lines 0-1)
  mg[12544 + 32] = 0x44; // frame A, attr row 1 (lines 2-3)
  const res = GigascreenFormat.parse('mg2', mg.buffer.slice(0));
  check('.mg2 imports frame A as MULTICOLOR_8x2', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'multicolor_8x2');
  check('.mg2 bitmap + linear attr rows land',
    cell(0, 0).pixels[0] === 0xF0 && cell(0, 0).ink === 3 && cell(0, 1).ink === 4);
}
reset();
{
  const mg = mgHeader(4, 15616);
  mg[12544 + 0] = 0x45;
  const res = GigascreenFormat.parse('mg4', mg.buffer.slice(0));
  check('.mg4 imports frame A as MULTICOLOR_8x4', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'multicolor_8x4' && cell(0, 0).ink === 5);
}
reset();
{
  const mg = mgHeader(1, 19456);
  // Frame A: left side col 0 of cell row 0; middle col 8 of line 3; right col 24
  mg[18688 + 0] = 0x41;          // col 0, lines 0-7
  mg[12536 + 3 * 16 + 8] = 0x42; // col 8, line 3
  mg[18688 + 24 - 16] = 0x43;    // col 24, lines 0-7
  const res = GigascreenFormat.parse('mg1', mg.buffer.slice(0));
  check('.mg1 imports frame A as MULTICOLOR_8x1', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'multicolor_8x1');
  check('.mg1 side columns expand across their cell row',
    cell(0, 0).ink === 1 && cell(0, 5).ink === 1 && cell(24, 2).ink === 3);
  check('.mg1 middle columns stay per-line',
    cell(8, 3).ink === 2 && cell(8, 2).ink === 0);
}

// ─── .zxp standalone ─────────────────────────────────────────────────────────

const enc = (s) => new TextEncoder().encode(s).buffer;

reset();
{
  // Classic 16×8 picture: attr rows = ceil(h/8) = 1
  const txt = 'ZX-Paintbrush image\r\n\r\n'
    + ('1000000000000001\r\n' + '0000000000000000\r\n'.repeat(7))
    + '\r\n47 62\r\n';
  const res = ZXMFormat.parseZxp(enc(txt));
  check('.zxp classic form imports as STANDARD_ULA', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'standard_ula');
  check('.zxp picture lands top-left with its attrs',
    cell(0, 0).pixels[0] === 0x80 && cell(0, 0).ink === 7 && cell(0, 0).bright
    && cell(1, 0).ink === 2 && cell(1, 0).paper === 4);
  check('.zxp blank remainder keeps 0x38', cell(2, 0).ink === 0 && cell(2, 0).paper === 7);
}
reset();
{
  // Extended form: one attr row per pixel line
  const txt = 'ZX-Paintbrush extended image\n\n10000000\n01000000\n\n41\n42\n';
  const res = ZXMFormat.parseZxp(enc(txt));
  check('.zxp extended form imports as MULTICOLOR_8x1', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'multicolor_8x1'
    && cell(0, 0).ink === 1 && cell(0, 1).ink === 2);
}
reset();
{
  // Classic + ULAplus palette block
  const regs = Array.from({ length: 64 }, (_, i) => (i * 3) & 0xFF);
  const txt = 'ZX-Paintbrush image\n\n'
    + ('10000000\n'.repeat(8))
    + '\n07\n\n'
    + regs.map(r => r.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '\n';
  const res = ZXMFormat.parseZxp(enc(txt));
  check('.zxp with palette imports as ULA_PLUS', res.success === true
    && ACTIVE_SCREEN_MODE.id === 'ula_plus');
  check('.zxp palette landed in the registers',
    ColorManager.getUlaplusRegisters()[9] === 27);
  ColorManager.setUlaplusRegisters(null);
}

// Round-trips through our own exporter
reset();
{
  const layer = LayerManager.getCurrentLayer();
  const c = layer.getCell(3, 2);
  c.pixels[4] = 0x3C; c.ink = 6; c.paper = 1; c.bright = true; c.altered = true;
  const out = new TextDecoder().decode(ZXMFormat.exportZxp());
  check('.zxp export writes the classic identifier', out.startsWith('ZX-Paintbrush image'));
  reset();
  const res = ZXMFormat.parseZxp(new TextEncoder().encode(out).buffer);
  const back = cell(3, 2);
  check('.zxp classic round-trips through import',
    res.success === true && back.pixels[4] === 0x3C
    && back.ink === 6 && back.paper === 1 && back.bright === true);
}
reset('multicolor_8x2');
{
  const layer = LayerManager.getCurrentLayer();
  const c = layer.getCell(0, 0); // cell = 8×2
  c.pixels[0] = 0xAA; c.ink = 2; c.altered = true;
  const out = new TextDecoder().decode(ZXMFormat.exportZxp());
  check('.zxp export uses the extended form for sub-cell modes',
    out.startsWith('ZX-Paintbrush extended image'));
  reset();
  const res = ZXMFormat.parseZxp(new TextEncoder().encode(out).buffer);
  check('.zxp 8×2 exports round-trip via the extended form (as 8×1)',
    res.success === true && ACTIVE_SCREEN_MODE.id === 'multicolor_8x1'
    && cell(0, 0).pixels[0] === 0xAA && cell(0, 0).ink === 2 && cell(0, 1).ink === 2);
}
reset('layer2_256');
{
  let threw = false;
  try { ZXMFormat.exportZxp(); } catch (e) { threw = true; }
  check('.zxp export refuses in indexed modes', threw);
}

reset();
check('reset to standard_ula for following suites', ACTIVE_SCREEN_MODE.id === 'standard_ula');

summary('recoil-parity');
