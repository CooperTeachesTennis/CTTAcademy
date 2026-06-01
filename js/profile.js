(async function () {
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('id');

  if (!playerId) {
    window.location.href = '/index.html';
    return;
  }

  if (!window.CTTAuth.requirePlayerAuth(playerId)) return;

  document.getElementById('logout-btn').addEventListener('click', () => {
    window.CTTAuth.logout();
  });

  const mainContent = document.getElementById('main-content');

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
  }

  function formatSessionDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function lttdpField(content, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (content && content.trim()) {
      el.textContent = content;
    } else {
      el.className = 'lttdp-section__empty';
      el.textContent = 'Coming soon — your coach will fill this in.';
    }
  }

  function showInactiveModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal__title" id="modal-title">Profile Inactive</div>
        <div class="modal__body">
          Your Player Profile is marked as <strong>Inactive</strong>. Contact your coach to resume lessons.
        </div>
        <div class="modal__actions">
          <button class="btn btn--primary btn--sm" id="modal-ok-btn" type="button">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('modal-ok-btn').addEventListener('click', () => {
      sessionStorage.setItem('ctt_inactive_ack', '1');
      overlay.remove();
    });
  }

  function renderSessions(sessions) {
    const container = document.getElementById('sessions-body');
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__text">No session notes yet.</div></div>';
      return;
    }
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'session-list';

    for (const s of sessions) {
      const entry = document.createElement('div');
      entry.className = 'session-entry';

      const isGroup = s.isGroup;
      const groupBadge = isGroup
        ? `<span class="session-group-badge">Group · ${s.groupSize} players</span>`
        : '';

      const notesHtml = isGroup
        ? `<div class="session-entry__notes">${escHtml(s.sharedNotes)}</div>
           ${s.individualNotes ? `
             <div class="session-entry__individual-notes">
               <div class="session-entry__individual-notes-label">Personal notes</div>
               <div class="session-entry__individual-notes-text">${escHtml(s.individualNotes)}</div>
             </div>` : ''}`
        : `<div class="session-entry__notes">${escHtml(s.notes)}</div>`;

      entry.innerHTML = `
        <div class="session-entry__header">
          <span class="session-entry__date">${formatSessionDate(s.date)}</span>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${groupBadge}
            <span class="session-entry__duration">${s.durationMinutes} min</span>
          </div>
        </div>
        <div class="session-entry__topics">${escHtml(s.topicsCovered)}</div>
        ${notesHtml}
      `;
      list.appendChild(entry);
    }
    container.appendChild(list);
  }

  try {
    const [playerRes, lttdpRes, sessionsRes] = await Promise.all([
      window.CTTAPI.apiGet(`/api/player/${playerId}`),
      window.CTTAPI.apiGet(`/api/lttdp/${playerId}`),
      window.CTTAPI.apiGet(`/api/sessions/${playerId}`),
    ]);

    if (!playerRes || playerRes.status === 404) {
      mainContent.innerHTML = '<div class="card"><p>Profile not found.</p></div>';
      return;
    }

    const [player, lttdp, sessionsData] = await Promise.all([
      window.CTTAPI.parseJson(playerRes),
      window.CTTAPI.parseJson(lttdpRes),
      window.CTTAPI.parseJson(sessionsRes),
    ]);

    const template = document.getElementById('profile-template');
    const clone = template.content.cloneNode(true);
    mainContent.innerHTML = '';
    mainContent.appendChild(clone);

    document.getElementById('player-name').textContent = `${player.firstName} ${player.lastName}`;
    document.getElementById('player-email').textContent = player.email;
    document.getElementById('player-phone').textContent = player.phone;
    document.getElementById('player-ntrp').textContent = player.ntrpLevel || '—';
    document.getElementById('player-since').textContent = formatDate(player.createdAt);

    const goalsWrap = document.getElementById('player-goals-wrap');
    const goalsEl = document.getElementById('player-goals');
    if (player.improvementGoals) {
      goalsEl.textContent = player.improvementGoals;
    } else {
      goalsWrap.style.display = 'none';
    }

    lttdpField(lttdp?.goals, 'lttdp-goals');
    lttdpField(lttdp?.technicalSkills, 'lttdp-technical');
    lttdpField(lttdp?.patternsAndPlays, 'lttdp-patterns');
    lttdpField(lttdp?.onOffSeasons, 'lttdp-seasons');

    renderSessions(sessionsData?.sessions);

    document.title = `${player.firstName} ${player.lastName} — Cooper Teaches Tennis`;

    // Show inactive modal once per browser session
    if (player.active === false && !sessionStorage.getItem('ctt_inactive_ack')) {
      showInactiveModal();
    }

  } catch {
    mainContent.innerHTML = '<div class="card"><p>Something went wrong loading your profile. Please try again.</p></div>';
  }
})();
