// Click-to-move chess board with optional right-click annotation drawing
// (arrows + circles), used by both the repertoire editor and the study page.

const PIECE_SRC = {
  wp: 'lib/pieces/wP.svg', wn: 'lib/pieces/wN.svg', wb: 'lib/pieces/wB.svg',
  wr: 'lib/pieces/wR.svg', wq: 'lib/pieces/wQ.svg', wk: 'lib/pieces/wK.svg',
  bp: 'lib/pieces/bP.svg', bn: 'lib/pieces/bN.svg', bb: 'lib/pieces/bB.svg',
  br: 'lib/pieces/bR.svg', bq: 'lib/pieces/bQ.svg', bk: 'lib/pieces/bK.svg',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const ANNOTATION_COLORS = {
  green: '#4caf6e', red: '#e0605a', blue: '#5a9be0',
  yellow: '#e0c95a', orange: '#e08a3d', purple: '#a06ae0',
};

class Board {
  constructor(container, opts = {}) {
    this.container = container;
    this.onMove = opts.onMove;
    this.onPositionChange = opts.onPositionChange;
    this.interactive = opts.interactive !== false;
    this.annotatable = !!opts.annotatable;
    this.onAnnotate = opts.onAnnotate;
    this.onSelect = opts.onSelect; // click anywhere on the board (used to make it the "active" study board)
    this.orientation = 'w';
    this.chess = new Chess();
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = null; // {from,to}
    this.customArrows = []; // [{from,to,color}]
    this.customCircles = []; // [{square,color}]
    this.drawColor = opts.drawColor || 'green';
    this._drag = null; // in-progress right-click drag: {from}
    this.squares = {};
    this._buildDom();
  }

  _buildDom() {
    this.container.innerHTML = '';
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.container.appendChild(this.el);
    if (this.annotatable) {
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setPosition(fen, orientation) {
    this.chess = new Chess(fen);
    if (orientation) this.orientation = orientation;
    this.selected = null;
    this.legalTargets = [];
    this._render({ animate: false });
  }

  setLastMove(from, to) {
    this.lastMove = from && to ? { from, to } : null;
    this._render({ animate: false });
  }

  setAnnotations(arrows, circles) {
    this.customArrows = arrows || [];
    this.customCircles = circles || [];
    this._render({ animate: false });
  }

  setDrawColor(color) {
    this.drawColor = color;
  }

  flip() {
    this.orientation = this.orientation === 'w' ? 'b' : 'w';
    this._render({ animate: false });
  }

  applyUci(uci) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const applied = this.chess.move({ from, to, promotion });
    if (applied) {
      this.selected = null;
      this.legalTargets = [];
      this.lastMove = { from, to };
      this._render({ animate: true });
    }
    return applied;
  }

  _squareOrder() {
    const ranks = this.orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = this.orientation === 'w' ? FILES : [...FILES].reverse();
    const order = [];
    for (const r of ranks) for (const f of files) order.push(`${f}${r}`);
    return order;
  }

  _render(opts) {
    const animate = !!(opts && opts.animate) && this.lastMove;

    this.el.innerHTML = '';
    this.squares = {};
    const board = this.chess.board();
    const pieceAt = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell) pieceAt[`${FILES[f]}${8 - r}`] = cell.color + cell.type;
      }
    }

    const lastMoveSquares = new Set();
    if (this.lastMove) { lastMoveSquares.add(this.lastMove.from); lastMoveSquares.add(this.lastMove.to); }

    const order = this._squareOrder();
    order.forEach((sq, idx) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10);
      const isLight = (file + rank) % 2 === 0;
      const div = document.createElement('div');
      div.className = 'square ' + (isLight ? 'light' : 'dark');
      div.dataset.square = sq;

      if (lastMoveSquares.has(sq)) div.classList.add('last-move');
      if (this.selected === sq) div.classList.add('selected');
      if (this.legalTargets.includes(sq)) div.classList.add('legal-target');

      const piece = pieceAt[sq];
      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece';
        img.draggable = false;
        img.alt = '';
        img.src = PIECE_SRC[piece];
        div.appendChild(img);
      }

      const isBottomRow = idx >= 56;
      const isLeftCol = idx % 8 === 0;
      if (isBottomRow) {
        const lbl = document.createElement('span');
        lbl.className = 'coord coord-file';
        lbl.textContent = sq[0];
        div.appendChild(lbl);
      }
      if (isLeftCol) {
        const lbl = document.createElement('span');
        lbl.className = 'coord coord-rank';
        lbl.textContent = sq[1];
        div.appendChild(lbl);
      }

      if (this.interactive) {
        div.addEventListener('click', () => this._handleClick(sq));
      }
      if (this.onSelect) {
        div.addEventListener('mousedown', (e) => { if (e.button === 0) this.onSelect(); });
      }
      if (this.annotatable) {
        div.addEventListener('mousedown', (e) => this._annoStart(e, sq));
        div.addEventListener('mouseup', (e) => this._annoEnd(e, sq));
      }
      this.squares[sq] = div;
      this.el.appendChild(div);
    });

    this._renderOverlay();

    if (animate) this._animatePieceSlide(this.lastMove.from, this.lastMove.to);

    const currentFen = this.chess.fen();
    if (this.onPositionChange && currentFen !== this._lastReportedFen) {
      this._lastReportedFen = currentFen;
      this.onPositionChange(currentFen);
    }
  }

  _animatePieceSlide(fromSquare, toSquare) {
    const fromDiv = this.squares[fromSquare];
    const toDiv = this.squares[toSquare];
    const img = toDiv && toDiv.querySelector('img.piece');
    if (!img || !fromDiv) return;
    const fromRect = fromDiv.getBoundingClientRect();
    const toRect = toDiv.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    if (!dx && !dy) return;
    img.style.transition = 'none';
    img.style.transform = `translate(${dx}px, ${dy}px)`;
    void img.getBoundingClientRect();
    requestAnimationFrame(() => {
      img.style.transition = 'transform 0.2s ease';
      img.style.transform = '';
    });
  }

  _squareCenterPercent(sq) {
    const fileIdx = FILES.indexOf(sq[0]);
    const rank = parseInt(sq[1], 10);
    let col, row;
    if (this.orientation === 'w') { col = fileIdx; row = 8 - rank; }
    else { col = 7 - fileIdx; row = rank - 1; }
    return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
  }

  _renderOverlay() {
    if (!this.customArrows.length && !this.customCircles.length) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'board-arrow-layer');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');

    this.customCircles.forEach(({ square, color }) => {
      const c = this._squareCenterPercent(square);
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', 5.7);
      circle.setAttribute('class', 'board-circle');
      circle.setAttribute('stroke', ANNOTATION_COLORS[color] || color);
      svg.appendChild(circle);
    });

    this.customArrows.forEach(({ from, to, color }) => {
      if (from === to) return;
      const shapes = this._arrowShapes(from, to);
      if (!shapes) return;
      const hex = ANNOTATION_COLORS[color] || color;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', shapes.x1); line.setAttribute('y1', shapes.y1);
      line.setAttribute('x2', shapes.x2); line.setAttribute('y2', shapes.y2);
      line.setAttribute('class', 'board-arrow-line');
      line.setAttribute('stroke', hex);
      svg.appendChild(line);
      const head = document.createElementNS(svgNS, 'polygon');
      head.setAttribute('points', shapes.headPoints);
      head.setAttribute('class', 'board-arrow-head');
      head.setAttribute('fill', hex);
      svg.appendChild(head);
    });

    this.el.appendChild(svg);
  }

  _arrowShapes(from, to) {
    const a = this._squareCenterPercent(from);
    const b = this._squareCenterPercent(to);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (!len) return null;
    const ux = dx / len, uy = dy / len;
    const headLen = Math.min(4.4, len * 0.4);
    const headWidth = Math.min(2.8, len * 0.25);
    const tipX = b.x - ux * 1.2, tipY = b.y - uy * 1.2;
    const baseX = tipX - ux * headLen, baseY = tipY - uy * headLen;
    const leftX = baseX - uy * headWidth, leftY = baseY + ux * headWidth;
    const rightX = baseX + uy * headWidth, rightY = baseY - ux * headWidth;
    return { x1: a.x, y1: a.y, x2: baseX, y2: baseY, headPoints: `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}` };
  }

  // --- move interaction ---

  _handleClick(sq) {
    const piece = this.chess.get(sq);
    if (this.selected) {
      if (this.legalTargets.includes(sq)) { this._attemptMove(this.selected, sq); return; }
      if (piece && piece.color === this.chess.turn()) { this._select(sq); return; }
      this.selected = null; this.legalTargets = []; this._render();
      return;
    }
    if (piece && piece.color === this.chess.turn()) this._select(sq);
  }

  _select(sq) {
    this.selected = sq;
    const moves = this.chess.moves({ square: sq, verbose: true });
    this.legalTargets = moves.map((m) => m.to);
    this._render();
  }

  _attemptMove(from, to) {
    const moves = this.chess.moves({ square: from, verbose: true });
    const match = moves.find((m) => m.to === to);
    let promotion;
    if (match && match.flags.includes('p')) promotion = 'q';
    const uci = from + to + (promotion || '');
    this.selected = null; this.legalTargets = [];
    this._render();
    if (this.onMove) this.onMove({ from, to, promotion, uci });
  }

  // --- annotation drawing (right mouse button) ---

  _annoStart(e, sq) {
    if (e.button !== 2) return;
    e.preventDefault();
    this._drag = { from: sq };
  }

  _annoEnd(e, sq) {
    if (e.button !== 2 || !this._drag) return;
    e.preventDefault();
    const from = this._drag.from;
    this._drag = null;
    if (from === sq) {
      const idx = this.customCircles.findIndex((c) => c.square === sq && c.color === this.drawColor);
      if (idx >= 0) this.customCircles.splice(idx, 1);
      else this.customCircles.push({ square: sq, color: this.drawColor });
    } else {
      const idx = this.customArrows.findIndex((a) => a.from === from && a.to === sq && a.color === this.drawColor);
      if (idx >= 0) this.customArrows.splice(idx, 1);
      else this.customArrows.push({ from, to: sq, color: this.drawColor });
    }
    this._render();
    if (this.onAnnotate) this.onAnnotate({ arrows: this.customArrows, circles: this.customCircles });
  }

  clearAnnotations() {
    this.customArrows = [];
    this.customCircles = [];
    this._render();
    if (this.onAnnotate) this.onAnnotate({ arrows: this.customArrows, circles: this.customCircles });
  }
}
