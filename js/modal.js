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
