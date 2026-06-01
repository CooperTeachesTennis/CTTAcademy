(async function () {
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('id');

  if (!playerId) {
    window.location.href = '/index.html';
    return;
  }

  // Validate sessionStorage matches the URL param
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
      entry.innerHTML = `
        <div class="session-entry__header">
          <span class="session-entry__date">${formatSessionDate(s.date)}</span>
          <span class="session-entry__duration">${s.durationMinutes} min</span>
        </div>
        <div class="session-entry__topics">${escHtml(s.topicsCovered)}</div>
        <div class="session-entry__notes">${escHtml(s.notes)}</div>
      `;
      list.appendChild(entry);
    }
    container.appendChild(list);
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

    // Stamp the template into the page
    const template = document.getElementById('profile-template');
    const clone = template.content.cloneNode(true);
    mainContent.innerHTML = '';
    mainContent.appendChild(clone);

    // Player info
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

    // LTTDP
    lttdpField(lttdp?.goals, 'lttdp-goals');
    lttdpField(lttdp?.technicalSkills, 'lttdp-technical');
    lttdpField(lttdp?.patternsAndPlays, 'lttdp-patterns');
    lttdpField(lttdp?.onOffSeasons, 'lttdp-seasons');

    // Sessions
    renderSessions(sessionsData?.sessions);

    // Update page title
    document.title = `${player.firstName} ${player.lastName} — Cooper Teaches Tennis`;

  } catch {
    mainContent.innerHTML = '<div class="card"><p>Something went wrong loading your profile. Please try again.</p></div>';
  }
})();
