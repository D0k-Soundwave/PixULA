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
 */
const { escapeHTML } = require('./manual-markdown.js');

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

/** A keyboard key. @param {string} keys @returns {string} */
function kbd(keys) {
    if (!keys) return '';
    return '<kbd>' + escapeHTML(keys) + '</kbd>';
}

/** A schema row's default, printed the way the control shows it. */
function defaultOf(option) {
    if (option.default === null || option.default === undefined) return '';
    if (typeof option.default === 'boolean') return option.default ? 'on' : 'off';
    if (option.choices) {
        const hit = option.choices.find((c) => c.value === option.default);
        if (hit) return escapeHTML(hit.label);
    }
    return escapeHTML(String(option.default)) + (option.unit ? ' ' + escapeHTML(option.unit) : '');
}

/** A schema row's domain: a range, a list of choices, or a plain on/off. */
function domainOf(option) {
    if (option.type === 'check') return 'on or off';
    if (option.type === 'range') {
        return escapeHTML(option.min + ' to ' + option.max) +
            (option.step && option.step !== 1 ? ', in steps of ' + escapeHTML(String(option.step)) : '');
    }
    if (option.dynamic && !option.choices) {
        return '<em>built from what this machine has installed</em>';
    }
    if (option.choices) {
        const names = option.choices.map((c) => {
            const label = escapeHTML(c.label);
            // A choice carrying a tool id switches tools rather than setting a
            // value - the bezier curve lives in the Shape list this way.
            return c.switchesToTool ? label + ' <span class="tag">switches tool</span>' : label;
        });
        return names.join(', ') + (option.dynamic ? ', plus any the machine adds' : '');
    }
    if (option.type === 'textarea') return 'free text';
    if (option.type === 'slot') return '<em>set in a panel of its own</em>';
    return '';
}

/**
 * One tool: what it is for, then how to change what it does.
 * @param {Object} tool
 * @param {Object<string,string>} names - tool id -> its name in the app, so a
 *   cross-reference can say "the Shape tool" rather than printing an id.
 */
