'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
let failures = 0;

function installStubs(overrides = {}) {
  global.window = global;
  // Geometry, palette, events, coords and helpers come from the REAL modules —
  // the single sources of truth the app itself uses (docs/REFACTOR_PLAN.md §2) —
  // so tests can never drift from the shipped constants.
  loadModule('js/core/constants.js');
  loadModule('js/utils/helpers.js');
  global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
  global.EventBus = { emit() {}, on() {} };
  global.FormatRegistry = {
    registerImport() {}, registerExport() {}, download() {},
    getExtension(f) { const p = String(f).split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; }
  };

  // FontFace and document.fonts stub for FontRasterizer contract test (Task 14)
  global.FontFace = class FontFace {
    constructor(name, source) {
      this.family = name;
      this.source = source;
    }
    async load() {
      return this;
    }
  };

  global.document = global.document || {
    documentElement: {
      style: {
        setProperty() {},
        removeProperty() {}
      }
    }
  };
  global.document.fonts = {
    _fonts: new Set(),
    add(face) { this._fonts.add(face); },
    delete(face) { this._fonts.delete(face); },
    has(face) { return this._fonts.has(face); }
  };

  // Canvas 2D stub for FontRasterizer — fillText/getImageData/clearRect are no-ops
  // returning all-zero-alpha ImageData, which is enough for the contract test
  // (glyph count, byte shape, width masking). Real pixel-accurate rendering is
  // exercised only in the Playwright spec (Task 15).
  // _testThrowOnGetImageDataCall allows tests to simulate errors mid-rasterization.
  let _testThrowOnGetImageDataCall = 0;
  if (!global.document.createElement) {
    global.document.createElement = function(tag) {
      if (tag === 'canvas') {
        return {
          getContext(type) {
            if (type === '2d') {
              return {
                textBaseline: 'top',
                font: '',
                fillStyle: '#000',
                clearRect() {},
                fillText() {},
                getImageData(x, y, w, h) {
                  _testThrowOnGetImageDataCall--;
                  if (_testThrowOnGetImageDataCall === 0) {
                    throw new Error('test: simulated canvas error');
                  }
                  const imageData = {
                    data: new Uint8ClampedArray(w * h * 4),
                    width: w,
                    height: h
                  };
                  return imageData;
                }
              };
            }
            return null;
          }
        };
      }
      return null;
    };
  }
  global._testCanvasThrowAfter = function(callCount) {
    _testThrowOnGetImageDataCall = callCount;
  };

  Object.assign(global, overrides);
}

function loadModule(repoRelPath) {
  const src = fs.readFileSync(path.join(REPO_ROOT, repoRelPath), 'utf8');
  // Indirect eval so the module's IIFE runs in global scope like a <script> tag
  (0, eval)(src);
}

function check(label, cond, detail) {
  if (cond) { console.log(`  ok: ${label}`); }
  else { failures++; console.log(`FAIL: ${label}${detail ? ' — ' + detail : ''}`); }
}

function summary() {
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures ? 1 : 0);
}

module.exports = { installStubs, loadModule, check, summary, REPO_ROOT };
