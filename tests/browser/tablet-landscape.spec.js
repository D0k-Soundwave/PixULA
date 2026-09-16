'use strict';
/**
 * Tablets: the ONE layout, held sideways, scaled to fit (2026-09-15).
 *
 * PixULA keeps its desktop layout on a tablet - tool rail | canvas | panels -
 * and makes it fit by shrinking the interface (UiFit, applied by AppSettings)
 * rather than rearranging it. It is landscape-only on finger-driven devices:
 * held upright, #rotate-notice covers the app. What this pins:
 *
 * - no panel is lost at <=1024px (two dead breakpoints once hid all of them
 *   in a drawer nothing could open - a 1024x768 iPad had no Tool Options);
 * - every tool fits the rail without scrolling, at a touchable size;
 * - the picture fits its frame, and re-fits when the device is turned;
 * - a zoom the artist chose survives a resize;
 * - a desktop - even a small or upright one - is never blocked or shrunk.
 *
 * Viewports are emulated (isMobile + hasTouch make Chrome report
 * hover: none / pointer: coarse); real iPad and Android rows live in
 * tests/TESTLOG.md.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Everything the assertions need, measured in one pass. */
async function layout(page) {
    return page.evaluate(() => {
        const byId = (id) => document.getElementById(id);
        const inViewport = (el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.left >= -1 && b.top >= -1 &&
                b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        };
        const rail = byId('toolbar');
        const railBox = rail.getBoundingClientRect();
        const buttons = [...rail.querySelectorAll('.tool-btn')];
        const clipped = buttons.filter((b) => {
            const r = b.getBoundingClientRect();
            return r.top < railBox.top - 1 || r.bottom > railBox.bottom + 1;
        }).length;
        const smallest = Math.min(...buttons.map((b) => {
            const r = b.getBoundingClientRect();
            return Math.min(r.width, r.height);
        }));
        const frame = byId('canvas-frame');
        const scale = CanvasSystem.getScale();
        const barRows = new Set([...document.querySelectorAll('#color-bar button, #color-bar select')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => Math.round(el.getBoundingClientRect().top / 10))).size;
        const notice = byId('rotate-notice');
        const noticeBox = notice.getBoundingClientRect();
        return {
            uiScale: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')),
            panelsOnScreen: inViewport(byId('panels')),
            panelsWidth: byId('panels').getBoundingClientRect().width,
            toolCount: buttons.length,
            toolsClipped: clipped,
            smallestTool: smallest,
            zoom: CanvasSystem.zoom,
            fitZoom: CanvasSystem.fitZoom(),
            followFit: CanvasSystem._followFit,
            pictureFits: Math.round(ZX_SPECTRUM.WIDTH * scale) <= frame.clientWidth &&
                Math.round(ZX_SPECTRUM.HEIGHT * scale) <= frame.clientHeight,
            barRows,
            noticeShown: getComputedStyle(notice).display !== 'none',
            noticeCovers: noticeBox.width >= innerWidth - 1 && noticeBox.height >= innerHeight - 1
        };
    });
}

/** Wait until the interface scale and the canvas fit have both settled. */
async function settle(page) {
    await page.waitForTimeout(400);
}

for (const [width, height] of [[1024, 768], [1180, 820], [1280, 800]]) {
    test.describe(`landscape tablet ${width}x${height}`, () => {
        test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

        test('the whole layout is on screen, touchable, and the picture fits', async ({ page }) => {
            const { errors } = await boot(page);
            await settle(page);
            const l = await layout(page);

            expect(l.noticeShown).toBe(false);
            expect(l.panelsOnScreen).toBe(true);
            expect(l.panelsWidth).toBeGreaterThan(0);
            expect(l.toolCount).toBeGreaterThan(0);
            expect(l.toolsClipped).toBe(0);
            // The WCAG 2.1 SC 2.5.5 target size UiFit's floor protects.
            expect(l.smallestTool).toBeGreaterThanOrEqual(44);
            expect(l.uiScale).toBeGreaterThanOrEqual(0.815);
            expect(l.uiScale).toBeLessThanOrEqual(1);
            expect(l.pictureFits).toBe(true);
            expect(l.zoom).toBe(l.fitZoom);
            expect(l.barRows).toBe(1);
            expect(errors).toEqual([]);
        });
    });
}

test.describe('upright tablet', () => {
    test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

    test('is covered by the rotate notice', async ({ page }) => {
        await boot(page);
        const l = await layout(page);
        expect(l.noticeShown).toBe(true);
        expect(l.noticeCovers).toBe(true);
        await expect(page.locator('#rotate-notice')).toContainText('Turn your device sideways');
    });

    test('turning it sideways clears the notice and re-fits the picture', async ({ page }) => {
        await boot(page);
        await settle(page);
        const upright = await layout(page);
        expect(upright.followFit).toBe(true);

        await page.setViewportSize({ width: 1024, height: 768 });
        await settle(page);
        const sideways = await layout(page);

        expect(sideways.noticeShown).toBe(false);
        expect(sideways.toolsClipped).toBe(0);
        expect(sideways.pictureFits).toBe(true);
        // The frame grew from 1x room to 2x room; a view still following fit
        // must have moved with it rather than keeping the upright zoom.
        expect(sideways.zoom).toBe(sideways.fitZoom);
        expect(sideways.zoom).toBeGreaterThan(upright.zoom);
    });
});

test.describe('a zoom the artist chose', () => {
    test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });

    test('survives a resize instead of being re-fitted', async ({ page }) => {
        await boot(page);
        await settle(page);
        await page.evaluate(() => CanvasSystem.setZoom(400));
        await page.setViewportSize({ width: 1280, height: 800 });
        await settle(page);
        const l = await layout(page);
        expect(l.followFit).toBe(false);
        expect(l.zoom).toBe(400);
    });

    test('Fit re-arms following, so the next resize re-fits', async ({ page }) => {
        await boot(page);
        await settle(page);
        await page.evaluate(() => CanvasSystem.setZoom(400));
        await page.evaluate(() => CanvasControls.applyFit());
        await page.setViewportSize({ width: 1280, height: 800 });
        await settle(page);
        const l = await layout(page);
        expect(l.followFit).toBe(true);
        expect(l.zoom).toBe(l.fitZoom);
    });
});

test.describe('desktop', () => {
    test.use({ viewport: { width: 800, height: 1000 } });

    test('an upright window with a mouse is never blocked or shrunk', async ({ page }) => {
        await boot(page);
        await settle(page);
        const l = await layout(page);
        expect(l.noticeShown).toBe(false);
        expect(l.panelsOnScreen).toBe(true);
        expect(l.uiScale).toBe(1);
    });
});

test.describe('desktop at tablet width', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test('keeps every panel and the Interface Size the artist chose', async ({ page }) => {
        await boot(page);
        await settle(page);
        const l = await layout(page);
        expect(l.panelsOnScreen).toBe(true);
        expect(l.uiScale).toBe(1);
    });
});
