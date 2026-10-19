## Colour

In the classic modes you are not choosing a colour for a pixel. You are
choosing the two colours a whole cell will use, plus two flags.

- **Ink** is the colour of the ink pixels.
- **Paper** is the colour of the paper pixels.
- **Bright** lifts both to their brighter versions. There is one Bright flag
  per cell, so Ink and Paper are bright together or not at all.
- **Flash** swaps Ink and Paper about twice a second on real hardware.

The left mouse button draws ink pixels. The right button draws paper pixels,
and sets the same four attributes the left button would. On a pen, the barrel
button does what the right button does.

The **eraser** does something different from either. It turns ink pixels into
paper pixels and leaves the cell's attributes alone, even when it erases the
last ink pixel in the cell. To wipe the attributes as well, erase over the empty
cell again with a new stroke: Ink, Paper, Bright and Flash go back to black on
white, and on an upper layer the cell becomes see-through again. A cell that
still has ink pixels in it keeps its attributes however many times you erase
over it.
The eraser's **Attributes** option, shown in screen modes with cell attributes,
changes this: Set to current erases the ink pixels and gives the cell the
attributes in the rail, as the wiping tool of ZX Paintbrush does, and Keep, the
default, is the behaviour above.

Each of the four can also be set to **use existing** - the checkered box under
it in the colour rail. A stroke then leaves that part of every cell as it
already is, instead of writing your setting. Put Ink, Paper and Bright on use
existing, switch Flash on, and the fill tool's **Fill attributes only** makes a
whole area flash without changing a colour. Shift+B and Shift+F switch Bright
and Flash, and Shift+T puts all four on use existing. In ULAplus, Bright and
Flash choose the CLUT, so the CLUT picker has one box that keeps each cell's own
CLUT.

### Draw modes

The draw mode changes what a stroke does. It persists between sessions, so the
status bar shows it whenever it is set to anything other than Normal - in some
of these modes a stroke leaves nothing visible, and you would otherwise have no
way to tell why.

The top strip has three buttons: **Draw mode**, **Cell tool** and **Mirror**.
Each one shows the choice in force. Click it and a small grid of the other
choices opens under it; click one and the grid closes. Press Escape, or click
anywhere else, to close it without changing anything. Draw mode and Mirror work
together: set XOR and Horizontal and a stroke is an XOR stroke, mirrored. The
cell tool, when one is on, takes over every stroke.

{{draw-modes}}

The brush in all its forms, the fill, the shapes, the Bezier curve, text,
stamps from the **Stamps** panel and the gradient's left button all follow the
draw mode. The eraser, the eyedropper, moving, pasting and deleting a
selection, the **Transform** panel, the fill's **Fill attributes only** option
and the Swap and Recolour buttons all ignore it.

**Ink Recolour is not the same as Recolour.** Ink Recolour and Paper Recolour
are draw modes: they recolour every cell the current tool touches - a few cells
for a small brush, every cell a filled rectangle covers - and Mirror applies.
**Recolour**, in the Cell tool button, recolours the whole cell under the
pointer whichever tool is selected, ignoring brush size and Mirror. **Swap**,
from the same button, works the same way, exchanging each cell's Ink and Paper.
Either one stays on until you switch it off - pick None, pick it again,
right-click the canvas, or choose a tool or a draw mode - and the status bar
says so while it is on.

**Attributes Only** is the third of these draw modes. It gives every cell the
current tool touches your Ink, Paper, Bright and Flash at once and draws no
pixel, which is what ZX Paintbrush does with pixel drawing switched off. Each of
the four parts on **use existing** stays in every cell as it is: with Paper on
use existing it does what Ink Recolour does, with Ink on use existing what Paper
Recolour does. As in those two, both buttons do the same, and it is offered only
in the screen modes whose cells have attributes.

