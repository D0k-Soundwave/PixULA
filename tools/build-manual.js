'use strict';
/**
 * build-manual.js - generate the PixULA user manual from a running copy of
 * the app.
 *
 *   node tools/build-manual.js            build js/data/manual-content.js and
 *                                         js/data/manual/manual-<code>.js
 *   node tools/build-manual.js --check    build to memory and diff; non-zero
 *                                         exit if the committed manual is
 *                                         stale (what CI would run)
 *
 * The manual speaks every language the app does. English prose lives in
 * manual/content/*.md and each translation in manual/content/<code>/ under the
 * same file names; the generated tables are read from the app running in that
 * language, and the generator's own words are `manual.*` keys in js/i18n/.
 * A translation missing a chapter, or placing different tables or pictures
 * from the English, fails the build. The screenshots are taken once, in
 * English, and shared: they live in the English file, and each translation
 * file carries only its text.
 *
 * The manual is GENERATED because a hand-written one would be wrong within a
 * week and nothing would fail when it was. Every fact it states about a tool,
 * an option, a menu, a screen mode or a file format is read out of the running
 * app by tools/manual-extract.js, so the manual cannot claim an option the app
 * does not have.
 *
 * The prose - the half a registry cannot know - lives in manual/content/*.md.
 * Those files ARE the manual's outline: they are rendered in filename order,
 * and a line containing only a token such as `{{tools}}` is replaced by the
 * generated block of that name. So a human decides what the manual says and
 * where each generated table sits inside it, and the generator decides only
 * what those tables contain.
 *
 * The output is a JS data file INSIDE the app rather than a page beside it,
 * under js/data/ with the pattern bitmaps and the ROM font. `js/` is the app:
 * without it there is nothing to run, so a manual carried in `js/` cannot go
 * missing while the app still works. Screenshots are embedded as data URIs for
 * the same reason - no folder of images to lose, no relative path to get wrong.
 * Nothing loads it at boot; js/ui/components/manual-dialog.js injects the
 * script the first time somebody opens Help > Manual.
 *
 * Output is deterministic: no timestamps, no run counters, nothing that
 * changes when the app has not. Running it twice produces no diff, which is
 * what makes --check meaningful.
 *
 * Playwright is already this repo's one sanctioned dev-dependency (the browser
 * test harness), and it drives the installed Chrome rather than downloading
 * one. The app itself stays zero-dependency and build-free; this is an
 * artefact built beside it, exactly like PixULA_Distilled/.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const { extractManualData } = require('./manual-extract.js');
const { renderMarkdown, escapeHTML } = require('./manual-markdown.js');
const { renderSections } = require('./manual-sections.js');

const ROOT = path.resolve(__dirname, '..');
const APP = pathToFileURL(path.join(ROOT, 'index.html')).href;
const CONTENT_DIR = path.join(ROOT, 'manual', 'content');
const IMG_DIR = path.join(ROOT, 'manual', 'img');
const OUT_FILE = path.join(ROOT, 'js', 'data', 'manual-content.js');
/** One file per translation, loaded only when the manual opens in it. */
const LOCALE_DIR = path.join(ROOT, 'js', 'data', 'manual');
const I18N_DIR = path.join(ROOT, 'js', 'i18n');
const localeFile = (code) => path.join(LOCALE_DIR, 'manual-' + code + '.js');
const CSS_FILE = path.join(__dirname, 'manual-style.css');

/** Viewport the app is booted at. Wide enough that no panel is collapsed. */
const VIEWPORT = { width: 1600, height: 900 };

/**
 * Boot the app and hand the page to `fn`.
 *
 * Same boot gate as the browser suite: `html[data-app-ready]`, stamped at the
 * end of App.init(). A page error here is fatal rather than warned about - a
 * manual generated from a half-booted app would be quietly incomplete, which
 * is the one failure mode this whole approach exists to prevent.
 * @param {(page: Object) => Promise<*>} fn
 * @returns {Promise<*>} whatever `fn` returns
 */
