# Vertical Colour Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split PixULA's top colour bar into a fixed-size vertical colour
rail (between the tool rail and the canvas) plus a top strip that always
renders as exactly one row, eliminating the live binary-search auto-fit
that causes visible resize flicker.

**Architecture:** `#toolbar-color` (every screen mode's palette swatches)
and `#colour-bits` (Bright/Flash + GigaScreen view) move out of `#color-bar`
into a new full-height `<aside id="color-rail">` grid column, scaled only by
the ordinary `--ui-scale` every other chrome region uses (no independent
auto-fit). `#color-bar` keeps only Border and the draw-mode/Mirror/
Swap-Recolour "marks" group; `ColorBarFit` (js/ui/components/colorbar-fit.js)
is cut down to a shrink-only search guaranteeing that smaller content always
fits one row, with its now-unneeded grow branch removed.

**Tech Stack:** Vanilla JS (IIFE singletons), CSS `@layer` cascade, CSS Grid
layout, Playwright browser tests (`tests/browser/`, `helpers.js`'s
`boot`/`reload`). No build step, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-colour-rail-design.md`

## Global Constraints

- Every existing element ID that moves keeps its ID unchanged
  (`#toolbar-color`, `#clut-cluster`, `#colour-bits`, `#border-host`,
  `#draw-modes`, `#mirror-modes`, `#attr-tools`) — `tests/browser/
  modes.spec.js`'s ID-based lookups must keep passing with zero edits.
- `#color-rail` scales only via the plain `zoom: var(--ui-scale)` rule
  every other chrome region uses — never an independent scale variable.
- `#color-bar` must render as exactly one row at every interface-size
  setting (85%-200%) and every window width from 1024px up — no wrap, no
  horizontal scroll hiding a control.
- No rule this plan adds may vary `border-width`, `padding`, `width`, or
  `height` between a control's rest and active/selected state (existing
  convention: `.tool-btn.active`/`.panel-button.active` swap colour only;
  `.color-swatch.active-ink` uses `outline`, which doesn't affect layout).
- Run `node tests/run-all.js` (lint + Node suites) after every task that
  touches a `.js` file; it must stay green throughout.
