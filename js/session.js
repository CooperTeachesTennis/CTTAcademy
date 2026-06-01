(async function () {
  const authOk = await window.CTTAuth.requireOwnerAuth();
  if (!authOk) return;

  document.getElementById('logout-btn').addEventListener('click', () => window.CTTAuth.logout());

  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('playerId');
  const sessionId = params.get('sessionId');
  const isEdit = !!sessionId;
  const mainContent = document.getElementById('main-content');
  const navBack = document.getElementById('nav-back-link');

  if (!playerId) { window.location.href = '/dashboard.html'; return; }

  navBack.innerHTML = `<a href="player.html?id=${encodeURIComponent(playerId)}" class="nav-link">← Player</a>`;

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatSessionDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function buildForm(player, latestSession, existingSession) {
    const heading = isEdit ? 'Edit Session' : `Log Session — ${escHtml(player.firstName)} ${escHtml(player.lastName)}`;

    const reminderHtml = (!isEdit && latestSession) ? `
      <div class="reminder-panel">
        <div class="reminder-panel__label">Last session — ${formatSessionDate(latestSession.date)}</div>
        <div class="session-entry__topics" style="margin-bottom:6px;">${escHtml(latestSession.topicsCovered)}</div>
        <div class="session-entry__notes">${escHtml(latestSession.notes)}</div>
      </div>
    ` : '';

    const fillDate = existingSession?.date || todayIso();
    const fillDuration = existingSession?.durationMinutes || '';
    const fillTopics = existingSession?.topicsCovered || '';
    const fillNotes = existingSession?.notes || '';

    mainContent.innerHTML = `
      <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:20px;">${heading}</h1>

      ${reminderHtml}

      <div class="card">
        <div id="session-msg" class="alert" role="alert"></div>

        <div class="form-group">
          <label for="s-date">Date *</label>
          <input type="date" id="s-date" value="${escHtml(fillDate)}">
        </div>

        <div class="form-group">
          <label for="s-duration">Duration (minutes) *</label>
          <input type="number" id="s-duration" min="1" max="480" placeholder="60" value="${escHtml(String(fillDuration))}">
        </div>

        <div class="form-group">
          <label for="s-topics">Topics covered *</label>
          <input type="text" id="s-topics" placeholder="e.g. Backhand groundstroke, serve, footwork" value="${escHtml(fillTopics)}">
        </div>

        <div class="form-group">
          <label for="s-notes">Session notes *</label>
          <textarea id="s-notes" style="min-height:140px;" placeholder="What did we work on? What went well? What needs more work?">${escHtml(fillNotes)}</textarea>
        </div>

        <div class="btn-row">
          <button class="btn btn--primary" id="save-session-btn" type="button">
            ${isEdit ? 'Save Changes' : 'Log Session'}
          </button>
          <a href="player.html?id=${escHtml(playerId)}" class="btn btn--secondary">Cancel</a>
        </div>
      </div>
    `;

    document.getElementById('save-session-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('session-msg');
      const date = document.getElementById('s-date').value.trim();
      const duration = document.getElementById('s-duration').value.trim();
      const topics = document.getElementById('s-topics').value.trim();
      const notes = document.getElementById('s-notes').value.trim();

      if (!date || !duration || !topics || !notes) {
        msgEl.textContent = 'All fields are required.';
        msgEl.className = 'alert alert--error is-visible';
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const btn = document.getElementById('save-session-btn');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        let res;
        if (isEdit) {
          res = await window.CTTAPI.apiPut(`/api/session/${sessionId}`, { date, durationMinutes: Number(duration), topicsCovered: topics, notes });
        } else {
          res = await window.CTTAPI.apiPost('/api/session', { playerId, date, durationMinutes: Number(duration), topicsCovered: topics, notes });
        }

        const data = await window.CTTAPI.parseJson(res);

        if (!res.ok) {
          msgEl.textContent = data?.error || 'Save failed. Please try again.';
          msgEl.className = 'alert alert--error is-visible';
          return;
        }

        window.location.href = `/player.html?id=${playerId}`;
      } catch {
        msgEl.textContent = 'Something went wrong. Please try again.';
        msgEl.className = 'alert alert--error is-visible';
      } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? 'Save Changes' : 'Log Session';
      }
    });
  }

  try {
    const [playerRes, latestRes, editRes] = await Promise.all([
      window.CTTAPI.apiGet(`/api/player/${playerId}`),
      window.CTTAPI.apiGet(`/api/sessions/${playerId}/latest`),
      isEdit ? window.CTTAPI.apiGet(`/api/sessions/${playerId}`) : Promise.resolve(null),
    ]);

    const player = await window.CTTAPI.parseJson(playerRes);
    if (!player) { mainContent.innerHTML = '<div class="card"><p>Player not found.</p></div>'; return; }

    const latestData = await window.CTTAPI.parseJson(latestRes);
    const latestSession = latestData?.session || null;

    let existingSession = null;
    if (isEdit && editRes) {
      const allSessions = await window.CTTAPI.parseJson(editRes);
      existingSession = allSessions?.sessions?.find(s => s.id === sessionId) || null;
    }

    buildForm(player, latestSession, existingSession);

  } catch {
    mainContent.innerHTML = '<div class="card"><p>Something went wrong. Please refresh.</p></div>';
  }
})();
