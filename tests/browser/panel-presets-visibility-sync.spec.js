'use strict';
/**
 * Root cause: PanelSection._saveVisibility() snapshots the CURRENT
 * style.display of EVERY registered section (tool-preset-panel included)
 * whenever ANY panel's whole-panel visibility is toggled via the View menu.
 * ToolPresetPanel's own visibility is driven separately by the
 * showPresetsPanel preference and never calls PanelSection.setVisible(), so
 * that stale snapshot goes untouched — then PanelSection.restore() (which
 * runs AFTER ToolPresetPanel.init() in app.js) reapplies it on the next
 * boot, silently overriding whatever the preference just set. The View-menu
 * checkbox only reflects the preference, so it disagrees with the actual
 * DOM the moment restore() clobbers it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('reproduces: a stale generic panelVisibility record desyncs the presets panel from its menu checkbox',
    async ({ page }) => {
        await boot(page);

        // Turn the Presets panel ON via the real persisted preference path.
        await page.evaluate(async () => {
            const existing = (await Storage.get('preferences')) || {};
            existing.showPresetsPanel = true;
            await Storage.set('preferences', existing);
            StateManager.set('showPresetsPanel', true);
        });

        // A stale generic-visibility snapshot for tool-preset-panel, as
        // PanelSection._saveVisibility() writes incidentally the moment any
        // OTHER panel (Reference/Layers/Tool Options/Transform) is toggled
        // via the View menu while Presets happens to be in some other state.
        await page.evaluate(async () => {
            const store = Storage.STORES.WINDOW_STATE;
            const existing = (await Storage.get('panelVisibility', store)) || {};
            existing['tool-preset-panel'] = false;
            await Storage.set('panelVisibility', existing, store);
        });

        await page.reload();
        await page.waitForSelector('html[data-app-ready]');

        const state = await page.evaluate(() => ({
            showPresetsPanel: StateManager.get('showPresetsPanel'),
            display: getComputedStyle(document.getElementById('tool-preset-panel')).display,
            checked: document.querySelector('[data-id="panel-presets"]')?.classList.contains('checked')
        }));

        // The bug: checked === true but display === 'none' — the View menu
        // says Presets is active while the panel is not actually in the
        // sidebar. A fixed app must show BOTH true or BOTH false/none.
        const panelActuallyVisible = state.display !== 'none';
        expect(panelActuallyVisible).toBe(state.checked);
        // And both must actually reflect the real preference, not just
        // agree with each other by coincidence.
        expect(panelActuallyVisible).toBe(state.showPresetsPanel);
    });