- No emoji or pictographs anywhere (enforced by `tests/lint-architecture.
  test.js`, and by the user's own global instructions).

---

## Task 1: Grid scaffold and DOM move

**Files:**
- Modify: `H:\PixULA\index.html:79-146`
- Modify: `H:\PixULA\css\variables.css:193-198`
- Modify: `H:\PixULA\css\layout.css:19-49`, `:349-358`
- Modify: `H:\PixULA\js\app.js:310`
- Test: Create `H:\PixULA\tests\browser\color-rail.spec.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (first task).
- Produces: the `#color-rail` element (grid area `colorrail`, `--colorrail-
  width` token) that Tasks 2-5 style and test; `#color-bar` reduced to two
  children (`#toolbar-attrs` wrapping only `#border-host`, and
  `#color-bar-controls`) that Task 4 retargets.

- [ ] **Step 1: Write the failing structural test**

Create `H:\PixULA\tests\browser\color-rail.spec.js`:

```js
'use strict';
/**
 * The vertical colour rail (#color-rail): every screen mode's palette
 * swatches, between the tool rail and the drawing area. See
 * docs/superpowers/specs/2026-08-25-colour-rail-design.md.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('the colour rail exists between the tool rail and the canvas, and holds the palette + bits', async ({ page }) => {
    await boot(page);

    const structure = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        const toolbar = document.getElementById('toolbar');
        const canvasArea = document.getElementById('canvas-area');
        const colorBar = document.getElementById('color-bar');
        return {
            railExists: !!rail,
            toolbarColorInRail: rail ? rail.contains(document.getElementById('toolbar-color')) : false,
            colourBitsInRail: rail ? rail.contains(document.getElementById('colour-bits')) : false,
            toolbarColorInColorBar: colorBar ? colorBar.contains(document.getElementById('toolbar-color')) : false,
            colourBitsInColorBar: colorBar ? colorBar.contains(document.getElementById('colour-bits')) : false,
            borderHostInColorBar: colorBar ? colorBar.contains(document.getElementById('border-host')) : false,
            toolbarLeftOfRail: toolbar && rail
                ? toolbar.getBoundingClientRect().right <= rail.getBoundingClientRect().left
                : false,
            railLeftOfCanvas: rail && canvasArea
                ? rail.getBoundingClientRect().right <= canvasArea.getBoundingClientRect().left
                : false
        };
    });
    expect(structure.railExists).toBe(true);
    expect(structure.toolbarColorInRail).toBe(true);
    expect(structure.colourBitsInRail).toBe(true);
    expect(structure.toolbarColorInColorBar).toBe(false);
    expect(structure.colourBitsInColorBar).toBe(false);
    expect(structure.borderHostInColorBar).toBe(true);
    expect(structure.toolbarLeftOfRail).toBe(true);
    expect(structure.railLeftOfCanvas).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/browser/color-rail.spec.js`
Expected: FAIL — `#color-rail` does not exist yet (`railExists` is `false`).

- [ ] **Step 3: Restructure index.html**

In `H:\PixULA\index.html`, replace lines 79-146 (from the `<!-- Top colour
bar: ... -->` comment through the `<main id="canvas-area"` line is NOT
included — stop right before it) — i.e. replace everything from the comment
before `<div id="color-bar"...>` through the closing `</aside>` of the
current `#toolbar`:

Old:
```html
        <!-- Top colour bar: the full palette / CLUTs for the active screen
             mode plus the attribute paint ops. Spans the canvas column
             between the two rails, under the header, and is optimised for
             pen/touch (large hit targets). Swatches generated by ClutBar
             from ColorManager's palette; attribute op buttons generated by
             ClutBar; Border dropdown appended by BorderControl. Zero
             hand-written swatches. -->
        <div id="color-bar" role="toolbar" aria-label="Colours and attributes" aria-orientation="horizontal">
            <!-- Three groups, cut by what the control DOES to the picture, at
                 one shared pitch (one palette-icon block) between every pair:
                 PALETTE: the swatches and the selectors that say which
                 swatches (ULAplus CLUT, GigaScreen view, Timex scheme).
                 ATTRS: the Bright/Flash bits and the Border — cell/screen
                 attributes, not swatches, but riding right after the
                 palette rather than with the marks. MARKS: how a stroke
                 combines with what is already there — the draw modes, then
                 Mirror (also a stroke-shaping mode, not a colour), then
                 Swap and Recolour because they are attribute ops, not
                 colours.
                 They are three SEPARATE flex items (not #toolbar-attrs
                 nested inside the palette group, tried 2026-08-10 and
                 reverted) specifically so ordinary flex-wrap packs them
                 freely: whichever group runs out of room drops to the next
                 line and picks up whatever follows it that still fits there
                 too — e.g. attrs joins the marks row rather than claiming a
                 whole line of its own — which is what keeps the bar at TWO
                 rows across a much wider range of interface-size settings
                 than a rigid "each group is its own line" rule would. -->
            <div id="toolbar-color" class="toolbar-section">
                <!-- Swatch cluster (ClutBar) is prepended here. -->
            </div>
            <div id="toolbar-attrs" class="toolbar-section">
                <!-- Bright/Flash (ClutBar; per-mode, empty where the mode has
                     no attribute bits) -->
                <div id="colour-bits" class="toolbar-section"></div>
                <!-- Border dropdown (BorderControl) -->
                <div id="border-host" class="toolbar-section"></div>
            </div>
            <div id="color-bar-controls">
                <!-- One caption for the whole icon-only run below (draw modes,
                     Mirror, Swap/Recolour), captioned the same way Ink/Paper
                     caption their swatch groups (css/components.css
                     _captionGroup) — text above, the row of controls below,
                     both centred as one column. -->
                <span id="marks-group-label" class="toolbar-group-label" data-i18n="dm.groupLabel">Drawing Modes</span>
                <div id="marks-icons-row">
                    <!-- Global draw-mode selector (DrawModeBar): icon buttons in
                         the left-toolbar style; drives StateManager's
                         document-wide mode. -->
                    <div id="draw-modes" class="toolbar-section"></div>
                    <!-- Mirror (symmetry drawing) toggles (DrawModeBar) — filed
                         next to the draw modes because it changes how every
                         stroke lands, exactly like they do. -->
                    <div id="mirror-modes" class="toolbar-section" role="group" aria-label="Mirror"></div>
                    <!-- Swap / Recolour (ClutBar) sit INLINE with the draw modes,
                         after XOR: one run, one pitch, no group gap between them. -->
                    <div id="attr-tools" class="toolbar-section clut-attrs"></div>
                </div>
            </div>
        </div>

        <!-- Left rail: current ink/paper preview (ClutBar) then tools (ToolRail) -->
        <aside id="toolbar" role="toolbar" aria-label="Tools" aria-orientation="vertical">
            <!-- Persistent Ink / Paper preview wells, populated by ClutBar. -->
            <div id="color-preview"></div>
            <!-- Tool buttons generated by ToolRail from TOOL_GROUPS -->
            <div id="tool-rail"></div>
        </aside>
```

New:
```html
        <!-- Top strip: draw modes, Mirror, Swap/Recolour and Border. Spans
             the canvas column only (between the colour rail and the right
             panels), directly under the header. ColorBarFit
             (js/ui/components/colorbar-fit.js) guarantees this always
             renders as exactly ONE row, at every interface-size setting and
             window width — see its class comment. The palette swatches used
             to live here too; they moved to #color-rail below 2026-08-25
             (docs/superpowers/specs/2026-08-25-colour-rail-design.md) —
             ColorBarFit's old two-row search over swatches + this content
             together was the cause of visible resize flicker. -->
        <div id="color-bar" role="toolbar" aria-label="Drawing modes and border" aria-orientation="horizontal">
            <div id="toolbar-attrs" class="toolbar-section">
                <!-- Border dropdown (BorderControl) -->
                <div id="border-host" class="toolbar-section"></div>
            </div>
            <div id="color-bar-controls">
                <!-- One caption for the whole icon-only run below (draw modes,
                     Mirror, Swap/Recolour), captioned the same way Ink/Paper
                     caption their swatch groups (css/components.css
                     _captionGroup) — text above, the row of controls below,
                     both centred as one column. -->
                <span id="marks-group-label" class="toolbar-group-label" data-i18n="dm.groupLabel">Drawing Modes</span>
                <div id="marks-icons-row">
                    <!-- Global draw-mode selector (DrawModeBar): icon buttons in
                         the left-toolbar style; drives StateManager's
                         document-wide mode. -->
                    <div id="draw-modes" class="toolbar-section"></div>
                    <!-- Mirror (symmetry drawing) toggles (DrawModeBar) — filed
                         next to the draw modes because it changes how every
                         stroke lands, exactly like they do. -->
                    <div id="mirror-modes" class="toolbar-section" role="group" aria-label="Mirror"></div>
                    <!-- Swap / Recolour (ClutBar) sit INLINE with the draw modes,
                         after XOR: one run, one pitch, no group gap between them. -->
                    <div id="attr-tools" class="toolbar-section clut-attrs"></div>
                </div>
            </div>
        </div>

        <!-- Left rail: current ink/paper preview (ClutBar) then tools (ToolRail) -->
        <aside id="toolbar" role="toolbar" aria-label="Tools" aria-orientation="vertical">
            <!-- Persistent Ink / Paper preview wells, populated by ClutBar. -->
            <div id="color-preview"></div>
            <!-- Tool buttons generated by ToolRail from TOOL_GROUPS -->
            <div id="tool-rail"></div>
        </aside>

        <!-- Vertical colour rail: every screen mode's palette swatches
             (ClutBar), between the tool rail and the drawing area. Swatches
             are a fixed size — scales only with --ui-scale, no independent
             auto-fit (contrast #color-bar above, which ColorBarFit dials on
             its own). Scrolls vertically for palettes taller than the
             available height (the 256-entry Next grid, mainly); never
             scrolls sideways. -->
        <aside id="color-rail" role="toolbar" aria-label="Colours" aria-orientation="vertical">
            <div id="toolbar-color" class="toolbar-section">
                <!-- Swatch cluster (ClutBar) is prepended here. -->
            </div>
            <!-- Bright/Flash (ClutBar; per-mode, empty where the mode has no
                 attribute bits) and the GigaScreen sub-screen view toggle -->
            <div id="colour-bits" class="toolbar-section"></div>
        </aside>
```

- [ ] **Step 4: Add the `--colorrail-width` token**

In `H:\PixULA\css\variables.css`, in the `:root` block:

Old:
```css
    /* ===== SIZING ===== */
    --toolbar-width: 128px;         /* 2-wide tool grid + padding + room for the vertical scrollbar */
    --panel-width: 280px;
```

New:
```css
    /* ===== SIZING ===== */
    --toolbar-width: 128px;         /* 2-wide tool grid + padding + room for the vertical scrollbar */
    /* Two swatch columns (--clut-btn-size, css/variables.css below) + gap +
       padding + room for the vertical scrollbar — same reasoning as
       --toolbar-width above. [C], not yet measured against real rendered
       content (docs/superpowers/specs/2026-08-25-colour-rail-design.md S:9) —
       tune once the rail is on screen. */
    --colorrail-width: 140px;
    --panel-width: 280px;
```

- [ ] **Step 5: Add the grid column and base `#color-rail` rule in layout.css**

In `H:\PixULA\css\layout.css`, update the main grid:

Old:
```css
/* Main Application Grid */
#app {
    display: grid;
    grid-template-areas:
        "header   header   header"
        "toolbar  colorbar panels"
        "toolbar  canvas   panels"
        "status   status   status";
    /* Fixed tracks scale with --ui-scale so the chrome regions (which are
       `zoom`-scaled by the same factor) get the room their content needs.
       The colour bar row is `auto` — sized to its content — and only spans
       the canvas column between the two rails. The 1fr canvas row takes the
       remaining space. */
    grid-template-rows: calc(var(--header-height) * var(--ui-scale)) auto 1fr calc(var(--status-height) * var(--ui-scale));
    grid-template-columns: calc(var(--toolbar-width) * var(--ui-scale)) 1fr calc(var(--panel-width) * var(--ui-scale));
    /* 100% (not 100vh): body's height chain is pinned to the real viewport
       above, and 100vh can exceed it on mobile UA chrome. */
    height: 100%;
    overflow: hidden;
}

/* UI scale: `zoom` uniformly scales every descendant (text, icons, swatches,
   spacing, borders) of each chrome region. The canvas viewport/iframe is
   deliberately excluded so the drawing surface and its coordinate math are
   never affected — the canvas has its own separate zoom control. */
#header,
#toolbar,
#panels,
#status-bar,
#canvas-controls {
    zoom: var(--ui-scale);
}
```

New:
```css
/* Main Application Grid */
#app {
    display: grid;
    grid-template-areas:
        "header   header    header   header"
        "toolbar  colorrail colorbar panels"
        "toolbar  colorrail canvas   panels"
        "status   status    status   status";
    /* Fixed tracks scale with --ui-scale so the chrome regions (which are
       `zoom`-scaled by the same factor) get the room their content needs.
       The colour rail is a fixed-width column, full height like #toolbar —
       see #color-rail below. The colour bar row is `auto` — sized to its
       content — and only spans the canvas column between the rail and
       #panels. The 1fr canvas row takes the remaining space. */
    grid-template-rows: calc(var(--header-height) * var(--ui-scale)) auto 1fr calc(var(--status-height) * var(--ui-scale));
    grid-template-columns:
        calc(var(--toolbar-width) * var(--ui-scale))
        calc(var(--colorrail-width) * var(--ui-scale))
        1fr
        calc(var(--panel-width) * var(--ui-scale));
    /* 100% (not 100vh): body's height chain is pinned to the real viewport
       above, and 100vh can exceed it on mobile UA chrome. */
    height: 100%;
    overflow: hidden;
}

/* UI scale: `zoom` uniformly scales every descendant (text, icons, swatches,
   spacing, borders) of each chrome region. The canvas viewport/iframe is
   deliberately excluded so the drawing surface and its coordinate math are
   never affected — the canvas has its own separate zoom control. #color-rail
   joins this plain block (2026-08-25) — its swatches scale only with
   --ui-scale, unlike #color-bar below, which ColorBarFit multiplies by a
   second, independent scale of its own. */
#header,
#toolbar,
#color-rail,
#panels,
#status-bar,
#canvas-controls {
    zoom: var(--ui-scale);
}
```

Then add the base `#color-rail` rule directly after the existing `#toolbar`
rule block (which ends with `z-index: var(--z-toolbar);\n}` just before the
"Top colour bar" comment):

```css
/* Vertical colour rail — every screen mode's palette swatches (ClutBar),
   between the tool rail and the drawing area (2026-08-25). Fixed width
   (--colorrail-width above); content reflows into a narrow multi-column
   grid (css/components.css) rather than being auto-scaled, and scrolls
   vertically when it doesn't fit — never sideways. */
#color-rail {
    grid-area: colorrail;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    overflow-x: hidden;
    z-index: var(--z-toolbar);
}
```

Then update the tablet breakpoint (which currently drops `#panels` to a
2-column grid but must still carry the rail):

Old:
```css
@media (max-width: 1024px) {
    #app {
        grid-template-areas:
            "header   header"
            "toolbar  colorbar"
            "toolbar  canvas"
            "status   status";
        grid-template-rows: calc(var(--header-height) * var(--ui-scale)) auto 1fr calc(var(--status-height) * var(--ui-scale));
        grid-template-columns: calc(var(--toolbar-width) * var(--ui-scale)) 1fr;
    }
```

New:
```css
@media (max-width: 1024px) {
    #app {
        grid-template-areas:
            "header   header    header"
            "toolbar  colorrail colorbar"
            "toolbar  colorrail canvas"
            "status   status    status";
        grid-template-rows: calc(var(--header-height) * var(--ui-scale)) auto 1fr calc(var(--status-height) * var(--ui-scale));
        grid-template-columns:
            calc(var(--toolbar-width) * var(--ui-scale))
            calc(var(--colorrail-width) * var(--ui-scale))
            1fr;
    }
```

- [ ] **Step 6: Fix the stale init-order comment in app.js**

In `H:\PixULA\js\app.js`:

Old:
```js
        // Colour bar (ClutBar builds #toolbar-color before BorderControl appends to it)
        // + left rail tools
        ClutBar.init();
```

New:
```js
        // Colour rail + top strip (ClutBar builds #toolbar-color, now inside
        // #color-rail, before BorderControl appends #border-host inside
        // #color-bar) + left rail tools
        ClutBar.init();
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test tests/browser/color-rail.spec.js`
Expected: PASS

- [ ] **Step 8: Run the full Node suite to check for regressions**

Run: `node tests/run-all.js`
Expected: all suites PASS (this task touches no `.js` logic besides a
comment, so no lint/behaviour regressions are expected)

- [ ] **Step 9: Commit**

```bash
git add index.html css/variables.css css/layout.css js/app.js tests/browser/color-rail.spec.js
git commit -m "feat: scaffold the vertical colour rail grid column"
```

---

## Task 2: Rail CSS primitives (classic mode)

**Files:**
- Modify: `H:\PixULA\css\variables.css`
- Modify: `H:\PixULA\css\components.css:538-757`
- Modify: `H:\PixULA\css\utilities.css:83-104`
- Modify: `H:\PixULA\tests\browser\color-rail.spec.js`

**Interfaces:**
- Consumes: `#color-rail` (Task 1), `--colorrail-width` (Task 1).
- Produces: `#color-rail #clut-cluster` (column flex), `#color-rail
  .clut-channel`/`.clut-row:not(.clut-selector)`/`.clut-divider`/
  `.color-swatch`/`.clut-transparent-box`/`.clut-bits` — the vertical
  layout primitives Task 3's ULAplus/indexed rules build on top of.

- [ ] **Step 1: Write the failing layout test**

Append to `H:\PixULA\tests\browser\color-rail.spec.js`:

```js
/*
 * Ink and paper are ONE thing - the pair of colours a cell is made of - so
 * in the vertical rail they stack with a gap between the groups, reading as
 * a column the way the old horizontal bar read as a row. Each 8-swatch
 * block is a fixed 2-column grid, not stretched to the rail's width, so a
 * screen-mode change can never resize a swatch.
 */
test('classic mode: Ink then Paper stack vertically in the rail, each a fixed 2-column grid', async ({ page }) => {
    await boot(page);

    const layout = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('#clut-cluster > .btn-captioned')];
        const inkRow = blocks[0].querySelector('.clut-row');
        const swatches = [...inkRow.querySelectorAll('.color-swatch')];
        const rects = swatches.map((s) => s.getBoundingClientRect());
        return {
            blocks: blocks.length,
            inkAboveOrLeftOfPaper: blocks[0].getBoundingClientRect().bottom <=
                blocks[1].getBoundingClientRect().top + 1,
            swatchWidths: [...new Set(rects.map((r) => Math.round(r.width)))],
            firstRowPair: Math.abs(rects[0].top - rects[1].top) < 1,
            thirdDropsRow: rects[2].top > rects[0].top + 1
        };
    });
    expect(layout.blocks).toBe(2); // ink, paper
    expect(layout.inkAboveOrLeftOfPaper).toBe(true);
    expect(layout.swatchWidths).toHaveLength(1);
    expect(layout.firstRowPair).toBe(true);
    expect(layout.thirdDropsRow).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/browser/color-rail.spec.js -g "Ink then Paper"`
Expected: FAIL — with no rail-scoped CSS yet, Ink/Paper still lay out
side by side via the generic `.clut-channel`/`.clut-row` defaults, so
`inkAboveOrLeftOfPaper` and `thirdDropsRow` are false (or the swatches are
stretched to `1fr` widths that don't match a fixed size).

- [ ] **Step 3: Hoist `--clut-btn-size` to `:root`**

In `H:\PixULA\css\variables.css`, in the `:root` block (right after the
`--colorrail-width` line added in Task 1):

```css
    --colorrail-width: 140px;
    /* Shared by #color-bar's buttons/select and #color-rail's swatches — one
       size for every control either region contains, so the two read as one
       system even though they scale independently (css/layout.css). Moved
       here from a #color-bar-only definition 2026-08-25 when #color-rail
       started needing it too. */
    --clut-btn-size: 39px;
    --panel-width: 280px;
```

Then in `H:\PixULA\css\components.css`, remove the now-duplicate line from
the `#color-bar` token block:

Old:
```css
#color-bar {
    --clut-btn-size: 39px;
    --clut-cell-size: 56px;
    /* ColorBarFit's own knob (js/ui/components/colorbar-fit.js) — 1 until it
       decides the bar needs to shrink to keep fitting two rows; see the
       zoom formula in css/layout.css. */
    --colorbar-scale: 1;
}
```

New:
```css
#color-bar {
    --clut-cell-size: 56px;
    /* ColorBarFit's own knob (js/ui/components/colorbar-fit.js) — 1 until it
       decides the bar needs to shrink to keep fitting one row; see the
       zoom formula in css/layout.css. */
    --colorbar-scale: 1;
}
```

And retarget its coarse-pointer override:

Old:
```css
@media (pointer: coarse) {
    #color-bar { --clut-btn-size: 44px; }
}
```

New:
```css
@media (pointer: coarse) {
    :root { --clut-btn-size: 44px; }
}
```

- [ ] **Step 4: Prune the dead `#toolbar-color` rule and stale doc comment**

In `H:\PixULA\css\components.css`, replace the "three groups" documentation
block and the now-dead `#color-bar > #toolbar-color` rule:

Old:
```css
/* ===== Top colour bar — horizontal layout =====
   ClutBar builds the SAME DOM regardless of where the cluster lives; these
   rules lay that DOM out horizontally for the top #color-bar and enlarge the
   hit targets for pen/touch. Everything stays token-driven — no colour
   literals, no JS layout. The fixed16 order runs left->right, across the
   three top-level groups (#toolbar-color · #toolbar-attrs · #color-bar-controls),
   all at one shared pitch (one palette-icon block):
     Ink colours · ink transparent   (gap)
     Paper colours · paper transparent   (one palette-icon pitch)
     Bright/Flash · Border   (one palette-icon pitch)   draw modes · Swap · Recolour */
```

New:
```css
/* ===== Top colour bar — horizontal layout =====
   ClutBar builds the SAME DOM regardless of where the cluster lives (the
   rail-specific rules for it are further down this file, under "Vertical
   colour rail"). These rules lay out what's LEFT in the top #color-bar
   since the palette swatches moved to #color-rail (2026-08-25): Border
   (#toolbar-attrs) and the marks group (#color-bar-controls), enlarging hit
   targets for pen/touch. Everything stays token-driven — no colour
   literals, no JS layout. */
```

Old:
```css
#color-bar > #toolbar-color {
    flex: 0 1 auto;
    min-width: 0;
}

#color-bar > #toolbar-attrs {
    flex: 0 0 auto;
}
```

New:
```css
#color-bar > #toolbar-attrs {
    flex: 0 0 auto;
}
```

And update the comment immediately above (the one starting "#toolbar-color
holds ONLY #clut-cluster now"):

Old:
```css
   #toolbar-color holds ONLY #clut-cluster now (no grow: it hugs the
   swatches' own width rather than bloating into leftover row space, which
   is what keeps #toolbar-attrs sitting right after paper instead of
   stranded past an invisibly-padded box) — shrink stays live, so #clut-
   cluster can still absorb the whole difference by scrolling itself, and
   the palette group is NEVER wider than the bar at every window width,
   every interface size and every screen mode, including the 256-entry
   indexed palettes at ~2700px of swatches, which could never have fitted.
   #toolbar-attrs (Bright/Flash/Border) is fixed to its own content width.
   #color-bar-controls (the marks group) keeps the ONLY grow in this row —
   tried splitting it 50/50 with the palette group (2026-08-09) and tried
   nesting #toolbar-attrs inside the palette group so it could only ever
   drop to a line of its own (2026-08-10); both reverted; see the DOM-order
   comment in index.html for why three plain siblings, not two or a nest,
   is what lets the bar settle on two rows across the widest range of
   interface-size settings. */
```

New:
```css
   #toolbar-attrs (Border only, since Bright/Flash moved to #color-rail
   2026-08-25) is fixed to its own content width. #color-bar-controls (the
   marks group) keeps the ONLY grow in this row, so it centres in whatever
   width Border leaves it. */
```

- [ ] **Step 5: Add the rail's `#clut-cluster` (column) rule**

In `H:\PixULA\css\components.css`, add a new section after the coarse-pointer
block that ends the old `#color-bar` rules (after the block ending
`#color-preview .clut-preview { min-height: 48px; }\n}` — see Task 3/4 for
what else lands in this new section; this step adds only the primitives):

```css
/* ===== Vertical colour rail — column layout (2026-08-25) =====
   ClutBar builds the SAME DOM used in every mode; these rules lay it out as
   a narrow column instead of #color-bar's horizontal row. Swatches keep a
   FIXED pixel size (--clut-btn-size) rather than stretching to the rail's
   width — the "fixed size, scales only with --ui-scale" requirement is a
   sizing rule, not a "no reflow" rule: the ARRANGEMENT adapts (2 columns
   instead of 8-across), the swatch size never does. */
#color-rail #clut-cluster {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
}

#color-rail #clut-cluster > * {
    flex: 0 0 auto;
}

/* One colour channel: colour swatches · transparent box, stacked, under its
   caption (Ink/Paper). */
#color-rail .clut-channel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

/* Swatch rows (Ink/Paper, ULANext normal/bright, the Timex scheme row, the
   16-or-fewer indexed palette): a fixed 2-column grid, not the horizontal
   row #color-bar uses. .clut-selector rows (ULAplus CLUT digits, GigaScreen
   view) are excluded — see the "Vertical colour rail — selector rows"
   section further down, added in Task 3. */
#color-rail .clut-row:not(.clut-selector) {
    display: grid;
    grid-template-columns: repeat(2, var(--clut-btn-size));
    gap: 3px;
}

/* Divider between ULAplus ink/paper halves or ULANext normal/bright rows:
   horizontal in a column layout, not vertical. */
#color-rail .clut-divider {
    width: 100%;
    height: 1px;
    background: var(--border-light);
    margin: var(--space-xs) 0;
}

#color-rail .color-swatch {
    width: var(--clut-btn-size);
    height: var(--clut-btn-size);
    min-height: 0;
    aspect-ratio: auto;
}

/* Sits below its channel's swatch grid, not beside it. */
#color-rail .clut-transparent-box {
    margin-top: 2px;
}

/* Bright / Flash: still a small horizontal pair, they fit the rail's width
   easily side by side. */
#color-rail .clut-bits {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: 4px;
}

/* The native checkbox drives state/AT but the icon shows it — hide the box. */
#color-rail .clut-bit input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

/* A caption is more likely to need to wrap in a narrow rail than it ever
   was across a wide bar. */
#color-rail .btn-label {
    overflow-wrap: break-word;
    text-wrap: balance;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx playwright test tests/browser/color-rail.spec.js -g "Ink then Paper"`
Expected: PASS

- [ ] **Step 7: Run the full test file and the Node suite**

Run: `npx playwright test tests/browser/color-rail.spec.js`
Expected: both tests PASS

Run: `node tests/run-all.js`
Expected: all suites PASS

- [ ] **Step 8: Commit**

```bash
git add css/variables.css css/components.css css/utilities.css tests/browser/color-rail.spec.js
git commit -m "feat: lay out the colour rail's swatches as a fixed-size vertical column"
```

---

## Task 3: Rail CSS for ULAplus/GigaScreen selectors and the indexed Next grid

**Files:**
- Modify: `H:\PixULA\css\components.css`
- Modify: `H:\PixULA\tests\browser\color-rail.spec.js`

**Interfaces:**
- Consumes: `#color-rail #clut-cluster`/`.clut-row:not(.clut-selector)`/
  `.clut-divider` (Task 2).
- Produces: `#color-rail .clut-row.clut-selector` (ULAplus CLUT digits,
  GigaScreen view buttons) and `#color-rail .indexed-palette-grid[.indexed-
  dense]` (the Next 16-or-fewer / 256-entry palettes) — nothing later
  depends on these beyond Task 5's stability spec re-using the same
  selectors read-only.

- [ ] **Step 1: Write the failing tests**

Append to `H:\PixULA\tests\browser\color-rail.spec.js`:

```js
/*
 * The colour rail is a FIXED width - it never grows to accommodate a wider
 * mode's palette. Unlike the old top #color-bar (which wrapped a swatch
 * block that didn't fit), the rail scrolls VERTICALLY instead: every
 * swatch is reachable by scrolling, none is ever permanently clipped.
 */
test.describe('the colour rail stays within its fixed width, in every screen mode', () => {
    for (const width of [1024, 1366, 1600, 2560]) {
        test(`at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await boot(page);
            page.on('dialog', (d) => d.accept()); // lossy mode-switch confirms

            const modes = await page.evaluate(() => Object.values(SCREEN_MODES).map((m) => m.id));
            const tooWide = [];
            for (const id of modes) {
                await page.evaluate((m) => ScreenModeService.switchMode(m), id);
                const bad = await page.evaluate((m) => {
                    const rail = document.getElementById('color-rail');
                    const group = document.getElementById('toolbar-color');
                    const over = group.offsetWidth - rail.clientWidth;
                    if (over > 1) return `${m}: group +${over}px`;
                    if (rail.scrollWidth > rail.clientWidth + 1) return `${m}: rail scrolls sideways`;
                    return null;
                }, id);
                if (bad) tooWide.push(bad);
            }
            expect(tooWide).toEqual([]);
        });
    }
});

