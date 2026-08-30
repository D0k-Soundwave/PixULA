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

The **eraser** does something different from either. As well as clearing dots it
empties the cell of colour: paper and flash go as soon as you touch the cell,
and ink and bright go when the last dot in it is cleared. Those two wait because
the ink colour belongs to all 64 dots at once, and dropping it earlier would
recolour dots you had not erased yet.

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
