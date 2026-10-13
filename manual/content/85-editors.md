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

**Big fonts.** New Big Font... makes a CHX big font set, the kind ZX-Editor Second Edition uses: every character is 8, 16, 24 or 32 pixels wide and tall (width and height are chosen separately), and the editor shows the size where the width list was. Tick Fill with a font to pick any font from the same list the Text tool uses, how much of the character's height the letters cover (as a percentage) and whether they sit to the left, in the centre or to the right. Tick Proportional and each letter is saved only as wide as it needs to be, in whole 8-pixel columns, so an i takes less room than a W; the Space character always keeps at least one column. Fill from font... does the same to a big font you already have, in one step. A big font can only be saved as `.chx` (the other formats and the assembly, C and binary listings hold 8 by 8 characters), cannot capture a cell from the canvas. The Text tool and Type on canvas use it like any saved font, each letter as wide as it is saved. Opening a big `.chx` keeps every character at its own size, and a character the file leaves out stays left out when you save again. The way a character of several 8 by 8 blocks is laid out in the file follows the published description of the format and has not been checked against a file saved by ZX Paintbrush itself, so open a big font made here in ZX Paintbrush before relying on it.

**Shading and undo.** For a font whose characters are a whole number of 8-pixel columns wide, the four Shade buttons shade or unshade one column at a time on the left or right of the character you are editing. A shaded column is drawn hatched and is not saved: a `.chx` file holds that character narrower, and a character shaded all the way across is left out of the file. The dots under the shading are kept in the editor, so unshading brings them back, but they are not in the file. Shade all to fit does this for every character at once, shading the empty columns on each side of its dots, keeping one column for Space and leaving other blank characters out. The Space character always keeps at least one column, because a `.chx` file must contain it. After a `.chx` export the status line says how many characters were saved narrower, how many were left out and how many had dots under the shading. The Font Editor also has Undo and Redo (the two buttons, or Ctrl+Z and Ctrl+Y): one stroke on the editing surface is one step, and so is each button, New Big Font, Fill from font, Load ROM Font or import. Typing in the font name box is not part of it.

**All characters.** The All characters button swaps the one-character editor for a map of the whole font, every character side by side, 16 across, which you draw on with the same Brush, Eraser, Line and Fill, so a stroke can run from one character into the next. One stroke is one change and one Undo step, and Fill stays inside the character you click. The Shade tool shades or unshades the 8-pixel column you click, from the nearer edge of its character; shaded columns are hatched. The Move tool drags the map around, which is how to scroll it with a finger, because the map otherwise keeps every touch for drawing. The minus, Fit and plus buttons change the zoom in whole steps. In the map and in the character grid the arrow keys, Home and End move from character to character, and typing a character chooses it. Drawing pixels with the keyboard alone is not possible.

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
