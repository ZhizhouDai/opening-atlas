// PGN import (with recursive variations, comments and NAGs) and export.
// Uses chess.js 0.13.x (snake_case API: .move(), .fen(), etc.)

const NAG_TO_GLYPH = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };
const GLYPH_TO_NAG = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };

const TOKEN_RE = /\{[^}]*\}|\(|\)|\$\d+|\d+\.(\.\.)?|1-0|0-1|1\/2-1\/2|\*|O-O-O[+#]?|O-O[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?/g;

function tokenizePgnMoves(text) {
  return text.match(TOKEN_RE) || [];
}

function stripHeaders(pgn) {
  return pgn.replace(/^\s*\[[^\]]*\]\s*$/gm, '').trim();
}

// Parses PGN move text (with variations) and merges it into `rootNode`,
// starting from `rootNode`'s own position. Returns { imported, skipped }.
function importPgnIntoTree(rootNode, pgnText) {
  const moveText = stripHeaders(pgnText);
  const tokens = tokenizePgnMoves(moveText);
  let idx = 0;
  let imported = 0;
  let skipped = 0;

  function parseSequence(startNode, startFen) {
    let current = startNode;
    let chess = new Chess(startFen);
    let lastMoveNode = null;
    let lastParentNode = null;
    let lastParentFen = startFen;

    while (idx < tokens.length) {
      const tok = tokens[idx];

      if (tok === ')') { idx++; return; }

      if (tok === '(') {
        idx++;
        if (lastMoveNode) parseSequence(lastParentNode, lastParentFen);
        continue;
      }

      if (tok.startsWith('{')) {
        const text = tok.slice(1, -1).trim();
        if (text) {
          if (lastMoveNode) {
            lastMoveNode.commentAfter = lastMoveNode.commentAfter
              ? lastMoveNode.commentAfter + ' ' + text : text;
          } else {
            current.commentAfter = current.commentAfter
              ? current.commentAfter + ' ' + text : text;
          }
        }
        idx++; continue;
      }

      if (/^\$\d+$/.test(tok)) {
        const glyph = NAG_TO_GLYPH[tok.slice(1)];
        if (glyph && lastMoveNode) lastMoveNode.markGlyph = glyph;
        idx++; continue;
      }

      if (/^\d+\.(\.\.)?$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) {
        idx++; continue;
      }

      // Otherwise it's a SAN move token.
      const beforeFen = chess.fen();
      let applied;
      try { applied = chess.move(tok, { sloppy: true }); } catch (e) { applied = null; }
      if (!applied) { skipped++; idx++; continue; }

      const node = addOrReuseChild(current, applied, beforeFen, chess.fen());
      imported++;
      lastParentNode = current;
      lastParentFen = beforeFen;
      current = node;
      lastMoveNode = node;
      idx++;
    }
  }

  parseSequence(rootNode, rootNode.fenAfter);
  return { imported, skipped };
}

// Exports the mainline + all variations of a subtree as PGN move text.
function exportPgnFromNode(node, opts) {
  opts = opts || {};
  const parts = [];

  function tokenFor(n, forceLabel) {
    let label = '';
    if (n.ply % 2 === 1) label = `${(n.ply + 1) / 2}. `;
    else if (forceLabel) label = `${n.ply / 2}... `;
    let glyph = n.markGlyph ? n.markGlyph : '';
    let out = label + n.san + glyph;
    if (n.commentBefore) out = `{${n.commentBefore}} ` + out;
    if (n.commentAfter) out += ` {${n.commentAfter}}`;
    return out;
  }

  function walk(cur, forceLabelForFirst) {
    let first = true;
    while (cur.children && cur.children.length) {
      const main = cur.children[0];
      parts.push(tokenFor(main, first && forceLabelForFirst));
      first = false;
      for (let i = 1; i < cur.children.length; i++) {
        const alt = cur.children[i];
        parts.push('(' + tokenFor(alt, true));
        walkInline(alt);
        parts.push(')');
      }
      cur = main;
    }
  }
  // Variations are written inline within the same parts array via a nested
  // walk that doesn't need its own leading label logic beyond the first move.
  function walkInline(startNode) {
    let cur = startNode;
    while (cur.children && cur.children.length) {
      const main = cur.children[0];
      parts.push(tokenFor(main, false));
      for (let i = 1; i < cur.children.length; i++) {
        const alt = cur.children[i];
        parts.push('(' + tokenFor(alt, true));
        walkInline(alt);
        parts.push(')');
      }
      cur = main;
    }
  }

  walk(node, true);
  return parts.join(' ');
}

function exportOpeningAsPgn(opening) {
  const headers = [
    `[Event "${opening.name}"]`,
    `[White "${opening.color === 'white' ? 'Repertoire' : '?'}"]`,
    `[Black "${opening.color === 'black' ? 'Repertoire' : '?'}"]`,
    `[Result "*"]`,
  ].join('\n');
  const moves = exportPgnFromNode(opening.tree, {});
  return `${headers}\n\n${moves} *`;
}

// Concatenates several openings into one PGN database — each is its own
// game, separated by a blank line per the PGN spec.
function exportOpeningsAsPgn(openings) {
  return openings.map(exportOpeningAsPgn).join('\n\n');
}
