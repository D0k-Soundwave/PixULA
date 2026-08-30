## Files

There are two different things you can save, and it matters which one you
reach for.

**A project** keeps your work as you left it: every layer, the palette, the
screen mode, your tools and their settings, the reference image and where you
were looking. This is a `.pixula` file, written by **File > Save Project**, and
it is what to use while a picture is still in progress.

**A picture** is one flattened screen in a format another program understands -
a `.scr` for an emulator, a `.png` to show someone, a `.tap` to load on real
hardware. **File > Save Image As** writes those. They hold the image and nothing
else, which is what you want when handing the result on, and not what you want
if you intend to keep working on it.

### Autosave and backups

PixULA saves your work into the browser's own storage every minute or so, and
offers it back if a session ends badly. That copy is always made and needs no
setting up.

You can also choose a folder on disk, and each autosave will write a numbered
version into it - `picture V1.pixula`, `picture V2.pixula`, and so on. The
numbering is read back from the folder each time, so reopening a picture
continues the sequence instead of starting again at V1, and two sessions on the
same picture share one set of versions. Set how many to keep in Preferences; the
default is 20.

One thing to expect. A browser will not re-open a folder you chose in an earlier
session without you confirming it, and the autosave timer cannot ask on your
behalf. So the first backup after a reload stops and waits for you. Preferences
has a **Resume Backups** button, and pressing it is the confirmation the browser
is waiting for.

{{formats}}
