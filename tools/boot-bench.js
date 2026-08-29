'use strict';
/**
 * Cold-boot benchmark: how long index.html takes to become usable.
 *
 * Sibling of tools/perf-bench.js. Reports the median of RUNS fresh page
 * loads, each in a new context so nothing is warmed by the previous one.
 * The figure that matters is `ready` - navigationStart to the moment
 * App.init() stamps html[data-app-ready], which is when the artist can
 * actually draw.
 *
 *   node tools/boot-bench.js
 */
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const RUNS = 15;

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function main() {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });

    const ready = [], dcl = [], scriptCount = [];
    for (let i = 0; i < RUNS; i++) {
        const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
        const page = await ctx.newPage();
        await page.goto(APP_URL);
        await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
        const m = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const scripts = performance.getEntriesByType('resource')
                .filter((r) => r.name.endsWith('.js'));
            return {
                ready: performance.now(),
                domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
                scripts: scripts.length,
                // decodedBodySize is 0 on file:// in some builds; fall back to
                // counting requests only, which is still the useful signal.
                bytes: scripts.reduce((a, r) => a + (r.decodedBodySize || 0), 0)
            };
        });
        ready.push(m.ready);
        dcl.push(m.domContentLoaded);
        scriptCount.push(m.scripts);
        await ctx.close();
    }

    console.log('');
    console.log('PixULA boot benchmark');
    console.log('  method    median of ' + RUNS + ' cold loads, fresh context each');
    console.log('  date      ' + new Date().toISOString().slice(0, 10));
    console.log('');
    console.log('  app ready          ' + median(ready).toFixed(1) + ' ms' +
                '   (min ' + Math.min(...ready).toFixed(1) +
                ', max ' + Math.max(...ready).toFixed(1) + ')');
    console.log('  DOMContentLoaded   ' + median(dcl).toFixed(1) + ' ms' +
                '   (all deferred scripts parsed and run)');
    console.log('  .js requests       ' + median(scriptCount) + '   (file:// reports none)');
    console.log('');

    await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
