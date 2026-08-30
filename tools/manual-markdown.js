'use strict';
/**
 * manual-markdown.js - the small subset of Markdown the manual's prose uses.
 *
 * Deliberately hand-rolled rather than pulled from npm. This repo carries ONE
 * dev-dependency on purpose (the Playwright harness), and a markdown library
 * would be a second one earning its place by saving about eighty lines. The
 * subset below is everything manual/content/*.md actually needs; anything
 * outside it should be added here rather than worked around in the prose.
 *
 * Supported:
 *   ## / ###           headings, auto-slugged into anchors for the sidebar
 *   paragraphs         blank-line separated
 *   - / 1.             lists (one level)
 *   > text             a callout
 *   ```                fenced code
 *   ![alt](src)        a figure; a following italic line becomes its caption
 *   **b** *i* `code`   inline spans
 *   [text](href)       links
 *   ---                rule
 *   {{token}}          alone on a line: replaced by a generated block
 */

/** @param {string} s @returns {string} */
function escapeHTML(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * A heading's anchor. Stable across rebuilds because it is derived from the
 * text alone - a link into the manual keeps working as long as the heading
 * keeps its words.
 * @param {string} text
 * @returns {string}
 */
function slug(text) {
    return String(text)
        .toLowerCase()
        .replace(/<[^>]+>/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
}

/**
 * Inline spans. Order matters: code first, so `**` inside a code span is left
 * alone; links before emphasis, so a URL containing an underscore survives.
 * @param {string} text - raw markdown, NOT yet escaped
 * @returns {string} HTML
 */
function inline(text) {
    // Code spans are lifted out first and put back last, so markup inside one
    // is never interpreted. The sentinel is NUL-delimited rather than, say, a
    // digit between spaces: prose is full of bare numbers, and " 1 " as a
    // placeholder would eat one of them. Written as an escape so the source
    // file itself stays printable ASCII.
    const codes = [];
    let s = String(text).replace(/`([^`]+)`/g, (m, code) => {
        codes.push('<code>' + escapeHTML(code) + '</code>');
        return '\u0000' + (codes.length - 1) + '\u0000';
    });

    s = escapeHTML(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[Number(i)]);
    return s;
}

/**
 * Render one prose file.
 * @param {string} source - markdown
 * @param {(token: string) => string} resolveToken - called for a `{{token}}`
 *   line; returns the generated HTML to drop in its place. Throwing from here
 *   is how an unknown token is reported.
 * @returns {string} HTML
 */
function renderMarkdown(source, resolveToken) {
    const lines = String(source).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let list = null;          // 'ul' | 'ol' | null
    let para = [];
    let quote = [];           // consecutive '> ' lines, gathered
    let fence = null;         // collected code lines, or null

    const closeList = () => {
        if (list) { out.push('</' + list + '>'); list = null; }
    };
    const closePara = () => {
        if (para.length) {
            out.push('<p>' + inline(para.join(' ')) + '</p>');
            para = [];
        }
    };
    // Consecutive quoted lines are ONE callout. Emitting a box per line turned
    // every wrapped aside into a stack of little boxes, each holding half a
    // sentence.
    const closeQuote = () => {
        if (quote.length) {
            out.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>');
            quote = [];
        }
    };
    const closeAll = () => { closePara(); closeQuote(); closeList(); };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (fence !== null) {
            if (/^```/.test(line.trim())) {
                out.push('<pre><code>' + escapeHTML(fence.join('\n')) + '</code></pre>');
                fence = null;
            } else {
                fence.push(line);
            }
            continue;
        }
        if (/^```/.test(line.trim())) { closeAll(); fence = []; continue; }

        const trimmed = line.trim();

        if (!trimmed) { closeAll(); continue; }

        // A generated block, alone on its line.
        const token = trimmed.match(/^\{\{([a-z0-9-]+)\}\}$/);
        if (token) {
            closeAll();
            out.push(resolveToken(token[1]));
            continue;
        }

        if (trimmed === '---') { closeAll(); out.push('<hr>'); continue; }

        const heading = trimmed.match(/^(#{2,3})\s+(.*)$/);
        if (heading) {
            closeAll();
            const level = heading[1].length;
            const text = heading[2].trim();
            out.push('<h' + level + ' id="' + slug(text) + '">' + inline(text) +
                '</h' + level + '>');
            continue;
        }

        // A figure: an image alone on a line, optionally captioned by an
        // italic line directly beneath it.
        const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (image) {
            closeAll();
            const next = (lines[i + 1] || '').trim();
            const caption = next.match(/^\*(.+)\*$/);
            if (caption) i++;
            out.push('<figure><img src="' + escapeHTML(image[2]) + '" alt="' +
                escapeHTML(image[1]) + '" loading="lazy">' +
                (caption ? '<figcaption>' + inline(caption[1]) + '</figcaption>' : '') +
                '</figure>');
            continue;
        }

        if (trimmed.startsWith('> ')) {
            closePara();
            closeList();
            quote.push(trimmed.slice(2));
            continue;
        }
        closeQuote();

        const bullet = trimmed.match(/^[-*]\s+(.*)$/);
        const numbered = trimmed.match(/^\d+\.\s+(.*)$/);
        if (bullet || numbered) {
            closePara();
            const want = bullet ? 'ul' : 'ol';
            if (list !== want) { closeList(); out.push('<' + want + '>'); list = want; }
            out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
            continue;
        }

        // A plain line while a list is open CONTINUES the last item rather
        // than starting a paragraph. Prose is hard-wrapped at 80 columns here,
        // so nearly every bullet longer than a few words spans two lines, and
        // without this each of those tails escaped its own bullet.
        if (list && !para.length && out.length) {
            const last = out[out.length - 1];
            if (last.endsWith('</li>')) {
                out[out.length - 1] = last.slice(0, -'</li>'.length) +
                    ' ' + inline(trimmed) + '</li>';
                continue;
            }
        }

        closeList();
        para.push(trimmed);
    }
    closeAll();
    if (fence !== null) {
        out.push('<pre><code>' + escapeHTML(fence.join('\n')) + '</code></pre>');
    }
    return out.join('\n');
}

module.exports = { renderMarkdown, escapeHTML, slug, inline };
