## Attribute clash

The Spectrum keeps a picture in two separate pieces.

The first is a bitmap: 256 by 192 dots, one bit each, on or off. The second is a
grid of colour, one byte for every 8 by 8 block of those dots - 32 bytes across
and 24 down. Each of those bytes holds which colour the **ink** should be (the
dots that are on), which colour the **paper** should be (the dots that are off),
whether the pair is **bright**, and whether it should **flash**.

So the shape of your picture has a resolution of 256 by 192, and its colour has
a resolution of 32 by 24. Any 8 by 8 cell can show two colours, and every dot
inside it is one or the other.

![Two diagonal lines crossing on a zoomed canvas with the cell grid shown. The blue line turns red inside every cell the red line also passes through](img/attribute-clash.png)

*A blue line and a red line crossing, at 800% with the cell grid on. Where the
red line passes through a cell, the blue line inside that cell is red too. The
red stroke arrived second and set the ink colour for the whole cell, including
the dots the blue stroke had already placed.*

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

**Draw modes.** A stroke does not have to change both the dots and the colours.
You can set dots and leave the colours alone, or recolour a cell without
touching a dot. The colour chapter lists them.

**The pattern library.** Its core is a set of tiles at measured ink densities,
which is what you reach for when a cell needs a grey it cannot hold.

### Seeing the dots

Three switches in the View menu change what the screen shows, without changing
the picture. **Colours Off** shows the dots in black on white, so you can see
which dots are really set. **Colour Grid** does the same and also tints the
cells like a chessboard, so the cell boundaries are easy to see; it and Colours
Off switch each other off. **Stop Flashing** holds every flashing cell in its
normal colours. None of them touches the picture, undo or an export: a saved
image looks the same whether they are on or off. The browser remembers them, and
a switch that cannot work in the current screen mode is greyed out - hover over
it to see why. On GigaScreen and MultiGiga, Colours Off shows four grey levels:
white where neither screen has a dot, light grey for a dot on screen A only, a
darker grey for screen B only, and black for both.

### Reading the pointer

The strip under the picture and the status bar say where the pointer is. In
**Preferences**, *Pointer readout shows* adds the attribute under the pointer
(its number in decimal and in hex, then ink, paper, bright and flash; the CLUT
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
all of them. Timex machines made the colour grid finer. ULAplus replaced the
fixed sixteen colours with a palette you choose. GigaScreen alternates two
pictures fast enough to suggest colours neither one contains. The ZX Spectrum
Next drops the scheme entirely in its Layer 2 and LoRes modes, where every
pixel carries its own colour.

You can move a picture between any of them - see the next chapter.