async function withApp(fn) {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({ viewport: VIEWPORT });
        const page = await context.newPage();
        const failures = [];
        page.on('pageerror', (e) => failures.push('pageerror: ' + e.message));
        await page.goto(APP);
        await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });
        if (failures.length) {
            throw new Error('the app failed to boot cleanly:\n  ' + failures.join('\n  '));
        }
        return await fn(page);
    } finally {
        await browser.close();
    }
}

/**
 * Take every screenshot in tools/manual-shots.js.
 *
 * A missing crop target is FATAL rather than skipped: a shot that quietly
 * fails to happen leaves a broken image in a manual nobody re-checks.
 * @param {Object} page
 * @returns {Promise<Array<{id: string, bytes: number}>>}
 */
async function captureShots(page) {
    const { SHOTS } = require('./manual-shots.js');
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const taken = [];
    for (const shot of SHOTS) {
        if (shot.reach) await shot.reach(page);
        const file = path.join(IMG_DIR, shot.id + '.png');
        if (shot.crop) {
            const target = page.locator(shot.crop).first();
            if (await target.count() === 0) {
                throw new Error('shot "' + shot.id + '" wants ' + shot.crop +
                    ', which is not in the page');
            }
            await target.screenshot({ path: file });
        } else {
            await page.screenshot({ path: file });
        }
        if (shot.after) await shot.after(page);
        taken.push({ id: shot.id, bytes: fs.statSync(file).size });
    }
    return taken;
}

/**
 * The prose files, in filename order.
 *
 * A leading number orders them and is stripped from the id, so
 * `20-attribute-clash.md` becomes the `attribute-clash` anchor. English is
 * manual/content/ itself; a translation is the folder named for its code.
 * @param {string} [code='en']
 * @returns {Array<{id: string, file: string, source: string}>}
 */
function readContent(code = 'en') {
    const dir = code === 'en' ? CONTENT_DIR : path.join(CONTENT_DIR, code);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => ({
            id: f.replace(/^\d+[-_]?/, '').replace(/\.md$/, ''),
            file: f,
            source: fs.readFileSync(path.join(dir, f), 'utf8')
        }));
}

/**
 * A language's strings, read the way the app reads them, as a `t(key,
 * params)` for the generated blocks. A key the language lacks is an error
 * rather than a quiet fall back to English: tests/i18n-parity.test.js already
 * insists every language has every key, so a miss here is a typo.
 * @param {string} code
 * @returns {(key: string, params?: Object) => string}
 */
function stringsFor(code) {
    const win = {};
    new Function('window', fs.readFileSync(path.join(I18N_DIR, code + '.js'), 'utf8'))(win);
    const table = win['i18n_' + code];
    if (!table) throw new Error('js/i18n/' + code + '.js did not set window.i18n_' + code);
    return (key, params = {}) => {
        if (!(key in table)) throw new Error('no ' + code + ' string for "' + key + '"');
        return String(table[key]).replace(/\{(\w+)\}/g, (m, name) =>
            (params[name] !== undefined ? String(params[name]) : m));
    };
}

/**
 * What a translation must agree with the English about: which tables it
 * places and which pictures it shows, chapter by chapter. Words are the
 * translator's; the structure is not, or a table silently goes missing from
 * one language's manual.
 * @param {string} source
 * @returns {string}
 */
function skeleton(source) {
    const tokens = source.match(/^\s*\{\{[a-z0-9-]+\}\}\s*$/gm) || [];
    const images = source.match(/\]\(img\/[^)]+\)/g) || [];
    return tokens.map((x) => x.trim()).concat(images).join(' ');
}

/**
 * Collect the headings a rendered chapter contains, for the sidebar.
 * Reads the emitted HTML rather than the markdown, so headings the GENERATED
 * blocks add (one per tool, say) appear in the nav alongside hand-written ones.
 * @param {string} html
 * @returns {Array<{level: number, id: string, text: string}>}
 */
function collectHeadings(html) {
    const out = [];
    const re = /<h([23]) id="([^"]+)">(.*?)<\/h[23]>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        out.push({
            level: Number(m[1]),
            id: m[2],
            text: m[3].replace(/<[^>]+>/g, '').trim()
        });
    }
    return out;
}

