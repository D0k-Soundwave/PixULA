# Split the top colour bar into a vertical colour rail + a slim top strip — design

Status: approved in chat 2026-08-25 (base design + the active-state addendum).
Not yet implemented.

## 1. Motivation

`#color-bar` (the strip above the canvas) currently carries three unrelated
things at once: every screen mode's palette swatches, the Bright/Flash/Border
attribute controls, and the draw-mode/Mirror/Swap-Recolour "marks" group. To
keep that mixed content within two rows at every interface-size setting and
window width, `ColorBarFit` (`js/ui/components/colorbar-fit.js`) runs a live
binary search on every resize: it repeatedly sets `--colorbar-scale`, measures
row count via `getBoundingClientRect()`, and forces `#color-bar`'s own width
to match `#canvas-area`'s (`_pinWidth()`) — each step is a forced synchronous
layout. During a live window drag this fires on a 120ms debounce, and the
visible result is the reported flicker/wobble: the bar's icons visibly
resize/rewrap while the window is still moving.

The fix is architectural, not a tuning pass: pull the palette swatches out of
this bar entirely into their own vertical rail between the tool rail and the
canvas, sized by a fixed grid-column token and scaled only by the ordinary
`--ui-scale` every other chrome region uses — no independent auto-fit script
at all for swatches. What's left on the top strip (draw modes, Mirror,
Swap/Recolour, Border) is small enough that a much simpler, shrink-only,
single-row fit can guarantee it never wraps, without the two-row search or
the grow-to-fill behaviour added 2026-08-22.

## 2. Goals / non-goals

**Goals:**
- Ink/Paper/Bright/Flash and every other screen mode's palette UI (ULAplus
  CLUT, Next RGB333 grid, Timex scheme picker, GigaScreen view toggle) move
  into a new vertical `#color-rail` between `#toolbar` and `#canvas-area`,
  full height like `#toolbar`.
- Swatches in the rail are always exactly `--ui-scale` sized — no
  independent scale knob, ever. The rail auto-*arranges* its content (CSS
  grid reflow into a narrow column) but never auto-*sizes* it.
- The rail scrolls vertically (`overflow-y: auto`) for palettes taller than
  the available height (the 256-entry Next grid, mainly); it never needs to
  scroll sideways.
- Draw modes, Mirror, Swap/Recolour and Border stay on the top strip
  (`#color-bar`) and that strip **always renders as one row**, at every
  interface-size setting and every window width down to the existing 800px
  floor — no wrap, no horizontal scroll hiding a control off-screen.
- Selecting/toggling any control's active state (a draw mode, Mirror, a
  swatch, a CLUT, Swap/Recolour) never changes that control's own box size,
  and never changes `#color-bar`'s or `#color-rail`'s outer box size —
  no resize-on-select, anywhere in either region.
- Existing element IDs survive unmoved in identity (`#toolbar-color`,
  `#clut-cluster`, `#colour-bits`, `#border-host`, `#draw-modes`,
  `#mirror-modes`, `#attr-tools`) so `tests/browser/modes.spec.js`'s
  ID-based lookups keep working without changes.

**Non-goals:**
- No grow-to-fill behaviour on the top strip (dropped, not carried over from
  the current `ColorBarFit`) — it was never requested for this bar and it is
  one more thing that can visibly move during a resize.
- No change to what any control DOES, only where it renders and how it's
  sized. `ClutBar`'s click/keyboard handling, `ColorManager` interactions,
  `DrawModeBar`'s mode logic, and `BorderControl` are untouched.
- No change to the four narrow-window/hidden-panels breakpoints already in
  `css/layout.css` beyond adding the new column to each of them.

## 3. Grid structure

