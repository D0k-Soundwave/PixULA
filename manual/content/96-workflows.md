## Workflows

Some common jobs, start to finish.

### Your first picture

1. Open `PixULA.html`. You start in Standard ULA with a blank 256 by 192
   screen.
2. Switch on the cell grid, next to the zoom controls, so you can see the 8 by
   8 blocks the colour is stored in.
3. Choose an ink colour from the colour rail or with the number keys 1 to 8,
   and a paper colour by right-clicking a swatch.
4. Draw with the **brush**. Left button for ink, right for paper.
5. Zoom with `+` and `-`. Hold the space bar and drag to move around, or use
   the **pan** tool.
6. `Ctrl+Z` undoes. `Ctrl+S` saves a `.pixula` project, which keeps your layers
   and settings as well as the image.

Blocking in your colour areas before the detail generally saves work, because a
colour boundary that does not fall on a cell boundary will keep changing colours
you have already settled.

### Tracing a photograph

1. Open the **Reference** panel and load your photograph. It sits behind your
   artwork at an opacity, position and scale you set, and is never part of the
   picture you save.
2. Draw over it on a normal layer.
3. If the reference ever looks softer than the original, the panel will say so
   and offer a **Locate Photo** button. PixULA links to the file on disk, so if
   the photo moves, only a small preview of it remains.

### Converting a photograph

To let PixULA do the conversion for you:

1. **File > Load**, and choose a `.png`, `.jpg` or `.gif`.
2. The import dialog shows three conversions side by side: sharp, smooth and
   flat. Which one looks best depends entirely on the photograph, so it is worth
   comparing all three each time.
3. Adjust brightness, contrast and scaling until the preview reads well, then
   accept.

In ULAplus and the Next modes the palette is built from your image, so you are
not limited to the sixteen ULA colours. That usually makes a large difference.

### Making a font

1. **File > Font Editor**.
2. Start from the ZX ROM font, or import a `.ch8` or `.chr` set.
3. Select a character and edit it. Widths of 4, 6 and 8 pixels are available,
   but narrowing discards the right-hand columns for good, so work upwards from
   narrow if you are experimenting.
4. Give the font a name to add it to your library.
5. Select the **text** tool. Your font appears in its family list beside the ROM
   one. Type, place the text, and scale or rotate it before committing - it is
   redrawn from the glyphs as you go, so it stays sharp at any size.

### Building a map from tiles

1. Draw the cells you want to use as tiles on the canvas.
2. **File > Map Editor**, and capture them into the tile set.
3. Set the map size and paint. Left button places a tile, right button erases,
   and the fill replaces a connected area of matching tiles.
4. Export as `.zxtm` to keep working on it, or as assembly, C or raw binary to
   use in a program.

### Drawing for the ZX Spectrum Next

1. Pick a Next mode from the Image menu - Layer 2 at 256, 320 or 640 wide, or
   one of the LoRes modes.
2. There is no attribute clash in these modes; every pixel carries its own
   palette index. What you manage is a palette of 256 nine-bit colours,
   edited from **Image > Edit Palette** and saved as `.pal` or `.npl`.
3. Save the picture as `.nxi`, which carries the palette inside it, or `.sl2`
   for the raw bitmap.
4. For sprites, use **File > Sprite Editor** and save the sheet as `.spr`.

You can convert a classic picture into a Next mode and back again. Going back
means fitting every cell to two colours once more, so expect to lose detail in
that direction; PixULA tells you before it does it.

### Getting a picture onto real hardware

- **For an emulator**, save a `.scr`. That is the raw contents of Spectrum
  screen memory, and every emulator reads it. The exact size depends on the
  screen mode - the table in the screen modes chapter gives it for each.
- **For a real machine**, save a `.tap` or `.tzx`. To add your screen to a tape
  that already holds other files, use **File > Tape Blocks**.
- **To show someone without a Spectrum**, save a `.png`. If the picture uses
  flashing cells, save a `.gif` and tick **Animate FLASH cells** - it
  writes a two-frame loop at the hardware's own rate, so the flashing survives.
