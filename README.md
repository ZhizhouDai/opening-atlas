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
- Right-click any move to label it with a heading, subheading, or
  subheading 2 (e.g. "Rossolimo Variation") in a gold accent color, bold or
  box it for emphasis, and reorder it earlier/later among its sibling
  continuations —
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
- **Show diagrams of key branching points** replaces the whole board set
  with one board per headed node in the tree (capped at 9), each named for
  its full heading chain — a quick way to survey every named line at a
  glance. The boards stay fully editable afterward (step, rename, lock,
  annotate) and save normally.
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
  headings, subheadings, and subheading 2s nested underneath (four levels:
  opening → heading → subheading → subheading 2) — narrow enough to stay
  out of the way.
- Two independent **booklets** side by side. Click an index entry to load
  it into whichever booklet is active (click a booklet to make it active);
  the two can show lines from completely different repertoires, for
  side-by-side comparison. Each booklet shows the full notation (with
  comments) for that line, starting from the opening's true root so the
  moves leading up to it are never cut off. Any other headed line branching
  off along the way — at any depth — appears inline in the same tree as a
  compressed stub (just its heading/subheading, no move) laid out up to
  three to a row to save space; clicking a stub switches the whole booklet
  to that line, quick in-place switching without leaving the tree. Right-
  click any move — real or stub — to add comments, a heading, bold/box
  emphasis, or a color+icon mark, exactly like on the Create Repertoire and
  Study pages; it's the same move record, so the change is saved to the
  opening immediately and shows up everywhere else too. The notation panel
  has a drag handle to resize it to fit a whole line without scrolling. A
  handful of boards
  auto-populate at the heading position, the subheading position, the
  subheading 2 position, the line's own ending(s), and a freely-adjustable
  "selected move" board — add or remove boards, and step any of them with
  ◀ / ▶ independently. All of it (which line each booklet shows, every
  board's position) saves automatically.
- **Export to PDF**: check specific headings in the index and "Export
  selected", or "Export all" for the whole repertoire in the order it
  appears in the index. "Export all" prints only the most specific heading
  along each line — a heading with a subheading (or a subheading with its
  own subheading 2) is skipped in favor of that more specific one, since
  its page already covers everything the less specific one would show;
  "Export selected" prints exactly what's checked, regardless of nesting.
  The table of contents page always lists an involved opening's complete
  outline — every heading, subheading, and subheading 2 — even ones that
  don't get their own page, so it always matches what you'd see in the
  index panel. Opens the browser's print dialog (choose "Save as PDF") with
  a two-column table of contents page, a blank filler page (so the first
  line always starts on an odd, right-hand page, as a printed reference
  book's sections conventionally do), then each line as a two-page spread
  — A5 portrait, "Book Antiqua" — a "left" page with the heading and opening
  name followed by the full notation tree and comments, then a "right" page
  with that line's own heading and its reference boards (up to three per
  row) in a grid; printed double-sided, the two land on facing pages. The
  notation page is a hard one-page fit: it's measured against the actual
  print layout, and if the full ancestor path and continuation plus every
  "other line" stub wouldn't fit on one A5 sheet, stubs are dropped one at a
  time (the most specific/deepest ones first) until it does — the real
  continuation itself is never touched or truncated.
- **Export the full tree**: each opening in the index has its own "Full
  tree (A4)" button — a separate, standalone export of that opening's
  complete move tree (every branch and heading, text-only) as a dense
  reference sheet on A4 paper, for when you want the whole repertoire at a
  glance rather than one line at a time. Followed by a diagram sheet — one
  board per key branching point (every headed node), four to a row (each
  label reserves the same fixed height regardless of its heading chain's
  length, so every row of boards lines up) and titled with its full heading
  chain, spanning as many A4 pages as needed. A "Diagrams only (A4)" button
  next to it skips the notation and exports just that sheet, titled with
  the opening rather than a generic label.
- **E-ink friendly boards**: a checkbox in the index swaps every exported
  board's two close-toned greens for high-contrast grayscale — dark squares
  become light gray, light squares become black — for better legibility on
  e-ink displays. Applies to every export (per-line booklet, full tree,
  diagrams only).

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
