// "Booklet mode" on the Study & Analysis page: a repertoire-wide index of
// every heading/subheading on the left, and two independent "booklets" that
// each isolate one named line (its own notation subtree + a handful of
// reference boards) so two lines — from the same opening or different ones
// — can be read and compared side by side. State auto-saves to DB.settings
// (no explicit Save button, unlike the rest of the Study page).

// A5 portrait (148 x 210mm) at the exported page's 6mm margin.
const PRINT_PAGE_CONTENT_WIDTH_MM = 136;
const PRINT_PAGE_CONTENT_HEIGHT_MM = 198;
const PRINT_MM_TO_PX = 96 / 25.4;

const Booklet = {
  active: false,
  openings: [],
  activeSlot: 1,
  selectedForExport: new Set(), // "openingId:nodeId" keys checked in the index
  slots: {
    1: { openingId: null, nodeId: null, boardPaths: [], boardLabels: [], boards: [], activeBoardIdx: 0 },
    2: { openingId: null, nodeId: null, boardPaths: [], boardLabels: [], boards: [], activeBoardIdx: 0 },
  },
  saveTimer: null,

  async init() {
    this.els = {
      btnToggle: document.getElementById('btnToggleBooklet'),
      btnExit: document.getElementById('btnExitBooklet'),
      workspace: document.getElementById('bookletWorkspace'),
      indexTree: document.getElementById('bookletIndexTree'),
      btnExportSelected: document.getElementById('btnExportSelected'),
      btnExportAll: document.getElementById('btnExportAll'),
      saveStatus: document.getElementById('studySaveStatus'),
      btnSaveStudy: document.getElementById('btnSaveStudy'),
    };
    this.els.btnToggle.addEventListener('click', () => this.enter());
    this.els.btnExit.addEventListener('click', () => this.exit());
    this.els.btnExportSelected.addEventListener('click', () => this.exportPdf('selected'));
    this.els.btnExportAll.addEventListener('click', () => this.exportPdf('all'));

    [1, 2].forEach((n) => {
      const slotEl = document.querySelector(`.booklet-slot[data-slot="${n}"]`);
      slotEl.addEventListener('mousedown', () => this.setActiveSlot(n));
      slotEl.querySelector('[data-act="add-board"]').addEventListener('click', () => this.addBoard(n));
    });

    window.addEventListener('afterprint', () => { document.getElementById('printRoot').innerHTML = ''; });
  },

  async enter() {
    this.active = true;
    if (typeof Study !== 'undefined') {
      Study.els.workspace.hidden = true;
      Study.els.empty.hidden = true;
    }
    this.els.workspace.hidden = false;
    this.els.btnToggle.hidden = true;
    this.els.saveStatus.hidden = true;
    this.els.btnSaveStudy.hidden = true;

    this.openings = await DB.openings.getAll();
    this.buildIndex();

    const saved = await DB.getSetting('bookletState', null);
    for (const n of [1, 2]) {
      const s = saved && saved['slot' + n];
      if (s && s.openingId && s.nodeId && this.openings.some((o) => o.id === s.openingId)) {
        await this.loadSlot(n, s.openingId, s.nodeId, { boardPaths: s.boardPaths, boardLabels: s.boardLabels }, { skipSave: true });
      }
    }
    this.setActiveSlot(this.activeSlot);
  },

  async exit() {
    this.active = false;
    this.els.workspace.hidden = true;
    this.els.btnToggle.hidden = false;
    this.els.saveStatus.hidden = false;
    this.els.btnSaveStudy.hidden = false;
    // Refresh (not just show) — anything edited while in booklet mode
    // (comments, marks, headings) needs to reach Study's own view too,
    // since it keeps its own separate in-memory copy of the opening.
    if (typeof Study !== 'undefined') await Study.refreshOpenings();
  },

  setActiveSlot(n) {
    this.activeSlot = n;
    [1, 2].forEach((m) => {
      document.querySelector(`.booklet-slot[data-slot="${m}"]`).classList.toggle('active-slot', m === n);
    });
  },

  // ---------- index ----------

  buildIndex() {
    this.els.indexTree.innerHTML = '';
    const byColor = { white: [], black: [] };
    this.openings.forEach((o) => byColor[o.color].push(o));
    let any = false;
    ['white', 'black'].forEach((color) => {
      byColor[color].sort((a, b) => a.name.localeCompare(b.name)).forEach((opening) => {
        const entries = buildOpeningHeadingIndex(opening);
        if (!entries.length) return;
        any = true;
        const wrap = document.createElement('div');
        wrap.className = 'booklet-index-opening';
        const title = document.createElement('div');
        title.className = 'booklet-index-opening-name';
        const titleText = document.createElement('span');
        titleText.textContent = (color === 'white' ? '♔ ' : '♚ ') + opening.name;
        title.appendChild(titleText);
        const exportTreeBtn = document.createElement('button');
        exportTreeBtn.type = 'button';
        exportTreeBtn.className = 'btn btn-ghost tiny booklet-index-export-tree';
        exportTreeBtn.textContent = 'Full tree (A4)';
        exportTreeBtn.title = "Print this opening's entire notation tree, no diagrams, on A4 paper";
        exportTreeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.exportFullTree(opening); });
        title.appendChild(exportTreeBtn);
        wrap.appendChild(title);
        const addRow = (entry, depth) => {
          wrap.appendChild(this.buildIndexRow(opening, entry.node, depth));
          entry.subheadings.forEach((sub) => addRow(sub, depth + 1));
        };
        entries.forEach((entry) => addRow(entry, 0));
        this.els.indexTree.appendChild(wrap);
      });
    });
    if (!any) {
      this.els.indexTree.innerHTML = '<p class="muted booklet-index-empty">No headings yet — right-click a move on the Create Repertoire or Study page to label a key branching point first.</p>';
    }
    this.refreshIndexHighlights();
  },

  buildIndexRow(opening, node, depth) {
    const row = document.createElement('div');
    const depthClass = depth === 0 ? 'booklet-index-heading-row' : depth === 1 ? 'booklet-index-subheading-row' : 'booklet-index-subheading2-row';
    row.className = 'booklet-index-entry ' + depthClass;
    row.dataset.openingId = opening.id;
    row.dataset.nodeId = node.id;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.title = 'Select for export';
    const key = opening.id + ':' + node.id;
    cb.checked = this.selectedForExport.has(key);
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      if (cb.checked) this.selectedForExport.add(key);
      else this.selectedForExport.delete(key);
    });
    const label = document.createElement('span');
    label.className = 'entry-label';
    label.textContent = node.heading;
    row.appendChild(cb);
    row.appendChild(label);
    row.addEventListener('click', () => this.loadSlot(this.activeSlot, opening.id, node.id));
    return row;
  },

  refreshIndexHighlights() {
    [...this.els.indexTree.querySelectorAll('.booklet-index-entry')].forEach((row) => {
      row.classList.remove('loaded-1', 'loaded-2');
      [1, 2].forEach((n) => {
        const slot = this.slots[n];
        if (slot.openingId === row.dataset.openingId && slot.nodeId === row.dataset.nodeId) row.classList.add('loaded-' + n);
      });
    });
  },

  // ---------- default board set ----------

  // Heading position, subheading position, subheading 2 position (whichever
  // of these the line actually has), the selected node's own position, and
  // its ending(s) — deduplicated, since e.g. a heading with no subheading
  // collapses several of these into the same position.
  defaultBoardsFor(opening, node) {
    const root = opening.tree;
    const byLevel = {};
    headingChainFor(root, node).forEach((h) => { byLevel[h.headingLevel || 1] = h; });
    const boards = [];
    const seen = new Set();
    const pushUnique = (n, label) => {
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      boards.push({ path: pathToNode(root, n.id) || [], label });
    };
    pushUnique(byLevel[1], 'Heading');
    pushUnique(byLevel[2], 'Subheading');
    pushUnique(byLevel[3], 'Subheading 2');
    pushUnique(node, 'Selected move');
    const leaves = allLeaves(node);
    leaves.slice(0, 3).forEach((leaf, i) => pushUnique(leaf, leaves.length > 1 ? `Ending ${i + 1}` : 'Ending'));
    if (!boards.length) boards.push({ path: pathToNode(root, node.id) || [], label: 'Selected move' });
    return boards;
  },

  // ---------- loading a slot ----------

  async loadSlot(n, openingId, nodeId, restore, opts = {}) {
    const opening = this.openings.find((o) => o.id === openingId);
    if (!opening) return;
    const node = findNode(opening.tree, nodeId);
    if (!node) return;
    const slot = this.slots[n];
    slot.openingId = openingId;
    slot.nodeId = nodeId;
    slot.activeBoardIdx = 0;

    if (restore && restore.boardPaths && restore.boardPaths.length) {
      slot.boardPaths = restore.boardPaths.map((p) => p || []);
      slot.boardLabels = (restore.boardLabels && restore.boardLabels.length === restore.boardPaths.length)
        ? restore.boardLabels : slot.boardPaths.map((_, i) => `Board ${i + 1}`);
    } else {
      const defaults = this.defaultBoardsFor(opening, node);
      slot.boardPaths = defaults.map((d) => d.path);
      slot.boardLabels = defaults.map((d) => d.label);
    }

    this.renderSlot(n);
    this.refreshIndexHighlights();
    if (!opts.skipSave) this.scheduleSave();
  },

  renderSlot(n) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const node = findNode(opening.tree, slot.nodeId);

    // breadcrumb
    const bcEl = document.getElementById(`bookletBreadcrumb${n}`);
    bcEl.innerHTML = '';
    const addCrumb = (text, cls) => {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = text;
      bcEl.appendChild(s);
    };
    const sep = () => addCrumb('›', 'crumb-sep');
    addCrumb((opening.color === 'white' ? 'White' : 'Black') + ' · ' + opening.name, 'crumb-opening');
    headingChainFor(opening.tree, node).forEach((h) => { sep(); addCrumb(h.heading); });

    // notation — the full path from the opening's root through this line,
    // with any other headed line branching off shown as a compressed stub
    const treeEl = document.getElementById(`bookletTree${n}`);
    renderBookletTree(treeEl, opening, node.id, {
      onSelectFull: (id) => this.jumpBoard(n, id),
      onSelectStub: (id) => this.loadSlot(n, opening.id, id),
      onPlyContext: (id) => this.openPlyStyleEditor(n, id),
    });

    this.rebuildBoards(n);
  },

  // ---------- boards ----------

  rebuildBoards(n) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const orientation = opening.color === 'black' ? 'b' : 'w';
    const grid = document.getElementById(`bookletBoards${n}`);
    grid.innerHTML = '';
    slot.boards = [];
    slot.boardPaths.forEach((path, i) => {
      const panel = document.createElement('div');
      panel.className = 'study-board-panel';
      panel.innerHTML = `
        <div class="study-board-header">
          <span class="booklet-board-label">${escapeHtml(slot.boardLabels[i] || 'Board')}</span>
          <div class="study-board-nav">
            <button type="button" class="btn btn-ghost tiny" data-act="prev" title="Previous move">&#9664;</button>
            <button type="button" class="btn btn-ghost tiny" data-act="next" title="Next move">&#9654;</button>
            <button type="button" class="btn btn-ghost tiny" data-act="reset" title="Back to start">&#8634;</button>
            <button type="button" class="board-close-btn" data-act="close" title="Remove this board">&times;</button>
          </div>
        </div>
        <div class="board-mount board-mini" data-mount></div>
        <div class="branch-menu" data-branch-menu hidden></div>
        <p class="board-breadcrumb muted" data-breadcrumb></p>
      `;
      grid.appendChild(panel);
      const board = new Board(panel.querySelector('[data-mount]'), {
        interactive: false,
        onSelect: () => { slot.activeBoardIdx = i; },
      });
      board.orientation = orientation;
      slot.boards.push(board);

      panel.querySelector('[data-act="prev"]').addEventListener('click', () => { slot.activeBoardIdx = i; this.stepBoard(n, i, -1); });
      panel.querySelector('[data-act="next"]').addEventListener('click', (e) => { slot.activeBoardIdx = i; this.stepBoard(n, i, 1, e.currentTarget); });
      panel.querySelector('[data-act="reset"]').addEventListener('click', () => { slot.activeBoardIdx = i; this.setBoardPath(n, i, []); });
      const closeBtn = panel.querySelector('[data-act="close"]');
      closeBtn.addEventListener('click', () => this.removeBoard(n, i));
      closeBtn.hidden = slot.boardPaths.length <= 1;

      this.renderBoardVisual(n, i);
    });
    document.getElementById(`bookletBoardCount${n}`).textContent = `${slot.boardPaths.length} board${slot.boardPaths.length === 1 ? '' : 's'}`;
  },

  renderBoardVisual(n, i) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const node = resolvePath(opening.tree, slot.boardPaths[i]);
    const board = slot.boards[i];
    board.setPosition(node.fenAfter, board.orientation);
    board.setLastMove(node.uci ? node.uci.slice(0, 2) : null, node.uci ? node.uci.slice(2, 4) : null);
    const panel = document.getElementById(`bookletBoards${n}`).children[i];
    panel.querySelector('[data-breadcrumb]').textContent = this.breadcrumbFor(opening, slot.boardPaths[i]) || 'Starting position';
  },

  breadcrumbFor(opening, path) {
    let cur = opening.tree;
    const sans = [];
    path.forEach((idx) => {
      cur = cur.children[idx];
      if (!cur) return;
      const label = cur.ply % 2 === 1 ? `${(cur.ply + 1) / 2}.` : (sans.length === 0 ? `${cur.ply / 2}...` : '');
      sans.push((label ? label + ' ' : '') + cur.san);
    });
    return sans.join(' ');
  },

  jumpBoard(n, nodeId) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const path = pathToNode(opening.tree, nodeId);
    if (!path) return;
    this.setBoardPath(n, slot.activeBoardIdx, path);
  },

  setBoardPath(n, i, path) {
    this.slots[n].boardPaths[i] = path;
    this.renderBoardVisual(n, i);
    this.scheduleSave();
  },

  stepBoard(n, i, dir, anchorBtn) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const path = slot.boardPaths[i];
    if (dir < 0) {
      if (!path.length) return;
      this.setBoardPath(n, i, path.slice(0, -1));
      return;
    }
    const node = resolvePath(opening.tree, path);
    if (!node.children.length) { toast('End of this line'); return; }
    if (node.children.length === 1) { this.setBoardPath(n, i, [...path, 0]); return; }
    this.openBranchMenu(n, i, node, anchorBtn);
  },

  openBranchMenu(n, i, node, anchorBtn) {
    const panel = document.getElementById(`bookletBoards${n}`).children[i];
    const menu = panel.querySelector('[data-branch-menu]');
    menu.innerHTML = '';
    node.children.forEach((child, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'branch-menu-item';
      b.textContent = child.san + (child.markGlyph || '');
      b.addEventListener('click', () => {
        menu.hidden = true;
        this.setBoardPath(n, i, [...this.slots[n].boardPaths[i], idx]);
      });
      menu.appendChild(b);
    });
    menu.hidden = false;
    const closeOnce = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        menu.hidden = true;
        document.removeEventListener('mousedown', closeOnce);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnce), 0);
  },

  addBoard(n) {
    const slot = this.slots[n];
    if (slot.boardPaths.length >= 9) return;
    slot.boardPaths.push([]);
    slot.boardLabels.push(`Board ${slot.boardPaths.length}`);
    this.rebuildBoards(n);
    this.scheduleSave();
  },

  removeBoard(n, i) {
    const slot = this.slots[n];
    if (slot.boardPaths.length <= 1) return;
    slot.boardPaths.splice(i, 1);
    slot.boardLabels.splice(i, 1);
    this.rebuildBoards(n);
    this.scheduleSave();
  },

  // ---------- editing (right-click a move) ----------

  async openPlyStyleEditor(n, nodeId) {
    const slot = this.slots[n];
    const opening = this.openings.find((o) => o.id === slot.openingId);
    const node = findNode(opening.tree, nodeId);
    const parent = findParent(opening.tree, nodeId);
    const idx = parent ? parent.children.indexOf(node) : -1;
    const existing = (node.heading || node.bold || node.boxed || node.commentBefore || node.commentAfter || node.markColor || node.markGlyph)
      ? {
        heading: node.heading, level: node.headingLevel, bold: node.bold, boxed: node.boxed,
        commentBefore: node.commentBefore, commentAfter: node.commentAfter,
        markColor: node.markColor, markGlyph: node.markGlyph,
      }
      : null;
    const result = await modalPlyStyleEditor(existing, {
      canMoveUp: idx > 0,
      canMoveDown: parent ? idx < parent.children.length - 1 : false,
    });
    if (result === undefined) return;
    if (result && result.reorder) await reorderPly(opening, nodeId, result.reorder);
    else applyPlyStyle(node, result);
    opening.updatedAt = Date.now();
    await DB.openings.put(opening);
    this.buildIndex();
    [1, 2].forEach((m) => { if (this.slots[m].openingId === opening.id) this.renderSlot(m); });
  },

  // ---------- auto-save ----------

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 400);
  },

  async saveNow() {
    const payload = {};
    [1, 2].forEach((n) => {
      const slot = this.slots[n];
      payload['slot' + n] = slot.openingId ? {
        openingId: slot.openingId, nodeId: slot.nodeId,
        boardPaths: slot.boardPaths, boardLabels: slot.boardLabels,
      } : null;
    });
    await DB.setSetting('bookletState', payload);
  },

  // ---------- export to PDF (via the browser's print dialog) ----------

  allTargetsInOrder() {
    const targets = [];
    const byColor = { white: [], black: [] };
    this.openings.forEach((o) => byColor[o.color].push(o));
    const addEntry = (opening, entry) => {
      targets.push({ opening, node: entry.node });
      entry.subheadings.forEach((s) => addEntry(opening, s));
    };
    ['white', 'black'].forEach((color) => {
      byColor[color].sort((a, b) => a.name.localeCompare(b.name)).forEach((opening) => {
        buildOpeningHeadingIndex(opening).forEach((e) => addEntry(opening, e));
      });
    });
    return targets;
  },

  // "Export all" exports only the deepest heading along each line — a
  // heading with a subheading (with or without its own subheading 2) is
  // skipped in favor of that more specific one, since its continuation
  // already covers everything the heading's own page would show.
  // "Export selected" honors exactly what's checked, with no such pruning.
  exportPdf(mode) {
    let targets;
    if (mode === 'selected') {
      if (!this.selectedForExport.size) { toast('Check at least one heading in the index to export'); return; }
      const keys = this.selectedForExport;
      targets = this.allTargetsInOrder().filter((t) => keys.has(t.opening.id + ':' + t.node.id));
    } else {
      targets = this.allTargetsInOrder().filter((t) => !hasDeeperHeading(t.node));
    }
    if (!targets.length) { toast('Nothing to export'); return; }
    this.buildPrintDocument(targets);
    setTimeout(() => window.print(), 50);
  },

  // A separate, standalone export: the opening's complete move tree (every
  // branch and heading, real headings not stubs) as plain notation with no
  // board diagrams, on A4 paper — a denser reference sheet than the per-line
  // booklet spread, for when you want the whole repertoire at a glance.
  exportFullTree(opening) {
    const root = document.getElementById('printRoot');
    root.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'print-page print-full-tree-page';
    const title = document.createElement('div');
    title.className = 'print-page-title';
    title.textContent = (opening.color === 'white' ? 'White' : 'Black') + ' · ' + opening.name;
    page.appendChild(title);
    const notationCol = document.createElement('div');
    notationCol.className = 'print-notation';
    renderTree(notationCol, opening.tree, {});
    page.appendChild(notationCol);
    root.appendChild(page);

    // A second, diagram-only sheet: one board per key branching point (every
    // headed node in the tree), four to a row, each titled with its full
    // heading chain so a nested subheading's diagram is unambiguous even
    // out of context. As many A4 pages as needed — unlike the per-line
    // booklet export, this reference sheet is never pruned to fit one page.
    const headingNodes = collectHeadingNodes(opening.tree);
    if (headingNodes.length) {
      const diagramsPage = document.createElement('div');
      diagramsPage.className = 'print-page print-full-tree-page';
      const dTitle = document.createElement('div');
      dTitle.className = 'print-page-title';
      dTitle.textContent = 'Key Branching Points';
      diagramsPage.appendChild(dTitle);
      const grid = document.createElement('div');
      grid.className = 'print-diagrams-grid';
      headingNodes.forEach((node) => {
        const block = document.createElement('div');
        block.className = 'print-board-block';
        const label = document.createElement('div');
        label.className = 'print-board-label';
        label.textContent = headingChainFor(opening.tree, node).map((h) => h.heading).join(' › ');
        block.appendChild(label);
        const mount = document.createElement('div');
        mount.className = 'board-mount';
        block.appendChild(mount);
        const board = new Board(mount, { interactive: false });
        board.orientation = opening.color === 'black' ? 'b' : 'w';
        board.setPosition(node.fenAfter, board.orientation);
        board.setLastMove(node.uci ? node.uci.slice(0, 2) : null, node.uci ? node.uci.slice(2, 4) : null);
        grid.appendChild(block);
      });
      diagramsPage.appendChild(grid);
      root.appendChild(diagramsPage);
    }

    setTimeout(() => window.print(), 50);
  },

  buildPrintDocument(targets) {
    const root = document.getElementById('printRoot');
    root.innerHTML = '';

    const idxPage = document.createElement('div');
    idxPage.className = 'print-index-page';
    const idxTitle = document.createElement('div');
    idxTitle.className = 'print-index-title';
    idxTitle.textContent = 'Opening Atlas — Index';
    idxPage.appendChild(idxTitle);

    // The index always lists an involved opening's FULL heading outline —
    // every heading, subheading, and subheading 2 — not just the ones that
    // get their own printed page. "Export all" only prints the most
    // specific heading along each line (see exportPdf), so a heading with
    // a subheading wouldn't otherwise appear anywhere in the document; it
    // still belongs in the index as the outline's actual structure.
    const openings = [];
    targets.forEach((t) => { if (!openings.some((o) => o.id === t.opening.id)) openings.push(t.opening); });
    openings.forEach((opening) => {
      const owrap = document.createElement('div');
      owrap.className = 'print-index-opening';
      const oname = document.createElement('div');
      oname.className = 'print-index-opening-name';
      oname.textContent = (opening.color === 'white' ? 'White' : 'Black') + ' — ' + opening.name;
      owrap.appendChild(oname);
      const addRow = (entry) => {
        const row = document.createElement('div');
        row.className = entry.node.headingLevel === 3 ? 'print-index-subheading2' : entry.node.headingLevel === 2 ? 'print-index-subheading' : 'print-index-heading';
        row.textContent = entry.node.heading;
        owrap.appendChild(row);
        entry.subheadings.forEach(addRow);
      };
      buildOpeningHeadingIndex(opening).forEach(addRow);
      idxPage.appendChild(owrap);
    });
    root.appendChild(idxPage);

    // The index is one page (page 1, odd), so without this the first
    // notation page would land on page 2 (even) — a blank filler page
    // pushes it to page 3, an odd/right-hand page, matching how a printed,
    // double-sided reference book conventionally starts each new section.
    const blankPage = document.createElement('div');
    blankPage.className = 'print-page print-blank-page';
    root.appendChild(blankPage);

    targets.forEach(({ opening, node }) => this.buildPrintPage(opening, node).forEach((p) => root.appendChild(p)));
  },

  // Each line prints as a two-page spread, like an open book: a "left" page
  // with the heading and opening name followed by the complete notation
  // tree (never truncated — it can run long, this page is text-only), then
  // a fresh "right" page with just this line's own heading and its
  // reference boards in a grid.
  buildPrintPage(opening, node) {
    const chain = headingChainFor(opening.tree, node);
    const topHeadingText = chain.length ? chain[0].heading : node.heading;

    const notationPage = document.createElement('div');
    notationPage.className = 'print-page print-page-notation';
    const title1 = document.createElement('div');
    title1.className = 'print-page-title';
    title1.textContent = topHeadingText;
    notationPage.appendChild(title1);
    const bc = document.createElement('div');
    bc.className = 'print-breadcrumb';
    bc.textContent = (opening.color === 'white' ? 'White' : 'Black') + ' · ' + opening.name;
    notationPage.appendChild(bc);
    const notationCol = document.createElement('div');
    notationCol.className = 'print-notation';
    notationPage.appendChild(notationCol);
    this.fitNotationToOnePage(notationPage, notationCol, opening, node);

    const boardsPage = document.createElement('div');
    boardsPage.className = 'print-page print-page-boards';
    const title2 = document.createElement('div');
    title2.className = 'print-page-title';
    title2.textContent = node.heading;
    boardsPage.appendChild(title2);
    const boardsCol = document.createElement('div');
    boardsCol.className = 'print-boards';
    this.boardsForPrint(opening, node).forEach((def) => {
      const block = document.createElement('div');
      block.className = 'print-board-block';
      const label = document.createElement('div');
      label.className = 'print-board-label';
      label.textContent = def.label;
      block.appendChild(label);
      const mount = document.createElement('div');
      mount.className = 'board-mount';
      block.appendChild(mount);
      const board = new Board(mount, { interactive: false });
      board.orientation = opening.color === 'black' ? 'b' : 'w';
      const posNode = resolvePath(opening.tree, def.path);
      board.setPosition(posNode.fenAfter, board.orientation);
      board.setLastMove(posNode.uci ? posNode.uci.slice(0, 2) : null, posNode.uci ? posNode.uci.slice(2, 4) : null);
      boardsCol.appendChild(block);
    });
    boardsPage.appendChild(boardsCol);

    return [notationPage, boardsPage];
  },

  // Hard rule: the notation page must fit on one A5 sheet. Renders the full
  // ancestor path and the selected line's own subtree — which are never
  // eligible for removal — plus every "other line" stub, measures the
  // actual rendered height under the real print styles, and if it overflows
  // drops one stub at a time (the deepest/most-specific one first, since
  // stubs earlier on the path represent bigger, more useful opening
  // choices) until it fits or there are no more stubs left to drop.
  fitNotationToOnePage(pageEl, notationCol, opening, node) {
    const excludeStubIds = new Set();
    for (;;) {
      renderBookletTree(notationCol, opening, node.id, { excludeStubIds });
      if (this.measurePrintPageHeightMm(pageEl) <= PRINT_PAGE_CONTENT_HEIGHT_MM) return;
      const stubEls = [...notationCol.querySelectorAll('.tree-heading-stub')];
      if (!stubEls.length) return; // nothing left to drop — the real continuation itself doesn't fit
      excludeStubIds.add(stubEls[stubEls.length - 1].dataset.nodeId);
    }
  },

  // Measures `el`'s rendered height in mm as it will actually appear when
  // printed, by temporarily applying the real @media print rules outside
  // of an actual print job. The visibility-toggling rule that hides
  // everything except #printRoot is dropped (irrelevant here, and would
  // otherwise hide this offscreen measurement element too), and #printRoot
  // is renamed to a throwaway id so this never touches the real one.
  measurePrintPageHeightMm(el) {
    let printCss = '';
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules) {
        if (rule.type === CSSRule.MEDIA_RULE && rule.media.mediaText.includes('print')) {
          printCss = [...rule.cssRules]
            .filter((r) => !(r.selectorText && r.selectorText.includes('body >')))
            .map((r) => r.cssText).join('\n');
        }
      }
    }
    printCss = printCss.replace(/#printRoot/g, '#__measureRoot');

    const style = document.createElement('style');
    style.textContent = printCss;
    document.head.appendChild(style);
    const measureRoot = document.createElement('div');
    measureRoot.id = '__measureRoot';
    measureRoot.style.cssText = 'position:fixed; left:-9999px; top:0;';
    measureRoot.appendChild(el);
    document.body.appendChild(measureRoot);
    el.style.width = (PRINT_PAGE_CONTENT_WIDTH_MM * PRINT_MM_TO_PX) + 'px';
    el.style.boxSizing = 'border-box';

    const heightMm = el.getBoundingClientRect().height / PRINT_MM_TO_PX;

    document.body.removeChild(measureRoot);
    document.head.removeChild(style);
    el.style.width = '';
    el.style.boxSizing = '';
    return heightMm;
  },

  // Uses a live booklet slot's own (possibly user-adjusted) boards when this
  // exact line happens to be open in one, so exporting what you're looking
  // at reflects your customization; falls back to the sensible defaults.
  boardsForPrint(opening, node) {
    for (const n of [1, 2]) {
      const slot = this.slots[n];
      if (slot.openingId === opening.id && slot.nodeId === node.id) {
        return slot.boardPaths.map((path, i) => ({ path, label: slot.boardLabels[i] }));
      }
    }
    return this.defaultBoardsFor(opening, node);
  },
};
