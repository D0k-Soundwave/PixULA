## Patterns and dithering

A cell holding two colours has no mid-tone. To suggest one you interleave the
two colours you have and let the eye blend them, and the pattern library exists
to give you tiles that do that at known strengths.

To use one, switch on **Use pattern** in a tool that offers it - the fill and
the pattern brush both do - and pick a tile from the pattern panel.

The tiles named `density-NN` are generated, and the number is the actual
proportion of ink pixels in the tile: `density-25` has ink in a quarter of its pixels. The halftone and
noise families cover the same range of greys with a different texture, so you
can change how a shade looks without changing how dark it is.

You can also draw your own tiles in the Pattern Creator and keep them in your
own library alongside these.

**From picture.** The **From picture...** button in the pattern panel makes a fill from a picture file (PNG, JPG or GIF). A dialog shows the tile as it will repeat and offers Brightness, Contrast, Scaling, Tile size (8, 16 or 32 pixels square) and the same 31 Dither methods as the importer; the default is Floyd-Steinberg. The dark parts of the picture become ink pixels. OK adds the tile to your own library under the file's name - a second file with the same name becomes "name 2" and never replaces the first - and makes it the current pattern, ready for the fill and the pattern brush.

{{patterns}}
