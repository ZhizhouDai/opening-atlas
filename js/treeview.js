// Renders a repertoire move tree as a clickable, indented outline: the
// mainline runs inline, and every branch point opens a new indented line so
// it's immediately visible where a line starts to diverge.

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
  walk(rootLine, rootNode, true);
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

  function walk(lineEl, startNode, forceLabelForFirst) {
    let cur = startNode;
    let first = true;
    while (cur.children && cur.children.length) {
      const main = cur.children[0];
      appendMoveToken(lineEl, main, first && forceLabelForFirst);
      first = false;
      for (let i = 1; i < cur.children.length; i++) {
        const alt = cur.children[i];
        const varWrap = document.createElement('div');
        varWrap.className = 'variation';
        const varLine = document.createElement('div');
        varLine.className = 'move-line';
        appendMoveToken(varLine, alt, true);
        varWrap.appendChild(varLine);
        walk(varLine, alt, false);
        lineEl.appendChild(varWrap);
      }
      cur = main;
    }
  }
}
