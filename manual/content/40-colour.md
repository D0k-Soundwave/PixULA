## Colour

In the classic modes you are not choosing a colour for a pixel. You are
choosing the two colours a whole cell will use, plus two flags.

- **Ink** is the colour of the dots that are on.
- **Paper** is the colour of the dots that are off.
- **Bright** lifts both to their brighter versions. There is one bright flag
  per cell, so ink and paper are bright together or not at all.
- **Flash** swaps ink and paper about twice a second on real hardware.

The left mouse button draws ink. The right button draws paper: it clears the
dot and sets the same four values the left button would. On a pen, the barrel
button does what the right button does.

The **eraser** does something different from either. It clears dots and leaves
the cell's colours alone, even when it clears the last dot in the cell. To wipe
the colours as well, erase over the empty cell again with a new stroke: ink,
paper, bright and flash go back to black on white, and on an upper layer the
cell becomes see-through again. A cell that still has dots in it keeps its
colours however many times you erase over it.
The eraser's **Colours** option, shown in screen modes with cell colours,
changes this: Set to current clears the dots and gives the cell the colours in
the rail, as the wiping tool of ZX Paintbrush does, and Keep, the default, is
the behaviour above.

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
from the same button, works the same way, exchanging each cell's ink and paper.
Either one stays on until you switch it off - pick None, pick it again,
right-click the canvas, or choose a tool or a draw mode - and the status bar
says so while it is on.

**Copy colours, Invert dots and Invert dots and colours** are three more cell
tools in the same Cell tool button, and work the same way: pick one, then click
or drag over cells. Each drag undoes in one step, and the tool stays on until
you switch it off. **Copy colours** picks up the colours the cell under your
first click shows and gives them to every cell you drag over; the colour rail is
not changed. **Invert dots** turns the set dots of each whole cell clear and the
clear ones set, and leaves the colours (on a blank cell it fills it). **Invert
dots and colours** also swaps ink and paper, so each cell looks the same; it is
for tidying an imported picture, it skips cells that another layer also draws
in, and it is not offered in ULAplus and ULANext. A cell tool is offered only in
the screen modes it can work in: the Cell tool button lists just the ones that
apply (and is hidden where none do), and Invert dots also works in Timex Hi-res,
where the dots are in 8 by 8 cells.

**XOR / Over and XOR / Every Pass** both flip dots rather than set them, and
both give the cell your colours. XOR / Over flips each dot once per stroke, so
going back over your own line in the same stroke changes nothing more. XOR /
Every Pass flips a dot each time the stroke passes over it: one sweep of the
brush is one pass, however much the brush overlaps itself on the way, but a
stroke that leaves a dot and comes back flips it again, so a figure of eight
cancels where it crosses. Shapes, curves, fills and text are always a single
pass, so with those the two modes give the same result.

**Inverse** swaps what the two mouse buttons do: the left button clears dots and
the right button sets them, like BASIC's INVERSE 1. Switch it on in Preferences, or with Shift+I, and the status bar says "Inverse is on" while it is.
It changes nothing in Ink Recolour, Paper Recolour and the two XOR modes, which
give both buttons the same job, and the status bar says so. Text and stamps
clear their letters and shapes instead of setting them, a pattern lays its dots
as clears and its gaps as dots, and the fill tool fills with paper on the left
button and with ink on the right. The eraser, Swap and Recolour ignore it. It is
remembered between sessions and is saved in presets with the draw mode.

**Colour core.** For the round and square brush, shape outlines and the Bezier
curve, Colour core says how much of a thick line takes the cell colours. A line
always sets every dot. With Colour core on 1 pixel or 4 pixels, only the cells
under the middle of the line, a line that wide following its centre, take your
colours; the other cells under it get the dots in the colours they already had,
so a thick line clashes with fewer cells. Whole line, the default, colours every
cell the line touches. The option appears only in screen modes with cell
colours. With Mirror the mirrored line has a core of its own, and with XOR the
cells outside the core keep their colours.

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

### GigaScreen

GigaScreen keeps two whole screens and shows them alternately, fifty times a
second. Your eye mixes each pixel's two colours into one, so a cell that holds
one ink and one paper on each screen can show **four** colours, and the
picture as a whole can reach about a hundred.

