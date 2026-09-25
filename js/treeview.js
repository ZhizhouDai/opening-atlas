// Renders a repertoire move tree as a clickable, indented outline. There is
// no privileged "mainline": a single unbranched run of moves stays on one
// line (nothing to distinguish it from), but the moment a node has more
// than one child, every child — including what would elsewhere be called
// "the main move" — becomes its own equally-indented continuation. None of
// them stays inline while the others get demoted into parentheses.

const MARK_GLYPHS = ['', '!', '!!', '!?', '?!', '?', '??'];
const MARK_COLORS = ['none', 'green', 'red', 'blue', 'yellow', 'orange', 'purple'];

// Builds the DOM for `rootNode` into `container`. Returns a Map of
// nodeId -> the <span class="ply"> element, so callers can cheaply update
// selection/highlight classes without a full rebuild.
function renderTree(container, rootNode, opts = {}) {
  const onSelect = opts.onSelect;
  const nodeEls = new Map();
  container.innerHTML = '';

  if (rootNode.commentAfter) {
    const intro = document.createElement('div');
    intro.className = 'tree-comment tree-intro';
    intro.textContent = rootNode.commentAfter;
    container.appendChild(intro);
  }

  if (!rootNode.children.length) {
    const empty = document.createElement('p');
    empty.className = 'muted tree-empty';
    empty.textContent = 'No moves yet. Play a move on the board, or import a PGN.';
    container.appendChild(empty);
    return nodeEls;
  }

  const rootLine = document.createElement('div');
  rootLine.className = 'move-line';
  container.appendChild(rootLine);
  walk(rootLine, rootNode);
  return nodeEls;

  function appendMoveToken(lineEl, node, forceLabel) {
    if (node.commentBefore) {
      const c = document.createElement('span');
      c.className = 'tree-comment';
      c.textContent = node.commentBefore;
      lineEl.appendChild(c);
    }
    if (node.ply % 2 === 1) {
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${(node.ply + 1) / 2}.`;
      lineEl.appendChild(num);
    } else if (forceLabel) {
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${node.ply / 2}...`;
      lineEl.appendChild(num);
    }
    const span = document.createElement('span');
    span.className = 'ply';
    span.dataset.nodeId = node.id;
    const sanText = document.createElement('span');
    sanText.className = 'ply-san';
    sanText.textContent = node.san + (node.markGlyph || '');
    span.appendChild(sanText);
    const dots = document.createElement('span');
    dots.className = 'ply-dots';
    span.appendChild(dots);
    if (node.markColor && node.markColor !== 'none') span.classList.add('mark-' + node.markColor);
    if (node.markGlyph) span.classList.add('has-glyph');
    if (onSelect) span.addEventListener('click', () => onSelect(node.id));
    lineEl.appendChild(span);
    nodeEls.set(node.id, span);

    if (node.commentAfter) {
      const c = document.createElement('span');
      c.className = 'tree-comment';
      c.textContent = node.commentAfter;
      lineEl.appendChild(c);
    }
  }

  function walk(lineEl, startNode) {
    let cur = startNode;
    // A single child is simply the next move in an unbranched line — no
    // choice is being made, so it continues on the same line.
    while (cur.children && cur.children.length === 1) {
      appendMoveToken(lineEl, cur.children[0], false);
      cur = cur.children[0];
    }
    if (!cur.children || cur.children.length < 2) return;
    // Two or more children: every one of them is an equal continuation from
    // here, each gets its own indented line.
    cur.children.forEach((child) => {
      const contWrap = document.createElement('div');
      contWrap.className = 'continuation';
      const contLine = document.createElement('div');
      contLine.className = 'move-line';
      appendMoveToken(contLine, child, true);
      contWrap.appendChild(contLine);
      walk(contLine, child);
      lineEl.appendChild(contWrap);
    });
  }
}