/** Prefix on every class and id the manual emits. @see namespaceHTML */
const NS = 'mn-';

/**
 * Prefix every class and id in the manual's markup.
 *
 * The manual is rendered INSIDE the app's document, and the app forbids shadow
 * DOM, so its markup shares one namespace with the app's own. Two collisions
 * found the hard way before this existed: `.tool-group` is a class the tool
 * rail already owns, and the app's `display: grid` for it stretched every
 * heading in the manual to the height of its whole section; and the manual's
 * `id="menu-file"` was a second element with the id the app's own File menu
 * dropdown already had.
 *
 * Applied to the finished markup rather than at each emit site, so a section
 * added later cannot forget it. Two things are deliberately left alone:
 * `<use href="#icon-brush">` points at the APP's sprite and must keep the
 * app's id, and `src="data:..."` is not a reference to anything.
 *
 * @param {string} html
 * @returns {string}
 */
function namespaceHTML(html) {
    return html
        .replace(/\sclass="([^"]+)"/g, (whole, names) =>
            ' class="' + names.trim().split(/\s+/).map((n) => NS + n).join(' ') + '"')
        .replace(/\sid="([^"]+)"/g, (whole, id) => ' id="' + NS + id + '"')
        // Anchors only - a <use href> is a reference into the app's sprite.
        .replace(/<a href="#([^"]+)"/g, (whole, id) => '<a href="#' + NS + id + '"');
}

/**
 * Every screenshot, as a data URI keyed by filename.
 *
 * The manual lives inside the app, so its pictures have to as well. Embedding
 * them costs about a third again in base64, and buys the one thing this is
 * for: there is no folder of images to go missing, and no relative path that
 * can be wrong depending on where the app was opened from.
 * @returns {Object<string,string>}
 */
function readImages() {
    if (!fs.existsSync(IMG_DIR)) return {};
    const out = {};
    for (const file of fs.readdirSync(IMG_DIR).sort()) {
        if (!file.endsWith('.png')) continue;
        out[file] = 'data:image/png;base64,' +
            fs.readFileSync(path.join(IMG_DIR, file)).toString('base64');
    }
    return out;
}

/**
 * Check every `img/NAME` reference has a picture behind it.
 *
 * The pictures are no longer spliced into the markup here: they are stored
 * ONCE, in the English file, and ManualDialog puts them in place when it
 * renders whichever language is open. Thirteen copies of the screenshots
 * would be thirteen times the download for the same fourteen pictures.
 * @param {string} html
 * @param {Object<string,string>} images
 * @returns {string} the html, unchanged
 */
function inlineImages(html, images) {
    const re = /src="img\/([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (!images[m[1]]) {
            throw new Error('the prose references img/' + m[1] +
                ', which was not captured - run without --no-shots, or add it ' +
                'to tools/manual-shots.js');
        }
    }
    return html;
}

/** The stylesheet, after proving every rule is scoped under `.manual`. */
function readStyle() {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    // Every rule must be scoped, or the manual restyles the app around it -
    // the app forbids shadow DOM, so this check is the only thing between a
    // bare `table {}` and the Map Editor. Checked here rather than trusted.
    // A SELECTOR is a line that opens a block. Declarations (`color: x;`) and
    // at-rules (`@media ... {`) are not selectors and must not be checked, or
    // every property inside a media query reads as an unscoped rule.
    const unscoped = css.split('\n')
        .map((l) => l.trim())
        .filter((l) => l.endsWith('{') && !l.startsWith('@') && !l.startsWith('/*'))
        .filter((l) => !/(^|[\s,>+~])\.manual\b/.test(l));
    if (unscoped.length) {
        throw new Error('unscoped selectors in tools/manual-style.css - every rule ' +
            'must start under `.manual` or it will restyle the app:\n  ' +
            unscoped.join('\n  '));
    }
    return css;
}