`#app`'s grid gains a fourth column, `colorrail`, between `toolbar` and the
canvas column. It spans both rows `toolbar` currently spans (full height,
not just the row above the canvas the way today's `colorbar` row does):

```
grid-template-areas:
    "header    header    header   header"
    "toolbar   colorrail colorbar panels"
    "toolbar   colorrail canvas   panels"
    "status    status    status   status"
grid-template-columns:
    calc(var(--toolbar-width) * var(--ui-scale))
    calc(var(--colorrail-width) * var(--ui-scale))
    1fr
    calc(var(--panel-width) * var(--ui-scale))
```

`--colorrail-width`: starting value ~140px — **[C]**, computed from two
`--clut-btn-size` (39px) swatch columns + a 2-3px grid gap + rail padding +
room for a vertical scrollbar, the same reasoning `--toolbar-width: 128px`
already documents for its own "2-wide tool grid + padding + scrollbar". Not
measured against the real rendered content yet; tune it once the rail is on
screen rather than treat it as fixed.

`#color-rail` joins the plain `zoom: var(--ui-scale)` block that
`#header`/`#toolbar`/`#panels`/`#status-bar`/`#canvas-controls` already share
in `css/layout.css` — explicitly NOT the `--colorbar-scale`-multiplied rule
`#color-bar` has today. This is the mechanism that satisfies "fixed size,
scales only with UI zoom": there is no second scale variable for this region
at all.

The narrow-window and hidden-`#panels` breakpoints further down
`css/layout.css` (currently collapsing to a 2-column `toolbar 1fr` grid) gain
the `colorrail` column in the same places `toolbar` appears today.

## 4. What moves where

Keeping every listed ID exactly as it is today, only their DOM parent and the
CSS that lays them out change:

| Element | Today | After |
|---|---|---|
| `#toolbar-color` (→ `#clut-cluster`) | child of `#color-bar` | child of new `#color-rail` |
| `#colour-bits` (Bright/Flash + GigaScreen view) | child of `#toolbar-attrs` in `#color-bar` | child of `#color-rail` |
| `#toolbar-attrs` | wraps `#colour-bits` + `#border-host` | wraps only `#border-host` |
| `#border-host` | child of `#toolbar-attrs` | unchanged (stays on top strip) |
| `#color-bar-controls` (draw modes / Mirror / Swap-Recolour) | child of `#color-bar` | unchanged |

`#color-bar` therefore ends up with exactly two children:
`#toolbar-attrs` (now just Border) and `#color-bar-controls` (the marks
group). `flex-wrap: wrap` is unchanged (see §6 for why it stays) — only the
row target the fit search enforces changes, from 2 to 1.

`ClutBar.init()` (`js/ui/components/clut-bar.js`) changes only its
`document.getElementById('toolbar-color')` / `getElementById('colour-bits')`
lookups implicitly still work (same IDs, new location) — no logic change,
only the containers' position in `index.html` and their CSS.

## 5. Inside the rail

Every cluster `ClutBar._rebuildSwatches()` builds today as a horizontal
flex/grid row gets a `#color-rail`-scoped override reflowing it into a
narrow vertical arrangement — pure CSS, no JS measurement:

- **Classic (fixed16):** Ink group, then Paper group, stacked vertically
  (was side by side). Each group's 8-swatch row becomes a 2-column CSS grid
  (`grid-auto-flow: row`, 4 rows deep) instead of a single row of 8. Bright/
  Flash toggles and the GigaScreen view row (when present) sit below both,
  also stacked.
- **ULAplus (`ulaplus64`):** CLUT selector (0-3) as a row of 4 (fits the
  rail width directly), then the ink half, then a horizontal divider (was
  vertical), then the paper half — each half a 2-column grid as above.
- **ULANext (`rgb333`):** normal-palette grid, horizontal divider,
  bright-palette grid, stacked.
- **Timex (`timexMono`):** the 8 hi-res scheme swatches as a 2-column grid.
- **Indexed Next (256-entry):** the one exception the current code already
  documents as unable to wrap — today it's `grid-auto-flow: column` with 2
  fixed rows, scrolling sideways. In the rail this flips to
  `grid-auto-flow: row` with a fixed column count (matching the rail's
  width, e.g. 4-8 columns of the existing 18px "dense" swatch size),
  scrolling vertically instead — `#color-rail`'s own `overflow-y: auto`
  handles it, no special-case scroll container needed.

`#color-rail` itself: `overflow-y: auto; overflow-x: hidden;` — the rail
never needs to scroll sideways, and every reflow above is designed so its
content never exceeds the fixed column width.

## 6. Top strip: guaranteed single row

`ColorBarFit` is cut down to only the two containers left in `#color-bar`.
Kept from the current implementation: the shrink-only binary search
(`_shrinkToFit`), the `FLOOR` (0.15) as a last-resort minimum, and
`_pinWidth()`'s cross-check against `#canvas-area`'s real width (a genuine
Chrome grid/zoom measurement bug, found 2026-08-12, unrelated to what's being
removed here). Dropped: the grow-to-fill branch (`_growToFill`, added
2026-08-22) — not requested for this bar, and one less live-resize behaviour
that can visibly shift content.

The target changes from "fits `MAX_ROWS = 2`" to "fits 1 row, always" —
`_rowCount() <= 1` is the search condition. `#color-bar` KEEPS
`flex-wrap: wrap` (not `nowrap`): wrapping is how the search measures "does
this scale still fit one row" in the first place (row count is read from
`getBoundingClientRect().top` bucketing, same technique as today) — switching
to `nowrap` would remove the thing being measured and let content silently
overflow the container instead of ever wrapping to a row the search could
detect. What changes is only the target (1, not 2) and the practical effect:
because the target is stricter, the search settles on a smaller scale more
often than today's 2-row version did, but the mechanism itself is unchanged.
No behaviour change to WHEN it runs: resize, `--ui-scale`
change, screen-mode change, locale change, focus/visibility regain — same
event list as today. Explicitly NOT triggered by selecting a draw mode,
toggling Mirror, or engaging Swap/Recolour (none of those emit any event
`ColorBarFit` listens for today) — this is what keeps "select a mode" and
"the strip resizes" independent, per the addendum below.

