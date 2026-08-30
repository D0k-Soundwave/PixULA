## Mouse, pen and touch

### Mouse

The left button draws ink and the right draws paper. Shift and right-click opens
the canvas menu, which is how to reach cut, copy and paste while a tool is using
the right button for drawing.

### Pen

The pen tip draws with the selected tool and cannot be reassigned. Every other
control on the pen can be, in **Preferences > Pen**.

Out of the box the barrel button draws paper, matching the right mouse button,
and the eraser end erases. The Preferences list also has the eyedropper,
panning, undo, redo, swapping the colours, the canvas menu and going back to
your previous tool.

Pressure changes brush size and flow by an amount you set. Tilt is used where
the pen reports it.

![The Preferences dialog, showing the pen section](img/dialog-preferences.png)

*Preferences. The pen section assigns each control on your stylus; the pen check
below it reports what the browser is actually receiving.*

If a button does not seem to do anything, try the **pen check**. Press each part
of the pen against the box and it lights up whatever the browser receives.
Tablet drivers vary in what they pass through - a second side button in
particular often does not reach the browser at all - and this tells you what
yours is doing.

{{pen}}

### Touch

A finger can do everything a mouse can, and you can turn drawing with it off
while keeping the rest. Two fingers pan and pinch to zoom, and a long press
opens the canvas menu.

Three separate rules stop a resting hand spoiling a stroke:

- A touch that arrives while a pen or mouse button is already down is ignored.
  That is the hand holding the device rather than a second person drawing.
- A touch that arrives shortly after the pen was last seen is ignored too. The
  length of that window is yours to set; the default is half a second.
- Touch drawing can be switched off entirely, leaving touch its panning and
  zooming.

That last one is in the status bar rather than in Preferences, because it is the
setting you are most likely to want mid-picture. It shows its state at all
times, and one click changes it.

A touch that is rejected does nothing at all - it does not pan the canvas
either. A stray palm that scrolled your view mid-stroke would be no better than
one that drew on it.
