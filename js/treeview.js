// Renders a repertoire move tree as a clickable, indented outline. There is
// no privileged "mainline": a single unbranched run of moves stays on one
// line (nothing to distinguish it from), but the moment a node has more
// than one child, every child — including what would elsewhere be called
// "the main move" — becomes its own equally-indented continuation. None of
// them stays inline while the others get demoted into parentheses. A move
// that carries a heading also always starts its own line, even if it isn't
// itself a branch point, since a named line deserves a visual break.

const MARK_GLYPHS = ['', '!', '!!', '!?', '?!', '?', '??'];
const MARK_COLORS = ['none', 'green', 'red', 'blue', 'yellow', 'orange', 'purple'];

// Builds the DOM for `rootNode` into `container`. Returns
// { nodeEls, commentKeys }: nodeEls maps nodeId -> the <span class="ply">
// element (so callers can cheaply update selection/highlight classes
// without a full rebuild), commentKeys lists every comment's collapse key
// currently present in the tree.
//
// opts:
//   onSelect(nodeId)                     — click a move
//   headings: { [nodeId]: {text,level} } — optional, Study page only
//   onHeadingContext(nodeId)             — right-click a move to edit its heading
//   collapsedComments: Set<key>          — optional, Study page only
//   onToggleComment(key)                 — click a comment to collapse/expand it
function renderTree(container, rootNode, opts = {}) {
  const onSelect = opts.onSelect;
  const headings = opts.headings || {};
  const onHeadingContext = opts.onHeadingContext;
  const collapsedComments = opts.collapsedComments;
  const onToggleComment = opts.onToggleComment;
  const nodeEls = new Map();
  const commentKeys = [];
  container.innerHTML = '';

  if (rootNode.commentAfter) {
    appendComment(container, 'root:after', rootNode.commentAfter, true);
  }

  if (!rootNode.children.length) {
    const empty = document.createElement('p');
    empty.className = 'muted tree-empty';
    empty.textContent = 'No moves yet. Play a move on the board, or import a PGN.';
    container.appendChild(empty);
    return { nodeEls, commentKeys };
  }

  const rootLine = document.createElement('div');
  rootLine.className = 'move-line';
  container.appendChild(rootLine);
  walk(rootLine, rootNode);
  return { nodeEls, commentKeys };

  function appendComment(parentEl, key, text, isIntro) {
    commentKeys.push(key);
    const c = document.createElement(isIntro ? 'div' : 'span');
    c.className = 'tree-comment' + (isIntro ? ' tree-intro' : '');
    const collapsed = collapsedComments && collapsedComments.has(key);
    if (collapsed) {
      c.classList.add('collapsed');
      c.textContent = '💬';
      c.title = text;
    } else {
      c.textContent = text;
    }
    if (onToggleComment) {
      c.classList.add('toggleable');
      c.title = collapsed ? text : 'Click to collapse';
      c.addEventListener('click', (e) => { e.stopPropagation(); onToggleComment(key); });
    }
    parentEl.appendChild(c);
  }

  function appendHeading(parentEl, nodeId) {
    const heading = headings[nodeId];
    if (!heading || !heading.text) return;
    const h = document.createElement('div');
    h.className = 'tree-heading level-' + (heading.level === 2 ? 2 : 1);
    h.textContent = heading.text;
    parentEl.appendChild(h);
  }

  function appendMoveToken(lineEl, node, forceLabel) {
    if (node.commentBefore) appendComment(lineEl, node.id + ':before', node.commentBefore);
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
    if (onHeadingContext) {
      span.classList.add('headable');
      span.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onHeadingContext(node.id);
      });
    }
    lineEl.appendChild(span);
    nodeEls.set(node.id, span);

    if (node.commentAfter) appendComment(lineEl, node.id + ':after', node.commentAfter);
  }

  // Appends `child` as the start of its own indented line (with its
  // heading, if any, above it), then keeps walking its own descendants.
  function startNewLine(parentLineEl, child) {
    const wrap = document.createElement('div');
    wrap.className = 'continuation';
    appendHeading(wrap, child.id);
    const line = document.createElement('div');
    line.className = 'move-line';
    appendMoveToken(line, child, true);
    wrap.appendChild(line);
    walk(line, child);
    parentLineEl.appendChild(wrap);
  }

  function walk(lineEl, startNode) {
    let cur = startNode;
    while (cur.children && cur.children.length === 1 && !headings[cur.children[0].id]) {
      appendMoveToken(lineEl, cur.children[0], false);
      cur = cur.children[0];
    }
    if (!cur.children || !cur.children.length) return;
    if (cur.children.length === 1) {
      startNewLine(lineEl, cur.children[0]);
      return;
    }
    cur.children.forEach((child) => startNewLine(lineEl, child));
  }
}
