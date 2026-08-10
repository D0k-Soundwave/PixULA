# Bench images

Drop real PNGs here and run:

    node tools/palette-bench.js docs/bench-images

Any size — they are box-filtered to 256x192 first, which is step 1 of the
pipeline anyway. 8-bit PNG, non-interlaced (RGB, RGBA, grey or palette).

Photographs are what conclusions should rest on. The synthetic set built into
the tool separates failure modes cleanly, which makes it good for *diagnosis*
and bad for deciding what ships: it has no film grain, no chroma noise, no
lens softness and no skin, and every one of those changes how a quantiser
behaves.

Nothing here is committed except this file.