**Copy attributes, Invert pixels and Invert pixels and attributes** are three
more cell tools in the same Cell tool button, and work the same way: pick one,
then click or drag over cells. Each drag undoes in one step, and the tool stays
on until you switch it off. **Copy attributes** picks up the attributes the cell
under your first click shows and gives them to every cell you drag over; the
colour rail is not changed. **Invert pixels** turns the ink pixels of each whole
cell into paper pixels and the paper pixels into ink, and leaves the attributes
(on a blank cell it fills it). **Invert pixels and attributes** also swaps Ink
and Paper, so each cell looks the same; it is for tidying an imported picture, it skips cells that another layer also draws
in, and it is not offered in ULAplus and ULANext. A cell tool is offered only in
the screen modes it can work in: the Cell tool button lists just the ones that
apply (and is hidden where none do), and Invert pixels also works in Timex
Hi-res, where the pixels are in 8 by 8 cells.

**XOR / Over and XOR / Every Pass** both flip pixels, ink to paper and paper to
ink, rather than draw ink pixels, and both give the cell your attributes. XOR /
Over flips each pixel once per stroke, so going back over your own line in the
same stroke changes nothing more. XOR / Every Pass flips a pixel each time the
stroke passes over it: one sweep of the brush is one pass, however much the
brush overlaps itself on the way, but a stroke that leaves a pixel and comes
back flips it again, so a figure of eight
cancels where it crosses. Shapes, curves, fills and text are always a single
pass, so with those the two modes give the same result.

**Inverse** swaps what the two mouse buttons do: the left button draws paper
pixels and the right button draws ink pixels, like BASIC's INVERSE 1. Switch it on in Preferences, or with Shift+I, and the status bar says "Inverse is on" while it is.
It changes nothing in Ink Recolour, Paper Recolour, Attributes Only and the two
XOR modes, which
give both buttons the same job, and the status bar says so. Text and stamps
draw their letters and shapes in paper pixels instead of ink pixels, a pattern
lays its ink pixels as paper pixels and its paper pixels as ink, and the fill
tool fills with paper pixels on the left button and with ink pixels on the
right. The eraser, Swap and Recolour ignore it. It is
remembered between sessions and is saved in presets with the draw mode.

**Attribute core.** For the round and square brush, shape outlines and the
Bezier curve, Attribute core says how much of a thick line takes the cell
attributes. A line always draws every ink pixel. With Attribute core on 1 pixel
or 4 pixels, only the cells under the middle of the line, a line that wide
following its centre, take your attributes; the other cells under it get the ink
pixels in the attributes they already had, so a thick line clashes with fewer
cells. Whole line, the default, gives your attributes to every cell the line
touches. The option appears only in screen modes with cell attributes. With
Mirror the mirrored line has a core of its own, and with XOR the cells outside
the core keep their attributes.

### Palettes

Two mode families let you change the colours themselves. ULAplus gives you 64
colour registers, arranged as four palettes of sixteen. The Next modes give you
256 colours of nine bits each.

Palettes are files. You can build one, save it, and load it into another
picture, from **File > Load Palette** and **File > Save Palette** or from the
palette editor. You do not have to open the editor to load one, since loading a
palette is usually something you do before you start drawing.

Where a file format has room for a palette - `.scr` at 6976 bytes, `.nxi`, the
Timex variant - the palette travels inside the picture as well.

**Palette slots.** The ULAplus palette and the Next palette each have four slots, in Image > Palette (Slot 1 to Slot 4). The slot in use is ticked, and the palette editor says which slot it edits. A new document starts on Slot 1, and the other slots hold the default palette until you use them. Choosing another slot changes the colours the picture is shown with and never changes the picture's attributes. Each choice is one undo step. The slots are saved in a project and in the automatic backup, but only once you have used a slot; a picture opened from any other kind of file starts on Slot 1 with the other slots holding copies of its palette. The .scr, .tap and image exports always use the slot in use. The fixed-palette modes (Standard ULA, the Multicolor modes, GigaScreen and the Timex modes) have no slots.

