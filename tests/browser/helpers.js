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
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;

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

module.exports = { APP_URL, boot, reload, collectConsole, app, selectMode };
