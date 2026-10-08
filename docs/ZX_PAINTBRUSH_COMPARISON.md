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

**Totals** [M, counted from the tables below]: 114 functions; PixULA is below
parity on 64 (32 missing, 32 partial), level on
38, ahead on 10, and 2 do not apply to a browser app.
Before Batch 1 (2026-10-08 morning) the count below parity was 69 (34 missing, 35
partial).

---

## Part 1 - Attributes, Bright and Flash

50 functions: 19 same, 1 where PixULA goes further, 13 partial, 17 missing, 0 not applicable.

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
| ULAplus CLUT grid | In ULAplus mode the bright/flash controls become a CLUT picker; keys 0 to 3 choose the CLUT. | CLUT selector replaces Bright and Flash, with one "use existing" box that keeps each cell's CLUT (2026-10-08). No 0 to 3 keys. | Partial |
| Pipette | Sets all four controls from the clicked cell; never sets transparent. | Eyedropper picks the whole cell, Bright and Flash included, and clears "use existing". | Same |

### Drawing mode bar

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Drawing (pixels) switch | Turn pixel drawing off so any tool writes colours only. Combined with the per-colour transparency above, any mix is possible, e.g. paper and flash only. | Pixels Only, Ink Recolour and Paper Recolour, combined with the four "use existing" boxes, give any mix, e.g. paper and flash only (2026-10-08). | Same |
| Filling switch | Shapes and the fill tool use the chosen fill style instead of solid. | Filled and Use pattern options on each tool. | Same |
| Inverse mode | Like BASIC INVERSE: tools reset dots instead of setting them; text and solid fills are reversed. | The right button draws paper (clears dots). No global switch, so text and fills can't be reversed in one go. | Partial |
| Over mode | Like BASIC OVER: dots are toggled. | XOR / Over, plus XOR / Every Pass. | PixULA further |

### Painting attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Free attributes tool | Paints the current colours onto every cell a freehand line touches, no dots. | Recolour button: click or drag over cells; each of the four parts follows its "use existing" box. | Same |
| Copy attribute tool | Pick up one cell's attribute with the first click, then paint it onto other cells. | Eyedropper, then Recolour: the same result in two steps. | Partial |
| Fill tool with pixels off | Floods a region of dots but writes colours only. | Fill tool in Ink Recolour or Paper Recolour mode. | Same |
| Wiping tool | Wipes dots away and sets the cells to the current colours; transparent channels are kept. Editable as a polygon afterwards. | Eraser clears dots and keeps colours; a second pass resets them. The right button in Normal clears dots and sets colours. | Partial |
| Colour attribute line thickness (option) | Thick lines colour only the cells under a 1-pixel or 4-pixel core, so less clash. | A thick stroke colours every cell it touches. | Missing |
| Attribute changes visible while drawing | Figures show their colours before they are finished. | Shapes, curves, gradients and stamps preview with the real colours. | Same |
| Re-colour the last figure (point mode) | Click a control point to give the last drawn figure the current colours, line and fill style. | No. Undo and draw it again. | Missing |

### Inverter tools - click cell by cell

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Attributes inverter tool | Swaps ink and paper of each cell clicked; snaps to cells. | Swap button. | Same |
| Pixels inverter tool | Inverts the dots of each cell clicked. | Select the cell with Cell Grid, then Transform > Invert. Two steps. | Partial |
| Pixels and attributes inverter | Inverts dots and swaps colours together, so the picture looks unchanged. Used to tidy imported pictures, where solid areas come in as inverted cells with holes. | No. | Missing |

