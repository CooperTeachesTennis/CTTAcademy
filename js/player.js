(async function () {
  const authOk = await window.CTTAuth.requireOwnerAuth();
  if (!authOk) return;

  document.getElementById('logout-btn').addEventListener('click', () => window.CTTAuth.logout());

  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('id');
  const isNew = params.get('new') === 'true';
  const mainContent = document.getElementById('main-content');

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return iso; }
  }

  function formatSessionDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  }

  function showMsg(container, msg, type = 'error') {
    container.textContent = msg;
    container.className = `alert alert--${type} is-visible`;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── New player form ──────────────────────────────────────────────────────

  if (isNew) {
    document.title = 'Add Player — Cooper Teaches Tennis';
    mainContent.innerHTML = `
      <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);margin-bottom:24px;">Add New Player</h1>
      <div class="card">
        <div id="new-error" class="alert alert--error" role="alert"></div>
        <div class="form-group"><label for="n-firstName">First name *</label><input type="text" id="n-firstName"></div>
        <div class="form-group"><label for="n-lastName">Last name *</label><input type="text" id="n-lastName"></div>
        <div class="form-group"><label for="n-email">Email *</label><input type="email" id="n-email" autocapitalize="none"></div>
        <div class="form-group"><label for="n-phone">Phone *</label><input type="tel" id="n-phone"></div>
        <div class="form-group">
          <label for="n-ntrp">NTRP level <span class="optional">(optional)</span></label>
          <select id="n-ntrp">
            <option value="">— Select —</option>
            <option>Beginner</option><option>2.5</option><option>3.0</option>
            <option>3.5</option><option>4.0</option><option>4.5</option><option>5.0+</option>
          </select>
        </div>
        <div class="form-group">
          <label for="n-goals">What they want to improve <span class="optional">(optional)</span></label>
          <textarea id="n-goals"></textarea>
        </div>
        <div class="form-group">
          <label for="n-parentEmail">Parent/guardian email <span class="optional">(optional)</span></label>
          <input type="email" id="n-parentEmail" autocapitalize="none">
        </div>
        <button class="btn btn--primary mt-16" id="save-new-btn" type="button">Create Player</button>
      </div>
    `;

    document.getElementById('save-new-btn').addEventListener('click', async () => {
      const errorEl = document.getElementById('new-error');
      const firstName = document.getElementById('n-firstName').value.trim();
      const lastName = document.getElementById('n-lastName').value.trim();
      const email = document.getElementById('n-email').value.trim();
      const phone = document.getElementById('n-phone').value.trim();

      if (!firstName || !lastName || !email || !phone) {
        showMsg(errorEl, 'All fields are required.');
        return;
      }

      const btn = document.getElementById('save-new-btn');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        const res = await window.CTTAPI.apiPost('/api/player', {
          firstName, lastName, email, phone,
          ntrpLevel: document.getElementById('n-ntrp').value,
          improvementGoals: document.getElementById('n-goals').value.trim(),
          parentEmail: document.getElementById('n-parentEmail').value.trim(),
        });
        const data = await window.CTTAPI.parseJson(res);

        if (res.status === 409) { showMsg(errorEl, 'A profile already exists for that email.'); return; }
        if (!res.ok || !data?.id) { showMsg(errorEl, data?.error || 'Failed to create player.'); return; }

        window.location.href = `/player.html?id=${data.id}`;
      } catch { showMsg(errorEl, 'Something went wrong. Please try again.'); }
      finally { btn.disabled = false; btn.textContent = 'Create Player'; }
    });

    return;
  }

  // ── Existing player ──────────────────────────────────────────────────────

  if (!playerId) { window.location.href = '/dashboard.html'; return; }

  try {
    const [playerRes, lttdpRes, sessionsRes] = await Promise.all([
      window.CTTAPI.apiGet(`/api/player/${playerId}`),
      window.CTTAPI.apiGet(`/api/lttdp/${playerId}`),
      window.CTTAPI.apiGet(`/api/sessions/${playerId}`),
    ]);

    const [player, lttdp, sessionsData] = await Promise.all([
      window.CTTAPI.parseJson(playerRes),
      window.CTTAPI.parseJson(lttdpRes),
      window.CTTAPI.parseJson(sessionsRes),
    ]);

    if (!player) { mainContent.innerHTML = '<div class="card"><p>Player not found.</p></div>'; return; }

    document.title = `${player.firstName} ${player.lastName} — Cooper Teaches Tennis`;

    mainContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h1 style="font-size:1.25rem;font-weight:700;color:var(--color-primary-dark);">${escHtml(player.firstName)} ${escHtml(player.lastName)}</h1>
        <a href="session.html?playerId=${escHtml(playerId)}" class="btn btn--primary btn--sm">+ Log session</a>
      </div>

      <!-- Profile edit -->
      <div class="card">
        <div class="card__title">Player Info</div>
        <div id="profile-msg" class="alert" role="alert"></div>
        <div class="form-group"><label for="e-firstName">First name</label><input type="text" id="e-firstName" value="${escHtml(player.firstName)}"></div>
        <div class="form-group"><label for="e-lastName">Last name</label><input type="text" id="e-lastName" value="${escHtml(player.lastName)}"></div>
        <div class="form-group"><label for="e-email">Email</label><input type="email" id="e-email" value="${escHtml(player.email)}" autocapitalize="none"></div>
        <div class="form-group"><label for="e-phone">Phone</label><input type="tel" id="e-phone" value="${escHtml(player.phone)}"></div>
        <div class="form-group">
          <label for="e-ntrp">NTRP level</label>
          <select id="e-ntrp">
            <option value="">— None —</option>
            ${['Beginner','2.5','3.0','3.5','4.0','4.5','5.0+'].map(v => `<option${player.ntrpLevel===v?' selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label for="e-goals">What they want to improve</label><textarea id="e-goals">${escHtml(player.improvementGoals)}</textarea></div>
        <div class="form-group"><label for="e-parentEmail">Parent/guardian email</label><input type="email" id="e-parentEmail" value="${escHtml(player.parentEmail)}" autocapitalize="none"></div>
        <button class="btn btn--primary btn--sm mt-16" id="save-profile-btn" type="button">Save Profile</button>
      </div>

      <!-- LTTDP -->
      <div class="card mt-16">
        <div class="card__title">Long-Term Tennis Development Plan</div>
        <div id="lttdp-msg" class="alert" role="alert"></div>
        <div class="lttdp-section">
          <div class="lttdp-section__label">Goals</div>
          <textarea id="lttdp-goals" style="margin-top:8px;">${escHtml(lttdp?.goals)}</textarea>
        </div>
        <div class="lttdp-section">
          <div class="lttdp-section__label">Technical Skills</div>
          <textarea id="lttdp-technical" style="margin-top:8px;">${escHtml(lttdp?.technicalSkills)}</textarea>
        </div>
        <div class="lttdp-section">
          <div class="lttdp-section__label">Patterns &amp; Plays</div>
          <textarea id="lttdp-patterns" style="margin-top:8px;">${escHtml(lttdp?.patternsAndPlays)}</textarea>
        </div>
        <div class="lttdp-section">
          <div class="lttdp-section__label">On / Off Season</div>
          <textarea id="lttdp-seasons" style="margin-top:8px;">${escHtml(lttdp?.onOffSeasons)}</textarea>
        </div>
        <button class="btn btn--primary btn--sm mt-16" id="save-lttdp-btn" type="button">Save LTTDP</button>
      </div>

      <!-- Sessions -->
      <div class="card mt-16">
        <div class="card__title">Session History</div>
        <div id="sessions-body"></div>
      </div>
    `;

    // Save profile
    document.getElementById('save-profile-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('profile-msg');
      const btn = document.getElementById('save-profile-btn');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const res = await window.CTTAPI.apiPut(`/api/player/${playerId}`, {
          firstName: document.getElementById('e-firstName').value.trim(),
          lastName: document.getElementById('e-lastName').value.trim(),
          email: document.getElementById('e-email').value.trim(),
          phone: document.getElementById('e-phone').value.trim(),
          ntrpLevel: document.getElementById('e-ntrp').value,
          improvementGoals: document.getElementById('e-goals').value.trim(),
          parentEmail: document.getElementById('e-parentEmail').value.trim(),
        });
        const data = await window.CTTAPI.parseJson(res);
        if (!res.ok) { showMsg(msgEl, data?.error || 'Save failed.'); return; }
        showMsg(msgEl, 'Profile saved.', 'success');
      } catch { showMsg(msgEl, 'Something went wrong.'); }
      finally { btn.disabled = false; btn.textContent = 'Save Profile'; }
    });

    // Save LTTDP
    document.getElementById('save-lttdp-btn').addEventListener('click', async () => {
      const msgEl = document.getElementById('lttdp-msg');
      const btn = document.getElementById('save-lttdp-btn');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const res = await window.CTTAPI.apiPut(`/api/lttdp/${playerId}`, {
          goals: document.getElementById('lttdp-goals').value,
          technicalSkills: document.getElementById('lttdp-technical').value,
          patternsAndPlays: document.getElementById('lttdp-patterns').value,
          onOffSeasons: document.getElementById('lttdp-seasons').value,
        });
        const data = await window.CTTAPI.parseJson(res);
        if (!res.ok) { showMsg(msgEl, data?.error || 'Save failed.'); return; }
        showMsg(msgEl, 'LTTDP saved.', 'success');
      } catch { showMsg(msgEl, 'Something went wrong.'); }
      finally { btn.disabled = false; btn.textContent = 'Save LTTDP'; }
    });

    // Render sessions
    const sessionsBody = document.getElementById('sessions-body');
    const sessions = sessionsData?.sessions || [];

    if (sessions.length === 0) {
      sessionsBody.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__text">No sessions logged yet.</div></div>';
    } else {
      const list = document.createElement('div');
      list.className = 'session-list';
      for (const s of sessions) {
        const entry = document.createElement('div');
        entry.className = 'session-entry';
        entry.innerHTML = `
          <div class="session-entry__header">
            <span class="session-entry__date">${formatSessionDate(s.date)}</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="session-entry__duration">${s.durationMinutes} min</span>
              <a href="session.html?sessionId=${escHtml(s.id)}&playerId=${escHtml(playerId)}" class="btn btn--ghost" style="padding:2px 8px;font-size:0.75rem;">Edit</a>
            </div>
          </div>
          <div class="session-entry__topics">${escHtml(s.topicsCovered)}</div>
          <div class="session-entry__notes">${escHtml(s.notes)}</div>
        `;
        list.appendChild(entry);
      }
      sessionsBody.appendChild(list);
    }

  } catch {
    mainContent.innerHTML = '<div class="card"><p>Something went wrong. Please refresh.</p></div>';
  }
})();