You never draw on one screen at a time. Every stroke writes both, and the
colour rail works in pairs:

- **Screen A** and **Screen B** each have their own ink and paper swatches and
  their own **Bright**. Flash is one setting for both.
- **Paint** shows the four colours those choices make, mixed exactly as the
  canvas shows them: ink on both screens, ink on A only, ink on B only, and
  paper on both. Pick one and the left button paints it. The right button
  always paints paper on both screens.
- Pick the same ink for both screens and the top-left Paint swatch is that
  colour, solid - which is how to draw anything that should not look mixed.

The eyedropper picks all of this back up: both screens' colours and which of
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
  has no cell colours - each screen has one colour scheme for the whole
  picture - so the rail shows a scheme row for Screen A and one for Screen B,
  and Paint shows the four mixes of the two. These are `.hrg` files.

Switching between any of the two-screen modes keeps both screens, by the same
rules that convert a single screen.

### Attributes

The Attributes items in the Image menu change the colours of cells and leave
the dots where they are. Invert swaps ink and paper in each cell and keeps
bright and flash. Erase writes the current ink, paper, bright and flash to
each cell, and the "use existing" boxes keep what a cell already has. Flip
Horizontal and Flip Vertical mirror the cell colours. Each command works on
the selection (every cell it touches), or on the whole picture when nothing
is selected, and undoes in one step. The items are greyed out in modes with
no cell colours (Timex Hi-res, Layer 2, LoRes), while a stamp is floating,
and on a locked layer.

Change... finds cells by their colours and replaces them. Find sets which cells to match: each field is a value or Any. Replace with sets what they become: each field is a value or Keep. The dialog shows how many cells will change before you press OK, and OK undoes in one step. GigaScreen has a Screen A and a Screen B group; in ULAplus, CLUT 0-3 takes the place of Bright and Flash. Cancel changes nothing.

### Dots

The Dots items in the Image menu change the dots and leave the colours in their cells. Flip Horizontal and Flip Vertical mirror the dots. Invert Dots and Colours also swaps the ink and paper of each cell, so the picture looks the same. It is not offered in modes with no cell colours (Layer 2, LoRes, Timex Hi-res), and it is greyed out while a stamp is floating. In ULAplus and ULANext it is not offered either, because swapping ink and paper would change how the picture looks.

The Move choice in the Shift section of the Transform panel decides what moves. Dots and colours (the default) moves whole cells with their paper. Dots only moves the dots a pixel or a cell at a time. Colours only moves cell colours one cell at a time. The pad has the four diagonals as well as the four sides. While a stamp is floating, Move is greyed out, because a shift moves the whole stamp.

The arrow keys follow the same Move choice when something is selected.

### Stamps

When a stamp is engaged, the **Transform** panel shows how it is placed.

**Colours** chooses between Pixels only and Own colours. Pixels only places the stamp's dots in the colours on the attribute bar, as it always did. Own colours places the colours the stamp carries, cell by cell: a stamp from the Map Editor, or one copied from a picture in a mode with cell colours. A stamp copied from the picture starts as Pixels only, so a paste lands exactly as before. Own colours puts the stamp on whole cells, ignores the draw mode, the colour rail and the XOR switch, and cannot be scaled, rotated, bent, flipped, inverted or outlined; the panel greys those out and says why. Reshaping a Pixels only stamp throws away the colours it carried. Inverse still swaps what the set and clear dots do. If the stamp's cells are a different size from the current screen mode's, only Pixels only is possible.

**Show through** (Own colours only) lets the colour already on the page show through instead of the stamp's. Ink, Paper, Bright and Flash each have a box. ULAplus has one CLUT box for Bright and Flash together. In GigaScreen each box covers both screens.

**Clear dots** decides what the stamp's empty dots do. Leave background leaves the picture under them alone (a stamp with its own colours still recolours the paper under them, unless Paper shows through). Clear background clears it too, over the stamp's whole rectangle. The draw modes with no opposite (XOR, Ink Recolour, Paper Recolour) and the stamp's own XOR switch leave the empty dots alone, and the panel says so. Clear dots is available in every screen mode, including those with no cell colours.

**Convert to pixels only** drops the stamp's colours for good and keeps its dots. The Pixels only choice in Colours keeps them, so you can switch back. Every change is one undo step.
