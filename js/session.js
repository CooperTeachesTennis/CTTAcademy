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

  // ── Individual session form ──────────────────────────────────────────────

  function buildIndividualForm(player, latestSession, existingSession) {
    const heading = isEdit ? 'Edit Session' : `Log Session — ${escHtml(player.firstName)} ${escHtml(player.lastName)}`;

    const reminderHtml = (!isEdit && latestSession) ? `
      <div class="reminder-panel">
        <div class="reminder-panel__label">Last session — ${formatSessionDate(latestSession.date)}</div>
        <div class="session-entry__topics" style="margin-bottom:6px;">${escHtml(latestSession.topicsCovered)}</div>
        <div class="session-entry__notes">${escHtml(latestSession.sharedNotes || latestSession.notes)}</div>
      </div>
    ` : '';

    const fillDate = existingSession?.date || todayIso();
    const fillDuration = existingSession?.durationMinutes || '';
    const fillTopics = existingSession?.topicsCovered || '';
    const fillNotes = existingSession?.notes || '';

    const groupToggleHtml = !isEdit ? `
      <div class="form-group" style="margin-bottom:20px;">
        <label class="toggle-label" style="font-size:0.9rem;color:var(--color-text);">
          <input type="checkbox" id="group-toggle">
          Group lesson
        </label>
      </div>
    ` : '';

    mainContent.innerHTML = `
      <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:20px;">${heading}</h1>
      ${reminderHtml}
      <div class="card">
        <div id="session-msg" class="alert" role="alert"></div>
        ${groupToggleHtml}
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

    if (!isEdit) {
      document.getElementById('group-toggle').addEventListener('change', async (e) => {
        if (e.target.checked) {
          const date = document.getElementById('s-date').value;
          const duration = document.getElementById('s-duration').value;
          const topics = document.getElementById('s-topics').value;
          const notes = document.getElementById('s-notes').value;
          await buildGroupForm(player, { date, duration, topics, notes });
        }
      });
    }

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
          res = await window.CTTAPI.apiPut(`/api/session/${sessionId}`, {
            date, durationMinutes: Number(duration), topicsCovered: topics, notes,
          });
        } else {
          res = await window.CTTAPI.apiPost('/api/session', {
            playerId, date, durationMinutes: Number(duration), topicsCovered: topics, notes,
          });
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

  // ── Group session edit form ──────────────────────────────────────────────

  function buildGroupEditForm(player, existingSession) {
    const fillDate = existingSession.date || todayIso();
    const fillDuration = existingSession.durationMinutes || '';
    const fillTopics = existingSession.topicsCovered || '';
    const fillShared = existingSession.sharedNotes || '';
    const fillIndividual = existingSession.individualNotes || '';

    mainContent.innerHTML = `
      <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:6px;">Edit Session</h1>
      <div style="margin-bottom:20px;">
        <span class="session-group-badge">Group session · ${existingSession.groupSize} players</span>
      </div>
      <div class="card">
        <div id="session-msg" class="alert" role="alert"></div>
        <div class="form-group">
          <label for="s-date">Date *</label>
          <input type="date" id="s-date" value="${escHtml(fillDate)}">
        </div>
        <div class="form-group">
          <label for="s-duration">Duration (minutes) *</label>
          <input type="number" id="s-duration" min="1" max="480" value="${escHtml(String(fillDuration))}">
        </div>
        <div class="form-group">
          <label for="s-topics">Topics covered *</label>
          <input type="text" id="s-topics" value="${escHtml(fillTopics)}">
        </div>
        <div class="form-group">
          <label for="s-shared">Shared notes * <span class="optional">(updates for all players in this session)</span></label>
          <textarea id="s-shared" style="min-height:120px;">${escHtml(fillShared)}</textarea>
        </div>
        <div class="form-group">
          <label for="s-individual">Personal notes for ${escHtml(player.firstName)} <span class="optional">(optional)</span></label>
          <textarea id="s-individual" style="min-height:80px;">${escHtml(fillIndividual)}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn--primary" id="save-session-btn" type="button">Save Changes</button>
          <a href="player.html?id=${escHtml(playerId)}" class="btn btn--secondary">Cancel</a>
        </div>
      </div>
    `;

    document.getElementById('save-session-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('session-msg');
      const date = document.getElementById('s-date').value.trim();
      const duration = document.getElementById('s-duration').value.trim();
      const topics = document.getElementById('s-topics').value.trim();
      const sharedNotes = document.getElementById('s-shared').value.trim();
      const individualNotes = document.getElementById('s-individual').value.trim();

      if (!date || !duration || !topics || !sharedNotes) {
        msgEl.textContent = 'Date, duration, topics, and shared notes are required.';
        msgEl.className = 'alert alert--error is-visible';
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const btn = document.getElementById('save-session-btn');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        const res = await window.CTTAPI.apiPut(`/api/session/${sessionId}`, {
          date, durationMinutes: Number(duration), topicsCovered: topics,
          sharedNotes, individualNotes,
        });
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
        btn.disabled = false; btn.textContent = 'Save Changes';
      }
    });
  }

  // ── Group session create form ────────────────────────────────────────────

  async function buildGroupForm(player, prefill = {}) {
    mainContent.innerHTML = `
      <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:6px;">Log Group Session</h1>
      <p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:20px;">Select all players in this session.</p>
      <div class="card">
        <div id="session-msg" class="alert" role="alert"></div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="toggle-label" style="font-size:0.9rem;color:var(--color-text);">
            <input type="checkbox" id="group-toggle" checked>
            Group lesson
          </label>
        </div>

        <div class="form-group">
          <label>Players in this session *</label>
          <div id="player-chips" class="player-chips" style="display:none;margin-bottom:8px;"></div>
          <div id="player-list-loading" style="font-size:0.875rem;color:var(--color-text-muted);padding:10px 0;">Loading players…</div>
          <div id="player-search-wrap" style="display:none;">
            <div class="search-bar" style="margin-bottom:6px;">
              <span class="search-bar__icon" aria-hidden="true">🔍</span>
              <input type="text" id="player-filter" placeholder="Filter players…" autocomplete="off">
            </div>
            <div id="player-checkbox-list" class="player-checkbox-list"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="s-date">Date *</label>
          <input type="date" id="s-date" value="${escHtml(prefill.date || todayIso())}">
        </div>
        <div class="form-group">
          <label for="s-duration">Duration (minutes) *</label>
          <input type="number" id="s-duration" min="1" max="480" placeholder="60" value="${escHtml(String(prefill.duration || ''))}">
        </div>
        <div class="form-group">
          <label for="s-topics">Topics covered *</label>
          <input type="text" id="s-topics" placeholder="e.g. Backhand groundstroke, serve, footwork" value="${escHtml(prefill.topics || '')}">
        </div>
        <div class="form-group">
          <label for="s-shared">Shared notes * <span class="optional">(shown to all players in this session)</span></label>
          <textarea id="s-shared" style="min-height:140px;" placeholder="What did the group work on? What went well?">${escHtml(prefill.notes || '')}</textarea>
        </div>

        <div id="per-player-section" style="display:none;">
          <div class="divider"></div>
          <label style="margin-bottom:12px;display:block;">Additional notes per player <span class="optional">(optional)</span></label>
          <div id="per-player-notes" class="per-player-notes"></div>
        </div>

        <div class="btn-row">
          <button class="btn btn--primary" id="save-session-btn" type="button">Log Group Session</button>
          <a href="player.html?id=${escHtml(playerId)}" class="btn btn--secondary">Cancel</a>
        </div>
      </div>
    `;

    // Toggle back to individual
    document.getElementById('group-toggle').addEventListener('change', (e) => {
      if (!e.target.checked) {
        const date = document.getElementById('s-date').value;
        const duration = document.getElementById('s-duration').value;
        const topics = document.getElementById('s-topics').value;
        const notes = document.getElementById('s-shared').value;
        buildIndividualForm(player, null, { date, durationMinutes: duration, topicsCovered: topics, notes });
      }
    });

    // Load active players for checkbox list
    let allActivePlayers = [];
    try {
      const res = await window.CTTAPI.apiGet('/api/players');
      const data = await window.CTTAPI.parseJson(res);
      allActivePlayers = (data?.players || []).filter(p => p.active !== false);
    } catch {
      document.getElementById('player-list-loading').textContent = 'Failed to load players.';
      return;
    }

    const listEl = document.getElementById('player-checkbox-list');
    const loadingEl = document.getElementById('player-list-loading');
    const searchWrap = document.getElementById('player-search-wrap');
    const chipsEl = document.getElementById('player-chips');
    const filterInput = document.getElementById('player-filter');

    loadingEl.style.display = 'none';
    searchWrap.style.display = '';

    const checkedPlayers = new Set([playerId]);

    function renderChips() {
      const selected = allActivePlayers.filter(p => checkedPlayers.has(p.id));
      if (selected.length === 0) {
        chipsEl.style.display = 'none';
        chipsEl.innerHTML = '';
        return;
      }
      chipsEl.style.display = 'flex';
      chipsEl.innerHTML = selected.map(p => `
        <span class="player-chip">
          ${escHtml(p.firstName)} ${escHtml(p.lastName[0])}.
          <button type="button" class="player-chip__remove" data-player-id="${escHtml(p.id)}" aria-label="Remove ${escHtml(p.firstName)}">×</button>
        </span>
      `).join('');
      chipsEl.querySelectorAll('.player-chip__remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.dataset.playerId;
          checkedPlayers.delete(pid);
          const cb = document.getElementById(`cb-${pid}`);
          if (cb) cb.checked = false;
          renderChips();
          refreshPerPlayerNotes();
        });
      });
    }

    function refreshPerPlayerNotes() {
      const section = document.getElementById('per-player-section');
      const notesContainer = document.getElementById('per-player-notes');
      const selected = allActivePlayers.filter(p => checkedPlayers.has(p.id));

      if (selected.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = '';

      const existing = {};
      notesContainer.querySelectorAll('textarea[data-player-id]').forEach(ta => {
        existing[ta.dataset.playerId] = ta.value;
      });

      notesContainer.innerHTML = selected.map(p => `
        <div class="per-player-notes__item">
          <label for="note-${escHtml(p.id)}">${escHtml(p.firstName)} ${escHtml(p.lastName)}</label>
          <textarea id="note-${escHtml(p.id)}" data-player-id="${escHtml(p.id)}" style="min-height:70px;" placeholder="Optional personal notes for ${escHtml(p.firstName)}…">${escHtml(existing[p.id] || '')}</textarea>
        </div>
      `).join('');
    }

    // Filter input
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.trim().toLowerCase();
      listEl.querySelectorAll('.player-checkbox-item').forEach(item => {
        const text = item.querySelector('label').textContent.toLowerCase();
        item.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });

    // Build checkbox list
    for (const p of allActivePlayers) {
      const isPreSelected = p.id === playerId;
      const item = document.createElement('div');
      item.className = 'player-checkbox-item';
      const cbId = `cb-${p.id}`;
      item.innerHTML = `
        <input type="checkbox" id="${cbId}" ${isPreSelected ? 'checked' : ''}>
        <label for="${cbId}">${escHtml(p.firstName)} ${escHtml(p.lastName)}${p.ntrpLevel ? ' · ' + escHtml(p.ntrpLevel) : ''}</label>
      `;
      const cb = item.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) checkedPlayers.add(p.id);
        else checkedPlayers.delete(p.id);
        renderChips();
        refreshPerPlayerNotes();
      });
      listEl.appendChild(item);
    }

    renderChips();
    refreshPerPlayerNotes();

    document.getElementById('save-session-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('session-msg');
      const date = document.getElementById('s-date').value.trim();
      const duration = document.getElementById('s-duration').value.trim();
      const topics = document.getElementById('s-topics').value.trim();
      const sharedNotes = document.getElementById('s-shared').value.trim();
      const selectedIds = [...checkedPlayers];

      if (selectedIds.length < 2) {
        msgEl.textContent = 'Select at least 2 players for a group session.';
        msgEl.className = 'alert alert--error is-visible';
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      if (!date || !duration || !topics || !sharedNotes) {
        msgEl.textContent = 'All fields are required.';
        msgEl.className = 'alert alert--error is-visible';
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const individualNotes = {};
      document.querySelectorAll('textarea[data-player-id]').forEach(ta => {
        individualNotes[ta.dataset.playerId] = ta.value.trim();
      });

      const btn = document.getElementById('save-session-btn');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        const res = await window.CTTAPI.apiPost('/api/session', {
          isGroup: true,
          playerIds: selectedIds,
          date,
          durationMinutes: Number(duration),
          topicsCovered: topics,
          sharedNotes,
          individualNotes,
        });
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
        btn.disabled = false; btn.textContent = 'Log Group Session';
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  try {
    const [playerRes, latestRes, editRes] = await Promise.all([
      window.CTTAPI.apiGet(`/api/player/${playerId}`),
      !isEdit ? window.CTTAPI.apiGet(`/api/sessions/${playerId}/latest`) : Promise.resolve(null),
      isEdit ? window.CTTAPI.apiGet(`/api/sessions/${playerId}`) : Promise.resolve(null),
    ]);

    const player = await window.CTTAPI.parseJson(playerRes);
    if (!player) { mainContent.innerHTML = '<div class="card"><p>Player not found.</p></div>'; return; }

    const latestData = latestRes ? await window.CTTAPI.parseJson(latestRes) : null;
    const latestSession = latestData?.session || null;

    let existingSession = null;
    if (isEdit && editRes) {
      const allSessions = await window.CTTAPI.parseJson(editRes);
      existingSession = allSessions?.sessions?.find(s => s.id === sessionId) || null;
    }

    if (isEdit && existingSession?.isGroup) {
      buildGroupEditForm(player, existingSession);
    } else {
      buildIndividualForm(player, latestSession, existingSession);
    }

  } catch {
    mainContent.innerHTML = '<div class="card"><p>Something went wrong. Please refresh.</p></div>';
  }
})();
