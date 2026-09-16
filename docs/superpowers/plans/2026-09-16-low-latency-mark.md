# Low-Latency Stroke and Mark - Plan

**Goal:** make the ink and the tool's mark land closer to the pen tip, on the
artist's own machine and tablet, and prove it with measurements taken there.

**Status:** plan only. Nothing here is built. Since the brush-cursor commit
the tool's mark IS the hardware cursor (its size at the current zoom, its
colours), so it no longer trails the pen - except where Chrome refuses the
image (over 128 DIP, or crossing the window edge) and the app draws it
instead. What still trails by at least one refresh is the INK, and that
fallback mark. This plan is about those two.

---

## 1. What is already true (read this first)

**The main canvas already asks for the low-latency path.** Commit `78dda45`
(2026-08-12) set `desynchronized: true` and `alpha: false` on the main
canvas context in `js/core/canvas-system.js`. So "turn on low-latency mode"
is not a one-line fix waiting to be written. It was written a month ago.

**Nobody has checked that Chrome actually takes that path.** The hint is a
request, not a guarantee. The browser may quietly fall back to normal
compositing. Things in this app that could cause the fallback:

- the canvas is 256x192 and scaled up with CSS
- it sits inside an iframe
- nine other canvases share the iframe with it: three grids, two previews,
  the selection, the reference photo, the cursor layer and the pointer layer
  (counted in `index.html`, 2026-09-16)

Whether any of these defeats the hint on the artist's hardware is **unknown
(A)**. That question is Phase 0, and every later phase depends on its answer.

**Where the wait comes from today, in order along the path:**

1. **The browser delivers the pointer event.** This is outside the app's
   control, and on most platforms it is aligned to the display refresh.
2. **The move handler writes pixels and marks cells dirty.** This takes
   0.11 ms per move for a size-16 brush and 0.55 ms for a size-64 eraser
   (M, 2026-09-16, headless Chrome, `tool-bench.js` at 400% zoom).
3. **The rAF render loop flushes the dirty cells** on the next animation
   frame (`CanvasSystem._startRenderLoop`). From entering the handler to the
   end of that render took 7.3 to 7.7 ms (M, 2026-09-16, headless Chrome,
   `latency-bench.js`, median over a drag). Headless Chrome has no real
   display, so this measures the app's own queueing, not what reaches the
   glass.
4. **The compositor presents the frame.** At 60 Hz that is up to 16.7 ms
   later (C: 1000 / 60).
5. **The display scans it out.** This is panel-dependent and unknown (A).

The mark is drawn inside step 2 (on `#pointer-canvas`), so it rides the same
steps 4 and 5 as the ink. It does not wait for step 3.

**The yardstick.** The Chrome team's article on `desynchronized` cites about
50 ms as the point where hand-eye coordination notices a stylus lagging (P,
developer.chrome.com/blog/desynchronized, read 2026-08-12, not re-checked
since). The artist reported that the mark trails and that ink lands late, so
on their hardware the whole path is presumably near or over that figure.
"Presumably" is the weak point: **no end-to-end figure exists for their
hardware.** Phase 0 exists to produce one.

---

## 2. Phases

Each phase ends in a measured before-and-after on the artist's hardware. A
phase that does not move that number is reverted, not kept "because it should
help". Two "obvious" performance wins in this repo have already measured worse
(see the perf baseline memory).

### Phase 0 - Measure on the real hardware (no app change)

- [ ] **End-to-end, filmed.** Draw a fast line on the tablet and on the
      desktop while filming with a phone in slow motion. At 240 fps each frame
      is 4.2 ms (C: 1000 / 240). Count the frames between the pen tip passing
      a point and the ink appearing there. Do the same for the mark. This is
      the only measurement that includes steps 4 and 5, and it needs nothing
      but a phone. The artist can do it; the app needs no change.
- [ ] **In-app probe.** Add a debug-only readout, behind a Preferences
      developer flag and never on by default. It reports
      `performance.now() - event.timeStamp` at the end of the render that
      carries each move, as a median and p95 over the last 200 moves. This
      covers steps 1 to 3 on the real browser and real display rate.
- [ ] **Is the low-latency path taken?** In Chrome, open `chrome://gpu` and
      record a `chrome://tracing` capture of a stroke. Look for the canvas
      being promoted to an overlay (the desynchronized path) or composited
      normally. Record the answer per machine.

**Gate:** if the filmed lag is already under the ~50 ms yardstick on both
machines, stop here and report that. The remaining complaint is then
perception of the one-refresh trail, which Phase 2 addresses and nothing else
can.

### Phase 1 - Stop waiting for the next animation frame

- [ ] On `pointermove` during a stroke, flush the dirty cells to the canvas
      at the end of the handler (`CanvasSystem._render()` directly) instead of
      only setting `renderPending`. Coalesce so a burst of moves still flushes
      once per event.