### Edit attributes bar - selection or whole screen

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Invert attributes of selection | Swaps ink and paper of every cell in the selection, or the whole screen. | No one-step command. Swap has to be dragged over each cell. | Missing |
| Erase attributes of selection | Sets every cell in the selection, or the whole screen, to the current colours. | No one-step command. | Missing |
| Flip attributes horizontally | Mirrors the colours; the dots stay where they are. | No. Flip moves dots and colours together. | Missing |
| Flip attributes vertically | As above, top to bottom. | No. | Missing |
| Change attributes dialog | Find and replace: choose source ink, paper, bright and flash (any can be "any") and what to change them to, over the picture, selection or overlay. | Fill attributes only replaces one connected area of cells that match exactly. | Partial |

### Edit pixels bar and rolling

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Invert pixels of selection | Inverts the dots of the selection or screen; colours untouched. | Transform > Invert, and Image > Invert Colours, which does the same thing despite its name. | Same |
| Erase pixels of selection | Clears the dots; colours kept. | Edit > Delete. | Same |
| Flip pixels horizontally / vertically | Mirrors the dots; colours stay where they are. | No. Flip moves dots and colours together. | Missing |
| Roll or scroll pixels only | Moves the dots one pixel at a time; colours stay. | No. Shift always carries the colours with the dots. | Missing |
| Roll or scroll colours only | Moves the colours a cell at a time; dots stay. | No. | Missing |
| Roll or scroll both | Dots and colours together, 8 pixels at a time; wrap round (roll) or lose the edge (scroll); 8 directions, repeats while held. | Transform Shift: 1 pixel or 1 cell, wrap on or off, repeats while held. Four directions, no diagonals. | Partial |

### Seeing attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Colour grid | Shows attribute cells as a chessboard. | Cell grid draws lines around each cell. | Partial |
| Character grid | Lines between 8x8 cells. | Cell grid. | Same |
| Pixels grid | Lines between pixels at high zoom. | Pixel grid. | Same |
| User-defined grid | Grid at any X and Y step. | 16x16 block grid only. | Partial |
| Colour display switch | Hides colours and shows the dots in black and white. | No. | Missing |
| Flashing mode switch | Stops or starts flashing on screen. | No. Flash cells always animate. | Missing |
| Custom info bar | Shows the attribute value under the pointer, and the screen addresses of the pixel and of the attribute. | Shows X/Y and cell position only. | Missing |

### Overlays (pasted graphics) and attributes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Pixels-only or coloured overlay | When an overlay is made you choose: dots only (colours transparent) or full colour. | Stamps take the colours on the rail. Map-tile stamps bring their own colours. | Partial |
| Overlay INK / PAPER / BRIGHT / FLASH switches | Each part of the overlay's colour can be let through from the background instead. | Stamps follow the rail's four "use existing" boxes when placed (2026-10-08), but the setting is the rail's, not stored per stamp. | Partial |
| Overlapping or transparent overlay | Decides whether the overlay's clear dots also clear the background. | Stamps draw their set dots only; XOR mode is an option. | Partial |
| Convert colour overlay to pixels only | Drops an overlay's colours and keeps its dots. | No. | Missing |

### Attribute layout and palettes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Attribute format 8x8 / 8x4 / 8x2 / 8x1 | Changes cell height; coarsening keeps the most-used colours. | Screen modes Standard and Multicolor 8x4, 8x2, 8x1, same rule. | Same |
| Convert to Timex / to Spectrum | 8x1 colour and back. | Screen Mode menu. | Same |
| Four palettes P0 to P3 and four ULAplus palettes U0 to U3 | Flip between palettes with one click or key. | One palette per document. | Missing |
| Palette inverter | Swaps the ink and paper halves of the palette's CLUTs. | No. | Missing |
| Edit, load and save palettes | PAL files for any mode; ULAplus palette as a 151-byte TAP. | Palette editor in ULAplus and Next modes; .pal and .npl; ULAplus registers inside a 6976-byte .scr. No palette TAP. | Partial |
| Edit the standard Spectrum colours | Change, load or reset the colours used for the standard 15. | No. The standard palette is fixed. | Missing |

## Part 2 - Everything else

64 functions: 19 same, 9 where PixULA goes further, 19 partial, 15 missing, 2 not applicable.

