(function () {
  const grid = document.getElementById('selector-grid');

  const lookup = window.CTTAuth.getLookupResult();

  if (!lookup || !lookup.players || lookup.players.length === 0) {
    window.location.href = '/index.html';
    return;
  }

  window.CTTAuth.clearLookupResult();

  const { players, email } = lookup;

  for (const player of players) {
    const initials = (player.firstName[0] || '') + (player.lastName[0] || '');
    const inactive = player.active === false;
    const card = document.createElement('button');
    card.className = 'selector-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="selector-card__initials">${escHtml(initials.toUpperCase())}</div>
      ${escHtml(player.firstName)} ${escHtml(player.lastName)}
      ${inactive ? '<br><span class="badge--inactive" style="margin-left:0;margin-top:6px;">Inactive</span>' : ''}
    `;
    card.addEventListener('click', () => {
      window.CTTAuth.setPlayerSession(player.id, email);
      window.location.href = `/profile.html?id=${player.id}`;
    });
    grid.appendChild(card);
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
