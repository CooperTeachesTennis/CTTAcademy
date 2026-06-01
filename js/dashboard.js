(async function () {
  const authOk = await window.CTTAuth.requireOwnerAuth();
  if (!authOk) return;

  document.getElementById('logout-btn').addEventListener('click', () => window.CTTAuth.logout());

  const statsContainer = document.getElementById('stats-container');
  const toolbar = document.getElementById('dashboard-toolbar');
  const container = document.getElementById('players-container');
  const searchInput = document.getElementById('search-input');
  const exportBtn = document.getElementById('export-csv-btn');

  let allPlayers = [];
  let showInactive = false;

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  }

  // ── Analytics panel ──────────────────────────────────────────────────────

  function renderStats(data) {
    if (!data) { statsContainer.innerHTML = ''; return; }

    const { totalActivePlayers, totalInactivePlayers, ntrpDistribution, totalUniqueSessions } = data;

    const ntrpOrder = ['Beginner', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0+', 'Not set'];
    const ntrpChips = Object.entries(ntrpDistribution)
      .sort(([a], [b]) => {
        const ai = ntrpOrder.indexOf(a);
        const bi = ntrpOrder.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([level, count]) => `<span class="ntrp-chip">${escHtml(level)}: ${count}</span>`)
      .join('');

    const inactiveCard = totalInactivePlayers > 0
      ? `<div class="stat-card">
           <div class="stat-card__value">${totalInactivePlayers}</div>
           <div class="stat-card__label">Inactive</div>
         </div>`
      : '';

    statsContainer.innerHTML = `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__value">${totalActivePlayers}</div>
          <div class="stat-card__label">Active Players</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalUniqueSessions}</div>
          <div class="stat-card__label">Sessions Taught</div>
        </div>
        ${inactiveCard}
      </div>
      ${ntrpChips ? `
        <div class="ntrp-breakdown">
          <span class="ntrp-breakdown__label">NTRP</span>
          ${ntrpChips}
        </div>
      ` : ''}
    `;
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle-label';
  toggleLabel.innerHTML = `<input type="checkbox" id="show-inactive-toggle"> Show inactive players`;
  toolbar.appendChild(toggleLabel);

  document.getElementById('show-inactive-toggle').addEventListener('change', async (e) => {
    showInactive = e.target.checked;
    await loadPlayers();
  });

  // ── CSV export ────────────────────────────────────────────────────────────

  exportBtn.addEventListener('click', () => {
    const active = allPlayers.filter(p => p.active !== false);
    if (active.length === 0) {
      alert('No active players to export.');
      return;
    }

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'NTRP Level', 'Improvement Goals', 'Member Since'];
    const rows = active.map(p => [
      p.firstName,
      p.lastName,
      p.email,
      p.phone,
      p.ntrpLevel || '',
      p.improvementGoals || '',
      p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US') : '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctt-players-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Player list ───────────────────────────────────────────────────────────

  function renderPlayers(players) {
    if (players.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🎾</div><div class="empty-state__text">No players found.</div></div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'player-list';

    for (const p of players) {
      const inactive = p.active === false;
      const card = document.createElement('div');
      card.className = `player-card${inactive ? ' player-card--inactive' : ''}`;
      card.innerHTML = `
        <div class="player-card__info">
          <div class="player-card__name">
            ${escHtml(p.firstName)} ${escHtml(p.lastName)}
            ${inactive ? '<span class="badge--inactive">Inactive</span>' : ''}
          </div>
          <div class="player-card__meta">
            ${p.ntrpLevel ? escHtml(p.ntrpLevel) + ' · ' : ''}Member since ${formatDate(p.createdAt)}
          </div>
        </div>
        <div class="player-card__actions">
          <a href="session.html?playerId=${escHtml(p.id)}" class="btn btn--secondary btn--sm">Log session</a>
          <a href="player.html?id=${escHtml(p.id)}" class="btn btn--primary btn--sm">View</a>
        </div>
      `;
      list.appendChild(card);
    }

    container.innerHTML = '';
    container.appendChild(list);
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { renderPlayers(allPlayers); return; }
    const filtered = allPlayers.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
    renderPlayers(filtered);
  });

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadPlayers() {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const path = showInactive ? '/api/players?include_inactive=true' : '/api/players';
      const res = await window.CTTAPI.apiGet(path);
      const data = await window.CTTAPI.parseJson(res);

      if (!res.ok || !data?.players) {
        container.innerHTML = '<div class="card"><p>Failed to load players. Refresh to try again.</p></div>';
        return;
      }

      allPlayers = data.players;
      renderPlayers(allPlayers);
    } catch {
      container.innerHTML = '<div class="card"><p>Something went wrong. Please refresh.</p></div>';
    }
  }

  // Load analytics and players in parallel
  try {
    const [analyticsRes] = await Promise.all([
      window.CTTAPI.apiGet('/api/analytics'),
      loadPlayers(),
    ]);
    const analyticsData = await window.CTTAPI.parseJson(analyticsRes);
    renderStats(analyticsData);
  } catch {
    renderStats(null);
  }
})();