/**
 * One language's manual as namespaced markup: contents, chapters, colophon.
 * @param {Object} data - from the extractor, run in that language
 * @param {Array} chapters - [{id, html, headings}]
 * @param {(key: string, params?: Object) => string} t - that language's strings
 * @returns {string}
 */
function renderBody(data, chapters, t) {
    const version = data.generatedFrom.version;
    const title = data.generatedFrom.title || 'PixULA';

    const nav = chapters.map((ch) => {
        const top = ch.headings.find((h) => h.level === 2);
        if (!top) return '';
        const subs = ch.headings.filter((h) => h.level === 3);
        return '<li><a href="#' + top.id + '">' + escapeHTML(top.text) + '</a>' +
            (subs.length
                ? '<ul>' + subs.map((s) =>
                    '<li><a href="#' + s.id + '">' + escapeHTML(s.text) + '</a></li>').join('') + '</ul>'
                : '') +
            '</li>';
    }).join('');

    const body = [
        '<nav class="toc" aria-label="' + escapeHTML(t('manual.contents')) + '">',
        '<div class="toc__head"><strong>' + escapeHTML(title) + '</strong>',
        '<span class="toc__version">' + escapeHTML(t('manual.forVersion', { version })) +
        '</span></div>',
        '<ul>' + nav + '</ul>',
        '</nav>',
        '<div class="body">',
        chapters.map((ch) => '<section class="chapter" id="chapter-' + ch.id + '">' +
            ch.html + '</section>').join('\n'),
        '<footer class="colophon"><p>' + escapeHTML(t('manual.colophon', { version })) +
        '</p></footer>',
        '</div>'
    ].join('\n');

    const namespaced = namespaceHTML(body);

    // Prove the namespacing rather than trusting it: anything unprefixed here
    // is a class or id sharing a namespace with the app.
    const escapees = [];
    const classRe = /\sclass="([^"]+)"/g;
    const idRe = /\sid="([^"]+)"/g;
    let m;
    while ((m = classRe.exec(namespaced)) !== null) {
        for (const name of m[1].trim().split(/\s+/)) {
            if (!name.startsWith(NS)) escapees.push('class ' + name);
        }
    }
    while ((m = idRe.exec(namespaced)) !== null) {
        if (!m[1].startsWith(NS)) escapees.push('id ' + m[1]);
    }
    if (escapees.length) {
        throw new Error('manual markup escaped its namespace: ' +
            Array.from(new Set(escapees)).join(', '));
    }
    return namespaced;
}

/**
 * The English manual, the styles and every picture, as the one JS data file
 * the app loads on demand.
 *
 * Not a page beside the app but a file inside it, under `js/data/` with the
 * pattern bitmaps and the ROM font. `js/` is the app - without it there is
 * nothing to run - so a manual that travels in `js/` cannot go missing while
 * the app still works. Nothing loads it at boot; ManualDialog injects the
 * script the first time somebody opens Help > Manual.
 *
 * @param {string} version
 * @param {string} css
 * @param {string} html - the English body, pictures still as img/NAME
 * @param {Object<string,string>} images - NAME -> data URI
 * @returns {string} the contents of js/data/manual-content.js
 */
function renderDataFile(version, css, html, images) {
    return [
        "'use strict';",
        '/**',
        ' * Auto-generated - do not edit. Re-run `node tools/build-manual.js`.',
        ' *',
        ' * The PixULA user manual in English: prose from manual/content/, tables',
        ' * read out of the running app, its styles, and every screenshot (shared by',
        ' * the translations in js/data/manual/). Loaded on demand by',
        ' * js/ui/components/manual-dialog.js, never at boot.',
        ' */',
        'window.MANUAL_CONTENT = ' + JSON.stringify({ version, css, images, html }) + ';',
        ''
    ].join('\n');
}

/**
 * One translation's manual: its text only. The styles and pictures come from
 * the English file, which ManualDialog always loads first.
 * @param {string} code
 * @param {string} version
 * @param {string} html
 * @returns {string} the contents of js/data/manual/manual-<code>.js
 */
