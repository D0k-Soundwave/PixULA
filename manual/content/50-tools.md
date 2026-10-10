## The tools

The rail groups tools by what they do to the picture: first everything that
lays down ink, then selection, then the guide that selection powers, then the
tools that place finished artwork, then the ones that only change your view.

The draw mode, the mirror setting and the drawing guide apply to every tool
here, so they are set once in the colour bar instead of appearing in every
tool's options.

![The tool options panel showing the brush settings](img/tool-options-brush.png)

*The options for the selected tool appear in this panel - here, the brush.*

The brush has no crosshair over the picture. At size 2 and up, the outline of
the area it will paint is the pointer. At size 1 the pointer is a small plus
three pixels across, and the dot in its middle is the pixel the brush will
paint, in the colour it will paint: your ink with Bright applied, or the cell's
own ink when Ink is set to use the existing colour. While you draw, the dot
shows what you have just painted. Over the grey area around the picture the
normal pointer comes back. The Spray, Fade, Pattern and Hatch tools work the
same way.

Many options only apply in combination with another. The tables below have a
**Shown when** column giving the condition under which each row appears; rows
marked "always" are there whatever else is set.

**Point figures.** The Shape list has a group of Figures, drawn by placing points: Polyline, Polygon, Triangle, Rays, Perpendicular line and Parallel line (the L key picks the Figure tool). Click to add a point, or press and drag for a freehand run. A double click or Enter finishes the figure, which stays on the picture as a preview you can still change; Enter again draws it, as one undo step. Backspace removes the last point (a whole freehand run at a time), Escape drops the figure without drawing it, and clicking elsewhere or choosing another tool draws it. The Triangle, Perpendicular line and Parallel line finish by themselves at their third point: drag out the first line, then click the last point. A Perpendicular line adds a second line from the foot of the perpendicular from your point to the first line; a Parallel line adds a copy of the first line with your point at its middle. Rays joins every later point to the first. Polygon and Triangle can be filled. Figures follow the draw mode, Inverse, the "use existing" boxes, mirroring and the drawing guide like any shape, and in the preview exactly as they will be drawn.

**Line style, Rotation and Rounding.** The Shape tool, the Figure tool and the Bezier curve share a Line style: Solid, Dashed, Dotted, Dash-dot, Dash-dot-dot and Clear. The dash styles are drawn on a one-pixel line only, so they are greyed out above a thickness of 1; the pattern runs along the outline, round the corners, and each ray or line of a figure starts its own. Clear draws no outline, so use it with Filled to draw just the inside. The Bezier curve has no Clear. Rotation (-180 to 180 degrees, clockwise) turns a rectangle, square, rounded rectangle, ellipse or parallelogram round the middle of its box, and turns an arc, sector, triangle, diamond or regular polygon round the point you pressed. Rounding sets how round the corners of the rounded rectangle are, from square corners at 0 to half-circle ends at 100. A Bezier curve you are still editing is drawn when you pick another tool, and Escape drops it. The preview of a shape or curve shows the mirrored copies and keeps inside the drawing guide, as the finished drawing will.

**Editing, moving, turning and cloning a figure.** A finished Figure, and a Bezier curve, stay on the picture as a preview until you draw them. While one is waiting you can drag any of its square points to reshape it, drag the figure itself to move it, drag the round knob above it to turn it, and use the arrow keys to move it (one pixel, or one cell with Shift or with grid snap). Ctrl+Z takes back the last of these edits, then the figure itself, and only then the picture. Enter, a click elsewhere, saving or choosing another tool draws it, as one undo step. A shape from the Shape tool normally draws as soon as you let go; tick **Keep editable** in its options and it waits like a figure, with a handle on each end of the drag. **Edit > Clone Last Figure** (Shift+C) opens a copy of the last figure, shape or curve you drew, ready to move, turn or change; to change the colours or line style of one you have already drawn, press Ctrl+Z and then Clone Last Figure. While a figure is waiting it follows the colours, line style and fill you choose, as the finished drawing will.

{{tools}}