**Invert Palette** (ULAplus only) swaps the Ink half (entries 0-7) with the Paper half (entries 8-15) of each of the four CLUTs, in one undo step; doing it twice puts the palette back. To invert a ULAplus picture so that it looks the same, use Invert Palette and then Image > Attributes > Invert. The border follows the Paper half of CLUT 0, so it changes colour too. The Next modes have no palette inverter, because ULANext keeps Ink in 8 palette entries and Paper in 32.

**CLUT keys.** In the ULAplus modes Ctrl+Shift+1 to Ctrl+Shift+4 pick CLUT 0 to 3, the same as the CLUT choice on the colour rail. In other modes they say so in the status bar and do nothing else.

**Standard colours.** In Settings > Preferences, Standard colours lets you change the 15 colours that the Standard, Multicolor, GigaScreen and Timex modes show. Bright black is always black. The colours change what you see and what the image exports contain (PNG, GIF, BMP, JPG); they never change the bytes of .scr or .tap files, and importing a picture still matches the original Spectrum colours, so the same photo gives the same picture on every machine. ULAplus and Next palettes are separate. OK applies the colours, Cancel keeps nothing, and Reset to standard puts the originals back. They are kept in this browser, not in the project. Load .pal reads a ZX Paintbrush standard-colours file (256 bytes) and Save .pal writes one, which is the way to carry your colours to another browser.

**Palette tapes.** File > Save Palette as TAP writes the ULAplus palette as a 176-byte tape. Loaded on a Spectrum with `LOAD ""` it sets the 64 palette entries and then loads the next file on the tape, so a palette tape can sit in front of a picture or a game tape. File > Load Palette, and File > Open, read palette tapes: PixULA's own and ZX Paintbrush's. A palette tape goes into the palette slot in use as one undo step and does not become the open file.

### GigaScreen

GigaScreen keeps two whole screens and shows them alternately, fifty times a
second. Your eye mixes each pixel's two colours into one, so a cell that holds
one Ink and one Paper on each screen can show **four** colours, and the
picture as a whole can reach about a hundred.

You never draw on one screen at a time. Every stroke writes both, and the
colour rail works in pairs:

- **Screen A** and **Screen B** each have their own Ink and Paper swatches and
  their own **Bright**. Flash is one setting for both.
- **Paint** shows the four colours those choices make, mixed exactly as the
  canvas shows them: Ink on both screens, Ink on A only, Ink on B only, and
  Paper on both. Pick one and the left button paints it. The right button
  always paints Paper on both screens.
- Pick the same Ink for both screens and the top-left Paint swatch is that
  colour, solid - which is how to draw anything that should not look mixed.

The eyedropper picks all of this back up: both screens' attributes and which of
the four the pixel shows.

The display buttons change only what the canvas shows, never where a stroke
goes. **Average** is what the eye sees on the real machine. **Flicker** swaps
the two screens every frame, as the hardware does. **A** and **B** show one
screen on its own. A picture you save or export as PNG uses Average when
Flicker is showing, since a still image cannot flicker.

Entering GigaScreen copies your picture onto both screens, so it looks the
same as before. Leaving it keeps screen A and drops screen B, and you are
warned first if screen B holds anything different.

The same way of working covers two more flicker modes:

- **MultiGigaScreen 8x4, 8x2 and 8x1** put the two screens on the finer
  Multicolor cells, so the four colours are per 4, 2 or single line rather
  than per 8x8 block. These are MultiArtist's `.mg4`, `.mg2` and `.mg1` files.
- **Timex Hi-res GigaScreen** alternates two 512x192 hi-res screens. Hi-res
  has no cell attributes - each screen has one colour scheme for the whole
  picture - so the rail shows a scheme row for Screen A and one for Screen B,
  and Paint shows the four mixes of the two. These are `.hrg` files.

Switching between any of the two-screen modes keeps both screens, by the same
rules that convert a single screen.

### Attributes