function renderLocaleFile(code, version, html) {
    return [
        "'use strict';",
        '/**',
        ' * Auto-generated - do not edit. Re-run `node tools/build-manual.js`.',
        ' *',
        ' * The PixULA user manual, language "' + code + '": prose from',
        ' * manual/content/' + code + '/, tables read out of the app running in this',
        ' * language. Loaded on demand by js/ui/components/manual-dialog.js.',
        ' */',
        'window.MANUAL_TRANSLATIONS = window.MANUAL_TRANSLATIONS || {};',
        'window.MANUAL_TRANSLATIONS[' + JSON.stringify(code) + '] = ' +
            JSON.stringify({ version, html }) + ';',
        ''
    ].join('\n');
}

/**
 * Render one language's chapters from its prose and the app data read in it.
 * @returns {{chapters: Array, used: Set<string>}}
 */
function renderChapters(content, blocks, code) {
    const used = new Set();
    const where = code === 'en' ? 'manual/content/' : 'manual/content/' + code + '/';
    const chapters = content.map((file) => {
        const html = renderMarkdown(file.source, (token) => {
            if (!(token in blocks)) {
                throw new Error(where + file.file + ' asks for {{' + token +
                    '}}, which no generated section provides. Known: ' +
                    Object.keys(blocks).sort().join(', '));
            }
            used.add(token);
            return blocks[token];
        });
        return { id: file.id, html, headings: collectHeadings(html) };
    });
    // The same heading twice in one language would be two elements with one
    // id, and the contents link would only ever reach the first.
    const seen = new Set();
    for (const ch of chapters) {
        for (const h of ch.headings) {
            if (seen.has(h.id)) {
                throw new Error(where + ': two headings share the anchor "' + h.id +
                    '" - reword one of them');
            }
            seen.add(h.id);
        }
    }
    return { chapters, used };
}

