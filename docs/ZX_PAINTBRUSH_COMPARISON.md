# PixULA vs ZX Paintbrush - function comparison and parity gaps

Every function in ZX Paintbrush, set against what PixULA does. Part 1 covers the
attribute functions (ink, paper, bright, flash) in detail; Part 2 covers the rest,
toolbar by toolbar. Part 3 is the backlog: every row below parity, in batches.

**ZX Paintbrush side:** the help file installed with the program
(`C:\Program Files (x86)\ZX-Paintbrush\ZXPaintbrush.chm`, file version 2.6.4.0,
July 2017), all 252 pages read on 2026-10-08. A web search the same day found no
release newer than 2.6.4; the author's site still lists 2.6.1
([ZX-Modules](https://zx-modules.jimdofree.com/zx-modules-start/zx-paintbrush/),
[itch.io portable build](https://sourcesolutions.itch.io/zx-paintbrush)).

**PixULA side:** the code and the generated manual on branch `drawing-modes-tidy`,
2026-10-08. Where a row says "No", the code was searched for it. Rows that could not
be confirmed either way were left out rather than guessed.

This replaces the 2026-07-03 version of this file, which was built from web
listings and had gone stale (it described an "Attributes only" draw mode and a
"transparent" draw mode that no longer exist, and GigaScreen support that ZX
Paintbrush never had).

**Totals** [M, counted from the tables below by .claude/parity/count-verdicts.js, 2026-10-21, after
the five features of 2026-10-19 to 2026-10-21 (Attributes Only, Undo steps, gradient polygon styles,
elliptic Ring, coloured CHX characters) and their independent checks]: 114 functions; PixULA is below
parity on 29 (6 missing, 23 partial), level on 75, ahead on 8, and 2 do not apply to a browser app.
The checks moved no verdict: the count is the same as on 2026-10-20. Across the five features the
count below parity went from 34 to 29 [C, 34 - 29 = 5, one row each].
Before the checks [M, same counter, 2026-10-20, after coloured CHX characters were built] it was 29 below
parity (6 missing, 23 partial), level on 75. Coloured CHX characters (kept,
edited and typed) took CHX big fonts back to Same, with the caveat that the coloured layout is not checked
against a ZX Paintbrush file.
Before them [M, same counter, 2026-10-20, after the elliptic, rotatable Ring] it was 30 below parity (6 missing,
24 partial), level on 74; the elliptic Ring took Ring back to Same.
Before it [M, same counter, 2026-10-20, after the gradient polygon styles, Rotation and Zoom] it was 31 below
parity (6 missing, 25 partial), level on 73; the polygon styles, Rotation and Zoom took
Gradient fills and custom gradient back to Same.
Before them [M, same counter, 2026-10-19, after the Undo steps setting] it was 32 below parity (6 missing,
26 partial), level on 72; the Undo steps setting took Undo and redo back to Same.
Before that [M, same counter, 2026-10-19, after the Attributes Only draw mode] it was 33 below parity (6 missing,
27 partial), level on 71; Attributes Only took Drawing (pixels) switch back to Same.
Before that [M, same counter, 2026-10-19, after the 2026-10-18 audit corrections] it was 34 below parity (6 missing,
28 partial), level on 70. The audit found seven rows judged too kindly and moved them to
Partial: Drawing (pixels) switch, Ring, Gradient fills, CHX big fonts, Paste Windows graphic and Undo (from Same),
and BMP, GIF, JPG, PNG (from PixULA further).
Before the audit [M, same counter, 2026-10-14, after Batch 11] it was 27 below parity (6 missing, 21 partial),
level on 76, ahead on 9, 2 not applicable; that day the counter learned to read a verdict that has a note after it, so rows such as
"Same in Standard ULA" or "Missing (left out by choice ...)" are counted - before then it silently skipped 9 rows. On 2026-10-10, after Batch 7, it was
33 below parity (7 missing, 26 partial).
Before Batch 1 (2026-10-08 morning) the count below parity was 69 (34 missing, 35
partial). Before Batch 2 part 2B2 (2026-10-08) it was 64 (28 missing, 36 partial):
the Dots menu and the Move choice moved four Missing rows to Partial.
Batch 3 part 3A (2026-10-09) took three rows to Same (Colour grid, Colour display
switch, Flashing mode switch): 61 below parity.
Batch 3 part 3B (2026-10-09) took Custom info bar and User-defined grid to Same and the
Options row from Missing-in-part to a smaller Partial: 59 below parity.
Batch 4 part 4A (2026-10-09) took Inverse mode and the Colour attribute line thickness
to Same: 57 below parity.
Batch 4 part 4B (2026-10-09) took the four inverter, copy-attribute and wiping rows to Same:
53 below parity.

---

## Part 1 - Attributes, Bright and Flash

50 functions: 41 same, 1 where PixULA goes further, 8 partial, 0 missing, 0 not applicable [M, count-verdicts.js, 2026-10-21, after the five features of 2026-10-19 to 2026-10-21 and their checks; unchanged since 2026-10-19, after Attributes Only]. Before Attributes Only: 40 same, 9 partial [M, same counter, same day].
Before the 2026-10-18 audit the counter gave 41 same and 8 partial; this line still read 30 same, 14 partial and
5 missing, its 2026-10-09 count, never updated since.

ZX Paintbrush gives each part of the attribute byte (bit 7 FLASH, bit 6 BRIGHT,
bits 5-3 PAPER, bits 2-0 INK) three states: a value, or "transparent" (BASIC's
INK 8 / PAPER 8 / BRIGHT 8 / FLASH 8), which keeps what the cell already has.
PixULA had that for Ink and Paper only until Batch 1 added it for Bright and Flash.

### Colour controls - what a stroke writes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| INK row | Pick the ink, or press none for transparent (INK 8): the cell keeps its ink. | Ink swatches with a "use existing" box. | Same |
| PAPER row | Pick the paper, or none for transparent (PAPER 8). | Paper swatches with a "use existing" box. | Same |
| BRIGHT control | BRIGHT 0, BRIGHT 1, or transparent (BRIGHT 8): each cell keeps its own bright. | Bright on or off, plus a "use existing" box under it that keeps each cell's own bright (2026-10-08). | Same |
| FLASH control | FLASH 0, FLASH 1, or transparent (FLASH 8). | Flash on or off, plus a "use existing" box (2026-10-08). | Same |
| T key | Sets ink, paper, bright and flash all to transparent. | Shift+T puts Ink, Paper, Bright and Flash all on "use existing" (2026-10-08; bare T is the Text tool). | Same |
| B and F keys | Toggle BRIGHT 0/1 and FLASH 0/1 from the keyboard. | Shift+B and Shift+F (2026-10-08; bare B and F are Brush and Fade). | Same |
| ULAplus CLUT grid | In ULAplus mode the bright/flash controls become a CLUT picker; keys 0 to 3 choose the CLUT. | CLUT selector replaces Bright and Flash, with one "use existing" box that keeps each cell's CLUT (2026-10-08). Ctrl+Shift+1 to 4 pick the CLUT in the ULAplus modes (2026-10-10, the owner's choice: the plain and Alt digits were taken; tested in Chrome only), listed in the Keyboard Shortcuts dialog. | Same |
| Pipette | Sets all four controls from the clicked cell; never sets transparent. | Eyedropper picks the whole cell, Bright and Flash included, and clears "use existing". | Same |

### Drawing mode bar

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Drawing (pixels) switch | Turn pixel drawing off so any tool writes colours only. Combined with the per-colour transparency above, any mix is possible, e.g. paper and flash only. | The Attributes Only draw mode (2026-10-19, owner decision) is pixel drawing switched off: every drawing tool (brush, spray, pattern, shapes, curves, Figure, pixel fill, gradient, text and stamps) gives each cell it touches Ink, Paper, Bright and Flash and never changes a pixel, following the brush size, the shape or the fill area, with Mirror. Each of the four "use existing" boxes keeps that one attribute, so any mix is possible, e.g. Paper and Flash only. Ink Recolour and Paper Recolour stay beside it as one-click presets of the same idea. Both buttons do the same; offered where cells have attributes. Pixels Only is the other way round: pixels with no attributes. | Same |
| Filling switch | Shapes and the fill tool use the chosen fill style instead of solid. | Filled and Use pattern options on each tool. | Same |
| Inverse mode | Like BASIC INVERSE: tools reset dots instead of setting them; text and solid fills are reversed. | Preferences > Inverse, or Shift+I (2026-10-09; the owner moved it out of the top strip): swaps the two mouse buttons for the brush, fill, shapes, curves, patterns, text and stamps (left draws paper pixels, right draws ink pixels). The gradient draws paper pixels with either button, as recorded in Batch 4 (its right button only reverses the direction). Ink Recolour, Paper Recolour, Attributes Only and the XOR modes give both buttons one job, so Inverse changes nothing there and the status line says so. Remembered, saved in presets. | Same |
| Over mode | Like BASIC OVER: dots are toggled. | XOR / Over, plus XOR / Every Pass. | PixULA further |

### Painting attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Free attributes tool | Paints the current colours onto every cell a freehand line touches, no dots. | Recolour button: click or drag over cells; each of the four parts follows its "use existing" box. | Same |
| Copy attribute tool | Pick up one cell's attribute with the first click, then paint it onto other cells. | Copy attributes in the Cell tool selector of the top strip (2026-10-09): the first click picks what the page shows there (both screens on GigaScreen), dragging paints it onto every cell passed over, the rail is untouched, one undo step per drag. Fast drags skip no cell. Cells already showing the attributes are left alone. | Same |
| Fill tool with pixels off | Floods a region of dots but writes colours only. | Fill tool in Ink Recolour or Paper Recolour mode. | Same |
| Wiping tool | Wipes dots away and sets the cells to the current colours; transparent channels are kept. Editable as a polygon afterwards. | Eraser option Attributes: Set to current (2026-10-09) erases the ink pixels and gives the cell the rail's attributes, with Bright and Flash "use existing" honoured; Keep (the default) is the eraser as before. Shown only where cells have attributes. Not editable as a polygon afterwards. | Partial |
| Colour attribute line thickness (option) | Thick lines colour only the cells under a 1-pixel or 4-pixel core, so less clash. | Attribute core option (2026-10-09) on the round and square brush, shape outlines and the Bezier curve: Whole line (default) / 1 pixel / 4 pixels. Every ink pixel is drawn; only the core's cells take the attributes; Mirror and XOR respected; previews match the commit; hidden where cells have no attributes. | Same |
| Attribute changes visible while drawing | Figures show their colours before they are finished. | Shapes, curves, gradients and stamps preview with the real colours. | Same |
| Re-colour the last figure (point mode) | Click a control point to give the last drawn figure the current colours, line and fill style. | A figure that is still waiting follows the rail colours, line style and fill live; one already drawn: Ctrl+Z, then Edit > Clone Last Figure (2026-10-10, Batch 7 part 7C). ZX Paintbrush re-draws it in place with a click on a control point; here it is two steps, so this row reads Partial. | Partial |

### Inverter tools - click cell by cell

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Attributes inverter tool | Swaps ink and paper of each cell clicked; snaps to cells. | Swap button. | Same |
| Pixels inverter tool | Inverts the dots of each cell clicked. | Invert pixels in the Cell tool selector of the top strip (2026-10-09): click or drag over whole cells; GigaScreen slot s becomes 3 - s; works in Timex Hi-res (8x8 cells) too; a blank cell fills; one undo step per drag. | Same |
| Pixels and attributes inverter | Inverts dots and swaps colours together, so the picture looks unchanged. Used to tidy imported pictures, where solid areas come in as inverted cells with holes. | Invert pixels and attributes in the Cell tool selector of the top strip, and Image > Pixels > Invert Pixels and Attributes (2026-10-08, tool 2026-10-09): inverts the pixels and swaps Ink and Paper of each whole cell; one undo step. Skips cells another visible layer also draws in. Not offered in ULAplus and ULANext (swapping would change the look) or modes without cell attributes. While a stamp floats the menu command is shut, and the cell tool stays in the list but says to finish or cancel the stamp first, as every cell tool does. | Same |

### Edit attributes bar - selection or whole screen

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Invert attributes of selection | Swaps ink and paper of every cell in the selection, or the whole screen. | Image > Attributes > Invert (2026-10-08): the whole cells of the selection's bounding rectangle (a lasso, wand or ellipse selection counts as its rectangle, owner decision in Batch 2), or the whole picture; one undo step. Greyed out in modes without cell attributes. Over a stamp that places its own attributes (2026-10-10, Batch 5 part 5C) it acts on the stamp's cell attributes, floating or parked, ignoring the selection, one undo step; greyed out for a stamp with no attributes of its own. | Same |
| Erase attributes of selection | Sets every cell in the selection, or the whole screen, to the current colours. | Image > Attributes > Erase (2026-10-08): writes the rail attributes, honouring the use-existing boxes; one undo step. Same limits as Invert. Over a stamp that places its own attributes (2026-10-10, Batch 5 part 5C) it acts on the stamp's cell attributes, floating or parked, ignoring the selection, one undo step; greyed out for a stamp with no attributes of its own. | Same |
| Flip attributes horizontally | Mirrors the colours; the dots stay where they are. | Image > Attributes > Flip Horizontal (2026-10-08): mirrors the cell attributes, pixels untouched. Same limits as Invert. Over a stamp that places its own attributes (2026-10-10, Batch 5 part 5C) it acts on the stamp's cell attributes, floating or parked, ignoring the selection, one undo step; greyed out for a stamp with no attributes of its own. | Same |
| Flip attributes vertically | As above, top to bottom. | Image > Attributes > Flip Vertical (2026-10-08): as above. Same limits as Invert. Over a stamp that places its own attributes (2026-10-10, Batch 5 part 5C) it acts on the stamp's cell attributes, floating or parked, ignoring the selection, one undo step; greyed out for a stamp with no attributes of its own. | Same |
| Change attributes dialog | Find and replace: choose source ink, paper, bright and flash (any can be "any") and what to change them to, over the picture, selection or overlay. | Image > Attributes > Change... (2026-10-08): Find and Replace with each take a value or Any/Keep for Ink, Paper, Bright and Flash; GigaScreen has Screen A and Screen B groups; ULAplus shows CLUT 0-3; live count of cells that will change; OK is one undo step. Over a stamp that places its own attributes (2026-10-10, Batch 5 part 5C) it acts on the stamp's cell attributes, floating or parked, ignoring the selection, one undo step; greyed out for a stamp with no attributes of its own. | Same |

### Edit pixels bar and rolling

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Invert pixels of selection | Inverts the dots of the selection or screen; colours untouched. | Transform > Invert and Image > Invert Pixels: the pixels of the selection's bounding rectangle (a lasso or ellipse counts as its rectangle) or of the whole picture; every cell keeps its own Ink, Paper, Bright and Flash (2026-10-19; before that the cells took the rail's attributes). | Same |
| Erase pixels of selection | Clears the dots; colours kept. | Edit > Delete. | Same |
| Flip pixels horizontally / vertically | Mirrors the dots; colours stay where they are. | Image > Pixels > Flip Horizontal / Vertical (2026-10-08): mirrors the pixels of the selection or whole picture, attributes stay in their cells; one undo step. A floating stamp is flipped as a stamp, but a stamp with its own cell attributes cannot be flipped here. | Partial |
| Roll or scroll pixels only | Moves the dots one pixel at a time; colours stay. | Transform Shift, Move = Pixels only (2026-10-08): pixels move one pixel or one cell at a time, 8 directions, wrap on or off, repeats while held. Not for a floating stamp (a stamp moves whole), and the arrow keys follow Move too (owner decision, 2026-10-08). | Partial |
| Roll or scroll colours only | Moves the colours a cell at a time; dots stay. | Transform Shift, Move = Attributes only (2026-10-08): attribute cells move one cell at a time, 8 directions, wrap on or off, repeats while held. Not for a floating stamp; arrow keys follow Move too. | Partial |
| Roll or scroll both | Dots and colours together, 8 pixels at a time; wrap round (roll) or lose the edge (scroll); 8 directions, repeats while held. | Transform Shift, Move = Pixels and attributes (the default, 2026-10-08): whole cells with their Paper, 8 directions including diagonals, wrap on or off, repeats while held, one undo step per hold. Cell steps only (8x8 in standard ULA). Not for a floating stamp; arrow keys follow Move too. | Partial |

### Seeing attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Colour grid | Shows attribute cells as a chessboard. | View > Colour Grid (2026-10-09), display only: ink pixels black, paper pixels alternate white and light grey cell by cell; excludes Attributes Off. GigaScreen and MultiGiga keep four grey levels on the chessboard. Disabled with a reason in Timex hi-res and the indexed modes. The cell grid with lines is still there. | Same |
| Character grid | Lines between 8x8 cells. | Cell grid. | Same |
| Pixels grid | Lines between pixels at high zoom. | Pixel grid. | Same |
| User-defined grid | Grid at any X and Y step. | View > Custom Grid... and Show Custom Grid (2026-10-09): X step and Y step set independently, 1 pixel up to the screen size, drawn as a fourth grid in every mode; lines closer than 4 screen pixels are left out until you zoom in. Remembered with the other three grids. | Same |
| Colour display switch | Hides colours and shows the dots in black and white. | View > Attributes Off (2026-10-09), display only: ink pixels black, paper pixels white. GigaScreen and MultiGiga show four grey levels (neither screen white, screen A only light grey, screen B only darker grey, both black). Timex hi-res too. Disabled with a reason in the indexed modes. Remembered per browser. | Same |
| Flashing mode switch | Stops or starts flashing on screen. | View > Stop Flashing (2026-10-09): every flashing cell shows its normal colours and the flash clock stops; turning it off resumes. Disabled with a reason where nothing flashes (ULAplus, ULANext, Timex hi-res, indexed modes). Remembered per browser. | Same |
| Custom info bar | Shows the attribute value under the pointer, and the screen addresses of the pixel and of the attribute. | Preferences > Pointer readout shows (2026-10-09): position only, plus the attribute (decimal, hex, and its parts; CLUT in ULAplus; both screens in GigaScreen), plus the memory addresses of the pixel byte and the attribute byte in Standard ULA, ULAplus, ULANext, Timex hi-colour, Timex hi-res and GigaScreen. Other modes say they have no address. ZX Paintbrush lets you choose the number formats; PixULA shows decimal and hex together. | Same |

### Overlays (pasted graphics) and attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Pixels-only or coloured overlay | When an overlay is made you choose: dots only (colours transparent) or full colour. | Stamps take the attributes on the rail. Map-tile stamps bring their own attributes. Built 2026-10-10 (Batch 5 parts 5A and 5B): the Transform panel has an Attributes choice (Pixels only / Own attributes) and every stamp stores it (Pixels or its own cell attributes) and its cell grid, both saved, undone and duplicated with it; Part 5A2 (2026-10-10): a copy now keeps the attributes of the cells it covered (not in GigaScreen, the indexed modes or modes without cell attributes; a cell the lasso never touched has none), they are saved with the persistent clipboard, and a paste starts as Pixels only, landing exactly as before; switching it to Own attributes snaps it to whole cells and places the copied attributes. Partial because ZX Paintbrush asks the question when the overlay is made, while a PixULA paste always starts as Pixels only and the choice is made afterwards in the Transform panel. | Partial |
| Overlay INK / PAPER / BRIGHT / FLASH switches | Each part of the overlay's colour can be let through from the background instead. | Stamps follow the rail's four "use existing" boxes when placed (2026-10-08), but the setting is the rail's, not stored per stamp. Built 2026-10-10 (5A and 5B): a coloured stamp stores four show-through switches (Ink, Paper, Bright, Flash; one CLUT box in ULAplus) shown in the Transform panel, and places the page's value for each one that is on, in every mode with cell attributes, both screens in GigaScreen; plain stamps still follow the rail's boxes. Same in effect; ZX Paintbrush asks at creation, PixULA starts a paste as Pixels only. The switches are stored per stamp. | Same |
| Overlapping or transparent overlay | Decides whether the overlay's clear dots also clear the background. | Stamps draw their ink pixels only; XOR mode is an option. Built 2026-10-10 (5A, 5B): the Transform panel's Paper pixels choice (Leave background / Clear background) is stored with every stamp. Overlap makes the pixels under the stamp's whole box paper pixels, in the cell-attribute modes and the indexed modes, as the opposite of the draw mode in force (XOR and recolour modes have no opposite, so they leave the paper pixels alone); Inverse swaps the two. | Same |
| Convert colour overlay to pixels only | Drops an overlay's colours and keeps its dots. | Built 2026-10-10 (5A): SelectionService.convertStampToPixels drops a stamp's attributes and cell grid, keeps its pixels, one undo step; the Convert to pixels only button is in the Transform panel (5B). | Same |

### Attribute layout and palettes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Attribute format 8x8 / 8x4 / 8x2 / 8x1 | Changes cell height; coarsening keeps the most-used colours. | Screen modes Standard and Multicolor 8x4, 8x2, 8x1, same rule. | Same |
| Convert to Timex / to Spectrum | 8x1 colour and back. | Screen Mode menu. | Same |
| Four palettes P0 to P3 and four ULAplus palettes U0 to U3 | Flip between palettes with one click or key. | Image > Palette: four slots for the ULAplus palette and four for the Next palette (2026-10-10), saved in the project and the automatic backup once used; one undo step per switch; picture attributes never change. Menu only, no keys; the fixed-palette modes have no slots (decision). | Partial |
| Palette inverter | Swaps the ink and paper halves of the palette's CLUTs. | Image > Palette > Invert Palette (2026-10-10): ULAplus only, one undo step, twice restores it; follow with Image > Attributes > Invert to keep a picture looking the same. Not in the Next modes: ULANext keeps Ink in 8 palette entries and Paper in 32, so there is no one-to-one swap. | Same |
| Edit, load and save palettes | PAL files for any mode; ULAplus palette as a 151-byte TAP. | Palette editor in ULAplus and Next modes; .pal and .npl; ULAplus registers inside a 6976-byte .scr. File > Save Palette as TAP and Load Palette / Open for the ULAplus palette tape (2026-10-10, Batch 6 part 6B): 176 bytes (ZX Paintbrush's help says 151, which is the BASIC program alone; its sample tapes are 176 [M, byte compare of 13 tapes, 2026-10-10]), with a loader written for PixULA from the ULAplus port specification; all 13 ZX Paintbrush sample tapes read. A palette tape does not become the open file. PixULA's own tape opening in ZX Paintbrush 2.6.4 is not yet checked (owner check-off). | Same |
| Edit the standard Spectrum colours | Change, load or reset the colours used for the standard 15. | Settings > Preferences > Standard colours (2026-10-10, Batch 6 part 6B): 15 colour pickers, Load .pal and Save .pal (ZX Paintbrush's 256-byte layout), Reset to standard. Changes what the fixed-palette modes show and what image exports contain, never .scr/.tap bytes; imports still match the original Spectrum colours; kept per browser. Bright black stays black (owner's choice), so a .pal's distinct bright black is not used. | Same |

## Part 2 - Everything else

64 functions: 34 same, 7 where PixULA goes further, 15 partial, 6 missing, 2 not applicable [M, count-verdicts.js, 2026-10-21, after the five features of 2026-10-19 to 2026-10-21 and their checks]. This line was not updated after the elliptic Ring or coloured CHX characters; from the totals of those days less Part 1's unchanged 41 same and 8 partial, it was 33 same, 16 partial after the elliptic Ring [C, 74 - 41 = 33, 24 - 8 = 16] and 34 same, 15 partial after coloured CHX characters [C, 75 - 41 = 34, 23 - 8 = 15]. Before the elliptic Ring: 32 same, 17 partial [M, same counter, 2026-10-20, after the gradient polygon styles, Rotation and Zoom]; before that: 31 same, 18 partial [M, same counter, 2026-10-19, after the Undo steps setting]; before that: 30 same, 19 partial [M, same counter, same day].
Before the 2026-10-18 audit the counter gave 35 same, 8 further, 13 partial and 6 missing; this line still read
19 same, 9 further, 19 partial and 15 missing, its 2026-10-08 count, never updated since.

### Draw tools

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Freehand | Draw with the mouse. | Brush, with seven engines (round, square, crosshatch, spray, fade, pattern, hatch), size 1 to 32 and pressure. | PixULA further |
| Freehand and line | Mix straight segments and freehand in one figure; Enter finishes. | Figure tool > Polyline (2026-10-10, Batch 7 part 7A; Shape list, or the L key): click points or drag for freehand runs, double-click or Enter finishes, the figure stays a pending preview, Enter again draws it as one undo step, Backspace removes the last point (a whole run), Escape drops it (ZX Paintbrush finishes the figure on Escape; here it is dropped, per the plan). | Same |
| Line | Two-point line. | Shape: line. | Same |
| Rays | Many lines from one start point. | Figure tool > Rays (2026-10-10): the first point, then each further point or freehand sample is joined to it. | Same |
| Curve | Four-point curve. | Bezier tool, quadratic or cubic, with draggable handles. | Same |
| Arc and sector | Four points; rotatable. | Shape: arc and sector from a centre and a drag point (its own angle) with a sweep dial; since 2026-10-10 (Batch 7 part 7B) a Rotation option turns them round the pressed point. Arcs are circular, ZX Paintbrush's four-point arc is not. | Partial |
| Orthogonal and parallel line tools | A second line at right angles to, or parallel with, the first. | Figure tool > Perpendicular line and Parallel line (2026-10-10): drag the first line, click a point; the perpendicular runs from the foot of your point on the first line, the parallel is a copy with your point at its middle. | Same |
| Ellipse and centred circle | Ellipse from corners (rotatable); circle from centre and edge. | Shape: ellipse and circle, both drawn from the centre outward in the code. Since 2026-10-10 (7B) the ellipse has a Rotation option (-180 to 180 degrees, clockwise); a circle needs none. | Same |
| Triangle tools | Free three-point, equal-sided and symmetrical triangles. | Shape: triangle from a box; Figure tool > Triangle (2026-10-10): three free points, optionally filled. Equal-sided and symmetrical triangles are still only the box form. | Partial |
| Rectangle, square, rounded rectangle, parallelogram | Rotatable; the rounding is adjustable. | All four exist as shapes. Since 2026-10-10 (7B) each has a Rotation option, and the rounded rectangle has an adjustable Rounding (0 to 100 percent; 50, the default, is the radius it always had). The Figures group now has Parallelogram (3 points) (2026-10-14): drag the first side, click the third corner, the fourth is A + C - B; fillable, turns about the middle of all four corners, moving the third point moves the fourth with it. Read from the help text as 'the corner after the second point' - the help picture was not looked at, so check one against ZX Paintbrush. | Same |
| Polygon, centred polygon, N-edge polygon | Free points, or regular around a centre. | Regular polygons from a box; Figure tool > Polygon (2026-10-10): any number of free points, freehand runs, optionally filled. No centred polygon or N-edge polygon tool beyond the regular shapes. | Partial |
| Ring | Elliptic ring with adjustable width. | Shape: ring (2026-10-20) drawn from its centre like the Ellipse, the drag setting its width across and its height down (the same both ways gives the circular ring, pixel for pixel as before), with the Shape tool's Rotation (-180 to 180 degrees, clockwise, round the centre) and an Inner radius of 10 to 90 percent of the outer, applied to both radii. Filled, thickness, line styles, Keep editable, Mirror and the draw modes all apply. ZX Paintbrush sets the ring by three points (two diagonal corners, then the inner ring); PixULA by one drag and the Inner radius slider. | Same |
| Line arrow | Line with arrowhead. | Arrow shapes. | Same |
| Line styles | Solid, dashed, dotted, clear. | Line style on Shape, Figure and Bezier (2026-10-10, 7B): Solid, Dashed, Dotted, Dash-dot, Dash-dot-dot (the six styles the help names) and Clear. Dash lengths read from the help's toolbar picture [M]; dashes only at thickness 1 (greyed out above, enforced by the rasteriser); Clear draws no outline, so it is for filled shapes. The pattern runs round corners and restarts per ray or line of a figure. | Same |
| Line thickness | Thickness setting for all lines. | Thickness 1 to 8. | Same |
| Point mode | Move points, move or rotate the last figure, delete its last point with Backspace. | A pending Figure, a Shape with Keep editable ticked, and a Bezier curve can be edited before they are drawn (2026-10-10, 7C): drag a square point, drag the figure to move it, drag the round knob to turn it (a Bezier curve has handles, moves with the arrow keys, but cannot be dragged or turned as a whole), Backspace removes the last point of a Figure, Ctrl+Z takes back edits. There is no 'clear points' or point list. | Partial |
| Clone last drawn figure | Draws the last figure again, ready to move with the cursor keys. | Edit > Clone Last Figure, Shift+C (2026-10-10, 7C): a pending copy of the last Figure, Shape or Bezier curve, which the arrow keys (Shift for a cell) move. | Same |
| X and Y keys | Lock drawing to one axis. | Hold X or Y to keep a brush, eraser, shape or figure stroke on a horizontal or vertical line, and the clicked points of a figure and their rubber band (Batch 7 part 7C2, review fix). | Same |

### Special draw tools, fills and gradients

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Spray can | Spray with size and strength. | Spray brush with flow, weighting and Poisson spacing. | PixULA further |
| Spray pattern tool | Sprays little circles, squares or lines, each filled with the fill style. | Spray Distribution Pattern lays whole circles, squares or lines, solid or outline, in the ink colours; no line style or fill pattern per figure, and ZX Paintbrush's spray trace can be edited in point mode, which this cannot (Batch 7 part 7C2). | Partial |
| Fill tool | Flood fill with solid or a fill style. | Fill with pattern, contiguous or not, diagonal option. | PixULA further |
| Fill styles and fill style editor | Built-in 16x16 patterns, each editable. | Pattern library and Pattern Creator. | PixULA further |
| Custom fill style from a picture | Turns a picture file into a fill through the converter. | From picture... in the pattern panel (2026-10-10, Batch 8 part 8B2): brightness, contrast, scaling, any of the 31 dithers, to a square tile of 8, 16 or 32 pixels, saved to the library under the file name. ZX Paintbrush also allows other widths and heights, which the library does not (square tiles only). Patterns captured from the canvas, and JSON import / export; there are no .pat files. | Partial |
| Capture fill style | Uses the last captured area as the fill. | Pattern capture from a selection. | Same |
| Gradient fills and custom gradient | Linear, radial, circular, triangular, rectangular, pentagonal, hexagonal, octagonal; rotation, repeats, zoom. | Gradient tool: linear, radial, reflected, diamond, square, triangle, pentagon, hexagon, octagon, conical, spiral; repeats, curve, bias, steps, shape fills. The four polygon styles (2026-10-19, owner decision) draw regular-polygon bands round the start point; the drag sets their size and reaches the bands' corners, and at Rotation 0 one side lies flat at the bottom (the triangle and pentagon point up). Rotation (-180 to 180 degrees, clockwise, as the Shape tool's) turns the edge-based styles: square, diamond and the four polygons. Linear, reflected, conical and spiral take their direction from the drag (Shift snaps it to 15 degrees), so the drag is their rotation and the option is not shown for them; radial is round. Zoom (25 to 400 percent) is offered for the same edge-based styles, as the help says ("figures that are edge-based (triangle, square etc.) can also have a zoom level"); the help does not say what it does, so here it scales the band spacing about the start point (200 percent puts the bands twice as far apart, and with Repeats makes each repeat twice as wide). Bias, steps, shape fills and all 31 dithers work with every style, and repeats and curve with every style but reflected (its one fixed mirror has no wrap stage, so the panel hides them there). Conical, spiral, reflected, curve, bias and steps go further than ZX Paintbrush. The help's pictures of the styles are not in the repository, so the polygons' starting orientation should be checked against ZX Paintbrush by eye. Manual: Tools chapter, Gradient styles, Rotation and Zoom. | Same |
| Dithering styles | 31 methods: three thresholds, 14 error-diffusion kernels, three Bayer matrices, seven cluster-dot and four supercell screens, for gradients, fills and imports. | All 31 exist in js/utils/dither.js (2026-10-10, Batch 8 part 8A; tables from the help, usage measured against its pictures). Gradient (8B): its own Bayer 2/4/8 first, then the 28 others. Picture import (8B): the Smooth conversion takes any of the 31, and Sharp too once a method is chosen; in the cell modes error diffusion stays inside each attribute cell; the Layer 2 / LoRes modes take all 31 as well (each pixel between its two nearest palette colours, the whole picture one block; 2026-10-13). Custom fills (8B2): all 31. The fade brush keeps its own ordered, halftone and noise. The gradient's Bayer matrices are the transpose of ZX Paintbrush's. | Partial |

### Capture, selection and overlays

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Capture ellipse, rectangle, polygon | Grab an area; move it, drag it (Shift) or copy it (Ctrl). | Select: rectangle, ellipse, lasso, cell grid; move or copy as a stamp. | Same |
| Selectors: 8x8, 16x16, whole screen, user-defined size | Selections that snap to fixed sizes. | The rectangle selection has a Size list (2026-10-12, Batch 9 part 9A2): Free, Cell, 16x16, Screen (256x192, only on a canvas bigger than one screen) and Custom (block width and height); a click picks one block, a drag whole blocks; Cell blocks sit on the cell grid, the others start where you press (or on the snap cell, with Snap on). Also fixed: a click in the right half of a cell selected the next cell under Snap, and a Free drag under Snap selected one pixel too many. | Same |
| Adjust selection to 8x8 | Expands a selection to whole cells. | Snap (Shift+S). | Same |
| Export selection; new file from selection | Save just the selection, or open it as a new picture. | File > Save Selection As (2026-10-12, Batch 9 part 9B): PNG, BMP, JPEG any rectangle; ZXP, SEV, ZED, ASM, C, BIN, ATR whole cells (fitted first, with a notice; the code dumps are linear rows in the classic, multicolor and ULAplus modes); ColorTiles whole 16x16 tiles; one-screen dumps (SCR, tapes, MLT, ...) only for the whole screen. Edit > Fit Selection to Cells is ZX Paintbrush's Adjust to 8x8; Edit > New Picture from Selection keeps every layer, asks first and can be undone. Not covered: ZX Paintbrush's character-set (128x128) and CHX font exports of a selection, and SEV sizes beyond cells. | Partial |
| Create, merge and delete overlay | Overlay from a selection; accept or throw away. | Copy and paste as a floating stamp; commit or cancel. | Same |
| Rotate overlay 90 / 180 degrees | Quarter and half turns. | Stamps rotate to any angle, flip, scale and bend. | PixULA further |
| Toggle overlay display (O key) | Hide an overlay without losing it. | Show/hide on each stamp; Layer > Flatten leaves a hidden stamp out (2026-10-19). | Same |

### Text and fonts

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Windows text tool | Any font and size; left, centre, right; vertical anchor; four directions; shading in four corner directions; contour. | Text tool: system fonts, sizes, bold, italic, alignment, eight directions, mirror, outline; shadow in four directions; a nine-way Anchor for where the click sits on the finished block; Background (Clear background); Shadow pixels and Contour pixels each Same as the letters (the original) or Opposite, drawn in the opposite pixel state as ZX Paintbrush does (2026-10-13, Batch 10A / 10A2). Differences: ZX Paintbrush ties the anchor to the alignment; PixULA keeps them apart so existing text does not move; opposite pixels are not drawn in XOR / Ink only / Paper only. | Same |
| Sinclair text tool | Type on the canvas at a flashing L cursor; 4x8, 6x8 and 8x8 fonts stretched to any width and height; character and line spacing. | Text tool: Type on canvas (ZX ROM or a saved font): click, type at a flashing caret, Shift+Enter for a new line, Enter draws in one undo step, Escape throws away; Character width / height stretch the font 1 to 64 pixels and Character / Line spacing -8 to 32; every text effect applies live (2026-10-13, Batch 10B). Big and proportional saved fonts work too: each letter is as wide as it is saved, the Size list goes in steps of the font's height, and changing font keeps the zoom (Batch 10C3). Differences: the caret is a plain caret, not ZX Paintbrush's flashing L; touch devices use the on-screen keyboard and Draw / New line / Cancel buttons. | Same |
| Character set editing | CH4, CH6, CH8, CHR as a 16x16 map; press a key to find its character. | Font Editor for CH4, CH6, CH8, CHR and CHX; All characters shows the whole font as one 16-wide map you can draw across; arrow keys or a typed character choose a character in the map and the grid (2026-10-13, Batch 10C2b). | Same |
| CHX big fonts | 8x8 up to 32x32 characters; edit as a map or one at a time; fill from a Windows font; proportional widths with the shader tool. | Font Editor: CHX read and write of whole characters up to 32x32 (each at its own size), New Big Font with separate width and height, Fill from font (any font in the Text tool's list, height percent, left / centre / right, Proportional that saves narrower letters), edited one character at a time or across the whole map (2026-10-13, Batch 10C). The all-characters map (draw across every character, Fill inside the clicked letter) and the Shade tool, Shade all to fit and Undo are built (Batch 10C2 / 10C2b). Coloured characters (2026-10-20): opening a CHX keeps every block's attribute byte and saving writes it back (an uncoloured character is saved byte for byte as before); the Font Editor shows each block in its Ink, Paper and Bright (a mark for Flash), its Attributes tool gives a block the attribute bar's Ink, Paper, Bright and Flash (a part on use existing keeps the block's own; the first click on an uncoloured character gives them to all its blocks, as the file colours a character as a whole), All blocks and Remove attributes, each one Undo step; the Text tool's Attributes: Own attributes places each coloured letter's block attributes (uncoloured letters take the bar), as a stamp and with Type on canvas, where the blocks land on 8x8 cells, and refuses with a reason otherwise. The multi-block layout and the coloured layout (an attribute byte after each block) are from the published format description and not checked against a file saved by ZX Paintbrush. | Same (the multi-block and coloured layouts are from the published format description, not checked against a ZX Paintbrush file) |

### Maps

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Find and create map elements | Turns a selection into an element and finds every copy on screen, matching dots and colours, dots only, or by look. | Edit > Find Map Element (Ctrl+F) copies the selected block of whole cells and finds every copy: Pixels and attributes, Pixels only, or Looks the same (both flash phases; each GigaScreen screen on its own); places outlined and stepped through, Accept stores the element with the map and covers its places with numbered boxes (display only, not an undo step); covered places and overlaps are left out of a later find (2026-10-14, Batch 11B), and a find cannot start on a block an element already covers (owner, 2026-10-18). Works in 8x8-cell modes (Standard, ULAplus, ULANext, GigaScreen, Timex hi-res); refused with a reason elsewhere. | Same in 8x8-cell modes |
| Map element list | Elements and their positions; import, export, placeholders (M key). | Map Elements panel: list with Show and Delete, numbered boxes or the elements' own pictures (Shift+M, since M is the Selection tool), elements saved with the map (.zxtm), the project, the autosave and .zxm, New / Open and Tape Blocks > Load (2026-10-19) ask before abandoning them; drawing on a covered place is allowed and stays hidden. Not built: merge-into-picture on delete, moving or adding a place, importing or exporting one element as .zxp. The Map Editor's tile palette and maps bigger than one screen are further. | Partial |
| ZXM files | Screen plus map elements. | File > Open reads a .zxm as the picture plus its map elements and their places (places not on a cell are moved to one, with a notice); Save Image As > ZXM writes the picture with its elements (Standard ULA only; elements of another screen mode are left out, with a notice); the Map Editor's .zxm is the tile map, and File > Open of a .zxm leaves the Map Editor's working tile map alone (2026-10-19); PixULA's own .zxtm and the project and autosave also carry the elements (2026-10-14, Batch 11B3). Not checked against a file saved by ZX Paintbrush itself. | Same in Standard ULA |

### View and positioning

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Zoom | Up to 1600%; Ctrl+wheel; Ctrl + and -. | 100 to 1600%; Ctrl+wheel (a plain wheel scrolls); + and - step 100/200/400/800/1600. | Same |
| Preview window | Miniature of the whole picture. | View > Preview (2026-10-12, Batch 9 part 9B): a sidebar map with a frame for the visible part, click or drag or arrow keys to scroll, hidden until switched on. | Same |
| Background picture (P key) | A picture behind the canvas with position and transparency. | Reference panel: position, scale, rotate, flip, opacity. | PixULA further |
| Raster jump 8x8, 16x16, 256x192, user-defined | The pointer moves in fixed steps. | Snap has a step (2026-10-12, Batch 9 part 9A): the mode's attribute cell, 16x16, a whole 256x192 screen (only on a canvas bigger than one screen) or a custom across/down step set in Preferences; picking a step turns Snap on; shape ends, figure points, text, selections and pasted pieces land on it (a pasted piece by its top-left corner). Also the arrow keys step by it with Snap on. ZX Paintbrush moves pixel by pixel with the keyboard whatever the raster, so that part differs on purpose. | Same |
| Cursor keys move the last figure | Pixel-by-pixel nudging of what you just drew. | The arrow keys move a pending figure, shape or curve by one pixel, or a cell with Shift or grid snap (2026-10-10, 7C); they move a floating stamp or the selection when no figure is waiting. | Same |

### Files and tapes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| SCR, ZXP, MLT, SEV, CTILE, ZED | Read and write. | Read and write all of these. | Same |
| TAP/BLK, TZX, PZX with loaders | Tape files with a choice of loaders; turbo for TZX and PZX. | TAP and TZX with a BASIC loader that shows the screen. No PZX, no turbo loaders. | Partial (left out by choice, 2026-10-14: not attribute work) |
| Disk images | DSK, TRD/SCL, MGT/IMG, with disk formats and loaders. | No. | Missing (left out by choice, 2026-10-14: not attribute work) |
| Nirvana tiles (.btile) | 8x2-attribute tiles. | No. | Missing (left out by choice, 2026-10-14: not attribute work) |
| Archives and Warajevo tapes | Reads zip, rar and 28 other archive formats, and Warajevo TAP. | No. | Missing (left out by choice, 2026-10-14: not attribute work) |
| ZXB meta files | ZX-Blockeditor's container. | Left out on purpose; the Tape Blocks dialog covers tape blocks. | N/A |
| BMP, GIF, JPG, PNG | Read and write. | PNG, JPG and GIF are read (through the Import dialog); PNG, BMP and JPG are written. BMP cannot be opened. GIF export (with Flash animation) is built but has had no menu entry since 2026-08-25, so GIF cannot be saved. | Partial (no BMP read, no GIF write) |
| Picture converter | Brightness, contrast, size, crop, 31 dithers, black-and-white, colour, Timex, ULAplus via Image2ULAPlus, GIF frame picker. | Import dialog: brightness, contrast, fit/stretch/crop, Dither select with the 31 methods for the Smooth and Sharp conversions, in every mode (8B, 2026-10-13), live preview; ULAplus palette built in; GIF first frame only. | Partial (left out by choice, 2026-10-14: not attribute work) |
| File window | Edit each SCREEN$ block in a tape or disk file; add, delete, move blocks. | Tape Blocks dialog for tapes; Load asks first, as File > Open does, and Add current screen says why in a mode with no SCREEN$ form (2026-10-19). | Same |
| Data block composer, memory and pulse editors, header changer | Build and edit any tape block byte by byte. | No. | Missing (left out by choice, 2026-10-14: not attribute work) |
| ASM and BIN export settings | Number base, prefixes, bytes per line, line or block layout, attributes mixed in. | .asm, .c, .bin and .atr with a fixed layout. | Partial (left out by choice, 2026-10-14: not attribute work) |
| Change picture size | Add or remove space around the picture. | No; the canvas size comes from the screen mode. | Missing (left out by choice, 2026-10-14: not attribute work) |
| Print with preview | Print at any size over several pages. | No. | Missing (left out by choice, 2026-10-14: not attribute work) |
| Run file; send to ZX-Editor or ZX-Blockeditor; command line | Windows integrations. | Not applicable to a browser app. | N/A |

### Clipboard and program

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Internal clipboard | Text-based ZXP format, shared between program windows. | Internal clipboard that survives a reload. | Same |
| Paste Windows graphic | Through the import converter. | System clipboard paste (Ctrl+V) goes through the importer's per-cell two-colour engine and becomes a floating stamp in the current ink only. The conversion dialog (brightness, contrast, dither, Sharp / Smooth / Flat) is not shown, and the picture's colours are lost. | Partial (no conversion dialog, one ink colour) |
| Undo and redo | Configurable depth. | Preferences > General > Undo steps sets the depth, 1 to 2000 (500 to start with), kept across reloads; lowering it drops the oldest steps at once (2026-10-19). A 256 MB memory cap stays on top, so on a big picture it can keep fewer steps than set, and the hint says so. | Same |
| Options | Grid colours, three display sizes, info bar formats, PLOT coordinate range. | Interface size, themes, languages. Grid colours (Preferences, per grid, with Reset to the theme) and PLOT coordinates (Preferences > Y counts from; the readout only) added 2026-10-09. The rest of this row stays with Batch 12. | Partial (left out by choice, 2026-10-14: not attribute work) |
| Context help and hotkey list | Click-for-help and a shortcuts page. | Two-stage tooltips, a built-in manual in 13 languages, a shortcuts dialog. | PixULA further |

## PixULA functions with no ZX Paintbrush counterpart

- Layers (up to 32) with a compositor that follows the Spectrum's rules
- Mirror drawing (H, V, both) for every tool
- XOR / Every Pass: a stroke cancels where it crosses itself
- Fill attributes only: flood connected cells that share the same four values (in the modes with cell colours)
- Brush engines: spray with weighting or Poisson spacing, fade, pattern, hatch; pressure
- 30+ shapes: star, heart, gear, flower, moon, spiral, house, arrows and more
- Gradient tool with eleven types (reflected, conical and spiral beyond ZX Paintbrush's), curve, bias, steps and shape-constrained fills
- Pattern library of 105 measured tiles, plus your own
- GigaScreen, MultiGigaScreen, Timex hi-res and every Next mode (Layer 2, LoRes, ULANext)
- Stamps that rotate to any angle, scale and bend
- Reference image that rotates and scales
- Sprite editor and Next sprite sheets
- Self-loading TAP/TZX with a BASIC loader; SNA import
- Project files that keep every layer; autosave with numbered copies
- Tool and workspace presets
- Eight themes, 13 languages, runs in any browser

---

## Part 3 - Parity backlog

Every Missing or Partial row above, grouped into batches in working order. Each
batch has its own working notes, and progress is logged part by part. Batches run in groups of three, each
group on its own branch and checked as a whole before it is merged: A = 2-4,
B = 5-7, C = 8-10, D = 11-12. Nothing here is rejected: where something may not
suit a browser app (print, disk images, archives), its batch says what it would
cost and the owner decides.

1. **Bright and Flash - DONE 2026-10-08.** "Use existing" for Bright and Flash in
   every mode and tool; one CLUT box in ULAplus; Shift+B / Shift+F / Shift+T.
   Still open from this area: the ULAplus 0-3 CLUT keys (batch 6).
2. **Attribute commands on a selection or the whole screen** (2A done 2026-10-08:
   invert, erase and flip attributes; 2B2 done 2026-10-08: Image > Dots flips,
   Invert Dots and Colours, the Move choice and the 3x3 shift pad with diagonals;
   2C done 2026-10-08: the Change Attributes dialog; the arrow keys follow Move
   (a floating stamp keeps its one-pixel nudge); only stamp support for the
   attribute commands is still open - Batch 5): invert attributes,
   erase attributes, flip attributes H/V; a Change Attributes dialog (find and
   replace, any part may be "any"); pixels-only flip; pixels-only and
   colours-only shift; diagonal shift; a Pixels+Attributes inverter (inverts dots
   and swaps colours, so the picture looks unchanged - tidies imports).
3. **Seeing attributes** (DONE 2026-10-09: 3A View > Colours Off, Stop Flashing and
   Colour Grid, display only; 3B pointer readout with attribute and addresses, PLOT
   coordinates, custom grid and grid colours, done here and not in batch 12): colours-off (black-and-white dots) view; flashing
   on/off; chessboard cell grid; pointer readout of the attribute value and the
   pixel/attribute screen addresses; user-defined grid; PLOT coordinates and grid
   colours (moved here from batch 12 on 2026-10-08, as they belong with the
   readout and the grids).
4. **Painting options** (DONE 2026-10-09: Inverse, Colour core, the three cell tools,
   the wiping eraser, and the top strip folded into three selectors): attribute line thickness (colour only a 1- or 4-pixel
   core of thick lines); copy-attribute tool in one step; Inverse mode switch;
   wiping-tool behaviour (erase dots and set colours, honouring use-existing);
   a per-cell pixel inverter tool.
5. **Overlays (stamps)**: pixels-only vs coloured choice per stamp; per-part
   show-through stored with the stamp; overlapping vs transparent clear dots;
   convert a coloured stamp to pixels only.
6. **Palettes**: palette slots (P0-P3 / U0-U3) with quick switch; ink/paper CLUT
   inverter; editable standard Spectrum colours; ULAplus palette as a TAP (a
   151-byte program [P, help]; the sample files are 176 bytes in all [M,
   2026-10-08]); CLUT keys.
7. **Drawing tools**: polyline (freehand and line), rays, orthogonal and parallel
   lines, free 3-point triangle, free-point polygon, rotatable shapes, adjustable
   rounding, line styles (dashed/dotted), spray pattern tool, point mode (edit,
   move, rotate and re-colour the last figure), clone last figure, X/Y axis lock
   keys, cursor keys move the last figure.
8. **Fills and dithering**: the 31 dithering methods (three thresholds, 14 error
   diffusion kernels, three Bayer matrices, seven cluster-dot and four supercell
   screens) for import, gradients and fills; custom fill from a picture file.
9. **Selection and view**: 16x16, screen and user-sized selectors; new file from
   selection; export selection; preview window; raster jump steps.
10. **Text and fonts**: shadow in four directions; Sinclair-style typing at a
    cursor with width/height stretch and spacing; CHX fill-from-font and the
    shader tool.
11. **Maps**: find repeated elements of any size, with pixels-only and visual
    matching.
12. **Files**: PZX and turbo loaders; disk images (DSK, TRD/SCL, MGT/IMG);
    Nirvana .btile; archives and Warajevo TAP; data block composer, memory and
    pulse editors, header changer; ASM/BIN export settings; change picture size;
    print; the rest of Options; picture converter extras (black-and-white mode,
    GIF frame picker).
13. **Found by the 2026-10-18 audit** (rows moved to Partial on 2026-10-19, not yet
    placed in a batch; the owner decides): ~~a draw mode that writes Ink and Paper
    without touching a pixel~~ (built 2026-10-19: Attributes Only); ~~an elliptic, rotatable
    ring~~ (built 2026-10-20: the Shape tool's Ring has a width, a height and Rotation); ~~triangular, pentagonal, hexagonal and octagonal gradients with rotation
    and zoom~~ (built 2026-10-20: the four Gradient styles, Rotation and Zoom); ~~keeping the colours of coloured CHX characters~~ (built 2026-10-20: kept, edited in the Font Editor and typed with the Text tool's Own attributes); opening BMP and
    saving GIF; the conversion dialog for a system clipboard paste; ~~a setting for
    the undo depth~~ (built 2026-10-19: Preferences > Undo steps, 1 to 2000).
