'use strict';
/**
 * manual-sections.js - turn the extracted app data into the manual's
 * generated blocks.
 *
 * Each exported block is reached from the prose by a `{{token}}` line, so a
 * human decides where a table sits and what is said around it, and this file
 * decides only what the table contains. Adding a block here without placing
 * its token in manual/content/ fails the build - a generated section nobody
 * placed is content silently missing from the manual.
 *
 * House rules for everything below:
 *   - Never restate a number the extractor can give. If the manual says
 *     "105 patterns", that count came from the library.
 *   - Prefer the app's own words. Tool hints, option labels, control
 *     descriptions and mode summaries are already written and already
 *     translated; rephrasing them here would create a second wording to keep
 *     in step with the first.
 *   - Say what a thing is FOR before saying what it is called.
 *   - Every word this file adds is a `manual.*` key in js/i18n/, looked up
 *     through the `t` each block is handed, so the manual is built once per
 *     language the app speaks and the translation check covers these words
 *     exactly as it covers the app's own.
 */
const { escapeHTML, slug } = require('./manual-markdown.js');

/** An icon from the app's own sprite. @param {?string} id @returns {string} */
function icon(id) {
    if (!id) return '';
    return '<svg class="icon" aria-hidden="true"><use href="#' + escapeHTML(id) + '"></use></svg>';
}

