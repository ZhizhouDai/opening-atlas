// Boot + top-level nav.

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Turns an opening/file name into a safe filename component.
function slugifyFilename(name) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'untitled';
}

async function setView(view) {
  const leavingStudy = view !== 'study' && document.getElementById('view-study').classList.contains('active');
  if (leavingStudy && typeof Study !== 'undefined' && Study.dirty) {
    const ok = await modalConfirm('You have unsaved study changes. Leave anyway without saving?', { danger: true, okLabel: 'Leave' });
    if (!ok) {
      const sel = document.getElementById('navSelect');
      if (sel) sel.value = 'study';
      return;
    }
    Study.dirty = false;
  }
  if (view === 'study' && typeof Study !== 'undefined') await Study.refreshOpenings();
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const sel = document.getElementById('navSelect');
  if (sel) sel.value = view;
}

async function boot() {
  await DB.init();
  await Repertoire.init();
  await Study.init();

  document.getElementById('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) setView(btn.dataset.view);
  });
  const sel = document.getElementById('navSelect');
  if (sel) sel.addEventListener('change', () => setView(sel.value));

  window.addEventListener('beforeunload', (e) => {
    if (Study.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

boot();
