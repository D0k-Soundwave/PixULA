## Attribute clash

The Spectrum keeps a picture in two separate pieces.

The first is a bitmap: 256 by 192 pixels, one bit each, an ink pixel or a paper
pixel. The second is a grid of attributes, one byte for every 8 by 8 block of
those pixels - 32 bytes across and 24 down. Each of those bytes holds which
colour the **Ink** should be (the colour of the ink pixels), which colour the
**Paper** should be (the colour of the paper pixels), whether the pair is
**Bright**, and whether it should **Flash**.

So the shape of your picture has a resolution of 256 by 192, and its colour has
a resolution of 32 by 24. Any 8 by 8 cell can show two colours, and every pixel
inside it is one or the other.

![Two diagonal lines crossing on a zoomed canvas with the cell grid shown. The blue line turns red inside every cell the red line also passes through](img/attribute-clash.png)

*A blue line and a red line crossing, at 800% with the cell grid on. Where the
red line passes through a cell, the blue line inside that cell is red too. The
red stroke arrived second and set the Ink for the whole cell, including the ink
pixels the blue stroke had already placed.*

This is what "attribute clash" means. Drawing in one part of a cell changes the
colour of everything else in it, and there is no setting that turns it off - it
is how the hardware works.

### Working with it

Most Spectrum artists plan their colour areas before their detail, arranging
the picture so that colour boundaries fall on cell boundaries. Where a cell
needs a shade it cannot hold, they dither: two colours interleaved finely
enough that the eye blends them.

PixULA helps with this in three ways.

**The cell grid.** Switch it on next to the zoom controls and you can see
exactly where a colour change is free and where it will cost you.

**Draw modes.** A stroke does not have to change both the pixels and the
attributes. You can draw ink pixels and leave the attributes alone, or recolour
a cell without touching a pixel. The colour chapter lists them.

**The pattern library.** Its core is a set of tiles at measured densities of ink pixels,
which is what you reach for when a cell needs a grey it cannot hold.

### Seeing the pixels

Three switches in the View menu change what the screen shows, without changing
the picture. **Attributes Off** shows the ink pixels in black and the paper
pixels in white, so you can see which pixels are really ink. **Colour Grid** does
the same and also tints the cells like a chessboard, so the cell boundaries are
easy to see; it and Attributes Off switch each other off. **Stop Flashing** holds every flashing cell in its
normal colours. None of them touches the picture, undo or an export: a saved
image looks the same whether they are on or off. The browser remembers them, and
a switch that cannot work in the current screen mode is greyed out - hover over
it to see why. On GigaScreen and MultiGiga, Attributes Off shows four grey
levels: white where neither screen has an ink pixel, light grey for an ink pixel
on screen A only, a darker grey for screen B only, and black for both.

### Reading the pointer

The strip under the picture and the status bar say where the pointer is. In
**Preferences**, *Pointer readout shows* adds the attribute under the pointer
(its number in decimal and in hex, then Ink, Paper, Bright and Flash; the CLUT
in ULAplus; both screens in GigaScreen) and the Spectrum memory address of the
pixel's byte and of its attribute byte. Addresses exist where the real machine
has a fixed layout: Standard ULA and ULAplus (the display file from $4000,
attributes from $5800), Timex hi-colour (attributes in the second display file
at $6000), Timex hi-res (even byte columns at $4000, odd ones at $6000) and
GigaScreen (screen A as standard, screen B in bank 7 at $C000; which screen
belongs to which bank is a convention). Other modes say they have no address.

*Y counts from* can be set to the bottom, so the readout reads like BASIC PLOT,
where 0,0 is the bottom left corner and Y runs from 0 to 175. That exists only
over the top 176 rows of a 256 by 192 picture; below that, and in other screens,
the readout shows a dash. It changes the readout only.

**Custom Grid...** in the View menu draws a grid at any X step and Y step, set
separately, and **Show Custom Grid** turns it on and off. Lines closer than four
screen pixels are left out until you zoom in. The grids you have switched on
come back the next time you open the program. In Preferences, *Grid colours*
sets the colour of each grid; leave *Theme colour* ticked and the grid follows
the theme.

### Where the rules are different

Later hardware relaxed the constraint in various ways, and PixULA can work in
all of them. Timex machines made the attribute grid finer. ULAplus replaced the
fixed sixteen colours with a palette you choose. GigaScreen alternates two
pictures fast enough to suggest colours neither one contains. The ZX Spectrum
Next drops the scheme entirely in its Layer 2 and LoRes modes, where every
pixel carries its own colour.

You can move a picture between any of them - see the next chapter.