/** @param {string[]} headers @param {string[][]} rows @returns {string} */
function table(headers, rows, className) {
    if (!rows.length) return '';
    return '<div class="table-wrap"><table' +
        (className ? ' class="' + className + '"' : '') + '>' +
        '<thead><tr>' + headers.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + rows.map((r) =>
            '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>';
}

/** Stands in for a number in a sentence until it is escaped and emboldened. */
const MARK = '\u0001';

/**
 * Escape a translated sentence, then put each number back in bold where the
 * translation placed its {placeholder} - word order is the translator's.
 * @param {string} text - with MARK where each value goes
 * @param {Array<number|string>} values
 * @returns {string}
 */
function withStrong(text, values) {
    let i = 0;
    return escapeHTML(text).split(MARK).map((part, n) =>
        n === 0 ? part : '<strong>' + escapeHTML(String(values[i++])) + '</strong>' + part).join('');
}

/** A keyboard key. @param {string} keys @returns {string} */
function kbd(keys) {
    if (!keys) return '';
    return '<kbd>' + escapeHTML(keys) + '</kbd>';
}

/** A schema row's default, printed the way the control shows it. */
function defaultOf(option, t) {
    if (option.default === null || option.default === undefined) return '';
    if (typeof option.default === 'boolean') return escapeHTML(t(option.default ? 'manual.on' : 'manual.off'));
    if (option.choices) {
        const hit = option.choices.find((c) => c.value === option.default);
        if (hit) return escapeHTML(hit.label);
    }
    return escapeHTML(String(option.default)) + (option.unit ? ' ' + escapeHTML(option.unit) : '');
}

/** A schema row's domain: a range, a list of choices, or a plain on/off. */
function domainOf(option, t) {
    if (option.type === 'check') return escapeHTML(t('manual.onOrOff'));
    if (option.type === 'range') {
        return escapeHTML(t('manual.range', { min: option.min, max: option.max })) +
            (option.step && option.step !== 1
                ? escapeHTML(t('manual.rangeStep', { step: option.step })) : '');
    }
    if (option.dynamic && !option.choices) {
        return '<em>' + escapeHTML(t('manual.dynamicList')) + '</em>';
    }
    if (option.choices) {
        const names = option.choices.map((c) => {
            const label = escapeHTML(c.label);
            // A choice carrying a tool id switches tools rather than setting a
            // value - the bezier curve lives in the Shape list this way.
            return c.switchesToTool
                ? label + ' <span class="tag">' + escapeHTML(t('manual.switchesTool')) + '</span>'
                : label;
        });
        return names.join(', ') + (option.dynamic ? escapeHTML(t('manual.plusMachine')) : '');
    }
    if (option.type === 'textarea') return escapeHTML(t('manual.freeText'));
    if (option.type === 'slot') return '<em>' + escapeHTML(t('manual.ownPanel')) + '</em>';
    return '';
}

/**
 * One tool: what it is for, then how to change what it does.
 * @param {Object} tool
 * @param {Object<string,string>} names - tool id -> its name in the app, so a
 *   cross-reference can say "the Shape tool" rather than printing an id.
 * @param {Function} t - the manual's language
 */
function toolBlock(tool, names, t) {
    const rows = tool.options
        .filter((o) => o.key && o.type !== 'hint')
        .map((o) => [
            '<strong>' + escapeHTML(o.label) + '</strong>',
            domainOf(o, t),
            defaultOf(o, t),
            o.shownWhen ? escapeHTML(o.shownWhen)
                : '<span class="muted">' + escapeHTML(t('manual.always')) + '</span>'
        ]);

    const hints = tool.options
        .filter((o) => o.type === 'hint' && o.label)
        .map((o) => '<p class="tool__hint">' + escapeHTML(o.label) + '</p>')
        .join('');

    return [
        '<article class="tool" id="tool-' + escapeHTML(tool.id) + '">',
        '<h3 id="' + escapeHTML(slug(tool.name)) + '">',
        icon(tool.icon), escapeHTML(tool.name),
        tool.shortcut ? ' ' + kbd(tool.shortcut) : '',
        '</h3>',
        tool.hint ? '<p class="tool__what">' + escapeHTML(tool.hint) + '</p>' : '',
        tool.variantOf
            ? '<p class="note">' + escapeHTML(t('manual.variantNote',
                { tool: names[tool.variantOf] || tool.variantOf })) + '</p>'
            : '',
        hints,
        rows.length
            ? table([t('manual.col.option'), t('manual.col.choices'), t('manual.col.default'),
                t('manual.col.shownWhen')].map(escapeHTML), rows, 'options')
            : '<p class="muted">' + escapeHTML(t('manual.noOptions')) + '</p>',
        '</article>'
    ].join('\n');
}

/** Every tool, in rail order, grouped by the headings the rail prints. */
function toolsSection(data, t) {
    const groups = [];
    for (const tool of data.tools) {
        let group = groups.find((g) => g.id === tool.group);
        if (!group) {
            group = { id: tool.group, label: tool.groupLabel, tools: [] };
            groups.push(group);
        }
        group.tools.push(tool);
    }
    // Names, so a cross-reference reads "the Shape tool" rather than naming an
    // internal id the reader has never seen anywhere in the app.
    const names = {};
    for (const tool of data.tools) names[tool.id] = tool.name;

    return groups.map((g) => [
        '<div class="tool-group">',
        '<h3 id="tools-' + escapeHTML(g.id) + '">' + escapeHTML(g.label) + '</h3>',
        g.tools.map((tool) => toolBlock(tool, names, t)).join('\n'),
        '</div>'
    ].join('\n')).join('\n');
}

/** Every screen mode, with the geometry the app itself quotes. */
function screenModesSection(data) {
    return data.screenModes.map((m) => [
        '<article class="mode" id="mode-' + escapeHTML(m.id) + '">',
        '<h3 id="mode-' + escapeHTML(m.id) + '-h">' + escapeHTML(m.name) + '</h3>',
        '<p class="mode__spec">' + escapeHTML(m.summary) + '</p>',
        m.description ? '<p>' + escapeHTML(m.description) + '</p>' : '',
        m.palette ? '<p class="muted">' + escapeHTML(m.palette) + '</p>' : '',
        '</article>'
    ].join('\n')).join('\n');
}

/** The global draw modes, which change what every tool's stroke does. */
function drawModesSection(data, t) {
    return table([t('manual.col.mode'), t('manual.col.strokeDoes')].map(escapeHTML),
        data.drawModes.map((m) => [
            '<strong>' + escapeHTML(m.name) + '</strong>',
            escapeHTML(m.desc)
        ]));
}

/** The built-in pattern library, counted the two ways artists ask about it. */
function patternsSection(data, t) {
    const p = data.patterns;
    const sizes = Object.keys(p.bySize).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const cats = Object.keys(p.byCategory).sort();
    const sizeNote = { '8x8': 'manual.size8', '16x16': 'manual.size16' };
    const families = ['density', 'halftone', 'dither', 'hatch', 'lines', 'texture'];
    return [
        '<p>' + withStrong(t('manual.libraryHolds', { n: MARK }), [p.total]) + '</p>',
        table([t('manual.col.tileSize'), t('manual.col.howMany'), t('manual.col.sizeFor')].map(escapeHTML),
            sizes.map((s) => [
                '<strong>' + escapeHTML(s) + '</strong>',
                String(p.bySize[s]),
                escapeHTML(t(sizeNote[s] || 'manual.size32'))
            ])),
        table([t('manual.col.family'), t('manual.col.howMany'), t('manual.col.whatItIs')].map(escapeHTML),
            cats.map((c) => [
                '<strong>' + escapeHTML(families.includes(c) ? t('manual.family.' + c) : c) + '</strong>',
                String(p.byCategory[c]),
                families.includes(c) ? escapeHTML(t('manual.family.' + c + '.desc')) : ''
            ]))
    ].join('\n');
}

/** Every menu, as it renders. */
function menusSection(data, t) {
    return data.menus.map((menu) => {
        const rows = [];
        const walk = (items, depth) => {
            for (const item of items) {
                if (item.type === 'separator') continue;
                const indent = depth ? '<span class="muted">' +
                    escapeHTML(t('manual.inSubmenu', { menu: item.parentLabel || '' })) + ' </span>' : '';
                rows.push([
                    indent + '<strong>' + escapeHTML(item.label) + '</strong>',
                    item.shortcut ? kbd(item.shortcut) : ''
                ]);
                if (item.items) {
                    for (const sub of item.items) sub.parentLabel = item.label;
                    walk(item.items, depth + 1);
                }
            }
        };
        walk(menu.items, 0);
        return [
            '<div class="menu">',
            '<h3 id="menu-' + escapeHTML(menu.id) + '">' +
                escapeHTML(t('manual.menuHeading', { menu: menu.label })) + '</h3>',
            table([t('manual.col.entry'), t('manual.col.shortcut')].map(escapeHTML), rows),
            '</div>'
        ].join('\n');
    }).join('\n');
}

/** "yes", or a muted "no". */
function yesNo(value, t) {
    return value ? escapeHTML(t('manual.yes'))
        : '<span class="muted">' + escapeHTML(t('manual.no')) + '</span>';
}

/** What opens and what saves. */
function formatsSection(data, t) {
    const exportExts = new Set(data.formats.export.map((f) => f.ext));
    const importExts = new Set(data.formats.import.map((f) => f.ext));
    const all = Array.from(new Set([...importExts, ...exportExts])).sort();
    const labels = {};
    for (const f of data.formats.import) labels[f.ext] = f.label;
    for (const f of data.formats.export) labels[f.ext] = labels[f.ext] || f.label;

    return [
        '<p>' + withStrong(t('manual.formatsCount', { opens: MARK, saves: MARK }),
            [data.formats.import.length, data.formats.export.length]) + '</p>',
        table([t('manual.col.extension'), t('manual.col.whatItIs'), t('manual.col.open'),
            t('manual.col.save')].map(escapeHTML),
            all.map((ext) => [
                '<code>.' + escapeHTML(ext) + '</code>',
                escapeHTML(labels[ext] || ''),
                yesNo(importExts.has(ext), t),
                yesNo(exportExts.has(ext), t)
            ]))
    ].join('\n');
}

/** Pen controls, what they can be told to do, and the models listed. */
function penSection(data, t) {
    const actionName = {};
    for (const a of data.pen.actions) actionName[a.id] = a.name;

    const byVendor = [];
    for (const p of data.pen.profiles) {
        const key = p.vendor || t('manual.pen.otherVendor');
        let group = byVendor.find((g) => g.vendor === key);
        if (!group) { group = { vendor: key, rows: [] }; byVendor.push(group); }
        group.rows.push(p);
    }
    const controlNote = { tip: 'manual.pen.tip', barrel: 'manual.pen.barrel', barrel2: 'manual.pen.barrel2' };

    return [
        '<h3 id="what-a-browser-can-see-of-a-pen">' + escapeHTML(t('manual.pen.seeHeading')) + '</h3>',
        '<p>' + escapeHTML(t('manual.pen.seeText')) + '</p>',
        table([t('manual.col.control'), t('manual.col.whatItIs')].map(escapeHTML),
            data.pen.controls.map((c) => [
                '<strong>' + escapeHTML(c.name) + '</strong>',
                escapeHTML(t(controlNote[c.id] || 'manual.pen.eraser'))
            ])),

        '<h3 id="what-you-can-assign-to-them">' + escapeHTML(t('manual.pen.assignHeading')) + '</h3>',
        table([t('manual.col.action'), t('manual.col.runsFor')].map(escapeHTML),
            data.pen.actions.map((a) => [
                '<strong>' + escapeHTML(a.name) + '</strong>',
                escapeHTML(t(a.heldForWholeStroke ? 'manual.pen.wholeStroke' : 'manual.pen.pressAlone'))
            ])),

        '<h3 id="pen-models">' + escapeHTML(t('manual.pen.modelsHeading')) + '</h3>',
        '<p>' + escapeHTML(t('manual.pen.modelsText')) + '</p>',
        byVendor.map((g) => table(
            [g.vendor, t('manual.col.sideButtons'), t('manual.col.eraserEnd'),
                t('manual.col.sideButtonDoes')].map(escapeHTML),
            g.rows.map((p) => [
                escapeHTML(p.label),
                String(p.barrels),
                yesNo(p.eraser, t),
                escapeHTML(actionName[p.defaults.barrel] || '-')
            ])
        )).join('\n')
    ].join('\n');
}

/** What a workspace preset carries. */
function presetsSection(data, t) {
    return table([t('manual.col.slice'), t('manual.col.restores')].map(escapeHTML),
        data.presetSlices.map((s) => [
            '<strong>' + escapeHTML(s.name) + '</strong>',
            escapeHTML(s.description || '')
        ]));
}

/**
 * Every named control in the workspace, area by area.
 *
 * These names and descriptions are the app's own tooltips, and
 * tests/browser/tooltip.spec.js already fails the build if one is missing or
 * merely repeats its own name - so this table is complete by construction
 * rather than by anyone remembering to update it.
 */
function controlsSection(data, t) {
    const areas = ['toolRail', 'panels', 'colourRail', 'colourBar', 'drawModes',
        'transform', 'zoom', 'grid', 'statusBar'];
    return Object.keys(data.controls).map((area) => [
        '<h3 id="controls-' + escapeHTML(area) + '">' +
            escapeHTML(areas.includes(area) ? t('manual.area.' + area) : area) + '</h3>',
        table([t('manual.col.control'), t('manual.col.whatItDoes')].map(escapeHTML),
            data.controls[area].map((c) => [
                '<strong>' + escapeHTML(c.name) + '</strong>',
                escapeHTML(c.desc)
            ]))
    ].join('\n')).join('\n');
}

/** Every shortcut, gathered from the menus, the rail and the preset slots. */
function shortcutsSection(data, t) {
    const seen = new Set();
    const rows = [];
    for (const s of data.shortcuts) {
        const key = s.keys + '|' + s.what;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push([kbd(s.keys), escapeHTML(s.what), '<span class="muted">' +
            escapeHTML(s.from || '') + '</span>']);
    }
    return table([t('manual.col.keys'), t('manual.col.whatItDoes'), t('manual.col.whereItLives')]
        .map(escapeHTML), rows, 'shortcuts');
}

/**
 * @param {Object} data - from tools/manual-extract.js, read from the app
 *   running in the manual's language
 * @param {(key: string, params?: Object) => string} t - that language's
 *   strings (js/i18n/<code>.js), plain text with {params} filled in
 * @returns {Object<string,string>} token -> HTML
 */
function renderSections(data, t) {
    return {
        tools: toolsSection(data, t),
        'screen-modes': screenModesSection(data),
        'draw-modes': drawModesSection(data, t),
        patterns: patternsSection(data, t),
        menus: menusSection(data, t),
        formats: formatsSection(data, t),
        pen: penSection(data, t),
        presets: presetsSection(data, t),
        controls: controlsSection(data, t),
        shortcuts: shortcutsSection(data, t)
    };
}

module.exports = { renderSections };
