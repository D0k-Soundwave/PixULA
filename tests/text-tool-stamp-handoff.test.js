'use strict';
/**
 * Selecting the Text tool while a NON-text stamp (a clipboard paste, or a
 * system-clipboard image paste) is already floating must start a fresh text
 * stamp, not silently keep steering the old one.
 *
 * Reported 2026-08-25: after Copy/Paste, switching to the Text tool and
 * typing left the pasted stamp active — every hover/click just relocated the
 * paste, no text stamp ever formed, until the paste's layer was deleted.
 *
 * Root cause: TextTool's own pointer handlers (onPointerDown and the
 * INPUT_POINTER_MOVE listener) gated "create a new preview stamp" on
 * `SelectionService.isFloating()` — true for ANY floating stamp, not only
 * one TextTool itself created. `floatingPaste.fontInfo` is the one field
 * only TextTool ever sets (SelectionService._createFloatingPaste defaults
 * it to null for every other caller — clipboard paste, system-clipboard
 * image paste), so it is the correct "is this floating stamp mine" check.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js'); // REAL bus — the tool's own listener must fire
loadModule('js/data/zx-rom-font.js');

global.document = {
  createElement(tag) {
    if (tag !== 'canvas') return null;
    return {
      width: 0, height: 0,
      getContext() {
        return {
          font: '', fillStyle: '#000', textBaseline: 'top',
          measureText() { return { width: 0 }; },
          fillText() {}, clearRect() {},
          getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(0, w) * Math.max(0, h) * 4) }; }
        };
      }
    };
  }
};

loadModule('js/tools/tool-base.js');
loadModule('js/tools/text-tool.js');

// ── Spy SelectionService: records which method TextTool called ────────────
let floatingPaste = null;
let calls = [];
global.SelectionService = {
  isFloating() { return floatingPaste !== null; },
  get floatingPaste() { return floatingPaste; },
  startFloatingPasteFromMask(pixels, width, height, x, y, label, fontInfo) {
    calls.push('create');
    floatingPaste = { pixels, width, height, x, y, fontInfo: fontInfo || null };
  },
  moveStampPreview(x, y) { calls.push('move'); },
  refreshTextStamp() { calls.push('refresh'); }
};

let currentToolRef = null;
global.ToolManager = { getCurrentTool: () => currentToolRef, getTool: () => null };

const textTool = new TextTool();
currentToolRef = textTool;
textTool.activate();
textTool.setText('HI');

// ── Scenario 1: a non-text stamp (a paste) is already floating ────────────
floatingPaste = { pixels: [[true]], width: 1, height: 1, x: 0, y: 0, fontInfo: null };
calls = [];

EventBus.emit(EVENTS.INPUT_POINTER_MOVE, { x: 10, y: 10 });

check(
  'hovering with Text active starts its OWN stamp instead of moving a foreign floating paste',
  calls.includes('create'),
  `calls: ${calls.join(',') || '(none)'}`
);
check(
  'the floating stamp now belongs to the text tool (fontInfo set)',
  !!(floatingPaste && floatingPaste.fontInfo)
);

// ── Scenario 2: the text tool's OWN stamp is already floating ─────────────
// A second hover must MOVE it, never silently replace it with a duplicate.
calls = [];
EventBus.emit(EVENTS.INPUT_POINTER_MOVE, { x: 20, y: 20 });
check(
  'hovering again over its own live stamp just moves it, not re-created',
  calls.join(',') === 'move',
  `calls: ${calls.join(',') || '(none)'}`
);

// ── Scenario 3: onPointerDown mirrors the same rule (click path) ──────────
floatingPaste = { pixels: [[true]], width: 1, height: 1, x: 0, y: 0, fontInfo: null };
calls = [];
textTool.onPointerDown(30, 30, {});
check(
  'clicking with Text active while a foreign stamp floats starts a new text stamp',
  calls.includes('create'),
  `calls: ${calls.join(',') || '(none)'}`
);

summary();
