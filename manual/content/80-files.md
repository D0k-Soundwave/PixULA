## Files

There are two different things you can save, and it matters which one you
reach for.

**A project** keeps your work as you left it: every layer, the palette, the
screen mode, your tools and their settings, the reference image and where you
were looking. This is a `.pixula` file, written by **File > Save Project**, and
it is what to use while a picture is still in progress.

A project that holds an animation is saved in a newer way that keeps each frame packed once, so it does not open in PixULA 0.1.0-beta.2 or earlier. A project without an animation opens in every version.

**A picture** is one flattened screen in a format another program understands -
a `.scr` for an emulator, a `.png` to show someone, a `.tap` to load on real
hardware. **File > Save Image As** writes those. They hold the image and nothing
else, which is what you want when handing the result on, and not what you want
if you intend to keep working on it.

### Importing a picture

Opening a photo or other picture (PNG, JPG, GIF) shows three conversions side by side - Sharp, Smooth and Flat - and you click the one you like. Smooth is the one that turns shades into ink and paper pixels, and the **Dither** list under the previews chooses how: Floyd-Steinberg is the importer's own and is the default, and the list also offers the 30 other methods of ZX Paintbrush - thresholds, error diffusion, Bayer matrices, cluster dots and supercells. Choosing a method redraws Smooth, and Sharp too once you have chosen one (Flat never dithers). Ordered methods carry on across attribute cells, so a pattern runs over the whole picture; error diffusion stays inside each cell, because each cell has its own two colours. In the Layer 2 and LoRes modes the list works too: every pixel is placed between its two nearest palette colours, and the whole picture is one block, so error diffusion runs across all of it.

The **Placement** controls beside them set where the picture sits on the screen - the same controls as the Reference panel. **Fit** shows all of it with black bars, **Fill** covers the screen and cuts off the overhang, **Stretch** pulls it to the exact size of the screen whatever its shape, and **Center** puts it back in the middle. **Scale** zooms it about its centre (below zero it is mirrored), **Rotation** turns it, the **Offset** fields and the direction pad move it a pixel at a time, and **Flip H** and **Flip V** mirror it. The previews follow every change, and whatever the picture leaves uncovered becomes black. If a reference image is loaded, **Use reference placement** puts the import exactly where the reference sits: line a photo up over your drawing as a reference first, then import it in that spot.

### Saving part of a picture

**File > Save Selection As** lists the same formats as Save Image As, each open only if the selection suits it. PNG, BMP and JPEG take any rectangle. ZXP, SEV, ZED, ASM, C, BIN and ATR take whole attribute cells: the selection is first fitted to cells and the status bar says so. ColorTiles take whole 16x16 tiles. The formats that are a dump of one whole screen (SCR, tapes, MLT and the like) are open only when the selection is the whole screen. ASM, C, BIN and ATR write the part row by row: the bitmap as a block of bytes a row, top to bottom, and the attributes one byte a cell; they do this in the classic, multicolor and ULAplus modes. A freehand or ellipse selection saves its bounding rectangle. A format that is shut says why when you point at it. Save Image As saves the whole picture and ignores the selection.

### A new picture from a selection

**Edit > New Picture from Selection** turns the selection into the whole picture. The selection is fitted to whole cells first. It asks before it does anything, and Ctrl+Z gives the old picture back. Every layer is kept and cut down to that block, which moves to the top left; the rest is empty, and the background there is white Paper. The screen mode stays the same and the picture becomes untitled, so the next Save asks for a name.

### Autosave and backups

PixULA can save your work into the browser's own storage every few minutes, and
offer it back if a session ends badly. It is off until you choose how often:
set **Autosave every (minutes, 0 = off)** in Preferences, under General.

You can also choose a folder on disk, and each autosave will write a numbered
version into it - `picture V1.pixula`, `picture V2.pixula`, and so on. The
numbering is read back from the folder each time, so reopening a picture
continues the sequence instead of starting again at V1, and two sessions on the
same picture share one set of versions. Set how many to keep in Preferences; the
default is 20.

One thing to expect. A browser will not re-open a folder you chose in an earlier
session without you confirming it, and the autosave timer cannot ask on your
behalf. So the first backup after a reload stops and waits for you. Preferences
has a **Resume Backups** button, and pressing it is the confirmation the browser
is waiting for.

{{formats}}
