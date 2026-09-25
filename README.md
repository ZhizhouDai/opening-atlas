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
- Export PGN: copy the current opening to the clipboard, download it as a
  `.pgn` file, or download every opening for the selected color as one
  multi-game PGN file.

### Study & Analysis

- The full move tree is rendered as a clear, indented outline with no
  privileged "mainline" — the instant a position branches, every
  continuation gets its own equally-indented line, so it's obvious exactly
  where and how a line diverges.
- Right-click any move to label it with a heading or subheading (e.g.
  "Rossolimo Variation") in a gold accent color that stands out from the
  moves themselves. Comments can be collapsed individually (click one) or
  all at once, to keep a long tree scannable.
- A variable number of independent boards (1–9, add/remove freely) on the
  right. Click a board to make it active, then click any move in the
  notation to jump that board there — the move gets a colored dot for every
  board currently sitting on it.
- Each board has its own **◀ / ▶** controls to step through the line; at a
  branch point, **▶** asks which continuation to follow.
- Right-click-drag to draw an arrow, right-click a square to circle it —
  any of six colors — and add a free-text note. All of it (board count,
  which position each board shows, every arrow/circle/note/heading) is kept
  in memory until you hit **Save**, which persists it for next time.

## Design

Flat, dark-green themed UI (Fraunces for headings, Inter for everything
else) built with no framework and no build step — plain HTML/CSS/JS,
chess.js for rules, and the Kosal piece set.

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
