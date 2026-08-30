'use strict';
/**
 * The user manual, which lives inside the app (js/data/manual-content.js,
 * shown by ManualDialog) rather than as a page beside it.
 *
 * The manual is generated FROM the running app by tools/build-manual.js, which
 * is what stops it inventing things. This suite covers the other direction:
 * that the committed manual still covers the app as it stands. Add a tool, a
 * screen mode or a file format and forget to rebuild, and these fail by name
 * rather than the manual quietly going out of date.
 *
 * Everything here goes through Help > Manual, so it tests what a reader
 * actually gets - the content, the dialog, the styling and the contents links -
 * instead of a file on disk that may or may not be what the app shows.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Open Help > Manual as a user would, and wait for it to render. */
async function openManual(page) {
    await page.click('.menu-item[data-menu="help"] .menu-label');
    await page.click('.menu-action[data-action="help:manual"]');
    await page.waitForSelector('.manual-dialog .manual .mn-chapter', { timeout: 15000 });
}

/** Ids present inside the manual, for a set of prefixed ids. */
const idsPresent = (page, prefix, ids) => page.evaluate(([p, list]) => {
    const root = document.querySelector('.manual');
    return list.filter((id) => !root.querySelector('[id="mn-' + p + id + '"]'));
}, [prefix, ids]);

test('Help > Manual opens the manual inside the app', async ({ page, context }) => {
    await boot(page);
    const before = context.pages().length;
    await openManual(page);

    await expect(page.locator('.manual-dialog')).toBeVisible();
    await expect(page.locator('.manual h2').first()).toBeVisible();
    // Contained means contained: no new tab, no navigation away from the app.
    expect(context.pages().length, 'the manual opened a tab').toBe(before);
    expect(page.url()).toContain('index.html');
});

test('the manual is not loaded until it is asked for', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => window.MANUAL_CONTENT !== undefined),
        'half a megabyte of manual was loaded at boot').toBe(false);

    await openManual(page);
    expect(await page.evaluate(() => window.MANUAL_CONTENT !== undefined)).toBe(true);
});

test('every tool in the rail has an entry in the manual', async ({ page }) => {
    await boot(page);
    const tools = await page.evaluate(() =>
        TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.id)));
    await openManual(page);

    expect(await idsPresent(page, 'tool-', tools),
        'tools the manual does not document - rebuild with `node tools/build-manual.js`')
        .toEqual([]);
    expect(tools.length).toBeGreaterThan(10);
});

test('every screen mode has an entry in the manual', async ({ page }) => {
    await boot(page);
    const modes = await page.evaluate(() =>
        Object.keys(SCREEN_MODES).map((k) => SCREEN_MODES[k].id));
    await openManual(page);

    expect(await idsPresent(page, 'mode-', modes),
        'screen modes the manual does not document').toEqual([]);
    expect(modes.length).toBeGreaterThan(5);
});

test('every menu has a section in the manual', async ({ page }) => {
    await boot(page);
    const menus = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.menu-item[data-menu]'))
            .map((m) => m.getAttribute('data-menu')));
    await openManual(page);

    expect(await idsPresent(page, 'menu-', menus),
        'menus the manual does not document').toEqual([]);
});

test('every registered file format is listed in the manual', async ({ page }) => {
    await boot(page);
    const all = await page.evaluate(() => Array.from(new Set([
        ...FormatRegistry.importFormats.keys(),
        ...FormatRegistry.exportFormats.keys()
    ])));
    await openManual(page);

    const missing = await page.evaluate((exts) => {
        const listed = new Set(Array.from(document.querySelectorAll('.manual code'))
            .map((c) => c.textContent.trim().replace(/^\./, '')));
        return exts.filter((e) => !listed.has(e));
    }, all);

    expect(missing, 'file formats the manual does not list').toEqual([]);
    expect(all.length).toBeGreaterThan(20);
});

test('every picture is embedded and decodes', async ({ page }) => {
    await boot(page);
    await openManual(page);

    const result = await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('.manual img'));
        await Promise.all(images.map((img) => {
            img.loading = 'eager';
            if (img.complete) return null;
            return new Promise((done) => {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            });
        }));
        return {
            total: images.length,
            // Every picture must travel inside the file. A src pointing at a
            // folder is exactly the thing this design removed.
            external: images.filter((i) => !(i.getAttribute('src') || '').startsWith('data:'))
                .map((i) => i.getAttribute('src')),
            broken: images.filter((i) => i.naturalWidth === 0)
                .map((i) => (i.getAttribute('alt') || '(no alt)'))
        };
    });

    expect(result.total, 'a manual with no pictures in it').toBeGreaterThan(0);
    expect(result.external, 'pictures loaded from outside the file').toEqual([]);
    expect(result.broken, 'pictures that did not decode').toEqual([]);
});