async function main() {
    const check = process.argv.includes('--check');
    // --no-shots rebuilds the text from the existing screenshots. Prose edits
    // are the common case and do not need fifteen fresh captures.
    const wantShots = !process.argv.includes('--no-shots') && !check;

    let shots = [];
    let locales = [];
    const extracted = {};
    await withApp(async (page) => {
        extracted.en = await page.evaluate(extractManualData);
        if (wantShots) shots = await captureShots(page);
        locales = await page.evaluate(() => I18n.supportedLocales.filter((c) => c !== 'en'));
        // The same running app, switched language by language - exactly what a
        // reader gets from the language selector.
        for (const code of locales) {
            await page.evaluate((c) => I18n.setLocale(c), code);
            extracted[code] = await page.evaluate(extractManualData);
        }
        await page.evaluate(() => I18n.setLocale('en'));
    });

    const english = readContent('en');
    if (!english.length) {
        throw new Error('no prose found in manual/content/ - the manual is prose ' +
            'with generated blocks in it, not generated blocks alone');
    }

    const images = readImages();
    const outputs = new Map();   // file -> contents
    const summary = [];

    for (const code of ['en', ...locales]) {
        const data = extracted[code];
        const t = stringsFor(code);
        const content = code === 'en' ? english : readContent(code);
        const where = code === 'en' ? 'manual/content/' : 'manual/content/' + code + '/';

        // A translation has exactly the English chapters, each placing the same
        // tables and pictures.
        const names = content.map((f) => f.file).join(', ');
        const want = english.map((f) => f.file).join(', ');
        if (names !== want) {
            throw new Error(where + ' must hold the same chapters as manual/content/.\n' +
                '  has:  ' + (names || '(nothing)') + '\n  want: ' + want);
        }
        content.forEach((file, i) => {
            if (skeleton(file.source) !== skeleton(english[i].source)) {
                throw new Error(where + file.file + ' places different tables or ' +
                    'pictures from the English:\n  ' + skeleton(file.source) +
                    '\n  English: ' + skeleton(english[i].source));
            }
        });

        const blocks = renderSections(data, t);
        const { chapters, used } = renderChapters(content, blocks, code);

        // A generated section nobody placed is content silently missing from the
        // manual, which is exactly the kind of quiet gap this tool exists to stop.
        const unplaced = Object.keys(blocks).filter((k) => !used.has(k));
        if (unplaced.length) {
            throw new Error('generated sections nothing placed: ' + unplaced.join(', ') +
                '\n  add {{' + unplaced[0] + '}} to a file in manual/content/, or ' +
                'remove the section from tools/manual-sections.js');
        }

        if (code === 'en') checkPictures(chapters.map((c) => c.html).join('\n'));
        const html = inlineImages(renderBody(data, chapters, t), images);
        const version = data.generatedFrom.version;
        if (code === 'en') {
            outputs.set(OUT_FILE, renderDataFile(version, readStyle(), html, images));
        } else {
            outputs.set(localeFile(code), renderLocaleFile(code, version, html));
        }
        summary.push(code);
    }

    // A translation file for a language the app no longer offers is dead
    // weight in every download.
    const expected = new Set(locales.map(localeFile));
    const strays = fs.existsSync(LOCALE_DIR)
        ? fs.readdirSync(LOCALE_DIR).map((f) => path.join(LOCALE_DIR, f))
            .filter((f) => !expected.has(f))
        : [];

    const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
    if (check) {
        const stale = [];
        for (const [file, out] of outputs) {
            const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
            if (current !== out) stale.push(rel(file));
        }
        stale.push(...strays.map((f) => rel(f) + ' (no such language)'));
        if (!stale.length) {
            console.log('build-manual: the manual is up to date in ' + summary.length +
                ' languages');
            return;
        }
        console.error('build-manual: STALE - run `node tools/build-manual.js`:\n  ' +
            stale.join('\n  '));
        process.exitCode = 1;
        return;
    }

    fs.mkdirSync(LOCALE_DIR, { recursive: true });
    for (const f of strays) fs.rmSync(f);
    let total = 0;
    for (const [file, out] of outputs) {
        fs.writeFileSync(file, out);
        total += Buffer.byteLength(out);
    }
    const en = extracted.en;
    console.log('build-manual: manual written in ' + summary.length + ' languages (' +
        summary.join(', ') + '), ' + (total / 1024).toFixed(0) + ' KB in all, from PixULA ' +
        en.generatedFrom.version);
    console.log('build-manual: ' + en.tools.length + ' tools, ' +
        en.tools.reduce((n, t) => n + t.options.length, 0) + ' options, ' +
        en.screenModes.length + ' screen modes, ' +
        en.formats.import.length + ' import / ' + en.formats.export.length + ' export formats');
    if (shots.length) {
        const bytes = shots.reduce((n, s) => n + s.bytes, 0);
        console.log('build-manual: ' + shots.length + ' screenshots, ' +
            (bytes / 1024).toFixed(0) + ' KB total');
    }
}

/**
 * Pictures and prose have to agree in both directions. A reference with no
 * file behind it is a broken picture; a file nothing references is weight
 * carried in every copy of the app for nothing.
 * @param {string} chapterHtml - the English chapters
 */
function checkPictures(chapterHtml) {
    const referenced = new Set();
    const imgRe = /<img src="img\/([^"]+)"/g;
    let hit;
    while ((hit = imgRe.exec(chapterHtml)) !== null) referenced.add(hit[1]);

    const onDisk = fs.existsSync(IMG_DIR)
        ? fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.png'))
        : [];
    const missing = Array.from(referenced).filter((f) => !onDisk.includes(f));
    if (missing.length) {
        throw new Error('the prose references images that do not exist: ' +
            missing.join(', ') + '\n  run without --no-shots to capture them, or ' +
            'add them to tools/manual-shots.js');
    }
    const unused = onDisk.filter((f) => !referenced.has(f));
    if (unused.length) {
        throw new Error('screenshots nothing places: ' + unused.join(', ') +
            '\n  reference them from manual/content/ with ![alt](img/NAME), or ' +
            'remove them from tools/manual-shots.js and delete the file');
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('build-manual: ' + err.message);
        process.exit(1);
    });
}

module.exports = { withApp, captureShots, readContent, renderDataFile, renderLocaleFile,
                   readImages, inlineImages, collectHeadings, stringsFor, skeleton };