test('the 256-entry indexed palette scrolls vertically, and every swatch is reachable', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

    const before = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        return { scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight };
    });
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    const reached = await page.evaluate(() => {
        const rail = document.getElementById('color-rail');
        rail.scrollTop = rail.scrollHeight;
        const swatches = document.querySelectorAll('#indexed-palette-grid .color-swatch');
        const last = swatches[swatches.length - 1];
        const r = last.getBoundingClientRect();
        const railBox = rail.getBoundingClientRect();
        return r.top >= railBox.top - 0.5 && r.bottom <= railBox.bottom + 0.5;
    });
    expect(reached).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/browser/color-rail.spec.js -g "colour rail stays within|scrolls vertically"`
Expected: FAIL — the ULAplus CLUT selector (built from `.clut-row.clut-
selector`) currently inherits Task 2's fixed 2-column swatch grid, which
squeezes its 4 digit buttons into 2 columns without necessarily overflowing
width-wise, but is the wrong treatment (button labels are text, not fixed-
size swatches); more importantly the indexed grid still uses `#color-bar
.indexed-palette-grid`'s column-flow/sideways-scroll CSS, which does not
apply inside `#color-rail` at all, so it falls back to the generic
`.indexed-palette-grid { grid-template-columns: repeat(8, 1fr); max-height:
40vh; overflow-y: auto }` — the fallback happens to scroll vertically already
(so the `reached` assertion may pass by accident), but the `#toolbar-color`
width check is expected to fail for at least one indexed mode because
`repeat(8, 1fr)` stretches swatches to fill 8 columns of the rail's width,
which can exceed a narrow rail depending on `--colorrail-width`. Confirm the
actual failure by running the test and reading its output rather than
assuming which assertion trips.

