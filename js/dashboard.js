(async function () {
  const authOk = await window.CTTAuth.requireOwnerAuth();
  if (!authOk) return;

  document.getElementById('logout-btn').addEventListener('click', () => window.CTTAuth.logout());

  const container = document.getElementById('players-container');
  const searchInput = document.getElementById('search-input');

  let allPlayers = [];

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

  function renderPlayers(players) {
    if (players.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🎾</div><div class="empty-state__text">No players found.</div></div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'player-list';

    for (const p of players) {
      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <div class="player-card__info">
          <div class="player-card__name">${escHtml(p.firstName)} ${escHtml(p.lastName)}</div>
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
    if (!q) {
      renderPlayers(allPlayers);
      return;
    }
    const filtered = allPlayers.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
    renderPlayers(filtered);
  });

  try {
    const res = await window.CTTAPI.apiGet('/api/players');
    const data = await window.CTTAPI.parseJson(res);

    if (!res.ok || !data?.players) {
      container.innerHTML = '<div class="card"><p>Failed to load players. Refresh the page to try again.</p></div>';
      return;
    }

    allPlayers = data.players;
    renderPlayers(allPlayers);
  } catch {
    container.innerHTML = '<div class="card"><p>Something went wrong. Please refresh.</p></div>';
  }
})();
