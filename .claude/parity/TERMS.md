# ZX terms - ink and paper pixels, Ink/Paper/Bright/Flash attributes

Owner instruction, 2026-10-19, verbatim: "Ink is a Drawn Pixel, Paper is a Clear Pixel, but this
also applies to the colours chosen for these, the attribute and the state of the Pixel is one and
the same."

## The rule

In every user-facing string, in every language:

- A set pixel is an **ink pixel**; a clear pixel is a **paper pixel**. "The pixels" is the bitmap.
- The cell's colours are its **attributes**: **Ink**, **Paper**, **Bright** and **Flash**, with a
  capital letter when they name the attribute (Ink, Paper, Bright, Flash). The BASIC spellings
  INK, PAPER, BRIGHT, FLASH already in the text stay as they are.
- Never "dots" for pixels, and never "colours" where attributes are meant. "Colours" stays where
  real colours are meant: palette entries, the 15 standard colours, "two colours per cell", grid
  colours, the colour rail and colour bar (names of screen areas).
- Names that are not pixel states stay: dither names such as "Cluster dot", line styles
  "Dotted", "Dash-dot", "Dash-dot-dot".
- Change only wording: never keys, code behaviour, {placeholders} or plural categories.

Use the language's own established ZX Spectrum words for ink pixel / paper pixel and for the
Ink, Paper, Bright and Flash attributes, and use them the same way in every string and in the
manual. Where a language capitalises differently, keep the attribute names visibly marked as
names (as the existing color.ink / color.paper / color.bright / color.flash translations do).

Examples agreed with the owner:

| Old | New |
|---|---|
| Sets dots and gives the cell your ink, paper, bright and flash | Draws ink pixels and gives the cell your Ink, Paper, Bright and Flash |
| The right button clears dots | The right button draws paper pixels |
| Dots and colours / Dots only (find modes) | Pixels and attributes / Pixels only |
| Image > Invert Dots | Image > Invert Pixels (ink pixels become paper pixels and paper pixels become ink) |
| Invert Dots and Colours | Invert Pixels and Attributes |
| Clear dots (stamp option) | Paper pixels |
| Scatter dots (Spray) | Scatter ink pixels |

## Keys changed in js/i18n/en.js (107)

Every key below needs its translation in all 12 other locales brought into line with the new
English. The {placeholders} are unchanged.