- [ ] **Step 3: Add the selector-row and indexed-grid rail rules**

In `H:\PixULA\css\components.css`, in the "Vertical colour rail" section
added in Task 2, after the `#color-rail .btn-label` rule:

```css
/* ULAplus CLUT selector (0-3) and the GigaScreen view toggle (Blend/A/B):
   button-styled controls, not swatches, so they keep their own natural
   width (a text label like "Blend" would clip inside a fixed swatch-width
   grid column) and simply wrap within the rail's fixed width. */
#color-rail .clut-row.clut-selector {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 3px;
}

/* Next indexed palettes (up to 256 entries): the 16-or-fewer case already
   gets the standard 2-column swatch grid from .clut-row above (it matches
   both .clut-row and .indexed-palette-grid); the 256-entry case goes dense
   — more, smaller columns, so the rail scrolls a manageable distance
   instead of a very tall two-wide column. Row-flow (the default), not
   column-flow: the rail scrolls VERTICALLY, unlike the old horizontal
   #color-bar version this replaces. */
#color-rail .indexed-palette-grid.indexed-dense {
    grid-template-columns: repeat(4, 18px);
}

#color-rail .indexed-palette-grid.indexed-dense .color-swatch {
    width: 18px;
    height: 18px;
}

@media (pointer: coarse) {
    #color-rail .indexed-palette-grid.indexed-dense {
        grid-template-columns: repeat(4, 22px);
    }
    #color-rail .indexed-palette-grid.indexed-dense .color-swatch {
        width: 22px;
        height: 22px;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/browser/color-rail.spec.js`
Expected: all tests in the file PASS

- [ ] **Step 5: Run the Node suite**

Run: `node tests/run-all.js`
Expected: all suites PASS

- [ ] **Step 6: Commit**

```bash
git add css/components.css tests/browser/color-rail.spec.js
git commit -m "feat: reflow the ULAplus/GigaScreen selectors and indexed grid for the rail"
```

---

## Task 4: Retarget ColorBarFit to one row, prune dead `#color-bar` CSS, rewrite shell.spec.js

**Files:**
- Modify: `H:\PixULA\js\ui\components\colorbar-fit.js`
- Modify: `H:\PixULA\css\components.css`
- Modify: `H:\PixULA\css\utilities.css:106-116`
- Modify: `H:\PixULA\tests\browser\shell.spec.js:23-468`

**Interfaces:**
- Consumes: `#color-bar` reduced to two children (Task 1); `ColorBarFit`'s
  public `init()`/`refit()` (unchanged names, called from `js/app.js:315` —
  no change needed there).
- Produces: nothing consumed by later tasks — Task 5's stability spec
  reads `--colorbar-scale` and `#color-bar`'s bounding box, both of which
  already exist as public-enough surface (a CSS custom property and a DOM
  element), not a JS interface.

- [ ] **Step 1: Retarget ColorBarFit to a single-row, shrink-only search**

Read the full current file first: `H:\PixULA\js\ui\components\colorbar-fit.js`.

Replace the class doc comment (lines 1-59, from `/**` through the closing
`*/` right before `class ColorBarFitClass {`):

Old (the whole doc comment block):
```js
/**
 * ColorBarFit — keeps the top colour bar's own icon size independent of
 * --ui-scale, dialling it EITHER way to make the best use of the room
 * available. Every other chrome region (#header, #toolbar, #panels,
 * #status-bar, #canvas-controls) scales 1:1 with the artist's chosen
 * interface size; this bar alone can dial its OWN zoom (--colorbar-scale,
 * multiplied into --ui-scale for #color-bar's zoom in css/layout.css) up or
 * down: shrink when the interface-size setting would otherwise push its
 * content past two rows (fragmenting further at high magnification), or grow
 * (2026-08-22) when a wide window leaves the bar's natural size with room to
 * spare, so that space becomes bigger icons rather than empty margin — a
 * single comfortably-fitting row is grown to fill it, and a bar that already
 * needs two rows at its natural size is grown to fill THOSE properly,
 * without either ever being pushed into a row it did not already need.
 *
 * The indexed Next palette (the 256-entry scrolling grid) is the documented
 * exception to "always wrap, never scroll" — it is a single element that
 * cannot wrap, so shrinking icons would not buy it a second row and only
 * makes it harder to use. It opts out entirely (--colorbar-scale stays 1).
 *
 * There is a combination no amount of shrinking here can fix: #color-bar
 * sits in the #app grid's middle (1fr) column, flanked by #toolbar and
 * #panels, whose tracks are calc(--toolbar-width * --ui-scale) and
 * calc(--panel-width * --ui-scale) - fixed, NOT reduced by
 * --colorbar-scale, because they are a different region entirely. At
 * (128 + 280) = 408px base width (css/variables.css), those two tracks
 * alone can reach a narrow window's full width at a high enough scale,
 * leaving #color-bar's own column at zero regardless of what happens
 * inside it - fixing that would mean shrinking the tool rail and side
 * panels too, well beyond this bar. THIS is why the interface-size
 * selector's presets stop at 200% (index.html; 85%-300% until
 * 2026-08-10): measured that day, every window width from 1024px up
 * reaches two rows at every preset up to 200%, and 250%/300% were the
 * only presets that could still land on the unfixable combination on an
 * ordinary laptop-width window - so the ceiling was lowered rather than
 * carrying a known-broken corner behind a selector option. A value
 * stored before that change is clamped to the new max on restore
 * (js/ui/components/app-settings.js).
 *
 * #color-bar's own grid-computed width is NOT trusted as the "how much
 * room do I have" answer, because it can be wrong: `zoom` on a grid item
 * and the browser's own automatic-minimum-size accounting for that item
 * have been seen (2026-08-12, a 2560x1440 display) to disagree with the
 * grid column's actual size, in a way this component's own layout reads
 * cannot tell apart from "there just is not enough room" - so it looked
 * indistinguishable from correct behaviour in every automated check, and
 * only ever reproduced on real hardware. #canvas-area shares the exact
 * same grid column (css/layout.css grid-template-areas) but carries no
 * zoom of its own, so it is a clean, second, independent reading of that
 * column's true width. _pinWidth() below forces #color-bar's own layout
 * width (in ITS zoomed frame, so divided by the current combined zoom
 * before writing it) to match #canvas-area's, every time --colorbar-scale
 * changes as well as every refit - so whatever the grid+zoom disagreement
 * was, this component now measures rows against the real number instead
 * of whatever its own zoomed self-report said.
 */
```

