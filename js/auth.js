(function () {
  const API_BASE = 'https://ctt-worker.andermd535.workers.dev';
  const SESSION_KEY = 'ctt_player_id';
  const EMAIL_KEY = 'ctt_player_email';
  const LOOKUP_KEY = 'ctt_lookup_result';
  const COACH_TOKEN_KEY = 'ctt_coach_token';

  // Capture session token from URL hash immediately on load (set by OAuth callback).
  // Hash fragments are never sent to servers, so the token is only visible in the browser.
  (function captureHashToken() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get('session');
    if (token) {
      sessionStorage.setItem(COACH_TOKEN_KEY, token);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  })();

  function getCoachToken() {
    return sessionStorage.getItem(COACH_TOKEN_KEY);
  }

  function clearCoachToken() {
    sessionStorage.removeItem(COACH_TOKEN_KEY);
  }

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
    const token = getCoachToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/check`, {
        headers: { 'X-Coach-Token': token },
      });
      const data = await res.json();
      return data.authenticated === true;
    } catch {
      return false;
    }
  }

  async function requireOwnerAuth() {
    const ok = await checkOwnerAuth();
    if (!ok) {
      window.location.href = '/index.html';
    }
    return ok;
  }

  function requirePlayerAuth(expectedPlayerId) {
    const { playerId } = getPlayerSession();
    if (!playerId || playerId !== expectedPlayerId) {
      clearPlayerSession();
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

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
    const token = getCoachToken();
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-Coach-Token': token },
        });
      }
    } catch { /* best effort */ }
    clearCoachToken();
    clearPlayerSession();
    window.location.href = '/index.html';
  }

  window.CTTAuth = {
    getCoachToken,
    clearCoachToken,
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
