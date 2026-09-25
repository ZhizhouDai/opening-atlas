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

// Edits a single move's styling: an optional heading/subheading label, plus
// independent bold and boxed emphasis toggles, plus (when the move has
// siblings — other continuations at the same branch point) reordering it
// earlier or later among them. Resolves to {heading, level, bold, boxed} to
// save, {reorder: -1 | 1} to move the ply up/down among its siblings
// (applied immediately, closing the dialog), null to clear everything, or
// undefined if cancelled.
//
// opts: { canMoveUp, canMoveDown } — whether a sibling exists in that
// direction; the "Order" section is omitted entirely when neither applies.
function modalPlyStyleEditor(existing, opts = {}) {
  return new Promise((resolve) => {
    const { overlay, box } = _buildOverlay();
    const showOrder = opts.canMoveUp || opts.canMoveDown;
    box.innerHTML = `
      <p class="modal-message">Label or style this move</p>
      <input type="text" class="modal-input" placeholder="Heading text, e.g. &quot;Schmidt Variation&quot;" />
      <div class="modal-btn-row">
        <button type="button" class="btn btn-ghost level-btn" data-level="1">Heading</button>
        <button type="button" class="btn btn-ghost level-btn" data-level="2">Subheading</button>
      </div>
      <p class="modal-section-label">Emphasis</p>
      <div class="modal-btn-row">
        <button type="button" class="btn btn-ghost level-btn" data-style="bold"><b>Bold</b></button>
        <button type="button" class="btn btn-ghost level-btn" data-style="boxed">Box</button>
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
    const input = box.querySelector('.modal-input');
    input.value = existing ? existing.heading || '' : '';
    let level = existing && existing.level === 2 ? 2 : 1;
    let bold = !!(existing && existing.bold);
    let boxed = !!(existing && existing.boxed);

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

    const close = (result) => { overlay.remove(); resolve(result); };
    box.querySelector('[data-act="cancel"]').addEventListener('click', () => close(undefined));
    const removeBtn = box.querySelector('[data-act="remove"]');
    if (removeBtn) removeBtn.addEventListener('click', () => close(null));
    const moveUpBtn = box.querySelector('[data-act="move-up"]');
    const moveDownBtn = box.querySelector('[data-act="move-down"]');
    if (moveUpBtn) moveUpBtn.addEventListener('click', () => close({ reorder: -1 }));
    if (moveDownBtn) moveDownBtn.addEventListener('click', () => close({ reorder: 1 }));
    const save = () => {
      const heading = input.value.trim();
      close((heading || bold || boxed) ? { heading, level, bold, boxed } : null);
    };
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