New:
```js
/**
 * ColorBarFit — keeps the top strip's own icon size independent of
 * --ui-scale, dialling it DOWN (never up — see history below) to guarantee
 * the strip renders as exactly ONE row, at every interface-size setting and
 * window width. Every other chrome region (#header, #toolbar, #color-rail,
 * #panels, #status-bar, #canvas-controls) scales 1:1 with the artist's
 * chosen interface size; this strip alone can dial its OWN zoom
 * (--colorbar-scale, multiplied into --ui-scale for #color-bar's zoom in
 * css/layout.css) down when the interface-size setting would otherwise wrap
 * it to a second row.
 *
 * Until 2026-08-25 this bar also carried every screen mode's palette
 * swatches, needed a two-row target instead of one, and grew as well as
 * shrunk when a wide window left room to spare. Both are gone: the palette
 * moved to the fixed-size #color-rail (docs/superpowers/specs/
 * 2026-08-25-colour-rail-design.md), which does not need (and must not
 * have) an independent auto-fit at all, and the growing behaviour is
 * dropped outright — it was never requested for this bar's remaining
 * content (draw modes, Mirror, Swap/Recolour, Border) and was one more
 * thing that could visibly move during a resize.
 *
 * There is a combination no amount of shrinking here can fix: #color-bar
 * sits in the #app grid's middle (1fr) column, flanked by #toolbar,
 * #color-rail and #panels, whose tracks are fixed, NOT reduced by
 * --colorbar-scale, because they are different regions entirely. At a high
 * enough interface-size setting those fixed tracks alone can reach a narrow
 * window's full width, leaving #color-bar's own column at zero regardless
 * of what happens inside it. THIS is why the interface-size selector's
 * presets stop at 200% (index.html) — see the git history on this file for
 * the 2026-08-10 measurement that set that ceiling.
 *
 * #color-bar's own grid-computed width is NOT trusted as the "how much room
 * do I have" answer, because it can be wrong: `zoom` on a grid item and the
 * browser's own automatic-minimum-size accounting for that item have been
 * seen (2026-08-12, a 2560x1440 display) to disagree with the grid column's
 * actual size, in a way this component's own layout reads cannot tell apart
 * from "there just is not enough room" - so it looked indistinguishable from
 * correct behaviour in every automated check, and only ever reproduced on
 * real hardware. #canvas-area shares the exact same grid column
 * (css/layout.css grid-template-areas) but carries no zoom of its own, so it
 * is a clean, second, independent reading of that column's true width.
 * _pinWidth() below forces #color-bar's own layout width (in ITS zoomed
 * frame, so divided by the current combined zoom before writing it) to
 * match #canvas-area's, every time --colorbar-scale changes as well as
 * every refit - so whatever the grid+zoom disagreement was, this component
 * now measures rows against the real number instead of whatever its own
 * zoomed self-report said.
 */
```

Update the constructor's `MAX_ROWS` comment and value (unchanged name, new
value and rationale):

Old:
```js
    constructor() {
        this.MAX_ROWS = 2;
```

New:
```js
    constructor() {
        // The strip must never wrap - see the class doc comment.
        this.MAX_ROWS = 1;
```

Remove the now-unused `MAX_SCALE` property:

Old:
```js
        // The largest scale worth growing to when there is room to spare
        // (2026-08-22) - A: not measured for this bar specifically, chosen to
        // match the interface-size selector's own 200% ceiling elsewhere in
        // the app (app-settings.js) rather than invent a second convention
        // for "how big is too big" for a scaled control.
        this.MAX_SCALE = 2;
        // How close the search gets to the true largest-scale-that-fits
```

New:
```js
        // How close the search gets to the true largest-scale-that-fits
```

Simplify `refit()` to drop the indexed-mode opt-out (no longer needed —
`#color-bar`'s content is identical in shape regardless of screen mode now
that the palette lives elsewhere) and the grow branch:

Old:
```js
    refit() {
        if (!this._bar) return;
        if (window.ZX_SPECTRUM && ZX_SPECTRUM.PIXEL_DEPTH > 1) {
            this._setScale(1);
            return;
        }

        this._setScale(1);
        const naturalRows = this._rowCount();

        if (naturalRows > this.MAX_ROWS) {
            this._shrinkToFit(this.MAX_ROWS);
        } else {
            this._growToFill(naturalRows);
        }
    }
```

New:
```js
    refit() {
        if (!this._bar) return;

        this._setScale(1);
        if (this._rowCount() > this.MAX_ROWS) {
            this._shrinkToFit(this.MAX_ROWS);
        }
    }
```

Update the docblock immediately above `refit()` (the one explaining the
binary-search rationale) to drop the "Both directions" framing:

Old:
```js
    /**
     * Recompute --colorbar-scale to make the best use of whatever room the
     * bar has, in whichever direction the natural (scale 1) size calls for:
     * SHRINK if that natural size already overflows past MAX_ROWS (the
     * original 2026-08-10 behaviour), or GROW if it does not, so a wide
     * window's slack space goes into bigger, more legible icons instead of
     * sitting unused beside a bar still rendered at its base size. Either
     * way the target is the row count the content ALREADY has at scale 1 -
     * growing never pushes it into a row it did not already need, which is
     * what keeps a comfortably-one-row window at one row instead of
     * ballooning icons until a second row becomes "worth it" too.
     *
     * Both directions binary-search rather than step a fixed ladder (1, 0.9,
     * 0.8, ... or 1, 1.1, 1.2, ...): row count does not change smoothly with
     * scale, it jumps at the point content stops fitting a row, and a coarse
     * ladder can step straight past the true edge to a much smaller (or,
     * growing, a much larger) value than the content actually allows -
     * found the shrinking way round, 2026-08-10.
     *
     * The edge itself turned out not to be safe to land on either (also
     * 2026-08-12): a scale measured as "just fits" in this component's OWN
     * reading can still wrap to one row more on the SAME machine, because
     * that reading and the browser's actual paint are two separate rounding
     * passes over the same fractional-DPR layout, and they do not always
     * agree to the pixel. _margined() steps back from the edge in whichever
     * direction it was approached, rather than trusting it exactly.
     */
```

New:
```js
    /**
     * Recompute --colorbar-scale to keep the strip within MAX_ROWS (1),
     * shrinking from scale 1 only if the natural size already wraps.
     *
     * Binary-searches rather than stepping a fixed ladder (1, 0.9, 0.8, ...):
     * row count does not change smoothly with scale, it jumps at the point
     * content stops fitting a row, and a coarse ladder can step straight
     * past the true edge to a much smaller value than the content actually
     * allows - found 2026-08-10.
     *
     * The edge itself turned out not to be safe to land on either
     * (2026-08-12): a scale measured as "just fits" in this component's OWN
     * reading can still wrap to one row more on the SAME machine, because
     * that reading and the browser's actual paint are two separate rounding
     * passes over the same fractional-DPR layout, and they do not always
     * agree to the pixel. _margined() steps back from the edge, rather than
     * trusting it exactly.
     */
```

Remove the `_growToFill` method entirely:

Old:
```js
    /**
     * Binary search UP from scale 1 for the largest scale that still fits
     * within `targetRows` - the row count the bar's content already needs at
     * scale 1, so growing fills whatever room is going spare without ever
     * spilling into an extra row it did not already have.
     * @private
     */
    _growToFill(targetRows) {
        this._setScale(this.MAX_SCALE);
        if (this._rowCount() <= targetRows) {
            this._setScale(this._margined(this.MAX_SCALE));
            return; // even the ceiling still fits at the natural row count
        }

        // Invariant through the loop: lo fits (<= targetRows), hi does not.
        let lo = 1, hi = this.MAX_SCALE;
        while (hi - lo > this.PRECISION) {
            const mid = (lo + hi) / 2;
            this._setScale(mid);
            if (this._rowCount() <= targetRows) lo = mid; else hi = mid;
        }
        this._setScale(this._margined(lo));
    }

    /**
     * Step back from a scale the search found to "just fit" - see the
```

New:
```js
    /**
     * Step back from a scale the search found to "just fit" - see the
```

(this leaves `_shrinkToFit` and `_margined` otherwise unchanged — only the
method between them is removed).

- [ ] **Step 2: Run the Node suite to check the file still loads cleanly**

Run: `node tests/run-all.js`
Expected: all suites PASS (this file has no Node-level test of its own;
this just confirms lint-architecture.test.js finds nothing wrong with the
edit — no string-literal EventBus calls, no inline clamp, etc.)

- [ ] **Step 3: Prune the now-dead pitch-clamp rule (utilities.css) and `--clut-cell-size` (components.css)**

`--clut-cell-size` only ever mattered for a `.btn-captioned` element inside
`#color-bar` that is NOT `.caption-wide`. After Tasks 1-3, `#color-bar`
contains only Border (`.caption-wide`, per `js/ui/border-control.js:68`) and
the bare-icon marks run (never wrapped in `.btn-captioned` individually,
per the 2026-08-22 change) — so there is no longer any element that rule
can match. Remove it.

In `H:\PixULA\css\utilities.css`:

Old:
```css
/* A caption never sets the pitch: it wraps inside --clut-cell-size, whatever
   its cell grows to (css/components.css). The clamp is on the LABEL, not the
   cell, precisely so a cell CAN grow to share the row without the caption
   spreading onto one long line and changing where it breaks - the 56px is
   measured against every locale and must not move with the window width.
   `caption-wide` opts out the groups that are genuinely wider than a cell -
   the Ink and Paper swatch blocks and the Border dropdown - whose width is
   set by their contents. */
#color-bar .btn-captioned:not(.caption-wide) > .btn-label {
    max-width: var(--clut-cell-size);
}

```

New: (delete the whole block — nothing replaces it)

In `H:\PixULA\css\components.css`, remove the now-unused variable:

Old:
```css
#color-bar {
    --clut-cell-size: 56px;
    /* ColorBarFit's own knob (js/ui/components/colorbar-fit.js) — 1 until it
       decides the bar needs to shrink to keep fitting one row; see the
       zoom formula in css/layout.css. */
    --colorbar-scale: 1;
}
```

New:
```css
#color-bar {
    /* ColorBarFit's own knob (js/ui/components/colorbar-fit.js) — 1 until it
       decides the bar needs to shrink to keep fitting one row; see the
       zoom formula in css/layout.css. */
    --colorbar-scale: 1;
}
```