| Key | Old English | New English |
|---|---|---|
| `menu.image.invert` | Invert Dots | Invert Pixels |
| `menu.image.attrNoCells` | This screen mode has no cell colours. | This screen mode has no cell attributes. |
| `opt.shadowDots` | Shadow dots | Shadow pixels |
| `opt.outlineDots` | Contour dots | Contour pixels |
| `mapel.mode.exact` | Dots and colours | Pixels and attributes |
| `mapel.mode.dots` | Dots only | Pixels only |
| `mapel.badMode` | Finding needs 8x8 colour cells: Standard, ULAplus, ULANext, GigaScreen or Timex hi-res. | Finding needs 8x8 attribute cells: Standard, ULAplus, ULANext, GigaScreen or Timex hi-res. |
| `import.dither.hint` | How the Smooth conversion (and Sharp, once you have chosen a method here) turns shades into dots. The default is the importer's own Floyd-Steinberg. | How the Smooth conversion (and Sharp, once you have chosen a method here) turns shades into ink and paper pixels. The default is the importer's own Floyd-Steinberg. |
| `help.axisLock` | Hold while drawing: keep to a horizontal (X) or vertical (Y) line. Tap X: swap ink and paper | Hold while drawing: keep to a horizontal (X) or vertical (Y) line. Tap X: swap Ink and Paper |
| `menu.image.invertPaletteNext` | The palette inverter is for ULAplus palettes; the Next modes keep ink and paper in different parts of the palette. | The palette inverter is for ULAplus palettes; the Next modes keep Ink and Paper in different parts of the palette. |
| `menu.image.dots` | Dots | Pixels |
| `menu.image.dotsInvert` | Invert Dots and Colours | Invert Pixels and Attributes |
| `menu.image.dotsNoCells` | Invert Dots and Colours needs cell colours, which this screen mode does not have. | Invert Pixels and Attributes needs cell attributes, which this screen mode does not have. |
| `menu.image.dotsStampAttrs` | This stamp keeps its own colours, so it cannot be flipped here. | This stamp keeps its own attributes, so it cannot be flipped here. |
| `manual.col.dots` | Dots | Pixels |
| `manual.col.colours` | Colours it sets | Attributes it sets |
| `manual.family.density.desc` | An even ramp from light to dark. Each tile is named for the proportion of ink it actually contains. | An even ramp from light to dark. Each tile is named for the proportion of ink pixels it actually contains. |
| `manual.family.halftone.desc` | The same range of greys, with the ink gathered into clusters rather than spread evenly. | The same range of greys, with the ink pixels gathered into clusters rather than spread evenly. |
| `tool.eraser.hint` | Clear pixels back to the paper colour | Turn ink pixels back into paper pixels |
| `miniTool.brush.hint` | Click or drag to set pixels | Click or drag to draw ink pixels |
| `tool.eyedropper.hint` | Take the colour under the cursor as the current ink or paper | Take the colour under the cursor as the current Ink or Paper |
| `tool.gradient.hint` | Fill a region with a dithered ramp from ink to paper | Fill a region with a dithered ramp from Ink to Paper |
| `transform.stampColours` | Colours | Attributes |
| `transform.stampColours.hint` | Whether the stamp places its own colours, or only its dots in the colours on the attribute bar | Whether the stamp places its own attributes, or only its pixels in the attributes on the attribute bar |
| `transform.stampColours.own` | Own colours | Own attributes |
| `transform.stampColours.geometryHint` | This stamp's colour cells are a different size from this screen mode's, so it can only place its dots | This stamp's attribute cells are a different size from this screen mode's, so it can only place its pixels |
| `transform.showThrough.ink.hint` | The colour already on the page shows through instead of the stamp's ink | The Ink already on the page shows through instead of the stamp's |
| `transform.showThrough.paper.hint` | The colour already on the page shows through instead of the stamp's paper | The Paper already on the page shows through instead of the stamp's |
| `transform.clearDots` | Clear dots | Paper pixels |
| `transform.clearDots.hint` | What the stamp's clear dots do: leave the picture under them alone, or clear it too | What the stamp's paper pixels do: leave the picture under them alone, or make it paper pixels too |
| `transform.stampConvert.hint` | Drops the stamp's colours for good and keeps its dots. Pixels only keeps the colours so you can switch back | Drops the stamp's attributes for good and keeps its pixels. Pixels only keeps the attributes so you can switch back |
| `transform.colouredIgnoresXor` | A stamp with its own colours ignores XOR | A stamp with its own attributes ignores XOR |
| `transform.colouredNoReshape` | A stamp with its own colours cannot be scaled, rotated, bent, flipped, inverted or outlined; switch it to Pixels only first | A stamp with its own attributes cannot be scaled, rotated, bent, flipped, inverted or outlined; switch it to Pixels only first |
| `transform.invert.hint` | Inverts every pixel: set becomes clear and clear becomes set | Inverts every pixel: ink pixels become paper pixels and paper pixels become ink |
| `transform.outline.hint` | Draws an outline around the selection or layer's set pixels | Draws an outline around the selection or layer's ink pixels |
| `transform.shiftMove.hint` | Whether Shift moves dots, cell colours, or both together | Whether Shift moves pixels, cell attributes, or both together |
| `transform.shiftMove.both` | Dots and colours | Pixels and attributes |
| `transform.shiftMove.dots` | Dots only | Pixels only |
| `transform.shiftMove.colours` | Colours only | Attributes only |
| `transform.shiftMove.cellHint` | Dots and colours move a whole cell at a time | Pixels and attributes move a whole cell at a time |
| `dm.normal.hint` | Sets dots and gives the cell your ink, paper, bright and flash. The right button clears dots and gives the cell the same colours | Draws ink pixels and gives the cell your Ink, Paper, Bright and Flash. The right button draws paper pixels and gives the cell the same attributes |
| `dm.ink.hint` | Gives every cell the tool touches your ink colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own | Gives every cell the tool touches your Ink, Bright and Flash without touching a pixel - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own |
| `dm.paper.hint` | Gives every cell the tool touches your paper colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own | Gives every cell the tool touches your Paper, Bright and Flash without touching a pixel - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own |
| `dm.pixelsOnly.hint` | Sets dots and leaves the cell's colours alone. The right button clears dots, also leaving the colours alone | Draws ink pixels and leaves the cell's attributes alone. The right button draws paper pixels, also leaving the attributes alone |
| `dm.xor.hint` | Flips each dot it touches, once per stroke, and gives the cell your colours. Two strokes over the same dots cancel each other out. Both buttons do the same | Flips each pixel it touches, ink to paper and paper to ink, once per stroke, and gives the cell your attributes. Two strokes over the same pixels cancel each other out. Both buttons do the same |
| `dm.xorPixel.hint` | Like XOR / Over, but a stroke that comes back over its own path flips those dots again, so it cancels where it crosses itself. Both buttons do the same | Like XOR / Over, but a stroke that comes back over its own path flips those pixels again, so it cancels where it crosses itself. Both buttons do the same |
| `dm.fx.dotsSet` | Sets them | Draws ink pixels |
| `dm.fx.coloursAll` | Ink, paper, bright and flash | Ink, Paper, Bright and Flash |
| `dm.fx.coloursInk` | Ink, bright and flash | Ink, Bright and Flash |
| `dm.fx.coloursPaper` | Paper, bright and flash | Paper, Bright and Flash |
| `dm.fx.rightNormal` | Clears dots, sets the same colours | Draws paper pixels, sets the same attributes |
| `dm.fx.rightPixels` | Clears dots, colours untouched | Draws paper pixels, attributes untouched |
| `attr.cycleInkPrev.hint` | Shift INK down by one on written cells only (empty cells keep their paper) | Shift INK down by one on written cells only (empty cells keep their Paper) |
| `attr.cycleInkNext.hint` | Shift INK up by one on written cells only (empty cells keep their paper) | Shift INK up by one on written cells only (empty cells keep their Paper) |
| `attr.cyclePaperPrev.hint` | Shift PAPER down by one on written cells only (empty cells keep their paper) | Shift PAPER down by one on written cells only (empty cells keep their Paper) |
| `attr.cyclePaperNext.hint` | Shift PAPER up by one on written cells only (empty cells keep their paper) | Shift PAPER up by one on written cells only (empty cells keep their Paper) |
| `attr.colourOps` | Colour Ops | Attribute Ops |
| `attr.transpose.hint` | Swaps the ink and paper colours of each whole cell you click or drag over, ignoring brush size and Mirror. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop | Swaps the Ink and Paper of each whole cell you click or drag over, ignoring brush size and Mirror. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop |
| `attr.apply.hint` | Gives each whole cell you click or drag over your ink, paper, bright and flash, without touching a dot and ignoring brush size and Mirror. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop. With Bright or Flash on "use existing", each cell keeps its own | Gives each whole cell you click or drag over your Ink, Paper, Bright and Flash, without touching a pixel and ignoring brush size and Mirror. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop. With Bright or Flash on "use existing", each cell keeps its own |
| `color.swap` | Swap Colours | Swap Ink and Paper |
| `clut.brightTransparent.hint` | Keep each cell's own bright instead of writing the Bright setting. Click Bright to write a value again | Keep each cell's own Bright instead of writing the Bright setting. Click Bright to write a value again |
| `clut.flashTransparent.hint` | Keep each cell's own flash instead of writing the Flash setting. Click Flash to write a value again | Keep each cell's own Flash instead of writing the Flash setting. Click Flash to write a value again |
| `grid.cellGrid.hint` | Shows a line around every attribute cell, the unit ink and paper are shared across | Shows a line around every attribute cell, the unit Ink and Paper are shared across |
| `view.coloursOff` | Colours Off | Attributes Off |
| `view.display.noDots` | Every pixel has its own colour in this screen mode, so there are no dots to show. | Every pixel has its own colour in this screen mode, so there are no ink and paper pixels to show. |
| `view.display.noCells` | This screen mode has no colour cells. | This screen mode has no attribute cells. |
| `pref.inverseHint` | The left button clears dots and the right button sets them, like BASIC's INVERSE 1. Shift+I switches it from the keyboard, and the status bar says when it is on. It changes nothing in the Ink Recolour, Paper Recolour and XOR draw modes. | The left button draws paper pixels and the right button draws ink pixels, like BASIC's INVERSE 1. Shift+I switches it from the keyboard, and the status bar says when it is on. It changes nothing in the Ink Recolour, Paper Recolour and XOR draw modes. |
| `attr.copy` | Copy colours | Copy attributes |
| `attr.copy.hint` | Click a cell to pick up the colours it shows, then drag over other cells to give them those colours. Dots stay as they are and the colour rail is not changed. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop | Click a cell to pick up the attributes it shows, then drag over other cells to give them those attributes. Pixels stay as they are and the colour rail is not changed. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop |
| `attr.invertDots` | Invert dots | Invert pixels |
| `attr.invertDots.hint` | Inverts the dots of each whole cell you click or drag over - set dots clear, clear dots set - and leaves the colours. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop | Inverts the pixels of each whole cell you click or drag over - ink pixels become paper pixels and paper pixels become ink - and leaves the attributes. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop |
| `attr.invertBoth` | Invert dots and colours | Invert pixels and attributes |
| `attr.invertBoth.hint` | Inverts the dots and swaps ink and paper in each whole cell you click or drag over, so the cell looks the same - for tidying an import. Not in ULAplus or ULANext. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop | Inverts the pixels and swaps Ink and Paper in each whole cell you click or drag over, so the cell looks the same - for tidying an import. Not in ULAplus or ULANext. Right-click the picture, choose None in the cell-tool list, or pick a tool or a draw mode, to stop |
| `status.attrCopy` | Copy colours is on | Copy attributes is on |
| `status.attrInvertDots` | Invert dots is on | Invert pixels is on |
| `status.attrInvertBoth` | Invert dots and colours is on | Invert pixels and attributes is on |
| `a11y.attrModeCopy` | Copy colours on | Copy attributes on |
| `a11y.attrModeInvertDots` | Invert dots on | Invert pixels on |
| `a11y.attrModeInvertBoth` | Invert dots and colours on | Invert pixels and attributes on |
| `menu.image.dotsPalette` | Invert Dots and Colours needs the fixed 16 colours: in ULAplus and ULANext, swapping ink and paper would change how the picture looks. | Invert Pixels and Attributes needs the fixed 16 colours: in ULAplus and ULANext, swapping Ink and Paper would change how the picture looks. |
| `opt.eraserColours` | Colours | Attributes |
| `opt.colourCore` | Colour core | Attribute core |
| `manual.showIf.cellAttributes` | the screen mode has colour cells | the screen mode has attribute cells |
| `dm.inverse.hint` | Swaps the mouse buttons: the left button clears dots and the right button sets them | Swaps the mouse buttons: the left button draws paper pixels and the right button draws ink pixels |
| `readout.attrFixed` | Attribute {dec} ({hex}): ink {ink}, paper {paper}, bright {bright}, flash {flash} | Attribute {dec} ({hex}): Ink {ink}, Paper {paper}, Bright {bright}, Flash {flash} |
| `readout.attrClut` | Attribute {dec} ({hex}): CLUT {clut}, ink {ink}, paper {paper} | Attribute {dec} ({hex}): CLUT {clut}, Ink {ink}, Paper {paper} |
| `readout.attrNext` | Attribute {dec} ({hex}): ink entry {ink}, paper entry {paper} | Attribute {dec} ({hex}): Ink entry {ink}, Paper entry {paper} |
| `readout.noCells` | No colour cells in this mode | No attribute cells in this mode |
| `pen.act.ink` | Draw ink | Draw ink pixels |
| `pen.act.paper` | Draw paper (erase) | Draw paper pixels (erase) |
| `pen.act.eyedropperPaper` | Eyedropper (paper) | Eyedropper (Paper) |
| `tool.spray.hint` | Scatter dots that build up while you hold, for soft edges and texture | Scatter ink pixels that build up while you hold, for soft edges and texture |
| `font.op.invert.hint` | Swaps every set pixel in the glyph for an unset one and back | Turns every ink pixel in the glyph into a paper pixel and every paper pixel into ink |
| `plural.fontHiddenInk` | one: {n} character has dots under the shading that were not saved \| other: {n} characters have dots under the shading that were not saved | one: {n} character has ink pixels under the shading that were not saved \| other: {n} characters have ink pixels under the shading that were not saved |
| `giga.inkColoursB` | Screen B ink colours | Screen B Ink colours |
| `giga.paperColoursB` | Screen B paper colours | Screen B Paper colours |
| `giga.slot.inkInk` | Ink on screen A, ink on screen B | Ink on screen A, Ink on screen B |
| `giga.slot.inkPaper` | Ink on screen A, paper on screen B | Ink on screen A, Paper on screen B |
| `giga.slot.paperInk` | Paper on screen A, ink on screen B | Paper on screen A, Ink on screen B |
| `giga.slot.paperPaper` | Paper on screen A, paper on screen B | Paper on screen A, Paper on screen B |
| `mode.needsClassicPixels` | This works in the classic ink/paper modes only - the current mode uses indexed pixels. | This works in the classic Ink/Paper modes only - the current mode uses indexed pixels. |
| `mode.info.cells` | {cw}×{ch} attribute cells (1 ink + 1 paper each) | {cw}×{ch} attribute cells (1 Ink + 1 Paper each) |
| `mode.info.paletteSchemes` | Palette: one of 8 fixed ink/paper schemes for the whole screen - not editable. | Palette: one of 8 fixed Ink/Paper schemes for the whole screen - not editable. |
| `mode.desc.standardUla` | The stock ZX Spectrum 48K/128K display. The bitmap comes first, in the ULA thirds order, then one attribute byte per cell (FLASH, BRIGHT, 3-bit paper, 3-bit ink). Two colours per cell is what causes attribute clash. | The stock ZX Spectrum 48K/128K display. The bitmap comes first, in the ULA thirds order, then one attribute byte per cell (FLASH, BRIGHT, 3-bit PAPER, 3-bit INK). Two colours per cell is what causes attribute clash. |
| `mode.desc.multicolor8x2` | Multicolour 8×2: a fresh ink/paper pair every 2 scanlines, beam-raced by machine code on a real 48K/128K. Twice the vertical colour detail of 8×4, and twice the CPU cost. | Multicolour 8×2: a fresh Ink/Paper pair every 2 scanlines, beam-raced by machine code on a real 48K/128K. Twice the vertical colour detail of 8×4, and twice the CPU cost. |
| `mode.desc.ulaPlus8x1` | Timex 8×1 hi-colour cells plus the ULAplus palette: an ink/paper pair per scanline, each drawn from the 64-entry editable palette. Emulator and Next territory - the file carries the bitmap, the per-line attributes and the 64 palette registers. | Timex 8×1 hi-colour cells plus the ULAplus palette: an Ink/Paper pair per scanline, each drawn from the 64-entry editable palette. Emulator and Next territory - the file carries the bitmap, the per-line attributes and the 64 palette registers. |
| `mode.desc.ulanext` | Spectrum Next ULANext: classic 8×8 cells, but ink and paper index the 256-entry Next palette instead of the fixed ULA colours. As on the hardware, BRIGHT and FLASH are not effects here: ink always comes from palette entries 0-7, and the two bits choose one of four paper banks (entries 128-159), so nothing flashes. | Spectrum Next ULANext: classic 8×8 cells, but Ink and Paper index the 256-entry Next palette instead of the fixed ULA colours. As on the hardware, BRIGHT and FLASH are not effects here: Ink always comes from palette entries 0-7, and the two bits choose one of four Paper banks (entries 128-159), so nothing flashes. |

## English-only text changed (no key)

| Where | Old | New |
|---|---|---|
| js/core/input-handler.js, undo step name of the Invert pixels cell tool | Invert Dots | Invert Pixels |
| js/core/input-handler.js, undo step name of the Invert pixels and attributes cell tool | Invert Dots and Colours | Invert Pixels and Attributes |

## Manual

The English chapters in manual/content/*.md were reworded to the same rule (headings included:
"Seeing the dots" is now "Seeing the pixels" in 20-attribute-clash.md, and "Dots" is now
"Pixels" in 40-colour.md). Each translation in manual/content/<code>/ needs the same sentences
changed; `git diff` of the English chapters in the commit that added this file shows exactly
which. No {{tables}} or pictures moved.
