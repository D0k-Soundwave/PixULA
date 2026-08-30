## Getting started

PixULA is a pixel art editor for the ZX Spectrum and the ZX Spectrum Next. It
runs in a browser, from a folder on your own disk, with no install, no server
and no internet connection.

Unzip the folder anywhere you like and double-click `PixULA.html`. That is the
whole setup. Nothing is written outside that folder unless you ask for it, and
nothing you draw leaves your machine.

### The one thing to know first

The Spectrum cannot put any colour anywhere. It stores your picture as a
one-bit-per-pixel bitmap with a separate, much coarser grid of colour laid over
it, and only two colours are available inside each 8 by 8 block. That single
fact shapes how every tool here behaves, and the next chapter is about it.

### Finding your way around

![The PixULA window: menu bar, colour bar, tool rail, colour rail, canvas, panels and status bar](img/workspace.png)

*The whole window.*

- **The menu bar** across the top: files, editing, the view, layers, the
  picture itself, settings and help.
- **The colour bar** under it: drawing modes, mirroring, and the border.
- **The tool rail** down the left, with undo and redo at the top.
- **The colour rail** beside it, holding the palette for the screen mode you
  are in.
- **The canvas** in the middle.
- **The panels** on the right: layers, tool options, transform, the reference
  image, presets.
- **The status bar** along the bottom, showing the screen mode, the draw mode
  and whether touch is drawing.

![The tool rail](img/tool-rail.png)

*The tool rail. Undo and redo sit at the top; the tools below are grouped by
what they do to the picture.*

![The colour rail](img/colour-rail.png)

*The colour rail: ink on the left, paper on the right, with bright and flash
above them.*

![The colour bar](img/colour-bar.png)

*The colour bar: draw modes, mirroring, and the border colour.*

![The side panels](img/panels.png)

*The panels. Each one collapses, so you can keep only the ones you use open.*

![The status bar](img/status-bar.png)

*The status bar, showing the settings that affect what your next stroke will
do.*

The rail carries no labels - there is not room for them beside the buttons.
Hover over any control to see its name, and keep hovering for a sentence
explaining it. On a tablet, press and hold instead; the hold does not also
switch tools.