Also remove its explanatory comment block just above (the "--clut-cell-size
is the CAPTION's width..." paragraph) since it documents a token that no
longer exists:

Old:
```css
   --clut-cell-size is the CAPTION's width, and therefore the pitch every icon
   control sits on. It is bigger than the button because a caption is text and
   text is longer in most languages than in English. 56px is measured, not
   chosen (M, 2026-08-09, tools measurement over all 13 locales at scale 1):
   the widest single caption word is 81.1px (fr "CLIGNOTANT") and the widest
   whole caption 98.8px (tr "Yeniden renklendir"), so no sane pitch keeps
   everything on one line - the question is only how many lines it takes. At
   39px (button width) fr needs 3 lines and tr needs 4; at 54px tr still needs
   3; 56px is the SMALLEST width at which no locale exceeds two lines, which
   is the budget the bar's height was set for. English fits on one.
   It carries no unit arithmetic because the whole chrome scales by `zoom`
   (--ui-scale), so a px token already tracks the interface-size setting. */
```

New: (delete — the measurement is preserved in git history if ever needed
again, but documents a removed token, so keeping it here would be stale)

Leave the sentence just above it in place (the one explaining
`--clut-btn-size`'s own purpose), since that token still exists:

Unchanged (verify it still reads correctly after the deletion above):
```css
/* ── One button control for the whole colour bar ──────────────────────────
   Every button in #color-bar shares ONE size, --clut-btn-size (the swatch
   height), so the row reads as one system. The token lives here; the sizing
   that enforces it lives in css/utilities.css because it must win over the
   generic `button { min-width: 0 }` reset there (@layer order, not
   specificity). Any button added to the bar later inherits it automatically. */
#color-bar {
    /* ColorBarFit's own knob (js/ui/components/colorbar-fit.js) — 1 until it
       decides the bar needs to shrink to keep fitting one row; see the
       zoom formula in css/layout.css. */
    --colorbar-scale: 1;
}
```

(Note: `--clut-btn-size` itself is now defined in `css/variables.css`, not
here — Task 2 moved it. This comment block just explains WHY the token
exists, which is still true.)

- [ ] **Step 4: Remove the now-dead `#color-bar` swatch/indexed-grid rules**

These rules' selectors (`#color-bar .indexed-palette-grid`, `#color-bar
.color-swatch` at coarse pointer) have had no matching elements since Task 1
moved `#toolbar-color` out of `#color-bar`. Remove them:

Old:
```css
/* Indexed Next palettes scroll sideways with the bar. Small palettes (<=16)
   sit in one full-size row; the 256-entry palettes go dense — two half-height
   rows whose pair occupies the SAME height as one full row (18+18+3px gap =
   39px), which also halves the horizontal scroll length. */
#color-bar .indexed-palette-grid {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: auto;
    grid-template-columns: none;
    grid-auto-columns: max-content;
    gap: 3px;
    max-height: none;
    overflow: visible;
}

#color-bar .indexed-palette-grid.indexed-dense {
    grid-template-rows: repeat(2, auto);
}

#color-bar .indexed-palette-grid.indexed-dense .color-swatch {
    width: 18px;
    height: 18px;
}

@media (pointer: coarse) {
    #color-bar .color-swatch { width: 44px; height: 44px; }
    /* Dense 256-palette rows stay two-up but grow to a usable tap size. */
    #color-bar .indexed-palette-grid.indexed-dense .color-swatch { width: 22px; height: 22px; }
    /* The left-rail preview wells fill their grid column; nudge the whole
       block wider so fingertips land, keeping the tool-rail width. */
    #color-preview .clut-preview { min-height: 48px; }
}
```

New:
```css
@media (pointer: coarse) {
    /* The left-rail preview wells fill their grid column; nudge the whole
       block wider so fingertips land, keeping the tool-rail width. */
    #color-preview .clut-preview { min-height: 48px; }
}
```

Also remove these now-dead `#color-bar`-scoped rules found earlier in the
file (their selectors no longer match anything, since `.clut-channel`,
`.clut-row`, `.clut-divider`, `.color-swatch` (39px), `.clut-transparent-
box`, `.clut-bits` and their `.clut-bit input` checkbox rule are now
`#color-rail`-scoped, per Tasks 2-3):

Old:
```css
#color-bar #clut-cluster {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    /* Ink and paper are ONE thing - the pair of colours a cell is made of -
       so they are set one colour box apart and no further. Spreading them to
       the ends of the row (justify-content: space-between, which this
       replaced) filled the width but read as two unrelated palettes.
       Column gap only: a wrapped row must not inherit a 39px gutter. */
    column-gap: var(--clut-btn-size);
    row-gap: var(--space-xs);
    justify-content: flex-start;
    /* The cluster is #toolbar-color's only child, so its own grow/shrink is
       what #toolbar-color's (flex: 0 1 auto, above) ultimately hands down —
       grow is moot either way since the parent never bloats past it, so this
       stays 1 1 auto (matching every other flex item's default expectation)
       and gives it back down to nothing (min-width: 0) when the row is tight
       — the colour group is never wider than the bar.
       WRAP first: a swatch block drops to its own line and every colour stays
       on screen. Scrolling would be shorter, but it hides colours behind an
       overlay scrollbar that takes no space and so does not announce itself -
       measured 2026-08-09 at 1366px: 2 of 18 swatches off view, nothing to say
       so. A colour the artist cannot see is the palette equivalent of a mode
       they cannot see. Scroll is kept only for the one item that CANNOT wrap:
       the indexed Next grid, a single element ~2700px wide. */
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-content: flex-end;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    /* .active-ink's outline sits 1px off the swatch and is 2px wide, so it
       paints 3px past the swatch's own box - past this box's edges too, for
       whichever swatch is first/last in a row or on the last wrapped line.
       overflow here clips at the padding edge, not the content edge, so
       padding reserves the room the outline paints into and the matching
       negative margin gives it back, leaving every OTHER box's size and
       position exactly as they were. Without it the ring was clipped flat
       on that edge - worse at some --ui-scale values than others (rounding
       of the sub-pixel outline width), which read as "scaling broke it"
       when the room was simply never reserved. */
    padding: 4px;
    margin: -4px;
}

/* Nothing inside the scrolling cluster shrinks. Flex items shrink by default,
   and a swatch block that shrinks does not drop swatches — the swatches are
   no-shrink themselves, so they spill out of a narrower wrapper and get
   CLIPPED. Holding the blocks at their size is what makes the cluster
   overflow, which is what makes it scroll. */
#color-bar #clut-cluster > * {
    flex: 0 0 auto;
}

/* One colour channel: colour swatches · transparent box, under its caption. */
#color-bar .clut-channel {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: 4px;
}

#color-bar .clut-row {
    display: flex;
    flex-direction: row;
    gap: 3px;
    align-items: flex-end;
}

/* Rows sit side by side on the single-line bar, so the separator between the
   ULAplus ink/paper halves (and the ULANext normal/bright rows) is vertical. */
#color-bar .clut-divider {
    width: 1px;
    height: auto;
    min-height: 24px;
    align-self: stretch;
    margin: 0 var(--space-xs);
}

#color-bar .color-swatch {
    width: 39px;
    height: 39px;
    min-height: 0;
    aspect-ratio: auto;
    flex: 0 0 auto;
}

#color-bar .clut-transparent-box {
    margin-left: 2px;
}

/* Bright / Flash are full-size icon toggles, in cells like every other. */
#color-bar .clut-bits {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
}
```

New: (delete the whole block — every one of these rules is superseded by
its `#color-rail`-scoped equivalent from Tasks 2-3)

Also remove the now-orphaned pitch-clamp rule that referenced `--clut-
cell-size` inside `#color-bar` (this is the SAME rule already handled in
Step 3 above via `css/utilities.css` — this note is here only so the
implementer doesn't look for a second copy; there is only the one, in
`utilities.css`) and the checkbox-hiding rule:

Old:
```css
#color-bar .clut-bit input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}
```

New: (delete — `#color-rail .clut-bit input` from Task 2 covers it)

- [ ] **Step 5: Run the Node suite**

Run: `node tests/run-all.js`
Expected: all suites PASS

- [ ] **Step 6: Rewrite the affected shell.spec.js tests**

Read the full current file first: `H:\PixULA\tests\browser\shell.spec.js`.

Replace the test at lines 23-57 (`'top colour bar: flash, 2×8 CLUT, wells,
border, attr ops; left rail = tool registry'`):

Old:
```js
test('top colour bar: flash, 2×8 CLUT, wells, border, attr ops; left rail = tool registry', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#flash-toggle')).toBeAttached();

    const clut = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#clut-cluster .clut-row')];
        return rows.map(r => r.querySelectorAll('.color-swatch').length);
    });
    expect(clut).toEqual([8, 8]); // ink row + paper row

    // The colour cluster, Border dropdown and attr ops live in the top
    // #color-bar; the Ink/Paper preview wells moved to #color-preview at the
    // top of the left tool rail.
    const rail = await page.evaluate(() => ({
        wells: [...document.querySelectorAll('#color-preview .color-swatch[role="button"]')].length,
        selects: [...document.querySelectorAll('#color-bar select')].length,
        attrOps: [...document.querySelectorAll('#attr-tools button')].length
    }));
    expect(rail.wells).toBeGreaterThanOrEqual(2);
    expect(rail.selects).toBeGreaterThanOrEqual(1);
    expect(rail.attrOps).toBeGreaterThanOrEqual(2); // Swap + Apply (cycle buttons removed 2026-07-08)

    // Tool rail is generated from the TOOLS registry — assert it matches.
    // `variantOf` entries are reached from another tool's options (the bezier
    // curve, from the Shape list), so they are registry rows without a button.
    const tools = await page.evaluate(() => ({
        rail: [...document.querySelectorAll('#tool-rail button[data-tool]')].map(b => b.dataset.tool),
        registry: (window.TOOL_GROUPS || []).flatMap(
            g => (g.tools || []).filter(t => !t.variantOf).map(t => t.id || t))
    }));
    expect(tools.rail.length).toBeGreaterThanOrEqual(13);
    if (tools.registry.length) {
        expect(tools.rail).toEqual(tools.registry);
    }
});
```

New:
```js
test('colour rail: flash, 2×8 CLUT; left rail = tool registry; top strip keeps border + attr ops', async ({ page }) => {
    await boot(page);
    // Bright/Flash and the swatch cluster live in the vertical colour rail
    // between the tool rail and the canvas, not the top strip (2026-08-25).
    await expect(page.locator('#color-rail #flash-toggle')).toBeAttached();

    const clut = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#clut-cluster .clut-row')];
        return rows.map(r => r.querySelectorAll('.color-swatch').length);
    });
    expect(clut).toEqual([8, 8]); // ink row + paper row

    // The Ink/Paper preview wells live in #color-preview at the top of the
    // left tool rail; Border and the attr ops (Swap/Recolour) stay on the
    // top #color-bar strip.
    const rail = await page.evaluate(() => ({
        wells: [...document.querySelectorAll('#color-preview .color-swatch[role="button"]')].length,
        selects: [...document.querySelectorAll('#color-bar select')].length,
        attrOps: [...document.querySelectorAll('#attr-tools button')].length
    }));
    expect(rail.wells).toBeGreaterThanOrEqual(2);
    expect(rail.selects).toBeGreaterThanOrEqual(1);
    expect(rail.attrOps).toBeGreaterThanOrEqual(2); // Swap + Apply (cycle buttons removed 2026-07-08)

    // Tool rail is generated from the TOOLS registry — assert it matches.
    // `variantOf` entries are reached from another tool's options (the bezier
    // curve, from the Shape list), so they are registry rows without a button.
    const tools = await page.evaluate(() => ({
        rail: [...document.querySelectorAll('#tool-rail button[data-tool]')].map(b => b.dataset.tool),
        registry: (window.TOOL_GROUPS || []).flatMap(
            g => (g.tools || []).filter(t => !t.variantOf).map(t => t.id || t))
    }));
    expect(tools.rail.length).toBeGreaterThanOrEqual(13);
    if (tools.registry.length) {
        expect(tools.rail).toEqual(tools.registry);
    }
});
```

Replace the whole test at lines 59-225 (`'every row of the colour bar sits
on one baseline and one pitch'`, including its leading comment block):

Old: everything from the comment starting `/*\n * However many rows the
colour bar takes...` (line 59) through the closing `});` of the test (line
225) — this is the full block quoted in this plan's exploration; delete it
in its entirety.

New:
```js
/*
 * The top strip (#color-bar) now carries only Border and the marks group
 * (draw modes, Mirror, Swap/Recolour) — the palette cluster moved to
 * #color-rail 2026-08-25 (see tests/browser/color-rail.spec.js). Every
 * control here is still the same size and sits on one baseline.
 */
test('every row of the top strip sits on one baseline and one pitch', async ({ page }) => {
    await boot(page);

    const split = await page.evaluate(() => ({
        swatchesInMarks: document.querySelectorAll('#color-bar-controls .color-swatch').length,
        swatchesInColorBar: document.querySelectorAll('#color-bar .color-swatch').length,
        marks: [...document.querySelectorAll('#color-bar-controls button')]
            .map((b) => b.id || b.dataset.drawMode),
        attrsGroupKeeps: ['#border-select'].filter((s) => document.querySelector(`#toolbar-attrs ${s}`)).length,
        bitsMovedOut: ['#bright-toggle', '#flash-toggle'].filter((s) => document.querySelector(`#toolbar-attrs ${s}`)).length
    }));
    expect(split.swatchesInMarks).toBe(0);
    expect(split.swatchesInColorBar).toBe(0); // no swatches on the top strip at all now
    expect(split.marks).toEqual(['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel',
        'symmetry-h-toggle', 'symmetry-v-toggle', 'symmetry-quad-toggle',
        'attr-transpose', 'attr-apply']);
    expect(split.attrsGroupKeeps).toBe(1); // just Border now
    expect(split.bitsMovedOut).toBe(0);    // Bright/Flash live in #color-rail

    const pitch = await page.evaluate(() => {
        const label = document.getElementById('marks-group-label');
        const cells = [...document.querySelectorAll('#marks-icons-row button')]
            .filter((el) => el.offsetParent !== null);
        const rect = (c) => c.getBoundingClientRect();
        return {
            n: cells.length,
            widths: [...new Set(cells.map((c) => Math.round(rect(c).width)))],
            labelText: label ? label.textContent.trim() : null,
            labelAboveIcons: label ? rect(label).bottom <= rect(cells[0]).top + 1 : false
        };
    });
    expect(pitch.n).toBe(11);        // Swap, Recolour + 6 draw modes + 3 mirror toggles
    expect(pitch.widths).toHaveLength(1);
    expect(pitch.labelText).toBeTruthy();
    expect(pitch.labelAboveIcons).toBe(true);

    const bar = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('#color-bar button, #color-bar select')]
            .filter((el) => el.offsetParent !== null);
        const round = (n) => Math.round(n * 10) / 10;
        const rows = new Map();
        for (const el of controls) {
            const r = el.getBoundingClientRect();
            const key = round(Math.round(r.top / 40));
            if (!rows.has(key)) rows.set(key, []);
            rows.get(key).push({ top: round(r.top), h: round(r.height) });
        }
        return [...rows.values()].map((row) => ({
            count: row.length,
            tops: [...new Set(row.map((c) => c.top))],
            heights: [...new Set(row.map((c) => c.h))]
        }));
    });

    expect(bar.length).toBe(1); // ALWAYS exactly one row now
    for (const row of bar) {
        expect(row.count).toBeGreaterThan(1);
        expect(row.tops).toHaveLength(1);
        expect(row.heights).toHaveLength(1);
    }

    const captions = await page.evaluate(() => {
        const uncaptioned = [...document.querySelectorAll('#color-bar button, #color-bar select')]
            .filter((el) => el.offsetParent !== null && !el.closest('#marks-icons-row')
                && !el.closest('.btn-captioned'))
            .map((el) => el.id || el.className);
        const labels = [...document.querySelectorAll('#color-bar .btn-label')];
        const groupLabel = document.getElementById('marks-group-label');
        const styleOf = (l) => {
            const cs = getComputedStyle(l);
            return `${cs.fontSize}|${cs.fontWeight}|${cs.textAlign}`;
        };
        const marksIconsCaptioned = [...document.querySelectorAll('#marks-icons-row button')]
            .filter((el) => el.offsetParent !== null && el.closest('.btn-captioned'))
            .map((el) => el.id || el.className);
        return {
            uncaptioned,
            styles: [...new Set(labels.map(styleOf))],
            groupLabelStyle: groupLabel ? styleOf(groupLabel) : null,
            marksIconsCaptioned,
            strays: document.querySelectorAll('#color-bar label:not(.clut-bit)').length
        };
    });
    expect(captions.uncaptioned).toEqual([]);
    expect(captions.styles).toHaveLength(1);
    expect(captions.groupLabelStyle).toBe(captions.styles[0]);
    expect(captions.marksIconsCaptioned).toEqual([]);
    expect(captions.strays).toBe(0);
});
```

Replace the whole `test.describe('the colour bar spends only the height it
needs', ...)` block (lines 227-279, including its leading comment and the
`barRows` helper definition):

