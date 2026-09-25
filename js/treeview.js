// Renders a repertoire move tree as a clickable, indented outline. There is
// no privileged "mainline": a single unbranched run of moves stays on one
// line (nothing to distinguish it from), but the moment a node has more
// than one child, every child — including what would elsewhere be called
// "the main move" — becomes its own equally-indented continuation. None of
// them stays inline while the others get demoted into parentheses. A move
// that carries a heading also always starts its own line, even if it isn't
// itself a branch point, since a named line deserves a visual break. Bold
// and boxed emphasis, by contrast, never force a line break — they're pure
// inline styling.
//
// Heading/bold/boxed live directly on the node (see chesstree.js), so this
// renderer is identical on the Create Repertoire and Study & Analysis pages
// — whichever page edits them, both show the same thing immediately.

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
//   onPlyContext(nodeId)                 — right-click a move to edit its heading/emphasis
//   collapsedComments: Set<key>          — optional, Study page only
//   onToggleComment(key)                 — click a comment to collapse/expand it
function renderTree(container, rootNode, opts = {}) {
  const onSelect = opts.onSelect;
  const onPlyContext = opts.onPlyContext;
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

  function appendHeading(parentEl, node) {
    if (!node.heading) return;
    const h = document.createElement('div');
    h.className = 'tree-heading level-' + (node.headingLevel === 2 ? 2 : 1);
    h.textContent = node.heading;
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
    if (node.bold) span.classList.add('ply-bold');
    if (node.boxed) span.classList.add('ply-boxed');
    if (onSelect) span.addEventListener('click', () => onSelect(node.id));
    if (onPlyContext) {
      span.classList.add('headable');
      span.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onPlyContext(node.id);
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
    appendHeading(wrap, child);
    const line = document.createElement('div');
    line.className = 'move-line';
    appendMoveToken(line, child, true);
    wrap.appendChild(line);
    walk(line, child);
    parentLineEl.appendChild(wrap);
  }

  function walk(lineEl, startNode) {
    let cur = startNode;
    while (cur.children && cur.children.length === 1 && !cur.children[0].heading) {
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

// A condensed, pruned-tree view of only the "key branching points" (nodes
// with a heading/subheading): shared moves leading up to a heading are
// shown exactly once and only actually split into indented branches where
// headed lines genuinely diverge — the same branching convention renderTree
// uses — and each heading's own run of moves collapses to a "⋯" followed by
// the position that line eventually reaches, so the moves in between don't
// have to be scanned past. Returns { nodeEls, commentKeys } with the same
// shape as renderTree (commentKeys is always empty here).
function renderBranchOutline(container, rootNode, opts = {}) {
  const onSelect = opts.onSelect;
  const onPlyContext = opts.onPlyContext;
  const nodeEls = new Map();
  container.innerHTML = '';

  const headingNodes = collectHeadingNodes(rootNode);
  if (!headingNodes.length) {
    const empty = document.createElement('p');
    empty.className = 'muted tree-empty';
    empty.textContent = 'No headings yet. Right-click a move in the full notation to label a key branching point.';
    container.appendChild(empty);
    return { nodeEls, commentKeys: [] };
  }

  // Every node that must survive pruning: each heading's full ancestor
  // chain (so shared prefixes and real branch points stay intact) plus the
  // position each heading's own line eventually reaches.
  const keepIds = new Set([rootNode.id]);
  headingNodes.forEach((h) => {
    const idxPath = pathToNode(rootNode, h.id) || [];
    let cur = rootNode;
    idxPath.forEach((idx) => { cur = cur.children[idx]; keepIds.add(cur.id); });
    keepIds.add(mainlineLeaf(h).id);
  });

  // The nearest kept descendants reachable from `origNode` along each
  // branch, skipping over (and flagging with gapBefore) anything pruned.
  function keptChildren(origNode) {
    const results = [];
    (function search(node, gapped) {
      node.children.forEach((child) => {
        if (keepIds.has(child.id)) results.push({ node: child, gapBefore: gapped });
        else search(child, true);
      });
    }(origNode, false));
    return results;
  }

  const rootLine = document.createElement('div');
  rootLine.className = 'move-line';
  container.appendChild(rootLine);
  walk(rootLine, rootNode);
  return { nodeEls, commentKeys: [] };

  function appendHeading(parentEl, node) {
    if (!node.heading) return;
    const h = document.createElement('div');
    h.className = 'tree-heading level-' + (node.headingLevel === 2 ? 2 : 1);
    h.textContent = node.heading;
    parentEl.appendChild(h);
  }

  function appendToken(lineEl, node, forceLabel, gapBefore) {
    if (gapBefore) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'branch-outline-ellipsis';
      ellipsis.textContent = '⋯';
      lineEl.appendChild(ellipsis);
    }
    if (node.ply % 2 === 1) {
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${(node.ply + 1) / 2}.`;
      lineEl.appendChild(num);
    } else if (forceLabel || gapBefore) {
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
    if (node.bold) span.classList.add('ply-bold');
    if (node.boxed) span.classList.add('ply-boxed');
    if (onSelect) span.addEventListener('click', () => onSelect(node.id));
    if (onPlyContext) {
      span.classList.add('headable');
      span.addEventListener('contextmenu', (e) => { e.preventDefault(); onPlyContext(node.id); });
    }
    lineEl.appendChild(span);
    nodeEls.set(node.id, span);
  }

  // Appends `entry` (a {node, gapBefore} kept-child) as the start of its own
  // indented line, then keeps walking its own kept descendants.
  function startNewLine(parentLineEl, entry) {
    const wrap = document.createElement('div');
    wrap.className = 'continuation';
    appendHeading(wrap, entry.node);
    const line = document.createElement('div');
    line.className = 'move-line';
    appendToken(line, entry.node, true, entry.gapBefore);
    wrap.appendChild(line);
    walk(line, entry.node);
    parentLineEl.appendChild(wrap);
  }

  function walk(lineEl, startNode) {
    let cur = startNode;
    let kids = keptChildren(cur);
    // A single kept child with no heading of its own is just the next
    // reference point on an unbranched line — stays inline.
    while (kids.length === 1 && !kids[0].node.heading) {
      appendToken(lineEl, kids[0].node, false, kids[0].gapBefore);
      cur = kids[0].node;
      kids = keptChildren(cur);
    }
    if (!kids.length) return;
    if (kids.length === 1) {
      startNewLine(lineEl, kids[0]);
      return;
    }
    kids.forEach((entry) => startNewLine(lineEl, entry));
  }
}
