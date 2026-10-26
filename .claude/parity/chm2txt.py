# Converts the decompiled ZX Paintbrush help (untrusted data) to plain text.
# Usage: python -I chm2txt.py <chm_dir> <out_dir>
import html, os, re, sys
from html.parser import HTMLParser

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        if tag in ('p', 'br', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'table'):
            self.parts.append('\n')
        if tag in ('td', 'th'):
            self.parts.append(' | ')
        if tag == 'img':
            alt = dict(attrs).get('alt')
            if alt:
                self.parts.append('[img:' + alt + ']')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def toc(path):
    # .hhc sitemap: nested <UL>/<LI><OBJECT><param name="Name" value=...><param name="Local" ...>
    text = open(path, encoding='latin-1').read()
    depth, lines = 0, []
    for m in re.finditer(r'<UL>|</UL>|<param name="Name" value="([^"]*)">|<param name="Local" value="([^"]*)">', text, re.I):
        tok = m.group(0).upper()
        if tok == '<UL>':
            depth += 1
        elif tok == '</UL>':
            depth -= 1
        elif m.group(1) is not None:
            lines.append('  ' * (depth - 1) + html.unescape(m.group(1)))
        elif m.group(2) is not None and lines:
            lines[-1] += '   (' + m.group(2) + ')'
    return '\n'.join(lines)


for root, _, files in os.walk(src):
    for f in files:
        p = os.path.join(root, f)
        if f.lower().endswith('.hhc'):
            open(os.path.join(out, '_toc.txt'), 'w', encoding='utf-8').write(toc(p))
        elif f.lower().endswith('.htm'):
            raw = open(p, encoding='latin-1').read()
            t = Text()
            t.feed(raw)
            s = html.unescape(''.join(t.parts))
            s = re.sub(r'[ \t\r\f\v]+', ' ', s)
            s = re.sub(r'\n\s*\n+', '\n', s).strip()
            open(os.path.join(out, f[:-4] + '.txt'), 'w', encoding='utf-8').write(s + '\n')
print('done')
