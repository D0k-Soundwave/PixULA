'use strict';
/**
 * Shared helpers for the Playwright browser suite.
 *
 * boot(page) navigates to index.html over file:// and waits for the
 * app's boot beacon (html[data-app-ready], stamped at the end of
 * App.init()). It also wires console/pageerror collection so every spec
 * can assert "no unexpected console errors" — the same bar as the
 * TESTLOG boot row. The srcdoc "unique security origins" warning is the one
 * documented benign exception: Chrome logs it on reload for the canvas
 * iframe and then falls back correctly, so it is cosmetic.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;

/** First installed TTF/TTC we can find, whatever platform this runs on. */
const FONT_CANDIDATES = [
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
    'C:/Windows/Fonts/verdana.ttf',
    'C:/Windows/Fonts/tahoma.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
];

/**
 * Locate a real installed font file for specs that need to rasterize one -
 * one list, shared, so font-rasterizer.spec.js and system-font-import.spec.js
 * can't drift onto two different candidate sets.
 * @returns {string|null}
 */
function findInstalledFont() {
    for (const p of FONT_CANDIDATES) {
        try {
            if (fs.statSync(p).isFile()) return p;
        } catch (e) { /* next candidate */ }
    }
    return null;
}

const BENIGN_CONSOLE = [
    /unique security origins/i,   // srcdoc iframe on file:// (documented)
    /\[Logger\]/                  // the Logger-loaded info line
];

function isBenign(text) {
    return BENIGN_CONSOLE.some((re) => re.test(text));
}

/**
 * Attach console/pageerror collectors. Call BEFORE page.goto so boot-time
 * messages are captured.
 * @returns {{errors: string[], all: string[]}} live arrays
 */
function collectConsole(page) {
    const errors = [];
    const all = [];
    page.on('console', (msg) => {
        all.push(`${msg.type()}: ${msg.text()}`);
        if (msg.type() === 'error' && !isBenign(msg.text())) {
            errors.push(msg.text());
        }
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    return { errors, all };
}

/**
 * Navigate to the app and wait for full boot.
 * @returns {{errors: string[], all: string[]}} console collectors
 */
async function boot(page) {
    const consoleLog = collectConsole(page);
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]', { timeout: 15000 });
    return consoleLog;
}

/** Reload the current page (F5) and wait for the boot beacon again. */
async function reload(page) {
    await page.reload();
    await page.waitForSelector('html[data-app-ready]', { timeout: 15000 });
}

/** Evaluate inside the app's main world with the singletons in scope. */
function app(page, fn, arg) {
    return page.evaluate(fn, arg);
}

/**
 * Switch screen mode via the Image menu radios — the only entry point since
 * the status-bar `#screen-mode-select` dropdown was removed in favour of it.
 * Both funnelled through the same MenuSystem.requestScreenMode confirm path,
 * so a lossy-conversion dialog behaves identically to the old selector.
 */
async function selectMode(page, modeId) {
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action--parent[data-id="screen-mode"]');
    await page.click(`.menu-action[data-id="mode-${modeId}"]`);
}

/**
 * The font families fontconfig reports as installed, or null where there is
 * no fontconfig (Windows, macOS). Lets font specs judge detection against
 * what THIS machine actually has instead of a count measured on another.
 * @returns {?Set<string>}
 */
function installedFontFamilies() {
    try {
        const out = execFileSync('fc-list', [':', 'family'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return new Set(out.split('\n').flatMap((l) => l.split(',')).map((f) => f.trim()).filter(Boolean));
    } catch (e) {
        return null;
    }
}

/**
 * The fewest fonts detection must find here. The old hardcoded list was 16
 * names, so a normal desktop must yield more than 20. On a machine whose own
 * font list is known and sparse (a CI or cloud container), that bar is
 * unreachable, so it becomes nine in ten of the installed candidates - still
 * proof that detection works, never stricter than the desktop bar.
 * @param {string[]} candidates - FontProbe.CANDIDATES
 * @returns {number}
 */
function minDetectedFonts(candidates) {
    const families = installedFontFamilies();
    if (!families) return 21;
    const installed = candidates.filter((c) => families.has(c)).length;
    return Math.min(21, Math.floor(installed * 0.9));
}

/**
 * The family fontconfig actually uses for `family`, when that is a different
 * font (Linux substitutes Liberation Sans for Arial); null when the real font
 * is installed or there is no fontconfig to ask.
 * @param {string} family
 * @returns {?string}
 */
function fontSubstitute(family) {
    try {
        const got = execFileSync('fc-match', ['-f', '%{family[0]}', family],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        return got && got.toLowerCase() !== family.toLowerCase() ? got : null;
    } catch (e) {
        return null;
    }
}

module.exports = { APP_URL, boot, reload, collectConsole, app, selectMode, findInstalledFont, FONT_CANDIDATES,
    installedFontFamilies, minDetectedFonts, fontSubstitute };