The Attributes items in the Image menu change the attributes of cells and leave
the pixels where they are. Invert swaps Ink and Paper in each cell and keeps
Bright and Flash. Erase writes the current Ink, Paper, Bright and Flash to
each cell, and the "use existing" boxes keep what a cell already has. Flip
Horizontal and Flip Vertical mirror the cell attributes. Each command works on
the selection (every cell it touches), or on the whole picture when nothing
is selected, and undoes in one step. The items are greyed out in modes with
no cell attributes (Timex Hi-res, Layer 2, LoRes), while a stamp that keeps no attributes of its own is floating,
and on a locked layer.

Change... finds cells by their attributes and replaces them. Find sets which cells to match: each field is a value or Any. Replace with sets what they become: each field is a value or Keep. The dialog shows how many cells will change before you press OK, and OK undoes in one step. GigaScreen has a Screen A and a Screen B group; in ULAplus, CLUT 0-3 takes the place of Bright and Flash. Cancel changes nothing.

### Pixels

The Pixels items in the Image menu change the pixels and leave the attributes in their cells. Flip Horizontal and Flip Vertical mirror the pixels. Invert Pixels and Attributes inverts the pixels and also swaps the Ink and Paper of each cell, so the picture looks the same. It is not offered in modes with no cell attributes (Layer 2, LoRes, Timex Hi-res), and it is greyed out while a stamp is floating. In ULAplus and ULANext it is not offered either, because swapping Ink and Paper would change how the picture looks.

The Move choice in the Shift section of the Transform panel decides what moves. Pixels and attributes (the default) moves whole cells with their Paper. Pixels only moves the pixels a pixel or a cell at a time. Attributes only moves cell attributes one cell at a time. The pad has the four diagonals as well as the four sides. While a stamp is floating, Move is greyed out, because a shift moves the whole stamp.

The arrow keys follow the same Move choice when something is selected.

### Stamps

When a stamp is engaged, the **Transform** panel shows how it is placed.

**Attributes** chooses between Pixels only and Own attributes. Pixels only places the stamp's pixels in the attributes on the attribute bar, as it always did. Own attributes places the attributes the stamp carries, cell by cell: a stamp from the Map Editor, or one copied from a picture in a mode with cell attributes. A stamp copied from the picture starts as Pixels only, so a paste lands exactly as before. Own attributes puts the stamp on whole cells, ignores the draw mode, the colour rail and the XOR switch, and cannot be scaled, rotated, bent, flipped, inverted or outlined; the panel greys those out and says why. Reshaping a Pixels only stamp throws away the attributes it carried. Inverse still swaps what the ink and paper pixels do. If the stamp's cells are a different size from the current screen mode's, only Pixels only is possible.

**Show through** (Own attributes only) lets the attribute already on the page show through instead of the stamp's. Ink, Paper, Bright and Flash each have a box. ULAplus has one CLUT box for Bright and Flash together. In GigaScreen each box covers both screens.

**Paper pixels** decides what the stamp's paper pixels do. Leave background leaves the picture under them alone (a stamp with its own attributes still recolours the Paper under them, unless Paper shows through). Clear background makes the picture under them paper pixels too, over the stamp's whole rectangle. The draw modes with no opposite (XOR, Ink Recolour, Paper Recolour) and the stamp's own XOR switch leave the paper pixels alone, and the panel says so. Paper pixels is available in every screen mode, including those with no cell attributes.

**Convert to pixels only** drops the stamp's attributes for good and keeps its pixels. The Pixels only choice in Attributes keeps them, so you can switch back. Every change is one undo step.

While a stamp that places its own attributes is engaged, the Image > Attributes commands (Invert, Erase, both Flips and Change...) act on the stamp's cells instead of the picture, floating or parked. They ignore the selection and never touch the stamp's pixels, and a cell the stamp does not cover is left alone. Flips mirror the stamp's attribute cells while its pixels stay put. A GigaScreen stamp holds one set of attributes for both screens, so the Change dialog shows one group. Each command is one undo step. For a stamp without its own attributes they stay greyed out.
