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

### Where the rules are different

Later hardware relaxed the constraint in various ways, and PixULA can work in
all of them. Timex machines made the colour grid finer. ULAplus replaced the
fixed sixteen colours with a palette you choose. GigaScreen alternates two
pictures fast enough to suggest colours neither one contains. The ZX Spectrum
Next drops the scheme entirely in its Layer 2 and LoRes modes, where every
pixel carries its own colour.

You can move a picture between any of them - see the next chapter.
