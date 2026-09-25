// "Create Repertoire" page controller.

const Repertoire = {
  color: 'white',
  openings: [],
  opening: null,
  cursorId: 'root',
  board: null,
  nodeEls: new Map(),

  async init() {
    this.els = {
      colorTabs: document.getElementById('repColorTabs'),
      list: document.getElementById('repOpeningList'),
      btnNew: document.getElementById('btnNewOpening'),
      empty: document.getElementById('repEmptyState'),
      workspace: document.getElementById('repWorkspace'),
      openingName: document.getElementById('repOpeningName'),
      btnRename: document.getElementById('btnRenameOpening'),
      btnDeleteOpening: document.getElementById('btnDeleteOpening'),
      boardMount: document.getElementById('repBoard'),
      btnFlip: document.getElementById('btnFlipRepBoard'),
      btnDeleteMove: document.getElementById('btnDeleteMove'),
      btnGoRoot: document.getElementById('btnGoRoot'),
      tree: document.getElementById('repTree'),
      commentBeforeRow: document.getElementById('commentBeforeRow'),
      commentBefore: document.getElementById('commentBeforeInput'),
      commentAfter: document.getElementById('commentAfterInput'),
      commentAfterLabel: document.getElementById('commentAfterLabel'),
      markPanel: document.getElementById('markPanel'),
      markColors: document.getElementById('markColors'),
      markGlyphs: document.getElementById('markGlyphs'),
      selectedMoveLabel: document.getElementById('selectedMoveLabel'),
      pgnFile: document.getElementById('repPgnFile'),
      pgnText: document.getElementById('repPgnText'),
      btnImportPgn: document.getElementById('btnImportRepPgn'),
      pgnStatus: document.getElementById('repPgnStatus'),
      btnCopyPgn: document.getElementById('btnCopyPgn'),
      btnDownloadPgn: document.getElementById('btnDownloadPgn'),
      btnExportAllPgn: document.getElementById('btnExportAllPgn'),
      treeStats: document.getElementById('repTreeStats'),
    };

    this.board = new Board(this.els.boardMount, {
      interactive: true,
      onMove: (m) => this.onBoardMove(m),
    });

    this.els.colorTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      this.setColor(btn.dataset.color);
    });
    this.els.btnNew.addEventListener('click', () => this.createOpening());
    this.els.btnRename.addEventListener('click', () => this.renameOpening());
    this.els.btnDeleteOpening.addEventListener('click', () => this.deleteOpening());
    this.els.btnFlip.addEventListener('click', () => this.board.flip());
    this.els.btnDeleteMove.addEventListener('click', () => this.deleteCurrentMove());
    this.els.btnGoRoot.addEventListener('click', () => this.selectNode('root'));
    this.els.commentBefore.addEventListener('change', () => this.saveComments());
    this.els.commentAfter.addEventListener('change', () => this.saveComments());
    this.els.markColors.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (btn) this.setMarkColor(btn.dataset.color);
    });
    this.els.markGlyphs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-glyph]');
      if (btn) this.setMarkGlyph(btn.dataset.glyph);
    });
    this.els.btnImportPgn.addEventListener('click', () => this.importPgn());
    this.els.btnCopyPgn.addEventListener('click', () => this.copyPgn());
    this.els.btnDownloadPgn.addEventListener('click', () => this.downloadPgn());
    this.els.btnExportAllPgn.addEventListener('click', () => this.exportAllPgn());

    this.buildMarkPickers();
    await this.loadOpenings();
  },

  buildMarkPickers() {
    this.els.markColors.innerHTML = MARK_COLORS.map((c) => (
      `<button type="button" data-color="${c}" class="swatch swatch-${c}" title="${c}"></button>`
    )).join('');
    this.els.markGlyphs.innerHTML = MARK_GLYPHS.map((g) => (
      `<button type="button" data-glyph="${g}" class="glyph-btn">${g || '—'}</button>`
    )).join('');
  },

  setColor(color) {
    this.color = color;
    this.opening = null;
    [...this.els.colorTabs.children].forEach((b) => b.classList.toggle('active', b.dataset.color === color));
    this.renderOpeningList();
    this.showEmptyState();
  },

  async loadOpenings() {
    this.openings = await DB.openings.getAll();
    this.setColor('white');
  },

  renderOpeningList() {
    const list = this.openings.filter((o) => o.color === this.color)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.els.list.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'muted opening-list-empty';
      li.textContent = 'No openings yet.';
      this.els.list.appendChild(li);
      return;
    }
    list.forEach((o) => {
      const li = document.createElement('li');
      li.className = 'opening-item' + (this.opening && this.opening.id === o.id ? ' active' : '');
      li.dataset.id = o.id;
      const n = countNodes(o.tree) - 1;
      li.innerHTML = `<span class="opening-item-name">${escapeHtml(o.name)}</span><span class="opening-item-count muted">${n} move${n === 1 ? '' : 's'}</span>`;
      li.addEventListener('click', () => this.selectOpening(o.id));
      this.els.list.appendChild(li);
    });
  },

  showEmptyState() {
    this.els.empty.hidden = !!this.opening;
    this.els.workspace.hidden = !this.opening;
  },

  async createOpening() {
    const name = await modalPrompt(`Name this ${this.color} opening (e.g. "Scotch Game", "Najdorf Sicilian"):`);
    if (!name || !name.trim()) return;
    const opening = {
      id: uid(), color: this.color, name: name.trim(),
      createdAt: Date.now(), updatedAt: Date.now(),
      tree: makeRootNode(),
    };
    await DB.openings.put(opening);
    this.openings.push(opening);
    this.renderOpeningList();
    this.selectOpening(opening.id);
    toast(`Created "${opening.name}"`);
  },

  async renameOpening() {
    if (!this.opening) return;
    const name = await modalPrompt('Rename opening:', this.opening.name);
    if (!name || !name.trim()) return;
    this.opening.name = name.trim();
    await this.persist();
    this.renderOpeningList();
    this.els.openingName.textContent = this.opening.name;
  },

  async deleteOpening() {
    if (!this.opening) return;
    const ok = await modalConfirm(`Delete "${this.opening.name}" and all its moves? This cannot be undone.`, { danger: true, okLabel: 'Delete' });
    if (!ok) return;
    const id = this.opening.id;
    await DB.openings.delete(id);
    await DB.studyState.delete(id).catch(() => {});
    this.openings = this.openings.filter((o) => o.id !== id);
    this.opening = null;
    this.renderOpeningList();
    this.showEmptyState();
    toast('Opening deleted');
  },

  selectOpening(id) {
    this.opening = this.openings.find((o) => o.id === id);
    if (!this.opening) return;
    this.cursorId = 'root';
    this.board.orientation = this.opening.color === 'black' ? 'b' : 'w';
    this.renderOpeningList();
    this.showEmptyState();
    this.els.openingName.textContent = this.opening.name;
    this.renderAll();
  },

  renderAll() {
    this.renderTreePane();
    this.selectNode(this.cursorId);
    const n = countNodes(this.opening.tree) - 1;
    const depth = Math.ceil(maxDepth(this.opening.tree) / 2);
    this.els.treeStats.textContent = `${n} move${n === 1 ? '' : 's'} · longest line ${depth} move${depth === 1 ? '' : 's'}`;
  },

  renderTreePane() {
    this.nodeEls = renderTree(this.els.tree, this.opening.tree, {
      onSelect: (id) => this.selectNode(id),
    }).nodeEls;
    this.highlightCursor();
  },

  highlightCursor() {
    this.nodeEls.forEach((el) => el.classList.remove('selected-ply'));
    const el = this.nodeEls.get(this.cursorId);
    if (el) { el.classList.add('selected-ply'); el.scrollIntoView({ block: 'nearest' }); }
  },

  selectNode(id) {
    const node = findNode(this.opening.tree, id);
    if (!node) { this.cursorId = 'root'; return this.selectNode('root'); }
    this.cursorId = id;
    this.board.setPosition(node.fenAfter, this.board.orientation);
    this.board.setLastMove(node.uci ? node.uci.slice(0, 2) : null, node.uci ? node.uci.slice(2, 4) : null);
    this.highlightCursor();

    const isRoot = id === 'root';
    this.els.commentBeforeRow.hidden = isRoot;
    this.els.commentAfterLabel.textContent = isRoot ? 'Opening notes' : 'Comment after this move';
    this.els.commentBefore.value = node.commentBefore || '';
    this.els.commentAfter.value = node.commentAfter || '';
    this.els.markPanel.hidden = isRoot;
    this.els.selectedMoveLabel.textContent = isRoot ? 'Starting position' : this.moveLabelFor(node);
    this.els.btnDeleteMove.disabled = isRoot;

    [...this.els.markColors.children].forEach((b) => b.classList.toggle('active', (node.markColor || 'none') === b.dataset.color));
    [...this.els.markGlyphs.children].forEach((b) => b.classList.toggle('active', (node.markGlyph || '') === b.dataset.glyph));
  },

  moveLabelFor(node) {
    const label = node.ply % 2 === 1 ? `${(node.ply + 1) / 2}.` : `${node.ply / 2}...`;
    return `${label} ${node.san}`;
  },

  onBoardMove({ from, to, promotion, uci }) {
    const cursor = findNode(this.opening.tree, this.cursorId);
    const chess = new Chess(cursor.fenAfter);
    const applied = chess.move({ from, to, promotion });
    if (!applied) return;
    const node = addOrReuseChild(cursor, applied, cursor.fenAfter, chess.fen());
    this.cursorId = node.id;
    this.board.applyUci(uci);
    this.persist();
    this.renderTreePane();
    const n = countNodes(this.opening.tree) - 1;
    const depth = Math.ceil(maxDepth(this.opening.tree) / 2);
    this.els.treeStats.textContent = `${n} move${n === 1 ? '' : 's'} · longest line ${depth} move${depth === 1 ? '' : 's'}`;
    this.selectNode(this.cursorId);
  },

  async deleteCurrentMove() {
    if (this.cursorId === 'root') return;
    const node = findNode(this.opening.tree, this.cursorId);
    const parent = findParent(this.opening.tree, this.cursorId);
    const ok = await modalConfirm(`Delete ${this.moveLabelFor(node)} and everything after it?`, { danger: true, okLabel: 'Delete' });
    if (!ok) return;
    deleteNode(this.opening.tree, this.cursorId);
    this.cursorId = parent.id;
    this.persist();
    this.renderAll();
  },

  saveComments() {
    if (!this.opening) return;
    const node = findNode(this.opening.tree, this.cursorId);
    if (!node) return;
    node.commentBefore = this.els.commentBefore.value.trim();
    node.commentAfter = this.els.commentAfter.value.trim();
    this.persist();
    this.renderTreePane();
  },

  setMarkColor(color) {
    if (this.cursorId === 'root') return;
    const node = findNode(this.opening.tree, this.cursorId);
    node.markColor = node.markColor === color ? null : (color === 'none' ? null : color);
    this.persist();
    this.renderTreePane();
    this.selectNode(this.cursorId);
  },

  setMarkGlyph(glyph) {
    if (this.cursorId === 'root') return;
    const node = findNode(this.opening.tree, this.cursorId);
    node.markGlyph = node.markGlyph === glyph ? '' : glyph;
    this.persist();
    this.renderTreePane();
    this.selectNode(this.cursorId);
  },

  importPgn() {
    const file = this.els.pgnFile.files[0];
    const text = this.els.pgnText.value;
    const run = (pgnText) => {
      if (!pgnText || !pgnText.trim()) { this.els.pgnStatus.textContent = 'Paste PGN text or choose a file first.'; return; }
      const cursor = findNode(this.opening.tree, this.cursorId);
      const { imported, skipped } = importPgnIntoTree(cursor, pgnText);
      this.persist();
      this.renderAll();
      this.els.pgnStatus.textContent = `Imported ${imported} move${imported === 1 ? '' : 's'}` + (skipped ? ` (${skipped} token${skipped === 1 ? '' : 's'} skipped)` : '') + '.';
      this.els.pgnText.value = '';
      this.els.pgnFile.value = '';
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => run(reader.result);
      reader.readAsText(file);
    } else {
      run(text);
    }
  },

  copyPgn() {
    if (!this.opening) return;
    const pgn = exportOpeningAsPgn(this.opening);
    navigator.clipboard.writeText(pgn).then(() => toast('PGN copied to clipboard')).catch(() => toast('Could not copy — see console'));
  },

  downloadPgn() {
    if (!this.opening) return;
    const pgn = exportOpeningAsPgn(this.opening);
    downloadTextFile(`${slugifyFilename(this.opening.name)}.pgn`, pgn);
    toast('PGN downloaded');
  },

  exportAllPgn() {
    const list = this.openings.filter((o) => o.color === this.color);
    if (!list.length) { toast(`No ${this.color} openings to export yet`); return; }
    const pgn = exportOpeningsAsPgn(list);
    downloadTextFile(`opening-atlas-${this.color}.pgn`, pgn);
    toast(`Downloaded ${list.length} opening${list.length === 1 ? '' : 's'}`);
  },

  async persist() {
    this.opening.updatedAt = Date.now();
    await DB.openings.put(this.opening);
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
