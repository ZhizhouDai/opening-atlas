// Small themed modal utility, replacing native prompt()/confirm() dialogs.

function _buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal-box';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return { overlay, box };
}

function modalPrompt(message, defaultValue) {
  return new Promise((resolve) => {
    const { overlay, box } = _buildOverlay();
    box.innerHTML = `
      <p class="modal-message"></p>
      <input type="text" class="modal-input" />
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-act="ok">OK</button>
      </div>
    `;
    box.querySelector('.modal-message').textContent = message;
    const input = box.querySelector('.modal-input');
    input.value = defaultValue || '';

    const close = (result) => { overlay.remove(); resolve(result); };
    box.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    box.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

// Edits everything about a single move: comments before/after, a
// heading/subheading label, bold/boxed emphasis, a color+icon mark, plus
// (when the move has siblings — other continuations at the same branch
// point) reordering it earlier or later among them. The same editor is used
// from Create Repertoire, Study & Analysis, and Booklet mode, so a change
// made from any one of them shows up on the others immediately — all of it
// lives on the move node itself and is saved as part of the opening.
// Resolves to {heading, level, bold, boxed, commentBefore, commentAfter,
// markColor, markGlyph} to save, {reorder: -1 | 1} to move the ply up/down
// among its siblings (applied immediately, closing the dialog), null to
// clear everything, or undefined if cancelled.
//
// opts: { canMoveUp, canMoveDown } — whether a sibling exists in that
// direction; the "Order" section is omitted entirely when neither applies.
function modalPlyStyleEditor(existing, opts = {}) {
  return new Promise((resolve) => {
    const { overlay, box } = _buildOverlay();
    const showOrder = opts.canMoveUp || opts.canMoveDown;
    box.innerHTML = `
      <p class="modal-message">Label or style this move</p>
      <p class="modal-section-label">Comment before this move</p>
      <textarea class="modal-input" data-field="commentBefore" rows="2" placeholder="e.g. Preparing …"></textarea>
      <p class="modal-section-label">Comment after this move</p>
      <textarea class="modal-input" data-field="commentAfter" rows="2" placeholder="e.g. Better is … here."></textarea>
      <p class="modal-section-label">Heading</p>
      <input type="text" class="modal-input" data-field="heading" placeholder="Heading text, e.g. &quot;Schmidt Variation&quot;" />
      <div class="modal-btn-row">
        <button type="button" class="btn btn-ghost level-btn" data-level="1">Heading</button>
        <button type="button" class="btn btn-ghost level-btn" data-level="2">Subheading</button>
        <button type="button" class="btn btn-ghost level-btn" data-level="3">Subheading 2</button>
      </div>
      <p class="modal-section-label">Emphasis</p>
      <div class="modal-btn-row">
        <button type="button" class="btn btn-ghost level-btn" data-style="bold"><b>Bold</b></button>
        <button type="button" class="btn btn-ghost level-btn" data-style="boxed">Box</button>
      </div>
      <p class="modal-section-label">Mark</p>
      <div class="mark-row">
        <span class="mark-row-label">Color</span>
        <div class="swatch-row" data-mark-colors></div>
      </div>
      <div class="mark-row">
        <span class="mark-row-label">Icon</span>
        <div class="glyph-row" data-mark-glyphs></div>
      </div>
      ${showOrder ? `
      <p class="modal-section-label">Order among continuations</p>
      <div class="modal-btn-row">
        <button type="button" class="btn btn-ghost" data-act="move-up" ${opts.canMoveUp ? '' : 'disabled'}>&#8593; Move up</button>
        <button type="button" class="btn btn-ghost" data-act="move-down" ${opts.canMoveDown ? '' : 'disabled'}>&#8595; Move down</button>
      </div>` : ''}
      <div class="modal-actions">
        ${existing ? '<button type="button" class="btn btn-ghost danger" data-act="remove">Clear</button>' : ''}
        <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-act="ok">Save</button>
      </div>
    `;
    const headingInput = box.querySelector('[data-field="heading"]');
    const commentBeforeInput = box.querySelector('[data-field="commentBefore"]');
    const commentAfterInput = box.querySelector('[data-field="commentAfter"]');
    headingInput.value = existing ? existing.heading || '' : '';
    commentBeforeInput.value = existing ? existing.commentBefore || '' : '';
    commentAfterInput.value = existing ? existing.commentAfter || '' : '';
    let level = existing && existing.level === 3 ? 3 : existing && existing.level === 2 ? 2 : 1;
    let bold = !!(existing && existing.bold);
    let boxed = !!(existing && existing.boxed);
    let markColor = (existing && existing.markColor) || 'none';
    let markGlyph = (existing && existing.markGlyph) || '';

    const levelBtns = [...box.querySelectorAll('[data-level]')];
    const syncLevel = () => levelBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.level) === level));
    syncLevel();
    levelBtns.forEach((b) => b.addEventListener('click', () => { level = Number(b.dataset.level); syncLevel(); }));

    const boldBtn = box.querySelector('[data-style="bold"]');
    const boxedBtn = box.querySelector('[data-style="boxed"]');
    const syncStyle = () => { boldBtn.classList.toggle('active', bold); boxedBtn.classList.toggle('active', boxed); };
    syncStyle();
    boldBtn.addEventListener('click', () => { bold = !bold; syncStyle(); });
    boxedBtn.addEventListener('click', () => { boxed = !boxed; syncStyle(); });

    const colorsEl = box.querySelector('[data-mark-colors]');
    colorsEl.innerHTML = MARK_COLORS.map((c) => `<button type="button" data-color="${c}" class="swatch swatch-${c}" title="${c}"></button>`).join('');
    const syncColor = () => [...colorsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.color === markColor));
    syncColor();
    colorsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      markColor = b.dataset.color;
      syncColor();
    });

    const glyphsEl = box.querySelector('[data-mark-glyphs]');
    glyphsEl.innerHTML = MARK_GLYPHS.map((g) => `<button type="button" data-glyph="${g}" class="glyph-btn">${g || '—'}</button>`).join('');
    const syncGlyph = () => [...glyphsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.glyph === markGlyph));
    syncGlyph();
    glyphsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-glyph]');
      if (!b) return;
      markGlyph = b.dataset.glyph;
      syncGlyph();
    });

    const close = (result) => { overlay.remove(); resolve(result); };
    box.querySelector('[data-act="cancel"]').addEventListener('click', () => close(undefined));
    const removeBtn = box.querySelector('[data-act="remove"]');
    if (removeBtn) removeBtn.addEventListener('click', () => close(null));
    const moveUpBtn = box.querySelector('[data-act="move-up"]');
    const moveDownBtn = box.querySelector('[data-act="move-down"]');
    if (moveUpBtn) moveUpBtn.addEventListener('click', () => close({ reorder: -1 }));
    if (moveDownBtn) moveDownBtn.addEventListener('click', () => close({ reorder: 1 }));
    const save = () => {
      const heading = headingInput.value.trim();
      const commentBefore = commentBeforeInput.value.trim();
      const commentAfter = commentAfterInput.value.trim();
      const result = {
        heading, level, bold, boxed, commentBefore, commentAfter,
        markColor: markColor === 'none' ? null : markColor,
        markGlyph,
      };
      const isEmpty = !heading && !bold && !boxed && !commentBefore && !commentAfter && !result.markColor && !markGlyph;
      close(isEmpty ? null : result);
    };
    box.querySelector('[data-act="ok"]').addEventListener('click', save);
    headingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') close(undefined);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(undefined); });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(undefined); });
    requestAnimationFrame(() => { commentBeforeInput.focus(); });
  });
}