function toolBlock(tool, names) {
    const rows = tool.options
        .filter((o) => o.key && o.type !== 'hint')
        .map((o) => [
            '<strong>' + escapeHTML(o.label) + '</strong>',
            domainOf(o),
            defaultOf(o),
            o.shownWhen ? escapeHTML(o.shownWhen) : '<span class="muted">always</span>'
        ]);

    const hints = tool.options
        .filter((o) => o.type === 'hint' && o.label)
        .map((o) => '<p class="tool__hint">' + escapeHTML(o.label) + '</p>')
        .join('');

    return [
        '<article class="tool" id="tool-' + escapeHTML(tool.id) + '">',
        '<h3 id="' + escapeHTML(tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '">',
        icon(tool.icon), escapeHTML(tool.name),
        tool.shortcut ? ' ' + kbd(tool.shortcut) : '',
        '</h3>',
        tool.hint ? '<p class="tool__what">' + escapeHTML(tool.hint) + '</p>' : '',
        tool.variantOf
            ? '<p class="note">This one has no button on the rail. Select it from the ' +
              escapeHTML(names[tool.variantOf] || tool.variantOf) +
              ' tool\'s options instead.</p>'
            : '',
        hints,
        rows.length
            ? table(['Option', 'Choices', 'Default', 'Shown when'], rows, 'options')
            : '<p class="muted">This tool has no options.</p>',
        '</article>'
    ].join('\n');
}

/** Every tool, in rail order, grouped by the headings the rail prints. */
function toolsSection(data) {
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
        g.tools.map((t) => toolBlock(t, names)).join('\n'),
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
function drawModesSection(data) {
    return table(['Mode', 'What a stroke does'],
        data.drawModes.map((m) => [
            '<strong>' + escapeHTML(m.name) + '</strong>',
            escapeHTML(m.desc)
        ]));
}

/** The built-in pattern library, counted the two ways artists ask about it. */
function patternsSection(data) {
    const p = data.patterns;
    const sizes = Object.keys(p.bySize).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const cats = Object.keys(p.byCategory).sort();
    return [
        '<p>The library holds <strong>' + p.total + '</strong> tiles.</p>',
        table(['Tile size', 'How many', 'What that size is for'],
            sizes.map((s) => [
                '<strong>' + escapeHTML(s) + '</strong>',
                String(p.bySize[s]),
                s === '8x8' ? 'A single attribute cell. Most of the shading tiles are this size.'
                    : s === '16x16' ? 'Two cells square, which gives a motif room to be recognisable.'
                        : 'Four cells square, for large motifs and long repeats.'
            ])),
        table(['Family', 'How many', 'What it is'],
            cats.map((c) => [
                '<strong>' + escapeHTML(c) + '</strong>',
                String(p.byCategory[c]),
                ({
                    density: 'An even ramp from light to dark. Each tile is named for the proportion of ink it actually contains.',
                    halftone: 'The same range of greys, with the ink gathered into clusters rather than spread evenly.',
                    dither: 'The same greys again, scattered, for texture with no visible lattice.',
                    hatch: 'Crossing lines, from a fine mesh to an open windowpane.',
                    lines: 'Lines in one direction: horizontal, vertical or diagonal, fine to wide.',
                    texture: 'Repeating motifs - brick, weave, scales, chevrons and so on.'
                })[c] || ''
            ]))
    ].join('\n');
}

/** Every menu, as it renders. */
function menusSection(data) {
    return data.menus.map((menu) => {
        const rows = [];
        const walk = (items, depth) => {
            for (const item of items) {
                if (item.type === 'separator') continue;
                const indent = depth ? '<span class="muted">in ' +
                    escapeHTML(item.parentLabel || '') + ': </span>' : '';
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
            '<h3 id="menu-' + escapeHTML(menu.id) + '">' + escapeHTML(menu.label) + ' menu</h3>',
            table(['Entry', 'Shortcut'], rows),
            '</div>'
        ].join('\n');
    }).join('\n');
}

/** What opens and what saves. */
function formatsSection(data) {
    const exportExts = new Set(data.formats.export.map((f) => f.ext));
    const importExts = new Set(data.formats.import.map((f) => f.ext));
    const all = Array.from(new Set([...importExts, ...exportExts])).sort();
    const labels = {};
    for (const f of data.formats.import) labels[f.ext] = f.label;
    for (const f of data.formats.export) labels[f.ext] = labels[f.ext] || f.label;

    return [
        '<p>PixULA opens <strong>' + data.formats.import.length + '</strong> file types and ' +
        'saves <strong>' + data.formats.export.length + '</strong>.</p>',
        table(['Extension', 'What it is', 'Open', 'Save'],
            all.map((ext) => [
                '<code>.' + escapeHTML(ext) + '</code>',
                escapeHTML(labels[ext] || ''),
                importExts.has(ext) ? 'yes' : '<span class="muted">no</span>',
                exportExts.has(ext) ? 'yes' : '<span class="muted">no</span>'
            ]))
    ].join('\n');
}

/** Pen controls, what they can be told to do, and the models listed. */
function penSection(data) {
    const actionName = {};
    for (const a of data.pen.actions) actionName[a.id] = a.name;

    const byVendor = [];
    for (const p of data.pen.profiles) {
        const key = p.vendor || 'Other';
        let group = byVendor.find((g) => g.vendor === key);
        if (!group) { group = { vendor: key, rows: [] }; byVendor.push(group); }
        group.rows.push(p);
    }

    return [
        '<h3 id="what-a-browser-can-see-of-a-pen">What a browser can see of a pen</h3>',
        '<p>Four things, and no more. Everything else a modern stylus does - a ' +
        'double-tap, a squeeze, an air gesture - travels over a private channel ' +
        'no web page can read.</p>',
        table(['Control', 'What it is'],
            data.pen.controls.map((c) => [
                '<strong>' + escapeHTML(c.name) + '</strong>',
                c.id === 'tip' ? 'Always draws with the active tool. Not assignable.'
                    : c.id === 'barrel' ? 'The side button - the pen\'s secondary button, the same signal as a mouse right-click.'
                        : c.id === 'barrel2' ? 'A second side button, and only if the tablet driver sends it as a middle click.'
                            : 'The inverted tail, where the pen has one.'
            ])),

        '<h3 id="what-you-can-assign-to-them">What you can assign to them</h3>',
        table(['Action', 'Runs for'],
            data.pen.actions.map((a) => [
                '<strong>' + escapeHTML(a.name) + '</strong>',
                a.heldForWholeStroke ? 'the whole press-drag-lift' : 'the press alone'
            ])),

        '<h3 id="pen-models">Pen models</h3>',
        '<p>Choosing your model decides which controls are listed and what they ' +
        'start out doing. It does not detect anything: a browser sees the same four ' +
        'signals from every stylus, so the list is a convenience rather than a ' +
        'measurement. A button that does reach the browser will work even if the ' +
        'model you picked is not supposed to have it.</p>',
        byVendor.map((g) => table(
            [escapeHTML(g.vendor), 'Side buttons', 'Eraser end', 'Side button does'],
            g.rows.map((p) => [
                escapeHTML(p.label),
                String(p.barrels),
                p.eraser ? 'yes' : '<span class="muted">no</span>',
                escapeHTML(actionName[p.defaults.barrel] || '-')
            ])
        )).join('\n')
    ].join('\n');
}

/** What a workspace preset carries. */
function presetsSection(data) {
    return table(['Slice', 'What it restores'],
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
function controlsSection(data) {
    const titles = {
        toolRail: 'The tool rail',
        panels: 'The side panels',
        colourRail: 'The colour rail',
        colourBar: 'The colour bar',
        drawModes: 'Draw modes',
        transform: 'The Transform panel',
        zoom: 'Zoom controls',
        grid: 'Grid controls',
        statusBar: 'The status bar'
    };
    return Object.keys(data.controls).map((area) => [
        '<h3 id="controls-' + escapeHTML(area) + '">' +
            escapeHTML(titles[area] || area) + '</h3>',
        table(['Control', 'What it does'],
            data.controls[area].map((c) => [
                '<strong>' + escapeHTML(c.name) + '</strong>',
                escapeHTML(c.desc)
            ]))
    ].join('\n')).join('\n');
}

/** Every shortcut, gathered from the menus, the rail and the preset slots. */
function shortcutsSection(data) {
    const seen = new Set();
    const rows = [];
    for (const s of data.shortcuts) {
        const key = s.keys + '|' + s.what;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push([kbd(s.keys), escapeHTML(s.what), '<span class="muted">' +
            escapeHTML(s.from || '') + '</span>']);
    }
    return table(['Keys', 'What it does', 'Where it lives'], rows, 'shortcuts');
}

/**
 * @param {Object} data - from tools/manual-extract.js
 * @returns {Object<string,string>} token -> HTML
 */
function renderSections(data) {
    return {
        tools: toolsSection(data),
        'screen-modes': screenModesSection(data),
        'draw-modes': drawModesSection(data),
        patterns: patternsSection(data),
        menus: menusSection(data),
        formats: formatsSection(data),
        pen: penSection(data),
        presets: presetsSection(data),
        controls: controlsSection(data),
        shortcuts: shortcutsSection(data)
    };
}

module.exports = { renderSections };
