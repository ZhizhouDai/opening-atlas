// "Study and Analysis" page controller: a read-only move tree on the left,
// six independently-navigable boards on the right.

const BOARD_COLORS = ['#4caf6e', '#5a9be0', '#e0605a', '#e0c95a', '#a06ae0', '#e08a3d'];
const NUM_BOARDS = 6;

const Study = {
  color: 'white',
  openings: [],
  opening: null,
  activeBoardIdx: 0,
  boardPaths: [], // NUM_BOARDS entries, each an array of child indices from root
  annotations: {}, // nodeId -> {arrows:[], circles:[], text:''}
  boards: [], // Board instances
  nodeEls: new Map(),
  dirty: false,

  async init() {
    this.els = {
      colorTabs: document.getElementById('studyColorTabs'),
      select: document.getElementById('studyOpeningSelect'),
      empty: document.getElementById('studyEmptyState'),
      workspace: document.getElementById('studyWorkspace'),
      tree: document.getElementById('studyTree'),
      grid: document.getElementById('studyBoardGrid'),
      btnSave: document.getElementById('btnSaveStudy'),
      saveStatus: document.getElementById('studySaveStatus'),
    };

    this.els.colorTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      this.setColor(btn.dataset.color);
    });
    this.els.select.addEventListener('change', () => this.selectOpening(this.els.select.value));
    this.els.btnSave.addEventListener('click', () => this.save());

    this.buildBoardGrid();
    await this.loadOpenings();
  },

  buildBoardGrid() {
    this.els.grid.innerHTML = '';
    this.boards = [];
    for (let i = 0; i < NUM_BOARDS; i++) {
      const color = BOARD_COLORS[i];
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
      board.orientation = 'w';
      this.boards.push(board);

      panel.querySelector('[data-act="prev"]').addEventListener('click', () => { this.setActiveBoard(i); this.stepBoard(i, -1); });
      panel.querySelector('[data-act="next"]').addEventListener('click', (e) => { this.setActiveBoard(i); this.stepBoard(i, 1, e.currentTarget); });
      panel.querySelector('[data-act="reset"]').addEventListener('click', () => { this.setActiveBoard(i); this.setBoardPath(i, []); });
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

    const orientation = this.opening.color === 'black' ? 'b' : 'w';
    this.boards.forEach((b) => { b.orientation = orientation; });

    const saved = await DB.studyState.get(id);
    this.boardPaths = (saved && saved.boards) ? saved.boards.map((b) => b.path || []) : Array.from({ length: NUM_BOARDS }, () => []);
    while (this.boardPaths.length < NUM_BOARDS) this.boardPaths.push([]);
    this.annotations = (saved && saved.annotations) ? saved.annotations : {};
    this.activeBoardIdx = 0;
    this.dirty = false;
    this.updateSaveStatus();

    this.renderTreePane();
    for (let i = 0; i < NUM_BOARDS; i++) this.renderBoard(i);
    this.updateActiveIndicator();
  },

  renderTreePane() {
    this.nodeEls = renderTree(this.els.tree, this.opening.tree, {
      onSelect: (id) => this.jumpActiveBoardTo(id),
    });
    this.updateAllHighlights();
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
    for (let i = 0; i < NUM_BOARDS; i++) {
      const nodeId = this.currentNodeId(i);
      const el = this.nodeEls.get(nodeId);
      if (!el) continue;
      if (i === this.activeBoardIdx) el.classList.add('active-ply');
      const dot = document.createElement('span');
      dot.className = 'board-dot';
      dot.style.background = BOARD_COLORS[i];
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
      updatedAt: Date.now(),
    };
    await DB.studyState.put(record);
    this.dirty = false;
    this.updateSaveStatus();
    toast('Study saved');
  },
};