// Names a study board: a free-text name, or pick one of the repertoire's
// existing headings. Resolves to the chosen name string to save, null to
// reset to the default "Board N" label, or undefined if cancelled.
function modalBoardName(currentName, headingTexts) {
  return new Promise((resolve) => {
    const { overlay, box } = _buildOverlay();
    const options = [...new Set(headingTexts.filter(Boolean))];
    box.innerHTML = `
      <p class="modal-message">Name this board</p>
      <input type="text" class="modal-input" placeholder="Board name" />
      ${options.length ? `
      <p class="modal-section-label">Or pick a heading from this repertoire</p>
      <div class="modal-heading-list">
        ${options.map((h, i) => `<button type="button" class="branch-menu-item" data-idx="${i}"></button>`).join('')}
      </div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost danger" data-act="reset">Reset</button>
        <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-act="ok">Save</button>
      </div>
    `;
    const input = box.querySelector('.modal-input');
    input.value = currentName || '';
    [...box.querySelectorAll('.modal-heading-list .branch-menu-item')].forEach((b, i) => {
      b.textContent = options[i];
      b.addEventListener('click', () => { input.value = options[i]; input.focus(); });
    });

    const close = (result) => { overlay.remove(); resolve(result); };
    box.querySelector('[data-act="cancel"]').addEventListener('click', () => close(undefined));
    box.querySelector('[data-act="reset"]').addEventListener('click', () => close(null));
    const save = () => close(input.value.trim() || null);
    box.querySelector('[data-act="ok"]').addEventListener('click', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') close(undefined);
    });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(undefined); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

function modalConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const { overlay, box } = _buildOverlay();
    box.innerHTML = `
      <p class="modal-message"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button type="button" class="btn ${opts.danger ? 'btn-ghost danger' : 'btn-primary'}" data-act="ok"></button>
      </div>
    `;
    box.querySelector('.modal-message').textContent = message;
    box.querySelector('[data-act="ok"]').textContent = opts.okLabel || 'OK';
    const close = (result) => { overlay.remove(); resolve(result); };
    box.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    box.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey, { once: true });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(false); });
  });
}
