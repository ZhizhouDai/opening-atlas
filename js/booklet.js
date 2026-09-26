// "Booklet mode" on the Study & Analysis page: a repertoire-wide index of
// every heading/subheading on the left, and two independent "booklets" that
// each isolate one named line (its own notation subtree + a handful of
// reference boards) so two lines — from the same opening or different ones
// — can be read and compared side by side. State auto-saves to DB.settings
// (no explicit Save button, unlike the rest of the Study page).

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

  exit() {
    this.active = false;
    this.els.workspace.hidden = true;
    this.els.btnToggle.hidden = false;
    this.els.saveStatus.hidden = false;
    this.els.btnSaveStudy.hidden = false;
    if (typeof Study !== 'undefined') Study.showEmptyState();
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
        title.textContent = (color === 'white' ? '♔ ' : '♚ ') + opening.name;
        wrap.appendChild(title);
        entries.forEach((entry) => {
          wrap.appendChild(this.buildIndexRow(opening, entry.node, false));
          entry.subheadings.forEach((sub) => wrap.appendChild(this.buildIndexRow(opening, sub.node, true)));
        });
        this.els.indexTree.appendChild(wrap);
      });
    });
    if (!any) {
      this.els.indexTree.innerHTML = '<p class="muted booklet-index-empty">No headings yet — right-click a move on the Create Repertoire or Study page to label a key branching point first.</p>';
    }
    this.refreshIndexHighlights();
  },

  buildIndexRow(opening, node, isSub) {
    const row = document.createElement('div');
    row.className = 'booklet-index-entry ' + (isSub ? 'booklet-index-subheading-row' : 'booklet-index-heading-row');
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

  // Heading position, subheading position (if the selected node is a
  // subheading), the selected node's own position, and its ending(s) —
  // deduplicated, since e.g. a heading with no subheading collapses several
  // of these into the same position.
  defaultBoardsFor(opening, node) {
    const root = opening.tree;
    let headingNode = null;
    let subheadingNode = null;
    if (node.headingLevel === 2) {
      subheadingNode = node;
      const path = pathToNode(root, node.id) || [];
      let cur = root;
      for (let i = 0; i < path.length - 1; i++) {
        cur = cur.children[path[i]];
        if (cur.heading && cur.headingLevel === 1) headingNode = cur;
      }
    } else {
      headingNode = node;
    }
    const boards = [];
    const seen = new Set();
    const pushUnique = (n, label) => {
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      boards.push({ path: pathToNode(root, n.id) || [], label });
    };
    pushUnique(headingNode, 'Heading');
    pushUnique(subheadingNode, 'Subheading');
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
    const isSub = node.headingLevel === 2;
    let parentHeadingText = '';
    if (isSub) {
      const path = pathToNode(opening.tree, node.id) || [];
      let cur = opening.tree; let h = null;
      for (let i = 0; i < path.length - 1; i++) { cur = cur.children[path[i]]; if (cur.heading && cur.headingLevel === 1) h = cur; }
      parentHeadingText = h ? h.heading : '';
    }
    const addCrumb = (text, cls) => {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = text;
      bcEl.appendChild(s);
    };
    const sep = () => addCrumb('›', 'crumb-sep');
    addCrumb((opening.color === 'white' ? 'White' : 'Black') + ' · ' + opening.name, 'crumb-opening');
    sep();
    if (parentHeadingText) { addCrumb(parentHeadingText); sep(); }
    addCrumb(node.heading);

    // other headings in the same opening
    const othersEl = document.getElementById(`bookletOthers${n}`);
    othersEl.innerHTML = '';
    const entries = buildOpeningHeadingIndex(opening);
    const flat = [];
    entries.forEach((e) => { flat.push(e.node); e.subheadings.forEach((s) => flat.push(s.node)); });
    const others = flat.filter((h) => h.id !== node.id);
    if (others.length) {
      const label = document.createElement('span');
      label.textContent = 'Other lines here: ';
      label.className = 'muted';
      othersEl.appendChild(label);
      others.forEach((h) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = h.heading;
        b.addEventListener('click', () => this.loadSlot(n, opening.id, h.id));
        othersEl.appendChild(b);
      });
    }

    // notation — a synthetic root isolates just this line's subtree
    const treeEl = document.getElementById(`bookletTree${n}`);
    renderTree(treeEl, wrapAsRoot(node), {
      onSelect: (id) => this.jumpBoard(n, id),
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
    const existing = (node.heading || node.bold || node.boxed)
      ? { heading: node.heading, level: node.headingLevel, bold: node.bold, boxed: node.boxed }
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
    ['white', 'black'].forEach((color) => {
      byColor[color].sort((a, b) => a.name.localeCompare(b.name)).forEach((opening) => {
        buildOpeningHeadingIndex(opening).forEach((e) => {
          targets.push({ opening, node: e.node });
          e.subheadings.forEach((s) => targets.push({ opening, node: s.node }));
        });
      });
    });
    return targets;
  },

  exportPdf(mode) {
    let targets;
    if (mode === 'selected') {
      if (!this.selectedForExport.size) { toast('Check at least one heading in the index to export'); return; }
      const keys = this.selectedForExport;
      targets = this.allTargetsInOrder().filter((t) => keys.has(t.opening.id + ':' + t.node.id));
    } else {
      targets = this.allTargetsInOrder();
    }
    if (!targets.length) { toast('Nothing to export'); return; }
    this.buildPrintDocument(targets);
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
    const groups = [];
    targets.forEach((t) => {
      let g = groups.find((x) => x.opening.id === t.opening.id);
      if (!g) { g = { opening: t.opening, nodes: [] }; groups.push(g); }
      g.nodes.push(t.node);
    });
    groups.forEach((g) => {
      const owrap = document.createElement('div');
      owrap.className = 'print-index-opening';
      const oname = document.createElement('div');
      oname.className = 'print-index-opening-name';
      oname.textContent = (g.opening.color === 'white' ? 'White' : 'Black') + ' — ' + g.opening.name;
      owrap.appendChild(oname);
      g.nodes.forEach((node) => {
        const row = document.createElement('div');
        row.className = node.headingLevel === 2 ? 'print-index-subheading' : 'print-index-heading';
        row.textContent = node.heading;
        owrap.appendChild(row);
      });
      idxPage.appendChild(owrap);
    });
    root.appendChild(idxPage);

    targets.forEach(({ opening, node }) => root.appendChild(this.buildPrintPage(opening, node)));
  },

  buildPrintPage(opening, node) {
    const page = document.createElement('div');
    page.className = 'print-page';

    const isSub = node.headingLevel === 2;
    let parentHeadingText = '';
    if (isSub) {
      const path = pathToNode(opening.tree, node.id) || [];
      let cur = opening.tree; let h = null;
      for (let i = 0; i < path.length - 1; i++) { cur = cur.children[path[i]]; if (cur.heading && cur.headingLevel === 1) h = cur; }
      parentHeadingText = h ? h.heading : '';
    }
    if (isSub && parentHeadingText) {
      const h1 = document.createElement('div'); h1.className = 'print-heading-title'; h1.textContent = parentHeadingText;
      page.appendChild(h1);
      const h2 = document.createElement('div'); h2.className = 'print-subheading-title'; h2.textContent = node.heading;
      page.appendChild(h2);
    } else {
      const h1 = document.createElement('div'); h1.className = 'print-heading-title'; h1.textContent = node.heading;
      page.appendChild(h1);
    }
    const bc = document.createElement('div');
    bc.className = 'print-breadcrumb';
    bc.textContent = (opening.color === 'white' ? 'White' : 'Black') + ' · ' + opening.name;
    page.appendChild(bc);

    const body = document.createElement('div');
    body.className = 'print-body';
    const notationCol = document.createElement('div');
    notationCol.className = 'print-notation';
    renderTree(notationCol, wrapAsRoot(node), {});
    body.appendChild(notationCol);

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
    body.appendChild(boardsCol);
    page.appendChild(body);
    return page;
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