## 7. Active-state addendum: selecting never resizes anything

Two guarantees, one already true of the codebase's existing conventions and
one to make explicit and pin with a test:

1. **A control's own box never changes size when it becomes active.**
   Already the pattern everywhere being touched here: `.tool-btn.active`
   and `.panel-button.active` (`css/components.css`) only swap
   `background`/`border-color`/`color` — border-width and padding are
   identical in both states. `.color-swatch.active-ink` uses `outline`
   (doesn't participate in layout) and `.active-paper` an absolutely
   positioned `::after` (doesn't affect the swatch's own box). Every new
   rule this design adds (the rail's reflowed grids) follows the same
   pattern: no rule introduced here may vary `border-width`, `padding`,
   `width`, or `height` between a control's rest and active states.
2. **Neither region's outer box changes size when something inside it is
   selected.** `#color-rail`'s width is the fixed `--colorrail-width` grid
   column — nothing inside it can widen that column, and its height is
   whatever the grid row gives it (full height, like `#toolbar`), with
   overflow handled by scrolling, never by growing. `#color-bar`'s
   `ColorBarFit`-driven scale is retriggered only by the event list in §6,
   none of which fire on an active-state change — selecting a draw mode
   cannot start a new shrink search.

## 8. Testing impact

- `tests/browser/shell.spec.js`'s `ColorBarFit` describe block (the
  two-row search, the `_margined()` DPR test, the `#toolbar-attrs`
  bright/flash/border grouping check, the swatches-never-in-marks check)
  needs rewriting for the new split: retarget row assertions from 2 to 1,
  drop the grow-to-fill assertions, move the swatch/caption pitch checks to
  `#color-rail`.
- `tests/browser/modes.spec.js`'s `#toolbar-color`/`#attr-tools` ID-based
  lookups are expected to keep passing unmodified (IDs don't move).
- New assertions to add: `#color-rail`'s `getBoundingClientRect()` width is
  unchanged before/after selecting an ink colour, changing CLUT, and
  switching screen mode (classic and one indexed mode); `#color-bar`'s
  outer box and `--colorbar-scale` are unchanged before/after clicking a
  draw mode, toggling Mirror, and engaging Swap/Recolour.
- A new vertical-reflow/scroll spec for the rail: classic mode fits with no
  scrollbar at the default window size; an indexed 256-entry mode does
  scroll vertically and every swatch is reachable by scrolling (no swatch
  permanently clipped, mirroring the existing "a colour you can't see" concern
  the current wrap-not-scroll rule was written to avoid).

## 9. Figures register

| Figure | Value | Tag | Source |
|---|---|---|---|
| `--clut-btn-size` | 39px (44px `pointer: coarse`) | M | `css/components.css` |
| `--toolbar-width` | 128px | M | `css/variables.css`, documented as "2-wide tool grid + padding + scrollbar" |
| `--colorrail-width` (proposed) | ~140px | C | two 39px columns + gap + padding + scrollbar, same reasoning as `--toolbar-width`; not yet measured against real rendered content |
| ColorBarFit `FLOOR` | 0.15 | M | `js/ui/components/colorbar-fit.js`, carried over unchanged |
| Draw-mode buttons | 6 | M | `js/ui/components/draw-mode-bar.js` `MODES` |
| Mirror buttons | 3 | M | same file, `MIRROR_MODES` |
| Swap/Recolour buttons | 2 | M | `js/ui/components/clut-bar.js` `_buildAttrOps` |

The only figure here that's a real constraint rather than a starting point is
`--colorrail-width`, and it's flagged as such — implementation should verify
it fits every palette model's rail-reflowed content (§5) rather than trust
the arithmetic.
