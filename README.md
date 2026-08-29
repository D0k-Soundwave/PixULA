<div align="center">

# PixULA

**A modern, browser-based pixel art tool for creating classic ZX Spectrum graphics.**

![License: GPL v3](https://img.shields.io/badge/license-GPL%20v3-blue?style=for-the-badge)
![Status: Alpha](https://img.shields.io/badge/status-alpha-orange?style=for-the-badge)
![Made with](https://img.shields.io/badge/made%20with-HTML%2FCSS%2FJS-yellow?style=for-the-badge)
![Runs in](https://img.shields.io/badge/runs%20in-browser-brightgreen?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-any%20OS-lightgrey?style=for-the-badge)

</div>

---

PixULA gets its name from the ZX Spectrum's ULA (Uncommitted Logic Array) — the chip famously responsible for the platform's iconic "attribute clash," where any 8×8 pixel block is limited to just two colours. PixULA doesn't hide that constraint; it embraces it, live, as you draw.

## ![#0969DA](https://img.shields.io/badge/-0969DA?style=flat-square) What is PixULA?

PixULA is a free, open, browser-based image editor built specifically around the ZX Spectrum's screen formats and colour limitations — plus a wide range of extensions used by the modern ZX Spectrum Next scene. It runs entirely locally in any reasonably modern browser, with no installation, no server, and no dependency on a specific operating system.

Inspired by the much-loved **ZX Paintbrush** by Claus Jahn, PixULA set out to be a simplified tool that keeps the spirit of that classic software while working anywhere a browser does. It's aimed at anyone who wants to create Spectrum-style art: retro hobbyists, ZX Spectrum Next demo-scene developers, classrooms teaching the history of computer graphics, pixel artists exploring retro constraints, or just someone who wants to show their kids what graphics used to look like.

> [!TIP]
> Want to show your kids what graphics used to be like? Use PixULA. Want to let a classroom have a go at retro art? Use PixULA. Want to doodle on the train? You're crazy... but PixULA works there too.

## ![#8250DF](https://img.shields.io/badge/-8250DF?style=flat-square) Why I made it

I've always loved ZX Paintbrush and wondered whether I could build something with some of its best features that would work anywhere, on any semi-modern machine, without a dedicated install. PixULA was built entirely in HTML, CSS, and JavaScript using **Claude Code**, which made it possible to develop a serious tool without having to spend time re-learning, and keep it a spare time "Hobby" project.

The project is released under the **GPL 3.0** license on purpose. Most ZX Spectrum and pixel art tools out there are closed works that nobody else can extend, improve, or adapt. PixULA is explicitly the opposite: if you think a feature would be nice, add it. If something happens to me, I hope someone else picks the project up and keeps building on it. That openness — more than any single feature — is what I'm proudest of.

## ![#1A7F37](https://img.shields.io/badge/-1A7F37?style=flat-square) Features

- **Live attribute-clash feedback** — colour clash is enforced and shown as you draw, based on the constraints of the screen mode you've selected, not applied after the fact.
- **Extensive screen mode support**, including:
  - Standard ULA
  - Multicolor 8×4, 8×2, and 8×1
  - ULAplus and ULAplus 8×1 (Timex)
  - Timex Hi-res (512×192)
  - GigaScreen
  - ULANext
  - ZX Spectrum Next: Layer 2 (256×192, 320×256, 640×256 16-colour), LoRes (128×96), and Radastan (128×96, 16-colour)
- Layering, with multiple tool and reference image saving
- Raster text and WordArt tools
- Screen transform tools
- A dedicated project format (`.pixula`) that preserves the entire working document — every layer, palette, tool state, and reference image — separate from flattened image exports

## ![#BF8700](https://img.shields.io/badge/-BF8700?style=flat-square) Supported file formats

PixULA can save images in 23 formats via **File → Save Image As** (or the `Ctrl+E` picker). Available formats depend on the active screen mode.

| Category | Formats |
|---|---|
| ZX Spectrum classic | `.scr` `.zxp` `.tap` `.tzx` |
| Multicolor / Timex / GigaScreen | `.mlt` `.ifl` `.hrg` `.img` |
| ZX Spectrum Next | `.nxi` `.sl2` `.slr` `.ctile` |
| Standard images | `.png` `.bmp` `.jpg` |
| Other ZX-family formats | `.zed` `.sev` |
| Palette | `.pal` `.npl` |
| Developer/source dumps | `.asm` `.c` `.bin` `.atr` |

Full working projects (layers, palette, tools, references) are saved separately via **File → Save Project** as `.pixula`.

## ![#2DA44E](https://img.shields.io/badge/-2DA44E?style=flat-square) Download

**[Download the latest release](https://github.com/D0k-Soundwave/PixULA/releases/latest)**, unzip it anywhere, and double-click `PixULA.html`.

That is the whole installation. It runs in your browser from the folder you unzipped it into - no install, no server, no internet connection, and nothing you draw ever leaves your machine. Any reasonably modern browser will do.

Prefer to run from source? Clone the repository and open `index.html` the same way; it is the same application, and the download is simply that folder packaged up.

## ![#D1242F](https://img.shields.io/badge/-D1242F?style=flat-square) Status

> [!IMPORTANT]
> PixULA is currently a **working alpha**. You can download it and run it entirely locally in any reasonably modern browser — there are a couple of CORS prompts to accept on first run, but no install required. It's in active use, but feedback is genuinely needed to catch anything that's been missed.

## ![#CF222E](https://img.shields.io/badge/-CF222E?style=flat-square) Roadmap

- [ ] **SAM Coupé support** — additional screen modes and native file formats for the SAM Coupé are planned for a future release.

## ![#1B7C83](https://img.shields.io/badge/-1B7C83?style=flat-square) Getting involved

- **Repository:** [github.com/D0k-Soundwave/PixULA](https://github.com/D0k-Soundwave/PixULA/)
- **Report a bug or suggest a feature:** open a [GitHub Issue](https://github.com/D0k-Soundwave/PixULA/issues), or email [D0k@Soundwave.team](mailto:D0k@Soundwave.team)
- **License:** GPL 3.0 — you're explicitly encouraged to fork, extend, adapt, and build on this project

> [!NOTE]
> This is a solo, community-minded project. If you improve it, extend it, or spot something broken, that's exactly what it's here for.

## ![#57606A](https://img.shields.io/badge/-57606A?style=flat-square) License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for details.
