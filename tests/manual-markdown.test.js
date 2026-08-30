'use strict';
/**
 * The manual's Markdown subset (tools/manual-markdown.js).
 *
 * Pure string in, string out, so it is tested here rather than through a
 * browser. What is pinned is the handful of behaviours that were wrong first
 * time and produced a manual that LOOKED built while reading badly - a wrapped
 * bullet escaping its own list item, a wrapped aside becoming a stack of
 * separate boxes, and a code span swallowing an ordinary number out of the
 * prose around it. Each of those renders without an error, which is exactly
 * why they need a test rather than a glance.
 */
const { check, summary } = require('./helpers/zx-stubs');
const { renderMarkdown, slug, inline } = require('../tools/manual-markdown.js');

const render = (lines, resolve) =>
    renderMarkdown(lines.join('\n'), resolve || (() => ''));

// ── headings and anchors ───────────────────────────────────────────────────
check('a heading becomes an h2 with an anchor derived from its words',
    render(['## Attribute clash']) === '<h2 id="attribute-clash">Attribute clash</h2>');
check('a third-level heading is an h3',
    render(['### Draw modes']).startsWith('<h3 id="draw-modes">'));
check('anchors are stable, lowercase and punctuation-free',
    slug('Mouse, pen and touch!') === 'mouse-pen-and-touch');
check('a heading of pure punctuation still gets a usable anchor',
    slug('...') === 'section');

// ── the wrapped-bullet bug ────────────────────────────────────────────────
// Prose here is hard-wrapped at 80 columns, so almost every real bullet spans
// two lines. Before this worked, each tail escaped its list and became a
// paragraph BELOW the list it belonged to.
const wrapped = render([
    '- **The menu bar** across the top: files, editing,',
    '  the view and help.',
    '- **The colour bar** under it.'
]);
check('a wrapped bullet stays inside its own list item',
    wrapped.indexOf('the view and help.</li>') > -1);
check('and does not leak out as a paragraph',
    wrapped.indexOf('<p>') === -1);
check('the list still closes exactly once',
    wrapped.split('<ul>').length === 2 && wrapped.split('</ul>').length === 2);

// ── the split-callout bug ─────────────────────────────────────────────────
const quoted = render([
    '> This is not a limitation PixULA imposes. It is the machine,',
    '> and it is why Spectrum art looks the way it does.'
]);
check('consecutive quoted lines are ONE callout, not one box per line',
    quoted.split('<blockquote>').length === 2);
check('and read as a single sentence',
    quoted.indexOf('the machine, and it is why') > -1);

const twoQuotes = render(['> First note.', '', 'Prose between.', '', '> Second note.']);
check('but two asides separated by prose stay two callouts',
    twoQuotes.split('<blockquote>').length === 3);

// ── code spans must not eat the prose around them ─────────────────────────
// The placeholder used while lifting code spans out was once a bare digit in
// spaces, which happily consumed real numbers from the sentence.
const withCode = inline('Set it to `size 1` and then 1 and 0 stay as they are.');
check('a code span survives intact',
    withCode.indexOf('<code>size 1</code>') > -1);
check('and bare numbers in the prose are untouched',
    withCode.indexOf('then 1 and 0 stay') > -1);
check('markup inside a code span is left alone',
    inline('`a **b** c`').indexOf('<strong>') === -1);

// ── inline spans ──────────────────────────────────────────────────────────
check('bold and italic render',
    inline('**bold** and *italic*') === '<strong>bold</strong> and <em>italic</em>');
check('a link renders with its href',
    inline('[docs](manual/index.html)') === '<a href="manual/index.html">docs</a>');
check('angle brackets in prose are escaped, not rendered',
    inline('a < b & c').indexOf('&lt; b &amp; c') > -1);

// ── figures ───────────────────────────────────────────────────────────────
const figure = render(['![The tool rail](img/tool-rail.png)', '*The rail.*']);
check('an image alone on a line becomes a figure',
    figure.indexOf('<figure>') === 0 && figure.indexOf('src="img/tool-rail.png"') > -1);
check('an italic line under it becomes the caption',
    figure.indexOf('<figcaption>The rail.</figcaption>') > -1);
check('figures are lazy, so a long manual does not fetch every picture at once',
    figure.indexOf('loading="lazy"') > -1);
check('an image alt survives for a screen reader',
    figure.indexOf('alt="The tool rail"') > -1);

// ── generated blocks ──────────────────────────────────────────────────────
check('a token alone on a line is replaced by its generated block',
    render(['{{tools}}'], (t) => '<!--' + t + '-->') === '<!--tools-->');
check('a token is only a token when it is alone on the line',
    render(['see {{tools}} below']).indexOf('{{tools}}') > -1);
check('an unknown token is reported by the resolver, not silently dropped',
    (() => {
        try {
            render(['{{nope}}'], () => { throw new Error('unknown'); });
            return false;
        } catch (e) { return e.message === 'unknown'; }
    })());

// ── code fences ───────────────────────────────────────────────────────────
const fenced = render(['```', 'node tools/build-manual.js', '```']);
check('a fence becomes a pre block with its content escaped',
    fenced === '<pre><code>node tools/build-manual.js</code></pre>');
check('an unterminated fence still emits what it collected',
    render(['```', 'stray']).indexOf('stray') > -1);

summary();