Old: everything from the comment starting `/*\n * The bar EARNS its second
row...` (line 227) through the closing `});` of the `test.describe` (line
279) — delete in its entirety.

New:
```js
/*
 * The top strip is now small enough (Border + 11 marks icons) that
 * ColorBarFit's job changed from "keep it to two rows" to "keep it to
 * exactly one, always" — see js/ui/components/colorbar-fit.js. Unlike the
 * old two-row bar, there is no width at which a second row is acceptable.
 */
const barRows = (page) => page.evaluate(() => {
    const tops = new Set();
    for (const el of document.querySelectorAll('#color-bar button, #color-bar select')) {
        if (el.offsetParent === null) continue;
        tops.add(Math.round(el.getBoundingClientRect().top / 20));
    }
    return tops.size;
});

test.describe('the top strip is always exactly one row', () => {
    for (const width of [1024, 1366, 1600, 2560]) {
        test(`at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await boot(page);
            expect(await barRows(page)).toBe(1);
        });
    }
});
```

Replace the whole `test.describe('ColorBarFit keeps the bar at two rows
across interface sizes', ...)` block (lines 281-412, including its leading
comment):

Old: everything from the comment starting `/*\n * ColorBarFit
(js/ui/components/colorbar-fit.js): raising the interface-size...` (line
281) through the closing `});` of the `test.describe` (line 412) — delete in
its entirety.

New:
```js
/*
 * ColorBarFit (js/ui/components/colorbar-fit.js): the top strip must never
 * wrap to a second row, at any interface-size setting or window width from
 * 1024px up. This is the same shrink-only binary search the bar always
 * used, just retargeted from "fits two rows" to "fits one, always" now that
 * the palette cluster (the thing that used to make two rows necessary)
 * lives in #color-rail instead — see docs/superpowers/specs/
 * 2026-08-25-colour-rail-design.md.
 *
 * As before, this does NOT hold at every width for every scale this
 * component could in principle be asked to reach — #toolbar, #color-rail
 * and #panels are different regions with no floor of their own, so past a
 * high enough combined width those tracks alone can exceed a narrow window
 * and leave #color-bar's own grid column at zero regardless of
 * --colorbar-scale. That is exactly why the interface-size selector's
 * presets stop at 200%.
 */
test.describe('ColorBarFit keeps the top strip at one row across interface sizes', () => {
    for (const width of [1024, 1366, 1600]) {
        test.describe(`at ${width}px`, () => {
            test.use({ viewport: { width, height: 900 } });
            for (const scale of ['1.25', '1.5', '2']) {
                test(`${Math.round(scale * 100)}% still gets one row`,
                    async ({ page }) => {
                        await boot(page);
                        await page.selectOption('#font-scale-selector', scale);
                        await page.waitForTimeout(250);
                        const result = await page.evaluate(() => {
                            const bar = document.getElementById('color-bar');
                            const tops = new Set();
                            for (const el of document.querySelectorAll('#color-bar button, #color-bar select')) {
                                if (el.offsetParent === null) continue;
                                tops.add(Math.round(el.getBoundingClientRect().top / 10));
                            }
                            return {
                                rows: tops.size,
                                hasHorizontalOverflow: bar.scrollWidth > bar.clientWidth + 1
                            };
                        });
                        expect(result.rows).toBe(1);
                        expect(result.hasHorizontalOverflow).toBe(false);
                    });
            }
        });
    }

    test('the selector offers nothing above 200%, and a stale stored value above it is clamped down',
        async ({ page }) => {
            await boot(page);
            const values = await page.$$eval('#font-scale-selector option', o => o.map(x => x.value));
            expect(values.map(Number)).toEqual(expect.arrayContaining([0.85, 1, 1.25, 1.5, 2]));
            expect(Math.max(...values.map(Number))).toBe(2);

            await page.evaluate(() => Storage.set('uiFontScale', '3'));
            await reload(page);
            const after = await page.evaluate(() => ({
                selector: document.getElementById('font-scale-selector').value,
                uiScale: getComputedStyle(document.documentElement)
                    .getPropertyValue('--ui-scale').trim()
            }));
            expect(after.selector).toBe('2');
            expect(after.uiScale).toBe('2');
        });

    test('the safety margin actually grows at a fractional device pixel ratio',
        async ({ page }) => {
            const scaleAt = async (dpr) => {
                await page.setViewportSize({ width: 1024, height: 900 });
                const client = await page.context().newCDPSession(page);
                await client.send('Emulation.setDeviceMetricsOverride', {
                    width: 1024, height: 900, deviceScaleFactor: dpr, mobile: false
                });
                await boot(page);
                await page.selectOption('#font-scale-selector', '2');
                await page.waitForTimeout(300);
                return parseFloat(await page.evaluate(() =>
                    getComputedStyle(document.getElementById('color-bar'))
                        .getPropertyValue('--colorbar-scale').trim()));
            };
            const atIntegerDpr = await scaleAt(1);
            const atFractionalDpr = await scaleAt(1.25);
            expect(atFractionalDpr).toBeLessThan(atIntegerDpr);
        });
});
```

