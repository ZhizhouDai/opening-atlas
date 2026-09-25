// The repertoire move tree: a plain nested-object structure that is stored
// directly as part of an `openings` record in IndexedDB (see db.js). Every
// node keeps its own id (stable across edits/re-renders) so the Study page
// can key annotations and board positions off it.
//
// Node shape:
//   { id, ply, san, uci, fenBefore, fenAfter,
//     commentBefore, commentAfter, markColor, markGlyph,
//     heading, headingLevel, bold, boxed, children: [Node] }
// The root node represents the starting position and has ply 0, san null.
// heading/headingLevel/bold/boxed are presentation styling editable from
// either page's notation panel (right-click a move) — they live on the
// node itself, alongside comments and marks, so both pages always show the
// same thing without needing to sync anything separately.

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function makeRootNode() {
  return {
    id: 'root', ply: 0, san: null, uci: null,
    fenBefore: null, fenAfter: START_FEN,
    commentBefore: '', commentAfter: '',
    markColor: null, markGlyph: null,
    heading: '', headingLevel: 1, bold: false, boxed: false,
    children: [],
  };
}

function makeMoveNode(parent, applied, fenBefore, fenAfter) {
  return {
    id: uid(), ply: parent.ply + 1, san: applied.san,
    uci: applied.from + applied.to + (applied.promotion || ''),
    fenBefore, fenAfter,
    commentBefore: '', commentAfter: '',
    markColor: null, markGlyph: null,
    heading: '', headingLevel: 1, bold: false, boxed: false,
    children: [],
  };
}

// Applies a {heading, level, bold, boxed} result from modalPlyStyleEditor to
// a node, or resets all four fields to their defaults when `style` is null
// (the editor's "Clear" action).
function applyPlyStyle(node, style) {
  if (!style) {
    node.heading = ''; node.headingLevel = 1; node.bold = false; node.boxed = false;
    return;
  }
  node.heading = style.heading || '';
  node.headingLevel = style.level === 2 ? 2 : 1;
  node.bold = !!style.bold;
  node.boxed = !!style.boxed;
}

function findNode(root, id) {
  if (root.id === id) return root;
  for (const c of root.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

function findParent(root, id) {
  for (const c of root.children) {
    if (c.id === id) return root;
    const found = findParent(c, id);
    if (found) return found;
  }
  return null;
}

// Array of child-indices from root down to (and including) the given node.
function pathToNode(root, id) {
  if (root.id === id) return [];
  for (let i = 0; i < root.children.length; i++) {
    const sub = pathToNode(root.children[i], id);
    if (sub) return [i, ...sub];
  }
  return null;
}

function resolvePath(root, path) {
  let cur = root;
  for (const idx of path) {
    if (!cur.children[idx]) return cur; // path stale (node deleted) — stop at last valid position
    cur = cur.children[idx];
  }
  return cur;
}

function deleteNode(root, id) {
  if (id === 'root') return false;
  const parent = findParent(root, id);
  if (!parent) return false;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  parent.children.splice(idx, 1);
  return true;
}

// Adds a played move under `cursor`, reusing an existing child with the same
// SAN instead of creating a duplicate branch (used by both board play and
// PGN import/merge).
function addOrReuseChild(cursor, applied, fenBefore, fenAfter) {
  const existing = cursor.children.find((c) => c.san === applied.san);
  if (existing) return existing;
  const node = makeMoveNode(cursor, applied, fenBefore, fenAfter);
  cursor.children.push(node);
  return node;
}

function cloneTree(node) {
  if (window.structuredClone) return structuredClone(node);
  return JSON.parse(JSON.stringify(node));
}

// Total node count, for quick stats display.
function countNodes(node) {
  let n = 1;
  for (const c of node.children) n += countNodes(c);
  return n;
}

// Longest line length in plies, for a quick "deepest line" stat.
function maxDepth(node) {
  if (!node.children.length) return node.ply;
  return Math.max(...node.children.map(maxDepth));
}
