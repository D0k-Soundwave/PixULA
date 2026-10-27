## Animation

PixULA animates in two ways. A **screen animation** changes the whole picture
from frame to frame. A **sprite animation** changes one block of it, a figure
walking or a flag waving, while the rest of the picture stays still behind it.
Both keep every rule of the screen mode: a frame is made of whole attribute
cells, so it never splits a cell's attributes.

### Starting an animation

**Animation > New Screen Animation** turns the picture into frame 1. Every
layer becomes Animated: it has its own contents in each frame.

**Animation > New Sprite Animation...** asks for a name, a width and height, a
position and how many frames to start with. The size is rounded up to whole
cells of the mode, and the dialog says what it became: in 8x1 mode, 20 x 20
becomes 24 x 20. Use selection takes the size and place from a selection. To
place the sprite by clicking, select the block first with the Selection tool
(Size: Custom). **New Sprite Animation from Selection** also moves the selected
block onto the sprite's own layer as frame 1. A dotted line just outside the
sprite's window shows where it is.

A picture can hold several animations; the picker at the top of the Animation
panel chooses the one that is open. The screen mode cannot change while the
picture has animations.

### Frames

The Animation panel shows each frame as a small picture with its number and
delay. Click one to go to it, or press `,` and `.` for the frame before and
after. You draw on the frame shown with every tool, exactly as on a still
picture: attribute clash, draw modes, Mirror, stamps, Flash and Undo all work
as always.

Add puts a blank frame after the one shown and Duplicate a copy of it; Delete,
Left and Right delete it and move it. The delay is how long the frame stays on
screen, in Spectrum frames of 1/50 s, and Set all gives every frame that delay.
To carry part of a frame into the next one, copy it (**Animation > Frame to
Stamp** copies a sprite's window), go to the next frame and place the stamp.
Undoing a step made on another frame takes you back to that frame.

**Animation > Stamps to Frames** makes a new frame from each stamp in the
Stamps list, placed where the stamp is parked; the stamps stay.

### Layers in an animation

While an animation is open, every row of the Layers panel has an Animated /
Shared switch. An Animated layer has its own contents in each frame; a Shared
layer looks the same in every frame, like a backdrop you draw once. Making a
layer Animated copies it into every frame; making it Shared keeps the frame
shown, and asks first. New layers join the open animation, and Merge Down,
Merge Selected and Flatten work on every frame.

### Playing

Play (Enter) plays the open animation on the picture; a sprite moves over its
backdrop, and FLASH and the GigaScreen flicker keep running. First, Previous,
Next and Last step through the frames (hold Previous or Next to keep stepping),
and Stop goes back to the frame playing started from. A click on the picture
or Escape pauses. Repeat plays the frames in a loop, once, or forwards and back
(Ping-pong). Speed plays faster or slower without changing the delays, and Play
frames plays only part of the animation.

### Tracing frames

**Trace** under a frame shows that frame faded while you draw the others, as a
preview layer in the Layers panel. The **Onion skin** switch shows the frame
before and the frame after in the same way, and they follow you as you change
frames. **Layer > New Preview Layer** adds one of them on its own.

A preview layer keeps the layer system's own rule: its paper pixels and empty
cells are clear, ink of the layers above it covers it, and it shows faded over
what is below. Move it up or down to put it over or under the layer you draw
on. Each one has its own Opacity, a tint (earlier frames red, later frames
blue) and show and hide, and deleting it removes only the preview. A preview is
never part of the picture: it is never drawn on, merged or exported, and it is
hidden while the animation plays.

### Exporting

**Animation > Export Animation**:

- **Numbered Screens...** saves every frame as its own Spectrum screen,
  numbered in order (`walk_001.scr`, `walk_002.scr` and so on), in any screen
  format the mode can save. Each file is exactly what Save Image As writes for
  that frame. You choose the name, the first number, the digits and the
  frames. Where the browser can write into a folder you choose one; otherwise
  the screens arrive as one `.zip`.
- **Animated GIF** plays the frames with their delays, FLASH and GigaScreen
  included.
- **PNG Sprite Sheet** puts the frames side by side, 16 across.
- **SevenuP, All Frames** writes up to 32 frames to one `.sev` (Standard mode).
  Opening a `.sev` of several frames makes a sprite animation of them.
- **Tape** writes one SCREEN$ per frame to a `.tap` or `.tzx`. It holds the
  screens, not a program to play them.
- **Next Sprites** writes a 16 x 16 sprite animation in the Layer 2 and LoRes
  modes as a `.spr` sheet.

Animations are saved in PixULA projects, in the recovery save and in backups.
