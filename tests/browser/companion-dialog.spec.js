'use strict';
/**
 * CompanionDialog (Settings > Companion...) — connection status flows
 * through not-running -> running-unpaired -> paired, driven by
 * CompanionBridgeService.checkStatus()/pair(). Nothing listens on
 * 127.0.0.1:51973 in CI, so the first state is real; the later two are
 * simulated by stubbing window.fetch, same as the design spec's own
 * failure-behaviour table expects the app to cope with.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openMenu(page, id) {
    await page.click(`.menu-item[data-menu="${id}"] .menu-label`);
    await page.waitForSelector(`.menu-item[data-menu="${id}"] .menu-action`, { state: 'visible' });
}

test('Companion dialog shows not-running, then running-unpaired, then paired', async ({ page }) => {
    await boot(page);

    // Companion unreachable (default - nothing is listening on 51973 in CI).
    await openMenu(page, 'settings');
    await page.click('.menu-action[data-action="settings:companion"]');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/not running/i);

    // Simulate "running, unpaired" by stubbing fetch before checkStatus runs again.
    await page.evaluate(() => {
        window.fetch = async (url) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: false }) };
            throw new Error('unexpected fetch: ' + url);
        };
    });
    await page.click('.companion-dialog-refresh');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/not connected/i);

    // Simulate a completed pairing.
    await page.evaluate(() => {
        window.fetch = async (url, opts) => {
            if (url.endsWith('/status')) return { ok: true, json: async () => ({ version: '0.1.0', paired: true }) };
            if (url.endsWith('/pair') && opts && opts.method === 'POST') return { ok: true, text: async () => 'b'.repeat(64) };
            throw new Error('unexpected fetch: ' + url);
        };
    });
    await page.click('.companion-dialog-connect');
    await expect(page.locator('.companion-dialog-status')).toHaveText(/connected/i);
});
