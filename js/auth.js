(function () {
  const API_BASE = 'https://ctt-worker.andermd535.workers.dev';
  const SESSION_KEY = 'ctt_player_id';
  const EMAIL_KEY = 'ctt_player_email';
  const LOOKUP_KEY = 'ctt_lookup_result';

  function getPlayerSession() {
    return {
      playerId: sessionStorage.getItem(SESSION_KEY),
      email: sessionStorage.getItem(EMAIL_KEY),
    };
  }

  function setPlayerSession(playerId, email) {
    sessionStorage.setItem(SESSION_KEY, playerId);
    sessionStorage.setItem(EMAIL_KEY, email || '');
  }

  function clearPlayerSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(LOOKUP_KEY);
  }

  function setLookupResult(players, email) {
    sessionStorage.setItem(LOOKUP_KEY, JSON.stringify({ players, email }));
  }

  function getLookupResult() {
    try {
      const raw = sessionStorage.getItem(LOOKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearLookupResult() {
    sessionStorage.removeItem(LOOKUP_KEY);
  }

  async function checkOwnerAuth() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/check`, { credentials: 'include' });
      const data = await res.json();
      return data.authenticated === true;
    } catch {
      return false;
    }
  }

  // On protected owner pages: if not authenticated, redirect to index
  async function requireOwnerAuth() {
    const ok = await checkOwnerAuth();
    if (!ok) {
      window.location.href = '/index.html';
    }
    return ok;
  }

  // On player-facing pages: validate that the URL's playerId matches sessionStorage
  function requirePlayerAuth(expectedPlayerId) {
    const { playerId } = getPlayerSession();
    if (!playerId || playerId !== expectedPlayerId) {
      clearPlayerSession();
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  // On index.html: redirect already-authenticated users away from the landing page
  async function redirectIfAuthenticated() {
    const isOwner = await checkOwnerAuth();
    if (isOwner) {
      window.location.href = '/dashboard.html';
      return true;
    }
    const { playerId } = getPlayerSession();
    if (playerId) {
      window.location.href = `/profile.html?id=${playerId}`;
      return true;
    }
    return false;
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* best effort */ }
    clearPlayerSession();
    window.location.href = '/index.html';
  }

  window.CTTAuth = {
    getPlayerSession,
    setPlayerSession,
    clearPlayerSession,
    setLookupResult,
    getLookupResult,
    clearLookupResult,
    checkOwnerAuth,
    requireOwnerAuth,
    requirePlayerAuth,
    redirectIfAuthenticated,
    logout,
  };
})();