- [ ] Measure with the Phase 0 probe and the film.

**Downside, stated first:** Chrome already aligns pointer events to just
before the animation frame on most platforms. If it does so here, the saving
is zero and the change only adds work per move (a full `putImageData` can run
twice per frame). This is expected to help most where events arrive unaligned,
such as high-rate pens. That expectation is itself unmeasured (A), which is
why the gate is a measurement.

### Phase 2 - Predicted position for the FALLBACK mark only

The hardware brush cursor needs no prediction. This phase applies only to the
app-drawn mark shown where the cursor image is refused.

- [ ] During a stroke, draw the mark at the last point from
      `PointerEvent.getPredictedEvents()` where the browser provides one, and
      fall back to the newest coalesced sample.
- [ ] **Never predict the ink.** Ink written at a predicted point that the pen
      does not reach cannot be taken back without an undo-visible correction.
      The mark is redrawn every move, so a wrong guess costs one frame.

**Downside:** on a sharp change of direction the mark overshoots the corner
for a frame. How far it overshoots depends on the browser's predictor, which
is not documented to a figure (A). If the artist finds the overshoot worse
than the trail, this phase is reverted. It is a taste call that only the
artist can make.

### Phase 3 - Make `desynchronized` effective where Phase 0 found it is not

This phase only runs if Phase 0 showed the canvas is NOT on the low-latency
path. The candidates are ordered from cheapest to most invasive, and each is
measured before the next is tried:

- [ ] Give the pointer canvas its own `desynchronized` context. It is
      transparent, and a transparent canvas may not qualify for the fast path
      (A, verify in tracing).
- [ ] Test whether the stacked overlays are what defeats promotion. Hide them
      with a debug flag and re-trace. If they are, try rendering the grids
      into the main canvas's frame instead of stacking separate canvases.
- [ ] Test whether the CSS upscale defeats it. Try a device-pixel-sized canvas
      that the app scales itself with `drawImage`, nearest-neighbour. **This
      is the invasive one:** zoom, grids and hit-testing all assume the CSS
      scale today, and it touches `CanvasSystem`, `GridOverlay` and
      `InputHandler`.

**Downside:** the desynchronized path can show tearing or flicker if a frame
is presented mid-update. The render loop writes whole cells with
`putImageData`, which is the pattern the Chrome article recommends, but
partial dirty-cell updates have not been checked for tearing (A).

### Phase 4 - Report and decide

- [ ] Before-and-after table per machine: filmed ms, probe median and p95,
      path taken.
- [ ] The artist decides which phases stay.

---

## 3. What this plan cannot fix

- **Step 5, the panel's own response time.** No page can change it.
- **Safari on iPad.** The WebKit side has not been checked for
  `desynchronized` or `getPredictedEvents` support. Whether either exists
  there is unknown (A); check the platform before promising the tablet
  anything.
- **A mark that trails by exactly zero.** Anything a page draws is presented
  by the compositor at least one frame after the event. Only the system
  cursor avoids that, which is why the brush itself is the system cursor.

---

## 4. Figures register

| Figure | Value | Tag | Source / working |
|---|---|---|---|
| Handler cost per move, brush 16 drag | 0.11 ms | M | 2026-09-16, `tool-bench.js`, headless Chrome, 400% zoom, two runs |
| Handler cost per move, eraser 64 drag | 0.55 ms | M | same |
| Handler cost per move, brush 16 hover (after `b4d4a52`) | 0.11-0.12 ms (was 0.06) | M | same, back to back against `38888f3` |
| Handler cost per move, eraser 64 hover (after `b4d4a52`) | 0.50 ms (was 0.29) | M | same |
| App-added ink lag, handler to end of render | 7.3-7.7 ms | M | 2026-09-16, `latency-bench.js`, headless Chrome; excludes compositor and display |
| One refresh at 60 Hz | 16.7 ms | C | 1000 / 60 |
| One slow-motion frame at 240 fps | 4.2 ms | C | 1000 / 240 |
| Stylus lag noticed by hand-eye coordination | ~50 ms | P | developer.chrome.com/blog/desynchronized, read 2026-08-12 |
| End-to-end lag on the artist's desktop | unknown | A | Phase 0 |
| End-to-end lag on the artist's tablet | unknown | A | Phase 0 |
| Low-latency path actually taken | unknown | A | Phase 0, `chrome://tracing` |
| Prediction overshoot on a corner | unknown | A | Phase 2, the artist's judgement |

**The A figures that carry weight:** whether the desynchronized path is taken
decides whether Phase 3 runs at all. The two end-to-end figures decide whether
there is anything left to fix after Phase 0. None of the three can be measured
headless; they need the artist's machines.