Finally, delete the whole `test.describe('the colour group fits the bar',
...)` block (lines 414-468, including its leading comment) — this concern
is now covered by `tests/browser/color-rail.spec.js`'s "the colour rail
stays within its fixed width" describe block, added in Task 3:

Old: everything from the comment starting `/*\n * The colour group is NEVER
wider than the bar...` (line 414) through the closing `});` of the
`test.describe` (line 468) — delete in its entirety, leaving the file to
continue directly with the `test('top bar: global draw-mode selector drives
StateManager and persists', ...)` test that currently follows at line 470
(that test and everything after it in the file is unchanged).

- [ ] **Step 7: Run the rewritten shell.spec.js**

Run: `npx playwright test tests/browser/shell.spec.js`
Expected: all tests PASS

- [ ] **Step 8: Run color-rail.spec.js and modes.spec.js to confirm no regressions**

Run: `npx playwright test tests/browser/color-rail.spec.js tests/browser/modes.spec.js`
Expected: all tests PASS, including `modes.spec.js`'s unmodified `#toolbar-
color`/`#attr-tools` ID-based assertions

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/colorbar-fit.js css/components.css css/utilities.css tests/browser/shell.spec.js
git commit -m "feat: retarget ColorBarFit to a guaranteed single row"
```

---

## Task 5: Active-state / no-resize regression spec

**Files:**
- Create: `H:\PixULA\tests\browser\color-rail-stability.spec.js`

**Interfaces:**
- Consumes: `#color-rail`, `#color-bar`, `--colorbar-scale` (Tasks 1-4);
  `#clut-selector .clut-select-btn` (`js/ui/components/clut-bar.js`
  `_buildUlaplusCluster`); `#symmetry-h-toggle`, `#draw-modes
  button[data-draw-mode]`, `#attr-transpose` (unchanged existing IDs).
- Produces: nothing consumed elsewhere — this is a leaf regression spec.

- [ ] **Step 1: Write the failing tests**

Create `H:\PixULA\tests\browser\color-rail-stability.spec.js`:

```js
'use strict';
/**
 * Selecting or toggling any control's active state must never resize that
 * control, #color-rail, or #color-bar — see the "Active-state addendum"
 * (S:7) in docs/superpowers/specs/2026-08-25-colour-rail-design.md.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const rectOf = (page, selector) => page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
}, selector);

const outerRectOf = (page, id) => page.evaluate((i) => {
    const r = document.getElementById(i).getBoundingClientRect();
    return { width: r.width, height: r.height };
}, id);

test('selecting an ink swatch does not resize the swatch, the rail, or the top strip', async ({ page }) => {
    await boot(page);
    const railBefore = await outerRectOf(page, 'color-rail');
    const barBefore = await outerRectOf(page, 'color-bar');
    const swatchBefore = await rectOf(page, '#clut-cluster [data-role="ink"][data-base="3"]');

    await page.click('#clut-cluster [data-role="ink"][data-base="3"]');

    const railAfter = await outerRectOf(page, 'color-rail');
    const barAfter = await outerRectOf(page, 'color-bar');
    const swatchAfter = await rectOf(page, '#clut-cluster [data-role="ink"][data-base="3"]');

    expect(railAfter).toEqual(railBefore);
    expect(barAfter).toEqual(barBefore);
    expect(swatchAfter).toEqual(swatchBefore);
});

test('switching ULAplus CLUT does not resize the rail', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('ula_plus'));
    const before = await outerRectOf(page, 'color-rail');

    await page.click('#clut-selector .clut-select-btn:nth-child(2)');

    const after = await outerRectOf(page, 'color-rail');
    expect(after).toEqual(before);
});

test('clicking a draw mode does not retrigger ColorBarFit or resize the top strip', async ({ page }) => {
    await boot(page);
    const scaleBefore = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-bar'))
            .getPropertyValue('--colorbar-scale').trim());
    const barBefore = await outerRectOf(page, 'color-bar');
    const buttonBefore = await rectOf(page, '#draw-modes button[data-draw-mode="xor"]');

    await page.click('#draw-modes button[data-draw-mode="xor"]');

    const scaleAfter = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-bar'))
            .getPropertyValue('--colorbar-scale').trim());
    const barAfter = await outerRectOf(page, 'color-bar');
    const buttonAfter = await rectOf(page, '#draw-modes button[data-draw-mode="xor"]');

    expect(scaleAfter).toBe(scaleBefore);
    expect(barAfter).toEqual(barBefore);
    expect(buttonAfter).toEqual(buttonBefore);
});

test('toggling Mirror and engaging Swap/Recolour do not resize the top strip', async ({ page }) => {
    await boot(page);
    const barBefore = await outerRectOf(page, 'color-bar');

    await page.click('#symmetry-h-toggle');
    await page.click('#attr-transpose');

    const barAfter = await outerRectOf(page, 'color-bar');
    expect(barAfter).toEqual(barBefore);
});
```

- [ ] **Step 2: Run the tests**

Run: `npx playwright test tests/browser/color-rail-stability.spec.js`
Expected: all four tests PASS (Tasks 1-4 already establish every guarantee
these tests check; if any fails, it means one of those tasks left a gap —
diagnose against the specific assertion that failed rather than assuming
which task is at fault).

- [ ] **Step 3: Commit**

```bash
git add tests/browser/color-rail-stability.spec.js
git commit -m "test: pin that selecting a control never resizes the rail or top strip"
```

---

## Task 6: Full verification pass

**Files:** none (verification only; fixes only if something breaks)

- [ ] **Step 1: Run the Node suite**

Run: `node tests/run-all.js`
Expected: all suites PASS (lint-architecture.test.js included — confirms no
inline hex colours, no string-literal EventBus calls, no emoji, etc. were
introduced across every file this plan touched)

- [ ] **Step 2: Run the full Playwright suite**

Run: `npm run test:browser`
Expected: all specs PASS, including the untouched `tests/browser/
modes.spec.js` (its `#toolbar-color`/`#attr-tools` ID-based lookups) and
every other existing spec file not mentioned in this plan.

- [ ] **Step 3: If anything fails, diagnose and fix**

If a spec outside the ones this plan edited fails, it depends on something
about the OLD `#color-bar` layout this plan didn't anticipate (e.g. a
z-index/overlap assumption, a `:hover`/focus-visible interaction, or a
locale-specific caption width). Use the `superpowers:systematic-debugging`
skill: reproduce with `npx playwright test <file> -g "<failing test name>"
--headed` if useful, read the assertion that failed, and trace it to the
specific CSS/HTML change in this plan that caused it — do not guess or
loosen the assertion without understanding why it started failing. Fix the
root cause (usually a missed rail-scoped CSS rule, per Tasks 2-3's pattern)
rather than the test.

- [ ] **Step 4: Commit any fixes from Step 3**

```bash
git add -A
git commit -m "fix: address regressions found in full-suite verification"
```

(Skip this step entirely if Steps 1-2 were clean — do not create an empty
commit.)

---

## Task 7: Document the change in CLAUDE.md

**Files:**
- Modify: `H:\PixULA\CLAUDE.md`

- [ ] **Step 1: Add a dated entry**

In `H:\PixULA\CLAUDE.md`, insert a new paragraph directly after the
existing "Post-rebuild work, 2026-08-19" section (which ends with "Storage
DB v7 -> **v8** (COMPANION store, holding the paired token and folder
authorizations).") and before the "Post-rebuild feature — user presets
(2026-08-06):" paragraph that currently follows it:

New paragraph to insert:
```markdown
**Post-rebuild work, 2026-08-25.** The top colour bar's palette swatches
(Ink/Paper/Bright/Flash and every other screen mode's palette UI) moved out
into a new vertical `#color-rail` between the tool rail and the canvas —
fixed-size swatches, scaling only with `--ui-scale`, scrolling vertically
for palettes taller than the rail (the 256-entry Next grid, mainly). This
replaces `ColorBarFit`'s live two-row binary search over the whole bar
(swatches + Border + draw modes together), which was the cause of visible
resize flicker during a window drag. What's left on the top `#color-bar`
strip — draw modes, Mirror, Swap/Recolour, Border — is small and constant
enough across every screen mode that `ColorBarFit` now guarantees it
renders as exactly ONE row, always, rather than shrinking to fit two. See
`docs/superpowers/specs/2026-08-25-colour-rail-design.md`.
```

- [ ] **Step 2: Verify the file is still valid markdown**

Run: `node -e "require('fs').readFileSync('CLAUDE.md', 'utf8')"`
Expected: no error (this is just a read-back sanity check; CLAUDE.md has no
automated linting)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the vertical colour rail split in CLAUDE.md"
```