test('the contents links reach their headings without leaving the app', async ({ page }) => {
    await boot(page);
    await openManual(page);

    const links = await page.evaluate(() => {
        const root = document.querySelector('.manual');
        const hrefs = Array.from(root.querySelectorAll('.mn-toc a'))
            .map((a) => a.getAttribute('href'))
            .filter((href) => href && href.startsWith('#'));
        return {
            total: hrefs.length,
            dead: hrefs.filter((href) =>
                !root.querySelector('[id="' + CSS.escape(href.slice(1)) + '"]'))
        };
    });
    // Count first: a selector that matches nothing makes the dead-link check
    // below pass without testing anything, which is how it got past once.
    expect(links.total, 'no contents links found - has the markup changed?')
        .toBeGreaterThan(10);
    expect(links.dead, 'contents entries pointing at nothing').toEqual([]);

    // Clicking one must scroll, not navigate - an unhandled #anchor on a
    // file:// page reloads the whole app and loses the artwork.
    const url = page.url();
    await page.locator('.manual .mn-toc a').nth(3).click();
    expect(page.url(), 'a contents link navigated the app').toBe(url);
    await expect(page.locator('.manual-dialog')).toBeVisible();
});

test('the manual styles nothing outside itself', async ({ page }) => {
    await boot(page);
    // Sample something the manual's own CSS would hit if a selector escaped:
    // the app has plenty of tables and h3s of its own.
    const before = await page.evaluate(() => {
        const el = document.querySelector('#panels h3, #panels .panel-title, #panels');
        return el ? getComputedStyle(el).fontSize + '|' + getComputedStyle(el).color : null;
    });
    await openManual(page);
    await page.keyboard.press('Escape');

    const after = await page.evaluate(() => {
        const el = document.querySelector('#panels h3, #panels .panel-title, #panels');
        return el ? getComputedStyle(el).fontSize + '|' + getComputedStyle(el).color : null;
    });
    expect(after, 'the manual restyled the app around it').toBe(before);
});

test('the manual follows the app theme', async ({ page }) => {
    await boot(page);
    await openManual(page);

    const dark = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.manual')).color);
    await page.keyboard.press('Escape');

    await page.evaluate(() => ThemeManager.setTheme('light'));
    await openManual(page);
    const light = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.manual')).color);

    expect(light, 'the manual kept its own colours across a theme change')
        .not.toBe(dark);
});

test('the manual names the version of the app that produced it', async ({ page }) => {
    await boot(page);
    const version = await page.evaluate(() => APP_VERSION);
    await openManual(page);
    await expect(page.locator('.manual .mn-toc__version')).toContainText(version);
});

test('the manual shares no class or id with the app around it', async ({ page }) => {
    await boot(page);

    // What the app itself uses, before the manual is anywhere near the page.
    const appNames = await page.evaluate(() => {
        const classes = new Set();
        const ids = new Set();
        for (const el of document.querySelectorAll('*')) {
            for (const c of el.classList) classes.add(c);
            if (el.id) ids.add(el.id);
        }
        return { classes: [...classes], ids: [...ids] };
    });

    await openManual(page);

    const clashes = await page.evaluate((app) => {
        const root = document.querySelector('.manual');
        const appClasses = new Set(app.classes);
        const appIds = new Set(app.ids);
        const out = [];
        for (const el of root.querySelectorAll('*')) {
            for (const c of el.classList) {
                if (appClasses.has(c)) out.push('class ' + c);
            }
            if (el.id && appIds.has(el.id)) out.push('id ' + el.id);
        }
        return [...new Set(out)];
    }, appNames);

    // `.tool-group` and `id="menu-file"` were both real collisions before the
    // mn- prefix: the app's grid layout for its tool rail stretched every
    // heading in the manual, and the manual's File menu section was a second
    // element carrying the id of the app's own File dropdown.
    expect(clashes, 'the manual reuses names the app owns').toEqual([]);
});
