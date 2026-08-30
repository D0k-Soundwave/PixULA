## The editors

Four things PixULA makes are not pictures, and each has its own window in the
File menu.

### The Font Editor

A Spectrum character set is 96 or 256 glyphs, each stored as a stack of row
bytes. This edits them one glyph at a time.

![The Font Editor, with the glyph grid on one side and a single character being edited on the other](img/dialog-font-editor.png)

*Pick a character from the grid on the left and edit it on the right.*

Glyphs can be 4, 6 or 8 pixels wide by the cell height. Narrowing a font
discards the right-hand columns permanently, so if you are trying widths out,
work from narrow to wide.

You can start from the ZX ROM font, capture a glyph from the canvas, or load a
`.ch4`, `.ch6`, `.ch8`, `.chr` or `.chx` character set from another Spectrum
tool. Naming a font adds it to your library, and the text tool then offers it
alongside the built-in ROM font.

### The Map Editor

A map is a grid of tiles, where a tile is one 8 by 8 cell - eight bitmap bytes
and one attribute byte. Maps let you build a playfield larger than a single
screen.

![The Map Editor, showing the tile palette and a scrollable map area](img/dialog-map-editor.png)

*Tiles on the left, the map on the right.*

Paint with the left button and erase with the right, or use the fill to replace
a connected area of matching tiles. Tiles come from the current pattern and
colours, or straight from the canvas. You can render a map back onto the canvas,
and one undo reverses the whole thing.

Save as `.zxtm` to carry on working - it is PixULA's own format and keeps
everything - or as `.zxm`, or as assembly, C or raw binary to drop into a
program.

### The Sprite Editor

Next sprites are 16 by 16 pixels with one palette index per pixel, and a sheet
holds up to 64 of them.

![The Sprite Editor, showing a sprite sheet and the editing grid](img/dialog-sprite-editor.png)

*The sheet on one side, the sprite you are drawing on the other.*

Sprite sheets are kept in `.spr` files, not inside your picture, so save the
sheet separately. In the indexed modes you can capture a sprite from the
canvas and stamp one back onto it.

### The Palette Editor

**Image > Edit Palette**, in the modes that have an editable palette. It shows
ULAplus as four palettes of sixteen and the Next palette as rows of nine-bit
colours. Whatever colour you pick is snapped to the nearest value the hardware
can actually store, so what you see is what the machine will show.

Each change is a separate undo step. Palettes can also be loaded and saved
without opening this window - see the colour chapter.

### Tape Blocks

**File > Tape Blocks** opens a `.tap` or `.tzx` and lists what is inside it. Use
it to load one screen out of a tape holding several, or to add your current
picture to a tape as a new block and save the tape back out.

Blocks you have not touched are written back byte for byte, so adding a screen
to someone else's tape leaves the rest of it exactly as it was.