### Draw tools

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Freehand | Draw with the mouse. | Brush, with eight engines, size 1 to 32 and pressure. | PixULA further |
| Freehand and line | Mix straight segments and freehand in one figure; Enter finishes. | No polyline tool. | Missing |
| Line | Two-point line. | Shape: line. | Same |
| Rays | Many lines from one start point. | No. | Missing |
| Curve | Four-point curve. | Bezier tool, quadratic or cubic, with draggable handles. | Same |
| Arc and sector | Four points; rotatable. | Shape: arc and sector from a box and an angle; not rotatable. | Partial |
| Orthogonal and parallel line tools | A second line at right angles to, or parallel with, the first. | No. | Missing |
| Ellipse and centred circle | Ellipse from corners (rotatable); circle from centre and edge. | Shape: ellipse and circle from a box; not rotatable. | Partial |
| Triangle tools | Free three-point, equal-sided and symmetrical triangles. | Shape: triangle from a box. | Partial |
| Rectangle, square, rounded rectangle, parallelogram | Rotatable; the rounding is adjustable. | All four exist as shapes; not rotatable. | Partial |
| Polygon, centred polygon, N-edge polygon | Free points, or regular around a centre. | Regular polygons from a box; no free-point polygon. | Partial |
| Ring | Elliptic ring with adjustable width. | Shape: ring with inner radius. | Same |
| Line arrow | Line with arrowhead. | Arrow shapes. | Same |
| Line styles | Solid, dashed, dotted, clear. | No. | Missing |
| Line thickness | Thickness setting for all lines. | Thickness 1 to 8. | Same |
| Point mode | Move points, move or rotate the last figure, delete its last point with Backspace. | Only the Bezier curve keeps editable handles. | Missing |
| Clone last drawn figure | Draws the last figure again, ready to move with the cursor keys. | No. | Missing |
| X and Y keys | Lock drawing to one axis. | Lock axis on the gradient only. | Partial |

### Special draw tools, fills and gradients

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Spray can | Spray with size and strength. | Spray brush with flow, weighting and Poisson spacing. | PixULA further |
| Spray pattern tool | Sprays little circles, squares or lines, each filled with the fill style. | No. | Missing |
| Fill tool | Flood fill with solid or a fill style. | Fill with pattern, contiguous or not, diagonal option. | PixULA further |
| Fill styles and fill style editor | Built-in 16x16 patterns, each editable. | Pattern library and Pattern Creator. | PixULA further |
| Custom fill style from a picture | Turns a picture file into a fill through the converter. | Patterns captured from the canvas or loaded as .pat. | Partial |
| Capture fill style | Uses the last captured area as the fill. | Pattern capture from a selection. | Same |
| Gradient fills and custom gradient | Linear, radial, circular, triangular, rectangular, pentagonal, hexagonal, octagonal; rotation, repeats, zoom. | Gradient tool: linear, radial, reflected, diamond, square, conical, spiral; repeats, curve, bias, steps, shape fills. | Same |
| Dithering styles | 31 methods: three thresholds, 14 error-diffusion kernels, three Bayer matrices, seven cluster-dot and four supercell screens, for gradients, fills and imports. | Gradient: Bayer 2x2, 4x4, 8x8. Fade: ordered, halftone, noise. Picture import: Floyd-Steinberg or none. | Partial |

### Capture, selection and overlays

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Capture ellipse, rectangle, polygon | Grab an area; move it, drag it (Shift) or copy it (Ctrl). | Select: rectangle, ellipse, lasso, cell grid; move or copy as a stamp. | Same |
| Selectors: 8x8, 16x16, whole screen, user-defined size | Selections that snap to fixed sizes. | Cell Grid selection and Snap to the attribute grid. No 16x16, screen or custom-size selector. | Partial |
| Adjust selection to 8x8 | Expands a selection to whole cells. | Snap (Shift+S). | Same |
| Export selection; new file from selection | Save just the selection, or open it as a new picture. | Save Image As saves the whole picture; .ctile export can slice a selection. No new file from selection. | Partial |
| Create, merge and delete overlay | Overlay from a selection; accept or throw away. | Copy and paste as a floating stamp; commit or cancel. | Same |
| Rotate overlay 90 / 180 degrees | Quarter and half turns. | Stamps rotate to any angle, flip, scale and bend. | PixULA further |
| Toggle overlay display (O key) | Hide an overlay without losing it. | Show/hide on each stamp. | Same |

