# Opening Atlas

Build and study your chess opening repertoire — entirely in your browser.
There's no backend and no account system: every opening, move, comment, and
annotation is stored locally (IndexedDB), and nothing is ever sent anywhere.

## Use it now

**https://zhizhoudai.github.io/opening-atlas/**

Works on any device with a modern browser. Repertoires are stored
per-browser, not in a shared account — opening this link on your phone and
on your PC gives you two separate, independent libraries.

## Features

### Create Repertoire

- Two top-level categories, **White** and **Black**, each holding as many
  named openings ("Scotch Game", "Najdorf Sicilian", …) as you like.
- Play moves directly on the board to record a line, or import a PGN (file
  or pasted text) — imports merge into the existing tree, so shared move
  prefixes combine and new continuations become variations automatically.
- Delete any move (and everything after it) with one click.
- Add a comment **before** and **after** any move.
- Mark any move with a color (green/red/blue/yellow/orange/purple) and an
  icon (!, !!, !?, ?!, ?, ??) — both shown right in the move list.
- Right-click any move to label it with a heading or subheading (e.g.
  "Rossolimo Variation") in a gold accent color, bold or box it for
  emphasis, and reorder it earlier/later among its sibling continuations —
  the same right-click editor as on the Study & Analysis page, since all of
  this lives on the move itself and shows up on both pages immediately,
  with no separate save step. Reordering keeps any saved Study board
  positions pointed at the same moves, wherever they land in the new order.
- Export PGN: copy the current opening to the clipboard, download it as a
  `.pgn` file, or download every opening for the selected color as one
  multi-game PGN file.

### Study & Analysis

- The full move tree is rendered as a clear, indented outline with no
  privileged "mainline" — the instant a position branches, every
  continuation gets its own equally-indented line, so it's obvious exactly
  where and how a line diverges.
- Comments can be collapsed individually (click one) or all at once, to
  keep a long tree scannable.
- "Show key branching points" condenses the tree to just its headed lines,
  pruned the same way the full tree branches — shared moves leading up to a
  heading are shown once, headed lines only actually split where they
  genuinely diverge, and each one collapses to a "⋯" followed by the
  position it eventually reaches, skipping the moves in between. A heading
  nested inside another headed line shows up as its own indented branch
  within it, exactly like the full notation.
- Each board can be renamed — type a name, or pick one of the repertoire's
  existing headings — so "Board 3" can become "Anti-Sicilian Plan" instead.
- A board can be locked so clicking the notation no longer moves it (its
  own ◀ / ▶ controls still do) — handy for keeping a reference position
  pinned on one board while browsing the tree with the others.
- A variable number of independent boards (1–9, add/remove freely). The
  page itself is fluid: on a wide enough screen it uses a much roomier
  container, the notation panel scales with viewport width, and the board
  grid wraps to as many per row as comfortably fit — so a bigger monitor
  genuinely shows more at once, not just a centered island of empty margin.
  Click a board to make it active, then click any move in the notation to
  jump that board there — the move gets a colored dot for every board
  currently sitting on it.
- Each board has its own **◀ / ▶** controls to step through the line; at a
  branch point, **▶** asks which continuation to follow.
- Right-click-drag to draw an arrow, right-click a square to circle it —
  any of six colors — and add a free-text note. All of it (board count,
  which position each board shows, every arrow/circle/note/heading) is kept
  in memory until you hit **Save**, which persists it for next time.

### Booklet mode

A dedicated reference/comparison view, toggled from the Study & Analysis
toolbar:

- A repertoire-wide **index** on the left — every opening, with its
  headings and their subheadings nested underneath (three levels: opening
  → heading → subheading) — narrow enough to stay out of the way.
- Two independent **booklets** side by side. Click an index entry to load
  it into whichever booklet is active (click a booklet to make it active);
  the two can show lines from completely different repertoires, for
  side-by-side comparison. Each booklet shows the full notation (with
  comments) for just that line, links to the opening's other headings for
  quick in-place switching, and a handful of boards auto-populated at the
  heading position, the subheading position, the line's own ending(s), and
  a freely-adjustable "selected move" board — add or remove boards, and
  step any of them with ◀ / ▶ independently. All of it (which line each
  booklet shows, every board's position) saves automatically.
- **Export to PDF**: check specific headings in the index and "Export
  selected", or "Export all" for the whole repertoire in the order it
  appears in the index. Opens the browser's print dialog (choose "Save as
  PDF") with a table of contents page followed by one page per line — A5
  portrait, "Book Antiqua", heading/subheading top-left, notation and
  comments on the left, reference boards on the right.

## Design

Flat UI with a light background and a green accent (Fraunces for headings,
Inter for everything else) built with no framework and no build step —
plain HTML/CSS/JS, chess.js for rules, and the Kosal piece set.

## Running a local copy

No Node or Python required — this folder has everything needed.

**Easiest way:** double-click **`Start Opening Atlas.bat`**.

Or from a terminal in this folder:

```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```

Then open **http://localhost:8844**.

## Updating the deployed site

The live site is a GitHub Pages deployment of this repo
(`ZhizhouDai/opening-atlas`, `master` branch, served from `/`). Push to
`master` and GitHub rebuilds the Pages site automatically.

## Credits

Chess rules/move generation: [chess.js](https://github.com/jhlywa/chess.js)
(BSD-2-Clause). Piece set: [Kosal](https://github.com/philatype/kosal) by
philatype (CC BY 4.0).
