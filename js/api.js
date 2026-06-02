(function () {
  // Set this to your deployed Worker URL in production.
  // During local dev with `wrangler dev`, the Worker runs on port 8787.
  // Example production value: 'https://ctt-worker.YOUR-ACCOUNT.workers.dev'
  const API_BASE = 'https://ctt-worker.andermd535.workers.dev';

  async function apiFetch(path, options = {}) {
    const { playerId } = window.CTTAuth ? window.CTTAuth.getPlayerSession() : {};
    const coachToken = window.CTTAuth ? window.CTTAuth.getCoachToken() : null;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (playerId) {
      headers['X-Player-Id'] = playerId;
    }

    if (coachToken) {
      headers['X-Coach-Token'] = coachToken;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      if (window.CTTAuth) window.CTTAuth.clearPlayerSession();
      window.location.href = '/index.html';
      return null;
    }

    return res;
  }

  async function apiGet(path) {
    return apiFetch(path, { method: 'GET' });
  }

  async function apiPost(path, body) {
    return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  }

  async function apiPut(path, body) {
    return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  async function apiDelete(path) {
    return apiFetch(path, { method: 'DELETE' });
  }

  async function parseJson(res) {
    if (!res) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  window.CTTAPI = { apiFetch, apiGet, apiPost, apiPut, apiDelete, parseJson };
})();