### Text and fonts

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Windows text tool | Any font and size; left, centre, right; vertical anchor; four directions; shading in four corner directions; contour. | Text tool: system fonts, sizes, bold, italic, alignment, eight directions, mirror, shadow (one direction), outline. | Partial |
| Sinclair text tool | Type on the canvas at a flashing L cursor; 4x8, 6x8 and 8x8 fonts stretched to any width and height; character and line spacing. | Text tool with the ZX ROM font and library fonts at 4, 6 or 8 pixel advance, placed as a stamp. | Partial |
| Character set editing | CH4, CH6, CH8, CHR as a 16x16 map; press a key to find its character. | Font Editor for CH4, CH6, CH8, CHR and CHX. | Same |
| CHX big fonts | 8x8 up to 32x32 characters; edit as a map or one at a time; fill from a Windows font; proportional widths with the shader tool. | CHX read and write in the Font Editor; no fill-from-font or shading tool. | Partial |

### Maps

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Find and create map elements | Turns a selection into an element and finds every copy on screen, matching dots and colours, dots only, or by look. | Map Editor captures the canvas into 8x8 tiles and stores identical cells once (exact match only). | Partial |
| Map element list | Elements and their positions; import, export, placeholders (M key). | Map Editor with a tile palette and maps bigger than one screen. | PixULA further |
| ZXM files | Screen plus map elements. | .zxm, plus PixULA's own .zxtm. | Same |

### View and positioning

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Zoom | Up to 1600%; Ctrl+wheel; Ctrl + and -. | 100 to 1600%; wheel; + and -. | Same |
| Preview window | Miniature of the whole picture. | No. | Missing |
| Background picture (P key) | A picture behind the canvas with position and transparency. | Reference panel: position, scale, rotate, flip, opacity. | PixULA further |
| Raster jump 8x8, 16x16, 256x192, user-defined | The pointer moves in fixed steps. | Snap to the attribute grid; nudge step preference. | Partial |
| Cursor keys move the last figure | Pixel-by-pixel nudging of what you just drew. | No (stamps and selections move with the Transform panel). | Missing |

### Files and tapes

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| SCR, ZXP, MLT, SEV, CTILE, ZED | Read and write. | Read and write all of these. | Same |
| TAP/BLK, TZX, PZX with loaders | Tape files with a choice of loaders; turbo for TZX and PZX. | TAP and TZX with a BASIC loader that shows the screen. No PZX, no turbo loaders. | Partial |
| Disk images | DSK, TRD/SCL, MGT/IMG, with disk formats and loaders. | No. | Missing |
| Nirvana tiles (.btile) | 8x2-attribute tiles. | No. | Missing |
| Archives and Warajevo tapes | Reads zip, rar and 28 other archive formats, and Warajevo TAP. | No. | Missing |
| ZXB meta files | ZX-Blockeditor's container. | Left out on purpose; the Tape Blocks dialog covers tape blocks. | N/A |
| BMP, GIF, JPG, PNG | Read and write. | Read and write; GIF can animate Flash. | PixULA further |
| Picture converter | Brightness, contrast, size, crop, 31 dithers, black-and-white, colour, Timex, ULAplus via Image2ULAPlus, GIF frame picker. | Import dialog: brightness, contrast, fit/stretch/crop, Floyd-Steinberg, live preview; ULAplus palette built in; GIF first frame only. | Partial |
| File window | Edit each SCREEN$ block in a tape or disk file; add, delete, move blocks. | Tape Blocks dialog for tapes. | Same |
| Data block composer, memory and pulse editors, header changer | Build and edit any tape block byte by byte. | No. | Missing |
| ASM and BIN export settings | Number base, prefixes, bytes per line, line or block layout, attributes mixed in. | .asm, .c, .bin and .atr with a fixed layout. | Partial |
| Change picture size | Add or remove space around the picture. | No; the canvas size comes from the screen mode. | Missing |
| Print with preview | Print at any size over several pages. | No. | Missing |
| Run file; send to ZX-Editor or ZX-Blockeditor; command line | Windows integrations. | Not applicable to a browser app. | N/A |

