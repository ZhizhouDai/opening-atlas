// "Study and Analysis" page controller: a move tree on the left, a
// variable number of independently-navigable boards on the right.

const BOARD_COLORS = ['#4caf6e', '#5a9be0', '#e0605a', '#e0c95a', '#a06ae0', '#e08a3d', '#2dd4bf', '#e06aa8', '#a3d94c'];
const DEFAULT_NUM_BOARDS = 6;
const MIN_BOARDS = 1;
const MAX_BOARDS = BOARD_COLORS.length;

const Study = {
  color: 'white',
  openings: [],
  opening: null,
  activeBoardIdx: 0,
  boardPaths: [], // one entry per board, each an array of child indices from root
  annotations: {}, // nodeId -> {arrows:[], circles:[], text:''}
  headings: {}, // nodeId -> {text, level}
  collapsedComments: null, // Set<key>, session-only reading aid
  boards: [], // Board instances, parallel to boardPaths
  nodeEls: new Map(),
  commentKeys: [],
  dirty: false,

  async init() {
    this.collapsedComments = new Set();
    this.els = {
      colorTabs: document.getElementById('studyColorTabs'),
      select: document.getElementById('studyOpeningSelect'),
      empty: document.getElementById('studyEmptyState'),
      workspace: document.getElementById('studyWorkspace'),
      tree: document.getElementById('studyTree'),
      grid: document.getElementById('studyBoardGrid'),
      btnSave: document.getElementById('btnSaveStudy'),
      saveStatus: document.getElementById('studySaveStatus'),
      btnToggleComments: document.getElementById('btnToggleComments'),
      btnAddBoard: document.getElementById('btnAddBoard'),
      boardCountLabel: document.getElementById('boardCountLabel'),
    };

    this.els.colorTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      this.setColor(btn.dataset.color);
    });
    this.els.select.addEventListener('change', () => this.selectOpening(this.els.select.value));
    this.els.btnSave.addEventListener('click', () => this.save());
    this.els.btnToggleComments.addEventListener('click', () => this.toggleAllComments());
    this.els.btnAddBoard.addEventListener('click', () => this.addBoard());

    await this.loadOpenings();
  },

  buildBoardGrid() {
    const orientation = this.opening && this.opening.color === 'black' ? 'b' : 'w';
    this.els.grid.innerHTML = '';
    this.boards = [];
    for (let i = 0; i < this.boardPaths.length; i++) {
      const color = BOARD_COLORS[i % BOARD_COLORS.length];
      const panel = document.createElement('div');
      panel.className = 'study-board-panel';
      panel.dataset.idx = i;
      panel.style.setProperty('--board-accent', color);
      panel.innerHTML = `
        <div class="study-board-header">
          <span class="board-dot-label"><span class="board-dot-icon"></span>Board ${i + 1}</span>
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
        <div class="anno-toolbar">
          <span class="anno-label">Draw:</span>
          <div class="anno-colors" data-anno-colors>
            ${['green', 'red', 'blue', 'yellow', 'orange', 'purple'].map((c) => `<button type="button" class="swatch swatch-${c}" data-color="${c}" title="${c}"></button>`).join('')}
          </div>
          <button type="button" class="btn btn-ghost tiny" data-act="clear-anno">Clear</button>
        </div>
        <textarea class="board-note" data-note placeholder="Notes on this position…" rows="2"></textarea>
      `;
      this.els.grid.appendChild(panel);

      const board = new Board(panel.querySelector('[data-mount]'), {
        interactive: false,
        annotatable: true,
        drawColor: 'green',
        onSelect: () => this.setActiveBoard(i),
        onAnnotate: (a) => this.onAnnotate(i, a),
      });
      board.orientation = orientation;
      this.boards.push(board);

      panel.querySelector('[data-act="prev"]').addEventListener('click', () => { this.setActiveBoard(i); this.stepBoard(i, -1); });
      panel.querySelector('[data-act="next"]').addEventListener('click', (e) => { this.setActiveBoard(i); this.stepBoard(i, 1, e.currentTarget); });
      panel.querySelector('[data-act="reset"]').addEventListener('click', () => { this.setActiveBoard(i); this.setBoardPath(i, []); });
      panel.querySelector('[data-act="close"]').addEventListener('click', () => this.removeBoard(i));
      panel.querySelectorAll('[data-anno-colors] button').forEach((b) => {
        b.addEventListener('click', () => {
          this.setActiveBoard(i);
          board.setDrawColor(b.dataset.color);
          panel.querySelectorAll('[data-anno-colors] button').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
        });
      });
      panel.querySelector('[data-act="clear-anno"]').addEventListener('click', () => {
        board.clearAnnotations();
        this.onAnnotate(i, { arrows: [], circles: [] });
      });
      panel.querySelector('[data-note]').addEventListener('input', () => {
        const nodeId = this.currentNodeId(i);
        this.annotations[nodeId] = this.annotations[nodeId] || { arrows: [], circles: [], text: '' };
        this.annotations[nodeId].text = panel.querySelector('[data-note]').value;
        this.markDirty();
      });
      panel.querySelectorAll('[data-anno-colors] button')[0].classList.add('active');
      panel.addEventListener('mousedown', () => this.setActiveBoard(i));
    }
    this.updateBoardChrome();
  },

  updateBoardChrome() {
    const n = this.boardPaths.length;
    this.els.boardCountLabel.textContent = `${n} board${n === 1 ? '' : 's'}`;
    this.els.btnAddBoard.disabled = n >= MAX_BOARDS;
    [...this.els.grid.children].forEach((panel) => {
      const closeBtn = panel.querySelector('[data-act="close"]');
      closeBtn.hidden = n <= MIN_BOARDS;
    });
  },

  // Rebuilds every board panel for the current boardPaths, then restores
  // each board's position/annotations. Used after switching openings and
  // after adding/removing a board.
  rebuildBoards() {
    this.buildBoardGrid();
    for (let i = 0; i < this.boardPaths.length; i++) this.renderBoard(i);
    this.updateActiveIndicator();
    this.updateAllHighlights();
  },

  addBoard() {
    if (this.boardPaths.length >= MAX_BOARDS) return;
    this.boardPaths.push([]);
    this.markDirty();
    this.rebuildBoards();
  },

  removeBoard(i) {
    if (this.boardPaths.length <= MIN_BOARDS) return;
    this.boardPaths.splice(i, 1);
    if (this.activeBoardIdx >= this.boardPaths.length) this.activeBoardIdx = this.boardPaths.length - 1;
    this.markDirty();
    this.rebuildBoards();
  },

  setColor(color) {
    this.color = color;
    [...this.els.colorTabs.children].forEach((b) => b.classList.toggle('active', b.dataset.color === color));
    this.populateSelect();
  },

  async loadOpenings() {
    this.openings = await DB.openings.getAll();
    this.setColor('white');
  },

  // Re-reads the openings list from IndexedDB (picking up anything created
  // or renamed on the Create Repertoire page) without losing the opening
  // currently being studied, if it still exists.
  async refreshOpenings() {
    this.openings = await DB.openings.getAll();
    const keepId = this.opening ? this.opening.id : null;
    this.populateSelect({ preserveId: keepId });
  },

  populateSelect(opts = {}) {
    const list = this.openings.filter((o) => o.color === this.color).sort((a, b) => a.name.localeCompare(b.name));
    this.els.select.innerHTML = '<option value="">Choose an opening…</option>' + list.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
    const keep = opts.preserveId && list.find((o) => o.id === opts.preserveId);
    if (keep) {
      this.els.select.value = keep.id;
      this.opening = keep;
    } else {
      this.opening = null;
      this.showEmptyState();
    }
  },

  showEmptyState() {
    const has = !!this.opening;
    this.els.empty.hidden = has;
    this.els.workspace.hidden = !has;
  },

  async selectOpening(id) {
    if (this.dirty) {
      const ok = await modalConfirm('You have unsaved study changes for the current opening. Discard them?', { danger: true, okLabel: 'Discard' });
      if (!ok) { this.els.select.value = this.opening ? this.opening.id : ''; return; }
    }
    this.opening = this.openings.find((o) => o.id === id) || null;
    this.showEmptyState();
    if (!this.opening) return;

    const saved = await DB.studyState.get(id);
    this.boardPaths = (saved && saved.boards && saved.boards.length)
      ? saved.boards.map((b) => b.path || [])
      : Array.from({ length: DEFAULT_NUM_BOARDS }, () => []);
    this.annotations = (saved && saved.annotations) ? saved.annotations : {};
    this.headings = (saved && saved.headings) ? saved.headings : {};
    this.collapsedComments = new Set();
    this.activeBoardIdx = 0;
    this.dirty = false;
    this.updateSaveStatus();

    this.renderTreePane();
    this.rebuildBoards();
  },

  renderTreePane() {
    const result = renderTree(this.els.tree, this.opening.tree, {
      onSelect: (id) => this.jumpActiveBoardTo(id),
      headings: this.headings,
      onHeadingContext: (id) => this.openHeadingEditor(id),
      collapsedComments: this.collapsedComments,
      onToggleComment: (key) => this.toggleComment(key),
    });
    this.nodeEls = result.nodeEls;
    this.commentKeys = result.commentKeys;
    this.updateAllHighlights();
    this.updateCollapseButtonLabel();
  },

  async openHeadingEditor(nodeId) {
    const existing = this.headings[nodeId];
    const result = await modalHeadingEditor(existing);
    if (result === undefined) return;
    if (result === null) delete this.headings[nodeId];
    else this.headings[nodeId] = result;
    this.markDirty();
    this.renderTreePane();
  },

  toggleComment(key) {
    if (this.collapsedComments.has(key)) this.collapsedComments.delete(key);
    else this.collapsedComments.add(key);
    this.renderTreePane();
  },

  toggleAllComments() {
    const allCollapsed = this.commentKeys.length > 0 && this.commentKeys.every((k) => this.collapsedComments.has(k));
    if (allCollapsed) this.collapsedComments.clear();
    else this.commentKeys.forEach((k) => this.collapsedComments.add(k));
    this.renderTreePane();
  },

  updateCollapseButtonLabel() {
    const allCollapsed = this.commentKeys.length > 0 && this.commentKeys.every((k) => this.collapsedComments.has(k));
    this.els.btnToggleComments.textContent = allCollapsed ? 'Expand comments' : 'Collapse comments';
    this.els.btnToggleComments.disabled = this.commentKeys.length === 0;
  },

  currentNodeId(i) {
    return resolvePath(this.opening.tree, this.boardPaths[i]).id;
  },

  setActiveBoard(i) {
    this.activeBoardIdx = i;
    this.updateActiveIndicator();
  },

  updateActiveIndicator() {
    [...this.els.grid.children].forEach((panel, i) => panel.classList.toggle('active-board', i === this.activeBoardIdx));
  },

  jumpActiveBoardTo(nodeId) {
    const path = pathToNode(this.opening.tree, nodeId);
    if (!path) return;
    this.setBoardPath(this.activeBoardIdx, path);
  },

  setBoardPath(i, path) {
    this.boardPaths[i] = path;
    this.markDirty();
    this.renderBoard(i);
    this.updateAllHighlights();
  },

  stepBoard(i, dir, anchorBtn) {
    const path = this.boardPaths[i];
    if (dir < 0) {
      if (!path.length) return;
      this.setBoardPath(i, path.slice(0, -1));
      return;
    }
    const node = resolvePath(this.opening.tree, path);
    if (!node.children.length) { toast('End of this line'); return; }
    if (node.children.length === 1) { this.setBoardPath(i, [...path, 0]); return; }
    this.openBranchMenu(i, node, anchorBtn);
  },

  openBranchMenu(i, node, anchorBtn) {
    const panel = this.els.grid.children[i];
    const menu = panel.querySelector('[data-branch-menu]');
    menu.innerHTML = '';
    node.children.forEach((child, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'branch-menu-item';
      b.textContent = child.san + (child.markGlyph || '');
      b.addEventListener('click', () => {
        menu.hidden = true;
        this.setBoardPath(i, [...this.boardPaths[i], idx]);
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

  renderBoard(i) {
    const node = resolvePath(this.opening.tree, this.boardPaths[i]);
    const board = this.boards[i];
    board.setPosition(node.fenAfter, board.orientation);
    board.setLastMove(node.uci ? node.uci.slice(0, 2) : null, node.uci ? node.uci.slice(2, 4) : null);
    const anno = this.annotations[node.id] || { arrows: [], circles: [], text: '' };
    board.setAnnotations(anno.arrows, anno.circles);

    const panel = this.els.grid.children[i];
    panel.querySelector('[data-note]').value = anno.text || '';
    panel.querySelector('[data-breadcrumb]').textContent = this.breadcrumbFor(this.boardPaths[i]) || 'Starting position';
  },

  breadcrumbFor(path) {
    let cur = this.opening.tree;
    const sans = [];
    path.forEach((idx) => {
      cur = cur.children[idx];
      if (!cur) return;
      const label = cur.ply % 2 === 1 ? `${(cur.ply + 1) / 2}.` : (sans.length === 0 ? `${cur.ply / 2}...` : '');
      sans.push((label ? label + ' ' : '') + cur.san);
    });
    return sans.join(' ');
  },

  updateAllHighlights() {
    this.nodeEls.forEach((el) => {
      el.classList.remove('active-ply');
      el.querySelector('.ply-dots').innerHTML = '';
    });
    for (let i = 0; i < this.boardPaths.length; i++) {
      const nodeId = this.currentNodeId(i);
      const el = this.nodeEls.get(nodeId);
      if (!el) continue;
      if (i === this.activeBoardIdx) el.classList.add('active-ply');
      const dot = document.createElement('span');
      dot.className = 'board-dot';
      dot.style.background = BOARD_COLORS[i % BOARD_COLORS.length];
      dot.title = `Board ${i + 1}`;
      el.querySelector('.ply-dots').appendChild(dot);
    }
  },

  onAnnotate(i, { arrows, circles }) {
    const nodeId = this.currentNodeId(i);
    this.annotations[nodeId] = this.annotations[nodeId] || { arrows: [], circles: [], text: '' };
    this.annotations[nodeId].arrows = arrows;
    this.annotations[nodeId].circles = circles;
    this.markDirty();
  },

  markDirty() {
    this.dirty = true;
    this.updateSaveStatus();
  },

  updateSaveStatus() {
    this.els.saveStatus.textContent = this.dirty ? 'Unsaved changes' : 'All changes saved';
    this.els.saveStatus.classList.toggle('dirty', this.dirty);
  },

  async save() {
    if (!this.opening) return;
    const record = {
      openingId: this.opening.id,
      boards: this.boardPaths.map((path) => ({ path })),
      annotations: this.annotations,
      headings: this.headings,
      updatedAt: Date.now(),
    };
    await DB.studyState.put(record);
    this.dirty = false;
    this.updateSaveStatus();
    toast('Study saved');
  },
};
