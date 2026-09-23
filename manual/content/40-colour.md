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

### Draw modes

The draw mode changes what a stroke does, and it applies to every tool. It
persists between sessions, so the status bar shows it whenever it is set to
anything other than Normal - in some of these modes a stroke leaves nothing
visible, and you would otherwise have no way to tell why.

{{draw-modes}}

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