### Clipboard and program

| ZX Paintbrush | What it does | PixULA | Verdict |
|---|---|---|---|
| Internal clipboard | Text-based ZXP format, shared between program windows. | Internal clipboard that survives a reload. | Same |
| Paste Windows graphic | Through the import converter. | System clipboard paste through the converter. | Same |
| Undo and redo | Configurable depth. | 500 steps with a memory cap. | Same |
| Options | Grid colours, three display sizes, info bar formats, PLOT coordinate range. | Interface size, themes, languages. No PLOT coordinates or grid colours. | Partial |
| Context help and hotkey list | Click-for-help and a shortcuts page. | Two-stage tooltips, a built-in manual in 13 languages, a shortcuts dialog. | PixULA further |

## PixULA functions with no ZX Paintbrush counterpart

- Layers (up to 32) with a compositor that follows the Spectrum's rules
- Mirror drawing (H, V, both) for every tool
- XOR / Every Pass: a stroke cancels where it crosses itself
- Fill attributes only: flood connected cells that share the same four values
- Brush engines: spray with weighting or Poisson spacing, fade, pattern, hatch; pressure
- 30+ shapes: star, heart, gear, flower, moon, spiral, house, arrows and more
- Gradient tool with seven types, curve, bias, steps and shape-constrained fills
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
batch gets its own plan when it is reached. Nothing here is rejected: where
something may not suit a browser app (print, disk images, archives), its batch
plan says what it would cost and the owner decides.

1. **Bright and Flash - DONE 2026-10-08.** "Use existing" for Bright and Flash in
   every mode and tool; one CLUT box in ULAplus; Shift+B / Shift+F / Shift+T.
   Still open from this area: the ULAplus 0-3 CLUT keys (batch 6).
2. **Attribute commands on a selection or the whole screen**: invert attributes,
   erase attributes, flip attributes H/V; a Change Attributes dialog (find and
   replace, any part may be "any"); pixels-only flip; pixels-only and
   colours-only shift; diagonal shift; a Pixels+Attributes inverter (inverts dots
   and swaps colours, so the picture looks unchanged - tidies imports).
3. **Seeing attributes**: colours-off (black-and-white dots) view; flashing
   on/off; chessboard cell grid; pointer readout of the attribute value and the
   pixel/attribute screen addresses; user-defined grid.
4. **Painting options**: attribute line thickness (colour only a 1- or 4-pixel
   core of thick lines); copy-attribute tool in one step; Inverse mode switch;
   wiping-tool behaviour (erase dots and set colours, honouring use-existing);
   a per-cell pixel inverter tool.
5. **Overlays (stamps)**: pixels-only vs coloured choice per stamp; per-part
   show-through stored with the stamp; overlapping vs transparent clear dots;
   convert a coloured stamp to pixels only.
6. **Palettes**: palette slots (P0-P3 / U0-U3) with quick switch; ink/paper CLUT
   inverter; editable standard Spectrum colours; ULAplus palette as a 151-byte
   TAP; 0-3 CLUT keys.
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
    print; PLOT coordinates and grid colours in Options; picture converter
    extras (black-and-white mode, GIF frame picker).
