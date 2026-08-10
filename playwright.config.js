'use strict';
/**
 * Browser test harness config — drives the INSTALLED Chrome (channel:
 * 'chrome', no browser download) against index.html over file://, the
 * app's native protocol. `node tests/run-all.js` stays the primary gate
 * and needs none of this; run these with `npm run test:browser`.
 *
 * NOTE: extension-driven automation of an already-open browser does not work
 * for this app — it fails on file://. Playwright launches its own Chrome
 * instance, which is why this harness works where those do not.
 */
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/browser',
    timeout: 30000,
    fullyParallel: true,
    workers: 4,
    reporter: [['list']],
    use: {
        channel: 'chrome',
        headless: true,
        viewport: { width: 1600, height: 900 }
    }
});
